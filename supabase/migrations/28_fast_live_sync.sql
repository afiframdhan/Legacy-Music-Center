-- Legacy Music Center — Fast Live Sync
-- Lightweight change versions so clients poll one tiny table instead of reloading
-- all dashboard data every few seconds.

create table if not exists public.app_sync_versions (
  module_key text primary key,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.app_sync_versions(module_key)
values
  ('people'),('schedules'),('attendance'),('teacher_attendance'),('assignments'),
  ('progress'),('announcements'),('repertoire'),('exams'),('admin_control')
on conflict (module_key) do nothing;

create or replace function public.legacy_touch_sync_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_sync_versions(module_key, version, updated_at)
  values (tg_argv[0], 1, now())
  on conflict (module_key)
  do update set version = public.app_sync_versions.version + 1, updated_at = now();
  return coalesce(new, old);
end;
$$;

-- Create a trigger only when the source table exists. This keeps the migration
-- compatible with TEST databases where an optional feature table is not present.
do $$
declare
  r record;
  trg text;
begin
  for r in
    select * from (values
      ('students','people'),
      ('teachers','people'),
      ('student_classes','people'),
      ('student_history','people'),
      ('schedules','schedules'),
      ('schedule_overrides','schedules'),
      ('replacement_schedules','schedules'),
      ('student_attendance','attendance'),
      ('teacher_attendance','teacher_attendance'),
      ('assignments','assignments'),
      ('learning_progress','progress'),
      ('student_report_publications','progress'),
      ('announcements','announcements'),
      ('student_repertoire','repertoire'),
      ('annual_exam_assessments','exams'),
      ('audit_logs','admin_control')
    ) as x(table_name,module_key)
  loop
    if to_regclass('public.' || r.table_name) is not null then
      trg := 'trg_lmc_sync_' || r.table_name;
      execute format('drop trigger if exists %I on public.%I', trg, r.table_name);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each statement execute function public.legacy_touch_sync_version(%L)',
        trg, r.table_name, r.module_key
      );
    end if;
  end loop;
end $$;

-- Worker uses the service-role key, so no browser-facing policy is required.
