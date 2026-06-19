import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { ClassifierListState, ClassifierListTableData } from "./types";

export const classifierListTemplate: BUI.StatefullComponent<ClassifierListState> = (state) => {
  const { components } = state;
  const classifier = components.get(OBC.Classifier);

  const onCreated = (e?: Element) => {
    if (!e) return;
    const table = e as BUI.Table<ClassifierListTableData>;

    table.loadFunction = async () => {
      const data: BUI.TableGroupData<ClassifierListTableData>[] = [];

      for (const [classification, groups] of classifier.list) {
        if (state.classificationName && classification !== state.classificationName) {
          continue;
        }
        for (const [name] of groups) {
          data.push({
            data: { Name: name, Classification: classification, Selected: "" },
          });
        }
      }

      return data;
    };

    table.loadData(true);
  };

  return BUI.html`
    <bim-table ${BUI.ref(onCreated)}></bim-table>
  `;
};
