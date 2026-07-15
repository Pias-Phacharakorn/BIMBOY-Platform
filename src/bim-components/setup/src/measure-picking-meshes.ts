// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as THREE from "three";

// The OBF measurers snap to real vertices in SYNCHRONOUS picker mode by
// raycasting against `world.meshes`. Fragment models don't expose CPU geometry
// there, so we extract plain THREE meshes from each model's geometry and add
// them. That extraction pulls the whole model — slow on big models — so:
//   • callers run this in the background (it never blocks the cursor guide),
//   • results are cached per model id (re-activating a tool doesn't re-extract),
//   • each unique geometry gets a BVH so the per-move castRay `intersect()`
//     over world.meshes stays fast. ThatOpen installs `computeBoundsTree` on
//     `BufferGeometry.prototype` and `acceleratedRaycast` on `Mesh.prototype`,
//     so building the tree here is all that's needed to accelerate picking.

interface CacheEntry {
  meshes: THREE.Mesh[];
  /** Unique geometries owned by this entry (disposed on invalidation). */
  geometries: THREE.BufferGeometry[];
  /** Snapshot of the model's world matrix — rebuild if it changes (alignment). */
  matrixKey: string;
}

const cache = new Map<string, CacheEntry>();
// In-flight builds keyed by model id, so two overlapping activations (e.g.
// toggling the tool, or switching Length↔Area, during the multi-second build)
// share one build instead of both extracting and one leaking its BVH.
const inFlight = new Map<string, Promise<CacheEntry>>();

const matrixKeyOf = (m: THREE.Matrix4): string => m.elements.join(",");

const disposeEntry = (entry: CacheEntry) => {
  for (const geom of entry.geometries) {
    if (typeof (geom as any).disposeBoundsTree === "function") {
      (geom as any).disposeBoundsTree();
    }
    geom.dispose();
  }
  entry.meshes.length = 0;
  entry.geometries.length = 0;
};

const buildForModel = async (model: any): Promise<CacheEntry> => {
  const meshes: THREE.Mesh[] = [];
  const geometries = new Map<number, THREE.BufferGeometry>();

  const idsWithGeometry = await model.getItemsIdsWithGeometry();
  const allMeshesData = await model.getItemsGeometry(idsWithGeometry);

  for (const itemId in allMeshesData) {
    const meshData = allMeshesData[itemId];
    for (const geomData of meshData) {
      if (
        !geomData.positions ||
        !geomData.indices ||
        !geomData.transform ||
        !geomData.representationId
      ) {
        continue;
      }

      const representationId = geomData.representationId;
      if (!geometries.has(representationId)) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(geomData.positions, 3)
        );
        geometry.setIndex(Array.from(geomData.indices));
        // BVH → accelerated raycast for the per-move world.meshes intersect.
        if (typeof (geometry as any).computeBoundsTree === "function") {
          (geometry as any).computeBoundsTree();
        }
        geometries.set(representationId, geometry);
      }

      const geometry = geometries.get(representationId)!;
      const mesh = new THREE.Mesh(geometry);
      mesh.applyMatrix4(geomData.transform);
      mesh.applyMatrix4(model.object.matrixWorld);
      mesh.updateWorldMatrix(true, true);
      meshes.push(mesh);
    }
  }

  return {
    meshes,
    geometries: [...geometries.values()],
    matrixKey: matrixKeyOf(model.object.matrixWorld),
  };
};

export interface MeasurePickingHandle {
  /** Remove the picking meshes from world.meshes. Leaves the cache warm. */
  detach(): void;
}

/**
 * Ensure BVH-accelerated picking meshes for every loaded model are present in
 * `world.meshes` for synchronous vertex snapping, building & caching as needed.
 *
 * Runs asynchronously; pass `isCancelled()` (e.g. the tool was turned off before
 * the build finished) so it stops early without leaving meshes behind. Returns a
 * handle whose `detach()` removes the meshes again on deactivate.
 */
export const attachMeasurePickingMeshes = async (
  components: OBC.Components,
  world: OBC.World,
  isCancelled: () => boolean
): Promise<MeasurePickingHandle> => {
  const fragments = components.get(OBC.FragmentsManager);

  // Drop cache entries for models that are no longer loaded.
  const liveIds = new Set<string>(fragments.list.keys());
  for (const [id, entry] of [...cache.entries()]) {
    if (!liveIds.has(id)) {
      disposeEntry(entry);
      cache.delete(id);
    }
  }

  const added: THREE.Mesh[] = [];

  try {
    for (const [id, model] of fragments.list) {
      if (isCancelled()) break;

      let entry = cache.get(id);
      const currentKey = matrixKeyOf(model.object.matrixWorld);
      if (entry && entry.matrixKey !== currentKey) {
        // Model moved (e.g. via the align tool) since caching — rebuild.
        disposeEntry(entry);
        cache.delete(id);
        entry = undefined;
      }

      if (!entry) {
        // Reuse an in-flight build for this id if one is already running;
        // otherwise start one, cache the result, and clear the in-flight slot.
        let buildPromise = inFlight.get(id);
        if (!buildPromise) {
          buildPromise = buildForModel(model)
            .then((built) => {
              cache.set(id, built);
              return built;
            })
            .finally(() => inFlight.delete(id));
          inFlight.set(id, buildPromise);
        }
        try {
          entry = await buildPromise;
        } catch (err) {
          console.error("Failed to build measure picking meshes:", err);
          continue;
        }
      }

      if (isCancelled()) break;

      for (const mesh of entry.meshes) {
        world.meshes.add(mesh);
        added.push(mesh);
      }
    }
  } catch (err) {
    // Never leave partially-added meshes behind if the loop throws.
    for (const mesh of added) world.meshes.delete(mesh);
    throw err;
  }

  return {
    detach() {
      for (const mesh of added) {
        world.meshes.delete(mesh);
      }
      added.length = 0;
    },
  };
};

/**
 * Dispose every cached picking mesh (geometry + BVH) and clear the cache. Call
 * on viewport/world teardown so the module-global cache doesn't outlive the
 * models it was built from. Does not touch world.meshes — deactivate already
 * detaches the meshes; this only frees the retained geometry.
 */
export const clearMeasurePickingCache = () => {
  for (const entry of cache.values()) disposeEntry(entry);
  cache.clear();
};
