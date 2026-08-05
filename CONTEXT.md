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

## The two sectioning tools become one tool: an arbiter, and plane outlines that fit the model

_Staged 2026-08-05 (`/grill-with-docs`). Earmarked for **ADR-0010** once merged — it amends one
clause of [ADR-0005](docs/adr/0005-section-box-outside-clipper.md) and the rejected alternatives
are the kind that get re-litigated._

**Why this is a decision, not a feature.** [ADR-0005 § Consequences](docs/adr/0005-section-box-outside-clipper.md)
states "The box is not mutually exclusive with Measure/Clip/Coordinate. Intended — a crop is not a
pointer mode", and `ToolbarSectionBox.tsx:18-21` repeats it. Requirement 1 reverses that clause. The
grilling established that ADR-0005 rejected **one mechanism** (`bimStore.activeTool`), not the goal:
`ViewportRightToolbar.tsx:32` kills `Hoverer`, `Outliner` *and* `postproduction` whenever
`activeTool !== "select"`, so a box on `activeTool` loses selection outlines and the whole post pass
for as long as it crops. A direct interlock costs none of that, so **ADR-0005 § Consequences bullet 4
is amended, and its § Alternatives rejected entry for `activeTool` still stands** — the mechanism it
rejected is still rejected.

**There is no engine forcing reason, and an early draft of this entry wrongly implied one.** Both
features do write to the same `renderer.three.clippingPlanes` array via `setPlane`, so a live box
plus six cut planes is twelve half-spaces ANDed together — but three.js imposes no limit that twelve
approaches, and the intersection is perfectly well-defined. The cost is *interpretability*, not
capability: a model cut by twelve half-spaces at once is one nobody can reason about. The
justification for this change is the product requirement, and that is enough on its own.

**Decisions taken:**

| # | Decision |
|---|----------|
| 1 | **A direct interlock, `activeTool` untouched.** The box stays view state; selecting and measuring inside a box keep working, exactly as ADR-0005 intended. |
| 2 | **Suspend and restore, never destroy.** Both components already have an "off but remembered" state — `SectionBox.disable()` keeps `_box` (`SectionBox/index.ts:127`), and cut planes carry per-plane `enabled` (`ClipperCursor/index.ts:128`). The arbiter snapshots which planes were *user*-enabled before suspending, so restore cannot re-enable one the user deliberately switched off — the `fxBaselineRef` pattern from `ViewportRightToolbar.tsx:15`. There is no undo in this app; destruction was rejected on that ground. |
| 3 | **A new `bim-components/SectioningArbiter/`** owns "which sectioning tool is live" plus the snapshot, and is built **entirely from the two components' existing public API** — `sectionBox.enable()`/`disable()`/`active`, `clipperCursor.togglePlane()`/`planes`, and the `onStateChanged` event both already have. **No new events, and no new methods on either class**; `SectionBox` needs no code change at all for the interlock. Neither component imports the other, which is what ADR-0005 § Consequences bullet 8 declined to do, and being `components.get()`-able lets `ToolbarClip` explain itself. |
| 4 | **The arbiter derives who is cutting; it is not told.** It subscribes both `onStateChanged` events and reads `sectionBox.active` and `planes.some(p => p.enabled)` — the same predicate `_syncVisibility` already computes (`ClipperCursor/index.ts:232`) — diffing against its own previous view to spot a transition. This is what makes **restore** possible: a bespoke `onActivated` pair would signal activation only, and nothing would ever fire when the winner switched off. |
| 4a | **"Live" means actually cutting, not aiming.** The derived predicate is true only once a plane exists and is enabled, so *Add plane* → ESC leaves the box cropping with no special case — placement mode is invisible to the arbiter. |
| 4b | **A `_reconciling` guard.** `suspend()`/`restore()` drive `togglePlane`/`enable`/`disable`, each of which fires the `onStateChanged` the arbiter listens to. The handler returns early while the flag is set. Without it, restoring the clipper re-enters the arbiter, which suspends the box it is restoring *from* and clobbers its own snapshot. |
| 4c | **A fresh user toggle invalidates the snapshot.** Toggling a plane on by hand while the box crops is the user overriding the interlock: the box is suspended and the stale clipper snapshot is discarded, so a later restore cannot resurrect a state the user has moved on from. |
| 5 | **Plane outlines fit the model by corner-projection**, replacing the diagonal square. Project the model bbox's 8 corners into the plane helper's local frame (its local +Z **is** the normal — `ClipperCursor/index.ts:194`), rectangle = min/max of local X/Y, centred on the local midpoint. For an axis-aligned plane this reduces *exactly* to the matching `SectionBox` face, which is what requirement 2 asked for. |
| 6 | **The gizmo moves to the rectangle's centre**, via a detached anchor per plane — `SectionBox`'s `_anchors` pattern (`SectionBox/index.ts:322-328`), so "the arrow always grows from the middle of what it moves". `plane.helper` must stay at the cut position, since `AxisDragManager` reads and writes it (`ClipperCursor/index.ts:101-107`). |

