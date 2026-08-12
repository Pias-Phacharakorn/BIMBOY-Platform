import { Link } from "@tanstack/react-router";
import { Icon, type AppIconName } from "@/react-components/components/ui";
import type { AppProject } from "@/types";

type WorkspaceRouteKey = "model" | "standard" | "clashes" | "documents" | "drawing" | "powerbi" | "settings";

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
  { key: "drawing", label: "Drawing", icon: "DRAWING" },
  { key: "powerbi", label: "PowerBI", icon: "POWERBI" },
  { key: "settings", label: "Settings", icon: "SETTINGS" },
];

interface SidebarProps {
  project: AppProject;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  showSettings?: boolean;
}

export function Sidebar({
  project,
  collapsed,
  onToggleCollapsed,
  showSettings = false,
}: SidebarProps) {
  const baseNavItemClass = `flex items-center gap-[11px] min-h-[36px] py-2 overflow-hidden border border-transparent rounded-[var(--radius-radius)] text-muted no-underline whitespace-nowrap transition-all duration-140 ease-in-out hover:bg-[oklch(21%_0.02_255/0.78)] hover:border-[oklch(36%_0.025_255)] hover:text-fg ${
    collapsed ? "justify-center px-0" : "px-[11px]"
  }`;

  const activeNavItemClass =
    "!bg-[linear-gradient(90deg,oklch(28%_0.07_252/0.7),oklch(21%_0.025_255/0.92))] !border-[oklch(48%_0.08_252)] !text-fg font-semibold";

  // Guests fall through the `showSettings === false` branch: they can browse every
  // section, but Settings stays hidden (useIsProjectAdmin resolves false without a
  // session), which is also what a non-admin member sees.
  const filteredNavItems = showSettings
    ? navItems
    : navItems.filter((item) => item.key !== "settings");

  return (
    <aside
      className={`relative z-10 flex flex-col flex-none bg-[linear-gradient(180deg,oklch(13.5%_0.016_255),oklch(10.8%_0.014_255))] border-r border-border transition-[width] duration-180 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
        collapsed ? "w-[52px]" : "w-[225px]"
      }`}
    >
      {/* Sidebar right border glow overlay */}
      <div className="absolute top-0 -right-[1px] w-[1px] h-full bg-[linear-gradient(180deg,transparent,oklch(66%_0.17_252/0.4),transparent)] opacity-45 pointer-events-none" />

      <div className={`flex items-center h-[58px] ${collapsed ? "justify-center px-0" : "px-[18px]"}`}>
        <Link className="flex items-center gap-2 text-fg font-semibold no-underline" to="/projects">
          <div className="w-5 h-5 rounded-[var(--radius-radius-sm)] bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-2))] shadow-[0_0_0_1px_oklch(88%_0.06_230/0.18),0_10px_26px_oklch(66%_0.17_252/0.18)]" />
          <span className={collapsed ? "hidden" : ""}>BIM BOY</span>
        </Link>
      </div>

      <nav className="flex flex-col flex-1 gap-[5px] px-[10px] py-[14px]" aria-label="Project navigation">
        <div className={collapsed ? "hidden" : "pt-[12px] pb-[5px] px-[11px] text-muted-2 text-[10px] font-bold tracking-[0.08em] uppercase"}>
          {project.display.code} Project
        </div>

        {filteredNavItems.map((item) => (
          <Link
            key={item.key}
            className={baseNavItemClass}
            activeProps={{ className: activeNavItemClass }}
            to={`/projects/${project.id}/${item.key}` as any}
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} className={isActive ? "text-accent-2" : ""} />
                <span className={collapsed ? "hidden" : ""}>{item.label}</span>
              </>
            )}
          </Link>
        ))}

      </nav>

      {/* Sidebar Footer (Standard 48px Height containing the collapse button) */}
      <div
        className={`flex items-center h-[48px] bg-bg flex-none transition-all duration-180 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          collapsed ? "justify-center px-0" : "px-[14px]"
        }`}
      >
        <button
          className={`${baseNavItemClass} w-full bg-transparent cursor-pointer text-left`}
          type="button"
          onClick={onToggleCollapsed}
        >
          <Icon name={collapsed ? "RIGHT" : "LEFT"} />
          <span className={collapsed ? "hidden" : ""}>Collapse Sidebar</span>
        </button>
      </div>
    </aside>
  );
}

