import * as OBC from "@thatopen/components";
import * as THREE from "three";
import type { RaycastData, RaycastResult, SnappingClass } from "@thatopen/fragments";

/** Nearest hit by `distance`, skipping nulls. */
const nearestOf = <T extends { distance: number }>(
  hits?: readonly (T | null | undefined)[] | null,
): T | null => {
  let nearest: T | null = null;
  for (const hit of hits ?? []) {
    if (hit && (!nearest || hit.distance < nearest.distance)) nearest = hit;
  }
  return nearest;
};

/**
 * A raycaster that ignores geometry the clipping planes have already removed.
 *
 * **Why this exists.** `OBC.SimpleRaycaster.castRay()` is not clipping-aware for model
 * geometry. Its own `filterClippingPlanes` is applied only to the plain-THREE `items` path;
 * the fragment hit is returned raw:
 *
 * ```js
 * c = await fragments.raycast({ camera, dom, mouse });
 * if (items.length === 0) return c;   // <- unfiltered
 * const u = this.intersect(items);    // <- only this is filtered
 * ```
 *
 * (Its JSDoc claims otherwise — that claim holds for `items` only.) A clip is a render-time
 * operation: the GPU discards fragments past the plane, but the geometry stays in the model
 * and in its raycast data. So looking *into* a cut, the removed half sits between the camera
 * and the surface you clicked, the ray hits it first, and the highlighter selects something
 * invisible. Symptom: cut the roof off, click a revealed element, the roof selects.
 *
 * Fixing it here rather than at the highlighter fixes every consumer at once — selection,
 * hover, the three measure cursors, `SpotCoordinate`, and the section tool's own plane
 * placement, which would otherwise place a plane on removed geometry.
 *
 * **Snapping goes through here too.** The measure tools' vertex picker asks for
 * `snappingClasses`, which routes to `FragmentsModel.raycastWithSnapping` — worker-side point
 * and edge snapping, equally clip-blind, so an element straddling a plane still offers
 * vertices on its removed half. The snap path filters those out per point, and falls through
 * to the plain path when clipping kills every candidate, so a revealed cut face stays
 * measurable.
 *
 * ⚠️ **Why the worker cannot filter for us:** `FragmentsModel.getClippingPlanesEvent` defaults
 * to `() => []` and nothing in this app sets it, so the planes never reach the worker and it
 * culls at *no* level — not even by bounding box. Wiring that event to
 * `renderer.clippingPlanes` would move this filtering off the main thread and shrink this
 * override to almost nothing, but the worker only refreshes its view on
 * `fragments.core.update()`, so the section tool would have to pump it on every plane
 * move/toggle or snap silently against stale planes. It also feeds tile-streaming culling.
 * A real option, deliberately not taken here.
 *
 * ⚠️ **The `useFastModelPicking` opt-out is gone.** Up to 3.4.2 this guard also delegated to
 * the base class whenever that flag was set; nothing here ever set it, so the term was always
 * false. 3.4.8 deletes the flag outright and makes the GPU pick path unconditional for
 * non-snap raycasts, so the term was removed rather than replaced. The clip-blind behaviour it
 * used to describe is no longer opt-in — if the vendor's fast path now short-circuits the
 * raycast data this override reads, selection into a cut regresses for every consumer at once.
 */
export class ClipAwareRaycaster extends OBC.SimpleRaycaster {
  /** {@inheritDoc OBC.SimpleRaycaster.castRay} */
  async castRay(data?: {
    items?: THREE.Mesh[];
    position?: THREE.Vector2;
    snappingClasses?: SnappingClass[];
  }) {
    const renderer = this.world.renderer?.three;
    const planes = renderer?.clippingPlanes;

    // Fast path: with nothing clipped there is nothing to filter, so keep the vendor's
    // optimised call. This matters — Hoverer raycasts on every pointermove.
    if (!renderer || !planes?.length) {
      return super.castRay(data);
    }

    const nearestFragment = await this._nearestVisibleFragment(
      {
        camera: this.world.camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera,
        dom: renderer.domElement,
        mouse: this.mouse.rawPosition,
      },
      planes,
      data?.snappingClasses,
    );

    // Merge with the plain-THREE items path, as the base class does. `castRayToObjects` is the
    // vendor's own public form of it and already applies `filterClippingPlanes`, so there is
    // nothing to reimplement here. `world.meshes` is empty in this app, so the common case is
    // the early return.
    const items = data?.items;
    if (!items?.length && this.world.meshes.size === 0) return nearestFragment;

    const itemsHit = this.castRayToObjects(items, data?.position);

    // Fragment first, so a tie keeps the fragment — as the base class does.
    return nearestOf([nearestFragment, itemsHit]);
  }

