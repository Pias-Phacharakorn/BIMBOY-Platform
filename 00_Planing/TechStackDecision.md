# BIM-BOY — Tech Stack Decision Record

> Grilling session conducted on **2026-06-19** to establish the project foundation for the Digital BIM Management Platform.
> All decisions below were made by the project owner.

---

## Q1 — Routing Strategy

**Question:** Which routing approach do you want for the new platform?

| Option | Description |
|---|---|
| React Router 7 | Keep current setup, use the existing skill |
| ✅ **TanStack Router** | File-based routing, type-safe, used in src-Nexus |
| React Router 7 (SPA mode) | No framework/SSR features |

**Answer:** `TanStack Router — file-based routing, type-safe, used in src-Nexus`

---

## Q2 — Data Fetching & State Management Strategy

**Question:** How should Firebase data fetching and global state be managed?

| Option | Description |
|---|---|
| TanStack Query v5 | Full async server-state management |
| Zustand only | Simple global state, manual fetch with useEffect |
| ✅ **Zustand + TanStack Query** | Zustand for UI state + TanStack Query for Firebase data fetching |
| SWR | Lightweight alternative to TanStack Query |

**Answer:** `Zustand for UI state + TanStack Query for Firebase data fetching`

> **Split responsibilities:**
> - **Zustand** → BIM engine state, active tool, selected elements, panel visibility
> - **TanStack Query** → All Firestore reads with automatic caching and background refetching

---

## Q3 — UI Component Strategy

**Question:** For complex UI (dialogs, dropdowns, tooltips, tables, date pickers), which component approach?

| Option | Description |
|---|---|
| ✅ **Keep current custom components** | Raw HTML + Tailwind, matching DESIGN.md tokens |
| Radix UI primitives only | Unstyled, composable, accessibility-first |
| shadcn/ui | Radix UI + pre-styled components |
| Mix | Custom for BIM-specific UI, Radix for forms/dialogs |

**Answer:** `Keep current custom components — raw HTML + Tailwind, matching DESIGN.md tokens`

> Preserves the OKLCH design system defined in `DESIGN.md` intact.

---

## Q4 — Feature Scope for Foundation

**Question:** Which features are in scope for the initial foundation? *(multi-select)*

| Option | Selected |
|---|---|
| ✅ **BIM Model Viewer** (IFC / Fragments loading, 3D viewport) | Yes |
| BIM + GIS Integration | No |
| Clash Detection Dashboard | No |
| Drawing & Shop Drawing Management | No |
| Document Management Dashboard | No |
| Project Portfolio / Dashboard | No |
| Authentication | No |
| Admin Panel | No |
| IoT / Workforce tracking | No |

**Answer:** `BIM Model Viewer (IFC / Fragments loading, 3D viewport)`

---

## Q4b — Scope Clarification

**Question:** You selected only BIM Model Viewer — do you mean just start with it, or limit the folder structure to it?

| Option | Description |
|---|---|
| ✅ **Just scaffold + start with BIM Viewer** | Add others progressively |
| Full structure ready for all features | Only implement BIM Viewer now |
| All features scaffolded AND implemented | Empty pages with correct routing |

**Answer:** `Yes — just scaffold the structure and start with BIM Viewer, add others progressively`

---

## Q5 — Folder Structure Philosophy

**Question:** For a platform growing to 8+ feature modules, how should `src/` be organized?

| Option | Description |
|---|---|
| Feature-based modules | `src/features/bim-viewer/`, `src/features/clash/` etc. |
| Domain-layer split | `src/components/`, `src/hooks/`, `src/stores/`, `src/pages/` (flat by type) |
| Hybrid | `src/shared/` + `src/features/` |
| ✅ **Keep old style** | `src/bim-components/`, `src/react-components/` (like src-PiasBIMWeb) |

**Answer:** `Keep the current old style — src/bim-components/, src/react-components/ (like src-PiasBIMWeb)`

---

## Q6 — Icon Library

**Question:** Which icon library should the new platform use?

| Option | Description |
|---|---|
| ✅ **lucide-react** | Tree-shakeable, TypeScript-first, consistent stroke icons |
| Keep custom Icon component | Iconify/CSS strings (src-PiasBIMWeb approach) |
| @iconify/react | Massive icon library, import by string |
| Mix | lucide-react + custom for BIM-specific icons |

**Answer:** `lucide-react — tree-shakeable, TypeScript-first, consistent stroke icons`

---

## Q7 — Cesium / GIS Setup

**Question:** How should Cesium and GIS be wired up in the foundation?

| Option | Description |
|---|---|
| vite-plugin-cesium | Handles WASM/workers/static asset copying automatically |
| Manual Cesium asset config | No plugin (current approach) |
| @cesium/engine only | Lighter, no UI widgets |
| ✅ **Defer Cesium setup** | Add when GIS feature is needed |

**Answer:** `Defer Cesium setup for now — add when GIS feature is needed`

---

## Q8 — TypeScript Path Aliases

**Question:** Which path alias strategy for import resolution?

