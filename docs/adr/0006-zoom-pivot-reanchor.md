# ADR-0006: Re-anchor the zoom pivot on `rest`, never from the wheel

**Status:** Accepted
**Date:** 2026-08-04
**Area:** `docs/feature/bim-viewer.md` § Camera navigation (cursor-bounded zoom + hover pivot)
**Supersedes in part:** [ADR-0004](0004-cursor-bounded-navigation.md)

## Context

ADR-0004 turned `infinityDolly` off so `minDistance` would bound the camera at the hovered surface. That worked until the camera parked, after which **zoom died permanently in every direction** until a click or Focus reset the camera. Reported by the developer as "zoom on an element until I reach its surface, turn the camera, then zoom to another element — nothing happens."

Three vendor facts, all in `camera-controls@3.1.2`:

1. **The freeze condition is `minDistance >= radius`,** and it disables three motion paths at once. In `_dollyInternal` (`:2497`) `clampedDistance === lastDistance`, so the radius cannot change; `_changedDolly += 0`, and `update()` gates the entire cursor-directed target shift on `_changedDolly !== 0` (`:2168`); and the `isMin` escape that would push the *target* forward once the radius bottoms out is gated on `infinityDolly` (`:2186`), which ADR-0004 turned off.
2. **`minDistance` bounds `|camera − target|`, so it cannot express a stop that lies beyond the target.** The old clamp was `max(standoff, distance − travel)`; when the hovered surface sat farther from the camera than the target did, `travel > distance`, the bracket went negative, and the `max` floored it at `standoff` — so instead of stopping, the dolly walked the radius down to 0.25 m to meet it. Rotating preserved that (orbit is radius-preserving).
3. **The vendor emits no `rest` for a frozen notch.** `_needsUpdate` makes `update()` dispatch `wake`, then it falls false the next frame and takes the `sleep` branch, never the `rest` branch (`:2263-2286`). So a frozen zoom cannot recover on a `rest` hook — it waits for unrelated motion to produce one.

Separately, raising `minDistance` dynamically leaves a stale clamp that silently under-zooms every `fitToSphere` caller, because that method ends in `dollyTo(distanceToFit)` (`:1708`), which clamps: `ToolbarFocus`, `PropertyTable`'s zoom-to-selection and `Views2DList`'s plan framing.

## Decision

**Two mechanisms, on two events, because they cannot share one.**

- **Wheel — raise `minDistance` trigonometrically, target untouched.** Safe mid-dolly precisely because it never moves the target. The pivot it measures against is stale *by design*, which is what `cos θ` corrects: `dollyToCursor` walks the camera along the cursor ray while `minDistance` bounds `|camera − target|`, so travel is projected onto the camera→target axis — `max(standoff, distance − (dHit − standoff)·cos θ)`, capped at `maxDistance × 0.99`. Without `cos θ` the stop is ~13% off at the frustum edge.
- **`rest` — release the clamp *and* re-anchor the pivot.** The only moment nothing is animating, so the only moment `setTarget` is safe. `_reanchorPivot(hit)` moves the target to the hit's depth along the current view axis (`target = position + axis · (toHit · axis)`); the target stays on the view axis, so the camera neither moves nor turns, while `radius` becomes the depth of what is under the cursor. The release keeps the four `fitToSphere` callers honest, to a standoff looser than both the vendor baseline and `OrbitMode`'s `1`. A fresh raycast is taken rather than reusing the burst's hit, which a rotate has already made stale.
- **`pointerdown` — the same view-axis re-anchor**, so a later orbit spins around the clicked depth.
- **A no-op bail is required, not optional.** `setTarget` sets `_needsUpdate`, so `update()` emits another `rest`, which calls back in. `_reanchorPivot` skips when the depth change is under `REANCHOR_EPSILON` (1%), terminating the loop.

**Accepted rough edge:** an *already*-frozen zoom does not recover here, because the vendor emits no `rest` for a notch that moved nothing (`_needsUpdate` → `wake`, then false next frame → the `sleep` branch, never `rest`, `:2263-2286`). A camera parked at a surface can therefore need several scrolls before zoom moves again. Two fixes were built and both were worse — see ④ and ⑤ below. Kept as the least-bad state; if it becomes unacceptable, prefer one of the two larger options over a fifth patch.

## Alternatives rejected

Four designs were built and reverted, each producing its own artefact. They are recorded in order because each one's failure is what forced the next.

