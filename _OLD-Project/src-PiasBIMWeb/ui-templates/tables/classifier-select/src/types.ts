// @ts-nocheck
import * as OBC from "@thatopen/components";

export interface ClassifierListState {
  components: OBC.Components;
  classificationName?: string;
}

export type ClassifierListTableData = {
  Classification: string;
  Name: string;
  Selected: string;
};

