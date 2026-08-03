import * as THREE from "three";
import { PlaneAxis } from "./axis";

export interface AxisGizmoOptions {
  /**
   * Object whose world **position** the gizmo tracks each frame. Its rotation is ignored —
   * the gizmo stays world-axis-aligned.
   */
  follow: THREE.Object3D;
  /** The one axis wrapped in a grab cylinder. The other two are drawn but inert. */
  grabAxis: PlaneAxis;
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
