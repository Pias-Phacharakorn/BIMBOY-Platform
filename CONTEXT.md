# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

## In flight — Bug: clicking into a cut selects invisible geometry

**`OBC.SimpleRaycaster.castRay()` is not clipping-aware for model geometry.** Verified
in both the `components` and `components-front` bundles:

```js
c = await fragments.raycast({ camera, dom, mouse });  // fragment hit
if (items.length === 0) return c;                     // <- returned UNFILTERED
const u = this.intersect(items);                      // only this path is clip-filtered
```

`filterClippingPlanes` is applied **only** to the plain-THREE `items` path. Its JSDoc
claims `castRay` "also takes into account the clipping planes used by the renderer" —
that is true for `items` and false for fragments.

Consequence: viewed from the cut side, removed geometry sits between camera and the
visible surface. `OBF.Highlighter` picks that invisible geometry, so clicking a cut
face selects something you cannot see — or appears to select nothing, because the
outline is drawn on hidden geometry. **Not a regression from our work** — it is
pre-existing OBC behaviour that only surfaced once section planes became usable. Every
`castRay` consumer has it: highlighter, hoverer, all three measure cursors,
`SpotCoordinate`, and our own `ClipperPlacementManager` (which would otherwise place a
second plane on removed geometry).

1. **Fall through to the nearest *visible* hit**, not merely reject the clipped one.
   Rejecting (return `null` when the first hit is clipped) is five lines and stops the
   wrong element being selected, but leaves the reported symptom in place: the visible
   element still cannot be selected. `raycastAll` is on **`FragmentsModel`**, not the
   manager, so this means iterating `fragments.list`, merging, filtering and taking the
   nearest survivor.
2. **Fix it by swapping the world's raycaster**, not by reimplementing selection. The
   Highlighter picks through `Raycasters` internally and exposes no veto hook
   (`onBeforeHighlight` is a plain `OBC.Event`, not cancellable), so changing what that
   raycaster returns is the only route to correct selection. Rejected disabling the
   Highlighter's pointer wiring and driving selection ourselves: it would mean
   reimplementing multi-select, modifier keys, the `selectable` maps and the highlight
   events. One override fixes every consumer instead.
3. **Fast-path when nothing is clipped:** no enabled clipping plane → delegate straight
   to `super.castRay()`. This matters because `Hoverer` raycasts on every
   `pointermove`, and the merged `raycastAll` path replaces a call the vendor has
   optimised. Rejected always taking the merged path (one code path, no divergence
   risk — but a per-model `raycastAll` on every hover with no section active).
4. **Filter against `renderer.three.clippingPlanes`, not `Clipper.list`.** The renderer's
   array is what actually removes geometry, so it matches exactly what the user sees —
   including the Drawing Editor's own section clip — and it mirrors OBC's own
   `filterClippingPlanes`.
5. **Snapping and fast picking delegate to `super`.** Nothing in `src/` passes
   `snappingClasses` and `useFastModelPicking` defaults to `false`, so reimplementing
   those two branches would fork ~60 lines of vendored logic for paths this app never
   takes. Documented as a limitation rather than covered.

6. **Sectioning stays render-only; picking is taught to follow the view.** Confirmed
   with the developer against the observed repro (cut at the roof, drag down, click a
   revealed element, the *roof* selects). Decisive reason a section cannot be made to
   hide items instead: **a plane cuts through elements**, and `Hider.set()` is per item
   — hiding the cut-away part of a floor slab means hiding the whole slab, losing the
   cut face, which is the point of a section. Only a render-time clip can draw half an
   element. Rejected additionally driving `Hider` for items that fall *entirely* on the
   removed side: it needs a per-item bbox test against the plane on every drag frame,
   and elements straddling the plane still need the pick fix — additive work, not a
   replacement. Also rejected documenting it as a known limitation: the tool's whole
   purpose is inspecting what a cut reveals.
