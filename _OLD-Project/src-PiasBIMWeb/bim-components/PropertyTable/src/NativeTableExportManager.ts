import { PropertyRow } from "./TableDataManager";

export class NativeTableExportManager {
  public async exportToCSV(data: PropertyRow[]): Promise<void> {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).filter(k => k !== "modelId");
    const csvRows = [
      headers.join(","),
      ...data.map(row =>
        headers
          .map(header => {
            const val = row[header];
            const str = val !== undefined && val !== null ? String(val) : "";
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const fileName = `ifc_properties_${Date.now()}.csv`;

    await this._saveFile(blob, fileName, [
      { description: "CSV File", accept: { "text/csv": [".csv"] } },
    ]);
  }

  public async exportToJSON(data: PropertyRow[]): Promise<void> {
    if (data.length === 0) return;

    // Exclude internal modelId from export
    const clean = data.map(row => {
      const { modelId, ...rest } = row;
      return rest;
    });

    const jsonContent = JSON.stringify(clean, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const fileName = `ifc_properties_${Date.now()}.json`;

    await this._saveFile(blob, fileName, [
      { description: "JSON File", accept: { "application/json": [".json"] } },
    ]);
  }

  private async _saveFile(blob: Blob, suggestedName: string, types: any[]): Promise<void> {
    // Prefer File System Access API (Chrome / Edge)
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({ suggestedName, types });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return; // user cancelled
        console.warn("[PropertyTable] File System Access API failed, falling back:", err);
      }
    }

    // Fallback: <a> download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.style.visibility = "hidden";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
