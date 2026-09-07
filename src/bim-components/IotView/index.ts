import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { IotChips } from "./src";
import {
  EMPTY_RESOLUTION,
  type ChipEntry,
  type ResolutionResult,
  type ResolvedDevice,
} from "./src";

/**
 * Chips draw through walls (see `IotChips`), so past a couple of dozen the viewport stops being
 * readable. Same cap and same reason as `RoomView.MAX_LABELS`.
 *
 * ⚠️ Unlike rooms, the cap here is filled **in the order the caller supplies**, and the caller
 * sorts by status. Filling in list order — as rooms do — would drop an alarming device's chip
 * merely because it sorts late, hiding the one thing worth showing.
 */
export const MAX_CHIPS = 20;

/** What the component needs to place and label one device. */
export interface IotChipRequest extends ChipEntry {
  /** Where the device's element is. Devices that resolve nowhere are simply not passed in. */
  target: ResolvedDevice;
}

/**
 * Everything the IOT tab does to the 3D scene: resolving stored IFC GlobalIds back to geometry,
 * flying the camera to a device, and anchoring the floating reading chips.
 *
 * **Why this is a component and not a hook.** Phase 1 deliberately kept IoT out of this layer, and
 * the criterion recorded then was whether the feature *owns engine resources that outlive a render
 * and must be disposed*. Until chips existed the answer was no — two read-only queries and one
 * camera call. It is yes now: a pool of scene-graph objects with DOM elements that leak if nobody
 * unwinds them. Same reasoning that makes `RoomView` a component.
 *
 * **It computes no status and knows no thresholds.** Chip text, tone and icon arrive
 * pre-formatted from the feature layer, which already derives them for the device list. Deriving
 * them twice is how a chip and its row end up disagreeing.
 */
