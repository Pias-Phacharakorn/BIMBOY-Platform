import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type InsertProject = Database["public"]["Tables"]["projects"]["Insert"];
export type UpdateProject = Database["public"]["Tables"]["projects"]["Update"];
export type ProjectMemberRow = Database["public"]["Tables"]["project_members"]["Row"];

export type ProjectMemberWithProfile = ProjectMemberRow & {
  profiles: {
    email: string;
  } | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Service to manage Supabase database interactions for projects and project memberships.
 */
export const projectsService = {
  /**
   * Fetches all active projects from the database (via active_projects view).
   */
  async getProjects(): Promise<ProjectRow[]> {
    const { data, error } = await supabase
      .from("active_projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching projects from Supabase:", error);
      throw error;
    }

    return (data || []) as unknown as ProjectRow[];
  },

  /**
   * Fetches a single project by ID.
   */
  async getProjectById(id: string): Promise<ProjectRow | null> {
    if (!isValidUuid(id)) {
      return null;
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching project ${id} from Supabase:`, error);
      throw error;
    }

    return data;
  },

  /**
   * Inserts a new project into the database.
   */
  async createProject(project: InsertProject): Promise<ProjectRow> {
    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select()
      .single();

    if (error) {
      console.error("Error creating project in Supabase:", error);
      throw error;
    }

    return data;
  },

  /**
   * Updates project settings in the database.
   */
  async updateProject(id: string, project: UpdateProject): Promise<ProjectRow> {
    if (!isValidUuid(id)) {
      throw new Error("Invalid UUID format for project ID.");
    }
    const { data, error } = await supabase
      .from("projects")
      .update(project)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Error updating project ${id} in Supabase:`, error);
      throw error;
    }

    return data;
  },

  /**
   * Soft-deletes a project in the database.
   */
  async deleteProject(id: string): Promise<void> {
    if (!isValidUuid(id)) {
      throw new Error("Invalid UUID format for project ID.");
    }
    const { error } = await supabase
      .from("projects")
      .update({ is_deleted: true })
      .eq("id", id);

    if (error) {
      console.error(`Error deleting project ${id} in Supabase:`, error);
      throw error;
    }
  },

  /**
   * Fetches all members of a project, including their emails from their profiles.
   */
  async getProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
    if (!isValidUuid(projectId)) {
      return [];
    }
    const { data, error } = await supabase
      .from("project_members")
      .select(`
        project_id,
        uid,
        role,
        added_by,
        added_by_email,
        added_at,
        is_active,
        profiles:profiles!project_members_uid_fkey (
          email
        )
      `)
      .eq("project_id", projectId);

    if (error) {
      console.error(`Error fetching project members for project ${projectId}:`, error);
      throw error;
    }

    return (data || []) as unknown as ProjectMemberWithProfile[];
  },

  /**
   * Adds a new project member by email, auto-creating a dummy auth.users record if required.
   */
  async addProjectMember(
    projectId: string,
    email: string,
    role: "project_admin" | "project_member"
  ): Promise<void> {
    if (!isValidUuid(projectId)) {
      throw new Error("Invalid UUID format for project ID.");
    }
    // 1. Create or retrieve auth user UUID via the RPC helper
    const { data: uid, error: rpcError } = await supabase.rpc("create_dummy_user", {
      p_email: email.trim().toLowerCase(),
    });

    if (rpcError) {
      console.error("Error creating/retrieving dummy user in Supabase:", rpcError);
      throw rpcError;
    }

    if (!uid) {
      throw new Error("RPC function returned null UID for user registration.");
    }

    // 2. Insert the membership row
    const { error: insertError } = await supabase
      .from("project_members")
      .insert({
        project_id: projectId,
        uid: uid,
        role: role,
        added_by_email: "pias.phacharakorn@gmail.com", // Mock developer context
        is_active: true,
      });

    if (insertError) {
      console.error("Error inserting project member record in Supabase:", insertError);
      throw insertError;
    }
  },

  /**
   * Removes a member from a project.
   */
  async removeProjectMember(projectId: string, uid: string): Promise<void> {
    if (!isValidUuid(projectId) || !isValidUuid(uid)) {
      throw new Error("Invalid UUID format for project ID or user ID.");
    }
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("uid", uid);

    if (error) {
      console.error(`Error removing project member ${uid} from project ${projectId}:`, error);
      throw error;
    }
  },

  /**
   * Updates the role of a project member.
   */
  async updateProjectMemberRole(
    projectId: string,
    uid: string,
    role: "project_admin" | "project_member"
  ): Promise<void> {
    if (!isValidUuid(projectId) || !isValidUuid(uid)) {
      throw new Error("Invalid UUID format for project ID or user ID.");
    }
    const { error } = await supabase
      .from("project_members")
      .update({ role: role })
      .eq("project_id", projectId)
      .eq("uid", uid);

    if (error) {
      console.error(`Error updating role of project member ${uid} in project ${projectId}:`, error);
      throw error;
    }
  }
};
