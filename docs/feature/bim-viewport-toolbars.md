# Viewport toolbars — the floating React rails over the 3D canvas

> Status: seed — expand as you work this area.
> Covers the two rails and every `Toolbar*.tsx` button: layout, menu conventions, and what each button does to the engine. **Not** the engines themselves — `ClipperCursor`, `MeasureCursor`, `SpotCoordinate`, `OBC.Views` and the world bootstrap live in [`bim-viewer.md`](bim-viewer.md). Each button below links to its engine section there.

## Overview

Two independent rails float over `ViewportWrapper`. Both are plain React — no `<bim-*>`, per the shadow-DOM containment rule in `CLAUDE.md`. Neither rail owns engine state: every button reaches the engine through `components.get(...)` from `bimStore`, and holds only the UI state needed to render itself.

- **`ViewportToolbar.tsx`** — bottom-centre (`absolute bottom-3 left-1/2 -translate-x-1/2`): Load Model │ Focus, Visibility, Ghost, Align │ Settings. Two `w-[1px]` divider spans group them. Its menus open **upward** (`absolute bottom-full mb-2`).
- **`ViewportRightToolbar.tsx`** — top-right column (`absolute right-3 top-3`): Measure, Clip, Sectionbox, Coordinate. Its menus open **leftward** (`absolute right-full mr-2.5`).

**That direction split is load-bearing, not cosmetic:** anything that points at where a menu will appear — a caret, an arrow, an animation origin — cannot be shared across both rails without a second variant. The slide-in animations already diverge for this reason (`slide-in-from-bottom-1` vs `slide-in-from-right-1`).

## The shared dropdown idiom

**Hand-rolled and repeated, deliberately.** Every menu button owns the same four pieces: a local `useState` open flag, a `dropdownRef`, a `mousedown` document listener that closes on outside click, and an absolutely-positioned card. There is no shared `<ToolbarDropdown>` — the menus diverge too much for the abstraction to pay:

| Menu | Shape |
|------|-------|
| `ToolbarVisibility` | icon-only action list with hover pills |
| `ToolbarAlign` / `ToolbarLoadModel` | labelled action list, some rows nested |
| `ToolbarSettings` | a **form** (checkboxes, number input, select, colour input) |
| `ToolbarMeasure` / `ToolbarClip` / `ToolbarSectionBox` / `ToolbarCoordinate` | action list **plus** a live result/registry pane |

Worth revisiting only if a new menu can adopt an existing shape wholesale.

- **`ToolbarMeasure` deliberately *ignores* outside-clicks that land on the 3D canvas** while a measurement is in progress — otherwise placing the second point of a length would close the menu you are reading the result from. It is the one documented exception to the shared idiom.
- **Rejected — a `^` caret marking which buttons open a menu.** Built, revised once, then reverted; don't re-propose without new information. As an `absolute top-0` 10px overlay it was invisible in the running app: a 20px glyph in a 32px button occupies y=6..26, so the caret drew its strokes onto the glyph's top edge and merged with it. Reserving real space (13px caret + 20px glyph does not fit a 32px button) meant `flex-col` buttons with a caret row, an `invisible` spacer on the non-menu buttons to hold one shared baseline, and ~9px more rail height — a layout change to *every* button on the rail, two of which open no menu, to deliver a hint. Judged not worth the vertical space or the coupling.

## Bottom rail — per button

### Load Model (`ToolbarLoadModel.tsx`)

Two unrelated paths behind one menu, and they do **not** share a loader.

- **Cloud** flips `uiStore.isCloudModalOpen` and renders `CloudModelModal`, which funnels through `useLoadCloudModelBatch` — progress modal, per-file states, cancel. → [`bim-viewer.md`](bim-viewer.md) § Patterns & conventions for that machinery.
- **Local IFC / FRAG** builds a synthetic `<input type="file" multiple>`, then loops the files **sequentially** with a per-file `try/catch`, calling `ifcLoader.load(bytes, true, name)` or `fragments.core.load(bytes, { modelId })`. It sets `(model as any).name = file.name` so the models list has something to show.
- ⚠️ **The local path bypasses the batch loader entirely** — no `bimStore.loadingFiles`, no progress surface, no cancel, no `MAX_PARALLEL` waves. A big local IFC looks like a frozen app. Anything that adds progress reporting has to add it here separately.
- The **Local Model** row is a non-interactive label (`pointer-events-none opacity-60`) with its two children always expanded — not a collapsible submenu.

