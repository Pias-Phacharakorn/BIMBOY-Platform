-- Shop Drawing Register: one row per revision of a drawing sheet.
-- Storage layout: project-files/{project.projectnumber}_{project.projectName}/04_Drawing/{sheetNo}/Rev{n}_{timestamp}.pdf
-- "Latest revision" is derived (max(revision) per sheet_no), not stored —
-- mirrors src/react-components/features/shop-drawings/ShopDrawingTable.tsx groupedDrawings logic.

create table shop_drawings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  sheet_no text not null,
  sheet_name text not null,
  author text,
  revision int not null default 0,
  pdf_path text not null,
  uploaded_at timestamptz not null default now(),
  created_by uuid references profiles(uid),
  unique (project_id, sheet_no, revision)
);

create index shop_drawings_project_id_idx on shop_drawings (project_id);
create index shop_drawings_project_id_sheet_no_idx on shop_drawings (project_id, sheet_no);

alter table shop_drawings enable row level security;

create policy "Project members can view shop drawings"
  on shop_drawings for select
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project members can insert shop drawings"
  on shop_drawings for insert
  with check (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project members can delete shop drawings"
  on shop_drawings for delete
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());
