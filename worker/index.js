const COOKIE_NAME = 'legacy_api_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 90;
const STAFF_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const STUDENT_SESSION_MAX_AGE = 60 * 60 * 24 * 90;
function sessionMaxAgeForRole(role){ return String(role||'').toLowerCase()==='siswa' ? STUDENT_SESSION_MAX_AGE : STAFF_SESSION_MAX_AGE; }

const COMMON = new Set([
  'getDashboardData', 'getGuruList', 'getLiveAnnouncements', 'getLiveSyncState', 'getLiveModuleData', 'updateUserPhoto', 'updateSelfProfile', 'getStudent360Report',
  'getPushConfig', 'getPushStatus', 'savePushSubscription', 'removePushSubscription', 'sendPushTest',
  'getRepertoireData', 'getPracticeHubData', 'changeOwnPassword'
]);
const STUDENT = new Set([...COMMON, 'submitTugasJawaban', 'listAnnualExams', 'getAnnualExam']);
const TEACHER = new Set([
  ...COMMON,
  'saveLearningProgress', 'deleteLearningProgress', 'getLearningProgressPrintLogo',
  'addTugasCombined', 'deleteTugas', 'recordAbsensi', 'updateAbsensi', 'deleteAbsensi',
  'updateSiswa', 'updateJadwal', 'deleteJadwal',
  'addSiswaCombined', 'deleteSiswa', 'publishStudent360Report', 'deleteStudent360Report',
  'listAnnualExams', 'getAnnualExam', 'saveAnnualExam', 'publishAnnualExam', 'deleteAnnualExam',
  'saveStudentRepertoire', 'deleteStudentRepertoire',
  'savePracticeResource', 'deletePracticeResource', 'saveMediaEvaluation', 'deleteMediaEvaluation'
]);
const ADMIN = new Set([
  ...TEACHER,
  'saveScheduleOverride', 'deleteScheduleOverride', 'getRecentAttendance',
  'addJadwalPengganti', 'deleteJadwalPengganti',
  'addPengumuman', 'deletePengumuman',
  'addGuru', 'updateGuru', 'deleteGuru',
  'recordTeacherAttendance', 'deleteTeacherAttendance',
  'deleteExitedStudentRecord', 'getExitedStudentArchive',
  'getAdminControlCenter', 'getAdminAuditLogs', 'deleteAdminAuditLog', 'clearAdminAuditLogs', 'getAdminDataQuality', 'getAdminExportBackup'
]);

const AUDIT_METHODS = new Set([
  'addGuru','updateGuru','deleteGuru','addSiswaCombined','updateSiswa','deleteSiswa','deleteExitedStudentRecord',
  'updateJadwal','deleteJadwal','recordAbsensi','updateAbsensi','deleteAbsensi','addTugasCombined','submitTugasJawaban','deleteTugas',
  'saveLearningProgress','deleteLearningProgress','saveScheduleOverride','deleteScheduleOverride','addPengumuman','deletePengumuman',
  'recordTeacherAttendance','deleteTeacherAttendance','saveStudentRepertoire','deleteStudentRepertoire','savePracticeResource','deletePracticeResource','saveMediaEvaluation','deleteMediaEvaluation','saveAnnualExam','publishAnnualExam','deleteAnnualExam',
  'publishStudent360Report','deleteStudent360Report','updateUserPhoto','updateSelfProfile'
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'legacy-music-center-api',
        loginBackend: hasSupabaseConfig(env) ? 'supabase-bcrypt-optimized' : 'unconfigured',
        guruBackend: hasSupabaseConfig(env) ? 'supabase-direct-write-apps-script-shadow' : 'unconfigured',
        siswaBackend: hasSupabaseConfig(env) ? 'supabase-direct-write-apps-script-shadow' : 'unconfigured',
        jadwalBackend: hasSupabaseConfig(env) ? 'supabase-direct-write-apps-script-shadow' : 'unconfigured',
        absensiBackend: hasSupabaseConfig(env) ? 'supabase-direct-write-apps-script-shadow' : 'unconfigured',
        tugasBackend: hasSupabaseConfig(env) ? 'supabase-direct-metadata-drive-bridge' : 'unconfigured',
        progressBackend: hasSupabaseConfig(env) ? 'supabase-direct-metadata-drive-bridge' : 'unconfigured',
        jadwalPenggantiBackend: hasSupabaseConfig(env) ? 'supabase-direct-write-apps-script-shadow' : 'unconfigured',
        pengumumanBackend: hasSupabaseConfig(env) ? 'supabase-direct-write-apps-script-shadow' : 'unconfigured',
        absensiGuruBackend: hasSupabaseConfig(env) ? 'supabase-direct-write-apps-script-shadow' : 'unconfigured',
        dashboardBackend: hasSupabaseConfig(env) ? 'supabase-with-apps-script-fallback' : 'unconfigured',
        phase10WriteMode: hasSupabaseConfig(env) ? 'all-metadata-supabase-first-drive-microservice' : 'unconfigured',
        driveBackend: hasDriveServiceConfig(env) ? 'apps-script-drive-microservice' : 'legacy-apps-script-drive-fallback',
        driveServiceConfigured: hasDriveServiceConfig(env)
      });
    }

    if (url.pathname === '/api/drive-service-health' && request.method === 'GET') {
      if (!hasDriveServiceConfig(env)) {
        return json({
          ok:false,
          configured:false,
          backend:'legacy-apps-script-drive-fallback',
          error:'DRIVE_SCRIPT_URL / DRIVE_SCRIPT_TOKEN belum dikonfigurasi.'
        }, 503);
      }

      try {
        const result = await driveRpc(env, 'health', []);
        return json({
          ok:Boolean(result && result.success),
          configured:true,
          backend:'apps-script-drive-microservice',
          data:result || null
        }, result && result.success ? 200 : 502);
      } catch (error) {
        return json({
          ok:false,
          configured:true,
          backend:'apps-script-drive-microservice',
          error:String(error && error.message ? error.message : error)
        }, 502);
      }
    }

    if (url.pathname === '/api/session' && request.method === 'GET') {
      if (!env.SESSION_SECRET) return json({ ok:false, error:'SESSION_SECRET belum dikonfigurasi.' }, 500);
      const session = await readSession(request, env.SESSION_SECRET);
      if (!session) return json({ ok:false, error:'Sesi login tidak valid atau sudah berakhir.' }, 401);
      return json({ ok:true, data:{ userType:session.userType, userID:session.userID, userName:session.userName, mustChangePassword:Boolean(session.mustChangePassword) } });
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, {
        'set-cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`
      });
    }

    if (url.pathname === '/api/rpc' && request.method === 'POST') {
      return handleRpc(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runClassReminderPush(env).catch(error => {
      console.error('Scheduled class reminder push failed:', error);
    }));
  }
};

