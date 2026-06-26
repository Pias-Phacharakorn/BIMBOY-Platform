// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { CursurSurface } from "../../CursurSurface";

export interface ClipperPlaneState {
  id: string;
  name: string;
  enabled: boolean;
}

export class ClipperCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "3c1e220a-8a56-42d4-a114-1e0f6cb7d934" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  public planes: ClipperPlaneState[] = [];
  public placing = false;
  public nextPlaneIndex = 1;
  public selectedPlaneId: string | null = null;

  private _world: OBC.World;
  private _viewport: HTMLElement;
  private _components: OBC.Components;

  // Mouse move and click listener for placement mode
  private _viewportMouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private _viewportClickListener: ((e: PointerEvent) => void) | null = null;
  private _escapeKeyListener: ((e: KeyboardEvent) => void) | null = null;

  // Dedicated gizmo scene rendered in a 2nd pass (no clipping planes applied)
  private _gizmoScene: THREE.Scene;
  // Map: planeId -> { gizmoGroup, planeHelper }
  private _gizmoMap: Map<string, { gizmoGroup: THREE.Group; planeHelper: THREE.Object3D }> = new Map();
  private _onAfterUpdateListener: (() => void) | null = null;

  constructor(components: OBC.Components, world: OBC.World, viewport: HTMLElement) {
    super(components);
    this._components = components;
    this._world = world;
    this._viewport = viewport;

    components.add(ClipperCursor.uuid, this);

    // Create dedicated gizmo scene (rendered after main scene, no clipping)
    this._gizmoScene = new THREE.Scene();

    this._setupGlobalListeners();
    this._setupGizmoRenderPass();

    // Hook to customize clipping planes visually
    const clipper = components.get(OBC.Clipper);
    clipper.onAfterCreate.add((plane) => {
      this._customizePlane(plane);
    });

    for (const [, plane] of clipper.list) {
      this._customizePlane(plane);
    }

    console.log("ClipperCursor initialized with uuid: " + ClipperCursor.uuid);
  }

  /**
   * Register an onAfterUpdate listener on the world renderer.
   * Each frame: sync gizmo positions from plane helpers, then render the
   * gizmo scene with no clipping planes (autoClear=false → renders on top).
   */
  private _setupGizmoRenderPass() {
    const renderer = this._world.renderer;
    if (!renderer) return;

    this._onAfterUpdateListener = () => {
      const webgl = renderer.three as THREE.WebGLRenderer;
      const camera = this._world.camera?.three;
      if (!webgl || !camera) return;

      // Sync each gizmo group's world transform to its plane's helper transform
      for (const [, { gizmoGroup, planeHelper }] of this._gizmoMap) {
        planeHelper.updateWorldMatrix(true, false);
        gizmoGroup.position.setFromMatrixPosition(planeHelper.matrixWorld);
        gizmoGroup.quaternion.setFromRotationMatrix(planeHelper.matrixWorld);
      }

      // Temporarily suspend clipping planes and render gizmo scene on top
      const savedClippingPlanes = webgl.clippingPlanes;
      const savedAutoClear = webgl.autoClear;

      webgl.clippingPlanes = [];
      webgl.autoClear = false;

      webgl.render(this._gizmoScene, camera);

      // Restore
      webgl.clippingPlanes = savedClippingPlanes;
      webgl.autoClear = savedAutoClear;
    };

    renderer.onAfterUpdate.add(this._onAfterUpdateListener);
  }

  private _setupGlobalListeners() {
    this._escapeKeyListener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.placing) {
        console.log("Escape key pressed during placement");
        this.exitPlacementMode();
      }
    };
    window.addEventListener("keydown", this._escapeKeyListener);
  }

  public selectPlane(id: string | null) {
    this.selectedPlaneId = id;
    const clipper = this._components.get(OBC.Clipper);
    for (const planeState of this.planes) {
      const plane = clipper.list.get(planeState.id);
      if (plane) {
        plane.visible = planeState.enabled && (planeState.id === id);
      }
      // Gizmo: only visible for the selected plane
      const entry = this._gizmoMap.get(planeState.id);
      if (entry) {
        entry.gizmoGroup.visible = planeState.enabled && (planeState.id === id);
      }
    }
    this._updateMasterClipperState();
    this.onStateChanged.trigger();
  }

  public togglePlane(id: string, enabled: boolean) {
    console.log(`togglePlane: id=${id}, enabled=${enabled}`);
    const planeState = this.planes.find((p) => p.id === id);
    if (!planeState) return;

    planeState.enabled = enabled;
    const clipper = this._components.get(OBC.Clipper);
    const plane = clipper.list.get(id);

    if (plane) {
      plane.enabled = enabled;
      plane.visible = enabled && (id === this.selectedPlaneId);
    }

    // Show/hide gizmo: only visible when enabled AND selected
    const entry = this._gizmoMap.get(id);
    if (entry) {
      entry.gizmoGroup.visible = enabled && (id === this.selectedPlaneId);
    }

    this._updateMasterClipperState();
    this.onStateChanged.trigger();
  }

  public deletePlane(id: string) {
    console.log("deletePlane: " + id);

    const clipper = this._components.get(OBC.Clipper);
    clipper.delete(this._world, id);

    this.planes = this.planes.filter((p) => p.id !== id);

    if (this.selectedPlaneId === id) {
      this.selectedPlaneId = this.planes.length > 0 ? this.planes[0].id : null;
    }

    this.selectPlane(this.selectedPlaneId);
  }

  public enterPlacementMode() {
    console.log("enterPlacementMode. Current planes count: " + this.planes.length);
    if (this.planes.length >= 6) {
      console.log("WARNING: Max 6 planes allowed");
      return;
    }

    if (this.placing) return;

    this.placing = true;
    this._viewport.style.cursor = "crosshair";

    const cursurSurface = this._components.get(CursurSurface);
    cursurSurface.setWorld(this._world);
    console.log("CursurSurface world set");

    const canvas = this._world.renderer!.three.domElement;
    let raycastInProgress = false;

    // 1. Mousemove listener to update the green surface cursor
    this._viewportMouseMoveListener = () => {
      if (!raycastInProgress) {
        raycastInProgress = true;

        const raycasters = this._components.get(OBC.Raycasters);
        const raycaster = raycasters.get(this._world);

        // Call castRay() without parameters so it uses the raycaster's own tracked mouse coordinates
        raycaster.castRay().then((result) => {
          if (result && result.point && ((result as any).normal || (result.face && result.object))) {
            const worldNormal = (result as any).normal 
              ? (result as any).normal.clone() 
              : result.face!.normal.clone().transformDirection(result.object.matrixWorld).normalize();
            
            cursurSurface.update(result.point, worldNormal);
          } else {
            cursurSurface.hide();
          }
        }).catch((err) => {
          console.log("Raycasting failed on hover: " + err.message);
          cursurSurface.hide();
        }).finally(() => {
          raycastInProgress = false;
        });
      }
    };
    canvas.addEventListener("mousemove", this._viewportMouseMoveListener);
    console.log("mousemove listener registered on canvas");

    // 2. Click (pointerup) listener to place plane
    this._viewportClickListener = (e: PointerEvent) => {
      console.log("Canvas pointerup captured during placement");
      e.preventDefault();
      e.stopPropagation();

      const raycasters = this._components.get(OBC.Raycasters);
      const raycaster = raycasters.get(this._world);

      // Call castRay() without parameters so it uses the raycaster's own tracked mouse coordinates
      raycaster.castRay().then((result) => {
        console.log("Placement raycast finished. Hit: " + (result !== null));
        if (result) {
          console.log(`Result details - point: ${!!result.point}, normal: ${!!(result as any).normal}, face: ${!!result.face}, object: ${!!result.object}`);
        }
        if (result && result.point && ((result as any).normal || (result.face && result.object))) {
          const worldNormal = (result as any).normal 
            ? (result as any).normal.clone() 
            : result.face!.normal.clone().transformDirection(result.object.matrixWorld).normalize();
          const point = result.point;

          this._createPlaneFromPlacement(worldNormal, point);
        } else {
          console.log("WARNING: Placement raycast did not hit any element");
        }
        this.exitPlacementMode();
      }).catch((err) => {
        console.log("ERROR: Raycasting failed on click: " + err.message);
        this.exitPlacementMode();
      });
    };

    // Delay slightly to prevent click event that triggered placement mode from firing instantly
    setTimeout(() => {
      if (this.placing) {
        canvas.addEventListener("pointerup", this._viewportClickListener!, true);
        console.log("pointerup listener registered on canvas");
      }
    }, 50);

    this.onStateChanged.trigger();
  }

  public exitPlacementMode() {
    console.log("exitPlacementMode called");
    if (!this.placing) return;

    this.placing = false;
    this._viewport.style.cursor = "";

    const cursurSurface = this._components.get(CursurSurface);
    cursurSurface.hide();

    const canvas = this._world.renderer?.three?.domElement;
    if (canvas) {
      if (this._viewportMouseMoveListener) {
        canvas.removeEventListener("mousemove", this._viewportMouseMoveListener);
        this._viewportMouseMoveListener = null;
        console.log("mousemove listener removed");
      }

      if (this._viewportClickListener) {
        canvas.removeEventListener("pointerup", this._viewportClickListener, true);
        this._viewportClickListener = null;
        console.log("pointerup listener removed");
      }
    }

    this.onStateChanged.trigger();
  }

  private _createPlaneFromPlacement(normal: THREE.Vector3, point: THREE.Vector3) {
    const negatedNormal = normal.clone().negate();
    console.log(`Creating plane: Normal=(${negatedNormal.x.toFixed(2)},${negatedNormal.y.toFixed(2)},${negatedNormal.z.toFixed(2)})`);
    const clipper = this._components.get(OBC.Clipper);
    const planeId = clipper.createFromNormalAndCoplanarPoint(this._world, negatedNormal, point);

    const planeState: ClipperPlaneState = {
      id: planeId,
      name: `Plane ${this.nextPlaneIndex}`,
      enabled: true,
    };

    this.planes.push(planeState);
    this.nextPlaneIndex++;

    this.selectedPlaneId = planeId;
    this.selectPlane(planeId);
    console.log("Plane created successfully. ID: " + planeId);
  }

  public createPlane(normal: THREE.Vector3, origin: THREE.Vector3, name: string, enabled: boolean) {
    const clipper = this._components.get(OBC.Clipper);
    const planeId = clipper.createFromNormalAndCoplanarPoint(this._world, normal, origin);

    const planeState: ClipperPlaneState = {
      id: planeId,
      name,
      enabled,
    };

    this.planes.push(planeState);

    if (!this.selectedPlaneId) {
      this.selectedPlaneId = planeId;
    }

    const plane = clipper.list.get(planeId);
    if (plane) {
      plane.enabled = enabled;
      plane.visible = enabled && (planeId === this.selectedPlaneId);
    }

    this._updateMasterClipperState();
    this.onStateChanged.trigger();
    return planeId;
  }

  private _updateMasterClipperState() {
    const clipper = this._components.get(OBC.Clipper);
    const anyEnabled = this.planes.some((p) => p.enabled);
    clipper.enabled = anyEnabled;
  }

  dispose() {
    this.exitPlacementMode();

    if (this._escapeKeyListener) {
      window.removeEventListener("keydown", this._escapeKeyListener);
      this._escapeKeyListener = null;
    }

    // Remove the gizmo render pass listener
    if (this._onAfterUpdateListener && this._world.renderer) {
      this._world.renderer.onAfterUpdate.remove(this._onAfterUpdateListener);
      this._onAfterUpdateListener = null;
    }

    // Dispose all gizmo groups in the gizmo scene
    for (const [, { gizmoGroup }] of this._gizmoMap) {
      this._disposeGizmoGroup(gizmoGroup);
    }
    this._gizmoMap.clear();

    // Remove all planes
    const clipper = this._components.get(OBC.Clipper);
    for (const planeState of this.planes) {
      clipper.delete(this._world, planeState.id);
    }
    this.planes = [];

    this._updateMasterClipperState();

    this.onDisposed.trigger(ClipperCursor.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }

  private _disposeGizmoGroup(gizmoGroup: THREE.Group) {
    this._gizmoScene.remove(gizmoGroup);
    gizmoGroup.traverse((child: any) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  private _customizePlane(plane: any) {
    if (!plane || !plane.helper) return;

    const makeInvisibleMaterial = (originalMaterial: THREE.Material | THREE.Material[]) => {
      const makeInvisible = (mat: THREE.Material) => {
        mat.transparent = true;
        mat.opacity = 0;
        mat.depthWrite = false;
        mat.depthTest = false;
      };
      if (Array.isArray(originalMaterial)) {
        originalMaterial.forEach(makeInvisible);
      } else if (originalMaterial) {
        makeInvisible(originalMaterial);
      }
    };

    // Traverse and hide default helper meshes visually
    plane.helper.traverse((child: THREE.Object3D) => {
      if (
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments ||
        child instanceof THREE.LineLoop
      ) {
        if (child.material) {
          try {
            child.material = child.material.clone();
            makeInvisibleMaterial(child.material);
          } catch (err) {
            console.warn("Failed to hide clipper helper element:", err);
          }
        }
      }
    });

    // Build the custom gizmo group — lives in _gizmoScene, NOT in plane.helper
    const gizmoGroup = new THREE.Group();
    gizmoGroup.name = "BIMBOY_Gizmo";

    const length = 0.8;
    const coneHeight = 0.15;
    const coneRadius = 0.04;

    // All materials use depthTest:false (renders on top) + no clipping
    const matOpts = { depthTest: false, depthWrite: false };

    const redLineMat = new THREE.LineBasicMaterial({ color: 0xff0000, ...matOpts });
    const greenLineMat = new THREE.LineBasicMaterial({ color: 0x00ff00, ...matOpts });
    const blueLineMat = new THREE.LineBasicMaterial({ color: 0x0000ff, ...matOpts });

    const redMeshMat = new THREE.MeshBasicMaterial({ color: 0xff0000, ...matOpts });
    const greenMeshMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, ...matOpts });
    const blueMeshMat = new THREE.MeshBasicMaterial({ color: 0x0000ff, ...matOpts });

    const diamondMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
    const diamondGeo = new THREE.PlaneGeometry(0.3, 0.3);

    // Center diamond
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.rotation.z = Math.PI / 4;
    diamond.renderOrder = 999;
    gizmoGroup.add(diamond);

    // Helper to build axis lines and cones
    const createAxis = (
      dir: THREE.Vector3,
      lineMat: THREE.LineBasicMaterial,
      meshMat: THREE.MeshBasicMaterial,
      rotZ: number,
      rotX: number
    ) => {
      const points = [
        dir.clone().multiplyScalar(-length + coneHeight),
        dir.clone().multiplyScalar(length - coneHeight),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.LineSegments(lineGeo, lineMat);
      line.renderOrder = 999;
      gizmoGroup.add(line);

      // Positive direction cone
      const conePos = new THREE.Mesh(coneGeo, meshMat);
      conePos.position.copy(dir).multiplyScalar(length - coneHeight / 2);
      if (rotZ !== 0) conePos.rotation.z = rotZ;
      if (rotX !== 0) conePos.rotation.x = rotX;
      conePos.renderOrder = 999;
      gizmoGroup.add(conePos);

      // Negative direction cone
      const coneNeg = new THREE.Mesh(coneGeo, meshMat);
      coneNeg.position.copy(dir).multiplyScalar(-length + coneHeight / 2);
      if (rotZ !== 0) coneNeg.rotation.z = rotZ + Math.PI;
      else coneNeg.rotation.z = Math.PI;
      if (rotX !== 0) coneNeg.rotation.x = rotX + Math.PI;
      coneNeg.renderOrder = 999;
      gizmoGroup.add(coneNeg);
    };

    // X Axis (Red)
    createAxis(new THREE.Vector3(1, 0, 0), redLineMat, redMeshMat, -Math.PI / 2, 0);

    // Y Axis (Green)
    createAxis(new THREE.Vector3(0, 1, 0), greenLineMat, greenMeshMat, 0, 0);

    // Z Axis (Blue)
    createAxis(new THREE.Vector3(0, 0, 1), blueLineMat, blueMeshMat, 0, Math.PI / 2);

    // Add gizmo to the dedicated gizmo scene (not to plane.helper)
    this._gizmoScene.add(gizmoGroup);

    // Find the plane id to track in _gizmoMap
    const clipper = this._components.get(OBC.Clipper);
    let planeId: string | null = null;
    for (const [id, p] of clipper.list) {
      if (p === plane) {
        planeId = id;
        break;
      }
    }

    if (planeId) {
      this._gizmoMap.set(planeId, { gizmoGroup, planeHelper: plane.helper });

      // Gizmo visible only when this plane is enabled AND currently selected
      const planeState = this.planes.find((p) => p.id === planeId);
      const isEnabled = planeState ? planeState.enabled : true;
      const isSelected = planeId === this.selectedPlaneId;
      gizmoGroup.visible = isEnabled && isSelected;
    }

    // Listen to disposal to free memory
    plane.onDisposed.add(() => {
      this._disposeGizmoGroup(gizmoGroup);
      if (planeId) this._gizmoMap.delete(planeId);
    });
  }
}

// Expose setupClipperCursor for initial setup mapping
export const setupClipperCursor = (
  components: OBC.Components,
  world: OBC.World,
  viewport: HTMLElement
) => {
  const clipperCursor = new ClipperCursor(components, world, viewport);
  return () => {
    clipperCursor.dispose();
  };
};
