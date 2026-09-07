# 06: The right panel charts the selected device

**What to build:** having flown to a device, the BIM coordinator needs to know whether what they are
looking at is a spike or a sustained condition. The right panel answers that: it names the selected
device, states its status, and shows recent history as a stack of small charts — one per metric the
device reports.

The panel must be self-describing. After the camera has moved, the coordinator is looking at
geometry and needs the panel to tell them, without ambiguity, which device it is describing and how
that device is doing.

**Stacked mini-charts, not one large chart behind a metric selector.** A device in a meeting room
reports temperature, CO₂ and occupancy, and the question being asked is "how is this room doing" —
answerable in one look when all three are visible, and costing three clicks to answer through a
selector. A single large chart earns its place when investigating one metric in depth, which is a
later refinement, not the default.

Each chart is labelled with its metric name, current value and unit, so it is readable on its own
without cross-referencing a legend. Each also indicates the threshold at which that metric becomes
a problem, so the coordinator can see how close to trouble a value is rather than only its absolute
number — a CO₂ reading of 900 means nothing in isolation and a great deal against a 1000 threshold.

**Charts are hand-rolled SVG. No charting library is added.** Three forms are needed — a
time-series line, a current-value tile, and a status pill — which is the low end of hand-rolled, and
the reason to avoid a library here is theming rather than bundle size. Charting libraries render
their own SVG subtree with inline fill and stroke attributes, so every axis, grid line and tooltip
becomes a design token threaded through a prop, against this project's hard constraints banning
`!important` and raw `oklch()` in JSX. Hand-rolled SVG takes a token class directly.

**Load the `dataviz` skill before writing the first line of chart code.** It covers palette, axis
and legend rules, and it is the difference between charts that read as one system and charts that
look like three different people made them. Verify its guidance against the project's design tokens;
where they conflict, the project's tokens win.

**Blocked by:** 04 (the panel header shows status, and the charts draw threshold bands), 05 (history
to plot, and a chart that never moves is hard to judge as correct).

**Status:** ready-for-agent

- [ ] Selecting a device fills the right panel with that device's label and status
- [ ] The panel shows when the device was last heard from
- [ ] A device reporting several metrics shows all of them stacked, with no metric selector
- [ ] Each chart shows its metric name, current value and unit
- [ ] Each chart indicates the threshold at which the metric becomes a problem
- [ ] Charts extend as new readings arrive
- [ ] The alarming device's chart visibly sits beyond its threshold
- [ ] The offline device's panel shows no fabricated values
- [ ] Selecting a different device replaces the panel content entirely, with no stale charts
- [ ] No charting library is added to the project's dependencies
- [ ] The `dataviz` skill was loaded before chart code was written
- [ ] Colours come from design tokens; no `!important` and no raw `oklch()` in JSX
- [ ] Charts remain legible when the panel is resized
- [ ] `tsc` and the production build pass
