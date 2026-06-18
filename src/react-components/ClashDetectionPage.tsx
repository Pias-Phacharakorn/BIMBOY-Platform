import { useParams } from "react-router-dom";
import { AppShell } from "./AppShell";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { getProjectById, clashRecords, clashStats, type BadgeTone } from "../static-data";

const severityClass: Record<BadgeTone, string> = {
  ok: "severity-ok",
  warn: "severity-warn",
  danger: "severity-danger",
  neutral: "severity-neutral",
};

export function ClashDetectionPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="Clash Detection"
        tabs={["Dashboard", "Clash Reports", "Matrix", "History"]}
        activeTab="Dashboard"
        actions={
          <>
            <button className="btn" type="button">
              Export CSV
            </button>
            <button className="btn btn-primary" type="button">
              Run Test
            </button>
          </>
        }
      />
      <div className="workspace-area">
        <div className="analytics-header">
          {clashStats.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <div className="stat-label">{stat.label}</div>
              <div className={`stat-value ${stat.tone ? `tone-${stat.tone}` : ""}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="clash-layout">
          <section className="table-panel">
            <h3 className="section-label">Clash Report</h3>
            <table className="tech-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Disciplines</th>
                  <th>Assigned To</th>
                  <th>Date Found</th>
                </tr>
              </thead>
              <tbody>
                {clashRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="mono">{record.id}</td>
                    <td>
                      <span className={`status-chip ${record.statusTone}`}>{record.status}</span>
                    </td>
                    <td>
                      <span className={`severity-dot ${severityClass[record.severityTone]}`} />
                      {record.severity}
                    </td>
                    <td>{record.disciplines}</td>
                    <td>{record.assignedTo}</td>
                    <td className="mono">{record.dateFound}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="filter-pane">
            <div className="clash-preview">
              <span className="mono">CLASH PREVIEW</span>
            </div>
            <div className="filter-block">
              <div className="stat-label">Quick Filters</div>
              <label className="checkbox-row">
                <input type="checkbox" defaultChecked />
                Only Critical
              </label>
              <label className="checkbox-row">
                <input type="checkbox" />
                Unassigned
              </label>
              <label className="checkbox-row">
                <input type="checkbox" />
                ARC vs MEP
              </label>
            </div>
            <button className="btn full-width" type="button">
              Apply Filters
            </button>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
