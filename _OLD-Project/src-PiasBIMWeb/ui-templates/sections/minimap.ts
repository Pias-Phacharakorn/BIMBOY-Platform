import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { MiniMap } from "../../bim-components/MiniMap";
import { appIcons } from "../../globals";

export const minimapSectionTemplate = (state: { components: OBC.Components }) => {
  const { components } = state;
  const minimap = components.get(MiniMap);

  const onCreated = (e?: Element) => {
    if (!e) return;
    const container = e as HTMLElement;
    // Clear any previous children (HMR support)
    container.innerHTML = "";
    
    // Create a wrapper for the minimap that maintains a square aspect ratio
    const wrapper = document.createElement("div");
    wrapper.style.width = "100%";
    wrapper.style.aspectRatio = "1 / 1";
    wrapper.style.position = "relative";
    wrapper.style.marginTop = "1rem";
    
    wrapper.appendChild(minimap.uiContainer);
    container.appendChild(wrapper);

    // Force an initial update of the cache
    minimap.forceUpdateCache();
  };

  return BUI.html`
    <bim-panel-section label="Minimap" icon=${appIcons.EARTH}>
      <div style="display: flex; justify-content: end; align-items: center; margin-bottom: 0.5rem;">
        <div style="display: flex; gap: 0.25rem; align-items: center;">
          <bim-button icon=${appIcons.ZOOM_IN} label="Zoom In" @click=${() => minimap.zoomIn()}></bim-button>
          <bim-button icon=${appIcons.ZOOM_OUT} label="Zoom Out" @click=${() => minimap.zoomOut()}></bim-button>
          <bim-button icon=${appIcons.REFRESH} label="Refresh" @click=${() => minimap.forceUpdateCache()}></bim-button>
        </div>
      </div>
      <div ${BUI.ref(onCreated)}></div>
    </bim-panel-section>
  `;
};
