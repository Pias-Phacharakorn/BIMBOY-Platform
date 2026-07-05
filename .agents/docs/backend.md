# Backend — Supabase (auth, DB, storage)

> Status: seed — expand as you work this area.
> This project's Supabase wiring only. Generic Supabase docs live upstream; schema/RLS/edge-function work should go through the `Superbase_BimWeb` agent.

## Overview

Supabase is the sole backend: auth, Postgres, storage. The client is created once in `integrations/supabase/`; DB reads/writes happen inside `features/*Service.ts` files wrapped by TanStack Query hooks (`use*.ts`). Auth lifecycle lives in `AuthContext` (React context) — never in Zustand, because auth needs the React lifecycle. Supabase is never called from `views/` or `components/`.

## Key files

- `src/integrations/supabase/client.ts` — the singleton Supabase client
- `src/integrations/supabase/types.ts` — generated DB types (regenerate via Supabase MCP, don't hand-edit)
- `src/react-components/features/auth/AuthContext.tsx` — session/auth lifecycle provider
- `src/react-components/features/auth/useAuth.ts` — auth hook consumers use
- `src/react-components/features/projects/projectsService.ts` + `useProjects.ts` — project CRUD
- `src/react-components/features/hub-settings/hubSettingsService.ts` — hub settings
- `src/react-components/features/cloud-models/cloudModelsService.ts` — cloud model storage/listing
- `src/react-components/features/clash-dashboard/clashService.ts` — clash persistence
- `src/react-components/features/shop-drawings/shopDrawingsService.ts` — drawings data
- `src/classes/ProjectsManager.ts`, `src/classes/Project.ts` — domain classes (no React)

## Patterns & conventions

- **Data access is `features/` responsibility** — service file (`*Service.ts`) does the Supabase call, a `use*.ts` hook wraps it in TanStack Query. Views/components consume the hook.
- **Auth in `AuthContext` only** — no auth state in Zustand.
- Typed helpers + generated `types.ts` keep queries type-safe; regenerate types after schema changes.
- For schema/RLS/migration/edge-function work, delegate to the `Superbase_BimWeb` agent (Supabase MCP).

## Gotchas / watch-outs

- Don't call Supabase from `views/` or `components/` — always through a feature service.
- _(fill as encountered)_
