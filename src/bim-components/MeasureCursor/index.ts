import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { MeasureCursorEngine } from "./src/MeasureCursorEngine";
import { MeasureCursorDescriptor } from "./src/types";

export * from "./src";

/**
 * Point-to-point length measurement with vertex snapping.
 *
 * Length needs nothing beyond the shared engine: no colour override (it keeps the measurer's
 * own) and no keys past the shared Delete/Backspace, since a length is complete at two points.
 */
const LENGTH_DESCRIPTOR: MeasureCursorDescriptor = {
  getMeasurer: (components) => components.get(OBF.LengthMeasurement),
};

/** Multi-point area measurement with vertex snapping. */
const AREA_DESCRIPTOR: MeasureCursorDescriptor = {
  getMeasurer: (components) => components.get(OBF.AreaMeasurement),
  color: "#24a6f1",
  onKeyDown: (measurer, event) => {
    // An area has no natural last point, so the polygon is closed explicitly.
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      measurer.endCreation();
    }
  },
};

/**
 * Snapping length measurement: the right rail's **Measure → Length** tool.
 *
 * A thin registered shell over {@link MeasureCursorEngine} — the engine holds all the
 * behaviour, the descriptor above holds the only thing specific to lengths. Construct with
 * `new LengthMeasureCursor(components)` and then set `world`, the same shape `GizmoAxis` and
 * `Hoverer` use, so `components.get(LengthMeasureCursor)` type-checks without a cast.
 */
export class LengthMeasureCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "2d1a37c0-ff4d-4ea7-90d0-ecdfc812d8a6" as const;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  private readonly _engine: MeasureCursorEngine;

  constructor(components: OBC.Components) {
    super(components);
    components.add(LengthMeasureCursor.uuid, this);
    this._engine = new MeasureCursorEngine(components, LENGTH_DESCRIPTOR);
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

  dispose() {
    this._engine.dispose();
    this.onDisposed.trigger(LengthMeasureCursor.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }
}

/**
 * Snapping area measurement: the right rail's **Measure → Area** tool.
 *
 * Identical to {@link LengthMeasureCursor} but for its descriptor — which is the entire point
 * of the split.
 */
export class AreaMeasureCursor extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "4d2b27d0-ff5d-4ea7-90d0-ecdfc812d8a7" as const;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  private readonly _engine: MeasureCursorEngine;

  constructor(components: OBC.Components) {
    super(components);
    components.add(AreaMeasureCursor.uuid, this);
    this._engine = new MeasureCursorEngine(components, AREA_DESCRIPTOR);
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

  dispose() {
    this._engine.dispose();
    this.onDisposed.trigger(AreaMeasureCursor.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }
}
