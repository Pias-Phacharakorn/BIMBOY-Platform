# BIM Viewer — ThatOpen / OBC wiring (this app)

> Status: seed — expand as you work this area.
> Documents how **this project** wires ThatOpen. How to *build* a generic OBC component → `_thatopen-bim-component` skill. ThatOpen API reference → `.agents/ThatOpen_docs/` via `thatopen-docs-navigator` skill. Do not duplicate those here.

## Overview

The 3D world is a singleton bootstrapped once in `bim-components/setup/` — never inside React. React reaches the engine through `bimStore`. All `<bim-*>` BUI web components are confined to `ViewportWrapper.tsx` (shadow-DOM isolation); everywhere else uses plain React (`LeftPanel`/`RightPanel`, toolbar components). ThatOpen libs are pinned to **v3.4.x**.

## Key files

- `src/bim-components/setup/src/create-world.ts` — world/engine bootstrap (singleton — don't edit lightly)
- `src/bim-components/setup/src/fragments-manager.ts` — FragmentsManager wiring
- `src/bim-components/setup/src/ifc-loader.ts` — IFC → fragments loading
- `src/bim-components/setup/src/highlighter.ts`, `hoverer.ts`, `items-finder.ts` — selection/hover/query
- `src/bim-components/setup/index.ts` — registers all setup components (the singleton entry)
- `src/react-components/components/bim/ViewportWrapper.tsx` — the ONLY place `<bim-*>` may live
- `src/react-components/components/bim/ViewportToolbar.tsx`, `ToolbarLoadModel.tsx` — viewport UI (React)
- `src/react-components/features/cloud-models/` — `cloudModelsService.ts`, `useCloudModels.ts`, `useAutoLoadCloudModels.ts`
- `src/react-components/components/bim/CloudModelModal.tsx`, `CloudModelLoadingModal.tsx` — cloud load UI
- `src/react-components/store/bimStore.ts` — React's handle to the world/engine

## Patterns & conventions

- OBC bootstrap is a **singleton** in `setup/` — React never constructs the world.
- **New OBC component — step checklist** (moved from AGENTS.md; follow the `_thatopen-bim-component` skill for the full workflow):
  1. Use `_thatopen-bim-component` skill
  2. Place in `bim-components/`
  3. Extend `OBC.Component`, implement `OBC.Disposable`
  4. Use `OBC.Disposer` for all Three.js meshes
  5. Unbind DOM events in `dispose()`
  6. Register in `bim-components/setup/` (singleton)
- `<bim-panel>`/`<bim-grid>`/`<bim-*>` never outside `ViewportWrapper.tsx`.
- Theme via CSS vars (`--bim-*`) in `style.css @theme {}` — no inline overrides.
- Before any OBC feature: check v3.4.x API (breaking changes from v2) via the docs navigator.

## Gotchas / watch-outs

- **Version lock**: ThatOpen pinned v3.4.x — verify peer deps (Three.js ^0.182, web-ifc) before any bump.
- **Teardown / dispose ordering**: `ViewportWrapper` calls `activeComponents.dispose()` on unmount (leaving the model view). `Components.dispose()` disposes the camera/world **before** custom components that reference them, and `world.camera` is a **getter that THROWS** `"No camera initialized!"` once the camera is gone — so `if (world.camera && …)` does *not* guard it. In any custom component's `dispose()`/`_deactivate()`, wrap camera/world/renderer access in `try/catch` (pattern: `SpotCoordinate._deactivate`). `ViewportWrapper` also wraps `dispose()` in `try/catch` as a last-resort safety net so a teardown throw can't trip React's error boundary and tear down the whole app. Regression test: `e2e/model-teardown.spec.ts`.
- _(fill as encountered)_
