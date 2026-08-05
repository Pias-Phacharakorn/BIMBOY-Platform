import * as OBC from "@thatopen/components";
import * as THREE from "three";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so
// vite-tsconfig-paths does not rewrite aliases inside this folder. Repo-wide convention here.
import { AxisDragManager, AxisGizmoHandle, GizmoAxis, framePalette } from "../GizmoAxis";
import { ClipperOutlineManager } from "./src/ClipperOutlineManager";
import { ClipperPlacementManager } from "./src/ClipperPlacementManager";
import { ClipperPlaneState } from "./src/types";

export * from "./src";

/** Cut planes the ToolbarClip dropdown will let you add. */
const MAX_PLANES = 6;

/**
 * Hides and disables ThatOpen's default clipper arrow: the gizmo handle replaces it.
 *
 * Has to be re-applied after every `plane.visible` assignment, because that one setter
 * drives the plane *and* its TransformControls, so the arrow springs straight back.
 * `plane: any` because `TransformControls.getHelper()` is missing from the three types
 * resolved here, though `SimplePlane` itself calls it.
 */
const suppressDefaultArrow = (plane: any) => {
  const controls = plane.controls;
  if (!controls) return;
  const controlsHelper = controls.getHelper?.();
  if (controlsHelper) controlsHelper.visible = false;
  controls.enabled = false;
};

/**
 * Interactive section planes on top of `OBC.Clipper`.
 *
 * Each cut plane draws as a bare rectangle outline, and is moved by the one blue arrow on a
 * gizmo sitting in that plane's own frame — never by the plane itself, so a section can't
 * swallow a click meant for an element. The arrow runs along the plane's true normal, so it
 * points where the cut actually goes even on a skewed plane.
 *
 * This class holds only the state React subscribes to and the policy that coordinates the
 * three managers, each of which owns and frees its own 3D objects:
 *
 * - {@link ClipperOutlineManager} — outlines, their colours and their extent
 * - {@link AxisDragManager} — pointer handling, hover and the drag itself (shared with
 *   `SectionBox`, which is why this class supplies the plane lookups as callbacks)
 * - {@link ClipperPlacementManager} — place-a-plane-by-clicking mode
 *
 * The gizmos themselves belong to {@link GizmoAxis}, a shared engine service: this class
 * only keeps the handles it was given, one per plane.
 */
