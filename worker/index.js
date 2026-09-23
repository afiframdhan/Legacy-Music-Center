const COOKIE_NAME = 'legacy_api_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

const COMMON = new Set([
  'getDashboardData', 'getGuruList', 'updateUserPhoto', 'updateSelfProfile'
]);
const STUDENT = new Set([...COMMON, 'submitTugasJawaban']);
const TEACHER = new Set([
  ...COMMON,
  'saveLearningProgress', 'deleteLearningProgress', 'getLearningProgressPrintLogo',
  'addTugasCombined', 'deleteTugas', 'recordAbsensi', 'updateAbsensi', 'deleteAbsensi',
  'updateSiswa', 'updateJadwal', 'deleteJadwal',
  'addSiswaCombined', 'deleteSiswa', 'getStudent360Report'
]);
const ADMIN = new Set([
  ...TEACHER,
  'addJadwalPengganti', 'deleteJadwalPengganti',
  'addPengumuman', 'deletePengumuman',
  'addGuru', 'updateGuru', 'deleteGuru',
  'recordTeacherAttendance', 'deleteTeacherAttendance',
  'deleteExitedStudentRecord'
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'legacy-music-center-api',
        loginBackend: hasSupabaseConfig(env) ? 'supabase-bcrypt+legacy-pbkdf2' : 'unconfigured',
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

    if (url.pathname === '/api/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, {
        'set-cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`
      });
    }

    if (url.pathname === '/api/rpc' && request.method === 'POST') {
      return handleRpc(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
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

    let result;
    try {
      result = await verifyLoginSupabaseRpc(env, args);
    } catch (error) {
      console.error('Supabase login RPC error:', error);
      return json({
        ok:true,
        data:{ success:false, message:'Login gagal diproses. Silakan coba lagi.' }
      });
    }

    if (!result.success) return json({ ok:true, data:result });

    const session = {
      userType: result.userType,
      userID: result.userID,
      userName: result.userName,
      exp: Math.floor(Date.now()/1000) + SESSION_MAX_AGE
    };

    const token = await signSession(session, env.SESSION_SECRET);

    return json({ ok:true, data:result }, 200, {
      'set-cookie': `${COOKIE_NAME}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Strict`
    });
  }

  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_TOKEN) {
    return json({ ok:false, error:'Konfigurasi Apps Script belum lengkap.' }, 500);
  }

  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return json({ ok:false, error:'Sesi login tidak valid atau sudah berakhir.' }, 401);
  if (!isAllowed(session.userType, method)) return json({ ok:false, error:'Akses fungsi ditolak.' }, 403);

  // PHASE 2: guru list is now read from Supabase.
  if (method === 'getGuruList') {
    try {
      const result = await getGuruListSupabase(env);
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Supabase getGuruList error, falling back to Apps Script:', error);
      const fallback = await gasRpc(env, method, args);
      return json({ ok:true, data:fallback });
    }
  }

  // PHASE 9: dashboard reads from Supabase.
  // TEST safety: if assembly fails, keep the existing Apps Script dashboard.
  if (method === 'getDashboardData') {
    try {
      const result = await getDashboardDataSupabase(env, session);
      return json({ ok:true, data:JSON.stringify(result) });
    } catch (error) {
      console.error('Supabase dashboard error, falling back to Apps Script:', error);
      const fallback = await gasRpc(env, method, [session.userID, session.userType]);
      return json({ ok:true, data:fallback });
    }
  }


  if (method === 'getStudent360Report') {
    try {
      const identifier = String(args[0] || '').trim();
      const result = await buildStudent360ReportSupabase(env, session, identifier);
      return json({ ok:true, data:result });
    } catch (error) {
      console.error('Student 360 report error:', error);
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

    return json({ ok:true, data:result });
  }

  if (method === 'updateSelfProfile') {
    const result = await gasRpc(env, method, safeArgs);

    if (result && result.success === true) {
      try {
        const payload = safeArgs[0] && typeof safeArgs[0] === 'object' ? safeArgs[0] : {};
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
        console.error('Supabase identity mirror failed for updateSelfProfile:', error);
      }
    }

    return json({ ok:true, data:result });
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
    }

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
      }
    }

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
        }
      }

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
        }
      }

      return json({ ok:true, data:result });
    } catch (error) {
      console.error(`Phase 10D progress operation failed for ${method}:`, error);
      return json({ ok:true, data:{ success:false, message:'Gagal memproses Progress Belajar. Silakan coba lagi.' } });
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
      }
    }

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
        ctx.waitUntil(
          gasRpc(env, 'phase10UpsertAnnouncementShadow', [result.announcement]).catch(error => {
            console.error('Apps Script announcement shadow failed:', error);
          })
        );
      }
    }

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

    return json({ ok:true, data:result });
  }

  if (method === 'deleteExitedStudentRecord') {
    const result = await gasRpc(env, method, safeArgs);

    if (result && result.success === true) {
      try {
        await supabaseRpc(env, 'legacy_delete_exited_student', {
          p_identifier: String(safeArgs[0] || '').trim()
        });
        await syncStudentHistoryFromAppsScript(env, session);
      } catch (error) {
        console.error('Supabase exited-student mirror failed:', error);
      }
    }

    return json({ ok:true, data:result });
  }

  const result = await gasRpc(env, method, safeArgs);
  return json({ ok:true, data:result });
}

