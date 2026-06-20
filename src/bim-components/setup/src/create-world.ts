// @ts-nocheck
import * as OBC from "@thatopen/components"
import * as THREE from "three"
import * as BUI from "@thatopen/ui"
import * as OBF from "@thatopen/components-front"

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
  grid.three.raycast = () => null;

  return { world, viewport }
}
