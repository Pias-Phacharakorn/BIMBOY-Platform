import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { CursorSurface } from "../../CursorSurface";
// Type-only, and from the module rather than `../../setup`: that barrel imports `../ClipperCursor`,
// so a value import would close a cycle. `import type` is erased at build time, so this one cannot
// — but the narrow path keeps that true even if someone later drops the `type`.
import type { ClipAwareRaycaster } from "../../setup/src/clip-aware-raycaster";

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

  /**
   * Typed to the subclass, not to what `Raycasters.get()` declares: both picks here pass
   * `requireNormal`, which only `ClipAwareRaycaster` understands. `setupClipAwareRaycaster` has
   * already swapped the instance in `Raycasters.list` by the time any world is usable, so this is
   * the real type — the base signature is what is inaccurate.
   */
  private get _raycaster() {
    return this._options.components
      .get(OBC.Raycasters)
      .get(this._options.world) as ClipAwareRaycaster;
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
        // The marker is oriented to the surface, so it needs the normal as much as the click
        // does — and it is the cue you aim with, so letting it flicker off would just move the
        // bug rather than fix it.
        .castRay({ requireNormal: true })
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
        // ⚠️ Without this the vendor's GPU pick returns a hit whose `normal` is null whenever a
        // tile streamed in between its id and normal passes, `_surfaceOf` rejects it, and the
        // plane is silently never created. It bit the *first* plane only: from one plane onward
        // `clippingPlanes` is non-empty, so `ClipAwareRaycaster` already took this same path.
        .castRay({ requireNormal: true })
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
   *
   * ⚠️ **The `face` branch is not a safety net for fragment hits, and never was.**
   * `FRAGS.RaycastResult` has no `face` field at all, so a fragment hit that arrives without a
   * `normal` falls straight through to `null` — which the caller cannot distinguish from a miss,
   * and reports as nothing at all. Reading this as "there is a fallback" is what made the silent
   * first-plane failure so hard to see; the fix is upstream, in `requireNormal`, which stops such
   * hits being produced. The branch stays because it is genuinely live for the plain-three
   * `items` path (`castRayToObjects` returns a `THREE.Intersection`), even though `world.meshes`
   * is empty in this app today.
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