7. **Axis naming in the docs: world letters, plus what each cut is, plus the IFC note.**
   `axisOf()` reads world X/Y/Z, so those stay primary and greppable — but the table
   gets a "what it cuts" column, because a reader who thinks Z-up reads the vertical row
   as red and concludes the mapping is broken. ⚠️ **Vertical is world Y here.** IFC
   authors Z-up; FRAGS presents the model Y-up, which is why a plan/level cut wears a
   **blue** outline and not a red one.

   | normal | colour | what it cuts |
   |--------|--------|--------------|
   | ±Y | blue | a plan / level cut (horizontal) |
   | ±X | green | an elevation cut facing X |
   | ±Z | red | an elevation cut facing Z |

Install: `Raycasters.list` is keyed by `world.uuid`, and `get()` registers a
`world.onDisposed → delete(world)` hook. So call `get(world)` first (so teardown is
registered), dispose the default instance, then `list.set(world.uuid, ours)`. Safe to do
after `create-world.ts` has already created the default, because every consumer resolves
`Raycasters.get(world)` per pick rather than caching the instance.

Lives in `setup/src/clip-aware-raycaster.ts` and is wired from `setup/index.ts` — this is
world/engine infrastructure, not something the section tool owns.

## In flight — Measure cursors become their own components

`length-measure-cursor.ts` and `area-measure-cursor.ts` are **byte-identical for ~180 of
their 205 lines**. Only three things actually differ: the measurer (`OBF.LengthMeasurement`
vs `AreaMeasurement`), Area setting `measurer.color = #24a6f1`, and Area binding Enter →
`endCreation()`. Hover raycast, the 4px click-vs-drag discriminator, the picking-mesh build
with its activation-id cancel token, and teardown are duplicated verbatim. They move out of
`setup/src/` into `bim-components/MeasureCursor/`, following `ClipperCursor`'s shape
(`index.ts` = the class, `src/` = managers it owns and frees).

1. **Length and Area share a composed engine, not a base class.** A plain (non-Component)
   `MeasureCursorEngine` owns the managers and the activate/deactivate policy; each cursor is
   a ~25-line `OBC.Component` that registers its own uuid and delegates `.enabled` to an
   engine built from a descriptor (`getMeasurer`, optional `color`, optional extra keys).
   Rejected an `abstract MeasureCursorBase extends OBC.Component`: **`static readonly uuid` is
   not enforced on subclasses**, so a future `AngleMeasureCursor` that forgets to redeclare it
   inherits its parent's and `components.add()` silently overwrites a sibling in the registry —
   surfacing as "turning on Angle killed Length", nowhere near the missing line. Composition
   cannot express that mistake, and `ClipperCursor` set the flat-class-plus-managers precedent.
2. **`SurfaceMeasureCursor` stays where it is.** It shares nothing with the other two but the
   click discriminator — its own coplanar-face BFS, its own measurement registry, no picking
   meshes. Folding it into the same engine would be relocation without simplification.
3. **The picking-mesh cache becomes a registered component, `MeasurePicking`, in its own
   folder.** `measure-picking-meshes.ts` keeps a **module-global** `cache` + `inFlight`, and
   *each* cursor's `dispose()` called `clearMeasurePickingCache()` — so disposing Length freed
   the geometry and BVHs that Area's still-attached meshes point at. Masked today only because
   both are disposed together at world teardown. The cache must stay **shared**: it is keyed by
   model id, a build takes seconds on a large model, and the in-flight dedup exists precisely so
   switching Length↔Area mid-build doesn't extract twice — per-cursor instances would double
   that cost. As a component the cache is instance state freed exactly once, and cursors can no
   longer free each other's geometry. Rejected keeping module-level functions (hazard survives
   the refactor) and "global cache, but only one caller clears it" (an implicit rule enforced
   only by a comment).
4. **It is a *sibling* of `MeasureCursor`, not a manager inside it** — `bim-components/MeasurePicking/`,
   the way `GizmoAxis` sits beside `ClipperCursor`. In this repo a component's `src/` means
   "managers the parent class owns and frees"; `MeasurePicking` is owned by neither cursor and
   in principle serves any vertex-snapping consumer. Neither new folder joins the root
   `bim-components/index.ts` barrel — `ClipperCursor`/`GizmoAxis` are imported by path too.
