import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { CursorSurface } from "../../CursorSurface";
import {
  CoplanarFace,
  MeshData,
  WeldedSoup,
  extractCoplanarFace,
  seedTriangleAt,
  weldedSoup,
} from "./coplanarFace";
import { SurfaceMeasurement } from "./types";

/** How long the pointer must be still before an unseen item's geometry is fetched. */
const SETTLE_MS = 120;

/** Bound on cached items. Each entry is one element's welded triangle soup. */
const CACHE_LIMIT = 32;

/** Preview + border colour, matching the Area tool. */
const ACCENT = 0x24a6f1;

/**
 * The slice of a FRAGS raycast hit this engine needs.
 *
 * Declared structurally rather than imported: `OBC.Raycasters.castRay()` returns a
 * union of a plain `THREE.Intersection` and a FRAGS `RaycastResult`, and only the
 * latter carries `localId`/`fragments`. Narrowing through this shape keeps the
 * engine typed without asserting across that union.
 */
interface FragmentHit {
  point: THREE.Vector3;
  normal?: THREE.Vector3;
  localId: number;
  fragments: {
    modelId: string;
    object: THREE.Object3D;
    getItemsGeometry(localIds: number[]): Promise<PartialMeshData[][]>;
  };
}

/** `MeshData` as the worker actually returns it — every geometry field optional. */
type PartialMeshData = Partial<MeshData> & { transform?: THREE.Matrix4 };

function isFragmentHit(hit: unknown): hit is FragmentHit {
  if (hit === null || typeof hit !== "object") return false;
  const candidate = hit as Partial<FragmentHit>;
  // Duck-typed rather than `point instanceof THREE.Vector3`: if the vendor ever
  // resolves its own copy of three, `instanceof` fails across module instances and
  // every hit would be silently discarded — the tool would look completely dead.
  const point = candidate.point;
  return (
    typeof point === "object" &&
    point !== null &&
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    typeof point.z === "number" &&
    typeof candidate.localId === "number" &&
    typeof candidate.fragments === "object" &&
    candidate.fragments !== null
  );
}

/** Area of one closed ring, projected onto its own plane. Always positive. */
function ringArea(ring: THREE.Vector3[], normal: THREE.Vector3): number {
  let doubled = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a === undefined || b === undefined) continue;
    doubled += new THREE.Vector3().crossVectors(a, b).dot(normal);
  }
  return Math.abs(doubled) / 2;
}

/** Plane normal of a ring, from its largest-magnitude Newell vector. */
function ringNormal(ring: THREE.Vector3[]): THREE.Vector3 {
  const n = new THREE.Vector3();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a === undefined || b === undefined) continue;
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  }
  const len = n.length();
  return len > 0 ? n.divideScalar(len) : new THREE.Vector3(0, 1, 0);
}

/**
 * A measurement label.
 *
 * `"edge"` is the original pill, unchanged — per-side lengths keep the look they
 * always had. `"area"` differs by **colour only**: the same pill, filled with the
 * accent, so the headline area reading cannot be mistaken for one more length.
 * Geometry, padding, size and weight are deliberately identical between the two.
 */
function pillLabel(text: string, variant: "area" | "edge"): CSS2DObject {
  const div = document.createElement("div");
  const isArea = variant === "area";
  div.style.cssText = `
    background: ${isArea ? "var(--color-accent-2)" : "rgba(10,20,40,0.85)"};
    color: ${isArea ? "var(--color-bg)" : "#fff"};
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    font-family: Inter, system-ui, sans-serif;
    white-space: nowrap;
    pointer-events: none;
    border: 1.5px solid ${isArea ? "rgba(0,0,0,0.35)" : "rgba(36,166,241,0.7)"};
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  `;
  div.textContent = text;
  return new CSS2DObject(div);
}

/**
 * Everything the Surface measure tool does, minus its registration.
 *
 * A plain class rather than an `OBC.Component`, for the same reason
 * `MeasureCursorEngine` is one — see `docs/feature/bim-viewer.md` § Measure tools.
 *
 * **Why this is not part of the Length/Area family.** Those two share
 * `MeasureCursorEngine` because both drive an `OBF.Measurement` through
 * `MeasureCursorDescriptor`. Surface has no vendor measurer at all: it derives a
 * coplanar face from worker geometry and owns its own registry, so the only thing
 * it shares with them is the click discriminator.
 *
 * **Why geometry is fetched per item.** Fragment models expose no CPU geometry on
 * the main thread and `world.meshes` is empty for the app's lifetime — see
 * ADR-0003, which deleted the picking meshes that used to provide it. So a hovered
 * element's triangles are pulled from the worker via `getItemsGeometry` once,
 * welded into world space, and cached.
 */
