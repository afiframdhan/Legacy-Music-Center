    function formatLearningProgressPeriod(period) {
      const range = String(period || '').match(/^(\d{4})-(\d{2})~(\d{4})-(\d{2})$/);
      const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      if (range) {
        const start = `${names[Number(range[2]) - 1]} ${range[1]}`;
        const end = `${names[Number(range[4]) - 1]} ${range[3]}`;
        return `${start} – ${end}`;
      }
      const quarter = String(period || '').match(/^(\d{4})-Q([1-4])$/i);
      if (quarter) {
        const ranges = { 1:'Januari–Maret', 2:'April–Juni', 3:'Juli–September', 4:'Oktober–Desember' };
        return `Triwulan ${quarter[2]} (${ranges[quarter[2]]}) ${quarter[1]}`;
      }
      const match = String(period || '').match(/^(\d{4})-(\d{2})$/);
      if (!match) return period || '-';
      return `${names[Number(match[2]) - 1]} ${match[1]}`;
    }

    function getLearningProgressPeriodType(record) {
      if (!record) return 'Bulanan';
      return record.tipePeriode === 'Tiga Bulan' || /-Q|~/.test(String(record.periode || '').toUpperCase()) ? 'Tiga Bulan' : 'Bulanan';
    }

    function getCurrentLearningProgress(studentName, period, periodType) {
      const records = globalLearningProgressList.filter(item => String(item.namaSiswa || '').trim().toLowerCase() === String(studentName || '').trim().toLowerCase());
      if (period) return records.find(item => String(item.periode || '') === String(period) && (!periodType || getLearningProgressPeriodType(item) === periodType)) || null;
      return records[0] || null;
    }

    function getLearningComponentStatusText(progress, key) {
      const status = progress[key + 'Status'] || 'Belum Dimulai';
      const value = Math.max(0, Math.min(100, Number(progress[key + 'Progress']) || 0));
      if (status === 'Selesai') return `Selesai • Nilai ${value}/100`;
      if (status === 'Dalam Proses') return `${value}% tercapai • ${100 - value}% lagi`;
      return 'Belum dimulai • 0%';
    }

    function renderLearningProgressRecord(progress) {
      if (!progress) return '<div class="lp-body"><div class="lp-empty"><strong>Progress Belajar belum tersedia</strong><span>Pilih periode lain atau minta coach membuat laporan baru.</span></div></div>';
      const overall = Math.max(0, Math.min(100, Number(progress.overallProgress) || 0));
      const completed = learningProgressCategories.filter(category => progress[category.key + 'Status'] === 'Selesai').length;
      return `<div class="lp-minimal-card" role="button" tabindex="0" onclick="openLearningProgressDetailModal()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openLearningProgressDetailModal();}"><div class="lp-minimal-score" style="--score:${overall * 3.6}deg"><span>${overall}%</span></div><div class="lp-minimal-info"><strong>${escapeTaskHtml(progress.namaSiswa || 'Progress Belajar')} • ${escapeTaskHtml(progress.level || '-')}</strong><p>${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))} · ${completed} dari ${learningProgressCategories.length} komponen selesai<br>Target: ${escapeTaskHtml(progress.targetBerikutnya || 'Belum ditentukan.')}</p></div><button type="button" class="lp-minimal-button">Buka Detail →</button></div>`;
    }

    function renderLearningProgressViews() {
      const studentContainer = document.getElementById('learningProgressDashboardSiswa');
      if (studentContainer) {
        if (currentUser.userType === 'siswa') {
          const latest = getCurrentLearningProgress(currentUser.userName);
          if (latest) {
            const score = Math.max(0, Math.min(100, Number(latest.overallProgress) || 0));
            studentContainer.innerHTML = `<div class="lp-student-compact"><div class="lp-compact-score">${score}%</div><div class="lp-compact-main"><strong>Progress Belajar • ${escapeTaskHtml(latest.level || '-')}</strong><span>${escapeTaskHtml(formatLearningProgressPeriod(latest.periode))} • Target: ${escapeTaskHtml(latest.targetBerikutnya || 'Belum ditentukan')}</span></div><button type="button" class="lp-edit-btn" onclick="switchTab('section-learning-progress')">Lihat Detail →</button></div>`;
          } else {
            studentContainer.innerHTML = '<div class="lp-student-compact"><div class="lp-compact-score">0%</div><div class="lp-compact-main"><strong>Progress Belajar</strong><span>Coach belum membuat laporan progress.</span></div><button type="button" class="lp-edit-btn" onclick="switchTab(\'section-learning-progress\')">Lihat Detail →</button></div>';
          }
        } else studentContainer.innerHTML = '';
      }
      refreshLearningProgressPage();
    }

    function getDefaultLearningPeriod(type) {
      const now = new Date();
      if (type === 'Tiga Bulan') return getLearningThreeMonthPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function refreshLearningProgressPage(resetPeriod) {
      const studentSelect = document.getElementById('lpPageStudent');
      const typeSelect = document.getElementById('lpPagePeriodType');
      const periodSelect = document.getElementById('lpPagePeriod');
      const content = document.getElementById('learningProgressPageContent');
      if (!studentSelect || !typeSelect || !periodSelect || !content) return;
      const isStudent = currentUser.userType === 'siswa';
      const names = isStudent ? [currentUser.userName] : [...new Set((globalSiswaList || []).map(item => String(item.nama || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      const oldStudent = studentSelect.value || globalSelectedLearningProgressStudent;
      studentSelect.innerHTML = names.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
      studentSelect.value = names.includes(oldStudent) ? oldStudent : (names.find(name => getCurrentLearningProgress(name)) || names[0] || '');
      document.getElementById('lpPageStudentGroup').style.display = isStudent ? 'none' : 'block';
      globalSelectedLearningProgressStudent = studentSelect.value || currentUser.userName;
      const type = typeSelect.value || 'Bulanan';
      const oldPeriod = resetPeriod ? '' : periodSelect.value;
      const periods = [...new Set(globalLearningProgressList.filter(item => String(item.namaSiswa || '').toLowerCase() === String(globalSelectedLearningProgressStudent || '').toLowerCase() && getLearningProgressPeriodType(item) === type).map(item => item.periode).filter(Boolean))].sort().reverse();
      if (!periods.length) periods.push(getDefaultLearningPeriod(type));
      periodSelect.innerHTML = periods.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(formatLearningProgressPeriod(value))}</option>`).join('');
      periodSelect.value = periods.includes(oldPeriod) ? oldPeriod : periods[0];
      const progress = getCurrentLearningProgress(globalSelectedLearningProgressStudent, periodSelect.value, type);
      content.innerHTML = renderLearningProgressRecord(progress);
      document.getElementById('lpPageEditButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      document.getElementById('lpPageDeleteButton').style.display = currentUser.userType === 'guru' && progress ? 'inline-flex' : 'none';
      document.getElementById('lpPagePrintButton').style.display = progress && currentUser.userType !== 'siswa' ? 'inline-flex' : 'none';
    }

    function getLearningProgressCurrentMonth() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function getLearningThreeMonthPeriod(startMonth) {
      const match = String(startMonth || '').match(/^(\d{4})-(\d{2})$/);
      if (!match) return '';
      const start = new Date(Number(match[1]), Number(match[2]) - 1, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 2, 1);
      return `${match[1]}-${match[2]}~${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
    }

    function getLearningPeriodStart(period) {
      const range = String(period || '').match(/^(\d{4}-\d{2})~/);
      if (range) return range[1];
      const quarter = String(period || '').match(/^(\d{4})-Q([1-4])$/i);
      if (quarter) return `${quarter[1]}-${String((Number(quarter[2]) - 1) * 3 + 1).padStart(2, '0')}`;
      return getLearningProgressCurrentMonth();
    }

    function updateLearningThreeMonthHint() {
      const hint = document.getElementById('lpPeriodThreeHint');
      const period = getLearningThreeMonthPeriod(document.getElementById('lpPeriodThreeStart').value);
      if (hint) hint.textContent = period ? `Laporan: ${formatLearningProgressPeriod(period)}` : 'Pilih bulan awal laporan.';
    }

    function getLearningProgressFormPeriod() {
      return document.getElementById('lpPeriodType').value === 'Tiga Bulan' ? getLearningThreeMonthPeriod(document.getElementById('lpPeriodThreeStart').value) : document.getElementById('lpPeriodMonth').value;
    }

    function toggleLearningProgressPeriodInput() {
      const quarterly = document.getElementById('lpPeriodType').value === 'Tiga Bulan';
      document.getElementById('lpPeriodMonth').style.display = quarterly ? 'none' : 'block';
      document.getElementById('lpPeriodMonth').required = !quarterly;
      document.getElementById('lpPeriodThreeStart').style.display = quarterly ? 'block' : 'none';
      document.getElementById('lpPeriodThreeStart').required = quarterly;
      document.getElementById('lpPeriodThreeHint').style.display = quarterly ? 'block' : 'none';
      updateLearningThreeMonthHint();
    }

    function setLearningProgressFormRecord(record, studentName) {
      document.getElementById('lpProgressID').value = record ? record.progressID || '' : '';
      const student = (globalSiswaList || []).find(item => String(item.nama || '').trim().toLowerCase() === String(studentName || '').trim().toLowerCase());
      const allowedLevels = ['Beginner','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Advance'];
      const level = record ? record.level : '';
      document.getElementById('lpLevel').value = allowedLevels.includes(level) ? level : 'Beginner';
      learningProgressCategories.forEach(category => {
        const prefix = `lp${category.key.charAt(0).toUpperCase() + category.key.slice(1)}`;
        const status = document.getElementById(prefix + 'Status');
        const progress = document.getElementById(prefix + 'Progress');
        const note = document.getElementById(prefix + 'Catatan');
        if (status) status.value = record ? record[category.key + 'Status'] || 'Belum Dimulai' : 'Belum Dimulai';
        if (progress) progress.value = record ? Number(record[category.key + 'Progress']) || 0 : 0;
        if (note) note.value = record ? record[category.key + 'Catatan'] || '' : '';
      });
      document.getElementById('lpKelebihan').value = record ? record.kelebihan || '' : '';
      document.getElementById('lpPerluDitingkatkan').value = record ? record.perluDitingkatkan || '' : '';
      document.getElementById('lpTargetBerikutnya').value = record ? record.targetBerikutnya || '' : '';
      document.getElementById('lpKepalaSekolahNama').value = record ? record.kepalaSekolahNama || '' : '';
      document.getElementById('lpGuruSignatureUrl').value = record ? record.guruSignatureUrl || '' : '';
      document.getElementById('lpGuruSignatureName').value = record ? record.guruSignatureName || '' : '';
      document.getElementById('lpKepalaSignatureUrl').value = record ? record.kepalaSekolahSignatureUrl || '' : '';
      document.getElementById('lpKepalaSignatureName').value = record ? record.kepalaSekolahSignatureName || '' : '';
      document.getElementById('lpGuruSignatureFile').value = '';
      document.getElementById('lpKepalaSignatureFile').value = '';
      renderLearningSignaturePreview('lpGuruSignaturePreview', record ? record.guruSignatureUrl : '', record ? record.guruSignatureName : '');
      renderLearningSignaturePreview('lpKepalaSignaturePreview', record ? record.kepalaSekolahSignatureUrl : '', record ? record.kepalaSekolahSignatureName : '');
      updateLearningProgressPreview();
    }

    function openLearningProgressModal() {
      if (currentUser.userType !== 'guru') return;
      const select = document.getElementById('lpStudent');
      const students = (globalSiswaList || []).filter(item => String(item.status || '').toLowerCase() !== 'keluar');
      select.innerHTML = students.map(item => `<option value="${escapeTaskHtml(item.nama)}">${escapeTaskHtml(item.nama)} (${escapeTaskHtml(item.instrumen || 'Kelas Musik')})</option>`).join('');
      const selected = globalSelectedLearningProgressStudent && students.some(item => item.nama === globalSelectedLearningProgressStudent) ? globalSelectedLearningProgressStudent : (students[0] ? students[0].nama : '');
      if (!selected) { showAlert('alertDanger', 'Belum ada siswa yang dapat diisi progressnya.'); return; }
      select.value = selected;
      const pageType = document.getElementById('lpPagePeriodType')?.value || 'Bulanan';
      const pagePeriod = document.getElementById('lpPagePeriod')?.value || getDefaultLearningPeriod(pageType);
      document.getElementById('lpPeriodType').value = pageType;
      document.getElementById('lpPeriodMonth').value = pageType === 'Bulanan' ? pagePeriod : getLearningProgressCurrentMonth();
      document.getElementById('lpPeriodThreeStart').value = pageType === 'Tiga Bulan' ? getLearningPeriodStart(pagePeriod) : getLearningProgressCurrentMonth();
      toggleLearningProgressPeriodInput();
      const exact = getCurrentLearningProgress(selected, pagePeriod, pageType);
      setLearningProgressFormRecord(exact, selected);
      if (!exact) reuseLatestLearningSignatures(selected);
      document.getElementById('modalLearningProgress').style.display = 'flex';
    }

    function loadLearningProgressFormForStudent(studentName) {
      const type = document.getElementById('lpPeriodType').value;
      const period = getLearningProgressFormPeriod() || getDefaultLearningPeriod(type);
      const record = getCurrentLearningProgress(studentName, period, type);
      setLearningProgressFormRecord(record, studentName);
      if (!record) reuseLatestLearningSignatures(studentName);
    }

    function reuseLatestLearningSignatures(studentName) {
      const latest = getCurrentLearningProgress(studentName);
      if (!latest) return;
      document.getElementById('lpKepalaSekolahNama').value = latest.kepalaSekolahNama || '';
      document.getElementById('lpGuruSignatureUrl').value = latest.guruSignatureUrl || '';
      document.getElementById('lpGuruSignatureName').value = latest.guruSignatureName || '';
      document.getElementById('lpKepalaSignatureUrl').value = latest.kepalaSekolahSignatureUrl || '';
      document.getElementById('lpKepalaSignatureName').value = latest.kepalaSekolahSignatureName || '';
      renderLearningSignaturePreview('lpGuruSignaturePreview', latest.guruSignatureUrl, latest.guruSignatureName);
      renderLearningSignaturePreview('lpKepalaSignaturePreview', latest.kepalaSekolahSignatureUrl, latest.kepalaSekolahSignatureName);
    }

    function handleLearningStatusChange(keyName) {
      const status = document.getElementById(`lp${keyName}Status`);
      const score = document.getElementById(`lp${keyName}Progress`);
      if (!status || !score) return;
      if (status.value === 'Belum Dimulai') { score.value = 0; score.disabled = true; }
      else if (status.value === 'Dalam Proses') { score.disabled = false; if (Number(score.value) <= 0 || Number(score.value) >= 100) score.value = 50; }
      else { score.disabled = false; if (Number(score.value) <= 0) score.value = 100; }
      updateLearningProgressPreview();
    }

    function updateLearningProgressPreview() {
      const total = learningProgressCategories.reduce((sum, category) => {
        const keyName = category.key.charAt(0).toUpperCase() + category.key.slice(1);
        const status = document.getElementById(`lp${keyName}Status`)?.value || 'Belum Dimulai';
        const scoreInput = document.getElementById(`lp${keyName}Progress`);
        let score = Math.max(0, Math.min(100, Number(scoreInput?.value) || 0));
        if (status === 'Belum Dimulai') score = 0;
        if (status === 'Dalam Proses') score = Math.max(1, Math.min(99, score));
        if (scoreInput) { scoreInput.value = score; scoreInput.disabled = status === 'Belum Dimulai'; }
        const hint = document.getElementById(`lp${keyName}Hint`);
        if (hint) hint.textContent = status === 'Selesai' ? `Selesai • Nilai ${score}/100` : (status === 'Dalam Proses' ? `${score}% tercapai • ${100 - score}% lagi` : 'Belum dimulai • 0%');
        return sum + score;
      }, 0);
      const value = Math.round(total / learningProgressCategories.length);
      const preview = document.getElementById('lpOverallPreview');
      if (preview) preview.textContent = `Nilai keseluruhan: ${value}/100 (rata-rata komponen)`;
    }

    function renderLearningSignaturePreview(targetId, url, name) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.innerHTML = url ? `<img src="${escapeTaskHtml(url)}" alt="${escapeTaskHtml(name || 'Tanda tangan')}">` : 'Belum ada gambar';
    }

    function previewLearningSignature(input, targetId) {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) { input.value = ''; showAlert('alertDanger', 'Tanda tangan harus berupa file gambar.'); return; }
      if (file.size > 5 * 1024 * 1024) { input.value = ''; showAlert('alertDanger', 'Ukuran gambar tanda tangan maksimal 5 MB.'); return; }
      const reader = new FileReader();
      reader.onload = event => renderLearningSignaturePreview(targetId, event.target.result, file.name);
      reader.readAsDataURL(file);
    }

    function handleSaveLearningProgress(event) {
      event.preventDefault();
      const button = document.getElementById('btnSaveLearningProgress');
      button.disabled = true;
      button.textContent = 'Menyimpan...';
      const guruFile = document.getElementById('lpGuruSignatureFile').files[0];
      const kepalaFile = document.getElementById('lpKepalaSignatureFile').files[0];
      const payload = {
        progressID: document.getElementById('lpProgressID').value,
        namaSiswa: document.getElementById('lpStudent').value,
        level: document.getElementById('lpLevel').value,
        tipePeriode: document.getElementById('lpPeriodType').value,
        periode: getLearningProgressFormPeriod(),
        kelebihan: document.getElementById('lpKelebihan').value,
        perluDitingkatkan: document.getElementById('lpPerluDitingkatkan').value,
        targetBerikutnya: document.getElementById('lpTargetBerikutnya').value,
        kepalaSekolahNama: document.getElementById('lpKepalaSekolahNama').value,
        guruSignatureUrl: document.getElementById('lpGuruSignatureUrl').value,
        guruSignatureName: document.getElementById('lpGuruSignatureName').value,
        kepalaSekolahSignatureUrl: document.getElementById('lpKepalaSignatureUrl').value,
        kepalaSekolahSignatureName: document.getElementById('lpKepalaSignatureName').value
      };
      learningProgressCategories.forEach(category => {
        const prefix = `lp${category.key.charAt(0).toUpperCase() + category.key.slice(1)}`;
        payload[category.key + 'Status'] = document.getElementById(prefix + 'Status').value;
        payload[category.key + 'Progress'] = Number(document.getElementById(prefix + 'Progress').value) || 0;
        payload[category.key + 'Catatan'] = document.getElementById(prefix + 'Catatan').value;
      });

      Promise.all([filesToPayload(guruFile ? [guruFile] : []), filesToPayload(kepalaFile ? [kepalaFile] : [])]).then(result => {
        payload.guruSignatureFile = result[0][0] || null;
        payload.kepalaSekolahSignatureFile = result[1][0] || null;
        google.script.run.withSuccessHandler(response => {
          button.disabled = false;
          button.textContent = 'Simpan Progress';
          showAlert(response.success ? 'alertSuccess' : 'alertDanger', response.message);
          if (response.success) { globalSelectedLearningProgressStudent = payload.namaSiswa; closeLearningProgressModal(); fetchDashboardData(); }
        }).withFailureHandler(error => {
          button.disabled = false;
          button.textContent = 'Simpan Progress';
          showAlert('alertDanger', 'Gagal menyimpan progress: ' + error.message);
        }).saveLearningProgress(payload, currentUser.userName, currentUser.userType);
      }).catch(error => {
        button.disabled = false;
        button.textContent = 'Simpan Progress';
        showAlert('alertDanger', 'Gagal membaca gambar tanda tangan: ' + error.message);
      });
      return false;
    }

    function closeLearningProgressModal() { document.getElementById('modalLearningProgress').style.display = 'none'; }
    function handleLearningProgressBackdrop(event) { if (event.target && event.target.id === 'modalLearningProgress') closeLearningProgressModal(); }

    function openLearningProgressDetailModal() {
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress) return;
      const overall = Math.max(0, Math.min(100, Number(progress.overallProgress) || 0));
      const rows = learningProgressCategories.map(category => {
        const percent = Math.max(0, Math.min(100, Number(progress[category.key + 'Progress']) || 0));
        return `<div class="lp-form-component"><div class="lp-form-component-title"><span>${category.icon} ${category.label}</span><span>${percent}/100</span></div><div class="task-status ${percent === 100 ? 'done' : (percent > 0 ? 'open' : '')}" style="display:inline-block;margin-bottom:8px;">${escapeTaskHtml(getLearningComponentStatusText(progress, category.key))}</div><div class="lp-component-bar"><span style="width:${percent}%"></span></div><div style="font-size:11px;line-height:1.55;color:#64748b;margin-top:9px;white-space:pre-line;">${escapeTaskHtml(progress[category.key + 'Catatan'] || 'Belum ada catatan khusus.')}</div></div>`;
      }).join('');
      document.getElementById('lpDetailTitle').textContent = `Progress Belajar • ${progress.namaSiswa}`;
      const signatures = `<div class="lp-detail-notes"><div class="lp-note"><span>Guru / Coach</span>${progress.guruSignatureUrl ? `<img src="${escapeTaskHtml(progress.guruSignatureUrl)}" style="max-width:150px;max-height:65px;object-fit:contain;display:block;margin:4px 0;">` : ''}<p>${escapeTaskHtml(progress.guru || '-')}</p></div><div class="lp-note"><span>Kepala Sekolah</span>${progress.kepalaSekolahSignatureUrl ? `<img src="${escapeTaskHtml(progress.kepalaSekolahSignatureUrl)}" style="max-width:150px;max-height:65px;object-fit:contain;display:block;margin:4px 0;">` : ''}<p>${escapeTaskHtml(progress.kepalaSekolahNama || '-')}</p></div></div>`;
      document.getElementById('lpDetailBody').innerHTML = `<div class="lp-summary" style="margin-bottom:18px;"><div class="lp-ring" style="--lp-progress:${overall * 3.6}deg"><div class="lp-ring-value">${overall}</div></div><div class="lp-summary-info"><h3>${escapeTaskHtml(progress.level || '-')}</h3><div class="lp-main-bar"><span style="width:${overall}%"></span></div><div class="lp-period">${escapeTaskHtml(progress.kelas || '-')} • ${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))}<br>Diperbarui ${escapeTaskHtml(progress.lastUpdated || '-')} oleh ${escapeTaskHtml(progress.guru || '-')}</div></div><div class="lp-target"><div class="lp-target-icon">◎</div><div><strong>Target Berikutnya</strong><p>${escapeTaskHtml(progress.targetBerikutnya || 'Belum ditentukan.')}</p></div></div></div><div class="lp-form-components">${rows}</div><div class="lp-detail-notes">${progress.kelebihan ? `<div class="lp-note"><span>Kelebihan</span><p>${escapeTaskHtml(progress.kelebihan)}</p></div>` : ''}${progress.perluDitingkatkan ? `<div class="lp-note"><span>Perlu ditingkatkan</span><p>${escapeTaskHtml(progress.perluDitingkatkan)}</p></div>` : ''}</div>${signatures}`;
      document.getElementById('lpDetailEditButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      document.getElementById('lpDetailDeleteButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      document.getElementById('modalLearningProgressDetail').style.display = 'flex';
    }

    function closeLearningProgressDetailModal() { document.getElementById('modalLearningProgressDetail').style.display = 'none'; }
    function handleLearningProgressDetailBackdrop(event) { if (event.target && event.target.id === 'modalLearningProgressDetail') closeLearningProgressDetailModal(); }

    function getSelectedLearningProgressPageRecord() {
      const student = document.getElementById('lpPageStudent')?.value || globalSelectedLearningProgressStudent || currentUser.userName;
      const type = document.getElementById('lpPagePeriodType')?.value || 'Bulanan';
      const period = document.getElementById('lpPagePeriod')?.value || '';
      return getCurrentLearningProgress(student, period, type);
    }

    function deleteSelectedLearningProgress() {
      if (currentUser.userType !== 'guru') return;
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress || !progress.progressID) { showAlert('alertDanger', 'Data progress tidak ditemukan.'); return; }
      if (!confirm(`Hapus Progress Belajar ${progress.namaSiswa} untuk ${formatLearningProgressPeriod(progress.periode)}?`)) return;
      google.script.run.withSuccessHandler(response => {
        showAlert(response.success ? 'alertSuccess' : 'alertDanger', response.message);
        if (response.success) { closeLearningProgressDetailModal(); fetchDashboardData(); }
      }).withFailureHandler(error => showAlert('alertDanger', 'Gagal menghapus progress: ' + error.message))
        .deleteLearningProgress(progress.progressID, currentUser.userName, currentUser.userType);
    }

    function printLearningProgressReport() {
      if (currentUser.userType === 'siswa') { showAlert('alertDanger', 'Cetak laporan hanya tersedia untuk guru dan admin.'); return; }
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress) { showAlert('alertDanger', 'Tidak ada laporan pada periode yang dipilih.'); return; }
      const printWindow = window.open('', '_blank', 'width=900,height=700');
      if (!printWindow) { showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk mencetak laporan.'); return; }
      printWindow.document.write('<!doctype html><html><body style="font-family:Arial;padding:32px;color:#64748b">Menyiapkan laporan...</body></html>');
      google.script.run.withSuccessHandler(response => {
        buildLearningProgressPrintWindow(progress, printWindow, response && response.success ? response.dataUrl : '');
      }).withFailureHandler(() => buildLearningProgressPrintWindow(progress, printWindow, '')).getLearningProgressPrintLogo();
    }

    function buildLearningProgressPrintWindow(progress, printWindow, logoDataUrl) {
      const rows = learningProgressCategories.map(category => {
        const score = Math.max(0, Math.min(100, Number(progress[category.key + 'Progress']) || 0));
        return `<tr><td><b>${category.label}</b></td><td>${escapeTaskHtml(progress[category.key + 'Status'] || 'Belum Dimulai')}</td><td class="score">${score}/100</td><td>${escapeTaskHtml(progress[category.key + 'Catatan'] || '-')}</td></tr>`;
      }).join('');
      const signature = (url, name, role) => `<div class="signature"><div>${role}</div><div class="signature-image">${url ? `<img src="${escapeTaskHtml(url)}">` : ''}</div><b>${escapeTaskHtml(name || '-')}</b></div>`;
      const report = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Progress ${escapeTaskHtml(progress.namaSiswa)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17232d;margin:0;font-size:10.5px}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f15a24;padding-bottom:10px;margin-bottom:13px;min-height:78px}.brand-logo{width:128px;height:78px;object-fit:contain;object-position:left center}.brand h1{font-size:20px;margin:0 0 5px}.brand strong{color:#f15a24}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}.meta div,.summary{background:#fff7f2;border:1px solid #fed9c6;border-radius:8px;padding:8px}.meta span{display:block;color:#7b8aa0;font-size:8px;text-transform:uppercase;margin-bottom:3px}.summary{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.summary b{font-size:23px;color:#f15a24}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#f15a24;color:#fff;padding:7px;text-align:left}th:nth-child(1){width:20%}th:nth-child(2){width:18%}th:nth-child(3){width:14%}td{border:1px solid #dfe6ee;padding:7px;vertical-align:top;line-height:1.35;word-wrap:break-word}.score{text-align:center;font-weight:bold;white-space:nowrap}.notes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.note{border:1px solid #dfe6ee;border-radius:8px;padding:8px;min-height:52px}.note b{display:block;color:#f15a24;margin-bottom:4px}.signatures{display:flex;justify-content:space-around;gap:28px;margin-top:20px;text-align:center;page-break-inside:avoid}.signature{width:220px}.signature-image{height:64px;display:flex;align-items:center;justify-content:center}.signature img{max-width:160px;max-height:60px;object-fit:contain}.footer{margin-top:14px;padding-top:7px;border-top:1px solid #e8edf2;color:#94a3b8;font-size:8px;text-align:right}@media print{button{display:none}}</style></head><body><div class="brand"><div>${logoDataUrl ? `<img class="brand-logo" src="${logoDataUrl}" alt="Legacy Music Center">` : '<strong>LEGACY MUSIC CENTER</strong>'}</div><div style="text-align:right"><h1>Laporan Progress Belajar</h1><strong>${escapeTaskHtml(getLearningProgressPeriodType(progress))}</strong></div></div><div class="meta"><div><span>Nama Siswa</span><b>${escapeTaskHtml(progress.namaSiswa)}</b></div><div><span>Kelas</span><b>${escapeTaskHtml(progress.kelas || '-')}</b></div><div><span>Level</span><b>${escapeTaskHtml(progress.level || '-')}</b></div><div><span>Periode</span><b>${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))}</b></div></div><div class="summary"><div><b style="font-size:12px">Nilai Keseluruhan</b><br>Rata-rata dari tujuh komponen</div><b>${Number(progress.overallProgress) || 0}/100</b></div><table><thead><tr><th>Komponen</th><th>Status</th><th>Nilai/Proses</th><th>Catatan</th></tr></thead><tbody>${rows}</tbody></table><div class="notes"><div class="note"><b>Kelebihan</b>${escapeTaskHtml(progress.kelebihan || '-')}</div><div class="note"><b>Perlu Ditingkatkan</b>${escapeTaskHtml(progress.perluDitingkatkan || '-')}</div><div class="note"><b>Target Berikutnya</b>${escapeTaskHtml(progress.targetBerikutnya || '-')}</div><div class="note"><b>Terakhir Diperbarui</b>${escapeTaskHtml(progress.lastUpdated || '-')}</div></div><div class="signatures">${signature(progress.guruSignatureUrl, progress.guru, 'Guru / Coach')}${signature(progress.kepalaSekolahSignatureUrl, progress.kepalaSekolahNama, 'Kepala Sekolah')}</div><div class="footer">Dokumen resmi Legacy Music Center • Dicetak dari sistem Progress Belajar</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),650));<\/script></body></html>`;
      const printReadyReport = report.replace('<style>', '<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}');
      printWindow.document.open(); printWindow.document.write(printReadyReport); printWindow.document.close();
    }

