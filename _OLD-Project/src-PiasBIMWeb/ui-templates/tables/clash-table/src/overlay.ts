import * as BUI from "@thatopen/ui";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../../../../firebase";
import { ClashData } from "../../../../bim-components";
import { appIcons } from "../../../../globals";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getAuthenticatedUrl = async (url: string): Promise<string> => {
  if (!url) return "";
  if (!url.startsWith("https://firebasestorage.googleapis.com/")) {
    return url;
  }
  try {
    const oIdx = url.indexOf("/o/");
    if (oIdx === -1) return url;
    let pathSegment = url.substring(oIdx + 3);
    const qIdx = pathSegment.indexOf("?");
    if (qIdx !== -1) {
      pathSegment = pathSegment.substring(0, qIdx);
    }
    const storagePath = decodeURIComponent(pathSegment);
    const imageRef = ref(storage, storagePath);
    return await getDownloadURL(imageRef);
  } catch (error) {
    console.error("Failed to get authenticated URL for:", url, error);
    return url;
  }
};

// ─── State ────────────────────────────────────────────────────────────────────

interface OverlayState {
  clash: ClashData;
  onClose: () => void;
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  lastMousePos: { x: number; y: number };
  loading: boolean;
  planLoading: boolean;
  sectionLoading: boolean;
  isEditingSolution: boolean;
  solutionDraft: string;
  resolvedImage: string;
  resolvedPlanImage: string;
  resolvedSectionImage: string;
}

// ─── Prop Types ───────────────────────────────────────────────────────────────

type ImageAreaProps = {
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
  loading: boolean;
  resolvedImage: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: () => void;
  onImageLoad: () => void;
  onImageError: () => void;
};

type SolutionFieldProps = {
  isEditing: boolean;
  draft: string;
  solution: string | undefined;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onInput: (e: Event) => void;
  onKeydown: (e: KeyboardEvent) => void;
};

type SidebarProps = {
  clash: ClashData;
  displayType: string;
  displayStatus: string;
  solutionProps: SolutionFieldProps;
  onClose: () => void;
  planLoading: boolean;
  sectionLoading: boolean;
  resolvedPlanImage: string;
  resolvedSectionImage: string;
  onPlanLoad: () => void;
  onPlanError: () => void;
  onSectionLoad: () => void;
  onSectionError: () => void;
};

// ─── Sub-templates ────────────────────────────────────────────────────────────

export const renderImageArea = (p: ImageAreaProps) => BUI.html`
  <div class="clash-overlay-image-area">
    <div class="clash-main-image-viewport">

      <div
        class="clash-main-image-container"
        @mousedown=${p.onMouseDown}
        @mousemove=${p.onMouseMove}
        @mouseup=${p.onMouseUp}
        @mouseleave=${p.onMouseUp}
        style="cursor: ${p.isDragging ? "grabbing" : "grab"};"
      >
        <div class="clash-spinner" style="display: ${p.loading ? "block" : "none"};"></div>
        ${p.resolvedImage ? BUI.html`
          <img
            src="${p.resolvedImage}"
            @load=${p.onImageLoad}
            @error=${p.onImageError}
            style="
              display:    ${p.loading ? "none" : "block"};
              transform:  translate(${p.pan.x}px, ${p.pan.y}px) scale(${p.zoom});
              transition: ${p.isDragging ? "none" : "transform 0.2s ease"};
              pointer-events: none;
              user-select: none;
            "
          >
        ` : ""}
      </div>

      <div class="clash-zoom-controls">
        <button class="overlay-icon-btn overlay-icon-btn--muted" title="Zoom out"   @click=${p.onZoomOut}>−</button>
        <span style="min-width:3rem;text-align:center;font-size:12px;color:var(--muted);">${Math.round(p.zoom * 100)}%</span>
        <button class="overlay-icon-btn overlay-icon-btn--muted" title="Zoom in"    @click=${p.onZoomIn}>+</button>
        <button class="overlay-icon-btn overlay-icon-btn--muted" title="Reset zoom" @click=${p.onZoomReset}>⟲</button>
      </div>

    </div>
  </div>
`;

