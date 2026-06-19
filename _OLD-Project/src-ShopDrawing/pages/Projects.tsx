import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { canManageUsers } from "@/types/roles";
import ProjectManager from "@/components/ProjectManager";

const Projects = () => {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();

  useEffect(() => {
    if (!loading && !canManageUsers(role)) navigate("/dashboard");
  }, [role, loading, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>;
  }
  if (!canManageUsers(role)) return null;

  return (
    <div className="animate-fade-in container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Projects & Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage projects, members and user roles.</p>
      </div>
      <ProjectManager />
    </div>
  );
};

export default Projects;
