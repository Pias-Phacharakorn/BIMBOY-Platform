import * as THREE from "three";
import { AXIS_COLORS, AXIS_DIRECTIONS, PLANE_AXES, PlaneAxis } from "./axis";
import { AxisGizmoForm } from "./types";

/**
 * Half-length of one axis, in the gizmo's own units. `GizmoAxis` divides its per-frame scale
 * by this, so the two have to agree — hence the export.
 */
export const GIZMO_LENGTH = 1.4;

const GIZMO_CONE_HEIGHT = 0.3;
const GIZMO_CONE_RADIUS = 0.08;
const GIZMO_DIAMOND_SIZE = 0.6;
/**
 * Base colour of the centre diamond — pure white, so `AxisGizmo.centreHighlighted` (in
 * `GizmoAxis/index.ts`) has a fixed value to restore rather than needing its own colour
 * parameter, the same role `grabColor` plays for the arrow's `highlighted`.
 */
export const GIZMO_DIAMOND_COLOR = 0xffffff;
/** Radius of the invisible grab cylinder around the grabbable axis, in gizmo units. */
const GIZMO_PICK_RADIUS = 0.35;
/** Draw after everything else in the overlay pass. */
const GIZMO_RENDER_ORDER = 999;
/**
 * The grabbable arrow is drawn this much larger than the others — length, cone and grab
 * cylinder alike — so the one axis that does something looks like it. The picker scales with
 * it deliberately: what you can grab stays identical to what you can see.
 */
const GRAB_AXIS_EMPHASIS = 1.5;
/**
 * How long the `"plane"` form's two **inert** in-plane arms are, as a fraction of the base
 * length. With {@link GRAB_AXIS_EMPHASIS} this puts the normal arrow at roughly 3× the arms,
 * which is what makes "this one moves the cut, those two only show you the surface" legible at
 * a glance. Only the arms shrink — the grab arm, its cone and its picker are untouched, so
 * nothing about what is grabbable changes.
 */
const IN_PLANE_LENGTH_RATIO = 0.45;
/** `ConeGeometry` puts its apex at +Y, so this is the direction a cone "points". */
const CONE_APEX = new THREE.Vector3(0, 1, 0);

/**
 * The local axis a `"plane"` gizmo's grabbable arrow runs along — the plane's normal.
 *
 * ⚠️ **A vendor coupling, pinned here so it is stated exactly once.** `OBC.SimplePlane` builds
 * its helper with `helper.lookAt(this.normal)` (`@thatopen/components/dist/index.mjs:17628`),
 * and `Object3D.lookAt` aims local **+Z** at its target. A `"plane"` gizmo takes that helper's
 * rotation, so its local +Z is the cut direction. If OBC ever changes that convention, this
 * constant is the only place that has to move.
 */
const PLANE_NORMAL_AXIS: PlaneAxis = "z";

export interface GizmoMesh {
  group: THREE.Group;
  /** The invisible cylinder wrapping the grabbable arrow. */
  picker: THREE.Mesh;
  /** The centre diamond mesh, already built for the `"plane"` form — `null` for `"arrow"`. */
  diamond: THREE.Mesh | null;
  /**
   * Materials of the grabbable arrow only, for the caller to recolour on hover. Fresh per
   * gizmo — recolouring one can never leak into another.
   */
  grabMaterials: (THREE.LineBasicMaterial | THREE.MeshBasicMaterial)[];
  /**
   * The colour the grabbable arrow was built in, so dropping a hover highlight can restore it
   * without re-deriving it.
   *
   * ⚠️ Load-bearing: a `"plane"` gizmo's colours come from its caller's frame, not from an axis
   * letter, so there is nothing to look the colour up *in* afterwards. Re-deriving it from
   * `AXIS_COLORS[grabAxis]` would repaint a skewed plane's grey arrow red on un-hover.
   */
  grabColor: number;
}

export interface BuildAxisGizmoOptions {
  /** Defaults to `"plane"`, which is what the section planes use. */
  form?: AxisGizmoForm;
  /** Required by `"arrow"`; ignored by `"plane"`, which always grabs {@link PLANE_NORMAL_AXIS}. */
  grabAxis?: PlaneAxis;
  /** Which way an `"arrow"` points. Ignored by `"plane"`, which is symmetric. Defaults to `1`. */
  direction?: 1 | -1;
  /**
   * Colour per **local** axis. Defaults to {@link AXIS_COLORS}, which is already correct for
   * `"arrow"` — its axes are world axes.
   *
   * `"plane"` must supply one, because a gizmo drawn in local space cannot know where its
   * rotation sends those axes: only the caller holds the frame. `axis.ts`'s `framePalette()`
   * builds it.
   */
  palette?: Record<PlaneAxis, number>;
}

