import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";
import { getPdfPageCount, renderPdfPageToCanvas } from "@/lib/pdfCompareUtils";
import { Upload, Loader2, FileText, X, Archive } from "lucide-react";

type Level = "low" | "medium" | "high";

const presets: Record<Level, { scale: number; quality: number; label: string }> = {
  low: { scale: 2, quality: 0.9, label: "Low compression (best quality)" },
  medium: { scale: 1.5, quality: 0.75, label: "Medium compression (balanced)" },
  high: { scale: 1, quality: 0.55, label: "High compression (smallest file)" },
};

const formatBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const CompressPdfTool = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [level, setLevel] = useState<Level>("medium");
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ blob: Blob; size: number } | null>(null);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please select a PDF", variant: "destructive" });
      return;
    }
    try {
      const ab = await f.arrayBuffer();
      setPageCount(await getPdfPageCount(ab));
      setFile(f);
      setResult(null);
    } catch {
      toast({ title: "Error", description: "Failed to load PDF", variant: "destructive" });
    }
  }, [toast]);

  const compress = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setResult(null);
    try {
      const base = await file.arrayBuffer();
      const { scale, quality } = presets[level];
      const out = await PDFDocument.create();

      for (let i = 1; i <= pageCount; i++) {
        const canvas = await renderPdfPageToCanvas(base.slice(0), i, scale);
        const blob: Blob = await new Promise((res, rej) =>
          canvas.toBlob(b => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", quality)
        );
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await out.embedJpg(bytes);
        const page = out.addPage([canvas.width, canvas.height]);
        page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        setProgress(Math.round((i / pageCount) * 95));
      }

      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      setResult({ blob, size: blob.size });
      setProgress(100);
      toast({ title: "Done", description: "PDF compressed successfully" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to compress PDF", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const download = () => {
    if (!result || !file) return;
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name.replace(/\.pdf$/i, "") + "_compressed.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  const clear = () => { setFile(null); setPageCount(0); setResult(null); setProgress(0); };

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
            <input type="file" accept=".pdf" id="compress-input" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <Button variant="outline" asChild>
              <label htmlFor="compress-input" className="cursor-pointer">Select File</label>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{pageCount} pages · {formatBytes(file.size)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clear} disabled={processing}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Compression level</Label>
              <Select value={level} onValueChange={(v: Level) => setLevel(v)} disabled={processing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(presets) as Level[]).map(k => (
                    <SelectItem key={k} value={k}>{presets[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Re-encodes each page as JPEG. Text becomes non-selectable.
              </p>
            </div>

            {processing && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-center">Compressing... {progress}%</p>
              </div>
            )}

            {result && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                <p>Original: <span className="font-mono">{formatBytes(file.size)}</span></p>
                <p>Compressed: <span className="font-mono">{formatBytes(result.size)}</span>
                  <span className="ml-2 text-primary font-medium">
                    ({Math.max(0, Math.round((1 - result.size / file.size) * 100))}% smaller)
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={clear} disabled={processing}>Clear</Button>
              {result ? (
                <Button onClick={download} className="bg-primary hover:bg-primary/90">
                  <Archive className="h-4 w-4 mr-2" /> Download
                </Button>
              ) : (
                <Button onClick={compress} disabled={processing} className="bg-primary hover:bg-primary/90">
                  {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Compressing...</>
                    : <><Archive className="h-4 w-4 mr-2" /> Compress</>}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompressPdfTool;