### Focus (`ToolbarFocus.tsx`)

- The rail's only bare button with no menu. Spins its icon while the camera flies.
- **Empty selection means "fit everything":** `fitToItems(ModelIdMapUtils.isEmpty(selection) ? undefined : selection)`. There is no disabled state — the button is always useful.
- **It reads the live `highlighter.selection.select`, not `bimStore.selectedElementIds`.** The store's map is a clone one event behind, so acting on it would fit the *previous* selection. `ToolbarVisibility` splits the same way — see below.
- Guards `world.camera instanceof OBC.SimpleCamera` before touching `fitToItems`, because a 2D view swaps in a different camera.

### Visibility (`ToolbarVisibility.tsx`)

The rail's one grouped entry: an icon-only menu over `OBC.Hider` holding **Show All / Isolate / Hide**. It replaced the former standalone `ToolbarShowAll.tsx`.

- **The store gates the UI; the engine serves the action.** `bimStore.selectedElementIds` (synced from `OBF.Highlighter` by `ViewportWrapper`) drives the disabled state, but the handlers act on the live `highlighter.selection.select` — the store's `selectionMap` is a clone one event behind.
- **Hide clears the selection afterwards; Isolate does not.** After Hide the selection points at geometry the user can no longer see; after Isolate the items are still on screen and stay chainable into Focus.
- **No "something is hidden" indicator.** `OBC.Hider` exposes no such getter, and a locally-maintained flag desyncs the moment anything else hides geometry or a model unloads while hidden.
- **Rows are icon-only; the label lives in a hover pill**, which also carries the reason a row is disabled ("Isolate — select items first") rather than stacking a second native `title`. ⚠️ `group` sits on a **wrapper `div`, not the button**: a native `<button disabled>` doesn't reliably match `:hover` across engines, so putting `group` on the button would hide the pill on exactly the rows that need explaining.
- The clicked row spins and the whole menu locks until the `Hider` promise resolves, then the menu closes.

### Ghost (`ToolbarGhost.tsx`)

Toggles the whole model to 5% white so overlays and interior geometry read through it.

- Walks `fragments.core.models.materials.list` and handles **two material shapes**: plain materials get `opacity`/`color`, the LOD shader material gets `uniforms.lodOpacity`/`uniforms.lodColor`. Both branches need `needsUpdate = true`.
- **Skips any material carrying `userData.customId`**, which is how our own overlay materials (cursors, outlines, gizmos) escape being ghosted.
- ⚠️ **The snapshot is taken at toggle time, into a `useRef`.** Consequences, both current behaviour: a model loaded *while* ghost is on stays fully opaque, and toggling off restores only what was snapshotted. Same shape as the `onItemSet` gap that used to sit on the measure picking meshes — the fix would be a `fragments.list.onItemSet` subscription that ghosts late arrivals.
- ⚠️ **Activation is component-local `useState`** — not `bimStore`. Nothing else in the app can read whether ghost is on, and unmounting the rail mid-ghost drops the restore map. In practice `ViewportWrapper` disposes the world on unmount so the materials go too, but any future keep-alive of the rail would leak the ghosted state.

### Align (`ToolbarAlign.tsx`)

Sets which world direction the ViewCube calls "front".

- **Its own store pair, not `activeTool`:** `bimStore.aligningDirection` (armed direction, or `null`) and `bimStore.alignAngle` (the committed rotation). While armed the button is *replaced* by an inline "Align front" chip with a cancel ✕ — so the arming state is unmissable — and a dot badge marks a non-zero angle when idle.
- ⚠️ **Reset pokes the ViewCube with a synthetic event:** `camera.controls.dispatchEvent({ type: "update" })`. This is the same underlying problem `bim-viewer.md` § Gotchas records — the ViewCube and the projection dropdown don't follow camera changes on their own. The ViewCube now subscribes `world.onCameraChanged`, but a *rotation* reset isn't a camera swap, so the synthetic nudge is still what refreshes it.
- Because it doesn't use `activeTool`, arming Align does **not** suppress viewport FX and does **not** cancel an active right-rail tool.

