import { addDays, addWeeks, addMonths, isBefore, isAfter, startOfDay, format } from "date-fns";

export interface RecurringRule {
  id: string;
  user_id: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  interval_val: number;
  by_day: string[] | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  human_readable: string | null;
  created_at: string;
  exception_dates: string[] | null;
}

export interface VirtualEntry {
  id: string; // rule_id + date
  user_id: string;
  project_id: string | null;
  title: string;
  task_type: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  estimated_hours: number | null;
  workload_percent: number | null;
  is_recurring: true;
  recurring_rule_id: string;
  priority: string;
}

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

export function expandRecurrence(
  rule: RecurringRule,
  rangeStart: Date,
  rangeEnd: Date,
  meta?: { project_id?: string | null; title?: string; task_type?: string; description?: string | null; workload_percent?: number | null; priority?: string }
): VirtualEntry[] {
  const entries: VirtualEntry[] = [];
  const ruleStart = new Date(rule.start_date);
  const ruleEnd = rule.end_date ? new Date(rule.end_date) : null;
  const effectiveEnd = ruleEnd && isBefore(ruleEnd, rangeEnd) ? ruleEnd : rangeEnd;

  let cursor = startOfDay(ruleStart);
  const maxIterations = 2000;
  let count = 0;

  // For biweekly: calculate week number from rule start to determine odd/even weeks
  const ruleStartMonday = startOfDay(addDays(ruleStart, -((ruleStart.getDay() + 6) % 7)));

  while (isBefore(cursor, effectiveEnd) && count < maxIterations) {
    count++;
    if (!isBefore(cursor, rangeStart) || format(cursor, "yyyy-MM-dd") >= format(rangeStart, "yyyy-MM-dd")) {
      const dayOfWeek = cursor.getDay();
      const dayCode = Object.entries(DAY_MAP).find(([, v]) => v === dayOfWeek)?.[0];

      let include = true;
      if (rule.by_day && rule.by_day.length > 0 && (rule.frequency === "weekly" || rule.frequency === "biweekly")) {
        include = dayCode ? rule.by_day.includes(dayCode) : false;
      }

      // For biweekly: only include entries on even-numbered weeks from rule start
      if (include && rule.frequency === "biweekly") {
        const cursorMonday = startOfDay(addDays(cursor, -((cursor.getDay() + 6) % 7)));
        const diffDays = Math.round((cursorMonday.getTime() - ruleStartMonday.getTime()) / (1000 * 60 * 60 * 24));
        const weekIndex = Math.round(diffDays / 7);
        if (weekIndex % 2 !== 0) {
          include = false;
        }
      }

      if (include && !isBefore(cursor, startOfDay(rangeStart))) {
        const dateStr = format(cursor, "yyyy-MM-dd");
        if (rule.exception_dates?.includes(dateStr)) {
          // Skip this date — it was individually deleted
        } else {
        entries.push({
          id: `${rule.id}_${dateStr}`,
          user_id: rule.user_id,
          project_id: meta?.project_id ?? null,
          title: meta?.title ?? rule.human_readable ?? "Recurring Event",
          task_type: meta?.task_type ?? "meeting",
          description: meta?.description ?? null,
          start_datetime: `${dateStr}T${rule.start_time}`,
          end_datetime: `${dateStr}T${rule.end_time}`,
          estimated_hours: null,
          workload_percent: meta?.workload_percent ?? null,
          is_recurring: true,
          recurring_rule_id: rule.id,
          priority: meta?.priority ?? "medium",
        });
        }
      }
    }

    switch (rule.frequency) {
      case "daily":
        cursor = addDays(cursor, rule.interval_val);
        break;
      case "weekly":
        cursor = addDays(cursor, 1);
        break;
      case "biweekly":
        cursor = addDays(cursor, 1);
        break;
      case "monthly":
        cursor = addMonths(cursor, rule.interval_val);
        break;
    }
  }

  return entries;
}

export function generateHumanReadable(
  frequency: string,
  intervalVal: number,
  byDay: string[] | null,
  startTime: string,
  endTime: string
): string {
  const dayNames: Record<string, string> = {
    MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday",
    FR: "Friday", SA: "Saturday", SU: "Sunday",
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const timeStr = `${formatTime(startTime)} - ${formatTime(endTime)}`;
  const days = byDay?.map(d => dayNames[d] || d).join(", ") ?? "";

  switch (frequency) {
    case "daily":
      return intervalVal === 1 ? `Every day, ${timeStr}` : `Every ${intervalVal} days, ${timeStr}`;
    case "weekly":
      return days ? `Every week on ${days}, ${timeStr}` : `Every week, ${timeStr}`;
    case "biweekly":
      return days ? `Every 2 weeks on ${days}, ${timeStr}` : `Every 2 weeks, ${timeStr}`;
    case "monthly":
      return intervalVal === 1 ? `Every month, ${timeStr}` : `Every ${intervalVal} months, ${timeStr}`;
    default:
      return `${frequency}, ${timeStr}`;
  }
}

export const TASK_TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "design", label: "Design" },
  { value: "coordination", label: "Coordination" },
  { value: "review", label: "Review" },
  { value: "site_visit", label: "Site Visit" },
  { value: "documentation", label: "Documentation" },
  { value: "other", label: "Other" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const TASK_TYPE_COLORS: Record<string, string> = {
  meeting: "hsl(var(--primary))",
  corporate_work: "hsl(280, 60%, 50%)",
  design: "hsl(262, 52%, 47%)",
  coordination: "hsl(173, 58%, 39%)",
  review: "hsl(38, 92%, 50%)",
  site_visit: "hsl(12, 76%, 61%)",
  documentation: "hsl(221, 83%, 53%)",
  other: "hsl(var(--muted-foreground))",
};

export function getWorkloadStatus(percent: number): { label: string; variant: "destructive" | "default" | "secondary" } {
  if (percent > 100) return { label: "Overloaded", variant: "destructive" };
  if (percent >= 60) return { label: "Balanced", variant: "default" };
  return { label: "Underutilized", variant: "secondary" };
}
