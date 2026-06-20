// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import { 
  createWorld, 
  setupFragmentsManager, 
  setupIfcLoader, 
  setupHighlighter,
  setupHoverer,
  setupItemsFinder,
  setupMinimap,
  setupClipper,
  setupSmartViews
} from "./src";
import { PropertyTable } from "../PropertyTable";
import { SpotCoordinate } from "../SpotCoordinate";
import { CursurSurface } from "../CursurSurface";

export const setupComponents = async () => {
  BUI.Manager.init();
  CUI.Manager.init();

  const components = new OBC.Components();
  const { world, viewport } = createWorld(components)

  new CursurSurface(components);

  await setupIfcLoader(components)
  setupFragmentsManager(components, world)

  setupHighlighter(components, world)
  setupHoverer(components, world)
  setupItemsFinder(components)
  setupMinimap(components, world)
  setupClipper(components, world, viewport)
  setupSmartViews(components)

  
  new PropertyTable(components);
  new SpotCoordinate(components);


  components.init()

  // Disable Clipper immediately after components initialization to prevent default enabled state
  components.get(OBC.Clipper).enabled = false;

  // Set world for viewpoints component
  components.get(OBC.Viewpoints).world = world;

  return { components, viewport }
}
