import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

export const setupHoverer = (components: OBC.Components, world: OBC.World) => {
  const hoverer = components.get(OBF.Hoverer);
  hoverer.world = world;
  hoverer.enabled = true;

  // Hover pops in and out instead of animating. The vendor default fades opacity over
  // `fadeDuration` (200 ms), which only applies because our material is transparent — the
  // fade path is guarded on `material.transparent`. `fadeDuration` is ignored while this is
  // `false`. Available since `@thatopen/components-front` 3.4.4.
  hoverer.fade = false;

  // ⚠️ **Pick on settle, not on every move.** 3.4.4 replaced the Hoverer's old `delay = 100`
  // (a ~50 ms debounce before picking, plus 100 ms before the overlay) with `mode`, defaulting
  // to `MOUSE_MOVE` — continuous back-to-back picks, on the reasoning that "picking is fast
  // enough that there's no reason to wait for the cursor to settle". That holds for a demo
  // scene and not for this app: with 60 models loaded, moving the mouse alone took the
  // viewport from 50–60 fps to 25. Each pick is a GPU id pass plus a `readPixels` stall, and
  // it does not go through the render coalescer because it never calls `renderer.update()`.
  //
  // `MOUSE_STOP` settles for a hardcoded, private 30 ms — so this is *snappier* than the
  // pre-3.4.4 behaviour it restores, not a regression in feel. There is no dial between the
  // two modes; the settle window is not configurable.
  hoverer.mode = OBF.HovererMode.MOUSE_STOP;

  hoverer.material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthTest: false,
  });

  // Resolve transparent sorting/occlusion conflicts with other custom highlight materials
  const fragments = components.get(OBC.FragmentsManager);
  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    if (material.userData?.customId && material.transparent) {
      material.depthWrite = false;
      material.needsUpdate = true;
    }
  });

  return hoverer;
};