function hasSupabaseConfig(env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
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
    throw new Error(`Supabase RPC HTTP ${response.status}: ${text.slice(0,500)}`);
  }

  let rows;
  try { rows = JSON.parse(text); }
  catch (_) { throw new Error(`Supabase RPC non-JSON: ${text.slice(0,300)}`); }

  const account = Array.isArray(rows) ? rows[0] : null;
  if (account) {
    return { success:true, userID:String(account.user_id || ''), userName:String(account.display_name || ''), userType:String(account.role || role) };
  }
  return verifyImportedPbkdf2Login(env, role, username, password);
}

async function verifyImportedPbkdf2Login(env, role, username, password) {
  const rows = await supabaseRest(env, `/rest/v1/auth_accounts?select=user_id,role,display_name,password_hash_b64,password_salt_b64,password_iterations,active&role=eq.${encodeURIComponent(role)}&active=eq.true&limit=500`);
  const key=String(username||'').trim().toLowerCase();
  const candidates=(Array.isArray(rows)?rows:[]).filter(row=>String(row.user_id||'').trim().toLowerCase()===key||String(row.display_name||'').trim().toLowerCase()===key);
  for(const row of candidates){if(await verifyImportedPbkdf2Password(password,row.password_salt_b64,row.password_hash_b64,row.password_iterations)){return {success:true,userID:String(row.user_id||''),userName:String(row.display_name||''),userType:String(row.role||role)};}}
  return {success:false,message:'Username / Password salah.'};
}
function importedBase64ToBytes(v){const b=atob(String(v||''));const a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
async function verifyImportedPbkdf2Password(password,saltB64,expectedB64,iterations){if(!saltB64||!expectedB64)return false;const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(password||'')),'PBKDF2',false,['deriveBits']);const expected=importedBase64ToBytes(expectedB64);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:importedBase64ToBytes(saltB64),iterations:Number(iterations||210000)},k,expected.length*8);const actual=new Uint8Array(bits);if(actual.length!==expected.length)return false;let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];return diff===0;}


async function getGuruListSupabase(env) {
  const rows = await supabaseRest(env, '/rest/v1/teachers?select=teacher_id,name,email,phone,instrument,status,photo_url&order=name.asc');

  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: String(row.teacher_id || ''),
    nama: String(row.name || ''),
    email: String(row.email || ''),
    noHp: String(row.phone || ''),
    instrumen: String(row.instrument || 'Gitar'),
    status: String(row.status || 'Aktif'),
    foto: String(row.photo_url || '')
  }));
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
    started_on: String(payload.tglDaftar || '').trim() || null,
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
    p_initial_password: method === 'addSiswaCombined' ? 'password123' : null
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


