# CLAUDE.md — PIAS-BimWebApp (BIMBOY)

> **Read this before writing any code.** Defines project identity, stack, architecture rules, and the mandatory workflow. It is **the authoritative set of instructions** for every AI working here — not a description of how the code behaves; the code itself is the only authority on that (see § The code is the source of truth). `AGENTS.md` points here; `.agents/` mirrors the skills only. All prose docs live in **`docs/`**.

## 👤 Developer Profile

**Senior Software Developer.** Expertise: BIM (IFC/clash detection/clipping), GIS (Cesium/coordinates), Web (React/Three.js/Vite/TypeScript/Supabase).

**Communication:** Concise, technical. Surface tradeoffs. Ask one concrete question with a recommended option.

---

## ⚡ Quick Reference

| What | Where | Rule |
|------|-------|------|
| Custom OBC components | `bim-components/` | Extend `OBC.Component`, implement `Disposable` |
| State mgmt (UI/modal) | `uiStore` in `store/` | Use Zustand, never React state for layout |
| Async data (API calls) | TanStack Query in `features/` | Never in routes/components |
| BUI web components | Only inside `ViewportWrapper.tsx` | Shadow DOM isolation mandatory |
| Routes | Composition only | No logic, state, or fetching |
| Imports | Always `@/*` alias | Never `../../../` relative paths |

---

## 📚 Domain Guides

