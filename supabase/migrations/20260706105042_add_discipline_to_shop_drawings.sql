-- Adds a fixed discipline classification to shop drawings (e.g. Architecture,
-- Structural, Landscape, etc.), mirroring the existing enum convention used
-- for clash_type/clash_status in 20260702090024_create_clash_import_schema.sql.

create type drawing_discipline as enum (
  '01_AR',
  '02_ST',
  '03_LA',
  '04_CV',
  '05_AC',
  '06_EE',
  '07_FP',
  '08_SN'
);

alter table shop_drawings add column discipline drawing_discipline;

-- Backfill existing rows: all 3 current rows (sheet_no 'A101' x2 revisions,
-- 'A-102' x1) are unambiguously Architecture sheets.
update shop_drawings set discipline = '01_AR' where discipline is null;

alter table shop_drawings alter column discipline set not null;
