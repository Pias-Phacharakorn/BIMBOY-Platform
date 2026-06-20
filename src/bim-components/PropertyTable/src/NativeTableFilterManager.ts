// @ts-nocheck
import { PropertyRow } from "./TableDataManager";
import { NativeTableContext } from "./NativeTableUIManager";

export class NativeTableFilterManager {
  private activeDropdown: HTMLDivElement | null = null;

  constructor(private context: NativeTableContext) {}

  /**
   * Creates a floating filter dropdown anchored to a <th> element.
   */
  public createFilterDropdown(column: string, th: HTMLElement): void {
    // Toggle: if same column dropdown is open, close it
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      if (this.activeDropdown.dataset.column === column) {
        this.activeDropdown = null;
        return;
      }
    }

    const dropdown = document.createElement("div");
    dropdown.className = "prop-table-filter-dropdown";
    dropdown.dataset.column = column;
    this.activeDropdown = dropdown;

    // Collect unique values for this column
    const values = new Set<string>();
    this.context.currentProperties.forEach(row => {
      const val = row[column];
      values.add(val !== undefined && val !== null ? String(val) : "-");
    });
    const sortedValues = Array.from(values).sort();
    const activeFilters = new Set(this.context.columnFilters.get(column) ?? []);

    // Search box inside dropdown
    const searchBox = document.createElement("input");
    searchBox.type = "text";
    searchBox.placeholder = "Search values...";
    searchBox.className = "prop-table-filter-search";
    dropdown.appendChild(searchBox);

    const list = document.createElement("div");
    list.className = "prop-table-filter-list";

    const renderList = (filterText = "") => {
      list.innerHTML = "";
      const filtered = sortedValues.filter(v =>
        v.toLowerCase().includes(filterText.toLowerCase())
      );

      // "Select All" row
      if (filtered.length > 0) {
        const allItem = document.createElement("div");
        allItem.className = "prop-table-filter-item select-all";

        const allChk = document.createElement("input");
        allChk.type = "checkbox";
        allChk.checked = filtered.every(v => activeFilters.has(v));

        const allLabel = document.createElement("span");
        allLabel.innerHTML = "<i>Select All</i>";

        allItem.onclick = (e) => {
          e.stopPropagation();
          const newState = !allChk.checked;
          filtered.forEach(v => {
            if (newState) activeFilters.add(v);
            else activeFilters.delete(v);
          });
          this.context.columnFilters.set(column, new Set(activeFilters));
          this._applyAndRefresh();
          renderList(filterText);
        };

        allItem.appendChild(allChk);
        allItem.appendChild(allLabel);
        list.appendChild(allItem);
      }

      // Individual value rows
      filtered.forEach(val => {
        const item = document.createElement("div");
        item.className = "prop-table-filter-item";

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = activeFilters.has(val);

        const lbl = document.createElement("span");
        lbl.textContent = val;

        item.onclick = (e) => {
          e.stopPropagation();
          chk.checked = !chk.checked;
          this._toggleFilter(column, val, chk.checked, activeFilters);
        };
        chk.onclick = (e) => {
          e.stopPropagation();
          this._toggleFilter(column, val, chk.checked, activeFilters);
        };

        item.appendChild(chk);
        item.appendChild(lbl);
        list.appendChild(item);
      });
    };

    searchBox.oninput = () => renderList(searchBox.value);
    renderList();
    dropdown.appendChild(list);

    // "Clear" action button
    const actions = document.createElement("div");
    actions.className = "prop-table-filter-actions";

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear filter";
    clearBtn.style.cssText =
      "background:transparent; border:1px solid var(--border); color:var(--muted); border-radius:4px; padding:3px 8px; font-size:11px; cursor:pointer;";
    clearBtn.onclick = () => {
      this.context.columnFilters.delete(column);
      this._applyAndRefresh();
      dropdown.remove();
      this.activeDropdown = null;
    };
    actions.appendChild(clearBtn);
    dropdown.appendChild(actions);

    document.body.appendChild(dropdown);

    // Position the dropdown below the <th>
    const rect = th.getBoundingClientRect();
    let top = rect.bottom + 2;
    let left = rect.left;
    if (left + 220 > window.innerWidth) left = window.innerWidth - 230;
    if (top + 300 > window.innerHeight) top = rect.top - 305;
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;

    // Close on outside click
    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node) && !th.contains(e.target as Node)) {
        dropdown.remove();
        this.activeDropdown = null;
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 0);

    // Close on scroll outside dropdown
    const scrollHandler = (e: Event) => {
      if (dropdown.contains(e.target as Node)) return;
      dropdown.remove();
      this.activeDropdown = null;
      window.removeEventListener("scroll", scrollHandler, true);
      document.removeEventListener("wheel", scrollHandler, true);
    };
    window.addEventListener("scroll", scrollHandler, true);
    document.addEventListener("wheel", scrollHandler, true);
  }

  private _toggleFilter(
    column: string,
    value: string,
    isChecked: boolean,
    activeFilters: Set<string>
  ): void {
    if (isChecked) activeFilters.add(value);
    else {
      activeFilters.delete(value);
      if (activeFilters.size === 0) {
        this.context.columnFilters.delete(column);
        this._applyAndRefresh();
        return;
      }
    }
    this.context.columnFilters.set(column, new Set(activeFilters));
    this._applyAndRefresh();
  }

  private _applyAndRefresh(): void {
    this.context.filterManager?.applyFilters?.();
  }

  /**
   * Apply all active column filters — shows/hides <tr> rows.
   * Called by NativeTableUIManager and after toggle.
   */
  public applyFilters(): void {
    (this.context as any).uiManager?.applyColumnFilterVisibility?.();
  }

  /**
   * Clear all column filters and refresh.
   */
  public clearAllFilters(): void {
    this.context.columnFilters.clear();
    this.applyFilters();
  }
}

