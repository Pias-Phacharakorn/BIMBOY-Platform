import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import { RoomLabels, roomKey, roomLabelParts } from "./src";
import type { Room } from "./src";

/**
 * Collapses the burst of `onItemSet` events a batch load fires into a single pass — same reason
 * and same value as `Views2DList`.
 */
const REGEN_DEBOUNCE_MS = 400;

/**
 * Chips draw through walls (see `RoomLabels`), so past a couple of dozen the viewport stops being
 * readable. A cap is cruder than distance-culling but it is honest and has no per-frame cost.
 *
 * It bounds **pinned and selected chips together**, because a ctrl-selection of a whole floor
 * would otherwise put hundreds on screen. Pins win the contest for slots — they are explicit — and
 * rooms that lose one are still selected and still outlined; only their chip is dropped.
 */
export const MAX_LABELS = 20;

/**
 * Everything the Room tab does to the 3D scene: driving selection from the room list, anchoring
 * the floating name chips, and answering "what rooms are in the loaded models".
 *
 * **It deliberately does not ghost the model.** An earlier cut did, and owned a snapshot of
 * `fragments.core.models.materials.list` for the tab's lifetime — which put it in a fight with
 * `ToolbarGhost` over one global, and made correctness depend on save/restore running exactly
 * once in the right order across tab switches, mid-load model changes and disposal. Ghosting is
 * the user's call now, through the toolbar button that already did it. Rooms are still findable
 * in a solid model because the chips are CSS2D and cannot be occluded — you lose the volumes, not
 * the names.
 *
 * **Why this is a component and not a hook.** It owns engine state that must survive a React
 * re-render and be unwound exactly once — a pool of scene-graph objects and a subscription to the
 * Highlighter. `Views2DList` gets away with living in React because it only drives `OBC.Views`.
 *
 * **A room is selected the same way anything else is.** An earlier cut painted rooms amber with a
 * private `"room-view"` Highlighter style. It looked distinct, but because that name is not
 * `config.selectName`, none of the `events.select.*` handlers fired — not `OBF.Outliner`, not the
 * `ViewportWrapper` sync that fills `bimStore` — so the panel had to write the store by hand and
 * the app ended up with two selections that could disagree: clicking in the viewport cleared one
 * and left the other painted. Driving the real select style instead collapses both into one, and
 * `setupHighlighter`'s `selectMaterialDefinition: null` means rooms get the same green outline as
 * every other pick rather than a colour of their own.
 *
 * The subscription runs both ways: selecting a room in the viewport lights up its row in the
 * panel and gives it a chip, exactly as clicking the row does.
 */
