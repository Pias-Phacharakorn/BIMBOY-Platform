// @ts-nocheck
// Pure, testable planar-pose solver: given a QR code's 4 image corners (pixels),
// the camera intrinsics, and the code's known physical size, recover the code's
// 6-DoF pose as a THREE.Matrix4 expressed in THREE.js *camera* space
// (x right, y up, camera looking down -z).
//
// A QR is 4 coplanar corners of a square of known size, so we use the classic
// homography-decomposition method (no opencv.js): solve the 3x3 homography from
// the plane to the normalised image, then factor it into rotation + translation.
// This is the "IPPE-lite" planar special case — accurate enough for a forgiving
// anchored miniature, cheap enough to run inline.
//
// Convention notes (the empirically-fragile seams — verify on-device):
//   * Image coords are pixel (u,v) with origin top-left, +v downward — the same
//     convention jsQR reports and OpenCV assumes. The caller MUST feed jsQR a
//     top-left-origin frame (flip the WebGL readPixels rows first).
//   * The solve runs in OpenCV camera convention (x right, y down, +z into the
//     scene) and is converted to THREE camera convention (y up, -z forward) at
//     the end via diag(1,-1,-1).
import * as THREE from "three";

export interface QrCornerPoints {
  // Pixel coordinates, origin top-left. Order matters — must match jsQR.location.
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

export interface CameraIntrinsics {
  fx: number;
  fy: number;
  cx: number;
  cy: number;
}

// Plausible depth window (metres). Poses outside this are treated as garbage
// (degenerate homography, mis-detected corners) and rejected rather than
// teleporting the model somewhere absurd.
const MIN_DEPTH_M = 0.05;
const MAX_DEPTH_M = 20;

/**
 * Solve a general 8x8 linear system A·x = b by Gaussian elimination with
 * partial pivoting. Returns null if the system is (near-)singular.
 */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Augmented matrix.
  const m = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the largest magnitude entry in this column.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null; // singular
    if (pivot !== col) {
      const tmp = m[pivot];
      m[pivot] = m[col];
      m[col] = tmp;
    }
    // Eliminate below.
    for (let r = col + 1; r < n; r++) {
      const factor = m[r][col] / m[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) m[r][c] -= factor * m[col][c];
    }
  }

  // Back-substitution.
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = m[row][n];
    for (let c = row + 1; c < n; c++) sum -= m[row][c] * x[c];
    x[row] = sum / m[row][row];
  }
  return x;
}

/**
 * Estimate the QR pose. Returns a THREE.Matrix4 (QR-local → THREE camera space)
 * or null if the pose is degenerate / out of the plausible depth window.
 */
export function estimateQrPose(
  corners: QrCornerPoints,
  intrinsics: CameraIntrinsics,
  sizeMeters: number
): THREE.Matrix4 | null {
  const { fx, fy, cx, cy } = intrinsics;
  if (!(fx > 0) || !(fy > 0) || !(sizeMeters > 0)) return null;

  const h = sizeMeters / 2;
  // QR-local object points (Z = 0 plane), +X right, +Y up, matching corner order.
  const obj = [
    { X: -h, Y: +h }, // topLeft
    { X: +h, Y: +h }, // topRight
    { X: +h, Y: -h }, // bottomRight
    { X: -h, Y: -h }, // bottomLeft
  ];
  const px = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];

  // Normalise image points by intrinsics → ideal camera coords (OpenCV: y down).
  const img = px.map((p) => ({
    x: (p.x - cx) / fx,
    y: (p.y - cy) / fy,
  }));

  // Homography H (h33 = 1) mapping (X,Y,1) → (x,y,1) up to scale. 8 unknowns.
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { X, Y } = obj[i];
    const { x, y } = img[i];
    A.push([X, Y, 1, 0, 0, 0, -x * X, -x * Y]);
    b.push(x);
    A.push([0, 0, 0, X, Y, 1, -y * X, -y * Y]);
    b.push(y);
  }
  const hv = solveLinear(A, b);
  if (!hv) return null;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = hv;
  if (hv.some((v) => !Number.isFinite(v))) return null;

  // Homography columns.
  const c1 = new THREE.Vector3(h0, h3, h6);
  const c2 = new THREE.Vector3(h1, h4, h7);
  const c3 = new THREE.Vector3(h2, h5, 1);

  // Scale so the rotation columns are unit length (average the first two for
  // stability), then t = λ·c3.
  const n1 = c1.length();
  const n2 = c2.length();
  if (n1 < 1e-9 || n2 < 1e-9) return null;
  let lambda = 2 / (n1 + n2);

  let r1 = c1.clone().multiplyScalar(lambda);
  let r2 = c2.clone().multiplyScalar(lambda);
  let t = c3.clone().multiplyScalar(lambda);

  // The code must sit in front of the camera (OpenCV +z). If depth came out
  // negative, the whole sign of the homography scale is flipped.
  if (t.z < 0) {
    lambda = -lambda;
    r1 = c1.clone().multiplyScalar(lambda);
    r2 = c2.clone().multiplyScalar(lambda);
    t = c3.clone().multiplyScalar(lambda);
  }

  if (t.z < MIN_DEPTH_M || t.z > MAX_DEPTH_M) return null;

  // Orthonormalise the rotation basis (Gram-Schmidt) — the raw r1,r2 aren't
  // exactly orthonormal because of noise in the corner detection.
  const b1 = r1.clone().normalize();
  const b2 = r2
    .clone()
    .sub(b1.clone().multiplyScalar(r2.dot(b1)))
    .normalize();
  const b3 = new THREE.Vector3().crossVectors(b1, b2); // already unit

  // OpenCV pose (object→camera), row-major:
  //   [ b1.x b2.x b3.x t.x ]
  //   [ b1.y b2.y b3.y t.y ]
  //   [ b1.z b2.z b3.z t.z ]
  // Convert to THREE camera convention with diag(1,-1,-1): negate rows 2 & 3.
  const m = new THREE.Matrix4();
  m.set(
    b1.x, b2.x, b3.x, t.x,
    -b1.y, -b2.y, -b3.y, -t.y,
    -b1.z, -b2.z, -b3.z, -t.z,
    0, 0, 0, 1
  );
  return m;
}

/**
 * Derive pinhole intrinsics from a WebXR view. fx/fy come from the view's
 * projection matrix; the principal point is assumed centred (good enough for
 * a forgiving anchor — tune on-device if placement is biased).
 */
export function intrinsicsFromXrView(
  projectionMatrix: Float32Array | number[],
  width: number,
  height: number
): CameraIntrinsics {
  const p = projectionMatrix;
  // Column-major: p[0] = 2·fx/w, p[5] = 2·fy/h.
  return {
    fx: (0.5 * width * Math.abs(p[0])) || 1,
    fy: (0.5 * height * Math.abs(p[5])) || 1,
    cx: width / 2,
    cy: height / 2,
  };
}
