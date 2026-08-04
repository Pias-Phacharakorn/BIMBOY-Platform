import * as OBC from "@thatopen/components";
import * as THREE from "three";

/**
 * Near plane for every camera in the viewport world.
 *
 * ⚠️ **This number decides how close the camera can get to anything.** OBC's own
 * `newCameraPerspective()` builds `new THREE.PerspectiveCamera(60, aspect, 1, 1000)` — a **1 m**
 * near plane — so geometry within 1 m of the camera is clipped away by the GPU. Any attempt to
 * park the camera closer than that renders the surface you stopped at *invisible*: you end up
 * looking straight through the wall you were inspecting. `CursorZoom` therefore derives its
 * standoff from this value rather than hardcoding one, so the two can never drift apart.
 *
 * Accepted cost: the near/far ratio goes from 1:1,000 to 1:10,000, so the depth buffer is an
 * order of magnitude coarser. Distant coplanar faces are likelier to z-fight, and the
 * depth-based half of postproduction (outlines, AO) gets marginally noisier. `0.01` was rejected
 * for exactly this reason — 1:100,000 is a real z-fighting risk across this model's many
 * coplanar faces.
 */
export const CAMERA_NEAR = 0.1;

/**
 * Applies {@link CAMERA_NEAR} to every three.js camera an `OrthoPerspectiveCamera` owns.
 *
 * ⚠️ **Must be re-applied per camera instance, not once at bootstrap.** Two things create
 * cameras behind our back:
 *
 * - `OrthoPerspectiveCamera` holds **two** three.js cameras (`threePersp`, `threeOrtho`) and
 *   swaps `camera.three` between them on projection change. Only the perspective one is built
 *   with near=1; `newCameraOrtho()` already uses 0.1.
 * - **Every `OBC.View` constructs its own `OrthoPerspectiveCamera`**, and `OBC.Views.open()`
 *   assigns it to `world.camera`. `Views2DList.applyPerspectivePlanCamera` then flips plan views
 *   to Perspective — straight into a fresh near=1 camera. Hence the `world.onCameraChanged`
 *   subscription in `create-world.ts`.
 *
 * Idempotent, so re-running it on every camera change is free.
 */
export const applyCameraDepthRange = (camera: OBC.BaseCamera) => {
  // `threePersp`/`threeOrtho` exist only on OrthoPerspectiveCamera; `three` is on every camera.
  // A Set because `three` is always one of the other two — patch each object once. The cast picks
  // just those two fields: casting to the whole class clashes on `three` (Camera vs the narrower
  // Perspective|Orthographic union).
  const { threePersp, threeOrtho } = camera as Partial<
    Pick<OBC.OrthoPerspectiveCamera, "threePersp" | "threeOrtho">
  >;
  const cameras = new Set(
    [camera.three, threePersp, threeOrtho].filter(
      (three): three is THREE.PerspectiveCamera | THREE.OrthographicCamera =>
        !!three && "near" in three,
    ),
  );

  for (const three of cameras) {
    if (three.near === CAMERA_NEAR) continue;
    three.near = CAMERA_NEAR;
    three.updateProjectionMatrix();
  }
};
