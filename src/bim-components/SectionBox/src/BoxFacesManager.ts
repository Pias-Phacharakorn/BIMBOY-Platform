import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { BOX_FACES, BoxFace, BoxFaceId } from "./types";

/**
 * The six clipping planes, and the only thing in this component that talks to the renderer.
 *
 * **Bare `THREE.Plane`s pushed straight through `renderer.setPlane`**, not `OBC.Clipper`
 * planes. `OBC.Views` clips the same way, so this is a vendor-sanctioned path rather than a
 * shortcut. Going through `Clipper` would give each face a plane mesh, a helper *and* a
 * `TransformControls` whose arrow needs re-suppressing after every `visible` write, would put
 * six entries into `Clipper.list` — which `Clipper.size`/`material`/`visible` and
 * `getAllPlaneMeshes()` all iterate regardless of owner — and would consume `ClipperCursor`'s
 * whole `MAX_PLANES = 6` budget with a single box. → ADR-0005.
 *
 * Nothing here needs `Clipper.enabled`: that setter stores a flag and clips nothing (only
 * `SimplePlane.enabled` moves a plane in or out of the renderer), so the Clip menu cannot
 * reach a box.
 *
 * A plane's **normal points inward**, because three.js keeps the half-space where the signed
 * distance is positive and the box interior is what we want to survive.
 */
export class BoxFacesManager {
  private readonly _planes = new Map<BoxFaceId, THREE.Plane>();
  private _attached = false;

  constructor(private readonly _world: OBC.World) {
    for (const face of BOX_FACES) {
      this._planes.set(face.id, new THREE.Plane());
    }
  }

  get attached() {
    return this._attached;
  }

  /** Rewrites all six planes from the box. Safe to call every drag frame. */
  apply(box: THREE.Box3) {
    for (const face of BOX_FACES) {
      const plane = this._planes.get(face.id);
      if (!plane) continue;

      // Inward normal, and a point on this face's own bound. setFromNormalAndCoplanarPoint
      // works out the constant, so the sign only has to be right once, here.
      const normal = this._axisVector(face).multiplyScalar(-face.outward);
      const bound = face.outward === -1 ? box.min : box.max;
      const point = this._axisVector(face).multiplyScalar(bound[face.axis]);

      plane.setFromNormalAndCoplanarPoint(normal, point);
    }
  }

  /** Starts cropping. Idempotent. */
  attach() {
    const renderer = this._world.renderer;
    if (!renderer || this._attached) return;

    for (const [, plane] of this._planes) renderer.setPlane(true, plane);
    this._attached = true;
  }

  /** Stops cropping, leaving the planes intact so a re-enable costs nothing. Idempotent. */
  detach() {
    const renderer = this._world.renderer;
    if (!renderer || !this._attached) {
      // Still drop the flag: with no renderer there is nothing cropping anyway, and leaving it
      // true would make a later detach() a no-op and leak the crop.
      this._attached = false;
      return;
    }

    for (const [, plane] of this._planes) renderer.setPlane(false, plane);
    this._attached = false;
  }

  dispose() {
    this.detach();
    this._planes.clear();
  }

  private _axisVector(face: BoxFace) {
    return new THREE.Vector3(
      face.axis === "x" ? 1 : 0,
      face.axis === "y" ? 1 : 0,
      face.axis === "z" ? 1 : 0,
    );
  }
}
