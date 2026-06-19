import { useEffect, useRef } from "react";
import type { AppProject } from "../../classes/Project";

interface ProjectMapProps {
  projects: AppProject[];
}

export function ProjectMap({ projects }: ProjectMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    let leafletLink: HTMLLinkElement | null = null;
    let leafletScript: HTMLScriptElement | null = null;

    const initMap = () => {
      if (!mapContainerRef.current || !active) return;
      
      const L = (window as any).L;
      if (!L) return;

      // Default center at London
      let centerLat = 51.5005;
      let centerLng = -0.127;

      const validProjects = projects.filter(
        (p) => p.location && typeof p.location.latitude === "number" && typeof p.location.longitude === "number"
      );

      if (validProjects.length > 0) {
        centerLat = validProjects.reduce((sum, p) => sum + p.location!.latitude, 0) / validProjects.length;
        centerLng = validProjects.reduce((sum, p) => sum + p.location!.longitude, 0) / validProjects.length;
      }

      if (mapRef.current) {
        mapRef.current.remove();
      }

      const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 12);
      mapRef.current = map;

      // Dark style premium map tile layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      // Add markers
      validProjects.forEach((project) => {
        const loc = project.location!;
        
        const customIcon = L.divIcon({
          className: "custom-map-marker",
          html: `<div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: var(--accent, #38bdf8);
            border: 2px solid #fff;
            box-shadow: 0 0 10px var(--accent, #38bdf8);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const statusTone = project.display.statusTone;
        const toneColor = statusTone === "ok" ? "#2ecc71" : statusTone === "warn" ? "#f1c40f" : "#3498db";

        const popupContent = `
          <div style="
            font-family: inherit;
            padding: 4px;
            color: #fff;
            background: #1e293b;
            border-radius: 6px;
            font-size: 13px;
          ">
            <h3 style="margin: 0 0 4px 0; font-weight: bold; color: var(--accent, #38bdf8); font-size: 14px;">
              ${project.projectName}
            </h3>
            <div style="margin-bottom: 4px; color: #94a3b8; font-size: 11px; font-family: monospace;">
              Code: ${project.display.code} | Number: ${project.display.label}
            </div>
            <div style="margin-bottom: 6px;">
              Status: <span style="color: ${toneColor}; font-weight: bold;">${project.display.statusLabel}</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <a href="#/project/${project.id}" style="
                display: inline-block;
                padding: 4px 8px;
                background: var(--accent, #38bdf8);
                color: #000;
                font-weight: bold;
                border-radius: 4px;
                text-decoration: none;
                font-size: 11px;
                text-align: center;
                flex: 1;
              ">Enter Workspace</a>
            </div>
          </div>
        `;

        L.marker([loc.latitude, loc.longitude], { icon: customIcon })
          .addTo(map)
          .bindPopup(popupContent);
      });
    };

    // Load Leaflet assets dynamically
    if (!(window as any).L) {
      leafletLink = document.createElement("link");
      leafletLink.rel = "stylesheet";
      leafletLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(leafletLink);

      leafletScript = document.createElement("script");
      leafletScript.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      leafletScript.onload = () => {
        if (active) initMap();
      };
      document.body.appendChild(leafletScript);
    } else {
      initMap();
    }

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (leafletLink) {
        document.head.removeChild(leafletLink);
      }
      if (leafletScript) {
        document.body.removeChild(leafletScript);
      }
    };
  }, [projects]);

  return (
    <div style={{
      width: "100%",
      height: "calc(100vh - 280px)",
      minHeight: "450px",
      borderRadius: "var(--radius-md)",
      border: "1px solid var(--border)",
      overflow: "hidden",
      position: "relative",
      background: "#0d1117"
    }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />
      <style>{`
        .leaflet-popup-content-wrapper {
          background: #1e293b !important;
          border: 1px solid var(--border) !important;
          color: #fff !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5) !important;
        }
        .leaflet-popup-tip {
          background: #1e293b !important;
          border: 1px solid var(--border) !important;
        }
        .leaflet-popup-close-button {
          color: #94a3b8 !important;
        }
      `}</style>
    </div>
  );
}
