# Supabase Backup / Restore — Legacy Music Center

Repository historis ini tidak berisi migration 1–18, jadi schema live harus diperlakukan sebagai baseline sampai snapshot schema resmi disimpan.

## Sebelum production
1. Supabase Dashboard → Database → Backups: pastikan backup tersedia sesuai plan.
2. Export manual data penting dari menu **Admin → Export & Backup**.
3. Simpan migration 19–32 di repository.
4. Untuk baseline schema penuh, gunakan Supabase CLI/Postgres `pg_dump --schema-only` dari database production dan simpan hasilnya sebagai artefak internal (jangan commit secret/connection string).

Contoh CLI bila tersedia:
```bash
supabase db dump --linked --schema public -f supabase/schema-baseline.sql
```

## Restore test
- Buat project Supabase test kosong.
- Restore `schema-baseline.sql`.
- Jalankan migration setelah baseline secara berurutan.
- Import backup data test.
- Deploy Worker test dan jalankan `docs/RELEASE-CHECKLIST.md`.

Jangan melakukan restore pertama kali langsung di production.
