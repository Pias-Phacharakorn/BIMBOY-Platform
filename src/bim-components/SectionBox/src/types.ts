import { PlaneAxis } from "../../GizmoAxis";

/** The six faces, named after the box bound each one carries. */
export type BoxFaceId = "x-min" | "x-max" | "y-min" | "y-max" | "z-min" | "z-max";

export interface BoxFace {
  id: BoxFaceId;
  axis: PlaneAxis;
  /**
   * Which way this face points **out** of the box: `-1` for a `min` face, `+1` for a `max`
   * one. The clipping plane's normal is the opposite, since the kept half-space is the inside.
   */
  outward: 1 | -1;
}

/**
 * Fixed order, and the single place the six faces are enumerated — planes, gizmos and the
 * menu's extent rows all walk this, so none of them can disagree about what exists.
 */
export const BOX_FACES: readonly BoxFace[] = [
  { id: "x-min", axis: "x", outward: -1 },
  { id: "x-max", axis: "x", outward: 1 },
  { id: "y-min", axis: "y", outward: -1 },
  { id: "y-max", axis: "y", outward: 1 },
  { id: "z-min", axis: "z", outward: -1 },
  { id: "z-max", axis: "z", outward: 1 },
];

/** Flat, React-friendly snapshot of the box. `null` extents mean no box has been built yet. */
export interface SectionBoxState {
  active: boolean;
  min: { x: number; y: number; z: number } | null;
  max: { x: number; y: number; z: number } | null;
}
