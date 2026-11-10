-- Fields the application form and the MIS report now carry:
--   address_country     the address ends with the country (Philippines unless abroad)
--   disability_cause    Congenital/Inborn, Illness or Injury — optional
--   other_scholarship   any other scholarship availed, typed in
--   assigned_batch      a batch the Registrar set by hand, e.g. '2026';
--                       blank means the year the trainee first enrolled
-- (Fresh installs already get the columns from the generated schema; this
-- brings an existing database up to it.)
alter table students
  add column if not exists address_country text,
  add column if not exists disability_cause text,
  add column if not exists other_scholarship text,
  add column if not exists assigned_batch text;

update students set address_country = 'Philippines' where address_country is null;
update students set disability_cause = '' where disability_cause is null;
update students set other_scholarship = '' where other_scholarship is null;
update students set assigned_batch = '' where assigned_batch is null;
