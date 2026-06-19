import { Link } from "@tanstack/react-router";
import type { AppProject } from "../static-data";

interface ProjectCardProps {
  project: AppProject;
  view?: "card" | "list";
}

export function ProjectCard({ project, view = "card" }: ProjectCardProps) {
  const { display } = project;

  const getCardBgStyle = () => {
    if (project.id === "hxp-ii") {
      return {
        backgroundImage: `url(${display.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    } else if (project.id === "dtc-n") {
      return {
        backgroundImage: `linear-gradient(135deg, oklch(18% 0 0), oklch(14% 0 0)), url(${display.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "overlay" as const,
      };
    } else {
      return {
        backgroundImage: `linear-gradient(135deg, oklch(22% 0 0), oklch(12% 0 0)), url(${display.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "overlay" as const,
      };
    }
  };

  if (view === "list") {
    return (
      <Link
        className="grid grid-cols-[80px_2fr_1.2fr_100px_120px_120px_180px] items-center gap-5 px-6 py-3 border-b border-border bg-surface text-fg hover:bg-surface-alt no-underline select-none transition-all duration-150"
        to="/projects/$projectId/model"
        params={{ projectId: project.id }}
      >
        <div
          className="w-16 h-10 border border-border rounded flex items-center justify-center bg-gradient-to-br from-[oklch(21%_0.05_252)] to-[oklch(9%_0.014_255)_64%]"
          style={getCardBgStyle()}
        />
        <h3 className="text-[14px] font-semibold text-fg text-left truncate">{project.projectName}</h3>
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
        <div className="text-center font-mono text-sm">{display.startDateLabel}</div>
        <div className="text-center font-mono text-sm">{display.finishDateLabel}</div>
        <div className="flex flex-col gap-1 w-full justify-self-center">
          <span className="font-mono text-[11px] text-center text-muted">{display.progress}%</span>
          <div className="h-1 overflow-hidden bg-[oklch(7%_0.012_255)] border border-border rounded-sm w-full">
            <div className="h-full rounded-sm bg-gradient-to-r from-accent to-accent-2" style={{ width: `${display.progress}%` }} />
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
      <div
        className="flex items-center justify-center h-40 border-b border-border bg-gradient-to-br from-[oklch(21%_0.05_252)] to-[oklch(9%_0.014_255)_64%]"
        style={getCardBgStyle()}
      >
        <div className="font-mono text-5xl font-medium opacity-20 select-none">{display.code}</div>
      </div>
      <div className="p-5 flex flex-col">
        <div className="mb-4">
          <h3 className="text-base font-semibold mb-1 text-fg leading-snug">{project.projectName}</h3>
          <div className="flex gap-3 text-muted text-xs leading-none">
            <span className="font-mono">{display.label}</span>
            <span>Est. Completion: {display.estimatedCompletion}</span>
          </div>
        </div>

        <div className="mb-0">
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

        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex justify-between text-muted text-[11px]">
            <span>Progress</span>
            <span className="font-mono">{display.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden bg-[oklch(7%_0.012_255)] border border-border rounded-sm">
            <div className="h-full rounded-sm bg-gradient-to-r from-accent to-accent-2" style={{ width: `${display.progress}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
