# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

---

**Cleared 2026-08-28.** Everything staged from PRs #21/22 through #36 has been promoted. All of it
was merged to `main` before promotion, per the "implemented **+ merged**" rule in
`docs/adr/README.md`.

| Was staged | How it works | Why |
|------------|--------------|-----|
| Hover picked on every mouse move; the same frame rendered ~3× | `bim-viewer.md` § Render loop and hover cadence | [ADR-0020](docs/adr/0020-one-render-per-frame-and-hover-on-settle.md) |
| A public demo with no account | `backend.md` § Guest demo mode (+ the anonymous-sign-in warning) | [ADR-0021](docs/adr/0021-guest-demo-mode-is-client-side-only.md) |
| Orthographic froze the Fragments LOD/streaming engine | `bim-viewer.md` § Fragments and the camera | [ADR-0022](docs/adr/0022-fragments-rebind-on-projection-change.md) |
| Camera damping and wheel stride retuned against a reference viewer | `bim-viewer.md` § Camera navigation | [ADR-0023](docs/adr/0023-camera-response-ported-from-crais.md) |
| The Realistic tab, and why it cannot be the three.js light-probe demo | `bim-viewer.md` § Realistic tab | [ADR-0024](docs/adr/0024-realistic-view-on-three-0182-primitives.md) |
| The house look became boot state; GIS opts out by style | `bim-viewer.md` § Postproduction and the house look | [ADR-0025](docs/adr/0025-house-look-is-the-boot-preset.md) |
| The Realistic tab leaked a white sky under StrictMode | `bim-viewer.md` § Gotchas (async activate) | [ADR-0026](docs/adr/0026-async-activate-needs-an-ownership-token.md) |
| A configurable viewport background | `bim-viewport-toolbars.md` § Settings → Background | [ADR-0027](docs/adr/0027-viewport-background-painted-in-css.md) |
| The PostRender tab — a runtime override surface, not a sandbox | `bim-viewer.md` § PostRender tab | — (its rejections live in ADR-0020 and ADR-0025) |
| The viewport grid is off by default | `bim-viewer.md` § Patterns & conventions | — (rationale thin; the `ArSession` landmine is recorded at the guide) |
| VW-01 — the model goes black-wireframe as the camera pulls back | `bim-viewer.md` § Gotchas — **not a defect**, `LodMode.DEFAULT` by design | — |

⚠️ **One correction made during promotion.** Several staged entries above were written before their
branch was tested and still said "planned, not tested" or "nothing implemented yet". All were
verified against the merged code before being promoted, and the guides describe the code as it
stands rather than as the plan predicted.

---

## Staged: first section plane silently fails to place (branch `fix/viewer-defects-phase-1`)

⚠️ **Untested — `tsc` and a production build pass, nothing more.** This is the only reason it is
still here rather than in a guide. Do not promote until the developer confirms it in the app.

**Symptom.** Right after a model load, "Add plane" arms, you click the model, the panel closes —
and no plane is created. No console output, nothing shown. Retrying the same spot two or three
times eventually works. Ordinary click-to-select is unaffected throughout. Confirmed by the
developer: **only the first plane misfires**; once one plane exists, adding more is reliable.

**Root cause — a 3.4.8 behaviour change our code never caught up with.**
`OBC.SimpleRaycaster.castRay` is no longer a worker raycast. It is now a **GPU pick**:
`FastModelPickers.get(world).getFullPick(position)`, three render+readback passes (id, depth,
normal). It composes them like this:

```js
const item   = await this.getItemAt(position);    // id pass, then AWAITS a worker round-trip
const point  = await this.getPointAt(position);   // re-renders the scene, reads depth
const normal = await this.getNormalAt(position);  // re-renders the scene, reads the normal
return { ...item, point, normal, distance };      // normal may be null — the pick still "succeeds"
```

Across that worker await the scene keeps streaming: tiles arrive, LODs swap. If the pixel under
the cursor changes in that window, `getNormalAt` returns `null` — and `getFullPick` **returns the
hit anyway, with no normal**. (`getPointAt` returning null is the second failure mode: then
`getFullPick` returns null outright.) Right after a load is when tile churn peaks, which is why
the bug clusters there and why a retry is a coin flip.

`ClipperPlacementManager._surfaceOf` then discards the hit: it accepts `result.normal`, else falls
back to `result.face && result.object` — but **`FRAGS.RaycastResult` has no `face` field at all**,
so that branch is dead code for every fragment hit. Null surface → `exit()` → no plane, no message.
Selection survives because `Highlighter` only consumes the id pass.

