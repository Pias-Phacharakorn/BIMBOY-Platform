import * as THREE from "three";
import { PlaneAxis } from "./axis";

/**
 * Which shape a gizmo takes.
 *
 * - `"axes"` — three double-headed arrows and a centre diamond, one of them grabbable. The
 *   section-plane form: a cut plane is unbounded, so showing all three world axes says which
 *   way the model is being sliced.
 * - `"arrow"` — a single arrow along `grabAxis`, pointing one way only, no diamond. For a
 *   *bounded* face, where the other two axes would be noise: six of the `"axes"` form on one
 *   box is six diamonds and eighteen arrows, and on a thin box the opposing pickers overlap
 *   through the middle.
 */
export type AxisGizmoForm = "axes" | "arrow";

export interface AxisGizmoOptions {
  /**
   * Object whose world **position** the gizmo tracks each frame. Its rotation is ignored —
   * the gizmo stays world-axis-aligned.
   */
  follow: THREE.Object3D;
  /** The one axis wrapped in a grab cylinder. For `"axes"`, the other two are drawn but inert. */
  grabAxis: PlaneAxis;
  /** Defaults to `"axes"`, which is what the section planes use. */
  form?: AxisGizmoForm;
  /**
   * Which way along `grabAxis` an `"arrow"` points, and the side its picker sits on. Ignored
   * by `"axes"`, which is symmetric. Defaults to `1`.
   */
  direction?: 1 | -1;
}

/**
 * A live gizmo. Callers keep these however they like — there is no shared key namespace, so
 * two tools can never reach each other's gizmos.
 */
export interface AxisGizmoHandle {
  readonly grabAxis: PlaneAxis;
  /**
   * The invisible grab cylinder. Raycast it to detect a grab; it needs no occlusion test,
   * since the gizmo is drawn on top of everything.
   */
  readonly picker: THREE.Mesh;
  visible: boolean;
  /** Turns the grabbable arrow yellow. Set it while the handle is hovered or dragged. */
  highlighted: boolean;
  /** Leaves the overlay scene and frees this gizmo's geometry and materials. */
  dispose(): void;
}
