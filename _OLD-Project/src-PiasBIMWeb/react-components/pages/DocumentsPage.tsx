import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { WorkspaceHeader } from "../layout/WorkspaceHeader";
import { getProjectById } from "../../classes/ProjectsManager";

export function DocumentsPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);

  const docTabs = project?.documentStatusTabs || [];
  const tabs = docTabs.map((t) => t.tabTitle);
  const [activeTabName, setActiveTabName] = useState("");

  // Sync active tab name when tabs array changes
  useEffect(() => {
    if (tabs.length > 0) {
      if (!activeTabName || !tabs.includes(activeTabName)) {
        setActiveTabName(tabs[0]);
      }
    } else {
      setActiveTabName("");
    }
  }, [project?.documentStatusTabs]);

  if (!project) {
    return (
      <div className="app-container projects-app" style={{ padding: "40px" }}>
        Loading Project...
      </div>
    );
  }

  const activeTabObj = docTabs.find((t) => t.tabTitle === activeTabName) || docTabs[0];

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="Document Status"
        tabs={tabs}
        activeTab={activeTabName}
        onTabChange={setActiveTabName}
      />
      <div className="workspace-area model-workspace">
        {activeTabObj ? (
          <section className="viewport-container model-viewport" style={{ height: "100%", width: "100%" }}>
            <iframe
              key={activeTabObj.url}
              title={activeTabObj.sectionTitle}
              src={activeTabObj.url}
              frameBorder="0"
              allowFullScreen={true}
              style={{
                width: "100%",
                height: "100%",
                border: "none"
              }}
            />
          </section>
        ) : (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "40px",
            height: "100%",
            width: "100%"
          }}>
            <div style={{ textAlign: "center", maxWidth: "400px" }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>📊</div>
              <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--fg)", marginBottom: "8px" }}>No Dashboards Configured</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: "1.6" }}>
                This project does not have any Document Status dashboards configured yet. Project admins can configure them under the **Document Status** tab in **Settings**.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
