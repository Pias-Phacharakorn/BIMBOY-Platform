// @ts-nocheck
import { PropertyRow } from "./TableDataManager";

export interface NativeTableContext {
  currentProperties: PropertyRow[];
  columnFilters: Map<string, Set<string>>;
  isLoading: boolean;
  readonly INITIAL_COLUMNS: number;
  populateTable(): void;
  filterManager: any;
  sortManager: any;
}

export class NativeTableUIManager {
  private tableWrapper: HTMLDivElement | null = null;
  private tableElement: HTMLTableElement | null = null;
  private loadingOverlay: HTMLDivElement | null = null;
  private loadingBar: HTMLDivElement | null = null;
  private loadingText: HTMLDivElement | null = null;
  private tableHeader: HTMLTableSectionElement | null = null;
  private tableBody: HTMLTableSectionElement | null = null;

  private currentColumns: string[] = [];
  private allKnownColumns: Set<string> = new Set();
  private isLoading = false;

  // Callback for expressID cell click
  public onExpressIdClick: ((expressID: number, modelId: string | undefined, tr: HTMLTableRowElement) => void) | null = null;

  constructor(private context: NativeTableContext) {}

  /**
   * Creates the table DOM structure and mounts it inside mountDiv.
   * Called once after the BUI panel section renders the mount div.
   */
  public createTableUI(mountDiv: HTMLElement): void {
    if (this.tableWrapper) {
      if (this.tableWrapper.parentElement !== mountDiv) {
        mountDiv.appendChild(this.tableWrapper);
        if (this.loadingOverlay) mountDiv.appendChild(this.loadingOverlay);
      }
      return;
    }

    mountDiv.style.display = "flex";
    mountDiv.style.flexDirection = "column";
    mountDiv.style.flex = "1";
    mountDiv.style.minHeight = "0";
    mountDiv.style.position = "relative";
    mountDiv.style.overflow = "hidden";

    // Scrollable table wrapper — overflow:auto gives BOTH scrollbars
    this.tableWrapper = document.createElement("div");
    this.tableWrapper.className = "prop-table-wrapper";

    // The actual <table>
    this.tableElement = document.createElement("table");
    this.tableElement.className = "prop-table";

    this.tableHeader = document.createElement("thead");
    this.tableBody = document.createElement("tbody");

    this.tableElement.appendChild(this.tableHeader);
    this.tableElement.appendChild(this.tableBody);
    this.tableWrapper.appendChild(this.tableElement);

    // Loading overlay (absolute over the wrapper)
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className = "prop-table-loading-overlay";

    const loadingContent = document.createElement("div");
    loadingContent.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    this.loadingText = document.createElement("div");
    this.loadingText.style.cssText = "font-size:12px; color:var(--muted);";
    this.loadingText.textContent = "Loading properties...";

    const progressContainer = document.createElement("div");
    progressContainer.className = "prop-table-progress-container";

    this.loadingBar = document.createElement("div");
    this.loadingBar.className = "prop-table-progress-bar";
    this.loadingBar.style.width = "0%";

    progressContainer.appendChild(this.loadingBar);
    loadingContent.appendChild(this.loadingText);
    loadingContent.appendChild(progressContainer);
    this.loadingOverlay.appendChild(loadingContent);

    mountDiv.appendChild(this.tableWrapper);
    mountDiv.appendChild(this.loadingOverlay);
  }

  /**
   * Initialize the table with the first batch of streamed rows.
   */
  public initializeStreamingTable(rows: PropertyRow[], knownColumns: Set<string>): void {
    if (!this.tableHeader || !this.tableBody) return;

    this.allKnownColumns = new Set(knownColumns);
    this.tableHeader.innerHTML = "";
    this.tableBody.innerHTML = "";

    // Priority columns always shown first in the requested order
    const priorityCols = ["Category", "Name", "SourceFile", "LocalId", "Guid"];
    const otherCols = Array.from(knownColumns)
      .filter(c => !priorityCols.includes(c) && c !== "expressID" && c !== "modelId")
      .sort();
    this.currentColumns = [
      ...priorityCols.filter(c => knownColumns.has(c)),
      ...otherCols.slice(0, this.context.INITIAL_COLUMNS),
    ];

    this.renderHeader();
    this.appendRowsToTable(rows);
  }

