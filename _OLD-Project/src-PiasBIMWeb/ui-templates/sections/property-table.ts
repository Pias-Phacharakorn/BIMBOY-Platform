// @ts-nocheck
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { PropertyTable } from "../../bim-components/PropertyTable";
import { appIcons } from "../../globals";
import { selectedFilters, activeUpdateFunctions } from "../tables/classifier-select";

export interface PropertyTablePanelState {
  components: OBC.Components;
}

export const propertyTablePanelTemplate: BUI.StatefullComponent<
  PropertyTablePanelState
> = (state) => {
  const { components } = state;
  const propertyTable = components.get(PropertyTable);

  interface ControlsState {
    isLoading: boolean;
    isEmpty: boolean;
  }

  let updateControls: (controlsState: ControlsState) => void;

  // ── Event handlers wired to native managers ───────────────────────────────

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propertyTable.applyTextFilter(input.value ?? "");
  };

  const onExportCSV = () => {
    propertyTable.downloadData("IFC-Properties", "csv");
  };

  const onExportJSON = () => {
    propertyTable.downloadData("IFC-Properties", "json");
  };

  const onLoadData = async () => {
    const isCurrentlyEmpty = propertyTable.currentProperties.length === 0;
    try {
      if (updateControls) {
        updateControls({ isLoading: true, isEmpty: isCurrentlyEmpty });
      }
      await propertyTable.loadFilteredProperties();
      updateWrapper();
    } catch (err: any) {
      alert(
        err.message ||
          "Failed to load properties. Make sure you select categories first."
      );
    } finally {
      const isNowEmpty = propertyTable.currentProperties.length === 0;
      if (updateControls) {
        updateControls({ isLoading: false, isEmpty: isNowEmpty });
      }
    }
  };

  // ── Mount point: passes the div to PropertyTable for native table creation ─
  let tableMounted = false;
  const onTableMounted = (el?: Element) => {
    if (!el || tableMounted) return;
    tableMounted = true;
    propertyTable.initNativeTable(el as HTMLElement);
    if (propertyTable.currentProperties.length > 0) {
      propertyTable.populateTable();
    }
  };

  // ── Toolbar controls injected into the BUI panel header ──────────────────
  const [controls, updCtrls] = BUI.Component.create<HTMLDivElement, ControlsState>((controlsState) => {
    const { isLoading, isEmpty } = controlsState;

    // Check if there are pending selection changes not yet loaded
    const selectedCats = selectedFilters.get("Categories");
    const selectedCount = selectedCats ? selectedCats.size : 0;
    const isLoaded = propertyTable.currentProperties.length > 0;
    
    let hasPendingSelection = false;
    if (selectedCount > 0) {
      if (!isLoaded) {
        hasPendingSelection = true;
      } else {
        const loadedCats = propertyTable.loadedCategories || new Set<string>();
        if (selectedCount !== loadedCats.size) {
          hasPendingSelection = true;
        } else {
          for (const cat of selectedCats) {
            if (!loadedCats.has(cat)) {
              hasPendingSelection = true;
              break;
            }
          }
        }
      }
    }

    return BUI.html`
      <div
        @click=${(e: Event) => e.stopPropagation()}
        @mousedown=${(e: Event) => e.stopPropagation()}
        style="display: flex; gap: 0.5rem; align-items: center; flex: 1; margin-left: 2rem; margin-right: 1rem;"
      >
        <bim-text-input
          @input=${onSearch}
          placeholder="Search properties..."
          debounce="100"
          ?disabled=${isEmpty || isLoading}
          style="flex: 1; height: 28px;"
        ></bim-text-input>
        <bim-button
          @click=${onLoadData}
          icon=${isLoading ? "line-md:loading-loop" : "material-symbols:refresh"}
          label=${isLoading ? "Loading..." : "Refresh Data"}
          tooltip-text="Reload properties for the selected categories"
          ?disabled=${isLoading}
          class=${hasPendingSelection ? "pulse-button" : ""}
          style="flex: 0; --bim-button--fz: 12px; height: 28px;"
        ></bim-button>
        <bim-button
          @click=${onExportCSV}
          icon="material-symbols:file-download"
          label="Export CSV"
          ?disabled=${isEmpty || isLoading}
          style="flex: 0; --bim-button--fz: 12px; height: 28px;"
        ></bim-button>
        <bim-button
          @click=${onExportJSON}
          icon="material-symbols:code"
          label="Export JSON"
          ?disabled=${isEmpty || isLoading}
          style="flex: 0; --bim-button--fz: 12px; height: 28px;"
        ></bim-button>
      </div>
    `;
  }, { isLoading: false, isEmpty: true });

  updateControls = updCtrls;

  // ── Reactive content container ────────────────────────────────────────────
  const [container, update] = BUI.Component.create<
    HTMLDivElement,
    PropertyTablePanelState
  >((state) => {
    const isLoaded = propertyTable.currentProperties.length > 0;

    if (isLoaded) {
      propertyTable.isVisible = true;
    } else {
      propertyTable.isVisible = false;
      tableMounted = false;
    }

    if (updateControls) {
      updateControls({
        isLoading: false,
        isEmpty: !isLoaded
      });
    }

    const selectedCats = selectedFilters.get("Categories");
    const selectedCount = selectedCats ? selectedCats.size : 0;
    
    let pendingMessage = "Select categories first in Category Select, then click Refresh Data.";
    if (selectedCount > 0 && !isLoaded) {
      const catText = selectedCount === 1 ? "category" : "categories";
      pendingMessage = `${selectedCount} ${catText} selected. Click Refresh Data to load properties.`;
    }

    return BUI.html`
      <div style="height: 100%; display: flex; flex-direction: column; flex: 1; min-height: 0;">
        ${
          isLoaded
            ? BUI.html`
                <div
                  ${BUI.ref(onTableMounted)}
                  style="flex: 1; min-height: 0; overflow: hidden; position: relative;"
                ></div>
              `
            : BUI.html`
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; padding: 24px;">
                  <span style="font-size: 13px; color: var(--muted); text-align: center; font-weight: ${selectedCount > 0 ? "500" : "normal"};">
                    ${pendingMessage}
                  </span>
                </div>
              `
        }
      </div>
    `;
  }, state);

  // Sync update wrapper that runs updates on both controls and content container
  const updateWrapper = () => {
    update();
    if (updateControls) {
      updateControls({
        isLoading: false,
        isEmpty: propertyTable.currentProperties.length === 0
      });
    }
  };

  activeUpdateFunctions.add(updateWrapper);

  container.style.height = "100%";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.flex = "1";
  container.style.minHeight = "0";

  // Inject search/action controls into the BUI panel header
  const onSectionCreated = (el: Element | undefined) => {
    if (!el) return;
    const section = el as HTMLElement;
    setTimeout(() => {
      const shadowRoot = section.shadowRoot;
      if (!shadowRoot) return;
      const header = shadowRoot.querySelector(".header") as HTMLElement;
      if (!header) return;
      const label = header.querySelector("bim-label");
      if (label) {
        label.after(controls);
      } else {
        header.prepend(controls);
      }
    }, 0);
  };

  const panel = BUI.html`
    <bim-panel style="height: 100%; display: flex; flex-direction: column;">
      <bim-panel-section
        ${BUI.ref(onSectionCreated)}
        fixed
        icon=${appIcons.MODEL}
        label="Property Table"
        name="propertyTableSection"
        style="height: 100%; display: flex; flex-direction: column; flex: 1; min-height: 0;"
      >
        ${container}
      </bim-panel-section>
    </bim-panel>
  `;

  // Intercept disconnectedCallback to clean up updates registration
  const originalDisconnect = (panel as any).disconnectedCallback;
  (panel as any).disconnectedCallback = function (this: any) {
    activeUpdateFunctions.delete(updateWrapper);
    if (originalDisconnect) {
      originalDisconnect.call(this);
    }
  };

  return panel;
};

