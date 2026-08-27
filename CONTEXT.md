# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

## Staged: viewport render/hover cost after the 3.4.8 bump (branch `perf/coalesce-viewport-renders`)

Two independent costs, found by live profiling a 60-model NTR1 scene. Both are **untested**
beyond `tsc`/build so far — the fps numbers below are the developer's measurements of the
*problem*, not of the fixes.

**Decision 1 — hover picks on settle, not on every move.** `hoverer.mode =
HovererMode.MOUSE_STOP`, unconditionally, in `setupHoverer`.

The bump changed this out from under us. At 3.4.2 the Hoverer had `delay = 100`: a ~50 ms
debounce before picking plus another 100 ms before the overlay. 3.4.4 deletes `delay`,
introduces `mode`, and defaults it to `MOUSE_MOVE` — continuous back-to-back picks — on the
stated reasoning that *"picking is fast enough that there's no reason to wait for the cursor to
settle"*. True for a demo scene; with 60 models, moving the mouse alone measured **50–60 fps →
25 fps**. Each pick is a GPU id pass plus a `readPixels` stall, and it bypasses the render
coalescer entirely because it never calls `renderer.update()`.

`MOUSE_STOP` settles for a **hardcoded, private 30 ms**, so this is *snappier* than the
behaviour it restores. There is no dial between the two modes.

- **Rejected — keep `MOUSE_MOVE`, throttle our side.** Gate the pick to one per frame or shrink
  the picker's scissor. Rejected: it fights a vendor default with app-side machinery, and the
  per-pick `readPixels` stall survives regardless.
- **Rejected — expose hover cadence as a user setting.** `ToolbarSettings` already has a hover
  **on/off** toggle (`handleToggleHoverer`), which is the escape hatch that matters; a second,
  subtler cadence control needs store state and a persistence decision (per user? per project?)
  to buy back 30 ms nobody can perceive.
- **Rejected — adapt the mode to scene weight.** Flip on model/mesh/draw-call count. Rejected:
  the threshold is unjustifiable, frame-time-driven switching needs hysteresis, and it makes
  hover behave differently between two projects for no articulable reason.
- **Safe because nothing consumes hover events.** Nothing in `src/` subscribes to the Hoverer's
  events, so the cadence change has no downstream reader. `MeasureHoverManager` runs its own
  `mousemove` raycast but only while a measure tool is active.

**Decision 2 — renders are coalesced to one per animation frame.** `setupRenderCoalescer` wraps
`renderer.update`, in `setup/index.ts` before anything that renders.

`RendererMode` defaults to `AUTO`, and this app never sets it, so `needsUpdate` is never read
and *every* `update()` call repaints. With the vendor rAF loop plus five camera-controls
listeners plus six cursor components on `pointermove`, profiling measured **2.96 renders per
frame** — the same framebuffer filled three times at ~3,558 draw calls each, 22.8 ms of a
34.9 ms frame. A live patch to one render per frame measured **27 → 40 fps**.

- **Deferred, not rejected — `RendererMode.MANUAL`.** The vendor's designed answer, one line,
  and it would kill idle rendering too (a static scene currently repaints 60×/s, ~7.84 ms each,
  ~half a core). Blocked on the fact that **nothing sets `needsUpdate`** — not this app, and not
  the vendor's own viewport components: upstream sets it almost exclusively in
  `TechnicalDrawings`, and `Hoverer` never does. MANUAL would therefore freeze vendor visuals
  (hover, outliner, measurement previews) as well as our ~12 scene-mutating components until
  something else happened to trigger a render. That is an audit, not a one-liner.
- **Rejected — "render the first call each frame, drop the rest".** The obvious shape, and
  wrong: it needs a per-frame flag reset, so correctness depends on whether our `rAF` callback
  runs before or after the vendor's. Lose that race and a legitimate render is dropped, halving
  the framerate. Deferring to a single scheduled render is order-independent — renders are
  merged, never skipped.
- **Also applied — `fragments.core.update()` no longer forced on camera move.** `force` means
  "finish all pending requests", so awaiting it on `controls.update` pinned the render loop to
  the worker queue draining on every camera event. 36 of the vendor's 37 examples wire that
  event as a bare `update()`; **none** force it.

**Known remaining ceiling (not addressed).** 60 models = 2,746 meshes, 1,188 unique materials,
zero `InstancedMesh`, 7.3M triangles. 100% CPU-bound on draw-call submission (~3 µs each):
rendering at 64×64 instead of 520×687 moved frame cost by 0.5 ms. Hiding half the models bought
27 → 34 fps. Fixing that means material dedup, not auto-loading all 60, or upstream instancing.

**Ruled out, so nobody re-chases them:** `dynamicAnchor` (existed at 3.4.2, defaults `false`,
binds only `pointerdown`); postproduction (~1 ms); BVH raycasting (already on); resolution,
shadows, textures; DOM size (507 nodes).

## Staged: guest demo mode is client-side only (branch `feat/guest-demo-mode`)

**Decision.** A guest gets **no Supabase session at all**. `AuthContext` carries an `isGuest`
flag in `sessionStorage`; `useProjects`/`useProject`/`useProjectMembers` short-circuit to a
hard-coded `DEMO_PROJECT_ROW` before any network call; the viewer loads `.frag` files from
`public/resources/demo/` as static assets. `/demo` is the single entry point, and its
`beforeLoad` guard performs the navigation, so the one-redirect-mechanism rule holds.

