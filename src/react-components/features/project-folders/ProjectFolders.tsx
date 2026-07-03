import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppProject } from "@/types";
import { cn } from "@/lib/utils";
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
  Plus,
  GitCompareArrows,
} from "lucide-react";
import { shopDrawingsService, type ShopDrawingRow } from "@/react-components/features/shop-drawings/shopDrawingsService";
import { useCreateShopDrawing, useAddShopDrawingRevision } from "@/react-components/features/shop-drawings/useShopDrawings";
import { mapShopDrawingRow } from "@/react-components/features/shop-drawings/shopDrawingTypes";
import { AddDrawingDialog, type NewDrawingInput } from "@/react-components/components/shop-drawings/AddDrawingDialog";
import { UploadPdfDialog, type UploadRevisionInput } from "@/react-components/components/shop-drawings/UploadPdfDialog";
import { PdfViewerModal } from "@/react-components/components/shop-drawings/PdfViewerModal";
import { CompareDrawingsModal } from "@/react-components/components/shop-drawings/CompareDrawingsModal";
import { useAuth } from "@/react-components/features/auth/useAuth";

interface ProjectFoldersProps {
  project: AppProject;
  focusFolder?: string;
  isAdmin?: boolean;
  large?: boolean;
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

const DRAWING_FOLDER = "04_Drawing";

export function ProjectFolders({ project, focusFolder, isAdmin = false, large = false }: ProjectFoldersProps) {
  const projectPath = `${project.projectnumber}_${project.projectName}`;
  const subFolders = ["01_ifc", "02_frag", "03_ClashImport", DRAWING_FOLDER];

  // States
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    [projectPath]: true, // Root is open by default
    "01_ifc": true,      // IFC open by default
  });
  const [files, setFiles] = useState<Record<string, StorageFile[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // 04_Drawing is a tree sourced from the shop_drawings table
  // (sheet -> revisions) instead of a flat Storage list — see plan.md.
  // Add/Upload here call the same service+mutations Register uses; delete
  // still lives only in Register.
  const { user } = useAuth();
  const createShopDrawing = useCreateShopDrawing();
  const addRevision = useAddShopDrawingRevision();
  const [shopDrawings, setShopDrawings] = useState<ShopDrawingRow[]>([]);
  const [shopDrawingsLoading, setShopDrawingsLoading] = useState(false);
  const [shopDrawingsError, setShopDrawingsError] = useState<string | null>(null);
  const [expandedSheets, setExpandedSheets] = useState<Record<string, boolean>>({});
  const [addDrawingOpen, setAddDrawingOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<ShopDrawingRow | null>(null);
  const [viewerTarget, setViewerTarget] = useState<ShopDrawingRow | null>(null);
  const [compareSheet, setCompareSheet] = useState<{ sheetNo: string; versions: ShopDrawingRow[] } | null>(null);

  const groupedShopDrawings = useMemo(() => {
    const groups = new Map<string, ShopDrawingRow[]>();
    shopDrawings.forEach((row) => {
      const existing = groups.get(row.sheet_no) ?? [];
      existing.push(row);
      groups.set(row.sheet_no, existing);
    });
    const result: { sheetNo: string; sheetName: string; versions: ShopDrawingRow[] }[] = [];
    groups.forEach((versions, sheetNo) => {
      versions.sort((a, b) => a.revision - b.revision);
      result.push({ sheetNo, sheetName: versions[versions.length - 1].sheet_name, versions });
    });
    result.sort((a, b) => a.sheetNo.localeCompare(b.sheetNo));
    return result;
  }, [shopDrawings]);

  const fetchShopDrawings = async () => {
    setShopDrawingsLoading(true);
    setShopDrawingsError(null);
    try {
      const rows = await shopDrawingsService.listShopDrawings(project.id);
      setShopDrawings(rows);
    } catch (err: any) {
      console.error("Error loading shop drawings:", err);
      setShopDrawingsError(err.message || "Failed to load shop drawings");
    } finally {
      setShopDrawingsLoading(false);
    }
  };

  const toggleSheet = (sheetNo: string) => {
    setExpandedSheets((prev) => ({ ...prev, [sheetNo]: !prev[sheetNo] }));
  };

  const handleDownloadShopDrawing = (row: ShopDrawingRow) => {
    const url = shopDrawingsService.getPdfPublicUrl(row.pdf_path);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.sheet_no}-${row.sheet_name}-Rev${row.revision}.pdf`;
    a.target = "_blank";
    a.click();
  };

  const describeShopDrawingError = (error: unknown, fallback: string) => {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      return "Someone just uploaded a newer revision — refresh and try again.";
    }
    return error instanceof Error ? error.message : fallback;
  };

  const handleAddDrawing = (input: NewDrawingInput) => {
    createShopDrawing.mutate(
      {
        project,
        sheetNo: input.no,
        sheetName: input.name,
        author: input.author || null,
        pdfFile: input.pdfFile,
        createdBy: user?.id ?? null,
      },
      {
        onSuccess: () => fetchShopDrawings(),
        onError: (error) => alert(describeShopDrawingError(error, "Failed to add drawing.")),
      }
    );
  };

  const handleUploadRevision = (input: UploadRevisionInput) => {
    if (!uploadTarget || !input.pdfFile) return;
    addRevision.mutate(
      {
        project,
        sheetNo: uploadTarget.sheet_no,
        sheetName: uploadTarget.sheet_name,
        author: uploadTarget.author,
        revision: input.revision,
        pdfFile: input.pdfFile,
        createdBy: user?.id ?? null,
      },
      {
        onSuccess: () => fetchShopDrawings(),
        onError: (error) => alert(describeShopDrawingError(error, "Failed to upload revision.")),
      }
    );
  };

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
    const iconSize = large ? "w-8 h-8" : "w-4 h-4";
    if (ext === "ifc") {
      return <FileBox className={cn(iconSize, "text-[oklch(74%_0.13_195)] shrink-0")} />;
    }
    if (ext === "frag") {
      return <FileCode className={cn(iconSize, "text-accent shrink-0")} />;
    }
    return <FileText className={cn(iconSize, "text-muted shrink-0")} />;
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
      if (nextState && folderName === DRAWING_FOLDER && shopDrawings.length === 0) {
        fetchShopDrawings();
      } else if (nextState && subFolders.includes(folderName) && !files[folderName]) {
        fetchFolderFiles(folderName);
      }
      return { ...prev, [folderName]: nextState };
    });
  };

  // Initial load
  useEffect(() => {
    if (project.id) {
      const foldersToLoad = focusFolder ? [focusFolder] : subFolders;
      foldersToLoad.forEach((folder) => {
        if (folder === DRAWING_FOLDER) {
          fetchShopDrawings();
        } else {
          fetchFolderFiles(folder);
        }
      });
      if (focusFolder) {
        setExpandedFolders((prev) => ({ ...prev, [focusFolder]: true }));
      }
    }
  }, [project.id, focusFolder]);

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

  const sz = {
    icon3: large ? "w-7 h-7" : "w-3.5 h-3.5",
    icon4: large ? "w-8 h-8" : "w-4 h-4",
    icon5: large ? "w-10 h-10" : "w-5 h-5",
    rowPad: large ? "py-3 px-6" : "py-1.5 px-3",
    rootRowPad: large ? "py-4 px-6" : "py-2 px-3",
    gap2: large ? "gap-4" : "gap-2",
    gap1_5: large ? "gap-3" : "gap-1.5",
    gap3: large ? "gap-6" : "gap-3",
    gap4: large ? "gap-8" : "gap-4",
    text13: large ? "text-[26px]" : "text-[13px]",
    text12_5: large ? "text-[25px]" : "text-[12.5px]",
    text10: large ? "text-[20px]" : "text-[10px]",
    textXs: large ? "text-2xl" : "text-xs",
    textSm: large ? "text-xl" : "text-sm",
    badgePad: large ? "px-3 py-1" : "px-1.5 py-0.5",
    btnPad: large ? "p-2" : "p-1",
    indent: large ? "pl-12 ml-8" : "pl-6 ml-4",
    rootIndent: large ? "pl-12 ml-10" : "pl-6 ml-5",
    cardPad: large ? "p-12" : "p-6",
  };

  return (
    <div className="flex flex-col gap-4 w-full text-fg">
      {/* Settings section header */}
      {!focusFolder && (
        <div className="flex flex-col gap-1 pb-4 border-b border-border">
          <h3 className="text-base font-bold text-fg">Project Files Directory</h3>
          <p className="text-xs text-muted">
            Manage model geometry files and clash reports directly inside the project's cloud storage.
          </p>
        </div>
      )}

      {/* Directory Tree Card */}
      <div className={cn("border border-border bg-[oklch(14.5%_0.014_255_/_94%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-radius overflow-hidden flex flex-col", sz.cardPad, sz.gap2)}>
        {/* Root Directory Row */}
        {!focusFolder && (
          <div
            className={cn("flex items-center rounded-radius hover:bg-surface-alt transition-colors duration-120 cursor-pointer select-none font-semibold", sz.gap2, sz.rootRowPad, sz.textSm)}
            onClick={() => toggleFolder(projectPath)}
          >
            {expandedFolders[projectPath] ? (
              <ChevronDown className={cn(sz.icon4, "text-muted shrink-0")} />
            ) : (
              <ChevronRight className={cn(sz.icon4, "text-muted shrink-0")} />
            )}
            {expandedFolders[projectPath] ? (
              <FolderOpen className={cn(sz.icon5, "text-accent shrink-0")} />
            ) : (
              <Folder className={cn(sz.icon5, "text-accent shrink-0")} />
            )}
            <span className={cn("font-mono", sz.text13)}>{projectPath}</span>
          </div>
        )}

        {/* Subdirectories */}
        {(focusFolder || expandedFolders[projectPath]) && (
          <div className={cn(
            "flex flex-col mt-1",
            sz.gap3,
            !focusFolder && cn("border-l border-border/60", sz.rootIndent)
          )}>
            {(focusFolder ? [focusFolder] : subFolders).map((subFolder) => {
              const isDrawingFolder = subFolder === DRAWING_FOLDER;
              const isExpanded = expandedFolders[subFolder];
              const folderFiles = files[subFolder] || [];
              const isLoading = isDrawingFolder ? shopDrawingsLoading : loading[subFolder];
              const isUploading = uploading[subFolder];
              const error = isDrawingFolder ? shopDrawingsError : errors[subFolder];
              const itemCount = isDrawingFolder ? groupedShopDrawings.length : folderFiles.length;

              return (
                <div key={subFolder} className="flex flex-col gap-1">
                  {/* Folder Row */}
                  <div className={cn("flex items-center justify-between rounded-radius hover:bg-surface-alt/70 transition-colors duration-120 group", sz.rowPad)}>
                    <div
                      className={cn("flex items-center cursor-pointer select-none font-medium flex-1", sz.gap2, sz.text13)}
                      onClick={() => toggleFolder(subFolder)}
                    >
                      {isExpanded ? (
                        <ChevronDown className={cn(sz.icon3, "text-muted shrink-0")} />
                      ) : (
                        <ChevronRight className={cn(sz.icon3, "text-muted shrink-0")} />
                      )}
                      {isExpanded ? (
                        <FolderOpen className={cn(sz.icon4, "text-accent-2 shrink-0")} />
                      ) : (
                        <Folder className={cn(sz.icon4, "text-accent-2 shrink-0")} />
                      )}
                      <span className="font-mono">{subFolder}</span>
                      <span className={cn("bg-surface-raised rounded-full text-muted border border-border", sz.text10, sz.badgePad)}>
                        {isLoading ? "..." : itemCount}
                      </span>
                    </div>

                    {/* Actions (always visible on hover or mobile) */}
                    <div className={cn("flex items-center", sz.gap2)}>
                      <button
                        className={cn("rounded-radius hover:bg-surface-raised text-muted hover:text-fg transition-colors duration-120 shrink-0", sz.btnPad)}
                        onClick={() => (isDrawingFolder ? fetchShopDrawings() : fetchFolderFiles(subFolder))}
                        disabled={isLoading}
                        title="Refresh"
                        type="button"
                      >
                        <RefreshCw className={cn(sz.icon3, isLoading ? "animate-spin text-accent" : "")} />
                      </button>

                      {isDrawingFolder && isAdmin && (
                        <button
                          className={cn("rounded-radius hover:bg-surface-raised text-muted hover:text-accent transition-colors duration-120 shrink-0", sz.btnPad)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddDrawingOpen(true);
                          }}
                          title="Add new drawing"
                          type="button"
                        >
                          <Plus className={sz.icon3} />
                        </button>
                      )}

                      {!isDrawingFolder && (
                        <label className={cn("rounded-radius hover:bg-surface-raised text-muted hover:text-fg transition-colors duration-120 shrink-0 cursor-pointer", sz.btnPad)}>
                          {isUploading ? (
                            <Loader2 className={cn(sz.icon3, "animate-spin text-accent")} />
                          ) : (
                            <Upload className={sz.icon3} />
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
                      )}
                    </div>
                  </div>

                  {/* Files List in Subfolder */}
                  {isExpanded && isDrawingFolder && (
                    <div className={cn("border-l border-border/40 flex flex-col mt-1", sz.indent, sz.gap1_5)}>
                      {isLoading && groupedShopDrawings.length === 0 && (
                        <div className={cn("flex items-center py-2 text-muted", sz.gap2, sz.textXs)}>
                          <Loader2 className={cn(sz.icon3, "animate-spin text-accent")} />
                          <span>Loading shop drawings...</span>
                        </div>
                      )}

                      {error && (
                        <div className={cn("text-status-danger py-1 px-2 border border-status-danger/20 bg-status-danger/10 rounded-radius", sz.textXs)}>
                          {error}
                        </div>
                      )}

                      {!isLoading && !error && groupedShopDrawings.length === 0 && (
                        <div className={cn("text-muted-2 py-2 px-3 italic", sz.textXs)}>
                          No shop drawings yet — add one from the Register tab.
                        </div>
                      )}

                      {groupedShopDrawings.map((sheet) => {
                        const sheetLabel = `${sheet.sheetNo}_${sheet.sheetName}`;
                        const isSheetExpanded = expandedSheets[sheet.sheetNo];

                        const latestInSheet = sheet.versions[sheet.versions.length - 1];

                        return (
                          <div key={sheet.sheetNo} className="flex flex-col gap-1">
                            <div className={cn("flex items-center justify-between rounded-radius hover:bg-surface-alt/70 transition-colors duration-120 group", sz.rowPad)}>
                              <div
                                className={cn("flex items-center cursor-pointer select-none font-medium flex-1 min-w-0", sz.gap2, sz.text13)}
                                onClick={() => toggleSheet(sheet.sheetNo)}
                              >
                                {isSheetExpanded ? (
                                  <ChevronDown className={cn(sz.icon3, "text-muted shrink-0")} />
                                ) : (
                                  <ChevronRight className={cn(sz.icon3, "text-muted shrink-0")} />
                                )}
                                {isSheetExpanded ? (
                                  <FolderOpen className={cn(sz.icon4, "text-accent-2 shrink-0")} />
                                ) : (
                                  <Folder className={cn(sz.icon4, "text-accent-2 shrink-0")} />
                                )}
                                <span className="font-mono truncate">{sheetLabel}</span>
                                <span className={cn("bg-surface-raised rounded-full text-muted border border-border shrink-0", sz.text10, sz.badgePad)}>
                                  {sheet.versions.length}
                                </span>
                              </div>

                              <button
                                className={cn(
                                  "rounded-radius transition-colors duration-120 shrink-0",
                                  sz.btnPad,
                                  sheet.versions.length >= 2
                                    ? "hover:bg-surface-raised text-muted hover:text-accent cursor-pointer"
                                    : "text-muted/40 cursor-not-allowed"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (sheet.versions.length >= 2) setCompareSheet(sheet);
                                }}
                                disabled={sheet.versions.length < 2}
                                title={sheet.versions.length >= 2 ? "Compare revisions" : "Need at least 2 revisions to compare"}
                                type="button"
                              >
                                <GitCompareArrows className={sz.icon3} />
                              </button>

                              {isAdmin && (
                                <button
                                  className={cn("rounded-radius hover:bg-surface-raised text-muted hover:text-accent transition-colors duration-120 shrink-0", sz.btnPad)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUploadTarget(latestInSheet);
                                  }}
                                  title="Upload PDF / Add Revision"
                                  type="button"
                                >
                                  <Upload className={sz.icon3} />
                                </button>
                              )}
                            </div>

                            {isSheetExpanded && (
                              <div className={cn("border-l border-border/40 flex flex-col mt-1", sz.indent, sz.gap1_5)}>
                                {sheet.versions.map((row) => {
                                  const fileLabel = `${row.sheet_no}-${row.sheet_name}-Rev${row.revision}`;
                                  return (
                                    <div
                                      key={row.id}
                                      className={cn("flex items-center justify-between rounded-radius hover:bg-surface-raised/40 transition-colors duration-120 group/file border border-transparent hover:border-border/30", sz.rowPad)}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setViewerTarget(row)}
                                        className={cn("flex items-center min-w-0 flex-1 text-left cursor-pointer hover:text-accent transition-colors duration-120", sz.gap2)}
                                        title={`View ${fileLabel}`}
                                      >
                                        <FileText className={cn(sz.icon4, "text-muted shrink-0")} />
                                        <span className={cn("font-medium truncate font-mono", sz.text12_5)}>
                                          {fileLabel}
                                        </span>
                                      </button>

                                      <div className={cn("flex items-center shrink-0", sz.gap4)}>
                                        <span className={cn("text-muted-2 font-mono hidden lg:inline", sz.text10)}>
                                          {formatDate(row.uploaded_at)}
                                        </span>

                                        <button
                                          className={cn("rounded-radius hover:bg-surface-raised text-muted hover:text-accent transition-colors duration-120", sz.btnPad)}
                                          onClick={() => handleDownloadShopDrawing(row)}
                                          title="Download file"
                                          type="button"
                                        >
                                          <Download className={sz.icon3} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isExpanded && !isDrawingFolder && (
                    <div className={cn("border-l border-border/40 flex flex-col mt-1", sz.indent, sz.gap1_5)}>
                      {isLoading && folderFiles.length === 0 && (
                        <div className={cn("flex items-center py-2 text-muted", sz.gap2, sz.textXs)}>
                          <Loader2 className={cn(sz.icon3, "animate-spin text-accent")} />
                          <span>Loading files...</span>
                        </div>
                      )}

                      {error && (
                        <div className={cn("text-status-danger py-1 px-2 border border-status-danger/20 bg-status-danger/10 rounded-radius", sz.textXs)}>
                          {error}
                        </div>
                      )}

                      {!isLoading && !error && folderFiles.length === 0 && (
                        <div className={cn("text-muted-2 py-2 px-3 italic", sz.textXs)}>
                          Empty folder
                        </div>
                      )}

                      {folderFiles.map((file) => (
                        <div
                          key={file.name}
                          className={cn("flex items-center justify-between rounded-radius hover:bg-surface-raised/40 transition-colors duration-120 group/file border border-transparent hover:border-border/30", sz.rowPad)}
                        >
                          <div className={cn("flex items-center min-w-0 flex-1", sz.gap2)}>
                            {getFileIcon(file.name)}
                            <span className={cn("font-medium truncate font-mono text-fg", sz.text12_5)} title={file.name}>
                              {file.name}
                            </span>
                          </div>

                          {/* File details and action icons */}
                          <div className={cn("flex items-center shrink-0", sz.gap4)}>
                            <span className={cn("text-muted-2 font-mono hidden md:inline", sz.text10)}>
                              {formatBytes(file.metadata?.size)}
                            </span>
                            <span className={cn("text-muted-2 font-mono hidden lg:inline", sz.text10)}>
                              {formatDate(file.updated_at)}
                            </span>

                            <div className={cn("flex items-center", sz.gap1_5)}>
                              <button
                                className={cn("rounded-radius hover:bg-surface-raised text-muted hover:text-accent transition-colors duration-120", sz.btnPad)}
                                onClick={() => handleDownload(subFolder, file.name)}
                                title="Download file"
                                type="button"
                              >
                                <Download className={sz.icon3} />
                              </button>
                              <button
                                className={cn("rounded-radius hover:bg-surface-raised text-muted hover:text-status-danger transition-colors duration-120", sz.btnPad)}
                                onClick={() => handleDelete(subFolder, file.name)}
                                title="Delete file"
                                type="button"
                              >
                                <Trash2 className={sz.icon3} />
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

      <AddDrawingDialog isOpen={addDrawingOpen} onClose={() => setAddDrawingOpen(false)} onAdd={handleAddDrawing} />

      <UploadPdfDialog
        isOpen={!!uploadTarget}
        onClose={() => setUploadTarget(null)}
        drawing={uploadTarget ? mapShopDrawingRow(uploadTarget) : null}
        onUpload={handleUploadRevision}
      />

      <PdfViewerModal
        isOpen={!!viewerTarget}
        onClose={() => setViewerTarget(null)}
        title={viewerTarget ? `${viewerTarget.sheet_no} - ${viewerTarget.sheet_name} (Rev ${viewerTarget.revision})` : ""}
        pdfUrl={viewerTarget ? shopDrawingsService.getPdfPublicUrl(viewerTarget.pdf_path) : null}
      />

      {compareSheet && (
        <CompareDrawingsModal
          isOpen={!!compareSheet}
          onClose={() => setCompareSheet(null)}
          drawingNo={compareSheet.sheetNo}
          versions={compareSheet.versions.map(mapShopDrawingRow)}
        />
      )}
    </div>
  );
}
