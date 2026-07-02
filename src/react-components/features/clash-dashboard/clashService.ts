import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ClashReportRow = Database["public"]["Tables"]["clash_reports"]["Row"];
export type ClashViewpointRow = Database["public"]["Tables"]["clash_viewpoints"]["Row"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Service to manage Supabase database interactions for clash reports and viewpoints
 * pushed from the Navisworks add-in (PIAS-NavisAddIn, btn_ViewpointCloud).
 */
export const clashService = {
  /**
   * Fetches all clash import batches (clash_reports) for a project, most recent first.
   */
  async getClashReports(projectId: string): Promise<ClashReportRow[]> {
    if (!isValidUuid(projectId)) {
      return [];
    }
    const { data, error } = await supabase
      .from("clash_reports")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_deleted", false)
      .order("imported_at", { ascending: false });

    if (error) {
      console.error(`Error fetching clash reports for project ${projectId}:`, error);
      throw error;
    }

    return data || [];
  },

  /**
   * Fetches clash viewpoints for a project, optionally scoped to a single import batch.
   */
  async getClashViewpoints(
    projectId: string,
    reportId?: string | null
  ): Promise<ClashViewpointRow[]> {
    if (!isValidUuid(projectId)) {
      return [];
    }
    let query = supabase
      .from("clash_viewpoints")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_deleted", false)
      .order("occurred_at", { ascending: false });

    if (reportId) {
      query = query.eq("report_id", reportId);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching clash viewpoints for project ${projectId}:`, error);
      throw error;
    }

    return data || [];
  },

  /**
   * Updates a clash viewpoint's fields (e.g. status, type, comments, solution).
   */
  async updateClashViewpoint(
    id: string,
    updates: Partial<Omit<ClashViewpointRow, "id" | "project_id" | "report_id" | "guid">>
  ): Promise<ClashViewpointRow> {
    const { data, error } = await supabase
      .from("clash_viewpoints")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating clash viewpoint ${id}:`, error);
      throw error;
    }

    return data;
  },

  async deleteClashViewpoints(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const { error } = await supabase
      .from("clash_viewpoints")
      .update({ is_deleted: true } as any)
      .in("id", ids);

    if (error) {
      console.error(`Error deleting clash viewpoints:`, error);
      throw error;
    }
  },
};
