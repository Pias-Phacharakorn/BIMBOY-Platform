import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { ClashImport } from "../../bim-components";
import { renderDashboard } from "../tables/clash-table/src/dashboard";

export interface ClashDashboardSectionState {
  components: OBC.Components;
  clashTable: HTMLElement;
}

export const clashDashboardSectionTemplate: BUI.StatefullComponent<ClashDashboardSectionState> = (state, update) => {
  const { components, clashTable } = state;
  const clashReport = components.get(ClashImport);
  const s = state as ClashDashboardSectionState & { _dashboardInit?: boolean };

  const onCreated = (e?: Element) => {
    if (!e || s._dashboardInit) return;
    s._dashboardInit = true;
    
    clashReport.onProgress.add(({ progress }) => {
      if (progress === 100) update();
    });
    
    const onFiltersChange = () => update();
    document.addEventListener("clash-filters-changed", onFiltersChange);
    clashTable.addEventListener("dataloaded", () => update());
  };

  const hasData = clashReport.list.length > 0;

  // Filter list reactively for dashboard stats
  const filteredList = clashReport.list.filter(c => {
    const q = clashReport.searchQuery.trim().toLowerCase();
    const status = clashReport.selectedStatus;
    const type = clashReport.selectedType;

    const matchesSearch = !q || 
      String(c.id).toLowerCase().includes(q) || 
      c.name.toLowerCase().includes(q) || 
      c.markup.toLowerCase().includes(q);

    const matchesStatus = !status || c.status === status;
    const matchesType = !type || c.type === type;

    return matchesSearch && matchesStatus && matchesType;
  });

  return BUI.html`
    <bim-panel-section
      ${BUI.ref(onCreated)}
      fixed
      icon=${appIcons.CLASH}
      label="Clash Report"
    >
      ${
        hasData
          ? BUI.html`
              <div style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.25rem 0;">
                ${renderDashboard(filteredList)}
              </div>
            `
          : BUI.html`
              <div style="color: var(--bim-ui_bg-contrast-60); font-style: italic; padding: 1rem; text-align: center; border: 1px dashed var(--bim-ui_bg-contrast-20); border-radius: 0.5rem;">
                Please load a report first
              </div>
            `
      }
    </bim-panel-section>
  `;
};
