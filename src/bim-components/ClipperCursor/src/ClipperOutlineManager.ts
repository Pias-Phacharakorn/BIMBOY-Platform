import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { axisOf } from "../../GizmoAxis";
import { PlaneVisualState } from "./types";

/**
 * A cut plane renders as a bare rectangle outline — no fill, nothing tinted behind it, and
 * no surface to swallow a click meant for an element. Colour states the plane's
 * orientation, so interaction state has to ride on opacity instead:
 * `LineBasicMaterial.linewidth` is ignored by WebGLRenderer (lines are always 1px), which
 * rules out carrying it in line weight without fat-line geometry.
 */
const OUTLINE_OPACITY: Record<PlaneVisualState, number> = {
  idle: 0.45,
  selected: 0.85,
  active: 1,
};

/**
 * Outline edge length as a fraction of the loaded models' bounding-box diagonal. The full
 * diagonal clears the footprint from any angle; less than that and a long thin building gets
 * an outline running inside its own plan.
 */
const PLANE_SIZE_RATIO = 1;
/** Outline edge length used only while nothing has ever measured — i.e. no model loaded. */
const FALLBACK_PLANE_SIZE = 10;
/** Collapses the burst of onItemSet events a batch load fires into a single resize. */
const SIZE_REFRESH_DEBOUNCE = 150;

interface OutlineEntry {
  plane: OBC.SimplePlane;
  outline: THREE.LineLoop;
  outlineMaterial: THREE.LineBasicMaterial;
  /** Keeps the carrier quad from rendering while leaving the outline, its child, visible. */
  hiddenMaterial: THREE.MeshBasicMaterial;
}

/**
 * Owns the cut planes' outlines and their extent. Each outline is a `LineLoop` child of
 * `SimplePlane`'s own quad mesh, which means `plane.size` scales it and `plane.helper`
 * orients it for free — and it depth-tests against the model, so geometry in front of a
 * plane covers it as it should.
 */
export class ClipperOutlineManager {
  private readonly _outlines = new Map<string, OutlineEntry>();
  private _planeSize = FALLBACK_PLANE_SIZE;
  private _refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private _scheduleRefresh: (() => void) | null = null;

  constructor(private readonly _components: OBC.Components) {
    this._setupSizeTracking();
  }

  /**
   * Hides the plane's quad and gives it an outline in its axis colour. Starts idle; the
   * component decides state.
   */
  add(planeId: string, plane: OBC.SimplePlane) {
    if (this._outlines.has(planeId)) return;

    const planeMesh = plane.meshes[0];
    if (!planeMesh) return;

    // It has to be the *material* that is invisible, not planeMesh.visible — hiding the
    // mesh would skip its children and take the outline down with it.
    const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
    plane.planeMaterial = hiddenMaterial;

    // Fixed world size from the model bbox, not OBC's camera-relative auto-scale. Measured
    // here rather than trusted from load time: a plane is only ever created by a click, so
    // this read is guaranteed to happen after the models finished processing.
    const measured = this._measure();
    if (measured) this._planeSize = measured;

    plane.autoScale = false;
    plane.size = this._planeSize;

    const outlineMaterial = new THREE.LineBasicMaterial({
      color: axisOf(plane.normal).color,
      transparent: true,
      opacity: OUTLINE_OPACITY.idle,
    });
    // Unit square, matching SimplePlane's PlaneGeometry(1), so plane.size scales it.
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3(0.5, -0.5, 0),
      new THREE.Vector3(0.5, 0.5, 0),
      new THREE.Vector3(-0.5, 0.5, 0),
    ]);
    const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    planeMesh.add(outline);

    this._outlines.set(planeId, { plane, outline, outlineMaterial, hiddenMaterial });
  }

  remove(planeId: string) {
    const entry = this._outlines.get(planeId);
    if (!entry) return;

    entry.outline.removeFromParent();
    entry.outline.geometry.dispose();
    entry.outlineMaterial.dispose();
    entry.hiddenMaterial.dispose();
    this._outlines.delete(planeId);
  }

  setState(planeId: string, state: PlaneVisualState) {
    const entry = this._outlines.get(planeId);
    if (entry) entry.outlineMaterial.opacity = OUTLINE_OPACITY[state];
  }

  /** Recompute on model load/unload, debounced so a batch load resizes once. */
  private _setupSizeTracking() {
    const fragments = this._components.get(OBC.FragmentsManager);

    this._scheduleRefresh = () => {
      if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
      this._refreshTimeout = setTimeout(() => {
        this._refreshTimeout = null;
        this._refreshSizes();
      }, SIZE_REFRESH_DEBOUNCE);
    };

    fragments.list.onItemSet.add(this._scheduleRefresh);
    fragments.list.onItemDeleted.add(this._scheduleRefresh);
  }

  /**
   * Outline edge from the loaded models' bounding-box diagonal, or `null` if there is nothing
   * measurable yet.
   *
   * Null is a real case, not just an empty scene: `BoundingBoxer` unions each `model.box`,
   * and a model is already in `fragments.list` while it is still loading (FRAGS reports this
   * as `isBusy`), so a read triggered by `onItemSet` can legitimately find an empty box.
   * Callers must keep their last known good size rather than fall back — falling back is what
   * used to leave a 10-unit outline sitting inside a 40 m building.
   */
  private _measure(): number | null {
    const boxer = this._components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();

    if (!box || box.isEmpty()) return null;

    const diagonal = box.min.distanceTo(box.max);
    if (!Number.isFinite(diagonal) || diagonal <= 0) return null;

    return diagonal * PLANE_SIZE_RATIO;
  }

  private _refreshSizes() {
    const measured = this._measure();
    if (!measured) return;

    this._planeSize = measured;
    for (const [, entry] of this._outlines) {
      entry.plane.autoScale = false;
      entry.plane.size = measured;
    }
  }

  dispose() {
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
      this._refreshTimeout = null;
    }
    if (this._scheduleRefresh) {
      const fragments = this._components.get(OBC.FragmentsManager);
      fragments.list.onItemSet.remove(this._scheduleRefresh);
      fragments.list.onItemDeleted.remove(this._scheduleRefresh);
      this._scheduleRefresh = null;
    }
    for (const planeId of [...this._outlines.keys()]) {
      this.remove(planeId);
    }
  }
}
