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

**The `docs/` tree:**

| Path | Holds |
|------|-------|
| `docs/feature/` | The 9 domain guides above — a **map** of how this project wires each area: what exists, how it fits together, and what will bite you |
| `docs/adr/` | Architecture decision records — *why* a decision was made, with the alternatives rejected. See `docs/adr/README.md` |
| `docs/ThatOpen_docs/` | Vendored ThatOpen documentation snapshot (v3.4.x). Read-only reference — start at its `INDEX.md`, never hand-edit |

### 🧭 The code is the source of truth

**No document outranks the code.** When a guide and the code disagree, **the guide is wrong** — fix the guide, never bend working code to match stale prose. Docs still matter, because they hold knowledge the code cannot:

| | Role | Authority |
|---|---|---|
| **the code** | the system itself | **the only truth about behaviour** |
| **`docs/feature/`** | what exists, how it fits, what will bite you | navigational — loses to the code, always |
| **`docs/adr/`** | *why*, and what was tried and rejected | **the only source; not derivable from code** |
| **`CONTEXT.md`** | in-flight decisions, during planning | temporary by definition |

Nothing in `ClipperCursor` reveals that a grabbable translucent quad was *shipped and reversed within a day* — [ADR-0002](docs/adr/0002-section-plane-outline-only.md) is the only reason it hasn't been built a third time. Vendor traps found by reading `node_modules` are the same.

**Writing them:**
1. ⚠️ **Cite symbols, not line numbers** — `_syncVisibility`, never `index.ts:220`, which rots on the next edit. Same for cross-file references to *this* file: cite a step by name, not number. **Exception:** pinned vendor bundles may be cited by line (as [ADR-0003](docs/adr/0003-worker-side-snapping-over-cpu-picking-meshes.md) does), since v3.4.x offsets are stable and minified code has no symbols worth naming.
2. **Don't restate what the code says plainly** — that adds drift surface, not knowledge.
3. **Do record what it can't say** — why, what was rejected, what bites, where the vendor lies.

**Timing:** update the matching guide (+ an ADR when the *why* lasts) **only after the developer has tested the change and confirmed it works** — see Workflow § *Document*, and `docs/adr/README.md`, whose promotion flow already says "implemented **+ merged**". `CONTEXT.md` is the exception: it is written during planning, and is safe to write early precisely because it is never the permanent record.

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
**Data:** TanStack Query · Zod v3  
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

| Role | Responsibility |
|------|-----------------|
| Claude (you) | Primary developer — reads, plans, implements, hands over for testing, fixes what testing finds, reviews & simplifies, **then** documents, and presents the diff |
| Developer (you're working with) | **Tester and final approver** — runs the feature in the real app and says whether it works; reviews the diff and commits/merges personally |

Steps run in order. Cite them **by name**, not number, anywhere outside this file.

**1. Read first**
- OBC feature? → read [`docs/ThatOpen_docs/INDEX.md`](docs/ThatOpen_docs/INDEX.md) first, then the relevant tutorial/API doc it points to
- Custom OBC component? → `_thatopen-bim-component` skill
- BUI patterns? → `.claude/skills/`

**2. Plan before code**
- Use `grill-with-docs` skill for requirements + layer placement
- New architecture, cross-cutting refactor, tricky bug, or multiple viable approaches? → suggest the developer run `/fable-advisor` (developer-triggered only, never auto-invoked) to get a second opinion from Fable before finalizing the plan
- Use `plan-visualizer` skill for: current flow (Mermaid) + proposed flow (mark `[NEW]`/`[MOD]`/`[DEL]`) + pros/cons + files — written to `plan-visualizer.md` at the project root
- **Get explicit approval before coding**

**3. Execute — code only**
- Implement the approved plan directly.
- Work on a feature branch, never directly on `main`.
- **Write no domain guide and no ADR yet.** Code, and the checks that can run without a human (`tsc`, build, any project check script). Stop there.

**4. Hand over for testing** ⟵ _the gate_
- Say plainly what was built, **what was actually verified, and what was not**. "`tsc` and the build pass" is not "it works".
- Name the specific things only a running app can confirm — visual result, feel of an interaction, whether the fix actually fixes the reported bug.
- Then **stop and wait**. The developer tests in the real app. Suggest `/run` if it helps.
- Fix what testing surfaces, and hand back. Loop 3 ⟷ 4 until the developer says it works.

**5. Refine — review & simplify** _(non-trivial changes only)_
- Skip both passes for genuinely trivial edits (typo, rename, import fix, single-line tweak, config bump) — no need to ask, just say so in one line so it's visible.
- Otherwise **ask the developer two things together**: whether to run review + simplify at all, and **whether it runs before or after their testing** — that ordering is a per-task call, so never assume a default.
  - *Before testing* → they test code that has already had a correctness pass, at the risk of reviewing code a design change is about to replace.
  - *After testing* → the behaviour is settled first, so nothing is reviewed twice.
- If yes:
  1. **Code-review** via a **fresh sub-agent** (`code-review` skill) — independent eyes that did not write the code
  2. **Apply confirmed findings**; report any deliberately not acted on + why
  3. **Simplify** inline (`simplify` skill) on the now-correct code
  4. **Light behavior-preservation check** after simplify — verify nothing changed semantically (not a full second review)
- If no: go straight to § *Document*.

**6. Document — only once it is proven**
- Trigger: the developer has confirmed the feature works. **Never before.**
- Promote out of `CONTEXT.md`: update the matching `docs/feature/` guide, and add an ADR when the *why* has lasting value (`docs/adr/README.md`). Clear the staged entry.
- Document **what testing actually established**, not what the plan predicted. Where the two differ, the code wins and the difference is worth a line.
- If testing changed the design, correct the staged `CONTEXT.md` entry too — a stale rejected-alternatives list is worse than none.

**7. Uncertain?**
- Ask one concrete question with a recommended option
- Never assume state placement, data shape, or layer assignment

**8. Present & stop**
- Do not prompt, ask, or offer to run `git add` / `git commit` / merge
- Present the diff/result and stop — the developer reviews and commits personally
- Segment the final diff so it's clear what came from where: **implemented** / **changed after testing** / **changed by review** / **changed by simplify**

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
| No AI prompts/offers to `git add`/commit/merge | Developer reviews the real `git diff` and commits personally |
| No `docs/feature/` or ADR edits before the developer confirms it works | Docs written for untested code get rewritten when testing changes the design, and assert as settled what nobody has seen run. `CONTEXT.md` is the exception — it is explicitly in-flight |
| Never report "it works" off static checks alone | `tsc` and a build prove it compiles, not that it behaves. Say what was checked and what was not |
