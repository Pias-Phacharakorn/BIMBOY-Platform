# New UI React Implementation Tasks

## Goal
Convert `__New_UI-Design` into React components for the current Vite app, using static data first and preserving the design handoff as the visual source of truth.

## Decisions Locked
- Scope: implement all exported app screens.
- Routing: use React Router routes.
- Data: static first for every screen.
- Project data layer: seed static projects through `src/classes/ProjectsManager.ts` and `src/classes/Project.ts`.
- BIM viewer: visual shell only in this pass; no ThatOpen runtime initialization yet.
- Component style: page-first, with shared components only where reuse is obvious.
- Icons: use `src/globals.ts` icon names through an Iconify-backed React component.

## Target Routes
- `/` -> redirect or render Projects page.
- `/projects` -> project selection.
- `/projects/:projectId/model` -> BIM Model visual workspace.
- `/projects/:projectId/standard` -> Project Standard.
- `/projects/:projectId/clashes` -> Clash Detection.
- `/projects/:projectId/documents` -> Document Status.
- `/projects/:projectId/settings` -> Project Settings.

## Component Plan
- Shared shell:
  - `AppShell.tsx`
  - `Sidebar.tsx` or shell-owned sidebar markup
  - `WorkspaceHeader.tsx`
  - `Icon.tsx`
- Project list:
  - `ProjectsPage.tsx`
  - `ProjectCard.tsx`
  - `SearchBox.tsx`
- Workspace pages:
  - `ProjectDetailsPage.tsx`
  - `ProjectStandardPage.tsx`
  - `ClashDetectionPage.tsx`
  - `DocumentStatusPage.tsx`
  - `ProjectSettingsPage.tsx`
- Static data:
  - `src/static-data.ts`

## Static Data Requirements
- Projects must be created through `ProjectsManager.newProject(...)`.
- Preserve design sample projects:
  - Hospital Expansion Phase II
  - Data Center North Wing
  - Bridge Terrace South
- Preserve visible static data for:
  - model files
  - clash stats and rows
  - document stats and rows
  - project standard facts, cards, rules, tabs
  - project settings members and connections

## Current Progress
- [x] Read `_PROJECT_STRUCTURE.md`.
- [x] Read `src/classes/Project.ts`.
- [x] Read `src/classes/ProjectsManager.ts`.
- [x] Read the key `__New_UI-Design` HTML/CSS files.
- [x] Added `src/static-data.ts`.
- [x] Added `src/react-components/Icon.tsx`.
- [x] Added `src/react-components/AppShell.tsx`.
- [x] Added `src/react-components/WorkspaceHeader.tsx`.
- [x] Filled starter project components:
  - `ProjectsPage.tsx`
  - `ProjectCard.tsx`
  - `SearchBox.tsx`
  - `ProjectDetailsPage.tsx`
- [x] Added shared shell/header/sidebar components:
  - `AppShell.tsx`
  - `Sidebar.tsx`
  - `WorkspaceHeader.tsx`
  - `Icon.tsx`
- [x] Added remaining page components:
  - `ProjectStandardPage.tsx`
  - `ClashDetectionPage.tsx`
  - `DocumentStatusPage.tsx`
  - `ProjectSettingsPage.tsx`
- [x] Wired `src/index.tsx` with React Router.
- [x] Added global CSS from the design handoff in `src/style.css`.
- [x] Added root TypeScript configs:
  - `tsconfig.json`
  - `tsconfig.node.json`
- [x] Fixed compile issues in the components already added.
- [x] Run `npm run build`.
- [x] Start Vite dev server for visual inspection.

## Verification Checklist
- [x] Project page route responds at `/projects`.
- [ ] Search filters static projects.
- [ ] Card/list toggle works.
- [ ] Project card opens the model workspace.
- [ ] Sidebar collapse persists through `localStorage`.
- [ ] Standard tabs switch content.
- [x] Clash, documents, and settings routes respond with the SPA shell.
- [x] `npm run build` passes when run outside the sandbox.
- [x] `npx.cmd tsc --noEmit` passes.

## Build Notes
- `npm run build` is blocked inside the sandbox because esbuild receives `Access is denied` while loading `vite.config.ts`.
- `npm.cmd run build` passes with escalated permission.
- PowerShell blocks `npm.ps1` because script execution is disabled, so use `npm.cmd` on this machine.
- Vite dev server is running at `http://127.0.0.1:5173/`.
- Browser automation was not available through the tool surface in this turn, so route verification was done with HTTP checks.
- Verified HTTP 200 for:
  - `/projects`
  - `/projects/hxp-ii/model`
  - `/projects/hxp-ii/standard`
  - `/projects/hxp-ii/clashes`
  - `/projects/hxp-ii/documents`
  - `/projects/hxp-ii/settings`

## Notes For Review
- The first implementation should not connect Firebase.
- The first implementation should not initialize ThatOpen/OBC in the viewport.
- If direct `iconify-icon` custom element typing fails, add a local JSX declaration instead of changing the icon strategy.
