# AGENT.md — PIAS-BimWebApp (BIMBOY)

> Read this first. It tells you who you're working with, what this project is, and the rules you must follow before writing any code.

---

## 🧑‍💻 About the Developer

You are pair-programming with a **Senior Software Developer** with deep expertise in:
- **BIM** — IFC workflows, model data, clipping, highlighting, clash detection
- **GIS** — Cesium, 2D/3D map layers, coordinate systems
- **Web** — React, Three.js, Vite, TypeScript, Firebase

Communicate concisely. Don't over-explain fundamentals.

---

## 🏗️ Project Identity

**BIMBOY** is a Digital BIM Management Platform built on the [That Open Company](.agent/ThatOpen_docs/intro.md) ecosystem. It centralizes BIM models, project documents, coordination data, and geospatial information into a single environment for project teams.

Features (in development order):
1. **BIM Model Viewer** — IFC/Fragment 3D viewport (OBC engine)
2. **Clash Detection Dashboard** — BCF/Navisworks import, severity tracking
3. **Document Management Dashboard** — drawing lists, revisions, status
4. **Drawing & Shop Drawing Management** — CAD viewer, PDF tools
5. **BIM + GIS Integration** — Cesium 3D Tiles, coordinate overlay

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Routing | `@tanstack/react-router` (file-based, type-safe) |
| UI State | Zustand v5 |
| Styling | Tailwind CSS v4 |
| Icons | `lucide-react` |
| Schema/Validation | `zod` v3 |
| BIM Engine | `@thatopen/components` (OBC) + `@thatopen/ui` (BUI) — v3.4.x |
| 3D Renderer | Three.js ^0.182 |
| GIS | Cesium ^1.140 (deferred — add with GIS feature) |
| Build Tool | Vite 7 + `@tanstack/router-plugin/vite` + `vite-tsconfig-paths` |
| Backend | Firebase (Firestore, Auth, Storage) |
| Language | TypeScript ^5.2 (`@/*` → `src/*` path alias) |

---

## 🗺️ Project Structure

```
PIAS-BimWebApp/
├── .agent/                        # Agent skills and ThatOpen docs
├── public/                        # Static assets
├── src/
│   ├── bim-components/            # ThatOpen OBC — DO NOT MODIFY
│   │   ├── ClashImport/
│   │   ├── GisLayers/
│   │   ├── MiniMap/
│   │   ├── PropertyTable/
│   │   ├── SpotCoordinate/
│   │   ├── setup/
│   │   └── index.ts
│   │
│   ├── classes/                   # Core TS classes — DO NOT MODIFY
│   │   ├── CanvasCursorOverlay.ts
│   │   ├── Project.ts
│   │   └── ProjectsManager.ts
│   │
│   ├── firebase/                  # Firebase SDK — DO NOT MODIFY
│   │   ├── auth.ts
│   │   ├── dbReset.ts
│   │   ├── index.ts
│   │   └── types.ts
│   │
│   ├── context/                   # React contexts — DO NOT MODIFY
│   │   └── AuthContext.tsx
│   │
│   ├── routes/                    # TanStack Router file-based routes
│   │   ├── __root.tsx             # Root layout
│   │   ├── index.tsx              # Redirect → /projects
│   │   ├── projects.tsx           # Projects layout (AppShell)
│   │   ├── projects/
│   │   │   ├── index.tsx          # Project list
│   │   │   └── $projectId/
│   │   │       ├── index.tsx      # Redirect → model
│   │   │       ├── model.tsx      # BIM viewer
│   │   │       ├── clashes.tsx    # Clash detection
│   │   │       ├── documents.tsx  # Documents
│   │   │       └── settings.tsx   # Settings
│   │   └── routeTree.gen.ts       # AUTO-GENERATED — never edit manually
│   │
│   ├── react-components/          # ALL React UI lives here
│   │   ├── components/            # Atomic UI — no business logic
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   └── index.ts
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── WorkspaceHeader.tsx
│   │   │   │   └── index.ts
│   │   │   └── bim/
│   │   │       ├── ViewportWrapper.tsx  # ← BUI lives HERE ONLY
│   │   │       └── index.ts
│   │   │
│   │   ├── features/              # Logic + UI, self-contained
│   │   │   ├── clash-filter/
│   │   │   │   ├── ClashFilter.tsx
│   │   │   │   ├── useClashFilter.ts
│   │   │   │   └── index.ts
│   │   │   ├── clash-table/
│   │   │   │   ├── ClashTable.tsx
│   │   │   │   ├── useClashTable.ts
│   │   │   │   └── index.ts
│   │   │   ├── clash-dashboard/
│   │   │   │   ├── ClashDashboard.tsx
│   │   │   │   ├── useClashDashboard.ts
│   │   │   │   └── index.ts
│   │   │   ├── property-panel/
│   │   │   │   ├── PropertyPanel.tsx
│   │   │   │   ├── usePropertyPanel.ts
│   │   │   │   └── index.ts
│   │   │   └── project-card/
│   │   │       ├── ProjectCard.tsx
│   │   │       ├── useProjectCard.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── views/                 # Tab switching + LAYOUTS config
│   │   │   ├── clash/
│   │   │   │   ├── ClashView.tsx  # Dashboard / ClashModel / Issue List
│   │   │   │   └── index.ts
│   │   │   ├── models/
│   │   │   │   ├── ModelsView.tsx # Viewer / CustomView / GIS
│   │   │   │   └── index.ts
│   │   │   ├── settings/
│   │   │   │   ├── SettingsView.tsx
│   │   │   │   └── index.ts
│   │   │   └── projects/
│   │   │       ├── ProjectsView.tsx
│   │   │       └── index.ts
│   │   │
│   │   └── store/                 # Zustand stores
│   │       ├── uiStore.ts         # modal, sidebar, activeLayout
│   │       ├── projectStore.ts    # projects list, activeProject
│   │       └── clashStore.ts      # clashes, filters, selected
│   │
│   ├── lib/
│   │   ├── firebase.ts            # Firebase client init
│   │   └── utils.ts               # cn(), formatDate(), helpers
│   │
│   ├── types/
│   │   └── index.ts               # Domain types + Zod schemas
│   │
│   ├── globals.ts                 # Icon and tooltip global map
│   ├── main.tsx                   # React + Router entry point
│   └── style.css                  # Tailwind @theme {} only
│
├── index.html
├── tsconfig.json
├── vite.config.ts
├── AGENT.md                       # ← this file
└── DESIGN.md
```

