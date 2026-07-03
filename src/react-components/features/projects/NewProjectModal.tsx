import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useCreateProject } from "./useProjects";
import type { Database } from "@/integrations/supabase/types";

type ProjectStatus = Database["public"]["Enums"]["project_status"];

interface NewProjectModalProps {
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const createProject = useCreateProject();

  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("bidding");
  const [startDate, setStartDate] = useState(todayISO());
  const [finishDate, setFinishDate] = useState(todayISO());
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = projectName.trim();
    const parsedNumber = Number(projectNumber);

    if (!trimmedName) {
      setFormError("Project name is required.");
      return;
    }
    if (!projectNumber || Number.isNaN(parsedNumber)) {
      setFormError("Project number must be a valid number.");
      return;
    }
    if (finishDate < startDate) {
      setFormError("Finish date cannot be before the start date.");
      return;
    }

    setFormError(null);

    try {
      const created = await createProject.mutateAsync({
        project_name: trimmedName,
        project_number: parsedNumber,
        description: description.trim() || null,
        status,
        start_date: startDate,
        finish_date: finishDate,
      });
      onCreated?.(created.id);
      onClose();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        setFormError("That project number is already in use. Please choose a different one.");
      } else {
        setFormError(err instanceof Error ? err.message : "Failed to create project.");
      }
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-full max-h-[85vh] flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
          <span className="text-xs font-bold text-fg">New Project</span>
          <button
            onClick={onClose}
            className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer"
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4 overflow-y-auto">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Project Name
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. Riverside Tower"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Project Number
            <input
              type="number"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="e.g. 1024"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-16 px-3 py-2 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              placeholder="Optional description"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
            >
              <option value="bidding">Bidding</option>
              <option value="active">Active</option>
              <option value="finished">Finished</option>
            </select>
          </label>

          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted flex-1">
              Start Date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted flex-1">
              Finish Date
              <input
                type="date"
                value={finishDate}
                onChange={(e) => setFinishDate(e.target.value)}
                className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
              />
            </label>
          </div>

          {formError && (
            <p className="text-[11px] text-status-danger">{formError}</p>
          )}

          <button
            type="submit"
            disabled={createProject.isPending}
            className="mt-1 w-full min-h-9 py-2 px-4 rounded-radius bg-accent hover:opacity-90 font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createProject.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <span>Create Project</span>
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
