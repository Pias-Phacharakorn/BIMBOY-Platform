# ADR-0025: The house look is the world's boot state, and GIS opts out by style

**Status:** Accepted
**Date:** 2026-08-27
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Postproduction and the house look

## Context

The PostRender tab shipped with a `PRESET` — the developer's reference look — applied the first time
the tab was opened on a given world. That made the app's appearance depend on whether anyone had
visited a settings tab, and the Models tab rendered differently before and after that visit. The
preset was the intended look; the tab was just where it happened to live.

Promoting it to a boot default is not simply "move the constant into `create-world.ts`". The
`PostproductionRenderer` will not accept the writes there:

- `_postproduction` only exists once the renderer has a `currentWorld`.
- Every pass getter throws (`"Edge detection pass not initialized"`) until `initialize()` runs.
- `initialize()` runs from exactly one place — the `set enabled` setter, on the first `true`. In this
  app that first `true` is `setupHighlighter`.
- `initialize()` also reads `currentWorld.camera.three`, and `create-world.ts` assigns the camera
  *after* the renderer.

## Decision

**The preset lives in `setup/src/postproduction.ts`, applied immediately after `setupHighlighter`.**
Right folder, later moment. It carries `COLOR_PEN_SHADOWS`, outlines and SMAA on, gloss off, edges
`1.1` at `#323232` in `DEFAULT` mode, AO screen-space with blend `0.7` / radius `0.3` /
`distanceExponent 2` / thickness `1.5`, and the selection outline at `#bcf124` / `fillOpacity 0.30` /
thickness `3`.

Two values fight the vendor deliberately: `distanceExponent 2` against `5.7`, which collapses AO into
a hairline contact seam instead of broad soft shading in window reveals and under balcony slabs.

**`setupHighlighter` stops setting the outliner's appearance.** It keeps `outliner.world`,
`outliner.enabled` and the `onHighlight`/`onClear` bindings; the four appearance lines go, because
the preset writes the same four properties moments later. One writer, one constant, and the panel's
"Reset outline to preset" now resets to what the app actually booted with.

**GIS opts out by style, for as long as `GisPanel` is mounted.** `useGisRenderMode` snapshots
`postproduction.style`, sets `COLOR`, and restores on cleanup. `GisPanel` renders only on the GIS
tab, so mount/unmount *is* the tab boundary. The conflict is real, not theoretical: `GisLayer3d` adds
its Google/OSM tile groups straight into `world.scene.three`, so streamed photogrammetry would go
through the same edge-detection pass as the model.

## Alternatives rejected

- **Bottom of `create-world.ts`.** The first instinct. Would need to force `enabled = true` ourselves
  to trigger `initialize()`, pre-empting `setupHighlighter` on a flag `ViewportRightToolbar` also
  snapshots during tool suppression — the [ADR-0017](0017-room-tab-owns-no-visibility-state.md)
  two-owners hazard. The outliner half would still have to live elsewhere, since the `Outliner` is
  created in `setupHighlighter`.
- **Fold it into `highlighter.ts`.** Both halves in one existing file and no new bootstrap line, but
  that file's job is selection wiring, and `PostRenderPanel` importing the render look from
  `highlighter.ts` reads wrong.
- **Apply it from `ModelsView` per tab.** Engine state driven by a view; the look would exist only
  inside `ModelsView` and would fight `RealisticView`'s own snapshot/restore on tab flips.
- **`ExcludedObjectsPass` for the GIS conflict.** The surgical answer on paper, and unusable here: it
  excludes by *material* (`addExcludedMaterial`) and `3d-tiles-renderer` mints a new material per
  streamed tile, so there is no stable list to register.
- **Force `postproduction.enabled = false` on GIS.** Kills edges, AO and SMAA in one move, makes the
  GIS hook a second owner of the flag `ViewportRightToolbar` suppresses tools with, and drops the
  selection outliner, which needs postproduction on.
- **Drive the GIS opt-out off `GisLayer3d.enabled` instead of the tab.** Truer to intent — the BIM
  model would keep its edges until tiles are switched on — but it needs a change event `GisLayers`
  does not have, and it moves the transition to a mid-session moment with no visible boundary.
- **An `activate`/`deactivate` API on `GisLayers`.** The `RealisticView` shape, but that component
  exists because its rig is large; a two-field snapshot does not earn a public engine API used by one
  panel.
- **`fillOpacity 0.85` for the selection outline.** Tried in the preset and reverted — a near-solid
  fill reads as a flat green blob over the element instead of tinting it.

## Consequences

- **`enabled` is deliberately not in the preset.** It is co-owned by `ViewportRightToolbar` during
  tool suppression, and a boot-time write could land inside that window and fight the arbiter's
  snapshot. `setupHighlighter` already turns postproduction on.
- **AO parameters are written before the style.** The vendor's style setter itself pushes
  `defaultAoParameters` into the material when the style leaves `PEN_SHADOWS`; explicit
  `updateGtaoMaterial`/`updatePdMaterial` calls after it cover every other transition.
- **`RealisticView` is left alone**, and now inherits the preset's AO instead of the vendor defaults —
  a normal combination (sun shadows plus contact AO), since its `activate` already swaps `style` to
  `COLOR_SHADOWS` and removes the visible half of the preset anyway. Deferred, not rejected: widening
  its `_baseline` with the AO block, if the AO reads too heavy against real daylight shadows.
  Not written blind.
- **AR needed nothing.** `/ar/$projectId` renders `ArModelViewer` and never calls `setupComponents`,
  so there is no OBC world and no `PostproductionRenderer` on that page.
- **`EdgeDetectionPassMode.DEFAULT` is now what every tab pays on a 60-model project.** The PostRender
  tab's original preset chose `GLOBAL` deliberately — it skips LOD geometry, which is both fewer lines
  at building scale and the faster path on a heavy scene. `DEFAULT` came from the developer's own live
  tuning against a real model, so it stands until measured otherwise. It is also the leading suspect
  for the still-unexplained "cut clips surfaces but not edges" defect, whose top hypothesis is that
  `EdgeDetectionPass.setMaterialToMesh` skips `isLODGeometry` tiles.
- **`isolatedMaterials` is still untouched.** The vendor tutorial does
  `postproduction.basePass.isolatedMaterials.push(grid.material)`, and nothing in `src/` touches it,
  so the grid runs through AO and edge detection. Latent only because `create-world.ts` ships the grid
  hidden — turn it on in Viewport Settings and it is shaded as geometry. A one-line fix, deliberately
  left for its own change.
