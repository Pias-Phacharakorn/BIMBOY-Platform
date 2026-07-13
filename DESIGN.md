# BIM-BOY UI & Design Reference

This document is the **developer-facing design system reference** for the BIM-BOY web application. It defines the token system, layout shells, page routing, icon system, and interaction states that keep the UI visually consistent across all features.

> All tokens are consumed via Tailwind utilities. Never hardcode raw `oklch()` values outside `src/style.css @theme {}`.

---

## 🎨 Design System & Styling Tokens

BIM-BOY uses **Tailwind CSS v4** with an OKLCH-based `@theme {}` block in `src/style.css`. All custom base styles live inside `@layer base {}` so Tailwind utilities always win.

### Color Palette (@theme)

| Token                    | Value                     | Purpose                                |
| :----------------------- | :------------------------ | :--------------------------------------|
| `--color-bg`             | `oklch(10.5% 0.012 255)`  | Deep canvas background                 |
| `--color-surface`        | `oklch(14.5% 0.014 255)`  | Panels, sidebar background             |
| `--color-surface-alt`    | `oklch(19% 0.018 255)`    | Intermediate elevated backdrops        |
| `--color-surface-raised` | `oklch(23% 0.02 255)`     | Cards, dropdowns, active states        |
| `--color-fg`             | `oklch(93% 0.012 250)`    | Primary text                           |
| `--color-muted`          | `oklch(68% 0.02 250)`     | Secondary text, inactive labels        |
| `--color-muted-2`        | `oklch(51% 0.018 250)`    | Subtitles, small details, separators   |
| `--color-border`         | `oklch(27% 0.018 255)`    | Subtle card/panel borders              |
| `--color-border-strong`  | `oklch(38% 0.03 255)`     | Button and input borders               |
| `--color-accent`         | `oklch(66% 0.17 252)`     | Primary indigo-blue brand accent       |
| `--color-accent-2`       | `oklch(74% 0.13 195)`     | Secondary teal/cyan accent             |
| `--color-accent-muted`   | `oklch(31% 0.075 252)`    | Accent background highlights           |
| `--color-status-ok`      | `oklch(70% 0.14 150)`     | Green — Valid, Active, Approved, Closed|
| `--color-status-warn`    | `oklch(77% 0.14 76)`      | Yellow — Review, Pending, In-progress  |
| `--color-status-danger`  | `oklch(63% 0.18 28)`      | Red — Critical, Overdue, Rejected      |
| `--color-status-info`    | `oklch(70% 0.13 235)`     | Blue — Informational indicator         |

#### Status Colour Usage Guide

| Context                  | Token                    | Tailwind example                        |
| :----------------------- | :----------------------- | :-------------------------------------- |
| Clash severity — High    | `--color-status-danger`  | `text-status-danger bg-status-danger/10`|
| Clash severity — Medium  | `--color-status-warn`    | `text-status-warn bg-status-warn/10`    |
| Clash severity — Low     | `--color-status-ok`      | `text-status-ok bg-status-ok/10`        |
| Document approved        | `--color-status-ok`      | `text-status-ok`                        |
| Document pending review  | `--color-status-warn`    | `text-status-warn`                      |
| Document rejected        | `--color-status-danger`  | `text-status-danger`                    |

### Typography & Fonts

| Variable          | Stack                                              | Use for                     |
| :---------------- | :------------------------------------------------- | :-------------------------- |
| `var(--font-ui)`  | `"Inter", system-ui, -apple-system, sans-serif`    | All UI labels & body text   |
| `var(--font-mono)`| `"JetBrains Mono", "IBM Plex Mono", ui-monospace`  | Code, IDs, technical values |

### Border Radius

| Variable                  | Value  | Use for                             |
| :------------------------ | :----- | :---------------------------------- |
| `var(--radius-radius)`    | `8px`  | Panels, cards, modals, dropdowns    |
| `var(--radius-radius-sm)` | `5px`  | Badges, tags, small inline elements |

---

## 🏗️ Application Layout & Shell

The app renders a persistent shell on every page. Components are in `src/react-components/`.

### Shell Layers

1. **`AppShell`**
   - Root container: `w-screen h-screen min-w-0 bg-bg flex`
   - Owns `Sidebar` and manages collapse state (`localStorage` persistence via `uiStore`)
   
