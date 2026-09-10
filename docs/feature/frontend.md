# Frontend — React / Router / State / Styling

> Project-specific depth only. Generic React/TanStack/Tailwind docs are not repeated here.

## Overview

The React layer is split into four tiers with strict isolation (see CLAUDE.md layer table):
`components/` (pure UI) → `features/` (state + fetch + BIM logic) → `views/` (LAYOUTS composition) → `routes/` (composition only). Layout state lives in Zustand (`uiStore`), never React `useState`. Async data is always TanStack Query inside `features/`.

## Patterns & conventions

- **State location** (CLAUDE.md table): layout→uiStore, projects→projectStore, clash→clashStore, world→bimStore, URL-shareable→router search params, async→TanStack Query, auth→AuthContext only (never Zustand).
- **Views** use a `LAYOUTS` const of grid-template definitions; layout state comes from the store, never local `useState`.
- **Routes** are composition only — no fetching, state, or logic. Never edit `routeTree.gen.ts`.
- **Imports** always via `@/*` alias, never relative `../../../`.
- Inside a feature dir, data access splits by filename: `*Service.ts` makes the call, `use*.ts`
  wraps it in TanStack Query, and the component consumes only the hook. CLAUDE.md's naming table
  does not cover these two suffixes — they are a convention of this layer.
- **No `features/index.ts` barrel** (circular deps + HMR slowdown); import feature files directly.
- Styling: Tailwind utilities only, conditional classes via `cn()`, tokens from `DESIGN.md` — no raw `oklch()`/`!important` in JSX.

## Examples

_(Moved verbatim from CLAUDE.md — the rule stays in CLAUDE.md, the illustration lives here.)_

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