**Rejected — Supabase anonymous sign-in + `projects.is_demo` + RLS.** Fully planned and the
migration was written before being deleted. Three findings killed it, and they are worth
keeping because they are *pre-existing* risks that will resurface the day anyone enables
anonymous sign-ins:

1. **Anonymous users hold the `authenticated` Postgres role.** Any policy checking only the
   role (`auth.role() = 'authenticated'`, or `to authenticated` with no predicate) starts
   admitting guests the instant the dashboard switch is flipped — no policy edit, no error,
   nothing in the logs. This is why enabling the switch and shipping guest policies would have
   had to be one atomic change.
2. **`create_dummy_user` is a SECURITY DEFINER function in `public`**, called straight from the
   browser (`projectsService.addProjectMember`, `hubSettingsService`). Postgres grants EXECUTE
   to PUBLIC by default, so RPCs are not RLS-gated at all: today any registered user can mint
   `auth.users` rows; with anonymous sign-in on it becomes an unauthenticated endpoint.
3. **Possible self-promotion chain:** if `profiles` UPDATE lets a caller set their own
   `hub_role`, a guest becomes `hub_admin` and `is_hub_admin()` opens every policy in the
   database. Never verified — the Supabase MCP was unauthorised for that whole session.

None were confirmed against the database. `supabase/audits/guest_mode_preflight.sql` held the
read-only queries and was deleted with the migration; the queries survive in git history on
this branch and in the scrutiny above.

**Also worth knowing:** dev and production share one Supabase project
(`tbrnwnghjfkwnzsldfit` in both `.env.local` and the Cloudflare build variables), so there is
no staging database — a reason the zero-backend design won on risk alone.

**Verified in a production preview (2026-08-12):** `/demo` → guest session → model route,
8 demo `.frag` files auto-download (all HTTP 200) and render. Two bugs found and fixed by that
testing — see below. Open: the MODELS LIST panel shows 7 of the 8 on first paint and *which*
one is absent varies per run; all 8 fetch cleanly and no load error surfaces, so it looks like
a list-subscription race rather than a dropped model, but that is **not proven**.

**Bug found by testing: guest mode did not survive a page refresh.** A hard load of any
`/projects/*` URL bounced guests to `/login` even with the flag in `sessionStorage`. On a hard
load the router evaluates `beforeLoad` before `RouterProvider`'s context is wired
(`router.tsx` starts with `auth: undefined!`). A signed-in user self-heals because
`login.tsx`'s guard bounces them to `?redirect=`; a guest has nothing to bounce them back, so
they were stranded. Fix: `src/lib/guestSession.ts` owns the flag and the guards read it
**synchronously**, not only off `context.auth`. It lives in `lib/` because both `AuthContext`
and the route guards need it and features may not import one another.

## Staged: the viewport grid is off by default (same branch)

`create-world.ts` now sets `grid.config.visible = false`. Through `config`, not
`three.visible`: the config setter also drives the component's own setter, which
adds/removes the grid from the scene. `ToolbarSettings`' `useState` seed changed `true` →
`false` to match — the effect re-syncs from the live grid, but a mismatched seed makes the
checkbox read "on" for the first paint. `SimpleGrid.visible` reads `this.three.visible`, so
the toggle and the AR path share one flag; verified the checkbox reflects the new default and
still turns the grid on.

**Landmine fixed in passing:** `ArSession` hid the grid and restored it with
`visible = true` **unconditionally**. Harmless while the grid was always visible; with it off
by default, leaving AR would have switched on a grid the user never had. It now only takes
ownership of a grid that was actually showing.

**Rejected:** grid off for the guest demo only — it would push an `isGuest` check into
`bim-components/setup`, the OBC singleton layer CLAUDE.md keeps free of app state. **Also
rejected:** persisting the toggle to `localStorage` (as `AppShell` does for
`sidebarCollapsed`) — more useful, but wider than the ask; the choice still resets per reload.

**Promotion note:** this belongs in `docs/feature/bim-viewer.md` (a line under the world-setup
defaults), not an ADR — the rationale is thin and the rejected alternatives are recorded here.
Awaiting the developer's own test before promoting.

---

Last cleared 2026-08-08. Everything previously staged has been promoted:

