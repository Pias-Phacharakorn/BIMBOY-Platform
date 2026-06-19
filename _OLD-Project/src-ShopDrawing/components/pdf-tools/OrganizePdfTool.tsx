import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { PDFDocument, degrees } from "pdf-lib";
import { getPdfPageCount, renderPdfPageToCanvas } from "@/lib/pdfCompareUtils";
import { Upload, Loader2, FileText, X, RotateCw, Trash2, Download, GripVertical } from "lucide-react";

type PageItem = {
  id: string;
  originalIndex: number; // 0-based
  rotation: number; // accumulated rotation in degrees, multiples of 90
  thumb: string;
};

const OrganizePdfTool = () => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    return () => { pages.forEach(p => URL.revokeObjectURL(p.thumb)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please select a PDF", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const base = await f.arrayBuffer();
      const count = await getPdfPageCount(base);
      const items: PageItem[] = [];
      for (let i = 1; i <= count; i++) {
        const canvas = await renderPdfPageToCanvas(base.slice(0), i, 0.4);
        const blob: Blob = await new Promise((res, rej) =>
          canvas.toBlob(b => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.7)
        );
        items.push({
          id: `p-${i}-${Math.random().toString(36).slice(2, 8)}`,
          originalIndex: i - 1,
          rotation: 0,
          thumb: URL.createObjectURL(blob),
        });
      }
      setPages(items);
      setFile(f);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load PDF", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const rotate = (id: string) =>
    setPages(p => p.map(x => x.id === id ? { ...x, rotation: (x.rotation + 90) % 360 } : x));
  const remove = (id: string) =>
    setPages(p => {
      const t = p.find(x => x.id === id); if (t) URL.revokeObjectURL(t.thumb);
      return p.filter(x => x.id !== id);
    });

  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setPages(p => {
      const from = p.findIndex(x => x.id === dragId);
      const to = p.findIndex(x => x.id === targetId);
      if (from < 0 || to < 0) return p;
      const next = [...p];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  };

  const save = async () => {
    if (!file || pages.length === 0) return;
    setProcessing(true);
    try {
      const base = await file.arrayBuffer();
      const src = await PDFDocument.load(base);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map(p => p.originalIndex));
      for (let i = 0; i < copied.length; i++) {
        const page = copied[i];
        if (pages[i].rotation) {
          const current = page.getRotation().angle;
          page.setRotation(degrees((current + pages[i].rotation) % 360));
        }
        out.addPage(page);
      }
      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.pdf$/i, "") + "_organized.pdf";
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Done", description: "Organized PDF downloaded" });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to save PDF", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const clear = () => {
    pages.forEach(p => URL.revokeObjectURL(p.thumb));
    setPages([]); setFile(null);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {!file ? (
          <div
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
          >
            {loading ? <Loader2 className="h-10 w-10 mx-auto text-muted-foreground mb-4 animate-spin" />
              : <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />}
            <p className="text-sm text-muted-foreground mb-2">Drag and drop a PDF, or click to select</p>
            <input type="file" accept=".pdf" id="organize-input" className="hidden" disabled={loading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <Button variant="outline" asChild disabled={loading}>
              <label htmlFor="organize-input" className="cursor-pointer">Select File</label>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{pages.length} pages · drag to reorder</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clear} disabled={processing}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto p-1">
              {pages.map((p, idx) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => onDragStart(p.id)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(p.id)}
                  className={`group relative border rounded-lg p-2 bg-card hover:border-primary cursor-move transition-colors ${dragId === p.id ? "opacity-50" : ""}`}
                >
                  <div className="aspect-[3/4] bg-muted rounded overflow-hidden flex items-center justify-center">
                    <img
                      src={p.thumb}
                      alt={`Page ${idx + 1}`}
                      className="max-w-full max-h-full object-contain transition-transform"
                      style={{ transform: `rotate(${p.rotation}deg)` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <GripVertical className="h-3 w-3" /> {idx + 1}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => rotate(p.id)} title="Rotate">
                        <RotateCw className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => remove(p.id)} title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={clear} disabled={processing}>Clear</Button>
              <Button onClick={save} disabled={processing || pages.length === 0} className="bg-primary hover:bg-primary/90">
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  : <><Download className="h-4 w-4 mr-2" /> Save PDF</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OrganizePdfTool;