export const renderSolutionField = (p: SolutionFieldProps) => {
  if (p.isEditing) {
    return BUI.html`
      <div class="content-box content-box--editable">
        <input
          id="clash-solution-input"
          class="solution-input"
          type="text"
          .value=${p.draft}
          @input=${p.onInput}
          @keydown=${p.onKeydown}
        >
        <button class="overlay-icon-btn overlay-icon-btn--primary" title="Save (Enter)" @click=${p.onSave}>
          <iconify-icon icon=${appIcons.CHECK}></iconify-icon>
        </button>
        <button class="overlay-icon-btn overlay-icon-btn--muted" title="Cancel (Esc)" @click=${p.onCancel}>
          <iconify-icon icon=${appIcons.CLOSE}></iconify-icon>
        </button>
      </div>
    `;
  }

  const hasValue = Boolean(p.solution);
  return BUI.html`
    <div
      class="content-box content-box--editable ${hasValue ? "" : "content-box--placeholder"}"
      style="cursor: pointer;"
      @click=${p.onEdit}
    >
      <span>${p.solution || "No solution — click to add"}</span>
      <span class="edit-icon" title="Edit Solution">
        <iconify-icon icon=${appIcons.EDIT}></iconify-icon>
      </span>
    </div>
  `;
};

export const renderSidebar = (p: SidebarProps) => BUI.html`
  <div class="clash-overlay-sidebar">

    <div class="clash-panel-header">
      <button class="close-btn overlay-icon-btn overlay-icon-btn--white" aria-label="Close" @click=${p.onClose}>
        <iconify-icon icon=${appIcons.CLOSE}></iconify-icon>
      </button>
      <h1>#${p.clash.id}</h1>
      <p>${p.clash.name}</p>
    </div>

    <div class="clash-panel-body">

      <div class="badges-row">
        <span class="badge badge--${p.displayType.toLowerCase()}">${p.displayType}</span>
        <span class="badge badge--${p.displayStatus.toLowerCase().replace(/\s/g, "-")}">${p.displayStatus}</span>
      </div>

      <div class="section-group">
        <span class="label">DATE</span>
        <div class="value-text">${p.clash.date}</div>
      </div>

      <div class="section-group">
        <span class="label">MARKUP</span>
        <div class="content-box">${p.clash.markup || "No markup available"}</div>
      </div>

      <div class="section-group">
        <span class="label">SOLUTION</span>
        ${renderSolutionField(p.solutionProps)}
      </div>

      <div class="clash-sidebar-images">
        ${p.clash.planImage ? BUI.html`
          <div class="clash-sidebar-img-wrapper">
            <span class="label">PLAN VIEW</span>
            <div class="clash-sidebar-img-container">
              <div class="clash-spinner clash-spinner--sm" style="display: ${p.planLoading ? "block" : "none"};"></div>
              ${p.resolvedPlanImage ? BUI.html`
                <img 
                  src="${p.resolvedPlanImage}"
                  @load=${p.onPlanLoad}
                  @error=${p.onPlanError}
                  style="display: ${p.planLoading ? "none" : "block"};"
                >
              ` : ""}
            </div>
          </div>
        ` : ""}
        ${p.clash.sectionImage ? BUI.html`
          <div class="clash-sidebar-img-wrapper">
            <span class="label">SECTION VIEW</span>
            <div class="clash-sidebar-img-container">
              <div class="clash-spinner clash-spinner--sm" style="display: ${p.sectionLoading ? "block" : "none"};"></div>
              ${p.resolvedSectionImage ? BUI.html`
                <img 
                  src="${p.resolvedSectionImage}"
                  @load=${p.onSectionLoad}
                  @error=${p.onSectionError}
                  style="display: ${p.sectionLoading ? "none" : "block"};"
                >
              ` : ""}
            </div>
          </div>
        ` : ""}
      </div>

    </div>

    <div class="modal-footer">
      <div class="status-pill">
        <iconify-icon icon=${appIcons.WARNING}></iconify-icon>
        <span>${p.clash.date} Pending</span>
      </div>
    </div>

  </div>
`;

// ─── Main Template ────────────────────────────────────────────────────────────

