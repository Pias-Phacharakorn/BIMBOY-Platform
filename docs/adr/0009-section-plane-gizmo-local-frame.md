# ADR-0009: A cut plane's gizmo sits in the plane's own frame, and a cut that lines up with no world axis says so in grey

**Status:** Accepted
**Date:** 2026-08-05
**Area:** `docs/feature/bim-viewport-righttoolbars.md` § Section tool, § GizmoAxis
**Amends:** the outline-colour clause of [ADR-0002](0002-section-plane-outline-only.md) — the world-axis palette is **kept**, the *snap* that fed it is replaced. ADR-0002's other four decisions stand untouched.

## Context

`GizmoAxis` followed its target's *position* and deliberately ignored its *rotation*, and
`ClipperCursor` chose which arrow to make grabbable with `axisOf(plane.normal)` — a helper that
**snapped** an arbitrary normal to the nearest world axis. For an axis-aligned cut both were
correct and agreed. For a skewed cut they were not.

The result was that three of the four directions involved were right and the fourth — the only
one the user can actually grab — was wrong:

| | direction used |
|---|---|
| outline rectangle (a child of `plane.helper`) | true normal |
| the cut itself (`OBC.Clipper`) | true normal |
| drag motion (`AxisDragManager`, via `getAxis`) | true normal |
| **the grabbable arrow and its picker cylinder** | **snapped world axis** |

Measured, not estimated: a normal 20° off-axis drew its arrow 20.00° off the cut; 40° drew 40.00°;
the worst case is the (1,1,1) diagonal at **54.74°** (`arccos 1/√3`). A second defect fell out of
the same snap — at exactly 45° the choice flips, so a cut 44.9° off world Z wore a red outline on
the Z arrow and one at 45.1° wore a green outline on the X arrow, for two visually identical cuts.

This was never a regression. It is the gap the code comment on `GizmoAxis` had predicted in
writing: *"an `orientation: "world" | "follow"` option is the next thing a consumer will want."*

ADR-0002 could not be satisfied as written once a normal was off-axis. It promises the grabbable
arrow both *matches the plane's colour, which states the normal's dominant **world** axis* **and**
*slides along its **true** normal*. Those are the same sentence only while the two coincide.

## Decision

**`GizmoAxis` follows its target's full transform — position and rotation, unconditionally.** A
gizmo sits in its target's own frame. Scale stays excluded: a gizmo holds a fixed fraction of the
viewport height.

**The `"axes"` form becomes `"plane"`**, and always grabs local **+Z**. `OBC.SimplePlane` builds
its helper with `helper.lookAt(this.normal)`, and `Object3D.lookAt` aims local +Z at its target, so
+Z *is* the cut direction. That vendor coupling is pinned to a single `PLANE_NORMAL_AXIS` constant
rather than spread as a `"z"` literal at the call site. `grabAxis` becomes optional — required only
by `"arrow"`, which `SectionBox` uses and which is unchanged.

**Colour keeps naming a world axis — X green, Y blue, Z red — and a direction that names none is
grey.** `AXIS_COLORS` is unchanged and remains the single palette. What changes is that `axisOf()`
**stops snapping**: it returns the world axis a direction runs along within `AXIS_ALIGNMENT_DOT`
(0.9998, ≈1.15°), or **`null`**, which callers render as `OFF_AXIS_COLOR`. The snap was the defect —
it could not say "this one is skewed", so it reported a 44° cut as axis-aligned and picked a
grabbable arrow to match.

**`OFF_AXIS_COLOR` is light grey (`0xcccccc`), not black.** Achromatic is the intent — no hue, no
axis — but the viewport background is a dark gradient (`oklch(21%…)` → `oklch(9%…)`) and gizmos
render `depthTest: false` over open sky as often as over geometry, so black is invisible in exactly
the place these gizmos float.

**Both the arrow and the outline read that one rule applied to the same direction**, so they cannot
disagree: the gizmo's arm colours come from `framePalette(followWorldQuaternion)` and the outline
from `colorOf(plane.normal)`.

