import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { DragSession } from "./types";

export interface ClipperDragOptions {
  components: OBC.Components;
  world: OBC.World;
  viewport: HTMLElement;
  /**
   * Grab handles currently on screen, with the plane each belongs to. Supplied by the
   * component from its own gizmo handles, so this manager never needs to know that
   * `GizmoAxis` exists.
   */
  pickTargets: () => { mesh: THREE.Mesh; planeId: string }[];
  /** True while placement mode owns the pointer — dragging stays out of the way. */
  isSuspended: () => boolean;
  /** Grabbing a plane selects it. */
  onSelect: (planeId: string) => void;
}

/**
 * Hover and drag on the gizmo grab handle, which is the only pickable thing this component
 * owns — the outline has no surface to hit, which is precisely why a cut plane can no longer
 * swallow a click meant for an element.
 *
 * `pointerdown` is captured on `window` rather than on the canvas: camera-controls and the
 * highlighter listen on the canvas itself, and a capture listener on the same element would
 * still run after them (target-phase listeners fire in registration order), so the event has
 * to be stopped one level up. Since only the handle is pickable, that stop only ever fires
 * over the handle.
 */
export class ClipperDragManager {
  /** Fires when hover or drag changes, so the owner can repaint outlines. */
  readonly onStateChanged = new OBC.Event<void>();

  private readonly _raycaster = new THREE.Raycaster();
  private _hoveredPlaneId: string | null = null;
  private _drag: DragSession | null = null;

  private _hoverListener: ((e: PointerEvent) => void) | null = null;
  private _downListener: ((e: PointerEvent) => void) | null = null;
  private _moveListener: ((e: PointerEvent) => void) | null = null;
  private _upListener: ((e: PointerEvent) => void) | null = null;

  constructor(private readonly _options: ClipperDragOptions) {
    this._setupListeners();
  }

  get hoveredPlaneId() {
    return this._hoveredPlaneId;
  }

  get draggingPlaneId() {
    return this._drag?.planeId ?? null;
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
      this._setHovered(this._pickHandle(e)?.planeId ?? null);
    };
    canvas.addEventListener("pointermove", this._hoverListener);

    this._downListener = (e) => {
      if (e.target !== canvas) return;
      if (e.button !== 0 || this._options.isSuspended() || this._drag) return;
      if (!this._hoveredPlaneId) return;

      const hit = this._pickHandle(e);
      if (!hit || hit.planeId !== this._hoveredPlaneId) return;

      e.preventDefault();
      e.stopPropagation();
      this._begin(hit.planeId, hit.point, e);
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
  private _pickHandle(e: PointerEvent): { planeId: string; point: THREE.Vector3 } | null {
    const camera = this._options.world.camera?.three;
    const canvas = this._canvas;
    if (!camera || !canvas) return null;

    const targets = this._options.pickTargets();
    if (targets.length === 0) return null;

    const ndc = this._pointerToNdc(e, canvas);
    if (!ndc) return null;

    this._raycaster.setFromCamera(ndc, camera);
    const owners = new Map(targets.map(({ mesh, planeId }) => [mesh as THREE.Object3D, planeId]));

    for (const hit of this._raycaster.intersectObjects(targets.map((t) => t.mesh), false)) {
      const planeId = owners.get(hit.object);
      if (planeId) return { planeId, point: hit.point.clone() };
    }
    return null;
  }

  private _setHovered(planeId: string | null) {
    if (this._hoveredPlaneId === planeId) return;
    this._hoveredPlaneId = planeId;

    if (!this._options.isSuspended()) {
      this._options.viewport.style.cursor = planeId ? "grab" : "";
    }
    this.onStateChanged.trigger();
  }

  private _begin(planeId: string, grabPoint: THREE.Vector3, e: PointerEvent) {
    const plane = this._options.components.get(OBC.Clipper).list.get(planeId);
    const camera = this._options.world.camera?.three;
    if (!plane || !camera) return;

    // Slide along the plane's own normal, on the camera-facing plane that contains it.
    const axis = plane.normal.clone().normalize();
    const viewDirection = camera.getWorldDirection(new THREE.Vector3());
    let dragNormal = axis.clone().cross(viewDirection).cross(axis);
    if (dragNormal.lengthSq() < 1e-8) {
      // Looking straight down the axis: any plane containing it works.
      dragNormal = viewDirection.clone().negate();
    }
    dragNormal.normalize();

    this._drag = {
      planeId,
      axis,
      dragPlane: new THREE.Plane().setFromNormalAndCoplanarPoint(dragNormal, grabPoint),
      startHelperPosition: plane.helper.position.clone(),
      startPoint: grabPoint.clone(),
      pointerId: e.pointerId,
    };

    this._options.onSelect(planeId);

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

    const plane = this._options.components.get(OBC.Clipper).list.get(drag.planeId);
    if (!plane) return;

    const ndc = this._pointerToNdc(e, canvas);
    if (!ndc) return;

    this._raycaster.setFromCamera(ndc, camera);
    const intersection = this._raycaster.ray.intersectPlane(drag.dragPlane, new THREE.Vector3());
    if (!intersection) return;

    // Only the component along the normal moves the cut.
    const offset = intersection.sub(drag.startPoint).dot(drag.axis);
    plane.helper.position.copy(drag.startHelperPosition).addScaledVector(drag.axis, offset);
    plane.helper.updateMatrix();
    plane.update();
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
      this._options.viewport.style.cursor = this._hoveredPlaneId ? "grab" : "";
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
