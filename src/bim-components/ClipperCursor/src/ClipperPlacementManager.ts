import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { CursorSurface } from "../../CursorSurface";

/** Delay before arming the click listener, so the click that opened placement can't place. */
const ARM_DELAY = 50;

export interface ClipperPlacementOptions {
  components: OBC.Components;
  world: OBC.World;
  viewport: HTMLElement;
  /** False when the plane limit is reached. */
  canPlace: () => boolean;
  /** A surface was clicked: its normal and the point, both in world space. */
  onPlace: (normal: THREE.Vector3, point: THREE.Vector3) => void;
  /** Called on entering placement, so hover highlights elsewhere can be dropped. */
  onEnter: () => void;
}

/**
 * Place-a-plane-by-clicking mode: paints `CursorSurface` on whatever is under the cursor,
 * then hands the clicked surface's normal and point to the owner. Escape cancels.
 */
export class ClipperPlacementManager {
  /** Fires when placement starts or stops, so the owner can notify React. */
  readonly onChanged = new OBC.Event<void>();

  private _placing = false;
  private _mouseMoveListener: (() => void) | null = null;
  private _clickListener: ((e: PointerEvent) => void) | null = null;
  private _escapeListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly _options: ClipperPlacementOptions) {
    this._escapeListener = (e) => {
      if (e.key === "Escape" && this._placing) this.exit();
    };
    window.addEventListener("keydown", this._escapeListener);
  }

  get placing() {
    return this._placing;
  }

  private get _canvas() {
    return this._options.world.renderer?.three?.domElement ?? null;
  }

  private get _raycaster() {
    return this._options.components.get(OBC.Raycasters).get(this._options.world);
  }

  enter() {
    if (this._placing || !this._options.canPlace()) return;

    const canvas = this._canvas;
    if (!canvas) return;

    this._options.onEnter();
    this._placing = true;
    this._options.viewport.style.cursor = "crosshair";

    const cursorSurface = this._options.components.get(CursorSurface);
    cursorSurface.setWorld(this._options.world);

    // Hover: paint the surface cursor, one raycast at a time.
    let raycastInProgress = false;
    this._mouseMoveListener = () => {
      if (raycastInProgress) return;
      raycastInProgress = true;

      this._raycaster
        .castRay()
        .then((result) => {
          const surface = this._surfaceOf(result);
          if (surface) cursorSurface.update(surface.point, surface.normal);
          else cursorSurface.hide();
        })
        .catch(() => cursorSurface.hide())
        .finally(() => {
          raycastInProgress = false;
        });
    };
    canvas.addEventListener("mousemove", this._mouseMoveListener);

    // Click: place, then leave placement mode either way.
    this._clickListener = (e) => {
      e.preventDefault();
      e.stopPropagation();

      this._raycaster
        .castRay()
        .then((result) => {
          const surface = this._surfaceOf(result);
          if (surface) this._options.onPlace(surface.normal, surface.point);
        })
        .finally(() => this.exit());
    };

    setTimeout(() => {
      if (this._placing && this._clickListener) {
        canvas.addEventListener("pointerup", this._clickListener, true);
      }
    }, ARM_DELAY);

    this.onChanged.trigger();
  }

  exit() {
    if (!this._placing) return;

    this._placing = false;
    this._options.viewport.style.cursor = "";
    this._options.components.get(CursorSurface).hide();

    const canvas = this._canvas;
    if (canvas) {
      if (this._mouseMoveListener) {
        canvas.removeEventListener("mousemove", this._mouseMoveListener);
      }
      if (this._clickListener) {
        canvas.removeEventListener("pointerup", this._clickListener, true);
      }
    }
    this._mouseMoveListener = null;
    this._clickListener = null;

    this.onChanged.trigger();
  }

  /**
   * World-space normal and point of a raycast hit, or null if it missed or carries no usable
   * orientation. Fragment hits report a `normal` directly; plain three.js hits only carry a
   * face normal in object space, which has to be taken through the object's world matrix.
   */
  private _surfaceOf(
    result: Awaited<ReturnType<OBC.SimpleRaycaster["castRay"]>>,
  ): { normal: THREE.Vector3; point: THREE.Vector3 } | null {
    if (!result?.point) return null;

    const reported = (result as { normal?: THREE.Vector3 }).normal;
    if (reported) return { normal: reported.clone(), point: result.point };

    if (result.face && result.object) {
      const normal = result.face.normal
        .clone()
        .transformDirection(result.object.matrixWorld)
        .normalize();
      return { normal, point: result.point };
    }

    return null;
  }

  dispose() {
    this.exit();

    if (this._escapeListener) {
      window.removeEventListener("keydown", this._escapeListener);
      this._escapeListener = null;
    }
    this.onChanged.reset();
  }
}
