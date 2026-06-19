import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext, type MyContext } from "@/lib/projects.functions";
import { useAuth } from "./useAuth";
import { useDigitalTwinStore } from "@/store/useDigitalTwinStore";

/**
 * Loads the signed-in user's app role + accessible projects.
 * Also ensures `activeProjectId` in the store points at a project the user
 * actually has access to.
 */
export function useProjectContext() {
  const { user } = useAuth();
  const fetchCtx = useServerFn(getMyContext);

  const query = useQuery<MyContext>({
    queryKey: ["my-context", user?.id ?? "anon"],
    queryFn: () => fetchCtx(),
    enabled: !!user,
    staleTime: 30_000,
  });

  const activeProjectId = useDigitalTwinStore((s) => s.activeProjectId);
  const setActiveProjectId = useDigitalTwinStore((s) => s.setActiveProjectId);

  useEffect(() => {
    if (!query.data) return;
    const projects = query.data.projects;
    if (projects.length === 0) {
      if (activeProjectId) setActiveProjectId(null);
      return;
    }
    const exists = projects.some((p) => p.id === activeProjectId);
    if (!exists) setActiveProjectId(projects[0].id);
  }, [query.data, activeProjectId, setActiveProjectId]);

  return query;
}

export function useActiveProject() {
  const { data } = useProjectContext();
  const activeProjectId = useDigitalTwinStore((s) => s.activeProjectId);
  return data?.projects.find((p) => p.id === activeProjectId) ?? null;
}

export function useIsAdmin() {
  const { data } = useProjectContext();
  return data?.appRole === "admin";
}