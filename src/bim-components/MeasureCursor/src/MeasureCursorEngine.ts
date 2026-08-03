import * as OBC from "@thatopen/components";
import * as THREE from "three";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so
// vite-tsconfig-paths does not rewrite aliases inside this folder. Repo-wide convention here.
import { MeasureHoverManager } from "./MeasureHoverManager";
import { MeasurePointerManager } from "./MeasurePointerManager";
import { MeasureCursorDescriptor, MeasurerLike } from "./types";

/**
 * Everything a snapping measure tool does, minus which measurer it drives.
 *
 * Deliberately **not** an `OBC.Component`: the registered components are the cursors, and each
 * owns one engine. A shared base class would have put `static uuid` on an inheritance chain,
 * where a subclass that forgets to redeclare it silently overwrites its sibling in the
 * component registry.
 *
 * The two managers own their own listeners and free them on `detach()`; this class owns only
 * the activation policy and the measurer configuration.
 */
export class MeasureCursorEngine {
  private readonly _components: OBC.Components;
  private readonly _descriptor: MeasureCursorDescriptor;
  private readonly _hover: MeasureHoverManager;
  private readonly _pointer: MeasurePointerManager;

  private _world: OBC.World | null = null;
  private _enabled = false;
  /** Whether listeners are currently bound — `enabled` can be true before a world arrives. */
  private _active = false;

  /** `measurer.delay` as it was before activation forced it to 0. */
  private _restoreDelay: number | null = null;

  constructor(components: OBC.Components, descriptor: MeasureCursorDescriptor) {
    this._components = components;
    this._descriptor = descriptor;

    this._hover = new MeasureHoverManager(components);
    this._pointer = new MeasurePointerManager({
      onClick: () => this._measurer.create(),
      onKeyDown: (event) => this._handleKeyDown(event),
    });
  }

  get world() {
    return this._world;
  }

  /**
   * Re-binds an active cursor to the new world. Enabling with no world set is allowed and
   * simply does nothing until one arrives — which is what keeps `Components.get()`
   * auto-constructing a cursor harmless.
   */
  set world(value: OBC.World | null) {
    if (this._world === value) return;
    const wasActive = this._active;
    if (wasActive) this._deactivate();
    this._world = value;
    if (wasActive) this._activate();
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value: boolean) {
    if (this._enabled === value) return;
    this._enabled = value;
    if (value) {
      this._activate();
    } else {
      this._deactivate();
    }
  }

  dispose() {
    this._deactivate();
    this._enabled = false;
  }

  private get _measurer(): MeasurerLike {
    return this._descriptor.getMeasurer(this._components);
  }

  private _activate() {
    if (this._active || !this._world) return;
    this._active = true;

    const world = this._world;
    const measurer = this._measurer;

    // `pickerMode` is deliberately untouched: each measurer owns its own picker, and its
    // default mode is the one that routes snapping to the fragments worker. Why `delay` must
    // be 0 is in the `types.ts` JSDoc — it is correctness, not tuning.
    measurer.world = world;
    if (this._descriptor.color !== undefined) {
      measurer.color = new THREE.Color(this._descriptor.color);
    }
    measurer.enabled = true;
    this._restoreDelay = measurer.delay;
    measurer.delay = 0;

    this._hover.attach(world);
    this._pointer.attach(world);
  }

  private _deactivate() {
    if (!this._active) return;
    this._active = false;

    const measurer = this._measurer;
    measurer.enabled = false;
    if (this._restoreDelay !== null) {
      measurer.delay = this._restoreDelay;
      this._restoreDelay = null;
    }

    this._hover.detach();
    this._pointer.detach();
  }

  private _handleKeyDown(event: KeyboardEvent) {
    const measurer = this._measurer;
    if (event.key === "Delete" || event.key === "Backspace") {
      measurer.delete();
      return;
    }
    this._descriptor.onKeyDown?.(measurer, event);
  }
}
