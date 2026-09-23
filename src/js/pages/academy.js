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
          fetchDashboardData();
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
      document.getElementById('makeupFilterClassGroup').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('makeupFilterTeacherGroup').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('makeupFilterDayGroup').style.display = isAdmin || isGuru ? 'block' : 'none';
      const classSelect = document.getElementById('makeupFilterClass');
      const teacherSelect = document.getElementById('makeupFilterTeacher');
      const currentClass = classSelect.value;
      const currentTeacher = teacherSelect.value;
      const classes = [...new Set(globalSiswaList.map(item => item.instrumen || item.kelas).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      classSelect.innerHTML = '<option value="">Semua Kelas</option>' + classes.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      teacherSelect.innerHTML = '<option value="">Semua Guru</option>' + globalGuruList.map(item => `<option value="${escapeTaskHtml(item.nama)}">${escapeTaskHtml(item.nama)}</option>`).join('');
      if (classes.includes(currentClass)) classSelect.value = currentClass;
      if (globalGuruList.some(item => item.nama === currentTeacher)) teacherSelect.value = currentTeacher;
    }

    function renderTabelJadwalPengganti() {
      const container = document.getElementById('jadwalPenggantiListContainer');
      if (!container) return;
      container.innerHTML = '';
      const isAdmin = currentUser.userType === 'admin';
      const classFilter = isAdmin ? String(document.getElementById('makeupFilterClass')?.value || '').toLowerCase() : '';
      const teacherFilter = isAdmin ? String(document.getElementById('makeupFilterTeacher')?.value || '').toLowerCase() : '';
      const dayFilter = currentUser.userType !== 'siswa' ? String(document.getElementById('makeupFilterDay')?.value || '').toLowerCase() : '';
      const list = globalJadwalPenggantiList.filter(item => {
        const student = globalSiswaList.find(row => String(row.nama || '').toLowerCase() === String(item.namaSiswa || '').toLowerCase());
        const studentClass = String(student ? (student.instrumen || student.kelas || '') : '').toLowerCase();
        return (!classFilter || studentClass === classFilter) && (!teacherFilter || String(item.guru || '').toLowerCase() === teacherFilter) && (!dayFilter || String(item.hariPelaksanaan || '').toLowerCase() === dayFilter);
      });
      if (list.length === 0) {
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
          if(res.success) fetchDashboardData();
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
          fetchDashboardData();
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
          if(res.success) fetchDashboardData();
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

