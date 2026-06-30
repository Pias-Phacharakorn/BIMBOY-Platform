import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { Icon } from "@/react-components/components/ui";
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";

export function PowerBIView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { user, profile } = useAuth();
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");

  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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
          <Icon name="WARNING" size={32} className="text-status-danger mb-4" />
          <h2 className="text-lg font-bold mb-2">Project Not Found</h2>
        </div>
      </div>
    );
  }

  const powerbiTabs = (project as any).powerbiTabs || [];
  const activeTab = powerbiTabs.find((t: any) => t.id === activeTabId) || powerbiTabs[0];

  const handleTabChange = (tabTitle: string) => {
    const tabObj = powerbiTabs.find((t: any) => t.tabTitle === tabTitle);
    if (tabObj) {
      setActiveTabId(tabObj.id);
    }
  };

  return (
    <AppShell project={project} showSettings={showSettings}>
      <WorkspaceHeader
        title="Power BI"
        tabs={powerbiTabs.map((t: any) => t.tabTitle)}
        activeTab={activeTab?.tabTitle || ""}
        onTabChange={handleTabChange}
      />
      <div className="relative flex-1 min-w-0 bg-[#090a0f] flex flex-col overflow-hidden">
        {powerbiTabs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-fg">
            <div className="flex flex-col items-center max-w-sm">
              <Icon name="WARNING" size={48} className="text-muted/40 mb-4" />
              <h2 className="text-lg font-bold mb-2">No Dashboards Configured</h2>
              <p className="text-xs text-muted mb-6">
                There are no Power BI dashboards configured for this project.
              </p>
              {showSettings && (
                <Link
                  to={`/projects/${project.id}/settings`}
                  search={{}}
                  className="inline-flex items-center justify-center gap-2 min-h-8 px-4 py-1.5 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-border hover:bg-surface-alt transition-colors duration-120"
                >
                  Go to Settings
                </Link>
              )}
            </div>
          </div>
        ) : (
          <iframe
            src={activeTab?.url}
            title={activeTab?.tabTitle}
            className="w-full h-full border-none flex-1"
            allowFullScreen
          />
        )}
      </div>
    </AppShell>
  );
}
