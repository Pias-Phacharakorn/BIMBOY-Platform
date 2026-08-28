# ADR-0024: The Realistic tab is built from three 0.182 primitives, and changes no materials

**Status:** Accepted
**Date:** 2026-08-24
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Realistic tab

## Context

The ask was a tab rendering the project like three.js's `webgl_lightprobes_sponza` example.

**That example cannot run here.** It imports `three/addons/lighting/LightProbeGrid.js` and
`helpers/LightProbeGridHelper.js`; our `three@0.182.0` ships an `examples/jsm/lighting/` folder
containing only `TiledLighting.js`. What *is* available at 0.182: `LightProbe` (a single SH probe),
`LightProbeGenerator`, `PMREMGenerator`, `RoomEnvironment`, `Sky`, `FirstPersonControls`, and ACES
tone mapping.

There is a second, deeper constraint. Fragments builds mostly `MeshLambertMaterial`, and
`WebGLRenderer` assigns `materialProperties.environment = material.isMeshStandardMaterial ?
scene.environment : null` — so **image-based lighting never reaches this geometry at all**.
Non-standard materials also resolve env maps through `cubemaps` rather than `cubeuvmaps`, so a PMREM
texture is the wrong input for them. What Lambert *does* honour: ambient, hemisphere and directional
lights, shadow maps, and renderer tone mapping.

## Decision

Reproduce the look with 0.182 primitives, and touch no materials: `Sky` plus a `HemisphereLight`
carrying sky/ground colour plus a shadow-casting `DirectionalLight` sun, with ACES tone mapping and
exposure, and postproduction switched to `COLOR_SHADOWS` so the vendor's existing AO pass supplies
contact shading while pen edges stay off.

`RealisticView` follows `RoomView`'s shape (`OBC.Component implements OBC.Disposable`, static uuid,
activated and deactivated by a feature hook), snapshotting renderer, scene and light state on
activate and restoring it on deactivate.

`shadowMap.autoUpdate = false`. Shadow maps live in *light* space, so orbiting the camera cannot
invalidate them; `needsUpdate` is set only when a model loads, tiles stream, or the sun moves.

## Alternatives rejected

- **Bump three to get `LightProbeGrid`.** *Not* blocked by ThatOpen — installed peer deps are
  `three: ">=0.182.0"` across `components@3.4.8`, `components-front@3.4.4` and `fragments@3.4.7`, and
  crais itself runs r184. Rejected on two counts. First, it moves the version the whole BIM stack was
  built against, including the vendored FRAGS worker
  ([ADR-0014](0014-frags-worker-from-node-modules.md)) and a `@types/three` already 26 versions stale
  at 0.156.0. Second and decisively, **the bake is unaffordable regardless**: the demo's 10×7×7 grid
  is 490 probes × 6 faces = 2,940 scene renders *per bounce*, against a scene of 2,746 meshes / 1,188
  materials / 7.3M triangles that is 100% CPU-bound on draw-call submission at ~3 µs each. Small
  cubemaps do not help — rendering at 64×64 instead of 520×687 moved frame cost by 0.5 ms. That is
  roughly 30 s of blocked main thread per bake, and the demo re-bakes on every slider change. Getting
  the feature would not make it usable.
- **Swap the material pool to `MeshStandardMaterial` while the tab is active.** The only route to a
  true PBR look. It mutates `fragments.core.models.materials.list` in place — the same shared pool
  `ToolbarGhost` mutates, which [ADR-0017](0017-room-tab-owns-no-visibility-state.md) exists because
  of — and ~1,188 new materials means ~1,188 shader program compiles, i.e. a multi-second stall on
  tab entry.
- **`envMap` per Lambert material.** Cheaper, still mutates the shared pool, and reads as a faint
  mirror rather than soft irradiance, for the `cubemaps` reason above.
- **A standalone `/realistic` route with its own renderer**, as AR did. Cleanest isolation, but it
  still needs the version answer and would have to solve getting fragment geometry into a second
  context — doubling VRAM for 7.3M triangles.
- **Become the app's look, as the PostRender preset does**
  ([ADR-0025](0025-house-look-is-the-boot-preset.md)). Simpler ownership, but it leaves the shadow
  pass running everywhere, and postproduction's pen styles actively contradict photorealism.
- **A full viewport takeover** (hide toolbars, disable selection). Clearest mental model, largest UI
  change, and it removes measure and section while previewing.
- **`FirstPersonControls` as in the demo.** Would mean disabling camera-controls, `CursorZoom` and
  `PivotMarker` for the tab's lifetime, and it has no collision and flies at constant height, so you
  walk through walls. **Deferred instead:** walk mode via `camera-controls` locked distance
  (`minDistance === maxDistance`, crais's own idiom) — attractive because it needs no second controls
  object, but `CursorZoom` already writes both fields, so it is an interlock, not a setting
  ([ADR-0023](0023-camera-response-ported-from-crais.md)).

## Consequences

- **"Realistic" is capped by the material constraint, permanently.** Without standard materials there
  is no IBL and no PBR. Lights, shadows and tone mapping are the whole available budget. Anyone
  disappointed by the ceiling should re-read the rejected material swap rather than re-propose it.
- **The state lives only while the tab is open**, and that is a performance requirement rather than
  taste: leaving a shadow pass enabled globally would slow every other tab on a scene already at
  27–40 fps. Accepted cost — a second save/restore owner over shared globals, so it needs an explicit
  interlock with the PostRender preset and `ViewportRightToolbar`'s FX baseline.
- **Per-mesh `castShadow`/`receiveShadow` must be applied as LOD tiles appear.** Nothing in `src/`
  set those before, and tiles are created and destroyed continuously. The hook is
  `model.tiles.onItemSet` / `onItemDeleted` — exactly what `Outliner.bindModelTileEvents` subscribes
  to; its per-model unsubscribe map is the pattern to copy so the listeners cannot leak.
- **Tone mapping does survive postproduction** — verified, not assumed: the vendor composes three's
  own `OutputPass`, which reads `renderer.toneMapping`/`toneMappingExposure` and recompiles on
  change. **One trap:** `_outputPass` is composed for every style **except `PEN`**, where tone
  mapping silently does nothing.
- **The camera is untouched** — no walk mode, no `FirstPersonControls` — so the tuned damping and
  cursor-bounded zoom keep working and no second owner appears over `minDistance`/`infinityDolly`.
- **The tab shows a proper blue `Sky` dome, so the configured viewport background is not visible
  there** ([ADR-0027](0027-viewport-background-painted-in-css.md)). By design, not a bug.
- The row primitives the panel needs were promoted from `features/post-render/` to `components/ui/`,
  since CLAUDE.md forbids a feature importing another feature.
