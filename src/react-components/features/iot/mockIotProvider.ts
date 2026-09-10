/**
 * Stand-in telemetry for devices the user has authored. → `docs/feature/iot.md` § Mock telemetry.
 *
 * **Phase 1's hardcoded roster is gone.** Devices now come from the database, so this module no
 * longer knows which devices exist — it only answers "what is this device reading". That is exactly
 * the shape a real IoT platform answers, which is why `listDevices` left the provider interface.
 *
 * **Values are a pure function of `(deviceId, metric, timeBucket)`.** Nothing accumulates, so a
 * value is reproducible across reloads without storing anything, and the history "ring buffer" is
 * simply a cap on how many buckets are ever requested — there is no array to leak.
 *
 * **A hash of the device id also picks the device's behaviour band** — roughly 70% healthy, 15%
 * warning, 10% alarm, 5% offline. Phase 1 scripted those states into a fixed roster; that is
 * impossible once devices are user-created, and without this every bound device would read healthy
 * and the warning, alarm and offline rendering paths would never be seen on a real project.
 *
 * Seeding from the IFC GlobalId was rejected: deleting a device and re-binding the same element
 * would replay the identical series, implying the system remembers something the user deleted.
 */

import { METRICS } from "./iotThresholds";
import type { IotProvider, Metric, Reading } from "./iotTypes";

/** Readings are bucketed to this cadence, matching the UI's tick. */
export const TICK_MS = 5_000;

/** Hard cap on points returned from `getHistory`. This *is* the ring buffer. */
export const MAX_HISTORY_POINTS = 200;

/** Swing periods in buckets. Deliberately not multiples of each other, so they beat. */
const SLOW_PERIOD = 173;
const FAST_PERIOD = 29;

/** Which band a device sits in, decided once from its id. */
type Band = "ok" | "warn" | "alarm" | "offline";

/** Stable 32-bit hash. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 0–1, stable for a given key. */
function unit(text: string): number {
  return (hash(text) % 100_000) / 100_000;
}

function bandOf(deviceId: string): Band {
  const roll = unit(`${deviceId}:band`);
  if (roll < 0.05) return "offline";
  if (roll < 0.15) return "alarm";
  if (roll < 0.3) return "warn";
  return "ok";
}

function bucketOf(atMs: number): number {
  return Math.floor(atMs / TICK_MS);
}

/**
 * Where in a metric's range this device sits, given its band.
 *
 * The centre is placed so a device stays inside its band as it drifts — a device that wanders in
 * and out of alarm on its own would make the list re-sort under the user's cursor.
 */
function centreFor(metric: Metric, band: Band, deviceId: string): { centre: number; swing: number } {
  const meta = METRICS[metric];
  const [floor, ceiling] = meta.domain;
  const jitter = unit(`${deviceId}:${metric}:centre`);

  // Metrics with no unhealthy direction (occupancy) have no bands to respect — just wander.
  if (meta.warn === null || meta.alarm === null) {
    const span = (ceiling - floor) * 0.5;
    return { centre: floor + span * (0.3 + jitter * 0.4), swing: span * 0.25 };
  }

  if (band === "alarm") {
    const headroom = ceiling - meta.alarm;
    return { centre: meta.alarm + headroom * (0.25 + jitter * 0.4), swing: headroom * 0.12 };
  }
  if (band === "warn") {
    const span = meta.alarm - meta.warn;
    return { centre: meta.warn + span * (0.25 + jitter * 0.4), swing: span * 0.12 };
  }
  // Healthy: sit well below the warning line so drift cannot cross it.
  const span = meta.warn - floor;
  return { centre: floor + span * (0.35 + jitter * 0.4), swing: span * 0.12 };
}

function valueAt(deviceId: string, metric: Metric, band: Band, bucket: number): number {
  const { centre, swing } = centreFor(metric, band, deviceId);
  const seed = hash(`${deviceId}:${metric}`);
  const slowPhase = ((seed % 1000) / 1000) * Math.PI * 2;
  const fastPhase = (((seed >>> 10) % 1000) / 1000) * Math.PI * 2;

  const drift =
    Math.sin(bucket / SLOW_PERIOD + slowPhase) * 0.75 +
    Math.sin(bucket / FAST_PERIOD + fastPhase) * 0.25;

  const raw = centre + drift * swing;
  const value = METRICS[metric].precision === 0 ? Math.round(raw) : raw;
  return Math.max(0, value);
}

/**
 * Which metrics a device reports. The provider is not told — devices are authored — so the caller
 * registers them before reading. Keeps the provider free of any BIM or database knowledge.
 */
const registry = new Map<string, Metric[]>();

export function registerDeviceMetrics(deviceId: string, metrics: Metric[]) {
  registry.set(deviceId, metrics);
}

export function forgetDevice(deviceId: string) {
  registry.delete(deviceId);
}

export const mockIotProvider: IotProvider = {
  isOnline(deviceId) {
    return bandOf(deviceId) !== "offline";
  },

  /**
   * An offline device's last report is placed hours in the past and, crucially, is *stable* — a
   * "last seen" that creeps forward every tick would describe a device that is still reporting.
   */
  lastSeen(deviceId) {
    if (bandOf(deviceId) !== "offline") return new Date().toISOString();
    const hoursAgo = 3 + Math.floor(unit(`${deviceId}:stale`) * 40);
    const anchor = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    return new Date(anchor - hoursAgo * 3_600_000).toISOString();
  },

  /**
   * An offline device reports **nothing** — not a stale value and emphatically not a zero. The UI
   * renders the absence; a dead sensor shown as a perfect reading actively misinforms.
   */
  async getLatest(deviceIds) {
    const bucket = bucketOf(Date.now());
    const readings: Reading[] = [];

    for (const deviceId of deviceIds) {
      const band = bandOf(deviceId);
      if (band === "offline") continue;

      for (const metric of registry.get(deviceId) ?? []) {
        readings.push({
          deviceId,
          metric,
          value: valueAt(deviceId, metric, band, bucket),
          unit: METRICS[metric].unit,
          ts: new Date(bucket * TICK_MS).toISOString(),
        });
      }
    }
    return readings;
  },

  async getHistory(deviceId, metric, from, to) {
    const band = bandOf(deviceId);
    if (band === "offline") return [];
    if (!(registry.get(deviceId) ?? []).includes(metric)) return [];

    const lastBucket = bucketOf(to.getTime());
    const firstBucket = Math.max(
      bucketOf(from.getTime()),
      lastBucket - MAX_HISTORY_POINTS + 1,
    );

    const readings: Reading[] = [];
    for (let bucket = firstBucket; bucket <= lastBucket; bucket++) {
      readings.push({
        deviceId,
        metric,
        value: valueAt(deviceId, metric, band, bucket),
        unit: METRICS[metric].unit,
        ts: new Date(bucket * TICK_MS).toISOString(),
      });
    }
    return readings;
  },
};
