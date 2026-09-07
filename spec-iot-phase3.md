# Spec — IOT phase 3: device annotations in the viewport

> Grilled design + rejected alternatives: `CONTEXT.md` § *IOT phase 3*.
> Phases 1–2 (the IOT tab, authored devices): `spec-iot-tab.md`, `spec-iot-phase2.md`.
> Status label not applied — the tracker is unreachable, see § Further Notes.

## Problem Statement

Phase 2 made devices real: a project admin points at an air handling unit, says *this is monitored*,
and it persists. But everything the feature knows still lives in two side panels. To answer "which
part of this floor is running hot" a coordinator has to click each device in the list one at a time
and watch the camera fly, holding the previous readings in their head.

That is the wrong way round. The building is already on screen, rendered in three dimensions, and
the readings are already known — yet the spatial question the model exists to answer is the one
question the tab cannot answer. A list sorted by status tells you *that* something is wrong; it
cannot tell you that the two alarming sensors are on opposite ends of the same corridor, or that
every warm room is on the west façade.

## Solution

Readings float on the model itself, attached to the element each device is bound to — the same
mechanism the Room tab already uses for room-name chips.

Each bound device gets a compact chip showing its icon and its headline value. Alarming devices are
unmistakable at a glance, and the pattern across a floor is visible without a single click. Clicking
a chip selects that device, filling the right panel exactly as clicking the list does. Chips follow
the model: hide or isolate part of the building and the chips for hidden elements go with it.

Because these chips cannot be occluded — they draw through walls — they are capped, prioritised so
alarms always keep their place, and switchable off in one click when they get in the way.

## User Stories

1. As a BIM coordinator, I want each bound device to show its reading on the model, so that I can
   see the state of the building spatially instead of one device at a time.
2. As a BIM coordinator, I want to spot an alarming device without reading the list, so that
   problems find me rather than the reverse.
3. As a BIM coordinator, I want the chip to show the same value the device's list row shows, so that
   I never have to work out which of two numbers is the real one.
4. As a BIM coordinator, I want chips to stay narrow, so that a floor with many devices is still
   readable.
5. As a BIM coordinator, I want an unhealthy device to be marked by more than colour, so that the
   status is readable regardless of how I perceive colour.
6. As a BIM coordinator, I want an offline device's chip to show no value at all, so that a dead
   sensor is never mistaken for a real reading.
7. As a BIM coordinator, I want to click a chip and have that device selected, so that I can go from
   noticing a problem in 3D to its detail panel in one action.
8. As a BIM coordinator, I want the selected device's chip to stand out from the rest, so that I can
   see where in the building the panel is describing.
9. As a BIM coordinator, I want the selected device's chip to show a second reading, so that a
   device I am actually investigating tells me more than one I am merely scanning past.
10. As a BIM coordinator, I want chips to disappear when I isolate part of the model, so that
    isolating actually isolates.
11. As a BIM coordinator, I want chips to disappear when I hide their elements, so that hidden
    geometry does not leave labels floating in empty space.
12. As a BIM coordinator, I want chips to come back when I show everything again, so that hiding is
    not a one-way door.
13. As a BIM coordinator, I want chips to react promptly when I isolate, so that the model does not
    look broken for several seconds.
14. As a BIM coordinator, I want to switch all chips off in one click, so that they never block work
    I am trying to do in the viewport.
15. As a BIM coordinator, I want chips to stop intercepting clicks while I am using a viewport tool,
    so that measuring and sectioning are unaffected by them.
16. As a BIM coordinator, I want chips to update as readings change, so that what floats on the
    model is current rather than a snapshot from when I opened the tab.
17. As a BIM coordinator, I want alarming devices to keep their chips when the display cap is
    reached, so that the cap never hides the one thing I needed to see.
18. As a BIM coordinator, I want the device I have selected to always have a chip, so that the cap
    cannot hide the device I am working on.
19. As a BIM coordinator, I want chips to leave the screen when I leave the IOT tab, so that they do
    not float over unrelated work.
20. As a BIM coordinator, I want chips to look like the rest of the application, so that the 3D view
    does not feel like a different product bolted on.
21. As a BIM coordinator, I want numeric readings in the same monospaced treatment used elsewhere
    for technical values, so that digits line up and are quick to compare.
22. As a BIM coordinator, I want a chip to respond when I hover it, so that I can tell it is
    something I can click before I click it.
23. As a BIM coordinator, I want a device whose element is not in a loaded model to have no chip, so
    that chips never appear detached from geometry.
24. As a project admin, I want to keep binding new devices by clicking elements, so that the new
    chips do not cost me the workflow that created them.
25. As a project admin, I want a way out when a chip covers the element I am trying to bind, so that
    the feature cannot trap me.
