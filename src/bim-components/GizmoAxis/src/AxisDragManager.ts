import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { AxisDragMode } from "./types";

export interface AxisDragOptions {
  world: OBC.World;
  viewport: HTMLElement;
  /**
   * Grab handles currently on screen, with the id each belongs to and which drag behaviour
   * grabbing it starts. Supplied by the consumer from its own gizmo handles, so this manager
   * never learns what an id means — a plane to `ClipperCursor`, a box face to `SectionBox`.
   *
   * `mode` defaults to `"axis"` when omitted — every target `SectionBox` supplies — so that
   * class needs no change to keep behaving exactly as it did before `"inPlane"` existed.
   */
  pickTargets: () => { mesh: THREE.Mesh; id: string; mode?: AxisDragMode }[];
  /** True while something else owns the pointer — dragging stays out of the way. */
  isSuspended: () => boolean;
  /**
   * Whether grabbing this id may actually move it. Defaults to `true` when omitted, which is
   * what `SectionBox` wants — every box face is always draggable.
   *
   * `false` makes the handle **select-only**: {@link AxisDragOptions.onSelect} fires and no drag
   * session starts. That is a distinct outcome from returning `null` out of `getAxis`/`getOrigin`,
   * which aborts the grab *without* selecting, because those are read before `onSelect` runs.
   */
  canDrag?: (id: string) => boolean;
  /**
   * World-space direction this id may slide along. `null` aborts the grab. Read for both modes:
   * an `"inPlane"` session also needs it, as the normal of the literal cut plane it drags in.
   */
  getAxis: (id: string) => THREE.Vector3 | null;
  /** Where this id sits right now, in world space. `null` aborts the grab. Read for both modes. */
  getOrigin: (id: string) => THREE.Vector3 | null;
  /**
   * The dragged position for an `"axis"` session, already projected onto the axis. The consumer
   * applies (and may clamp) it — this manager holds no notion of a limit. Never called for an
   * `"inPlane"` session; see {@link onInPlaneDrag}.
   */
  onDrag: (id: string, position: THREE.Vector3) => void;
  /**
   * The dragged position for an `"inPlane"` session — the raw pointer/plane intersection, with
   * no axis projection, since the whole point of this mode is free 2-DOF movement inside the
   * drag plane rather than 1-DOF along an axis. Optional: a consumer that never marks a target
   * `"inPlane"` (every target `SectionBox` supplies) never needs it.
   */
  onInPlaneDrag?: (id: string, position: THREE.Vector3) => void;
  /** Grabbing a handle selects whatever it belongs to. */
  onSelect: (id: string) => void;
}

/** Everything an in-progress drag needs to turn pointer movement into motion. */
interface DragSession {
  id: string;
  mode: AxisDragMode;
  /**
   * World-space direction the grabbed thing may slide along (`"axis"`), or the cut normal the
   * literal drag plane is built from (`"inPlane"`).
   */
  axis: THREE.Vector3;
  /**
   * `"axis"`: the camera-facing plane containing the axis. `"inPlane"`: the literal cut plane
   * itself (`normal = axis`, through `startOrigin`) — see {@link AxisDragManager._begin}. Either
   * way, the pointer ray is intersected with it.
   */
  dragPlane: THREE.Plane;
  startOrigin: THREE.Vector3;
  startPoint: THREE.Vector3;
  pointerId: number;
}

/**
 * Hover and drag along one world axis, grabbing a {@link GizmoAxis} picker — the only pickable
 * thing its consumers own. Neither a cut plane's outline nor a section box's edges have a
 * surface to hit, which is precisely why they cannot swallow a click meant for an element.
 *
 * `pointerdown` is captured on `window` rather than on the canvas: camera-controls and the
 * highlighter listen on the canvas itself, and a capture listener on the same element would
 * still run after them (target-phase listeners fire in registration order), so the event has
 * to be stopped one level up. Since only the handle is pickable, that stop only ever fires
 * over the handle.
 *
 * It knows nothing about clipping. `getAxis`/`getOrigin`/`onDrag` are the whole contract, so
 * the same pointer handling drives a `SimplePlane`'s helper and a section-box face alike.
 */