⚠️ **Decision 5 is deliberately wider than the request, and is *less* code, not more.** Asked for
axis-aligned planes only; the obvious implementation gates on `axisOf(plane.normal) !== null` and
keeps the diagonal square for skewed cuts. The projection needs no branch and no tolerance at all:
`AXIS_ALIGNMENT_DOT` is ≈1.15° (`GizmoAxis/src/axis.ts:47`), so on a model rotated 3° for site north
*nothing* is axis-aligned and the branch version would silently do nothing. `PLANE_SIZE_RATIO` and
the diagonal square become dead code; `FALLBACK_PLANE_SIZE` stays for the no-model case.

**Two properties worth keeping in the guide**, both consequences of projecting into the *helper's*
frame rather than world space:

- **The rectangle is drag-invariant.** Dragging a plane moves its helper along its own local +Z,
  which changes only the local *z* of every projected corner — local X/Y, and so the rectangle, are
  untouched. No recompute on drag.
- **Colour is untouched.** `colorOf(plane.normal)` (`ClipperOutlineManager.ts:87`) keeps ADR-0009's
  grey-for-skewed signal exactly as it is. Sizing and colour now answer different questions, so the
  invariant is *not* "coloured ⇔ fitted": a skewed cut gets a tightly fitted **grey** rectangle.

**Three vendor facts, read out of `node_modules/@thatopen/components/dist/index.mjs` rather than the
docs, that the implementation has to respect.** All three were found by scrutinising the plan, not
while writing it, and each would have produced a plausible-looking bug:

1. **`SimplePlane.enabled = true` resurrects the default TransformControls arrow.** The setter
   (`:17443`) does `this.visible = this._visibilityBeforeDisabled`, and `visible`'s setter calls
   `toggleControls(state)` (`:17475`) — the triple-duty setter `suppressDefaultArrow` exists to
   counter (`ClipperCursor/index.ts:17-22`). Restoring through `togglePlane` is what makes this
   safe: it already ends in `_syncVisibility()`, which re-suppresses (`index.ts:224`).
2. **The same setter *throws* when the renderer is gone** — `if (!this.world.renderer) throw new Error(...)`.
   `togglePlane` writes `plane.enabled` unguarded (`index.ts:134`), so the arbiter must not reconcile
   during world teardown. `SectionBox._teardownWorldParts` also sets `_active = false` silently
   (`:288`), which desyncs the arbiter's view and is the other half of the same hazard.
3. **`helper.add(_planeMesh)` with `_planeMesh.position.z += 0.01`** (`:17631`, `:17630`), and
   `set size` with `autoScale = false` doing `_planeMesh.scale.set(size, size, size)` (`:17496`).
   The first confirms the outline lives in the helper's frame, which is what makes decision 5's
   projection and decision 6's offset work at all. The second means the rectangle's in-plane offset
   is divided by `size`, so the geometry must carry a comment that it assumes `size = 1` — and
   nothing in `src/` writes `clipper.size` today (verified), but ADR-0005 fact 3 means any future
   `clipper.size = N` would silently rescale every rectangle.

