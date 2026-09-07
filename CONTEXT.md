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

---

## Staged: IFCSpace visibility checkbox in Viewport Settings (grilled 2026-08-28, not yet implemented)

⚠️ **Nothing written yet.** Design only, settled in a `/grill-with-docs` session. No code, no
guide edits, no ADR file until the developer has tested it.

**Requirement.** A checkbox labelled **IFCSpace** in the viewport Settings dropdown. Ticked shows
`IFCSPACE` geometry, unticked hides it. Default unticked on every ModelsView tab — *except* the
Room tab, where spaces must be visible.

### The rule

`uiStore` holds two booleans and nothing else:

| Field | Meaning |
|---|---|
| `showIfcSpaces` | the **user's preference**. Default `false`. Only the checkbox writes it |
| `ifcSpacesForced` | "some tab requires spaces visible". Written by the hook from `isRoomTab` |

Effective value is **derived**, never stored: `effective = showIfcSpaces || ifcSpacesForced`.
Leaving the Room tab therefore needs no restore step — the derivation just re-evaluates. On the
Room tab the checkbox renders **checked and disabled** with a hint; the preference underneath is
untouched, so leaving returns to whatever the user had.

### ⚠️ The rule only ever hides. It never shows.

This asymmetry is the load-bearing part.

- **Standing rule** — runs on mount and on model load. If `effective === false`, `hider.set(false,
  spacesMap)`. If `effective === true`, **it does nothing at all.**
- **Transitions** — apply once, both directions. `false → true` (tick the box, or enter the Room
  tab) does `hider.set(true, spacesMap)`; `true → false` does `hider.set(false, spacesMap)`.

A symmetric rule is the obvious implementation and it destroys `Isolate`: on the Room tab
(`effective === true`) the user isolates one room, the rule next fires and re-shows every space.
Same for `Hide`. Hide-only lets the checkbox coexist with the visibility toolbar instead of
refereeing it.

**Show All re-asserts.** `ToolbarVisibility.handleShowAll` calls the hook's re-assert after
`hider.set(true)`, so with the box unticked Show All shows everything *except* spaces. Without
this, "hidden by default" dies on the first Show All. Accepted cost: a user who has forgotten the
setting gets no clue but the checkbox.

`SmartViews` also calls `hider.set(true)` in `reset()`/`apply()`, but it has **no React consumer** —
the "Smart Views" tab renders a bare viewport — so it is not a live conflict. It becomes one the
day that tab is built.

### Placement

- **Logic:** `features/ifc-space-visibility/useIfcSpaceVisibility.ts`, called once from
  `ModelsView` as `useIfcSpaceVisibility(isRoomTab)` — the hook writes `ifcSpacesForced` itself, so
  `ModelsView` gains one line. It owns a per-model cache of space ids and an ownership token
  (the query is async per model; a tab switch or second load mid-flight can land a stale result —
  [ADR-0026](docs/adr/0026-async-activate-needs-an-ownership-token.md)). Re-query debounced 400 ms
  on `fragments.list.onItemSet`/`onItemDeleted`, the `Views2DList`/`RoomView` value.
- **Not** a `bim-components/` class: it owns a `Map` and a counter, both fine in refs, and an OBC
  component may not read React state — the store would have to be pushed in, giving a component
  *plus* a hook to drive it for no gain.
- **Not** inside `ToolbarSettings.tsx`: `components/` is props-and-Tailwind-only. That file already
  breaks the rule comprehensively, but consistency with a violation is not a reason to extend it.
- **UI:** `ToolbarSettings` reads both flags — `checked = showIfcSpaces || ifcSpacesForced`,
  `disabled = ifcSpacesForced` — and knows nothing about `Hider`.

### Scope

- **Category = `IFCSPACE` only.** `IFCZONE` is an `IfcGroup` with no geometry to hide;
  `IFCSPATIALZONE` is vanishingly rare here. Keeping it to `IFCSPACE` makes the hidden set exactly
  the set `RoomView.listRooms` enumerates.
- ⚠️ **Viewport-only — the Drawing Editor is deliberately not filtered.** `DrawingEditorSetup`
  builds projections from `model.getItemsIdsWithGeometry()`, which ignores visibility, so a plan
  drawn with spaces hidden still contains every space outline. Known gap, not a bug: the control
  lives in *Viewport* Settings and `Hider` **is** viewport visibility. Filtering the projection
  would put a `uiStore` read inside `bim-components/` (forbidden) and would silently answer a
  separate product question — architects often *want* room boundaries on a plan.
- `uiStore` has no `persist` middleware, so the preference resets to `false` on every reload. That
  is the requirement, for free.
- `hider.set()` already calls `fragments.core.update(true)` internally. No manual update.

### Alternatives rejected

- **Symmetric show/hide standing rule** — see above; destroys `Isolate`/`Hide`.
- **Auto-toggle the preference on entering the Room tab** — needs a saved "what it was before"
  value that must survive tab thrash, model loads and unmount. That is the exact hazard shape
  [ADR-0017](docs/adr/0017-room-tab-owns-no-visibility-state.md) and
  [ADR-0026](docs/adr/0026-async-activate-needs-an-ownership-token.md) were both written about. It
  also leaves the checkbox writable on the Room tab, so a user can hide the very rooms the panel is
  listing.
- **One-shot toggle, no re-assertion** — the checkbox becomes a button pretending to be a state,
  and "default hidden" is defeated by the first model load or Show All.
- **Lift `activeTab` into `uiStore`** — the general fix, and arguably what CLAUDE.md's state table
  wants, but a real refactor (`ModelsView`, `WorkspaceHeader`) for this feature, and it invites
  every future component to couple to literal tab names. `ifcSpacesForced` keeps the coupling
  semantic: a second tab needing spaces sets the same flag rather than growing an `||`.
- **Model-wide filter reaching the Drawing Editor** — see Scope.

### Docs plan (only after the developer confirms it works)

1. **New ADR-0028** — *IFCSpace visibility is a hide-only derived rule.* Carries the four
   rejections above.
2. **ADR-0017 amended, not superseded** — status `Accepted — § "The tab does not touch visibility"
   amended by ADR-0028`, a note that the core decision stands in full (no ghost, no isolation, the
   user still presses Ghost), and a forward pointer on that passage. `RoomView` needs no code
   change: the tab contributes one boolean to a rule owned elsewhere.
3. `bim-viewport-toolbars.md` § Settings — the checkbox, the hide-only asymmetry, the Show All
   interaction.
4. `bim-viewer.md` § Room browser — forced-visible on the tab, and the Drawing Editor gap.

### Incidental fix in the same branch

`setup/index.ts:108` and `ModelsView.tsx:125` both still claim `RoomView` ghosts the model.
ADR-0017 removed the ghost. They mislead about precisely the thing being changed here.

