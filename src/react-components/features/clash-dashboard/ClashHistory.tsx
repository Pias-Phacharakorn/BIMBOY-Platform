import { useClashReports } from "./useClashViewpoints";
import { format } from "date-fns";

interface ClashHistoryProps {
  projectId: string;
}

export function ClashHistory({ projectId }: ClashHistoryProps) {
  const { data: reports = [], isLoading } = useClashReports(projectId);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h3 className="text-muted text-sm font-bold tracking-wider uppercase mb-1">
          Coordination History Logs
        </h3>
        <p className="text-xs text-muted leading-relaxed">
          Chronological record of Navisworks add-in data push events and import batches.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted text-sm py-4">
          <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
          <span>Loading coordination logs...</span>
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <div className="text-muted text-sm py-4 border border-dashed border-border rounded p-6 text-center">
          No coordination history records found.
        </div>
      )}

      <div className="relative border-l border-border pl-6 flex flex-col gap-6">
        {!isLoading &&
          reports.map((report) => (
            <div className="relative" key={report.id}>
              {/* Timeline marker */}
              <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-bg shadow-[0_0_0_4px_rgba(116,193,212,0.15)]" />
              
              <div className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius p-4 hover:border-border-strong transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-fg">{report.name}</h4>
                    <p className="text-xs text-muted mt-1 leading-normal">
                      Imported via <span className="text-fg/80 font-medium font-mono">{report.sourceFormat}</span> by{" "}
                      <span className="text-fg/80 font-medium">Project Administrator</span>.
                    </p>
                  </div>
                  <span className="text-xs text-muted font-mono whitespace-nowrap">
                    {format(new Date(report.importedAt), "yyyy-MM-dd HH:mm")}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-3 mt-4 pt-3 border-t border-border/40 text-center">
                  <div>
                    <div className="text-muted text-[10px] uppercase font-bold tracking-wider">Total</div>
                    <div className="font-mono text-sm font-semibold mt-0.5">{report.totalCount}</div>
                  </div>
                  <div>
                    <div className="text-status-danger text-[10px] uppercase font-bold tracking-wider">Major</div>
                    <div className="font-mono text-sm font-semibold mt-0.5 text-status-danger">{report.majorCount}</div>
                  </div>
                  <div>
                    <div className="text-muted text-[10px] uppercase font-bold tracking-wider">Minor</div>
                    <div className="font-mono text-sm font-semibold mt-0.5 text-fg/80">{report.minorCount}</div>
                  </div>
                  <div>
                    <div className="text-status-warn text-[10px] uppercase font-bold tracking-wider">Regulation</div>
                    <div className="font-mono text-sm font-semibold mt-0.5 text-status-warn">{report.regulationCount}</div>
                  </div>
                  <div>
                    <div className="text-status-ok text-[10px] uppercase font-bold tracking-wider">Resolved</div>
                    <div className="font-mono text-sm font-semibold mt-0.5 text-status-ok">{report.resolvedCount}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
