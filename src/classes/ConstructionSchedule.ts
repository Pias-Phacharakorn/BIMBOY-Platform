import { z } from "zod";

/**
 * The Schedule of a project's Construction Sequence — see `docs/glossary.md` § Construction
 * Sequence. Pure: no OBC, no React, no Supabase. The OBC side (`bim-components/ConstructionSequence`)
 * asks this what to change; this never touches a model.
 *
 * Input contract: `pias-4d-schedule/1`, written by `build_4d.py` in PIAS_Blender-MCP.
 */

const TaskSchema = z.object({
  id: z.string().min(1),
  building: z.string(),
  name: z.string(),
  start_month: z.number(),
  end_month: z.number(),
  guids: z.array(z.string()),
  ifc_files: z.array(z.string()).optional(),
  non_ifc_objects: z.number().optional(),
});

export const ScheduleSchema = z
  .object({
    schema: z.literal("pias-4d-schedule/1", { error: 'Not a "pias-4d-schedule/1" file' }),
    project: z.string().optional(),
    generated: z.string().optional(),
    source: z.string().optional(),
    // Validated, not assumed: a future `/2` with real dates must never be read as months.
    time_unit: z.literal("month", { error: 'time_unit must be "month"' }),
    months: z.number().positive(),
    highlight_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "highlight_color must be a #RRGGBB colour"),
    tasks: z.array(TaskSchema),
  })
  .superRefine((body, ctx) => {
    const owner = new Map<string, string>();
    body.tasks.forEach((task, index) => {
      if (task.end_month <= task.start_month) {
        ctx.addIssue({
          code: "custom",
          path: ["tasks", index],
          message: `Task ${task.id} must end after it starts (start ${task.start_month}, end ${task.end_month})`,
        });
      }
      if (task.start_month < 0 || task.end_month > body.months) {
        ctx.addIssue({
          code: "custom",
          path: ["tasks", index],
          message: `Task ${task.id} runs outside months 0–${body.months} (start ${task.start_month}, end ${task.end_month})`,
        });
      }
      // An element has exactly one state at every month only if it belongs to one Task.
      for (const guid of task.guids) {
        const first = owner.get(guid);
        if (first !== undefined && first !== task.id) {
          ctx.addIssue({
            code: "custom",
            path: ["tasks", index, "guids"],
            message: `GUID ${guid} is in both Task ${first} and Task ${task.id}`,
          });
        } else {
          owner.set(guid, task.id);
        }
      }
    });
  });

export type ScheduleBody = z.infer<typeof ScheduleSchema>;
export type ScheduleTask = ScheduleBody["tasks"][number];

/** An element's state at a month. Unscheduled elements have none — see {@link ConstructionSchedule.stateOf}. */
export type ElementState = "not-started" | "in-progress" | "built";

/** What changes between two months. GUIDs only; resolving them to geometry is the caller's job. */
export interface ScheduleDiff {
  /** GUIDs that must become visible. */
  show: string[];
  /** GUIDs that must become hidden. */
  hide: string[];
  /** Every In-progress GUID at the target month — the whole set, not a delta. */
  inProgress: string[];
}

export type ParseResult =
  | { ok: true; schedule: ConstructionSchedule }
  | { ok: false; errors: string[] };

/** Validates a parsed JSON value. Messages name the Task and the rule, for the admin who uploaded it. */
export function parseSchedule(input: unknown): ParseResult {
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) =>
        issue.code === "custom" || issue.path.length === 0
          ? issue.message
          : `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }
  return { ok: true, schedule: new ConstructionSchedule(parsed.data) };
}

export class ConstructionSchedule {
  readonly body: ScheduleBody;

  /**
   * Every Task start and end month, sorted and unique. Between two consecutive boundaries every
   * element's state is constant — which is why the viewport only has to change when a boundary is
   * crossed (ADR-0038 draft).
   */
  readonly boundaries: readonly number[];

  private readonly _taskOf = new Map<string, ScheduleTask>();

  constructor(body: ScheduleBody) {
    this.body = body;
    const marks = new Set<number>();
    for (const task of body.tasks) {
      marks.add(task.start_month);
      marks.add(task.end_month);
      for (const guid of task.guids) this._taskOf.set(guid, task);
    }
    this.boundaries = [...marks].sort((a, b) => a - b);
  }

  get tasks(): readonly ScheduleTask[] {
    return this.body.tasks;
  }

  get months() {
    return this.body.months;
  }

  get highlightColor() {
    return this.body.highlight_color;
  }

  /** Every GUID that belongs to some Task. */
  get guids(): IterableIterator<string> {
    return this._taskOf.keys();
  }

  get guidCount() {
    return this._taskOf.size;
  }

  /** `null` for an Unscheduled GUID — one that belongs to no Task. */
  stateOf(guid: string, month: number): ElementState | null {
    const task = this._taskOf.get(guid);
    return task ? taskState(task, month) : null;
  }

  taskState(task: ScheduleTask, month: number): ElementState {
    return taskState(task, month);
  }

  /**
   * Index of the interval `month` falls in: the number of boundaries at or below it. Two months
   * with the same index show the same picture.
   */
  intervalOf(month: number): number {
    let count = 0;
    for (const boundary of this.boundaries) {
      if (boundary <= month) count++;
      else break;
    }
    return count;
  }

  /**
   * What to change to go from month `from` to month `to`. `from = null` means "nothing applied
   * yet": every scheduled GUID lands in `show` or `hide`.
   */
  diff(from: number | null, to: number): ScheduleDiff {
    const inProgress: string[] = [];
    const show: string[] = [];
    const hide: string[] = [];
    const sameInterval = from !== null && this.intervalOf(from) === this.intervalOf(to);

    for (const task of this.body.tasks) {
      const next = taskState(task, to);
      if (next === "in-progress") inProgress.push(...task.guids);
      if (sameInterval) continue;

      const visibleNow = next !== "not-started";
      if (from === null) {
        (visibleNow ? show : hide).push(...task.guids);
        continue;
      }
      const visibleBefore = taskState(task, from) !== "not-started";
      if (visibleNow && !visibleBefore) show.push(...task.guids);
      else if (!visibleNow && visibleBefore) hide.push(...task.guids);
    }
    return { show, hide, inProgress };
  }

  /** Tasks running at `month`. */
  tasksInProgress(month: number): ScheduleTask[] {
    return this.body.tasks.filter((task) => taskState(task, month) === "in-progress");
  }
}

function taskState(task: ScheduleTask, month: number): ElementState {
  if (month < task.start_month) return "not-started";
  if (month < task.end_month) return "in-progress";
  return "built";
}
