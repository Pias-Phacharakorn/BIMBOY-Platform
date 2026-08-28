import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RealisticView,
  REALISTIC_DEFAULTS,
  type AoParameters,
  type DaylightSettings,
  type GlossParameters,
  type RealisticSettings,
} from "@/bim-components";
import { useBimStore } from "@/react-components/store/bimStore";

/**
 * Activates the daylight rig for as long as the Realistic tab is mounted, and mirrors its settings
 * into React state for the panel.
 *
 * The lifecycle is the point: `RealisticView` snapshots the renderer, scene lights, postproduction
 * style **and this tab's own gloss / AO** on activate and restores them on deactivate, so *mounting*
 * this hook is what turns the viewport into a render and unmounting is what gives the working viewer
 * back. `useRooms` drives `RoomView` the same way.
 *
 * There are three writers rather than one because `RealisticSettings` holds two nested blocks and a
 * shallow merge would wipe their siblings — see `RealisticView.update`'s note.
 */
export function useRealisticView() {
  const { components, world } = useBimStore();
  const [settings, setSettings] = useState<RealisticSettings>({ ...REALISTIC_DEFAULTS });

  const realistic = useMemo(
    () => (components ? components.get(RealisticView) : null),
    [components],
  );

  useEffect(() => {
    if (!realistic || !world) return;

    // `activate` is async (it fits the sun to the model bounds off the fragments worker), so a
    // fast unmount can land before it resolves — which is every mount under StrictMode, not a rare
    // race. What makes that safe is `RealisticView`'s own generation token: a `deactivate` cancels
    // any activate still in flight, so the late one never installs a rig. This flag only avoids
    // pushing settings into a component that has already been unmounted.
    let mounted = true;
    void realistic.activate(world).then(() => {
      // Never deactivate from here. Under StrictMode this callback belongs to a *cancelled*
      // activate while a live one is already in flight, and deactivating would cancel that one
      // too — leaving the tab with no rig at all. Cleanup below is the only thing that tears down.
      if (mounted) setSettings(realistic.settings);
    });

    return () => {
      mounted = false;
      realistic.deactivate();
    };
  }, [realistic, world]);

  /** Every writer is engine-first, then mirror — the panel never holds a value the rig rejected. */
  const run = useCallback(
    (action: (view: RealisticView) => void) => {
      if (!realistic) return;
      action(realistic);
      setSettings(realistic.settings);
    },
    [realistic],
  );

  const update = useCallback(
    (next: Partial<DaylightSettings>) => run((view) => view.update(next)),
    [run],
  );

  const updateAo = useCallback(
    (next: Partial<AoParameters & { blend: number }>) => run((view) => view.updateAo(next)),
    [run],
  );

  const updateGloss = useCallback(
    (next: Partial<GlossParameters & { enabled: boolean }>) =>
      run((view) => view.updateGloss(next)),
    [run],
  );

  const resetDaylight = useCallback(() => run((view) => view.resetDaylight()), [run]);
  const resetRender = useCallback(() => run((view) => view.resetRender()), [run]);

  return {
    settings,
    update,
    updateAo,
    updateGloss,
    resetDaylight,
    resetRender,
    ready: !!realistic && !!world,
  };
}
