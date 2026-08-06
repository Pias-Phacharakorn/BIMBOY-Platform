import * as THREE from "three";

/**
 * The in-plane offset maths behind a movable cut-plane gizmo, as three pure functions.
 *
 * A plane's gizmo sits at its helper's origin — the point the user clicked — displaced by an
 * **owned** offset that lives in the helper's own local X/Y. These convert that offset between
 * frames, and keep it inside a rectangle.
 *
 * ## ⚠️ Why this is its own module rather than three private methods
 *
 * Extracted for exactly the reason `applyFollowTransform` was, and recorded in
 * [ADR-0009](../../../../docs/adr/0009-section-plane-gizmo-local-frame.md) as a mistake already
 * made once: `ClipperCursor` needs a `Components`, a `World` and a viewport element to construct,
 * so nothing inside it can be reached headlessly. A regression check that re-implemented this
 * arithmetic beside it would **keep passing even if production stopped doing it** — the definition
 * of a test that proves nothing. `scripts/check-gizmo-frames.mjs` Group D imports these, so the
 * assertions land on the code that actually runs.
 *
 * Being pure buys the second half too: {@link localOffsetToWorld} is called from both
 * `_syncAnchor` and the `onDrag` handler, which previously held the same
 * `set(x, y, 0).applyQuaternion(q)` line twice. Two copies of the conversion is how an offset
 * that is exact in one direction and approximate in the other gets shipped.
 *
 * No OBC and no clipping concepts — just a frame and a rectangle.
 */

/** Half-extents and middle of a fitted rectangle in a frame's local X/Y. */
export interface OffsetExtent {
  halfWidth: number;
  halfHeight: number;
  centerX: number;
  centerY: number;
}

/**
 * A local X/Y offset as a **world-space vector**, rotated by `frame`'s world orientation.
 *
 * ⚠️ **The result is always perpendicular to the frame's local +Z**, because local z is passed as
 * `0` and a rotation preserves angles. That is the invariant the whole feature rests on: a cut
 * plane's normal *is* its helper's local +Z, so this offset can never carry the plane along its
 * own normal. It is what lets the `onDrag` handler recover the helper's position by plain
 * subtraction — exactly, for *any* offset, not only the fitted centre a previous version used.
 *
 * Writes into `target` rather than allocating: this runs on every drag frame, per plane.
 */
export function localOffsetToWorld(
  offset: THREE.Vector2,
  frame: THREE.Object3D,
  target: THREE.Vector3,
  frameQuaternion: THREE.Quaternion,
): THREE.Vector3 {
  frame.getWorldQuaternion(frameQuaternion);
  return target.set(offset.x, offset.y, 0).applyQuaternion(frameQuaternion);
}

/**
 * A world-space point as an offset in `frame`'s local X/Y, discarding local z.
 *
 * Dropping z is not a rounding step — an `"inPlane"` drag intersects the pointer ray with the
 * literal cut plane, so the point is already *on* it and its local z is zero to float precision.
 * Taking x and y is a frame change, not a projection.
 *
 * ⚠️ **`frame.worldToLocal` mutates the vector it is given**, so callers must hand over a clone
 * or a scratch vector, never the drag manager's own intersection point.
 */
export function worldPointToLocalOffset(
  worldPoint: THREE.Vector3,
  frame: THREE.Object3D,
  scratch: THREE.Vector3,
  target: THREE.Vector2,
): THREE.Vector2 {
  const local = frame.worldToLocal(scratch.copy(worldPoint));
  return target.set(local.x, local.y);
}

/**
 * Clamps an offset into a fitted rectangle, in place.
 *
 * The one moment this is used is a refit (`ClipperOutlineManager.onFitChanged`), where the
 * footprint has just been recomputed and a stored offset may now sit outside it. Dragging is
 * never clamped — free placement is the feature; this only stops an offset outliving the
 * rectangle it was placed in when a model loads or unloads.
 */
export function clampOffsetToExtent(offset: THREE.Vector2, extent: OffsetExtent): THREE.Vector2 {
  offset.x = THREE.MathUtils.clamp(
    offset.x,
    extent.centerX - extent.halfWidth,
    extent.centerX + extent.halfWidth,
  );
  offset.y = THREE.MathUtils.clamp(
    offset.y,
    extent.centerY - extent.halfHeight,
    extent.centerY + extent.halfHeight,
  );
  return offset;
}
