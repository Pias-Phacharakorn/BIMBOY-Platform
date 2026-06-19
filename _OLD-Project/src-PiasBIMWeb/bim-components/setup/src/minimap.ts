import * as OBC from "@thatopen/components";
import { MiniMap } from "../../MiniMap";

export function setupMinimap(components: OBC.Components, world: OBC.World) {
  const minimap = new MiniMap(components);
  minimap.setWorld(world);
  return minimap;
}
