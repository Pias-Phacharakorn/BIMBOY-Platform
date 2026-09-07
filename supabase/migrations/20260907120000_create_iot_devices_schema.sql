-- ─── IOT devices ──────────────────────────────────────────────────────────────
-- Binds an IFC element to an IoT device, Autodesk-Tandem style: the user picks an
-- element in the viewport and the element *becomes* the device.
--
-- ⚠️ This migration must be applied to BOTH Supabase projects — PIAS
-- (tbrnwnghjfkwnzsldfit) and RITTA (amsgzhzesbbfozrjystt). `.env.local` is built to
-- switch the app between them, so a schema that exists in only one is a time bomb for
-- whoever switches back. → CONTEXT.md § IOT phase 2, decision 9.

-- The closed set of things a device can report. An enum rather than text[] so the
-- database and the TypeScript `Metric` union cannot drift: `types.ts` is generated
-- from this, so adding a metric is forced to be a deliberate migration that also
-- makes the author supply a threshold, a unit and a chart domain.
create type iot_metric as enum (
  'temperature',
  'humidity',
  'co2',
  'power',
  'occupancy',
  'pm25'
);

create table iot_devices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),

  -- The IFC GlobalId is the ONLY identity that survives a model re-export, which is a
  -- routine event on a construction project. Verified against three real models in this
  -- project: every sampled element carried a GUID (500/500, 211/211, 8/8) and
  -- getLocalIdsByGuids round-tripped back to the original localId.
  ifc_guid text not null,

  -- A HINT, deliberately not part of any key. `modelId` is derived from the .frag
  -- filename, and this project already contains "…989946 (1)" — storage renamed a
  -- duplicate upload. Resolution falls back to searching every loaded model and
  -- overwrites this value when it finds the element elsewhere.
  model_id text,

  -- Waiting room for the real IoT system's own device id, which the developer confirmed
  -- is the only key real sensors carry. Nullable on purpose: forcing it before a real
  -- system exists produces invented codes that have to be cleaned up later.
  device_code text,

  label text not null,

  -- Denormalised from the model on purpose. Devices are listed even when their model is
  -- not loaded, and in that state there is nothing to query — without this the row would
  -- have nothing to show beneath its label. Display only; never used for a decision.
  element_category text,

  metrics iot_metric[] not null,

  created_by uuid references profiles(uid),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One element is one device, so "is this element already bound?" is a single lookup and
  -- the later colour-by-value work has exactly one status per element to render.
  constraint iot_devices_project_guid_key unique (project_id, ifc_guid),

  -- Unique when present. Postgres allows many NULLs in a unique constraint, which is
  -- exactly the wanted behaviour while codes are still being filled in.
  constraint iot_devices_project_code_key unique (project_id, device_code),

  constraint iot_devices_metrics_not_empty check (array_length(metrics, 1) > 0),
  constraint iot_devices_label_not_blank check (length(btrim(label)) > 0),
  constraint iot_devices_ifc_guid_not_blank check (length(btrim(ifc_guid)) > 0)
);

create index iot_devices_project_id_idx on iot_devices (project_id);

-- ─── updated_at ───────────────────────────────────────────────────────────────
-- Per-table trigger function, matching the clash_viewpoints precedent rather than
-- introducing a shared one. search_path is pinned because the security advisor has
-- flagged function_search_path_mutable on this project before
-- (20260704101035_harden_function_search_path.sql exists for exactly that reason).
create function set_iot_devices_updated_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger iot_devices_set_updated_at
  before update on iot_devices
  for each row execute function set_iot_devices_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- Reading is member-level; writing is project-admin. A device binding is project
-- configuration that changes what everyone sees, not content like a clash report — an
-- element bound to the wrong sensor makes the whole team read the building wrongly, and
-- nothing signals that it is wrong. Loosening this later is a one-line policy change;
-- tightening it later takes access away from people who already had it.
--
-- is_project_member / is_project_admin / is_hub_admin are SECURITY DEFINER with
-- search_path pinned, and each already checks is_active = true internally — verified on
-- both projects — so no policy here repeats that condition.
alter table iot_devices enable row level security;

create policy "Project members can view iot devices"
  on iot_devices for select
  using (is_project_member(project_id, auth.uid()) or is_hub_admin());

create policy "Project admins can insert iot devices"
  on iot_devices for insert
  with check (is_project_admin(project_id, auth.uid()) or is_hub_admin());

create policy "Project admins can update iot devices"
  on iot_devices for update
  using (is_project_admin(project_id, auth.uid()) or is_hub_admin());

-- Hard delete, unlike the clash tables' soft delete. A soft-deleted row would keep
-- occupying unique (project_id, ifc_guid), so a user who removed a device could never
-- bind that element again — which is precisely what they do when correcting a mistake.
create policy "Project admins can delete iot devices"
  on iot_devices for delete
  using (is_project_admin(project_id, auth.uid()) or is_hub_admin());
