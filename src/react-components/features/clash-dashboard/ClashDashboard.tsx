import { useMemo } from "react";
import { useClashViewpoints, useClashReports } from "./useClashViewpoints";

interface ClashDashboardProps {
  projectId: string;
}

export function ClashDashboard({ projectId }: ClashDashboardProps) {
  const { data: clashItems = [] } = useClashViewpoints(projectId);
  const { data: reports = [] } = useClashReports(projectId);

  const stats = useMemo(() => {
    const total = clashItems.length;
    const active = clashItems.filter((c) => c.status === "new" || c.status === "unresolved").length;
    const major = clashItems.filter((c) => c.type === "major").length;
    const batches = reports.length;

    return [
      { label: "Total Clashes", value: total.toLocaleString() },
      { label: "Active / Unresolved", value: active.toLocaleString(), tone: "danger" },
      { label: "Major Severity", value: major.toLocaleString() },
      { label: "Import Batches", value: batches.toLocaleString() },
    ];
  }, [clashItems, reports]);

  return (
    <div className="grid grid-cols-4 gap-6 p-6 border-b border-border bg-[#090a0f]">
      {stats.map((stat) => (
        <div
          className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4"
          key={stat.label}
        >
          <div className="text-muted text-[11px] font-bold tracking-wider uppercase">{stat.label}</div>
          <div
            className={`font-mono text-2xl font-semibold mt-1 ${
              stat.tone === "danger" ? "text-status-danger" : "text-fg"
            }`}
          >
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
