const COOKIE_NAME = 'legacy_api_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

const COMMON = new Set([
  'getDashboardData', 'getGuruList', 'updateUserPhoto', 'updateSelfProfile'
]);
const STUDENT = new Set([
  ...COMMON,
  'submitTugasJawaban'
]);
const TEACHER = new Set([
  ...COMMON,
  'saveLearningProgress', 'deleteLearningProgress', 'getLearningProgressPrintLogo',
  'addTugasCombined', 'deleteTugas', 'recordAbsensi', 'updateAbsensi', 'deleteAbsensi',
  'updateSiswa', 'updateJadwal', 'deleteJadwal',
  'addSiswaCombined', 'deleteSiswa'
]);
const ADMIN = new Set([
  ...TEACHER,
  'addJadwalPengganti', 'deleteJadwalPengganti',
  'addPengumuman', 'deletePengumuman',
  'addGuru', 'updateGuru', 'deleteGuru',
  'recordTeacherAttendance', 'deleteTeacherAttendance',
  'deleteExitedStudentRecord', 'addSiswaCombined', 'deleteSiswa'
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'legacy-music-center-api' });
    }
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, {
        'set-cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`
      });
    }
    if (url.pathname === '/api/rpc' && request.method === 'POST') {
      return handleRpc(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

async function handleRpc(request, env) {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_TOKEN || !env.SESSION_SECRET) {
    return json({ ok:false, error:'Konfigurasi server belum lengkap.' }, 500);
  }

  let body;
  try { body = await request.json(); }
  catch (_) { return json({ ok:false, error:'Body JSON tidak valid.' }, 400); }

  const method = String(body.method || '').trim();
  const args = Array.isArray(body.args) ? body.args : [];
  if (!method || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(method)) {
    return json({ ok:false, error:'Method API tidak valid.' }, 400);
  }

  if (method === 'verifyLogin') {
    const result = await gasRpc(env, method, args);
    if (!result || result.success !== true) return json({ ok:true, data:result });
    const session = {
      userType: String(result.userType || ''),
      userID: String(result.userID || ''),
      userName: String(result.userName || ''),
      exp: Math.floor(Date.now()/1000) + SESSION_MAX_AGE
    };
    const token = await signSession(session, env.SESSION_SECRET);
    return json({ ok:true, data:result }, 200, {
      'set-cookie': `${COOKIE_NAME}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Strict`
    });
  }

  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return json({ ok:false, error:'Sesi login tidak valid atau sudah berakhir.' }, 401);
  if (!isAllowed(session.userType, method)) return json({ ok:false, error:'Akses fungsi ditolak.' }, 403);

  const safeArgs = bindIdentity(method, args, session);
  const result = await gasRpc(env, method, safeArgs);
  return json({ ok:true, data:result });
}

function isAllowed(role, method) {
  if (role === 'admin') return ADMIN.has(method);
  if (role === 'guru') return TEACHER.has(method);
  if (role === 'siswa') return STUDENT.has(method);
  return false;
}

function bindIdentity(method, originalArgs, s) {
  const args = structuredClone(originalArgs);
  if (method === 'getDashboardData') return [s.userID, s.userType];
  if (method === 'updateUserPhoto') return [s.userID, s.userType, args[2], args[3]];
  if (method === 'updateSelfProfile' && args[0] && typeof args[0] === 'object') {
    args[0].userID = s.userID; args[0].userType = s.userType;
  }
  if (method === 'saveLearningProgress') { args[1] = s.userName; args[2] = s.userType; }
  if (method === 'deleteLearningProgress') { args[1] = s.userName; args[2] = s.userType; }
  if (method === 'addJadwalPengganti' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;
  if (method === 'addPengumuman' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;
  if (method === 'updateSiswa' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;
  if (method === 'addSiswaCombined' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;
  const roleLast = new Set(['deleteJadwalPengganti','deletePengumuman','deleteGuru','recordTeacherAttendance','deleteTeacherAttendance','deleteExitedStudentRecord','addGuru','updateGuru']);
  if (roleLast.has(method)) {
    const roleIndex = method === 'recordTeacherAttendance' ? 1 : (['addGuru','updateGuru'].includes(method) ? 1 : 1);
    args[roleIndex] = s.userType;
  }
  return args;
}

async function gasRpc(env, method, args) {
  const response = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify({ apiToken: env.APPS_SCRIPT_TOKEN, method, args })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}: ${text.slice(0,240)}`);
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error('Apps Script mengembalikan respons non-JSON. Pastikan deployment Web App sudah versi terbaru.'); }
  if (!parsed.ok) throw new Error(parsed.error || 'Apps Script RPC gagal.');
  return parsed.data;
}

function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  const out = {};
  for (const pair of raw.split(';')) {
    const i = pair.indexOf('='); if (i < 0) continue;
    out[pair.slice(0,i).trim()] = pair.slice(i+1).trim();
  }
  return out;
}

async function readSession(request, secret) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return null;
  const [payloadPart, sigPart] = token.split('.');
  if (!payloadPart || !sigPart) return null;
  const expected = await hmac(payloadPart, secret);
  if (!timingSafeEqual(expected, sigPart)) return null;
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadPart))); }
  catch (_) { return null; }
  if (!payload.exp || payload.exp < Math.floor(Date.now()/1000)) return null;
  return payload;
}

async function signSession(payload, secret) {
  const part = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${part}.${await hmac(part, secret)}`;
}
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64urlEncode(new Uint8Array(sig));
}
function timingSafeEqual(a,b) {
  if (a.length !== b.length) return false;
  let x=0; for(let i=0;i<a.length;i++) x |= a.charCodeAt(i)^b.charCodeAt(i); return x===0;
}
function base64urlEncode(bytes) {
  let s=''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function base64urlDecode(s) {
  s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  const raw=atob(s), arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i); return arr;
}
function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), { status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers} });
}
