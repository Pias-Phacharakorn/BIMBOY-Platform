// @ts-nocheck
import * as OBC from "@thatopen/components";
import { MiniMapUIManager } from "./src/MiniMapUIManager";
import { MiniMapCacheManager } from "./src/MiniMapCacheManager";
import { MiniMapCameraManager } from "./src/MiniMapCameraManager";

export class MiniMap extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "c7e2f5d1-9b4a-4c8d-8f2e-1a3b5c7d9e2f" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();
  readonly onCacheUpdated = new OBC.Event<void>();

  private _cacheResolution = 1024;

  // Sub-managers
  public uiManager!: MiniMapUIManager;
  public cacheManager!: MiniMapCacheManager;
  public cameraManager!: MiniMapCameraManager;

  constructor(components: OBC.Components) {
    super(components);
    components.add(MiniMap.uuid, this);

    this.uiManager = new MiniMapUIManager(this._cacheResolution, (e) => {
      this.cameraManager.handleMapClick(e);
    });

    this.cacheManager = new MiniMapCacheManager(
      components,
      this.uiManager.mapContext,
      this._cacheResolution
    );

    this.cameraManager = new MiniMapCameraManager(
      this,
      this.uiManager,
      this.cacheManager
    );
  }

  public get uiContainer() {
    return this.uiManager.uiContainer;
  }

  public get playerArrow() {
    return this.uiManager.playerArrow;
  }

  public get mapCanvas() {
    return this.uiManager.mapCanvas;
  }

  public setWorld(world: OBC.World) {
    this.cameraManager.setWorld(world, () => {
      if (!this.cacheManager.hasRendered) {
        this.updateCache();
      }
    });
  }

  public updateCache() {
    const world = this.cameraManager.world;
    if (!world) return;
    this.cacheManager.updateCache(world);
    this.onCacheUpdated.trigger();
  }

  public forceUpdateCache() {
    this.cacheManager.hasRendered = false;
    // If we have an active world, go ahead and cache immediately
    if (this.cameraManager.world) {
      this.updateCache();
    }
  }

  public zoomIn() {
    this.cacheManager.zoomScale = Math.min(5.0, this.cacheManager.zoomScale + 0.25);
    this.forceUpdateCache();
  }

  public zoomOut() {
    this.cacheManager.zoomScale = Math.max(0.2, this.cacheManager.zoomScale - 0.25);
    this.forceUpdateCache();
  }

  dispose() {
    this.cameraManager.dispose();
    this.cacheManager.dispose();
    this.uiManager.dispose();

    this.onDisposed.trigger(MiniMap.uuid);
    this.onDisposed.reset();
  }
}