| Was staged | How it works | Why |
|------------|--------------|-----|
| Clicking into a cut selects invisible geometry | `bim-viewer.md` § Picking (clip-aware raycasting) | [ADR-0007](docs/adr/0007-clip-aware-raycaster.md) |
| Measure cursors become their own components | `bim-viewport-righttoolbars.md` § Measure tools, § Cursor-family constructor typing | — (no lasting rejected alternative) |
| Measure lag: snapping moves to the FRAGS worker | `bim-viewport-righttoolbars.md` § Measure tools → Vertex snapping | [ADR-0003](docs/adr/0003-worker-side-snapping-over-cpu-picking-meshes.md) |
| Cursor-bounded navigation + the pivot dot | `bim-viewer.md` § Camera navigation, § The pivot dot | [ADR-0004](docs/adr/0004-cursor-bounded-navigation.md) |
| Section box | `bim-viewport-righttoolbars.md` § Section box, § GizmoAxis · § Sectionbox (button) | [ADR-0005](docs/adr/0005-section-box-outside-clipper.md) |
| Zoom dies once the camera parks | `bim-viewer.md` § Camera navigation | [ADR-0006](docs/adr/0006-zoom-pivot-reanchor.md) |
| Surface measure rebuilt on worker geometry | `bim-viewport-righttoolbars.md` § Surface: coplanar faces from worker geometry | [ADR-0008](docs/adr/0008-surface-measure-on-worker-geometry.md) |
| The section-plane gizmo moves to the plane's own frame | `bim-viewport-righttoolbars.md` § Section tool, § GizmoAxis | [ADR-0009](docs/adr/0009-section-plane-gizmo-local-frame.md) |
| Box and cut planes can't both crop; plane outlines fit the model | `bim-viewport-righttoolbars.md` § Sectioning interlock, § Section tool | [ADR-0010](docs/adr/0010-sectioning-arbiter-and-fitted-plane-outlines.md) |
| A cut plane is a clickable border band in the overlay | `bim-viewport-righttoolbars.md` § Section tool | [ADR-0011](docs/adr/0011-clickable-border-band-cut-planes.md) — supersedes ADR-0002 |
| Solid fills at the cut face | `bim-viewport-righttoolbars.md` § Fills at the cut | [ADR-0012](docs/adr/0012-section-fills-via-clipstyler.md) |
| The cut-plane gizmo spawns where you clicked and slides in-plane | `bim-viewport-righttoolbars.md` § Section tool, § GizmoAxis | [ADR-0013](docs/adr/0013-movable-cut-plane-gizmo.md) |
| A stale vendored FRAGS worker (⚠️ real, but **not** the cause of the displaced fills) | `bim-viewer.md` § Gotchas (version lock) · `bim-viewport-righttoolbars.md` § Fills → Vendor traps · `ar-webxr.md` | [ADR-0014](docs/adr/0014-frags-worker-from-node-modules.md) |
| Cut fills drawn detached from the model — FRAGS and OBC disagreeing on the base model | `bim-viewer.md` § Patterns & conventions (first load is serialised) | [ADR-0015](docs/adr/0015-one-base-model-for-coordination.md) |
| Performance + Scene Diagnostics rows in Viewport Settings | `bim-viewport-toolbars.md` § Settings → The two diagnostic rows | — (the probe that found ADR-0015, made permanent) |

**Cleared 2026-08-14** — the Room tab (`feat/room-view`), promoted to:

| Was staged | How it works | Why |
|------------|--------------|-----|
| The dead "Viewer" tab becomes a "Room" IFCSPACE browser | `bim-viewer.md` § Room browser (IFCSPACE) | — (the two decisions below carry the *why*) |
| A room is selected through the app's own select style, not a private one | `bim-viewer.md` § Room browser → Selection is the app's selection | [ADR-0016](docs/adr/0016-rooms-select-through-the-app-select-style.md) |
| The Room tab owns no visibility state — no hide, no ghost | `bim-viewer.md` § Room browser → The tab does not touch visibility | [ADR-0017](docs/adr/0017-room-tab-owns-no-visibility-state.md) |

⚠️ **Promoted one step early, deliberately.** The tab itself was tested against a real model on
2026-08-14 and works — list, storey grouping, selection, chips. Six later changes were **not**
retested before this promotion: no-zoom-on-row-click, the per-row zoom control, ctrl/cmd
multi-select, the `number  name` chip text, the ghost removal, and the panel following viewport
picks. The guide and both ADRs describe the code as it stands; if testing moves any of it, they
are what needs correcting.

**Still open, and not recorded anywhere else:** whether any *other* model in this project contains
`IFCSPACE` at all. Spaces are normally exported only by architectural models, so the structural,
MEP and eight demo `.frag` files may have none — which is why the empty state distinguishes "no
model loaded" from "no spaces in this model".

**Two things that were staged here are open questions, not decisions, and now live where they belong:**

- **A cut plane's band is fitted to *every* loaded model** — `boxer.addFromModels()` unions all of
  them, so a plane placed on one building spans the whole scene. Recorded as an open consequence in
  [ADR-0010](docs/adr/0010-sectioning-arbiter-and-fitted-plane-outlines.md) § Consequences, and
  flagged at the code in `bim-viewport-righttoolbars.md` § Section tool.
- **Two reproduction runs ADR-0014's mechanism does not explain** — moved into
  [ADR-0014](docs/adr/0014-frags-worker-from-node-modules.md) § Consequences as a table, together
  with the `?debugFills=1` probe's git location, so the next person to see a displaced fill starts
  from the evidence rather than the conclusion.

⚠️ **One block was deliberately *not* promoted.** The former navigation entry carried a
"Correction" section (items 18–23) proposing that the click-pivot be deleted and the clamp
released on `rest`. It was **never implemented** — verified against `CursorZoom/index.ts`
before clearing: `_onPointerDown`, `_pivotOnHoveredSurface`, `DOLLY_SETTLE_MS` and the
`setOrbitPoint` call were all still live, and `smoothTime` was never changed from the vendor's
`0.2`. Its two genuine vendor findings — that `setLookAt` is never clamped, and that
`setOrbitPoint` yanks via `dollyTo` and leaks a focal offset — survive in ADR-0006, which
records the whole five-attempt history of that bug. The rest was a rejected proposal and is
gone with this file.

---

## Staged: Fragments rebind on projection change (branch `fix/fragments-rebind-on-projection-change`)

**Untested beyond `tsc`, eslint and a production build.** The measurements below are the
developer's instrumentation of the *bug* (draw calls / indices per frame, sampled off the
viewport's WebGL context on the live deployment), not of the fix.

