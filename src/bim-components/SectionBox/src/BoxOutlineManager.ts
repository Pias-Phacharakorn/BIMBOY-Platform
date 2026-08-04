import * as THREE from "three";

/** Neutral, because a box has faces on all three axes — the arrows carry the axis colours. */
const OUTLINE_COLOR = 0xffffff;
const OUTLINE_OPACITY = 0.65;
/** Just under the gizmos' 999, so an arrow always draws over an edge it crosses. */
const OUTLINE_RENDER_ORDER = 998;

/**
 * The box's twelve edges, as one `LineSegments` drawn in `GizmoAxis`'s overlay pass.
 *
 * **`depthTest: false`, and clipping is why only half the reason.** Coplanar geometry survives
 * three.js clipping (a fragment is discarded at signed distance `< 0`, not `<= 0`), which is
 * why `ClipperCursor`'s own coplanar plane outline renders at all — so the edges would show up
 * in `world.scene` too. What they would *not* survive is depth: every edge borders the very
 * cross-sections its planes cut, so a depth-tested wire z-fights with them and stipples out.
 *
 * ⚠️ **Accepted consequence:** with no depth test all twelve edges show through the model, near
 * and far alike. Correct for a volume boundary, and how Revit and Navisworks draw theirs — the
 * same trade the pivot dot already takes.
 *
 * A unit cube scaled to the box, rather than 24 rewritten vertices: `position`/`scale` is two
 * writes per frame instead of a geometry upload, and `minGap` guarantees no axis is ever 0.
 */
export class BoxOutlineManager {
  readonly object: THREE.LineSegments;

  private readonly _geometry: THREE.BufferGeometry;
  private readonly _material: THREE.LineBasicMaterial;

  constructor() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this._geometry = new THREE.EdgesGeometry(box);
    box.dispose();

    this._material = new THREE.LineBasicMaterial({
      color: OUTLINE_COLOR,
      transparent: true,
      opacity: OUTLINE_OPACITY,
      depthTest: false,
      depthWrite: false,
    });

    this.object = new THREE.LineSegments(this._geometry, this._material);
    this.object.name = "BIMBOY_SectionBoxOutline";
    this.object.renderOrder = OUTLINE_RENDER_ORDER;
    this.object.visible = false;
  }

  update(box: THREE.Box3) {
    const size = box.getSize(new THREE.Vector3());
    this.object.position.copy(box.getCenter(new THREE.Vector3()));
    this.object.scale.set(size.x, size.y, size.z);
    this.object.updateMatrixWorld();
  }

  set visible(state: boolean) {
    this.object.visible = state;
  }

  dispose() {
    this.object.removeFromParent();
    this._geometry.dispose();
    this._material.dispose();
  }
}
