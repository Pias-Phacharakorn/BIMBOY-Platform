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

## Drawing Directory Folder tab — tree + table layout

Replacing the current single-pane nested/inline-expand tree (in
`ProjectFolders.tsx`, used focused on `04_Drawing` by `DrawingView.tsx`) with
a two-pane master-detail layout: a left folder tree + a right data table,
matching an Autodesk ACC/BIM 360 Docs-style browser (reference screenshot
provided by the user). Note: in the reference itself, most of its columns
(Description, Version, Indicators, Markups, Issues, Size) show `--` for
every row — i.e. even Autodesk's own product leaves most of that metadata
empty; only Name and Last updated carry real data in the example.

### Decisions

- **Scope**: only the Drawing Directory's Folder tab (`DrawingView.tsx`'s
  focused `04_Drawing` case) gets this redesign. The general Project Files
  Directory (Settings page, unfocused `ProjectFolders`, showing
  `01_ifc`/`02_frag`/`03_ClashImport`/`04_Drawing` as flat Storage listings)
  keeps its current inline-tree UI unchanged — those are raw file listings
  with no document-management metadata to show in a table. Implementation
  note: this likely means a new dedicated component (not a mode-flag inside
  `ProjectFolders.tsx`) consuming a shared data hook, so the two presentations
  don't duplicate the shop-drawings fetch/group logic.
- **Tree depth**: the left tree stops at discipline folders
  (`04_Drawing` → `01_AR`...`08_SN`). Individual sheets never appear in the
  tree — only in the right-hand table once a discipline is selected. Matches
  the reference exactly (its tree stops at folder level; documents only
  appear in the table).
- **Row granularity**: one row per **sheet**, not per revision. The row
  shows the sheet's latest revision (Name, Author, Last updated); a
  `Version` column shows `Rev {latestRevision}`. This is a UX change from
  today's inline per-revision sub-rows.
- **Row actions**: a single kebab (⋮) menu per row — View, Download,
  Compare revisions (disabled if <2 revisions, same as today), Upload New
  Revision (admin-only, same as today), and Revision History. Replaces
  today's always-visible inline icon buttons, which don't scale to 5 actions.
- **Revision History action**: switches `DrawingView`'s active tab to
  **Register** and pre-fills its sheet-number filter to that sheet, reusing
  the existing Register table instead of building a second revision-history
  UI. Requires lifting Register's sheet-number filter state (or an
  equivalent initial-filter prop) up so `DrawingView` can drive it.
- **Columns**: `Name`, `Author`, `Version` (`Rev N`), `Last updated`, plus
  the ⋮ actions column. Dropped `Description`/`Indicators`/`Markups`/`Issues`
  (no underlying data or feature — these are ACC-specific integrations we
  don't have) and `Size` (would require an extra Storage metadata lookup per
  sheet with no clear payoff for PDFs).
- **No bulk select**: no row checkboxes / bulk actions — not requested, and
  every existing action is already scoped to a single sheet.
- **Add Drawing entry point**: moves from a per-discipline "+" icon on the
  tree row to a "+ Add Drawing" button above the table, scoped to whichever
  discipline is currently selected — matches the Register tab's existing
  button pattern.
- **Initial state**: nothing selected on first load — the right pane shows
  an empty "select a discipline folder" prompt rather than auto-selecting
  `01_AR`.
