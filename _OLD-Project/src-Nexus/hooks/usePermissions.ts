import { useActiveProject, useIsAdmin } from "./useProjectContext";
import type { ModuleKey, PermissionLevel } from "@/lib/projects.functions";

/**
 * Returns the current user's permission level for a module on the active
 * project, or `null` if they have no access.
 */
export function useModuleLevel(module: ModuleKey): PermissionLevel | null {
  const isAdmin = useIsAdmin();
  const project = useActiveProject();
  if (isAdmin) return "full";
  return project?.modules[module] ?? null;
}

export function useCanView(module: ModuleKey) {
  return useModuleLevel(module) !== null;
}

export function useCanEdit(module: ModuleKey) {
  const lvl = useModuleLevel(module);
  return lvl === "full" || lvl === "editor";
}

export function useCanDelete(module: ModuleKey) {
  return useModuleLevel(module) === "full";
}