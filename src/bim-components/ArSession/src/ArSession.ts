// @ts-nocheck
import * as THREE from "three";
import * as OBC from "@thatopen/components";

export type ArSessionStatus =
  | "idle"
  | "unsupported"
  | "requesting"
  | "active"
  | "error";

interface SuspendedState {
  cameraEnabled: boolean;
  rendererEnabled: boolean;
  controlsEnabled: boolean;
  postproductionEnabled: boolean;
  cameraPosition: THREE.Vector3;
  cameraQuaternion: THREE.Quaternion;
}

/**
 * Drives a WebXR "immersive-ar" session for the currently active OBC.World,
 * reusing its already-loaded scene content instead of loading a second copy
 * of the model. Postprocessing is not stereo/XR-aware, so it is suspended for
 * the duration of the session in favor of a direct WebGLRenderer.render() call
 * driven by the XR frame loop.
 */
export class ArSession extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "7a1e4f6b-2c9d-4e3a-9f7c-51d0b8a2f6e3" as const;

  readonly onDisposed = new OBC.Event<string>();
  readonly onStatusChanged = new OBC.Event<ArSessionStatus>();
  readonly onError = new OBC.Event<string>();

  private _enabled = false;
  private _world: OBC.World | null = null;
  private _status: ArSessionStatus = "idle";
  private _lastError: string | null = null;

  private _session: XRSession | null = null;
  private _hitTestSource: any | null = null;
  private _viewerSpace: XRReferenceSpace | null = null;

  private _reticle: THREE.Mesh | null = null;
  private _placementGroup: THREE.Group | null = null;
  private _hiddenGrid: THREE.Object3D | null = null;
  private _prev: SuspendedState | null = null;

  private _onXRFrame = (_time: number, frame: any) => {
    const world = this._world;
    if (!world || !world.renderer) return;

    const renderer = world.renderer.three as THREE.WebGLRenderer;

    if (frame && this._hitTestSource) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const results = frame.getHitTestResults(this._hitTestSource);
      if (results.length > 0 && referenceSpace) {
        const pose = results[0].getPose(referenceSpace);
        if (pose && this._reticle) {
          this._reticle.visible = true;
          this._reticle.matrix.fromArray(pose.transform.matrix);
        }
      } else if (this._reticle) {
        this._reticle.visible = false;
      }
    }

    renderer.render(world.scene.three, world.camera.three);
  };

  private _onSelect = () => {
    if (!this._reticle?.visible || !this._placementGroup) return;
    const position = new THREE.Vector3().setFromMatrixPosition(
      this._reticle.matrix
    );
    this._placementGroup.position.copy(position);
    this._placementGroup.updateMatrixWorld(true);
  };

  private _onSessionEnd = () => {
    void this._teardown();
  };

  constructor(components: OBC.Components) {
    super(components);
    components.add(ArSession.uuid, this);
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  get status() {
    return this._status;
  }

  get lastError() {
    return this._lastError;
  }

  set world(world: OBC.World | null) {
    this._world = world;
  }

  get world() {
    return this._world;
  }

  static async isSupported(): Promise<boolean> {
    const nav = navigator as any;
    if (!nav.xr?.isSessionSupported) return false;
    try {
      return await nav.xr.isSessionSupported("immersive-ar");
    } catch {
      return false;
    }
  }

  async start(overlayRoot: HTMLElement): Promise<void> {
    if (this._status === "active" || this._status === "requesting") return;
    if (!this._world || !this._world.renderer) {
      this._setStatus("error");
      return;
    }

    const nav = navigator as any;
    if (!nav.xr) {
      this._setStatus("unsupported");
      return;
    }

    this._setStatus("requesting");

    const world = this._world;
    const renderer = world.renderer.three as THREE.WebGLRenderer;

    try {
      const session: XRSession = await nav.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: overlayRoot },
      });

      this._session = session;
      // Attach cleanup listeners immediately so that if a later step throws,
      // ending the session below still runs full teardown via _onSessionEnd.
      session.addEventListener("select", this._onSelect);
      session.addEventListener("end", this._onSessionEnd);

      this._suspendNormalRendering(world);

      const gl = renderer.getContext() as any;
      if (typeof gl.makeXRCompatible === "function") {
        await gl.makeXRCompatible();
      }

      renderer.xr.enabled = true;
      // Default 'local' reference space — every immersive-ar device supports it
      // unconditionally. 'local-floor' would need to be negotiated as a feature
      // at requestSession() time, and isn't needed since placement comes from
      // the hit-test pose rather than an assumed floor height.
      await renderer.xr.setSession(session);

      this._preparePlacementGroup(world.scene.three);
      this._setupReticle(world.scene.three);

      this._viewerSpace = await session.requestReferenceSpace("viewer");
      this._hitTestSource = await (session as any).requestHitTestSource({
        space: this._viewerSpace,
      });

      renderer.setAnimationLoop(this._onXRFrame);

      this._setStatus("active");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to start AR session", err);
      this._lastError = message;

      const session = this._session;
      await this._teardown();
      if (session) {
        await session.end().catch(() => {});
      }

      this.onError.trigger(message);
      this._setStatus("error");
    }
  }

  async exit(): Promise<void> {
    if (this._session) {
      await this._session.end().catch(() => {});
    }
  }

  dispose() {
    void this.exit();
    this.onDisposed.trigger(ArSession.uuid);
    this.onDisposed.reset();
    this.onStatusChanged.reset();
    this.onError.reset();
  }

  private _setStatus(status: ArSessionStatus) {
    this._status = status;
    this.onStatusChanged.trigger(status);
  }

  private _preparePlacementGroup(scene: THREE.Scene) {
    if (!this._placementGroup) {
      this._placementGroup = new THREE.Group();
      this._placementGroup.name = "ArPlacementGroup";
      scene.add(this._placementGroup);
    }
    const toMove = scene.children.filter(
      (child) => child !== this._placementGroup && child !== this._reticle
    );
    for (const child of toMove) {
      this._placementGroup.add(child);
    }
  }

  private _setupReticle(scene: THREE.Scene) {
    const geometry = new THREE.RingGeometry(0.08, 0.1, 32).rotateX(
      -Math.PI / 2
    );
    const material = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    this._reticle = new THREE.Mesh(geometry, material);
    this._reticle.matrixAutoUpdate = false;
    this._reticle.visible = false;
    scene.add(this._reticle);
  }

  private _teardownReticle() {
    if (this._reticle) {
      this._reticle.geometry.dispose();
      (this._reticle.material as THREE.Material).dispose();
      this._reticle.removeFromParent();
      this._reticle = null;
    }
  }

  private _suspendNormalRendering(world: OBC.World) {
    const renderer = world.renderer!;
    const postproduction = (renderer as any).postproduction;

    this._prev = {
      cameraEnabled: world.camera.enabled,
      rendererEnabled: renderer.enabled,
      controlsEnabled: !!world.camera.controls?.enabled,
      postproductionEnabled: !!postproduction?.enabled,
      cameraPosition: (world.camera.three as THREE.Camera).position.clone(),
      cameraQuaternion: (
        world.camera.three as THREE.Camera
      ).quaternion.clone(),
    };

    world.camera.enabled = false;
    renderer.enabled = false;
    if (world.camera.controls) world.camera.controls.enabled = false;
    try {
      if (postproduction) postproduction.enabled = false;
    } catch {
      // postproduction not initialized yet — nothing to suspend
    }

    (world.camera.three as THREE.Camera).position.set(0, 0, 0);
    (world.camera.three as THREE.Camera).quaternion.identity();

    try {
      const grid = this.components.get(OBC.Grids).list.get(world.uuid);
      // Only take ownership of a grid that is actually showing. The grid is now hidden
      // by default (create-world.ts), so restoring unconditionally on AR exit would
      // switch on a grid the user never had.
      if (grid?.three?.visible) {
        this._hiddenGrid = grid.three;
        grid.three.visible = false;
      }
    } catch {
      // grids not set up for this world — nothing to hide
    }
  }

  private _restoreNormalRendering() {
    const world = this._world;
    if (!world || !this._prev) return;

    const renderer = world.renderer;
    if (renderer) {
      renderer.enabled = this._prev.rendererEnabled;
      const postproduction = (renderer as any).postproduction;
      try {
        if (postproduction) postproduction.enabled = this._prev.postproductionEnabled;
      } catch {
        // ignore
      }
    }

    world.camera.enabled = this._prev.cameraEnabled;
    if (world.camera.controls) {
      world.camera.controls.enabled = this._prev.controlsEnabled;
    }
    (world.camera.three as THREE.Camera).position.copy(
      this._prev.cameraPosition
    );
    (world.camera.three as THREE.Camera).quaternion.copy(
      this._prev.cameraQuaternion
    );

    if (this._hiddenGrid) {
      this._hiddenGrid.visible = true;
      this._hiddenGrid = null;
    }

    this._prev = null;
  }

  private async _teardown() {
    const renderer = this._world?.renderer?.three as
      | THREE.WebGLRenderer
      | undefined;

    if (this._session) {
      this._session.removeEventListener("select", this._onSelect);
      this._session.removeEventListener("end", this._onSessionEnd);
    }

    if (this._hitTestSource) {
      try {
        this._hitTestSource.cancel();
      } catch {
        // already cancelled by the session ending
      }
      this._hitTestSource = null;
    }
    this._viewerSpace = null;

    if (renderer) {
      renderer.setAnimationLoop(null);
      renderer.xr.enabled = false;
    }

    if (this._placementGroup) {
      this._placementGroup.position.set(0, 0, 0);
      this._placementGroup.quaternion.identity();
    }

    this._teardownReticle();
    this._restoreNormalRendering();

    this._session = null;
    this._setStatus("idle");
  }
}
