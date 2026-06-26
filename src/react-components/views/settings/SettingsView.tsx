import { useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { AppShell, WorkspaceHeader } from "@/react-components/components/layout";
import { Icon } from "@/react-components/components/ui";
import {
  useProject,
  useUpdateProject,
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
} from "@/react-components/features/projects/useProjects";

export function SettingsView() {
  const { projectId } = useParams({ strict: false });
  const { data: project, isLoading: isProjectLoading, isError: isProjectError, error: projectError } = useProject(projectId);
  const { data: members = [], isLoading: isMembersLoading } = useProjectMembers(projectId);

  const updateProjectMutation = useUpdateProject();
  const addMemberMutation = useAddProjectMember();
  const removeMemberMutation = useRemoveProjectMember();
  const updateMemberRoleMutation = useUpdateProjectMemberRole();

  // Tab switching state
  const [activeTab, setActiveTab] = useState("General");
  const tabs = ["General", "Members"];

  // Edit toggles and loading feedbacks
  const [isEditing, setIsEditing] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form states for general info
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState(0);
  const [status, setStatus] = useState<"bidding" | "active" | "finished">("active");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");

  // Form states for cloud storage directories
  const [ifcFolderPath, setIfcFolderPath] = useState("");
  const [fragFolderPath, setFragFolderPath] = useState("");
  const [clashFolderPath, setClashFolderPath] = useState("");
  const [hasModel, setHasModel] = useState(false);

  // Form states for GIS
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [elevation, setElevation] = useState(0);

  // Form states for adding member
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"project_admin" | "project_member">("project_member");
  const [memberError, setMemberError] = useState<string | null>(null);

  // Sync state values when project updates
  useEffect(() => {
    if (project) {
      setProjectName(project.projectName);
      setProjectNumber(project.projectnumber);
      setStatus((project.status as any) || "active");
      setDescription(project.description || "");
      setStartDate(project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "");
      setFinishDate(project.finishDate ? new Date(project.finishDate).toISOString().split("T")[0] : "");
      setIfcFolderPath(project.files?.ifc || "");
      setFragFolderPath(project.files?.frag || "");
      setClashFolderPath((project as any).clashFolderPath || "");
      setHasModel(project.files?.hasModel || false);
      setLatitude((project as any).location?.latitude || 0);
      setLongitude((project as any).location?.longitude || 0);
      setRotation((project as any).location?.rotation || 0);
      setElevation((project as any).location?.elevation || 0);
    }
  }, [project]);

  const handleCancelEdit = () => {
    if (project) {
      setProjectName(project.projectName);
      setProjectNumber(project.projectnumber);
      setStatus((project.status as any) || "active");
      setDescription(project.description || "");
      setStartDate(project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "");
      setFinishDate(project.finishDate ? new Date(project.finishDate).toISOString().split("T")[0] : "");
      setIfcFolderPath(project.files?.ifc || "");
      setFragFolderPath(project.files?.frag || "");
      setClashFolderPath((project as any).clashFolderPath || "");
      setHasModel(project.files?.hasModel || false);
      setLatitude((project as any).location?.latitude || 0);
      setLongitude((project as any).location?.longitude || 0);
      setRotation((project as any).location?.rotation || 0);
      setElevation((project as any).location?.elevation || 0);
    }
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    if (!projectId || !project) return;
    setSaveError(null);
    setSaveSuccess(false);

    if (!projectName.trim()) {
      setSaveError("Project Name cannot be empty.");
      return;
    }

    setSaveLoading(true);
    try {
      await updateProjectMutation.mutateAsync({
        id: projectId,
        project: {
          project_name: projectName.trim(),
          project_number: Number(projectNumber),
          status: status,
          description: description.trim(),
          start_date: startDate ? new Date(startDate).toISOString() : project.startDate.toISOString(),
          finish_date: finishDate ? new Date(finishDate).toISOString() : project.finishDate.toISOString(),
          ifc_folder_path: ifcFolderPath.trim(),
          frag_folder_path: fragFolderPath.trim(),
          clash_folder_path: clashFolderPath.trim(),
          has_model: Boolean(hasModel),
          latitude: Number(latitude),
          longitude: Number(longitude),
          rotation: Number(rotation),
          elevation: Number(elevation),
        },
      });

      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save project settings.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
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
    if (!projectId) return;
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
    if (!projectId) return;
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

  if (isProjectLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading project details...</span>
        </div>
      </div>
    );
  }

  if (isProjectError || !project) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-bg text-fg">
        <div className="text-center p-6 border border-border bg-surface rounded-radius max-w-md">
          <Icon name="WARNING" size={32} className="text-status-danger mb-4" />
          <h2 className="text-lg font-bold mb-2">Project Not Found</h2>
          <p className="text-muted text-sm mb-4">
            {projectError?.message || "The requested project details could not be loaded."}
          </p>
        </div>
      </div>
    );
  }

  // Format date helper
  const formatDateLabel = (date: Date) => {
    return date instanceof Date && !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })
      : "N/A";
  };

  return (
    <AppShell project={project}>
      <WorkspaceHeader
        title="Project Settings"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          activeTab === "General" ? (
            isEditing ? (
              <div className="flex gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border rounded-radius cursor-pointer text-xs font-semibold border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)] disabled:opacity-60 disabled:cursor-not-allowed"
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={saveLoading}
                >
                  <Icon name="CHECK" size={14} />
                  {saveLoading ? "Saving..." : "Save Settings"}
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt transition-colors duration-120"
                  type="button"
                  onClick={handleCancelEdit}
                >
                  <Icon name="CLOSE" size={14} />
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="inline-flex items-center justify-center gap-2 min-h-8 px-3 py-1.5 border rounded-radius cursor-pointer text-xs font-semibold border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)]"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                <Icon name="EDIT" size={14} />
                Edit Settings
              </button>
            )
          ) : null
        }
      />

      <div className="relative flex-1 min-w-0 overflow-auto bg-gradient-to-b from-[oklch(12%_0.014_255)] to-[oklch(9.8%_0.012_255)]">
        <div className="flex flex-col gap-6 w-full max-w-[1200px] p-6 md:p-8">
          {saveSuccess && (
            <div className="flex items-center gap-2.5 p-3 px-4 bg-status-ok/10 border border-status-ok/30 rounded-radius text-status-ok text-sm font-medium animate-slide-down">
              <Icon name="CHECK" size={16} />
              <span>Project settings successfully updated!</span>
            </div>
          )}

          {saveError && (
            <div className="flex items-center gap-2.5 p-3 px-4 bg-status-danger/10 border border-status-danger/30 rounded-radius text-status-danger text-sm font-medium animate-slide-down">
              <Icon name="WARNING" size={16} />
              <span>{saveError}</span>
            </div>
          )}

          {activeTab === "General" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* General Info Card */}
                <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <h2 className="text-[16px] font-bold text-fg border-b border-border pb-2">General Information</h2>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="project-name">
                      Project Name
                    </label>
                    <input
                      id="project-name"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border"
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      readOnly={!isEditing}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="project-number">
                        Project Number
                      </label>
                      <input
                        id="project-number"
                        className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border"
                        type="number"
                        value={projectNumber}
                        onChange={(e) => setProjectNumber(Number(e.target.value))}
                        readOnly={!isEditing}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="status">
                        Status
                      </label>
                      {isEditing ? (
                        <select
                          id="status"
                          className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
                          value={status}
                          onChange={(e) => setStatus(e.target.value as any)}
                        >
                          <option value="bidding">Bidding</option>
                          <option value="active">Active</option>
                          <option value="finished">Finished</option>
                        </select>
                      ) : (
                        <div className="py-2">
                          <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                            status === "active"
                              ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                              : status === "bidding"
                              ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                              : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                          }`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="description">
                      Description
                    </label>
                    <textarea
                      id="description"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border min-h-24 resize-none"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="No description provided."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="start-date">
                        Start Date
                      </label>
                      <input
                        id="start-date"
                        className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border"
                        type={isEditing ? "date" : "text"}
                        value={isEditing ? startDate : startDate ? formatDateLabel(new Date(startDate)) : "N/A"}
                        onChange={(e) => setStartDate(e.target.value)}
                        readOnly={!isEditing}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="finish-date">
                        Finish Date
                      </label>
                      <input
                        id="finish-date"
                        className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border"
                        type={isEditing ? "date" : "text"}
                        value={isEditing ? finishDate : finishDate ? formatDateLabel(new Date(finishDate)) : "N/A"}
                        onChange={(e) => setFinishDate(e.target.value)}
                        readOnly={!isEditing}
                      />
                    </div>
                  </div>
                </section>

                {/* Storage & Cloud Connections Card */}
                <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <h2 className="text-[16px] font-bold text-fg border-b border-border pb-2">BIM Data & Cloud Connections</h2>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="ifc-path">
                      IFC Storage Directory (Supabase Bucket)
                    </label>
                    <input
                      id="ifc-path"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border font-mono text-xs"
                      type="text"
                      value={ifcFolderPath}
                      onChange={(e) => setIfcFolderPath(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="Not configured (no IFC path)"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="frag-path">
                      Processed 3D Geometry Directory (.frag)
                    </label>
                    <input
                      id="frag-path"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border font-mono text-xs"
                      type="text"
                      value={fragFolderPath}
                      onChange={(e) => setFragFolderPath(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="Not configured (no Frag path)"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="clash-path">
                      Clash Detection Reports Directory (.html)
                    </label>
                    <input
                      id="clash-path"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border font-mono text-xs"
                      type="text"
                      value={clashFolderPath}
                      onChange={(e) => setClashFolderPath(e.target.value)}
                      readOnly={!isEditing}
                      placeholder="Not configured (no Clash path)"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase">
                      BIM Model Status
                    </label>
                    <div className="py-1">
                      {isEditing ? (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-border bg-[#1b1c21] text-accent accent-accent focus:ring-accent cursor-pointer"
                            checked={hasModel}
                            onChange={(e) => setHasModel(e.target.checked)}
                          />
                          <span className="text-sm font-medium text-fg">3D Model Ready</span>
                        </label>
                      ) : (
                        <span className={`inline-flex items-center min-h-5 px-2 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          hasModel
                            ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                            : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                        }`}>
                          {hasModel ? "3D Model Ready" : "No 3D Model Attached"}
                        </span>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Geographic Info Card */}
              <section className="flex flex-col gap-4 p-6 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <h2 className="text-[16px] font-bold text-fg border-b border-border pb-2">Geographic Location & coordinates</h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="latitude">
                      Latitude (deg)
                    </label>
                    <input
                      id="latitude"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border font-mono"
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      readOnly={!isEditing}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="longitude">
                      Longitude (deg)
                    </label>
                    <input
                      id="longitude"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border font-mono"
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      readOnly={!isEditing}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="rotation">
                      Rotation (deg)
                    </label>
                    <input
                      id="rotation"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border font-mono"
                      type="number"
                      step="any"
                      value={rotation}
                      onChange={(e) => setRotation(Number(e.target.value))}
                      readOnly={!isEditing}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="elevation">
                      Elevation (m)
                    </label>
                    <input
                      id="elevation"
                      className="w-full px-3 py-2 border border-border-strong rounded-radius bg-[#1b1c21] text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent/50 read-only:opacity-80 read-only:bg-transparent read-only:border-border font-mono"
                      type="number"
                      step="any"
                      value={elevation}
                      onChange={(e) => setElevation(Number(e.target.value))}
                      readOnly={!isEditing}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "Members" && (
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
          )}
        </div>
      </div>
    </AppShell>
  );
}
