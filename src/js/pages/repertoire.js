    let repertoirePageLoaded = false;
    let repertoireActiveDetailId = '';

    function loadRepertoirePage(forceReload = false) {
      const addBtn = document.getElementById('repertoireAddButton');
      const printBtn = document.getElementById('repertoirePrintButton');
      const studentWrap = document.getElementById('repertoireStudentFilterWrap');
      const loading = document.getElementById('repertoireLoadingState');
      if (addBtn) addBtn.style.display = currentUser.userType === 'siswa' ? 'none' : 'inline-flex';
      if (printBtn) printBtn.style.display = 'inline-flex';
      if (studentWrap) studentWrap.style.display = currentUser.userType === 'siswa' ? 'none' : 'block';

      if (!forceReload && repertoirePageLoaded && Array.isArray(globalRepertoireList)) {
        populateRepertoireFilters();
        renderRepertoirePage();
        return;
      }

      if (loading) loading.style.display = 'block';
      google.script.run
        .withSuccessHandler(result => {
          if (!result || result.success === false) {
            showAlert('alertDanger', (result && result.message) || 'Data repertoire gagal dimuat.');
            return;
          }
          globalRepertoireList = Array.isArray(result.items) ? result.items : [];
          repertoirePageLoaded = true;
          populateRepertoireFilters();
          renderRepertoirePage();
        })
        .withFailureHandler(error => {
          showAlert('alertDanger', 'Data repertoire gagal dimuat: ' + (error.message || error));
        })
        .getRepertoireData();
    }

    function populateRepertoireFilters() {
      const studentSelect = document.getElementById('repertoireStudentFilter');
      const instrumentSelect = document.getElementById('repertoireInstrumentFilter');
      const statusSelect = document.getElementById('repertoireStatusFilter');
      if (!studentSelect || !instrumentSelect || !statusSelect) return;

      if (currentUser.userType !== 'siswa') {
        const students = (globalSiswaList || []).slice().sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
        const current = studentSelect.value;
        studentSelect.innerHTML = '<option value="">Semua Siswa</option>' + students.map(item => `<option value="${escapeTaskHtml(item.siswaID || '')}">${escapeTaskHtml(item.nama || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')}</option>`).join('');
        studentSelect.value = Array.from(studentSelect.options).some(opt => opt.value === current) ? current : '';
      } else {
        studentSelect.innerHTML = `<option value="${escapeTaskHtml(currentUser.userID || '')}">${escapeTaskHtml(currentUser.userName || 'Siswa Saya')}</option>`;
        studentSelect.value = currentUser.userID || '';
      }

      const items = Array.isArray(globalRepertoireList) ? globalRepertoireList : [];
      const instruments = [...new Set(items.map(item => String(item.instrumen || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      const statuses = [...new Set(items.map(item => String(item.status || '').trim()).filter(Boolean))];

      const currentInstrument = instrumentSelect.value;
      const currentStatus = statusSelect.value;
      instrumentSelect.innerHTML = '<option value="">Semua Instrumen</option>' + instruments.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      instrumentSelect.value = Array.from(instrumentSelect.options).some(opt => opt.value === currentInstrument) ? currentInstrument : '';

      const fallbackStatuses = ['Belajar', 'Siap Tampil', 'Dikuasai', 'Sudah Tampil'];
      const mergedStatuses = [...new Set([...fallbackStatuses, ...statuses])];
      statusSelect.innerHTML = '<option value="">Semua Status</option>' + mergedStatuses.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      statusSelect.value = Array.from(statusSelect.options).some(opt => opt.value === currentStatus) ? currentStatus : '';
    }

    function repertoireFilteredItems() {
      const search = String(document.getElementById('repertoireSearch')?.value || '').trim().toLowerCase();
      const studentId = String(document.getElementById('repertoireStudentFilter')?.value || '').trim();
      const instrument = String(document.getElementById('repertoireInstrumentFilter')?.value || '').trim().toLowerCase();
      const status = String(document.getElementById('repertoireStatusFilter')?.value || '').trim().toLowerCase();
      let items = Array.isArray(globalRepertoireList) ? globalRepertoireList.slice() : [];

      if (currentUser.userType === 'siswa') {
        items = items.filter(item => String(item.siswaID || '').trim() === String(currentUser.userID || '').trim());
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
      const canManage = currentUser.userType !== 'siswa';
      container.innerHTML = items.map(item => {
        const progress = Math.max(0, Math.min(100, Number(item.progress || 0) || 0));
        const target = item.targetTampil ? `Target tampil ${escapeTaskHtml(formatAcademyDate(item.targetTampil))}` : 'Belum ada target tampil';
        const lastShow = item.tanggalTampilTerakhir ? `Tampil terakhir ${escapeTaskHtml(formatAcademyDate(item.tanggalTampilTerakhir))}` : '';
        return `<article class="repertoire-item" onclick="openRepertoireDetail('${escapeTaskHtml(item.repertoireID || '')}')">
          <div class="repertoire-item-head">
            <div>
              <div class="repertoire-item-title">${escapeTaskHtml(item.judulLagu || '-')}</div>
              <div class="repertoire-item-subtitle">${escapeTaskHtml(item.namaSiswa || '-')} • ${escapeTaskHtml(item.instrumen || 'Musik')}</div>
            </div>
            <span class="repertoire-badge ${repertoireStatusTone(item.status)}">${escapeTaskHtml(item.status || 'Belajar')}</span>
          </div>
          <div class="repertoire-meta-grid">
            <div class="repertoire-meta"><span>Composer</span><strong>${escapeTaskHtml(item.composer || '-')}</strong></div>
            <div class="repertoire-meta"><span>Key</span><strong>${escapeTaskHtml(item.keySignature || '-')}</strong></div>
            <div class="repertoire-meta"><span>Level</span><strong>${escapeTaskHtml(item.level || '-')}</strong></div>
            <div class="repertoire-meta"><span>Progress</span><strong>${progress}%</strong></div>
          </div>
          <div class="repertoire-progress"><i style="width:${progress}%"></i></div>
          <div class="repertoire-item-footer">
            <span>${target}</span>
            <span>${escapeTaskHtml(lastShow || item.eventTampil || '')}</span>
          </div>
          ${canManage ? `<div class="repertoire-item-actions" onclick="event.stopPropagation()"><button type="button" class="btn-action btn-edit" onclick="openRepertoireModalById('${escapeTaskHtml(item.repertoireID || '')}')">Edit</button><button type="button" class="btn-action btn-delete" onclick="confirmDeleteRepertoire('${escapeTaskHtml(item.repertoireID || '')}')">Hapus</button></div>` : ''}
        </article>`;
      }).join('');
    }

    function renderRepertoireSummary() {
      const box = document.getElementById('repertoireSummary');
      if (!box) return;
      const items = repertoireFilteredItems();
      const selectedStudentId = String(document.getElementById('repertoireStudentFilter')?.value || '').trim();
      const student = (globalSiswaList || []).find(item => String(item.siswaID || '') === selectedStudentId) || null;
      const upcoming = items.filter(item => item.targetTampil).slice().sort((a,b) => String(a.targetTampil).localeCompare(String(b.targetTampil))).slice(0,5);
      const ready = items.filter(item => String(item.status || '').toLowerCase() === 'siap tampil').slice(0,5);
      const performed = items.filter(item => item.tanggalTampilTerakhir || String(item.status || '').toLowerCase() === 'sudah tampil').slice(0,5);
      const focusStudentLabel = currentUser.userType === 'siswa'
        ? (currentUser.userName || 'Siswa')
        : (student ? `${student.nama || '-'} • ${student.instrumen || 'Musik'}` : 'Semua siswa');

      const listHtml = (list, emptyText, formatter) => list.length
        ? `<div class="repertoire-summary-list">${list.map(item => formatter(item)).join('')}</div>`
        : `<div class="repertoire-empty small">${escapeTaskHtml(emptyText)}</div>`;

      box.innerHTML = `
        <div class="repertoire-summary-card">
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
          ${listHtml(ready, 'Belum ada repertoire yang berstatus siap tampil.', item => `<button type="button" class="repertoire-summary-row" onclick="openRepertoireDetail('${escapeTaskHtml(item.repertoireID || '')}')"><b>${escapeTaskHtml(item.judulLagu || '-')}</b><span>${escapeTaskHtml(item.namaSiswa || '-')} • ${escapeTaskHtml(item.instrumen || '')}</span></button>`)}
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
      const students = (globalSiswaList || []).slice().sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
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
          loadRepertoirePage(true);
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
          loadRepertoirePage(true);
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
      const title = 'Repertoire / Daftar Lagu Siswa';
      const win = window.open('', '_blank', 'width=1200,height=900');
      if (!win) return;
      const rows = items.map((item, index) => `<tr>
        <td>${index + 1}</td>
        <td>${escapeTaskHtml(item.namaSiswa || '-')}</td>
        <td>${escapeTaskHtml(item.instrumen || '-')}</td>
        <td>${escapeTaskHtml(item.judulLagu || '-')}</td>
        <td>${escapeTaskHtml(item.composer || '-')}</td>
        <td>${escapeTaskHtml(item.status || '-')}</td>
        <td>${escapeTaskHtml(String(item.progress || 0))}%</td>
        <td>${escapeTaskHtml(item.targetTampil ? formatAcademyDate(item.targetTampil) : '-')}</td>
        <td>${escapeTaskHtml(item.eventTampil || '-')}</td>
      </tr>`).join('');
      win.document.write(`<!doctype html><html><head><title>${title}</title><style>
        body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h1{margin:0 0 6px;font-size:24px}p{margin:0 0 18px;color:#475569}
        table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top}th{background:#fff3ed;text-align:left;color:#9a3412}
      </style></head><body><h1>${title}</h1><p>Dicetak ${new Date().toLocaleString('id-ID')}</p><table><thead><tr><th>No</th><th>Siswa</th><th>Instrumen</th><th>Judul Lagu</th><th>Composer</th><th>Status</th><th>Progress</th><th>Target Tampil</th><th>Event</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Belum ada data repertoire.</td></tr>'}</tbody></table></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 250);
    }
