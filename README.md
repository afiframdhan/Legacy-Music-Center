# Arsip Siswa Keluar — Legacy Music Center

Fitur baru khusus Admin.

## Cara membuka
Dashboard Admin → Statistik & Laporan Siswa → tab **Siswa Keluar** → **Lihat Arsip**.

## Isi arsip
- Profil dan alasan keluar
- Riwayat kelas & jadwal
- Absensi
- Tugas & status pengumpulan
- Progress Belajar
- Repertoire
- Latihan Mandiri & Evaluasi Audio/Video
- Ujian Tahunan
- Laporan resmi

Semua data arsip bersifat read-only.

## Perilaku
- Tidak mengubah status siswa.
- Tidak menghapus data.
- Tidak membuat migration/SQL baru.
- Tombol Hapus Data lama tetap tersedia dan tetap manual oleh Admin.
- Fitur operasional Aktif/Cuti/Keluar dari patch sebelumnya tetap dipertahankan.

## File yang perlu direplace
- src/js/pages/dashboard.js
- src/css/release-ui-stabilization.css
- public/index.html
- public/js/app.bundle.js
- public/css/app.bundle.css
- worker/index.js

## Validasi
- npm run build: PASS
- node --check worker/index.js: PASS
- Static parity checks: PASS
