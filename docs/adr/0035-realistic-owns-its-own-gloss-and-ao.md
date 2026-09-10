# ADR-0035: The Realistic tab owns its own gloss and ambient occlusion

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Realistic tab

## Context

PostRender and Realistic shared Gloss and Ambient Occlusion, so tuning AO for daylight wrecked the
flat house look and vice versa. This is
[ADR-0025](0025-house-look-is-the-boot-preset.md) § Consequences being cashed in — it recorded
*"widening its `_baseline` with the AO block […] Deferred, not rejected […] Not written blind."*
Gloss was not anticipated there.

The constraint: there is exactly **one** set of passes. `world.renderer.postproduction` is a
singleton and `glossPass` / `aoPass` / `defaultAoParameters` are engine state. "Not shared" can only
mean **snapshot-and-restore**, which `RealisticView` already does for `style` — the only reason the
Realistic tab does not permanently corrupt the house look today.

## Decision

`RealisticView`'s baseline widens to carry `glossEnabled`, the six gloss numbers, a **copy** of
`defaultAoParameters`, and `aoPass.blendIntensity`. `activate` snapshots and writes Realistic's
values; `deactivate` restores the snapshot exactly. Tabs are mutually exclusive in `ModelsView`, so
only one panel is ever mounted and there is no concurrent-writer case.

| | Choice |
|---|---|
| PostRender's Gloss/AO | **kept** — AO is part of the boot preset every other tab renders with |
| Realistic's values | **remembered** across tab flips, in `RealisticView._settings` — matches sun/sky |
| PD denoise (7 sliders) | **excluded** from Realistic — stays global |
| AO seed | `POSTPRODUCTION_PRESET.ao` verbatim, **except `aoBlend` `1 → 0.5`** |
| Gloss seed | vendor shader defaults, **except `minGloss` `-0.12 → 0`**; `glossEnabled: false` |
| Settings shape | nested `ao` / `gloss` blocks with dedicated `updateAo()` / `updateGloss()` |
| Reset | two buttons — *Reset daylight* (sun/sky/exposure) and *Reset render* (gloss + AO) |

**Only two seed values deviate from the vendor/house numbers, and both are corrections justifiable
before looking at a render.** Everything else is the house value, so tuning starts from a known
baseline.

- **`aoBlend` `1 → 0.5`.** ADR-0025 chose `1` because *"anything less is invisible against this
  scene's ambient light"*, and `create-world.ts` runs ambient at `1.5`. `RealisticView.activate`
  drops ambient to **`0.15`** — a factor of ten — and adds real shadow maps. Blend `1` there is AO
  doubling up on sun shadows, exactly the *"reads too heavy against real daylight shadows"* case the
  ADR flagged.
- ⚠️ **`minGloss` `-0.12 → 0`.** `minGloss` is not a gloss floor, it is a **global darkening offset
  applied wherever gloss is absent.** The `GlossPass` fragment shader clamps `gloss = max(gloss,
  0.001)`, so a zero-gloss pixel resolves to `normalize(vec3(0.001)) * minGloss` ≈ `0.577 * minGloss`
  added to the scene colour. At the vendor's `-0.12` that is a flat **−0.069 on every channel** of
  every low-gloss pixel — including the entire sky — against an image that is already dark by design.

## Vendor traps this rests on — none of them documented upstream

1. ⚠️ **Gloss is camera-relative, not light-relative.** `projected-normal-material.ts` computes
   `dot(vNormal, normalize(cameraPosition - vPosition))` and takes **no light direction at all**. It
   is a fresnel sheen keyed to viewing angle, not a specular highlight — it will not track the sun.
2. ⚠️ **The sky contributes nothing to the gloss buffer.** `GlossPass.render` sets
   `scene.overrideMaterial`, and `getProjectedNormalMaterial()` declares no `side`, so it defaults to
   `FrontSide` — and three.js `overrideMaterial` replaces `side` too. `Sky.js` is `side: BackSide`
   with the camera inside a 450 km sphere, so its faces are culled. `basePass.isolatedMaterials` does
   not help; that is a `BasePass` concept `GlossPass` never consults.
