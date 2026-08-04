import * as OBC from "@thatopen/components";
import * as THREE from "three";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so
// vite-tsconfig-paths does not rewrite aliases inside this folder. Repo-wide convention here.
import { AxisDragManager, AxisGizmoHandle, GizmoAxis } from "../GizmoAxis";
import { BoxFacesManager } from "./src/BoxFacesManager";
import { BoxOutlineManager } from "./src/BoxOutlineManager";
import { BOX_FACES, BoxFaceId, SectionBoxState } from "./src/types";

export * from "./src";

/**
 * The gap a face may not push past its opposite, derived from the live near plane the way
 * `CursorZoom` derives its standoff — so the two cannot drift, and neither is a magic number.
 * A box thinner than the near plane would render as nothing at all.
 */
const NEAR_GAP_FACTOR = 2.5;
/** Keeps the gap meaningful on a large model, where 0.25 m is imperceptibly thin. */
const DIAGONAL_GAP_RATIO = 0.001;
/** Floor for the case where there is no camera and no box yet, so both terms above are 0. */
const ABSOLUTE_MIN_GAP = 0.05;

/**
 * A resizable crop volume: six inward clipping planes, an edge outline, and one grabbable
 * arrow per face.
 *
 * **It is view state, not a pointer mode, and deliberately does not touch `bimStore.activeTool`.**
 * `ViewportRightToolbar` suppresses `Hoverer`, `Outliner` *and* `postproduction` for as long as
 * `activeTool !== "select"`, so wiring the box to it would kill selection outlines and the whole
 * post pass for as long as the box was cropping, and switching on Measure would silently drop the
 * crop. Consequence, intended: a box and a cut plane can both be live, and you can measure inside
 * a box.
 *
 * `ClipAwareRaycaster` needs nothing from this class — it filters picks against
 * `renderer.three.clippingPlanes`, which is exactly the array {@link BoxFacesManager} writes to,
 * so selecting, hovering and measuring inside the box are correct the moment it turns on.
 *
 * This class holds the state React subscribes to and the box arithmetic; its two managers own
 * and free their own objects:
 *
 * - {@link BoxFacesManager} — the six planes and the renderer registration
 * - {@link BoxOutlineManager} — the twelve edges
 *
 * The arrows belong to {@link GizmoAxis} and the pointer handling to {@link AxisDragManager},
 * both shared with `ClipperCursor`.
 */
