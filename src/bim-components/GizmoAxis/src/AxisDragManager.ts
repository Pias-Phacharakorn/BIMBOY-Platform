import * as OBC from "@thatopen/components";
import * as THREE from "three";

export interface AxisDragOptions {
  world: OBC.World;
  viewport: HTMLElement;
  /**
   * Grab handles currently on screen, with the id each belongs to. Supplied by the consumer
   * from its own gizmo handles, so this manager never learns what an id means — a plane to
   * `ClipperCursor`, a box face to `SectionBox`.
   */
  pickTargets: () => { mesh: THREE.Mesh; id: string }[];
  /** True while something else owns the pointer — dragging stays out of the way. */
  isSuspended: () => boolean;
  /** World-space direction this id may slide along. `null` aborts the grab. */
  getAxis: (id: string) => THREE.Vector3 | null;
  /** Where this id sits right now, in world space. `null` aborts the grab. */
  getOrigin: (id: string) => THREE.Vector3 | null;
  /**
   * The dragged position, already projected onto the axis. The consumer applies (and may
   * clamp) it — this manager holds no notion of a limit.
   */
  onDrag: (id: string, position: THREE.Vector3) => void;
  /** Grabbing a handle selects whatever it belongs to. */
  onSelect: (id: string) => void;
}

/** Everything an in-progress drag needs to turn pointer movement into axis movement. */
interface DragSession {
  id: string;
  /** World-space direction the grabbed thing may slide along. */
  axis: THREE.Vector3;
  /** Camera-facing plane containing the axis; the pointer ray is intersected with it. */
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

  /** Drops the hover highlight without waiting for the pointer to move off the handle. */
  clearHover() {
    this._setHovered(null);
  }

  private get _canvas() {
    return this._options.world.renderer?.three?.domElement ?? null;
  }

  private _setupListeners() {
    const canvas = this._canvas;
    if (!canvas) return;

    this._hoverListener = (e) => {
      if (this._options.isSuspended() || this._drag) return;
      this._setHovered(this._pickHandle(e)?.id ?? null);
    };
    canvas.addEventListener("pointermove", this._hoverListener);

    this._downListener = (e) => {
      if (e.target !== canvas) return;
      if (e.button !== 0 || this._options.isSuspended() || this._drag) return;
      if (!this._hoveredId) return;

      const hit = this._pickHandle(e);
      if (!hit || hit.id !== this._hoveredId) return;

      e.preventDefault();
      e.stopPropagation();
      this._begin(hit.id, hit.point, e);
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
   */
  private _pickHandle(e: PointerEvent): { id: string; point: THREE.Vector3 } | null {
    const camera = this._options.world.camera?.three;
    const canvas = this._canvas;
    if (!camera || !canvas) return null;

    const targets = this._options.pickTargets();
    if (targets.length === 0) return null;

    const ndc = this._pointerToNdc(e, canvas);
    if (!ndc) return null;

    this._raycaster.setFromCamera(ndc, camera);
    const owners = new Map(targets.map(({ mesh, id }) => [mesh as THREE.Object3D, id]));

    for (const hit of this._raycaster.intersectObjects(targets.map((t) => t.mesh), false)) {
      const id = owners.get(hit.object);
      if (id) return { id, point: hit.point.clone() };
    }
    return null;
  }

  private _setHovered(id: string | null) {
    if (this._hoveredId === id) return;
    this._hoveredId = id;

    if (!this._options.isSuspended()) {
      this._options.viewport.style.cursor = id ? "grab" : "";
    }
    this.onStateChanged.trigger();
  }

  private _begin(id: string, grabPoint: THREE.Vector3, e: PointerEvent) {
    const camera = this._options.world.camera?.three;
    const rawAxis = this._options.getAxis(id);
    const origin = this._options.getOrigin(id);
    if (!camera || !rawAxis || !origin) return;

    // Slide along the given axis, on the camera-facing plane that contains it.
    const axis = rawAxis.clone().normalize();
    const viewDirection = camera.getWorldDirection(new THREE.Vector3());
    let dragNormal = axis.clone().cross(viewDirection).cross(axis);
    if (dragNormal.lengthSq() < 1e-8) {
      // Looking straight down the axis: any plane containing it works.
      dragNormal = viewDirection.clone().negate();
    }
    dragNormal.normalize();

    this._drag = {
      id,
      axis,
      dragPlane: new THREE.Plane().setFromNormalAndCoplanarPoint(dragNormal, grabPoint),
      startOrigin: origin.clone(),
      startPoint: grabPoint.clone(),
      pointerId: e.pointerId,
    };

    this._options.onSelect(id);

    // Same guard SimplePlane.changeDrag uses for its own arrow drag.
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