3. ⚠️ **Gloss costs a full extra scene render every frame.** `GlossPass.render` does
   `renderer.render(this.renderScene, this.renderCamera)` into its own buffer. Unlike Realistic's
   shadow map — pinned to `autoUpdate = false` so orbiting is free — this pays every frame, in a
   scene [ADR-0024](0024-realistic-view-on-three-0182-primitives.md) notes is CPU-bound on draw-call
   submission. **This is why `glossEnabled` defaults to `false`.**
4. ⚠️ **`set glossEnabled` re-runs the style setter** (`this.style = this._style`), rebuilding the
   whole composer chain — and the style setter pushes `defaultAoParameters` into the AO material when
   the style leaves `PEN_SHADOWS`. Gloss and AO are **not** independent writes at the vendor level,
   whatever the UI suggests. Hence: `activate` writes AO **before** touching `glossEnabled` or
   `style`; `deactivate` restores AO, then gloss, then style.
5. `COLOR_SHADOWS` — the style `RealisticView` installs — **does** add the gloss pass, before the AO
   pass. `PEN` and `PEN_SHADOWS` omit `_glossPass` entirely, so gloss on the wrong style is a silent
   no-op.

## Alternatives rejected

- **Move Gloss/AO to Realistic, off PostRender.** Breaks the house look: AO *is* part of
  `POSTPRODUCTION_PRESET`, which every non-Realistic tab renders with. You would be tuning the
  daylight look and hoping the flat one followed.
- **Inherit-and-forget** — Realistic starts from the live house values each visit and tuning dies on
  tab exit. `deactivate` already does *not* clear `_settings` (sun angles survive a flip today), so
  one panel would have two memory rules; and AO tuned for daylight would be re-entered every visit.
- **Give Realistic the PD sliders, restoring `PD_DEFAULTS` on exit.** Data loss wearing a feature's
  clothes — it silently discards whatever the user tuned in PostRender.
- **Give Realistic the PD sliders, backed by a shadow record in `postproduction.ts`.** The
  technically correct "include", and it would fix a real existing drift: `PostRenderPanel.readState`
  seeds `pd: { ...PD_DEFAULTS }` on every mount, so tuning PD, leaving and returning shows defaults
  while the engine holds the tuned values. Rejected **for this change only** — PD is a denoiser for
  the AO buffer, not a look, so the visual payoff for touching shared bootstrap code is near nil.
- **A flat `RealisticSettings`** (`aoRadius`, `glossMinGloss`, …) so the existing shallow spread stays
  correct. Discards `AoParameters`, which is derived from the vendor type, and needs a hand-rolled
  re-assembly layer before `updateGtaoMaterial` can consume it.
- **One `update()` with a deep merge for the two object keys.** Shallow for six keys and deep for two
  is a footgun for whoever adds the ninth. The hazard is real: with nested blocks, a shallow spread
  lets `update({ ao: { radius: 0.3 } })` type-check while wiping every sibling AO field at runtime.
- **One reset button covering everything.** Sun and exposure get moved constantly; AO and gloss get
  set once. One button costs the AO tuning every time you want the sun back.

## Consequences

- **`Baseline` copies the AO block, it does not reference it.** `defaultAoParameters` is mutated in
  place, so a stored reference would "restore" the very values it was meant to undo.
- **`deactivate` calls `updateGtaoMaterial` explicitly.** The style setter's re-push fires only when
  leaving `PEN_SHADOWS`, and Realistic sits at `COLOR_SHADOWS`. `aoPass.blendIntensity` is likewise
  untouched by the style setter and is restored by hand.
- **All writes stay inside the `_generation` guard** — `activate` is async and StrictMode makes the
  cancelled-activate path normal ([ADR-0026](0026-async-activate-needs-an-ownership-token.md)).
- **`update()` stays sun-only.** Writing 14 pass values on every azimuth drag is waste.
- ⚠️ **PD stays genuinely shared between the two tabs**, and PostRender's read-back drift stays
  unfixed. Worth its own change.
- **The seeded numbers are a starting point, not a result.** Where live tuning and this record
  disagree, this record is wrong and `REALISTIC_DEFAULTS` is right.