export class ClipperCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "3c1e220a-8a56-42d4-a114-1e0f6cb7d934" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  public planes: ClipperPlaneState[] = [];
  public nextPlaneIndex = 1;
  public selectedPlaneId: string | null = null;

  public readonly outlines: ClipperOutlineManager;
  public readonly drag: AxisDragManager;
  public readonly placement: ClipperPlacementManager;

  private readonly _world: OBC.World;
  private readonly _components: OBC.Components;
  private readonly _gizmoAxis: GizmoAxis;
  /** One gizmo handle per plane. Nothing else can reach them. */
  private readonly _gizmos = new Map<string, AxisGizmoHandle>();
  /**
   * One per plane, at the middle of that plane's outline rather than at the point the user
   * clicked — the same reason `SectionBox` anchors its arrows at face centres. Detached from any
   * scene on purpose: `GizmoAxis` only reads `follow.matrixWorld` after `updateWorldMatrix`,
   * which resolves fine with no parent.
   *
   * Each carries the **helper's rotation** as well as the offset position, because the `"plane"`
   * gizmo form grabs its target's local +Z — hand it an unrotated anchor and the arrow would
   * point down world Z instead of along the cut.
   */
  private readonly _anchors = new Map<string, THREE.Object3D>();
  /** Scratch for the in-plane offset, read on every drag frame. */
  private readonly _offset = new THREE.Vector3();

  constructor(components: OBC.Components, world: OBC.World, viewport: HTMLElement) {
    super(components);
    this._components = components;
    this._world = world;

    components.add(ClipperCursor.uuid, this);

    this.outlines = new ClipperOutlineManager(components);
    this._gizmoAxis = components.get(GizmoAxis);

    this.placement = new ClipperPlacementManager({
      components,
      world,
      viewport,
      canPlace: () => this.planes.length < MAX_PLANES,
      onPlace: (normal, point) => this._createPlane(normal, point),
      onEnter: () => this.drag.clearHover(),
    });
    this.placement.onChanged.add(() => this.onStateChanged.trigger());

    // The manager knows nothing about clipping: these four callbacks are the whole of what a
    // "plane" means to it, which is what lets SectionBox drive the same pointer handling.
    this.drag = new AxisDragManager({
      world,
      viewport,
      pickTargets: () =>
        [...this._gizmos]
          .filter(([, handle]) => handle.visible)
          .map(([planeId, handle]) => ({ mesh: handle.picker, id: planeId })),
      pickSelectTargets: () => this.outlines.getPickableMeshes(),
      isSuspended: () => this.placement.placing,
      getAxis: (planeId) => this._clipper.list.get(planeId)?.normal.clone() ?? null,
      // The gizmo sits at the outline's middle, so that — not the helper — is where the drag
      // starts from, or the arrow would jump to the cursor on grab.
      getOrigin: (planeId) => this._anchors.get(planeId)?.position.clone() ?? null,
      onDrag: (planeId, position) => {
        const plane = this._clipper.list.get(planeId);
        if (!plane) return;
        // `position` is the anchor displaced purely along the normal (AxisDragManager only ever
        // moves along the axis), and the anchor sits an in-plane offset from the helper. That
        // offset is perpendicular to the drag, so subtracting it recovers the helper's new
        // position exactly rather than approximately.
        this.outlines.centerOffset(planeId, this._offset);
        plane.helper.position.copy(position).sub(this._offset);
        plane.helper.updateMatrix();
        plane.update();
        this._syncAnchor(planeId);
      },
      onSelect: (planeId) => {
        if (this.selectedPlaneId !== planeId) this.selectPlane(planeId);
      },
    });
    // Hover and drag change how outlines look, but not what React renders.
    this.drag.onStateChanged.add(() => this._repaintPlaneStates());

    // Loading a model refits every outline, which moves their middles — and the arrows sit at
    // those middles, so they have to move too.
    this.outlines.onFitChanged.add(() => {
      for (const planeState of this.planes) this._syncAnchor(planeState.id);
    });
  }

  /** True while a click will place a plane. Read by ToolbarClip. */
  get placing() {
    return this.placement.placing;
  }

  public selectPlane(id: string | null) {
    this.selectedPlaneId = id;
    this._syncVisibility();
    this.onStateChanged.trigger();
  }

  public togglePlane(id: string, enabled: boolean) {
    const planeState = this.planes.find((p) => p.id === id);
    if (!planeState) return;

    planeState.enabled = enabled;
    const plane = this._clipper.list.get(id);
    if (plane) plane.enabled = enabled;

    if (!enabled && this.drag.hoveredId === id) this.drag.clearHover();

    this._syncVisibility();
    this.onStateChanged.trigger();
  }

  public deletePlane(id: string) {
    if (this.drag.draggingId === id) this.drag.end();

    // Disposing the plane fires onDisposed, which is where the managers drop their entries.
    this._clipper.delete(this._world, id);
    this.planes = this.planes.filter((p) => p.id !== id);

    if (this.drag.hoveredId === id) this.drag.clearHover();

    if (this.selectedPlaneId === id) {
      this.selectedPlaneId = this.planes.length > 0 ? this.planes[0].id : null;
    }

    this.selectPlane(this.selectedPlaneId);
  }

  public enterPlacementMode() {
    this.placement.enter();
  }

  public exitPlacementMode() {
    this.placement.exit();
  }

  private get _clipper() {
    return this._components.get(OBC.Clipper);
  }

  /** The clicked surface's normal points at the camera, so the cut keeps the far side. */
  private _createPlane(normal: THREE.Vector3, point: THREE.Vector3) {
    const planeId = this._clipper.createFromNormalAndCoplanarPoint(
      this._world,
      normal.clone().negate(),
      point,
    );

    this.planes.push({ id: planeId, name: `Plane ${this.nextPlaneIndex}`, enabled: true });
    this.nextPlaneIndex++;

    this._adoptPlane(planeId);
    this.selectPlane(planeId);
  }

  /** Hands a newly created plane to the managers, and arranges for them to let go. */
  private _adoptPlane(planeId: string) {
    const plane = this._clipper.list.get(planeId);
    if (!plane) return;

    suppressDefaultArrow(plane);
    this.outlines.add(planeId, plane);

    // No grabAxis: the "plane" form grabs the helper's local +Z, which is where OBC puts the
    // normal — so the arrow runs along the actual cut however the plane is skewed, instead of
    // along whichever world axis the normal happened to be nearest.
    //
    // The palette has to be built here because only this side holds the frame: the gizmo is
    // drawn in local space and cannot tell where its rotation aims each arm. A cut square to
    // the grid gets the usual green/blue/red; a skewed one greys out, which is the honest
    // answer rather than rounding it to whichever axis it happens to be nearest.
    plane.helper.updateWorldMatrix(true, false);
    const palette = framePalette(plane.helper.getWorldQuaternion(new THREE.Quaternion()));

    // Follows the anchor, not the helper: the arrow belongs at the middle of the outline it
    // moves. `_syncAnchor` has to run first, so the gizmo's first frame is already in place.
    const anchor = new THREE.Object3D();
    this._anchors.set(planeId, anchor);
    this._syncAnchor(planeId);

    this._gizmos.set(planeId, this._gizmoAxis.create({ follow: anchor, palette }));

    plane.onDisposed.add(() => {
      this.outlines.remove(planeId);
      this._gizmos.get(planeId)?.dispose();
      this._gizmos.delete(planeId);
      this._anchors.delete(planeId);
    });
  }

  /**
   * Puts a plane's anchor at the middle of its outline, in the plane's own frame.
   *
   * The rotation is copied, not derived: a cut plane never rotates after creation, but the gizmo
   * reads rotation off whatever it follows, so the anchor has to carry it for the arrow to run
   * along the cut instead of down world Z.
   */
  private _syncAnchor(planeId: string) {
    const plane = this._clipper.list.get(planeId);
    const anchor = this._anchors.get(planeId);
    if (!plane || !anchor) return;

    plane.helper.updateWorldMatrix(true, false);
    this.outlines.centerOffset(planeId, this._offset);

    plane.helper.getWorldPosition(anchor.position).add(this._offset);
    plane.helper.getWorldQuaternion(anchor.quaternion);
    anchor.updateMatrix();
  }

  /**
   * The outline shows for every enabled plane; the gizmo — and with it the only drag handle
   * — for the selected one alone.
   */
  private _syncVisibility() {
    for (const planeState of this.planes) {
      const plane = this._clipper.list.get(planeState.id);
      const showHandles = planeState.enabled && planeState.id === this.selectedPlaneId;

      if (plane) {
        plane.visible = planeState.enabled;
        suppressDefaultArrow(plane);
      }

      const gizmo = this._gizmos.get(planeState.id);
      if (gizmo) gizmo.visible = showHandles;
    }

    this._repaintPlaneStates();
    this._clipper.enabled = this.planes.some((p) => p.enabled);
  }

  /** Outline opacity and gizmo highlight both follow the same hover/drag state. */
  private _repaintPlaneStates() {
    for (const planeState of this.planes) {
      const isActive =
        this.drag.hoveredId === planeState.id ||
        this.drag.draggingId === planeState.id;

      this.outlines.setState(
        planeState.id,
        isActive ? "active" : planeState.id === this.selectedPlaneId ? "selected" : "idle",
      );

      const gizmo = this._gizmos.get(planeState.id);
      if (gizmo) gizmo.highlighted = isActive;
    }
  }

  dispose() {
    this.placement.dispose();
    this.drag.dispose();

    for (const planeState of this.planes) {
      this._clipper.delete(this._world, planeState.id);
    }
    this.planes = [];
    this._clipper.enabled = false;

    // After the planes, so their onDisposed handlers have already dropped their entries.
    // GizmoAxis itself is a shared service and outlives us — only our handles go.
    for (const [, gizmo] of this._gizmos) gizmo.dispose();
    this._gizmos.clear();
    this._anchors.clear();
    this.outlines.dispose();

    this.onDisposed.trigger(ClipperCursor.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }
}

/** Registers the component with the world and returns its teardown. */
export const setupClipperCursor = (
  components: OBC.Components,
  world: OBC.World,
  viewport: HTMLElement,
) => {
  const clipperCursor = new ClipperCursor(components, world, viewport);
  return () => {
    clipperCursor.dispose();
  };
};