export class RoomView extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "8f2e5c14-6b9d-4a37-9e21-3c7d8b0f4a62" as const;

  enabled = true;

  readonly onDisposed = new OBC.Event<string>();

  /** Fires when the loaded models changed, so the panel should re-query. Debounced. */
  readonly onRoomsChanged = new OBC.Event<void>();

  /** Fires when the selected rooms changed — from this panel *or* from a pick in the viewport. */
  readonly onSelectionChanged = new OBC.Event<void>();

  private readonly _components: OBC.Components;
  private readonly _labels = new RoomLabels();

  private _world: OBC.World | null = null;
  private _active = false;

  /** Last `listRooms()` result — what a Highlighter selection is intersected against. */
  private _rooms: Room[] = [];

  /** Ordered, because the label cap fills slots in list order once the pins have taken theirs. */
  private _selected: Room[] = [];
  private readonly _pinned = new Map<string, Room>();

  /** Room centres are stable per model load, and each one costs a worker round-trip. */
  private readonly _centres = new Map<string, THREE.Vector3>();

  private _regenTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(components: OBC.Components) {
    super(components);
    components.add(RoomView.uuid, this);
    this._components = components;
  }

  get world() {
    return this._world;
  }

  set world(world: OBC.World | null) {
    this._world = world;
    if (this._active && world) this._labels.attach(world.scene.three);
  }

  get active() {
    return this._active;
  }

  get pinnedKeys(): ReadonlySet<string> {
    return new Set(this._pinned.keys());
  }

  get selectedKeys(): ReadonlySet<string> {
    return new Set(this._selected.map(roomKey));
  }

  private get _highlighter() {
    return this._components.get(OBF.Highlighter);
  }

  /** The Highlighter's own name for the select style — never hardcode `"select"`. */
  private get _selectName() {
    return this._highlighter.config.selectName;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /** Starts tracking model and selection changes, and readies the label pool. */
  activate() {
    if (this._active) return;
    this._active = true;

    const fragments = this._components.get(OBC.FragmentsManager);
    fragments.list.onItemSet.add(this._onFragmentsChanged);
    fragments.list.onItemDeleted.add(this._onFragmentsChanged);

    const events = this._highlighter.events[this._selectName];
    events.onHighlight.add(this._onSelectionEvent);
    events.onClear.add(this._onSelectionEvent);

    if (this._world) this._labels.attach(this._world.scene.three);
  }

  /**
   * Removes every chip and stops tracking. Pins are deliberately forgotten — re-entering the tab
   * starts clean, so no stale room can outlive the model it came from.
   *
   * **The selection is deliberately left standing.** It is the app's selection now, not this
   * tab's: clearing it on the way out would wipe Item Properties and discard a pick the user may
   * have made in the viewport. Whatever they did with Ghost is likewise theirs.
   */
  deactivate() {
    if (!this._active) return;
    this._active = false;

    this._clearRegenTimeout();

    const fragments = this._components.get(OBC.FragmentsManager);
    fragments.list.onItemSet.remove(this._onFragmentsChanged);
    fragments.list.onItemDeleted.remove(this._onFragmentsChanged);

    const events = this._highlighter.events[this._selectName];
    events.onHighlight.remove(this._onSelectionEvent);
    events.onClear.remove(this._onSelectionEvent);

    this._selected = [];
    this._rooms = [];
    this._pinned.clear();
    this._centres.clear();
    this._labels.clear();
    this._labels.detach();
  }

  // ── Querying ────────────────────────────────────────────────────────────────

  /** How many models are loaded — lets the panel tell "nothing loaded" from "no spaces in here". */
  get modelCount() {
    return this._components.get(OBC.FragmentsManager).list.size;
  }

  /** Every IFCSPACE across every loaded model, in model order. */
  async listRooms(): Promise<Room[]> {
    const fragments = this._components.get(OBC.FragmentsManager);
    const rooms: Room[] = [];

    for (const [modelId, model] of fragments.list) {
      let ids: number[] = [];
      try {
        const byCategory = await model.getItemsOfCategories([/^IFCSPACE$/]);
        ids = Object.values(byCategory).flat();
      } catch (err) {
        console.warn(`Room view: failed to list spaces in model ${modelId}`, err);
        continue;
      }
      if (ids.length === 0) continue;

      let data: FRAGS.ItemData[] = [];
      try {
        data = await model.getItemsData(ids, {
          attributesDefault: true,
          relations: { Decomposes: { attributes: true, relations: false } },
        });
      } catch (err) {
        console.warn(`Room view: failed to read space data in model ${modelId}`, err);
        continue;
      }

      for (let i = 0; i < ids.length; i++) {
        const item = data[i];
        if (!item) continue;
        rooms.push({
          modelId,
          localId: ids[i],
          name: readString(item.Name),
          longName: readString(item.LongName),
          levelName: readStoreyName(item.Decomposes),
        });
      }
    }

    // Cached because a Highlighter selection arrives as bare ids: without this there is nothing to
    // recognise "the user just picked room 305 in the viewport" against.
    this._rooms = rooms;

    // Re-derive the selection against the new list before returning — this is the only moment
    // `_rooms` is known good, and a selection made before the list existed (or surviving a model
    // reload) has to be matched up here or it is invisible in the panel.
    await this._syncSelection();

    return rooms;
  }

  // ── Selection, labels, camera ───────────────────────────────────────────────

  /**
   * Selects a room from the panel. `additive` (ctrl/cmd-click) toggles it in or out of the current
   * selection; otherwise it replaces the selection.
   *
   * This only *asks* the Highlighter. `_selected` and the chips are updated by the resulting
   * event, on the same path a viewport pick takes — so there is one way selection state changes,
   * not two that have to agree.
   *
   * `removePrevious` stays `true` even when adding: the merged map *is* the intended whole
   * selection, so one call replaces the previous one. That is what makes ctrl-deselecting work.
   */
  async select(room: Room, additive: boolean) {
    const key = roomKey(room);
    const next = additive
      ? this._selected.filter((selected) => roomKey(selected) !== key)
      : [];
    const removed = additive && next.length !== this._selected.length;
    if (!removed) next.push(room);

    try {
      if (next.length === 0) {
        await this._highlighter.clear(this._selectName);
      } else {
        await this._highlighter.highlightByID(
          this._selectName,
          this._mapFor(...next),
          true,
          false,
        );
      }
    } catch (err) {
      console.warn("Room view: failed to select room", err);
    }
  }

  /** Frames a room. Same call `PropertyTable`'s zoom-to-selection makes. */
  async zoomTo(room: Room) {
    const camera = this._world?.camera;
    if (!(camera instanceof OBC.OrthoPerspectiveCamera)) return;
    try {
      await camera.fitToItems(this._mapFor(room));
    } catch (err) {
      console.warn("Room view: failed to zoom to room", err);
    }
  }

  /**
   * Pins or unpins a room's chip so it stays up independently of selection.
   * Returns `false` when the pin was refused because every label slot is already pinned.
   */
  async togglePin(room: Room): Promise<boolean> {
    const key = roomKey(room);
    if (this._pinned.delete(key)) {
      await this._syncLabels();
      return true;
    }
    if (this._pinned.size >= MAX_LABELS) return false;
    this._pinned.set(key, room);
    await this._syncLabels();
    return true;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** Merges rooms into one `ModelIdMap`, grouping by model so federated selections work. */
  private _mapFor(...rooms: Room[]): OBC.ModelIdMap {
    const map: OBC.ModelIdMap = {};
    for (const room of rooms) {
      const ids = map[room.modelId] ?? new Set<number>();
      ids.add(room.localId);
      map[room.modelId] = ids;
    }
    return map;
  }

  /**
   * Fires on every selection change, whoever caused it — a row click here or a pick in the
   * viewport.
   *
   * ⚠️ **The event payload is ignored on purpose.** `onHighlight` is triggered with the resulting
   * selection but `onClear` is triggered with the items that were *removed*, so a handler that
   * trusts its argument gets the wrong set half the time. Reading `selection[selectName]` back is
   * the same defence `ViewportWrapper.syncSelection` uses.
   */
  private _onSelectionEvent = () => {
    if (!this._active) return;
    void this._syncSelection();
  };

  private async _syncSelection() {
    const selection = this._highlighter.selection[this._selectName] ?? {};

    // Kept in `_rooms` order rather than selection order, so the label cap fills slots in the
    // order the panel lists them. Non-room picks simply match nothing and clear the chips.
    this._selected = this._rooms.filter((room) =>
      selection[room.modelId]?.has(room.localId),
    );

    await this._syncLabels();
    this.onSelectionChanged.trigger();
  }

  /**
   * Chips currently wanted = every pin, then selected rooms in list order, truncated to
   * `MAX_LABELS`. Anything else is removed.
   */
  private async _syncLabels() {
    const wanted = new Map(this._pinned);
    for (const room of this._selected) {
      if (wanted.size >= MAX_LABELS) break;
      wanted.set(roomKey(room), room);
    }

    for (const key of this._labels.keys()) {
      if (!wanted.has(key)) this._labels.remove(key);
    }

    for (const [key, room] of wanted) {
      if (this._labels.has(key)) continue;
      const centre = await this._centreOf(room);
      if (!centre) continue;
      this._labels.set(key, roomLabelParts(room), centre);
    }
  }

  private async _centreOf(room: Room): Promise<THREE.Vector3 | null> {
    const key = roomKey(room);
    const cached = this._centres.get(key);
    if (cached) return cached;

    // `BoundingBoxer.list` is shared state, so it is cleared on both sides of the read — the same
    // discipline `SectionBox.fitToSelection` follows.
    const boxer = this._components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    try {
      await boxer.addFromModelIdMap(this._mapFor(room));
      const box = boxer.get();
      if (!box || box.isEmpty()) return null;
      const centre = box.getCenter(new THREE.Vector3());
      this._centres.set(key, centre);
      return centre;
    } catch (err) {
      console.warn("Room view: failed to compute room centre", err);
      return null;
    } finally {
      boxer.list.clear();
    }
  }

  private _onFragmentsChanged = () => {
    this._clearRegenTimeout();
    this._regenTimeout = setTimeout(() => {
      this._regenTimeout = null;
      this._onModelsSettled();
    }, REGEN_DEBOUNCE_MS);
  };

  private _onModelsSettled() {
    if (!this._active) return;

    // A model that left may have taken a pinned room with it, and every cached centre belongs to
    // a model list that no longer holds. The selection is not touched here: the panel's reload
    // calls `listRooms`, which re-derives it against the new list.
    this._centres.clear();
    this._pinned.clear();
    this._labels.clear();
    this._rooms = [];

    this.onRoomsChanged.trigger();
  }

  private _clearRegenTimeout() {
    if (this._regenTimeout === null) return;
    clearTimeout(this._regenTimeout);
    this._regenTimeout = null;
  }

  dispose() {
    // Unsubscribes from both the fragments list and the Highlighter, and clears the label pool —
    // a no-op if the tab was never opened.
    this.deactivate();

    this.onRoomsChanged.reset();
    this.onSelectionChanged.reset();
    this.onDisposed.trigger(RoomView.uuid);
    this.onDisposed.reset();
  }
}

// ── IFC attribute readers ─────────────────────────────────────────────────────

function readString(attribute: FRAGS.ItemAttribute | FRAGS.ItemData[] | undefined): string {
  if (!attribute || Array.isArray(attribute)) return "";
  const { value } = attribute;
  return value === undefined || value === null ? "" : String(value);
}

/**
 * Pulls the storey name out of a space's `Decomposes` relation.
 *
 * The relation is an array because IFC permits several decomposition parents; the storey is the
 * one whose `_category` is `IFCBUILDINGSTOREY`, so it is matched rather than assumed to be first.
 */
function readStoreyName(
  relation: FRAGS.ItemAttribute | FRAGS.ItemData[] | undefined,
): string {
  if (!relation || !Array.isArray(relation)) return "";
  for (const parent of relation) {
    const category = readString(parent._category).toUpperCase();
    if (category !== "IFCBUILDINGSTOREY") continue;
    const name = readString(parent.Name);
    if (name) return name;
  }
  return "";
}

export * from "./src";