Why *only the first* plane: `ClipAwareRaycaster` takes the vendor fast path only while
`renderer.clippingPlanes` is empty. From the first plane onward it runs its own
`_nearestVisibleFragment` → `model.raycastAll` → a real face normal, every time.

⚠️ **`_vendor/engine_components` (3.4.2) is actively misleading here** — it still shows the old
`fragments.raycast(...)` shape. `clip-aware-raycaster.ts`'s own ⚠️ note predicted this exact
hazard; this is it landing.

**Decision 1 — `requireNormal` opts out of the vendor fast path, in `ClipAwareRaycaster`.**
`castRay({ requireNormal: true })` changes only the early-return guard, so the pick goes down
`_nearestVisibleFragment`, which already exists, already clip-filters, and already yields real
face normals. `ClipperPlacementManager` passes it on both its hover and click raycasts.

- **Why not a surgical fallback on the fast path** (keep the GPU pick, re-pick that one model
  through the worker to borrow a normal): new code, covers only the missing-normal case and not
  the null-`getPointAt` one, and it mixes a GPU depth point with a worker face normal — which can
  disagree across an LOD swap, the very event that caused the miss.
- **Why not guarantee a normal on every `castRay`:** `Hoverer` picks on every settle, and
  [ADR-0020](docs/adr/0020-one-render-per-frame-and-hover-on-settle.md) exists precisely because
  that cost matters. An opt-in flag keeps hover-only consumers at zero cost.
- **Why not raycast the worker directly from `ClipperCursor`:** it would bypass clip filtering,
  and `clip-aware-raycaster.ts` names plane placement by name as a consumer that would otherwise
  place planes on geometry a cut has already removed.
- **Why not drop the GPU fast path entirely:** one code path and no flag, but it surrenders the
  hover optimisation the fast path exists for.
- **Accepted cost:** placement's hover pass gets heavier at zero planes. This is exactly the cost
  it already pays from the first plane onward, so it is proven acceptable rather than speculative.

**Decision 2 — the UX defects around it are filed, not fixed.** Deliberately out of scope, on the
developer's call, to keep the diff to the actual bug:

- A genuine miss still exits placement silently (`.finally(() => this.exit())` fires on every
  outcome, and the click chain has no `.catch`, so a throw inside `onPlace` exits the same way).
- `ToolbarClip`'s `document`-level `mousedown` click-outside handler closes the panel on the very
  click that places, so every plane needs the panel reopened. These two are coupled: "stay armed
  on a miss" is incoherent while the only *Placing (ESC to cancel)* affordance is inside a panel
  that just closed.

**Decision 3 — `ClipperPlacementManager` imports the `ClipAwareRaycaster` type from the module,
not the barrel.** `Raycasters.get()` is typed to the base `SimpleRaycaster`, whose `castRay` does
not carry the new flag, so the getter has to be typed to the subclass. ⚠️ **`setup/index.ts`
imports `../ClipperCursor`, so a value import through `../../setup` would close a cycle.** The
import is therefore `import type … from "../../setup/src/clip-aware-raycaster"` — type-only, so it
is erased at build and cannot form a runtime cycle, and narrow, so that stays true if someone later
drops the `type`.

- **Rejected — a local structural type.** Redeclaring the widened `castRay` shape inside
  `ClipperPlacementManager` avoids the import, but duplicates a contract with nothing to catch the
  two drifting apart.
- **Rejected — promote `ClipAwareRaycaster` to its own `bim-components/` folder.** Better layering
  — the raycaster stops being bootstrap-private — but it is a refactor opened by a bug fix, and the
  coupling it removes is one type import.

**Known-latent, same root cause, not touched.** Four other components derive a normal from
`castRay` and take the GPU fast path at zero planes, so all four can intermittently lose it:
`MeasureHoverManager`, `SpotCoordinate`, `SurfaceMeasureEngine`, and `ViewportWrapper`'s align
mode. Each is a one-line `requireNormal: true` once this shape is proven.

**Decision 4 — postproduction is no longer suppressed while a right-rail tool is active.**
`ViewportRightToolbar` snapshotted and killed `Hoverer`, `Outliner` *and* `postproduction` whenever
`activeTool !== "select"`. The first two stay; postproduction comes out of the list.

Raised by the developer as "why does the Model Render change when I use the sectioning tool" —
which it did, visibly, the instant *Add plane* was pressed.

The original reasoning was that all three are redundant while `CursorSurface` owns the cursor.
That holds for hover and outline, which are *selection affordances*. It does not transfer to
postproduction, which is *how the model looks* — and for sectioning it is actively backwards, since
element edges are what tell you which face you are about to cut. It also bought nothing: `activeTool`
holds a non-select value only while a tool is armed (`ClipperCursor` returns to `"select"` the moment
a placement resolves), so the sole visible effect was a flat-render flash per plane placed, and the
per-frame pass it "saved" is already paid throughout select mode.

