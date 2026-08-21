# ADR-0018: ThatOpen 3.4.x "patch" releases carry feature work; 3.4.8 was taken deliberately, not routinely

**Status:** Accepted
**Date:** 2026-08-21
**Area:** `docs/feature/bim-viewer.md` § Picking (clip-aware raycasting)
**Amends:** [ADR-0007](0007-clip-aware-raycaster.md) § Consequences → the `useFastModelPicking` bullet

## Context

`CLAUDE.md` pins ThatOpen to **v3.4.x** and tells you to check peer deps before upgrading. That
framing makes a move *within* 3.4.x read as free: same minor, peer deps unchanged
(`three >=0.182.0`, `web-ifc >=0.0.77` on both sides), so `npm outdated` showing `3.4.2 → 3.4.8`
looks like five patch bumps and a lockfile diff.

It is not. `git diff pinned-core-3.4.2..origin/main -- packages/core/src packages/front/src` is
**50 commits**, and they are not fixes around the edges — they rewrite the picking and snapping
subsystems this app has the most custom code in:

| Upstream commit | Why it matters here |
|---|---|
| `f9ec1e16 chore: remove useFastModelPicking flag` | `ClipAwareRaycaster` branched on it — compile error |
| `de319641 feat: unified GPU-pick fast path for non-snap raycasts` | the flag's behaviour became unconditional |
| `39583f6f feat: SnapResolver — main-thread snap from cached shell geometry` | contests [ADR-0003](0003-worker-side-snapping-over-cpu-picking-meshes.md)'s central premise |
| `450a6a39 feat: measurement tools follow cursor live, sync mode deprecated` | ADR-0003 documents `delay = 0` as load-bearing |
| `fbc06a61 perf: gate Hoverer + Measurement on user-input events` | measure no longer responds to synthetic input |
| `9d8e374a feat(Highlighter): style priorities` | styles now override instead of destroying each other |
| `71b3db46 chore: expose logo` | a vendor logo now draws in the viewport |

The semver channel is the wrong instrument for this vendor. Peer-dep compatibility says the bump
*installs*; it says nothing about whether an override that forks vendored logic still holds.

## Decision

**Take the bump, but treat it as an upgrade with a test plan rather than a version-number edit.**

Exactly one source change was required: the `this.useFastModelPicking` term was **removed** from
`ClipAwareRaycaster.castRay`'s fast-path guard rather than replaced. It was provably dead here —
the flag defaulted to `false` and nothing in `src/` ever set it, so the term never fired — and
3.4.8 deletes the property outright.

What was checked, and what each check actually establishes:

- `tsc` + production build — compiles; **the bundle shrank ~1 MB**, consistent with upstream
  deleting the CPU picking path.
- Model load → render → select → properties, on a real IFC — fragments 3.4.7 pipeline intact.
- **Section plane placed, dragged through geometry, then clicked into the cut → nothing selected.**
  This is the one that mattered: it is ADR-0007's whole reason for existing, and the GPU fast path
  becoming unconditional was the plausible way to silently undo it. It held.
- Length measurement, **by hand** — synthetic clicks commit a `0.00 m` line under `fbc06a61`'s
  input gating, so automation cannot answer this. The developer confirmed it measures correctly.

## Alternatives rejected

- **Stay on 3.4.2.** The pin is a floor for compatibility, not a policy of never moving; refusing
  patch-channel moves indefinitely means the eventual jump is 50 commits *plus* however many more.
  Rejected, but note the real cost this records: the move is only cheap because the two overrides
  that could break — `ClipAwareRaycaster` and the measure snap path — were both testable in minutes
  against a known repro. Without those repros this bump is not safe to take blind.
- **Bump only `@thatopen/fragments`.** Impossible as stated: `components@3.4.8` tightens its peer to
  `@thatopen/fragments: ~3.4.7` (upstream `2be954db`, for `getLocalIdsFromItemIds`), so components
  and fragments move together or not at all.
- **Reintroduce `useFastModelPicking` as a local field** to keep the guard's shape and ADR-0007's
  bullet true. Rejected: it would fake a vendor opt-out that no longer exists, leaving a flag that
  reads like it controls vendor behaviour while controlling nothing.
- **Adopt `SnapResolver` while here.** It is the natural successor to ADR-0003's investigation and
  it is now in both `components` and `components-front` typings — but adopting it is a design change
  to the measure path, not part of a version bump, and the worker path ADR-0003 chose still works.
  Deliberately left for its own decision.

## Consequences

- **ADR-0007's `useFastModelPicking` bail-out no longer exists.** There is now no documented path by
  which a consumer opts out of clip-aware picking — which is *better*, not worse: the gap that bullet
  warned about is closed rather than merely unentered.
- ⚠️ **ADR-0003's premise is now contested upstream.** It deleted the CPU picking path because
  "FRAGS 3.4.x snaps in the worker"; 3.4.8 adds main-thread snapping from cached shell geometry. The
  decision was **re-tested and upheld** — `raycastWithSnapping` still exists, the picker's default
  mode still routes to it, and `getClippingPlanesEvent` still defaults to `() => []`, so this app's
  main-thread clip filtering is still necessary and non-duplicative. But the *reasoning* now has a
  live alternative it did not have when written.
- ⚠️ **Vendor bundle line citations across the ADRs predate this bump and are stale.** `CLAUDE.md`
  permits citing minified bundles by line "since v3.4.x offsets are stable" — 50 commits is the
  counterexample. Affected: ADR-0003 most heavily, plus anything else citing `components/index.mjs`,
  `components-front/index.js` or `fragments/index.mjs` offsets. The symbol names in those citations
  are still correct; only the numbers rotted.
- **The `../_vendor/engine_components/` pin no longer matches what is installed.** `CLAUDE.md`'s
  `pinned-core-3.4.2` branch exists so the clone matches the installed version. The clone's
  `origin/main` is already exactly 3.4.8, so re-pointing the pin is a branch move, not a fetch.
- **A vendor logo now renders in the viewport** (`71b3db46`). Not suppressed here; noted so the next
  person does not hunt for it in this repo's own code.
- **Measure cannot be regression-tested by automation any more.** `fbc06a61` gates picks on
  user-input events, so a browser-driven pass will report a false failure. Any future measure change
  needs a human at the mouse — record that in the test plan, not as a surprise.
