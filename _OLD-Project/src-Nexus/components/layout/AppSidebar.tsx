import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Box,
  Activity,
  Workflow,
  Settings,
  ChevronDown,
  Power,
  LogOut,
  LogIn,
  User as UserIcon,
  Shield,
  ChevronLeft,
  ChevronRight,
  Globe2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.jpg";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsAdmin, useActiveProject } from "@/hooks/useProjectContext";
import { ProjectSwitcher } from "./ProjectSwitcher";

const mainNav = [
  { label: "Overview", icon: LayoutDashboard, href: "/" },
  { label: "RITTA GIS", icon: Globe2, href: "/gis" },
];

const modules: { label: string; icon: typeof Box; href: string; key: "bim" | "iot" | "workflow" }[] = [
  { label: "BIM Viewer", icon: Box, href: "/bim", key: "bim" },
  { label: "IoT Dashboard", icon: Activity, href: "/iot", key: "iot" },
  { label: "Workflow Engine", icon: Workflow, href: "/workflow", key: "workflow" },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [modulesOpen, setModulesOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const { bimActive, iotActive, workflowActive, setModuleActive } = useDigitalTwinStore();
  const activeMap = { bim: bimActive, iot: iotActive, workflow: workflowActive };
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const project = useActiveProject();

  const onSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-14" : "w-64",
      )}
    >
      {/* Logo / Header */}
      <div
        className={cn(
          "relative flex flex-col items-center border-b border-sidebar-border",
          collapsed ? "gap-1 px-1 py-2" : "gap-2 px-5 py-5",
        )}
      >
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="absolute right-2 top-2 rounded-md p-1 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <img
          src={logoImg}
          alt="Digital Twin"
          className={cn("object-contain rounded", collapsed ? "h-8 w-8" : "h-12 w-auto")}
        />
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="rounded-md p-1 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {!collapsed && (
          <>
            <h1 className="text-xs font-bold text-sidebar-accent-foreground tracking-wider text-center">
              DIGITAL TWIN
            </h1>
            <p className="text-[10px] text-sidebar-muted">Modular Platform</p>
          </>
        )}
      </div>

      {/* Active Project */}
      {!collapsed && (
        <div className="mx-3 mt-4 mb-2 rounded-md bg-sidebar-accent px-3 py-2.5">
          <p className="text-[10px] text-sidebar-muted uppercase tracking-wider mb-1.5">Active Project</p>
          <ProjectSwitcher />
        </div>
      )}

      <nav className="flex-1 overflow-auto px-3 py-2">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md py-2 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                pathname === item.href
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          ))}
        </div>

        <div className="mt-6">
          {!collapsed && (
            <button
              onClick={() => setModulesOpen(!modulesOpen)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] uppercase tracking-wider text-sidebar-muted hover:text-sidebar-foreground"
            >
              Modules
              <ChevronDown className={cn("h-3 w-3 transition-transform", modulesOpen && "rotate-180")} />
            </button>
          )}
          {(!collapsed ? modulesOpen : true) && (
            <div className="mt-1 space-y-0.5">
              {modules.map((item) => {
                const active = activeMap[item.key];
                const lvl = isAdmin ? "full" : project?.modules[item.key];
                const hasAccess = !!lvl;
                if (collapsed) {
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      title={item.label}
                      onClick={(e) => {
                        if (!hasAccess) {
                          e.preventDefault();
                          toast.error(`No access to ${item.label} for this project`);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-center rounded-md px-2 py-2 text-sm transition-colors",
                        pathname === item.href
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                        !hasAccess && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                    </Link>
                  );
                }
                return (
                  <div key={item.href} className="group flex items-center gap-1">
                    <Link
                      to={item.href}
                      onClick={(e) => {
                        if (!hasAccess) {
                          e.preventDefault();
                          toast.error(`No access to ${item.label} for this project`);
                        }
                      }}
                      className={cn(
                        "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        pathname === item.href
                          ? "bg-sidebar-accent text-sidebar-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                        !hasAccess && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {hasAccess && lvl && (
                        <span className="rounded bg-sidebar-accent/60 px-1 py-0.5 text-[9px] uppercase text-sidebar-muted">
                          {lvl}
                        </span>
                      )}
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          active ? "bg-[hsl(var(--success))]" : "bg-sidebar-muted/50",
                        )}
                      />
                    </Link>
                    <button
                      onClick={() => setModuleActive(item.key, !active)}
                      title={active ? "Disable module" : "Enable module"}
                      className="p-1.5 rounded text-sidebar-muted hover:text-sidebar-primary"
                    >
                      <Power className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="mt-6">
            {!collapsed && (
              <p className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-sidebar-muted">
                Administration
              </p>
            )}
            <Link
              to="/admin"
              title={collapsed ? "Admin Console" : undefined}
              className={cn(
                "flex items-center rounded-md py-2 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "gap-3 px-3",
                pathname === "/admin"
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
            >
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && "Admin Console"}
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        {user ? (
          <div className={cn("space-y-1", collapsed && "space-y-2")}>
            {!collapsed && (
              <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-muted">
                <UserIcon className="h-3.5 w-3.5" />
                <span className="truncate">{user.email ?? "Signed in"}</span>
              </div>
            )}
            <button
              onClick={onSignOut}
              title="Sign out"
              className={cn(
                "flex items-center rounded-md py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50",
                collapsed ? "justify-center px-2 w-full" : "gap-3 px-3 w-full",
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && "Sign out"}
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            title="Sign in"
            className={cn(
              "flex items-center rounded-md py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50",
              collapsed ? "justify-center px-2" : "gap-3 px-3",
            )}
          >
            <LogIn className="h-4 w-4" />
            {!collapsed && "Sign in"}
          </Link>
        )}
        <button
          title="Settings"
          className={cn(
            "mt-1 flex items-center rounded-md py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50",
            collapsed ? "justify-center px-2 w-full" : "gap-3 px-3 w-full",
          )}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && "Settings"}
        </button>
      </div>
    </aside>
  );
}