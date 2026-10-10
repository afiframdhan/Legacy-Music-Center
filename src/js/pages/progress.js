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

    function learningProgressSignatureCandidates(value) {
      const raw = String(value || '').trim();
      if (!raw) return [];
      const list = [];
      const push = url => { const clean=String(url||'').trim(); if(clean && !list.includes(clean)) list.push(clean); };
      if (/^data:image\//i.test(raw) || /^blob:/i.test(raw)) { push(raw); return list; }
      let match = raw.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
      if (!match) match = raw.match(/[?&]id=([^&#]+)/i);
      if (!match) match = raw.match(/googleusercontent\.com\/d\/([^/?#]+)/i);
      if (match && match[1]) {
        const id = decodeURIComponent(match[1]);
        push(`https://lh3.googleusercontent.com/d/${id}`);
        push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`);
        push(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`);
      }
      push(raw);
      return list;
    }

    function learningProgressSignatureFallback(img) {
      if (!img) return;
      try {
        const list = JSON.parse(img.dataset.lpSignatureFallbacks || '[]');
        const index = Number(img.dataset.lpSignatureFallbackIndex || 0);
        if (index < list.length) { img.dataset.lpSignatureFallbackIndex = String(index + 1); img.src = list[index]; return; }
      } catch (_) {}
      img.style.display = 'none';
    }

    function learningProgressSignatureHtml(url, alt='Tanda tangan', inlineStyle='') {
      const candidates = learningProgressSignatureCandidates(url);
      if (!candidates.length) return '';
      return `<img src="${escapeTaskHtml(candidates[0])}" data-lp-signature-fallbacks='${escapeTaskHtml(JSON.stringify(candidates.slice(1)))}' data-lp-signature-fallback-index="0" onerror="learningProgressSignatureFallback(this)" alt="${escapeTaskHtml(alt)}"${inlineStyle ? ` style="${inlineStyle}"` : ''}>`;
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

    function learningProgressStudentClasses(student) {
      if (typeof getStudentClassesForUI === 'function') return getStudentClassesForUI(student);
      return Array.isArray(student?.kelasList) && student.kelasList.length
        ? student.kelasList
        : [{ instrumen:student?.instrumen || '', guru:student?.guru || '', guruID:student?.guruID || '' }];
    }

    function learningProgressStudentMatchesFilters(student, teacherValue, instrumentValue) {
      const teacherNeedle = String(teacherValue || '').trim().toLowerCase();
      const instrumentNeedle = String(instrumentValue || '').trim().toLowerCase();
      if (!teacherNeedle && !instrumentNeedle) return true;
      return learningProgressStudentClasses(student).some(item => {
        const teacherId = String(item.guruID || '').trim().toLowerCase();
        const teacherName = String(item.guru || '').trim().toLowerCase();
        const instrument = String(item.instrumen || '').trim().toLowerCase();
        const teacherOk = !teacherNeedle || teacherId === teacherNeedle || teacherName === teacherNeedle;
        const instrumentOk = !instrumentNeedle || instrument === instrumentNeedle;
        return teacherOk && instrumentOk;
      });
    }

    function populateLearningProgressRoleFilters() {
      const isStudent = currentUser.userType === 'siswa';
      const isAdmin = currentUser.userType === 'admin';
      const teacherGroup = document.getElementById('lpPageTeacherGroup');
      const instrumentGroup = document.getElementById('lpPageInstrumentGroup');
      const teacherSelect = document.getElementById('lpPageTeacher');
      const instrumentSelect = document.getElementById('lpPageInstrument');
      const searchGroup = document.getElementById('lpPageStudentSearchGroup');
      const studentGroup = document.getElementById('lpPageStudentGroup');

      if (teacherGroup) teacherGroup.style.display = isAdmin ? 'block' : 'none';
      if (instrumentGroup) instrumentGroup.style.display = isStudent ? 'none' : 'block';
      if (searchGroup) searchGroup.style.display = isStudent ? 'none' : 'block';
      if (studentGroup) studentGroup.style.display = isStudent ? 'none' : 'block';

      if (isAdmin && teacherSelect) {
        const oldTeacher = teacherSelect.value;
        const teachers = (globalGuruList || []).slice().sort((a,b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
        teacherSelect.innerHTML = '<option value="">Semua Guru</option>' + teachers.map(item => `<option value="${escapeTaskHtml(item.id || item.nama || '')}">${escapeTaskHtml(item.nama || '-')} (${escapeTaskHtml(item.instrumen || 'Musik')})</option>`).join('');
        teacherSelect.value = Array.from(teacherSelect.options).some(opt => opt.value === oldTeacher) ? oldTeacher : '';
      } else if (teacherSelect) {
        teacherSelect.value = '';
      }

      if (instrumentSelect && !isStudent) {
        const oldInstrument = instrumentSelect.value;
        const selectedTeacher = isAdmin ? String(teacherSelect?.value || '').trim() : '';
        const instruments = new Set();
        (globalSiswaList || []).forEach(student => {
          learningProgressStudentClasses(student).forEach(item => {
            const teacherId = String(item.guruID || '').trim();
            const teacherName = String(item.guru || '').trim();
            const teacherMatch = !selectedTeacher || teacherId === selectedTeacher || teacherName.toLowerCase() === selectedTeacher.toLowerCase();
            if (teacherMatch && String(item.instrumen || '').trim()) instruments.add(String(item.instrumen || '').trim());
          });
        });
        const values = [...instruments].sort((a,b) => a.localeCompare(b,'id'));
        instrumentSelect.innerHTML = '<option value="">Semua Instrumen</option>' + values.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
        instrumentSelect.value = values.includes(oldInstrument) ? oldInstrument : '';
      } else if (instrumentSelect) {
        instrumentSelect.value = '';
      }
    }

    function refreshLearningProgressPage(resetPeriod, fromSearch) {
      const studentSelect = document.getElementById('lpPageStudent');
      const typeSelect = document.getElementById('lpPagePeriodType');
      const periodSelect = document.getElementById('lpPagePeriod');
      const content = document.getElementById('learningProgressPageContent');
      if (!studentSelect || !typeSelect || !periodSelect || !content) return;

      const isStudent = currentUser.userType === 'siswa';
      const isAdmin = currentUser.userType === 'admin';
      populateLearningProgressRoleFilters();

      const teacherValue = isAdmin ? String(document.getElementById('lpPageTeacher')?.value || '').trim() : '';
      const instrumentValue = !isStudent ? String(document.getElementById('lpPageInstrument')?.value || '').trim() : '';
      const searchInput = document.getElementById('lpPageStudentSearch');
      const searchTerm = !isStudent && searchInput ? String(searchInput.value || '').trim().toLowerCase() : '';

      let roleStudents = isStudent
        ? [{ nama:currentUser.userName, siswaID:currentUser.userID }]
        : (globalSiswaList || []).filter(item => String(item.status || '').toLowerCase() !== 'keluar');

      if (!isStudent) {
        roleStudents = roleStudents.filter(student => learningProgressStudentMatchesFilters(student, teacherValue, instrumentValue));
      }
      if (searchTerm) roleStudents = roleStudents.filter(student => String(student.nama || '').toLowerCase().includes(searchTerm));
      roleStudents.sort((a,b) => String(a.nama || '').localeCompare(String(b.nama || ''),'id'));

      const names = [...new Set(roleStudents.map(item => String(item.nama || '').trim()).filter(Boolean))];
      const oldStudent = studentSelect.value;
      if (isStudent) {
        studentSelect.innerHTML = `<option value="${escapeTaskHtml(currentUser.userName || '')}">${escapeTaskHtml(currentUser.userName || 'Siswa')}</option>`;
        studentSelect.value = currentUser.userName || '';
      } else {
        studentSelect.innerHTML = '<option value="">Semua Siswa</option>' + names.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
        studentSelect.value = oldStudent && names.includes(oldStudent) ? oldStudent : '';
      }

      const selectedStudent = isStudent ? currentUser.userName : studentSelect.value;
      globalSelectedLearningProgressStudent = selectedStudent || '';
      const type = typeSelect.value || '';
      const oldPeriod = resetPeriod ? '' : periodSelect.value;
      const matchingNames = selectedStudent ? [selectedStudent] : names;
      const matchingNameSet = new Set(matchingNames.map(name => String(name).trim().toLowerCase()));
      const matchingRecords = (globalLearningProgressList || []).filter(item => {
        if (!matchingNameSet.has(String(item.namaSiswa || '').trim().toLowerCase())) return false;
        return !type || getLearningProgressPeriodType(item) === type;
      });
      const periods = [...new Set(matchingRecords.map(item => item.periode).filter(Boolean))].sort().reverse();
      periodSelect.innerHTML = '<option value="">Semua Periode</option>' + periods.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(formatLearningProgressPeriod(value))}</option>`).join('');
      periodSelect.value = oldPeriod && periods.includes(oldPeriod) ? oldPeriod : '';
      const selectedPeriod = periodSelect.value;

      if (!selectedStudent && !isStudent) {
        const latestByStudent = names.map(name => {
          const studentRecords = matchingRecords.filter(item => String(item.namaSiswa || '').trim().toLowerCase() === String(name).trim().toLowerCase() && (!selectedPeriod || String(item.periode || '') === selectedPeriod));
          return studentRecords[0] || null;
        }).filter(Boolean);
        content.innerHTML = latestByStudent.length
          ? `<div class="lp-all-students-list">${latestByStudent.map(progress => {
              const progressId = encodeURIComponent(String(progress.progressID || ''));
              const overall = Math.max(0, Math.min(100, Number(progress.overallProgress) || 0));
              return `<div class="lp-minimal-card" role="button" tabindex="0" onclick="openLearningProgressDetailById(decodeURIComponent('${progressId}'))" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openLearningProgressDetailById(decodeURIComponent('${progressId}'));}"><div class="lp-minimal-score" style="--score:${overall * 3.6}deg"><span>${overall}%</span></div><div class="lp-minimal-info"><strong>${escapeTaskHtml(progress.namaSiswa || '-')} • ${escapeTaskHtml(progress.level || '-')}</strong><p>${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))} · ${escapeTaskHtml(getLearningProgressPeriodType(progress))}<br>Target: ${escapeTaskHtml(progress.targetBerikutnya || 'Belum ditentukan.')}</p></div><button type="button" class="lp-minimal-button" tabindex="-1">Buka Detail →</button></div>`;
            }).join('')}</div>`
          : '<div class="lp-body"><div class="lp-empty"><strong>Belum ada Progress Belajar</strong><span>Tidak ada laporan yang cocok dengan filter saat ini.</span></div></div>';
        document.getElementById('lpPageEditButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
        document.getElementById('lpPageDeleteButton').style.display = 'none';
        document.getElementById('lpPagePrintButton').style.display = 'none';
        return;
      }

      let progress = null;
      if (selectedPeriod) progress = getCurrentLearningProgress(selectedStudent, selectedPeriod, type || undefined);
      else progress = matchingRecords.find(item => String(item.namaSiswa || '').trim().toLowerCase() === String(selectedStudent || '').trim().toLowerCase()) || null;
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
      const students = (globalSiswaList || []).filter(isOperationalStudent);
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
          if (response.success) { globalSelectedLearningProgressStudent = payload.namaSiswa; closeLearningProgressModal(); if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['progress']); }
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

    function openLearningProgressDetailById(progressID) {
      const progress = (globalLearningProgressList || []).find(item => String(item.progressID || '') === String(progressID || ''));
      if (!progress) { showAlert('alertDanger', 'Detail progress tidak ditemukan.'); return; }
      globalSelectedLearningProgressStudent = progress.namaSiswa || '';
      openLearningProgressDetailModal(progress);
    }

    function openLearningProgressDetailModal(progressOverride) {
      const progress = progressOverride || getSelectedLearningProgressPageRecord();
      if (!progress) return;
      const detailModal = document.getElementById('modalLearningProgressDetail');
      if (detailModal) detailModal.dataset.progressId = String(progress.progressID || '');
      const overall = Math.max(0, Math.min(100, Number(progress.overallProgress) || 0));
      const rows = learningProgressCategories.map(category => {
        const percent = Math.max(0, Math.min(100, Number(progress[category.key + 'Progress']) || 0));
        return `<div class="lp-form-component"><div class="lp-form-component-title"><span>${category.icon} ${category.label}</span><span>${percent}/100</span></div><div class="task-status ${percent === 100 ? 'done' : (percent > 0 ? 'open' : '')}" style="display:inline-block;margin-bottom:8px;">${escapeTaskHtml(getLearningComponentStatusText(progress, category.key))}</div><div class="lp-component-bar"><span style="width:${percent}%"></span></div><div style="font-size:11px;line-height:1.55;color:#64748b;margin-top:9px;white-space:pre-line;">${escapeTaskHtml(progress[category.key + 'Catatan'] || 'Belum ada catatan khusus.')}</div></div>`;
      }).join('');
      document.getElementById('lpDetailTitle').textContent = `Progress Belajar • ${progress.namaSiswa}`;
      const signatures = `<div class="lp-detail-notes"><div class="lp-note"><span>Guru / Coach</span>${learningProgressSignatureHtml(progress.guruSignatureUrl,'Tanda tangan guru','max-width:150px;max-height:65px;object-fit:contain;display:block;margin:4px 0;')}<p>${escapeTaskHtml(progress.guru || '-')}</p></div><div class="lp-note"><span>Kepala Sekolah</span>${learningProgressSignatureHtml(progress.kepalaSekolahSignatureUrl,'Tanda tangan kepala sekolah','max-width:150px;max-height:65px;object-fit:contain;display:block;margin:4px 0;')}<p>${escapeTaskHtml(progress.kepalaSekolahNama || '-')}</p></div></div>`;
      document.getElementById('lpDetailBody').innerHTML = `<div class="lp-summary" style="margin-bottom:18px;"><div class="lp-ring" style="--lp-progress:${overall * 3.6}deg"><div class="lp-ring-value">${overall}</div></div><div class="lp-summary-info"><h3>${escapeTaskHtml(progress.level || '-')}</h3><div class="lp-main-bar"><span style="width:${overall}%"></span></div><div class="lp-period">${escapeTaskHtml(progress.kelas || '-')} • ${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))}<br>Diperbarui ${escapeTaskHtml(progress.lastUpdated || '-')} oleh ${escapeTaskHtml(progress.guru || '-')}</div></div><div class="lp-target"><div class="lp-target-icon">◎</div><div><strong>Target Berikutnya</strong><p>${escapeTaskHtml(progress.targetBerikutnya || 'Belum ditentukan.')}</p></div></div></div><div class="lp-form-components">${rows}</div><div class="lp-detail-notes">${progress.kelebihan ? `<div class="lp-note"><span>Kelebihan</span><p>${escapeTaskHtml(progress.kelebihan)}</p></div>` : ''}${progress.perluDitingkatkan ? `<div class="lp-note"><span>Perlu ditingkatkan</span><p>${escapeTaskHtml(progress.perluDitingkatkan)}</p></div>` : ''}</div>${signatures}`;
      document.getElementById('lpDetailEditButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      document.getElementById('lpDetailDeleteButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      const detailPrintButton = document.getElementById('lpDetailPrintButton');
      if (detailPrintButton) detailPrintButton.style.display = currentUser.userType !== 'siswa' ? 'inline-flex' : 'none';
      document.getElementById('modalLearningProgressDetail').style.display = 'flex';
    }

    function closeLearningProgressDetailModal() {
      const modal = document.getElementById('modalLearningProgressDetail');
      if (!modal) return;
      modal.style.display = 'none';
      delete modal.dataset.progressId;
    }
    function handleLearningProgressDetailBackdrop(event) { if (event.target && event.target.id === 'modalLearningProgressDetail') closeLearningProgressDetailModal(); }

    function editLearningProgressDetailRecord() {
      if (currentUser.userType !== 'guru') return;
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress) { showAlert('alertDanger', 'Data progress tidak ditemukan.'); return; }
      const searchInput = document.getElementById('lpPageStudentSearch');
      if (searchInput) searchInput.value = '';
      const typeSelect = document.getElementById('lpPagePeriodType');
      if (typeSelect) typeSelect.value = getLearningProgressPeriodType(progress);
      closeLearningProgressDetailModal();
      refreshLearningProgressPage(true);
      const studentSelect = document.getElementById('lpPageStudent');
      if (studentSelect) studentSelect.value = progress.namaSiswa || '';
      refreshLearningProgressPage(true);
      const periodSelect = document.getElementById('lpPagePeriod');
      if (periodSelect) periodSelect.value = progress.periode || '';
      refreshLearningProgressPage(false);
      openLearningProgressModal();
    }

    function getSelectedLearningProgressPageRecord() {
      const detailModal = document.getElementById('modalLearningProgressDetail');
      const detailProgressId = detailModal && detailModal.style.display !== 'none' ? String(detailModal.dataset.progressId || '') : '';
      if (detailProgressId) {
        const detailProgress = (globalLearningProgressList || []).find(item => String(item.progressID || '') === detailProgressId);
        if (detailProgress) return detailProgress;
      }
      const rawStudent = document.getElementById('lpPageStudent')?.value || '';
      const student = currentUser.userType === 'siswa' ? currentUser.userName : (rawStudent || globalSelectedLearningProgressStudent || '');
      if (!student) return null;
      const type = document.getElementById('lpPagePeriodType')?.value || '';
      const period = document.getElementById('lpPagePeriod')?.value || '';
      if (period) return getCurrentLearningProgress(student, period, type || undefined);
      return (globalLearningProgressList || []).find(item => String(item.namaSiswa || '').trim().toLowerCase() === String(student).trim().toLowerCase() && (!type || getLearningProgressPeriodType(item) === type)) || null;
    }

    function deleteSelectedLearningProgress() {
      if (currentUser.userType !== 'guru') return;
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress || !progress.progressID) { showAlert('alertDanger', 'Data progress tidak ditemukan.'); return; }
      if (!confirm(`Hapus Progress Belajar ${progress.namaSiswa} untuk ${formatLearningProgressPeriod(progress.periode)}?`)) return;
      google.script.run.withSuccessHandler(response => {
        showAlert(response.success ? 'alertSuccess' : 'alertDanger', response.message);
        if (response.success) { closeLearningProgressDetailModal(); if (typeof queueLiveModuleSync === 'function') queueLiveModuleSync(['progress']); }
      }).withFailureHandler(error => showAlert('alertDanger', 'Gagal menghapus progress: ' + error.message))
        .deleteLearningProgress(progress.progressID, currentUser.userName, currentUser.userType);
    }
    function getLearningProgressPrintableLogoData(callback) {
      const url = new URL('/assets/logo/legacy-logo.png', window.location.origin).href;
      if (typeof callback === 'function') callback(url);
    }


    function printLearningProgressReport() {
      if (currentUser.userType === 'siswa') { showAlert('alertDanger', 'Cetak laporan hanya tersedia untuk guru dan admin.'); return; }
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress) { showAlert('alertDanger', 'Tidak ada laporan pada periode yang dipilih.'); return; }
      const printWindow = window.open('', '_blank', 'width=1020,height=820');
      if (!printWindow) { showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk mencetak laporan.'); return; }
      const logoDataUrl = new URL('/assets/logo/legacy-logo.png', window.location.origin).href;
      buildLearningProgressPrintWindow(progress, printWindow, logoDataUrl);
    }

    function buildLearningProgressPrintWindow(progress, printWindow, logoDataUrl) {
      const rows = learningProgressCategories.map(category => {
        const score=Math.max(0,Math.min(100,Number(progress[category.key+'Progress'])||0));
        return `<tr><td><b>${escapeTaskHtml(category.label)}</b></td><td>${escapeTaskHtml(progress[category.key+'Status']||'Belum Dimulai')}</td><td class="score">${score}/100</td><td>${escapeTaskHtml(progress[category.key+'Catatan']||'-')}</td></tr>`;
      }).join('');
      const signature=(url,name,role)=>{const candidates=learningProgressSignatureCandidates(url);const src=candidates[0]||'';return `<div class="signature"><div class="signature-role">${role}</div><div class="signature-image">${src?`<img src="${escapeTaskHtml(src)}">`:''}</div><b>${escapeTaskHtml(name||'-')}</b></div>`;};
      const safeName=String(progress.namaSiswa||'Siswa').replace(/[^a-z0-9_-]+/gi,'-');
      const report=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Laporan Progress ${escapeTaskHtml(progress.namaSiswa)}</title><style>*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}@page{size:A4 portrait;margin:14mm}html,body{margin:0;background:#e6edf5;font-family:Arial,sans-serif;color:#17232d}.toolbar{position:sticky;top:0;z-index:30;background:#122033;padding:12px;text-align:center}.toolbar button{border:0;border-radius:12px;padding:11px 16px;font-weight:800;margin:0 4px;font-size:15px}.ghost{background:#fff;color:#334155}.secondary{background:#fff0e9;color:#c2410c}.primary{background:#f15a24;color:#fff}.viewport{padding:14px;overflow:auto}.paper{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:14mm;box-shadow:0 12px 36px #0002;transform-origin:top left}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #f15a24;padding-bottom:10px;margin-bottom:13px;min-height:78px}.brand-logo{width:128px;height:78px;object-fit:contain;object-position:left center}.brand h1{font-size:20px;margin:0 0 5px}.brand strong{color:#f15a24}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}.meta div,.summary{background:#fff7f2;border:1px solid #fed9c6;border-radius:10px;padding:8px}.meta span{display:block;color:#7b8aa0;font-size:8px;text-transform:uppercase;margin-bottom:3px}.summary{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.summary b{font-size:23px;color:#f15a24}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#f15a24;color:#fff;padding:7px;text-align:left}th:nth-child(1){width:20%}th:nth-child(2){width:18%}th:nth-child(3){width:14%}td{border:1px solid #dfe6ee;padding:7px;vertical-align:top;line-height:1.35;word-wrap:break-word}.score{text-align:center;font-weight:bold;white-space:nowrap}.notes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.note{border:1px solid #dfe6ee;border-radius:10px;padding:9px;min-height:52px}.note b{display:block;color:#f15a24;margin-bottom:4px}.signatures{display:flex;justify-content:space-around;gap:28px;margin-top:20px;text-align:center}.signature{width:220px}.signature-role{font-size:9px;font-weight:700;color:#64748b;margin-bottom:6px}.signature-image{height:64px;display:flex;align-items:center;justify-content:center}.signature img{max-width:160px;max-height:60px;object-fit:contain}.footer{margin-top:14px;padding-top:7px;border-top:1px solid #e8edf2;color:#94a3b8;font-size:8px;text-align:right}@media print{html,body{background:#fff}.toolbar{display:none!important}.viewport{padding:0;overflow:visible}.paper{box-shadow:none;transform:none!important}}</style></head><body><div class="toolbar"><button class="ghost" onclick="window.close()">Tutup</button><button class="secondary" onclick="lmcSavePdf('paper','portrait','Laporan-Progress-${safeName}.pdf',this)">Simpan PDF</button><button class="primary" onclick="lmcPrintDoc('paper','portrait','Laporan-Progress-${safeName}.pdf',this)">Cetak</button></div><div class="viewport" id="viewport"><div class="paper" id="paper"><div class="brand"><img class="brand-logo" src="${logoDataUrl}" alt="Legacy Music Center"><div style="text-align:right"><h1>Laporan Progress Belajar</h1><strong>${escapeTaskHtml(getLearningProgressPeriodType(progress))}</strong></div></div><div class="meta"><div><span>Nama Siswa</span><b>${escapeTaskHtml(progress.namaSiswa)}</b></div><div><span>Kelas</span><b>${escapeTaskHtml(progress.kelas||'-')}</b></div><div><span>Level</span><b>${escapeTaskHtml(progress.level||'-')}</b></div><div><span>Periode</span><b>${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))}</b></div></div><div class="summary"><div><b style="font-size:12px">Nilai Keseluruhan</b><br>Rata-rata dari tujuh komponen</div><b>${Number(progress.overallProgress)||0}/100</b></div><table><thead><tr><th>Komponen</th><th>Status</th><th>Nilai/Proses</th><th>Catatan</th></tr></thead><tbody>${rows}</tbody></table><div class="notes"><div class="note"><b>Kelebihan</b>${escapeTaskHtml(progress.kelebihan||'-')}</div><div class="note"><b>Perlu Ditingkatkan</b>${escapeTaskHtml(progress.perluDitingkatkan||'-')}</div><div class="note"><b>Target Berikutnya</b>${escapeTaskHtml(progress.targetBerikutnya||'-')}</div><div class="note"><b>Terakhir Diperbarui</b>${escapeTaskHtml(progress.lastUpdated||'-')}</div></div><div class="signatures">${signature(progress.guruSignatureUrl,progress.guru,'Guru / Coach')}${signature(progress.kepalaSekolahSignatureUrl,progress.kepalaSekolahNama,'Kepala Sekolah')}</div><div class="footer">Dokumen resmi Legacy Music Center • Dicetak dari sistem Progress Belajar</div></div></div><script>function lmcLoadScript(src,test){return new Promise(function(resolve,reject){try{if(test()){resolve();return;}var old=document.querySelector('script[data-lmc-src="'+src+'"]');if(old){old.addEventListener('load',function(){test()?resolve():reject(new Error('Library PDF tidak siap.'));},{once:true});old.addEventListener('error',function(){reject(new Error('Gagal memuat library PDF.'));},{once:true});return;}var s=document.createElement('script');s.src=src;s.async=true;s.dataset.lmcSrc=src;s.onload=function(){test()?resolve():reject(new Error('Library PDF tidak siap.'));};s.onerror=function(){reject(new Error('Gagal memuat library PDF.'));};document.head.appendChild(s);}catch(e){reject(e);}})}
async function lmcEnsurePdf(){await lmcLoadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',function(){return typeof window.html2canvas==='function';});await lmcLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',function(){return !!(window.jspdf&&window.jspdf.jsPDF);});}
function lmcIsIOS(){return /iPad|iPhone|iPod/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
async function lmcWaitImages(root){var imgs=Array.prototype.slice.call(root.querySelectorAll('img'));await Promise.all(imgs.map(function(img){if(img.complete)return Promise.resolve();return new Promise(function(resolve){var done=function(){resolve();};img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});setTimeout(resolve,1800);});}));}
async function lmcCreatePdf(targetId,orientation,filename){await lmcEnsurePdf();var target=document.getElementById(targetId);if(!target)throw new Error('Dokumen tidak ditemukan.');await lmcWaitImages(target);var oldTransform=target.style.transform;var oldOrigin=target.style.transformOrigin;target.style.transform='none';target.style.transformOrigin='top left';var canvas=await window.html2canvas(target,{scale:2,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',logging:false,scrollX:0,scrollY:0,windowWidth:Math.max(document.documentElement.scrollWidth,target.scrollWidth),windowHeight:Math.max(document.documentElement.scrollHeight,target.scrollHeight)});target.style.transform=oldTransform;target.style.transformOrigin=oldOrigin;var jsPDF=window.jspdf.jsPDF;var landscape=orientation==='landscape';var pageW=landscape?297:210,pageH=landscape?210:297;var pdf=new jsPDF({orientation:landscape?'landscape':'portrait',unit:'mm',format:'a4',compress:true});var sliceH=Math.floor(canvas.width*(pageH/pageW));var y=0,pageIndex=0;while(y<canvas.height){var h=Math.min(sliceH,canvas.height-y);var slice=document.createElement('canvas');slice.width=canvas.width;slice.height=h;var ctx=slice.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,slice.width,slice.height);ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);var data=slice.toDataURL('image/jpeg',0.94);if(pageIndex>0)pdf.addPage('a4',landscape?'landscape':'portrait');var drawH=pageW*(h/canvas.width);pdf.addImage(data,'JPEG',0,0,pageW,Math.min(drawH,pageH),undefined,'FAST');y+=h;pageIndex++;}return {blob:pdf.output('blob'),filename:filename};}
async function lmcShareOrDownload(blob,filename,title,preferPrint){var file=new File([blob],filename,{type:'application/pdf'});if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:title||filename,text:preferPrint?'Pilih Print/Cetak dari menu berbagi.':''});return true;}catch(e){if(e&&e.name==='AbortError')return true;}}var url=URL.createObjectURL(blob);if(preferPrint&&lmcIsIOS()){var opened=window.open(url,'_blank');if(!opened)window.location.href=url;setTimeout(function(){URL.revokeObjectURL(url);},120000);return true;}var a=document.createElement('a');a.href=url;a.download=filename;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},120000);return true;}
async function lmcSavePdf(targetId,orientation,filename,button){var old=button?button.textContent:'';try{if(button){button.disabled=true;button.textContent='Menyiapkan PDF...';}var r=await lmcCreatePdf(targetId,orientation,filename);await lmcShareOrDownload(r.blob,r.filename,'Legacy Music Center',false);}catch(e){alert('Gagal membuat PDF: '+(e&&e.message?e.message:e));}finally{if(button){button.disabled=false;button.textContent=old||'Simpan PDF';}}}
async function lmcPrintDoc(targetId,orientation,filename,button){if(!lmcIsIOS()){window.print();return;}var old=button?button.textContent:'';try{if(button){button.disabled=true;button.textContent='Menyiapkan Cetak...';}var r=await lmcCreatePdf(targetId,orientation,filename);await lmcShareOrDownload(r.blob,r.filename,'Cetak dokumen Legacy Music Center',true);}catch(e){alert('Gagal menyiapkan cetak: '+(e&&e.message?e.message:e));}finally{if(button){button.disabled=false;button.textContent=old||'Cetak';}}}
function fitPaper(){var p=document.getElementById('paper'),v=document.getElementById('viewport');if(!p||!v||window.matchMedia('print').matches)return;var available=Math.max(320,window.innerWidth-20),scale=Math.min(1,available/p.offsetWidth);p.style.transform='scale('+scale+')';v.style.height=Math.ceil(p.offsetHeight*scale+24)+'px';}window.addEventListener('load',fitPaper);window.addEventListener('resize',fitPaper);setTimeout(fitPaper,100);<\/script></body></html>`;
      printWindow.document.open();printWindow.document.write(report);printWindow.document.close();
    }
