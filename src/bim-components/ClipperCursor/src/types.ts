/** One row of the plane list the ToolbarClip dropdown renders. */
export interface ClipperPlaneState {
  id: string;
  name: string;
  enabled: boolean;
}

/** How an outline is drawn for the plane's current interaction state. */
export type PlaneVisualState = "idle" | "selected" | "active";
