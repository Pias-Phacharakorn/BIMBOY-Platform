import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, CalendarPlus, Trash2, Pencil, AlertTriangle, Settings, Briefcase } from "lucide-react";
import { format, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import WorkloadCalendar from "./WorkloadCalendar";
import WorkloadEntryForm from "./WorkloadEntryForm";
import RecurringMeetingForm, { type EditRecurringData, type RecurringCategory } from "./RecurringMeetingForm";
import WorkloadProgressBar from "./WorkloadProgressBar";
import WorkloadStatusBadge from "./WorkloadStatusBadge";
import { expandRecurrence, type RecurringRule } from "@/lib/recurrenceUtils";
import { useToast } from "@/hooks/use-toast";

interface MyWorkloadProps {
  userId: string;
}

interface Project {
  id: string;
  name: string;
}

const MyWorkload = ({ userId }: MyWorkloadProps) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<any[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringFormCategory, setRecurringFormCategory] = useState<RecurringCategory>("meeting");
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editRecurringData, setEditRecurringData] = useState<EditRecurringData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: entriesData }, { data: rulesData }, { data: projectsData }] = await Promise.all([
      supabase.from("workload_entries").select("*").eq("user_id", userId).order("start_datetime", { ascending: true }),
      supabase.from("recurring_rules").select("*").eq("user_id", userId),
      supabase.from("projects").select("id, name"),
    ]);
    setEntries(entriesData || []);
    setRecurringRules((rulesData || []) as RecurringRule[]);
    setProjects(projectsData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [userId]);

  // Expand recurring rules for calendar display
  const allCalendarEntries = useMemo(() => {
    const nonRecurring = entries.filter(e => !e.is_recurring);
    const templateEntries = entries.filter(e => e.is_recurring);
    const rangeStart = subMonths(new Date(), 6);
    const rangeEnd = addMonths(new Date(), 6);

    const virtualEntries = recurringRules.flatMap(rule => {
      const template = templateEntries.find(e => e.recurring_rule_id === rule.id);
      return expandRecurrence(rule, rangeStart, rangeEnd, template ? {
        project_id: template.project_id,
        title: template.title,
        task_type: template.task_type,
        description: template.description,
        workload_percent: template.workload_percent,
        priority: template.priority,
      } : undefined);
    });

    return [...nonRecurring, ...virtualEntries].map((entry) => ({
      ...entry,
      display_title: entry.project_id
        ? projects.find((project) => project.id === entry.project_id)?.name || entry.title
        : entry.title,
    }));
  }, [entries, recurringRules, projects]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const weekEntries = allCalendarEntries.filter(e => {
      const d = new Date(e.start_datetime);
      return d >= weekStart && d <= weekEnd;
    });

    const totalHours = weekEntries.reduce((sum, e) => {
      if (e.estimated_hours) return sum + Number(e.estimated_hours);
      const diff = (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
      return sum + diff;
    }, 0);

    const meetingHours = weekEntries.filter(e => e.task_type === "meeting").reduce((sum, e) => {
      if (e.estimated_hours) return sum + Number(e.estimated_hours);
      const diff = (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
      return sum + diff;
    }, 0);

    const workloadPct = (totalHours / 40) * 100;
    const projectIds = new Set(weekEntries.filter(e => e.project_id).map(e => e.project_id));

    return { totalHours, meetingHours, workloadPct, projectCount: projectIds.size, entryCount: weekEntries.length };
  }, [allCalendarEntries]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    const { error } = await supabase.from("workload_entries").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Deleted", description: "Task deleted successfully" });
      fetchData();
    }
  };

  const handleDeleteRecurringRule = async (ruleId: string) => {
    if (!window.confirm("Delete this recurring meeting and all its instances?")) return;
    // Delete associated workload entries first, then the rule
    const { error: entryErr } = await supabase.from("workload_entries").delete().eq("recurring_rule_id", ruleId);
    if (entryErr) {
      toast({ title: "Error", description: entryErr.message, variant: "destructive" });
      return;
    }
    const { error: ruleErr } = await supabase.from("recurring_rules").delete().eq("id", ruleId);
    if (ruleErr) toast({ title: "Error", description: ruleErr.message, variant: "destructive" });
    else {
      toast({ title: "Deleted", description: "Recurring meeting deleted" });
      fetchData();
    }
  };

  const handleCalendarEntryDelete = async (e: any) => {
    // Check if this is a virtual recurring instance
    if (e.recurring_rule_id && e.id.includes("_")) {
      // Extract the date from the virtual id (format: ruleId_yyyy-MM-dd)
      const dateStr = e.id.split("_").pop();
      if (!window.confirm(`Delete only this occurrence (${dateStr})?`)) return;
      
      const rule = recurringRules.find(r => r.id === e.recurring_rule_id);
      const currentExceptions = rule?.exception_dates || [];
      const { error } = await supabase
        .from("recurring_rules")
        .update({ exception_dates: [...currentExceptions, dateStr] })
        .eq("id", e.recurring_rule_id);
      
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Deleted", description: "Single occurrence removed" });
        fetchData();
      }
    } else {
      handleDelete(e.id);
    }
  };

  const upcomingEntries = entries
    .filter(e => new Date(e.start_datetime) >= new Date() && !e.is_recurring)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Weekly Hours</p>
            <p className="text-2xl font-bold">{weeklyStats.totalHours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Meeting Hours</p>
            <p className="text-2xl font-bold">{weeklyStats.meetingHours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Projects This Week</p>
            <p className="text-2xl font-bold">{weeklyStats.projectCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Workload</p>
            <WorkloadProgressBar percent={weeklyStats.workloadPct} />
            <WorkloadStatusBadge percent={weeklyStats.workloadPct} />
          </CardContent>
        </Card>
      </div>

      {weeklyStats.workloadPct > 100 && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md p-3">
          <AlertTriangle className="h-4 w-4" />
          You are overbooked this week ({weeklyStats.workloadPct.toFixed(0)}% of 40h capacity)
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => { setEditEntry(null); setShowEntryForm(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Workload
        </Button>
        <Button onClick={() => { setEditRecurringData(null); setRecurringFormCategory("meeting"); setShowRecurringForm(true); }} variant="outline" size="sm">
          <CalendarPlus className="h-4 w-4 mr-1" /> Recurring Meeting
        </Button>
        <Button onClick={() => { setEditRecurringData(null); setRecurringFormCategory("corporate_work"); setShowRecurringForm(true); }} variant="outline" size="sm">
          <Briefcase className="h-4 w-4 mr-1" /> Corporate Works
        </Button>
      </div>

      {/* Calendar */}
      <WorkloadCalendar
        entries={allCalendarEntries}
        onEntryClick={(e) => {
          if (!e.id.includes("_")) {
            setEditEntry(entries.find(x => x.id === e.id));
            setShowEntryForm(true);
          }
        }}
        onEntryDelete={handleCalendarEntryDelete}
      />

      {/* Recurring Meetings Management */}
      {recurringRules.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recurring Schedules</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recurringRules.map(rule => {
                const template = entries.find(e => e.recurring_rule_id === rule.id);
                const title = template?.title || rule.human_readable || "Recurring Event";
                const isCorporate = template?.task_type === "corporate_work";
                return (
                  <div key={rule.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className="mt-1 shrink-0 rounded-full h-2.5 w-2.5"
                        style={{ backgroundColor: isCorporate ? "hsl(280, 60%, 50%)" : "hsl(var(--primary))" }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{title}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${isCorporate ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" : "bg-primary/10 text-primary"}`}>
                            {isCorporate ? "Corporate Work" : "Meeting"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rule.human_readable || `${rule.frequency} | ${rule.start_time} - ${rule.end_time}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          From {format(new Date(rule.start_date), "MMM d, yyyy")}
                          {rule.end_date ? ` to ${format(new Date(rule.end_date), "MMM d, yyyy")}` : " (no end)"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        const template = entries.find(e => e.recurring_rule_id === rule.id);
                        const cat: RecurringCategory = template?.task_type === "corporate_work" ? "corporate_work" : "meeting";
                        setEditRecurringData({
                          rule,
                          template: template ? {
                            id: template.id,
                            title: template.title,
                            project_id: template.project_id,
                            description: template.description,
                            workload_percent: template.workload_percent,
                            task_type: template.task_type,
                          } : null,
                        });
                        setRecurringFormCategory(cat);
                        setShowRecurringForm(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteRecurringRule(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming entries list */}
      {upcomingEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {upcomingEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.project_id ? projects.find((project) => project.id === e.project_id)?.name || e.title : e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.start_datetime), "MMM d, HH:mm")} - {format(new Date(e.end_datetime), "HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditEntry(e); setShowEntryForm(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <WorkloadEntryForm open={showEntryForm} onOpenChange={setShowEntryForm} userId={userId} onSaved={fetchData} editEntry={editEntry} />
      <RecurringMeetingForm open={showRecurringForm} onOpenChange={setShowRecurringForm} userId={userId} onSaved={fetchData} editData={editRecurringData} category={recurringFormCategory} />
    </div>
  );
};

export default MyWorkload;
