# Legacy Music Center — Release Candidate

Aplikasi Legacy Music Center adalah PWA sekolah musik untuk Admin, Guru, dan Siswa.

## Arsitektur produksi

Browser/PWA → Cloudflare Worker + Static Assets → Supabase.

Google Apps Script **bukan database utama**. Apps Script/Drive Service hanya dipakai untuk kebutuhan Google Drive/file tertentu dan shadow compatibility legacy yang berjalan di background.

Komponen utama:
- `public/` — static frontend/PWA.
- `src/` — source JS/CSS yang dibundle oleh `npm run build`.
- `worker/index.js` — same-origin API, signed session, role allowlist, Supabase access, push notification, Drive bridge.
- `supabase/migrations/` — migration tambahan fitur produksi.
- `backend/Code.gs` — legacy/Drive bridge jika masih dipakai.

## Secret Cloudflare wajib

- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Untuk upload Google Drive:
- `DRIVE_SCRIPT_URL`
- `DRIVE_SCRIPT_TOKEN`

Legacy Apps Script shadow bersifat opsional untuk mayoritas fitur Supabase-first:
- `APPS_SCRIPT_URL`
- `APPS_SCRIPT_TOKEN`

## Setup release

1. Jalankan migration Supabase yang belum terpasang, termasuk `32_release_security_and_auth.sql`.
2. `npm install`
3. `npm run build`
4. `node --check worker/index.js`
5. Deploy ke branch/environment `test` terlebih dahulu.
6. Jalankan checklist `docs/RELEASE-CHECKLIST.md` untuk tiga role.
7. Setelah lolos, merge/deploy ke production.

## Login & keamanan

- Admin/Guru: session server maksimal 30 hari.
- Siswa: session server maksimal 90 hari.
- Login memiliki rate-limit bertingkat setelah beberapa percobaan gagal.
- Siswa baru menerima password awal acak dan wajib membuat password baru pada login pertama.
- Semua role dapat mengubah password dari halaman Profil Saya.

## Database & file

Metadata utama berada di Supabase. File/PDF/foto yang memang perlu Drive tetap diunggah melalui Drive Service. Video latihan/tutorial disarankan memakai YouTube Unlisted agar Drive tidak cepat penuh.

## Build

```bash
npm run build
```

Build melakukan bundling source, syntax check bundle, dan static parity check.
