import * as OBC from "@thatopen/components";
import { Ion } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { GisLayer3d, GisLayer2d } from "./src";
import { projectsManager } from "../../classes/ProjectsManager";
import { GISParser } from "./src/GISParser";

export class GisLayers extends OBC.Component implements OBC.Disposable {
  static uuid = "f2c045ca-08d0-4746-b72c-8a6ed57cb51c" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();

  layer3d: GisLayer3d;
  layer2d: GisLayer2d;

  get googleEnabled() {
    return this.layer3d.googleEnabled;
  }

  set googleEnabled(value: boolean) {
    this.layer3d.googleEnabled = value;
  }

  get osmEnabled() {
    return this.layer3d.osmEnabled;
  }

  set osmEnabled(value: boolean) {
    this.layer3d.osmEnabled = value;
  }

  private _cesiumToken: string | null = null;
  private _onProjectsLoadedUnsub?: () => void;

  get cesiumToken(): string {
    if (!this._cesiumToken) {
      throw new Error("Cesium token is not set");
    }
    return this._cesiumToken;
  }

  set cesiumToken(value: string) {
    this._cesiumToken = value;
    Ion.defaultAccessToken = value;
    this.layer3d.notifyTokenChanged();
    this.layer2d.notifyTokenChanged();
    this.layer2d.setMarkerPosition(
      this.layer3d.longitude,
      this.layer3d.latitude,
    );
  }

  constructor(components: OBC.Components) {
    super(components);
    components.add(GisLayers.uuid, this);
    (window as any).CESIUM_BASE_URL = "/resources/cesium/";
    this.layer3d = new GisLayer3d(components);

    this.layer2d = new GisLayer2d();
    this.layer2d.onCoordinateSelectedInMap.add(({ longitude, latitude }) => {
      this.layer3d.longitude = longitude;
      this.layer3d.latitude = latitude;
      this.layer3d.updateMapPosition();
    });

    // Listen for projects loaded event to update location dynamically once data is fetched from database
    const unsub = projectsManager.onProjectsLoaded(() => {
      const loc = GISParser.getActiveProjectLocation();
      this.layer3d.latitude = loc.latitude;
      this.layer3d.longitude = loc.longitude;
      this.layer3d.rotation = loc.rotation;
      this.layer3d.height = loc.height;
      this.layer3d.updateMapPosition();

      this.layer2d.setMarkerPosition(loc.longitude, loc.latitude);

      // Update UI elements in DOM if present
      const lonInput = document.getElementById("gis-longitude") as any;
      if (lonInput) lonInput.value = loc.longitude;
      const latInput = document.getElementById("gis-latitude") as any;
      if (latInput) latInput.value = loc.latitude;
      const rotInput = document.getElementById("gis-rotation") as any;
      if (rotInput) rotInput.value = loc.rotation;
      const elevInput = document.getElementById("gis-elevation") as any;
      if (elevInput) elevInput.value = loc.height;
    });
    this._onProjectsLoadedUnsub = unsub;
  }

  dispose() {
    if (this._onProjectsLoadedUnsub) {
      this._onProjectsLoadedUnsub();
    }
    this.layer3d.dispose();
    this.layer2d.dispose();
    this.onDisposed.trigger(GisLayers.uuid);
    this.onDisposed.reset();
  }
}
