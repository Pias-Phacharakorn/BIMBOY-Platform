import { useState, useRef, useEffect } from "react";
import * as OBC from "@thatopen/components";
import { useBimStore } from "../../store/bimStore";
import { Icon } from "../../components/Icon";
import { firestoreDB, storage } from "../../../firebase";
import {
  ref,
  listAll,
  getBytes,
  getMetadata,
  StorageReference,
} from "firebase/storage";
import { doc, getDoc } from "firebase/firestore";

interface StorageFile {
  ref: StorageReference;
  displayName: string;
  revitVersion: string;
  checked: boolean;
}

const getRevitVersionFromMetadata = (metadata: any): string => {
  if (!metadata || !metadata.customMetadata) return "";
  for (const key of Object.keys(metadata.customMetadata)) {
    if (key.toLowerCase().includes("revit")) {
      return metadata.customMetadata[key];
    }
  }
  return "";
};

const getRevitVersion = (file: StorageReference, metadata: any): string => {
  const metaVer = getRevitVersionFromMetadata(metadata);
  if (metaVer) return metaVer;

  const match = file.name.match(/_R(\d{2})/i);
  if (match) {
    return "20" + match[1];
  }
  return "";
};

export function CloudModelButton() {
  const components = useBimStore((state) => state.components);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });

  const [files, setFiles] = useState<StorageFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAscending, setIsAscending] = useState(true);

  // Helper: Recursive list of .frag files
  const getFragFilesRecursively = async (
    folderRef: StorageReference
  ): Promise<StorageReference[]> => {
    const fragFiles: StorageReference[] = [];
    const res = await listAll(folderRef);

    for (const item of res.items) {
      if (item.name.toLowerCase().endsWith(".frag")) {
        fragFiles.push(item);
      }
    }

    for (const prefix of res.prefixes) {
      const subFiles = await getFragFilesRecursively(prefix);
      fragFiles.push(...subFiles);
    }

    return fragFiles;
  };

  const handleOpen = async () => {
    if (!components) return;
    setIsOpen(true);
    setIsLoading(true);
    setStatusMessage("Fetching file list and metadata…");

    try {
      const urlParts = window.location.pathname.split("/");
      const projectsIdx = urlParts.indexOf("projects");
      const projectId =
        projectsIdx !== -1 && urlParts[projectsIdx + 1]
          ? urlParts[projectsIdx + 1]
          : "";

      if (!projectId) {
        setStatusMessage("Error: No project selected");
        setIsLoading(false);
        return;
      }

      const projectDoc = await getDoc(doc(firestoreDB, "projects", projectId));
      if (!projectDoc.exists()) {
        setStatusMessage("Error: Project not found");
        setIsLoading(false);
        return;
      }

      const data = projectDoc.data();
      let targetPath = (data.bimFiles?.fragFolderPath || "")
        .trim()
        .replace(/^\/+|\/+$/g, "");
      if (!targetPath) {
        const projectNumber = data.projectnumber || 0;
        const projectName = data.projectName || "Unknown";
        targetPath = `${projectNumber}_${projectName}/02_frag`;
      }

      const folderRef = ref(storage, targetPath);
      const storageFiles = await getFragFilesRecursively(folderRef);

      if (storageFiles.length === 0) {
        setStatusMessage("No frag files found");
        setIsLoading(false);
        return;
      }

      // Fetch metadata in parallel
      const filesWithMeta = await Promise.all(
        storageFiles.map(async (file) => {
          try {
            const meta = await getMetadata(file);
            const revitVersion = getRevitVersion(file, meta);
            return {
              ref: file,
              displayName: file.name.replace(/\.frag$/i, ""),
              revitVersion,
              checked: false,
            };
          } catch (err) {
            console.warn(`Failed to fetch metadata for ${file.name}:`, err);
            const revitVersion = getRevitVersion(file, null);
            return {
              ref: file,
              displayName: file.name.replace(/\.frag$/i, ""),
              revitVersion,
              checked: false,
            };
          }
        })
      );

      setFiles(filesWithMeta);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to fetch file list:", err);
      setStatusMessage("Failed to fetch files");
      setIsLoading(false);
    }
  };

  const handleSelect = async () => {
    const selected = files.filter((f) => f.checked);
    if (selected.length === 0 || !components) return;

    setIsDownloading(true);
    setDownloadProgress({ done: 0, total: selected.length });
    const fragments = components.get(OBC.FragmentsManager);

    const MAX_PARALLEL = 5;
    for (let i = 0; i < selected.length; i += MAX_PARALLEL) {
      const batch = selected.slice(i, i + MAX_PARALLEL);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const buffer = await getBytes(item.ref);
            const modelId = item.ref.name.replace(/\.frag$/i, "");
            const model = await fragments.core.load(new Uint8Array(buffer), {
              modelId,
            });
            if (model) {
              (model as any).name = item.ref.name;
            }
          } catch (err) {
            console.error(`Failed to load "${item.ref.name}":`, err);
          } finally {
            setDownloadProgress((prev) => ({ ...prev, done: prev.done + 1 }));
          }
        })
      );
    }

    // Yield short delay and close
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsOpen(false);
    setIsDownloading(false);
    setFiles([]);
  };

  const handleClose = () => {
    if (isDownloading) return;
    setIsOpen(false);
    setFiles([]);
  };

  const filteredAndSortedFiles = files
    .filter((f) => f.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const comp = a.displayName.localeCompare(b.displayName);
      return isAscending ? comp : -comp;
    });

  const onToggleFile = (index: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f))
    );
  };

  const onCheckAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, checked: true })));
  };

  const onUncheckAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, checked: false })));
  };

  const onToggleAll = () => {
    setFiles((prev) => prev.map((f) => ({ ...f, checked: !f.checked })));
  };

  const selectedCount = files.filter((f) => f.checked).length;

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={!components}
        className="react-bui-button"
        title="Load cloud model"
        aria-label="Load cloud model"
        type="button"
      >
        <Icon name="CLOUD" size={16} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[1000] backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-[480px] max-w-[90vw] h-[580px] max-h-[85vh] bg-surface border border-border rounded-lg flex flex-direction flex-col shadow-2xl overflow-hidden animate-in scale-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-surface-raised border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-fg">
                <Icon name="LIST" style={{ color: "var(--accent)" }} />
                <span>Cloud Models</span>
              </div>
              <button
                onClick={handleClose}
                disabled={isDownloading}
                className="text-muted hover:text-fg p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Close"
                type="button"
              >
                <Icon name="CLOSE" size={18} />
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex flex-col justify-center items-center gap-3 p-6 text-fg">
                <div className="text-2xl animate-spin">⟳</div>
                <div className="text-xs font-semibold text-muted">
                  {statusMessage}
                </div>
              </div>
            ) : isDownloading ? (
              <div className="flex-1 flex flex-col justify-center items-center gap-4 p-6 text-fg">
                <div className="text-2xl animate-spin">⟳</div>
                <div className="text-sm font-semibold text-fg">
                  Loading models ({downloadProgress.done} / {downloadProgress.total})…
                </div>
                <div className="w-48 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{
                      width: `${
                        (downloadProgress.done / downloadProgress.total) * 100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="p-3 border-b border-border flex gap-2 items-center bg-surface">
                  <button
                    onClick={() => setIsAscending(!isAscending)}
                    className="flex items-center justify-center w-8 h-8 rounded border border-border bg-surface-raised hover:border-accent transition-all text-fg"
                    title="Toggle Sort A-Z"
                    type="button"
                  >
                    <Icon name="LIST" size={18} />
                  </button>
                  <input
                    type="text"
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-8 bg-[#1b1c21] border border-border-strong rounded px-3 text-xs text-fg focus:border-accent outline-none"
                  />
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 bg-surface">
                  {filteredAndSortedFiles.length === 0 ? (
                    <span className="text-muted text-xs text-center py-8">
                      No matching files found
                    </span>
                  ) : (
                    filteredAndSortedFiles.map((file, idx) => (
                      <div
                        key={file.ref.fullPath}
                        className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors cursor-pointer select-none"
                        onClick={() => onToggleFile(files.indexOf(file))}
                      >
                        <input
                          type="checkbox"
                          checked={file.checked}
                          onChange={() => {}} // Controlled via row click
                          className="accent-accent cursor-pointer w-4 h-4 rounded"
                        />
                        <span className="text-xs text-fg flex-1 truncate">
                          {file.displayName}
                          {file.revitVersion && (
                            <span className="text-[10px] text-muted ml-2">
                              [ Revit: {file.revitVersion} ]
                            </span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Actions */}
                <div className="p-3 border-t border-border flex gap-2 justify-between bg-surface-raised">
                  <button
                    onClick={onCheckAll}
                    className="flex-1 bg-surface border border-border rounded py-1.5 text-xs text-fg hover:border-accent transition-colors"
                    type="button"
                  >
                    Check All
                  </button>
                  <button
                    onClick={onUncheckAll}
                    className="flex-1 bg-surface border border-border rounded py-1.5 text-xs text-fg hover:border-accent transition-colors"
                    type="button"
                  >
                    Uncheck All
                  </button>
                  <button
                    onClick={onToggleAll}
                    className="flex-1 bg-surface border border-border rounded py-1.5 text-xs text-fg hover:border-accent transition-colors"
                    type="button"
                  >
                    Toggle All
                  </button>
                </div>

                {/* Submit */}
                <div className="p-3 border-t border-border bg-surface-raised">
                  <button
                    disabled={selectedCount === 0}
                    onClick={handleSelect}
                    className="w-full bg-accent disabled:bg-muted text-white rounded p-2 text-xs font-semibold hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    type="button"
                  >
                    Load Selected ({selectedCount})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
