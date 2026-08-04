import * as THREE from "three";
import { AXIS_COLORS, PlaneAxis } from "./axis";
import { AxisGizmoForm } from "./types";

/**
 * Half-length of one axis, in the gizmo's own units. `GizmoAxis` divides its per-frame scale
 * by this, so the two have to agree — hence the export.
 */
export const GIZMO_LENGTH = 1.4;

const GIZMO_CONE_HEIGHT = 0.3;
const GIZMO_CONE_RADIUS = 0.08;
const GIZMO_DIAMOND_SIZE = 0.6;
/** Radius of the invisible grab cylinder around the grabbable axis, in gizmo units. */
const GIZMO_PICK_RADIUS = 0.35;
/** Draw after everything else in the overlay pass. */
const GIZMO_RENDER_ORDER = 999;
/**
 * The grabbable arrow is drawn this much larger than the other two — length, cone and grab
 * cylinder alike — so the one axis that does something looks like it. The picker scales with
 * it deliberately: what you can grab stays identical to what you can see.
 */
const GRAB_AXIS_EMPHASIS = 1.5;
/** `ConeGeometry` puts its apex at +Y, so this is the direction a cone "points". */
const CONE_APEX = new THREE.Vector3(0, 1, 0);

const AXIS_DIRECTIONS: Record<PlaneAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

export interface GizmoMesh {
  group: THREE.Group;
  /** The invisible cylinder wrapping the grabbable arrow. */
  picker: THREE.Mesh;
  /**
   * Materials of the grabbable arrow only, for the caller to recolour on hover. Fresh per
   * gizmo — recolouring one can never leak into another.
   */
  grabMaterials: (THREE.LineBasicMaterial | THREE.MeshBasicMaterial)[];
}

/**
 * Builds one axis gizmo in either of two forms, and an invisible grab cylinder around
 * `grabAxis`.
 *
 * - `"axes"` — three double-headed arrows and a centre diamond, the picker spanning the full
 *   length in both directions. What a cut *plane* wants: the plane is unbounded, so all three
 *   world axes are worth drawing.
 * - `"arrow"` — only `grabAxis`, only towards `direction`, no diamond, and the picker offset
 *   so it covers **only** that side. What a bounded *face* wants: six of the `"axes"` form on
 *   one box is six diamonds and eighteen arrows, and on a thin box the +X and −X pickers would
 *   overlap through the middle, making the near face's handle grab the far one.
 *
 * Pure geometry — it touches no scene and holds no state, so the caller owns whatever it
 * returns and is responsible for disposing it. Every material uses `depthTest: false`
 * because this is rendered in a second pass with clipping suspended, on top of the model.
 *
 * The group carries no rotation: the caller keeps it world-axis-aligned, so green always
 * runs along X, blue up along Y and red along Z. That is what lets a plane's outline colour
 * name the very arrow that moves it.
 */
