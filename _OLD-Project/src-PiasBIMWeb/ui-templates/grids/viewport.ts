// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import {
  ViewerToolbarState,
  viewerToolbarTemplate,
  ViewerTopToolbarState,
  viewerTopToolbarTemplate,
} from "..";

// ── Grid element type definitions ──────────────────────────────────────────

type BottomToolbar = { name: "bottomToolbar"; state: ViewerToolbarState };
type TopToolbar    = { name: "topToolbar";    state: ViewerTopToolbarState };

type ViewportGridElements = [BottomToolbar, TopToolbar];
type ViewportGridLayouts  = ["main"];

export type ViewportGrid = BUI.Grid<ViewportGridLayouts, ViewportGridElements>;

// ── State ──────────────────────────────────────────────────────────────────

interface ViewportGridState {
  components: OBC.Components;
  world: OBC.World;
}

// ── Templates ──────────────────────────────────────────────────────────────

export const viewportGridTemplate: BUI.StatefullComponent<ViewportGridState> = (
  state,
  update
) => {
  const { components, world } = state;

  const elements: BUI.GridComponents<ViewportGridElements> = {
    bottomToolbar: {
      template: viewerToolbarTemplate,
      initialState: { components, world: world as any },
    },
    topToolbar: {
      template: viewerTopToolbarTemplate,
      initialState: { components, world },
    }
  };

  const onCreated = (e?: Element) => {
    if (!e) return;
    const grid = e as ViewportGrid;
    grid.elements = elements;

    grid.layouts = {
      main: {
        template: `
          "topToolbar ." auto
          ".          ." 1fr
          "bottomToolbar bottomToolbar" auto
          / auto 1fr
        `,
      }
    };

    grid.layout = "main";
  };

  return BUI.html`<bim-grid floating class="viewport-grid" ${BUI.ref(onCreated)}></bim-grid>`;
};

