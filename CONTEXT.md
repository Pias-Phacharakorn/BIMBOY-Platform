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

## In flight — Navisworks-like navigation: the surface under the cursor bounds the zoom

Zooming pushes the camera **through** whatever it is aimed at and keeps going. Not a missing
feature — a vendor default. `SimpleCamera.newCameraControls()` already ships
`dollyToCursor = true` (so zoom *does* aim at the cursor) but also `infinityDolly = true`, and
`_dollyInternal` reads:

```js
const distance        = this._sphericalEnd.radius * Math.pow(0.95, -delta * this.dollySpeed);
const clampedDistance = clamp(distance, this.minDistance, this.maxDistance);
if (this.infinityDolly && this.dollyToCursor) this._dollyToNoClamp(distance, true);        // clamp BYPASSED
else                                          this._dollyToNoClamp(clampedDistance, true); // clamp honoured
```

So with both flags on, `minDistance` is **dead config** — the vendor deliberately keeps the
distance and pushes the *target* forward instead, which is the infinite fly-through. Navisworks
instead decelerates into the hovered face and parks just off it.

**Terminology** (used in the code and the guide): the **hover pivot** is the controls target moved
onto the raycast hit; the **zoom standoff** is the gap that must survive between camera and hovered
surface; the **clamp window** is the wheel burst during which `minDistance` is raised; the
**baseline** is the per-`CameraControls`-instance snapshot of the vendor's own config.

1. **Zoom step scaling needs no code — it falls out of the pivot.** The dolly is *multiplicative*
   (`radius * 0.95^-delta`), so the absolute stride is already proportional to `radius`: big
   strides far out, fine nudges up close. That only *feels* right if `radius` measures the
   distance to what the user is looking at, which is exactly what moving the pivot onto the hovered
   surface achieves. Rejected driving `dollySpeed` dynamically per wheel event — it would fight a
   scaling the vendor already applies, and double-scale the step.
2. **Pivot and clamp use two different mechanisms, because `setOrbitPoint()` is animation-unsafe.**
   The vendor's own contract: *"SHOULD NOT RUN DURING ANIMATIONS."* With `smoothTime = 0.2`, a wheel
   burst **is** an animation. So the **pivot** moves via `setOrbitPoint(hit)` on `pointerdown`, where
   controls are at rest and the caveat is satisfied, while the **clamp** never touches the target at
   all — it only raises `minDistance`, which `update()` re-clamps every frame and is therefore safe
   mid-dolly. Rejected re-pivoting at each wheel-burst start (most literally Navisworks, and exactly
   the case the vendor warns about — expect a visible pop).
3. **`setOrbitPoint` on *any* pointerdown, selection clicks included.** It moves the target
   **without moving the camera**, so a plain left-click has zero visual effect; it only means a later
   orbit spins around what was clicked and a later wheel dollies toward it. Rejected deferring to
   camera-controls' `controlstart` + `currentAction === ACTION.ROTATE` (purer "pivot only affects
   orbiting", but fires once `controls.active` is already true — back into the animation caveat) and
   middle-drag-only (leaves left-drag orbiters with nothing).
4. **The clamp is trigonometric, not "stop at the pivot".** Because the pivot may be stale from an
   earlier click while `dollyToCursor` walks the camera along the *cursor* ray, with hit distance
   `dHit` and `θ` = angle between cursor ray and the camera→target axis:
   `minDistance = max(standoff, radius − (dHit − standoff) · cos θ)`. The `cos θ` term is what keeps
   the stop honest at the edge of a 60° frustum; without it the error runs ~13%. **Zoom-out is never
   clamped** — the baseline is restored on `rest` and on a miss.
5. **Raycast lazily: wheel-burst start + pointerdown only.** Zero raycasts while merely hovering,
   consistent with ADR-0003's bias against per-`pointermove` picking cost. Freshness *within* a burst
   does not matter, because `minDistance` has already been computed for that burst. `OBF.Hoverer`
   was evaluated as a free hit source and **cannot** serve: it exposes no point/distance (only
   `onHoverStarted`/`onHoverEnded`, private `_localId`) and fires on a `delay` *after* the mouse
   stops. Rejected rAF-throttled continuous raycasting (exact on the first tick; pays on every
   frame the mouse moves even if the user never scrolls) and a hot/cold hybrid (best feel, more
   state to test).
