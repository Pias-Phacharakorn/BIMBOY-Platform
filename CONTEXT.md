# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

## Viewport toolbar — Visibility dropdown group

_Status: behaviour implemented; UI affordance pass decided, not yet implemented.
Promote both to `docs/feature/bim-viewer.md` once shipped._

The bottom `ViewportToolbar` gains its first **grouped** entry: the standalone
Show All icon-button becomes a **Visibility group** — a dropdown opening upward
holding **Show All / Isolate / Hide**. Handlers are ported from the reference
`EX_viewport-toolbar.ts` (BUI/lit) into this project's plain-React toolbar idiom.

**Terminology.** "Visibility group" = the trigger button plus its menu. Its three
entries are "rows", not buttons — they are labelled menu items, not the 20px
icon-buttons that sit directly on the toolbar rail.

Decisions:

- **Scope is one group.** Focus, Ghost, Align, Settings keep their current
  top-level icon-buttons. Ghost is *not* absorbed into Visibility even though it
  is arguably a visibility concern — this pass establishes the convention on one
  button so later groups are cheap; it does not re-lay-out the rail.
- **No new dropdown machinery.** `ToolbarAlign.tsx` already owns this exact
  pattern (local `useState` open + `dropdownRef` + `mousedown` click-outside +
  `absolute bottom-full mb-2` upward card). Visibility follows it rather than
  introducing a shared `<ToolbarDropdown>` abstraction — three call sites is too
  early to factor one out.
- **One file; `ToolbarShowAll.tsx` is deleted.** New `ToolbarVisibility.tsx`
  owns the trigger and all three rows inline. Follows the `ToolbarAlign`
  precedent, not the `ToolbarMeasure` one-file-per-row precedent — Measure's
  rows carry cursor wiring and result lists, ours are three-line handlers.
- **Selection gating is free.** `bimStore.selectedElementIds` is already kept in
  sync with `OBF.Highlighter` by `ViewportWrapper.tsx`, so Isolate/Hide disable
  reactively with no new event subscription. Show All is always enabled.
- **Store drives UI state; the engine drives actions.** The disabled state reads
  `bimStore`, but the handlers read the live `highlighter.selection.select` —
  the store's `selectionMap` is a clone one event behind. Precedent:
  `ToolbarFocus.tsx`.
- **No hidden-state tracking.** `OBC.Hider` exposes no "is anything hidden"
  getter, so a badge would mean maintaining a local flag that desyncs whenever
  anything else hides geometry or a model unloads while hidden. Rejected in
  favour of no indicator at all; deriving it from the engine per-open was
  rejected as disproportionate.
- **Hide clears the selection, Isolate does not** (matches the reference).
  Principled, not accidental: after Hide the selection points at invisible
  geometry; after Isolate the items are still on screen and stay chainable
  into Focus.
- **Async feedback:** the clicked row spins and all rows disable until the
  `Hider` call resolves, then the dropdown closes. One `busy` state, mirroring
  the reference's `target.loading` and `ToolbarFocus`'s spinner.

### UI affordance pass — icon-only Visibility menu

- **Only the Visibility menu goes icon-only.** Its three rows lose their text
  and the "Visibility" header; hovering an icon floats a labelled pill to its
  right (vertical stack above the trigger, per the reference). Align and Load
  Model stay labelled lists; Settings *can't* go icon-only — its menu is a form
  (checkboxes, number input, projection select), not an action list.
- **The hover pill carries the disabled reason**, not a second native `title`:
  "Isolate" when actionable, "Isolate — select items first" when not. Stacking a
  custom pill and an OS tooltip on one element makes both look broken.
- **Gotcha — the pill hangs off a wrapper, not the button.** A native
  `<button disabled>` doesn't reliably match `:hover` across engines, so
  `group` sits on a wrapping `div`. Put it on the button and the disabled rows —
  the ones that most need explaining — would show no pill at all.

### Rejected — a `^` caret marking which buttons open a menu

Built, revised once, then reverted. Don't re-propose without new information.

The idea was to mark each dropdown trigger so menu buttons read differently from
plain actions. As an `absolute top-0` 10px overlay it was invisible in the
running app: a 20px glyph in a 32px button occupies y=6..26, so the caret drew
its strokes onto the glyph's top edge and merged with it.

The fix worked but cost too much. 13px caret + 20px glyph doesn't fit a 32px
button, so reserving real space meant `flex-col` buttons with a caret row, an
`invisible` spacer on `ToolbarFocus` / `ToolbarGhost` / `ToolbarLoadModel` to
keep one shared baseline, and **~9px more rail height**. That is a layout change
to every button on the rail — including two that open no menu — to deliver a
hint. Judged not worth the vertical space or the coupling; the menus stay
discoverable by clicking, as they were before.

Reverted: `ToolbarCaret.tsx` deleted, `CHEVRON_UP` removed from `appIcons`, all
six rail buttons back to `items-center`. The icon-only Visibility menu above
survives — it was a separate decision and is unaffected.

Recently promoted (for reference — do not re-stage here):

- **AR live viewer — glass UI restyle + opacity slider** (shipped `9b255d6`) →
  how it works: `docs/feature/ar-webxr.md`; why, with rejected alternatives:
  `docs/adr/0001-ar-overlay-model-opacity.md`.
