# Plan: Migrate Shop Drawing Register from `___QR Prompt Check` into BIM-BOY

## 📌 Goal

Port the revision-tracked Shop Drawing register from the reference project into BIM-BOY as a "Register" tab on the Drawing route, backed by real Supabase Storage folders (one per sheet) and a project-scoped `shop_drawings` table.

## 🪜 Staged Migration

| Phase | Scope | Status |
| :--- | :--- | :--- |
| 1. UI only | `ShopDrawingTable` + dialogs wired into "Register" tab, driven by mock data — no backend | ✅ Shipped, then superseded by Phase 2 |
| **2. Folder-based data layer** | Real Storage folders (`04_Drawing/{sheetNo}/`), `shop_drawings` table + RLS, `useShopDrawings` hooks replacing mock data, real PDF preview | ✅ **Shipped — this is the current state** |
| **3. Permissions** | `useIsProjectAdmin` gating on Add/Upload/Delete | ✅ **Shipped** |

## Current Flow (as shipped)

```
┌────────────────────────────────────────┐
│ routes/projects/$projectId/drawing.tsx │  ← route, composition only
└───────────────┬─────────────────────────┘
                ▼
┌────────────────────────────────────────┐
│ views/DrawingView.tsx                  │  tabs=["Folder","Register"]
└──────┬────────────────────┬─────────────┘
       │ Folder              │ Register
       ▼                     ▼
┌──────────────────┐  ┌──────────────────────────────────────────┐
│ ProjectFolders   │  │ features/shop-drawings/ShopDrawingTable  │
│ subFolders =     │  │  useShopDrawings(project.id) → real query│
│  01_ifc, 02_frag,│  │  groupedDrawings: sort/filter/group by   │
│  03_ClashImport  │  │  sheet_no, derives "latest" (max revision)│
│ (04_Drawing no   │  └──────┬─────────────────────────────────────┘
│  longer listed   │         ▼
│  here — owned by │  components/shop-drawings/*.tsx
│  Register now)   │  (Add/Upload/Delete/Compare/View — real
└──────────────────┘   mutations + real <iframe> PDF preview)
                              │
                              ▼
                       shopDrawingsService.ts (storage-first, DB-second)
                              │
                ┌─────────────┴─────────────────────────────┐
                ▼                                            ▼
   Supabase table shop_drawings                Storage bucket "project-files"
   RLS: is_project_member(project_id, uid)      {projectnumber}_{projectName}/
        or is_hub_admin()                        04_Drawing/{sheetNo}/
   unique(project_id, sheet_no, revision)         Rev{n}_{timestamp}.pdf
```

**Removed:** `mockShopDrawings.ts`, the Phase-1 "not stored yet" disclaimers in `UploadPdfDialog`/`PdfViewerModal`, the `04_Drawing` entry in `ProjectFolders`'s `subFolders`, the now-meaningless Revision input in `AddDrawingDialog` (server always assigns revision 0 for a new sheet).

## Key decisions (resolved via `/grill-with-docs`)

1. Each sheet is a **real Storage folder**: `project-files/{project.projectnumber}_{project.projectName}/04_Drawing/{sheetNo}/`.
2. "Register" **replaced** the generic "Folder" tab's role for `04_Drawing` entirely.
3. Metadata lives in a **`shop_drawings` table** (one row per revision) — mirrors the clash-import migration's precedent of relational metadata over blob/path-encoded data.
4. "Add Drawing" **requires the first PDF at creation** — structurally enforced (insert only follows a successful upload), never a PDF-less sheet.
5. Revision files: **`Rev{n}_{timestamp}.pdf`**.
6. **No `is_latest` column** — latest is derived by sorting revisions descending, same as Phase 1's logic (kept unchanged).
7. **Delete removes one revision** (row + Storage object), not the whole sheet.
8. **PDF preview is real** (`<iframe>` in `PdfViewerModal`) since the underlying data is now real.

## Files Changed (Phase 2)

