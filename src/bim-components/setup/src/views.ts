// @ts-nocheck
import * as OBC from "@thatopen/components";

// OBC.Views is a built-in component — no custom subclass needed. This just wires
// the engine-level config (default world + range) into the singleton, matching
// setupMinimap/setupSmartViews. All 2D-view UI + generation lives in React
// (components/bim/Views2DList.tsx), which reads components.get(OBC.Views).
export function setupViews(components: OBC.Components, world: OBC.World) {
  const views = components.get(OBC.Views);
  views.world = world;
  // How far each 2D view "sees" — overridable per view instance after creation.
  OBC.Views.defaultRange = 100;
  return views;
}
