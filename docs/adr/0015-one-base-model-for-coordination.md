# ADR-0015: The first model into an empty scene loads alone, so FRAGS and OBC agree on the base

**Status:** Accepted
**Date:** 2026-08-08
**Area:** `docs/feature/bim-viewer.md` § Patterns & conventions (cloud auto-load), § Gotchas

## Context

A cut plane's `OBF.ClipStyler` fill rendered **detached from the geometry it cut** — floor-plan
linework floating clear of any building. Reported three times over two days, on the deployed build
and then on localhost.

**FRAGS and OBC each pick a "first model" to coordinate everything else against, by two different
rules.** In `FragmentsModels.load`:

```js
this.models.list.set(model.modelId, model);   // ← at load START, in call order
await model._setup(buffer, ...);              // ← async
if (this.settings.autoCoordinate) {
  const coordinates = await model.getCoordinates();
  if (this.baseCoordinates === null) this.baseCoordinates = coordinates;   // ← at COMPLETION
  else model.object.position.add(base − coordinates);
}
```

- **FRAGS** positions every model against `baseCoordinates` — the first model to **finish**.
- **OBC** sets `baseCoordinationMatrix` from `[...this.list.values()][0]`, and
  `FragmentsManager.list` **is** `core.models.list` — written *before* the `await`, so it is the
  first model to **start**.

`OBF.ClipEdges.getStyleMeshes` positions each fill mesh with
`applyBaseCoordinateSystem(mesh, await model.getCoordinationMatrix())`, i.e. off OBC's base, while
the geometry it is supposed to sit on was placed off FRAGS'. With `MAX_PARALLEL = 10` in
`useLoadCloudModelBatch`, the first to start is usually **not** the first to finish, and every fill
is displaced from its model by the constant difference between the two bases.

**Measured, not inferred.** Four models, from the Scene Diagnostics report:

| model | `coords` | expected `pos` = `d6a84941 − own` | reported `pos` |
|---|---|---|---|
| 6ad248cc | −70.0, −2.8, −20.0 | −0.3, 0.4, 23.5 | −0.4, 0.4, 23.5 ✓ |
| d6a84941 | −70.3, −2.4, 3.5 | 0, 0, 0 | 0, 0, 0 ✓ |
| b8bcf62e | −45.5, −0.6, 37.7 | −24.8, −1.8, −34.2 | −24.9, −1.8, −34.1 ✓ |
| 30c9cb49 | −67.2, −0.7, −10.2 | −3.1, −1.7, 13.7 | −3.1, −1.7, 13.8 ✓ |

Every model sits at `d6a84941.coords − own`. But `baseCoordinationModel` read **`6ad248cc`**, and
every fill sat at `6ad248cc.coords − own`. Displacement = `6ad248cc.coords − d6a84941.coords` =
**(0.3, −0.4, −23.5)** — the floating linework, 23.5 units out.

⚠️ **Three earlier diagnoses were confidently wrong**, and the reason is worth keeping: each was
reasoned from a screenshot instead of from runtime state. A stale FRAGS worker
([ADR-0014](0014-frags-worker-from-node-modules.md)), the `getStyleMeshes` cache race, and a leaked
`TechnicalDrawing` were all proposed and two of them were "confirmed" by the symptom disappearing —
which a race will do on its own. The report above killed all three in one run: `children=4/4` (no
cache race), `camera layers mask: 1` (no drawing leak), and the arithmetic above.

## Decision

**The first model loaded into an empty scene loads alone; the rest keep loading ten wide.**

```ts
const serialiseFirstLoad = fragments.list.size === 0;
const waveSize = i === 0 && serialiseFirstLoad ? 1 : MAX_PARALLEL;
```

With one load in flight, first-to-start and first-to-finish are necessarily the same model, so both
bases latch onto it and stay latched for the session. Serialising only into an **empty** scene means
later manual loads and subsequent batches are untouched — the cost is one file's latency at project
open, not a tenth of the throughput.

## Alternatives rejected

- **Reconcile OBC's base after the batch** — find the model whose `getCoordinates()` matches
  `fragments.core.baseCoordinates` and write `baseCoordinationModel`/`baseCoordinationMatrix` to
  match. No latency cost, and it repairs the state rather than avoiding the race. Rejected on three
  counts: it writes vendor fields from app code, it has to re-run after *every* batch, and
  `getStyleMeshes` **caches each fill mesh's transform at creation** — so any `ClipEdges` built
  before the reconcile keeps the stale one and would need a forced rebuild too.
- **`MAX_PARALLEL = 1`** — one line, kills the race outright, no vendor knowledge required.
  Rejected for cost: project open goes roughly ten times slower for a guarantee that only the
  *first* load actually needs.
- **Patch the vendor** (make OBC read `core.baseCoordinates` instead of list order) — the real fix,
  and it would protect every consumer. Rejected as out of reach: ThatOpen is pinned to v3.4.x
  (CLAUDE.md), and a patched `node_modules` is precisely the "manually synced copy that rots" that
  ADR-0014 exists to stop. Worth reporting upstream.
- **Assert the invariant in dev instead of preventing it** — warn when
  `baseCoordinationModel` is not the model at `pos (0,0,0)`. Rejected as the *only* measure: it
  reports the bug rather than fixing it. Kept in spirit — the Scene Diagnostics panel prints
  `base model` as its first line for exactly this check.

## Consequences

- **This closes the whole investigation**, including the two observations
  [ADR-0014](0014-frags-worker-from-node-modules.md) could not explain: one model → both bases are
  that model → clean; sequential manual loads → both bases identical → clean; ten-wide auto-load →
  race → bug. Build-independent, which is why the worker fix appeared to work and then did not.
- ⚠️ **[ADR-0014](0014-frags-worker-from-node-modules.md)'s causation claim is wrong and is
  corrected there.** Its *decision* — import the worker from `node_modules` — **stands**: the
  version mismatch was real and had to be fixed. What it got wrong was crediting that fix with
  curing the displaced fills.
- **The vendor bug is untouched.** Any other code path that loads models in parallel reintroduces
  it, and nothing warns. `useArModelLoader` is safe today only because it loads one model at a time.
- ⚠️ **A small window survives**: `baseCoordinationMatrix` is assigned after an `await`, so it is
  briefly identity even once `baseCoordinationModel` is set. Harmless here — cut planes are created
  by a user click long afterwards — and self-healing in practice, because
  `CoordinatesManager.getCoordinationMatrix` caches the `Matrix4` **before** filling it and then
  mutates that same object in place, so a racing reader ends up holding the correct values.
- **It depends on a vendor ordering detail.** If a FRAGS bump moves where `baseCoordinates` is set,
  this stops working silently. The `base model` line in Scene Diagnostics is the check: it must name
  the model sitting at `pos [0, 0, 0]`.
