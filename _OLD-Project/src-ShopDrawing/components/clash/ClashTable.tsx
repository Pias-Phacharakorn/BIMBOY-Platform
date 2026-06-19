import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clash, isOverdue, STATUS_COLORS, PRIORITY_COLORS, DISC_COLORS, issueLabel } from "./clashTypes";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, ImageOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type SortKey = "issue_number" | "name" | "issue_type" | "status" | "priority" | "discipline" | "zone" | "originator" | "element_id" | "author_email" | "due_date";

interface Props {
  clashes: Clash[];
  onRowClick: (c: Clash) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

const ThumbCell = ({ path }: { path: string | null }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    supabase.storage.from("clash-thumbnails").createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl || null);
    });
    return () => { cancelled = true; };
  }, [path]);
  if (!path) return <div className="w-16 h-12 bg-muted rounded flex items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground" /></div>;
  if (!url) return <div className="w-16 h-12 bg-muted rounded animate-pulse" />;
  return <img src={url} alt="vp" className="w-16 h-12 object-cover rounded border" />;
};

const Pill = ({ label, color }: { label: string; color: string }) => (
  <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap" style={{ backgroundColor: color }}>{label}</span>
);

const ClashTable = ({ clashes, onRowClick, selectedIds, onToggleSelect, onToggleSelectAll }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>("issue_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = [...clashes].sort((a, b) => {
    const av = (a[sortKey] ?? "") as any;
    const bv = (b[sortKey] ?? "") as any;
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th onClick={() => toggleSort(k)} className="text-left px-3 py-2 font-medium cursor-pointer select-none whitespace-nowrap">
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </span>
    </th>
  );

  const allSelected = !!selectedIds && clashes.length > 0 && clashes.every((c) => selectedIds.has(c.id));

  return (
    <div className="bg-card border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {onToggleSelectAll && (
              <th className="px-3 py-2 w-10">
                <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
              </th>
            )}
            <th className="text-left px-3 py-2 font-medium">VP</th>
            <Th k="issue_number" label="#" />
            <Th k="name" label="Issue Name" />
            <Th k="issue_type" label="Type" />
            <Th k="status" label="Status" />
            <Th k="priority" label="Priority" />
            <Th k="discipline" label="Disc." />
            <Th k="zone" label="Zone" />
            <Th k="element_id" label="Element ID" />
            <Th k="originator" label="Assignee" />
            <Th k="author_email" label="Author" />
            <Th k="due_date" label="Due Date" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const overdue = isOverdue(c);
            const isSelected = !!selectedIds?.has(c.id);
            return (
              <tr
                key={c.id}
                onClick={() => onRowClick(c)}
                className={cn("border-b hover:bg-muted/40 cursor-pointer transition-colors", overdue && "bg-red-50/50", isSelected && "bg-primary/5")}
              >
                {onToggleSelect && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(c.id)} />
                  </td>
                )}
                <td className="px-3 py-2"><ThumbCell path={c.thumbnail_url} /></td>
                <td className="px-3 py-2 font-mono text-xs">{issueLabel(c)}</td>
                <td className="px-3 py-2 font-medium max-w-xs truncate">{c.name}</td>
                <td className="px-3 py-2">{c.issue_type || "—"}</td>
                <td className="px-3 py-2"><Pill label={c.status} color={STATUS_COLORS[c.status]} /></td>
                <td className="px-3 py-2"><Pill label={c.priority} color={PRIORITY_COLORS[c.priority]} /></td>
                <td className="px-3 py-2">{c.discipline ? <Pill label={c.discipline} color={DISC_COLORS[c.discipline] || "#94a3b8"} /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">{c.zone || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{c.element_id || "—"}</td>
                <td className="px-3 py-2">{c.originator || "—"}</td>
                <td className="px-3 py-2">{c.author_email || "—"}</td>
                <td className={cn("px-3 py-2 whitespace-nowrap", overdue && "text-destructive font-semibold")}>
                  {c.due_date || "—"}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={onToggleSelect ? 13 : 12} className="text-center py-12 text-muted-foreground">No issues found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ClashTable;
