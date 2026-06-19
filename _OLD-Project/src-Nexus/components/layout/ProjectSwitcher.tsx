import { useState } from "react";
import { ChevronDown, Folder, Check, Loader2 } from "lucide-react";
import { useProjectContext } from "@/hooks/useProjectContext";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { cn } from "@/lib/utils";

export function ProjectSwitcher() {
  const { data, isLoading } = useProjectContext();
  const activeProjectId = useDigitalTwinStore((s) => s.activeProjectId);
  const setActiveProjectId = useDigitalTwinStore((s) => s.setActiveProjectId);
  const [open, setOpen] = useState(false);

  const projects = data?.projects ?? [];
  const active = projects.find((p) => p.id === activeProjectId);

  if (isLoading) {
    return (
      <div className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar/40 px-2.5 py-1.5 text-xs text-sidebar-muted">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading projects…
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-sidebar-border/60 bg-sidebar/40 px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
      >
        <Folder className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
        <span className="flex-1 truncate text-left">
          {active?.name ?? (projects.length === 0 ? "No project assigned" : "Select project")}
        </span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-40 mt-1 rounded-md border border-sidebar-border bg-sidebar p-1 shadow-lg">
            <p className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-sidebar-muted">
              Active project
            </p>
            {projects.length === 0 && (
              <p className="px-2 py-2 text-xs text-sidebar-muted">
                You have no projects yet. Ask an admin to add you.
              </p>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveProjectId(p.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-sidebar-foreground hover:bg-sidebar-accent",
                  p.id === activeProjectId && "bg-sidebar-accent text-sidebar-primary",
                )}
              >
                <span className="truncate">{p.name}</span>
                {p.id === activeProjectId && <Check className="h-3 w-3 text-sidebar-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}