export class SectionBox extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "7f2a9c14-6b83-4e57-9d21-3ac5e08b4f6d" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  private readonly _components: OBC.Components;
  private readonly _outline = new BoxOutlineManager();
  private readonly _gizmos = new Map<BoxFaceId, AxisGizmoHandle>();
  /**
   * One per face, at that face's centre. Detached from any scene on purpose: `GizmoAxis` only
   * reads `follow.matrixWorld` after `updateWorldMatrix`, which resolves fine with no parent.
   */
  private readonly _anchors = new Map<BoxFaceId, THREE.Object3D>();

  private _world: OBC.World | null = null;
  private _viewport: HTMLElement | null = null;
  private _faces: BoxFacesManager | null = null;
  private _drag: AxisDragManager | null = null;
  private _box: THREE.Box3 | null = null;
  private _active = false;

  constructor(components: OBC.Components) {
    super(components);
    this._components = components;
    components.add(SectionBox.uuid, this);

    for (const face of BOX_FACES) {
      this._anchors.set(face.id, new THREE.Object3D());
    }
  }

  get world() {
    return this._world;
  }

  set world(world: OBC.World | null) {
    this._world = world;
    this._teardownWorldParts();
    this._buildIfReady();
  }

  get viewport() {
    return this._viewport;
  }

  set viewport(viewport: HTMLElement | null) {
    this._viewport = viewport;
    this._teardownWorldParts();
    this._buildIfReady();
  }

  /** True while the box is cropping. Read by ToolbarSectionBox. */
  get active() {
    return this._active;
  }

  /** Flat snapshot for React. Extents are `null` until a box has been measured. */
  get state(): SectionBoxState {
    const box = this._box;
    return {
      active: this._active,
      min: box ? { x: box.min.x, y: box.min.y, z: box.min.z } : null,
      max: box ? { x: box.max.x, y: box.max.y, z: box.max.z } : null,
    };
  }

  /**
   * Starts cropping, measuring the loaded models first if there is no box yet. Returns false
   * when there is nothing measurable — no model, or one still loading.
   */
  enable() {
    if (this._active) return true;
    if (!this._box && !this._measureModels()) return false;

    this._activate();
    this.onStateChanged.trigger();
    return true;
  }

  disable() {
    if (!this._active) return;

    this._active = false;
    this._faces?.detach();
    this._outline.visible = false;
    this._drag?.end();
    this._syncGizmos();
    this.onStateChanged.trigger();
  }

  toggle() {
    return this._active ? (this.disable(), false) : this.enable();
  }

  /**
   * Resets the box to the full extents of everything loaded, and starts cropping if it wasn't.
   *
   * ⚠️ **Read on user action only.** `BoundingBoxer.addFromModels()` unions each `model.box`, and
   * a model sits in `fragments.list` while it is still loading, so a load-time read can
   * legitimately return an empty box — the trap `ClipperOutlineManager` documents. Every read
   * here is behind a click, so it is always post-processing. The deliberate consequence is that a
   * model loaded while the box is on does **not** grow the box: a crop the user set must not jump,
   * and this method is how they ask for it to be re-measured.
   */
  fitToModels() {
    if (!this._measureModels()) return false;

    this._activate();
    this.onStateChanged.trigger();
    return true;
  }

  /**
   * Shrinks the box onto a selection, and starts cropping if it wasn't. Padded by one min gap so
   * the selected elements are not sliced by their own box.
   *
   * Takes the map rather than reaching for `OBF.Highlighter` itself: which selection counts is a
   * UI policy, and the toolbar is the only place that knows the live selection is the one to use
   * (`bimStore.selectionMap` is a clone one event behind).
   */
  async fitToSelection(selection: OBC.ModelIdMap) {
    const boxer = this._components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    await boxer.addFromModelIdMap(selection);
    const box = boxer.get();
    boxer.list.clear();

    if (!box || box.isEmpty()) return false;
    box.expandByScalar(this._gapFor(box));

    this._setBox(box);
    this._activate();
    this.onStateChanged.trigger();
    return true;
  }

  dispose() {
    this._drag?.dispose();
    this._drag = null;

    // Before anything else that could make the renderer unreachable: this is what stops the six
    // planes cropping. A leaked plane keeps cutting with no UI left to switch it off.
    this._faces?.dispose();
    this._faces = null;

    this._components.get(GizmoAxis).overlay.remove(this._outline.object);
    this._outline.dispose();

    for (const [, gizmo] of this._gizmos) gizmo.dispose();
    this._gizmos.clear();
    this._anchors.clear();

    this._box = null;
    this._active = false;

    this.onDisposed.trigger(SectionBox.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }

  /** Turns cropping on without measuring or firing an event — callers do both around it. */
  private _activate() {
    if (this._active) {
      // Already on, but the box may have just moved: keep the planes matching it.
      if (this._box) this._faces?.apply(this._box);
      return;
    }
    this._active = true;
    this._faces?.attach();
    this._outline.visible = true;
    this._syncGizmos();
  }

  /** Everything that needs both a world and a viewport, built once both have arrived. */
  private _buildIfReady() {
    const world = this._world;
    const viewport = this._viewport;
    if (!world || !viewport || this._faces) return;

    this._faces = new BoxFacesManager(world);

    const gizmoAxis = this._components.get(GizmoAxis);
    gizmoAxis.overlay.add(this._outline.object);

    // Created once and hidden, rather than built and torn down per activation: an invisible
    // gizmo costs one matrix update a frame, and `pickTargets` already filters on `visible`.
    for (const face of BOX_FACES) {
      const anchor = this._anchors.get(face.id);
      if (!anchor) continue;
      this._gizmos.set(
        face.id,
        gizmoAxis.create({
          follow: anchor,
          grabAxis: face.axis,
          form: "arrow",
          direction: face.outward,
        }),
      );
    }

    this._drag = new AxisDragManager({
      world,
      viewport,
      pickTargets: () =>
        [...this._gizmos]
          .filter(([, handle]) => handle.visible)
          .map(([faceId, handle]) => ({ mesh: handle.picker, id: faceId })),
      // Nothing is grabbable while the box is off; the gizmos are hidden anyway, but this also
      // stops the hover raycast and the `grab` cursor.
      isSuspended: () => !this._active,
      getAxis: (faceId) => {
        const face = BOX_FACES.find((f) => f.id === faceId);
        return face ? this._axisVector(face.axis) : null;
      },
      getOrigin: (faceId) => this._anchors.get(faceId as BoxFaceId)?.position.clone() ?? null,
      onDrag: (faceId, position) => this._moveFace(faceId as BoxFaceId, position),
      onSelect: () => {
        // A box has no selection concept — every face is always live.
      },
    });

    this._drag.onStateChanged.add(() => this._repaintGizmos());

    if (this._box) this._setBox(this._box);
  }

  /** Frees the parts tied to a specific world/viewport, so the setters can be re-run. */
  private _teardownWorldParts() {
    if (!this._faces && !this._drag) return;

    this._drag?.dispose();
    this._drag = null;
    this._faces?.dispose();
    this._faces = null;

    const gizmoAxis = this._components.get(GizmoAxis);
    gizmoAxis.overlay.remove(this._outline.object);
    for (const [, gizmo] of this._gizmos) gizmo.dispose();
    this._gizmos.clear();

    this._active = false;
    this._outline.visible = false;
  }

  /**
   * Applies a drag to one face: only the component along that face's own axis matters, and an
   * inward drag stops one min gap short of the opposite face so the box can never invert or
   * collapse. Outward is unbounded — dragging a face past the model is how you uncrop that side.
   */
  private _moveFace(faceId: BoxFaceId, position: THREE.Vector3) {
    const face = BOX_FACES.find((f) => f.id === faceId);
    const box = this._box;
    if (!face || !box) return;

    const gap = this._gapFor(box);
    const value = position[face.axis];
    const next = box.clone();

    if (face.outward === -1) {
      next.min[face.axis] = Math.min(value, box.max[face.axis] - gap);
    } else {
      next.max[face.axis] = Math.max(value, box.min[face.axis] + gap);
    }

    this._setBox(next);
  }

  private _setBox(box: THREE.Box3) {
    this._box = box;
    this._faces?.apply(box);
    this._outline.update(box);

    // Each anchor sits at its face's centre: the box centre, with that one axis pushed out to
    // the bound the face carries. So the arrow always grows from the middle of what it moves.
    const center = box.getCenter(new THREE.Vector3());
    for (const face of BOX_FACES) {
      const anchor = this._anchors.get(face.id);
      if (!anchor) continue;
      anchor.position.copy(center);
      anchor.position[face.axis] = face.outward === -1 ? box.min[face.axis] : box.max[face.axis];
    }

    this.onStateChanged.trigger();
  }

  /** Reads the loaded models' extents into the box. False when there is nothing measurable. */
  private _measureModels() {
    const boxer = this._components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();

    if (!box || box.isEmpty()) return false;

    const diagonal = box.min.distanceTo(box.max);
    if (!Number.isFinite(diagonal) || diagonal <= 0) return false;

    this._setBox(box);
    return true;
  }

  /** The min gap for a given box, derived rather than configured. */
  private _gapFor(box: THREE.Box3 | null) {
    let near = 0;
    try {
      near = (this._world?.camera as any)?.three?.near ?? 0;
    } catch {
      near = 0;
    }
    const diagonal = box && !box.isEmpty() ? box.min.distanceTo(box.max) : 0;
    return Math.max(near * NEAR_GAP_FACTOR, diagonal * DIAGONAL_GAP_RATIO, ABSOLUTE_MIN_GAP);
  }

  private _syncGizmos() {
    for (const [, gizmo] of this._gizmos) gizmo.visible = this._active;
  }

  /** The grabbed arrow turns yellow, the same way a selected cut plane's does. */
  private _repaintGizmos() {
    const live = this._drag?.draggingId ?? this._drag?.hoveredId ?? null;
    for (const [faceId, gizmo] of this._gizmos) {
      gizmo.highlighted = faceId === live;
    }
  }

  private _axisVector(axis: "x" | "y" | "z") {
    return new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  }
}
