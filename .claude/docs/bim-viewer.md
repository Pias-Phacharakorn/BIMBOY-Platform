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

- **Cloud auto-load is per-project & opt-out.** `useAutoLoadCloudModels` loads every `.frag` under a project's `02_frag` folder on open, gated by the `auto_load_cloud_models` boolean column on `projects` (`DEFAULT true`). The toggle lives in `CloudModelModal.tsx`'s header, is admin-only (`useIsProjectAdmin`; non-admins see it read-only), and is read/written through the `projects` **table** (`useProject`/`useUpdateProject`) — not the `active_projects` view. Disabling only suppresses the *next* auto-load; it never unloads models already in the viewer, and manual load (Cloud Models picker, Load IFC/FRAG) is unaffected. The bail in `useAutoLoadCloudModels` sits **after** the project-switch dispose block so switching into a disabled project still cleans up the previous project's models.
- **2D Views (plans + elevations) auto-generate on load.** The built-in `OBC.Views` is wired in `setup/src/views.ts` (`setupViews` sets `views.world` + `OBC.Views.defaultRange`), registered in `setup/index.ts`. UI is `components/bim/Views2DList.tsx` — a "2D Views" `PanelSection` under Models List on the Models tab (plain React, no `<bim-*>`). It subscribes a **debounced regenerate-all** to *both* `fragments.list.onItemSet` **and** `onItemDeleted`: `views.close()` → `views.list.clear()` → `createFromIfcStoreys()` + `createElevations({ combine: true })`. Clear-and-recreate is safe because this section owns the list (no user-created section views in this cut) — the later interactive-sections feature must preserve user views instead. Plans vs elevations are grouped by diffing `views.list.keys()` before/after each create call (the key is the `open(id)` argument). Effect cleanup removes only the fragment listeners — it never touches `views`/camera (ViewportWrapper owns world teardown; `world.camera` throws once disposed).
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
- **PostproductionRenderer camera swaps need a manual resync.** The world uses `OBF.PostproductionRenderer` with postproduction **enabled** (`setup/src/highlighter.ts`, for the outliner). Its composer renders from the camera captured by the last `postproduction.updateCamera()`; swapping `world.camera` (as `OBC.Views.open()` does — it sets `world.camera = view.camera`) does **not** re-sync it, so the viewport stays on the old camera while global/material-level clip planes still apply (symptom: section cut appears but the camera never moves to the plan view). After any code that swaps `world.camera`, call `(world.renderer as any).postproduction?.updateCamera()`. Precedents: `ToolbarSettings.tsx` (projection toggle), `Views2DList.tsx` (open/close/regen). The **ViewCube** (`setup/src/view-cube.ts`) and the **toolbar projection dropdown** (`ToolbarSettings.tsx`) also don't follow camera swaps on their own — both now subscribe to `world.onCameraChanged` to rebind/refresh.
- _(fill as encountered)_
