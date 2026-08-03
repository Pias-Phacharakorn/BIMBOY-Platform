# Clash Detection — BCF import, register, dashboard

> Status: seed — expand as you work this area.

## Overview

The clash feature spans an OBC-side parser (`ClashImport` reads BCF/clash files into typed clashes) and a React-side register: filters, a data table with bulk edit, and a dashboard (matrix/list/history/reports). Clash data + active filters live in `clashStore`. Persistence goes through `clashService.ts` (Supabase).

## Key files

- `src/bim-components/ClashImport/src/ClashParser.ts` — parses BCF/clash source into typed data
- `src/bim-components/ClashImport/src/ClashImportTypes.ts` — clash parse types
- `src/types/clash.ts` — shared clash domain types
- `src/react-components/store/clashStore.ts` — clash data + filter state
- `src/react-components/features/clash-filter/` — `ClashFilter.tsx`, `useClashFilter.ts`
- `src/react-components/features/clash-table/` — `ClashTable.tsx`, `useClashTable.ts`, `BulkEditClashModal.tsx`
- `src/react-components/features/clash-dashboard/` — `ClashDashboard.tsx`, `ClashMatrix.tsx`, `ClashList.tsx`, `ClashHistory.tsx`, `ClashReportsTable.tsx`, `ClashPreview.tsx`, `EditableClashField.tsx`, `clashDisplayHelpers.ts`, `clashService.ts`, `useClashViewpoints.ts`, `useClashDashboard.ts`
- `src/react-components/views/ClashView.tsx` — page composition (uses a `LAYOUTS` variant)

## Patterns & conventions

- Filters are URL-shareable where relevant (router search params) but working filter state sits in `clashStore`.
- Bulk Status/Type edits go through `BulkEditClashModal` → `useClashTable` mutation → `clashService`.
- Parsing (OBC/Three side) stays in `bim-components/ClashImport`; presentation stays in `features/`.

### Click-to-edit clash fields (`EditableClashField.tsx`)

Editable clash fields in the Clash Preview sidebar and its modal use a shared click-to-edit row pattern instead of always-visible controls. Two components live in `EditableClashField.tsx` so behavior isn't duplicated across the ~7 instances (5 sidebar, 2 modal) — this shared source also prevents the drift that previously caused mismatched status/type badge colors between `ClashTable` and `ClashPreview`:

- `EditableTextField` — Name, Comments, Solution.
- `EditableSelectField` — Status, Type.

View mode (not editing) is unchanged: it renders the same colored badge/dot styling as `ClashTable`, sourced from `clashDisplayHelpers.ts`, with a pencil icon. The whole label + value + pencil row is the click target (`cursor-pointer`), not just the pencil icon.

**Text fields** (`EditableTextField`): click enters an inline text input / textarea. There is NO blur-to-save — entering edit mode never commits on blur. The draft commits only via an explicit confirm (✔️) and reverts via an explicit cancel (❌); Escape also cancels (= ❌). Saving flows through the same `updateClashViewpoint` mutation, so Name is genuinely editable (previously a read-only display, though the name column was already updatable via that mutation).

- Confirm/cancel icons sit below the input/textarea, right-aligned, cancel (❌) left of confirm (✔️) — one layout for both single-line and multiline.
- Icons are neutral at rest (`text-muted`) and colored only on hover (`hover:text-status-ok` / `hover:text-status-danger`), matching the quiet icon-button convention.

**Select fields** (`EditableSelectField`): a custom Notion-style dropdown, NOT a restyled native `<select>` (a native `<option>` can't render the colored left bar, highlighted selected row, or right checkmark). It gets no ✔️/❌ — clicking an option commits immediately and closes the popup (the click is the confirm).

- Hand-rolled with no dropdown library (no Radix / Headless / downshift / react-select): a button trigger plus an absolutely-positioned `<ul role="listbox">` popup (no portal), options carry `role="option"`.
- The edit-mode closed trigger is a new bordered-box style (`border border-border-strong rounded-radius`) that reuses the same colored dot/text as the view render, plus a `ChevronDown`/`ChevronUp` that flips on open — it is NOT the view-mode pill badge with a chevron. The non-editing view mode is unchanged (still the pill badge).
- No custom keyboard roving/arrow-key navigation: click to select, Escape / click-outside to close. `role=listbox`/`role=option` are present for screen readers; each field has only 3–4 options.

**Scope:** the modal's Comments/Solution fields use this same click-to-edit pattern; the modal's Name/Status/Type stay static display (out of scope).

**Icons:** new icons (`Check`/`X`, `ChevronDown`/`ChevronUp`) are imported directly from `lucide-react` in `EditableClashField.tsx`, matching that file's existing direct-import pattern — not migrated to `appIcons`/`<Icon />`.

## Gotchas / watch-outs

- The custom Status/Type listbox popup renders inline (no portal), so it can be visually clipped by the Clash Preview panel's `overflow-y-auto` near the panel's bottom edge — an accepted tradeoff of avoiding a portal.
