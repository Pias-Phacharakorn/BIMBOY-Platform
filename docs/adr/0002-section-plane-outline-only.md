# ADR-0002: Section planes are outline-only and never pickable; the gizmo is the sole handle

**Status:** **Superseded by [ADR-0011](0011-clickable-border-band-cut-planes.md)** — colour clause previously amended by [ADR-0009](0009-section-plane-gizmo-local-frame.md)
**Date:** 2026-08-03
**Area:** `docs/feature/bim-viewer.md` § Section tool

> ⚠️ **Superseded — but do not delete, and read the Context before proposing a pickable plane again.**
> [ADR-0011](0011-clickable-border-band-cut-planes.md) reverses four of the five clauses below: a cut
> plane now draws a **border band**, that band **is pickable**, it is therefore **not** the gizmo
> alone that is a handle, and band and outline moved out of `world.scene` into the overlay pass. Only
> "interaction state rides on opacity, not hue" survives intact.
>
> **The Context section below is why this record stays.** It documents the two *measured* failure
> modes of a pickable translucent quad, and ADR-0011 cites them: a border band is safe precisely
> because it voids the premise of the first one ("grabbable anywhere it is visible" only spans the
> screen if the plane is visible everywhere). An attempt to make full plane quads pickable was made
> again on 2026-08-05 and caught in review — because this file existed.

> ⚠️ **Historical note, from when only the colour clause had been amended.** Kept for the ADR-0009
> reasoning it carries; its claim that the other clauses are unchanged is no longer true — see above.
> Outline-only, not pickable at all, one arrow as the
> sole handle, and interaction state on opacity rather than hue are all unchanged. The
> **X green / Y blue / Z red** palette is unchanged too. What [ADR-0009](0009-section-plane-gizmo-local-frame.md)
> replaces is the word *"dominant"*: colour was picked by **snapping** the normal to its nearest
> world axis, which meant a skewed cut was painted as though it were square — and the same snap
> chose the grabbable arrow, putting it up to 54.74° off the cut. A direction that lines up with no
> axis is now **grey** instead of rounded.

## Context

The section tool originally drew nothing at all: `ClipperCursor` zeroed the opacity of every mesh under `plane.helper`, so a cut plane was invisible and `SimplePlane`'s own `TransformControls` arrow was the only way to move it. Users could not see where their cuts were.

The obvious fix — un-hide `SimplePlane`'s quad and make it draggable — **was built and shipped**, then reversed within a day of use. Two things went wrong, and neither was predictable from the design:

1. **The quad fought element selection for clicks.** The quad spans the model, so it sits under the cursor over most of the viewport. Occlusion-aware arbitration was added (raycast the quad, then compare depth against the async fragment raycast, filtering hits the clipper had already cut away since fragment raycasting ignores clipping planes) and it worked as specified — but a plane that is grabbable *anywhere it is visible* is still grabbable across most of the screen, and selecting an element became a matter of finding a gap.
2. **A translucent sheet over the model did not read as a plane in space.** At any usable alpha it tinted the geometry behind it; low enough not to, and it was invisible edge-on anyway.

## Decision

A cut plane renders as a **bare rectangle outline** — a `LineLoop` child of `SimplePlane`'s quad, with the quad's material set to `visible: false` so it survives only as the thing that sizes and orients the outline. The plane has **no pickable surface at all**.

> ⚠️ **Both halves of this paragraph are reversed by [ADR-0011](0011-clickable-border-band-cut-planes.md).** A plane now draws a **border band** with an empty interior, and **that band is pickable** — clicking it switches sectioning to that plane.
>
> That is not this decision being forgotten. Making the *full quad* pickable was attempted again on 2026-08-05 and caught in review: feeding it to `AxisDragManager` made the capture-phase `stopPropagation` fire wherever a plane was visible, killing camera orbit *and* element selection — the failure mode recorded below, reproduced. What changed is the **area**: a band is visible only around the footprint perimeter, so "grabbable anywhere it is visible" stops meaning "most of the screen". The rule that replaced this clause now lives at `AxisDragManager._pickHandle`: *every pick target must be a thin, deliberate handle, never a surface spanning the model.*

The **only** drag handle is one arrow on a `GizmoAxis` gizmo: the arrow matching the plane's colour, drawn ×1.5, wrapped in an invisible cylinder, yellow while hovered or dragged. `SimplePlane`'s default arrow is permanently suppressed. Dragging it slides the plane along its true normal.

