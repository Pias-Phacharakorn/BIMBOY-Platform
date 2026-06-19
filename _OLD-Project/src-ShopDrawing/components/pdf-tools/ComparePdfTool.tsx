import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { renderPdfToCanvas, createDiffCanvas } from "@/lib/pdfCompareUtils";
import { saveCompareResult } from "@/lib/compareResultStore";
import { Upload, Loader2, FileText, X, ZoomIn, ZoomOut, RotateCcw, Download, ArrowLeftRight, Layers, SplitSquareHorizontal, ExternalLink } from "lucide-react";
import jsPDF from "jspdf";
import PdfSliderCompare from "./PdfSliderCompare";
import { useMiddleClickPan } from "@/hooks/useMiddleClickPan";

const OverlayView = ({ comparisonResult, zoomLevel }: { comparisonResult: string; zoomLevel: number }) => {
  const { containerRef, panHandlers } = useMiddleClickPan();
  return (
    <div
      ref={containerRef}
      className="border rounded-lg overflow-auto max-h-[60vh] bg-muted/20"
      {...panHandlers}
    >
      <div style={{ width: `${zoomLevel * 100}%` }}>
        <img
          src={comparisonResult}
          alt="Comparison result"
          className="w-full block"
          draggable={false}
        />
      </div>
    </div>
  );
};