26. As a developer, I want the chips owned by a BIM component with a real lifecycle, so that Three.js
    objects in the scene are created and disposed where the project expects that to happen.
27. As a developer, I want chips torn down when the tab closes, so that they cannot leak across tabs
    the way the project has seen before.
28. As a developer, I want chip styling to live in the design-system stylesheet, so that tokens are
    the only source of colour and the BIM layer holds no style strings.
29. As a developer, I want the existing device list, thresholds and status derivation reused rather
    than duplicated, so that the panel and the viewport cannot disagree.
30. As a developer, I want visibility changes to reach the chips from every path that hides
    geometry, not only the toolbar, so that a smart view hiding elements is not a silent gap.
31. As a QA engineer, I want the chips covered by the existing end-to-end test rather than a new
    seam, so that the suite stays one test against the real application.

## Implementation Decisions

**Ownership moves into a BIM component.**
The chips are `CSS2DObject`s living in the scene graph, with an attach/detach lifecycle and a
disposal obligation — the criterion this project set for itself when phase 1 deliberately stayed out
of the BIM layer. A new component follows the room-view precedent: activate/deactivate, a pooled set
of label objects keyed by device, and a dispose that empties the pool and removes the elements from
the DOM. Element resolution and the camera flight move in with it; the React feature keeps the
device list, selection and telemetry and becomes the mirror of the component, mirroring how the
rooms hook and the room-view component already relate.

The framework's own marker component was rejected: it brings clustering and its own DOM, which would
have to be fought to match the design system, and it solves a problem this feature does not yet have.

**Every bound device gets a chip, subject to a prioritised cap.**
Showing only the selected device duplicates the right panel; showing only unhealthy devices makes a
healthy building look unmonitored and makes "no chip" ambiguous between *fine* and *not configured*.

The cap exists because **`CSS2D` content cannot be occluded** — chips draw through geometry, so a
sensor behind the building still labels the front of it. The room-view component caps for exactly
this reason, and its own source says so.

Unlike that precedent, the cap here is **ordered by status — alarm, then warning, then healthy, then
offline — and the selected device always keeps a slot.** Filling slots in list order, as rooms do,
would drop the chip of an alarming device merely because it sorts late, hiding the one thing worth
showing.

**The chip shows one value, and it is the same value the list row shows.**
The headline reading is chosen by the existing helper that already drives the list row and the status
badge — the reading responsible for the device's status. Reusing it is what guarantees the chip and
the row can never disagree. Chips stay narrow because width is what makes the "show everything"
decision survive a real building.

The selected device's chip expands to show a second reading. The device's name is deliberately not
on the chip: the labels this project generates are long, and doubling chip width for something the
right panel already states is a poor trade.

**Status is signalled by an icon change, not by colour alone.**
Running the visualization skill's validator over this project's status tokens against the dark
surface measured the healthy↔warning pair at a colour-blind separation well below the usable floor.
That finding produced the status-badge rule in phase 1 and applies with more force here, where a
chip is too narrow to carry a status word. Unhealthy chips therefore gain a warning glyph in
addition to their colour. An offline chip shows an explicit no-value marker and never a zero — the
rule carried through all three phases.

**Chips are clickable.**
This is the developer's explicit decision, taken against the recommendation in this document's
grilling, and recorded as such. The concern is concrete: chips draw through geometry, so twenty of
them float across the view, and a clickable chip intercepts the click that was meant for the element
beneath it — including the element-picking that binding new devices depends on.

Two mitigations were agreed. Chips become click-through whenever a viewport tool is active, read
from the store flag that already tracks it, so measuring and sectioning are untouched. And the layer
switch turns chips off entirely. **A residual case is accepted**: binding an element that a chip
happens to cover still requires switching the layer off, because one click cannot mean two things.

**Chips follow element visibility.**
A chip whose element is hidden or excluded by an isolate is removed. Isolating means *this is what I
care about*; leaving nineteen other chips floating in the emptied view defeats it, and an unoccluded
chip with nothing beneath it reads as a bug.

Visibility is read per element from the model. **This has to be polled, because there is no event to
listen to** — the hider component exposes only set, isolate, toggle and a visibility-map query, and
the fragments layer raises nothing on a visibility change.

**Visibility changes reach the chips by two paths, because one is not enough.**
The store's visibility epoch is currently bumped from exactly one place — Show All — while isolate,
hide and the smart-views component all change visibility without touching it. So the toolbar's
isolate and hide will bump the epoch too, giving an immediate response on the common path, and the
chips additionally re-check visibility on their regular refresh, covering every other path.

⚠️ Bumping the epoch also re-runs the space-visibility rule, which is a hook covered by existing
architecture decisions. Its rule is hide-only, so it should do nothing when spaces are meant to be
visible — but that is reasoning from the source, not evidence, and it must be tested explicitly.

