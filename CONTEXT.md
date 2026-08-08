# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

## Surface measure comes back, rebuilt on worker geometry

_Staged 2026-08-04 (`/grill-with-docs`). Earmarked for **ADR-0008** once merged — the
rejected alternatives below are the kind that get re-litigated._

**Why this is a decision, not a bugfix.** The Surface tool was never merely unfinished. Its
engine (`setup/src/surface-measure-cursor.ts`, 630 lines under `@ts-nocheck`) walks
main-thread `mesh.geometry` triangles to find the coplanar face. [ADR-0003](docs/adr/0003-worker-side-snapping-over-cpu-picking-meshes.md)
deleted `MeasurePicking` and left `world.meshes` empty for the app's lifetime, so there is no
such geometry to walk. Two concrete symptoms of that drift:

- It reads `result.faceIndex` (singular). FRAGS `RaycastResult` exposes **`faceIndices`**.
  Every hit now takes the fragment branch, so the seed is `undefined ?? 0` — the BFS always
  starts from triangle 0 of a batched instanced geometry, i.e. garbage for any input.
- `ToolbarMeasure.tsx` imports `SurfaceMeasureButton` but never renders it; a hardcoded
  disabled "Surface / Soon" `<div>` sits in its place. `SurfaceMeasureList` *is* rendered but
  unreachable, since nothing can set `activeType` to `"surface"`.

**Decisions taken:**

