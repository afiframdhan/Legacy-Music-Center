    function fetchDashboardData(options = {}) {
      const opts = options && typeof options === 'object' ? options : {};
      const retryCount = Number(opts.retryCount || 0);
      const now = Date.now();
      if (dashboardLoadInFlight) {
        dashboardRefreshQueued = true;
        return;
      }
      if (!opts.force && dashboardLastLoadedAt && now - dashboardLastLoadedAt < 700) return;
      dashboardLoadInFlight = true;
      const requestNumber = ++dashboardRequestNumber;
      const finishDashboardLoad = function() {
        dashboardLoadInFlight = false;
        if (dashboardRefreshQueued) {
          dashboardRefreshQueued = false;
          setTimeout(() => fetchDashboardData({ silent:true, reason:'queued-refresh' }), 120);
        }
      };
      google.script.run.withSuccessHandler(function(rawData) {
        if (requestNumber !== dashboardRequestNumber) { finishDashboardLoad(); return; }
        let data = rawData;
        if (typeof rawData === 'string') {
          try { data = JSON.parse(rawData); }
          catch (error) { if (!opts.silent) showAlert('alertDanger', 'Data dashboard Supabase tidak valid. Silakan coba lagi.'); finishDashboardLoad(); return; }
        }
        if (!data || data.error || data.success === false) {
          if (retryCount < 2) { finishDashboardLoad(); setTimeout(() => fetchDashboardData({ ...opts, force:true, silent:true, retryCount:retryCount+1 }), 350 * (retryCount + 1)); return; }
          if (!opts.silent) showAlert('alertDanger', data && (data.error || data.message) ? (data.error || data.message) : 'Data Supabase kosong. Silakan coba lagi.');
          finishDashboardLoad();
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
        globalScheduleOverrides = data.scheduleOverrides || [];
        globalPengumumanList = data.pengumumanList || [];
        globalLearningProgressList = data.learningProgressList || [];
        globalRepertoireList = [];
        globalStudentHistory = data.studentHistory || [];
        globalTeacherAttendanceList = data.teacherAttendanceList || [];

        // Dashboard V3 loads only the data needed to paint the first screen quickly.
        // Historical modules can be completed lazily when their page is opened.
        globalPartialModules = new Set(Array.isArray(data.partialModules) ? data.partialModules : []);
        globalLoadedModules = new Set();
        const bootModules = {
          attendance:Array.isArray(data.absensiList),
          assignments:Array.isArray(data.tugasList),
          progress:Array.isArray(data.learningProgressList),
          schedules:Array.isArray(data.jadwal || data.schedules),
          announcements:Array.isArray(data.pengumumanList),
          teacher_attendance:Array.isArray(data.teacherAttendanceList)
        };
        Object.entries(bootModules).forEach(([module, present]) => {
          if (present && !globalPartialModules.has(module)) globalLoadedModules.add(module);
        });

        // Do not make a second blocking request for Guru List after dashboard load.
        // Admin already receives guruList from the same Supabase dashboard response;
        // Guru only needs their own identity for role-specific screens; siswa does not
        // need the entire teacher directory during initial render.
        if (Array.isArray(data.guruList)) globalGuruList = data.guruList;
        else if (data.userType === 'guru' && data.guruInfo) {
          globalGuruList = [{
            id:data.guruInfo.userID || '',
            nama:data.guruInfo.nama || '',
            email:data.guruInfo.email || '',
            noHp:data.guruInfo.noHp || '',
            instrumen:data.guruInfo.instrumen || 'Gitar',
            foto:data.guruInfo.foto || ''
          }];
        } else globalGuruList = [];

        if (data.userType === 'siswa') renderSiswa(data);
        if (data.userType === 'guru' || data.userType === 'admin') renderGuruOrAdmin(data);
        if ((data.userType === 'guru' || data.userType === 'admin') && typeof renderStudent360Access === 'function') renderStudent360Access(data);
        renderLearningProgressViews();
        if (typeof ensureStudent360SelfReportButton === 'function') ensureStudent360SelfReportButton();

        // Paint the primary dashboard before constructing off-screen tables and widgets.
        // This doesn't change data freshness or the completion semantics of the API call.
        setupFilterDropdown();
        renderTabelJadwal();
        renderPengumumanList();
        renderDashboardAcademyUpdates();
        renderNotificationCenter();
        if (notificationTimer) clearInterval(notificationTimer);
        notificationTimer = setInterval(renderNotificationCenter, 60000);
        if (typeof configureAdminAttendanceLiveSync === 'function') configureAdminAttendanceLiveSync();
        if (typeof configureLiveAnnouncementSync === 'function') configureLiveAnnouncementSync();
        const secondaryRenderUser = String(currentUser.userID || '');
        const secondaryRenderRole = String(currentUser.userType || '');
        const renderDeferredDashboardSections = () => {
          if (String(currentUser.userID || '') !== secondaryRenderUser || String(currentUser.userType || '') !== secondaryRenderRole) return;
          if (calendarInstance && typeof renderCalendarEvents === 'function') renderCalendarEvents();
          renderTabelRiwayat();
          renderTabelTugas();
          renderTabelJadwalPengganti();
          setupMakeupFilters();
          setupRoomFilters();
          renderRoomAvailability();
        };
        // A browser rendering opportunity between essential and secondary content.
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => setTimeout(renderDeferredDashboardSections, 0));
        } else {
          setTimeout(renderDeferredDashboardSections, 0);
        }

        // Small diagnostic marker for troubleshooting. It is intentionally not shown
        // as a normal UI element, but can be checked in DevTools if ever needed.
        document.documentElement.dataset.dashboardSource = data.dataSource || 'unknown';
        dashboardLastLoadedAt = Date.now();
        if (typeof configureGlobalLiveSync === 'function') configureGlobalLiveSync();
        finishDashboardLoad();
      }).withFailureHandler(error => {
        if (requestNumber !== dashboardRequestNumber) { finishDashboardLoad(); return; }
        if (retryCount < 2) { finishDashboardLoad(); setTimeout(() => fetchDashboardData({ ...opts, force:true, silent:true, retryCount:retryCount+1 }), 350 * (retryCount + 1)); return; }
        if (!opts.silent) showAlert('alertDanger', 'Data Supabase gagal dimuat: ' + (error.message || error));
        finishDashboardLoad();
      }).getDashboardData(currentUser.userID, currentUser.userType);
    }

    function legacyDisplayImageUrl(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (/^data:image\//i.test(raw) || /^blob:/i.test(raw)) return raw;
      let match = raw.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
      if (!match) match = raw.match(/[?&]id=([^&#]+)/i);
      if (!match) match = raw.match(/googleusercontent\.com\/d\/([^/?#]+)/i);
      if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
      return raw;
    }

    function legacyImageFallback(img) {
      if (!img) return;
      const original = String(img.dataset.originalSrc || '').trim();
      if (!original || img.dataset.fallbackUsed === '1') {
        img.style.display = 'none';
        const fallback = img.nextElementSibling;
        if (fallback && fallback.classList.contains('coach-avatar-initial-circle')) fallback.style.display = 'flex';
        return;
      }
      img.dataset.fallbackUsed = '1';
      img.src = original;
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

    function getNextScheduleDate(hariStr, jamMulai) {
      const dayMap = {minggu:0,ahad:0,senin:1,selasa:2,rabu:3,kamis:4,jumat:5,"jum'at":5,sabtu:6};
      const target = dayMap[String(hariStr || '').trim().toLowerCase()];
      const now = new Date();
      if (target == null) return new Date(now);
      let addDays = (target - now.getDay() + 7) % 7;
      if (addDays === 0 && jamMulai) {
        const parts = String(jamMulai).match(/^(\d{1,2}):(\d{2})/);
        if (parts) {
          const start = new Date(now); start.setHours(Number(parts[1]), Number(parts[2]), 0, 0);
          if (start <= now) addDays = 7;
        }
      }
      const next = new Date(now); next.setDate(now.getDate() + addDays); next.setHours(0,0,0,0);
      return next;
    }

    function getFormattedDateString(hariStr, jamMulai) {
      const next = getNextScheduleDate(hariStr, jamMulai);
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      return `${dayNames[next.getDay()]}, ${next.getDate()} ${monthNames[next.getMonth()]} ${next.getFullYear()}`;
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
        const upcomingSchedules = [...data.schedules].sort((a,b)=>getNextScheduleDate(a.hari,a.jamMulai)-getNextScheduleDate(b.hari,b.jamMulai));
        upcomingSchedules.forEach(nextJadwal => {
        const instrumenNama = nextJadwal.instrumen || (data.siswaInfo ? data.siswaInfo.instrumen : 'Gitar');
        const siswaNama = currentUser.userName;
        const iconInstrumen = getInstrumenIcon(instrumenNama);
        const durationStr = calculateDurationMinutes(nextJadwal.jamMulai, nextJadwal.jamSelesai);
        const dateStr = getFormattedDateString(nextJadwal.hari, nextJadwal.jamMulai);
        
        const coachNama = nextJadwal.guru || (data.siswaInfo ? data.siswaInfo.guru : '');
        const coachObj = globalGuruList.find(g => String(g.nama).trim().toLowerCase() === String(coachNama).trim().toLowerCase());
        const coachFoto = coachObj ? coachObj.foto : '';

        let coachAvatarHtml = '';
        const init = coachNama ? coachNama.charAt(0).toUpperCase() : 'C';
        if (coachFoto && coachFoto.length > 5) {
          const displayFoto = legacyDisplayImageUrl(coachFoto);
          coachAvatarHtml = `<img src="${escapeTaskHtml(displayFoto)}" data-original-src="${escapeTaskHtml(coachFoto)}" class="coach-avatar-circle" onerror="legacyImageFallback(this)"><div class="coach-avatar-initial-circle" style="display:none">${escapeTaskHtml(init)}</div>`;
        } else {
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
        container.innerHTML = `<div class="student-dashboard-empty">Belum ada jadwal pelajaran mendatang.</div>`;
      }

      if (typeof renderStudent360Access === 'function') renderStudent360Access(data);
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
        const controlBox = document.getElementById('adminControlCenterBox');
        if (controlBox) controlBox.style.display = 'block';
        if (!globalAdminControlSummary) setTimeout(() => loadAdminControlCenter(false), 0);

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
        const controlBox = document.getElementById('adminControlCenterBox');
        if (controlBox) controlBox.style.display = 'none';

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
        if (typeof refreshSiswaGuruFilterByInstrument === 'function') refreshSiswaGuruFilterByInstrument();

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

