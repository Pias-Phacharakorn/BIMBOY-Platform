import { useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { useProject, useIsProjectAdmin } from "@/react-components/features/projects/useProjects";
import { useClashViewpoints } from "@/react-components/features/clash-dashboard/useClashViewpoints";
import { useAuth } from "@/react-components/features/auth/useAuth";
import type { BadgeTone, StatItem, ClashRecord, ClashItem } from "@/types";

const severityClass: Record<BadgeTone, string> = {
  ok: "bg-status-ok text-[oklch(70%_0.14_150_/_18%)]",
  warn: "bg-status-warn text-[oklch(77%_0.14_76_/_18%)]",
  danger: "bg-status-danger text-[oklch(63%_0.18_28_/_18%)]",
  neutral: "bg-muted text-[oklch(68%_0.02_250_/_18%)]",
};

const statusLabelMap: Record<ClashItem["status"], string> = {
  new: "New",
  unresolved: "Unresolved",
  resolved: "Resolved",
  approved_as_note: "Approved as Note",
};

const statusToneMap: Record<ClashItem["status"], Extract<BadgeTone, "ok" | "warn">> = {
  new: "warn",
  unresolved: "warn",
  resolved: "ok",
  approved_as_note: "ok",
};

const typeLabelMap: Record<ClashItem["type"], string> = {
  major: "Major",
  minor: "Minor",
  regulation: "Regulation",
};

const typeToneMap: Record<ClashItem["type"], BadgeTone> = {
  major: "danger",
  minor: "neutral",
  regulation: "warn",
};

function mapClashItemToRecord(item: ClashItem): ClashRecord {
  return {
    id: item.guid.slice(0, 8),
    status: statusLabelMap[item.status],
    statusTone: statusToneMap[item.status],
    severity: typeLabelMap[item.type],
    severityTone: typeToneMap[item.type],
    disciplines: item.path || "(root)",
    assignedTo: "-",
    dateFound: format(new Date(item.occurredAt), "yyyy-MM-dd"),
  };
}

export function ClashView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading } = useProject(projectId);
  const { data: clashItems = [], isLoading: isLoadingClashes } = useClashViewpoints(project?.id);
  const { user, profile } = useAuth();
  const showSettings = useIsProjectAdmin(project?.id, user?.id, profile?.hub_role === "hub_admin");

  const clashRecords = useMemo(() => clashItems.map(mapClashItemToRecord), [clashItems]);

  const clashStats: StatItem[] = useMemo(() => {
    const total = clashItems.length;
    const active = clashItems.filter((c) => c.status === "new" || c.status === "unresolved").length;
    const major = clashItems.filter((c) => c.type === "major").length;
    return [
      { label: "Total Clashes", value: total.toLocaleString() },
      { label: "Active / Unresolved", value: active.toLocaleString(), tone: "danger" },
      { label: "Major Severity", value: major.toLocaleString() },
      { label: "Import Batches", value: new Set(clashItems.map((c) => c.reportId)).size.toLocaleString() },
    ];
  }, [clashItems]);

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
        title="Clash Detection"
        tabs={["Dashboard", "Clash Reports", "Matrix", "History"]}
        activeTab="Dashboard"
        actions={
          <>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120" type="button">
              Export CSV
            </button>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]" type="button">
              Run Test
            </button>
          </>
        }
      />
      <div className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="grid grid-cols-4 gap-6 p-6 border-b border-border bg-[#090a0f]">
          {clashStats.map((stat) => (
            <div className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4" key={stat.label}>
              <div className="text-muted text-[11px] font-bold tracking-wider uppercase">{stat.label}</div>
              <div className={`font-mono text-2xl font-semibold mt-1 ${
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

        <div className="flex min-h-[calc(100%-130px)]">
          <section className="flex-1 min-w-0 overflow-auto p-6">
            <h3 className="text-muted text-sm font-bold tracking-wider uppercase mb-4">Clash Report</h3>
            <table className="w-full border-collapse text-fg text-[13px]">
              <thead>
                <tr className="border-b border-border-strong">
                  <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">ID</th>
                  <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Status</th>
                  <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Severity</th>
                  <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Path</th>
                  <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Assigned To</th>
                  <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Date Found</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingClashes && (
                  <tr>
                    <td className="px-4 py-3 text-muted text-sm" colSpan={6}>Loading clashes...</td>
                  </tr>
                )}
                {!isLoadingClashes && clashRecords.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-muted text-sm" colSpan={6}>No clashes have been pushed for this project yet.</td>
                  </tr>
                )}
                {clashRecords.map((record) => (
                  <tr className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120" key={record.id}>
                    <td className="px-4 py-3 border-b border-border font-mono text-sm">{record.id}</td>
                    <td className="px-4 py-3 border-b border-border">
                      <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        record.statusTone === "ok"
                          ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                          : record.statusTone === "warn"
                          ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                          : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                      }`}>{record.status}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-border">
                      <span className={`inline-block w-2 h-2 mr-1.5 rounded-full shadow-[0_0_0_3px_currentColor] ${severityClass[record.severityTone]}`} />
                      {record.severity}
                    </td>
                    <td className="px-4 py-3 border-b border-border text-fg">{record.disciplines}</td>
                    <td className="px-4 py-3 border-b border-border text-fg">{record.assignedTo}</td>
                    <td className="px-4 py-3 border-b border-border font-mono text-sm">{record.dateFound}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="w-[280px] p-5 border-l border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col gap-6">
            <div className="flex items-center justify-center h-[180px] border border-border rounded-radius-sm text-muted text-[11px] font-mono select-none bg-[radial-gradient(circle_at_28%_22%,oklch(66%_0.17_252_/_18%),transparent_32%),_linear-gradient(135deg,oklch(21%_0.05_252),oklch(9%_0.014_255)_64%)]">
              CLASH PREVIEW
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-muted text-[11px] font-bold tracking-wider uppercase mb-1">Quick Filters</div>
              <label className="flex items-center gap-2 text-[13px] text-fg cursor-pointer select-none">
                <input className="rounded border-border accent-accent cursor-pointer" type="checkbox" defaultChecked />
                Only Critical
              </label>
              <label className="flex items-center gap-2 text-[13px] text-fg cursor-pointer select-none">
                <input className="rounded border-border accent-accent cursor-pointer" type="checkbox" />
                Unassigned
              </label>
              <label className="flex items-center gap-2 text-[13px] text-fg cursor-pointer select-none">
                <input className="rounded border-border accent-accent cursor-pointer" type="checkbox" />
                ARC vs MEP
              </label>
            </div>
            <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 w-full" type="button">
              Apply Filters
            </button>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
