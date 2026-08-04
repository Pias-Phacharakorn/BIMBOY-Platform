# ADR-0004: The surface under the cursor bounds the camera; `infinityDolly` is turned off

**Status:** Accepted
**Date:** 2026-08-04
**Area:** `docs/feature/bim-viewer.md` § Camera navigation (cursor-bounded zoom + hover pivot)

## Context

Zooming in the viewport pushed the camera **through** whatever it was aimed at and kept going — nothing like Navisworks, where the wheel decelerates into the hovered face and parks just off it. The reviewer's normal move (point at a duct, scroll to inspect it) ended up inside the geometry.

This is not a missing feature. It is two vendor defaults working exactly as designed. `SimpleCamera.newCameraControls()` ships:

```js
controls.smoothTime = 0.2;
controls.dollyToCursor = true;    // zoom already aims at the cursor
controls.infinityDolly = true;
controls.minDistance = 6;
```

and `camera-controls@3.1.2` `_dollyInternal` reads:

```js
const distance        = this._sphericalEnd.radius * Math.pow(0.95, -delta * this.dollySpeed);
const clampedDistance = clamp(distance, this.minDistance, this.maxDistance);
if (this.infinityDolly && this.dollyToCursor) this._dollyToNoClamp(distance, true);        // clamp BYPASSED
else                                          this._dollyToNoClamp(clampedDistance, true); // clamp honoured
```

So with both flags on, **`minDistance` is dead config**: the vendor deliberately keeps the distance and pushes the *target* forward, which is precisely the infinite fly-through. Aiming zoom at the cursor was never the missing half — stopping it was.

Two further facts shaped the design more than the requirement did:

- **`setOrbitPoint()` carries a vendor contract:** *"SHOULD NOT RUN DURING ANIMATIONS. `setOrbitPoint()` will immediately fix the positions."* With `smoothTime = 0.2`, a wheel burst **is** an animation, so the obvious "re-pivot onto the hovered surface as you scroll" is the one thing the vendor warns against.
- **The near plane, not the standoff, decides how close the camera can get.** `newCameraPerspective()` is `PerspectiveCamera(60, aspect, 1, 1000)`. At a 1 m near plane, parking 25 cm off a wall renders that wall invisible — you stop at a surface and look straight through it.

## Decision

`CursorZoom` (`src/bim-components/CursorZoom/`) — an always-on `OBC.Component`, no toolbar entry — turns `infinityDolly` off and bounds the camera against the hovered surface, using **two different mechanisms** so the vendor's animation contract is never violated:

- **Pivot** — `setOrbitPoint(hit)` on `pointerdown`, where controls are at rest. It moves the target *without* moving the camera, so pivoting on every pointerdown (selection clicks included) has no visual effect; it only changes what the next orbit spins around and what the next wheel dollies toward. A `pointerdown` within 300 ms of a wheel event is **skipped, not deferred** — after a damped dolly the hit is stale anyway, and the next click re-pivots.
- **Clamp** — `minDistance` only, never the target, because `update()` re-clamps distance every frame and is therefore safe to write mid-dolly. Since the pivot is usually stale while `dollyToCursor` walks the camera along the *cursor ray*, travel is projected onto the camera→target axis: `minDistance = max(standoff, distance − (dHit − standoff)·cos θ)`, capped at `maxDistance × 0.99` because `clamp(v, min, max)` returns `min` once they cross.

**Adaptive zoom speed is deliberately not implemented.** `_dollyInternal` is multiplicative (`radius × 0.95^-delta`), so the stride is already proportional to distance-to-target. Moving the pivot onto the hovered surface is the entire fix; a dynamic `dollySpeed` would double-scale it.

**Raycasting is lazy** — `pointerdown` plus the first wheel event of a burst (150 ms cache, single-flight, stamped before the async hop). Nothing is added to the per-`pointermove` budget that ADR-0003 was written to protect. `OBF.Hoverer` was evaluated as a free hit source and cannot serve: no point/distance is exposed (only `onHoverStarted`/`onHoverEnded` and a private `_localId`) and it fires on a `delay` *after* the mouse stops.

**Scope is Orbit mode**, read per gesture because `OrthoPerspectiveCamera.set(mode)` fires no event. The clamp is additionally perspective-only — `_zoomInternal` never consults `minDistance` and `setOrthoCamera()` pins `distance = 200`, so orthographic gets the pivot and step scaling and nothing else. `FirstPerson` is exempt by design; `Plan` has no orbit.

**Controls config is snapshot-and-re-applied per instance**, not patched once, because three things overwrite it: `OrbitMode.activateOrbitControls()` (every `mode.set()`), the `Views2DList` camera swap (a whole new `CameraControls`), and `GisLayer3d`'s `maxDistance` patch.