| # | Decision |
|---|----------|
| 1 | **Promote to `bim-components/SurfaceMeasureCursor/`** (`SurfaceMeasureEngine.ts`, `coplanarFace.ts`, `types.ts`), typed, no `@ts-nocheck`. It joins the measure family in *conventions only* — `MeasureCursorDescriptor` is built around `MeasurerLike` (an `OBF.Measurement` with `create()`/`endCreation()`), and Surface has no OBF measurer, so `MeasureCursorEngine` cannot be reused. |
| 2 | **Geometry comes from `model.getItemsGeometry([localId])`** per hovered item — `MeshData` carries `positions`/`indices`/`transform`, and world space needs `geomData.transform` then `model.object.matrixWorld`. Never resurrect per-instance picking meshes. |
| 3 | **Cache per item, fetch gated on pointer settle.** Key `${modelId}:${localId}`, bounded LRU (~32 items), plus a face cache per seed triangle. Cache hits run the BFS immediately so re-hovering feels instant. Invalidate via `fragments.list.onItemDeleted`, as `ClipperOutlineManager` and `MiniMap` already do. |
| 4 | **"One surface" = connected ∧ same plane ∧ same side.** Weld vertices by quantised position (the file's own `vertKey`, currently defined and never called), require *signed* normal agreement `≥ 0.9998`, and require equal plane offset `≤ 1e-4`. |
| 5 | **Seed the BFS geometrically** — locate the triangle containing the hit `point` whose normal agrees with the hit, using the welded soup we already cache. `RaycastResult.facePoints`/`faceIndices` semantics are not pinned down in the vendored docs, and `normal` is optional. |
| 6 | **`SurfaceMeasure.tsx` reaches parity with its siblings** — typed, `@ts-nocheck` dropped. It is the only file in `react-components/components/` carrying it; `LengthMeasure.tsx` and `AreaMeasure.tsx` are both already typed. |

⚠️ **Two correctness bugs are fixed during the port, not carried across.** Both change
reported numbers, so a revived-but-verbatim engine would have looked plausible and measured
wrong:

- `Math.abs(tn.dot(seedNormal))` accepts **anti-parallel** normals, and nothing checks plane
  offset — only parallelism. Measuring one side of a wall swallowed the far side, roughly
  doubling the area. Decision 4 is what closes this.
- Adjacency keyed on **buffer index** rather than position. IFC geometry routinely duplicates
  vertices at the same coordinate for per-face normals; where it does, neighbouring coplanar
  triangles share no index and the BFS halts at the seed triangle. Decision 4 closes this too.

**Alternatives rejected** (for the ADR):

- **Resurrect `MeasurePicking`** — the exact thing ADR-0003 deleted for dropping the
  framerate on hover alone. One `THREE.Mesh` per geometry instance is 10k–100k meshes on a
  real IFC. Fetching one item on demand is the same data at 1/50,000th the cost.
- **Trust `RaycastResult.facePoints` as the face** — tempting, and would delete the BFS
  outright. Rejected because the docs say only "the points of the raycasted face" without
  saying whether that is one triangle or the whole coplanar region. Worth re-testing later:
  if it *is* the face, `coplanarFace.ts` becomes deletable.
- **Plane-only, no adjacency** (every triangle in the item on that plane) — ~100 fewer lines
  and immune to duplicate-vertex splits, but merges disjoint coplanar regions, so two windows
  on one wall panel would measure as a single surface.
- **Minimal in-place fix** (keep it in `setup/src/`, keep `@ts-nocheck`) — preserves the type
  hole that hid the `faceIndex`/`faceIndices` bug for a whole release.

**Open / to verify at runtime:** whether one item can return multiple `MeshData` entries in
practice (the signature is `MeshData[][]`), and whether `MeshData.normals` being `Int16Array`
(quantised) matters — the port computes face normals from `positions` rather than trusting
them.

## The section-plane gizmo moves to the plane's own frame

_Staged 2026-08-05 (`/grill-with-docs`). **[ADR-0009](docs/adr/0009-section-plane-gizmo-local-frame.md)
and the `bim-viewer.md` edits are already written in the same change** — it amends one clause of
[ADR-0002](docs/adr/0002-section-plane-outline-only.md), so the reasoning had to be recorded up front.
Nothing further to promote: **clear this whole block on merge** and add its row to the table below._

**The bug, measured not argued.** A cut plane whose normal is off-axis draws its gizmo arrow
along the *nearest world axis* instead of along the cut. `ClipperCursor/index.ts:196` passes
`grabAxis: axisOf(plane.normal).axis`, which **snaps**; `GizmoAxis/index.ts:187-191` then follows
the target's position but deliberately **not** its rotation. So the outline, the cut and the drag
all use the true normal and only the arrow and its picker use the snapped axis:

| | direction used |
|---|---|
| outline rectangle (via `plane.helper`) | true normal ✅ |
| the cut itself (`OBC.Clipper`) | true normal ✅ |
| drag motion (`AxisDragManager`) | true normal ✅ |
| **arrow + picker cylinder** | **snapped world axis ❌** |

Worst error **54.74°** (`arccos 1/√3`, the (1,1,1) diagonal). Secondary defect: at 45° the snap
flips — 44.9° gets a red outline on world Z, 45.1° a green one on world X, for two visually
identical cuts. Reproduced by `scripts/check-gizmo-frames.mjs`.

**Decisions taken:**

| # | Decision |
|---|----------|
| 1 | **`GizmoAxis` follows its target's full transform — rotation included, unconditionally.** No `orientation: "world" \| "follow"` option, despite `index.ts:109-113` predicting one: `SectionBox`'s anchors are bare `Object3D`s that only ever take `position.copy()` (`:75`, `:326`), so identity quaternion makes this a **no-op** for the box. The predicted option would have had exactly one caller for each of its two values. |
| 2 | **Form `"axes"` → `"plane"`**, and `grabAxis` becomes **optional** — required only by `"arrow"`. The `"plane"` form always grabs local +Z, because OBC does `helper.lookAt(this.normal)` (`index.mjs:17628`) and `lookAt` aims local +Z at its target. That vendor coupling is pinned to one documented `PLANE_NORMAL_AXIS` constant, not spread as a `"z"` literal at a call site. `"axes"` would now actively mislead — it is the one form that is no longer world-**axes**-aligned. |
| 3 | **The world-axis palette stays — X green, Y blue, Z red — and a direction that names no axis goes light grey.** `AXIS_COLORS` is unchanged; what changes is that `axisOf()` **stops snapping**, returning the axis a direction runs along within `AXIS_ALIGNMENT_DOT` (0.9998, ≈1.15°) or **`null`**, which `colorOf()` renders as `OFF_AXIS_COLOR`. ⚠️ **Light grey `0xcccccc`, not black:** achromatic is the intent, but the viewport bottoms out at `oklch(9% 0.014 255)` and gizmos draw `depthTest: false` over open sky, so black would be invisible exactly where these gizmos float — and white fails the mirror-image way against the pale model. **Each of the three arms is coloured by its own world axis**, so a square cut looks exactly as it did before this change. |
| 4 | **Rotation comes from `follow.getWorldQuaternion()`**, so arrow and outline inherit **one** transform and agree *structurally* rather than by computation. Scale-safe, which matters: `_planeMesh`, not the helper, carries `plane.size`. |
| 5 | **`buildAxisGizmo` returns the resolved grab colour**; `highlighted` restores that instead of `AXIS_COLORS[this.grabAxis]`. Without this, un-hovering a blue normal arrow repaints it **red** — it sits on local Z. This removes the last reader of `handle.grabAxis`, so dropping it from `AxisGizmoHandle` is *required*, not tidiness. |
| 6 | **`axisOf()` is kept but returns `PlaneAxisInfo \| null`** — the `null` is the fix. The old version snapped every direction to its nearest axis and so could never say "skewed", which is what let it report a 44° cut as axis-aligned. `AXIS_ALIGNMENT_DOT` is its own constant, same magnitude as `coplanarFace.ts`'s 0.9998 but **not imported from it**: the two answer different questions across component boundaries and must stay free to diverge. |
| 7 | **Outline colour is `colorOf(plane.normal)`** — the same rule the arrow is built from, applied to the same direction, so the plane and the arrow that moves it cannot disagree. A `framePalette(quaternion)` helper does the per-arm version, and **the caller builds it**: a gizmo drawn in local space cannot know where its rotation aims each arm. |
| 8 | **New `IN_PLANE_LENGTH_RATIO ≈ 0.45`**, shortening only the two inert arms, for the reference's ≈3:1 look. `GRAB_AXIS_EMPHASIS` is left alone — it is `SectionBox`'s emphasis too, and its picker coupling is deliberate. |
| 9 | **Regression check is a plain node script**, `scripts/check-gizmo-frames.mjs`, using Vite's own `createServer`/`ssrLoadModule` to import the real modules — no mocks, no new dependency. Matches the established precedent in `playwright.config.ts`, which imports `loadEnv` from Vite for exactly this reason. **Not** under `e2e/`: that is Playwright's `testDir` and would collect it as a spec. |

**Two measured findings that changed the design.** Both are now asserted by
`scripts/check-gizmo-frames.mjs` (Group B), so they are reproducible rather than anecdotal:

- **The plan-cut roll is *not* arbitrary.** For `normal = ±Y`, `cross(up, z)` is degenerate, but
  three's fallback is **deterministic** (bit-identical over 500 rebuilds) and lands on a sensible
  frame: local +X → world +X, local +Y → world −Z. An earlier draft of this entry called it
  "whatever the fallback picks" — that was speculation, and wrong.
- **A plan cut's helper frame is 0.00573° off its own normal.** Three's `_z.z += 0.0001` nudge is
  permanent in the frame, so local +Z reads `(0, 1, 0.0001)`. Invisible (sub-pixel on a 1.4-unit
  arm) and it never reaches the cut — `three.setFromNormalAndCoplanarPoint` uses the exact
  `plane.normal`. ⚠️ **But the regression check must tolerate ~0.01°, not 0**, or it fails on the
  most common cut in the app for a non-bug. This is also *why* decision 4 takes the quaternion
  from the follow target rather than the exact normal: passing the normal would make the arrow
  more accurate and thereby **disagree** with the outline, and agreement is the whole point.

**Why grey beats both the old scheme and the role palette.** Hue encoded *orientation*, never
identity — two plan cuts were already both blue, and identity comes from selection + opacity
(0.45 → 0.85 → 1.0), untouched. The old scheme's problem was not that hue meant orientation; it was
that hue **lied** when the cut was skewed. A role palette (normal always blue) was built first and
reversed: it reads identically on every plane, but throws the orientation signal away entirely to
fix a lie that grey fixes while *keeping* the signal. `ToolbarClip.tsx` renders no colour swatch
(its only `color` hit is a Tailwind `transition-colors`), so the plane list is unaffected either way.

⚠️ **The tolerance holds only because the GIS rotation never touches the BIM model.**
`GisLayer3d.updateMapPosition()` feeds `rotRad` into `transformLatLonHeightToOrigin`, reorienting the
Google/OSM *tiles* to meet the model, and `fragments-manager.ts:31` says "Ignore coordinate for now".
Were it the other way round, a site rotated to true north would make every wall off-axis and grey out
every cut. First thing to check if grey ever starts appearing everywhere.

**Alternatives rejected** (for the ADR):

- **Add the predicted `orientation: "world" | "follow"` option** — the code comment calls it "about
  four lines", and it is. Rejected because after this change *nothing* wants `"world"`: the box's
  anchors are unrotated, so `"follow"` is correct for both callers and the option would be a knob
  with one value in use.
- **Keep world-axis colour, point the arrow along an arbitrary direction vector** — my own first
  recommendation. Preserves ADR-0002's colour language, but leaves axis-aligned and off-axis planes
  drawn by two different rules, and does not match the reference.
- **Snap the cut normal itself to the nearest world axis** — every current invariant survives and
  `GizmoAxis` needs no change at all, but off-axis sections become impossible (no skewed wall, no
  non-orthogonal grid) and the cut silently disagrees with the clicked face by up to 54.74°.
- **Role-based colour: normal always blue, arms always red and green** — built, reviewed, then
  reversed on the developer's call. Matches the Navisworks reference 1:1 and reads identically on
  every plane, but discards information the old palette carried for free: with hue fixed by role, an
  outline can no longer tell you a cut is a level cut. It also turned every outline blue, deleting the
  colour table from `bim-viewer.md` — a bigger documentation loss than the defect warranted.
- **Pure black for off-axis** — the developer's first instinct, and the natural reading of "no colour,
  no axis". Rejected on measurement, not taste: the viewport bottoms out at `oklch(9% …)` and gizmos
  draw on top of it with `depthTest: false`, so black is near-invisible against the sky in the very
  screenshot that reported this bug. White fails symmetrically against the pale model — an achromatic
  colour differs only in lightness, so it must vanish against one or the other.
- **A fourth saturated hue (magenta / cyan)** — reads unmissably against both, differing in *hue*
  rather than lightness. Rejected as louder than the thing deserves: a skewed cut is unusual, not an
  error, and magenta shouts.
- **A tolerance tighter than ~1°** — the failure modes are asymmetric. Too tight and an orthogonal wall
  with float-noisy normals greys out, so the common case looks broken; too loose and a 1° rake wears an
  axis colour, a lie nobody can see. Float noise is ~1e-6 (≈0.00006°), so 1.15° clears it by four
  orders of magnitude while still catching any deliberate rake.
- **Swap the centre diamond for a sphere or screen-facing dot** — the diamond now lies in the
  gizmo's local XY, i.e. *in the cut plane itself*, so it vanishes edge-on, inheriting the blind
  spot ADR-0002 already lists for the outline. Kept as a quad anyway: it now honestly *is* a scrap
  of the cut surface, the reference shows a flat marker, and the blue arrow you actually grab stays
  visible at every angle.
- **Rotation handles on the in-plane arms** (what Navisworks does) — a genuinely new feature, not a
  fix. `AxisDragManager` only slides along one axis; rotation needs a new drag mode, a new
  `getAxis`/`onDrag` contract and per-frame normal re-derivation. Deferred, deliberately.
- **Adding Vitest** — the case is real (this bug, the `rotZ`/`rotX` cone bug at
  `axis-gizmo-mesh.ts:113-121`, and the two correctness bugs the Surface-measure entry above is
  fixing right now: four pure-math defects in one subsystem, none with a unit seam). Deferred as a
  separate branch rather than smuggled into a gizmo fix.

⚠️ **Clause-level amendment — the ADR convention had no vocabulary for it.** `docs/adr/README.md`
offered only `Accepted | Superseded by ADR-NNNN` and forbids rewriting history. ADR-0002 has five
Decision claims and **none dies**: what changes is one word inside one of them — colour states the
normal's *"dominant"* world axis, where "dominant" meant an unconditional snap. So ADR-0002 keeps
`Status: Accepted` qualified with *"outline-colour clause amended by ADR-0009"*, plus an inline `⚠️`
pointer on that paragraph. Its "Three.js axis colours" rejected-alternative is marked ✅ **upheld** —
the role palette was tried and reversed for exactly the reason that bullet gives. **`README.md`'s
Convention section gains one bullet** covering clause-level amendment *and* supersession, and requiring
that a later ADR which *upheld* an old bullet says so.

**Guide edits** in `bim-viewer.md`: the normal→colour table **stays** in § Section tool and gains a
fourth row (*none of them → light grey*), plus a note on `AXIS_ALIGNMENT_DOT` being deliberately loose.
§ Section box drops its own copy and just points at `AXIS_COLORS`. `GizmoAxis`'s framing as *"give me a
**world-aligned** handle"* becomes "a handle in that transform's own frame", and the "follows position
only — rotation is ignored" bullet is rewritten.

## The cut-plane gizmo spawns where you clicked, and slides around inside the cut

_Staged 2026-08-05 (`/grill-with-docs`). Earmarked for **ADR-0013** once merged — it reverses a
deliberate choice ADR-0011 shipped, and takes delivery of a drag mode
[ADR-0009](docs/adr/0009-section-plane-gizmo-local-frame.md) deferred by name._

_Reviewed 2026-08-05 via `/fable-advisor` **before** implementation. The seam (decision 6) was
endorsed; four things changed as a result, and each is marked ⚠️ at its decision: the pick priority
became **per-id** rather than global (4), decision 5's stated rationale was **wrong** and is corrected,
`gizmoMoved` moved to a **dirty bit** to stop it lying on a zero-movement grab (9), and the clamp came
back **at the refit only** as new decision 11 — an option that was never put to the developer during
the grill._

**Why this is a decision, not a bugfix.** The reported symptom — "the gizmo doesn't appear where I
clicked, it appears in the middle" — is the code working as designed. `ClipperCursor`'s `_anchors`
docstring says so outright: *"at the middle of that plane's outline rather than at the point the user
clicked — the same reason `SectionBox` anchors its arrows at face centres."* Reversing it is a UX
call, made by the developer against a stated recommendation to keep centre-anchoring. What makes it
more than a preference flip is the second half: the gizmo becomes **movable**, which is the "new drag
mode" ADR-0009 listed as deferred — *"`AxisDragManager` only slides along one axis; rotation needs a
new drag mode, a new `getAxis`/`onDrag` contract"*. The same sentence applies to 2-DOF in-plane
translation, and this entry is where that contract change gets made.

**Three measurements that shaped the design**, all read off the code rather than guessed:

- **The click point needs no new maths.** `_createPlane` passes the clicked point as
  `createFromNormalAndCoplanarPoint`'s coplanar point, so `plane.helper.position` *already is* the
  click point. "Spawn where I clicked" is the offset `(0, 0)` — the feature is the **removal** of the
  `centerOffset` term, not the addition of a spawn rule.
- **The centre diamond is entirely inside the arrow's grab cylinder.** Pick radius is `0.525`
  (`GIZMO_PICK_RADIUS 0.35 × GRAB_AXIS_EMPHASIS 1.5`); the diamond's corners reach `0.424`
  (`GIZMO_DIAMOND_SIZE 0.6 × √2 / 2`). `AxisDragManager._pickHandle` sorts hits by distance, so a
  centre handle placed as-is could **never** win a raycast. This is why decision 4 exists.
- **The fill rebuild after an in-plane drag would be redundant, not wrong.**
  `ClipperFillManager.noteDragState` refreshes only on the transition to `null`, and
  `ClipStyler.create()` holds the *live* `THREE.Plane`, so it would recompute a cut that never moved.
  Harmless, but it is a full `ClipEdges.update()` per reposition — which is what decision 7 buys out.

**Decisions taken:**

| # | Decision |
|---|----------|
| 1 | **The gizmo anchor spawns at the click point** — `_syncAnchor` stops adding `outlines.centerOffset()` and adds a per-plane **owned** offset instead, initialised to zero. The offset has to be explicit state rather than a moved `Object3D`, because `onDrag` subtracts it to recover the helper's position; there is nothing else to derive it from once it is no longer the fitted centre. |
| 2 | **The offset is stored in the helper's local X/Y**, not world space. A cut plane never rotates, so the two agree today — but local is invariant under sliding the cut along its own normal, which is the *only* thing dragging the arrow does (`fitBoxToFrame`'s stated ⚠️ invariant). World space would need re-deriving on every drag frame. |
| 3 | **Grabbing the centre diamond slides the gizmo anywhere within the cut surface** — free 2-DOF, one gesture. Rejected: two 1-DOF drags on the inert in-plane arms, which would have reused the existing axis machinery verbatim (see alternatives). |
| 4 | **`_pickHandle` gains a priority pass, scoped per id.** An id's `"inPlane"` hit preempts **that same id's** `"axis"` hit; results then merge back into one nearest-hit ordering across ids. This is what makes the enclosed diamond reachable, and it replaces carving a gap in the arrow's grab cylinder — no geometry surgery, no `BufferGeometryUtils` import (the repo has none today), and `AxisGizmoHandle.picker` stays a single `THREE.Mesh`, which is what `SectionBox` reads. ⚠️ **Per-id, not global — that distinction is the whole safety of it.** A global override (all `"inPlane"` beats all `"axis"`, how this was first specified) is correct today only *by accident*: `_syncVisibility` sets `gizmo.visible = enabled && isSelected` and `pickTargets` filters on it, so exactly one gizmo is ever pickable and there is no second diamond to out-rank a nearer plane's arrow. Land multi-select — or the rotation mode ADR-0009 deferred — and a farther plane's diamond silently steals a click from a nearer plane's arrow, with no compile error and nothing in `check:gizmo` to catch it. A third assumption this class depends on and cannot verify, so it is commented like the other two. ⚠️ **Accepted cost:** a ~37px region at the arrow's middle stops moving the cut. Honest, because the diamond is *drawn* there. |
| 5 | **The diamond quad itself is the pick target** — not a dedicated invisible sphere. It preserves the property `axis-gizmo-mesh.ts` states for the arrow: what you can grab is what you can see. **No `dot(viewDir, normal)` guard is needed, and the reason matters.** ⚠️ An earlier draft of this entry claimed the diamond's edge-on blind spot *is* the maths degeneracy — that was wrong. A `PlaneGeometry` raycast is exact triangle intersection, not a screen-area threshold, so grazing incidence makes the diamond hard to **aim at** while leaving it perfectly hittable; it fails only at the true mathematical limit of a ray parallel to the plane. What actually makes the guard unnecessary is that `_begin` sets `world.camera.enabled = false`, so the view cannot rotate toward edge-on once a session has started — a grab-time condition holds for the whole drag. |
| 6 | **`AxisDragManager` learns modes, not a second manager.** `pickTargets` entries gain `mode?: "axis" \| "inPlane"` (defaulting to `"axis"`), and a new **optional** `onInPlaneDrag(id, position)` receives the 2-DOF result. `getAxis`, `getOrigin` and `canDrag` are reused **verbatim** — the in-plane drag needs the plane's normal to build its drag plane, which is exactly what `getAxis` already returns. **`SectionBox` needs zero changes**: it omits `mode` and never passes `onInPlaneDrag`, so `"inPlane"` targets are inert for any consumer that does not opt in. ⚠️ **"Reused verbatim" describes the *contract*, not the internals** — `_begin` and `_update` genuinely branch. In-plane mode builds `dragPlane` as the **literal cut plane** (`normal = axis`, through `origin`), not the camera-facing plane the axis mode constructs to dodge degenerate ray angles, and `_update` skips the `dot(axis)` projection entirely and hands `onInPlaneDrag` the raw intersection. Two `DragSession` behaviours, not zero new branching. **Rejected: per-target callbacks** — `pickTargets()` runs on every `pointermove` during hover, so a closure per target per frame is real GC churn for no gain over one optional field on the options object. |
| 7 | **`hoveredMode` and `draggingMode` join `hoveredId`/`draggingId`.** Two payoffs: hovering the diamond highlights the *diamond* rather than the arrow you are not about to grab, and `ClipperFillManager` can skip the redundant rebuild measured above. The handle gains a second highlight flag for the quad. |
| 8 | **Recovery is a per-plane button in `ToolbarClip`, not a double-click gesture**, resetting the offset to the click point. It slots into the existing `handleSelectPlane`/`handleTogglePlane`/`handleDeletePlane` pattern, and — unlike a gesture on the handle — it still works in the case that motivates having a reset at all: a gizmo dragged off-screen cannot be double-clicked. |
| 9 | **`ClipperPlaneState` gains `gizmoMoved: boolean`**, and an in-plane drag triggers `onStateChanged` **once on drag end**, never per frame. ⚠️ This deliberately breaks the existing rule that drag state never reaches React (*"Hover and drag change how outlines look, but not what React renders"*) — narrowly, at one transition, so the reset button can disable itself instead of sitting live and doing nothing. A boolean, not the offset: the type's docstring says it is a dropdown row. ⚠️ **The flag is set from a dirty bit inside `onInPlaneDrag`, not from the end transition itself.** Reading the `draggingId → null` transition alone would flip `gizmoMoved` true on a *press-and-release with no movement*: `onInPlaneDrag` never fires, nothing moved, yet the reset button would light up for a plane sitting exactly where it started. `onInPlaneDrag` only runs on real pointer movement, so a per-session bit set there is the honest signal. |
| 10 | **Verified by a new Group D in `scripts/check-gizmo-frames.mjs`** (`npm run check:gizmo`), following ADR-0009's precedent rather than adding Vitest — which ADR-0009 deferred to its own branch specifically so it would not be *"smuggled into a gizmo fix"*, and this is a gizmo fix. |

