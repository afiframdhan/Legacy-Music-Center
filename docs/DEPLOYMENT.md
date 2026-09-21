# Deployment checklist

- [ ] `backend/Code.gs` deployed as a new Apps Script Web App version
- [ ] `LEGACY_API_TOKEN` configured in Script Properties via `configureLegacyApiToken()`
- [ ] Cloudflare `APPS_SCRIPT_URL` secret configured
- [ ] Cloudflare `APPS_SCRIPT_TOKEN` secret configured
- [ ] Cloudflare `SESSION_SECRET` secret configured
- [ ] `/api/health` returns JSON ok
- [ ] Siswa login tested
- [ ] Guru login tested
- [ ] Admin login tested
- [ ] Uploads tested
- [ ] Print/report flows tested
- [ ] CRUD flows tested
- [ ] Mobile Add to Home Screen tested
