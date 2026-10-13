let currentUser = { userType: '', userID: '', userName: '' };
    let loginType = 'siswa';
    let globalSiswaList = [];
    let globalJadwalList = [];

    function isOperationalStudent(student) {
      return String(student?.status || '').trim().toLowerCase() === 'aktif';
    }
    // Student class context: presentation only; never mutates server records.
    let lmcSelectedStudentClassKey = '';
    let lmcCurrentStudentClassInfo = null;
    function lmcClassText(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
    // Preserve the last fully resolved class context across a PWA reload.
    // Cache is strictly scoped to the authenticated student ID (not a display name).
    function lmcStudentClassesCacheKey() {
      const id = String(currentUser.userID || '').trim();
      return currentUser.userType === 'siswa' && id ? 'lmcStudentClasses:v2:' + id : '';
    }
    function lmcStudentClassItems() {
      if (currentUser.userType !== 'siswa') return [];
      const key = lmcStudentClassesCacheKey();
      const record = (globalSiswaList || []).find(s => String(s.siswaID || '') === String(currentUser.userID || ''));
      const candidates = [lmcCurrentStudentClassInfo, record].filter(Boolean);
      // Prefer complete class arrays over legacy flattened student records.
      const resolved = candidates.find(s => Array.isArray(s.kelasList) && s.kelasList.length > 1)
        || candidates.find(s => Array.isArray(s.kelasList) && s.kelasList.length)
        || candidates[0] || null;
      let entries = Array.isArray(resolved?.kelasList) ? resolved.kelasList : [];
      if (entries.length > 1 && key) {
        try { sessionStorage.setItem(key, JSON.stringify(entries)); } catch (_) {}
      }
      // Partial dashboard refreshes may omit kelasList. Do not erase a verified
      // multi-class selector just because one response is incomplete.
      if (!entries.length && key) {
        try {
          const cached = JSON.parse(sessionStorage.getItem(key) || '[]');
          if (Array.isArray(cached) && cached.length > 1) entries = cached;
        } catch (_) {}
      }
      if (!entries.length && resolved) entries = [{instrumen:resolved.instrumen, guru:resolved.guru, guruID:resolved.guruID, status:resolved.status}];
      return entries.map((c,index) => ({...c, _key:String(c.kelasSiswaID || c.classID || c.studentClassID || [lmcClassText(c.instrumen),lmcClassText(c.guruID || c.guru),index].join(':'))}));
    }
    function lmcStudentClassSelected() {
      const available = lmcStudentClassItems().filter(c => lmcClassText(c.status || 'Aktif') === 'aktif');
      if (!available.length) { lmcSelectedStudentClassKey = ''; return null; }
      const selected = available.find(c => c._key === lmcSelectedStudentClassKey);
      const chosen = selected || available[0];
      lmcSelectedStudentClassKey = chosen._key;
      return chosen;
    }
    function lmcStudentRecordMatchesClass(item) {
      if (currentUser.userType !== 'siswa') return true;
      const selected = lmcStudentClassSelected();
      if (!selected) return true;
      const instrument = lmcClassText(item.instrumen || item.instrument || item.namaInstrumen);
      const teacher = lmcClassText(item.guru || item.guruCatat || item.teacherName || item.teacher || item.namaGuru);
      const teacherId = lmcClassText(item.guruID || item.teacherID || item.teacherId);
      const classId = lmcClassText(item.kelasSiswaID || item.studentClassID || item.student_class_id);
      if (classId && selected.kelasSiswaID) return classId === lmcClassText(selected.kelasSiswaID);
      if (instrument && instrument !== lmcClassText(selected.instrumen)) return false;
      if (teacherId && selected.guruID && teacherId !== lmcClassText(selected.guruID)) return false;
      if (teacher && selected.guru && teacher !== lmcClassText(selected.guru)) return false;
      // Ambiguous legacy records with no class/teacher/instrument are not assigned to a random class.
      return !!(classId || instrument || teacherId || teacher);
    }
    function lmcRenderStudentClassPicker() {
      let node = document.getElementById('lmc-student-class-bar');
      const section = document.querySelector('.content-section.active');
      const activities = new Set(['section-progress','section-tugas','section-repertoire','section-practice-hub','section-learning-progress']);
      if (currentUser.userType !== 'siswa' || !section || !activities.has(section.id)) {
        if (node) node.remove();
        return;
      }
      // Exited/on-leave classes remain in records but are NOT selectable as active classes.
      const classes = lmcStudentClassItems().filter(c => lmcClassText(c.status || 'Aktif') === 'aktif');
      if (classes.length < 2) { if (node) node.remove(); lmcStudentClassSelected(); return; }
      const selected = lmcStudentClassSelected();
      if (!node) { node = document.createElement('div'); node.id = 'lmc-student-class-bar'; }
      // Move the picker INSIDE the current activity section, never above the dashboard.
      if (node.parentElement !== section) section.insertBefore(node, section.firstChild);
      node.innerHTML = '<div class="lmc-class-picker-label"><strong>Filter Kelas</strong><small>Materi dan aktivitas sesuai instrumen dan guru yang dipilih</small></div><select id="lmc-student-class-select" aria-label="Pilih kelas pembelajaran">' +
        classes.map(c => '<option value="'+lmcEscapeClass(c._key)+'"'+(selected && selected._key===c._key?' selected':'')+'>'+lmcEscapeClass(c.instrumen || 'Instrumen')+' — '+lmcEscapeClass(c.guru || 'Guru')+'</option>').join('') + '</select>';
      node.querySelector('select').addEventListener('change', e => {
        lmcSelectedStudentClassKey = e.target.value;
        if (typeof renderTabelTugas === 'function') renderTabelTugas();
        if (typeof renderRepertoirePage === 'function') renderRepertoirePage();
        if (typeof renderTabelJadwal === 'function') renderTabelJadwal();
        if (typeof renderTabelRiwayat === 'function') renderTabelRiwayat();
        if (typeof renderLearningProgressViews === 'function') renderLearningProgressViews();
        if (typeof renderPracticeHub === 'function') renderPracticeHub();
      });
    }
    function lmcEscapeClass(text) {return String(text || '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
    let globalAbsensiList = [];
    let globalTugasList = [];
    let globalGuruList = [];
    let globalJadwalPenggantiList = [];
    let globalScheduleOverrides = [];
    let globalPengumumanList = [];
    let globalLearningProgressList = [];
    let globalRepertoireList = [];
    let globalStudentHistory = [];
    let globalTeacherAttendanceList = [];
    let studentReportView = 'all';
    let globalSelectedLearningProgressStudent = '';
    let cropperInstance = null;
    let selectedFileName = 'profile.jpg';
    let calendarInstance = null;
    let sigCanvases = {};
    let dashboardRequestNumber = 0;
    let notificationTimer = null;
    let liveAnnouncementTimer = null;
    let liveAnnouncementRequestInFlight = false;
    let adminAttendanceSyncTimer = null;
    let globalLiveSyncTimer = null;
    let globalLiveSyncRunning = false;
    let globalLiveSyncVersions = {};
    let globalLoadedModules = new Set();
    let globalPartialModules = new Set();
    let globalModuleLoadInFlight = new Map();
    let globalLastInteractionAt = Date.now();
    let dashboardLoadInFlight = false;
    let dashboardRefreshQueued = false;
    let dashboardLastLoadedAt = 0;
    const AUTH_STORAGE_KEY = 'legacyMusicCenterAuth';
    const AUTH_COOKIE_KEY = 'legacyMusicCenterAuthPersistent';
    const THEME_STORAGE_KEY = 'legacyThemePreference';
    let themeMediaListenerReady = false;

