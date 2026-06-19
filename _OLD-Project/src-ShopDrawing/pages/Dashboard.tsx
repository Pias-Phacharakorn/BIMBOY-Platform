import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ShopDrawingTable from "@/components/ShopDrawingTable";
import { useUserRole } from "@/hooks/useUserRole";
import { canManageUsers } from "@/types/roles";
import { useActiveProject } from "@/hooks/useActiveProject";

const Dashboard = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const { selectedProject } = useActiveProject();
  const [loading, setLoading] = useState(true);
  const [hasProjects, setHasProjects] = useState(false);

  const isProjectAdmin = canManageUsers(role);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      if (!isProjectAdmin) {
        const { data: memberData } = await supabase
          .from("project_members")
          .select("project_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle();
        setHasProjects(!!memberData);
      }
      setLoading(false);
    };
    if (!roleLoading) checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate, roleLoading, isProjectAdmin]);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="animate-fade-in container mx-auto px-4 md:px-6 py-6 md:py-8">
      {isProjectAdmin ? (
        <>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">Shop Drawings</h1>
          <ShopDrawingTable selectedProjectId={selectedProject} />
        </>
      ) : hasProjects ? (
        <>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">Project Sheets</h1>
          <ShopDrawingTable selectedProjectId={selectedProject} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="max-w-md space-y-4">
            <h2 className="text-2xl font-bold text-foreground">No Project Access</h2>
            <p className="text-muted-foreground text-lg">
              You are not assigned to any project yet. Please contact your administrator to be added to a project.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
