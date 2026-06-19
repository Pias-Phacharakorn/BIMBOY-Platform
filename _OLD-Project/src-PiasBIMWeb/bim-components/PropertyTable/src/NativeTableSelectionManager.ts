import * as OBF from "@thatopen/components-front";
import * as OBC from "@thatopen/components";

export class NativeTableSelectionManager {
  private selectedRow: HTMLTableRowElement | null = null;

  constructor(
    private highlighter: OBF.Highlighter | null,
    private zoomFn: (expressID: number, modelId?: string) => Promise<void>
  ) {}

  public clearSelection(): void {
    if (this.selectedRow) {
      this.selectedRow.classList.remove("selected");
      this.selectedRow = null;
    }
  }

  /**
   * Handle a click on an expressID cell:
   * 1. Clear previous row selection
   * 2. Mark new row as selected
   * 3. Clear old highlight, apply new highlight
   * 4. Zoom camera to element
   */
  public async handleExpressIdClick(
    expressID: number,
    modelId: string | undefined,
    tr: HTMLTableRowElement
  ): Promise<void> {
    // Update row selection visual
    if (this.selectedRow) {
      this.selectedRow.classList.remove("selected");
    }
    tr.classList.add("selected");
    this.selectedRow = tr;

    if (!expressID || !modelId) return;

    // Highlight
    if (this.highlighter) {
      const fragmentMap: OBC.ModelIdMap = {
        [modelId]: new Set([expressID]),
      };
      try {
        await this.highlighter.clear("select");
        await this.highlighter.highlightByID("select", fragmentMap, true, false);
      } catch (err) {
        console.warn("[PropertyTable] Highlighter select failed:", err);
      }
    }

    // Zoom
    await this.zoomFn(expressID, modelId);
  }
}
