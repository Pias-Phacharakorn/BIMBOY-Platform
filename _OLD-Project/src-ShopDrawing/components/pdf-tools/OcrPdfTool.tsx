import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getPdfPageCount, renderPdfPageToCanvas } from "@/lib/pdfCompareUtils";
import { Upload, Loader2, FileText, X, ScanText, Download } from "lucide-react";

type Lang = "eng" | "tha" | "tha+eng";

const OcrPdfTool = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [lang, setLang] = useState<Lang>("tha+eng");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [resultText, setResultText] = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please select a PDF", variant: "destructive" });
      return;
    }
    try {
      const ab = await f.arrayBuffer();
      setPageCount(await getPdfPageCount(ab));
      setFile(f);
      setResultText(null);
    } catch {
      toast({ title: "Error", description: "Failed to load PDF", variant: "destructive" });
    }
  }, [toast]);

  const runOcr = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setResultText(null);
    setStatus("Loading OCR engine...");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(lang, 1, {
        logger: (m: any) => {
          if (m.status) setStatus(m.status);
        },
      });

      const base = await file.arrayBuffer();
      const parts: string[] = [];

      for (let i = 1; i <= pageCount; i++) {
        setStatus(`Recognizing page ${i} of ${pageCount}...`);
        const canvas = await renderPdfPageToCanvas(base.slice(0), i, 2);
        const { data } = await worker.recognize(canvas);
        parts.push(`===== Page ${i} =====\n${data.text.trim()}\n`);
        setProgress(Math.round((i / pageCount) * 100));
      }

      await worker.terminate();
      setResultText(parts.join("\n"));
      setStatus("Done");
      toast({ title: "Done", description: `Extracted text from ${pageCount} pages` });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "OCR failed. Try a smaller file.", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const downloadTxt = () => {
    if (!resultText || !file) return;
    const blob = new Blob([resultText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name.replace(/\.pdf$/i, "") + "_ocr.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!resultText) return;
    await navigator.clipboard.writeText(resultText);
    toast({ title: "Copied", description: "Text copied to clipboard" });
  };

  const clear = () => { setFile(null); setPageCount(0); setResultText(null); setProgress(0); setStatus(""); };

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
            <p className="text-sm text-muted-foreground mb-2">Drag and drop a scanned PDF, or click to select</p>
            <input type="file" accept=".pdf" id="ocr-input" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <Button variant="outline" asChild>
              <label htmlFor="ocr-input" className="cursor-pointer">Select File</label>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Recommended: under 20 pages</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{pageCount} pages</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clear} disabled={processing}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select value={lang} onValueChange={(v: Lang) => setLang(v)} disabled={processing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tha+eng">Thai + English</SelectItem>
                  <SelectItem value="tha">Thai (ไทย)</SelectItem>
                  <SelectItem value="eng">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {processing && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-center">{status} ({progress}%)</p>
              </div>
            )}

            {resultText && (
              <div className="space-y-2">
                <Label>Extracted text</Label>
                <textarea
                  readOnly
                  value={resultText}
                  className="w-full h-64 p-3 text-xs font-mono border rounded-md bg-muted/30 resize-y"
                />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>Copy</Button>
                  <Button variant="outline" size="sm" onClick={downloadTxt}>
                    <Download className="h-3 w-3 mr-1" /> Download .txt
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={clear} disabled={processing}>Clear</Button>
              <Button onClick={runOcr} disabled={processing} className="bg-primary hover:bg-primary/90">
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running OCR...</>
                  : <><ScanText className="h-4 w-4 mr-2" /> Run OCR</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OcrPdfTool;
