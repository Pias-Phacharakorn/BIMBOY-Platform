import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader, LeftPanel, RightPanel, PanelSection } from "@/react-components/components/layout";
import { ViewportWrapper, ViewportRightToolbar, ViewportToolbar, ModelsList, Views2DList, CloudModelLoadingModal } from "@/react-components/components/bim";
import { GisPanel } from "@/react-components/features/gis";
import { PropertyPanel } from "@/react-components/features/property-panel";
import { RoomPanel } from "@/react-components/features/room-view/RoomPanel";
import { PropertyTable } from "@/react-components/features/property-table/PropertyTable";
import { ClashList, ClashPreview } from "@/react-components/features/clash-dashboard";
import { DrawingEditorPanel, DrawingEditorBoard } from "@/react-components/features/drawing-editor";
import { PostRenderPanel } from "@/react-components/features/post-render";
import { RealisticPanel } from "@/react-components/features/realistic-view";
import { IotDeviceList, IotDataPanel, IotBindPanel } from "@/react-components/features/iot";
import { useIotTab } from "@/react-components/features/iot/useIotTab";
// AR runs on a standalone full-screen /ar page (single WebGL context, no OBC engine).
// Clicking the "AR" tab navigates there — see onTabChange below.
// The custom ArSession/ArViewerPanel/useArSession approach is kept in the repo but
// dormant (not imported) for the later "real BIM model in AR" step.
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { useAutoLoadCloudModels } from "@/react-components/features/cloud-models/useAutoLoadCloudModels";
import { useGuestDemoModels } from "@/react-components/features/guest-demo/useGuestDemoModels";
import { useIfcSpaceVisibility } from "@/react-components/features/ifc-space-visibility/useIfcSpaceVisibility";
import { useViewportFullscreenOwner } from "@/react-components/features/viewport-fullscreen/useViewportFullscreen";
import { useUIStore } from "@/react-components/store/uiStore";

const workspaceTabs = ["Models", "Queries", "Room", "Smart Views", "GIS", "Viewpoint", "Drawing Editor", "AR", "IOT", "PostRender", "Realistic"];

