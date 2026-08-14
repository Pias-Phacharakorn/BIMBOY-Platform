import { useEffect, useRef, useState, type MouseEvent } from "react";
import { MAX_LABELS, roomKey, roomLabelParts, type Room } from "@/bim-components/RoomView";
import { Icon } from "@/react-components/components/ui";
import { cn } from "@/lib/utils";
import { useRooms } from "./useRooms";

interface RoomPanelProps {
  searchQuery: string;
}

/**
 * The Room tab's left panel: every IFCSPACE in the loaded models, grouped by storey.
 *
 * Clicking a row selects the room exactly as picking it in the viewport would — green outline,
 * a floating name chip, and Item Properties on the right. Ctrl/cmd-click adds or removes a room
 * from the selection. The two trailing controls pin that room's chip and frame it.
 *
 * The sync runs both ways: picking a room in the 3D view highlights its row here, expanding its
 * storey group and scrolling to it.
 */
export function RoomPanel({ searchQuery }: RoomPanelProps) {
  const {
    groups,
    isLoading,
    modelCount,
    roomCount,
    selectedKeys,
    pinnedKeys,
    pinLimitHit,
    labelsWanted,
    labelsShown,
    focusKey,
    select,
    zoomTo,
    togglePin,
    refresh,
  } = useRooms(searchQuery);

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggleLevel = (level: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(level)) next.add(level);
      return next;
    });
  };

  // A room picked in the viewport is useless if its storey is collapsed — expand it first so the
  // row exists to be scrolled to. Scrolling itself is the row's job, once it has rendered.
  const focusLevel = focusKey
    ? groups.find((group) => group.rooms.some((room) => roomKey(room) === focusKey))?.level
    : undefined;

  useEffect(() => {
    if (!focusLevel) return;
    setCollapsed((current) => {
      if (!current.has(focusLevel)) return current;
      const next = new Set(current);
      next.delete(focusLevel);
      return next;
    });
  }, [focusLevel]);

  if (isLoading && roomCount === 0) {
    return <p className="text-xs text-muted px-1 py-2">Reading spaces…</p>;
  }

  // The two empty cases are worth telling apart: one is "you have not loaded anything yet", the
  // other is "this model has no rooms in it", which reads as a bug unless it is spelled out.
  if (roomCount === 0) {
    return (
      <p className="text-xs text-muted px-1 py-2 leading-relaxed">
        {modelCount === 0
          ? "Load a model to see its rooms."
          : "No IFCSPACE found in the loaded models. Rooms are only exported by architectural models."}
      </p>
    );
  }

  const visibleCount = groups.reduce((total, group) => total + group.rooms.length, 0);

  return (
    <div className="flex flex-col gap-1 h-full overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <span className="text-[10px] text-muted">
          {visibleCount === roomCount
            ? `${roomCount} rooms`
            : `${visibleCount} of ${roomCount} rooms`}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          title="Re-read spaces from the loaded models"
          className="inline-flex items-center justify-center p-1 rounded-radius border border-border bg-surface text-muted hover:bg-surface-alt hover:text-fg transition-colors duration-120 cursor-pointer"
        >
          <Icon name="REFRESH" size={13} />
        </button>
      </div>

      {/* Room volumes sit inside solid walls, so without Ghost a selected room is painted but
          invisible. The chips still show through geometry, so the tab is usable either way —
          this points at the toolbar rather than reaching for it on the user's behalf. */}
      <p className="text-[10px] text-muted-2 px-1 pb-1 leading-relaxed">
        Use Ghost in the toolbar to see room volumes through the model.
      </p>

      {pinLimitHit && (
        <p className="text-[10px] text-muted px-1 pb-1">
          All {MAX_LABELS} label slots are pinned — unpin one to add another.
        </p>
      )}

      {/* Rooms past the cap stay selected and stay amber; only their chip is dropped. Saying so
          keeps that from reading as a broken selection. */}
      {labelsWanted > labelsShown && (
        <p className="text-[10px] text-muted px-1 pb-1">
          Showing {labelsShown} of {labelsWanted} labels.
        </p>
      )}

      {visibleCount === 0 && (
        <p className="text-xs text-muted px-1 py-2">No room matches that search.</p>
      )}

      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.level);
        return (
          <div key={group.level} className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => toggleLevel(group.level)}
              className="w-full flex items-center gap-1 px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-fg transition-colors duration-120 cursor-pointer"
            >
              <Icon
                name={isCollapsed ? "CHEVRON_RIGHT" : "CHEVRON_DOWN"}
                size={12}
              />
              <span className="truncate">{group.level}</span>
              <span className="ml-auto font-normal">({group.rooms.length})</span>
            </button>

            {!isCollapsed &&
              group.rooms.map((room) => (
                <RoomRow
                  key={roomKey(room)}
                  room={room}
                  isSelected={selectedKeys.has(roomKey(room))}
                  isPinned={pinnedKeys.has(roomKey(room))}
                  shouldScrollIntoView={roomKey(room) === focusKey}
                  onSelect={(additive) => void select(room, additive)}
                  onTogglePin={() => void togglePin(room)}
                  onZoom={() => void zoomTo(room)}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

interface RoomRowProps {
  room: Room;
  isSelected: boolean;
  isPinned: boolean;
  shouldScrollIntoView: boolean;
  onSelect: (additive: boolean) => void;
  onTogglePin: () => void;
  onZoom: () => void;
}

/**
 * Sibling buttons rather than buttons inside a button — nesting them is invalid HTML and the
 * inner clicks would not reliably reach their own handlers.
 */
function RoomRow({
  room,
  isSelected,
  isPinned,
  shouldScrollIntoView,
  onSelect,
  onTogglePin,
  onZoom,
}: RoomRowProps) {
  // Same fallback chain the 3D chip uses, from one shared helper, so a room can never be called
  // one thing in the list and another on the model.
  const label = roomLabelParts(room);
  const rowRef = useRef<HTMLDivElement>(null);

  // "nearest" rather than "center": it does nothing when the row is already visible, so a pick on
  // a room you can already see does not jump the list.
  useEffect(() => {
    if (!shouldScrollIntoView) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [shouldScrollIntoView]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "w-full flex items-center rounded-radius border transition-colors duration-120",
        isSelected
          ? "bg-accent/15 border-accent/40"
          : "bg-transparent border-transparent hover:bg-surface-alt",
      )}
    >
      <button
        type="button"
        // metaKey as well as ctrlKey: cmd is the additive modifier on macOS.
        onClick={(event: MouseEvent<HTMLButtonElement>) =>
          onSelect(event.ctrlKey || event.metaKey)
        }
        title={[label.number, label.name].filter(Boolean).join(" — ")}
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-xs text-left cursor-pointer",
          isSelected ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        <Icon name="ROOM" size={14} className={isSelected ? "text-accent-2" : ""} />
        {label.number && <span className="shrink-0 text-muted-2">{label.number}</span>}
        <span className="truncate">{label.name}</span>
      </button>

      <button
        type="button"
        onClick={onTogglePin}
        title={isPinned ? "Hide this room's 3D label" : "Pin this room's 3D label"}
        className={cn(
          "shrink-0 inline-flex items-center justify-center p-1.5 cursor-pointer transition-colors duration-120",
          isPinned ? "text-accent-2" : "text-muted-2 hover:text-fg",
        )}
      >
        <Icon name={isPinned ? "LABEL" : "LABEL_OFF"} size={14} />
      </button>

      {/* Frames this room only, and deliberately leaves the selection alone — that is what lets
          you walk a multi-room selection one room at a time. */}
      <button
        type="button"
        onClick={onZoom}
        title="Zoom to this room"
        className="shrink-0 inline-flex items-center justify-center p-1.5 pr-2 text-muted-2 hover:text-fg cursor-pointer transition-colors duration-120"
      >
        <Icon name="FOCUS" size={14} />
      </button>
    </div>
  );
}
