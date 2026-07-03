import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { ProjectFolders } from "@/react-components/features/project-folders/ProjectFolders";
import { ShopDrawingTable } from "@/react-components/features/shop-drawings";

export function DrawingView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { user, profile } = useAuth();
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");
  const [activeTab, setActiveTab] = useState("Folder");

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
        title="Drawing Directory"
        tabs={["Folder", "Register"]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        {activeTab === "Folder" && (
          <div className="flex flex-col gap-6 w-full p-6 md:p-8">
            <ProjectFolders project={project} focusFolder="04_Drawing" isAdmin={showSettings} />
          </div>
        )}
        {activeTab === "Register" && <ShopDrawingTable project={project} isAdmin={showSettings} />}
      </div>
    </AppShell>
  );
}
