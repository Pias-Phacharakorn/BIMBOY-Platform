// @ts-nocheck
import * as OBC from "@thatopen/components"
import * as OBF from "@thatopen/components-front"

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

  // Set up the Outliner. Wiring only — its colours, fill opacity and thickness are part of the
  // app's default render look and are written by setupPostproduction, which runs next.
  const outliner = components.get(OBF.Outliner);
  outliner.world = world;
  outliner.enabled = true;

  // Link highlighter selection events directly to the outliner
  highlighter.events.select.onHighlight.add((modelIdMap) => {
    outliner.addItems(modelIdMap);
  });

  highlighter.events.select.onClear.add((modelIdMap) => {
    outliner.removeItems(modelIdMap);
  });
}
