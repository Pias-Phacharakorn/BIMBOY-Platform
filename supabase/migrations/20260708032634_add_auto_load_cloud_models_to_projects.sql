-- Adds a per-project switch for the cloud-model auto-load behavior
-- (useAutoLoadCloudModels), which today runs unconditionally on project open.
-- Defaults to `true` so this change is purely additive: every existing
-- project keeps its current always-on behavior until an admin opts out.
--
-- The toggle's read/write path uses the `projects` table directly
-- (projectsService.getProjectById / updateProject). The active_projects view
-- is recreated to expose the column too, so the projects list page stays
-- consistent with the table.

alter table projects
  add column auto_load_cloud_models boolean not null default true;

-- Recreate the view with the new column appended (explicit column list,
-- WHERE is_deleted = false preserved). CREATE OR REPLACE VIEW resets a view's
-- reloptions, so security_invoker=true (added in
-- 0002_fix_active_projects_view_security_invoker) MUST be restated here — the
-- view relies on it so RLS is evaluated as the querying user, not the owner.
create or replace view active_projects
  with (security_invoker = true) as
  select
    id,
    project_name,
    project_number,
    description,
    status,
    start_date,
    finish_date,
    ifc_folder_path,
    frag_folder_path,
    has_model,
    clash_folder_path,
    latitude,
    longitude,
    rotation,
    elevation,
    created_by,
    created_at,
    updated_at,
    is_deleted,
    auto_load_cloud_models
  from projects
  where is_deleted = false;