| 11 | **The clamp is split by moment: free while dragging, clamped on refit.** Interactive placement is never overridden — that is the feature. But `outlines.onFitChanged` is a one-shot, non-interactive event that *already* recomputes the footprint, so it is the one place a clamp is nearly free, and it closes precisely the hole decision 6's free placement opens: an owned offset outliving a footprint that just shrank. The offset is clamped into the new rectangle there, and decision 8's button stays as the fallback for anything a clamp cannot cover rather than as the sole rescue. ⚠️ **Consequence: `onFitChanged`'s loop is not deleted after all** — it changes job from anchor-resync to clamp-then-resync, and `ClipperOutlineManager` gains the extent accessor (`width`/`height` are local to `_applyFit` today; only `centerX`/`centerY` are stored). |

| 12 | **The offset maths is extracted to `src/gizmoOffset.ts`** (`localOffsetToWorld`, `worldPointToLocalOffset`, `clampOffsetToExtent`) — **not planned, added during implementation.** Decision 10 could not be honoured without it: `ClipperCursor` needs a `Components`, a `World` and a viewport to construct, so nothing inside it is reachable headlessly, and a Group D that re-implemented the arithmetic beside it would keep passing if production stopped doing it. That is the exact failure ADR-0009 records under *"Re-implementing the follow transform inside the check script"*, which is why `applyFollowTransform` exists at all. Second benefit: `_syncAnchor` and `onDrag` previously held the same `set(x, y, 0).applyQuaternion(q)` line twice, and two copies of a conversion is how one exact and one approximate direction gets shipped. |

