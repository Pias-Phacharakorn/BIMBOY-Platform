# AGENT.md — PIAS-BimWebApp (BIMBOY)

> **Read this entire file before writing any code.** It defines the project identity, stack, architecture constraints, and mandatory workflow. Violating these rules will cause rejected PRs and wasted effort.

---

## 🧑‍💻 About the Developer

Pair-programming with a **Senior Software Developer**. Expertise: BIM (IFC workflows, clash detection, clipping), GIS (Cesium, coordinate systems), Web (React, Three.js, Vite, TypeScript, Firebase).

**Communication style:** Concise and technical. Skip fundamentals. Surface tradeoffs. Ask targeted questions.

---

## 🏗️ Project Identity

**BIMBOY** is a Digital BIM Management Platform built on the [ThatOpen](https://docs.thatopen.com) ecosystem. It centralizes BIM models, project documents, coordination data, and geospatial information for project teams.

### Feature Development Order

1. **BIM Model Viewer** — IFC/Fragment 3D viewport (OBC engine)
2. **Clash Detection Dashboard** — BCF/Navisworks import, severity tracking
3. **Document Management Dashboard** — drawing lists, revisions, status
4. **Drawing & Shop Drawing Management** — CAD viewer, PDF tools
5. **BIM + GIS Integration** — Cesium 3D Tiles, coordinate overlay

---

## 🛠️ Tech Stack

| Layer             | Technology                                                       |
| ----------------- | ---------------------------------------------------------------- |
| UI Framework      | React 19                                                         |
| Routing           | `@tanstack/react-router` (file-based, type-safe)                 |
| UI State          | Zustand v5                                                       |
| Server State      | TanStack Query (Firebase async ops)                              |
| Styling           | Tailwind CSS v4                                                  |
| Icons             | `lucide-react`                                                   |
| Schema/Validation | `zod` v3                                                         |
| BIM Engine        | `@thatopen/components` (OBC) + `@thatopen/ui` (BUI) — **v3.4.x** |
| 3D Renderer       | Three.js ^0.182                                                  |
| GIS               | Cesium ^1.140 _(deferred — add only with GIS feature)_           |
| Build Tool        | Vite 7 + `@tanstack/router-plugin/vite` + `vite-tsconfig-paths`  |
| Backend           | Firebase (Firestore, Auth, Storage)                              |
| Language          | TypeScript ^5.2 (`@/*` → `src/*` path alias)                     |
| Date Utilities    | `date-fns`                                                       |

**Critical version constraint:** All ThatOpen libraries must stay on **v3.4.x**. Check peer deps (`three.js`, `web-ifc`) before any upgrade.

---

## 📐 Architecture Rules

### Layer responsibilities

| Layer         | Knows about                 | Must NOT know about           |
| ------------- | --------------------------- | ----------------------------- |
| `components/` | Props, Tailwind classes     | Store, Firebase, BIM, routing |
| `features/`   | Store, Firebase, BIM props  | Routing, other features       |
| `views/`      | Features, components, store | Firebase directly             |
| `routes/`     | Views, routing params       | Logic, state, Firebase        |
| `store/`      | Zustand state shape         | React components              |

### File placement decision tree

```
New file needed?
│
├── Has store hook / data fetch / useEffect?     → features/
├── Has LAYOUTS config + tab switching?          → views/
├── Is it a route entry point?                   → routes/
└── None of the above (pure UI, props only)      → components/
```

When uncertain, ask: _"Does this component need to know where it is in the app?"_ If yes → `features/` or `views/`.

### Routes are composition only

```tsx
// ✅ Correct — route is a thin wrapper
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

### Views use LAYOUTS pattern

```tsx
const LAYOUTS = {
  Dashboard: {
    areas: `"dashboard filter" "table filter"`,
    cols: "1fr 20rem",
    rows: "auto 1fr",
  },
  ClashModel: {
    areas: `"viewport viewport" "table filter"`,
    cols: "1fr 20rem",
    rows: "1fr 1fr",
  },
  "Issue List": { areas: `"table"`, cols: "1fr", rows: "1fr" },
} as const;

// Active layout always comes from store — never local useState
const { clashLayout, setClashLayout } = useUIStore();
```

### State management

| State type             | Where it lives                |
| ---------------------- | ----------------------------- |
| Modal open/close       | `uiStore`                     |
| Sidebar collapse       | `uiStore`                     |
| Active layout per view | `uiStore`                     |
| Projects list          | `projectStore`                |
| Active project         | `projectStore`                |
| Clash data + filters   | `clashStore`                  |
| URL-shareable state    | TanStack Router search params |
| Firebase async ops     | TanStack Query                |
| Auth state             | `AuthContext` only            |

**Do not move `AuthContext` to Zustand.**

---

## 🎨 Styling Rules

- **Tailwind utility classes only** — no plain CSS class names
- No `!important` anywhere
- No raw `oklch()` values outside `style.css` `@theme {}`
- All custom base styles inside `@layer base {}` in `style.css` so utilities win
- Conditional classes via `cn()` from `@/lib/utils`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## ⚡ BUI / Shadow DOM Boundary

This is a hard architectural boundary — no exceptions.

- `<bim-*>` Web Components are **only allowed** inside `components/bim/ViewportWrapper.tsx`
- **Forbidden everywhere else:** `<bim-panel>`, `<bim-panel-section>`, `<bim-grid>`
- Use the custom React layout components instead: `LeftPanel.tsx`, `RightPanel.tsx`, `PanelSection.tsx`
- BUI theming via CSS variables (`--bim-*`) mapped in `@theme {}` — never inline color overrides

All other UI is **React + Tailwind only**.

---

## ⚠️ Routing — TanStack Router

- **Never use `react-router-dom`** — use `@tanstack/react-router` exclusively
- `routeTree.gen.ts` is auto-generated — **never edit manually**
- Use `createFileRoute()` in every route file
- Navigate with `useNavigate()` or `<Link>` from `@tanstack/react-router`

---

## 🔬 BIM / ThatOpen Rules

1. Read `.agent/ThatOpen_docs/` before implementing any OBC feature
2. Check `.agent/skills/` for BUI event binding and component patterns
3. Implement `OBC.Disposable`, use `OBC.Disposer` for all Three.js meshes
4. Unbind all DOM events on `dispose()`
5. Never mix ThatOpen library versions — pin everything to **v3.4.x**
6. Check peer deps (`three.js`, `web-ifc`) before any upgrade

---

## 📦 Imports

Always use the `@/*` path alias — never deep relative paths.

```ts
// ✅
import { cn } from "@/lib/utils";
import { useUIStore } from "@/react-components/store/uiStore";

// ❌
import { cn } from "../../../lib/utils";
```

---

## 🔒 Protected Files — Do Not Modify

Changes to these require explicit developer approval:

| Path                  | Reason                        |
| --------------------- | ----------------------------- |
| `src/bim-components/` | ThatOpen OBC components       |
| `src/classes/`        | Core TS classes               |
| `src/firebase/`       | Firebase SDK wrappers         |
| `src/context/`        | Auth context                  |
| `routeTree.gen.ts`    | Auto-generated by Vite plugin |

---

## 📋 Mandatory Workflow

Follow this strictly — in order:

### 1. Read before implementing

- For any OBC/BIM feature: read `.agent/ThatOpen_docs/` first
- For BUI component patterns: read `.agent/skills/` first
- Never assume API shapes from memory — OBC v3.4.x has breaking changes from v2

### 2. Plan before coding

Use the `grill-with-docs` skill (`.agent/skills/grill-with-docs/SKILL.md`) to:

- Clarify requirements through a targeted interview
- Stress-test the plan against the domain model
- Confirm placement in the layer hierarchy

**Do not write code until the developer explicitly approves the plan.**

### 3. Execute with the caveman-code skill

Use `.agent/skills/caveman-code/SKILL.md` for:

- Token-efficient coding tasks
- Autonomous goal loops
- Iterative file edits

### 4. When uncertain

If a decision is ambiguous, ask **one targeted question** with concrete options. Example:

> "Should the filter state live in `clashStore` (persisted across tab switches) or URL search params (shareable)? I'd go with URL params for shareability."

Never make silent assumptions about state placement, data shape, or layer assignment.

---

## 🚫 Hard Constraints

| Rule                                                  | Why                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| No `<bim-*>` outside `ViewportWrapper.tsx`            | Shadow DOM isolation — styles and events bleed               |
| No `<bim-panel>`, `<bim-panel-section>`, `<bim-grid>` | Replaced by custom React layout components                   |
| No `useState` / `useEffect` / fetching in `routes/`   | Routes are composition only                                  |
| No plain CSS class names — Tailwind only              | Consistency and purge safety                                 |
| No `!important`                                       | Tailwind specificity model breaks                            |
| No raw `oklch()` outside `style.css @theme {}`        | Token system integrity                                       |
| No deep relative imports — use `@/*`                  | Refactor safety                                              |
| No `react-router-dom`                                 | Stack is TanStack Router only                                |
| No manual edits to `routeTree.gen.ts`                 | Will be overwritten by Vite plugin                           |
| No auth state in Zustand                              | Auth lifecycle requires React context                        |
| No files directly in `react-components/` root         | Always use `components/`, `features/`, `views/`, or `store/` |
