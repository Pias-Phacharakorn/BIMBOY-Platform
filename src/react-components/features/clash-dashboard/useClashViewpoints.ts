import { useQuery } from "@tanstack/react-query";
import { clashService } from "./clashService";
import type { ClashReportRow, ClashViewpointRow } from "./clashService";
import type { ClashItem, ClashReport, ClashCamera } from "@/types";

export const clashKeys = {
  all: ["clashes"] as const,
  reports: (projectId: string) => [...clashKeys.all, "reports", projectId] as const,
  viewpoints: (projectId: string, reportId?: string | null) =>
    [...clashKeys.all, "viewpoints", projectId, reportId ?? "all"] as const,
};

/**
 * Maps a raw Supabase clash_reports row to the UI-facing ClashReport format.
 */
export function mapClashReportRowToClashReport(row: ClashReportRow): ClashReport {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    sourceFormat: row.source_format,
    totalCount: row.total_count,
    majorCount: row.major_count,
    minorCount: row.minor_count,
    regulationCount: row.regulation_count,
    resolvedCount: row.resolved_count,
    importedBy: row.imported_by,
    importedAt: row.imported_at,
  };
}

/**
 * Maps a raw Supabase clash_viewpoints row to the UI-facing ClashItem format.
 */
export function mapClashViewpointRowToClashItem(row: ClashViewpointRow): ClashItem {
  return {
    id: row.id,
    projectId: row.project_id,
    reportId: row.report_id,
    guid: row.guid,
    name: row.name,
    path: row.path,
    type: row.type,
    status: row.status,
    markup: row.markup,
    solution: row.solution,
    comments: row.comments,
    imageUrl: row.image_url,
    planImageUrl: row.plan_image_url,
    sectionImageUrl: row.section_image_url,
    camera: row.camera as ClashCamera | null,
    selection: row.selection as string[] | null,
    occurredAt: row.occurred_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Hook to query all clash import batches for a project.
 */
export function useClashReports(projectId: string | null | undefined) {
  return useQuery<ClashReport[]>({
    queryKey: clashKeys.reports(projectId || ""),
    queryFn: async () => {
      const rows = await clashService.getClashReports(projectId || "");
      return rows.map(mapClashReportRowToClashReport);
    },
    enabled: !!projectId,
  });
}

/**
 * Hook to query clash viewpoints for a project, optionally scoped to one import batch.
 */
export function useClashViewpoints(
  projectId: string | null | undefined,
  reportId?: string | null
) {
  return useQuery<ClashItem[]>({
    queryKey: clashKeys.viewpoints(projectId || "", reportId),
    queryFn: async () => {
      const rows = await clashService.getClashViewpoints(projectId || "", reportId);
      return rows.map(mapClashViewpointRowToClashItem);
    },
    enabled: !!projectId,
  });
}
