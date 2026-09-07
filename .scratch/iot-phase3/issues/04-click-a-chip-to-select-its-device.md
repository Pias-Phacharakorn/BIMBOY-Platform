# 04: Click a chip to select its device

**What to build:** noticing a problem in 3D and opening its detail become one action. A coordinator
sees a red chip on the far side of the floor, clicks it, and the right panel fills with that device —
the same result as finding it in the list, without the finding.

The selected device's chip also becomes unmistakable: emphasised with the accent treatment and
expanded to show a second reading. A device being investigated should say more than one being scanned
past, and it is what ties the panel to a place in the building.

**This ticket knowingly introduces a hazard, and the developer accepted it deliberately.** Chips
cannot be occluded, so up to twenty of them float across the view, and a clickable chip intercepts
the click meant for the element beneath it — including the element-picking that binding new devices
depends on. The recommendation was to leave chips inert; the developer chose clickable, matching the
reference product they are working from.

Two mitigations are part of this ticket, not follow-ups:

- **Chips become click-through whenever a viewport tool is active.** Measuring, sectioning, isolating
  and hiding must be completely unaffected by chips. The active tool is already tracked in the
  store, so this is a read, not new plumbing.
- **The layer switch from ticket 03** covers everything else, which is why it lands first.

**A residual case is accepted and must not be papered over:** binding an element that a chip happens
to cover still requires switching the layer off. That is a real limitation, and the switch is the
answer to it.

**Blocked by:** 03 (the escape hatch must exist before the hazard ships).

**Status:** ready-for-agent

- [ ] Clicking a chip selects its device and fills the right panel
- [ ] Clicking a chip moves the camera to that device, as selecting from the list does
- [ ] The selected device's chip is visually distinct from the others
- [ ] The selected device's chip shows a second reading
- [ ] Chips indicate they are interactive on hover, per the design system's interactive states
- [ ] While a viewport tool is active, clicks pass through chips to the model
- [ ] Placing measurement points and section planes is unaffected by chips
- [ ] With chips switched off, element picking is unaffected
- [ ] Clicking a chip raises no engine errors
- [ ] The typecheck, the lint and the production build pass
