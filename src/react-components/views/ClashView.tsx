import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { useClashStore } from "@/react-components/store/clashStore";
import { useClashReports } from "@/react-components/features/clash-dashboard/useClashViewpoints";
import {
  ClashDashboard,
  ClashReportsTable,
  ClashMatrix,
  ClashHistory,
  ClashPreview,
} from "@/react-components/features/clash-dashboard";
import { ClashTable } from "@/react-components/features/clash-table";

export function ClashView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { user, profile } = useAuth();
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");

  // Zustand Store Layout State
  const { activeTab, setActiveTab, selectedReportId, setSelectedReportId } = useClashStore();

  // Query reports to display active filter labels
  const { data: reports = [] } = useClashReports(project?.id);
  const activeReport = reports.find((r) => r.id === selectedReportId);

  if (isLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading project...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="text-center p-6 border border-border bg-surface rounded-radius max-w-md">
          <h2 className="text-lg font-bold mb-2">Project Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <AppShell project={project} showSettings={showSettings}>
      <WorkspaceHeader
        title="Clash Detection"
        tabs={["Dashboard", "Clash Reports", "Matrix", "History"]}
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
      />

      {/* Selected Report Batch Filter Banner */}
      {activeTab === "Dashboard" && selectedReportId && activeReport && (
        <div className="flex items-center justify-between gap-4 px-6 py-2.5 bg-[oklch(15.5%_0.025_252)] border-b border-border text-xs text-accent">
          <span>
            Filtering clashes by batch: <strong>{activeReport.name}</strong> ({activeReport.totalCount} total)
          </span>
          <button
            onClick={() => setSelectedReportId(null)}
            className="text-accent hover:text-accent-2 font-bold cursor-pointer bg-transparent border-0 underline"
            type="button"
          >
            Show All Clashes
          </button>
        </div>
      )}

      <div className="relative flex-1 min-w-0 overflow-hidden flex flex-col bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        {/* Tab Conditional Rendering */}
        {activeTab === "Dashboard" && (
          <div className="flex flex-col h-full overflow-hidden">
            <ClashDashboard projectId={project.id} />
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <ClashTable projectId={project.id} />
              
              {/* Sidebar with details */}
              <aside className="w-[320px] border-l border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col overflow-y-auto max-h-[calc(100vh-130px)]">
                <div className="p-5">
                  <ClashPreview projectId={project.id} />
                </div>
              </aside>
            </div>
          </div>
        )}

        {activeTab === "Clash Reports" && (
          <ClashReportsTable projectId={project.id} />
        )}

        {activeTab === "Matrix" && (
          <ClashMatrix projectId={project.id} />
        )}

        {activeTab === "History" && (
          <ClashHistory projectId={project.id} />
        )}
      </div>
    </AppShell>
  );
}
