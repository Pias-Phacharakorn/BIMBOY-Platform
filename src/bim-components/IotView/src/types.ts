/** Where a device's element currently sits. Absent when no loaded model contains it. */
export interface ResolvedDevice {
  modelId: string;
  localId: number;
}

export interface ResolutionResult {
  /** deviceId → where it is. */
  resolved: ReadonlyMap<string, ResolvedDevice>;
  /**
   * deviceId → the model it was actually found in, when that differs from the stored hint. The
   * caller persists the correction so the next lookup is cheap again.
   */
  corrections: ReadonlyMap<string, string>;
}

export const EMPTY_RESOLUTION: ResolutionResult = {
  resolved: new Map(),
  corrections: new Map(),
};

/** What a chip looks like. Derived entirely by the caller — this layer computes no status. */
export type ChipTone = "ok" | "warn" | "alarm" | "offline";

/**
 * One chip's content, handed down by the feature layer.
 *
 * Deliberately pre-formatted strings and a ready-made icon name: the engine layer holds no
 * thresholds, no units and no icon registry, so the chip and the device list cannot drift apart by
 * computing the same thing twice.
 */
export interface ChipEntry {
  deviceId: string;
  /** Iconify name for the headline metric, e.g. `"mdi:thermometer"`. */
  icon: string;
  /** Formatted value with no unit, e.g. `"24.5"`. Empty string renders the no-value marker. */
  value: string;
  unit: string;
  tone: ChipTone;
  selected: boolean;
  /** Shown only while selected — the second reading, already formatted with its unit. */
  secondary?: string;
}
