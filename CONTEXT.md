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

## Folder tab restyle to match "Document Register" mockup

A Claude-artifact HTML/CSS/JS mockup (a static prototype with fabricated data,
no backend) was given as the visual target for `DrawingFolderExplorer.tsx`.
Grilled against the current domain model to separate "restyle" from
"behavior change," since the mockup disagrees with the real app in a few
places.

### Decisions

- **Scope is visual/interaction-placement only, not behavior.** Where the
  mockup's flow conflicts with an already-shipped, deliberately-designed real
  feature, the real behavior wins:
  - Compare Revisions stays the existing PDF slider/reveal visual diff
    (`CompareDrawingsModal.tsx` + `PdfSliderCompare.tsx`) — **not** replaced
    by the mockup's plain Author/Reason/Last-updated metadata diff table.
  - Upload New Revision keeps auto-computed revision numbers and
    sheet-inherited author (DB-enforced via the `(project_id, sheet_no,
    revision)` unique constraint) — **no** manual "Revision Code" text field
    or "Author Email" field is added, despite the mockup showing both.
  - The revision-level kebab menu stays **View + Download only** — the
    mockup's "Edit Metadata" and "Delete Revision" items are not added; no
    edit-metadata concept exists anywhere in this feature, and delete stays
    exclusive to the Register tab as already decided.
- **"+ Add Drawing" is kept, not dropped**, even though the mockup's
  discipline-selected toolbar only shows Export + Drawing Register. It's the
  only entry point for creating a new sheet; removing it would be a
  regression, not a restyle. Toolbar becomes `Export | Drawing Register | +
  Add Drawing` when a discipline is selected.
- **"Drawing Register" button reuses the existing Register tab** (switches
  `DrawingView`'s active tab, optionally scoped/filtered to the selected
  discipline) instead of building a new standalone summary modal — the
  mockup's modal would functionally duplicate `ShopDrawingTable.tsx`.
- **Tree collapses to 2 levels** (Discipline → Drawing), reversing the
  "discipline → sheet → revision" 3-level tree from the section above.
  Revision leaves are dropped from the sidebar; revisions remain fully
  reachable via the right-pane table's rows and kebab (View/Download). This
  intentionally re-reverses a decision that was itself a reversal — matching
  the mockup's shallower tree was judged worth it since nothing becomes
  unreachable, only relocated.
- **Discipline-level table drops the Author column** (ambiguous when a row
  aggregates multiple revisions with potentially different authors) but
  **keeps the latest-revision label** (`Version` = "Rev N") rather than
  switching to the mockup's bare revision **count** — strictly more
  informative for the same rendering cost. Columns: `Name | Version (Rev N) |
  Last updated` + kebab.
- **UI copy says "Drawing," not "Sheet."** The mockup's user-facing term for
  the folder-level entity ("Drawing," e.g. sidebar rows, empty states,
  "Drawing Register") is adopted in all UI text. Internal code naming
  (`Sheet*`, `sheetNo`, `SheetBucket`) is **not** renamed — copy-only change,
  no refactor.
- **New header-level "Compare Revision" button** when a drawing is selected
  (disabled if <2 revisions, same rule as today), opening the existing
  `CompareDrawingsModal` scoped to that drawing. The existing kebab "Compare
  Revisions" action on discipline-view sheet rows is **kept alongside it**,
  not replaced — an additional entry point, not a relocation.
- **Discipline list uses the real 8 codes** (`01_AR`...`08_SN`), not the
  mockup's incomplete sample of 7 (missing `08_SN`) — the omission was
  presumably just illustrative mock data, not intentional.

See `.agents/docs/drawing.md` (mirrored `.claude/docs/drawing.md`) for the
Drawing feature guide — update both once this is implemented, per
`CLAUDE.md`'s "Keep the Domain Guides in sync" rule.

## Folder tab — discipline-view row click drills in instead of opening the PDF

The original "Row click: clicking a sheet row opens the PDF viewer directly"
decision (see the tree + table layout section above) was made when the tree
stopped at the discipline level and the table was the *only* way to reach a
sheet — there was no drill-down to select into. Once sheet/drawing selection
was later added to both the tree and the table, this row-click behavior was
never revisited, leaving a stale inconsistency: the sidebar's drawing row
drills in on click, but the table's equivalent row for the same drawing
opens a PDF instead.

### Decisions

- **Scope**: only the **discipline-selected table**'s row click changes
  (rows = drawings/sub-folders). The **drawing-selected table**'s row click
  (rows = individual revisions) is unchanged and keeps opening the PDF
  viewer directly — a revision is a leaf, nothing to drill into.
