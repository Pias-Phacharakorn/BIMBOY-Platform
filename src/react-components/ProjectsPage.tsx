import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { ProjectCard } from "./ProjectCard";
import { SearchBox } from "./SearchBox";
import { projects, type ProjectView } from "../static-data";

export function ProjectsPage() {
  const [view, setView] = useState<ProjectView>("card");
  const [query, setQuery] = useState("");

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) => {
      return [
        project.projectName,
        project.description,
        project.display.code,
        project.display.label,
        project.display.statusLabel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [query]);

  return (
    <div className="app-container projects-app">
      <header className="header projects-header">
        <div className="logo">
          <div className="logo-box" />
          LearnThatOpen
        </div>
        <SearchBox value={query} onChange={setQuery} />
        <div className="projects-header-actions">
          <div className="view-toggle" aria-label="Project view">
            <button
              className={`toggle-btn ${view === "card" ? "active" : ""}`}
              title="Card View"
              type="button"
              onClick={() => setView("card")}
            >
              <Icon name="LAYOUT" size={14} />
            </button>
            <button
              className={`toggle-btn ${view === "list" ? "active" : ""}`}
              title="List View"
              type="button"
              onClick={() => setView("list")}
            >
              <Icon name="TASK" size={14} />
            </button>
          </div>
          <button className="btn" type="button">
            Import
          </button>
          <button className="btn btn-primary" type="button">
            New Project
          </button>
        </div>
      </header>

      <main className="workspace-area projects-workspace">
        <div className="projects-intro">
          <h1>Projects</h1>
          <p>Select a BIM workspace to begin engineering operations.</p>
        </div>

        <div className={`list-view-header ${view === "list" ? "show" : ""}`}>
          <div className="list-heading-title">Project Name</div>
          <div>projectNumber</div>
          <div>Status</div>
          <div>Startdate</div>
          <div>Finishdate</div>
          <div>Progress%</div>
        </div>

        <div className={`project-grid ${view === "list" ? "list-view" : ""}`}>
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </main>
    </div>
  );
}