**The two inert arms are coloured by their own world axis too**, which is what restores the
pre-ADR-0009 look: on a square cut all three arms land on world axes and the gizmo reads
green/blue/red exactly as before. It also makes the arms informative on a skewed cut — a wall raked
in *plan* is still vertical, so its vertical arm stays **blue** while the other two grey out. Only a
cut skewed in every direction greys wholly.

**`framePalette` is built by the caller, not the gizmo.** A gizmo is drawn in local space and cannot
know where its rotation aims each arm, so `ClipperCursor` builds the palette from the helper's world
quaternion and passes it to `buildAxisGizmo`. `SectionBox` passes none and defaults to
`AXIS_COLORS`, which is already right — a box face's axis *is* a world axis.

**The two in-plane arms are inert**, drawn at `IN_PLANE_LENGTH_RATIO` (0.45) so the normal arrow
reads ~3× longer. They say which surface is being cut; they do not rotate it.

**Rotation is taken from the follow target, not from the normal.** `applyFollowTransform` copies
`follow.getWorldQuaternion()`. The outline is a child of `_planeMesh` under that same helper, so
arrow and outline inherit **one** transform.

## Alternatives rejected

- **Add the predicted `orientation: "world" | "follow"` option** — genuinely about four lines, and
  the obvious reading of the comment. Rejected because after this change *nothing* wants `"world"`:
  `SectionBox`'s follow anchors are bare `Object3D`s that only ever receive `position.copy()`, so
  their identity quaternion makes unconditional rotation-following a **no-op** for the box. The
  option would have shipped a knob with one value ever used.
- **Keep world-axis colour and point only the arrow along an arbitrary direction vector** — the
  first recommendation made during the grill. Preserves ADR-0002's colour language, but leaves
  axis-aligned and skewed planes drawn by two different rules, and does not match the reference.
- **Snap the cut normal itself to the nearest world axis** — every existing invariant survives and
  `GizmoAxis` needs no change at all. Rejected because it makes skewed sections impossible (no
  raking wall, no non-orthogonal grid) and the cut would silently disagree with the clicked face by
  up to 54.74°.
- **Pass the exact normal in so the arrow is independently correct** — *more* accurate, and wrong
  for it. A plan cut's helper frame is legitimately 0.00573° off its own normal (three.js nudges
  `_z.z += 0.0001` when the normal is parallel to `up`, which is the degenerate `lookAt` case), so
  an exactly-correct arrow would **disagree with the outline that inherits the nudge**. Agreement is
  the goal; sharing one transform guarantees it, and survives OBC changing its `lookAt` convention.
- **Role-based colour: normal always blue, in-plane arms always red and green** — built and reviewed
  first, then reversed on the developer's call. It reads identically on every plane and matches the
  Navisworks reference 1:1, but it throws away information the old palette carried for free: with
  hue fixed by role, an outline can no longer tell you a cut is a level cut. Grey-for-skewed keeps
  the orientation signal *and* stops it lying, which is strictly more than either scheme alone.
  (It also made every outline blue, deleting the colour table from `bim-viewer.md` — a bigger
  documentation loss than the defect warranted.)
- **Pure black for the off-axis colour** — the developer's first choice, and the natural reading of
  "no colour, no axis". Rejected on a measurement rather than taste: the viewport background bottoms
  out at `oklch(9% 0.014 255)` and the gizmo renders on top of it with `depthTest: false`, so a black
  arrow would be near-invisible against the sky in the very screenshot that reported this bug. White
  fails the mirror-image way against pale concrete, since the model is mostly light grey — an
  achromatic colour can only differ in lightness, so it must vanish against one or the other. Light
  grey is the compromise that survives both, and keeps clear of the pure-white centre diamond.
- **A fourth saturated hue (magenta or cyan) for off-axis** — would read unmissably against both
  backgrounds, since it differs in *hue* rather than lightness. Rejected as louder than the thing
  deserves: a skewed cut is unusual, not an error, and magenta shouts. Achromatic says "no axis here"
  without implying something is wrong.