export class IotView extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "c4a71e83-92bf-4d6a-8f30-15b7e0c9d244" as const;

  enabled = true;

  readonly onDisposed = new OBC.Event<string>();

  /** Fires with the device id when a chip is clicked. */
  readonly onChipClicked = new OBC.Event<string>();

  private readonly _components: OBC.Components;
  private readonly _chips = new IotChips();

  private _world: OBC.World | null = null;
  private _active = false;
  private _layerVisible = true;

  /** Element centres are stable per model load, and each one costs a worker round-trip. */
  private readonly _centres = new Map<string, THREE.Vector3>();

  /**
   * Ownership token for `syncChips`. It is fire-and-forget from an effect that re-runs on every
   * telemetry tick, and it awaits a worker round-trip for each uncached centre — so two runs can
   * interleave `set`/`remove` on the pool. Both are idempotent and keyed by device, so the pool
   * still converges, but a superseded run has no business writing at all. → ADR-0026's pattern.
   */
  private _syncGeneration = 0;

  constructor(components: OBC.Components) {
    super(components);
    components.add(IotView.uuid, this);
    this._components = components;
    this._chips.onClick = (deviceId) => this.onChipClicked.trigger(deviceId);
  }

  get world() {
    return this._world;
  }

  /**
   * Methods rather than property setters throughout: the callers are React hooks, and assigning to
   * a property of a value a hook produced trips `react-hooks/immutability`. The rule is right in
   * spirit — this object is shared mutable state — so the mutation is at least made explicit.
   */
  setWorld(world: OBC.World | null) {
    this._world = world;
    if (this._active && world) this._chips.attach(world.scene.three);
  }

  get active() {
    return this._active;
  }

  /** Whether the chip layer is switched on. Switching it off removes every chip immediately. */
  get layerVisible() {
    return this._layerVisible;
  }

  setLayerVisible(visible: boolean) {
    if (this._layerVisible === visible) return;
    this._layerVisible = visible;
    if (!visible) this._chips.clear();
  }

  /**
   * Whether chips accept clicks. The caller turns this off while a viewport tool is active, so
   * measuring and sectioning are never fighting a chip for the pointer.
   */
  setInteractive(interactive: boolean) {
    this._chips.setInteractive(interactive);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  activate() {
    if (this._active) return;
    this._active = true;
    if (this._world) this._chips.attach(this._world.scene.three);
  }

  /**
   * Removes every chip and stops anchoring. Cached centres are dropped too — a model may be
   * unloaded while the tab is closed, and a stale centre would place a chip in mid-air.
   *
   * The device selection is deliberately left standing: it is the app's selection, not this tab's.
   */
  deactivate() {
    if (!this._active) return;
    this._active = false;
    this._centres.clear();
    this._chips.clear();
    this._chips.detach();
  }

  // ── Resolution ──────────────────────────────────────────────────────────────

  /**
   * Resolves stored IFC GlobalIds against the currently loaded models.
   *
   * **The stored model id is a hint, not a key.** It is derived from the `.frag` filename, and this
   * project already contains a model whose name storage altered to `… (1)` on a duplicate upload.
   * The hint is tried first for speed; a miss falls through to every other loaded model rather than
   * declaring the device lost.
   *
   * A device that resolves nowhere is **not an error** — its model simply is not loaded, which is
   * normal given models auto-load behind a per-project flag.
   */
  async resolve(
    devices: readonly { id: string; ifcGuid: string; modelId: string | null }[],
  ): Promise<ResolutionResult> {
    if (devices.length === 0) return EMPTY_RESOLUTION;

    const fragments = this._components.get(OBC.FragmentsManager);
    if (fragments.list.size === 0) return EMPTY_RESOLUTION;

    // One lookup per model with every outstanding GUID rather than one per device: the vendor call
    // takes an array, and a building with a hundred sensors would otherwise be a hundred trips.
    const pending = new Map(devices.map((device) => [device.ifcGuid, device]));
    const resolved = new Map<string, ResolvedDevice>();
    const corrections = new Map<string, string>();

    const hinted = [...new Set(devices.map((d) => d.modelId).filter((id): id is string => !!id))];
    const modelOrder = [
      ...hinted.filter((id) => fragments.list.has(id)),
      ...[...fragments.list.keys()].filter((id) => !hinted.includes(id)),
    ];

    for (const modelId of modelOrder) {
      if (pending.size === 0) break;
      const model = fragments.list.get(modelId);
      if (!model) continue;

      const guids = [...pending.keys()];
      let localIds: (number | null)[];
      try {
        localIds = await model.getLocalIdsByGuids(guids);
      } catch (err) {
        console.warn(`[iot] failed to resolve GUIDs in model ${modelId}`, err);
        continue;
      }

      guids.forEach((guid, index) => {
        const localId = localIds[index];
        if (localId === null || localId === undefined) return;
        const device = pending.get(guid);
        if (!device) return;

        resolved.set(device.id, { modelId, localId });
        if (device.modelId !== modelId) corrections.set(device.id, modelId);
        pending.delete(guid);
      });
    }

    return { resolved, corrections };
  }

  /**
   * Reads the IFC GlobalId and category of a picked element, so it can become a device. Returns
   * `null` when the element has no GlobalId — the caller must refuse rather than store a row that
   * can never be located again.
   */
  async describeElement(
    modelId: string,
    localId: number,
  ): Promise<{ ifcGuid: string; category: string | null } | null> {
    const model = this._components.get(OBC.FragmentsManager).list.get(modelId);
    if (!model) return null;

    let ifcGuid: string | null;
    try {
      const [guid] = await model.getGuidsByLocalIds([localId]);
      ifcGuid = guid ?? null;
    } catch (err) {
      console.warn(`[iot] failed to read GUID for ${modelId}:${localId}`, err);
      return null;
    }
    if (!ifcGuid) return null;

    return { ifcGuid, category: await this._readCategory(model, localId) };
  }

  /** Which of the given devices are on geometry that is currently visible. */
  async filterVisible(
    targets: ReadonlyMap<string, ResolvedDevice>,
  ): Promise<ReadonlySet<string>> {
    const fragments = this._components.get(OBC.FragmentsManager);
    const byModel = new Map<string, { deviceId: string; localId: number }[]>();

    for (const [deviceId, target] of targets) {
      const bucket = byModel.get(target.modelId);
      if (bucket) bucket.push({ deviceId, localId: target.localId });
      else byModel.set(target.modelId, [{ deviceId, localId: target.localId }]);
    }

    const visible = new Set<string>();
    for (const [modelId, entries] of byModel) {
      const model = fragments.list.get(modelId);
      if (!model) continue;
      try {
        const flags = await model.getVisible(entries.map((entry) => entry.localId));
        entries.forEach((entry, index) => {
          if (flags[index]) visible.add(entry.deviceId);
        });
      } catch (err) {
        // A failed read must not silently blank the layer — assume visible and let the next pass
        // correct it. A missing chip is a worse lie than a stale one.
        console.warn(`[iot] failed to read visibility in model ${modelId}`, err);
        for (const entry of entries) visible.add(entry.deviceId);
      }
    }
    return visible;
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  /**
   * Flies to a device's element. `fitToItems` routes through `controls.fitToSphere`, so the current
   * view direction survives — being teleported to an arbitrary angle defeats the point of the zoom.
   */
  async zoomTo(target: ResolvedDevice) {
    const camera = this._world?.camera;
    if (!(camera instanceof OBC.OrthoPerspectiveCamera)) return;
    try {
      await camera.fitToItems({ [target.modelId]: new Set([target.localId]) });
    } catch (err) {
      console.warn("[iot] failed to zoom to device", err);
    }
  }

  // ── Chips ───────────────────────────────────────────────────────────────────

  /**
   * Brings the chip pool in line with the requested set: adds what is new, updates what changed,
   * removes what is gone. The caller supplies entries already sorted by priority; anything past
   * {@link MAX_CHIPS} is dropped.
   */
  async syncChips(requests: readonly IotChipRequest[]) {
    if (!this._active || !this._layerVisible) {
      this._chips.clear();
      return;
    }

    const generation = ++this._syncGeneration;
    const isStale = () => this._syncGeneration !== generation;

    const wanted = requests.slice(0, MAX_CHIPS);
    const wantedIds = new Set(wanted.map((request) => request.deviceId));

    for (const deviceId of this._chips.keys()) {
      if (!wantedIds.has(deviceId)) this._chips.remove(deviceId);
    }

    for (const request of wanted) {
      const centre = await this._centreOf(request.target);
      if (!centre) continue;
      // Re-checked after the await: the tab may have closed while centres were being read, and
      // adding to a detached pool would leave an element in the DOM with nothing to remove it.
      // A newer sync having started also ends this one — its list is the current truth.
      if (!this._active || !this._layerVisible || isStale()) return;
      this._chips.set(request, centre);
    }
  }

  private async _centreOf(target: ResolvedDevice): Promise<THREE.Vector3 | null> {
    const key = `${target.modelId}:${target.localId}`;
    const cached = this._centres.get(key);
    if (cached) return cached;

    const model = this._components.get(OBC.FragmentsManager).list.get(target.modelId);
    if (!model) return null;

    try {
      const [box] = await model.getBoxes([target.localId]);
      if (!box) return null;
      const centre = box.getCenter(new THREE.Vector3());
      this._centres.set(key, centre);
      return centre;
    } catch (err) {
      console.warn(`[iot] failed to read bounds for ${key}`, err);
      return null;
    }
  }

  /** Drops cached centres, for when models finish loading or unloading. */
  invalidateCentres() {
    this._centres.clear();
  }

  private async _readCategory(model: unknown, localId: number): Promise<string | null> {
    const candidate = model as {
      getItemsCategories?: (ids: number[]) => (string | null)[] | Promise<(string | null)[]>;
      getItemsData?: (ids: number[], config: { attributesDefault: boolean }) => Promise<unknown[]>;
    };

    try {
      if (typeof candidate.getItemsCategories === "function") {
        const [category] = await candidate.getItemsCategories([localId]);
        if (category) return category;
      }
    } catch (err) {
      console.warn(`[iot] getItemsCategories failed for ${localId}`, err);
    }

    try {
      if (typeof candidate.getItemsData === "function") {
        const [item] = await candidate.getItemsData([localId], { attributesDefault: true });
        const record = item as Record<string, { value?: unknown } | undefined> | undefined;
        for (const key of ["_category", "Category", "type", "_type"]) {
          const value = record?.[key]?.value;
          if (typeof value === "string" && value.trim()) return value;
        }
      }
    } catch (err) {
      console.warn(`[iot] getItemsData failed for ${localId}`, err);
    }

    return null;
  }

  dispose() {
    this.deactivate();
    this.onChipClicked.reset();
    this.onDisposed.trigger(IotView.uuid);
    this.onDisposed.reset();
  }
}

export * from "./src";
