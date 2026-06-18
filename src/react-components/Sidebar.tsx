import { Link, NavLink } from "react-router-dom";
import { Icon, type AppIconName } from "./Icon";
import type { AppProject } from "../static-data";

type WorkspaceRouteKey = "model" | "standard" | "clashes" | "documents" | "settings";

interface NavigationItem {
  key: WorkspaceRouteKey;
  label: string;
  icon: AppIconName;
}

const navItems: NavigationItem[] = [
  { key: "model", label: "BIM Model", icon: "MODEL" },
  { key: "standard", label: "Project Standard", icon: "TASK" },
  { key: "clashes", label: "Clash Detection", icon: "CLASH" },
  { key: "documents", label: "Document Status", icon: "SOURCE" },
  { key: "settings", label: "Settings", icon: "SETTINGS" },
];

interface SidebarProps {
  project: AppProject;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ project, collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <aside
      className={`relative z-10 flex flex-col flex-none border-r border-border bg-bg transition-[width] duration-180 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
        collapsed ? "w-[68px]" : "w-[248px]"
      }`}
    >
      <div className={`flex items-center h-[58px] border-b border-border ${collapsed ? "justify-center px-0" : "px-[18px]"}`}>
        <Link className="flex items-center gap-2 font-semibold text-fg no-underline" to="/projects">
          <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-accent to-accent-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_26px_rgba(102,126,234,0.18)]" />
          {!collapsed && <span className="text-lg tracking-tight">BIM BOY</span>}
        </Link>
      </div>

      <nav className="flex flex-col flex-1 gap-[5px] p-[10px_10px]" aria-label="Project navigation">
        {!collapsed && (
          <div className="px-[11px] py-[12px] pb-[5px] text-muted-2 text-[10px] font-bold tracking-[0.08em] uppercase">
            {project.display.code} Project
          </div>
        )}
        
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            className={({ isActive }) =>
              `flex items-center gap-[11px] min-height-[36px] p-[8px_11px] overflow-hidden border rounded-radius no-underline whitespace-nowrap transition-all duration-140 ${
                collapsed ? "justify-center px-0" : ""
              } ${
                isActive
                  ? "bg-gradient-to-r from-[oklch(28%_0.07_252_/_70%)] to-[oklch(21%_0.025_255_/_92%)] border-[oklch(48%_0.08_252)] text-fg font-semibold"
                  : "border-transparent text-muted hover:bg-[oklch(21%_0.02_255_/_78%)] hover:border-[oklch(36%_0.025_255)] hover:text-fg"
              }`
            }
            to={`/projects/${project.id}/${item.key}`}
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} className={isActive ? "text-accent-2" : ""} />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}

        <div className="mt-auto pt-2 border-t border-border">
          <button
            className={`flex items-center gap-[11px] min-height-[36px] w-full p-[8px_11px] overflow-hidden border border-transparent rounded-radius text-muted hover:bg-[oklch(21%_0.02_255_/_78%)] hover:border-[oklch(36%_0.025_255)] hover:text-fg no-underline whitespace-nowrap transition-all duration-140 bg-transparent cursor-pointer text-left ${
              collapsed ? "justify-center px-0" : ""
            }`}
            type="button"
            onClick={onToggleCollapsed}
          >
            <Icon name={collapsed ? "RIGHT" : "LEFT"} />
            {!collapsed && <span>Collapse Sidebar</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

