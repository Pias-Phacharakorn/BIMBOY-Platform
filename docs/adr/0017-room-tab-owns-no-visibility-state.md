# ADR-0017: The Room tab owns no visibility state

**Status:** Accepted
**Date:** 2026-08-14
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Room browser

## Context

Room volumes sit inside walls. For the Room tab to show anything, the building has to get out of
the way — so "what does the Room tab do to visibility?" looked like a question the feature had to
answer. It was answered twice, wrongly, before the answer turned out to be "nothing".

The trap is that this app already has a ghost, and it is not a polite one. `ToolbarGhost` mutates
`fragments.core.models.materials.list` **in place** — one pool shared by the whole viewer — and
keeps its restore snapshot in a component-local ref. Anything else that ghosts is a second owner
of one global, and correctness then depends on two independent save/restore cycles interleaving
in the right order across tab switches, mid-load model changes and disposal.

## Decision

The Room tab does not touch visibility. No hiding, no ghosting, no isolation. The user reaches
for the Ghost button in `ViewportToolbar` — which is present on the Room tab and now needs no
special-casing — and the panel carries a single line of copy pointing at it.

## Alternatives rejected

- **Isolate spaces with `OBC.Hider`** (`hider.set(false)` then re-show the spaces) — the first
  choice, taken specifically to avoid mutating shared materials. Reversed on a reference image:
  hiding the building leaves rooms floating in a void with no context, and the reference plainly
  showed translucent walls *behind* solid rooms.
- **`RoomView` owns a ghost of its own** — built, shipped to testing, and it worked. It needed a
  `bimStore.roomViewActive` flag to disable `ToolbarGhost` for the tab's lifetime, enforcing
  exactly one owner at a time. The whole apparatus existed only to referee a conflict the feature
  itself had introduced. Removing the ghost removed the flag, the button gating, `GhostManager`,
  and every ordering hazard with them.
- **A ref-counted shared ghost service both owners acquire** — the cleaner end state while there
  were two owners, and moot with one. It also meant editing shipped, working code
  (`ToolbarGhost`) as a side effect of an unrelated feature.

## Consequences

- **The tab looks empty on first open** until the user presses Ghost — rooms are selected and
  outlined, but occluded. This is the real cost and it is accepted.
- **What makes that survivable: the name chips cannot be occluded.** They are `CSS2DObject`s (see
  `RoomLabels`, and the same property documented for `PivotMarker` and the measure pills), so they
  draw *through* geometry. Room *names* still float over a fully solid building — you lose the
  volumes, not the rooms. **Do not re-add an automatic ghost without a reason that survives this
  paragraph.**
- Ghost state is now the user's across the whole app. Leaving the Room tab does not restore
  anything, because the tab never changed anything.
- `MAX_LABELS` (20) caps pinned **and** selected chips together — a ctrl-selection of a whole
  floor would otherwise put hundreds of un-occludable chips on screen. Pins take slots first;
  rooms that lose one stay selected and stay outlined, losing only the chip. The panel says
  `Showing N of M labels` rather than truncating silently.
