import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clash, ClashStatus, ClashPriority, DISCIPLINES, STATUS_OPTIONS, PRIORITY_OPTIONS } from "./clashTypes";
import { Trash2, Upload, Maximize2, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  clash: Clash | null;
  projectId: string;
  canEdit: boolean;
  onSaved: () => void;
}

const ClashFormDialog = ({ open, onClose, clash, projectId, canEdit, onSaved }: Props) => {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<Clash>>({});
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [sectionUrl, setSectionUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  useEffect(() => {
    setForm(clash || { status: "Open" as ClashStatus, priority: "Medium" as ClashPriority, project_id: projectId });
    setFile(null);
    const sign = async (path: string | null | undefined, setter: (u: string | null) => void) => {
      if (!path) { setter(null); return; }
      const { data } = await supabase.storage.from("clash-thumbnails").createSignedUrl(path, 3600);
      setter(data?.signedUrl || null);
    };
    sign(clash?.thumbnail_url, setThumbUrl);
    sign(clash?.plan_view_url, setPlanUrl);
    sign(clash?.section_view_url, setSectionUrl);
  }, [clash, projectId, open]);

  const upd = (k: keyof Clash, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name?.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let thumbnail_path = form.thumbnail_url || null;
      if (file) {
        const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("clash-thumbnails").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        thumbnail_path = path;
      }

      const payload: any = {
        project_id: projectId,
        vp_key: form.vp_key || null,
        name: form.name,
        issue_type: form.issue_type || null,
        status: (form.status || "Open") as ClashStatus,
        priority: (form.priority || "Medium") as ClashPriority,
        discipline: form.discipline || null,
        level: form.level || null,
        zone: form.zone || null,
        phase: form.phase || null,
        originator: form.originator || null,
        element_id: form.element_id || null,
        author_email: form.author_email || null,
        due_date: form.due_date || null,
        description: form.description || null,
        folder: form.folder || null,
        markup: form.markup || null,
        solution: form.solution || null,
        thumbnail_url: thumbnail_path,
        created_by: clash?.created_by || user.id,
      };

      if (clash) {
        const { error } = await supabase.from("clash_viewpoints").update(payload).eq("id", clash.id);
        if (error) throw error;
        toast({ title: "Issue updated" });
      } else {
        const { error } = await supabase.from("clash_viewpoints").insert(payload);
        if (error) throw error;
        toast({ title: "Issue created" });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!clash) return;
    if (!confirm("Delete this issue?")) return;
    const { error } = await supabase.from("clash_viewpoints").delete().eq("id", clash.id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{clash ? "Edit Issue" : "New Issue"}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "View Point", url: file ? URL.createObjectURL(file) : thumbUrl },
              { label: "Plan View", url: planUrl },
              { label: "Section View", url: sectionUrl },
            ].map((img) => (
              <div key={img.label} className="space-y-1">
                <div className="text-xs text-muted-foreground">{img.label}</div>
                {img.url ? (
                  <button type="button" onClick={() => setLightbox({ url: img.url!, label: img.label })}
                    className="group relative w-full h-32 bg-muted rounded border overflow-hidden block">
                    <img src={img.url} alt={img.label} className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Maximize2 className="h-5 w-5 text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="w-full h-32 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">—</div>
                )}
              </div>
            ))}
          </div>
          {canEdit && (
            <div>
              <Label className="text-xs">Replace View Point Image</Label>
              <Input type="file" accept="image/*" className="mt-1" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status || "Open"} onValueChange={(v) => upd("status", v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority || "Medium"} onValueChange={(v) => upd("priority", v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Issue Name *</Label>
              <Input value={form.name || ""} onChange={(e) => upd("name", e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Input value={form.issue_type || ""} onChange={(e) => upd("issue_type", e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label className="text-xs">Discipline</Label>
              <Select value={form.discipline || ""} onValueChange={(v) => upd("discipline", v)} disabled={!canEdit}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Level</Label>
              <Input value={form.level || ""} onChange={(e) => upd("level", e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label className="text-xs">Zone</Label>
              <Input value={form.zone || ""} onChange={(e) => upd("zone", e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label className="text-xs">Phase</Label>
              <Input value={form.phase || ""} onChange={(e) => upd("phase", e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label className="text-xs">Element ID</Label>
              <Input value={form.element_id || ""} onChange={(e) => upd("element_id", e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label className="text-xs">Assigned To</Label>
              <Input value={form.originator || ""} onChange={(e) => upd("originator", e.target.value)} disabled={!canEdit} />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.due_date || ""} onChange={(e) => upd("due_date", e.target.value)} disabled={!canEdit} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Author</Label>
              <Input value={form.author_email || ""} onChange={(e) => upd("author_email", e.target.value)} disabled={!canEdit} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={form.description || ""} onChange={(e) => upd("description", e.target.value)} disabled={!canEdit} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Solution</Label>
              <Textarea rows={2} value={form.solution || ""} onChange={(e) => upd("solution", e.target.value)} disabled={!canEdit} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {clash && canEdit && (
            <Button variant="destructive" onClick={del} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {canEdit && <Button onClick={save} disabled={saving}><Upload className="h-4 w-4 mr-1" />{saving ? "Saving..." : "Save"}</Button>}
        </DialogFooter>
      </DialogContent>

      {lightbox && (
        <Dialog open onOpenChange={() => setLightbox(null)}>
          <DialogContent className="bg-white max-w-5xl p-2">
            <DialogHeader><DialogTitle className="px-2">{lightbox.label}</DialogTitle></DialogHeader>
            <button type="button" onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 rounded-full bg-background/80 p-1.5 hover:bg-background z-10" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <img src={lightbox.url} alt={lightbox.label} className="w-full max-h-[80vh] object-contain rounded" />
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};

export default ClashFormDialog;
