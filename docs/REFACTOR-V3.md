# Legacy Music Center — Refactor V3

V3 is a performance pass on top of the production-tested V2 architecture. It intentionally leaves Apps Script, Spreadsheet schemas, RPC method names, user roles, and existing application behavior intact.

## Changes

1. **Lazy third-party vendors** — FullCalendar is downloaded only when the Jadwal page is opened. CropperJS and its stylesheet are downloaded only when a profile image is selected.
2. **Smaller initial network load** — the initial HTML no longer downloads FullCalendar/CropperJS before the user needs them. Cloudflare can still compress the app bundle in transit without altering legacy global function names.
3. **In-flight RPC deduplication** — simultaneous identical read requests for dashboard/guru/logo data reuse one Promise. Results are not cached after completion, so fresh data is still requested normally.
4. **No backend migration** — `worker/index.js`, `backend/Code.gs`, Spreadsheet schema, auth/session contract, and RPC allowlists remain unchanged from V2.

## Test order

Run on the `test` branch first:

```bash
npm install
npm run build
npx wrangler dev --env test
```

Test login for Admin/Guru/Siswa, dashboard, Jadwal calendar/table, profile photo crop/upload, tasks/YouTube, progress, attendance, announcements, reports, CRUD, refresh/session restore, then push to `test` and validate Cloudflare TEST before merging to `main`.
