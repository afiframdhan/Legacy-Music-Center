# Release Checklist — Legacy Music Center

## Pre-deploy
- [ ] Backup Supabase dilakukan.
- [ ] Backup Google Drive/folder penting dipastikan tersedia.
- [ ] Migration 32 sudah dijalankan.
- [ ] `npm run build` PASS.
- [ ] `node --check worker/index.js` PASS.
- [ ] Cloudflare secrets production sudah lengkap.

## Admin
- [ ] Login / logout / refresh / PWA reopen.
- [ ] Tambah siswa → password awal acak muncul.
- [ ] Login siswa baru → wajib ganti password.
- [ ] Edit/cuti/keluar/purge dummy siswa.
- [ ] Guru CRUD.
- [ ] Jadwal + pergantian + make-up.
- [ ] Pengumuman create/delete + live sync.
- [ ] Absensi Guru.
- [ ] Kalender Operasional.
- [ ] Audit Log / Data Quality / Export Backup.

## Guru
- [ ] Materi & Absensi create/edit/delete + signatures.
- [ ] Tugas create + YouTube + Drive attachment.
- [ ] Jawaban siswa terlihat.
- [ ] Progress save/edit/detail/print.
- [ ] Repertoire CRUD.
- [ ] Latihan Mandiri detail + file/video.
- [ ] Evaluasi Audio/Video create/filter/detail.
- [ ] Ujian Tahunan + dua penguji + sertifikat.

## Siswa
- [ ] Dashboard tanggal jadwal berikutnya benar.
- [ ] Angka kehadiran bulan berjalan masuk akal.
- [ ] Tugas detail + Kumpulkan Tugas.
- [ ] Materi Latihan detail.
- [ ] Evaluasi Audio/Video filter.
- [ ] Progress / Laporan / Sertifikat.
- [ ] Jadwal Pengganti / Pengumuman.
- [ ] Profil → ubah password.

## UI / Device
- [ ] Light mode desktop.
- [ ] Dark mode desktop.
- [ ] Auto mode mengikuti OS.
- [ ] iPhone Safari/PWA 375–430 px.
- [ ] Android Chrome/PWA bila digunakan.
- [ ] Modal tidak terpotong dan tombol footer dapat disentuh.