5. **All three measure cursors migrate to the 1-arg constructor + `world` setter**
   (`new X(components); x.world = world`), closing most of the cursor-family typing debt:
   `ToolbarMeasure` drops three `as any` casts. ⚠️ `SurfaceMeasure.tsx` needs no cast **today**,
   but only because the whole file carries `@ts-nocheck` — the only file in
   `react-components/components/` that does. The migration makes its `get()` honest rather than
   merely unchecked; dropping that file-level suppression is a separate job (it is covering far
   more than the cursor cast). `ClipperCursor` is left as the single documented holdout —
   its 3-arg constructor also needs `viewport`, so its managers would have to be built lazily.
   Rejected leaving the debt alone: the constructors are already being rewritten, so this is
   the cheapest the fix will ever be.
6. **The three `setupXMeasureCursor` factories are deleted, not kept as wrappers.** Their
   returned teardown closure was **already dead code** — `setup/index.ts` discards all three
   return values, and `Components.dispose()` (called from `ViewportWrapper.tsx`) disposes
   anything `isDisposeable()` in the registry anyway. Construction moves inline, as
   `CursorSurface`/`GizmoAxis`/`SpotCoordinate` already do there.
7. **Behaviour is preserved except one named fix: `keydown` bails on text-input targets.**
   The listener is on `window` with no focus guard, so Backspace typed into the models-list
   search or property-table filter deletes a measurement while a measure tool is active.
   `delay` is also now restored on deactivate, symmetrically with `pickerMode` (an invisible
   asymmetry, not a behaviour change). Deliberately **not** fixed: picking meshes attach once
   on activate, so a model loaded while the tool is on gets no vertex snapping until the tool is
   toggled — documented as a limitation on `MeasurePicking`, where the `fragments.list.onItemSet`
   re-attach belongs later. Length still sets no `measurer.color` (Area does); making the two
   tools look like siblings is a visual decision, not a refactor concern.
8. **New files carry no `@ts-nocheck`**, matching `ClipperCursor`/`GizmoAxis` — the only two
   folders in `bim-components/` already free of it. Narrow commented casts instead, where the
   v3.4.x types are genuinely wrong: `normal` missing from `castRay`'s return, `getItemsGeometry`,
   and `computeBoundsTree` (installed on `BufferGeometry.prototype` by ThatOpen, absent from the
   three types). ⚠️ IDE-only discipline: `tsconfig.json` excludes `src/bim-components/**`, so
   nothing enforces this in CI.

## In flight — Measure lag: snapping moves to the FRAGS worker

Switching on Length or Area dropped the framerate on hover alone, nothing measured. Cause:
`MeasurePicking` extracted **one `THREE.Mesh` per geometry instance of every model** into
`world.meshes` (10k–100k on a real IFC), and every `mousemove` ran `Array.from` + a full
`intersectObjects` over all of them **twice** — once from `MeasureHoverManager.castRay()`, once
from the picker's `castRayToObjects()` in `SYNCHRONOUS` mode. BVHs made each mesh cheap; nothing
made paying per-mesh cost 50k times cheap, and it was all main-thread.

The tell: `ClipperPlacementManager`'s hover loop is the *same code* and the section tool is
smooth on the same models. Its `world.meshes` is empty.

1. **The premise was wrong, so the fix is a deletion, not an optimisation.** `bim-viewer.md`
   claimed fragment models expose no CPU geometry for snapping. FRAGS 3.4.x snaps **in the
   worker** — `raycastWithSnapping` → `snapRaycast` → `pointRaycast`/`lineRaycast`, returning
   `snappingClass`/`snappedEdgeP1P2`/`facePoints` — and the picker's *default* mode already
   routes there. `SYNCHRONOUS` exists for worlds without fragments. Rejected the cursor-local
   `world.meshes` variant (only the hovered element's meshes, keyed off the `localId` hover
   already returns): it fixes the per-move cost and leaves the extraction, the retained
   geometry, the BVH build, the matrix-key invalidation and the `onItemSet` gap all standing.
