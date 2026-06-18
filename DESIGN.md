# BIM-BOY UI & Design Reference

This document serves as the developer-facing design reference for the **BIM-BOY** web application. It outlines the design system tokens, layout structure, page routing, centralized icon mapping, and visual interaction states to maintain visual consistency and UI excellence.

---

## 🎨 Design System & Styling Tokens

BIM-BOY uses **Tailwind CSS v4** with themes defined using OKLCH color spaces. All customized base styles reside inside `@layer base {}` in `src/style.css` to allow Tailwind's utility classes to override them cleanly.

### Color Palette (@theme)
Colors are defined using OKLCH coordinates to provide smooth gradients, high-contrast states, and a sleek dark mode appearance.

| Token Name | Value | Purpose / Description |
| :--- | :--- | :--- |
| `--color-bg` | `oklch(10.5% 0.012 255)` | Deep background canvas color |
| `--color-surface` | `oklch(14.5% 0.014 255)` | Standard panel and sidebar background |
| `--color-surface-alt` | `oklch(19% 0.018 255)` | Intermediate elevated panel backdrop |
| `--color-surface-raised` | `oklch(23% 0.02 255)` | High contrast cards, dropdowns, and active states |
| `--color-fg` | `oklch(93% 0.012 250)` | Primary readable text |
| `--color-muted` | `oklch(68% 0.02 250)` | Secondary text, inactive states, and descriptions |
| `--color-muted-2` | `oklch(51% 0.018 250)` | Subtitle text, small details, and separators |
| `--color-border` | `oklch(27% 0.018 255)` | Subtle borders for card separations |
| `--color-border-strong`| `oklch(38% 0.03 255)` | Defined borders for buttons and inputs |
| `--color-accent` | `oklch(66% 0.17 252)` | Primary branding/indigo blue accent |
| `--color-accent-2` | `oklch(74% 0.13 195)` | Secondary teal/cyan accent |
| `--color-accent-muted`| `oklch(31% 0.075 252)`| Background highlights |
| `--color-status-ok` | `oklch(70% 0.14 150)` | Green indicator (Valid, Active, Approved, Closed) |
| `--color-status-warn` | `oklch(77% 0.14 76)` | Yellow indicator (Review, Pending, In-progress) |
| `--color-status-danger`| `oklch(63% 0.18 28)` | Red indicator (Critical, Low, Overdue, Rejected) |
| `--color-status-info` | `oklch(70% 0.13 235)` | Blue indicator |

### Typography & Fonts
- **UI Font**: `var(--font-ui)` -> `"Inter", system-ui, -apple-system, sans-serif`
- **Mono Font**: `var(--font-mono)` -> `"JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace`

### Radius
- **Standard**: `var(--radius-radius)` -> `8px`
- **Small**: `var(--radius-radius-sm)` -> `5px`

---

## 🏗️ Application Layout & Shell

The application maintains a unified structure via the React layout system:

1. **`AppShell`** ([AppShell.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/AppShell.tsx))
   - Persistent page container.
   - Houses the `Sidebar` and manages its collapsing states using `localStorage` persistence.
   - Sets up the main flex grid layout (`w-screen h-screen min-w-0 bg-[#090a0f]`).

2. **`Sidebar`** ([Sidebar.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/Sidebar.tsx))
   - Navigates through the active project sub-routes.
   - Expandable (`w-[248px]`) or collapsible (`w-[68px]`) with smooth transitions (`transition-[width] duration-180 ease-out`).
   - Uses active state indicators powered by React Router `NavLink`.

3. **`WorkspaceHeader`** ([WorkspaceHeader.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/WorkspaceHeader.tsx))
   - Renders a standard header for all project pages.
   - Features a glassmorphic background layer (`bg-[oklch(12.2%_0.014_255_/_92%)] border-b border-border backdrop-blur-md`).
   - Supports a dynamic `tabs` array mapping to navigation views.
   - Exposes an `actions` slot for buttons, dropdowns, and layouts.

