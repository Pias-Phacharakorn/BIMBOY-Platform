import { Link, NavLink } from "react-router-dom";
import { Icon, type AppIconName } from "../components/Icon";
import type { AppProject } from "../../classes/Project";
import { useAuth } from "../../context/AuthContext";

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
  const { user, projectRoles, isHubAdmin } = useAuth();
  const userRole = projectRoles[project.id] || "project member";
  const isProjAdmin = isHubAdmin || userRole === "project_admin";

  const userEmail = user?.email?.trim().toLowerCase() || "";
  const allowedPages = project.memberPermissions?.[userEmail] || {
    model: true,
    standard: true,
    clashes: true,
    documents: true
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.key === "settings") {
      return isProjAdmin;
    }
    return isProjAdmin || allowedPages[item.key] !== false;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link className="brand-link" to="/projects">
          <div className="logo-box" />
          <span>PiasBimWeb</span>
        </Link>
      </div>
      <nav className="sidebar-nav" aria-label="Project navigation">
        <div className="nav-group-label">{project.projectnumber}_{project.projectName}</div>
        {visibleNavItems.map((item) => (
          <NavLink key={item.key} className="nav-item" to={`/projects/${project.id}/${item.key}`}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
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

