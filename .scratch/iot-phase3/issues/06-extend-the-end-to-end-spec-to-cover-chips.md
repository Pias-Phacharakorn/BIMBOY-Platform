# 06: Extend the end-to-end spec to cover chips

**What to build:** the existing IOT end-to-end test grows to cover the chips, so the parts a user
depends on are protected without adding a second test.

**Extend, do not add.** The existing test already drives the real application through bind → assert →
delete against a live database, and the device it binds is exactly the device whose chip should
appear — the test already creates the conditions this feature needs. A runtime probe confirmed the
chips live in the light DOM, so they are ordinary queryable elements, not something hidden behind a
canvas or a shadow root.

Keeping it one test also keeps **one cleanup path**. That test creates a real row in a real project
and deletes it, asserting the deletion so a failed cleanup fails loudly. A second test doing the same
would double the chance of leaving a stray device in a customer project.

Assert what a coordinator sees. No assertion may reach into the label pool, the projection maths, or
which class encodes which state — all of those are expected to change, and a test coupled to them
fails on refactors that break nothing.

**One assertion belongs outside the IOT flow**, because it protects shared code rather than this
feature: that isolating a room on the Room tab still leaves that room visible after the visibility
epoch gained new writers. It is the single guard against ticket 05 regressing a hook covered by
existing architecture decisions.

**Blocked by:** 04, 05 (the test asserts clicking, emphasis and visibility following).

**Status:** ready-for-agent

- [ ] A chip appears for the device the test binds
- [ ] The chip carries that device's headline value
- [ ] Clicking the chip selects the device and fills the right panel
- [ ] The selected device's chip is distinguishable from the others
- [ ] Switching the layer off removes every chip; switching it on restores them
- [ ] Isolating geometry removes the affected chips; showing all restores them
- [ ] Leaving the IOT tab leaves no chip element in the DOM
- [ ] The space-visibility regression is asserted: isolating a room on the Room tab leaves it visible
- [ ] No engine page errors or console errors throughout
- [ ] The test still deletes the device it created and asserts it is gone
- [ ] No assertion references the label pool, projection maths, or CSS class names
- [ ] The full Playwright suite passes, including the pre-existing specs
