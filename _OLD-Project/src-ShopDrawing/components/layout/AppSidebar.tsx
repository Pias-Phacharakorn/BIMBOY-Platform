import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  QrCode,
  FileText,
  Layers3,
  GitCompareArrows,
  Users,
  Activity as ActivityIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ClipboardList,
  LayoutDashboard,
  FolderKanban,
  Wrench,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useUserRole } from "@/hooks/useUserRole";
import { canViewScanActivities, hasRoleOrHigher, canManageUsers } from "@/types/roles";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = { label: string; icon: any; href: string; show?: boolean };
type NavGroup = { label: string; items: NavItem[] };

interface AppSidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function AppSidebar({ onNavigate, collapsed = false, onToggleCollapsed }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const { projects, selectedProject, setSelectedProject, current } = useActiveProject();

  const [pjOpen, setPjOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPjOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const showActivity = canViewScanActivities(role);
  const showWorkforce = hasRoleOrHigher(role, "engineer");
  const isAdmin = canManageUsers(role);

  const navGroups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        { label: "Admin Dashboard", icon: LayoutDashboard, href: "/admin-dashboard", show: isAdmin },
      ].filter((m) => m.show !== false),
    },
    {
      label: "BIM",
      items: [
        { label: "Shop Drawing", icon: ClipboardList, href: "/dashboard" },
        { label: "Scan QR", icon: QrCode, href: "/scan-qr" },
        { label: "Scan Activity", icon: ActivityIcon, href: "/activity", show: showActivity },
        { label: "Clash Tracking", icon: GitCompareArrows, href: "/clash-tracking" },
        { label: "BIM Viewer", icon: Box, href: "/bim-viewer" },
      ].filter((m) => m.show !== false),
    },
    {
      label: "Tools",
      items: [
        { label: "CAD Viewer", icon: Layers3, href: "/cad" },
        { label: "PDF Tools", icon: FileText, href: "/pdf-tools" },
      ],
    },
    {
      label: "Team",
      items: [
        { label: "Workforce", icon: Users, href: "/workforce", show: showWorkforce },
        { label: "Projects & Users", icon: FolderKanban, href: "/projects", show: isAdmin },
      ].filter((m) => m.show !== false),
    },
  ].filter((g) => g.items.length > 0);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out" });
    navigate("/auth");
  };

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
      collapsed && "justify-center px-2",
      active
        ? "bg-sidebar-accent text-sidebar-primary font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    );

  const NavItemEl = ({ item }: { item: NavItem }) => {
    const active = location.pathname === item.href;
    const link = (
      <NavLink
        to={item.href}
        onClick={onNavigate}
        className={itemClass(active)}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && item.label}
      </NavLink>
    );
    if (!collapsed) return link;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0 transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("flex items-center border-b border-sidebar-border", collapsed ? "justify-center px-2 py-3" : "flex-col gap-2 px-5 py-5")}>
          <img src="/logo3.png" alt="RITTA" className={cn("object-contain", collapsed ? "h-8 w-auto" : "h-12 w-auto")} />
          {!collapsed && <h1 className="text-xs font-bold tracking-wide text-sidebar-accent-foreground">RITTA CONNXT</h1>}
        </div>

        {!collapsed && (
          <div className="relative mx-3 mt-4 mb-2" ref={ref}>
            <button
              onClick={() => setPjOpen(!pjOpen)}
              className="w-full rounded-md bg-sidebar-accent px-3 py-2.5 text-left hover:bg-sidebar-accent/80 transition-colors flex items-center justify-between"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-sidebar-muted">Active Project</p>
                <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
                  {current?.name || (projects.length === 0 ? "No project" : "Select project")}
                </p>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-sidebar-muted transition-transform shrink-0", pjOpen && "rotate-180")} />
            </button>
            {pjOpen && projects.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-sidebar-border bg-sidebar shadow-lg max-h-64 overflow-y-auto">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProject(p.id); setPjOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                      p.id === selectedProject ? "text-sidebar-primary font-medium bg-sidebar-accent/50" : "text-sidebar-foreground"
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className={cn("flex-1 overflow-auto py-2", collapsed ? "px-2" : "px-3")}>
          <div className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-sidebar-muted font-semibold">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItemEl key={item.href} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className={cn("border-t border-sidebar-border py-3", collapsed ? "px-2 space-y-1" : "px-3 space-y-1")}>
          {onToggleCollapsed && (
            collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onToggleCollapsed}
                    className="flex w-full items-center justify-center rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={onToggleCollapsed}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                Collapse
              </button>
            )
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
