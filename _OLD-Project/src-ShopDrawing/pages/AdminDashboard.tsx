import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { canManageUsers } from "@/types/roles";
import { useActiveProject } from "@/hooks/useActiveProject";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { FileText, QrCode, GitCompareArrows, FolderKanban, LayoutGrid, List, ArrowRight, Box } from "lucide-react";

interface ProjectStat {
  id: string;
  name: string;
  description: string | null;
  drawings: number;
  scans: number;
  clashes: number;
  ifcFiles: number;
}

type ViewMode = "table" | "tile";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const { setSelectedProject } = useActiveProject();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProjectStat[]>([]);
  const [view, setView] = useState<ViewMode>(() =>
    (localStorage.getItem("adminDashboardView") as ViewMode) || "tile"
  );

  useEffect(() => {
    localStorage.setItem("adminDashboardView", view);
  }, [view]);

  useEffect(() => {
    if (roleLoading) return;
    if (!canManageUsers(role)) {
      navigate("/dashboard");
      return;
    }
    (async () => {
      setLoading(true);
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, description")
        .order("name");
      if (!projects) { setLoading(false); return; }

      const results = await Promise.all(
        projects.map(async (p) => {
          const [d, s, c, b] = await Promise.all([
            supabase.from("shop_drawings").select("id", { count: "exact", head: true }).eq("project_id", p.id),
            supabase.from("scan_activities").select("id", { count: "exact", head: true }).eq("project_id", p.id),
            supabase.from("clash_viewpoints").select("id", { count: "exact", head: true }).eq("project_id", p.id),
            supabase.from("bim_models").select("id", { count: "exact", head: true }).eq("project_id", p.id),
          ]);
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            drawings: d.count ?? 0,
            scans: s.count ?? 0,
            clashes: c.count ?? 0,
            ifcFiles: b.count ?? 0,
          };
        })
      );
      setStats(results);
      setLoading(false);
    })();
  }, [role, roleLoading, navigate]);

  if (roleLoading || loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }

  const totals = stats.reduce(
    (acc, s) => ({
      drawings: acc.drawings + s.drawings,
      scans: acc.scans + s.scans,
      clashes: acc.clashes + s.clashes,
      ifcFiles: acc.ifcFiles + s.ifcFiles,
    }),
    { drawings: 0, scans: 0, clashes: 0, ifcFiles: 0 }
  );

  const summary = [
    { label: "Projects", value: stats.length, icon: FolderKanban },
    { label: "Total Drawings", value: totals.drawings, icon: FileText },
    { label: "Total Scans", value: totals.scans, icon: QrCode },
    { label: "Total Clashes", value: totals.clashes, icon: GitCompareArrows },
    { label: "Total BIM Models", value: totals.ifcFiles, icon: Box },
  ];

  const openProject = (projectId: string) => {
    setSelectedProject(projectId);
    navigate("/dashboard");
  };

  return (
    <div className="animate-fade-in container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of drawings, scans and clashes across all projects.</p>
        </div>
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as ViewMode)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="tile" aria-label="Tile view">
            <LayoutGrid className="h-4 w-4 mr-1.5" /> Tile
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="h-4 w-4 mr-1.5" /> Table
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {view === "table" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Per Project Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Project</th>
                  <th className="text-center px-4 py-2 font-medium">Drawings</th>
                  <th className="text-center px-4 py-2 font-medium">Scan Activities</th>
                  <th className="text-center px-4 py-2 font-medium">Clashes</th>
                  <th className="text-center px-4 py-2 font-medium">BIM Models</th>
                  <th className="text-right px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-center">{s.drawings}</td>
                    <td className="px-4 py-3 text-center">{s.scans}</td>
                    <td className="px-4 py-3 text-center">{s.clashes}</td>
                    <td className="px-4 py-3 text-center">{s.ifcFiles}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => openProject(s.id)}>
                        Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {stats.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No projects</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Projects</h2>
          {stats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">No projects</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                  onClick={() => openProject(s.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </CardTitle>
                    {s.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{s.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="rounded-md bg-muted/40 py-2">
                        <FileText className="h-4 w-4 mx-auto text-muted-foreground" />
                        <p className="text-lg font-semibold mt-1">{s.drawings}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Drawings</p>
                      </div>
                      <div className="rounded-md bg-muted/40 py-2">
                        <QrCode className="h-4 w-4 mx-auto text-muted-foreground" />
                        <p className="text-lg font-semibold mt-1">{s.scans}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Scans</p>
                      </div>
                      <div className="rounded-md bg-muted/40 py-2">
                        <GitCompareArrows className="h-4 w-4 mx-auto text-muted-foreground" />
                        <p className="text-lg font-semibold mt-1">{s.clashes}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clashes</p>
                      </div>
                      <div className="rounded-md bg-muted/40 py-2">
                        <Box className="h-4 w-4 mx-auto text-muted-foreground" />
                        <p className="text-lg font-semibold mt-1">{s.ifcFiles}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Models</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
