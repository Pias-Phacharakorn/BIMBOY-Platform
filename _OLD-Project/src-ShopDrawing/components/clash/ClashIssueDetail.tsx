import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, ChevronLeft, ChevronRight, X, MessageSquare, Paperclip, History, Send, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clash, ClashComment, ClashHistoryEntry, STATUS_COLORS, PRIORITY_COLORS, issueLabel } from "./clashTypes";

interface Props {
  clash: Clash | null;
  open: boolean;
  onClose: () => void;
  onEdit: (c: Clash) => void;
  onNavigate: (dir: -1 | 1) => void;
  canEdit: boolean;
}

const SignedImg = ({ path, alt, className }: { path: string | null; alt: string; className?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    supabase.storage.from("clash-thumbnails").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl || null);
    });
    return () => { cancelled = true; };
  }, [path]);
  if (!path) return <div className={`bg-muted flex items-center justify-center text-xs text-muted-foreground ${className}`}>No image</div>;
  if (!url) return <div className={`bg-muted animate-pulse ${className}`} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt={alt} className={className} />
    </a>
  );
};

const fieldRow = (label: string, value: React.ReactNode) => (
  <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
    <div className="opacity-80">{label}</div>
    <div className="font-medium">{value || "—"}</div>
  </div>
);

const ClashIssueDetail = ({ clash, open, onClose, onEdit, onNavigate, canEdit }: Props) => {
  const { toast } = useToast();
  const [comments, setComments] = useState<ClashComment[]>([]);
  const [history, setHistory] = useState<ClashHistoryEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState("comment");

  useEffect(() => {
    if (!clash) { setComments([]); setHistory([]); return; }
    const load = async () => {
      const [c, h] = await Promise.all([
        supabase.from("clash_comments").select("*").eq("viewpoint_id", clash.id).order("created_at"),
        supabase.from("clash_history").select("*").eq("viewpoint_id", clash.id).order("created_at", { ascending: false }),
      ]);
      setComments((c.data as ClashComment[]) || []);
      setHistory((h.data as ClashHistoryEntry[]) || []);
      const ids = new Set<string>();
      (c.data || []).forEach((x: any) => x.author_id && ids.add(x.author_id));
      (h.data || []).forEach((x: any) => x.actor_id && ids.add(x.actor_id));
      if (ids.size) {
        const { data: p } = await supabase.from("profiles").select("id, first_name, last_name").in("id", Array.from(ids));
        const m: Record<string, string> = {};
        (p || []).forEach((u: any) => { m[u.id] = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "User"; });
        setProfiles(m);
      }
    };
    load();

    const ch = supabase
      .channel(`clash-detail-${clash.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clash_comments", filter: `viewpoint_id=eq.${clash.id}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clash_history", filter: `viewpoint_id=eq.${clash.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clash]);

  const addComment = async () => {
    if (!clash || !draft.trim()) return;
    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("clash_comments").insert({
        viewpoint_id: clash.id, project_id: clash.project_id, author_id: user.id, body: draft.trim(),
      });
      if (error) throw error;
      setDraft("");
    } catch (e: any) {
      toast({ title: "Failed to post comment", description: e.message, variant: "destructive" });
    } finally { setPosting(false); }
  };

  const headerColor = useMemo(() => clash ? STATUS_COLORS[clash.status] : "#1D4ED8", [clash]);

  if (!clash) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-white max-w-6xl max-h-[92vh] overflow-y-auto p-0">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNavigate(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button size="sm" onClick={() => onEdit(clash)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-0">
          {/* Left — issue card */}
          <div className="text-white p-4 space-y-3" style={{ backgroundColor: headerColor }}>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold">{issueLabel(clash)}</div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/95" style={{ color: headerColor }}>{clash.status}</span>
            </div>
            <div className="text-lg font-semibold leading-snug">{clash.name}</div>

            <Tabs defaultValue="vp">
              <TabsList className="bg-white/15">
                <TabsTrigger value="vp" className="data-[state=active]:bg-white data-[state=active]:text-foreground">Viewpoint</TabsTrigger>
                <TabsTrigger value="plan" className="data-[state=active]:bg-white data-[state=active]:text-foreground">Plan</TabsTrigger>
                <TabsTrigger value="section" className="data-[state=active]:bg-white data-[state=active]:text-foreground">Section</TabsTrigger>
              </TabsList>
              <TabsContent value="vp"><SignedImg path={clash.thumbnail_url} alt="Viewpoint" className="w-full h-64 object-contain bg-black/20 rounded" /></TabsContent>
              <TabsContent value="plan"><SignedImg path={clash.plan_view_url} alt="Plan view" className="w-full h-64 object-contain bg-black/20 rounded" /></TabsContent>
              <TabsContent value="section"><SignedImg path={clash.section_view_url} alt="Section view" className="w-full h-64 object-contain bg-black/20 rounded" /></TabsContent>
            </Tabs>

            <div className="space-y-2 pt-2 border-t border-white/20">
              {fieldRow("Type", clash.issue_type)}
              {fieldRow("Priority", <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: PRIORITY_COLORS[clash.priority] }}>{clash.priority}</span>)}
              {fieldRow("Discipline", clash.discipline)}
              {fieldRow("Zone", clash.zone)}
              {fieldRow("Level", clash.level)}
              {fieldRow("Phase", clash.phase)}
              {fieldRow("Element ID", clash.element_id)}
              {fieldRow("Assigned to", clash.originator)}
              {fieldRow("Due date", clash.due_date)}
              {fieldRow("Created", new Date(clash.created_at).toLocaleString())}
              {fieldRow("Author", clash.author_email)}
            </div>
          </div>

          {/* Right — tabs */}
          <div className="p-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="comment"><MessageSquare className="h-3.5 w-3.5 mr-1" /> Comment</TabsTrigger>
                <TabsTrigger value="attachment"><Paperclip className="h-3.5 w-3.5 mr-1" /> Attachment</TabsTrigger>
                <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" /> History</TabsTrigger>
              </TabsList>

              <TabsContent value="comment" className="space-y-3">
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {comments.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No comments yet</div>}
                  {comments.map((c) => (
                    <div key={c.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">{profiles[c.author_id] || "User"}</span>
                        <span>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Add a comment…" />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={addComment} disabled={posting || !draft.trim()}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Post
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attachment" className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Viewpoint", path: clash.thumbnail_url },
                    { label: "Plan view", path: clash.plan_view_url },
                    { label: "Section view", path: clash.section_view_url },
                  ].map((a) => (
                    <div key={a.label} className="border rounded-lg p-2 space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">{a.label}</div>
                      <SignedImg path={a.path} alt={a.label} className="w-full h-32 object-contain bg-muted rounded" />
                    </div>
                  ))}
                </div>
                {clash.description && <div><div className="text-xs font-semibold text-muted-foreground mb-1">DESCRIPTION</div><p className="text-sm whitespace-pre-wrap">{clash.description}</p></div>}
                {clash.markup && <div><div className="text-xs font-semibold text-muted-foreground mb-1">MARKUP</div><p className="text-sm whitespace-pre-wrap">{clash.markup}</p></div>}
                {clash.solution && <div><div className="text-xs font-semibold text-muted-foreground mb-1">SOLUTION</div><p className="text-sm whitespace-pre-wrap">{clash.solution}</p></div>}
              </TabsContent>

              <TabsContent value="history">
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {history.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No history yet</div>}
                  {history.map((h) => (
                    <div key={h.id} className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-semibold">
                        {(profiles[h.actor_id || ""] || "·").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium">{profiles[h.actor_id || ""] || "System"}</span>{" "}
                          <span className="text-muted-foreground">{actionLabel(h)}</span>
                        </div>
                        {h.details && Object.keys(h.details).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">{detailLabel(h.details)}</div>
                        )}
                        <div className="text-xs text-muted-foreground/70 mt-0.5">{new Date(h.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const actionLabel = (h: ClashHistoryEntry) => {
  switch (h.action) {
    case "created": return "created issue";
    case "updated": return "updated issue";
    case "commented": return "added a comment";
    case "api_sync": return "synced from Navisworks";
    default: return h.action;
  }
};

const detailLabel = (d: any): string => {
  if (d.preview) return `"${d.preview}"`;
  const parts: string[] = [];
  for (const k of Object.keys(d)) {
    const v = d[k];
    if (v && typeof v === "object" && "from" in v) parts.push(`${k}: ${v.from ?? "—"} → ${v.to ?? "—"}`);
  }
  return parts.join("  ·  ");
};

export default ClashIssueDetail;
