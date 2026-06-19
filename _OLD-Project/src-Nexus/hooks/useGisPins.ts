import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RittaProject, ProjectStatus, ProjectType, SCurvePoint } from "@/types/project";

function buildSCurve(progress: number): SCurvePoint[] {
  const months: SCurvePoint[] = [];
  const start = new Date(2024, 0, 1);
  for (let i = 0; i < 18; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const t = i / 17;
    const planned = Math.round(100 / (1 + Math.exp(-8 * (t - 0.5))));
    const actualBase = Math.round(100 / (1 + Math.exp(-8 * (t - 0.55))));
    months.push({ month: tag, planned, actual: Math.min(progress, actualBase) });
  }
  return months;
}

type Row = {
  slug: string;
  name: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  elevation: number;
  province: string;
  progress_percentage: number;
  project_value_usd: number;
  project_manager: string;
  start_date: string | null;
  end_date: string | null;
  weather_station_id: string;
  bim_model_url: string | null;
  bim_model_paths: string[] | null;
  bim_world_coordinates: boolean;
  project_id: string | null;
  bim_heading_deg: number | null;
  bim_pitch_deg: number | null;
  bim_roll_deg: number | null;
};

function rowToProject(r: Row): RittaProject {
  return {
    id: r.slug,
    name: r.name,
    type: r.type as ProjectType,
    status: r.status as ProjectStatus,
    coordinates: { lat: r.lat, lng: r.lng },
    elevation: r.elevation,
    province: r.province,
    progressPercentage: r.progress_percentage,
    projectValueUSD: Number(r.project_value_usd),
    projectManager: r.project_manager,
    timeline: { startDate: r.start_date ?? "", endDate: r.end_date ?? "" },
    bimModelUrl: r.bim_model_url ?? undefined,
    bimModelPaths: r.bim_model_paths ?? undefined,
    bimWorldCoordinates: r.bim_world_coordinates,
    projectDbId: r.project_id,
    bimHeadingDeg: r.bim_heading_deg ?? 0,
    bimPitchDeg: r.bim_pitch_deg ?? 0,
    bimRollDeg: r.bim_roll_deg ?? 0,
    weatherStationId: r.weather_station_id,
    kpiMetrics: {
      manpowerActual: 0,
      manpowerTarget: 0,
      openRFIs: 0,
      pendingRFIs: 0,
      resolvedRFIs: 0,
      safetyDays: 0,
      riskMitigationRate: 1,
    },
    sCurve: buildSCurve(r.progress_percentage),
    weather: {
      stationId: r.weather_station_id,
      tempC: 32,
      humidity: 70,
      windKmh: 10,
      condition: "Clear",
    },
  };
}

export function useGisPins() {
  const [projects, setProjects] = useState<RittaProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("gis_pins")
      .select(
        "slug,name,type,status,lat,lng,elevation,province,progress_percentage,project_value_usd,project_manager,start_date,end_date,weather_station_id,bim_model_url,bim_model_paths,bim_world_coordinates,project_id,bim_heading_deg,bim_pitch_deg,bim_roll_deg",
      )
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[useGisPins]", error);
      setError(error.message);
    } else {
      setProjects((data as Row[]).map(rowToProject));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const updateLocal = useCallback((projectDbId: string, patch: Partial<RittaProject>) => {
    setProjects((prev) =>
      prev.map((p) => (p.projectDbId === projectDbId ? { ...p, ...patch } : p)),
    );
  }, []);

  return { projects, loading, error, refetch: load, updateLocal };
}