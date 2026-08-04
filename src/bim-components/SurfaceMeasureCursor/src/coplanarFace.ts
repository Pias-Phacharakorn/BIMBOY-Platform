import * as THREE from 'three';

/**
 * Input mesh data representation for a single geometry part.
 */
export interface MeshData {
  positions: Float32Array | Float64Array;
  indices: Uint8Array | Uint16Array | Uint32Array;
  transform: THREE.Matrix4;
}

/**
 * One flat face: its outer boundary, plus any interior rings.
 *
 * `holes` is normally empty. It is populated when the face encloses an opening —
 * a window in a wall, a penetration in a slab — because those rings are boundary
 * edges of the same coplanar triangle set. Area must subtract them.
 */
export interface CoplanarFace {
  outer: THREE.Vector3[];
  holes: THREE.Vector3[][];
}

/**
 * Opaque welded triangle soup holding world-space geometry, precomputed normals,
 * plane offsets, and vertex-welded adjacency information.
 */
export interface WeldedSoup {
  weldedPositions: THREE.Vector3[];
  triangles: [number, number, number][];
  normals: THREE.Vector3[];
  planeOffsets: number[];
  adjacency: number[][];
}

/**
 * Merges mesh data into a welded triangle soup in world space.
 * Vertices within 1e-4 distance of each other are welded into shared vertex positions.
 *
 * @param meshes Array of local mesh data objects.
 * @param modelMatrix Transformation matrix from model space to world space.
 * @returns Welded triangle soup containing world-space geometry and adjacency.
 */
export function weldedSoup(
  meshes: MeshData[],
  modelMatrix: THREE.Matrix4
): WeldedSoup {
  const weldedPositions: THREE.Vector3[] = [];
  const vertexKeyToId = new Map<string, number>();

  const getWeldedVertexId = (v: THREE.Vector3): number => {
    const qx = Math.round(v.x / 1e-4) + 0;
    const qy = Math.round(v.y / 1e-4) + 0;
    const qz = Math.round(v.z / 1e-4) + 0;
    const key = `${qx},${qy},${qz}`;
    const existingId = vertexKeyToId.get(key);
    if (existingId !== undefined) {
      return existingId;
    }
    const newId = weldedPositions.length;
    weldedPositions.push(v.clone());
    vertexKeyToId.set(key, newId);
    return newId;
  };

  const triangles: [number, number, number][] = [];
  const normals: THREE.Vector3[] = [];
  const planeOffsets: number[] = [];

  const tmpV0 = new THREE.Vector3();
  const tmpV1 = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const worldTransform = new THREE.Matrix4().multiplyMatrices(modelMatrix, mesh.transform);
    const positions = mesh.positions;
    const indices = mesh.indices;
    const numTris = Math.floor(indices.length / 3);

    for (let i = 0; i < numTris; i++) {
      const idx0 = indices[i * 3];
      const idx1 = indices[i * 3 + 1];
      const idx2 = indices[i * 3 + 2];

      tmpV0.set(positions[idx0 * 3], positions[idx0 * 3 + 1], positions[idx0 * 3 + 2]).applyMatrix4(worldTransform);
      tmpV1.set(positions[idx1 * 3], positions[idx1 * 3 + 1], positions[idx1 * 3 + 2]).applyMatrix4(worldTransform);
      tmpV2.set(positions[idx2 * 3], positions[idx2 * 3 + 1], positions[idx2 * 3 + 2]).applyMatrix4(worldTransform);

      const w0 = getWeldedVertexId(tmpV0);
      const w1 = getWeldedVertexId(tmpV1);
      const w2 = getWeldedVertexId(tmpV2);

      edge1.subVectors(tmpV1, tmpV0);
      edge2.subVectors(tmpV2, tmpV0);
      cross.crossVectors(edge1, edge2);
      const len = cross.length();

      const normal = new THREE.Vector3();
      if (len > 1e-12) {
        normal.copy(cross).divideScalar(len);
      } else {
        normal.set(0, 0, 0);
      }

      const planeOffset = normal.dot(tmpV0);

      triangles.push([w0, w1, w2]);
      normals.push(normal);
      planeOffsets.push(planeOffset);
    }
  }

  const vertexToTriangles: number[][] = [];
  for (let i = 0; i < weldedPositions.length; i++) {
    vertexToTriangles.push([]);
  }

  for (let t = 0; t < triangles.length; t++) {
    const tri = triangles[t];
    const v0 = tri[0];
    const v1 = tri[1];
    const v2 = tri[2];

    vertexToTriangles[v0].push(t);
    if (v1 !== v0) {
      vertexToTriangles[v1].push(t);
    }
    if (v2 !== v0 && v2 !== v1) {
      vertexToTriangles[v2].push(t);
    }
  }

  const adjacency: number[][] = [];
  for (let t = 0; t < triangles.length; t++) {
    const tri = triangles[t];
    const nbrSet = new Set<number>();

    const list0 = vertexToTriangles[tri[0]];
    for (let k = 0; k < list0.length; k++) {
      if (list0[k] !== t) nbrSet.add(list0[k]);
    }
    const list1 = vertexToTriangles[tri[1]];
    for (let k = 0; k < list1.length; k++) {
      if (list1[k] !== t) nbrSet.add(list1[k]);
    }
    const list2 = vertexToTriangles[tri[2]];
    for (let k = 0; k < list2.length; k++) {
      if (list2[k] !== t) nbrSet.add(list2[k]);
    }

    adjacency.push(Array.from(nbrSet));
  }

  return {
    weldedPositions,
    triangles,
    normals,
    planeOffsets,
    adjacency
  };
}

