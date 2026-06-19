import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clash, STATUS_COLORS, PRIORITY_COLORS, issueLabel, isOverdue } from "./clashTypes";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

const toDMY = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const ThumbBg = ({ path }: { path: string | null }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    supabase.storage.from("clash-thumbnails").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl || null);
    });
    return () => { cancelled = true; };
  }, [path]);
  if (!path) {
    return (
      <div className="absolute inset-0 bg-muted flex items-center justify-center">
        <ImageOff className="h-10 w-10 text-muted-foreground/40" />
      </div>
    );
  }
  if (!url) return <div className="absolute inset-0 bg-muted animate-pulse" />;
  return <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />;
};

interface Props {
  clashes: Clash[];
  onCardClick: (c: Clash) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const ClashTileGrid = ({ clashes, onCardClick, selectedIds, onToggleSelect }: Props) => {
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = new Set<string>();
    clashes.forEach((c) => {
      if (c.assigned_to) ids.add(c.assigned_to);
      if (c.created_by) ids.add(c.created_by);
    });
    if (ids.size === 0) { setNames({}); return; }
    supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(ids))
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((p: any) => {
          map[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—";
        });
        setNames(map);
      });
  }, [clashes]);
  if (clashes.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
        No issues match the current filters.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {clashes.map((c) => {
        const overdue = isOverdue(c);
        const isSelected = !!selectedIds?.has(c.id);
        return (
          <div
            key={c.id}
            onClick={() => onCardClick(c)}
            className={cn(
              "group relative bg-card border rounded-lg overflow-hidden text-left transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
              overdue && "ring-2 ring-destructive/50",
              isSelected && "ring-2 ring-primary"
            )}
          >
            {onToggleSelect && (
              <div
                className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white/90 rounded p-1 shadow"
                onClick={(e) => { e.stopPropagation(); onToggleSelect(c.id); }}
              >
                <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(c.id)} />
              </div>
            )}
            <div className="relative h-44 bg-muted">
              <ThumbBg path={c.thumbnail_url} />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold text-white bg-black/60 backdrop-blur-sm">
                {issueLabel(c)}
              </div>
              <div
                className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: STATUS_COLORS[c.status] }}
              >
                {c.status}
              </div>
            </div>
            <div
              className="p-3 text-white space-y-2"
              style={{ backgroundColor: STATUS_COLORS[c.status] }}
            >
              <div className="font-semibold truncate" title={c.name}>{c.name}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs opacity-95">
                <div>
                  <div className="opacity-75">Type</div>
                  <div className="font-medium truncate">{c.issue_type || "—"}</div>
                </div>
                <div>
                  <div className="opacity-75">Priority</div>
                  <div>
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ backgroundColor: PRIORITY_COLORS[c.priority], color: "#fff" }}
                    >
                      {c.priority}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="opacity-75">Created</div>
                  <div className="font-medium">{toDMY(c.created_at)}</div>
                </div>
                <div>
                  <div className="opacity-75">Due</div>
                  <div className="font-medium">{toDMY(c.due_date)}</div>
                </div>
                <div className="col-span-2">
                  <div className="opacity-75">Author</div>
                  <div className="font-medium truncate">{names[c.created_by] || c.author_email || "—"}</div>
                </div>
              </div>
              <div className="text-xs opacity-95 truncate pt-1 border-t border-white/20">
                Assigned to: <span className="font-medium">{c.originator?.trim() || "—"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ClashTileGrid;