**The near plane drops to `0.1`** in `setup/src/camera-depth-range.ts`, applied from `create-world.ts` and re-applied on `world.onCameraChanged` — it cannot be one static line, because **every `OBC.View` constructs its own `OrthoPerspectiveCamera`** and `Views2DList.applyPerspectivePlanCamera` flips plan views into a fresh near=1 camera. Depth range is global render config (postproduction and the minimap read it), so it lives in engine bootstrap rather than inside a navigation component; `CursorZoom` *derives* `standoff = max(0.25, near × 2.5)` so the two cannot drift.

## Alternatives rejected

- **Re-pivot onto the hovered surface at each wheel-burst start** — the most literal reading of Navisworks, and it would make the clamp trivial (stop at `standoff` from the pivot, no trigonometry). Rejected because it is exactly the case `setOrbitPoint()` warns about: mid-burst it hard-snaps out of the damped dolly, dropping the smoothing tail as a visible pop. The `cos θ` term exists to buy correctness without touching the target.
- **Drive `dollySpeed` dynamically per wheel event** for the "big strides far, fine nudges close" feel. Rejected once `_dollyInternal` was read: the vendor already scales the step by `radius`, so this fights a scaling that is already there and double-scales the result.
- **rAF-throttled continuous raycasting on `pointermove`** — the hit would always be fresh, so the very first wheel tick would clamp exactly instead of one frame late. Rejected on cost: a fragment raycast every throttled frame the mouse moves, paid even when the user never scrolls, against a documented bias (ADR-0003) toward keeping per-`pointermove` picking off the main thread. A hot/cold hybrid (continuous for ~1.5 s after any navigation) was also rejected — best feel, most state to get wrong.
- **`near = 0.01` with a 5 cm standoff** — matches Navisworks most literally. Rejected: a 1:100,000 near/far ratio is a real z-fighting risk across this model's many coplanar faces, and it degrades the depth-based half of postproduction. **Leaving `near = 1` with a 1.2 m standoff** was also rejected — zero risk, but it stops too far out to inspect a joint or a fitting, which is the actual use case.
- **Patch the controls once in `create-world.ts`** — fewest moving parts. Rejected because `OrbitMode.set()` and every `Views2DList` plan open silently revert it: the feature would die the first time someone opened a 2D view and came back.
- **Subclass `OrbitMode` / `OrthoPerspectiveCamera`** to own the config permanently, immune to vendor resets. Rejected as forking vendored navigation code for a config problem — the same instinct that kept `ClipAwareRaycaster` an override of one method rather than a reimplementation of selection.
- **A `ToolbarSettings` toggle** (`uiStore`-backed, default on), or a persisted per-user preference. Rejected: the fly-through reads as a bug, not a mode anyone would ask back, and no other viewer preference is persisted today. The cost of that call is the sealed-volume limitation below.
- **Owning the near-plane patch inside `CursorZoom`** — maximum cohesion, fully self-contained, restored on dispose. Rejected because depth range is global render config that postproduction and the minimap also read; burying it in a navigation component hides it from whoever next debugs z-fighting.

## Consequences

- ⚠️ **You can no longer wheel into a sealed volume** — inside a closed duct, or a room seen from outside. This is the direct cost of always-on with no toggle. The escape hatches are **FirstPerson** mode (exempt) and a **section plane**. If this becomes a support question, the cheap answer is the rejected `ToolbarSettings` checkbox.
- **Scrolling with the cursor over empty space no longer flies forever.** With `infinityDolly = false` the camera stops at `standoff` from the current pivot. This is the vendor's own non-infinity behaviour, but it *is* a behaviour change independent of any hovered surface.
- **Depth precision is an order of magnitude coarser** (1:1,000 → 1:10,000). Distant coplanar faces are likelier to z-fight and depth-based postproduction is marginally noisier. The overlays in this app are largely `depthTest: false` (`CursorSurface`, measure outlines) and so unaffected; model-on-model coplanarity is where it would show.
- **The first tick of a wheel burst clamps one frame late**, because the fragment raycast is async. `smoothTime = 0.2` absorbs it, but a single very fast tick can overshoot slightly before the clamp lands. Continuous raycasting is the only way to close this, and it was rejected above.
- **Restoring a baseline `minDistance` is a footgun and is floored** at `controls.distance`. `update()` clamps distance into `[minDistance, maxDistance]` every frame, so restoring the vendor's construction-time `6` while the camera sits 0.25 m off a wall would shove it backwards. The snapshot is usually `6` rather than `OrbitMode`'s `1`, because binding happens before the mode is set.
- **No vendor class is forked and no file is deleted.** `OrbitMode`, `OrthoPerspectiveCamera` and `SimpleRaycaster` are untouched, so a v3.4.x → later bump has one place to re-verify: whether `_dollyInternal`'s `infinityDolly` branch and `setOrbitPoint`'s animation contract still read the same.
- **`maxDistance = 300` and `far = 1000` are left alone**, deliberately out of scope. `GisLayer3d` still patches `maxDistance` to `100000` behind everyone's back, and `far = 1000` still clips past 1 km regardless — a site-scale concern this change neither fixes nor worsens.
