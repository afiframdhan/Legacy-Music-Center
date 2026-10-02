-- Legacy Music Center — alasan siswa keluar
-- Additive only. Safe to run once in Supabase.
alter table if exists public.students
  add column if not exists exit_reason text;

comment on column public.students.exit_reason is
  'Keterangan/alasan siswa berstatus Keluar. Dikelola oleh Admin.';
