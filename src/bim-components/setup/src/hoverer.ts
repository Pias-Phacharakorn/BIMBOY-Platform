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

