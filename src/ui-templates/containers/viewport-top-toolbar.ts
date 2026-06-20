// @ts-nocheck
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import { appIcons } from "../../globals";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewportTool {
  id: string;
  label: string;
  icon: string;
  getComponent: (components: OBC.Components) => { enabled: boolean };
}

export interface ViewerTopToolbarState {
  components: OBC.Components;
  world: OBC.World;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Configuration Registry
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_CONFIG: ViewportTool[] = [
  {
    id: "clipper",
    label: "Clipper",
    icon: appIcons.CLIPPING,
    getComponent: (components) => components.get(OBC.Clipper),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component Template
// ─────────────────────────────────────────────────────────────────────────────

export const viewerTopToolbarTemplate: BUI.StatefullComponent<
  ViewerTopToolbarState
> = (state, update) => {
  const { components } = state;

  const onToggleTool = (tool: ViewportTool) => {
    const targetComp = tool.getComponent(components);
    const wasEnabled = targetComp.enabled;

    for (const config of TOOL_CONFIG) {
      const comp = config.getComponent(components);
      comp.enabled = false;
    }

    targetComp.enabled = !wasEnabled;
    
    update();
    // Notify the parent grid/view to update if needed
    window.dispatchEvent(new CustomEvent("viewport-tool-toggle"));
  };

  const onSetAppearance = async ({ target: button }: { target: BUI.Button }) => {
    const highlighter = components.get(OBF.Highlighter);
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;

    button.loading = true;

    const fragments = components.get(OBC.FragmentsManager);
    const nonSelectedSelection: OBC.ModelIdMap = {};

    for (const [modelID, model] of fragments.list) {
      const allIds = await model.getLocalIds();
      const selectedIds = selection[modelID] || new Set<number>();
      const nonSelectedIds = new Set<number>();
      
      for (const id of allIds) {
        if (!selectedIds.has(id)) {
          nonSelectedIds.add(id);
        }
      }
      
      if (nonSelectedIds.size > 0) {
        nonSelectedSelection[modelID] = nonSelectedIds;
      }
    }

    const color = "#ffffff";
    if (!highlighter.styles.has(color)) {
      highlighter.styles.set(color, {
        color: new THREE.Color(color),
        renderedFaces: 1,
        opacity: 0.2,
        transparent: true,
      });
    }

    await Promise.all([
      highlighter.highlightByID(
        color,
        nonSelectedSelection,
        false,
        false
      ),
      highlighter.clear("select")
    ]);

    button.loading = false;
  };

  return BUI.html`
    <div style="position: relative; display: flex; flex-direction: column; margin-top: 12px; margin-left: 12px;">
      <bim-toolbar vertical style="align-self: start; --bim-ui_size-10xl: 28px; --bim-icon--fz: 13px; --bim-label--fz: 11px; --bim-ui_size-sm: 8px; --bim-ui_size-2xs: 6px; border: none; outline: 1px solid var(--border);">
        <bim-toolbar-section>
          ${TOOL_CONFIG.map((tool) => {
            const isEnabled = tool.getComponent(components).enabled;
            return BUI.html`
              <bim-button 
                icon=${tool.icon} 
                ?active=${isEnabled}
                @click=${() => onToggleTool(tool)}>
              </bim-button>
            `;
          })}
          <bim-button 
            icon=${appIcons.EDIT}
            tooltip-title="Set Element Appearance"
            title="Set Element Appearance"
            @click=${onSetAppearance}>
          </bim-button>
        </bim-toolbar-section>
      </bim-toolbar>
    </div>
  `;
};

