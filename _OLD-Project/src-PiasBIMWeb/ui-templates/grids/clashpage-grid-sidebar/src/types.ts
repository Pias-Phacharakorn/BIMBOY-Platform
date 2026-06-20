// @ts-nocheck
import * as BUI from "@thatopen/ui";
import { ClashTableSectionState } from "../../../sections/clash-table";
import { ClashDashboardSectionState } from "../../../sections/clash-dashboard";
import { ClashFilterSectionState } from "../../../sections/clash-filter";

type Viewport = {
  name: "viewport";
  state: {};
};

export type ClashTable = {
  name: "clashTable";
  state: ClashTableSectionState;
};

export type ClashDashboard = {
  name: "clashDashboard";
  state: ClashDashboardSectionState;
};

export type ClashFilter = {
  name: "clashFilter";
  state: ClashFilterSectionState;
};

type ClashpageGridSidebarElements = [
  Viewport,
  ClashTable,
  ClashDashboard,
  ClashFilter,
];

type ClashpageGridSidebarLayouts = [
  "Dashboard",
  "ClashModel",
  "Issue List",
];

export type ClashpageGridSidebar = BUI.Grid<
  ClashpageGridSidebarLayouts,
  ClashpageGridSidebarElements
>;

