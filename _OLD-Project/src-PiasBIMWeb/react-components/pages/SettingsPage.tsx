import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { WorkspaceHeader } from "../layout/WorkspaceHeader";
import { getProjectById, projectsManager } from "../../classes/ProjectsManager";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "../components/Icon";
import * as Firestore from "firebase/firestore";
import { firestoreDB } from "../../firebase"; // we'll need this for delete trash button

export function SettingsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(getProjectById(projectId));

  const { user, isHubAdmin, projectRoles } = useAuth();
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [updatingMembers, setUpdatingMembers] = useState<Record<string, { loading: boolean; success: boolean; error: string | null }>>({});

  const [activeTab, setActiveTab] = useState("General");
  const tabs = ["General", "Members", "GIS", "Document Status"];

  const [tabTitle, setTabTitle] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [tabUrl, setTabUrl] = useState("");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);
  const [tabSaving, setTabSaving] = useState(false);

  const handleAddOrUpdateTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setTabError(null);

    const titleClean = tabTitle.trim();
    const sectionClean = sectionTitle.trim();
    const urlClean = tabUrl.trim();

    if (!titleClean || !sectionClean || !urlClean) {
      setTabError("Please fill out all fields.");
      return;
    }

    setTabSaving(true);
    try {
      const currentTabs = project.documentStatusTabs || [];
      let updatedTabs: Array<{ id: string; tabTitle: string; sectionTitle: string; url: string }> = [];

      if (editingTabId) {
        // Update existing
        updatedTabs = currentTabs.map((t) =>
          t.id === editingTabId
            ? { ...t, tabTitle: titleClean, sectionTitle: sectionClean, url: urlClean }
            : t
        );
      } else {
        // Add new
        const newTab = {
          id: Date.now().toString(),
          tabTitle: titleClean,
          sectionTitle: sectionClean,
          url: urlClean
        };
        updatedTabs = [...currentTabs, newTab];
      }

      await projectsManager.updateProject(project.id, {
        documentStatusTabs: updatedTabs
      });

      // Clear form
      setTabTitle("");
      setSectionTitle("");
      setTabUrl("");
      setEditingTabId(null);
    } catch (err: any) {
      setTabError(err.message || "Failed to update Document Status tab.");
    } finally {
      setTabSaving(false);
    }
  };

  const handleEditTab = (tab: { id: string; tabTitle: string; sectionTitle: string; url: string }) => {
    setTabTitle(tab.tabTitle);
    setSectionTitle(tab.sectionTitle);
    setTabUrl(tab.url);
    setEditingTabId(tab.id);
  };

  const handleDeleteTab = async (tabId: string) => {
    if (window.confirm("Are you sure you want to delete this Document Status tab?")) {
      try {
        const currentTabs = project.documentStatusTabs || [];
        const updatedTabs = currentTabs.filter((t) => t.id !== tabId);
        await projectsManager.updateProject(project.id, {
          documentStatusTabs: updatedTabs
        });
      } catch (err: any) {
        alert(err.message || "Failed to delete Document Status tab.");
      }
    }
  };

  useEffect(() => {
    const updateProject = () => {
      setProject(getProjectById(projectId));
    };

    const unsubLoaded = projectsManager.onProjectsLoaded(updateProject);
    return () => unsubLoaded();
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    const userRole = projectRoles[project.id];
    const isProjectAdmin = isHubAdmin || userRole === "project_admin";
    if (!isProjectAdmin) {
      console.warn("Unauthorized access to settings page. Redirecting to model page...");
      navigate(`/projects/${project.id}/model`);
    }
  }, [project, isHubAdmin, projectRoles, navigate]);

  useEffect(() => {
    if (!project) return;
    const rolesMap = { ...(project.userRoles || {}) };
    rolesMap["pias.phacharakorn@gmail.com"] = "project admin";
    rolesMap["pias.phacharakorn@gmal.com"] = "project admin";
    setMemberRoles(rolesMap);
    setLoadingRoles(false);
  }, [project?.userRoles]);
  

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState(0);
  const [status, setStatus] = useState<"bidding" | "active" | "finished">("active");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");
  const [ifcFolderPath, setIfcFolderPath] = useState("");
  const [fragFolderPath, setFragFolderPath] = useState("");
  const [clashFolderPath, setClashFolderPath] = useState("");
  const [hasModel, setHasModel] = useState(false);
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [elevation, setElevation] = useState(0);

  // Save feedback states
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Helper to format date object to YYYY-MM-DD string
  const formatDateToInput = (date: Date) => {
    return date instanceof Date && !isNaN(date.getTime())
      ? date.toISOString().split("T")[0]
      : "";
  };

  // Sync state values when project updates
  useEffect(() => {
    if (project) {
      setProjectName(project.projectName);
      setProjectNumber(project.projectnumber);
      setStatus(project.status as any || "active");
      setDescription(project.description || "");
      setStartDate(formatDateToInput(project.startDate));
      setFinishDate(formatDateToInput(project.finishDate));
      setIfcFolderPath(project.bimFiles?.ifcFolderPath || "");
      setFragFolderPath(project.bimFiles?.fragFolderPath || "");
      setClashFolderPath(project.clashFolderPath || "");
      setHasModel(project.bimFiles?.hasModel || false);
      setLatitude(project.location?.latitude || 0);
      setLongitude(project.location?.longitude || 0);
      setRotation(project.location?.rotation || 0);
      setElevation(project.location?.elevation || 0);
    }
  }, [project]);

  const handleCancelEdit = () => {
    if (project) {
      setProjectName(project.projectName);
      setProjectNumber(project.projectnumber);
      setStatus(project.status as any || "active");
      setDescription(project.description || "");
      setStartDate(formatDateToInput(project.startDate));
      setFinishDate(formatDateToInput(project.finishDate));
      setIfcFolderPath(project.bimFiles?.ifcFolderPath || "");
      setFragFolderPath(project.bimFiles?.fragFolderPath || "");
      setClashFolderPath(project.clashFolderPath || "");
      setHasModel(project.bimFiles?.hasModel || false);
      setLatitude(project.location?.latitude || 0);
      setLongitude(project.location?.longitude || 0);
      setRotation(project.location?.rotation || 0);
      setElevation(project.location?.elevation || 0);
    }
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    setSaveError(null);
    setSaveSuccess(false);

    if (!projectName.trim()) {
      setSaveError("Project Name cannot be empty.");
      return;
    }

    setSaveLoading(true);
    try {
      const updatedData = {
        projectName: projectName.trim(),
        projectnumber: Number(projectNumber),
        status: status,
        description: description.trim(),
        startDate: startDate ? new Date(startDate) : project.startDate,
        finishDate: finishDate ? new Date(finishDate) : project.finishDate,
        bimFiles: {
          ifcFolderPath: ifcFolderPath.trim().replace(/^\/+|\/+$/g, ""),
          fragFolderPath: fragFolderPath.trim().replace(/^\/+|\/+$/g, ""),
          hasModel: Boolean(hasModel)
        },
        clashFolderPath: clashFolderPath.trim().replace(/^\/+|\/+$/g, ""),
        location: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          rotation: Number(rotation),
          elevation: Number(elevation)
        }
      };
      
      await projectsManager.updateProject(project.id, updatedData);
      
      setSaveSuccess(true);
      setIsEditing(false);
      // Auto-fade success message
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save project settings.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Form states
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"project admin" | "project member">("project member");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const emailClean = newMemberEmail.trim().toLowerCase();
    if (!emailClean) {
      setFormError("Please enter an email address.");
      return;
    }

    if (project.members.includes(emailClean)) {
      setFormError("This user is already a member of the project.");
      return;
    }

    setSubmitLoading(true);
    try {
      await projectsManager.addProjectMember(project.id, emailClean, newMemberRole);
      setNewMemberEmail("");
      setNewMemberRole("project member");
    } catch (err: any) {
      setFormError(err.message || "Failed to add project member.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (window.confirm(`Are you sure you want to remove ${email} from this project?`)) {
      try {
        await projectsManager.removeProjectMember(project.id, email);
      } catch (err: any) {
        alert(err.message || "Failed to remove member.");
      }
    }
  };

  const handlePermissionChange = async (memberEmail: string, pageKey: string, isChecked: boolean) => {
    const emailClean = memberEmail.trim().toLowerCase();
    
    // Get current permissions
    const currentPermissions = project.memberPermissions?.[emailClean] || {
      model: true,
      standard: true,
      clashes: true,
      documents: true
    };
    
    const newPermissions = {
      ...currentPermissions,
      [pageKey]: isChecked
    };

    setUpdatingMembers(prev => ({
      ...prev,
      [`${emailClean}_${pageKey}`]: { loading: true, success: false, error: null }
    }));

    try {
      await projectsManager.updateProjectMemberPermissions(project.id, emailClean, newPermissions);
      
      setUpdatingMembers(prev => ({
        ...prev,
        [`${emailClean}_${pageKey}`]: { loading: false, success: true, error: null }
      }));

      setTimeout(() => {
        setUpdatingMembers(prev => ({
          ...prev,
          [`${emailClean}_${pageKey}`]: { loading: false, success: false, error: null }
        }));
      }, 1500);
    } catch (err: any) {
      console.error("Error updating member permissions:", err);
      setUpdatingMembers(prev => ({
        ...prev,
        [`${emailClean}_${pageKey}`]: { loading: false, success: false, error: err.message || "Failed to update" }
      }));

      setTimeout(() => {
        setUpdatingMembers(prev => ({
          ...prev,
          [`${emailClean}_${pageKey}`]: { loading: false, success: false, error: null }
        }));
      }, 3000);
    }
  };

  const renderPermissionToggle = (memberEmail: string, pageKey: string, isMemberAdmin: boolean) => {
    const emailClean = memberEmail.trim().toLowerCase();
    const currentPermissions = project.memberPermissions?.[emailClean] || {
      model: true,
      standard: true,
      clashes: true,
      documents: true
    };
    
    const isChecked = isMemberAdmin ? true : (currentPermissions[pageKey] !== false);
    const updateState = updatingMembers[`${emailClean}_${pageKey}`] || { loading: false, success: false, error: null };
    
    return (
      <div className="switch-container">
        <label className="switch">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={isMemberAdmin || updateState.loading}
            onChange={(e) => handlePermissionChange(memberEmail, pageKey, e.target.checked)}
          />
          <span className="slider"></span>
        </label>
        {updateState.loading && (
          <div className="inline-spinner" style={{
            marginLeft: "6px",
            width: "10px",
            height: "10px",
            border: "1.5px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "inline-spin 0.6s linear infinite"
          }} />
        )}
        {updateState.success && (
          <Icon name="CHECK" size={10} style={{ marginLeft: "6px", color: "var(--status-ok)" }} />
        )}
        {updateState.error && (
          <span title={updateState.error} style={{ marginLeft: "6px" }}>
            <Icon name="WARNING" size={10} style={{ color: "var(--status-danger)" }} />
          </span>
        )}
      </div>
    );
  };
  
  const handleRoleChange = async (memberEmail: string, newRole: "project admin" | "project member") => {
    const emailClean = memberEmail.trim().toLowerCase();
    setUpdatingMembers(prev => ({
      ...prev,
      [emailClean]: { loading: true, success: false, error: null }
    }));

    try {
      await projectsManager.addProjectMember(project.id, emailClean, newRole);
      
      // Update local memberRoles map immediately so the select input shows the new value if Firestore is slow
      setMemberRoles(prev => ({
        ...prev,
        [emailClean]: newRole
      }));

      setUpdatingMembers(prev => ({
        ...prev,
        [emailClean]: { loading: false, success: true, error: null }
      }));

      setTimeout(() => {
        setUpdatingMembers(prev => ({
          ...prev,
          [emailClean]: { loading: false, success: false, error: null }
        }));
      }, 1500);
    } catch (err: any) {
      console.error("Error updating member role:", err);
      setUpdatingMembers(prev => ({
        ...prev,
        [emailClean]: { loading: false, success: false, error: err.message || "Failed to update role" }
      }));

      setTimeout(() => {
        setUpdatingMembers(prev => ({
          ...prev,
          [emailClean]: { loading: false, success: false, error: null }
        }));
      }, 3000);
    }
  };

  if (!project) {
    return (
      <div className="app-container projects-app" style={{ padding: "40px" }}>
        Loading Project...
      </div>
    );
  }

  // Helper to format date labels
  const formatDate = (date: Date) => {
    return date instanceof Date && !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })
      : "N/A";
  };

  // Helper to render status chip with dynamic tones
  const renderStatusBadge = (status: string) => {
    const sLower = (status || "").toLowerCase();
    if (sLower === "active") {
      return <span className="inline-flex items-center min-h-[20px] px-2 py-0.5 border border-status-ok/40 rounded-full bg-status-ok/10 text-status-ok text-[10px] font-bold uppercase tracking-wider">Active</span>;
    } else if (sLower === "finished") {
      return <span className="inline-flex items-center min-h-[20px] px-2 py-0.5 border border-status-info/40 rounded-full bg-status-info/10 text-status-info text-[10px] font-bold uppercase tracking-wider">Finished</span>;
    } else {
      return <span className="inline-flex items-center min-h-[20px] px-2 py-0.5 border border-status-warn/40 rounded-full bg-status-warn/10 text-status-warn text-[10px] font-bold uppercase tracking-wider">Bidding</span>;
    }
  };

  return (
    <AppShell project={project}>
      <style>{`
        @keyframes inline-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <WorkspaceHeader
        title="Project Settings"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          isEditing ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-[#8f8fff] rounded-lg bg-gradient-to-b from-[#8c8cff] to-[#6d6dff] text-[#fdfdff] cursor-pointer text-xs font-semibold hover:border-[#aaaaff] hover:bg-gradient-to-b hover:from-[#9c9cff] hover:to-[#7d7dff] hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                type="button"
                onClick={handleSaveChanges}
                disabled={saveLoading}
              >
                <Icon name="CHECK" size={14} />
                {saveLoading ? "Saving..." : "Save Settings"}
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-border-strong rounded-lg bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-[#5a5666] hover:bg-[#302d38] hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                type="button"
                onClick={handleCancelEdit}
                disabled={saveLoading}
              >
                <Icon name="CLOSE" size={14} />
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-[#8f8fff] rounded-lg bg-gradient-to-b from-[#8c8cff] to-[#6d6dff] text-[#fdfdff] cursor-pointer text-xs font-semibold hover:border-[#aaaaff] hover:bg-gradient-to-b hover:from-[#9c9cff] hover:to-[#7d7dff] hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              <Icon name="EDIT" size={14} />
              Edit Settings
            </button>
          )
        }
      />
      <div className="workspace-area">
        {saveSuccess && (
          <div style={{
            margin: "0 0 16px 0",
            padding: "10px 14px",
            background: "oklch(70% 0.14 150 / 12%)",
            border: "1px solid oklch(70% 0.14 150 / 30%)",
            borderRadius: "var(--radius)",
            color: "var(--status-ok)",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "slideDown 0.2s ease"
          }}>
            <Icon name="CHECK" size={16} />
            <span>Project settings successfully updated!</span>
          </div>
        )}
        {saveError && (
          <div style={{
            margin: "0 0 16px 0",
            padding: "10px 14px",
            background: "oklch(63% 0.18 28 / 12%)",
            border: "1px solid oklch(63% 0.18 28 / 30%)",
            borderRadius: "var(--radius)",
            color: "var(--status-danger)",
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "slideDown 0.2s ease"
          }}>
            <Icon name="WARNING" size={16} />
            <span>{saveError}</span>
          </div>
        )}
        <div className="w-full box-border p-5 md:p-10 flex flex-col gap-4">
          
          {activeTab === "General" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {/* Section 1: General Information */}
              <section className="flex flex-col gap-4 p-6 border border-border rounded-lg bg-surface/94">
                <h2>General Information</h2>
                
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Project Name</span>
                  <input
                    type="text"
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    readOnly={!isEditing}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Project Number</span>
                    <input
                      type="number"
                      className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border"
                      value={projectNumber}
                      onChange={(e) => setProjectNumber(Number(e.target.value))}
                      readOnly={!isEditing}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Status</span>
                    {isEditing ? (
                      <select
                        className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        style={{
                          height: "35px",
                          padding: "6px 12px",
                          background: "var(--surface-raised)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--radius)",
                          color: "var(--fg)"
                        }}
                      >
                        <option value="bidding">Bidding</option>
                        <option value="active">Active</option>
                        <option value="finished">Finished</option>
                      </select>
                    ) : (
                      <div style={{ marginTop: "4px" }}>
                        {renderStatusBadge(status)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Description</span>
                  <textarea 
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                    rows={3} 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="No description provided."
                    style={{ resize: "none", lineHeight: "1.6" }}
                    readOnly={!isEditing} 
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Start Date</span>
                    {isEditing ? (
                      <input 
                        type="date" 
                        className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                      />
                    ) : (
                      <input 
                        type="text" 
                        className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                        value={startDate ? formatDate(new Date(startDate)) : "N/A"} 
                        readOnly 
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Finish Date</span>
                    {isEditing ? (
                      <input 
                        type="date" 
                        className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                        value={finishDate} 
                        onChange={(e) => setFinishDate(e.target.value)} 
                      />
                    ) : (
                      <input 
                        type="text" 
                        className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                        value={finishDate ? formatDate(new Date(finishDate)) : "N/A"} 
                        readOnly 
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* Section 3: Data & BIM Storage Connections */}
              <section className="flex flex-col gap-4 p-6 border border-border rounded-lg bg-surface/94">
                <h2>BIM Data & Cloud Connections</h2>
                
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">IFC Storage Directory (Firebase Storage)</span>
                  <input 
                    type="text" 
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border font-mono" 
                    value={ifcFolderPath} 
                    onChange={(e) => setIfcFolderPath(e.target.value)}
                    placeholder="Not configured (no IFC path)"
                    readOnly={!isEditing} 
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Processed 3D Geometry Directory (.frag)</span>
                  <input 
                    type="text" 
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border font-mono" 
                    value={fragFolderPath} 
                    onChange={(e) => setFragFolderPath(e.target.value)}
                    placeholder="Not configured (no Frag path)"
                    readOnly={!isEditing} 
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Clash Detection Reports Directory (.html)</span>
                  <input 
                    type="text" 
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border font-mono" 
                    value={clashFolderPath} 
                    onChange={(e) => setClashFolderPath(e.target.value)}
                    placeholder="Not configured (no Clash path)"
                    readOnly={!isEditing} 
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">BIM Model Status</span>
                  <div style={{ marginTop: "4px" }}>
                    {isEditing ? (
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={hasModel} 
                          onChange={(e) => setHasModel(e.target.checked)} 
                          style={{ width: "16px", height: "16px", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: "13px", fontWeight: "500", color: "var(--fg)" }}>3D Model Ready</span>
                      </label>
                    ) : (
                      <span className={`inline-flex items-center min-h-[20px] px-2 py-0.5 border rounded-full text-[10px] font-bold uppercase tracking-wider ${hasModel ? "border-status-ok/40 bg-status-ok/10 text-status-ok" : "border-border-strong bg-[#20222a] text-muted"}`}>
                        {hasModel ? "3D Model Ready" : "No 3D Model Attached"}
                      </span>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "GIS" && (
            <section className="flex flex-col gap-4 p-6 border border-border rounded-lg bg-surface/94">
              <h2>Geographic Location & Coordinates</h2>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Latitude (deg)</span>
                  <input 
                    type="number" 
                    step="any"
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                    value={latitude} 
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    readOnly={!isEditing} 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Longitude (deg)</span>
                  <input 
                    type="number" 
                    step="any"
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                    value={longitude} 
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    readOnly={!isEditing} 
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Rotation (deg)</span>
                  <input 
                    type="number" 
                    step="any"
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                    value={rotation} 
                    onChange={(e) => setRotation(Number(e.target.value))}
                    readOnly={!isEditing} 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Elevation (m)</span>
                  <input 
                    type="number" 
                    step="any"
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                    value={elevation} 
                    onChange={(e) => setElevation(Number(e.target.value))}
                    readOnly={!isEditing} 
                  />
                </div>
              </div>
            </section>
          )}

          {activeTab === "Members" && (
            <section className="flex flex-col gap-4 p-6 border border-border rounded-lg bg-surface/94">
              <h2>Members & Permissions</h2>

              {/* Add Member Form */}
              <form onSubmit={handleAddMember} style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "flex-end",
                marginBottom: "20px",
                padding: "16px",
                background: "rgba(0,0,0,0.15)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)"
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 200px" }}>
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: "700" }}>MEMBER EMAIL</span>
                  <input 
                    type="email" 
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                    placeholder="engineer@company.com" 
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    disabled={submitLoading}
                    required
                    style={{ height: "34px", padding: "6px 12px" }}
                  />
                </div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "160px" }}>
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider" style={{ fontSize: "11px", fontWeight: "700" }}>ASSIGN ROLE</span>
                  <select 
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border" 
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as any)}
                    disabled={submitLoading}
                    style={{ height: "34px", padding: "6px 12px", background: "var(--surface-raised)", border: "1px solid var(--border-strong)" }}
                  >
                    <option value="project member">Project Member</option>
                    <option value="project admin">Project Admin</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-[#8f8fff] rounded-lg bg-gradient-to-b from-[#8c8cff] to-[#6d6dff] text-[#fdfdff] cursor-pointer text-xs font-semibold hover:border-[#aaaaff] hover:bg-gradient-to-b hover:from-[#9c9cff] hover:to-[#7d7dff] hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none" 
                  disabled={submitLoading}
                  style={{ height: "34px", padding: "0 16px" }}
                >
                  {submitLoading ? "Adding..." : "Add Member"}
                </button>
                
                {formError && (
                  <div style={{ width: "100%", color: "var(--status-danger)", fontSize: "12px", marginTop: "4px", fontWeight: "500" }}>
                    {formError}
                  </div>
                )}
              </form>
              
              <table className="w-full border-collapse text-fg text-xs">
                <thead>
                  <tr>
                    <th>User / Member ID</th>
                    <th>Role</th>
                    <th style={{ textAlign: "center" }}>Bim Model</th>
                    <th style={{ textAlign: "center" }}>Project Standard</th>
                    <th style={{ textAlign: "center" }}>Clash Detection</th>
                    <th style={{ textAlign: "center" }}>Document Status</th>
                    <th>Status</th>
                    <th style={{ width: "80px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.members && project.members.length > 0 ? (
                    project.members.map((member) => {
                      const role = memberRoles[member];
                      return (
                        <tr key={member}>
                          <td className="mono" style={{ fontWeight: "500" }}>{member}</td>
                          <td>
                             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                               {loadingRoles ? (
                                 <span className="inline-flex items-center min-h-[20px] px-2 py-0.5 border border-border-strong rounded-full bg-[#20222a] text-muted text-[10px] font-bold uppercase tracking-wider">Loading...</span>
                                ) : (
                                 <select
                                   value={role || "project member"}
                                   onChange={(e) => handleRoleChange(member, e.target.value as any)}
                                   disabled={updatingMembers[member]?.loading}
                                   style={{
                                     height: "26px",
                                     padding: "2px 8px",
                                     background: role === "project admin" ? "oklch(70% 0.14 150 / 13%)" : "oklch(18% 0.02 255)",
                                     border: "1px solid " + (role === "project admin" ? "oklch(70% 0.14 150 / 42%)" : "var(--border-strong)"),
                                     borderRadius: "999px",
                                     color: role === "project admin" ? "var(--status-ok)" : "var(--muted)",
                                     fontSize: "10px",
                                     fontWeight: "700",
                                     letterSpacing: "0.05em",
                                     textTransform: "uppercase",
                                     cursor: "pointer",
                                     outline: "none",
                                     width: "fit-content"
                                   }}
                                 >
                                   <option value="project member" style={{ background: "var(--surface-raised)", color: "var(--fg)" }}>Project Member</option>
                                   <option value="project admin" style={{ background: "var(--surface-raised)", color: "var(--fg)" }}>Project Admin</option>
                                 </select>
                               )}
                               
                               {updatingMembers[member]?.loading && (
                                 <div className="inline-spinner" style={{
                                   width: "12px",
                                   height: "12px",
                                   border: "2px solid var(--border)",
                                   borderTopColor: "var(--accent)",
                                   borderRadius: "50%",
                                   animation: "inline-spin 0.6s linear infinite"
                                 }} />
                               )}
                               
                               {updatingMembers[member]?.success && (
                                 <Icon name="CHECK" size={14} style={{ color: "var(--status-ok)" }} />
                               )}
                               
                               {updatingMembers[member]?.error && (
                                 <span title={updatingMembers[member]?.error || "Error"}>
                                   <Icon name="WARNING" size={14} style={{ color: "var(--status-danger)" }} />
                                 </span>
                               )}
                             </div>
                           </td>
                          <td>{renderPermissionToggle(member, "model", role === "project admin")}</td>
                          <td>{renderPermissionToggle(member, "standard", role === "project admin")}</td>
                          <td>{renderPermissionToggle(member, "clashes", role === "project admin")}</td>
                          <td>{renderPermissionToggle(member, "documents", role === "project admin")}</td>
                          <td style={{ color: "var(--status-ok)", fontWeight: "600" }}>Active</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                               type="button"
                               className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-transparent rounded-lg bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none icon-btn"
                               style={{ color: "var(--status-danger)", padding: "4px" }}
                               onClick={() => handleRemoveMember(member)}
                               disabled={member === user?.email}
                               title={member === user?.email ? "You cannot remove yourself" : "Remove Member"}
                            >
                               <Icon name="CLOSE" size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", fontStyle: "italic", padding: "20px" }}>
                        No members assigned to this project
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "Document Status" && (
            <section className="flex flex-col gap-4 p-6 border border-border rounded-lg bg-surface/94" style={{ maxWidth: "800px" }}>
              <h2>Configure Document Status Tabs</h2>
              <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "20px" }}>
                Add or edit dashboards (e.g. Power BI shareable links) to show up under the Document Status page.
              </p>

              {/* Add/Edit Tab Form */}
              <form onSubmit={handleAddOrUpdateTab} style={{
                marginBottom: "24px",
                padding: "20px",
                background: "rgba(0,0,0,0.15)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                display: "grid",
                gap: "16px"
              }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", margin: 0, color: "var(--fg)" }}>
                  {editingTabId ? "Edit Tab Configuration" : "Add New Tab"}
                </h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Tab Title</span>
                    <input 
                      type="text"
                      className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border"
                      placeholder="e.g. Document Overall"
                      value={tabTitle}
                      onChange={(e) => setTabTitle(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Section Title</span>
                    <input 
                      type="text"
                      className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border"
                      placeholder="e.g. Document Status"
                      value={sectionTitle}
                      onChange={(e) => setSectionTitle(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Partner URL (Power BI link)</span>
                  <input 
                    type="url"
                    className="w-full bg-[#1b1c21] border border-border-strong rounded-lg p-2 px-3 text-fg outline-none transition duration-150 ease-in-out focus:border-accent read-only:opacity-80 read-only:cursor-default read-only:border-border font-mono"
                    placeholder="https://app.powerbi.com/view?r=..."
                    value={tabUrl}
                    onChange={(e) => setTabUrl(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  {editingTabId && (
                    <button 
                      type="button" 
                      className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-border-strong rounded-lg bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-[#5a5666] hover:bg-[#302d38] hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none" 
                      onClick={() => {
                        setTabTitle("");
                        setSectionTitle("");
                        setTabUrl("");
                        setEditingTabId(null);
                        setTabError(null);
                      }}
                      disabled={tabSaving}
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-[#8f8fff] rounded-lg bg-gradient-to-b from-[#8c8cff] to-[#6d6dff] text-[#fdfdff] cursor-pointer text-xs font-semibold hover:border-[#aaaaff] hover:bg-gradient-to-b hover:from-[#9c9cff] hover:to-[#7d7dff] hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={tabSaving}
                  >
                    {tabSaving ? "Saving..." : (editingTabId ? "Save Changes" : "Add Tab")}
                  </button>
                </div>

                {tabError && (
                  <div style={{ color: "var(--status-danger)", fontSize: "12px", fontWeight: "500" }}>
                    {tabError}
                  </div>
                )}
              </form>

              {/* Tabs Table List */}
              <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "var(--fg)" }}>Configured Tabs</h3>
              <table className="w-full border-collapse text-fg text-xs">
                <thead>
                  <tr>
                    <th>Tab Title</th>
                    <th>Section Title</th>
                    <th>URL Link</th>
                    <th style={{ width: "120px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.documentStatusTabs && project.documentStatusTabs.length > 0 ? (
                    project.documentStatusTabs.map((tab) => (
                      <tr key={tab.id}>
                        <td style={{ fontWeight: "500" }}>{tab.tabTitle}</td>
                        <td>{tab.sectionTitle}</td>
                        <td className="mono" style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tab.url}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-transparent rounded-lg bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none icon-btn"
                              style={{ padding: "4px" }}
                              onClick={() => handleEditTab(tab)}
                              title="Edit Tab"
                            >
                              <Icon name="EDIT" size={14} />
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-2 min-h-[32px] px-3 py-1.5 border border-transparent rounded-lg bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg hover:translate-y-[-1px] transition-all active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none icon-btn"
                              style={{ color: "var(--status-danger)", padding: "4px" }}
                              onClick={() => handleDeleteTab(tab.id)}
                              title="Delete Tab"
                            >
                              <Icon name="CLOSE" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", fontStyle: "italic", padding: "20px" }}>
                        No Document Status tabs configured for this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

        </div>
      </div>
    </AppShell>
  );
}
