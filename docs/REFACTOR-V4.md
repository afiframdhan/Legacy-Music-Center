# Refactor V4 — Backend Performance Optimization

V4 mempertahankan kontrak API, struktur Spreadsheet, role, nama RPC, dan perilaku UI dari V3. Fokusnya mengurangi panggilan Spreadsheet/Drive berulang tanpa cache data pengguna lintas request.

## Perubahan

1. **Request-local dashboard snapshot**
   - Saat `getDashboardData()` berjalan, hasil `getDataRange().getValues()` dari sheet yang sama dipakai ulang oleh helper bertingkat dalam request yang sama.
   - Snapshot langsung dibuang pada `finally`, jadi tidak ada data dashboard pengguna yang disimpan lintas request.
   - Di luar dashboard, `readSheetValues_()` jatuh kembali ke perilaku lama dan membaca sheet langsung.

2. **Header map snapshot**
   - Header sheet yang berulang kali dibutuhkan saat satu dashboard disusun hanya dibaca sekali per bentuk sheet.

3. **Logo laporan di ScriptCache**
   - Logo cetak Progress Belajar yang statis dicache sampai 6 jam sehingga Drive tidak dibaca berulang kali.
   - Jika cache gagal/terlalu besar, fungsi otomatis tetap mengambil logo dari Drive seperti sebelumnya.

4. **Performance logging**
   - `getDashboardData()` menulis durasi ke Apps Script execution log dengan prefix `V4 getDashboardData`.
   - Tidak mengubah response ke frontend.

## Yang sengaja tidak dilakukan

- Tidak ada cache dashboard lintas pengguna/request.
- Tidak ada perubahan struktur Spreadsheet.
- Tidak ada perubahan endpoint Worker.
- Tidak ada perubahan autentikasi/session.
- Tidak ada batching write yang dapat mengubah urutan operasi bisnis.

Ini sengaja konservatif untuk menjaga feature parity.
