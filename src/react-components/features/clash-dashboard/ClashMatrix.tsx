import { useMemo } from "react";
import { useClashViewpoints } from "./useClashViewpoints";
import type { ClashItem } from "@/types";

interface ClashMatrixProps {
  projectId: string;
}

type StatusType = ClashItem["status"];
type SeverityType = ClashItem["type"];

const rows: { key: StatusType; label: string }[] = [
  { key: "new", label: "New" },
  { key: "unresolved", label: "Unresolved" },
  { key: "resolved", label: "Resolved" },
  { key: "approved_as_note", label: "Approved as Note" },
];

const cols: { key: SeverityType; label: string; textClass: string }[] = [
  { key: "major", label: "Major", textClass: "text-status-danger" },
  { key: "minor", label: "Minor", textClass: "text-muted" },
  { key: "regulation", label: "Regulation", textClass: "text-status-warn" },
];

export function ClashMatrix({ projectId }: ClashMatrixProps) {
  const { data: clashItems = [] } = useClashViewpoints(projectId);

  // Compute 2D matrix intersection counts
  const matrixData = useMemo(() => {
    const counts: Record<string, number> = {};

    // Initialize all cells to 0
    rows.forEach((r) => {
      cols.forEach((c) => {
        counts[`${r.key}_${c.key}`] = 0;
      });
    });

    // Populate intersection counts
    clashItems.forEach((item) => {
      const cellKey = `${item.status}_${item.type}`;
      if (counts[cellKey] !== undefined) {
        counts[cellKey]++;
      }
    });

    return counts;
  }, [clashItems]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-muted text-sm font-bold tracking-wider uppercase mb-1">
          Clash Distribution Matrix
        </h3>
        <p className="text-xs text-muted leading-relaxed">
          Cross-tabulation breakdown of coordination status against clash severity.
        </p>
      </div>

      <div className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius overflow-hidden max-w-2xl">
        <div className="grid grid-cols-[160px_1fr_1fr_1fr] border-b border-border bg-bg/40">
          <div className="p-4 text-xs font-bold text-muted uppercase">Status \ Severity</div>
          {cols.map((col) => (
            <div className={`p-4 text-xs font-bold uppercase text-center ${col.textClass}`} key={col.key}>
              {col.label}
            </div>
          ))}
        </div>

        {rows.map((row) => (
          <div className="grid grid-cols-[160px_1fr_1fr_1fr] border-b border-border last:border-b-0 hover:bg-surface-alt/40 transition-colors" key={row.key}>
            <div className="p-4 text-xs font-semibold text-fg/90 border-r border-border/40">{row.label}</div>
            {cols.map((col) => {
              const count = matrixData[`${row.key}_${col.key}`] || 0;
              return (
                <div
                  className={`p-4 font-mono text-base font-medium text-center border-r border-border/40 last:border-r-0 ${
                    count > 0 ? "text-fg" : "text-fg/30"
                  }`}
                  key={col.key}
                >
                  {count}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