**⚠️ Group D found a defect in itself, not in the code — and it is the one ADR-0009 predicted.**
The first draft asserted the offset was perpendicular to the **exact** `plane.normal`. It failed only
on plan cuts, with an error scaling exactly linearly with offset magnitude (`1e-4 × offset`:
`2.5e-5` at offset 0.25, `4.0e-3` at 40, `1.75e-2` at 250). That is three's degenerate-`lookAt` nudge
`_z.z += 0.0001`, leaving a plan cut's frame permanently **0.00573°** off its own normal — the figure
Group B already asserts and [ADR-0009](docs/adr/0009-section-plane-gizmo-local-frame.md) already
records, with the explicit warning that this script *"must tolerate ~0.01°, not 0, or it fails on the
most common cut in the app for a non-bug."* Two consequences worth keeping:

- **The correct invariant is perpendicularity to the frame's own local +Z**, not to the exact normal —
  because local +Z is the direction the gizmo *and* the outline share (ADR-0009 decision 4), so it is
  what "in-plane" means here. Asserted at `1e-9`; the deviation from the exact normal is separately
  pinned to a `3e-4 × (|offset| + 1)` nudge bound, so a genuinely broken conversion (local z not
  zeroed, giving a component of order `|offset|`) is still caught by orders of magnitude.