export class SurfaceMeasureEngine {
  readonly onMeasurementAdded = new OBC.Event<SurfaceMeasurement>();
  readonly onMeasurementDeleted = new OBC.Event<string>();

  /** All confirmed measurements. Nothing persists past the viewport. */
  readonly measurements: SurfaceMeasurement[] = [];

  private readonly _components: OBC.Components;
  private _world: OBC.World | null = null;
  private _enabled = false;
  private _active = false;

  private _canvas: HTMLCanvasElement | null = null;
  private _raycastInProgress = false;
  private _settleTimer: ReturnType<typeof setTimeout> | null = null;

  /** Welded soup per element, keyed `modelId:localId`. Insertion-ordered LRU. */
  private readonly _itemCache = new Map<string, WeldedSoup>();
  /** Extracted face per seed triangle, keyed `modelId:localId:seedTriangle`. */
  private readonly _faceCache = new Map<string, CoplanarFace>();

  /** Most recent fragment hit, so a click inside the settle window still resolves. */
  private _lastHit: FragmentHit | null = null;
  private _hoverFace: CoplanarFace | null = null;
  private _hoverNormal: THREE.Vector3 | null = null;
  private _hoverMesh: THREE.Mesh | null = null;

  constructor(components: OBC.Components) {
    this._components = components;
  }

  get world() {
    return this._world;
  }

  set world(value: OBC.World | null) {
    if (this._world === value) return;
    this._deactivate();
    this._world = value;
    if (this._enabled) this._activate();
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value: boolean) {
    if (this._enabled === value) return;
    this._enabled = value;
    if (value) this._activate();
    else this._deactivate();
  }

  // ─── Activation ─────────────────────────────────────────────────────────────

  private _activate() {
    if (this._active || !this._world) return;
    const canvas = this._world.renderer?.three?.domElement ?? null;
    if (!canvas) return;

    this._active = true;
    this._canvas = canvas;
    this._components.get(CursorSurface).setWorld(this._world);

    canvas.addEventListener("mousemove", this._onMouseMove);
    canvas.addEventListener("click", this._onClick);
    this._fragments().list.onItemDeleted.add(this._invalidateCache);
    this._fragments().list.onItemSet.add(this._invalidateCache);
  }

  private _deactivate() {
    if (!this._active) return;
    this._active = false;

    this._canvas?.removeEventListener("mousemove", this._onMouseMove);
    this._canvas?.removeEventListener("click", this._onClick);
    this._canvas = null;

    this._fragments().list.onItemDeleted.remove(this._invalidateCache);
    this._fragments().list.onItemSet.remove(this._invalidateCache);

    this._cancelSettle();
    this._lastHit = null;
    this._clearHover();
    this._components.get(CursorSurface).hide();
  }

  private _fragments() {
    return this._components.get(OBC.FragmentsManager);
  }

  /**
   * Drop everything on any model add/remove.
   *
   * Deliberately coarse: evicting only the affected model would mean depending on
   * the `onItemDeleted` payload shape, and the cache is capped at 32 entries, so
   * rebuilding it costs one worker call per element the user hovers again.
   */
  private _invalidateCache = () => {
    this._itemCache.clear();
    this._faceCache.clear();
    this._clearHover();
  };

  // ─── Hover ──────────────────────────────────────────────────────────────────

  private _onMouseMove = () => {
    if (!this._world || this._raycastInProgress) return;
    this._raycastInProgress = true;

    const raycaster = this._components.get(OBC.Raycasters).get(this._world);
    raycaster
      .castRay()
      .then((hit) => {
        if (!this._active) return;
        if (!isFragmentHit(hit)) {
          this._cancelSettle();
          this._lastHit = null;
          this._clearHover();
          this._components.get(CursorSurface).hide();
          return;
        }

        this._lastHit = hit;
        const normal = hit.normal ?? undefined;
        if (normal) this._components.get(CursorSurface).update(hit.point, normal);

        const key = `${hit.fragments.modelId}:${hit.localId}`;
        const cached = this._itemCache.get(key);
        if (cached) {
          // Cache hit — resolve immediately so re-hovering a known face is instant.
          this._cancelSettle();
          this._showFace(key, cached, hit.point, normal);
          return;
        }

        this._scheduleSettle(key, hit);
      })
      .catch(() => {
        this._clearHover();
      })
      .finally(() => {
        this._raycastInProgress = false;
      });
  };

  /** Defer the worker fetch until the pointer stops, so sweeping costs nothing. */
  private _scheduleSettle(key: string, hit: FragmentHit) {
    this._cancelSettle();
    this._settleTimer = setTimeout(() => {
      this._settleTimer = null;
      void this._fetchAndShow(key, hit);
    }, SETTLE_MS);
  }

  private _cancelSettle() {
    if (this._settleTimer === null) return;
    clearTimeout(this._settleTimer);
    this._settleTimer = null;
  }

