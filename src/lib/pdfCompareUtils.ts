import jsPDF from "jspdf";

// Pixel-diff + export helpers for the shop-drawing "Compare Revisions" overlay.
// These are pure (no React, no store, no Supabase) — they take already-rendered
// page canvases and return a diff canvas / trigger a PDF download.
//
// Colour convention (matches the modal legend, which uses design tokens):
//   RED   = added   — content present in the NEWER revision but not the older
//   GREEN = removed  — content present in the OLDER revision but not the newer
//   GREY  = unchanged
// Red-for-added follows the AEC redline convention for new/revised content.

// RGB values chosen to read close to the `status-danger` / `status-ok` design
// tokens. Canvas ImageData can only take raw channel values, so these are
// hardcoded here (never in JSX) — the on-screen legend swatches use the tokens.
const ADDED_RGB = [214, 69, 55] as const; // ~ --color-status-danger
const REMOVED_RGB = [70, 180, 110] as const; // ~ --color-status-ok

// Below this summed per-channel delta a pixel counts as unchanged. Filters out
// anti-aliasing / resampling noise between two independently rendered pages.
const DIFF_THRESHOLD = 30;

/**
 * Draw a source canvas onto a fresh white-filled canvas of the given size,
 * top-left aligned. White-fill matters: the padded region of a smaller page
 * must read as background (not transparent black) so it doesn't register as a diff.
 */
function normalizeToSize(source: HTMLCanvasElement, width: number, height: number): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Build a diff canvas from two rendered page canvases.
 * @param newerCanvas the newer revision (revision A)
 * @param olderCanvas the older revision (revision B)
 *
 * Both canvases are first normalized to a common size so the flat-index pixel
 * walk stays aligned even when the two pages differ in dimensions (a latent
 * misalignment bug in the original reference implementation).
 */
export function createDiffCanvas(
  newerCanvas: HTMLCanvasElement,
  olderCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const width = Math.max(newerCanvas.width, olderCanvas.width);
  const height = Math.max(newerCanvas.height, olderCanvas.height);

  const newer = normalizeToSize(newerCanvas, width, height);
  const older = normalizeToSize(olderCanvas, width, height);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d")!;
  const diff = ctx.createImageData(width, height);

  const a = newer.data;
  const b = older.data;
  const d = diff.data;

  for (let i = 0; i < d.length; i += 4) {
    const rA = a[i], gA = a[i + 1], bA = a[i + 2];
    const rB = b[i], gB = b[i + 1], bB = b[i + 2];

    const delta = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);

    if (delta > DIFF_THRESHOLD) {
      // Whichever side is darker holds the ink at this pixel. Darker in the
      // newer (older is brighter) => content added; darker in the older => removed.
      const [r, g, bch] = rB + gB + bB > rA + gA + bA ? ADDED_RGB : REMOVED_RGB;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = bch;
      d[i + 3] = 255;
    } else {
      // Unchanged: show the older page in grey as faded context.
      const grey = Math.round((rB + gB + bB) / 3);
      d[i] = grey;
      d[i + 1] = grey;
      d[i + 2] = grey;
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(diff, 0, 0);
  return out;
}

interface ExportComparisonPdfParams {
  diffCanvas: HTMLCanvasElement;
  newerCanvas: HTMLCanvasElement;
  olderCanvas: HTMLCanvasElement;
  drawingNo: string;
  newerRev: number;
  olderRev: number;
}

// Strip characters that are unsafe / awkward in a download filename.
function safeFileName(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

/**
 * Build and trigger download of a 3-page A4 landscape comparison PDF:
 *   1. the diff overlay, 2. the older revision, 3. the newer revision.
 */
export function exportComparisonPdf({
  diffCanvas,
  newerCanvas,
  olderCanvas,
  drawingNo,
  newerRev,
  olderRev,
}: ExportComparisonPdfParams): void {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const titleBand = 15; // vertical space reserved for the page title
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2 - titleBand;

  const addPage = (canvas: HTMLCanvasElement, title: string, isFirst: boolean) => {
    if (!isFirst) pdf.addPage();

    const aspect = canvas.width / canvas.height;
    let imgWidth = contentWidth;
    let imgHeight = imgWidth / aspect;
    if (imgHeight > contentHeight) {
      imgHeight = contentHeight;
      imgWidth = imgHeight * aspect;
    }

    const x = margin + (contentWidth - imgWidth) / 2;
    const y = margin + titleBand + (contentHeight - imgHeight) / 2;

    pdf.setFontSize(14);
    pdf.text(title, pageWidth / 2, margin + 8, { align: "center" });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, imgWidth, imgHeight);
  };

  addPage(diffCanvas, `${drawingNo} — Comparison Rev${olderRev} vs Rev${newerRev}`, true);
  addPage(olderCanvas, `${drawingNo} — Rev${olderRev}`, false);
  addPage(newerCanvas, `${drawingNo} — Rev${newerRev}`, false);

  pdf.save(`${safeFileName(drawingNo)}_comparison_Rev${olderRev}_Rev${newerRev}.pdf`);
}
