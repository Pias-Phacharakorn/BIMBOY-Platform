import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { documentRecords, documentStats, getProjectById } from "@/static-data";

const approvalClass = {
  Approved: "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok",
  Pending: "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn",
  "In Review": "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn",
};

export function DocumentsView() {
  const { projectId } = useParams({ strict: false });
  const project = getProjectById(projectId);

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="Document Status"
        tabs={["Tracking", "Approvals", "Revisions", "Sources"]}
        activeTab="Tracking"
        actions={
          <>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120" type="button">
              Sync Drive
            </button>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]" type="button">
              Upload Doc
            </button>
          </>
        }
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
