import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader, LeftPanel, RightPanel, PanelSection } from "@/react-components/components/layout";
import { Icon } from "@/react-components/components/ui";
import { ViewportWrapper, ViewportRightToolbar, ViewportToolbar, ModelsList } from "@/react-components/components/bim";
import { GisPanel } from "@/react-components/features/gis";
import { PropertyPanel } from "@/react-components/features/property-panel";
import { PropertyTable } from "@/react-components/features/property-table/PropertyTable";
import { getProjectById, workspaceTabs } from "@/static-data";

export function ModelsView() {
  const { projectId } = useParams({ strict: false });
  const project = getProjectById(projectId);
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Models");
  const isQueriesTab = activeTab === "Queries";
  const isGisTab = activeTab === "GIS";

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="BIM Model"
        tabs={workspaceTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <>
            <div className="flex items-center gap-2 p-[4px_12px] border border-border bg-surface/94 rounded-[20px] cursor-pointer text-xs font-medium text-fg hover:bg-surface-alt transition-colors duration-120">
              <Icon name="MODEL" size={14} />
              <span>Default Layout</span>
              <Icon name="RIGHT" size={12} />
            </div>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-accent bg-gradient-to-b from-accent to-accent-muted text-fg hover:from-accent hover:to-accent/90" type="button">
              Share
            </button>
          </>
        }
      />
      <div
        className={activeTab === "Models" ? "flex flex-row flex-1 min-h-0 w-full" : "grid flex-1 min-h-0 w-full"}
        style={
          isQueriesTab
            ? {
                gridTemplateColumns: "1fr 320px",
                gridTemplateRows: "1fr 0.8fr",
                gridTemplateAreas: '"viewport propertypanel" "propertytable propertytable"',
              }
            : isGisTab
              ? {
                  gridTemplateColumns: "1fr 360px",
                  gridTemplateRows: "1fr",
                  gridTemplateAreas: '"viewport gis"',
                }
              : undefined
        }
      >
        <LeftPanel
          icon="MODEL"
          defaultOpen={true}
          className={activeTab === "Models" ? "" : "hidden"}
        >
          <PanelSection label="Models List" icon="MODEL" defaultOpen={true} onSearch={setModelSearchQuery}>
            <ModelsList searchQuery={modelSearchQuery} />
          </PanelSection>
        </LeftPanel>

        <section
          className={`h-full min-w-0 relative border border-border overflow-hidden bg-[#0d0e12] ${
            activeTab === "Models" ? "flex-1" : ""
          }`}
          style={isQueriesTab || isGisTab ? { gridArea: "viewport" } : undefined}
        >
          <ViewportWrapper />
          <ViewportRightToolbar />
          <ViewportToolbar />
        </section>

        <RightPanel
          icon="SETTINGS"
          defaultOpen={true}
          className={activeTab === "Models" ? "" : "hidden"}
        >
          <PanelSection
            label="Item Properties"
            icon="SETTINGS"
            defaultOpen={true}
            noPadding={true}
          >
            <PropertyPanel />
          </PanelSection>
        </RightPanel>

        {isQueriesTab && (
          <div style={{ gridArea: "propertypanel" }} className="border-l border-border h-full flex flex-col min-h-0 bg-surface">
            <PanelSection
              label="Item Properties"
              icon="SETTINGS"
              defaultOpen={true}
              noPadding={true}
              fullHeight={true}
            >
              <PropertyPanel fullHeight={true} />
            </PanelSection>
          </div>
        )}

        {isGisTab && (
          <aside style={{ gridArea: "gis" }} className="h-full min-h-0 border-l border-border bg-surface">
            <GisPanel />
          </aside>
        )}

        <div style={{ gridArea: "propertytable" }} className={isQueriesTab ? "w-full h-full min-h-0 border-t border-border" : "hidden"}>
          <PropertyTable />
        </div>
      </div>
    </AppShell>
  );
}