  /**
   * Re-render the <thead> — shows active sort indicators and filter icons.
   */
  public renderHeader(): void {
    if (!this.tableHeader) return;
    this.tableHeader.innerHTML = "";
    const headerRow = document.createElement("tr");

    this.currentColumns.forEach(col => {
      const th = document.createElement("th");
      th.className = "sortable";

      const content = document.createElement("div");
      content.className = "th-content";

      const label = document.createElement("span");
      label.textContent = col.charAt(0).toUpperCase() + col.slice(1);

      // Sort indicator
      const sortManager = this.context.sortManager;
      if (sortManager?.currentSort?.column === col) {
        const indicator = document.createElement("span");
        indicator.className = "sort-indicator";
        indicator.textContent = sortManager.currentSort.direction === "asc" ? " ▲" : " ▼";
        label.appendChild(indicator);
      }

      // Filter funnel icon
      const filterBtn = document.createElement("span");
      filterBtn.className = "filter-icon";
      const isFiltered = this.context.columnFilters.has(col) && this.context.columnFilters.get(col)!.size > 0;
      filterBtn.innerHTML = isFiltered
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18l-7 9v6l-4-2v-4L3 4z"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h18l-7 9v6l-4-2v-4L3 4z"/></svg>`;
      if (isFiltered) filterBtn.classList.add("active");

      filterBtn.onclick = (e) => {
        e.stopPropagation();
        this.context.filterManager?.createFilterDropdown(col, th);
      };

      content.appendChild(label);
      content.appendChild(filterBtn);
      th.appendChild(content);

      // Sort on header click
      th.onclick = () => this.context.sortManager?.sortData(col);
      headerRow.appendChild(th);
    });

    // "Load more columns" button
    if (this.currentColumns.length < this.allKnownColumns.size) {
      const moreCount = this.allKnownColumns.size - this.currentColumns.length;
      const loadMoreTh = document.createElement("th");
      loadMoreTh.style.cssText = "color:var(--muted); cursor:pointer; white-space:nowrap;";
      loadMoreTh.textContent = `+ ${moreCount} more`;
      loadMoreTh.onclick = () => this.loadMoreColumns();
      headerRow.appendChild(loadMoreTh);
    }

    this.tableHeader.appendChild(headerRow);
  }

  private loadMoreColumns(): void {
    const allCols = Array.from(this.allKnownColumns);
    const nextCols = allCols.filter(c => !this.currentColumns.includes(c)).sort();
    this.currentColumns = [...this.currentColumns, ...nextCols.slice(0, 20)];
    this.renderHeader();
    this.context.populateTable();
  }

  /**
   * Stream rows into <tbody> using DocumentFragment for performance.
   */
  public appendRowsToTable(rows: PropertyRow[]): void {
    if (!this.tableBody) return;

    const fragment = document.createDocumentFragment();

    rows.forEach(rowData => {
      const tr = document.createElement("tr");

      // Click handler on row element itself
      tr.onclick = () => {
        if (this.isLoading) return;
        const expressID = Number(rowData.expressID);
        const modelId = rowData.modelId as string | undefined;
        this.onExpressIdClick?.(expressID, modelId, tr);
      };

      this.currentColumns.forEach(col => {
        const td = document.createElement("td");

        if (col === "LocalId") {
          // Visual span for LocalId (styled like link, cursor is managed by hover style)
          const span = document.createElement("span");
          span.className = `prop-table-express-id${this.isLoading ? " loading" : ""}`;
          span.textContent = String(rowData[col] ?? "-");
          td.appendChild(span);
        } else {
          const val = rowData[col];
          td.textContent = val !== undefined && val !== null ? String(val) : "-";
        }

        tr.appendChild(td);
      });

      fragment.appendChild(tr);
    });

    this.tableBody.appendChild(fragment);
  }

  /**
   * Update loading progress bar and overlay visibility.
   */
  public updateLoadingProgress(loaded: number, total: number, isComplete = false): void {
    if (!this.loadingOverlay || !this.loadingBar || !this.loadingText) return;

    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
    this.loadingBar.style.width = `${percent}%`;

    if (isComplete) {
      this.isLoading = false;
      this.loadingText.textContent = `Loaded ${total} elements`;
      // Short delay so user sees "Loaded" message before hiding
      setTimeout(() => this.loadingOverlay?.classList.add("hidden"), 600);
      this._updateExpressIdCursors();
    } else {
      this.isLoading = true;
      this.loadingOverlay.classList.remove("hidden");
      this.loadingText.textContent = `Loading: ${loaded} / ${total} (${percent}%)`;
    }
  }

  /** Refresh cursor style on all expressID spans after loading state changes */
  private _updateExpressIdCursors(): void {
    if (!this.tableBody) return;
    this.tableBody.querySelectorAll<HTMLSpanElement>(".prop-table-express-id").forEach(span => {
      if (this.isLoading) {
        span.classList.add("loading");
      } else {
        span.classList.remove("loading");
      }
    });
  }

  /**
   * Text-search filter: show/hide rows where any cell matches the query string.
   */
  public applyTextFilter(query: string): void {
    if (!this.tableBody) return;
    const q = query.toLowerCase().trim();
    const rows = this.tableBody.querySelectorAll<HTMLTableRowElement>("tr");

    rows.forEach((tr, i) => {
      if (!q) {
        tr.classList.remove("hidden");
        return;
      }
      const rowData = this.context.currentProperties[i];
      if (!rowData) { tr.classList.remove("hidden"); return; }
      const matches = Object.values(rowData).some(v =>
        v !== undefined && v !== null && String(v).toLowerCase().includes(q)
      );
      if (matches) tr.classList.remove("hidden");
      else tr.classList.add("hidden");
    });
  }

  /**
   * Clear table contents (called before a fresh data load).
   */
  public clearTable(showOverlay: boolean = true): void {
    if (this.tableHeader) this.tableHeader.innerHTML = "";
    if (this.tableBody) this.tableBody.innerHTML = "";
    this.currentColumns = [];
    this.allKnownColumns = new Set();
    if (showOverlay) {
      // Show overlay immediately
      this.isLoading = true;
      if (this.loadingOverlay) this.loadingOverlay.classList.remove("hidden");
      if (this.loadingBar) this.loadingBar.style.width = "0%";
      if (this.loadingText) this.loadingText.textContent = "Loading properties...";
    } else {
      this.isLoading = false;
      if (this.loadingOverlay) this.loadingOverlay.classList.add("hidden");
    }
  }

  /** Returns the visible (non-hidden) rows' property data for export. */
  public getVisibleData(): PropertyRow[] {
    if (!this.tableBody) return this.context.currentProperties;

    const rows = this.tableBody.querySelectorAll<HTMLTableRowElement>("tr");
    const visible: PropertyRow[] = [];
    rows.forEach((tr, i) => {
      if (!tr.classList.contains("hidden")) {
        const rowData = this.context.currentProperties[i];
        if (rowData) visible.push(rowData);
      }
    });
    return visible.length > 0 ? visible : this.context.currentProperties;
  }

  /** Apply column filter visibility — called by NativeTableFilterManager */
  public applyColumnFilterVisibility(): void {
    if (!this.tableBody) return;
    const rows = this.tableBody.querySelectorAll<HTMLTableRowElement>("tr");
    rows.forEach((tr, i) => {
      const rowData = this.context.currentProperties[i];
      if (!rowData) { tr.classList.remove("hidden"); return; }

      let isVisible = true;
      for (const [col, filters] of this.context.columnFilters.entries()) {
        const val = rowData[col];
        const strVal = val !== undefined && val !== null ? String(val) : "-";
        if (!filters.has(strVal)) { isVisible = false; break; }
      }

      if (isVisible) tr.classList.remove("hidden");
      else tr.classList.add("hidden");
    });

    // Re-render header to update filter icon active states
    this.renderHeader();
  }

  /** Mark a row as selected (adds .selected class) */
  public selectRow(tr: HTMLTableRowElement): void {
    // Clear old selection
    this.tableBody?.querySelectorAll<HTMLTableRowElement>("tr.selected")
      .forEach(r => r.classList.remove("selected"));
    tr.classList.add("selected");
  }
}

