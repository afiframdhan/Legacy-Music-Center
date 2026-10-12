# Legacy Music Center — Architecture

## Production data flow

```text
Browser / PWA
   ↓
Cloudflare Static Assets
   ↓
Cloudflare Worker `/api/*`
   ↓
Supabase (database/auth metadata)
   ├─ students / teachers / classes / schedules
   ├─ attendance / assignments / progress
   ├─ repertoire / exams / reports / audit
   └─ live sync / push metadata

File upload only when required
   ↓
Drive Service / Apps Script
   ↓
Google Drive
```

## Source of truth

Supabase adalah source of truth untuk metadata aplikasi. Spreadsheet/Apps Script tidak boleh digunakan sebagai fallback diam-diam untuk data utama.

Apps Script tersisa untuk:
- upload/file Google Drive;
- compatibility shadow legacy yang tidak boleh memblokir operasi Supabase-first bila secret Apps Script belum tersedia.

## Session

Cloudflare Worker membuat cookie session `HttpOnly`, `Secure`, `SameSite=Strict`.
- Admin/Guru: 30 hari.
- Siswa: 90 hari.

Frontend menyimpan identity ringan hanya untuk fast boot; API tetap memvalidasi cookie server.

## Login security

Migration 32 menambahkan:
- rate-limit login;
- `must_change_password`;
- RPC ubah password;
- password awal siswa acak.

## Release rule

Semua perubahan diuji di environment `test` sebelum production. Lihat `docs/RELEASE-CHECKLIST.md`.