- **Row click**: clicking a sheet row opens the PDF viewer directly (same
  as today's click-to-view on the file name), in addition to View being
  offered in the kebab menu for discoverability.

- **Author auto-set to uploader, not editable**: `AddDrawingDialog`'s free-text
  Author field is replaced by the current logged-in user, set automatically
  and not user-editable. The `profiles` table has no display-name column
  (only `uid`, `email`, `hub_role`, `is_active`), so the stored value is the
  uploader's **email** (`user.email` from `useAuth()`) — the only identity
  string guaranteed to exist regardless of login method (email/password or
  OAuth). `addRevision` already inherits `author` from the sheet's existing
  value rather than re-prompting, so no change needed there — this only
  affects the create-new-sheet form.

See `.agents/docs/drawing.md` for the Drawing feature guide this affects.

## Drawing Folder Explorer — deeper tree, search/export, required revision reason

Three follow-up changes to `DrawingFolderExplorer.tsx`, revising some of the
decisions in the section above.

### 1. Tree now goes discipline → sheet → revision (reverses "tree stops at discipline")

The earlier decision that "the left tree stops at discipline folders" is
**reversed**. Re-examining the original ACC reference screenshot: its tree is
a real nested file tree, and the table always mirrors whatever's currently
selected in the tree — that's the actual pattern being asked for, generalized
one level deeper each time.

- **Tree levels**: `04_Drawing` → 8 discipline folders → sheet folders
  (`{sheetNo}_{sheetName}`) → revision files (`Rev0`, `Rev1`, `Rev2`...).
  Disciplines and sheets are expand/collapse folder nodes; revisions are leaf
  files.
- **Table mirrors tree selection depth**: selecting a discipline shows its
  sheets as rows (unchanged from before). Selecting a sheet folder shows its
  individual **revisions** as rows instead — each with its own Author/Last
  updated (and now Reason, see below).
- **Expand vs. select are independent**, like a normal file explorer: clicking
  a discipline/sheet row both toggles its tree expansion and sets it as the
  table's selection; expanding a node doesn't require it to be selected, and
  selecting elsewhere doesn't collapse previously-expanded nodes.
- **Revision leaf click**: clicking a revision file in the tree opens the PDF
  viewer directly (same "click to view" convention as everywhere else in this
  feature), since it's a leaf with nothing further to select into.
- **"Revision History" kebab action removed**: redundant now that clicking a
  sheet folder shows all its revisions without leaving the Folder tab. This
  also removes `DrawingView`'s `pendingRegisterFilter` deep-link plumbing and
  `DrawingFolderExplorer`'s `onViewRevisionHistory` prop entirely — the
  Register tab remains reachable by switching tabs normally, just without the
  auto-filter shortcut.
- **Sheet-level top button**: when a sheet is selected, the button above the
  table changes from "+ Add Drawing" to "+ Upload New Revision", scoped to
  that sheet — parallel to how "+ Add Drawing" is scoped to the selected
  discipline. Also still reachable via the discipline-level sheet row's kebab
  menu.
- **Revision row kebab menu**: View + Download only. Compare Revisions and
  Upload New Revision stay at the sheet level (top button / discipline-level
  row) — a single past revision doesn't have its own "compare" or "upload"
  action.

### 2. Search bar + Export

- **Search**: scoped to whatever's currently selected (discipline or sheet)
  — filters the visible table's rows by name/number, not a global
  cross-discipline search. Simpler and consistent with how the table already
  works; requires the right discipline/sheet already selected.
- **Export**: a button that exports the **currently visible table** (sheet
  list or revision list, whichever is showing) as a CSV — a document-register
  export, not a bundle of the actual PDF files. Columns match whatever's
  displayed at that level.

### 3. Required Reason on new revisions

- **Scope**: applies only to `UploadPdfDialog` (adding revision 1+ to an
  existing sheet), **not** `AddDrawingDialog` (creating a sheet's revision 0)
  — matches the user's own framing ("when add new Revision").
- **Validation**: a required text box; submitting with it empty (after trim)
  blocks the upload, same validation style as the existing Sheet
  Number/Sheet Name checks in `AddDrawingDialog`.
- **Storage**: new nullable `reason` column on `shop_drawings` (nullable
  because existing rows and all revision-0 rows have none), with a DB-level
  check constraint (`revision = 0 or reason is not null`) as defense in
  depth — matches this codebase's existing pattern of enforcing invariants at
  the DB layer (e.g. the `discipline` NOT NULL migration), not just in the
  form.
- **Display**: shown as a new **Reason** column in the revision-level table
  (from decision 1 above) — Rev0 shows "Initial upload" or "—" since the
  requirement doesn't apply to it.

See `.agents/docs/drawing.md` for the Drawing feature guide this affects.