  private async _fetchAndShow(key: string, hit: FragmentHit) {
    const model = hit.fragments;
    let raw: PartialMeshData[][];
    try {
      raw = await model.getItemsGeometry([hit.localId]);
    } catch {
      return;
    }
    if (!this._active) return;

    const meshes: MeshData[] = [];
    for (const perItem of raw) {
      for (const part of perItem) {
        if (!part.positions || !part.indices || !part.transform) continue;
        meshes.push({
          positions: part.positions,
          indices: part.indices,
          transform: part.transform,
        });
      }
    }
    if (meshes.length === 0) return;

    model.object.updateWorldMatrix(true, false);
    const soup = weldedSoup(meshes, model.object.matrixWorld);
    this._remember(key, soup);
    this._showFace(key, soup, hit.point, hit.normal ?? undefined);
  }

  /** Insert into the LRU, evicting the oldest entry past the cap. */
  private _remember(key: string, soup: WeldedSoup) {
    this._itemCache.set(key, soup);
    while (this._itemCache.size > CACHE_LIMIT) {
      const oldest = this._itemCache.keys().next();
      if (oldest.done) break;
      this._itemCache.delete(oldest.value);
    }
  }

  private _showFace(
    key: string,
    soup: WeldedSoup,
    point: THREE.Vector3,
    normal: THREE.Vector3 | undefined,
  ) {
    const seed = seedTriangleAt(soup, point, normal);
    if (seed === null) {
      this._clearHover();
      return;
    }

    const faceKey = `${key}:${seed}`;
    let face = this._faceCache.get(faceKey);
    if (!face) {
      const extracted = extractCoplanarFace(soup, seed);
      if (!extracted) {
        this._clearHover();
        return;
      }
      face = extracted;
      this._faceCache.set(faceKey, face);
    }

    this._hoverFace = face;
    this._hoverNormal = soup.normals[seed]?.clone() ?? ringNormal(face.outer);
    this._drawHover(face, this._hoverNormal);
  }

