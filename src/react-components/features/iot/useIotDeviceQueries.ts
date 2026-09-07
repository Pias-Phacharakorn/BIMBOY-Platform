/**
 * TanStack Query wrappers over `iotDevicesService`. Async data belongs here, never in a view or a
 * route — see `CLAUDE.md` § *Where Code Lives*.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  iotDevicesService,
  type CreateIotDeviceInput,
  type UpdateIotDeviceInput,
} from "./iotDevicesService";
import type { IotDevice } from "./iotTypes";

export const iotDeviceKeys = {
  all: ["iot-devices"] as const,
  byProject: (projectId: string) => [...iotDeviceKeys.all, "project", projectId] as const,
};

export function useIotDeviceList(projectId: string | undefined, enabled: boolean) {
  return useQuery<IotDevice[]>({
    queryKey: iotDeviceKeys.byProject(projectId ?? "none"),
    queryFn: () => iotDevicesService.listByProject(projectId!),
    enabled: enabled && !!projectId,
    // Devices change only when someone binds or edits one — a deliberate act by an admin, always
    // followed by an invalidation below. Re-fetching on every window focus would be pure noise.
    staleTime: 60_000,
  });
}

export function useCreateIotDevice(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIotDeviceInput) => iotDevicesService.create(input),
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: iotDeviceKeys.byProject(projectId) });
      }
    },
  });
}

export function useUpdateIotDevice(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateIotDeviceInput) => iotDevicesService.update(input),
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: iotDeviceKeys.byProject(projectId) });
      }
    },
  });
}

export function useDeleteIotDevice(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => iotDevicesService.remove(id),
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: iotDeviceKeys.byProject(projectId) });
      }
    },
  });
}
