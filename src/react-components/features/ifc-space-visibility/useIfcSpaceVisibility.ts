import { useCallback, useEffect, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import { useBimStore } from "@/react-components/store/bimStore";
import { useUIStore } from "@/react-components/store/uiStore";

/**
 * Collapses the burst of `onItemSet` events a batch load fires into a single pass — same reason
 * and same value as `Views2DList` and `RoomView`.
 */
const REGEN_DEBOUNCE_MS = 400;

/**
 * Keeps `IFCSPACE` geometry hidden in the 3D viewport unless the user asks for it, or a tab needs
 * it. Called once, from `ModelsView`, for the lifetime of the model view.
 *
 * **The effective value is derived, never stored:** `showIfcSpaces || ifcSpacesForced`. That is
 * the whole reason leaving the Room tab needs no restore step — nothing was saved, so nothing has
 * to be put back; the derivation simply re-evaluates. The alternative (auto-toggling the user's
 * preference on tab enter and restoring it on exit) needs a saved "what it was before" value that
 * must survive tab thrash, mid-load model changes and unmount, which is the exact hazard shape
 * ADR-0017 and ADR-0026 were both written about.
 *
 * ⚠️ **The standing rule only ever hides. It never shows.** This asymmetry is what lets the
 * checkbox coexist with the visibility toolbar instead of refereeing it:
 *
 * - **Standing rule** — runs on mount, on model load, and when `visibilityEpoch` bumps. If spaces
 *   should be hidden it hides them. If they should be visible it does **nothing at all**.
 * - **Transitions** — applied once, in both directions, when the effective value actually flips.
 *
 * A symmetric rule is the obvious implementation and it destroys `Isolate`: on the Room tab the
 * user isolates a single room, the rule fires again on the next model load, and every space in
 * the building comes back. Same for Hide. By only ever hiding, this hook can never undo an
 * explicit visibility action the user took.
 *
 * **Scope is the viewport, not the model.** `OBC.Hider` *is* viewport visibility. The Drawing
 * Editor builds its projections from `model.getItemsIdsWithGeometry()`, which ignores visibility,
 * so a plan drawn while spaces are hidden still contains every space outline. That is a known and
 * accepted gap, not a bug — filtering it would put a `uiStore` read inside `bim-components/`, and
 * would silently answer a separate product question, since room boundaries on a plan are often
 * wanted.
 *
 * @param isRoomTab Whether the Room tab is active. Its whole content is a list of spaces, so it
 * forces them visible for as long as it is open.
 */
export function useIfcSpaceVisibility(isRoomTab: boolean) {
  const { components } = useBimStore();

  const showIfcSpaces = useUIStore((state) => state.showIfcSpaces);
  const setIfcSpacesForced = useUIStore((state) => state.setIfcSpacesForced);
  const visibilityEpoch = useUIStore((state) => state.visibilityEpoch);

  /**
   * ⚠️ Derived from `isRoomTab` directly, **not** from the store's `ifcSpacesForced`. Publishing
   * the flag and reading it back costs a render: the commit that first sees `isRoomTab === true`
   * still has `ifcSpacesForced === false`, so the rule below would fire a redundant hide and only
   * show spaces on the following render — two `Hider` calls, each paying a full
   * `fragments.core.update(true)`, and a visible flash on entry to the Room tab.
   *
   * The store copy exists purely so `ToolbarSettings` can render the row forced-on without
   * knowing a tab called "Room" exists. It may trail this value by one frame; only the checkbox
   * reads it, so that is harmless.
   */
  const effective = showIfcSpaces || isRoomTab;

  /** `modelId -> IFCSPACE localIds`. Populated per model, so a new load queries only itself. */
  const cacheRef = useRef(new Map<string, number[]>());

  /**
   * Ownership token. The space query is an async round-trip per model, and a tab switch, a second
   * model load or unmount can all land while one is in flight — the resumed continuation would
   * then apply a decision that has already been superseded. Re-checked after every await, and
   * bumped on unmount. → ADR-0026.
   */
  const generationRef = useRef(0);

  /**
   * Seeded `true` because that is the world's actual state at boot: models load with their spaces
   * visible. Mounting with spaces due to be hidden therefore reads as a real `true -> false`
   * transition and hides them, rather than being mistaken for "already correct".
   */
  const previousEffectiveRef = useRef(true);

  /** Bumped by the debounced model-changed handler to re-run the rule against the new models. */
  const [modelTick, setModelTick] = useState(0);

  // Publish the Room tab's requirement so `ToolbarSettings` can render the checkbox forced-on
  // without knowing that a tab called "Room" exists.
  useEffect(() => {
    setIfcSpacesForced(isRoomTab);
  }, [isRoomTab, setIfcSpacesForced]);

  // Unmount only — deliberately not folded into the effect above, which would clear and re-set
  // the flag on every tab change and fire a spurious pair of transitions. The setter is read off
  // the store at cleanup time so this can keep empty deps.
  useEffect(
    () => () => {
      generationRef.current++;
      useUIStore.getState().setIfcSpacesForced(false);
    },
    [],
  );

  const apply = useCallback(
    async (visible: boolean) => {
      if (!components) return;

      const generation = ++generationRef.current;
      const isStale = () => generationRef.current !== generation;

      const fragments = components.get(OBC.FragmentsManager);
      const cache = cacheRef.current;

      // Drop models that have gone, so an unloaded-then-reloaded model is re-queried rather than
      // answered from a cache of ids that may no longer mean anything.
      for (const modelId of [...cache.keys()]) {
        if (!fragments.list.has(modelId)) cache.delete(modelId);
      }

      const map: OBC.ModelIdMap = {};
      for (const [modelId, model] of fragments.list) {
        let ids = cache.get(modelId);
        if (!ids) {
          try {
            const byCategory = await model.getItemsOfCategories([/^IFCSPACE$/]);
            ids = Object.values(byCategory).flat();
          } catch (err) {
            console.warn(
              `[ifc-space-visibility] failed to list spaces in model ${modelId}`,
              err,
            );
            continue;
          }
          if (isStale()) return;
          cache.set(modelId, ids);
        }
        if (ids.length > 0) map[modelId] = new Set(ids);
      }

      // A structural or MEP model legitimately has no spaces — nothing to do, and calling Hider
      // with an empty map would still pay for a full `fragments.core.update(true)`.
      if (Object.keys(map).length === 0) return;
      if (isStale()) return;

      // `Hider.set` runs `fragments.core.update(true)` itself; no manual update here.
      try {
        await components.get(OBC.Hider).set(visible, map);
      } catch (err) {
        console.warn("[ifc-space-visibility] failed to apply space visibility", err);
      }
    },
    [components],
  );

  // The rule itself. Re-runs on a model load, on a Show All (`visibilityEpoch`), and whenever the
  // effective value flips.
  useEffect(() => {
    if (!components) return;

    const previous = previousEffectiveRef.current;
    previousEffectiveRef.current = effective;

    // Hide-only: when spaces should be visible, the only thing that ever acts is the one-shot
    // transition that reveals them. Re-asserting "visible" on a later tick would undo an Isolate
    // or a Hide the user performed in between.
    if (effective && previous) return;

    void apply(effective);
  }, [components, effective, visibilityEpoch, modelTick, apply]);

  // Re-run the rule after models finish loading or unloading: a freshly loaded model arrives with
  // its spaces visible, which would otherwise leave the checkbox describing something untrue.
  useEffect(() => {
    if (!components) return;

    const fragments = components.get(OBC.FragmentsManager);
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const onModelsChanged = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        setModelTick((tick) => tick + 1);
      }, REGEN_DEBOUNCE_MS);
    };

    fragments.list.onItemSet.add(onModelsChanged);
    fragments.list.onItemDeleted.add(onModelsChanged);

    return () => {
      if (timeout) clearTimeout(timeout);
      fragments.list.onItemSet.remove(onModelsChanged);
      fragments.list.onItemDeleted.remove(onModelsChanged);
    };
  }, [components]);
}
