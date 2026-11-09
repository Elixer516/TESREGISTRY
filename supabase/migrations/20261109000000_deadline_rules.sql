-- A grade deadline can now narrow by section and by scholarship as well as
-- by subject and batch, so the Registrar sets one in a single step: diploma,
-- section, scholarship, batch, date. (Fresh installs already get the columns
-- from the generated schema; this brings an existing database up to it.)
-- "Batch" is now the year a trainee first enrolled, e.g. '2026'.
alter table grade_deadline_overrides
  add column if not exists section_id text references sections(id),
  add column if not exists scholarship text;
create index if not exists grade_deadline_overrides_section_id_idx
  on grade_deadline_overrides (section_id);
