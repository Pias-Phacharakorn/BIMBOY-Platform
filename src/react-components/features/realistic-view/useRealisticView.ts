import { useCallback, useEffect, useMemo, useState } from "react";
import { RealisticView, REALISTIC_DEFAULTS, type RealisticSettings } from "@/bim-components/RealisticView";
import { useBimStore } from "@/react-components/store/bimStore";

/**
 * Activates the daylight rig for as long as the Realistic tab is mounted, and mirrors its settings
 * into React state for the panel.
 *
 * The lifecycle is the point: `RealisticView` snapshots the renderer, scene lights and
 * postproduction style on activate and restores them on deactivate, so *mounting* this hook is
 * what turns the viewport into a render and unmounting is what gives the working viewer back.
 * `useRooms` drives `RoomView` the same way.
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
    // fast unmount can land before it resolves. Deactivating unconditionally on cleanup is safe —
    // it no-ops when there is no baseline — but the pending activate would then install a rig
    // nobody owns, so the guard flag is what actually prevents the leak.
    let mounted = true;
    void realistic.activate(world).then(() => {
      if (!mounted) realistic.deactivate();
      else setSettings(realistic.settings);
    });

    return () => {
      mounted = false;
      realistic.deactivate();
    };
  }, [realistic, world]);

  const update = useCallback(
    (next: Partial<RealisticSettings>) => {
      if (!realistic) return;
      realistic.update(next);
      setSettings(realistic.settings);
    },
    [realistic],
  );

  const reset = useCallback(() => update({ ...REALISTIC_DEFAULTS }), [update]);

  return { settings, update, reset, ready: !!realistic && !!world };
}
