create table if not exists public.schedule_overrides (
  override_id uuid primary key default gen_random_uuid(),
  original_schedule_id text not null,
  original_date date not null,
  original_day_name text not null default '',
  original_start_time time,
  original_end_time time,
  original_teacher_id text,
  original_teacher_name_snapshot text not null default '',
  original_room text not null default '',
  original_instrument text not null default '',
  absent_student_id text references public.students(student_id) on delete cascade,
  absent_student_name_snapshot text not null default '',
  slot_student_id text references public.students(student_id) on delete set null,
  slot_student_name_snapshot text not null default '',
  slot_instrument text not null default '',
  makeup_date date,
  makeup_start_time time,
  makeup_end_time time,
  makeup_teacher_id text,
  makeup_teacher_name_snapshot text not null default '',
  makeup_room text not null default '',
  reason text not null default 'Lainnya',
  notes text not null default '',
  status text not null default 'Aktif',
  created_by_role text not null default '',
  created_by_id text,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_overrides_status_check check (status in ('Aktif','Selesai','Dibatalkan')),
  constraint schedule_overrides_makeup_time_check check (
    (makeup_date is null and makeup_start_time is null and makeup_end_time is null)
    or
    (makeup_date is not null and makeup_start_time is not null and makeup_end_time is not null and makeup_end_time > makeup_start_time)
  )
);

create unique index if not exists idx_schedule_overrides_schedule_date_active
  on public.schedule_overrides(original_schedule_id, original_date)
  where status = 'Aktif';

create index if not exists idx_schedule_overrides_absent_student on public.schedule_overrides(absent_student_id);
create index if not exists idx_schedule_overrides_slot_student on public.schedule_overrides(slot_student_id);
create index if not exists idx_schedule_overrides_makeup_date on public.schedule_overrides(makeup_date);
create index if not exists idx_schedule_overrides_original_date on public.schedule_overrides(original_date);
