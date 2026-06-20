// @ts-nocheck
import * as OBC from "@thatopen/components";

export interface ViewColors {
  queries?: Record<string, Set<string>>;
  items?: Record<string, OBC.ModelIdMap>;
}

export interface ViewExceptions {
  queries?: Set<string>;
  items?: OBC.ModelIdMap;
}

export interface SmartView {
  name: string;
  colors: ViewColors;
  // Default item visibility behavior
  // If not set, everything will visible(see exceptions)
  defaultVisibility: boolean;
  // Items except from the visibility rule
  // If visibility is false, all items will be hidden unless those in exceptions
  // If visibility is true, all items will be hidden unless those in exceptions
  visibilityExceptions: ViewExceptions;
}