```
[NEW] supabase/migrations/20260703050000_create_shop_drawings_schema.sql
[NEW] src/react-components/features/shop-drawings/shopDrawingsService.ts
[NEW] src/react-components/features/shop-drawings/useShopDrawings.ts
[MOD] src/react-components/features/shop-drawings/shopDrawingTypes.ts   (+ mapShopDrawingRow)
[MOD] src/react-components/features/shop-drawings/ShopDrawingTable.tsx (real data, project prop)
[DEL] src/react-components/features/shop-drawings/mockShopDrawings.ts
[MOD] src/react-components/components/shop-drawings/AddDrawingDialog.tsx (PDF required, dropped revision field)
[MOD] src/react-components/components/shop-drawings/UploadPdfDialog.tsx  (dropped Phase-1 disclaimer)
[MOD] src/react-components/components/shop-drawings/PdfViewerModal.tsx   (real <iframe> preview)
[MOD] src/react-components/features/project-folders/ProjectFolders.tsx   (dropped 04_Drawing)
[MOD] src/react-components/views/DrawingView.tsx  (dropped focusFolder, passes project into ShopDrawingTable)
[MOD] src/integrations/supabase/types.ts  (regenerated)
```

`DeleteDrawingDialog.tsx` and `CompareDrawingsModal.tsx` needed no changes.

## Accepted edge cases

- **Revision races**: `unique (project_id, sheet_no, revision)` rejects concurrent duplicate uploads; surfaced as a friendly retry message (Postgres `23505`). Loser's Storage file becomes an inert, timestamped orphan.
- **Partial-failure orphans**: storage-first/DB-second with best-effort cleanup on insert failure; no reconciliation job.
- **No edit path**: fixing a typo'd sheet name/author means delete + recreate (rows are immutable, matching the agreed field list).
- **Missing historical migrations**: `is_project_member`/`is_hub_admin` are defined in an earlier migration not present in this repo's `supabase/migrations/` folder — pre-existing repo-hygiene gap, not introduced by this feature.

## Phase 3 — Permissions (shipped)

`DrawingView.tsx` already computed `showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin")` for its settings-panel gate — reused directly, passed down as `<ShopDrawingTable project={project} isAdmin={showSettings} />`.

`ShopDrawingTable.tsx` now takes an `isAdmin: boolean` prop:
- "Add Drawing" button (header) — hidden unless `isAdmin`.
- Per-row "Upload PDF / Add Revision" and "Delete drawing" buttons — hidden unless `isAdmin`.
- "View PDF", "Download PDF", "Compare versions" — unchanged, visible to any project member (read access, matches the `select` RLS policy which already allows all project members).

Note: this is UI-level gating only, matching the existing `showSettings` convention elsewhere in the app — the underlying RLS `insert`/`delete` policies still allow any project member (not just admins), consistent with how the rest of the schema (e.g. `clash_reports`) draws the member/admin line at the UI layer rather than in RLS.

## Phase 4 — Restore `04_Drawing` to the Folder tab, as a read-only tree (shipped)

Follow-up request: bring `04_Drawing` back into the generic "Folder" tab, but instead of the old flat file list, render a 3-level tree sourced from the `shop_drawings` table:

```
04_Drawing
|-- {sheetNo}_{sheetName}        ← per-sheet "bucket", label joined from shop_drawings
    |-- {sheetNo}-{sheetName}-Rev{n}  ← one row per revision, download-only
```

Decisions (resolved via `/grill-with-docs`):
1. Bucket label is `{sheetNo}_{sheetName}` — joined from the `shop_drawings` table (fetched via the existing `shopDrawingsService.listShopDrawings`) — but the real Storage `list()` call underneath still only ever touched `{sheetNo}` (no path/Storage renaming).
2. File label is `{sheetNo}-{sheetName}-Rev{n}`, not the raw timestamped filename (`Rev0_1751500000000.pdf`) and not a generic "Revision 0" placeholder.
3. Only `04_Drawing` gets this 3-level tree — `01_ifc`/`02_frag`/`03_ClashImport` are untouched, still flat Storage listings.
4. `DrawingView.tsx`'s "Folder" tab is scoped via `focusFolder="04_Drawing"` — it shows only the drawing tree, not the other three subfolders (those still appear in `SettingsView.tsx`'s unscoped Folder tab, which lists all four).

Implementation: `ProjectFolders.tsx` special-cases `subFolder === "04_Drawing"` — on expand it calls `shopDrawingsService.listShopDrawings(project.id)` (same call Register makes) instead of `supabase.storage.list()`, groups rows by `sheet_no`, and renders the two extra tree levels with its own `expandedSheets` state. No new files in this phase — only `ProjectFolders.tsx` and `DrawingView.tsx` changed.

## Phase 5 — Add/Upload + click-to-view in the Folder-tab tree (shipped)