---

## 🗺️ Page Mapping & Routes

Every user-facing screen corresponds to a designated React component and route mapping inside `src/index.tsx`:

| Path | Component | File | Description |
| :--- | :--- | :--- | :--- |
| `/projects` | `ProjectsPage` | [ProjectsPage.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/ProjectsPage.tsx) | Project portfolio selection view with Card/List layouts, search/filter capabilities. |
| `/projects/:projectId/model` | `ProjectDetailsPage` | [ProjectDetailsPage.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/ProjectDetailsPage.tsx) | Primary 3D model viewport shell incorporating loaded models lists, toolbars, and item properties. |
| `/projects/:projectId/standard` | `ProjectStandardPage` | [ProjectStandardPage.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/ProjectStandardPage.tsx) | BIM Standards center containing BEP (BIM Execution Plan), naming standards, and CDE tasks. |
| `/projects/:projectId/clashes` | `ClashDetectionPage` | [ClashDetectionPage.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/ClashDetectionPage.tsx) | Issue detection tracker listing clash stats, severity, disciplines, and assigned status. |
| `/projects/:projectId/documents` | `DocumentStatusPage` | [DocumentStatusPage.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/DocumentStatusPage.tsx) | Document control manager tracking drawing lists, revisions, owners, status levels, and deadlines. |
| `/projects/:projectId/settings` | `ProjectSettingsPage` | [ProjectSettingsPage.tsx](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/react-components/ProjectSettingsPage.tsx) | Configuration panel allowing editing project details, member management, and GIS coordinate setups. |

---

## 🖥️ Viewport Layout & Custom BIM Mounting

In `ProjectDetailsPage.tsx`, the 3D canvas viewport uses `.viewport-container`:
- Spans full height and flex-1 width.
- Features a subtle background grid mask (`linear-gradient`) to simulate a drafting board environment.
- Houses absolute overlay widgets:
  - **Top-left panel**: camera focus controls (Perspective / Top View).
  - **Bottom-center toolbar**: BIM tool icons (Select, Measure, Clip, Isolate, Hide).
- **Runtime Mount Point**: The 3D `@thatopen/components` engine and Three.js WebGL renderer mount dynamically inside this container in a later pass.

---

## 🔹 Interactive & Transition States

Consistent feedback is crucial to our premium UX. All controls must apply these interaction behaviors:

- **Focus Outlines**: All interactive inputs, buttons, and selects must use `:focus-visible` to override browser defaults:
  ```css
  box-shadow: 0 0 0 3px oklch(66% 0.17 252 / 26%);
  outline: none;
  ```
- **Hover Transitions**: Standard interactive components like lists, cards, and buttons must transition color, opacity, or position smoothly:
  - Navigation buttons: `transition-all duration-120 hover:bg-surface-alt hover:text-fg`
  - Action buttons: `transition-all duration-120 hover:-translate-y-[1px] active:translate-y-0`
- **Active Navigation Items**: Active router navigation items receive a dark indigo gradient background:
  `bg-gradient-to-r from-[oklch(28%_0.07_252_/_70%)] to-[oklch(21%_0.025_255_/_92%)] border-[oklch(48%_0.08_252)]`

---

## 🎨 Centralized Icon System

To keep icons consistent and lightweight across the app, BIM-BOY uses a single React component `<Icon />` mapped to standard icon packages (Fluent, Solar, material-symbols, MDI, etc.):

- **Icon Definitions**: All icon strings are centralized in the `appIcons` dictionary inside [globals.ts](file:///c:/Users/Tapeak/AppData/Roaming/_GitHubPIAS/BIM-BOY/src/globals.ts).
- **Component Interface**:
  ```typescript
  import { Icon } from "./Icon";
  
  // Render an icon by name
  <Icon name="MODEL" size={20} className="text-accent" />
  ```
