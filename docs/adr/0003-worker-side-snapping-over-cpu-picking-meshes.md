# ADR-0003: Measure tools snap in the FRAGS worker; the CPU picking-mesh path is deleted

**Status:** Accepted — premise re-tested and upheld on 3.4.8; see [ADR-0018](0018-thatopen-3-4-8-patch-bump.md)
**Date:** 2026-08-03
**Area:** `docs/feature/bim-viewport-righttoolbars.md` § Measure tools → Vertex snapping

> ⚠️ **Two things to know before trusting the detail below**, both from the bump to
> `@thatopen/components@3.4.8` / `@thatopen/fragments@3.4.7` ([ADR-0018](0018-thatopen-3-4-8-patch-bump.md)):
>
> 1. **The decision holds.** `raycastWithSnapping` still exists, the picker's default mode still
>    routes to it, and `getClippingPlanesEvent` still defaults to `() => []` — so the worker still
>    does no clip culling and this app's main-thread filtering is still required. Snapping was
>    re-tested by hand after the bump and works. Nothing here was reversed.
> 2. **But the premise now has a live alternative it did not have when written.** Upstream added
>    `SnapResolver` — main-thread snapping from *cached shell* geometry, not the per-instance
>    extraction this ADR deleted. "FRAGS snaps in the worker, so a main-thread path is
>    reimplementation" is no longer the whole picture. Adopting it was considered and deferred.
>
> **The `index.mjs` / `index.js` line numbers throughout this record predate the bump and are stale.**
> The symbol names are still correct; search by name, not offset.

## Context

Switching on Length or Area dropped the framerate immediately — before anything was measured, just hovering the model. The tools were unusable on real IFC models.

The cause was a premise that had been true since the first version of the tools and was never re-tested. The measurers were put into `GraphicVertexPickerMode.SYNCHRONOUS`, which snaps by raycasting `world.meshes`; fragment models expose no CPU geometry there, so `MeasurePicking` extracted **one plain `THREE.Mesh` per geometry instance of every loaded model**, baked to world space, BVH-accelerated, and added to `world.meshes` for as long as a tool was active. On a real model that is 10k–100k meshes.

Every `mousemove` then paid for it **twice**:

1. `MeasureHoverManager` → `castRay()` → `Array.from(world.meshes)` + `intersectObjects` over all of them (`components/index.mjs:11319`).
2. The vertex picker → `getSynchronous()` → `castRayToObjects()` → the same allocation and the same full intersect (`components-front/index.js:67841`, `components/index.mjs:11298`).

BVHs made each *individual* mesh cheap; nothing made paying the per-mesh cost 50k times cheap, and it was all on the main thread. Plus a multi-second `getItemsGeometry` extraction and BVH build on activation, and the geometry retained for the session.

The comparison that gave it away: `ClipperPlacementManager`'s hover loop is the same code as `MeasureHoverManager`'s — one raycast per `mousemove`, one in flight — and the section tool is smooth on the same models. The only difference is that its `world.meshes` is empty.

**The premise was wrong.** FRAGS 3.4.x snaps in the worker: `FragmentsModel.raycastWithSnapping({ snappingClasses })` → `snapRaycast` → `pointRaycast`/`lineRaycast` per representation, returning `snappingClass`, `snappedEdgeP1`/`P2` and `facePoints` on the hit (`fragments/index.mjs:16484`, `27748`; `index.d.ts:1579`, `3634`). `FragmentsManager.raycast` already fans it out per model and falls back to a plain raycast when snapping misses (`components/index.mjs:7540`). The picker's **default** mode routes straight to it (`components-front/index.js:67877`). `SYNCHRONOUS` exists to emulate that for worlds *without* fragments — we were paying a full CPU extraction to reimplement, on the main thread, what the worker already did.

## Decision

The picker stays in its **default** mode and snapping goes to the worker. `MeasurePicking` and its builder are **deleted** — component, cache, in-flight dedup, activation-id cancel token, world-matrix invalidation, BVH build. Nothing in `src/` adds to `world.meshes` any more; it is empty for the app's lifetime.

`ClipAwareRaycaster` grows the snapping path it used to delegate away. `snappingClasses` no longer bails out to `super.castRay`; the snap path calls `raycastWithSnapping` per model and filters candidates against the renderer's clipping planes per point, because the worker does **no** clip culling: `FragmentsModel.getClippingPlanesEvent` defaults to `() => []` (`fragments/index.mjs:16301`) and nothing in this app sets it, so the planes never reach the worker at all. Two halves of that contract are load-bearing:

- **Within a model: keep the worker's candidate order, take the first survivor.** That order is snap priority — which vertex or edge you aimed at — and `FragmentsManager.raycast` takes `[0]`. Across models, merge by distance.
- **If clipping kills every candidate, fall through to the plain `raycastAll` path**, so a revealed cut face stays measurable.

