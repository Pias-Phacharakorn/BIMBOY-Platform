// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CursorSurface } from "../../CursorSurface";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurfaceMeasurement {
  id: string;
  /** Ordered world-space vertices of the face outline polygon */
  polygon: THREE.Vector3[];
  /** m² */
  area: number;
  /** Per-edge lengths in metres */
  edgeLengths: number[];
  /** Three.js objects for this measurement (border + labels) */
  objects: THREE.Object3D[];
  /** CSS2DObjects for cleanup */
  labelObjects: CSS2DObject[];
  visible: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Dot-product coplanarity threshold for ~1° tolerance */
const COPLANAR_DOT = 0.9998;

/** Build a position lookup key from a quantised vertex */
function vertKey(x: number, y: number, z: number, eps = 1e-4): string {
  return `${Math.round(x / eps)},${Math.round(y / eps)},${Math.round(z / eps)}`;
}

/**
 * Extract all triangles on the same coplanar face as `faceIndex` using BFS.
 * Returns the ordered outline polygon (world-space Vector3[]).
 */
function extractCoplanarFace(
  geometry: THREE.BufferGeometry,
  faceIndex: number,
  matrixWorld: THREE.Matrix4
): THREE.Vector3[] | null {
  const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
  const indexAttr = geometry.getIndex();
  if (!posAttr || !indexAttr) return null;

  const indices = indexAttr.array;
  const totalTris = Math.floor(indices.length / 3);

  // Helper: get world-space position of a vertex by its buffer index
  const getWorldPos = (vi: number): THREE.Vector3 => {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, vi);
    v.applyMatrix4(matrixWorld);
    return v;
  };

  // Helper: get normal of a triangle (world-space)
  const getTriNormal = (triIdx: number): THREE.Vector3 => {
    const i0 = indices[triIdx * 3];
    const i1 = indices[triIdx * 3 + 1];
    const i2 = indices[triIdx * 3 + 2];
    const a = getWorldPos(i0);
    const b = getWorldPos(i1);
    const c = getWorldPos(i2);
    const ab = new THREE.Vector3().subVectors(b, a);
    const ac = new THREE.Vector3().subVectors(c, a);
    return new THREE.Vector3().crossVectors(ab, ac).normalize();
  };

  // Seed normal from the hit face
  const seedNormal = getTriNormal(faceIndex);

  // BFS to collect all coplanar triangles
  const visited = new Set<number>();
  const queue: number[] = [faceIndex];
  visited.add(faceIndex);

  // Build adjacency list: vertex index → triangle indices
  const vertToTris = new Map<number, number[]>();
  for (let t = 0; t < totalTris; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = indices[t * 3 + k];
      if (!vertToTris.has(vi)) vertToTris.set(vi, []);
      vertToTris.get(vi)!.push(t);
    }
  }

  const faceTris: number[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    faceTris.push(curr);

    // Get all triangles sharing a vertex with curr
    const currVerts = [
      indices[curr * 3],
      indices[curr * 3 + 1],
      indices[curr * 3 + 2],
    ];
    const neighbours = new Set<number>();
    for (const vi of currVerts) {
      for (const t of vertToTris.get(vi) ?? []) neighbours.add(t);
    }

    for (const t of neighbours) {
      if (visited.has(t)) continue;
      // Check coplanarity
      const tn = getTriNormal(t);
      if (Math.abs(tn.dot(seedNormal)) >= COPLANAR_DOT) {
        visited.add(t);
        queue.push(t);
      }
    }
  }

  if (faceTris.length === 0) return null;

  // Extract boundary edges (edges that appear exactly once)
  const edgeCount = new Map<string, [number, number]>(); // key → [viA, viB]
  for (const t of faceTris) {
    const tVerts = [
      indices[t * 3],
      indices[t * 3 + 1],
      indices[t * 3 + 2],
    ];
    for (let k = 0; k < 3; k++) {
      const a = tVerts[k];
      const b = tVerts[(k + 1) % 3];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}_${hi}`;
      edgeCount.set(key, edgeCount.has(key) ? [-1, -1] : [lo, hi]);
    }
  }

  // Boundary edges: those that appear exactly once (value !== [-1,-1])
  const boundaryEdges: Array<[number, number]> = [];
  for (const [, v] of edgeCount) {
    if (v[0] !== -1) boundaryEdges.push(v);
  }

  if (boundaryEdges.length < 3) return null;

  // Order edges into a continuous polygon using adjacency walk
  // Build: vertex → next vertex map (for the boundary loop)
  const nextMap = new Map<number, number>();
  const prevMap = new Map<number, number>();
  for (const [a, b] of boundaryEdges) {
    nextMap.set(a, b);
    prevMap.set(b, a);
    nextMap.set(b, a);
    prevMap.set(a, b);
  }

  // Walk the loop starting from the first vertex
  const startVi = boundaryEdges[0][0];
  const ordered: number[] = [];
  let current = startVi;
  let prev = -1;
  for (let i = 0; i < boundaryEdges.length; i++) {
    ordered.push(current);
    const candidates = [nextMap.get(current), prevMap.get(current)].filter(
      (v) => v !== undefined && v !== prev
    );
    if (candidates.length === 0) break;
    prev = current;
    current = candidates[0]!;
    if (current === startVi) break;
  }

  if (ordered.length < 3) return null;

  return ordered.map((vi) => getWorldPos(vi));
}

/**
 * Compute the signed area of a 3D polygon projected onto its own plane.
 * Returns m² (positive).
 */
function polygonArea(verts: THREE.Vector3[], normal: THREE.Vector3): number {
  let area = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    const cross = new THREE.Vector3().crossVectors(a, b);
    area += cross.dot(normal);
  }
  return Math.abs(area) / 2;
}

/** Create a label CSS2DObject with our pill style */
function createLabelObject(text: string): CSS2DObject {
  const div = document.createElement("div");
  div.style.cssText = `
    background: rgba(10,20,40,0.85);
    color: #fff;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    font-family: Inter, system-ui, sans-serif;
    white-space: nowrap;
    pointer-events: none;
    border: 1.5px solid rgba(36,166,241,0.7);
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  `;
  div.textContent = text;
  const obj = new CSS2DObject(div);
  return obj;
}

/** Format metres to a readable string */
function fmtM(m: number): string {
  return `~ ${m.toFixed(1)} m`;
}

function fmtM2(m2: number): string {
  return `Total area: ~ ${m2.toFixed(1)} m²`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export class SurfaceMeasureCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "8f3a19b2-cc7d-4e15-91d3-bac1dc023f5a" as const;

  private _enabled = false;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();
  readonly onMeasurementAdded = new OBC.Event<SurfaceMeasurement>();
  readonly onMeasurementDeleted = new OBC.Event<string>();

  private _components: OBC.Components;
  private _world: OBC.World | null = null;
  /** Whether listeners are currently bound — `enabled` can be true before a world arrives. */
  private _active = false;

  /** All confirmed measurements */
  readonly measurements: SurfaceMeasurement[] = [];

  /** Currently hovered face preview mesh */
  private _hoverMesh: THREE.Mesh | null = null;
  private _hoverPolygon: THREE.Vector3[] | null = null;
  private _hoverNormal: THREE.Vector3 | null = null;

  // Event listeners
  private _mouseMoveListener: (() => void) | null = null;
  private _pointerDownListener: ((e: PointerEvent) => void) | null = null;
  private _pointerUpListener: ((e: PointerEvent) => void) | null = null;
  private _keyListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(components: OBC.Components) {
    super(components);
    this._components = components;
    components.add(SurfaceMeasureCursor.uuid, this);
  }

  get world() {
    return this._world;
  }

  /**
   * Set after construction, as `GizmoAxis`/`Hoverer` do, so `components.get()` needs no cast.
   * Re-binds an active cursor; enabling before a world arrives simply does nothing until it does.
   */
  set world(value: OBC.World | null) {
    if (this._world === value) return;
    const wasActive = this._active;
    if (wasActive) this._deactivate();
    this._world = value;
    if (wasActive) this._activate();
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value: boolean) {
    if (this._enabled === value) return;
    this._enabled = value;
    if (value) {
      this._activate();
    } else {
      this._deactivate();
    }
    this.onStateChanged.trigger();
  }

  // ─── Activate ──────────────────────────────────────────────────────────────

  private _activate() {
    if (this._active || !this._world) return;
    this._active = true;

    const canvas = this._world.renderer?.three?.domElement;
    const cursorSurface = this._components.get(CursorSurface);
    cursorSurface.setWorld(this._world);

    let raycastInProgress = false;

    this._mouseMoveListener = () => {
      if (raycastInProgress) return;
      raycastInProgress = true;

      const raycasters = this._components.get(OBC.Raycasters);
      const raycaster = raycasters.get(this._world);

      raycaster
        .castRay()
        .then((result) => {
          if (result && result.point && result.face && result.object) {
            const mesh = result.object as THREE.Mesh;
            const faceIndex = result.faceIndex ?? 0;
            const normal = result.face.normal
              .clone()
              .transformDirection(result.object.matrixWorld)
              .normalize();

            cursorSurface.update(result.point, normal);

            // Extract coplanar face polygon
            const polygon = extractCoplanarFace(
              mesh.geometry,
              faceIndex,
              mesh.matrixWorld
            );

            if (polygon && polygon.length >= 3) {
              this._hoverPolygon = polygon;
              this._hoverNormal = normal;
              this._updateHoverMesh(polygon);
            } else {
              this._clearHoverMesh();
            }
          } else {
            cursorSurface.hide();
            this._clearHoverMesh();
          }
        })
        .catch(() => {
          cursorSurface.hide();
          this._clearHoverMesh();
        })
        .finally(() => {
          raycastInProgress = false;
        });
    };

    let startX = 0;
    let startY = 0;

    this._pointerDownListener = (e: PointerEvent) => {
      startX = e.clientX;
      startY = e.clientY;
    };

    this._pointerUpListener = (e: PointerEvent) => {
      const diffX = Math.abs(e.clientX - startX);
      const diffY = Math.abs(e.clientY - startY);
      if (diffX < 4 && diffY < 4) {
        this._confirmFace();
      }
    };

    this._keyListener = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Delete the most recently added measurement
        if (this.measurements.length > 0) {
          const last = this.measurements[this.measurements.length - 1];
          this._deleteMeasurement(last.id);
        }
      }
    };

    if (canvas) {
      canvas.addEventListener("mousemove", this._mouseMoveListener);
      canvas.addEventListener("pointerdown", this._pointerDownListener);
      canvas.addEventListener("pointerup", this._pointerUpListener);
    }
    window.addEventListener("keydown", this._keyListener);
  }

  // ─── Deactivate ────────────────────────────────────────────────────────────

  private _deactivate() {
    if (!this._active || !this._world) return;
    this._active = false;

    const canvas = this._world.renderer?.three?.domElement;
    const cursorSurface = this._components.get(CursorSurface);
    cursorSurface.hide();
    this._clearHoverMesh();

    if (canvas) {
      if (this._mouseMoveListener) {
        canvas.removeEventListener("mousemove", this._mouseMoveListener);
        this._mouseMoveListener = null;
      }
      if (this._pointerDownListener) {
        canvas.removeEventListener("pointerdown", this._pointerDownListener);
        this._pointerDownListener = null;
      }
      if (this._pointerUpListener) {
        canvas.removeEventListener("pointerup", this._pointerUpListener);
        this._pointerUpListener = null;
      }
    }

    if (this._keyListener) {
      window.removeEventListener("keydown", this._keyListener);
      this._keyListener = null;
    }
  }

  // ─── Hover mesh ────────────────────────────────────────────────────────────

  private _updateHoverMesh(polygon: THREE.Vector3[]) {
    this._clearHoverMesh();

    const shape = new THREE.Shape();
    // Project polygon to local 2D using the first two basis vectors
    const normal = this._hoverNormal!;
    const up = Math.abs(normal.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(up, normal).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();

    const project = (pt: THREE.Vector3) => ({
      x: pt.dot(u),
      y: pt.dot(v),
    });

    const projected = polygon.map(project);
    shape.moveTo(projected[0].x, projected[0].y);
    for (let i = 1; i < projected.length; i++) {
      shape.lineTo(projected[i].x, projected[i].y);
    }
    shape.closePath();

    const geom = new THREE.ShapeGeometry(shape);

    // Undo the 2D projection: restore 3D positions
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const lx = posAttr.getX(i);
      const ly = posAttr.getY(i);
      const worldPt = new THREE.Vector3()
        .addScaledVector(u, lx)
        .addScaledVector(v, ly);
      posAttr.setXYZ(i, worldPt.x, worldPt.y, worldPt.z);
    }
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x24a6f1,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthTest: false,
    });

    this._hoverMesh = new THREE.Mesh(geom, mat);
    // Slight offset along normal to prevent z-fighting
    this._hoverMesh.position.addScaledVector(normal, 0.002);
    this._hoverMesh.renderOrder = 999;
    this._world.scene.three.add(this._hoverMesh);
  }

  private _clearHoverMesh() {
    if (this._hoverMesh && this._world) {
      this._world.scene.three.remove(this._hoverMesh);
      this._hoverMesh.geometry.dispose();
      (this._hoverMesh.material as THREE.Material).dispose();
      this._hoverMesh = null;
    }
    this._hoverPolygon = null;
    this._hoverNormal = null;
  }

  // ─── Confirm face ──────────────────────────────────────────────────────────

  private _confirmFace() {
    if (!this._hoverPolygon || this._hoverPolygon.length < 3) return;

    const polygon = this._hoverPolygon.map((v) => v.clone());
    const normal = this._hoverNormal!.clone();

    // Compute per-edge lengths
    const edgeLengths: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      edgeLengths.push(a.distanceTo(b));
    }

    // Compute area
    const area = polygonArea(polygon, normal);

    // Centroid
    const centroid = new THREE.Vector3();
    for (const v of polygon) centroid.add(v);
    centroid.divideScalar(polygon.length);

    const objects: THREE.Object3D[] = [];
    const labelObjects: CSS2DObject[] = [];
    const scene = this._world.scene.three;

    // 1. Border LineLoop
    const borderVerts = [...polygon, polygon[0]]; // close loop
    const borderGeom = new THREE.BufferGeometry().setFromPoints(borderVerts);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x24a6f1,
      linewidth: 2,
      depthTest: false,
    });
    const borderLine = new THREE.LineLoop(borderGeom, borderMat);
    borderLine.renderOrder = 1000;
    scene.add(borderLine);
    objects.push(borderLine);

    // 2. Per-edge length labels at midpoints
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const len = edgeLengths[i];

      // Skip very short edges (< 5 cm) from labelling
      if (len < 0.05) continue;

      const mid = new THREE.Vector3().lerpVectors(a, b, 0.5);
      // Offset label slightly outward (away from centroid along mid-centroid direction)
      const outDir = new THREE.Vector3().subVectors(mid, centroid).normalize();
      const labelPos = mid.clone().addScaledVector(outDir, 0.15);

      const label = createLabelObject(fmtM(len));
      label.position.copy(labelPos);
      scene.add(label);
      objects.push(label);
      labelObjects.push(label);
    }

    // 3. Area label above centroid
    const areaLabelPos = centroid.clone().addScaledVector(normal, 0.3);
    const areaLabel = createLabelObject(fmtM2(area));
    areaLabel.position.copy(areaLabelPos);
    scene.add(areaLabel);
    objects.push(areaLabel);
    labelObjects.push(areaLabel);

    const measurement: SurfaceMeasurement = {
      id: crypto.randomUUID(),
      polygon,
      area,
      edgeLengths,
      objects,
      labelObjects,
      visible: true,
    };

    this.measurements.push(measurement);
    this.onMeasurementAdded.trigger(measurement);

    // Clear hover state so next hover starts fresh
    this._clearHoverMesh();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  deleteMeasurement(id: string) {
    this._deleteMeasurement(id);
  }

  private _deleteMeasurement(id: string) {
    const idx = this.measurements.findIndex((m) => m.id === id);
    if (idx === -1) return;

    const m = this.measurements[idx];
    this._disposeMeasurement(m);
    this.measurements.splice(idx, 1);
    this.onMeasurementDeleted.trigger(id);
  }

  setMeasurementVisible(id: string, visible: boolean) {
    const m = this.measurements.find((m) => m.id === id);
    if (!m) return;
    m.visible = visible;
    for (const obj of m.objects) {
      obj.visible = visible;
    }
  }

  clearAll() {
    for (const m of [...this.measurements]) {
      this._disposeMeasurement(m);
    }
    this.measurements.length = 0;
  }

  private _disposeMeasurement(m: SurfaceMeasurement) {
    // Reachable from React (delete/clearAll) even with no world set.
    if (!this._world) return;
    const scene = this._world.scene.three;
    for (const obj of m.objects) {
      scene.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        const mat = (obj as any).material;
        if (Array.isArray(mat)) mat.forEach((mm: any) => mm.dispose());
        else mat.dispose();
      }
      // Remove CSS2DObject element from DOM
      if (obj instanceof CSS2DObject && obj.element.parentNode) {
        obj.element.parentNode.removeChild(obj.element);
      }
    }
  }

  // ─── Dispose ───────────────────────────────────────────────────────────────

  dispose() {
    this._deactivate();
    this.clearAll();
    this.onDisposed.trigger(SurfaceMeasureCursor.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
    this.onMeasurementAdded.reset();
    this.onMeasurementDeleted.reset();
  }
}
