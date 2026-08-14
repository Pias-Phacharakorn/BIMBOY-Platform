import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_LABELS, RoomView, type Room } from "@/bim-components/RoomView";
import { useBimStore } from "@/react-components/store/bimStore";

/** Group heading for spaces that are not aggregated into any storey. Sorted last. */
export const UNASSIGNED_LEVEL = "Unassigned";

export interface RoomGroup {
  level: string;
  rooms: Room[];
}

/**
 * Drives the Room tab: owns the room query and the pinned-label set, mirrors the engine's
 * selection into React state, and activates/deactivates the `RoomView` engine component for
 * exactly as long as the panel is mounted.
 *
 * Mount/unmount is the activation signal, so `ModelsView` renders the Room panel conditionally
 * rather than hiding it with a class — a hidden-but-mounted panel would leave room chips floating
 * over every other tab.
 *
 * Selection is **not** owned here. `RoomView` drives the Highlighter's real select style, so
 * `ViewportWrapper` writes `bimStore` on its own and this hook only reflects what the engine
 * reports. That is what lets a pick in the viewport light up a row.
 */
export function useRooms(searchQuery: string) {
  const { components } = useBimStore();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [modelCount, setModelCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set());
  const [pinnedKeys, setPinnedKeys] = useState<ReadonlySet<string>>(new Set());
  const [pinLimitHit, setPinLimitHit] = useState(false);

  /** Set when a selection change came from a row click, so it does not scroll the list. */
  const fromPanelRef = useRef(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const roomView = useMemo(
    () => (components ? components.get(RoomView) : null),
    [components],
  );

  // Activate for the panel's lifetime.
  useEffect(() => {
    if (!roomView) return;
    roomView.activate();
    return () => roomView.deactivate();
  }, [roomView]);

  // Mirror the engine's selection, whoever caused it. A change that did not come from a row click
  // is one the user made in the viewport, so the panel scrolls to it — otherwise the highlighted
  // row lands off-screen in any building with more than a screenful of rooms.
  useEffect(() => {
    if (!roomView) return;

    const onSelectionChanged = () => {
      const keys = new Set(roomView.selectedKeys);
      setSelectedKeys(keys);
      const external = !fromPanelRef.current;
      fromPanelRef.current = false;
      setFocusKey(external && keys.size > 0 ? [...keys][keys.size - 1] : null);
    };

    roomView.onSelectionChanged.add(onSelectionChanged);
    return () => roomView.onSelectionChanged.remove(onSelectionChanged);
  }, [roomView]);

  const reload = useCallback(async () => {
    if (!roomView) return;
    setIsLoading(true);
    try {
      // listRooms re-derives the engine's selection against the new list and fires
      // onSelectionChanged, so selectedKeys updates itself — only the pins are dropped here.
      const found = await roomView.listRooms();
      setRooms(found);
      setModelCount(roomView.modelCount);
      setPinnedKeys(new Set());
      setPinLimitHit(false);
    } catch (err) {
      console.warn("Room view: failed to list rooms", err);
      setRooms([]);
    } finally {
      setIsLoading(false);
    }
  }, [roomView]);

  // First load, plus a re-query whenever models finish loading or unloading (RoomView debounces
  // the burst a batch load fires).
  useEffect(() => {
    if (!roomView) return;
    void reload();
    const onChanged = () => void reload();
    roomView.onRoomsChanged.add(onChanged);
    return () => roomView.onRoomsChanged.remove(onChanged);
  }, [roomView, reload]);

  /**
   * Plain click replaces the selection; ctrl/cmd-click toggles one room in or out of it.
   *
   * Clicking never moves the camera — the per-row zoom control does that, so building a
   * multi-room selection does not fling the view around on every click.
   */
  const select = useCallback(
    async (room: Room, additive: boolean) => {
      if (!roomView) return;
      // Flagged before the call so the resulting event knows not to scroll the list under the
      // cursor that just clicked it.
      fromPanelRef.current = true;
      await roomView.select(room, additive);
    },
    [roomView],
  );

  const zoomTo = useCallback(
    async (room: Room) => {
      if (!roomView) return;
      await roomView.zoomTo(room);
    },
    [roomView],
  );

  const togglePin = useCallback(
    async (room: Room) => {
      if (!roomView) return;
      const accepted = await roomView.togglePin(room);
      setPinLimitHit(!accepted);
      setPinnedKeys(new Set(roomView.pinnedKeys));
    },
    [roomView],
  );

  const groups = useMemo(() => groupByLevel(rooms, searchQuery), [rooms, searchQuery]);

  // Mirrors RoomView._syncLabels: pins take slots first, then selected rooms fill what is left.
  // Computed rather than read back from the engine so there is no second copy of the state to
  // keep in step.
  const labelsWanted =
    pinnedKeys.size +
    [...selectedKeys].filter((key) => !pinnedKeys.has(key)).length;

  return {
    groups,
    isLoading,
    modelCount,
    roomCount: rooms.length,
    selectedKeys,
    pinnedKeys,
    pinLimitHit,
    labelsWanted,
    labelsShown: Math.min(labelsWanted, MAX_LABELS),
    focusKey,
    select,
    zoomTo,
    togglePin,
    refresh: reload,
  };
}

function groupByLevel(rooms: Room[], searchQuery: string): RoomGroup[] {
  const query = searchQuery.trim().toLowerCase();
  const matches = query
    ? rooms.filter((room) =>
        `${room.name} ${room.longName}`.toLowerCase().includes(query),
      )
    : rooms;

  const byLevel = new Map<string, Room[]>();
  for (const room of matches) {
    const level = room.levelName || UNASSIGNED_LEVEL;
    const bucket = byLevel.get(level);
    if (bucket) bucket.push(room);
    else byLevel.set(level, [room]);
  }

  // Numeric collation so "Level 2" sorts before "Level 10". Elevation would be the truer order
  // but costs a second query per storey; name order is close enough for a browser list.
  const collate = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

  for (const bucket of byLevel.values()) {
    bucket.sort((a, b) => collate(a.name || a.longName, b.name || b.longName));
  }

  return [...byLevel.entries()]
    .map(([level, levelRooms]) => ({ level, rooms: levelRooms }))
    .sort((a, b) => {
      if (a.level === UNASSIGNED_LEVEL) return 1;
      if (b.level === UNASSIGNED_LEVEL) return -1;
      return collate(a.level, b.level);
    });
}
