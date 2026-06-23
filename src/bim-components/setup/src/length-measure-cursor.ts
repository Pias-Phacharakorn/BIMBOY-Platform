// @ts-nocheck
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import { CursurSurface } from "../../CursurSurface";

export class LengthMeasureCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "2d1a37c0-ff4d-4ea7-90d0-ecdfc812d8a6" as const;

  private _enabled = false;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  private _components: OBC.Components;
  private _world: OBC.World;

  private _addedMeshes: THREE.Mesh[] = [];

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
    console.log("LengthMeasureCursor initialized with uuid: " + LengthMeasureCursor.uuid);
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

  private async _activate() {
    const measurer = this._components.get(OBF.LengthMeasurement);
    const cursurSurface = this._components.get(CursurSurface);
    const canvas = this._world.renderer?.three?.domElement;

    // 1. Enable and configure measurer
    measurer.world = this._world;
    measurer.enabled = true;
    cursurSurface.setWorld(this._world);

    // 2. Setup Synchronous Picking meshes
    await this._setupPickingMeshes();

    // 3. Hover raycast
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
            cursurSurface.update(result.point, worldNormal);
          } else {
            cursurSurface.hide();
          }
        })
        .catch(() => {
          cursurSurface.hide();
        })
        .finally(() => {
          raycastInProgress = false;
        });
    };

    // 4. Click (pointerdown/pointerup) listeners to avoid camera drag clashes
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
  }

  private _deactivate() {
    const measurer = this._components.get(OBF.LengthMeasurement);
    const cursurSurface = this._components.get(CursurSurface);
    const canvas = this._world.renderer?.three?.domElement;

    measurer.enabled = false;
    measurer.pickerMode = OBF.GraphicVertexPickerMode.DEFAULT;
    cursurSurface.hide();

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

    // Clean meshes from world.meshes
    for (const mesh of this._addedMeshes) {
      this._world.meshes.delete(mesh);
    }
    this._addedMeshes = [];
  }

  private async _setupPickingMeshes() {
    const fragments = this._components.get(OBC.FragmentsManager);
    const measurer = this._components.get(OBF.LengthMeasurement);
    measurer.pickerMode = OBF.GraphicVertexPickerMode.SYNCHRONOUS;
    measurer.delay = 0;

    const meshesList: THREE.Mesh[] = [];
    for (const [, model] of fragments.list) {
      try {
        const idsWithGeometry = await model.getItemsIdsWithGeometry();
        const allMeshesData = await model.getItemsGeometry(idsWithGeometry);
        const geometries = new Map<number, THREE.BufferGeometry>();

        for (const itemId in allMeshesData) {
          const meshData = allMeshesData[itemId];
          for (const geomData of meshData) {
            if (
              !geomData.positions ||
              !geomData.indices ||
              !geomData.transform ||
              !geomData.representationId
            ) {
              continue;
            }

            const representationId = geomData.representationId;
            if (!geometries.has(representationId)) {
              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(geomData.positions, 3)
              );
              geometry.setIndex(Array.from(geomData.indices));
              geometries.set(representationId, geometry);
            }

            const geometry = geometries.get(representationId)!;
            const mesh = new THREE.Mesh(geometry);
            mesh.applyMatrix4(geomData.transform);
            mesh.applyMatrix4(model.object.matrixWorld);
            mesh.updateWorldMatrix(true, true);
            meshesList.push(mesh);
          }
        }
      } catch (err) {
        console.error("Failed to collect picking meshes:", err);
      }
    }

    this._addedMeshes = meshesList;
    for (const mesh of meshesList) {
      this._world.meshes.add(mesh);
    }
  }

  dispose() {
    this._deactivate();
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
