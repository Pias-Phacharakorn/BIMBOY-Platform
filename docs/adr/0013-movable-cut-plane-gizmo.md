# ADR-0013: The cut-plane gizmo spawns where you clicked, and slides inside the cut

**Status:** Accepted
**Date:** 2026-08-05
**Area:** `docs/feature/bim-viewport-righttoolbars.md` § Section tool, § GizmoAxis

## Context

The reported symptom — *"the gizmo doesn't appear where I clicked, it appears in the middle"* — was
the code working as designed. `ClipperCursor`'s `_anchors` docstring said so outright: the anchor
sat *"at the middle of that plane's outline rather than at the point the user clicked — the same
reason `SectionBox` anchors its arrows at face centres."*

Reversing it is a **UX call, made by the developer against a stated recommendation** to keep
centre-anchoring. What makes this an ADR rather than a preference flip is the second half: the
gizmo also becomes **movable**, which is the drag mode
[ADR-0009](0009-section-plane-gizmo-local-frame.md) deferred *by name* — *"`AxisDragManager` only
slides along one axis; rotation needs a new drag mode, a new `getAxis`/`onDrag` contract."* The same
sentence applies to 2-DOF in-plane translation, and this is where that contract change was made.

Reviewed via `/fable-advisor` **before** implementation. Four things changed as a result and each is
marked ⚠️ below.

**Three measurements that shaped the design**, read off the code rather than guessed:

- **The click point needed no new maths.** `_createPlane` already passes the clicked point as
  `createFromNormalAndCoplanarPoint`'s coplanar point, so `plane.helper.position` *is* the click
  point. "Spawn where I clicked" is the offset `(0, 0)` — the feature is the **removal** of the
  `centerOffset` term, not the addition of a spawn rule.
- **The centre diamond is entirely inside the arrow's grab cylinder.** Pick radius `0.525`
  (`GIZMO_PICK_RADIUS 0.35 × GRAB_AXIS_EMPHASIS 1.5`); the diamond's corners reach `0.424`
  (`GIZMO_DIAMOND_SIZE 0.6 × √2 / 2`). `_pickHandle` sorts by distance, so a centre handle could
  **never** win a raycast unaided.
- **Rebuilding the fill after an in-plane drag would be redundant, not wrong.** `ClipStyler.create()`
  holds the *live* `THREE.Plane`, so it would recompute a cut that never moved — a full
  `ClipEdges.update()` per reposition.

## Decision

**The anchor spawns at the click point and carries a per-plane owned offset**, and
**`AxisDragManager` learns modes rather than gaining a sibling.**

- The offset is explicit state (`_gizmoOffsets`, a `THREE.Vector2`), not a moved `Object3D`:
  `onDrag` subtracts it to recover the helper's position, and there is nothing else to derive it
  from once it is no longer the fitted centre. Stored in the **helper's local X/Y**, invariant under
  sliding the cut along its own normal — the only thing the arrow drag does.
- Grabbing the **centre diamond** slides the gizmo anywhere in the cut surface: free 2-DOF, one
  gesture. The diamond quad itself is the pick target, preserving *what you can grab is what you can
  see*. ⚠️ No `dot(viewDir, normal)` guard is needed — not because a `PlaneGeometry` raycast
  degrades gracefully (it is exact triangle intersection and fails only at a ray exactly parallel to
  the plane), but because `_begin` sets `world.camera.enabled = false`, so the view cannot rotate
  toward edge-on once a session has started.
- `pickTargets` entries gain `mode?: "axis" | "inPlane"`; a new **optional** `onInPlaneDrag(id,
  position)` receives the result. **`SectionBox` needs zero changes.** ⚠️ "Reused verbatim" describes
  the *contract* — `_begin`/`_update` genuinely branch: `"inPlane"` builds the literal cut plane and
  skips the `dot(axis)` projection entirely.
- ⚠️ **`_pickHandle`'s priority pass is scoped per id**, not globally — an id's `"inPlane"` hit
  preempts *that same id's* `"axis"` hit, then results merge back into one nearest-hit ordering. A
  global override is correct today only *by accident* (exactly one gizmo is ever pickable); land
  multi-select and a farther plane's diamond silently steals a nearer plane's arrow.
- ⚠️ **The clamp is split by moment: free while dragging, clamped on refit.** `outlines.onFitChanged`
  already recomputes the footprint, so clamping there is nearly free and closes the orphan case (an
  offset outliving a footprint that shrank) without a clamp fighting the pointer.
- ⚠️ **`ClipperPlaneState.gizmoMoved` is set from a dirty bit inside `onInPlaneDrag`**, not from the
  `draggingId → null` transition — the latter would light the reset button after a press-and-release
  that moved nothing. It is the one deliberate breach of *"drag state never reaches React"*, so the
  per-plane reset button in `ToolbarClip` can disable itself.
- **The offset maths lives in `src/gizmoOffset.ts`** — added during implementation, not planned.
  `ClipperCursor` needs a `Components`, a `World` and a viewport to construct, so nothing inside it
  is reachable headlessly; a check script re-implementing the arithmetic beside it would keep
  passing if production stopped doing it. That is the exact failure ADR-0009 records under
  *"Re-implementing the follow transform inside the check script"*.

## Alternatives rejected

