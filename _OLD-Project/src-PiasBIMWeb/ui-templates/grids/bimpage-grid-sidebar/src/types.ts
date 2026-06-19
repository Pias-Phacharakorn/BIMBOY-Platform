import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import {
  ModelsPanelState,
  ItemsDataPanelState,
  CustomSetPanelState,
  ClassifierCategoryPanelState,
  ClassifierLevelPanelState,
  GisPanelState,
  CategorySelectPanelState,
  PropertyTablePanelState,
  SmartViewsPanelState,
  ViewpointsPanelState,
  ClipperPanelState
} from "../../../sections";

type Viewport = {
  name: "viewport";
  state: {};
};

export type Models = {
  name: "models";
  state: ModelsPanelState;
};

export type ItemsData = {
  name: "itemsData";
  state: ItemsDataPanelState;
};

export type CustomSet = {
  name: "customSet";
  state: CustomSetPanelState;
};

export type ClassifierCategory = {
  name: "classifier-category";
  state: ClassifierCategoryPanelState;
};

export type ClassifierLevel = {
  name: "classifier-level";
  state: ClassifierLevelPanelState;
};

export type Gis = {
  name: "gis";
  state: GisPanelState;
};

export type CategorySelect = {
  name: "category-select";
  state: CategorySelectPanelState;
};

export type PropertyTablePanel = {
  name: "property";
  state: PropertyTablePanelState;
};

export type Minimap = {
  name: "minimap";
  state: { components: OBC.Components };
};

export type SmartViewsPanel = {
  name: "smartViews";
  state: SmartViewsPanelState;
};

export type ViewpointPanel = {
  name: "viewpointPanel";
  state: ViewpointsPanelState;
};

export type ClipperPanel = {
  name: "clipperPanel";
  state: ClipperPanelState;
};

type BimpageGridSidebarElements = [
  Viewport,
  Models,
  ItemsData,
  CustomSet,
  ClassifierCategory,
  ClassifierLevel,
  Gis,
  CategorySelect,
  PropertyTablePanel,
  Minimap,
  SmartViewsPanel,
  ViewpointPanel,
  ClipperPanel
];

type BimpageGridSidebarLayouts = [
  "Viewer",
  "Models",
  "Query",
  "GIS",
  "Data",
  "Property",
  "Minimap",
  "Smart View",
  "Viewpoint",
  "Clipper"
];

export type BimpageGridSidebar = BUI.Grid<
  BimpageGridSidebarLayouts,
  BimpageGridSidebarElements
>;