6. **⚠️ The 1 m near plane is what actually decides "how close".** Vendor
   `newCameraPerspective()` is `PerspectiveCamera(60, aspect, 1, 1000)` — geometry within 1 m of the
   camera is clipped, so parking 25 cm off a wall would render the wall *invisible* and you would see
   straight through the surface you stopped at. `near` drops to **0.1** and the standoff is **0.25 m**.
   Accepted cost: depth ratio goes 1:1,000 → 1:10,000, so distant coplanar faces are likelier to
   z-fight and depth-based postproduction (outlines/AO) gets marginally noisier. Rejected `near = 0.01`
   + 5 cm standoff (1:100,000 — real z-fighting risk across this model's coplanar faces) and leaving
   `near` alone with a 1.2 m standoff (zero risk, but stops too far out to inspect a joint).
   `newCameraOrtho()` is already `0.1` and needs nothing.
7. **The near patch belongs to engine bootstrap, applied per camera instance.** It cannot be a single
   static line: **every `OBC.View` constructs its own `OrthoPerspectiveCamera`**, so each 2D view
   carries a fresh near=1 perspective camera, and `Views2DList.applyPerspectivePlanCamera` flips plan
   views into exactly that camera. So `create-world.ts` calls `applyCameraDepthRange(camera)` and
   re-calls it from `world.onCameraChanged`. Depth range is global render config (postproduction and
   the minimap read it), so burying it in a navigation component would hide it; the component instead
   *derives* `standoff = max(0.25, camera.three.near * 2.5)` so the two cannot drift.
8. **A component owns the controls config, because three things overwrite it today.**
   `OrbitMode.activateOrbitControls()` resets `minDistance = 1` / `maxDistance = 300` /
   `truckSpeed = 2` on **every** `mode.set()`; `Views2DList` open/close swaps `world.camera` for a
   whole new `CameraControls` instance; `GisLayer3d` already patches `maxDistance = 100000` behind
   everyone's back. So the component snapshots the baseline per controls instance, re-applies on
   `world.onCameraChanged` and on nav-mode/projection change, and restores on disable/dispose.
   Rejected patching once in `create-world.ts` (the first plan-view open silently kills the feature)
   and subclassing `OrbitMode`/`OrthoPerspectiveCamera` (robust against vendor resets, but forks
   vendor navigation code — the thing the clip-aware raycaster and ADR-0003 worked to avoid).
9. **Orbit mode only; clamp is perspective-only.** `_zoomInternal` (what the wheel maps to in
   orthographic) never consults `minDistance` at all, so ortho gets pivot + step scaling and no clamp
   — a limitation of the vendor, not a decision. **FirstPerson** is exempt by design (a walkthrough
   must pass through walls) and **Plan** mode is exempt (2D views, no orbit). Outside Orbit the
   component restores the baseline and idles.
10. **Always-on, no toggle.** Wired in `setup/index.ts` like the hoverer/highlighter — it is a
    navigation-feel fix, and the fly-through reads as a bug rather than a mode anyone would ask back.
    ⚠️ **Known limitation:** you can no longer wheel *into* a sealed volume (inside a closed duct, a
    room seen from outside); the escape hatches are FirstPerson mode or a section plane. Rejected a
    `ToolbarSettings` checkbox + `uiStore` field, and a persisted per-user preference (no other
    viewer preference is persisted today).

### Pivot indicator — the green dot

Nothing tells the user *what* the camera is bounded by. Same branch, same feature: a small green dot
at the anchor, shown while zooming and while rotating (reference screenshot: a ~7px olive dot sitting
on a soffit face).

11. **Context-sensitive anchor, because zoom and rotate do not share one.** The two coincide only
    after a click — scroll without clicking and the pivot is stale from an earlier click while zoom
    converges on the hovered face. So the dot marks **the hovered hit while zooming** (already
    raycast for the clamp, so it costs nothing extra) and **the pivot, `controls.getTarget()`, while
    rotating**. Each gesture's dot answers the question that gesture actually raises. Rejected
    always showing the true pivot (one meaning, zero raycasts — but while zooming with a stale pivot
    the dot floats in mid-air instead of on the element being approached, the opposite of
    reassuring) and always showing the hovered point (during a rotate the mouse is dragging, so the
    dot would slide across the model instead of marking the fixed point being orbited).
12. **A `CSS2DObject`, not WebGL — the renderer already drives one.** `OBF.PostproductionRenderer`
    extends the front package's `RendererWith2D`, which owns `three2D: CSS2DRenderer`; that is why
    `surface-measure-cursor`'s pill labels render at all. So a DOM dot needs **no render pass, no
    material, and no per-frame scaling** — a DOM element is screen-constant by nature and always
    drawn above the canvas. ⚠️ **Consequence, deliberate:** CSS2D has no depth test, so the dot
    shows *through* geometry — correct for a pivot indicator (Navisworks does the same), wrong if it
    were ever meant to read as on-surface paint. `pointer-events: none` is mandatory, and teardown
    must remove the element from the DOM (precedent: `surface-measure-cursor._disposeMeasurement`).
    Rejected generalising `GizmoAxis` (its overlay scene, clipping-suspended pass and `_scaleAt`
    screen-constant sizing are exactly right, and its own doc invites a second consumer — but it
    would need a non-axis shape path plus a dummy `follow` Object3D, all to re-earn what a `<div>`
    gets free) and an own `THREE` mesh in the main scene (`CursorSurface`-style, but that one is
    **world**-sized at a fixed 0.6 m radius, so it balloons up close and vanishes at distance; this
    would have to duplicate `_scaleAt` *and* would be subject to the renderer's clipping planes).
13. **⚠️ The wheel emits no `controlstart`/`controlend`, so the two gestures end differently.**
    Vendor footnote: *"`mouseButtons.wheel` … uses scroll-event internally, and scroll-event happens
    intermittently. That means 'start' and 'end' cannot be detected."* So **rotate** uses
    `controlstart` + `controls.currentAction === ACTION.ROTATE` and ends cleanly on `controlend`,
    while **zoom** shows on the wheel event `CursorZoom` already handles and ends on an idle timer.
    Detecting the action needs `CameraControls`' `ACTION` enum as a **runtime** import — `index.ts`
    currently imports the type only.
14. **Fade, don't blink: 80 ms in, 500 ms hold after the gesture, then out.** A fast scroll under an
    instant-hide rule reads as a rendering glitch rather than feedback, and the transition is free in
    CSS on a DOM node. Rejected instant hide (simplest state machine, blinks) and sticky-until-anchor-
    changes (closest to Navisworks with its orbit tool held, but leaves a permanent dot on the model
    during ordinary review, sitting under the measure tools' own cursors).
15. **Suppressed while `CursorSurface` is visible — one check, and it cannot rot.** Every
    cursor-owning tool already drives that shared guide: `ClipperPlacementManager`,
    `MeasureHoverManager` (Length + Area), `surface-measure-cursor`, `SpotCoordinate`, and
    `ViewportWrapper`'s align mode. So any future tool inherits the suppression for free. Rejected
    enumerating those components' `.enabled` flags (a list that rots the moment a seventh tool
    lands) and always showing the dot (two indicators fighting for the same pixels inside the measure
    cursor's disk). Needs a small `get visible()` on `CursorSurface` rather than consumers reaching
    into `.group.visible`.
16. **7px round dot, `var(--color-status-ok)`, 1px `rgba(0,0,0,.55)` ring + faint shadow.** The ring
    is load-bearing, not decoration: flat green loses its edge on a pale ceiling, and BIM models
    supply every background tone. The token is reachable because Tailwind v4's `@theme {}` in
    `style.css` emits `--color-status-ok` on `:root`, so no colour is hardcoded — unlike
    `pdfCompareUtils.ts`, which had to inline `[70,180,110]` with a `~ --color-status-ok` comment
    because canvas pixel work needs raw RGB. Rejected the flat ringless dot from the screenshot
    (washes out on similar-toned surfaces) and a dot-plus-outer-ring reticle (reads as a tool cursor
    and competes with `CursorSurface`'s disk).
17. **It is a manager inside `CursorZoom`, not a sibling component:**
    `CursorZoom/src/PivotMarker.ts`, constructed, driven and freed by `CursorZoom/index.ts` — the
    `ClipperCursor`/`MeasureCursor` idiom, and the repo's own rule that a component's `src/` means
    "managers the parent owns and frees". `CursorZoom` is the only thing that knows the anchor for
    both gestures, so ownership is genuinely exclusive. Rejected a registered
    `bim-components/PivotMarker/` sibling: `ToolbarFocus` and clash navigation could plausibly flash
    the pivot on jump, but nothing needs it today, and promoting it later is a file move. Rejected
    inlining it in `index.ts` — that file is already ~300 lines of camera math, and this is
    presentation.

### ⚠️ Correction — the click-pivot is reverted, and one premise was wrong

Reported symptom: **panning with right-click bounces the camera back.** Not model size — deterministic,
and caused by items 2/3 above. Two vendor facts were established by reading the library rather than
its docs, and the first invalidates a premise repeated throughout items 1–10:

18. **`update()` does NOT re-clamp the radius.** The *only* `minDistance`/`maxDistance` clamps in
    `camera-controls@3.1.2` are `dollyTo` (`camera-controls.module.js:1451`) and `_dollyInternal`
    (`:2501`). `setLookAt` writes `_sphericalEnd` directly (`:1740`) and is never clamped — which is
    why ViewCube and clash navigation never misbehaved. So the "safe to write mid-dolly because
    `update()` re-clamps every frame" reasoning is **wrong**; writing `minDistance` is safe for the
    simpler reason that it touches neither target nor position, and only affects the *next* dolly
    computation. The `Math.min(baseline, distance)` restore guard is therefore unnecessary rather
    than load-bearing (harmless, kept only as belt-and-braces).
19. **`setOrbitPoint()` is the sole cause of both bugs, so the click-pivot is deleted.** It calls
    `dollyTo(distance)` internally (`:1900`), which clamps against our raised `minDistance` **while
    computing the focal offset from the unclamped distance** — so clicking something 0.3 m away with
    a 3.2 m clamp standing yanked the camera backwards. Right-click made it obvious only because a
    pan follows. Second, quieter bug: `setOrbitPoint` works by **`setFocalOffset`**, and `setLookAt`
    never clears it (only `fitToSphere` does, `:1717`), so `view-cube.ts`, `ClashList.tsx` and
    `MiniMapCameraManager` would all have inherited a lateral shift — zero for a dead-centre click,
    up to half a view-width near the frame edge. **Reverted rather than fixed:** the alternative was
    releasing the clamp before pivoting *plus* zeroing the focal offset at four unrelated call
    sites, i.e. owning a vendor side effect across the whole camera surface. What survives is the
    clamp and the dot; what is lost is orbit-around-what-you-clicked — which `viewer.crais.io`, the
    reference the developer likes, does not do either. This deletes `_onPointerDown`,
    `_pivotOnHoveredSurface`, the pointerdown listener and `DOLLY_SETTLE_MS`.
20. **The clamp must be released when a burst ends, or it silently breaks Focus.** `fitToSphere`
    calls `dollyTo(distanceToFit)` (`:1708`), so a `minDistance` left standing at 3.2 m clamps
    `camera.fitToItems()` — press Focus on a small element after zooming in and it frames far too
    wide. Same for `Views2DList.applyPerspectivePlanCamera`. Release is on camera-controls' **`rest`**
    event (fires once damped motion drops below `restThreshold` 0.01, i.e. when the camera has
    stopped where the clamp put it) and goes to **`standoff`**, not the snapshot baseline — looser
    than both that and `OrbitMode`'s `1`, so it can never block a fit again. Rejected an idle timer
    after the last wheel event (can fire mid-glide, letting the camera slip past the standoff) and
    clearing the clamp at every other gesture's start (means guarding every present *and future* call
    site — exactly how this bug got in).
21. **The dot keeps marking the true pivot during a rotate, mid-air included.** With no click-pivot
    the target is usually wherever `fitToItems`/ViewCube left it — often the model centre, floating in
    space. Shown anyway, because that *is* what the camera spins around, and CSS2D's lack of depth
    testing keeps it visible through geometry, as Revit's and Navisworks' own pivot markers are.
    Rejected showing the dot only while zooming (drops half the request) and raycasting the hovered
    surface at rotate start (always lands on geometry, but the camera does not orbit that point — the
    dot would be lying).
22. **`smoothTime` 0.2 → 0.25, and that is the *only* tuning difference from crais.** Their published
    stack analysis lists `truckSpeed 2`, `dollySpeed 1`, `azimuth/polarRotateSpeed 1`,
    `draggingSmoothTime 0.125`, `restThreshold 0.01` — **every one of those is the camera-controls
    default**, which this app already has. `smoothTime` is the exception: the library defaults to
    0.25 and OBC's `newCameraControls` overrides it to 0.2. Note also that crais keeps `near = 1` and
    has neither a surface clamp nor a click-pivot, so "the camera feel they like" is close to stock
    OBC — worth remembering if the clamp is ever reported as strange too.
23. **Navigation-mode switching stays out of scope.** crais exposes Orbit/Fly/Drone; this app has
    OBC's Orbit/FirstPerson/Plan and no UI to switch (only projection, in `ToolbarSettings`). Its own
    branch: the switcher decides per-mode clamp behaviour and FirstPerson speed at building scale,
    and OBC has no drone mode at all (`addCustomNavigationMode` + key handling).

**Already promoted in the same change** — how it works: `docs/feature/bim-viewer.md` § Camera
navigation (cursor-bounded zoom + hover pivot), plus the near-plane entry under Gotchas; why, with
every rejected alternative above: `docs/adr/0004-cursor-bounded-navigation.md`. Items **1–17 are all
implemented** — the guide also covers the dot under § Camera navigation → The pivot dot. The ADR
stops at item 10 deliberately: nothing rejected for the indicator carries lasting cost, so the guide
alone is enough (per `docs/adr/README.md`, "skip the ADR when the guide alone is enough"). **Clear
this entry once the branch is merged.**

_No other decisions in flight._

⚠️ **The three entries above this one are already merged** (`75da737`/PR #10 for the clip-aware
raycaster, `2347cdf`/PR #9 for the measure cursors, `eb54f12` for the worker-side snapping) and the
guides have absorbed them — that part of the staging buffer is stale. Promoting and clearing those
three is its own job, deliberately not folded into this change. Only the navigation entry
immediately above is genuinely in flight.

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
