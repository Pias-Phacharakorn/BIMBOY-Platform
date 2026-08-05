import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { colorOf } from "../../GizmoAxis";
import { fitBoxToFrame } from "./planeFit";
import { PlaneVisualState } from "./types";

/**
 * A cut plane renders as a bare rectangle outline — no fill, nothing tinted behind it, and
 * no surface to swallow a click meant for an element. Colour states the plane's orientation —
 * its normal's world axis, or grey when the cut is skewed to the grid — so interaction state
 * has to ride on opacity instead: `LineBasicMaterial.linewidth` is ignored by WebGLRenderer
 * (lines are always 1px), which rules out carrying it in line weight without fat-line geometry.
 *
 * ⚠️ Hue used to be snapped to the *nearest* axis, so a skewed cut was painted as though it were
 * square — and the same snap chose the grabbable arrow, which is how the arrow came to point up
 * to 54.74° away from the cut. Grey is the fix
 * (→ [ADR-0009](../../../../docs/adr/0009-section-plane-gizmo-local-frame.md)).
 */
const OUTLINE_OPACITY: Record<PlaneVisualState, number> = {
  idle: 0.45,
  selected: 0.85,
  active: 1,
};

const SURFACE_OPACITY: Record<PlaneVisualState, number> = {
  idle: 0.1,
  selected: 0.22,
  active: 0.35,
};

/**
 * Outline edge used only while nothing has ever measured — i.e. no model loaded. A square, since
 * with no model there is no footprint to take a shape from.
 */
const FALLBACK_PLANE_SIZE = 10;
/** Collapses the burst of onItemSet events a batch load fires into a single refit. */
const SIZE_REFRESH_DEBOUNCE = 150;

/**
 * `plane.size` is pinned here and the rectangle's dimensions live in the outline's own geometry
 * instead, because **`size` is a single uniform scalar** — `SimplePlane`'s setter does
 * `_planeMesh.scale.set(size, size, size)`, so it cannot express a non-square outline.
 *
 * ⚠️ The in-plane offset written to `outline.position` is in `_planeMesh`'s space, which this
 * value scales. Everything here assumes it stays 1; a different value would silently shrink or
 * stretch both the rectangle and its offset. Nothing in `src/` writes `Clipper.size`, but that
 * setter walks the whole list with no notion of who created an entry, so a future caller could
 * reach in and break this from outside.
 */
const PLANE_MESH_SCALE = 1;

/** Scratch for {@link ClipperOutlineManager.centerOffset}, which runs per drag frame. */
const CENTER_QUATERNION = new THREE.Quaternion();

interface OutlineEntry {
  plane: OBC.SimplePlane;
  outline: THREE.LineLoop;
  outlineMaterial: THREE.LineBasicMaterial;
  surfaceMesh: THREE.Mesh;
  surfaceMaterial: THREE.MeshBasicMaterial;
  /** Keeps the carrier quad from rendering while leaving the outline, its child, visible. */
  hiddenMaterial: THREE.MeshBasicMaterial;
  /** In-plane offset from the helper's origin to the rectangle's middle, in local X/Y. */
  centerX: number;
  centerY: number;
}

/**
 * Owns the cut planes' outlines and their extent. Each outline is a `LineLoop` child of
 * `SimplePlane`'s own quad mesh, which means `plane.helper` orients it for free — and it
 * depth-tests against the model, so geometry in front of a plane covers it as it should.
 *
 * **Each outline is the model's own footprint on that plane**, not a square: the loaded models'
 * bounding box is projected into the plane's frame and the resulting rectangle becomes the
 * outline (→ {@link fitBoxToFrame}). For a cut square to the grid that is exactly the matching
 * `SectionBox` face, which is the point — the two sectioning tools draw the same boundary.
 *
 * Note this is independent of colour. `colorOf` still greys a skewed cut, so a skewed plane gets
 * a tightly fitted **grey** rectangle: shape answers "what does the model cover here?" and colour
 * answers "is this square to the grid?", and those are different questions.
 */
export class ClipperOutlineManager {
  /** Fires when a refit moved or resized outlines, so gizmo anchors can follow. */
  readonly onFitChanged = new OBC.Event<void>();

  private readonly _outlines = new Map<string, OutlineEntry>();
  /** Last known good model extents. Never cleared on a bad read — see {@link _measure}. */
  private _box: THREE.Box3 | null = null;
  private _refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private _scheduleRefresh: (() => void) | null = null;

  constructor(private readonly _components: OBC.Components) {
    this._setupSizeTracking();
  }

  /**
   * Hides the plane's quad and gives it an outline in its axis colour, fitted to the model.
   * Starts idle; the component decides state.
   */
  add(planeId: string, plane: OBC.SimplePlane) {
    if (this._outlines.has(planeId)) return;

    const planeMesh = plane.meshes[0];
    if (!planeMesh) return;

    // It has to be the *material* that is invisible, not planeMesh.visible — hiding the
    // mesh would skip its children and take the outline down with it.
    const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
    plane.planeMaterial = hiddenMaterial;

    // Measured here rather than trusted from load time: a plane is only ever created by a
    // click, so this read is guaranteed to happen after the models finished processing.
    const measured = this._measure();
    if (measured) this._box = measured;

    // autoScale first: the size setter re-runs the camera-relative rescale while it is on.
    plane.autoScale = false;
    plane.size = PLANE_MESH_SCALE;

    const outlineMaterial = new THREE.LineBasicMaterial({
      // Same rule the gizmo's grabbable arrow is built from, applied to the same direction, so
      // the plane and the arrow that moves it cannot end up different colours: the normal's
      // world axis, or grey when it has none.
      color: colorOf(plane.normal),
      transparent: true,
      opacity: OUTLINE_OPACITY.idle,
    });

    const outline = new THREE.LineLoop(new THREE.BufferGeometry(), outlineMaterial);
    planeMesh.add(outline);

    const surfaceMaterial = new THREE.MeshBasicMaterial({
      color: colorOf(plane.normal),
      transparent: true,
      opacity: SURFACE_OPACITY.idle,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const surfaceMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), surfaceMaterial);
    planeMesh.add(surfaceMesh);

    const entry: OutlineEntry = {
      plane,
      outline,
      outlineMaterial,
      surfaceMesh,
      surfaceMaterial,
      hiddenMaterial,
      centerX: 0,
      centerY: 0,
    };
    this._outlines.set(planeId, entry);
    this._applyFit(entry);
  }

