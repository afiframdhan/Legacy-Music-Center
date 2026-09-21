    function toggleRuanganOtherInput(value, containerId, inputId) {
      const containerOther = document.getElementById(containerId);
      const inputOther = document.getElementById(inputId);
      
      if (containerOther && inputOther) {
        if (value === 'Other') {
          containerOther.style.display = 'block';
          inputOther.required = true;
        } else {
          containerOther.style.display = 'none';
          inputOther.required = false;
          inputOther.value = '';
        }
      }
    }

    function setTeacherQuickForm(id, forceOpen) {
      const box = document.getElementById(id);
      if (!box) return;
      const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : box.style.display === 'none';
      box.style.display = shouldOpen ? 'block' : 'none';
      if (shouldOpen) {
        if (id === 'teacherAttendanceFormBox') setTimeout(() => { initSignaturePads(); resizeSignaturePad('canvasTtdAbsensiGuru'); }, 60);
        setTimeout(() => box.scrollIntoView({behavior:'smooth', block:'start'}), 30);
      }
    }

    function switchTeacherAdminTab(tab) {
      const attendance = tab === 'attendance';
      switchTab(attendance ? 'section-absensi-guru' : 'section-daftar-guru');
      if (attendance) setTimeout(() => { initSignaturePads(); resizeSignaturePad('canvasTtdAbsensiGuru'); }, 60);
    }

    function renderAdminTeacherManagement() {
      if (currentUser.userType !== 'admin') return;
      const teacherBody = document.getElementById('adminGuruListBody');
      if (teacherBody) {
        teacherBody.innerHTML = globalGuruList.length ? globalGuruList.map((guru, index) => `<tr class="teacher-mobile-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false"><td data-label="No">${index + 1}</td><td data-label="Nama Guru"><b>${escapeTaskHtml(guru.nama || '-')}</b></td><td data-label="Instrumen">${escapeTaskHtml(guru.instrumen || '-')}</td><td data-label="Email">${escapeTaskHtml(guru.email || '-')}</td><td data-label="No. HP">${escapeTaskHtml(guru.noHp || '-')}</td><td data-label="Status"><span><span class="badge ${String(guru.status || 'Aktif').toLowerCase() === 'aktif' ? 'badge-success' : 'badge-danger'}">${escapeTaskHtml(guru.status || 'Aktif')}</span><span class="teacher-row-chevron">⌄</span></span></td><td data-label="Aksi"><div class="table-actions"><button type="button" class="btn-action btn-edit" onclick="openEditGuru(decodeURIComponent('${encodeURIComponent(guru.id || guru.nama || '')}'))">Edit</button><button type="button" class="btn-action btn-delete" onclick="deleteGuruRecord(decodeURIComponent('${encodeURIComponent(guru.id || guru.nama || '')}'),decodeURIComponent('${encodeURIComponent(guru.nama || '')}'))">Hapus</button></div></td></tr>`).join('') : '<tr class="table-empty-row"><td class="table-empty-cell" colspan="7" style="text-align:center;color:#94a3b8;">Belum ada data guru.</td></tr>';
      }

      const teacherSelect = document.getElementById('absensiGuruID');
      if (teacherSelect) {
        const selected = teacherSelect.value;
        teacherSelect.innerHTML = '<option value="">Pilih Guru...</option>' + globalGuruList.map(guru => `<option value="${escapeTaskHtml(guru.id || guru.nama)}">${escapeTaskHtml(guru.nama)} (${escapeTaskHtml(guru.instrumen || 'Musik')})</option>`).join('');
        if ([...teacherSelect.options].some(option => option.value === selected)) teacherSelect.value = selected;
      }

      const dateInput = document.getElementById('absensiGuruTanggal');
      if (dateInput && !dateInput.value) {
        const today = new Date();
        dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }

      const attendanceBody = document.getElementById('adminTeacherAttendanceBody');
      if (attendanceBody) {
        attendanceBody.innerHTML = globalTeacherAttendanceList.length ? globalTeacherAttendanceList.map((item, index) => {
          const statusKey = String(item.status || '').toLowerCase();
          const badgeClass = statusKey === 'hadir' ? 'badge-success' : (statusKey === 'alpa' ? 'badge-danger' : 'badge-warning');
          const signature = item.tandaTangan && String(item.tandaTangan).startsWith('data:image') ? `<img src="${item.tandaTangan}" class="sig-img-preview" alt="TTD Guru">` : '-';
          return `<tr class="teacher-attendance-mobile-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false"><td data-label="No">${index + 1}</td><td data-label="Tanggal">${escapeTaskHtml(formatAcademyDate(item.tanggal))}</td><td data-label="Nama Guru"><b>${escapeTaskHtml(item.namaGuru || '-')}</b></td><td data-label="Status"><span><span class="badge ${badgeClass}">${escapeTaskHtml(item.status || '-')}</span><span class="teacher-row-chevron">⌄</span></span></td><td data-label="Jam Masuk">${escapeTaskHtml(item.jamMasuk || '-')}</td><td data-label="Jam Keluar">${escapeTaskHtml(item.jamKeluar || '-')}</td><td data-label="Catatan">${escapeTaskHtml(item.catatan || '-')}</td><td data-label="TTD">${signature}</td><td data-label="Aksi"><div class="table-actions"><button type="button" class="btn-action btn-edit" onclick="openEditTeacherAttendance(decodeURIComponent('${encodeURIComponent(item.absensiGuruID || '')}'))">Edit</button><button type="button" class="btn-action btn-delete" onclick="deleteTeacherAttendanceRecord(decodeURIComponent('${encodeURIComponent(item.absensiGuruID || '')}'))">Hapus</button></div></td></tr>`;
        }).join('') : '<tr><td colspan="9" style="text-align:center;color:#94a3b8;">Belum ada absensi guru.</td></tr>';
      }
    }

    function openEditGuru(identifier) {
      const guru = globalGuruList.find(item => String(item.id || item.nama).trim() === String(identifier).trim());
      if (!guru) return;
      switchTeacherAdminTab('list');
      setTeacherQuickForm('teacherAddFormBox', true);
      document.getElementById('editGuruOriginalID').value = guru.id || '';
      document.getElementById('addGuruID').value = guru.id || '';
      document.getElementById('addGuruID').readOnly = true;
      document.getElementById('addGuruNama').value = guru.nama || '';
      document.getElementById('addGuruEmail').value = guru.email || '';
      document.getElementById('addGuruPassword').value = '';
      document.getElementById('addGuruPassword').required = false;
      document.getElementById('addGuruPassword').placeholder = 'Kosongkan jika password tidak diubah';
      document.getElementById('addGuruHP').value = guru.noHp || '';
      document.getElementById('addGuruInstrumen').value = guru.instrumen || 'Gitar';
      document.getElementById('addGuruStatus').value = guru.status || 'Aktif';
      document.getElementById('btnSubmitGuru').textContent = 'Update Guru';
      document.getElementById('btnCancelEditGuru').style.display = 'inline-block';
      document.getElementById('formTambahGuru').scrollIntoView({behavior:'smooth',block:'start'});
    }

    function cancelEditGuru() {
      const form = document.getElementById('formTambahGuru');
      form?.reset();
      document.getElementById('editGuruOriginalID').value = '';
      document.getElementById('addGuruID').readOnly = false;
      document.getElementById('addGuruPassword').required = true;
      document.getElementById('addGuruPassword').placeholder = 'Masukkan password guru';
      document.getElementById('btnSubmitGuru').textContent = 'Simpan Guru';
      document.getElementById('btnCancelEditGuru').style.display = 'none';
    }

    function deleteGuruRecord(identifier, nama) {
      if (!confirm(`Hapus guru "${nama}"? Jika guru masih dipakai pada data siswa atau jadwal aktif, penghapusan akan ditolak agar data lain tetap aman.`)) return;
      google.script.run.withSuccessHandler(res => {
        showAlert(res && res.success ? 'alertSuccess' : 'alertDanger', res && res.message ? res.message : 'Gagal menghapus guru.');
        if (res && res.success) { cancelEditGuru(); fetchDashboardData(); }
      }).deleteGuru(identifier, currentUser.userType);
    }

    function handleTeacherAttendance(e) {
      e.preventDefault();
      if (currentUser.userType !== 'admin') return false;
      const btn = document.getElementById('btnSubmitAbsensiGuru');
      const payload = {
        absensiGuruID: document.getElementById('editAbsensiGuruID').value,
        guruID: document.getElementById('absensiGuruID').value,
        tanggal: document.getElementById('absensiGuruTanggal').value,
        status: document.getElementById('absensiGuruStatus').value,
        jamMasuk: document.getElementById('absensiGuruJamMasuk').value,
        jamKeluar: document.getElementById('absensiGuruJamKeluar').value,
        catatan: document.getElementById('absensiGuruCatatan').value.trim(),
        tandaTangan: getCanvasDataURL('canvasTtdAbsensiGuru'),
        dicatatOleh: currentUser.userName
      };
      if (!payload.tandaTangan && !payload.absensiGuruID) {
        showAlert('alertDanger', 'Tanda tangan guru wajib diisi.');
        return false;
      }
      const existing = payload.absensiGuruID ? globalTeacherAttendanceList.find(item => String(item.absensiGuruID) === String(payload.absensiGuruID)) : null;
      if (!payload.tandaTangan && existing) payload.tandaTangan = existing.tandaTangan || '';
      btn.disabled = true;
      btn.textContent = 'Menyimpan...';
      google.script.run.withSuccessHandler(res => {
        btn.disabled = false;
        btn.textContent = 'Simpan Absensi Guru';
        showAlert(res && res.success ? 'alertSuccess' : 'alertDanger', res && res.message ? res.message : 'Gagal menyimpan absensi guru.');
        if (res && res.success) { cancelEditTeacherAttendance(); fetchDashboardData(); }
      }).withFailureHandler(error => {
        btn.disabled = false;
        btn.textContent = document.getElementById('editAbsensiGuruID').value ? 'Update Absensi Guru' : 'Simpan Absensi Guru';
        showAlert('alertDanger', 'Gagal menyimpan absensi guru: ' + (error.message || error));
      }).recordTeacherAttendance(payload, currentUser.userType);
      return false;
    }

    function openEditTeacherAttendance(absensiGuruID) {
      const item = globalTeacherAttendanceList.find(row => String(row.absensiGuruID).trim() === String(absensiGuruID).trim());
      if (!item) return;
      switchTeacherAdminTab('attendance');
      setTeacherQuickForm('teacherAttendanceFormBox', true);
      document.getElementById('editAbsensiGuruID').value = item.absensiGuruID || '';
      document.getElementById('absensiGuruID').value = item.guruID || '';
      document.getElementById('absensiGuruTanggal').value = item.tanggal || '';
      document.getElementById('absensiGuruStatus').value = item.status || 'Hadir';
      document.getElementById('absensiGuruJamMasuk').value = item.jamMasuk || '';
      document.getElementById('absensiGuruJamKeluar').value = item.jamKeluar || '';
      document.getElementById('absensiGuruCatatan').value = item.catatan || '';
      clearSignature('canvasTtdAbsensiGuru');
      document.getElementById('btnSubmitAbsensiGuru').textContent = 'Update Absensi Guru';
      document.getElementById('btnCancelEditAbsensiGuru').style.display = 'inline-block';
      document.getElementById('formAbsensiGuru').scrollIntoView({behavior:'smooth',block:'start'});
    }

    function cancelEditTeacherAttendance() {
      document.getElementById('editAbsensiGuruID').value = '';
      document.getElementById('formAbsensiGuru')?.reset();
      clearSignature('canvasTtdAbsensiGuru');
      const today = new Date();
      const dateInput = document.getElementById('absensiGuruTanggal');
      if (dateInput) dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      document.getElementById('btnSubmitAbsensiGuru').textContent = 'Simpan Absensi Guru';
      document.getElementById('btnCancelEditAbsensiGuru').style.display = 'none';
    }

    function deleteTeacherAttendanceRecord(absensiGuruID) {
      if (!confirm('Hapus catatan absensi guru ini?')) return;
      google.script.run.withSuccessHandler(res => {
        showAlert(res && res.success ? 'alertSuccess' : 'alertDanger', res && res.message ? res.message : 'Gagal menghapus absensi guru.');
        if (res && res.success) { cancelEditTeacherAttendance(); fetchDashboardData(); }
      }).deleteTeacherAttendance(absensiGuruID, currentUser.userType);
    }

    function printTeacherAttendanceReport() {
      const records = globalTeacherAttendanceList || [];
      if (!records.length) { showAlert('alertDanger', 'Belum ada data absensi guru untuk dicetak.'); return; }
      const printWindow = window.open('', '_blank', 'width=1000,height=760');
      if (!printWindow) { showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk mencetak laporan.'); return; }
      const hadir = records.filter(item => String(item.status).toLowerCase() === 'hadir').length;
      const signature = value => value && String(value).startsWith('data:image') ? `<img src="${value}" alt="Tanda tangan">` : '-';
      const rows = records.map((item,index) => `<tr><td>${index+1}</td><td>${escapeTaskHtml(formatAcademyDate(item.tanggal))}</td><td><b>${escapeTaskHtml(item.namaGuru || '-')}</b></td><td>${escapeTaskHtml(item.status || '-')}</td><td>${escapeTaskHtml(item.jamMasuk || '-')}</td><td>${escapeTaskHtml(item.jamKeluar || '-')}</td><td>${escapeTaskHtml(item.catatan || '-')}</td><td class="signature">${signature(item.tandaTangan)}</td></tr>`).join('');
      const report = `<!doctype html><html><head><meta charset="utf-8"><title>Absensi Guru</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-family:Arial,sans-serif;color:#17232d;margin:0;font-size:10px}.head{display:flex;justify-content:space-between;align-items:end;border-bottom:3px solid #f15a24;padding-bottom:10px;margin-bottom:12px}.head h1{margin:0;font-size:20px}.orange{color:#f15a24}.summary{display:flex;gap:10px;margin-bottom:12px}.summary div{padding:9px 12px;border:1px solid #fed9c6;background:#fff7f2;border-radius:8px}.summary b{font-size:17px;color:#f15a24;margin-left:6px}table{width:100%;border-collapse:collapse}th{background:#f15a24;color:#fff;text-align:left;padding:7px}td{border:1px solid #dfe6ee;padding:7px;vertical-align:middle}.signature{text-align:center}.signature img{max-width:100px;max-height:38px;object-fit:contain}.foot{margin-top:10px;color:#94a3b8;text-align:right;font-size:8px}</style></head><body><div class="head"><div><b class="orange">LEGACY MUSIC CENTER</b><div style="margin-top:4px;color:#64748b">Laporan Kehadiran Pengajar</div></div><div style="text-align:right"><h1>Absensi Guru</h1><div>${new Date().toLocaleDateString('id-ID')}</div></div></div><div class="summary"><div>Total Data <b>${records.length}</b></div><div>Hadir <b>${hadir}</b></div><div>Tidak Hadir <b>${records.length-hadir}</b></div></div><table><thead><tr><th>No</th><th>Tanggal</th><th>Nama Guru</th><th>Status</th><th>Jam Masuk</th><th>Jam Keluar</th><th>Catatan</th><th>Tanda Tangan</th></tr></thead><tbody>${rows}</tbody></table><div class="foot">Dicetak dari sistem Legacy Music Center</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500));<\/script></body></html>`;
      printWindow.document.open(); printWindow.document.write(report); printWindow.document.close();
    }

    function deleteExitedStudentRecord(identifier, nama) {
      const message = `Hapus data siswa keluar "${nama}"? Akun, kelas, jadwal, dan data pada laporan siswa keluar akan dihapus. Riwayat akademik tetap disimpan.`;
      if (!confirm(message)) return;
      google.script.run.withSuccessHandler(res => {
        showAlert(res && res.success ? 'alertSuccess' : 'alertDanger', res && res.message ? res.message : 'Gagal menghapus data siswa keluar.');
        if (res && res.success) fetchDashboardData();
      }).deleteExitedStudentRecord(identifier, currentUser.userType);
    }

    function openAdminTeacherForm() {
      if (currentUser.userType !== 'admin') return;
      switchTab('section-daftar-guru');
      setTimeout(() => {
        document.getElementById('addGuruNama')?.focus();
      }, 120);
    }

    function handleAddGuru(e) {
      e.preventDefault();
      if (currentUser.userType !== 'admin') {
        showAlert('alertDanger', 'Hanya admin yang dapat mengelola guru.');
        return false;
      }

      const btn = document.getElementById('btnSubmitGuru');
      const originalGuruID = document.getElementById('editGuruOriginalID').value.trim();
      const isEdit = !!originalGuruID;
      const payload = {
        originalGuruID: originalGuruID,
        guruID: document.getElementById('addGuruID').value.trim(),
        nama: document.getElementById('addGuruNama').value.trim(),
        email: document.getElementById('addGuruEmail').value.trim(),
        password: document.getElementById('addGuruPassword').value,
        noHp: document.getElementById('addGuruHP').value.trim(),
        instrumen: document.getElementById('addGuruInstrumen').value,
        status: document.getElementById('addGuruStatus').value
      };

      btn.disabled = true;
      btn.textContent = isEdit ? 'Mengupdate...' : 'Menyimpan...';
      const runner = google.script.run.withSuccessHandler(res => {
        btn.disabled = false;
        showAlert(res && res.success ? 'alertSuccess' : 'alertDanger', res && res.message ? res.message : (isEdit ? 'Gagal memperbarui guru.' : 'Gagal menambahkan guru.'));
        if (res && res.success) { cancelEditGuru(); fetchDashboardData(); }
        else btn.textContent = isEdit ? 'Update Guru' : 'Simpan Guru';
      }).withFailureHandler(error => {
        btn.disabled = false;
        btn.textContent = isEdit ? 'Update Guru' : 'Simpan Guru';
        showAlert('alertDanger', (isEdit ? 'Gagal memperbarui guru: ' : 'Gagal menambahkan guru: ') + (error.message || error));
      });
      if (isEdit) runner.updateGuru(payload, currentUser.userType);
      else runner.addGuru(payload, currentUser.userType);
      return false;
    }

    function handleAddSiswaCombined(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitSiswaCombined');
      btn.disabled = true; btn.textContent = 'Menyimpan...';

      let guruSelected = currentUser.userName;
      const selectGuruEl = document.getElementById('addSiswaGuruSelect');
      if (currentUser.userType === 'admin') {
        guruSelected = selectGuruEl ? selectGuruEl.value : '';
        if (!guruSelected) {
          alert('Silakan pilih Guru Pengajar terlebih dahulu!');
          btn.disabled = false; btn.textContent = 'Simpan Siswa & Jadwal';
          return false;
        }
      }

      const selectedRuanganVal = document.getElementById('addJadwalRuanganSelect').value;
      let finalRuangan = selectedRuanganVal;
      if (selectedRuanganVal === 'Other') {
        finalRuangan = document.getElementById('addJadwalRuanganOther').value.trim();
      }

      if (!finalRuangan) {
        alert('Silakan pilih atau isi nama Ruangan terlebih dahulu!');
        btn.disabled = false; btn.textContent = 'Simpan Siswa & Jadwal';
        return false;
      }

      const payload = {
        nama: document.getElementById('addSiswaNama').value,
        instrumen: document.getElementById('addSiswaInstrumen').value,
        kelas: document.getElementById('addSiswaGrade').value,
        guru: guruSelected,
        email: document.getElementById('addSiswaEmail').value,
        noHp: document.getElementById('addSiswaHP').value,
        tglDaftar: document.getElementById('addSiswaTanggalMasuk').value,
        tglKeluar: document.getElementById('addSiswaTanggalKeluar').value,
        status: document.getElementById('addSiswaStatus').value,
        hari: document.getElementById('addJadwalHari').value,
        jamMulai: document.getElementById('addJadwalMulai').value,
        jamSelesai: document.getElementById('addJadwalSelesai').value,
        ruangan: finalRuangan
      };
      const primaryGuruOption = selectGuruEl && selectGuruEl.options[selectGuruEl.selectedIndex];
      payload.guruID = currentUser.userType === 'admin' ? (primaryGuruOption ? (primaryGuruOption.dataset.guruId || '') : '') : currentUser.userID;
      payload.kelasList = [{
        instrumen: payload.instrumen, guru: payload.guru, guruID: payload.guruID, grade: payload.kelas, status: payload.status,
        hari: payload.hari, jamMulai: payload.jamMulai, jamSelesai: payload.jamSelesai, ruangan: payload.ruangan
      }].concat(currentUser.userType === 'admin' ? collectStudentExtraClasses('addStudentExtraClasses', payload.status) : []);

      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Simpan Siswa & Jadwal';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) {
          document.getElementById('formTambahSiswaCombined').reset();
          document.getElementById('addStudentExtraClasses').innerHTML = '';
          const now = new Date();
          document.getElementById('addSiswaTanggalMasuk').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          toggleRuanganOtherInput('', 'containerRuanganOther', 'addJadwalRuanganOther');
          fetchDashboardData();
        }
      }).addSiswaCombined(payload);

      return false;
    }

    function addAbsensiCombined(e) {
      e.preventDefault();
      
      let ttdGuruVal = '';
      let ttdSiswaVal = '';

      if (currentUser.userType === 'guru') {
        ttdGuruVal = getCanvasDataURL('canvasTtdGuru');
        ttdSiswaVal = getCanvasDataURL('canvasTtdSiswa');

        if (!ttdGuruVal || !ttdSiswaVal) {
          alert('Mohon lengkapi kedua Tanda Tangan (Guru & Siswa) sebelum menyimpan absensi!');
          return false;
        }
      } else {
        ttdGuruVal = document.getElementById('absensiTtd').value;
      }

      const payload = {
        namaSiswa: document.getElementById('absensiSiswa').value,
        pertemuanKe: document.getElementById('absensiPertemuanKe').value,
        tanggal: document.getElementById('absensiTanggal').value,
        status: document.getElementById('absensiStatus').value,
        materi: document.getElementById('absensiMateri').value,
        lagu: document.getElementById('absensiLagu').value,
        catatan: document.getElementById('absensiCatatan').value,
        tandaTangan: ttdGuruVal,
        ttdSiswa: ttdSiswaVal,
        guru: currentUser.userName
      };

      google.script.run.withSuccessHandler(res => {
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) {
          if (currentUser.userType === 'guru') {
            clearSignature('canvasTtdGuru');
            clearSignature('canvasTtdSiswa');
          }
          fetchDashboardData();
        }
      }).recordAbsensi(payload);
    }

    function deleteSiswa(nama) {
      if(confirm(`Apakah Anda yakin ingin menghapus siswa "${nama}"?`)) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) fetchDashboardData();
        }).deleteSiswa(nama);
      }
    }

    function deleteJadwal(id) {
      if(confirm('Apakah Anda yakin ingin menghapus jadwal ini?')) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) fetchDashboardData();
        }).deleteJadwal(id);
      }
    }

    function showAlert(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 4000); }
