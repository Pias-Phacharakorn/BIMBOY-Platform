import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

/** Diameter of the dot in CSS pixels — screen-constant, since this is a DOM node. */
const DOT_SIZE_PX = 7;

const FADE_IN_MS = 80;
const FADE_OUT_MS = 160;

/** How long the dot lingers after the last gesture activity before fading out. */
const HOLD_MS = 500;

/**
 * The green dot marking what the camera is anchored to — the hovered surface while zooming, the
 * orbit pivot while rotating. Owned and driven by `CursorZoom`.
 *
 * **A `CSS2DObject`, not a mesh.** `OBF.PostproductionRenderer` extends the front package's
 * `RendererWith2D`, which already owns a `three2D: CSS2DRenderer` — the same one that draws
 * `surface-measure-cursor`'s pill labels. So this needs no render pass, no material, and no
 * per-frame rescaling: a DOM element is screen-constant by nature and always composited above the
 * canvas.
 *
 * ⚠️ **No depth test, deliberately.** CSS2D cannot be occluded, so the dot shows *through*
 * geometry. That is right for a pivot indicator — Navisworks does the same, and a pivot hidden
 * behind the wall you are orbiting past would be useless. It does mean the dot must never be read
 * as paint on a surface.
 *
 * ⚠️ **`visible` stays `true` for the marker's whole attached life; opacity is the only switch.**
 * `CSS2DRenderer` sets `element.style.display = 'none'` when `object.visible === false` *and* when
 * the point leaves the frustum, and a `display` flip in the same frame as an `opacity` change kills
 * the CSS transition — the fades would snap. Cost is one matrix + transform per frame for a single
 * element, which the renderer already pays for every measure label.
 */
export class PivotMarker {
  private readonly _element: HTMLDivElement;
  private readonly _object: CSS2DObject;

  // `Object3D`, not `Scene`: `OBC.BaseScene.three` is typed as the former, and any parent works.
  private _scene: THREE.Object3D | null = null;
  private _holdTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this._element = document.createElement("div");
    // The ring is load-bearing, not decoration: flat green loses its edge against a pale ceiling,
    // and a BIM model supplies every possible background tone. The colour comes from the design
    // token, which Tailwind v4's `@theme {}` emits on `:root`, so nothing is hardcoded here.
    this._element.style.cssText = `
      width: ${DOT_SIZE_PX}px;
      height: ${DOT_SIZE_PX}px;
      border-radius: 50%;
      background: var(--color-status-ok);
      border: 1px solid rgba(0, 0, 0, 0.55);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
      opacity: 0;
      pointer-events: none;
    `;

    this._object = new CSS2DObject(this._element);
  }

  attach(scene: THREE.Object3D) {
    if (this._scene === scene) return;
    this.detach();
    this._scene = scene;
    scene.add(this._object);
  }

  detach() {
    this._clearHold();
    if (this._scene) {
      this._scene.remove(this._object);
      this._scene = null;
    }
    // `CSS2DObject` leaves its element in the DOM once its object leaves the scene graph —
    // the same cleanup `surface-measure-cursor._disposeMeasurement` does for its labels.
    this._element.remove();
  }

  /** Moves the dot to a world point, fades it in, and restarts the auto-hide countdown. */
  showAt(point: THREE.Vector3) {
    this._object.position.copy(point);
    this._fadeTo(1, FADE_IN_MS);
    this._restartHold();
  }

  /**
   * Restarts the countdown without moving the dot — for gesture activity that does not change the
   * anchor, such as the ticks after the first in a wheel burst, or a rotate still in progress.
   */
  keepAlive() {
    if (this._element.style.opacity === "0") return;
    this._restartHold();
  }

  /** Starts the fade-out now, skipping the hold. */
  hide() {
    this._clearHold();
    this._fadeTo(0, FADE_OUT_MS);
  }

  private _fadeTo(opacity: number, durationMs: number) {
    // Set the transition with the opacity so fade-in and fade-out can differ in duration.
    this._element.style.transition = `opacity ${durationMs}ms linear`;
    this._element.style.opacity = `${opacity}`;
  }

  private _restartHold() {
    this._clearHold();
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this._fadeTo(0, FADE_OUT_MS);
    }, HOLD_MS);
  }

  private _clearHold() {
    if (this._holdTimer === null) return;
    clearTimeout(this._holdTimer);
    this._holdTimer = null;
  }
}
