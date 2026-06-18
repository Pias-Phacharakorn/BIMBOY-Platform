import { useParams } from "react-router-dom";
import { AppShell } from "./AppShell";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { getProjectById, projectMembers } from "../static-data";

export function ProjectSettingsPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="Project Settings"
        actions={
          <button className="btn btn-primary" type="button">
            Save Changes
          </button>
        }
      />
      <div className="workspace-area">
        <div className="settings-grid">
          <section className="settings-section">
            <h2>General Information</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="project-name">
                Project Name
              </label>
              <input id="project-name" className="form-input" type="text" value={project.projectName} readOnly />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="project-number">
                Project Number
              </label>
              <input id="project-number" className="form-input" type="text" value={project.display.label} readOnly />
            </div>
          </section>

          <section className="settings-section">
            <h2>Members & Permissions</h2>
            <table className="tech-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projectMembers.map((member) => (
                  <tr key={member.email}>
                    <td>{member.email}</td>
                    <td>
                      <span className={`status-chip ${member.role === "Admin" ? "ok" : ""}`}>{member.role}</span>
                    </td>
                    <td>{member.status}</td>
                    <td className="align-right">
                      <button className="btn btn-ghost" type="button">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn fit-content" type="button">
              Invite Member
            </button>
          </section>

          <section className="settings-section">
            <h2>Data Connections</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="sheets-url">
                Google Sheets URL (BIM Data)
              </label>
              <input
                id="sheets-url"
                className="form-input"
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                readOnly
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cde-storage">
                CDE Storage (Google Drive)
              </label>
              <div className="inline-field-row">
                <input
                  id="cde-storage"
                  className="form-input"
                  type="text"
                  value="Connected: Site_Drives/Project_HXP_II"
                  readOnly
                />
                <button className="btn" type="button">
                  Change
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
