import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader, LeftPanel, RightPanel, PanelSection } from "@/react-components/components/layout";
import { Icon } from "@/react-components/components/ui";
import { ViewportWrapper, ViewportSettings, ViewportToolbar, ModelsList } from "@/react-components/components/bim";
import { PropertyPanel } from "@/react-components/features/property-panel";
import { getProjectById, workspaceTabs } from "@/static-data";

export function ModelsView() {
  const { projectId } = useParams({ strict: false });
  const project = getProjectById(projectId);
  const [modelSearchQuery, setModelSearchQuery] = useState("");

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="BIM Model"
        tabs={workspaceTabs}
        activeTab="Models"
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
      <div className="flex flex-row flex-1 min-h-0 w-full">
        <LeftPanel icon="MODEL" defaultOpen={true}>
          <PanelSection label="Models List" icon="MODEL" defaultOpen={true} onSearch={setModelSearchQuery}>
            <ModelsList searchQuery={modelSearchQuery} />
          </PanelSection>
        </LeftPanel>

        <section className="flex-1 h-full min-w-0 relative border border-border overflow-hidden bg-[#0d0e12]">
          <ViewportWrapper />
          <ViewportSettings />
          <ViewportToolbar />
        </section>

        <RightPanel icon="SETTINGS" defaultOpen={true}>
          <PanelSection
            label="Item Properties"
            icon="SETTINGS"
            defaultOpen={true}
            noPadding={true}
          >
            <PropertyPanel />
          </PanelSection>
        </RightPanel>
      </div>
    </AppShell>
  );
}
