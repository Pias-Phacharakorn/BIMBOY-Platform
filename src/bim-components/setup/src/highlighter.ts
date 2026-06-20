// @ts-nocheck
import * as OBC from "@thatopen/components"
import * as OBF from "@thatopen/components-front"
import * as THREE from "three";

export const setupHighlighter = (components: OBC.Components, world: OBC.World) => {
  const highlighter = components.get(OBF.Highlighter)
  
  // Disable the default material color overlay to let the outliner shine
  highlighter.setup({
    world,
    selectMaterialDefinition: null
  });

  // Enable postproduction required for the outliner
  const { postproduction } = world.renderer as any;
  if (postproduction) {
    postproduction.enabled = true;
  }

  // Set up the Outliner
  const outliner = components.get(OBF.Outliner);
  outliner.world = world;
  // green: #bcf124
  // blue: #24a6f1

  outliner.color = new THREE.Color("#bcf124");
  outliner.fillColor = new THREE.Color("#bcf124");
  outliner.fillOpacity = 0.3;
  outliner.enabled = true;

  // Link highlighter selection events directly to the outliner
  highlighter.events.select.onHighlight.add((modelIdMap) => {
    outliner.addItems(modelIdMap);
  });

  highlighter.events.select.onClear.add((modelIdMap) => {
    outliner.removeItems(modelIdMap);
  });
}
