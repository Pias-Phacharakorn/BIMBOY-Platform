import { useParams } from "react-router-dom";
import { AppShell } from "./AppShell";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { documentRecords, documentStats, getProjectById } from "../static-data";

const approvalClass = {
  Approved: "approved",
  Pending: "pending",
  "In Review": "pending",
};

export function DocumentStatusPage() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="Document Status"
        tabs={["Tracking", "Approvals", "Revisions", "Sources"]}
        activeTab="Tracking"
        actions={
          <>
            <button className="btn" type="button">
              Sync Drive
            </button>
            <button className="btn btn-primary" type="button">
              Upload Doc
            </button>
          </>
        }
      />
      <div className="workspace-area">
        <div className="doc-analytics">
          {documentStats.map((stat) => (
            <div className="doc-stat" key={stat.label}>
              <span>{stat.label}</span>
              <div className={`doc-stat-value tone-${stat.tone}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <section className="table-panel">
          <table className="tech-table">
            <thead>
              <tr>
                <th>Drawing Number</th>
                <th>Title</th>
                <th>Rev</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {documentRecords.map((document) => (
                <tr key={document.drawingNumber}>
                  <td className="mono">{document.drawingNumber}</td>
                  <td>{document.title}</td>
                  <td className="mono">{document.revision}</td>
                  <td>
                    <span className={`approval-badge ${approvalClass[document.status]}`}>{document.status}</span>
                  </td>
                  <td>{document.owner}</td>
                  <td className={`mono ${document.overdue ? "tone-danger" : ""}`}>{document.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
