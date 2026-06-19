import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { firestoreDB, storage } from "../../firebase";
import { ref, listAll, getBytes, StorageReference, getMetadata } from "firebase/storage";
import { doc, getDoc } from "firebase/firestore";

export interface CloudModelBtnState {
  components: OBC.Components;
}

// ── Revit Version Extractors ──────────────────────────────────────────────────
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
  
  // Regex fallback: try to find R26, R25, R24 etc. in the name
  const match = file.name.match(/_R(\d{2})/i);
  if (match) {
    const year = "20" + match[1];
    return year;
  }
  return "";
};

// ── Modal State & Template ──────────────────────────────────────────────────
interface ModalState {
  files: {
    ref: StorageReference;
    displayName: string;
    revitVersion: string;
    checked: boolean;
  }[];
  searchQuery: string;
  isAscending: boolean;
  isLoading: boolean;
  loadingStatuses: Map<string, "pending" | "loading" | "done" | "error">;
  fragments: OBC.FragmentsManager;
  onClose: () => void;
}

const modalTemplate: BUI.StatefullComponent<ModalState> = (state, update) => {
  const { files, searchQuery, isAscending, isLoading, loadingStatuses, fragments, onClose } = state;

  const onSearchInput = (e: Event) => {
    const input = e.target as any;
    state.searchQuery = input.value || "";
    update();
  };

  const onToggleSort = () => {
    state.isAscending = !state.isAscending;
    update();
  };

  const filteredAndSortedFiles = files
    .filter((f) => f.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const comp = a.displayName.localeCompare(b.displayName);
      return isAscending ? comp : -comp;
    });

  const onToggleFile = (index: number) => {
    const item = filteredAndSortedFiles[index];
    if (item) {
      item.checked = !item.checked;
      update();
    }
  };

  const onCheckAll = () => {
    for (const f of filteredAndSortedFiles) {
      f.checked = true;
    }
    update();
  };

  const onUncheckAll = () => {
    for (const f of filteredAndSortedFiles) {
      f.checked = false;
    }
    update();
  };

  const onToggleAll = () => {
    for (const f of filteredAndSortedFiles) {
      f.checked = !f.checked;
    }
    update();
  };

  const onSelect = async () => {
    const selected = files.filter((f) => f.checked);
    if (selected.length === 0) return;

    state.isLoading = true;
    state.loadingStatuses = new Map(selected.map((f) => [f.ref.fullPath, "pending"]));
    update();

    // Yield control to browser layout & paint thread to immediately show the spinner popup
    await new Promise((resolve) => setTimeout(resolve, 50));

    const MAX_PARALLEL = 5;
    for (let i = 0; i < selected.length; i += MAX_PARALLEL) {
      const batch = selected.slice(i, i + MAX_PARALLEL);
      await Promise.all(
        batch.map(async (item) => {
          state.loadingStatuses.set(item.ref.fullPath, "loading");
          update();
          try {
            const buffer = await getBytes(item.ref);
            const modelId = item.ref.name.replace(/\.frag$/i, "");
            const model = await fragments.core.load(new Uint8Array(buffer), { modelId });
            if (model) {
              (model as any).name = item.ref.name;
            }
            state.loadingStatuses.set(item.ref.fullPath, "done");
          } catch (err) {
            console.error(`[CloudModel] Failed to load "${item.ref.name}":`, err);
            state.loadingStatuses.set(item.ref.fullPath, "error");
          }
          update();
        })
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
    onClose();
  };

  const checkboxStyle = `
    accent-color: var(--accent);
    cursor: pointer;
    width: 14px;
    height: 14px;
    transition: transform 0.15s ease;
    flex-shrink: 0;
  `;

  const selectedCount = files.filter((f) => f.checked).length;
  const doneCount = [...loadingStatuses.values()].filter(
    (s) => s === "done" || s === "error"
  ).length;

  return BUI.html`
    <div class="cloud-model-modal-backdrop" @click=${isLoading ? null : onClose}>
      <style>
        .cloud-model-modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.2s ease-out;
        }
        .cloud-model-modal-content {
          width: 480px;
          max-width: 90vw;
          height: 580px;
          max-height: 85vh;
          background-color: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-1);
          overflow: hidden;
          animation: scaleUp 0.2s ease-out;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .cloud-model-header {
          padding: 10px 16px;
          background-color: var(--surface-raised);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .cloud-model-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--fg);
        }
        .cloud-model-close-btn {
          background: transparent;
          border: none;
          color: var(--muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          padding: 4px;
          border-radius: var(--radius);
          transition: background-color 0.15s, color 0.15s;
        }
        .cloud-model-close-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
          color: var(--fg);
        }
        .cloud-model-filter-bar {
          padding: 12px 16px;
          display: flex;
          gap: 8px;
          align-items: center;
          background-color: var(--surface);
          border-bottom: 1px solid var(--border);
        }
        .cloud-model-sort-btn {
          background-color: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--fg);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          transition: background-color 0.15s, border-color 0.15s;
        }
        .cloud-model-sort-btn:hover {
          background-color: rgba(255, 255, 255, 0.05);
          border-color: var(--accent);
        }
        .cloud-model-search-input {
          flex: 1;
        }
        .cloud-model-file-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          background-color: var(--surface);
        }
        .cloud-model-file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 8px;
          border-radius: var(--radius);
          transition: background-color 0.15s;
        }
        .cloud-model-file-item:hover {
          background-color: rgba(255, 255, 255, 0.04);
        }
        .cloud-model-file-label {
          font-size: 0.85rem;
          color: var(--fg);
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .cloud-model-file-detail {
          font-size: 0.75rem;
          color: var(--muted);
          margin-left: 8px;
        }
        .cloud-model-actions {
          padding: 12px 16px;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          background-color: var(--surface-raised);
          border-top: 1px solid var(--border);
        }
        .cloud-model-action-btn {
          flex: 1;
          background-color: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--fg);
          padding: 8px 12px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.15s, border-color 0.15s;
        }
        .cloud-model-action-btn:hover {
          background-color: rgba(255, 255, 255, 0.05);
          border-color: var(--accent);
        }
        .cloud-model-submit-bar {
          padding: 12px 16px;
          background-color: var(--surface-raised);
          border-top: 1px solid var(--border);
        }
        .cloud-model-submit-btn {
          width: 100%;
          background-color: var(--accent);
          border: none;
          border-radius: var(--radius);
          color: #ffffff;
          padding: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: filter 0.15s;
        }
        .cloud-model-submit-btn:hover {
          filter: brightness(1.1);
        }
        .cloud-model-submit-btn:disabled {
          background-color: var(--muted);
          cursor: not-allowed;
          filter: none;
          opacity: 0.5;
        }
        .cloud-model-loading-box {
          background-color: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: var(--fg);
          box-shadow: var(--shadow-1);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
      
      ${isLoading
        ? BUI.html`
            <div class="cloud-model-loading-box" @click=${(e: Event) => e.stopPropagation()}>
              <div style="font-size: 1.5rem; animation: spin 1s linear infinite; display: inline-block;">⟳</div>
              <div style="font-size: 0.9rem; font-weight: 500;">Loading models (${doneCount} / ${selectedCount})…</div>
            </div>
          `
        : BUI.html`
            <div class="cloud-model-modal-content" @click=${(e: Event) => e.stopPropagation()}>
              <!-- Title Bar -->
              <div class="cloud-model-header">
                <div class="cloud-model-title">
                  <bim-icon name=${appIcons.LIST} style="--bim-icon--c: var(--accent);"></bim-icon>
                  <span>User Input</span>
                </div>
                <button class="cloud-model-close-btn" aria-label="Close" @click=${onClose}>
                  <iconify-icon icon=${appIcons.CLOSE}></iconify-icon>
                </button>
              </div>

              <!-- Filter Bar -->
              <div class="cloud-model-filter-bar">
                <button class="cloud-model-sort-btn" title="Sort A-Z" @click=${onToggleSort}>
                  <iconify-icon icon="mdi:sort-alphabetical-variant" style="font-size: 18px; color: ${isAscending ? "var(--accent)" : "var(--fg)"};"></iconify-icon>
                </button>
                <bim-text-input
                  class="cloud-model-search-input"
                  placeholder="Search..."
                  @input=${onSearchInput}
                ></bim-text-input>
              </div>

              <!-- Scrollable List -->
              <div class="cloud-model-file-list">
                ${filteredAndSortedFiles.length === 0
                  ? BUI.html`<span style="color:var(--muted); font-size:0.85rem; text-align:center; padding:16px;">No matching files</span>`
                  : filteredAndSortedFiles.map((fileItem, idx) => {
                      return BUI.html`
                        <div class="cloud-model-file-item">
                          <input
                            type="checkbox"
                            style=${checkboxStyle}
                            ?checked=${fileItem.checked}
                            @change=${() => onToggleFile(idx)}
                          />
                          <span class="cloud-model-file-label" @click=${() => onToggleFile(idx)}>
                            ${fileItem.displayName}
                            ${fileItem.revitVersion ? BUI.html`<span class="cloud-model-file-detail">[ Revit: ${fileItem.revitVersion} ]</span>` : ""}
                          </span>
                        </div>
                      `;
                    })
                }
              </div>

              <!-- Actions Bar -->
              <div class="cloud-model-actions">
                <button class="cloud-model-action-btn" @click=${onCheckAll}>Check All</button>
                <button class="cloud-model-action-btn" @click=${onUncheckAll}>Uncheck All</button>
                <button class="cloud-model-action-btn" @click=${onToggleAll}>Toggle All</button>
              </div>

              <!-- Submit Bar -->
              <div class="cloud-model-submit-bar">
                <button class="cloud-model-submit-btn" ?disabled=${selectedCount === 0} @click=${onSelect}>
                  Select
                </button>
              </div>
            </div>
          `
      }
    </div>
  `;
};

export const cloudModelSelectionOverlay = (
  filesWithMeta: { ref: StorageReference; revitVersion: string }[],
  fragments: OBC.FragmentsManager,
  onClose: () => void
) => {
  const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") cleanup(); };
  const cleanup = () => {
    window.removeEventListener("keydown", handleEsc);
    onClose();
  };

  const initialFiles = filesWithMeta.map((item) => ({
    ref: item.ref,
    displayName: item.ref.name.replace(/\.frag$/i, ""),
    revitVersion: item.revitVersion,
    checked: false,
  }));

  const [element, updateComponent] = BUI.Component.create<HTMLDivElement, ModalState>(
    modalTemplate,
    {
      files: initialFiles,
      searchQuery: "",
      isAscending: true,
      isLoading: false,
      loadingStatuses: new Map(),
      fragments,
      onClose: cleanup,
    }
  );

  window.addEventListener("keydown", handleEsc);
  return element;
};

// ── Main Component Template ─────────────────────────────────────────────────
export const cloudModelBtnTemplate: BUI.StatefullComponent<CloudModelBtnState> =
  (state) => {
    const { components } = state;
    const fragments = components.get(OBC.FragmentsManager);

    // Helper: Recursive list of .frag files
    const getFragFilesRecursively = async (folderRef: StorageReference): Promise<StorageReference[]> => {
      let fragFiles: StorageReference[] = [];
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

    const onCloudBtnClick = async (e: Event) => {
      // Show loading spinner overlay
      const loadingOverlay = document.createElement("div");
      loadingOverlay.className = "cloud-model-modal-backdrop";
      loadingOverlay.innerHTML = `
        <style>
          .cloud-model-modal-backdrop {
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.2s ease-out;
          }
          .cloud-model-loading-box {
            background-color: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            color: var(--fg);
            box-shadow: var(--shadow-1);
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
        <div class="cloud-model-loading-box">
          <div style="font-size: 1.5rem; animation: spin 1s linear infinite; display: inline-block;">⟳</div>
          <div style="font-size: 0.9rem; font-weight: 500;">Fetching file list and metadata…</div>
        </div>
      `;
      document.body.appendChild(loadingOverlay);

      try {
        const urlParts = window.location.pathname.split("/");
        const projectsIdx = urlParts.indexOf("projects");
        const projectId = projectsIdx !== -1 && urlParts[projectsIdx + 1] ? urlParts[projectsIdx + 1] : "";

        if (!projectId) {
          loadingOverlay.innerHTML = `<div class="cloud-model-loading-box">Error: No project selected</div>`;
          setTimeout(() => loadingOverlay.remove(), 2000);
          return;
        }

        const projectDoc = await getDoc(doc(firestoreDB, "projects", projectId));
        if (!projectDoc.exists()) {
          loadingOverlay.innerHTML = `<div class="cloud-model-loading-box">Error: Project not found</div>`;
          setTimeout(() => loadingOverlay.remove(), 2000);
          return;
        }

        const data = projectDoc.data();
        let targetPath = (data.bimFiles?.fragFolderPath || "").trim().replace(/^\/+|\/+$/g, "");
        if (!targetPath) {
          const projectNumber = data.projectnumber || 0;
          const projectName = data.projectName || "Unknown";
          targetPath = `${projectNumber}_${projectName}/02_frag`;
        }
        
        const folderRef = ref(storage, targetPath);
        const files = await getFragFilesRecursively(folderRef);

        if (files.length === 0) {
          loadingOverlay.innerHTML = `<div class="cloud-model-loading-box">No frag files found</div>`;
          setTimeout(() => loadingOverlay.remove(), 2000);
          return;
        }

        // Fetch metadata in parallel
        const filesWithMeta = await Promise.all(
          files.map(async (file) => {
            try {
              const meta = await getMetadata(file);
              const revitVersion = getRevitVersion(file, meta);
              return { ref: file, revitVersion };
            } catch (err) {
              console.warn(`[CloudModel] Failed to fetch metadata for ${file.name}:`, err);
              const revitVersion = getRevitVersion(file, null);
              return { ref: file, revitVersion };
            }
          })
        );

        loadingOverlay.remove();
        
        const selectionModal = cloudModelSelectionOverlay(filesWithMeta, fragments, () => {
          selectionModal.remove();
        });
        document.body.appendChild(selectionModal);

      } catch (err) {
        console.error("[CloudModel] Failed to fetch file list:", err);
        loadingOverlay.innerHTML = `<div class="cloud-model-loading-box">Failed to fetch files</div>`;
        setTimeout(() => loadingOverlay.remove(), 2000);
      }
    };

    return BUI.html`
      <bim-button
        icon=${appIcons.CLOUD}
        tooltip-title="Cloud Model"
        tooltip-text="Load .frag models from Firebase Storage"
        @click=${onCloudBtnClick}
      ></bim-button>`;
  };