- **`onDrag`'s exactness claim survives free placement, and the reason is structural.** Drift measured
  `0.0e+0` on every frame/offset pair including a 250-unit offset on a diagonal cut, because
  `_syncAnchor` built the anchor and `onDrag` subtracts it using the **same** function on the **same**
  frame, so the offset cancels identically rather than approximately. This is the invariant that would
  have failed silently, and it is now the one Group D exists for.

⚠️ **A pre-existing, immaterial subtlety surfaced while fixing D2.** `planeFit`'s stated invariance
holds exactly for sliding along the frame's local +Z, but a real drag slides along `getAxis` = the
*exact* normal, which differs by that same 0.00573° on plan cuts. So a plan-cut drag does shift the
fitted rectangle by ~`1e-4` of the distance dragged — **under 4mm over a 37.5m drag**. Immaterial, not
introduced by this change, and nothing depends on it since the clamp only runs on a refit. Recorded
so it is not rediscovered as a bug.

**⚠️ One thing gets deleted.** `ClipperOutlineManager.centerOffset()` loses both its callers
(`_syncAnchor` and `onDrag`) and goes with them — the `centerX`/`centerY` fields stay, since
`_applyFit` still positions the band and outline with them. An earlier draft of this entry also
deleted `onFitChanged`'s anchor loop; decision 11 keeps it, with a different job.

**What Group D must assert** — the load-bearing one is the second:

1. The offset is purely in-plane: `dot(rotatedOffset, plane.normal) ≈ 0`.
2. **The cut-drag conversion stays exact for an *arbitrary* offset**, not just the fitted centre.
   `onDrag`'s comment claims it recovers the helper position *"exactly rather than approximately"*,
   and that claim currently rests on the offset coming from `centerOffset`. A user-set offset must
   not weaken it — if it does, the cut drifts slightly on every drag, which reads as imprecision
   rather than as a bug, and so would ship.
