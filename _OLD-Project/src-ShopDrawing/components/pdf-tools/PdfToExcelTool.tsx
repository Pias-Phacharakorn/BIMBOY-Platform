import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileText, X, Download, Sheet } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";

type Item = { x: number; y: number; w: number; str: string };

/** Cluster numeric values into groups within tolerance; return sorted cluster centers. */
function cluster(values: number[], tol: number): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = groups[groups.length - 1];
    if (sorted[i] - last[last.length - 1] <= tol) last.push(sorted[i]);
    else groups.push([sorted[i]]);
  }
  return groups.map(g => g.reduce((s, v) => s + v, 0) / g.length);
}

function nearestIdx(centers: number[], v: number): number {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const d = Math.abs(centers[i] - v);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
}

/** Extract a 2D grid from a page's items using x/y clustering. */
function extractGrid(items: Item[]): string[][] {
  if (!items.length) return [];
  // Cluster rows by Y (tolerance ~ small)
  const yCenters = cluster(items.map(i => i.y), 3);
  // Cluster cols by X (larger tolerance for column gaps)
  const xCenters = cluster(items.map(i => i.x), 8);

  // Sort: top-down (PDF y grows upward) and left-right
  const ySorted = [...yCenters].sort((a, b) => b - a);
  const xSorted = [...xCenters].sort((a, b) => a - b);

  const grid: string[][] = ySorted.map(() => xSorted.map(() => ""));
  for (const it of items) {
    const r = nearestIdx(ySorted, it.y);
    const c = nearestIdx(xSorted, it.x);
    grid[r][c] = (grid[r][c] ? grid[r][c] + " " : "") + it.str;
  }
  // Trim each cell, drop fully empty rows
  return grid
    .map(row => row.map(c => c.replace(/\s+/g, " ").trim()))
    .filter(row => row.some(c => c.length > 0));
}

const PdfToExcelTool = () => {
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
      const wb = XLSX.utils.book_new();

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const items: Item[] = (tc.items as any[])
          .filter(it => it.str && it.str.trim())
          .map(it => ({
            x: it.transform[4],
            y: it.transform[5],
            w: it.width ?? 0,
            str: it.str.trim(),
          }));
        const grid = extractGrid(items);
        const ws = XLSX.utils.aoa_to_sheet(grid.length ? grid : [[""]]);
        XLSX.utils.book_append_sheet(wb, ws, `Page ${p}`.slice(0, 31));
        setProgress(Math.round((p / pdf.numPages) * 100));
      }

      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.pdf$/i, "") + ".xlsx";
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Done", description: "Excel file downloaded" });
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
            <input type="file" accept=".pdf" id="pdf2xlsx-input" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <Button variant="outline" asChild>
              <label htmlFor="pdf2xlsx-input" className="cursor-pointer">Select File</label>
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Best for text-based PDFs with table-like layouts. Each page becomes a worksheet.
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
                <p className="text-xs text-muted-foreground text-center">Extracting tables... {progress}%</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={clear} disabled={processing}>Clear</Button>
              <Button onClick={convert} disabled={processing} className="bg-primary hover:bg-primary/90">
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Converting...</>
                  : <><Sheet className="h-4 w-4 mr-2" /> Convert to Excel</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PdfToExcelTool;
