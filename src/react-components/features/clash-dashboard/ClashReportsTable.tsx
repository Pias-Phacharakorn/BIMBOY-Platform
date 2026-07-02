import { useClashReports } from "./useClashViewpoints";
import { useClashStore } from "@/react-components/store/clashStore";
import { format } from "date-fns";

interface ClashReportsTableProps {
  projectId: string;
}

export function ClashReportsTable({ projectId }: ClashReportsTableProps) {
  const { data: reports = [], isLoading } = useClashReports(projectId);
  const { setSelectedReportId, setActiveTab } = useClashStore();

  const handleSelectReport = (reportId: string) => {
    setSelectedReportId(reportId);
    setActiveTab("Dashboard");
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-muted text-sm font-bold tracking-wider uppercase">
          Import Batches ({reports.length})
        </h3>
      </div>

      <table className="w-full border-collapse text-fg text-[13px]">
        <thead>
          <tr className="border-b border-border-strong">
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Name</th>
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Format</th>
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Total</th>
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Major</th>
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Minor</th>
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Regulation</th>
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Import Date</th>
            <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td className="px-4 py-8 text-muted text-sm text-center" colSpan={8}>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
                  <span>Loading batches...</span>
                </div>
              </td>
            </tr>
          )}
          {!isLoading && reports.length === 0 && (
            <tr>
              <td className="px-4 py-8 text-muted text-sm text-center" colSpan={8}>
                No import batches found for this project.
              </td>
            </tr>
          )}
          {!isLoading &&
            reports.map((report) => (
              <tr className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120 border-b border-border/60" key={report.id}>
                <td className="px-4 py-3 font-semibold text-fg">{report.name}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center min-h-5 px-2 py-0.5 border border-border rounded-full text-[10px] font-bold tracking-wider uppercase bg-[oklch(18%_0.02_255)] text-muted">
                    {report.sourceFormat}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold">{report.totalCount}</td>
                <td className="px-4 py-3 font-mono text-status-danger">{report.majorCount}</td>
                <td className="px-4 py-3 font-mono text-muted">{report.minorCount}</td>
                <td className="px-4 py-3 font-mono text-status-warn">{report.regulationCount}</td>
                <td className="px-4 py-3 font-mono text-sm">
                  {format(new Date(report.importedAt), "yyyy-MM-dd HH:mm")}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleSelectReport(report.id)}
                    className="inline-flex items-center justify-center min-h-7 px-3 border border-border-strong rounded bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-accent hover:text-accent transition-all"
                    type="button"
                  >
                    View Clashes
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