### Settings (`ToolbarSettings.tsx`)

The one dropdown that is a form. Grid visible · Mini Map · Auto Rotate · Grid Level (m) · Camera Projection │ Hover Highlight · Hover Colour.

- **It re-reads the engine on every open** (the sync effect depends on `isSettingsOpen`), because every one of these values can be changed by something other than this menu.
- **It subscribes `world.onCameraChanged` to keep the projection select honest** — opening or closing a 2D view swaps `world.camera` to an orthographic camera and back, and the dropdown would otherwise lie. Changing projection here also calls `postproduction.updateCamera()`, per the resync gotcha in `bim-viewer.md`.
- **Mini Map is the only setting that lives in `uiStore`** (`showMinimap`) rather than being written straight to the engine — it gates the `MiniMapOverlay` component, not an OBC flag.
- **Auto Rotate is a hand-rolled `requestAnimationFrame` loop**, not a camera-controls feature: it targets the `BoundingBoxer` model centre, then calls `controls.rotate(0.005, 0, false)` per frame. It cancels itself on the first `controlstart` (any user input wins) and when the last model unloads, and is disabled outright with no model loaded. `hasModel` is tracked by subscribing `fragments.list.onItemSet`/`onItemDeleted`, with a `setTimeout` retry because those events aren't available until the manager initialises.
- ⚠️ **Hover Highlight writes `OBF.Hoverer.enabled` directly** — see § Cross-button hazards. This is the one setting the right rail will silently undo.

## Right rail — per button

**Three of the four are `activeTool`-driven, which is what makes *those three* mutually exclusive.** Sectionbox is not — see its entry below.

### Measure (`ToolbarMeasure.tsx`)

Tool list (Length, Area, Angle "Soon", Surface "Soon") plus a live measurement list per tool. Local `activeType` picks which cursor is enabled; a separate `useEffect` per cursor sets `cursor.enabled` and disables it on cleanup. → engine: `bim-viewer.md` § Measure tools.

### Clip (`ToolbarClip.tsx`)

Add plane · Clear all, plus a plane checklist (select, show/hide, delete per row). → engine: `bim-viewer.md` § Section tool.

- **Placement is one-shot.** `handleEnterPlacement` sets `activeTool = "clip"` and enters placement; when `ClipperCursor` reports it has stopped placing (plane placed, or Escape), the sync effect resets `activeTool` to `"select"`. The button label switches to "Placing (ESC to cancel)" meanwhile.
- **`activeTool` is also the interlock:** if any other tool becomes active while placement is armed, an effect calls `clipper.exitPlacementMode()`.
- ⚠️ **`components.get(ClipperCursor as any)` is deliberate** — `ClipperCursor`'s 3-arg constructor doesn't match what `Components.get()` expects. It is the last component in the repo still needing this cast; see `bim-viewer.md` § Section tool.

### Sectionbox (`ToolbarSectionBox.tsx`)

`Section box` on/off · `Fit to selection` · `Reset to model`, plus a live extents pane reading X/Y/Z min→max and size to 2 decimals. → engine: [`bim-viewer.md`](bim-viewer.md) § Section box.

- ⚠️ **The one right-rail button that does *not* use `activeTool`.** It sits on this rail because it is a sectioning tool, but a crop is view state, not a pointer mode — so it is exempt from the FX suppression below and is **not** mutually exclusive with Measure/Clip/Coordinate. A cut plane and a box can both be live, and you can measure inside a box. Wiring it to `activeTool` would have cost the selection outliner and the whole postproduction pass for as long as the box cropped.
- **Holds no authoritative state**: mirrors `SectionBox.state` through `onStateChanged`, as `ToolbarClip` mirrors `ClipperCursor`.
- **The store gates, the engine serves** — the same split as `ToolbarVisibility`: `bimStore.selectedElementIds` drives whether `Fit to selection` is enabled, but the handler acts on the live `highlighter.selection.select`, because `selectionMap` is a clone one event behind.
- **`Fit to selection` and `Reset to model` both switch the box on** if it was off. Clicking either means you want to see the result.
- Sits between Clip and Coordinate on the rail.

### Coordinate (`ToolbarCoordinate.tsx`)

