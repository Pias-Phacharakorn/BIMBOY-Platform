import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

/**
 * A plain-text snapshot of what is actually in the viewport: every loaded model with where it sits
 * and how it is coordinated, every clipping plane, every non-model object in the scene, and every
 * `ClipEdges` fill mesh with where it renders.
 *
 * ## Why this exists as a shipped feature
 *
 * It began as a throwaway probe and earned its keep. A cut plane's grey fill was rendering
 * detached from the geometry it cut, and six rounds of reasoning from screenshots produced three
 * confident, wrong diagnoses — a stale FRAGS worker, a vendor cache race, a leaked
 * `TechnicalDrawing`. What settled it in one run was reading the numbers below: every model sat at
 * `firstFinished.coords − own`, every fill at `firstStarted.coords − own`, and the constant
 * difference between those two "first model" rules was the displacement.
 * → [ADR-0015](../../../../docs/adr/0015-one-base-model-for-coordination.md).
 *
 * ⚠️ **It is a snapshot, never live.** {@link buildSceneReport} walks the scene and runs
 * `Box3.setFromObject` over 200k-vertex fill buffers, so it is recomputed only when the panel is
 * opened or Refresh is pressed. Do not put it on a frame loop or an event.
 */

/** Vector to one decimal — enough to compare a model against its fill, short enough to read on a phone. */
const v = (vec: THREE.Vector3) =>
  `${vec.x.toFixed(1)}, ${vec.y.toFixed(1)}, ${vec.z.toFixed(1)}`;

/** Where an object actually renders — the only thing comparable to a model's own box. */
const renderedCenter = (object: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(object);
  return box.isEmpty() ? "(empty)" : v(box.getCenter(new THREE.Vector3()));
};

export async function buildSceneReport(components: OBC.Components): Promise<string> {
  const fragments = components.get(OBC.FragmentsManager);
  const styler = components.get(OBF.ClipStyler);
  const clipper = components.get(OBC.Clipper);
  const out: string[] = [];

  // ⚠️ The load-bearing line. This must name the model sitting at pos [0, 0, 0]: FRAGS coordinates
  // every model against the first to *finish* loading, OBC against the first to *start*. When they
  // disagree, every section fill is displaced from its model by the difference — see ADR-0015.
  out.push(`base model: ${fragments.baseCoordinationModel || "(none)"}`);

  // --- models -------------------------------------------------------------
  let modelCount = 0;
  out.push("", "== MODELS ==");
  for (const [modelId, model] of fragments.list) {
    modelCount++;
    let coords = "(failed)";
    try {
      coords = (await model.getCoordinates())
        .slice(0, 3)
        .map((n: number) => n.toFixed(1))
        .join(", ");
    } catch {
      // A model still loading has no coordinates yet — reported as-is rather than hidden.
    }
    const box = model.box;
    out.push(
      `${modelId}`,
      `   visible=${model.object.visible} inScene=${!!model.object.parent}` +
        ` pos=[${v(model.object.position)}]`,
      `   boxCenter=[${box && !box.isEmpty() ? v(box.getCenter(new THREE.Vector3())) : "(empty)"}]` +
        ` coords=[${coords}]`,
    );
  }
  out.push(`(${modelCount} models)`);

  // --- clipping planes ----------------------------------------------------
  // Includes planes created outside ClipperCursor — the Drawing Editor's
  // `_updateSectionClip` makes one directly on OBC.Clipper with visible=false.
  out.push("", "== PLANES ==");
  let planeCount = 0;
  for (const [planeId, plane] of clipper.list) {
    planeCount++;
    out.push(
      `${planeId.slice(0, 8)} enabled=${plane.enabled} visible=${plane.visible}` +
        ` n=[${v(plane.normal)}] c=${plane.three.constant.toFixed(1)}`,
    );
  }
  out.push(`(${planeCount} planes)`);

  // --- scene graph --------------------------------------------------------
  // Everything in world.scene that is not a model, so an unexpected object can be identified
  // rather than guessed at from a screenshot. `layer1` is here because
  // `TechnicalDrawings.create()` does `cam.three.layers.enable(1)` on the main camera and nothing
  // ever disables it — an object on layer 1 outliving its drawing would render forever.
  out.push("", "== SCENE (top-level, non-model) ==");
  const world = [...components.get(OBC.Worlds).list.values()][0] as OBC.World | undefined;
  const scene = world?.scene?.three;
  if (!scene) {
    out.push("(no world/scene)");
  } else {
    const cam = world?.camera?.three as THREE.Camera | undefined;
    out.push(`camera layers mask: ${cam ? cam.layers.mask : "?"} (1 = layer 0 only, 3 = layers 0+1)`);

    const modelObjects = new Set<THREE.Object3D>();
    for (const [, model] of fragments.list) modelObjects.add(model.object);

    for (const child of scene.children) {
      if (modelObjects.has(child)) continue;
      let meshes = 0;
      let lines = 0;
      let onLayer1 = 0;
      const colors = new Set<string>();
      child.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
        const col = (mat as THREE.MeshBasicMaterial | undefined)?.color;
        if (col) colors.add(`#${col.getHexString()}`);
        if ((o as THREE.Mesh).isMesh) meshes++;
        if ((o as THREE.Line).isLine) lines++;
        if (o.layers.isEnabled(1)) onLayer1++;
      });
      out.push(
        `${child.type}${child.name ? ` "${child.name}"` : ""} visible=${child.visible}`,
        `   meshes=${meshes} lines=${lines} layer1=${onLayer1} colors=${[...colors].join(",") || "-"}`,
        `   at=[${renderedCenter(child)}]`,
      );
    }
  }

  // --- fills --------------------------------------------------------------
  // `children` above `modelCount` means `ClipEdges.getStyleMeshes` lost a cache race — it awaits
  // between its cache check and its cache write, so two concurrent `updateMeshes` calls for one
  // model can both build a mesh and both add it, and the loser is never updated again.
  out.push("", "== FILLS ==");
  for (const [edgesId, edges] of styler.list) {
    const children = edges.three.children;
    const verdict = children.length > modelCount ? "  <<< MORE THAN MODELS" : "";
    out.push(
      `${edgesId.slice(0, 8)} visible=${edges.visible} inScene=${!!edges.three.parent}` +
        ` children=${children.length}/${modelCount}${verdict}`,
    );
    children.forEach((child, i) => {
      const position = (child as THREE.Mesh).geometry?.getAttribute?.("position");
      out.push(
        `   [${i}] ${child.type} verts=${position ? position.count : 0}` +
          ` at=[${renderedCenter(child)}]`,
      );
    });
  }

  return out.join("\n");
}
