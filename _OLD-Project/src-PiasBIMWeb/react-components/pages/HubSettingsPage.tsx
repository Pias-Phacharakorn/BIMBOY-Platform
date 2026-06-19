import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../components/Icon";
import { UserAccountDropdown } from "../components/UserAccountDropdown";
import { firestoreDB } from "../../firebase";
import { 
  collection, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where,
  serverTimestamp 
} from "firebase/firestore";

interface HubUser {
  uid: string;
  email: string;
  role: "hub admin" | "hub member";
  createdAt?: any;
}

/**
 * Page component for Hub Administration settings.
 * Accessible only by Hub Admins.
 */
export function HubSettingsPage() {
  const { user, isHubAdmin, logoutUser } = useAuth();
  const navigate = useNavigate();

  const [usersList, setUsersList] = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Form States
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"hub admin" | "hub member">("hub member");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Redirect if not a Hub Admin
  useEffect(() => {
    if (!loading && !isHubAdmin) {
      navigate("/projects");
    }
  }, [isHubAdmin, loading, navigate]);

  // Real-time listener for all users in the redesigned UID-keyed users collection
  useEffect(() => {
    if (!isHubAdmin) return;

    const usersCol = collection(firestoreDB, "users");
    const unsub = onSnapshot(usersCol, (snapshot) => {
      const users: HubUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        users.push({
          uid: docSnap.id,
          email: data.email || "No Email",
          role: data.hubRole === "hub_admin" ? "hub admin" : "hub member",
          createdAt: data.createdAt
        });
      });
      
      // Sort users by email address
      users.sort((a, b) => a.email.localeCompare(b.email));
      setUsersList(users);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to users collection:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [isHubAdmin]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const emailClean = newEmail.trim().toLowerCase();

    if (!emailClean) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setActionLoading(true);
    try {
      // Query users collection by email to check if user has registered
      const q = query(collection(firestoreDB, "users"), where("email", "==", emailClean));
      const querySnapshot = await getDocs(q);

      const firestoreRole = newRole === "hub admin" ? "hub_admin" : "hub_member";

      if (!querySnapshot.empty) {
        // User already exists, promote/update their role
        const targetUserDoc = querySnapshot.docs[0];
        const userDocRef = doc(firestoreDB, "users", targetUserDoc.id);
        await updateDoc(userDocRef, {
          hubRole: firestoreRole,
          updatedAt: serverTimestamp()
        });
        setFormSuccess(`Successfully updated ${emailClean}'s role to ${newRole}.`);
      } else {
        // Under the redesigned UID-keyed schema, we cannot auto-create profiles without their Auth UID.
        throw new Error("This user is not registered in the system yet. Please ask them to log in first so their profile can be initialized.");
      }

      setNewEmail("");
      setNewRole("hub member");
      setTimeout(() => setFormSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error adding hub member:", err);
      setFormError(err.message || "Failed to add member to the Hub.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (memberUid: string, role: "hub admin" | "hub member") => {
    setFormError(null);
    setFormSuccess(null);

    // Prevent demoting self
    if (memberUid === user?.uid) {
      alert("Safety Lock: You cannot demote yourself from Hub Admin.");
      return;
    }

    try {
      const userDocRef = doc(firestoreDB, "users", memberUid);
      const firestoreRole = role === "hub admin" ? "hub_admin" : "hub_member";
      await updateDoc(userDocRef, { 
        hubRole: firestoreRole,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error("Error updating user role:", err);
      alert(err.message || "Failed to update user role.");
    }
  };

  const handleRemoveMember = async (memberUid: string, memberEmail: string) => {
    setFormError(null);
    setFormSuccess(null);

    // Prevent deleting self
    if (memberUid === user?.uid) {
      alert("Safety Lock: You cannot remove yourself from the Hub.");
      return;
    }

    // Prevent deleting master admin
    if (memberEmail === "pias.phacharakorn@gmail.com" || memberEmail === "pias.phacharakorn@gmal.com") {
      alert("Safety Lock: The master admin cannot be removed.");
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${memberEmail} from this Hub?`)) {
      return;
    }

    try {
      const userDocRef = doc(firestoreDB, "users", memberUid);
      await deleteDoc(userDocRef);
    } catch (err: any) {
      console.error("Error removing user:", err);
      alert(err.message || "Failed to remove user from the Hub.");
    }
  };



  // Helper function to safely format Timestamp dates
  const parseDateString = (val: any): string => {
    if (!val) return "System Default";
    let d: Date;
    if (val.toDate) {
      d = val.toDate();
    } else {
      d = new Date(val);
    }
    return isNaN(d.getTime()) ? "System Default" : d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="app-container projects-app" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p style={{ color: "var(--accent)" }}>Connecting to Hub settings...</p>
      </div>
    );
  }

  return (
    <div className="app-container projects-app">
      <header className="header projects-header">
        <div className="logo" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Link to="/projects" className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-transparent rounded-lg bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none icon-btn" title="Back to Projects" style={{ padding: "6px" }}>
            <Icon name="LEFT" size={16} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="logo-box" />
            PiasBimWeb
          </div>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent)", textTransform: "uppercase", background: "oklch(66% 0.17 252 / 8%)", padding: "4px 8px", borderRadius: "var(--radius-sm)", border: "1px solid oklch(66% 0.17 252 / 20%)" }}>
            Hub Admin Area
          </span>
        </div>

        <div className="projects-header-actions">
          <UserAccountDropdown />
        </div>
      </header>

      <main className="workspace-area projects-workspace" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div className="projects-intro">
          <h1>Hub Administration</h1>
          <p>Configure global access permissions, register user accounts, and promote administrative roles across your shared Autodesk Forma space.</p>
        </div>

        {formSuccess && (
          <div style={{
            padding: "10px 14px",
            background: "oklch(70% 0.14 150 / 12%)",
            border: "1px solid oklch(70% 0.14 150 / 30%)",
            borderRadius: "var(--radius)",
            color: "var(--status-ok)",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <Icon name="CHECK" size={16} />
            <span>{formSuccess}</span>
          </div>
        )}

        {formError && (
          <div style={{
            padding: "10px 14px",
            background: "oklch(63% 0.18 28 / 12%)",
            border: "1px solid oklch(63% 0.18 28 / 30%)",
            borderRadius: "var(--radius)",
            color: "var(--status-danger)",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <Icon name="WARNING" size={16} />
            <span>{formError}</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
          
          {/* Add Hub User Form */}
          <section className="flex flex-col gap-4 p-5 border border-border rounded-lg bg-surface/94" style={{ width: "100%", maxWidth: "600px" }}>
            <h2>Invite or Add Hub User</h2>
            <form onSubmit={handleAddMember} style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              alignItems: "flex-end",
              marginTop: "16px"
            }}>
              <div className="flex flex-col gap-2" style={{ flex: "1 1 250px" }}>
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Email Address</span>
                <input 
                  type="email" 
                  className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed" 
                  placeholder="engineer@company.com" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={actionLoading}
                  required
                  style={{ height: "34px", width: "100%" }}
                />
              </div>

              <div className="flex flex-col gap-2" style={{ width: "160px" }}>
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Assign Hub Role</span>
                <select 
                  className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed" 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  disabled={actionLoading}
                  style={{
                    height: "34px",
                    width: "100%",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-strong)",
                    color: "var(--fg)",
                    borderRadius: "var(--radius)"
                  }}
                >
                  <option value="hub member">Hub Member</option>
                  <option value="hub admin">Hub Admin</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-[#8f8fff] rounded-lg bg-gradient-to-b from-[#8c8cff] to-[#6d6dff] text-[#fdfdff] cursor-pointer text-xs font-semibold hover:border-[#aaaaff] hover:bg-gradient-to-b hover:from-[#9c9cff] hover:to-[#7d7dff] hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none" 
                disabled={actionLoading}
                style={{ height: "34px", padding: "0 20px" }}
              >
                {actionLoading ? "Registering..." : "Add User"}
              </button>
            </form>
          </section>

          {/* Members Table */}
          <section className="flex flex-col gap-4 p-5 border border-border rounded-lg bg-surface/94">
            <h2>Hub Membership Records ({usersList.length})</h2>
            <div style={{ overflowX: "auto", marginTop: "16px" }}>
              <table className="w-full border-collapse text-fg text-xs">
                <thead>
                  <tr>
                    <th>Email Address / User ID</th>
                    <th>Role in Hub</th>
                    <th>Date Added</th>
                    <th style={{ width: "120px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((member) => {
                    const isSelf = member.uid === user?.uid;
                    const isMasterAdmin = member.email === "pias.phacharakorn@gmail.com" || member.email === "pias.phacharakorn@gmal.com";
                    const isLocked = isSelf || isMasterAdmin;
                    
                    return (
                      <tr key={member.uid}>
                        <td className="mono" style={{ fontWeight: "500", color: isSelf ? "var(--accent)" : "var(--fg)" }}>
                          {member.email} {isSelf && " (You)"}
                        </td>
                        <td>
                          {isLocked ? (
                            <span className="inline-flex items-center min-h-[20px] px-2 py-0.5 border border-status-ok/40 rounded-full bg-status-ok/10 text-status-ok text-[10px] font-bold uppercase tracking-wider" style={{ textTransform: "capitalize" }}>
                              {member.role === "hub admin" ? "Hub Admin" : "Hub Member"}
                            </span>
                          ) : (
                            <select
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.uid, e.target.value as any)}
                              style={{
                                background: "var(--surface-raised)",
                                border: "1px solid var(--border)",
                                color: "var(--fg)",
                                padding: "4px 8px",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "12px",
                                cursor: "pointer"
                              }}
                            >
                              <option value="hub member">Hub Member</option>
                              <option value="hub admin">Hub Admin</option>
                            </select>
                          )}
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: "12px" }}>
                          {parseDateString(member.createdAt)}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-transparent rounded-lg bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none icon-btn"
                            style={{ 
                              color: "var(--status-danger)", 
                              padding: "4px",
                              opacity: isLocked ? 0.3 : 1,
                              cursor: isLocked ? "not-allowed" : "pointer" 
                            }}
                            onClick={() => !isLocked && handleRemoveMember(member.uid, member.email)}
                            disabled={isLocked}
                            title={isSelf ? "You cannot remove yourself" : isMasterAdmin ? "Master Admin cannot be removed" : "Remove User"}
                          >
                            <Icon name="CLOSE" size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
