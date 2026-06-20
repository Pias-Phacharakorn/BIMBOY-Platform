// @ts-nocheck
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

import { Ion } from "cesium";

import { TilesRenderer } from "3d-tiles-renderer";

import {
  TilesFadePlugin,
  TileCompressionPlugin,
  GLTFExtensionsPlugin,
  ReorientationPlugin,
} from "3d-tiles-renderer/plugins";

import { CesiumIonAuthPlugin } from "3d-tiles-renderer/core/plugins";
import { GISParser } from "./GISParser";

export class GisLayer3d {

  latitude: number = 0;
  longitude: number = 0;
  rotation: number = 0;
  height: number = 0;

  private _enabled = false;
  private _resolutionSet = false;
  private _initialized = false;
  private _googleRenderer?: TilesRenderer;
  private _osmRenderer?: TilesRenderer;
  private _googleReorient?: ReorientationPlugin;
  private _osmReorient?: ReorientationPlugin;
  private _updateInterval?: NodeJS.Timeout;
  private _components?: OBC.Components;

  private _googleEnabled = true;
  private _osmEnabled = false;

  get googleEnabled() {
    return this._googleEnabled;
  }

  set googleEnabled(value: boolean) {
    if (this._googleEnabled === value) return;
    this._googleEnabled = value;
    this.updateLayerVisibility();
  }

  get osmEnabled() {
    return this._osmEnabled;
  }

  set osmEnabled(value: boolean) {
    if (this._osmEnabled === value) return;
    this._osmEnabled = value;
    this.updateLayerVisibility();
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.updateLayerVisibility();
  }

  private _onCameraControl = () => {
    this.updateTiles();
  };

  constructor(components: OBC.Components) {
    this._components = components;

    // Load project location dynamically from Firestore using the decoupled GISParser
    const loc = GISParser.getActiveProjectLocation();
    this.latitude = loc.latitude;
    this.longitude = loc.longitude;
    this.rotation = loc.rotation;
    this.height = loc.height;

    this._updateInterval = setInterval(() => {
      this.updateTiles();
    }, 300);

    const world = this.getWorld();
    world.camera.controls.maxDistance = 100000;
    world.camera.controls.addEventListener("control", this._onCameraControl);
  }

