import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shopDrawingsService } from "./shopDrawingsService";
import type { AppProject } from "@/types";

export const shopDrawingsKeys = {
  all: ["shop_drawings"] as const,
  lists: () => [...shopDrawingsKeys.all, "list"] as const,
  listByProject: (projectId: string) => [...shopDrawingsKeys.lists(), projectId] as const,
};

export function useShopDrawings(projectId: string | null | undefined) {
  return useQuery({
    queryKey: shopDrawingsKeys.listByProject(projectId || ""),
    queryFn: () => shopDrawingsService.listShopDrawings(projectId || ""),
    enabled: !!projectId,
  });
}

export function useCreateShopDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      project: AppProject;
      sheetNo: string;
      sheetName: string;
      author: string | null;
      pdfFile: File;
      createdBy: string | null;
    }) => shopDrawingsService.createShopDrawing(args),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: shopDrawingsKeys.listByProject(variables.project.id) });
    },
  });
}

export function useAddShopDrawingRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      project: AppProject;
      sheetNo: string;
      sheetName: string;
      author: string | null;
      revision: number;
      pdfFile: File;
      createdBy: string | null;
    }) => shopDrawingsService.addRevision(args),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: shopDrawingsKeys.listByProject(variables.project.id) });
    },
  });
}

export function useDeleteShopDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { projectId: string; id: string; pdfPath: string }) =>
      shopDrawingsService.deleteShopDrawing({ id: args.id, pdfPath: args.pdfPath }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: shopDrawingsKeys.listByProject(variables.projectId) });
    },
  });
}
