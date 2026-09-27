-- Legacy Music Center — Annual Exam & Certificate TEST v1
-- Run this in Supabase TEST only before deploying the TEST branch.

create extension if not exists pgcrypto;

create table if not exists public.annual_exam_assessments (
  exam_id uuid primary key default gen_random_uuid(),
  student_public_id text not null,
  student_name_snapshot text not null default '',
  teacher_id text,
  teacher_name_snapshot text not null default '',
  instrument text not null default '',
  grade_exam text not null default '',
  exam_date date not null default current_date,
  examiner_1_name text not null default '',
  examiner_2_name text not null default '',
  examiner_1_signature_url text not null default '',
  examiner_2_signature_url text not null default '',
  notes_examiner_1 text not null default '',
  notes_examiner_2 text not null default '',
  items jsonb not null default '[]'::jsonb,
  final_score numeric(5,1) not null default 0 check (final_score >= 0 and final_score <= 100),
  predicate text not null default '',
  result_status text not null default 'Belum Lulus',
  next_grade text not null default '',
  certificate_no text unique,
  headmaster_name text not null default 'Faisal Rahmat Permana, S.Sn., M.Pd',
  headmaster_signature_url text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  published_by_id text,
  published_by_name text not null default '',
  created_by_role text not null default '',
  created_by_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists annual_exam_student_idx on public.annual_exam_assessments(student_public_id, active, exam_date desc);
create index if not exists annual_exam_teacher_idx on public.annual_exam_assessments(teacher_id, active, exam_date desc);
create index if not exists annual_exam_published_idx on public.annual_exam_assessments(student_public_id, published, active, exam_date desc);

alter table public.annual_exam_assessments enable row level security;
-- No browser-side policies are created. The Cloudflare Worker uses the service role and enforces role/student access itself.