---

## Staged: Realistic owns its own Gloss and AO (grilled 2026-08-28, not yet implemented)

⚠️ **Nothing written yet.** Design only, settled in a `/grill-with-docs` session. No code, no guide
edits, no ADR file until the developer has tested it.

**Requirement.** The PostRender and Realistic tabs must not share Gloss and Ambient Occlusion
settings. Realistic gets its own copy of both, tunable independently.

This is [ADR-0025](docs/adr/0025-house-look-is-the-boot-preset.md) § Consequences being cashed in —
it recorded *"widening its `_baseline` with the AO block […] Deferred, not rejected […] Not written
blind."* Gloss was not anticipated there.

### The rule

There is exactly **one** set of passes: `world.renderer.postproduction` is a singleton, and
`glossPass` / `aoPass` / `defaultAoParameters` are engine state. "Not shared" therefore means
**snapshot-and-restore**, which `RealisticView` already does for `style` — the only reason the
Realistic tab does not permanently corrupt the house look today.

`RealisticView.Baseline` widens to carry `glossEnabled`, the six gloss numbers, a **copy** of
`defaultAoParameters`, and `aoPass.blendIntensity`. `activate` snapshots and writes Realistic's
values; `deactivate` restores the snapshot exactly. Tabs are mutually exclusive in `ModelsView`, so
only one panel is ever mounted and there is no concurrent-writer case.

| Decision | Choice |
|---|---|
| PostRender's Gloss/AO | **kept** — AO is part of the boot preset every other tab renders with; removing the controls would make the house look untunable |
| Realistic's values | **remembered** across tab flips, in `RealisticView._settings` — matches sun/sky, which already survive `deactivate` |
| PD denoise (7 sliders) | **excluded** from Realistic — stays global |
| AO seed | `POSTPRODUCTION_PRESET.ao` verbatim, **except `aoBlend` `1 → 0.5`** |
| Gloss seed | vendor shader defaults, **except `minGloss` `-0.12 → 0`**; `glossEnabled: false` |
| Settings shape | nested `ao` / `gloss` blocks + dedicated `updateAo()` / `updateGloss()` |
| Reset | two buttons — *Reset daylight* (sun/sky/exposure, unchanged scope) and a new *Reset render* (gloss + AO) |

### Why the two seed deviations, and only those two

Both are corrections that can be justified *before* looking at a render. Everything else is the
house value, so the developer tunes from a known baseline in step 4 and the result is baked into the
constant before any doc is written — the same loop that produced `POSTPRODUCTION_PRESET`.

- **`aoBlend` `1 → 0.5`.** ADR-0025 chose `1` because *"anything less is invisible against this
  scene's ambient light"*, and `create-world.ts` runs ambient at `1.5`. `RealisticView.activate`
  drops ambient to **`0.15`** — a factor of ten — and adds real shadow maps. Blend `1` there is AO
  doubling up on sun shadows, exactly the *"reads too heavy against real daylight shadows"* case the
  ADR flagged.
