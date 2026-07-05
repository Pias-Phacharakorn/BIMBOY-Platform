# Drawing — Drawing Directory & shop-drawing register

> Status: seed — expand as you work this area.
> Roadmap item 4 (Drawing Management, CAD/PDF).

## Overview

The Drawing Directory (`DrawingView`) has two tabs:
- **Folder** — a file browser (`ProjectFolders`) focused on the project's `04_Drawing` folder.
- **Register** — a revision-tracked shop-drawing table (`ShopDrawingTable`). Each sheet (`sheet_no`) has one row per revision; PDFs live in Supabase storage.

Drawings are stored as `shop_drawings` rows + PDF objects in the `project-files` bucket. A sheet accumulates revisions (rev 0 = first upload, then `addRevision`); the highest revision is treated as the latest.

## Key files

- `src/react-components/views/DrawingView.tsx` — page: `WorkspaceHeader` tabs (Folder/Register), composition only
- `src/routes/projects/$projectId/drawing.tsx` — route → `DrawingView` (composition only)
- `src/react-components/features/shop-drawings/ShopDrawingTable.tsx` — the Register table UI
- `src/react-components/features/shop-drawings/useShopDrawings.ts` — TanStack Query hooks (list/create/addRevision/delete)
- `src/react-components/features/shop-drawings/shopDrawingsService.ts` — Supabase data + storage access
- `src/react-components/features/shop-drawings/shopDrawingTypes.ts` — `ShopDrawing`, `GroupedDrawing`, `mapShopDrawingRow`
- `src/react-components/features/shop-drawings/index.ts` — feature entry
- `src/react-components/features/project-folders/ProjectFolders.tsx` — the Folder tab browser (reused with `focusFolder="04_Drawing"`)
- Supabase: `shop_drawings` table + `project-files` storage bucket

## Patterns & conventions

- **Storage layout**: `{projectnumber}_{projectName}/04_Drawing/{sheetNo}/Rev{revision}_{timestamp}.pdf` (see `buildPdfPath`). PDF public URL via `getPdfPublicUrl`.
- **Upload-then-insert**: `uploadThenInsert` uploads the PDF first, then inserts the row; if the insert fails it does a best-effort storage cleanup so a retry won't leave an orphaned object at that exact path.
- **Revisions**: multiple `shop_drawings` rows share a `sheet_no`, ordered `sheet_no` asc then `revision` desc; grouped into `GroupedDrawing` where `versions[0]` (max revision) is the latest. `isLatest` on a row is cosmetic — grouping decides latest, not the flag.
- **Admin gate**: create/revise/delete gated by `useIsProjectAdmin` (project admin or `hub_admin`).
- Data access stays in `shopDrawingsService.ts` wrapped by `useShopDrawings.ts` — see `backend.md`.

## Gotchas / watch-outs

- `deleteShopDrawing` removes the storage object *before* the row — a storage failure aborts before the DB delete, but a DB-delete failure leaves the object already gone. Keep that ordering in mind when changing delete logic.
- `isLatest` is not a source of truth — never branch on it for correctness; rely on the grouped max-revision.
- The Folder tab depends on the `04_Drawing` folder convention; changing project folder names breaks the focused browse.
- _(fill as encountered)_
