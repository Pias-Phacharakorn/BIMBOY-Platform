import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, Briefcase, AlertTriangle, TrendingDown, Calendar } from "lucide-react";
import { startOfWeek, endOfWeek, addMonths } from "date-fns";
import WorkloadStatusBadge from "./WorkloadStatusBadge";
import WorkloadProgressBar from "./WorkloadProgressBar";
import { expandRecurrence, type RecurringRule } from "@/lib/recurrenceUtils";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

const ExecutiveDashboard = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [allRules, setAllRules] = useState<RecurringRule[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: e }, { data: r }, { data: proj }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name"),
      supabase.from("workload_entries").select("*"),
      supabase.from("recurring_rules").select("*"),
      supabase.from("projects").select("id, name"),
    ]);
    setProfiles(p || []);
    setAllEntries(e || []);
    setAllRules((r || []) as RecurringRule[]);
    setProjects(proj || []);
    setLoading(false);
  };

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Expand recurring entries
  const expandedEntries = useMemo(() => {
    const nonRecurring = allEntries.filter(e => !e.is_recurring);
    const templates = allEntries.filter(e => e.is_recurring);
    const rangeEnd = addMonths(now, 1);

    const virtual = allRules.flatMap(rule => {
      const tpl = templates.find(e => e.recurring_rule_id === rule.id);
      return expandRecurrence(rule, weekStart, rangeEnd, tpl ? {
        project_id: tpl.project_id, title: tpl.title, task_type: tpl.task_type,
        description: tpl.description, workload_percent: tpl.workload_percent, priority: tpl.priority,
      } : undefined);
    });

    return [...nonRecurring, ...virtual];
  }, [allEntries, allRules]);

  // Per-employee stats
  const employeeStats = useMemo(() => {
    return profiles.map(p => {
      const userEntries = expandedEntries.filter(e =>
        e.user_id === p.id && new Date(e.start_datetime) >= weekStart && new Date(e.start_datetime) <= weekEnd
      );
      const totalHours = userEntries.reduce((sum, e) => {
        if (e.estimated_hours) return sum + Number(e.estimated_hours);
        return sum + (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
      }, 0);
      const meetingHours = userEntries.filter(e => e.task_type === "meeting").reduce((sum, e) => {
        if (e.estimated_hours) return sum + Number(e.estimated_hours);
        return sum + (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
      }, 0);
      const corporateHours = userEntries.filter(e => e.task_type === "corporate_work").reduce((sum, e) => {
        if (e.estimated_hours) return sum + Number(e.estimated_hours);
        return sum + (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
      }, 0);
      const projectIds = new Set(userEntries.filter(e => e.project_id).map(e => e.project_id));
      const workloadPct = (totalHours / 40) * 100;

      return {
        ...p,
        totalHours,
        meetingHours,
        corporateHours,
        projectCount: projectIds.size,
        workloadPct,
        entryCount: userEntries.length,
      };
    }).sort((a, b) => b.workloadPct - a.workloadPct);
  }, [profiles, expandedEntries]);

  const overloaded = employeeStats.filter(e => e.workloadPct > 100).length;
  const underutilized = employeeStats.filter(e => e.workloadPct < 60 && e.workloadPct > 0).length;
  const weeklyMeetings = expandedEntries.filter(e =>
    e.task_type === "meeting" && new Date(e.start_datetime) >= weekStart && new Date(e.start_datetime) <= weekEnd
  ).length;

  if (loading) return <div className="flex justify-center py-12 text-muted-foreground">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Employees</p>
              <p className="text-2xl font-bold">{profiles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Briefcase className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Active Projects</p>
              <p className="text-2xl font-bold">{projects.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Overloaded</p>
              <p className="text-2xl font-bold">{overloaded}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Underutilized</p>
              <p className="text-2xl font-bold">{underutilized}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Meetings/Week</p>
              <p className="text-2xl font-bold">{weeklyMeetings}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee heatmap table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Workforce Workload Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium">Employee</th>
                <th className="text-center px-4 py-2 font-medium">Projects</th>
                <th className="text-center px-4 py-2 font-medium">Corporate/Week</th>
                <th className="text-center px-4 py-2 font-medium">Meetings/Week</th>
                <th className="px-4 py-2 font-medium">Workload</th>
                <th className="text-center px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats.map(emp => (
                <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{emp.first_name} {emp.last_name}</td>
                  <td className="px-4 py-3 text-center">{emp.projectCount}</td>
                  <td className="px-4 py-3 text-center">{emp.corporateHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-center">{emp.meetingHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <WorkloadProgressBar percent={emp.workloadPct} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <WorkloadStatusBadge percent={emp.workloadPct} />
                  </td>
                </tr>
              ))}
              {employeeStats.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No employee data</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveDashboard;