- **Rejected — make it a Viewport Setting.** A toggle for a behaviour whose correct value is "on"
  is a setting nobody will find a reason to change.
- **Rejected — suppress it for the measure tools but not for clip.** Per-tool exceptions to a
  blanket rule are how the rule became wrong in the first place.
- ⚠️ **Known consequence:** VW-04 below is now visible **during** placement as well. This exposes
  nothing new — postproduction is on in select mode, so VW-04 was already on screen the rest of the
  time. If it reads worse while placing, VW-04 is the thing to fix, not this.
- **Separable from decisions 1–3.** Different file, different symptom, no shared code. Split it onto
  its own branch if the placement fix needs to land alone.

⚠️ **Two promoted docs describe the *old* behaviour and must be corrected when decision 4 lands:**
`bim-viewer.md` § Gotchas (the snapshot-and-restore line naming `postproduction.enabled`) and
`bim-viewer.md` § PostRender tab (the master toggle is gated on `activeTool` precisely because the
right rail co-owns that flag — with decision 4 the gate protects nothing and should probably go).
Both correctly describe `main` today, which is why they were promoted as-is.

⚠️ **The bug report artifact that opened this (`Section Plane Misfire`, 28 Aug 2026) is wrong.**
It blames `castRay()` reading "the hover pass's cached hit". The fallback is really OBC's `Mouse`,
updated on every canvas `pointermove` — so for a human, the cached position *is* the click point.
Its Trial C ("plane landed on the hovered point, ignored the click") is the signature of a browser
agent dispatching synthetic clicks that emit no `pointermove`. Its evidence table does not
describe the reported bug; keep the symptom, discard the diagnosis.

---

## Open, from the viewer-defect report — no decision yet, so nothing to promote

VW-01 was resolved (not a defect) and is now a gotcha in `bim-viewer.md`. VW-03 and the Phase-1
gizmo work shipped as [ADR-0019](docs/adr/0019-grab-volume-tracks-the-drawn-arrow.md). These two
remain open investigations:

- **VW-04 — the cut clips surfaces but not edges.** The report's stated cause (*"add `clippingPlanes`
  to the `LineBasicMaterial`"*) **does not apply here**: element edges are not line geometry at all,
  they come from `OBF.EdgeDetectionPass`, a screen-space pass, whose `_overrideMaterial` is built with
  `clipping: true` and the full `clipping_planes_*` chunks in both shaders. `LodMaterial` likewise sets
  `clipping = true`. Both documented paths *should* clip, so the mechanism is still unknown. Top
  surviving hypothesis: `EdgeDetectionPass.setMaterialToMesh` **skips `isLODGeometry` tiles**, so in
  `edgeMode: DEFAULT` LOD tiles take a different path — which would make VW-04 and VW-01 one root
  cause. **The test needs no code:** the PostRender tab already exposes a live *Edge mode* dropdown
  (`Default (with LODs)` / `Global (faster)`); flip it to Global and re-drag a plane. Note that
  [ADR-0025](docs/adr/0025-house-look-is-the-boot-preset.md) made `DEFAULT` the app-wide boot value,
  so this is what every tab pays today.
- **VW-02 — `byteLength` of undefined thrown inside `WebGLRenderer.render`, 56× at load.** **Could not
  be reproduced.** A Playwright probe drove a real login and model load against the exact project from
  the report (`522b15bc…`, 2524_VOCO, 6 fragments, 25.6 MB largest) in two environments: headless on
  the Vite dev server, and **headed real-GPU Chrome on the production `vite preview` bundle**. Zero
  uncaught throws, zero console errors, zero failed requests in both.
  - ⚠️ **The transport hypothesis is positively ruled out** — the report's own "not yet checked" item.
    Every fragment response was `200 application/octet-stream` at its full expected length; no
    truncation, no 4xx, no `requestfailed`.
  - What that leaves: the report ran against deployed bundle `index-Rd-bU4Mi.js` in the developer's own
    Chrome (with extensions — it captured extension message-port errors too). Either the throw is
    environment-specific, or it is already gone. Needs a repro in that browser before any code moves;
    guarding it is not available to us in any case, since we do not own `WebGLAttributes`.
  - The probe and its production-preview Playwright config are **not committed** (Phase 0 was specified
    as instrumentation only). They are kept at `/tmp/bimboy-phase0/` with both run logs, and are worth
    promoting to a real load-error regression spec if VW-02 ever reproduces.
