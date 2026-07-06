import { useEffect, useMemo, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { RotateCcw, Save } from "lucide-react";
import { GisLayers } from "@/bim-components";
import { useProject, useUpdateProject } from "@/react-components/features/projects/useProjects";
import { useProjectStore } from "@/react-components/store/projectStore";
import { Icon } from "@/react-components/components/ui";
import { useBimStore } from "@/react-components/store/bimStore";
import { cn } from "@/lib/utils";

const TOKEN_STORAGE_KEY = "PIAS-cesium-token-input";
const DEFAULT_CAMERA_RANGE = 5000;

type GisState = {
  token: string;
  enabled: boolean;
  googleEnabled: boolean;
  osmEnabled: boolean;
  longitude: number;
  latitude: number;
  cameraRange: number;
  rotation: number;
  elevation: number;
};

const initialState: GisState = {
  token: "",
  enabled: false,
  googleEnabled: true,
  osmEnabled: false,
  longitude: 0,
  latitude: 0,
  cameraRange: DEFAULT_CAMERA_RANGE,
  rotation: 0,
  elevation: 0,
};

export function GisPanel() {
  const { components } = useBimStore();
  const { activeProjectId } = useProjectStore();
  const updateProjectMutation = useUpdateProject();
  const { data: activeProject } = useProject(activeProjectId);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const appliedLocationRef = useRef<{ id: string; gisLayers: GisLayers } | null>(null);

  const mapHostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<GisState>(initialState);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const longitudeRef = useRef<any>(null);
  const latitudeRef = useRef<any>(null);
  const cameraRangeRef = useRef<any>(null);
  const rotationRef = useRef<any>(null);
  const elevationRef = useRef<any>(null);

  const gisLayers = useMemo(() => {
    if (!components) return null;
    try {
      return components.get(GisLayers);
    } catch (e) {
      console.warn("GIS component unavailable", e);
      return null;
    }
  }, [components]);

  useEffect(() => {
    if (!components || !gisLayers) {
      setIsReady(false);
      return;
    }

    const camera = getCamera(components);
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY) || "";

    setState({
      token: storedToken,
      enabled: gisLayers.layer3d.enabled,
      googleEnabled: gisLayers.googleEnabled,
      osmEnabled: gisLayers.osmEnabled,
      longitude: gisLayers.layer3d.longitude,
      latitude: gisLayers.layer3d.latitude,
      cameraRange: camera?.far || DEFAULT_CAMERA_RANGE,
      rotation: gisLayers.layer3d.rotation,
      elevation: gisLayers.layer3d.height,
    });

    if (storedToken) {
      try {
        gisLayers.cesiumToken = storedToken;
        setError(null);
      } catch (e) {
        console.warn("Unable to apply stored Cesium token", e);
        setError("Unable to initialize Cesium token.");
      }
    }

    const mapContainer = gisLayers.layer2d.container;
    if (mapHostRef.current && !mapHostRef.current.contains(mapContainer)) {
      mapHostRef.current.innerHTML = "";
      mapHostRef.current.appendChild(mapContainer);
    }

    const onMapCoordinateSelected = (data: { longitude: number; latitude: number }) => {
      const longitude = roundCoordinate(data.longitude);
      const latitude = roundCoordinate(data.latitude);

      gisLayers.layer3d.longitude = longitude;
      gisLayers.layer3d.latitude = latitude;
      gisLayers.layer3d.updateMapPosition();

      setState((current) => ({
        ...current,
        longitude,
        latitude,
      }));
    };

    gisLayers.layer2d.onCoordinateSelectedInMap.add(onMapCoordinateSelected);
    setIsReady(true);

    return () => {
      gisLayers.layer2d.onCoordinateSelectedInMap.remove(onMapCoordinateSelected);
      if (mapHostRef.current?.contains(mapContainer)) {
        mapHostRef.current.removeChild(mapContainer);
      }
    };
  }, [components, gisLayers]);

  // Apply the freshly-fetched project location once per project, overriding whatever
  // GisLayer3d picked up at construction time (which can race the projects list load
  // and end up stale — see GISParser.getActiveProjectLocation).
  useEffect(() => {
    if (!gisLayers || !activeProject) return;
    const applied = appliedLocationRef.current;
    if (applied && applied.id === activeProject.id && applied.gisLayers === gisLayers) return;
    appliedLocationRef.current = { id: activeProject.id, gisLayers };

    const { longitude, latitude, rotation, elevation } = activeProject.location;
    gisLayers.layer3d.longitude = longitude;
    gisLayers.layer3d.latitude = latitude;
    gisLayers.layer3d.rotation = rotation;
    gisLayers.layer3d.height = elevation;
    gisLayers.layer3d.updateMapPosition();
    try {
      gisLayers.layer2d.setMarkerPosition(longitude, latitude);
    } catch (e) {
      console.warn("Unable to update GIS map marker", e);
    }

    setState((current) => ({ ...current, longitude, latitude, rotation, elevation }));
  }, [gisLayers, activeProject]);

  // Synchronize events from BUI elements back to state
  useEffect(() => {
    const lonEl = longitudeRef.current;
    const latEl = latitudeRef.current;
    const camEl = cameraRangeRef.current;
    const rotEl = rotationRef.current;
    const elevEl = elevationRef.current;

    const handleLongitude = (e: any) => {
      updateCoordinate("longitude", Number(e.target.value));
    };
    const handleLatitude = (e: any) => {
      updateCoordinate("latitude", Number(e.target.value));
    };
    const handleCameraRange = (e: any) => {
      updateCameraRange(Number(e.target.value));
    };
    const handleRotation = (e: any) => {
      updateRotation(Number(e.target.value));
    };
    const handleElevation = (e: any) => {
      updateElevation(Number(e.target.value));
    };

    lonEl?.addEventListener("change", handleLongitude);
    lonEl?.addEventListener("input", handleLongitude);
    latEl?.addEventListener("change", handleLatitude);
    latEl?.addEventListener("input", handleLatitude);
    camEl?.addEventListener("change", handleCameraRange);
    camEl?.addEventListener("input", handleCameraRange);
    rotEl?.addEventListener("change", handleRotation);
    rotEl?.addEventListener("input", handleRotation);
    elevEl?.addEventListener("change", handleElevation);
    elevEl?.addEventListener("input", handleElevation);

    return () => {
      lonEl?.removeEventListener("change", handleLongitude);
      lonEl?.removeEventListener("input", handleLongitude);
      latEl?.removeEventListener("change", handleLatitude);
      latEl?.removeEventListener("input", handleLatitude);
      camEl?.removeEventListener("change", handleCameraRange);
      camEl?.removeEventListener("input", handleCameraRange);
      rotEl?.removeEventListener("change", handleRotation);
      rotEl?.removeEventListener("input", handleRotation);
      elevEl?.removeEventListener("change", handleElevation);
      elevEl?.removeEventListener("input", handleElevation);
    };
  }, [gisLayers, components, state.longitude, state.latitude, state.cameraRange, state.rotation, state.elevation]);

  // Synchronize state changes back to BUI elements
  useEffect(() => {
    if (longitudeRef.current && longitudeRef.current.value !== state.longitude) {
      longitudeRef.current.value = state.longitude;
    }
    if (latitudeRef.current && latitudeRef.current.value !== state.latitude) {
      latitudeRef.current.value = state.latitude;
    }
    if (cameraRangeRef.current && cameraRangeRef.current.value !== state.cameraRange) {
      cameraRangeRef.current.value = state.cameraRange;
    }
    if (rotationRef.current && rotationRef.current.value !== state.rotation) {
      rotationRef.current.value = state.rotation;
    }
    if (elevationRef.current && elevationRef.current.value !== state.elevation) {
      elevationRef.current.value = state.elevation;
    }
  }, [state.longitude, state.latitude, state.cameraRange, state.rotation, state.elevation]);

  const tokenAvailable = state.token.trim().length > 0;

  const updateToken = (token: string) => {
    setState((current) => ({ ...current, token }));
    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    if (!gisLayers) return;
    if (!token.trim()) {
      gisLayers.layer3d.enabled = false;
      setState((current) => ({ ...current, enabled: false }));
      return;
    }

    try {
      gisLayers.cesiumToken = token;
      setError(null);
    } catch (e) {
      console.warn("Unable to update Cesium token", e);
      setError("Unable to update Cesium token.");
    }
  };

  const updateEnabled = (enabled: boolean) => {
    if (!gisLayers || !tokenAvailable) return;
    gisLayers.layer3d.enabled = enabled;
    setState((current) => ({ ...current, enabled }));
  };

  const updateLayerToggle = (layer: "googleEnabled" | "osmEnabled", enabled: boolean) => {
    if (!gisLayers || !tokenAvailable) return;
    gisLayers[layer] = enabled;
    setState((current) => ({ ...current, [layer]: enabled }));
  };

  const updateCoordinate = (key: "longitude" | "latitude", value: number) => {
    if (!gisLayers) return;
    const next = { ...state, [key]: value };
    gisLayers.layer3d.longitude = next.longitude;
    gisLayers.layer3d.latitude = next.latitude;
    try {
      gisLayers.layer2d.setMarkerPosition(next.longitude, next.latitude);
    } catch (e) {
      console.warn("Unable to update GIS map marker", e);
    }
    gisLayers.layer3d.updateMapPosition();
    setState(next);
  };

  const updateCameraRange = (cameraRange: number) => {
    if (!components || !gisLayers) return;
    const camera = getCamera(components);
    if (camera) {
      camera.far = cameraRange;
      camera.updateProjectionMatrix();
    }
    gisLayers.layer3d.updateTiles();
    setState((current) => ({ ...current, cameraRange }));
  };

  const updateRotation = (rotation: number) => {
    if (!gisLayers) return;
    gisLayers.layer3d.rotation = rotation;
    gisLayers.layer3d.updateMapPosition();
    setState((current) => ({ ...current, rotation }));
  };

  const updateElevation = (elevation: number) => {
    if (!gisLayers) return;
    gisLayers.layer3d.height = elevation;
    gisLayers.layer3d.updateMapPosition();
    setState((current) => ({ ...current, elevation }));
  };

  const saveGisData = async () => {
    if (!activeProjectId) {
      setSaveError("No active project selected.");
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      await updateProjectMutation.mutateAsync({
        id: activeProjectId,
        project: {
          longitude: state.longitude,
          latitude: state.latitude,
          rotation: state.rotation,
          elevation: state.elevation,
        },
      });
      setSaveState("success");
      setTimeout(() => {
        setSaveState("idle");
      }, 2000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save GIS data.");
      setSaveState("error");
    }
  };

  const resetView = () => {
    if (!components || !gisLayers) return;
    const camera = getCamera(components);
    if (camera) {
      camera.far = DEFAULT_CAMERA_RANGE;
      camera.updateProjectionMatrix();
    }

    gisLayers.layer3d.rotation = 0;
    gisLayers.layer3d.height = 0;
    gisLayers.layer3d.updateMapPosition();

    setState((current) => ({
      ...current,
      cameraRange: DEFAULT_CAMERA_RANGE,
      rotation: 0,
      elevation: 0,
    }));
  };

  if (!components) {
    return <GisPanelMessage title="GIS engine loading" body="Waiting for the BIM viewport to initialize." />;
  }

  if (!gisLayers) {
    return <GisPanelMessage title="GIS component unavailable" body="GisLayers is not registered in the active BIM engine." />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface text-xs text-fg">
      <div className="flex items-center justify-between border-b border-border bg-bg px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
          <Icon name="EARTH" size={14} className="text-white" />
          <span>GIS Cesium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-alt text-muted transition-colors hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={saveGisData}
            disabled={!isReady || !activeProjectId || saveState === "saving"}
            title="Save GIS data to database"
          >
            <Save size={13} className={cn(saveState === "saving" && "animate-spin")} />
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-alt text-muted transition-colors hover:border-border-strong hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            onClick={resetView}
            disabled={!isReady}
            title="Reset GIS view"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-2" htmlFor="gis-token">
            Cesium Token
          </label>
          <input
            id="gis-token"
            value={state.token}
            onChange={(event) => updateToken(event.target.value)}
            placeholder="Insert Cesium token"
            className="h-8 w-full rounded border border-border bg-bg px-2.5 text-xs text-fg outline-none transition-colors placeholder:text-muted-2 hover:border-border-strong focus:border-accent"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ToggleButton active={state.enabled} disabled={!tokenAvailable} onClick={() => updateEnabled(!state.enabled)}>
            {state.enabled ? "On" : "Off"}
          </ToggleButton>
          <ToggleButton
            active={state.googleEnabled}
            disabled={!tokenAvailable}
            onClick={() => updateLayerToggle("googleEnabled", !state.googleEnabled)}
          >
            3D Tiles
          </ToggleButton>
          <ToggleButton
            active={state.osmEnabled}
            disabled={!tokenAvailable}
            onClick={() => updateLayerToggle("osmEnabled", !state.osmEnabled)}
          >
            3D Building
          </ToggleButton>
        </div>

        {saveState === "success" && (
          <div className="rounded border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-[11px] text-status-ok">
            GIS data saved.
          </div>
        )}

        {saveError && (
          <div className="rounded border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-[11px] text-status-danger">
            {saveError}
          </div>
        )}

        {error && (
          <div className="rounded border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-[11px] text-status-danger">
            {error}
          </div>
        )}

        {/* @ts-ignore */}
        <bim-number-input
          id="gis-longitude"
          ref={longitudeRef}
          style={{ maxHeight: "min-content" }}
          pref="Longitude"
          slider
          min={-180}
          max={180}
          step={0.000001}
        />

        {/* @ts-ignore */}
        <bim-number-input
          id="gis-latitude"
          ref={latitudeRef}
          style={{ maxHeight: "min-content" }}
          pref="Latitude"
          slider
          min={-90}
          max={90}
          step={0.000001}
        />

        {/* @ts-ignore */}
        <bim-number-input
          id="gis-camera-range"
          ref={cameraRangeRef}
          style={{ maxHeight: "min-content" }}
          pref="Camera Range"
          slider
          min={100}
          max={10000}
          step={50}
        />

        <div className="flex gap-2 w-full">
          <div className="flex-grow flex-shrink min-w-0">
            {/* @ts-ignore */}
            <bim-number-input
              id="gis-rotation"
              ref={rotationRef}
              style={{ maxHeight: "min-content" }}
              pref="Rotation"
              slider
              min={-180}
              max={360}
              step={1}
            />
          </div>
          <div className="flex-grow flex-shrink min-w-0">
            {/* @ts-ignore */}
            <bim-number-input
              id="gis-elevation"
              ref={elevationRef}
              style={{ maxHeight: "min-content" }}
              pref="Elevation"
              slider
              min={-100}
              max={10000}
              step={0.1}
            />
          </div>
        </div>

        <div className="flex min-h-[19rem] flex-col overflow-hidden rounded border border-border bg-bg">
          <div ref={mapHostRef} className="min-h-[19rem] w-full overflow-hidden" />
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center justify-center rounded border px-2 text-[11px] font-semibold transition-colors",
        active
          ? "border-accent bg-accent/15 text-fg"
          : "border-border bg-bg text-muted hover:border-border-strong hover:text-fg",
        disabled && "cursor-not-allowed opacity-40 hover:border-border hover:text-muted",
      )}
    >
      {children}
    </button>
  );
}

function GisPanelMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-surface p-4 text-center">
      <div className="rounded border border-border bg-bg px-4 py-3">
        <p className="text-xs font-semibold text-fg">{title}</p>
        <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}

function getCamera(components: OBC.Components) {
  const worlds = components.get(OBC.Worlds);
  const world = worlds.list.values().next().value;
  return world?.camera?.three || null;
}

function roundCoordinate(value: number) {
  const factor = 1e6;
  return Math.round(value * factor) / factor;
}
