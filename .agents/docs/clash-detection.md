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
- `src/react-components/features/clash-dashboard/` — `ClashDashboard.tsx`, `ClashMatrix.tsx`, `ClashList.tsx`, `ClashHistory.tsx`, `ClashReportsTable.tsx`, `ClashPreview.tsx`, `clashService.ts`, `useClashViewpoints.ts`, `useClashDashboard.ts`
- `src/react-components/views/ClashView.tsx` — page composition (uses a `LAYOUTS` variant)

## Patterns & conventions

- Filters are URL-shareable where relevant (router search params) but working filter state sits in `clashStore`.
- Bulk Status/Type edits go through `BulkEditClashModal` → `useClashTable` mutation → `clashService`.
- Parsing (OBC/Three side) stays in `bim-components/ClashImport`; presentation stays in `features/`.

## Gotchas / watch-outs

- _(fill as encountered)_