Follow-up: Phase 4 was read-only; the developer then asked for write parity (minus delete) and click-to-preview, reopening part of the "Register is the sole management surface" decision.

Decisions (resolved via `/grill-with-docs`):
1. **Reuse Register's components/hooks directly** — `AddDrawingDialog` + `useCreateShopDrawing()`, `UploadPdfDialog` + `useAddShopDrawingRevision()`, and `PdfViewerModal`, all imported into `ProjectFolders.tsx` rather than reimplemented.
2. **Both** new-sheet creation ("+ New Drawing" on the `04_Drawing` folder row) **and** new-revision upload (an Upload icon per sheet bucket row) — not just creation.
3. **Admin-gated**, consistent with Register: both actions require the new `isAdmin` prop. `DrawingView.tsx` and `SettingsView.tsx` both pass their existing `showSettings` (`useIsProjectAdmin`) flag through.
4. **Clicking the filename** (not a separate icon) opens `PdfViewerModal` — Download stays as a separate icon.
5. **Delete remains Register-only** — not reopened.

Implementation notes:
- `ProjectFolders.tsx` manages `shopDrawings` as local `useState`, not via the `useShopDrawings` TanStack Query hook Register uses — so after a successful create/upload mutation here, the `onSuccess` callback calls `fetchShopDrawings()` directly to refresh this component's own tree (the mutation's cache invalidation only affects Register's query, not this local state).
- `UploadPdfDialog` expects the mapped `ShopDrawing` view-model (for `.currentRevision`), so the target row is passed through the existing `mapShopDrawingRow` helper rather than duplicating that mapping.
- `PdfViewerModal`'s `pdfUrl` is resolved on demand via `shopDrawingsService.getPdfPublicUrl(row.pdf_path)`, same as Register.

## Phase 6 — Real "Compare Revisions" (shipped)

`CompareDrawingsModal.tsx` was a placeholder since Phase 1. Studied the reference project's `CompareDocumentsModal.tsx` + `pdf-tools/PdfSliderCompare.tsx` (full-featured: pdfjs-dist render-to-canvas, pixel-diff overlay, slider, zoom, PDF export via jspdf, an "open in new tab" result page) and scoped an MVP via `/grill-with-docs`:

Decisions:
1. **MVP scope only** — render both PDFs' first page to canvas via `pdfjs-dist` and show them in a draggable slider. Dropped: pixel-diff overlay mode, zoom controls, PDF export, open-in-new-tab result page/route. `pdfjs-dist@^4.4.168` added as BIM-BOY's first PDF-rendering dependency (self-contained, no conflict with pinned ThatOpen/Three.js versions).
2. **Dropdown pickers for both sides**, defaulting to the two newest revisions on open — same UX as the reference, lets any pair be compared, not just adjacent revisions.
3. **Available from both surfaces** — Register's existing Compare button, and a new Compare icon added per sheet bucket row in the Folder-tab tree (`ProjectFolders.tsx`), enabled once a sheet has ≥2 revisions (every row always has a PDF, since creation requires one — no separate "has PDF" check needed here unlike Register's original filter).

