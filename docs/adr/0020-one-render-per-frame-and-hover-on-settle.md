# ADR-0020: One render per animation frame, and hover picks on settle

**Status:** Accepted
**Date:** 2026-08-21
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Render loop and hover cadence

## Context

Two independent costs, both found by live profiling a 60-model NTR1 scene, and both introduced or
worsened by the `@thatopen` 3.4.8 / front 3.4.4 bump ([ADR-0018](0018-thatopen-3-4-8-patch-bump.md)).

**Hover.** At 3.4.2 the `Hoverer` had `delay = 100`: a ~50 ms debounce before picking, then another
100 ms before the overlay. 3.4.4 deletes `delay`, introduces `mode`, and defaults it to
`MOUSE_MOVE` — continuous back-to-back picks — on the stated reasoning that *"picking is fast enough
that there's no reason to wait for the cursor to settle"*. True for a demo scene. Here, moving the
mouse and doing nothing else measured **50–60 fps → 25 fps**. Each pick is a GPU id pass plus a
`readPixels` stall, and it never calls `renderer.update()`, so no render-side fix can reach it.

**Renders.** `RendererMode` defaults to `AUTO` and this app never sets it, so `needsUpdate` is never
read and *every* `update()` call repaints unconditionally. Nothing calls it once per frame: the
vendor `requestAnimationFrame` loop ticks `Worlds`, and on top of that sit five camera-controls
listeners and six cursor components on `pointermove`. Profiling measured **2.96 renders per animation
frame** — the same framebuffer filled three times at ~3,558 draw calls each, 22.8 ms of a 34.9 ms
frame.

## Decision

**`hoverer.mode = HovererMode.MOUSE_STOP`, unconditionally**, in `setupHoverer`. `MOUSE_STOP` settles
for a hardcoded, private 30 ms, so this is *snappier* than the 3.4.2 behaviour it restores. There is
no dial between the two modes.

**`setupRenderCoalescer` wraps `renderer.update`** in `setup/index.ts`, before anything that renders.
The first call in a frame schedules one `requestAnimationFrame` that performs exactly one real
render; every further call in that window is absorbed. A live patch to one render per frame measured
**27 → 40 fps**.

**`fragments.core.update()` is no longer forced on camera move.** `force` means "finish all the
models' pending requests", so awaiting it on the continuous `controls "update"` event pinned the
render loop to the worker draining its whole streaming/LOD/culling queue on every camera event. 36 of
the vendor's 37 examples wire that event as a bare `update()`; **none** force it. The forced form
stays on discrete state changes — a load, a config change, a projection swap.

## Alternatives rejected

- **`RendererMode.MANUAL` — deferred, not rejected.** The vendor's designed answer, one line, and it
  would kill idle rendering too (a static scene currently repaints 60×/s, ~7.84 ms each, ~half a
  core). Blocked on the fact that **nothing sets `needsUpdate`** — not this app, and not the vendor's
  own viewport components: upstream sets it almost exclusively in `TechnicalDrawings`, and `Hoverer`
  never does. MANUAL would freeze vendor visuals (hover, outliner, measurement previews) along with
  our ~12 scene-mutating components until something else happened to trigger a render. That is an
  audit, not a one-liner — and it is why the PostRender tab does not expose a Manual mode section.
- **"Render the first call each frame, drop the rest."** The obvious shape, and wrong: it needs a
  per-frame flag reset, so correctness depends on whether our `rAF` callback runs before or after the
  vendor's. Lose that race and a legitimate render is dropped, halving the framerate. Deferring to a
  single scheduled render is order-independent — renders are merged, never skipped.
- **Keep `MOUSE_MOVE` and throttle on our side** (one pick per frame, or a smaller picker scissor).
  Fights a vendor default with app-side machinery, and the per-pick `readPixels` stall survives it.
- **Expose hover cadence as a user setting.** `ToolbarSettings` already has a hover **on/off** toggle,
  which is the escape hatch that matters. A second, subtler cadence control needs store state and a
  persistence decision to buy back 30 ms nobody can perceive.
- **Adapt the mode to scene weight.** The threshold is unjustifiable, frame-time-driven switching
  needs hysteresis, and it makes hover behave differently between two projects for no articulable
  reason.

## Consequences

- **Safe because nothing consumes hover events.** Nothing in `src/` subscribes to the `Hoverer`'s
  events, so the cadence change has no downstream reader. `MeasureHoverManager` runs its own
  `mousemove` raycast, but only while a measure tool is active.
- ⚠️ **The coalescer monkey-patches a vendor method.** If a future version changes `update`'s shape,
  or calls its own renderer internals directly, this silently stops helping rather than breaking
  loudly. Pinned at `@thatopen/components` 3.4.8 / `components-front` 3.4.4.
- ⚠️ **Idle rendering is not fixed.** In `AUTO` the vendor loop still calls `update()` every tick, so
  a completely static scene still repaints once per frame. One render per frame is the ceiling this
  can reach; removing them entirely needs the MANUAL conversion above.
- **The remaining ceiling is draw-call submission, not any of this.** 60 models = 2,746 meshes, 1,188
  unique materials, zero `InstancedMesh`, 7.3M triangles, 100% CPU-bound at ~3 µs per call: rendering
  at 64×64 instead of 520×687 moved frame cost by 0.5 ms, and hiding half the models bought 27 → 34
  fps. Going further means material dedup, not auto-loading all 60, or upstream instancing.
- **Ruled out, so nobody re-chases them:** `dynamicAnchor` (exists at 3.4.2, defaults `false`, binds
  only `pointerdown`), postproduction (~1 ms), BVH raycasting (already on), resolution, shadows,
  textures, and DOM size (507 nodes).