- **`minGloss` `-0.12 → 0`.** ⚠️ `minGloss` is not a gloss floor, it is a **global darkening offset
  applied wherever gloss is absent.** `GlossPass`'s fragment shader clamps `gloss = max(gloss,
  0.001)`, so a zero-gloss pixel evaluates to `normalize(vec3(0.001)) * minGloss` ≈ `0.577 * minGloss`
  per channel, added to the scene colour. At the vendor's `-0.12` that is a flat **−0.069 on every
  channel** of every low-gloss pixel — **including the entire sky**, which contributes nothing to the
  gloss buffer (see the trap below). Against a daylight image that is already dark by design, that
  reads as a bug and would cost a tuning round to trace.

### Vendor traps found while grilling — none of them documented upstream

1. ⚠️ **Gloss is camera-relative, not light-relative.** `projected-normal-material.ts` computes
   `dot(vNormal, normalize(cameraPosition - vPosition))` and takes **no light direction at all**. It
   is a fresnel sheen keyed to viewing angle, *not* a specular highlight — it will not track the sun.
   This is why it is worth having on Realistic (material sheen) but is not "sun glint".
2. ⚠️ **The sky contributes nothing to the gloss buffer.** `GlossPass.render` sets
   `scene.overrideMaterial`, and `getProjectedNormalMaterial()` declares no `side`, so it defaults to
   `FrontSide`; three.js `overrideMaterial` replaces `side` too. `Sky.js` is `side: BackSide` and the
   camera is inside a 450 km sphere, so its faces are culled. `basePass.isolatedMaterials` does not
   help — that is a `BasePass` concept and `GlossPass` never consults it. Hence trap 3 below hitting
   the sky hardest.
3. ⚠️ **Gloss costs a full extra scene render every frame.** `GlossPass.render` does
   `renderer.render(this.renderScene, this.renderCamera)` into its own buffer. Unlike Realistic's
   shadow map — pinned to `autoUpdate = false` in `_applySettings` precisely so orbiting is free —
   this pays on every frame, in a scene ADR-0024 notes is CPU-bound on draw-call submission. **This
   is why `glossEnabled` defaults to `false`**: nobody pays for a pass they did not ask for.
4. ⚠️ **`set glossEnabled` re-runs the style setter** (`this.style = this._style`). Toggling gloss
   rebuilds the entire composer chain, and the style setter pushes `defaultAoParameters` into the AO
   material when the style leaves `PEN_SHADOWS`. Gloss and AO are therefore **not** independent
   writes at the vendor level, whatever the UI suggests.
5. `COLOR_SHADOWS` — the style `RealisticView` installs — **does** add the gloss pass, before the AO
   pass. Worth confirming: `PEN` and `PEN_SHADOWS` omit `_glossPass` entirely, so gloss on the wrong
   style would be a silent no-op.

### Implementation constraints — consequences of the above, not open questions

- **`Baseline` must copy the AO block, not reference it.** `defaultAoParameters` is mutated in place
  (`postproduction.defaultAoParameters[key] = value`), so a stored reference would "restore" the very
  values it was meant to undo.
- **Order is load-bearing in both directions.** `activate` writes the AO block into
  `defaultAoParameters` **before** touching `glossEnabled` or `style` — otherwise trap 4 pushes the
  *old* AO into the material. `deactivate` restores AO, then gloss, then style.
- **`deactivate` must call `updateGtaoMaterial` explicitly.** The style setter's re-push only fires
  when leaving `PEN_SHADOWS`, and Realistic sits at `COLOR_SHADOWS`, so restoring `style` will not do
  it. `aoPass.blendIntensity` is likewise untouched by the style setter and must be restored by hand.
  Both rules are what `applyPostproductionPreset` already follows.
- **All writes stay inside the `_generation` guard.** `activate` is async and StrictMode makes the
  cancelled-activate path normal, not rare —
  [ADR-0026](docs/adr/0026-async-activate-needs-an-ownership-token.md).
- **`update()` stays sun-only.** Writing 14 pass values on every azimuth drag is waste; `updateAo` /
  `updateGloss` write only their own block, and the initial write happens once at `activate`.

### Placement

- **Engine:** `bim-components/RealisticView/index.ts` — widened `Baseline`, widened
  `RealisticSettings` / `REALISTIC_DEFAULTS`, new `updateAo()` / `updateGloss()`. Types reused from
  `setup/src/postproduction.ts` (`AoParameters`, `aoPassOf`), not re-declared.
- **Hook:** `useRealisticView` returns `updateAo` / `updateGloss` alongside `update`.
- **UI:** two new `PanelSection`s in `RealisticPanel` — **Gloss** (`icon="APPLY"`) and **Ambient
  occlusion** (`icon="TRANSPARENT"`), both `defaultOpen={false}`, below Sun and Sky & exposure, so the
  daylight controls stay the visible ones. Icons and collapsed treatment match `PostRenderPanel`.
- **Nothing in `postproduction.ts` changes**, and `PostRenderPanel` is untouched.

### Alternatives rejected

- **Move Gloss/AO to Realistic, off PostRender.** Breaks the house look: AO *is* part of
  `POSTPRODUCTION_PRESET` ([ADR-0025](docs/adr/0025-house-look-is-the-boot-preset.md)), which every
  non-Realistic tab renders with. You would be tuning the daylight look and hoping the flat one
  followed.
- **Inherit-and-forget** — Realistic starts from the live house values each visit, tuning dies on tab
  exit. Rejected because `deactivate` already does *not* clear `_settings` (sun angles survive a tab
  flip today), so one panel would have two memory rules; and AO tuned for daylight would have to be
  re-entered every visit.
- **Give Realistic the PD sliders, restoring `PD_DEFAULTS` on exit.** Data loss wearing a feature's
  clothes: it silently discards whatever the user tuned in PostRender.
- **Give Realistic the PD sliders, backed by a shadow record in `postproduction.ts`.** The
  technically correct version of "include", and it would fix a real existing drift —
  `PostRenderPanel.readState` seeds `pd: { ...PD_DEFAULTS }` on every mount, so tuning PD, leaving the
  tab and returning shows defaults while the engine holds the tuned values. Rejected **for this
  branch only**: PD is a denoiser for the AO buffer, not a look, so the visual payoff for changing
  shared bootstrap code is close to nil. ⚠️ **Accepted consequence: PD stays genuinely shared between
  the two tabs**, and the PostRender read-back drift stays unfixed. Worth its own change.
- **A flat `RealisticSettings`** (`aoRadius`, `glossMinGloss`, …) so the existing shallow
  `{ ...this._settings, ...next }` stays correct. Rejected: it discards `AoParameters`, which is
  derived from the vendor type, and needs a hand-rolled re-assembly layer before `updateGtaoMaterial`
  can consume it — with nothing to catch the two drifting apart.
- **One `update()` with a deep merge for the two object keys.** Hides the hazard instead of removing
  it: shallow for six keys and deep for two is a footgun for whoever adds the ninth. ⚠️ The hazard is
  real — with nested blocks, the current shallow spread would let `update({ ao: { radius: 0.3 } })`
  type-check while wiping every sibling AO field at runtime.
- **One reset button covering everything.** Sun and exposure get moved constantly; AO and gloss get
  set once. A single button costs the AO tuning every time you want the sun back. The split also
  matches `PostRenderPanel`, which already separates *Restore preset* from *Reset outline to preset*.
- **Hand-picked daylight values for the whole block.** Rejected as writing blind — the thing ADR-0025
  explicitly refused. The house preset itself came from the developer's live tuning against a real
  model; that is step 4, not step 3.

### Docs plan (only after the developer confirms it works)

1. **New ADR — *Realistic owns its own gloss and AO*.** Carries the rejections above and the five
   vendor traps. ⚠️ **Number not yet assigned:** the staged IFCSpace entry above has already claimed
   **ADR-0028**, so whichever branch merges first takes it and this becomes **0029**. Fix at
   promotion time.
2. **[ADR-0025](docs/adr/0025-house-look-is-the-boot-preset.md) amended, not superseded** — its
   *"`RealisticView` is left alone […] Deferred, not rejected"* Consequences bullet gains a forward
   pointer to the new ADR. The boot-preset decision itself stands in full.
3. `bim-viewer.md` § Realistic tab — the widened baseline, the two new sections, the two seed
   deviations and why, and the per-frame cost of gloss.
4. `bim-viewer.md` § PostRender tab — one line that PD is the only render setting still shared with
   the Realistic tab, and that its read-back drift is known.

### Open, deliberately

The gloss and AO numbers above are a **starting point, not a claim.** Step 4 is where the developer
tunes them against a real model in daylight; the values landed on get baked into `REALISTIC_DEFAULTS`
before any of the docs plan is executed. Where testing and this entry disagree, this entry is wrong.

---

## Staged: full-screen viewport toggle (branch `feat/viewport-fullscreen`)

⚠️ **Nothing implemented yet — this is the grilled design only.** Promote to
`bim-viewport-toolbars.md` (+ an ADR for the `fullscreenchange` decision) only after the developer
confirms it in the app.

**Goal.** A button in `ViewportToolbar` that takes the model viewport full-screen — hiding the app's
own chrome (`Sidebar`, `WorkspaceHeader`) *and* entering browser fullscreen.

### What the codebase already had

- `uiStore.sidebarCollapsed` / `setSidebarCollapsed` are **declared and dead** — nothing reads or
  writes them. `AppShell` keeps its own `useState` + `localStorage("sidebarCollapsed")` instead.
  Left alone deliberately: cleaning it up is unrelated to this feature, and the new flag is a
  different concept, not a reuse of that one.
- `appIcons.EXPAND` (`eva:expand-fill`) existed and was unused.
- `create-world.ts` binds `viewport.addEventListener("resize", resizeWorld)` on the `<bim-viewport>`
  element, so the renderer should follow the size change with no new code. **Assumption, untested.**

### Decisions

| # | Decision | Rejected, and why |
|---|----------|-------------------|
| 1 | **Both** app-chrome hiding *and* the browser Fullscreen API — not either alone | In-page maximise alone leaves browser chrome; browser-fullscreen alone leaves the app's own frame |
| 2 | `requestFullscreen()` targets **`document.documentElement`** | Fullscreening the viewport `<section>` breaks portalled modals — `BackgroundSettingsModal` and `CloudModelLoadingModal` portal to `document.body`, which is not a descendant of a fullscreened `<section>`, so the browser refuses to render them. Settings → Background from the very toolbar this button joins would open onto nothing. Fixing that means re-parenting the portals into this feature's element — the modals would have to learn about fullscreen |
| 3 | **One flag, and `fullscreenchange` is its only writer.** The button calls `requestFullscreen`/`exitFullscreen` and writes nothing | Two independent flags strand the user: Esc returns browser chrome but leaves `Sidebar`/`WorkspaceHeader` hidden, with the exit affordance to hunt for. **Listening for the Escape *key* was also rejected** — `ClipperPlacementManager` binds a lifetime-long global `window` keydown for Escape, and four modals bind their own; a fifth would make Esc during plane placement cancel the placement *and* exit fullscreen. The browser raises `fullscreenchange` for Esc itself, so Esc-to-exit is free and conflict-free |
| 4 | Hides **only** `Sidebar` + `WorkspaceHeader`. `LeftPanel`/`RightPanel` untouched | Collapsing the panels too needs restore-on-exit, but `LeftPanel` owns `isOpen` *and* a dragged `width` in local `useState` — restoring means lifting that into the store or overriding by prop. Not restoring silently discards a width the user dragged. Their collapsed rails stay reachable in fullscreen anyway, so "model only" is already two clicks away |
| 5 | **Session-only** — no `localStorage`, and `ModelsView` exits fullscreen on unmount | Persisting is not merely unwanted but impossible to honour: `requestFullscreen()` needs a user gesture, so a restored flag on boot would hide chrome with no fullscreen — decision 3's stranded state, on every reload. Global persistence across routes would leave a header-less Settings page with no `ViewportToolbar` to escape from |
| 6 | New `COLLAPSE: "eva:collapse-fill"` icon; the glyph swaps, *and* the active styling from `ToolbarGhost` is kept | Tinting one glyph (the `ToolbarGhost` precedent) reads fine while the app frame is there to orient you. Fullscreen deletes that frame — the toolbar is the only chrome left — so the exit affordance should not rest on a colour difference |

### Accepted consequence

If `requestFullscreen()` is rejected (iframe without `allow="fullscreen"`, browser policy), the
chrome never hides either — the button no-ops rather than half-works. Chosen over falling back to
in-page maximise, which would reintroduce the state decision 3 exists to prevent.

### Untested assumptions

1. That `<bim-viewport>`'s resize event fires on the layout change and `world.renderer.resize()`
   follows. If it does not, the canvas keeps its old aspect and the model appears stretched.
2. That `LeftPanel`/`RightPanel` reflow correctly when the flex row gains the sidebar's width.

---

## IOT tab — device list + data panel (phase 1, mock data)

⚠️ **Nothing implemented yet — this is the grilled design only.** Promote to `bim-viewer.md`
(the tab wiring) and `frontend.md` (the provider/feature shape), plus an ADR for the
provider-interface decision, only after the developer confirms it in the app.

**Goal.** An `IOT` tab in `ModelsView`: left panel lists IoT devices and clicking one flies the
camera to the element it is bound to; right panel charts that device's recent readings.

### What the codebase already had

- `camera.fitToItems(items?: ModelIdMap)` — installed typings, `@thatopen/components` `3.4.8`.
  Zoom-to-device needs no bounding-box math. `Views2DList` documents that it routes through
  `controls.fitToSphere`, so it **preserves view direction** rather than snapping to a canned angle.
- `getLocalIdsByGuids(guids)` / `getGuidsByLocalIds(localIds)` — installed `@thatopen/fragments`
  typings. GUID↔localId is a first-class vendor call, not something to hand-roll.
- `RoomView` enumerates every `IFCSPACE` across all loaded models via
  `getItemsOfCategories([/^IFCSPACE$/])` and tracks selection as `{modelId, localId}` — the same
  `ModelIdMap` shape `fitToItems` consumes.
- **`ViewportWrapper` is mounted in exactly one place in the whole app** (`ModelsView`). The OBC
  world is a singleton; this is not incidental.
- **No charting library is installed.** **Supabase Realtime is used nowhere** — the only
  `subscribe()` in the app is `onAuthStateChange`.
- `ClashList` is *not* a precedent for zoom-to-element: it replays a **stored BCF camera**
  (position/target/up in UTM, converted to local). Different mechanism, not needed here.

### Decisions

| # | Decision | Rejected, and why |
|---|----------|-------------------|
| 1 | **Spatially bound**, not a flat dashboard | A charts-only IoT page is a worse Power BI, and the Power BI tab already exists. Putting the value *on the element* is the only thing this app can do that Grafana cannot |
| 2 | A **tab in `ModelsView`**, not a new sidebar workspace | A second viewport-owning view means a second `ViewportWrapper` against a singleton world — the described layout already *is* `isFlexLayout` (left panel / viewport / right panel), so this is one string in `workspaceTabs`. A sidebar entry later should navigate to `/model` with the tab preselected, never stand up a rival viewport |
| 3 | A **narrow provider interface** — `listDevices` / `getLatest` / `getHistory` — with a mock behind it | There is no real IoT source yet. Designing a schema around an unseen payload is how this feature dies; any real platform can satisfy these three methods, so the transport decision is **deferred, not guessed** |
| 4 | **No `ifcGuid` on the `Device` type** | If the GUID leaks into the device shape, the mock starts pretending it knows about BIM and the interface stops being satisfiable by a real platform. Real sensors carry a device ID and nothing else — confirmed by the developer |
| 5 | **Runtime auto-binding** to elements in the loaded model, via a category **fallback chain** (equipment → `IFCSPACE` → any element) | A hardcoded GUID list works on exactly one IFC and looks broken on every other project. A real `iot_device_bindings` table would be durable storage of *fiction* — mapping fake device IDs to real GUIDs, then thrown away when real IDs arrive. Reversed from an earlier position in this session once "sensors carry only a device ID" was established |
| 6 | **No persistence at all in phase 1** | Follows from 5. Devices are stable across reloads by deterministic seeding, not by storage. Settings-page device config (`powerbiTabs`-style) is phase 2, and lands with the real mapping table |
| 7 | **Hand-rolled SVG** charts — no new dependency | Recharts renders its own SVG subtree with inline `fill`/`stroke`, so every axis/grid/tooltip becomes a token threaded through a prop, against hard constraints banning `!important` and raw `oklch()` in JSX. Three chart forms (line, stat tile, status pill) is the low end of hand-rolled. React 19 compat of recharts is also unverified |
| 8 | **Stacked mini-charts** for multi-metric devices, not one chart + metric selector | The panel answers "how is this room doing" at a glance; a selector makes you click three times to learn the same thing |
| 9 | **Live tick at 5s, React state only — the tick never touches the OBC world** | Static data reads as broken. But phase 1 only *zooms*, it does not colour geometry, so the tick has no legitimate reason to reach the viewport — worth writing down before a pulsing highlight undoes [ADR-0020](docs/adr/0020-one-render-per-frame-and-hover-on-settle.md)'s one-render-per-frame |
| 10 | Tick gated on **the tab being active**, not on mount | `ModelsView` keeps inactive tabs mounted-but-`hidden`, so a mount-scoped interval runs forever on every other tab |
| 11 | Status is **computed, never stored** — `statusFor(metric, value)` over threshold constants | A `status` field on `Reading` is a denormalised copy that goes stale when a threshold changes, and no real platform will hand you *your* thresholds. Configurable thresholds are phase 2 |
| 12 | Alarming devices **sort to the top** with a colour dot | Six names sorted alphabetically is a nav control; one red dot at the top is a monitoring tool — and it is what makes "click to zoom" meaningful (you zoom to the alarm, not to the fourth item) |

### Mock data shape

```ts
type Metric = "temperature" | "humidity" | "co2" | "occupancy" | "power"
type Device  = { deviceId: string; label: string; metrics: Metric[]; online: boolean; lastSeen: string }
type Reading = { deviceId: string; metric: Metric; value: number; unit: string; ts: string }
```

Generated by a **deterministic quasi-periodic drift** — each value is a pure function of
`(deviceId, metric, bucketIndex)`, where the bucket is the 5s tick. *Implemented as a change from
the grilled design, which called for a seeded random walk:* an accumulating walk needs stored state
to be reproducible across a reload, whereas a pure function makes reproducibility **and** the ring
buffer's bound fall out for free — there is nothing to accumulate and nothing to trim. It satisfies
every property the walk was chosen for. Not `Math.random()` and not a static file: static JSON gives
flat-line charts that cannot distinguish a rendering bug from real data, and raw random gives noise
that looks broken. Three states are **scripted** so every rendering path is exercisable
on load rather than when the RNG obliges — one device in CO₂ alarm, one over temperature, one
offline. **Offline must not render as `0`.** History is a ring buffer of ~200 points per
device/metric.

### Accepted consequences

- IoT is only usable **when a model is loaded**. Given devices bind to elements and clicking zooms
  the camera, that is the premise, not a limitation.
- Re-entering the tab regenerates a slightly different past (history is walked backwards from
  *now*). Accepted — reproducible history is real work for a benefit nobody looking at a mock notices.
- If the binding chain falls through to `IFCSPACE`, zooming lands on geometry that is **hidden by
  default** — `useIfcSpaceVisibility` only forces spaces visible on the Room tab. The IOT tab must
  do the same forcing, or the camera flies to an apparently empty void.

### Untested assumptions

1. That `fitToItems(map)` with a single-element `ModelIdMap` frames one small object usefully —
   `Views2DList` only ever calls it bare (whole model). A single air terminal may frame too tight.
2. That the category fallback chain finds bindable elements in a real project IFC at all.
3. That `dataviz` skill guidance (loaded at implementation time, before the first line of chart
   code) does not conflict with `DESIGN.md` tokens.

---

## IOT phase 2 — IFC elements as devices, persisted in Supabase

⚠️ **ยังไม่ได้ลงมือ — นี่คือผลการ grill เท่านั้น** promote เข้า `bim-viewer.md` / `frontend.md` / `backend.md`
(+ ADR สำหรับการเลือก `ifc_guid` เป็น anchor) หลังผู้พัฒนายืนยันว่าใช้งานได้จริงแล้วเท่านั้น

**เป้าหมาย** ผู้ใช้เลือก IFC element ในโมเดลแล้วผูกเป็น IoT device แบบ Autodesk Tandem เก็บลง Supabase
จากนั้นเลือกว่า element นั้นรายงาน metric อะไรบ้าง โปรเจกต์ที่ยังไม่ได้ผูกอะไรจะว่างเปล่า

### สิ่งที่ตรวจสอบกับของจริงแล้ว (ไม่ใช่การเดา)

- **โมเดล `.frag` มี IFC GlobalId ครบ** — probe ด้วย Playwright บนโปรเจกต์จริง 3 โมเดล: สุ่ม 500/500,
  211/211 และ 8/8 ได้ GUID ไม่ใช่ null ทุกตัว และ `getLocalIdsByGuids` **round-trip กลับได้ localId เดิม**
  (`133079` → GUID → `133079`) นี่คือเงื่อนไขที่ทั้งดีไซน์ตั้งอยู่ ถ้าไม่ผ่านต้องออกแบบใหม่ทั้งหมด
- **`modelId` ดริฟท์จริง** — ค่าที่เจอคือ `6ad248cc-…-d8c558989946 (1)` ต่อท้ายด้วย ` (1)` จากการอัปโหลด
  ไฟล์ชื่อซ้ำ ไม่ใช่ความเสี่ยงเชิงทฤษฎี เกิดขึ้นแล้วในโปรเจกต์นี้
- **มีสองฐานข้อมูล ไม่ใช่ฐานเดียว** — PIAS `tbrnwnghjfkwnzsldfit` (projects 9 แถว) และ
  RITTA `amsgzhzesbbfozrjystt` (projects 7 แถว) `.env.local` สลับได้ ปัจจุบันแอปชี้ **RITTA**
  ⚠️ `docs/feature/backend.md` ยังเขียนว่ามีฐานเดียวคือ PIAS — **เอกสารผิด**
- **helper สำหรับ RLS เหมือนกันทั้งสองฐาน** — `is_project_member` / `is_project_admin` / `is_hub_admin`
  เป็น `SECURITY DEFINER` + `search_path=public, pg_temp` และ **ทั้งสามเช็ก `is_active = true` ในตัวเอง**
  policy จึงไม่ต้องเขียนเงื่อนไขนั้นซ้ำ

### Decisions

| # | ตัดสิน | ที่ตัดทิ้ง และเพราะอะไร |
|---|--------|------------------------|
| 1 | anchor = **`ifc_guid`** เป็น identity, **`model_id`** เป็น hint เท่านั้น | `local_id` เปลี่ยนทุกครั้งที่ re-export — ถ้าใช้เป็น key วันได้โมเดลใหม่ sensor จะไปเกาะ element มั่วแบบเงียบ ๆ ซึ่งแย่กว่าหลุดหาย ส่วน `model_id` มาจากชื่อไฟล์และดริฟท์จริงแล้ว (` (1)`) จึงเป็น key ไม่ได้ หา hint ไม่เจอให้ fallback ค้นทุกโมเดลแล้วเขียน hint ทับ |
| 2 | **element 1 = device 1**, `unique (project_id, ifc_guid)` | หลาย device ต่อ element ทำให้เฟสระบายสีมี 2 สถานะขัดกันบน element เดียว ต้องออกกฎว่าใครชนะ; device ครอบหลาย element ต้องมีตารางเชื่อมและ join ทุก query เพื่อแก้ปัญหาที่ยังไม่เกิด |
| 3 | **`metrics iot_metric[]`** เป็น enum array + เพิ่ม `pm25` | enum ทำให้ DB กับ TS union ไม่หลุดจากกัน (`types.ts` generate ให้ฟรี) `text[]` ปล่อยให้พิมพ์ผิดเข้าไปได้เงียบ ๆ; jsonb ไม่มี constraint เลย; ตารางลูกจะถูกก็ต่อเมื่อต้องการ **threshold ต่อ device** ซึ่งยังไม่ขอ — ย้ายทีหลังได้เชิงกลไก |
| 4 | เพิ่ม device จาก **selection ปกติ** ใน viewport | โหมด "กดปุ่มแล้วค่อยจิ้ม" ต้องสร้างโหมดยึด pointer ตัวที่ 5 ต่อจาก Measure/Clip/Sectionbox/Isolate ซึ่งโปรเจกต์นี้ถึงขั้นต้องมี `SectioningArbiter` มาตัดสินอยู่แล้ว และต้องตอบว่า Escape ยกเลิกอะไรก่อน |
| 5 | อ่าน = member, **เขียน = `is_project_admin`**; **ลบจริง** ไม่ soft delete | binding คือการตั้งค่าที่เปลี่ยนสิ่งที่ทุกคนเห็น ไม่ใช่เนื้อหาแบบ clash report; ผ่อนทีหลังแก้ policy บรรทัดเดียว รัดทีหลังคือไปยึดสิทธิ์คืน — soft delete จะทำให้แถวที่ลบยังกิน `unique (project_id, ifc_guid)` แปลว่าผูก element เดิมกลับไม่ได้ ต้องใช้ partial index มาแก้เพื่อเก็บประวัติที่ไม่มีใครอ่าน |
| 6 | ค่าจำลองเพาะจาก **`device_id`** + hash กำหนดย่านสถานะ (~ปกติ 70 / warn 15 / alarm 10 / offline 5) | เพาะจาก `ifc_guid` จะทำให้ลบ device แล้วผูกใหม่ได้ค่าชุดเดิมกลับมา เหมือนระบบจำสิ่งที่ลบไปแล้ว; คอลัมน์ `mock_profile` ให้ผู้ใช้เลือกพฤติกรรมถูกตัดทิ้งเพราะเป็นการฝัง config ของข้อมูลปลอมลงตารางที่ต้องอยู่ต่อถึงตอนต่อของจริง — เหตุผลเดียวกับที่เฟส 1 ไม่ยอมสร้างตาราง mapping ให้ device ปลอม |
| 7 | **แสดง device ทุกตัวเสมอ** ตัวที่ resolve GUID ไม่เจอในโมเดลที่โหลดอยู่ ให้ zoom ไม่ได้แต่ยังเห็นค่า | ซ่อนตัวที่ resolve ไม่ได้ = รายการโกหก ผู้ใช้ตั้ง 20 ตัวเห็น 6 ตัวแล้วสรุปว่าข้อมูลหาย จะไปเพิ่มซ้ำจนชน unique; และการอ่าน CO₂ ไม่ควรต้องรอโหลด geometry |
| 8 | apply migration ผ่าน **Supabase MCP** แล้ว regenerate `types.ts` | เขียน `types.ts` ด้วยมือถูกห้ามโดย `backend.md` และจะถูกลบทิ้งใน generate ครั้งถัดไป ระหว่างนั้นมันจะโกหกว่า schema เป็นแบบที่เราคิด |
| 9 | **ลง migration ทั้งสองฐาน** (PIAS + RITTA) | `.env.local` ออกแบบมาให้สลับ มีคอมเมนต์สอนวิธีสลับกำกับไว้ — schema ไม่ตรงกันคือระเบิดเวลาที่จะระเบิดใส่คนที่สลับกลับ โดยไม่มีอะไรโยงให้เขาเดาถูกว่าเป็นเพราะ migration |
| 10 | **`device_code` มีแต่ nullable**; แสดงผล fallback เป็นประเภท element | เฟสถัดไประบบ IoT จริงส่งมาแค่ device id — ไม่มีช่องรอไว้ตั้งแต่ตอนนี้ วันเชื่อมจริงต้อง migration เพิ่มคอลัมน์แล้วไล่กรอกย้อนหลัง; แต่บังคับกรอกตอนนี้จะได้รหัสมั่วที่ต้องล้างทีหลัง — uuid ไม่เอามาแสดง และ GUID ย่อไม่สื่ออะไรกับมนุษย์ |

### เค้าโครงตาราง

```sql
create type iot_metric as enum
  ('temperature','humidity','co2','power','occupancy','pm25');

