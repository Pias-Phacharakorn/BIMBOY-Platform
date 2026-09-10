/**
 * Domain types for the IOT tab.
 *
 * Two shapes live here and they are deliberately kept apart:
 *
 * - {@link IotDevice} — the **authored** row. A user pointed at an IFC element and said "this is a
 *   monitored device". It carries BIM identity because that is the whole point of it.
 * - {@link Reading} + {@link IotProvider} — the **telemetry** side, which knows nothing about BIM.
 *
 * Phase 1 had a single `Device` type with no BIM identity, because devices were invented at runtime
 * by walking the model. Phase 2 splits them: devices are project data, readings are a stream keyed
 * by device. → `docs/feature/iot.md`, and `docs/adr/0028-iot-provider-interface-defers-the-transport.md`.
 */

import type { Database } from "@/integrations/supabase/types";

/** The database enum, not a parallel union — they cannot drift because this *is* it. */
export type Metric = Database["public"]["Enums"]["iot_metric"];

/** Every metric, in the order the enum declares them. Used to render the metric picker. */
export const ALL_METRICS: readonly Metric[] = [
  "temperature",
  "humidity",
  "co2",
  "occupancy",
  "power",
  "pm25",
];

/**
 * A device row exactly as `iot_devices` stores it, taken straight from the generated Supabase
 * types so the two can never drift. `Metric` below is likewise the database enum, not a parallel
 * hand-written union — adding a metric therefore has to start with a migration.
 */
export type IotDeviceRow = Database["public"]["Tables"]["iot_devices"]["Row"];

/** camelCase view of {@link IotDeviceRow}, which is what the UI consumes. */
export interface IotDevice {
  id: string;
  projectId: string;
  ifcGuid: string;
  modelId: string | null;
  deviceCode: string | null;
  label: string;
  elementCategory: string | null;
  metrics: Metric[];
  createdAt: string;
  updatedAt: string;
}

export interface Reading {
  /** The authored device's id. Phase 3 will key real telemetry by `deviceCode` instead. */
  deviceId: string;
  metric: Metric;
  value: number;
  unit: string;
  /** ISO timestamp. */
  ts: string;
}

/**
 * The telemetry contract.
 *
 * ⚠️ **`listDevices` is gone.** In phase 1 the provider owned the roster; now devices are authored
 * and live in Supabase, so asking a telemetry source which devices exist would be asking the wrong
 * system. What remains is the part a real IoT platform genuinely answers: given these devices, what
 * are they reading.
 */
export interface IotProvider {
  /** Newest reading per metric, for each requested device. Offline devices return nothing. */
  getLatest(deviceIds: string[]): Promise<Reading[]>;
  getHistory(deviceId: string, metric: Metric, from: Date, to: Date): Promise<Reading[]>;
  /** Whether the device is currently reporting at all. Offline is a device fact, not a value. */
  isOnline(deviceId: string): boolean;
  /** ISO timestamp of the last report. */
  lastSeen(deviceId: string): string;
}

/** Derived, never stored. → `statusFor`. */
export type DeviceStatus = "ok" | "warn" | "alarm" | "offline";
