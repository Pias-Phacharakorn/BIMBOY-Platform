import * as OBC from "@thatopen/components";

/**
 * How immediately the camera answers the mouse.
 *
 * `camera-controls` damps every motion toward its target with a smooth-damp, and OBC's
 * `SimpleCamera.newCameraControls` leaves the library defaults in place — `smoothTime = 0.2` for
 * animated moves and `draggingSmoothTime = 0.125` while a drag is in progress. Both are slower
 * than they need to be for a BIM viewport, and the dragging one is what makes an orbit feel like
 * it is catching up with the cursor rather than following it.
 *
 * These values were read out of https://viewer.crais.io — a three.js + `camera-controls` viewer
 * (no `@thatopen`) whose navigation the developer wanted to match. Its shared base config is
 * `smoothTime: 0.15`, `draggingSmoothTime: 0.05`, `dollyToCursor: true`, and its orbit preset
 * uses `dollySpeed: 0.5`. `dollyToCursor` is already `true` here via the OBC default.
 *
 * ⚠️ **Not ported from that viewer: `infinityDolly: true` with `minDistance: 1`.** That is what
 * lets its camera dolly forever by pushing the target ahead of itself, and it is the exact flag
 * `CursorZoom` turns *off* on purpose — with `infinityDolly` on, `minDistance` is dead config and
 * cursor-bounded navigation cannot exist (ADR-0004, and the bug history in ADR-0006). Matching
 * that half of the feel is a decision to reverse those, not a value to copy.
 */
export const CAMERA_SMOOTH_TIME = 0.15;

/** Damping while a drag is live. The single biggest "does it track my mouse" dial. */
export const CAMERA_DRAGGING_SMOOTH_TIME = 0.05;

/**
 * Wheel stride multiplier. Halved from the library's `1`, which overshoots on building-scale
 * models: `_dollyInternal` is multiplicative (`radius × 0.95^-delta`), so this scales the whole
 * curve rather than adding a fixed step.
 */
export const CAMERA_DOLLY_SPEED = 0.5;

/**
 * Applies the response tuning to a camera's `CameraControls`.
 *
 * ⚠️ **Must be re-applied per camera instance, not once at bootstrap** — the same trap
 * {@link applyCameraDepthRange} documents: every `OBC.View` constructs its own
 * `OrthoPerspectiveCamera` with its own fresh `CameraControls`, and `OBC.Views.open()` assigns it
 * to `world.camera`. Hence the `world.onCameraChanged` subscription in `create-world.ts`.
 *
 * Idempotent, so re-running it on every camera change is free.
 */
export const applyCameraResponse = (camera: OBC.BaseCamera) => {
  // `controls` lives on `SimpleCamera`, not `BaseCamera`; picking just that field mirrors
  // `applyCameraDepthRange` and avoids asserting a class this may not be.
  const { controls } = camera as Partial<Pick<OBC.SimpleCamera, "controls">>;
  if (!controls) return;

  controls.smoothTime = CAMERA_SMOOTH_TIME;
  controls.draggingSmoothTime = CAMERA_DRAGGING_SMOOTH_TIME;
  controls.dollySpeed = CAMERA_DOLLY_SPEED;
};
