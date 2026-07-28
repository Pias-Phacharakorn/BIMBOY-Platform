import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useAuth } from "@/react-components/features/auth/useAuth";
import type { StatItem, DocumentRecord } from "@/types";

const approvalClass = {
  Approved: "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok",
  Pending: "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn",
  "In Review": "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn",
};

const documentStats: StatItem[] = [
  { label: "Approved", value: "142", tone: "ok" },
  { label: "Pending Review", value: "28", tone: "warn" },
  { label: "Rejected / Revise", value: "5", tone: "danger" },
  { label: "Overdue", value: "12", tone: "danger" },
];

const documentRecords: DocumentRecord[] = [
  {
    drawingNumber: "A-101-PL",
    title: "Level 01 Floor Plan",
    revision: "04",
    status: "Approved",
    owner: "Architect",
    dueDate: "2024-06-01",
  },
  {
    drawingNumber: "S-205-DT",
    title: "Foundation Detail B",
    revision: "02",
    status: "Pending",
    owner: "Engineer",
    dueDate: "2024-05-10",
    overdue: true,
  },
  {
    drawingNumber: "M-401-SC",
    title: "HVAC Schematic",
    revision: "01",
    status: "In Review",
    owner: "MEP Lead",
    dueDate: "2024-05-20",
  },
];

export function DocumentsView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { user, profile } = useAuth();
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");

  if (isLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading project...</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="text-center p-6 border border-border bg-surface rounded-radius max-w-md">
          <h2 className="text-lg font-bold mb-2">Project Not Found</h2>
        </div>
      </div>
    );
  }

  return (
    <AppShell project={project} showSettings={showSettings}>
      <WorkspaceHeader
        title="Document Status"
        tabs={["Tracking", "Approvals", "Revisions", "Sources"]}
        activeTab="Tracking"
      />
      <div className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="flex gap-5 p-6 bg-[#090a0f] border-b border-border">
          {documentStats.map((stat) => (
            <div className="flex-1 flex flex-col gap-1 p-4 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius" key={stat.label}>
              <span className="text-muted text-[10px] uppercase font-bold tracking-wider">{stat.label}</span>
              <div className={`text-xl font-semibold mt-1 ${
                stat.tone === "ok"
                  ? "text-status-ok"
                  : stat.tone === "warn"
                  ? "text-status-warn"
                  : stat.tone === "danger"
                  ? "text-status-danger"
                  : "text-fg"
              }`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <section className="flex-1 min-w-0 overflow-auto p-6">
          <table className="w-full border-collapse text-fg text-[13px]">
            <thead>
              <tr className="border-b border-border-strong">
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Drawing Number</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Title</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Rev</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Status</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Owner</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {documentRecords.map((document) => (
                <tr className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120" key={document.drawingNumber}>
                  <td className="px-4 py-3 border-b border-border font-mono text-sm">{document.drawingNumber}</td>
                  <td className="px-4 py-3 border-b border-border text-fg">{document.title}</td>
                  <td className="px-4 py-3 border-b border-border font-mono text-sm">{document.revision}</td>
                  <td className="px-4 py-3 border-b border-border">
                    <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                      approvalClass[document.status] || "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                    }`}>{document.status}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-border text-fg">{document.owner}</td>
                  <td className={`px-4 py-3 border-b border-border font-mono text-sm ${
                    document.overdue ? "text-status-danger" : "text-fg"
                  }`}>{document.dueDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
