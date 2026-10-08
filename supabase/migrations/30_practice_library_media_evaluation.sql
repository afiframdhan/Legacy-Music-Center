-- Legacy Music Center — Materi Latihan Mandiri + Evaluasi Audio/Video
-- Supabase metadata only. Tutorial video stays on YouTube; file/PDF attachments stay on Google Drive.


create table if not exists public.app_sync_versions (
  module_key text primary key,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

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

create table if not exists public.practice_resources (
  resource_id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(student_id) on delete cascade,
  student_name_snapshot text,
  teacher_id text,
  teacher_name_snapshot text,
  instrument text,
  title text not null,
  description text,
  youtube_url text,
  attachments jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_practice_resources_student on public.practice_resources(student_id, active, updated_at desc);
create index if not exists idx_practice_resources_teacher on public.practice_resources(teacher_id, active, updated_at desc);

create table if not exists public.media_evaluations (
  evaluation_id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(student_id) on delete cascade,
  student_name_snapshot text,
  teacher_id text,
  teacher_name_snapshot text,
  instrument text,
  repertoire_id uuid null,
  title text not null,
  media_url text,
  media_kind text not null default 'link',
  tone_score integer not null default 0 check (tone_score between 0 and 100),
  rhythm_score integer not null default 0 check (rhythm_score between 0 and 100),
  tempo_score integer not null default 0 check (tempo_score between 0 and 100),
  technique_score integer not null default 0 check (technique_score between 0 and 100),
  expression_score integer not null default 0 check (expression_score between 0 and 100),
  strength text,
  improvement text,
  next_target text,
  feedback_markers jsonb not null default '[]'::jsonb,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_media_evaluations_student on public.media_evaluations(student_id, active, updated_at desc);
create index if not exists idx_media_evaluations_teacher on public.media_evaluations(teacher_id, active, updated_at desc);

insert into public.app_sync_versions(module_key)
values ('practice')
on conflict (module_key) do nothing;

drop trigger if exists trg_lmc_sync_practice_resources on public.practice_resources;
create trigger trg_lmc_sync_practice_resources
after insert or update or delete on public.practice_resources
for each statement execute function public.legacy_touch_sync_version('practice');

drop trigger if exists trg_lmc_sync_media_evaluations on public.media_evaluations;
create trigger trg_lmc_sync_media_evaluations
after insert or update or delete on public.media_evaluations
for each statement execute function public.legacy_touch_sync_version('practice');
