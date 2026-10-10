# LMC FIX — Arsip Siswa Keluar Robust

Patch khusus arsip siswa keluar. Tidak mengubah database/schema dan tidak memerlukan SQL baru.

## Perbaikan
- Lihat Arsip tidak lagi bergantung pada record `students` yang masih aktif.
- Jika siswa lama sudah terhapus dari tabel `students`, arsip tetap dapat dibuka dari `student_history` dan data terkait yang masih tersisa.
- Arsip penuh menampilkan ringkasan profil, absensi, tugas, repertoire, progress, materi latihan, evaluasi, ujian, laporan, dan riwayat status yang masih tersedia.
- Untuk siswa lama yang sudah pernah dihapus permanen, modal menampilkan `Arsip historis terbatas` jika hanya riwayat yang tersisa.
- Hapus Data sekarang tetap berhasil bila record utama siswa sudah tidak ada di Supabase: orphan history/data dibersihkan dan baris langsung hilang dari UI.
- Tombol Lihat Arsip + Hapus Data tersedia pada tab Siswa Keluar.

## File replace
- src/js/pages/dashboard.js
- src/js/pages/admin.js
- src/css/release-ui-stabilization.css
- public/js/app.bundle.js
- public/css/app.bundle.css
- worker/index.js

## Database
Tidak ada SQL/migration baru.

## Build check
- npm run build: PASS
- node --check worker/index.js: PASS
- Static parity: PASS
