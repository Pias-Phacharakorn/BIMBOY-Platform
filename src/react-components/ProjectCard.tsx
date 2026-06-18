import { Link } from "react-router-dom";
import type { AppProject } from "../static-data";

interface ProjectCardProps {
  project: AppProject;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { display } = project;

  return (
    <Link className="project-card" to={`/projects/${project.id}/model`}>
      <div
        className="project-card-image"
        style={{
          backgroundImage: `linear-gradient(135deg, oklch(18% 0 0 / 18%), oklch(12% 0 0 / 28%)), url(${display.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "overlay",
        }}
      >
        <div className="project-image-code">{display.code}</div>
      </div>
      <div className="project-card-content">
        <div className="project-title-section">
          <h3 className="project-title">{project.projectName}</h3>
          <div className="project-meta">
            <span className="mono">{display.label}</span>
            <span>Est. Completion: {display.estimatedCompletion}</span>
          </div>
        </div>

        <div className="column-data mono">{display.label}</div>

        <div className="status-container">
          <span className={`status-chip ${display.statusTone}`}>{display.statusLabel}</span>
        </div>

        <div className="column-data mono">{display.startDateLabel}</div>
        <div className="column-data mono">{display.finishDateLabel}</div>

        <div className="progress-section">
          <div className="progress-info">
            <span className="card-only">Progress</span>
            <span className="mono">{display.progress}%</span>
          </div>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${display.progress}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
