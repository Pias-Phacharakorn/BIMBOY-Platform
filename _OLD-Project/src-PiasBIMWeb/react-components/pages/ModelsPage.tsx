import { useState } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { WorkspaceHeader } from "../layout/WorkspaceHeader";
import { getProjectById } from "../../classes/ProjectsManager";
import { ViewerView } from "../views/models/ViewerView";
import { GisView } from "../views/models/GisView";
import { CustomViewView } from "../views/models/CustomViewView";

export function ModelsPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);
  
  const tabs = [
    "Models",
    "Query",
    "Viewer",
    "GIS",
    "Data",
    "Property",
    "Minimap",
    "Smart View",
    "Viewpoint",
    "Clipper",
  ];
  
  const [activeTab, setActiveTab] = useState("Models");

  if (!project) {
    return (
      <div className="app-container projects-app" style={{ padding: "40px" }}>
        Loading Project...
      </div>
    );
  }

  const renderActiveView = () => {
    if (activeTab === "Models" || activeTab === "Viewer") {
      return <ViewerView activeTab={activeTab} />;
    }
    if (activeTab === "GIS") {
      return <GisView />;
    }
    return <CustomViewView activeTab={activeTab} />;
  };

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="BIM Model"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="workspace-area model-workspace">
        {renderActiveView()}
      </div>
    </AppShell>
  );
}
