import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCompareResult } from "@/lib/compareResultStore";
import { ZoomIn, ZoomOut, RotateCcw, Download, Layers, SplitSquareHorizontal, Loader2 } from "lucide-react";
import PdfSliderCompare from "@/components/pdf-tools/PdfSliderCompare";
import { useMiddleClickPan } from "@/hooks/useMiddleClickPan";
import jsPDF from "jspdf";

const OverlayView = ({ comparisonResult, zoomLevel }: { comparisonResult: string; zoomLevel: number }) => {
  const { containerRef, panHandlers } = useMiddleClickPan();
  return (
    <div
      ref={containerRef}
      className="border rounded-lg overflow-auto bg-muted/20"
      style={{ height: "calc(100vh - 200px)" }}
      {...panHandlers}
    >
      <div style={{ width: `${zoomLevel * 100}%` }}>
        <img src={comparisonResult} alt="Comparison result" className="w-full block" draggable={false} />
      </div>
    </div>
  );
};

const CompareResult = () => {
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [previewAHQ, setPreviewAHQ] = useState<string | null>(null);
  const [previewBHQ, setPreviewBHQ] = useState<string | null>(null);
  const [fileAName, setFileAName] = useState<string>("");
  const [fileBName, setFileBName] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [compareMode, setCompareMode] = useState<"overlay" | "slider">("overlay");
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadComparison = async () => {
      const resultId = new URLSearchParams(window.location.search).get("id");

      if (!resultId) {
        setLoading(false);
        return;
      }

      try {
        const result = await getCompareResult(resultId);

        if (result) {
          setComparisonResult(result.comparisonResult);
          setPreviewAHQ(result.previewAHQ);
          setPreviewBHQ(result.previewBHQ);
          setFileAName(result.fileAName || "Document A");
          setFileBName(result.fileBName || "Document B");
        }
      } catch (error) {
        console.error("Failed to load comparison data:", error);
      } finally {
        setLoading(false);
      }
    };

    void loadComparison();
  }, []);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoomLevel(1);

  const handleExportPdf = async () => {
    if (!comparisonResult || !previewAHQ || !previewBHQ) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2 - 15;

      const addImageToPage = (imgData: string, title: string) => {
        const img = new Image();
        img.src = imgData;
        const aspectRatio = img.naturalWidth / img.naturalHeight || 1.5;
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

      addImageToPage(comparisonResult, "Comparison Result");
      pdf.addPage();
      addImageToPage(previewAHQ, `Document A: ${fileAName}`);
      pdf.addPage();
      addImageToPage(previewBHQ, `Document B: ${fileBName}`);
      pdf.save("comparison_result.pdf");
    } catch (error) {
      console.error("Error exporting PDF:", error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading comparison result...</p>
      </div>
    );
  }

  if (!comparisonResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No comparison data found. Please run a comparison first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-4 max-w-7xl">
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
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
                  <Button variant="outline" size="icon" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></Button>
                  <span className="text-sm w-16 text-center">{Math.round(zoomLevel * 100)}%</span>
                  <Button variant="outline" size="icon" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={handleZoomReset}><RotateCcw className="h-4 w-4" /></Button>
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

              {compareMode === "overlay" ? (
                <OverlayView comparisonResult={comparisonResult} zoomLevel={zoomLevel} />
              ) : (
                previewAHQ && previewBHQ && (
                  <PdfSliderCompare imageA={previewAHQ} imageB={previewBHQ} zoomLevel={zoomLevel} />
                )
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleExportPdf} disabled={exporting} className="bg-primary hover:bg-primary/90">
                  {exporting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />Export PDF</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CompareResult;
