// @ts-nocheck
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { appIcons } from "../../globals";
import { PiasClipper } from "../../bim-components/setup/src/clipper";

export interface ViewpointsPanelState {
  components: OBC.Components;
}

// Data structures for vector markup drawing strokes
interface StrokePoint {
  x: number;
  y: number;
}
interface Stroke {
  points: StrokePoint[];
  color: string;
  size: number;
}

const viewpointMarkups = new Map<string, Stroke[]>();
let currentStrokes: Stroke[] = [];

interface SavedClipperPlane {
  name: string;
  normal: { x: number; y: number; z: number };
  origin: { x: number; y: number; z: number };
  enabled: boolean;
}

const viewpointClippers = new Map<string, SavedClipperPlane[]>();
let isDrawing = false;
let markupModeActive = false; // Turned on automatically in Creating / Updating state
let activeColor = "#ef4444"; // Red default
let activeSize = 4;

let activeCanvas: HTMLCanvasElement | null = null;

// Multi-state management variables
let panelState: "Idle" | "Creating" | "Updating" = "Idle";
let updatingGuid: string | null = null;

export const viewpointPanelTemplate: BUI.StatefullComponent<ViewpointsPanelState> = (state, update) => {
  const { components } = state;
  const viewpoints = components.get(OBC.Viewpoints);

  // Helper to redraw all strokes onto canvas
  const redrawStrokes = (canvas: HTMLCanvasElement, strokes: Stroke[]) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      const first = stroke.points[0];
      ctx.moveTo(first.x * canvas.width, first.y * canvas.height);
      
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      }
      ctx.stroke();
    }
  };

  // Helper to fetch or create markup overlay canvas
  const getMarkupCanvas = (): HTMLCanvasElement | null => {
    if (activeCanvas && document.body.contains(activeCanvas)) {
      return activeCanvas;
    }
    const viewport = document.querySelector("bim-viewport");
    if (!viewport) return null;

    let canvas = viewport.querySelector(".viewpoint-markup-canvas") as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "viewpoint-markup-canvas";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "5";
      canvas.style.pointerEvents = markupModeActive ? "auto" : "none";
      canvas.style.touchAction = "none";
      
      viewport.appendChild(canvas);

      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        redrawStrokes(canvas, currentStrokes);
      };
      
      (canvas as any).resizeCanvas = resizeCanvas;
      window.addEventListener("resize", resizeCanvas);
      setTimeout(resizeCanvas, 100);
      
      // Drawing Listeners
      canvas.addEventListener("mousedown", onStartDrawing);
      canvas.addEventListener("mousemove", onDraw);
      canvas.addEventListener("mouseup", onStopDrawing);
      canvas.addEventListener("mouseleave", onStopDrawing);

      canvas.addEventListener("touchstart", onStartDrawingTouch);
      canvas.addEventListener("touchmove", onDrawTouch);
      canvas.addEventListener("touchend", onStopDrawing);
    }
    activeCanvas = canvas;
    return canvas;
  };

  // Mouse Pos converters
  const getCanvasMousePos = (e: MouseEvent, canvas: HTMLCanvasElement): StrokePoint => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  };

  const getCanvasTouchPos = (e: TouchEvent, canvas: HTMLCanvasElement): StrokePoint => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height
    };
  };

  // Drawing event handlers
  const onStartDrawing = (e: MouseEvent) => {
    if (!markupModeActive || !activeCanvas) return;
    isDrawing = true;
    const pos = getCanvasMousePos(e, activeCanvas);
    currentStrokes.push({
      points: [pos],
      color: activeColor,
      size: activeSize
    });
  };

  const onStartDrawingTouch = (e: TouchEvent) => {
    if (!markupModeActive || !activeCanvas) return;
    isDrawing = true;
    const pos = getCanvasTouchPos(e, activeCanvas);
    currentStrokes.push({
      points: [pos],
      color: activeColor,
      size: activeSize
    });
  };

  const onDraw = (e: MouseEvent) => {
    if (!isDrawing || !markupModeActive || !activeCanvas) return;
    const pos = getCanvasMousePos(e, activeCanvas);
    const activeStroke = currentStrokes[currentStrokes.length - 1];
    if (activeStroke) {
      activeStroke.points.push(pos);
      redrawStrokes(activeCanvas, currentStrokes);
    }
  };

  const onDrawTouch = (e: TouchEvent) => {
    if (!isDrawing || !markupModeActive || !activeCanvas) return;
    const pos = getCanvasTouchPos(e, activeCanvas);
    const activeStroke = currentStrokes[currentStrokes.length - 1];
    if (activeStroke) {
      activeStroke.points.push(pos);
      redrawStrokes(activeCanvas, currentStrokes);
    }
  };

  const onStopDrawing = () => {
    isDrawing = false;
  };

  // Viewpoint creation input setup
  let titleInput: BUI.TextInput | undefined;
  const onTitleInputCreated = (e?: Element) => {
    if (!e) return;
    titleInput = e as BUI.TextInput;
  };

  const enterCreatingState = () => {
    panelState = "Creating";
    markupModeActive = true;
    currentStrokes = [];
    const canvas = getMarkupCanvas();
    if (canvas) {
      canvas.style.pointerEvents = "auto";
      redrawStrokes(canvas, []);
    }
    update();
  };

  const exitActiveState = () => {
    panelState = "Idle";
    markupModeActive = false;
    updatingGuid = null;
    currentStrokes = [];
    const canvas = getMarkupCanvas();
    if (canvas) {
      canvas.style.pointerEvents = "none";
      redrawStrokes(canvas, []);
    }
    update();
  };

  const onSave = async ({ target: button }: { target: BUI.Button }) => {
    if (!titleInput) return;
    const title = titleInput.value.trim() || "New Viewpoint";
    button.loading = true;
    try {
      const viewpoint = viewpoints.create();
      viewpoint.title = title;
      await viewpoint.updateCamera();
      
      // Save markup strokes associated with viewpoint GUID
      if (currentStrokes.length > 0) {
        viewpointMarkups.set(viewpoint.guid, JSON.parse(JSON.stringify(currentStrokes)));
      }

      // Save clipper planes state
      const piasClipper = components.get<PiasClipper>(PiasClipper as any);
      const clipper = components.get(OBC.Clipper);
      const savedPlanes: SavedClipperPlane[] = [];
      for (const planeState of piasClipper.planes) {
        const plane = clipper.list.get(planeState.id);
        if (plane) {
          savedPlanes.push({
            name: planeState.name,
            normal: { x: plane.normal.x, y: plane.normal.y, z: plane.normal.z },
            origin: { x: plane.origin.x, y: plane.origin.y, z: plane.origin.z },
            enabled: planeState.enabled,
          });
        }
      }
      viewpointClippers.set(viewpoint.guid, savedPlanes);

      exitActiveState();
    } catch (err) {
      console.error("Failed to create viewpoint:", err);
      button.loading = false;
    }
  };

  const onSaveUpdates = async ({ target: button }: { target: BUI.Button }) => {
    if (!updatingGuid || !titleInput) return;
    const title = titleInput.value.trim() || "Updated Viewpoint";
    button.loading = true;
    try {
      const viewpoint = viewpoints.list.get(updatingGuid);
      if (viewpoint) {
        viewpoint.title = title;
        await viewpoint.updateCamera();

        // Save current strokes to this viewpoint
        if (currentStrokes.length > 0) {
          viewpointMarkups.set(updatingGuid, JSON.parse(JSON.stringify(currentStrokes)));
        } else {
          viewpointMarkups.delete(updatingGuid);
        }

        // Save current clipper planes state
        const piasClipper = components.get<PiasClipper>(PiasClipper as any);
        const clipper = components.get(OBC.Clipper);
        const savedPlanes: SavedClipperPlane[] = [];
        for (const planeState of piasClipper.planes) {
          const plane = clipper.list.get(planeState.id);
          if (plane) {
            savedPlanes.push({
              name: planeState.name,
              normal: { x: plane.normal.x, y: plane.normal.y, z: plane.normal.z },
              origin: { x: plane.origin.x, y: plane.origin.y, z: plane.origin.z },
              enabled: planeState.enabled,
            });
          }
        }
        viewpointClippers.set(updatingGuid, savedPlanes);
      }
      exitActiveState();
    } catch (err) {
      console.error("Failed to update viewpoint:", err);
      button.loading = false;
    }
  };

  const onClearMarkup = () => {
    currentStrokes = [];
    const canvas = getMarkupCanvas();
    if (canvas) {
      redrawStrokes(canvas, []);
    }
  };

  // Render viewpoint cards list
  const cards: BUI.TemplateResult[] = [];
  
  for (const [guid, viewpoint] of viewpoints.list) {
    const onGo = async ({ target: btn }: { target: BUI.Button }) => {
      btn.loading = true;
      try {
        await viewpoint.go();
        
        // Restore saved vector strokes
        const savedStrokes = viewpointMarkups.get(guid) || [];
        currentStrokes = JSON.parse(JSON.stringify(savedStrokes));
        const canvas = getMarkupCanvas();
        if (canvas) {
          redrawStrokes(canvas, currentStrokes);
        }

        // Restore saved clipper planes state (merging with existing)
        const piasClipper = components.get<PiasClipper>(PiasClipper as any);
        const clipper = components.get(OBC.Clipper);
        const savedPlanes = viewpointClippers.get(guid) || [];

        let maxIndex = piasClipper.nextPlaneIndex - 1;
        for (const sp of savedPlanes) {
          const normal = new THREE.Vector3(sp.normal.x, sp.normal.y, sp.normal.z);
          const origin = new THREE.Vector3(sp.origin.x, sp.origin.y, sp.origin.z);

          // Check if a plane with similar normal and origin already exists in the viewer
          let exists = false;
          for (const pState of piasClipper.planes) {
            const plane = clipper.list.get(pState.id);
            if (plane) {
              const normalDiff = plane.normal.distanceTo(normal);
              const originDiff = plane.origin.distanceTo(origin);
              if (normalDiff < 1e-3 && originDiff < 1e-3) {
                exists = true;
                break;
              }
            }
          }

          if (!exists) {
            piasClipper.createPlane(normal, origin, sp.name, sp.enabled);
            const match = sp.name.match(/Plane (\d+)/);
            if (match) {
              const idx = parseInt(match[1], 10);
              if (idx > maxIndex) maxIndex = idx;
            }
          }
        }
        piasClipper.nextPlaneIndex = maxIndex + 1;
      } catch (err) {
        console.error("Failed to go to viewpoint:", err);
      } finally {
        btn.loading = false;
      }
    };

    const onUpdateClicked = () => {
      updatingGuid = guid;
      panelState = "Updating";
      markupModeActive = true;
      
      // Load saved strokes
      const savedStrokes = viewpointMarkups.get(guid) || [];
      currentStrokes = JSON.parse(JSON.stringify(savedStrokes));
      
      const canvas = getMarkupCanvas();
      if (canvas) {
        canvas.style.pointerEvents = "auto";
        redrawStrokes(canvas, currentStrokes);
      }
      
      // Pre-fill input value
      setTimeout(() => {
        if (titleInput) titleInput.value = viewpoint.title || "";
      }, 50);

      update();
    };

    const onDelete = () => {
      viewpoints.list.delete(guid);
      viewpointMarkups.delete(guid);
      viewpointClippers.delete(guid);
      update(); 
    };

    cards.push(BUI.html`
      <div class="viewpoint-card" style="
        background: var(--bg-card, rgba(255,255,255,0.03));
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        border-radius: 8px;
        padding: 0.75rem;
        margin-bottom: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        transition: transform 0.2s, border-color 0.2s;
      ">
        <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 0.5rem; align-items: center; min-width: 0; flex: 1;">
            <span style="font-size: 1.15rem; color: var(--accent, #38bdf8); flex-shrink: 0; display: inline-flex;">
              <iconify-icon icon="${appIcons.CAMERA}"></iconify-icon>
            </span>
            <div style="flex-grow: 1; min-width: 0;">
              <div style="
                font-weight: 600;
                font-size: 0.9rem;
                color: var(--fg);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              ">${viewpoint.title || "Unnamed Viewpoint"}</div>
              <div style="font-size: 0.75rem; color: var(--muted); font-family: monospace;">
                ${guid.substring(0, 8)}...
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.25rem;">
            <bim-button @click=${onGo} icon=${appIcons.APPLY} style="flex: 0; --bim-button--bg: transparent;" title="Restore View"></bim-button>
            <bim-button @click=${onUpdateClicked} icon=${appIcons.REFRESH} style="flex: 0; --bim-button--bg: transparent;" title="Edit / Update"></bim-button>
            <bim-button @click=${onDelete} icon=${appIcons.CLOSE} style="flex: 0; --bim-button--bg: transparent; --bim-button--c: var(--danger, #ef4444);" title="Delete"></bim-button>
          </div>
        </div>
      </div>
    `);
  }

  // Ensure canvas overlay is mounted correctly
  setTimeout(() => {
    getMarkupCanvas();
  }, 100);

  // Ensure old listeners are removed first to prevent duplicates
  if ((viewpoints as any)._uiItemSetListener) {
    viewpoints.list.onItemSet.remove((viewpoints as any)._uiItemSetListener);
  }
  if ((viewpoints as any)._uiItemDeletedListener) {
    viewpoints.list.onItemDeleted.remove((viewpoints as any)._uiItemDeletedListener);
  }
  if ((viewpoints as any)._uiItemUpdatedListener) {
    viewpoints.list.onItemUpdated.remove((viewpoints as any)._uiItemUpdatedListener);
  }

  const updateFunction = () => update();
  (viewpoints as any)._uiItemSetListener = updateFunction;
  (viewpoints as any)._uiItemDeletedListener = updateFunction;
  (viewpoints as any)._uiItemUpdatedListener = updateFunction;

  viewpoints.list.onItemSet.add(updateFunction);
  viewpoints.list.onItemDeleted.add(updateFunction);
  viewpoints.list.onItemUpdated.add(updateFunction);

  let formSection: BUI.TemplateResult;

  if (panelState === "Idle") {
    formSection = BUI.html`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <bim-button 
          @click=${enterCreatingState} 
          icon=${appIcons.ADD} 
          label="Create Viewpoint"
          style="width: 100%;"
        ></bim-button>
      </div>
    `;
  } else {
    const isUpdating = panelState === "Updating";
    formSection = BUI.html`
      <div style="
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: rgba(255, 255, 255, 0.01);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.75rem;
      ">
        <div style="font-weight: bold; font-size: 0.85rem; color: var(--accent); display: flex; align-items: center; gap: 0.25rem;">
          <iconify-icon icon="lucide:pen-tool"></iconify-icon> 
          ${isUpdating ? "Update Viewpoint Mode" : "Create Viewpoint Mode"}
        </div>
        
        <bim-text-input 
          ${BUI.ref(onTitleInputCreated)} 
          placeholder="Viewpoint Title..." 
          style="width: 100%;"
        ></bim-text-input>

        <!-- Brush styling settings -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; color: var(--muted);">Color:</span>
            <div style="display: flex; gap: 0.35rem;">
              ${["#ef4444", "#3b82f6", "#eab308", "#22c55e"].map(color => {
                const isSelected = activeColor === color;
                return BUI.html`
                  <div 
                    @click=${() => { activeColor = color; update(); }}
                    style="
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: ${color};
                      cursor: pointer;
                      border: ${isSelected ? "2px solid #fff" : "1px solid rgba(0,0,0,0.3)"};
                      box-shadow: ${isSelected ? "0 0 0 1px " + color : "none"};
                    "
                  ></div>
                `;
              })}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; color: var(--muted);">Brush Size:</span>
            <div style="display: flex; gap: 0.25rem;">
              ${[2, 4, 8, 12].map(size => {
                const isSelected = activeSize === size;
                return BUI.html`
                  <div 
                    @click=${() => { activeSize = size; update(); }}
                    style="
                      padding: 0.15rem 0.4rem;
                      font-size: 0.7rem;
                      border-radius: 4px;
                      cursor: pointer;
                      background: ${isSelected ? "var(--accent)" : "rgba(255,255,255,0.05)"};
                      color: ${isSelected ? "#000" : "var(--fg)"};
                      border: 1px solid var(--border);
                      font-weight: bold;
                    "
                  >${size}px</div>
                `;
              })}
            </div>
          </div>

          <bim-button @click=${onClearMarkup} icon=${appIcons.CLEAR} label="Clear Canvas" style="width: 100%;"></bim-button>
        </div>

        <div style="display: flex; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.5rem;">
          <bim-button 
            @click=${isUpdating ? onSaveUpdates : onSave} 
            icon=${appIcons.CHECK} 
            label=${isUpdating ? "Save Updates" : "Save"} 
            style="flex: 1;"
          ></bim-button>
          <bim-button 
            @click=${exitActiveState} 
            icon=${appIcons.CLOSE} 
            label="Cancel" 
            style="flex: 1; --bim-button--bg: var(--danger, #ef4444);"
          ></bim-button>
        </div>
      </div>
    `;
  }

  const container = BUI.html`
    <bim-panel style="height: 100%;">
      <bim-panel-section fixed icon=${appIcons.CAMERA} label="Viewpoints">
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          
          <!-- State-based Form Section -->
          ${formSection}
          
          <div style="border-top: 1px solid var(--border); margin: 0.25rem 0;"></div>

          <!-- Viewpoints List Container -->
          <div class="viewpoints-list-container" style="
            display: flex;
            flex-direction: column;
            max-height: calc(100vh - 280px);
            overflow-y: auto;
            padding-right: 2px;
          ">
            ${cards.length > 0 ? cards : BUI.html`
              <div style="
                text-align: center;
                padding: 2rem 1rem;
                color: var(--muted);
                border: 1px dashed var(--border);
                border-radius: 8px;
                background: rgba(255,255,255,0.01);
              ">
                <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;">
                  <iconify-icon icon="${appIcons.CAMERA}"></iconify-icon>
                </div>
                <div>No viewpoints created yet.</div>
                <div style="font-size: 0.8rem; margin-top: 0.25rem;">Click Create Viewpoint above to start drawing.</div>
              </div>
            `}
          </div>
        </div>
      </bim-panel-section>
    </bim-panel>
  `;

  // Disconnect & cleanup
  const originalDisconnect = (container as any).disconnectedCallback;
  (container as any).disconnectedCallback = function (this: any) {
    if ((viewpoints as any)._uiItemSetListener) {
      viewpoints.list.onItemSet.remove((viewpoints as any)._uiItemSetListener);
      (viewpoints as any)._uiItemSetListener = null;
    }
    if ((viewpoints as any)._uiItemDeletedListener) {
      viewpoints.list.onItemDeleted.remove((viewpoints as any)._uiItemDeletedListener);
      (viewpoints as any)._uiItemDeletedListener = null;
    }
    if ((viewpoints as any)._uiItemUpdatedListener) {
      viewpoints.list.onItemUpdated.remove((viewpoints as any)._uiItemUpdatedListener);
      (viewpoints as any)._uiItemUpdatedListener = null;
    }
    
    if (activeCanvas) {
      window.removeEventListener("resize", (activeCanvas as any).resizeCanvas);
      
      activeCanvas.removeEventListener("mousedown", onStartDrawing);
      activeCanvas.removeEventListener("mousemove", onDraw);
      activeCanvas.removeEventListener("mouseup", onStopDrawing);
      activeCanvas.removeEventListener("mouseleave", onStopDrawing);
      
      activeCanvas.removeEventListener("touchstart", onStartDrawingTouch);
      activeCanvas.removeEventListener("touchmove", onDrawTouch);
      activeCanvas.removeEventListener("touchend", onStopDrawing);
      
      activeCanvas.remove();
      activeCanvas = null;
    }

    if (originalDisconnect) {
      originalDisconnect.call(this);
    }
  };

  return container;
};

