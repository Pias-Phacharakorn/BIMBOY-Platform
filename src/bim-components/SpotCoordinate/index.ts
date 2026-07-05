// @ts-nocheck
import * as OBC from "@thatopen/components";
import { Spot3DHelperManager } from "./src/Spot3DHelperManager";
import { SpotLabelManager } from "./src/SpotLabelManager";
import { CursorSurface } from "../CursorSurface";

export class SpotCoordinate extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "9d273a21-4f81-4475-b6d8-21d9b3d0a273" as const;

  readonly onDisposed = new OBC.Event<string>();

  private _enabled = false;
  private _world: OBC.World | null = null;

  // Dynamic color configuration
  private _currentStrokeColor = "rgba(80, 160, 255, 0.95)";
  private _currentFillColor = "rgba(80, 160, 255, 0.12)";

  // DOM and Three.js event listeners
  private _spotClickListener: ((e: MouseEvent) => void) | null = null;
  private _spotMoveListener: ((e: MouseEvent) => void) | null = null;
  private _spotMouseLeaveListener: (() => void) | null = null;
  private _spotCameraListener: (() => void) | null = null;

  // Helpers

  // Sub-managers
  public helper3DManager!: Spot3DHelperManager;
  public labelManager!: SpotLabelManager;

  constructor(components: OBC.Components) {
    super(components);
    components.add(SpotCoordinate.uuid, this);

    this.helper3DManager = new Spot3DHelperManager();
    this.labelManager = new SpotLabelManager();
  }

  public get enabled() {
    return this._enabled;
  }

  public set enabled(value: boolean) {
    if (this._enabled === value) return;
    this._enabled = value;
    if (value) {
      this._activate();
    } else {
      this._deactivate();
    }
  }

  public get world() {
    return this._world;
  }

  public set world(world: OBC.World | null) {
    if (this._world === world) return;
    const wasEnabled = this._enabled;
    if (wasEnabled) {
      this.enabled = false;
    }
    this._world = world;
    if (wasEnabled && world) {
      this.enabled = true;
    }
  }

  public clearSpotLabels() {
    this.labelManager.clearSpotLabels();
  }

  public get onLabelsChanged() {
    return this.labelManager.onLabelsChanged;
  }

  dispose() {
    this.enabled = false;
    this.helper3DManager.dispose();
    this.onDisposed.trigger(SpotCoordinate.uuid);
    this.onDisposed.reset();
  }

  private _activate() {
    if (!this._world) {
      console.warn("SpotCoordinate cannot be activated without a world");
      this._enabled = false;
      return;
    }

    const renderer = this._world.renderer;
    if (!renderer || !renderer.three) {
      console.warn("SpotCoordinate cannot be activated: renderer not available");
      this._enabled = false;
      return;
    }
    const viewport = renderer.three.domElement;

    // Initialize CursorSurface world
    const cursorSurface = this.components.get(CursorSurface);
    cursorSurface.setWorld(this._world);

    // Double-click handler to place coordinate labels
    this._spotClickListener = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (this._world) {
        void this.labelManager.handleSpotClick(e, this._world, this.components);
      }
    };
    viewport.addEventListener("dblclick", this._spotClickListener);

    // Mousemove handler to update CursorSurface normal alignment
    let raycastInProgress = false;
    this._spotMoveListener = (e: MouseEvent) => {
      if (!this._world) return;

      // Update CursorSurface asynchronously to prevent lag
      if (!raycastInProgress) {
        raycastInProgress = true;
        const raycasters = this.components.get(OBC.Raycasters);
        const raycaster = raycasters.get(this._world);
        const cursorSurface = this.components.get(CursorSurface);
        raycaster.castRay().then((result) => {
          if (result && result.point && ((result as any).normal || (result.face && result.object))) {
            const worldNormal = (result as any).normal 
              ? (result as any).normal.clone() 
              : result.face!.normal.clone().transformDirection(result.object.matrixWorld).normalize();

            cursorSurface.update(result.point, worldNormal);

            const absY = Math.abs(worldNormal.y);
            if (absY > 0.85) {
              // Horizontal face (green)
              this._currentStrokeColor = "rgba(92, 214, 92, 0.95)";
              this._currentFillColor = "rgba(92, 214, 92, 0.12)";
            } else if (absY < 0.15) {
              // Vertical face (red)
              this._currentStrokeColor = "rgba(255, 77, 77, 0.95)";
              this._currentFillColor = "rgba(255, 77, 77, 0.12)";
            } else {
              // Slanted face (blue)
              this._currentStrokeColor = "rgba(36, 166, 241, 0.95)";
              this._currentFillColor = "rgba(36, 166, 241, 0.12)";
            }
          } else {
            cursorSurface.hide();
            this._currentStrokeColor = "rgba(80, 160, 255, 0.95)";
            this._currentFillColor = "rgba(80, 160, 255, 0.12)";
          }
        }).catch((err) => {
          console.warn("Raycasting failed on mousemove", err);
          cursorSurface.hide();
        }).finally(() => {
          raycastInProgress = false;
        });
      }
    };
    viewport.addEventListener("mousemove", this._spotMoveListener);

    // Mouseleave handler to hide overlays
    this._spotMouseLeaveListener = () => {
      this.components.get(CursorSurface).hide();
    };
    viewport.addEventListener("mouseleave", this._spotMouseLeaveListener);

    // Camera update handler to project labels in real-time
    this._spotCameraListener = () => {
      if (this._world) {
        this.labelManager.updateLabelPositions(this._world);
      }
    };

    if (this._world.camera && this._world.camera.controls) {
      this._world.camera.controls.addEventListener("update", this._spotCameraListener);
    }
    this._world.onCameraChanged.add(this._spotCameraListener);
  }

  private _deactivate() {
    if (!this._world) return;
    const renderer = this._world.renderer;
    const viewport = renderer && renderer.three ? renderer.three.domElement : null;

    if (viewport) {
      if (this._spotClickListener) {
        viewport.removeEventListener("dblclick", this._spotClickListener);
        this._spotClickListener = null;
      }
      if (this._spotMoveListener) {
        viewport.removeEventListener("mousemove", this._spotMoveListener);
        this._spotMoveListener = null;
      }
      if (this._spotMouseLeaveListener) {
        viewport.removeEventListener("mouseleave", this._spotMouseLeaveListener);
        this._spotMouseLeaveListener = null;
      }
    }
    if (this._spotCameraListener) {
      try {
        // `world.camera` is a GETTER that THROWS ("No camera initialized!") once
        // the camera has been torn down — which happens during Components.dispose().
        // So `this._world.camera && ...` can't guard it; wrap in try/catch instead.
        if (this._world.camera && this._world.camera.controls) {
          this._world.camera.controls.removeEventListener("update", this._spotCameraListener);
        }
      } catch {
        // Camera already disposed during teardown — nothing to detach.
      }
      if (this._world.onCameraChanged) {
        this._world.onCameraChanged.remove(this._spotCameraListener);
      }
      this._spotCameraListener = null;
    }
    try {
      this.components.get(CursorSurface).hide();
    } catch {
      // CursorSurface may already be disposed during teardown.
    }

    this._currentStrokeColor = "rgba(80, 160, 255, 0.95)";
    this._currentFillColor = "rgba(80, 160, 255, 0.12)";

    this.clearSpotLabels();
  }
}