const ComparePdfTool = () => {
  const { toast } = useToast();
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [canvasA, setCanvasA] = useState<HTMLCanvasElement | null>(null);
  const [canvasB, setCanvasB] = useState<HTMLCanvasElement | null>(null);
  const [compareMode, setCompareMode] = useState<"overlay" | "slider">("overlay");
  const [previewAHQ, setPreviewAHQ] = useState<string | null>(null);
  const [previewBHQ, setPreviewBHQ] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (
    file: File,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void,
    setLoading: (l: boolean) => void,
    setCanvas: (c: HTMLCanvasElement | null) => void
  ) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setComparisonResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const canvas = await renderPdfToCanvas(arrayBuffer, 0.5);
      setCanvas(canvas);
      setPreview(canvas.toDataURL("image/png"));
      setFile(file);
    } catch (error) {
      console.error("Error loading PDF:", error);
      toast({
        title: "Error",
        description: "Failed to load PDF file",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, side: "A" | "B") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (side === "A") {
      handleFileSelect(file, setFileA, setPreviewA, setLoadingA, setCanvasA);
    } else {
      handleFileSelect(file, setFileB, setPreviewB, setLoadingB, setCanvasB);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent, side: "A" | "B") => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (side === "A") {
      handleFileSelect(file, setFileA, setPreviewA, setLoadingA, setCanvasA);
    } else {
      handleFileSelect(file, setFileB, setPreviewB, setLoadingB, setCanvasB);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearFile = (side: "A" | "B") => {
    if (side === "A") {
      setFileA(null);
      setPreviewA(null);
      setCanvasA(null);
    } else {
      setFileB(null);
      setPreviewB(null);
      setCanvasB(null);
    }
    setComparisonResult(null);
  };

  const handleCompare = async () => {
    if (!fileA || !fileB) return;

    setComparing(true);
    try {
      const arrayBufferA = await fileA.arrayBuffer();
      const arrayBufferB = await fileB.arrayBuffer();

      const [canvasAHQ, canvasBHQ] = await Promise.all([
        renderPdfToCanvas(arrayBufferA, 1.5),
        renderPdfToCanvas(arrayBufferB, 1.5),
      ]);

      setCanvasA(canvasAHQ);
      setCanvasB(canvasBHQ);
      setPreviewAHQ(canvasAHQ.toDataURL("image/png"));
      setPreviewBHQ(canvasBHQ.toDataURL("image/png"));

      const diffCanvas = createDiffCanvas(canvasAHQ, canvasBHQ);
      setComparisonResult(diffCanvas.toDataURL("image/png"));

      toast({
        title: "Comparison complete",
        description: "Red = added, Green = removed",
      });
    } catch (error) {
      console.error("Error comparing PDFs:", error);
      toast({
        title: "Error",
        description: "Failed to compare PDFs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setComparing(false);
    }
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoomLevel(1);

  const handleExportPdf = async () => {
    if (!comparisonResult || !canvasA || !canvasB) return;

    setExporting(true);
    try {
      const diffCanvas = createDiffCanvas(canvasA, canvasB);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2 - 15;

      const addImageToPage = (canvas: HTMLCanvasElement, title: string) => {
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

      // Page 1: Comparison
      addImageToPage(diffCanvas, "Comparison Result");

      // Page 2: Document A
      pdf.addPage();
      addImageToPage(canvasA, `Document A: ${fileA?.name || "Unknown"}`);

      // Page 3: Document B
      pdf.addPage();
      addImageToPage(canvasB, `Document B: ${fileB?.name || "Unknown"}`);

      pdf.save("comparison_result.pdf");

      toast({
        title: "Export complete",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleBack = () => {
    setComparisonResult(null);
    setZoomLevel(1);
  };

  if (comparisonResult) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Mode toggle and zoom controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

                <Button variant="outline" size="icon" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm w-16 text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button variant="outline" size="icon" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleZoomReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-auto px-2.5 gap-1.5 ml-1"
                  onClick={async () => {
                    if (!comparisonResult || !previewAHQ || !previewBHQ) return;

                    try {
                      const resultId = await saveCompareResult({
                        comparisonResult,
                        previewAHQ,
                        previewBHQ,
                        fileAName: fileA?.name || "Document A",
                        fileBName: fileB?.name || "Document B",
                      });

                      window.open(`/compare-result?id=${encodeURIComponent(resultId)}`, "_blank", "noopener,noreferrer");
                    } catch (error) {
                      console.error("Error opening comparison in new tab:", error);
                      toast({
                        title: "Unable to open result",
                        description: "The comparison is too large to transfer. Please export the PDF instead.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="text-xs">New Tab</span>
                </Button>
              </div>
              {compareMode === "overlay" && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(142, 76%, 70%)" }} />
                    <span>Added</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-destructive/70 rounded" />
                    <span>Removed</span>
                  </div>
                </div>
              )}
            </div>

            {/* Comparison view */}
            {compareMode === "overlay" ? (
              <OverlayView
                comparisonResult={comparisonResult}
                zoomLevel={zoomLevel}
              />
            ) : (
              previewAHQ && previewBHQ && (
                <PdfSliderCompare
                  imageA={previewAHQ}
                  imageB={previewBHQ}
                  zoomLevel={zoomLevel}
                />
              )
            )}

            <div className="flex justify-between gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
            {/* Document A */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Document A <span className="text-muted-foreground font-normal">(Newer Version)</span></label>
              {!fileA ? (
                <div
                  onDrop={(e) => handleDrop(e, "A")}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors aspect-[4/3] flex flex-col items-center justify-center"
                >
                  {loadingA ? (
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground mb-2">Drop PDF here</p>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleInputChange(e, "A")}
                        className="hidden"
                        id="compare-file-a"
                      />
                      <Button variant="outline" size="sm" asChild>
                        <label htmlFor="compare-file-a" className="cursor-pointer">
                          Select
                        </label>
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="border rounded-lg overflow-hidden aspect-[4/3] bg-muted/20 flex items-center justify-center">
                    {previewA && (
                      <img
                        src={previewA}
                        alt="Document A preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs truncate flex-1">{fileA.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => clearFile("A")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Compare Icon */}
            <div className="hidden md:flex items-center justify-center">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <ArrowLeftRight className="h-6 w-6" />
              </div>
            </div>

            {/* Document B */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Document B <span className="text-muted-foreground font-normal">(Older Version)</span></label>
              {!fileB ? (
                <div
                  onDrop={(e) => handleDrop(e, "B")}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors aspect-[4/3] flex flex-col items-center justify-center"
                >
                  {loadingB ? (
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground mb-2">Drop PDF here</p>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleInputChange(e, "B")}
                        className="hidden"
                        id="compare-file-b"
                      />
                      <Button variant="outline" size="sm" asChild>
                        <label htmlFor="compare-file-b" className="cursor-pointer">
                          Select
                        </label>
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="border rounded-lg overflow-hidden aspect-[4/3] bg-muted/20 flex items-center justify-center">
                    {previewB && (
                      <img
                        src={previewB}
                        alt="Document B preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs truncate flex-1">{fileB.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => clearFile("B")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              onClick={handleCompare}
              disabled={!fileA || !fileB || comparing}
              className="bg-primary hover:bg-primary/90"
            >
              {comparing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Comparing...
                </>
              ) : (
                "Compare Documents"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComparePdfTool;