**What the Clip menu shows while suspended.** `planeState.enabled` stays the *actual* cutting state,
so the menu never claims a plane is cutting when it is not; the arbiter's snapshot is the sole record
of pre-suspension intent. That makes the "Suspended — section box is cropping" hint **required, not
polish**: without it a user with three placed planes opens the menu, sees three rows switched off,
and concludes they lost their work. (An earlier draft proposed leaving `planeState.enabled` untouched
as the intent record instead — rejected because it breaks decision 4's derived predicate, which reads
exactly that field to decide whether the clipper is cutting.)

**Alternatives rejected** (for the ADR):

- **A bespoke `onActivated` event on each component** — the obvious shape, and what the first draft
  of this plan specified. It cannot work: it signals activation only, so nothing ever fires when the
  winning tool is switched *off*, and the suspended tool stays suspended forever with no way back
  except re-placing planes. Deriving from the existing `onStateChanged` catches both edges *and*
  turns out to need no new API on either class.
- **Wiring the box to the reserved `activeTool: 'section'`** (`bimStore.ts:13`, still unused) — free
  exclusivity with Measure/Clip/Coordinate too. Lost for the reason ADR-0005 already gave, which was
  re-verified against `ViewportRightToolbar.tsx:32` rather than trusted: no selection outlines and no
  post pass while cropping, and switching to Measure silently drops the crop.
- **Destroying the losing side** — no snapshot bookkeeping and no stale state. Rejected on the
  absence of undo: six placed cut planes lost to one misclick.
- **Mutual direct calls between the two components** — fewest moving parts, no new abstraction. A
  circular import between two modules whose classes carry static `uuid` fields is fragile under
  bundling, and it is precisely what ADR-0005 § Consequences bullet 8 left alone.
- **Arbitrating in the toolbars** — ruled out by a code fact, not taste: `ClipperPlacementManager`
  binds its own canvas pointer listener and calls `onPlace` → `_createPlane` directly, so React never
  sees a plane appear. A toolbar arbiter could only catch *entering* placement mode.
- **Suspending on entering placement mode, restored on ESC** — you would see the uncropped model
  while aiming, and ESC would be non-destructive. Costs a third `provisionally-suspended` state and
  couples the arbiter to the placement lifecycle instead of to clipping state alone.
- **A bbox-sized rectangle centred on the clicked point** — cheapest option that still looks
  internally consistent, and needs no anchor. Rejected because it does not fit the model: click near
  an edge and the rectangle hangs half off the building, which is the thing being fixed.

## Cut planes get a surface again — on the selected one only, and still not pickable

_Staged 2026-08-05 (`/grill-with-docs`). Earmarked for **ADR-0011** once merged. It amends
[ADR-0002](docs/adr/0002-section-plane-outline-only.md) for the **second** time (ADR-0009 was the
first, on colour), so the clause-level rule in `docs/adr/README.md` applies: qualify the status,
annotate the affected passages, and say explicitly which clauses were **upheld**._

**Why this needs a record rather than a commit.** The request — a translucent filled plane, and
clicking a plane to switch to it — is *precisely* what ADR-0002 records as "built and shipped, then
reversed within a day of use". That ADR's closing line exists to catch exactly this moment: "the
reason they lost is not visible in the code that remains, which is why this record exists." Its two
failure modes were **(1)** the quad fought element selection for clicks — occlusion arbitration was
built and "worked as specified", but a plane grabbable anywhere it is visible is grabbable across most
of the screen — and **(2)** a translucent sheet did not read as a plane in space, because at any
usable alpha it tinted the geometry behind it.

**The key insight that unblocked it: ADR-0002 bundled two separable things**, because the original
implementation shipped them together. The quad already exists and is already not pickable — only
`plane.planeMaterial` is `visible: false` (`ClipperOutlineManager.ts:108`), while `pickTargets`
returns gizmo pickers alone (`ClipperCursor/index.ts:96`). So fill alone reintroduces only failure 2,
and pickability alone reintroduces only failure 1. They can be answered separately, and are.

**Decisions taken:**

