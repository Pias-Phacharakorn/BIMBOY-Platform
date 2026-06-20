// @ts-nocheck
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as CUI from "@thatopen/ui-obc";
import { loadModelBtnTemplate, cloudModelBtnTemplate } from "../buttons";
import { appIcons } from "../../globals";

export interface ModelsPanelState {
  components: OBC.Components;
}

export const modelsPanelTemplate: BUI.StatefullComponent<ModelsPanelState> = (
  state,
) => {
  const { components } = state;

  const [modelsList] = CUI.tables.modelsList({
    components,
    metaDataTags: ["schema"],
    actions: { download: true },
  });

  const [loadModelsBtn] = BUI.Component.create(loadModelBtnTemplate, {
    components,
  });
  loadModelsBtn.style.flex = "0";

  const [cloudModelsBtn] = BUI.Component.create(cloudModelBtnTemplate, {
    components,
  });
  cloudModelsBtn.style.flex = "0";

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };

  return BUI.html`
  <bim-panel>
    <bim-panel-section fixed icon=${appIcons.MODEL} label="Models List">
      <div style="display: flex; gap: 0.5rem;">
        <bim-text-input @input=${onSearch} placeholder="Search..." debounce="100" style="flex: 1;"></bim-text-input>
        ${cloudModelsBtn}
        ${loadModelsBtn}
      </div>
      ${modelsList}
    </bim-panel-section>
  </bim-panel>`;
};

