# ADR-0037: IoT chips are CSS2D objects, capped by status, and take clicks

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/iot.md`](../feature/iot.md) § Viewport chips

## Context

Phase 2 made devices real, but everything the feature knew lived in two side panels. Answering
"which part of this floor is running hot" meant clicking each device in turn and holding the
previous readings in your head — the spatial question the model exists to answer was the one
question the tab could not.

The Room tab already floats room-name chips on geometry, so the mechanism existed. What had to be
decided was where the code lives, how many chips, what they say, and what happens when one sits on
top of an element the user is trying to pick.

**Verified against the running app before deciding, not assumed:**

- **The CSS2D layer is in the light DOM.** `<bim-viewport>` has a shadow root, but
  `RendererWith2D.setupHtmlRenderer` does `container.appendChild(...)`, so the layer is a light-DOM
  child (`inShadow: false`). Classes from `style.css` apply — probed with a magenta outline, read
  back `rgb(255,0,255)` — and `var(--color-surface)` resolves. That is what makes design tokens
  reachable from engine code here.
- **`OBC.Hider` raises no events**, and neither does the fragments layer. Visibility can only be
  asked for, never subscribed to.
- **`bumpVisibilityEpoch()` had exactly one caller**, `handleShowAll`. Isolate and Hide did not bump
  it, and `SmartViews` calls `Hider` directly without bumping either.
- `model.getVisible(localIds)` exists in the installed `@thatopen/fragments` typings.
- `RoomLabels`' hardcoded `#a21caf` is a constraint of *that* feature — it fights an amber room
  volume — not of the technique.

## Decision

| # | Decision |
|---|---|
| 1 | Engine work moves to **`bim-components/IotView/`**, on the `RoomView` pattern; `features/iot/` keeps only the React mirror |
| 2 | Show **every** bound device, capped at `MAX_CHIPS` (20) ordered **alarm → warn → ok → offline**, with the selected device always holding a slot, plus a layer switch |
| 3 | A chip is **metric icon + headline value**, from the same `headlineReading()` the list uses; it expands to a second value only when selected |
| 4 | **Chips take clicks** — clicking one selects that device |
| 5 | Chips go **inert automatically while `activeTool` is non-null**, and the switch from 2 is the manual escape |
| 6 | Chips **follow hide/Isolate** via `model.getVisible()` |
| 7 | **IOT tab only** — mount activates, unmount disposes |
| 8 | Styling is `.iot-chip*` classes in `style.css` under `@layer components`, tokens only |
| 9 | Hidden-ness is learned by **bumping `visibilityEpoch` in Isolate/Hide (immediate) *and* polling every tick (catch-all)** |

⚠️ **Decision 4 went against the recommendation, and that is recorded on purpose.** The advice was
`pointer-events: none`: chips cannot be occluded, so they float over the front of the building and
eat clicks aimed at geometry — which is this tab's own primary flow, binding an element. The
developer chose clickable chips, with decision 5 as the mitigation.

## Alternatives rejected

- **`OBF.Marker` instead of raw `CSS2DObject`.** Brings its own clustering and its own DOM, both of
  which would have to be fought to match `DESIGN.md`, and solves a problem we do not have yet.
- **Show only the selected device's chip.** Duplicates the right panel and adds nothing but position.
- **Show only abnormal devices.** A healthy building then looks like it has no sensors, and "no chip"
  becomes ambiguous with "not bound".
- **Cap in list order, as `RoomView` does.** Drops an alarming device's chip because it sorts late —
  hiding the one thing worth showing. Hence the status ordering.
- **Put the device name on the chip.** Labels here are like `"IFCUNITARYEQUIPMENT 133079"`, doubling
  the chip's width to repeat what the panel already says.
- **A held modifier (Alt) to click through.** This project already has shortcut collisions —
  `ClipperPlacementManager` owns Escape for its whole lifetime.
- **A click target smaller than the visible chip.** A UI that lies about where it can be clicked.
- **Dimmed chips for hidden elements** instead of removing them. A faint label floating in mid-air
  communicates nothing, and it fights decision 3's narrowness. **Always-visible chips** were rejected
  because they stop Isolate from doing its job.
- **Inline styles instead of classes.** Decision 4 requires `:hover`, a selected state and four
  tones; inline styles cannot express pseudo-classes, so hover would be hand-rolled in JS.
- **Mount the layer app-wide.** `ModelsView` carries an explicit warning that a hidden-but-mounted
  panel leaves CSS2D chips stranded across every tab — a bug this project has already hit with
  exactly this kind of label.
- **Polling alone** for visibility: chips linger ~5 s after Isolate, the gesture people use most, and
  it reads as broken. **Epoch bumps alone:** miss `SmartViews`, which calls `Hider` directly.

## Consequences

- **Tailwind is not available in `bim-components/`** (CLAUDE.md layer rule), which is why decision 8
  routes through `style.css` — and why the light-DOM probe above was load-bearing rather than
  incidental.
- **Readings are not visible from other tabs.** The price of decision 7.
- ⚠️ **A chip can still cover an element you want to bind**, and the only remedy is switching the
  layer off. Accepted when decision 4 was taken.
- ⚠️ **Chips are placed at the bounding-box centre (`getBoxes`), with no clustering.** Six diffusers
  on one ceiling will overlap; the cap only helps in part.
- ⚠️ **Isolate and Hide now bump `visibilityEpoch`, which `useIfcSpaceVisibility` also listens to.**
  Safe because that rule is hide-only ([ADR-0034](0034-ifcspace-visibility-is-a-hide-only-derived-rule.md))
  and therefore inert while spaces are meant to be visible — reasoned from the source and covered by
  an e2e test that proves the flow completes without engine errors, but **whether the room is still
  drawn is not cheaply observable from the DOM and still wants a human's eyes.**
- ⚠️ **A chip whose anchor leaves the camera frustum has no DOM node at all** — three's
  `CSS2DRenderer` appends an element only in the branch where the anchor is in frame, so a chip
  *created* while out of frame is never inserted, not merely hidden. It appears as soon as the
  camera brings the anchor back. This is why the layer-switch e2e assertions run before the first
  chip click: clicking flies the camera, and `fitToItems` on a ~500 m element parks it past the
  world camera's 1000 m far plane. See `bim-viewer.md` § Gotchas for the far-plane limit itself,
  which is not an IOT problem.
