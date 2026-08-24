import * as THREE from "three";

/** Where the sun sits, in the terms a person thinks in. */
export interface SunAngles {
  /** Compass direction, degrees. 0 = +X, 90 = +Z. */
  azimuth: number;
  /** Height above the horizon, degrees. Clamped away from 0 and 90 — see {@link applySun}. */
  elevation: number;
}

/**
 * Elevation is never allowed to reach the horizon or the zenith.
 *
 * At 0 deg the sun is level with the model and the shadow frustum degenerates to a sliver; at
 * 90 deg the sun direction is parallel to `Object3D.up`, so `DirectionalLight`'s internal
 * `lookAt` hits the same degenerate `cross(up, z)` that three.js patches by nudging `_z.z`
 * (the ~0.00573 deg error `check-gizmo-frames.mjs` documents for plan cuts). Keeping the sun off
 * both ends avoids the question entirely.
 */
const MIN_ELEVATION = 5;
const MAX_ELEVATION = 85;

/**
 * Positions the sun and fits its shadow camera to the model.
 *
 * A `DirectionalLight` casts through an **orthographic** frustum, and everything outside that box
 * receives no shadow at all — so the box has to enclose the model, and the tighter it is, the
 * sharper the shadow for a given map size. This fits it once to the whole model, which is what the
 * three.js Sponza example does: simple, stable, and it never needs recomputing while the camera
 * moves. The cost is resolution — one map spread across a site-scale bounding box is the thing most
 * likely to look blocky, and the fix is a bigger `mapSize`, not a different fit.
 *
 * @param light the sun
 * @param bounds world-space bounds of everything that should cast or receive
 * @param angles where to put it
 */
export const applySun = (
  light: THREE.DirectionalLight,
  bounds: THREE.Box3,
  angles: SunAngles,
) => {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  // Aim slightly above the model's middle: for a building, the interesting shadows are cast by
  // upper storeys onto lower ones, and centring on the true middle wastes half the frustum on
  // foundations. 0.2 of the height is the Sponza example's ratio.
  const targetY = center.y + size.y * 0.2;

  const elevation = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(angles.elevation, MIN_ELEVATION, MAX_ELEVATION),
  );
  const azimuth = THREE.MathUtils.degToRad(angles.azimuth);

  // Stand the sun off by the model's own footprint, so it clears the geometry at any angle.
  const radius = Math.max(size.x, size.z) || 1;
  const horizontal = Math.cos(elevation) * radius;
  const vertical = Math.sin(elevation) * radius;

  light.position.set(
    center.x + Math.cos(azimuth) * horizontal,
    targetY + vertical,
    center.z + Math.sin(azimuth) * horizontal,
  );
  light.target.position.set(center.x, targetY, center.z);
  light.target.updateMatrixWorld();

  // Half-extents of the shadow box, in light space. The diagonal of the footprint is the
  // worst case: at 45 deg azimuth the model presents its longest face to the light, and a box
  // fitted to x/z alone would clip the corners out of the shadow.
  const extent = Math.hypot(size.x, size.z) * 0.5 || 1;
  const camera = light.shadow.camera;
  camera.left = -extent;
  camera.right = extent;
  camera.top = extent;
  camera.bottom = -extent;
  camera.near = 0.1;
  // Depth has to cover standoff plus the model, or the far plane cuts the shadow off mid-building.
  camera.far = radius + size.y * 2 + 1;
  camera.updateProjectionMatrix();
};

/**
 * Sun direction as a unit vector, for `Sky`'s `sunPosition` uniform.
 *
 * ⚠️ Sky takes a **direction**, not the light's position, and it wants spherical coordinates where
 * phi is measured from the zenith — hence `90 - elevation` rather than elevation. Feeding it the
 * light's world position puts the sun disc in the wrong place and the horizon glow with it.
 */
export const sunDirection = (angles: SunAngles) => {
  const phi = THREE.MathUtils.degToRad(
    90 - THREE.MathUtils.clamp(angles.elevation, MIN_ELEVATION, MAX_ELEVATION),
  );
  const theta = THREE.MathUtils.degToRad(angles.azimuth);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
};
