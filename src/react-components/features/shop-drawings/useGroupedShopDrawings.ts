import { useMemo } from "react";
import type { ShopDrawingRow } from "./shopDrawingsService";
import { useShopDrawings } from "./useShopDrawings";
import { DISCIPLINES, type DisciplineCode } from "./disciplines";

export interface SheetBucket {
  sheetNo: string;
  sheetName: string;
  versions: ShopDrawingRow[];
}

export interface DisciplineGroup {
  code: DisciplineCode;
  label: string;
  sheets: SheetBucket[];
}

// Sheets are keyed by discipline+sheetNo since the same sheet_no could in
// principle recur under a different discipline.
export function sheetKey(discipline: string, sheetNo: string): string {
  return `${discipline}::${sheetNo}`;
}

// Shared by ProjectFolders.tsx (Settings page's general file browser) and
// DrawingFolderExplorer.tsx (Drawing Directory's Folder tab) so both consume
// the same shop_drawings query + discipline/sheet grouping logic. Builds on
// useShopDrawings' cached query rather than fetching independently, so it
// shares state with the Register tab (ShopDrawingTable) instead of
// re-fetching on every tab switch, and mutations' cache invalidation keeps
// this in sync automatically — no manual refetch needed after create/upload.
export function useGroupedShopDrawings(projectId: string | undefined) {
  const { data: shopDrawings = [], isLoading: loading, error: queryError, refetch } = useShopDrawings(projectId);
  const error = queryError ? (queryError instanceof Error ? queryError.message : "Failed to load shop drawings") : null;

  const groupedByDiscipline = useMemo<DisciplineGroup[]>(() => {
    const sheetsByDiscipline = new Map<string, Map<string, ShopDrawingRow[]>>();
    shopDrawings.forEach((row) => {
      const sheetsForDiscipline = sheetsByDiscipline.get(row.discipline) ?? new Map<string, ShopDrawingRow[]>();
      const versions = sheetsForDiscipline.get(row.sheet_no) ?? [];
      versions.push(row);
      sheetsForDiscipline.set(row.sheet_no, versions);
      sheetsByDiscipline.set(row.discipline, sheetsForDiscipline);
    });

    return DISCIPLINES.map((discipline) => {
      const sheetsForDiscipline = sheetsByDiscipline.get(discipline.value);
      const sheets: SheetBucket[] = [];
      sheetsForDiscipline?.forEach((versions, sheetNo) => {
        versions.sort((a, b) => a.revision - b.revision);
        sheets.push({ sheetNo, sheetName: versions[versions.length - 1].sheet_name, versions });
      });
      sheets.sort((a, b) => a.sheetNo.localeCompare(b.sheetNo));
      return { code: discipline.value, label: discipline.label, sheets };
    });
  }, [shopDrawings]);

  // Cheap fixed-size (8 disciplines) reduce — not worth its own memo.
  const totalSheetCount = groupedByDiscipline.reduce((sum, d) => sum + d.sheets.length, 0);

  return { shopDrawings, groupedByDiscipline, totalSheetCount, loading, error, refetch };
}
