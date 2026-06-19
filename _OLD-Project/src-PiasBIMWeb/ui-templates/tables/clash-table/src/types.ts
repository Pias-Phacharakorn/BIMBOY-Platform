import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";

export interface ClashTableState {
  components: OBC.Components;
}

export interface ClashTableData {
  [key: string]: BUI.TableCellValue;
  ID: number;
  Name: string;
  Type: string;
  Status: string;
  Markup: string;
  Solution: string;
  Date: string;
  Actions: string;
}

