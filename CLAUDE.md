# CLAUDE.md — PIAS-BimWebApp (BIMBOY)

> **Read this before writing any code.** Defines project identity, stack, architecture rules, and mandatory workflow. This file is the **single authoritative guide** for every AI working in this repo. `AGENTS.md` points here; `.agents/` mirrors the skills only. All prose docs live in **`docs/`**.

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

This file is the **map**; these guides are the **territory** — deep, project-specific detail loaded on demand. When a task goes deep into an area below, read its guide. The domain guides live under **`docs/feature/`** — one file per architectural area, no copies anywhere else. Guides document *how this project wires things* — they never re-document a framework (that's the skills + `docs/ThatOpen_docs/`).

| Working on … | Load guide |
|--------------|-----------|
| React, routing, Zustand stores, views/features/components, Tailwind | `docs/feature/frontend.md` |
| ThatOpen/OBC viewer wiring, world setup, IFC/FRAG loading, BUI containment | `docs/feature/bim-viewer.md` |
| Viewport toolbar rails, `Toolbar*.tsx` buttons, dropdown/menu conventions | `docs/feature/bim-viewport-toolbars.md` |
| Supabase auth, DB, storage, feature services, `AuthContext` | `docs/feature/backend.md` |
| Clash import (BCF), clash register/table/filters, clash dashboard | `docs/feature/clash-detection.md` |
| Drawing Directory, shop-drawing register, PDF revisions | `docs/feature/drawing.md` |
| GIS layers, Cesium 3D Tiles, coordinates/CRS | `docs/feature/gis-cesium.md` |
| AR / WebXR viewing, `/ar/$projectId`, ModelsView AR tab | `docs/feature/ar-webxr.md` |

**The `docs/` tree:**

| Path | Holds |
|------|-------|
| `docs/feature/` | The 8 domain guides above — permanent record of how this project wires each area |
| `docs/adr/` | Architecture decision records — *why* a decision was made, with the alternatives rejected. See `docs/adr/README.md` |
| `docs/ThatOpen_docs/` | Vendored ThatOpen documentation snapshot (v3.4.x). Read-only reference — start at its `INDEX.md`, never hand-edit |

**Keep guides current:** `docs/feature/` is the single source of truth. When a change alters something critical or important in one of these areas, update the matching `docs/feature/` guide as part of the same change. In-flight decisions stage in `CONTEXT.md`, then get promoted into a domain guide (and an ADR when the *why* matters) — see `docs/adr/README.md`.

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
2. Check v3.4.x API (breaking changes from v2)

**New OBC component:** follow the `_thatopen-bim-component` skill. → project wiring + step checklist in `docs/feature/bim-viewer.md`.

**Version constraint:** All ThatOpen libs pinned to **v3.4.x** — never mix versions or bootstrap OBC inside React

## 📦 Imports

Always use `@/*` alias. Never relative `../../../` paths. → example in `docs/feature/frontend.md`.

## 📋 Workflow

You (Claude) are the **primary developer**. The developer is the final approver who reviews the diff and commits personally.

**1. Read first**
- OBC feature? → read [`docs/ThatOpen_docs/INDEX.md`](docs/ThatOpen_docs/INDEX.md) first, then the relevant tutorial/API doc it points to
- Custom OBC component? → `_thatopen-bim-component` skill
- BUI patterns? → `.claude/skills/`

**2. Plan before code**
- Use `grill-with-docs` skill for requirements + layer placement
- New architecture, cross-cutting refactor, tricky bug, or multiple viable approaches? → suggest the developer run `/fable-advisor` (developer-triggered only, never auto-invoked) to get a second opinion from Fable before finalizing the plan
- Use `plan-visualizer` skill for: current flow (ASCII) + proposed flow (mark `[NEW]`/`[MOD]`/`[DEL]`) + pros/cons + files
- **Get explicit approval before coding**

**3. Execute**
- Implement the approved plan directly. See **🤝 Workflow Roles** below.
- Work on a feature branch, never directly on `main`.

**4. Refine — review & simplify** _(ask after implementation, non-trivial changes only)_
- Skip both passes for genuinely trivial edits (typo, rename, import fix, single-line tweak, config bump) — no need to ask, just say so in one line so it's visible.
- Otherwise, after implementation, **ask the developer** whether to run review + simplify before presenting the result.
- If yes:
  1. **Code-review** via a **fresh sub-agent** (`code-review` skill) — independent eyes that did not write the code
  2. **Apply confirmed findings**; report any deliberately not acted on + why
  3. **Simplify** inline (`simplify` skill) on the now-correct code
  4. **Light behavior-preservation check** after simplify — verify nothing changed semantically (not a full second review)
- If no: present the implementation as-is per step 6.

**5. Uncertain?**
- Ask one concrete question with a recommended option
- Never assume state placement, data shape, or layer assignment

**6. After implementation**
- Do not prompt, ask, or offer to run `git add` / `git commit` / merge
- Present the diff/result and stop — the developer reviews and commits personally
- Segment the final diff so it's clear what came from where: **implemented** / **changed by review** / **changed by simplify**

## 🤝 Workflow Roles

| Role | Responsibility |
|------|-----------------|
| Claude (you) | Primary developer — reads, plans (grill + visualize), implements, then reviews & simplifies, and presents the diff |
| Developer (you're working with) | Final approver — reviews the diff and commits/merges personally |

**Loop (run for every new feature/task):**
1. **Read** the relevant domain guide(s) + skills before touching code.
2. **Plan** — grill requirements (`grill-with-docs`), visualize (`plan-visualizer`), and get explicit approval.
3. **Implement** the approved plan directly, on a feature branch.
4. **Refine** — for non-trivial changes, review (`code-review` via a fresh sub-agent) then simplify (`simplify`).
5. **Present & wait** — present the diff, segmented by what was implemented / changed by review / changed by simplify, plus any risks. **No commit or merge without explicit approval — and never offer to `git add`/commit; the developer does that personally.**

**Hard rules:**
- Work happens on a feature branch, never directly on `main`.
- The developer always sees the real `git diff` before approving.

## 🚫 Hard Constraints

| Constraint | Why |
|-----------|-----|
| No `<bim-*>` outside `ViewportWrapper.tsx` | Shadow DOM bleeds styles/events |
| No logic/state/fetch in `routes/` | Routes are composition only |
| No `!important` or raw `oklch()` in JSX | Token integrity |
| No relative imports — use `@/*` | Refactor safety |
| Never edit `routeTree.gen.ts` | Vite plugin overwrites it |
| No auth state in Zustand | Auth needs React context lifecycle |
| No files in `react-components/` root | Use subdirs: `components/`, `features/`, `views/`, `store/` |
| No OBC bootstrap in React | Singleton world in `bim-components/setup/` |
| No Supabase in `views/` or `components/` | Data access is `features/` responsibility |
| No `features/index.ts` barrel | Circular deps + HMR slowdown |
| No subdirs under `views/` | Views must be flat at root |
| No AI prompts/offers to `git add`/commit/merge | Developer reviews diff and commits personally |
