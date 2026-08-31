import * as OBC from "@thatopen/components";
import * as THREE from "three";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so
// vite-tsconfig-paths does not rewrite aliases inside this folder. Repo-wide convention here.
import { CursorSurface } from "../../CursorSurface";
import type { ClipAwareRaycaster } from "../../setup/src/clip-aware-raycaster";

/**
 * Drives the shared {@link CursorSurface} guide from pointer movement: one raycast per
 * `mousemove`, never more than one in flight.
 *
 * Deliberately **unsnapped** — it passes no `snappingClasses`, so the guide tracks the surface
 * under the cursor while the measurer's own picker resolves the snap separately. Two raycasts
 * per move, both worker-side.
 */
export class MeasureHoverManager {
  private readonly _components: OBC.Components;

  private _world: OBC.World | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _raycastInProgress = false;

  constructor(components: OBC.Components) {
    this._components = components;
  }

  attach(world: OBC.World) {
    this._world = world;
    this._canvas = world.renderer?.three?.domElement ?? null;
    this._cursorSurface.setWorld(world);
    this._canvas?.addEventListener("mousemove", this._onMouseMove);
  }

  detach() {
    this._canvas?.removeEventListener("mousemove", this._onMouseMove);
    this._canvas = null;
    this._cursorSurface.hide();
    this._world = null;
  }

  private get _cursorSurface() {
    return this._components.get(CursorSurface);
  }

  private _onMouseMove = () => {
    if (this._raycastInProgress || !this._world) return;
    this._raycastInProgress = true;

    const cursorSurface = this._cursorSurface;
    // Typed to the subclass, not to what `Raycasters.get()` declares: the pick below passes
    // `requireNormal`, which only `ClipAwareRaycaster` understands. `setupClipAwareRaycaster`
    // has already swapped the instance into `Raycasters.list` before any world is usable, so
    // this is the real type — the base signature is what is inaccurate.
    const raycaster = this._components
      .get(OBC.Raycasters)
      .get(this._world) as ClipAwareRaycaster;

    raycaster
      // The guide is *oriented* by the hit normal, so it needs the hit to carry one — and the
      // opt-out that guarantees that is also what keeps this cast off the GPU pick, where a
      // measurement line under the cursor decodes as a depth. See `ClipAwareRaycaster`.
      .castRay({ requireNormal: true })
      .then((result) => {
        const normal = result && this._worldNormalOf(result);
        if (result?.point && normal) {
          cursorSurface.update(result.point, normal);
        } else {
          cursorSurface.hide();
        }
      })
      .catch(() => {
        cursorSurface.hide();
      })
      .finally(() => {
        this._raycastInProgress = false;
      });
  };

  /**
   * Fragment hits carry a world-space `normal` already. Plain-THREE hits — only reachable when
   * a caller passes `items` — carry an object-space face normal, so it has to be taken into
   * world space before the guide can be oriented by it.
   */
  private _worldNormalOf(hit: THREE.Intersection): THREE.Vector3 | null {
    if (hit.normal) return hit.normal.clone();
    if (hit.face) {
      return hit.face.normal
        .clone()
        .transformDirection(hit.object.matrixWorld)
        .normalize();
    }
    return null;
  }
}