export function ModelsView() {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { user, profile, isGuest } = useAuth();
  useAutoLoadCloudModels(projectId);
  useGuestDemoModels(isGuest);
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");

  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Models");
  const isQueriesTab = activeTab === "Queries";
  const isGisTab = activeTab === "GIS";
  const isViewpointTab = activeTab === "Viewpoint";
  const isDrawingEditorTab = activeTab === "Drawing Editor";
  const isRoomTab = activeTab === "Room";
  const isPostRenderTab = activeTab === "PostRender";
  const isRealisticTab = activeTab === "Realistic";
  const isIotTab = activeTab === "IOT";
  const isFlexLayout =
    activeTab === "Models" ||
    isGisTab ||
    isViewpointTab ||
    isDrawingEditorTab ||
    isRoomTab ||
    isPostRenderTab ||
    isRealisticTab ||
    isIotTab;

  // The IOT tab's devices, binding, selection and live tick. Called once here and passed to both
  // panels: they are siblings with the viewport between them, so calling the hook in each would
  // give the tab two selections, two ticks and two device lists.
  const iot = useIotTab(isIotTab, project?.id, user?.id, showSettings);

  // IFCSPACE geometry is hidden in the viewport unless the user ticks it in Settings — except on
  // the Room tab, whose whole content is a list of spaces.
  //
  // The IOT tab no longer forces it: phase 1 could land on spaces by accident because it *picked*
  // the elements, whereas devices are now bound by a user who could see what they were selecting.
  // A device on a space is simply reported as unlocatable if that geometry is hidden.
  useIfcSpaceVisibility(isRoomTab);

  // This view owns full-screen mode: it renders the viewport, and the toolbar button that toggles
  // it. The owner hook is what mirrors `fullscreenchange` into the store and guarantees the mode
  // cannot outlive this view — `AppShell` wraps every workspace view, and a header-less Clash or
  // Settings page would have no toolbar to escape from.
  useViewportFullscreenOwner();
  const isViewportFullscreen = useUIStore((state) => state.isViewportFullscreen);

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
      {/* Unmounted in full-screen mode, not hidden: it holds no state (`activeTab` lives here), and
          the tabs it renders are the app chrome the mode exists to remove. */}
      {!isViewportFullscreen && (
        <WorkspaceHeader
          title="BIM Model"
          tabs={workspaceTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
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

        {/*
          Mounted conditionally, not hidden with a class like the Models panels above: mount is
          RoomView's activation signal, and an active RoomView anchors floating CSS2D room-name
          chips — which cannot be occluded — so a hidden-but-mounted panel would leave them over
          every other tab.
        */}
        {isRoomTab && (
          <LeftPanel icon="ROOM" defaultOpen={true}>
            <PanelSection label="Rooms" icon="ROOM" defaultOpen={true} fullHeight={true} onSearch={setRoomSearchQuery}>
              <RoomPanel searchQuery={roomSearchQuery} />
            </PanelSection>
          </LeftPanel>
        )}

        {isViewpointTab && (
          <LeftPanel icon="MODEL" defaultOpen={true}>
            <PanelSection label="Viewpoints" icon="MODEL" defaultOpen={true} noPadding={true} fullHeight={true}>
              <ClashList projectId={project.id} />
            </PanelSection>
          </LeftPanel>
        )}

        {isIotTab && (
          <LeftPanel icon="IOT" defaultOpen={true}>
            <PanelSection label="Devices" icon="IOT" defaultOpen={true} noPadding={true} fullHeight={true}>
              {iot.canManage && (
                <IotBindPanel binding={iot.binding} onBound={iot.onBound} />
              )}
              <IotDeviceList
                rows={iot.devices.rows}
                selectedDeviceId={iot.devices.selectedDeviceId}
                onSelect={iot.devices.select}
                isLoading={iot.devices.isLoading}
                isEmpty={iot.devices.isEmpty}
                error={iot.devices.error}
                canBind={iot.canManage}
              />
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

        {/* Shared by Models and Room: selecting a room writes the store, so this fills with its
            level, area and property sets exactly as a picked element would. */}
        <RightPanel
          icon="SETTINGS"
          defaultOpen={true}
          className={activeTab === "Models" || isRoomTab ? "" : "hidden"}
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

        {isIotTab && (
          <RightPanel icon="IOT" defaultOpen={true} defaultWidth={340}>
            <PanelSection label="Device Data" icon="IOT" defaultOpen={true} noPadding={true} fullHeight={true}>
              <IotDataPanel
                row={iot.devices.selectedRow}
                history={iot.devices.history}
                canEdit={iot.canManage}
                isSaving={iot.isSaving}
                isDeleting={iot.isDeleting}
                editError={iot.editError}
                onSave={iot.saveDevice}
                onDelete={iot.deleteDevice}
              />
            </PanelSection>
          </RightPanel>
        )}

        {/* Mounted conditionally so the panel re-seeds from the live render passes every time the
            tab is opened — the engine, not this panel, owns the values. */}
        {isPostRenderTab && (
          <RightPanel icon="COLORIZE" defaultOpen={true} defaultWidth={400}>
            <PostRenderPanel />
          </RightPanel>
        )}

        {/* Mounted conditionally for the same reason RoomPanel is, only more so: mounting
            RealisticPanel installs the daylight rig on the shared world (shadows, tone mapping,
            sky, a different light rig) and unmounting restores it. A hidden-but-mounted panel
            would leave every other tab paying for a shadow pass. */}
        {isRealisticTab && (
          <RightPanel icon="CAMERA" defaultOpen={true} defaultWidth={360}>
            <RealisticPanel />
          </RightPanel>
        )}

        <div style={{ gridArea: "propertytable" }} className={isQueriesTab ? "w-full h-full min-h-0 border-t border-border" : "hidden"}>
          <PropertyTable />
        </div>
      </div>
    </AppShell>
  );
}

