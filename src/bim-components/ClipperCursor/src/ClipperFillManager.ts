import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

/**
 * The colour of a cut face.
 *
 * ⚠️ **Deliberately not the tutorial's `"black"`.** A section fill works by making the cut read as
 * solid *against the void* — classic poché is dark on light. This viewer is the other way round:
 * `--color-bg` is `oklch(10.5% 0.012 255)` and `world.scene.three.background` is `null`, so the
 * canvas shows near-black through it. A black fill would land at roughly the void's own lightness
 * and read as a **hole**, which inverts the whole point.
 *
 * Neutral on purpose too: the bands and arrows already carry the axis palette, and a cut face is
 * not making a statement about orientation.
 */
const FILL_COLOR = 0xb8b8b8;

/**
 * Namespaced, because `ClipStyler.styles` is a single shared map with no notion of who registered
 * an entry — the same hazard `Clipper.list` has.
 */
const FILL_STYLE = "BIMBOY_SectionFill";

/**
 * Fills the cross-section a cut plane exposes, so a sliced wall reads as solid material instead of
 * an open shell. One `OBF.ClipEdges` per plane, all sharing one **fill-only** style.
 *
 * Fill-only is what the style omitting `linesMaterial` buys: the vendor generates no lines at all,
 * so nothing here needs `LineMaterial` from `three/examples` or the fat-line machinery behind it.
 * And `items: { All: … }` passes no `data`, which the vendor documents as "all items cut will be
 * styled" — so none of the tutorial's `Classifier`/`ItemsFinder` grouping is required.
 *
 * ## ⚠️ Why the refresh is manual
 *
 * `createFromClipping` links two things to the plane, and **only one of them works here**:
 *
 * - `plane.onDisposed → edges.dispose()` — fires normally. This is why `link` stays on.
 * - `plane.onDraggingEnded → edges.update()` — **can never fire.** It is triggered only by
 *   `SimplePlane`'s own `TransformControls` `"dragging-changed"` event, and those controls are
 *   permanently disabled in this app (`suppressDefaultArrow`, and `plane.visible = false` calling
 *   `toggleControls(false)`) because dragging goes through `AxisDragManager`
 *   (→ [ADR-0002](../../../../docs/adr/0002-section-plane-outline-only.md)).
 *
 * So without {@link noteDragState} a fill would render once at the plane's birth position and stay
 * there while the cut moved away. What makes the fix a one-liner is that `ClipStyler.create()`
 * receives the **live** `THREE.Plane` and the vendor documents that it "won't be copied" — so
 * `update()` always recomputes against the plane's current position.
 *
 * ## Where the fills live
 *
 * `ClipEdges.visible` adds and removes from `world.scene`, so fills **are** depth-tested and **are**
 * clipped by other planes — unlike a plane's band and outline, which sit in `GizmoAxis`'s overlay.
 * That split is intentional: a fill is cut material sitting in the model, while a band is a boundary
 * annotation that must never be hidden by it.
 */
export class ClipperFillManager {
  private readonly _edges = new Map<string, OBF.ClipEdges>();
  /** Previous drag target, so a transition to `null` can be read as "that drag ended". */
  private _prevDraggingId: string | null = null;

  constructor(
    private readonly _components: OBC.Components,
    world: OBC.World,
  ) {
    const styler = this._styler;
    styler.world = world;

    // Registered before any `createFromClipping`, and that order is load-bearing:
    // `ClipEdges.items` carries a guard that silently rejects a style name the styler does not
    // already know, so creating first would leave every plane with an empty item map and no fill.
    if (!styler.styles.get(FILL_STYLE)) {
      styler.styles.set(FILL_STYLE, {
        fillsMaterial: new THREE.MeshBasicMaterial({
          color: FILL_COLOR,
          // A cut is looked at from both sides, and a fill has no meaningful facing.
          side: THREE.DoubleSide,
        }),
      });
    }
  }

  private get _styler() {
    return this._components.get(OBF.ClipStyler);
  }

  /**
   * Gives a plane its fill. Must be called after the plane exists in `Clipper.list` —
   * `createFromClipping` throws otherwise — which `_adoptPlane` guarantees.
   *
   * No initial `update()` is needed: setting the item fires the vendor's own `onItemSet`, which
   * generates the geometry there and then.
   */
  add(planeId: string) {
    if (this._edges.has(planeId)) return;

    const edges = this._styler.createFromClipping(planeId, {
      items: { All: { style: FILL_STYLE } },
    });
    this._edges.set(planeId, edges);
  }

  /** Follows the plane's own enabled state, so a disabled — or arbiter-suspended — cut has no fill. */
  setVisible(planeId: string, visible: boolean) {
    const edges = this._edges.get(planeId);
    if (edges) edges.visible = visible;
  }

  /**
   * Fed the drag manager's current `draggingId` on every state change. A transition from an id to
   * `null` is a finished drag, and the only moment a fill needs rebuilding.
   *
   * Derived rather than signalled: `AxisDragManager` is shared with `SectionBox`, and adding an
   * `onDragEnd` option there would give one consumer a parameter and the other a `undefined` — the
   * same reasoning that made `SectioningArbiter` read existing events instead of adding new ones.
   */
  noteDragState(draggingId: string | null) {
    const ended = this._prevDraggingId;
    this._prevDraggingId = draggingId;
    if (ended !== null && draggingId === null) this._refresh(ended);
  }

  /**
   * Rebuilds every fill. For when the *model* changed rather than the planes — a load adds geometry
   * the existing cuts now pass through, and no plane moved to trigger anything.
   */
  refreshAll() {
    for (const planeId of this._edges.keys()) this._refresh(planeId);
  }

  /** Drops a plane's entry. The vendor's dispose link has already freed the edges themselves. */
  remove(planeId: string) {
    this._edges.delete(planeId);
  }

  dispose() {
    // Normally empty by now: deleting a plane fires `onDisposed`, which both disposes its edges
    // (vendor link) and calls `remove`. Anything still here outlived its plane, so free it.
    for (const [, edges] of this._edges) edges.dispose();
    this._edges.clear();
    this._prevDraggingId = null;
  }

  /**
   * `update()` is async and rebuilds cut geometry against every loaded model, which is why it runs
   * once per gesture rather than per frame. Failures are logged rather than swallowed — there is no
   * caller to hand a rejection to.
   */
  private _refresh(planeId: string) {
    const edges = this._edges.get(planeId);
    if (!edges) return;

    edges.update().catch((error) => {
      console.error(`[ClipperFillManager] Failed to update the fill for ${planeId}:`, error);
    });
  }
}
