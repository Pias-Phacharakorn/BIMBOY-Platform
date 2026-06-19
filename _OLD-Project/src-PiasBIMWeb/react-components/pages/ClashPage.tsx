import { useParams } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { WorkspaceHeader } from "../layout/WorkspaceHeader";
import { getProjectById } from "../../classes/ProjectsManager";
import { ClashView } from "../views/clash/ClashView";

export function ClashPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);

  if (!project) {
    return <div className="app-container projects-app" style={{ padding: "40px" }}>Loading Project...</div>;
  }

  return (
    <AppShell project={project}>
      <WorkspaceHeader title="Clash Detection" />
      <div className="workspace-area model-workspace">
        <ClashView />
      </div>
    </AppShell>
  );
}
