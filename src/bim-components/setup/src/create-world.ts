// @ts-nocheck
import * as OBC from "@thatopen/components"
import * as THREE from "three"
import * as BUI from "@thatopen/ui"
import * as OBF from "@thatopen/components-front"
import { applyCameraDepthRange } from "./camera-depth-range"

export const createWorld = (components: OBC.Components) => {
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBF.PostproductionRenderer
  >()

  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = null; // transparent background
  world.scene.config.directionalLight.intensity = 1.0
  world.scene.config.ambientLight.intensity = 1.5

  const viewport = BUI.Component.create<BUI.Viewport>(
    () => {
      return BUI.html`<bim-viewport></bim-viewport>`
    },
  );

  // Prevent WebGL zero-size framebuffer errors during initial layout
  viewport.style.minWidth = "1px";
  viewport.style.minHeight = "1px";

  world.renderer = new OBF.PostproductionRenderer(components, viewport);

  world.camera = new OBC.OrthoPerspectiveCamera(components);

  // OBC builds its perspective camera with a 1 m near plane, so anything closer is clipped away.
  // Re-applied on every camera change because each OBC.View brings its own camera —
  // see camera-depth-range.ts.
  applyCameraDepthRange(world.camera);
  world.onCameraChanged.add(applyCameraDepthRange);

  const resizeWorld = () => {
    try {
      world.renderer?.resize();
      world.camera.updateAspect();
    } catch (error) {
      console.warn("Resizing the world was not possible")
    }
  };
  
  viewport.addEventListener("resize", resizeWorld);

  components.get(OBC.Raycasters).get(world);

  const grids = components.get(OBC.Grids);
  const grid = grids.create(world);
  grid.config.color = new THREE.Color("#666666");
  grid.config.primarySize = 1;
  grid.config.secondarySize = 10;
  // Off by default — OBC ships the grid visible, but it competes with the model for
  // attention and reads as scaffolding in screenshots. Viewport Settings → Grid turns
  // it back on per session (ToolbarSettings seeds its checkbox from this value).
  // Set through `config`, not `three.visible`: the config setter also drives the
  // component's own setter, which adds/removes the grid from the scene.
  grid.config.visible = false;
  grid.three.raycast = () => null;

  return { world, viewport }
}
