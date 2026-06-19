import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BimpageGridSidebar } from "./src";
import { viewportContainerTemplate } from "../../containers";
import {
  modelsPanelTemplate,
  itemsDataPanelTemplate,
  customSetPanelTemplate,
  classifierCategoryPanelTemplate,
  classifierLevelPanelTemplate,
  GisPanelState,
  gisPanelTemplate,
  categorySelectPanelTemplate,
  propertyTablePanelTemplate,
  minimapSectionTemplate,
  smartViewsPanelTemplate,
  // tandemPanelTemplate,
  viewpointPanelTemplate,
  clipperPanelTemplate,
} from "../../sections";

interface BimpageGridSidebarState {
  components: OBC.Components;
  viewport?: BUI.Viewport;
}

export const bimpageGridSidebarTemplate: BUI.StatefullComponent<
  BimpageGridSidebarState
> = (state) => {
  const { components, viewport } = state;
  const onCreated = (e?: Element) => {
    if (!e) return;
    const grid = e as BimpageGridSidebar;

    const wrapper = grid.parentElement as any;
    if (wrapper) {
      Object.defineProperty(wrapper, "layout", {
        get() { return grid.layout; },
        set(val) { grid.layout = val; },
        configurable: true
      });
      Object.defineProperty(wrapper, "layouts", {
        get() { return grid.layouts; },
        configurable: true
      });
    }

    grid.elements = {
      viewport: {
        template: viewportContainerTemplate,
        initialState: { viewport },
      },
      models: {
        template: modelsPanelTemplate,
        initialState: { components },
      },
      itemsData: {
        template: itemsDataPanelTemplate,
        initialState: { components },
      },
      customSet: {
        template: customSetPanelTemplate,
        initialState: { components },
      },
      "classifier-category": {
        template: classifierCategoryPanelTemplate,
        initialState: { components },
      },
      "classifier-level": {
        template: classifierLevelPanelTemplate,
        initialState: { components },
      },
      gis: {
        template: gisPanelTemplate,
        initialState: { components },
      },
      "category-select": {
        template: categorySelectPanelTemplate,
        initialState: { components },
      },
      property: {
        template: propertyTablePanelTemplate,
        initialState: { components },
      },
      minimap: {
        template: minimapSectionTemplate,
        initialState: { components },
      },
      smartViews: {
        template: smartViewsPanelTemplate,
        initialState: { components },
      },
      viewpointPanel: {
        template: viewpointPanelTemplate,
        initialState: { components },
      },
      clipperPanel: {
        template: clipperPanelTemplate,
        initialState: { components },
      },
      /*
      tandem: {
        template: tandemPanelTemplate,
        initialState: { components },
      },
      */
    };

    grid.layouts = {
      Models: {
        template: `
          "models viewport itemsData" 1fr
          "customSet viewport classifier-category" 1fr
          /var(--left-sidebar-width, 18rem) 1fr var(--right-sidebar-width, 18rem)
        `,
      },
      Query: {
        template: `
          "itemsData viewport classifier-level" 1fr
          "customSet viewport classifier-category" 1fr
          /var(--left-sidebar-width, 18rem) 1fr var(--right-sidebar-width, 18rem)
        `,
      },
      Viewer: {
        template: `
          "viewport" 1fr
          /1fr
        `,
      },
      GIS: {
        template: `
          "viewport gis" 1fr
          /1fr var(--right-sidebar-width, 350px)
        `,
      },
      Data: {
        template: `
          "viewport category-select" 1fr
          /1fr var(--right-sidebar-width, 18rem)
        `,
      },
      Property: {
        template: `
          "itemsData viewport category-select" 1fr
          "property property property" 0.8fr
          /var(--left-sidebar-width, 18rem) 1fr var(--right-sidebar-width, 18rem)
        `,
      },
      Minimap: {
        template: `
          "viewport minimap" 1fr
          /1fr var(--right-sidebar-width, 22rem)
        `,
      },
      "Smart View": {
        template: `
          "viewport smartViews" 1fr
          /1fr var(--right-sidebar-width, 22rem)
        `,
      },
      Viewpoint: {
        template: `
          "clipperPanel viewport viewpointPanel" 1fr
          /var(--left-sidebar-width, 18rem) 1fr var(--right-sidebar-width, 18rem)
        `,
      },
      Clipper: {
        template: `
          "viewport clipperPanel" 1fr
          /1fr var(--right-sidebar-width, 22rem)
        `,
      },
    };

    const hasLeftSidebar = (layout: string) => {
      return ["Models", "Query", "Property", "Viewpoint"].includes(layout);
    };

    const hasRightSidebar = (layout: string) => {
      return [
        "Models",
        "Query",
        "GIS",
        "Data",
        "Property",
        "Minimap",
        "Smart View",
        "Viewpoint",
        "Clipper",
      ].includes(layout);
    };

    const syncGridAreas = () => {
      for (const node of grid.children) {
        if (node instanceof HTMLElement) {
          const area = node.style.gridArea;
          if (area) {
            const cleanArea = area.split("/")[0].trim();
            node.setAttribute("data-grid-area", cleanArea);
          }
        }
      }
    };

    const updateButtonsVisibility = () => {
      const leftBtn = grid.parentElement?.querySelector(".left-toggle-btn") as HTMLElement;
      const rightBtn = grid.parentElement?.querySelector(".right-toggle-btn") as HTMLElement;
      if (leftBtn) {
        leftBtn.style.display = hasLeftSidebar(grid.layout) ? "block" : "none";
      }
      if (rightBtn) {
        rightBtn.style.display = hasRightSidebar(grid.layout) ? "block" : "none";
      }
      syncGridAreas();
    };

    const observer = new MutationObserver(() => {
      syncGridAreas();
    });
    observer.observe(grid, { childList: true });

    // Intercept property layout changes
    let currentLayout = "Models";
    Object.defineProperty(grid, "layout", {
      get() {
        return currentLayout;
      },
      set(val) {
        currentLayout = val;
        grid.setAttribute("active-layout", val);
        grid.classList.remove("left-collapsed");
        grid.classList.remove("right-collapsed");
        const proto = Object.getPrototypeOf(grid);
        const descriptor = Object.getOwnPropertyDescriptor(proto, "layout");
        if (descriptor && descriptor.set) {
          descriptor.set.call(grid, val);
        }
        updateButtonsVisibility();
      },
      configurable: true,
    });

    grid.layout = "Models";
    setTimeout(updateButtonsVisibility, 0);
  };
  return BUI.html`
  <div class="grid-wrapper">
    <bim-grid ${BUI.ref(onCreated)} class="components-grid"></bim-grid>
    <div class="grid-toggle-btn left-toggle-btn" @click=${(e: Event) => {
      const grid = (e.currentTarget as HTMLElement).parentElement?.querySelector("bim-grid");
      if (grid) {
        grid.classList.toggle("left-collapsed");
      }
    }}><span class="btn-text"></span></div>
    <div class="grid-toggle-btn right-toggle-btn" @click=${(e: Event) => {
      const grid = (e.currentTarget as HTMLElement).parentElement?.querySelector("bim-grid");
      if (grid) {
        grid.classList.toggle("right-collapsed");
      }
    }}><span class="btn-text"></span></div>
  </div>
  `;
};
