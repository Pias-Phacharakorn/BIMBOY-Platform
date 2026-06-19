import { useParams } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { WorkspaceHeader } from "../layout/WorkspaceHeader";
import { getProjectById } from "../../classes/ProjectsManager";

export function StandardPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);

  if (!project) {
    return <div className="app-container projects-app" style={{ padding: "40px" }}>Loading Project...</div>;
  }

  return (
    <AppShell project={project}>
      <WorkspaceHeader title="Project Standard" />
      <div className="workspace-area" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <div style={{ textAlign: "center", padding: "40px", border: "1px dashed var(--border)", borderRadius: "var(--radius)" }}>
          <p style={{ fontSize: "16px", fontWeight: "500", color: "var(--fg)" }}>No data on local</p>
        </div>
      </div>
    </AppShell>
  );
}
