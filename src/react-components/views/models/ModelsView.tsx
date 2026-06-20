import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { Icon } from "@/react-components/components/ui";
import { ViewportWrapper, ViewportSettings, ViewportToolbar } from "@/react-components/components/bim";
import { getProjectById, modelFiles, workspaceTabs } from "@/static-data";

export function ModelsView() {
  const { projectId } = useParams({ strict: false });
  const project = getProjectById(projectId);

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="BIM Model"
        tabs={workspaceTabs}
        activeTab="Models"
        actions={
          <>
            <div className="flex items-center gap-2 p-[4px_12px] border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-[20px] cursor-pointer text-xs font-medium text-fg hover:bg-surface-alt transition-colors duration-120">
              <Icon name="MODEL" size={14} />
              <span>Default Layout</span>
              <Icon name="RIGHT" size={12} />
            </div>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]" type="button">
              Share
            </button>
          </>
        }
      />
      <div className="flex flex-row flex-1 min-h-0 w-full">
        <section className="flex-1 h-full min-w-0 relative border border-border overflow-hidden bg-[#0d0e12]">
          <ViewportWrapper />
          <ViewportSettings />
          <ViewportToolbar />
        </section>

        <aside className="flex flex-col flex-none w-[min(320px,32vw)] bg-[oklch(14.5%_0.014_255_/_94%)]">
          <div className="flex items-center justify-between p-[12px_16px] bg-[oklch(12%_0.014_255)] border-b border-border text-muted text-xs font-semibold tracking-wider uppercase">
            Models List
            <Icon name="EXPAND" size={14} />
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-1">
            {modelFiles.map((file) => (
              <div className="flex items-center gap-2 py-1.5 px-2 rounded-radius-sm text-fg cursor-pointer text-[13px] hover:bg-[oklch(20%_0.02_255)] hover:text-accent-2 transition-all duration-120" key={file.name}>
                <Icon name={file.loaded ? "CHECK" : "MODEL"} size={14} />
                {file.name}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between p-[12px_16px] bg-[oklch(12%_0.014_255)] border-b border-t border-border text-muted text-xs font-semibold tracking-wider uppercase">
            Item Properties
            <Icon name="EXPAND" size={14} />
          </div>
          <div className="p-4 bg-[oklch(12.5%_0.012_255_/_40%)] min-h-[120px]">
            <p className="text-muted text-xs leading-relaxed">Select an item in the viewport to view detailed BIM metadata.</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