export class AxisDragManager {
  /** Fires when hover or drag changes, so the owner can repaint. */
  readonly onStateChanged = new OBC.Event<void>();

  private readonly _raycaster = new THREE.Raycaster();
  private _hoveredId: string | null = null;
  private _hoveredMode: AxisDragMode | null = null;
  private _drag: DragSession | null = null;

  private _hoverListener: ((e: PointerEvent) => void) | null = null;
  private _downListener: ((e: PointerEvent) => void) | null = null;
  private _moveListener: ((e: PointerEvent) => void) | null = null;
  private _upListener: ((e: PointerEvent) => void) | null = null;

  constructor(private readonly _options: AxisDragOptions) {
    this._setupListeners();
  }

  get hoveredId() {
    return this._hoveredId;
  }

  get draggingId() {
    return this._drag?.id ?? null;
  }

  /**
   * Which handle is hovered — `"axis"` for the arrow, `"inPlane"` for the centre diamond — so a
   * consumer can highlight only the one about to be grabbed instead of lighting up both.
   * `null` whenever {@link hoveredId} is `null`.
   */
  get hoveredMode() {
    return this._hoveredMode;
  }

  /** Same as {@link hoveredMode}, for the drag in progress rather than the hover. `null` when idle. */
  get draggingMode() {
    return this._drag?.mode ?? null;
  }

  /** Drops the hover highlight without waiting for the pointer to move off the handle. */
  clearHover() {
    this._setHovered(null, null);
  }

  private get _canvas() {
    return this._options.world.renderer?.three?.domElement ?? null;
  }

