# 03: Switch the chip layer off

**What to build:** one control that turns every chip off, and back on. A coordinator who needs a
clear view of the model — or who needs to click an element a chip is sitting on top of — gets it in
one action.

Small, but it lands **before** clicking because it is the escape hatch for the hazard clicking
introduces. Shipping clickable chips first would mean shipping a period where a chip can cover an
element and there is no way past it.

The switch is also the honest answer to something these chips cannot avoid: they draw through
geometry. There will always be a moment where one is in the way, and no amount of automatic
behaviour resolves it, because a single click cannot mean both "select this device" and "pick the
element behind it".

The state belongs with the tab's other view state, and should persist while the tab is open so that
switching chips off is not undone by selecting a device or by models loading.

**Blocked by:** 02 (there must be chips to switch off).

**Status:** ready-for-agent

- [ ] A visible control turns all chips off
- [ ] The same control turns them back on
- [ ] With chips off, clicking where a chip was selects the element beneath it
- [ ] The setting survives selecting a device, binding a device, and models finishing loading
- [ ] Turning chips off and leaving the tab does not strand the setting in a state the user cannot undo
- [ ] The control follows the design system's interactive states
- [ ] The typecheck, the lint and the production build pass