2. **`MeasurePicking` is deleted outright, not kept dormant.** A dormant *registered* component
   stays in the registry, gets disposed at teardown, and reads as live infrastructure — it even
   carried a ⚠️ note inviting a `fragments.list.onItemSet` re-attach, i.e. work on a dead path.
   ADR-0003 carries the finding and names `git show 2347cdf:…` for recovery.
3. **⚠️ Supersedes item 5 of the "clicking into a cut" entry above** ("Snapping and fast picking
   delegate to `super` … nothing in `src/` passes `snappingClasses`"). Something does now, so
   `ClipAwareRaycaster` owns that path: `raycastWithSnapping` per model, filtered per point
   because the worker only clip-culls at bounding-box level. Two halves matter — **keep the
   worker's candidate order and take the first survivor within a model** (that order is snap
   priority; distance-sorting lets a far corner beat the near edge you aimed at, merge across
   models by distance only), and **fall through to `raycastAll` when clipping kills every
   candidate**, or a revealed cut face becomes unmeasurable. `useFastModelPicking` stays the
   one documented bail-out.
4. **`delay = 0` stays, and is now documented as load-bearing.** `LengthMeasurement.endCreation()`
   commits whatever `updatePreviewLine()` — the `onPointerStop` handler — last wrote, so at the
   vendor default of 300 ms the second point commits stale. `AreaMeasurement` re-picks inside
   `create()` and would be safe either way. Rejected restoring the vendor delay: fixing Length
   then means calling `updatePreviewLine()` ourselves on click.
5. **Both `pickerMode` assignments go.** Each `Measurement` owns its own `GraphicVertexPicker`
   and its mode already defaults to the one we want, so setting it was noise. `MeasurerLike`
   loses the field.
6. ⚠️ **Watch on first use:** `updatePointer()` early-returns only in `SYNCHRONOUS` mode, so it
   has been suppressing the picker's 6px DOM preview div. In default mode that div reappears and
   churns the DOM per move while the snap marker hides/shows around each async pick — possible
   flicker over `CursorSurface`. Left alone deliberately; suppressing it means reaching into the
   measurer's private `_vertexPicker` or CSS-targeting an unclassed inline-styled div.

_No other decisions in flight._

⚠️ **Both entries above this one are already merged** (`407e47e`/PR #10 and `2347cdf`/PR #9) and
the guides have absorbed them — the staging buffer is stale. Promoting and clearing those two is
its own job, deliberately not folded into this change.

Recently promoted (for reference — do not re-stage here):

- **Section tool — outline cut planes + shared `GizmoAxis` component** (shipped
  `6c9ce18`) → how it works, plus the three-part plane anatomy, the
  `SimplePlane.visible` triple-duty setter, the `BoundingBoxer` load-time race, the
  `window`-capture pointerdown, the `GizmoAxis` handle API, the cone-aiming trap and
  the relative-imports-inside-`bim-components/` rule:
  `docs/feature/bim-viewer.md` § Section tool. Why outline-only and never pickable,
  with the shipped-then-reversed grabbable quad and the axis-colour inversion:
  `docs/adr/0002-section-plane-outline-only.md`.
- **Viewport toolbar — Visibility dropdown group** (shipped `d733b22`) → how it
  works, plus the two-rail geometry, the hand-rolled dropdown idiom, the right
  rail's FX suppression, and the rejected `^` caret affordance:
  `docs/feature/bim-viewer.md` § Viewport toolbars.
- **AR live viewer — glass UI restyle + opacity slider** (shipped `9b255d6`) → how it
  works: `docs/feature/ar-webxr.md`; why, with rejected alternatives:
  `docs/adr/0001-ar-overlay-model-opacity.md`.
