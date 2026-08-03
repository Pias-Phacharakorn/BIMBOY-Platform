# Backend — Supabase (auth, DB, storage)

> Status: seed — expand as you work this area.
> This project's Supabase wiring only. Generic Supabase docs live upstream; schema/RLS/edge-function work should go through the `Agent_Supabase` agent.

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
- **Auth redirects use ONE mechanism: route `beforeLoad` guards.** Protected routes (`routes/projects.tsx`, `routes/hub-settings.tsx`) throw `redirect()` in `beforeLoad`; `routes/login.tsx` redirects already-authenticated users away, honoring the `?redirect=` param via `redirect({ href })` (internal paths only). `main.tsx` calls `router.invalidate()` when `auth.isAuthenticated`/`auth.profile` change so guards re-run against fresh context. Do **not** add `useEffect`/`window.location` redirects in `main.tsx` or `__root.tsx` — competing mechanisms caused a post-login `/login`↔`/projects` redirect loop (~3,390 bounces).
- **`AuthContext` must not flip `isLoading` back to `true` on `onAuthStateChange`.** `isLoading` gates the initial session-recovery spinner in `main.tsx`, which unmounts the whole router. Toggling it after login unmounts the router mid-navigation (the other half of the loop). The post-login profile fetch therefore runs in the background.
- Typed helpers + generated `types.ts` keep queries type-safe; regenerate types after schema changes.
- For schema/RLS/migration/edge-function work, delegate to the `Agent_Supabase` agent (Supabase MCP).

## Gotchas / watch-outs

- Don't call Supabase from `views/` or `components/` — always through a feature service.
- Profile is fetched in the background after login; guards that read `context.auth.profile` (e.g. `hub-settings`' `hub_role`) depend on `main.tsx`'s `router.invalidate()` being keyed on `auth.profile` so they re-run once the profile resolves — otherwise a valid admin can be wrongly denied right after login.
- _(fill as encountered)_
