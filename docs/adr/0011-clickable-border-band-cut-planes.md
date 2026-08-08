# ADR-0011: A cut plane is a clickable border band in the overlay pass

**Status:** Accepted
**Date:** 2026-08-05
**Area:** `docs/feature/bim-viewport-righttoolbars.md` § Section tool
**Supersedes:** [ADR-0002](0002-section-plane-outline-only.md) (four of its five clauses)

## Context

Two requests: a cut plane should show a thin band of surface around its border with the interior empty — not a full fill — and clicking a plane should switch sectioning to it.

Both had been refused. [ADR-0002](0002-section-plane-outline-only.md) built a grabbable translucent quad, shipped it, and reversed it within a day for two measured reasons: the quad fought element selection (*"a plane grabbable **anywhere it is visible** is grabbable across most of the screen, and selecting an element became a matter of finding a gap"*), and a translucent sheet did not read as a plane in space (*"at any usable alpha it tinted the geometry behind it; low enough not to, and it was invisible edge-on anyway"*).

**A border band voids the premise of the first objection.** "Grabbable anywhere it is visible" only spans the screen if the plane *is* visible everywhere. A band is visible along its perimeter — which sits at or past the edge of the model's footprint — so the middle of the plane, where the geometry you want to click lives, is never pickable. The two requests are safe together in a way neither was alone.

Three attempts were made this session before this one, and each failure is worth keeping:

1. **A full fill on every plane plus a marker gizmo to switch.** The fill reintroduced ADR-0002's tint. The marker was rejected as an unwanted icon.
2. **Plane quads fed to `AxisDragManager` as "select-only" pick targets.** Reviewed before it shipped. It addressed the wrong half: refusing to start a *drag* changes nothing about event suppression, and `_downListener` consumes pointerdown at window-capture for any hovered target — so orbit and element selection died wherever a plane was visible. A second defect came free, since `Raycaster.intersectObjects` ignores material depth state and a band hidden behind a wall still won the click.
3. **A marker octahedron as the switch handle.** Built, then rejected: the band is geometry the plane already needs, so an extra object had nothing to do.

## Decision

**A cut plane draws an inset border band with an empty interior**, plus a crisp outline on its outer edge. Outer edge is ADR-0010's fitted rectangle; the band is inset by 4% of the rectangle's shorter side (`ClipperCursor/src/planeBand.ts`, a `Shape` with a rectangular hole). Model-relative, so the proportion holds from a small room to a site.

**Band and outline live in `GizmoAxis`'s overlay pass** with `depthTest: false`, as `SectionBox`'s twelve edges already do. This is not cosmetic: the band is also the click target, and because `Raycaster` ignores material depth, a depth-tested band could be invisible yet clickable. Drawing without depth makes what you see and what you can hit the same object, so the mismatch cannot exist — and it keeps the pick synchronous, where consulting `ClipAwareRaycaster` would have forced an `await` that `stopPropagation()` cannot survive.

**The band is the handle.** `canDrag(id)` is keyed on plane id, so a plane cannot offer both band and arrow. Therefore an **unselected** enabled plane offers its band (`canDrag` false, select-only), and the **selected** plane offers its arrow (`canDrag` true, drags). The band is drawn on both.

**A band click is consumed** (`preventDefault` + `stopPropagation`), like an arrow grab, so switching plane changes the selection and nothing else.

With nothing parented to `SimplePlane._planeMesh`, the carrier quad has no job: `plane.size`, `autoScale`, `PLANE_MESH_SCALE` and `hiddenMaterial` all went, and `plane.visible` is pinned `false`.

## Alternatives rejected

- **Feeding plane quads to `AxisDragManager` as select-only targets** — attempt 2 above. The invariant that replaced it is now stated in `_pickHandle`'s docstring: *every pick target must be a thin, deliberate handle, never a surface spanning the model.*
- **A marker octahedron** — attempt 3. Also: as a flat diamond it would have vanished edge-on, which is exactly when you most need to reach a plane you cannot otherwise see.
- **A full fill, on every plane or only the selected one** — attempt 1, and rejected again on the developer's direct correction: *not full*. It also keeps a model-sized pickable surface alive, which forecloses click-to-switch.
- **A thick outline with no inner edge** — simpler geometry, but with no inner boundary it reads as a fat blurry line rather than a strip of surface, losing the perspective cue that makes it look like a plane.
- **Band plus a whisper of fill (α ≈ 0.05)** for edge-on legibility — rejected twice: by ADR-0002 because any fill tints what is behind it, and here because it restores a model-sized pickable surface.
- **Screen-constant band thickness** — removes the sub-pixel floor and keeps the click target constant at any zoom. Rejected because the ring is model-sized, so it would need rebuilding as the camera moves; `GizmoAxis` rescales per frame only for small handles.
- **Fixed world-unit band width** — predictable, but swallows a small room and vanishes on a site model, the failure `FALLBACK_PLANE_SIZE = 10` already made inside a 40 m building.
- **Keeping band and outline in `world.scene` with occlusion-aware picking** — preserves ADR-0002's depth honesty and clipping by other planes. Rejected on a hard mechanic: `ClipAwareRaycaster` is async and `stopPropagation()` cannot be called after an `await`, so the exposure test would have to run on hover and be cached, and a stale cache is a mis-click.
- **Letting a band click through to the highlighter** — orbit would keep working on the band, but switching plane would clear the element selection. Correct while the target was model-sized; wrong once it is thin.
- **Consume on click, pass through on drag** (movement threshold, decide on pointerup) — the most forgiving option, and it would keep orbit working on the band. **Deferred, not dismissed:** it adds pointer-movement state to a manager shared with `SectionBox`. Revisit if losing orbit on the band grates in use.

## Consequences

- **ADR-0002 is superseded, but must not be deleted.** Its *Context* — the two measured failure modes — is the reason a pickable band is not a repeat of a pickable quad, and it is cited above. Of its five clauses: outline-only **amended**, no-pickable-surface **reversed**, gizmo-is-sole-handle **reversed**, outline-in-`world.scene` **reversed**, interaction-state-on-opacity **upheld**. Colour was already amended by [ADR-0009](0009-section-plane-gizmo-local-frame.md).
- ⚠️ **`AxisDragManager` now consumes pointerdown for select-only hits too** — the shape that broke orbit in attempt 2. It is safe *only* because every target is thin. Widening a pick target re-breaks it, which is why the invariant is written at the call site.
- **Bands draw through geometry in front of them, and are no longer clipped by other planes** (the overlay suspends clipping). Correct for a boundary annotation and what `SectionBox` already does, but it will read as wrong to anyone expecting an in-scene wire.
- **Orbit cannot start on a band.** A thin strip at the footprint perimeter, but non-zero.
- ⚠️ **Band width is model-relative, so it can fall below ~2px when zoomed far out** — and it is the click target. The screen-constant arrow on the selected plane and the Clip menu's plane list are the fallbacks.
- **A plane's appearance now spans two render passes** — band and outline in the overlay, and (per [ADR-0012](0012-section-fills-via-clipstyler.md)) fills in `world.scene`. Correct per part, harder to reason about as one thing.
- **Exactly one handle is pickable per plane**, which is what keeps `pickTargets`' picker→id mapping unambiguous. Offering both would put two pickers on one id.
