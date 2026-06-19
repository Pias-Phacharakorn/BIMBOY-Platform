import * as OBC from "@thatopen/components";
import { ClashData, ClashParser } from "./src";

export class ClashImport extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "56041697-36e6-4b8c-9c9e-5e9e8f6e8e8e" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();
  readonly onProgress = new OBC.Event<{ progress: number; message: string }>();

  list: ClashData[] = [];
  baseDir: string = "";
  searchQuery = "";
  selectedStatus = "";
  selectedType = "";

  setFilters(searchQuery: string, selectedStatus: string, selectedType: string) {
    this.searchQuery = searchQuery;
    this.selectedStatus = selectedStatus;
    this.selectedType = selectedType;
    document.dispatchEvent(new CustomEvent("clash-filters-changed"));
  }

  constructor(components: OBC.Components) {
    super(components);
    components.add(ClashImport.uuid, this);
  }

  async loadReport(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed fetching data from HTML report!");
      const htmlText = await response.text();
      
      this.baseDir = url.substring(0, url.lastIndexOf("/") + 1);
      
      return this.loadFromText(htmlText, this.baseDir);
    } catch (error) {
      console.error("Error loading Clash Report:", error);
      throw error;
    }
  }

  loadFromText(htmlText: string, baseDir: string) {
    this.baseDir = baseDir;
    const result = ClashParser.parseHTML(htmlText, this.baseDir);
    this.list = result.list;

    if (result.errors.length > 0) {
      console.warn(`Clash Report parsed with ${result.errors.length} errors:`, result.errors);
    }

    return this.list;
  }

  async dispose() {
    this.list = [];
    this.onProgress.reset();
    this.onDisposed.trigger(ClashImport.uuid);
    this.onDisposed.reset();
  }
}

export * from "./src";
