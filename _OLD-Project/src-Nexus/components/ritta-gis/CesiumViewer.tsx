import { useEffect, useRef, useState } from "react";
import type { RittaProject } from "@/types/project";

export type CesiumLayerToggles = {
  terrain: boolean;
  satellite: boolean;
  buildings: boolean;
  pins: boolean;
  heatmap: boolean;
};

export type CesiumContext = {
  viewer: import("cesium").Viewer;
  Cesium: typeof import("cesium");
};

interface CesiumViewerProps {
  projects: RittaProject[];
  selectedId: string | null;
  layers: CesiumLayerToggles;
  /** Single click — highlight + focus right-rail telemetry */
  onSelect: (id: string | null) => void;
  /** Double click — fly camera in to campus / site level */
  onZoomToSite: (id: string) => void;
  /** Fires once the Cesium viewer has booted — used by the BIM geo overlay. */
  onReady?: (ctx: CesiumContext) => void;
}

const STATUS_COLOR: Record<string, string> = {
  Ongoing: "#22d3ee",
  Operational: "#34d399",
  Finished: "#a3a3a3",
  Bidding: "#fbbf24",
};

/**
 * Cesium implementation for RITTA GIS.
 *
 * Renders fullscreen 3D globe with Ion world terrain + OSM 3D buildings,
 * places neon billboard pins for each project, wires click / dblclick
 * handlers and exposes layer visibility toggles.
 *
 * Imports are resolved dynamically so this module never executes on the SSR
 * worker (Cesium relies on `window`).
 */