async function buildStudent360ReportSupabase(env, session, identifier) {
  if (!identifier) throw new Error('Identitas siswa tidak ditemukan.');

  let studentRows = await sbRows(env, 'students', {
    student_id:`eq.${identifier}`,
    limit:'1'
  });

  if (!studentRows.length) {
    studentRows = await sbRows(env, 'students', {
      name:`eq.${identifier}`,
      limit:'1'
    });
  }

  const student = studentRows[0];
  if (!student) throw new Error('Data siswa tidak ditemukan di Supabase.');

  const studentId = String(student.student_id || '').trim();

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

  const [classes, schedules, attendance, assignments, progressById, progressByName] = await Promise.all([
    sbRows(env, 'student_classes', { student_id:`eq.${studentId}`, order:'created_at.asc' }),
    sbRows(env, 'schedules', { student_id:`eq.${studentId}`, order:'created_at.asc' }),
    sbRows(env, 'student_attendance', { student_id:`eq.${studentId}`, order:'attendance_date.asc,created_at.asc' }),
    sbRows(env, 'assignments', { student_id:`eq.${studentId}`, order:'created_at.asc' }),
    sbRows(env, 'learning_progress', { student_id:`eq.${studentId}`, order:'last_updated_at.desc.nullslast,created_at.desc' }),
    sbRows(env, 'learning_progress', { student_name_snapshot:`eq.${student.name || ''}`, order:'last_updated_at.desc.nullslast,created_at.desc' })
  ]);

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
      tglKeluar:formatDbDateIso(student.left_on)
    },
    classes:mappedClasses,
    schedules:schedules.map(row => mapSchedule(row, true)),
    attendance:attendance.map(mapAttendance),
    assignments:assignments.map(mapAssignment),
    progress:mappedProgress,
    latestProgress:mappedProgress[0] || null
  };
}

async function buildStudentDashboardSupabase(env, session) {
  const id = session.userID;
  const [students, classes, schedules, attendance, assignments, progress, replacements, announcements] =
    await Promise.all([
      sbRows(env, 'students', { student_id:`eq.${id}`, limit:'1' }),
      sbRows(env, 'student_classes', { student_id:`eq.${id}`, order:'created_at.asc' }),
      sbRows(env, 'schedules', { student_id:`eq.${id}`, order:'created_at.asc' }),
      sbRows(env, 'student_attendance', { student_id:`eq.${id}`, order:'attendance_date.desc,created_at.desc' }),
      sbRows(env, 'assignments', { student_id:`eq.${id}`, order:'created_at.desc' }),
      sbRows(env, 'learning_progress', { student_id:`eq.${id}`, order:'last_updated_at.desc.nullslast,created_at.desc' }),
      sbRows(env, 'replacement_schedules', { student_id:`eq.${id}`, order:'scheduled_date.desc.nullslast,created_at.desc' }),
      sbRows(env, 'announcements', { order:'sent_at.desc.nullslast,created_at.desc' })
    ]);

  const student = students[0];
  if (!student) throw new Error('Data siswa tidak ditemukan di Supabase.');

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

  return {
    success:true,
    userType:'siswa',
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
    schedules:schedules
      .filter(row => String(row.status || 'Aktif').toLowerCase() === 'aktif')
      .map(row => mapSchedule(row, false)),
    absensiList:attendance.map(mapAttendance),
    absensiProgress:{ hadir, total:4 },
    tugasList:assignments.map(mapAssignment),
    learningProgressList:progress.map(mapProgress),
    jadwalPenggantiList:replacements.map(mapReplacement),
    pengumumanList:activeAnnouncementsForRole(
      announcements, 'siswa', student, new Set(), new Set()
    )
  };
}

