    function classSelectOptions(values, selected) {
      return values.map(value => `<option value="${escapeTaskHtml(value)}" ${String(value) === String(selected || '') ? 'selected' : ''}>${escapeTaskHtml(value)}</option>`).join('');
    }

    function classTeacherOptions(selected) {
      return '<option value="">Pilih Guru...</option>' + (globalGuruList || []).map(g => `<option value="${escapeTaskHtml(g.nama)}" data-guru-id="${escapeTaskHtml(g.id || '')}" ${String(g.nama) === String(selected || '') ? 'selected' : ''}>${escapeTaskHtml(g.nama)} (${escapeTaskHtml(g.instrumen || 'Musik')})</option>`).join('');
    }

    function studentExtraClassTemplate(item, mode) {
      item = item || {};
      const roomValues = studentRoomOptions.slice();
      if (item.ruangan && !roomValues.includes(item.ruangan)) roomValues.push(item.ruangan);
      return `<div class="student-extra-class-row" data-class-id="${escapeTaskHtml(item.kelasSiswaID || '')}" data-schedule-id="${escapeTaskHtml(item.jadwalID || '')}" style="padding:12px;margin:10px 0;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><b style="font-size:13px;color:#f15a24;">Kelas Tambahan</b><button type="button" class="btn-action btn-delete" onclick="this.closest('.student-extra-class-row').remove()">Hapus</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;">
          <div class="form-group" style="margin:0;"><label>Instrumen</label><select class="extra-class-instrument" required>${classSelectOptions(studentInstrumentOptions, item.instrumen || 'Gitar')}</select></div>
          <div class="form-group" style="margin:0;"><label>Guru</label><select class="extra-class-teacher" required>${classTeacherOptions(item.guru || '')}</select></div>
          <div class="form-group" style="margin:0;"><label>Grade</label><select class="extra-class-grade" required>${classSelectOptions(studentGradeOptions, item.grade || 'Beginner')}</select></div>
          <div class="form-group" style="margin:0;"><label>Hari</label><select class="extra-class-day">${classSelectOptions([''].concat(studentDayOptions), item.hari || '')}</select></div>
          <div class="form-group" style="margin:0;"><label>Jam Mulai</label><input class="extra-class-start" type="time" value="${escapeTaskHtml(item.jamMulai || '')}"></div>
          <div class="form-group" style="margin:0;"><label>Jam Selesai</label><input class="extra-class-end" type="time" value="${escapeTaskHtml(item.jamSelesai || '')}"></div>
          <div class="form-group" style="margin:0;"><label>Ruangan</label><select class="extra-class-room">${classSelectOptions([''].concat(roomValues), item.ruangan || '')}</select></div>
        </div>
      </div>`;
    }

    function addStudentExtraClassRow(item) {
      document.getElementById('addStudentExtraClasses').insertAdjacentHTML('beforeend', studentExtraClassTemplate(item || {}, 'add'));
    }

    function addEditStudentExtraClassRow(item) {
      document.getElementById('editStudentExtraClasses').insertAdjacentHTML('beforeend', studentExtraClassTemplate(item || {}, 'edit'));
    }

    function collectStudentExtraClasses(containerId, status) {
      return [...document.querySelectorAll(`#${containerId} .student-extra-class-row`)].map(row => {
        const teacherSelect = row.querySelector('.extra-class-teacher');
        const selectedTeacher = teacherSelect.options[teacherSelect.selectedIndex];
        return {
          kelasSiswaID: row.dataset.classId || '', jadwalID: row.dataset.scheduleId || '',
          instrumen: row.querySelector('.extra-class-instrument').value,
          guru: teacherSelect.value, guruID: selectedTeacher ? (selectedTeacher.dataset.guruId || '') : '',
          grade: row.querySelector('.extra-class-grade').value, status: status,
          hari: row.querySelector('.extra-class-day').value, jamMulai: row.querySelector('.extra-class-start').value,
          jamSelesai: row.querySelector('.extra-class-end').value, ruangan: row.querySelector('.extra-class-room').value
        };
      });
    }

    function openEditModal(nama) {
      const siswa = globalSiswaList.find(s => String(s.nama).trim().toLowerCase() === String(nama).trim().toLowerCase());
      if (!siswa) return;
      const classes = Array.isArray(siswa.kelasList) && siswa.kelasList.length ? siswa.kelasList : [{ instrumen:siswa.instrumen || 'Gitar', guru:siswa.guru || '', grade:siswa.kelas || 'Beginner' }];
      const primaryClass = classes[0];
      document.getElementById('editOldNama').value = siswa.nama;
      document.getElementById('editSiswaID').value = siswa.siswaID || '';
      document.getElementById('editSiswaNama').value = siswa.nama;
      document.getElementById('editSiswaInstrumen').value = primaryClass.instrumen || 'Gitar';
      document.getElementById('editSiswaGrade').value = primaryClass.grade || siswa.kelas;
      document.getElementById('editSiswaEmail').value = siswa.email;
      document.getElementById('editSiswaHP').value = siswa.noHp || '';
      document.getElementById('editSiswaTanggalMasuk').value = siswa.tglDaftar || '';
      document.getElementById('editSiswaTanggalKeluar').value = siswa.tglKeluar || '';
      document.getElementById('editSiswaStatus').value = siswa.status;
      if (document.getElementById('editSiswaGuruSelect')) {
        document.getElementById('editSiswaGuruSelect').value = primaryClass.guru || siswa.guru || '';
      }
      const extrasContainer = document.getElementById('editStudentExtraClasses');
      extrasContainer.innerHTML = '';
      if (currentUser.userType === 'admin') classes.slice(1).forEach(item => addEditStudentExtraClassRow(item));
      document.getElementById('modalEditSiswa').style.display = 'flex';
    }

    function closeEditModal() { document.getElementById('modalEditSiswa').style.display = 'none'; }
    
    function handleUpdateSiswa(e) {
      e.preventDefault();
      const status = document.getElementById('editSiswaStatus').value;
      const primaryTeacherSelect = document.getElementById('editSiswaGuruSelect');
      const primaryTeacherOption = primaryTeacherSelect && primaryTeacherSelect.options[primaryTeacherSelect.selectedIndex];
      const existingStudent = globalSiswaList.find(s => String(s.siswaID || '') === String(document.getElementById('editSiswaID').value || '')) || {};
      const existingPrimary = Array.isArray(existingStudent.kelasList) && existingStudent.kelasList.length ? existingStudent.kelasList[0] : {};
      const primaryClass = {
        kelasSiswaID: existingPrimary.kelasSiswaID || '', jadwalID: existingPrimary.jadwalID || '',
        instrumen: document.getElementById('editSiswaInstrumen').value,
        grade: document.getElementById('editSiswaGrade').value, status: status,
        guru: primaryTeacherSelect ? primaryTeacherSelect.value : currentUser.userName,
        guruID: primaryTeacherOption ? (primaryTeacherOption.dataset.guruId || '') : currentUser.userID,
        hari: existingPrimary.hari || '', jamMulai: existingPrimary.jamMulai || '', jamSelesai: existingPrimary.jamSelesai || '', ruangan: existingPrimary.ruangan || ''
      };
      const kelasList = [primaryClass].concat(currentUser.userType === 'admin' ? collectStudentExtraClasses('editStudentExtraClasses', status) : []);
      const payload = {
        siswaID: document.getElementById('editSiswaID').value,
        oldNama: document.getElementById('editOldNama').value,
        nama: document.getElementById('editSiswaNama').value,
        instrumen: document.getElementById('editSiswaInstrumen').value,
        kelas: document.getElementById('editSiswaGrade').value,
        email: document.getElementById('editSiswaEmail').value,
        noHp: document.getElementById('editSiswaHP').value,
        tglDaftar: document.getElementById('editSiswaTanggalMasuk').value,
        tglKeluar: document.getElementById('editSiswaTanggalKeluar').value,
        status: status,
        guru: primaryClass.guru,
        guruID: primaryClass.guruID,
        kelasList: kelasList,
        currentUserType: currentUser.userType,
        currentUserID: currentUser.userID
      };
      google.script.run.withSuccessHandler(res => {
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) { closeEditModal(); fetchDashboardData(); }
      }).updateSiswa(payload);
    }

    function openEditJadwalModal(jadwalID) {
      const j = globalJadwalList.find(item => String(item.jadwalID).trim() === String(jadwalID).trim());
      if (!j) return;

      document.getElementById('editJadwalID').value = j.jadwalID;
      document.getElementById('editJadwalSiswa').value = j.namaSiswa;
      document.getElementById('editJadwalInstrumen').value = j.instrumen || 'Gitar';
      document.getElementById('editJadwalGuru').value = j.guru || '';
      document.getElementById('editJadwalHari').value = j.hari;
      document.getElementById('editJadwalMulai').value = j.jamMulai;
      document.getElementById('editJadwalSelesai').value = j.jamSelesai;
      
      const defaultRuanganList = ['R 1', 'R 2', 'R 3', 'R 4', 'R 5', 'R 6', 'R 7', 'R 8'];
      const ruanganVal = j.ruangan || '';
      
      if (defaultRuanganList.includes(ruanganVal)) {
        document.getElementById('editJadwalRuanganSelect').value = ruanganVal;
        toggleRuanganOtherInput(ruanganVal, 'containerEditRuanganOther', 'editJadwalRuanganOther');
      } else {
        document.getElementById('editJadwalRuanganSelect').value = 'Other';
        toggleRuanganOtherInput('Other', 'containerEditRuanganOther', 'editJadwalRuanganOther');
        document.getElementById('editJadwalRuanganOther').value = ruanganVal;
      }

      document.getElementById('editJadwalStatus').value = j.status || 'Aktif';

      const btnUpdate = document.getElementById('btnUpdateJadwalForm');
      if(currentUser.userType === 'siswa') {
        btnUpdate.style.display = 'none';
      } else {
        btnUpdate.style.display = 'block';
      }

      document.getElementById('modalEditJadwal').style.display = 'flex';
    }

    function closeEditJadwalModal() { document.getElementById('modalEditJadwal').style.display = 'none'; }
    
    function handleUpdateJadwal(e) {
      e.preventDefault();

      const selectedRuanganVal = document.getElementById('editJadwalRuanganSelect').value;
      let finalRuangan = selectedRuanganVal;
      if (selectedRuanganVal === 'Other') {
        finalRuangan = document.getElementById('editJadwalRuanganOther').value.trim();
      }

      if (!finalRuangan) {
        alert('Silakan pilih atau isi nama Ruangan terlebih dahulu!');
        return false;
      }

      const payload = {
        jadwalID: document.getElementById('editJadwalID').value,
        namaSiswa: document.getElementById('editJadwalSiswa').value,
        instrumen: document.getElementById('editJadwalInstrumen').value,
        guru: document.getElementById('editJadwalGuru').value,
        hari: document.getElementById('editJadwalHari').value,
        jamMulai: document.getElementById('editJadwalMulai').value,
        jamSelesai: document.getElementById('editJadwalSelesai').value,
        ruangan: finalRuangan,
        status: document.getElementById('editJadwalStatus').value
      };
      google.script.run.withSuccessHandler(res => {
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) { closeEditJadwalModal(); fetchDashboardData(); }
      }).updateJadwal(payload);
    }

    function handleSaveSelfProfile(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSaveSelfProfile');
      btn.disabled = true; btn.textContent = 'Menyimpan...';

      const payload = {
        userID: currentUser.userID,
        oldNama: currentUser.userName,
        nama: document.getElementById('selfProfileNama').value,
        email: document.getElementById('selfProfileEmail').value,
        noHp: document.getElementById('selfProfileHP').value,
        instrumen: document.getElementById('selfProfileInstrumen') ? document.getElementById('selfProfileInstrumen').value : '',
        userType: currentUser.userType
      };

      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Simpan Perubahan Profil';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if (res.success) {
          currentUser.userID = res.userID || currentUser.userID;
          currentUser.userName = payload.nama;
          saveLoginSession(currentUser);
          fetchDashboardData();
        }
      }).updateSelfProfile(payload);
    }

