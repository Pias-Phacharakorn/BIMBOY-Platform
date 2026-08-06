/** One row of the plane list the ToolbarClip dropdown renders. */
export interface ClipperPlaneState {
  id: string;
  name: string;
  enabled: boolean;
  /**
   * True once this plane's gizmo has been dragged off the click point it spawned at — i.e. the
   * centre diamond has moved it at least once this session. Drives the FOCUS button's disabled
   * state in `ToolbarClip`: nothing to recentre until this is true.
   *
   * A boolean, not the offset itself: this type is a dropdown row, and the offset is drag state
   * with nowhere else to live yet — see `ClipperCursor._gizmoOffsets`.
   *
   * ⚠️ Set from a dirty bit inside `ClipperCursor._onInPlaneDrag`, never from the
   * `draggingId → null` transition alone. That transition also fires on a press-and-release
   * with zero movement, where `_onInPlaneDrag` never runs — reading it directly would light the
   * FOCUS button up for a plane sitting exactly where it started.
   */
  gizmoMoved: boolean;
}

/** How an outline is drawn for the plane's current interaction state. */
export type PlaneVisualState = "idle" | "selected" | "active";
