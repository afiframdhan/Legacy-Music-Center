import { readFile } from 'node:fs/promises';

const html = await readFile('public/index.html', 'utf8');
const js = await readFile('public/js/app.bundle.js', 'utf8');
const css = await readFile('public/css/app.bundle.css', 'utf8');
const required = [
  'initApp','handleLogin','logout','fetchDashboardData','switchTab',
  'handleAddSiswaCombined','handleUpdateSiswa','deleteSiswa',
  'handleAddGuru','openEditGuru','deleteGuruRecord',
  'handleUpdateJadwal','deleteJadwal','addAbsensiCombined',
  'handleCreateTugas','handleSubmitJawabanTugas','handleDeleteTugas',
  'handleSaveLearningProgress','handleAddPengumuman','handleSaveSelfProfile'
];
let failed = false;
for (const fn of required) {
  if (!new RegExp(`\\bfunction\\s+${fn}\\b`).test(js)) {
    console.error(`Missing required function: ${fn}`); failed = true;
  }
}
if (!html.includes('/js/app.bundle.js')) { console.error('index.html does not load app.bundle.js'); failed = true; }
if (!html.includes('/css/app.bundle.css')) { console.error('index.html does not load app.bundle.css'); failed = true; }
if (!css.includes('.task-card') || !css.includes('.lp-widget') || !css.includes('.sidebar')) {
  console.error('CSS bundle is missing key selectors'); failed = true;
}
if (failed) process.exit(1);
console.log('Static parity checks passed.');