3. World → local → world round-trips on a skewed plane.
4. Sliding along local +Z leaves the offset untouched.

**Alternatives rejected** (for the ADR):

- **Keep centre-anchoring; fix the complaint with a highlight pulse on the newly placed band** — my
  own recommendation, and it addresses the plausible underlying need ("I lose track of which plane I
  just placed") without touching the drag contract at all. Rejected by the developer on the direct
  reading of the request: the arrow should be where you pointed.
- **Two 1-DOF drags on the inert in-plane arms** — genuinely tempting, and the cheapest option on the
  table: it reuses `getAxis`/`onDrag` with **no new drag mode**, no degenerate case, and gives the
  arms a job ADR-0009 says they do not have. Rejected because placing the gizmo diagonally then takes
  two separate drags, and because the arms are barely outside the arrow's grab cylinder anyway (tip at
  `0.63` vs radius `0.525`), so they would have needed pick surgery of their own.
- **Carve a central gap in the arrow's grab cylinder** — physically disjoint pick volumes, no ordering
  rule that a later edit could violate. Rejected for cost: two cylinders merged into one mesh to keep
  `picker` a single `THREE.Mesh`, a new `three/examples` import for `mergeGeometries`, a sibling
  constant to `GIZMO_PICK_RADIUS` — and the visible arrow line still runs through the gap, so it
  breaks *"what you grab is what you see"* for the arrow instead of for the diamond.
- **Both the gap and the priority pass** — belt and braces. Rejected because the second mechanism is
  unreachable while the first works, so it never gets exercised and rots untested.
- **A modifier key (Alt-drag the arrow)** — smallest change imaginable, no geometry and no pick
  conflict. Rejected on three counts: undiscoverable, Alt is an OS/browser menu modifier on Windows,
  and it is still a drag *along the normal*, so it cannot actually move the gizmo within the plane.
- **Clamp the drag itself to the fitted band rectangle** — my original recommendation, and it
  guarantees the arrow always visibly belongs to a band. Rejected on the developer's call: free
  placement is the point of the feature, and a clamp that fights the pointer mid-drag is the wrong
  place to enforce tidiness. Decision 11 keeps the guarantee without the fight, by moving the clamp
  to the refit. Mitigating fact for the unclamped drag: it is view-bounded in practice, since the
  drop point must be somewhere the pointer ray hits the plane.
- **No clamp anywhere at all** — what this entry specified before review, with decision 8's button as
  the only recovery. Rejected because the orphan case (offset outliving a shrunken footprint) is both
  concrete and cheap to prevent at exactly the moment the footprint is already being recomputed.
  Leaving it to a button made a rescue load-bearing that should have been a fallback.
- **Clamp on refit only when the gizmo has ended up *fully* outside the new rectangle** — intervenes
  only in the genuinely broken case and never merely tidies. Rejected as a threshold to define and
  defend for a narrower guarantee at identical accessor cost.
- **A second `AxisDragManager`-shaped class for in-plane dragging** — each class would do exactly one
  kind of drag and `SectionBox` would be untouched. Rejected as unworkable rather than merely
  inelegant: two capture-phase `pointerdown` listeners on `window` race for the same click, both
  toggle `world.camera.enabled` so whichever ends second re-enables the camera mid-drag, and hover
  state plus the `grab` cursor split across two owners — needing a coordinator, which is what
  `AxisDragManager` already is.
- **Thread `mode` through every callback** (`getAxis(id, mode)`, `onDrag(id, position, mode)`) rather
  than adding `onInPlaneDrag` — symmetric signatures, one drag entry point, and `SectionBox` still
  compiles untouched since TS permits a handler declaring fewer parameters. Rejected because
  `onDrag`'s `position` would then mean two different things depending on a sibling argument, and
  every `ClipperCursor` handler would open with a mode switch including the two that do not care.
- **Stay mode-blind and let one `highlighted` flag light the whole gizmo** — zero new API. Rejected
  because hovering the arrow would advertise the diamond as grabbable and vice versa, and it keeps the
  redundant per-reposition `ClipEdges.update()`.
- **Put the offset itself on `ClipperPlaneState`** instead of a boolean — opens a numeric-entry path
  later. Rejected as a field built for a feature nobody asked for, in a type whose docstring says it
  is a dropdown row.
- **Add Vitest and write these as real unit tests** — ADR-0009 agrees the case is real and names four
  pure-math defects in this subsystem with no unit seam. Deferred again, for its own reason: ADR-0009
  deferred it to a separate branch precisely so a gizmo change would not carry a tooling change.

**Open / to verify at runtime:**

- Whether the diamond is comfortably grabbable at working zoom. It computes to ≈37px across on a
  900px-tall viewport (`GIZMO_VIEW_FRACTION 0.068` per `GIZMO_LENGTH 1.4` ⇒ `0.6 × √2` gizmo units),
  but that is arithmetic, not a hand on a mouse — and decision 5 accepts that it gets harder at
  shallow angles.
- At what viewing angle the diamond becomes *practically* ungrabbable, and whether that lands
  somewhere a user would notice as broken rather than as "I can't see it either".
- Whether losing the middle of the arrow to the diamond (decision 4) is felt when nudging a cut.
- Whether a gizmo sitting far from its band reads as orphaned *within a session*, where decision 11's
  refit clamp does not apply — it only fires on model load/unload, so free placement is still free
  until then.
- Whether decision 11's clamp is ever *felt* as the gizmo silently moving on a model load, which is
  the specific thing the developer rejected when the clamp was proposed for the drag itself.

## OPEN BUG: a cut's band and/or fill reaches past the model it cuts

_Staged 2026-08-06 during testing of the movable-gizmo branch. **Not diagnosed** — the symptom is
still unconfirmed, so nothing here is a decision yet. Triage recorded so it is not re-derived._

**Reported as:** "there is a bug when section … I think the `ClipStyler` is out of the clipper",
with a screenshot showing a red cut-plane rectangle, a large translucent red region extending off
to the upper-left well past the building, a pale sheet near the roof line, and white outlines
enclosing far more than the model. Several structures are loaded in that scene, which matters
below.

