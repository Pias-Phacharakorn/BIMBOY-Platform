-- ─── Construction Sequence (4D) ───────────────────────────────────────────────
-- One Schedule per project: the `pias-4d-schedule/1` JSON exported by `build_4d.py`
-- (PIAS_Blender-MCP). See docs/glossary.md § Construction Sequence and the ADR-0038
-- draft in .scratch/construction-sequence/.
--
-- PIAS only (tbrnwnghjfkwnzsldfit) — RITTA is retired.
--
-- The body is validated client-side with the same Zod schema the viewer reads it
-- through (`classes/ConstructionSchedule.ts`), on upload and again on read. jsonb rather
-- than normalised task/guid tables: the Schedule is replaced whole, never edited in
-- place, and 6,560 GUIDs per project would be 6,560 rows for no query anyone runs.
create table construction_schedules (
  id uuid primary key default gen_random_uuid(),

  -- Unique: "one Schedule per project" is a rule, and upload is an upsert on this.
  project_id uuid not null unique references projects(id),

  body jsonb not null,

  uploaded_by uuid references profiles(uid),
  uploaded_at timestamptz not null default now(),

  constraint construction_schedules_body_is_object check (jsonb_typeof(body) = 'object')
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- Read = any project member (a Project Viewer included, once that role exists).
-- Write = project admin. Same split as iot_devices: the Schedule is project
-- configuration that changes what everyone sees. `is_project_admin` admits only
-- `project_admin`, so a future `project_viewer` is refused without touching this.
alter table construction_schedules enable row level security;

create policy "Project members can view construction schedules"
  on construction_schedules for select
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project admins can insert construction schedules"
  on construction_schedules for insert
  with check (is_project_admin(project_id, auth.uid()) or is_hub_admin());

create policy "Project admins can update construction schedules"
  on construction_schedules for update
  using (is_project_admin(project_id, auth.uid()) or is_hub_admin())
  with check (is_project_admin(project_id, auth.uid()) or is_hub_admin());

create policy "Project admins can delete construction schedules"
  on construction_schedules for delete
  using (is_project_admin(project_id, auth.uid()) or is_hub_admin());
