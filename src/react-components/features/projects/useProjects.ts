import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { projectsService } from "./projectsService";
import type { InsertProject, ProjectRow, UpdateProject, ProjectMemberWithProfile } from "./projectsService";
import type { AppProject } from "@/types";
import { projectsManager } from "@/classes/ProjectsManager";
import { Project } from "@/classes/Project";

export const projectsKeys = {
  all: ["projects"] as const,
  lists: () => [...projectsKeys.all, "list"] as const,
  details: () => [...projectsKeys.all, "detail"] as const,
  detail: (id: string) => [...projectsKeys.details(), id] as const,
  membersAll: ["project_members"] as const,
  membersOfProject: (projectId: string) => [...projectsKeys.membersAll, projectId] as const,
};

/**
 * Maps a raw Supabase ProjectRow to the UI-expected AppProject format.
 */
export function mapProjectRowToAppProject(row: ProjectRow): AppProject {
  const statusToneMap: Record<string, "ok" | "warn" | "neutral"> = {
    active: "ok",
    bidding: "warn",
    finished: "neutral",
  };

  const statusLabelMap: Record<string, string> = {
    active: "Active",
    bidding: "Bidding",
    finished: "Finished",
  };

  const startDate = new Date(row.start_date);
  const finishDate = new Date(row.finish_date);

  return {
    id: row.id,
    projectName: row.project_name,
    projectnumber: row.project_number,
    description: row.description || "",
    status: row.status as any,
    startDate,
    finishDate,
    members: [],
    files: {
      ifc: row.ifc_folder_path || "",
      ifcURL: "",
      frag: row.frag_folder_path || "",
      fragURL: "",
      hasModel: row.has_model,
    },
    cost: 0,
    progress: 0,
    clashFolderPath: row.clash_folder_path || "",
    location: {
      latitude: row.latitude || 0,
      longitude: row.longitude || 0,
      rotation: row.rotation || 0,
      elevation: row.elevation || 0,
    },
    powerbiTabs: (row.powerbi_tabs as any) || [],
    display: {
      code: row.project_name.slice(0, 3).toUpperCase(),
      label: row.project_number.toString(),
      estimatedCompletion: format(finishDate, "MMM yyyy"),
      startDateLabel: format(startDate, "MMM dd, yyyy"),
      finishDateLabel: format(finishDate, "MMM dd, yyyy"),
      statusLabel: statusLabelMap[row.status] || row.status,
      statusTone: (statusToneMap[row.status] || "neutral") as any,
      progress: 0,
      image: "https://piasbimwebapp.web.app/__New_UI-Design/mp9tdjw6-image.png",
    },
  } as any;
}

/**
 * Hook to query all active projects, mapped to UI AppProject format.
 */
export function useProjects() {
  return useQuery<AppProject[]>({
    queryKey: projectsKeys.lists(),
    queryFn: async () => {
      const rows = await projectsService.getProjects();
      const mapped = rows.map(mapProjectRowToAppProject);

      // Populate projectsManager with proper Class Project objects
      projectsManager.list = [];
      for (const p of mapped) {
        const projInstance = new Project({
          projectName: p.projectName,
          projectnumber: p.projectnumber,
          description: p.description,
          status: p.status as any,
          startDate: p.startDate,
          finishDate: p.finishDate,
          members: p.members,
          files: p.files,
        }, p.id);

        projInstance.cost = p.cost;
        projInstance.progress = p.progress;

        const appProj = Object.assign(projInstance, { display: p.display, location: p.location }) as AppProject;
        projectsManager.list.push(appProj);
      }

      // Notify any active GIS listeners that projects are loaded
      const listeners = (projectsManager as any)._onProjectsLoadedListeners;
      if (listeners) {
        for (const cb of listeners) {
          cb(projectsManager.list);
        }
      }

      return mapped;
    },
  });
}

/**
 * Hook to query a single project by ID, mapped to UI AppProject format.
 */
export function useProject(id: string | null | undefined) {
  return useQuery<AppProject | null>({
    queryKey: projectsKeys.detail(id || ""),
    queryFn: async () => {
      const row = await projectsService.getProjectById(id || "");
      return row ? mapProjectRowToAppProject(row) : null;
    },
    enabled: !!id,
  });
}

/**
 * Mutation hook to create a new project.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newProject: InsertProject) => projectsService.createProject(newProject),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
    },
  });
}

/**
 * Mutation hook to update project details.
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, project }: { id: string; project: UpdateProject }) =>
      projectsService.updateProject(id, project),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(variables.id) });
    },
  });
}

/**
 * Mutation hook to soft-delete a project.
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsService.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
    },
  });
}

/**
 * Hook to query members of a specific project.
 */
export function useProjectMembers(projectId: string | null | undefined) {
  return useQuery<ProjectMemberWithProfile[]>({
    queryKey: projectsKeys.membersOfProject(projectId || ""),
    queryFn: () => projectsService.getProjectMembers(projectId || ""),
    enabled: !!projectId,
  });
}

/**
 * Hook to check if a user is a project admin or global hub admin.
 */
export function useIsProjectAdmin(
  projectId: string | null | undefined,
  userId: string | null | undefined,
  isHubAdmin: boolean
) {
  const { data: members = [] } = useProjectMembers(projectId);

  if (!userId) return false;
  if (isHubAdmin) return true;

  return members.some(
    (m) => m.uid === userId && m.role === "project_admin" && m.is_active
  );
}

/**
 * Mutation hook to add a new project member.
 */
export function useAddProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      email,
      role,
    }: {
      projectId: string;
      email: string;
      role: "project_admin" | "project_member";
    }) => projectsService.addProjectMember(projectId, email, role),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersOfProject(variables.projectId) });
    },
  });
}

/**
 * Mutation hook to remove a project member.
 */
export function useRemoveProjectMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, uid }: { projectId: string; uid: string }) =>
      projectsService.removeProjectMember(projectId, uid),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersOfProject(variables.projectId) });
    },
  });
}

/**
 * Mutation hook to update a project member's role.
 */
export function useUpdateProjectMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      uid,
      role,
    }: {
      projectId: string;
      uid: string;
      role: "project_admin" | "project_member";
    }) => projectsService.updateProjectMemberRole(projectId, uid, role),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.membersOfProject(variables.projectId) });
    },
  });
}
