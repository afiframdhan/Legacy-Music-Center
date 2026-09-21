import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const jsSources = [
  'src/js/services/api.js',
  'src/js/state.js',
  'src/js/core/vendor-loader.js',
  'src/js/core/theme-session.js',
  'src/js/core/app-shell.js',
  'src/js/auth.js',
  'src/js/router.js',
  'src/js/pages/dashboard-data.js',
  'src/js/pages/progress.js',
  'src/js/pages/academy.js',
  'src/js/pages/dashboard.js',
  'src/js/pages/jadwal-absensi.js',
  'src/js/pages/tugas.js',
  'src/js/pages/siswa-profile.js',
  'src/js/pages/admin.js'
];

const cssSources = [
  'src/css/base-layout.css',
  'src/css/components.css',
  'src/css/pages/tugas.css',
  'src/css/pages/progress-and-pages.css',
  'src/css/responsive-theme-admin.css'
];

async function concat(files) {
  const parts = [];
  for (const file of files) parts.push(await readFile(file, 'utf8'));
  return parts.join('\n');
}

await mkdir('public/js', { recursive: true });
await mkdir('public/css', { recursive: true });
const js = await concat(jsSources);
const css = await concat(cssSources);
await writeFile('public/js/app.bundle.js', js);
await writeFile('public/css/app.bundle.css', css);

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
console.log(`Built public/js/app.bundle.js  ${(Buffer.byteLength(js)/1024).toFixed(1)} KiB  sha256:${hash(js)}`);
console.log(`Built public/css/app.bundle.css ${(Buffer.byteLength(css)/1024).toFixed(1)} KiB  sha256:${hash(css)}`);
console.log('V3 vendor policy: FullCalendar and CropperJS are lazy-loaded on demand.');