create table iot_devices (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id),
  ifc_guid         text not null,          -- identity ตัวจริง
  model_id         text,                   -- hint เท่านั้น เขียนทับได้
  device_code      text,                   -- ช่องรอ device id ของระบบจริง
  label            text not null,
  element_category text,                   -- ดูหมายเหตุ
  metrics          iot_metric[] not null,
  created_by       uuid references profiles(uid),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
```

**ทำไมต้องเก็บ `element_category` ทั้งที่อ่านจากโมเดลได้** — เพราะ decision 7 บังคับให้รายการแสดง device
ที่โมเดลยังไม่โหลดด้วย ตอนนั้นไม่มีอะไรให้ query เลย ถ้าไม่เก็บไว้ แถวเหล่านั้นจะไม่มีอะไรแสดงใต้ชื่อ
เป็นการ denormalise ที่จงใจ และยอมรับว่ามันอาจเก่าได้ — ใช้เพื่อแสดงผลเท่านั้น ไม่เคยใช้ตัดสินใจ

### PM2.5

| metric | หน่วย | warn | alarm |
|---|---|---|---|
| `pm25` | µg/m³ | 35 | 55 |

อิงช่วง AQI สากล (moderate เริ่ม ~35, unhealthy ~55) — WHO 24h guideline เข้มกว่านี้ที่ 15
ถ้าอาคารอิงมาตรฐานอื่นให้ปรับที่ `iotThresholds.ts` จุดเดียว

### โค้ดเฟส 1 ที่ถูกลบทิ้ง ไม่ใช่ดัดแปลง

- `iotBinding.ts` ทั้งไฟล์ — การเดินอ่านโมเดลเพื่อแจก device แบบสุ่มไม่มีที่ยืนแล้ว
- roster ตายตัว 6 ตัวใน `mockIotProvider.ts` — เหลือแต่ตัวสร้างค่าที่เพาะจาก `device_id`
- `hasModel` เลิกทำหน้าที่คุม empty state ทั้งแท็บ empty state ตัวจริงกลายเป็น "ยังไม่มี device"

ที่เหลืออยู่ครบ: panel ซ้าย, กราฟ SVG, การ sort ตามสถานะ, tick 5 วิ, `statusFor`, `IotStatusBadge`,
การ zoom ด้วย `fitToItems` — คือเหตุผลที่เฟส 1 คุ้มที่จะทำ

### สมมติฐานที่ยังไม่ได้ทดสอบ

1. `fitToItems` กับ element เดี่ยวเล็ก ๆ จะ frame ใช้งานได้จริงไหม (ยกมาจากเฟส 1 ยังไม่ได้ทำ spike)
2. ตอนกดบันทึก ถ้า `getGuidsByLocalIds` คืน `null` ต้องปฏิเสธพร้อมบอกเหตุผล — ยังไม่รู้ว่าเกิดบ่อยแค่ไหน
   จาก probe คือ 0% แต่ทดสอบแค่ 3 โมเดล
3. `element_category` ดึงจาก property ตอนผูกได้ครบทุกกรณีหรือไม่

---

## IOT phase 3 — device annotations floating in the viewport

⚠️ **ยังไม่ได้ลงมือ — ผลการ grill เท่านั้น** promote เข้า `bim-viewer.md` (+ ADR สำหรับการเลือก CSS2D
และการยอมให้ป้ายกินคลิก) หลังผู้พัฒนายืนยันว่าใช้งานได้จริง

**เป้าหมาย** ป้ายข้อมูล IoT ลอยเกาะ element ที่ผูกไว้ในวิวพอร์ต แบบเดียวกับป้ายชื่อห้องของ `RoomView`
สไตล์ตาม `DESIGN.md` อ้างอิงภาพ Autodesk-Tandem-style ที่ผู้พัฒนาส่งมา

### สิ่งที่ตรวจกับของจริงแล้ว (ไม่ใช่การเดา)

- **เลเยอร์ CSS2D อยู่ใน light DOM** — probe ด้วย Playwright บนโปรเจกต์จริง: `<bim-viewport>` มี shadow
  root ก็จริง แต่ `RendererWith2D.setupHtmlRenderer` ทำ `container.appendChild(...)` ทำให้เลเยอร์เป็น
  ลูก light DOM (`layerParentTag: "BIM-VIEWPORT"`, `inShadow: false`) **class จาก `style.css` ติด**
  (ทดสอบด้วย outline สีม่วง ได้ `rgb(255,0,255)`) และ `var(--color-surface)` ก็ resolve เป็น
  `oklch(14.5% 0.014 255)` → ทำ decision 8 ได้ ไม่ต้องใช้แผนสำรอง
- **`OBC.Hider` ไม่มี event ใด ๆ** — มีแค่ `set` / `isolate` / `toggle` / `getVisibilityMap` และฝั่ง
  Fragments ก็ไม่มี event แจ้งเปลี่ยน visibility ⇒ **ไม่มีทางฟัง ต้องถามเอา**
- **`bumpVisibilityEpoch()` ถูกเรียกที่เดียว** คือ `handleShowAll` ใน `ToolbarVisibility.tsx`
  **Isolate/Hide ไม่ขยับ** และ `SmartViews` เรียก `Hider` ตรง ๆ โดยไม่ขยับเช่นกัน
- `model.getVisible(localIds)` มีอยู่ในtypings ที่ติดตั้ง (`@thatopen/fragments`) ⇒ อ่านสถานะซ่อนได้
- `RoomLabels` ใช้ hex ตายตัว (`#a21caf`) เพราะต้องสู้กับ room volume สีเหลืองอำพัน — เป็นข้อจำกัด
  เฉพาะของมัน **ไม่ใช่** ข้อจำกัดของเทคนิค

