import { shopDrawingsService, type ShopDrawingRow } from "./shopDrawingsService";

export interface ShopDrawing {
  id: string;
  no: string;
  name: string;
  sheetId: string;
  currentRevision: number;
  isLatest: boolean;
  author: string | null;
  pdfUrl: string | null;
  pdfPath: string | null;
  lastUpdated: string;
}

export interface GroupedDrawing {
  sheetId: string;
  versions: ShopDrawing[];
}

// isLatest is cosmetic here — groupedDrawings only ever treats versions[0]
// (the max-revision row after sorting) as the latest, so a per-row flag
// isn't needed for correctness, only kept for shape compatibility.
export function mapShopDrawingRow(row: ShopDrawingRow): ShopDrawing {
  return {
    id: row.id,
    no: row.sheet_no,
    name: row.sheet_name,
    sheetId: row.sheet_no,
    currentRevision: row.revision,
    isLatest: false,
    author: row.author,
    pdfUrl: shopDrawingsService.getPdfPublicUrl(row.pdf_path),
    pdfPath: row.pdf_path,
    lastUpdated: row.uploaded_at,
  };
}
