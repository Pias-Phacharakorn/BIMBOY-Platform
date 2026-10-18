import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import type { ConstructionSchedule } from "../../classes/ConstructionSchedule";

/**
 * Everything the 4D tab does to the scene: shows a project's Construction Sequence at a month.
 * Not started = hidden, In progress = the Schedule's highlight colour, Built = real colour.
 * Which state an element is in comes from `ConstructionSchedule` (pure); this only resolves GUIDs
 * to geometry and writes visibility and colour. → ADR-0038 draft.
 *
 * **In progress is a Highlighter style, never `model.setColor`.** `Highlighter.updateColors()`
 * begins with `fragments.resetHighlight()` over every item and repaints only what registered styles
 * hold, and it runs on every select and clear — raw colour would vanish at the first click.
 *
 * **The scene changes only when the month crosses a Task boundary.** Between two boundaries every
 * state is constant, so most Play frames do nothing; a crossing is one `setVisible` per model, one
 * `highlightByID`, one `core.update(true)` (ADR-0020).
 *
 * **While active it owns visibility.** It sets every element's visibility itself, so the caller must
 * keep other visibility writers (Isolate / Hide) off for as long as it is active.
 */
export class ConstructionSequence extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "5b0e9d4c-7a31-4f62-9c8e-2d4f6a1b3e70" as const;

  /** The Highlighter style that paints In-progress elements. */
  static readonly STYLE = "construction-in-progress";

  enabled = true;

  readonly onDisposed = new OBC.Event<string>();

  /** Fires with the number of Schedule GUIDs found in no loaded model, whenever it changes. */
  readonly onUnresolvedChanged = new OBC.Event<number>();

  private readonly _components: OBC.Components;

  private _schedule: ConstructionSchedule | null = null;
  private _active = false;
  private _showUnscheduled = false;

  /** The month currently on screen. `null` = nothing applied; the next apply sets every element. */
  private _applied: number | null = null;
  /** The month the caller last asked for. */
  private _target: number | null = null;

  /** modelId → (GUID → localId). GUIDs resolve once per model load — 6,560 per call on PSM. */
  private readonly _resolved = new Map<string, Map<string, number>>();
  private _unresolved = 0;

  /**
   * Applies are serialised: each awaits worker round-trips, and two interleaved diffs would each
   * start from a month the other has already left. Requests made while one runs coalesce into a
   * single follow-up at the latest target.
   */
  private _running: Promise<void> | null = null;
  private _dirty = false;

  /**
   * Bumped by every activate and deactivate. `deactivate` restores the viewport only after awaiting
   * in-flight applies; if the tab was reopened meanwhile, its restore would show every element on
   * top of the fresh picture, so it checks this first.
   */
  private _generation = 0;

  /** Colour the style was last registered with — re-registering resets the style's selection. */
  private _styleColor: string | null = null;

  constructor(components: OBC.Components) {
    super(components);
    components.add(ConstructionSequence.uuid, this);
    this._components = components;
  }

  get active() {
    return this._active;
  }

  get unresolvedCount() {
    return this._unresolved;
  }

  // ── Inputs ──────────────────────────────────────────────────────────────────

  setSchedule(schedule: ConstructionSchedule | null) {
    if (this._schedule === schedule) return;
    this._schedule = schedule;
    this._resolved.clear();
    this._applied = null;
    this._setUnresolved(0);
    if (this._active) {
      if (schedule) this._registerStyle(schedule.highlightColor);
      this._request();
    }
  }

  setMonth(month: number) {
    this._target = month;
    if (this._active) this._request();
  }

  setShowUnscheduled(show: boolean) {
    if (this._showUnscheduled === show) return;
    this._showUnscheduled = show;
    this._applied = null;
    if (this._active) this._request();
  }

  /**
   * Re-applies the whole picture — for when something outside this component changed visibility
   * (Show All) or the model list changed (a model loaded or unloaded while active).
   */
  refresh() {
    this._applied = null;
    if (this._active) this._request();
  }

  /** Resolves when every requested apply has finished. */
  async settled() {
    while (this._running) await this._running;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  activate() {
    if (this._active) return;
    this._active = true;
    this._generation++;
    this._applied = null;
    if (this._schedule) this._registerStyle(this._schedule.highlightColor);
    this._request();
  }

  /**
   * Gives the viewport back: every element visible, the In-progress style cleared. Only this
   * component's style — the user's selection is the app's, not this tab's. The caller bumps
   * `visibilityEpoch` so standing rules (IfcSpace) re-assert.
   *
   * Resolves `false` when it did not restore — not active, or re-activated while it waited.
   */
  async deactivate(): Promise<boolean> {
    if (!this._active) return false;
    this._active = false;
    const generation = ++this._generation;
    await this.settled();
    if (this._generation !== generation) return false;
    this._applied = null;
    try {
      const highlighter = this._components.get(OBF.Highlighter);
      if (highlighter.styles.has(ConstructionSequence.STYLE)) {
        await highlighter.clear(ConstructionSequence.STYLE);
      }
      await this._components.get(OBC.Hider).set(true);
    } catch (err) {
      console.warn("[4d] failed to restore the viewport", err);
    }
    return true;
  }

  // ── Applying ────────────────────────────────────────────────────────────────

  private _request() {
    this._dirty = true;
    if (this._running) return;
    this._running = (async () => {
      try {
        while (this._dirty) {
          this._dirty = false;
          try {
            await this._apply();
          } catch (err) {
            console.warn("[4d] failed to apply the month", err);
            this._applied = null;
          }
        }
      } finally {
        this._running = null;
      }
    })();
  }

  private async _apply() {
    const schedule = this._schedule;
    const month = this._target;
    if (!this._active || !schedule || month === null) return;

    const fragments = this._components.get(OBC.FragmentsManager);
    const newModels = await this._resolve(schedule, fragments);
    if (!this._active || this._schedule !== schedule) return;
    if (newModels) this._applied = null;

    const full = this._applied === null;
    if (!full && schedule.intervalOf(this._applied!) === schedule.intervalOf(month)) {
      this._applied = month;
      return;
    }

    const diff = schedule.diff(full ? null : this._applied, month);
    const writes: Promise<void>[] = [];

    for (const [modelId, model] of fragments.list) {
      const ids = this._resolved.get(modelId);
      if (!ids) continue;
      // A full apply first sets Unscheduled elements, which no diff ever touches again.
      if (full) await model.setVisible(undefined, this._showUnscheduled);
      const show = localIds(ids, diff.show);
      const hide = localIds(ids, diff.hide);
      if (show.length > 0) writes.push(model.setVisible(show, true));
      if (hide.length > 0) writes.push(model.setVisible(hide, false));
    }
    await Promise.all(writes);

    const inProgress: OBC.ModelIdMap = {};
    for (const [modelId, ids] of this._resolved) {
      const found = localIds(ids, diff.inProgress);
      if (found.length > 0) inProgress[modelId] = new Set(found);
    }
    // removePrevious = true replaces the whole In-progress set; an empty map clears it.
    await this._components
      .get(OBF.Highlighter)
      .highlightByID(ConstructionSequence.STYLE, inProgress, true, false);

    await fragments.core.update(true);
    this._applied = month;
  }

  /**
   * Resolves the Schedule's GUIDs in every loaded model not yet resolved, and forgets models that
   * have gone. Returns whether any model was newly resolved — its elements then need a full apply.
   */
  private async _resolve(schedule: ConstructionSchedule, fragments: OBC.FragmentsManager) {
    for (const modelId of [...this._resolved.keys()]) {
      if (!fragments.list.has(modelId)) this._resolved.delete(modelId);
    }

    const guids = [...schedule.guids];
    let added = false;
    for (const [modelId, model] of fragments.list) {
      if (this._resolved.has(modelId)) continue;
      const ids = new Map<string, number>();
      try {
        const found = await model.getLocalIdsByGuids(guids);
        found.forEach((localId, index) => {
          if (localId !== null && localId !== undefined) ids.set(guids[index], localId);
        });
      } catch (err) {
        console.warn(`[4d] failed to resolve GUIDs in model ${modelId}`, err);
        continue;
      }
      if (this._schedule !== schedule) return false;
      this._resolved.set(modelId, ids);
      added = true;
    }

    // Counted only once something is loaded: before that, every GUID is "missing" and the count
    // would cry drift on every page load.
    if (fragments.list.size > 0) {
      const found = new Set<string>();
      for (const ids of this._resolved.values()) for (const guid of ids.keys()) found.add(guid);
      this._setUnresolved(schedule.guidCount - found.size);
    }
    return added;
  }

  private _registerStyle(color: string) {
    const highlighter = this._components.get(OBF.Highlighter);
    if (this._styleColor === color && highlighter.styles.has(ConstructionSequence.STYLE)) return;
    this._styleColor = color;
    highlighter.styles.set(ConstructionSequence.STYLE, {
      color: new THREE.Color(color),
      renderedFaces: FRAGS.RenderedFaces.TWO,
      opacity: 1,
      transparent: false,
    });
  }

  private _setUnresolved(count: number) {
    if (this._unresolved === count) return;
    this._unresolved = count;
    this.onUnresolvedChanged.trigger(count);
  }

  dispose() {
    this._active = false;
    this._schedule = null;
    this._resolved.clear();
    this.onUnresolvedChanged.reset();
    this.onDisposed.trigger(ConstructionSequence.uuid);
    this.onDisposed.reset();
  }
}

function localIds(ids: ReadonlyMap<string, number>, guids: readonly string[]): number[] {
  const out: number[] = [];
  for (const guid of guids) {
    const id = ids.get(guid);
    if (id !== undefined) out.push(id);
  }
  return out;
}
