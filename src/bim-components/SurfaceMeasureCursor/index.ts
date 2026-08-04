import * as OBC from "@thatopen/components";
import { SurfaceMeasureEngine } from "./src/SurfaceMeasureEngine";
import { SurfaceMeasurement } from "./src/types";

export * from "./src";

/**
 * Coplanar-face area measurement: the right rail's **Measure → Surface** tool.
 *
 * A thin registered shell over {@link SurfaceMeasureEngine}, matching
 * `LengthMeasureCursor`/`AreaMeasureCursor` in shape — construct with
 * `new SurfaceMeasureCursor(components)` then set `world`, so
 * `components.get(SurfaceMeasureCursor)` type-checks without a cast.
 *
 * It is *not* built on `MeasureCursorEngine`. That engine drives an
 * `OBF.Measurement` through `MeasureCursorDescriptor`, and Surface has no vendor
 * measurer — it derives a face from worker geometry and keeps its own registry.
 * Shared conventions, not shared code.
 *
 * The uuid is carried over from the tool's previous home in `setup/src/`, so the
 * registry key is unchanged.
 */
export class SurfaceMeasureCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "8f3a19b2-cc7d-4e15-91d3-bac1dc023f5a" as const;

  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  private readonly _engine: SurfaceMeasureEngine;

  constructor(components: OBC.Components) {
    super(components);
    components.add(SurfaceMeasureCursor.uuid, this);
    this._engine = new SurfaceMeasureEngine(components);
  }

  /** Fires when a face is confirmed. */
  get onMeasurementAdded() {
    return this._engine.onMeasurementAdded;
  }

  /** Fires with the deleted measurement's id. */
  get onMeasurementDeleted() {
    return this._engine.onMeasurementDeleted;
  }

  get measurements(): readonly SurfaceMeasurement[] {
    return this._engine.measurements;
  }

  get world() {
    return this._engine.world;
  }

  set world(value: OBC.World | null) {
    this._engine.world = value;
  }

  get enabled() {
    return this._engine.enabled;
  }

  set enabled(value: boolean) {
    if (this._engine.enabled === value) return;
    this._engine.enabled = value;
    this.onStateChanged.trigger();
  }

  deleteMeasurement(id: string) {
    this._engine.deleteMeasurement(id);
  }

  setMeasurementVisible(id: string, visible: boolean) {
    this._engine.setMeasurementVisible(id, visible);
  }

  clearAll() {
    this._engine.clearAll();
  }

  dispose() {
    this._engine.dispose();
    this.onDisposed.trigger(SurfaceMeasureCursor.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }
}