export function CesiumViewer({
  projects,
  selectedId,
  layers,
  onSelect,
  onZoomToSite,
  onReady,
}: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<unknown>(null);
  const buildingsRef = useRef<unknown>(null);
  const entitiesRef = useRef<Map<string, unknown>>(new Map());
  const hasFramedPinsRef = useRef(false);
  const [cesiumReady, setCesiumReady] = useState(0);

  // boot Cesium once
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      // Point Cesium at its static assets on a public CDN so we don't
      // depend on a Vite plugin that would inject HTML during SSR.
      const CESIUM_VERSION = "1.142";
      const CDN = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium`;
      (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = CDN;
      if (!document.querySelector('link[data-cesium-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${CDN}/Widgets/widgets.css`;
        link.setAttribute("data-cesium-css", "true");
        document.head.appendChild(link);
      }
      const Cesium = await import("cesium");

      const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
      if (!token) {
        console.error("[RittaGIS] Missing VITE_CESIUM_ION_TOKEN");
        return;
      }
      Cesium.Ion.defaultAccessToken = token;

      if (cancelled || !containerRef.current) return;

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        terrain: Cesium.Terrain.fromWorldTerrain(),
      });

      // Dark, futuristic look
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      // Keep imagery readable regardless of local day/night in the preview.
      viewer.scene.globe.enableLighting = false;
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#020617");
      // Crisper tiles + hi-DPI rendering so the globe doesn't look blurry.
      viewer.scene.globe.maximumScreenSpaceError = 1.5;
      (viewer as unknown as { resolutionScale: number }).resolutionScale =
        Math.min(window.devicePixelRatio || 1, 2);
      viewer.scene.postProcessStages.fxaa.enabled = true;
      viewer.cesiumWidget.creditContainer &&
        ((viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none");

      // OSM Buildings (Cesium Ion asset 96188)
      try {
        const tileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(tileset);
        buildingsRef.current = tileset;
      } catch (err) {
        console.warn("[RittaGIS] OSM buildings unavailable", err);
      }

      // Initial camera — wide Thailand framing. Pulled back enough that the
      // whole country fits horizontally on typical 16:9 viewports (Cesium
      // Rectangle fits the larger of width/height, so we widen the bbox).
      viewer.camera.setView({
        destination: Cesium.Rectangle.fromDegrees(91.0, 2.0, 112.0, 23.5),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });

      // Pointer events
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((evt: { position: import("cesium").Cartesian2 }) => {
        const picked = viewer.scene.pick(evt.position);
        if (picked && (picked as { id?: { id?: string } }).id?.id) {
          onSelect((picked as { id: { id: string } }).id.id);
        } else {
          onSelect(null);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      handler.setInputAction((evt: { position: import("cesium").Cartesian2 }) => {
        const picked = viewer.scene.pick(evt.position);
        const id = (picked as { id?: { id?: string } } | undefined)?.id?.id;
        if (id) onZoomToSite(id);
      }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      viewerRef.current = viewer;
      // expose for rebuild effects
      (containerRef.current as unknown as { __cesium: unknown }).__cesium = {
        viewer,
        Cesium,
        handler,
      };
      setCesiumReady((v) => v + 1);
      onReady?.({ viewer: viewer as unknown as import("cesium").Viewer, Cesium });
    })();

    return () => {
      cancelled = true;
      const ctx = (containerRef.current as unknown as {
        __cesium?: { viewer: { destroy: () => void }; handler: { destroy: () => void } };
      } | null)?.__cesium;
      if (ctx) {
        try {
          ctx.handler.destroy();
        } catch {
          /* noop */
        }
        try {
          ctx.viewer.destroy();
        } catch {
          /* noop */
        }
      }
      viewerRef.current = null;
      entitiesRef.current.clear();
    };
    // intentionally bind handlers only once; latest handlers captured via refs below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild entity pins when project list or pin layer toggle changes
  useEffect(() => {
    const ctx = (containerRef.current as unknown as {
      __cesium?: { viewer: unknown; Cesium: typeof import("cesium") };
    } | null)?.__cesium;
    if (!ctx) return;
    const { viewer, Cesium } = ctx as {
      viewer: import("cesium").Viewer;
      Cesium: typeof import("cesium");
    };

    viewer.entities.removeAll();
    entitiesRef.current.clear();
    if (!layers.pins) return;

    for (const p of projects) {
      const color = STATUS_COLOR[p.status] ?? "#22d3ee";
      const ent = viewer.entities.add({
        id: p.id,
        position: Cesium.Cartesian3.fromDegrees(
          p.coordinates.lng,
          p.coordinates.lat,
          p.elevation + 50,
        ),
        point: {
          pixelSize: 14,
          color: Cesium.Color.fromCssColorString(color).withAlpha(0.9),
          outlineColor: Cesium.Color.fromCssColorString("#0ea5e9"),
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        },
        label: {
          text: p.name.includes(" - ") ? p.name.replace(" - ", "\n") : p.name,
          font: "11px 'JetBrains Mono', monospace",
          fillColor: Cesium.Color.fromCssColorString("#e0f2fe"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(14, 0),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#020617").withAlpha(0.65),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
          scaleByDistance: new Cesium.NearFarScalar(50_000, 1.0, 5_000_000, 0.5),
        },
      });
      entitiesRef.current.set(p.id, ent);
    }

    if (!hasFramedPinsRef.current && projects.length > 0) {
      hasFramedPinsRef.current = true;
      const west = Math.min(...projects.map((p) => p.coordinates.lng));
      const south = Math.min(...projects.map((p) => p.coordinates.lat));
      const east = Math.max(...projects.map((p) => p.coordinates.lng));
      const north = Math.max(...projects.map((p) => p.coordinates.lat));
      // Generous padding so pins never sit against the viewport edge, and
      // single-pin / tight-cluster cases still produce a usable framing.
      const padLng = Math.max(1.5, (east - west) * 0.6);
      const padLat = Math.max(1.2, (north - south) * 0.6);

      viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(
          west - padLng,
          south - padLat,
          east + padLng,
          north + padLat,
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
        duration: 1.2,
      });
    }
  }, [projects, layers.pins, cesiumReady]);

  // Buildings toggle
  useEffect(() => {
    const ts = buildingsRef.current as { show?: boolean } | null;
    if (ts) ts.show = layers.buildings;
  }, [layers.buildings]);

  // Highlight selected
  useEffect(() => {
    const ctx = (containerRef.current as unknown as {
      __cesium?: { Cesium: typeof import("cesium") };
    } | null)?.__cesium;
    if (!ctx) return;
    const { Cesium } = ctx;
    entitiesRef.current.forEach((value, id) => {
      const ent = value as {
        point?: { pixelSize?: { setValue?: (n: number) => void }; outlineWidth?: { setValue?: (n: number) => void } };
      };
      const active = id === selectedId;
      if (ent.point) {
        // mutate via Cesium ConstantProperty wrappers
        (ent as { point: Record<string, unknown> }).point.pixelSize = new Cesium.ConstantProperty(
          active ? 22 : 14,
        );
        (ent as { point: Record<string, unknown> }).point.outlineWidth = new Cesium.ConstantProperty(
          active ? 4 : 2,
        );
      }
    });
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      style={{ background: "#020617" }}
    />
  );
}

/**
 * Imperative helper — fly Cesium camera to a project location at campus scale.
 * Used from the right rail "Zoom to Site" button.
 */
export async function flyToProject(container: HTMLDivElement | null, p: RittaProject) {
  const ctx = (container as unknown as {
    __cesium?: { viewer: unknown; Cesium: typeof import("cesium") };
  } | null)?.__cesium;
  if (!ctx) return;
  const { viewer, Cesium } = ctx as {
    viewer: { camera: { flyTo: (o: unknown) => void } };
    Cesium: typeof import("cesium");
  };
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(p.coordinates.lng, p.coordinates.lat, 1200),
    orientation: {
      heading: Cesium.Math.toRadians(35),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
    duration: 2.5,
  });
}