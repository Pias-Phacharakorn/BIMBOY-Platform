import { Link } from "@tanstack/react-router";
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
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <Link className="brand-link" to="/projects">
          <div className="logo-box" />
          <span>LearnThatOpen</span>
        </Link>
      </div>

      <nav className="sidebar-nav" aria-label="Project navigation">
        <div className="nav-group-label">
          {project.display.code} Project
        </div>

        {navItems.map((item) => (
          <Link
            key={item.key}
            className="nav-item"
            activeProps={{ className: "active" }}
            to={`/projects/${project.id}/${item.key}` as any}
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} className={isActive ? "text-accent-2" : ""} />
                <span>{item.label}</span>
              </>
            )}
          </Link>
        ))}

        <div className="sidebar-bottom">
          <button className="nav-item nav-button" type="button" onClick={onToggleCollapsed}>
            <Icon name={collapsed ? "RIGHT" : "LEFT"} />
            <span>Collapse Sidebar</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
