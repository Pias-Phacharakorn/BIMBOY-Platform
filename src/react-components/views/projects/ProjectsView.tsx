import { useMemo, useState } from "react";
import { Icon, SearchBox } from "@/react-components/components/ui";
import { ProjectCard } from "@/react-components/features/project-card";
import { useProjects } from "@/react-components/features/projects/useProjects";
import type { ProjectView } from "@/types";

export function ProjectsView() {
  const [view, setView] = useState<ProjectView>("card");
  const [query, setQuery] = useState("");
  const { data: dbProjects = [], isLoading, isError, error } = useProjects();

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return dbProjects;
    }

    return dbProjects.filter((project) => {
      return [
        project.projectName,
        project.description,
        project.display.code,
        project.display.label,
        project.display.statusLabel,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [dbProjects, query]);

  return (
    <div className="flex w-screen h-screen min-w-0 bg-[#090a0f] flex-col">
      <header className="flex flex-none items-center justify-between gap-[18px] min-h-[58px] px-[clamp(14px,2vw,24px)] bg-[oklch(12.2%_0.014_255_/_92%)] border-b border-border backdrop-blur-md">
        <div className="flex items-center gap-2 text-fg font-semibold text-lg tracking-tight select-none">
          <div className="w-6 h-6 rounded-sm bg-gradient-to-br from-accent to-accent-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_26px_rgba(102,126,234,0.18)]" />
          BIM BOY
        </div>
        <SearchBox value={query} onChange={setQuery} />
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex gap-[3px] max-w-full overflow-x-auto p-[3px] border border-border rounded-radius bg-[oklch(10.5%_0.014_255)]" aria-label="Project view">
            <button
              className={`flex-none px-[11px] py-[5px] border rounded-radius-sm cursor-pointer text-xs font-semibold whitespace-nowrap transition-all duration-120 ${view === "card"
                  ? "bg-[oklch(24%_0.038_252)] border-[oklch(45%_0.07_252)] text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-transparent text-muted hover:bg-surface-alt hover:text-fg"
                }`}
              title="Card View"
              type="button"
              onClick={() => setView("card")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              className={`flex-none px-[11px] py-[5px] border rounded-radius-sm cursor-pointer text-xs font-semibold whitespace-nowrap transition-all duration-120 ${view === "list"
                  ? "bg-[oklch(24%_0.038_252)] border-[oklch(45%_0.07_252)] text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-transparent text-muted hover:bg-surface-alt hover:text-fg"
                }`}
              title="List View"
              type="button"
              onClick={() => setView("list")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
          <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120" type="button">
            Import
          </button>
          <button className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border rounded-radius cursor-pointer text-xs font-semibold no-underline hover:-translate-y-[1px] active:translate-y-0 transition-all duration-120 border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]" type="button">
            New Project
          </button>
        </div>
      </header>

      <main className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="p-[32px_32px_0]">
          <h1 className="text-2xl font-bold mb-2 text-fg">Projects</h1>
          <p className="text-muted">Select a BIM workspace to begin engineering operations.</p>
        </div>

        <div className={`grid-cols-[80px_2fr_1.2fr_100px_120px_120px_180px] gap-5 m-[32px_32px_0] p-[12px_56px] bg-surface-alt border border-border border-b-0 rounded-[8px_8px_0_0] text-muted text-[10px] font-semibold text-center uppercase ${view === "list" ? "grid" : "hidden"}`}>
          <div className="col-span-2 text-left">Project Name</div>
          <div>projectNumber</div>
          <div>Status</div>
          <div>Startdate</div>
          <div>Finishdate</div>
          <div>Progress%</div>
        </div>

        <div className={view === "list" ? "flex flex-col gap-0 m-[0_32px_32px] p-0 overflow-hidden border border-border border-t-0 rounded-[0_0_8px_8px]" : "grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6 p-8"}>
          {isLoading ? (
            <div className="col-span-full py-20 text-center text-muted">
              Loading projects from Supabase...
            </div>
          ) : isError ? (
            <div className="col-span-full py-20 text-center text-status-warn">
              Error loading projects: {error?.message || "Unknown error"}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full py-20 text-center text-muted">
              No projects found.
            </div>
          ) : (
            filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} view={view} />
            ))
          )}
        </div>
      </main>
    </div>
  );

}
