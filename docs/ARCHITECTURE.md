# Architecture

## Current safe-migration target

- `public/`: UI delivered from Cloudflare edge.
- `worker/index.js`: same-origin API gateway, persistent signed session, role method allowlist, Apps Script proxy.
- `backend/Code.gs`: existing business logic + Spreadsheet/Drive/Docs integration + JSON RPC endpoint.
- Google Spreadsheet remains the database in this phase.

## Recommended next phase

After production parity is proven, extract UI code gradually from `legacy-app.js` into services/components/pages. Only after that consider replacing Apps Script with Google Sheets API / a real database. Replacing Apps Script and refactoring the UI simultaneously is intentionally avoided.
