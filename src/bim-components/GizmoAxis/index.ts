import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { AXIS_COLORS, HIGHLIGHT_COLOR, PlaneAxis } from "./src/axis";
import { buildAxisGizmo, GIZMO_LENGTH } from "./src/axis-gizmo-mesh";
import { AxisGizmoHandle, AxisGizmoOptions } from "./src/types";

export * from "./src";

/**
 * How far one axis reaches, as a fraction of the viewport's world-space height at the
 * gizmo's depth, which is what keeps a gizmo the same size on screen at any zoom.
 * Tune this one number to resize every gizmo.
 */
const GIZMO_VIEW_FRACTION = 0.068;

/** One live gizmo. Private: consumers only ever see it as an {@link AxisGizmoHandle}. */
class AxisGizmo implements AxisGizmoHandle {
  readonly grabAxis: PlaneAxis;
  readonly picker: THREE.Mesh;
  readonly group: THREE.Group;
  readonly follow: THREE.Object3D;

  private readonly _grabMaterials: (THREE.LineBasicMaterial | THREE.MeshBasicMaterial)[];
  private _highlighted = false;
  private _disposed = false;

  constructor(
    options: AxisGizmoOptions,
    private readonly _release: (gizmo: AxisGizmo) => void,
  ) {
    const { group, picker, grabMaterials } = buildAxisGizmo(options.grabAxis);
    this.group = group;
    this.picker = picker;
    this._grabMaterials = grabMaterials;
    this.grabAxis = options.grabAxis;
    this.follow = options.follow;
  }

  get visible() {
    return this.group.visible;
  }

  set visible(state: boolean) {
    this.group.visible = state;
  }

  get highlighted() {
    return this._highlighted;
  }

  set highlighted(state: boolean) {
    if (this._highlighted === state) return;
    this._highlighted = state;

    const color = state ? HIGHLIGHT_COLOR : AXIS_COLORS[this.grabAxis];
    for (const material of this._grabMaterials) {
      material.color.setHex(color);
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    this._release(this);

    this.group.traverse((child) => {
      const mesh = child as Partial<THREE.Mesh>;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
  }
}

/**
 * Reusable world-aligned axis gizmos, drawn on top of everything.
 *
 * Every gizmo lives in **one** overlay scene rendered in a second pass with the clipping
 * planes suspended and `depthTest: false`. That is what makes a gizmo always visible — and
 * so always grabbable — however the model sits in front of it, and keeping a single scene
 * means the second and third consumers cost no extra render pass.
 *
 * ```ts
 * const gizmoAxis = components.get(GizmoAxis); // no cast needed — 1-arg constructor
 * const handle = gizmoAxis.create({ follow: plane.helper, grabAxis: axisOf(normal).axis });
 * handle.visible = true;
 * // raycast handle.picker to detect a grab; handle.dispose() when done
 * ```
 *
 * **Current limits, deliberately not parameterised while there is a single consumer.** A
 * gizmo tracks its target's *position* and ignores its rotation, holds a fixed fraction of
 * the viewport height, and has exactly one grabbable axis. World-alignment in particular is
 * BIMBOY's section-plane rationale — arrow and outline colours agreeing — not a universal
 * one, so an `orientation: "world" | "follow"` option is the first thing a second consumer
 * will want. It is about four lines.
 */
export class GizmoAxis extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "5b8d4e17-3a6c-42f9-b1d5-9c7e2f04a836" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();

  private readonly _scene = new THREE.Scene();
  private readonly _gizmos = new Set<AxisGizmo>();

  private _world: OBC.World | null = null;
  /** Held separately from the world: `world.renderer` may be gone by teardown time. */
  private _renderer: OBC.BaseRenderer | null = null;
  private _onAfterUpdate: (() => void) | null = null;

  constructor(components: OBC.Components) {
    super(components);
    components.add(GizmoAxis.uuid, this);
  }

  get world() {
    return this._world;
  }

  /** Setting a world moves the overlay render pass onto it. */
  set world(world: OBC.World | null) {
    this._detachRenderPass();
    this._world = world;
    if (world) this._attachRenderPass(world);
  }

  /** Builds a gizmo and adds it to the overlay scene. Starts hidden. */
  create(options: AxisGizmoOptions): AxisGizmoHandle {
    const gizmo = new AxisGizmo(options, (released) => {
      this._scene.remove(released.group);
      this._gizmos.delete(released);
    });

    gizmo.visible = false;
    this._scene.add(gizmo.group);
    this._gizmos.add(gizmo);
    return gizmo;
  }

  private _attachRenderPass(world: OBC.World) {
    const renderer = world.renderer;
    if (!renderer) return;

    this._onAfterUpdate = () => {
      const webgl = renderer.three;
      const camera = world.camera?.three;
      if (!webgl || !camera) return;

      // Follow each target's position but not its rotation, so the gizmo stays
      // world-axis-aligned: green along X, blue up along Y, red along Z.
      for (const gizmo of this._gizmos) {
        gizmo.follow.updateWorldMatrix(true, false);
        gizmo.group.position.setFromMatrixPosition(gizmo.follow.matrixWorld);
        gizmo.group.scale.setScalar(this._scaleAt(gizmo.group.position, camera));
      }

      const savedClippingPlanes = webgl.clippingPlanes;
      const savedAutoClear = webgl.autoClear;

      webgl.clippingPlanes = [];
      webgl.autoClear = false;

      webgl.render(this._scene, camera);

      webgl.clippingPlanes = savedClippingPlanes;
      webgl.autoClear = savedAutoClear;
    };

    renderer.onAfterUpdate.add(this._onAfterUpdate);
    this._renderer = renderer;
  }

  private _detachRenderPass() {
    if (this._onAfterUpdate && this._renderer) {
      this._renderer.onAfterUpdate.remove(this._onAfterUpdate);
    }
    this._onAfterUpdate = null;
    this._renderer = null;
  }

  /** Scale holding one axis at GIZMO_VIEW_FRACTION of the viewport height, at any distance. */
  private _scaleAt(position: THREE.Vector3, camera: THREE.Camera) {
    let viewHeight: number;

    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const ortho = camera as THREE.OrthographicCamera;
      viewHeight = (ortho.top - ortho.bottom) / (ortho.zoom || 1);
    } else {
      const perspective = camera as THREE.PerspectiveCamera;
      const distance = camera.getWorldPosition(new THREE.Vector3()).distanceTo(position);
      viewHeight = 2 * distance * Math.tan((perspective.fov * Math.PI) / 360);
    }

    if (!Number.isFinite(viewHeight) || viewHeight <= 0) return 1;
    return (viewHeight * GIZMO_VIEW_FRACTION) / GIZMO_LENGTH;
  }

  dispose() {
    this._detachRenderPass();

    // dispose() releases each gizmo back to us, which mutates the set — so snapshot first.
    for (const gizmo of [...this._gizmos]) {
      gizmo.dispose();
    }
    this._gizmos.clear();
    this._world = null;

    this.onDisposed.trigger(GizmoAxis.uuid);
    this.onDisposed.reset();
  }
}
