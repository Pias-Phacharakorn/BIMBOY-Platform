import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";
import { Upload, Download, Loader2, FileText, X } from "lucide-react";

type RangeMode = "custom" | "individual";

const SplitPdfTool = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [pageRange, setPageRange] = useState("");
  const [rangeMode, setRangeMode] = useState<RangeMode>("custom");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [splitting, setSplitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      toast({
        title: "Invalid file",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageCount(pdf.getPageCount());
      setFile(selectedFile);
      setPageRange(`1-${pdf.getPageCount()}`);
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

    e.target.value = "";
  }, [toast]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (droppedFile.type !== "application/pdf") {
      toast({
        title: "Invalid file",
        description: "Please drop a PDF file",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const arrayBuffer = await droppedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageCount(pdf.getPageCount());
      setFile(droppedFile);
      setPageRange(`1-${pdf.getPageCount()}`);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const parsePageRange = (range: string, maxPages: number): number[] => {
    const pages: Set<number> = new Set();
    const parts = range.split(",").map(p => p.trim());

    for (const part of parts) {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
            pages.add(i);
          }
        }
      } else {
        const page = parseInt(part);
        if (!isNaN(page) && page >= 1 && page <= maxPages) {
          pages.add(page);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleSplit = async () => {
    if (!file) return;

    const pages = rangeMode === "custom" 
      ? parsePageRange(pageRange, pageCount)
      : Array.from(selectedPages).sort((a, b) => a - b);
      
    if (pages.length === 0) {
      toast({
        title: "No pages selected",
        description: rangeMode === "custom" 
          ? "Please enter a valid page range" 
          : "Please select at least one page",
        variant: "destructive",
      });
      return;
    }

    setSplitting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();

      const copiedPages = await newPdf.copyPages(
        sourcePdf,
        pages.map(p => p - 1) // Convert to 0-indexed
      );
      copiedPages.forEach(page => newPdf.addPage(page));

      const newBytes = await newPdf.save();
      const blob = new Blob([new Uint8Array(newBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      const baseName = file.name.replace(".pdf", "");
      link.download = `${baseName}_pages_${pages.join("-")}.pdf`;
      link.click();

      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Extracted ${pages.length} page${pages.length > 1 ? "s" : ""}`,
      });
    } catch (error) {
      console.error("Error splitting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to split PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSplitting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPageCount(0);
    setPageRange("");
    setSelectedPages(new Set());
  };

  const togglePage = (page: number) => {
    setSelectedPages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(page)) {
        newSet.delete(page);
      } else {
        newSet.add(page);
      }
      return newSet;
    });
  };

  const selectAllPages = () => {
    const allPages = new Set(Array.from({ length: pageCount }, (_, i) => i + 1));
    setSelectedPages(allPages);
  };

  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  const getSelectedPagesArray = (): number[] => {
    if (rangeMode === "custom") {
      return parsePageRange(pageRange, pageCount);
    }
    return Array.from(selectedPages).sort((a, b) => a - b);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            >
              {loading ? (
                <Loader2 className="h-10 w-10 mx-auto text-muted-foreground mb-4 animate-spin" />
              ) : (
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              )}
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop a PDF file here, or click to select
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="split-file-input"
                disabled={loading}
              />
              <Button variant="outline" asChild disabled={loading}>
                <label htmlFor="split-file-input" className="cursor-pointer">
                  Select File
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Maximum 50MB per file
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{pageCount} pages</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={clearFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Range Mode</Label>
                <Select
                  value={rangeMode}
                  onValueChange={(val: RangeMode) => setRangeMode(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Range (1-3, 5, 7-10)</SelectItem>
                    <SelectItem value="individual">Individual Pages (1, 2, 3, 4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rangeMode === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor="page-range">Page Range</Label>
                  <Input
                    id="page-range"
                    placeholder="e.g., 1-3, 5, 7-10"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter page numbers or ranges separated by commas (e.g., 1-3, 5, 7-10)
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Pages</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllPages}
                        className="text-xs h-7"
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={deselectAllPages}
                        className="text-xs h-7"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                      <label
                        key={page}
                        className={`flex items-center justify-center p-2 rounded cursor-pointer border transition-colors text-sm ${
                          selectedPages.has(page)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 hover:bg-muted border-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPages.has(page)}
                          onChange={() => togglePage(page)}
                          className="sr-only"
                        />
                        {page}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedPages.size} of {pageCount} pages selected
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            {file && (
              <Button variant="outline" onClick={clearFile} disabled={splitting}>
                Clear
              </Button>
            )}
            <Button
              onClick={handleSplit}
              disabled={!file || (rangeMode === "custom" ? !pageRange.trim() : selectedPages.size === 0) || splitting}
              className="bg-primary hover:bg-primary/90"
            >
              {splitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Splitting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Split & Download
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SplitPdfTool;
