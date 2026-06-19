/**
 * RITTA GIS — domain contracts.
 *
 * These types model the macro→micro hierarchy:
 *   Country GIS → Campus / Site → BIM object.
 *
 * The schema is intentionally flat and JSON-serialisable so it can later be
 * sourced from Supabase without touching the UI layer.
 */

export type ProjectStatus = "Ongoing" | "Finished" | "Bidding" | "Operational";

export type ProjectType =
  | "HeadOffice"
  | "Warehouse"
  | "Factory"
  | "Infrastructure"
  | "Commercial"
  | "Residential"
  | "Energy";

export interface ProjectCoordinates {
  lat: number;
  lng: number;
}

export interface ProjectTimeline {
  startDate: string; // ISO
  endDate: string; // ISO
}

export interface ProjectKpis {
  manpowerActual: number;
  manpowerTarget: number;
  openRFIs: number;
  pendingRFIs: number;
  resolvedRFIs: number;
  safetyDays: number;
  riskMitigationRate: number; // 0..1
}

export interface SCurvePoint {
  month: string; // e.g. "2025-01"
  planned: number; // 0..100
  actual: number; // 0..100
}

export interface ProjectWeather {
  stationId: string;
  tempC: number;
  humidity: number;
  windKmh: number;
  condition: string;
}

export interface RittaProject {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  coordinates: ProjectCoordinates;
  elevation: number; // meters
  province: string;
  progressPercentage: number;
  projectValueUSD: number;
  projectManager: string;
  timeline: ProjectTimeline;
  bimModelUrl?: string;
  /** Storage paths in the `bim-models` Supabase bucket (private). Each path
   *  is downloaded as its own fragment and added under the geo anchor. */
  bimModelPaths?: string[];
  /** Skip the default Y-up→Z-up axis flip when the .frag already exports
   *  with a real-world / Z-up coordinate frame. */
  bimWorldCoordinates?: boolean;
  /** Database UUID of the linked project (null when pin has no project). */
  projectDbId?: string | null;
  /** Heading (Z), pitch (X), roll (Y) in degrees. Defaults 0. */
  bimHeadingDeg?: number;
  bimPitchDeg?: number;
  bimRollDeg?: number;
  weatherStationId: string;
  kpiMetrics: ProjectKpis;
  sCurve: SCurvePoint[];
  weather: ProjectWeather;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface LiveAlert {
  id: string;
  projectId: string;
  severity: AlertSeverity;
  message: string;
  at: number; // epoch ms
}