# Backend — Supabase (auth, DB, storage)

> This project's Supabase wiring only. Generic Supabase docs live upstream; schema/RLS/edge-function work should go through the `Agent_Supabase` agent.

## Overview

Supabase is the sole backend: auth, Postgres, storage. The client is created once in `integrations/supabase/`; DB reads/writes happen inside `features/*Service.ts` files wrapped by TanStack Query hooks (`use*.ts`). Auth lifecycle lives in `AuthContext` (React context) — never in Zustand, because auth needs the React lifecycle. Supabase is never called from `views/` or `components/`.

## Patterns & conventions

- **Data access is `features/` responsibility** — service file (`*Service.ts`) does the Supabase call, a `use*.ts` hook wraps it in TanStack Query. Views/components consume the hook.
- **Auth in `AuthContext` only** — no auth state in Zustand.
- **Auth redirects use ONE mechanism: route `beforeLoad` guards.** Protected routes (`routes/projects.tsx`, `routes/hub-settings.tsx`) throw `redirect()` in `beforeLoad`; `routes/login.tsx` redirects already-authenticated users away, honoring the `?redirect=` param via `redirect({ href })` (internal paths only). `main.tsx` calls `router.invalidate()` when `auth.isAuthenticated`/`auth.profile` change so guards re-run against fresh context. Do **not** add `useEffect`/`window.location` redirects in `main.tsx` or `__root.tsx` — competing mechanisms caused a post-login `/login`↔`/projects` redirect loop (~3,390 bounces).
- **`AuthContext` must not flip `isLoading` back to `true` on `onAuthStateChange`.** `isLoading` gates the initial session-recovery spinner in `main.tsx`, which unmounts the whole router. Toggling it after login unmounts the router mid-navigation (the other half of the loop). The post-login profile fetch therefore runs in the background.
- **`integrations/supabase/types.ts` is generated — never hand-edit it.** Regenerate through the
  Supabase MCP after every schema change. A hand-edit is silently destroyed by the next generate,
  and until then it lies about the schema.
- For schema/RLS/migration/edge-function work, delegate to the `Agent_Supabase` agent (Supabase MCP).

## Guest demo mode

`/demo` gives a signed-out visitor a working viewer. **A guest gets no Supabase session at all** — the whole feature is client-side, with zero backend surface. → [ADR-0021](../adr/0021-guest-demo-mode-is-client-side-only.md).

- `AuthContext` carries an `isGuest` flag in `sessionStorage`; `useProjects` / `useProject` / `useProjectMembers` short-circuit to a hard-coded `DEMO_PROJECT_ROW` **before any network call**; the viewer loads `.frag` files from `public/resources/demo/` as static assets.
- `/demo` is the single entry point and its `beforeLoad` guard performs the navigation, so the one-redirect-mechanism rule above still holds.
- ⚠️ **`src/lib/guestSession.ts` owns the flag, and the route guards read it *synchronously*** — not only off `context.auth`. This is not stylistic: on a hard load the router evaluates `beforeLoad` before `RouterProvider`'s context is wired (`router.tsx` starts with `auth: undefined!`). A signed-in user self-heals because `login.tsx`'s guard bounces them to `?redirect=`; a guest has nothing to bounce them back, so guest mode did not survive a refresh at all. It lives in `lib/` because both `AuthContext` and the route guards need it, and features may not import one another.
- Changing what the demo shows is a code change plus new `.frag` files — not a database edit.
- **Open, unproven:** the MODELS LIST panel shows 7 of the 8 demo models on first paint, and which one is absent varies per run. All 8 fetch cleanly (HTTP 200) and no load error surfaces, so it looks like a list-subscription race rather than a dropped model — but that is a hypothesis.

### ⚠️ Before anyone enables Supabase anonymous sign-in

Anonymous auth was the rejected design, and three **unverified** hazards are the reason. They are properties of the existing schema, not of the demo feature, so they apply to whoever flips that switch for any reason:

1. **Anonymous users hold the `authenticated` Postgres role.** Any policy checking only the role (`auth.role() = 'authenticated'`, or `to authenticated` with no predicate) starts admitting guests the instant the switch is flipped — no policy edit, no error, nothing in the logs.
2. **`create_dummy_user` is a `SECURITY DEFINER` function in `public`**, called straight from the browser. Postgres grants `EXECUTE` to `PUBLIC` by default, so RPCs are not RLS-gated: today any registered user can mint `auth.users` rows; with anonymous sign-in on it becomes an unauthenticated endpoint.
3. **A possible self-promotion chain:** if the `profiles` UPDATE policy lets a caller set their own `hub_role`, a guest becomes `hub_admin` and `is_hub_admin()` opens every policy in the database.

None were confirmed against the live database. The read-only queries to check them were written as `supabase/audits/guest_mode_preflight.sql` and survive in git history on `feat/guest-demo-mode`.

### Two projects, no staging

**There is no staging database.** Whichever project the app points at *is* production, so every migration is a production change.

And there are **two** projects, not one — `.env.local` switches the app between them by commenting one `VITE_SUPABASE_URL` block and uncommenting the other, with instructions written into the file:

| Account | Project ref | Notes |
|---------|-------------|-------|
| PIAS | `tbrnwnghjfkwnzsldfit` | The original. Cloudflare build variables still point here |
| RITTA | `amsgzhzesbbfozrjystt` | **What `.env.local` selects today** |

Both carry the same tables and the same `is_project_member` / `is_project_admin` / `is_hub_admin` helpers (all `SECURITY DEFINER`, `search_path` pinned, each testing `is_active` itself), but they hold **different data** — different projects, different members.

⚠️ **A schema change must be applied to both.** Applying to one leaves the other broken the moment somebody switches `.env.local` back, and nothing about the resulting "relation does not exist" points at the migration as the cause. The MCP servers are named `supabase-pias` and `supabase-ritta` for exactly this reason.

`.mcp.json` reads its access tokens from environment variables, and **Claude Code does not read `.env.local`** — only Vite (for `VITE_*`) and `playwright.config.ts` (which calls `loadEnv` deliberately) do. Put them in `.claude/settings.local.json` under `env`, which is git-ignored; never in `.mcp.json`, which is tracked.

## Gotchas / watch-outs

- Don't call Supabase from `views/` or `components/` — always through a feature service.
- Profile is fetched in the background after login; guards that read `context.auth.profile` (e.g. `hub-settings`' `hub_role`) depend on `main.tsx`'s `router.invalidate()` being keyed on `auth.profile` so they re-run once the profile resolves — otherwise a valid admin can be wrongly denied right after login.
- _(fill as encountered)_