async function buildTeacherDashboardSupabase(env, session) {
  const id = session.userID;
  const [teachers, students, classes, schedules, attendance, assignments, progress, replacements, announcements] =
    await Promise.all([
      sbRows(env, 'teachers', { teacher_id:`eq.${id}`, limit:'1' }),
      sbRows(env, 'students', { order:'name.asc' }),
      sbRows(env, 'student_classes', { order:'created_at.asc' }),
      sbRows(env, 'schedules', { teacher_id:`eq.${id}`, order:'created_at.asc' }),
      sbRows(env, 'student_attendance', { teacher_id:`eq.${id}`, order:'attendance_date.desc,created_at.desc' }),
      sbRows(env, 'assignments', { teacher_id:`eq.${id}`, order:'created_at.desc' }),
      sbRows(env, 'learning_progress', { teacher_id:`eq.${id}`, order:'last_updated_at.desc.nullslast,created_at.desc' }),
      sbRows(env, 'replacement_schedules', { teacher_id:`eq.${id}`, order:'scheduled_date.desc.nullslast,created_at.desc' }),
      sbRows(env, 'announcements', { order:'sent_at.desc.nullslast,created_at.desc' })
    ]);

  const teacher = teachers[0];
  if (!teacher) throw new Error('Data guru tidak ditemukan di Supabase.');

  const classMap = new Map();
  for (const row of classes) {
    const key = String(row.student_id || '');
    if (!classMap.has(key)) classMap.set(key, []);
    classMap.get(key).push(row);
  }

  const teacherStudents = [];
  const studentIds = new Set();
  const studentNames = new Set();

  for (const student of students) {
    const allClasses = classMap.get(student.student_id) || [];
    const teacherClassesRaw = allClasses.filter(row => String(row.teacher_id || '') === id);

    const shouldInclude =
      teacherClassesRaw.length > 0 ||
      String(student.teacher_id || '') === id ||
      (!student.teacher_id && allClasses.length === 0);

    if (!shouldInclude) continue;

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
  const todayCount = schedules.filter(row =>
    String(row.status || 'Aktif') === 'Aktif' &&
    String(row.day_name || '').trim().toLowerCase() === todayName
  ).length;

  return {
    success:true,
    userType:'guru',
    guruInfo:{
      userID:teacher.teacher_id,
      nama:teacher.name || '',
      email:teacher.email || '',
      noHp:teacher.phone || '',
      instrumen:teacher.instrument || 'Gitar',
      foto:teacher.photo_url || ''
    },
    siswaList:teacherStudents,
    jadwal:schedules.map(row => mapSchedule(row, true)),
    absensiList:attendance.map(mapAttendance),
    stats:{ totalSiswa:teacherStudents.length, sesiJadwalAktif:todayCount },
    tugasList:assignments.map(mapAssignment),
    learningProgressList:progress.map(mapProgress),
    jadwalPenggantiList:replacements.map(mapReplacement),
    pengumumanList:activeAnnouncementsForRole(
      announcements, 'guru', null, studentIds, studentNames, teacher
    )
  };
}

async function buildAdminDashboardSupabase(env, session) {
  const [admins, students, teachers, classes, schedules, attendance, progress, replacements, announcements, history, teacherAttendance] =
    await Promise.all([
      sbRows(env, 'admins', { admin_id:`eq.${session.userID}`, limit:'1' }),
      sbRows(env, 'students', { order:'name.asc' }),
      sbRows(env, 'teachers', { order:'name.asc' }),
      sbRows(env, 'student_classes', { order:'created_at.asc' }),
      sbRows(env, 'schedules', { order:'created_at.asc' }),
      sbRows(env, 'student_attendance', { order:'attendance_date.desc,created_at.desc' }),
      sbRows(env, 'learning_progress', { order:'last_updated_at.desc.nullslast,created_at.desc' }),
      sbRows(env, 'replacement_schedules', { order:'scheduled_date.desc.nullslast,created_at.desc' }),
      sbRows(env, 'announcements', { order:'sent_at.desc.nullslast,created_at.desc' }),
      sbRows(env, 'student_history', { order:'event_at.desc.nullslast,created_at.desc' }),
      sbRows(env, 'teacher_attendance', { order:'attendance_date.desc,created_at.desc' })
    ]);

  const admin = admins[0] || null;

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
      tglKeluar:formatDbDateIso(student.left_on)
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

  return {
    success:true,
    userType:'admin',
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
    jadwal:schedules
      .filter(row => knownNames.has(String(row.student_name_snapshot || '').trim().toLowerCase()))
      .map(row => mapSchedule(row, true)),
    absensiList:attendance.map(mapAttendance),
    learningProgressList:progress.map(mapProgress),
    jadwalPenggantiList:replacements.map(mapReplacement),
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
  const list = historyRows.map(row => ({
    riwayatID:row.history_id || '',
    nama:row.student_name_snapshot || '',
    jenis:row.event_type || '',
    tanggal:formatDbDateIso(row.event_at),
    statusSebelum:row.previous_status || '',
    statusSesudah:row.new_status || '',
    instrumen:row.instrument || '',
    guru:row.teacher_name_snapshot || '',
    keterangan:row.description || '',
    siswaID:row.student_id || '',
    guruID:row.teacher_id || ''
  }));

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
        keterangan:'Status siswa keluar'
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
