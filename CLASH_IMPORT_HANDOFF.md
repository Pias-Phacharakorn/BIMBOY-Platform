# Clash Import — Handoff Notes

Read this first in the new session, then continue from "Next steps" below.

## What this is

Designing + implementing a relational Supabase schema for clash/viewpoint data pushed from the Navisworks add-in (PIAS-NavisAddIn, `btn_ViewpointCloud`), replacing the old approach of writing a single `clashes.json` blob to Supabase Storage.

Full approved plan (context, diagrams, schema rationale): `C:\Users\PhacharakornMuangkae\.claude\plans\help-me-design-database-linked-wreath.md`

## Work already done (uncommitted — review before committing)

**Database migration (not yet applied to the live project):**
- `supabase/migrations/20260702120148_create_clash_import_schema.sql`
  - Creates `clash_type`, `clash_status`, `clash_source_format` enums
  - Creates `clash_reports` (one row per Navisworks "push" batch) and `clash_viewpoints` (one row per viewpoint/clash), with a unique `(project_id, guid)` constraint for upsert semantics
  - RLS policies mirror the existing `project_members` pattern

**BIM-BOY frontend (this repo):**
- `src/integrations/supabase/types.ts` — hand-added `clash_reports`/`clash_viewpoints` table types + new enums (since it couldn't be regenerated from the live DB without the migration applied)
- `src/types/clash.ts` — rewritten to match real Navisworks vocabulary (`major`/`minor`/`regulation`, `new`/`unresolved`/`resolved`/`approved_as_note`) instead of old unused Firestore-era mock enums
- `src/types/index.ts` — barrel exports updated to match
- `src/react-components/features/clash-dashboard/clashService.ts` (new) — Supabase queries for both tables
- `src/react-components/features/clash-dashboard/useClashViewpoints.ts` (new) — React Query hooks + row→domain-type mappers
- `src/react-components/views/ClashView.tsx` — now queries real data via `useClashViewpoints` instead of a hardcoded mock array; has loading/empty states
- `.env` (gitignored, not committed) — added with the project's public anon key so the local dev server actually renders (was missing entirely before)

**PIAS-NavisAddIn (sibling repo: `_GitHub Port\PIAS-NavisAddIn`):**
- `AddinRibbon/SupabaseHelper.cs` — `PushClashAsync`/`GetClashesAsync`/`UpdateClashMetadataAsync` rewritten to hit PostgREST (`/rest/v1/clash_viewpoints`) instead of read-modify-write on `clashes.json`; added `CreateClashReportAsync` + Title-Case ⇄ enum mapping helpers
- `AddinRibbon/ScriptPanel/btn_ViewpointCloud/ViewpointPushWindow.xaml.cs` — creates one `clash_reports` row per push session, threads `reportId`/`userId` into each `PushClashAsync` call
- `AddinRibbon/ScriptPanel/btn_ViewpointCloud/ViewpointCloudWindow.xaml.cs` — updated `ViewpointPushWindow` constructor call site to pass `_localId`

**Verified so far:**
- `tsc --noEmit` passes clean in BIM-BOY
- `dotnet build` on PIAS-NavisAddIn.sln reaches and compiles all changed C# files with zero errors traceable to these changes (the ~130 other errors are pre-existing: this sandbox's `dotnet build` can't run the WPF XAML markup-compile step across the whole solution, unrelated to this work)
- BIM-BOY app mounts and redirects to `/login` correctly in browser preview once `.env` was added (no login credentials available to go further)

## MCP / Supabase access setup (why we're restarting)

- `.mcp.json` (repo root) — configured for the **local stdio** Supabase MCP server: `npx @supabase/mcp-server-supabase@latest --project-ref=tbrnwnghjfkwnzsldfit`, reading `SUPABASE_ACCESS_TOKEN` from env
- `.claude/settings.local.json` (repo root, gitignored) — contains the real `SUPABASE_ACCESS_TOKEN` (a Supabase **Personal Access Token**, account-level, from `supabase.com/dashboard/account/tokens`) so the MCP server can authenticate
- We tried the hosted OAuth connector (`https://mcp.supabase.com/mcp`) first — it got stuck at a "Requested" approval state, so we fell back to the local stdio server + PAT instead
- **This requires a full restart of Claude Code to pick up** — mid-session `/clear` does not reload `.mcp.json` or env vars, confirmed by testing (`list_tables` kept returning "Unauthorized" against the stale connection even after the config was rewritten)
- ⚠️ The PAT was pasted in plaintext in the previous session's chat transcript — user was advised to revoke and rotate it after this work is done, out of caution

## Next steps (in order)

1. **Confirm the Supabase MCP server connects with real auth** in the new session — try `mcp__supabase__list_tables` (schemas: `["public"]`) and confirm it returns real tables instead of "Unauthorized"
2. **Apply the migration** via `mcp__supabase__apply_migration` using the SQL in `supabase/migrations/20260702120148_create_clash_import_schema.sql` (or ask the user if they'd rather do it manually — no destructive risk here, it's additive DDL, but check with them first since it's a live project)
3. **Regenerate types** via `mcp__supabase__generate_typescript_types` and diff against the hand-written `src/integrations/supabase/types.ts` — replace if they match, reconcile if not
4. **Run `mcp__supabase__get_advisors` (type: security)** after the migration to confirm the new RLS policies don't trip any advisories
5. Smoke-test `ClashView` against the now-real (empty) tables if a login session is available
6. Remind the user to revoke/rotate the PAT once this is done, since it was pasted in plaintext in an earlier session
7. PIAS-NavisAddIn side still needs a real Visual Studio build + an actual push-from-Navisworks test — can't be done from this sandbox
