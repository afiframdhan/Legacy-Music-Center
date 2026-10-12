import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

function fail(msg){ console.error('RELEASE CHECK FAIL:', msg); process.exitCode=1; }
function ok(msg){ console.log('PASS:', msg); }

try { execFileSync(process.execPath, ['--check','worker/index.js'], {stdio:'inherit'}); ok('worker syntax'); }
catch { fail('worker syntax'); }

const html = await readFile('public/index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
if(dup.length) fail('duplicate HTML ids: '+[...new Set(dup)].join(', ')); else ok('HTML ids unique');

const criticalIds=['loginView','appView','modalForcePassword','modalPracticeResource','modalMediaEvaluation','modalKerjakanTugas'];
for(const id of criticalIds){ if(!ids.includes(id)) fail('critical element missing: '+id); }
if(!process.exitCode) ok('critical release elements present');

const worker=await readFile('worker/index.js','utf8');
for(const token of ['legacy_login_guard_status','legacy_record_login_attempt','changeOwnPassword','calculateMonthlyExpectedClasses','generateInitialPassword']){
  if(!worker.includes(token)) fail('release hardening missing: '+token);
}
if(!worker.includes("sessionMaxAgeForRole")) fail('role-based session duration missing');
if(!process.exitCode) ok('security hardening hooks present');

const migration=await readFile('supabase/migrations/32_release_security_and_auth.sql','utf8').catch(()=>null);
if(!migration) fail('migration 32 missing'); else ok('migration 32 present');

const css=await readFile('public/css/app.bundle.css','utf8');
if(!css.includes('RELEASE CANDIDATE — final theme safety net')) fail('final theme pass missing'); else ok('final theme pass present');

if(process.exitCode) process.exit(process.exitCode);
console.log('Release static gate PASSED. Live role regression test is still required on branch test.');
