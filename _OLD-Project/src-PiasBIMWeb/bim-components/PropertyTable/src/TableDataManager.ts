import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import { selectedFilters } from "../../../ui-templates/tables/classifier-select";

export interface PropertyRow {
  Category?: string;
  Name?: string;
  SourceFile?: string;
  LocalId?: number;
  Guid?: string;
  expressID: number;
  modelId?: string;
  [key: string]: any;
}

export interface PropertyTableContext {
  components: OBC.Components;
  fragmentsManager: OBC.FragmentsManager;
  highlighter: OBF.Highlighter | null;
  containerElement: HTMLDivElement;
  
  // State
  currentProperties: PropertyRow[];
  columnFilters: Map<string, Set<string>>;
  loadedCategories: Set<string>;
  isVisible: boolean;
  isCollapsed: boolean;
  allElementIds: number[];
  clusterScene: THREE.Group | null;
  
  // Constants
  INITIAL_ROWS: number;
  INITIAL_COLUMNS: number;
  
  // Methods
  updateLoadingProgress(loaded: number, total: number, isComplete?: boolean, isPaused?: boolean): void;
  initializeStreamingTable(rows: PropertyRow[], knownColumns: Set<string>): void;
  appendRowsToTable(rows: PropertyRow[]): void;
  finishLoading(): void;
  populateTable(): void;
  updateToolbarPosition(): void;
  restoreAllOpacity(): void;
  zoomToElement(expressID: number, modelId?: string): Promise<void>;
  hideTable(): void;
  loadFilteredProperties(): Promise<void>;
  clearTable(showOverlay?: boolean): void;
}


export class TableDataManager {
  private loadedRowCount: number = 0;

  constructor(private context: PropertyTableContext) {}

  public setLoadedRowCount(count: number) {
    this.loadedRowCount = count;
  }

  /**
   * Load properties only for category filters selected in category-select
   */
  public async loadFilteredProperties(): Promise<void> {
    const classifier = this.context.components.get(OBC.Classifier);
    const idsByModel = new Map<string, number[]>();
    let totalCount = 0;

    for (const [classificationName, selectedGroupNames] of selectedFilters.entries()) {
      if (selectedGroupNames.size === 0) continue;

      const classification = classifier.list.get(classificationName);
      if (!classification) continue;

      for (const groupName of selectedGroupNames) {
        const groupData = classification.get(groupName);
        if (groupData) {
          const modelIdMap = await groupData.get();
          for (const modelId in modelIdMap) {
            const expressIDs = Array.from(modelIdMap[modelId]);
            if (expressIDs.length > 0) {
              if (!idsByModel.has(modelId)) {
                idsByModel.set(modelId, []);
              }
              idsByModel.get(modelId)!.push(...expressIDs);
            }
          }
        }
      }
    }

    for (const [modelId, ids] of idsByModel.entries()) {
      const uniqueIds = Array.from(new Set(ids));
      idsByModel.set(modelId, uniqueIds);
      totalCount += uniqueIds.length;
    }

    if (totalCount === 0) {
      throw new Error("Please select one or more categories first.");
    }

    this.context.currentProperties = [];
    this.context.columnFilters.clear();
    this.setLoadedRowCount(0);
    this.context.clearTable();

    await this.fetchAndStreamProperties(idsByModel, totalCount);

    this.context.loadedCategories.clear();
    const selectedCats = selectedFilters.get("Categories");
    if (selectedCats) {
      for (const cat of selectedCats) {
        this.context.loadedCategories.add(cat);
      }
    }
  }

  /**
   * Load all properties for all models
   */
  public async loadAllProperties(): Promise<void> {
    const idsByModel = new Map<string, number[]>();
    let totalCount = 0;

    for (const [modelId, model] of this.context.fragmentsManager.list) {
      try {
        // Get all categories in the model
        const categories = await (model as any).getCategories();
        
        // Query items for all categories
        const categoryRegexes = categories.map((cat: string) => new RegExp(`^${cat}$`));
        const itemsByCategory = await (model as any).getItemsOfCategories(categoryRegexes);
        
        const allIds: number[] = [];
        for (const categoryKey in itemsByCategory) {
          const ids = itemsByCategory[categoryKey];
          if (Array.isArray(ids)) {
            allIds.push(...ids);
          }
        }
        
        // Remove duplicates
        const uniqueIds = Array.from(new Set(allIds));
        
        if (uniqueIds.length > 0) {
          idsByModel.set(modelId, uniqueIds);
          totalCount += uniqueIds.length;
        }
      } catch (error) {
        console.error(`Error getting IDs for model ${modelId}:`, error);
      }
    }

    await this.fetchAndStreamProperties(idsByModel, totalCount);
  }

