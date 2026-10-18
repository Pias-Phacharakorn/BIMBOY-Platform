/**
 * Data access for `construction_schedules` — one row per project, replaced whole on upload.
 * Shaped like `iotDevicesService.ts`: plain async functions that log and rethrow.
 *
 * Row-level security does the authorisation: read = member, write = project admin. The UI hides
 * Upload / Replace from non-admins as a courtesy only.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { parseSchedule, type ConstructionSchedule } from "@/classes/ConstructionSchedule";

const TABLE = "construction_schedules";

export interface StoredSchedule {
  schedule: ConstructionSchedule;
  uploadedAt: string;
}

export const constructionScheduleService = {
  /**
   * The project's Schedule, or `null` when none has been uploaded. A stored body that no longer
   * validates throws: a bad row must fail visibly, never play as a half-read Schedule.
   */
  async getByProject(projectId: string): Promise<StoredSchedule | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("body, uploaded_at")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      console.error(`[4d] failed to read the Schedule for project ${projectId}:`, error);
      throw error;
    }
    if (!data) return null;

    const parsed = parseSchedule(data.body);
    if (!parsed.ok) {
      throw new Error(`The stored Schedule is invalid: ${parsed.errors.join("; ")}`);
    }
    return { schedule: parsed.schedule, uploadedAt: data.uploaded_at };
  },

  /** Inserts or replaces the project's Schedule. The caller has already validated `schedule`. */
  async upsert(projectId: string, schedule: ConstructionSchedule, uploadedBy: string | null) {
    const { error } = await supabase.from(TABLE).upsert(
      {
        project_id: projectId,
        body: schedule.body as unknown as Json,
        uploaded_by: uploadedBy,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );

    if (error) {
      console.error(`[4d] failed to save the Schedule for project ${projectId}:`, error);
      throw error;
    }
  },
};