Outline colour states the normal's dominant world axis — **X green, Y blue, Z red**, which *inverts* the three.js/Blender convention. Interaction state rides on opacity, not hue.

> ⚠️ **Amended by [ADR-0009](0009-section-plane-gizmo-local-frame.md): read "dominant" as "within
> ~1.15°, else grey".** Snapping the normal to its *nearest* axis also chose the grabbable arrow,
> which put the arrow up to 54.74° off the actual cut. The palette here is unchanged; a normal that
> lines up with no world axis now takes `OFF_AXIS_COLOR` (light grey) rather than being rounded to
> whichever axis it happened to be closest to. "Interaction state rides on opacity, not hue" is
> untouched.

## Alternatives rejected

- **Grabbable translucent quad** — built, shipped, reversed. See Context. The occlusion arbitration it needed (async depth compare per hover + a clipped-hit filter) is also the single largest chunk of code the reversal deleted.
- **Extending the `TransformControls` picker to the quad** (OBC's own `_arrowBoundBox` trick) — nearly free to implement, and it would have made a model-sized invisible mesh swallow `pointerdown` across the viewport, killing orbit as well as selection.
- **A modal "Edit sections" toggle** gating whether planes are pickable — unambiguous, but it is a mode to remember entering and leaving, and it does not make the plane readable, only reachable.
- **Keeping a whisper of fill** (α 0.04–0.06) for edge-on legibility — any fill tints what is behind it, which is the thing being reacted against.

  > ✅ **This bullet was tested twice and held both times.** A conditional fill (α 0.22 on the selected plane only) was built on 2026-08-05 and abandoned; so was a permanent one. The premise is simply true — any fill tints what is behind it. [ADR-0011](0011-clickable-border-band-cut-planes.md) escapes it by changing the *area* rather than the alpha: a border band around the perimeter reads as a surface because it foreshortens, while covering almost nothing. Not a counter-example to this bullet, a way around it.
- **Three.js axis colours (X red, Y green, Z blue)** — familiar to anyone arriving from three.js or Blender, but the developer's existing section-plane scheme is the inverted one, and the gizmo arrows and the plane outline reading from one table is what lets colour name the plane, the arrow *and* the drag direction at once. Two tables would let them drift.

  > ✅ **Still holds, and [ADR-0009](0009-section-plane-gizmo-local-frame.md) kept it.** A role-based
  > palette (normal always blue) was built and then reversed for exactly the reason argued here: one
  > table, read by both the arrow and the outline, is what stops them drifting *and* what lets colour
  > state orientation at all. ADR-0009 adds a fourth value (`OFF_AXIS_COLOR`) to the same table rather
  > than introducing a second one.
- **Carrying interaction state in line weight** — not available: `LineBasicMaterial.linewidth` is ignored by `WebGLRenderer`, so it would need `Line2` fat-line geometry from three's examples. Not worth a new dependency for a hover cue.

## Consequences

- Element selection is safe by construction, not by arbitration. Nothing this component owns is pickable except a small gizmo handle, so there is no depth comparison to get wrong and no per-hover raycast.
- **The gizmo is now a single point of failure.** It is the only way to move a cut. It renders with `depthTest: false` and is sized as a fraction of viewport height so it cannot shrink away — but if it is ever hidden or mis-scaled, a plane is stranded with no fallback handle, where previously there were three.
- A 1px outline is easy to lose against a busy wireframe model, and gives no cue when sighted edge-on. Opacity is the only weight control available.
- The colour mapping will be read wrong by anyone expecting the three.js convention. It is documented in `axis.ts` and in the guide; expect the question to recur.
- The outline lives in `world.scene`, so it depth-tests correctly against the model **and** is clipped by other enabled planes. Immunity would require the overlay scene, which would also make it immune to depth — `WebGLRenderer.clippingPlanes` is global with no per-material opt-out, so the two properties cannot be separated.
- Reversing this would mean re-adding the fill, the pointer arbitration and the occlusion filter that were deleted — cheap to write again, but the reason they lost is not visible in the code that remains, which is why this record exists.

  > ✅ **This consequence did its job, and is the case study for why the ADR format earns its keep.** On 2026-08-05 exactly that reversal was attempted — a fill on every plane plus a select-only pick channel feeding the plane quads into `AxisDragManager`. It was indeed cheap to write. It was caught **in review rather than in use**, because this record existed to be checked against. The request was then satisfied a different way entirely: not by re-litigating pickability, but by shrinking what is visible until the objection no longer applied. → [ADR-0011](0011-clickable-border-band-cut-planes.md).
