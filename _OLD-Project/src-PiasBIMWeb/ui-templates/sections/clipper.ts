// @ts-nocheck
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { PiasClipper } from "../../bim-components/setup/src/clipper";

export interface ClipperPanelState {
  components: OBC.Components;
}

export const clipperPanelTemplate: BUI.StatefullComponent<ClipperPanelState> = (state, update) => {
  const { components } = state;
  const piasClipper = components.get<PiasClipper>(PiasClipper as any);

  // Subscribe to state changes to re-render (preventing duplicate listeners)
  if ((piasClipper as any)._uiListener) {
    piasClipper.onStateChanged.remove((piasClipper as any)._uiListener);
  }
  const onStateChanged = () => update();
  (piasClipper as any)._uiListener = onStateChanged;
  piasClipper.onStateChanged.add(onStateChanged);

  const onAddPlane = () => {
    piasClipper.enterPlacementMode();
  };

  const onCancelPlacement = () => {
    piasClipper.exitPlacementMode();
  };

  // Generate dynamic rows of active planes
  const rows = piasClipper.planes.map((plane) => {
    const isSelected = piasClipper.selectedPlaneId === plane.id;
    return BUI.html`
      <div 
        @click=${() => piasClipper.selectPlane(plane.id)}
        style="
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
          background: ${isSelected ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.02)"};
          border: 1px solid ${isSelected ? "var(--accent, #38bdf8)" : "var(--border)"};
          border-radius: 6px;
          padding: 0.5rem 0.75rem;
          transition: background 0.2s, border-color 0.2s;
          cursor: pointer;
        "
      >
        <!-- Checkbox to toggle plane -->
        <bim-checkbox
          ?checked=${plane.enabled}
          @change=${(e: Event) => {
            e.stopPropagation();
            const cb = e.target as BUI.Checkbox;
            piasClipper.togglePlane(plane.id, cb.checked);
          }}
          style="flex-shrink: 0;"
        ></bim-checkbox>

        <!-- Plane Name -->
        <span style="
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--fg);
          flex: 1;
        ">${plane.name}</span>

        <!-- Delete button to completely remove the plane -->
        <bim-button
          @click=${(e: Event) => {
            e.stopPropagation();
            piasClipper.deletePlane(plane.id);
          }}
          icon=${appIcons.CLOSE}
          style="
            flex-shrink: 0;
            --bim-button--bg: transparent;
            --bim-button--c: var(--danger, #ef4444);
            --bim-button--bg-hover: rgba(239, 68, 68, 0.1);
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
          "
          title="Delete plane"
        ></bim-button>
      </div>
    `;
  });

  const isPlacing = piasClipper.placing;
  const isFull = piasClipper.planes.length >= 6;

  const container = BUI.html`
    <bim-panel style="height: 100%;">
      <bim-panel-section fixed icon=${appIcons.CLIPPING} label="Sectioning Tools">
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          
          <!-- Top Button (Add Plane or Cancel) -->
          <div style="display: flex; gap: 0.5rem;">
            ${isPlacing ? BUI.html`
              <bim-button
                @click=${onCancelPlacement}
                icon=${appIcons.CLOSE}
                label="Cancel Placement"
                style="width: 100%; --bim-button--bg: var(--danger, #ef4444); --bim-button--bg-hover: #e03e3e;"
              ></bim-button>
            ` : BUI.html`
              <bim-button
                @click=${onAddPlane}
                ?disabled=${isFull}
                icon=${appIcons.ADD}
                label="Add Plane"
                style="width: 100%;"
                title="${isFull ? 'Limit of 6 planes reached' : 'Click to add a clipping plane'}"
              ></bim-button>
            `}
          </div>

          <!-- Placement Mode Instruction Banner -->
          ${isPlacing ? BUI.html`
            <div style="
              background: rgba(46, 204, 113, 0.12);
              border: 1px solid #2ecc71;
              color: var(--fg);
              font-size: 0.8rem;
              padding: 0.6rem;
              border-radius: 6px;
              display: flex;
              align-items: center;
              gap: 0.5rem;
            ">
              <iconify-icon icon="material-symbols:info" style="color: #2ecc71; font-size: 16px; flex-shrink: 0;"></iconify-icon>
              <span>Move mouse to hover over structural elements. Click to place the plane. Press Esc to cancel.</span>
            </div>
          ` : null}



          <!-- Planes Section Title -->
          <div style="
            font-weight: 600;
            font-size: 0.85rem;
            color: var(--muted, #8a8a8f);
            margin-bottom: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.35rem;
          ">
            <iconify-icon icon="${appIcons.LIST}" style="font-size: 14px;"></iconify-icon>
            Planes (${piasClipper.planes.length} / 6)
          </div>

          <!-- Planes List Container -->
          <div style="display: flex; flex-direction: column;">
            ${rows.length > 0 ? rows : BUI.html`
              <div style="
                text-align: center;
                padding: 2.5rem 1rem;
                color: var(--muted, #8a8a8f);
                border: 1px dashed var(--border);
                border-radius: 8px;
                background: rgba(255,255,255,0.01);
              ">
                <div style="font-size: 2.2rem; margin-bottom: 0.5rem; opacity: 0.4; display: flex; justify-content: center;">
                  <iconify-icon icon="material-symbols:folder-open-outline-rounded"></iconify-icon>
                </div>
                <div style="font-weight: 500; font-size: 0.85rem;">Nothing to display. Add planes.</div>
                <div style="font-size: 0.75rem; margin-top: 0.25rem; opacity: 0.8;">Click Add Plane above to place a section plane.</div>
              </div>
            `}
          </div>



        </div>
      </bim-panel-section>
    </bim-panel>
  `;

  // Element disconnected cleanup
  const originalDisconnect = (container as any).disconnectedCallback;
  (container as any).disconnectedCallback = function (this: any) {
    if ((piasClipper as any)._uiListener) {
      piasClipper.onStateChanged.remove((piasClipper as any)._uiListener);
      (piasClipper as any)._uiListener = null;
    }
    piasClipper.exitPlacementMode();

    if (originalDisconnect) {
      originalDisconnect.call(this);
    }
  };

  return container;
};