- **① Re-anchor from the wheel + constant `minDistance = standoff`** — reverted: **visibly jerky.** Not tuning, a bookkeeping race. `update()` derives `dollyControlAmount = _spherical.radius − _lastDistance` and turns it into `lerpRatio = (prevRadius − _sphericalEnd.radius) / _sphericalEnd.radius`; `setTarget` teleports the radius behind `_lastDistance`'s back, so a 20 → 2 re-anchor with a notch pending makes `dollyControlAmount` −18 and `lerpRatio` ≈ **9** instead of ≈ 0.05 — the target is lerped nine times past the cursor. Gating on a true burst start narrows but does not close it: short flicks each start a new burst.
- **② Conditional re-anchor + constant clamp** (`isBurstStart && distance <= standoff * 1.5`) — hides ① by rarely firing, but **reinstates the fly-through**: target 20 m ahead inside the model, wall 2 m under the cursor, guard skips the re-anchor, so the radius stays 20 while `minDistance` is 0.25 and the dolly runs straight through the wall. A constant clamp is valid *only* alongside an unconditional re-anchor, and an unconditional wheel re-anchor is ①.
- **④ Re-anchor on the frozen branch via `setTarget` (view-axis depth)** — made recovery immediate, but the pivot lands laterally **centred**, so the dolly axis points at screen centre and zoom travels forward rather than at the hovered element; `dollyToCursor` corrects laterally at only ~5% per notch. The developer reported it as the camera setting off in roughly the right direction and missing what they pointed at.
- **⑤ Re-anchor on the frozen branch via `setOrbitPoint(hit)`** — fixes ④'s aim (pivot lands on the hovered point, image held still by the focal offset) and is provably yank-free there, since the branch is only reachable with `hitDistance > standoff` so its internal `dollyTo` clamps nothing. Reverted anyway at the developer's request: **the ③ behaviour was preferred over both ④ and ⑤**, and ⑤ additionally leaves a focal offset that only `fitToSphere` clears, so ViewCube and clash navigation sit laterally shifted until the next Focus.

**The shipped design is ③.** Its ~5-scroll wake-up is a known cost, chosen over ④'s and ⑤'s misdirected zoom.
- **Clamp-headroom scaling** (`min(limit, radius × 0.9)`) — unfreezes the dolly, but the radius still collapses and the stride is multiplicative, so each notch moves ~1 cm. Not frozen, still unusable.
- **Restoring `infinityDolly` with per-frame standoff policing** — the most principled option and still the fallback if the current design proves fragile: zoom would always steer at the cursor and could never die. Rejected for now as the largest change, and because the fly-through returns wholesale if the guard is wrong.
- **Reverting the clamp entirely** (keep pivot + dot, accept the fly-through) — genuinely on the table after four attempts, and ADR-0004 notes crais.io has no surface clamp either. Held in reserve.
- **Dropping the `cos θ` projection** — only valid if the pivot is fresh every burst, which ① rules out. With a stale pivot by design, the projection is what keeps the stop honest.
- **A `rest` listener that only releases `minDistance`** (CONTEXT item 20's original proposal) — necessary but not sufficient: releasing to `standoff` sets `minDistance = 0.25` while the radius is already 0.25, so the freeze survives. It is kept, for the `fitToSphere` half only.

## Consequences

- ⚠️ **Never re-anchor from the wheel** — not unconditionally (①), not on a burst-start gate (①), not on the frozen branch (④, ⑤). The hazard is not visible from reading the method in isolation; the mechanism lives in the vendor's `update()`. The class docstring and `_onRest` carry the reasons.
- ⚠️ **A parked camera can need several scrolls before zoom moves again.** The accepted cost of ③, and the reason is a vendor gap (no `rest` for a motionless notch), not our code.
- **The pivot is one gesture behind during a zoom.** Deliberate — that is what `cos θ` compensates for — but the *stride* during a long burst is scaled by the depth measured when the gesture began.
- **`rest` fires after rotates, pans, `fitToSphere` and ViewCube moves**, not just zooms, so the pivot is re-anchored and the clamp released at the end of every settled camera gesture — one raycast per settled gesture.
- ⚠️ **`REANCHOR_EPSILON` is load-bearing.** Removing it produces an endless `rest` → `setTarget` → `rest` loop that raycasts every frame.
- **Five attempts in one feature is a signal.** If this rough edge becomes unacceptable, prefer restoring `infinityDolly` with our own standoff policing, or reverting the clamp outright, over a sixth patch to the clamp.
