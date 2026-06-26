import { Link } from "@tanstack/react-router";
import type { AppProject } from "@/types";
import { Icon } from "@/react-components/components/ui";

interface ProjectCardProps {
  project: AppProject;
  view?: "card" | "list";
}

export function ProjectCard({ project, view = "card" }: ProjectCardProps) {
  const { display } = project;

  const calculateProgress = () => {
    const today = new Date();
    const start = new Date(project.startDate);
    const finish = new Date(project.finishDate);
    const total = finish.getTime() - start.getTime();
    if (total <= 0) return "0.00";
    const progress = ((today.getTime() - start.getTime()) / total) * 100;
    return Math.min(Math.max(progress, 0), 100).toFixed(2);
  };

  const formatDate = (date: Date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "N/A";
    const dd = date.getDate().toString().padStart(2, "0");
    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const calculatedProgressValue = calculateProgress();

  if (view === "list") {
    return (
      <Link
        className="grid grid-cols-[80px_2fr_1.2fr_100px_120px_120px_180px] items-center gap-5 px-6 py-3 border-b border-border bg-surface text-fg hover:bg-surface-alt no-underline select-none transition-all duration-150"
        to="/projects/$projectId/model"
        params={{ projectId: project.id }}
      >
        <div className="w-16 h-10 border border-border rounded flex items-center justify-center bg-gradient-to-br from-[oklch(21%_0.05_252)] to-[oklch(9%_0.014_255)_64%]">
          <div className="text-[10px] font-bold text-center px-1 text-transparent bg-gradient-to-br from-fg to-muted bg-clip-text line-clamp-2 leading-tight select-none">
            {project.projectName}
          </div>
        </div>
        <h3 className="text-[14px] font-semibold text-fg text-left truncate">
          {project.projectnumber}_{project.projectName}
        </h3>
        <div className="text-center font-mono text-sm">{display.label}</div>
        <div className="flex justify-center">
          <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
            display.statusTone === "ok"
              ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
              : display.statusTone === "warn"
              ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
              : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
          }`}>
            {display.statusLabel}
          </span>
        </div>
        <div className="text-center font-mono text-sm">{formatDate(project.startDate)}</div>
        <div className="text-center font-mono text-sm">{formatDate(project.finishDate)}</div>
        <div className="flex flex-col gap-1 w-full justify-self-center">
          <span className="font-mono text-[11px] text-center text-muted">{calculatedProgressValue}%</span>
          <div className="h-1 overflow-hidden bg-[oklch(7%_0.012_255)] border border-border rounded-sm w-full">
            <div className="h-full rounded-sm bg-gradient-to-r from-accent to-accent-2" style={{ width: `${calculatedProgressValue}%` }} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      className="block border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_34px_rgba(0,0,0,0.22)] overflow-hidden rounded-radius text-fg no-underline hover:border-[oklch(43%_0.045_252)] hover:shadow-[0_18px_50px_rgba(0,0,0,0.44)] hover:-translate-y-1 transition-all duration-200"
      to="/projects/$projectId/model"
      params={{ projectId: project.id }}
    >
      <div className="flex items-center justify-center h-40 border-b border-border bg-gradient-to-br from-[oklch(21%_0.05_252)] to-[oklch(9%_0.014_255)_64%]">
        <div className="text-[20px] font-bold text-center px-4 tracking-tight leading-snug line-clamp-3 select-none text-transparent bg-gradient-to-br from-fg to-muted bg-clip-text">
          {project.projectName}
        </div>
      </div>
      <div className="p-5 flex flex-col">
        <div className="mb-4">
          <div className="flex justify-between items-start gap-2.5 mb-1">
            <h3 className="text-base font-semibold text-fg leading-snug">
              {project.projectnumber}_{project.projectName}
            </h3>
            <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
              display.statusTone === "ok"
                ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                : display.statusTone === "warn"
                ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
            }`}>
              {display.statusLabel}
            </span>
          </div>
          <div className="text-muted text-xs leading-normal mb-4 line-clamp-2">
            {project.description || "No description provided."}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-1 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-muted text-xs">
              <Icon name="STARTDATE" size={16} />
              <span>Start Date</span>
            </div>
            <span className="text-fg text-xs font-medium font-mono">
              {formatDate(project.startDate)}
            </span>
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-muted text-xs">
              <Icon name="FINISHDATE" size={16} />
              <span>Finish Date</span>
            </div>
            <span className="text-fg text-xs font-medium font-mono">
              {formatDate(project.finishDate)}
            </span>
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-muted text-xs">
              <Icon name="PROGRESS" size={16} />
              <span>Estimated Progress</span>
            </div>
            <div className="w-[120px] h-[18px] bg-[oklch(20%_0.015_255)] border border-border rounded-full overflow-hidden flex items-center justify-end">
              <div
                className="h-full bg-gradient-to-r from-accent to-accent-2 flex items-center justify-end pr-2 transition-all duration-300"
                style={{ width: `${calculatedProgressValue}%` }}
              >
                <span className="text-[10px] font-bold text-[#ffffff] white-space-nowrap">
                  {calculatedProgressValue}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
