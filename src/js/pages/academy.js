    function formatAcademyDate(value) {
      const text = String(value || '').trim();
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
      return text || '-';
    }

    function getAnnouncementTargetLabel(item) {
      const labels = { semua:'Semua Guru & Siswa', semua_guru:'Semua Guru', guru_tertentu:item.targetDetail || 'Guru Tertentu', semua_siswa:'Semua Siswa', siswa_tertentu:item.targetDetail || 'Siswa Tertentu' };
      return labels[item.target] || 'Semua Guru & Siswa';
    }

    function renderDashboardAcademyUpdates() {
      const target = currentUser.userType === 'siswa' ? document.getElementById('dashboardUpdatesSiswa') : document.getElementById('dashboardUpdatesGuru');
      if (!target || currentUser.userType === 'admin') return;
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const upcoming = globalJadwalPenggantiList.filter(item => String(item.tanggalPelaksanaan || '') >= todayKey).sort((a,b) => String(a.tanggalPelaksanaan).localeCompare(String(b.tanggalPelaksanaan)));
      const makeup = upcoming[0] || globalJadwalPenggantiList[0] || null;
      const announcement = globalPengumumanList[0] || null;
      const makeupCard = makeup
        ? `<div class="dashboard-update-card" onclick="switchTab('section-pengganti')"><div class="dashboard-update-top"><div class="dashboard-update-label">↻ Make-up Class</div><span class="dashboard-update-link">Detail →</span></div><strong>${escapeTaskHtml(makeup.namaSiswa || 'Jadwal Pergantian')}</strong><p>${escapeTaskHtml(makeup.hariPelaksanaan || '')}, ${escapeTaskHtml(formatAcademyDate(makeup.tanggalPelaksanaan))} • ${escapeTaskHtml(makeup.jamMulai || '-')}–${escapeTaskHtml(makeup.jamSelesai || '-')} • ${escapeTaskHtml(makeup.ruangan || '-')}</p></div>`
        : `<div class="dashboard-update-card" onclick="switchTab('section-pengganti')"><div class="dashboard-update-top"><div class="dashboard-update-label">↻ Make-up Class</div><span class="dashboard-update-link">Lihat →</span></div><strong>Belum ada jadwal pergantian</strong><p>Jadwal baru akan tampil di sini.</p></div>`;
      const announcementCard = announcement
        ? `<div class="dashboard-update-card" onclick="switchTab('section-pengumuman')"><div class="dashboard-update-top"><div class="dashboard-update-label">📢 Pengumuman</div><span class="dashboard-update-link">Detail →</span></div><strong>${escapeTaskHtml(announcement.judul || '-')}</strong><p>${escapeTaskHtml(announcement.isi || '-')}</p></div>`
        : `<div class="dashboard-update-card" onclick="switchTab('section-pengumuman')"><div class="dashboard-update-top"><div class="dashboard-update-label">📢 Pengumuman</div><span class="dashboard-update-link">Lihat →</span></div><strong>Belum ada pengumuman</strong><p>Informasi terbaru Academy akan tampil di sini.</p></div>`;
      target.innerHTML = makeupCard + announcementCard;
    }

    function autoFillJadwalPenggantiData(namaSiswa) {
      if (!namaSiswa) return;
      const sObj = globalSiswaList.find(s => String(s.nama).trim().toLowerCase() === String(namaSiswa).trim().toLowerCase());
      if (sObj && sObj.guru) {
        document.getElementById('penggantiGuruSelect').value = sObj.guru;
      }
    }

    function getStudentByNameForOverride(name) {
      return (globalSiswaList || []).find(item => String(item.nama || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()) || null;
    }

    function scheduleOverrideStudentClasses(student) {
      if (!student) return [];
      if (typeof getStudentClassesForUI === 'function') {
        try { return getStudentClassesForUI(student) || []; } catch (_) {}
      }
      if (Array.isArray(student.kelasList) && student.kelasList.length) return student.kelasList;
      return String(student.instrumen || '').split(',').map(value => ({ instrumen:value.trim(), guru:student.guru || '' })).filter(item => item.instrumen);
    }

    function scheduleOverrideStudentHasInstrument(student, instrument) {
      const needle = String(instrument || '').trim().toLowerCase();
      if (!needle) return true;
      return scheduleOverrideStudentClasses(student).some(item => String(item.instrumen || '').trim().toLowerCase() === needle);
    }

    function populateScheduleOverrideInstrumentFilter() {
      const select = document.getElementById('penggantiInstrumenFilter');
      if (!select) return;
      const current = select.value;
      const values = [...new Set((globalSiswaList || []).flatMap(student => scheduleOverrideStudentClasses(student).map(item => String(item.instrumen || '').trim())).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      select.innerHTML = '<option value="">Semua Instrumen</option>' + values.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      if (values.includes(current)) select.value = current;
    }

    function syncMakeupTeacherFilter() {
      const select = document.getElementById('makeupFilterTeacher');
      if (!select) return;
      const instrument = String(document.getElementById('makeupFilterInstrument')?.value || '').trim().toLowerCase();
      const current = select.value;
      let teachers = (globalGuruList || []).slice();
      if (instrument) {
        const allowed = new Set();
        (globalJadwalList || []).forEach(item => {
          if (String(item.instrumen || '').trim().toLowerCase() === instrument && item.guru) allowed.add(String(item.guru).trim().toLowerCase());
        });
        teachers = teachers.filter(item => allowed.has(String(item.nama || '').trim().toLowerCase()));
      }
      select.innerHTML = '<option value="">Semua Guru</option>' + teachers.map(item => `<option value="${escapeTaskHtml(item.nama || '')}">${escapeTaskHtml(item.nama || '-')}</option>`).join('');
      if (teachers.some(item => String(item.nama || '') === current)) select.value = current;
    }

    function refreshScheduleOverrideFormOptions() {
      const absentSelect = document.getElementById('penggantiSiswaSelect');
      const slotSelect = document.getElementById('penggantiSiswaSlotSelect');
      if (!absentSelect || !slotSelect) return;
      populateScheduleOverrideInstrumentFilter();
      const instrument = String(document.getElementById('penggantiInstrumenFilter')?.value || '').trim();
      const currentAbsent = absentSelect.value;
      const currentSlot = slotSelect.value;
      const students = (globalSiswaList || [])
        .filter(isOperationalStudent)
        .filter(item => scheduleOverrideStudentHasInstrument(item, instrument))
        .sort((a,b) => String(a.nama || '').localeCompare(String(b.nama || ''),'id'));
      const instrumentSuffix = instrument ? ` • ${escapeTaskHtml(instrument)}` : '';
      absentSelect.innerHTML = '<option value="">Pilih Siswa...</option>' + students.map(item => `<option value="${escapeTaskHtml(item.nama || '')}">${escapeTaskHtml(item.nama || '-')}${instrumentSuffix}</option>`).join('');
      slotSelect.innerHTML = '<option value="">— Slot dikosongkan / tidak diganti siswa lain —</option>' + students.map(item => `<option value="${escapeTaskHtml(item.siswaID || '')}">${escapeTaskHtml(item.nama || '-')}${instrumentSuffix}</option>`).join('');
      if (students.some(item => item.nama === currentAbsent)) absentSelect.value = currentAbsent;
      else absentSelect.value = '';
      if (students.some(item => String(item.siswaID || '') === currentSlot)) slotSelect.value = currentSlot;
      else slotSelect.value = '';
      refreshScheduleOverrideOriginalScheduleOptions();
    }

    function refreshScheduleOverrideOriginalScheduleOptions() {
      const studentName = String(document.getElementById('penggantiSiswaSelect')?.value || '').trim();
      const scheduleSelect = document.getElementById('penggantiJadwalAsliSelect');
      if (!scheduleSelect) return;
      const current = scheduleSelect.value;
      const instrument = String(document.getElementById('penggantiInstrumenFilter')?.value || '').trim().toLowerCase();
      const schedules = (globalJadwalList || []).filter(item =>
        String(item.namaSiswa || '').trim().toLowerCase() === studentName.toLowerCase() &&
        (!instrument || String(item.instrumen || '').trim().toLowerCase() === instrument)
      );
      scheduleSelect.innerHTML = '<option value="">Pilih jadwal asli...</option>' + schedules.map(item => `<option value="${escapeTaskHtml(item.jadwalID || '')}">${escapeTaskHtml(item.hari || '-')} • ${escapeTaskHtml(item.jamMulai || '-')}–${escapeTaskHtml(item.jamSelesai || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')} • ${escapeTaskHtml(item.guru || '-')}</option>`).join('');
      if (schedules.some(item => String(item.jadwalID || '') === current)) scheduleSelect.value = current;
      else if (schedules[0]) scheduleSelect.value = schedules[0].jadwalID || '';
      const selected = schedules.find(item => String(item.jadwalID || '') === String(scheduleSelect.value || '')) || schedules[0] || null;
      if (selected) {
        const guruSelect = document.getElementById('penggantiGuruSelect');
        if (guruSelect && selected.guru) guruSelect.value = selected.guru;
        const roomSelect = document.getElementById('penggantiRuanganSelect');
        if (roomSelect && selected.ruangan && Array.from(roomSelect.options).some(opt => opt.value === selected.ruangan)) roomSelect.value = selected.ruangan;
      }
      syncScheduleOverrideOriginalDateHint();
    }

    function syncScheduleOverrideOriginalDateHint() {
      const scheduleId = String(document.getElementById('penggantiJadwalAsliSelect')?.value || '').trim();
      const date = String(document.getElementById('penggantiTanggalAsli')?.value || '').trim();
      const schedule = (globalJadwalList || []).find(item => String(item.jadwalID || '') === scheduleId) || null;
      const hint = document.getElementById('penggantiJadwalAsliHint');
      if (!hint) return;
      if (!schedule) { hint.textContent = ''; return; }
      let text = `Jadwal normal: ${schedule.hari || '-'}, ${schedule.jamMulai || '-'}–${schedule.jamSelesai || '-'} • ${schedule.ruangan || '-'} • ${schedule.guru || '-'}`;
      if (date) {
        const actual = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(date + 'T12:00:00').getDay()] || '';
        if (actual && String(actual).toLowerCase() !== String(schedule.hari || '').toLowerCase()) text += ` • ⚠️ Tanggal ini adalah ${actual}, bukan ${schedule.hari}.`;
      }
      hint.textContent = text;
    }

    function handleSaveScheduleOverride(e) {
      e.preventDefault();
      const scheduleId = String(document.getElementById('penggantiJadwalAsliSelect')?.value || '').trim();
      const schedule = (globalJadwalList || []).find(item => String(item.jadwalID || '') === scheduleId) || null;
      const slotStudentId = String(document.getElementById('penggantiSiswaSlotSelect')?.value || '').trim();
      const slotStudent = (globalSiswaList || []).find(item => String(item.siswaID || '') === slotStudentId) || null;
      const teacherName = String(document.getElementById('penggantiGuruSelect')?.value || '').trim();
      const teacher = (globalGuruList || []).find(item => String(item.nama || '').trim() === teacherName) || null;
      const makeupDate = String(document.getElementById('penggantiTanggal')?.value || '').trim();
      const makeupStart = String(document.getElementById('penggantiJamMulai')?.value || '').trim();
      const makeupEnd = String(document.getElementById('penggantiJamSelesai')?.value || '').trim();
      if (makeupDate && (!makeupStart || !makeupEnd)) {
        showAlert('alertDanger','Jika tanggal make-up diisi, jam mulai dan selesai juga wajib diisi.');
        return false;
      }
      const payload = {
        overrideID:String(document.getElementById('scheduleOverrideID')?.value || '').trim(),
        jadwalID:scheduleId,
        tanggalAsli:String(document.getElementById('penggantiTanggalAsli')?.value || '').trim(),
        siswaAsli:String(document.getElementById('penggantiSiswaSelect')?.value || '').trim(),
        siswaPenggantiID:slotStudentId,
        instrumenPengganti:slotStudent ? (schedule?.instrumen || document.getElementById('penggantiInstrumenFilter')?.value || '') : '',
        tanggalMakeup:makeupDate,
        jamMulaiMakeup:makeupStart,
        jamSelesaiMakeup:makeupEnd,
        guruMakeupID:teacher ? (teacher.id || '') : '',
        guruMakeup:teacherName,
        ruanganMakeup:String(document.getElementById('penggantiRuanganSelect')?.value || '').trim(),
        alasan:String(document.getElementById('penggantiAlasan')?.value || 'Lainnya').trim(),
        catatan:String(document.getElementById('penggantiCatatan')?.value || '').trim()
      };
      if (!payload.jadwalID || !payload.tanggalAsli) {
        showAlert('alertDanger','Pilih jadwal asli dan tanggal yang diganti.');
        return false;
      }
      const btn = document.getElementById('btnSubmitPengganti');
      if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
      google.script.run.withSuccessHandler(res => {
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan Pergantian'; }
        showAlert(res && res.success ? 'alertSuccess' : 'alertDanger', (res && res.message) || 'Pergantian gagal disimpan.');
        if (res && res.success) {
          if (res.override) {
            const id = String(res.override.overrideID || '');
            globalScheduleOverrides = (globalScheduleOverrides || []).filter(item => String(item.overrideID || '') !== id);
            globalScheduleOverrides.unshift(res.override);
            renderTabelJadwalPengganti();
            if (calendarInstance && typeof renderCalendarEvents === 'function') renderCalendarEvents();
          }
          resetScheduleOverrideForm();
          if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['schedules']);
        }
      }).withFailureHandler(error => {
        if (btn) { btn.disabled = false; btn.textContent = 'Simpan Pergantian'; }
        showAlert('alertDanger','Gagal menyimpan pergantian: ' + (error.message || error));
      }).saveScheduleOverride(payload);
      return false;
    }

    function resetScheduleOverrideForm() {
      const form = document.getElementById('formAddJadwalPengganti');
      if (form) form.reset();
      const idEl = document.getElementById('scheduleOverrideID');
      if (idEl) idEl.value = '';
      const btn = document.getElementById('btnSubmitPengganti');
      if (btn) btn.textContent = 'Simpan Pergantian';
      const cancelBtn = document.getElementById('btnCancelPenggantiEdit');
      if (cancelBtn) cancelBtn.style.display = 'none';
      refreshScheduleOverrideFormOptions();
    }

    function openEditScheduleOverride(id) {
      if (currentUser.userType !== 'admin') return;
      const item = (globalScheduleOverrides || []).find(row => String(row.overrideID || '') === String(id || ''));
      if (!item) { showAlert('alertDanger','Data pergantian tidak ditemukan.'); return; }
      const box = document.getElementById('formJadwalPenggantiBox');
      if (box) { box.style.display = 'block'; box.classList.remove('collapsed'); }
      const instrument = String(item.instrumenAsli || '').trim();
      const instrumentSelect = document.getElementById('penggantiInstrumenFilter');
      if (instrumentSelect) {
        populateScheduleOverrideInstrumentFilter();
        if (Array.from(instrumentSelect.options).some(opt => opt.value === instrument)) instrumentSelect.value = instrument;
      }
      refreshScheduleOverrideFormOptions();
      const absentSelect = document.getElementById('penggantiSiswaSelect');
      if (absentSelect) absentSelect.value = item.siswaAsli || '';
      refreshScheduleOverrideOriginalScheduleOptions();
      const scheduleSelect = document.getElementById('penggantiJadwalAsliSelect');
      if (scheduleSelect && Array.from(scheduleSelect.options).some(opt => String(opt.value) === String(item.jadwalID || ''))) scheduleSelect.value = item.jadwalID || '';
      if (document.getElementById('scheduleOverrideID')) document.getElementById('scheduleOverrideID').value = item.overrideID || '';
      if (document.getElementById('penggantiTanggalAsli')) document.getElementById('penggantiTanggalAsli').value = item.tanggalAsli || '';
      if (document.getElementById('penggantiSiswaSlotSelect')) document.getElementById('penggantiSiswaSlotSelect').value = item.siswaPenggantiID || '';
      if (document.getElementById('penggantiTanggal')) document.getElementById('penggantiTanggal').value = item.tanggalMakeup || '';
      if (document.getElementById('penggantiJamMulai')) document.getElementById('penggantiJamMulai').value = item.jamMulaiMakeup || '';
      if (document.getElementById('penggantiJamSelesai')) document.getElementById('penggantiJamSelesai').value = item.jamSelesaiMakeup || '';
      const guruSelect = document.getElementById('penggantiGuruSelect');
      if (guruSelect && item.guruMakeup) guruSelect.value = item.guruMakeup;
      const roomSelect = document.getElementById('penggantiRuanganSelect');
      if (roomSelect && item.ruanganMakeup && Array.from(roomSelect.options).some(opt => opt.value === item.ruanganMakeup)) roomSelect.value = item.ruanganMakeup;
      if (document.getElementById('penggantiAlasan')) document.getElementById('penggantiAlasan').value = item.alasan || 'Lainnya';
      if (document.getElementById('penggantiCatatan')) document.getElementById('penggantiCatatan').value = item.catatan || '';
      syncScheduleOverrideOriginalDateHint();
      const btn = document.getElementById('btnSubmitPengganti');
      if (btn) btn.textContent = 'Update Pergantian';
      const cancelBtn = document.getElementById('btnCancelPenggantiEdit');
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
      box?.scrollIntoView({behavior:'smooth', block:'start'});
    }

    function handleDeleteScheduleOverride(id) {
      if (!confirm('Hapus pergantian jadwal ini? Jadwal rutin tetap tidak berubah.')) return;
      google.script.run.withSuccessHandler(res => {
        showAlert(res && res.success ? 'alertSuccess' : 'alertDanger', (res && res.message) || 'Pergantian gagal dihapus.');
        if (res && res.success) {
          globalScheduleOverrides = (globalScheduleOverrides || []).filter(item => String(item.overrideID || '') !== String(id || ''));
          renderTabelJadwalPengganti();
          if (calendarInstance && typeof renderCalendarEvents === 'function') renderCalendarEvents();
          if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['schedules']);
        }
      }).withFailureHandler(error => showAlert('alertDanger','Gagal menghapus pergantian: ' + (error.message || error))).deleteScheduleOverride(id);
    }

    function handleAddJadwalPengganti(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitPengganti');
      btn.disabled = true; btn.textContent = 'Menyimpan...';

      const namaSiswa = document.getElementById('penggantiSiswaSelect').value;
      const jObj = globalJadwalList.find(j => String(j.namaSiswa).trim().toLowerCase() === String(namaSiswa).trim().toLowerCase());

      const payload = {
        jadwalID: jObj ? jObj.jadwalID : '',
        namaSiswa: namaSiswa,
        alasan: document.getElementById('penggantiAlasan').value,
        tanggalPelaksanaan: document.getElementById('penggantiTanggal').value,
        jamMulai: document.getElementById('penggantiJamMulai').value,
        jamSelesai: document.getElementById('penggantiJamSelesai').value,
        guru: document.getElementById('penggantiGuruSelect').value,
        ruangan: document.getElementById('penggantiRuanganSelect').value,
        currentUserType: currentUser.userType,
        currentUserName: currentUser.userName
      };

      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Simpan Jadwal Pergantian';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if (res.success) {
          document.getElementById('formAddJadwalPengganti').reset();
          if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['schedules']);
        }
      }).withFailureHandler(error => {
        btn.disabled = false; btn.textContent = 'Simpan Jadwal Pergantian';
        showAlert('alertDanger', 'Gagal menyimpan jadwal pergantian: ' + (error.message || error));
      }).addJadwalPengganti(payload);
    }

    function setupMakeupFilters() {
      const box = document.getElementById('makeupFilterBox');
      if (!box) return;
      const isAdmin = currentUser.userType === 'admin';
      const isGuru = currentUser.userType === 'guru';
      box.style.display = isAdmin || isGuru ? 'grid' : 'none';
      const instrumentGroup = document.getElementById('makeupFilterInstrumentGroup');
      const teacherGroup = document.getElementById('makeupFilterTeacherGroup');
      const dayGroup = document.getElementById('makeupFilterDayGroup');
      const searchGroup = document.getElementById('makeupFilterSearchGroup');
      if (instrumentGroup) instrumentGroup.style.display = isAdmin || isGuru ? 'block' : 'none';
      if (teacherGroup) teacherGroup.style.display = isAdmin ? 'block' : 'none';
      if (dayGroup) dayGroup.style.display = isAdmin || isGuru ? 'block' : 'none';
      if (searchGroup) searchGroup.style.display = isAdmin || isGuru ? 'block' : 'none';
      const instrumentSelect = document.getElementById('makeupFilterInstrument');
      const currentInstrument = instrumentSelect ? instrumentSelect.value : '';
      const instruments = [...new Set((globalJadwalList || []).map(item => String(item.instrumen || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      if (instrumentSelect) {
        instrumentSelect.innerHTML = '<option value="">Semua Instrumen</option>' + instruments.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
        if (instruments.includes(currentInstrument)) instrumentSelect.value = currentInstrument;
      }
      syncMakeupTeacherFilter();
      refreshScheduleOverrideFormOptions();
    }

    function renderTabelJadwalPengganti() {
      const container = document.getElementById('jadwalPenggantiListContainer');
      if (!container) return;
      container.innerHTML = '';
      const isAdmin = currentUser.userType === 'admin';
      const searchFilter = currentUser.userType !== 'siswa' ? String(document.getElementById('makeupFilterSearch')?.value || '').trim().toLowerCase() : '';
      const instrumentFilter = currentUser.userType !== 'siswa' ? String(document.getElementById('makeupFilterInstrument')?.value || '').toLowerCase() : '';
      const teacherFilter = isAdmin ? String(document.getElementById('makeupFilterTeacher')?.value || '').toLowerCase() : '';
      const dayFilter = currentUser.userType !== 'siswa' ? String(document.getElementById('makeupFilterDay')?.value || '').toLowerCase() : '';
      const overrides = (globalScheduleOverrides || []).filter(item => {
        const schedule = (globalJadwalList || []).find(row => String(row.jadwalID || '') === String(item.jadwalID || '')) || null;
        const instrument = String(schedule?.instrumen || item.instrumenAsli || '').toLowerCase();
        const teacher = String(schedule?.guru || item.guruAsli || item.guruMakeup || '').toLowerCase();
        const day = String(schedule?.hari || item.hariAsli || '').toLowerCase();
        const name = `${item.siswaAsli || ''} ${item.siswaPengganti || ''}`.toLowerCase();
        return (!searchFilter || name.includes(searchFilter)) && (!instrumentFilter || instrument === instrumentFilter) && (!teacherFilter || teacher === teacherFilter) && (!dayFilter || day === dayFilter);
      });
      overrides.forEach(item => {
        const schedule = (globalJadwalList || []).find(row => String(row.jadwalID || '') === String(item.jadwalID || '')) || { hari:item.hariAsli || '', jamMulai:item.jamMulaiAsli || '', jamSelesai:item.jamSelesaiAsli || '', guru:item.guruAsli || '', ruangan:item.ruanganAsli || '', instrumen:item.instrumenAsli || 'Musik' };
        const slotText = item.siswaPengganti ? `${escapeTaskHtml(item.siswaPengganti)} memakai slot ${escapeTaskHtml(item.siswaAsli || '-')}` : `Slot ${escapeTaskHtml(item.siswaAsli || '-')} dikosongkan`;
        const makeupText = item.tanggalMakeup ? `${escapeTaskHtml(formatAcademyDate(item.tanggalMakeup))} • ${escapeTaskHtml(item.jamMulaiMakeup || '-')}–${escapeTaskHtml(item.jamSelesaiMakeup || '-')} • ${escapeTaskHtml(item.ruanganMakeup || '-')}` : 'Belum dijadwalkan';
        const actionButtons = isAdmin ? `<div class="academy-card-actions"><button class="btn-action btn-edit" onclick="openEditScheduleOverride('${escapeTaskHtml(item.overrideID)}')">Edit</button><button class="btn-action btn-delete" onclick="handleDeleteScheduleOverride('${escapeTaskHtml(item.overrideID)}')">Hapus</button></div>` : '';
        container.innerHTML += `<article class="academy-card schedule-override-card"><div class="academy-card-head"><div class="academy-card-icon">⇄</div><div class="academy-card-title"><strong>${escapeTaskHtml(item.siswaAsli || '-')}</strong><span>${escapeTaskHtml(formatAcademyDate(item.tanggalAsli))} • ${escapeTaskHtml(schedule.jamMulai || '-')}–${escapeTaskHtml(schedule.jamSelesai || '-')}</span></div><span class="badge badge-warning">Pergantian</span></div><div class="academy-meta-grid"><div class="academy-meta"><span>Slot asli</span><strong>${slotText}</strong></div><div class="academy-meta"><span>Make-up</span><strong>${makeupText}</strong></div><div class="academy-meta"><span>Guru / Ruang</span><strong>${escapeTaskHtml(item.guruMakeup || schedule.guru || '-')} • ${escapeTaskHtml(item.ruanganMakeup || schedule.ruangan || '-')}</strong></div><div class="academy-meta"><span>Alasan</span><strong>${escapeTaskHtml(item.alasan || '-')}</strong></div></div>${item.catatan ? `<div class="academy-card-content">${escapeTaskHtml(item.catatan)}</div>` : ''}${actionButtons}</article>`;
      });

      const list = (globalJadwalPenggantiList || []).filter(item => {
        const schedule = (globalJadwalList || []).find(row => String(row.jadwalID || '') === String(item.jadwalID || '')) || null;
        const instrument = String(schedule?.instrumen || '').trim().toLowerCase();
        const teacher = String(item.guru || schedule?.guru || '').trim().toLowerCase();
        const day = String(item.hariPelaksanaan || schedule?.hari || '').trim().toLowerCase();
        const name = String(item.namaSiswa || '').trim().toLowerCase();
        return (!searchFilter || name.includes(searchFilter)) && (!instrumentFilter || instrument === instrumentFilter) && (!teacherFilter || teacher === teacherFilter) && (!dayFilter || day === dayFilter);
      });
      if (list.length === 0 && overrides.length === 0) {
        container.innerHTML = '<div class="academy-empty">Belum ada jadwal pergantian yang tersedia.</div>';
        return;
      }

      list.forEach(item => {
        const deleteButton = isAdmin ? `<button class="btn-action btn-delete" onclick="handleDeleteJadwalPengganti('${escapeTaskHtml(item.penggantiID)}')">Hapus</button>` : '';
        container.innerHTML += `<article class="academy-card"><div class="academy-card-head"><div class="academy-card-icon">↻</div><div class="academy-card-title"><strong>${escapeTaskHtml(item.namaSiswa || '-')}</strong><span>${escapeTaskHtml(item.hariPelaksanaan || '')}, ${escapeTaskHtml(formatAcademyDate(item.tanggalPelaksanaan))}</span></div><span class="badge badge-success">${escapeTaskHtml(item.status || 'Aktif')}</span></div><div class="academy-meta-grid"><div class="academy-meta"><span>Waktu</span><strong>${escapeTaskHtml(item.jamMulai || '-')} – ${escapeTaskHtml(item.jamSelesai || '-')}</strong></div><div class="academy-meta"><span>Ruangan</span><strong>${escapeTaskHtml(item.ruangan || '-')}</strong></div><div class="academy-meta"><span>Guru</span><strong>${escapeTaskHtml(item.guru || '-')}</strong></div><div class="academy-meta"><span>Alasan</span><strong>${escapeTaskHtml(item.alasan || '-')}</strong></div></div>${deleteButton ? `<div class="academy-card-actions">${deleteButton}</div>` : ''}</article>`;
      });
    }

    function handleDeleteJadwalPengganti(id) {
      if(confirm('Apakah Anda yakin ingin menghapus jadwal pergantian ini?')) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) {
            globalPengumumanList = (globalPengumumanList || []).filter(item => String(item.pengumumanID || '') !== String(id));
            renderPengumumanList();
            renderDashboardAcademyUpdates();
            renderNotificationCenter();
            if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['announcements']);
          }
        }).withFailureHandler(error => showAlert('alertDanger', 'Gagal menghapus jadwal: ' + (error.message || error))).deleteJadwalPengganti(id, currentUser.userType);
      }
    }

    function togglePengumumanTargetDetail(targetVal) {
      const studentContainer = document.getElementById('containerPengumumanSiswaDetail');
      const teacherContainer = document.getElementById('containerPengumumanGuruDetail');
      if (studentContainer) studentContainer.style.display = targetVal === 'siswa_tertentu' ? 'block' : 'none';
      if (teacherContainer) teacherContainer.style.display = targetVal === 'guru_tertentu' ? 'block' : 'none';

      if (targetVal === 'guru_tertentu') {
        const select = document.getElementById('pengumumanGuruDetailSelect');
        if (select) {
          const previous = select.value;
          select.innerHTML = '<option value="">Pilih Guru...</option>' + (globalGuruList || []).map(guru => `<option value="${escapeTaskHtml(guru.nama || '')}">${escapeTaskHtml(guru.nama || '-')} (${escapeTaskHtml(guru.instrumen || 'Musik')})</option>`).join('');
          if ([...select.options].some(option => option.value === previous)) select.value = previous;
        }
      }
    }

    function handleAddPengumuman(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitPengumuman');
      btn.disabled = true; btn.textContent = 'Menerbitkan...';

      const targetVal = document.getElementById('pengumumanTarget').value;
      let targetDetailVal = '';

      if (targetVal === 'siswa_tertentu') {
        targetDetailVal = document.getElementById('pengumumanSiswaDetailSelect').value;
        if (!targetDetailVal) {
          alert('Silakan pilih Siswa spesifik terlebih dahulu!');
          btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
          return false;
        }
      } else if (targetVal === 'guru_tertentu') {
        targetDetailVal = document.getElementById('pengumumanGuruDetailSelect')?.value || '';
        if (!targetDetailVal) {
          alert('Silakan pilih Guru spesifik terlebih dahulu!');
          btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
          return false;
        }
      }

      const payload = {
        judul: document.getElementById('pengumumanJudul').value,
        target: targetVal,
        targetDetail: targetDetailVal,
        isi: document.getElementById('pengumumanIsi').value,
        pembuat: currentUser.userName,
        currentUserType: currentUser.userType
      };

      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if (res.success) {
          document.getElementById('formAddPengumuman').reset();
          togglePengumumanTargetDetail('');
          if (res.announcement) {
            const id = String(res.announcement.pengumumanID || '');
            globalPengumumanList = (globalPengumumanList || []).filter(x => String(x.pengumumanID || '') !== id);
            globalPengumumanList.unshift(res.announcement);
            renderPengumumanList();
            renderDashboardAcademyUpdates();
            renderNotificationCenter();
          } else if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['announcements']);
        }
      }).withFailureHandler(error => {
        btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
        showAlert('alertDanger', 'Gagal menerbitkan pengumuman: ' + (error.message || error));
      }).addPengumuman(payload);
    }

    function renderPengumumanList() {
      const container = document.getElementById('pengumumanListContainer');
      container.innerHTML = '';

      if (globalPengumumanList.length === 0) {
        container.innerHTML = '<div class="academy-empty">Belum ada pengumuman terbaru.</div>';
        return;
      }

      const isAdmin = currentUser.userType === 'admin';

      globalPengumumanList.forEach(item => {
        const deleteBtn = isAdmin ? `<button class="btn-action btn-delete" onclick="handleDeletePengumuman('${escapeTaskHtml(item.pengumumanID)}')">Hapus</button>` : '';
        const targetLabel = getAnnouncementTargetLabel(item);
        const adminMeta = isAdmin ? `<div class="academy-meta-grid"><div class="academy-meta"><span>Penerima</span><strong>${escapeTaskHtml(targetLabel)}</strong></div><div class="academy-meta"><span>Status</span><strong>${escapeTaskHtml(item.status || 'Terbit')}</strong></div></div>` : '';
        container.innerHTML += `<article class="academy-card"><div class="academy-card-head"><div class="academy-card-icon">📢</div><div class="academy-card-title"><strong>${escapeTaskHtml(item.judul || '-')}</strong><span>${escapeTaskHtml(item.tanggalKirim || '-')} • ${escapeTaskHtml(item.pembuat || 'Admin')}</span></div></div><div class="academy-card-content">${escapeTaskHtml(item.isi || '-')}</div>${adminMeta}${deleteBtn ? `<div class="academy-card-actions">${deleteBtn}</div>` : ''}</article>`;
      });
    }

    function handleDeletePengumuman(id) {
      if(confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) {
            globalPengumumanList = (globalPengumumanList || []).filter(item => String(item.pengumumanID || '') !== String(id));
            renderPengumumanList(); renderDashboardAcademyUpdates(); renderNotificationCenter();
            if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['announcements']);
          }
        }).withFailureHandler(error => showAlert('alertDanger', 'Gagal menghapus pengumuman: ' + (error.message || error))).deletePengumuman(id, currentUser.userType);
      }
    }

    function setupRoomFilters() {
      if (currentUser.userType !== 'admin') return;
      const dateInput = document.getElementById('roomFilterDate');
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
      syncRoomDayAndRender();
      const roomSelect = document.getElementById('roomFilterRoom');
      const current = roomSelect.value;
      const rooms = getKnownRooms();
      roomSelect.innerHTML = '<option value="">Semua Ruangan</option>' + rooms.map(room => `<option value="${escapeTaskHtml(room)}">${escapeTaskHtml(room)}</option>`).join('');
      if (rooms.includes(current)) roomSelect.value = current;
    }

    function getKnownRooms() {
      const defaults = Array.from({length:8}, (_, index) => `R ${index + 1}`);
      return [...new Set(defaults.concat(globalJadwalList.map(item => item.ruangan), globalJadwalPenggantiList.map(item => item.ruangan)).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id',{numeric:true}));
    }

    function syncRoomDayAndRender() {
      const value = document.getElementById('roomFilterDate')?.value;
      if (value) {
        const parts = value.split('-').map(Number);
        const day = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
        document.getElementById('roomFilterDay').value = day;
      }
      renderRoomAvailability();
    }

    function schedulesOverlap(startA, endA, startB, endB) {
      return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
    }

    function renderRoomAvailability() {
      if (currentUser.userType !== 'admin') return;
      const grid = document.getElementById('roomAvailabilityGrid');
      const summary = document.getElementById('roomAvailabilitySummary');
      if (!grid || !summary) return;
      const date = document.getElementById('roomFilterDate')?.value || '';
      const day = document.getElementById('roomFilterDay')?.value || '';
      const start = document.getElementById('roomFilterStart')?.value || '10:00';
      const end = document.getElementById('roomFilterEnd')?.value || '11:00';
      const selectedRoom = document.getElementById('roomFilterRoom')?.value || '';
      const rooms = getKnownRooms().filter(room => !selectedRoom || room === selectedRoom);
      const results = rooms.map(room => {
        const regular = globalJadwalList.filter(item => String(item.ruangan || '') === room && String(item.hari || '').toLowerCase() === day.toLowerCase() && schedulesOverlap(start,end,item.jamMulai,item.jamSelesai));
        const makeup = globalJadwalPenggantiList.filter(item => String(item.ruangan || '') === room && (!date || String(item.tanggalPelaksanaan || '') === date) && schedulesOverlap(start,end,item.jamMulai,item.jamSelesai));
        return { room, conflicts: regular.concat(makeup) };
      });
      const available = results.filter(item => item.conflicts.length === 0).length;
      summary.innerHTML = `<div class="room-summary-card"><span>Total ruang ditampilkan</span><strong>${results.length}</strong></div><div class="room-summary-card"><span>Tersedia</span><strong style="color:#10b981">${available}</strong></div><div class="room-summary-card"><span>Terpakai / bentrok</span><strong style="color:#ef4444">${results.length - available}</strong></div>`;
      grid.innerHTML = results.map(result => {
        const detail = result.conflicts.length ? result.conflicts.map(item => `${escapeTaskHtml(item.jamMulai || '-')}–${escapeTaskHtml(item.jamSelesai || '-')} · ${escapeTaskHtml(item.namaSiswa || '-')}<br>${escapeTaskHtml(item.guru || '-')}`).join('<hr style="border:0;border-top:1px solid #edf1f5;margin:7px 0;">') : `Kosong pada ${escapeTaskHtml(day)}, ${escapeTaskHtml(start)}–${escapeTaskHtml(end)}`;
        return `<article class="room-card ${result.conflicts.length ? 'busy' : ''}"><h3>${escapeTaskHtml(result.room)}</h3><span class="room-state">${result.conflicts.length ? 'Terpakai' : 'Tersedia'}</span><div class="room-detail">${detail}</div></article>`;
      }).join('') || '<div class="academy-empty">Tidak ada ruangan sesuai filter.</div>';
    }

    function getNotificationStorageKey() {
      return `legacyNotificationsRead:${currentUser.userType}:${currentUser.userID || currentUser.userName}`;
    }

    function getReadNotificationIds() {
      try { return new Set(JSON.parse(localStorage.getItem(getNotificationStorageKey()) || '[]')); }
      catch (error) { return new Set(); }
    }

    function buildNotifications() {
      const items = [];
      globalPengumumanList.slice(0,5).forEach(item => items.push({ id:`announcement:${item.pengumumanID || item.judul}`, type:'section-pengumuman', title:item.judul || 'Pengumuman Academy', detail:item.isi || 'Ada pengumuman baru.' }));
      const today = new Date().toISOString().slice(0,10);
      globalJadwalPenggantiList.filter(item => String(item.tanggalPelaksanaan || '') >= today).slice(0,5).forEach(item => items.push({ id:`makeup:${item.penggantiID}`, type:'section-pengganti', title:`Jadwal pergantian ${item.namaSiswa || ''}`, detail:`${formatAcademyDate(item.tanggalPelaksanaan)} · ${item.jamMulai || '-'} · ${item.ruangan || '-'}` }));
      (globalScheduleOverrides || []).filter(item => String(item.status || 'Aktif').toLowerCase() === 'aktif' && (!item.tanggalAsli || String(item.tanggalAsli) >= today)).slice(0,5).forEach(item => {
        const slotInfo = item.siswaPengganti ? `${item.siswaPengganti} memakai slot ${item.siswaAsli || '-'}` : `Slot ${item.siswaAsli || '-'} dikosongkan`;
        const makeupInfo = item.tanggalMakeup ? ` • Make-up ${formatAcademyDate(item.tanggalMakeup)} ${item.jamMulaiMakeup || ''}` : '';
        items.push({ id:`override:${item.overrideID}`, type:'section-pengganti', title:`Pergantian jadwal ${item.siswaAsli || ''}`, detail:`${formatAcademyDate(item.tanggalAsli)} • ${slotInfo}${makeupInfo}` });
      });
      const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const now = new Date();
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      globalJadwalList.filter(item => String(item.hari || '').toLowerCase() === days[now.getDay()].toLowerCase()).forEach(item => {
        const minutes = timeToMinutes(item.jamMulai) - currentMinute;
        if (minutes >= 0 && minutes <= 60) items.push({ id:`class:${today}:${item.jadwalID}`, type:currentUser.userType === 'siswa' ? 'dashboard-siswa' : 'section-jadwal', title:`Kelas akan berlangsung ${minutes === 0 ? 'sekarang' : `dalam ${minutes} menit`}`, detail:`${item.namaSiswa || ''} · ${item.jamMulai || '-'} · ${item.ruangan || '-'}` });
      });
      return items.slice(0,12);
    }

    function renderNotificationCenter() {
      const list = document.getElementById('notificationList');
      const badge = document.getElementById('notificationBadge');
      if (!list || !badge || !currentUser.userType) return;
      const read = getReadNotificationIds();
      const items = buildNotifications();
      const unread = items.filter(item => !read.has(item.id)).length;
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.style.display = unread ? 'grid' : 'none';
      list.innerHTML = items.length ? items.map(item => `<button type="button" class="notification-item ${read.has(item.id) ? '' : 'unread'}" onclick="openNotificationItem(decodeURIComponent('${encodeURIComponent(item.id)}'),decodeURIComponent('${encodeURIComponent(item.type)}'))"><span class="notification-dot"></span><span class="notification-copy"><strong>${escapeTaskHtml(item.title)}</strong><span>${escapeTaskHtml(item.detail)}</span></span></button>`).join('') : '<div class="academy-empty">Belum ada notifikasi.</div>';
    }

    function toggleNotificationPanel(event) {
      if (event) event.stopPropagation();
      const panel = document.getElementById('notificationPanel');
      if (!panel) return;
      const willOpen = !panel.classList.contains('open');
      panel.classList.toggle('open', willOpen);
      if (willOpen) {
        const read = getReadNotificationIds();
        buildNotifications().forEach(item => read.add(item.id));
        localStorage.setItem(getNotificationStorageKey(), JSON.stringify([...read]));
        renderNotificationCenter();
      }
    }

    function openNotificationItem(id, sectionId) {
      const read = getReadNotificationIds();
      read.add(id);
      localStorage.setItem(getNotificationStorageKey(), JSON.stringify([...read]));
      document.getElementById('notificationPanel')?.classList.remove('open');
      switchTab(sectionId);
      renderNotificationCenter();
    }

    function markAllNotificationsRead(event) {
      if (event) event.stopPropagation();
      localStorage.setItem(getNotificationStorageKey(), JSON.stringify(buildNotifications().map(item => item.id)));
      renderNotificationCenter();
    }

    document.addEventListener('click', event => {
      const center = document.getElementById('notificationCenter');
      if (center && !center.contains(event.target)) document.getElementById('notificationPanel')?.classList.remove('open');
    });