`measurer.delay = 0` **stays**, and is now documented as load-bearing rather than incidental: `LengthMeasurement.endCreation()` commits whatever `updatePreviewLine()` — the `onPointerStop` handler — last wrote into its temp line, so at the vendor default of 300 ms, clicking the second point early commits the line to a stale position. `AreaMeasurement` re-picks inside `create()` and is safe either way. ⚠️ 0 narrows that window rather than closing it — `create()` commits synchronously while the refresh is a `setTimeout(0)` plus a worker round trip — and the vendor offers no settled-pick hook (`updatePreviewLine` is private; `OBC.Event.trigger` does not await handlers). Both `pickerMode` assignments are gone: each `Measurement` owns its own picker (`components-front/index.js:69144`) whose mode already defaults to the one we want, so setting it was noise.

Recovering the CPU path, if a plain-THREE (non-fragment) consumer ever needs snapping: `git show 2347cdf:src/bim-components/MeasurePicking/index.ts` and `git show 2347cdf:src/bim-components/MeasurePicking/src/pickingMeshBuilder.ts`.

## Alternatives rejected

- **Keep `SYNCHRONOUS`, make `world.meshes` cursor-local** — hold the whole-model cache but add only the meshes of the element under the cursor, keyed off the `localId` the hover raycast already returns. This *was* the plan until the worker path turned up. It fixes the per-move cost and nothing else: the multi-second extraction, the retained geometry, the BVH build, the world-matrix invalidation and the "a model loaded while the tool is on gets no snapping" gap all survive, and it adds a `Map<localId, Mesh[]>` to maintain. Optimising the wrong mechanism.
- **Keep `MeasurePicking` on disk, dormant** — it is the only code that can snap against plain THREE meshes, so it looked worth preserving. Rejected because a dormant *registered* component isn't free: it stays in the `Components` registry, gets disposed at world teardown, and reads as live infrastructure. It already carried a ⚠️ known-limitation note inviting someone to "finish" it with a `fragments.list.onItemSet` re-attach — work on a dead path. The finding is what has value, and this record carries it; the code is one `git show` away.
- **Restore the vendor `delay` (300 ms)** — it would cut worker traffic to one snap per pointer-stop and give the picker's own DOM crosshair a clean two-state UX. Rejected: it silently corrupts Length's second point (see Decision). Fixing that would mean calling `updatePreviewLine()` ourselves on click and awaiting it, i.e. more vendored logic reimplemented to buy back something `delay = 0` already gives.
- **Sort snap candidates by distance** in `_nearestVisibleSnap`, matching how the plain path picks its nearest hit. Tempting because it makes both paths read the same, and wrong: it discards the worker's snap-priority order and lets a far corner vertex win over the near edge under the cursor.
- **Reject-only clipping (return `null` when the nearest snap is clipped)** — five lines, but it makes a cut face unmeasurable, which is the symptom, not the fix. Same reasoning as ADR-0002's ancestor decision in `clip-aware-raycaster.ts`.

## Consequences

- Hover cost is now **worker** raycasts per `mousemove` instead of main-thread mesh intersects. Note it is *not* one: the guide's `castRay()` and the picker's snap `castRay({ snappingClasses })` both fire every move (`delay = 0` makes `onPointerStop` effectively per-move), and with a section active each fans out per model — plus a `raycastAll` for any model whose snap candidates were all clipped. Up to three per-model fan-outs per move in the worst case. All of it is off the main thread, which is why the regression is fixed, but "one raycast per move" would be wrong.
- The snap→plain fallback is decided **per model**. Deciding it globally is the bug this change shipped with and had corrected in review: with two coordinated models and a section active, a far surviving snap on one model suppressed the near cut face on the other. `FragmentsManager.raycast` already had the right shape; the fix was to mirror it.
- Activation is instant. No extraction, no BVH build, no cancel token, and no memory retained after a tool is switched off.
- **Snap quality is now FRAGS' to define and ours only to filter.** There is no local dial beyond `snapDistance`. If a future FRAGS version regresses point snapping, we have no CPU fallback in the tree — only this record and a commit hash.
- `ClipAwareRaycaster` now forks two branches of vendored logic instead of one. It is shared engine infra (selection, hover, `SpotCoordinate`, `ClipperPlacementManager`), so mistakes there are not measure-only — although the new branch is only reachable with `snappingClasses`, which only the measurers pass.
- ⚠️ **A visual side effect to watch:** `updatePointer()` early-returns only in `SYNCHRONOUS` mode (`components-front/index.js:67902`), so it has been suppressing the picker's 6px DOM preview div. In default mode that div now appears and is appended/removed from the DOM per move, with the snap marker hiding then showing around each async pick. It may read as flicker alongside `CursorSurface`'s own guide. Left alone deliberately — suppressing it means reaching into the measurer's private `_vertexPicker` or CSS-targeting an unclassed inline-styled div.
- Snapping is clip-correct for the first time *by design* rather than by accident. It used to be correct only because `castRayToObjects` happened to route through `intersect` → `filterClippingPlanes`; now the filter is explicit and every snapping consumer inherits it.
- This supersedes item 5 of the "clicking into a cut selects invisible geometry" decision, which documented `snappingClasses` as a deliberate limitation on the grounds that "nothing in `src/` passes" them. Something does now.
