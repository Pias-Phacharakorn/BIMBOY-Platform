import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
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
  /** Debounce before the vertex picker resolves. Forced to 0 while a cursor is active. */
  delay: number;
  color: THREE.Color;
  pickerMode: OBF.GraphicVertexPickerMode;
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
