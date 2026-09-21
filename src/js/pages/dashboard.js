    function filterAdminByGuru() {
      renderDashboardViews();
      renderTabelJadwal();
      renderTabelRiwayat();
    }

    function getInstrumenBadgePill(instrumen) {
      const name = (instrumen || 'Gitar').trim();
      const lower = name.toLowerCase();
      
      let icon = '🎸';
      let cssClass = 'instrumen-gitar';

      if (lower.includes('piano')) { icon = '🎹'; cssClass = 'instrumen-piano'; }
      else if (lower.includes('drum')) { icon = '🥁'; cssClass = 'instrumen-drum'; }
      else if (lower.includes('vokal') || lower.includes('vocal')) { icon = '🎤'; cssClass = 'instrumen-vokal'; }
      else if (lower.includes('biola') || lower.includes('violin')) { icon = '🎻'; cssClass = 'instrumen-biola'; }

      return `<span class="instrumen-pill ${cssClass}"><span>${icon}</span> <span>${name}</span></span>`;
    }

    function getStudentClassesForUI(student) {
      return Array.isArray(student && student.kelasList) && student.kelasList.length ? student.kelasList : [{ instrumen:student?.instrumen || '', guru:student?.guru || '', grade:student?.kelas || '' }];
    }

    function studentHasClassValue(student, field, value) {
      const target = String(value || '').trim().toLowerCase();
      if (!target) return true;
      return getStudentClassesForUI(student).some(item => String(item[field] || '').trim().toLowerCase() === target);
    }

    function getScheduleStatusPill(jamMulai, jamSelesai) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const startMin = timeToMinutes(jamMulai);
      const endMin = timeToMinutes(jamSelesai);

      if (currentMin >= startMin && currentMin < endMin) {
        return `<span class="status-pill status-berlangsung">Berlangsung</span>`;
      } else if (currentMin < startMin) {
        return `<span class="status-pill status-menunggu">Menunggu</span>`;
      } else {
        return `<span class="status-pill status-selesai">Selesai</span>`;
      }
    }

    function renderDashboardViews() {
      const selectedGuruFilter = document.getElementById('adminSelectGuruFilter') ? document.getElementById('adminSelectGuruFilter').value.trim().toLowerCase() : '';

      let displayedSiswa = globalSiswaList;
      let displayedJadwal = globalJadwalList;

      if (selectedGuruFilter !== '') {
        displayedSiswa = globalSiswaList.filter(s => studentHasClassValue(s, 'guru', selectedGuruFilter));
        displayedJadwal = globalJadwalList.filter(j => String(j.guru).trim().toLowerCase() === selectedGuruFilter);
      }

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const now = new Date();
      const todayHariName = days[now.getDay()];

      const todaySchedules = displayedJadwal
        .filter(j => String(j.hari).trim().toLowerCase() === todayHariName.toLowerCase())
        .sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));

      const scheduleContainer = document.getElementById('todayScheduleList');
      scheduleContainer.innerHTML = '';

      const barColors = ['bar-orange', 'bar-cyan', 'bar-purple', 'bar-red'];

      if (todaySchedules.length > 0) {
        todaySchedules.forEach((j, index) => {
          const sObj = displayedSiswa.find(s => String(s.nama).trim().toLowerCase() === String(j.namaSiswa).trim().toLowerCase());
          const avatarHtml = getSiswaAvatarHtml(j.namaSiswa, sObj ? sObj.foto : '');
          const durationStr = calculateDurationMinutes(j.jamMulai, j.jamSelesai);
          const instrumenPill = getInstrumenBadgePill(j.instrumen);
          const statusPill = getScheduleStatusPill(j.jamMulai, j.jamSelesai);
          const barClass = barColors[index % barColors.length];
          const gradeText = sObj && sObj.kelas ? sObj.kelas : 'Kelas Privat';

          scheduleContainer.innerHTML += `
            <div class="today-schedule-item ${barClass}" onclick="handleDashboardScheduleClick(event,this,'${j.jadwalID}')" role="button" tabindex="0" aria-expanded="false">
              <div class="sched-time-block">
                <div class="sched-time-text">${j.jamMulai} - ${j.jamSelesai}</div>
                <div class="sched-duration-text">${durationStr}</div>
              </div>
              <div class="sched-student-block">
                ${avatarHtml}
                <div class="sched-student-info">
                  <div class="sched-student-name">${j.namaSiswa}</div>
                  <div class="sched-class-type">${gradeText}</div>
                </div>
              </div>
              <div class="sched-meta-block">
                ${instrumenPill}
                ${statusPill}
                <span class="sched-arrow">❯</span>
              </div>
            </div>`;
        });
      } else {
        scheduleContainer.innerHTML = `<div style="font-size:13px; color:#94a3b8; text-align:center; padding:25px 0; background:#fafafa; border-radius:12px;">Tidak ada jadwal mengajar hari ini (${todayHariName}).</div>`;
      }

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const nextClassWidgetGuru = document.getElementById('nextClassWidgetGuru');
      if (todaySchedules.length > 0) {
        const nextSchedule = todaySchedules.find(j => {
          if (!j.jamMulai) return false;
          return timeToMinutes(j.jamMulai) > currentMinutes;
        });

        if (nextSchedule) {
          const sObjNext = displayedSiswa.find(s => String(s.nama).trim().toLowerCase() === String(nextSchedule.namaSiswa).trim().toLowerCase());
          const nextAvatarHtml = getSiswaAvatarHtml(nextSchedule.namaSiswa, sObjNext ? sObjNext.foto : '');

          nextClassWidgetGuru.innerHTML = `
            <div style="font-size:14px; font-weight:700; color:#1e293b;">${nextSchedule.jamMulai} - ${nextSchedule.jamSelesai} (${nextSchedule.hari})</div>
            <div style="font-size:12.5px; font-weight:600; color:#c2410c; margin-top:2px;">Kelas: ${nextSchedule.instrumen || 'Musik'} | Ruangan: ${nextSchedule.ruangan}</div>
            <div style="font-size:13px; color:#1e293b; margin-top:8px; display:flex; align-items:center; gap:8px;">${nextAvatarHtml} <b>${nextSchedule.namaSiswa}</b></div>`;
        } else {
          nextClassWidgetGuru.innerHTML = `<div style="font-size:13px; color:#64748b;">Tidak ada jadwal berikutnya hari ini.</div>`;
        }
      } else {
        nextClassWidgetGuru.innerHTML = `<div style="font-size:13px; color:#64748b;">Tidak ada jadwal terdekat hari ini.</div>`;
      }

      const ongoingClassWidgetAdmin = document.getElementById('ongoingClassWidgetAdmin');
      const ongoingSchedules = todaySchedules.filter(j => {
        const start = timeToMinutes(j.jamMulai);
        const end = timeToMinutes(j.jamSelesai);
        return currentMinutes >= start && currentMinutes < end;
      });

      if (ongoingSchedules.length > 0) {
        let htmlOngoing = '';
        ongoingSchedules.forEach(item => {
          const sObj = displayedSiswa.find(s => String(s.nama).trim().toLowerCase() === String(item.namaSiswa).trim().toLowerCase());
          const avatarHtml = getSiswaAvatarHtml(item.namaSiswa, sObj ? sObj.foto : '');

          htmlOngoing += `
            <div style="padding:10px 0; border-bottom:1px solid #fed7aa;">
              <div style="font-size:13px; font-weight:700; color:#ea580c;">🕒 ${item.jamMulai} - ${item.jamSelesai} | 📍 ${item.ruangan}</div>
              <div style="font-size:13px; font-weight:600; color:#1e293b; margin-top:4px; display:flex; align-items:center; gap:8px;">
                ${avatarHtml} <span><b>${item.namaSiswa}</b> (${item.instrumen || 'Musik'})</span>
              </div>
              <div style="font-size:12px; color:#64748b; margin-top:2px;">👤 Pengajar: <b>${item.guru || '-'}</b></div>
            </div>`;
        });
        ongoingClassWidgetAdmin.innerHTML = htmlOngoing;
      } else {
        ongoingClassWidgetAdmin.innerHTML = `<div style="font-size:13px; color:#64748b;">Tidak ada kelas yang sedang berlangsung saat ini.</div>`;
      }
      
      const previewBody = document.getElementById('dashSiswaPreviewBody'); previewBody.innerHTML = '';
      displayedSiswa.slice(0, 3).forEach((s, index) => {
        let badgeClass = s.status === 'Cuti' ? 'badge-warning' : (s.status === 'Keluar' ? 'badge-danger' : 'badge-success');
        let avatarHtml = getSiswaAvatarHtml(s.nama, s.foto);
        previewBody.innerHTML += `<tr class="mobile-expand-row dashboard-student-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false">
          <td data-label="No">${index + 1}</td>
          <td data-label="Nama Siswa"><div style="display:flex; align-items:center; gap:10px;">${avatarHtml} <b>${escapeTaskHtml(s.nama)}</b></div></td>
          <td data-label="Kelas / Instrumen"><b>${escapeTaskHtml(s.instrumen || 'Gitar')}</b></td>
          <td data-label="Guru Pengajar">${escapeTaskHtml(s.guru || '-')}</td>
          <td data-label="Grade">${escapeTaskHtml(s.kelas || '-')}</td>
          <td data-label="Status"><span class="badge ${badgeClass}">${escapeTaskHtml(s.status || '-')}</span></td>
        </tr>`;
      });
      restoreDashboardWidgetStates();
    }

    function applySiswaFilters() {
      let result = [...globalSiswaList];
      const urutan = document.getElementById('filterSiswaUrutan') ? document.getElementById('filterSiswaUrutan').value : 'terbaru';

      if (currentUser.userType === 'admin') {
        const filterInst = document.getElementById('filterSiswaInstrumen') ? document.getElementById('filterSiswaInstrumen').value.trim().toLowerCase() : '';
        const filterGuru = document.getElementById('filterSiswaGuru') ? document.getElementById('filterSiswaGuru').value.trim().toLowerCase() : '';

        if (filterInst !== '') {
          result = result.filter(s => studentHasClassValue(s, 'instrumen', filterInst));
        }
        if (filterGuru !== '') {
          result = result.filter(s => studentHasClassValue(s, 'guru', filterGuru));
        }

      }

      result.sort((a, b) => {
        const dateA = parseStudentReportDate(a.tglDaftar);
        const dateB = parseStudentReportDate(b.tglDaftar);
        const timeA = dateA ? dateA.getTime() : null;
        const timeB = dateB ? dateB.getTime() : null;
        if (timeA === null && timeB === null) return String(a.nama || '').localeCompare(String(b.nama || ''), 'id');
        if (timeA === null) return 1;
        if (timeB === null) return -1;
        if (timeA !== timeB) return urutan === 'terlama' ? timeA - timeB : timeB - timeA;
        return String(a.nama || '').localeCompare(String(b.nama || ''), 'id');
      });

      renderGuruSiswaBody(result);
    }

    function renderGuruSiswaBody(list) {
      const sBody = document.getElementById('guruSiswaBody'); sBody.innerHTML = '';

      const selects = document.querySelectorAll('#absensiSiswa, #editJadwalSiswa, #tugasPilihSiswa, #penggantiSiswaSelect, #pengumumanSiswaDetailSelect');
      let options = '<option value="">Pilih Siswa...</option>';
      globalSiswaList.forEach(s => options += `<option value="${s.nama}">${s.nama} (${s.instrumen || 'Gitar'})</option>`);
      selects.forEach(sel => sel.innerHTML = options);

      if (list.length === 0) {
        sBody.innerHTML = `<tr class="table-empty-row"><td class="table-empty-cell" colspan="9">Data siswa tidak ditemukan.</td></tr>`;
        return;
      }

      list.forEach((s, index) => {
        let badgeClass = s.status === 'Cuti' ? 'badge-warning' : (s.status === 'Keluar' ? 'badge-danger' : 'badge-success');
        let avatarHtml = getSiswaAvatarHtml(s.nama, s.foto);
        sBody.innerHTML += `<tr class="mobile-expand-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false">
          <td data-label="No">${index + 1}</td>
          <td data-label="Nama Siswa"><div style="display:flex; align-items:center; gap:10px;">${avatarHtml} <b>${escapeTaskHtml(s.nama)}</b></div></td>
          <td data-label="Instrumen"><b>${escapeTaskHtml(s.instrumen || 'Gitar')}</b></td>
          <td data-label="Guru">${escapeTaskHtml(s.guru || '-')}</td>
          <td data-label="Grade">${escapeTaskHtml(s.kelas || '-')}</td>
          <td data-label="Email">${escapeTaskHtml(s.email || '-')}</td>
          <td data-label="No. HP">${escapeTaskHtml(s.noHp || '-')}</td>
          <td data-label="Status"><span class="badge ${badgeClass}">${escapeTaskHtml(s.status || '-')}</span></td>
          <td data-label="Aksi"><div class="table-actions">
            <button class="btn-action btn-edit" onclick="openEditModal(decodeURIComponent('${encodeURIComponent(s.nama)}'))">Edit</button>
            <button class="btn-action btn-delete" onclick="deleteSiswa(decodeURIComponent('${encodeURIComponent(s.nama)}'))">Hapus</button>
          </div>
          </td>
        </tr>`;
      });

    }

    function applyJadwalFilters() {
      renderTabelJadwal();
      if(calendarInstance) renderCalendarEvents();
    }

    function toggleMobileTableRow(event, row) {
      if (window.innerWidth > 768 || !row) return;
      if (event && event.target && event.target.closest('button,a,input,select,textarea')) return;
      const expanded = row.classList.toggle('mobile-expanded');
      row.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function handleDashboardScheduleClick(event, item, jadwalID) {
      if (window.innerWidth <= 768) {
        if (event && event.target && event.target.closest('button,a,input,select,textarea')) return;
        const expanded = item.classList.toggle('mobile-expanded');
        item.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        return;
      }
      openEditJadwalModal(jadwalID);
    }

    function initializeStudentReports() {
      const monthInput = document.getElementById('studentReportMonth');
      if (!monthInput) return;
      if (!monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      initializeStudentReportFilters();
      renderStudentReports();
    }

    function initializeStudentReportFilters() {
      const guruSelect = document.getElementById('studentReportGuru');
      const instrumenSelect = document.getElementById('studentReportInstrumen');
      if (!guruSelect || !instrumenSelect) return;
      const selectedGuru = guruSelect.value;
      const selectedInstrumen = instrumenSelect.value;
      const allClasses = globalSiswaList.flatMap(item => getStudentClassesForUI(item));
      const guruNames = [...new Set(allClasses.map(item => String(item.guru || '').trim()).filter(name => name && name !== '-'))].sort((a,b) => a.localeCompare(b, 'id'));
      const instruments = [...new Set(allClasses.map(item => String(item.instrumen || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'id'));
      guruSelect.innerHTML = '<option value="">Semua Guru</option>' + guruNames.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
      instrumenSelect.innerHTML = '<option value="">Semua Instrumen</option>' + instruments.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
      guruSelect.value = guruNames.includes(selectedGuru) ? selectedGuru : '';
      instrumenSelect.value = instruments.includes(selectedInstrumen) ? selectedInstrumen : '';
    }

    function getStudentReportFilters() {
      return {
        guru: String(document.getElementById('studentReportGuru')?.value || '').trim().toLowerCase(),
        instrumen: String(document.getElementById('studentReportInstrumen')?.value || '').trim().toLowerCase()
      };
    }

    function matchesStudentReportFilters(item) {
      const filters = getStudentReportFilters();
      return studentHasClassValue(item, 'guru', filters.guru) && studentHasClassValue(item, 'instrumen', filters.instrumen);
    }

    function getFilteredStudentReportStudents() {
      return globalSiswaList.filter(matchesStudentReportFilters);
    }

    function getStudentReportFilterLabel() {
      const guru = document.getElementById('studentReportGuru')?.selectedOptions?.[0]?.textContent || 'Semua Guru';
      const instrumen = document.getElementById('studentReportInstrumen')?.selectedOptions?.[0]?.textContent || 'Semua Instrumen';
      return `${guru} • ${instrumen}`;
    }

    function parseStudentReportDate(value) {
      const text = String(value || '').trim();
      let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
      if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      return null;
    }

    function getStudentReportRange() {
      const monthValue = document.getElementById('studentReportMonth')?.value || '';
      const count = Math.max(1, Number(document.getElementById('studentReportPeriod')?.value || 1));
      const now = new Date();
      const parts = monthValue.match(/^(\d{4})-(\d{2})$/);
      const endMonth = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
      const start = new Date(endMonth.getFullYear(), endMonth.getMonth() - count + 1, 1);
      const end = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1);
      const months = [];
      const names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      const longNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      for (let i = 0; i < count; i++) {
        const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
        months.push({ key:`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label:`${names[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`, fullLabel:`${longNames[date.getMonth()]} ${date.getFullYear()}` });
      }
      const startLabel = `${longNames[start.getMonth()]} ${start.getFullYear()}`;
      const last = new Date(end.getFullYear(), end.getMonth() - 1, 1);
      const endLabel = `${longNames[last.getMonth()]} ${last.getFullYear()}`;
      return { start, end, months, label:count === 1 ? startLabel : `${startLabel} – ${endLabel}` };
    }

    function getStudentMovementsInRange() {
      const range = getStudentReportRange();
      return globalStudentHistory.filter(item => {
        const date = parseStudentReportDate(item.tanggal);
        return date && date >= range.start && date < range.end && matchesStudentReportFilters(item);
      });
    }

    function setStudentReportView(view) {
      studentReportView = view;
      document.querySelectorAll('[data-student-report-tab]').forEach(button => button.classList.toggle('active', button.dataset.studentReportTab === view));
      renderStudentReportTable();
    }

    function renderStudentReports() {
      if (currentUser.userType !== 'admin' || !document.getElementById('studentReportAdminBox')) return;
      const range = getStudentReportRange();
      const movements = getStudentMovementsInRange();
      const masuk = movements.filter(item => String(item.jenis).toLowerCase() === 'masuk').length;
      const keluar = movements.filter(item => String(item.jenis).toLowerCase() === 'keluar').length;
      const net = masuk - keluar;
      const filteredStudents = getFilteredStudentReportStudents();
      document.getElementById('studentReportPeriodLabel').textContent = `Periode: ${range.label} • ${getStudentReportFilterLabel()}`;
      document.getElementById('studentStatIn').textContent = masuk;
      document.getElementById('studentStatOut').textContent = keluar;
      document.getElementById('studentStatNet').textContent = net > 0 ? `+${net}` : String(net);
      document.getElementById('studentStatActive').textContent = filteredStudents.filter(item => String(item.status).toLowerCase() === 'aktif').length;

      const monthly = range.months.map(month => ({
        ...month,
        masuk: movements.filter(item => String(item.jenis).toLowerCase() === 'masuk' && String(item.tanggal || '').slice(0,7) === month.key).length,
        keluar: movements.filter(item => String(item.jenis).toLowerCase() === 'keluar' && String(item.tanggal || '').slice(0,7) === month.key).length
      }));
      const maxValue = Math.max(1, ...monthly.flatMap(item => [item.masuk, item.keluar]));
      document.getElementById('studentTrendChart').innerHTML = monthly.map(item => `<div class="student-trend-month"><div class="student-trend-bars"><div class="student-trend-bar in" style="height:${Math.max(item.masuk ? 8 : 3, (item.masuk / maxValue) * 92)}px"><span>${item.masuk}</span></div><div class="student-trend-bar out" style="height:${Math.max(item.keluar ? 8 : 3, (item.keluar / maxValue) * 92)}px"><span>${item.keluar}</span></div></div><div class="student-trend-label">${item.label}</div></div>`).join('');
      renderStudentReportTable();
    }

    function renderStudentReportTable() {
      const head = document.getElementById('studentReportTableHead');
      const body = document.getElementById('studentReportTableBody');
      if (!head || !body) return;
      if (studentReportView === 'all') {
        const filteredStudents = getFilteredStudentReportStudents();
        head.innerHTML = '<tr><th>No</th><th>Nama Siswa</th><th>Tanggal Masuk</th><th>Instrumen</th><th>Guru</th><th>Grade</th><th>Status</th><th>Tanggal Keluar</th></tr>';
        body.innerHTML = filteredStudents.length ? filteredStudents.map((item, index) => `<tr class="student-report-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false"><td class="student-report-no" data-label="No">${index + 1}</td><td class="student-report-name" data-label="Nama Siswa"><b>${escapeTaskHtml(item.nama || '-')}</b></td><td data-label="Tanggal Masuk">${escapeTaskHtml(formatAcademyDate(item.tglDaftar))}</td><td class="student-report-instrument" data-label="Instrumen">${escapeTaskHtml(item.instrumen || '-')}</td><td data-label="Guru">${escapeTaskHtml(item.guru || '-')}</td><td data-label="Grade">${escapeTaskHtml(item.kelas || '-')}</td><td class="student-report-status" data-label="Status"><span class="badge ${String(item.status).toLowerCase() === 'keluar' ? 'badge-danger' : (String(item.status).toLowerCase() === 'cuti' ? 'badge-warning' : 'badge-success')}">${escapeTaskHtml(item.status || '-')}</span><span class="student-report-chevron">⌄</span></td><td data-label="Tanggal Keluar">${escapeTaskHtml(formatAcademyDate(item.tglKeluar))}</td></tr>`).join('') : '<tr><td class="student-report-empty" colspan="8">Tidak ada siswa yang sesuai dengan filter.</td></tr>';
        return;
      }

      const records = getStudentMovementsInRange().filter(item => String(item.jenis).toLowerCase() === studentReportView.toLowerCase());
      const isExitView = studentReportView.toLowerCase() === 'keluar';
      head.innerHTML = '<tr><th>No</th><th>Tanggal</th><th>Nama Siswa</th><th>Jenis</th><th>Instrumen</th><th>Guru</th><th>Status</th><th>Keterangan</th>' + (isExitView ? '<th>Aksi</th>' : '') + '</tr>';
      body.innerHTML = records.length ? records.map((item, index) => {
        const statusLabel = item.statusSesudah || (String(item.jenis).toLowerCase() === 'keluar' ? 'Keluar' : 'Aktif');
        const statusClass = String(statusLabel).toLowerCase() === 'keluar' ? 'badge-danger' : (String(statusLabel).toLowerCase() === 'cuti' ? 'badge-warning' : 'badge-success');
        const deleteAction = isExitView ? `<td data-label="Aksi"><button type="button" class="btn" style="padding:7px 10px;background:#fee2e2;color:#b91c1c;" onclick="event.stopPropagation();deleteExitedStudentRecord(decodeURIComponent('${encodeURIComponent(item.siswaID || item.nama || '')}'),decodeURIComponent('${encodeURIComponent(item.nama || '')}'))">Hapus Data</button></td>` : '';
        return `<tr class="student-report-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false"><td class="student-report-no" data-label="No">${index + 1}</td><td data-label="Tanggal">${escapeTaskHtml(formatAcademyDate(item.tanggal))}</td><td class="student-report-name" data-label="Nama Siswa"><b>${escapeTaskHtml(item.nama || '-')}</b></td><td data-label="Jenis"><span class="badge ${String(item.jenis).toLowerCase() === 'keluar' ? 'badge-danger' : 'badge-success'}">${escapeTaskHtml(item.jenis)}</span></td><td class="student-report-instrument" data-label="Instrumen">${escapeTaskHtml(item.instrumen || '-')}</td><td data-label="Guru">${escapeTaskHtml(item.guru || '-')}</td><td class="student-report-status" data-label="Status"><span class="badge ${statusClass}">${escapeTaskHtml(statusLabel)}</span><span class="student-report-chevron">⌄</span></td><td data-label="Keterangan">${escapeTaskHtml(item.keterangan || '-')}</td>${deleteAction}</tr>`;
      }).join('') : `<tr><td class="student-report-empty" colspan="${isExitView ? 9 : 8}">Tidak ada data ${escapeTaskHtml(studentReportView.toLowerCase())} pada periode ini.</td></tr>`;
    }

    function printStudentReport(mode) {
      if (currentUser.userType !== 'admin') return;
      const printWindow = window.open('', '_blank', 'width=1100,height=760');
      if (!printWindow) { showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk mencetak laporan.'); return; }
      printWindow.document.write('<!doctype html><html><body style="font-family:Arial;padding:32px;color:#64748b">Menyiapkan laporan siswa...</body></html>');
      google.script.run.withSuccessHandler(response => buildStudentReportPrint(mode, printWindow, response && response.success ? response.dataUrl : '')).withFailureHandler(() => buildStudentReportPrint(mode, printWindow, '')).getLearningProgressPrintLogo();
    }

    function buildStudentReportPrint(mode, printWindow, logoDataUrl) {
      const range = getStudentReportRange();
      const movements = getStudentMovementsInRange();
      const filteredStudents = getFilteredStudentReportStudents();
      const masuk = movements.filter(item => String(item.jenis).toLowerCase() === 'masuk');
      const keluar = movements.filter(item => String(item.jenis).toLowerCase() === 'keluar');
      const active = filteredStudents.filter(item => String(item.status).toLowerCase() === 'aktif').length;
      const monthlyStats = range.months.map(month => ({
        ...month,
        masuk: movements.filter(item => String(item.jenis).toLowerCase() === 'masuk' && String(item.tanggal || '').slice(0,7) === month.key).length,
        keluar: movements.filter(item => String(item.jenis).toLowerCase() === 'keluar' && String(item.tanggal || '').slice(0,7) === month.key).length
      }));
      const chartMax = Math.max(1, ...monthlyStats.flatMap(item => [item.masuk, item.keluar]));
      const chartHtml = `<div class="print-chart"><div class="print-chart-legend"><span><i class="in"></i>Siswa Masuk</span><span><i class="out"></i>Siswa Keluar</span></div><div class="print-chart-bars">${monthlyStats.map(item => `<div class="print-chart-month"><div class="print-chart-values"><div class="print-chart-bar in" style="height:${Math.max(item.masuk ? 12 : 3, (item.masuk / chartMax) * 112)}px"><b>${item.masuk}</b></div><div class="print-chart-bar out" style="height:${Math.max(item.keluar ? 12 : 3, (item.keluar / chartMax) * 112)}px"><b>${item.keluar}</b></div></div><span>${escapeTaskHtml(item.label)}</span></div>`).join('')}</div></div>`;
      const row = values => `<tr>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
      let title = 'Laporan Semua Data Siswa';
      let content = '';

      if (mode === 'all') {
        const rows = filteredStudents.map((item, index) => row([index + 1, `<b>${escapeTaskHtml(item.nama || '-')}</b>`, escapeTaskHtml(formatAcademyDate(item.tglDaftar)), escapeTaskHtml(item.instrumen || '-'), escapeTaskHtml(item.guru || '-'), escapeTaskHtml(item.kelas || '-'), escapeTaskHtml(item.email || '-'), escapeTaskHtml(item.noHp || '-'), escapeTaskHtml(item.status || '-'), escapeTaskHtml(formatAcademyDate(item.tglKeluar))])).join('');
        content = `<div class="summary"><span>Total Siswa <b>${filteredStudents.length}</b></span><span>Aktif <b>${active}</b></span><span>Keluar <b>${filteredStudents.filter(item => String(item.status).toLowerCase() === 'keluar').length}</b></span></div><table><thead><tr><th>No</th><th>Nama</th><th>Tgl Masuk</th><th>Instrumen</th><th>Guru</th><th>Grade</th><th>Email</th><th>No. HP</th><th>Status</th><th>Tgl Keluar</th></tr></thead><tbody>${rows || '<tr><td colspan="10">Belum ada data.</td></tr>'}</tbody></table>`;
      } else {
        title = 'Laporan Statistik Siswa';
        const monthRows = monthlyStats.map((month, index) => row([index + 1, month.fullLabel, month.masuk, month.keluar])).join('');
        const movementRows = movements.map((item, index) => row([index + 1, escapeTaskHtml(formatAcademyDate(item.tanggal)), `<b>${escapeTaskHtml(item.nama || '-')}</b>`, escapeTaskHtml(item.jenis || '-'), escapeTaskHtml(item.instrumen || '-'), escapeTaskHtml(item.guru || '-'), escapeTaskHtml(item.keterangan || '-')])).join('');
        content = `<div class="summary"><span>Siswa Masuk <b>${masuk.length}</b></span><span>Siswa Keluar <b>${keluar.length}</b></span><span>Pertumbuhan Bersih <b>${masuk.length - keluar.length >= 0 ? '+' : ''}${masuk.length - keluar.length}</b></span><span>Total Aktif <b>${active}</b></span></div><h2>Grafik Statistik Periode</h2>${chartHtml}<h2>Ringkasan Bulanan</h2><table class="small"><thead><tr><th>No</th><th>Bulan</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>${monthRows}</tbody></table><h2>Data Siswa Masuk & Keluar</h2><table><thead><tr><th>No</th><th>Tanggal</th><th>Nama</th><th>Jenis</th><th>Instrumen</th><th>Guru</th><th>Keterangan</th></tr></thead><tbody>${movementRows || '<tr><td colspan="7">Tidak ada pergerakan siswa pada periode ini.</td></tr>'}</tbody></table>`;
      }

      const report = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;box-sizing:border-box}@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#17232d;margin:0;font-size:8.5px}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f15a24;padding-bottom:8px;margin-bottom:10px;min-height:66px}.brand-logo{width:118px;height:64px;object-fit:contain;object-position:left center}.brand h1{font-size:18px;margin:0 0 4px}.orange{color:#f15a24}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:9px}.meta div,.summary{background:#fff7f2;border:1px solid #fed9c6;border-radius:7px;padding:7px}.meta span{display:block;color:#7b8aa0;font-size:7px;text-transform:uppercase;margin-bottom:2px}.summary{display:flex;gap:24px;align-items:center;margin-bottom:10px}.summary b{color:#f15a24;font-size:15px;margin-left:4px}h2{font-size:11px;color:#f15a24;margin:12px 0 6px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:8px}table.small{width:55%}th{background:#f15a24;color:#fff;padding:6px 4px;text-align:left;font-size:7.5px}td{border:1px solid #dfe6ee;padding:5px 4px;vertical-align:top;line-height:1.3;word-wrap:break-word}tr{page-break-inside:avoid}.print-chart{border:1px solid #fed9c6;border-radius:8px;padding:9px 12px 7px;background:#fffaf7;page-break-inside:avoid}.print-chart-legend{display:flex;justify-content:flex-end;gap:16px;margin-bottom:4px;font-size:7px}.print-chart-legend span{display:flex;align-items:center;gap:4px}.print-chart-legend i{width:8px;height:8px;border-radius:2px}.print-chart-legend .in,.print-chart-bar.in{background:#f15a24}.print-chart-legend .out,.print-chart-bar.out{background:#ef4444}.print-chart-bars{height:148px;display:flex;align-items:flex-end;justify-content:space-around;gap:8px;border-bottom:1px solid #cbd5e1;padding:0 8px}.print-chart-month{height:142px;min-width:46px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.print-chart-values{height:116px;display:flex;align-items:flex-end;gap:4px}.print-chart-bar{width:15px;min-height:3px;border-radius:3px 3px 0 0;position:relative}.print-chart-bar b{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:7px;color:#475569}.print-chart-month>span{font-size:7px;font-weight:700;color:#64748b;margin-top:4px;white-space:nowrap}.footer{margin-top:9px;padding-top:6px;border-top:1px solid #e8edf2;color:#94a3b8;font-size:7px;text-align:right}</style></head><body><div class="brand"><div>${logoDataUrl ? `<img class="brand-logo" src="${logoDataUrl}" alt="Legacy Music Center">` : '<b class="orange">LEGACY MUSIC CENTER</b>'}</div><div style="text-align:right"><h1>${title}</h1><b class="orange">Administrasi Siswa</b></div></div><div class="meta"><div><span>Periode</span><b>${mode === 'all' ? 'Semua Data' : escapeTaskHtml(range.label)}</b></div><div><span>Filter</span><b>${escapeTaskHtml(getStudentReportFilterLabel())}</b></div><div><span>Tanggal Cetak</span><b>${new Date().toLocaleDateString('id-ID')}</b></div><div><span>Dicetak Oleh</span><b>${escapeTaskHtml(currentUser.userName || 'Admin')}</b></div></div>${content}<div class="footer">Dokumen resmi Legacy Music Center • Laporan Administrasi Siswa</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),650));<\/script></body></html>`;
      printWindow.document.open(); printWindow.document.write(report); printWindow.document.close();
    }

