/**
 * Threshold constants and the pure function that turns a reading into a status.
 *
 * Thresholds are global constants. Making them per-project needs settings plumbing nobody has asked
 * for yet; this file stays the single place to change one meanwhile. → `docs/feature/iot.md`.
 */

import type { DeviceStatus, Metric, Reading } from "./iotTypes";

interface MetricMeta {
  label: string;
  /** Icon registry key, so the chips can name a glyph without importing an icon library. */
  icon: "METRIC_TEMPERATURE" | "METRIC_HUMIDITY" | "METRIC_CO2" | "METRIC_OCCUPANCY" | "METRIC_POWER" | "METRIC_PM25";
  unit: string;
  /** Decimal places for display. Occupancy and ppm are whole numbers; temperature is not. */
  precision: number;
  /**
   * Values at or above `warn` read as warning, at or above `alarm` as alarm. `null` means the
   * metric has no unhealthy direction worth flagging (occupancy is information, not a fault).
   */
  warn: number | null;
  alarm: number | null;
  /** Fixed chart floor/ceiling, so a flat series does not render as a full-scale zigzag. */
  domain: readonly [number, number];
}

export const METRICS: Record<Metric, MetricMeta> = {
  temperature: {
    label: "Temperature",
    icon: "METRIC_TEMPERATURE",
    unit: "°C",
    precision: 1,
    warn: 28,
    alarm: 30,
    domain: [14, 36],
  },
  humidity: {
    label: "Humidity",
    icon: "METRIC_HUMIDITY",
    unit: "%",
    precision: 0,
    warn: 70,
    alarm: 80,
    domain: [20, 90],
  },
  co2: {
    label: "CO₂",
    icon: "METRIC_CO2",
    unit: "ppm",
    precision: 0,
    warn: 1000,
    alarm: 1400,
    domain: [380, 1800],
  },
  occupancy: {
    label: "Occupancy",
    icon: "METRIC_OCCUPANCY",
    unit: "people",
    precision: 0,
    warn: null,
    alarm: null,
    domain: [0, 20],
  },
  power: {
    label: "Power",
    icon: "METRIC_POWER",
    unit: "kW",
    precision: 1,
    warn: 60,
    alarm: 75,
    domain: [0, 90],
  },
  // Common AQI breakpoints: moderate air starts around 35, unhealthy around 55. The WHO 24-hour
  // guideline is stricter at 15 — retune here if the building follows it.
  pm25: {
    label: "PM2.5",
    icon: "METRIC_PM25",
    unit: "µg/m³",
    precision: 0,
    warn: 35,
    alarm: 55,
    domain: [0, 120],
  },
};

/**
 * A reading's status, derived — never read off the reading itself.
 *
 * Offline is **not** decided here: it is a property of the device, not of any value it reported,
 * and conflating the two is how a dead sensor ends up rendering as a healthy zero.
 */
export function statusFor(metric: Metric, value: number): Exclude<DeviceStatus, "offline"> {
  const meta = METRICS[metric];
  if (meta.alarm !== null && value >= meta.alarm) return "alarm";
  if (meta.warn !== null && value >= meta.warn) return "warn";
  return "ok";
}

/**
 * The worst status across a device's readings — what the list row shows.
 *
 * `online` is passed in rather than inferred from an empty reading list: a device that is online
 * but has not reported yet is not the same as a dead one, and collapsing the two is how a dead
 * sensor ends up rendering as healthy.
 */
export function worstStatus(
  online: boolean,
  readings: readonly Reading[],
): DeviceStatus {
  if (!online) return "offline";
  let worst: Exclude<DeviceStatus, "offline"> = "ok";
  for (const reading of readings) {
    const status = statusFor(reading.metric, reading.value);
    if (status === "alarm") return "alarm";
    if (status === "warn") worst = "warn";
  }
  return worst;
}

/** Alarming devices first, then warning, then healthy, then offline. → ticket 04. */
export const STATUS_ORDER: Record<DeviceStatus, number> = {
  alarm: 0,
  warn: 1,
  ok: 2,
  offline: 3,
};

export function formatValue(metric: Metric, value: number): string {
  return value.toFixed(METRICS[metric].precision);
}

/**
 * The one reading that represents a device: the one driving its status.
 *
 * **Shared deliberately.** The device list row, the chip on the model and the status badge must all
 * name the same reading — two copies of this rule is exactly how a row shows 1480 ppm while the
 * chip beside it shows 24 °C, with nothing to say which is real.
 */
export function headlineReading(readings: readonly Reading[]): Reading | null {
  if (readings.length === 0) return null;
  return (
    readings.find((reading) => statusFor(reading.metric, reading.value) === "alarm") ??
    readings.find((reading) => statusFor(reading.metric, reading.value) === "warn") ??
    readings[0]
  );
}