export function buildAxisGizmo(
  grabAxis: PlaneAxis,
  form: AxisGizmoForm = "axes",
  direction: 1 | -1 = 1,
): GizmoMesh {
  const group = new THREE.Group();
  group.name = "BIMBOY_Gizmo";

  const matOpts = { depthTest: false, depthWrite: false };

  // Only the axes actually drawn get materials, so the single-arrow form allocates one pair
  // rather than three and has nothing spare to dispose.
  const drawnAxes: PlaneAxis[] = form === "axes" ? ["x", "y", "z"] : [grabAxis];
  const lineMaterials = new Map<PlaneAxis, THREE.LineBasicMaterial>();
  const coneMaterials = new Map<PlaneAxis, THREE.MeshBasicMaterial>();
  for (const axis of drawnAxes) {
    lineMaterials.set(axis, new THREE.LineBasicMaterial({ color: AXIS_COLORS[axis], ...matOpts }));
    coneMaterials.set(axis, new THREE.MeshBasicMaterial({ color: AXIS_COLORS[axis], ...matOpts }));
  }

  // The diamond marks a centre the arrow form does not have — its origin sits on the face it
  // moves, not in the middle of anything.
  if (form === "axes") {
    const diamond = new THREE.Mesh(
      new THREE.PlaneGeometry(GIZMO_DIAMOND_SIZE, GIZMO_DIAMOND_SIZE),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    diamond.rotation.z = Math.PI / 4;
    diamond.renderOrder = GIZMO_RENDER_ORDER;
    group.add(diamond);
  }

  const createAxis = (axis: PlaneAxis) => {
    // Only the grabbable arrow is emphasised; the other two stay at their base size.
    const emphasis = axis === grabAxis ? GRAB_AXIS_EMPHASIS : 1;
    const length = GIZMO_LENGTH * emphasis;
    const coneHeight = GIZMO_CONE_HEIGHT * emphasis;
    const coneGeometry = new THREE.ConeGeometry(GIZMO_CONE_RADIUS * emphasis, coneHeight, 8);
    const dir = AXIS_DIRECTIONS[axis];

    /**
     * Cones are oriented by aiming their apex, never by composing Euler angles — an earlier
     * `rotZ`/`rotX` scheme sent the −Z cone's apex to +Z, because the fallback flip about Z
     * fired on top of the flip about X and undid it. With a target direction there is no
     * order, sign or per-axis constant left to get wrong.
     *
     * The antiparallel case is safe: for the −Y cone the target is exactly −Y, and
     * `setFromUnitVectors` detects `dot + 1 < EPSILON` and falls back to a half-turn about Z,
     * which maps +Y to −Y.
     */
    const cone = (at: THREE.Vector3, towards: THREE.Vector3) => {
      const mesh = new THREE.Mesh(coneGeometry, coneMaterials.get(axis));
      mesh.position.copy(at);
      mesh.quaternion.setFromUnitVectors(CONE_APEX, towards);
      mesh.renderOrder = GIZMO_RENDER_ORDER;
      group.add(mesh);
    };

    const line = (from: THREE.Vector3, to: THREE.Vector3) => {
      const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
      const segments = new THREE.LineSegments(geometry, lineMaterials.get(axis));
      segments.renderOrder = GIZMO_RENDER_ORDER;
      group.add(segments);
    };

    if (form === "axes") {
      line(
        dir.clone().multiplyScalar(-length + coneHeight),
        dir.clone().multiplyScalar(length - coneHeight),
      );
      // Both arrowheads point away from the centre.
      cone(dir.clone().multiplyScalar(length - coneHeight / 2), dir);
      cone(dir.clone().multiplyScalar(-length + coneHeight / 2), dir.clone().negate());
      return;
    }

    // Single arrow: it grows out of the origin, so the whole gizmo reads as "this face moves
    // this way" rather than "this axis exists".
    const out = dir.clone().multiplyScalar(direction);
    line(new THREE.Vector3(), out.clone().multiplyScalar(length - coneHeight));
    cone(out.clone().multiplyScalar(length - coneHeight / 2), out);
  };

  for (const axis of drawnAxes) createAxis(axis);

  // Grab handle: wraps only the arrow matching the plane's colour, so colour names the
  // plane, the arrow and the drag direction all at once. For `"axes"` the other two arrows
  // stay inert — pulling them would move the outline without changing where the model is cut.
  const pickRadius = GIZMO_PICK_RADIUS * GRAB_AXIS_EMPHASIS;
  const armLength = GIZMO_LENGTH * GRAB_AXIS_EMPHASIS;
  const pickLength = form === "axes" ? armLength * 2 : armLength;
  const picker = new THREE.Mesh(
    new THREE.CylinderGeometry(pickRadius, pickRadius, pickLength, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  // CylinderGeometry is Y-aligned, so Y needs no rotation.
  if (grabAxis === "x") picker.rotation.z = Math.PI / 2;
  else if (grabAxis === "z") picker.rotation.x = Math.PI / 2;
  // Rotation leaves position alone, so offsetting along the axis is safe for every case. The
  // arrow form pushes the cylinder fully onto its own side: nothing behind the face is
  // grabbable, which is what keeps a thin box's opposing handles apart.
  if (form === "arrow") {
    picker.position
      .copy(AXIS_DIRECTIONS[grabAxis])
      .multiplyScalar((direction * pickLength) / 2);
  }
  group.add(picker);

  return {
    group,
    picker,
    grabMaterials: [lineMaterials.get(grabAxis)!, coneMaterials.get(grabAxis)!],
  };
}
