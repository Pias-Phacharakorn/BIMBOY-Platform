import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users } from "lucide-react";
import UserRoleManager from "@/components/UserRoleManager";
interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

interface ProjectMember {
  user_id: string;
  profiles: Profile;
}

const ProjectManager = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [manageMembersDialogOpen, setManageMembersDialogOpen] = useState(false);
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(false);
  const [projectStats, setProjectStats] = useState<Record<string, { members: number; drawings: number }>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      fetchProjectStats();
    }
  }, [projects]);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectMembers(selectedProject);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch projects.",
        variant: "destructive",
      });
      return;
    }

    setProjects(data || []);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("first_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users.",
        variant: "destructive",
      });
      return;
    }

    setUsers(data || []);
  };

  const fetchProjectStats = async () => {
    if (projects.length === 0) return;
    
    // Fetch all stats in parallel for all projects
    const statsPromises = projects.map(async (project) => {
      const [membersResult, drawingsResult] = await Promise.all([
        supabase.from("project_members").select("*", { count: "exact", head: true }).eq("project_id", project.id),
        supabase.from("shop_drawings").select("*", { count: "exact", head: true }).eq("project_id", project.id).eq("is_latest", true),
      ]);

      return {
        projectId: project.id,
        members: membersResult.count || 0,
        drawings: drawingsResult.count || 0,
      };
    });

    const results = await Promise.all(statsPromises);
    
    const stats: Record<string, { members: number; drawings: number }> = {};
    results.forEach(result => {
      stats[result.projectId] = {
        members: result.members,
        drawings: result.drawings,
      };
    });

    setProjectStats(stats);
  };

  const fetchProjectMembers = async (projectId: string) => {
    const { data, error } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch project members.",
        variant: "destructive",
      });
      return;
    }

    if (!data) {
      setProjectMembers([]);
      return;
    }

    // Fetch profile information for each member
    const memberIds = data.map(m => m.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .in("id", memberIds);

    if (profilesError) {
      toast({
        title: "Error",
        description: "Failed to fetch member profiles.",
        variant: "destructive",
      });
      return;
    }

    const membersWithProfiles = data.map(member => ({
      user_id: member.user_id,
      profiles: profilesData?.find(p => p.id === member.user_id) || {
        id: member.user_id,
        first_name: "Unknown",
        last_name: "User"
      }
    }));

    setProjectMembers(membersWithProfiles);
  };

  const createProject = async () => {
    const trimmedName = newProjectName.trim();
    const trimmedDesc = newProjectDesc.trim();

    // Input validation
    if (!trimmedName) {
      toast({
        title: "Error",
        description: "Project name is required.",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length > 100) {
      toast({
        title: "Error",
        description: "Project name is too long (max 100 characters).",
        variant: "destructive",
      });
      return;
    }

    if (trimmedDesc.length > 500) {
      toast({
        title: "Error",
        description: "Description is too long (max 500 characters).",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("projects")
      .insert({
        name: trimmedName,
        description: trimmedDesc || null,
        created_by: user.id,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create project.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "Project created successfully.",
    });

    setNewProjectName("");
    setNewProjectDesc("");
    setCreateDialogOpen(false);
    fetchProjects();
  };

  const addUserToProject = async () => {
    if (!selectedProject || !selectedUser) {
      toast({
        title: "Error",
        description: "Please select both a project and a user.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("project_members")
      .insert({
        project_id: selectedProject,
        user_id: selectedUser,
      });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Error",
          description: "User is already a member of this project.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add user to project.",
          variant: "destructive",
        });
      }
      return;
    }

    toast({
      title: "Success",
      description: "User added to project successfully.",
    });

    setSelectedUser("");
    fetchProjectMembers(selectedProject);
    fetchProjectStats();
  };

  const removeUserFromProject = async (userId: string) => {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", selectedProject)
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove user from project.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "User removed from project.",
    });

    fetchProjectMembers(selectedProject);
    fetchProjectStats();
  };

  const openProjectDetails = (projectId: string) => {
    setSelectedProject(projectId);
    setProjectDetailsOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Add a new project to track shop drawings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name</Label>
                <Input
                  id="projectName"
                  placeholder="Enter project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectDesc">Description (Optional)</Label>
                <Input
                  id="projectDesc"
                  placeholder="Enter project description"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                />
              </div>
              <Button onClick={createProject} className="w-full">
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <UserRoleManager />

        <Dialog open={manageMembersDialogOpen} onOpenChange={setManageMembersDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Users className="h-4 w-4" />
              Manage Project Members
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Project Members</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Add or remove users from specific projects to control their access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Project</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProject && (
                <>
                  <div className="flex gap-2">
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={addUserToProject}>Add User</Button>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Current Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {projectMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No members yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {projectMembers.map((member) => (
                            <div
                              key={member.user_id}
                              className="flex items-center justify-between p-2 border rounded"
                            >
                              <span className="text-sm">
                                {member.profiles.first_name} {member.profiles.last_name}
                              </span>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeUserFromProject(member.user_id)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card 
            key={project.id} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => openProjectDetails(project.id)}
          >
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {project.description || "No description"}
              </p>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{projectStats[project.id]?.members || 0} members</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">📄</span>
                  <span>{projectStats[project.id]?.drawings || 0} drawings</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Project Details Dialog */}
      <Dialog open={projectDetailsOpen} onOpenChange={setProjectDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {projects.find(p => p.id === selectedProject)?.name || "Project Details"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Manage project members and view details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Members</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projectStats[selectedProject]?.members || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Shop Drawings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{projectStats[selectedProject]?.drawings || 0}</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addUserToProject}>Add User</Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Members</CardTitle>
              </CardHeader>
              <CardContent>
                {projectMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <div className="space-y-2">
                    {projectMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <span className="text-sm">
                          {member.profiles.first_name} {member.profiles.last_name}
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeUserFromProject(member.user_id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectManager;
