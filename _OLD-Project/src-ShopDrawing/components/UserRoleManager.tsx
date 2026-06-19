import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type AppRole } from "@/types/roles";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

interface UserWithRole {
  user_id: string;
  role: AppRole;
  profile: Profile;
}

const UserRoleManager = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsersWithRoles();
  }, []);

  const fetchUsersWithRoles = async () => {
    setLoading(true);
    
    // Fetch all user roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .order("created_at", { ascending: true });

    if (rolesError) {
      toast({
        title: "Error",
        description: "Failed to fetch user roles.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!rolesData || rolesData.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for all users
    const userIds = rolesData.map(r => r.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", userIds);

    if (profilesError) {
      toast({
        title: "Error",
        description: "Failed to fetch user profiles.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Combine roles with profiles
    const usersWithRoles = rolesData.map(roleEntry => {
      const profile = profilesData?.find(p => p.id === roleEntry.user_id) || {
        id: roleEntry.user_id,
        first_name: "Unknown",
        last_name: "User"
      };
      return {
        user_id: roleEntry.user_id,
        role: roleEntry.role as AppRole,
        profile
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "User role updated successfully.",
    });

    fetchUsersWithRoles();
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'project_admin':
        return 'default';
      case 'engineer':
        return 'secondary';
      case 'modeler':
        return 'outline';
      case 'viewer':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleBadgeClass = (role: AppRole) => {
    switch (role) {
      case 'project_admin':
        return 'bg-purple-500 hover:bg-purple-600';
      case 'engineer':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'modeler':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return '';
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Shield className="h-4 w-4" />
          Manage User Roles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage User Roles
          </DialogTitle>
          <DialogDescription>
            Assign roles to control user permissions across the system.
          </DialogDescription>
        </DialogHeader>

        {/* Role Legend */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 mb-4">
          <h4 className="text-sm font-medium mb-3">Role Permissions</h4>
          <div className="grid gap-2 text-sm">
            {(Object.keys(ROLE_LABELS) as AppRole[]).map(role => (
              <div key={role} className="flex items-start gap-3">
                <Badge className={`${getRoleBadgeClass(role)} shrink-0`}>
                  {ROLE_LABELS[role]}
                </Badge>
                <span className="text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No users found.</div>
          ) : (
            users.map((user) => (
              <Card key={user.user_id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                        <span className="text-sm font-medium text-accent-foreground">
                          {user.profile.first_name.charAt(0)}{user.profile.last_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {user.profile.first_name} {user.profile.last_name}
                        </div>
                        <Badge className={`mt-1 ${getRoleBadgeClass(user.role)}`}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </div>
                    </div>
                    <Select
                      value={user.role}
                      onValueChange={(value) => updateUserRole(user.user_id, value as AppRole)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="project_admin">Project Admin</SelectItem>
                        <SelectItem value="engineer">Engineer</SelectItem>
                        <SelectItem value="modeler">Modeler</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserRoleManager;