async function handleRpc(request, env, ctx) {
  if (!env.SESSION_SECRET) {
    return json({ ok:false, error:'SESSION_SECRET belum dikonfigurasi.' }, 500);
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
    if (!hasSupabaseConfig(env)) {
      return json({ ok:false, error:'Konfigurasi Supabase TEST belum lengkap.' }, 500);
    }

    const role = String(args[0] || '').trim().toLowerCase();
    const username = String(args[1] || '').trim().toLowerCase();
    const clientIp = String(request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown').split(',')[0].trim();
    const loginGuardKey = await sha256Hex(`${role}|${username}|${clientIp}`);
    try {
      const guard = await supabaseRpc(env, 'legacy_login_guard_status', { p_key:loginGuardKey });
      const status = Array.isArray(guard) ? guard[0] : guard;
      if (status && status.allowed === false) {
        const wait = Math.max(1, Number(status.retry_after_seconds || 60));
        return json({ ok:true, data:{ success:false, message:`Terlalu banyak percobaan login. Coba lagi dalam ${wait} detik.` } });
      }
    } catch (error) {
      console.error('Login guard status failed (continuing safely):', error);
    }

    let result;
    try {
      result = await verifyLoginSupabaseRpc(env, args);
    } catch (error) {
      console.error('Supabase login RPC error:', error);
      return json({ ok:true, data:{ success:false, message:'Login gagal diproses. Silakan coba lagi.' } });
    }

    try { await supabaseRpc(env, 'legacy_record_login_attempt', { p_key:loginGuardKey, p_success:Boolean(result.success) }); }
    catch (error) { console.error('Login guard record failed:', error); }

    if (!result.success) return json({ ok:true, data:result });

    const maxAge = sessionMaxAgeForRole(result.userType);
    const session = {
      userType: result.userType,
      userID: result.userID,
      userName: result.userName,
      mustChangePassword:Boolean(result.mustChangePassword),
      exp: Math.floor(Date.now()/1000) + maxAge
    };

    const token = await signSession(session, env.SESSION_SECRET);

    return json({ ok:true, data:result }, 200, {
      'set-cookie': `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`
    });
  }

  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return json({ ok:false, error:'Sesi login tidak valid atau sudah berakhir.' }, 401);
  if (!isAllowed(session.userType, method)) return json({ ok:false, error:'Akses fungsi ditolak.' }, 403);

  if (method === 'changeOwnPassword') {
    const payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
    const nextPassword = String(payload.password || '').trim();
    const confirmPassword = String(payload.confirmPassword || '').trim();
    if (nextPassword.length < 8 || !/[A-Za-z]/.test(nextPassword) || !/[0-9]/.test(nextPassword)) {
      return json({ ok:true, data:{ success:false, message:'Password minimal 8 karakter dan harus mengandung huruf serta angka.' } });
    }
    if (nextPassword !== confirmPassword) return json({ ok:true, data:{ success:false, message:'Konfirmasi password tidak sama.' } });
    try {
      const result = await supabaseRpc(env, 'legacy_change_own_password', { p_user_id:session.userID, p_role:session.userType, p_new_password:nextPassword });
      const maxAge = sessionMaxAgeForRole(session.userType);
      const refreshed = { ...session, mustChangePassword:false, exp:Math.floor(Date.now()/1000)+maxAge };
      const token = await signSession(refreshed, env.SESSION_SECRET);
      return json({ ok:true, data:{ success:true, message:'Password berhasil diperbarui.' } }, 200, {
        'set-cookie': `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`
      });
    } catch (error) {
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'getPushConfig') {
    const publicKey = String(env.VAPID_PUBLIC_KEY || '').trim();
    return json({ ok:true, data:{
      success:Boolean(publicKey),
      publicKey,
      configured:Boolean(publicKey && String(env.VAPID_PRIVATE_KEY || '').trim()),
      message:publicKey ? 'Push notification siap digunakan.' : 'VAPID key belum dikonfigurasi.'
    } });
  }

  if (method === 'getPushStatus') {
    try {
      const rows = await listPushSubscriptions(env, session.userType, session.userID);
      return json({ ok:true, data:{ success:true, activeCount:rows.length } });
    } catch (error) {
      console.error('Push status error:', error);
      return json({ ok:true, data:{ success:false, activeCount:0, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'savePushSubscription') {
    try {
      const result = await savePushSubscriptionSupabase(env, session, args[0] || {});
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Save push subscription error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'removePushSubscription') {
    try {
      const result = await removePushSubscriptionSupabase(env, session, String(args[0] || '').trim());
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Remove push subscription error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'sendPushTest') {
    try {
      const role = session.userType;
      const userId = session.userID;
      const userName = session.userName;
      const job = (async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const result = await sendPushToUser(env, role, userId, {
          title:'Legacy Music Center',
          body:`Halo ${userName || 'User'}, push notification tetap aktif walaupun PWA ditutup.`,
          url:'/',
          tag:'legacy-push-test'
        });
        console.log('Push test result:', result);
      })();
      if (ctx) ctx.waitUntil(job); else await job;
      return json({ ok:true, data:{
        success:true,
        message:'Notifikasi tes akan dikirim sekitar 5 detik lagi. Tutup PWA sekarang untuk menguji notifikasi background.'
      } });
    } catch (error) {
      console.error('Push test error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  // Core identity/dashboard reads are SUPABASE-ONLY.
  // Never silently fall back to the legacy Spreadsheet here: a single optional-table
  // error used to make the UI show stale Apps Script data without telling the user.
  if (method === 'getGuruList') {
    try {
      const result = await getGuruListSupabase(env);
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Supabase getGuruList error:', error);
      return json({ ok:true, data:{ success:false, message:'Data guru Supabase gagal dimuat: ' + String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'getDashboardData') {
    try {
      const result = await getDashboardDataSupabase(env, session);
      result.dataSource = 'supabase';
      result.loadedAt = new Date().toISOString();
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Supabase dashboard error:', error);
      return json({ ok:true, data:JSON.stringify({
        success:false,
        dataSource:'supabase',
        message:'Dashboard Supabase gagal dimuat: ' + String(error && error.message ? error.message : error)
      }) });
    }
  }

  if (method === 'getLiveSyncState') {
    try {
      const rows = await sbRows(env, 'app_sync_versions', { select:'module_key,version,updated_at', order:'module_key.asc' });
      const versions = {};
      for (const row of rows) versions[String(row.module_key || '')] = Number(row.version || 0);
      return json({ ok:true, data:{ success:true, versions, serverTime:new Date().toISOString() } });
    } catch (error) {
      console.error('Live sync state error:', error);
      return json({ ok:true, data:{ success:false, versions:{}, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'getLiveAnnouncements') {
    try {
      const result = await getLiveAnnouncementsSupabase(env, session);
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Live announcements sync error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error), items:[] } });
    }
  }


  if (method === 'getLiveModuleData') {
    try {
      const request = args[0] && typeof args[0] === 'object' ? args[0] : {};
      return json({ ok:true, data:await getLiveModuleDataSupabase(env, session, request.modules) });
    } catch (error) {
      console.error('Live module data error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'getAdminControlCenter') {
    try {
      return json({ ok:true, data:await getAdminControlCenterSupabase(env, session) });
    } catch (error) {
      console.error('Admin control center error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'getAdminAuditLogs') {
    try {
      return json({ ok:true, data:await getAdminAuditLogsSupabase(env, session) });
    } catch (error) {
      console.error('Admin audit log error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error), items:[] } });
    }
  }

  if (method === 'deleteAdminAuditLog') {
    try {
      if (session.userType !== 'admin') throw new Error('Akses hanya untuk admin.');
      const auditId = String(args[0] || '').trim();
      if (!auditId) throw new Error('ID audit tidak ditemukan.');
      await supabaseRest(env, `/rest/v1/audit_logs?audit_id=eq.${encodeURIComponent(auditId)}`, { method:'DELETE', headers:{Prefer:'return=minimal'} });
      return json({ ok:true, data:{ success:true, message:'Audit log berhasil dihapus.' } });
    } catch (error) {
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'clearAdminAuditLogs') {
    try {
      if (session.userType !== 'admin') throw new Error('Akses hanya untuk admin.');
      await supabaseRest(env, '/rest/v1/audit_logs?audit_id=not.is.null', { method:'DELETE', headers:{Prefer:'return=minimal'} });
      return json({ ok:true, data:{ success:true, message:'Semua audit log berhasil dihapus.' } });
    } catch (error) {
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'getAdminExportBackup') {
    try {
      if (session.userType !== 'admin') return json({ ok:false, error:'Akses hanya untuk admin.' }, 403);
      const request = args[0] && typeof args[0] === 'object' ? args[0] : {};
      const result = await getAdminExportBackupSupabase(env, request.dataset);
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Admin export backup error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error), rows:[] } });
    }
  }

  if (method === 'getAdminDataQuality') {
    try {
      return json({ ok:true, data:await getAdminDataQualitySupabase(env, session) });
    } catch (error) {
      console.error('Admin data quality error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error), findings:[] } });
    }
  }

  if (method === 'getRecentAttendance') {
    try {
      if (session.userType !== 'admin') return json({ ok:false, error:'Akses hanya untuk admin.' }, 403);
      const rows = await sbRows(env, 'student_attendance', { order:'attendance_date.desc,created_at.desc', limit:'250' });
      return json({ ok:true, data:{ success:true, items:rows.map(mapAttendance) } });
    } catch (error) {
      console.error('Recent attendance sync error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error), items:[] } });
    }
  }

  if (method === 'getRepertoireData') {
    try {
      const result = await getRepertoireDataSupabase(env, session);
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Repertoire read error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'saveStudentRepertoire' || method === 'deleteStudentRepertoire') {
    try {
      const payload = method === 'deleteStudentRepertoire'
        ? { repertoireID:String(args[0] || '').trim() }
        : (args[0] && typeof args[0] === 'object' ? structuredClone(args[0]) : {});
      const result = method === 'deleteStudentRepertoire'
        ? await deleteStudentRepertoireSupabase(env, session, payload)
        : await saveStudentRepertoireSupabase(env, session, payload);
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Repertoire write error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }


  if (method === 'getPracticeHubData') {
    try {
      return json({ ok:true, data:await getPracticeHubDataSupabase(env, session) });
    } catch (error) {
      console.error('Practice hub read error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error), resources:[], evaluations:[] } });
    }
  }

  if (method === 'savePracticeResource' || method === 'deletePracticeResource' || method === 'saveMediaEvaluation' || method === 'deleteMediaEvaluation') {
    try {
      let result;
      if (method === 'savePracticeResource') {
        const payload = args[0] && typeof args[0] === 'object' ? structuredClone(args[0]) : {};
        const files = Array.isArray(payload.files) ? payload.files : [];
        delete payload.files;
        if (files.length) {
          const upload = await driveUploadFiles(env, files, 'LegacyMusicCenter_MateriLatihan');
          if (!upload || upload.success !== true) return json({ ok:true, data:{ success:false, message:(upload && upload.message) || 'Upload file materi latihan gagal.' } });
          payload.newAttachments = Array.isArray(upload.attachments) ? upload.attachments : [];
        } else payload.newAttachments = [];
        result = await savePracticeResourceSupabase(env, session, payload);
      } else if (method === 'deletePracticeResource') {
        result = await deletePracticeResourceSupabase(env, session, String(args[0] || '').trim());
      } else if (method === 'saveMediaEvaluation') {
        result = await saveMediaEvaluationSupabase(env, session, args[0] && typeof args[0] === 'object' ? structuredClone(args[0]) : {});
      } else {
        result = await deleteMediaEvaluationSupabase(env, session, String(args[0] || '').trim());
      }
      if (ctx && result && result.success) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Practice hub write error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }


  if (method === 'getStudent360Report') {
    try {
      const requested = String(args[0] || '').trim();

      let identifier = session.userType === 'siswa' ? String(session.userID || '').trim() : requested;
      let options = session.userType === 'siswa' && requested ? { publicationId:requested } : {};

      if (session.userType !== 'siswa' && requested) {
        const publication = await student360PublicationForStaff(env, session, requested);
        if (publication && publication.studentID) {
          identifier = publication.studentID;
          options = { publicationId:requested };
        }
      }

      const result = await buildStudent360ReportSupabase(env, session, identifier, options);
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Student 360 report error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'publishStudent360Report') {
    try {
      if (!['guru','admin'].includes(session.userType)) {
        return json({ ok:true, data:{ success:false, message:'Hanya guru atau admin yang dapat mengirim laporan ke siswa.' } });
      }
      const studentId = String(args[0] || '').trim();
      const progressId = String(args[1] || '').trim();
      const signatureMode = String(args[2] || '').toLowerCase() === 'manual' ? 'manual' : 'uploaded';
      const result = await publishStudent360ReportSupabase(env, session, studentId, progressId, signatureMode);
      if (result && result.success && ctx) {
        ctx.waitUntil(sendPushToUser(env, 'siswa', studentId, {
          title:'Laporan Perkembangan Tersedia',
          body:'Laporan perkembangan terbaru Anda sudah tersedia di Legacy Music Center.',
          url:'/?open=section-laporan',
          tag:'student360-' + String(result.reportID || progressId || studentId)
        }).catch(error => console.error('Student 360 push failed:', error)));
      }
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Publish Student 360 report error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'deleteStudent360Report') {
    try {
      if (!['guru','admin'].includes(session.userType)) {
        return json({ ok:true, data:{ success:false, message:'Akses hapus laporan ditolak.' } });
      }
      const reportId = String(args[0] || '').trim();
      const result = await deleteStudent360ReportSupabase(env, session, reportId);
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Delete Student 360 report error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }


  // ANNUAL EXAM + CERTIFICATE (TEST v1)
  if (method === 'listAnnualExams') {
    try {
      return json({ ok:true, data:{ success:true, exams:await listAnnualExamsSupabase(env, session) } });
    } catch (error) {
      console.error('Annual exam list error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error), exams:[] } });
    }
  }

  if (method === 'getAnnualExam') {
    try {
      const exam = await getAnnualExamSupabase(env, session, String(args[0] || '').trim());
      return json({ ok:true, data:{ success:true, exam } });
    } catch (error) {
      console.error('Annual exam detail error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'saveAnnualExam') {
    try {
      if (session.userType !== 'guru') throw new Error('Hanya guru yang dapat menyimpan penilaian ujian.');
      const result = await saveAnnualExamSupabase(env, session, args[0] || {});
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Annual exam save error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'publishAnnualExam') {
    try {
      if (session.userType !== 'guru') throw new Error('Hanya guru yang dapat mengirim hasil ujian dan sertifikat.');
      const examId = String(args[0] || '').trim();
      const examBeforePublish = await getAnnualExamSupabase(env, session, examId);
      const result = await publishAnnualExamSupabase(env, session, examId);
      if (result && result.success && ctx && examBeforePublish && examBeforePublish.studentID) {
        ctx.waitUntil(sendPushToUser(env, 'siswa', examBeforePublish.studentID, {
          title:'Sertifikat Ujian Tersedia',
          body:`Hasil ujian ${examBeforePublish.instrument || 'musik'} dan sertifikat Anda sudah tersedia.`,
          url:'/?open=section-annual-exam',
          tag:'annual-exam-' + examId
        }).catch(error => console.error('Annual exam push failed:', error)));
      }
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Annual exam publish error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  if (method === 'deleteAnnualExam') {
    try {
      if (session.userType !== 'guru') throw new Error('Hanya guru yang dapat menghapus hasil ujian.');
      const result = await deleteAnnualExamSupabase(env, session, String(args[0] || '').trim());
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Annual exam delete error:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  const safeArgs = bindIdentity(method, args, session);

  // PHASE 11 Alternative: photo upload goes to the dedicated Drive microservice.
  // Supabase remains authoritative for the photo URL; legacy Spreadsheet is only a shadow.
  if (method === 'updateUserPhoto') {
    let result = null;

    if (hasDriveServiceConfig(env)) {
      try {
        const upload = await driveRpc(env, 'uploadProfilePhoto', [
          {
            userID:session.userID,
            userType:session.userType,
            base64Data:String(safeArgs[2] || ''),
            fileName:String(safeArgs[3] || `${session.userID}_photo.png`)
          }
        ]);

        if (!upload || upload.success !== true || !upload.photoUrl) {
          throw new Error((upload && upload.message) || 'Upload foto melalui Drive Service gagal.');
        }

        await supabaseRpc(env, 'legacy_update_identity_profile', {
          p_role: session.userType,
          p_user_id: session.userID,
          p_name: null,
          p_email: null,
          p_phone: null,
          p_instrument: null,
          p_photo_url: String(upload.photoUrl || '').trim()
        });

        result = {
          success:true,
          message:'Foto profil berhasil diperbarui.',
          photoUrl:String(upload.photoUrl || '').trim()
        };

        if (ctx) {
          ctx.waitUntil(
            gasRpc(env, 'phase11UpdatePhotoShadow', [
              session.userID,
              session.userType,
              result.photoUrl
            ]).catch(error => {
              console.error('Apps Script photo shadow failed:', error);
            })
          );
        }
      } catch (error) {
        console.error('Drive microservice profile upload failed, falling back to legacy Apps Script:', error);
      }
    }

    if (!result) {
      result = await gasRpc(env, method, safeArgs);
      if (result && result.success === true) {
        try {
          await supabaseRpc(env, 'legacy_update_identity_profile', {
            p_role: session.userType,
            p_user_id: session.userID,
            p_name: null,
            p_email: null,
            p_phone: null,
            p_instrument: null,
            p_photo_url: String(result.photoUrl || '').trim() || null
          });
        } catch (error) {
          console.error('Supabase profile-photo mirror failed:', error);
        }
      }
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  if (method === 'updateSelfProfile') {
    const payload = safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {};
    try {
      await supabaseRpc(env, 'legacy_update_identity_profile', {
        p_role: session.userType,
        p_user_id: session.userID,
        p_name: String(payload.nama || '').trim() || null,
        p_email: String(payload.email || '').trim() || null,
        p_phone: String(payload.noHp || '').trim() || null,
        p_instrument: String(payload.instrumen || '').trim() || null,
        p_photo_url: null
      });
    } catch (error) {
      console.error('Supabase identity update failed for updateSelfProfile:', error);
      return json({ ok:true, data:{ success:false, message:'Gagal memperbarui profil di database.' } });
    }

    const result = { success:true, message:'Profil berhasil diperbarui.', userID:session.userID };
    if (ctx && env.APPS_SCRIPT_URL && env.APPS_SCRIPT_TOKEN) {
      ctx.waitUntil(gasRpc(env, method, safeArgs).catch(error => console.error('Apps Script profile shadow failed:', error)));
    }
    if (ctx && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
    const maxAge = sessionMaxAgeForRole(session.userType);
    const refreshedSession = { ...session, userName:String(payload.nama || session.userName || '').trim(), exp:Math.floor(Date.now()/1000)+maxAge };
    const refreshedToken = await signSession(refreshedSession, env.SESSION_SECRET);
    return json({ ok:true, data:result }, 200, { 'set-cookie':`${COOKIE_NAME}=${refreshedToken}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict` });
  }

  // PHASE 10: Guru is now Supabase-first.
  // Apps Script is only a compatibility shadow and runs in the background.
  if (method === 'addGuru' || method === 'updateGuru' || method === 'deleteGuru') {
    const payload = safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {};
    let directPayload = payload;

    if (method === 'deleteGuru') {
      directPayload = { identifier: String(safeArgs[0] || '').trim() };
    }

    let result;
    try {
      result = await supabaseRpc(env, 'legacy_direct_teacher_mutation', {
        p_action: method,
        p_payload: directPayload
      });
    } catch (error) {
      console.error(`Supabase direct teacher write failed for ${method}:`, error);
      return json({
        ok:true,
        data:{ success:false, message:'Gagal menyimpan data guru ke database. Silakan coba lagi.' }
      });
    }

    if (result && result.success === true && ctx) {
      const shadowArgs = structuredClone(safeArgs);

      // addGuru must use the exact Supabase-generated ID in Spreadsheet shadow.
      if (method === 'addGuru' && shadowArgs[0] && typeof shadowArgs[0] === 'object') {
        shadowArgs[0].guruID = String(result.guruID || '').trim();
      }

      ctx.waitUntil(
        gasRpc(env, method, shadowArgs).catch(error => {
          console.error(`Apps Script teacher shadow failed for ${method}:`, error);
        })
      );
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  // PHASE 10: Siswa + Kelas + schedules are now Supabase-first.
  // A canonical Spreadsheet shadow runs after the response for legacy Drive/App Script features.
  if (method === 'addSiswaCombined' || method === 'updateSiswa' || method === 'deleteSiswa') {
    const payload = safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {};
    const directPayload = method === 'deleteSiswa'
      ? { identifier: String(safeArgs[0] || '').trim() }
      : payload;

    let result;
    try {
      result = await supabaseRpc(env, 'legacy_direct_student_mutation', {
        p_action: method,
        p_payload: directPayload,
        p_requester_role: session.userType
      });
    } catch (error) {
      console.error(`Supabase direct student write failed for ${method}:`, error);
      return json({
        ok:true,
        data:{ success:false, message:'Gagal menyimpan data siswa ke database. Silakan coba lagi.' }
      });
    }

    if (result && result.success === true && method !== 'deleteSiswa') {
      const studentId = String(result.siswaID || payload.siswaID || '').trim();
      if (method === 'addSiswaCombined' && studentId) {
        try {
          const initialPassword = generateInitialPassword();
          await supabaseRpc(env, 'legacy_set_account_password', { p_user_id:studentId, p_role:'siswa', p_password:initialPassword, p_must_change:true });
          result.initialPassword = initialPassword;
          result.message = `${result.message || 'Siswa berhasil ditambahkan.'} Password awal: ${initialPassword}`;
        } catch (error) {
          console.error('Initial student password hardening failed:', error);
          return json({ ok:true, data:{ success:false, message:'Data siswa tersimpan, tetapi password awal gagal dibuat. Jalankan migration 32 lalu coba tambah siswa baru lagi.' } });
        }
      }
      try {
        await patchStudentClassDatesFromPayload(env, studentId, payload);
        if (studentId) {
          await supabaseRest(env, `/rest/v1/students?student_id=eq.${encodeURIComponent(studentId)}`, {
            method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
            body:JSON.stringify({ exit_reason:String(payload.alasanKeluar || '').trim() || null })
          });
        }
      } catch (error) {
        console.error(`Student class date/exit reason patch failed for ${method}:`, error);
      }
    }

    if (result && result.success === true && ctx) {
      if (method === 'deleteSiswa') {
        // Existing Apps Script delete keeps the legacy Sheet/history shadow coherent.
        ctx.waitUntil(
          gasRpc(env, 'deleteSiswa', [String(safeArgs[0] || '').trim()]).catch(error => {
            console.error('Apps Script student delete shadow failed:', error);
          })
        );
      } else {
        const studentId = String(result.siswaID || payload.siswaID || '').trim();
        ctx.waitUntil(
          shadowStudentFromSupabase(env, studentId).catch(error => {
            console.error(`Apps Script student shadow failed for ${method}:`, error);
          })
        );
      }
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  // PHASE 10B: regular schedule writes are now Supabase-first.
  // The full student/class/schedule snapshot is shadowed to Spreadsheet in background.
  if (method === 'updateJadwal' || method === 'deleteJadwal') {
    const payload = method === 'deleteJadwal'
      ? { jadwalID:String(safeArgs[0] || '').trim() }
      : (safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {});

    let result;
    try {
      result = await supabaseRpc(env, 'legacy_direct_schedule_mutation', {
        p_action: method,
        p_payload: payload,
        p_requester_role: session.userType
      });
    } catch (error) {
      console.error(`Supabase direct schedule write failed for ${method}:`, error);
      return json({
        ok:true,
        data:{ success:false, message:'Gagal menyimpan jadwal ke database. Silakan coba lagi.' }
      });
    }

    if (result && result.success === true && ctx) {
      const studentId = String(result.siswaID || '').trim();
      if (studentId) {
        ctx.waitUntil(
          shadowStudentFromSupabase(env, studentId).catch(error => {
            console.error(`Apps Script schedule shadow failed for ${method}:`, error);
          })
        );
      }
      if (method === 'updateJadwal' && studentId) {
        ctx.waitUntil((async()=>{
          const scheduleId=String(result.jadwalID||payload.jadwalID||'').trim();
          const rows=scheduleId?await sbRows(env,'schedules',{schedule_id:`eq.${scheduleId}`,limit:'1'}).catch(()=>[]):[];
          const row=rows[0]||{};
          const note={title:'Jadwal Kelas Diperbarui',body:pushText(`${row.day_name||payload.hari||''} ${formatDbTime(row.start_time)||payload.jamMulai||''} · ${row.room||payload.ruangan||'-'}`),url:'/',tag:'schedule-'+(scheduleId||studentId)};
          const recipients=[{role:'siswa',id:studentId}];
          const teacherId=String(row.teacher_id||payload.guruID||'').trim(); if(teacherId) recipients.push({role:'guru',id:teacherId});
          await pushToUniqueRecipients(env,recipients,note);
        })().catch(error=>console.error('Schedule push failed:',error)));
      }
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  // PHASE 10B: student attendance is now Supabase-first.
  // Spreadsheet is maintained only as a report/legacy compatibility shadow.
  if (method === 'recordAbsensi' || method === 'updateAbsensi' || method === 'deleteAbsensi') {
    const payload = method === 'deleteAbsensi'
      ? { absensiID:String(safeArgs[0] || '').trim() }
      : (safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {});

    let result;
    try {
      result = await supabaseRpc(env, 'legacy_direct_student_attendance_mutation', {
        p_action: method,
        p_payload: payload,
        p_requester_role: session.userType,
        p_requester_id: session.userID,
        p_requester_name: session.userName
      });
    } catch (error) {
      console.error(`Supabase direct attendance write failed for ${method}:`, error);
      return json({
        ok:true,
        data:{ success:false, message:'Gagal menyimpan absensi ke database. Silakan coba lagi.' }
      });
    }

    if (result && result.success === true && ctx) {
      if (method === 'deleteAbsensi') {
        const attendanceId = String(result.absensiID || payload.absensiID || '').trim();
        ctx.waitUntil(
          gasRpc(env, 'phase10DeleteAttendanceShadow', [attendanceId]).catch(error => {
            console.error('Apps Script attendance delete shadow failed:', error);
          })
        );
      } else if (result.attendance) {
        ctx.waitUntil(
          gasRpc(env, 'phase10UpsertAttendanceShadow', [result.attendance]).catch(error => {
            console.error(`Apps Script attendance shadow failed for ${method}:`, error);
          })
        );
        const a=result.attendance||{};
        const studentId=String(a.student_id||a.siswaID||payload.siswaID||'').trim();
        if(studentId) ctx.waitUntil(sendPushToUser(env,'siswa',studentId,{title:'Absensi Kelas Diperbarui',body:pushText(`Status: ${a.status||payload.status||'-'}${a.material||payload.materi?` · Materi: ${a.material||payload.materi}`:''}`),url:'/',tag:'attendance-'+String(a.attendance_id||a.absensiID||Date.now())}).catch(error=>console.error('Attendance push failed:',error)));
      }
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  // PHASE 10D: Task metadata is Supabase-first.
  // Apps Script is used only to upload Drive files and maintain a Sheet shadow.
  if (method === 'addTugasCombined' || method === 'submitTugasJawaban' || method === 'deleteTugas') {
    const payload = method === 'deleteTugas'
      ? { tugasID:String(safeArgs[0] || '').trim() }
      : (safeArgs[0] && typeof safeArgs[0] === 'object' ? structuredClone(safeArgs[0]) : {});

    try {
      if (method === 'addTugasCombined') {
        const rawYoutube = String(payload.youtubeUrl || '').trim();
        const youtube = buildYouTubeMeta(rawYoutube);
        if (rawYoutube && !youtube.videoId) {
          return json({ ok:true, data:{ success:false, message:'Link YouTube tidak valid. Gunakan link video YouTube, Shorts, atau youtu.be.' } });
        }
        payload.youtubeUrl = youtube.url || '';

        const files = Array.isArray(payload.files) ? payload.files : [];
        delete payload.files;
        if (files.length) {
          const upload = await driveUploadFiles(env, files, 'LegacyGuitarClass_Tugas');
          if (!upload || upload.success !== true) {
            return json({ ok:true, data:{ success:false, message:(upload && upload.message) || 'Upload file tugas gagal.' } });
          }
          payload.materialAttachments = upload.attachments || [];
        } else {
          payload.materialAttachments = [];
        }

        if (youtube.videoId) {
          payload.materialAttachments.push({
            kind:'youtube',
            name:'Video YouTube',
            type:'video/youtube',
            url:youtube.url,
            videoId:youtube.videoId
          });
        }
      }

      if (method === 'submitTugasJawaban') {
        const files = Array.isArray(payload.files) ? payload.files : [];
        const answerText = String(payload.jawabanTeks || '').trim();
        if (!answerText && !files.length) {
          return json({ ok:true, data:{ success:false, message:'Tulis jawaban atau unggah minimal satu file.' } });
        }
        delete payload.files;
        if (files.length) {
          const upload = await driveUploadFiles(env, files, 'LegacyGuitarClass_Jawaban');
          if (!upload || upload.success !== true) {
            return json({ ok:true, data:{ success:false, message:(upload && upload.message) || 'Upload jawaban gagal.' } });
          }
          payload.answerAttachments = upload.attachments || [];
        } else {
          payload.answerAttachments = [];
        }
      }

      const result = await supabaseRpc(env, 'legacy_direct_task_mutation', {
        p_action: method,
        p_payload: payload,
        p_requester_role: session.userType,
        p_requester_id: session.userID,
        p_requester_name: session.userName
      });

      if (result && result.success === true && ctx) {
        if (method === 'deleteTugas') {
          ctx.waitUntil(
            gasRpc(env, 'phase10DeleteTaskShadow', [String(result.tugasID || payload.tugasID || '')]).catch(error => {
              console.error('Apps Script task delete shadow failed:', error);
            })
          );
        } else if (result.assignment) {
          ctx.waitUntil(
            gasRpc(env, 'phase10UpsertTaskShadow', [result.assignment]).catch(error => {
              console.error(`Apps Script task shadow failed for ${method}:`, error);
            })
          );
          const a=result.assignment||{};
          if(method==='addTugasCombined'){
            const studentId=String(a.student_id||a.siswaID||payload.siswaID||'').trim();
            if(studentId) ctx.waitUntil(sendPushToUser(env,'siswa',studentId,{title:'Tugas Baru',body:pushText(a.title||a.judulTugas||payload.judulTugas||'Ada tugas baru dari guru.'),url:'/',tag:'task-'+String(a.assignment_id||a.tugasID||Date.now())}).catch(error=>console.error('New task push failed:',error)));
          } else if(method==='submitTugasJawaban'){
            const teacherId=String(a.teacher_id||a.guruID||payload.guruID||'').trim();
            if(teacherId) ctx.waitUntil(sendPushToUser(env,'guru',teacherId,{title:'Jawaban Tugas Masuk',body:pushText(`${a.student_name_snapshot||a.namaSiswa||session.userName||'Siswa'} telah mengirim jawaban tugas ${a.title||a.judulTugas||''}.`),url:'/',tag:'task-answer-'+String(a.assignment_id||a.tugasID||Date.now())}).catch(error=>console.error('Task answer push failed:',error)));
          }
        }
      }

      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error(`Phase 10D task operation failed for ${method}:`, error);
      return json({ ok:true, data:{ success:false, message:'Gagal memproses tugas. Silakan coba lagi.' } });
    }
  }

  // PHASE 10D: Learning Progress metadata is Supabase-first.
  // Apps Script only uploads signature images to Drive and keeps a Sheet shadow.
  if (method === 'saveLearningProgress' || method === 'deleteLearningProgress') {
    const payload = method === 'deleteLearningProgress'
      ? { progressID:String(safeArgs[0] || '').trim() }
      : (safeArgs[0] && typeof safeArgs[0] === 'object' ? structuredClone(safeArgs[0]) : {});

    try {
      if (method === 'saveLearningProgress') {
        const signaturePayload = {
          guruSignatureFile: payload.guruSignatureFile || null,
          kepalaSekolahSignatureFile: payload.kepalaSekolahSignatureFile || null
        };
        delete payload.guruSignatureFile;
        delete payload.kepalaSekolahSignatureFile;

        if (signaturePayload.guruSignatureFile || signaturePayload.kepalaSekolahSignatureFile) {
          const upload = await driveUploadProgressSignatures(env, signaturePayload);
          if (!upload || upload.success !== true) {
            return json({ ok:true, data:{ success:false, message:(upload && upload.message) || 'Upload tanda tangan gagal.' } });
          }
          if (upload.guruSignature) {
            payload.guruSignatureUrl = upload.guruSignature.downloadUrl || upload.guruSignature.url || '';
            payload.guruSignatureName = upload.guruSignature.name || '';
          }
          if (upload.kepalaSekolahSignature) {
            payload.kepalaSekolahSignatureUrl = upload.kepalaSekolahSignature.downloadUrl || upload.kepalaSekolahSignature.url || '';
            payload.kepalaSekolahSignatureName = upload.kepalaSekolahSignature.name || '';
          }
        }
      }

      const result = await supabaseRpc(env, 'legacy_direct_learning_progress_mutation', {
        p_action: method,
        p_payload: payload,
        p_requester_role: session.userType,
        p_requester_id: session.userID,
        p_requester_name: session.userName
      });

      if (result && result.success === true && ctx) {
        if (method === 'deleteLearningProgress') {
          ctx.waitUntil(
            gasRpc(env, 'phase10DeleteProgressShadow', [String(result.progressID || payload.progressID || '')]).catch(error => {
              console.error('Apps Script progress delete shadow failed:', error);
            })
          );
        } else if (result.progress) {
          ctx.waitUntil(
            gasRpc(env, 'phase10UpsertProgressShadow', [result.progress]).catch(error => {
              console.error('Apps Script progress shadow failed:', error);
            })
          );
          const pr=result.progress||{};
          const studentId=String(pr.student_id||pr.siswaID||payload.siswaID||'').trim();
          if(studentId) ctx.waitUntil(sendPushToUser(env,'siswa',studentId,{title:'Progress Belajar Diperbarui',body:pushText(`Progress ${pr.period||pr.periode||payload.periode||''} telah diperbarui oleh guru.`),url:'/',tag:'progress-'+String(pr.progress_id||pr.progressID||Date.now())}).catch(error=>console.error('Progress push failed:',error)));
        }
      }

      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error(`Phase 10D progress operation failed for ${method}:`, error);
      return json({ ok:true, data:{ success:false, message:'Gagal memproses Progress Belajar. Silakan coba lagi.' } });
    }
  }

  // DATE-SPECIFIC SCHEDULE OVERRIDE: one-date replacement + make-up class.
  if (method === 'saveScheduleOverride' || method === 'deleteScheduleOverride') {
    try {
      const result = method === 'deleteScheduleOverride'
        ? await deleteScheduleOverrideSupabase(env, session, String(safeArgs[0] || '').trim())
        : await saveScheduleOverrideSupabase(env, session, safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {});
      if (method === 'saveScheduleOverride' && result && result.success && result.override && ctx) {
        const o = result.override;
        const recipients = [];
        const pushTeacher = id => {
          const clean = String(id || '').trim();
          if (clean && clean !== String(session.userID || '').trim() && !recipients.some(item => item.id === clean)) recipients.push({role:'guru', id:clean});
        };
        pushTeacher(o.guruAsliID);
        pushTeacher(o.guruMakeupID);
        const slotDate = o.tanggalAsli ? formatDbDateDmy(o.tanggalAsli) : '';
        const makeupText = o.tanggalMakeup ? ` Make-up: ${formatDbDateDmy(o.tanggalMakeup)} ${o.jamMulaiMakeup || ''}.` : '';
        if (recipients.length) {
          ctx.waitUntil(pushToUniqueRecipients(env, recipients, {
            title:'Pergantian Jadwal',
            body:pushText(`${o.siswaAsli || 'Siswa'} · ${slotDate || '-'}${o.siswaPengganti ? ` · slot dipakai ${o.siswaPengganti}` : ''}.${makeupText}`),
            url:'/?open=section-pengganti',
            tag:'schedule-override-' + String(o.overrideID || Date.now())
          }).catch(error => console.error('Schedule override push failed:', error)));
        }
      }
      if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Schedule override operation failed:', error);
      return json({ ok:true, data:{ success:false, message:String(error && error.message ? error.message : error) } });
    }
  }

  // PHASE 10C: Jadwal Pengganti is now Supabase-first.
  if (method === 'addJadwalPengganti' || method === 'deleteJadwalPengganti') {
    const payload = method === 'deleteJadwalPengganti'
      ? { penggantiID:String(safeArgs[0] || '').trim() }
      : (safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {});

    let result;
    try {
      result = await supabaseRpc(env, 'legacy_direct_replacement_schedule_mutation', {
        p_action: method,
        p_payload: payload,
        p_requester_role: session.userType
      });
    } catch (error) {
      console.error(`Supabase direct replacement schedule write failed for ${method}:`, error);
      return json({
        ok:true,
        data:{ success:false, message:'Gagal menyimpan jadwal pergantian ke database. Silakan coba lagi.' }
      });
    }

    if (result && result.success === true && ctx) {
      if (method === 'deleteJadwalPengganti') {
        const id = String(result.penggantiID || payload.penggantiID || '').trim();
        ctx.waitUntil(
          gasRpc(env, 'phase10DeleteReplacementShadow', [id]).catch(error => {
            console.error('Apps Script replacement delete shadow failed:', error);
          })
        );
      } else if (result.replacement) {
        ctx.waitUntil(
          gasRpc(env, 'phase10UpsertReplacementShadow', [result.replacement]).catch(error => {
            console.error('Apps Script replacement shadow failed:', error);
          })
        );
        const r=result.replacement||{};
        const studentId=String(r.student_id||r.siswaID||payload.siswaID||'').trim();
        const teacherId=String(r.teacher_id||r.guruID||payload.guruID||'').trim();
        const date=formatDbDateIso(r.scheduled_date)||payload.tanggalPelaksanaan||'';
        const time=formatDbTime(r.start_time)||payload.jamMulai||'';
        const note={title:'Jadwal Pengganti',body:pushText(`${date} · ${time} · ${r.room||payload.ruangan||'-'}`),url:'/',tag:'replacement-'+String(r.replacement_id||r.penggantiID||Date.now())};
        const recipients=[]; if(studentId) recipients.push({role:'siswa',id:studentId}); if(teacherId) recipients.push({role:'guru',id:teacherId});
        ctx.waitUntil(pushToUniqueRecipients(env,recipients,note).catch(error=>console.error('Replacement push failed:',error)));
      }
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  // PHASE 10C: Pengumuman is now Supabase-first.
  if (method === 'addPengumuman' || method === 'deletePengumuman') {
    const payload = method === 'deletePengumuman'
      ? { pengumumanID:String(safeArgs[0] || '').trim() }
      : (safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {});

    let result;
    try {
      result = await supabaseRpc(env, 'legacy_direct_announcement_mutation', {
        p_action: method,
        p_payload: payload,
        p_requester_role: session.userType,
        p_requester_id: session.userID,
        p_requester_name: session.userName
      });
    } catch (error) {
      console.error(`Supabase direct announcement write failed for ${method}:`, error);
      return json({
        ok:true,
        data:{ success:false, message:'Gagal menyimpan pengumuman ke database. Silakan coba lagi.' }
      });
    }

    if (result && result.success === true && ctx) {
      if (method === 'deletePengumuman') {
        const id = String(result.pengumumanID || payload.pengumumanID || '').trim();
        ctx.waitUntil(
          gasRpc(env, 'phase10DeleteAnnouncementShadow', [id]).catch(error => {
            console.error('Apps Script announcement delete shadow failed:', error);
          })
        );
      } else if (result.announcement) {
        const rawAnnouncement = result.announcement;
        ctx.waitUntil(
          gasRpc(env, 'phase10UpsertAnnouncementShadow', [rawAnnouncement]).catch(error => {
            console.error('Apps Script announcement shadow failed:', error);
          })
        );
        ctx.waitUntil(pushAnnouncementAudience(env,rawAnnouncement).catch(error=>console.error('Announcement push failed:',error)));
        // Return the same lightweight shape used by dashboard/live sync so Admin can
        // render the new announcement immediately without reloading the whole dashboard.
        result.announcement = mapAnnouncement(rawAnnouncement);
      }
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  // PHASE 10C: Absensi Guru is now Supabase-first.
  if (method === 'recordTeacherAttendance' || method === 'deleteTeacherAttendance') {
    const payload = method === 'deleteTeacherAttendance'
      ? { absensiGuruID:String(safeArgs[0] || '').trim() }
      : (safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {});

    let result;
    try {
      result = await supabaseRpc(env, 'legacy_direct_teacher_attendance_mutation', {
        p_action: method,
        p_payload: payload,
        p_requester_role: session.userType,
        p_requester_id: session.userID,
        p_requester_name: session.userName
      });
    } catch (error) {
      console.error(`Supabase direct teacher attendance write failed for ${method}:`, error);
      return json({
        ok:true,
        data:{ success:false, message:'Gagal menyimpan absensi guru ke database. Silakan coba lagi.' }
      });
    }

    if (result && result.success === true && ctx) {
      if (method === 'deleteTeacherAttendance') {
        const id = String(result.absensiGuruID || payload.absensiGuruID || '').trim();
        ctx.waitUntil(
          gasRpc(env, 'phase10DeleteTeacherAttendanceShadow', [id]).catch(error => {
            console.error('Apps Script teacher attendance delete shadow failed:', error);
          })
        );
      } else if (result.attendance) {
        ctx.waitUntil(
          gasRpc(env, 'phase10UpsertTeacherAttendanceShadow', [result.attendance]).catch(error => {
            console.error('Apps Script teacher attendance shadow failed:', error);
          })
        );
      }
    }

    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
  }

  if (method === 'getExitedStudentArchive') {
    let result;
    try {
      result = await getExitedStudentArchiveSupabase(
        env,
        String(safeArgs[0] || '').trim(),
        String(safeArgs[1] || '').trim()
      );
    } catch (error) {
      console.error('Exited-student archive read failed:', error);
      result = { success:false, message:'Gagal membuka arsip siswa: ' + String(error && error.message ? error.message : error) };
    }
    return json({ ok:true, data:result });
  }

  if (method === 'deleteExitedStudentRecord') {
    let result;
    try {
      result = await purgeExitedStudentSupabase(env, String(safeArgs[0] || '').trim());
    } catch (error) {
      console.error('Permanent exited-student purge failed:', error);
      result = { success:false, message:'Gagal menghapus permanen siswa: ' + String(error && error.message ? error.message : error) };
    }
    if (result && result.success === true && ctx) {
      ctx.waitUntil(gasRpc(env, 'deleteExitedStudentRecord', safeArgs).catch(error => console.error('Apps Script exited-student shadow cleanup failed:', error)));
    }
    if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
    return json({ ok:true, data:result });
  }


  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_TOKEN) {
    return json({ ok:false, error:'Fitur ini membutuhkan konfigurasi Apps Script/Drive yang belum lengkap.' }, 503);
  }
  const result = await gasRpc(env, method, safeArgs);
  if (ctx && result && result.success && AUDIT_METHODS.has(method)) ctx.waitUntil(recordAuditLog(env, session, method, args, result).catch(error => console.error('Audit log write failed:', error)));
      return json({ ok:true, data:result });
}



async function getExitedStudentArchiveSupabase(env, identifier, fallbackName = '') {
  const key = String(identifier || '').trim();
  const nameHint = String(fallbackName || '').trim();
  if (!key && !nameHint) throw new Error('Identitas siswa arsip kosong.');

  const first = async (table, filters) => {
    try { const rows = await sbRowsSafe(env, table, { ...filters, limit:'1' }); return rows[0] || null; }
    catch (_) { return null; }
  };
  const listSafe = async (table, filters) => {
    try { return await sbRowsSafe(env, table, filters); }
    catch (_) { return []; }
  };

  let student = null;
  if (key) student = await first('students', { student_id:`eq.${key}` });
  if (!student && nameHint) student = await first('students', { name:`eq.${nameHint}` });
  if (!student && key && key !== nameHint) student = await first('students', { name:`eq.${key}` });

  let historySeed = null;
  if (!student && key) historySeed = await first('student_history', { student_id:`eq.${key}`, order:'event_at.desc.nullslast,created_at.desc' });
  if (!historySeed && nameHint) historySeed = await first('student_history', { student_name_snapshot:`eq.${nameHint}`, order:'event_at.desc.nullslast,created_at.desc' });
  if (!historySeed && key && key !== nameHint) historySeed = await first('student_history', { student_name_snapshot:`eq.${key}`, order:'event_at.desc.nullslast,created_at.desc' });

  if (!student && !historySeed) {
    return { success:false, message:'Arsip siswa tidak ditemukan. Data utama dan riwayat siswa sudah tidak tersedia.' };
  }

  const studentId = String(student?.student_id || historySeed?.student_id || key || '').trim();
  const studentName = String(student?.name || historySeed?.student_name_snapshot || nameHint || key || '').trim();
  const byId = studentId ? { student_id:`eq.${studentId}` } : null;
  const byName = studentName ? { student_name_snapshot:`eq.${studentName}` } : null;

  const rowsFor = async (table, idColumn='student_id', nameColumn='student_name_snapshot', extra={}) => {
    let rows = [];
    if (studentId) rows = await listSafe(table, { [idColumn]:`eq.${studentId}`, ...extra });
    if (!rows.length && studentName && nameColumn) rows = await listSafe(table, { [nameColumn]:`eq.${studentName}`, ...extra });
    return rows;
  };

  const [classes, schedules, attendance, assignments, progress, repertoire, practice, evaluations, exams, reportsById, history] = await Promise.all([
    rowsFor('student_classes','student_id','student_name_snapshot',{order:'created_at.desc',limit:'100'}),
    rowsFor('schedules','student_id','student_name_snapshot',{order:'created_at.desc',limit:'100'}),
    rowsFor('student_attendance','student_id','student_name_snapshot',{order:'attendance_date.desc,created_at.desc',limit:'300'}),
    rowsFor('assignments','student_id','student_name_snapshot',{order:'created_at.desc',limit:'200'}),
    rowsFor('learning_progress','student_id','student_name_snapshot',{order:'last_updated_at.desc.nullslast,created_at.desc',limit:'100'}),
    rowsFor('student_repertoire','student_id','student_name_snapshot',{order:'updated_at.desc',limit:'100'}),
    rowsFor('practice_resources','student_id','student_name_snapshot',{order:'updated_at.desc',limit:'100'}),
    rowsFor('media_evaluations','student_id','student_name_snapshot',{order:'updated_at.desc',limit:'100'}),
    rowsFor('annual_exam_assessments','student_public_id','student_name_snapshot',{order:'exam_date.desc,created_at.desc',limit:'100'}),
    studentId ? listSafe('student_report_publications',{student_id:`eq.${studentId}`,order:'sent_at.desc',limit:'100'}) : [],
    rowsFor('student_history','student_id','student_name_snapshot',{order:'event_at.desc.nullslast,created_at.desc',limit:'300'})
  ]);

  const exitRow = history.find(row => String(row.event_type||'').trim().toLowerCase()==='keluar') || historySeed || null;
  const profile = {
    siswaID: studentId,
    nama: studentName || '-',
    status: student?.status || exitRow?.new_status || 'Keluar',
    email: student?.email || '',
    noHp: student?.phone || '',
    instrumen: student?.instrument || exitRow?.instrument || classes[0]?.instrument || '-',
    guru: student?.teacher_name_snapshot || exitRow?.teacher_name_snapshot || classes[0]?.teacher_name_snapshot || '-',
    grade: student?.grade || classes[0]?.grade || '-',
    tanggalMasuk: formatDbDateIso(student?.registered_on || ''),
    tanggalKeluar: formatDbDateIso(student?.left_on || exitRow?.event_at || ''),
    alasanKeluar: student?.exit_reason || exitRow?.description || ''
  };

  return {
    success:true,
    limited:!student,
    profile,
    counts:{
      kelas:classes.length, jadwal:schedules.length, absensi:attendance.length, tugas:assignments.length,
      progress:progress.length, repertoire:repertoire.length, materiLatihan:practice.length,
      evaluasi:evaluations.length, ujian:exams.length, laporan:reportsById.length, riwayat:history.length
    },
    classes:classes.map(r=>({instrumen:r.instrument||'',guru:r.teacher_name_snapshot||'',grade:r.grade||'',status:r.status||'',mulai:formatDbDateIso(r.started_on),selesai:formatDbDateIso(r.ended_on)})),
    attendance:attendance.map(r=>({tanggal:formatDbDateIso(r.attendance_date),pertemuan:r.meeting_number??'',status:r.status||'',materi:r.material||'',lagu:r.song||'',guru:r.teacher_name_snapshot||''})),
    assignments:assignments.map(r=>({judul:r.title||'',status:r.status||'',deadline:formatDbDateIso(r.deadline),dibuat:formatDbDateIso(r.created_on),dikirim:formatDbDateIso(r.sent_on),jawaban:r.answer_text||''})),
    progress:progress.map(r=>({periode:r.period||'',level:r.level||'',nilai:Number(r.overall_progress||0),guru:r.teacher_name_snapshot||'',target:r.next_target||''})),
    repertoire:repertoire.map(r=>({judul:r.song_title||'',status:r.status||'',progress:Number(r.progress_percent||0),instrumen:r.instrument||'',guru:r.teacher_name_snapshot||''})),
    practice:practice.map(r=>({judul:r.title||'',instrumen:r.instrument||'',guru:r.teacher_name_snapshot||'',updated:r.updated_at||r.created_at||''})),
    evaluations:evaluations.map(r=>({judul:r.title||'',instrumen:r.instrument||'',guru:r.teacher_name_snapshot||'',updated:r.updated_at||r.created_at||''})),
    exams:exams.map(r=>({tanggal:formatDbDateIso(r.exam_date),grade:r.grade_exam||'',nilai:Number(r.final_score||0),predikat:r.predicate||'',status:r.result_status||'',published:Boolean(r.published)})),
    reports:reportsById.map(r=>({tanggal:r.sent_at||'',pengirim:r.sent_by_name||'',aktif:r.active!==false,progressID:r.progress_id||''})),
    history:history.map(r=>({tanggal:formatDbDateIso(r.event_at),jenis:r.event_type||'',statusSebelum:r.previous_status||'',statusSesudah:r.new_status||'',instrumen:r.instrument||'',guru:r.teacher_name_snapshot||'',keterangan:r.description||''}))
  };
}

async function purgeExitedStudentSupabase(env, identifier) {
  const key = String(identifier || '').trim();
  if (!key) throw new Error('Identitas siswa kosong.');

  let rows = await sbRowsSafe(env, 'students', { student_id:`eq.${key}`, limit:'1' });
  if (!rows.length) rows = await sbRowsSafe(env, 'students', { name:`eq.${key}`, limit:'1' });
  const student = rows[0] || null;

  let historyRows = [];
  if (!student) historyRows = await sbRowsSafe(env, 'student_history', { student_id:`eq.${key}`, order:'event_at.desc.nullslast,created_at.desc', limit:'20' });
  if (!student && !historyRows.length) historyRows = await sbRowsSafe(env, 'student_history', { student_name_snapshot:`eq.${key}`, order:'event_at.desc.nullslast,created_at.desc', limit:'20' });

  if (student && String(student.status || '').trim().toLowerCase() !== 'keluar') {
    throw new Error('Hanya siswa berstatus Keluar yang dapat dihapus permanen.');
  }

  const history = historyRows[0] || null;
  const id = String(student?.student_id || history?.student_id || (historyRows.length ? key : '')).trim();
  const name = String(student?.name || history?.student_name_snapshot || (!id ? key : '')).trim();

  // Jika record utama sudah terhapus, anggap sebagai orphan archive dan bersihkan sisa riwayat/data.
  const del = async (table, filter) => {
    if (!filter) return;
    try { await supabaseRest(env, `/rest/v1/${table}?${filter}`, { method:'DELETE', headers:{Prefer:'return=minimal'} }); }
    catch (e) { console.error(`Purge ${table} skipped:`, e); }
  };

  if (id) {
    await del('push_delivery_events', `user_type=eq.siswa&user_id=eq.${encodeURIComponent(id)}`);
    await del('push_subscriptions', `user_type=eq.siswa&user_id=eq.${encodeURIComponent(id)}`);
    await del('media_evaluations', `student_id=eq.${encodeURIComponent(id)}`);
    await del('practice_resources', `student_id=eq.${encodeURIComponent(id)}`);
    await del('student_repertoire', `student_id=eq.${encodeURIComponent(id)}`);
    await del('annual_exam_assessments', `student_public_id=eq.${encodeURIComponent(id)}`);
    await del('student_report_publications', `student_id=eq.${encodeURIComponent(id)}`);
    await del('learning_progress', `student_id=eq.${encodeURIComponent(id)}`);
    await del('assignments', `student_id=eq.${encodeURIComponent(id)}`);
    await del('student_attendance', `student_id=eq.${encodeURIComponent(id)}`);
    await del('schedule_overrides', `absent_student_id=eq.${encodeURIComponent(id)}`);
    await del('schedule_overrides', `slot_student_id=eq.${encodeURIComponent(id)}`);
    await del('replacement_schedules', `student_id=eq.${encodeURIComponent(id)}`);
    await del('schedules', `student_id=eq.${encodeURIComponent(id)}`);
    await del('student_classes', `student_id=eq.${encodeURIComponent(id)}`);
    await del('student_history', `student_id=eq.${encodeURIComponent(id)}`);
    await del('audit_logs', `entity_id=eq.${encodeURIComponent(id)}`);
    await del('students', `student_id=eq.${encodeURIComponent(id)}`);
  }
  if (name) {
    await del('learning_progress', `student_id=is.null&student_name_snapshot=eq.${encodeURIComponent(name)}`);
    if (!id) await del('student_history', `student_name_snapshot=eq.${encodeURIComponent(name)}`);
  }

  if (!student && !historyRows.length) {
    return { success:true, alreadyDeleted:true, siswaID:key, message:'Data siswa sudah tidak ada di Supabase. Tidak ada arsip tersisa untuk dihapus.' };
  }

  return { success:true, siswaID:id || key, message:`${student ? `Siswa ${student.name || name || ''}` : `Arsip ${name || key}`} dan seluruh data terkait berhasil dihapus permanen.` };
}

// ============================================================================
// ANNUAL EXAM + CERTIFICATE — TEST v1
// ============================================================================
function annualExamPredicateServer(score) {
  const n = Number(score || 0);
  if (n >= 90) return 'Excellent';
  if (n >= 80) return 'Very Good';
  if (n >= 70) return 'Good';
  if (n >= 60) return 'Fair';
  return 'Need Improvement';
}

function annualExamNextGradeServer(grade, passed) {
  const grades = ['Beginner','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8'];
  const clean = String(grade || 'Beginner').trim();
  if (!passed) return clean;
  const idx = grades.findIndex(x => x.toLowerCase() === clean.toLowerCase());
  return idx >= 0 && idx < grades.length - 1 ? grades[idx + 1] : clean;
}

function mapAnnualExamRow(row) {
  const items = Array.isArray(row.items) ? row.items : [];
  return {
    examID: row.exam_id || '', studentID: row.student_public_id || '', studentName: row.student_name_snapshot || '',
    teacherID: row.teacher_id || '', teacherName: row.teacher_name_snapshot || '', instrument: row.instrument || '',
    gradeExam: row.grade_exam || '', examDate: formatDbDateIso(row.exam_date), examiner1Name: row.examiner_1_name || '', examiner2Name: row.examiner_2_name || '',
    notesExaminer1: row.notes_examiner_1 || '', notesExaminer2: row.notes_examiner_2 || '', items,
    finalScore: Number(row.final_score || 0), predicate: row.predicate || '', resultStatus: row.result_status || '', nextGrade: row.next_grade || '',
    certificateNo: row.certificate_no || '', published: Boolean(row.published), publishedAt: row.published_at || '', createdAt: row.created_at || '',
    examiner1SignatureUrl: row.examiner_1_signature_url || '', examiner2SignatureUrl: row.examiner_2_signature_url || '',
    headmasterName: row.headmaster_name || '', headmasterSignatureUrl: row.headmaster_signature_url || ''
  };
}

async function annualExamTeacherCanAccessStudent(env, session, studentId) {
  if (session.userType === 'admin') return true;
  if (session.userType !== 'guru') return false;
  const classes = await sbRows(env, 'student_classes', { student_id:`eq.${studentId}`, teacher_id:`eq.${session.userID}`, limit:'1' });
  if (classes.length) return true;
  const students = await sbRows(env, 'students', { student_id:`eq.${studentId}`, limit:'1' });
  return Boolean(students[0] && String(students[0].teacher_id || '') === String(session.userID || ''));
}

async function annualExamSignatureForTeacher(env, teacherName) {
  const name = String(teacherName || '').trim();
  if (!name) return { url:'', name:'' };
  const rows = await sbRows(env, 'learning_progress', { teacher_name_snapshot:`eq.${name}`, order:'last_updated_at.desc.nullslast,created_at.desc', limit:'25' });
  const row = rows.find(x => x.teacher_signature_url) || rows[0] || null;
  return row ? { url:row.teacher_signature_url || '', name:row.teacher_signature_name || name } : { url:'', name };
}

async function annualExamHeadmasterSignature(env, studentId) {
  let rows = await sbRows(env, 'learning_progress', { student_id:`eq.${studentId}`, order:'last_updated_at.desc.nullslast,created_at.desc', limit:'25' });
  let row = rows.find(x => x.headmaster_signature_url || x.headmaster_name) || null;
  if (!row) {
    rows = await sbRows(env, 'learning_progress', { order:'last_updated_at.desc.nullslast,created_at.desc', limit:'100' });
    row = rows.find(x => x.headmaster_signature_url || x.headmaster_name) || null;
  }
  return {
    name: row?.headmaster_name || 'Faisal Rahmat Permana, S.Sn., M.Pd',
    url: row?.headmaster_signature_url || ''
  };
}

async function listAnnualExamsSupabase(env, session) {
  const params = { active:'eq.true', order:'exam_date.desc,created_at.desc' };
  if (session.userType === 'siswa') { params.student_public_id = `eq.${session.userID}`; params.published = 'eq.true'; }
  if (session.userType === 'guru') params.teacher_id = `eq.${session.userID}`;
  const rows = await sbRows(env, 'annual_exam_assessments', params);
  return rows.map(mapAnnualExamRow);
}

async function getAnnualExamSupabase(env, session, examId) {
  if (!examId) throw new Error('ID ujian tidak ditemukan.');
  const rows = await sbRows(env, 'annual_exam_assessments', { exam_id:`eq.${examId}`, active:'eq.true', limit:'1' });
  const row = rows[0];
  if (!row) throw new Error('Data ujian tidak ditemukan.');
  if (session.userType === 'siswa') {
    if (String(row.student_public_id || '') !== String(session.userID || '') || row.published !== true) throw new Error('Sertifikat ini belum tersedia untuk akun Anda.');
  } else if (session.userType === 'guru') {
    const owner = String(row.teacher_id || '') === String(session.userID || '');
    if (!owner && !(await annualExamTeacherCanAccessStudent(env, session, String(row.student_public_id || '')))) throw new Error('Anda tidak memiliki akses ke hasil ujian ini.');
  }
  return mapAnnualExamRow(row);
}

// Annual Exam save handler is implemented in the v2 block near the end of this file.


async function publishAnnualExamSupabase(env, session, examId) {
  const exam = await getAnnualExamSupabase(env, session, examId);
  const response = await supabaseRest(env, `/rest/v1/annual_exam_assessments?exam_id=eq.${encodeURIComponent(examId)}`, { method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify({published:true,published_at:new Date().toISOString(),published_by_id:session.userID||null,published_by_name:session.userName||'',updated_at:new Date().toISOString()}) });
  return { success:true, message:'Hasil ujian dan sertifikat berhasil dikirim ke akun siswa.' };
}

async function deleteAnnualExamSupabase(env, session, examId) {
  await getAnnualExamSupabase(env, session, examId);
  await supabaseRest(env, `/rest/v1/annual_exam_assessments?exam_id=eq.${encodeURIComponent(examId)}`, { method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify({active:false,published:false,updated_at:new Date().toISOString()}) });
  return { success:true, message:'Hasil ujian berhasil diarsipkan.' };
}

function hasSupabaseConfig(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2,'0')).join('');
}

function generateInitialPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(12); crypto.getRandomValues(bytes);
  let out = 'LmC-';
  for (let i=0;i<bytes.length;i++) out += alphabet[bytes[i] % alphabet.length];
  out += '-7';
  return out;
}

function weekdayIndexId(dayName) {
  const map={minggu:0,ahad:0,senin:1,selasa:2,rabu:3,kamis:4,jumat:5,"jum'at":5,sabtu:6};
  return map[String(dayName||'').trim().toLowerCase()] ?? null;
}
function sameYearMonthIso(iso, year, monthIndex){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return !!m && Number(m[1])===year && Number(m[2])===monthIndex+1;
}
function countWeekdayInMonth(year, monthIndex, weekday){
  if (weekday == null) return 0; let total=0; const days=new Date(year,monthIndex+1,0).getDate();
  for(let d=1;d<=days;d++) if(new Date(year,monthIndex,d).getDay()===weekday) total++;
  return total;
}
function calculateMonthlyExpectedClasses(schedules, overrides, studentId) {
  const now=new Date();
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).formatToParts(now);
  const year=Number(parts.find(p=>p.type==='year')?.value || now.getUTCFullYear());
  const month=Number(parts.find(p=>p.type==='month')?.value || (now.getUTCMonth()+1))-1;
  let total=(Array.isArray(schedules)?schedules:[]).filter(x=>String(x.status||'Aktif').toLowerCase()==='aktif').reduce((sum,row)=>sum+countWeekdayInMonth(year,month,weekdayIndexId(row.day_name||row.hari)),0);
  for(const row of (Array.isArray(overrides)?overrides:[])){
    if(String(row.status||'Aktif').toLowerCase()!=='aktif') continue;
    if(studentId && String(row.absent_student_id||'')!==String(studentId)) continue;
    const originalInMonth=sameYearMonthIso(row.original_date,year,month);
    const makeupInMonth=sameYearMonthIso(row.makeup_date,year,month);
    if(originalInMonth && row.makeup_date && !makeupInMonth) total=Math.max(0,total-1);
    if(!originalInMonth && makeupInMonth) total+=1;
  }
  return Math.max(0,total);
}

async function verifyLoginSupabaseRpc(env, args) {
  const [rawRole, rawUsername, rawPassword] = args;
  const role = String(rawRole || '').trim().toLowerCase();
  const username = String(rawUsername || '').trim();
  const password = String(rawPassword || '');

  if (!['admin','guru','siswa'].includes(role)) {
    return { success:false, message:'Tipe pengguna tidak valid.' };
  }
  if (!username || !password) {
    return { success:false, message:'Username dan password wajib diisi.' };
  }

  // LOGIN v4: Supabase-only.
  // The SQL function is optimized so PostgreSQL first isolates ONE account,
  // then runs bcrypt crypt() only for that candidate. This avoids the old
  // statement-timeout caused by crypt() being evaluated across many rows.
  const response = await fetch(
    `${stripTrailingSlash(env.SUPABASE_URL)}/rest/v1/rpc/verify_legacy_login`,
    {
      method:'POST',
      headers:{
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':'application/json',
        Accept:'application/json'
      },
      body:JSON.stringify({
        p_role: role,
        p_username: username,
        p_password: password
      })
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase login HTTP ${response.status}: ${text.slice(0,500)}`);
  }

  let rows;
  try { rows = JSON.parse(text); }
  catch (_) { throw new Error(`Supabase login non-JSON: ${text.slice(0,300)}`); }

  const account = Array.isArray(rows) ? rows[0] : null;
  if (!account) {
    return { success:false, message:'Username / Password salah.' };
  }

  return {
    success:true,
    userID:String(account.user_id || ''),
    userName:String(account.display_name || ''),
    userType:String(account.role || role),
    mustChangePassword:Boolean(account.must_change_password)
  };
}

async function verifyImportedPbkdf2Login(env, role, username, password, includeInternalState = false) {
  // The table is small, but keep the query limited to the selected role and
  // active accounts so login stays fast and predictable.
  const rows = await supabaseRest(env, `/rest/v1/auth_accounts?select=user_id,role,display_name,password_hash_b64,password_salt_b64,password_iterations,active&role=eq.${encodeURIComponent(role)}&active=eq.true&limit=500`);
  const key = String(username || '').trim().toLowerCase();
  const candidates = (Array.isArray(rows) ? rows : []).filter(row =>
    String(row.user_id || '').trim().toLowerCase() === key ||
    String(row.display_name || '').trim().toLowerCase() === key
  );

  let verificationCompleted = false;
  for (const row of candidates) {
    const hasPbkdf2 = Boolean(row.password_salt_b64 && row.password_hash_b64);
    if (!hasPbkdf2) continue;
    try {
      verificationCompleted = true;
      if (await verifyImportedPbkdf2Password(password, row.password_salt_b64, row.password_hash_b64, row.password_iterations)) {
        const result = {
          success:true,
          userID:String(row.user_id || ''),
          userName:String(row.display_name || ''),
          userType:String(row.role || role)
        };
        if (includeInternalState) {
          result.accountFound = true;
          result.verificationCompleted = true;
        }
        return result;
      }
    } catch (error) {
      console.error('PBKDF2 verification failed for account:', String(row.user_id || row.display_name || ''), error);
    }
  }

  const result = { success:false, message:'Username / Password salah.' };
  if (includeInternalState) {
    result.accountFound = candidates.length > 0;
    result.verificationCompleted = verificationCompleted;
  }
  return result;
}

function importedBase64ToBytes(value) {
  let normalized = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyImportedPbkdf2Password(password, saltB64, expectedB64, iterations) {
  if (!saltB64 || !expectedB64) return false;
  const expected = importedBase64ToBytes(expectedB64);
  if (!expected.length) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password || '')),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name:'PBKDF2',
    hash:'SHA-256',
    salt:importedBase64ToBytes(saltB64),
    iterations:Number(iterations || 210000)
  }, key, expected.length * 8);
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}


async function getGuruListSupabase(env) {
  const [teacherRows, classRows] = await Promise.all([
    supabaseRest(env, '/rest/v1/teachers?select=teacher_id,name,email,phone,instrument,status,photo_url&order=name.asc'),
    supabaseRest(env, '/rest/v1/student_classes?select=teacher_id,teacher_name_snapshot,instrument,status').catch(error => {
      console.warn('Teacher directory class fallback unavailable:', error);
      return [];
    })
  ]);

  // Build one complete teacher directory from the canonical teachers table plus
  // teacher snapshots already attached to active/legacy student classes.  This
  // keeps exam examiner selection complete even if a teacher row has not yet
  // been migrated into `teachers` but is already used by class records.
  const byKey = new Map();
  const upsert = (item) => {
    const id = String(item.id || '').trim();
    const name = String(item.nama || '').trim();
    if (!name) return;
    const key = id ? `id:${id}` : `name:${name.toLowerCase()}`;
    const existingByName = [...byKey.values()].find(x => String(x.nama || '').trim().toLowerCase() === name.toLowerCase());
    const existing = byKey.get(key) || existingByName || null;
    const instruments = new Set(
      String(existing?.instrumen || item.instrumen || '')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    );
    if (item.instrumen) instruments.add(String(item.instrumen).trim());
    const next = {
      id: existing?.id || id,
      nama: existing?.nama || name,
      email: existing?.email || String(item.email || ''),
      noHp: existing?.noHp || String(item.noHp || ''),
      instrumen: [...instruments].filter(Boolean).join(', ') || 'Musik',
      status: existing?.status || String(item.status || 'Aktif'),
      foto: existing?.foto || String(item.foto || '')
    };
    if (existingByName && !byKey.has(key)) {
      for (const [existingKey, value] of byKey.entries()) {
        if (value === existingByName) byKey.delete(existingKey);
      }
    }
    byKey.set(next.id ? `id:${next.id}` : `name:${next.nama.toLowerCase()}`, next);
  };

  for (const row of (Array.isArray(teacherRows) ? teacherRows : [])) {
    upsert({
      id: row.teacher_id,
      nama: row.name,
      email: row.email,
      noHp: row.phone,
      instrumen: row.instrument,
      status: row.status,
      foto: row.photo_url
    });
  }

  for (const row of (Array.isArray(classRows) ? classRows : [])) {
    const status = String(row.status || '').trim().toLowerCase();
    if (status && ['nonaktif','keluar','selesai','inactive'].includes(status)) continue;
    upsert({
      id: row.teacher_id,
      nama: row.teacher_name_snapshot,
      instrumen: row.instrument,
      status: 'Aktif'
    });
  }

  return [...byKey.values()].sort((a,b) => String(a.nama).localeCompare(String(b.nama), 'id'));
}

async function mirrorTeacherMutationToSupabase(env, method, args, gasResult) {
  if (!hasSupabaseConfig(env)) throw new Error('Konfigurasi Supabase belum lengkap.');

  if (method === 'deleteGuru') {
    const teacherId = String(args[0] || '').trim();
    if (!teacherId) return;

    await supabaseRpc(env, 'legacy_delete_teacher', {
      p_teacher_id: teacherId
    });
    return;
  }

  const payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
  const teacherId = method === 'addGuru'
    ? String(gasResult.guruID || payload.guruID || '').trim()
    : String(payload.originalGuruID || payload.guruID || '').trim();

  if (!teacherId) throw new Error('Guru ID hasil Apps Script kosong.');

  // Photo is not changed by addGuru/updateGuru in the current Apps Script flow.
  // Passing null tells the SQL function to preserve an existing photo.
  await supabaseRpc(env, 'legacy_upsert_teacher', {
    p_teacher_id: teacherId,
    p_name: String(payload.nama || '').trim(),
    p_email: String(payload.email || '').trim(),
    p_phone: String(payload.noHp || '').trim(),
    p_instrument: String(payload.instrumen || '').trim(),
    p_status: String(payload.status || 'Aktif').trim(),
    p_photo_url: null,
    p_password: payload.password ? String(payload.password) : null
  });
}

async function supabaseRest(env, path, options = {}) {
  const response = await fetch(`${stripTrailingSlash(env.SUPABASE_URL)}${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  if (!text) return null;
  try { return JSON.parse(text); }
  catch (_) { throw new Error(`Supabase non-JSON response: ${text.slice(0, 300)}`); }
}

async function supabaseRpc(env, functionName, payload) {
  return supabaseRest(env, `/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload || {})
  });
}



async function patchStudentClassDatesFromPayload(env, studentId, payload) {
  const classes = Array.isArray(payload?.kelasList) ? payload.kelasList : [];
  if (!studentId || !classes.length) return;
  const rows = await sbRows(env, 'student_classes', { student_id:`eq.${studentId}`, order:'created_at.asc' });
  const used = new Set();
  for (let index = 0; index < classes.length; index += 1) {
    const item = classes[index] || {};
    const startedOn = String(item.tglMulai || item.tglDaftar || (index === 0 ? payload.tglDaftar : '') || '').trim();
    const endedOn = String(item.tglSelesai || item.tglKeluar || (index === 0 ? payload.tglKeluar : '') || '').trim();
    if (!startedOn && !endedOn) continue;
    let row = null;
    const classId = String(item.kelasSiswaID || '').trim();
    if (classId) row = rows.find(candidate => String(candidate.class_id || '') === classId) || null;
    if (!row) {
      row = rows.find(candidate => {
        if (used.has(String(candidate.class_id || ''))) return false;
        const sameInstrument = String(candidate.instrument || '').trim().toLowerCase() === String(item.instrumen || '').trim().toLowerCase();
        const sameTeacher = item.guruID
          ? String(candidate.teacher_id || '') === String(item.guruID || '')
          : String(candidate.teacher_name_snapshot || '').trim().toLowerCase() === String(item.guru || '').trim().toLowerCase();
        const sameGrade = !item.grade || String(candidate.grade || '').trim().toLowerCase() === String(item.grade || '').trim().toLowerCase();
        return sameInstrument && sameTeacher && sameGrade;
      }) || null;
    }
    if (!row) row = rows[index] || null;
    if (!row?.class_id) continue;
    used.add(String(row.class_id));
    const patch = {};
    if (startedOn) patch.started_on = startedOn;
    if (endedOn) patch.ended_on = endedOn;
    await supabaseRest(env, `/rest/v1/student_classes?class_id=eq.${encodeURIComponent(row.class_id)}`, {
      method:'PATCH',
      headers:{'Content-Type':'application/json', Prefer:'return=minimal'},
      body:JSON.stringify(patch)
    });
  }
}

async function mirrorStudentMutationToSupabase(env, method, args, gasResult) {
  if (!hasSupabaseConfig(env)) throw new Error('Konfigurasi Supabase belum lengkap.');

  if (method === 'deleteSiswa') {
    const studentName = String(args[0] || '').trim();
    if (!studentName) return;

    await supabaseRpc(env, 'legacy_delete_student', {
      p_student_name: studentName
    });
    return;
  }

  const payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
  const studentId = String(
    gasResult.siswaID ||
    payload.siswaID ||
    ''
  ).trim();

  if (!studentId) throw new Error('SiswaID hasil Apps Script kosong.');

  const classes = Array.isArray(payload.kelasList) && payload.kelasList.length
    ? payload.kelasList
    : [{
        kelasSiswaID: '',
        instrumen: payload.instrumen || 'Gitar',
        guru: payload.guru || '',
        guruID: payload.guruID || '',
        grade: payload.kelas || '',
        status: payload.status || 'Aktif'
      }];

  const normalizedClasses = classes.map((item, index) => ({
    class_id: String(item.kelasSiswaID || '').trim(),
    ordinal: index + 1,
    instrument: String(item.instrumen || '').trim(),
    teacher_id: String(item.guruID || '').trim(),
    teacher_name: String(item.guru || '').trim(),
    grade: String(item.grade || item.kelas || '').trim(),
    status: String(item.status || payload.status || 'Aktif').trim(),
    started_on: String(item.tglMulai || item.tglDaftar || payload.tglDaftar || '').trim() || null,
    ended_on: String(payload.tglKeluar || '').trim() || null
  }));

  await supabaseRpc(env, 'legacy_upsert_student', {
    p_student_id: studentId,
    p_name: String(payload.nama || '').trim(),
    p_grade: String(payload.kelas || '').trim(),
    p_email: String(payload.email || '').trim(),
    p_phone: String(payload.noHp || '').trim(),
    p_registered_on: String(payload.tglDaftar || '').trim() || null,
    p_status: String(payload.status || 'Aktif').trim(),
    p_instrument: String(payload.instrumen || '').trim(),
    p_teacher_id: String(payload.guruID || '').trim() || null,
    p_teacher_name: String(payload.guru || '').trim(),
    p_left_on: String(payload.tglKeluar || '').trim() || null,
    p_classes: normalizedClasses,
    p_replace_classes: String(payload.currentUserType || '').toLowerCase() === 'admin' || method === 'addSiswaCombined',
    p_initial_password: null
  });
}


async function syncStudentSchedulesFromAppsScript(env, session, studentName) {
  const raw = await gasRpc(env, 'getDashboardData', [session.userID, session.userType]);
  const dashboard = parseDashboardPayload(raw);

  if (!dashboard || dashboard.success !== true || !Array.isArray(dashboard.jadwal)) {
    throw new Error('Dashboard Apps Script tidak menyediakan snapshot jadwal.');
  }

  const needle = String(studentName || '').trim().toLowerCase();
  const schedules = dashboard.jadwal
    .filter(item => String(item.namaSiswa || '').trim().toLowerCase() === needle)
    .map(item => ({
      schedule_id: String(item.jadwalID || '').trim(),
      student_name: String(item.namaSiswa || '').trim(),
      day_name: String(item.hari || '').trim(),
      start_time: normalizeApiTime(item.jamMulai),
      end_time: normalizeApiTime(item.jamSelesai),
      teacher_name: String(item.guru || '').trim(),
      room: String(item.ruangan || '').trim(),
      status: String(item.status || 'Aktif').trim(),
      instrument: String(item.instrumen || 'Gitar').trim()
    }))
    .filter(item => item.schedule_id);

  await supabaseRpc(env, 'legacy_sync_student_schedules', {
    p_student_name: studentName,
    p_schedules: schedules
  });
}

async function mirrorScheduleMutationToSupabase(env, method, args) {
  if (method === 'deleteJadwal') {
    const scheduleId = String(args[0] || '').trim();
    if (!scheduleId) return;

    await supabaseRpc(env, 'legacy_delete_schedule', {
      p_schedule_id: scheduleId
    });
    return;
  }

  const payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
  const scheduleId = String(payload.jadwalID || '').trim();
  if (!scheduleId) throw new Error('JadwalID kosong.');

  await supabaseRpc(env, 'legacy_upsert_schedule', {
    p_schedule_id: scheduleId,
    p_student_id: String(payload.siswaID || '').trim() || null,
    p_student_name: String(payload.namaSiswa || '').trim(),
    p_day_name: String(payload.hari || '').trim(),
    p_start_time: normalizeApiTime(payload.jamMulai),
    p_end_time: normalizeApiTime(payload.jamSelesai),
    p_teacher_id: String(payload.guruID || '').trim() || null,
    p_teacher_name: String(payload.guru || '').trim(),
    p_room: String(payload.ruangan || '').trim(),
    p_status: String(payload.status || 'Aktif').trim(),
    p_instrument: String(payload.instrumen || 'Gitar').trim()
  });
}

function parseDashboardPayload(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;

  try { return JSON.parse(raw); }
  catch (_) { return null; }
}

function normalizeApiTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return raw;
  return `${String(match[1]).padStart(2,'0')}:${match[2]}:${match[3] || '00'}`;
}


async function syncStudentAttendanceFromAppsScript(env, session, studentName) {
  const raw = await gasRpc(env, 'getDashboardData', [session.userID, session.userType]);
  const dashboard = parseDashboardPayload(raw);

  if (!dashboard || dashboard.success !== true || !Array.isArray(dashboard.absensiList)) {
    throw new Error('Dashboard Apps Script tidak menyediakan snapshot absensi.');
  }

  const needle = String(studentName || '').trim().toLowerCase();

  const rows = dashboard.absensiList
    .filter(item => String(item.namaSiswa || '').trim().toLowerCase() === needle)
    .map(item => ({
      attendance_id: String(item.absensiID || '').trim(),
      student_name: String(item.namaSiswa || '').trim(),
      attendance_date: normalizeLegacyDate(item.tanggal),
      meeting_number: toNullableInteger(item.pertemuanKe),
      status: String(item.status || '').trim(),
      material: String(item.materi || ''),
      song: String(item.lagu || ''),
      notes: String(item.catatan || ''),
      teacher_signature_data: String(item.tandaTangan || ''),
      teacher_name: String(item.guruCatat || '').trim(),
      student_signature_data: String(item.ttdSiswa || '')
    }))
    .filter(item => item.attendance_id && item.attendance_date);

  if (!rows.length) {
    // Nothing to mirror. Do not delete existing rows here because a teacher dashboard
    // may only contain attendance that teacher is allowed to see.
    return;
  }

  await supabaseRpc(env, 'legacy_upsert_student_attendance_batch', {
    p_student_name: studentName,
    p_rows: rows
  });
}

function toNullableInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}


async function syncTasksFromAppsScript(env, session, payload) {
  const requestedTaskId = String(payload.tugasID || '').trim();
  const requestedStudentId = String(payload.siswaID || '').trim();
  const requestedStudentName = String(payload.namaSiswa || '').trim();

  // getTugasData is an internal Apps Script helper and is not exposed by the
  // RPC allowlist. The student's dashboard is already an allowed RPC and
  // contains the canonical tugasList, including the TGS-* ID generated by GAS.
  //
  // For student submission, session.userID is the correct student.
  // For teacher/admin task creation, use the target student's ID/name.
  const studentIdentifier =
    session.userType === 'siswa'
      ? session.userID
      : (requestedStudentId || requestedStudentName);

  if (!studentIdentifier) {
    throw new Error('Identitas siswa untuk sinkronisasi tugas tidak ditemukan.');
  }

  const rawDashboard = await gasRpc(env, 'getDashboardData', [
    studentIdentifier,
    'siswa'
  ]);

  const dashboard = parseDashboardPayload(rawDashboard);
  if (!dashboard || dashboard.success !== true || !Array.isArray(dashboard.tugasList)) {
    throw new Error('Dashboard siswa Apps Script tidak menyediakan tugasList.');
  }

  const tasks = dashboard.tugasList;
  let selected = tasks;

  if (requestedTaskId) {
    selected = tasks.filter(item =>
      String(item.tugasID || '').trim() === requestedTaskId
    );
  } else {
    // addTugasCombined does not return TugasID. Narrow to the newly-created
    // title when possible; otherwise use this student's task list.
    const requestedTitle = String(payload.judulTugas || '').trim().toLowerCase();

    if (requestedTitle) {
      selected = tasks.filter(item =>
        String(item.judulTugas || '').trim().toLowerCase() === requestedTitle
      );
    }

    // getTugasData returns newest-first. If multiple historical tasks have the
    // same title, only mirror the newest matching task here.
    if (selected.length > 1) selected = [selected[0]];
  }

  const rows = selected
    .map(normalizeTaskForSupabase)
    .filter(row => row.assignment_id);

  if (!rows.length) {
    throw new Error(
      'Tugas berhasil di Apps Script tetapi tidak ditemukan di dashboard siswa untuk sinkronisasi.'
    );
  }

  await supabaseRpc(env, 'legacy_upsert_assignments_batch', {
    p_rows: rows
  });
}

function normalizeTaskForSupabase(item) {
  const materialFiles = Array.isArray(item.materialAttachments) ? item.materialAttachments : [];
  const answerFiles = Array.isArray(item.answerAttachments) ? item.answerAttachments : [];

  const firstMaterial = materialFiles.find(file => file && file.kind !== 'youtube') || {};
  const firstAnswer = answerFiles[0] || {};

  return {
    assignment_id: String(item.tugasID || '').trim(),
    student_id: String(item.siswaID || '').trim() || null,
    student_name: String(item.namaSiswa || '').trim(),
    title: String(item.judulTugas || ''),
    description: String(item.deskripsi || ''),
    deadline: normalizeApiDate(item.deadline),
    material_file_url: String(item.fileMateriUrl || firstMaterial.url || ''),
    status: String(item.status || 'Belum Dikerjakan'),
    sent_on: normalizeApiDate(item.tanggalKirimSiswa),
    answer_file_url: String(item.fileJawabanUrl || firstAnswer.url || ''),
    answer_file_name: String(item.fileJawabanName || firstAnswer.name || ''),
    teacher_id: String(item.guruID || '').trim() || null,
    teacher_name: String(item.guru || '').trim(),
    assignment_type: String(item.tipeTugas || 'Campuran'),
    material_file_name: String(firstMaterial.name || ''),
    material_file_type: String(firstMaterial.type || ''),
    material_download_url: String(firstMaterial.downloadUrl || ''),
    attachments_json: materialFiles.length ? JSON.stringify(materialFiles) : '',
    answer_text: String(item.jawabanTeks || ''),
    answer_file_type: String(firstAnswer.type || ''),
    answer_download_url: String(firstAnswer.downloadUrl || ''),
    answer_json: answerFiles.length ? JSON.stringify(answerFiles) : '',
    created_on: normalizeApiDate(item.tanggalDibuat),
    youtube_url: String(item.youtubeUrl || '')
  };
}

function normalizeApiDate(value) {
  const raw = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}


async function syncLearningProgressFromAppsScript(env, payload, progressId) {
  const studentIdentifier =
    String(payload.siswaID || '').trim() ||
    String(payload.namaSiswa || '').trim();

  if (!studentIdentifier) {
    throw new Error('Identitas siswa progress tidak ditemukan.');
  }

  if (!progressId) {
    throw new Error('ProgressID hasil Apps Script kosong.');
  }

  // getLearningProgressData is an internal helper. Use the already-allowed
  // student dashboard, which contains learningProgressList.
  const rawDashboard = await gasRpc(env, 'getDashboardData', [
    studentIdentifier,
    'siswa'
  ]);

  const dashboard = parseDashboardPayload(rawDashboard);

  if (
    !dashboard ||
    dashboard.success !== true ||
    !Array.isArray(dashboard.learningProgressList)
  ) {
    throw new Error('Dashboard siswa tidak menyediakan learningProgressList.');
  }

  const item = dashboard.learningProgressList.find(row =>
    String(row.progressID || '').trim() === progressId
  );

  if (!item) {
    throw new Error(`Progress ${progressId} tidak ditemukan di dashboard siswa.`);
  }

  await supabaseRpc(env, 'legacy_upsert_learning_progress', {
    p_row: normalizeLearningProgressForSupabase(item)
  });
}

function normalizeLearningProgressForSupabase(item) {
  return {
    progress_id: String(item.progressID || '').trim(),
    student_id: String(item.siswaID || '').trim() || null,
    student_name: String(item.namaSiswa || '').trim(),
    class_name: String(item.kelas || '').trim(),
    level: String(item.level || '').trim(),
    period: String(item.periode || '').trim(),
    period_type: String(item.tipePeriode || 'Bulanan').trim(),
    period_start: normalizeMonthToDate(item.periodeMulai),
    period_end: normalizeMonthToDate(item.periodeSelesai),

    overall_progress: clampProgress(item.overallProgress),

    material_status: String(item.materiStatus || 'Belum Dimulai'),
    material_progress: clampProgress(item.materiProgress),
    material_notes: String(item.materiCatatan || ''),

    technique_status: String(item.teknikStatus || 'Belum Dimulai'),
    technique_progress: clampProgress(item.teknikProgress),
    technique_notes: String(item.teknikCatatan || ''),

    theory_status: String(item.teoriStatus || 'Belum Dimulai'),
    theory_progress: clampProgress(item.teoriProgress),
    theory_notes: String(item.teoriCatatan || ''),

    repertoire_status: String(item.repertoireStatus || 'Belum Dimulai'),
    repertoire_progress: clampProgress(item.repertoireProgress),
    repertoire_notes: String(item.repertoireCatatan || ''),

    practice_status: String(item.practiceStatus || 'Belum Dimulai'),
    practice_progress: clampProgress(item.practiceProgress),
    practice_notes: String(item.practiceCatatan || ''),

    performance_status: String(item.performanceStatus || 'Belum Dimulai'),
    performance_progress: clampProgress(item.performanceProgress),
    performance_notes: String(item.performanceCatatan || ''),

    evaluation_status: String(item.evaluasiStatus || 'Belum Dimulai'),
    evaluation_progress: clampProgress(item.evaluasiProgress),
    evaluation_notes: String(item.evaluasiCatatan || ''),

    strengths: String(item.kelebihan || ''),
    needs_improvement: String(item.perluDitingkatkan || ''),
    next_target: String(item.targetBerikutnya || ''),

    teacher_id: String(item.guruID || '').trim() || null,
    teacher_name: String(item.guru || '').trim(),

    teacher_signature_url: String(item.guruSignatureUrl || ''),
    teacher_signature_name: String(item.guruSignatureName || ''),
    headmaster_name: String(item.kepalaSekolahNama || ''),
    headmaster_signature_url: String(item.kepalaSekolahSignatureUrl || ''),
    headmaster_signature_name: String(item.kepalaSekolahSignatureName || '')
  };
}

function normalizeMonthToDate(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function clampProgress(value) {
  const n = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(100, n));
}


async function getAdminDashboardSnapshot(env, session) {
  const raw = await gasRpc(env, 'getDashboardData', [
    session.userID,
    'admin'
  ]);

  const dashboard = parseDashboardPayload(raw);

  if (!dashboard || dashboard.success !== true) {
    throw new Error('Snapshot dashboard admin Apps Script tidak tersedia.');
  }

  return dashboard;
}

async function syncReplacementSchedulesFromAppsScript(env, session) {
  const dashboard = await getAdminDashboardSnapshot(env, session);
  const list = Array.isArray(dashboard.jadwalPenggantiList)
    ? dashboard.jadwalPenggantiList
    : [];

  const rows = list
    .map(item => ({
      replacement_id: String(item.penggantiID || '').trim(),
      schedule_id: String(item.jadwalID || '').trim() || null,
      student_id: String(item.siswaID || '').trim() || null,
      student_name: String(item.namaSiswa || '').trim(),
      reason: String(item.alasan || ''),
      scheduled_date: normalizeLegacyDate(item.tanggalPelaksanaan),
      start_time: normalizeApiTime(item.jamMulai),
      end_time: normalizeApiTime(item.jamSelesai),
      teacher_id: String(item.guruID || '').trim() || null,
      teacher_name: String(item.guru || '').trim(),
      room: String(item.ruangan || ''),
      status: String(item.status || 'Aktif')
    }))
    .filter(row => row.replacement_id);

  if (!rows.length) return;

  await supabaseRpc(env, 'legacy_upsert_replacement_schedules_batch', {
    p_rows: rows
  });
}

async function syncAnnouncementsFromAppsScript(env, session) {
  const dashboard = await getAdminDashboardSnapshot(env, session);
  const list = Array.isArray(dashboard.pengumumanList)
    ? dashboard.pengumumanList
    : [];

  const rows = list
    .map(item => ({
      announcement_id: String(item.pengumumanID || '').trim(),
      title: String(item.judul || ''),
      target: String(item.target || ''),
      target_detail: String(item.targetDetail || ''),
      body: String(item.isi || ''),
      creator_name: String(item.pembuat || ''),
      creator_id: String(item.pembuatID || '').trim() || null,
      sent_date: normalizeLegacyDate(item.tanggalKirim),
      status: String(item.status || 'Terbit'),
      target_student_id: String(item.targetSiswaID || '').trim() || null
    }))
    .filter(row => row.announcement_id);

  if (!rows.length) return;

  await supabaseRpc(env, 'legacy_upsert_announcements_batch', {
    p_rows: rows
  });
}

async function syncTeacherAttendanceFromAppsScript(env, session) {
  const dashboard = await getAdminDashboardSnapshot(env, session);
  const list = Array.isArray(dashboard.teacherAttendanceList)
    ? dashboard.teacherAttendanceList
    : [];

  const rows = list
    .map(item => ({
      teacher_attendance_id: String(item.absensiGuruID || '').trim(),
      teacher_id: String(item.guruID || '').trim() || null,
      teacher_name: String(item.namaGuru || '').trim(),
      attendance_date: normalizeLegacyDate(item.tanggal),
      status: String(item.status || ''),
      check_in: normalizeApiTime(item.jamMasuk),
      check_out: normalizeApiTime(item.jamKeluar),
      notes: String(item.catatan || ''),
      recorded_by: String(item.dicatatOleh || ''),
      signature_data: String(item.tandaTangan || '')
    }))
    .filter(row => row.teacher_attendance_id && row.attendance_date);

  if (!rows.length) return;

  await supabaseRpc(env, 'legacy_upsert_teacher_attendance_batch', {
    p_rows: rows
  });
}

function normalizeLegacyDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dmy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;

  return null;
}


// =========================================================
// PHASE 9 — SUPABASE DASHBOARD
// =========================================================

async function getLiveAnnouncementsSupabase(env, session) {
  const announcements = await sbRowsSafe(env, 'announcements', {
    order:'sent_at.desc.nullslast,created_at.desc',
    limit:'100'
  });

  if (session.userType === 'admin') {
    return { success:true, items:activeAnnouncementsForRole(announcements, 'admin', null, new Set(), new Set()), syncedAt:new Date().toISOString() };
  }

  if (session.userType === 'siswa') {
    const students = await sbRows(env, 'students', { student_id:`eq.${session.userID}`, limit:'1' });
    const student = students[0] || null;
    return { success:true, items:activeAnnouncementsForRole(announcements, 'siswa', student, new Set(), new Set()), syncedAt:new Date().toISOString() };
  }

  if (session.userType === 'guru') {
    const [teachers, classes] = await Promise.all([
      sbRows(env, 'teachers', { teacher_id:`eq.${session.userID}`, limit:'1' }),
      sbRows(env, 'student_classes', { teacher_id:`eq.${session.userID}`, status:'eq.Aktif', select:'student_id' })
    ]);
    const teacher = teachers[0] || null;
    const ids = [...new Set(classes.map(row => String(row.student_id || '').trim()).filter(Boolean))];
    const idSet = new Set(ids.map(v => v.toLowerCase()));
    const nameSet = new Set();
    if (ids.length) {
      // Only needed for legacy announcements that stored a student name instead of target_student_id.
      const students = await sbRowsSafe(env, 'students', { student_id:`in.(${ids.map(v => `\"${String(v).replace(/\"/g,'')}\"`).join(',')})`, select:'student_id,name' });
      students.forEach(row => nameSet.add(String(row.name || '').trim().toLowerCase()));
    }
    return { success:true, items:activeAnnouncementsForRole(announcements, 'guru', null, idSet, nameSet, teacher), syncedAt:new Date().toISOString() };
  }

  return { success:true, items:[], syncedAt:new Date().toISOString() };
}


async function getLiveModuleDataSupabase(env, session, requestedModules) {
  const allowed = new Set(['announcements','attendance','assignments','progress','schedules','teacher_attendance','repertoire','exams','practice']);
  const modules = [...new Set((Array.isArray(requestedModules) ? requestedModules : []).map(x => String(x || '').trim()).filter(x => allowed.has(x)))];
  const out = { success:true, syncedAt:new Date().toISOString() };
  if (!modules.length) return out;

  let teacherStudentIds = null;
  async function getTeacherStudentIds() {
    if (teacherStudentIds) return teacherStudentIds;
    if (session.userType !== 'guru') return [];
    const [classes, schedules] = await Promise.all([
      sbRowsSafe(env, 'student_classes', { select:'student_id', teacher_id:`eq.${session.userID}` }),
      sbRowsSafe(env, 'schedules', { select:'student_id', teacher_id:`eq.${session.userID}` })
    ]);
    teacherStudentIds = [...new Set([...classes,...schedules].map(x => String(x.student_id || '').trim()).filter(Boolean))];
    return teacherStudentIds;
  }
  function inFilter(ids) {
    const clean = (ids || []).map(x => String(x).replace(/[(),"]/g,'')).filter(Boolean);
    return clean.length ? `in.(${clean.join(',')})` : '';
  }

  await Promise.all(modules.map(async module => {
    if (module === 'announcements') {
      const result = await getLiveAnnouncementsSupabase(env, session);
      out.announcements = result.items || [];
      return;
    }
    if (module === 'attendance') {
      const baseParams = { order:'attendance_date.desc,created_at.desc' };
      if (session.userType === 'siswa') baseParams.student_id = `eq.${session.userID}`;
      if (session.userType === 'guru') {
        const ids = await getTeacherStudentIds();
        if (!ids.length) { out.attendance = []; return; }
        baseParams.student_id = inFilter(ids);
      }

      // Keep cross-device attendance sync small. Most rows contain large base64
      // signatures; sending all of them after every mutation made Admin/Guru lag.
      // The lightweight snapshot supplies every current ID (so deletes are detected),
      // while only the newest rows carry signature payloads. Existing signatures are
      // preserved by the client during reconciliation.
      const lightweightSelect = [
        'attendance_id','student_id','student_name_snapshot','teacher_id','teacher_name_snapshot',
        'attendance_date','meeting_number','status','material','song','notes','created_at'
      ].join(',');
      const [snapshotRows, recentFullRows] = await Promise.all([
        sbPagedRows(env, 'student_attendance', { ...baseParams, select:lightweightSelect }),
        sbRows(env, 'student_attendance', { ...baseParams, select:'*', limit:'40' })
      ]);
      const recentById = new Map(recentFullRows.map(row => [String(row.attendance_id || ''), row]));
      out.attendance = snapshotRows.map(row => mapAttendance(recentById.get(String(row.attendance_id || '')) || row));
      return;
    }
    if (module === 'assignments') {
      const params = { order:'created_at.desc' };
      if (session.userType === 'siswa') params.student_id = `eq.${session.userID}`;
      if (session.userType === 'guru') params.teacher_id = `eq.${session.userID}`;
      out.assignments = (await sbPagedRows(env, 'assignments', params)).map(mapAssignment);
      return;
    }
    if (module === 'progress') {
      const params = { order:'last_updated_at.desc.nullslast,created_at.desc' };
      if (session.userType === 'siswa') params.student_id = `eq.${session.userID}`;
      if (session.userType === 'guru') params.teacher_id = `eq.${session.userID}`;
      out.progress = (await sbPagedRows(env, 'learning_progress', params)).map(mapProgress);
      return;
    }
    if (module === 'schedules') {
      const params = { order:'created_at.asc' };
      if (session.userType === 'siswa') params.student_id = `eq.${session.userID}`;
      if (session.userType === 'guru') params.teacher_id = `eq.${session.userID}`;
      const [rows, replacements, overrides] = await Promise.all([
        sbPagedRows(env, 'schedules', params),
        session.userType === 'siswa' ? sbRowsSafe(env,'replacement_schedules',{student_id:`eq.${session.userID}`,order:'scheduled_date.desc.nullslast,created_at.desc'}) :
          session.userType === 'guru' ? sbRowsSafe(env,'replacement_schedules',{teacher_id:`eq.${session.userID}`,order:'scheduled_date.desc.nullslast,created_at.desc'}) :
          sbRowsSafe(env,'replacement_schedules',{order:'scheduled_date.desc.nullslast,created_at.desc'}),
        getScheduleOverrideRowsForSession(env, session).catch(()=>[])
      ]);
      out.schedules = (await filterOperationalScheduleRowsFromDb(env, rows)).map(row => mapSchedule(row, true));
      out.replacements = replacements.map(mapReplacement);
      out.scheduleOverrides = overrides.map(mapScheduleOverride);
      return;
    }
    if (module === 'teacher_attendance') {
      const params = { order:'attendance_date.desc,created_at.desc' };
      if (session.userType === 'guru') params.teacher_id = `eq.${session.userID}`;
      if (session.userType === 'siswa') { out.teacherAttendance = []; return; }
      out.teacherAttendance = (await sbPagedRowsSafe(env, 'teacher_attendance', params)).map(mapTeacherAttendance);
      return;
    }
    if (module === 'repertoire') {
      const result = await getRepertoireDataSupabase(env, session);
      out.repertoire = result.items || result.repertoire || [];
      return;
    }
    if (module === 'practice') {
      const result = await getPracticeHubDataSupabase(env, session);
      out.practiceResources = result.resources || [];
      out.mediaEvaluations = result.evaluations || [];
      return;
    }
    if (module === 'exams') {
      out.exams = await listAnnualExamsSupabase(env, session);
    }
  }));
  return out;
}

function isOperationalStudentStatus(value) {
  return String(value || '').trim().toLowerCase() === 'aktif';
}

function filterOperationalScheduleRows(rows, students) {
  const activeIds = new Set((students || []).filter(student => isOperationalStudentStatus(student.status)).map(student => String(student.student_id || '').trim()).filter(Boolean));
  const activeNames = new Set((students || []).filter(student => isOperationalStudentStatus(student.status)).map(student => String(student.name || '').trim().toLowerCase()).filter(Boolean));
  return (rows || []).filter(row => {
    const studentId = String(row.student_id || '').trim();
    if (studentId) return activeIds.has(studentId);
    const name = String(row.student_name_snapshot || '').trim().toLowerCase();
    return !!name && activeNames.has(name);
  });
}

async function filterOperationalScheduleRowsFromDb(env, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];
  const ids = [...new Set(list.map(row => String(row.student_id || '').trim()).filter(Boolean))];
  const students = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).map(value => value.replace(/[(),"]/g, '')).filter(Boolean);
    if (!chunk.length) continue;
    students.push(...await sbRows(env, 'students', { select:'student_id,name,status', student_id:`in.(${chunk.join(',')})` }));
  }
  if (list.some(row => !String(row.student_id || '').trim())) {
    students.push(...await sbPagedRows(env, 'students', { select:'student_id,name,status' }));
  }
  const unique = new Map();
  students.forEach(student => unique.set(String(student.student_id || student.name || ''), student));
  return filterOperationalScheduleRows(list, [...unique.values()]);
}

async function getDashboardDataSupabase(env, session) {
  if (session.userType === 'siswa') return buildStudentDashboardSupabase(env, session);
  if (session.userType === 'guru') return buildTeacherDashboardSupabase(env, session);
  if (session.userType === 'admin') return buildAdminDashboardSupabase(env, session);
  throw new Error('Tipe pengguna dashboard tidak valid.');
}

async function sbRows(env, table, params = {}) {
  const query = new URLSearchParams();
  query.set('select', params.select || '*');

  for (const [key, value] of Object.entries(params)) {
    if (key === 'select' || value === null || value === undefined || value === '') continue;
    query.set(key, String(value));
  }

  const result = await supabaseRest(env, `/rest/v1/${table}?${query.toString()}`);
  return Array.isArray(result) ? result : [];
}

async function sbRowsSafe(env, table, params = {}) {
  try {
    return await sbRows(env, table, params);
  } catch (error) {
    console.error(`Optional Supabase table ${table} failed:`, error);
    return [];
  }
}

async function sbPagedRowsSafe(env, table, params = {}, maxRows = 10000) {
  try {
    return await sbPagedRows(env, table, params, maxRows);
  } catch (error) {
    console.error(`Optional paged Supabase table ${table} failed:`, error);
    return [];
  }
}

async function sbPagedRows(env, table, params = {}, maxRows = 10000) {
  const pageSize = 1000;
  const all = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const rows = await sbRows(env, table, { ...params, limit:String(pageSize), offset:String(offset) });
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}


async function sbAllRows(env, table, select = '*') {
  const pageSize = 1000;
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const rows = await sbRows(env, table, { select, limit:String(pageSize), offset:String(offset) });
    all.push(...rows);
    if (rows.length < pageSize) break;
    if (offset > 100000) throw new Error(`Backup ${table} terlalu besar untuk export sekali jalan.`);
  }
  return all;
}

async function getAdminExportBackupSupabase(env, dataset) {
  const configs = {
    students:{ table:'students' },
    teachers:{ table:'teachers' },
    schedules:{ table:'schedules' },
    attendance:{ table:'student_attendance' },
    progress:{ table:'learning_progress' },
    repertoire:{ table:'student_repertoire' },
    exams:{ table:'annual_exam_assessments' },
    overrides:{ table:'schedule_overrides' }
  };
  const key = String(dataset || '').trim();
  const config = configs[key];
  if (!config) throw new Error('Kategori export tidak valid.');
  const rows = await sbAllRows(env, config.table, '*');
  return { success:true, dataset:key, table:config.table, count:rows.length, exportedAt:new Date().toISOString(), rows };
}

function auditActionMeta(method) {
  const map = {
    addGuru:['Guru','Tambah Guru','Guru'], updateGuru:['Guru','Update Guru','Guru'], deleteGuru:['Guru','Hapus Guru','Guru'],
    addSiswaCombined:['Siswa','Tambah Siswa','Siswa'], updateSiswa:['Siswa','Update Siswa','Siswa'], deleteSiswa:['Siswa','Hapus Siswa','Siswa'], deleteExitedStudentRecord:['Siswa','Hapus Arsip Siswa','Siswa'],
    updateJadwal:['Jadwal','Update Jadwal','Jadwal'], deleteJadwal:['Jadwal','Hapus Jadwal','Jadwal'], saveScheduleOverride:['Jadwal','Simpan Jadwal Pergantian','Jadwal Pergantian'], deleteScheduleOverride:['Jadwal','Hapus Jadwal Pergantian','Jadwal Pergantian'],
    recordAbsensi:['Absensi','Simpan Absensi Siswa','Absensi'], updateAbsensi:['Absensi','Update Absensi Siswa','Absensi'], deleteAbsensi:['Absensi','Hapus Absensi Siswa','Absensi'], recordTeacherAttendance:['Absensi Guru','Simpan Absensi Guru','Absensi Guru'], deleteTeacherAttendance:['Absensi Guru','Hapus Absensi Guru','Absensi Guru'],
    addTugasCombined:['Tugas','Tambah Tugas','Tugas'], submitTugasJawaban:['Tugas','Kumpulkan Tugas','Tugas'], deleteTugas:['Tugas','Hapus Tugas','Tugas'],
    saveLearningProgress:['Progress','Simpan Progress Belajar','Progress'], deleteLearningProgress:['Progress','Hapus Progress Belajar','Progress'],
    saveStudentRepertoire:['Repertoire','Simpan Repertoire','Repertoire'], deleteStudentRepertoire:['Repertoire','Hapus Repertoire','Repertoire'],
    saveAnnualExam:['Ujian','Simpan Penilaian Ujian','Ujian'], publishAnnualExam:['Ujian','Terbitkan Sertifikat','Ujian'], deleteAnnualExam:['Ujian','Hapus Hasil Ujian','Ujian'],
    addPengumuman:['Pengumuman','Tambah Pengumuman','Pengumuman'], deletePengumuman:['Pengumuman','Hapus Pengumuman','Pengumuman'],
    publishStudent360Report:['Laporan','Kirim Laporan Siswa','Laporan'], deleteStudent360Report:['Laporan','Hapus Laporan Siswa','Laporan'],
    updateUserPhoto:['Profil','Update Foto Profil','Profil'], updateSelfProfile:['Profil','Update Profil','Profil']
  };
  const row = map[method] || ['Sistem',method,'Sistem'];
  return { category:row[0], label:row[1], entityType:row[2] };
}

function sanitizeAuditValue(value, depth = 0) {
  if (depth > 3) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0,20).map(item => sanitizeAuditValue(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key,val] of Object.entries(value)) {
      if (/(password|secret|token|signature|tanda.?tangan|dataurl|file|attachment|answer|jawaban)/i.test(key)) continue;
      out[key] = sanitizeAuditValue(val, depth + 1);
    }
    return out;
  }
  const text = String(value);
  return text.length > 500 ? text.slice(0,500) + '…' : value;
}

function auditEntityInfo(method, args, result) {
  const p = args && args[0] && typeof args[0] === 'object' ? args[0] : {};
  const candidates = [
    ['siswaID','namaSiswa'],['studentID','nama'],['studentId','studentName'],['guruID','namaGuru'],['teacherID','teacherName'],
    ['jadwalID','namaSiswa'],['overrideID','namaSiswa'],['repertoireID','judulLagu'],['progressID','namaSiswa'],['tugasID','judulTugas'],
    ['examID','studentName'],['pengumumanID','judul'],['absensiID','namaSiswa'],['absensiGuruID','namaGuru']
  ];
  let entityId = '', entityName = '';
  for (const [idKey,nameKey] of candidates) {
    if (!entityId && p[idKey]) entityId = String(p[idKey]);
    if (!entityName && p[nameKey]) entityName = String(p[nameKey]);
  }
  if (!entityId && typeof args?.[0] === 'string') entityId = String(args[0]);
  const r = result && typeof result === 'object' ? result : {};
  entityId = entityId || String(r.repertoireID || r.progressID || r.examID || r.penggantiID || r.absensiID || r.absensiGuruID || r.assignmentID || '');
  const nested = r.item || r.progress || r.exam || r.override || r.assignment || r.announcement || r.teacher || r.student || {};
  entityName = entityName || String(nested.judulLagu || nested.song_title || nested.namaSiswa || nested.student_name_snapshot || nested.name || nested.title || nested.judul || '');
  return { entityId, entityName };
}

async function recordAuditLog(env, session, method, args, result) {
  if (!session || !AUDIT_METHODS.has(method)) return;
  const meta = auditActionMeta(method);
  const entity = auditEntityInfo(method,args,result);
  const clean = sanitizeAuditValue(args && args[0] !== undefined ? args[0] : args);
  const summaryParts = [];
  if (entity.entityName) summaryParts.push(entity.entityName);
  if (clean && typeof clean === 'object' && !Array.isArray(clean)) {
    const instrument = clean.instrumen || clean.instrument;
    const date = clean.tanggal || clean.tanggalPelaksanaan || clean.originalDate || clean.examDate;
    if (instrument) summaryParts.push(String(instrument));
    if (date) summaryParts.push(String(date));
  }
  const body = {
    actor_role:String(session.userType || ''), actor_id:String(session.userID || '') || null, actor_name:String(session.userName || ''),
    action:method, category:meta.category, entity_type:meta.entityType, entity_id:entity.entityId || null, entity_name:entity.entityName || null,
    summary:summaryParts.join(' • ') || meta.label,
    metadata:{ label:meta.label, payload:clean }
  };
  await supabaseRest(env, '/rest/v1/audit_logs', { method:'POST', headers:{'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify(body) });
}

async function getAdminAuditLogsSupabase(env, session) {
  if (session.userType !== 'admin') throw new Error('Akses audit log hanya untuk Admin.');
  const rows = await sbRows(env, 'audit_logs', { order:'created_at.desc', limit:'500' });
  return { success:true, items:rows.map(row => ({
    auditID:row.audit_id || '', actorRole:row.actor_role || '', actorID:row.actor_id || '', actorName:row.actor_name || '',
    action:row.action || '', actionLabel:(row.metadata && row.metadata.label) || auditActionMeta(row.action || '').label,
    category:row.category || 'Sistem', entityType:row.entity_type || '', entityID:row.entity_id || '', entityName:row.entity_name || '',
    summary:row.summary || '', createdAt:row.created_at || ''
  })) };
}

function intervalsOverlap(startA,endA,startB,endB) {
  const toMin = value => { const m=String(value||'').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1])*60+Number(m[2]) : null; };
  const a=toMin(startA), b=toMin(endA), c=toMin(startB), d=toMin(endB);
  if ([a,b,c,d].some(v=>v===null)) return false;
  return a < d && c < b;
}

async function buildAdminDataQuality(env) {
  const [students,teachers,classes,schedules,overrides,progress] = await Promise.all([
    sbPagedRows(env,'students',{order:'name.asc'}), sbPagedRows(env,'teachers',{order:'name.asc'}), sbPagedRows(env,'student_classes',{order:'created_at.asc'}),
    sbPagedRows(env,'schedules',{order:'day_name.asc,start_time.asc'}), sbPagedRows(env,'schedule_overrides',{status:'eq.Aktif',order:'original_date.desc'}),
    sbPagedRows(env,'learning_progress',{order:'last_updated_at.desc.nullslast,created_at.desc'})
  ]);
  const findings=[];
  const add=(severity,category,title,detail,entityName,section)=>findings.push({id:`DQ-${findings.length+1}`,severity,category,title,detail,entityName:entityName||'',section:section||'section-siswa'});
  const activeStudents=students.filter(s=>String(s.status||'').toLowerCase()==='aktif');
  const activeClasses=classes.filter(c=>String(c.status||'Aktif').toLowerCase()==='aktif');
  const activeSchedules=schedules.filter(s=>String(s.status||'Aktif').toLowerCase()==='aktif');
  const classByStudent=new Map(); activeClasses.forEach(c=>{const k=String(c.student_id||''); if(!classByStudent.has(k))classByStudent.set(k,[]); classByStudent.get(k).push(c);});
  const scheduleByStudent=new Map(); activeSchedules.forEach(s=>{const k=String(s.student_id||''); if(!scheduleByStudent.has(k))scheduleByStudent.set(k,[]); scheduleByStudent.get(k).push(s);});
  for(const student of activeStudents){
    const sid=String(student.student_id||'');
    if(!(classByStudent.get(sid)||[]).length) add('critical','Siswa','Siswa aktif tanpa kelas','Siswa berstatus Aktif tetapi belum memiliki student_classes aktif.',student.name,'section-siswa');
    if(!(scheduleByStudent.get(sid)||[]).length) add('warning','Jadwal','Siswa aktif tanpa jadwal','Siswa aktif belum memiliki jadwal pelajaran aktif.',student.name,'section-jadwal');
    if(!String(student.email||'').trim()) add('info','Siswa','Email siswa kosong','Data kontak email belum diisi.',student.name,'section-siswa');
    if(!String(student.phone||'').trim()) add('info','Siswa','No. HP siswa kosong','Data nomor HP/WhatsApp belum diisi.',student.name,'section-siswa');
  }
  for(const c of activeClasses){
    const name=c.student_name_snapshot||c.student_id||'-';
    if(!String(c.teacher_id||c.teacher_name_snapshot||'').trim()) add('critical','Kelas','Kelas tanpa guru','Kelas aktif belum memiliki guru pengajar.',`${name} • ${c.instrument||'Musik'}`,'section-siswa');
    if(!c.started_on) add('info','Kelas','Tanggal mulai kelas kosong','Tanggal mulai enrollment belum tersedia.',`${name} • ${c.instrument||'Musik'}`,'section-siswa');
    const hasSchedule=(scheduleByStudent.get(String(c.student_id||''))||[]).some(s=>String(s.instrument||'').trim().toLowerCase()===String(c.instrument||'').trim().toLowerCase());
    if(!hasSchedule) add('warning','Jadwal','Kelas belum punya jadwal','Enrollment aktif belum memiliki jadwal untuk instrumen tersebut.',`${name} • ${c.instrument||'Musik'}`,'section-jadwal');
  }
  for(const s of activeSchedules){
    if(!String(s.room||'').trim()) add('warning','Jadwal','Ruangan jadwal kosong','Jadwal aktif belum memiliki ruangan.',`${s.student_name_snapshot||'-'} • ${s.day_name||''} ${formatDbTime(s.start_time)}`,'section-jadwal');
    if(!String(s.teacher_id||s.teacher_name_snapshot||'').trim()) add('critical','Jadwal','Jadwal tanpa guru','Jadwal aktif belum memiliki guru pengajar.',s.student_name_snapshot||'-','section-jadwal');
  }
  for(let i=0;i<activeSchedules.length;i++) for(let j=i+1;j<activeSchedules.length;j++){
    const a=activeSchedules[i], b=activeSchedules[j];
    if(String(a.day_name||'').toLowerCase()!==String(b.day_name||'').toLowerCase()) continue;
    if(!intervalsOverlap(a.start_time,a.end_time,b.start_time,b.end_time)) continue;
    const sameTeacher=String(a.teacher_id||'') && String(a.teacher_id||'')===String(b.teacher_id||'');
    const sameRoom=String(a.room||'').trim() && String(a.room||'').trim().toLowerCase()===String(b.room||'').trim().toLowerCase();
    if(sameTeacher) add('critical','Bentrok','Bentrok jadwal guru',`${a.day_name} ${formatDbTime(a.start_time)}-${formatDbTime(a.end_time)} bertabrakan untuk guru ${a.teacher_name_snapshot||'-'}.`,`${a.student_name_snapshot||'-'} ↔ ${b.student_name_snapshot||'-'}`,'section-jadwal');
    if(sameRoom) add('critical','Bentrok','Bentrok ruangan',`${a.day_name} ${formatDbTime(a.start_time)}-${formatDbTime(a.end_time)} menggunakan ruangan ${a.room} pada waktu bertabrakan.`,`${a.student_name_snapshot||'-'} ↔ ${b.student_name_snapshot||'-'}`,'section-jadwal');
  }
  for(const o of overrides){
    if(!o.makeup_date) add('warning','Pergantian','Make-up belum ditentukan','Pergantian sudah aktif tetapi tanggal make-up siswa yang berhalangan belum diisi.',o.absent_student_name_snapshot||'-','section-pengganti');
  }
  const latestProgress=new Map();
  for(const row of progress){ const sid=String(row.student_id||''); if(sid && !latestProgress.has(sid)) latestProgress.set(sid,row); }
  const staleCutoff=Date.now()-60*86400000;
  for(const student of activeStudents){
    const row=latestProgress.get(String(student.student_id||''));
    if(!row) add('warning','Progress','Belum ada Progress Belajar','Siswa aktif belum memiliki laporan Progress Belajar.',student.name,'section-learning-progress');
    else { const d=new Date(row.last_updated_at||row.created_at||0); if(!Number.isNaN(d.getTime()) && d.getTime()<staleCutoff) add('info','Progress','Progress lebih dari 60 hari','Progress terakhir sudah lebih dari 60 hari dan perlu ditinjau.',student.name,'section-learning-progress'); }
  }
  const summary={total:findings.length,critical:findings.filter(x=>x.severity==='critical').length,warning:findings.filter(x=>x.severity==='warning').length,info:findings.filter(x=>x.severity==='info').length};
  return {findings,summary,students,teachers,classes,schedules,overrides};
}

async function getAdminDataQualitySupabase(env, session) {
  if (session.userType !== 'admin') throw new Error('Data Quality hanya untuk Admin.');
  const data=await buildAdminDataQuality(env);
  return {success:true,findings:data.findings,summary:data.summary};
}

async function getAdminControlCenterSupabase(env, session) {
  if (session.userType !== 'admin') throw new Error('Dashboard kontrol hanya untuk Admin.');
  const quality=await buildAdminDataQuality(env);
  const day=jakartaWeekday();
  const activeSchedules=quality.schedules.filter(s=>String(s.status||'Aktif').toLowerCase()==='aktif' && String(s.day_name||'').trim().toLowerCase()===day);
  const activeTeachersToday=new Set(activeSchedules.map(s=>String(s.teacher_id||'')).filter(Boolean));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const attendance=await sbRows(env,'teacher_attendance',{attendance_date:`eq.${today}`});
  const attended=new Set(attendance.map(a=>String(a.teacher_id||'')).filter(Boolean));
  const missingTeacherAttendance=[...activeTeachersToday].filter(id=>!attended.has(id)).length;
  const pendingMakeup=quality.overrides.filter(o=>String(o.status||'Aktif').toLowerCase()==='aktif' && !o.makeup_date).length;
  const actions=[];
  if(pendingMakeup) actions.push({severity:'warning',title:'Make-up belum ditentukan',detail:'Lengkapi jadwal make-up pada Jadwal Pergantian.',count:pendingMakeup,section:'section-pengganti'});
  if(missingTeacherAttendance) actions.push({severity:'critical',title:'Guru terjadwal belum absensi',detail:'Cek kehadiran guru yang memiliki kelas hari ini.',count:missingTeacherAttendance,section:'section-absensi-guru'});
  if(quality.summary.critical) actions.push({severity:'critical',title:'Data prioritas tinggi',detail:'Ada bentrok atau data inti yang belum lengkap.',count:quality.summary.critical,section:'section-data-quality'});
  if(quality.summary.warning) actions.push({severity:'warning',title:'Data perlu diperiksa',detail:'Ada data yang sebaiknya dirapikan.',count:quality.summary.warning,section:'section-data-quality'});
  return {success:true,summary:{classesToday:activeSchedules.length,activeTeachersToday:activeTeachersToday.size,pendingMakeup,missingTeacherAttendance,qualityIssues:quality.summary.total,criticalQualityIssues:quality.summary.critical},actions};
}

function formatDbTime(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : raw;
}

function formatDbDateDmy(value) {
  const raw = String(value || '').slice(0,10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
}

function formatDbDateIso(value) {
  const raw = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0,10) : '';
}

function formatMonthKey(value) {
  const raw = formatDbDateIso(value);
  return raw ? raw.slice(0,7) : '';
}

function uniqueText(values) {
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

function buildYouTubeMeta(url) {
  const text = String(url || '').trim();
  let videoId = '';
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /[?&]v=([a-zA-Z0-9_-]{11})(?:[&#]|$)/i,
    /youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) { videoId = match[1]; break; }
  }
  if (!videoId) return { videoId:'', url:'', embedUrl:'', thumbnailUrl:'' };
  return {
    videoId,
    url:`https://www.youtube.com/watch?v=${videoId}`,
    embedUrl:`https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl:`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function mapClassRow(row, schedules) {
  const schedule = schedules.find(s =>
    String(s.student_id || '') === String(row.student_id || '') &&
    String(s.instrument || '').trim().toLowerCase() === String(row.instrument || '').trim().toLowerCase() &&
    (
      (row.teacher_id && String(s.teacher_id || '') === String(row.teacher_id)) ||
      (!row.teacher_id && String(s.teacher_name_snapshot || '').trim().toLowerCase() === String(row.teacher_name_snapshot || '').trim().toLowerCase())
    )
  );

  return {
    kelasSiswaID: row.class_id || '',
    siswaID: row.student_id || '',
    namaSiswa: row.student_name_snapshot || '',
    instrumen: row.instrument || 'Gitar',
    guruID: row.teacher_id || '',
    guru: row.teacher_name_snapshot || '',
    grade: row.grade || 'Beginner',
    status: row.status || 'Aktif',
    tglMulai: formatDbDateIso(row.started_on),
    tglDaftar: formatDbDateIso(row.started_on),
    tglSelesai: formatDbDateIso(row.ended_on),
    jadwalID: schedule ? (schedule.schedule_id || '') : '',
    hari: schedule ? (schedule.day_name || '') : '',
    jamMulai: schedule ? formatDbTime(schedule.start_time) : '',
    jamSelesai: schedule ? formatDbTime(schedule.end_time) : '',
    ruangan: schedule ? (schedule.room || '') : ''
  };
}

function mapSchedule(row, includeStatus = true) {
  const item = {
    jadwalID: row.schedule_id || '',
    namaSiswa: row.student_name_snapshot || '',
    hari: row.day_name || '',
    jamMulai: formatDbTime(row.start_time),
    jamSelesai: formatDbTime(row.end_time),
    guru: row.teacher_name_snapshot || '',
    ruangan: row.room || '',
    instrumen: row.instrument || 'Gitar'
  };
  if (includeStatus) item.status = row.status || 'Aktif';
  return item;
}

function mapAttendance(row) {
  return {
    absensiID: row.attendance_id || '',
    namaSiswa: row.student_name_snapshot || '',
    tanggal: formatDbDateDmy(row.attendance_date),
    pertemuanKe: row.meeting_number ?? '',
    status: row.status || '',
    materi: row.material || '',
    lagu: row.song || '',
    catatan: row.notes || '',
    tandaTangan: row.teacher_signature_data || '',
    guruCatat: row.teacher_name_snapshot || '',
    ttdSiswa: row.student_signature_data || ''
  };
}

function mapAssignment(row) {
  const materialAttachments = parseJsonArray(row.attachments_json);
  const answerAttachments = parseJsonArray(row.answer_json);
  const youtube = buildYouTubeMeta(row.youtube_url || '');

  return {
    tugasID: row.assignment_id || '',
    siswaID: row.student_id || '',
    namaSiswa: row.student_name_snapshot || '',
    guruID: row.teacher_id || '',
    judulTugas: row.title || '',
    deskripsi: row.description || '',
    deadline: formatDbDateDmy(row.deadline),
    status: row.status || 'Belum Dikerjakan',
    tanggalKirimSiswa: formatDbDateDmy(row.sent_on),
    tanggalDibuat: formatDbDateDmy(row.created_on),
    tipeTugas: row.assignment_type || 'Campuran',
    fileMateriUrl: row.material_file_url || '',
    fileJawabanUrl: row.answer_file_url || '',
    fileJawabanName: row.answer_file_name || '',
    jawabanTeks: row.answer_text || '',
    youtubeUrl: youtube.url,
    youtubeVideoId: youtube.videoId,
    youtube,
    materialAttachments,
    answerAttachments
  };
}

function formatProgressUpdated(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone:'Asia/Jakarta',
      day:'2-digit',
      month:'short',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit',
      hour12:false
    }).format(date).replace(' pukul ', ', ');
  } catch (_) {
    return String(value);
  }
}

function mapProgress(row) {
  return {
    progressID: row.progress_id || '',
    siswaID: row.student_id || '',
    namaSiswa: row.student_name_snapshot || '',
    kelas: row.class_name || '',
    level: row.level || '',
    periode: row.period || '',
    tipePeriode: row.period_type || (/~/.test(String(row.period || '')) ? 'Tiga Bulan' : 'Bulanan'),
    periodeMulai: formatMonthKey(row.period_start),
    periodeSelesai: formatMonthKey(row.period_end),
    overallProgress: Number(row.overall_progress || 0),

    materiStatus: row.material_status || 'Belum Dimulai',
    materiProgress: Number(row.material_progress || 0),
    materiCatatan: row.material_notes || '',
    teknikStatus: row.technique_status || 'Belum Dimulai',
    teknikProgress: Number(row.technique_progress || 0),
    teknikCatatan: row.technique_notes || '',
    teoriStatus: row.theory_status || 'Belum Dimulai',
    teoriProgress: Number(row.theory_progress || 0),
    teoriCatatan: row.theory_notes || '',
    repertoireStatus: row.repertoire_status || 'Belum Dimulai',
    repertoireProgress: Number(row.repertoire_progress || 0),
    repertoireCatatan: row.repertoire_notes || '',
    practiceStatus: row.practice_status || 'Belum Dimulai',
    practiceProgress: Number(row.practice_progress || 0),
    practiceCatatan: row.practice_notes || '',
    performanceStatus: row.performance_status || 'Belum Dimulai',
    performanceProgress: Number(row.performance_progress || 0),
    performanceCatatan: row.performance_notes || '',
    evaluasiStatus: row.evaluation_status || 'Belum Dimulai',
    evaluasiProgress: Number(row.evaluation_progress || 0),
    evaluasiCatatan: row.evaluation_notes || '',
    kelebihan: row.strengths || '',
    perluDitingkatkan: row.needs_improvement || '',
    targetBerikutnya: row.next_target || '',
    guru: row.teacher_name_snapshot || '',
    guruID: row.teacher_id || '',
    guruSignatureUrl: row.teacher_signature_url || '',
    guruSignatureName: row.teacher_signature_name || '',
    kepalaSekolahNama: row.headmaster_name || '',
    kepalaSekolahSignatureUrl: row.headmaster_signature_url || '',
    kepalaSekolahSignatureName: row.headmaster_signature_name || '',
    lastUpdated: formatProgressUpdated(row.last_updated_at)
  };
}

function mapReplacement(row) {
  return {
    penggantiID: row.replacement_id || '',
    jadwalID: row.schedule_id || '',
    siswaID: row.student_id || '',
    guruID: row.teacher_id || '',
    namaSiswa: row.student_name_snapshot || '',
    alasan: row.reason || 'Lainnya',
    tanggalPelaksanaan: formatDbDateIso(row.scheduled_date),
    hariPelaksanaan: dayNameFromIsoJs(formatDbDateIso(row.scheduled_date)),
    jamMulai: formatDbTime(row.start_time),
    jamSelesai: formatDbTime(row.end_time),
    guru: row.teacher_name_snapshot || '',
    ruangan: row.room || '',
    status: row.status || 'Aktif'
  };
}

function mapScheduleOverride(row) {
  return {
    overrideID: row.override_id || '',
    jadwalID: row.original_schedule_id || '',
    tanggalAsli: formatDbDateIso(row.original_date),
    hariAsli: row.original_day_name || '',
    jamMulaiAsli: formatDbTime(row.original_start_time),
    jamSelesaiAsli: formatDbTime(row.original_end_time),
    guruAsliID: row.original_teacher_id || '',
    guruAsli: row.original_teacher_name_snapshot || '',
    ruanganAsli: row.original_room || '',
    instrumenAsli: row.original_instrument || '',
    siswaAsliID: row.absent_student_id || '',
    siswaAsli: row.absent_student_name_snapshot || '',
    siswaPenggantiID: row.slot_student_id || '',
    siswaPengganti: row.slot_student_name_snapshot || '',
    instrumenPengganti: row.slot_instrument || '',
    tanggalMakeup: formatDbDateIso(row.makeup_date),
    jamMulaiMakeup: formatDbTime(row.makeup_start_time),
    jamSelesaiMakeup: formatDbTime(row.makeup_end_time),
    guruMakeupID: row.makeup_teacher_id || '',
    guruMakeup: row.makeup_teacher_name_snapshot || '',
    ruanganMakeup: row.makeup_room || '',
    alasan: row.reason || '',
    catatan: row.notes || '',
    status: row.status || 'Aktif',
    dibuatOleh: row.created_by_name || ''
  };
}

function mapAnnouncement(row) {
  return {
    pengumumanID: row.announcement_id || '',
    judul: row.title || '',
    target: String(row.target || 'semua').toLowerCase(),
    targetDetail: row.target_detail || '',
    targetSiswaID: row.target_student_id || '',
    isi: row.body || '',
    pembuat: row.creator_name_snapshot || '',
    pembuatID: row.creator_id || '',
    tanggalKirim: formatDbDateDmy(row.sent_at),
    status: row.status || 'Terbit'
  };
}

function mapTeacherAttendance(row) {
  return {
    absensiGuruID: row.teacher_attendance_id || '',
    guruID: row.teacher_id || '',
    namaGuru: row.teacher_name_snapshot || '',
    tanggal: formatDbDateIso(row.attendance_date),
    status: row.status || '',
    jamMasuk: formatDbTime(row.check_in),
    jamKeluar: formatDbTime(row.check_out),
    catatan: row.notes || '',
    dicatatOleh: row.recorded_by || '',
    tandaTangan: row.signature_data || ''
  };
}

function mapRepertoire(row) {
  const youtube = buildYouTubeMeta(row.video_url || '');
  return {
    repertoireID: row.repertoire_id || '',
    siswaID: row.student_id || '',
    namaSiswa: row.student_name_snapshot || '',
    guruID: row.teacher_id || '',
    guru: row.teacher_name_snapshot || '',
    instrumen: row.instrument || 'Musik',
    judulLagu: row.song_title || '',
    composer: row.composer || '',
    keySignature: row.key_signature || '',
    level: row.level || '',
    progress: Number(row.progress_percent || 0),
    status: row.status || 'Belajar',
    tanggalMulai: formatDbDateIso(row.start_date),
    targetTampil: formatDbDateIso(row.target_date),
    tanggalTampilTerakhir: formatDbDateIso(row.last_performed_date),
    eventTampil: row.performance_event || '',
    videoUrl: row.video_url || '',
    youtube,
    catatan: row.notes || '',
    lastUpdated: formatProgressUpdated(row.updated_at || row.created_at)
  };
}

function dayNameFromIsoJs(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  const [y,m,d] = value.split('-').map(Number);
  return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][
    new Date(Date.UTC(y,m-1,d)).getUTCDay()
  ];
}

function jakartaWeekday() {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone:'Asia/Jakarta',
      weekday:'long'
    }).format(new Date()).toLowerCase();
  } catch (_) {
    return '';
  }
}

function activeAnnouncementsForRole(rows, role, student, teacherStudentIds, teacherStudentNames, teacher) {
  return rows
    .filter(row => {
      const status = String(row.status || 'Terbit').toLowerCase();
      if (status === 'draf' || status === 'nonaktif') return false;
      if (role === 'admin') return true;

      const target = String(row.target || 'semua').toLowerCase();
      if (target === 'semua') return true;

      if (role === 'siswa') {
        if (target === 'semua_siswa') return true;
        if (target !== 'siswa_tertentu') return false;
        const targetId = String(row.target_student_id || '').trim().toLowerCase();
        const detail = String(row.target_detail || '').trim().toLowerCase();
        return (
          (student && targetId && targetId === String(student.student_id || '').toLowerCase()) ||
          (student && !targetId && detail === String(student.name || '').trim().toLowerCase())
        );
      }

      if (role === 'guru') {
        if (target === 'semua_guru') return true;
        const detail = String(row.target_detail || '').trim().toLowerCase();
        if (target === 'guru_tertentu') {
          return Boolean(teacher) && (
            detail === String(teacher.teacher_id || '').trim().toLowerCase() ||
            detail === String(teacher.name || '').trim().toLowerCase()
          );
        }
        if (target !== 'siswa_tertentu') return false;
        const targetId = String(row.target_student_id || '').trim().toLowerCase();
        return (
          (targetId && teacherStudentIds.has(targetId)) ||
          (!targetId && teacherStudentNames.has(detail))
        );
      }

      return false;
    })
    .sort((a,b) => String(b.sent_at || '').localeCompare(String(a.sent_at || '')))
    .map(mapAnnouncement);
}



function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function resolveStudent360Student(env, identifier) {
  const value = String(identifier || '').trim();
  if (!value) return null;

  if (isUuidLike(value)) {
    const byDbId = await sbRows(env, 'students', { id:`eq.${value}`, limit:'1' });
    if (byDbId.length) return byDbId[0];
  }

  const byPublicId = await sbRows(env, 'students', {
    student_id:`eq.${value}`,
    limit:'1'
  });
  if (byPublicId.length) return byPublicId[0];

  const byName = await sbRows(env, 'students', {
    name:`eq.${value}`,
    limit:'1'
  });
  return byName[0] || null;
}

function mapStudent360Publication(row) {
  if (!row) return null;
  return {
    reportID: row.report_id || '',
    studentDbID: row.student_id || '',
    studentID: row.student_public_id || '',
    progressID: row.progress_id || '',
    signatureMode: row.signature_mode === 'manual' ? 'manual' : 'uploaded',
    sentAt: row.sent_at ? new Date(row.sent_at).toLocaleString('id-ID', { timeZone:'Asia/Jakarta' }) : '',
    sentAtRaw: row.sent_at || '',
    sentBy: row.sent_by_name || '',
    sentByID: row.sent_by_id || '',
    sentByRole: row.sent_by_role || ''
  };
}

async function student360Publications(env, studentPublicId) {
  const publicId = String(studentPublicId || '').trim();
  if (!publicId) return [];
  const rows = await sbRows(env, 'student_report_publications', {
    student_public_id:`eq.${publicId}`,
    active:'eq.true',
    order:'sent_at.desc'
  });
  return rows.map(mapStudent360Publication).filter(Boolean);
}

async function latestStudent360Publication(env, studentPublicId) {
  const rows = await student360Publications(env, studentPublicId);
  return rows[0] || null;
}

async function student360PublicationById(env, studentPublicId, reportId) {
  if (!reportId) return latestStudent360Publication(env, studentPublicId);
  const publicId = String(studentPublicId || '').trim();
  if (!publicId || !isUuidLike(reportId)) return null;
  const rows = await sbRows(env, 'student_report_publications', {
    report_id:`eq.${reportId}`,
    student_public_id:`eq.${publicId}`,
    active:'eq.true',
    limit:'1'
  });
  return mapStudent360Publication(rows[0] || null);
}

async function student360PublicationForStaff(env, session, reportId) {
  if (!reportId || !isUuidLike(reportId)) return null;
  const rows = await sbRows(env, 'student_report_publications', {
    report_id:`eq.${reportId}`,
    active:'eq.true',
    limit:'1'
  });
  const publication = mapStudent360Publication(rows[0] || null);
  if (!publication) return null;
  if (
    session.userType === 'guru' &&
    String(publication.sentByID || '').trim() !== String(session.userID || '').trim()
  ) {
    return null;
  }
  return publication;
}

async function publishStudent360ReportSupabase(env, session, studentId, progressId, signatureMode) {
  if (!studentId) throw new Error('Siswa untuk laporan belum dipilih.');

  // Reuse the existing access check before publishing.
  await buildStudent360ReportSupabase(env, session, studentId, { ignorePublication:true });

  const student = await resolveStudent360Student(env, studentId);
  if (!student || !student.student_id) {
    throw new Error('ID siswa untuk arsip laporan tidak ditemukan.');
  }

  const response = await supabaseRest(env, '/rest/v1/student_report_publications', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      Prefer:'return=representation'
    },
    body:JSON.stringify({
      student_id: null,
      student_public_id: String(student.student_id || '').trim(),
      progress_id: progressId || null,
      signature_mode: signatureMode === 'manual' ? 'manual' : 'uploaded',
      sent_by_id: session.userID || null,
      sent_by_name: session.userName || '',
      sent_by_role: session.userType || '',
      active: true
    })
  });

  const row = Array.isArray(response) ? response[0] : null;
  return {
    success:true,
    message:'Laporan berhasil dikirim ke akun siswa.',
    reportID: row && row.report_id ? row.report_id : ''
  };
}


async function deleteStudent360ReportSupabase(env, session, reportId) {
  if (!reportId || !isUuidLike(reportId)) throw new Error('ID laporan tidak valid.');

  const rows = await sbRows(env, 'student_report_publications', {
    report_id:`eq.${reportId}`,
    active:'eq.true',
    limit:'1'
  });

  const row = rows[0] || null;
  if (!row) throw new Error('Laporan tidak ditemukan atau sudah dihapus.');

  if (
    session.userType === 'guru' &&
    String(row.sent_by_id || '').trim() !== String(session.userID || '').trim()
  ) {
    throw new Error('Guru hanya dapat menghapus laporan yang dikirim sendiri.');
  }

  await supabaseRest(env, `/rest/v1/student_report_publications?report_id=eq.${encodeURIComponent(reportId)}`, {
    method:'PATCH',
    headers:{
      'Content-Type':'application/json',
      Prefer:'return=minimal'
    },
    body:JSON.stringify({ active:false })
  });

  return {
    success:true,
    message:'Laporan berhasil dihapus dari daftar laporan dan akun siswa.'
  };
}


async function buildStudent360ReportSupabase(env, session, identifier, options = {}) {
  if (!identifier) throw new Error('Identitas siswa tidak ditemukan.');

  const student = await resolveStudent360Student(env, identifier);
  if (!student) throw new Error('Data siswa tidak ditemukan di Supabase.');

  const studentId = String(student.student_id || '').trim();

  let publication = null;
  if (session.userType === 'siswa' && !options.ignorePublication) {
    if (String(session.userID || '').trim() !== studentId) {
      throw new Error('Anda tidak memiliki akses ke laporan siswa lain.');
    }
    publication = options.publicationId
      ? await student360PublicationById(env, studentId, options.publicationId)
      : await latestStudent360Publication(env, studentId);
    if (!publication) {
      throw new Error('Belum ada Laporan Lengkap yang dikirim oleh guru atau admin.');
    }
  } else if (options.publicationId) {
    publication = await student360PublicationById(env, studentId, options.publicationId);
    if (!publication) throw new Error('Riwayat laporan yang dipilih tidak ditemukan.');
  }

  if (session.userType === 'guru') {
    const allowedClasses = await sbRows(env, 'student_classes', {
      student_id:`eq.${studentId}`,
      teacher_id:`eq.${session.userID}`,
      limit:'1'
    });
    const legacyOwner = String(student.teacher_id || '') === String(session.userID || '');
    if (!allowedClasses.length && !legacyOwner) {
      throw new Error('Anda tidak memiliki akses ke laporan siswa ini.');
    }
  }

  const [classes, schedules, attendance, assignments, progressById] = await Promise.all([
    sbRows(env, 'student_classes', { student_id:`eq.${studentId}`, order:'created_at.asc' }),
    sbRows(env, 'schedules', { student_id:`eq.${studentId}`, order:'created_at.asc' }),
    sbRows(env, 'student_attendance', { student_id:`eq.${studentId}`, order:'attendance_date.asc,created_at.asc', limit:'180' }),
    sbRows(env, 'assignments', { student_id:`eq.${studentId}`, order:'created_at.asc', limit:'120' }),
    sbRows(env, 'learning_progress', { student_id:`eq.${studentId}`, order:'last_updated_at.desc.nullslast,created_at.desc', limit:'48' })
  ]);
  const progressByName = progressById.length ? [] : await sbRows(env, 'learning_progress', { student_name_snapshot:`eq.${student.name || ''}`, order:'last_updated_at.desc.nullslast,created_at.desc', limit:'48' });

  const progressMap = new Map();
  [...progressById, ...progressByName].forEach(row => {
    const key = String(row.progress_id || `${row.period || ''}:${row.student_name_snapshot || ''}`);
    if (!progressMap.has(key)) progressMap.set(key, row);
  });
  const progress = [...progressMap.values()].sort((a,b) =>
    String(b.last_updated_at || b.created_at || '').localeCompare(String(a.last_updated_at || a.created_at || ''))
  );

  const mappedClasses = classes.map(row => mapClassRow(row, schedules));
  const instruments = uniqueText(mappedClasses.map(x => x.instrumen));
  const grades = uniqueText(mappedClasses.map(x => x.grade));
  const teachers = uniqueText(mappedClasses.map(x => x.guru));

  const mappedProgress = progress.map(mapProgress);
  let latestProgress = mappedProgress[0] || null;
  if (publication && publication.progressID) {
    latestProgress = mappedProgress.find(item => String(item.progressID || '') === String(publication.progressID)) || latestProgress;
  }

  return {
    success:true,
    student:{
      siswaID:student.student_id || '',
      nama:student.name || '',
      email:student.email || '',
      noHp:student.phone || '',
      status:student.status || '',
      foto:student.photo_url || '',
      instrumen:instruments.join(', ') || student.instrument || 'Gitar',
      kelas:grades.join(', ') || student.grade || '',
      guru:teachers.join(', ') || student.teacher_name_snapshot || '-',
      tglDaftar:formatDbDateIso(student.registered_on),
      tglKeluar:formatDbDateIso(student.left_on),
      alasanKeluar:student.exit_reason || ''
    },
    classes:mappedClasses,
    schedules:schedules.map(row => mapSchedule(row, true)),
    attendance:attendance.map(mapAttendance),
    assignments:assignments.map(mapAssignment),
    progress:mappedProgress,
    latestProgress,
    publication
  };
}

async function getRepertoireDataSupabase(env, session) {
  let rows = [];
  if (session.userType === 'siswa') {
    rows = await sbRows(env, 'student_repertoire', { student_id:`eq.${session.userID}`, active:'eq.true', order:'target_date.asc.nullslast,updated_at.desc.nullslast,created_at.desc' });
  } else if (session.userType === 'guru') {
    const classes = await sbRows(env, 'student_classes', { teacher_id:`eq.${session.userID}` });
    const directStudents = await sbRows(env, 'students', { teacher_id:`eq.${session.userID}` });
    const allowedIds = new Set([
      ...classes.map(row => String(row.student_id || '').trim()).filter(Boolean),
      ...directStudents.map(row => String(row.student_id || '').trim()).filter(Boolean)
    ]);
    const allowedClassKeys = new Set(classes.map(row => `${String(row.student_id || '').trim()}|${String(row.instrument || '').trim().toLowerCase()}`));
    const allRows = await sbRows(env, 'student_repertoire', { active:'eq.true', order:'target_date.asc.nullslast,updated_at.desc.nullslast,created_at.desc' });
    rows = allRows.filter(row => {
      const studentId = String(row.student_id || '').trim();
      const instrument = String(row.instrument || '').trim().toLowerCase();
      if (allowedClassKeys.has(`${studentId}|${instrument}`)) return true;
      if (allowedIds.has(studentId) && !instrument) return true;
      return String(row.teacher_id || '').trim() === String(session.userID || '').trim();
    });
  } else if (session.userType === 'admin') {
    rows = await sbRows(env, 'student_repertoire', { active:'eq.true', order:'target_date.asc.nullslast,updated_at.desc.nullslast,created_at.desc' });
  } else {
    throw new Error('Akses repertoire tidak valid.');
  }

  return { success:true, items:rows.map(mapRepertoire) };
}

async function saveStudentRepertoireSupabase(env, session, payload) {
  if (!['guru','admin'].includes(session.userType)) throw new Error('Akses repertoire ditolak.');
  const repertoireId = String(payload.repertoireID || '').trim();
  if (!repertoireId && session.userType !== 'guru') throw new Error('Hanya guru yang dapat menambahkan repertoire baru.');
  const studentId = String(payload.siswaID || '').trim();
  if (!studentId) throw new Error('Siswa belum dipilih.');
  if (!(await annualExamTeacherCanAccessStudent(env, session, studentId))) throw new Error('Anda tidak memiliki akses ke siswa ini.');
  const students = await sbRows(env, 'students', { student_id:`eq.${studentId}`, limit:'1' });
  const student = students[0];
  if (!student) throw new Error('Data siswa tidak ditemukan.');

  let existing = null;
  if (repertoireId) {
    const existingRows = await sbRows(env, 'student_repertoire', { repertoire_id:`eq.${repertoireId}`, limit:'1' });
    existing = existingRows[0] || null;
    if (!existing) throw new Error('Data repertoire tidak ditemukan.');
    if (String(existing.student_id || '').trim() !== studentId) throw new Error('Repertoire tidak cocok dengan siswa yang dipilih.');
  }

  const classRows = await sbRows(env, 'student_classes', { student_id:`eq.${studentId}`, order:'created_at.asc' });
  const requestedInstrument = String(payload.instrumen || existing?.instrument || student.instrument || 'Musik').trim();
  const selectedClass = classRows.find(row => String(row.instrument || '').trim().toLowerCase() === requestedInstrument.toLowerCase()) || classRows[0] || null;
  const teacherId = session.userType === 'guru'
    ? String(session.userID || '').trim()
    : String(existing?.teacher_id || selectedClass?.teacher_id || student.teacher_id || '').trim();
  const teacherName = session.userType === 'guru'
    ? String(session.userName || '').trim()
    : String(existing?.teacher_name_snapshot || selectedClass?.teacher_name_snapshot || student.teacher_name_snapshot || '').trim();

  const normalizedStatus = ['belajar','siap tampil','dikuasai','sudah tampil'].includes(String(payload.status || '').trim().toLowerCase())
    ? String(payload.status || '').trim()
    : 'Belajar';

  const body = {
    student_id: studentId,
    student_name_snapshot: String(student.name || '').trim(),
    teacher_id: teacherId || null,
    teacher_name_snapshot: teacherName || null,
    instrument: requestedInstrument || 'Musik',
    song_title: String(payload.judulLagu || '').trim(),
    composer: String(payload.composer || '').trim(),
    key_signature: String(payload.keySignature || '').trim(),
    level: String(payload.level || '').trim(),
    progress_percent: Math.max(0, Math.min(100, Math.round(Number(payload.progress || 0) || 0))),
    status: normalizedStatus,
    start_date: formatDbDateIso(payload.tanggalMulai) || null,
    target_date: formatDbDateIso(payload.targetTampil) || null,
    last_performed_date: formatDbDateIso(payload.tanggalTampilTerakhir) || null,
    performance_event: String(payload.eventTampil || '').trim(),
    video_url: String(payload.videoUrl || '').trim(),
    notes: String(payload.catatan || '').trim(),
    active: true,
    updated_at: new Date().toISOString()
  };

  if (!body.song_title) throw new Error('Judul lagu wajib diisi.');

  let response;
  if (existing) {
    response = await supabaseRest(env, `/rest/v1/student_repertoire?repertoire_id=eq.${encodeURIComponent(repertoireId)}`, {
      method:'PATCH',
      headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
      body:JSON.stringify(body)
    });
  } else {
    response = await supabaseRest(env, '/rest/v1/student_repertoire', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Prefer:'return=representation' },
      body:JSON.stringify(body)
    });
  }
  const row = Array.isArray(response) ? response[0] : null;
  return {
    success:true,
    message: existing ? 'Repertoire berhasil diperbarui.' : 'Repertoire berhasil ditambahkan.',
    item: row ? mapRepertoire(row) : null
  };
}

async function deleteStudentRepertoireSupabase(env, session, payload) {
  if (!['guru','admin'].includes(session.userType)) throw new Error('Hanya guru atau admin yang dapat menghapus repertoire.');
  const repertoireId = String(payload.repertoireID || '').trim();
  if (!repertoireId) throw new Error('Repertoire ID tidak ditemukan.');
  const rows = await sbRows(env, 'student_repertoire', { repertoire_id:`eq.${repertoireId}`, limit:'1' });
  const row = rows[0];
  if (!row) throw new Error('Data repertoire tidak ditemukan.');
  if (!(await annualExamTeacherCanAccessStudent(env, session, String(row.student_id || '').trim()))) throw new Error('Anda tidak memiliki akses ke siswa ini.');
  await supabaseRest(env, `/rest/v1/student_repertoire?repertoire_id=eq.${encodeURIComponent(repertoireId)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
  return { success:true, message:'Repertoire berhasil dihapus.', repertoireID:repertoireId };
}


function mapPracticeResource(row) {
  return {
    resourceID:row.resource_id || '', studentID:row.student_id || '', studentName:row.student_name_snapshot || '',
    teacherID:row.teacher_id || '', teacherName:row.teacher_name_snapshot || '', instrument:row.instrument || '',
    title:row.title || '', description:row.description || '', youtubeUrl:row.youtube_url || '',
    attachments:Array.isArray(row.attachments) ? row.attachments : [], createdAt:row.created_at || '', updatedAt:row.updated_at || ''
  };
}
function mapMediaEvaluation(row) {
  const scores={tone:Number(row.tone_score||0),rhythm:Number(row.rhythm_score||0),tempo:Number(row.tempo_score||0),technique:Number(row.technique_score||0),expression:Number(row.expression_score||0)};
  const legacyAspects=[
    {key:'tone',label:'Tone',description:'Kualitas dan konsistensi bunyi.',score:scores.tone},
    {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme dan kestabilan pulse.',score:scores.rhythm},
    {key:'tempo',label:'Tempo',description:'Kestabilan tempo.',score:scores.tempo},
    {key:'technique',label:'Teknik',description:'Ketepatan dan kontrol teknik instrumen.',score:scores.technique},
    {key:'expression',label:'Ekspresi',description:'Musikalitas, dinamika, dan penghayatan.',score:scores.expression}
  ];
  const aspects=Array.isArray(row.score_aspects)&&row.score_aspects.length?row.score_aspects.map((x,i)=>({key:String(x?.key||`aspect_${i+1}`),label:String(x?.label||`Aspek ${i+1}`),description:String(x?.description||''),score:Math.max(0,Math.min(100,Number(x?.score||0)))})):legacyAspects;
  const averageScore=aspects.length?Math.round(aspects.reduce((sum,x)=>sum+Number(x.score||0),0)/aspects.length):0;
  return {
    evaluationID:row.evaluation_id || '', studentID:row.student_id || '', studentName:row.student_name_snapshot || '',
    teacherID:row.teacher_id || '', teacherName:row.teacher_name_snapshot || '', instrument:row.instrument || '', repertoireID:row.repertoire_id || '',
    sourceType:row.source_type || '', sourceID:row.source_id || '', sourceLabel:row.source_label || '',
    title:row.title || '', mediaUrl:row.media_url || '', mediaKind:row.media_kind || 'link', scores, aspects, averageScore,
    strength:row.strength || '', improvement:row.improvement || '', nextTarget:row.next_target || '',
    markers:Array.isArray(row.feedback_markers) ? row.feedback_markers : [], notes:row.notes || '', createdAt:row.created_at || '', updatedAt:row.updated_at || ''
  };
}
async function practiceAllowedStudentIds(env, session) {
  if (session.userType === 'siswa') return new Set([String(session.userID || '').trim()]);
  if (session.userType !== 'guru') return new Set();
  const [classes,direct] = await Promise.all([
    sbRows(env,'student_classes',{teacher_id:`eq.${session.userID}`}),
    sbRows(env,'students',{teacher_id:`eq.${session.userID}`})
  ]);
  return new Set([...classes.map(x=>x.student_id),...direct.map(x=>x.student_id)].map(v=>String(v||'').trim()).filter(Boolean));
}
async function getPracticeHubDataSupabase(env, session) {
  if (!['guru','siswa'].includes(session.userType)) throw new Error('Fitur Latihan Mandiri tersedia untuk guru dan siswa.');
  const ids=await practiceAllowedStudentIds(env,session);
  if (!ids.size) return {success:true,resources:[],evaluations:[]};
  const [resourceRows,evaluationRows,repertoireResult]=await Promise.all([
    sbRows(env,'practice_resources',{active:'eq.true',order:'updated_at.desc.nullslast,created_at.desc'}),
    sbRows(env,'media_evaluations',{active:'eq.true',order:'updated_at.desc.nullslast,created_at.desc'}),
    getRepertoireDataSupabase(env, session).catch(() => ({success:true,items:[]}))
  ]);
  const ownTeacher=String(session.userID||'').trim();
  const allow=row=>ids.has(String(row.student_id||'').trim()) && (session.userType==='siswa' || String(row.teacher_id||'').trim()===ownTeacher || ids.has(String(row.student_id||'').trim()));
  return {success:true,resources:resourceRows.filter(allow).map(mapPracticeResource),evaluations:evaluationRows.filter(allow).map(mapMediaEvaluation),repertoire:Array.isArray(repertoireResult.items)?repertoireResult.items:[]};
}
async function practiceStudentAndAccess(env,session,studentId) {
  if (session.userType !== 'guru') throw new Error('Hanya guru yang dapat mengubah Latihan Mandiri.');
  if (!studentId) throw new Error('Siswa belum dipilih.');
  if (!(await annualExamTeacherCanAccessStudent(env,session,studentId))) throw new Error('Anda tidak memiliki akses ke siswa ini.');
  const rows=await sbRows(env,'students',{student_id:`eq.${studentId}`,limit:'1'}); if(!rows[0])throw new Error('Data siswa tidak ditemukan.'); return rows[0];
}
async function savePracticeResourceSupabase(env,session,payload) {
  const studentId=String(payload.studentID||'').trim(); const student=await practiceStudentAndAccess(env,session,studentId);
  const resourceId=String(payload.resourceID||'').trim(); let existing=null;
  if(resourceId){const rows=await sbRows(env,'practice_resources',{resource_id:`eq.${resourceId}`,limit:'1'});existing=rows[0]||null;if(!existing)throw new Error('Materi latihan tidak ditemukan.');if(String(existing.teacher_id||'')!==String(session.userID||''))throw new Error('Materi ini dibuat oleh guru lain.');}
  const rawYoutube=String(payload.youtubeUrl||'').trim(); const yt=buildYouTubeMeta(rawYoutube); if(rawYoutube&&!yt.videoId)throw new Error('Link video harus berupa link YouTube yang valid.');
  const oldAttachments=Array.isArray(existing?.attachments)?existing.attachments:[]; const added=Array.isArray(payload.newAttachments)?payload.newAttachments:[];
  const body={student_id:studentId,student_name_snapshot:String(student.name||''),teacher_id:String(session.userID||''),teacher_name_snapshot:String(session.userName||''),instrument:String(payload.instrument||student.instrument||'Musik'),title:String(payload.title||'').trim(),description:String(payload.description||'').trim(),youtube_url:yt.url||'',attachments:[...oldAttachments,...added],active:true,updated_at:new Date().toISOString()};
  if(!body.title)throw new Error('Judul materi wajib diisi.');
  const response=existing?await supabaseRest(env,`/rest/v1/practice_resources?resource_id=eq.${encodeURIComponent(resourceId)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)}):await supabaseRest(env,'/rest/v1/practice_resources',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
  return {success:true,message:existing?'Materi latihan berhasil diperbarui.':'Materi latihan berhasil ditambahkan.',item:Array.isArray(response)&&response[0]?mapPracticeResource(response[0]):null};
}
async function deletePracticeResourceSupabase(env,session,resourceId) {
  if(session.userType!=='guru')throw new Error('Hanya guru yang dapat menghapus materi latihan.');
  const rows=await sbRows(env,'practice_resources',{resource_id:`eq.${resourceId}`,limit:'1'});const row=rows[0];if(!row)throw new Error('Materi latihan tidak ditemukan.');if(String(row.teacher_id||'')!==String(session.userID||''))throw new Error('Materi ini dibuat oleh guru lain.');
  await supabaseRest(env,`/rest/v1/practice_resources?resource_id=eq.${encodeURIComponent(resourceId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});return {success:true,message:'Materi latihan berhasil dihapus.'};
}
function parseFeedbackMarkers(text) {
  return String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split('|');return {time:String(parts.shift()||'').trim(),text:parts.join('|').trim()};}).filter(x=>x.time||x.text).slice(0,50);
}
async function saveMediaEvaluationSupabase(env,session,payload) {
  const studentId=String(payload.studentID||'').trim();const student=await practiceStudentAndAccess(env,session,studentId);const id=String(payload.evaluationID||'').trim();let existing=null;
  if(id){const rows=await sbRows(env,'media_evaluations',{evaluation_id:`eq.${id}`,limit:'1'});existing=rows[0]||null;if(!existing)throw new Error('Evaluasi tidak ditemukan.');if(String(existing.teacher_id||'')!==String(session.userID||''))throw new Error('Evaluasi ini dibuat oleh guru lain.');}
  const clamp=v=>Math.max(0,Math.min(100,Math.round(Number(v)||0))); const mediaUrl=String(payload.mediaUrl||'').trim(); const yt=buildYouTubeMeta(mediaUrl);
  let aspects=Array.isArray(payload.aspects)?payload.aspects.slice(0,10).map((x,i)=>({key:String(x?.key||`aspect_${i+1}`).trim().slice(0,50),label:String(x?.label||`Aspek ${i+1}`).trim().slice(0,80),description:String(x?.description||'').trim().slice(0,240),score:clamp(x?.score)})):[];
  if(!aspects.length){aspects=[{key:'tone',label:'Tone',score:clamp(payload.tone)},{key:'rhythm',label:'Rhythm',score:clamp(payload.rhythm)},{key:'tempo',label:'Tempo',score:clamp(payload.tempo)},{key:'technique',label:'Teknik',score:clamp(payload.technique)},{key:'expression',label:'Ekspresi',score:clamp(payload.expression)}];}
  const byKey=Object.fromEntries(aspects.map(x=>[String(x.key||'').toLowerCase(),x.score]));
  const fallback=i=>Number(aspects[i]?.score||0);
  const body={student_id:studentId,student_name_snapshot:String(student.name||''),teacher_id:String(session.userID||''),teacher_name_snapshot:String(session.userName||''),instrument:String(payload.instrument||student.instrument||'Musik'),repertoire_id:String(payload.repertoireID||'').trim()||null,source_type:String(payload.sourceType||'').trim().slice(0,30),source_id:String(payload.sourceID||'').trim().slice(0,120),source_label:String(payload.sourceLabel||'').trim().slice(0,240),title:String(payload.title||'').trim(),media_url:mediaUrl,media_kind:yt.videoId?'youtube':(mediaUrl?'link':'none'),score_aspects:aspects,tone_score:clamp(byKey.tone??fallback(0)),rhythm_score:clamp(byKey.rhythm??fallback(1)),tempo_score:clamp(byKey.tempo??fallback(2)),technique_score:clamp(byKey.technique??fallback(3)),expression_score:clamp(byKey.expression??fallback(4)),strength:String(payload.strength||'').trim(),improvement:String(payload.improvement||'').trim(),next_target:String(payload.nextTarget||'').trim(),feedback_markers:parseFeedbackMarkers(payload.markers),notes:String(payload.notes||'').trim(),active:true,updated_at:new Date().toISOString()};
  if(!body.title)throw new Error('Judul evaluasi wajib diisi.');
  const response=existing?await supabaseRest(env,`/rest/v1/media_evaluations?evaluation_id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)}):await supabaseRest(env,'/rest/v1/media_evaluations',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
  return {success:true,message:existing?'Evaluasi berhasil diperbarui.':'Evaluasi Audio/Video berhasil disimpan.',item:Array.isArray(response)&&response[0]?mapMediaEvaluation(response[0]):null};
}
async function deleteMediaEvaluationSupabase(env,session,id) {
  if(session.userType!=='guru')throw new Error('Hanya guru yang dapat menghapus evaluasi.');const rows=await sbRows(env,'media_evaluations',{evaluation_id:`eq.${id}`,limit:'1'});const row=rows[0];if(!row)throw new Error('Evaluasi tidak ditemukan.');if(String(row.teacher_id||'')!==String(session.userID||''))throw new Error('Evaluasi ini dibuat oleh guru lain.');await supabaseRest(env,`/rest/v1/media_evaluations?evaluation_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});return {success:true,message:'Evaluasi berhasil dihapus.'};
}

async function getScheduleOverrideRowsForSession(env, session) {
  const rows = await sbRows(env, 'schedule_overrides', { status:'eq.Aktif', order:'original_date.desc,created_at.desc' });
  if (session.userType === 'admin') return rows;
  if (session.userType === 'siswa') {
    const id = String(session.userID || '').trim();
    return rows.filter(row => String(row.absent_student_id || '') === id || String(row.slot_student_id || '') === id);
  }
  if (session.userType === 'guru') {
    const schedules = await sbRows(env, 'schedules', { teacher_id:`eq.${session.userID}` });
    const ids = new Set(schedules.map(row => String(row.schedule_id || '')).filter(Boolean));
    return rows.filter(row => ids.has(String(row.original_schedule_id || '')) || String(row.makeup_teacher_id || '') === String(session.userID || ''));
  }
  return [];
}

async function saveScheduleOverrideSupabase(env, session, rawPayload) {
  if (session.userType !== 'admin') throw new Error('Hanya admin yang dapat membuat atau mengubah pergantian jadwal.');
  const p = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const scheduleId = String(p.jadwalID || '').trim();
  const originalDate = formatDbDateIso(p.tanggalAsli);
  if (!scheduleId || !originalDate) throw new Error('Jadwal asli dan tanggal terdampak wajib dipilih.');

  const scheduleRows = await sbRows(env, 'schedules', { schedule_id:`eq.${scheduleId}`, limit:'1' });
  const schedule = scheduleRows[0];
  if (!schedule) throw new Error('Jadwal asli tidak ditemukan.');

  const expectedDay = String(schedule.day_name || '').trim().toLowerCase();
  const actualDay = String(dayNameFromIsoJs(originalDate) || '').trim().toLowerCase();
  if (expectedDay && actualDay && expectedDay !== actualDay) throw new Error(`Tanggal terdampak harus jatuh pada hari ${schedule.day_name}.`);

  const absentId = String(schedule.student_id || '').trim();
  const absentName = String(schedule.student_name_snapshot || p.siswaAsli || '').trim();
  let slotStudent = null;
  const slotStudentId = String(p.siswaPenggantiID || '').trim();
  if (slotStudentId) {
    const rows = await sbRows(env, 'students', { student_id:`eq.${slotStudentId}`, limit:'1' });
    slotStudent = rows[0] || null;
    if (!slotStudent) throw new Error('Siswa pengganti slot tidak ditemukan.');
  }

  const makeupDate = formatDbDateIso(p.tanggalMakeup);
  const makeupStart = normalizeApiTime(p.jamMulaiMakeup);
  const makeupEnd = normalizeApiTime(p.jamSelesaiMakeup);
  const makeupTeacherId = String(p.guruMakeupID || schedule.teacher_id || session.userID || '').trim();
  let makeupTeacherName = String(p.guruMakeup || schedule.teacher_name_snapshot || session.userName || '').trim();
  if (makeupTeacherId) {
    const teachers = await sbRows(env, 'teachers', { teacher_id:`eq.${makeupTeacherId}`, limit:'1' });
    if (teachers[0]) makeupTeacherName = String(teachers[0].name || makeupTeacherName).trim();
  }
  if (makeupDate && (!makeupStart || !makeupEnd)) throw new Error('Jam mulai dan selesai make-up wajib diisi.');

  const payload = {
    original_schedule_id:scheduleId,
    original_date:originalDate,
    original_day_name:String(schedule.day_name || '').trim(),
    original_start_time:normalizeApiTime(schedule.start_time),
    original_end_time:normalizeApiTime(schedule.end_time),
    original_teacher_id:String(schedule.teacher_id || '').trim() || null,
    original_teacher_name_snapshot:String(schedule.teacher_name_snapshot || '').trim(),
    original_room:String(schedule.room || '').trim(),
    original_instrument:String(schedule.instrument || 'Musik').trim(),
    absent_student_id:absentId || null,
    absent_student_name_snapshot:absentName,
    slot_student_id:slotStudentId || null,
    slot_student_name_snapshot:slotStudent ? String(slotStudent.name || '').trim() : '',
    slot_instrument:slotStudent ? String(p.instrumenPengganti || slotStudent.instrument || schedule.instrument || '').trim() : '',
    makeup_date:makeupDate || null,
    makeup_start_time:makeupStart || null,
    makeup_end_time:makeupEnd || null,
    makeup_teacher_id:makeupTeacherId || null,
    makeup_teacher_name_snapshot:makeupTeacherName || '',
    makeup_room:String(p.ruanganMakeup || schedule.room || '').trim(),
    reason:String(p.alasan || 'Lainnya').trim(),
    notes:String(p.catatan || '').trim(),
    status:'Aktif',
    created_by_role:session.userType,
    created_by_id:String(session.userID || '').trim() || null,
    created_by_name:String(session.userName || '').trim(),
    updated_at:new Date().toISOString()
  };

  const overrideId = String(p.overrideID || '').trim();
  let result;
  if (overrideId) {
    result = await supabaseRest(env, `/rest/v1/schedule_overrides?override_id=eq.${encodeURIComponent(overrideId)}`, {
      method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload)
    });
  } else {
    payload.created_at = new Date().toISOString();
    result = await supabaseRest(env, '/rest/v1/schedule_overrides', {
      method:'POST', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload)
    });
  }
  const row = Array.isArray(result) ? result[0] : null;
  return { success:true, message:'Pergantian jadwal berhasil disimpan.', override:row ? mapScheduleOverride(row) : null };
}

async function deleteScheduleOverrideSupabase(env, session, overrideId) {
  if (session.userType !== 'admin') throw new Error('Hanya admin yang dapat menghapus pergantian jadwal.');
  if (!overrideId) throw new Error('ID pergantian tidak ditemukan.');
  const rows = await sbRows(env, 'schedule_overrides', { override_id:`eq.${overrideId}`, limit:'1' });
  const row = rows[0];
  if (!row) throw new Error('Pergantian jadwal tidak ditemukan.');
  await supabaseRest(env, `/rest/v1/schedule_overrides?override_id=eq.${encodeURIComponent(overrideId)}`, { method:'DELETE', headers:{Prefer:'return=minimal'} });
  return { success:true, message:'Pergantian jadwal berhasil dihapus.', overrideID:overrideId };
}

async function buildStudentDashboardSupabase(env, session) {
  const id = session.userID;
  const [students, classes, schedules, attendance, assignments, progress, replacements, announcements, scheduleOverrides, teachers] =
    await Promise.all([
      sbRows(env, 'students', { student_id:`eq.${id}`, limit:'1' }),
      sbPagedRows(env, 'student_classes', { student_id:`eq.${id}`, order:'created_at.asc' }),
      sbPagedRows(env, 'schedules', { student_id:`eq.${id}`, order:'created_at.asc' }),
      sbRows(env, 'student_attendance', { student_id:`eq.${id}`, order:'attendance_date.desc,created_at.desc', limit:'120' }),
      sbRows(env, 'assignments', { student_id:`eq.${id}`, order:'created_at.desc', limit:'120' }),
      sbRows(env, 'learning_progress', { student_id:`eq.${id}`, order:'last_updated_at.desc.nullslast,created_at.desc', limit:'72' }),
      sbRowsSafe(env, 'replacement_schedules', { student_id:`eq.${id}`, order:'scheduled_date.desc.nullslast,created_at.desc' }),
      sbRowsSafe(env, 'announcements', { order:'sent_at.desc.nullslast,created_at.desc' }),
      getScheduleOverrideRowsForSession(env, session).catch(error => { console.error('Optional schedule overrides failed:', error); return []; }),
      sbRowsSafe(env, 'teachers', { select:'teacher_id,name,instrument,photo_url,status', order:'name.asc' })
    ]);

  const student = students[0];
  if (!student) throw new Error('Data siswa tidak ditemukan di Supabase.');

  const publications = await sbRowsSafe(env, 'student_report_publications', {
    student_public_id:`eq.${id}`,
    active:'eq.true',
    order:'sent_at.desc'
  });

  const kelasList = classes.map(row => mapClassRow(row, schedules));
  const instruments = uniqueText(kelasList.map(x => x.instrumen));
  const teacherNames = uniqueText(kelasList.map(x => x.guru));

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Jakarta',
    year:'numeric',
    month:'2-digit'
  }).formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const ym = `${year}-${month}`;

  const hadir = attendance.filter(row =>
    String(row.attendance_date || '').slice(0,7) === ym &&
    String(row.status || '').toLowerCase() === 'masuk'
  ).length;

  const mappedProgressList = progress.map(mapProgress);
  const progressById = new Map(mappedProgressList.map(item => [String(item.progressID || ''), item]));
  const studentReports = publications.map(row => {
    const publication = mapStudent360Publication(row);
    const progressItem = progressById.get(String(publication?.progressID || '')) || null;
    const matchingClass = kelasList.find(item =>
      progressItem && String(item.guru || '').trim().toLowerCase() === String(progressItem.guru || '').trim().toLowerCase()
    ) || kelasList[0] || null;

    return {
      ...(publication || {}),
      studentID: student.student_id || '',
      period: progressItem?.periode || '',
      periodType: progressItem?.tipePeriode || '',
      teacher: progressItem?.guru || publication?.sentBy || '',
      instrument: matchingClass?.instrumen || student.instrument || '',
      grade: matchingClass?.grade || student.grade || '',
      status:'Tersedia'
    };
  });

  return {
    success:true,
    dataSource:'supabase',
    userType:'siswa',
    partialModules:['attendance','assignments','progress'],
    guruList:teachers
      .filter(row => {
        const teacherIds = new Set(classes.map(c => String(c.teacher_id || '')).filter(Boolean));
        const teacherNames = new Set(classes.map(c => String(c.teacher_name_snapshot || '').trim().toLowerCase()).filter(Boolean));
        return teacherIds.has(String(row.teacher_id || '')) || teacherNames.has(String(row.name || '').trim().toLowerCase());
      })
      .map(row => ({
        id:row.teacher_id || '',
        nama:row.name || '',
        instrumen:row.instrument || 'Musik',
        foto:row.photo_url || '',
        status:row.status || 'Aktif'
      })),
    siswaInfo:{
      userID:student.student_id,
      nama:student.name || '',
      kelas:student.grade || '',
      email:student.email || '',
      noHp:student.phone || '',
      instrumen:instruments.join(', ') || student.instrument || 'Gitar',
      foto:student.photo_url || '',
      guru:teacherNames.join(', ') || student.teacher_name_snapshot || '',
      kelasList
    },
    schedules:(isOperationalStudentStatus(student.status) ? schedules : [])
      .filter(row => String(row.status || 'Aktif').toLowerCase() === 'aktif')
      .map(row => mapSchedule(row, false)),
    absensiList:attendance.map(mapAttendance),
    absensiProgress:{ hadir, total:isOperationalStudentStatus(student.status) ? calculateMonthlyExpectedClasses(schedules, scheduleOverrides, student.student_id) : 0 },
    tugasList:assignments.map(mapAssignment),
    learningProgressList:mappedProgressList,
    studentReports,
    jadwalPenggantiList:replacements.map(mapReplacement),
    scheduleOverrides:scheduleOverrides.map(mapScheduleOverride),
    pengumumanList:activeAnnouncementsForRole(
      announcements, 'siswa', student, new Set(), new Set()
    )
  };
}

// Patch 04: optional, privacy-safe dashboard query timing.
// Enable DASHBOARD_PERF_LOG=true only on the test Worker to view timings in logs.
async function dashboardTimedQuery(env, role, label, fetcher) {
  if (String(env.DASHBOARD_PERF_LOG || '').toLowerCase() !== 'true') return fetcher();
  const started = Date.now();
  try {
    const result = await fetcher();
    console.info(`[LMC dashboard timing] role=${role} dataset=${label} duration_ms=${Date.now() - started} rows=${Array.isArray(result) ? result.length : 'n/a'} status=ok`);
    return result;
  } catch (error) {
    console.warn(`[LMC dashboard timing] role=${role} dataset=${label} duration_ms=${Date.now() - started} status=error`);
    throw error;
  }
}

// Exclude large inline base64 signatures from the initial dashboard snapshot.
// The existing attendance lazy loader fetches detail when attendance is opened.
const DASHBOARD_ATTENDANCE_SELECT = [
  'attendance_id','student_id','student_name_snapshot','teacher_id',
  'teacher_name_snapshot','attendance_date','meeting_number','status',
  'material','song','notes'
].join(',');

async function buildTeacherDashboardSupabase(env, session) {
  const id = session.userID;

  // Fast path: only load the students/classes that actually belong to this teacher.
  // The previous implementation downloaded every student and every class in the school
  // on each teacher login, then filtered them in Worker memory.
  const [teachers, teacherClasses, directStudents, schedules, attendance, assignments, progress, replacements, announcements, publications, scheduleOverrides] =
    await Promise.all([
      dashboardTimedQuery(env, 'guru', 'teachers', () => sbRows(env, 'teachers', { teacher_id:`eq.${id}`, limit:'1' })),
      dashboardTimedQuery(env, 'guru', 'student_classes', () => sbPagedRows(env, 'student_classes', { teacher_id:`eq.${id}`, order:'created_at.asc' })),
      dashboardTimedQuery(env, 'guru', 'students', () => sbPagedRows(env, 'students', { teacher_id:`eq.${id}`, order:'name.asc' })),
      dashboardTimedQuery(env, 'guru', 'schedules', () => sbPagedRows(env, 'schedules', { teacher_id:`eq.${id}`, order:'created_at.asc' })),
      dashboardTimedQuery(env, 'guru', 'student_attendance', () => sbRows(env, 'student_attendance', { select:DASHBOARD_ATTENDANCE_SELECT, teacher_id:`eq.${id}`, order:'attendance_date.desc,created_at.desc', limit:'220' })),
      dashboardTimedQuery(env, 'guru', 'assignments', () => sbRows(env, 'assignments', { teacher_id:`eq.${id}`, order:'created_at.desc', limit:'160' })),
      dashboardTimedQuery(env, 'guru', 'learning_progress', () => sbRows(env, 'learning_progress', { teacher_id:`eq.${id}`, order:'last_updated_at.desc.nullslast,created_at.desc', limit:'120' })),
      dashboardTimedQuery(env, 'guru', 'replacement_schedules', () => sbRowsSafe(env, 'replacement_schedules', { teacher_id:`eq.${id}`, order:'scheduled_date.desc.nullslast,created_at.desc' })),
      dashboardTimedQuery(env, 'guru', 'announcements', () => sbRowsSafe(env, 'announcements', { order:'sent_at.desc.nullslast,created_at.desc', limit:'120' })),
      dashboardTimedQuery(env, 'guru', 'student_report_publications', () => sbRowsSafe(env, 'student_report_publications', { active:'eq.true', order:'sent_at.desc', limit:'160' })),
      dashboardTimedQuery(env, 'guru', 'schedule_overrides', () => getScheduleOverrideRowsForSession(env, session).catch(error => { console.error('Optional schedule overrides failed:', error); return []; })),
    ]);

  const teacher = teachers[0];
  if (!teacher) throw new Error('Data guru tidak ditemukan di Supabase.');

  const directById = new Map(directStudents.map(student => [String(student.student_id || ''), student]));
  const classStudentIds = [...new Set(teacherClasses.map(row => String(row.student_id || '').trim()).filter(Boolean))];
  const missingIds = classStudentIds.filter(studentId => !directById.has(studentId));

  let classStudents = [];
  if (missingIds.length) {
    const cleanIds = missingIds.map(value => String(value).replace(/[(),"]/g,'')).filter(Boolean);
    if (cleanIds.length) {
      classStudents = await sbPagedRows(env, 'students', {
        student_id:`in.(${cleanIds.join(',')})`,
        order:'name.asc'
      });
    }
  }

  const studentMap = new Map();
  [...directStudents, ...classStudents].forEach(student => {
    if (student && student.student_id) studentMap.set(String(student.student_id), student);
  });
  const students = [...studentMap.values()].sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'id'));
  const operationalSchedules = filterOperationalScheduleRows(schedules, students);

  const classMap = new Map();
  for (const row of teacherClasses) {
    const key = String(row.student_id || '');
    if (!classMap.has(key)) classMap.set(key, []);
    classMap.get(key).push(row);
  }

  const teacherStudents = [];
  const studentIds = new Set();
  const studentNames = new Set();

  for (const student of students) {
    const teacherClassesRaw = classMap.get(String(student.student_id || '')) || [];
    const kelasList = teacherClassesRaw.map(row => mapClassRow(row, schedules));
    const instruments = uniqueText(kelasList.map(x => x.instrumen));
    const grades = uniqueText(kelasList.map(x => x.grade));

    teacherStudents.push({
      siswaID:student.student_id || '',
      guruID:student.teacher_id || '',
      nama:student.name || '',
      kelas:grades.join(', ') || student.grade || '',
      email:student.email || '',
      noHp:student.phone || '',
      status:student.status || '',
      foto:student.photo_url || '',
      instrumen:instruments.join(', ') || student.instrument || 'Gitar',
      guru:teacher.name || '',
      kelasList,
      tglDaftar:formatDbDateIso(student.registered_on),
      tglKeluar:formatDbDateIso(student.left_on)
    });

    studentIds.add(String(student.student_id || '').toLowerCase());
    studentNames.add(String(student.name || '').trim().toLowerCase());
  }

  const todayName = jakartaWeekday();
  const todayCount = operationalSchedules.filter(row =>
    String(row.status || 'Aktif') === 'Aktif' &&
    String(row.day_name || '').trim().toLowerCase() === todayName
  ).length;

  const mappedTeacherProgress = progress.map(mapProgress);
  const progressById = new Map(mappedTeacherProgress.map(item => [String(item.progressID || ''), item]));
  const studentByPublicId = new Map(students.map(item => [String(item.student_id || ''), item]));

  const teacherReports = publications
    .map(mapStudent360Publication)
    .filter(publication =>
      publication &&
      String(publication.sentByID || '').trim() === String(id || '').trim()
    )
    .map(publication => {
      const progressItem = progressById.get(String(publication?.progressID || '')) || null;
      const publicStudentId = String(publication?.studentID || '');
      const student = studentByPublicId.get(publicStudentId) || null;
      const studentClassList = teacherStudents.find(item => String(item.siswaID || '') === publicStudentId)?.kelasList || [];
      const matchingClass = studentClassList.find(item =>
        progressItem && String(item.guru || '').trim().toLowerCase() === String(progressItem.guru || '').trim().toLowerCase()
      ) || studentClassList[0] || null;

      return {
        ...(publication || {}),
        studentID: publicStudentId,
        studentName: student?.name || progressItem?.namaSiswa || '',
        period: progressItem?.periode || '',
        periodType: progressItem?.tipePeriode || '',
        teacher: progressItem?.guru || teacher.name || publication?.sentBy || '',
        instrument: matchingClass?.instrumen || student?.instrument || '',
        grade: matchingClass?.grade || student?.grade || '',
        status:'Terkirim'
      };
    });

  return {
    success:true,
    dataSource:'supabase',
    userType:'guru',
    partialModules:['attendance','assignments','progress'],
    guruInfo:{
      userID:teacher.teacher_id,
      nama:teacher.name || '',
      email:teacher.email || '',
      noHp:teacher.phone || '',
      instrumen:teacher.instrument || 'Gitar',
      foto:teacher.photo_url || ''
    },
    siswaList:teacherStudents,
    jadwal:operationalSchedules.map(row => mapSchedule(row, true)),
    absensiList:attendance.map(mapAttendance),
    stats:{ totalSiswa:teacherStudents.length, sesiJadwalAktif:todayCount },
    tugasList:assignments.map(mapAssignment),
    learningProgressList:mappedTeacherProgress,
    teacherReports,
    jadwalPenggantiList:replacements.map(mapReplacement),
    scheduleOverrides:scheduleOverrides.map(mapScheduleOverride),
    pengumumanList:activeAnnouncementsForRole(
      announcements, 'guru', null, studentIds, studentNames, teacher
    )
  };
}

async function buildAdminDashboardSupabase(env, session) {
  const [admins, students, teachers, classes, schedules, attendance, progress, replacements, announcements, history, teacherAttendance, scheduleOverrides, publications] =
    await Promise.all([
      dashboardTimedQuery(env, 'admin', 'admins', () => sbRows(env, 'admins', { admin_id:`eq.${session.userID}`, limit:'1' })),
      dashboardTimedQuery(env, 'admin', 'students', () => sbPagedRows(env, 'students', { order:'name.asc' })),
      dashboardTimedQuery(env, 'admin', 'teachers', () => sbPagedRows(env, 'teachers', { order:'name.asc' })),
      dashboardTimedQuery(env, 'admin', 'student_classes', () => sbPagedRows(env, 'student_classes', { order:'created_at.asc' })),
      dashboardTimedQuery(env, 'admin', 'schedules', () => sbPagedRows(env, 'schedules', { order:'created_at.asc' })),
      dashboardTimedQuery(env, 'admin', 'student_attendance', () => sbRows(env, 'student_attendance', { select:DASHBOARD_ATTENDANCE_SELECT, order:'attendance_date.desc,created_at.desc', limit:'240' })),
      dashboardTimedQuery(env, 'admin', 'learning_progress', () => sbRows(env, 'learning_progress', { order:'last_updated_at.desc.nullslast,created_at.desc', limit:'220' })),
      dashboardTimedQuery(env, 'admin', 'replacement_schedules', () => sbRowsSafe(env, 'replacement_schedules', { order:'scheduled_date.desc.nullslast,created_at.desc' })),
      dashboardTimedQuery(env, 'admin', 'announcements', () => sbRowsSafe(env, 'announcements', { order:'sent_at.desc.nullslast,created_at.desc' })),
      dashboardTimedQuery(env, 'admin', 'student_history', () => sbRowsSafe(env, 'student_history', { order:'event_at.desc.nullslast,created_at.desc', limit:'300' })),
      dashboardTimedQuery(env, 'admin', 'teacher_attendance', () => sbRowsSafe(env, 'teacher_attendance', { order:'attendance_date.desc,created_at.desc', limit:'220' })),
      dashboardTimedQuery(env, 'admin', 'schedule_overrides', () => getScheduleOverrideRowsForSession(env, session)),
      dashboardTimedQuery(env, 'admin', 'student_report_publications', () => sbRowsSafe(env, 'student_report_publications', { active:'eq.true', order:'sent_at.desc', limit:'220' })),
    ]);

  const admin = admins[0] || null;
  const operationalSchedules = filterOperationalScheduleRows(schedules, students);

  const classMap = new Map();
  for (const row of classes) {
    const key = String(row.student_id || '');
    if (!classMap.has(key)) classMap.set(key, []);
    classMap.get(key).push(row);
  }

  const siswaList = students.map(student => {
    const kelasList = (classMap.get(student.student_id) || [])
      .map(row => mapClassRow(row, schedules));

    return {
      siswaID:student.student_id || '',
      guruID:student.teacher_id || '',
      nama:student.name || '',
      kelas:uniqueText(kelasList.map(x => x.grade)).join(', ') || student.grade || '',
      email:student.email || '',
      noHp:student.phone || '',
      status:student.status || '',
      foto:student.photo_url || '',
      instrumen:uniqueText(kelasList.map(x => x.instrumen)).join(', ') || student.instrument || 'Gitar',
      guru:uniqueText(kelasList.map(x => x.guru)).join(', ') || student.teacher_name_snapshot || '-',
      kelasList,
      tglDaftar:formatDbDateIso(student.registered_on),
      tglKeluar:formatDbDateIso(student.left_on),
      alasanKeluar:student.exit_reason || ''
    };
  });

  const guruList = teachers.map(row => ({
    id:row.teacher_id || '',
    nama:row.name || '',
    email:row.email || '',
    noHp:row.phone || '',
    instrumen:row.instrument || 'Gitar',
    status:row.status || 'Aktif',
    foto:row.photo_url || ''
  }));

  const knownNames = new Set(
    students.map(s => String(s.name || '').trim().toLowerCase()).filter(Boolean)
  );

  const mappedAdminProgress = progress.map(mapProgress);
  const adminProgressById = new Map(mappedAdminProgress.map(item => [String(item.progressID || ''), item]));
  const adminStudentByPublicId = new Map(students.map(item => [String(item.student_id || ''), item]));
  // Index once: avoid scanning the entire student roster for every publication.
  const adminClassListByStudentId = new Map(siswaList.map(item => [String(item.siswaID || ''), item.kelasList || []]));
  const adminReports = publications.map(mapStudent360Publication).filter(Boolean).map(publication => {
    const progressItem = adminProgressById.get(String(publication.progressID || '')) || null;
    const student = adminStudentByPublicId.get(String(publication.studentID || '')) || null;
    const studentClasses = adminClassListByStudentId.get(String(publication.studentID || '')) || [];
    const matchingClass = studentClasses.find(item =>
      progressItem && String(item.guru || '').trim().toLowerCase() === String(progressItem.guru || '').trim().toLowerCase()
    ) || studentClasses[0] || null;
    return {
      ...publication,
      studentID:String(publication.studentID || ''),
      studentName:student?.name || progressItem?.namaSiswa || '',
      period:progressItem?.periode || '',
      periodType:progressItem?.tipePeriode || '',
      teacher:progressItem?.guru || publication.sentBy || '',
      instrument:matchingClass?.instrumen || student?.instrument || '',
      grade:matchingClass?.grade || student?.grade || '',
      status:'Terkirim'
    };
  });

  return {
    success:true,
    dataSource:'supabase',
    userType:'admin',
    partialModules:['attendance','progress','teacher_attendance'],
    adminInfo:admin ? {
      userID:admin.admin_id,
      nama:admin.name || '',
      email:admin.email || '',
      noHp:admin.phone || '',
      foto:admin.photo_url || ''
    } : {
      userID:session.userID,
      nama:session.userName || '',
      email:'',
      noHp:'',
      foto:''
    },
    siswaList,
    guruList,
    jadwal:operationalSchedules
      .filter(row => knownNames.has(String(row.student_name_snapshot || '').trim().toLowerCase()))
      .map(row => mapSchedule(row, true)),
    absensiList:attendance.map(mapAttendance),
    learningProgressList:mappedAdminProgress,
    adminReports,
    jadwalPenggantiList:replacements.map(mapReplacement),
    scheduleOverrides:scheduleOverrides.map(mapScheduleOverride),
    pengumumanList:activeAnnouncementsForRole(
      announcements, 'admin', null, new Set(), new Set()
    ),
    studentHistory:buildStudentHistoryForDashboard(history, students),
    teacherAttendanceList:teacherAttendance.map(mapTeacherAttendance),
    stats:{
      totalSiswa:siswaList.length,
      siswaAktif:siswaList.filter(s => String(s.status).toLowerCase() === 'aktif').length,
      siswaCuti:siswaList.filter(s => String(s.status).toLowerCase() === 'cuti').length,
      siswaKeluar:siswaList.filter(s => String(s.status).toLowerCase() === 'keluar').length,
      totalGuru:guruList.length
    }
  };
}

function buildStudentHistoryForDashboard(historyRows, students) {
  const studentById = new Map((students || []).map(student => [String(student.student_id || ''), student]));
  const studentByName = new Map((students || []).map(student => [String(student.name || '').trim().toLowerCase(), student]));
  const list = historyRows.map(row => {
    const linked = studentById.get(String(row.student_id || '')) || studentByName.get(String(row.student_name_snapshot || '').trim().toLowerCase()) || null;
    const isExit = String(row.event_type || '').trim().toLowerCase() === 'keluar';
    return {
    riwayatID:row.history_id || '',
    nama:row.student_name_snapshot || '',
    jenis:row.event_type || '',
    tanggal:formatDbDateIso(row.event_at),
    statusSebelum:row.previous_status || '',
    statusSesudah:row.new_status || '',
    instrumen:row.instrument || '',
    guru:row.teacher_name_snapshot || '',
    keterangan:(isExit && linked && linked.exit_reason) ? linked.exit_reason : (row.description || ''),
    siswaID:row.student_id || '',
    guruID:row.teacher_id || ''
  };
  });

  const known = new Set(list.map(item =>
    `${String(item.jenis).toLowerCase()}|${String(item.nama).trim().toLowerCase()}|${item.tanggal}`
  ));

  let syntheticIndex = 0;
  for (const student of students) {
    syntheticIndex += 1;
    const name = String(student.name || '').trim();
    if (!name) continue;

    const nameKey = name.toLowerCase();
    const registered = formatDbDateIso(student.registered_on);
    const left = formatDbDateIso(student.left_on);

    if (registered && !known.has(`masuk|${nameKey}|${registered}`)) {
      list.push({
        riwayatID:`legacy-in-${syntheticIndex}`,
        nama:name,
        jenis:'Masuk',
        tanggal:registered,
        statusSebelum:'',
        statusSesudah:student.status || 'Aktif',
        instrumen:student.instrument || 'Gitar',
        guru:student.teacher_name_snapshot || '',
        keterangan:'Tanggal daftar siswa'
      });
    }

    if (
      String(student.status || '').trim().toLowerCase() === 'keluar' &&
      left &&
      !known.has(`keluar|${nameKey}|${left}`)
    ) {
      list.push({
        riwayatID:`legacy-out-${syntheticIndex}`,
        nama:name,
        jenis:'Keluar',
        tanggal:left,
        statusSebelum:'Aktif',
        statusSesudah:'Keluar',
        instrumen:student.instrument || 'Gitar',
        guru:student.teacher_name_snapshot || '',
        keterangan:student.exit_reason || 'Status siswa keluar'
      });
    }
  }

  return list.sort((a,b) =>
    String(b.tanggal || '').localeCompare(String(a.tanggal || ''))
  );
}

async function syncStudentHistoryFromAppsScript(env, session) {
  const raw = await gasRpc(env, 'getDashboardData', [session.userID, 'admin']);
  const dashboard = parseDashboardPayload(raw);

  if (!dashboard || dashboard.success !== true || !Array.isArray(dashboard.studentHistory)) {
    throw new Error('Dashboard Apps Script tidak menyediakan studentHistory.');
  }

  const rows = dashboard.studentHistory
    .filter(item => !String(item.riwayatID || '').startsWith('legacy-'))
    .map(item => ({
      history_id:String(item.riwayatID || '').trim(),
      student_id:String(item.siswaID || '').trim() || null,
      student_name:String(item.nama || '').trim(),
      event_type:String(item.jenis || '').trim(),
      event_date:normalizeLegacyDate(item.tanggal),
      previous_status:String(item.statusSebelum || ''),
      new_status:String(item.statusSesudah || ''),
      instrument:String(item.instrumen || ''),
      teacher_id:String(item.guruID || '').trim() || null,
      teacher_name:String(item.guru || ''),
      description:String(item.keterangan || '')
    }))
    .filter(item => item.history_id);

  await supabaseRpc(env, 'legacy_replace_student_history', { p_rows:rows });
}


async function shadowStudentFromSupabase(env, studentId) {
  if (!studentId) throw new Error('Student ID shadow kosong.');

  const [students, classes, schedules, history] = await Promise.all([
    sbRows(env, 'students', { student_id:`eq.${studentId}`, limit:'1' }),
    sbRows(env, 'student_classes', { student_id:`eq.${studentId}`, order:'created_at.asc' }),
    sbRows(env, 'schedules', { student_id:`eq.${studentId}`, order:'created_at.asc' }),
    sbRows(env, 'student_history', { student_id:`eq.${studentId}`, order:'event_at.asc,created_at.asc' })
  ]);

  const student = students[0];
  if (!student) throw new Error(`Student ${studentId} tidak ditemukan untuk shadow.`);

  const snapshot = {
    student: {
      siswaID: student.student_id || '',
      nama: student.name || '',
      grade: student.grade || '',
      email: student.email || '',
      noHp: student.phone || '',
      tglDaftar: formatDbDateIso(student.registered_on),
      status: student.status || 'Aktif',
      foto: student.photo_url || '',
      instrumen: student.instrument || 'Gitar',
      guruID: student.teacher_id || '',
      guru: student.teacher_name_snapshot || '',
      tglKeluar: formatDbDateIso(student.left_on)
    },
    classes: classes.map(row => ({
      kelasSiswaID: row.class_id || '',
      siswaID: row.student_id || '',
      namaSiswa: row.student_name_snapshot || '',
      instrumen: row.instrument || 'Gitar',
      guruID: row.teacher_id || '',
      guru: row.teacher_name_snapshot || '',
      grade: row.grade || 'Beginner',
      status: row.status || 'Aktif',
      tglMulai: formatDbDateIso(row.started_on),
    tglDaftar: formatDbDateIso(row.started_on),
      tglSelesai: formatDbDateIso(row.ended_on)
    })),
    schedules: schedules.map(row => ({
      jadwalID: row.schedule_id || '',
      siswaID: row.student_id || '',
      namaSiswa: row.student_name_snapshot || '',
      hari: row.day_name || '',
      jamMulai: formatDbTime(row.start_time),
      jamSelesai: formatDbTime(row.end_time),
      guruID: row.teacher_id || '',
      guru: row.teacher_name_snapshot || '',
      ruangan: row.room || '',
      status: row.status || 'Aktif',
      instrumen: row.instrument || 'Gitar'
    })),
    history: history.map(row => ({
      riwayatID: row.history_id || '',
      siswaID: row.student_id || '',
      namaSiswa: row.student_name_snapshot || '',
      jenis: row.event_type || '',
      tanggal: formatDbDateIso(row.event_at),
      statusSebelum: row.previous_status || '',
      statusSesudah: row.new_status || '',
      instrumen: row.instrument || '',
      guruID: row.teacher_id || '',
      guru: row.teacher_name_snapshot || '',
      keterangan: row.description || ''
    }))
  };

  const result = await gasRpc(env, 'phase10UpsertStudentShadow', [snapshot]);
  if (!result || result.success !== true) {
    throw new Error(result && result.message ? result.message : 'Student shadow gagal.');
  }
}

function stripTrailingSlash(v) {
  return String(v || '').replace(/\/+$/, '');
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
  if (method === 'saveLearningProgress' || method === 'deleteLearningProgress') {
    args[1] = s.userName; args[2] = s.userType;
  }
  if (method === 'addJadwalPengganti' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;
  if (method === 'addPengumuman' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;
  if (method === 'updateSiswa' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;
  if (method === 'addSiswaCombined' && args[0] && typeof args[0] === 'object') args[0].currentUserType = s.userType;

  const roleLast = new Set([
    'deleteJadwalPengganti','deletePengumuman','deleteGuru',
    'recordTeacherAttendance','deleteTeacherAttendance',
    'deleteExitedStudentRecord','addGuru','updateGuru'
  ]);
  if (roleLast.has(method)) args[1] = s.userType;
  return args;
}


function hasDriveServiceConfig(env) {
  return Boolean(env.DRIVE_SCRIPT_URL && env.DRIVE_SCRIPT_TOKEN);
}

async function driveRpc(env, method, args) {
  if (!hasDriveServiceConfig(env)) {
    throw new Error('Drive microservice belum dikonfigurasi.');
  }

  const response = await fetch(env.DRIVE_SCRIPT_URL, {
    method:'POST',
    redirect:'follow',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      apiToken:env.DRIVE_SCRIPT_TOKEN,
      method,
      args:Array.isArray(args) ? args : []
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Drive Service HTTP ${response.status}: ${text.slice(0,240)}`);
  }

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error('Drive Service mengembalikan respons non-JSON.'); }

  if (!parsed.ok) throw new Error(parsed.error || 'Drive Service RPC gagal.');
  return parsed.data;
}

async function driveUploadFiles(env, files, folderName) {
  if (hasDriveServiceConfig(env)) {
    try {
      return await driveRpc(env, 'uploadFiles', [
        Array.isArray(files) ? files : [],
        String(folderName || 'LegacyGuitarClass_Tugas')
      ]);
    } catch (error) {
      console.error(`Drive microservice upload failed for ${folderName}, falling back to legacy Apps Script:`, error);
    }
  }

  const fallback = await gasRpc(env, 'phase10UploadTaskFiles', [
    Array.isArray(files) ? files : [],
    String(folderName || 'LegacyGuitarClass_Tugas')
  ]);

  return {
    ...(fallback || {}),
    backend:'legacy-apps-script-fallback'
  };
}

async function driveUploadProgressSignatures(env, payload) {
  if (hasDriveServiceConfig(env)) {
    try {
      return await driveRpc(env, 'uploadProgressSignatures', [payload || {}]);
    } catch (error) {
      console.error('Drive microservice signature upload failed, falling back to legacy Apps Script:', error);
    }
  }

  const fallback = await gasRpc(env, 'phase10UploadProgressSignatures', [payload || {}]);
  return {
    ...(fallback || {}),
    backend:'legacy-apps-script-fallback'
  };
}

async function gasRpc(env, method, args) {
  const response = await fetch(env.APPS_SCRIPT_URL, {
    method:'POST', redirect:'follow',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({ apiToken:env.APPS_SCRIPT_TOKEN, method, args })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}: ${text.slice(0,240)}`);

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error('Apps Script mengembalikan respons non-JSON.'); }

  if (!parsed.ok) throw new Error(parsed.error || 'Apps Script RPC gagal.');
  return parsed.data;
}



function pushText(value, max=180) {
  const clean = String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  return clean.length > max ? clean.slice(0, Math.max(1,max-1)) + '…' : clean;
}

async function pushUsersForRole(env, role) {
  const rows = await supabaseRest(env, `/rest/v1/push_subscriptions?user_type=eq.${encodeURIComponent(String(role||''))}&active=eq.true&select=user_id`, { method:'GET' });
  return [...new Set((Array.isArray(rows)?rows:[]).map(r=>String(r.user_id||'').trim()).filter(Boolean))];
}

async function pushAllActiveUsers(env, notification, roles=['siswa','guru','admin']) {
  let sent=0, failed=0;
  for (const role of roles) {
    const ids = await pushUsersForRole(env, role);
    for (const id of ids) {
      const r = await sendPushToUser(env, role, id, notification);
      sent += Number(r.sent||0); failed += Number(r.failed||0);
    }
  }
  return {sent,failed};
}

async function pushToUniqueRecipients(env, recipients, notification) {
  const seen=new Set(); let sent=0, failed=0;
  for (const item of Array.isArray(recipients)?recipients:[]) {
    const role=String(item&&item.role||'').trim();
    const id=String(item&&item.id||'').trim();
    if(!role||!id) continue;
    const key=role+':'+id; if(seen.has(key)) continue; seen.add(key);
    const r=await sendPushToUser(env,role,id,notification);
    sent += Number(r.sent||0); failed += Number(r.failed||0);
  }
  return {sent,failed};
}

async function findTeacherByIdOrName(env, value) {
  const v=String(value||'').trim(); if(!v) return null;
  let rows=await sbRows(env,'teachers',{teacher_id:`eq.${v}`,limit:'1'}).catch(()=>[]);
  if(rows[0]) return rows[0];
  rows=await sbRows(env,'teachers',{name:`eq.${v}`,limit:'1'}).catch(()=>[]);
  return rows[0]||null;
}

async function findStudentByIdOrName(env, idValue, nameValue='') {
  const id=String(idValue||'').trim();
  if(id){const rows=await sbRows(env,'students',{student_id:`eq.${id}`,limit:'1'}).catch(()=>[]); if(rows[0]) return rows[0];}
  const name=String(nameValue||'').trim();
  if(name){const rows=await sbRows(env,'students',{name:`eq.${name}`,limit:'1'}).catch(()=>[]); if(rows[0]) return rows[0];}
  return null;
}

async function teacherRecipientsForStudent(env, studentId) {
  const id=String(studentId||'').trim(); if(!id) return [];
  const rows=await sbRows(env,'student_classes',{student_id:`eq.${id}`,status:'eq.Aktif'}).catch(()=>[]);
  return [...new Set(rows.map(r=>String(r.teacher_id||'').trim()).filter(Boolean))].map(id=>({role:'guru',id}));
}

async function pushAnnouncementAudience(env, announcement) {
  const a=announcement||{};
  const target=String(a.target||'semua').trim().toLowerCase();
  const title=pushText(a.title||a.judul||'Pengumuman Legacy Music Center',90);
  const body=pushText(a.body||a.isi||'Ada pengumuman baru.',220);
  const notification={title,body,url:'/',tag:'announcement-'+String(a.announcement_id||a.pengumumanID||Date.now())};
  if(target==='semua') return pushAllActiveUsers(env,notification,['siswa','guru','admin']);
  const recipients=[];
  for(const id of await pushUsersForRole(env,'admin')) recipients.push({role:'admin',id});
  if(target==='semua_siswa') {
    for(const id of await pushUsersForRole(env,'siswa')) recipients.push({role:'siswa',id});
  } else if(target==='semua_guru') {
    for(const id of await pushUsersForRole(env,'guru')) recipients.push({role:'guru',id});
  } else if(target==='siswa_tertentu') {
    const student=await findStudentByIdOrName(env,a.target_student_id||a.targetSiswaID,a.target_detail||a.targetDetail);
    if(student&&student.student_id){
      recipients.push({role:'siswa',id:student.student_id});
      recipients.push(...await teacherRecipientsForStudent(env,student.student_id));
    }
  } else if(target==='guru_tertentu') {
    const teacher=await findTeacherByIdOrName(env,a.target_detail||a.targetDetail);
    if(teacher&&teacher.teacher_id) recipients.push({role:'guru',id:teacher.teacher_id});
  }
  return pushToUniqueRecipients(env,recipients,notification);
}

function jakartaNowParts(date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',weekday:'long',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
  const out={}; for(const p of parts) if(p.type!=='literal') out[p.type]=p.value;
  return {date:`${out.year}-${out.month}-${out.day}`,weekday:String(out.weekday||'').toLowerCase(),hour:Number(out.hour||0),minute:Number(out.minute||0)};
}

function weekdayIndonesianFromEnglish(v){return ({sunday:'minggu',monday:'senin',tuesday:'selasa',wednesday:'rabu',thursday:'kamis',friday:'jumat',saturday:'sabtu'})[String(v||'').toLowerCase()]||'';}
function dbTimeToMinutes(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):null;}

async function claimPushEvent(env,eventKey,userType,userId){
  try{
    await supabaseRest(env,'/rest/v1/push_delivery_events',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({event_key:eventKey,user_type:userType,user_id:userId})});
    return true;
  }catch(error){
    const msg=String(error&&error.message?error.message:error);
    if(/duplicate|unique|409|23505/i.test(msg)) return false;
    throw error;
  }
}

async function runClassReminderPush(env){
  if(!hasSupabaseConfig(env)) return {sent:0,failed:0};
  if(!String(env.VAPID_PUBLIC_KEY||'').trim()||!String(env.VAPID_PRIVATE_KEY||'').trim()) return {sent:0,failed:0,skipped:true};
  const now=jakartaNowParts(); const day=weekdayIndonesianFromEnglish(now.weekday); if(!day) return {sent:0,failed:0};
  const rows=(await sbRows(env,'schedules',{}).catch(()=>[])).filter(r=>String(r.day_name||'').trim().toLowerCase()===day&&String(r.status||'Aktif').trim().toLowerCase()!=='nonaktif');
  const current=now.hour*60+now.minute; let sent=0,failed=0;
  for(const row of rows){
    const start=dbTimeToMinutes(row.start_time); if(start==null) continue;
    const delta=start-current; if(delta<45||delta>60) continue;
    const label=`${formatDbTime(row.start_time)||''} · ${row.room||'-'}`;
    const notification={title:'Pengingat Kelas',body:`Kelas ${row.instrument||'musik'} akan dimulai sekitar 1 jam lagi. ${label}`,url:'/',tag:`class-${now.date}-${row.schedule_id||''}`};
    const recipients=[];
    if(row.student_id) recipients.push({role:'siswa',id:String(row.student_id)});
    if(row.teacher_id) recipients.push({role:'guru',id:String(row.teacher_id)});
    for(const rec of recipients){
      const eventKey=`class:${now.date}:${row.schedule_id||''}:${rec.role}:${rec.id}`;
      if(!(await claimPushEvent(env,eventKey,rec.role,rec.id))) continue;
      const r=await sendPushToUser(env,rec.role,rec.id,notification); sent+=Number(r.sent||0); failed+=Number(r.failed||0);
    }
  }
  return {sent,failed};
}

async function listPushSubscriptions(env, userType, userId) {
  if (!hasSupabaseConfig(env)) throw new Error('Konfigurasi Supabase belum lengkap.');
  const role = String(userType || '').trim();
  const id = String(userId || '').trim();
  if (!role || !id) return [];
  const path = `/rest/v1/push_subscriptions?user_type=eq.${encodeURIComponent(role)}&user_id=eq.${encodeURIComponent(id)}&active=eq.true&select=id,endpoint,p256dh,auth`;
  const rows = await supabaseRest(env, path, { method:'GET' });
  return Array.isArray(rows) ? rows : [];
}

async function savePushSubscriptionSupabase(env, session, payload) {
  if (!hasSupabaseConfig(env)) throw new Error('Konfigurasi Supabase belum lengkap.');
  const endpoint = String(payload && payload.endpoint || '').trim();
  const keys = payload && payload.keys && typeof payload.keys === 'object' ? payload.keys : {};
  const p256dh = String(keys.p256dh || '').trim();
  const auth = String(keys.auth || '').trim();
  if (!endpoint || !p256dh || !auth) throw new Error('Data subscription push tidak lengkap.');
  if (!/^https:\/\//i.test(endpoint)) throw new Error('Endpoint push tidak valid.');

  const body = {
    user_id:String(session.userID || '').trim(),
    user_type:String(session.userType || '').trim(),
    endpoint,
    p256dh,
    auth,
    expiration_time:payload.expirationTime == null ? null : (Number.isFinite(Number(payload.expirationTime)) ? Number(payload.expirationTime) : null),
    user_agent:String(payload.userAgent || '').slice(0,500),
    platform:String(payload.platform || '').slice(0,120),
    standalone:Boolean(payload.standalone),
    active:true,
    updated_at:new Date().toISOString(),
    last_error:null
  };

  await supabaseRest(env, '/rest/v1/push_subscriptions?on_conflict=endpoint', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
    body:JSON.stringify(body)
  });
  return { success:true, message:'Push notification aktif di perangkat ini.' };
}

async function removePushSubscriptionSupabase(env, session, endpoint) {
  if (!endpoint) return { success:true, message:'Push notification sudah nonaktif.' };
  const path = `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_type=eq.${encodeURIComponent(String(session.userType || ''))}&user_id=eq.${encodeURIComponent(String(session.userID || ''))}`;
  await supabaseRest(env, path, {
    method:'PATCH',
    headers:{ 'Content-Type':'application/json', Prefer:'return=minimal' },
    body:JSON.stringify({ active:false, updated_at:new Date().toISOString() })
  });
  return { success:true, message:'Push notification dinonaktifkan di perangkat ini.' };
}

async function sendPushToUser(env, userType, userId, notification) {
  if (!String(env.VAPID_PUBLIC_KEY || '').trim() || !String(env.VAPID_PRIVATE_KEY || '').trim()) {
    return { sent:0, failed:0, skipped:true };
  }
  const rows = await listPushSubscriptions(env, userType, userId);
  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      const result = await sendWebPush(env, row, notification || {});
      if (result.ok) {
        sent++;
        await updatePushDeliveryState(env, row.endpoint, true, '');
      } else {
        failed++;
        await updatePushDeliveryState(env, row.endpoint, false, `HTTP ${result.status}: ${result.text || ''}`);
        if (result.status === 404 || result.status === 410) await deactivatePushEndpoint(env, row.endpoint);
      }
    } catch (error) {
      failed++;
      const message = String(error && error.message ? error.message : error);
      await updatePushDeliveryState(env, row.endpoint, false, message).catch(() => {});
    }
  }
  return { sent, failed };
}

async function updatePushDeliveryState(env, endpoint, success, errorMessage) {
  const path = `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(String(endpoint || ''))}`;
  const patch = success
    ? { last_success_at:new Date().toISOString(), last_error:null, updated_at:new Date().toISOString() }
    : { last_error:String(errorMessage || '').slice(0,500), updated_at:new Date().toISOString() };
  await supabaseRest(env, path, { method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify(patch) });
}

async function deactivatePushEndpoint(env, endpoint) {
  const path = `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(String(endpoint || ''))}`;
  await supabaseRest(env, path, { method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=minimal'}, body:JSON.stringify({active:false,updated_at:new Date().toISOString()}) });
}

async function sendWebPush(env, subscription, notification) {
  const endpoint = String(subscription && subscription.endpoint || '').trim();
  if (!endpoint) throw new Error('Endpoint push kosong.');
  const payload = new TextEncoder().encode(JSON.stringify({
    title:String(notification.title || 'Legacy Music Center'),
    body:String(notification.body || 'Ada informasi baru untuk Anda.'),
    url:String(notification.url || '/'),
    tag:String(notification.tag || 'legacy-notification'),
    icon:'/icons/icon-192.png',
    badge:'/icons/icon-192.png'
  }));
  const encrypted = await encryptWebPushPayload(payload, String(subscription.p256dh || ''), String(subscription.auth || ''));
  const authorization = await createVapidAuthorization(endpoint, env);
  const response = await fetch(endpoint, {
    method:'POST',
    headers:{
      TTL:'2419200',
      Urgency:'normal',
      'Content-Type':'application/octet-stream',
      'Content-Encoding':'aes128gcm',
      Authorization:authorization
    },
    body:encrypted
  });
  const text = response.ok ? '' : await response.text().catch(() => '');
  return { ok:response.ok, status:response.status, text:text.slice(0,300) };
}

async function createVapidAuthorization(endpoint, env) {
  const publicRaw = base64urlDecode(String(env.VAPID_PUBLIC_KEY || '').trim());
  const privateRaw = base64urlDecode(String(env.VAPID_PRIVATE_KEY || '').trim());
  if (publicRaw.length !== 65 || publicRaw[0] !== 4 || privateRaw.length !== 32) throw new Error('Format VAPID key tidak valid.');
  const x = publicRaw.slice(1,33), y = publicRaw.slice(33,65);
  const jwk = { kty:'EC', crv:'P-256', x:base64urlEncode(x), y:base64urlEncode(y), d:base64urlEncode(privateRaw), ext:false, key_ops:['sign'] };
  const key = await crypto.subtle.importKey('jwk', jwk, {name:'ECDSA',namedCurve:'P-256'}, false, ['sign']);
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now()/1000);
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const body = base64urlEncode(new TextEncoder().encode(JSON.stringify({aud,exp:now + 12*60*60,sub:String(env.VAPID_SUBJECT || 'mailto:admin@legacy.sch.id')})));
  const signingInput = `${header}.${body}`;
  const signature = new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}, key, new TextEncoder().encode(signingInput)));
  const jwt = `${signingInput}.${base64urlEncode(signature)}`;
  return `vapid t=${jwt}, k=${String(env.VAPID_PUBLIC_KEY || '').trim()}`;
}

async function encryptWebPushPayload(payloadBytes, clientPublicKeyB64, authSecretB64) {
  const clientPublic = base64urlDecode(clientPublicKeyB64);
  const authSecret = base64urlDecode(authSecretB64);
  if (clientPublic.length !== 65 || clientPublic[0] !== 4) throw new Error('p256dh subscription tidak valid.');
  if (!authSecret.length) throw new Error('Auth secret subscription tidak valid.');

  const clientKey = await crypto.subtle.importKey('raw', clientPublic, {name:'ECDH',namedCurve:'P-256'}, false, []);
  const serverKeys = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'}, true, ['deriveBits']);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:clientKey}, serverKeys.privateKey, 256));

  const prkKey = await hkdfExtract(authSecret, shared);
  const keyInfo = concatBytes(new TextEncoder().encode('WebPush: info\0'), clientPublic, serverPublic);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
  const plaintext = concatBytes(payloadBytes, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, {name:'AES-GCM'}, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128}, aesKey, plaintext));

  const recordSize = 4096;
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, recordSize, false);
  return concatBytes(salt, rs, new Uint8Array([serverPublic.length]), serverPublic, ciphertext);
}

async function hkdfExtract(salt, ikm) {
  return hmacSha256(salt, ikm);
}

async function hkdfExpand(prk, info, length) {
  let previous = new Uint8Array(0);
  let output = new Uint8Array(0);
  let counter = 1;
  while (output.length < length) {
    previous = await hmacSha256(prk, concatBytes(previous, info, new Uint8Array([counter])));
    output = concatBytes(output, previous);
    counter++;
  }
  return output.slice(0,length);
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum,item) => sum + item.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const item of arrays) { out.set(item, offset); offset += item.length; }
  return out;
}

function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  const out = {};
  for (const pair of raw.split(';')) {
    const i = pair.indexOf('=');
    if (i < 0) continue;
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
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'}, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64urlEncode(new Uint8Array(sig));
}

function timingSafeEqual(a,b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i=0;i<a.length;i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function base64urlEncode(bytes) {
  let s=''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function base64urlDecode(s) {
  s=s.replace(/-/g,'+').replace(/_/g,'/');
  while (s.length%4) s+='=';
  const raw=atob(s), arr=new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
  return arr;
}

function json(data,status=200,headers={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      ...headers
    }
  });
}


// ANNUAL EXAM v2 — editable headmaster + dedicated uploaded signatures.
async function saveAnnualExamSupabase(env, session, rawPayload) {
  const p = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};
  const examId = String(p.examID || '').trim();
  const studentId = String(p.studentID || '').trim();
  if (!studentId) throw new Error('Siswa belum dipilih.');
  if (!(await annualExamTeacherCanAccessStudent(env, session, studentId))) throw new Error('Anda tidak memiliki akses untuk menilai siswa ini.');
  const studentRows = await sbRows(env, 'students', { student_id:`eq.${studentId}`, limit:'1' });
  const student = studentRows[0]; if (!student) throw new Error('Data siswa tidak ditemukan.');
  const existing = examId ? await getAnnualExamSupabase(env, session, examId) : null;
  const itemsRaw = Array.isArray(p.items) ? p.items : [];
  if (itemsRaw.length < 1) throw new Error('Aspek penilaian belum tersedia.');
  const items = itemsRaw.map((item,index) => {
    const s1 = Math.max(0,Math.min(20,Number(item.scoreExaminer1)||0));
    const s2 = Math.max(0,Math.min(20,Number(item.scoreExaminer2)||0));
    return { aspect:String(item.aspect||'Aspek'), description:String(item.description||''), scoreExaminer1:s1, scoreExaminer2:s2, average:Math.round(((s1+s2)/2)*10)/10, maxScore:20, sortOrder:index+1 };
  });
  const total = Math.round(Math.min(100,items.reduce((sum,item)=>sum+item.average,0))*10)/10;
  const passed = total >= 60;
  const predicate = annualExamPredicateServer(total);
  const grade = String(p.gradeExam || student.grade || 'Beginner').trim();
  const nextGrade = annualExamNextGradeServer(grade, passed);
  const examiner1 = String(p.examiner1Name || '').trim();
  const examiner2 = String(p.examiner2Name || '').trim();
  if (!examiner1 || !examiner2) throw new Error('Penguji 1 dan Penguji 2 wajib dipilih.');

  const [auto1,auto2,autoHead] = await Promise.all([
    annualExamSignatureForTeacher(env,examiner1), annualExamSignatureForTeacher(env,examiner2), annualExamHeadmasterSignature(env,studentId)
  ]);
  let sig1 = String(p.examiner1SignatureUrl || existing?.examiner1SignatureUrl || auto1.url || '').trim();
  let sig2 = String(p.examiner2SignatureUrl || existing?.examiner2SignatureUrl || auto2.url || '').trim();
  let sigHead = String(p.headmasterSignatureUrl || existing?.headmasterSignatureUrl || autoHead.url || '').trim();

  const uploadOne = async (fileData, label) => {
    if (!fileData || !fileData.dataUrl) return '';
    if (!String(fileData.type || '').toLowerCase().startsWith('image/')) throw new Error(label + ' harus berupa gambar.');
    if (Number(fileData.size || 0) > 5 * 1024 * 1024) throw new Error(label + ' maksimal 5 MB.');
    const result = await driveUploadFiles(env, [fileData], 'LegacyMusicCenter_Exam_Signatures');
    if (!result || result.success !== true || !Array.isArray(result.attachments) || !result.attachments[0]) throw new Error('Upload ' + label + ' gagal.');
    const a=result.attachments[0];
    return String(a.url || a.previewUrl || a.downloadUrl || '').trim();
  };
  if (p.examiner1SignatureFile) sig1 = await uploadOne(p.examiner1SignatureFile,'tanda tangan Penguji 1');
  if (p.examiner2SignatureFile) sig2 = await uploadOne(p.examiner2SignatureFile,'tanda tangan Penguji 2');
  if (p.headmasterSignatureFile) sigHead = await uploadOne(p.headmasterSignatureFile,'tanda tangan Kepala Sekolah');

  const teacherName = String(p.teacherName || session.userName || '').trim();
  const headmasterName = String(p.headmasterName || existing?.headmasterName || autoHead.name || 'Faisal Rahmat Permana, S.Sn., M.Pd').trim();
  const payload = {
    student_public_id:studentId, student_name_snapshot:String(student.name||''), teacher_id:session.userType==='guru'?session.userID:(String(p.teacherID||'').trim()||session.userID||null),
    teacher_name_snapshot:teacherName, instrument:String(p.instrument||student.instrument||'Musik').trim(), grade_exam:grade,
    exam_date:String(p.examDate||new Date().toISOString().slice(0,10)).slice(0,10), examiner_1_name:examiner1, examiner_2_name:examiner2,
    examiner_1_signature_url:sig1, examiner_2_signature_url:sig2, notes_examiner_1:String(p.notesExaminer1||''), notes_examiner_2:String(p.notesExaminer2||''),
    items, final_score:total, predicate, result_status:passed?'Lulus':'Belum Lulus', next_grade:nextGrade,
    headmaster_name:headmasterName, headmaster_signature_url:sigHead, updated_at:new Date().toISOString()
  };
  let row;
  if (examId) {
    const response = await supabaseRest(env, `/rest/v1/annual_exam_assessments?exam_id=eq.${encodeURIComponent(examId)}`, { method:'PATCH', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload) });
    row = Array.isArray(response) ? response[0] : null;
  } else {
    payload.certificate_no = `LMC/EXAM/${String(payload.exam_date).slice(0,4)}/${Date.now().toString(36).toUpperCase().slice(-6)}`;
    payload.created_by_role = session.userType; payload.created_by_id = session.userID || null; payload.active = true; payload.published = false;
    const response = await supabaseRest(env, '/rest/v1/annual_exam_assessments', { method:'POST', headers:{'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload) });
    row = Array.isArray(response) ? response[0] : null;
  }
  return { success:true, message:'Hasil ujian tahunan berhasil disimpan.', exam:row?mapAnnualExamRow(row):null };
}
