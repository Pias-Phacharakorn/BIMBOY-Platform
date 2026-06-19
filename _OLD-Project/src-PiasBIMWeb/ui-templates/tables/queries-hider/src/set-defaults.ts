import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { QueriesListState, QueriesListTableData } from "./types";
import { appIcons } from "../../../../globals";

export const setDefaults = (
  state: QueriesListState,
  table: BUI.Table<QueriesListTableData>,
) => {
  const { components } = state;

  table.noIndentation = true;
  table.headersHidden = true;
  table.columns = ["Name", { name: "Actions", width: "auto" }];
  
  table.dataTransform = {
    Actions: (cellValue, rowData) => {
      const { Name } = rowData;
      if (!Name) return cellValue;

      const finder = components.get(OBC.ItemsFinder);
      const query = finder.list.get(Name);
      if (!query) return cellValue;

      const onClick = async ({ target: button }: { target: BUI.Button }) => {
        button.loading = true;
        const items = await query.test();
        const hider = components.get(OBC.Hider);
        await hider.isolate(items);
        button.loading = false;
      };

      return BUI.html`
        <bim-button style="flex: 0;" icon=${appIcons.SELECT} @click=${onClick} title="Isolate Elements"></bim-button>
      `;
    }
  };
};
