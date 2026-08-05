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
