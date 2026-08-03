import * as OBC from "@thatopen/components";
import * as THREE from "three";

/**
 * The slice of `OBF.Measurement` the engine drives.
 *
 * Structural on purpose: `OBF.LengthMeasurement` and `OBF.AreaMeasurement` both satisfy it
 * without either being named here, so adding a measure tool means writing a descriptor, not
 * touching the engine.
 */
export interface MeasurerLike {
  world: OBC.World | null;
  enabled: boolean;
  /**
   * Debounce before `onPointerStop` fires, which is what refreshes the snap preview. Forced
   * to **0** while a cursor is active, and that is load-bearing rather than a tuning choice:
   * `LengthMeasurement.endCreation()` commits whatever `updatePreviewLine()` last wrote into
   * its temp line, and `updatePreviewLine` is the `onPointerStop` handler. At the vendor
   * default of 300 ms, clicking the second point before the debounce elapses commits the line
   * to where the cursor was a beat ago. `AreaMeasurement` re-picks inside `create()`, so it
   * would be safe either way.
   *
   * ⚠️ 0 **narrows** that window, it does not close it: `create()` → `endCreation()` commits
   * synchronously while the refresh is a `setTimeout(0)` plus a worker round trip, so a click
   * landing inside that gap still commits the previous pick. Closing it properly needs a
   * settled pick at click time, and the vendor offers no way to get one — `updatePreviewLine`
   * is private and `OBC.Event.trigger` does not await its handlers.
   */
  delay: number;
  color: THREE.Color;
  create(): void;
  delete(): void;
  endCreation(): void;
}

/** Everything that distinguishes one measure tool from another. */
export interface MeasureCursorDescriptor {
  /** Resolves the OBF measurer this cursor drives. */
  getMeasurer(components: OBC.Components): MeasurerLike;
  /** Applied to `measurer.color` on activate. Omit to leave the measurer's own colour alone. */
  color?: THREE.ColorRepresentation;
  /**
   * Tool-specific keys. Called after the shared Delete/Backspace → `delete()` handling, and
   * only for events that already passed the text-input focus guard.
   */
  onKeyDown?(measurer: MeasurerLike, event: KeyboardEvent): void;
}
