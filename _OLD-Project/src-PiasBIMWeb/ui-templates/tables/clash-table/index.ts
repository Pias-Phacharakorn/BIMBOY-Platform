// @ts-nocheck
import * as BUI from "@thatopen/ui";
import { ClashTableState } from "./src/types";
import { clashTableTemplate } from "./src/template";

export const clashTable = (state: ClashTableState) => {
  const component = BUI.Component.create<HTMLElement, ClashTableState>(clashTableTemplate, state);
  return component;
};