  /**
   * Fetch and stream properties to table - parses and yields to keep main thread alive
   */
  public async fetchAndStreamProperties(idsByModel: Map<string, number[]>, totalCount: number, startLoadedCount: number = 0): Promise<void> {
    const BATCH_SIZE = 50;
    let loadedCount = startLoadedCount;
    let tableInitialized = this.loadedRowCount > 0;
    const knownColumns = new Set<string>();
    const modelEntries = Array.from(idsByModel.entries());

    // Update context with all IDs for filtering/exporting if this is a fresh load
    if (startLoadedCount === 0) {
      this.context.allElementIds = Array.from(idsByModel.values()).flat();
    }

    console.log(`📊 Starting streaming fetch for ${totalCount} elements (starting at ${startLoadedCount})`);

    let lastYieldTime = performance.now();

    for (let modelIdx = 0; modelIdx < modelEntries.length; modelIdx++) {
      const [modelId, elementIds] = modelEntries[modelIdx];
      
      const model = this.context.fragmentsManager.list.get(modelId);
      if (!model || typeof (model as any).getItemsData !== "function") {
        loadedCount += elementIds.length;
        this.context.updateLoadingProgress(loadedCount, totalCount);
        continue;
      }

      // Build quick category lookup cache for this model
      const categoryCache = new Map<number, string>();
      const classifier = this.context.components.get(OBC.Classifier);
      const categoriesObj = classifier.list.get("Categories");
      if (categoriesObj) {
        for (const [groupName, groupData] of categoriesObj.entries()) {
          const map = await groupData.get();
          if (map && map[modelId]) {
            for (const id of map[modelId]) {
              categoryCache.set(id, groupName);
            }
          }
        }
      }

      for (let i = 0; i < elementIds.length; i += BATCH_SIZE) {
        const batchIds = elementIds.slice(i, i + BATCH_SIZE);
        const batchRows: PropertyRow[] = [];
        
        try {
          const ifcDataArray = await (model as any).getItemsData(batchIds, {
            attributesDefault: true,
            relations: {
              IsDefinedBy: { attributes: true, relations: true },
            },
          });

          if (ifcDataArray && ifcDataArray.length > 0) {
            for (let j = 0; j < ifcDataArray.length; j++) {
              const ifcData = ifcDataArray[j];
              if (!ifcData) continue;

              const expressID = batchIds[j];
              const row = this.processIfcData(ifcData, expressID, modelId, categoryCache);
              batchRows.push(row);
              this.context.currentProperties.push(row);
              
              // Only add new columns if we haven't seen them yet
              Object.keys(row).forEach(key => {
                if (!knownColumns.has(key)) knownColumns.add(key);
              });
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching batch:`, error);
        }

        loadedCount += batchIds.length;
        this.loadedRowCount += batchRows.length;
        
        if (!tableInitialized && batchRows.length > 0) {
          this.context.initializeStreamingTable(batchRows, knownColumns);
          tableInitialized = true;
        } else if (tableInitialized && batchRows.length > 0) {
          this.context.appendRowsToTable(batchRows);
        }
        
        this.context.updateLoadingProgress(loadedCount, totalCount);

        // Yield to main thread to keep UI responsive
        const currentTime = performance.now();
        if (currentTime - lastYieldTime > 12) { // Yield if we've spent more than 12ms
          await new Promise(resolve => setTimeout(resolve, 0));
          lastYieldTime = performance.now();
        }
      }
    }

    this.context.updateLoadingProgress(loadedCount, totalCount, true);
    this.context.finishLoading();
  }

  /**
   * Process raw IFC data into a flat property row
   */
  public processIfcData(ifcData: any, expressID: number, modelId: string, categoryCache?: Map<number, string>): PropertyRow {
    const model = this.context.fragmentsManager.list.get(modelId);
    let sourceFile = "-";
    if (model) {
      const nameToUse = model.name || model.uuid || modelId;
      if (nameToUse) {
        sourceFile = nameToUse.replace(/\.(ifc|frag)$/i, "");
      }
    } else if (modelId) {
      sourceFile = modelId.replace(/\.(ifc|frag)$/i, "");
    }

    let category = categoryCache?.get(expressID);
    if (!category || category === "-") {
      const rawType = ifcData.type || ifcData.Template?.value || "-";
      category = typeof rawType === "string" ? rawType : "-";
    }

    // Robust getters for Name and Guid (case-insensitive check)
    const getName = () => {
      for (const key of ["Name", "name", "NAME"]) {
        const val = ifcData[key];
        if (val !== undefined && val !== null) {
          if (typeof val === "object" && "value" in val) return String(val.value);
          if (typeof val === "string" || typeof val === "number") return String(val);
        }
      }
      return "-";
    };

    const getGuid = () => {
      for (const key of ["globalId", "GlobalId", "globalID", "GlobalID", "guid", "Guid", "GUID"]) {
        const val = ifcData[key];
        if (val !== undefined && val !== null) {
          if (typeof val === "object" && "value" in val) return String(val.value);
          if (typeof val === "string" || typeof val === "number") return String(val);
        }
      }
      return "-";
    };

    const row: PropertyRow = {
      Category: category,
      Name: getName(),
      SourceFile: sourceFile,
      LocalId: expressID,
      Guid: getGuid(),
      expressID,
      modelId
    };

    // Extract attributes
    for (const [key, value] of Object.entries(ifcData)) {
      if (key.startsWith("_") || Array.isArray(value) || typeof value !== "object") continue;
      const lowerKey = key.toLowerCase();
      // Skip fields that we manually set above (case-insensitive) to prevent duplicate columns like Name and name
      if (
        lowerKey === "name" ||
        lowerKey === "globalid" ||
        lowerKey === "localid" ||
        lowerKey === "category" ||
        lowerKey === "sourcefile"
      ) {
        continue;
      }
      const attr = value as any;
      if (attr && "value" in attr && attr.value !== undefined && attr.value !== null) {
        row[key] = attr.value;
      }
    }

    // Extract property sets
    if (ifcData.IsDefinedBy && Array.isArray(ifcData.IsDefinedBy)) {
      for (const pset of ifcData.IsDefinedBy) {
        if (pset.HasProperties && Array.isArray(pset.HasProperties)) {
          for (const prop of pset.HasProperties) {
            const propName = prop.Name?.value;
            const propValue = prop.NominalValue?.value;
            if (propName && propValue !== undefined && propValue !== null) {
              const lowerPropName = propName.toLowerCase();
              if (
                lowerPropName === "name" ||
                lowerPropName === "globalid" ||
                lowerPropName === "localid" ||
                lowerPropName === "category" ||
                lowerPropName === "sourcefile"
              ) {
                continue;
              }
              row[propName] = propValue;
            }
          }
        }
      }
    }

    return row;
  }
}
