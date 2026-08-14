# ADR-0016: A room is selected through the app's own select style, not a private one

**Status:** Accepted
**Date:** 2026-08-14
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Room browser

## Context

The Room tab needed a selected room to stand out in the viewport. The obvious move is a
dedicated `OBF.Highlighter` style — a name of your own, a colour of your own, no risk of
colliding with whatever else the app is doing with selection. That is what was built first:
a `"room-view"` style painting rooms solid amber.

Two pieces of this project's wiring make that worse than it looks, and neither is visible from
the Highlighter's API surface:

1. **`highlightByID(name, …)` triggers `events[name].*` — only that name.** Everything this app
   hangs off selection is subscribed to `config.selectName`: `OBF.Outliner` (the green outline,
   wired in `setup/src/highlighter.ts`) and `ViewportWrapper`'s `syncSelection`, the single
   writer of `bimStore.selectionMap`. A private style fires **none** of it.
2. **`setupHighlighter` runs with `selectMaterialDefinition: null`.** The app deliberately has no
   selection *colour*; `updateColors()` does `styles.get(selectName)` → `null` → `continue`, and
   the entire selected look is the Outliner. So a private style was not matching a house style —
   it was inventing the only coloured selection in the app.

The consequence was structural, not cosmetic. With the room highlight outside the select
channel, the panel had to write `bimStore` by hand to keep Item Properties alive, and the app
carried **two selections that could disagree**: clicking in the viewport fired `select.onClear`,
cleared the store, and left the room still painted amber.

## Decision

`RoomView` drives `highlighter.config.selectName`. Selecting a room from the panel is the same
operation as picking it in the viewport: same style, same events, same green outline, same single
store writer. The panel's manual `setSelectedElements`/`clearSelection` are deleted.

The subscription runs both ways. `RoomView` caches its last `listRooms()` result and intersects
the live selection against it, so a room picked in the 3D view lights up its row, expands its
storey group and scrolls the list to it.

## Alternatives rejected

- **A private `"room-view"` style painting rooms amber** — built and shipped to testing before
  being reversed. It looks distinct precisely *because* it is outside every mechanism the app
  already has, which is the same reason it desynchronises. See Context.
- **Keep the private style and also call `highlightByID("select", …)`** — would fire the right
  events, but two styles over one set of items, and every future reader has to work out which one
  owns the appearance.
- **Change the app's select colour while the Room tab is open** — a global mutation to make one
  tab look different, and the same class of problem ADR-0017 removes from the ghost.

## Consequences

- Rooms look like every other selection. If a distinct room appearance is ever wanted again, the
  cost of it is this whole ADR — do not reintroduce a private style without re-reading it.
- **The Room tab no longer clears the selection on the way out.** It is the app's selection now:
  leaving the tab keeps it, and Item Properties stays populated. That is deliberate.
- ⚠️ **The two select events disagree about their payload.** `onHighlight` triggers with the
  *resulting* selection; `onClear` triggers with the items that were **removed**. A handler that
  trusts its argument is correct half the time. Both `RoomView._onSelectionEvent` and
  `ViewportWrapper.syncSelection` ignore the payload and re-read
  `highlighter.selection[selectName]`. Any third subscriber must do the same.
- `IfcImporter.geometryProcessSettings.forceTransparentSpaces === true` stops mattering: it was
  only ever a problem for a style that had to set `transparent: false` to override it. It will
  matter again the moment anyone tries to colour spaces.
- The room list must be loaded for a viewport pick to resolve to a row — the intersection is
  against `_rooms`, which is only known good inside `listRooms()`. That is where the re-derive
  lives; moving it earlier (e.g. to the debounced model-changed handler) clears the selection on
  every model load, because the cache is empty at that point.
