// @ts-nocheck
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { classifierList, selectedFilters, activeUpdateFunctions, applyActiveFilters } from "../tables/classifier-select";
import { appIcons } from "../../globals";

export interface CategorySelectPanelState {
  components: OBC.Components;
}

export const categorySelectPanelTemplate: BUI.StatefullComponent<
  CategorySelectPanelState
> = (state) => {
  const { components } = state;
  const classifier = components.get(OBC.Classifier);

  const [table] = classifierList({
    components,
    classificationName: "Categories",
  });

  const onAddDefaults = async ({ target: button }: { target: BUI.Button }) => {
    button.loading = true;
    await classifier.byCategory();
    await classifier.byIfcBuildingStorey({ classificationName: "Levels" });
    button.loading = false;
    for (const updateFn of activeUpdateFunctions) {
      updateFn();
    }
  };

  const onClearSelection = async () => {
    selectedFilters.delete("Categories");
    await applyActiveFilters(components);
    for (const updateFn of activeUpdateFunctions) {
      updateFn();
    }
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    table.queryString = input.value;
  };

  return BUI.html`
  <bim-panel>
    <bim-panel-section fixed icon=${appIcons.MODEL} label="Category Select">
      <div style="display: flex; gap: 0.5rem;">
        <bim-text-input @input=${onSearch} placeholder="Search categories..." debounce="200" style="flex: 1;"></bim-text-input>
        <bim-button @click=${onClearSelection} icon=${appIcons.STATUS} style="flex: 0;" title="Clear Selection"></bim-button>
        <bim-button @click=${onAddDefaults} icon=${appIcons.REFRESH} style="flex: 0;" title="Add Defaults"></bim-button>
      </div>
      ${table}
    </bim-panel-section>
  </bim-panel>`;
};

