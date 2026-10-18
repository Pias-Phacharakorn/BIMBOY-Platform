/**
 * The 4D tab's left panel: the Schedule's Tasks as a compact Gantt grouped by building, plus the
 * upload / Replace control for project admins and the "show unscheduled" switch.
 *
 * A Task with no GUIDs (PSM's Facade Painting — built only in Blender) is listed and marked, never
 * dropped: otherwise a user watching that month concludes the viewer is broken.
 */

import { useMemo, useRef } from "react";
import { Icon } from "@/react-components/components/ui";
import { cn } from "@/lib/utils";
import type { ConstructionSchedule, ScheduleTask } from "@/classes/ConstructionSchedule";
import type { ConstructionSequenceTab } from "./useConstructionSequence";

interface ConstructionSchedulePanelProps {
  tab: ConstructionSequenceTab;
}

export function ConstructionSchedulePanel({ tab }: ConstructionSchedulePanelProps) {
  const { schedule, isLoading, loadError, canManage } = tab;

  if (isLoading) {
    return <p className="px-3 py-4 text-xs text-muted">Loading Schedule…</p>;
  }

  if (loadError) {
    return (
      <div className="px-3 py-4 text-xs text-status-danger" data-testid="cs-load-error">
        {(loadError as { message?: string })?.message ?? "Failed to load the Schedule."}
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex flex-col gap-3 px-3 py-4" data-testid="cs-empty">
        <p className="text-xs text-muted">No construction Schedule has been uploaded for this project yet.</p>
        {canManage && <UploadControl tab={tab} label="Upload Schedule (.json)" />}
        <UploadErrors errors={tab.uploadErrors} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted" data-testid="cs-summary">
            {schedule.tasks.length} Tasks · {schedule.months} months
          </span>
          {canManage && <UploadControl tab={tab} label="Replace" compact />}
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-fg">
          <input
            type="checkbox"
            checked={tab.showUnscheduled}
            onChange={(event) => tab.setShowUnscheduled(event.target.checked)}
            data-testid="cs-show-unscheduled"
            className="w-3.5 h-3.5 accent-accent cursor-pointer"
          />
          Show unscheduled elements
        </label>
        {tab.unresolved > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-status-warn" data-testid="cs-unresolved">
            <Icon name="WARNING" size={12} />
            {tab.unresolved.toLocaleString()} Schedule elements not found in the loaded models
          </span>
        )}
        <UploadErrors errors={tab.uploadErrors} />
      </div>
      <TaskGantt schedule={schedule} month={tab.month ?? schedule.months} onTaskClick={tab.jumpToTask} />
    </div>
  );
}

function TaskGantt({
  schedule,
  month,
  onTaskClick,
}: {
  schedule: ConstructionSchedule;
  month: number;
  onTaskClick: (task: ScheduleTask) => void;
}) {
  // Grouped by building in first-seen order, which is the order `build_4d.py` writes them.
  const groups = useMemo(() => {
    const byBuilding = new Map<string, ScheduleTask[]>();
    for (const task of schedule.tasks) {
      const list = byBuilding.get(task.building);
      if (list) list.push(task);
      else byBuilding.set(task.building, [task]);
    }
    return [...byBuilding.entries()];
  }, [schedule]);

  const span = schedule.months;
  const cursor = `${(Math.min(month, span) / span) * 100}%`;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" data-testid="cs-gantt">
      {groups.map(([building, tasks]) => (
        <section key={building} data-testid="cs-building">
          <h3 className="sticky top-0 z-10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted bg-surface-alt border-b border-border">
            {building}
          </h3>
          {tasks.map((task) => {
            const state = schedule.taskState(task, month);
            const empty = task.guids.length === 0;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onTaskClick(task)}
                data-testid="cs-task"
                data-task-id={task.id}
                data-state={state}
                title={`${task.name}: month ${task.start_month} → ${task.end_month}`}
                className={cn(
                  "w-full flex flex-col gap-1 px-3 py-1.5 text-left border-b border-border cursor-pointer transition-colors duration-120 hover:bg-surface-alt",
                  state === "in-progress" && "bg-accent-muted/40",
                )}
              >
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className={cn("truncate", state === "not-started" ? "text-muted" : "text-fg")}>
                    {task.name}
                  </span>
                  {empty && (
                    <span className="shrink-0 text-[10px] text-muted-2" data-testid="cs-task-empty">
                      nothing to show
                    </span>
                  )}
                </span>
                <span className="relative block h-1.5 rounded-full bg-border">
                  <span
                    className={cn(
                      "absolute inset-y-0 rounded-full",
                      state === "in-progress" ? "bg-status-ok" : state === "built" ? "bg-muted-2" : "bg-border-strong",
                    )}
                    style={{
                      left: `${(task.start_month / span) * 100}%`,
                      width: `${((task.end_month - task.start_month) / span) * 100}%`,
                    }}
                  />
                  <span className="absolute -inset-y-0.5 w-px bg-accent" style={{ left: cursor }} />
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function UploadControl({
  tab,
  label,
  compact = false,
}: {
  tab: ConstructionSequenceTab;
  label: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="cs-upload-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void tab.uploadFile(file);
        }}
      />
      <button
        type="button"
        disabled={tab.isUploading}
        onClick={() => inputRef.current?.click()}
        data-testid="cs-upload"
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-radius border border-border-strong font-semibold text-fg transition-colors duration-120 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
          compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-xs",
        )}
      >
        <Icon name="UPLOAD" size={compact ? 12 : 14} />
        {tab.isUploading ? "Uploading…" : label}
      </button>
    </>
  );
}

function UploadErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-[11px] text-status-danger" data-testid="cs-upload-errors">
      {errors.slice(0, 8).map((error) => (
        <li key={error}>{error}</li>
      ))}
      {errors.length > 8 && <li>…and {errors.length - 8} more</li>}
    </ul>
  );
}
