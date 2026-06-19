import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { classifierList, selectedFilters, activeUpdateFunctions, applyActiveFilters } from "../tables/classifier-hider";
import { appIcons } from "../../globals";

export interface ClassifierLevelPanelState {
  components: OBC.Components;
}

export const classifierLevelPanelTemplate: BUI.StatefullComponent<ClassifierLevelPanelState> = (state) => {
  const { components } = state;
  const classifier = components.get(OBC.Classifier);

  const [table] = classifierList({ components, classificationName: "Levels" });

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
    selectedFilters.delete("Levels");
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
    <bim-panel-section fixed icon=${appIcons.FILTER} label="Classifier - Level">
      <div style="display: flex; gap: 0.5rem;">
        <bim-text-input @input=${onSearch} placeholder="Search levels..." debounce="200" style="flex: 1;"></bim-text-input>
        <bim-button @click=${onClearSelection} icon=${appIcons.STATUS} style="flex: 0;" title="Clear Selection"></bim-button>
        <bim-button @click=${onAddDefaults} icon=${appIcons.REFRESH} style="flex: 0;" title="Add Defaults"></bim-button>
      </div>
      ${table}
    </bim-panel-section>
  </bim-panel>`;
};
