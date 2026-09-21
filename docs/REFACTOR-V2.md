# Refactor V2 — zero-feature-change strategy

Tujuan refactor ini adalah memisahkan source untuk maintenance tanpa mengubah kontrak HTML, nama fungsi global, payload API, endpoint Worker, atau backend Apps Script.

## Source of truth

Edit file di `src/`, bukan `public/js/app.bundle.js` atau `public/css/app.bundle.css`.

JavaScript dipisah menjadi state, core, auth/router, dan domain page modules. Build script menggabungkannya kembali dalam urutan asli sehingga inline handler HTML seperti `onclick="..."` dan `onsubmit="..."` tetap menemukan fungsi global yang sama.

CSS juga dipisah berdasarkan area dan digabung kembali menjadi satu bundle agar urutan cascade tetap sama.

## Build

`npm run build`

Wrangler juga menjalankan build otomatis sebelum `wrangler dev`/`deploy` melalui konfigurasi `build.command`.

## Deploy

TEST: `npm run deploy:test`

PRODUCTION: `npm run deploy:production`

Secrets tetap disimpan di Cloudflare per environment. `.dev.vars` hanya untuk lokal dan tetap di-ignore Git.

## Yang tidak diubah

- `worker/index.js`
- `backend/Code.gs`
- nama fungsi frontend yang dipanggil dari HTML
- method RPC Apps Script
- struktur data Spreadsheet
- alur login/session
- fitur tugas, YouTube, upload, jadwal, absensi, progress, pengumuman, statistik, profile, admin/guru/siswa
