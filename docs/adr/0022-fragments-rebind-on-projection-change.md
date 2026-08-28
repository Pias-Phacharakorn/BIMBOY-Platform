# ADR-0022: Fragments rebind on projection change, not on `world.onCameraChanged`

**Status:** Accepted
**Date:** 2026-08-24
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Fragments and the camera

## Context

Switching Camera Projection to Orthographic froze the Fragments LOD/streaming engine outright.
Instrumented off the viewport's WebGL context on the live deployment: draw counts stayed
bit-for-bit constant across a 10-tick zoom (491 calls / 573,088 indices to 491 / 573,334), where
Perspective at the same framings went 491/573k to 229/129k. Entering Ortho from a far-away
Perspective view left the building a hollow grey shell at any zoom (197 / 83,719 — the far-away LOD,
forever).

The cause is that `model.useCamera(...)` captures **one specific `THREE.Camera` instance**, and
nothing re-called it. `world.onCameraChanged` fires only from `World.set camera(...)`.
`ProjectionManager.set()` does not replace the world's camera — it swaps `camera.three` and triggers
its *own* `onChanged`. So Fragments kept evaluating the perspective camera parked where it stood at
switch time. The `controls` `"update"` event still fired, so `core.update()` ran every frame against
a camera that never moved; hence the perfectly constant counts.

## Decision

Subscribe to `camera.projection.onChanged` in `fragments-manager.ts`, and **re-point that
subscription whenever `world.camera` is replaced** — `watchProjection()`, called from
`onCameraChange` as well as at setup.

The rebind takes the camera from the event payload, calls `model.useCamera(three)` for every loaded
model, then `fragments.core.update(true)`.

## Alternatives rejected

- **The single line `camera.projection.onChanged.add(rebindCamera)` at setup.** This is what the bug
  report proposed, and it fixes the toolbar toggle only. `projection` belongs to the *camera*:
  `OBC.Views.open()` assigns a brand-new `OrthoPerspectiveCamera` to the world, and
  `Views2DList.applyPerspectivePlanCamera` then calls `projection.set("Perspective")` on *that*
  camera. A bootstrap-time subscription is left listening to a `ProjectionManager` nobody drives.
- **Call the rebind from the callers.** `ToolbarSettings.handleProjectionSelect` and
  `applyPerspectivePlanCamera` both already know they changed projection, so each could notify
  Fragments directly. Rejected: it makes correctness depend on every future `projection.set()`
  caller remembering, and it puts BIM-engine wiring in a React component. The fix belongs on the
  listening side, in the one file that owns the fragments/camera relationship.
- **Read `world.camera.three` inside the handler** instead of taking the event payload. It happens to
  work, because `OrthoPerspectiveCamera` assigns `three` from its own listener on the same event,
  registered in its constructor and therefore ahead of ours. Nothing guarantees that ordering, and
  the payload is right there.

## Consequences

- **`update(true)` is forced here on purpose**, and does not contradict the never-force warning on
  `onControlsUpdate` immediately below it in the same file
  ([ADR-0020](0020-one-render-per-frame-and-hover-on-settle.md)). That warning is about the
  continuous `controls "update"` event. A projection switch is a discrete state change — the same
  class as a model load.
- **`controls "update"` is still bound to the bootstrap camera's controls only.** Every `OBC.View`
  owns its own `CameraControls`, so inside a 2D view that listener is attached to an inactive camera.
  The vendor partly covers it — `Views.open()` adds its own `"rest"` handler — so plan views update
  on settle rather than continuously. Not fixed, deliberately.
- **The production bundle appears to contain `@thatopen/components` twice** (two `ProjectionManager`
  and two `World` class identities). Duplicate identities can make `components.get(...)` hand back an
  instance other than the expected one. Low confidence, unrelated to this bug, build-config
  territory — recorded so the next person to see it does not start from scratch.
- **Ortho to Perspective visibly jumps framing.** `ProjectionManager.matchOrthoDistanceEnabled` is
  the knob if that is not wanted; it defaults to `false` and nothing in `src/` sets it.
