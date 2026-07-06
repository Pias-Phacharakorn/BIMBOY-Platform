# CONTEXT

## Drawing discipline grouping (04_Drawing)

Adding a discipline layer between the `04_Drawing` folder and the existing
per-sheet revision buckets, so the Folder tab tree becomes:

```
04_Drawing
├── 01_AR
│   └── {sheetNo} (bucket)
│       └── Rev0, Rev1, ...
├── 02_ST
├── 03_LA
├── 04_CV
├── 05_AC
├── 06_EE
├── 07_FP
└── 08_SN
```

### Decisions

- **"Bucket" terminology**: no collision after clarification — the user's
  "bucket of drawing" concept *is* the existing per-sheet revision group
  already implemented as `groupedShopDrawings` in
  `src/react-components/features/project-folders/ProjectFolders.tsx`. No
  renaming needed.
- **Discipline codes**: fixed global enum, same 8 for every project (not
  project-configurable). `AC` = Mechanical/HVAC, `SN` = Sanitary/Plumbing
  (not Acoustic/Signage).
- **Storage**: `discipline` is an **explicit column** on `shop_drawings`
  (not parsed from `sheet_no`), set once at sheet creation and inherited by
  all revisions of that sheet — immutable after creation via `addRevision`.
- **Enum values stored** (matches existing codebase convention of
  `create type ... as enum` seen in `clash_type`/`clash_status` in
  `supabase/migrations/20260702090024_create_clash_import_schema.sql`):
  `'01_AR', '02_ST', '03_LA', '04_CV', '05_AC', '06_EE', '07_FP', '08_SN'`
  — the full folder-name string is the stored value (not a bare short code
  with prefix derived in the UI).
- **Storage path**: the Supabase Storage path *does* change to nest under
  discipline: `.../04_Drawing/{discipline}/{sheetNo}/Rev{n}_{timestamp}.pdf`
  (extends `buildPdfPath`). Because `pdf_path` is stored per-row (not
  recomputed from convention at read time), **no file-move migration is
  needed** — existing rows keep their current path; only new uploads use
  the new nested path.
- **Backfill**: production has exactly 3 existing `shop_drawings` rows
  (sheets `A101` x2 revisions, `A-102`), all unambiguously Architecture.
  The migration backfills these to `discipline = '01_AR'` directly, then
  sets the column `NOT NULL` in the same migration — no nullable/unassigned
  state ever exists in the app.
- **Register tab** (`ShopDrawingTable.tsx`) gets a new sortable Discipline
  column plus a dropdown filter (All + 8 codes) above the table — kept in
  sync with the Folder tab's grouping rather than being discipline-agnostic.
- **Empty disciplines**: all 8 discipline folders always render in the tree
  (with a "0" count badge), even with zero drawings — not data-driven.
- **Add-new-drawing entry point**: moves from the single `04_Drawing`-level
  "+" to a **per-discipline "+"** on each discipline folder row (same
  pattern as existing per-sheet Upload/Compare row actions). Opens
  `AddDrawingDialog` with that discipline pre-filled/locked.
- **Default expand state**: all 8 discipline folders start **collapsed**
  when `04_Drawing` is focused (matches current no-auto-expand behavior for
  sheet buckets).

### Open follow-ups (not yet decided / out of scope for this round)

- Cross-tab linking (clicking a discipline in Folder tab pre-filtering
  Register tab) — not requested, treat as future enhancement.
- No admin-configurable per-project discipline list — deliberately fixed
  global for now; would need a `disciplines` table if that changes later.

See `.agents/docs/drawing.md` (mirrored `.claude/docs/drawing.md`) for the
existing Drawing feature guide — update both in the same change once this
is implemented, per `CLAUDE.md`'s "Keep the Domain Guides in sync" rule.

## Compare Revisions viewer — center content when zoomed out

`src/react-components/components/shop-drawings/PdfSliderCompare.tsx` renders
the compared PDF pages in a `div` whose width is `zoomLevel * 100%` inside an
`overflow-auto` container. Below 100% zoom the content is narrower than the
container but stays left/top-aligned, leaving dead space on the right/bottom
(and likely the same vertically, since image height follows the PDF's aspect
ratio rather than the fixed container `height`).

### Decisions

- **Both axes**: center horizontally *and* vertically when zoomed-out content
  is smaller than the container — same root cause, same fix mechanism.
- **Slider/pan math must be fixed in the same change**: `updateSlider` (drag
  the reveal slider) and `handlePanPointerMove` (drag-to-pan) both currently
  assume the content's top-left corner is flush with the container's — true
  today only because content is always left/top-aligned. Once centered, that
  assumption breaks exactly in the zoomed-out case being fixed, so shipping
  centering alone would trade a visual bug for a worse interactive one.
- **Mechanism** (implementation note, not a product decision): use CSS that
  resolves to a no-op when content overflows — plain block-layout
  `margin: auto` naturally does this, but only centers on the axis it
  applies to in normal flow (no built-in vertical case). Do **not** reach for
  flexbox/grid `align-items: center` / `justify-content: center` directly on
  the scrollable container — with `overflow: auto` and a child bigger than
  the container, that's the well-documented flex/grid "unsafe" centering
  overflow bug where part of the oversized content becomes unreachable by
  scroll. Standard fix: a centering wrapper with `min-width: 100%` /
  `min-height: 100%` (not `width`/`height`) so it grows to fit an oversized
  child instead of clamping it — centering only ever activates when there's
  genuine leftover space.

See `.agents/docs/drawing.md` for the Drawing feature guide this component
supports.
