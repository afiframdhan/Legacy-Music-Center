    let repertoirePageLoaded = false;
    let repertoireActiveDetailId = '';
    let repertoireLoadRequestId = 0;

    function loadRepertoirePage() {
      const addBtn = document.getElementById('repertoireAddButton');
      const printBtn = document.getElementById('repertoirePrintButton');
      const studentWrap = document.getElementById('repertoireStudentFilterWrap');
      const teacherWrap = document.getElementById('repertoireTeacherFilterWrap');
      const loading = document.getElementById('repertoireLoadingState');
      const list = document.getElementById('repertoireList');
      const requestId = ++repertoireLoadRequestId;

      if (addBtn) addBtn.style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      if (printBtn) printBtn.style.display = 'inline-flex';
      if (studentWrap) studentWrap.style.display = currentUser.userType === 'siswa' ? 'none' : 'block';
      if (teacherWrap) teacherWrap.style.display = currentUser.userType === 'admin' ? 'block' : 'none';

      // Selalu ambil snapshot terbaru saat tab Repertoire dibuka. Ini mencegah
      // halaman kosong/stale yang sebelumnya baru pulih setelah browser direfresh.
      if (loading) {
        loading.style.display = 'block';
        loading.textContent = repertoirePageLoaded ? 'Memperbarui daftar repertoire...' : 'Memuat data repertoire...';
      }
      if (!repertoirePageLoaded && list) list.innerHTML = '';

      google.script.run
        .withSuccessHandler(result => {
          if (requestId !== repertoireLoadRequestId) return;
          if (!result || result.success === false) {
            if (loading) loading.style.display = 'none';
            showAlert('alertDanger', (result && result.message) || 'Data repertoire gagal dimuat.');
            return;
          }
          globalRepertoireList = Array.isArray(result.items) ? result.items : [];
          repertoirePageLoaded = true;
          populateRepertoireFilters();
          renderRepertoirePage();
        })
        .withFailureHandler(error => {
          if (requestId !== repertoireLoadRequestId) return;
          if (loading) loading.style.display = 'none';
          showAlert('alertDanger', 'Data repertoire gagal dimuat: ' + (error.message || error));
        })
        .getRepertoireData();
    }

    function repertoireStudentMatchesTeacher(student, teacherValue) {
      const needle = String(teacherValue || '').trim().toLowerCase();
      if (!needle) return true;
      const teacherIdNeedle = needle;
      const classes = Array.isArray(student?.kelasList) ? student.kelasList : [];
      return classes.some(item =>
        String(item.guruID || '').trim().toLowerCase() === teacherIdNeedle ||
        String(item.guru || '').trim().toLowerCase() === teacherIdNeedle
      ) || String(student?.guruID || '').trim().toLowerCase() === teacherIdNeedle ||
        String(student?.guru || '').trim().toLowerCase().split(',').map(v => v.trim()).includes(teacherIdNeedle);
    }

    function populateRepertoireFilters() {
      const studentSelect = document.getElementById('repertoireStudentFilter');
      const teacherSelect = document.getElementById('repertoireTeacherFilter');
      const instrumentSelect = document.getElementById('repertoireInstrumentFilter');
      const statusSelect = document.getElementById('repertoireStatusFilter');
      const searchInput = document.getElementById('repertoireSearch');
      if (!studentSelect || !instrumentSelect || !statusSelect) return;

      if (searchInput) {
        searchInput.placeholder = currentUser.userType === 'siswa'
          ? 'Cari judul lagu, composer, event...'
          : 'Cari judul lagu, siswa, composer, event...';
      }

      if (currentUser.userType === 'admin' && teacherSelect) {
        const currentTeacher = teacherSelect.value;
        const teachers = (globalGuruList || []).slice().sort((a,b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
        teacherSelect.innerHTML = '<option value="">Semua Guru</option>' + teachers.map(item => `<option value="${escapeTaskHtml(item.id || item.nama || '')}">${escapeTaskHtml(item.nama || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')}</option>`).join('');
        teacherSelect.value = Array.from(teacherSelect.options).some(opt => opt.value === currentTeacher) ? currentTeacher : '';
      }

      if (currentUser.userType !== 'siswa') {
        const currentStudent = studentSelect.value;
        const selectedTeacher = currentUser.userType === 'admin' ? String(teacherSelect?.value || '').trim() : '';
        let students = (globalSiswaList || []).slice();
        if (currentUser.userType === 'admin' && selectedTeacher) {
          students = students.filter(item => repertoireStudentMatchesTeacher(item, selectedTeacher));
        }
        students.sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
        studentSelect.innerHTML = '<option value="">Semua Siswa</option>' + students.map(item => `<option value="${escapeTaskHtml(item.siswaID || '')}">${escapeTaskHtml(item.nama || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')}</option>`).join('');
        studentSelect.value = Array.from(studentSelect.options).some(opt => opt.value === currentStudent) ? currentStudent : '';
      } else {
        studentSelect.innerHTML = `<option value="${escapeTaskHtml(currentUser.userID || '')}">${escapeTaskHtml(currentUser.userName || 'Siswa Saya')}</option>`;
        studentSelect.value = currentUser.userID || '';
      }

      const roleItems = repertoireRoleItems();
      const instruments = [...new Set(roleItems.map(item => String(item.instrumen || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      const statuses = [...new Set(roleItems.map(item => String(item.status || '').trim()).filter(Boolean))];
      const currentInstrument = instrumentSelect.value;
      const currentStatus = statusSelect.value;

      instrumentSelect.innerHTML = '<option value="">Semua Instrumen</option>' + instruments.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      instrumentSelect.value = Array.from(instrumentSelect.options).some(opt => opt.value === currentInstrument) ? currentInstrument : '';

      const fallbackStatuses = ['Belajar', 'Siap Tampil', 'Dikuasai', 'Sudah Tampil'];
      const mergedStatuses = [...new Set([...fallbackStatuses, ...statuses])];
      statusSelect.innerHTML = '<option value="">Semua Status</option>' + mergedStatuses.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      statusSelect.value = Array.from(statusSelect.options).some(opt => opt.value === currentStatus) ? currentStatus : '';
    }

    function handleRepertoireTeacherFilterChange() {
      populateRepertoireFilters();
      renderRepertoirePage();
    }

    function repertoireRoleItems() {
      let items = Array.isArray(globalRepertoireList) ? globalRepertoireList.slice() : [];
      if (currentUser.userType === 'siswa') {
        items = items.filter(item => String(item.siswaID || '').trim() === String(currentUser.userID || '').trim());
      }
      if (currentUser.userType === 'guru') {
        const ownId = String(currentUser.userID || '').trim();
        const ownName = String(currentUser.userName || '').trim().toLowerCase();
        const allowedStudents = new Set((globalSiswaList || []).map(item => String(item.siswaID || '').trim()).filter(Boolean));
        items = items.filter(item =>
          String(item.guruID || '').trim() === ownId ||
          String(item.guru || '').trim().toLowerCase() === ownName ||
          allowedStudents.has(String(item.siswaID || '').trim())
        );
      }
      return items;
    }

    function repertoireFilteredItems() {
      const search = String(document.getElementById('repertoireSearch')?.value || '').trim().toLowerCase();
      const studentId = String(document.getElementById('repertoireStudentFilter')?.value || '').trim();
      const teacher = String(document.getElementById('repertoireTeacherFilter')?.value || '').trim().toLowerCase();
      const instrument = String(document.getElementById('repertoireInstrumentFilter')?.value || '').trim().toLowerCase();
      const status = String(document.getElementById('repertoireStatusFilter')?.value || '').trim().toLowerCase();
      let items = repertoireRoleItems();

      if (currentUser.userType === 'admin' && teacher) {
        const teacherObj = (globalGuruList || []).find(item => String(item.id || '').trim().toLowerCase() === teacher || String(item.nama || '').trim().toLowerCase() === teacher);
        const teacherName = String(teacherObj?.nama || '').trim().toLowerCase();
        const matchingStudents = new Set((globalSiswaList || []).filter(item => repertoireStudentMatchesTeacher(item, teacher)).map(item => String(item.siswaID || '').trim()));
        items = items.filter(item =>
          String(item.guruID || '').trim().toLowerCase() === teacher ||
          (teacherName && String(item.guru || '').trim().toLowerCase() === teacherName) ||
          matchingStudents.has(String(item.siswaID || '').trim())
        );
      }
      if (studentId) items = items.filter(item => String(item.siswaID || '').trim() === studentId);
      if (instrument) items = items.filter(item => String(item.instrumen || '').trim().toLowerCase() === instrument);
      if (status) items = items.filter(item => String(item.status || '').trim().toLowerCase() === status);
      if (search) {
        items = items.filter(item => [
          item.judulLagu, item.namaSiswa, item.composer, item.instrumen, item.keySignature, item.level, item.eventTampil, item.catatan
        ].some(value => String(value || '').toLowerCase().includes(search)));
      }

      items.sort((a, b) => {
        const dateA = String(a.targetTampil || a.lastUpdated || '');
        const dateB = String(b.targetTampil || b.lastUpdated || '');
        return dateB.localeCompare(dateA) || String(a.judulLagu || '').localeCompare(String(b.judulLagu || ''), 'id');
      });
      return items;
    }

    function renderRepertoirePage() {
      renderRepertoireStats();
      renderRepertoireList();
      renderRepertoireSummary();
      const loading = document.getElementById('repertoireLoadingState');
      if (loading) loading.style.display = 'none';
    }

    function renderRepertoireStats() {
      const items = repertoireFilteredItems();
      const total = items.length;
      const ready = items.filter(item => String(item.status || '').toLowerCase() === 'siap tampil').length;
      const mastered = items.filter(item => ['dikuasai', 'sudah tampil'].includes(String(item.status || '').toLowerCase())).length;
      const average = total ? Math.round(items.reduce((sum, item) => sum + (Number(item.progress || 0) || 0), 0) / total) : 0;
      const byId = id => document.getElementById(id);
      if (byId('repertoireStatTotal')) byId('repertoireStatTotal').textContent = String(total);
      if (byId('repertoireStatReady')) byId('repertoireStatReady').textContent = String(ready);
      if (byId('repertoireStatMastered')) byId('repertoireStatMastered').textContent = String(mastered);
      if (byId('repertoireStatAverage')) byId('repertoireStatAverage').textContent = average + '%';
    }

    function repertoireStatusTone(status) {
      const value = String(status || '').trim().toLowerCase();
      if (value === 'siap tampil') return 'ready';
      if (value === 'dikuasai') return 'mastered';
      if (value === 'sudah tampil') return 'performed';
      return 'learning';
    }

    function renderRepertoireList() {
      const container = document.getElementById('repertoireList');
      if (!container) return;
      const items = repertoireFilteredItems();
      if (!items.length) {
        container.innerHTML = '<div class="repertoire-empty">Belum ada daftar repertoire yang sesuai filter.</div>';
        return;
      }
      container.innerHTML = items.map(item => {
        const progress = Math.max(0, Math.min(100, Number(item.progress || 0) || 0));
        const target = item.targetTampil ? formatAcademyDate(item.targetTampil) : 'Belum ada target';
        return `<button type="button" class="repertoire-item repertoire-item-compact" onclick="openRepertoireDetail('${escapeTaskHtml(item.repertoireID || '')}')">
          <div class="repertoire-item-head compact">
            <div class="repertoire-song-copy">
              <div class="repertoire-item-title">${escapeTaskHtml(item.judulLagu || '-')}</div>
              <div class="repertoire-item-subtitle">${escapeTaskHtml(item.namaSiswa || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')}${item.composer ? ` • ${escapeTaskHtml(item.composer)}` : ''}</div>
            </div>
            <span class="repertoire-badge ${repertoireStatusTone(item.status)}">${escapeTaskHtml(item.status || 'Belajar')}</span>
          </div>
          <div class="repertoire-compact-meta">
            <span>${escapeTaskHtml(item.keySignature || '-')}</span>
            <span>${escapeTaskHtml(item.level || '-')}</span>
            <span>Target: ${escapeTaskHtml(target)}</span>
            <strong>${progress}%</strong>
          </div>
          <div class="repertoire-progress compact"><i style="width:${progress}%"></i></div>
        </button>`;
      }).join('');
    }

    function renderRepertoireSummary() {
      const box = document.getElementById('repertoireSummary');
      if (!box) return;
      const items = repertoireFilteredItems();
      const selectedStudentId = String(document.getElementById('repertoireStudentFilter')?.value || '').trim();
      const student = (globalSiswaList || []).find(item => String(item.siswaID || '') === selectedStudentId) || null;
      const upcoming = items.filter(item => item.targetTampil).slice().sort((a,b) => String(a.targetTampil).localeCompare(String(b.targetTampil))).slice(0,4);
      const ready = items.filter(item => String(item.status || '').toLowerCase() === 'siap tampil').slice(0,4);
      const performed = items.filter(item => item.tanggalTampilTerakhir || String(item.status || '').toLowerCase() === 'sudah tampil').slice(0,4);
      const focusStudentLabel = currentUser.userType === 'siswa'
        ? (currentUser.userName || 'Siswa')
        : (student ? `${student.nama || '-'} • ${student.instrumen || 'Musik'}` : 'Semua siswa');

      const listHtml = (list, emptyText, formatter) => list.length
        ? `<div class="repertoire-summary-list">${list.map(item => formatter(item)).join('')}</div>`
        : `<div class="repertoire-empty small">${escapeTaskHtml(emptyText)}</div>`;

      box.innerHTML = `
        <div class="repertoire-summary-card repertoire-summary-overview">
          <div class="repertoire-summary-head"><strong>Ringkasan Fokus</strong><span>${escapeTaskHtml(focusStudentLabel)}</span></div>
          <div class="repertoire-summary-body">
            <div class="repertoire-summary-chip"><span>Total Lagu</span><b>${items.length}</b></div>
            <div class="repertoire-summary-chip"><span>Rata-rata</span><b>${items.length ? Math.round(items.reduce((sum, item) => sum + (Number(item.progress || 0) || 0), 0) / items.length) : 0}%</b></div>
            <div class="repertoire-summary-chip"><span>Siap Tampil</span><b>${ready.length}</b></div>
            <div class="repertoire-summary-chip"><span>Sudah Tampil</span><b>${performed.length}</b></div>
          </div>
          ${student ? `<div class="repertoire-student-note">Grade: <b>${escapeTaskHtml(student.kelas || '-')}</b> • Guru: <b>${escapeTaskHtml(student.guru || '-')}</b></div>` : ''}
        </div>
        <div class="repertoire-summary-card">
          <div class="repertoire-summary-head"><strong>Siap Tampil</strong><span>Prioritas terdekat</span></div>
          ${listHtml(ready, 'Belum ada repertoire yang siap tampil.', item => `<button type="button" class="repertoire-summary-row" onclick="openRepertoireDetail('${escapeTaskHtml(item.repertoireID || '')}')"><b>${escapeTaskHtml(item.judulLagu || '-')}</b><span>${escapeTaskHtml(item.namaSiswa || '-')} • ${escapeTaskHtml(item.instrumen || '')}</span></button>`)}
        </div>
        <div class="repertoire-summary-card">
          <div class="repertoire-summary-head"><strong>Agenda Tampil</strong><span>Target mendatang</span></div>
          ${listHtml(upcoming, 'Belum ada target tampil yang dijadwalkan.', item => `<button type="button" class="repertoire-summary-row" onclick="openRepertoireDetail('${escapeTaskHtml(item.repertoireID || '')}')"><b>${escapeTaskHtml(item.judulLagu || '-')}</b><span>${escapeTaskHtml(formatAcademyDate(item.targetTampil))}${item.eventTampil ? ` • ${escapeTaskHtml(item.eventTampil)}` : ''}</span></button>`)}
        </div>
        <div class="repertoire-summary-card">
          <div class="repertoire-summary-head"><strong>Riwayat Tampil</strong><span>Performance history</span></div>
          ${listHtml(performed, 'Belum ada riwayat penampilan.', item => `<button type="button" class="repertoire-summary-row" onclick="openRepertoireDetail('${escapeTaskHtml(item.repertoireID || '')}')"><b>${escapeTaskHtml(item.judulLagu || '-')}</b><span>${item.tanggalTampilTerakhir ? escapeTaskHtml(formatAcademyDate(item.tanggalTampilTerakhir)) : '-'}${item.eventTampil ? ` • ${escapeTaskHtml(item.eventTampil)}` : ''}</span></button>`)}
        </div>`;
    }

    function openRepertoireModalById(repertoireID) {
      const item = (globalRepertoireList || []).find(entry => String(entry.repertoireID || '') === String(repertoireID || ''));
      openRepertoireModal(item || null);
    }

    function openRepertoireModal(item = null) {
      if (currentUser.userType === 'siswa') return;
      if (!item && currentUser.userType !== 'guru') { showAlert('alertDanger', 'Hanya guru yang dapat menambahkan repertoire baru.'); return; }
      const modal = document.getElementById('modalRepertoire');
      if (!modal) return;
      document.getElementById('repertoireFormTitle').textContent = item ? 'Edit Repertoire Siswa' : 'Tambah Repertoire Siswa';
      document.getElementById('repertoireID').value = item ? (item.repertoireID || '') : '';
      populateRepertoireStudentSelect('repertoireSiswa', item ? item.siswaID : (document.getElementById('repertoireStudentFilter')?.value || ''));
      populateRepertoireInstrumentOptions('repertoireSiswa', 'repertoireInstrumen', item ? item.instrumen : '');
      document.getElementById('repertoireJudulLagu').value = item ? (item.judulLagu || '') : '';
      document.getElementById('repertoireComposer').value = item ? (item.composer || '') : '';
      document.getElementById('repertoireKeySignature').value = item ? (item.keySignature || '') : '';
      document.getElementById('repertoireLevel').value = item ? (item.level || '') : '';
      document.getElementById('repertoireStatus').value = item ? (item.status || 'Belajar') : 'Belajar';
      document.getElementById('repertoireProgress').value = item ? (Number(item.progress || 0) || 0) : 0;
      document.getElementById('repertoireTanggalMulai').value = item ? (item.tanggalMulai || '') : '';
      document.getElementById('repertoireTargetTampil').value = item ? (item.targetTampil || '') : '';
      document.getElementById('repertoireTanggalTampilTerakhir').value = item ? (item.tanggalTampilTerakhir || '') : '';
      document.getElementById('repertoireEventTampil').value = item ? (item.eventTampil || '') : '';
      document.getElementById('repertoireVideoUrl').value = item ? (item.videoUrl || '') : '';
      document.getElementById('repertoireCatatan').value = item ? (item.catatan || '') : '';
      modal.style.display = 'flex';
    }

    function closeRepertoireModal() {
      const modal = document.getElementById('modalRepertoire');
      if (modal) modal.style.display = 'none';
    }

    function populateRepertoireStudentSelect(selectId, selectedValue = '') {
      const select = document.getElementById(selectId);
      if (!select) return;
      let students = (globalSiswaList || []).slice();
      if (currentUser.userType === 'guru') {
        // globalSiswaList pada dashboard guru memang hanya berisi siswa yang dapat diakses guru tersebut.
        students = students.filter(isOperationalStudent);
      }
      students.sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
      select.innerHTML = '<option value="">Pilih Siswa...</option>' + students.map(item => `<option value="${escapeTaskHtml(item.siswaID || '')}">${escapeTaskHtml(item.nama || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')}</option>`).join('');
      select.value = Array.from(select.options).some(opt => opt.value === selectedValue) ? selectedValue : (students[0] ? String(students[0].siswaID || '') : '');
      populateRepertoireInstrumentOptions(selectId, 'repertoireInstrumen', document.getElementById('repertoireInstrumen')?.value || '');
    }

    function populateRepertoireInstrumentOptions(studentSelectId, targetSelectId, selectedValue = '') {
      const studentId = String(document.getElementById(studentSelectId)?.value || '').trim();
      const select = document.getElementById(targetSelectId);
      if (!select) return;
      const student = (globalSiswaList || []).find(item => String(item.siswaID || '') === studentId) || null;
      const options = student && Array.isArray(student.kelasList) && student.kelasList.length
        ? [...new Set(student.kelasList.map(item => String(item.instrumen || '').trim()).filter(Boolean))]
        : (student && student.instrumen ? String(student.instrumen).split(',').map(item => item.trim()).filter(Boolean) : []);
      const list = options.length ? options : ['Gitar'];
      select.innerHTML = list.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      if (selectedValue && Array.from(select.options).some(opt => opt.value === selectedValue)) select.value = selectedValue;
    }

    function handleSaveRepertoire(event) {
      event.preventDefault();
      const payload = {
        repertoireID: document.getElementById('repertoireID').value,
        siswaID: document.getElementById('repertoireSiswa').value,
        judulLagu: document.getElementById('repertoireJudulLagu').value,
        composer: document.getElementById('repertoireComposer').value,
        instrumen: document.getElementById('repertoireInstrumen').value,
        keySignature: document.getElementById('repertoireKeySignature').value,
        level: document.getElementById('repertoireLevel').value,
        status: document.getElementById('repertoireStatus').value,
        progress: document.getElementById('repertoireProgress').value,
        tanggalMulai: document.getElementById('repertoireTanggalMulai').value,
        targetTampil: document.getElementById('repertoireTargetTampil').value,
        tanggalTampilTerakhir: document.getElementById('repertoireTanggalTampilTerakhir').value,
        eventTampil: document.getElementById('repertoireEventTampil').value,
        videoUrl: document.getElementById('repertoireVideoUrl').value,
        catatan: document.getElementById('repertoireCatatan').value
      };

      const saveButton = document.getElementById('btnSaveRepertoire');
      if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Menyimpan...'; }
      google.script.run
        .withSuccessHandler(result => {
          if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Simpan Repertoire'; }
          if (!result || result.success === false) {
            showAlert('alertDanger', (result && result.message) || 'Repertoire gagal disimpan.');
            return;
          }
          closeRepertoireModal();
          showAlert('alertSuccess', result.message || 'Repertoire berhasil disimpan.');
          loadRepertoirePage();
        })
        .withFailureHandler(error => {
          if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Simpan Repertoire'; }
          showAlert('alertDanger', 'Repertoire gagal disimpan: ' + (error.message || error));
        })
        .saveStudentRepertoire(payload);
      return false;
    }

    function confirmDeleteRepertoire(repertoireID) {
      if (currentUser.userType === 'siswa') return;
      const item = (globalRepertoireList || []).find(entry => String(entry.repertoireID || '') === String(repertoireID || ''));
      const title = item ? item.judulLagu : 'item repertoire ini';
      if (!confirm(`Hapus ${title}?`)) return;
      google.script.run
        .withSuccessHandler(result => {
          if (!result || result.success === false) {
            showAlert('alertDanger', (result && result.message) || 'Repertoire gagal dihapus.');
            return;
          }
          closeRepertoireDetail();
          showAlert('alertSuccess', result.message || 'Repertoire berhasil dihapus.');
          loadRepertoirePage();
        })
        .withFailureHandler(error => {
          showAlert('alertDanger', 'Repertoire gagal dihapus: ' + (error.message || error));
        })
        .deleteStudentRepertoire(repertoireID);
    }

    function openRepertoireDetail(repertoireID) {
      const item = (globalRepertoireList || []).find(entry => String(entry.repertoireID || '') === String(repertoireID || ''));
      if (!item) return;
      repertoireActiveDetailId = String(repertoireID || '');
      const modal = document.getElementById('modalRepertoireDetail');
      const body = document.getElementById('repertoireDetailBody');
      if (!modal || !body) return;
      const youtubeHtml = item.youtube && item.youtube.embedUrl
        ? `<iframe class="repertoire-video-frame" src="${escapeTaskHtml(item.youtube.embedUrl)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="Preview Video"></iframe>`
        : (item.videoUrl ? `<a class="repertoire-link" href="${escapeTaskHtml(item.videoUrl)}" target="_blank" rel="noopener">Buka referensi video</a>` : '<span class="repertoire-muted">Belum ada video referensi.</span>');
      body.innerHTML = `
        <div class="repertoire-detail-top">
          <div>
            <h3>${escapeTaskHtml(item.judulLagu || '-')}</h3>
            <p>${escapeTaskHtml(item.namaSiswa || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')} • ${escapeTaskHtml(item.composer || '-')}</p>
          </div>
          <span class="repertoire-badge ${repertoireStatusTone(item.status)}">${escapeTaskHtml(item.status || 'Belajar')}</span>
        </div>
        <div class="repertoire-detail-grid">
          <div class="repertoire-meta"><span>Key Signature</span><strong>${escapeTaskHtml(item.keySignature || '-')}</strong></div>
          <div class="repertoire-meta"><span>Level</span><strong>${escapeTaskHtml(item.level || '-')}</strong></div>
          <div class="repertoire-meta"><span>Progress</span><strong>${escapeTaskHtml(String(item.progress || 0))}%</strong></div>
          <div class="repertoire-meta"><span>Terakhir Update</span><strong>${escapeTaskHtml(item.lastUpdated || '-')}</strong></div>
          <div class="repertoire-meta"><span>Tanggal Mulai</span><strong>${escapeTaskHtml(item.tanggalMulai ? formatAcademyDate(item.tanggalMulai) : '-')}</strong></div>
          <div class="repertoire-meta"><span>Target Tampil</span><strong>${escapeTaskHtml(item.targetTampil ? formatAcademyDate(item.targetTampil) : '-')}</strong></div>
          <div class="repertoire-meta"><span>Tampil Terakhir</span><strong>${escapeTaskHtml(item.tanggalTampilTerakhir ? formatAcademyDate(item.tanggalTampilTerakhir) : '-')}</strong></div>
          <div class="repertoire-meta"><span>Event / Catatan Tampil</span><strong>${escapeTaskHtml(item.eventTampil || '-')}</strong></div>
        </div>
        <div class="repertoire-progress detail"><i style="width:${Math.max(0, Math.min(100, Number(item.progress || 0) || 0))}%"></i></div>
        <div class="repertoire-detail-block"><strong>Catatan Coach</strong><p>${escapeTaskHtml(item.catatan || 'Belum ada catatan khusus.')}</p></div>
        <div class="repertoire-detail-block"><strong>Video Referensi / Evaluasi</strong>${youtubeHtml}</div>`;
      const editBtn = document.getElementById('btnEditRepertoireDetail');
      const deleteBtn = document.getElementById('btnDeleteRepertoireDetail');
      if (editBtn) editBtn.style.display = currentUser.userType === 'siswa' ? 'none' : 'inline-flex';
      if (deleteBtn) deleteBtn.style.display = currentUser.userType === 'siswa' ? 'none' : 'inline-flex';
      modal.style.display = 'flex';
    }

    function closeRepertoireDetail() {
      const modal = document.getElementById('modalRepertoireDetail');
      if (modal) modal.style.display = 'none';
    }

    function editActiveRepertoireDetail() {
      if (!repertoireActiveDetailId) return;
      closeRepertoireDetail();
      openRepertoireModalById(repertoireActiveDetailId);
    }

    function deleteActiveRepertoireDetail() {
      if (!repertoireActiveDetailId) return;
      confirmDeleteRepertoire(repertoireActiveDetailId);
    }

    function printRepertoireView() {
      const items = repertoireFilteredItems();
      const logoUrl = new URL('/assets/logo/legacy-logo.png', window.location.origin).href;
      const title = 'Repertoire / Daftar Lagu Siswa';
      const focusStudent = String(document.getElementById('repertoireStudentFilter')?.selectedOptions?.[0]?.textContent || '').trim();
      const focusLabel = currentUser.userType === 'siswa' ? currentUser.userName : (focusStudent && focusStudent !== 'Semua Siswa' ? focusStudent : 'Semua Siswa');
      const win = window.open('', '_blank', 'width=1200,height=900');
      if (!win) return;
      const rows = items.map((item, index) => `<tr>
        <td>${index + 1}</td>
        <td><b>${escapeTaskHtml(item.judulLagu || '-')}</b><br><span>${escapeTaskHtml(item.composer || '-')}</span></td>
        <td>${escapeTaskHtml(item.namaSiswa || '-')}</td>
        <td>${escapeTaskHtml(item.instrumen || '-')}</td>
        <td>${escapeTaskHtml(item.keySignature || '-')}</td>
        <td>${escapeTaskHtml(item.level || '-')}</td>
        <td>${escapeTaskHtml(item.status || '-')}</td>
        <td>${escapeTaskHtml(String(item.progress || 0))}%</td>
        <td>${escapeTaskHtml(item.targetTampil ? formatAcademyDate(item.targetTampil) : '-')}</td>
        <td>${escapeTaskHtml(item.eventTampil || '-')}</td>
      </tr>`).join('');
      win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
        *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;background:#eef2f6;color:#17232d}.toolbar{position:sticky;top:0;z-index:5;display:flex;gap:10px;align-items:center;justify-content:flex-end;padding:12px 18px;background:#17232d}.toolbar button{border:0;border-radius:9px;padding:10px 16px;font-weight:700;cursor:pointer}.pdf{background:#f15a24;color:#fff}.print{background:#fff;color:#17232d}.close{background:#334155;color:#fff}.hint{margin-right:auto;color:#cbd5e1;font-size:12px}.sheet{width:min(1120px,calc(100% - 32px));margin:24px auto;background:#fff;padding:28px;box-shadow:0 12px 30px rgba(15,23,42,.12)}header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #f15a24;padding-bottom:16px;margin-bottom:18px}.brand{display:flex;align-items:center;gap:16px}.brand img{width:145px;height:auto}.brand-copy h1{margin:0;font-size:23px}.brand-copy p{margin:5px 0 0;color:#64748b;font-size:12px}.meta{text-align:right;font-size:11px;color:#64748b;line-height:1.6}.summary{display:flex;gap:10px;margin:0 0 16px}.summary div{flex:1;border:1px solid #fed7aa;background:#fff8f4;border-radius:10px;padding:10px}.summary span{display:block;color:#9a3412;font-size:10px}.summary b{display:block;font-size:17px;margin-top:3px}table{width:100%;border-collapse:collapse;font-size:10.5px}th,td{border:1px solid #d8dee8;padding:7px;vertical-align:top}th{background:#fff3ed;text-align:left;color:#9a3412}td span{color:#64748b}footer{margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;text-align:center}@page{size:A4 landscape;margin:10mm}@media print{body{background:#fff}.toolbar{display:none}.sheet{width:100%;margin:0;padding:0;box-shadow:none}}
      </style></head><body><div class="toolbar"><span class="hint">Simpan PDF membuka dialog cetak; pilih “Save as PDF / Simpan sebagai PDF”.</span><button class="pdf" onclick="lmcSavePdf('paper','landscape','Repertoire-Legacy-Music-Center.pdf',this)">Simpan PDF</button><button class="print" onclick="lmcPrintDoc('paper','landscape','Repertoire-Legacy-Music-Center.pdf',this)">Cetak</button><button class="close" onclick="window.close()">Tutup</button></div><main class="sheet" id="paper"><header><div class="brand"><img src="${escapeTaskHtml(logoUrl)}" alt="Legacy Music Center"><div class="brand-copy"><h1>${title}</h1><p>${escapeTaskHtml(focusLabel || 'Semua Siswa')}</p></div></div><div class="meta">Legacy Music Center<br>Dicetak ${new Date().toLocaleString('id-ID')}</div></header><div class="summary"><div><span>Total Lagu</span><b>${items.length}</b></div><div><span>Siap Tampil</span><b>${items.filter(i=>String(i.status||'').toLowerCase()==='siap tampil').length}</b></div><div><span>Dikuasai / Sudah Tampil</span><b>${items.filter(i=>['dikuasai','sudah tampil'].includes(String(i.status||'').toLowerCase())).length}</b></div><div><span>Rata-rata Progress</span><b>${items.length ? Math.round(items.reduce((s,i)=>s+(Number(i.progress||0)||0),0)/items.length) : 0}%</b></div></div><table><thead><tr><th>No</th><th>Lagu / Composer</th><th>Siswa</th><th>Instrumen</th><th>Key</th><th>Level</th><th>Status</th><th>Progress</th><th>Target Tampil</th><th>Event</th></tr></thead><tbody>${rows || '<tr><td colspan="10">Belum ada data repertoire.</td></tr>'}</tbody></table><footer>Legacy Music Center • Repertoire / Daftar Lagu Siswa</footer></main><script>function lmcLoadScript(src,test){return new Promise(function(resolve,reject){try{if(test()){resolve();return;}var old=document.querySelector('script[data-lmc-src="'+src+'"]');if(old){old.addEventListener('load',function(){test()?resolve():reject(new Error('Library PDF tidak siap.'));},{once:true});old.addEventListener('error',function(){reject(new Error('Gagal memuat library PDF.'));},{once:true});return;}var s=document.createElement('script');s.src=src;s.async=true;s.dataset.lmcSrc=src;s.onload=function(){test()?resolve():reject(new Error('Library PDF tidak siap.'));};s.onerror=function(){reject(new Error('Gagal memuat library PDF.'));};document.head.appendChild(s);}catch(e){reject(e);}})}
async function lmcEnsurePdf(){await lmcLoadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',function(){return typeof window.html2canvas==='function';});await lmcLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF);});}
function lmcIsIOS(){return /iPad|iPhone|iPod/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
async function lmcWaitImages(root){var imgs=Array.prototype.slice.call(root.querySelectorAll('img'));await Promise.all(imgs.map(function(img){if(img.complete)return Promise.resolve();return new Promise(function(resolve){var done=function(){resolve();};img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});setTimeout(resolve,1800);});}));}
async function lmcCreatePdf(targetId,orientation,filename){await lmcEnsurePdf();var target=document.getElementById(targetId);if(!target)throw new Error('Dokumen tidak ditemukan.');await lmcWaitImages(target);var canvas=await window.html2canvas(target,{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:0});var jsPDF=window.jspdf.jsPDF;var landscape=orientation==='landscape';var pageW=landscape?297:210,pageH=landscape?210:297;var pdf=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'mm',format:'a4',compress:true});var sliceH=Math.floor(canvas.width*(pageH/pageW));var y=0,pageIndex=0;while(y<canvas.height){var h=Math.min(sliceH,canvas.height-y);var slice=document.createElement('canvas');slice.width=canvas.width;slice.height=h;var ctx=slice.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,slice.width,slice.height);ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);var data=slice.toDataURL('image/jpeg',0.94);if(pageIndex>0)pdf.addPage('a4',landscape?'landscape':'portrait');var drawH=pageW*(h/canvas.width);pdf.addImage(data,'JPEG',0,0,pageW,Math.min(drawH,pageH),undefined,'FAST');y+=h;pageIndex++;}return {blob:pdf.output('blob'),filename:filename};}
async function lmcShareOrDownload(blob,filename,title,preferPrint){var file=new File([blob],filename,{type:'application/pdf'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:title||filename,text:preferPrint?'Pilih Print/Cetak dari menu berbagi.':''});return true;}catch(e){if(e&&e.name==='AbortError')return true;}}var url=URL.createObjectURL(blob);if(preferPrint&&lmcIsIOS()){var opened=window.open(url,'_blank');if(!opened)window.location.href=url;setTimeout(function(){URL.revokeObjectURL(url);},120000);return true;}var a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},120000);return true;}
async function lmcSavePdf(targetId,orientation,filename,button){var old=button?button.textContent:'';try{if(button){button.disabled=true;button.textContent='Menyiapkan PDF...';}var r=await lmcCreatePdf(targetId,orientation,filename);await lmcShareOrDownload(r.blob,r.filename,'Legacy Music Center',false);}catch(e){alert('Gagal membuat PDF: '+(e&&e.message?e.message:e));}finally{if(button){button.disabled=false;button.textContent=old||'Simpan PDF';}}}
async function lmcPrintDoc(targetId,orientation,filename,button){if(!lmcIsIOS()){window.print();return;}var old=button?button.textContent:'';try{if(button){button.disabled=true;button.textContent='Menyiapkan Cetak...';}var r=await lmcCreatePdf(targetId,orientation,filename);await lmcShareOrDownload(r.blob,r.filename,'Cetak dokumen Legacy Music Center',true);}catch(e){alert('Gagal menyiapkan cetak: '+(e&&e.message?e.message:e));}finally{if(button){button.disabled=false;button.textContent=old||'Cetak';}}}<\/script></body></html>`);
      win.document.close();
      win.focus();
    }
