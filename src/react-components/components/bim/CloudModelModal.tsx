import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useBimStore } from "@/react-components/store/bimStore";
import { useProjectStore } from "@/react-components/store/projectStore";
import { useProject } from "@/react-components/features/projects/useProjects";
import { supabase } from "@/integrations/supabase/client";
import * as OBC from "@thatopen/components";
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

interface CloudFile {
  name: string;
  size: number;
  updatedAt: string;
  revitVersion: string;
  checked: boolean;
}

interface CloudModelModalProps {
  onClose: () => void;
}

export function CloudModelModal({ onClose }: CloudModelModalProps) {
  const { components, setModelLoading } = useBimStore();
  const { activeProjectId } = useProjectStore();
  const { data: project, isLoading: isProjectLoading } = useProject(activeProjectId);

  // States
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [isFetchingFiles, setIsFetchingFiles] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortAscending, setSortAscending] = useState(true);

  // Loading models state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatuses, setDownloadStatuses] = useState<
    Record<string, "pending" | "loading" | "done" | "error">
  >({});

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

  const projectPath = project ? `${project.projectnumber}_${project.projectName}` : "";
  const prefix = project ? `${projectPath}/02_frag` : "";

  // Fetch files from Supabase Storage
  useEffect(() => {
    if (!project) return;

    async function loadFiles() {
      setIsFetchingFiles(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase.storage
          .from("project-files")
          .list(prefix, {
            sortBy: { column: "name", order: "asc" },
            limit: 100,
          });

        if (error) throw error;

        const mappedFiles: CloudFile[] = (data || [])
          .filter(
            (item) =>
              item.name !== ".emptyFolderPlaceholder" &&
              item.name.toLowerCase().endsWith(".frag")
          )
          .map((item) => {
            // Find Revit version fallback by filename regex
            let revitVersion = "";
            if (item.metadata) {
              const metaObj = item.metadata as any;
              if (metaObj.customMetadata) {
                for (const key of Object.keys(metaObj.customMetadata)) {
                  if (key.toLowerCase().includes("revit")) {
                    revitVersion = metaObj.customMetadata[key];
                  }
                }
              }
            }
            if (!revitVersion) {
              const match = item.name.match(/_R(\d{2})/i);
              if (match) {
                revitVersion = "20" + match[1];
              }
            }

            return {
              name: item.name,
              size: item.metadata?.size || 0,
              updatedAt: item.updated_at || item.created_at || "",
              revitVersion,
              checked: false,
            };
          });

        setFiles(mappedFiles);
      } catch (err: any) {
        console.error("Failed to load files from Supabase:", err);
        setFetchError(err.message || "Failed to fetch files from storage.");
      } finally {
        setIsFetchingFiles(false);
      }
    }

    loadFiles();
  }, [project, prefix]);

  // Handle ESC key close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDownloading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isDownloading]);

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

  // Toggle selection
  const handleToggleFile = (name: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.name === name ? { ...f, checked: !f.checked } : f))
    );
  };

  // Bulk actions
  const handleCheckAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, checked: true })));
  };

  const handleUncheckAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, checked: false })));
  };

  const handleToggleAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, checked: !f.checked })));
  };

  // Download & load models in parallel batch of 5
  const handleLoadSelected = async () => {
    if (!components || selectedFiles.length === 0) return;

    setIsDownloading(true);
    setModelLoading(true);

    const initialStatuses: Record<string, "pending" | "loading" | "done" | "error"> = {};
    selectedFiles.forEach((f) => {
      initialStatuses[f.name] = "pending";
    });
    setDownloadStatuses(initialStatuses);

    const fragments = components.get(OBC.FragmentsManager);
    const MAX_PARALLEL = 5;
    let hasError = false;

    // Process in batches
    for (let i = 0; i < selectedFiles.length; i += MAX_PARALLEL) {
      const batch = selectedFiles.slice(i, i + MAX_PARALLEL);
      await Promise.all(
        batch.map(async (fileItem) => {
          setDownloadStatuses((prev) => ({ ...prev, [fileItem.name]: "loading" }));
          const fullPath = `${prefix}/${fileItem.name}`;
          try {
            const { data, error } = await supabase.storage
              .from("project-files")
              .download(fullPath);

            if (error) throw error;
            if (!data) throw new Error("No data returned");

            const buffer = await data.arrayBuffer();
            const model = await fragments.core.load(new Uint8Array(buffer), {
              modelId: fileItem.name.replace(/\.frag$/i, ""),
            });

            if (model) {
              (model as any).name = fileItem.name;
            }

            setDownloadStatuses((prev) => ({ ...prev, [fileItem.name]: "done" }));
          } catch (err) {
            console.error(`Failed to load cloud model "${fileItem.name}":`, err);
            setDownloadStatuses((prev) => ({ ...prev, [fileItem.name]: "error" }));
            hasError = true;
          }
        })
      );
    }

    setModelLoading(false);

    // If no errors, auto close modal after 1s. Otherwise let user see the status.
    if (!hasError) {
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  // Stats
  const completedCount = Object.values(downloadStatuses).filter(
    (s) => s === "done" || s === "error"
  ).length;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!isDownloading) onClose();
      }}
    >
      <div
        className="w-[500px] max-w-full max-h-[85vh] flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {isDownloading ? (
          /* DOWNLOAD PROGRESS PANEL */
          <div className="flex flex-col items-center justify-center p-8 gap-6 text-fg">
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-accent animate-spin" />
              <span className="absolute text-[10px] font-bold">
                {completedCount}/{selectedFiles.length}
              </span>
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold">Loading Cloud Models</h3>
              <p className="text-xs text-muted mt-1">
                Please wait while models are loaded into the viewport.
              </p>
            </div>

            <div className="w-full max-h-[250px] overflow-y-auto border border-border rounded-radius bg-surface-alt p-3 flex flex-col gap-2">
              {selectedFiles.map((file) => {
                const status = downloadStatuses[file.name] || "pending";
                return (
                  <div
                    key={file.name}
                    className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
                  >
                    <span className="truncate max-w-[75%] font-medium text-fg">
                      {file.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {status === "pending" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted-2/20 text-muted font-semibold">
                          Pending
                        </span>
                      )}
                      {status === "loading" && (
                        <div className="flex items-center gap-1 text-accent font-semibold text-[10px]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Downloading</span>
                        </div>
                      )}
                      {status === "done" && (
                        <span className="flex items-center gap-0.5 text-status-ok font-semibold text-[10px]">
                          <Check className="w-3.5 h-3.5" />
                          <span>Ready</span>
                        </span>
                      )}
                      {status === "error" && (
                        <span className="flex items-center gap-0.5 text-status-danger font-semibold text-[10px]">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {completedCount === selectedFiles.length &&
              Object.values(downloadStatuses).includes("error") && (
                <button
                  onClick={onClose}
                  className="w-full min-h-9 py-2 px-4 rounded-radius bg-surface-raised border border-border hover:bg-surface-alt font-semibold text-xs text-fg transition-all cursor-pointer"
                >
                  Close & View Viewer
                </button>
              )}
          </div>
        ) : (
          /* FILE SELECTOR PANEL */
          <>
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
                filteredAndSortedFiles.map((file) => (
                  <div
                    key={file.name}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-radius border border-border hover:border-accent bg-surface-alt/30 transition-all cursor-pointer select-none",
                      file.checked && "border-accent bg-accent/5"
                    )}
                    onClick={() => handleToggleFile(file.name)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={file.checked}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 accent-accent shrink-0 pointer-events-none"
                      />
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
                        </div>
                      </div>
                    </div>
                  </div>
                ))
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
                disabled={!hasSelection || isDownloading}
                onClick={handleLoadSelected}
                className={cn(
                  "w-full min-h-9 py-2 px-4 rounded-radius bg-accent hover:opacity-90 font-bold text-xs text-white transition-all cursor-pointer flex items-center justify-center gap-1.5",
                  (!hasSelection || isDownloading) && "opacity-50 cursor-not-allowed bg-muted"
                )}
                type="button"
              >
                <span>Load Models</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
