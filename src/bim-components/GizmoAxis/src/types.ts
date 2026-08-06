import * as THREE from "three";
import { PlaneAxis } from "./axis";

/**
 * Which shape a gizmo takes.
 *
 * - `"plane"` — a long double-headed arrow along the followed transform's **local +Z**, two
 *   short inert arms on its local X and Y, and a centre diamond. The section-plane form: since
 *   the gizmo takes its target's rotation, local +Z *is* the cut normal, so the grabbable arrow
 *   points exactly where the plane cuts and the two short arms lie in the cut surface itself.
 *   Each arm takes the colour of the world axis it points down, or grey where it points down
 *   none — so a square cut reads green/blue/red and a skewed one greys out. See `palette`.
 * - `"arrow"` — a single arrow along `grabAxis`, pointing one way only, no diamond, coloured
 *   from `AXIS_COLORS`. For a *bounded* face, where the other two axes would be noise: six
 *   three-armed gizmos on one box is six diamonds and eighteen arrows, and on a thin box the
 *   opposing pickers overlap through the middle.
 * ⚠️ Was `"axes"` until the section-plane gizmo moved to the plane's own frame. The old name
 * described a world-**axes**-aligned gizmo, which is the one thing this form is no longer.
 *
 * ⚠️ A third `"marker"` form (a small octahedron, select-only) was built and removed: a cut plane
 * switches by clicking its own border band, so the extra icon had nothing left to do. If a
 * select-only handle is ever wanted again, `canDrag` on `AxisDragManager` is the half that stayed.
 */
export type AxisGizmoForm = "plane" | "arrow";

/**
 * Which handle on a `"plane"` gizmo a drag session targets.
 *
 * - `"axis"` — the long arrow, 1-DOF along the followed transform's local +Z (the cut normal).
 *   Moves the thing the gizmo is attached to.
 * - `"inPlane"` — the centre diamond, free 2-DOF inside the local XY plane. Moves only the
 *   gizmo itself; whatever it is attached to does not move.
 *
 * Defaults to `"axis"` wherever it is optional, which is every target `SectionBox` ever
 * supplies — so that class needs no change to keep behaving exactly as it did before this mode
 * existed.
 */
export type AxisDragMode = "axis" | "inPlane";

export interface AxisGizmoOptions {
  /**
   * Object whose world **transform** the gizmo tracks each frame — position *and* rotation, so
   * a gizmo sits in its target's own frame. Scale is ignored; the gizmo holds a fixed fraction
   * of the viewport height instead.
   */
  follow: THREE.Object3D;
  /**
   * The one axis wrapped in a grab cylinder. Required by `"arrow"`; **ignored by `"plane"`**,
   * which always grabs local +Z because that is where `OBC.SimplePlane` puts its normal.
   */
  grabAxis?: PlaneAxis;
  /** Defaults to `"plane"`, which is what the section planes use. */
  form?: AxisGizmoForm;
  /**
   * Which way along `grabAxis` an `"arrow"` points, and the side its picker sits on. Ignored
   * by `"plane"`, which is symmetric. Defaults to `1`.
   */
  direction?: 1 | -1;
  /**
   * Colour per **local** axis, defaulting to `AXIS_COLORS` — already right for `"arrow"`, whose
   * axes *are* world axes.
   *
   * `"plane"` should supply one built with `framePalette(followWorldQuaternion)`: a gizmo drawn
   * in local space cannot know where its rotation aims each axis, so only the caller can decide
   * whether an arm has a world axis to name or should grey out.
   */
  palette?: Record<PlaneAxis, number>;
}

/**
 * A live gizmo. Callers keep these however they like — there is no shared key namespace, so
 * two tools can never reach each other's gizmos.
 */
export interface AxisGizmoHandle {
  /**
   * The invisible grab cylinder. Raycast it to detect a grab; it needs no occlusion test,
   * since the gizmo is drawn on top of everything.
   */
  readonly picker: THREE.Mesh;
  /**
   * The centre diamond's own pick target — `null` on the `"arrow"` form, which has no diamond.
   * Unlike `picker`, this is the mesh that is **drawn**, not an invisible proxy: the diamond
   * quad itself is what a raycast hits, which is what keeps "what you can grab is what you can
   * see" true for it too, the same property `axis-gizmo-mesh.ts` states for the arrow.
   */
  readonly diamond: THREE.Mesh | null;
  visible: boolean;
  /** Turns the grabbable arrow yellow. Set it while the handle is hovered or dragged. */
  highlighted: boolean;
  /**
   * Turns the centre diamond yellow, independent of {@link highlighted} — hovering or dragging
   * the diamond must not light up the arrow you are not about to grab, and vice versa. No-op on
   * the `"arrow"` form, which has no diamond to recolour.
   */
  centreHighlighted: boolean;
  /** Leaves the overlay scene and frees this gizmo's geometry and materials. */
  dispose(): void;
}
