// @ts-nocheck
import * as OBC from "@thatopen/components";

export interface ClassifierListState {
  components: OBC.Components;
  classificationName?: string;
  selectedKey?: string;
}

export type ClassifierListTableData = {
  Classification: string;
  Name: string;
  Selected: string;
};