  remove(planeId: string) {
    const entry = this._outlines.get(planeId);
    if (!entry) return;

    entry.outline.removeFromParent();
    entry.outline.geometry.dispose();
    entry.outlineMaterial.dispose();
    entry.surfaceMesh.removeFromParent();
    entry.surfaceMesh.geometry.dispose();
    entry.surfaceMaterial.dispose();
    entry.hiddenMaterial.dispose();
    this._outlines.delete(planeId);
  }

  setState(planeId: string, state: PlaneVisualState) {
    const entry = this._outlines.get(planeId);
    if (entry) {
      entry.outlineMaterial.opacity = OUTLINE_OPACITY[state];
      entry.surfaceMaterial.opacity = SURFACE_OPACITY[state];
    }
  }

  /**
   * Returns translucent surface meshes for pickable plane switching in 3D.
   */
  getPickableMeshes(): { mesh: THREE.Mesh; id: string }[] {
    const list: { mesh: THREE.Mesh; id: string }[] = [];
    for (const [id, entry] of this._outlines) {
      if (entry.plane.enabled) {
        list.push({ mesh: entry.surfaceMesh, id });
      }
    }
    return list;
  }

  /**
   * World-space offset from a plane's helper origin to the middle of its outline — what the
   * gizmo anchor has to add so the arrow grows from the centre of the rectangle it moves,
   * rather than from wherever the user happened to click. Zero when the plane is unknown.
   *
   * Purely in-plane, so it is perpendicular to every drag: that is what makes the anchor
   * conversion in `ClipperCursor` exact rather than approximate.
   */
  centerOffset(planeId: string, target: THREE.Vector3) {
    const entry = this._outlines.get(planeId);
    if (!entry) return target.set(0, 0, 0);

    return target
      .set(entry.centerX, entry.centerY, 0)
      .applyQuaternion(entry.plane.helper.getWorldQuaternion(CENTER_QUATERNION));
  }

  /** Recompute on model load/unload, debounced so a batch load refits once. */
  private _setupSizeTracking() {
    const fragments = this._components.get(OBC.FragmentsManager);

    this._scheduleRefresh = () => {
      if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
      this._refreshTimeout = setTimeout(() => {
        this._refreshTimeout = null;
        this._refreshFits();
      }, SIZE_REFRESH_DEBOUNCE);
    };

    fragments.list.onItemSet.add(this._scheduleRefresh);
    fragments.list.onItemDeleted.add(this._scheduleRefresh);
  }

  /**
   * The loaded models' extents, or `null` if there is nothing measurable yet.
   *
   * Null is a real case, not just an empty scene: `BoundingBoxer` unions each `model.box`,
   * and a model is already in `fragments.list` while it is still loading (FRAGS reports this
   * as `isBusy`), so a read triggered by `onItemSet` can legitimately find an empty box.
   * Callers must keep their last known good box rather than fall back — falling back is what
   * used to leave a 10-unit outline sitting inside a 40 m building.
   */
  private _measure(): THREE.Box3 | null {
    const boxer = this._components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();

    if (!box || box.isEmpty()) return null;

    const diagonal = box.min.distanceTo(box.max);
    if (!Number.isFinite(diagonal) || diagonal <= 0) return null;

    return box;
  }

  /** Rebuilds one outline's rectangle from the current box and the plane's own frame. */
  private _applyFit(entry: OutlineEntry) {
    const fit = this._box ? fitBoxToFrame(this._box, entry.plane.helper) : null;

    const width = fit ? fit.width : FALLBACK_PLANE_SIZE;
    const height = fit ? fit.height : FALLBACK_PLANE_SIZE;
    entry.centerX = fit ? fit.centerX : 0;
    entry.centerY = fit ? fit.centerY : 0;

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Built around the origin and positioned by offset, so the same geometry maths works
    // whether or not the model's footprint is centred on where the user clicked.
    entry.outline.geometry.dispose();
    entry.outline.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0),
    ]);
    entry.outline.position.set(entry.centerX, entry.centerY, 0);

    entry.surfaceMesh.geometry.dispose();
    entry.surfaceMesh.geometry = new THREE.PlaneGeometry(width, height);
    entry.surfaceMesh.position.set(entry.centerX, entry.centerY, 0);
  }

  private _refreshFits() {
    const measured = this._measure();
    if (!measured) return;

    this._box = measured;
    for (const [, entry] of this._outlines) {
      entry.plane.autoScale = false;
      entry.plane.size = PLANE_MESH_SCALE;
      this._applyFit(entry);
    }

    this.onFitChanged.trigger();
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
    this.onFitChanged.reset();
  }
}
