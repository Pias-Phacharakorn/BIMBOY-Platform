import * as THREE from "three";

/**
 * The three hues of the axis visual language, declared once so nothing can hold a subtly
 * different blue.
 *
 * Note this **inverts** the three.js/Blender convention, where X is red, Y green and Z blue —
 * deliberately, to match BIMBOY's section colour scheme.
 */
const GIZMO_GREEN = 0x00ff00;
const GIZMO_BLUE = 0x0000ff;
const GIZMO_RED = 0xff0000;

export type PlaneAxis = "x" | "y" | "z";

/**
 * Colour per world axis. Every gizmo arrow, and anything painted to match one (a cut plane's
 * outline), reads this — so the two cannot drift apart.
 *
 * ⚠️ **Vertical is world Y, not Z.** IFC authors Z-up; FRAGS presents the model Y-up. So a
 * plan/level cut wears a **blue** outline rather than a red one, and it is the section box's
 * *top and bottom* faces that are blue — a reader assuming Z-up reads that as broken.
 */
export const AXIS_COLORS: Record<PlaneAxis, number> = {
  x: GIZMO_GREEN,
  y: GIZMO_BLUE,
  z: GIZMO_RED,
};

/**
 * Worn by an arrow — and by a cut plane's outline — whose direction lines up with **no** world
 * axis. Colour states orientation here, so a direction with no axis to name needs its own
 * answer rather than being rounded to the nearest one: rounding is exactly what used to point
 * the grabbable arrow up to 54.74° away from the cut it moved
 * (→ [ADR-0009](../../../../docs/adr/0009-section-plane-gizmo-local-frame.md)).
 *
 * ⚠️ **Light grey, not black.** Achromatic is the point — no hue, no axis — but the viewport
 * background is a dark gradient (`oklch(21%…)` → `oklch(9%…)`, `style.css`) and gizmos render
 * with `depthTest: false` over open sky as often as over geometry, so black would be invisible
 * in exactly the place these gizmos usually float. Grey also keeps clear of the pure-white
 * centre diamond.
 */
export const OFF_AXIS_COLOR = 0xcccccc;

/**
 * How parallel a direction must be to a world axis to be called aligned: `|dot| ≥ this`, i.e.
 * within ~1.15°.
 *
 * Deliberately loose. The two failure modes are not symmetric — too tight and an orthogonal
 * wall whose triangle normals carry float noise reads as off-axis and goes grey, so the *common*
 * case looks broken; too loose and a wall raked by a degree wears an axis colour, which is a lie
 * nobody can see, since a degree is visually square. Float noise in IFC normals is ~1e-6
 * (~0.00006°), so this clears it by four orders of magnitude.
 *
 * Same magnitude as the normal-agreement threshold in `SurfaceMeasureCursor`'s
 * `coplanarFace.ts`, and kept as its own constant rather than imported from it: the two answer
 * different questions ("is this a world axis?" vs "are these the same plane?") and are free to
 * diverge without dragging the other along.
 */
export const AXIS_ALIGNMENT_DOT = 0.9998;

export interface PlaneAxisInfo {
  color: number;
  axis: PlaneAxis;
}

/** The three axes, for iterating without losing the {@link PlaneAxis} type to `Object.keys`. */
export const PLANE_AXES: readonly PlaneAxis[] = ["x", "y", "z"];

/**
 * Unit vector per axis — the one table, read by this file and by `axis-gizmo-mesh.ts`.
 *
 * ⚠️ **Shared instances: clone before mutating.** Three's vector methods mutate in place, so
 * `AXIS_DIRECTIONS.x.multiplyScalar(2)` would corrupt every later reader. Every consumer goes
 * through `.clone()` or `.copy()` into its own target.
 */
export const AXIS_DIRECTIONS: Record<PlaneAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

/**
 * The world axis a direction runs along, or **`null` if it runs along none of them** to within
 * {@link AXIS_ALIGNMENT_DOT}. Sign-insensitive: ±X are both `"x"`.
 *
 * That `null` is the whole point of this function, and the difference from the version ADR-0009
 * deleted. The old one snapped every direction to its nearest axis and so could never say "this
 * one is skewed" — it reported a 44° cut as axis-aligned, which is how the gizmo came to point
 * somewhere the plane did not cut. Callers render `null` as {@link OFF_AXIS_COLOR}.
 *
 * Generic geometry, not a clipping concept.
 */
export function axisOf(direction: THREE.Vector3): PlaneAxisInfo | null {
  const unit = direction.clone().normalize();
  for (const axis of PLANE_AXES) {
    if (Math.abs(unit.dot(AXIS_DIRECTIONS[axis])) >= AXIS_ALIGNMENT_DOT) {
      return { color: AXIS_COLORS[axis], axis };
    }
  }
  return null;
}

/** {@link axisOf}'s colour, falling back to {@link OFF_AXIS_COLOR} for a skewed direction. */
export function colorOf(direction: THREE.Vector3): number {
  return axisOf(direction)?.color ?? OFF_AXIS_COLOR;
}

/**
 * A colour for each **local** axis of a rotated frame, by the world axis that local axis points
 * down — grey where it points down none.
 *
 * What a `"plane"` gizmo is built from. Its group carries the plane's rotation, so its three
 * arms are drawn on local X/Y/Z but *point* wherever that rotation sends them: on an
 * axis-aligned cut all three land on world axes and the gizmo looks exactly as it did before
 * ADR-0009, and on a skewed cut none of them do, so the whole gizmo greys out and says so.
 *
 * Read from the frame rather than from `plane.normal` for all three axes, including the normal
 * itself: the plane's two in-plane directions exist nowhere else, and the ~0.00573° that a
 * degenerate `lookAt` adds to a plan cut's frame is 200× inside {@link AXIS_ALIGNMENT_DOT}.
 */
export function framePalette(frame: THREE.Quaternion): Record<PlaneAxis, number> {
  const palette = {} as Record<PlaneAxis, number>;
  for (const axis of PLANE_AXES) {
    // clone: applyQuaternion mutates, and AXIS_DIRECTIONS is shared.
    palette[axis] = colorOf(AXIS_DIRECTIONS[axis].clone().applyQuaternion(frame));
  }
  return palette;
}

/**
 * Applied to a gizmo's grabbable arrow while it is hovered or being dragged. Pure yellow is
 * the three.js TransformControls convention for "this handle is live", and it collides with
 * nothing above — including {@link OFF_AXIS_COLOR}.
 */
export const HIGHLIGHT_COLOR = 0xffff00;