**The bug.** Switching Camera Projection to Orthographic froze the Fragments LOD/streaming
engine outright: draw counts stayed bit-for-bit constant across a 10-tick zoom
(491 calls / 573,088 indices → 491 / 573,334), where Perspective at the same framings went
491/573k → 229/129k. Entering Ortho from a far-away Perspective view left the building a
hollow grey shell at any zoom (197 / 83,719 — the far-away LOD, forever).

**Decision — subscribe to `camera.projection.onChanged` in `fragments-manager.ts`, and re-point
that subscription whenever `world.camera` is replaced.**

`world.onCameraChanged` fires only from `World.set camera(...)`. `ProjectionManager.set()` swaps
`camera.three` and triggers its *own* `onChanged` — so `model.useCamera()` was never re-called and
Fragments kept evaluating the perspective camera parked where it stood at switch time. `controls`'
`"update"` still fired, so `core.update()` ran every frame against a camera that never moved; hence
the perfectly constant counts.

- **Rejected — the single line `camera.projection.onChanged.add(rebindCamera)` at setup.** This is
  what the bug report proposed, and it fixes the toolbar toggle only. `projection` belongs to the
  *camera*: `OBC.Views.open()` assigns a brand-new `OrthoPerspectiveCamera` to the world, and
  `Views2DList.applyPerspectivePlanCamera` then calls `projection.set("Perspective")` on *that*
  camera. A bootstrap-time subscription is left listening to a `ProjectionManager` nobody drives.
  Hence `watchProjection()`, called from `onCameraChange` as well as at setup.
- **Rejected — call the rebind from the callers.** `ToolbarSettings.handleProjectionSelect` and
  `applyPerspectivePlanCamera` both already know they changed projection, so each could notify
  Fragments directly. Rejected: it makes correctness depend on every future `projection.set()`
  caller remembering, and it would put BIM-engine wiring in a React component. The fix belongs on
  the listening side, in the one file that owns the fragments↔camera relationship.
- **Rejected — read `world.camera.three` inside the handler** instead of taking the event payload.
  It happens to work, because `OrthoPerspectiveCamera` assigns `three` from its own listener on the
  same event, registered in its constructor and therefore ahead of ours. Nothing guarantees that
  ordering, and the payload is right there.

**`update(true)` is forced here on purpose**, and does not contradict the ⚠️ never-force note on
`onControlsUpdate` directly below it: that warning is about the continuous `controls "update"`
event. A projection switch is a discrete state change — the same class as a model load.

**Not fixed, deliberately, and not recorded anywhere else yet:**

- **`controls "update"` is bound to the bootstrap camera's controls only.** Every `OBC.View` owns
  its own `CameraControls`, so inside a 2D view that listener is attached to an inactive camera.
  The vendor partly covers it — `Views.open()` adds its own `"rest"` handler — so plan views update
  on settle rather than continuously.
- **The production bundle appears to contain `@thatopen/components` twice** (two `ProjectionManager`
  and two `World` class identities). Duplicate identities can make `components.get(...)` hand back an
  instance other than the expected one. Low confidence, unrelated to this bug, build-config territory.
- **Ortho → Perspective visibly jumps framing.** `ProjectionManager.matchOrthoDistanceEnabled` is the
  knob if that is not wanted; it defaults to `false` and nothing in `src/` sets it.

---

## Staged: the PostRender tab (branch `feat/post-render-tab`)

**Nothing implemented yet — this is the grilled plan, recorded before code.** The ask was "a
PostRender tab, exactly like the `PostproductionRenderer` tutorial". The first finding is that
**the tutorial's setup half already shipped**: `create-world.ts` builds the world with
`OBF.PostproductionRenderer`, a transparent background, an `OrthoPerspectiveCamera` and a grid,
and `setupHighlighter` already sets `postproduction.enabled = true` and wires `OBF.Outliner` to
the Highlighter's select events. What is actually new is **the control panel** — so "exactly like
this" is read as *the tutorial's panel, driving the live viewer*, not as the tutorial's demo.

**Decision — the tab is a runtime override surface over the real world, nothing more.** A right
`RightPanel` (~400 px, as the GIS tab), mounted only while the tab is active, holding five
`PanelSection`s: General, Edges, Selection outline, Gloss, Ambient Occlusion. Values live in
local `useState` seeded from the live passes on mount — the `ToolbarSettings` idiom, engine as
source of truth — so re-opening the tab re-seeds from reality and nothing persists across a
reload. Row primitives (slider/toggle/colour/select) are pure props-only components local to
`features/post-render/`, not promoted to `components/ui/` until a second consumer exists.

- **Rejected — a faithful sandbox reproduction** (own world + renderer, `school_arq.frag` off the
  ThatOpen CDN, stats.js, the green excluded cube). Verbatim fidelity, and it would stand up a
  *second WebGL context* beside the main viewport — the exact cost the AR tab was moved to a
  standalone `/ar` page to avoid — while touching none of the user's own model.
- **Rejected — fold the controls into the `ToolbarSettings` dropdown** (which already owns grid,
  projection, hover-highlight, auto-rotate). Right neighbourhood, wrong container: ~25 sliders do
  not fit a 240 px dropdown.
- **Rejected — `uiStore` + `localStorage`, and per-project settings in Supabase.** Both are more
  useful than a per-session panel; both are wider than the ask. Persisting needs a
  re-apply-on-bootstrap path and puts engine parameters in a store CLAUDE.md reserves for
  UI/modal/layout state; per-project needs a migration, a service and Query wiring.

