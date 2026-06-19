import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { appIcons } from "../../globals";
import { GisLayers } from "../../bim-components";


export interface GisPanelState {
  components: OBC.Components;
  isCollapsed?: boolean;
}

let onMapUpdate: any;

export const gisPanelTemplate: BUI.StatefullComponent<GisPanelState> = (
  state,
  update,
) => {
  const { components } = state;
  const worlds = components.get(OBC.Worlds);
  const world = worlds.list.values().next().value as OBC.SimpleWorld;
  const camera = world.camera.three as THREE.PerspectiveCamera;

  if (!camera.userData.gisCameraInitialized) {
    camera.far = 5000;
    camera.updateProjectionMatrix();
    camera.userData.gisCameraInitialized = true;
  }

  const gisLayers = components.get(GisLayers);
  const tokenId = "PIAS-cesium-token-input";

  const longitudeInput = BUI.Component.create<BUI.NumberInput>(() => {
    return BUI.html`
    <bim-number-input id="gis-longitude" style="max-height: min-content;" pref="Longitude" 
    slider value="${gisLayers.layer3d.longitude}" min="-180" max="180" step="0.000001">
    </bim-number-input>
    `;
  });

  const latitudeInput = BUI.Component.create<BUI.NumberInput>(() => {
    return BUI.html`
    <bim-number-input id="gis-latitude" style="max-height: min-content;" pref="latitude"
    slider value="${gisLayers.layer3d.latitude}" min="-90" max="90" step="0.000001">
    </bim-number-input>
    `;
  });

  const enableInput = BUI.Component.create<BUI.Selector>(() => {
    return BUI.html`
      <bim-selector class="disabled">
        <bim-option label="On" value="${true}"></bim-option>
        <bim-option label="Off" value="${false}" checked></bim-option>
      </bim-selector>
    `;
  });

  const googleToggle = BUI.Component.create<BUI.Button>(() => {
    return BUI.html`
      <bim-button 
        style="flex: 1;" 
        ?active=${gisLayers.googleEnabled} 
        label="3D Tiles"
        @click=${(e: Event) => {
          const btn = e.target as BUI.Button;
          gisLayers.googleEnabled = !gisLayers.googleEnabled;
          btn.active = gisLayers.googleEnabled;
        }}>
      </bim-button>
    `;
  });

  const osmToggle = BUI.Component.create<BUI.Button>(() => {
    return BUI.html`
      <bim-button 
        style="flex: 1;" 
        ?active=${gisLayers.osmEnabled} 
        label="3D Building"
        @click=${(e: Event) => {
          const btn = e.target as BUI.Button;
          gisLayers.osmEnabled = !gisLayers.osmEnabled;
          btn.active = gisLayers.osmEnabled;
        }}>
      </bim-button>
    `;
  });

  const updateEnableInput = (enable: boolean) => {
    if (enable) {
      enableInput.classList.remove("disabled");
    } else {
      enableInput.classList.add("disabled");
    }
  };

  const onInputToken = (e: Event) => {
    const input = e.target as BUI.TextInput;
    const token = input.value;
    updateEnableInput(token.length > 0);
    gisLayers.cesiumToken = token;
    localStorage.setItem(tokenId, token);
  };

  const OnEnable = (e: Event) => {
    const selector = e.target as BUI.Selector;
    gisLayers.layer3d.enabled = selector.value;
  };

  const onLongLatChange = () => {
    const longitude = longitudeInput.value;
    const latitude = latitudeInput.value;
    gisLayers.layer3d.longitude = longitude;
    gisLayers.layer3d.latitude = latitude;
    gisLayers.layer2d.setMarkerPosition(longitude, latitude);
    gisLayers.layer3d.updateMapPosition();
  };

  const onRotationChange = (e: Event) => {
    const input = e.target as BUI.NumberInput;
    gisLayers.layer3d.rotation = Number(input.value);
    gisLayers.layer3d.updateMapPosition();
  };

  const onHeightChange = (e: Event) => {
    const input = e.target as BUI.NumberInput;
    gisLayers.layer3d.height = Number(input.value);
    gisLayers.layer3d.updateMapPosition();
  };

  const onCameraRangeChanged = (e: Event) => {
    const input = e.target as BUI.NumberInput;
    camera.far = Number(input.value);
    camera.updateProjectionMatrix();
    gisLayers.layer3d.updateTiles();
  };

  const onResetView = () => {
    camera.far = 5000;
    camera.updateProjectionMatrix();
    gisLayers.layer3d.rotation = 0;
    gisLayers.layer3d.height = 0;
    gisLayers.layer3d.updateMapPosition();

    const camInput = document.getElementById("gis-camera-range") as BUI.NumberInput;
    if (camInput) camInput.value = 5000;
    const rotInput = document.getElementById("gis-rotation") as BUI.NumberInput;
    if (rotInput) rotInput.value = 0;
    const elevInput = document.getElementById("gis-elevation") as BUI.NumberInput;
    if (elevInput) elevInput.value = 0;
  };

  longitudeInput.addEventListener("change", onLongLatChange);
  latitudeInput.addEventListener("change", onLongLatChange);
  enableInput.addEventListener("change", OnEnable);


  const previousToken = localStorage.getItem(tokenId) || "";
  updateEnableInput(previousToken.length > 0);
  if (previousToken.length) {
    gisLayers.cesiumToken = previousToken;
  }

  if (onMapUpdate) {
    gisLayers.layer2d.onCoordinateSelectedInMap.remove(onMapUpdate);
  }

  onMapUpdate = (data: { longitude: number; latitude: number }) => {
      const { longitude, latitude } = data;
      const factor = 1e6;
      const lon = Math.round(longitude * factor) / factor;
      const lat = Math.round(latitude * factor) / factor;
      
      longitudeInput.value = lon;
      latitudeInput.value = lat;

      // Sync 3D tiles explicitly
      gisLayers.layer3d.longitude = lon;
      gisLayers.layer3d.latitude = lat;
      gisLayers.layer3d.updateMapPosition();
    };

    gisLayers.layer2d.onCoordinateSelectedInMap.add(onMapUpdate);

  return BUI.html`
  <bim-panel>
    <bim-panel-section fixed icon=${appIcons.EARTH} label="GIS Cesium">
      
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; gap: 0.5rem;">

          ${enableInput}

          <bim-text-input
            value = "${previousToken}"
            style="max-height: min-content; flex: 1;" @input=${onInputToken} 
            placeholder="Insert Cesium Token here..." debounce="200">
          </bim-text-input>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem; width: 100%;">
          ${googleToggle}
          ${osmToggle}
          <bim-button icon=${appIcons.REFRESH} @click=${onResetView}></bim-button>
        </div>
      </div>

      ${longitudeInput}
      ${latitudeInput}

      <bim-number-input id="gis-camera-range"
        style="max-height: min-content;" pref="Camera Range"
        slider value="${camera.far}" min="100" max="10000" step="50" debounce="100" @change=${onCameraRangeChanged}>
      </bim-number-input>

      <div style="display: flex; gap: 0.5rem; width: 100%;">
        <bim-number-input id="gis-rotation"
          style="flex: 1; max-height: min-content;" pref="Rotation"
          slider value="${gisLayers.layer3d.rotation}" min="-180" max="360" debounce="100" @change=${onRotationChange}>
        </bim-number-input>

        <bim-number-input id="gis-elevation"
          style="flex: 1; max-height: min-content;" pref="Elevation"
          slider value="${gisLayers.layer3d.height}" min="-100" max="10000" step="0.1" debounce="100" @change=${onHeightChange}>
        </bim-number-input>
      </div>

      ${gisLayers.layer2d.container}
    </bim-panel-section>
  </bim-panel>
  `;
};
