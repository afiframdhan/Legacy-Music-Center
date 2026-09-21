    function fetchDashboardData() {
      const requestNumber = ++dashboardRequestNumber;
      google.script.run.withSuccessHandler(function(rawData) {
        if (requestNumber !== dashboardRequestNumber) return;
        let data = rawData;
        if (typeof rawData === 'string') {
          try { data = JSON.parse(rawData); }
          catch (error) { showAlert('alertDanger', 'Data dashboard tidak valid. Silakan refresh sekali lagi.'); return; }
        }
        if (!data || data.error || data.success === false) {
          showAlert('alertDanger', data && (data.error || data.message) ? (data.error || data.message) : 'Data dashboard kosong. Silakan coba lagi.');
          return;
        }

        const identityInfo = data.userType === 'siswa' ? data.siswaInfo : (data.userType === 'guru' ? data.guruInfo : data.adminInfo);
        if (identityInfo) {
          currentUser.userID = identityInfo.userID || currentUser.userID;
          currentUser.userName = identityInfo.nama || currentUser.userName;
          saveLoginSession(currentUser);
        }

        globalAbsensiList = data.absensiList || [];
        globalJadwalList = data.jadwal || data.schedules || [];
        globalTugasList = data.tugasList || [];
        globalJadwalPenggantiList = data.jadwalPenggantiList || [];
        globalPengumumanList = data.pengumumanList || [];
        globalLearningProgressList = data.learningProgressList || [];
        globalStudentHistory = data.studentHistory || [];
        globalTeacherAttendanceList = data.teacherAttendanceList || [];

        google.script.run.withSuccessHandler(gList => {
          globalGuruList = gList || [];
          if (data.userType === 'siswa') renderSiswa(data);
          if (data.userType === 'guru' || data.userType === 'admin') renderGuruOrAdmin(data);
          renderLearningProgressViews();

          setupFilterDropdown();
          renderTabelJadwal();
          renderTabelRiwayat();
          renderTabelTugas();
          renderTabelJadwalPengganti();
          renderPengumumanList();
          renderDashboardAcademyUpdates();
          setupMakeupFilters();
          setupRoomFilters();
          renderRoomAvailability();
          renderNotificationCenter();
          if (notificationTimer) clearInterval(notificationTimer);
          notificationTimer = setInterval(renderNotificationCenter, 60000);
        }).withFailureHandler(error => {
          if (requestNumber === dashboardRequestNumber) showAlert('alertDanger', 'Daftar guru gagal dimuat: ' + (error.message || error));
        }).getGuruList();

      }).withFailureHandler(error => {
        if (requestNumber !== dashboardRequestNumber) return;
        showAlert('alertDanger', 'Data dashboard gagal dimuat: ' + (error.message || error));
      }).getDashboardData(currentUser.userID, currentUser.userType);
    }

    function timeToMinutes(timeStr) {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      if (parts.length < 2) return 0;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    function calculateDurationMinutes(startStr, endStr) {
      const startMin = timeToMinutes(startStr);
      const endMin = timeToMinutes(endStr);
      const diff = endMin - startMin;
      return diff > 0 ? `${diff} menit` : '60 menit';
    }

    function getInstrumenIcon(instrumen) {
      const lower = (instrumen || 'Gitar').toLowerCase();
      if (lower.includes('piano')) return '🎹';
      if (lower.includes('drum')) return '🥁';
      if (lower.includes('vokal') || lower.includes('vokal')) return '🎤';
      if (lower.includes('biola') || lower.includes('violin')) return '🎻';
      return '🎸';
    }

    function getFormattedDateString(hariStr) {
      const today = new Date();
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const hari = hariStr || "Rabu";
      return `${hari}, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    }

    function renderSiswa(data) {
      document.getElementById('formJadwalPenggantiBox').style.display = 'none';
      document.getElementById('formPengumumanBox').style.display = 'none';
      if(data.siswaInfo) {
        document.getElementById('dashSiswaNama').textContent = data.siswaInfo.nama;
        document.getElementById('selfProfileNama').value = data.siswaInfo.nama;
        document.getElementById('selfProfileEmail').value = data.siswaInfo.email;
        document.getElementById('selfProfileHP').value = data.siswaInfo.noHp || '';
        document.getElementById('myProfileDisplayName').textContent = data.siswaInfo.nama;
        document.getElementById('siswaLevelAktif').textContent = data.siswaInfo.kelas || 'Beginner';
        document.getElementById('siswaInstrumenSub').textContent = data.siswaInfo.instrumen || 'Gitar';
        updateAvatarUI(data.siswaInfo.foto);
      }
      
      if(data.absensiProgress) {
        document.getElementById('siswaKehadiranBulan').textContent = data.absensiProgress.hadir + ' / ' + data.absensiProgress.total;
      }

      const container = document.getElementById('siswaNextScheduleContainer');
      container.innerHTML = '';

      if (data.schedules && data.schedules.length > 0) {
        data.schedules.forEach(nextJadwal => {
        const instrumenNama = nextJadwal.instrumen || (data.siswaInfo ? data.siswaInfo.instrumen : 'Gitar');
        const siswaNama = currentUser.userName;
        const iconInstrumen = getInstrumenIcon(instrumenNama);
        const durationStr = calculateDurationMinutes(nextJadwal.jamMulai, nextJadwal.jamSelesai);
        const dateStr = getFormattedDateString(nextJadwal.hari);
        
        const coachNama = nextJadwal.guru || (data.siswaInfo ? data.siswaInfo.guru : '');
        const coachObj = globalGuruList.find(g => String(g.nama).trim().toLowerCase() === String(coachNama).trim().toLowerCase());
        const coachFoto = coachObj ? coachObj.foto : '';

        let coachAvatarHtml = '';
        if (coachFoto && coachFoto.length > 5) {
          coachAvatarHtml = `<img src="${coachFoto}" class="coach-avatar-circle">`;
        } else {
          const init = coachNama ? coachNama.charAt(0).toUpperCase() : 'C';
          coachAvatarHtml = `<div class="coach-avatar-initial-circle">${init}</div>`;
        }

        const coachDisplayName = coachNama ? coachNama : 'Legacy Teacher';

        container.insertAdjacentHTML('beforeend', `
          <div class="siswa-card-schedule">
            <div class="siswa-card-top">
              <div class="siswa-card-left">
                <div class="siswa-instrumen-icon-badge">${iconInstrumen}</div>
                <div class="siswa-tag-kelas">Kelas Musik</div>
                <div class="siswa-card-title">${instrumenNama} (${siswaNama})</div>
                
                <div class="siswa-card-details">
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${dateStr}</span>
                  </div>
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 16 14"></polyline></svg>
                    <span>${nextJadwal.jamMulai} - ${nextJadwal.jamSelesai} (${durationStr})</span>
                  </div>
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>${nextJadwal.ruangan || 'Ruang Kelas'} - Legacy Music Center</span>
                  </div>
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>Coach ${coachDisplayName}</span>
                  </div>
                </div>
              </div>

              <div class="siswa-card-right-coach">
                ${coachAvatarHtml}
                <div class="coach-title-label">Coach</div>
                <div class="coach-name-label">${coachDisplayName}</div>
              </div>
            </div>
          </div>`);
        });
      } else {
        container.innerHTML = `<div style="font-size:13px; color:#94a3b8; text-align:center; padding:25px 0; background:#fafafa; border-radius:12px;">Belum ada jadwal pelajaran mendatang.</div>`;
      }
    }

    function renderGuruOrAdmin(data) {
      const isAdmin = currentUser.userType === 'admin';
      
      if(isAdmin) {
        document.getElementById('dashGuruNama').textContent = data.adminInfo.nama;
        document.getElementById('dashGuruEmail').textContent = data.adminInfo.email;
        document.getElementById('userName').textContent = data.adminInfo.nama;
        document.getElementById('myProfileDisplayName').textContent = data.adminInfo.nama;
        document.getElementById('selfProfileNama').value = data.adminInfo.nama;
        document.getElementById('selfProfileEmail').value = data.adminInfo.email;
        document.getElementById('selfProfileHP').value = data.adminInfo.noHp || '';

        document.getElementById('dashGuruSpesialisMeta').style.display = 'none';
        document.getElementById('adminFilterGuruBox').style.display = 'block';
        document.getElementById('groupPilihGuruPengajar').style.display = 'block';
        document.getElementById('editSiswaGuruGroup').style.display = 'block';
        document.getElementById('addStudentExtraClassesBox').style.display = 'block';
        document.getElementById('editStudentExtraClassesBox').style.display = 'block';

        document.getElementById('guruNextClassWidgetBox').style.display = 'none';
        document.getElementById('adminOngoingClassWidgetBox').style.display = 'block';

        document.getElementById('formJadwalPenggantiBox').style.display = 'block';
        document.getElementById('formPengumumanBox').style.display = 'block';
        document.getElementById('dashboardAcademyUpdatesGuru').style.display = 'none';

        document.getElementById('statTotalSiswaAll').textContent = data.stats.totalSiswa;
        document.getElementById('statSiswaAktif').textContent = data.stats.siswaAktif;
        document.getElementById('statSiswaCuti').textContent = data.stats.siswaCuti;
        document.getElementById('statFourthTitle').textContent = 'Siswa Keluar';
        document.getElementById('statFourthVal').textContent = data.stats.siswaKeluar;

        document.getElementById('siswaFilterBox').style.display = 'block';
        document.getElementById('filterSiswaInstrumenGroup').style.display = 'block';
        document.getElementById('filterSiswaGuruGroup').style.display = 'block';
        document.getElementById('studentReportAdminBox').style.display = 'block';
        document.getElementById('jadwalFilterBox').style.display = 'block';
        document.querySelectorAll('.filter-admin-only').forEach(el => el.style.display = 'block');

        updateAvatarUI(data.adminInfo.foto);
      } else {
        document.getElementById('dashGuruNama').textContent = data.guruInfo.nama;
        document.getElementById('dashGuruEmail').textContent = data.guruInfo.email;
        document.getElementById('userName').textContent = data.guruInfo.nama;
        document.getElementById('myProfileDisplayName').textContent = data.guruInfo.nama;
        document.getElementById('selfProfileNama').value = data.guruInfo.nama;
        document.getElementById('selfProfileEmail').value = data.guruInfo.email;
        document.getElementById('selfProfileHP').value = data.guruInfo.noHp || '';
        document.getElementById('selfProfileInstrumen').value = data.guruInfo.instrumen || 'Gitar';

        document.getElementById('dashGuruInstrumen').textContent = data.guruInfo.instrumen || 'Gitar';
        document.getElementById('dashGuruSpesialisMeta').style.display = 'inline-block';
        document.getElementById('adminFilterGuruBox').style.display = 'none';
        document.getElementById('groupPilihGuruPengajar').style.display = 'none';
        document.getElementById('editSiswaGuruGroup').style.display = 'none';
        document.getElementById('addStudentExtraClassesBox').style.display = 'none';
        document.getElementById('editStudentExtraClassesBox').style.display = 'none';

        document.getElementById('formJadwalPenggantiBox').style.display = 'none';
        document.getElementById('formPengumumanBox').style.display = 'none';
        document.getElementById('dashboardAcademyUpdatesGuru').style.display = 'block';

        document.getElementById('guruNextClassWidgetBox').style.display = 'block';
        document.getElementById('adminOngoingClassWidgetBox').style.display = 'none';

        document.getElementById('statTotalSiswaAll').textContent = data.stats.totalSiswa;
        document.getElementById('statSiswaAktif').textContent = (data.siswaList || []).filter(s => String(s.status).toLowerCase() === 'aktif').length;
        document.getElementById('statSiswaCuti').textContent = (data.siswaList || []).filter(s => String(s.status).toLowerCase() === 'cuti').length;
        document.getElementById('statFourthTitle').textContent = 'Kelas Hari Ini';
        document.getElementById('statFourthVal').textContent = data.stats.sesiJadwalAktif;

        document.getElementById('siswaFilterBox').style.display = 'block';
        document.getElementById('filterSiswaInstrumenGroup').style.display = 'none';
        document.getElementById('filterSiswaGuruGroup').style.display = 'none';
        document.getElementById('studentReportAdminBox').style.display = 'none';
        document.getElementById('jadwalFilterBox').style.display = 'block';
        document.querySelectorAll('.filter-admin-only').forEach(el => el.style.display = 'none');

        updateAvatarUI(data.guruInfo.foto);
      }

      globalSiswaList = data.siswaList || [];

      const gList = globalGuruList;
      const gSelects = document.querySelectorAll('#editJadwalGuru, #addSiswaGuruSelect, #editSiswaGuruSelect, #penggantiGuruSelect');
      let options = '<option value="">Pilih Guru...</option>';
      gList.forEach(g => options += `<option value="${g.nama}" data-guru-id="${g.id || ''}">${g.nama} (${g.instrumen || 'Gitar'})</option>`);
      gSelects.forEach(sel => sel.innerHTML = options);

      let optFilterGuru = '<option value="">-- Semua Guru --</option>';
      gList.forEach(g => optFilterGuru += `<option value="${g.nama}">${g.nama} (${g.instrumen})</option>`);
      
      if (isAdmin) {
        const adminFilterSel = document.getElementById('adminSelectGuruFilter');
        if(adminFilterSel) adminFilterSel.innerHTML = '<option value="">-- Tampilkan Semua Guru & Siswa --</option>' + gList.map(g => `<option value="${g.nama}">${g.nama} (${g.instrumen})</option>`).join('');
        
        const filterSiswaGuru = document.getElementById('filterSiswaGuru');
        if(filterSiswaGuru) filterSiswaGuru.innerHTML = optFilterGuru;

        const filterJadwalGuru = document.getElementById('filterJadwalGuru');
        if(filterJadwalGuru) filterJadwalGuru.innerHTML = optFilterGuru;
      }

      renderDashboardViews();
      applySiswaFilters();
      if (isAdmin) {
        initializeStudentReports();
        renderAdminTeacherManagement();
      }
    }

    const learningProgressCategories = [
      { key:'materi', label:'Materi', icon:'📖' },
      { key:'teknik', label:'Teknik', icon:'⚙️' },
      { key:'teori', label:'Teori Musik', icon:'♫' },
      { key:'repertoire', label:'Repertoire / Lagu', icon:'▤' },
      { key:'practice', label:'Practice / Latihan', icon:'◷' },
      { key:'performance', label:'Performance', icon:'★' },
      { key:'evaluasi', label:'Evaluasi', icon:'▥' }
    ];

