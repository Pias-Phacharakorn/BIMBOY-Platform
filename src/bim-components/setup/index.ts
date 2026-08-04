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
  setupClipAwareRaycaster,
  setupSmartViews,
  setupViews
} from "./src";
import { setupClipperCursor } from "../ClipperCursor";
import { AreaMeasureCursor, LengthMeasureCursor } from "../MeasureCursor";
import { SurfaceMeasureCursor } from "../SurfaceMeasureCursor";
import { GizmoAxis } from "../GizmoAxis";
import { SectionBox } from "../SectionBox";
import { PropertyTable } from "../PropertyTable";
import { SpotCoordinate } from "../SpotCoordinate";
import { CursorSurface } from "../CursorSurface";
import { CursorZoom } from "../CursorZoom";
import { GisLayers } from "../GisLayers";
import { DrawingEditorSetup } from "../DrawingEditorSetup";

export const setupComponents = async () => {
  BUI.Manager.init();
  CUI.Manager.init();

  const components = new OBC.Components();
  const { world, viewport } = createWorld(components)

  // Before anything that picks: OBC's raycaster is not clipping-aware for model geometry,
  // so a section would otherwise let selection/hover/measure hit the geometry it cut away.
  setupClipAwareRaycaster(components, world)

  new CursorSurface(components);

  await setupIfcLoader(components)
  setupFragmentsManager(components, world)

  setupHighlighter(components, world)
  setupHoverer(components, world)
  setupItemsFinder(components)
  setupMinimap(components, world)

  // Shared overlay-gizmo service. Must have its world before any consumer creates a gizmo.
  const gizmoAxis = new GizmoAxis(components)
  gizmoAxis.world = world

  // Navigation feel, not a tool: no toolbar entry, always on, idles outside Orbit mode.
  const cursorZoom = new CursorZoom(components)
  cursorZoom.world = world

  setupClipperCursor(components, world, viewport)

  // A crop volume, not a pointer tool: it never sets bimStore.activeTool, so it composes with
  // the section planes and the measure tools rather than excluding them.
  const sectionBox = new SectionBox(components)
  sectionBox.world = world
  sectionBox.viewport = viewport

  setupSmartViews(components)
  setupViews(components, world)

  const lengthMeasureCursor = new LengthMeasureCursor(components)
  lengthMeasureCursor.world = world
  const areaMeasureCursor = new AreaMeasureCursor(components)
  areaMeasureCursor.world = world
  const surfaceMeasureCursor = new SurfaceMeasureCursor(components)
  surfaceMeasureCursor.world = world


  new PropertyTable(components);
  const spotCoordinate = new SpotCoordinate(components);
  spotCoordinate.world = world;
  new GisLayers(components);
  new DrawingEditorSetup(components);


  components.init()

  // Disable Clipper immediately after components initialization to prevent default enabled state
  components.get(OBC.Clipper).enabled = false;

  // Set world for viewpoints component
  components.get(OBC.Viewpoints).world = world;

  return { components, viewport }
}
