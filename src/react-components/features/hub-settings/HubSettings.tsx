import { useState } from "react";
import { Icon } from "@/react-components/components/ui";
import { useAuth } from "@/react-components/features/auth/useAuth";
import {
  useHubProfiles,
  useAddHubUser,
  useUpdateHubRole,
  useRemoveHubUser,
} from "./useHubSettings";
import { format } from "date-fns";
import type { HubRole } from "./hubSettingsService";

export function HubSettings() {
  const { user: currentUser } = useAuth();
  const { data: profiles = [], isLoading: isProfilesLoading } = useHubProfiles();

  const addHubUserMutation = useAddHubUser();
  const updateHubRoleMutation = useUpdateHubRole();
  const removeHubUserMutation = useRemoveHubUser();

  // Add Member Form States
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<HubRole>("hub_member");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const emailClean = newEmail.trim().toLowerCase();
    if (!emailClean) {
      setFormError("Please enter a valid email address.");
      return;
    }

    try {
      await addHubUserMutation.mutateAsync({
        email: emailClean,
        role: newRole,
      });
      setFormSuccess(
        `Successfully invited ${emailClean} as ${
          newRole === "hub_admin" ? "Hub Admin" : "Hub Member"
        }.`
      );
      setNewEmail("");
      setNewRole("hub_member");
      setTimeout(() => setFormSuccess(null), 5000);
    } catch (err: any) {
      setFormError(err.message || "Failed to add member to the Hub.");
    }
  };

  const handleRoleChange = async (memberUid: string, memberEmail: string, role: HubRole) => {
    setFormError(null);
    setFormSuccess(null);

    // Prevent demoting self
    if (memberUid === currentUser?.id) {
      alert("Safety Lock: You cannot demote yourself from Hub Admin.");
      return;
    }

    try {
      await updateHubRoleMutation.mutateAsync({
        uid: memberUid,
        role,
      });
      setFormSuccess(`Successfully updated ${memberEmail}'s role.`);
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || "Failed to update user role.");
    }
  };

  const handleRemoveMember = async (memberUid: string, memberEmail: string) => {
    setFormError(null);
    setFormSuccess(null);

    // Prevent deleting self
    if (memberUid === currentUser?.id) {
      alert("Safety Lock: You cannot remove yourself from the Hub.");
      return;
    }

    // Prevent deleting master admins
    const isMasterAdmin =
      memberEmail === "pias.phacharakorn@gmail.com" ||
      memberEmail === "pias.phacharakorn@gmal.com";
    if (isMasterAdmin) {
      alert("Safety Lock: The master admin cannot be removed.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to remove ${memberEmail} from the Hub? This will also remove them from all projects.`
      )
    ) {
      return;
    }

    try {
      await removeHubUserMutation.mutateAsync(memberUid);
      setFormSuccess(`Successfully removed ${memberEmail} from the Hub.`);
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      setFormError(err.message || "Failed to remove user from the Hub.");
    }
  };

  const formatProfileDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "System Default";
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? "System Default" : format(d, "MMM dd, yyyy HH:mm");
    } catch {
      return "System Default";
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
      {/* Alerts */}
      {formSuccess && (
        <div className="flex items-center gap-2.5 p-3.5 px-4 bg-status-ok/10 border border-status-ok/30 rounded-radius text-status-ok text-sm font-medium animate-slide-down">
          <Icon name="CHECK" size={16} />
          <span>{formSuccess}</span>
        </div>
      )}

      {formError && (
        <div className="flex items-center gap-2.5 p-3.5 px-4 bg-status-danger/10 border border-status-danger/30 rounded-radius text-status-danger text-sm font-medium animate-slide-down">
          <Icon name="WARNING" size={16} />
          <span>{formError}</span>
        </div>
      )}

      {/* Invite Member Section */}
      <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <h2 className="text-[16px] font-bold text-fg border-b border-border pb-2">
          Invite or Add Hub User
        </h2>
        <form onSubmit={handleAddMember} className="flex flex-wrap gap-4 items-end mt-2">
          <div className="flex flex-col gap-1.5 flex-[2_1_250px]">
            <label
              className="text-muted text-[10px] font-bold tracking-wider uppercase"
              htmlFor="invite-email"
            >
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              className="w-full px-3 py-1.5 border border-border-strong bg-[#1b1c21] rounded-radius text-fg text-sm outline-none focus:border-accent"
              placeholder="engineer@company.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={addHubUserMutation.isPending}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 flex-[1_1_180px]">
            <label
              className="text-muted text-[10px] font-bold tracking-wider uppercase"
              htmlFor="invite-role"
            >
              Assign Hub Role
            </label>
            <select
              id="invite-role"
              className="w-full px-3 py-1.5 border border-border-strong bg-[#1b1c21] rounded-radius text-fg text-sm outline-none focus:border-accent cursor-pointer"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as HubRole)}
              disabled={addHubUserMutation.isPending}
            >
              <option value="hub_member">Hub Member</option>
              <option value="hub_admin">Hub Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 min-h-8 px-5 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-accent hover:bg-surface-raised active:translate-y-0 disabled:opacity-60 transition-all duration-120"
            disabled={addHubUserMutation.isPending}
          >
            {addHubUserMutation.isPending ? "Inviting..." : "Add User"}
          </button>
        </form>
      </section>

      {/* Members Records Section */}
      <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <h2 className="text-[16px] font-bold text-fg border-b border-border pb-2">
          Hub Membership Records ({profiles.length})
        </h2>

        {isProfilesLoading ? (
          <div className="py-8 text-center text-muted text-sm">Loading hub members list...</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-fg text-[13px] text-left">
              <thead>
                <tr className="border-b border-border-strong text-muted text-[10px] font-bold tracking-wider uppercase">
                  <th className="px-4 py-3">Email Address / User ID</th>
                  <th className="px-4 py-3">Role in Hub</th>
                  <th className="px-4 py-3">Date Added</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => {
                  const isSelf = profile.uid === currentUser?.id;
                  const isMasterAdmin =
                    profile.email === "pias.phacharakorn@gmail.com" ||
                    profile.email === "pias.phacharakorn@gmal.com";
                  const isLocked = isSelf || isMasterAdmin;

                  const isUpdatePending =
                    updateHubRoleMutation.isPending &&
                    updateHubRoleMutation.variables?.uid === profile.uid;

                  return (
                    <tr
                      key={profile.uid}
                      className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120 border-b border-border"
                    >
                      <td className="px-4 py-3 text-fg font-medium">
                        <span className={isSelf ? "text-accent font-semibold" : ""}>
                          {profile.email}
                        </span>
                        {isSelf && (
                          <span className="ml-1.5 text-xs text-accent opacity-80">(You)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isLocked ? (
                            <span className="inline-flex items-center min-h-[20px] px-2 py-0.5 border border-status-ok/30 rounded-full bg-status-ok/5 text-status-ok text-[10px] font-bold uppercase tracking-wider">
                              {profile.hub_role === "hub_admin" ? "Hub Admin" : "Hub Member"}
                            </span>
                          ) : (
                            <select
                              value={profile.hub_role}
                              onChange={(e) =>
                                handleRoleChange(
                                  profile.uid,
                                  profile.email,
                                  e.target.value as HubRole
                                )
                              }
                              disabled={isUpdatePending}
                              className="bg-transparent border border-transparent rounded px-1.5 py-0.5 text-fg outline-none focus:border-border-strong hover:bg-surface-raised cursor-pointer text-xs"
                            >
                              <option value="hub_member">Hub Member</option>
                              <option value="hub_admin">Hub Admin</option>
                            </select>
                          )}
                          {isUpdatePending && (
                            <div className="w-3.5 h-3.5 border-2 border-border border-t-accent rounded-full animate-spin" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {formatProfileDate(profile.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-2 min-h-7 px-2.5 border border-transparent rounded-radius bg-transparent text-status-danger cursor-pointer text-xs font-semibold hover:border-status-danger/40 hover:bg-status-danger/5 transition-all duration-120 disabled:opacity-50"
                          onClick={() => handleRemoveMember(profile.uid, profile.email)}
                          disabled={isLocked || removeHubUserMutation.isPending}
                          title={
                            isSelf
                              ? "You cannot remove yourself"
                              : isMasterAdmin
                              ? "Master Admin cannot be removed"
                              : "Remove User"
                          }
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
    </div>
  );
}
