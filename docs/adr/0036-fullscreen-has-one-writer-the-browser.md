# ADR-0036: Fullscreen has exactly one writer — the browser

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/bim-viewport-toolbars.md`](../feature/bim-viewport-toolbars.md) § Bottom rail → Fullscreen

## Context

A button in the viewport toolbar that takes the model viewport full-screen — hiding the app's own
chrome (`Sidebar`, `WorkspaceHeader`) **and** entering browser fullscreen. Either half alone is
unsatisfying: in-page maximise leaves the browser's chrome, browser fullscreen leaves the app's own
frame.

Two things in the codebase shaped the design before a line was written:

- `uiStore.sidebarCollapsed` / `setSidebarCollapsed` are **declared and dead** — nothing reads or
  writes them; `AppShell` keeps its own `useState` plus `localStorage("sidebarCollapsed")`. Left
  alone deliberately: the new flag is a different concept, not a reuse of that one.
- `ClipperPlacementManager` binds a **lifetime-long global `window` keydown for Escape**, and four
  modals bind their own.

## Decision

**One flag, `uiStore.isViewportFullscreen`, and `fullscreenchange` is its only writer.** The button
calls `requestFullscreen`/`exitFullscreen` and writes nothing; every store write comes from the
browser event.

That single-writer rule is what buys Esc and F11 as exit paths for free — the browser handles those
keys itself and then raises `fullscreenchange`, so this app never binds a keydown listener for
Escape and never collides with the placement handler above.

`requestFullscreen()` targets **`document.documentElement`**, not the viewport `<section>`.

The mode hides **only** `Sidebar` and `WorkspaceHeader`; `LeftPanel`/`RightPanel` are untouched. It
is **session-only** — no `localStorage` — and `ModelsView` exits fullscreen on unmount. The glyph
swaps `EXPAND` → `COLLAPSE`, *and* keeps the active styling.

The hook is split in two: `useViewportFullscreen()` reads and toggles (safe for any number of
buttons), while `useViewportFullscreenOwner()` owns the listener and the exit-on-unmount and is
called once, from `ModelsView`.

## Alternatives rejected

- **Fullscreen the viewport `<section>`.** Breaks portalled modals: `BackgroundSettingsModal` and
  `CloudModelLoadingModal` portal to `document.body`, which is not a descendant of a fullscreened
  `<section>`, so the browser refuses to paint them — Settings → Background, from the very toolbar
  this button joins, would open onto nothing. Fixing that means re-parenting the portals into this
  feature's element, i.e. the modals would have to learn about fullscreen.
- **Two independent flags** (one for chrome, one for browser fullscreen). Strands the user: Esc
  returns the browser chrome but leaves `Sidebar`/`WorkspaceHeader` hidden, with the exit affordance
  to hunt for.
- **Listen for the Escape *key*.** A fifth global Escape handler would make Esc during plane
  placement cancel the placement *and* exit fullscreen. `fullscreenchange` covers it with no
  listener at all.
- **Collapse `LeftPanel`/`RightPanel` too.** Needs restore-on-exit, but `LeftPanel` owns `isOpen`
  *and* a dragged `width` in local `useState` — restoring means lifting that into the store or
  overriding by prop, and not restoring silently discards a width the user dragged. Their collapsed
  rails stay reachable in fullscreen anyway, so "model only" is already two clicks away.
- **Persist the mode.** Not merely unwanted but impossible to honour: `requestFullscreen()` needs a
  user gesture, so a restored flag on boot would hide chrome with no fullscreen behind it — the
  stranded state, on every reload. Global persistence across routes would also leave a header-less
  Settings page with no viewport toolbar to escape from.
- **Tint one glyph instead of swapping it** (the `ToolbarGhost` precedent). That reads fine while the
  app frame is there to orient you; fullscreen deletes that frame, so the exit affordance should not
  rest on a colour difference alone.
- **Fall back to in-page maximise when `requestFullscreen()` is rejected.** Reintroduces exactly the
  split state the single-writer rule exists to prevent.

## Consequences

- **All-or-nothing.** If `requestFullscreen()` is rejected (an iframe without `allow="fullscreen"`, a
  browser policy), the chrome never hides either — the button no-ops rather than half-works. The
  rejection is swallowed on purpose: a `false` store value is already the honest answer.
- **`AppShell` must not let a restored sidebar state fight the mode** — it reads the flag rather than
  its own `localStorage` value while fullscreen is on.
- **Any future button may call `useViewportFullscreen()` freely**; only one component may call
  `useViewportFullscreenOwner()`, or an unmount elsewhere would silently drop the user out.
- The mode does not survive a reload — the same contract as every other viewport setting.
