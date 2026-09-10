# ADR-0034: IFCSpace visibility is a hide-only rule over a derived value

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/bim-viewport-toolbars.md`](../feature/bim-viewport-toolbars.md) § Settings → IFCSpace

## Context

`IFCSPACE` geometry loads like any other product in this stack — web-ifc 0.0.77 dropped the
`OPTIONAL_CATEGORIES` setting that used to exclude it, and `forceTransparentSpaces` is why nobody
noticed. Translucent room volumes over the whole model are wrong for every tab except the Room
browser, which exists to list them.

So: a checkbox in Viewport Settings, unticked by default, **except** on the Room tab where spaces
must be visible.

The trap is that the viewport already has an owner of visibility — `OBC.Hider`, driven by the
Visibility toolbar's Isolate / Hide / Show All — and any second writer has to coexist with it rather
than referee it.

## Decision

`uiStore` holds two booleans and nothing else:

| Field | Meaning |
|---|---|
| `showIfcSpaces` | the **user's preference**. Default `false`. Only the checkbox writes it |
| `ifcSpacesForced` | "some open tab requires spaces visible". Written by the hook from its argument |

The effective value is **derived at every read**, never stored: `showIfcSpaces || ifcSpacesForced`.
Leaving the Room tab therefore needs no restore step — nothing was saved, so nothing has to be put
back; the derivation simply re-evaluates. On the Room tab the checkbox renders **checked and
disabled**; the preference underneath is untouched, so leaving returns to whatever the user had.

**The standing rule only ever hides. It never shows.** That asymmetry is the load-bearing part:

- **Standing rule** — on mount, on model load, and on a `visibilityEpoch` bump: if spaces should be
  hidden, hide them. If they should be visible, **do nothing at all**.
- **Transitions** — applied once, in both directions, when the effective value actually flips.

`ToolbarVisibility.handleShowAll` calls the hook's re-assert after `hider.set(true)`, so with the box
unticked Show All shows everything *except* spaces.

Logic lives in `features/ifc-space-visibility/useIfcSpaceVisibility.ts`, called once from
`ModelsView` as `useIfcSpaceVisibility(isRoomTab)`; the hook publishes `ifcSpacesForced` itself.
`ToolbarSettings` reads both flags and knows nothing about `Hider`.

## Alternatives rejected

- **A symmetric show/hide standing rule.** The obvious implementation, and it destroys `Isolate`: on
  the Room tab the user isolates one room, the rule fires on the next model load, and every space in
  the building comes back. Same for Hide. Hide-only can never undo an explicit visibility action.
- **Auto-toggle the preference on entering the Room tab.** Needs a saved "what it was before" value
  that must survive tab thrash, mid-load model changes and unmount — the exact hazard shape
  [ADR-0017](0017-room-tab-owns-no-visibility-state.md) and
  [ADR-0026](0026-async-activate-needs-an-ownership-token.md) were both written about. It also leaves
  the checkbox writable on the Room tab, so a user can hide the very rooms the panel is listing.
- **One-shot toggle, no re-assertion.** The checkbox becomes a button pretending to be a state, and
  "hidden by default" dies on the first model load or Show All.
- **Lift `activeTab` into `uiStore`.** Arguably what CLAUDE.md's state table wants, but a real
  refactor (`ModelsView`, `WorkspaceHeader`) for this feature, and it invites every future component
  to couple to literal tab names. `ifcSpacesForced` keeps the coupling semantic: a second tab needing
  spaces sets the same flag rather than growing an `||`.
- **An `OBC.Component` instead of a hook.** It owns a `Map` and a counter, both fine in refs, and an
  OBC component may not read React state — the store would have to be pushed in, giving a component
  *plus* a hook to drive it for no gain.
- **A model-wide filter reaching the Drawing Editor.** See Consequences.
- **Widen the category set to `IFCZONE` / `IFCSPATIALZONE`.** `IFCZONE` is an `IfcGroup` with no
  geometry to hide, and `IFCSPATIALZONE` is vanishingly rare here. Keeping it to `IFCSPACE` makes the
  hidden set exactly the set `RoomView.listRooms` enumerates.

## Consequences

- ⚠️ **Viewport-only — the Drawing Editor is deliberately not filtered.** `DrawingEditorSetup` builds
  projections from `model.getItemsIdsWithGeometry()`, which ignores visibility, so a plan drawn with
  spaces hidden still contains every space outline. Known gap, not a bug: the control lives in
  *Viewport* Settings and `Hider` **is** viewport visibility. Filtering the projection would put a
  `uiStore` read inside `bim-components/` (forbidden), and would silently answer a separate product
  question — architects often *want* room boundaries on a plan.
- **The preference resets to `false` on reload,** because `uiStore` has no `persist` middleware. That
  is the requirement, for free.
- **`SmartViews` also calls `hider.set(true)` in `reset()`/`apply()`** and does not go through the
  re-assert. It has no React consumer today — the Smart Views tab renders a bare viewport — so it is
  not a live conflict. It becomes one the day that tab is built.
- **A user who has forgotten the setting gets no clue but the checkbox** when Show All appears not to
  show everything. Accepted.
- `hider.set()` calls `fragments.core.update(true)` internally, so no manual update is needed.
