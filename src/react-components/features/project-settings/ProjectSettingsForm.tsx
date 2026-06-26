import { useState, useEffect } from "react";
import { useUpdateProject } from "@/react-components/features/projects/useProjects";
import type { AppProject } from "@/types";
import { Icon } from "@/react-components/components/ui";

interface ProjectSettingsFormProps {
  project: AppProject;
  isEditing: boolean;
  onSaveSuccess: () => void;
  onSaveLoadingState: (loading: boolean) => void;
}

export function ProjectSettingsForm({
  project,
  isEditing,
  onSaveSuccess,
  onSaveLoadingState,
}: ProjectSettingsFormProps) {
  const updateProjectMutation = useUpdateProject();

  // Save feedback states
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

  // Sync state values when project updates or when edit mode is toggled off (cancel)
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
  }, [project, isEditing]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project.id) return;
    setSaveError(null);
    setSaveSuccess(false);

    if (!projectName.trim()) {
      setSaveError("Project Name cannot be empty.");
      return;
    }

    onSaveLoadingState(true);
    try {
      await updateProjectMutation.mutateAsync({
        id: project.id,
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
      onSaveSuccess();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save project settings.");
    } finally {
      onSaveLoadingState(false);
    }
  };

  // Format date helper
  const formatDateLabel = (date: Date) => {
    return date instanceof Date && !isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })
      : "N/A";
  };

  return (
    <form id="project-settings-form" onSubmit={handleFormSubmit} className="flex flex-col gap-6 w-full">
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
    </form>
  );
}
