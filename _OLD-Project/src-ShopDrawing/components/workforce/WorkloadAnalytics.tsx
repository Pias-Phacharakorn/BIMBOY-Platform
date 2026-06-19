import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import WorkloadStatusBadge from "./WorkloadStatusBadge";
import WorkloadProgressBar from "./WorkloadProgressBar";
import { TASK_TYPE_COLORS, TASK_TYPES } from "@/lib/recurrenceUtils";
import { startOfWeek, addDays, format } from "date-fns";
import { AlertTriangle } from "lucide-react";

interface WorkloadAnalyticsProps {
  entries: any[];
  isAdmin?: boolean;
}

const WorkloadAnalytics = ({ entries, isAdmin = false }: WorkloadAnalyticsProps) => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  const weekEntries = useMemo(() =>
    entries.filter(e => {
      const d = new Date(e.start_datetime);
      return d >= weekStart && d <= weekEnd;
    }), [entries]);

  const ALL_TYPES = useMemo(() => [
    { value: "corporate_work", label: "Corporate Work" },
    ...TASK_TYPES,
  ], []);

  // Task type distribution
  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    weekEntries.forEach(e => {
      const hours = e.estimated_hours ? Number(e.estimated_hours) :
        (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
      counts[e.task_type] = (counts[e.task_type] || 0) + hours;
    });
    return ALL_TYPES.map(t => ({
      name: t.label,
      value: Math.round((counts[t.value] || 0) * 10) / 10,
      color: TASK_TYPE_COLORS[t.value],
      key: t.value,
    }));
  }, [weekEntries, ALL_TYPES]);

  const activeTypeDistribution = useMemo(() =>
    typeDistribution.filter(t => t.value > 0), [typeDistribution]);

  // All task type keys present this week (for stacked bars)
  const activeTaskTypes = useMemo(() => {
    const allTypes = [
      { value: "corporate_work", label: "Corporate Work" },
      ...TASK_TYPES,
    ];
    const seen = new Set(weekEntries.map(e => e.task_type));
    return ALL_TYPES.filter(t => seen.has(t.value));
  }, [weekEntries, ALL_TYPES]);

  // Daily hours trend (stacked by task type)
  const dailyTrend = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const dateKey = format(day, "yyyy-MM-dd");
      const dayEntries = weekEntries.filter(e => format(new Date(e.start_datetime), "yyyy-MM-dd") === dateKey);
      const row: Record<string, any> = { day: format(day, "EEE") };
      activeTaskTypes.forEach(t => {
        const hours = dayEntries
          .filter(e => e.task_type === t.value)
          .reduce((s, e) => {
            if (e.estimated_hours) return s + Number(e.estimated_hours);
            return s + (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
          }, 0);
        row[t.value] = Math.round(hours * 10) / 10;
      });
      return row;
    });
  }, [weekEntries, activeTaskTypes]);

  const totalHours = weekEntries.reduce((s, e) => {
    if (e.estimated_hours) return s + Number(e.estimated_hours);
    return s + (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
  }, 0);

  const meetingHours = weekEntries.filter(e => e.task_type === "meeting" || e.task_type === "corporate_work").reduce((s, e) => {
    if (e.estimated_hours) return s + Number(e.estimated_hours);
    return s + (new Date(e.end_datetime).getTime() - new Date(e.start_datetime).getTime()) / 3600000;
  }, 0);

  const workloadPct = (totalHours / 40) * 100;
  const warnings: string[] = [];
  if (workloadPct > 100) warnings.push("You are overbooked this week");
  if (meetingHours > totalHours * 0.6) warnings.push("Meeting & corporate work hours exceed 60% of your work time");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Workload Composition</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {activeTypeDistribution.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={activeTypeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {activeTypeDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center">
                  {activeTypeDistribution.map(t => (
                    <div key={t.name} className="flex items-center gap-1 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name} ({t.value}h)
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8">No data this week</p>
            )}
          </CardContent>
        </Card>

        {/* Weekly trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Daily Hours Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyTrend}>
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                {activeTaskTypes.map((t, i) => (
                  <Bar
                    key={t.value}
                    dataKey={t.value}
                    name={t.label}
                    stackId="a"
                    fill={TASK_TYPE_COLORS[t.value]}
                    radius={i === activeTaskTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Total Hours</span>
            <span className="font-semibold">{totalHours.toFixed(1)}h / 40h</span>
          </div>
          <WorkloadProgressBar
            percent={workloadPct}
            segments={activeTypeDistribution.map(t => ({ key: t.key, value: t.value, color: t.color }))}
          />
          {activeTypeDistribution.map(t => (
            <div key={t.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                <span className="text-sm">{t.name}</span>
              </div>
              <span className="text-sm font-medium">{t.value}h</span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm">Status:</span>
            <WorkloadStatusBadge percent={workloadPct} />
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {w}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkloadAnalytics;
