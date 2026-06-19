import * as OBC from "@thatopen/components";
import * as THREE from "three";
import { MiniMapUIManager } from "./MiniMapUIManager";
import { MiniMapCacheManager } from "./MiniMapCacheManager";
import { MiniMap } from "../index";

export class MiniMapCameraManager {
  private _parent: MiniMap;
  private _uiManager: MiniMapUIManager;
  private _cacheManager: MiniMapCacheManager;

  private _world?: OBC.World;
  private _lastClickTime = 0;
  private _onUpdateTrigger?: () => void;

  constructor(
    parent: MiniMap,
    uiManager: MiniMapUIManager,
    cacheManager: MiniMapCacheManager
  ) {
    this._parent = parent;
    this._uiManager = uiManager;
    this._cacheManager = cacheManager;
  }

  public get world() {
    return this._world;
  }

  public setWorld(world: OBC.World, onUpdateTrigger: () => void) {
    if (this._world) {
      if (this._world.renderer) {
        this._world.renderer.onBeforeUpdate.remove(this.update);
      }
    }
    this._world = world;
    this._onUpdateTrigger = onUpdateTrigger;
    if (this._world.renderer) {
      this._world.renderer.onBeforeUpdate.add(this.update);
    }
  }

  public update = () => {
    if (!this._parent.enabled || !this._world || !this._world.camera || !this._world.camera.three) return;

    if (this._onUpdateTrigger) {
      this._onUpdateTrigger();
    }

    const mainCam = (this._world.camera as any).three || this._world.camera;
    const x = mainCam.position.x;
    const z = mainCam.position.z;

    const minX = this._cacheManager.mapMinX;
    const maxX = this._cacheManager.mapMaxX;
    const minZ = this._cacheManager.mapMinZ;
    const maxZ = this._cacheManager.mapMaxZ;

    // Calculate percentage across the map bounds
    let percentX = (x - minX) / (maxX - minX);
    let percentZ = (z - minZ) / (maxZ - minZ);

    // Clamp to map boundaries
    percentX = Math.max(0, Math.min(1, percentX));
    percentZ = Math.max(0, Math.min(1, percentZ));

    // Move icon using top/left percentage
    const arrowStyle = this._uiManager.playerArrow.style;
    arrowStyle.left = `${percentX * 100}%`;
    arrowStyle.top = `${percentZ * 100}%`;

    // Update arrow rotation (corrected to map 3D camera direction to 2D canvas coordinates)
    const direction = new THREE.Vector3();
    mainCam.getWorldDirection(direction);
    const angle = Math.atan2(direction.x, -direction.z);
    arrowStyle.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  };

  public handleMapClick(e: MouseEvent) {
    if (!this._world || !this._world.camera) return;
    const controls = this._world.camera.controls;
    if (!controls) return;

    // Ignore secondary clicks of a double click or rapid clicks within 600ms
    const now = Date.now();
    if (now - this._lastClickTime < 600) {
      return;
    }
    this._lastClickTime = now;

    const canvas = this._uiManager.mapCanvas;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    // Translate coordinates from canvas display size (percentage 0 to 1)
    const pctX = e.offsetX / width;
    const pctZ = e.offsetY / height;

    const minX = this._cacheManager.mapMinX;
    const maxX = this._cacheManager.mapMaxX;
    const minZ = this._cacheManager.mapMinZ;
    const maxZ = this._cacheManager.mapMaxZ;

    // Convert to 3D world coordinate space using current boundaries
    const clickX = minX + pctX * (maxX - minX);
    const clickZ = minZ + pctZ * (maxZ - minZ);

    const target = new THREE.Vector3();
    const position = new THREE.Vector3();
    controls.getTarget(target);
    controls.getPosition(position);

    // Calculate view direction vector (normalized) from position to target
    const dir = target.clone().sub(position).normalize();

    // Determine target distance: zoom in if far away, keep current distance if close
    const currentDistance = position.distanceTo(target);
    const d = currentDistance > 35 ? 25 : Math.max(currentDistance, 5);

    // Set new target focused on the clicked point at the model's center Y height
    const newTarget = new THREE.Vector3(clickX, this._cacheManager.mapCenterY, clickZ);
    
    // Position camera along the same look direction line at distance d
    const newPosition = newTarget.clone().sub(dir.multiplyScalar(d));

    // Smoothly pan camera target to the clicked spot
    controls.setLookAt(
      newPosition.x, newPosition.y, newPosition.z,
      newTarget.x, newTarget.y, newTarget.z,
      true
    );
  }

  public dispose() {
    if (this._world?.renderer) {
      this._world.renderer.onBeforeUpdate.remove(this.update);
    }
  }
}
