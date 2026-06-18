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
            <div className="mode-switcher">
              <Icon name="MODEL" size={14} />
              <span>Default Layout</span>
              <Icon name="RIGHT" size={12} />
            </div>
            <button className="btn btn-primary" type="button">
              Share
            </button>
          </>
        }
      />
      <div className="workspace-area model-workspace">
        <section className="viewport-container model-viewport" aria-label="BIM model viewport placeholder">
          <div className="viewport-controls">
            <div className="control-group">
              <button className="btn btn-ghost icon-btn" title="Top View" type="button">
                <Icon name="MODEL" size={20} />
              </button>
              <button className="btn btn-ghost icon-btn" title="Perspective" type="button">
                <Icon name="FOCUS" size={20} />
              </button>
            </div>
          </div>

          <div className="viewport-empty-state">
            <div className="mono">{project.display.code}</div>
            <p>Visual BIM viewport shell. ThatOpen runtime will mount here in a later pass.</p>
          </div>

          <div className="viewport-toolbar-bottom">
            <button className="btn btn-ghost" title="Select" type="button">
              <Icon name="SELECT" />
            </button>
            <button className="btn btn-ghost" title="Measure" type="button">
              <Icon name="RULER" />
            </button>
            <div className="toolbar-divider" />
            <button className="btn btn-ghost" title="Clip" type="button">
              <Icon name="CLIPPING" />
            </button>
            <button className="btn btn-ghost" title="Isolate" type="button">
              <Icon name="ISOLATE" />
            </button>
            <button className="btn btn-ghost" title="Hide" type="button">
              <Icon name="HIDE" />
            </button>
          </div>
        </section>

        <aside className="side-panel">
          <div className="panel-header">
            Models List
            <Icon name="EXPAND" size={14} />
          </div>
          <div className="panel-content">
            {modelFiles.map((file) => (
              <div className="tree-item" key={file.name}>
                <Icon name={file.loaded ? "CHECK" : "MODEL"} size={14} />
                {file.name}
              </div>
            ))}
          </div>
          <div className="panel-header panel-header-bordered">
            Item Properties
            <Icon name="EXPAND" size={14} />
          </div>
          <div className="panel-content">
            <p className="muted-copy">Select an item in the viewport to view detailed BIM metadata.</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