### Decisions

| # | ตัดสิน | ที่ตัดทิ้ง และเพราะอะไร |
|---|--------|------------------------|
| 1 | ย้ายไป **`bim-components/IotView/`** ตามแบบ `RoomView`; `features/iot/` เหลือเป็นตัวสะท้อนฝั่ง React | เกณฑ์ที่ตั้งไว้ตั้งแต่เฟส 1 คือ "ถือครอง resource ฝั่ง engine ที่ต้อง dispose ไหม" — chip เป็น `CSS2DObject` ในซีนจริง คราวนี้ตอบว่าใช่ · `OBF.Marker` ถูกตัดเพราะมาพร้อม clustering + DOM ของตัวเองที่ต้องไปสู้เพื่อให้ตรง DESIGN.md และแก้ปัญหาที่เรายังไม่มี |
| 2 | โชว์ **ทุก device** + cap เรียง **alarm → warn → ok → offline** (ตัวที่เลือกได้ slot เสมอ) + สวิตช์ปิดเลเยอร์ | โชว์เฉพาะตัวที่เลือก = ข้อมูลซ้ำกับ panel ขวา ไม่เพิ่มอะไรนอกจากตำแหน่ง · โชว์เฉพาะตัวผิดปกติ ทำให้ตึกที่ปกติดูเหมือนไม่มี sensor และกำกวมกับ "ยังไม่ได้ผูก" · cap ตามลำดับรายการแบบ `RoomView` จะตัด chip ของตัวที่ alarm ทิ้งเพราะอยู่ท้ายรายการ — ซ่อนสิ่งเดียวที่คนอยากเห็น |
| 3 | chip = **ไอคอน metric + ค่าหลัก** จาก `headlineReading()` เดิม; ขยายเป็นสองค่าเมื่อถูกเลือก | ค่าหลักต้องใช้ฟังก์ชันเดียวกับรายการ ไม่งั้นผู้ใช้เห็น 1480 ppm ในรายการแต่ 24°C บน chip แล้วไม่รู้ว่าอันไหนจริง · ใส่ชื่อ device ถูกตัดเพราะ label ของเรายาว (`"IFCUNITARYEQUIPMENT 133079"`) ทำให้ chip กว้างเป็นสองเท่าเพื่อข้อมูลที่ panel บอกอยู่แล้ว |
| 4 | **chip คลิกได้** = เลือก device นั้น | ⚠️ **ผู้พัฒนาเลือกสวนคำแนะนำ** ผมเสนอ `pointer-events: none` เพราะ chip ทะลุ geometry (CSS2D occlude ไม่ได้) จึงลอยทับด้านหน้าตึกและกินคลิกที่ตั้งใจจิ้ม element — ซึ่งเป็น flow หลักของแท็บนี้เอง บันทึกไว้ว่าเป็นการตัดสินใจของผู้พัฒนา พร้อมมาตรการในข้อ 5 |
| 5 | กันบังคลิก: **ทะลุอัตโนมัติเมื่อ `activeTool` ไม่ว่าง** + สวิตช์จากข้อ 2 | ปุ่มลัดกดค้าง (Alt) ถูกตัด — โปรเจกต์นี้มีปัญหาปุ่มลัดชนกันแล้ว (`ClipperPlacementManager` จับ Escape ทั้งอายุการใช้งาน) · พื้นที่คลิกเล็กกว่าที่ตาเห็นถูกตัดเพราะเป็น UI ที่โกหก **ยอมรับว่ายังเหลือกรณี "อยากผูก element ที่มี chip บังพอดี" ที่ต้องปิดเลเยอร์เอง** |
| 6 | chip **ตามการซ่อน/Isolate** ผ่าน `model.getVisible()` | chip จางถูกตัด — ป้ายจาง ๆ ลอยกลางอากาศไม่สื่ออะไร และขัดกับข้อ 3 ที่ต้องแคบ · โชว์เสมอถูกตัดเพราะทำให้ Isolate ไม่ทำหน้าที่ของมัน |
| 7 | **เฉพาะแท็บ IOT** — mount = activate, unmount = dispose | คอมเมนต์ใน `ModelsView` เตือนไว้ตรง ๆ ว่า hidden-but-mounted panel จะทิ้ง CSS2D chip ค้างข้ามทุกแท็บ — เป็นบั๊กที่โปรเจกต์นี้เจอมาแล้วกับป้ายชนิดเดียวกันเป๊ะ **แลกด้วย:** ดูค่า sensor ระหว่างทำงานในแท็บอื่นไม่ได้ |
| 8 | สไตล์เป็น **class `.iot-chip*` ใน `style.css`** ใต้ `@layer components` ใช้ token ล้วน | Tailwind ใช้ไม่ได้ — CLAUDE.md ระบุ `bim-components/` เป็น "OBC/Three.js only. No Tailwind" · inline style ถูกตัดเพราะข้อ 4 ทำให้ต้องมี `:hover` + สถานะ selected + 4 สถานะ ซึ่ง inline ทำ pseudo-class ไม่ได้ ต้องไปเขียน hover ด้วย JS เอง |
| 9 | รู้ว่า element ถูกซ่อนด้วย **ขยับ `visibilityEpoch` ใน Isolate/Hide (ทันที) + ถามเองทุก tick (ครอบทางอื่น)** | ถามเองอย่างเดียว = chip ค้าง 5 วิหลังกด Isolate ซึ่งเป็นท่าที่คนกดบ่อยที่สุด ดูเหมือนพัง · ขยับ epoch อย่างเดียวไม่ครอบ `SmartViews` ที่เรียก `Hider` ตรง ๆ |

