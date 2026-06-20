// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { QueriesListState, QueriesListTableData } from "./src/types";
import { queriesListTemplate } from "./src/template";
import { setDefaults } from "./src/set-defaults";

export const queriesList = (state: QueriesListState) => {
  const component = BUI.Component.create<BUI.Table<QueriesListTableData>, QueriesListState>(queriesListTemplate, state);

  const [table, updateTable] = component;

  setDefaults(state, table);

  const { components } = state;
  const finder = components.get(OBC.ItemsFinder);
  const updateFunction = () => updateTable();
  
  finder.list.onItemSet.add(updateFunction);
  finder.list.onItemUpdated.add(updateFunction);
  finder.list.onItemDeleted.add(updateFunction);
  finder.list.onCleared.add(updateFunction);

  const originalDisconnect = (table as any).disconnectedCallback;
  (table as any).disconnectedCallback = function (this: any) {
    finder.list.onItemSet.delete(updateFunction);
    finder.list.onItemUpdated.delete(updateFunction);
    finder.list.onItemDeleted.delete(updateFunction);
    finder.list.onCleared.delete(updateFunction);
    if (originalDisconnect) {
      originalDisconnect.call(this);
    }
  };

  return component;
};
export * from "./src/types";

