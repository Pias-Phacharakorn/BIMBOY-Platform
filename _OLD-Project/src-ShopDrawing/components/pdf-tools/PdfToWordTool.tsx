import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileText, X, FileType, Download } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

const PdfToWordTool = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please select a PDF", variant: "destructive" });
      return;
    }
    setFile(f);
  }, [toast]);

  const convert = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    try {
      const ab = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      const paragraphs: Paragraph[] = [];

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        // Group items into lines by Y position (rounded)
        const lineMap = new Map<number, { x: number; str: string }[]>();
        for (const it of tc.items as any[]) {
          if (!it.str) continue;
          const y = Math.round(it.transform[5]);
          const x = it.transform[4];
          if (!lineMap.has(y)) lineMap.set(y, []);
          lineMap.get(y)!.push({ x, str: it.str });
        }
        const lines = Array.from(lineMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([, parts]) =>
            parts.sort((a, b) => a.x - b.x).map(pp => pp.str).join(" ").replace(/\s+/g, " ").trim()
          )
          .filter(Boolean);

        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun(`Page ${p}`)],
        }));
        for (const line of lines) {
          paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
        }
        paragraphs.push(new Paragraph({ children: [new TextRun("")] }));
        setProgress(Math.round((p / pdf.numPages) * 100));
      }

      const doc = new Document({
        styles: {
          default: { document: { run: { font: "Arial", size: 22 } } },
        },
        sections: [{ children: paragraphs }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.pdf$/i, "") + ".docx";
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Done", description: "Word file downloaded" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Conversion failed. PDF may be scanned — try OCR first.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const clear = () => { setFile(null); setProgress(0); };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {!file ? (
          <div
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">Drag and drop a PDF, or click to select</p>
            <input type="file" accept=".pdf" id="pdf2word-input" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <Button variant="outline" asChild>
              <label htmlFor="pdf2word-input" className="cursor-pointer">Select File</label>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Text-based PDFs only. Extracts text per page; layout is simplified.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clear} disabled={processing}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {processing && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-center">Converting... {progress}%</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={clear} disabled={processing}>Clear</Button>
              <Button onClick={convert} disabled={processing} className="bg-primary hover:bg-primary/90">
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Converting...</>
                  : <><Download className="h-4 w-4 mr-2" /> Convert to Word</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PdfToWordTool;
