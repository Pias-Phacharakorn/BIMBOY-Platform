import { useParams } from "react-router-dom";
import { AppShell } from "./AppShell";
import { Icon } from "./Icon";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { getProjectById, modelFiles, workspaceTabs } from "../static-data";

export function ProjectDetailsPage() {
  const { projectId } = useParams();
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
        <section className="viewport-container" aria-label="BIM model viewport placeholder">
          
          <div className="absolute top-5 left-5 z-20 flex flex-col gap-3">
            <div className="flex flex-col gap-1 p-1 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius backdrop-blur-md">
              <button className="inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" title="Top View" type="button">
                <Icon name="MODEL" size={20} />
              </button>
              <button className="inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" title="Perspective" type="button">
                <Icon name="FOCUS" size={20} />
              </button>
            </div>
          </div>

          <div className="absolute inset-0 grid place-content-center gap-2.5 p-6 text-muted text-center pointer-events-none">
            <div className="font-mono text-[clamp(36px,8vw,96px)] text-fg opacity-20 select-none font-bold">{project.display.code}</div>
            <p className="text-sm">Visual BIM viewport shell. ThatOpen runtime will mount here in a later pass.</p>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-1 p-1.5 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-[14px] backdrop-blur-md">
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" title="Select" type="button">
              <Icon name="SELECT" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" title="Measure" type="button">
              <Icon name="RULER" />
            </button>
            <div className="w-[1px] my-1 bg-border" />
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" title="Clip" type="button">
              <Icon name="CLIPPING" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" title="Isolate" type="button">
              <Icon name="ISOLATE" />
            </button>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120" title="Hide" type="button">
              <Icon name="HIDE" />
            </button>
          </div>
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
