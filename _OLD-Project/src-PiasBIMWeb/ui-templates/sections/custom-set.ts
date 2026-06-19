import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { queriesList } from "../tables/queries-hider";
import { appIcons } from "../../globals";

export interface CustomSetPanelState {
  components: OBC.Components;
}

export const customSetPanelTemplate: BUI.StatefullComponent<CustomSetPanelState> = (state) => {
  const { components } = state;

  const [queriesTable] = queriesList({
    components,
  });

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    queriesTable.queryString = input.value;
  };

  return BUI.html`
  <bim-panel>
    <bim-panel-section fixed icon=${appIcons.FILTER} label="Custom Set">
      <div style="display: flex; gap: 0.5rem;">
        <bim-text-input @input=${onSearch} placeholder="Search..." debounce="200" style="flex: 1;"></bim-text-input>
      </div>
      ${queriesTable}
    </bim-panel-section>
  </bim-panel>`;
};