| # | Decision |
|---|----------|
| 1 | **Fill on the selected plane only.** `SURFACE_OPACITY.idle = 0`; the tint lives on `selected` and `active`. This answers failure 2 by making the tint transient and intentional — normal selecting and measuring happen over an untinted model, and the sheet appears on the plane you are actually working with. |
| 2 | **Hovering an unselected plane's marker previews its fill**, free: `_repaintPlaneStates` already sets `active` on hover, so the existing state machine produces this with no new code. |
| 3 | **Nothing on the plane becomes pickable. ADR-0002's "no pickable surface at all" clause is UPHELD.** Switching planes is solved by a handle instead — see 4. `getPickableMeshes()` is deleted. |
| 4 | **A marker gizmo on every *enabled* plane, not just the selected one.** This is the actual root cause of "I cannot switch planes in 3D": `_syncVisibility` shows a gizmo only when `id === selectedPlaneId` (`ClipperCursor/index.ts:220`) and `pickTargets` filters on `handle.visible` (`:98`), so today there is literally nothing to click on an unselected plane. Clicking a marker selects it; `onSelect` already fires (`AxisDragManager.ts:201`). Adds **zero** new pick surface. |
| 5 | **A third `AxisGizmoForm` — diamond-only marker plus a small picker.** The diamond geometry already exists at `axis-gizmo-mesh.ts:132`, gated behind `isPlane`. Reads as *dot = switch to me, arrow = move me*. |
| 6 | **Markers are select-only; only the selected plane drags.** ⚠️ Needs an explicit `canDrag` hook on `AxisDragManager`: `_begin` calls `getAxis`/`getOrigin` and returns early when either is `null` (`:180`) **before** `onSelect` at `:201`, so returning `null` for an unselected plane would abort the grab *without selecting it*. |
| 7 | **`polygonOffset` on the fill material.** The fill is coplanar with the cut cross-sections it produces, which is the exact condition ADR-0005 documented for the box outline ("every box edge borders the cross-sections its own planes cut, so a depth-tested wire z-fights and stipples out exactly where the crop is most interesting"). Offsetting keeps the fill depth-testing, so geometry genuinely in front still occludes it — which is what makes the sheet read as sitting *in* the model. |
| 8 | **Markers are always visible while their plane is enabled.** Gating them behind the Clip dropdown would hide the feature precisely when attention is in the viewport. Accepted cost: with `depthTest: false` the diamonds float through walls at all times. |
| 9 | **The fill is a separate mesh** mirroring the outline's fitted rectangle and in-plane offset. Reusing `SimplePlane`'s own quad would mean replacing vendor-owned `PlaneGeometry` and offsetting it, which would drag the outline — its child — along too. |

**Which ADR-0002 clauses change, and which hold.** Worth stating precisely, because most of it holds:

- **Amended:** "outline-only". A fill returns, but conditionally rather than always.
- **Refined:** "the gizmo is the sole handle" → the sole *drag* handle. Markers are gizmos too, and are select-only.
- ⚠️ **Upheld after being re-tested:** "**no pickable surface at all**". This is not inertia — it is the reason decision 4 exists instead of the obvious approach, and the mechanical evidence is in the rejected alternatives below.
- **Upheld:** "interaction state rides on opacity, not hue" — now across two materials instead of one.

**Two things genuinely changed since ADR-0002 (2026-08-03)**, and both were checked rather than
assumed. Neither rescues a pickable quad, but they are why this was worth re-opening at all:

- **`ClipAwareRaycaster` exists** ([ADR-0007](docs/adr/0007-clip-aware-raycaster.md)). ADR-0002's
  arbitration had to hand-roll a clipped-hit filter "since fragment raycasting ignores clipping
  planes"; that is now central, correct and free.
- **Planes are fitted, not oversized** ([ADR-0010](docs/adr/0010-sectioning-arbiter-and-fitted-plane-outlines.md)).
  The quad went from an edge-of-diagonal square (~45×45 m on a 40×20 m building) to the actual
  footprint — materially smaller, though still spanning the model where you want to click elements.

**Alternatives rejected** (for the ADR):

