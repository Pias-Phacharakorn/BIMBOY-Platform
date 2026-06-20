// @ts-nocheck
import * as BUI from "@thatopen/ui";
import { ClashTableState } from "./types";
import { ClashImport, ClashData } from "../../../../bim-components";
import { clashDetailOverlay } from "./overlay";
import { firestoreDB } from "../../../../firebase";
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatusClass = (s: string): string => {
  const v = s.toLowerCase().replace(".", "").trim();
  if (v === "new" || v.includes("active"))                   return "cr-status-new";
  if (v === "unresolved")                                     return "cr-status-unres";
  if (v.includes("resolved") || v.includes("approved"))      return "cr-status-res";
  return "";
};

const getTypeClass = (t: string): string => {
  const v = t.toLowerCase().replace(".", "").trim();
  if (v === "major") return "cr-type-major";
  if (v === "minor") return "cr-type-minor";
  return "";
};

// ─── Template ─────────────────────────────────────────────────────────────────

export const clashTableTemplate: BUI.StatefullComponent<ClashTableState> = (
  state,
  update,
) => {
  const { components } = state;
  const clashReport = components.get(ClashImport);

  // Per-component mutable flag — persists across re-renders because `state`
  // is the same object reference each time BUI calls this function.
  const s = state as ClashTableState & {
    _initialized?: boolean;
    selectedGuids?: Set<string>;
    editingGuids?: Set<string>;
    headerControls?: HTMLDivElement;
    updateHeaderControls?: () => void;
  };
  if (s.selectedGuids === undefined) s.selectedGuids = new Set<string>();
  if (s.editingGuids === undefined) s.editingGuids = new Set<string>();

  if (!s.headerControls) {
    const [headerControls, updHeaderControls] = BUI.Component.create<HTMLDivElement, any>((_state: any) => {
      const isEditingActive = s.editingGuids!.size > 0;
      return BUI.html`
        <div
          @click=${(e: Event) => e.stopPropagation()}
          @mousedown=${(e: Event) => e.stopPropagation()}
          style="display: flex; gap: 0.5rem; align-items: center; margin-left: auto; margin-right: 1rem;"
        >
          ${isEditingActive ? BUI.html`
            <bim-button
              @click=${() => {
                s.editingGuids!.clear();
                s.selectedGuids!.clear();
                update();
                s.updateHeaderControls?.();
              }}
              icon="material-symbols:check"
              label=${`Done (${s.editingGuids!.size})`}
              style="--bim-button--fz: 12px; height: 28px;"
            ></bim-button>
          ` : BUI.html`
            <bim-button
              @click=${exportSelectedToPDF}
              icon="material-symbols:picture-as-pdf"
              label=${`Export PDF (${s.selectedGuids!.size})`}
              ?disabled=${s.selectedGuids!.size === 0}
              style="--bim-button--fz: 12px; height: 28px; background-color: var(--bim-ui_bg-base); border: 1px solid var(--border);"
            ></bim-button>
            <bim-button
              @click=${deleteSelected}
              icon="material-symbols:delete"
              label=${`Delete (${s.selectedGuids!.size})`}
              ?disabled=${s.selectedGuids!.size === 0}
              style="--bim-button--fz: 12px; height: 28px; background-color: #f87171; --bim-button--c: #fff;"
            ></bim-button>
            <bim-button
              @click=${() => {
                s.editingGuids = new Set(s.selectedGuids);
                update();
                s.updateHeaderControls?.();
              }}
              icon="material-symbols:edit"
              label=${`Edit (${s.selectedGuids!.size})`}
              ?disabled=${s.selectedGuids!.size === 0}
              style="--bim-button--fz: 12px; height: 28px;"
            ></bim-button>
          `}
        </div>
      `;
    }, {});
    s.headerControls = headerControls;
    s.updateHeaderControls = updHeaderControls;
  }

  function exportSelectedToPDF() {
    const selectedClashes = clashReport.list.filter(c => s.selectedGuids.has(c.guid || String(c.id)));
    if (selectedClashes.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export PDF");
      return;
    }

    const clashesHtml = selectedClashes.map(c => `
      <div class="clash-item">
        <div class="clash-header">
          <span class="clash-id">#${c.id}</span>
          <span class="clash-name">${c.name}</span>
        </div>
        <div class="clash-details">
          <div class="detail-row"><strong>Type:</strong> ${c.type}</div>
          <div class="detail-row"><strong>Status:</strong> ${c.status}</div>
          <div class="detail-row"><strong>Date:</strong> ${c.date}</div>
          <div class="detail-row"><strong>Markup:</strong> ${c.markup || "N/A"}</div>
          <div class="detail-row"><strong>Solution:</strong> ${c.solution || "No solution"}</div>
        </div>
        ${c.image ? `<img class="clash-image" src="${c.image}" alt="Clash Image" />` : ""}
      </div>
    `).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Clash Detection Report</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          h1 {
            font-size: 24px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 30px;
          }
          .clash-item {
            page-break-inside: avoid;
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
          }
          .clash-header {
            display: flex;
            justify-content: space-between;
            font-size: 18px;
            font-weight: bold;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .clash-id {
            color: #ca8134;
          }
          .clash-details {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 15px;
          }
          .detail-row {
            font-size: 14px;
          }
          .clash-image {
            max-width: 100%;
            max-height: 300px;
            object-fit: contain;
            border: 1px solid #ddd;
            border-radius: 4px;
            display: block;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <h1>Clash Detection Report - PIAS BIM Web App</h1>
        <p style="font-size: 14px; color: #666; margin-bottom: 30px;">
          Generated on: ${new Date().toLocaleString()} | Selected Clashes: ${selectedClashes.length}
        </p>
        ${clashesHtml}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  async function deleteSelected() {
    const selectedCount = s.selectedGuids.size;
    if (selectedCount === 0) return;

    const confirmDelete = confirm(`Are you sure you want to permanently delete the ${selectedCount} selected issue(s)?`);
    if (!confirmDelete) return;

    try {
      clashReport.onProgress.trigger({ progress: 20, message: `Deleting ${selectedCount} viewpoints...` });

      const selectedClashes = clashReport.list.filter(c => s.selectedGuids.has(c.guid || String(c.id)));
      
      const urlParts   = window.location.pathname.split("/");
      const idx        = urlParts.indexOf("projects");
      const projectId  = idx !== -1 && urlParts[idx + 1] ? urlParts[idx + 1] : "";

      let progressCount = 0;
      for (const clash of selectedClashes) {
        if (projectId) {
          const docId = clash.guid || String(clash.id);
          const clashDocRef = doc(firestoreDB, "projects", projectId, "clashes", docId);
          await deleteDoc(clashDocRef);
        }
        progressCount++;
        const currentProgress = Math.round(20 + (progressCount / selectedClashes.length) * 60);
        clashReport.onProgress.trigger({ progress: currentProgress, message: `Deleting ${progressCount}/${selectedClashes.length}...` });
      }

      // Now update local list
      clashReport.list = clashReport.list.filter(c => !s.selectedGuids.has(c.guid || String(c.id)));
      s.selectedGuids.clear();
      s.editingGuids.clear();
      
      clashReport.onProgress.trigger({ progress: 100, message: "Done!" });
      setTimeout(() => clashReport.onProgress.trigger({ progress: 0, message: "" }), 2000);
      
      update();
      s.updateHeaderControls?.();
    } catch (err) {
      console.error("[ClashTable] Failed to delete selected viewpoints:", err);
      alert("An error occurred while deleting viewpoints. Please try again.");
      clashReport.onProgress.trigger({ progress: 0, message: "" });
    }
  };

  // ── Data loading ───────────────────────────────────────────────────────────
  async function loadData(wrapper: HTMLElement) {
    try {
      clashReport.onProgress.trigger({ progress: 10, message: "Initializing…" });

      const urlParts   = window.location.pathname.split("/");
      const idx        = urlParts.indexOf("projects");
      const projectId  = idx !== -1 && urlParts[idx + 1] ? urlParts[idx + 1] : "";
      if (!projectId) throw new Error("No project selected");

      clashReport.onProgress.trigger({ progress: 40, message: "Fetching viewpoints from Firestore…" });
      
      const clashesRef = collection(firestoreDB, "projects", projectId, "clashes");
      const qSnapshot = await getDocs(clashesRef);
      const list: ClashData[] = [];
      
      qSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: data.id,
          name: data.name,
          type: data.type,
          status: data.status,
          date: data.date,
          markup: data.markup || "",
          solution: data.solution || "",
          image: data.image || "",
          planImage: data.planImage || "",
          sectionImage: data.sectionImage || "",
          guid: data.guid || docSnap.id,
          camera: data.camera || undefined,
          selection: data.selection || undefined,
        });
      });

      // Sort by ID ascending
      list.sort((a, b) => a.id - b.id);
      clashReport.list = list;

      clashReport.onProgress.trigger({ progress: 100, message: "Done!" });
      setTimeout(() => clashReport.onProgress.trigger({ progress: 0, message: "" }), 2000);

      update();
      // Notify sibling panels (dashboard, filter) that data is ready
      setTimeout(() => {
        wrapper.dispatchEvent(new CustomEvent("dataloaded", { bubbles: true }));
      }, 100);
    } catch (err) {
      console.error("[ClashTable] Failed to load viewpoints from Firestore:", err);
      clashReport.onProgress.trigger({ progress: 0, message: "" });
    }
  };

  // ── Initialise once ────────────────────────────────────────────────────────
  const onCreated = (e?: Element) => {
    if (!e || s._initialized) return;
    s._initialized = true;

    const wrapper = e as HTMLElement;
    document.addEventListener("clash-filters-changed",  () => update());
    
    document.addEventListener("clash-solution-updated", async (e: Event) => {
      try {
        const customEvent = e as CustomEvent<ClashData>;
        const clash = customEvent.detail;
        
        const urlParts   = window.location.pathname.split("/");
        const idx        = urlParts.indexOf("projects");
        const projectId  = idx !== -1 && urlParts[idx + 1] ? urlParts[idx + 1] : "";
        if (!projectId) return;

        const clashDocRef = doc(firestoreDB, "projects", projectId, "clashes", clash.guid || String(clash.id));
        await updateDoc(clashDocRef, { solution: clash.solution });
      } catch (err) {
        console.error("[ClashTable] Failed to save solution update to Firestore:", err);
      }
      update();
    });

    loadData(wrapper);

    // Find parent bim-panel-section and inject the header controls
    setTimeout(() => {
      const section = wrapper.closest("bim-panel-section");
      if (section) {
        const shadowRoot = section.shadowRoot;
        if (shadowRoot) {
          const header = shadowRoot.querySelector(".header") as HTMLElement;
          if (header) {
            const label = header.querySelector("bim-label");
            if (label) {
              label.after(s.headerControls!);
            } else {
              header.prepend(s.headerControls!);
            }
          }
        }
      }
    }, 50);
  };

  // ── Overlay ────────────────────────────────────────────────────────────────
  const showOverlay = (e: Event, clash: ClashData) => {
    e.stopPropagation();
    const overlay = clashDetailOverlay(clash, () => overlay.remove());
    document.body.appendChild(overlay);
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const q         = clashReport.searchQuery.trim().toLowerCase();
  const selStatus = clashReport.selectedStatus;
  const selType   = clashReport.selectedType;

  const filtered = clashReport.list.filter((c) => {
    const matchQ = !q ||
      String(c.id).toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.markup.toLowerCase().includes(q);
    const matchS = !selStatus || c.status === selStatus;
    const matchT = !selType   || c.type   === selType;
    return matchQ && matchS && matchT;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return BUI.html`
    <div ${BUI.ref(onCreated)} class="ct-container">

      ${clashReport.list.length === 0 ? BUI.html`

        <!-- Loading state -->
        <div class="ct-loading">
          <div class="ct-spinner"></div>
          <span>Loading clash report…</span>
        </div>

      ` : BUI.html`

        <div class="ct-wrap">

          <!-- Scrollable table -->
          <div class="ct-scroll">
            <table class="tech-table ct-table">
              <thead>
                <tr>
                  <th style="width: 2.5rem; text-align: center;">
                    <input
                      type="checkbox"
                      .checked=${filtered.length > 0 && filtered.every(c => s.selectedGuids!.has(c.guid || String(c.id)))}
                      @change=${(e: Event) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        if (checked) {
                          filtered.forEach(c => s.selectedGuids!.add(c.guid || String(c.id)));
                        } else {
                          filtered.forEach(c => s.selectedGuids!.delete(c.guid || String(c.id)));
                        }
                        update();
                        s.updateHeaderControls?.();
                      }}
                      style="cursor: pointer; width: 14px; height: 14px;"
                    />
                  </th>
                  <th style="width:4rem">ID</th>
                  <th>Name</th>
                  <th style="width:7rem">Type</th>
                  <th style="width:8rem">Status</th>
                  <th>Markup</th>
                  <th>Solution</th>
                  <th style="width:7rem">Date</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? BUI.html`
                  <tr>
                    <td colspan="8" class="ct-empty-row">
                      No clashes match the current filters.
                    </td>
                  </tr>
                ` : filtered.map((c) => BUI.html`
                  <tr class="ct-row">
                    <td style="text-align: center;">
                      <input
                        type="checkbox"
                        .checked=${s.selectedGuids!.has(c.guid || String(c.id))}
                        @change=${(e: Event) => {
                          const checked = (e.target as HTMLInputElement).checked;
                          const key = c.guid || String(c.id);
                          if (checked) {
                            s.selectedGuids!.add(key);
                          } else {
                            s.selectedGuids!.delete(key);
                          }
                          update();
                          s.updateHeaderControls?.();
                        }}
                        style="cursor: pointer; width: 14px; height: 14px;"
                      />
                    </td>

                    <!-- ID -->
                    <td>
                      <span class="ct-id-link" @click=${(e: Event) => showOverlay(e, c)}>
                        ${c.id}
                      </span>
                    </td>

                    <!-- Name -->
                    <td>
                      <span class="ct-name-link" @click=${(e: Event) => showOverlay(e, c)}>
                        ${c.name}
                      </span>
                    </td>

                    <!-- Type chip / select -->
                    <td>
                      ${s.editingGuids!.has(c.guid || String(c.id)) ? BUI.html`
                        <select
                          class="status-select ${getTypeClass(c.type)}"
                          @change=${async (e: Event) => {
                            const val = (e.target as HTMLSelectElement).value;
                            c.type = val;
                            
                            const urlParts   = window.location.pathname.split("/");
                            const idx        = urlParts.indexOf("projects");
                            const projectId  = idx !== -1 && urlParts[idx + 1] ? urlParts[idx + 1] : "";
                            
                            if (projectId) {
                              try {
                                const docId = c.guid || String(c.id);
                                const clashDocRef = doc(firestoreDB, "projects", projectId, "clashes", docId);
                                await updateDoc(clashDocRef, { type: val });
                              } catch (err) {
                                console.error("[ClashTable] Failed to update type in Firestore:", err);
                              }
                            }
                            update();
                            s.updateHeaderControls?.();
                            document.dispatchEvent(new CustomEvent("clash-filters-changed"));
                          }}
                        >
                          <option value="Major" ?selected=${c.type === "Major"}>Major</option>
                          <option value="Minor" ?selected=${c.type === "Minor"}>Minor</option>
                          <option value="Regulation" ?selected=${c.type === "Regulation"}>Regulation</option>
                        </select>
                      ` : BUI.html`
                        <span class="status-chip ${getTypeClass(c.type)}">
                          ${c.type.replace(".", "")}
                        </span>
                      `}
                    </td>

                    <!-- Status chip / select -->
                    <td>
                      ${s.editingGuids!.has(c.guid || String(c.id)) ? BUI.html`
                        <select
                          class="status-select ${getStatusClass(c.status)}"
                          @change=${async (e: Event) => {
                            const val = (e.target as HTMLSelectElement).value;
                            c.status = val;
                            
                            const urlParts   = window.location.pathname.split("/");
                            const idx        = urlParts.indexOf("projects");
                            const projectId  = idx !== -1 && urlParts[idx + 1] ? urlParts[idx + 1] : "";
                            
                            if (projectId) {
                              try {
                                const docId = c.guid || String(c.id);
                                const clashDocRef = doc(firestoreDB, "projects", projectId, "clashes", docId);
                                await updateDoc(clashDocRef, { status: val });
                              } catch (err) {
                                console.error("[ClashTable] Failed to update status in Firestore:", err);
                              }
                            }
                            update();
                            s.updateHeaderControls?.();
                            document.dispatchEvent(new CustomEvent("clash-filters-changed"));
                          }}
                        >
                          <option value="New" ?selected=${c.status === "New" || c.status === "Active"}>New</option>
                          <option value="Unresolved" ?selected=${c.status === "Unresolved"}>Unresolved</option>
                          <option value="Resolved." ?selected=${c.status === "Resolved."}>Resolved</option>
                          <option value="Approved as Noted" ?selected=${c.status === "Approved as Noted"}>Approved as Note</option>
                        </select>
                      ` : BUI.html`
                        <span class="status-chip ${getStatusClass(c.status)}">
                          ${c.status.replace(".", "").replace("Approved as Noted", "Approved")}
                        </span>
                      `}
                    </td>

                    <!-- Markup -->
                    <td class="ct-text-wrap ct-muted">${c.markup}</td>

                    <!-- Solution -->
                    <td class="ct-text-wrap ${c.solution ? "" : "ct-italic ct-muted"}">
                      ${c.solution || "No solution"}
                    </td>

                    <!-- Date -->
                    <td class="ct-muted">${c.date}</td>

                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          <!-- Footer count -->
          <div class="ct-footer">
            Showing <strong>${filtered.length}</strong> of
            <strong>${clashReport.list.length}</strong> clashes
          </div>

        </div>
      `}

    </div>
  `;
};

