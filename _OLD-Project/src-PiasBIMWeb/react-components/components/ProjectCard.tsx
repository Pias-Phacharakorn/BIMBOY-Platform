import { Link } from "react-router-dom";
import type { AppProject } from "../../classes/Project";
import { Icon } from "./Icon";

interface ProjectCardProps {
  project: AppProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { display } = project;

  const calculateProgress = () => {
    const today = new Date();
    const start = new Date(project.startDate);
    const finish = new Date(project.finishDate);
    const total = finish.getTime() - start.getTime();
    if (total <= 0) return "0.00";
    const progress = ((today.getTime() - start.getTime()) / total) * 100;
    return Math.min(Math.max(progress, 0), 100).toFixed(2);
  };

  const formatDate = (date: Date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "N/A";
    const dd = date.getDate().toString().padStart(2, "0");
    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const calculatedProgressValue = calculateProgress();

  return (
    <Link className="project-card" to={`/projects/${project.id}/model`}>
      <style>{`
        .project-card-list-only {
          display: none !important;
        }
        .project-grid.list-view .project-card-list-only {
          display: contents !important;
        }
        .project-card-properties {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 4px;
          width: 100%;
        }
        .project-grid.list-view .project-card-properties {
          display: none !important;
        }
      `}</style>
      <div className="project-card-image">
        <div className="project-image-name">{project.projectName}</div>
      </div>
      <div className="project-card-content">
        <div className="project-title-section">
          <div className="project-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "4px" }}>
            <h3 className="project-title" style={{ margin: 0 }}>{project.projectnumber}_{project.projectName}</h3>
            <span className={`status-chip ${display.statusTone} card-only`} style={{ flexShrink: 0 }}>{display.statusLabel}</span>
          </div>
          <div className="project-meta">
            {project.description || "No description provided."}
          </div>
        </div>

        {/* List-view columns (restored to original code, completely hidden in card-view) */}
        <div className="project-card-list-only">
          <div className="column-data mono">{display.label}</div>

          <div className="status-container">
            <span className={`status-chip ${display.statusTone}`}>{display.statusLabel}</span>
          </div>

          <div className="column-data mono">{display.startDateLabel}</div>
          <div className="column-data mono">{display.finishDateLabel}</div>

          <div className="progress-section">
            <div className="progress-info">
              <span className="card-only">Progress</span>
              <span className="mono">{calculatedProgressValue}%</span>
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${calculatedProgressValue}%` }} />
            </div>
          </div>
        </div>

        {/* Card-view properties list (hidden in list-view) */}
        <div className="project-card-properties">
          <div className="card-property" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "12px" }}>
              <Icon name="STARTDATE" size={16} />
              <span>Start Date</span>
            </div>
            <span style={{ color: "var(--fg)", fontSize: "12px", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
              {formatDate(project.startDate)}
            </span>
          </div>

          <div className="card-property" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "12px" }}>
              <Icon name="FINISHDATE" size={16} />
              <span>Finish Date</span>
            </div>
            <span style={{ color: "var(--fg)", fontSize: "12px", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
              {formatDate(project.finishDate)}
            </span>
          </div>

          <div className="card-property" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "12px" }}>
              <Icon name="PROGRESS" size={16} />
              <span>Estimated Progress</span>
            </div>
            <div style={{ 
              width: "120px", 
              height: "18px", 
              backgroundColor: "oklch(20% 0.015 255)", 
              border: "1px solid var(--border)", 
              borderRadius: "9999px", 
              overflow: "hidden", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "flex-end" 
            }}>
              <div style={{ 
                width: `${calculatedProgressValue}%`, 
                height: "100%", 
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "flex-end", 
                paddingRight: "8px", 
                transition: "width 0.3s ease" 
              }}>
                <span style={{ fontSize: "10px", fontWeight: "700", color: "#ffffff", whiteSpace: "nowrap" }}>
                  {calculatedProgressValue}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