⚠️ **The symptom has four readings with four different root causes, and they were not yet
discriminated** (the triage question was interrupted). Recorded because picking the wrong one
means fixing the wrong thing:

| Reading | Candidate root cause |
|---|---|
| the red rectangle itself is oversized | finding 3 — the band is fitted to *every* model |
| a pale sheet overruns the cut face | finding 2 — fills are unbounded by design |
| nothing is actually being cut | `SectioningArbiter` left neither tool cutting, or `_clipper.enabled` is false while bands still draw. ⚠️ Genuinely contradictory: `_syncVisibility` ties band visibility to `planeState.enabled`, so a visible band over an uncut model should be impossible — trace this one first if it is the reading |
| a large soft translucent quad is back | the vendor's own `SimplePlane._planeMesh` rendering again, i.e. `plane.visible = false` / `suppressDefaultArrow` not holding. Exactly what [ADR-0002](docs/adr/0002-section-plane-outline-only.md) reversed, so it has a documented history and a known fix |

**Finding 1 — the movable-gizmo branch is not implicated, established from the diff not by
argument.** The only changes in `ClipperCursor` that touch rendering are `pickTargets` (which
meshes are *clickable*), the argument passed to `noteDragState`, and the removal of two
`centerOffset` calls. `_syncVisibility`, `outlines.setVisible`, `fills.setVisible` and
`_applyFit`'s geometry are all untouched, and `ClipperFillManager.ts` is not in the diff at all —
so band, outline and fill are produced by code identical to `main`. A `git stash push -u` /
`git stash pop` cycle remains the definitive proof and has **not** been run. ⚠️ `-u` is required
(`gizmoOffset.ts` is untracked), and since nothing is committed on this branch that stash entry
would be the only copy of the work.

**Finding 2 — fills cannot be bounded through the vendor API. This is the durable fact here.**
`ClipEdgesCreationConfig` exposes only `id`, `items`, `link` and `world` — there is no extent,
rectangle or bounds option — and `ClipEdges.plane` is a `THREE.Plane`, which is infinite by
definition. `ClipStyler` therefore fills wherever that infinite plane meets **any** geometry, and
`ClipperFillManager` has no extent concept to pass even if it wanted one. So "the fill overruns
the band" is not a misconfiguration and no config change can fix it; bounding it would mean four
side clipping planes on the fill material plus `localClippingEnabled` on the renderer, which is a
decision, not a patch.

**Finding 3 — a band is fitted to every loaded model, not the one that was cut.** `_measure()`
calls `boxer.addFromModels()`, which unions all models, and `_applyFit` feeds that box to
`fitBoxToFrame`. With several structures loaded, a plane placed on one building gets a rectangle
spanning all of them. Pre-existing ([ADR-0010](docs/adr/0010-sectioning-arbiter-and-fitted-plane-outlines.md))
and invisible in a single-model scene, which is likely why it has not been seen before.

**Ruled out:** band/outline divergence. `_applyFit` positions **both** at `(centerX, centerY, 0)`,
so the crisp rectangle and the translucent region are necessarily the same rectangle — they cannot
drift apart.

**Finding 4 — a model and its fill are placed by two different coordination mechanisms, and they
agree only for a pure translation.** Read off the pinned bundles, not inferred. This is the durable
vendor fact that a second screenshot (2026-08-08, one cut's fill drawn as floating floor-plan
linework well clear of any geometry) sent us looking for.

| | the **model** | its **fill** |
|---|---|---|
| placed by | `FragmentsModels.load` when `settings.autoCoordinate` — `model.object.position.add(baseCoords − modelCoords)` | `ClipEdges.getStyleMeshes` — `FragmentsManager.applyBaseCoordinateSystem(mesh, await model.getCoordinationMatrix())`, i.e. `C_model⁻¹ · C_base` |
| derived from | `getCoordinates()[0..2]` — the origin triple only | `getCoordinationMatrix()` — origin **plus** `xDir`/`yDir` |
| carries rotation | **no**, translation only | **yes** |
| re-evaluated | per load | **once, at mesh creation**, then cached in `_modelStyleGeometries` |

The two bases are also tracked separately — FRAGS `baseCoordinates` vs OBC `baseCoordinationMatrix`
— though both reset when their list empties, so they stay in step on unload.

For **model #1** both reduce to identity, so its fill is always correctly placed. For a later model
they coincide iff its coordination is a pure translation: `C₂⁻¹·C₁` and `translate(t₁ − t₂)` are
equal only when `R₂ = I`. With a site rotation the fill offsets by `R₂ᵀ(t₁ − t₂)` while the model
moves by `(t₁ − t₂)` — same magnitude, wrong direction, which is what a horizontally displaced fill
looks like.

✅ **Measured 2026-08-08: with a single model loaded the fill is correctly placed** — the developer
ran the cut on the building alone and saw no displacement.

✅ **Measured 2026-08-08: reversing the load order (other model first, building second) also shows
no bug.** Two hypotheses die on that one result, and both are worth keeping dead:

- **The floating plan is a second model's *correct* fill, for a model that genuinely sits there.**
  Ruled out — that plan would appear at a fixed world location whatever the load order.
- **Coordination *rotation* is the divergent term.** Ruled out by algebra the reversal exposes: if
  the other model carries rotation `R`, loading it first gives the building a fill transform of
  `C₂⁻¹C₁ = (R, t_o − t_b)`, still rotated and still divergent. Reversal should have *moved* the
  bug, not removed it. And for pure translations `C₂⁻¹·C₁` **equals** `translate(t₁ − t₂)`, so the
  coordination matrices are self-consistent in both directions.

⚠️ **So the defect is timing-dependent, not order-dependent** — which is why two careful sequential
runs both came back clean, and why the original screenshot came out of a messier session. The
surviving mechanism is the "re-evaluated: once, at mesh creation" row of the table above, plus an
async window in OBC:

```js
this.baseCoordinationModel = firstModel.modelId;                        // guard closes here
this.baseCoordinationMatrix = await firstModel.getCoordinationMatrix(); // resolves later
```

