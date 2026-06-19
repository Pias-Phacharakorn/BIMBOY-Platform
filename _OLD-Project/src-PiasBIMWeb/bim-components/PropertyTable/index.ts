import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import {
  PropertyRow,
  PropertyTableContext,
  TableDataManager,
} from "./src/TableDataManager";
import { NativeTableUIManager } from "./src/NativeTableUIManager";
import { NativeTableFilterManager } from "./src/NativeTableFilterManager";
import { NativeTableSortManager } from "./src/NativeTableSortManager";
import { NativeTableSelectionManager } from "./src/NativeTableSelectionManager";
import { NativeTableExportManager } from "./src/NativeTableExportManager";

export class PropertyTable
  extends OBC.Component
  implements OBC.Disposable, PropertyTableContext
{
  static readonly uuid = "b6e8a002-3c1a-4632-9658-00a8a65bb7cd" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();

  public currentProperties: PropertyRow[] = [];
  public columnFilters: Map<string, Set<string>> = new Map();
  public loadedCategories: Set<string> = new Set();
  public isVisible = false;
  public isCollapsed = false;
  public allElementIds: number[] = [];
  public clusterScene: THREE.Group | null = null;
  public highlighter: OBF.Highlighter | null = null;
  public containerElement: HTMLDivElement;

  public readonly INITIAL_ROWS = 100;
  public readonly INITIAL_COLUMNS = 20;

  // Sub-managers (GomeraX pattern)
  public dataManager: TableDataManager;
  public uiManager: NativeTableUIManager;
  public filterManager: NativeTableFilterManager;
  public sortManager: NativeTableSortManager;
  public selectionManager: NativeTableSelectionManager;
  public exportManager: NativeTableExportManager;

  constructor(components: OBC.Components) {
    super(components);
    components.add(PropertyTable.uuid, this);

    try {
      this.highlighter = this.components.get(OBF.Highlighter);
    } catch (e) {
      console.warn("Highlighter not found for PropertyTable");
    }

    this.containerElement = document.createElement("div");
    this.containerElement.className = "property-table-container";

    // Build context reference for managers (they accept NativeTableContext)
    const ctx = this as any;

    this.uiManager = new NativeTableUIManager(ctx);
    this.filterManager = new NativeTableFilterManager(ctx);
    this.sortManager = new NativeTableSortManager(ctx);
    this.selectionManager = new NativeTableSelectionManager(
      this.highlighter,
      (id, modelId) => this.zoomToElement(id, modelId)
    );
    this.exportManager = new NativeTableExportManager();
    this.dataManager = new TableDataManager(this);

    // Wire expressID click from UIManager → SelectionManager
    this.uiManager.onExpressIdClick = (expressID, modelId, tr) => {
      this.selectionManager.handleExpressIdClick(expressID, modelId, tr);
    };
  }

  /**
   * Called from the BUI section template after the mount div is connected.
   * This is where the native table is created inside the BUI panel.
   */
  public initNativeTable(mountDiv: HTMLElement): void {
    this.uiManager.createTableUI(mountDiv);
  }

  // ── PropertyTableContext interface implementation ─────────────────────────

  public getDOMElement(): HTMLDivElement {
    return this.containerElement;
  }

  public async loadFilteredProperties(): Promise<void> {
    await this.dataManager.loadFilteredProperties();
  }

  public updateLoadingProgress(
    loaded: number,
    total: number,
    isComplete?: boolean
  ): void {
    this.uiManager.updateLoadingProgress(loaded, total, isComplete ?? false);
  }

  public initializeStreamingTable(
    rows: PropertyRow[],
    knownColumns: Set<string>
  ): void {
    this.uiManager.initializeStreamingTable(rows, knownColumns);
    this.filterManager.applyFilters();
  }

  public appendRowsToTable(rows: PropertyRow[]): void {
    this.uiManager.appendRowsToTable(rows);
    this.filterManager.applyFilters();
  }

  public finishLoading(): void {
    this.uiManager.updateLoadingProgress(
      this.currentProperties.length,
      this.currentProperties.length,
      true
    );
    console.log(
      `✅ Property Table loading finished with ${this.currentProperties.length} rows`
    );
  }

  public populateTable(): void {
    this.uiManager.clearTable(false);
    const knownColumns = new Set<string>();
    this.currentProperties.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== "modelId") knownColumns.add(key);
      });
    });
    this.uiManager.initializeStreamingTable(this.currentProperties, knownColumns);
    this.filterManager.applyFilters();
  }

  public clearTable(showOverlay = true): void {
    this.loadedCategories.clear();
    this.uiManager.clearTable(showOverlay);
  }

  public hideTable(): void {
    this.isVisible = false;
    this.restoreAllOpacity();
  }

  public showTable(): void {
    this.isVisible = true;
    this.currentProperties = [];
    this.columnFilters.clear();
    this.dataManager.setLoadedRowCount(0);
    this.clearTable();
  }

  public updateToolbarPosition(): void {
    // No-op — toolbar is in the BUI panel header
  }

  public restoreAllOpacity(): void {
    // No-op — no cluster scene / WebGPU in PIAS
  }

  // ── Search & Export (called from BUI toolbar buttons) ────────────────────

  /** Called by the search input in the BUI panel header */
  public applyTextFilter(query: string): void {
    this.uiManager.applyTextFilter(query);
  }

  /** Called by Export CSV / Export JSON buttons */
  public downloadData(filename: string, format: "csv" | "json"): void {
    const data = this.uiManager.getVisibleData();
    if (format === "csv") {
      this.exportManager.exportToCSV(data);
    } else {
      this.exportManager.exportToJSON(data);
    }
  }

  // ── Camera zoom ──────────────────────────────────────────────────────────

  public async zoomToElement(
    expressID: number,
    modelId?: string
  ): Promise<void> {
    if (!modelId) return;
    try {
      const worlds = this.components.get(OBC.Worlds);
      for (const world of worlds.list.values()) {
        if (
          world.camera &&
          world.camera instanceof OBC.OrthoPerspectiveCamera
        ) {
          const selectionMap: OBC.ModelIdMap = {
            [modelId]: new Set([expressID]),
          };
          await world.camera.fitToItems(selectionMap);
        }
      }
    } catch (err) {
      console.warn("Failed to zoom to element:", err);
    }
  }

  // ── Legacy stubs for backwards compat ────────────────────────────────────

  public get fragmentsManager(): OBC.FragmentsManager {
    return this.components.get(OBC.FragmentsManager);
  }

  dispose() {
    this.containerElement.remove();
    this.currentProperties = [];
    this.columnFilters.clear();
    this.onDisposed.trigger(PropertyTable.uuid);
    this.onDisposed.reset();
  }
}
