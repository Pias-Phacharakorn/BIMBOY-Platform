import * as OBC from "@thatopen/components";
import { SmartViews } from "../../SmartViews";

export const setupSmartViews = (component: OBC.Components) => {
  const smartViews = component.get(SmartViews);
  smartViews.list.set(OBC.UUID.create(), {
    name: "My Custom View",
    defaultVisibility: true,
    visibilityExceptions: {
      queries: new Set(["External Walls"]),
    },
    colors: {
      queries: {
        "#ef9a9a": new Set(["Walls"]),
        "#a5d6a7": new Set(["Doors & Windows"]),
      },
    },
  });
};
