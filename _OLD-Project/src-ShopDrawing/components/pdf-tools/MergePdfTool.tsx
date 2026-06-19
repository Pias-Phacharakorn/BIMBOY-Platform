import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";
import { Upload, X, GripVertical, Download, Loader2, FileText } from "lucide-react";

interface PdfFile {
  id: string;
  file: File;
  name: string;
}

const MergePdfTool = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [merging, setMerging] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter(f => f.type === "application/pdf");
    
    if (pdfFiles.length !== selectedFiles.length) {
      toast({
        title: "Invalid files",
        description: "Only PDF files are allowed",
        variant: "destructive",
      });
    }

    const newFiles = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFiles = droppedFiles.filter(f => f.type === "application/pdf");
    
    if (pdfFiles.length !== droppedFiles.length) {
      toast({
        title: "Invalid files",
        description: "Only PDF files are allowed",
        variant: "destructive",
      });
    }

    const newFiles = pdfFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
    }));

    setFiles(prev => [...prev, ...newFiles]);
  }, [toast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleReorder = (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;
    
    setFiles(prev => {
      const newFiles = [...prev];
      const [removed] = newFiles.splice(dragIndex, 1);
      newFiles.splice(dropIndex, 0, removed);
      return newFiles;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: "Not enough files",
        description: "Please add at least 2 PDF files to merge",
        variant: "destructive",
      });
      return;
    }

    setMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of files) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = "merged.pdf";
      link.click();
      
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDFs merged successfully",
      });

      setFiles([]);
    } catch (error) {
      console.error("Error merging PDFs:", error);
      toast({
        title: "Error",
        description: "Failed to merge PDFs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop PDF files here, or click to select
            </p>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="merge-file-input"
            />
            <Button variant="outline" asChild>
              <label htmlFor="merge-file-input" className="cursor-pointer">
                Select Files
              </label>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Maximum 50MB per file
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={() => setDraggedId(file.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedId && draggedId !== file.id) {
                        const dragIndex = files.findIndex(f => f.id === draggedId);
                        handleReorder(dragIndex, index);
                      }
                    }}
                    className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg ${
                      draggedId === file.id ? "opacity-50" : ""
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 text-sm truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            {files.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setFiles([])}
                disabled={merging}
              >
                Clear All
              </Button>
            )}
            <Button
              onClick={handleMerge}
              disabled={files.length < 2 || merging}
              className="bg-primary hover:bg-primary/90"
            >
              {merging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Merge & Download
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MergePdfTool;
