// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import { CursorSurface } from "../../CursorSurface";
import {
  attachMeasurePickingMeshes,
  clearMeasurePickingCache,
} from "./measure-picking-meshes";

export class LengthMeasureCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "2d1a37c0-ff4d-4ea7-90d0-ecdfc812d8a6" as const;

  private _enabled = false;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  private _components: OBC.Components;
  private _world: OBC.World;

  // Detaches the background-built picking meshes from world.meshes on deactivate.
  private _pickingDetach: (() => void) | null = null;
  // Bumped on every activate/deactivate; also serves as the cancel token for the
  // in-flight background picking-mesh build.
  private _activationId = 0;

  // Event listeners
  private _viewportMouseMoveListener: (() => void) | null = null;
  private _viewportPointerDownListener: ((e: PointerEvent) => void) | null = null;
  private _viewportPointerUpListener: ((e: PointerEvent) => void) | null = null;
  private _escapeKeyListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(components: OBC.Components, world: OBC.World) {
    super(components);
    this._components = components;
    this._world = world;

    components.add(LengthMeasureCursor.uuid, this);
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

  private _activate() {
    const measurer = this._components.get(OBF.LengthMeasurement);
    const cursorSurface = this._components.get(CursorSurface);
    const canvas = this._world.renderer?.three?.domElement;

    // 1. Enable and configure the measurer for synchronous vertex snapping.
    measurer.world = this._world;
    measurer.enabled = true;
    measurer.pickerMode = OBF.GraphicVertexPickerMode.SYNCHRONOUS;
    measurer.delay = 0;
    cursorSurface.setWorld(this._world);

    // 2. Hover raycast — attached immediately so the cursor guide appears
    //    instantly (driven by the fast fragment pick), without waiting on the
    //    picking-mesh build below.
    let raycastInProgress = false;
    this._viewportMouseMoveListener = () => {
      if (raycastInProgress) return;
      raycastInProgress = true;
      const raycasters = this._components.get(OBC.Raycasters);
      const raycaster = raycasters.get(this._world);

      raycaster
        .castRay()
        .then((result) => {
          if (
            result &&
            result.point &&
            ((result as any).normal || (result.face && result.object))
          ) {
            const worldNormal = (result as any).normal
              ? (result as any).normal.clone()
              : result.face!.normal.clone().transformDirection(result.object.matrixWorld).normalize();
            cursorSurface.update(result.point, worldNormal);
          } else {
            cursorSurface.hide();
          }
        })
        .catch(() => {
          cursorSurface.hide();
        })
        .finally(() => {
          raycastInProgress = false;
        });
    };

    // 3. Click (pointerdown/pointerup) listeners to avoid camera drag clashes
    let startX = 0;
    let startY = 0;
    this._viewportPointerDownListener = (e: PointerEvent) => {
      startX = e.clientX;
      startY = e.clientY;
    };
    this._viewportPointerUpListener = (e: PointerEvent) => {
      const diffX = Math.abs(e.clientX - startX);
      const diffY = Math.abs(e.clientY - startY);
      if (diffX < 4 && diffY < 4) {
        measurer.create();
      }
    };

    this._escapeKeyListener = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        measurer.delete();
      }
    };

    if (canvas) {
      canvas.addEventListener("mousemove", this._viewportMouseMoveListener);
      canvas.addEventListener("pointerdown", this._viewportPointerDownListener);
      canvas.addEventListener("pointerup", this._viewportPointerUpListener);
    }
    window.addEventListener("keydown", this._escapeKeyListener);

    // 4. Build picking meshes for vertex snapping in the background (cached +
    //    BVH-accelerated). An early deactivate cancels via the activation id.
    const myId = ++this._activationId;
    attachMeasurePickingMeshes(
      this._components,
      this._world,
      () => myId !== this._activationId
    )
      .then((handle) => {
        if (myId !== this._activationId) {
          handle.detach();
          return;
        }
        this._pickingDetach = handle.detach;
      })
      .catch((err) => console.error("measure picking mesh build failed:", err));
  }

  private _deactivate() {
    const measurer = this._components.get(OBF.LengthMeasurement);
    const cursorSurface = this._components.get(CursorSurface);
    const canvas = this._world.renderer?.three?.domElement;

    // Cancel any in-flight background build and detach the picking meshes.
    this._activationId++;
    if (this._pickingDetach) {
      this._pickingDetach();
      this._pickingDetach = null;
    }

    measurer.enabled = false;
    measurer.pickerMode = OBF.GraphicVertexPickerMode.DEFAULT;
    cursorSurface.hide();

    if (canvas) {
      if (this._viewportMouseMoveListener) {
        canvas.removeEventListener("mousemove", this._viewportMouseMoveListener);
        this._viewportMouseMoveListener = null;
      }
      if (this._viewportPointerDownListener) {
        canvas.removeEventListener("pointerdown", this._viewportPointerDownListener);
        this._viewportPointerDownListener = null;
      }
      if (this._viewportPointerUpListener) {
        canvas.removeEventListener("pointerup", this._viewportPointerUpListener);
        this._viewportPointerUpListener = null;
      }
    }

    if (this._escapeKeyListener) {
      window.removeEventListener("keydown", this._escapeKeyListener);
      this._escapeKeyListener = null;
    }
  }

  dispose() {
    this._deactivate();
    clearMeasurePickingCache();
    this.onDisposed.trigger(LengthMeasureCursor.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }
}

export const setupLengthMeasureCursor = (
  components: OBC.Components,
  world: OBC.World
) => {
  const cursor = new LengthMeasureCursor(components, world);
  return () => {
    cursor.dispose();
  };
};
