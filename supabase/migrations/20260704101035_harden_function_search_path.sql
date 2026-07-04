-- Pin a fixed search_path on functions flagged by the Supabase
-- function_search_path_mutable advisor. No function bodies change.
-- 'public, pg_temp' is used (not '') because is_hub_admin/is_project_admin
-- cast to unqualified enum types (hub_role/project_role) defined in public.

alter function public.is_hub_admin() set search_path = 'public, pg_temp';
alter function public.is_project_admin(p_id uuid, u_id uuid) set search_path = 'public, pg_temp';
alter function public.is_project_member(p_id uuid, u_id uuid) set search_path = 'public, pg_temp';
alter function public.update_modified_column() set search_path = 'public, pg_temp';
alter function public.create_dummy_user(p_email text) set search_path = 'public, pg_temp';
alter function public.set_clash_viewpoints_updated_at() set search_path = 'public, pg_temp';
