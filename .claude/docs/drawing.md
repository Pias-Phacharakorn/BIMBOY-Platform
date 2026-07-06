# Drawing — Drawing Directory & shop-drawing register

> Status: seed — expand as you work this area.
> Roadmap item 4 (Drawing Management, CAD/PDF).

## Overview

The Drawing Directory (`DrawingView`) has two tabs:
- **Folder** — a file browser (`ProjectFolders`) focused on the project's `04_Drawing` folder.
- **Register** — a revision-tracked shop-drawing table (`ShopDrawingTable`). Each sheet (`sheet_no`) has one row per revision; PDFs live in Supabase storage.

Drawings are stored as `shop_drawings` rows + PDF objects in the `project-files` bucket. A sheet accumulates revisions (rev 0 = first upload, then `addRevision`); the highest revision is treated as the latest. Every sheet also has a fixed **discipline** (`01_AR`…`08_SN`), set once at creation and inherited by all its revisions — see Disciplines below.

## Key files

- `src/react-components/views/DrawingView.tsx` — page: `WorkspaceHeader` tabs (Folder/Register), composition only
- `src/routes/projects/$projectId/drawing.tsx` — route → `DrawingView` (composition only)
- `src/react-components/features/shop-drawings/ShopDrawingTable.tsx` — the Register table UI, plus a Discipline column and filter dropdown
- `src/react-components/features/shop-drawings/useShopDrawings.ts` — TanStack Query hooks (list/create/addRevision/delete)
- `src/react-components/features/shop-drawings/shopDrawingsService.ts` — Supabase data + storage access
- `src/react-components/features/shop-drawings/shopDrawingTypes.ts` — `ShopDrawing`, `GroupedDrawing`, `mapShopDrawingRow`
- `src/react-components/features/shop-drawings/disciplines.ts` — `DISCIPLINES` list (single source of truth for the 8 discipline codes/labels), `DisciplineCode` type
- `src/react-components/features/shop-drawings/index.ts` — feature entry
- `src/react-components/features/project-folders/ProjectFolders.tsx` — the Folder tab browser (reused with `focusFolder="04_Drawing"`); groups drawings by discipline, then by sheet
- `src/react-components/components/shop-drawings/AddDrawingDialog.tsx` — create-sheet form; discipline select, lockable via `lockedDiscipline` prop
- Supabase: `shop_drawings` table (incl. `discipline` enum column) + `project-files` storage bucket

## Patterns & conventions

- **Storage layout**: `{projectnumber}_{projectName}/04_Drawing/{discipline}/{sheetNo}/Rev{revision}_{timestamp}.pdf` (see `buildPdfPath`). PDF public URL via `getPdfPublicUrl`. `pdf_path` is stored per-row, not recomputed from convention at read time — so rows created before the discipline segment was added keep working at their original path.
- **Upload-then-insert**: `uploadThenInsert` uploads the PDF first, then inserts the row; if the insert fails it does a best-effort storage cleanup so a retry won't leave an orphaned object at that exact path.
- **Revisions**: multiple `shop_drawings` rows share a `sheet_no`, ordered `sheet_no` asc then `revision` desc; grouped into `GroupedDrawing` where `versions[0]` (max revision) is the latest. `isLatest` on a row is cosmetic — grouping decides latest, not the flag.
- **Disciplines**: fixed global Postgres enum `drawing_discipline` (`01_AR`, `02_ST`, `03_LA`, `04_CV`, `05_AC`, `06_EE`, `07_FP`, `08_SN` — same list for every project, not project-configurable). Set once via `AddDrawingDialog` when a sheet is first created; `addRevision` always inherits the sheet's existing discipline and cannot change it. `disciplines.ts` is the single source of truth for the ordered list + labels — both the Folder tree and the Register filter/column read from it.
- **Folder tab tree**: renders all 8 discipline folders always (even with zero drawings), collapsed by default. Each discipline row has its own "+" that opens `AddDrawingDialog` with `lockedDiscipline` set, so the dropdown is pre-filled and disabled. In the Register tab, the same dialog is opened without `lockedDiscipline` — the user picks manually.
- **Admin gate**: create/revise/delete gated by `useIsProjectAdmin` (project admin or `hub_admin`).
- Data access stays in `shopDrawingsService.ts` wrapped by `useShopDrawings.ts` — see `backend.md`.

## Gotchas / watch-outs

- `deleteShopDrawing` removes the storage object *before* the row — a storage failure aborts before the DB delete, but a DB-delete failure leaves the object already gone. Keep that ordering in mind when changing delete logic.
- `isLatest` is not a source of truth — never branch on it for correctness; rely on the grouped max-revision.
- The Folder tab depends on the `04_Drawing` folder convention; changing project folder names breaks the focused browse.
- Discipline is immutable after sheet creation by design — there's no UI to move a sheet to a different discipline once created. A mis-assigned sheet currently has no fix path short of a manual DB update.
- Sheet expand/compare/upload state in `ProjectFolders.tsx` is keyed by `discipline::sheetNo` (not just `sheetNo`), since the same sheet number could in principle recur under a different discipline.
- _(fill as encountered)_
