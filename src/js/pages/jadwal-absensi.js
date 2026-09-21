    function getFilteredJadwal() {
      const filterHari = document.getElementById('filterJadwalHari') ? document.getElementById('filterJadwalHari').value.trim().toLowerCase() : '';
      const filterInst = document.getElementById('filterJadwalInstrumen') ? document.getElementById('filterJadwalInstrumen').value.trim().toLowerCase() : '';
      const filterGuru = document.getElementById('filterJadwalGuru') ? document.getElementById('filterJadwalGuru').value.trim().toLowerCase() : '';
      const adminDashGuruFilter = document.getElementById('adminSelectGuruFilter') ? document.getElementById('adminSelectGuruFilter').value.trim().toLowerCase() : '';

      let listJadwal = globalJadwalList;

      if (adminDashGuruFilter !== '') {
        listJadwal = listJadwal.filter(j => String(j.guru || '').trim().toLowerCase() === adminDashGuruFilter);
      }
      if (filterHari !== '') {
        listJadwal = listJadwal.filter(j => String(j.hari || '').trim().toLowerCase() === filterHari);
      }
      
      if (currentUser.userType === 'admin') {
        if (filterInst !== '') {
          listJadwal = listJadwal.filter(j => String(j.instrumen || '').trim().toLowerCase() === filterInst);
        }
        if (filterGuru !== '') {
          listJadwal = listJadwal.filter(j => String(j.guru || '').trim().toLowerCase() === filterGuru);
        }
      }
      return listJadwal;
    }

    function initCalendar() {
      if (!window.FullCalendar || !window.FullCalendar.Calendar) return;
      const calendarEl = document.getElementById('calendar');
      const compact = window.innerWidth <= 768;
      calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: compact ? 'listWeek' : 'dayGridMonth',
        locale: 'id',
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: compact ? 'listWeek,dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        height: 'auto',
        contentHeight: 'auto',
        expandRows: true,
        dayMaxEvents: compact ? 2 : 4,
        buttonText: {
          today: 'Hari Ini',
          month: 'Bulan',
          week: 'Minggu',
          day: 'Hari'
          ,list: 'Agenda'
        },
        dayHeaderFormat: { weekday: 'short' },
        eventClick: function(info) {
          const jID = info.event.id;
          if (currentUser.userType !== 'siswa') {
            openEditJadwalModal(jID);
          } else {
            alert(`Jadwal Pelajaran:\nSiswa: ${info.event.title}\nJam: ${info.event.extendedProps.jam}\nRuangan: ${info.event.extendedProps.ruangan}\nGuru: ${info.event.extendedProps.guru}`);
          }
        }
      });
      calendarInstance.render();
      renderCalendarEvents();
    }

    function renderCalendarEvents() {
      if(!calendarInstance) return;
      calendarInstance.removeAllEvents();

      const listJadwal = getFilteredJadwal();
      const dayMap = { 'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6 };

      const events = listJadwal.map(j => {
        let dayNum = dayMap[String(j.hari).toLowerCase()];
        let namaDisplayed = j.namaSiswa || currentUser.userName;

        return {
          id: j.jadwalID,
          title: `${namaDisplayed} (${j.instrumen || 'Musik'})`,
          startTime: j.jamMulai + ':00',
          endTime: j.jamSelesai + ':00',
          daysOfWeek: [dayNum],
          backgroundColor: '#F15A24',
          borderColor: '#ea580c',
          extendedProps: {
            jam: `${j.jamMulai} - ${j.jamSelesai}`,
            ruangan: j.ruangan,
            guru: j.guru || '-'
          }
        };
      });

      calendarInstance.addEventSource(events);
    }

    function renderTabelJadwal() {
      const jBody = document.getElementById('jadwalGuruBody'); 
      const thAksi = document.getElementById('thJadwalAksi');
      if(!jBody) return;
      jBody.innerHTML = '';

      const isSiswa = currentUser.userType === 'siswa';
      if (thAksi) thAksi.style.display = isSiswa ? 'none' : 'table-cell';

      const urutanHari = { senin:1, selasa:2, rabu:3, kamis:4, jumat:5, sabtu:6, minggu:7 };
      const listJadwal = [...getFilteredJadwal()].sort((a, b) => {
        const hariA = urutanHari[String(a.hari || '').trim().toLowerCase()] || 99;
        const hariB = urutanHari[String(b.hari || '').trim().toLowerCase()] || 99;
        if (hariA !== hariB) return hariA - hariB;
        const jamA = String(a.jamMulai || '');
        const jamB = String(b.jamMulai || '');
        if (jamA !== jamB) return jamA.localeCompare(jamB, 'id', { numeric:true });
        return String(a.namaSiswa || '').localeCompare(String(b.namaSiswa || ''), 'id');
      });

      if (listJadwal.length === 0) {
        jBody.innerHTML = `<tr class="table-empty-row"><td class="table-empty-cell" colspan="${isSiswa ? 8 : 9}">Belum ada jadwal pelajaran sesuai filter.</td></tr>`;
        return;
      }

      listJadwal.forEach(j => {
        let badgeClass = j.status === 'Cuti' ? 'badge-warning' : (j.status === 'Keluar' ? 'badge-danger' : 'badge-success');
        let namaDisplayed = j.namaSiswa || currentUser.userName;
        let sObj = globalSiswaList.find(s => String(s.nama).trim().toLowerCase() === String(namaDisplayed).trim().toLowerCase());
        let avatarHtml = getSiswaAvatarHtml(namaDisplayed, sObj ? sObj.foto : '');

        let rowHtml = `<tr class="mobile-expand-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false">
          <td data-label="Hari"><b>${escapeTaskHtml(j.hari || '-')}</b></td>
          <td data-label="Jam">${escapeTaskHtml(j.jamMulai || '-')}–${escapeTaskHtml(j.jamSelesai || '-')}</td>
          <td data-label="Selesai">${escapeTaskHtml(j.jamSelesai || '-')}</td>
          <td data-label="Siswa"><div style="display:flex; align-items:center; gap:8px;">${avatarHtml} <span>${escapeTaskHtml(namaDisplayed)}</span></div></td>
          <td data-label="Instrumen"><b>${escapeTaskHtml(j.instrumen || 'Gitar')}</b></td>
          <td data-label="Ruangan">${escapeTaskHtml(j.ruangan || '-')}</td>
          <td data-label="Guru">${escapeTaskHtml(j.guru || '-')}</td>
          <td data-label="Status"><span class="badge ${badgeClass}">${escapeTaskHtml(j.status || 'Aktif')}</span></td>`;
        
        if (!isSiswa) {
          rowHtml += `<td data-label="Aksi"><div class="table-actions">
            <button class="btn-action btn-edit" onclick="openEditJadwalModal('${j.jadwalID}')">Edit</button>
            <button class="btn-action btn-delete" onclick="deleteJadwal('${j.jadwalID}')">Hapus</button>
          </div></td>`;
        }
        rowHtml += `</tr>`;
        jBody.innerHTML += rowHtml;
      });
    }

    function toggleExportMonthHint() {
      const periodEl = document.getElementById('exportPeriodType');
      const hintEl = document.getElementById('exportMonthHint');
      if (!periodEl || !hintEl) return;
      hintEl.style.display = periodEl.value === 'month' ? 'block' : 'none';
    }

    function setupFilterDropdown() {
      const isGuru = currentUser.userType === 'guru';
      const isAdmin = currentUser.userType === 'admin';
      const btnExport = document.getElementById('btnExportDocs');
      const exportPeriodBox = document.getElementById('containerExportPeriod');

      if (isGuru || isAdmin) {
        if (btnExport) btnExport.style.display = 'inline-block';
        if (exportPeriodBox) exportPeriodBox.style.display = 'block';
      } else {
        if (btnExport) btnExport.style.display = 'none';
        if (exportPeriodBox) exportPeriodBox.style.display = 'none';
      }

      // Populasikan Dropdown Filter Bulan dengan urutan terbaru dulu
      const selectMonthEl = document.getElementById('filterRiwayatSelect');
      if (selectMonthEl) {
        const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        const monthMap = new Map();

        globalAbsensiList.forEach(item => {
          if (!item.tanggal) return;
          const parts = String(item.tanggal).split('-');
          if (parts.length !== 3) return;
          const month = parts[1];
          const year = parts[2];
          const monthIndex = parseInt(month, 10) - 1;
          if (monthIndex < 0 || monthIndex > 11) return;
          const sortKey = `${year}-${month}`;
          if (!monthMap.has(sortKey)) {
            monthMap.set(sortKey, {
              value: `${month}-${year}`,
              label: `${monthNames[monthIndex]} ${year}`
            });
          }
        });

        const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        let opt = '<option value="">-- Semua Bulan --</option>';
        sortedMonths.forEach(([, item]) => {
          opt += `<option value="${item.value}">${item.label}</option>`;
        });
        selectMonthEl.innerHTML = opt;
      }

      const filterSiswaContainer = document.getElementById('containerFilterProgressSiswa');
      const filterSiswaEl = document.getElementById('filterProgressSiswa');
      if ((isGuru || isAdmin) && filterSiswaEl && filterSiswaContainer) {
        filterSiswaContainer.style.display = 'block';
        let optS = '<option value="">-- Semua Siswa --</option>';
        globalSiswaList.forEach(s => optS += `<option value="${s.nama}">${s.nama}</option>`);
        filterSiswaEl.innerHTML = optS;
      } else if (filterSiswaContainer) {
        filterSiswaContainer.style.display = 'none';
      }

      if (isAdmin) {
        const filterGuruEl = document.getElementById('filterProgressGuru');
        if (filterGuruEl) {
          let optG = '<option value="">-- Semua Guru --</option>';
          globalGuruList.forEach(g => optG += `<option value="${g.nama}">${g.nama}</option>`);
          filterGuruEl.innerHTML = optG;
        }
      }

      toggleExportMonthHint();
    }

    function renderTabelRiwayat() {
      const tbody = document.getElementById('riwayatAbsensiBody'); 
      const thAksi = document.getElementById('thAbsensiAksi');
      const thTtdSiswa = document.getElementById('thAbsensiTtdSiswa');
      if(!tbody) return;
      tbody.innerHTML = '';

      const isSiswa = currentUser.userType === 'siswa';
      const isGuru = currentUser.userType === 'guru';
      const isAdmin = currentUser.userType === 'admin';

      if (thAksi) thAksi.style.display = isSiswa ? 'none' : 'table-cell';
      if (thTtdSiswa) thTtdSiswa.style.display = isGuru ? 'table-cell' : 'none';

      const filterBulanVal = document.getElementById('filterRiwayatSelect') ? document.getElementById('filterRiwayatSelect').value.trim() : '';
      const filterSiswaVal = (!isSiswa && document.getElementById('filterProgressSiswa')) ? document.getElementById('filterProgressSiswa').value.trim().toLowerCase() : '';
      const filterGuruVal = (isAdmin && document.getElementById('filterProgressGuru')) ? document.getElementById('filterProgressGuru').value.trim().toLowerCase() : '';

      let filteredList = globalAbsensiList.filter(item => {
        if (isAdmin && filterGuruVal !== '') {
          if (String(item.guruCatat || '').trim().toLowerCase() !== filterGuruVal) return false;
        }

        if (!isSiswa && filterSiswaVal !== '') {
          if (String(item.namaSiswa || '').trim().toLowerCase() !== filterSiswaVal) return false;
        }

        if (filterBulanVal !== '') {
          if (!item.tanggal || !item.tanggal.includes(filterBulanVal)) return false;
        }

        return true;
      });

      if (filteredList.length === 0) {
        let colCount = 8;
        if (isGuru) colCount = 10;
        else if (isAdmin) colCount = 9;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center; color:#999; padding:20px;">Belum ada riwayat absensi / progress sesuai filter.</td></tr>`;
        return;
      }

      filteredList.forEach(item => {
        let badgeClass = item.status === 'Masuk' ? 'badge-success' : (item.status === 'Alpa' ? 'badge-danger' : 'badge-warning');
        let displayName = item.namaSiswa || currentUser.userName;

        let ttdGuruHtml = item.tandaTangan || '-';
        if (item.tandaTangan && item.tandaTangan.startsWith('data:image')) {
          ttdGuruHtml = `<img src="${item.tandaTangan}" class="sig-img-preview" alt="TTD Guru">`;
        }

        let ttdSiswaHtml = item.ttdSiswa || '-';
        if (item.ttdSiswa && item.ttdSiswa.startsWith('data:image')) {
          ttdSiswaHtml = `<img src="${item.ttdSiswa}" class="sig-img-preview" alt="TTD Siswa">`;
        }

        let rowHtml = `<tr class="mobile-expand-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false">
          <td data-label="Tanggal">${escapeTaskHtml(item.tanggal || '-')}</td>
          <td data-label="Pertemuan">Ke-${escapeTaskHtml(item.pertemuanKe || '-')}</td>
          <td data-label="Siswa"><b>${escapeTaskHtml(displayName)}</b></td>
          <td data-label="Status"><span class="badge ${badgeClass}">${escapeTaskHtml(item.status || '-')}</span></td>
          <td data-label="Materi">${escapeTaskHtml(item.materi||'-')}</td>
          <td data-label="Lagu">${escapeTaskHtml(item.lagu||'-')}</td>
          <td data-label="TTD Guru">${ttdGuruHtml}</td>`;
        
        if (isGuru) {
          rowHtml += `<td data-label="TTD Siswa">${ttdSiswaHtml}</td>`;
        }

        rowHtml += `<td data-label="Catatan">${escapeTaskHtml(item.catatan||'-')}</td>`;
        
        if (!isSiswa) {
          rowHtml += `<td data-label="Aksi">
            <button class="btn-action btn-edit" onclick="openEditAbsensiModal('${item.absensiID}')">Edit</button>
            <button class="btn-action btn-delete" onclick="deleteAbsensi('${item.absensiID}')">Hapus</button>
          </td>`;
        }
        rowHtml += `</tr>`;
        tbody.innerHTML += rowHtml;
      });
    }

    function parseAbsensiRecordDate(value) {
      const text = String(value || '').trim();
      let match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
      if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
    }

    function getAbsensiReportData() {
      const student = String(document.getElementById('filterProgressSiswa')?.value || '').trim().toLowerCase();
      const teacher = currentUser.userType === 'admin' ? String(document.getElementById('filterProgressGuru')?.value || '').trim().toLowerCase() : '';
      const month = String(document.getElementById('filterRiwayatSelect')?.value || '').trim();
      const periodType = month ? 'month' : String(document.getElementById('exportPeriodType')?.value || '3months');
      const startThreeMonths = new Date();
      startThreeMonths.setDate(1); startThreeMonths.setMonth(startThreeMonths.getMonth() - 2); startThreeMonths.setHours(0,0,0,0);
      return globalAbsensiList.filter(item => {
        if (student && String(item.namaSiswa || '').trim().toLowerCase() !== student) return false;
        if (teacher && String(item.guruCatat || '').trim().toLowerCase() !== teacher) return false;
        if (month && !String(item.tanggal || '').includes(month)) return false;
        if (!month && periodType === '3months') {
          const date = parseAbsensiRecordDate(item.tanggal);
          if (!date || date < startThreeMonths) return false;
        }
        return true;
      });
    }

    function printAbsensiReport() {
      if (currentUser.userType === 'siswa') { showAlert('alertDanger', 'Cetak laporan hanya tersedia untuk guru dan admin.'); return; }
      const records = getAbsensiReportData();
      if (!records.length) { showAlert('alertDanger', 'Tidak ada data Absensi pada filter dan periode yang dipilih.'); return; }
      const printWindow = window.open('', '_blank', 'width=1000,height=760');
      if (!printWindow) { showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk mencetak laporan.'); return; }
      printWindow.document.write('<!doctype html><html><body style="font-family:Arial;padding:32px;color:#64748b">Menyiapkan laporan Absensi...</body></html>');
      google.script.run.withSuccessHandler(response => {
        buildAbsensiPrintWindow(records, printWindow, response && response.success ? response.dataUrl : '');
      }).withFailureHandler(() => buildAbsensiPrintWindow(records, printWindow, '')).getLearningProgressPrintLogo();
    }

    function buildAbsensiPrintWindow(records, printWindow, logoDataUrl) {
      const studentFilter = document.getElementById('filterProgressSiswa')?.value || 'Semua Siswa';
      const teacherFilter = currentUser.userType === 'admin' ? (document.getElementById('filterProgressGuru')?.value || 'Semua Guru') : currentUser.userName;
      const monthSelect = document.getElementById('filterRiwayatSelect');
      const selectedMonth = monthSelect?.value ? monthSelect.options[monthSelect.selectedIndex].text : '';
      const periodType = document.getElementById('exportPeriodType')?.value || '3months';
      const periodLabel = selectedMonth || (periodType === 'all' ? 'Semua Riwayat' : '3 Bulan Terakhir');
      const present = records.filter(item => item.status === 'Masuk').length;
      const rows = records.map((item, index) => {
        const signature = value => value && String(value).startsWith('data:image') ? `<img src="${value}" alt="Tanda tangan">` : escapeTaskHtml(value || '-');
        return `<tr><td class="center">${index + 1}</td><td>${escapeTaskHtml(item.tanggal || '-')}</td><td class="center">${escapeTaskHtml(item.pertemuanKe || '-')}</td><td><b>${escapeTaskHtml(item.namaSiswa || '-')}</b></td><td class="center">${escapeTaskHtml(item.status || '-')}</td><td>${escapeTaskHtml(item.materi || '-')}</td><td>${escapeTaskHtml(item.lagu || '-')}</td><td>${escapeTaskHtml(item.catatan || '-')}</td><td class="signature">${signature(item.tandaTangan)}</td><td class="signature">${signature(item.ttdSiswa)}</td></tr>`;
      }).join('');
      const report = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Materi dan Absensi</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17232d;margin:0;font-size:8.5px}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f15a24;padding-bottom:8px;margin-bottom:10px;min-height:66px}.brand-logo{width:118px;height:64px;object-fit:contain;object-position:left center}.brand h1{font-size:18px;margin:0 0 4px}.orange{color:#f15a24}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:9px}.meta div,.summary{background:#fff7f2;border:1px solid #fed9c6;border-radius:7px;padding:7px}.meta span{display:block;color:#7b8aa0;font-size:7px;text-transform:uppercase;margin-bottom:2px}.summary{display:flex;gap:20px;align-items:center;margin-bottom:9px}.summary b{color:#f15a24;font-size:15px}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#f15a24;color:#fff;padding:6px 4px;text-align:left;font-size:7.5px}td{border:1px solid #dfe6ee;padding:5px 4px;vertical-align:top;line-height:1.3;word-wrap:break-word}th:nth-child(1){width:3%}th:nth-child(2){width:7%}th:nth-child(3){width:5%}th:nth-child(4){width:12%}th:nth-child(5){width:7%}th:nth-child(6){width:17%}th:nth-child(7){width:12%}th:nth-child(8){width:17%}th:nth-child(9),th:nth-child(10){width:10%}.center{text-align:center}.signature{text-align:center}.signature img{max-width:70px;max-height:30px;object-fit:contain}.footer{margin-top:9px;padding-top:6px;border-top:1px solid #e8edf2;color:#94a3b8;font-size:7px;text-align:right}@media print{button{display:none}tr{page-break-inside:avoid}}</style></head><body><div class="brand"><div>${logoDataUrl ? `<img class="brand-logo" src="${logoDataUrl}" alt="Legacy Music Center">` : '<b class="orange">LEGACY MUSIC CENTER</b>'}</div><div style="text-align:right"><h1>Laporan Materi & Progress</h1><b class="orange">Absensi Siswa</b></div></div><div class="meta"><div><span>Siswa</span><b>${escapeTaskHtml(studentFilter)}</b></div><div><span>Guru</span><b>${escapeTaskHtml(teacherFilter)}</b></div><div><span>Periode</span><b>${escapeTaskHtml(periodLabel)}</b></div><div><span>Tanggal Cetak</span><b>${new Date().toLocaleDateString('id-ID')}</b></div></div><div class="summary"><span>Total Pertemuan <b>${records.length}</b></span><span>Hadir <b>${present}</b></span><span>Tidak Hadir <b>${records.length - present}</b></span></div><table><thead><tr><th>No</th><th>Tanggal</th><th>Ke</th><th>Siswa</th><th>Status</th><th>Materi</th><th>Lagu</th><th>Catatan / Tugas</th><th>TTD Guru</th><th>TTD Siswa</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Dokumen resmi Legacy Music Center • Dicetak dari sistem Materi & Progress</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),650));<\/script></body></html>`;
      const printReadyReport = report.replace('<style>', '<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}');
      printWindow.document.open(); printWindow.document.write(printReadyReport); printWindow.document.close();
    }

    function openEditAbsensiModal(absensiID) {
      const item = globalAbsensiList.find(a => String(a.absensiID).trim() === String(absensiID).trim());
      if (!item) return;
      document.getElementById('editAbsensiID').value = item.absensiID;
      document.getElementById('editAbsensiNamaSiswa').value = item.namaSiswa;
      document.getElementById('editAbsensiPertemuanKe').value = item.pertemuanKe;
      document.getElementById('editAbsensiTanggal').value = item.tanggal;
      document.getElementById('editAbsensiStatus').value = item.status;
      document.getElementById('editAbsensiMateri').value = item.materi || '';
      document.getElementById('editAbsensiLagu').value = item.lagu || '';
      document.getElementById('editAbsensiCatatan').value = item.catatan || '';
      
      if (currentUser.userType === 'guru') {
        document.getElementById('modalTtdGuruContainer').style.display = 'block';
        document.getElementById('modalTtdLegacyContainer').style.display = 'none';
        clearSignature('canvasEditTtdGuru');
        clearSignature('canvasEditTtdSiswa');
      } else {
        document.getElementById('modalTtdGuruContainer').style.display = 'none';
        document.getElementById('modalTtdLegacyContainer').style.display = 'block';
        document.getElementById('editAbsensiTtd').value = item.tandaTangan || currentUser.userName;
      }

      document.getElementById('modalEditAbsensi').style.display = 'flex';

      if (currentUser.userType === 'guru') {
        setTimeout(() => {
          ['canvasEditTtdGuru', 'canvasEditTtdSiswa'].forEach(id => {
            const canvas = sigCanvases[id]?.canvas;
            if (canvas) {
              resizeSignaturePad(id);
            }
          });
        }, 150);
      }
    }

    function closeEditAbsensiModal() { document.getElementById('modalEditAbsensi').style.display = 'none'; }

    function handleUpdateAbsensi(e) {
      e.preventDefault();
      
      let ttdGuruVal = '';
      let ttdSiswaVal = '';

      if (currentUser.userType === 'guru') {
        ttdGuruVal = getCanvasDataURL('canvasEditTtdGuru');
        ttdSiswaVal = getCanvasDataURL('canvasEditTtdSiswa');

        const absensiID = document.getElementById('editAbsensiID').value;
        const currentItem = globalAbsensiList.find(a => String(a.absensiID).trim() === String(absensiID).trim());
        if (!ttdGuruVal && currentItem) ttdGuruVal = currentItem.tandaTangan;
        if (!ttdSiswaVal && currentItem) ttdSiswaVal = currentItem.ttdSiswa;
      } else {
        ttdGuruVal = document.getElementById('editAbsensiTtd').value;
      }

      const payload = {
        absensiID: document.getElementById('editAbsensiID').value,
        namaSiswa: document.getElementById('editAbsensiNamaSiswa').value,
        pertemuanKe: document.getElementById('editAbsensiPertemuanKe').value,
        tanggal: document.getElementById('editAbsensiTanggal').value,
        status: document.getElementById('editAbsensiStatus').value,
        materi: document.getElementById('editAbsensiMateri').value,
        lagu: document.getElementById('editAbsensiLagu').value,
        catatan: document.getElementById('editAbsensiCatatan').value,
        tandaTangan: ttdGuruVal,
        ttdSiswa: ttdSiswaVal
      };

      google.script.run.withSuccessHandler(res => {
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) { closeEditAbsensiModal(); fetchDashboardData(); }
      }).updateAbsensi(payload);
    }

    function deleteAbsensi(id) {
      if(confirm('Apakah Anda yakin ingin menghapus absensi ini?')) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) fetchDashboardData();
        }).deleteAbsensi(id);
      }
    }

