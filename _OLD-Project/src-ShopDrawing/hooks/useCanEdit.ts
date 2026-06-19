import { useUserRole } from "./useUserRole";
import { hasRoleOrHigher } from "@/types/roles";

/**
 * BIM viewer permission stub adapted to RITTA CONNXT roles.
 * Editors = engineer or higher; the `module` argument is ignored
 * (kept for source compatibility with the upstream digital twin code).
 */
export function useCanEdit(_module?: "bim" | "iot" | "workflow"): boolean {
  const { role } = useUserRole();
  return hasRoleOrHigher(role, "engineer");
}
