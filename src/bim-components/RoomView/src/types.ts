/** One IFCSPACE, flattened to what the Room panel and the 3D labels need. */
export interface Room {
  /** Owning model in `FragmentsManager.list` — rooms from federated models coexist in one list. */
  modelId: string;
  localId: number;
  /** `IfcSpace.Name` — the room *number* in a Revit export. Empty when the exporter left it blank. */
  name: string;
  /** `IfcSpace.LongName` — the human room *name*. Empty in exporters that only fill `Name`. */
  longName: string;
  /**
   * Storey name, read through the space's `Decomposes` relation. Empty when the space is not
   * aggregated into a storey.
   *
   * ⚠️ `Decomposes`, **not** `ContainedInStructure`: a space is *aggregated into* a storey
   * (`IfcRelAggregates`), whereas a wall is *contained in* one. Copying the query from
   * `usePropertyPanel`'s Location group silently yields nothing here.
   */
  levelName: string;
}

/** Stable identity for a room across re-queries — keys the label pool and the pinned set. */
export const roomKey = (room: Room) => `${room.modelId}:${room.localId}`;

/** A room's display text, split so the number can be dimmed against the name. */
export interface RoomLabelParts {
  /** Room number. Empty when the exporter left `Name` blank. */
  number: string;
  name: string;
}

/**
 * The one fallback chain for a room's display text, shared by the panel row and the 3D chip so
 * the two can never disagree about what a room is called.
 *
 * `Name` is the room *number* and leads because it is short and unique; `LongName` stands in when
 * the exporter left `Name` empty, and the localId is the last resort so a room is never nameless.
 */
export const roomLabelParts = (room: Room): RoomLabelParts => {
  if (room.name) return { number: room.name, name: room.longName };
  if (room.longName) return { number: "", name: room.longName };
  return { number: "", name: `#${room.localId}` };
};
