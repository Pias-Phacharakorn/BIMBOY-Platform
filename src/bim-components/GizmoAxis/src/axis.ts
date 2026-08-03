import * as THREE from "three";

/**
 * Colour per world axis. Note this **inverts** the three.js/Blender convention, where X is
 * red, Y green and Z blue — deliberately, to match BIMBOY's section-plane colour scheme.
 *
 * This is the single table for the whole axis visual language: gizmo arrows and anything a
 * consumer paints to match them (the clipper's outlines, for one) both read it, so the two
 * cannot drift apart.
 */
export const AXIS_COLORS = {
  x: 0x00ff00, // green
  y: 0x0000ff, // blue — vertical, so this is what a floor/level slice wears
  z: 0xff0000, // red
};

/**
 * Applied to a gizmo's grabbable arrow while it is hovered or being dragged. Pure yellow is
 * the three.js TransformControls convention for "this handle is live", and it collides with
 * nothing in {@link AXIS_COLORS}.
 */
export const HIGHLIGHT_COLOR = 0xffff00;

export type PlaneAxis = "x" | "y" | "z";

export interface PlaneAxisInfo {
  color: number;
  axis: PlaneAxis;
}

/**
 * The world axis a direction points down, and that axis' colour. Ties fall to X, then Y.
 *
 * Generic geometry, not a clipping concept: a caller uses it to pick which arrow of a gizmo
 * is meaningful, and to colour anything that should agree with that arrow.
 */
export function axisOf(direction: THREE.Vector3): PlaneAxisInfo {
  const absX = Math.abs(direction.x);
  const absY = Math.abs(direction.y);
  const absZ = Math.abs(direction.z);
  const maxVal = Math.max(absX, absY, absZ);

  if (maxVal === absX) return { color: AXIS_COLORS.x, axis: "x" };
  if (maxVal === absY) return { color: AXIS_COLORS.y, axis: "y" };
  return { color: AXIS_COLORS.z, axis: "z" };
}
