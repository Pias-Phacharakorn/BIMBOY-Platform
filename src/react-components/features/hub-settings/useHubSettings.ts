import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hubSettingsService } from "./hubSettingsService";
import type { ProfileRow, HubRole } from "./hubSettingsService";

export const hubSettingsKeys = {
  all: ["hub_settings"] as const,
  profiles: () => [...hubSettingsKeys.all, "profiles"] as const,
};

/**
 * Hook to query all user profiles.
 */
export function useHubProfiles() {
  return useQuery<ProfileRow[]>({
    queryKey: hubSettingsKeys.profiles(),
    queryFn: () => hubSettingsService.getProfiles(),
  });
}

/**
 * Mutation hook to invite/register a hub user.
 */
export function useAddHubUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: HubRole }) =>
      hubSettingsService.createHubUser(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubSettingsKeys.profiles() });
    },
  });
}

/**
 * Mutation hook to update a user's hub role.
 */
export function useUpdateHubRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: HubRole }) =>
      hubSettingsService.updateHubRole(uid, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubSettingsKeys.profiles() });
    },
  });
}

/**
 * Mutation hook to remove a user from the hub.
 */
export function useRemoveHubUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uid: string) => hubSettingsService.removeHubUser(uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubSettingsKeys.profiles() });
    },
  });
}
