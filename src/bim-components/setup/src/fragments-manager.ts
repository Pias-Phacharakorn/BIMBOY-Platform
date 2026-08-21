// @ts-nocheck
import * as OBC from "@thatopen/components"
import fragmentsWorkerUrl from "@thatopen/fragments/worker?url"

export const setupFragmentsManager = (components: OBC.Components, world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>) => {
  const fragments = components.get(OBC.FragmentsManager);
  // ⚠️ Resolved from node_modules through the package's own "./worker" export, NOT copied into
  // public/. A hand-copied `public/worker.mjs` is what this replaces: it was committed once and
  // never refreshed across the bump to @thatopen/fragments 3.4.3, so the main thread and the
  // worker were running different versions of the library that computes getSection() and
  // getCoordinates(). Importing it makes the version match a property of the build, not of
  // somebody remembering to re-copy a 3 MB binary.
  fragments.init(fragmentsWorkerUrl);

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
    // Ignore coordinate for now
    /*
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
    */

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

  // ⚠️ **Never pass `force` here.** `update(force)` means "finish all the models' pending
  // requests" — awaiting it on `controls.update`, which fires continuously through an orbit,
  // pins the render loop to the worker draining its whole streaming/LOD/culling queue every
  // event. On a large model that is the difference between ~10 fps while moving and the
  // ~80 fps the same view holds when still, and it gets worse the bigger the model.
  // The forced form belongs on discrete state changes (a load, a config change), which is
  // exactly how the vendor uses it: 36 of its 37 examples wire this event as a bare
  // `fragments.core.update()`, and none of them force it.
  const onControlsUpdate = async () => {
    await fragments.core.update();
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