2. **`Sidebar`**
   - Project sub-route navigation
   - Expanded: `w-[248px]` | Collapsed: `w-[68px]`
   - Smooth width transition: `transition-[width] duration-180 ease-out`
   - Active link receives indigo gradient — see [Interactive States](#-interactive--transition-states)

3. **`WorkspaceHeader`**
   - Glassmorphic bar: `bg-[oklch(12.2%_0.014_255_/_92%)] border-b border-border backdrop-blur-md`
   - Accepts `tabs[]` for view switching and an `actions` slot for buttons/dropdowns

### View LAYOUTS Pattern

Views define a `LAYOUTS` constant and read the active layout from `uiStore`:

```tsx
// inside a view file — e.g. ClashView.tsx
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

const { clashLayout } = useUIStore();
const layout = LAYOUTS[clashLayout];
```

---

## 🗺️ Page Mapping & Routes

All routes live under `src/routes/` and follow the `/projects/$projectId/<feature>` shape.

| Path                             | View Component  | Description                                                        |
| :--------------------------------| :---------------| :------------------------------------------------------------------|
| `/projects`                      | `ProjectsView`  | Portfolio grid/list with search & filter                           |
| `/projects/$projectId/model`     | `ModelsView`    | 3D viewport shell — model list, toolbar, property panel            |
| `/projects/$projectId/standard`  | `StandardView`  | BIM standards: BEP, naming conventions, CDE tasks                  |
| `/projects/$projectId/clashes`   | `ClashView`     | Clash detection: stats, severity, disciplines, assigned status     |
| `/projects/$projectId/documents` | `DocumentsView` | Document control: drawing lists, revisions, owners, deadlines      |
| `/projects/$projectId/settings`  | `SettingsView`  | Project config: details, members, GIS coordinates, folder structure|

> Route files are **composition only** — no hooks, no fetching. See `AGENTS.md`.

---

## 🖥️ Viewport Layout & BIM Mounting

The 3D canvas lives inside the `ModelsView` viewport container:

- **Fills** remaining space after the left panel: `flex-1 h-full relative`
- **Background** uses a subtle dot-grid mask (`linear-gradient`) to simulate a drafting board
- **Absolute overlay widgets:**
  - Top-left: camera controls (Perspective / Top / Ortho)
  - Bottom-center: BIM tool strip (Select, Measure, Clip, Isolate, Hide, Cloud Models)
- **Mount point:** The OBC engine and Three.js WebGL renderer attach at runtime via `bim-components/setup/` — never bootstrapped inside a React component

---

## 🔹 Interactive & Transition States

All interactive elements must follow these rules for a consistent premium feel.

### Focus Rings

```css
/* Applied via @layer base in style.css */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px oklch(66% 0.17 252 / 26%);
}
```

### Hover & Active Transitions

| Element type         | Class string                                                                 |
| :------------------- | :----------------------------------------------------------------------------|
| Nav / list items     | `transition-all duration-120 hover:bg-surface-alt hover:text-fg`             |
| Action buttons       | `transition-all duration-120 hover:-translate-y-[1px] active:translate-y-0`  |
| Icon buttons         | `transition-colors duration-120 hover:text-fg hover:bg-surface-raised`       |
| Cards                | `transition-all duration-150 hover:border-border-strong hover:bg-surface-alt`|

### Active Navigation Indicator

```tsx
// Active router NavLink background
className="bg-gradient-to-r from-[oklch(28%_0.07_252_/_70%)] to-[oklch(21%_0.025_255_/_92%)] border border-[oklch(48%_0.08_252)]"
```

### Loading & Skeleton States

- Use `animate-pulse` with `bg-surface-raised` for skeleton placeholders
- Spinners: `animate-spin` with `border-accent border-t-transparent` pattern
- Never block the full viewport — prefer skeleton rows within the data area

---

## 🎨 Centralized Icon System

All icons are mapped in `src/globals.ts` under the `appIcons` dictionary and rendered via `<Icon />`.

```typescript
// Usage
import { Icon } from "@/react-components/components/Icon";

<Icon name="MODEL" size={20} className="text-accent" />
<Icon name="CLASH" size={16} className="text-status-danger" />
```

### Icon Naming Conventions

| Key prefix   | Domain                      |
| :----------- | :---------------------------|
| `MODEL`      | BIM model operations        |
| `CLASH`      | Clash detection             |
| `DOCUMENT`   | Document management         |
| `SETTINGS`   | Configuration & project info|
| `FOLDER`     | File system / storage       |
| `GIS`        | Geospatial features         |
| `USER`       | Auth & member management    |

> Adding a new icon: add the icon string to `appIcons` in `globals.ts` only. Do **not** import icon libraries directly in feature or view files.

---

## 📐 Component Patterns Reference

### Panel Section

```tsx
// Use PanelSection.tsx — never <bim-panel-section>
<PanelSection title="Properties" collapsible>
  {/* content */}
</PanelSection>
```

### Status Badge

```tsx
// Inline status chip pattern
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-radius-sm)] text-xs font-medium bg-status-danger/10 text-status-danger">
  Critical
</span>
```

### Data Table Row

```tsx
// Consistent row pattern used in clash-table, documents
<tr className="border-b border-border hover:bg-surface-alt transition-colors duration-120 cursor-pointer">
  {/* cells */}
</tr>
```