/**
 * Finds the index of the triangle containing or closest to hitPoint,
 * preferring triangles whose normal aligns with hitNormal when provided.
 *
 * @param soup The welded triangle soup.
 * @param hitPoint World-space hit point location.
 * @param hitNormal Optional world-space hit normal vector.
 * @returns Index of the seed triangle, or null if nothing is within tolerance.
 */
export function seedTriangleAt(
  soup: WeldedSoup,
  hitPoint: THREE.Vector3,
  hitNormal?: THREE.Vector3
): number | null {
  // 5 cm, not a millimetre. `positions` arrives as Float32Array, and at BIM site
  // coordinates (often 1e5–1e6 m) float32 spacing alone is ~8 mm — so a faithfully
  // reconstructed triangle still lands millimetres from the worker's hit point, and
  // a tight threshold rejects every candidate and returns null. This only widens the
  // *rejection* cut: nearest-triangle-wins below still picks the right face, so a
  // thin panel's far side cannot beat its near side.
  const distTolerance = 5e-2;
  let bestIdx: number | null = null;
  let minDistance = Infinity;
  let maxDot = -Infinity;

  const triObj = new THREE.Triangle();
  const closestPt = new THREE.Vector3();

  let normalizedHitNormal: THREE.Vector3 | null = null;
  if (hitNormal !== undefined && hitNormal.lengthSq() > 0) {
    normalizedHitNormal = hitNormal.clone().normalize();
  }

  for (let i = 0; i < soup.triangles.length; i++) {
    const norm = soup.normals[i];
    if (norm.lengthSq() === 0) continue;

    const tri = soup.triangles[i];
    const p0 = soup.weldedPositions[tri[0]];
    const p1 = soup.weldedPositions[tri[1]];
    const p2 = soup.weldedPositions[tri[2]];
    if (p0 === undefined || p1 === undefined || p2 === undefined) continue;

    triObj.set(p0, p1, p2);
    triObj.closestPointToPoint(hitPoint, closestPt);
    const dist = hitPoint.distanceTo(closestPt);

    if (dist > distTolerance) continue;

    if (normalizedHitNormal !== null) {
      const dot = norm.dot(normalizedHitNormal);
      if (dist < minDistance - 1e-5) {
        minDistance = dist;
        maxDot = dot;
        bestIdx = i;
      } else if (Math.abs(dist - minDistance) <= 1e-5) {
        if (dot > maxDot) {
          minDistance = dist;
          maxDot = dot;
          bestIdx = i;
        }
      }
    } else {
      if (dist < minDistance) {
        minDistance = dist;
        bestIdx = i;
      }
    }
  }

  return bestIdx;
}

/**
 * Breadth-first extracts the ordered outline polygon of the single flat coplanar face hit by seedTriangle.
 *
 * @param soup The welded triangle soup.
 * @param seedTriangle Index of the seed triangle.
 * @returns The face's outer ring plus any interior rings (openings), or null.
 */
