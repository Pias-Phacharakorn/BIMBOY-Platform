import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { colorOf, GizmoAxis } from "../../GizmoAxis";
import { buildPlaneBandGeometry } from "./planeBand";
import { fitBoxToFrame } from "./planeFit";
import { PlaneVisualState } from "./types";

/**
 * The crisp outer edge. Colour states the plane's orientation — its normal's world axis, or grey
 * when the cut is skewed to the grid — so interaction state has to ride on opacity instead:
 * `LineBasicMaterial.linewidth` is ignored by WebGLRenderer (lines are always 1px), which rules
 * out carrying it in line weight without fat-line geometry.
 *
 * ⚠️ Hue used to be snapped to the *nearest* axis, so a skewed cut was painted as though it were
 * square — and the same snap chose the grabbable arrow, which is how the arrow came to point up
 * to 54.74° away from the cut. Grey is the fix
 * (→ [ADR-0009](../../../../docs/adr/0009-section-plane-gizmo-local-frame.md)).
 */
const OUTLINE_OPACITY: Record<PlaneVisualState, number> = {
  idle: 0.05,
  selected: 0.85,
  active: 1,
};

/**
 * The border band. Present on every enabled plane, brightening as it becomes the one you are
 * about to act on — hover included, since `active` covers the band you are pointing at.
 *
 * ⚠️ This is a **band**, never a fill.
 * [ADR-0002](../../../../docs/adr/0002-section-plane-outline-only.md) shipped a full translucent
 * quad and reversed it within a day: "at any usable alpha it tinted the geometry behind it; low
 * enough not to, and it was invisible edge-on anyway." A ring around the perimeter escapes both
 * halves of that — it reads as a surface because it foreshortens, and it tints almost nothing
 * because it covers almost nothing.
 */
const BAND_OPACITY: Record<PlaneVisualState, number> = {
  idle: 0.05,
  selected: 0.15,
  active: 0.35,
};

/**
 * Outer edge used only while nothing has ever measured — i.e. no model loaded. A square, since
 * with no model there is no footprint to take a shape from.
 */
const FALLBACK_PLANE_SIZE = 10;
/** Collapses the burst of onItemSet events a batch load fires into a single refit. */
const SIZE_REFRESH_DEBOUNCE = 150;

/**
 * Below the gizmos' 999 and the section box's 998, so an arrow always draws over a band it
 * crosses, and the outline always draws over its own band.
 */
const OUTLINE_RENDER_ORDER = 997;
const BAND_RENDER_ORDER = 996;

/** Scratch, reused per sync — this runs on every drag frame. */
const SYNC_POSITION = new THREE.Vector3();
const SYNC_QUATERNION = new THREE.Quaternion();

interface OutlineEntry {
  plane: OBC.SimplePlane;
  /** Holds band + outline, and carries the plane's world transform. Lives in the overlay. */
  group: THREE.Group;
  band: THREE.Mesh;
  bandMaterial: THREE.MeshBasicMaterial;
  outline: THREE.LineLoop;
  outlineMaterial: THREE.LineBasicMaterial;
  /** In-plane offset from the helper's origin to the rectangle's middle, in local X/Y. */
  centerX: number;
  centerY: number;
  /**
   * The fitted rectangle's full width/height in the plane's local X/Y — {@link _applyFit}'s own
   * `fit.width`/`fit.height`, kept here rather than staying local to that method because
   * {@link extent} is the first reader outside it.
   */
  width: number;
  height: number;
}

