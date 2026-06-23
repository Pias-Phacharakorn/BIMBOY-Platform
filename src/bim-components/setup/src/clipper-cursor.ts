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

  constructor(components: OBC.Components, world: OBC.World, viewport: HTMLElement) {
    super(components);
    this._components = components;
    this._world = world;
    this._viewport = viewport;

    components.add(ClipperCursor.uuid, this);

    this._setupGlobalListeners();
    console.log("ClipperCursor initialized with uuid: " + ClipperCursor.uuid);
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