### ที่ยังไม่ได้ทดสอบ

1. **การขยับ `visibilityEpoch` เพิ่มจะไม่ทำให้ Isolate บนแท็บ Room พัง** — อ่านโค้ดแล้วให้เหตุผลว่า
   กฎของ `useIfcSpaceVisibility` เป็น hide-only จึงไม่ทำอะไรตอน spaces ต้องโชว์ **แต่ยังไม่มีหลักฐาน**
   ต้องทดสอบเรื่องนี้เป็นพิเศษ
2. **ตำแหน่ง chip** ใช้จุดกึ่งกลาง bounding box (`getBoxes`) — device ที่เกาะกลุ่ม เช่นหัวจ่ายลม 6 ตัว
   บนฝ้าเดียวกัน chip จะทับกัน cap ช่วยได้บางส่วนเท่านั้น ยังไม่ทำ clustering
3. **การรื้อของเดิม** — ย้าย `iotResolver` + `fitToItems` ออกจาก `features/iot/` เข้า `IotView` คือการ
   ผ่าตัดโค้ดที่เพิ่งผ่าน e2e ในเฟส 2

### ⏸ ค้างไว้ — ต้องทำต่อ (phase 3)

**เทสต์ e2e ตกอยู่ 1 assertion: ปิดสวิตช์ chip แล้วเปิดกลับ chip ไม่กลับมา**
(`e2e/iot-tab.spec.ts` — บล็อก "The layer switch removes every chip, and restores them")

