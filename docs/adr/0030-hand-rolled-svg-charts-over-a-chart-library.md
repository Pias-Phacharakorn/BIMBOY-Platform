# ADR-0030: IoT charts are hand-rolled SVG, not a charting library

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/iot.md`](../feature/iot.md)

## Context

The IOT tab's right panel charts a device's recent readings. **No charting library was installed in
the project**, so this was a genuine dependency decision rather than a use-what-we-have one.

Recharts is the obvious pick for a React 19 app and would have been quicker to first render.

## Decision

The charts are **hand-rolled SVG** (`IotSparkline`). No charting dependency was added.

Three chart forms are needed: a line series, a stat tile, and a status pill. Stacked mini-charts —
one per metric — rather than a single chart with a metric selector.

## Alternatives rejected

- **Recharts.** It renders its own SVG subtree with inline `fill` and `stroke` attributes, so every
  axis, grid line, tooltip and series colour becomes a design token threaded through a prop. CLAUDE.md
  bans `!important` and raw `oklch()` in JSX, and `DESIGN.md` owns the palette — meaning the library's
  natural styling path is the one this project forbids, and the workaround is plumbing tokens through
  props on every chart. React 19 compatibility was also unverified at the time.
- **Any other chart library.** The same styling argument applies to all of them; three chart forms is
  the low end of what is reasonable to hand-roll, and the shapes here are simple (a polyline over a
  fixed domain, a number, a coloured pill).
- **One chart plus a metric selector.** The panel exists to answer "how is this room doing" at a
  glance. A selector turns one glance into three clicks to learn the same thing.

## Consequences

- Axes, tooltips, legends and interaction are ours to build. Anything beyond the three forms above —
  brushing, zooming, a shared crosshair — is real work, not a prop.
- Each metric has a **fixed chart domain** in `iotThresholds.ts` so a flat series does not render as
  a full-scale zigzag. A library would have auto-scaled by default; here it is an explicit constant
  per metric, and adding a metric means choosing one.
- Colours come from design tokens directly, which is the point. The one place tokens cannot reach is
  raster pixel data — see `drawing.md` on the PDF diff canvas for the same constraint hit from the
  other direction.
- If charting needs grow past sparklines and stat tiles, revisit this rather than growing the
  hand-rolled layer indefinitely. The cost of the library was never that it is hard to use; it is
  that its styling model fights this project's token rules.
