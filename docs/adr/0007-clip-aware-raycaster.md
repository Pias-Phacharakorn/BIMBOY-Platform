# ADR-0007: Selection follows the cut by swapping the world's raycaster, not by reimplementing picking

**Status:** Accepted
**Date:** 2026-08-04 (decision made and shipped earlier, in `75da737` / PR #10; promoted from `CONTEXT.md` on this date)
**Area:** `docs/feature/bim-viewer.md` § Picking (clip-aware raycasting)
**Superseded in part by:** [ADR-0003](0003-worker-side-snapping-over-cpu-picking-meshes.md) — the snapping branch

## Context

**`OBC.SimpleRaycaster.castRay()` is not clipping-aware for model geometry.** Verified in both the `components` and `components-front` bundles:

```js
c = await fragments.raycast({ camera, dom, mouse });  // fragment hit
if (items.length === 0) return c;                     // <- returned UNFILTERED
const u = this.intersect(items);                      // only this path is clip-filtered
```

`filterClippingPlanes` is applied **only** to the plain-THREE `items` path. The JSDoc claims `castRay` "also takes into account the clipping planes used by the renderer" — that is true for `items` and false for fragments.

Consequence: viewed from the cut side, removed geometry sits between the camera and the visible surface. `OBF.Highlighter` picks that invisible geometry, so clicking a cut face selects something you cannot see — or appears to select nothing, because the outline is drawn on hidden geometry.

**Not a regression from our work** — pre-existing OBC behaviour that only surfaced once section planes became usable. Every `castRay` consumer has it: the highlighter, the hoverer, all three measure cursors, `SpotCoordinate`, and our own `ClipperPlacementManager` (which would otherwise place a second plane on removed geometry).

## Decision

`ClipAwareRaycaster` (`src/bim-components/setup/src/clip-aware-raycaster.ts`) subclasses `OBC.SimpleRaycaster` and replaces the world's raycaster, wired from `setup/index.ts` **before anything that picks**. It is world/engine infrastructure, not something the section tool owns.

- **Fall through to the nearest *visible* hit**, not merely reject the clipped one. `raycastAll` lives on **`FragmentsModel`**, not the manager, so this means iterating `fragments.list`, merging, filtering and taking the nearest survivor.
- **Fast-path when nothing is clipped:** no enabled clipping plane → delegate straight to `super.castRay()`.
- **Filter against `renderer.three.clippingPlanes`, not `Clipper.list`.**
- **Sectioning stays render-only; picking is taught to follow the view.**
- **Install order matters.** `Raycasters.list` is keyed by `world.uuid`, and `get()` registers a `world.onDisposed → delete(world)` hook. So call `get(world)` **first** (so teardown is registered), dispose the default instance, then `list.set(world.uuid, ours)`. Safe to do after `create-world.ts` has already created the default, because every consumer resolves `Raycasters.get(world)` per pick rather than caching the instance.

## Alternatives rejected

- **Reject the clipped hit** (return `null` when the first hit is clipped) — five lines, and it stops the *wrong* element being selected. Rejected because it leaves the reported symptom in place: the visible element still cannot be selected.
- **Disable the Highlighter's pointer wiring and drive selection ourselves** — would mean reimplementing multi-select, modifier keys, the `selectable` maps and the highlight events. The Highlighter also picks through `Raycasters` internally and exposes **no veto hook** (`onBeforeHighlight` is a plain `OBC.Event`, not cancellable), so changing what that raycaster returns is the only route to correct selection. One override fixes every consumer instead.
- **Always take the merged path** — one code path and no divergence risk, but a per-model `raycastAll` on every hover with no section active. `Hoverer` raycasts on every `pointermove`, and the merged path replaces a call the vendor has optimised.
- **Filter against `Clipper.list`** — the renderer's array is what actually removes geometry, so it matches exactly what the user sees, including the Drawing Editor's own section clip, and it mirrors OBC's own `filterClippingPlanes`.
- **Make sectioning hide items instead of clipping them** (drive `OBC.Hider`) — the decisive rejection, confirmed with the developer against the observed repro (cut at the roof, drag down, click a revealed element, the *roof* selects). **A plane cuts through elements**, and `Hider.set()` is per item — hiding the cut-away part of a floor slab means hiding the whole slab, losing the cut face, which is the point of a section. Only a render-time clip can draw half an element.
- **Additionally drive `Hider` for items falling *entirely* on the removed side** — needs a per-item bbox test against the plane on every drag frame, and elements straddling the plane still need the pick fix. Additive work, not a replacement.
- **Document it as a known limitation** — the section tool's whole purpose is inspecting what a cut reveals.
- **Delegate snapping and fast picking to `super`** — the original decision, on the grounds that nothing in `src/` passed `snappingClasses`. **Superseded by [ADR-0003](0003-worker-side-snapping-over-cpu-picking-meshes.md)**: the measure cursors now do, so `ClipAwareRaycaster` owns that branch too.

## Consequences

- **Every `castRay` consumer inherits the fix** — selection, hover, all three measure cursors, `SpotCoordinate` and `ClipperPlacementManager` — without any of them knowing clipping exists.
- ⚠️ **It is shared engine infrastructure, so a bug here is never section-only.** It sits on the hot path of hover, which fires per `pointermove`.
- ⚠️ **Install order is load-bearing.** Replacing the instance without calling `Raycasters.get(world)` first skips the teardown registration and leaks the raycaster past world disposal.
- **`useFastModelPicking` remains the one documented bail-out** — it defaults to `false` and nothing in `src/` sets it, so that branch is delegated rather than covered.
- **Sectioning is permanently render-only.** Any future feature wanting "hide everything past this plane" has to be a separate concept from a section plane, not a reimplementation of it.
