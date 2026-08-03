import * as OBC from "@thatopen/components";
import * as THREE from "three";
import type { RaycastResult } from "@thatopen/fragments";

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
 * **Limits, deliberate.** `snappingClasses` and `useFastModelPicking` delegate to the base
 * class: nothing in this app uses either (fast picking defaults to `false`), and covering
 * them would mean forking those branches of vendored 3.4.x logic. ⚠️ Whoever first enables
 * `useFastModelPicking` gets the old, clip-blind behaviour back and will need this override
 * extended.
 */
export class ClipAwareRaycaster extends OBC.SimpleRaycaster {
  /** {@inheritDoc OBC.SimpleRaycaster.castRay} */
  async castRay(data?: {
    items?: THREE.Mesh[];
    position?: THREE.Vector2;
    snappingClasses?: any[];
  }) {
    const planes = this.world.renderer?.three.clippingPlanes;

    // Fast path: with nothing clipped there is nothing to filter, so keep the vendor's
    // optimised call. This matters — Hoverer raycasts on every pointermove.
    if (
      !planes?.length ||
      data?.snappingClasses?.length ||
      this.useFastModelPicking
    ) {
      return super.castRay(data);
    }

    const camera = this.world.camera.three;
    const dom = this.world.renderer?.three.domElement;
    if (!dom) return super.castRay(data);

    const position = data?.position ?? this.mouse.position;
    const nearestFragment = await this._nearestVisibleFragment(camera, dom, planes);

    // Merge with the plain-THREE items path, as the base class does. Its own `intersect()`
    // is private in the published types, so the same filter is applied here instead —
    // `intersectObjects` returns hits sorted by distance, so the first survivor is nearest.
    const items = data?.items ?? Array.from(this.world.meshes);
    if (items.length === 0) return nearestFragment;

    this.three.setFromCamera(position, camera);
    const itemsHit =
      this.three.intersectObjects(items).find((hit) => this._isVisible(hit.point, planes)) ??
      null;

    if (!nearestFragment) return itemsHit;
    if (!itemsHit) return nearestFragment;
    return itemsHit.distance < nearestFragment.distance ? itemsHit : nearestFragment;
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
   * `FragmentsModel`, not on the manager, so this fans out per model and merges.
   */
  private async _nearestVisibleFragment(
    camera: THREE.Camera,
    dom: HTMLCanvasElement,
    planes: readonly THREE.Plane[],
  ): Promise<RaycastResult | null> {
    const fragments = this.components.get(OBC.FragmentsManager);
    if (!fragments.initialized) return null;

    const models = Array.from(fragments.list.values());
    if (models.length === 0) return null;

    const perModel = await Promise.all(
      models.map((model) =>
        model
          .raycastAll({
            camera: camera as THREE.PerspectiveCamera | THREE.OrthographicCamera,
            dom,
            mouse: this.mouse.rawPosition,
          })
          .catch(() => null),
      ),
    );

    let nearest: RaycastResult | null = null;
    for (const hits of perModel) {
      if (!hits) continue;
      for (const hit of hits) {
        if (!this._isVisible(hit.point, planes)) continue;
        if (!nearest || hit.distance < nearest.distance) nearest = hit;
      }
    }
    return nearest;
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
