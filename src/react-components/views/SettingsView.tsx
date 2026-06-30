import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { Icon } from "@/react-components/components/ui";
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { ProjectSettingsForm } from "@/react-components/features/project-settings/ProjectSettingsForm";
import { ProjectMembersSettings } from "@/react-components/features/project-members/ProjectMembersSettings";
import { ProjectFolders } from "@/react-components/features/project-folders/ProjectFolders";
import { ProjectPowerBISettings } from "@/react-components/features/project-powerbi-settings/ProjectPowerBISettings";

export function SettingsView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading: isProjectLoading, isError: isProjectError, error: projectError } = useProject(projectId);
  const { user, profile } = useAuth();
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");

  // Tab switching state
  const [activeTab, setActiveTab] = useState("General");
  const tabs = ["General", "Members", "Folder", "PowerBI"];

  // Edit toggles and loading feedbacks
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  if (isProjectLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading project details...</span>
        </div>
      </div>
    );
  }

  if (isProjectError || !project) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="text-center p-6 border border-border bg-surface rounded-radius max-w-md">
          <Icon name="WARNING" size={32} className="text-status-danger mb-4" />
          <h2 className="text-lg font-bold mb-2">Project Not Found</h2>
          <p className="text-muted text-sm mb-4">
            {projectError?.message || "The requested project details could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppShell project={project} showSettings={showSettings}>
      <WorkspaceHeader
        title="Project Settings"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          activeTab === "General" ? (
            isEditing ? (
              <div className="flex gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border rounded-radius cursor-pointer text-xs font-semibold border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)] disabled:opacity-60 disabled:cursor-not-allowed"
                  type="submit"
                  form="project-settings-form"
                  disabled={saveLoading}
                >
                  <Icon name="CHECK" size={14} />
                  {saveLoading ? "Saving..." : "Save Settings"}
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt transition-colors duration-120"
                  type="button"
                  onClick={() => setIsEditing(false)}
                >
                  <Icon name="CLOSE" size={14} />
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border rounded-radius cursor-pointer text-xs font-semibold border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                <Icon name="EDIT" size={14} />
                Edit Settings
              </button>
            )
          ) : null
        }
      />

      <div className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="flex flex-col gap-6 w-full p-6 md:p-8">
          {activeTab === "General" && (
            <ProjectSettingsForm
              project={project}
              isEditing={isEditing}
              onSaveSuccess={() => setIsEditing(false)}
              onSaveLoadingState={setSaveLoading}
            />
          )}

          {activeTab === "Members" && (
            <ProjectMembersSettings projectId={project.id} />
          )}

          {activeTab === "Folder" && (
            <ProjectFolders project={project} />
          )}

          {activeTab === "PowerBI" && (
            <ProjectPowerBISettings project={project} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
