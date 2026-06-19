import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, addWeeks, addMonths, startOfWeek, startOfMonth, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { TASK_TYPE_COLORS } from "@/lib/recurrenceUtils";
import { Trash2 } from "lucide-react";

interface CalendarEntry {
  id: string;
  title: string;
  task_type: string;
  start_datetime: string;
  end_datetime: string;
  is_recurring: boolean;
  display_title?: string;
}

interface WorkloadCalendarProps {
  entries: CalendarEntry[];
  view?: "week" | "month";
  onEntryClick?: (entry: CalendarEntry) => void;
  onEntryDelete?: (entry: CalendarEntry) => void;
}

const WorkloadCalendar = ({ entries, view = "month", onEntryClick, onEntryDelete }: WorkloadCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigate = (dir: number) => {
    setCurrentDate(prev => view === "month" ? addMonths(prev, dir) : addWeeks(prev, dir));
  };

  const days = useMemo(() => {
    if (view === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const days: Date[] = [];
      let d = calStart;
      while (d <= calEnd) {
        days.push(d);
        d = addDays(d, 1);
      }
      return days;
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
  }, [currentDate, view]);

  const entriesByDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    entries.forEach(e => {
      const key = format(new Date(e.start_datetime), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [entries]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="font-semibold text-sm">
          {view === "month" ? format(currentDate, "MMMM yyyy") : `Week of ${format(days[0], "MMM d")} - ${format(days[6], "MMM d, yyyy")}`}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map(d => (
          <div key={d} className="text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEntries = entriesByDate[key] || [];
          const inMonth = view === "month" ? isSameMonth(day, currentDate) : true;

          return (
            <div
              key={key}
              className={cn(
                "min-h-[80px] md:min-h-[100px] border-b border-r p-1 transition-colors",
                !inMonth && "bg-muted/30",
                isToday(day) && "bg-primary/5"
              )}
            >
              <span className={cn(
                "text-xs font-medium",
                isToday(day) && "text-primary font-bold",
                !inMonth && "text-muted-foreground/50"
              )}>
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEntries.slice(0, 3).map(e => {
                  return (
                    <div
                      key={e.id}
                      className="group/entry relative w-full rounded px-1 py-0.5 text-[10px] leading-tight text-primary-foreground"
                      style={{ backgroundColor: TASK_TYPE_COLORS[e.task_type] || TASK_TYPE_COLORS.other }}
                    >
                      <button
                        onClick={() => onEntryClick?.(e)}
                        className="w-full text-left hover:opacity-80 transition-opacity"
                        title={e.display_title || e.title}
                      >
                        <div className="truncate font-medium">{e.display_title || e.title}</div>
                        <div className="truncate opacity-80">
                          {format(new Date(e.start_datetime), "HH:mm")} - {format(new Date(e.end_datetime), "HH:mm")}
                        </div>
                      </button>
                      {onEntryDelete && (
                        <button
                          onClick={(ev) => { ev.stopPropagation(); onEntryDelete(e); }}
                          className="absolute top-0.5 right-0.5 hidden group-hover/entry:flex items-center justify-center h-5 w-5 rounded bg-destructive text-destructive-foreground z-10"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {dayEntries.length > 3 && (
                  <span className="text-[10px] text-muted-foreground pl-1">+{dayEntries.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkloadCalendar;