**Decision — the "Manual mode" section is not ported.** The tutorial exposes `renderer.mode =
RendererMode.MANUAL`, `manualModeDelay`, `turnOffOnManualMode` and `manualDefaultStyle`. MANUAL is
recorded above as **deferred, not rejected**, and the blocker has not moved: *nothing* sets
`needsUpdate` — not this app's scene-mutating components, and not the vendor's own (`Hoverer`
never does). A checkbox there is a user-reachable path into frozen hover, outliner and measure
previews, and MANUAL layered over `setupRenderCoalescer`'s deferred `update` is an untested
combination on top. Manual mode is a render-loop *strategy*, not a look.

**Consequence — `updateIfManualMode()` is dead code here and is not ported either.** In `AUTO`
every `update()` repaints, and the coalescer already guarantees exactly one render per frame, so
every control is visible on the next frame with no explicit render call. Two more tutorial lines
are already-settled no-ops: `world.dynamicAnchor = false` (ruled out above — it defaults `false`
at this version) and stats.js (`ToolbarSettings` → Performance already owns that, via
`viewport-diagnostics/PerformanceOverlay`).

**Decision — the Outline section is labelled "Selection outline" and carries a Reset.** Not
cosmetic naming: the 3.4.4 typings document `Outliner.color/thickness/fillColor/fillOpacity` as
delegates to `SimpleOutlinePass`'s **`"default"` group**, which is exactly what `setupHighlighter`
configures (`#bcf124`, fill `0.3`) and binds to selection. Those four sliders therefore retune
every selection in the app, on every tab, globally. Reset restores the `setupHighlighter` values
so a fill-opacity-to-zero cannot silently kill the selection affordance. The tutorial's own
`outliner.addItems({ wall1, wall2 })` demo call is dropped — it fakes a selection the user never
made.

**Decision — the master "Postproduction enabled" toggle is disabled while a viewport tool is
active.** `postproduction.enabled` already has an owner: `ViewportRightToolbar` snapshots it into
`fxBaselineRef` and forces it `false` for as long as `activeTool !== "select"`, restoring the
snapshot on exit. The panel reading `activeTool` from `bimStore` and greying the toggle out (with
a line of copy saying why) makes a write impossible exactly while the other owner holds the flag,
so the arbiter's snapshot is always the user's own value. Without that gate the checkbox lies —
open the tab mid-Measure and it reads "off", which is suppression, not a setting; turn it on and
leaving Measure restores the stale snapshot over the top.

- **Rejected — lift `fxBaselineRef` into `bimStore` so both write through one owner.** The clean
  end state, and the same shape [ADR-0017](docs/adr/0017-room-tab-owns-no-visibility-state.md)
  called "cleaner while there were two owners, and moot with one". Rejected for the same reason:
  it edits shipped, working code as a side effect of an unrelated feature, and the gate removes
  the conflict instead of refereeing it.
- **Rejected — omit the master toggle.** No second owner at all, at the cost of the General
  section's headline control.

**Decision — no `bim-components/setup/` edits.** The tab is panel-only; bootstrap defaults are
untouched. **Observation logged instead of fixed:** the tutorial does
`postproduction.basePass.isolatedMaterials.push(grid.material)` and **nothing in `src/` touches
`isolatedMaterials`**, so our grid runs through AO and edge detection. Latent today only because
`create-world.ts` ships the grid hidden — turn it on in Viewport Settings and it is shaded as
geometry. A one-line fix, deliberately left for its own change rather than riding along in a tab.

**Also rejected — picking a house look now** (a default style preset plus tuned AO in
`create-world.ts`, with the panel as the override). Changes how the app looks for every user on
every tab; that is a design decision, not a tab.

**No API gap.** Installed `@thatopen/components-front@3.4.4` exposes the whole surface the
tutorial uses — `glossPass`/`glossEnabled`, `defaultAoParameters`, `excludedObjectsPass`,
`smaaEnabled`, `style`, `PostproductionAspect`, `EdgeDetectionPassMode`, and `edgesPass`'s
`width`/`color`/`mode`. One asymmetry: `aoPass.updatePdMaterial(pdParameters)` has **no
read-back** — `GTAOPass` exposes no getter for the poisson-denoise params, which is why the
tutorial keeps them in a plain local object. Those seven values must live in app state or they
cannot be displayed at all; everything else seeds off the pass.

**Decision — the "Excluded objects enabled" toggle is not ported either.** `ExcludedObjectsPass`
renders only materials registered through `addExcludedMaterial`, and **nothing in `src/` ever
calls it** — the tutorial's only registration is the demo cube's material, which is also dropped.
A toggle that provably cannot change a pixel reads as a broken control and invites someone to
"fix" it. General therefore ships four controls: Postproduction enabled, Outlines enabled, SMAA
enabled, Style. Whoever first needs an object exempted from the effects starts at
`postproduction.excludedObjectsPass.addExcludedMaterial(...)`.

**Decision — the tab ships a preset, applied once per world, not per mount.** `PRESET` in
`PostRenderPanel` is the developer's reference look: `COLOR_PEN_SHADOWS`, outlines + SMAA on,
gloss off, edges `1.1` at `#1a1a1a` in `DEFAULT` mode, AO screen-space with blend `0.7` /
radius `0.3` / **distanceExponent `2`** / thickness `1.5`, and the selection outline at
**fill `0.85`** / thickness `3`. Two values fight the vendor deliberately: `distanceExponent 2`
against `5.7`, which collapses AO into a hairline contact seam instead of the broad soft shading
in window reveals and under balcony slabs; and fill `0.85` against `setupHighlighter`'s `0.3`,
which reads as a pale wash over light surfaces rather than the solid green of the reference.

