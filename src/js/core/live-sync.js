(function () {
  'use strict';

  const ACTIVE_INTERVAL = 4000;
  const IDLE_INTERVAL = 12000;
  const FOCUS_REFRESH_MIN_AGE = 2500;
  let lastPollAt = 0;
  let refreshTimer = null;
  let deltaTimer = null;
  const moduleQueue = new Set();

  function changedModules(next) {
    const current = globalLiveSyncVersions || {};
    const keys = new Set([...Object.keys(current), ...Object.keys(next || {})]);
    return [...keys].filter(key => String(current[key] || '0') !== String((next || {})[key] || '0'));
  }

  function requestFastDashboardRefresh(reason, delay = 900) {
    if (!currentUser || !currentUser.userType) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (typeof fetchDashboardData === 'function') fetchDashboardData({ silent:true, reason:reason || 'background-reconcile' });
    }, delay);
  }

  function renderChangedModules(modules, data) {
    const set = new Set(modules || []);
    if (set.has('announcements') && Array.isArray(data.announcements)) {
      globalPengumumanList = data.announcements;
      if (typeof renderPengumumanList === 'function') renderPengumumanList();
      if (typeof renderDashboardAcademyUpdates === 'function') renderDashboardAcademyUpdates();
      if (typeof renderNotificationCenter === 'function') renderNotificationCenter();
    }
    if (set.has('attendance') && Array.isArray(data.attendance)) {
      // Live attendance payload is optimized: old signatures are preserved locally,
      // while newly-created/recent rows still arrive with their signature data.
      // Replacing by the server ID list also makes cross-device deletes disappear
      // immediately instead of being merged forever into stale local rows.
      const currentById = new Map((globalAbsensiList || []).map(item => [String(item.absensiID || ''), item]));
      globalAbsensiList = data.attendance.map(item => {
        const previous = currentById.get(String(item.absensiID || '')) || {};
        return {
          ...previous,
          ...item,
          tandaTangan: item.tandaTangan || previous.tandaTangan || '',
          ttdSiswa: item.ttdSiswa || previous.ttdSiswa || ''
        };
      });
      if (typeof setupFilterDropdown === 'function') setupFilterDropdown();
      if (typeof renderTabelRiwayat === 'function') renderTabelRiwayat();
      if (typeof renderLearningProgressViews === 'function') renderLearningProgressViews();
    }
    if (set.has('assignments') && Array.isArray(data.assignments)) {
      globalTugasList = data.assignments;
      if (typeof renderTabelTugas === 'function') renderTabelTugas();
    }
    if (set.has('progress') && Array.isArray(data.progress)) {
      globalLearningProgressList = data.progress;
      if (typeof renderLearningProgressViews === 'function') renderLearningProgressViews();
    }
    if (set.has('schedules')) {
      if (Array.isArray(data.schedules)) globalJadwalList = data.schedules;
      if (Array.isArray(data.replacements)) globalJadwalPenggantiList = data.replacements;
      if (Array.isArray(data.scheduleOverrides)) globalScheduleOverrides = data.scheduleOverrides;
      if (typeof renderTabelJadwal === 'function') renderTabelJadwal();
      if (typeof renderTabelJadwalPengganti === 'function') renderTabelJadwalPengganti();
      if (calendarInstance && typeof renderCalendarEvents === 'function') renderCalendarEvents();
      if (typeof setupMakeupFilters === 'function') setupMakeupFilters();
      if (typeof renderRoomAvailability === 'function') renderRoomAvailability();
    }
    if (set.has('teacher_attendance') && Array.isArray(data.teacherAttendance)) {
      globalTeacherAttendanceList = data.teacherAttendance;
      if (typeof renderAdminTeacherManagement === 'function') renderAdminTeacherManagement();
      if (typeof renderTeacherMonitoring === 'function') renderTeacherMonitoring();
    }
    if (set.has('repertoire') && Array.isArray(data.repertoire)) {
      globalRepertoireList = data.repertoire;
      if (typeof renderRepertoirePage === 'function') renderRepertoirePage();
    }
    if (set.has('exams') && Array.isArray(data.exams)) {
      window.globalAnnualExamList = data.exams;
      if (typeof renderAnnualExamList === 'function') renderAnnualExamList();
    }
    if (set.has('practice')) {
      if (Array.isArray(data.practiceResources)) practiceResources = data.practiceResources;
      if (Array.isArray(data.mediaEvaluations)) mediaEvaluations = data.mediaEvaluations;
      if (typeof renderPracticeHub === 'function') renderPracticeHub();
    }
  }

  function markModulesLoaded(modules) {
    (modules || []).forEach(module => {
      globalLoadedModules.add(module);
      globalPartialModules.delete(module);
    });
  }

  async function ensureLiveModules(modules, options = {}) {
    const requested = [...new Set((modules || []).filter(Boolean))];
    const needed = requested.filter(module => options.force || globalPartialModules.has(module) || !globalLoadedModules.has(module));
    if (!needed.length || !currentUser?.userType) return true;
    const key = needed.slice().sort().join(',');
    if (globalModuleLoadInFlight.has(key)) return globalModuleLoadInFlight.get(key);
    // A user opening the attendance screen needs the existing detailed signature
    // window; routine background sync only needs a small recent window.
    const requestedRpcModules = needed.map(module => module === 'attendance' ? 'attendance_detail' : module);
    const task = LegacyAPI.rpc('getLiveModuleData', [{ modules:requestedRpcModules }])
      .then(res => {
        if (!res || res.success === false) throw new Error(res?.message || 'Data modul gagal dimuat.');
        renderChangedModules(needed, res);
        markModulesLoaded(needed);
        return true;
      })
      .catch(error => {
        console.warn('[Legacy Module Loader]', needed.join(','), error?.message || error);
        return false;
      })
      .finally(() => globalModuleLoadInFlight.delete(key));
    globalModuleLoadInFlight.set(key, task);
    return task;
  }

  async function flushModuleQueue() {
    deltaTimer = null;
    if (!currentUser || !currentUser.userType || !moduleQueue.size) return;
    const modules = [...moduleQueue]; moduleQueue.clear();
    const lightweight = modules.filter(x => ['announcements','attendance','assignments','progress','schedules','teacher_attendance','repertoire','exams','practice'].includes(x));
    const heavy = modules.filter(x => !lightweight.includes(x));
    try {
      if (lightweight.length) {
        const res = await LegacyAPI.rpc('getLiveModuleData', [{ modules:lightweight }]);
        if (res && res.success !== false) {
          renderChangedModules(lightweight, res);
          markModulesLoaded(lightweight);
        }
      }
    } catch (error) {
      console.debug('[Legacy Live Sync] delta sync skipped:', error?.message || error);
      requestFastDashboardRefresh('delta-fallback', 700);
    }
    // Changes to people/admin control can affect many cross-linked selectors. Reconcile
    // those in the background, but never block the current screen.
    if (heavy.length) requestFastDashboardRefresh('cross-module-change', 800);
  }

  function queueModuleSync(modules) {
    (modules || []).forEach(m => moduleQueue.add(m));
    if (deltaTimer) clearTimeout(deltaTimer);
    deltaTimer = setTimeout(flushModuleQueue, 90);
  }

  async function pollLiveSync(force = false) {
    if (globalLiveSyncRunning || !currentUser || !currentUser.userType) return;
    if (document.visibilityState === 'hidden' && !force) return;
    const now = Date.now();
    if (!force && now - lastPollAt < 1200) return;
    lastPollAt = now;
    globalLiveSyncRunning = true;
    try {
      const res = await LegacyAPI.rpc('getLiveSyncState', []);
      if (!res || res.success === false || !res.versions) return;
      const next = res.versions || {};
      const hadBaseline = Object.keys(globalLiveSyncVersions || {}).length > 0;
      const changed = hadBaseline ? changedModules(next) : [];
      globalLiveSyncVersions = next;
      if (changed.length) queueModuleSync(changed);
    } catch (error) {
      console.debug('[Legacy Live Sync] poll skipped:', error?.message || error);
    } finally { globalLiveSyncRunning = false; }
  }

  function nextSyncDelay() {
    const recentlyActive = Date.now() - (globalLastInteractionAt || 0) < 30000;
    return recentlyActive ? ACTIVE_INTERVAL : IDLE_INTERVAL;
  }

  function scheduleNextPoll() {
    if (globalLiveSyncTimer) clearTimeout(globalLiveSyncTimer);
    if (!currentUser?.userType) return;
    globalLiveSyncTimer = setTimeout(async () => {
      globalLiveSyncTimer = null;
      await pollLiveSync(false);
      scheduleNextPoll();
    }, nextSyncDelay());
  }

  function configureGlobalLiveSync() {
    if (!currentUser || !currentUser.userType) return;
    if (globalLiveSyncTimer) clearTimeout(globalLiveSyncTimer);
    pollLiveSync(true).finally(scheduleNextPoll);
  }

  function stopGlobalLiveSync() {
    if (globalLiveSyncTimer) clearTimeout(globalLiveSyncTimer);
    globalLiveSyncTimer = null; globalLiveSyncVersions = {}; globalLiveSyncRunning = false;
    globalLoadedModules.clear();
    globalPartialModules.clear();
    globalModuleLoadInFlight.clear();
    moduleQueue.clear();
    if (deltaTimer) clearTimeout(deltaTimer); deltaTimer = null;
  }

  const mutationToModule = {
    addPengumuman:'announcements',deletePengumuman:'announcements',recordAbsensi:'attendance',updateAbsensi:'attendance',deleteAbsensi:'attendance',
    addTugasCombined:'assignments',submitTugasJawaban:'assignments',deleteTugas:'assignments',saveLearningProgress:'progress',deleteLearningProgress:'progress',
    updateJadwal:'schedules',deleteJadwal:'schedules',saveScheduleOverride:'schedules',deleteScheduleOverride:'schedules',addJadwalPengganti:'schedules',deleteJadwalPengganti:'schedules',
    recordTeacherAttendance:'teacher_attendance',deleteTeacherAttendance:'teacher_attendance',saveStudentRepertoire:'repertoire',deleteStudentRepertoire:'repertoire',
    saveAnnualExam:'exams',publishAnnualExam:'exams',deleteAnnualExam:'exams',savePracticeResource:'practice',deletePracticeResource:'practice',saveMediaEvaluation:'practice',deleteMediaEvaluation:'practice',addGuru:'people',updateGuru:'people',deleteGuru:'people',addSiswaCombined:'people',updateSiswa:'people',deleteSiswa:'people',deleteExitedStudentRecord:'people'
  };

  window.addEventListener('legacy:data-mutated', event => {
    const method = event?.detail?.method || '';
    const module = mutationToModule[method];
    if (module) queueModuleSync([module]);
    setTimeout(() => pollLiveSync(true), 140);
  });
  ['pointerdown','keydown','touchstart'].forEach(type => {
    window.addEventListener(type, () => { globalLastInteractionAt = Date.now(); }, { passive:true });
  });
  window.addEventListener('focus', () => {
    globalLastInteractionAt = Date.now();
    if (currentUser?.userType && Date.now() - (dashboardLastLoadedAt || 0) > FOCUS_REFRESH_MIN_AGE) pollLiveSync(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser?.userType) {
      globalLastInteractionAt = Date.now();
      pollLiveSync(true);
      scheduleNextPoll();
    }
  });

  window.configureGlobalLiveSync = configureGlobalLiveSync;
  window.stopGlobalLiveSync = stopGlobalLiveSync;
  window.requestFastDashboardRefresh = requestFastDashboardRefresh;
  window.queueLiveModuleSync = queueModuleSync;
  window.ensureLiveModules = ensureLiveModules;
  window.applyLiveModulePayload = renderChangedModules;
})();
