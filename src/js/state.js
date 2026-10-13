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
    function lmcStudentClassItems() {
      if (currentUser.userType !== 'siswa') return [];
      const student = (globalSiswaList || []).find(s => String(s.siswaID || '') === String(currentUser.userID || ''))
        || (globalSiswaList || []).find(s => lmcClassText(s.nama) === lmcClassText(currentUser.userName));
      const resolvedStudent = student || lmcCurrentStudentClassInfo;
      if (!resolvedStudent) return [];
      const entries = Array.isArray(resolvedStudent.kelasList) && resolvedStudent.kelasList.length ? resolvedStudent.kelasList
        : [{instrumen:resolvedStudent.instrumen, guru:resolvedStudent.guru, guruID:resolvedStudent.guruID, status:resolvedStudent.status}];
      return entries.map((c,index) => ({...c, _key:String(c.kelasSiswaID || c.classID || c.studentClassID || [lmcClassText(c.instrumen),lmcClassText(c.guruID || c.guru),index].join(':'))}));
    }
    function lmcStudentClassSelected() {
      const all = lmcStudentClassItems();
      if (all.length < 2) return null;
      const available = all.filter(c => lmcClassText(c.status || 'Aktif') === 'aktif');
      const selected = all.find(c => c._key === lmcSelectedStudentClassKey);
      const chosen = selected || available[0] || all[0];
      lmcSelectedStudentClassKey = chosen ? chosen._key : '';
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
      if (currentUser.userType !== 'siswa') { if(node) node.remove(); return; }
      const classes = lmcStudentClassItems();
      if (classes.length < 2) { if(node) node.remove(); return; }
      const selected = lmcStudentClassSelected();
      if (!node) {
        node = document.createElement('div'); node.id = 'lmc-student-class-bar';
        const content = document.querySelector('.content') || document.querySelector('.main-content') || document.querySelector('main') || document.getElementById('contentArea');
        if (!content) return;
        content.insertBefore(node, content.firstChild);
      }
      node.innerHTML = '<label for="lmc-student-class-select">Kelas yang ditampilkan</label><select id="lmc-student-class-select" aria-label="Pilih kelas pembelajaran">' +
        classes.map(c => '<option value="'+lmcEscapeClass(c._key)+'"'+(selected && selected._key===c._key?' selected':'')+'>'+lmcEscapeClass(c.instrumen || 'Instrumen')+' — '+lmcEscapeClass(c.guru || 'Guru')+' ('+lmcEscapeClass(c.status || 'Aktif')+')</option>').join('') + '</select>';
      node.querySelector('select').addEventListener('change', e => {
        lmcSelectedStudentClassKey = e.target.value;
        if (typeof renderTabelTugas === 'function') renderTabelTugas();
        if (typeof renderRepertoirePage === 'function') renderRepertoirePage();
        if (typeof renderTabelJadwal === 'function') renderTabelJadwal();
        if (typeof renderTabelRiwayat === 'function') renderTabelRiwayat();
        if (typeof renderLearningProgressViews === 'function') renderLearningProgressViews();
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