/**
 * Owns how a cut plane looks: a **border band** with an empty interior, and a crisp outline on its
 * outer edge. Both are sized to the model's own footprint on that plane — the loaded models'
 * bounding box projected into the plane's frame (→ {@link fitBoxToFrame}), which for a cut square
 * to the grid is exactly the matching `SectionBox` face.
 *
 * ## Why these live in the overlay pass
 *
 * Each plane gets one `THREE.Group` added through `GizmoAxis.overlay`, **not** parented to
 * `SimplePlane._planeMesh` in `world.scene`. That means `depthTest: false`, exactly as
 * `SectionBox`'s twelve edges already do — so a band draws through the model rather than being
 * occluded by it.
 *
 * That is not a cosmetic choice. The band is also the **click target** for switching plane, and
 * `THREE.Raycaster` ignores material depth state: a depth-tested band hidden behind a wall would
 * still win the click. Drawing without depth makes "what you see" and "what you can hit" the same
 * object, so that mismatch cannot exist — and it keeps the pick synchronous, where consulting
 * `ClipAwareRaycaster` would have forced an `await` that `stopPropagation()` cannot survive.
 *
 * ⚠️ **Two consequences, both accepted.** Bands show through geometry in front of them, and — since
 * the overlay pass suspends clipping — a band is no longer cut by other enabled planes. Both
 * reverse [ADR-0002](../../../../docs/adr/0002-section-plane-outline-only.md), which put the
 * outline in `world.scene` precisely so it *would* depth-test and *would* be clipped.
 *
 * ⚠️ **Overlay objects are not followed automatically** — `GizmoAxis.overlay` deliberately skips
 * its per-frame follow-and-rescale loop so world-scale objects keep their size. So
 * {@link syncTransform} must be called whenever a plane moves.
 *
 * Shape is independent of colour: `colorOf` still greys a skewed cut, so a skewed plane gets a
 * tightly fitted **grey** band. Shape answers "what does the model cover here?", colour answers
 * "is this square to the grid?" — different questions.
 */
export class ClipperOutlineManager {
  /** Fires when a refit moved or resized things, so gizmo anchors can follow. */
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
   * Builds a plane's band and outline in its axis colour, fitted to the model, and puts them in
   * the overlay. Starts idle; the component decides state.
   *
   * `SimplePlane`'s own quad is left entirely alone — nothing here is parented to it, so it needs
   * neither hiding nor sizing. `plane.visible` is the only thing that still touches it.
   */
  add(planeId: string, plane: OBC.SimplePlane) {
    if (this._outlines.has(planeId)) return;

    // Measured here rather than trusted from load time: a plane is only ever created by a
    // click, so this read is guaranteed to happen after the models finished processing.
    const measured = this._measure();
    if (measured) this._box = measured;

    const color = colorOf(plane.normal);

    const outlineMaterial = new THREE.LineBasicMaterial({
      // Same rule the gizmo's grabbable arrow is built from, applied to the same direction, so
      // the plane and the arrow that moves it cannot end up different colours.
      color,
      transparent: true,
      opacity: OUTLINE_OPACITY.idle,
      depthTest: false,
      depthWrite: false,
    });
    const outline = new THREE.LineLoop(new THREE.BufferGeometry(), outlineMaterial);
    outline.renderOrder = OUTLINE_RENDER_ORDER;

    const bandMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: BAND_OPACITY.idle,
      // Visible from either side — a cut is looked at from both.
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const band = new THREE.Mesh(new THREE.BufferGeometry(), bandMaterial);
    band.renderOrder = BAND_RENDER_ORDER;

    const group = new THREE.Group();
    group.name = "BIMBOY_CutPlaneBand";
    group.add(band, outline);

    const entry: OutlineEntry = {
      plane,
      group,
      band,
      bandMaterial,
      outline,
      outlineMaterial,
      centerX: 0,
      centerY: 0,
      width: 0,
      height: 0,
    };
    this._outlines.set(planeId, entry);

    this._applyFit(entry);
    this._components.get(GizmoAxis).overlay.add(group);
    this.syncTransform(planeId);
  }

  remove(planeId: string) {
    const entry = this._outlines.get(planeId);
    if (!entry) return;

    // The overlay only detaches; disposing is ours.
    this._components.get(GizmoAxis).overlay.remove(entry.group);

    entry.outline.geometry.dispose();
    entry.outlineMaterial.dispose();
    entry.band.geometry.dispose();
    entry.bandMaterial.dispose();
    this._outlines.delete(planeId);
  }

