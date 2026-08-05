import * as THREE from "three";

/**
 * Puts a gizmo group into its follow target's frame: the target's world **position** and world
 * **rotation**, and nothing else.
 *
 * Extracted from `GizmoAxis`'s per-frame loop so it can be asserted directly. The loop itself
 * lives in a closure on `renderer.onAfterUpdate` and needs a `World` and a WebGL context to
 * run, so a check that re-implemented this arithmetic would keep passing even if the loop
 * stopped calling it — the definition of a test that proves nothing. Callers and
 * `scripts/check-gizmo-frames.mjs` go through this one function instead.
 *
 * **Scale is deliberately not copied.** A gizmo holds a fixed fraction of the viewport height
 * instead, which is what keeps it the same size on screen at any zoom; the caller sets that
 * separately. This matters for cut planes specifically — `plane.size` scales a `SimplePlane`
 * (on `_planeMesh`, not the helper), and a gizmo must not inherit a model-sized scale.
 *
 * Position and rotation come from one `decompose`, which is both scale-safe — reading a rotation
 * straight off a scaled matrix skews it — and a single pass: `getWorldQuaternion` would re-run
 * `updateWorldMatrix` internally, walking the parent chain a second time every frame per gizmo.
 */
const DISCARDED_SCALE = new THREE.Vector3();

export function applyFollowTransform(group: THREE.Object3D, follow: THREE.Object3D) {
  follow.updateWorldMatrix(true, false);
  follow.matrixWorld.decompose(group.position, group.quaternion, DISCARDED_SCALE);
}
