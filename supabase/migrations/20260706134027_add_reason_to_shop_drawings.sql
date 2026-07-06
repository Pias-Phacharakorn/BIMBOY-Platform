-- Adds a `reason` column to shop_drawings, required for revision uploads
-- (revision > 0) but not applicable to the initial sheet creation
-- (revision = 0). Enforced at the app UI layer and backed by a DB check
-- constraint here.

alter table shop_drawings add column reason text;

-- Backfill: 4 existing revision > 0 rows predate this column and have no
-- recorded reason. Set a placeholder so the new check constraint below can
-- be applied without breaking existing data.
update shop_drawings set reason = 'Not recorded (added retroactively)'
where revision > 0 and reason is null;

alter table shop_drawings add constraint shop_drawings_reason_required_check
  check (revision = 0 or reason is not null);
