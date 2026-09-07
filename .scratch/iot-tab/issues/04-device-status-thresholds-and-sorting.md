# 04: Device status, thresholds and alarm sorting

**What to build:** turn the device list from a directory into a monitoring tool. A BIM coordinator
glances at the left panel and immediately knows whether anything needs attention, without reading a
single number.

Each device row gains a coloured status dot — healthy, warning, alarming, or offline — and devices
in alarm sort to the top of the list. This is what makes "click to zoom" meaningful: the coordinator
zooms to the alarm, not to the fourth item in an alphabetical list. Six names sorted alphabetically
is a nav control; one red dot at the top is a monitoring tool, and it is most of the perceived value
of the tab for roughly twenty lines of work.

**Status is computed, never stored.** A pure function maps a metric and a value to a status, over a
threshold constant map. Two reasons this is not negotiable. A status field written onto a reading is
a denormalised copy that goes stale the moment a threshold changes, silently disagreeing with the
thresholds the UI is using. And no external IoT platform will ever hand you *your* thresholds — a
stored status is something the mock can supply and reality cannot, so it would quietly break the
provider interface's promise that a real source can drop in.

**An offline device must render an explicit no-value indicator, never `0`.** This is the failure
mode that matters most and the one that is easiest to ship by accident: a dead sensor displayed as
a perfect reading of zero is worse than no dashboard at all, because it actively misinforms. An
offline device also shows when it was last heard from, so a coordinator can judge how much to trust
what they are seeing.

The mock's scripted alarm, over-temperature and offline devices from ticket 02 mean all four states
are on screen on every load, with no need to wait for a random generator to produce them.

Thresholds are constants in this phase. Making them configurable per project needs the same settings
plumbing as the real mapping table, and both belong to phase 2.

**Blocked by:** 02 (needs a device list to add status to).

**Status:** ready-for-agent

- [ ] Each device row shows a status indicator distinguishing healthy, warning, alarming and offline
- [ ] Status is derived by a pure function from metric and value; no status is stored on a reading
- [ ] Devices in alarm sort above warning devices, which sort above healthy ones
- [ ] An offline device renders an explicit no-value indicator and never `0`
- [ ] An offline device is visually distinct from a healthy one at a glance
- [ ] Each device shows when it was last heard from
- [ ] The scripted alarming, over-temperature and offline devices are all visible on load
- [ ] Colours come from the project's design tokens; no `!important` and no raw `oklch()` in JSX
- [ ] Status states are distinguishable by more than colour alone
- [ ] `tsc` and the production build pass
