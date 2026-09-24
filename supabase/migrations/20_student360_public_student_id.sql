-- Student 360 publication identity fix
-- Keeps the existing UUID column for compatibility, but the application
-- now uses the same SIS-* student ID used by the rest of Legacy Music Center.

alter table if exists public.student_report_publications
  add column if not exists student_public_id text;

alter table if exists public.student_report_publications
  alter column student_id drop not null;

create index if not exists idx_student_report_publications_student_public_id
  on public.student_report_publications (student_public_id, active, sent_at desc);

-- Backfill old publications when their progress record can identify the student.
update public.student_report_publications p
set student_public_id = lp.student_id
from public.learning_progress lp
where p.student_public_id is null
  and p.progress_id is not null
  and lp.progress_id = p.progress_id
  and lp.student_id is not null;

-- Optional safety: no destructive change. Existing UUID values stay untouched.
