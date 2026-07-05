# Frontend — React / Router / State / Styling

> Status: seed — expand as you work this area.
> Project-specific depth only. Generic React/TanStack/Tailwind docs are not repeated here.

## Overview

The React layer is split into four tiers with strict isolation (see AGENTS.md layer table):
`components/` (pure UI) → `features/` (state + fetch + BIM logic) → `views/` (LAYOUTS composition) → `routes/` (composition only). Layout state lives in Zustand (`uiStore`), never React `useState`. Async data is always TanStack Query inside `features/`.

## Key files

- `src/react-components/store/uiStore.ts` — modal open/collapse/layout state (the LAYOUTS pattern)
- `src/react-components/store/projectStore.ts` — projects + active project
- `src/react-components/store/bimStore.ts` — BIM world + engine handle
- `src/react-components/store/clashStore.ts` — clash data + filters
- `src/lib/queryClient.ts` — TanStack Query client config
- `src/lib/utils.ts` — `cn()` and shared helpers
- `src/router.tsx`, `src/routes/__root.tsx` — router bootstrap + root route
- `src/react-components/views/*.tsx` — one flat file per page (StandardView, ClashView, ModelsView, etc.), each using a `LAYOUTS` const
- `src/react-components/features/**` — stateful units (kebab-case dirs); `use*.ts` hooks + `*Service.ts` data access
- `src/types/index.ts` (+ `project.ts`, `clash.ts`, `document.ts`) — shared interfaces

## Patterns & conventions

- **State location** (AGENTS.md table): layout→uiStore, projects→projectStore, clash→clashStore, world→bimStore, URL-shareable→router search params, async→TanStack Query, auth→AuthContext only (never Zustand).
- **Views** use a `LAYOUTS` const of grid-template definitions; layout state comes from the store, never local `useState`.
- **Routes** are composition only — no fetching, state, or logic. Never edit `routeTree.gen.ts`.
- **Imports** always via `@/*` alias, never relative `../../../`.
- **No `features/index.ts` barrel** (circular deps + HMR slowdown); import feature files directly.
- Styling: Tailwind utilities only, conditional classes via `cn()`, tokens from `DESIGN.md` — no raw `oklch()`/`!important` in JSX.

## Examples

_(Moved verbatim from AGENTS.md — the rule stays in AGENTS.md, the illustration lives here.)_

### Routes Pattern

```tsx
// ✅ Correct — routes are composition only
export const Route = createFileRoute('/projects/$projectId/clashes')({
  component: () => <ClashView />,
})

// ❌ Never — routes cannot fetch or manage state
export const Route = createFileRoute('/projects/$projectId/clashes')({
  component: () => {
    const [data, setData] = useState([])
    useEffect(() => { fetch(...) }, [])
    return <ClashView data={data} />
  },
})
```

### Views Pattern

```tsx
const LAYOUTS = {
  Dashboard: { areas: `"dashboard filter" "table filter"`, cols: "1fr 20rem", rows: "auto 1fr" },
  ClashModel: { areas: `"viewport viewport" "table filter"`, cols: "1fr 20rem", rows: "1fr 1fr" },
} as const;

// ✅ Layout state always from store
const { clashLayout, setClashLayout } = useUIStore();
// ❌ Never: const [layout, setLayout] = useState(...)
```

### Imports

```ts
// ✅
import { cn } from "@/lib/utils"
import { useUIStore } from "@/react-components/store/uiStore"
import { supabase } from "@/integrations/supabase/client"

// ❌
import { cn } from "../../../lib/utils"
```

## Gotchas / watch-outs

- _(fill as encountered)_
