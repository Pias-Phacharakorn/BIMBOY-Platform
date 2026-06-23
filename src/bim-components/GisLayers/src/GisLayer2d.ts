// @ts-nocheck
import {
  Viewer,
  SceneMode,
  OpenStreetMapImageryProvider,
  Cartographic,
  Math as CesiumMath,
  Cartesian3,
  Entity,
  Color,
  ScreenSpaceEventHandler,
  defined,
  ScreenSpaceEventType,
  ImageryLayer,
} from "cesium";

import * as FRAGS from "@thatopen/fragments";
import { GISParser } from "./GISParser";

export class GisLayer2d {
  container = document.createElement("div");
  private _marker?: Entity;
  private _viewer?: Viewer;
  private _screenHandler?: ScreenSpaceEventHandler;

  onCoordinateSelectedInMap = new FRAGS.Event<{
    longitude: number;
    latitude: number;
  }>();

  constructor() {
    this.container.style.height = "20rem";
    this.container.style.width = "100%";
    this.container.style.height = "19rem";
    this.container.style.borderRadius = "0.5rem";
    this.container.style.overflow = "clip";
    this.container.style.margin = "0";
    this.container.style.padding = "0";
    this.container.innerText = "Please insert a Cesium token!";
  }

  dispose() {
    if (this._screenHandler) {
      this._screenHandler.destroy();
      this._screenHandler = undefined;
    }
    if (this._viewer) {
      this._viewer.destroy();
    }
    this.onCoordinateSelectedInMap.reset();
  }

  setMarkerPosition(longitude: number, latitude: number) {
    this._setMarkerPosition(Cartesian3.fromDegrees(longitude, latitude));
  }

  notifyTokenChanged() {
    if (this._screenHandler) {
      this._screenHandler.destroy();
      this._screenHandler = undefined;
    }
    if (this._viewer) {
      this._viewer.destroy();
    }
    this.container.innerText = "";

    this._viewer = new Viewer(this.container, {
      sceneMode: SceneMode.SCENE2D,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      scene3DOnly: false,
      navigationHelpButton: false,
      vrButton: false,
      fullscreenButton: false,
      baseLayer: new ImageryLayer(new OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
      })),
    } as any);

    const loc = GISParser.getActiveProjectLocation();
    this._marker = this._viewer.entities.add({
      position: Cartesian3.fromDegrees(loc.longitude, loc.latitude),
      point: {
        pixelSize: 10,
        color: new Color(0.137, 0.7137, 0.9019, 1.0),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
    });

    this._screenHandler = new ScreenSpaceEventHandler(this._viewer.canvas);

    this._screenHandler.setInputAction((click: any) => {
      const cartesian = this._viewer!.camera.pickEllipsoid(
        click.position,
        this._viewer!.scene.globe.ellipsoid
      );
      if (defined(cartesian)) {
        this._setMarkerPosition(cartesian);
        const cartographic = Cartographic.fromCartesian(cartesian);
        const longitude = CesiumMath.toDegrees(cartographic.longitude);
        const latitude = CesiumMath.toDegrees(cartographic.latitude);
        this.onCoordinateSelectedInMap.trigger({ longitude, latitude });
      }
    }, ScreenSpaceEventType.LEFT_CLICK);
  }

  private _setMarkerPosition(value: Cartesian3) {
    if (!this._marker) {
      throw new Error("Marker not set");
    }
    (this._marker.position as any) = value;
  }
}