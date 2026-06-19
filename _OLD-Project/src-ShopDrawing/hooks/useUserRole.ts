import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/roles";

interface UseUserRoleResult {
  role: AppRole | null;
  loading: boolean;
  userId: string | null;
}

export function useUserRole(): UseUserRoleResult {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchUserRole = async (uid: string) => {
      try {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .maybeSingle();

        if (isMounted) {
          setRole(roleData?.role as AppRole ?? null);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (isMounted) {
          setRole(null);
        }
      }
    };

    // Set up auth state listener for ONGOING changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        if (session?.user) {
          setUserId(session.user.id);
          // Fire and forget - don't await, don't set loading here
          fetchUserRole(session.user.id);
        } else {
          setRole(null);
          setUserId(null);
        }
      }
    );

    // INITIAL load (controls loading state)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          setUserId(session.user.id);
          // Fetch role BEFORE setting loading false
          await fetchUserRole(session.user.id);
        } else {
          setRole(null);
          setUserId(null);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        // Ensure loading is set to false ONLY after all initial checks are done
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { role, loading, userId };
}
