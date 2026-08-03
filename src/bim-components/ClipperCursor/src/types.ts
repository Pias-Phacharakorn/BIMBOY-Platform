import * as THREE from "three";

/** One row of the plane list the ToolbarClip dropdown renders. */
export interface ClipperPlaneState {
  id: string;
  name: string;
  enabled: boolean;
}

/** How an outline is drawn for the plane's current interaction state. */
export type PlaneVisualState = "idle" | "selected" | "active";

/** Everything an in-progress drag needs to turn pointer movement into plane movement. */
export interface DragSession {
  planeId: string;
  /** World-space direction the plane may slide along (its own normal). */
  axis: THREE.Vector3;
  /** Camera-facing plane containing the axis; the pointer ray is intersected with it. */
  dragPlane: THREE.Plane;
  startHelperPosition: THREE.Vector3;
  startPoint: THREE.Vector3;
  pointerId: number;
}
