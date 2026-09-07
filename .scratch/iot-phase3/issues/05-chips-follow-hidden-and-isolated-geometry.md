# 05: Chips follow hidden and isolated geometry

**What to build:** isolating part of the model actually isolates it. A coordinator isolates one
meeting room and gets that room — not that room plus nineteen chips from the rest of the building
floating in the emptied space.

Because chips draw through geometry, a chip whose element has been hidden does not merely linger, it
hovers over nothing. It reads as a rendering bug rather than a label.

**There is no event to listen to, and this is the crux of the ticket.** The hider component exposes
only set, isolate, toggle and a visibility-map query — no events at all — and the fragments layer
raises nothing when visibility changes. Visibility has to be asked for, not awaited.

So it arrives by two paths, because neither alone is enough:

- **The toolbar's isolate and hide bump the visibility epoch**, the store signal that currently only
  Show All raises. This makes the common path immediate, and isolate is the action people reach for
  most — a chip lingering for seconds after it looks broken.
- **Chips re-check visibility on their regular refresh**, covering the paths that never touch the
  toolbar. The smart-views component hides geometry directly, and would otherwise be a silent gap.

⚠️ **Bumping the epoch also re-runs the space-visibility rule**, a hook governed by existing
architecture decisions. Reading its source says it should be safe — its rule only ever hides, so it
does nothing when spaces are meant to be visible — **but that is reasoning, not evidence.** It is the
most likely thing in this phase to break something that already works, and it must be verified
explicitly, not assumed.

**Blocked by:** 02 (there must be chips to hide).

**Status:** ready-for-agent

- [ ] Hiding an element removes its chip
- [ ] Isolating a selection removes the chips of everything excluded by it
- [ ] Showing everything again restores the chips
- [ ] Isolating from the toolbar removes chips promptly, not after a noticeable delay
- [ ] Hiding geometry by a path that does not go through the toolbar also removes its chips, even if
      less immediately
- [ ] **Isolating a room on the Room tab still leaves that room visible** — the space-visibility rule
      is not disturbed by the added epoch bumps
- [ ] The IFCSpace visibility checkbox still behaves as before
- [ ] Show All still re-asserts standing visibility filters as it does today
- [ ] The typecheck, the lint and the production build pass