Applied through a `WeakSet` keyed on the `Postproduction` instance, so it lands the **first time
the view opens on a given world** and never again: tune a slider, leave the tab, come back, and
your tweaks survive. A reload builds a new world and starts from the preset. A `Restore preset`
button in General is the way back, and it is the only reset for the Edges / Gloss / AO sections.

- **`enabled` is not in the preset.** It is co-owned by `ViewportRightToolbar` during tool
  suppression, and a mount-time write could land inside that window and fight the arbiter's
  snapshot. `setupHighlighter` already turns postproduction on.
- **AO parameters are written before the style.** The vendor's style setter itself pushes
  `defaultAoParameters` into the material when the style leaves `PEN_SHADOWS`; explicit
  `updateGtaoMaterial`/`updatePdMaterial` calls after it cover every other transition.
- **Rejected (for now) — the preset as a `create-world.ts` bootstrap default.** That is what makes
  the look appear app-wide on first paint instead of after one visit to the tab, and it is the
  natural promotion once the numbers are confirmed against a real model. Held back because it
  changes the app's appearance for every user on every tab, and because the numbers are still
  eyeball estimates from a screenshot.
- **Known consequence:** the world is shared, so opening the PostRender tab changes the look on
  every other tab too, and leaving does not restore anything. That is the intent ("set this as
  the default"), but it means the Models tab renders differently before and after a visit here.

---

## Staged: camera response tuned against crais (branch `feat/post-render-tab`)

**Untested beyond `tsc`, eslint and a production build.** Rode along on the PostRender branch
because the developer asked for it mid-review; it is an independent change and could be split.

**Where the numbers came from.** https://viewer.crais.io — three r184 + `camera-controls`, no
`@thatopen` anywhere in its bundle (no `OrthoPerspectiveCamera`, no postproduction), so its camera
layer is the *same library* OBC wraps and its config is directly portable. Read out of the minified
bundle: shared base `smoothTime: 0.15`, `draggingSmoothTime: 0.05`, `restThreshold: 0.0025`,
`dollyToCursor: true`, `dollyDragInverted: false`, `boundaryFriction: 0`; four per-mode presets
(`orbit` / `fly` / `screenpan` / `pan`) carrying their own `minDistance`, `maxDistance`,
`dollySpeed`, `truckSpeed` and rotate speeds, two of which set `minDistance === maxDistance` — the
`camera-controls` idiom for look-around modes, where the pivot is pinned a fixed distance ahead so
rotate becomes "look" and truck becomes "walk". Empirically 10 wheel ticks barely moved their
camera, matching the orbit preset's `dollySpeed: 0.5`.

**Decision — port the three that are pure response, in a new `setup/src/camera-response.ts`.**
`smoothTime 0.2 → 0.15`, `draggingSmoothTime 0.125 → 0.05` (the library default OBC never
changes; this is the one that makes an orbit *follow* the cursor instead of catching up with it),
`dollySpeed 1 → 0.5`. Applied per camera and re-applied on `world.onCameraChanged`, for exactly
the reason `applyCameraDepthRange` already documents: every `OBC.View` builds its own
`OrthoPerspectiveCamera`, hence its own `CameraControls`. `dollyToCursor` needed nothing — it is
already `true` via the OBC default.

**`CursorZoom`'s `DOLLY_SETTLE_MS` became `DOLLY_SETTLE_FACTOR`.** It was a flat `300 ms`,
hand-derived from `smoothTime = 0.2` plus slack, and its doc comment said so. With `smoothTime`
now `0.15` that constant would hold the pivot re-anchor back for a dolly that finished 75 ms
earlier, so it now reads `controls.smoothTime * 1000 * 1.5` off the live controls. Not cosmetic:
the gate exists because a re-anchor landing mid-dolly sends `dollyToCursor`'s `lerpRatio` to ~9
and lurches the camera (ADR-0006).

- **Deferred — the navigation-mode system.** A mode switcher with per-mode presets, per-mode
  mouse-button mappings and locked-distance walk/look modes. This is where most of "it feels like
  a different app" actually lives, and it is a feature, not a tuning pass.
- **Rejected — `infinityDolly: true` with `minDistance: 1`,** which is how crais's camera dollies
  forever by pushing the target ahead of itself. That is the exact flag `CursorZoom` turns *off* on
  purpose: with it on, `minDistance` is dead config and cursor-bounded navigation cannot exist at
  all ([ADR-0004](docs/adr/0004-cursor-bounded-navigation.md), with the five-attempt bug history in
  [ADR-0006](docs/adr/0006-zoom-pivot-reanchor.md)). Copying that half of the feel is a decision to
  reverse two ADRs, not a value to change — and it means accepting fly-through.
- **Not established:** which of crais's four presets is its default mode, and its mouse-button
  mapping — that part of the bundle is string-table obfuscated.

---

## Staged: the Realistic tab (branch `feat/realistic-view`)

**Nothing implemented — the grilled plan, recorded before code.** The ask was a "Realisti" tab
rendering the project like three.js's `webgl_lightprobes_sponza` example. Label ships as
**"Realistic"** (the typed spelling was a slip).

**The example cannot run here, and this is the finding everything else follows from.** It imports
`three/addons/lighting/LightProbeGrid.js` and `helpers/LightProbeGridHelper.js`; our
`three@0.182.0` ships `examples/jsm/lighting/` containing only `TiledLighting.js`. Available at
0.182: `LightProbe` (single SH probe), `LightProbeGenerator`, `PMREMGenerator`, `RoomEnvironment`,
`Sky`, `FirstPersonControls`, ACES tone mapping.

**Decision — reproduce the look with 0.182 primitives; no version bump.** Sky + `HemisphereLight`
carrying sky/ground colour + a shadow-casting `DirectionalLight` sun + ACES tone mapping with
exposure, and postproduction switched to `COLOR_SHADOWS` so the vendor's existing AO pass supplies
contact shading while pen edges stay off.

- **Rejected — bump three to get `LightProbeGrid`.** *Not* blocked by ThatOpen: installed peer deps
  are `three: ">=0.182.0"` across `components@3.4.8`, `components-front@3.4.4` and
  `fragments@3.4.7`, and crais runs r184. Rejected on two counts. First, it moves the version the
  whole BIM stack was built against, including the vendored FRAGS worker ([ADR-0014](docs/adr/0014-frags-worker-from-node-modules.md))
  and a `@types/three` already 26 versions stale at 0.156.0. Second and decisively, **the bake is
  unaffordable regardless**: the demo's 10×7×7 grid is 490 probes × 6 faces = 2,940 scene renders
  *per bounce*, and this scene is 2,746 meshes / 1,188 materials / 7.3M triangles, 100% CPU-bound
  on draw-call submission at ~3 µs each — small cubemaps do not help, because rendering at 64×64
  instead of 520×687 moved frame cost by 0.5 ms. That is ~30 s of blocked main thread per bake, and
  the demo re-bakes on every slider change. Getting the feature would not make it usable.
- **Rejected — a standalone `/realistic` route with its own renderer**, as AR did. Cleanest
  isolation, but it still needs the version answer and would have to solve getting fragment
  geometry into a second context — doubling VRAM for 7.3M triangles.

**Decision — no material changes, which caps what "realistic" can mean.** Fragments builds mostly
`MeshLambertMaterial`, and `WebGLRenderer` assigns `materialProperties.environment =
material.isMeshStandardMaterial ? scene.environment : null` — so **image-based lighting never
reaches this geometry**. Non-standard materials also resolve env maps through `cubemaps` rather than
`cubeuvmaps`, so a PMREM texture is the wrong input for them. What Lambert *does* honour: ambient,
hemisphere and directional lights, shadow maps, and renderer tone mapping. Hence the rig above.

- **Rejected — swap the material pool to `MeshStandardMaterial` while the tab is active.** The only
  route to a true PBR look. It mutates `fragments.core.models.materials.list` in place — the same
  shared pool `ToolbarGhost` mutates, which [ADR-0017](docs/adr/0017-room-tab-owns-no-visibility-state.md)
  exists because of — and ~1,188 new materials means ~1,188 shader program compiles, i.e. a
  multi-second stall on tab entry.
- **Rejected — `envMap` per Lambert material.** Cheaper, still mutates the shared pool, and reads as
  a faint mirror rather than soft irradiance for the `cubemaps` reason above.

**Decision — the state lives only while the tab is open.** `RealisticView` follows `RoomView`'s
shape (`OBC.Component implements OBC.Disposable`, static uuid, activated/deactivated by a feature
hook as `useRooms` does), snapshotting renderer + scene + light state on activate and restoring it
on deactivate. This is a performance requirement, not taste: leaving a shadow pass enabled globally
would slow every other tab on a scene already at 27–40 fps. Accepted cost: a second save/restore
owner over shared globals, so it needs an explicit interlock with the PostRender preset and
`ViewportRightToolbar`'s FX baseline.

- **Rejected — become the app's look, as the PostRender preset does.** Simpler ownership, but it
  leaves the shadow pass running everywhere, and postproduction's pen styles actively contradict
  photorealism. **Also rejected — a full viewport takeover** (hide toolbars, disable selection):
  clearest mental model, largest UI change, and it removes measure/section while previewing.

**Decision — `shadowMap.autoUpdate = false`.** Shadow maps live in *light* space, so orbiting the
camera cannot invalidate them; `needsUpdate` is set only when a model loads, tiles stream, or the
sun moves. The demo pays for a full shadow render every frame for nothing — on this scene that is
roughly a doubled frame cost, straight back into the range `setupRenderCoalescer` exists to rescue.
Per-mesh `castShadow`/`receiveShadow` must be applied as LOD tiles appear: nothing in `src/` sets
those today, and tiles are created and destroyed continuously. The hook is `model.tiles.onItemSet` /
`onItemDeleted`, which is exactly what `Outliner.bindModelTileEvents` subscribes to — copy its
per-model unsubscribe map so the listeners cannot leak.

**Decision — the camera is untouched.** No `FirstPersonControls`, no walk mode. The tab changes
lighting and rendering only, so the just-tuned damping and cursor-bounded zoom keep working and no
second owner appears over `minDistance`/`infinityDolly`.

- **Deferred — walk mode via `camera-controls` locked distance** (`minDistance === maxDistance`,
  crais's own idiom). Attractive because it needs no second controls object, but `CursorZoom`
  already writes both fields, so it is an interlock, not a setting.
- **Rejected — `FirstPersonControls` as in the demo.** Would mean disabling camera-controls,
  `CursorZoom` and `PivotMarker` for the tab's lifetime, and it has no collision and flies at
  constant height, so you walk through walls.

**Tone mapping does survive postproduction** — verified, not assumed: the vendor composes three's
own `OutputPass`, which reads `renderer.toneMapping`/`toneMappingExposure` and recompiles on change.
⚠️ One trap: `_outputPass` is composed for every style **except `PEN`**, where tone mapping silently
does nothing.

**Consequence — the row primitives get promoted to `components/ui/`.** `RealisticPanel` needs the
sliders/toggles that currently live in `features/post-render/PostRenderControls.tsx`, and CLAUDE.md
forbids a feature importing another feature. The second consumer we said would justify promotion has
arrived.

## Staged: the house look is the app default, not a PostRender-tab side effect (branch `feat/default-render-preset`)

The PostRender preset became the world's boot state. Everything below is **planned, not tested** —
`applyPreset`'s values are the shipped ones with two edge changes the developer made live in the
panel (`#6b6b6b` → `#323232`, `GLOBAL` → `DEFAULT (with LODs)`).

**Decision 1 — the preset lives in `setup/src/postproduction.ts`, applied right after
`setupHighlighter`.** Not in `create-world.ts`, which was the first instinct and is the right
folder but the wrong moment: `PostproductionRenderer._postproduction` only exists once the
renderer has a `currentWorld`, and every pass getter throws (`"Edge detection pass not
initialized"`) until `initialize()` runs — which happens from exactly one place, the
`set enabled` setter, on the first `true`. In this app that first `true` is `setupHighlighter`.
`initialize()` also reads `currentWorld.camera.three`, and `create-world.ts` assigns the camera
*after* the renderer.

- **Rejected — bottom of `create-world.ts`.** Would need to force `enabled = true` ourselves to
  trigger `initialize()`, pre-empting `setupHighlighter` on a flag `ViewportRightToolbar` also
  snapshots during tool suppression (the ADR-0017 hazard). And the outliner half of the preset
  would still have to live elsewhere, since the `Outliner` is created in `setupHighlighter`.
- **Rejected — fold it into `highlighter.ts`.** Both halves in one existing file, no new bootstrap
  line, but that file's job is selection wiring and `PostRenderPanel` importing the render look
  from `highlighter.ts` reads wrong.
- **Rejected — apply it from `ModelsView` per tab.** Engine state driven by a view; the look would
  exist only inside `ModelsView` and would fight `RealisticView`'s own snapshot/restore on tab
  flips.

**Decision 2 — `setupHighlighter` stops setting the outliner's appearance.** It keeps
`outliner.world`, `outliner.enabled` and the `onHighlight`/`onClear` bindings; the four appearance
lines go, because the preset writes the same four properties moments later. One writer, one
constant, and the panel's "Reset outline to preset" now resets to what the app actually booted
with. The values themselves are unchanged from what `setupHighlighter` had (`#bcf124`,
`fillOpacity 0.30`); `0.85` was tried in the preset and reverted — a near-solid fill reads as a
flat green blob over the element instead of tinting it.

**Decision 3 — GIS opts out by style, for as long as `GisPanel` is mounted.** `useGisRenderMode`
in `features/gis/` snapshots `postproduction.style`, sets `COLOR`, restores on cleanup. `GisPanel`
renders only on the GIS tab, so mount/unmount *is* the tab boundary. The conflict is real, not
theoretical: `GisLayer3d` adds its Google/OSM tile groups straight into `world.scene.three`, so
streamed photogrammetry goes through the same edge-detection pass as the model.

- **Rejected — `ExcludedObjectsPass`.** The surgical answer on paper, and unusable here: it
  excludes by *material* (`addExcludedMaterial`) and `3d-tiles-renderer` mints a new material per
  streamed tile, so there is no stable list to register.
- **Rejected — force `postproduction.enabled = false` on GIS.** Kills edges, AO and SMAA in one
  move, but makes the GIS hook a second owner of the flag `ViewportRightToolbar` suppresses tools
  with, and drops the selection outliner, which needs postproduction on.
- **Rejected — drive it off `GisLayer3d.enabled` instead of the tab.** Truer to intent (the BIM
  model would keep its edges until tiles are switched on) but needs a change event `GisLayers`
  does not have, and moves the transition to a mid-session moment with no visible boundary.
- **Rejected — an `activate`/`deactivate` API on `GisLayers`.** The `RealisticView` shape, but
  that component exists because its rig is large; a two-field snapshot does not earn a public
  engine API used by one panel.

**Decision 4 — `RealisticView` is left alone.** Its `activate` already swaps `style` to
`COLOR_SHADOWS`, which removes the visible half of the preset (pen edges). It now inherits the
preset's AO (`radius 0.5`, `distanceExponent 1`, `blendIntensity 1`) instead of the vendor
defaults, which is a normal render combination — sun shadows plus contact AO. Deferred, not
rejected: widening `_baseline` with the AO block, if testing shows the AO reads too heavy against
real daylight shadows. Not written blind.

**AR needed nothing.** `/ar/$projectId` renders `ArModelViewer` and never calls
`setupComponents`, so there is no OBC world and no `PostproductionRenderer` on that page.

**⚠️ Untested, and the one thing to watch: `EdgeDetectionPassMode.DEFAULT`.** The shipped preset
chose `GLOBAL` deliberately — it skips LOD geometry, which is both fewer lines at building scale
and the faster path on a heavy scene. `DEFAULT` is now what every tab pays on a 60-model project.
The screenshot it came from is the developer's own live tuning, so it stands until measured
otherwise.
