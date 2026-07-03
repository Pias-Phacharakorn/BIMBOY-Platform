import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useBimStore } from "@/react-components/store/bimStore";
import { useProjectStore } from "@/react-components/store/projectStore";
import { useProject } from "@/react-components/features/projects/useProjects";
import { useCloudModelFiles, useLoadCloudModelBatch } from "@/react-components/features/cloud-models/useCloudModels";
import type { CloudFragFile } from "@/react-components/features/cloud-models/cloudModelsService";
import {
  Loader2,
  Search,
  ArrowUpDown,
  Check,
  X,
  AlertCircle,
  FolderOpen,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CloudFile extends CloudFragFile {
  checked: boolean;
}

interface CloudModelModalProps {
  onClose: () => void;
}

export function CloudModelModal({ onClose }: CloudModelModalProps) {
  const { components } = useBimStore();
  const { activeProjectId } = useProjectStore();
  const { data: project, isLoading: isProjectLoading } = useProject(activeProjectId);
  const loadedModelIds = useBimStore((s) => s.loadedModelIds);
  const loadFiles = useLoadCloudModelBatch();

  const projectPath = project ? `${project.projectnumber}_${project.projectName}` : "";
  const prefix = project ? `${projectPath}/02_frag` : "";

  const {
    data: cloudFiles = [],
    isLoading: isFetchingFiles,
    error: fetchErrorObj,
  } = useCloudModelFiles(prefix, !!project);
  const fetchError = fetchErrorObj instanceof Error ? fetchErrorObj.message : null;

  // Local checked-state layered on top of the queried file list
  const [checkedNames, setCheckedNames] = useState<Set<string>>(new Set());
  const files: CloudFile[] = useMemo(
    () => cloudFiles.map((f) => ({ ...f, checked: checkedNames.has(f.name) })),
    [cloudFiles, checkedNames]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [sortAscending, setSortAscending] = useState(true);

  // Helper: Format bytes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Helper: Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Handle ESC key close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Filter & Sort
  const filteredAndSortedFiles = useMemo(() => {
    return files
      .filter((file) =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const comp = a.name.localeCompare(b.name);
        return sortAscending ? comp : -comp;
      });
  }, [files, searchQuery, sortAscending]);

  const selectedFiles = useMemo(() => files.filter((f) => f.checked), [files]);
  const hasSelection = selectedFiles.length > 0;

  // Toggle selection (already-loaded files can't be toggled — see "Loaded" badge in the list)
  const handleToggleFile = (name: string, modelId: string) => {
    if (loadedModelIds.includes(modelId)) return;
    setCheckedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Bulk actions (skip files already loaded in the viewer)
  const selectableNames = useMemo(
    () => files.filter((f) => !loadedModelIds.includes(f.modelId)).map((f) => f.name),
    [files, loadedModelIds]
  );

  const handleCheckAll = () => {
    setCheckedNames(new Set(selectableNames));
  };

  const handleUncheckAll = () => {
    setCheckedNames(new Set());
  };

  const handleToggleAll = () => {
    setCheckedNames((prev) =>
      prev.size === selectableNames.length ? new Set() : new Set(selectableNames)
    );
  };

  // Delegate to the shared batch loader (CloudModelLoadingModal shows progress globally);
  // close this file-picker modal immediately so the loading modal takes over.
  const handleLoadSelected = async () => {
    if (!components || selectedFiles.length === 0) return;
    onClose();
    await loadFiles(selectedFiles, prefix, components);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-[500px] max-w-full max-h-[85vh] flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-fg">
              Cloud Models
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer"
            type="button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 p-3 border-b border-border bg-surface">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <button
                onClick={() => setSortAscending(!sortAscending)}
                className="flex items-center justify-center w-8 h-8 rounded-radius border border-border hover:border-accent hover:bg-surface-alt text-fg transition-all cursor-pointer"
                title="Sort A-Z"
                type="button"
              >
                <ArrowUpDown
                  className={cn(
                    "w-4 h-4 transition-colors",
                    sortAscending ? "text-accent" : "text-fg"
                  )}
                />
              </button>
            </div>

            {/* Scrollable File List */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 min-h-[220px]">
              {isProjectLoading || isFetchingFiles ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                  <span className="text-xs text-muted">Retrieving files from Supabase...</span>
                </div>
              ) : fetchError ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
                  <AlertCircle className="w-6 h-6 text-status-danger" />
                  <span className="text-xs text-fg font-medium">Error loading files</span>
                  <span className="text-[11px] text-muted">{fetchError}</span>
                </div>
              ) : filteredAndSortedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted">
                  <FileCode className="w-8 h-8 mb-2 stroke-[1.5]" />
                  <span className="text-xs font-medium">No .frag files found</span>
                  <span className="text-[11px] text-muted-2 max-w-[200px] mt-1">
                    Upload model files in settings folder '02_frag' first.
                  </span>
                </div>
              ) : (
                filteredAndSortedFiles.map((file) => {
                  const isLoaded = loadedModelIds.includes(file.modelId);
                  return (
                    <div
                      key={file.name}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-radius border border-border bg-surface-alt/30 transition-all select-none",
                        file.checked && "border-accent bg-accent/5",
                        isLoaded ? "opacity-60 cursor-default" : "hover:border-accent cursor-pointer"
                      )}
                      onClick={() => handleToggleFile(file.name, file.modelId)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isLoaded ? (
                          <Check className="w-3.5 h-3.5 text-status-ok shrink-0" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={file.checked}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 accent-accent shrink-0 pointer-events-none"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-fg truncate">
                            {file.name.replace(/\.frag$/i, "")}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                            <span>{formatBytes(file.size)}</span>
                            <span>•</span>
                            <span>{formatDate(file.updatedAt)}</span>
                            {file.revitVersion && (
                              <>
                                <span>•</span>
                                <span className="px-1 py-0.25 rounded bg-accent-muted text-accent font-medium">
                                  Revit {file.revitVersion}
                                </span>
                              </>
                            )}
                            {isLoaded && (
                              <>
                                <span>•</span>
                                <span className="px-1 py-0.25 rounded bg-status-ok/15 text-status-ok font-medium">
                                  Loaded
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bulk Selection Actions */}
            <div className="flex items-center justify-between px-3 py-2 bg-surface-raised border-t border-border text-[11px]">
              <span className="text-muted">
                Selected: <strong className="text-fg">{selectedFiles.length}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCheckAll}
                  className="px-2 py-1 rounded hover:bg-surface-alt hover:text-fg text-muted font-medium transition-all cursor-pointer"
                  type="button"
                >
                  Check All
                </button>
                <button
                  onClick={handleUncheckAll}
                  className="px-2 py-1 rounded hover:bg-surface-alt hover:text-fg text-muted font-medium transition-all cursor-pointer"
                  type="button"
                >
                  Uncheck All
                </button>
                <button
                  onClick={handleToggleAll}
                  className="px-2 py-1 rounded hover:bg-surface-alt hover:text-fg text-muted font-medium transition-all cursor-pointer"
                  type="button"
                >
                  Toggle All
                </button>
              </div>
            </div>

            {/* Footer Submit Button */}
            <div className="p-3 bg-surface-raised border-t border-border">
              <button
                disabled={!hasSelection}
                onClick={handleLoadSelected}
                className={cn(
                  "w-full min-h-9 py-2 px-4 rounded-radius bg-accent hover:opacity-90 font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  !hasSelection && "opacity-50 cursor-not-allowed bg-muted"
                )}
                type="button"
              >
                <span>Load Models</span>
              </button>
            </div>
      </div>
    </div>,
    document.body
  );
}
