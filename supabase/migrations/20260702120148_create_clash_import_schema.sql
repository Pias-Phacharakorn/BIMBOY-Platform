-- Clash Import schema: relational replacement for the Navisworks add-in's
-- clashes.json blob (Supabase Storage: project-files/{proj}/03_ClashImport/clashes.json).
-- clash_reports = one row per "push to cloud" session; clash_viewpoints = one row per viewpoint/clash.

create type clash_type as enum ('major', 'minor', 'regulation');
create type clash_status as enum ('new', 'unresolved', 'resolved', 'approved_as_note');
create type clash_source_format as enum ('navisworks', 'bcf', 'manual');

create table clash_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  name text not null,
  source_format clash_source_format not null default 'navisworks',
  total_count int not null default 0,
  major_count int not null default 0,
  minor_count int not null default 0,
  regulation_count int not null default 0,
  resolved_count int not null default 0,
  imported_by uuid references profiles(uid),
  imported_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create index clash_reports_project_id_idx on clash_reports (project_id);

create table clash_viewpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  report_id uuid references clash_reports(id),
  guid text not null,
  name text not null,
  path text,
  type clash_type not null default 'minor',
  status clash_status not null default 'new',
  markup text,
  solution text,
  comments text,
  image_url text,
  plan_image_url text,
  section_image_url text,
  camera jsonb,
  selection jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid references profiles(uid),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  unique (project_id, guid)
);

create index clash_viewpoints_project_id_status_idx on clash_viewpoints (project_id, status);
create index clash_viewpoints_report_id_idx on clash_viewpoints (report_id);

create function set_clash_viewpoints_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clash_viewpoints_set_updated_at
  before update on clash_viewpoints
  for each row
  execute function set_clash_viewpoints_updated_at();

alter table clash_reports enable row level security;
alter table clash_viewpoints enable row level security;

create policy "Project members can view clash reports"
  on clash_reports for select
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project members can insert clash reports"
  on clash_reports for insert
  with check (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project members can update clash reports"
  on clash_reports for update
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project members can view clash viewpoints"
  on clash_viewpoints for select
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project members can insert clash viewpoints"
  on clash_viewpoints for insert
  with check (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project members can update clash viewpoints"
  on clash_viewpoints for update
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());
