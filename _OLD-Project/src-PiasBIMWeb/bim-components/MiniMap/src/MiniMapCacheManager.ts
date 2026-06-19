import * as OBC from "@thatopen/components";
import * as THREE from "three";

export class MiniMapCacheManager {
  private _components: OBC.Components;
  private _mapContext: CanvasRenderingContext2D;
  private _cacheResolution: number;

  private _orthoCamera: THREE.OrthographicCamera;
  private _renderTarget: THREE.WebGLRenderTarget;

  public hasRendered = false;
  public zoomScale = 1.0;
  public mapCenterY = 0;

  // Bounding box map coordinates
  public mapMinX = -50;
  public mapMaxX = 50;
  public mapMinZ = -50;
  public mapMaxZ = 50;

  constructor(
    components: OBC.Components,
    mapContext: CanvasRenderingContext2D,
    cacheResolution: number
  ) {
    this._components = components;
    this._mapContext = mapContext;
    this._cacheResolution = cacheResolution;

    // Initialize Camera
    this._orthoCamera = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 1000);
    this._orthoCamera.position.set(0, 100, 0);
    this._orthoCamera.lookAt(0, 0, 0);

    // Initialize Render Target
    this._renderTarget = new THREE.WebGLRenderTarget(cacheResolution, cacheResolution);
  }

  public updateCache(world: OBC.World) {
    if (!world.renderer || !world.scene) return;

    const fragments = this._components.get(OBC.FragmentsManager);
    const bbox = new THREE.Box3();
    
    for (const [, model] of fragments.list) {
      bbox.expandByObject(model.object);
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    if (bbox.isEmpty()) {
      // Default fallback bounds
      center.set(0, 0, 0);
      size.set(100, 100, 100);
    } else {
      bbox.getCenter(center);
      bbox.getSize(size);
    }

    this.mapCenterY = center.y;

    const padding = 1.1; // 10% margin around the building
    const maxDim = Math.max(size.x, size.z, 10) * padding;
    const adjustedDim = maxDim / this.zoomScale;

    // Update orthographic camera to frame the whole bounding box perfectly in a square
    this._orthoCamera.left = -adjustedDim / 2;
    this._orthoCamera.right = adjustedDim / 2;
    this._orthoCamera.top = adjustedDim / 2;
    this._orthoCamera.bottom = -adjustedDim / 2;
    // Set near/far planes wide enough to encompass everything
    this._orthoCamera.near = 0.1;
    this._orthoCamera.far = size.y + 1000;
    
    const camHeight = Math.max(bbox.max.y, center.y) + 500;
    this._orthoCamera.up.set(0, 0, -1); // Explicitly define "up" as North (-Z) before calling lookAt
    this._orthoCamera.position.set(center.x, camHeight, center.z);
    this._orthoCamera.lookAt(center.x, center.y, center.z);
    this._orthoCamera.updateProjectionMatrix();

    // Store map coordinate boundaries
    this.mapMinX = center.x - adjustedDim / 2;
    this.mapMaxX = center.x + adjustedDim / 2;
    this.mapMinZ = center.z - adjustedDim / 2;
    this.mapMaxZ = center.z + adjustedDim / 2;

    const renderer = (world.renderer as any).three || world.renderer;
    const scene = (world.scene as any).three || world.scene;

    if (!renderer.getRenderTarget) return; 

    const currentRenderTarget = renderer.getRenderTarget();
    const currentClearColor = renderer.getClearColor(new THREE.Color());
    const currentClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(this._renderTarget);
    renderer.setClearColor(0x000000, 0);

    // Render static top-down view of entire project
    renderer.clear();
    renderer.render(scene, this._orthoCamera);

    const width = this._cacheResolution;
    const height = this._cacheResolution;
    const buffer = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(this._renderTarget, 0, 0, width, height, buffer);

    const imageData = this._mapContext.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      const srcRow = height - 1 - row;
      const srcStart = srcRow * width * 4;
      const destStart = row * width * 4;
      imageData.data.set(buffer.subarray(srcStart, srcStart + width * 4), destStart);
    }
    
    this._mapContext.putImageData(imageData, 0, 0);

    renderer.setRenderTarget(currentRenderTarget);
    renderer.setClearColor(currentClearColor, currentClearAlpha);
    
    this.hasRendered = true;
  }

  public dispose() {
    this._renderTarget.dispose();
  }
}
