import { type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import type { AppProject } from "../../classes/Project";
import { useUIStore } from "../store/uiStore";

interface AppShellProps {
  project: AppProject;
  children: ReactNode;
}

export function AppShell({ project, children }: AppShellProps) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useUIStore((state) => state.toggleSidebarCollapsed);

  return (
    <div className={`app-container ${sidebarCollapsed ? "collapsed" : ""}`}>
      <Sidebar project={project} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} />
      <main className="main-content">{children}</main>
    </div>
  );
}
