// @ts-nocheck
import { PropertyRow } from "./TableDataManager";
import { NativeTableContext } from "./NativeTableUIManager";

export class NativeTableSortManager {
  public currentSort: { column: string; direction: "asc" | "desc" } | null = null;

  constructor(private context: NativeTableContext) {}

  public sortData(column: string): void {
    const direction =
      this.currentSort?.column === column && this.currentSort.direction === "asc"
        ? "desc"
        : "asc";
    this.currentSort = { column, direction };

    this.context.currentProperties.sort((a, b) => {
      const valA = a[column];
      const valB = b[column];

      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      const cmp = String(valA).localeCompare(String(valB), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return direction === "asc" ? cmp : -cmp;
    });

    // Re-render all rows after sorting
    this.context.populateTable();
  }
}

