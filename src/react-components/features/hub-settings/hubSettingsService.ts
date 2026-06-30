import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type HubRole = Database["public"]["Enums"]["hub_role"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Service to manage Supabase database interactions for global Hub Administration settings.
 */
export const hubSettingsService = {
  /**
   * Fetches all user profiles from the database, sorted alphabetically by email.
   */
  async getProfiles(): Promise<ProfileRow[]> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("email", { ascending: true });

    if (error) {
      console.error("Error fetching profiles from Supabase:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Invites or registers a new user to the Hub.
   * Auto-creates a dummy auth.users record if the user doesn't exist.
   */
  async createHubUser(email: string, role: HubRole): Promise<void> {
    const emailClean = email.trim().toLowerCase();
    if (!emailClean) {
      throw new Error("Invalid email address.");
    }

    // 1. Create or retrieve auth user UUID via the RPC helper
    const { data: uid, error: rpcError } = await supabase.rpc("create_dummy_user", {
      p_email: emailClean,
    });

    if (rpcError) {
      console.error("Error creating/retrieving dummy user in Supabase:", rpcError);
      throw rpcError;
    }

    if (!uid) {
      throw new Error("RPC function returned null UID for user registration.");
    }

    // 2. Update the auto-created profile with the desired hub role
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        hub_role: role,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("uid", uid);

    if (updateError) {
      console.error(`Error updating hub role for invited user ${uid}:`, updateError);
      throw updateError;
    }
  },

  /**
   * Updates the hub role of an existing user.
   */
  async updateHubRole(uid: string, role: HubRole): Promise<void> {
    if (!isValidUuid(uid)) {
      throw new Error("Invalid UUID format for user ID.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        hub_role: role,
        updated_at: new Date().toISOString(),
      })
      .eq("uid", uid);

    if (error) {
      console.error(`Error updating hub role of user ${uid}:`, error);
      throw error;
    }
  },

  /**
   * Deletes a user profile from the database, which cascades to delete all their project memberships.
   */
  async removeHubUser(uid: string): Promise<void> {
    if (!isValidUuid(uid)) {
      throw new Error("Invalid UUID format for user ID.");
    }

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("uid", uid);

    if (error) {
      console.error(`Error deleting profile for user ${uid}:`, error);
      throw error;
    }
  }
};
