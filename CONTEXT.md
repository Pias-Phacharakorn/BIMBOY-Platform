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
