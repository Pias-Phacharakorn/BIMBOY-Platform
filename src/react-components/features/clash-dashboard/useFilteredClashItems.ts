import { useMemo } from "react";
import { useClashStore } from "@/react-components/store/clashStore";
import { useClashViewpoints } from "./useClashViewpoints";

/**
 * Single source of truth for "which clashes are currently in view" — applies
 * the report filter (server-side) and quick filters (client-side) exactly
 * once. ClashTable and ClashPreview both read from this so #ID numbering
 * (via getClashSeqId) and the item lookup for the selected clash stay in
 * sync instead of drifting when either filter is active.
 */
export function useFilteredClashItems(projectId: string | null | undefined) {
  const { selectedReportId, quickFilters } = useClashStore();
  const { data: clashItems = [], isLoading } = useClashViewpoints(projectId, selectedReportId);

  const filteredItems = useMemo(() => {
    return clashItems.filter((item) => {
      if (quickFilters.onlyCritical && item.type !== "major") {
        return false;
      }
      if (quickFilters.unassigned && item.createdBy !== null) {
        return false;
      }
      if (quickFilters.arcVsMep) {
        const text = `${item.name || ""} ${item.path || ""}`.toLowerCase();
        const hasArchitecture = text.includes("ar") || text.includes("arc");
        const hasMep = text.includes("me") || text.includes("mep");
        if (!(hasArchitecture && hasMep)) {
          return false;
        }
      }
      return true;
    });
  }, [clashItems, quickFilters]);

  return { data: filteredItems, isLoading };
}
