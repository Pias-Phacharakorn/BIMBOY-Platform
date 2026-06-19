import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseClashHtml, dataUrlToBlob, ParsedClash } from "@/lib/clashImport";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onImported: () => void;
}

type RowStatus = "pending" | "running" | "ok" | "error";

const ClashImportDialog = ({ open, onClose, projectId, onImported }: Props) => {
  const { toast } = useToast();
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ rows: ParsedClash[]; required: Set<string>; format: "legacy" | "new" } | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });
  const [rowStatuses, setRowStatuses] = useState<{ name: string; status: RowStatus; error?: string }[]>([]);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const imageMap = useMemo(() => {
    const m = new Map<string, File>();
    for (const f of imageFiles) m.set(f.name, f);
    return m;
  }, [imageFiles]);

  const matchedCount = useMemo(() => {
    if (!preview) return 0;
    let n = 0;
    preview.required.forEach((name) => { if (imageMap.has(name)) n++; });
    return n;
  }, [preview, imageMap]);

  const handleHtml = async (f: File | null) => {
    setHtmlFile(f);
    setPreview(null);
    if (!f) return;
    try {
      const html = await f.text();
      const r = parseClashHtml(html);
      setPreview({ rows: r.rows, required: r.requiredImages, format: r.format });
    } catch (e: any) {
      toast({ title: "Failed to parse HTML", description: e.message, variant: "destructive" });
    }
  };

  const clearHtml = () => {
    setHtmlFile(null);
    setPreview(null);
    if (htmlInputRef.current) htmlInputRef.current.value = "";
  };

  const clearImages = () => {
    setImageFiles([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const reset = () => {
    clearHtml();
    clearImages();
    setProgress({ done: 0, total: 0, ok: 0, fail: 0 });
    setRowStatuses([]);
  };

  const uploadImage = async (file: Blob, vpKey: string, kind: string): Promise<string | null> => {
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${projectId}/${Date.now()}-${vpKey}-${kind}.${ext}`;
    const { error } = await supabase.storage.from("clash-thumbnails").upload(path, file, { contentType: file.type, upsert: false });
    return error ? null : path;
  };

  const run = async () => {
    if (!preview || preview.rows.length === 0) return;
    setBusy(true);
    const total = preview.rows.length;
    setProgress({ done: 0, total, ok: 0, fail: 0 });
    setRowStatuses(preview.rows.map((r) => ({ name: r.name, status: "pending" as RowStatus })));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("profiles").select("first_name,last_name").eq("id", user.id).maybeSingle();
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
        || (user.email || "").split("@")[0]
        || "user";

      let ok = 0;
      let fail = 0;
      for (let i = 0; i < preview.rows.length; i++) {
        const r = preview.rows[i];
        setRowStatuses((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "running" } : s));
        const vpKey = r.vp_key || String(i + 1).padStart(4, "0");

        let thumbnail_url: string | null = null;
        let plan_view_url: string | null = null;
        let section_view_url: string | null = null;

        if (preview.format === "legacy" && r.thumbnailDataUrl) {
          const blob = dataUrlToBlob(r.thumbnailDataUrl);
          if (blob) thumbnail_url = await uploadImage(blob, vpKey, "vp");
        } else {
          if (r.viewPointImg && imageMap.has(r.viewPointImg)) {
            thumbnail_url = await uploadImage(imageMap.get(r.viewPointImg)!, vpKey, "vp");
          }
          if (r.planViewImg && imageMap.has(r.planViewImg)) {
            plan_view_url = await uploadImage(imageMap.get(r.planViewImg)!, vpKey, "pl");
          }
          if (r.sectionViewImg && imageMap.has(r.sectionViewImg)) {
            section_view_url = await uploadImage(imageMap.get(r.sectionViewImg)!, vpKey, "se");
          }
        }

        const { error } = await supabase.from("clash_viewpoints").upsert({
          project_id: projectId,
          vp_key: vpKey,
          name: r.name,
          issue_type: r.issue_type,
          status: r.status,
          discipline: r.discipline,
          level: r.level,
          zone: r.zone,
          originator: null,
          element_id: r.originator || null,
          due_date: r.due_date,
          folder: r.folder ?? null,
          markup: r.markup ?? null,
          solution: r.solution ?? null,
          thumbnail_url,
          plan_view_url,
          section_view_url,
          author_email: fullName,
          created_by: user.id,
        }, { onConflict: "project_id,vp_key", ignoreDuplicates: false });

        if (!error) {
          ok++;
          setRowStatuses((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "ok" } : s));
        } else {
          fail++;
          setRowStatuses((prev) => prev.map((s, idx) => idx === i ? { ...s, status: "error", error: error.message } : s));
        }
        setProgress({ done: i + 1, total, ok, fail });
      }

      toast({ title: `Imported ${ok}/${total} clashes`, description: fail > 0 ? `${fail} failed` : undefined });
      onImported();
      if (fail === 0) {
        reset();
        onClose();
      }
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) { reset(); onClose(); } }}>
      <DialogContent className="bg-white w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Import Clash Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload the report HTML. Existing viewpoints (matched by VP key) will be updated.
          </p>

          <div className="bg-muted/30 rounded-lg border border-dashed border-border p-4 space-y-2">
            <Label className="text-xs">HTML file *</Label>
            <input
              ref={htmlInputRef}
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={(e) => handleHtml(e.target.files?.[0] || null)}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => htmlInputRef.current?.click()}
                disabled={busy}
              >
                <Upload className="w-4 h-4 mr-2" />
                {htmlFile ? htmlFile.name : "Choose HTML file"}
              </Button>
              {htmlFile && !busy && (
                <Button variant="ghost" size="sm" className="rounded-full" onClick={clearHtml}>
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg border border-dashed border-border p-4 space-y-2">
            <Label className="text-xs">
              Image files {preview?.format === "new" ? "(select all JPGs)" : "(optional — only needed for reports that reference external images)"}
            </Label>
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => imageInputRef.current?.click()}
                disabled={busy}
              >
                <Upload className="w-4 h-4 mr-2" />
                {imageFiles.length > 0 ? `${imageFiles.length} image(s) selected` : "Choose image files"}
              </Button>
              {imageFiles.length > 0 && !busy && (
                <Button variant="ghost" size="sm" className="rounded-full" onClick={clearImages}>
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
            {preview?.format === "new" && (
              <p className="text-xs text-muted-foreground mt-1">
                {preview.required.size > 0
                  ? `${matchedCount}/${preview.required.size} expected images matched`
                  : "No external images referenced"}
              </p>
            )}
          </div>

          {preview && !busy && progress.total === 0 && (
            <div className="rounded border bg-muted/40 p-3 text-sm space-y-1">
              <div>Format: <span className="font-mono">{preview.format}</span></div>
              <div>Viewpoints: <span className="font-semibold">{preview.rows.length}</span></div>
              {preview.format === "new" && preview.required.size > 0 && matchedCount < preview.required.size && (
                <div className="text-amber-600 text-xs">
                  {preview.required.size - matchedCount} image(s) not provided — those rows will import without thumbnails.
                </div>
              )}
            </div>
          )}

          {progress.total > 0 && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {busy ? "Importing…" : "Import complete"} {progress.done}/{progress.total}
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="text-green-600 font-semibold">{progress.ok} ok</span>
                  {progress.fail > 0 && <span className="text-destructive font-semibold ml-2">{progress.fail} failed</span>}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
              <div className="max-h-40 overflow-y-auto space-y-1 text-xs mt-2">
                {rowStatuses.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    {s.status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                    {s.status === "error" && <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                    {s.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
                    {s.status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0" />}
                    <span className={`truncate min-w-0 flex-1 ${s.status === "error" ? "text-destructive" : ""}`}>
                      {s.name}{s.error ? ` — ${s.error}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={busy}>
            {progress.total > 0 && !busy ? "Close" : "Cancel"}
          </Button>
          <Button onClick={run} disabled={!preview || preview.rows.length === 0 || busy}>
            {busy ? "Importing…" : `Import ${preview?.rows.length || 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClashImportDialog;
