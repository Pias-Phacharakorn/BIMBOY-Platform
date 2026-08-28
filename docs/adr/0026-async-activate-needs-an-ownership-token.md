# ADR-0026: An async `activate` needs an ownership token

**Status:** Accepted
**Date:** 2026-08-27
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Gotchas (tab components with async activate)

## Context

Found while testing something unrelated: opening the Realistic tab turned the viewport **white**, and
it stayed white after switching away.

Not a rendering bug — a lifecycle one. `RealisticView.activate` published `_baseline` *before*
`await this._measureModels()` and built the rig *after* it. Under `<React.StrictMode>` (see
`main.tsx`) every effect runs mount → cleanup → mount, so:

1. Cleanup's `deactivate` tore down a rig that did not exist yet, and nulled `_baseline`.
2. The pending `activate` then resumed and installed a rig **nobody owned**.
3. Every later `deactivate` hit `if (!baseline || !world) return` and left it in the scene.

The colour was the confirmation, and it is worth recording because it is what made the diagnosis
fall out. The orphaned `activate` ran `_applySettings`, which reads `this._world` — null by then —
and returned early. So the leaked `Sky` kept three's default uniforms (`sunPosition (0,0,0)`,
turbidity 2) and rendered as a washed near-white dome rather than a sky. It covers the frame on every
tab, which is why leaving Realistic did not clear it.

StrictMode does not *cause* this. It makes it the normal path rather than a rare race — a slow
fragments worker reaches the same state in production.

## Decision

A `_generation` counter, bumped by **both** `activate` and `deactivate`. `deactivate` bumps it
*before* its early return, so a pending `activate` is cancelled even when there is nothing to tear
down. After every await, `activate` compares the generation it captured against the current one and
returns if it no longer owns the component. `refit` carries the same guard — identical shape,
identical hazard.

**And the hook's `.then` stops calling `deactivate`.** `useRealisticView` deactivated from the stale
callback, which the token turns from useless into actively harmful: under StrictMode that callback
belongs to a *cancelled* activate while a live one is already in flight, so deactivating there
cancels the live one too and the tab ends up with no rig at all. Cleanup is now the only teardown
path; the `mounted` flag only gates `setSettings`.

## Alternatives rejected

- **Build the rig before the await.** Makes this one ordering safe and leaves the class of bug open:
  any future await added to `activate` reintroduces it, silently.
- **Have `deactivate` await the in-flight `activate`.** Makes a synchronous teardown asynchronous,
  which every caller — including `dispose` — would have to learn about.
- **Drop StrictMode.** It found a real leak that a slow fragments worker would hit in production too.
  Removing it hides the class of bug rather than fixing it.

## Consequences

- **This is a pattern, not a one-off fix.** Any `OBC.Component` driven by a React feature hook, whose
  `activate` awaits anything, needs the same token. `RoomView` is the other component of this shape;
  its `activate` is currently synchronous, which is the only reason it is safe.
- The guard must sit after *every* await in the method, not just the first — the check is "do I still
  own this component", and each await is a fresh opportunity to lose it.
- `deactivate` bumping before its early return is the non-obvious half. A version that bumps only when
  there is something to tear down leaves exactly the mount → cleanup → mount case unfixed, which is
  the one StrictMode guarantees.
