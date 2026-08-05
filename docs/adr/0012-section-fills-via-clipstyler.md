# ADR-0012: Section fills come from `OBF.ClipStyler`, but we own the refresh

**Status:** Accepted
**Date:** 2026-08-05
**Area:** `docs/feature/bim-viewer.md` § Section tool → Fills

## Context

A cut plane discards geometry at the cut, so a sliced wall renders as an open shell. Architectural sections fill that cross-section so it reads as solid material. `OBF.ClipStyler` exists for exactly this, is present in the pinned `@thatopen/components-front@3.4.0`, and this app already runs the `OBF.PostproductionRenderer` its tutorial assumes.

**The vendor's auto-update cannot fire in this app.** `createFromClipping` (`components-front/dist/index.js:66208`) is, in full:

```js
const edges = this.create(plane.three, config);
if (link !== false) {
  plane.onDraggingEnded.add(() => edges.update());   // the ONLY update trigger
  plane.onDisposed.add(() => edges.dispose());       // useful
}
```

`onDraggingEnded` fires only from `notifyDraggingChanged`, which fires only from `SimplePlane`'s own `TransformControls` `"dragging-changed"` listener (`components/dist/index.mjs:17397`). Those controls are permanently disabled here — `suppressDefaultArrow` sets `controls.enabled = false`, and `plane.visible = false` calls `toggleControls(false)` — because dragging goes through `AxisDragManager` ([ADR-0002](0002-section-plane-outline-only.md) → [ADR-0011](0011-clickable-border-band-cut-planes.md)). Left alone, a fill would render once at the plane's birth position and stay there while the cut moved away.

Two further vendor facts, both found while implementing rather than while planning, and both of which change the code:

1. **`ClipEdges.items` carries a guard** (`:66052`) that silently rejects a style name the styler does not already know. Creating before registering leaves every plane with an empty item map and **no error**.
2. **`items.onItemSet` calls `create(style, data)` immediately**, so setting the item generates the first fill — no initial `update()` is needed.

## Decision

**One fill-only style**, registered before any `createFromClipping`: `fillsMaterial` set, `linesMaterial` omitted, which the vendor documents as generating no lines at all. Consequence worth having: no `LineMaterial` from `three/examples`, so no fat-line machinery enters the bundle.

**`items: { All: { style } }` with no `data`**, documented as "all items cut will be styled" — so none of the tutorial's `Classifier` / `ItemsFinder` grouping is required for a uniform fill.

**`link` stays on for its disposal half, and `ClipperFillManager` supplies the update half.** It calls `update()` once per drag gesture, derived from the drag manager's existing `onStateChanged`: a `draggingId` transition from an id to `null` is a finished drag. What makes this a one-liner is that `create(plane.three, …)` receives the **live** `THREE.Plane` and the vendor states it "won't be copied", so `update()` always recomputes against the current position.

**The fill is a neutral mid-light grey (`0xb8b8b8`), not the tutorial's black.** Poché works by making the cut read solid *against the void*; classic poché is dark on light. Here `--color-bg` is `oklch(10.5% 0.012 255)` and `world.scene.three.background` is `null`, so the canvas shows near-black through it — a black fill would land at the void's own lightness and read as a **hole**.

Scope: **3D cut planes only.** `SectionBox` gets no fills.

## Alternatives rejected

- **`color: "black"`, exactly as the tutorial** — correct in the tutorial's light scene, wrong against this app's measured background.
- **Fills *and* styled lines** — the fuller `"Blue"`/`"Red"` tutorial styles. Out of scope by request, and `LineMaterial` pulls `three/examples` fat-line machinery in for an effect nobody asked for.
- **Per-plane fills in the plane's own axis colour** — would tie a cut and its handle together visually, but makes cut faces change colour according to which way you happened to cut, which is not what a section fill means.
- **The tutorial's Classifier per-category styles** (walls one colour, doors another) — genuinely valuable for plan views later. Unnecessary here, and decision 2 means it can be added without rework.
- **`update()` every drag frame** — tracks the cut exactly, at ~60 async geometry rebuilds a second on a real IFC. The vendor's own choice of drag-end is the hint.
- **`update()` debounced during the drag** plus an exact one on release — more moving parts for a half-following fill that may read worse than one which plainly waits.
- **Adding `onDragEnd?: (id) => void` to `AxisDragManager`** — explicit and unmissable, and tempting. Rejected because it is new API on infrastructure shared with `SectionBox`, which would pass nothing, and `onStateChanged` already carries the information. Same reasoning as [ADR-0010](0010-sectioning-arbiter-and-fitted-plane-outlines.md)'s arbiter.
- **Refreshing on every `ClipperCursor.onStateChanged`** — no drag detection at all, but that event fires on hover and selection too, so ordinary mouse movement would trigger geometry rebuilds.
- **A separate top-level `bim-components/ClipFills/` component** — it would need `ClipperCursor`'s plane lifecycle anyway, so it buys isolation from nothing and adds an import edge.
- **Fills on the section box too** — `ClipStyler.create()` takes a bare `THREE.Plane`, so the box's six faces are eligible, and the cost is smaller than it looks: one `update()` per face drag, six only on *Reset* / *Fit*. Held back for scope, not blocked.

## Consequences

- ⚠️ **The two sectioning tools now render cuts differently.** Cut planes fill; the section box shows raw shells. Visible the moment you switch between them, and the most likely follow-on request.
- ⚠️ **Style registration must precede plane creation**, or fills silently never appear. The order is enforced in `ClipperFillManager`'s constructor and commented there; there is no error to catch if it is broken.
- **The fill is stale during a drag** and snaps on release. Covered because the band and outline follow live, so the cut's position is never in doubt — only the poché lags.
- ⚠️ **Fills live in `world.scene`**, so they are depth-tested and clipped by other planes — unlike the band and outline, which sit in the overlay. Correct per part (a fill is cut material; a band is an annotation that must not be hidden), but it means one plane's appearance spans two passes.
- **Suspension is free.** `_syncVisibility` drives fill visibility from `planeState.enabled`, and `SectioningArbiter` suspends by calling `togglePlane`, so a suspended cut loses its fill with its band.
- **`update()` rejections are logged, not propagated** — there is no caller to hand them to. A silently failing fill will appear in the console rather than as a thrown error.
- **`ClipStyler.styles` is one shared map with no owner tracking**, the same hazard as `Clipper.list` (ADR-0005 fact 3). Our style is namespaced `BIMBOY_SectionFill` to make a collision obvious rather than mysterious.
