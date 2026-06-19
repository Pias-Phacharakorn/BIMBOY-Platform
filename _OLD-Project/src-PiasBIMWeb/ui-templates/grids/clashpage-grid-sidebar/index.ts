import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { ClashpageGridSidebar } from "./src";
import { viewportContainerTemplate } from "../../containers";
import {
  clashDashboardSectionTemplate,
  clashTableSectionTemplate,
  clashFilterSectionTemplate,
} from "../../sections";
import { clashTable as createClashTable } from "../../tables/clash-table";

interface ClashpageGridSidebarState {
  components: OBC.Components;
  viewport?: BUI.Viewport;
}

export const clashpageGridSidebarTemplate: BUI.StatefullComponent<
  ClashpageGridSidebarState
> = (state) => {
  const { components, viewport } = state;
  const onCreated = (e?: Element) => {
    if (!e) return;
    const grid = e as ClashpageGridSidebar;

    const [clashTable] = createClashTable({ components });

    grid.elements = {
      viewport: {
        template: viewportContainerTemplate,
        initialState: { viewport },
      },
      clashDashboard: {
        template: clashDashboardSectionTemplate,
        initialState: { components, clashTable },
      },
      clashTable: {
        template: clashTableSectionTemplate,
        initialState: { components, clashTable },
      },
      clashFilter: {
        template: clashFilterSectionTemplate,
        initialState: { components, clashTable },
      },
    };

    grid.layouts = {
      Dashboard: {
        template: `
          "clashDashboard clashFilter" auto
          "clashTable clashFilter" 1fr
          /1fr 20rem 
        `,
      },
      ClashModel: {
        template: `
          "viewport viewport" 1fr
          "clashTable clashFilter" 1fr
          /1fr 20rem
        `,
      },
      "Issue List": {
        template: `
          "clashTable" 1fr
        `,
      },
    };

    grid.layout = "Dashboard";
  };
  return BUI.html`
    <bim-grid ${BUI.ref(onCreated)} class="components-grid"></bim-grid>
  `;
};
