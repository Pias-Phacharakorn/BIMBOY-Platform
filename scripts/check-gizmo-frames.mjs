/**
 * Gizmo frame invariants — the regression check for the section-plane gizmo.
 *
 * Guards the defect ADR-0009 fixed: a cut plane whose normal was off-axis drew its grabbable
 * arrow along the *nearest world axis* instead of along the cut, up to 54.74 degrees wrong
 * (arccos 1/sqrt(3), the (1,1,1) diagonal).
 *
 * Loads the REAL modules through Vite's own SSR loader, so nothing here is a mock of the logic
 * under test. Reusing Vite rather than adding a test runner follows `playwright.config.ts`,
 * which imports `loadEnv` from Vite for the same reason.
 *
 *   npm run check:gizmo     exit 0 = green, exit 1 = a gizmo lies about its cut
 */
import { createServer } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as THREE from "three";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A plan cut's helper frame is legitimately ~0.00573 deg off its own normal: for normal = +/-Y
 * the normal is parallel to `Object3D.up`, so `cross(up, z)` is degenerate and three.js nudges
 * `_z.z += 0.0001` to recover a usable basis. That nudge is permanent in the frame.
 *
 * It is invisible (sub-pixel on a 1.4-unit arm) and never reaches the cut itself, which uses
 * the exact `plane.normal` via `setFromNormalAndCoplanarPoint`. So this tolerance must NOT be
 * zero — an exact-equality assertion would fail on the most common cut in the app for a
 * non-bug. It is still ~4 orders of magnitude tighter than the defect it guards.
 */
const TOLERANCE_DEG = 0.01;

const server = await createServer({
  root: ROOT,
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
  // Nothing here goes through index.html; skipping discovery drops nearly all the startup
  // cost and the esbuild scan noise, which has nothing to do with the code under test.
  optimizeDeps: { noDiscovery: true, include: [] },
});

const { AXIS_COLORS, OFF_AXIS_COLOR, axisOf, colorOf, framePalette } = await server.ssrLoadModule(
  "/src/bim-components/GizmoAxis/src/axis.ts",
);
const { buildAxisGizmo } = await server.ssrLoadModule(
  "/src/bim-components/GizmoAxis/src/axis-gizmo-mesh.ts",
);
// The real function GizmoAxis's per-frame loop calls — not a copy of its arithmetic. That is
// the whole point of it being extracted: delete the rotation from it and this check goes red.
const { applyFollowTransform } = await server.ssrLoadModule(
  "/src/bim-components/GizmoAxis/src/follow-transform.ts",
);

