# ADR-0019: A gizmo's grab volume tracks the arrow you can see, and gives up containing the diamond

**Status:** Accepted
**Date:** 2026-08-28
**Area:** `docs/feature/bim-viewport-righttoolbars.md` § GizmoAxis, § Section tool

## Context

Reported as *"a plain vertical drag near the middle of the viewport moved the section instead of
rotating the camera"* — one of five findings in an external QA pass on the deployed viewer.

The report's own diagnosis was that the plane's handle should not be draggable unless the plane is
selected. **It already isn't:** `AxisDragManager`'s `canDrag` is `planeId === this.selectedPlaneId`,
and `_createPlane` auto-selects, so the reporter's plane was selected — they had just placed it.
Gating on selection was already the design ([ADR-0011](0011-clickable-border-band-cut-planes.md)
§ select-only bands), so there was nothing to add there.

The real cause is **size**, and it was hiding in plain sight behind a comment claiming the opposite.
`GRAB_AXIS_EMPHASIS`'s docstring says the picker scales with the drawn arrow so that *"what you can
grab stays identical to what you can see"* — the invariant ADR-0013 also invokes by name. The
numbers never delivered it. All radii, at the reported 690 px viewport, where one gizmo unit is
`GIZMO_VIEW_FRACTION / GIZMO_LENGTH × height ≈ 33 px`:

| | gizmo units | ~px | drawn? |
|---|---|---|---|
| grab cylinder (`0.35 × 1.5`) | 0.525 | 17.5 | **no** |
| arrowhead cone (`0.08 × 1.5`) | 0.120 | 4 | yes |
| arrow shaft | — | 0.5 | yes |

So the invisible grab volume was **4.4× the widest thing it wrapped** — a 35 px-wide band around a
1 px line — and `AxisDragManager._pickHandle` consumes `pointerdown` on any hit. A cut plane's gizmo
sits at the plane's centre, which for a plane fitted to the model is usually the middle of the
viewport: precisely where an orbit drag starts. The tool was eating navigation across a 35 × 140 px
capsule in the middle of the screen.

## Decision

**`GIZMO_PICK_RADIUS` drops from `0.35` to `0.16`** — a grab radius of `0.24` units, ~8 px, twice
the arrowhead's rather than 4.4× it. The claimed invariant becomes approximately true instead of
decoratively false, and a 16 px-wide target is still comfortably clickable.

**The picker's *length* is not touched.** The `"plane"` form draws a double-ended arrow (±2.1 u) and
the cylinder already matches it; the `"arrow"` form's axial offset is what keeps a thin box's
opposing face handles apart, and that is independent of radius.

**We accept that the centre diamond is no longer contained by the arrow's grab cylinder.** This is
the clause of [ADR-0013](0013-movable-cut-plane-gizmo.md) this ADR amends: the diamond's corners
reach `0.424` units, so at radius `0.525` it was wholly enclosed and its per-id `"inPlane"` priority
in `_pickHandle` was a tie-break inside a containment. At `0.24` the diamond extends past the
cylinder in-plane, and **that priority is now doing real work**: without it, which handle you got
would depend on where in the diamond you pressed. Nothing changes at runtime — the override ignores
distance — but the reasoning behind it is no longer the reasoning ADR-0013 recorded, so it is
restated at the `pickTargets` call site rather than left to be re-derived.

## Alternatives rejected

- **Require a modifier (Alt/Shift) to drag the handle** — ADR-0013 already rejected a modifier for
  the in-plane drag on three counts (undiscoverable, Alt is an OS menu modifier on Windows). All
  three apply unchanged here, and it would make the *primary* gesture the modified one.
- **Require a second click to "arm" the selected plane's handle** — a state nobody asked for, and it
  reintroduces the problem one level up: the armed plane's handle is just as fat.
- **Split `GIZMO_PICK_RADIUS` per form**, tightening the `"plane"` arrow and leaving `SectionBox`'s
  face handles at `0.35`. Rejected for now on the developer's call: one constant beats two, and a
  16 px target is comfortable for box faces too. The split is the fallback if box faces test as too
  hard to grab — the constant is a single edit either way.
- **Carve a central gap in the cylinder so the diamond stays disjoint** — ADR-0013 rejected exactly
  this, for cost (`mergeGeometries`, two cylinders in one mesh) and because the visible arrow still
  runs through the gap. Shrinking the radius does not revive the idea; it makes the containment
  question moot instead of solving it.
- **Leave the radius and shrink the diamond instead** — the diamond is *drawn*, so this trades an
  invisible hazard for a visibly smaller handle, and the arrow's cylinder would still swallow orbit
  drags along the whole shaft.
- **Fix the comment rather than the code** — i.e. accept a 4.4× grab volume and document it. The
  reported symptom is a real navigation failure in the middle of the viewport; documenting it does
  not stop it.

## Consequences

- **`SectionBox`'s six face handles get the same shrink**, since they share the `"arrow"` form. They
  should stay grabbable — overlap risk can only *fall* with a thinner cylinder — but they are the
  thing to watch, and the per-form split above is the prepared answer.
- **Two documents now describe a containment that no longer holds.** ADR-0013 § Context's third
  measurement and its `pickTargets` counterpart carried the `0.525` figure and the *"could never win
  a raycast unaided"* conclusion. ADR-0013's status is qualified and the passage carries a forward
  pointer here; its original reasoning is left intact, per `README.md`.
- **ADR-0013's "~37px region at the arrow's middle no longer moves the cut" is unaffected** — that
  region is the diamond, whose size (`GIZMO_DIAMOND_SIZE 0.6`) did not change.
- ⚠️ **The centre diamond is still a pointerdown sink at the plane centre.** It is ~20 px square,
  drawn, and dragging it moves only the gizmo handle — not the cut — so it is a much smaller and far
  less damaging version of the reported problem. It was deliberately left alone: shrinking it changes
  a *visible* element, which is a design change rather than a fix. If orbit-theft is still felt after
  this change, the diamond is the next suspect.
- ⚠️ **No automated check covers this.** `scripts/check-gizmo-frames.mjs` asserts picker *direction*
  only — Groups A and C never look at cross-sectional radius — so nothing would catch a future
  regression of this constant. Deliberately not added: a pick-radius assertion would encode a
  feel-based number as a test, and the number is expected to be retuned.
