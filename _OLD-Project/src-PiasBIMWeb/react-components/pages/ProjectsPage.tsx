import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ProjectCard } from "../components/ProjectCard";
import { SearchBox } from "../components/SearchBox";
import { projectsManager } from "../../classes/ProjectsManager";
import { useAuth } from "../../context/AuthContext";
import { UserAccountDropdown } from "../components/UserAccountDropdown";
import { useUIStore } from "../store/uiStore";

import { getAppProject, type ProjectView, type AppProject, type IProject } from "../../classes/Project";
import { ProjectMap } from "../components/ProjectMap";

export function ProjectsPage() {
  const [view, setView] = useState<ProjectView>("card");
  const [query, setQuery] = useState("");
  const [localProjects, setLocalProjects] = useState<AppProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Project Modal Form States
  const isModalOpen = useUIStore((state) => state.isProjectModalOpen);
  const setIsProjectModalOpen = useUIStore((state) => state.setIsProjectModalOpen);
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "bidding" | "finished">("active");

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getOneMonthLaterString = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [startDate, setStartDate] = useState(getTodayString());
  const [finishDate, setFinishDate] = useState(getOneMonthLaterString());
  const [latitude, setLatitude] = useState("51.5005");
  const [longitude, setLongitude] = useState("-0.127");
  const [error, setError] = useState("");

  const { user, logoutUser, projectRoles, isHubAdmin } = useAuth();

  const resetForm = () => {
    setProjectName("");
    setProjectNumber("");
    setDescription("");
    setStatus("active");
    setStartDate(getTodayString());
    setFinishDate(getOneMonthLaterString());
    setLatitude("51.5005");
    setLongitude("-0.127");
    setError("");
  };

  const handleOpenModal = () => {
    resetForm();
    setIsProjectModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate 4-digit number
    const numValue = Number(projectNumber);
    if (isNaN(numValue) || numValue < 1000 || numValue > 9999 || !Number.isInteger(numValue)) {
      setError("Project number must be a 4-digit number (between 1000 and 9999).");
      return;
    }

    // Validate uniqueness
    const numberExists = localProjects.some(p => p.projectnumber === numValue);
    if (numberExists) {
      setError(`Project number ${projectNumber} is already taken by another project.`);
      return;
    }

    // Validate dates
    const start = new Date(startDate);
    const finish = new Date(finishDate);
    if (finish < start) {
      setError("Finish date cannot be earlier than the start date.");
      return;
    }

    try {
      const creatorEmail = user?.email || "";
      const creatorEmailClean = creatorEmail.trim().toLowerCase();
      const lat = parseFloat(latitude) || 51.5005;
      const lng = parseFloat(longitude) || -0.127;
      await projectsManager.newProject({
        projectName,
        projectnumber: numValue,
        description,
        status,
        startDate: start,
        finishDate: finish,
        userRoles: creatorEmailClean ? { [creatorEmailClean]: "project admin" } : {},
        location: {
          latitude: lat,
          longitude: lng,
          rotation: 93,
          elevation: 61.3
        },
        bimFiles: {
          ifcFolderPath: "",
          fragFolderPath: "",
          hasModel: false
        }
      });

      setIsProjectModalOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to create project. Please try again.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    console.log("ProjectsPage mounted, initializing projects state...");
    
    const updateProjects = () => {
      if (!isMounted) return;
      const apps = projectsManager.list.map(p => getAppProject(p));
      console.log(`ProjectsPage: Received update from manager. Setting ${apps.length} projects in state.`);
      setLocalProjects(apps);
      setIsLoading(false);
    };

    // Subscribe to manager events
    const unsubLoaded = projectsManager.onProjectsLoaded(updateProjects);
    const unsubCreated = projectsManager.onProjectCreated(updateProjects);
    const unsubDeleted = projectsManager.onProjectDeleted(updateProjects);

    // Run initial sync in case data loaded before the component mounted
    updateProjects();

    return () => {
      isMounted = false;
      unsubLoaded();
      unsubCreated();
      unsubDeleted();
    };
  }, []);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return localProjects;
    }

    return localProjects.filter((project) => {
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
  }, [query, localProjects]);


  const isAnyProjectAdmin = Object.values(projectRoles).includes("project_admin");

  if (isLoading) {
    return (
      <div className="app-container projects-app" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ color: "var(--accent)" }}>Connecting to Firestore...</p>
      </div>
    );
  }

  return (
    <div className="app-container projects-app">
      <header className="header projects-header">
        <div className="logo" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="logo-box" />
            PiasBimWeb
          </div>
          {isHubAdmin && (
            <Link 
              to="/hub-settings" 
              className="btn btn-ghost" 
              title="Hub Administration (Hub Admin)"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "6px 12px",
                marginLeft: "4px",
                color: "var(--accent)",
                background: "oklch(66% 0.17 252 / 8%)",
                border: "1px solid oklch(66% 0.17 252 / 30%)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600"
              }}
            >
              <Icon name="SETTINGS" size={14} />
              <span>Hub Settings</span>
            </Link>
          )}
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
              <Icon name="LIST" size={14} />
            </button>
            <button
              className={`toggle-btn ${view === "map" ? "active" : ""}`}
              title="Map View"
              type="button"
              onClick={() => setView("map")}
            >
              <Icon name="COORDINATE" size={14} />
            </button>
          </div>
          {isHubAdmin && (
            <>
              <button className="btn" type="button" onClick={() => projectsManager.exportToJSON()}>
                Export
              </button>
              <button className="btn btn-primary" type="button" onClick={handleOpenModal}>
                New Project
              </button>
              <div style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" }} />
            </>
          )}


          <UserAccountDropdown />
        </div>
      </header>


      <main className="workspace-area projects-workspace">
        {localProjects.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", flexDirection: "column", gap: "10px", width: "100%", textAlign: "center" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "600", color: "var(--fg)" }}>No project that you are in</h1>
            <p style={{ color: "var(--muted)", fontSize: "14px" }}>Please contact BIM admin to add you to a project / connect BIM CENTER.</p>
          </div>
        ) : (
          <>
            <div className="projects-intro">
              <h1>Projects</h1>
              <p>Select a BIM workspace to begin engineering operations.</p>
            </div>

            {view === "map" ? (
              <ProjectMap projects={filteredProjects} />
            ) : (
              <>
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
              </>
            )}
          </>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button className="modal-close-btn" type="button" onClick={() => setIsProjectModalOpen(false)}>
                <Icon name="CLOSE" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="modal-error-banner">
                    <Icon name="WARNING" size={14} />
                    <span>{error}</span>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="projectName">Project Name *</label>
                    <input
                      id="projectName"
                      className="form-control"
                      type="text"
                      required
                      placeholder="e.g. Hospital Wing"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="projectNumber">Project Number (4 digits) *</label>
                    <input
                      id="projectNumber"
                      className="form-control"
                      type="number"
                      required
                      min="1000"
                      max="9999"
                      placeholder="e.g. 2510"
                      value={projectNumber}
                      onChange={(e) => setProjectNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    className="form-control"
                    placeholder="Short description of the engineering workspace..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    className="form-control"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "bidding" | "active" | "finished")}
                  >
                    <option value="bidding">Bidding</option>
                    <option value="active">Active</option>
                    <option value="finished">Finished</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="startDate">Start Date *</label>
                    <input
                      id="startDate"
                      className="form-control"
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="finishDate">Finish Date *</label>
                    <input
                      id="finishDate"
                      className="form-control"
                      type="date"
                      required
                      value={finishDate}
                      onChange={(e) => setFinishDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="latitude">Latitude (Location)</label>
                    <input
                      id="latitude"
                      className="form-control"
                      type="number"
                      step="any"
                      placeholder="e.g. 51.5005"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="longitude">Longitude (Location)</label>
                    <input
                      id="longitude"
                      className="form-control"
                      type="number"
                      step="any"
                      placeholder="e.g. -0.127"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
