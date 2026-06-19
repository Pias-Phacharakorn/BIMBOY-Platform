import * as OBC from "@thatopen/components"

export const setupFragmentsManager = (components: OBC.Components, world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>) => {
  const fragments = components.get(OBC.FragmentsManager);
  // The worker is set from the node_modules for simplicity purposes.
  // To build the app, the worker file should be set inside the public folder
  // at the root of the project and be referenced as "worker.mjs"
  fragments.init("/worker.mjs");

  fragments.list.onItemSet.add(async ({ value: model }) => {
    // Clears the ItemsFinder cache, so the next time a query
    // is run, it does the search again to include the results from the 
    // new model
    const finder = components.get(OBC.ItemsFinder)
    for (const [, query] of finder.list) {
      query.clearCache()
    }
    
    // useCamera is used to tell the model loaded the camera it must use in order to 
    // update its culling and LOD state.
    // Culling is the process of not rendering what the camera doesn't see.
    // LOD stands from Level of Detail in 3D graphics (not BIM) and is used
    // to decrease the geometry detail as the camera goes further from the element.
    model.useCamera(world.camera.three);

    // The model is added to the world scene.
    world.scene.three.add(model.object);

    // Set the grid height based on the BIM model's shared coordinate elevation height
    try {
      const [, coordHeight] = await model.getCoordinates();
      if (coordHeight !== undefined && !isNaN(coordHeight)) {
        const grids = components.get(OBC.Grids);
        const worldGrid = grids.list.get(world.uuid);
        if (worldGrid) {
          worldGrid.three.position.y = coordHeight;
        }
      }
    } catch (e) {
      console.warn("Could not retrieve coordinate height from model", e);
    }

    // This is extremely important, as it instructs the Fragments Manager
    // the model must be updated because the configuration changed.
    await fragments.core.update(true);
  })

  const onCameraChange = async (camera: any) => {
    for (const [, model] of fragments.list) {
      model.useCamera(camera.three);
    }
    await fragments.core.update(true);
  };

  const onControlsUpdate = async () => {
    await fragments.core.update(true);
  };

  world.onCameraChanged.add(onCameraChange);
  world.camera.controls.addEventListener("update", onControlsUpdate);

  fragments.onDisposed.add(() => {
    try {
      world.onCameraChanged.remove(onCameraChange);
      world.camera.controls.removeEventListener("update", onControlsUpdate);
    } catch (e) {
      // Ignore: camera/world was already disposed
    }
  });
}