  dispose() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }

    try {
      const world = this.getWorld();
      if (world) {
        if (world.camera && world.camera.controls) {
          world.camera.controls.removeEventListener("control", this._onCameraControl);
        }
        if (this._googleRenderer && this._googleRenderer.group) {
          world.scene.three.remove(this._googleRenderer.group);
        }
        if (this._osmRenderer && this._osmRenderer.group) {
          world.scene.three.remove(this._osmRenderer.group);
        }
      }
    } catch (e) {
      // Ignore errors if worlds/scene are already disposed
    }
    if (this._googleRenderer) {
      this._googleRenderer.dispose();
    }
    if (this._osmRenderer) {
      this._osmRenderer.dispose();
    }
  }

  updateTiles() {
    if (!this._enabled) return;
    if (!this._initialized) return;
    const world = this.getWorld();

    if (this._googleEnabled && this._googleRenderer) {
      if (!this._resolutionSet) {
        this._googleRenderer.setResolutionFromRenderer(
          world.camera.three,
          world.renderer!.three,
        );
      }
      this._googleRenderer.update();
    }

    if (this._osmEnabled && this._osmRenderer) {
      if (!this._resolutionSet) {
        this._osmRenderer.setResolutionFromRenderer(
          world.camera.three,
          world.renderer!.three,
        );
      }
      this._osmRenderer.update();
    }

    this._resolutionSet = true;
  }

  updateMapPosition() {
    const latRad = this.latitude * THREE.MathUtils.DEG2RAD;
    const lonRad = this.longitude * THREE.MathUtils.DEG2RAD;
    const rotRad = this.rotation * THREE.MathUtils.DEG2RAD;

    if (this._googleReorient) {
      this._googleReorient.transformLatLonHeightToOrigin(
        latRad,
        lonRad,
        this.height,
        rotRad,
      );
    }
    if (this._osmReorient) {
      this._osmReorient.transformLatLonHeightToOrigin(
        latRad,
        lonRad,
        this.height,
        rotRad,
      );
    }
    this.updateTiles();
  }

  private updateLayerVisibility() {
    if (!this._initialized) return;
    const world = this.getWorld();

    if (this._enabled && this._googleEnabled) {
      if (this._googleRenderer) {
        world.scene.three.add(this._googleRenderer.group);
      }
    } else {
      if (this._googleRenderer) {
        world.scene.three.remove(this._googleRenderer.group);
      }
    }

    if (this._enabled && this._osmEnabled) {
      if (this._osmRenderer) {
        world.scene.three.add(this._osmRenderer.group);
      }
    } else {
      if (this._osmRenderer) {
        world.scene.three.remove(this._osmRenderer.group);
      }
    }
    this.updateTiles();
  }

  notifyTokenChanged() {
    if (this._googleRenderer) {
      this._googleRenderer.dispose();
      this._googleRenderer = undefined;
    }
    if (this._osmRenderer) {
      this._osmRenderer.dispose();
      this._osmRenderer = undefined;
    }

    const world = this.getWorld();
    const dracoLoader = new DRACOLoader().setDecoderPath("/resources/draco/");

    // Setup Google Photorealistic Renderer
    this._googleRenderer = new TilesRenderer();
    const googleIonPlugin = new CesiumIonAuthPlugin({
      apiToken: Ion.defaultAccessToken,
      assetId: "2275207",
      autoRefreshToken: true,
    });
    this._googleReorient = new ReorientationPlugin({
      lat: this.latitude * THREE.MathUtils.DEG2RAD,
      lon: this.longitude * THREE.MathUtils.DEG2RAD,
      recenter: true,
    });
    this._googleRenderer.registerPlugin(googleIonPlugin);
    this._googleRenderer.registerPlugin(new TileCompressionPlugin());
    this._googleRenderer.registerPlugin(new TilesFadePlugin());
    this._googleRenderer.registerPlugin(this._googleReorient);
    this._googleRenderer.registerPlugin(
      new GLTFExtensionsPlugin({ dracoLoader }),
    );
    this._googleRenderer.setCamera(world.camera.three);
    this._googleRenderer.setResolutionFromRenderer(
      world.camera.three,
      world.renderer!.three,
    );
    this._googleRenderer.addEventListener("load-tileset", () => {
      world.camera.three.updateProjectionMatrix();
      this.updateMapPosition();
    });

    // Setup Cesium OSM Buildings Renderer
    this._osmRenderer = new TilesRenderer();
    const osmIonPlugin = new CesiumIonAuthPlugin({
      apiToken: Ion.defaultAccessToken,
      assetId: "96188",
      autoRefreshToken: true,
    });
    this._osmReorient = new ReorientationPlugin({
      lat: this.latitude * THREE.MathUtils.DEG2RAD,
      lon: this.longitude * THREE.MathUtils.DEG2RAD,
      recenter: true,
    });
    this._osmRenderer.registerPlugin(osmIonPlugin);
    this._osmRenderer.registerPlugin(new TileCompressionPlugin());
    this._osmRenderer.registerPlugin(this._osmReorient);
    this._osmRenderer.registerPlugin(
      new GLTFExtensionsPlugin({ dracoLoader }),
    );
    this._osmRenderer.setCamera(world.camera.three);
    this._osmRenderer.setResolutionFromRenderer(
      world.camera.three,
      world.renderer!.three,
    );
    this._osmRenderer.addEventListener("load-tileset", () => {
      world.camera.three.updateProjectionMatrix();
      this.updateMapPosition();
    });

    this._osmRenderer.addEventListener("load-model", ({ scene }) => {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;

          // Dispose of original material to avoid memory leak
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }

          // Assign slate-grey material with polygon offset to prevent outline z-fighting
          mesh.material = new THREE.MeshPhongMaterial({
            color: 0x8a939c,
            flatShading: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
          });

          const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
          const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
          const line = new THREE.LineSegments(edges, lineMaterial);
          mesh.add(line);
        }
      });
    });

    this._osmRenderer.addEventListener("dispose-model", ({ scene }) => {
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }

          const toRemove: THREE.Object3D[] = [];
          mesh.traverse((grandChild) => {
            if (grandChild instanceof THREE.LineSegments) {
              if (grandChild.geometry) grandChild.geometry.dispose();
              if (Array.isArray(grandChild.material)) {
                grandChild.material.forEach((mat) => mat.dispose());
              } else if (grandChild.material) {
                grandChild.material.dispose();
              }
              toRemove.push(grandChild);
            }
          });
          toRemove.forEach((item) => mesh.remove(item));
        }
      });
    });

    this._initialized = true;
    this.updateLayerVisibility();
  }

  private getWorld() {
    if (!this._components) {
      throw new Error("Components not set");
    }
    const worlds = this._components.get(OBC.Worlds);
    return worlds.list.values().next().value as OBC.SimpleWorld<
      OBC.SimpleScene,
      OBC.OrthoPerspectiveCamera,
      OBC.SimpleRenderer
    >;
  }
}