- **Keep centre-anchoring; add a highlight pulse on the newly placed band** — the recommendation
  made at the time, addressing the plausible underlying need ("I lose track of which plane I just
  placed") without touching the drag contract at all. Rejected by the developer on the direct
  reading of the request: the arrow should be where you pointed.
- **Two 1-DOF drags on the inert in-plane arms** — the cheapest option on the table: reuses
  `getAxis`/`onDrag` with **no new drag mode**, no degenerate case, and gives the arms a job ADR-0009
  says they lack. Rejected because placing the gizmo diagonally then takes two gestures, and the arms
  sit barely outside the arrow's grab cylinder (tip `0.63` vs radius `0.525`) so they would have
  needed pick surgery anyway.
- **Carve a central gap in the arrow's grab cylinder** — physically disjoint pick volumes, no
  ordering rule a later edit can violate. Rejected for cost: two cylinders merged to keep `picker` a
  single `THREE.Mesh`, a new `three/examples` import for `mergeGeometries` — and the visible arrow
  still runs through the gap, breaking *what you grab is what you see* for the arrow instead.
- **Both the gap and the priority pass** — belt and braces. Rejected because the second mechanism is
  unreachable while the first works, so it rots untested.
- **A modifier key (Alt-drag the arrow)** — smallest change imaginable. Rejected on three counts:
  undiscoverable, Alt is an OS/browser menu modifier on Windows, and it is still a drag *along the
  normal*, so it cannot move the gizmo within the plane at all.
- **Clamp the drag itself to the fitted rectangle** — the original recommendation; guarantees the
  arrow always visibly belongs to a band. Rejected on the developer's call: free placement is the
  point, and a clamp fighting the pointer is the wrong place to enforce tidiness.
- **No clamp anywhere** — what this specified before review, with the reset button as sole recovery.
  Rejected because the orphan case is concrete and cheap to prevent at the moment the footprint is
  already being recomputed; leaving it to a button made a rescue load-bearing that should be a
  fallback.
- **Clamp on refit only when the gizmo is *fully* outside the new rectangle** — intervenes only when
  genuinely broken. Rejected as a threshold to define and defend for a narrower guarantee at
  identical accessor cost.
- **A second `AxisDragManager`-shaped class** — each class doing one kind of drag, `SectionBox`
  untouched. Rejected as unworkable, not merely inelegant: two capture-phase `pointerdown` listeners
  on `window` race for the same click, both toggle `world.camera.enabled` so whichever ends second
  re-enables the camera mid-drag, and hover state plus the `grab` cursor split across two owners —
  needing a coordinator, which is what `AxisDragManager` already is.
- **Thread `mode` through every callback** (`getAxis(id, mode)`, `onDrag(id, position, mode)`) —
  symmetric, one entry point, `SectionBox` still compiles. Rejected because `onDrag`'s `position`
  would mean two different things depending on a sibling argument, and every handler would open with
  a mode switch including the two that do not care.
- **Per-target callbacks instead of one optional `onInPlaneDrag`** — `pickTargets()` runs on every
  `pointermove` during hover, so a closure per target per frame is real GC churn for no gain.
- **Stay mode-blind, one `highlighted` flag for the whole gizmo** — zero new API. Rejected because
  hovering the arrow would advertise the diamond as grabbable and vice versa, and it keeps the
  redundant per-reposition `ClipEdges.update()`.
- **Put the offset itself on `ClipperPlaneState`** instead of a boolean — opens a numeric-entry path
  later. Rejected as a field built for a feature nobody asked for, in a type whose docstring says it
  is a dropdown row.
- **Add Vitest** — deferred again, for ADR-0009's own reason: it was deferred to a separate branch
  precisely so a gizmo change would not carry a tooling change, and this is a gizmo change.

## Consequences

- **A ~37px region at the arrow's middle no longer moves the cut.** Honest, because the diamond is
  *drawn* there — but it is felt when nudging a cut at low zoom.
- ⚠️ **Group D of `scripts/check-gizmo-frames.mjs` found a defect in itself, not in the code — the
  one ADR-0009 predicted.** Its first draft asserted the offset was perpendicular to the **exact**
  `plane.normal`, and failed only on plan cuts with error scaling linearly with offset magnitude
  (`1e-4 × offset`). That is three's degenerate-`lookAt` nudge `_z.z += 0.0001`, leaving a plan cut's
  frame permanently **0.00573°** off its own normal. The correct invariant is perpendicularity to the
  frame's own **local +Z** — the direction the gizmo and the outline share — asserted at `1e-9`, with
  the deviation from the exact normal separately bounded so a genuinely broken conversion is still
  caught by orders of magnitude.
- **`onDrag`'s exactness claim survives free placement, structurally.** Drift measured `0.0e+0` on
  every frame/offset pair including a 250-unit offset on a diagonal cut, because `_syncAnchor` builds
  the anchor and `onDrag` subtracts it using the **same** function on the **same** frame, so the
  offset cancels identically rather than approximately.
- ⚠️ **A pre-existing, immaterial subtlety, recorded so it is not rediscovered as a bug.**
  `planeFit`'s invariance holds exactly for sliding along the frame's local +Z, but a real drag
  slides along `getAxis` = the *exact* normal, differing by that same 0.00573° on plan cuts. A
  plan-cut drag therefore shifts the fitted rectangle by ~`1e-4` of the distance dragged — **under
  4 mm over a 37.5 m drag**. Nothing depends on it, since the clamp only runs on a refit.
- **`ClipperOutlineManager.centerOffset()` was deleted** with both its callers. `centerX`/`centerY`
  stay — `_applyFit` still positions the band and outline with them — and `extent()` was added for
  the refit clamp.
- ⚠️ **Unverified at runtime:** whether a gizmo sitting far from its band reads as orphaned *within*
  a session (the refit clamp only fires on model load/unload), and whether that clamp is ever *felt*
  as the gizmo silently moving on a load — which is the specific thing the developer rejected when a
  clamp was proposed for the drag itself.