| Option | Description |
|---|---|
| Full aliases | `@components`, `@hooks`, `@store`, `@types`, `@lib`, `@bim` |
| ✅ **Simple @/* = src/* only** | Single universal alias |
| No aliases | Relative imports only |
| Extended aliases | `@/*` + `@shared/*` + `@bim/*` |

**Answer:** `Simple @/* = src/* only`

---

## Q9 — Linting & Formatting

**Question:** What linting and formatting setup for the project?

| Option | Description |
|---|---|
| ✅ **ESLint only** | Type-aware rules with typescript-eslint |
| ESLint + Prettier | Lint + format together |
| Biome | All-in-one fast linter+formatter (Rust-based) |
| No linting now | Add later |

**Answer:** `ESLint only — type-aware rules with typescript-eslint`

---

## Q10 — TanStack Router Setup Mode

**Question:** Which TanStack Router mode (SSR is NOT needed for Firebase Hosting)?

| Option | Description |
|---|---|
| ✅ **@tanstack/react-router + Vite plugin** | File-based routing, type-safe, auto-generates routeTree.gen.ts |
| Manual TanStack Router | Define routes programmatically in router.tsx |
| TanStack Start | Full-stack SSR mode (used in src-Nexus with server.ts + Nitro) |

**Answer:** `@tanstack/react-router with Vite plugin — file-based routing, type-safe, generate routeTree.gen.ts automatically`

---

## Q11 — Charting Library

**Question:** Which charting library for Clash and Document dashboards?

| Option | Description |
|---|---|
| recharts | Declarative, React-native, lightweight |
| Victory | SVG-based, composable |
| Chart.js | Canvas-based, widely used |
| ✅ **No charts in foundation** | Add when Clash/Dashboard feature is built |

**Answer:** `No charts in foundation — add when needed (Clash/Dashboard feature)`

---

## Q12 — Toast / Notification System

**Question:** How should user feedback (model loaded, upload success, errors) be shown?

| Option | Description |
|---|---|
| sonner | Beautiful toast notifications, used in src-Nexus + src-ShopDrawing |
| react-hot-toast | Lightweight alternative |
| Custom toast system | Custom implementation |
| ✅ **No toast library** | Use browser alerts or inline error states only |

**Answer:** `No toast library — use browser alerts or inline error states only`

---

## Q13 — Firebase Auth Strategy

**Question:** What authentication approach for the platform?

| Option | Description |
|---|---|
| Firebase Auth (email + Google OAuth) | Standard dual auth |
| Firebase Auth (email only) | Email/password only |
| Firebase Auth (Google only) | Google OAuth only |
| ✅ **No auth in foundation** | Add later when ready to deploy |

**Answer:** `No auth in foundation — add later when ready to deploy`

---

## Q14 — Form Validation / Schema Library

**Question:** Should a schema validation library be included as a core dependency?

| Option | Description |
|---|---|
| ✅ **zod** | TypeScript-first schema validation, used in src-Nexus + src-ShopDrawing |
| yup | Classic schema validation library |
| No validation library | Manual TypeScript type checks only |
| valibot | Lightweight alternative to zod |

**Answer:** `zod — TypeScript-first schema validation, used in src-Nexus + src-ShopDrawing`

---

## Q15 — Date Utility Library

**Question:** Which date utility library for deadlines, revisions, and timestamps?

| Option | Description |
|---|---|
| ✅ **date-fns** | Functional, tree-shakeable, used in src-Nexus + src-ShopDrawing |
| dayjs | Lightweight Moment.js-compatible alternative |
| Luxon | Immutable dates with full timezone support |
| Native Intl API only | No library |

**Answer:** `date-fns — functional, tree-shakeable, used in src-Nexus + src-ShopDrawing`

---

## Q16 — Path Resolution Plugin

**Question:** Should `vite-tsconfig-paths` be added to sync TypeScript path aliases to Vite automatically?

| Option | Description |
|---|---|
| ✅ **Yes — vite-tsconfig-paths** | TypeScript paths and Vite resolve the same `@/*` aliases |
| No — manual resolve.alias | Configure in vite.config.ts manually |
| Single object in both | Duplicate aliases in tsconfig.json AND vite.config.ts |

**Answer:** `Yes — vite-tsconfig-paths so TypeScript paths and Vite resolve the same @/* aliases`

---

## Summary Table

| # | Topic | Decision |
|---|---|---|
| Q1 | Routing | TanStack Router (file-based, SPA mode) |
| Q2 | State | Zustand (UI) + TanStack Query (Firebase data) |
| Q3 | UI Components | Custom HTML + Tailwind (DESIGN.md OKLCH system) |
| Q4 | Feature Scope | BIM Viewer first, others progressively |
| Q4b | Structure Scope | Scaffold for all, implement BIM Viewer first |
| Q5 | Folder Structure | `src/bim-components/` + `src/react-components/` (old style) |
| Q6 | Icons | lucide-react |
| Q7 | GIS / Cesium | Deferred — add with GIS feature sprint |
| Q8 | Path Aliases | `@/*` → `src/*` only |
| Q9 | Linting | ESLint + typescript-eslint |
| Q10 | Router Mode | TanStack Router SPA + Vite plugin (no SSR) |
| Q11 | Charts | Deferred — add with Clash/Dashboard sprint |
| Q12 | Toasts | Deferred — inline error states |
| Q13 | Auth | Deferred — add when ready to deploy |
| Q14 | Schema | zod |
| Q15 | Dates | date-fns |
| Q16 | Path Resolution | vite-tsconfig-paths |