**Chips exist only while the IOT tab is open.**
Mount is the activation signal and unmount disposes, which makes a leak structurally impossible
rather than a thing to remember. The model view's own source warns about precisely this: a
hidden-but-mounted panel leaves unoccludable chips floating over every other tab. The accepted cost
is that readings cannot be watched while working in another tab.

**Styling lives in the design-system stylesheet as component classes.**
Tailwind is not available: the project's layer rules state the BIM component directory is
engine-only, no Tailwind. Inline styles were rejected because clickable chips need hover, a selected
state and four status variants, and inline styles cannot express pseudo-classes without hand-rolling
hover in JavaScript.

A runtime probe against a real project settled the feasibility question: `<bim-viewport>` does have a
shadow root, but the 2D layer is appended as a **light-DOM child**, so a document stylesheet reaches
it. An injected test class applied, and the design tokens resolved. Colour comes only from tokens;
numeric values use the mono stack the design reference reserves for technical values.

**Chip position is the centre of the element's bounding box**, read once when a device resolves and
cached. Devices clustered on one ceiling will overlap; the cap limits the damage, and clustering is
not attempted — that was the one reason to adopt the framework's marker component, which was
rejected.

## Testing Decisions

**What makes a good test here.** Assert what the coordinator sees: a chip appears for a bound
device, it carries that device's reading, clicking it selects the device, isolating removes it,
switching the layer off removes them all. Never assert on the label pool, the projection maths, or
which CSS class encodes which state.

**Extend the existing end-to-end seam rather than adding one.** The phase 2 spec already drives the
real application through bind → assert → delete against a live database, and it is the only test
infrastructure the repository has. Chips are ordinary DOM in the light DOM — the probe confirmed
this — so they are directly queryable by the same test, and the device it binds is exactly the
device whose chip should appear.

Keeping it one test also keeps one cleanup path. The phase 2 test creates a real row in a real
project and deletes it; a second test doing the same doubles the chance of leaving litter behind.

**Covered by extending that test:**

- A chip appears for the device the test binds.
- The chip carries that device's headline value.
- Clicking the chip selects the device and fills the right panel.
- The selected device's chip is visually distinguished from the others.
- Switching the layer off removes every chip; switching it back on restores them.
- Isolating other geometry removes the chip; showing all restores it.
- Leaving the IOT tab removes all chips, and no chip element survives in the DOM.
- No engine error is raised throughout.

**Tested separately, because it touches shared code:** that bumping the visibility epoch from
isolate and hide does not disturb the space-visibility rule — specifically that isolating a room on
the Room tab still leaves that room visible. This is the one assertion protecting a change to a hook
governed by existing architecture decisions, and it is the untested assumption most likely to bite.

**Deliberately not covered:** chip pixel positions, overlap behaviour when devices cluster, the
polling cadence, and the cap's exact numeric limit.

## Out of Scope

- **Clustering or de-overlapping** chips that land on top of each other.
- **Occlusion** — chips will continue to draw through geometry; that is inherent to the mechanism.
- **Colouring the geometry itself** by sensor value, heatmaps, or gradients across a space. Still the
  next phase, and still the thing that would justify the tick reaching the renderer.
- **Chips outside the IOT tab.**
- **Chips for devices whose element is not in a loaded model.**
- **Hover tooltips or expanded cards** on the chip beyond the selected-state second value.
- **A repair flow** for devices whose element cannot be resolved.
- **Per-device or per-project control** over which metric a chip shows.
- **Real telemetry.** Readings remain mock.
- **A unit test runner.** Still not introduced.

## Further Notes

**Not filed to a tracker.** No tracker or triage-label vocabulary was provided, the setup skill is
not installed, and the GitHub MCP server failed to connect this session.

**Two risks were verified before this spec was written, not assumed:**

1. *Can a document stylesheet reach the 2D layer?* **Yes** — verified by injecting a class at runtime
   against a real project and reading back the computed style, plus confirming the design tokens
   resolve there. This is what makes the styling decision viable rather than hopeful.
2. *Does the visibility epoch already cover isolate and hide?* **No** — it is bumped from Show All
   alone, and the hider component raises no events at all. This is why the two-path approach exists.

**Deviation from the documented workflow:** the project's instructions require a visual plan before
implementation. The developer chose to skip it for this feature, going from grilling to spec
directly, and intends to amend the instructions accordingly. Recorded so the gap is not mistaken for
an oversight.

**Known untested assumptions**, carried into implementation:

1. That bumping the visibility epoch from isolate and hide does not disturb the space-visibility
   rule. Reasoned from the source, not observed.
2. That a bounding-box centre is a good chip anchor for the range of elements users actually bind.
3. That the camera framing inherited from phase 1 is usable for a single small element — still never
   spiked, and now more visible because chips mark exactly where the camera will go.
