create table if not exists public.student_repertoire (
  repertoire_id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(student_id) on delete cascade,
  student_name_snapshot text not null default '',
  teacher_id text,
  teacher_name_snapshot text,
  instrument text not null default 'Musik',
  song_title text not null,
  composer text,
  key_signature text,
  level text,
  progress_percent integer not null default 0,
  status text not null default 'Belajar',
  start_date date,
  target_date date,
  last_performed_date date,
  performance_event text,
  video_url text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_repertoire_progress_check check (progress_percent between 0 and 100),
  constraint student_repertoire_status_check check (status in ('Belajar','Siap Tampil','Dikuasai','Sudah Tampil'))
);

create index if not exists idx_student_repertoire_student_id on public.student_repertoire(student_id);
create index if not exists idx_student_repertoire_teacher_id on public.student_repertoire(teacher_id);
create index if not exists idx_student_repertoire_target_date on public.student_repertoire(target_date);
create index if not exists idx_student_repertoire_active on public.student_repertoire(active);

create or replace function public.set_student_repertoire_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_repertoire_updated_at on public.student_repertoire;
create trigger trg_student_repertoire_updated_at
before update on public.student_repertoire
for each row execute function public.set_student_repertoire_updated_at();