const overlayTemplate: BUI.StatefullComponent<OverlayState> = (state, update) => {
  const { clash, onClose } = state;

  // Image area handlers
  const onZoomIn    = () => { state.zoom += 0.2; update(); };
  const onZoomOut   = () => { if (state.zoom > 0.4) { state.zoom -= 0.2; update(); } };
  const onZoomReset = () => { state.zoom = 1; state.pan = { x: 0, y: 0 }; update(); };

  const onMouseDown = (e: MouseEvent) => {
    state.isDragging = true;
    state.lastMousePos = { x: e.clientX, y: e.clientY };
    update();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!state.isDragging) return;
    state.pan.x += e.clientX - state.lastMousePos.x;
    state.pan.y += e.clientY - state.lastMousePos.y;
    state.lastMousePos = { x: e.clientX, y: e.clientY };
    update();
  };

  const onMouseUp   = () => { if (!state.isDragging) return; state.isDragging = false; update(); };
  const onImageLoad = () => { state.loading = false; update(); };
  const onImageError = () => { state.loading = false; update(); };

  // Plan/Section View load handlers
  const onPlanLoad = () => { state.planLoading = false; update(); };
  const onPlanError = () => { state.planLoading = false; update(); };
  const onSectionLoad = () => { state.sectionLoading = false; update(); };
  const onSectionError = () => { state.sectionLoading = false; update(); };

  // Solution handlers
  const onEditSolution = () => {
    state.isEditingSolution = true;
    state.solutionDraft = clash.solution || "";
    update();
    setTimeout(() => {
      const el = document.getElementById("clash-solution-input") as HTMLInputElement | null;
      if (el) { el.focus(); el.select(); }
    }, 50);
  };

  const onSaveSolution = () => {
    clash.solution = state.solutionDraft;
    state.isEditingSolution = false;
    update();
    document.dispatchEvent(new CustomEvent("clash-solution-updated", { detail: clash }));
  };

  const onCancelSolution = () => { state.isEditingSolution = false; update(); };

  const onSolutionKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") onSaveSolution();
    else if (e.key === "Escape") onCancelSolution();
  };

  const onSolutionInput = (e: Event) => {
    state.solutionDraft = (e.target as HTMLInputElement).value;
  };

  // Display values
  const displayStatus = clash.status.replace("Approved as Noted", "Approved").replace(".", "");
  const displayType   = clash.type.replace(".", "");

  return BUI.html`
    <div class="clash-overlay-backdrop" @click=${onClose}>
      <div class="clash-overlay-content" @click=${(e: Event) => e.stopPropagation()}>

        ${renderImageArea({
          zoom: state.zoom, pan: state.pan,
          isDragging: state.isDragging, loading: state.loading,
          resolvedImage: state.resolvedImage,
          onZoomIn, onZoomOut, onZoomReset,
          onMouseDown, onMouseMove, onMouseUp, onImageLoad, onImageError,
        })}

        ${renderSidebar({
          clash, displayType, displayStatus, onClose,
          planLoading: state.planLoading,
          sectionLoading: state.sectionLoading,
          resolvedPlanImage: state.resolvedPlanImage,
          resolvedSectionImage: state.resolvedSectionImage,
          onPlanLoad, onPlanError,
          onSectionLoad, onSectionError,
          solutionProps: {
            isEditing: state.isEditingSolution,
            draft:     state.solutionDraft,
            solution:  clash.solution,
            onEdit:    onEditSolution,
            onSave:    onSaveSolution,
            onCancel:  onCancelSolution,
            onInput:   onSolutionInput,
            onKeydown: onSolutionKeydown,
          },
        })}

      </div>
    </div>
  `;
};

// ─── Factory ──────────────────────────────────────────────────────────────────

export const clashDetailOverlay = (clash: ClashData, onClose: () => void) => {
  const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") cleanup(); };
  const cleanup   = () => { window.removeEventListener("keydown", handleEsc); onClose(); };

  const [element, updateComponent] = BUI.Component.create<HTMLDivElement, OverlayState>(overlayTemplate, {
    clash,
    onClose:           cleanup,
    zoom:              1,
    pan:               { x: 0, y: 0 },
    isDragging:        false,
    lastMousePos:      { x: 0, y: 0 },
    loading:           true,
    planLoading:       Boolean(clash.planImage),
    sectionLoading:    Boolean(clash.sectionImage),
    isEditingSolution: false,
    solutionDraft:     "",
    resolvedImage:     "",
    resolvedPlanImage: "",
    resolvedSectionImage: "",
  });

  const resolveUrls = async () => {
    try {
      const [resolvedImg, resolvedPlan, resolvedSection] = await Promise.all([
        clash.image ? getAuthenticatedUrl(clash.image) : Promise.resolve(""),
        clash.planImage ? getAuthenticatedUrl(clash.planImage) : Promise.resolve(""),
        clash.sectionImage ? getAuthenticatedUrl(clash.sectionImage) : Promise.resolve(""),
      ]);

      updateComponent({
        resolvedImage: resolvedImg,
        resolvedPlanImage: resolvedPlan,
        resolvedSectionImage: resolvedSection,
        loading: Boolean(resolvedImg),
        planLoading: Boolean(resolvedPlan),
        sectionLoading: Boolean(resolvedSection),
      });
    } catch (err) {
      console.error("Error resolving image download URLs:", err);
      updateComponent({
        loading: false,
        planLoading: false,
        sectionLoading: false,
      });
    }
  };

  resolveUrls();

  window.addEventListener("keydown", handleEsc);
  return element;
};
