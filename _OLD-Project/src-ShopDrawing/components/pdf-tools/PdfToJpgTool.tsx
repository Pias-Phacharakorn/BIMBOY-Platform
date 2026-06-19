import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getPdfPageCount, renderPdfPageToCanvas } from "@/lib/pdfCompareUtils";
import { Upload, Download, Loader2, FileText, X, Image } from "lucide-react";
import JSZip from "jszip";

type Quality = "low" | "medium" | "high";

const qualityScales: Record<Quality, number> = {
  low: 1,
  medium: 1.5,
  high: 2,
};

const PdfToJpgTool = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [quality, setQuality] = useState<Quality>("medium");
  const [converting, setConverting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

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
      const count = await getPdfPageCount(arrayBuffer);
      setPageCount(count);
      setFile(selectedFile);
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
      const count = await getPdfPageCount(arrayBuffer);
      setPageCount(count);
      setFile(droppedFile);
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

  const handleConvert = async () => {
    if (!file) return;

    setConverting(true);
    setProgress(0);

    try {
      // Keep a stable source buffer, and pass a fresh copy to pdf.js per render.
      // pdf.js may transfer (detach) the provided ArrayBuffer when using a worker,
      // which breaks multi-page conversion if we reuse the same buffer.
      const baseBuffer = await file.arrayBuffer();
      const scale = qualityScales[quality];
      const baseName = file.name.replace(/\.pdf$/i, "");

      if (pageCount === 1) {
        // Single page - download directly as JPG
        setProgress(50);
        const canvas = await renderPdfPageToCanvas(baseBuffer.slice(0), 1, scale);
        
        // Convert canvas to blob for better compatibility
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to create blob"));
            },
            "image/jpeg",
            0.92
          );
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${baseName}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setProgress(100);
      } else {
        // Multiple pages - create ZIP
        const zip = new JSZip();
        
        for (let i = 1; i <= pageCount; i++) {
          const canvas = await renderPdfPageToCanvas(baseBuffer.slice(0), i, scale);
          
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else reject(new Error(`Failed to create blob for page ${i}`));
              },
              "image/jpeg",
              0.92
            );
          });
          
          zip.file(`${baseName}_page_${i}.jpg`, blob);
          setProgress(Math.round((i / pageCount) * 90));
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = `${baseName}_images.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setProgress(100);
      }

      toast({
        title: "Success",
        description: pageCount === 1 
          ? "Image downloaded successfully" 
          : `${pageCount} images converted and zipped`,
      });
    } catch (error) {
      console.error("Error converting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to convert PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
      setProgress(0);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPageCount(0);
    setProgress(0);
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
                id="convert-file-input"
                disabled={loading}
              />
              <Button variant="outline" asChild disabled={loading}>
                <label htmlFor="convert-file-input" className="cursor-pointer">
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
                  disabled={converting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Image Quality</Label>
                <Select
                  value={quality}
                  onValueChange={(val: Quality) => setQuality(val)}
                  disabled={converting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Fast)</SelectItem>
                    <SelectItem value="medium">Medium (Balanced)</SelectItem>
                    <SelectItem value="high">High (Best Quality)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {converting && progress > 0 && (
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Converting... {progress}%
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            {file && (
              <Button variant="outline" onClick={clearFile} disabled={converting}>
                Clear
              </Button>
            )}
            <Button
              onClick={handleConvert}
              disabled={!file || converting}
              className="bg-primary hover:bg-primary/90"
            >
              {converting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Image className="h-4 w-4 mr-2" />
                  Convert to JPG
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PdfToJpgTool;