Add coordinate · Clear all, plus a list of placed points showing X/Y/Z to 3 decimals with per-row delete. Subscribes `SpotCoordinate.onLabelsChanged` to stay in sync. Placement is **double-click** on the model, which the button label states.

- **Ownership swap, for the whole tool session:** `activeTool === "coordinate"` disables `OBF.Highlighter` and enables `SpotCoordinate`; anything else does the reverse. A second effect repeats the restore on unmount, so navigating away mid-tool can't leave selection dead.

### FX suppression (the rail itself)

**The right rail suppresses viewport FX while any tool is active.** On the first transition of `activeTool` to anything other than `select`, `ViewportRightToolbar` snapshots `OBF.Hoverer.enabled`, `OBF.Outliner.enabled` and `postproduction.enabled` into a ref, disables all three, and **restores that snapshot** — not defaults — on return to idle, and again on unmount if a tool is still active.

Rationale: `CursorSurface` is the on-model guide while a tool runs, so the element hover-highlight and the outliner pass are redundant, and they cost a raycast plus a fullscreen post pass every frame.

⚠️ **Anything that toggles those three must respect the snapshot or it will be silently reverted.** This rule binds engine code too, not just toolbars — `bim-viewer.md` § Gotchas carries a pointer back here for that reason.

## Cross-button hazards

Facts that only show up when two buttons interact. None of these are designs; they are things to know before touching the rail.

- ⚠️ **Settings vs the right rail, over `Hoverer.enabled`.** Settings' *Hover Highlight* checkbox writes `hoverer.enabled` directly and does not respect the FX snapshot. Repro: activate any right-rail tool → open Settings → untick Hover Highlight → return to `select`. The rail restores its snapshot (`true`) and hover highlight comes back on; Settings re-syncs from the engine on next open and shows itself ticked again. **A bug, not a convention** — the fix is for Settings to write through the same baseline the rail holds, or for the rail to re-snapshot on external change.
- ⚠️ **Two buttons force `Highlighter.enabled = true` rather than restoring a snapshot.** `ToolbarClip` (on exiting placement) and `ToolbarCoordinate` (on leaving the tool and on unmount) both assert `true` unconditionally. That is currently correct only because nothing else disables the Highlighter for long. It is the same hazard the rail solved with a snapshot ref, solved less carefully — worth converging if a third consumer appears.
- **Four unrelated activation patterns sit across the two rails:**

  | Pattern | Buttons | Gives mutual exclusion? |
  |---------|---------|------------------------|
  | `bimStore.activeTool` | Measure, Clip, Coordinate | **yes** — and drives FX suppression |
  | dedicated store fields | Align (`aligningDirection` / `alignAngle`) | no |
  | component-local `useState` | Ghost | no — invisible outside the component |
  | engine-held state, mirrored by event | Sectionbox (`SectionBox.state` → `onStateChanged`) | no — deliberately |

  So arming Align while Length is active leaves both live, and Ghost is invisible to everything. Consolidating on `activeTool` would fix those two, but Ghost and Align aren't modal in the same sense (they don't own the pointer), which is why it hasn't been forced.

  ⚠️ **Sectionbox's pattern is the one to copy, and its exclusion from `activeTool` is a decision, not an oversight.** The engine owns the truth and the button mirrors it — the same shape as `ToolbarClip`/`ClipperCursor`, but without `activeTool`, because a crop must survive while you select and measure. Anything future that is *state* rather than a *pointer mode* belongs here rather than in `activeTool`. → [ADR-0005](../adr/0005-section-box-outside-clipper.md).

## Gotchas / watch-outs

- **Every button bails on a missing `components`/`world`** (`if (!components) return null`), because the rails render before the engine finishes bootstrapping. New buttons must do the same or they crash on first paint.
- **Button styling is copy-pasted, not shared.** The same ~200-character `buttonClass` string is repeated in nearly every `Toolbar*.tsx`, with per-button active-state variants. There is no `toolbarButton` helper. A design-token change means touching each file — accepted for now for the same reason the dropdown isn't abstracted.
- ⚠️ **`ToolbarSettings` reaches the camera through `world.camera as any`** in six places (`projection`, `controls`, `updateAspect`). It is the most `any`-heavy file on the rail and the most likely to break silently on a ThatOpen bump — check it first after any v3.4.x change.
- _(fill as encountered)_
