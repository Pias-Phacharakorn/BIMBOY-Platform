# 02: Readings float on the model

**What to build:** the feature. A coordinator opens the IOT tab and sees each bound device's reading
floating on the element it is attached to — so "which part of this floor is running hot" is answered
by looking, not by clicking through a list.

This is the tracer bullet, and it is deliberately not split: a chip that renders but shows nothing,
or a value with nowhere to draw, is half a feature that cannot be shown to anyone.

**Each chip carries an icon and one value.** The value is the device's headline reading — chosen by
the same helper that already drives the list row and the status badge. Reusing it is the entire
reason a chip and its row can never disagree; a second rule would eventually show 1480 ppm in the
list and 24 °C on the model with nothing to say which is real.

Chips stay narrow on purpose. Width is what decides whether showing every device survives contact
with a real building.

**Status is carried by an icon change as well as colour.** Measuring this project's status tokens
against the dark surface put the healthy-versus-warning pair well below the usable colour-blind
separation floor, which is why the status badge already carries a word. A chip is too narrow for a
word, so unhealthy chips gain a warning glyph. **An offline chip shows an explicit no-value marker
and never a zero** — the rule carried through every phase.

**Chips are capped, and the cap is ordered by status.** These labels cannot be occluded — they draw
through walls, so a sensor behind the building labels the front of it, which is why the room-view
component caps its own chips and says so in its source. Unlike that precedent the cap here fills
slots alarm-first, then warning, then healthy, then offline, and the selected device always keeps a
slot. Filling in list order would drop an alarming device's chip merely because it sorts late.

**Chips exist only while the IOT tab is open.** Mount activates, unmount disposes. The model view's
own source warns that a hidden-but-mounted panel leaves unoccludable chips floating over every other
tab — a bug this project has already had with this exact mechanism.

**Styling is component classes in the design-system stylesheet**, tokens only, with the monospaced
treatment the design reference reserves for technical values. Tailwind is unavailable in the engine
layer by the project's own layer rules. A runtime probe confirmed a document stylesheet reaches the
2D layer, so this works — if it somehow does not, inline styles using the token custom properties are
the fallback.

Chips anchor to the centre of the element's bounding box, resolved once and cached.

No clicking, no visibility following, no layer switch — those are tickets 03 to 05.

**Blocked by:** 01 (the component that owns the scene objects must exist first).

**Status:** ready-for-agent

- [ ] Each bound, resolvable device shows a chip on its element in the IOT tab
- [ ] The chip shows the same value as that device's row in the list
- [ ] Chip values update as readings change
- [ ] An unhealthy chip is distinguishable by something other than colour alone
- [ ] An offline chip shows a no-value marker and never a zero
- [ ] A device whose element is not in a loaded model has no chip
- [ ] The number of chips is capped
- [ ] When the cap bites, alarming devices keep their chips and healthy ones lose theirs
- [ ] The selected device always has a chip regardless of the cap
- [ ] Leaving the IOT tab removes every chip from the DOM
- [ ] Returning to the tab restores them
- [ ] Leaving the model view entirely leaves no chip element behind
- [ ] All chip colour comes from design tokens; no hardcoded colour values
- [ ] No Tailwind class strings are added to the engine layer
- [ ] The typecheck, the lint and the production build pass
