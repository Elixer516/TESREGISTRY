-- A grade deadline can now cover one class only, set by the Registrar from
-- Grading Sheets. (Fresh installs already get the column from the generated
-- schema; this brings an existing database up to it.)
alter table grade_deadline_overrides
  add column if not exists class_schedule_id text references class_schedules(id);
create index if not exists grade_deadline_overrides_class_schedule_id_idx
  on grade_deadline_overrides (class_schedule_id);