Implementation:
- `src/react-components/components/shop-drawings/PdfSliderCompare.tsx` (new) — adapted from the reference's slider component, restyled to BIM-BOY's design tokens (`bg-accent` for the handle, `border-border`/`bg-surface-alt` instead of shadcn tokens), zoom removed (fixed at 100%), middle-click panning removed (not needed without zoom).
- `CompareDrawingsModal.tsx` (rewritten) — same prop signature as before (`isOpen`, `onClose`, `drawingNo`, `versions: ShopDrawing[]`), so `ShopDrawingTable.tsx` needed no changes. Fetches both selected PDFs directly (BIM-BOY's bucket is public, no signed-URL step needed unlike the reference), renders page 1 of each to a canvas data URL, feeds both into `PdfSliderCompare`.
- `ProjectFolders.tsx` — added a `compareSheet` state + Compare icon button per sheet-bucket row, reusing `mapShopDrawingRow` to convert the sheet's raw rows into `ShopDrawing[]` for the modal (same conversion Upload/View already use).

## Phase 6.1 — Per-side page selectors (shipped)

Follow-up: shop drawing PDFs can be multi-page, but Compare only ever rendered page 1. Resolved via `/grill-with-docs`:

1. **Two independent page selectors** (one per side), not one shared page number — since revisions can have different page counts/ordering, "page 3 of A" isn't guaranteed to correspond to "page 3 of B."
2. **Resets to page 1** whenever that side's revision dropdown changes — the old page number may not even exist in the newly selected PDF.

Implementation: `CompareDrawingsModal.tsx` restructured around a `usePdfSide(pdfUrl)` hook — each side now owns its own `pdfjs-dist` document object (`PDFDocumentProxy`, exposing `.numPages`), selected page, render, loading, and error state, fully independent of the other side. Splits the old single `renderFirstPageToDataUrl` into `loadPdfDocument` (fetch + parse once per revision) and `renderPageToDataUrl(doc, pageNumber)` (re-render on page change without re-fetching). A page `<select>` sits next to each revision `<select>`, populated from that side's own `numPages`.

## Phase 6.2 — Full-screen, zoom, and pan for Compare (shipped)

Resolved via `/grill-with-docs`:

1. **Full-screen, edge-to-edge**, matching `PdfViewerModal`'s treatment — header bar (title, zoom controls, close) pinned at top, slider fills the rest of the viewport, no backdrop/card.
2. **Button-based zoom** — +/- in 25% steps, 50%–300% range, reset-to-100% button, percentage readout — same scheme as the reference project.
3. **Pan via a dedicated Move-handle icon, not middle-click or a modifier key.** `PdfSliderCompare`'s slider-drag already owns left-click-drag on the image itself; a small floating `Move` icon button sits above the scroll container and captures its own pointer on press, so dragging from that icon pans the container (scrolls it) regardless of where the cursor moves next, with zero conflict with the slider's drag gesture — works on trackpads, no middle-click or keyboard needed.

Implementation:
- `PdfSliderCompare.tsx` — restructured so the scrollable image container is `absolute inset-0` inside a `relative` wrapper, with the Move-handle button floating `absolute` above it (not `sticky`-in-flow, avoiding layout hacks). Added a `zoomLevel` prop back (scales the inner content width; container scrolls to reveal the rest) and a separate `handlePanPointerDown/Move/Up` trio using `setPointerCapture` on the Move button itself.
- `CompareDrawingsModal.tsx` — outer wrapper changed to the same `fixed inset-0 flex flex-col` full-screen shell as `PdfViewerModal`; zoom state + `ZoomIn`/`ZoomOut`/`RotateCcw` controls added to the header; `PdfSliderCompare` now gets `height="100%"` inside a `flex-1 min-h-0` wrapper instead of a fixed `60vh`.

## Phase 6.3 — Inverted slide/pan trigger, relocated zoom row (shipped)

Follow-up from a screenshot review: the Move button from 6.2 rendered awkwardly and added an extra control the user didn't want. Resolved via `/grill-with-docs`:

1. **Removed the Move button entirely.**
2. **Inverted the interaction model**: pressing down specifically on the slider handle (the `⟨⟩` circle marking the divider) now drags the slider; pressing down anywhere else on the image now pans/scrolls the view. No separate pan button needed — ordinary click-drag on empty space pans, matching common image-viewer conventions.
3. **Larger invisible hit-zone around the handle** (~40px) so it's not fiddly to grab precisely, while the visible circle stays small (~24px).
4. **Cursor-only affordance** — `grab`/`grabbing` cursor over the pannable area, `col-resize` cursor over the handle's hit-zone; no additional visual chrome, just updated instruction text.
5. **Zoom controls moved out of the header** into their own centered row in `CompareDrawingsModal.tsx`, between the revision/page selectors and the slider — not floating over the image.

Implementation: `PdfSliderCompare.tsx` — swapped which element owns which pointer handlers. The container's `onPointerDown/Move/Up` now drive panning (`handlePanPointerDown` etc., using `container.setPointerCapture`); a new `40px` invisible wrapper `div` positioned exactly at the handle's location owns `onPointerDown/Move/Up` for sliding (`handleSlidePointerDown` etc., with `e.stopPropagation()` so a press on the handle never also triggers the container's pan handler). `CompareDrawingsModal.tsx` — zoom button cluster relocated from the header into a new centered `flex-none` row.

---

**Status:** Phases 1–6.3 all shipped and verified (`tsc --noEmit`, `vite build` clean after each phase; `mcp__supabase__get_advisors` clean after Phase 2/3 — no new security lints from the `shop_drawings` table).
