import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { hasRoleOrHigher } from "@/types/roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MyWorkload from "@/components/workforce/MyWorkload";
import ExecutiveDashboard from "@/components/workforce/ExecutiveDashboard";
import TeamCalendar from "@/components/workforce/TeamCalendar";
import WorkloadAnalytics from "@/components/workforce/WorkloadAnalytics";
import { expandRecurrence, type RecurringRule } from "@/lib/recurrenceUtils";
import { addMonths, startOfWeek } from "date-fns";

const Workforce = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading, userId } = useUserRole();
  const [analyticsEntries, setAnalyticsEntries] = useState<any[]>([]);
  const [analyticsRules, setAnalyticsRules] = useState<RecurringRule[]>([]);

  const isAdmin = role === "project_admin" || (role as string) === "admin";
  const isEngineerOrAbove = hasRoleOrHigher(role, "engineer");

  useEffect(() => {
    if (!roleLoading && !userId) {
      navigate("/auth");
    }
  }, [roleLoading, userId]);

  useEffect(() => {
    if (!userId) return;
    const fetchAnalytics = async () => {
      const [{ data: e }, { data: r }] = await Promise.all([
        isAdmin
          ? supabase.from("workload_entries").select("*")
          : supabase.from("workload_entries").select("*").eq("user_id", userId),
        isAdmin
          ? supabase.from("recurring_rules").select("*")
          : supabase.from("recurring_rules").select("*").eq("user_id", userId),
      ]);
      setAnalyticsEntries(e || []);
      setAnalyticsRules((r || []) as RecurringRule[]);
    };
    fetchAnalytics();
  }, [userId, isAdmin]);

  const expandedForAnalytics = useMemo(() => {
    const nonRecurring = analyticsEntries.filter(e => !e.is_recurring);
    const templates = analyticsEntries.filter(e => e.is_recurring);
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const virtual = analyticsRules.flatMap(rule => {
      const tpl = templates.find(e => e.recurring_rule_id === rule.id);
      return expandRecurrence(rule, weekStart, addMonths(now, 1), tpl ? {
        project_id: tpl.project_id, title: tpl.title, task_type: tpl.task_type,
        description: tpl.description, workload_percent: tpl.workload_percent, priority: tpl.priority,
      } : undefined);
    });
    return [...nonRecurring, ...virtual];
  }, [analyticsEntries, analyticsRules]);

  if (roleLoading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground">Loading...</div>;
  }

  if (!isEngineerOrAbove) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        You do not have access to this module.
      </div>
    );
  }

  const defaultTab = isAdmin ? "dashboard" : "my-workload";

  return (
    <div className="animate-fade-in container mx-auto px-4 md:px-6 py-6 md:py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Workforce Intelligence</h1>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4">
            {isAdmin && <TabsTrigger value="dashboard">Executive Dashboard</TabsTrigger>}
            <TabsTrigger value="my-workload">My Workload</TabsTrigger>
            {isAdmin && <TabsTrigger value="team-calendar">Team Calendar</TabsTrigger>}
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {isAdmin && (
            <TabsContent value="dashboard">
              <ExecutiveDashboard />
            </TabsContent>
          )}

          <TabsContent value="my-workload">
            {userId && <MyWorkload userId={userId} />}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team-calendar">
              <TeamCalendar />
            </TabsContent>
          )}

          <TabsContent value="analytics">
            <WorkloadAnalytics entries={expandedForAnalytics} isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default Workforce;