- **Surface meshes fed into `AxisDragManager.pickTargets`** — the obvious route, and what
  `getPickableMeshes()` was written for. Rejected on a mechanical finding, not on taste: `_downListener`
  is a **capture** listener on `window` (`AxisDragManager.ts:110`) that calls `preventDefault()` +
  `stopPropagation()` whenever `_hoveredId` is set (`:106-107`), and its own docstring states the
  premise it depends on (`:46-49`) — *"since only the handle is pickable, that stop only ever fires
  over the handle."* Model-sized quads invert that: the stop fires across most of the viewport, before
  camera-controls or the highlighter ever see the event, so **orbit and element selection both die**.
  This is ADR-0002 failure 1 with the arbitration *removed*.
- **A surface click gated on "the ray hit no model geometry"**, arbitrated through `ClipAwareRaycaster`
  and deliberately **not** routed through `AxisDragManager` (no `stopPropagation`) — literally what was
  asked for, made safe. It also sidesteps a problem any depth-based rule has: the plane is **coplanar
  with its own cut face**, so comparing their depths is a coin flip. Rejected as unnecessary once
  markers solve switching, but this is the fallback if markers prove unusable in practice — it is the
  only option that lets you click the sheet itself.
- **Fill on every enabled plane, always** — closest to the reference image and one material change with
  no state. This is the straight ADR-0002 reversal: with two or three planes live the model sits under
  two or three tinted sheets and the tint compounds, which is the condition the ADR reacted to.
- **No fill, heavier outline instead** — keeps ADR-0002 intact and attacks the real complaint that a
  1px wire is easy to lose. Rejected because 1px is a hard floor: `LineBasicMaterial.linewidth` is
  ignored by `WebGLRenderer`, so real weight needs `Line2` fat-line geometry — a dependency ADR-0002
  already declined for a hover cue.
- **The full `"plane"` gizmo on every plane** — no new form and no `canDrag` hook, just flip
  `_syncVisibility`. Rejected on the clutter argument [ADR-0005](docs/adr/0005-section-box-outside-clipper.md)
  already made against six three-armed gizmos on a box: three planes would carry three diamonds, nine
  arrows and six inert arms. It also lets a click meant only to switch nudge the plane before release.
- **The full gizmo dimmed when unselected, select-only** — avoids a new form but keeps the clutter, and
  dimmed arrows that say *draggable* while refusing to drag is the one combination that actively misleads.
- **`depthTest: false` on the fill** — cannot z-fight, and it is the escape ADR-0005 took for the box
  outline. Rejected because a fill that ignores depth draws over geometry standing between it and the
  camera, so the sheet stops reading as a plane in space — ADR-0002 failure 2 restated.
- **Relying on the vendor's existing 0.01 local-Z nudge alone** (`index.mjs:17630`) — zero code, and it
  is why the current 1px outline renders without stippling. Rejected because 0.01 m against a
  non-linear depth buffer at building scale with a far camera is exactly where it degrades, and a full
  quad shows it far more than a wire does.
- **Markers only while the Clip dropdown is open** — zero clutter during normal work, but it needs a
  React→engine push and makes 3D plane switching unavailable exactly when you are looking at the 3D
  view rather than the menu.
- **Depth-tested markers** so the model occludes them — honest in space, but it means a per-handle
  exception to a shared service whose entire overlay pass is `depthTest: false` with clipping
  suspended, and a marker behind a wall becomes unclickable. Worse than cluttered.

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

⚠️ **One block was deliberately *not* promoted.** The former navigation entry carried a
"Correction" section (items 18–23) proposing that the click-pivot be deleted and the clamp
released on `rest`. It was **never implemented** — verified against `CursorZoom/index.ts`
before clearing: `_onPointerDown`, `_pivotOnHoveredSurface`, `DOLLY_SETTLE_MS` and the
`setOrbitPoint` call were all still live, and `smoothTime` was never changed from the vendor's
`0.2`. Its two genuine vendor findings — that `setLookAt` is never clamped, and that
`setOrbitPoint` yanks via `dollyTo` and leaks a focal offset — survive in ADR-0006, which
records the whole five-attempt history of that bug. The rest was a rejected proposal and is
gone with this file.
