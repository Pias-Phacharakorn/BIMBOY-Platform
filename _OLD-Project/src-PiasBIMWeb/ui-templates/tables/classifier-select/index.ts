// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import { ClassifierListState, ClassifierListTableData } from "./src/types";
import { classifierListTemplate } from "./src/template";
import { setDefaults } from "./src/set-defaults";

export const selectedFilters = new Map<string, Set<string>>();
export const activeUpdateFunctions = new Set<() => void>();

export const classifierList = (state: ClassifierListState) => {
  const component = BUI.Component.create<BUI.Table<ClassifierListTableData>, ClassifierListState>(
    classifierListTemplate,
    state
  );

  const [table, updateTable] = component;

  setDefaults(state, table, updateTable);

  const { components } = state;
  const classifier = components.get(OBC.Classifier);
  
  const updateFunction = () => {
    setTimeout(() => {
      table.loadData(true);
      updateTable();
    });
  };
  
  classifier.list.onItemSet.add(updateFunction);
  activeUpdateFunctions.add(updateFunction);

  const originalDisconnect = (table as any).disconnectedCallback;
  (table as any).disconnectedCallback = function (this: any) {
    classifier.list.onItemSet.delete(updateFunction);
    activeUpdateFunctions.delete(updateFunction);
    if (activeUpdateFunctions.size === 0) {
      selectedFilters.clear();
    }
    if (originalDisconnect) {
      originalDisconnect.call(this);
    }
  };

  return component;
};

export async function applyActiveFilters(components: OBC.Components) {
  const highlighter = components.get(OBF.Highlighter);
  try {
    await highlighter.clear("select");
  } catch (err) {
    console.warn("[classifier-select] Failed to clear highlighter select:", err);
  }
}

export * from "./src/types";

