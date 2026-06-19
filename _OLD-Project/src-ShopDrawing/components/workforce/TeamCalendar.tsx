import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Users, FolderKanban } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addWeeks, startOfWeek, format } from "date-fns";
import { expandRecurrence, TASK_TYPE_COLORS, type RecurringRule } from "@/lib/recurrenceUtils";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Profile { id: string; first_name: string; last_name: string; }
interface UserRole { user_id: string; role: string; }
interface Project { id: string; name: string; }

type ViewMode = "projects" | "users";

const TeamCalendar = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [allRules, setAllRules] = useState<RecurringRule[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("projects");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: e }, { data: r }, { data: roles }, { data: proj }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name"),
      supabase.from("workload_entries").select("*"),
      supabase.from("recurring_rules").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("projects").select("id, name"),
    ]);
    setProfiles(p || []);
    setAllEntries(e || []);
    setAllRules((r || []) as RecurringRule[]);
    setUserRoles((roles || []) as UserRole[]);
    setProjects(proj || []);
    setLoading(false);
  };

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const expandedEntries = useMemo(() => {
    const nonRecurring = allEntries.filter(e => !e.is_recurring);
    const templates = allEntries.filter(e => e.is_recurring);
    const virtual = allRules.flatMap(rule => {
      const tpl = templates.find(e => e.recurring_rule_id === rule.id);
      return expandRecurrence(rule, weekStart, addDays(weekEnd, 1), tpl ? {
        project_id: tpl.project_id, title: tpl.title, task_type: tpl.task_type,
        description: tpl.description, workload_percent: tpl.workload_percent, priority: tpl.priority,
      } : undefined);
    });
    return [...nonRecurring, ...virtual].filter(e => e.task_type !== "corporate_work");
  }, [allEntries, allRules, weekStart]);

  // Filter by role
  const filteredUserIds = useMemo(() => {
    if (roleFilter === "all") return null;
    return new Set(userRoles.filter(r => r.role === roleFilter).map(r => r.user_id));
  }, [userRoles, roleFilter]);

  const filteredEntries = useMemo(() => {
    if (!filteredUserIds) return expandedEntries;
    return expandedEntries.filter(e => filteredUserIds.has(e.user_id));
  }, [expandedEntries, filteredUserIds]);

  // Projects view data
  const activeProjects = useMemo(() => {
    const projectIds = new Set<string>();
    let hasNoProject = false;
    filteredEntries.forEach(e => {
      const dateKey = format(new Date(e.start_datetime), "yyyy-MM-dd");
      const inWeek = days.some(d => format(d, "yyyy-MM-dd") === dateKey);
      if (inWeek) {
        if (e.project_id) projectIds.add(e.project_id);
        else hasNoProject = true;
      }
    });
    const result = projects.filter(p => projectIds.has(p.id));
    if (hasNoProject) result.push({ id: "__no_project__", name: "No Project" });
    return result;
  }, [filteredEntries, projects, days]);

  // Users view data
  const activeUsers = useMemo(() => {
    if (!filteredUserIds) return profiles;
    return profiles.filter(p => filteredUserIds.has(p.id));
  }, [profiles, filteredUserIds]);

  const isInWeek = (e: any) => {
    const dateKey = format(new Date(e.start_datetime), "yyyy-MM-dd");
    return days.some(d => format(d, "yyyy-MM-dd") === dateKey);
  };

  if (loading) return <div className="flex justify-center py-12 text-muted-foreground">Loading team calendar...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(prev => addWeeks(prev, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold text-sm">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </h3>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(prev => addWeeks(prev, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex border border-border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "projects" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-3 gap-1.5"
              onClick={() => setViewMode("projects")}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span className="text-xs">Projects</span>
            </Button>
            <Button
              variant={viewMode === "users" ? "default" : "ghost"}
              size="sm"
              className="rounded-none h-8 px-3 gap-1.5"
              onClick={() => setViewMode("users")}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="text-xs">Users</span>
            </Button>
          </div>

          {/* Role filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Filter role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="project_admin">Project Admin</SelectItem>
              <SelectItem value="engineer">Engineer</SelectItem>
              <SelectItem value="modeler">Modeler</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium min-w-[160px] sticky left-0 bg-muted/50 border-r border-border">
                  {viewMode === "projects" ? "Project" : "Employee"}
                </th>
                {days.map(d => (
                  <th key={d.toISOString()} className="text-center px-2 py-2 font-medium min-w-[100px] border-r border-border">
                    {format(d, "EEE d")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viewMode === "projects" ? (
                <>
                  {activeProjects.map((proj, idx) => {
                    const isNoProject = proj.id === "__no_project__";
                    const projEntries = filteredEntries.filter(e =>
                      isNoProject ? !e.project_id : e.project_id === proj.id
                    );
                    return (
                      <tr key={proj.id} className={cn("border-b", idx % 2 === 1 && "bg-muted/30")}>
                        <td className={cn("px-3 py-2 font-medium sticky left-0 border-r border-border", idx % 2 === 1 ? "bg-muted/30" : "bg-card")}>{proj.name}</td>
                        {days.map(d => {
                          const dateKey = format(d, "yyyy-MM-dd");
                          const dayEntries = projEntries.filter(e => format(new Date(e.start_datetime), "yyyy-MM-dd") === dateKey);
                          return (
                            <td key={dateKey} className="px-1 py-1 align-top border-r border-border">
                              <div className="space-y-0.5">
                                {dayEntries.slice(0, 3).map(e => {
                                  const userName = profiles.find(p => p.id === e.user_id);
                                  const displayLabel = userName ? `${userName.first_name} ${userName.last_name}` : "Unknown";
                                  const timeStr = `${format(new Date(e.start_datetime), "HH:mm")} - ${format(new Date(e.end_datetime), "HH:mm")}`;
                                  return (
                                    <Tooltip key={e.id}>
                                      <TooltipTrigger asChild>
                                        <div className="rounded px-1 py-0.5 text-[10px] truncate text-primary-foreground cursor-default" style={{ backgroundColor: TASK_TYPE_COLORS[e.task_type] || TASK_TYPE_COLORS.other }}>
                                          <div className="truncate font-medium">{displayLabel}</div>
                                          <div className="opacity-80">{timeStr}</div>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="font-medium">{displayLabel}</p>
                                        <p className="text-xs text-muted-foreground">{e.title}</p>
                                        <p className="text-xs">{timeStr}</p>
                                        <p className="text-xs capitalize">{e.task_type}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                                {dayEntries.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayEntries.length - 3}</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {activeProjects.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No project activities this week</td></tr>
                  )}
                </>
              ) : (
                <>
                  {activeUsers.map((user, idx) => {
                    const userEntries = filteredEntries.filter(e => e.user_id === user.id);
                    return (
                      <tr key={user.id} className={cn("border-b", idx % 2 === 1 && "bg-muted/30")}>
                        <td className={cn("px-3 py-2 font-medium sticky left-0 border-r border-border", idx % 2 === 1 ? "bg-muted/30" : "bg-card")}>
                          {user.first_name} {user.last_name}
                        </td>
                        {days.map(d => {
                          const dateKey = format(d, "yyyy-MM-dd");
                          const dayEntries = userEntries.filter(e => format(new Date(e.start_datetime), "yyyy-MM-dd") === dateKey);
                          return (
                            <td key={dateKey} className="px-1 py-1 align-top border-r border-border">
                              <div className="space-y-0.5">
                                {dayEntries.slice(0, 3).map(e => {
                                  const projName = e.project_id ? projects.find(p => p.id === e.project_id)?.name || "Unknown" : "No Project";
                                  const timeStr = `${format(new Date(e.start_datetime), "HH:mm")} - ${format(new Date(e.end_datetime), "HH:mm")}`;
                                  return (
                                    <Tooltip key={e.id}>
                                      <TooltipTrigger asChild>
                                        <div className="rounded px-1 py-0.5 text-[10px] truncate text-primary-foreground cursor-default" style={{ backgroundColor: TASK_TYPE_COLORS[e.task_type] || TASK_TYPE_COLORS.other }}>
                                          <div className="truncate font-medium">{projName}</div>
                                          <div className="opacity-80">{timeStr}</div>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="font-medium">{projName}</p>
                                        <p className="text-xs text-muted-foreground">{e.title}</p>
                                        <p className="text-xs">{timeStr}</p>
                                        <p className="text-xs capitalize">{e.task_type}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                                {dayEntries.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayEntries.length - 3}</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {activeUsers.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No user activities this week</td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamCalendar;