  setState(planeId: string, state: PlaneVisualState) {
    const entry = this._outlines.get(planeId);
    if (!entry) return;
    entry.outlineMaterial.opacity = OUTLINE_OPACITY[state];
    entry.bandMaterial.opacity = BAND_OPACITY[state];
  }

  /** Shows or hides a plane's band and outline together. */
  setVisible(planeId: string, visible: boolean) {
    const entry = this._outlines.get(planeId);
    if (entry) entry.group.visible = visible;
  }

  /**
   * The band mesh, for `ClipperCursor` to offer as a pick target. `null` when the plane is unknown
   * or its band is degenerate (a footprint too thin for a ring, so there is nothing to hit).
   *
   * ⚠️ This is the mesh that is **drawn**, not a widened proxy. That is the point: what you can
   * click is exactly what you can see, which is what makes the missing occlusion test correct
   * rather than merely absent.
   */
  bandMesh(planeId: string): THREE.Mesh | null {
    const entry = this._outlines.get(planeId);
    if (!entry) return null;
    return entry.band.geometry.getAttribute("position") ? entry.band : null;
  }

  /**
   * Copies a plane's world transform onto its overlay group. Must run whenever the plane moves —
   * overlay objects are outside `GizmoAxis`'s per-frame follow loop, by design.
   */
  syncTransform(planeId: string) {
    const entry = this._outlines.get(planeId);
    if (!entry) return;

    entry.plane.helper.updateWorldMatrix(true, false);
    entry.group.position.copy(entry.plane.helper.getWorldPosition(SYNC_POSITION));
    entry.group.quaternion.copy(entry.plane.helper.getWorldQuaternion(SYNC_QUATERNION));
    entry.group.updateMatrixWorld();
  }

  /**
   * The fitted rectangle's current half-extents and middle, in the plane's own local X/Y.
   * `null` when the plane is unknown.
   *
   * The one reader is `ClipperCursor`'s refit clamp (decision 11): `onFitChanged` recomputes
   * this rectangle on every model load/unload, and that is the one moment a gizmo's owned offset
   * gets clamped back into it — the drag itself stays completely free. Half-extents rather than
   * corners, because clamping an (x, y) offset only needs the box bounds around `centerX`/
   * `centerY`, which already carry the rectangle's middle.
   */
  extent(planeId: string): { halfWidth: number; halfHeight: number; centerX: number; centerY: number } | null {
    const entry = this._outlines.get(planeId);
    if (!entry) return null;

    return {
      halfWidth: entry.width / 2,
      halfHeight: entry.height / 2,
      centerX: entry.centerX,
      centerY: entry.centerY,
    };
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

  /** Rebuilds one plane's band and outline from the current box and the plane's own frame. */
  private _applyFit(entry: OutlineEntry) {
    const fit = this._box ? fitBoxToFrame(this._box, entry.plane.helper) : null;

    const width = fit ? fit.width : FALLBACK_PLANE_SIZE;
    const height = fit ? fit.height : FALLBACK_PLANE_SIZE;
    entry.centerX = fit ? fit.centerX : 0;
    entry.centerY = fit ? fit.centerY : 0;
    entry.width = width;
    entry.height = height;

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Both are built around the origin and positioned by offset, so the geometry maths is the
    // same whether or not the footprint is centred on where the user clicked.
    entry.outline.geometry.dispose();
    entry.outline.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0),
    ]);
    entry.outline.position.set(entry.centerX, entry.centerY, 0);

    entry.band.geometry.dispose();
    // Null on a footprint too thin to hold a ring. An empty geometry draws nothing and, because
    // `bandMesh` reports it as absent, offers nothing to click — the outline still shows.
    entry.band.geometry = buildPlaneBandGeometry(width, height) ?? new THREE.BufferGeometry();
    entry.band.position.set(entry.centerX, entry.centerY, 0);
  }

  private _refreshFits() {
    const measured = this._measure();
    if (!measured) return;

    this._box = measured;
    for (const [planeId, entry] of this._outlines) {
      this._applyFit(entry);
      this.syncTransform(planeId);
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
