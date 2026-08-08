# ADR-0014: The FRAGS worker is imported from `node_modules`, never copied into `public/`

**Status:** Accepted — **causation claim corrected by [ADR-0015](0015-one-base-model-for-coordination.md)**
**Date:** 2026-08-08
**Area:** `docs/feature/bim-viewer.md` § Gotchas (version lock), `docs/feature/bim-viewport-righttoolbars.md` § Fills → Vendor traps, `docs/feature/ar-webxr.md`

> ⚠️ **Read this first.** The **Decision below stands** — the worker really was version-mismatched,
> that really is a breach of the version lock, and importing it from `node_modules` is still right.
> **What this ADR got wrong is the cause of the bug that led us to it.** The displaced section fills
> were *not* caused by the stale worker; they came from FRAGS and OBC disagreeing about which model
> is the coordination base, diagnosed and fixed in
> [ADR-0015](0015-one-base-model-for-coordination.md). The symptom went away here by luck — the
> underlying defect is a load race, and a race resolves cleanly some of the time. Everything in
> § Context below about *why the worker mattered* is therefore speculation that turned out false;
> the version-mismatch facts themselves are unaffected.

## Context

`fragments.init("/worker.mjs")` — in `setup/src/fragments-manager.ts` **and**
`features/ar-viewer/useArModelLoader.ts` — pinned the app to `public/worker.mjs`, a 3 MB binary
committed in `5fe9915` and never refreshed across the bump to `@thatopen/fragments` **3.4.3**. So
main-thread FRAGS was 3.4.3 and the worker was whatever July's copy had been, in direct breach of
CLAUDE.md's *"never mix ThatOpen versions"*.

The correctly versioned worker **was already in the build and never loaded**:

```
dist/worker.mjs             3,297,151   ← stale, what init() actually fetched
dist/assets/worker-*.mjs    3,216,090   ← v3.4.3, emitted by the bundler, unused
```

That second file exists because FRAGS' own default is
`new URL("./Worker/worker.mjs", import.meta.url)`, which Vite statically resolves and emits — the
right worker was one argument away the whole time.

**What exposed it** was a rendering bug, not a version audit: a cut plane's `ClipStyler` fill drew
as floor-plan linework floating clear of any geometry.

> ❌ **The next sentence was the mistake.** It read: *"The worker is what computes `getSection()`
> (the fill geometry) and `getCoordinates()` (model coordination), so a version-mismatched worker
> returns section data the 3.4.3 main thread then places wrongly."* Both halves of the premise are
> true and the conclusion still does not follow — it was never measured, only made plausible by the
> symptom clearing after the fix. The real cause is in
> [ADR-0015](0015-one-base-model-for-coordination.md). Kept visible rather than deleted, because
> the reasoning error is the lesson: a plausible mechanism plus a symptom that stops is not a
> diagnosis.

⚠️ **The diagnosis history matters more than the fix, because it was mostly wrong.** Five
reproduction attempts: two positive (both on the deployed Worker build), three negative (all local).
That table was read as *"reproduces on prod, never on dev ⇒ a race"* and sent the investigation into
`ClipEdges.getStyleMeshes`' cache race for two rounds. The reading was unsound — `public/` is served
identically by dev and by the Worker build, so no `public/` file can produce a dev/prod split, and
the *scenes* differed across those runs as well as the builds. The single-model run was clean for a
real reason: with one model the base coordination **is** that model's own, so the offset is zero and
a mismatched worker's error is invisible.

## Decision

**Import the worker through the package's own `"./worker"` export, and delete the copy.**

```ts
import fragmentsWorkerUrl from "@thatopen/fragments/worker?url"
fragments.init(fragmentsWorkerUrl)
```

Both call sites. `public/worker.mjs` is gone. This makes the version match **a property of the
build** rather than of someone remembering to re-copy a binary. It reuses the `?url` idiom already
established in the repo by `CompareDrawingsModal.tsx` for pdf.js.

