import * as OBC from "@thatopen/components";
import * as THREE from "three";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so
// vite-tsconfig-paths does not rewrite aliases inside this folder. Repo-wide convention here.
import {
  PickingMeshEntry,
  buildForModel,
  disposeEntry,
  matrixKeyOf,
} from "./src/pickingMeshBuilder";

export * from "./src";

/** What an `attach()` call hands back so the caller can undo it. */
export interface MeasurePickingHandle {
  /** Remove this attachment's meshes from `world.meshes`. Leaves the cache warm. */
  detach(): void;
}

/**
 * CPU-side pickable geometry for vertex snapping, shared by every measure tool.
 *
 * The OBF measurers snap to real vertices in `SYNCHRONOUS` picker mode by raycasting against
 * `world.meshes`. Fragment models don't expose CPU geometry there, so this component extracts
 * plain THREE meshes from each model and adds them for as long as a tool is active. Extraction
 * pulls the whole model — multi-second on big ones — so:
 *
 * - callers run `attach()` in the background; it never blocks the cursor guide,
 * - entries are cached per model id, so re-activating a tool doesn't re-extract,
 * - concurrent builds for the same model are deduplicated, so switching Length↔Area mid-build
 *   shares one build instead of extracting twice and leaking one BVH,
 * - each unique geometry gets a BVH, keeping the per-move `intersect()` over `world.meshes` fast.
 *
 * **Why this is a component and not module-level functions:** the cache is shared by every
 * cursor, so it must outlive any one of them. When it lived in module scope each cursor's
 * `dispose()` cleared it, which freed the geometry and BVHs that another cursor's
 * still-attached meshes pointed at. As instance state it is freed exactly once, by
 * `dispose()` at world teardown.
 *
 * ⚠️ **Known limitation:** callers attach once, when their tool is switched on, so a model
 * loaded *while* a measure tool is active gets no picking meshes until the tool is toggled off
 * and on. Closing that gap means re-attaching on `fragments.list.onItemSet`, and belongs here
 * rather than in any one cursor.
 */
export class MeasurePicking extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "6b0f2d84-7c31-4a52-9d18-3f5b0c7e41a9" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();

  private readonly _cache = new Map<string, PickingMeshEntry>();
  /** In-flight builds keyed by model id, so overlapping activations share one build. */
  private readonly _inFlight = new Map<string, Promise<PickingMeshEntry>>();

  constructor(components: OBC.Components) {
    super(components);
    components.add(MeasurePicking.uuid, this);
  }

  /**
   * Ensure BVH-accelerated picking meshes for every loaded model are present in `world.meshes`,
   * building and caching as needed.
   *
   * Runs asynchronously; pass `isCancelled()` — e.g. the tool was switched off before the build
   * finished — so it stops early instead of leaving meshes behind.
   */
  async attach(
    world: OBC.World,
    isCancelled: () => boolean,
  ): Promise<MeasurePickingHandle> {
    const fragments = this.components.get(OBC.FragmentsManager);

    // Drop cache entries for models that are no longer loaded.
    const liveIds = new Set<string>(fragments.list.keys());
    for (const [id, entry] of [...this._cache.entries()]) {
      if (!liveIds.has(id)) {
        disposeEntry(entry);
        this._cache.delete(id);
      }
    }

    const added: THREE.Mesh[] = [];

    try {
      for (const [id, model] of fragments.list) {
        if (isCancelled()) break;

        let entry = this._cache.get(id);
        const currentKey = matrixKeyOf(model.object.matrixWorld);
        if (entry && entry.matrixKey !== currentKey) {
          // Model moved (e.g. via the align tool) since caching — rebuild.
          disposeEntry(entry);
          this._cache.delete(id);
          entry = undefined;
        }

        if (!entry) {
          // Reuse an in-flight build for this id if one is already running; otherwise start
          // one, cache the result, and clear the in-flight slot.
          let buildPromise = this._inFlight.get(id);
          if (!buildPromise) {
            buildPromise = buildForModel(model)
              .then((built) => {
                this._cache.set(id, built);
                return built;
              })
              .finally(() => this._inFlight.delete(id));
            this._inFlight.set(id, buildPromise);
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
      detach: () => {
        for (const mesh of added) {
          world.meshes.delete(mesh);
        }
        added.length = 0;
      },
    };
  }

  /**
   * Free every cached geometry and BVH. Does not touch `world.meshes` — deactivating a tool
   * already detaches its meshes; this only releases the retained geometry.
   */
  dispose() {
    for (const entry of this._cache.values()) disposeEntry(entry);
    this._cache.clear();
    this._inFlight.clear();

    this.onDisposed.trigger(MeasurePicking.uuid);
    this.onDisposed.reset();
  }
}
