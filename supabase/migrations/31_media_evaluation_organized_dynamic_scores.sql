-- Legacy Music Center — Evaluasi Audio/Video V2
-- Menambahkan sumber Tugas/Latihan/Repertoire dan aspek penilaian dinamis per instrumen.
-- Kolom lama dipertahankan agar data/fitur lama tetap kompatibel.

alter table public.media_evaluations
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists source_label text,
  add column if not exists score_aspects jsonb not null default '[]'::jsonb;

create index if not exists idx_media_evaluations_source
  on public.media_evaluations(student_id, source_type, source_id);