## Alternatives rejected

- **`FragmentsManager.getWorker()`** — the vendor's *own documented recommendation*, and it
  guarantees the version match just as well; its docstring says it "requires no copying of files
  into your project." Rejected on what that docstring omits: it **fetches from unpkg at runtime**
  and hands back a blob URL. Model loading would then depend on a third-party CDN being reachable,
  in an app whose every other asset is self-hosted on Cloudflare — a new runtime failure mode, and a
  CSP surface, bought for nothing a build-time import doesn't already give. This is the one to
  re-read before "simplifying" the import into the recommended call.
- **Re-copy the correct worker into `public/`** — one file operation, no build involvement, URL
  unchanged. Rejected because it is *precisely what already rotted*: nothing links the copy to the
  installed version, so the next dependency bump silently recreates this bug and the next person
  spends five reproduction attempts finding it. The manually-synced binary is the defect; the stale
  bytes were only the symptom.
- **Omit the URL and let FRAGS fall back** to `new URL("./Worker/worker.mjs", import.meta.url)` —
  genuinely works here, and is what already emits the unused asset, so it is the smallest possible
  diff. Rejected as implicit: the vendor documents the fallback as working only "with bundlers that
  can resolve" that expression, so it silently depends on Vite; an explicit import states the
  dependency where a reader is looking for it.
- **A `postinstall` script copying the worker into `public/`** — keeps `/worker.mjs` stable for
  anything that hardcoded it. Rejected as a build step bolted on to solve what the bundler already
  solves, still leaving a generated 3 MB binary inside the served tree.

## Consequences

- **The worker URL is now content-hashed**, so anything hardcoding `/worker.mjs` breaks. Both call
  sites are updated and a repo-wide search found no others — but a future service worker, preload
  hint or cache rule must not reintroduce the literal.
- **The AR page is fixed by the same change**, since `useArModelLoader` carried the identical
  literal. It runs an isolated `OBC.Components`, so it needed its own edit rather than inheriting.
- **`dist/` no longer contains a root `worker.mjs`.** Present only as `dist/assets/worker-*.mjs`.
- ⚠️ **The mechanism is inferred, not proven, and two of five observations still do not fit it.**
  Fixing the worker made the symptom go away on PC and phone, which is evidence, not proof of
  causation. **If displaced fills ever return, start here rather than assuming this ADR closed the
  question:**

  | Run | Build | Expected under the worker theory | Observed |
  |---|---|---|---|
  | original desktop | deployed | displaced fill | **displaced fill** ✅ |
  | phone | deployed | displaced fill | **displaced fill** ✅ |
  | one model only | local dev | clean — see below | clean ✅ |
  | reversed load order, ≥2 models | local dev | displaced fill | **clean** ❌ |
  | local dev, real auto-loaded project | local dev | displaced fill | **clean** ❌ |

  The single-model run **is** explained: with one model the base coordination is that model's own,
  so the offset is zero and a mismatched worker's error is invisible. The last two are not.

  > ✅ **Resolved by [ADR-0015](0015-one-base-model-for-coordination.md), and the two misfits were
  > the tell.** They did not fit because the theory was wrong. The real cause is a **load race**
  > between two different "first model" rules, so a clean run proves nothing — sequential manual
  > loads always coordinate correctly, and a ten-wide parallel load usually does not. Every row
  > above falls out of that. **The lesson to keep: two observations that did not fit were treated
  > as noise, and they were the signal.**
  >
  > The probe was later restored, extended and promoted into the permanent **Scene Diagnostics**
  > panel (Viewport Settings), which is what finally produced the measurement. It is no longer in
  > git history only — see `bim-viewport-toolbars.md` § Settings.
- **A stale vendored binary is now a named hazard, not a one-off.** `public/resources/` still holds
  vendored assets; the same rot applies to any of them that shadow a versioned package.
