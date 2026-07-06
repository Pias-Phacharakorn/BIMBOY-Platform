# AGENTS.md — PIAS-BimWebApp (BIMBOY)

> **Read this before writing any code.** Defines project identity, stack, architecture rules, and mandatory workflow.

## 👤 Developer Profile

**Senior Software Developer.** Expertise: BIM (IFC/clash detection/clipping), GIS (Cesium/coordinates), Web (React/Three.js/Vite/TypeScript/Supabase).

**Communication:** Concise, technical. Surface tradeoffs. Ask one concrete question with a recommended option.

---

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

This file is the **map**; these guides are the **territory** — deep, project-specific detail loaded on demand. When a task goes deep into an area below, read its guide (path is canonical; a mirror also exists under `.claude/docs/`). Guides document *how this project wires things* — they never re-document a framework (that's the skills + `.agents/ThatOpen_docs/`).

| Working on … | Load guide |
|--------------|-----------|
| React, routing, Zustand stores, views/features/components, Tailwind | `.agents/docs/frontend.md` |
| ThatOpen/OBC viewer wiring, world setup, IFC/FRAG loading, BUI containment | `.agents/docs/bim-viewer.md` |
| Supabase auth, DB, storage, feature services, `AuthContext` | `.agents/docs/backend.md` |
| Clash import (BCF), clash register/table/filters, clash dashboard | `.agents/docs/clash-detection.md` |
| Drawing Directory, shop-drawing register, PDF revisions | `.agents/docs/drawing.md` |
| GIS layers, Cesium 3D Tiles, coordinates/CRS | `.agents/docs/gis-cesium.md` |
| AR / WebXR viewing, `/ar/$projectId`, ModelsView AR tab | `.agents/docs/ar-webxr.md` |

**Keep guides current:** when a change alters something critical or important in one of these areas, update the matching guide in **both** `.agents/docs/` and `.claude/docs/` as part of the same change — the two copies must never drift.

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

Routes are composition only — no logic, state, or fetching. → ✅/❌ example in `.agents/docs/frontend.md`.

### Views Pattern

Layout state always from the store (never `useState`); views compose via a `LAYOUTS` grid const. → example in `.agents/docs/frontend.md`.

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
1. Read ThatOpen docs — use `thatopen-docs-navigator` skill
2. Check v3.4.x API (breaking changes from v2)

**New OBC component:** follow the `_thatopen-bim-component` skill. → project wiring + step checklist in `.agents/docs/bim-viewer.md`.

**Version constraint:** All ThatOpen libs pinned to **v3.4.x** — never mix versions or bootstrap OBC inside React

## 📦 Imports

Always use `@/*` alias. Never relative `../../../` paths. → example in `.agents/docs/frontend.md`.

## 📋 Workflow

**1. Read first**
- OBC feature? → `thatopen-docs-navigator` skill
- Custom OBC component? → `_thatopen-bim-component` skill
- BUI patterns? → `.agents/skills/`

**2. Plan before code**
- Use `grill-with-docs` skill for requirements + layer placement
- New architecture, cross-cutting refactor, tricky bug, or multiple viable approaches? → suggest the developer run `/fable-advisor` (developer-triggered only, never auto-invoked) to get a second opinion from Fable before finalizing the plan
- Use `plan-visualizer` skill for: current flow (ASCII) + proposed flow (mark `[NEW]`/`[MOD]`/`[DEL]`) + pros/cons + files
- **Get explicit approval before coding**

**3. Execute — via Claude Code CLI (mandatory)**
- See **🤝 Multi-Agent Workflow** below. Gemini does not write feature code directly — it specs the task, delegates to Claude Code CLI, then reviews the diff.
- Exception: small inline fixes to Claude's diff (typo, missing import, minor logic slip) may be patched directly by Gemini.

**4. Refine — review & simplify** _(automatic, non-trivial changes only)_
- Skip both passes for genuinely trivial edits (typo, rename, import fix, single-line tweak, config bump) — and say so in one line so it's visible.
- Otherwise, before presenting:
  1. **Code-review** via a **fresh sub-agent** (`code-review` skill) — independent eyes that did not write the code
  2. **Apply confirmed findings**; report any deliberately not acted on + why
  3. **Simplify** inline (`simplify` skill) on the now-correct code
  4. **Light behavior-preservation check** after simplify — verify nothing changed semantically (not a full second review)
- No extra approval gate — this feeds straight into the segmented present in step 6.

**5. Uncertain?**
- Ask one concrete question with a recommended option
- Never assume state placement, data shape, or layer assignment

**6. After implementation**
- Do not prompt, ask, or offer to run `git add` / `git commit` / merge
- Present the diff/result and stop — the developer reviews and commits personally
- Segment the final diff so it's clear what came from where: **implemented** / **changed by review** / **changed by simplify**

## 🤝 Multi-Agent Workflow: Gemini + Claude Code CLI

**Roles:**
| Role | Responsibility |
|------|-----------------|
| Gemini | Orchestrator + Spec Writer — writes the spec, invokes Claude Code CLI, reviews every diff |
| Claude Code CLI | Executor — writes/edits actual code, non-interactively |
| Developer (you) | Final approver — reviews the diff and gives explicit go-ahead before commit/merge |

**Loop (run for every new feature/task):**
1. **Spec** — Gemini analyzes the task and writes a spec for Claude Code CLI: files to create/modify, requirements, coding conventions from this document, edge cases to watch for.
2. **Delegate** — Gemini invokes Claude Code CLI non-interactively:
   ```bash
   claude -p "<spec>" --permission-mode bypassPermissions
   ```
3. **Review** — Gemini runs `git diff` and checks the result against: spec compliance, bugs/logic errors, this document's conventions, security (injection, unsafe input), and performance.
4. **Fix or re-loop** — Significant issues → re-invoke Claude Code CLI with corrections. Minor issues → Gemini patches directly and explains why.
5. **Report & wait** — Gemini presents the diff, a summary of what Claude wrote vs. what Gemini reviewed/fixed, and any risks. **No commit or merge without your explicit approval — and no AI in this loop asks/offers to `git add` or commit; the developer does that personally.**

**Hard rules:**
- All real feature code is written by Claude Code CLI — not by Gemini — except small inline fixes per step 4.
- Work happens on a feature branch, never directly on `main`.
- You always see the real `git diff` before approving.


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