---

## 📐 Architecture Rules — MUST FOLLOW

### Layer responsibilities

| Layer | Knows about | Must NOT know about |
|---|---|---|
| `components/` | Props, Tailwind classes | Store, Firebase, BIM, routing |
| `features/` | Store, Firebase, BIM props | Routing, other features |
| `views/` | Features, components, store | Firebase directly |
| `routes/` | Views, routing params | Logic, state, Firebase |
| `store/` | Zustand state shape | React components |

### File placement — ask in order

```
Has store hook / fetch / useEffect?     → features/
Has LAYOUTS config + tab switching?     → views/
Is it a route entry point?              → routes/
None of the above?                      → components/
```

### Routes are composition only

```tsx
// ✅ CORRECT
export const Route = createFileRoute('/projects/$projectId/clashes')({
  component: () => <ClashView />,
})

// ❌ WRONG — no logic in routes
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
  Dashboard:  { areas: `"dashboard filter" "table filter"`, cols: "1fr 20rem", rows: "auto 1fr" },
  ClashModel: { areas: `"viewport viewport" "table filter"`, cols: "1fr 20rem", rows: "1fr 1fr" },
  "Issue List": { areas: `"table"`, cols: "1fr", rows: "1fr" },
} as const

// active layout from store — never local useState
const { clashLayout, setClashLayout } = useUIStore()
```

### BUI / Shadow DOM — hard boundary

- `<bim-*>` elements are **only allowed** inside `components/bim/ViewportWrapper.tsx`
- BUI theming via CSS variables (`--bim-*`) mapped in `@theme {}` — never `color: #fff !important`
- All other UI is React + Tailwind — no exceptions

### Styling rules

- Tailwind utility classes only — no plain CSS class names
- No `!important` anywhere
- No raw `oklch()` values outside `style.css` `@theme {}`
- All custom base styles inside `@layer base {}` in `style.css` so utilities win
- Conditional classes via `cn()`:

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Store rules

- `uiStore` — modal open/close, sidebar collapse, activeLayout per view
- `projectStore` — projects list, activeProject
- `clashStore` — clashes data, filters, selected clash
- `AuthContext` stays in `context/` — do NOT move auth to Zustand

### Imports

- Always use `@/*` path alias — never deep relative paths
- `import { cn } from '@/lib/utils'`
- `import { useUIStore } from '@/react-components/store/uiStore'`

---

## ⚠️ Routing — TanStack Router

- **DO NOT use react-router-dom** — use `@tanstack/react-router` only
- `routeTree.gen.ts` is auto-generated by Vite plugin — **never edit manually**
- Use `createFileRoute()` in every route file
- Navigate with `useNavigate()` or `<Link>` from `@tanstack/react-router`

---

## 🔬 BIM / ThatOpen Rules

- Refer to `.agent/ThatOpen_docs/` before implementing any OBC feature
- Always check `.agent/skills/` for BUI event binding and component rules
- Implement `OBC.Disposable`, use `OBC.Disposer` for Three.js meshes
- Unbind all DOM events on dispose
- Keep all ThatOpen libraries on **v3.4.x** — never mix versions
- Check peer deps (`three.js`, `web-ifc`) before upgrading

---

## 📋 Mandatory Workflow

Plan before writing code
A very important best practice is: do not write code immediately. Have Claude analyze and plan first.
.
🔹 Example
▪️ Analyze this requirement first.
▪️ Summarize the architecture.
▪️ Explain the impact.
▪️ Then propose the development plan.
▪️ Do not write code until I approve.
This approach reduces code rewrites and provides a clear big picture before starting.

---

## 🚫 Never Do

- Add files directly to `react-components/` root — always use subfolders
- Place `<bim-*>` anywhere outside `components/bim/ViewportWrapper.tsx`
- Add `useState` / `useEffect` / data fetching inside `routes/`
- Write plain CSS class names — Tailwind only
- Use `!important`
- Create a `sections/` folder — intentionally removed
- Edit `routeTree.gen.ts` manually
- Modify `bim-components/`, `classes/`, `firebase/`, `context/`