- **Snapping tolerance tighter than ~1°** — rejected because the failure modes are asymmetric. Too
  tight and an orthogonal wall whose triangle normals carry float noise reads as skewed and greys
  out, so the *common* case looks broken; too loose and a wall raked by a degree wears an axis
  colour, which is a lie nobody can see because a degree is visually square. Float noise is ~1e-6
  (≈0.00006°), so 1.15° clears it by four orders of magnitude while still flagging any deliberate
  rake.
- **Importing `coplanarFace.ts`'s 0.9998 rather than declaring our own** — same number, and it would
  advertise the shared magnitude. Rejected because the two answer different questions ("is this a
  world axis?" vs "are these the same plane?") across component boundaries, and either should be
  free to move without dragging the other.
- **Replace the centre diamond with a sphere or screen-facing dot** — the diamond now lies in the
  gizmo's local XY, i.e. *in the cut surface*, so it vanishes edge-on, inheriting the blind spot
  ADR-0002 already records for the outline. Kept as a quad anyway: it now honestly *is* a scrap of
  the cut plane, and the arrow you grab stays visible at every angle.
- **Rotation handles on the in-plane arms** (what Navisworks does) — a new feature, not this fix.
  `AxisDragManager` only slides along one axis; rotation needs a new drag mode, a new
  `getAxis`/`onDrag` contract and per-frame normal re-derivation.
- **Re-implementing the follow transform inside the check script** — how the regression check was
  first written. It passed while asserting nothing about production: the per-frame loop lives in a
  closure on `renderer.onAfterUpdate` and needs a `World` plus WebGL, so a script that duplicated
  the arithmetic would stay green even if the loop stopped doing it. `applyFollowTransform` was
  extracted so both go through one function.

## Consequences

- **Every axis-aligned cut looks exactly as it did before** — same palette, same three arm colours,
  the grab arrow now merely longer. The change is invisible on square models, which is most of them.
- **Colour gained a fourth state, and with it the ability to be honest.** Grey is new information the
  old scheme could not express: *this cut is not down any world axis*. The 45° flip is gone — near
  45° a cut is skewed, so it greys out rather than picking red-or-green on a coin toss.
- **The arms are informative, not decoration.** A wall raked in plan keeps its blue vertical arm, so
  the gizmo distinguishes "skewed in plan but still vertical" from "skewed in every direction".
- **A skewed cut is now visually quieter than a square one.** Grey recedes where red/green/blue
  advance, which is arguably backwards — the unusual case is the one drawing less attention. Accepted:
  the alternative is a loud hue implying an error, and a skewed cut is unusual, not wrong.
- **`AXIS_ALIGNMENT_DOT` is a judgement call that will need revisiting if models change.** It assumes
  BIM geometry is authored orthogonally and float noise is ~1e-6. ⚠️ It holds today partly because the
  **GIS rotation never touches the BIM model** — `GisLayer3d.updateMapPosition()` reorients the
  Google/OSM tiles to meet the model, not the reverse, and `fragments-manager.ts` ignores shared
  coordinates. If a site rotation is ever applied to the *model*, every wall becomes off-axis and every
  cut greys out. That would not be a bug in this ADR, but it would make the feature useless and is the
  first thing to check if grey starts appearing everywhere.
- **A gizmo will now inherit any rotation its follow target picks up.** `SectionBox` is safe because
  its anchors are never rotated, but that is a property of the caller, not a guarantee of the API. A
  future consumer that follows a rotating object gets a rotating gizmo, which may not be wanted —
  the `orientation` option rejected above is the answer if one ever appears.
- **`GizmoAxis`'s name drifts further.** It is now neither only-gizmos (it hosts overlays) nor
  axis-aligned. Renaming to `SceneOverlay` reaches `ClipperCursor`, the guide, ADR-0002, ADR-0005 and
  this record for no behaviour change; still not worth it, now recorded twice.
- **`scripts/check-gizmo-frames.mjs` locks this down** with no new dependency, reusing Vite's SSR
  loader as `playwright.config.ts` reuses `loadEnv`. ⚠️ **Its tolerance is 0.01°, not 0** — see the
  0.00573° nudge above. A tighter assertion fails on the app's most common cut for a non-bug.
