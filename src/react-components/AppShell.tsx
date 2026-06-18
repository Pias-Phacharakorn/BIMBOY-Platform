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
    <div className="flex w-screen h-screen min-w-0 bg-[#090a0f]">
      <Sidebar project={project} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}

