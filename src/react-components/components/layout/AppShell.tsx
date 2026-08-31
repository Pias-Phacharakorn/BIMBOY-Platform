import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useUIStore } from "@/react-components/store/uiStore";
import type { AppProject } from "@/types";

interface AppShellProps {
  project: AppProject;
  children: ReactNode;
  showSettings?: boolean;
}

export function AppShell({ project, children, showSettings = false }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  // Full-screen viewport mode. Unmounting rather than hiding is safe because the sidebar holds no
  // state of its own — `collapsed` lives here and survives — and it keeps the flex row free of a
  // zero-width child. `ModelsView` owns the mode and clears it on unmount, so no other view can
  // inherit a hidden sidebar; see `features/viewport-fullscreen/useViewportFullscreen.ts`.
  const isViewportFullscreen = useUIStore((state) => state.isViewportFullscreen);

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
      {!isViewportFullscreen && (
        <Sidebar project={project} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} showSettings={showSettings} />
      )}
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}