This file holds the **rules**; these guides hold the **detail** — deep and project-specific, loaded on demand. When a task goes deep into an area below, read its guide. One file per architectural area under **`docs/feature/`**, no copies anywhere else. Guides document *how this project wires things* — they never re-document a framework (that's the skills + `docs/ThatOpen_docs/`).

| Working on … | Load guide |
|--------------|-----------|
| React, routing, Zustand stores, views/features/components, Tailwind | `docs/feature/frontend.md` |
| ThatOpen/OBC viewer wiring, world setup, IFC/FRAG loading, BUI containment | `docs/feature/bim-viewer.md` |
| Bottom toolbar rail, dropdown/menu conventions, cross-button hazards | `docs/feature/bim-viewport-toolbars.md` |
| Right rail tools — Measure, Clip (section planes), Sectionbox, Coordinate — button **and** engine, plus `GizmoAxis` | `docs/feature/bim-viewport-righttoolbars.md` |
| Supabase auth, DB, storage, feature services, `AuthContext` | `docs/feature/backend.md` |
| Clash import (BCF), clash register/table/filters, clash dashboard | `docs/feature/clash-detection.md` |
| Drawing Directory, shop-drawing register, PDF revisions | `docs/feature/drawing.md` |
| GIS layers, Cesium 3D Tiles, coordinates/CRS | `docs/feature/gis-cesium.md` |
| AR / WebXR viewing, `/ar/$projectId`, ModelsView AR tab | `docs/feature/ar-webxr.md` |
| IOT tab — authored devices, live readings, viewport chips | `docs/feature/iot.md` |

**The `docs/` tree:**

| Path | Holds |
|------|-------|
| `docs/feature/` | The 10 domain guides above — a **map** of how this project wires each area: what exists, how it fits together, and what will bite you |
| `docs/adr/` | Architecture decision records — *why* a decision was made, with the alternatives rejected. See `docs/adr/README.md` |
| `docs/glossary.md` | The domain glossary — terms only, no implementation detail. Written by `/domain-modeling`, **lazily**: it does not exist until the first term is resolved |
| `docs/agents/` | How the engineering skills consume this repo: `issue-tracker.md` (where tickets live) and `domain.md` (which doc holds what). See § Agent skills |
| `docs/ThatOpen_docs/` | Vendored ThatOpen documentation snapshot (v3.4.x). Read-only reference — start at its `INDEX.md`, never hand-edit |

**Upstream OBC source — outside this repo:**

`../_vendor/engine_components/` is a git clone of `ThatOpen/engine_components`, checked out at branch **`pinned-core-3.4.2`** (commit `b16bcfe9`). Read-only — never edit it, never copy files out of it wholesale.

⚠️ **That branch now lags what this app installs** (`@thatopen/components@3.4.8` — see [ADR-0018](docs/adr/0018-thatopen-3-4-8-patch-bump.md)). The clone's own `origin/main` is already exactly 3.4.8, so re-syncing is a branch move, not a fetch. Until it is re-pointed, treat the checked-out tree as **3.4.2** and diff forward when you need current behaviour.

| Use it for | Where |
|---|---|
| Idiomatic minimal usage of a component | `packages/*/src/**/example.ts` (37 files, maintainer-written) |
| Runnable demo of a component | `examples/<Name>/` — `yarn dev` in the clone serves the gallery |
| How a component actually behaves | `packages/core/src/`, `packages/front/src/` |
| What an upgrade would change | `git diff pinned-core-3.4.2..main -- packages/core/src` |

Two caveats, both load-bearing:

1. **Installed typings outrank this clone.** `node_modules/@thatopen/components/dist/index.d.ts` is the authority on what *your* version exposes — and right now the gap is a whole patch channel, not a rounding error: the checked-out branch is `core` 3.4.2 / `components-front` 3.4.2, against **3.4.8 / 3.4.4** installed. `git log pinned-core-3.4.2..origin/main -- packages/core/src packages/front/src` is 50 commits, several of them `feat:`. Never read a signature out of the clone and assume it is what you have installed.
2. Reach for `docs/ThatOpen_docs/INDEX.md` first for signatures. Drop to this source only when the docs are silent, stale, or you need to read the implementation.

### 🧭 The code is the source of truth

**No document outranks the code.** When a guide and the code disagree, **the guide is wrong** — fix the guide, never bend working code to match stale prose. Docs still matter, because they hold knowledge the code cannot:

| | Role | Authority |
|---|---|---|
| **the code** | the system itself | **the only truth about behaviour** |
| **`docs/feature/`** | what exists, how it fits, what will bite you | navigational — loses to the code, always |
| **`docs/adr/`** | *why*, and what was tried and rejected | **the only source; not derivable from code** |
| **`docs/glossary.md`** | what each domain term means, and which synonyms to avoid | **the only source; naming is a decision, not a fact about the code** |
| **`CONTEXT.md`** | in-flight decisions, during planning | temporary by definition |

Nothing in `ClipperCursor` reveals that a grabbable translucent quad was *shipped and reversed within a day* — [ADR-0002](docs/adr/0002-section-plane-outline-only.md) is the only reason it hasn't been built a third time. Vendor traps found by reading `node_modules` are the same.

**Writing them:**
1. ⚠️ **Cite symbols, not line numbers** — `_syncVisibility`, never `index.ts:220`, which rots on the next edit. Same for cross-file references to *this* file: cite a step by name, not number. **Exception:** pinned vendor bundles may be cited by line (as [ADR-0003](docs/adr/0003-worker-side-snapping-over-cpu-picking-meshes.md) does), since v3.4.x offsets are stable and minified code has no symbols worth naming.
2. **Don't restate what the code says plainly** — that adds drift surface, not knowledge.
3. **Do record what it can't say** — why, what was rejected, what bites, where the vendor lies.

**Timing:** update the matching guide (+ an ADR when the *why* lasts) **only after the developer has tested the change and confirmed it works** — see Workflow § *Verify with the developer*, and `docs/adr/README.md`, whose promotion flow already says "implemented **+ merged**". Two exceptions, both written *during* the work because neither is a permanent record of behaviour: `CONTEXT.md` (staged decisions, cleared on promotion) and `docs/glossary.md` (a term is settled the moment you agree on the word — `/domain-modeling` writes it inline, mid-interview).

---

## 🏗️ Project Identity

**BIMBOY:** Digital BIM Management Platform on [ThatOpen](https://docs.thatopen.com) ecosystem. Centralizes models, documents, coordination, and GIS data.

**Roadmap:**  
1. BIM Model Viewer (IFC/OBC)  
2. Clash Detection (BCF import)  
3. Document Management (revisions)  
4. Drawing Management (CAD/PDF)  
5. BIM + GIS (Cesium 3D Tiles)

---

## 🛠️ Tech Stack

**Frontend:** React 19 · @tanstack/react-router (file-based) · Zustand v5 · Tailwind v4  
**Data:** TanStack Query · Zod v4  
**BIM:** @thatopen/components + @thatopen/ui **v3.4.x** · Three.js ^0.182  
**Backend:** Supabase (auth, DB, storage)  
**Build:** Vite 7 + router plugin + tsconfig paths  
**Deploy:** Cloudflare Workers static assets (git-connected, auto-deploys `main`) · SPA routing via `wrangler.jsonc` (`assets.not_found_handling`) · `VITE_*` env vars must be set under Worker Settings → Build → Variables and secrets (build-time), not the runtime Variables and secrets page — a static-assets-only Worker rejects runtime vars entirely  
**Utilities:** lucide-react · date-fns · TypeScript ^5.2  

**⚠️ Critical constraint:** ThatOpen pinned to **v3.4.x** — check peer deps (Three.js, web-ifc) before upgrading.

---

## 📁 Directory Structure

```
src/
├── bim-components/          ← Custom OBC.Component subclasses
│   ├── setup/               ← World/engine bootstrap (singleton — don't edit)
│   ├── ClashImport/, GisLayers/, SmartViews/, etc.
├── react-components/
│   ├── components/          ← Pure UI (props + Tailwind only)
│   ├── features/            ← Stateful logic + data fetch (kebab-case subdirs)
│   ├── views/               ← Page layouts with LAYOUTS pattern (flat files)
│   ├── store/               ← Zustand stores (uiStore, bimStore, etc.)
├── integrations/supabase/   ← Supabase client + typed helpers
├── routes/                  ← TanStack Router file-based routes
├── classes/                 ← Pure TS domain classes (no React)
├── types/                   ← Shared TypeScript interfaces
├── lib/                     ← Utilities (cn, etc.)
├── globals.ts, router.tsx, style.css, main.tsx
```

---

## 📐 Architecture

### Where Code Lives

**Decision tree:**
```
New file?
├─ OBC.Component subclass           → bim-components/
├─ Store hook / fetch / useEffect    → features/ (kebab-case subdirs)
├─ LAYOUTS + view composition        → views/ (flat at root, export via index.ts)
├─ Route entry point                 → routes/
├─ Pure UI (props only)              → components/
├─ TS class (no React)               → classes/
└─ Helper function                   → lib/
```

**Layer isolation:**
- `components/` — props + Tailwind only. No store, Supabase, BIM, routing.
- `features/` — store hooks, Supabase, BIM logic. No routing, other features.
- `views/` — compose features + components. No direct Supabase.
- `routes/` — composition only. No logic, state, or data fetching.
- `store/` — Zustand state shape only. No React components.
- `bim-components/` — OBC/Three.js only. No React state or Tailwind.

### State Location

| State | Home |
|-------|------|
| Modal open/collapse/layout | `uiStore` |
| Projects + active project | `projectStore` |
| Clash data + filters | `clashStore` |
| BIM world + engine | `bimStore` |
| URL-shareable params | Router search params |
| API async ops | TanStack Query |
| Auth lifecycle | `AuthContext` only |

### Routes Pattern

Routes are composition only — no logic, state, or fetching. → ✅/❌ example in `docs/feature/frontend.md`.

### Views Pattern

Layout state always from the store (never `useState`); views compose via a `LAYOUTS` grid const. → example in `docs/feature/frontend.md`.

### Naming

| Target | Format | Example |
|--------|--------|---------|
| React components | PascalCase | `PropertyPanel.tsx` |
| Zustand stores | camelCase+Store | `bimStore.ts` |
| OBC components | PascalCase | `ClashImport/` |
| Functions | camelCase | `cn()`, `formatDate()` |
| Zod schemas | PascalCase+Schema | `ClashItemSchema` |
| Routes | kebab-case/$param | `clash-filter.tsx`, `$projectId.tsx` |
| Feature dirs | kebab-case | `property-panel/`, `clash-filter/` |

## 🪟 BUI / Shadow DOM

`<bim-*>` components create shadow DOM — styles and events bleed if scattered. **Containment rule:**
- ✅ ONLY inside `components/bim/ViewportWrapper.tsx`
- ❌ NEVER `<bim-panel>`, `<bim-panel-section>`, `<bim-grid>` anywhere else
- Use React components instead: `LeftPanel.tsx`, `RightPanel.tsx`
- Theme via CSS vars (`--bim-*`) in `style.css @theme {}` — no inline overrides

## 🎨 Styling

- Tailwind utilities only — no plain CSS class names
- Conditional classes via `cn()` from `@/lib/utils`
- No `!important` or raw `oklch()` in JSX
- Custom base styles in `@layer base {}` in `style.css`
- Design tokens from `DESIGN.md` — never hardcode colours

## 🧭 TanStack Router

- `routeTree.gen.ts` — auto-generated, never edit manually
- All routes use `createFileRoute()` with composition-only components
- Navigate with `useNavigate()` or `<Link>`
- Access params via `Route.useParams()`

## 🔬 BIM / ThatOpen

**Before coding any OBC feature:**
1. Read ThatOpen docs — start at [`docs/ThatOpen_docs/INDEX.md`](docs/ThatOpen_docs/INDEX.md) (the navigation entry point: concepts, tutorials, full API symbol index)
2. Check the API against the pinned version — v2 examples do not apply (pin + peer-dep warning under § Tech Stack)

**New OBC component:** follow the `_thatopen-bim-component` skill. → project wiring + step checklist in `docs/feature/bim-viewer.md`.

**Never mix ThatOpen versions, and never bootstrap OBC inside React** — the world is a singleton in `bim-components/setup/`.

## 📋 Workflow

This project follows **Matt Pocock's main flow** (`.claude/skills/`, upstream `mattpocock/skills`). `/ask-matt` is the router over every skill here; read it when you're unsure which one fits. This section records only what the flow is and **where this repo overrides it**.

| Role | Responsibility |
|------|-----------------|
| Claude (you) | Runs the flow end to end: grill → spec → tickets → implement → review. Presents the diff |
| Developer | **Decides and approves.** Answers the grilling, confirms the seams, tests in the real app, reviews the diff, and commits/merges personally |

### The main flow: idea → ship

| # | Step | What it does |
|---|------|--------------|
| 1 | **`/grill-with-docs`** | Sharpens the idea by interview, and writes what it settles to `docs/glossary.md` / `docs/adr/` as it goes. Always start here — never `/grill-me`, which leaves no paper trail |
| 2 | **`/to-spec`** | Turns the thread into a spec at `.scratch/<feature>/spec.md`. Confirms the **test seams** with the developer first |
| 3 | **`/to-tickets`** | Splits the spec into tracer-bullet tickets under `.scratch/<feature>/issues/`, each declaring its `Blocked by:` edges |
| 4 | **`/implement`** | Builds one ticket, driving `/tdd` at the agreed seams. `/clear` between tickets — each is self-contained |
| 5 | **`/code-review`** | Two-axis review (Standards + Spec) of the diff, in a fresh sub-agent |

**Small change?** Steps 2–3 are for multi-session builds. A change that fits one context window goes straight from the grilling to `/implement`.

**Context hygiene.** Keep steps 1–3 in **one unbroken context window** — the grilling, spec, and tickets must build on the same thinking. `/compact` at a phase boundary if the window gets long; don't push on degraded. `.claude/skills/ask-matt/PHASE-BOUNDARIES.md` has the decision tree.

### On-ramps — two ways in that aren't step 1

| Situation | Skill | Merges back at |
|---|---|---|
| **Something's broken** — a bug that resists a first glance, an intermittent flake, a regression between two known-good states | **`/diagnosing-bugs`** | Fixes in place with a regression test. Model-invoked, so it starts itself when you report a bug |
| **A huge, foggy effort** the way to isn't visible yet — a greenfield area or a build too big for one session | **`/wayfinder`** | Produces **decisions, not deliverables**, then hands off to step 2 `/to-spec` |

`/diagnosing-bugs` will not theorise until it has a **tight feedback loop** — one command that already goes red on *this* bug. In this repo that usually means a Playwright spec under `e2e/`, since there is no unit-test runner. Give it one, or expect it to build one first.

`/wayfinder` is slow and dense, and only pays off when you genuinely can't see the route. A well-scoped feature goes to `/grill-with-docs`, not here.

### ⚠️ Three overrides — these beat the skill files

The skills are upstream and unmodified; where they conflict with the rules below, **these win**.

1. **Never commit, never merge.** `/implement` ends with "Commit your work to the current branch" and `/code-review` runs "before committing" — **ignore both**. Stop at the diff, presented and explained. The developer commits personally. Work on a feature branch, never `main`.

2. **`CONTEXT.md` is not the glossary.** `/domain-modeling` treats `CONTEXT.md` as the glossary; here it is the **staging buffer** for in-flight decisions, and the glossary is **`docs/glossary.md`**. Full table in `docs/agents/domain.md`.

3. **`docs/feature/` still exists, and still gates on testing.** The upstream layout has no equivalent of the 10 area guides; this repo keeps them. Update the matching guide only **after** the developer confirms the change works — never off `tsc` and a build.

### Verify with the developer

`/implement` finishes when the code is written and reviewed, not when it works. Before saying a feature is done:

- Say plainly **what was actually verified and what was not**. "`tsc` and the build pass" is not "it works"
- Name the things only a running app can confirm — the visual result, the feel of an interaction, whether the fix fixes the reported bug. Suggest `/run`
- Then **stop and wait**. Fix what testing surfaces, and hand back

Only once the developer confirms it works: promote out of `CONTEXT.md` into the matching `docs/feature/` guide, plus an ADR when the *why* has lasting value. Document what testing **established**, not what the plan predicted.

### Uncertain?

Ask **one** concrete question with a recommended option. Never assume state placement, data shape, or layer assignment.

## 🤖 Agent skills

Configuration the engineering skills read. Written by `/setup-matt-pocock-skills`.

### Issue tracker

Local markdown under `.scratch/<feature>/` — the repo has a GitHub remote but no `gh` CLI, and `.scratch/` is gitignored. See `docs/agents/issue-tracker.md`.

### Triage labels

None. The `triage` skill is not installed, so there is no label vocabulary and no `docs/agents/triage-labels.md`. Every ticket `/to-tickets` produces is agent-ready by construction.

### Domain docs

Single-context, but **split**: glossary at `docs/glossary.md`, staging buffer at `CONTEXT.md`, decisions in `docs/adr/`, area guides in `docs/feature/`. See `docs/agents/domain.md`.

## 🚫 Hard Constraints

| Constraint | Why |
|-----------|-----|
| No `<bim-*>` outside `ViewportWrapper.tsx` | Shadow DOM bleeds styles/events |
| No logic/state/fetch in `routes/` | Routes are composition only |
| No `!important` or raw `oklch()` in JSX | Token integrity |
| No relative imports — use `@/*` (example in `docs/feature/frontend.md`) | Refactor safety. ⚠️ Inside `bim-components/` the opposite holds — see `docs/feature/bim-viewer.md` |
| Never edit `routeTree.gen.ts` | Vite plugin overwrites it |
| No auth state in Zustand | Auth needs React context lifecycle |
| No files in `react-components/` root | Use subdirs: `components/`, `features/`, `views/`, `store/` |
| No OBC bootstrap in React | Singleton world in `bim-components/setup/` |
| No Supabase in `views/` or `components/` | Data access is `features/` responsibility |
| No `features/index.ts` barrel | Circular deps + HMR slowdown |
| No subdirs under `views/` | Views must be flat at root |
| Never work directly on `main` — always a feature branch | The developer merges; nothing lands unreviewed |
| No AI prompts/offers to `git add`/commit/merge | Developer reviews the real `git diff` and commits personally. ⚠️ **Overrides `/implement` and `/code-review`**, which both end by committing — see Workflow § Three overrides |
| No `docs/feature/` or ADR edits before the developer confirms it works | Docs written for untested code get rewritten when testing changes the design, and assert as settled what nobody has seen run. `CONTEXT.md` and `docs/glossary.md` are the exceptions — one is explicitly in-flight, the other records an agreed word, not a behaviour |
| Never report "it works" off static checks alone | `tsc` and a build prove it compiles, not that it behaves. Say what was checked and what was not |
| No test at a seam the developer hasn't confirmed | `/tdd`'s rule: agreeing seams up front is what puts testing effort on the critical paths instead of every edge case |
| Never treat `CONTEXT.md` as the glossary | It is the staging buffer. The glossary is `docs/glossary.md`. ⚠️ **Overrides `/domain-modeling`** — see `docs/agents/domain.md` |
