# ADR-0010: One sectioning tool at a time, via a third component; cut-plane outlines fit the model

**Status:** Accepted
**Date:** 2026-08-05
**Area:** `docs/feature/bim-viewer.md` § Section tool, § Section box, § Sectioning interlock

## Context

Two requirements, both about making the box and the cut planes read as one tool:

1. Only one of them may crop at a time.
2. An axis-aligned cut plane should draw the same rectangle as the matching `SectionBox` face — the model's footprint, not an oversized square.

Requirement 1 contradicts [ADR-0005](0005-section-box-outside-clipper.md) § Consequences bullet 4, which recorded non-exclusivity as *intended*. That objection turned out to be narrower than it read: ADR-0005 rejected one **mechanism**, `bimStore.activeTool`, because `ViewportRightToolbar.tsx` suppresses `Hoverer`, `Outliner` *and* `postproduction` whenever `activeTool !== "select"` — so a box on `activeTool` costs selection outlines and the whole post pass for as long as it crops. Re-verified against that file; still true. It never considered an interlock that bypasses `activeTool` entirely.

**There is no engine forcing reason.** Both features write to `renderer.three.clippingPlanes` via `setPlane`, so a live box plus six planes is twelve half-spaces ANDed — but three.js imposes no limit that twelve approaches, and the intersection is well-defined. The cost is interpretability, not capability. The justification is the product requirement.

Requirement 2's obvious form — fit only axis-aligned planes, gated on `axisOf(plane.normal) !== null` — has a trap: `AXIS_ALIGNMENT_DOT` is ≈1.15°, so on a model rotated for site north *nothing* qualifies and the feature silently does nothing.

## Decision

**A third component, `SectioningArbiter`,** owns "which sectioning tool is cutting". It **derives** that from the two components' existing public state — `sectionBox.active` and `planes.some(p => p.enabled)` — by subscribing the `onStateChanged` event both already have, and diffing against its own previous view. It adds **no events and no methods** to either class; `SectionBox` needed no code change at all. Neither component imports the other.

Suspension is reversible: the loser is switched off through the same `togglePlane`/`disable` a user drives, with the arbiter snapshotting which planes were user-enabled so a restore cannot switch on one the user had deliberately switched off. A `_reconciling` flag guards re-entrancy, since suspend and restore fire the very events the arbiter listens to.

`bimStore.activeTool` is untouched.

**Cut-plane outlines are fitted by projecting the model bbox's 8 corners into the plane helper's local frame** and taking min/max in local X/Y (`ClipperCursor/src/planeFit.ts`). No `axisOf` branch. `plane.size` is pinned to 1 and the dimensions live in the `LineLoop`'s geometry, because `SimplePlane`'s `size` setter is a single uniform scalar. Each plane's gizmo moves to a detached anchor at the rectangle's centre, carrying the helper's rotation.

> ⚠️ **The `plane.size` sentence is obsolete; the projection is not.** [ADR-0011](0011-clickable-border-band-cut-planes.md) moved the outline out of `SimplePlane._planeMesh` entirely, into `GizmoAxis`'s overlay — so the carrier quad, `plane.size`, `autoScale` and the hidden-material trick all stopped being involved. **The corner-projection fit itself is unchanged and still load-bearing**: it supplies the outer edge of the border band that replaced the outline-plus-fill. The anchor sentence also still holds.

## Alternatives rejected

- **A bespoke `onActivated` event on each component** — the obvious shape, and what the first draft specified. It **cannot work**: it signals activation only, so nothing fires when the winning tool is switched *off*, and the loser stays suspended with no way back. Deriving from the existing `onStateChanged` catches both edges and needs no new API. This is the one to re-read before "simplifying" the arbiter into an event.
- **Wiring the box to the reserved `activeTool: 'section'`** — free exclusivity with Measure and Coordinate too. Lost for ADR-0005's original reason, re-verified: no selection outlines and no post pass while cropping, and switching to Measure would silently drop the crop.
- **Destroying the losing side** — no snapshot bookkeeping, no stale state. Rejected on the absence of undo: six placed cut planes lost to one misclick.
- **Mutual direct calls between the two components** — fewest moving parts. A circular import between two modules whose classes carry static `uuid` fields is fragile under bundling, and it is exactly what ADR-0005 § Consequences bullet 8 declined to do.
- **Arbitrating in the toolbars** — ruled out by a code fact, not taste: `ClipperPlacementManager` binds its own canvas pointer listener and calls `onPlace` → `_createPlane` directly, so React never sees a plane appear. A toolbar arbiter could only catch *entering* placement mode.
- **Suspending on entering placement mode, restored on ESC** — you would see the uncropped model while aiming, and ESC would be non-destructive. Costs a third `provisionally-suspended` state and couples the arbiter to the placement lifecycle rather than to clipping state alone. As shipped, *Add plane* → ESC leaves the box cropping with no special case, because placement mode is invisible to the arbiter.
- **Fitting only axis-aligned planes, keeping the diagonal square for skewed cuts** — the literal request, and it preserves the tidy invariant *coloured ⇔ fitted*. Rejected because the projection needs no branch, no tolerance and fewer lines, and still fits on a site-rotated model where this version would do nothing.
- **A bbox-sized rectangle centred on the clicked point** — cheapest option needing no anchor, and the arrow stays centred. Rejected because it does not fit the model: click near an edge and the rectangle hangs half off the building.
- **Interlocking `OBC.Views` too** — it writes to the same renderer array, so a 2D view still crops alongside a box. Left alone: `Views` has no notion of being suspended and restored, and giving it one is a larger change than this.

## Consequences

- **Shape and colour now answer different questions.** `colorOf` still greys a skewed normal, so a skewed cut draws a tightly fitted **grey** rectangle. The previous reading — colour tells you whether the outline is square — no longer holds.
- **The interlock lives in derived state plus a re-entrancy flag**, which is subtler than an explicit event pair and will look like something to simplify. The first rejected alternative above is the guard against that.
- **`ToolbarClip`'s suspended hint is load-bearing, not decoration.** `planeState.enabled` carries the actual cutting state, so without the hint a user who placed three planes opens the menu, finds three rows off, and concludes they were lost.
- **`plane.size` is now inert as a sizing channel**, and `Clipper`'s list-wide `size` setter (ADR-0005 fact 3) could still reach in and rescale every rectangle from outside. Nothing does today.

  > ✅ **This exposure was closed by [ADR-0011](0011-clickable-border-band-cut-planes.md)**, which stopped parenting anything to the carrier quad. `Clipper.size` can no longer reach a cut plane's visuals at all.
- **`ClipperCursor`'s drag path changed again** — `getOrigin` now returns the anchor and `onDrag` subtracts an in-plane offset. Exact rather than approximate, because `AxisDragManager` only ever moves along the axis, but ADR-0005 § Consequences bullet 5 already flagged this path as where regressions land.
- **Restoring cut planes relies on `togglePlane` re-suppressing the vendor arrow.** `SimplePlane.enabled = true` restores remembered visibility and calls `toggleControls`; bypassing `togglePlane` to re-enable a plane would leave `TransformControls` arrows on screen.
- **The arbiter is silent during world teardown** — `SimplePlane.enabled` throws without a renderer, and `SectionBox._teardownWorldParts` drops `_active` without an event, so the arbiter's view can go stale there. Acceptable: everything is about to be disposed.
