// @ts-nocheck
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

  private _isDragging = false;
  private _hasMoved = false;
  private _startX = 0;
  private _startY = 0;
  private _startPanX = 0;
  private _startPanZ = 0;

  constructor(
    parent: MiniMap,
    uiManager: MiniMapUIManager,
    cacheManager: MiniMapCacheManager
  ) {
    this._parent = parent;
    this._uiManager = uiManager;
    this._cacheManager = cacheManager;
    
    this.setupEvents();
  }

  private setupEvents() {
    const canvas = this._uiManager.mapCanvas;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click drags
      this._isDragging = true;
      this._hasMoved = false;
      this._startX = e.clientX;
      this._startY = e.clientY;
      this._startPanX = this._cacheManager.panOffset.x;
      this._startPanZ = this._cacheManager.panOffset.z;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._startX;
      const dy = e.clientY - this._startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this._hasMoved = true;
      }

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      // Translate pixels dragged to world coordinates
      const worldDx = (dx / width) * this._cacheManager.adjustedDim;
      const worldDz = (dy / height) * this._cacheManager.adjustedDim;

      // Rotate drag vector back to the unrotated camera coordinate space
      const rotation = this._parent.rotation;
      const rad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const rx = -worldDx;
      const rz = -worldDz;

      const panDx = rx * cos - rz * sin;
      const panDz = rx * sin + rz * cos;

      this._cacheManager.panOffset.x = this._startPanX + panDx;
      this._cacheManager.panOffset.z = this._startPanZ + panDz;

      this._parent.forceUpdateCache();
    };

    const handleMouseUp = (e: MouseEvent) => {
      this._isDragging = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (!this._hasMoved) {
        this.handleMapClick(e);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Zoom in/out relative to scroll direction
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this._cacheManager.zoomScale = Math.max(0.15, Math.min(15.0, this._cacheManager.zoomScale * zoomFactor));
      this._parent.forceUpdateCache();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
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

    // Adjust visual positioning based on the map's current rotation
    let visualX = percentX;
    let visualZ = percentZ;
    const rotation = this._parent.rotation;
    if (rotation === 90) {
      visualX = 1 - percentZ;
      visualZ = percentX;
    } else if (rotation === 180) {
      visualX = 1 - percentX;
      visualZ = 1 - percentZ;
    } else if (rotation === 270) {
      visualX = percentZ;
      visualZ = 1 - percentX;
    }

    // Move icon using top/left percentage
    const arrowStyle = this._uiManager.playerArrow.style;
    arrowStyle.left = `${visualX * 100}%`;
    arrowStyle.top = `${visualZ * 100}%`;

    // Update arrow rotation (corrected to map 3D camera direction to 2D canvas coordinates)
    const direction = new THREE.Vector3();
    mainCam.getWorldDirection(direction);
    const angle = Math.atan2(direction.x, -direction.z);
    
    // Add map rotation to arrow direction (convert deg to rad)
    const mapRotationRad = (rotation * Math.PI) / 180;
    const finalAngle = angle + mapRotationRad;
    arrowStyle.transform = `translate(-50%, -50%) rotate(${finalAngle}rad)`;
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

    // Calculate click coordinates relative to the canvas client rect (extremely robust during drags)
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    // Translate coordinates from canvas display size (percentage 0 to 1)
    const pctX = offsetX / width;
    const pctZ = offsetY / height;

    // Map visual click coordinates back to original unrotated canvas coordinates
    let originalPctX = pctX;
    let originalPctZ = pctZ;
    const rotation = this._parent.rotation;
    if (rotation === 90) {
      originalPctX = pctZ;
      originalPctZ = 1 - pctX;
    } else if (rotation === 180) {
      originalPctX = 1 - pctX;
      originalPctZ = 1 - pctZ;
    } else if (rotation === 270) {
      originalPctX = 1 - pctZ;
      originalPctZ = pctX;
    }

    const minX = this._cacheManager.mapMinX;
    const maxX = this._cacheManager.mapMaxX;
    const minZ = this._cacheManager.mapMinZ;
    const maxZ = this._cacheManager.mapMaxZ;

    // Convert to 3D world coordinate space using current boundaries
    const clickX = minX + originalPctX * (maxX - minX);
    const clickZ = minZ + originalPctZ * (maxZ - minZ);

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