export function extractCoplanarFace(
  soup: WeldedSoup,
  seedTriangle: number
): CoplanarFace | null {
  if (seedTriangle < 0 || seedTriangle >= soup.triangles.length) {
    return null;
  }

  const seedNormal = soup.normals[seedTriangle];
  if (seedNormal === undefined || seedNormal.lengthSq() === 0) {
    return null;
  }

  const seedOffset = soup.planeOffsets[seedTriangle];
  if (seedOffset === undefined) {
    return null;
  }

  const faceTriangles = new Set<number>();
  faceTriangles.add(seedTriangle);

  const queue: number[] = [seedTriangle];
  let head = 0;

  while (head < queue.length) {
    const currTri = queue[head++];
    const nbrs = soup.adjacency[currTri];
    if (nbrs === undefined) continue;

    for (let i = 0; i < nbrs.length; i++) {
      const nbr = nbrs[i];
      if (faceTriangles.has(nbr)) continue;

      const nbrNormal = soup.normals[nbr];
      if (nbrNormal === undefined) continue;

      const dot = nbrNormal.dot(seedNormal);
      if (dot < 0.9998) continue;

      const nbrOffset = soup.planeOffsets[nbr];
      if (nbrOffset === undefined) continue;

      if (Math.abs(nbrOffset - seedOffset) > 1e-4) continue;

      faceTriangles.add(nbr);
      queue.push(nbr);
    }
  }

  const edgeCounts = new Map<string, number>();

  faceTriangles.forEach((triIdx) => {
    const tri = soup.triangles[triIdx];
    if (tri === undefined) return;
    const v0 = tri[0];
    const v1 = tri[1];
    const v2 = tri[2];

    const k0 = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;
    const k1 = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
    const k2 = v2 < v0 ? `${v2}_${v0}` : `${v0}_${v2}`;

    edgeCounts.set(k0, (edgeCounts.get(k0) ?? 0) + 1);
    edgeCounts.set(k1, (edgeCounts.get(k1) ?? 0) + 1);
    edgeCounts.set(k2, (edgeCounts.get(k2) ?? 0) + 1);
  });

  const directedBoundaryEdges: [number, number][] = [];

  faceTriangles.forEach((triIdx) => {
    const tri = soup.triangles[triIdx];
    if (tri === undefined) return;
    const v0 = tri[0];
    const v1 = tri[1];
    const v2 = tri[2];

    const addIfBoundary = (start: number, end: number) => {
      const k = start < end ? `${start}_${end}` : `${end}_${start}`;
      if (edgeCounts.get(k) === 1) {
        directedBoundaryEdges.push([start, end]);
      }
    };

    addIfBoundary(v0, v1);
    addIfBoundary(v1, v2);
    addIfBoundary(v2, v0);
  });

  if (directedBoundaryEdges.length < 3) {
    return null;
  }

  const remainingEdges = new Set<string>();
  const adjMap = new Map<number, number[]>();

  for (let i = 0; i < directedBoundaryEdges.length; i++) {
    const edge = directedBoundaryEdges[i];
    const u = edge[0];
    const v = edge[1];
    const edgeKey = `${u}->${v}`;
    remainingEdges.add(edgeKey);

    let list = adjMap.get(u);
    if (list === undefined) {
      list = [];
      adjMap.set(u, list);
    }
    list.push(v);
  }

  const rings: THREE.Vector3[][] = [];

  while (remainingEdges.size > 0) {
    const firstKey = remainingEdges.values().next().value;
    if (firstKey === undefined) break;

    const parts = firstKey.split('->');
    const startU = parseInt(parts[0], 10);
    const startV = parseInt(parts[1], 10);

    const currentRing: THREE.Vector3[] = [];
    let curr = startU;
    let next = startV;
    let isValid = true;
    const visitedVertices = new Set<number>();

    while (true) {
      const edgeKey = `${curr}->${next}`;
      if (!remainingEdges.has(edgeKey)) {
        isValid = false;
        break;
      }
      remainingEdges.delete(edgeKey);
      visitedVertices.add(curr);

      const pos = soup.weldedPositions[curr];
      if (pos === undefined) {
        isValid = false;
        break;
      }
      currentRing.push(pos.clone());

      if (next === startU) {
        break;
      }

      curr = next;
      const candidates = adjMap.get(curr);
      if (candidates === undefined) {
        isValid = false;
        break;
      }

      let foundNext = false;
      for (let c = 0; c < candidates.length; c++) {
        const candidate = candidates[c];
        if (remainingEdges.has(`${curr}->${candidate}`)) {
          next = candidate;
          foundNext = true;
          break;
        }
      }

      if (!foundNext) {
        isValid = false;
        break;
      }

      if (visitedVertices.has(curr)) {
        isValid = false;
        break;
      }
    }

    if (isValid && currentRing.length >= 3) {
      rings.push(currentRing);
    }
  }

  if (rings.length === 0) {
    return null;
  }

  // The longest-perimeter ring is the outer boundary; every other ring is an
  // interior opening. Keeping the openings is what lets a wall face with a
  // window report the wall's area rather than the wall plus the hole.
  let outerIndex = 0;
  let maxPerimeter = -1;

  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r];
    let perimeter = 0;
    for (let i = 0; i < ring.length; i++) {
      const p1 = ring[i];
      const p2 = ring[(i + 1) % ring.length];
      perimeter += p1.distanceTo(p2);
    }
    if (perimeter > maxPerimeter) {
      maxPerimeter = perimeter;
      outerIndex = r;
    }
  }

  const outer = rings[outerIndex];
  if (outer === undefined) return null;

  return {
    outer,
    holes: rings.filter((_, r) => r !== outerIndex),
  };
}