  private _setupListeners() {
    const canvas = this._canvas;
    if (!canvas) return;

    this._hoverListener = (e) => {
      if (this._options.isSuspended() || this._drag) return;
      const hit = this._pickHandle(e);
      this._setHovered(hit?.id ?? null, hit?.mode ?? null);
    };
    canvas.addEventListener("pointermove", this._hoverListener);

    this._downListener = (e) => {
      if (e.target !== canvas) return;
      if (e.button !== 0 || this._options.isSuspended() || this._drag) return;
      if (!this._hoveredId) return;

      const hit = this._pickHandle(e);
      if (!hit || hit.id !== this._hoveredId) return;

      // ⚠️ Suppressed for a select-only hit as well as for a grab, which is deliberate and was
      // once a bug. Feeding *model-sized* plane quads in here made this line eat pointerdown
      // across most of the viewport, killing camera orbit and element selection. The handler was
      // not the problem — the target was. Everything reachable through `pickTargets` is now a
      // thin, deliberate handle (a gizmo picker, a plane's border band, or the centre diamond),
      // so consuming the click costs only that handle's own area and buys a clean outcome:
      // selecting a plane changes the selection and nothing else. Widen a pick target and this
      // becomes a bug again.
      e.preventDefault();
      e.stopPropagation();

      if (this._options.canDrag && !this._options.canDrag(hit.id)) {
        this._options.onSelect(hit.id);
        return;
      }

      this._begin(hit.id, hit.mode, hit.point, e);
    };
    window.addEventListener("pointerdown", this._downListener, true);

    this._moveListener = (e) => {
      if (!this._drag || e.pointerId !== this._drag.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      this._update(e);
    };
    window.addEventListener("pointermove", this._moveListener, true);

    this._upListener = (e) => {
      if (!this._drag || e.pointerId !== this._drag.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      this.end();
    };
    window.addEventListener("pointerup", this._upListener, true);
    window.addEventListener("pointercancel", this._upListener, true);
  }

  /** Pointer position in normalised device coordinates, or null if the canvas has no size. */
  private _pointerToNdc(e: PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  /**
   * No occlusion test is needed: the gizmo scene renders with clipping suspended and
   * `depthTest: false`, so the handle is grabbable wherever it is drawn, even when the model
   * stands between it and the camera.
   *
   * ⚠️ **Every pick target must be a thin, deliberate handle — never a surface spanning the
   * model.** This is the one invariant this class depends on and cannot check. `_setupListeners`
   * consumes pointerdown over any hovered target, so a model-sized target eats orbit and element
   * selection across most of the viewport — which is exactly what happened when a section plane's
   * full translucent quad was briefly pickable. A gizmo picker qualifies; so does a plane's thin
   * border band. A quad, a fill, or anything covering the footprint does not.
   *
   * Select-only is expressed by {@link AxisDragOptions.canDrag}, not by a second target list.
   *
   * ⚠️ **A second assumption this class depends on and cannot verify: the `"inPlane"` override
   * below is scoped per id, never global.** An id's `"inPlane"` hit preempts *that same id's*
   * `"axis"` hit; results then merge back into one nearest-hit ordering across ids. A global
   * override — every `"inPlane"` hit beating every `"axis"` hit, regardless of id — is correct
   * today only by accident: `ClipperCursor._syncVisibility` sets `gizmo.visible = enabled &&
   * isSelected` and `pickTargets` filters on it, so exactly one gizmo is ever pickable and there
   * is no second diamond around to out-rank a nearer plane's arrow. Land multi-select, or the
   * rotation mode ADR-0009 deferred, and a farther plane's diamond would silently steal a click
   * from a nearer plane's arrow — with no compile error and nothing in `check:gizmo` to catch it.
   */
  private _pickHandle(e: PointerEvent): { id: string; mode: AxisDragMode; point: THREE.Vector3 } | null {
    const camera = this._options.world.camera?.three;
    const canvas = this._canvas;
    if (!camera || !canvas) return null;

    const targets = this._options.pickTargets();
    if (targets.length === 0) return null;

    const ndc = this._pointerToNdc(e, canvas);
    if (!ndc) return null;

    this._raycaster.setFromCamera(ndc, camera);
    const owners = new Map(
      targets.map(({ mesh, id, mode }) => [mesh as THREE.Object3D, { id, mode: mode ?? "axis" }]),
    );

    // intersectObjects returns every hit sorted nearest-first across all targets. The per-id
    // override has to run before distance decides anything, or a nearer axis hit for one id
    // would beat a farther inPlane hit for the same id — exactly backwards, since the diamond is
    // drawn entirely inside the arrow's own grab cylinder and so is never the nearer of the two.
    const byId = new Map<string, { mode: AxisDragMode; point: THREE.Vector3; distance: number }>();
    for (const hit of this._raycaster.intersectObjects(targets.map((t) => t.mesh), false)) {
      const owner = owners.get(hit.object);
      if (!owner) continue;

      const existing = byId.get(owner.id);
      if (!existing || (owner.mode === "inPlane" && existing.mode === "axis")) {
        byId.set(owner.id, { mode: owner.mode, point: hit.point.clone(), distance: hit.distance });
      }
    }

    // Now that each id has at most one candidate, the nearest surviving one wins across ids —
    // the same nearest-hit rule as before this override existed.
    let best: { id: string; mode: AxisDragMode; point: THREE.Vector3 } | null = null;
    let bestDistance = Infinity;
    for (const [id, candidate] of byId) {
      if (candidate.distance < bestDistance) {
        bestDistance = candidate.distance;
        best = { id, mode: candidate.mode, point: candidate.point };
      }
    }
    return best;
  }

  private _setHovered(id: string | null, mode: AxisDragMode | null) {
    if (this._hoveredId === id && this._hoveredMode === mode) return;
    this._hoveredId = id;
    this._hoveredMode = id ? mode : null;

    if (!this._options.isSuspended()) {
      this._options.viewport.style.cursor = id ? "grab" : "";
    }
    this.onStateChanged.trigger();
  }

  private _begin(id: string, mode: AxisDragMode, grabPoint: THREE.Vector3, e: PointerEvent) {
    const camera = this._options.world.camera?.three;
    const rawAxis = this._options.getAxis(id);
    const origin = this._options.getOrigin(id);
    if (!camera || !rawAxis || !origin) return;

    const axis = rawAxis.clone().normalize();

    // Two genuinely different drag planes, not one shared shape: "axis" needs a plane that
    // merely *contains* the axis, chosen to face the camera so a shallow viewing angle never
    // degenerates the ray-plane intersection. "inPlane" needs the plane itself — normal = axis,
    // through the gizmo's current position — because free 2-DOF movement only makes sense
    // measured against the literal cut, not some camera-facing stand-in.
    let dragPlane: THREE.Plane;
    if (mode === "inPlane") {
      dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(axis, origin);
    } else {
      const viewDirection = camera.getWorldDirection(new THREE.Vector3());
      let dragNormal = axis.clone().cross(viewDirection).cross(axis);
      if (dragNormal.lengthSq() < 1e-8) {
        // Looking straight down the axis: any plane containing it works.
        dragNormal = viewDirection.clone().negate();
      }
      dragNormal.normalize();
      dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(dragNormal, grabPoint);
    }

    this._drag = {
      id,
      mode,
      axis,
      dragPlane,
      startOrigin: origin.clone(),
      startPoint: grabPoint.clone(),
      pointerId: e.pointerId,
    };

    this._options.onSelect(id);

    // Same guard SimplePlane.changeDrag uses for its own arrow drag. Also what makes decision 5's
    // "no edge-on guard needed" true for the diamond: the camera cannot rotate mid-session, so a
    // grab-time condition holds for the whole drag.
    this._options.world.camera.enabled = false;
    this._options.viewport.style.cursor = "grabbing";
    this._canvas?.setPointerCapture?.(e.pointerId);

    this.onStateChanged.trigger();
  }

  private _update(e: PointerEvent) {
    const drag = this._drag;
    const camera = this._options.world.camera?.three;
    const canvas = this._canvas;
    if (!drag || !camera || !canvas) return;

    const ndc = this._pointerToNdc(e, canvas);
    if (!ndc) return;

    this._raycaster.setFromCamera(ndc, camera);
    const intersection = this._raycaster.ray.intersectPlane(drag.dragPlane, new THREE.Vector3());
    if (!intersection) return;

    if (drag.mode === "inPlane") {
      // No axis projection — the raw intersection is the whole point of free 2-DOF movement.
      // The consumer converts it into whatever local frame it owns.
      this._options.onInPlaneDrag?.(drag.id, intersection);
      return;
    }

    // Only the component along the axis moves anything.
    const offset = intersection.sub(drag.startPoint).dot(drag.axis);
    const position = drag.startOrigin.clone().addScaledVector(drag.axis, offset);
    this._options.onDrag(drag.id, position);
  }

  /** Ends any drag in progress and hands the camera back. Safe to call when idle. */
  end() {
    const drag = this._drag;
    this._drag = null;

    if (drag) {
      const canvas = this._canvas;
      if (canvas?.hasPointerCapture?.(drag.pointerId)) {
        canvas.releasePointerCapture(drag.pointerId);
      }
    }

    try {
      this._options.world.camera.enabled = true;
    } catch {
      // World torn down mid-drag; nothing left to re-enable.
    }

    if (!this._options.isSuspended()) {
      this._options.viewport.style.cursor = this._hoveredId ? "grab" : "";
    }
    if (drag) this.onStateChanged.trigger();
  }

  dispose() {
    this.end();

    const canvas = this._canvas;
    if (canvas && this._hoverListener) {
      canvas.removeEventListener("pointermove", this._hoverListener);
    }
    this._hoverListener = null;

    if (this._downListener) {
      window.removeEventListener("pointerdown", this._downListener, true);
      this._downListener = null;
    }
    if (this._moveListener) {
      window.removeEventListener("pointermove", this._moveListener, true);
      this._moveListener = null;
    }
    if (this._upListener) {
      window.removeEventListener("pointerup", this._upListener, true);
      window.removeEventListener("pointercancel", this._upListener, true);
      this._upListener = null;
    }

    this.onStateChanged.reset();
  }
}
