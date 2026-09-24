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
      const search = String(document.getElementById('studentSearchInput')?.value || '').trim().toLowerCase();

      if (search) {
        result = result.filter(s => {
          const classText = getStudentClassesForUI(s).map(item => `${item.instrumen || ''} ${item.guru || ''} ${item.grade || ''}`).join(' ');
          const haystack = `${s.nama || ''} ${s.instrumen || ''} ${s.guru || ''} ${s.kelas || ''} ${s.email || ''} ${s.noHp || ''} ${s.status || ''} ${classText}`.toLowerCase();
          return haystack.includes(search);
        });
      }

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
            <button class="btn-action" style="background:#fff0e9;color:#c2410c;border:1px solid #fed7c3;" onclick="event.stopPropagation();openStudent360Report(decodeURIComponent('${encodeURIComponent(s.siswaID || s.nama)}'))">Laporan Lengkap</button>
            <button class="btn-action btn-delete" onclick="deleteSiswa(decodeURIComponent('${encodeURIComponent(s.nama)}'))">Hapus</button>
          </div>
          </td>
        </tr>`;
      });

    }


    function openStudent360Report(identifier) {
      if (!['siswa', 'guru', 'admin'].includes(currentUser.userType)) return;
      if (currentUser.userType !== 'siswa' && !identifier) return;

      const reportWindow = window.open('', '_blank', 'width=1180,height=820');

      if (!reportWindow) {
        showAlert(
          'alertDanger',
          'Popup diblokir. Izinkan popup untuk membuka laporan lengkap.'
        );
        return;
      }

      reportWindow.document.write(`
        <!doctype html>
        <html>
          <body style="
            font-family:Arial,sans-serif;
            padding:36px;
            color:#64748b;
            background:#f4f6f8;
          ">
            <div style="
              max-width:720px;
              margin:auto;
              background:#fff;
              padding:28px;
              border-radius:16px;
            ">
              <b style="color:#f15a24;">Legacy Music Center</b>
              <h2 style="color:#17232d;">
                Menyiapkan Laporan Perkembangan Siswa...
              </h2>
              <p>Data akademik, kehadiran, tugas, dan progress sedang dimuat.</p>
            </div>
          </body>
        </html>
      `);

      google.script.run
        .withSuccessHandler(response => {
          const data = typeof response === 'string' ? JSON.parse(response) : response;

          if (!data || data.success === false) {
            reportWindow.document.body.innerHTML = `
              <div style="font-family:Arial;padding:32px">
                <h2>Gagal memuat laporan</h2>
                <p>${escapeTaskHtml(data?.message || 'Data laporan tidak tersedia.')}</p>
              </div>
            `;
            return;
          }

          let reportRendered = false;

          const fallbackLogoDataUrl = 'https://lh3.googleusercontent.com/d/1Boahvm7lsJN7AYlMj2DSY5mDVEhgekBT';

          const renderReport = (logoDataUrl = '') => {
            if (reportRendered) return;
            reportRendered = true;
            buildStudent360ReportWindow(data, reportWindow, logoDataUrl || fallbackLogoDataUrl);
          };

          const logoTimeout = setTimeout(() => {
            renderReport(fallbackLogoDataUrl);
          }, 2000);

          google.script.run
            .withSuccessHandler(logo => {
              clearTimeout(logoTimeout);
              renderReport(logo && logo.success && logo.dataUrl ? logo.dataUrl : fallbackLogoDataUrl);
            })
            .withFailureHandler(() => {
              clearTimeout(logoTimeout);
              renderReport(fallbackLogoDataUrl);
            })
            .getLearningProgressPrintLogo();
        })
        .withFailureHandler(error => {
          reportWindow.document.body.innerHTML = `
            <div style="font-family:Arial;padding:32px">
              <h2>Gagal memuat laporan</h2>
              <p>${escapeTaskHtml(error?.message || error || 'Terjadi kesalahan.')}</p>
            </div>
          `;
        })
        .getStudent360Report(identifier);
    }

    function student360PeriodLabel(progress) {
      if (!progress) return 'Belum ada periode progress';
      if (typeof formatLearningProgressPeriod === 'function') return formatLearningProgressPeriod(progress.periode);
      return progress.periode || '-';
    }

    function student360ParseDate(value) {
      const raw = String(value || '').trim();
      let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      m = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return null;
    }

    
    function student360SignatureCandidates(value) {
      const raw = String(value || '').trim();
      if (!raw) return [];

      const candidates = [];
      const push = url => {
        const clean = String(url || '').trim();
        if (clean && !candidates.includes(clean)) candidates.push(clean);
      };

      // First try exactly the same URL that Progress Belajar stores/uses.
      push(raw);

      if (/^data:image\//i.test(raw) || /^blob:/i.test(raw)) return candidates;

      let match = raw.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
      if (!match) match = raw.match(/[?&]id=([^&#]+)/i);
      if (!match) match = raw.match(/googleusercontent\.com\/d\/([^/?#]+)/i);

      if (match && match[1]) {
        const id = match[1];
        push(`https://lh3.googleusercontent.com/d/${id}`);
        push(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`);
        push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`);
      }

      return candidates;
    }

    function student360SignatureImageHtml(url, name, role) {
      const candidates = student360SignatureCandidates(url);
      if (!candidates.length) return '';
      const src = escapeTaskHtml(candidates[0]);
      const fallbacks = escapeTaskHtml(JSON.stringify(candidates.slice(1)));
      return `<img src="${src}" data-fallbacks='${fallbacks}' data-fallback-index="0" alt="${escapeTaskHtml(role || name || 'Tanda tangan')}" onerror="student360SignatureFallback(this)">`;
    }

    function buildStudent360ReportWindow(data, reportWindow, logoDataUrl) {
      const student = data.student || {};
      const attendance = Array.isArray(data.attendance) ? data.attendance : [];
      const assignments = Array.isArray(data.assignments) ? data.assignments : [];
      const progressList = Array.isArray(data.progress) ? data.progress : [];
      const classes = Array.isArray(data.classes) ? data.classes : [];
      const latest = data.latestProgress || progressList[0] || null;
      const publication = data.publication || null;
      const isStudentViewer = currentUser.userType === 'siswa';
      const initialSignatureMode = publication?.signatureMode === 'manual' ? 'manual' : 'uploaded';

      const statusKey = value => String(value || '').trim().toLowerCase();
      const present = attendance.filter(x => ['masuk','hadir'].includes(statusKey(x.status))).length;
      const izin = attendance.filter(x => statusKey(x.status) === 'izin').length;
      const sakit = attendance.filter(x => statusKey(x.status) === 'sakit').length;
      const alpa = attendance.filter(x => ['alpa','alpha'].includes(statusKey(x.status))).length;
      const totalAttendance = attendance.length;
      const attendancePct = totalAttendance ? Math.round((present / totalAttendance) * 100) : 0;

      const completedTasks = assignments.filter(x => statusKey(x.status) === 'selesai').length;
      const now = new Date(); now.setHours(0,0,0,0);
      const lateTasks = assignments.filter(x => {
        if (statusKey(x.status) === 'selesai') return false;
        const deadline = student360ParseDate(x.deadline);
        return deadline && deadline < now;
      }).length;
      const pendingTasks = Math.max(0, assignments.length - completedTasks);

      const materials = [...new Set(attendance.map(x => String(x.materi || '').trim()).filter(Boolean))].slice(0,8);
      const songs = [...new Set(attendance.map(x => String(x.lagu || '').trim()).filter(Boolean))].slice(0,8);
      const overall = latest ? Math.max(0, Math.min(100, Number(latest.overallProgress) || 0)) : 0;
      const components = latest ? [
        ['Materi', latest.materiProgress],
        ['Teknik', latest.teknikProgress],
        ['Teori / Reading', latest.teoriProgress],
        ['Repertoire', latest.repertoireProgress],
        ['Practice', latest.practiceProgress],
        ['Performance', latest.performanceProgress],
        ['Evaluasi', latest.evaluasiProgress]
      ] : [];

      const trend = progressList.slice().sort((a,b) => String(a.periodeMulai || a.periode || '').localeCompare(String(b.periodeMulai || b.periode || ''))).slice(-6);
      const trendMax = Math.max(100, ...trend.map(x => Number(x.overallProgress) || 0));

      const esc = escapeTaskHtml;
      const emptyText = text => text ? esc(text) : '<span class="muted">Belum ada data</span>';
      const listHtml = (items, empty='Belum ada data') => items.length
        ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
        : `<div class="empty">${esc(empty)}</div>`;

      const classLabel = classes.length
        ? classes.map(c => `${esc(c.instrumen || '-')}${c.grade ? ` • ${esc(c.grade)}` : ''}${c.guru ? ` • ${esc(c.guru)}` : ''}`).join('<br>')
        : `${esc(student.instrumen || '-')} • ${esc(student.kelas || '-')}`;

      const studentAvatar = student.foto
        ? `<img class="student-photo" src="${esc(student.foto)}" alt="">`
        : `<div class="student-photo fallback">${esc(String(student.nama || 'S').charAt(0).toUpperCase())}</div>`;

      const componentHtml = components.length ? components.map(([label,val]) => {
        const score = Math.max(0, Math.min(100, Number(val) || 0));
        return `<div class="progress-row"><div class="progress-top"><b>${esc(label)}</b><span>${score}%</span></div><div class="bar"><i style="width:${score}%"></i></div></div>`;
      }).join('') : '<div class="empty">Progress belajar belum tersedia.</div>';

      const trendHtml = trend.length ? `<div class="trend-chart">${trend.map(item => {
        const value = Math.max(0, Math.min(100, Number(item.overallProgress) || 0));
        const height = Math.max(8, (value / trendMax) * 110);
        return `<div class="trend-col"><span>${value}%</span><i style="height:${height}px"></i><b>${esc(String(item.periode || '').replace(/^\d{4}-/,''))}</b></div>`;
      }).join('')}</div>` : '<div class="empty">Belum ada riwayat progress.</div>';

      const sig = (url,name,role) => {
        const imageHtml = student360SignatureImageHtml(url, name, role);
        return `<div class="signature"><span>${esc(role)}</span><div class="signature-img">${imageHtml}</div><b>${esc(name || '-')}</b></div>`;
      };

      const reportLogoUrl = logoDataUrl || 'https://lh3.googleusercontent.com/d/1Boahvm7lsJN7AYlMj2DSY5mDVEhgekBT';
      const logo = `<img class="logo" src="${esc(reportLogoUrl)}" alt="Legacy Music Center">`;

      const page1 = `
        <section class="page">
          <header>${logo}<div class="header-copy"><b>Laporan Perkembangan Siswa</b><span>Perjalanan belajar, progress, dan konsistensi siswa.</span></div></header>
          <div class="student-card">${studentAvatar}<div class="student-main"><div class="student-name">${esc(student.nama || '-')} <em>${esc(student.status || 'Aktif')}</em></div><div class="student-grid"><div><span>Instrumen / Kelas</span><b>${classLabel}</b></div><div><span>Periode Laporan</span><b>${esc(student360PeriodLabel(latest))}</b></div><div><span>Tanggal Masuk</span><b>${esc(formatAcademyDate(student.tglDaftar || '-'))}</b></div><div><span>ID Siswa</span><b>${esc(student.siswaID || '-')}</b></div></div></div></div>
          <h2>Ringkasan Utama</h2>
          <div class="metric-grid">
            <div class="metric orange"><span>Kehadiran</span><b>${attendancePct}%</b><small>${present} hadir dari ${totalAttendance} catatan</small></div>
            <div class="metric peach"><span>Progress Keseluruhan</span><b>${overall}%</b><small>${latest ? esc(latest.level || 'Progress terbaru') : 'Belum dinilai'}</small></div>
            <div class="metric green"><span>Tugas Selesai</span><b>${completedTasks}/${assignments.length}</b><small>${pendingTasks} belum selesai</small></div>
            <div class="metric blue"><span>Pertemuan</span><b>${totalAttendance}</b><small>Riwayat absensi tercatat</small></div>
          </div>
          <div class="two-col">
            <div class="panel"><h2>Perkembangan Belajar</h2>${componentHtml}</div>
            <div class="panel"><h2>Materi yang Sudah Dipelajari</h2>${listHtml(materials,'Belum ada materi tercatat.')}</div>
          </div>
          <div class="two-col lower">
            <div class="panel"><h2>Repertoire / Lagu</h2>${listHtml(songs,'Belum ada repertoire tercatat.')}</div>
            <div class="panel"><h2>Catatan Perkembangan</h2><div class="note-block"><b>Kelebihan</b><p>${emptyText(latest?.kelebihan || '')}</p><b>Perlu Ditingkatkan</b><p>${emptyText(latest?.perluDitingkatkan || '')}</p></div></div>
          </div>
          <footer>Legacy Music Center • Laporan Perkembangan Siswa</footer>
        </section>`;

      const page2 = `
        <section class="page">
          <header>${logo}<div class="header-copy"><b>Ringkasan Akademik & Kehadiran</b><span>${esc(student.nama || '-')} • ${esc(student360PeriodLabel(latest))}</span></div></header>
          <div class="two-col top-summary">
            <div class="panel attendance-panel"><h2>Statistik Kehadiran</h2><div class="attendance-wrap"><div class="donut" style="--pct:${attendancePct * 3.6}deg"><div><b>${attendancePct}%</b><span>Tingkat Kehadiran</span></div></div><div class="legend"><span><i class="g"></i>Hadir <b>${present}</b></span><span><i class="o"></i>Izin <b>${izin}</b></span><span><i class="s"></i>Sakit <b>${sakit}</b></span><span><i class="r"></i>Alpa <b>${alpa}</b></span></div></div></div>
            <div class="panel"><h2>Ringkasan Tugas</h2><div class="task-grid"><div><span>Total Tugas</span><b>${assignments.length}</b></div><div><span>Selesai</span><b>${completedTasks}</b></div><div><span>Belum Selesai</span><b>${pendingTasks}</b></div><div><span>Terlambat</span><b>${lateTasks}</b></div></div></div>
          </div>
          <div class="panel trend-panel"><h2>Riwayat Progress</h2>${trendHtml}</div>
          <div class="two-col lower">
            <div class="panel target"><h2>Target Periode Berikutnya</h2><div class="target-copy">${emptyText(latest?.targetBerikutnya || '')}</div></div>
            <div class="panel"><h2>Ringkasan Guru</h2><div class="note-block"><b>Guru Pengajar</b><p>${esc(latest?.guru || student.guru || '-')}</p><b>Terakhir Diperbarui</b><p>${esc(latest?.lastUpdated || '-')}</p></div></div>
          </div>
          <div class="signatures">
            ${sig(latest?.guruSignatureUrl, latest?.guruSignatureName || latest?.guru || student.guru, 'Guru / Coach')}
            ${sig(latest?.kepalaSekolahSignatureUrl, latest?.kepalaSekolahNama || latest?.kepalaSekolahSignatureName, 'Kepala Sekolah')}
          </div>
          <footer>Dokumen resmi Legacy Music Center • Dicetak ${new Date().toLocaleDateString('id-ID')}</footer>
        </section>`;

      const report = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laporan Lengkap ${esc(student.nama || '')}</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        :root{--orange:#f15a24;--peach:#fff3ec;--ink:#17232d;--muted:#718096;--line:#e6ebf1}
        body{margin:0;background:#e9edf2;color:var(--ink);font-family:Arial,Helvetica,sans-serif}
        .toolbar{position:sticky;top:0;z-index:20;display:flex;justify-content:center;gap:10px;padding:12px;background:rgba(23,35,45,.92);backdrop-filter:blur(8px)}
        .toolbar button{border:0;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer}.toolbar button:disabled{opacity:.65;cursor:wait}.toolbar .print{background:var(--orange);color:#fff}.toolbar .close{background:#fff;color:#334155}.toolbar .mode{background:#475569;color:#fff}.toolbar .mode.active{background:#fff;color:#17232d;box-shadow:0 0 0 2px #ff8a3d inset}.toolbar .send{background:#16a34a;color:#fff}.toolbar-status{align-self:center;color:#e2e8f0;font-size:11px;min-width:120px}
        .report-shell{display:flex;gap:24px;align-items:flex-start;justify-content:center;padding:24px;overflow:auto}
        .page{width:210mm;min-width:210mm;height:297mm;background:#fff;padding:12mm;box-shadow:0 10px 35px rgba(15,23,42,.12);position:relative;overflow:hidden}
        header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid var(--orange);padding-bottom:7mm;margin-bottom:6mm}
        .logo{width:42mm;height:19mm;object-fit:contain;object-position:left center}.logo-text strong{display:block;font-size:20px;letter-spacing:2px}.logo-text span{font-size:10px;color:#64748b}
        .header-copy{text-align:right}.header-copy b{display:block;font-size:20px}.header-copy span{display:block;color:var(--muted);font-size:9px;margin-top:4px}
        .student-card{display:grid;grid-template-columns:25mm 1fr;gap:6mm;align-items:center;border:1px solid var(--line);border-radius:13px;padding:5mm;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.04)}
        .student-photo{width:23mm;height:23mm;border-radius:50%;object-fit:cover;background:#ffe6d8}.student-photo.fallback{display:grid;place-items:center;color:var(--orange);font-size:28px;font-weight:900}
        .student-name{font-size:18px;font-weight:900;margin-bottom:4mm}.student-name em{font-style:normal;font-size:9px;background:#ffe9dc;color:#d94d18;padding:5px 9px;border-radius:999px;margin-left:6px;vertical-align:middle}
        .student-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:4mm 8mm}.student-grid span{display:block;font-size:7.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:2px}.student-grid b{font-size:9px;line-height:1.35}
        h2{font-size:11px;margin:6mm 0 3mm;padding-left:3mm;border-left:3px solid var(--orange)}
        .metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.metric{border-radius:11px;padding:4mm;min-height:28mm}.metric span{display:block;font-size:8px;color:#53657a}.metric b{display:block;font-size:20px;margin:2mm 0 1mm}.metric small{font-size:7px;color:#718096}.orange{background:#fff0e8}.peach{background:#fff6e8}.green{background:#eefaf1}.blue{background:#edf6ff}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.panel{border:1px solid var(--line);border-radius:11px;padding:4mm;background:#fff;min-width:0}.panel h2{margin-top:0}
        .progress-row{margin-bottom:3mm}.progress-top{display:flex;justify-content:space-between;font-size:8px}.progress-top span{color:#64748b}.bar{height:5px;background:#eef1f4;border-radius:999px;margin-top:1.5mm;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#f15a24,#ff8a3d);border-radius:inherit}
        ul{margin:0;padding-left:18px}li{font-size:8.5px;line-height:1.7}.empty,.muted{color:#94a3b8;font-size:8px}
        .lower{margin-top:4mm}.note-block b{display:block;font-size:8px;color:var(--orange);margin-top:2mm}.note-block p{font-size:8px;line-height:1.45;margin:1mm 0 2mm;white-space:pre-line}
        .top-summary{margin-top:1mm}.attendance-wrap{display:flex;align-items:center;justify-content:center;gap:8mm}.donut{width:37mm;height:37mm;border-radius:50%;background:conic-gradient(#55ad62 var(--pct),#f1f5f9 0);display:grid;place-items:center;position:relative}.donut:after{content:'';position:absolute;inset:6mm;background:#fff;border-radius:50%}.donut div{position:relative;z-index:2;text-align:center}.donut b{display:block;font-size:18px}.donut span{font-size:6.5px;color:#718096}.legend{display:grid;gap:2mm}.legend span{font-size:8px;display:grid;grid-template-columns:8px 1fr 20px;gap:4px;align-items:center}.legend span b{text-align:right}.legend i{width:7px;height:7px;border-radius:50%}.legend .g{background:#55ad62}.legend .o{background:#ff8a3d}.legend .s{background:#94a3b8}.legend .r{background:#ef4444}
        .task-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.task-grid div{background:#f8fafc;border-radius:9px;padding:4mm}.task-grid span{display:block;font-size:7.5px;color:#718096}.task-grid b{font-size:18px}
        .trend-panel{margin-top:4mm}.trend-chart{height:40mm;display:flex;align-items:flex-end;justify-content:space-around;border-bottom:1px solid #cbd5e1;padding:3mm 5mm 0}.trend-col{height:34mm;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:18mm}.trend-col span{font-size:7px;font-weight:800;margin-bottom:2px}.trend-col i{display:block;width:10mm;background:linear-gradient(#ff9b69,#f15a24);border-radius:4px 4px 0 0}.trend-col b{font-size:6.5px;margin-top:2px;color:#64748b;max-width:18mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .target-copy{font-size:9px;line-height:1.55;white-space:pre-line;background:#fff7f2;border-radius:9px;padding:4mm;color:#475569}
        .signatures{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:5mm;text-align:center;page-break-inside:avoid;break-inside:avoid}.signature span{font-size:7.5px;color:#64748b}.signature-img{height:18mm;display:flex;align-items:flex-end;justify-content:center;padding-bottom:1mm}.signature-img img{display:block;max-width:36mm;max-height:15mm;width:auto;height:auto;object-fit:contain;filter:contrast(1.08);mix-blend-mode:multiply}.signature b{display:block;border-top:1px solid #94a3b8;padding-top:1.5mm;font-size:8.5px;min-height:6mm}body[data-signature-mode="manual"] .signature-img img{display:none!important}
        footer{position:absolute;left:12mm;right:12mm;bottom:8mm;border-top:1px solid #e8edf2;padding-top:2mm;font-size:6.5px;color:#94a3b8;text-align:right}
        @media screen and (max-width:900px){
          html,body{
            width:100%!important;
            max-width:100%!important;
            margin:0!important;
            padding:0!important;
            overflow-x:hidden!important;
            background:#edf1f5!important;
          }
          .toolbar{
            position:sticky!important;
            top:0!important;
            z-index:50!important;
            display:flex!important;
            justify-content:flex-start!important;
            align-items:center!important;
            gap:7px!important;
            width:100%!important;
            max-width:100vw!important;
            padding:8px!important;
            overflow-x:auto!important;
            overflow-y:hidden!important;
            -webkit-overflow-scrolling:touch;
            white-space:nowrap!important;
            background:rgba(23,35,45,.96)!important;
          }
          .toolbar button{
            display:inline-flex!important;
            flex:0 0 auto!important;
            align-items:center!important;
            justify-content:center!important;
            min-height:40px!important;
            padding:9px 11px!important;
            font-size:12px!important;
            line-height:1.15!important;
            border-radius:10px!important;
          }
          .toolbar-status{display:none!important}
          .report-shell{
            display:block!important;
            width:100%!important;
            max-width:100vw!important;
            padding:6px!important;
            margin:0!important;
            overflow:hidden!important;
          }
          .page{
            display:block!important;
            width:100%!important;
            min-width:0!important;
            max-width:100%!important;
            height:auto!important;
            min-height:0!important;
            max-height:none!important;
            margin:0 0 10px!important;
            padding:14px!important;
            border-radius:12px!important;
            overflow:hidden!important;
            box-shadow:0 4px 18px rgba(15,23,42,.08)!important;
          }
          header{
            display:grid!important;
            grid-template-columns:105px minmax(0,1fr)!important;
            gap:12px!important;
            align-items:center!important;
            width:100%!important;
            padding-bottom:14px!important;
            margin-bottom:14px!important;
          }
          header .logo{
            width:100px!important;
            height:62px!important;
            object-fit:contain!important;
            object-position:left center!important;
          }
          .header-copy{
            display:block!important;
            min-width:0!important;
            width:100%!important;
            text-align:left!important;
          }
          .header-copy b{
            display:block!important;
            font-size:23px!important;
            line-height:1.08!important;
            white-space:normal!important;
            overflow-wrap:anywhere!important;
          }
          .header-copy span{
            display:block!important;
            font-size:10px!important;
            line-height:1.35!important;
            margin-top:5px!important;
            white-space:normal!important;
          }
          .student-card{
            grid-template-columns:76px minmax(0,1fr)!important;
            gap:12px!important;
            padding:14px!important;
            width:100%!important;
          }
          .student-photo{width:72px!important;height:72px!important}
          .student-name{font-size:21px!important;margin-bottom:10px!important}
          .student-grid{
            grid-template-columns:1fr!important;
            gap:9px!important;
            min-width:0!important;
          }
          .student-grid b{
            display:block!important;
            font-size:12px!important;
            white-space:normal!important;
            overflow-wrap:anywhere!important;
          }
          h2{font-size:16px!important;margin:18px 0 10px!important}
          .metric-grid{
            grid-template-columns:1fr 1fr!important;
            gap:8px!important;
            width:100%!important;
          }
          .metric{min-width:0!important;min-height:100px!important;padding:14px!important}
          .metric span{font-size:11px!important}
          .metric b{font-size:27px!important}
          .metric small{font-size:10px!important}
          .two-col{
            grid-template-columns:1fr!important;
            gap:10px!important;
            width:100%!important;
          }
          .panel{width:100%!important;min-width:0!important;padding:13px!important}
          .progress-row{width:100%!important}
          .progress-top{font-size:11px!important;gap:8px!important}
          ul{padding-left:19px!important}
          li{font-size:11px!important;line-height:1.55!important}
          .task-grid{grid-template-columns:1fr 1fr!important;gap:8px!important}
          .task-grid span{font-size:10px!important}
          .task-grid b{font-size:20px!important}
          .trend-chart{
            height:150px!important;
            padding:10px 6px 0!important;
            overflow-x:auto!important;
            justify-content:flex-start!important;
            gap:12px!important;
          }
          .trend-col{
            height:132px!important;
            min-width:48px!important;
            flex:0 0 48px!important;
          }
          .target-copy{font-size:11px!important;padding:12px!important}
          .signatures{
            grid-template-columns:1fr 1fr!important;
            gap:10px!important;
            margin-top:14px!important;
          }
          .signature-img{height:62px!important}
          .signature-img img{max-height:56px!important;max-width:116px!important}
          .signature b{font-size:10px!important}
          footer{
            position:static!important;
            margin-top:14px!important;
            font-size:8px!important;
          }
        }
        @media screen and (max-width:520px){
          .page{padding:10px!important}
          header{grid-template-columns:88px minmax(0,1fr)!important;gap:9px!important}
          header .logo{width:84px!important;height:54px!important}
          .header-copy b{font-size:19px!important}
          .header-copy span{font-size:9px!important}
          .student-card{grid-template-columns:62px minmax(0,1fr)!important;padding:11px!important}
          .student-photo{width:58px!important;height:58px!important}
          .student-name{font-size:19px!important}
          .metric-grid{grid-template-columns:1fr!important}
          .metric{min-height:88px!important}
          .task-grid{grid-template-columns:1fr 1fr!important}
          .signatures{grid-template-columns:1fr!important}
        }
        @media print{
          @page{size:A4 portrait;margin:8mm}
          html,body{
            width:auto!important;
            height:auto!important;
            margin:0!important;
            padding:0!important;
            background:#fff!important;
            overflow:visible!important;
          }
          .toolbar{display:none!important}
          .report-shell{
            display:block!important;
            padding:0!important;
            margin:0!important;
            overflow:visible!important;
          }
          .page{
            width:194mm!important;
            min-width:194mm!important;
            max-width:194mm!important;
            height:281mm!important;
            min-height:281mm!important;
            max-height:281mm!important;
            padding:6mm 7mm 5mm!important;
            margin:0!important;
            box-shadow:none!important;
            border-radius:0!important;
            overflow:hidden!important;
            page-break-after:always!important;
            break-after:page!important;
          }
          .page:last-child{
            page-break-after:auto!important;
            break-after:auto!important;
          }
          header{
            padding-bottom:3mm!important;
            margin-bottom:2.5mm!important;
          }
          header .logo{width:29mm!important;height:17mm!important}
          .header-copy b{font-size:16px!important}
          .header-copy span{font-size:7px!important}
          .student-card{padding:3mm!important}
          .student-photo{width:20mm!important;height:20mm!important}
          .student-name{font-size:15px!important;margin-bottom:2mm!important}
          h2{margin:2.5mm 0 1.8mm!important;font-size:10px!important}
          .metric-grid{gap:2mm!important}
          .metric{min-height:20mm!important;padding:2.5mm!important}
          .metric b{font-size:17px!important}
          .panel{padding:3mm!important}
          .lower{margin-top:2mm!important}
          .note-block{font-size:8px!important}
          .task-grid{gap:2mm!important}
          .trend-panel{margin-top:2mm!important}
          .trend-chart{height:27mm!important;padding-top:2mm!important}
          .trend-col{height:23mm!important}
          .target-copy{padding:2.5mm!important;font-size:8px!important}
          .signatures{
            margin-top:2mm!important;
            gap:10mm!important;
            break-inside:avoid!important;
            page-break-inside:avoid!important;
          }
          .signature-img{height:11mm!important}
          .signature-img img{max-height:9.5mm!important;max-width:28mm!important}
          .signature b{font-size:7.5px!important;padding-top:.8mm!important}
          footer{
            position:absolute!important;
            left:7mm!important;
            right:7mm!important;
            bottom:2.5mm!important;
          }
        }
      </style></head><body data-signature-mode="${initialSignatureMode}">
      <div class="toolbar">
        <button class="print" onclick="window.print()">🖨 Cetak / Simpan PDF</button>
        ${isStudentViewer ? '' : `<button id="sigUploadedBtn" class="mode" onclick="setSignatureMode('uploaded')">✍️ TTD Digital</button><button id="sigManualBtn" class="mode" onclick="setSignatureMode('manual')">🖊 TTD Manual</button><button id="publishReportBtn" class="send" onclick="publishReport()">📨 Kirim ke Siswa</button>`}
        <span id="reportStatus" class="toolbar-status">${isStudentViewer && publication ? `Dikirim ${esc(publication.sentAt || '')}` : ''}</span>
        <button class="close" onclick="window.close()">Tutup</button>
      </div>
      <main class="report-shell">${page1}${page2}</main>
      <script>
        function student360SignatureFallback(img){
          try{
            var list=JSON.parse(img.getAttribute('data-fallbacks')||'[]');
            var index=Number(img.getAttribute('data-fallback-index')||0);
            if(index<list.length){
              img.setAttribute('data-fallback-index',String(index+1));
              img.src=list[index];
              return;
            }
          }catch(e){}
          img.style.visibility='hidden';
        }
        function applySignatureModeButtons(){
          var mode=document.body.dataset.signatureMode||'uploaded';
          var up=document.getElementById('sigUploadedBtn'), man=document.getElementById('sigManualBtn');
          if(up) up.classList.toggle('active',mode==='uploaded');
          if(man) man.classList.toggle('active',mode==='manual');
        }
        function setSignatureMode(mode){
          document.body.dataset.signatureMode=mode==='manual'?'manual':'uploaded';
          applySignatureModeButtons();
        }
        function publishReport(){
          var btn=document.getElementById('publishReportBtn');
          var status=document.getElementById('reportStatus');
          if(!window.opener || !window.opener.google || !window.opener.google.script) {
            if(status) status.textContent='Tidak dapat menghubungi aplikasi.';
            return;
          }
          if(btn){btn.disabled=true;btn.textContent='Mengirim...';}
          var mode=document.body.dataset.signatureMode||'uploaded';
          window.opener.google.script.run.withSuccessHandler(function(res){
            if(btn){btn.disabled=false;btn.textContent=res&&res.success?'✓ Terkirim':'📨 Kirim ke Siswa';}
            if(status) status.textContent=res&&res.success?(res.message||'Laporan berhasil dikirim ke akun siswa.'):(res&&res.message||'Gagal mengirim laporan.');
          }).withFailureHandler(function(err){
            if(btn){btn.disabled=false;btn.textContent='📨 Kirim ke Siswa';}
            if(status) status.textContent='Gagal mengirim: '+(err&&err.message?err.message:err);
          }).publishStudent360Report('${esc(student.siswaID || '')}', '${esc(latest?.progressID || '')}', mode);
        }
        applySignatureModeButtons();
      <\/script>
      </body></html>`;

      reportWindow.document.open();
      reportWindow.document.write(report);
      reportWindow.document.close();
    }


    function student360ReportPeriodText(report) {
      const raw = String(report?.period || '').trim();
      if (!raw) return 'Periode belum tersedia';
      if (typeof formatLearningProgressPeriod === 'function') {
        try { return formatLearningProgressPeriod(raw); } catch (_) {}
      }
      return raw;
    }

    function student360ReportCardHtml(report, compact = false, showStudent = false) {
      const reportId = encodeURIComponent(String(report.reportID || ''));
      const period = escapeTaskHtml(student360ReportPeriodText(report));
      const teacher = escapeTaskHtml(report.teacher || report.sentBy || '-');
      const studentName = escapeTaskHtml(report.studentName || report.student || '');
      const instrument = escapeTaskHtml(report.instrument || '');
      const grade = escapeTaskHtml(report.grade || '');
      const sentAt = escapeTaskHtml(report.sentAt || '');
      const periodType = escapeTaskHtml(report.periodType || '');

      return `
        <div class="student360-report-card" data-report-search="${escapeTaskHtml(`${studentName} ${period} ${periodType} ${teacher} ${instrument} ${grade}`.toLowerCase())}"
             data-period-type="${escapeTaskHtml(String(report.periodType || '').toLowerCase())}"
             data-period="${escapeTaskHtml(String(report.period || '').toLowerCase())}"
             data-instrument="${escapeTaskHtml(String(report.instrument || '').toLowerCase())}"
             style="border:1px solid #f1d8ca;border-radius:14px;background:linear-gradient(135deg,#fffaf7,#fff);padding:${compact ? '14px' : '16px'};">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div style="min-width:0;">
              ${showStudent && studentName ? `<div style="font-size:15px;font-weight:850;color:#17232d;">${studentName}</div>` : ''}
              <div style="font-size:10px;font-weight:800;color:#f15a24;text-transform:uppercase;letter-spacing:.04em;margin-top:${showStudent ? '3px' : '0'};">Laporan Perkembangan ${periodType ? `• ${periodType}` : ''}</div>
              <div style="font-size:${compact ? '16px' : '18px'};font-weight:850;color:#17232d;margin-top:4px;">${period}</div>
              <div style="font-size:11px;color:#64748b;margin-top:5px;">Guru: <b style="color:#334155;">${teacher}</b></div>
              ${instrument ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">Instrumen: <b style="color:#334155;">${instrument}${grade ? ` • ${grade}` : ''}</b></div>` : ''}
              <div style="font-size:10px;color:#94a3b8;margin-top:5px;">${sentAt ? `Dikirim ${sentAt}` : ''}</div>
            </div>
            <span style="display:inline-flex;align-items:center;padding:6px 9px;border-radius:999px;background:#eaf8ee;color:#16803a;font-size:10px;font-weight:800;">Terkirim</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
            <button type="button" onclick="openStudent360Report(decodeURIComponent('${reportId}'))"
              style="border:0;border-radius:9px;background:#f15a24;color:#fff;padding:9px 13px;font-weight:800;cursor:pointer;">
              Buka Laporan Lengkap
            </button>
            ${currentUser.userType === 'guru' || currentUser.userType === 'admin' ? `
              <button type="button" onclick="deleteStudent360PublishedReport(decodeURIComponent('${reportId}'))"
                style="border:1px solid #fecaca;border-radius:9px;background:#fff;color:#dc2626;padding:9px 13px;font-weight:800;cursor:pointer;">
                Hapus
              </button>` : ''}
          </div>
        </div>`;
    }

    function populateStudent360TeacherFilters(reports) {
      const periodSelect = document.getElementById('student360FilterPeriod');
      const instrumentSelect = document.getElementById('student360FilterInstrument');
      if (!periodSelect || !instrumentSelect) return;

      const periods = [...new Set(reports.map(r => String(r.period || '').trim()).filter(Boolean))];
      periods.sort((a,b) => b.localeCompare(a));
      periodSelect.innerHTML = `<option value="">Semua Periode</option>` + periods.map(p =>
        `<option value="${escapeTaskHtml(p.toLowerCase())}">${escapeTaskHtml(student360ReportPeriodText({period:p}))}</option>`
      ).join('');

      const instruments = [...new Set(reports.map(r => String(r.instrument || '').trim()).filter(Boolean))]
        .sort((a,b) => a.localeCompare(b, 'id'));
      instrumentSelect.innerHTML = `<option value="">Semua Instrumen</option>` + instruments.map(item =>
        `<option value="${escapeTaskHtml(item.toLowerCase())}">${escapeTaskHtml(item)}</option>`
      ).join('');
    }

    function deleteStudent360PublishedReport(reportId) {
      if (!reportId || !['guru','admin'].includes(currentUser.userType)) return;
      if (!confirm('Hapus laporan ini dari daftar laporan dan akun siswa?')) return;

      google.script.run
        .withSuccessHandler(response => {
          if (response && response.success) {
            showAlert('alertSuccess', response.message || 'Laporan berhasil dihapus.');
            fetchDashboardData();
          } else {
            showAlert('alertDanger', response?.message || 'Laporan gagal dihapus.');
          }
        })
        .withFailureHandler(error => {
          showAlert('alertDanger', 'Gagal menghapus laporan: ' + (error?.message || error));
        })
        .deleteStudent360Report(reportId);
    }

    function applyStudent360TeacherFilters() {
      const search = String(document.getElementById('student360FilterSearch')?.value || '').trim().toLowerCase();
      const type = String(document.getElementById('student360FilterType')?.value || '').trim().toLowerCase();
      const period = String(document.getElementById('student360FilterPeriod')?.value || '').trim().toLowerCase();
      const instrument = String(document.getElementById('student360FilterInstrument')?.value || '').trim().toLowerCase();

      let visible = 0;
      document.querySelectorAll('#student360ReportHistory .student360-report-card').forEach(card => {
        const ok =
          (!search || String(card.dataset.reportSearch || '').includes(search)) &&
          (!type || String(card.dataset.periodType || '') === type) &&
          (!period || String(card.dataset.period || '') === period) &&
          (!instrument || String(card.dataset.instrument || '').includes(instrument));
        card.style.display = ok ? 'block' : 'none';
        if (ok) visible += 1;
      });

      const result = document.getElementById('student360FilterResult');
      if (result) result.textContent = `${visible} laporan ditampilkan`;
    }

    function renderStudent360Access(data) {
      const reports = currentUser.userType === 'guru'
        ? (Array.isArray(data?.teacherReports) ? data.teacherReports : [])
        : (Array.isArray(data?.studentReports) ? data.studentReports : []);

      const latestBox = document.getElementById('student360LatestCard');
      const historyBox = document.getElementById('student360ReportHistory');
      const countEl = document.getElementById('student360ReportCount');
      const filters = document.getElementById('student360TeacherFilters');

      if (countEl) countEl.textContent = String(reports.length);

      if (currentUser.userType === 'siswa' && latestBox) {
        latestBox.style.display = 'block';
        latestBox.innerHTML = reports.length
          ? `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
              <div>
                <div style="font-size:14px;font-weight:850;color:#17232d;">📄 Laporan Perkembangan Terbaru</div>
                <div style="font-size:10px;color:#718096;margin-top:2px;">Laporan resmi terbaru yang dikirim guru.</div>
              </div>
              <button type="button" onclick="switchTab('section-laporan')" style="border:0;background:transparent;color:#f15a24;font-weight:800;cursor:pointer;">Lihat Semua →</button>
            </div>
            ${student360ReportCardHtml(reports[0], true, false)}`
          : `
            <div style="font-size:14px;font-weight:850;color:#17232d;">📄 Laporan Perkembangan Terbaru</div>
            <div style="font-size:11px;color:#718096;margin-top:7px;">Belum ada laporan lengkap yang dikirim oleh guru.</div>`;
      }

      if (!historyBox) return;

      if (currentUser.userType === 'guru') {
        if (filters) filters.style.display = 'grid';
        populateStudent360TeacherFilters(reports);
        historyBox.innerHTML = reports.length
          ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:12px;">${reports.map(report => student360ReportCardHtml(report, false, true)).join('')}</div>`
          : `<div style="padding:30px 18px;text-align:center;color:#8a98a9;border:1px dashed #d7e0e9;border-radius:13px;background:#fbfcfd;">Belum ada Laporan Lengkap yang dikirim ke siswa.</div>`;
        applyStudent360TeacherFilters();
        return;
      }

      if (filters) filters.style.display = 'none';
      historyBox.innerHTML = reports.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px;">${reports.map(report => student360ReportCardHtml(report, false, false)).join('')}</div>`
        : `<div style="padding:30px 18px;text-align:center;color:#8a98a9;border:1px dashed #d7e0e9;border-radius:13px;background:#fbfcfd;">Belum ada laporan perkembangan yang dikirim.</div>`;
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