  /**
   * Whether a point survives the clipping planes — the same test the GPU applies, and the
   * same one `SimpleRaycaster.filterClippingPlanes` uses: it must be on every plane's
   * positive side.
   */
  private _isVisible(point: THREE.Vector3, planes: readonly THREE.Plane[]) {
    return planes.every((plane) => plane.distanceToPoint(point) > 0);
  }

  /**
   * Nearest fragment hit that survives every clipping plane. `raycastAll` lives on
   * `FragmentsModel`, not on the manager, so this fans out per model and merges by distance —
   * concurrently, unlike `FragmentsManager.raycast`, which awaits each model in turn.
   *
   * ⚠️ **The snap→plain fallback is per model, not global**, mirroring
   * `FragmentsManager.raycast`. Deciding it globally — "did *any* model snap?" — starves the
   * models that lost every candidate to a clipping plane: with two coordinated models and a
   * section active, a far snap on one would suppress the near cut face on the other, which is
   * exactly the geometry the user is pointing at.
   *
   * Why the vendor's own fan-out can't just be called: it collapses each model to one hit
   * (`raycastWithSnapping[0]`, else `model.raycast`) before returning, and filtering needs the
   * whole candidate list.
   */
  private async _nearestVisibleFragment(
    args: RaycastData,
    planes: readonly THREE.Plane[],
    snappingClasses?: SnappingClass[],
  ): Promise<RaycastResult | null> {
    const fragments = this.components.get(OBC.FragmentsManager);
    if (!fragments.initialized || fragments.list.size === 0) return null;

    const visible = (hit: RaycastResult) => this._isVisible(hit.point, planes);
    const perModel: Promise<RaycastResult | null>[] = [];

    for (const model of fragments.list.values()) {
      perModel.push(
        (async () => {
          // ⚠️ Order matters within a model: `raycastWithSnapping` returns candidates in the
          // worker's snap-priority order — which vertex or edge you were actually aiming at —
          // and `FragmentsManager.raycast` takes `[0]`. So take the first *survivor*, never
          // the closest: re-sorting by distance would let a far corner vertex beat the near
          // edge under the cursor.
          if (snappingClasses?.length) {
            const candidates = await model
              .raycastWithSnapping({ ...args, snappingClasses })
              .catch(() => null);
            const snapped = candidates?.find(visible);
            if (snapped) return snapped;
          }

          const hits = await model.raycastAll(args).catch(() => null);
          return nearestOf(hits?.filter(visible));
        })(),
      );
    }

    return nearestOf(await Promise.all(perModel));
  }
}

/**
 * Replaces the world's raycaster with the clip-aware one.
 *
 * `Raycasters.get()` is what registers the `world.onDisposed → delete(world)` teardown hook,
 * so it is called first and the instance swapped afterwards — teardown then disposes ours.
 * Safe to run after `create-world.ts` has already created the default, because every
 * consumer resolves `Raycasters.get(world)` per pick rather than caching the instance.
 */
export const setupClipAwareRaycaster = (components: OBC.Components, world: OBC.World) => {
  const raycasters = components.get(OBC.Raycasters);

  raycasters.get(world);
  raycasters.list.get(world.uuid)?.dispose();
  raycasters.list.set(world.uuid, new ClipAwareRaycaster(components, world));
};