  private _drawHover(face: CoplanarFace, normal: THREE.Vector3) {
    // Only the mesh — NOT the hover state. `_clearHover()` here would null the
    // `_hoverFace`/`_hoverNormal` its caller just assigned, and `_confirmFace`
    // would then bail on every click.
    this._clearHoverMesh();
    if (!this._world || face.outer.length < 3) return;

    const shape = this._toShape(face, normal);
    if (!shape) return;

    const mesh = new THREE.Mesh(
      shape,
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
        depthTest: false,
      }),
    );
    // Lift off the surface so it does not z-fight the face it highlights.
    mesh.position.addScaledVector(normal, 0.002);
    mesh.renderOrder = 999;
    this._world.scene.three.add(mesh);
    this._hoverMesh = mesh;
  }

  /**
   * Triangulate the face, holes included, by flattening onto its own plane.
   *
   * `THREE.ShapeGeometry` is 2D, so the ring is rotated flat, triangulated with its
   * holes, then rotated back — which is what makes an opening render as a hole
   * rather than as filled area.
   */
  private _toShape(face: CoplanarFace, normal: THREE.Vector3): THREE.BufferGeometry | null {
    const first = face.outer[0];
    if (!first) return null;

    const toFlat = new THREE.Quaternion().setFromUnitVectors(
      normal,
      new THREE.Vector3(0, 0, 1),
    );
    const flatten = (ring: THREE.Vector3[]) =>
      ring.map((v) => {
        const local = v.clone().sub(first).applyQuaternion(toFlat);
        return new THREE.Vector2(local.x, local.y);
      });

    const shape = new THREE.Shape(flatten(face.outer));
    for (const hole of face.holes) {
      if (hole.length >= 3) shape.holes.push(new THREE.Path(flatten(hole)));
    }

    const geometry = new THREE.ShapeGeometry(shape);
    geometry.applyQuaternion(toFlat.clone().invert());
    geometry.translate(first.x, first.y, first.z);
    return geometry;
  }

  /** Forget the hovered face entirely — state and preview. */
  private _clearHover() {
    this._hoverFace = null;
    this._hoverNormal = null;
    this._clearHoverMesh();
  }

  /** Drop just the preview mesh, leaving the hovered face intact. */
  private _clearHoverMesh() {
    if (!this._hoverMesh) return;
    this._world?.scene.three.remove(this._hoverMesh);
    this._hoverMesh.geometry.dispose();
    const material = this._hoverMesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
    this._hoverMesh = null;
  }

  // ─── Confirm ────────────────────────────────────────────────────────────────

  private _onClick = () => {
    if (this._hoverFace) {
      this._confirmFace();
      return;
    }
    // The click landed inside the settle window, before the face resolved. Resolve
    // it now rather than dropping the click — otherwise clicking promptly after
    // moving onto a face silently does nothing.
    const hit = this._lastHit;
    if (!hit) return;
    this._cancelSettle();
    void this._resolveThenConfirm(hit);
  };

  private async _resolveThenConfirm(hit: FragmentHit) {
    const key = `${hit.fragments.modelId}:${hit.localId}`;
    const cached = this._itemCache.get(key);
    if (cached) this._showFace(key, cached, hit.point, hit.normal ?? undefined);
    else await this._fetchAndShow(key, hit);
    if (this._hoverFace) this._confirmFace();
  }

  private _confirmFace() {
    const face = this._hoverFace;
    const normal = this._hoverNormal;
    if (!face || !normal || !this._world || face.outer.length < 3) return;

    const polygon = face.outer.map((v) => v.clone());
    const holes = face.holes.map((ring) => ring.map((v) => v.clone()));

    const edgeLengths: number[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      if (a === undefined || b === undefined) continue;
      edgeLengths.push(a.distanceTo(b));
    }

    // Net area: the outer ring minus every opening it encloses.
    const grossArea = ringArea(polygon, normal);
    const holeArea = holes.reduce((sum, ring) => sum + ringArea(ring, normal), 0);
    const area = Math.max(0, grossArea - holeArea);

    const centroid = new THREE.Vector3();
    for (const v of polygon) centroid.add(v);
    centroid.divideScalar(polygon.length);

    const scene = this._world.scene.three;
    const objects: THREE.Object3D[] = [];
    const labelObjects: CSS2DObject[] = [];

    const borderMaterial = new THREE.LineBasicMaterial({
      color: ACCENT,
      depthTest: false,
    });
    for (const ring of [polygon, ...holes]) {
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ring),
        borderMaterial,
      );
      line.renderOrder = 1000;
      scene.add(line);
      objects.push(line);
    }

    for (let i = 0; i < polygon.length; i++) {
      const length = edgeLengths[i];
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      // Sub-5 cm edges are triangulation noise; labelling them just adds clutter.
      if (length === undefined || length < 0.05 || !a || !b) continue;

      const mid = new THREE.Vector3().lerpVectors(a, b, 0.5);
      const outward = new THREE.Vector3().subVectors(mid, centroid).normalize();
      const label = pillLabel(`~ ${length.toFixed(2)} m`, "edge");
      label.position.copy(mid.addScaledVector(outward, 0.15));
      scene.add(label);
      objects.push(label);
      labelObjects.push(label);
    }

    const areaLabel = pillLabel(
      holes.length > 0
        ? `Net area: ~ ${area.toFixed(2)} m² (${holes.length} opening${holes.length > 1 ? "s" : ""})`
        : `Total area: ~ ${area.toFixed(2)} m²`,
      "area",
    );
    areaLabel.position.copy(centroid.clone().addScaledVector(normal, 0.3));
    scene.add(areaLabel);
    objects.push(areaLabel);
    labelObjects.push(areaLabel);

    const measurement: SurfaceMeasurement = {
      id: crypto.randomUUID(),
      polygon,
      holes,
      area,
      edgeLengths,
      objects,
      labelObjects,
      visible: true,
    };

    this.measurements.push(measurement);
    this.onMeasurementAdded.trigger(measurement);
    this._clearHover();
  }

  // ─── Registry ───────────────────────────────────────────────────────────────

  deleteMeasurement(id: string) {
    const index = this.measurements.findIndex((m) => m.id === id);
    if (index === -1) return;
    const measurement = this.measurements[index];
    if (measurement) this._disposeMeasurement(measurement);
    this.measurements.splice(index, 1);
    this.onMeasurementDeleted.trigger(id);
  }

  setMeasurementVisible(id: string, visible: boolean) {
    const measurement = this.measurements.find((m) => m.id === id);
    if (!measurement) return;
    measurement.visible = visible;
    for (const object of measurement.objects) object.visible = visible;
  }

  clearAll() {
    for (const measurement of [...this.measurements]) {
      this._disposeMeasurement(measurement);
    }
    this.measurements.length = 0;
  }

  /**
   * Free one measurement's GPU and DOM resources.
   *
   * The label elements are detached even when no world is set — they live in the
   * CSS2D overlay, not the scene graph, so an early return on a missing world
   * would leak them into the DOM.
   */
  private _disposeMeasurement(measurement: SurfaceMeasurement) {
    const scene = this._world?.scene.three;
    for (const object of measurement.objects) {
      scene?.remove(object);
      if (object instanceof THREE.Line || object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    }
    for (const label of measurement.labelObjects) {
      label.element.parentNode?.removeChild(label.element);
    }
  }

  dispose() {
    this._deactivate();
    this.clearAll();
    this._itemCache.clear();
    this._faceCache.clear();
    this.onMeasurementAdded.reset();
    this.onMeasurementDeleted.reset();
  }
}
