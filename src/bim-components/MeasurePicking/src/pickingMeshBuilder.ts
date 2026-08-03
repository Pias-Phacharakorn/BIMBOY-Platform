import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";

/**
 * ThatOpen installs three-mesh-bvh's `computeBoundsTree`/`disposeBoundsTree` onto
 * `BufferGeometry.prototype` (and `acceleratedRaycast` onto `Mesh.prototype`), but
 * three-mesh-bvh is a transitive dependency whose type augmentation never reaches this
 * package — so neither method exists on `THREE.BufferGeometry` as far as TypeScript is
 * concerned. Both call sites still check at runtime rather than trusting this type.
 */
type BvhGeometry = THREE.BufferGeometry & {
  computeBoundsTree?: () => void;
  disposeBoundsTree?: () => void;
};

/** One model's extracted picking meshes, as cached by `MeasurePicking`. */
export interface PickingMeshEntry {
  meshes: THREE.Mesh[];
  /** Unique geometries owned by this entry — disposed when the entry is invalidated. */
  geometries: THREE.BufferGeometry[];
  /** Snapshot of the model's world matrix; a change means rebuild (e.g. the align tool moved it). */
  matrixKey: string;
}

export const matrixKeyOf = (matrix: THREE.Matrix4): string => matrix.elements.join(",");

export const disposeEntry = (entry: PickingMeshEntry) => {
  for (const geometry of entry.geometries) {
    const bvhGeometry = geometry as BvhGeometry;
    if (typeof bvhGeometry.disposeBoundsTree === "function") {
      bvhGeometry.disposeBoundsTree();
    }
    geometry.dispose();
  }
  entry.meshes.length = 0;
  entry.geometries.length = 0;
};

/**
 * Pull plain THREE meshes out of a fragments model's geometry, one per mesh instance, each
 * baked into world space and sharing a BVH-accelerated geometry per representation.
 *
 * Extraction pulls the *whole* model, which is slow on big ones — hence the caching and the
 * cancellation in `MeasurePicking`, which is the only intended caller.
 */
export const buildForModel = async (
  model: FRAGS.FragmentsModel,
): Promise<PickingMeshEntry> => {
  const meshes: THREE.Mesh[] = [];
  const geometries = new Map<number, THREE.BufferGeometry>();

  const idsWithGeometry = await model.getItemsIdsWithGeometry();
  const allMeshesData = await model.getItemsGeometry(idsWithGeometry);

  for (const meshData of allMeshesData) {
    for (const geomData of meshData) {
      if (
        !geomData.positions ||
        !geomData.indices ||
        !geomData.transform ||
        !geomData.representationId
      ) {
        continue;
      }

      const { representationId } = geomData;
      if (!geometries.has(representationId)) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(geomData.positions, 3),
        );
        geometry.setIndex(Array.from(geomData.indices));
        // BVH → accelerated raycast for the per-move `world.meshes` intersect.
        const bvhGeometry = geometry as BvhGeometry;
        if (typeof bvhGeometry.computeBoundsTree === "function") {
          bvhGeometry.computeBoundsTree();
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
