import { useState, useEffect } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import * as THREE from "three";
import * as OBC from "@thatopen/components";

export function ViewportSettings() {
  const { world, components } = useBimStore();
  const camera = world?.camera as any;
  const [projection, setProjection] = useState<"Perspective" | "Orthographic">("Perspective");

  // Keep state in sync with actual camera projection if it changes elsewhere
  useEffect(() => {
    if (!world || !camera) return;
    setProjection(camera.projection.current);
  }, [world, camera]);

  if (!world) return null;

  const handleTopView = async () => {
    if (!camera || !camera.controls) return;
    const controls = camera.controls;

    const target = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 1, 0.001); // offset to prevent gimbal lock
    direction.normalize();

    let distance = 20;
    const boxer = components?.get(OBC.BoundingBoxer);
    const fragments = components?.get(OBC.FragmentsManager);

    if (boxer && fragments && fragments.list.size > 0) {
      boxer.list.clear();
      boxer.addFromModels();
      const box = boxer.get();
      boxer.list.clear();

      box.getCenter(target);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      distance = maxDim * 1.5;
    } else {
      controls.getTarget(target);
      const position = new THREE.Vector3();
      controls.getPosition(position);
      distance = position.distanceTo(target);
      if (distance < 1) distance = 20;
    }

    controls.setLookAt(
      target.x + direction.x * distance,
      target.y + direction.y * distance,
      target.z + direction.z * distance,
      target.x,
      target.y,
      target.z,
      true
    );
  };

  const handleToggleProjection = async () => {
    if (!camera) return;
    const nextProj = projection === "Perspective" ? "Orthographic" : "Perspective";
    await camera.projection.set(nextProj);
    camera.updateAspect();
    if (world.renderer && (world.renderer as any).postproduction) {
      (world.renderer as any).postproduction.updateCamera();
    }
    setProjection(nextProj);
  };

  return (
    <div className="absolute top-5 left-5 z-20 flex flex-col gap-3">
      <div className="flex flex-col gap-1 p-1 border border-border bg-[oklch(14.5%_0.014_255_/_94%)] rounded-radius backdrop-blur-md">
        <button
          className="inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120"
          title="Top View"
          type="button"
          onClick={handleTopView}
        >
          <Icon name="MODEL" size={20} />
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 min-h-8 p-1 border border-transparent rounded-radius bg-transparent text-muted cursor-pointer text-xs font-semibold hover:border-border hover:bg-surface-alt hover:text-fg transition-all duration-120"
          title={projection === "Perspective" ? "Switch to Orthographic" : "Switch to Perspective"}
          type="button"
          onClick={handleToggleProjection}
        >
          <Icon name="FOCUS" size={20} />
        </button>
      </div>
    </div>
  );
}

