import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader, LeftPanel, RightPanel, PanelSection } from "@/react-components/components/layout";
import { Icon } from "@/react-components/components/ui";
import { ViewportWrapper, ViewportRightToolbar, ViewportToolbar, ModelsList, Views2DList, CloudModelLoadingModal } from "@/react-components/components/bim";
import { GisPanel } from "@/react-components/features/gis";
import { PropertyPanel } from "@/react-components/features/property-panel";
import { PropertyTable } from "@/react-components/features/property-table/PropertyTable";
import { ClashList, ClashPreview } from "@/react-components/features/clash-dashboard";
import { DrawingEditorPanel, DrawingEditorBoard } from "@/react-components/features/drawing-editor";
// AR runs on a standalone full-screen /ar page (single WebGL context, no OBC engine).
// Clicking the "AR" tab navigates there — see onTabChange below.
// The custom ArSession/ArViewerPanel/useArSession approach is kept in the repo but
// dormant (not imported) for the later "real BIM model in AR" step.
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { useAutoLoadCloudModels } from "@/react-components/features/cloud-models/useAutoLoadCloudModels";

const workspaceTabs = ["Models", "Queries", "Viewer", "Smart Views", "GIS", "Viewpoint", "Drawing Editor", "AR"];

export function ModelsView() {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { user, profile } = useAuth();
  useAutoLoadCloudModels(projectId);
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");

  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Models");
  const isQueriesTab = activeTab === "Queries";
  const isGisTab = activeTab === "GIS";
  const isViewpointTab = activeTab === "Viewpoint";
  const isDrawingEditorTab = activeTab === "Drawing Editor";
  const isFlexLayout = activeTab === "Models" || isGisTab || isViewpointTab || isDrawingEditorTab;

  // The "AR" tab escapes ModelsView entirely: it navigates to the standalone
  // full-screen /ar page instead of swapping panels here, so the WebXR session
  // runs without the OBC engine's competing WebGL context.
  const handleTabChange = (tab: string) => {
    if (tab === "AR") {
      if (project) {
        navigate({ to: "/ar/$projectId", params: { projectId: project.id } });
      }
      return;
    }
    setActiveTab(tab);
  };

  if (isLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading project model...</span>
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
        title="BIM Model"
        tabs={workspaceTabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
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
        className={
          isDrawingEditorTab
            ? "flex flex-col flex-1 min-h-0 w-full"
            : isFlexLayout
              ? "flex flex-row flex-1 min-h-0 w-full"
              : "grid flex-1 min-h-0 w-full"
        }
        style={
          isQueriesTab
            ? {
                gridTemplateColumns: "1fr 320px",
                gridTemplateRows: "1fr 0.8fr",
                gridTemplateAreas: '"viewport propertypanel" "propertytable propertytable"',
              }
            : undefined
        }
      >
        <LeftPanel
          icon="MODEL"
          defaultOpen={true}
          className={activeTab === "Models" ? "" : "hidden"}
        >
          <PanelSection label="Models List" icon="MODEL" defaultOpen={true} fullHeight={true} onSearch={setModelSearchQuery}>
            <ModelsList searchQuery={modelSearchQuery} />
          </PanelSection>
          <PanelSection label="2D Views" icon="LAYOUT" defaultOpen={true} fullHeight={true}>
            <Views2DList />
          </PanelSection>
        </LeftPanel>

        {isViewpointTab && (
          <LeftPanel icon="MODEL" defaultOpen={true}>
            <PanelSection label="Viewpoints" icon="MODEL" defaultOpen={true} noPadding={true} fullHeight={true}>
              <ClashList projectId={project.id} />
            </PanelSection>
          </LeftPanel>
        )}

        <section
          className={`h-full min-w-0 relative border border-border overflow-hidden bg-[#0d0e12] ${
            isFlexLayout ? "flex-1" : ""
          }`}
          style={isQueriesTab ? { gridArea: "viewport" } : undefined}
        >
          <ViewportWrapper />
          <ViewportRightToolbar />
          <ViewportToolbar />
          <CloudModelLoadingModal />
        </section>

        {isDrawingEditorTab && (
          <div className="flex flex-1 min-h-0 w-full">
            <DrawingEditorBoard />
            <div className="w-48 shrink-0 flex flex-col min-h-0 border-l border-t border-border bg-surface">
              <div className="flex h-8 shrink-0 items-center justify-center border-b border-border bg-surface-alt">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">Levels</span>
              </div>
              <DrawingEditorPanel />
            </div>
          </div>
        )}

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
            fullHeight={true}
          >
            <PropertyPanel fullHeight={true} />
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
          <RightPanel
            icon="EARTH"
            defaultOpen={true}
            defaultWidth={400}
          >
            <GisPanel />
          </RightPanel>
        )}

        {isViewpointTab && (
          <RightPanel icon="SETTINGS" defaultOpen={true}>
            <PanelSection label="Clash Preview" icon="SETTINGS" defaultOpen={true} noPadding={true}>
              <div className="p-4">
                <ClashPreview projectId={project.id} />
              </div>
            </PanelSection>
          </RightPanel>
        )}

        <div style={{ gridArea: "propertytable" }} className={isQueriesTab ? "w-full h-full min-h-0 border-t border-border" : "hidden"}>
          <PropertyTable />
        </div>
      </div>
    </AppShell>
  );
}

