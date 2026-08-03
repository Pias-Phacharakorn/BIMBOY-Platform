# ADR-0002: Section planes are outline-only and never pickable; the gizmo is the sole handle

**Status:** Accepted
**Date:** 2026-08-03
**Area:** `docs/feature/bim-viewer.md` § Section tool

## Context

The section tool originally drew nothing at all: `ClipperCursor` zeroed the opacity of every mesh under `plane.helper`, so a cut plane was invisible and `SimplePlane`'s own `TransformControls` arrow was the only way to move it. Users could not see where their cuts were.

The obvious fix — un-hide `SimplePlane`'s quad and make it draggable — **was built and shipped**, then reversed within a day of use. Two things went wrong, and neither was predictable from the design:

1. **The quad fought element selection for clicks.** The quad spans the model, so it sits under the cursor over most of the viewport. Occlusion-aware arbitration was added (raycast the quad, then compare depth against the async fragment raycast, filtering hits the clipper had already cut away since fragment raycasting ignores clipping planes) and it worked as specified — but a plane that is grabbable *anywhere it is visible* is still grabbable across most of the screen, and selecting an element became a matter of finding a gap.
2. **A translucent sheet over the model did not read as a plane in space.** At any usable alpha it tinted the geometry behind it; low enough not to, and it was invisible edge-on anyway.

## Decision

A cut plane renders as a **bare rectangle outline** — a `LineLoop` child of `SimplePlane`'s quad, with the quad's material set to `visible: false` so it survives only as the thing that sizes and orients the outline. The plane has **no pickable surface at all**.

The **only** drag handle is one arrow on a `GizmoAxis` gizmo: the arrow matching the plane's colour, drawn ×1.5, wrapped in an invisible cylinder, yellow while hovered or dragged. `SimplePlane`'s default arrow is permanently suppressed. Dragging it slides the plane along its true normal.

Outline colour states the normal's dominant world axis — **X green, Y blue, Z red**, which *inverts* the three.js/Blender convention. Interaction state rides on opacity, not hue.

## Alternatives rejected

- **Grabbable translucent quad** — built, shipped, reversed. See Context. The occlusion arbitration it needed (async depth compare per hover + a clipped-hit filter) is also the single largest chunk of code the reversal deleted.
- **Extending the `TransformControls` picker to the quad** (OBC's own `_arrowBoundBox` trick) — nearly free to implement, and it would have made a model-sized invisible mesh swallow `pointerdown` across the viewport, killing orbit as well as selection.
- **A modal "Edit sections" toggle** gating whether planes are pickable — unambiguous, but it is a mode to remember entering and leaving, and it does not make the plane readable, only reachable.
- **Keeping a whisper of fill** (α 0.04–0.06) for edge-on legibility — any fill tints what is behind it, which is the thing being reacted against.
- **Three.js axis colours (X red, Y green, Z blue)** — familiar to anyone arriving from three.js or Blender, but the developer's existing section-plane scheme is the inverted one, and the gizmo arrows and the plane outline reading from one table is what lets colour name the plane, the arrow *and* the drag direction at once. Two tables would let them drift.
- **Carrying interaction state in line weight** — not available: `LineBasicMaterial.linewidth` is ignored by `WebGLRenderer`, so it would need `Line2` fat-line geometry from three's examples. Not worth a new dependency for a hover cue.

## Consequences

- Element selection is safe by construction, not by arbitration. Nothing this component owns is pickable except a small gizmo handle, so there is no depth comparison to get wrong and no per-hover raycast.
- **The gizmo is now a single point of failure.** It is the only way to move a cut. It renders with `depthTest: false` and is sized as a fraction of viewport height so it cannot shrink away — but if it is ever hidden or mis-scaled, a plane is stranded with no fallback handle, where previously there were three.
- A 1px outline is easy to lose against a busy wireframe model, and gives no cue when sighted edge-on. Opacity is the only weight control available.
- The colour mapping will be read wrong by anyone expecting the three.js convention. It is documented in `axis.ts` and in the guide; expect the question to recur.
- The outline lives in `world.scene`, so it depth-tests correctly against the model **and** is clipped by other enabled planes. Immunity would require the overlay scene, which would also make it immune to depth — `WebGLRenderer.clippingPlanes` is global with no per-material opt-out, so the two properties cannot be separated.
- Reversing this would mean re-adding the fill, the pointer arbitration and the occlusion filter that were deleted — cheap to write again, but the reason they lost is not visible in the code that remains, which is why this record exists.
