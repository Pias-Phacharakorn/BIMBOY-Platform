# ADR-0008: Surface measure is rebuilt on worker geometry, as its own component

**Status:** Accepted
**Date:** 2026-08-04
**Area:** `docs/feature/bim-viewport-righttoolbars.md` § Surface: coplanar faces from worker geometry

## Context

The Surface measure tool was not merely unfinished — it was **stranded**. Its engine
(`setup/src/surface-measure-cursor.ts`, 630 lines under `@ts-nocheck`) walked main-thread
`mesh.geometry` triangles to find the coplanar face under the cursor.
[ADR-0003](0003-worker-side-snapping-over-cpu-picking-meshes.md) deleted `MeasurePicking` and left
`world.meshes` **empty for the app's lifetime**, so there was no geometry left to walk. Two
symptoms of that drift, both read off the code:

- It read `result.faceIndex` (singular). FRAGS `RaycastResult` exposes **`faceIndices`**. Every hit
  therefore took the fragment branch with a seed of `undefined ?? 0` — the BFS always started from
  triangle 0 of a batched instanced geometry, i.e. garbage for any input.
- `ToolbarMeasure.tsx` imported `SurfaceMeasureButton` and never rendered it; a hardcoded disabled
  "Surface / Soon" `<div>` sat in its place. `SurfaceMeasureList` *was* rendered but unreachable,
  since nothing could set `activeType` to `"surface"`.

⚠️ **The `@ts-nocheck` is why the `faceIndex` bug survived a release.** `SurfaceMeasure.tsx` was the
only file in `react-components/components/` carrying one, and it suppressed exactly the error that
would have named the defect.

## Decision

**Promote it to `bim-components/SurfaceMeasureCursor/`** (`SurfaceMeasureEngine.ts`,
`coplanarFace.ts`, `types.ts`), fully typed, no `@ts-nocheck` anywhere in the port or its UI.

It joins the measure family in **conventions only, not code.** `MeasureCursorDescriptor` is built
entirely around `MeasurerLike` — an `OBF.Measurement` with `create()`/`endCreation()` — and Surface
has no vendor measurer at all, so `MeasureCursorEngine` cannot be reused. It owns its own
coplanar-face BFS, measurement registry and CSS2D labels, and does no vertex snapping.

- **Geometry comes from `model.getItemsGeometry([localId])`** per hovered item. `MeshData` carries
  `positions`/`indices`/`transform`; world space needs `geomData.transform` then
  `model.object.matrixWorld`.
- **Cached per item, fetched only once the pointer settles** (120 ms). Key `modelId:localId`,
  insertion-ordered LRU capped at 32, plus a face cache per seed triangle so a re-hover resolves
  synchronously. Invalidated wholesale on `fragments.list.onItemSet`/`onItemDeleted`, as
  `ClipperOutlineManager` and `MiniMap` already do.
- **"One surface" = connected ∧ same plane ∧ same side.** Vertices welded by quantised position
  (`1e-4`), *signed* normal agreement `>= 0.9998`, and equal plane offset within `1e-4`.
- **The BFS is seeded geometrically** — locate the triangle containing the hit point whose normal
  agrees with the hit, using the welded soup already cached. `RaycastResult.facePoints`/
  `faceIndices` semantics are not pinned down in the vendored docs and `normal` is optional, so
  none of them is trusted as the seed.

⚠️ **Two correctness bugs were fixed during the port rather than carried across.** Both changed
reported numbers, so a revived-but-verbatim engine would have looked plausible and measured wrong:

- `Math.abs(tn.dot(seedNormal))` accepted **anti-parallel** normals, and nothing checked plane
  offset — only parallelism. Measuring one side of a wall swallowed the far side, roughly doubling
  the area. The signed test plus the offset test is what closes this.
- Adjacency was keyed on **buffer index** rather than position. IFC routinely duplicates vertices at
  identical coordinates for per-face normals; where it does, neighbouring coplanar triangles share
  no index and the BFS halts at the seed triangle. Welding closes this too.

## Alternatives rejected

- **Resurrect `MeasurePicking`** — the exact thing ADR-0003 deleted for dropping the framerate on
  hover alone. One `THREE.Mesh` per geometry instance is 10k–100k meshes on a real IFC. Fetching one
  item on demand is the same data at roughly 1/50,000th the cost. This is the tempting one, because
  it makes the whole engine synchronous again.
- **Trust `RaycastResult.facePoints` as the face** — would delete `coplanarFace.ts` outright.
  Rejected because the vendored docs say only "the points of the raycasted face" without saying
  whether that is one triangle or the whole coplanar region. ⚠️ **Worth re-testing:** if it *is* the
  face, the BFS becomes deletable.
- **Plane-only, no adjacency** (every triangle in the item on that plane) — ~100 fewer lines and
  immune to duplicate-vertex splits. Rejected because it merges disjoint coplanar regions: two
  windows on one wall panel would measure as a single surface.
- **A minimal in-place fix** — keep it in `setup/src/`, keep `@ts-nocheck`, just swap `faceIndex`
  for `faceIndices`. Rejected because it preserves the type hole that hid the bug for a release.
- **An abstract `MeasureCursorBase` the three cursors extend** — see
  [ADR-0003](0003-worker-side-snapping-over-cpu-picking-meshes.md) and the guide's § Measure tools:
  TypeScript does not require a subclass to redeclare `static uuid`, so a forgetful subclass
  silently overwrites a sibling in the component registry. Composition keeps that unreachable.

## Consequences

- **The tool is reachable for the first time.** `activeType` can now be `"surface"`, and the
  previously dead `SurfaceMeasureList` renders.
- **Reported areas change** for any surface that was measurable before, because both correctness
  bugs above inflated them. Anyone comparing against an old screenshot should expect a difference.
- **Hover is async and cache-gated**, so the first hover on a cold item has a perceptible delay that
  Length and Area do not. Accepted: the alternative is resident CPU geometry.
- ⚠️ **Open, unverified at runtime:** whether one item can return multiple `MeshData` entries in
  practice (the signature is `MeshData[][]`), and whether `MeshData.normals` being `Int16Array`
  (quantised) matters — the port computes face normals from `positions` rather than trusting them.
