# LMC — Arsip Siswa Keluar + Orphan Cleanup

Patch dibuat dari baseline `Legacy-Music-Center(5).zip` + patch status siswa Aktif/Cuti/Keluar.

## Perbaikan
- Tab Siswa Keluar memiliki tombol `Lihat Arsip` untuk seluruh record.
- Arsip siswa tetap dapat dibuka jika master siswa masih ada.
- Jika master siswa sudah dihapus dari Supabase tetapi `student_history` masih tersisa, arsip membuka snapshot/riwayat yang masih tersedia dan memberi penjelasan bahwa detail akademik yang telah dipurge tidak dapat dipulihkan.
- `Hapus Data` sekarang dapat membersihkan orphan/ghost record yang master siswanya sudah tidak ada di Supabase.
- Permanent purge siswa Keluar sekarang ikut membersihkan Materi Latihan, Evaluasi Audio/Video, laporan berdasarkan `student_public_id`, riwayat berdasarkan ID maupun nama snapshot, dan data terkait lain yang sebelumnya belum lengkap.
- Tidak ada migration SQL baru.

## File yang direplace
- src/js/pages/dashboard.js
- src/js/pages/admin.js
- src/css/base-layout.css
- public/js/app.bundle.js
- public/css/app.bundle.css
- worker/index.js

## Verifikasi
- npm run build: PASS
- node --check worker/index.js: PASS
- static parity: PASS
