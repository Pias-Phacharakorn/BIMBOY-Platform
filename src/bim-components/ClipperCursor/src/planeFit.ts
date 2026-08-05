import * as THREE from "three";

/**
 * A rectangle in some frame's local X/Y, big enough to cover everything a box contains when
 * seen down that frame's local Z. Local Z is not part of the answer: the rectangle lies *in*
 * the plane.
 */
export interface PlaneFit {
  width: number;
  height: number;
  /** Where the rectangle's middle sits, in the frame's local X/Y. Rarely 0. */
  centerX: number;
  centerY: number;
}

/** Reused across all 8 corners of a call — this runs per plane on every model load. */
const CORNER = new THREE.Vector3();
const TO_LOCAL = new THREE.Matrix4();

/**
 * The tightest rectangle in `frame`'s local X/Y that covers `box`, or `null` when `box` is
 * empty or degenerate.
 *
 * Projecting the **8 corners** rather than transforming the box is what makes this correct for a
 * skewed frame: `Box3.applyMatrix4` re-axis-aligns, growing the result, while the corner shadow
 * is exact for the AABB it is given. For a frame square to the grid the answer reduces to two of
 * the box's own extents — which is precisely a `SectionBox` face, and why a fitted cut plane and
 * a box face come out the same size.
 *
 * ⚠️ **The result is invariant under sliding `frame` along its own local +Z**, which is the only
 * thing dragging a cut plane does. Translating the origin along local Z shifts every corner's
 * local *z* and leaves local x/y untouched, so a drag never needs a refit. That is a property of
 * projecting into the *plane's own* frame; the same code against world axes would not have it.
 *
 * Generic geometry — no OBC, no clipping concepts.
 */
export function fitBoxToFrame(box: THREE.Box3, frame: THREE.Object3D): PlaneFit | null {
  if (box.isEmpty()) return null;

  frame.updateWorldMatrix(true, false);
  TO_LOCAL.copy(frame.matrixWorld).invert();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Bit i of the counter picks min or max on each axis: all 8 corners, no array allocated.
  for (let i = 0; i < 8; i++) {
    CORNER.set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
    ).applyMatrix4(TO_LOCAL);

    if (CORNER.x < minX) minX = CORNER.x;
    if (CORNER.x > maxX) maxX = CORNER.x;
    if (CORNER.y < minY) minY = CORNER.y;
    if (CORNER.y > maxY) maxY = CORNER.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}