/**
 * Builds one axis gizmo in either of two forms, and an invisible grab cylinder around the
 * grabbable arrow.
 *
 * - `"plane"` — a long double-headed arrow along local +Z plus two short inert arms on local X
 *   and Y, and a centre diamond. The caller keeps this group rotated with the plane, so +Z is
 *   the cut normal: the arrow points exactly where the plane cuts, and the arms and diamond lie
 *   **in** the cut surface. `grabAxis` is ignored — see {@link PLANE_NORMAL_AXIS} — and
 *   `palette` is required, since only the caller knows where its rotation aims each local axis.
 * - `"arrow"` — only `grabAxis`, only towards `direction`, no diamond, and the picker offset so
 *   it covers **only** that side. What a bounded *face* wants: six three-armed gizmos on one box
 *   is six diamonds and eighteen arrows, and on a thin box the +X and −X pickers would overlap
 *   through the middle, making the near face's handle grab the far one.
 *
 * Pure geometry — it touches no scene and holds no state, so the caller owns whatever it
 * returns and is responsible for disposing it. Every material uses `depthTest: false`
 * because this is rendered in a second pass with clipping suspended, on top of the model.
 */
export function buildAxisGizmo({
  form = "plane",
  grabAxis = PLANE_NORMAL_AXIS,
  direction = 1,
  palette = AXIS_COLORS,
}: BuildAxisGizmoOptions = {}): GizmoMesh {
  const group = new THREE.Group();
  group.name = "BIMBOY_Gizmo";

  const isPlane = form === "plane";
  // The plane form always grabs the normal; a caller's grabAxis means nothing there.
  const grabbable = isPlane ? PLANE_NORMAL_AXIS : grabAxis;

  const matOpts = { depthTest: false, depthWrite: false };

  // Only the axes actually drawn get materials, so the single-arrow form allocates one pair
  // rather than three and has nothing spare to dispose.
  const drawnAxes: readonly PlaneAxis[] = isPlane ? PLANE_AXES : [grabbable];
  const lineMaterials = new Map<PlaneAxis, THREE.LineBasicMaterial>();
  const coneMaterials = new Map<PlaneAxis, THREE.MeshBasicMaterial>();
  for (const axis of drawnAxes) {
    lineMaterials.set(axis, new THREE.LineBasicMaterial({ color: palette[axis], ...matOpts }));
    coneMaterials.set(axis, new THREE.MeshBasicMaterial({ color: palette[axis], ...matOpts }));
  }

  // The diamond marks a centre the arrow form does not have — its origin sits on the face it
  // moves, not in the middle of anything. It lies in local XY, which for the plane form is the
  // cut surface itself, so it reads as a scrap of the plane rather than a floating badge.
  // Accepted consequence: being a flat quad, it disappears when the plane is sighted edge-on.
  //
  // It is also the pick target for AxisDragManager's "inPlane" mode — the mesh itself, not a
  // dedicated invisible proxy, which preserves "what you can grab is what you can see" for the
  // diamond the same way the arrow's picker preserves it for the arrow. No dot(viewDir, normal)
  // guard is needed: AxisDragManager._begin disables camera.enabled for the whole drag, so a
  // session that starts grabbable cannot rotate itself edge-on mid-drag.
  let diamond: THREE.Mesh | null = null;
  if (isPlane) {
    diamond = new THREE.Mesh(
      new THREE.PlaneGeometry(GIZMO_DIAMOND_SIZE, GIZMO_DIAMOND_SIZE),
      new THREE.MeshBasicMaterial({
        color: GIZMO_DIAMOND_COLOR,
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
    // Only the grabbable arrow is emphasised. In the plane form the other two shrink further
    // still, since they are inert and exist only to show which surface is being cut.
    const emphasis =
      axis === grabbable ? GRAB_AXIS_EMPHASIS : isPlane ? IN_PLANE_LENGTH_RATIO : 1;
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

    if (isPlane) {
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

  // Grab handle: wraps only the arrow the outline is coloured after, so colour names the
  // plane, the arrow and the drag direction all at once. For `"plane"` the other two arms
  // stay inert — pulling them would move the outline without changing where the model is cut.
  const pickRadius = GIZMO_PICK_RADIUS * GRAB_AXIS_EMPHASIS;
  const armLength = GIZMO_LENGTH * GRAB_AXIS_EMPHASIS;
  const pickLength = isPlane ? armLength * 2 : armLength;
  const picker = new THREE.Mesh(
    new THREE.CylinderGeometry(pickRadius, pickRadius, pickLength, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  // CylinderGeometry is Y-aligned, so Y needs no rotation.
  if (grabbable === "x") picker.rotation.z = Math.PI / 2;
  else if (grabbable === "z") picker.rotation.x = Math.PI / 2;
  // Rotation leaves position alone, so offsetting along the axis is safe for every case. The
  // arrow form pushes the cylinder fully onto its own side: nothing behind the face is
  // grabbable, which is what keeps a thin box's opposing handles apart.
  if (!isPlane) {
    picker.position
      .copy(AXIS_DIRECTIONS[grabbable])
      .multiplyScalar((direction * pickLength) / 2);
  }
  group.add(picker);

  return {
    group,
    picker,
    diamond,
    grabMaterials: [lineMaterials.get(grabbable)!, coneMaterials.get(grabbable)!],
    grabColor: palette[grabbable],
  };
}
