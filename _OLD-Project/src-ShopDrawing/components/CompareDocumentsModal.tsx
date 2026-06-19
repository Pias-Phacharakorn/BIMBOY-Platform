import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Loader2, ZoomIn, ZoomOut, RotateCcw, Download, Layers, SplitSquareHorizontal, ExternalLink } from "lucide-react";
import PdfSliderCompare from "@/components/pdf-tools/PdfSliderCompare";
import { saveCompareResult } from "@/lib/compareResultStore";
import { useMiddleClickPan } from "@/hooks/useMiddleClickPan";
import jsPDF from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { getSignedPdfUrl } from "@/lib/pdfUtils";

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

async function fetchPdfArrayBuffer(pdfUrl: string): Promise<ArrayBuffer> {
  // Get signed URL first if it's a Supabase URL
  const url = pdfUrl.includes('supabase') ? await getSignedPdfUrl(pdfUrl) : pdfUrl;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status})`);
  }
  return await response.arrayBuffer();
}

interface Version {
  id: string;
  no: string;
  name: string;
  current_revision: number;
  pdf_url: string | null;
}

interface CompareDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: Version[];
  drawingNo: string;
}

const CompareDocumentsModal = ({
  isOpen,
  onClose,
  versions,
  drawingNo,
}: CompareDocumentsModalProps) => {
  const [versionA, setVersionA] = useState<string>("");
  const [versionB, setVersionB] = useState<string>("");
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);
  const [loadingPreviewA, setLoadingPreviewA] = useState(false);
  const [loadingPreviewB, setLoadingPreviewB] = useState(false);
  const [previewErrorA, setPreviewErrorA] = useState<string | null>(null);
  const [previewErrorB, setPreviewErrorB] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [revisionA, setRevisionA] = useState<number>(0);
  const [revisionB, setRevisionB] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  const [compareMode, setCompareMode] = useState<"overlay" | "slider">("overlay");
  const [previewAHQ, setPreviewAHQ] = useState<string | null>(null);
  const [previewBHQ, setPreviewBHQ] = useState<string | null>(null);
  const [openingNewTab, setOpeningNewTab] = useState(false);

  // Filter versions with PDFs
  const versionsWithPdf = versions.filter((v) => v.pdf_url);

  // Auto-select latest two versions on open
  useEffect(() => {
    if (isOpen && versionsWithPdf.length >= 2) {
      setVersionA(versionsWithPdf[0].id);
      setVersionB(versionsWithPdf[1].id);
      setRevisionA(versionsWithPdf[0].current_revision);
      setRevisionB(versionsWithPdf[1].current_revision);
      setComparisonResult(null);
      setCompareError(null);
      setZoomLevel(1);
    } else if (isOpen && versionsWithPdf.length === 1) {
      setVersionA(versionsWithPdf[0].id);
      setVersionB("");
      setRevisionA(versionsWithPdf[0].current_revision);
      setCompareError(null);
    }
  }, [isOpen, versions]);

  // Update revision numbers when selections change
  useEffect(() => {
    if (versionA) {
      const ver = versionsWithPdf.find((v) => v.id === versionA);
      if (ver) setRevisionA(ver.current_revision);
    }
  }, [versionA]);

  useEffect(() => {
    if (versionB) {
      const ver = versionsWithPdf.find((v) => v.id === versionB);
      if (ver) setRevisionB(ver.current_revision);
    }
  }, [versionB]);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoomLevel(1);

  // Format PDF filename as no_name.pdf
  const pdfFileName = `${drawingNo}.pdf`;

  // Generate preview when version changes
  useEffect(() => {
    if (versionA) {
      const version = versionsWithPdf.find((v) => v.id === versionA);
      if (version?.pdf_url) {
        generatePreview(
          version.pdf_url,
          setPreviewA,
          setLoadingPreviewA,
          setPreviewErrorA
        );
      }
    } else {
      setPreviewA(null);
      setPreviewErrorA(null);
    }
  }, [versionA]);

  useEffect(() => {
    if (versionB) {
      const version = versionsWithPdf.find((v) => v.id === versionB);
      if (version?.pdf_url) {
        generatePreview(
          version.pdf_url,
          setPreviewB,
          setLoadingPreviewB,
          setPreviewErrorB
        );
      }
    } else {
      setPreviewB(null);
      setPreviewErrorB(null);
    }
  }, [versionB]);

  const generatePreview = async (
    pdfUrl: string,
    setPreview: (url: string | null) => void,
    setLoading: (loading: boolean) => void,
    setError: (message: string | null) => void
  ) => {
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await fetchPdfArrayBuffer(pdfUrl);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const scale = 0.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      setPreview(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error("Error generating preview:", error);
      setPreview(null);
      setError(error instanceof Error ? error.message : "Failed to render preview");
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!versionA || !versionB) return;

    const verA = versionsWithPdf.find((v) => v.id === versionA);
    const verB = versionsWithPdf.find((v) => v.id === versionB);

    if (!verA?.pdf_url || !verB?.pdf_url) return;

    setComparing(true);
    setCompareError(null);
    try {
      // Render both PDFs to canvas and compare
      const [canvasA, canvasB] = await Promise.all([
        renderPdfToCanvas(verA.pdf_url),
        renderPdfToCanvas(verB.pdf_url),
      ]);

      // Store HQ previews for slider mode
      setPreviewAHQ(canvasA.toDataURL("image/png"));
      setPreviewBHQ(canvasB.toDataURL("image/png"));

      // Create diff canvas
      const diffCanvas = createDiffCanvas(canvasA, canvasB);
      setComparisonResult(diffCanvas.toDataURL("image/png"));
    } catch (error) {
      console.error("Error comparing PDFs:", error);
      setCompareError(error instanceof Error ? error.message : "Compare failed");
    } finally {
      setComparing(false);
    }
  };

  const renderPdfToCanvas = async (pdfUrl: string): Promise<HTMLCanvasElement> => {
    const arrayBuffer = await fetchPdfArrayBuffer(pdfUrl);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  };

  const createDiffCanvas = (
    canvasA: HTMLCanvasElement,
    canvasB: HTMLCanvasElement
  ): HTMLCanvasElement => {
    const width = Math.max(canvasA.width, canvasB.width);
    const height = Math.max(canvasA.height, canvasB.height);

    const diffCanvas = document.createElement("canvas");
    diffCanvas.width = width;
    diffCanvas.height = height;
    const ctx = diffCanvas.getContext("2d")!;

    // Draw base image (version B - older)
    ctx.drawImage(canvasB, 0, 0);

    // Get image data for comparison
    const ctxA = canvasA.getContext("2d")!;
    const ctxB = canvasB.getContext("2d")!;

    const dataA = ctxA.getImageData(0, 0, canvasA.width, canvasA.height);
    const dataB = ctxB.getImageData(0, 0, canvasB.width, canvasB.height);

    const diffData = ctx.createImageData(width, height);

    // Compare pixels and highlight differences
    for (let i = 0; i < Math.min(dataA.data.length, dataB.data.length); i += 4) {
      const rA = dataA.data[i];
      const gA = dataA.data[i + 1];
      const bA = dataA.data[i + 2];

      const rB = dataB.data[i];
      const gB = dataB.data[i + 1];
      const bB = dataB.data[i + 2];

      // Calculate difference
      const diff = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);

      if (diff > 30) {
        // Threshold for detecting change
        // Highlight removed content (in version B but not A) in green
        if (rB + gB + bB > rA + gA + bA) {
          diffData.data[i] = 100; // Green
          diffData.data[i + 1] = 255;
          diffData.data[i + 2] = 100;
          diffData.data[i + 3] = 255;
        } else {
          // Highlight added content (in version A but not B) in red
          diffData.data[i] = 255;
          diffData.data[i + 1] = 100; // Red
          diffData.data[i + 2] = 100;
          diffData.data[i + 3] = 255;
        }
      } else {
        // No significant change - show grayscale version
        const gray = Math.round((rB + gB + bB) / 3);
        diffData.data[i] = gray;
        diffData.data[i + 1] = gray;
        diffData.data[i + 2] = gray;
        diffData.data[i + 3] = 255;
      }
    }

    ctx.putImageData(diffData, 0, 0);
    return diffCanvas;
  };

  const handleClose = () => {
    setComparisonResult(null);
    setPreviewA(null);
    setPreviewB(null);
    setPreviewAHQ(null);
    setPreviewBHQ(null);
    setPreviewErrorA(null);
    setPreviewErrorB(null);
    setCompareError(null);
    setCompareMode("overlay");
    setVersionA("");
    setVersionB("");
    onClose();
  };

  const handleOpenNewTab = async () => {
    if (!comparisonResult || !previewAHQ || !previewBHQ) return;
    setOpeningNewTab(true);
    try {
      const olderRev = Math.min(revisionA, revisionB);
      const newerRev = Math.max(revisionA, revisionB);
      const id = await saveCompareResult({
        comparisonResult,
        previewAHQ,
        previewBHQ,
        fileAName: `${drawingNo} R${newerRev}`,
        fileBName: `${drawingNo} R${olderRev}`,
      });
      window.open(`/compare-result?id=${id}`, "_blank");
    } catch (error) {
      console.error("Failed to open in new tab:", error);
    } finally {
      setOpeningNewTab(false);
    }
  };

  const handleExportPdf = async () => {
    if (!comparisonResult || !versionA || !versionB) return;

    const verA = versionsWithPdf.find((v) => v.id === versionA);
    const verB = versionsWithPdf.find((v) => v.id === versionB);

    if (!verA?.pdf_url || !verB?.pdf_url) return;

    setExporting(true);
    try {
      // Render both PDFs at higher quality for export
      const [canvasA, canvasB] = await Promise.all([
        renderPdfToCanvas(verA.pdf_url),
        renderPdfToCanvas(verB.pdf_url),
      ]);

      // Recreate diff canvas for export
      const diffCanvas = createDiffCanvas(canvasA, canvasB);

      // Determine PDF dimensions (A4 landscape)
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2 - 15; // Leave space for title

      // Helper to add image centered on page
      const addImageToPage = (
        canvas: HTMLCanvasElement,
        title: string
      ) => {
        const imgData = canvas.toDataURL("image/png");
        const aspectRatio = canvas.width / canvas.height;
        
        let imgWidth = contentWidth;
        let imgHeight = imgWidth / aspectRatio;
        
        if (imgHeight > contentHeight) {
          imgHeight = contentHeight;
          imgWidth = imgHeight * aspectRatio;
        }

        const x = margin + (contentWidth - imgWidth) / 2;
        const y = margin + 15 + (contentHeight - imgHeight) / 2;

        pdf.setFontSize(14);
        pdf.text(title, pageWidth / 2, margin + 8, { align: "center" });
        pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
      };

      // Page 1: Comparison Result
      const olderRev = Math.min(revisionA, revisionB);
      const newerRev = Math.max(revisionA, revisionB);
      addImageToPage(diffCanvas, `${drawingNo} - Comparison R${olderRev} vs R${newerRev}`);

      // Page 2: Older revision
      pdf.addPage();
      const olderCanvas = revisionA < revisionB ? canvasA : canvasB;
      addImageToPage(olderCanvas, `${drawingNo} - R${olderRev}`);

      // Page 3: Newer revision
      pdf.addPage();
      const newerCanvas = revisionA > revisionB ? canvasA : canvasB;
      addImageToPage(newerCanvas, `${drawingNo} - R${newerRev}`);

      // Download
      pdf.save(`${drawingNo}_comparison_R${olderRev}_R${newerRev}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-4 border-b">
          <DialogTitle>Compare documents</DialogTitle>
        </DialogHeader>

        {!comparisonResult ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              {/* Document A */}
              <div className="space-y-3">
                <div className="text-sm font-medium truncate">
                  {pdfFileName}
                </div>
                <div className="border rounded-lg bg-muted/20 aspect-[4/3] flex items-center justify-center overflow-hidden">
                  {loadingPreviewA ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : previewA ? (
                    <img
                      src={previewA}
                      alt="Document A preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm text-center px-3">
                      {previewErrorA ? previewErrorA : "No preview available"}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Revision</div>
                  <Select value={versionA} onValueChange={setVersionA}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select revision" />
                    </SelectTrigger>
                    <SelectContent>
                      {versionsWithPdf.map((v) => (
                        <SelectItem
                          key={v.id}
                          value={v.id}
                          disabled={v.id === versionB}
                        >
                          R{v.current_revision}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Arrow separator */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-8 hidden md:flex">
                <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Document B */}
              <div className="space-y-3">
                <div className="text-sm font-medium truncate">
                  {pdfFileName}
                </div>
                <div className="border rounded-lg bg-muted/20 aspect-[4/3] flex items-center justify-center overflow-hidden">
                  {loadingPreviewB ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : previewB ? (
                    <img
                      src={previewB}
                      alt="Document B preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm text-center px-3">
                      {previewErrorB ? previewErrorB : "No preview available"}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Revision</div>
                  <Select value={versionB} onValueChange={setVersionB}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select revision" />
                    </SelectTrigger>
                    <SelectContent>
                      {versionsWithPdf.map((v) => (
                        <SelectItem
                          key={v.id}
                          value={v.id}
                          disabled={v.id === versionA}
                        >
                          R{v.current_revision}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {compareError ? (
              <div className="text-sm text-destructive">{compareError}</div>
            ) : null}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCompare}
                disabled={!versionA || !versionB || comparing}
                className="bg-[#1B4284] hover:bg-[#1B4284]/90 text-white"
              >
                {comparing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Comparing...
                  </>
                ) : (
                  "Compare"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toolbar: mode toggle + zoom + actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Mode toggle */}
                <div className="flex items-center bg-muted rounded-md p-0.5 mr-2">
                  <Button
                    variant={compareMode === "overlay" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 gap-1.5"
                    onClick={() => setCompareMode("overlay")}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span className="text-xs">Overlay</span>
                  </Button>
                  <Button
                    variant={compareMode === "slider" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 gap-1.5"
                    onClick={() => setCompareMode("slider")}
                  >
                    <SplitSquareHorizontal className="h-3.5 w-3.5" />
                    <span className="text-xs">Slider</span>
                  </Button>
                </div>
                {/* Zoom controls */}
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={zoomLevel <= 0.5}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={zoomLevel >= 3}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomReset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                {/* Open in new tab */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleOpenNewTab}
                  disabled={openingNewTab}
                  title="Open in new tab"
                >
                  {openingNewTab ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {/* Legend (overlay mode only) */}
              {compareMode === "overlay" && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(142, 76%, 36%)" }} />
                    <span>Added (R{Math.max(revisionA, revisionB)})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-destructive/70 rounded" />
                    <span>Removed (R{Math.min(revisionA, revisionB)})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Comparison view */}
            {compareMode === "overlay" ? (
              <div className="border rounded-lg overflow-auto" style={{ height: "50vh" }}>
                <div style={{ width: `${zoomLevel * 100}%` }}>
                  <img
                    src={comparisonResult}
                    alt="Comparison result"
                    className="w-full block"
                    draggable={false}
                  />
                </div>
              </div>
            ) : (
              previewAHQ && previewBHQ && (
                <PdfSliderCompare imageA={previewAHQ} imageB={previewBHQ} zoomLevel={zoomLevel} height="50vh" />
              )
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setComparisonResult(null); setCompareMode("overlay"); setZoomLevel(1); }}>
                Back to Selection
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={exporting}
                className="bg-[#1B4284] hover:bg-[#1B4284]/90 text-white"
              >
                {exporting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" />Export PDF</>
                )}
              </Button>
              <Button onClick={handleClose} className="bg-[#1B4284] hover:bg-[#1B4284]/90 text-white">Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CompareDocumentsModal;
