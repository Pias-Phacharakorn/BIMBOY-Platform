import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppProject } from "@/types";
import {
  Folder,
  FolderOpen,
  FileText,
  Trash2,
  Download,
  Upload,
  Loader2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FileCode,
  FileBox,
} from "lucide-react";

interface ProjectFoldersProps {
  project: AppProject;
}

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}

export function ProjectFolders({ project }: ProjectFoldersProps) {
  const projectPath = `${project.projectnumber}_${project.projectName}`;
  const subFolders = ["01_ifc", "02_frag", "03_ClashImport"];

  // States
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    [projectPath]: true, // Root is open by default
    "01_ifc": true,      // IFC open by default
  });
  const [files, setFiles] = useState<Record<string, StorageFile[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Format bytes to readable size
  const formatBytes = (bytes?: number, decimals = 2) => {
    if (bytes === undefined || bytes === null) return "Unknown size";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Format timestamp to readable date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "ifc") {
      return <FileBox className="w-4 h-4 text-[oklch(74%_0.13_195)] shrink-0" />;
    }
    if (ext === "frag") {
      return <FileCode className="w-4 h-4 text-accent shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-muted shrink-0" />;
  };

  // Fetch files for a specific folder
  const fetchFolderFiles = async (folderName: string) => {
    setLoading((prev) => ({ ...prev, [folderName]: true }));
    setErrors((prev) => ({ ...prev, [folderName]: null }));

    const prefix = `${projectPath}/${folderName}`;
    try {
      const { data, error } = await supabase.storage
        .from("project-files")
        .list(prefix, {
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        throw error;
      }

      // Filter out empty placeholders (if any) and map files
      const fileList: StorageFile[] = (data || [])
        .filter((item) => item.name !== ".emptyFolderPlaceholder")
        .map((item) => ({
          name: item.name,
          id: item.id || "",
          updated_at: item.updated_at || item.created_at || "",
          created_at: item.created_at || "",
          metadata: item.metadata
            ? {
                size: (item.metadata as any).size,
                mimetype: (item.metadata as any).mimetype,
              }
            : undefined,
        }));

      setFiles((prev) => ({ ...prev, [folderName]: fileList }));
    } catch (err: any) {
      console.error(`Error loading folder ${folderName}:`, err);
      setErrors((prev) => ({
        ...prev,
        [folderName]: err.message || "Failed to load files from storage",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [folderName]: false }));
    }
  };

  // Toggle folder expansion
  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const nextState = !prev[folderName];
      // Fetch if expanding and not loaded yet
      if (nextState && subFolders.includes(folderName) && !files[folderName]) {
        fetchFolderFiles(folderName);
      }
      return { ...prev, [folderName]: nextState };
    });
  };

  // Initial load
  useEffect(() => {
    if (project.id) {
      subFolders.forEach((folder) => {
        fetchFolderFiles(folder);
      });
    }
  }, [project.id]);

  // Handle File Upload
  const handleUpload = async (
    folderName: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading((prev) => ({ ...prev, [folderName]: true }));
    const fullPath = `${projectPath}/${folderName}/${file.name}`;

    try {
      const { error } = await supabase.storage
        .from("project-files")
        .upload(fullPath, file, {
          upsert: true,
        });

      if (error) throw error;

      // Refresh list
      await fetchFolderFiles(folderName);
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert(`Upload failed: ${err.message || err}`);
    } finally {
      setUploading((prev) => ({ ...prev, [folderName]: false }));
      // Reset input value to allow uploading the same file again if desired
      event.target.value = "";
    }
  };

  // Handle File Delete
  const handleDelete = async (folderName: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return;
    }

    const fullPath = `${projectPath}/${folderName}/${fileName}`;
    try {
      const { error } = await supabase.storage
        .from("project-files")
        .remove([fullPath]);

      if (error) throw error;

      // Refresh list
      await fetchFolderFiles(folderName);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(`Delete failed: ${err.message || err}`);
    }
  };

  // Handle File Download
  const handleDownload = (folderName: string, fileName: string) => {
    const fullPath = `${projectPath}/${folderName}/${fileName}`;
    const { data } = supabase.storage
      .from("project-files")
      .getPublicUrl(fullPath);

    if (data?.publicUrl) {
      const a = document.createElement("a");
      a.href = data.publicUrl;
      a.download = fileName;
      a.target = "_blank";
      a.click();
    } else {
      alert("Could not generate download URL.");
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full text-fg">
      {/* Settings section header */}
      <div className="flex flex-col gap-1 pb-4 border-b border-border">
        <h3 className="text-base font-bold text-fg">Project Files Directory</h3>
        <p className="text-xs text-muted">
          Manage model geometry files and clash reports directly inside the project's cloud storage.
        </p>
      </div>

      {/* Directory Tree Card */}
      <div className="border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius overflow-hidden p-6 flex flex-col gap-2">
        {/* Root Directory Row */}
        <div
          className="flex items-center gap-2 py-2 px-3 rounded-radius hover:bg-surface-alt transition-colors duration-120 cursor-pointer select-none text-sm font-semibold"
          onClick={() => toggleFolder(projectPath)}
        >
          {expandedFolders[projectPath] ? (
            <ChevronDown className="w-4 h-4 text-muted shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted shrink-0" />
          )}
          {expandedFolders[projectPath] ? (
            <FolderOpen className="w-5 h-5 text-accent shrink-0" />
          ) : (
            <Folder className="w-5 h-5 text-accent shrink-0" />
          )}
          <span className="font-mono text-[13px]">{projectPath}</span>
        </div>

        {/* Subdirectories */}
        {expandedFolders[projectPath] && (
          <div className="pl-6 border-l border-border/60 ml-5 flex flex-col gap-3 mt-1">
            {subFolders.map((subFolder) => {
              const isExpanded = expandedFolders[subFolder];
              const folderFiles = files[subFolder] || [];
              const isLoading = loading[subFolder];
              const isUploading = uploading[subFolder];
              const error = errors[subFolder];

              return (
                <div key={subFolder} className="flex flex-col gap-1">
                  {/* Folder Row */}
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-radius hover:bg-surface-alt/70 transition-colors duration-120 group">
                    <div
                      className="flex items-center gap-2 cursor-pointer select-none text-[13px] font-medium flex-1"
                      onClick={() => toggleFolder(subFolder)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-accent-2 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-accent-2 shrink-0" />
                      )}
                      <span className="font-mono">{subFolder}</span>
                      <span className="text-[10px] bg-surface-raised px-1.5 py-0.5 rounded-full text-muted border border-border">
                        {isLoading ? "..." : folderFiles.length}
                      </span>
                    </div>

                    {/* Actions (always visible on hover or mobile) */}
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 rounded-radius hover:bg-surface-raised text-muted hover:text-fg transition-colors duration-120 shrink-0"
                        onClick={() => fetchFolderFiles(subFolder)}
                        disabled={isLoading}
                        title="Refresh files"
                        type="button"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-accent" : ""}`} />
                      </button>

                      <label className="p-1 rounded-radius hover:bg-surface-raised text-muted hover:text-fg transition-colors duration-120 shrink-0 cursor-pointer">
                        {isUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleUpload(subFolder, e)}
                          accept={
                            subFolder === "01_ifc"
                              ? ".ifc"
                              : subFolder === "02_frag"
                              ? ".frag"
                              : ".json,.bcf,.xml"
                          }
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Files List in Subfolder */}
                  {isExpanded && (
                    <div className="pl-6 border-l border-border/40 ml-4 flex flex-col gap-1.5 mt-1">
                      {isLoading && folderFiles.length === 0 && (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                          <span>Loading files...</span>
                        </div>
                      )}

                      {error && (
                        <div className="text-xs text-status-danger py-1 px-2 border border-status-danger/20 bg-status-danger/10 rounded-radius">
                          {error}
                        </div>
                      )}

                      {!isLoading && !error && folderFiles.length === 0 && (
                        <div className="text-xs text-muted-2 py-2 px-3 italic">
                          Empty folder
                        </div>
                      )}

                      {folderFiles.map((file) => (
                        <div
                          key={file.name}
                          className="flex items-center justify-between py-1.5 px-3 rounded-radius hover:bg-surface-raised/40 transition-colors duration-120 group/file border border-transparent hover:border-border/30"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {getFileIcon(file.name)}
                            <span className="text-[12.5px] font-medium truncate font-mono text-fg" title={file.name}>
                              {file.name}
                            </span>
                          </div>

                          {/* File details and action icons */}
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-[10px] text-muted-2 font-mono hidden md:inline">
                              {formatBytes(file.metadata?.size)}
                            </span>
                            <span className="text-[10px] text-muted-2 font-mono hidden lg:inline">
                              {formatDate(file.updated_at)}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                className="p-1 rounded-radius hover:bg-surface-raised text-muted hover:text-accent transition-colors duration-120"
                                onClick={() => handleDownload(subFolder, file.name)}
                                title="Download file"
                                type="button"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                className="p-1 rounded-radius hover:bg-surface-raised text-muted hover:text-status-danger transition-colors duration-120"
                                onClick={() => handleDelete(subFolder, file.name)}
                                title="Delete file"
                                type="button"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