`_hasCoordinationModel` goes true the instant the id is assigned, so nothing re-enters, but
`baseCoordinationMatrix` stays **identity** until the worker round-trip returns. A fill mesh created
inside that window latches `C_model⁻¹ · I` and keeps it for good — `updateMeshes` afterwards
rewrites `geometry.attributes.position` and the index but **never re-applies the transform**.
⚠️ Still a hypothesis: it has *not* been reproduced deliberately, and the reproduction recipe below
is the next thing to establish.

⚠️ **`ClipEdges.three` is added straight to `world.scene.three`, never parented to `model.object`.**
That is *why* the two mechanisms can disagree at all — a parented fill would inherit the model's
transform and the question could not arise. Worth knowing before anyone proposes "just reparent it":
`ClipEdges` holds one `three` group spanning **all** models, so it has no single model to parent to.

**Finding 5 — `ClipEdges.create()` sections every model in `fragments.list`, unconditionally.** No
visibility test, no filter — `for (const [modelId] of fragments.list) updateMeshes(modelId, style)`.
Not reachable as a bug in the viewer today (nothing there toggles `model.object.visible`; the only
such toggle is `DrawingEditorPanel.tsx`, a different context), but it means a fill can outlive any
future hide feature. Recorded so the hidden-model reading can be ruled out quickly next time.

**Finding 7 — the bug is build-dependent, which is the signature of a race.** Five attempts,
2026-08-08:

| Run | Build | Result |
|---|---|---|
| original desktop | deployed | **reproduces** |
| one model only | local dev | clean |
| reversed load order | local dev | clean |
| phone | deployed | **reproduces** |
| local dev, real project | local dev | clean |

Never on dev, twice on the fast minified production bundle. That pattern fits the `getStyleMeshes`
cache race (candidate 1 in `lib/debugFills.ts`) and fits no transform bug, since a wrong matrix
would be wrong deterministically on every build. ⚠️ It also means **an `import.meta.env.DEV` probe
gate is useless here** — the instrumentation has to ship to reach the environment that fails.

**Finding 8 — the app loads a stale FRAGS worker, and the correct one is bundled but unused.**

```
dist/worker.mjs            3,297,151   ← committed Jul 13 in public/, what init() actually loads
dist/assets/worker-*.mjs   3,216,090   ← @thatopen/fragments 3.4.3's own worker, never loaded
```

`fragments.init("/worker.mjs")` in **both** `setup/src/fragments-manager.ts` and
`features/ar-viewer/useArModelLoader.ts` pins the app to `public/worker.mjs`, committed in `5fe9915`
and never refreshed across the bump to 3.4.3. So main-thread FRAGS is 3.4.3 and the worker is not —
a direct breach of CLAUDE.md's *"never mix ThatOpen versions"*, and the worker is exactly what
computes `getSection()` (the fill geometry) and `getCoordinates()` (coordination).

⚠️ **Not a candidate for *this* bug on its own** — `public/` is served identically by dev and by
the Worker build, so a stale worker cannot produce a dev/prod split. Must be fixed regardless; the
fix is `FragmentsManager.getWorker()` (version-matched by construction) rather than re-copying a
file that will rot again.

**Finding 6 — the fills mesh is not `frustumCulled = false`, and its bounding volume is never
recomputed.** `getStyleMeshes` sets `frustumCulled = false` on the **lines** mesh only; `updateMeshes`
then assigns `m.geometry.attributes.position = g` directly and calls `setIndex`, which leaves
`boundingSphere` stale. Symptom would be a fill *vanishing* at certain camera angles, not moving — so
it is not this bug, but it is a live trap in the same code path.

---

Last cleared 2026-08-04. Everything staged here has been promoted:

| Was staged | How it works | Why |
|------------|--------------|-----|
| Clicking into a cut selects invisible geometry | `bim-viewer.md` § Picking (clip-aware raycasting) | [ADR-0007](docs/adr/0007-clip-aware-raycaster.md) |
| Measure cursors become their own components | `bim-viewer.md` § Measure tools, § Cursor-family constructor typing | — (no lasting rejected alternative) |
| Measure lag: snapping moves to the FRAGS worker | `bim-viewer.md` § Measure tools → Vertex snapping | [ADR-0003](docs/adr/0003-worker-side-snapping-over-cpu-picking-meshes.md) |
| Cursor-bounded navigation + the pivot dot | `bim-viewer.md` § Camera navigation, § The pivot dot | [ADR-0004](docs/adr/0004-cursor-bounded-navigation.md) |
| Section box | `bim-viewer.md` § Section box, § GizmoAxis · `bim-viewport-toolbars.md` right rail | [ADR-0005](docs/adr/0005-section-box-outside-clipper.md) |
| Zoom dies once the camera parks | `bim-viewer.md` § Camera navigation | [ADR-0006](docs/adr/0006-zoom-pivot-reanchor.md) |
| Box and cut planes can't both crop; plane outlines fit the model | `bim-viewer.md` § Sectioning interlock, § Section tool | [ADR-0010](docs/adr/0010-sectioning-arbiter-and-fitted-plane-outlines.md) |
| A cut plane is a clickable border band in the overlay | `bim-viewer.md` § Section tool | [ADR-0011](docs/adr/0011-clickable-border-band-cut-planes.md) — supersedes ADR-0002 |
| Solid fills at the cut face | `bim-viewer.md` § Section tool → Fills | [ADR-0012](docs/adr/0012-section-fills-via-clipstyler.md) |

⚠️ **One block was deliberately *not* promoted.** The former navigation entry carried a
"Correction" section (items 18–23) proposing that the click-pivot be deleted and the clamp
released on `rest`. It was **never implemented** — verified against `CursorZoom/index.ts`
before clearing: `_onPointerDown`, `_pivotOnHoveredSurface`, `DOLLY_SETTLE_MS` and the
`setOrbitPoint` call were all still live, and `smoothTime` was never changed from the vendor's
`0.2`. Its two genuine vendor findings — that `setLookAt` is never clamped, and that
`setOrbitPoint` yanks via `dollyTo` and leaks a focal offset — survive in ADR-0006, which
records the whole five-attempt history of that bug. The rest was a rejected proposal and is
gone with this file.
