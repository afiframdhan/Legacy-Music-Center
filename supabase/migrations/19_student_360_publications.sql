-- Student 360 publication channel (TEST)
-- Additive only: creates a new table; does not modify existing student/progress data.

create table if not exists public.student_report_publications (
  report_id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(student_id) on delete cascade,
  progress_id text null,
  signature_mode text not null default 'uploaded'
    check (signature_mode in ('uploaded','manual')),
  sent_by_id text null,
  sent_by_name text not null default '',
  sent_by_role text not null default '',
  sent_at timestamptz not null default now(),
  active boolean not null default true
);

create index if not exists idx_student_report_publications_student_sent
  on public.student_report_publications (student_id, sent_at desc);

create index if not exists idx_student_report_publications_progress
  on public.student_report_publications (progress_id);