- **New behavior**: clicking a discipline-view row calls `selectSheet(discipline,
  sheetNo)` (the same function the sidebar's drawing row already uses)
  instead of `setViewerTarget(latest)`. This switches the table to that
  drawing's revision list, mirroring the sidebar's own click behavior.
- **"View" stays in the kebab, unchanged** — it becomes the primary
  direct-to-PDF entry point from the discipline-selected table now that the
  row itself no longer does that. Not redundant; it's the intended
  discoverable affordance the original decision already called out.
- **No visual affordance change**: the row keeps its existing
  `cursor-pointer` + hover-highlight styling, matching the sidebar's drawing
  rows (which also give no special "drill in" cue beyond hover). Keeps the
  diff minimal.

See `.agents/docs/drawing.md` (mirrored `.claude/docs/drawing.md`) for the
Drawing feature guide — update both once this is implemented.

## Cloud Models — per-project auto-load toggle

Adding an on/off switch for `useAutoLoadCloudModels`
(`src/react-components/features/cloud-models/useAutoLoadCloudModels.ts`),
which today runs unconditionally in `ModelsView.tsx` and auto-loads every
`.frag` file under a project's `02_frag` storage folder as soon as the
project opens. No existing setting controls this — it's currently always on
for every project.

### Decisions

- **Toggle location**: right side of the `CloudModelModal.tsx` header (the
  "Cloud Models" dialog opened from `ToolbarLoadModel.tsx`'s dropdown), next
  to the existing close button — the only dedicated cloud-models UI surface
  today.
- **Scope: per-project, not per-user.** Auto-load affects the shared viewer
  experience for everyone opening that project, so it's a project-level
  setting, not a personal preference — stored on the project row, not on
  `profiles` or client-local state.
- **Permission**: gated by the existing `useIsProjectAdmin` check
  (`useProjects.ts`) — same gate already used for the Settings panel. Only a
  project admin or hub admin can flip it.
- **Non-admins**: see the toggle rendered but **disabled** (read-only) — they
  can see the current state without changing it, not hidden entirely.
- **Storage**: new column `auto_load_cloud_models boolean NOT NULL DEFAULT
  true` on the `projects` table. Default `true` makes this purely additive —
  no existing project's behavior changes until an admin explicitly opts out.
  Note: `projects` is read through the `active_projects` **view**
  (`useProject`/`useProjects` → `projectsService.getProjects`/`getProjectById`),
  and the view's source isn't tracked in `supabase/migrations/` (predates the
  tracked migration history) — the view definition must be inspected live
  (via `Agent_Supabase` / `list_tables`) and updated to expose the new column
  in the same migration, or reads will silently miss it.
- **Effect when disabled**: only suppresses the *next* automatic load (on
  project open or project switch inside `useAutoLoadCloudModels`'s effect).
  It does **not** unload models already sitting in the current viewer
  session, and does **not** disable manual loading — the Cloud Models
  dialog's checkbox/"Load Models" flow and the Load IFC/FRAG local-file paths
  in `ToolbarLoadModel.tsx` keep working regardless of this setting.
- **Read/write path**: reuse the existing `useProject`/`useUpdateProject`
  hooks (`useProjects.ts`) rather than adding a parallel query — the toggle
  mutates the same `projects` row already being fetched for the modal's
  `project.projectnumber`/`project.projectName` prefix.

See `.agents/docs/bim-viewer.md` (mirrored `.claude/docs/bim-viewer.md`) for
the BIM Viewer guide's Cloud Models section — update both once this is
implemented, per `CLAUDE.md`'s "Keep the Domain Guides in sync" rule.

## Clash Preview click-to-edit fields

Reworking the Clash Preview sidebar panel
(`src/react-components/features/clash-dashboard/ClashPreview.tsx`) so Name,
Status, Type, Comments, and Solution use a pencil-icon click-to-edit row
pattern (from `clash_Preview_panel_redesign.html`) instead of always-visible
`<select>`/`<textarea>` controls.

### Decisions

- **Name becomes genuinely editable**: previously read-only display text with
  no rename feature, even though the underlying `name` column was already
  updatable via `updateClashViewpoint`. Now wired to a real rename: click the
  row → inline text input → saves on blur/Enter via the same mutation.
- **Status and Type also convert to click-to-edit** (not just Name/Comments/
  Solution): view mode shows the same colored badge/dot styling as
  `ClashTable` (via `clashDisplayHelpers.ts`), click the row to reveal the
  underlying `<select>`, which saves immediately on change and returns to
  badge view.
- **Save-on-blur per field, no batch button**: matches the pattern already
  used by the full-screen modal's Comments/Solution fields. The sidebar
  panel's old shared "Save Changes" button (for Comments+Solution together)
  is removed — each field now saves independently when it loses focus.
- **Modal's Comments/Solution fields also convert** to the same click-to-edit
  pattern for consistency, even though the modal has room for always-visible
  fields. The modal's Name/Status/Type stay as static display (badges/text) —
  not asked for, out of scope for now.
- **Whole row is the click target**, not just the pencil icon — matches the
  mockup (`cursor-pointer` on the full label+value+pencil row), gives a
  larger, more forgiving hit area.
- **Escape reverts the draft** on text fields (Name, Comments, Solution)
  without saving — standard inline-edit convention so an accidental edit
  doesn't get committed.
- **Shared implementation**: extracted `EditableTextField` and
  `EditableSelectField` into `EditableClashField.tsx` so the click-to-edit
  behavior (draft state, blur-to-save, Escape-to-cancel, autofocus) isn't
  duplicated across the ~7 field instances (5 in the sidebar, 2 in the
  modal) — avoids the kind of drift that already caused mismatched
  status/type badge colors between `ClashTable` and `ClashPreview` earlier.
