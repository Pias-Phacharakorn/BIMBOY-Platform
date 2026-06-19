import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, Search, Grid3x3, List as ListIcon, BarChart3, FileDown } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { hasRoleOrHigher } from "@/types/roles";
import { Clash, ClashStatus, ClashPriority, isOverdue } from "@/components/clash/clashTypes";
import { useClashes } from "@/hooks/useClashes";
import { useActiveProject } from "@/hooks/useActiveProject";
import ClashSlicers from "@/components/clash/ClashSlicers";
import ClashTable from "@/components/clash/ClashTable";
import ClashTileGrid from "@/components/clash/ClashTileGrid";
import ClashDashboard from "@/components/clash/ClashDashboard";
import ClashIssueDetail from "@/components/clash/ClashIssueDetail";
import ClashFormDialog from "@/components/clash/ClashFormDialog";
import ClashImportDialog from "@/components/clash/ClashImportDialog";
import ClashBatchActionsBar from "@/components/clash/ClashBatchActionsBar";
import { useToast } from "@/hooks/use-toast";
import { generateClashReport, downloadBlob } from "@/lib/clashPdfReport";

type ViewMode = "tile" | "list" | "dashboard";

const ClashTracking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { selectedProject, projects } = useActiveProject();
  const canEdit = hasRoleOrHigher(role, "engineer");

  const { clashes, loading, reload } = useClashes(selectedProject);

  const [view, setView] = useState<ViewMode>("tile");
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<ClashStatus>>(new Set());
  const [priorityFilters, setPriorityFilters] = useState<Set<ClashPriority>>(new Set());
  const [disciplineFilters, setDisciplineFilters] = useState<Set<string>>(new Set());
  const [zoneFilters, setZoneFilters] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [detailClash, setDetailClash] = useState<Clash | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Clash | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const dashboardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  const zones = useMemo(() => Array.from(new Set(clashes.map((c) => c.zone).filter(Boolean) as string[])).sort(), [clashes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clashes.filter((c) => {
      if (statusFilters.size && !statusFilters.has(c.status)) return false;
      if (priorityFilters.size && !priorityFilters.has(c.priority)) return false;
      if (disciplineFilters.size && (!c.discipline || !disciplineFilters.has(c.discipline))) return false;
      if (zoneFilters.size && (!c.zone || !zoneFilters.has(c.zone))) return false;
      if (overdueOnly && !isOverdue(c)) return false;
      if (dateFrom && c.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && c.created_at.slice(0, 10) > dateTo) return false;
      if (q) {
        const hay = `${c.name} ${c.issue_number || ""} ${c.vp_key || ""} ${c.originator || ""} ${c.zone || ""} ${c.level || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clashes, search, statusFilters, priorityFilters, disciplineFilters, zoneFilters, overdueOnly, dateFrom, dateTo]);

  const navigateDetail = (dir: -1 | 1) => {
    if (!detailClash) return;
    const idx = filtered.findIndex((c) => c.id === detailClash.id);
    if (idx === -1) return;
    const next = filtered[(idx + dir + filtered.length) % filtered.length];
    setDetailClash(next);
  };

  const projectName = projects?.find((p) => p.id === selectedProject)?.name || "Project";

  const exportPdf = async () => {
    const scope = selectedIds.size > 0 ? filtered.filter((c) => selectedIds.has(c.id)) : filtered;
    if (scope.length === 0) { toast({ title: "No issues to export" }); return; }
    setExporting(true);
    toast({ title: "Generating PDF report…", description: `${scope.length} issue(s)` });
    try {
      // Need dashboard rendered to snapshot it — force-show offscreen if not in dashboard view
      const bytes = await generateClashReport({
        projectName,
        dashboardEl: dashboardRef.current,
        clashes: scope,
      });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadBlob(bytes, `ClashReport_${projectName.replace(/[^a-zA-Z0-9]+/g, "_")}_${stamp}.pdf`);
      toast({ title: "Report ready" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally { setExporting(false); }
  };

  const toggleSel = (id: string) => {
    setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelAll = () => {
    const allOn = filtered.every((c) => selectedIds.has(c.id));
    setSelectedIds(allOn ? new Set() : new Set(filtered.map((c) => c.id)));
  };

  const ViewBtn = ({ v, icon: Icon, label }: { v: ViewMode; icon: any; label: string }) => (
    <Button size="sm" variant={view === v ? "default" : "outline"} onClick={() => setView(v)}>
      <Icon className="h-4 w-4 mr-1" /> {label}
    </Button>
  );

  return (
    <div className="animate-fade-in container mx-auto px-4 md:px-6 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Clash Tracking</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={exporting || filtered.length === 0}>
            <FileDown className="h-4 w-4 mr-1" /> {exporting ? "Exporting…" : selectedIds.size > 0 ? `Export PDF (${selectedIds.size})` : "Export PDF"}
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={!selectedProject}>
                <Upload className="h-4 w-4 mr-1" /> Import
              </Button>
              <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} disabled={!selectedProject}>
                <Plus className="h-4 w-4 mr-1" /> New Issue
              </Button>
            </>
          )}
        </div>
      </div>

      {!selectedProject ? (
        <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">
          Select a project to view issues.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <ViewBtn v="tile" icon={Grid3x3} label="Tile" />
              <ViewBtn v="list" icon={ListIcon} label="List" />
              <ViewBtn v="dashboard" icon={BarChart3} label="Dashboard" />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search issues…" className="pl-9 h-9" />
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowFilters((v) => !v)}>
                {showFilters ? "Hide" : "Filters"}
              </Button>
            </div>
          </div>

          {showFilters && (
            <ClashSlicers
              statusFilters={statusFilters} setStatusFilters={setStatusFilters}
              priorityFilters={priorityFilters} setPriorityFilters={setPriorityFilters}
              disciplineFilters={disciplineFilters} setDisciplineFilters={setDisciplineFilters}
              zones={zones} zoneFilters={zoneFilters} setZoneFilters={setZoneFilters}
              dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
              overdueOnly={overdueOnly} setOverdueOnly={setOverdueOnly}
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Showing {filtered.length} of {clashes.length} issues
            </div>
            {filtered.length > 0 && (
              <Button size="sm" variant="ghost" onClick={toggleSelAll} className="h-7 text-xs">
                {filtered.every((c) => selectedIds.has(c.id)) ? "Deselect all" : "Select all"}
              </Button>
            )}
          </div>

          <ClashBatchActionsBar
            selectedIds={selectedIds}
            onClear={() => setSelectedIds(new Set())}
            onChanged={() => { reload(); }}
            canEdit={canEdit}
          />

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading…</div>
          ) : view === "tile" ? (
            <ClashTileGrid
              clashes={filtered}
              onCardClick={setDetailClash}
              selectedIds={selectedIds}
              onToggleSelect={toggleSel}
            />
          ) : view === "list" ? (
            <ClashTable
              clashes={filtered}
              onRowClick={setDetailClash}
              selectedIds={selectedIds}
              onToggleSelect={toggleSel}
              onToggleSelectAll={toggleSelAll}
            />
          ) : (
            <ClashDashboard ref={dashboardRef} clashes={filtered} />
          )}

          {/* Always-mounted hidden dashboard for PDF snapshot when not in dashboard view */}
          {view !== "dashboard" && (
            <div className="fixed -left-[10000px] top-0 w-[1100px] pointer-events-none" aria-hidden>
              <ClashDashboard ref={dashboardRef} clashes={filtered} />
            </div>
          )}
        </>
      )}

      <ClashIssueDetail
        clash={detailClash}
        open={!!detailClash}
        onClose={() => setDetailClash(null)}
        onEdit={(c) => { setEditing(c); setDetailClash(null); setFormOpen(true); }}
        onNavigate={navigateDetail}
        canEdit={canEdit}
      />

      <ClashFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        clash={editing}
        projectId={selectedProject}
        canEdit={canEdit}
        onSaved={reload}
      />
      <ClashImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={selectedProject}
        onImported={reload}
      />
    </div>
  );
};

export default ClashTracking;
