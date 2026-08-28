# ADR-0021: Guest demo mode is client-side only

**Status:** Accepted
**Date:** 2026-08-12
**Area:** [`docs/feature/backend.md`](../feature/backend.md) § Guest demo mode

## Context

The ask was a public demo: land on `/demo`, see a real project in the viewer, without an account.

The obvious implementation is Supabase **anonymous sign-in** plus a `projects.is_demo` column and
RLS policies admitting anonymous users to that one row. It was fully planned and the migration was
written before being deleted. Three findings killed it — and they are worth keeping, because they
are *pre-existing* risks in this database that will resurface the day anyone enables the
anonymous-sign-in switch for an unrelated reason.

1. **Anonymous users hold the `authenticated` Postgres role.** Any policy checking only the role
   (`auth.role() = 'authenticated'`, or `to authenticated` with no predicate) starts admitting
   guests the instant the dashboard switch is flipped — no policy edit, no error, nothing in the
   logs. Enabling the switch and shipping guest policies would therefore have had to be one atomic
   change.
2. **`create_dummy_user` is a `SECURITY DEFINER` function in `public`**, called straight from the
   browser (`projectsService.addProjectMember`, `hubSettingsService`). Postgres grants `EXECUTE` to
   `PUBLIC` by default, so RPCs are not RLS-gated at all: today any registered user can mint
   `auth.users` rows, and with anonymous sign-in on it becomes an unauthenticated endpoint.
3. **A possible self-promotion chain:** if the `profiles` UPDATE policy lets a caller set their own
   `hub_role`, a guest becomes `hub_admin` and `is_hub_admin()` opens every policy in the database.

**None of the three were confirmed against the live database** — the Supabase MCP was unauthorised
for that entire session. They are unverified hazards, not established bugs.

Compounding it: dev and production share one Supabase project (`tbrnwnghjfkwnzsldfit` in both
`.env.local` and the Cloudflare build variables), so there is **no staging database** to try any of
it against.

## Decision

A guest gets **no Supabase session at all**.

- `AuthContext` carries an `isGuest` flag in `sessionStorage`.
- `useProjects` / `useProject` / `useProjectMembers` short-circuit to a hard-coded
  `DEMO_PROJECT_ROW` before any network call.
- The viewer loads `.frag` files from `public/resources/demo/` as static assets.
- `/demo` is the single entry point, and its `beforeLoad` guard performs the navigation, so the
  one-redirect-mechanism rule holds.

Zero backend surface means zero new RLS to get wrong, and it won on risk alone given the shared
database.

## Alternatives rejected

- **Supabase anonymous sign-in + `projects.is_demo` + RLS** — the three findings above, against a
  database with no staging copy.
- **A second Supabase project for the demo** — a real staging boundary, but it means duplicating
  schema, storage and deploy config for one read-only project.

## Consequences

- **Bug found by testing: guest mode did not survive a page refresh.** A hard load of any
  `/projects/*` URL bounced guests to `/login` even with the flag in `sessionStorage`, because on a
  hard load the router evaluates `beforeLoad` before `RouterProvider`'s context is wired
  (`router.tsx` starts with `auth: undefined!`). A signed-in user self-heals — `login.tsx`'s guard
  bounces them to `?redirect=` — but a guest has nothing to bounce them back, so they were stranded.
  Fix: `src/lib/guestSession.ts` owns the flag and the guards read it **synchronously**, not only
  off `context.auth`. It lives in `lib/` because both `AuthContext` and the route guards need it,
  and features may not import one another.
- **Verified in a production preview (2026-08-12):** `/demo` to guest session to model route, 8 demo
  `.frag` files auto-download (all HTTP 200) and render.
- **Open, and not proven:** the MODELS LIST panel shows 7 of the 8 on first paint, and *which* one is
  absent varies per run. All 8 fetch cleanly and no load error surfaces, so it looks like a
  list-subscription race rather than a dropped model — but that is a hypothesis, not a diagnosis.
- The demo project is a hard-coded row. Changing what the demo shows is a code change plus new
  `.frag` files in `public/resources/demo/`, not a database edit.
- **The three security findings remain unverified and unfixed.** They are properties of the existing
  schema, not of this feature. `supabase/audits/guest_mode_preflight.sql` held the read-only queries
  to check them and was deleted with the migration; it survives in git history on
  `feat/guest-demo-mode`. Anyone enabling anonymous sign-in should run it first.
