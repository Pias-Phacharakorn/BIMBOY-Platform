# AGENTS.md — PIAS-BimWebApp (BIMBOY)

> **Read this entire file before writing any code.** It defines the project identity, stack, architecture constraints, and mandatory workflow.

---

## 🧑‍💻 About the Developer

Pair-programming with a **Senior Software Developer**. Expertise: BIM (IFC workflows, clash detection, clipping), GIS (Cesium, coordinate systems), Web (React, Three.js, Vite, TypeScript, Supabase).

**Communication style:** Concise and technical. Skip fundamentals. Surface tradeoffs. Ask targeted questions. Propose one concrete option when asking for a decision.

---

## 🏗️ Project Identity

**BIMBOY** is a Digital BIM Management Platform built on the [ThatOpen](https://docs.thatopen.com) ecosystem. It centralises BIM models, project documents, coordination data, and geospatial information for project teams.

### Feature Development Order

1. **BIM Model Viewer** — IFC/Fragment 3D viewport (OBC engine)
2. **Clash Detection Dashboard** — BCF/Navisworks import, severity tracking
3. **Document Management Dashboard** — drawing lists, revisions, status
4. **Drawing & Shop Drawing Management** — CAD viewer, PDF tools
5. **BIM + GIS Integration** — Cesium 3D Tiles, coordinate overlay

---

## 🛠️ Tech Stack

| Layer             | Technology                                                        |
| ----------------- | ----------------------------------------------------------------- |
| UI Framework      | React 19                                                          |
| Routing           | `@tanstack/react-router` (file-based, type-safe)                  |
| UI State          | Zustand v5                                                        |
| Server State      | TanStack Query (async ops)                                        |
| Styling           | Tailwind CSS v4                                                   |
| Icons             | `lucide-react`                                                    |
| Schema/Validation | `zod` v3                                                          |
| BIM Engine        | `@thatopen/components` (OBC) + `@thatopen/ui` (BUI) — **v3.4.x** |
| 3D Renderer       | Three.js ^0.182                                                   |
| GIS               | Cesium ^1.140 _(deferred — add only with GIS feature)_            |
| Build Tool        | Vite 7 + `@tanstack/router-plugin/vite` + `vite-tsconfig-paths`   |
| Backend           | **Supabase** (Auth, DB, Storage) — `src/integrations/supabase/`  |
| Language          | TypeScript ^5.2 (`@/*` → `src/*` path alias)                      |
| Date Utilities    | `date-fns`                                                        |

> **Backend note:** Supabase is the sole backend.

**Critical version constraint:** All ThatOpen libraries must stay on **v3.4.x**. Check peer deps (`three.js`, `web-ifc`) before any upgrade.

---

## 📁 Source Directory Map

```
src/
├── bim-components/          # Custom OBC components (extend OBC.Component)
│   ├── ClashImport/
│   ├── CursurSurface/
│   ├── GisLayers/
│   ├── MiniMap/
│   ├── PropertyTable/
│   ├── SmartViews/
│   ├── SpotCoordinate/
│   └── setup/               # World/engine bootstrap — singleton, do not edit
├── classes/                 # Pure TS domain classes (no React)
├── integrations/
│   └── supabase/            # ✅ Active backend — Supabase client + typed helpers
├── lib/                     # Shared utilities (cn, etc.)
├── react-components/
│   ├── components/          # Pure UI — props + Tailwind only
│   ├── features/            # Stateful feature slices
│   ├── views/               # Page-level compositions with LAYOUTS
│   └── store/               # Zustand stores
├── routes/                  # TanStack Router file-based routes
├── types/                   # Shared TypeScript types/interfaces
├── globals.ts               # appIcons dictionary, global constants
├── router.tsx               # Router instance
├── style.css                # Tailwind @theme, @layer base
└── main.tsx                 # App entry point
```

---

## 📐 Architecture Rules

### Layer Responsibilities

| Layer              | Knows about                      | Must NOT know about        |
| ------------------ | -------------------------------- | -------------------------- |
| `components/`      | Props, Tailwind classes          | Store, Supabase, BIM, routing |
| `features/`        | Store, Supabase, BIM props       | Routing, other features    |
| `views/`           | Features, components, store      | Supabase directly          |
| `routes/`          | Views, routing params            | Logic, state, Supabase     |
| `store/`           | Zustand state shape              | React components           |
| `bim-components/`  | OBC engine, Three.js, world      | React state, Tailwind      |
| `integrations/`    | External SDK clients             | React, routing, store      |

### File Placement

```
New file needed?
│
├── Is it a custom OBC.Component subclass?       → bim-components/
├── Has store hook / data fetch / useEffect?     → features/
├── Has LAYOUTS config + tab switching?          → views/
├── Is it a route entry point?                   → routes/
└── Pure UI, props only                          → components/
```

### Routes — Composition Only

```tsx
// ✅ Correct
export const Route = createFileRoute('/projects/$projectId/clashes')({
  component: () => <ClashView />,
})

// ❌ Wrong — no logic, state, or fetching in routes
export const Route = createFileRoute('/projects/$projectId/clashes')({
  component: () => {
    const [data, setData] = useState([])
    useEffect(() => { fetch(...) }, [])
    return <ClashView data={data} />
  },
})
```

### Views — LAYOUTS Pattern

```tsx
const LAYOUTS = {
  Dashboard: { areas: `"dashboard filter" "table filter"`, cols: "1fr 20rem", rows: "auto 1fr" },
  ClashModel: { areas: `"viewport viewport" "table filter"`, cols: "1fr 20rem", rows: "1fr 1fr" },
  "Issue List": { areas: `"table"`, cols: "1fr", rows: "1fr" },
} as const;

// Active layout always comes from store — never local useState
const { clashLayout, setClashLayout } = useUIStore();
```

### State Management

| State type             | Where it lives                |
| ---------------------- | ----------------------------- |
| Modal open/close       | `uiStore`                     |
| Sidebar collapse       | `uiStore`                     |
| Active layout per view | `uiStore`                     |
| Projects list          | `projectStore`                |
| Active project         | `projectStore`                |
| Clash data + filters   | `clashStore`                  |
| BIM world / engine     | `bimStore`                    |
| URL-shareable state    | TanStack Router search params |
| Supabase async ops     | TanStack Query                |
| Auth state             | `AuthContext` only            |

### Naming Conventions

| Target                | Convention          | Example                            |
| --------------------- | ------------------- | ---------------------------------- |
| React components      | PascalCase          | `PropertyPanel.tsx`                |
| Zustand stores        | camelCase + Store   | `bimStore.ts`, `uiStore.ts`        |
| Custom OBC components | PascalCase          | `ClashImport/`, `SmartViews/`      |
| Utility functions     | camelCase           | `cn()`, `formatDate()`             |
| Zod schemas           | PascalCase + Schema | `ProjectSchema`, `ClashItemSchema` |
| Route files           | kebab-case or param | `$projectId.tsx`, `model.tsx`      |
| Feature directories   | kebab-case          | `clash-filter/`, `property-panel/` |

---

## ⚡ BUI / Shadow DOM Boundary

- `<bim-*>` Web Components **only inside** `components/bim/ViewportWrapper.tsx`
- **Forbidden elsewhere:** `<bim-panel>`, `<bim-panel-section>`, `<bim-grid>`
- Use custom React layout components instead: `LeftPanel.tsx`, `RightPanel.tsx`, `PanelSection.tsx`
- BUI theming via CSS variables (`--bim-*`) in `@theme {}` — never inline overrides

---

## 🎨 Styling Rules

- Tailwind utility classes only — no plain CSS class names
- No `!important`, no raw `oklch()` outside `style.css @theme {}`
- All custom base styles inside `@layer base {}` in `style.css`
- Conditional classes via `cn()` from `@/lib/utils`
- Use design tokens from `DESIGN.md` — never hardcode colour values inline

---

## ⚠️ Routing — TanStack Router

- `routeTree.gen.ts` is auto-generated — **never edit manually**
- Use `createFileRoute()` in every route file
- Navigate with `useNavigate()` or `<Link>` from `@tanstack/react-router`
- Route param shape: `/projects/$projectId/<feature>` — use `Route.useParams()`

---

## 🔬 BIM / ThatOpen Rules

1. Use `thatopen-docs-navigator` skill → `.agents/ThatOpen_docs/` before any OBC feature
2. New custom components → `src/bim-components/` using the `_thatopen-bim-component` skill
3. Implement `OBC.Disposable`, use `OBC.Disposer` for all Three.js meshes
4. Unbind all DOM events on `dispose()`
5. Never mix ThatOpen library versions — pin everything to **v3.4.x**
6. Register components in `src/bim-components/setup/` — never bootstrap OBC inside React

---

## 📦 Imports

Always use the `@/*` path alias — never deep relative paths.

```ts
// ✅
import { cn } from "@/lib/utils";
import { useUIStore } from "@/react-components/store/uiStore";
import { supabase } from "@/integrations/supabase/client";

// ❌
import { cn } from "../../../lib/utils";
```

---

## 📋 Mandatory Workflow

### 1. Read before implementing

- OBC/BIM feature → `thatopen-docs-navigator` skill first
- Custom OBC component → `_thatopen-bim-component` skill
- BUI patterns → `.agents/skills/`
- Never assume API shapes — OBC v3.4.x has breaking changes from v2

### 2. Plan before coding

Use `grill-with-docs` skill to clarify requirements, stress-test the plan, and confirm layer placement.

Then use `plan-visualizer` skill to produce the implementation plan. **Every plan must include:**
- 🔄 Current Flow diagram (ASCII)
- ✅ Proposed Flow diagram (ASCII) — mark `[NEW]` `[MOD]` `[DEL]` and `★` the key change
- ⚖️ Pros & Cons table
- 📁 Files Changed list

**Do not write code until the developer explicitly approves the plan.**

### 3. Execute

Use `caveman-code` skill for token-efficient coding, autonomous goal loops, and iterative edits.

### 4. When uncertain

Ask **one targeted question** with a concrete recommended option. Never make silent assumptions about state placement, data shape, or layer assignment.

---

## 🚫 Hard Constraints

| Rule                                                  | Why                                              |
| ----------------------------------------------------- | ------------------------------------------------ |
| No `<bim-*>` outside `ViewportWrapper.tsx`            | Shadow DOM — styles and events bleed             |
| No `useState` / `useEffect` / fetching in `routes/`   | Routes are composition only                      |
| No Tailwind `!important`, no raw `oklch()` in JSX     | Token system and specificity model integrity     |
| No deep relative imports — use `@/*`                  | Refactor safety                                  |
| No manual edits to `routeTree.gen.ts`                 | Overwritten by Vite plugin                       |
| No auth state in Zustand                              | Auth lifecycle requires React context            |
| No files directly in `react-components/` root         | Use `components/`, `features/`, `views/`, `store/`|
| No OBC bootstrap inside React components              | Singleton world lives in `bim-components/setup/` |
| No Supabase calls in `views/` or `components/`        | Data access is features' responsibility          |