const failures = [];
const fail = (msg) => failures.push(msg);
const fmt = (v) => `(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;
const angle = (a, b) =>
  THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(Math.abs(a.dot(b)), -1, 1)));

/**
 * Mirrors `SimplePlane.newHelper()`: `lookAt` while still at the origin, *then* move. Order
 * matters — `lookAt` aims at a world point, so doing it after the move would aim at the wrong
 * direction entirely.
 *
 * ⚠️ This is a **replica**, not the vendor's own helper — `SimplePlane` needs a `World` with a
 * scene and a camera to construct, which is not available headlessly. So Group B below asserts
 * against this function, and a vendor change to `newHelper` would leave it green while
 * production broke. `assertVendorHelperUnchanged()` closes that hole: it fails the moment OBC's
 * source stops matching what this replicates.
 */
const helperFor = (normal) => {
  const helper = new THREE.Object3D();
  helper.lookAt(normal);
  helper.position.set(5, 7, 11); // arbitrary non-origin plane point
  helper.updateMatrix();
  helper.updateWorldMatrix(true, false);
  return helper;
};

const rotAboutY = (deg) =>
  new THREE.Vector3(0, 0, 1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(deg),
  );

// `expect` is the colour the normal arrow AND the outline must both take. "grey" means the cut
// lines up with no world axis.
const CASES = [
  ["plan cut +Y (degenerate: normal parallel to up)", new THREE.Vector3(0, 1, 0), "y"],
  ["plan cut -Y (degenerate)", new THREE.Vector3(0, -1, 0), "y"],
  ["elevation +Z", new THREE.Vector3(0, 0, 1), "z"],
  ["elevation +X", new THREE.Vector3(1, 0, 0), "x"],
  // Float noise on an orthogonal wall's triangle normals must NOT read as skewed — this is the
  // case a too-tight tolerance breaks, and it is the common one.
  ["elevation +Z with 1e-6 float noise", new THREE.Vector3(1e-6, -2e-6, 1), "z"],
  ["0.5deg off-axis — inside tolerance, still square", rotAboutY(0.5), "z"],
  ["2deg off-axis — outside tolerance, a real rake", rotAboutY(2), "grey"],
  ["off-axis 20deg about Y", rotAboutY(20), "grey"],
  ["off-axis 40deg about Y", rotAboutY(40), "grey"],
  ["off-axis 44.9deg (where the old snap said 'red')", rotAboutY(44.9), "grey"],
  ["off-axis 45.1deg (where the old snap flipped to 'green')", rotAboutY(45.1), "grey"],
  ["full diagonal (1,1,1) — worst case for the old snap", new THREE.Vector3(1, 1, 1), "grey"],
];

const expectedColor = (expect) => (expect === "grey" ? OFF_AXIS_COLOR : AXIS_COLORS[expect]);
const colorName = (c) =>
  c === OFF_AXIS_COLOR
    ? "grey"
    : (Object.keys(AXIS_COLORS).find((k) => AXIS_COLORS[k] === c) ?? `0x${c.toString(16)}`);

// ─── Group 0: the vendor convention this whole file rests on ──────────────────────────────
//
// Everything below assumes `SimplePlane`'s helper puts the cut normal on local +Z, which is true
// because OBC does `helper.lookAt(this.normal)` and three's `lookAt` aims local +Z at its target.
// That is a vendor fact, not ours, and `helperFor()` above replicates it. If an OBC bump changes
// it, every assertion here would keep passing against the replica while the real gizmo pointed
// somewhere else — so check the vendor source directly and fail loudly instead.
console.log("Group 0 — vendor convention (@thatopen/components)");

const assertVendorHelperUnchanged = () => {
  const bundle = resolve(ROOT, "node_modules/@thatopen/components/dist/index.mjs");
  let source;
  try {
    source = readFileSync(bundle, "utf8");
  } catch {
    console.log("   SKIP vendor bundle not found (install deps to enable this check)");
    return;
  }
  // The two facts `PLANE_NORMAL_AXIS` and `helperFor()` depend on.
  const aimsHelperAtNormal = source.includes("helper.lookAt(this.normal)");
  // `newHelper` moves the helper only after aiming it — the order `helperFor` replicates.
  const movesAfterAiming = /helper\.lookAt\(this\.normal\);\s*helper\.position\.copy\(this\.origin\)/.test(
    source,
  );

  console.log(`   ${aimsHelperAtNormal ? "ok  " : "FAIL"} helper.lookAt(this.normal) still present`);
  console.log(`   ${movesAfterAiming ? "ok  " : "FAIL"} newHelper still aims before positioning`);

  if (!aimsHelperAtNormal) {
    fail(
      "OBC no longer does helper.lookAt(this.normal) — the plane normal may not be local +Z any " +
        "more. Re-derive PLANE_NORMAL_AXIS (axis-gizmo-mesh.ts) and helperFor() in this script.",
    );
  }
  if (!movesAfterAiming) {
    fail(
      "OBC's newHelper no longer aims before positioning — helperFor() in this script replicates " +
        "the old order and its frames are now wrong.",
    );
  }
};
assertVendorHelperUnchanged();

// ─── Group A: the grabbable arrow must run along the true cut normal ──────────────────────
console.log("");
//
// This is the defect. `ClipperCursor` creates the gizmo with `follow: plane.helper` and no
// grabAxis; `applyFollowTransform` — the same function GizmoAxis's per-frame loop calls — puts
// the group in the helper's frame, so the arrow's world direction is that rotation applied to
// its local axis.
console.log("Group A — grabbable arrow vs true cut normal");

for (const [label, rawNormal] of CASES) {
  const normal = rawNormal.clone().normalize();
  const helper = helperFor(normal);

  // Exactly what ClipperCursor._adoptPlane does.
  const palette = framePalette(helper.getWorldQuaternion(new THREE.Quaternion()));
  const { group, picker, grabColor } = buildAxisGizmo({ form: "plane", palette });
  applyFollowTransform(group, helper);
  group.updateWorldMatrix(true, true);

  const q = group.getWorldQuaternion(new THREE.Quaternion());
  const arrow = new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
  // CylinderGeometry is Y-aligned; the plane form rotates it onto local Z.
  const pickerDir = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(picker.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();

  const arrowErr = angle(arrow, normal);
  const pickerErr = angle(pickerDir, normal);

  const ok = arrowErr <= TOLERANCE_DEG && pickerErr <= TOLERANCE_DEG;
  console.log(
    `   ${ok ? "ok  " : "FAIL"} ${label.padEnd(52)} arrow ${arrowErr.toFixed(5)}deg` +
      `  picker ${pickerErr.toFixed(5)}deg`,
  );
  if (arrowErr > TOLERANCE_DEG) {
    fail(`${label}: arrow is ${arrowErr.toFixed(3)}deg off the cut normal ${fmt(normal)}`);
  }
  if (pickerErr > TOLERANCE_DEG) {
    fail(`${label}: grab cylinder is ${pickerErr.toFixed(3)}deg off the cut normal`);
  }
}

// ─── Group A2: colour states orientation, and grey means "no world axis" ──────────────────
//
// The arrow and the outline must always agree, so both are checked against one expectation:
// `grabColor` is what the gizmo painted its normal arrow, `colorOf(normal)` is what
// ClipperOutlineManager paints the rectangle.
console.log("\nGroup A2 — colour vs orientation (arrow and outline must agree)");

for (const [label, rawNormal, expect] of CASES) {
  const normal = rawNormal.clone().normalize();
  const helper = helperFor(normal);
  const palette = framePalette(helper.getWorldQuaternion(new THREE.Quaternion()));
  const { grabColor } = buildAxisGizmo({ form: "plane", palette });
  const outline = colorOf(normal);
  const want = expectedColor(expect);

  const ok = grabColor === want && outline === want;
  console.log(
    `   ${ok ? "ok  " : "FAIL"} ${label.padEnd(58)} arrow ${colorName(grabColor).padEnd(5)}` +
      ` outline ${colorName(outline).padEnd(5)} want ${expect}`,
  );
  if (grabColor !== want) {
    fail(`${label}: arrow is ${colorName(grabColor)}, expected ${expect}`);
  }
  if (outline !== want) {
    fail(`${label}: outline is ${colorName(outline)}, expected ${expect}`);
  }
  // The snap that caused the bug is gone: a skewed normal must report NO axis, not the nearest.
  if (expect === "grey" && axisOf(normal) !== null) {
    fail(`${label}: axisOf() still snaps a skewed normal to "${axisOf(normal).axis}"`);
  }
}

// ─── Group A3: the two inert arms are coloured by their own world axis ────────────────────
//
// This is what restores the pre-ADR-0009 look for a square cut: all three arms land on world
// axes, so the gizmo reads green/blue/red exactly as it used to. It also means the arms carry
// real information on a skewed cut — a wall raked in *plan* is still vertical, so its vertical
// arm stays blue while the other two grey out. Only a cut skewed in every direction greys
// wholly.
console.log("\nGroup A3 — inert arms coloured by their own world axis");

const armCases = [
  // [label, normal, expected {x,y,z} local-arm colours]
  ["plan cut +Y — every arm on a world axis (the old look)", new THREE.Vector3(0, 1, 0), { x: "x", y: "z", z: "y" }],
  ["elevation +Z — every arm on a world axis", new THREE.Vector3(0, 0, 1), { x: "x", y: "y", z: "z" }],
  ["raked in plan 20deg — vertical arm survives", rotAboutY(20), { x: "grey", y: "y", z: "grey" }],
  ["diagonal (1,1,1) — nothing survives", new THREE.Vector3(1, 1, 1), { x: "grey", y: "grey", z: "grey" }],
];

for (const [label, rawNormal, want] of armCases) {
  const helper = helperFor(rawNormal.clone().normalize());
  const palette = framePalette(helper.getWorldQuaternion(new THREE.Quaternion()));
  const got = { x: colorName(palette.x), y: colorName(palette.y), z: colorName(palette.z) };
  const ok = got.x === want.x && got.y === want.y && got.z === want.z;
  console.log(
    `   ${ok ? "ok  " : "FAIL"} ${label.padEnd(52)} ` +
      `local x=${got.x} y=${got.y} z=${got.z}`,
  );
  if (!ok) {
    fail(
      `${label}: arms are x=${got.x} y=${got.y} z=${got.z}, ` +
        `expected x=${want.x} y=${want.y} z=${want.z}`,
    );
  }
}

// ─── Group B: helper-frame invariants ─────────────────────────────────────────────────────
//
// Everything above rests on "local +Z is the normal, local X/Y lie in the plane". If OBC ever
// changes its `helper.lookAt(normal)` convention, this is the group that goes red first and
// points at PLANE_NORMAL_AXIS as the thing to move.
console.log("\nGroup B — helper-frame invariants");

const signatures = [];
for (const [label, rawNormal] of CASES) {
  const normal = rawNormal.clone().normalize();
  const f = helperFor(normal);
  const q = f.getWorldQuaternion(new THREE.Quaternion());
  const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(q);

  const zErr = angle(localZ, normal);
  const xPerp = Math.abs(angle(localX, normal) - 90);
  const yPerp = Math.abs(angle(localY, normal) - 90);

  const ok = zErr <= TOLERANCE_DEG && xPerp <= TOLERANCE_DEG && yPerp <= TOLERANCE_DEG;
  console.log(
    `   ${ok ? "ok  " : "FAIL"} ${label.padEnd(52)} +Z ${zErr.toFixed(5)}deg` +
      `  perp ${xPerp.toFixed(5)}/${yPerp.toFixed(5)}deg`,
  );
  if (zErr > TOLERANCE_DEG) fail(`${label}: helper local +Z is ${zErr.toFixed(3)}deg off normal`);
  if (xPerp > TOLERANCE_DEG || yPerp > TOLERANCE_DEG) {
    fail(`${label}: in-plane arms are not perpendicular to the normal`);
  }
  signatures.push(`${fmt(localX)}|${fmt(localY)}|${fmt(localZ)}`);
}

// The degenerate plan-cut fallback must be stable, or the in-plane arms would jitter per frame.
let deterministic = true;
for (let i = 0; i < 500 && deterministic; i++) {
  CASES.forEach(([, rawNormal], idx) => {
    const q = helperFor(rawNormal.clone().normalize()).getWorldQuaternion(new THREE.Quaternion());
    const sig = [
      fmt(new THREE.Vector3(1, 0, 0).applyQuaternion(q)),
      fmt(new THREE.Vector3(0, 1, 0).applyQuaternion(q)),
      fmt(new THREE.Vector3(0, 0, 1).applyQuaternion(q)),
    ].join("|");
    if (sig !== signatures[idx]) deterministic = false;
  });
}
console.log(`   ${deterministic ? "ok  " : "FAIL"} frame stable over 500 rebuilds`);
if (!deterministic) fail("helper frame is not deterministic — in-plane arms would jitter");

// ─── Group C: the "arrow" form is untouched (SectionBox regression) ───────────────────────
//
// The box passes no palette, so it must still default to AXIS_COLORS — a face's axis really is
// a world axis, which is the case where naming it by colour is meaningful.
console.log("\nGroup C — arrow form still world-aligned + world-coloured (SectionBox)");

const WORLD = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
for (const axis of ["x", "y", "z"]) {
  for (const direction of [1, -1]) {
    const { group, grabColor } = buildAxisGizmo({ form: "arrow", grabAxis: axis, direction });
    if (grabColor !== AXIS_COLORS[axis]) {
      fail(`arrow form ${axis}${direction}: colour ${colorName(grabColor)} !== AXIS_COLORS.${axis}`);
    }
    group.updateWorldMatrix(true, true);
    const dir = new THREE.Vector3(...WORLD[axis])
      .multiplyScalar(direction)
      .applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()));
    const expected = new THREE.Vector3(...WORLD[axis]).multiplyScalar(direction);
    const err = THREE.MathUtils.radToDeg(
      Math.acos(THREE.MathUtils.clamp(dir.dot(expected), -1, 1)),
    );
    const ok = err <= TOLERANCE_DEG;
    console.log(`   ${ok ? "ok  " : "FAIL"} ${axis}${direction > 0 ? "+" : "-"} ${err.toFixed(5)}deg`);
    if (!ok) fail(`arrow form ${axis}${direction}: ${err.toFixed(3)}deg off its world axis`);
  }
}

await server.close();

console.log("\n" + "=".repeat(78));
if (failures.length === 0) {
  console.log("GREEN — every gizmo arrow points along the cut it moves.");
  process.exit(0);
}
console.log(`RED — ${failures.length} failure(s):`);
for (const f of failures) console.log(`   ${f}`);
process.exit(1);
