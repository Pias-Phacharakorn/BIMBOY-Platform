import { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Search, Mountain, Building2, MapPin, Flame, Satellite } from "lucide-react";
import {
  CesiumViewer,
  flyToProject,
  type CesiumLayerToggles,
  type CesiumContext,
} from "./CesiumViewer";
import { NavbarHUD } from "./NavbarHUD";
import type { HudModule } from "./NavbarHUD";
import { LeftDashboard, RightDashboard } from "./ControlDashboard";
import { BimGeoOverlay } from "./BimGeoOverlay";
import { MOCK_ALERTS } from "@/data/projectsMock";
import { useGisPins } from "@/hooks/useGisPins";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyContext } from "@/lib/projects.functions";

/**
 * RITTA GIS — top-level module composer.
 *
 * Holds layer toggles, selection state, and orchestrates the macro→micro
 * workflow: Cesium globe → site fly-in → BIM panel overlay.
 */
export function RittaGisModule() {
  const tokenMissing = !import.meta.env.VITE_CESIUM_ION_TOKEN;

  const [activeModule, setActiveModule] = useState<HudModule>("gis");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bimOpen, setBimOpen] = useState(false);
  const [layers, setLayers] = useState<CesiumLayerToggles>({
    terrain: true,
    satellite: true,
    buildings: true,
    pins: true,
    heatmap: false,
  });
  const [filterProvince, setFilterProvince] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const cesiumHostRef = useRef<HTMLDivElement | null>(null);
  const [cesiumCtx, setCesiumCtx] = useState<CesiumContext | null>(null);

  const { projects: allProjects, loading: pinsLoading, refetch, updateLocal } = useGisPins();

  // Permissions: admin OR BIM editor/full on the linked project.
  const fetchCtx = useServerFn(getMyContext);
  const ctxQ = useQuery({ queryKey: ["my-context"], queryFn: () => fetchCtx() });

  const provinces = useMemo(
    () => Array.from(new Set(allProjects.map((p) => p.province))).sort(),
    [allProjects],
  );

  const visibleProjects = useMemo(() => {
    return allProjects.filter((p) => {
      if (filterProvince !== "ALL" && p.province !== filterProvince) return false;
      if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [allProjects, filterProvince, filterStatus, query]);

  const selected = useMemo(
    () => allProjects.find((p) => p.id === selectedId) ?? null,
    [allProjects, selectedId],
  );

  const canEditSelectedPose = useMemo(() => {
    if (!selected?.projectDbId || !ctxQ.data) return false;
    if (ctxQ.data.appRole === "admin") return true;
    const pa = ctxQ.data.projects.find((p) => p.id === selected.projectDbId);
    const lvl = pa?.modules?.bim;
    return lvl === "editor" || lvl === "full";
  }, [selected, ctxQ.data]);

  // Capture the Cesium container DOM node so the bottom dock can issue flyTo
  useEffect(() => {
    cesiumHostRef.current = document.querySelector(
      "[data-cesium-host]",
    ) as HTMLDivElement | null;
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950 text-slate-100">
      {/* Map base layer */}
      <div className="absolute inset-0" data-cesium-host>
        {tokenMissing ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-md rounded-md border border-amber-500/40 bg-slate-950/80 backdrop-blur-md p-6 text-center shadow-[0_0_24px_rgba(245,158,11,0.2)]">
              <h3 className="font-mono uppercase tracking-widest text-amber-300 text-sm">
                Cesium Ion Token Missing
              </h3>
              <p className="mt-2 text-xs text-slate-300">
                Set <code className="text-cyan-300">VITE_CESIUM_ION_TOKEN</code> in your
                environment to enable global terrain and 3D buildings.
              </p>
            </div>
          </div>
        ) : (
          <CesiumViewer
            projects={visibleProjects}
            selectedId={selectedId}
            layers={layers}
            onSelect={(id) => setSelectedId(id)}
            onZoomToSite={async (id) => {
              const p = allProjects.find((x) => x.id === id);
              if (!p) return;
              setSelectedId(id);
              await flyToProject(cesiumHostRef.current, p);
            }}
            onReady={setCesiumCtx}
          />
        )}

        {/* Georeferenced BIM overlay — lives inside the Cesium host so the
            THREE canvas sits directly above the globe canvas. */}
        {bimOpen && selected && (
          <BimGeoOverlay
            project={selected}
            cesiumCtx={cesiumCtx}
            onClose={() => setBimOpen(false)}
            canEdit={canEditSelectedPose}
            onPoseSaved={(pose) => {
              if (selected.projectDbId) {
                updateLocal(selected.projectDbId, {
                  coordinates: { lat: pose.lat, lng: pose.lng },
                  elevation: pose.elevation,
                  bimHeadingDeg: pose.headingDeg,
                  bimPitchDeg: pose.pitchDeg,
                  bimRollDeg: pose.rollDeg,
                });
              }
              refetch();
            }}
          />
        )}
      </div>

      {/* HUD */}
      <NavbarHUD active={activeModule} onSelect={setActiveModule} />

      {/* Scanning grid overlay for cyber feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] z-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Side dashboards */}
      <LeftDashboard
        projects={visibleProjects}
        alerts={MOCK_ALERTS}
        onAlertClick={(pid) => setSelectedId(pid)}
      />
      <RightDashboard
        project={selected}
        onOpenBim={() => setBimOpen(true)}
      />

      {/* Bottom control dock */}
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20">
        <div className="rounded-md border border-cyan-500/30 bg-slate-950/70 backdrop-blur-md shadow-[0_0_18px_rgba(6,182,212,0.15)] px-3 py-2 flex items-center gap-4 flex-wrap">
          {/* Layer toggles */}
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-cyan-300/80" />
            <span className="text-[10px] uppercase tracking-widest font-mono text-cyan-300/70 mr-1">
              Layers
            </span>
            <LayerToggle
              icon={Mountain}
              label="Terrain"
              active={layers.terrain}
              onToggle={() => setLayers((l) => ({ ...l, terrain: !l.terrain }))}
            />
            <LayerToggle
              icon={Satellite}
              label="Satellite"
              active={layers.satellite}
              onToggle={() => setLayers((l) => ({ ...l, satellite: !l.satellite }))}
            />
            <LayerToggle
              icon={Building2}
              label="3D Bldgs"
              active={layers.buildings}
              onToggle={() => setLayers((l) => ({ ...l, buildings: !l.buildings }))}
            />
            <LayerToggle
              icon={MapPin}
              label="Pins"
              active={layers.pins}
              onToggle={() => setLayers((l) => ({ ...l, pins: !l.pins }))}
            />
            <LayerToggle
              icon={Flame}
              label="Heatmap"
              active={layers.heatmap}
              onToggle={() => setLayers((l) => ({ ...l, heatmap: !l.heatmap }))}
            />
          </div>

          <div className="h-6 w-px bg-cyan-500/20" />

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filterProvince}
              onChange={(e) => setFilterProvince(e.target.value)}
              className="rounded-sm border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[11px] font-mono text-cyan-200 focus:border-cyan-400/60 focus:outline-none"
            >
              <option value="ALL">All Provinces</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-sm border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[11px] font-mono text-cyan-200 focus:border-cyan-400/60 focus:outline-none"
            >
              <option value="ALL">Any Status</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Finished">Finished</option>
              <option value="Bidding">Bidding</option>
              <option value="Operational">Operational</option>
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2 rounded-sm border border-slate-700/60 bg-slate-900/60 px-2 py-1">
            <Search className="h-3.5 w-3.5 text-cyan-300/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search project…"
              className="bg-transparent text-[11px] font-mono text-cyan-100 placeholder:text-slate-500 focus:outline-none w-44"
            />
          </div>

          <div className="text-[10px] font-mono text-slate-400">
            <span className="text-cyan-300">{visibleProjects.length}</span> of{" "}
            {allProjects.length} {pinsLoading ? "loading…" : "assets"}
          </div>
        </div>
      </div>
    </div>
  );
}

function LayerToggle({
  icon: Icon,
  label,
  active,
  onToggle,
}: {
  icon: typeof Mountain;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-all",
        active
          ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
          : "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:text-cyan-200",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}