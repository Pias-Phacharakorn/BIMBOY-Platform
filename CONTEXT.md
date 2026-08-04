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
