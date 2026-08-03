import * as THREE from "three";
import { AXIS_COLORS, PlaneAxis } from "./axis";

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
 * Builds one axis gizmo: three double-headed arrows, a centre diamond, and an invisible
 * grab cylinder around `grabAxis`.
 *
 * Pure geometry — it touches no scene and holds no state, so the caller owns whatever it
 * returns and is responsible for disposing it. Every material uses `depthTest: false`
 * because this is rendered in a second pass with clipping suspended, on top of the model.
 *
 * The group carries no rotation: the caller keeps it world-axis-aligned, so green always
 * runs along X, blue up along Y and red along Z. That is what lets a plane's outline colour
 * name the very arrow that moves it.
 */
export function buildAxisGizmo(grabAxis: PlaneAxis): GizmoMesh {
  const group = new THREE.Group();
  group.name = "BIMBOY_Gizmo";

  const matOpts = { depthTest: false, depthWrite: false };

  const lineMaterials: Record<PlaneAxis, THREE.LineBasicMaterial> = {
    x: new THREE.LineBasicMaterial({ color: AXIS_COLORS.x, ...matOpts }),
    y: new THREE.LineBasicMaterial({ color: AXIS_COLORS.y, ...matOpts }),
    z: new THREE.LineBasicMaterial({ color: AXIS_COLORS.z, ...matOpts }),
  };
  const coneMaterials: Record<PlaneAxis, THREE.MeshBasicMaterial> = {
    x: new THREE.MeshBasicMaterial({ color: AXIS_COLORS.x, ...matOpts }),
    y: new THREE.MeshBasicMaterial({ color: AXIS_COLORS.y, ...matOpts }),
    z: new THREE.MeshBasicMaterial({ color: AXIS_COLORS.z, ...matOpts }),
  };

  // Centre diamond
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

  const createAxis = (axis: PlaneAxis, dir: THREE.Vector3) => {
    // Only the grabbable arrow is emphasised; the other two stay at their base size.
    const emphasis = axis === grabAxis ? GRAB_AXIS_EMPHASIS : 1;
    const length = GIZMO_LENGTH * emphasis;
    const coneHeight = GIZMO_CONE_HEIGHT * emphasis;
    const coneGeometry = new THREE.ConeGeometry(GIZMO_CONE_RADIUS * emphasis, coneHeight, 8);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      dir.clone().multiplyScalar(-length + coneHeight),
      dir.clone().multiplyScalar(length - coneHeight),
    ]);
    const line = new THREE.LineSegments(lineGeometry, lineMaterials[axis]);
    line.renderOrder = GIZMO_RENDER_ORDER;
    group.add(line);

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
      const mesh = new THREE.Mesh(coneGeometry, coneMaterials[axis]);
      mesh.position.copy(at);
      mesh.quaternion.setFromUnitVectors(CONE_APEX, towards);
      mesh.renderOrder = GIZMO_RENDER_ORDER;
      group.add(mesh);
    };

    // Both arrowheads point away from the centre.
    cone(dir.clone().multiplyScalar(length - coneHeight / 2), dir);
    cone(dir.clone().multiplyScalar(-length + coneHeight / 2), dir.clone().negate());
  };

  createAxis("x", new THREE.Vector3(1, 0, 0));
  createAxis("y", new THREE.Vector3(0, 1, 0));
  createAxis("z", new THREE.Vector3(0, 0, 1));

  // Grab handle: wraps only the arrow matching the plane's colour, so colour names the
  // plane, the arrow and the drag direction all at once. The other two arrows stay inert —
  // pulling them would move the outline without changing where the model is cut.
  const pickRadius = GIZMO_PICK_RADIUS * GRAB_AXIS_EMPHASIS;
  const picker = new THREE.Mesh(
    new THREE.CylinderGeometry(
      pickRadius,
      pickRadius,
      GIZMO_LENGTH * GRAB_AXIS_EMPHASIS * 2,
      8,
    ),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  // CylinderGeometry is Y-aligned, so Y needs no rotation.
  if (grabAxis === "x") picker.rotation.z = Math.PI / 2;
  else if (grabAxis === "z") picker.rotation.x = Math.PI / 2;
  group.add(picker);

  return {
    group,
    picker,
    grabMaterials: [lineMaterials[grabAxis], coneMaterials[grabAxis]],
  };
}
