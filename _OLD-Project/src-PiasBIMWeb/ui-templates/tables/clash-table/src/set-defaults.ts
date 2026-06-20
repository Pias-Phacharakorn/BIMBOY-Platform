// @ts-nocheck
import * as BUI from "@thatopen/ui";
import { ClashTableState, ClashTableData } from "./types";

export const setDefaults = (state: ClashTableState, table: BUI.Table<ClashTableData>) => {
  table.columns = [

    { name: "ID", width: "3rem", sortable: true } as any,
    { name: "Name", width: "20rem" },
    { name: "Type", width: "7rem" },
    { name: "Status", width: "7rem" },
    { name: "Markup", width: "15rem" },
    { name: "Solution", width: "15rem" },
    { name: "Date", width: "7rem" },
    { name: "Actions", width: "5rem" },
  ];

  const errorSlot = BUI.Component.create(() => {
    return BUI.html`
      <div slot="error-loading" style="display: flex; flex-direction: column; align-items: center; padding: 2rem; gap: 0.5rem;">
        <bim-label data-table-element='error-message' style="color: #f44336;"></bim-label>
        <bim-button @click=${() => table.loadData(true)} label="Retry" style="width: 8rem;"></bim-button>
      </div>
    `;
  });
  table.appendChild(errorSlot);

  const missingDataSlot = BUI.Component.create(() => {
    return BUI.html`
      <div slot="missing-data" style="display: flex; flex-direction: column; align-items: center; padding: 2rem; gap: 0.5rem;">
        <bim-label>No clashes found.</bim-label>
        <bim-button @click=${() => {
          table.loadData(true);
        }} label="Load Data" style="width: 8rem;"></bim-button>
      </div>
    `;
  });
  table.appendChild(missingDataSlot);
};





