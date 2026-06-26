import { useState } from "react";
import { Icon } from "@/react-components/components/ui";
import {
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
} from "@/react-components/features/projects/useProjects";

interface ProjectMembersSettingsProps {
  projectId: string;
}

export function ProjectMembersSettings({ projectId }: ProjectMembersSettingsProps) {
  const { data: members = [], isLoading: isMembersLoading } = useProjectMembers(projectId);

  const addMemberMutation = useAddProjectMember();
  const removeMemberMutation = useRemoveProjectMember();
  const updateMemberRoleMutation = useUpdateProjectMemberRole();

  // Form states for adding member
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"project_admin" | "project_member">("project_member");
  const [memberError, setMemberError] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError(null);

    const emailClean = newMemberEmail.trim().toLowerCase();
    if (!emailClean) {
      setMemberError("Please enter an email address.");
      return;
    }

    try {
      await addMemberMutation.mutateAsync({
        projectId,
        email: emailClean,
        role: newMemberRole,
      });
      setNewMemberEmail("");
    } catch (err: any) {
      setMemberError(err.message || "Failed to add member.");
    }
  };

  const handleRemoveMember = async (uid: string, email: string) => {
    if (window.confirm(`Are you sure you want to remove ${email} from this project?`)) {
      try {
        await removeMemberMutation.mutateAsync({
          projectId,
          uid,
        });
      } catch (err: any) {
        alert(err.message || "Failed to remove member.");
      }
    }
  };

  const handleRoleChange = async (uid: string, role: "project_admin" | "project_member") => {
    try {
      await updateMemberRoleMutation.mutateAsync({
        projectId,
        uid,
        role,
      });
    } catch (err: any) {
      alert(err.message || "Failed to change member role.");
    }
  };

  return (
    <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <h2 className="text-[16px] font-bold text-fg border-b border-border pb-2">Members & Permissions</h2>

      {/* Add Member Box */}
      <form
        className="flex flex-wrap gap-3 items-end p-4 border border-border bg-surface/30 rounded-radius"
        onSubmit={handleAddMember}
      >
        <div className="flex flex-col gap-1.5 flex-[2_1_240px]">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="member-email">
            Member Email
          </label>
          <input
            id="member-email"
            className="w-full px-3 py-1.5 border border-border-strong bg-[#1b1c21] rounded-radius text-fg text-sm outline-none focus:border-accent"
            type="email"
            required
            placeholder="engineer@company.com"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
            disabled={addMemberMutation.isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5 flex-[1_1_150px]">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="member-role">
            Role
          </label>
          <select
            id="member-role"
            className="w-full px-3 py-1.5 border border-border-strong bg-[#1b1c21] rounded-radius text-fg text-sm outline-none focus:border-accent"
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value as any)}
            disabled={addMemberMutation.isPending}
          >
            <option value="project_member">Project Member</option>
            <option value="project_admin">Project Admin</option>
          </select>
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 min-h-8 px-4 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-accent hover:bg-surface-raised active:translate-y-0 disabled:opacity-60 transition-all duration-120"
          type="submit"
          disabled={addMemberMutation.isPending}
        >
          {addMemberMutation.isPending ? "Adding..." : "Add Member"}
        </button>
      </form>

      {memberError && (
        <div className="flex items-center gap-2.5 p-3 px-4 bg-status-danger/10 border border-status-danger/30 rounded-radius text-status-danger text-sm font-medium animate-slide-down">
          <Icon name="WARNING" size={14} />
          <span>{memberError}</span>
        </div>
      )}

      {/* Members Table */}
      {isMembersLoading ? (
        <div className="py-8 text-center text-muted text-sm">
          Loading members list...
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-fg text-[13px] text-left">
            <thead>
              <tr className="border-b border-border-strong text-muted text-[10px] font-bold tracking-wider uppercase">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const email = member.profiles?.email || "Unknown user";
                const isUpdatePending =
                  updateMemberRoleMutation.isPending &&
                  updateMemberRoleMutation.variables?.uid === member.uid;

                return (
                  <tr
                    className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120 border-b border-border"
                    key={member.uid}
                  >
                    <td className="px-4 py-3 text-fg font-medium">{email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          className="bg-transparent border border-transparent rounded px-1.5 py-0.5 text-fg outline-none focus:border-border-strong hover:bg-surface-raised cursor-pointer text-xs"
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.uid, e.target.value as any)}
                          disabled={isUpdatePending}
                        >
                          <option value="project_member">Member</option>
                          <option value="project_admin">Admin</option>
                        </select>
                        {isUpdatePending && (
                          <div className="w-3.5 h-3.5 border-2 border-border border-t-accent rounded-full animate-spin" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center min-h-[18px] px-2 py-0.5 border border-status-ok/30 rounded-full bg-status-ok/5 text-status-ok text-[9px] font-bold uppercase tracking-wider">
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="inline-flex items-center justify-center gap-2 min-h-7 px-2.5 border border-transparent rounded-radius bg-transparent text-status-danger cursor-pointer text-xs font-semibold hover:border-status-danger/40 hover:bg-status-danger/5 transition-all duration-120 disabled:opacity-50"
                        type="button"
                        onClick={() => handleRemoveMember(member.uid, email)}
                        disabled={removeMemberMutation.isPending}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
