/**
 * TanStack Query wrappers over `constructionScheduleService`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConstructionSchedule } from "@/classes/ConstructionSchedule";
import { constructionScheduleService, type StoredSchedule } from "./constructionScheduleService";

export const constructionScheduleKeys = {
  all: ["construction-schedule"] as const,
  byProject: (projectId: string) => [...constructionScheduleKeys.all, projectId] as const,
};

export function useConstructionSchedule(projectId: string | undefined, enabled: boolean) {
  return useQuery<StoredSchedule | null>({
    queryKey: constructionScheduleKeys.byProject(projectId ?? "none"),
    queryFn: () => constructionScheduleService.getByProject(projectId!),
    enabled: enabled && !!projectId,
    // Changes only when an admin uploads, which invalidates below. The body is ~200 KB.
    staleTime: 5 * 60_000,
  });
}

export function useUploadConstructionSchedule(projectId: string | undefined, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schedule: ConstructionSchedule) =>
      constructionScheduleService.upsert(projectId!, schedule, userId),
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: constructionScheduleKeys.byProject(projectId) });
      }
    },
  });
}
