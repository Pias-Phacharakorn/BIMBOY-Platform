import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import type { AppProject } from "../static-data";

interface AppShellProps {
  project: AppProject;
  children: ReactNode;
}

export function AppShell({ project, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebarCollapsed") === "true");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <div className={`app-container ${collapsed ? "collapsed" : ""}`}>
      <Sidebar project={project} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main className="main-content">{children}</main>
    </div>
  );
}
