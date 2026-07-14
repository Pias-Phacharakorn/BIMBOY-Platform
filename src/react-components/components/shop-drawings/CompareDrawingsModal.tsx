import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  GitCompareArrows,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  SplitSquareHorizontal,
  Download,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { ShopDrawing } from "@/react-components/features/shop-drawings/shopDrawingTypes";
import { createDiffCanvas, exportComparisonPdf } from "@/lib/pdfCompareUtils";
import { PdfSliderCompare } from "./PdfSliderCompare";
import { PdfOverlayCompare } from "./PdfOverlayCompare";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type CompareMode = "overlay" | "slider";

interface CompareDrawingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  drawingNo: string;
  versions: ShopDrawing[];
}

async function loadPdfDocument(pdfUrl: string): Promise<PDFDocumentProxy> {
  const response = await fetch(pdfUrl);
  if (!response.ok) throw new Error(`Failed to fetch PDF (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

async function renderPageToCanvas(pdf: PDFDocumentProxy, pageNumber: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

// One side of the comparison: owns its own PDF document, page selector, and
// rendered preview — independent of the other side (page counts and selected
// page can differ between revisions). Exposes the rendered canvas as well as a
// data URL, since the overlay diff and PDF export need pixel access.
function usePdfSide(pdfUrl: string | undefined) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the document fresh whenever the selected revision changes; reset to page 1.
  useEffect(() => {
    if (!pdfUrl) {
      setDoc(null);
      setPreview(null);
      setCanvas(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    setCanvas(null);
    loadPdfDocument(pdfUrl)
      .then((pdf) => {
        if (cancelled) return;
        setDoc(pdf);
        setPage(1);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error loading PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to load PDF.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Render whichever page is selected once the document (or page) changes.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    renderPageToCanvas(doc, page)
      .then((rendered) => {
        if (cancelled) return;
        setCanvas(rendered);
        setPreview(rendered.toDataURL("image/png"));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error rendering PDF page:", err);
        setError(err instanceof Error ? err.message : "Failed to render page.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  return { numPages: doc?.numPages ?? 1, page, setPage, preview, canvas, loading, error };
}

export function CompareDrawingsModal({ isOpen, onClose, drawingNo, versions }: CompareDrawingsModalProps) {
  const versionsWithPdf = useMemo(
    () => [...versions].filter((v) => v.pdfUrl).sort((a, b) => b.currentRevision - a.currentRevision),
    [versions]
  );

  const [versionAId, setVersionAId] = useState<string>("");
  const [versionBId, setVersionBId] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [compareMode, setCompareMode] = useState<CompareMode>("overlay");
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // Holds the last computed diff canvas so export reuses it instead of recomputing.
  const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoomLevel(1);

  // Default to the two newest revisions whenever the dialog opens
  useEffect(() => {
    if (isOpen && versionsWithPdf.length >= 2) {
      setVersionAId(versionsWithPdf[0].id);
      setVersionBId(versionsWithPdf[1].id);
    }
  }, [isOpen, versionsWithPdf]);

  // Esc quits compare mode
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const versionA = versionsWithPdf.find((v) => v.id === versionAId);
  const versionB = versionsWithPdf.find((v) => v.id === versionBId);

  const sideA = usePdfSide(isOpen ? versionA?.pdfUrl ?? undefined : undefined);
  const sideB = usePdfSide(isOpen ? versionB?.pdfUrl ?? undefined : undefined);

  // Recompute the overlay diff whenever either side's rendered page changes.
  // Runs regardless of the active mode so the export and mode-toggle are instant.
  const canvasA = sideA.canvas;
  const canvasB = sideB.canvas;
  useEffect(() => {
    if (!canvasA || !canvasB) {
      diffCanvasRef.current = null;
      setOverlayUrl(null);
      return;
    }
    const diff = createDiffCanvas(canvasA, canvasB);
    diffCanvasRef.current = diff;
    setOverlayUrl(diff.toDataURL("image/png"));
  }, [canvasA, canvasB]);

  const handleExport = () => {
    if (!canvasA || !canvasB || !versionA || !versionB) return;
    setExporting(true);
    try {
      const diffCanvas = diffCanvasRef.current ?? createDiffCanvas(canvasA, canvasB);
      exportComparisonPdf({
        diffCanvas,
        newerCanvas: canvasA,
        olderCanvas: canvasB,
        drawingNo,
        newerRev: versionA.currentRevision,
        olderRev: versionB.currentRevision,
      });
    } catch (err) {
      console.error("Error exporting comparison PDF:", err);
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  if (versionsWithPdf.length < 2) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <div
          className="w-[420px] max-w-full flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
            <span className="flex items-center gap-2 text-xs font-bold text-fg">
              <GitCompareArrows className="w-4 h-4" />
              Compare Revisions — {drawingNo}
            </span>
            <button onClick={onClose} className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer" type="button" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted p-4">Need at least 2 revisions with PDFs to compare.</p>
        </div>
      </div>,
      document.body
    );
  }

  const loading = sideA.loading || sideB.loading;
  const error = sideA.error || sideB.error;
  const canExport = !!canvasA && !!canvasB && !loading && !error;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-surface" onClick={onClose}>
      <div className="flex flex-col flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
          <span className="flex items-center gap-2 text-xs font-bold text-fg truncate">
            <GitCompareArrows className="w-4 h-4 flex-none" />
            <span className="truncate">Compare Revisions — {drawingNo}</span>
          </span>

          <div className="flex items-center gap-2 flex-none">
            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport || exporting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-radius bg-accent text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Export comparison as PDF"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export PDF
            </button>
            <button onClick={onClose} className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer" type="button" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-surface-raised border-b border-border flex-none">
          <div className="flex gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted flex-1">
              Newer revision
              <select
                value={versionAId}
                onChange={(e) => setVersionAId(e.target.value)}
                className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
              >
                {versionsWithPdf.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id === versionBId}>
                    Rev {v.currentRevision}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted w-20">
              Page
              <select
                value={sideA.page}
                onChange={(e) => sideA.setPage(Number(e.target.value))}
                className="h-9 px-2 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
              >
                {Array.from({ length: sideA.numPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted flex-1">
              Older revision
              <select
                value={versionBId}
                onChange={(e) => setVersionBId(e.target.value)}
                className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
              >
                {versionsWithPdf.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id === versionAId}>
                    Rev {v.currentRevision}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted w-20">
              Page
              <select
                value={sideB.page}
                onChange={(e) => sideB.setPage(Number(e.target.value))}
                className="h-9 px-2 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
              >
                {Array.from({ length: sideB.numPages }, (_, i) => i + 1).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center gap-2 flex-1 text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Rendering PDFs...</span>
            </div>
          )}

          {!loading && error && (
            <div className="text-xs text-status-danger py-2 px-3 border border-status-danger/20 bg-status-danger/10 rounded-radius">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="flex-1 min-h-0">
              {compareMode === "overlay"
                ? overlayUrl && <PdfOverlayCompare image={overlayUrl} zoomLevel={zoomLevel} height="100%" />
                : sideA.preview && sideB.preview && (
                    <PdfSliderCompare imageA={sideA.preview} imageB={sideB.preview} zoomLevel={zoomLevel} height="100%" />
                  )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-surface-raised border-t border-border flex-none">
          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-surface-alt rounded-radius">
            <button
              type="button"
              onClick={() => setCompareMode("overlay")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-radius transition-all cursor-pointer ${
                compareMode === "overlay" ? "bg-accent text-white" : "text-muted hover:text-fg"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Overlay
            </button>
            <button
              type="button"
              onClick={() => setCompareMode("slider")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-radius transition-all cursor-pointer ${
                compareMode === "slider" ? "bg-accent text-white" : "text-muted hover:text-fg"
              }`}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              Slider
            </button>
          </div>

          {/* Legend (overlay only) */}
          {compareMode === "overlay" && versionA && versionB && (
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-status-danger" />
                Added (Rev {versionA.currentRevision})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-status-ok" />
                Removed (Rev {versionB.currentRevision})
              </span>
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleZoomOut} disabled={zoomLevel <= 0.5} className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer" title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-muted w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button type="button" onClick={handleZoomIn} disabled={zoomLevel >= 3} className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer" title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={handleZoomReset} className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer" title="Reset zoom">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