ที่แก้ไปแล้วแต่ยังไม่หาย: เพิ่ม `chipsVisible` เข้า dependency ของ effect ที่เรียก `syncChips`
เพื่อให้เปิดสวิตช์แล้ว re-sync ทันทีโดยไม่ต้องรอ tick ถัดไป

**ยังไม่ยืนยันว่าเป็นบั๊กของโค้ดหรือของเทสต์** เบาะแสสุดท้ายก่อนหยุด:

- โปรเจกต์ที่เทสต์เลือก (THAI DC) **ไม่มี device เลย** — 4 ตัวที่ผู้พัฒนาผูกไว้อยู่คนละโปรเจกต์
  ฉะนั้นตอนเทสต์รัน มี device แค่ตัวเดียวที่มันเพิ่งสร้าง
- device ตัวนั้น**ตกอยู่ในย่าน offline** ตามที่ hash ของ `device_id` สุ่มได้ (ยืนยันจาก
  `row=undefined chip=--`) ซึ่งอาจเกี่ยวหรือไม่เกี่ยวกับอาการก็ได้
- สวิตช์ไม่ถูก render ในสถานะ "ยังไม่มี device" — `IotDeviceList` คืน empty state ก่อนถึง toggle

**วิธีตรวจที่เร็วที่สุด (30 วินาที):** เปิดแท็บ IOT ในโปรเจกต์ที่**มี device อยู่แล้ว** กดสวิตช์
"Show readings on model" ปิดแล้วเปิด — ถ้า chip กลับมา แปลว่าเทสต์เขียนผิด ถ้าไม่กลับ แปลว่าเป็นบั๊กจริง

**สิ่งที่ยังไม่มีใครดูด้วยตา** (ค้างจากทุกเฟส):
1. หน้าตา chip จริงที่ความกว้าง viewport จริง อ่านง่ายไหม
2. chip ทับกันแค่ไหนเมื่อ device เกาะกลุ่มบนฝ้าเดียวกัน
3. กล้องบินไปหา element เล็ก ๆ แล้วเฟรมใช้ได้ไหม — ค้างตั้งแต่เฟส 1 ยังไม่เคยทำ spike
4. เทสต์ `isolating a room on the Room tab` เป็น **partial by construction** — ยืนยันแค่ว่า flow
   เดินจบและ engine ไม่ error ส่วน "ห้องยังมองเห็นอยู่จริง" ต้องใช้ตาคนดู
