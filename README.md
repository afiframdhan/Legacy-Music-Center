# Legacy Music Center — GitHub + Cloudflare migration

Repositori ini adalah tahap migrasi aman dari Google Apps Script HtmlService ke **Cloudflare Workers + Static Assets**, dengan backend Spreadsheet/Drive/Docs lama tetap dipertahankan agar fungsi tidak hilang.

## Arsitektur

Browser → Cloudflare static assets → `/api/rpc` Cloudflare Worker → Apps Script `doPost()` → Google Spreadsheet / Drive / Docs.

Frontend lama tetap menggunakan antarmuka `google.script.run`, tetapi `public/js/services/api.js` menyediakan compatibility shim sehingga pemanggilan tersebut dikirim ke Worker API. Ini membuat migrasi UI berisiko rendah dan memungkinkan refactor per modul setelah produksi stabil.

## Langkah setup

1. Upload isi folder ini ke repository GitHub baru.
2. Ganti `Code.gs` Apps Script dengan `backend/Code.gs`, lalu **Deploy > Manage deployments > Edit > New version** sebagai Web App.
3. Buat token acak >= 32 karakter. Dari editor Apps Script, jalankan `configureLegacyApiToken('TOKEN_ANDA')` satu kali.
4. Install dependency: `npm install`.
5. Simpan secret Cloudflare:
   - `npx wrangler secret put APPS_SCRIPT_URL` → URL Web App Apps Script `/exec`
   - `npx wrangler secret put APPS_SCRIPT_TOKEN` → token yang sama dengan langkah 3
   - `npx wrangler secret put SESSION_SECRET` → random secret lain >= 32 karakter
6. Test lokal dengan `.dev.vars` (copy dari `.dev.vars.example`) lalu `npm run dev`.
7. Deploy: `npm run deploy`. Setelah stabil, hubungkan repo GitHub ke Cloudflare Builds bila ingin auto-deploy setiap push.

## Login setelah migrasi

Login pertama setelah pindah domain perlu dilakukan ulang satu kali agar Cloudflare membuat cookie session HttpOnly. Setelah itu session API bertahan hingga 1 tahun, sementara mekanisme localStorage UI lama juga tetap dipertahankan.

## Kenapa `legacy-app.js` dan `app.css` masih besar?

Ini disengaja untuk tahap pertama. Memecah 5.000+ baris sekaligus sambil memindahkan platform berisiko menimbulkan regression. Struktur folder modular sudah disiapkan; ekstraksi ke `pages/`, `components/`, dan service files sebaiknya dilakukan setelah deployment kompatibilitas ini lolos regression test.

## Regression test wajib

Uji tiga role (Siswa, Guru, Admin): login/logout, reload/close browser, dashboard, jadwal, tambah/edit/hapus siswa, guru, tugas + YouTube + lampiran, jawaban tugas, absensi + tanda tangan, progress belajar + cetak, jadwal pengganti, pengumuman, foto profil, laporan/statistik, dan konflik ruangan.

## V3 performance pass
See `docs/REFACTOR-V3.md`. V3 lazy-loads FullCalendar/CropperJS and deduplicates simultaneous identical read RPCs while leaving legacy global handlers untouched. Backend and Spreadsheet contracts are unchanged.
