import * as THREE from "three";

/**
 * Band width as a fraction of the rectangle's **shorter** side.
 *
 * Model-relative rather than a fixed distance, so the proportion holds from a 5 m room to a 2 km
 * site — a constant in metres would swallow the first and vanish on the second, which is the
 * mistake `FALLBACK_PLANE_SIZE` made when a 10-unit outline sat inside a 40 m building. Taken from
 * the shorter side so a long thin footprint gets a band that still leaves an interior.
 *
 * ⚠️ **Accepted floor:** zoomed far enough out this is sub-pixel, and since the band is also the
 * click target for switching plane, it gets hard to hit there. The screen-constant arrow gizmo on
 * the selected plane and the Clip menu's plane list are the two fallbacks.
 */
const BAND_RATIO = 0.04;

/**
 * A closed rectangular ring in local XY: outer edge at `width` × `height`, inner edge inset by
 * {@link BAND_RATIO} of the shorter side. Centred on the origin — the caller positions it.
 *
 * This is what a cut plane draws instead of a fill. A band reads as a *surface* because it
 * foreshortens in perspective, which a 1px outline cannot do, while covering almost none of the
 * model — so it costs neither legibility nor a tinted view. It is also why the plane can be
 * clickable at all: [ADR-0002](../../../../docs/adr/0002-section-plane-outline-only.md) reversed a
 * pickable plane because one "grabbable anywhere it is visible is grabbable across most of the
 * screen", and a band is visible only around its perimeter.
 *
 * Built as a `Shape` with a rectangular hole and triangulated by `ShapeGeometry`, which emits a
 * flat XY mesh — already the plane's own frame, so no rotation is needed. Returns `null` when the
 * inset would collapse the interior, which is the degenerate case a caller must not render.
 *
 * Pure geometry — no OBC, no clipping concepts. Sibling to `planeFit.ts`, which supplies the
 * outer dimensions.
 */
export function buildPlaneBandGeometry(
  width: number,
  height: number,
  ratio = BAND_RATIO,
): THREE.ShapeGeometry | null {
  if (!(width > 0) || !(height > 0)) return null;

  const band = Math.min(width, height) * ratio;
  // Strictly less than half, or the hole inverts and `ShapeGeometry` triangulates nonsense.
  if (!(band > 0) || band * 2 >= Math.min(width, height)) return null;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const outer = new THREE.Shape()
    .moveTo(-halfWidth, -halfHeight)
    .lineTo(halfWidth, -halfHeight)
    .lineTo(halfWidth, halfHeight)
    .lineTo(-halfWidth, halfHeight)
    .lineTo(-halfWidth, -halfHeight);

  const innerWidth = halfWidth - band;
  const innerHeight = halfHeight - band;
  const hole = new THREE.Path()
    .moveTo(-innerWidth, -innerHeight)
    .lineTo(innerWidth, -innerHeight)
    .lineTo(innerWidth, innerHeight)
    .lineTo(-innerWidth, innerHeight)
    .lineTo(-innerWidth, -innerHeight);

  outer.holes.push(hole);
  return new THREE.ShapeGeometry(outer);
}
