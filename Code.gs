const ss = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  checkAndSetupSheets(); 
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle('Legacy Music Center')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function checkAndSetupSheets() {
  try {
    const sheets = [
      {
        name: 'Siswa',
        headers: ['Nama', 'Grade', 'Email', 'Password', 'NoHP', 'TglDaftar', 'Status', 'FotoURL', 'Instrumen', 'Guru', 'TglKeluar']
      },
      {
        name: 'Guru',
        headers: ['GuruID', 'Nama', 'Email', 'Password', 'NoHP', 'Instrumen', 'Status', 'FotoURL']
      },
      {
        name: 'Admin',
        headers: ['AdminID', 'Nama', 'Email', 'Password', 'NoHP', 'FotoURL']
      },
      {
        name: 'Jadwal',
        headers: ['JadwalID', 'NamaSiswa', 'Hari', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'Instrumen']
      },
      {
        name: 'Absensi',
        headers: ['AbsensiID', 'NamaSiswa', 'Tanggal', 'PertemuanKe', 'Status', 'Materi', 'Lagu', 'Catatan', 'TandaTangan', 'GuruCatat', 'TtdSiswa']
      },
      {
        name: 'Tugas',
        headers: ['TugasID', 'NamaSiswa', 'JudulTugas', 'Deskripsi', 'Deadline', 'FileMateriUrl', 'Status', 'TanggalKirim', 'FileJawabanUrl', 'FileJawabanName', 'Guru', 'TipeTugas', 'FileMateriName', 'FileMateriType', 'FileMateriDownloadUrl', 'LampiranJSON', 'JawabanTeks', 'FileJawabanType', 'FileJawabanDownloadUrl', 'JawabanJSON', 'TanggalDibuat', 'YouTubeUrl']
      },
      {
        name: 'ProgressBelajar',
        headers: ['ProgressID', 'NamaSiswa', 'Kelas', 'Level', 'Periode', 'OverallProgress', 'MateriStatus', 'MateriProgress', 'MateriCatatan', 'TeknikStatus', 'TeknikProgress', 'TeknikCatatan', 'TeoriStatus', 'TeoriProgress', 'TeoriCatatan', 'RepertoireStatus', 'RepertoireProgress', 'RepertoireCatatan', 'PracticeStatus', 'PracticeProgress', 'PracticeCatatan', 'PerformanceStatus', 'PerformanceProgress', 'PerformanceCatatan', 'EvaluasiStatus', 'EvaluasiProgress', 'EvaluasiCatatan', 'Kelebihan', 'PerluDitingkatkan', 'TargetBerikutnya', 'Guru', 'LastUpdated', 'TipePeriode', 'GuruSignatureUrl', 'GuruSignatureName', 'KepalaSekolahNama', 'KepalaSekolahSignatureUrl', 'KepalaSekolahSignatureName', 'PeriodeMulai', 'PeriodeSelesai']
      },
      {
        name: 'JadwalPengganti',
        headers: ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada']
      },
      {
        name: 'Pengumuman',
        headers: ['PengumumanID', 'Judul', 'Target', 'TargetDetail', 'Isi', 'Pembuat', 'TanggalKirim', 'Status']
      },
      {
        name: 'RiwayatSiswa',
        headers: ['RiwayatID', 'NamaSiswa', 'Jenis', 'Tanggal', 'StatusSebelum', 'StatusSesudah', 'Instrumen', 'Guru', 'Keterangan']
      }
    ];

    sheets.forEach(sh => {
      let sheet = ss.getSheetByName(sh.name);
      if (!sheet) {
        sheet = ss.insertSheet(sh.name);
        sheet.appendRow(sh.headers);
        sheet.getRange(1, 1, 1, sh.headers.length).setFontWeight('bold');
        if (sh.name === 'Admin') {
          sheet.appendRow(['ADM-001', 'Admin Utama', 'admin@legacymusic.com', 'admin123', '08123456789', '']);
        }
      } else {
        const lastCol = sheet.getLastColumn();
        if (lastCol > 0) {
          const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
          if (sh.name === 'Absensi' && !currentHeaders.includes('TtdSiswa')) {
            sheet.getRange(1, lastCol + 1).setValue('TtdSiswa').setFontWeight('bold');
          }
          if (sh.name === 'Siswa' || sh.name === 'Tugas' || sh.name === 'ProgressBelajar' || sh.name === 'JadwalPengganti' || sh.name === 'Pengumuman' || sh.name === 'RiwayatSiswa') {
            sh.headers.forEach(header => {
              if (!currentHeaders.includes(header)) {
                sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header).setFontWeight('bold');
                currentHeaders.push(header);
              }
            });
          }
        }
      }
    });
  } catch(e) {
    Logger.log("Setup error: " + e.toString());
  }
}

function verifyLogin(userType, username, password) {
  try {
    userType = String(userType || '').trim().toLowerCase();
    username = String(username || '').trim();
    
    let sheetName = 'Siswa';
    if (userType === 'guru') sheetName = 'Guru';
    if (userType === 'admin') sheetName = 'Admin';

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Database belum tersedia.' };

    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (userType === 'admin') {
        const adminID = String(data[i][0] || '').trim();
        const adminNama = String(data[i][1] || '').trim();
        const pass = String(data[i][3] || '');

        if ((adminID.toLowerCase() === username.toLowerCase() || adminNama.toLowerCase() === username.toLowerCase()) && pass === password) {
          return { success: true, userID: adminID, userName: adminNama, userType: 'admin' };
        }
      } else if (userType === 'guru') {
        const guruID = String(data[i][0] || '').trim();
        const guruNama = String(data[i][1] || '').trim();
        const pass = String(data[i][3] || '');
        const status = String(data[i][6] || 'Aktif').trim();

        if ((guruID.toLowerCase() === username.toLowerCase() || guruNama.toLowerCase() === username.toLowerCase()) && pass === password) {
          if (status && status.toLowerCase() !== 'aktif') return { success: false, message: 'Akun Anda tidak aktif.' };
          // Nama guru menjadi identitas cadangan bila GuruID pada data lama masih kosong.
          // Dengan demikian dashboard tidak pernah mencari guru menggunakan nilai kosong.
          return { success: true, userID: guruID || guruNama, userName: guruNama, userType: 'guru' };
        }
      } else {
        const uName = String(data[i][0] || '').trim();
        const pass = String(data[i][3] || '');
        const status = String(data[i][6] || 'Aktif').trim();

        if (uName.toLowerCase() === username.toLowerCase() && pass === password) {
          if (status && status.toLowerCase() !== 'aktif') return { success: false, message: 'Akun tidak aktif.' };
          return { success: true, userID: uName, userName: uName, userType: 'siswa' };
        }
      }
    }
    return { success: false, message: 'Username / Password salah.' };
  } catch (e) { return { success: false, message: 'Error: ' + e.toString() }; }
}

function getDashboardData(userID, userType) {
  try {
    if (userType === 'admin') {
      cleanupOrphanStudentSchedules_();
      return serializeDashboardData(getAdminDashboardData(userID));
    }
    if (userType === 'guru') {
      cleanupOrphanStudentSchedules_();
      return serializeDashboardData(getGuruDashboardData(userID));
    }

    // DASHBOARD SISWA
    const siswaSheet = ss.getSheetByName('Siswa');
    const jadwalSheet = ss.getSheetByName('Jadwal');
    const absensiSheet = ss.getSheetByName('Absensi');

    const siswaData = siswaSheet.getDataRange().getValues();
    let siswaInfo = null;

    for (let i = 1; i < siswaData.length; i++) {
      if (String(siswaData[i][0]).toLowerCase() === String(userID).toLowerCase()) {
        siswaInfo = { 
          nama: siswaData[i][0], 
          kelas: siswaData[i][1], 
          email: siswaData[i][2], 
          noHp: siswaData[i][4], 
          instrumen: siswaData[i][8] || 'Gitar',
          foto: siswaData[i][7] || '',
          guru: siswaData[i][9] || ''
        };
        break;
      }
    }

    const schedules = [];
    const jData = jadwalSheet ? jadwalSheet.getDataRange().getValues() : [];
    for (let i = 1; i < jData.length; i++) {
      if (String(jData[i][1]).toLowerCase() === String(userID).toLowerCase() && String(jData[i][7] || 'Aktif').toLowerCase() === 'aktif') {
        schedules.push({ 
          jadwalID: jData[i][0],
          namaSiswa: jData[i][1],
          hari: jData[i][2], 
          jamMulai: formatTime(jData[i][3]), 
          jamSelesai: formatTime(jData[i][4]), 
          guru: jData[i][5], 
          ruangan: jData[i][6],
          instrumen: jData[i][8] || 'Gitar'
        });
      }
    }

    let hadirBulanIni = 0;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const absensiList = [];
    if (absensiSheet) {
      const aData = absensiSheet.getDataRange().getValues();
      for (let i = 1; i < aData.length; i++) {
        if (String(aData[i][1]).toLowerCase() === String(userID).toLowerCase()) {
          const tglFormatted = formatDateOnly(aData[i][2]);
          const statusAbsensi = String(aData[i][4]).toLowerCase();

          if (aData[i][2]) {
            let recordDate = null;
            if (aData[i][2] instanceof Date) {
              recordDate = aData[i][2];
            } else if (typeof aData[i][2] === 'string') {
              const parts = aData[i][2].split('-');
              if (parts.length === 3) {
                recordDate = new Date(parts[2], parseInt(parts[1], 10) - 1, parts[0]);
              }
            }
            
            if (recordDate && recordDate.getMonth() + 1 === currentMonth && recordDate.getFullYear() === currentYear) {
              if (statusAbsensi === 'masuk') {
                hadirBulanIni++;
              }
            }
          }

          absensiList.push({
            absensiID: aData[i][0],
            namaSiswa: aData[i][1],
            tanggal: tglFormatted,
            pertemuanKe: aData[i][3],
            status: aData[i][4],
            materi: aData[i][5],
            lagu: aData[i][6],
            catatan: aData[i][7],
            tandaTangan: aData[i][8],
            guruCatat: aData[i][9] || '',
            ttdSiswa: aData[i][10] || ''
          });
        }
      }
    }

    return serializeDashboardData({
      success: true, 
      userType: 'siswa', 
      siswaInfo: siswaInfo, 
      schedules: schedules, 
      absensiList: absensiList.reverse(), 
      absensiProgress: { hadir: hadirBulanIni, total: 4 },
      tugasList: getTugasData(userID, 'siswa'),
      learningProgressList: getLearningProgressData(userID, 'siswa'),
      jadwalPenggantiList: getJadwalPenggantiData(userID, 'siswa'),
      pengumumanList: getPengumumanData(userID, 'siswa')
    });

  } catch (e) { return serializeDashboardData({ success: false, error: e.toString() }); }
}

function serializeDashboardData(data) {
  try {
    return JSON.stringify(data || { success: false, error: 'Data dashboard kosong.' }, function(key, value) {
      if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
      if (typeof value === 'number' && !isFinite(value)) return 0;
      return value;
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: 'Data dashboard tidak dapat diproses: ' + e.toString() });
  }
}

function getAdminDashboardData(userID) {
  try {
    const adminSheet = ss.getSheetByName('Admin');
    const siswaSheet = ss.getSheetByName('Siswa');
    const jadwalSheet = ss.getSheetByName('Jadwal');
    const absensiSheet = ss.getSheetByName('Absensi');

    const adminData = adminSheet ? adminSheet.getDataRange().getValues() : [];
    let adminInfo = null;
    for (let i = 1; i < adminData.length; i++) {
      if (String(adminData[i][0]).toLowerCase() === String(userID).toLowerCase() || String(adminData[i][1]).toLowerCase() === String(userID).toLowerCase()) {
        adminInfo = { userID: adminData[i][0], nama: adminData[i][1], email: adminData[i][2], noHp: adminData[i][4] || '', foto: adminData[i][5] || '' };
        break;
      }
    }

    const siswaList = [];
    const sData = siswaSheet ? siswaSheet.getDataRange().getValues() : [];
    for (let i = 1; i < sData.length; i++) {
      siswaList.push({ 
        nama: String(sData[i][0]).trim(), kelas: sData[i][1], email: sData[i][2], noHp: sData[i][4], 
        status: String(sData[i][6]).trim(), foto: sData[i][7] || '', instrumen: sData[i][8] || 'Gitar', guru: sData[i][9] || '-',
        tglDaftar: normalizeAcademyDate(sData[i][5]), tglKeluar: normalizeAcademyDate(sData[i][10])
      });
    }
    const siswaNamaAktifSet = new Set(siswaList.map(item => String(item.nama || '').trim().toLowerCase()).filter(Boolean));

    const guruList = getGuruList();
    const jadwal = [];
    const jData = jadwalSheet ? jadwalSheet.getDataRange().getValues() : [];
    for (let i = 1; i < jData.length; i++) {
      const namaSiswaJadwal = String(jData[i][1] || '').trim();
      if (!siswaNamaAktifSet.has(namaSiswaJadwal.toLowerCase())) continue;
      jadwal.push({ 
        jadwalID: jData[i][0], namaSiswa: namaSiswaJadwal, hari: jData[i][2], 
        jamMulai: formatTime(jData[i][3]), jamSelesai: formatTime(jData[i][4]), 
        guru: jData[i][5], ruangan: jData[i][6], status: jData[i][7] || 'Aktif', instrumen: jData[i][8] || 'Gitar'
      });
    }

    const absensiList = [];
    if (absensiSheet) {
      const aData = absensiSheet.getDataRange().getValues();
      for (let i = 1; i < aData.length; i++) {
        absensiList.push({
          absensiID: aData[i][0],
          namaSiswa: aData[i][1],
          tanggal: formatDateOnly(aData[i][2]),
          pertemuanKe: aData[i][3],
          status: aData[i][4],
          materi: aData[i][5],
          lagu: aData[i][6],
          catatan: aData[i][7],
          tandaTangan: aData[i][8],
          guruCatat: aData[i][9] || '',
          ttdSiswa: aData[i][10] || ''
        });
      }
    }

    return {
      success: true, userType: 'admin', adminInfo: adminInfo, siswaList: siswaList, guruList: guruList, jadwal: jadwal,
      absensiList: absensiList.reverse(),
      learningProgressList: getLearningProgressData(userID, 'admin'),
      jadwalPenggantiList: getJadwalPenggantiData(userID, 'admin'),
      pengumumanList: getPengumumanData(userID, 'admin'),
      studentHistory: getStudentMovementData(),
      stats: {
        totalSiswa: siswaList.length,
        siswaAktif: siswaList.filter(s => String(s.status).toLowerCase() === 'aktif').length,
        siswaCuti: siswaList.filter(s => String(s.status).toLowerCase() === 'cuti').length,
        siswaKeluar: siswaList.filter(s => String(s.status).toLowerCase() === 'keluar').length,
        totalGuru: guruList.length
      }
    };
  } catch(e) { return { error: e.toString() }; }
}

function getGuruDashboardData(userID) {
  try {
    const guruSheet = ss.getSheetByName('Guru');
    const siswaSheet = ss.getSheetByName('Siswa');
    const jadwalSheet = ss.getSheetByName('Jadwal');
    const absensiSheet = ss.getSheetByName('Absensi');

    const guruData = guruSheet ? guruSheet.getDataRange().getValues() : [];
    let guruInfo = null;
    let namaGuruAktif = '';

    const guruKey = String(userID || '').trim().toLowerCase();
    for (let i = 1; i < guruData.length; i++) {
      const rowGuruID = String(guruData[i][0] || '').trim().toLowerCase();
      const rowGuruNama = String(guruData[i][1] || '').trim().toLowerCase();
      if ((rowGuruID && rowGuruID === guruKey) || (rowGuruNama && rowGuruNama === guruKey)) {
        guruInfo = { 
          userID: guruData[i][0] || guruData[i][1], nama: guruData[i][1], email: guruData[i][2], noHp: guruData[i][4] || '', 
          instrumen: guruData[i][5] || 'Gitar', foto: guruData[i][7] || '' 
        };
        namaGuruAktif = guruData[i][1];
        break;
      }
    }

    if (!namaGuruAktif) namaGuruAktif = userID;

    const siswaList = [];
    const siswaNamaSet = new Set();
    const semuaSiswaNamaSet = new Set();
    const sData = siswaSheet ? siswaSheet.getDataRange().getValues() : [];
    for (let i = 1; i < sData.length; i++) {
      const semuaSiswaNama = String(sData[i][0] || '').trim();
      if (semuaSiswaNama) semuaSiswaNamaSet.add(semuaSiswaNama.toLowerCase());
      const guruSiswa = String(sData[i][9] || '').trim();
      if (!guruSiswa || guruSiswa.toLowerCase() === namaGuruAktif.toLowerCase()) {
        const sNama = String(sData[i][0]).trim();
        siswaNamaSet.add(sNama.toLowerCase());
        siswaList.push({ 
          nama: sNama, kelas: sData[i][1], email: sData[i][2], noHp: sData[i][4], 
          status: String(sData[i][6]).trim(), foto: sData[i][7] || '', instrumen: sData[i][8] || 'Gitar', guru: guruSiswa
        });
      }
    }

    const daysNameMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayHariName = daysNameMap[new Date().getDay()].toLowerCase();

    let sesiJadwalHariIniCount = 0;
    const jadwal = [];
    const jData = jadwalSheet ? jadwalSheet.getDataRange().getValues() : [];
    for (let i = 1; i < jData.length; i++) {
      const guruJadwal = String(jData[i][5] || '').trim();
      if (guruJadwal.toLowerCase() === namaGuruAktif.toLowerCase()) {
        const namaSiswa = String(jData[i][1]).trim();
        if (!semuaSiswaNamaSet.has(namaSiswa.toLowerCase())) continue;
        const statusJadwal = String(jData[i][7] || 'Aktif').trim();
        const hariJadwal = String(jData[i][2] || '').trim().toLowerCase();
        
        if (statusJadwal === 'Aktif' && hariJadwal === todayHariName) {
          sesiJadwalHariIniCount++;
        }
        
        jadwal.push({ 
          jadwalID: jData[i][0], namaSiswa: namaSiswa, hari: jData[i][2], 
          jamMulai: formatTime(jData[i][3]), jamSelesai: formatTime(jData[i][4]), 
          guru: jData[i][5], ruangan: jData[i][6], status: statusJadwal, instrumen: jData[i][8] || 'Gitar'
        });
      }
    }

    const absensiList = [];
    if (absensiSheet) {
      const aData = absensiSheet.getDataRange().getValues();
      for (let i = 1; i < aData.length; i++) {
        const sNama = String(aData[i][1]).trim().toLowerCase();
        const guruCatat = String(aData[i][9] || '').trim().toLowerCase();
        if (guruCatat === namaGuruAktif.toLowerCase() || siswaNamaSet.has(sNama)) {
          absensiList.push({
            absensiID: aData[i][0], 
            namaSiswa: aData[i][1], 
            tanggal: formatDateOnly(aData[i][2]),
            pertemuanKe: aData[i][3], 
            status: aData[i][4], 
            materi: aData[i][5], 
            lagu: aData[i][6], 
            catatan: aData[i][7], 
            tandaTangan: aData[i][8],
            guruCatat: aData[i][9] || '',
            ttdSiswa: aData[i][10] || ''
          });
        }
      }
    }

    return {
      success: true, userType: 'guru', guruInfo: guruInfo, siswaList: siswaList, jadwal: jadwal,
      absensiList: absensiList.reverse(),
      stats: { totalSiswa: siswaList.length, sesiJadwalAktif: sesiJadwalHariIniCount },
      tugasList: getTugasData(namaGuruAktif, 'guru'),
      learningProgressList: getLearningProgressData(namaGuruAktif, 'guru'),
      jadwalPenggantiList: getJadwalPenggantiData(namaGuruAktif, 'guru'),
      pengumumanList: getPengumumanData(namaGuruAktif, 'guru')
    };
  } catch (e) { return { error: e.toString() }; }
}

function getGuruList() {
  try {
    const sheet = ss.getSheetByName('Guru');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const guruList = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][1]) {
        guruList.push({ id: data[i][0], nama: data[i][1], instrumen: data[i][5] || 'Gitar', foto: data[i][7] || '' });
      }
    }
    return guruList;
  } catch(e) { return []; }
}

function addGuru(payload, requesterType) {
  try {
    if (String(requesterType || '').trim().toLowerCase() !== 'admin') {
      return { success: false, message: 'Hanya admin yang dapat menambahkan guru.' };
    }

    payload = payload || {};
    const nama = String(payload.nama || '').trim();
    const email = String(payload.email || '').trim();
    const password = String(payload.password || '');
    const noHp = String(payload.noHp || '').trim();
    const instrumen = String(payload.instrumen || '').trim();
    const status = String(payload.status || 'Aktif').trim();
    let guruID = String(payload.guruID || '').trim().toUpperCase();

    if (!nama) return { success: false, message: 'Nama guru wajib diisi.' };
    if (!password) return { success: false, message: 'Password guru wajib diisi.' };
    if (!instrumen) return { success: false, message: 'Kelas / instrumen wajib dipilih.' };

    const sheet = ensureAcademySheet('Guru', ['GuruID', 'Nama', 'Email', 'Password', 'NoHP', 'Instrumen', 'Status', 'FotoURL']);
    const data = sheet.getDataRange().getValues();
    const namaKey = nama.toLowerCase();
    const emailKey = email.toLowerCase();

    if (!guruID) guruID = 'GRU-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();

    for (let i = 1; i < data.length; i++) {
      const existingID = String(data[i][0] || '').trim().toUpperCase();
      const existingName = String(data[i][1] || '').trim().toLowerCase();
      const existingEmail = String(data[i][2] || '').trim().toLowerCase();
      if (existingID && existingID === guruID) return { success: false, message: 'Guru ID sudah digunakan.' };
      if (existingName && existingName === namaKey) return { success: false, message: 'Nama guru sudah terdaftar.' };
      if (emailKey && existingEmail === emailKey) return { success: false, message: 'Email guru sudah terdaftar.' };
    }

    sheet.appendRow([guruID, nama, email, password, noHp, instrumen, status, '']);
    SpreadsheetApp.flush();
    return { success: true, message: 'Guru ' + nama + ' berhasil ditambahkan.', guruID: guruID };
  } catch (e) {
    return { success: false, message: 'Gagal menambahkan guru: ' + e.toString() };
  }
}

function ensureLearningProgressSheet() {
  const headers = ['ProgressID', 'NamaSiswa', 'Kelas', 'Level', 'Periode', 'OverallProgress', 'MateriStatus', 'MateriProgress', 'MateriCatatan', 'TeknikStatus', 'TeknikProgress', 'TeknikCatatan', 'TeoriStatus', 'TeoriProgress', 'TeoriCatatan', 'RepertoireStatus', 'RepertoireProgress', 'RepertoireCatatan', 'PracticeStatus', 'PracticeProgress', 'PracticeCatatan', 'PerformanceStatus', 'PerformanceProgress', 'PerformanceCatatan', 'EvaluasiStatus', 'EvaluasiProgress', 'EvaluasiCatatan', 'Kelebihan', 'PerluDitingkatkan', 'TargetBerikutnya', 'Guru', 'LastUpdated', 'TipePeriode', 'GuruSignatureUrl', 'GuruSignatureName', 'KepalaSekolahNama', 'KepalaSekolahSignatureUrl', 'KepalaSekolahSignatureName', 'PeriodeMulai', 'PeriodeSelesai'];
  let sheet = ss.getSheetByName('ProgressBelajar');
  if (!sheet) {
    sheet = ss.insertSheet('ProgressBelajar');
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#F15A24').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    return sheet;
  }
  const lastCol = sheet.getLastColumn();
  const currentHeaders = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  headers.forEach(header => {
    if (!currentHeaders.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header).setFontWeight('bold');
      currentHeaders.push(header);
    }
  });
  return sheet;
}

function formatLearningProgressPeriod(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
  }
  const text = String(value).trim();
  if (/^\d{4}-Q[1-4]$/i.test(text)) return text.toUpperCase();
  if (/^\d{4}-\d{2}~\d{4}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{4})[-\/](\d{1,2})/);
  return match ? match[1] + '-' + String(match[2]).padStart(2, '0') : text;
}

function getLearningProgressData(identifier, userType) {
  const list = [];
  try {
    const sheet = ensureLearningProgressSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return list;
    const headers = data[0].map(h => String(h || '').trim());
    const col = {};
    headers.forEach((header, index) => col[header] = index);
    const getValue = (row, header, fallback) => {
      const index = col[header];
      return index === undefined || row[index] === '' || row[index] === null ? fallback : row[index];
    };
    const normalizedRole = String(userType || '').toLowerCase();
    const normalizedIdentifier = String(identifier || '').trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const student = String(getValue(row, 'NamaSiswa', '')).trim();
      const teacher = String(getValue(row, 'Guru', '')).trim();
      if (!student) continue;
      const allowed = normalizedRole === 'admin' ||
        (normalizedRole === 'guru' && teacher.toLowerCase() === normalizedIdentifier) ||
        (normalizedRole === 'siswa' && student.toLowerCase() === normalizedIdentifier);
      if (!allowed) continue;

      const lastUpdatedRaw = getValue(row, 'LastUpdated', '');
      list.push({
        progressID: getValue(row, 'ProgressID', ''),
        namaSiswa: student,
        kelas: getValue(row, 'Kelas', ''),
        level: getValue(row, 'Level', ''),
        periode: formatLearningProgressPeriod(getValue(row, 'Periode', '')),
        tipePeriode: getValue(row, 'TipePeriode', /-Q|~/.test(String(getValue(row, 'Periode', '')).toUpperCase()) ? 'Tiga Bulan' : 'Bulanan'),
        periodeMulai: getValue(row, 'PeriodeMulai', ''),
        periodeSelesai: getValue(row, 'PeriodeSelesai', ''),
        overallProgress: Number(getValue(row, 'OverallProgress', 0)) || 0,
        materiStatus: getValue(row, 'MateriStatus', 'Belum Dimulai'),
        materiProgress: Number(getValue(row, 'MateriProgress', 0)) || 0,
        materiCatatan: getValue(row, 'MateriCatatan', ''),
        teknikStatus: getValue(row, 'TeknikStatus', 'Belum Dimulai'),
        teknikProgress: Number(getValue(row, 'TeknikProgress', 0)) || 0,
        teknikCatatan: getValue(row, 'TeknikCatatan', ''),
        teoriStatus: getValue(row, 'TeoriStatus', 'Belum Dimulai'),
        teoriProgress: Number(getValue(row, 'TeoriProgress', 0)) || 0,
        teoriCatatan: getValue(row, 'TeoriCatatan', ''),
        repertoireStatus: getValue(row, 'RepertoireStatus', 'Belum Dimulai'),
        repertoireProgress: Number(getValue(row, 'RepertoireProgress', 0)) || 0,
        repertoireCatatan: getValue(row, 'RepertoireCatatan', ''),
        practiceStatus: getValue(row, 'PracticeStatus', 'Belum Dimulai'),
        practiceProgress: Number(getValue(row, 'PracticeProgress', 0)) || 0,
        practiceCatatan: getValue(row, 'PracticeCatatan', ''),
        performanceStatus: getValue(row, 'PerformanceStatus', 'Belum Dimulai'),
        performanceProgress: Number(getValue(row, 'PerformanceProgress', 0)) || 0,
        performanceCatatan: getValue(row, 'PerformanceCatatan', ''),
        evaluasiStatus: getValue(row, 'EvaluasiStatus', 'Belum Dimulai'),
        evaluasiProgress: Number(getValue(row, 'EvaluasiProgress', 0)) || 0,
        evaluasiCatatan: getValue(row, 'EvaluasiCatatan', ''),
        kelebihan: getValue(row, 'Kelebihan', ''),
        perluDitingkatkan: getValue(row, 'PerluDitingkatkan', ''),
        targetBerikutnya: getValue(row, 'TargetBerikutnya', ''),
        guru: teacher,
        guruSignatureUrl: getValue(row, 'GuruSignatureUrl', ''),
        guruSignatureName: getValue(row, 'GuruSignatureName', ''),
        kepalaSekolahNama: getValue(row, 'KepalaSekolahNama', ''),
        kepalaSekolahSignatureUrl: getValue(row, 'KepalaSekolahSignatureUrl', ''),
        kepalaSekolahSignatureName: getValue(row, 'KepalaSekolahSignatureName', ''),
        lastUpdated: lastUpdatedRaw instanceof Date && !isNaN(lastUpdatedRaw.getTime())
          ? Utilities.formatDate(lastUpdatedRaw, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm')
          : String(lastUpdatedRaw || ''),
        lastUpdatedSort: lastUpdatedRaw instanceof Date ? lastUpdatedRaw.getTime() : new Date(lastUpdatedRaw || 0).getTime() || 0
      });
    }
    return list.sort((a, b) => b.lastUpdatedSort - a.lastUpdatedSort).map(item => {
      delete item.lastUpdatedSort;
      return item;
    });
  } catch (e) {
    Logger.log('getLearningProgressData: ' + e.toString());
    return list;
  }
}

function saveLearningProgress(payload, currentUserName, currentUserType) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (String(currentUserType || '').toLowerCase() !== 'guru') {
      return { success: false, message: 'Hanya coach/guru yang dapat mengubah Progress Belajar.' };
    }
    payload = payload || {};
    const studentName = String(payload.namaSiswa || '').trim();
    const teacherName = String(currentUserName || '').trim();
    const periodType = String(payload.tipePeriode || 'Bulanan').trim() === 'Tiga Bulan' ? 'Tiga Bulan' : 'Bulanan';
    const period = formatLearningProgressPeriod(payload.periode);
    const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
    let periodeMulai = period;
    let periodeSelesai = period;
    let validPeriod = validMonth(period);
    if (periodType === 'Tiga Bulan') {
      const range = period.match(/^(\d{4}-(?:0[1-9]|1[0-2]))~(\d{4}-(?:0[1-9]|1[0-2]))$/);
      validPeriod = Boolean(range);
      if (range) {
        periodeMulai = range[1];
        periodeSelesai = range[2];
        const start = new Date(Number(periodeMulai.slice(0, 4)), Number(periodeMulai.slice(5, 7)) - 1, 1);
        const expectedEnd = new Date(start.getFullYear(), start.getMonth() + 2, 1);
        const expectedKey = expectedEnd.getFullYear() + '-' + String(expectedEnd.getMonth() + 1).padStart(2, '0');
        validPeriod = periodeSelesai === expectedKey;
      }
    }
    if (!studentName || !teacherName || !validPeriod) {
      return { success: false, message: 'Siswa, coach, dan periode wajib diisi.' };
    }

    const siswaSheet = ss.getSheetByName('Siswa');
    const siswaData = siswaSheet ? siswaSheet.getDataRange().getValues() : [];
    let studentInfo = null;
    for (let i = 1; i < siswaData.length; i++) {
      const rowName = String(siswaData[i][0] || '').trim();
      const rowTeacher = String(siswaData[i][9] || '').trim();
      if (rowName.toLowerCase() === studentName.toLowerCase()) {
        if (rowTeacher && rowTeacher.toLowerCase() !== teacherName.toLowerCase()) {
          return { success: false, message: 'Siswa ini bukan bagian dari kelas Anda.' };
        }
        studentInfo = { kelas: String(siswaData[i][8] || 'Kelas Musik').trim(), level: String(siswaData[i][1] || '').trim() };
        break;
      }
    }
    if (!studentInfo) return { success: false, message: 'Data siswa tidak ditemukan.' };

    const allowedStatuses = ['Belum Dimulai', 'Dalam Proses', 'Selesai'];
    const categories = ['materi', 'teknik', 'teori', 'repertoire', 'practice', 'performance', 'evaluasi'];
    const values = {};
    categories.forEach(key => {
      const rawStatus = String(payload[key + 'Status'] || 'Belum Dimulai').trim();
      values[key + 'Status'] = allowedStatuses.includes(rawStatus) ? rawStatus : 'Belum Dimulai';
      let score = Math.max(0, Math.min(100, Math.round(Number(payload[key + 'Progress']) || 0)));
      if (values[key + 'Status'] === 'Belum Dimulai') score = 0;
      if (values[key + 'Status'] === 'Dalam Proses') score = Math.max(1, Math.min(99, score));
      values[key + 'Progress'] = score;
      values[key + 'Catatan'] = String(payload[key + 'Catatan'] || '').trim();
    });
    const overall = Math.round(categories.reduce((sum, key) => sum + values[key + 'Progress'], 0) / categories.length);
    const sheet = ensureLearningProgressSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
    const col = {};
    headers.forEach((header, index) => col[header] = index);
    const data = sheet.getDataRange().getValues();
    let targetRow = -1;
    let progressID = String(payload.progressID || '').trim();
    for (let i = 1; i < data.length; i++) {
      const sameID = progressID && String(data[i][col.ProgressID] || '').trim() === progressID;
      const samePeriod = String(data[i][col.NamaSiswa] || '').trim().toLowerCase() === studentName.toLowerCase() &&
        formatLearningProgressPeriod(data[i][col.Periode]) === period;
      if (sameID || samePeriod) { targetRow = i + 1; progressID = String(data[i][col.ProgressID] || progressID); break; }
    }
    if (!progressID) progressID = 'PRG-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const existingRow = targetRow > 0 ? data[targetRow - 1] : null;
    const existingValue = header => existingRow && col[header] !== undefined ? String(existingRow[col[header]] || '') : '';
    let guruSignatureUrl = String(payload.guruSignatureUrl || existingValue('GuruSignatureUrl')).trim();
    let guruSignatureName = String(payload.guruSignatureName || existingValue('GuruSignatureName')).trim();
    let kepalaSekolahSignatureUrl = String(payload.kepalaSekolahSignatureUrl || existingValue('KepalaSekolahSignatureUrl')).trim();
    let kepalaSekolahSignatureName = String(payload.kepalaSekolahSignatureName || existingValue('KepalaSekolahSignatureName')).trim();
    const uploadSignature = (fileData, label) => {
      if (!fileData || !fileData.dataUrl) return null;
      if (!String(fileData.type || '').toLowerCase().startsWith('image/')) throw new Error(label + ' harus berupa file gambar.');
      if (Number(fileData.size || 0) > 5 * 1024 * 1024) throw new Error(label + ' maksimal 5 MB.');
      const uploaded = uploadTaskFiles([fileData], 'LegacyMusicCenter_Progress_Signatures');
      return uploaded.length ? uploaded[0] : null;
    };
    const newGuruSignature = uploadSignature(payload.guruSignatureFile, 'Tanda tangan guru');
    if (newGuruSignature) {
      guruSignatureUrl = newGuruSignature.downloadUrl || newGuruSignature.url;
      guruSignatureName = newGuruSignature.name;
    }
    const newKepalaSekolahSignature = uploadSignature(payload.kepalaSekolahSignatureFile, 'Tanda tangan kepala sekolah');
    if (newKepalaSekolahSignature) {
      kepalaSekolahSignatureUrl = newKepalaSekolahSignature.downloadUrl || newKepalaSekolahSignature.url;
      kepalaSekolahSignatureName = newKepalaSekolahSignature.name;
    }
    const kepalaSekolahNama = String(payload.kepalaSekolahNama || existingValue('KepalaSekolahNama')).trim();
    const allowedLevels = ['Beginner', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Advance'];
    const requestedLevel = String(payload.level || studentInfo.level || 'Beginner').trim();
    const record = {
      ProgressID: progressID, NamaSiswa: studentName, Kelas: studentInfo.kelas,
      Level: allowedLevels.includes(requestedLevel) ? requestedLevel : 'Beginner', Periode: period,
      OverallProgress: overall,
      MateriStatus: values.materiStatus, MateriProgress: values.materiProgress, MateriCatatan: values.materiCatatan,
      TeknikStatus: values.teknikStatus, TeknikProgress: values.teknikProgress, TeknikCatatan: values.teknikCatatan,
      TeoriStatus: values.teoriStatus, TeoriProgress: values.teoriProgress, TeoriCatatan: values.teoriCatatan,
      RepertoireStatus: values.repertoireStatus, RepertoireProgress: values.repertoireProgress, RepertoireCatatan: values.repertoireCatatan,
      PracticeStatus: values.practiceStatus, PracticeProgress: values.practiceProgress, PracticeCatatan: values.practiceCatatan,
      PerformanceStatus: values.performanceStatus, PerformanceProgress: values.performanceProgress, PerformanceCatatan: values.performanceCatatan,
      EvaluasiStatus: values.evaluasiStatus, EvaluasiProgress: values.evaluasiProgress, EvaluasiCatatan: values.evaluasiCatatan,
      Kelebihan: String(payload.kelebihan || '').trim(),
      PerluDitingkatkan: String(payload.perluDitingkatkan || '').trim(),
      TargetBerikutnya: String(payload.targetBerikutnya || '').trim(), Guru: teacherName, LastUpdated: new Date(),
      TipePeriode: periodType,
      GuruSignatureUrl: guruSignatureUrl, GuruSignatureName: guruSignatureName,
      KepalaSekolahNama: kepalaSekolahNama,
      KepalaSekolahSignatureUrl: kepalaSekolahSignatureUrl, KepalaSekolahSignatureName: kepalaSekolahSignatureName,
      PeriodeMulai: periodeMulai, PeriodeSelesai: periodeSelesai
    };
    const rowValues = headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '');
    if (targetRow > 0) sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
    else sheet.appendRow(rowValues);
    return { success: true, message: 'Progress Belajar berhasil disimpan.', overallProgress: overall, progressID: progressID };
  } catch (e) {
    return { success: false, message: 'Gagal menyimpan Progress Belajar: ' + e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function deleteLearningProgress(progressID, currentUserName, currentUserType) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (String(currentUserType || '').toLowerCase() !== 'guru') {
      return { success: false, message: 'Hanya coach/guru yang dapat menghapus Progress Belajar.' };
    }
    const id = String(progressID || '').trim();
    const teacher = String(currentUserName || '').trim().toLowerCase();
    if (!id) return { success: false, message: 'Data progress tidak ditemukan.' };
    const sheet = ensureLearningProgressSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(value => String(value || '').trim());
    const idCol = headers.indexOf('ProgressID');
    const teacherCol = headers.indexOf('Guru');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol] || '').trim() !== id) continue;
      if (String(data[i][teacherCol] || '').trim().toLowerCase() !== teacher) {
        return { success: false, message: 'Anda hanya dapat menghapus progress yang Anda buat.' };
      }
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Progress Belajar berhasil dihapus.' };
    }
    return { success: false, message: 'Data progress tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus Progress Belajar: ' + e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function getLearningProgressPrintLogo() {
  try {
    const blob = DriveApp.getFileById('100p7XBZR19_tqTph14SbSkaJrAmbSIVl').getBlob();
    return { success: true, dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  } catch (e) {
    return { success: false, message: 'Logo laporan tidak dapat dimuat: ' + e.toString() };
  }
}

function getTugasData(identifier, userType) {
  const list = [];
  try {
    const sheet = ensureTaskSheetSchema();
    if (!sheet) return list;
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return list;
    const headers = data[0].map(h => String(h || '').trim());
    const col = {};
    headers.forEach((header, index) => col[header] = index);

    const value = (row, header, fallback) => {
      const index = col[header];
      return index === undefined ? fallback : (row[index] === '' || row[index] === null ? fallback : row[index]);
    };
    const parseFiles = (jsonText, legacyFile) => {
      if (jsonText) {
        try {
          const files = JSON.parse(String(jsonText));
          if (Array.isArray(files)) return files.map(normalizeTaskFileMetadata);
        } catch (error) { Logger.log('Lampiran tugas lama tidak memakai JSON.'); }
      }
      return legacyFile && legacyFile.url ? [normalizeTaskFileMetadata(legacyFile)] : [];
    };
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sNama = String(value(row, 'NamaSiswa', '')).trim();
      const gNama = String(value(row, 'Guru', '')).trim();
      if (!sNama) continue;
      const matchesUser = userType === 'admin' ||
        (userType === 'guru' && gNama.toLowerCase() === String(identifier).toLowerCase()) ||
        (userType === 'siswa' && sNama.toLowerCase() === String(identifier).toLowerCase());
      if (!matchesUser) continue;

      const legacyMateriUrl = value(row, 'FileMateriUrl', '');
      const legacyJawabanUrl = value(row, 'FileJawabanUrl', '');
      const materialAttachments = parseFiles(value(row, 'LampiranJSON', ''), legacyMateriUrl ? {
        name: value(row, 'FileMateriName', 'File lampiran'),
        type: value(row, 'FileMateriType', ''),
        url: legacyMateriUrl,
        downloadUrl: value(row, 'FileMateriDownloadUrl', legacyMateriUrl)
      } : null);
      const answerAttachments = parseFiles(value(row, 'JawabanJSON', ''), legacyJawabanUrl ? {
        name: value(row, 'FileJawabanName', 'File jawaban'),
        type: value(row, 'FileJawabanType', ''),
        url: legacyJawabanUrl,
        downloadUrl: value(row, 'FileJawabanDownloadUrl', legacyJawabanUrl)
      } : null);

      const youtubeColumnUrl = value(row, 'YouTubeUrl', '');
      const youtubeAttachment = materialAttachments.find(file => file && file.kind === 'youtube');
      const youtube = buildYouTubeData(youtubeColumnUrl || (youtubeAttachment && youtubeAttachment.url) || '');

      list.push({
        tugasID: value(row, 'TugasID', ''),
        namaSiswa: sNama,
        judulTugas: value(row, 'JudulTugas', ''),
        deskripsi: value(row, 'Deskripsi', ''),
        deadline: formatDateOnly(value(row, 'Deadline', '')),
        status: value(row, 'Status', 'Belum Dikerjakan'),
        tanggalKirimSiswa: formatDateOnly(value(row, 'TanggalKirim', '')),
        tanggalDibuat: formatDateOnly(value(row, 'TanggalDibuat', '')),
        tipeTugas: value(row, 'TipeTugas', 'Campuran'),
        fileMateriUrl: legacyMateriUrl,
        fileJawabanUrl: legacyJawabanUrl,
        fileJawabanName: value(row, 'FileJawabanName', ''),
        jawabanTeks: value(row, 'JawabanTeks', ''),
        youtubeUrl: youtube.url,
        youtubeVideoId: youtube.videoId,
        youtube: youtube,
        materialAttachments: materialAttachments,
        answerAttachments: answerAttachments
      });
    }
  } catch (e) { Logger.log(e.toString()); }
  return list.reverse();
}

function normalizeTaskFileMetadata(fileData) {
  const file = fileData || {};
  const candidates = [file.fileId, file.url, file.previewUrl, file.downloadUrl];
  let fileId = '';
  for (let i = 0; i < candidates.length && !fileId; i++) {
    const value = String(candidates[i] || '').trim();
    if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) {
      fileId = value;
      break;
    }
    const pathMatch = value.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    const queryMatch = value.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    fileId = pathMatch ? pathMatch[1] : (queryMatch ? queryMatch[1] : '');
  }
  if (!fileId) return file;
  return {
    fileId: fileId,
    name: file.name || 'File lampiran',
    type: file.type || 'application/octet-stream',
    size: Number(file.size || 0),
    url: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing',
    previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
    downloadUrl: 'https://drive.usercontent.google.com/download?id=' + fileId + '&export=download&confirm=t'
  };
}

function ensureTaskSheetSchema() {
  const headers = ['TugasID', 'NamaSiswa', 'JudulTugas', 'Deskripsi', 'Deadline', 'FileMateriUrl', 'Status', 'TanggalKirim', 'FileJawabanUrl', 'FileJawabanName', 'Guru', 'TipeTugas', 'FileMateriName', 'FileMateriType', 'FileMateriDownloadUrl', 'LampiranJSON', 'JawabanTeks', 'FileJawabanType', 'FileJawabanDownloadUrl', 'JawabanJSON', 'TanggalDibuat', 'YouTubeUrl'];
  let sheet = ss.getSheetByName('Tugas');
  if (!sheet) {
    sheet = ss.insertSheet('Tugas');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  headers.forEach(header => {
    if (!existing.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header).setFontWeight('bold');
      existing.push(header);
    }
  });
  return sheet;
}

function getTaskColumnMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, index) => map[String(header || '').trim()] = index + 1);
  return map;
}

function uploadTaskFiles(files, folderName) {
  const uploaded = [];
  if (!files || !Array.isArray(files)) return uploaded;
  let folder;
  const folders = DriveApp.getFoldersByName(folderName);
  folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  files.forEach(item => {
    if (!item || !item.dataUrl || !item.name) return;
    const separator = item.dataUrl.indexOf(',');
    const mimeMatch = String(item.dataUrl).match(/^data:([^;]+);base64,/);
    const contentType = item.type || (mimeMatch ? mimeMatch[1] : 'application/octet-stream');
    const bytes = Utilities.base64Decode(String(item.dataUrl).substring(separator + 1));
    const blob = Utilities.newBlob(bytes, contentType, item.name);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    uploaded.push({
      fileId: fileId,
      name: item.name,
      type: contentType,
      size: Number(item.size || bytes.length || 0),
      url: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing',
      previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
      downloadUrl: 'https://drive.usercontent.google.com/download?id=' + fileId + '&export=download&confirm=t'
    });
  });
  return uploaded;
}

function normalizeScheduleClock(value) {
  const formatted = formatTime(value);
  const match = String(formatted || value || '').match(/^(\d{1,2}):(\d{2})/);
  return match ? String(match[1]).padStart(2, '0') + ':' + match[2] : '';
}

function scheduleTimesOverlap(startA, endA, startB, endB) {
  startA = normalizeScheduleClock(startA); endA = normalizeScheduleClock(endA);
  startB = normalizeScheduleClock(startB); endB = normalizeScheduleClock(endB);
  return !!(startA && endA && startB && endB && startA < endB && endA > startB);
}

function dayNameFromIsoDate(dateValue) {
  const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay()];
}

function findRoomScheduleConflict(room, day, date, start, end, excludeRegularId, excludeMakeupId) {
  const normalizedRoom = String(room || '').trim().toLowerCase();
  const normalizedDay = String(day || dayNameFromIsoDate(date) || '').trim().toLowerCase();
  const scheduleSheet = ss.getSheetByName('Jadwal');
  if (scheduleSheet && scheduleSheet.getLastRow() > 1) {
    const rows = scheduleSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === String(excludeRegularId || '').trim()) continue;
      if (String(rows[i][6] || '').trim().toLowerCase() !== normalizedRoom) continue;
      if (String(rows[i][2] || '').trim().toLowerCase() !== normalizedDay) continue;
      if (String(rows[i][7] || 'Aktif').trim().toLowerCase() === 'keluar') continue;
      if (scheduleTimesOverlap(start, end, rows[i][3], rows[i][4])) return { type:'jadwal', student:rows[i][1], teacher:rows[i][5], start:formatTime(rows[i][3]), end:formatTime(rows[i][4]) };
    }
  }
  if (date) {
    const makeupSheet = ensureAcademySheet('JadwalPengganti', ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada']);
    const data = makeupSheet.getDataRange().getValues();
    const headers = data[0].map(value => String(value || '').trim());
    const col = {}; headers.forEach((header, index) => col[header] = index);
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[col.PenggantiID] || '').trim() === String(excludeMakeupId || '').trim()) continue;
      if (String(row[col.Ruangan] || '').trim().toLowerCase() !== normalizedRoom) continue;
      if (normalizeAcademyDate(row[col.TanggalPelaksanaan]) !== normalizeAcademyDate(date)) continue;
      if (String(row[col.Status] || 'Aktif').trim().toLowerCase() !== 'aktif') continue;
      if (scheduleTimesOverlap(start, end, row[col.JamMulai], row[col.JamSelesai])) return { type:'pergantian', student:row[col.NamaSiswa], teacher:row[col.Guru], start:formatTime(row[col.JamMulai]), end:formatTime(row[col.JamSelesai]) };
    }
  }
  return null;
}

function roomConflictMessage(conflict, room) {
  return 'Ruangan ' + room + ' sudah dipakai ' + (conflict.student || 'kelas lain') + ' pada ' + conflict.start + '–' + conflict.end + '. Silakan pilih waktu atau ruangan lain.';
}

function getStudentHistorySheet() {
  return ensureAcademySheet('RiwayatSiswa', ['RiwayatID', 'NamaSiswa', 'Jenis', 'Tanggal', 'StatusSebelum', 'StatusSesudah', 'Instrumen', 'Guru', 'Keterangan']);
}

function addStudentMovement(nama, jenis, tanggal, statusSebelum, statusSesudah, instrumen, guru, keterangan) {
  const sheet = getStudentHistorySheet();
  sheet.appendRow([
    'RWS-' + Utilities.getUuid().substring(0, 8).toUpperCase(),
    String(nama || '').trim(),
    String(jenis || '').trim(),
    tanggal || new Date(),
    String(statusSebelum || '').trim(),
    String(statusSesudah || '').trim(),
    String(instrumen || '').trim(),
    String(guru || '').trim(),
    String(keterangan || '').trim()
  ]);
}

function updateStudentMovementDate(oldNama, nama, jenis, tanggal, statusSebelum, statusSesudah, instrumen, guru, keterangan) {
  const sheet = getStudentHistorySheet();
  const data = sheet.getDataRange().getValues();
  const oldNameKey = String(oldNama || nama || '').trim().toLowerCase();
  const typeKey = String(jenis || '').trim().toLowerCase();
  let matchedRow = 0;

  for (let i = 1; i < data.length; i++) {
    const rowName = String(data[i][1] || '').trim().toLowerCase();
    const rowType = String(data[i][2] || '').trim().toLowerCase();
    const note = String(data[i][8] || '').trim().toLowerCase();
    if (rowName !== oldNameKey || rowType !== typeKey) continue;

    if (!matchedRow) matchedRow = i + 1;
    if (typeKey === 'masuk' && (note.indexOf('siswa baru') !== -1 || note.indexOf('tanggal daftar') !== -1)) {
      matchedRow = i + 1;
      break;
    }
    if (typeKey === 'keluar') matchedRow = i + 1;
  }

  if (!matchedRow) {
    addStudentMovement(nama, jenis, tanggal, statusSebelum, statusSesudah, instrumen, guru, keterangan);
    return;
  }

  sheet.getRange(matchedRow, 2, 1, 8).setValues([[
    String(nama || '').trim(),
    String(jenis || '').trim(),
    tanggal,
    String(statusSebelum || '').trim(),
    String(statusSesudah || '').trim(),
    String(instrumen || '').trim(),
    String(guru || '').trim(),
    String(keterangan || '').trim()
  ]]);
}

function studentMovementExists(nama, jenis) {
  const data = getStudentHistorySheet().getDataRange().getValues();
  const nameKey = String(nama || '').trim().toLowerCase();
  const typeKey = String(jenis || '').trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toLowerCase() === nameKey && String(data[i][2] || '').trim().toLowerCase() === typeKey) return true;
  }
  return false;
}

function getStudentMovementData() {
  try {
    const list = [];
    const historyData = getStudentHistorySheet().getDataRange().getValues();
    for (let i = 1; i < historyData.length; i++) {
      if (!historyData[i][1] || !historyData[i][2]) continue;
      list.push({
        riwayatID: historyData[i][0], nama: historyData[i][1], jenis: historyData[i][2],
        tanggal: normalizeAcademyDate(historyData[i][3]), statusSebelum: historyData[i][4] || '',
        statusSesudah: historyData[i][5] || '', instrumen: historyData[i][6] || '',
        guru: historyData[i][7] || '', keterangan: historyData[i][8] || ''
      });
    }

    // Data lama tetap masuk laporan meski dibuat sebelum sheet RiwayatSiswa tersedia.
    const known = new Set(list.map(item => String(item.jenis).toLowerCase() + '|' + String(item.nama).trim().toLowerCase() + '|' + String(item.tanggal || '')));
    const siswaSheet = ss.getSheetByName('Siswa');
    const siswaData = siswaSheet ? siswaSheet.getDataRange().getValues() : [];
    for (let i = 1; i < siswaData.length; i++) {
      const nama = String(siswaData[i][0] || '').trim();
      if (!nama) continue;
      const nameKey = nama.toLowerCase();
      const tglDaftar = normalizeAcademyDate(siswaData[i][5]);
      const tglKeluar = normalizeAcademyDate(siswaData[i][10]);
      if (!known.has('masuk|' + nameKey + '|' + tglDaftar)) {
        list.push({ riwayatID:'legacy-in-' + i, nama:nama, jenis:'Masuk', tanggal:tglDaftar, statusSebelum:'', statusSesudah:siswaData[i][6] || 'Aktif', instrumen:siswaData[i][8] || 'Gitar', guru:siswaData[i][9] || '', keterangan:'Tanggal daftar siswa' });
      }
      if (String(siswaData[i][6] || '').trim().toLowerCase() === 'keluar' && !known.has('keluar|' + nameKey + '|' + tglKeluar)) {
        list.push({ riwayatID:'legacy-out-' + i, nama:nama, jenis:'Keluar', tanggal:tglKeluar, statusSebelum:'Aktif', statusSesudah:'Keluar', instrumen:siswaData[i][8] || 'Gitar', guru:siswaData[i][9] || '', keterangan:'Status siswa keluar' });
      }
    }
    return list.sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')));
  } catch (e) {
    Logger.log('Riwayat siswa gagal dimuat: ' + e.toString());
    return [];
  }
}

function addSiswaCombined(data) {
  try {
    const sheetSiswa = ss.getSheetByName('Siswa');
    const existingData = sheetSiswa.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][0]).trim().toLowerCase() === String(data.nama).trim().toLowerCase()) {
        return { success: false, message: 'Gagal: Nama Siswa tersebut sudah terdaftar!' };
      }
    }
    const email = data.email || (data.nama.toLowerCase().replace(/\s+/g, '') + '@student.com');
    const instrumen = data.instrumen || 'Gitar';
    const guruPengajar = data.guru || 'Guru Legacy';
    
    if (data.hari && data.jamMulai && data.jamSelesai && data.ruangan) {
      const conflict = findRoomScheduleConflict(data.ruangan, data.hari, '', data.jamMulai, data.jamSelesai, '', '');
      if (conflict) return { success: false, message: roomConflictMessage(conflict, data.ruangan) };
    }
    const tanggalMasuk = normalizeAcademyDate(data.tglDaftar || new Date());
    const tanggalKeluar = String(data.status || '').trim().toLowerCase() === 'keluar'
      ? normalizeAcademyDate(data.tglKeluar || new Date())
      : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalMasuk)) return { success: false, message: 'Tanggal masuk tidak valid.' };
    if (tanggalKeluar && (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalKeluar) || tanggalKeluar < tanggalMasuk)) {
      return { success: false, message: 'Tanggal keluar harus valid dan tidak boleh sebelum tanggal masuk.' };
    }
    sheetSiswa.appendRow([data.nama, data.kelas, email, 'password123', data.noHp, tanggalMasuk, data.status, '', instrumen, guruPengajar, tanggalKeluar]);
    addStudentMovement(data.nama, 'Masuk', tanggalMasuk, '', data.status || 'Aktif', instrumen, guruPengajar, 'Siswa baru ditambahkan');
    if (tanggalKeluar) addStudentMovement(data.nama, 'Keluar', tanggalKeluar, 'Aktif', 'Keluar', instrumen, guruPengajar, 'Siswa ditambahkan dengan status Keluar');

    if (data.hari && data.jamMulai && data.jamSelesai && data.ruangan) {
      ss.getSheetByName('Jadwal').appendRow(['JDW-' + Utilities.getUuid().substring(0, 8).toUpperCase(), data.nama, data.hari, data.jamMulai, data.jamSelesai, guruPengajar, data.ruangan, data.status, instrumen]);
    }
    return { success: true, message: 'Siswa & Jadwal berhasil ditambahkan!' };
  } catch (e) { return { success: false, message: 'Error: ' + e.toString() }; }
}

function updateSiswa(data) {
  try {
    const sheet = ss.getSheetByName('Siswa');
    const d = sheet.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]).trim().toLowerCase() === String(data.oldNama).trim().toLowerCase()) {
        const oldStatus = String(d[i][6] || '').trim();
        const newStatus = String(data.status || '').trim();
        const tanggalMasuk = normalizeAcademyDate(data.tglDaftar || d[i][5] || new Date());
        let tanggalKeluar = newStatus.toLowerCase() === 'keluar'
          ? normalizeAcademyDate(data.tglKeluar || d[i][10] || new Date())
          : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalMasuk)) return { success: false, message: 'Tanggal masuk tidak valid.' };
        if (tanggalKeluar && (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalKeluar) || tanggalKeluar < tanggalMasuk)) {
          return { success: false, message: 'Tanggal keluar harus valid dan tidak boleh sebelum tanggal masuk.' };
        }
        sheet.getRange(i+1,1).setValue(data.nama); 
        sheet.getRange(i+1,2).setValue(data.kelas); 
        sheet.getRange(i+1,3).setValue(data.email); 
        sheet.getRange(i+1,5).setValue(data.noHp); 
        sheet.getRange(i+1,6).setValue(tanggalMasuk);
        sheet.getRange(i+1,7).setValue(data.status);
        if (data.instrumen) sheet.getRange(i+1,9).setValue(data.instrumen);
        if (data.guru) sheet.getRange(i+1,10).setValue(data.guru);
        updateStudentMovementDate(data.oldNama, data.nama, 'Masuk', tanggalMasuk, '', newStatus || 'Aktif', data.instrumen || d[i][8], data.guru || d[i][9], 'Tanggal daftar siswa');
        if (oldStatus.toLowerCase() !== 'keluar' && newStatus.toLowerCase() === 'keluar') {
          sheet.getRange(i+1,11).setValue(tanggalKeluar);
          addStudentMovement(data.nama, 'Keluar', tanggalKeluar, oldStatus, newStatus, data.instrumen || d[i][8], data.guru || d[i][9], 'Status diubah menjadi Keluar');
        } else if (oldStatus.toLowerCase() === 'keluar' && newStatus.toLowerCase() === 'keluar') {
          sheet.getRange(i+1,11).setValue(tanggalKeluar);
          updateStudentMovementDate(data.oldNama, data.nama, 'Keluar', tanggalKeluar, oldStatus, newStatus, data.instrumen || d[i][8], data.guru || d[i][9], 'Tanggal keluar siswa diperbarui');
        } else if (oldStatus.toLowerCase() === 'keluar' && newStatus.toLowerCase() !== 'keluar') {
          sheet.getRange(i+1,11).clearContent();
          addStudentMovement(data.nama, 'Masuk', new Date(), oldStatus, newStatus, data.instrumen || d[i][8], data.guru || d[i][9], 'Siswa aktif kembali');
        }
        return { success: true, message: 'Data Siswa berhasil diperbarui.' };
      }
    }
    return { success: false, message: 'Siswa tidak ditemukan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function deleteSiswa(nama) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const sheet = ss.getSheetByName('Siswa'); 
    const data = sheet.getDataRange().getValues();
    const targetName = String(nama || '').trim().toLowerCase();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toLowerCase() === targetName) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Data siswa berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Siswa tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus siswa: ' + e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function deleteRowsByStudentName_(sheetName, studentColumn, namaSiswa) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const target = String(namaSiswa || '').trim().toLowerCase();
  if (!target) return 0;
  const values = sheet.getRange(2, studentColumn, sheet.getLastRow() - 1, 1).getValues();
  let deleted = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || '').trim().toLowerCase() === target) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

function cleanupOrphanStudentSchedules_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return 0;
  try {
    const siswaSheet = ss.getSheetByName('Siswa');
    const validNames = new Set();
    if (siswaSheet && siswaSheet.getLastRow() >= 2) {
      siswaSheet.getRange(2, 1, siswaSheet.getLastRow() - 1, 1).getValues().forEach(row => {
        const name = String(row[0] || '').trim().toLowerCase();
        if (name) validNames.add(name);
      });
    }

    let deleted = 0;
    [['Jadwal', 2], ['JadwalPengganti', 3]].forEach(config => {
      const sheet = ss.getSheetByName(config[0]);
      if (!sheet || sheet.getLastRow() < 2) return;
      const values = sheet.getRange(2, config[1], sheet.getLastRow() - 1, 1).getValues();
      for (let i = values.length - 1; i >= 0; i--) {
        const name = String(values[i][0] || '').trim().toLowerCase();
        if (name && !validNames.has(name)) {
          sheet.deleteRow(i + 2);
          deleted++;
        }
      }
    });
    if (deleted) SpreadsheetApp.flush();
    return deleted;
  } catch (e) {
    Logger.log('cleanupOrphanStudentSchedules_: ' + e.toString());
    return 0;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function addTugasCombined(payload) {
  try {
    const sheet = ensureTaskSheetSchema();
    const col = getTaskColumnMap(sheet);
    if (!payload || !String(payload.namaSiswa || '').trim() || !String(payload.judulTugas || '').trim()) {
      return { success: false, message: 'Nama siswa dan judul tugas wajib diisi.' };
    }
    const tugasID = 'TGS-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const youtubeUrl = normalizeYouTubeUrl(payload.youtubeUrl || '');
    if (String(payload.youtubeUrl || '').trim() && !youtubeUrl) {
      return { success: false, message: 'Link YouTube tidak valid. Gunakan link video YouTube, Shorts, atau youtu.be.' };
    }
    const incomingFiles = Array.isArray(payload.files) ? payload.files : (payload.fileBase64 ? [{ dataUrl: payload.fileBase64, name: payload.fileName, type: payload.fileType, size: payload.fileSize }] : []);
    const attachments = uploadTaskFiles(incomingFiles, 'LegacyGuitarClass_Tugas');
    const first = attachments[0] || {};
    const youtubeData = buildYouTubeData(youtubeUrl);
    const storedAttachments = attachments.slice();
    if (youtubeData.videoId) storedAttachments.push({
      kind: 'youtube',
      name: 'Video YouTube',
      type: 'video/youtube',
      url: youtubeData.url,
      videoId: youtubeData.videoId
    });
    const row = new Array(sheet.getLastColumn()).fill('');
    const set = (header, value) => { if (col[header]) row[col[header] - 1] = value; };
    set('TugasID', tugasID);
    set('NamaSiswa', payload.namaSiswa);
    set('JudulTugas', payload.judulTugas);
    set('Deskripsi', payload.deskripsi || '');
    set('Deadline', payload.deadline || '');
    set('FileMateriUrl', first.url || '');
    set('Status', 'Belum Dikerjakan');
    set('Guru', payload.guru || '');
    set('TipeTugas', payload.tipeTugas || 'Campuran');
    set('FileMateriName', first.name || '');
    set('FileMateriType', first.type || '');
    set('FileMateriDownloadUrl', first.downloadUrl || '');
    set('LampiranJSON', storedAttachments.length ? JSON.stringify(storedAttachments) : '');
    set('TanggalDibuat', formatDateOnly(new Date()));
    set('YouTubeUrl', youtubeUrl);
    sheet.appendRow(row);
    return { success: true, message: 'Tugas berhasil dikirim ke siswa!' };
  } catch (e) { return { success: false, message: 'Gagal membuat tugas: ' + e.toString() }; }
}

function normalizeYouTubeUrl(url) {
  return buildYouTubeData(url).url;
}

function buildYouTubeData(url) {
  const text = String(url || '').trim();
  let videoId = '';
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /[?&]v=([a-zA-Z0-9_-]{11})(?:[&#]|$)/i,
    /youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/i
  ];
  for (let i = 0; i < patterns.length && !videoId; i++) {
    const match = text.match(patterns[i]);
    if (match) videoId = match[1];
  }
  if (!videoId) return { videoId: '', url: '', embedUrl: '', thumbnailUrl: '' };
  return {
    videoId: videoId,
    url: 'https://www.youtube.com/watch?v=' + videoId,
    embedUrl: 'https://www.youtube.com/embed/' + videoId,
    thumbnailUrl: 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'
  };
}

function recordAbsensi(data) {
  try {
    let sheetAbsensi = ss.getSheetByName('Absensi');
    if (!sheetAbsensi) {
      sheetAbsensi = ss.insertSheet('Absensi');
      const headers = ['AbsensiID','NamaSiswa','Tanggal','PertemuanKe','Status','Materi','Lagu','Catatan','TandaTangan','GuruCatat','TtdSiswa'];
      sheetAbsensi.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    const absensiID = 'ABS-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    sheetAbsensi.appendRow([
      absensiID, 
      data.namaSiswa, 
      data.tanggal, 
      data.pertemuanKe, 
      data.status, 
      data.materi, 
      data.lagu, 
      data.catatan, 
      data.tandaTangan, 
      data.guru, 
      data.ttdSiswa || ''
    ]);
    return { success: true, message: 'Absensi berhasil disimpan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function updateAbsensi(data) {
  try {
    const sheet = ss.getSheetByName('Absensi');
    if (!sheet) return { success: false, message: 'Sheet Absensi tidak ditemukan.' };
    const d = sheet.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]).trim() === String(data.absensiID).trim()) {
        sheet.getRange(i+1, 2).setValue(data.namaSiswa);
        sheet.getRange(i+1, 3).setValue(data.tanggal);
        sheet.getRange(i+1, 4).setValue(data.pertemuanKe);
        sheet.getRange(i+1, 5).setValue(data.status);
        sheet.getRange(i+1, 6).setValue(data.materi);
        sheet.getRange(i+1, 7).setValue(data.lagu);
        sheet.getRange(i+1, 8).setValue(data.catatan);
        sheet.getRange(i+1, 9).setValue(data.tandaTangan);
        if (data.ttdSiswa !== undefined) {
          sheet.getRange(i+1, 11).setValue(data.ttdSiswa);
        }
        return { success: true, message: 'Riwayat Progress berhasil diperbarui.' };
      }
    }
    return { success: false, message: 'Data absensi tidak ditemukan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function deleteAbsensi(absensiID) {
  try {
    const sheet = ss.getSheetByName('Absensi');
    if (!sheet) return { success: false, message: 'Sheet Absensi tidak ditemukan.' };
    const d = sheet.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]).trim() === String(absensiID).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Riwayat Progress berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Data absensi tidak ditemukan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function submitTugasJawaban(payload) {
  try {
    const sheet = ensureTaskSheetSchema();
    if (!sheet) return { success: false, message: 'Sheet Tugas belum ada.' };
    const data = sheet.getDataRange().getValues();
    const col = getTaskColumnMap(sheet);
    const incomingFiles = Array.isArray(payload.files) ? payload.files : (payload.fileBase64 ? [{ dataUrl: payload.fileBase64, name: payload.fileName, type: payload.fileType, size: payload.fileSize }] : []);
    if (!String(payload.jawabanTeks || '').trim() && incomingFiles.length === 0) {
      return { success: false, message: 'Tulis jawaban atau unggah minimal satu file.' };
    }
    const attachments = uploadTaskFiles(incomingFiles, 'LegacyGuitarClass_Jawaban');
    const first = attachments[0] || {};

    const todayStr = formatDateOnly(new Date());

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][col.TugasID - 1]).trim() === String(payload.tugasID).trim()) {
        sheet.getRange(i + 1, col.Status).setValue('Selesai');
        sheet.getRange(i + 1, col.TanggalKirim).setValue(todayStr);
        sheet.getRange(i + 1, col.FileJawabanUrl).setValue(first.url || '');
        sheet.getRange(i + 1, col.FileJawabanName).setValue(first.name || '');
        sheet.getRange(i + 1, col.JawabanTeks).setValue(payload.jawabanTeks || '');
        sheet.getRange(i + 1, col.FileJawabanType).setValue(first.type || '');
        sheet.getRange(i + 1, col.FileJawabanDownloadUrl).setValue(first.downloadUrl || '');
        sheet.getRange(i + 1, col.JawabanJSON).setValue(attachments.length ? JSON.stringify(attachments) : '');
        return { success: true, message: 'Tugas berhasil dikirimkan ke guru!' };
      }
    }
    return { success: false, message: 'Tugas tidak ditemukan!' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function deleteTugas(tugasID) {
  try {
    const sheet = ss.getSheetByName('Tugas');
    if (!sheet) return { success: false, message: 'Sheet Tugas tidak ditemukan.' };
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(tugasID).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Tugas berhasil dihapus.' };
      }
    }
    return { success: false, message: 'Tugas tidak ditemukan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function updateUserPhoto(userID, userType, base64Data, fileName) {
  try {
    const folderName = "LegacyGuitarClass_Photos";
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) { 
      folder = folders.next(); 
    } else { 
      folder = DriveApp.createFolder(folderName); 
    }

    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    const blob = Utilities.newBlob(bytes, contentType, fileName || (userID + "_photo.png"));
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    const photoUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    let sheetName = 'Siswa';
    if (userType === 'guru') sheetName = 'Guru';
    if (userType === 'admin') sheetName = 'Admin';

    const sheet = ss.getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(userID).toLowerCase() || String(data[i][1]).toLowerCase() === String(userID).toLowerCase()) {
        const photoCol = (userType === 'admin') ? 6 : 8;
        sheet.getRange(i + 1, photoCol).setValue(photoUrl);
        return { success: true, message: 'Foto profil berhasil diperbarui.', photoUrl: photoUrl };
      }
    }
    return { success: false, message: 'User tidak ditemukan.' };
  } catch (e) { return { success: false, message: 'Gagal upload foto: ' + e.toString() }; }
}

function updateSelfProfile(data) {
  try {
    let sheetName = 'Siswa';
    if (data.userType === 'guru') sheetName = 'Guru';
    if (data.userType === 'admin') sheetName = 'Admin';

    const sheet = ss.getSheetByName(sheetName);
    const d = sheet.getDataRange().getValues();

    for (let i = 1; i < d.length; i++) {
      const match = (data.userType === 'guru' || data.userType === 'admin') 
        ? (String(d[i][0]).toLowerCase() === String(data.oldNama).toLowerCase() || String(d[i][1]).toLowerCase() === String(data.oldNama).toLowerCase())
        : (String(d[i][0]).toLowerCase() === String(data.oldNama).toLowerCase());

      if (match) {
        if (data.userType === 'admin') {
          sheet.getRange(i + 1, 2).setValue(data.nama);
          sheet.getRange(i + 1, 3).setValue(data.email);
          sheet.getRange(i + 1, 5).setValue(data.noHp);
        } else if (data.userType === 'guru') {
          sheet.getRange(i + 1, 2).setValue(data.nama);
          sheet.getRange(i + 1, 3).setValue(data.email);
          sheet.getRange(i + 1, 5).setValue(data.noHp);
          if (data.instrumen) sheet.getRange(i + 1, 6).setValue(data.instrumen);
        } else {
          sheet.getRange(i + 1, 1).setValue(data.nama);
          sheet.getRange(i + 1, 3).setValue(data.email);
          sheet.getRange(i + 1, 5).setValue(data.noHp);
        }
        return { success: true, message: 'Profil berhasil diperbarui.' };
      }
    }
    return { success: false, message: 'User tidak ditemukan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function updateJadwal(data) {
  try {
    const conflict = findRoomScheduleConflict(data.ruangan, data.hari, '', data.jamMulai, data.jamSelesai, data.jadwalID, '');
    if (conflict) return { success: false, message: roomConflictMessage(conflict, data.ruangan) };
    const sheet = ss.getSheetByName('Jadwal'); const d = sheet.getDataRange().getValues();
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]).trim() === String(data.jadwalID).trim()) {
        sheet.getRange(i+1, 2).setValue(data.namaSiswa); 
        sheet.getRange(i+1, 3).setValue(data.hari); 
        sheet.getRange(i+1, 4).setValue(data.jamMulai); 
        sheet.getRange(i+1, 5).setValue(data.jamSelesai); 
        if (data.guru) sheet.getRange(i+1, 6).setValue(data.guru);
        sheet.getRange(i+1, 7).setValue(data.ruangan); 
        sheet.getRange(i+1, 8).setValue(data.status);
        if (data.instrumen) sheet.getRange(i+1, 9).setValue(data.instrumen);
        return { success: true, message: 'Jadwal diperbarui.' };
      }
    }
    return { success: false, message: 'Jadwal tidak ditemukan.' };
  } catch(e) { return { success: false, message: e.toString() }; }
}

function deleteJadwal(jadwalID) {
  try {
    const sheet = ss.getSheetByName('Jadwal'); const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(jadwalID).trim()) { sheet.deleteRow(i + 1); return { success: true, message: 'Jadwal dihapus.' }; }
    }
    return { success: false, message: 'Jadwal tidak ditemukan.' };
  } catch(e) { return { success: false, message: e.toString() }; }
}

function getSiswaList() {
  return ss.getSheetByName('Siswa').getDataRange().getValues().slice(1).map(r => ({ 
    nama: r[0], kelas: r[1], email: r[2], status: r[6], instrumen: r[8] || 'Gitar', guru: r[9] || ''
  }));
}

function ensureAcademySheet(sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(value => String(value || '').trim());
  headers.forEach(header => {
    if (!existing.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header).setFontWeight('bold');
      existing.push(header);
    }
  });
  return sheet;
}

function normalizeAcademyDate(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const local = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  return local ? local[3] + '-' + String(local[2]).padStart(2, '0') + '-' + String(local[1]).padStart(2, '0') : text;
}

function getJadwalPenggantiData(identifier, userType) {
  const list = [];
  try {
    const headersRequired = ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada'];
    const sheet = ensureAcademySheet('JadwalPengganti', headersRequired);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(value => String(value || '').trim());
    const col = {}; headers.forEach((header, index) => col[header] = index);
    const get = (row, primary, legacy, fallback) => {
      const primaryIndex = col[primary];
      if (primaryIndex !== undefined && row[primaryIndex] !== '' && row[primaryIndex] !== null) return row[primaryIndex];
      const legacyIndex = col[legacy];
      return legacyIndex === undefined || row[legacyIndex] === '' || row[legacyIndex] === null ? fallback : row[legacyIndex];
    };
    const role = String(userType || '').toLowerCase();
    const key = String(identifier || '').trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const student = String(get(row, 'NamaSiswa', '', '')).trim();
      const teacher = String(get(row, 'Guru', '', '')).trim();
      if (!student) continue;
      const allowed = role === 'admin' || (role === 'guru' && teacher.toLowerCase() === key) || (role === 'siswa' && student.toLowerCase() === key);
      if (!allowed) continue;
      const date = normalizeAcademyDate(get(row, 'TanggalPelaksanaan', 'TanggalPerubahan', ''));
      let day = '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parts = date.split('-').map(Number);
        day = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
      } else day = String(get(row, 'HariPelaksanaan', 'HariBaru', '') || '');
      list.push({
        penggantiID: get(row, 'PenggantiID', '', ''), jadwalID: get(row, 'JadwalID', '', ''),
        namaSiswa: student, alasan: get(row, 'Alasan', '', 'Lainnya'), tanggalPelaksanaan: date,
        hariPelaksanaan: day, jamMulai: formatTime(get(row, 'JamMulai', 'JamMulaiBaru', '')),
        jamSelesai: formatTime(get(row, 'JamSelesai', 'JamSelesaiBaru', '')), guru: teacher,
        ruangan: get(row, 'Ruangan', '', ''), status: get(row, 'Status', '', 'Aktif')
      });
    }
  } catch (e) { Logger.log('getJadwalPenggantiData: ' + e.toString()); }
  return list.sort((a, b) => String(b.tanggalPelaksanaan).localeCompare(String(a.tanggalPelaksanaan)));
}

function addJadwalPengganti(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    payload = payload || {};
    if (String(payload.currentUserType || '').toLowerCase() !== 'admin') return { success: false, message: 'Hanya admin yang dapat membuat jadwal pergantian.' };
    const student = String(payload.namaSiswa || '').trim();
    const date = normalizeAcademyDate(payload.tanggalPelaksanaan || payload.tanggalPerubahan);
    const start = String(payload.jamMulai || payload.jamMulaiBaru || '').trim();
    const end = String(payload.jamSelesai || payload.jamSelesaiBaru || '').trim();
    const teacher = String(payload.guru || '').trim();
    const room = String(payload.ruangan || '').trim();
    if (!student || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !start || !end || !teacher || !room) return { success: false, message: 'Siswa, tanggal, waktu, guru, dan ruangan wajib diisi.' };
    if (start >= end) return { success: false, message: 'Jam selesai harus setelah jam mulai.' };
    const conflict = findRoomScheduleConflict(room, dayNameFromIsoDate(date), date, start, end, '', '');
    if (conflict) return { success: false, message: roomConflictMessage(conflict, room) };
    const headersRequired = ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada'];
    const sheet = ensureAcademySheet('JadwalPengganti', headersRequired);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
    const record = {
      PenggantiID: 'MKP-' + Utilities.getUuid().substring(0, 8).toUpperCase(), JadwalID: String(payload.jadwalID || '').trim(),
      NamaSiswa: student, Alasan: String(payload.alasan || 'Lainnya').trim(), TanggalPelaksanaan: date,
      JamMulai: start, JamSelesai: end, Guru: teacher, Ruangan: room, Status: 'Aktif', DibuatPada: new Date()
    };
    sheet.appendRow(headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''));
    return { success: true, message: 'Jadwal pergantian berhasil disimpan.' };
  } catch (e) { return { success: false, message: 'Gagal menyimpan jadwal pergantian: ' + e.toString() }; }
  finally { try { lock.releaseLock(); } catch (ignore) {} }
}

function deleteJadwalPengganti(id, currentUserType) {
  if (String(currentUserType || '').toLowerCase() !== 'admin') return { success: false, message: 'Hanya admin yang dapat menghapus jadwal pergantian.' };
  try {
    const sheet = ensureAcademySheet('JadwalPengganti', ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada']);
    const data = sheet.getDataRange().getValues();
    const idCol = data[0].map(String).indexOf('PenggantiID');
    for (let i = 1; i < data.length; i++) if (String(data[i][idCol] || '').trim() === String(id || '').trim()) { sheet.deleteRow(i + 1); return { success: true, message: 'Jadwal pergantian berhasil dihapus.' }; }
    return { success: false, message: 'Jadwal pergantian tidak ditemukan.' };
  } catch (e) { return { success: false, message: 'Gagal menghapus jadwal pergantian: ' + e.toString() }; }
}

function getPengumumanData(identifier, userType) {
  const list = [];
  try {
    const headersRequired = ['PengumumanID', 'Judul', 'Target', 'TargetDetail', 'Isi', 'Pembuat', 'TanggalKirim', 'Status'];
    const sheet = ensureAcademySheet('Pengumuman', headersRequired);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(value => String(value || '').trim());
    const col = {}; headers.forEach((header, index) => col[header] = index);
    const get = (row, header, fallback) => col[header] === undefined || row[col[header]] === '' || row[col[header]] === null ? fallback : row[col[header]];
    const role = String(userType || '').toLowerCase();
    const key = String(identifier || '').trim().toLowerCase();
    const teacherStudents = new Set();
    if (role === 'guru') {
      const students = ss.getSheetByName('Siswa');
      const rows = students ? students.getDataRange().getValues() : [];
      for (let i = 1; i < rows.length; i++) if (String(rows[i][9] || '').trim().toLowerCase() === key) teacherStudents.add(String(rows[i][0] || '').trim().toLowerCase());
    }
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const target = String(get(row, 'Target', 'semua')).toLowerCase();
      const detail = String(get(row, 'TargetDetail', '')).trim();
      const status = String(get(row, 'Status', 'Terbit')).toLowerCase();
      if (status === 'draf' || status === 'nonaktif') continue;
      const allowed = role === 'admin' || target === 'semua' ||
        (role === 'siswa' && (target === 'semua_siswa' || (target === 'siswa_tertentu' && detail.toLowerCase() === key))) ||
        (role === 'guru' && (target === 'semua_guru' || (target === 'siswa_tertentu' && teacherStudents.has(detail.toLowerCase()))));
      if (!allowed) continue;
      list.push({
        pengumumanID: get(row, 'PengumumanID', ''), judul: get(row, 'Judul', ''), target: target,
        targetDetail: detail, isi: get(row, 'Isi', ''), pembuat: get(row, 'Pembuat', ''),
        tanggalKirim: formatDateOnly(get(row, 'TanggalKirim', '')), status: get(row, 'Status', 'Terbit')
      });
    }
  } catch (e) { Logger.log('getPengumumanData: ' + e.toString()); }
  return list.reverse();
}

function addPengumuman(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    payload = payload || {};
    if (String(payload.currentUserType || '').toLowerCase() !== 'admin') return { success: false, message: 'Hanya admin yang dapat menerbitkan pengumuman.' };
    const title = String(payload.judul || '').trim();
    const body = String(payload.isi || '').trim();
    const target = ['semua', 'semua_guru', 'semua_siswa', 'siswa_tertentu'].includes(String(payload.target || '')) ? String(payload.target) : 'semua';
    const detail = String(payload.targetDetail || '').trim();
    if (!title || !body || (target === 'siswa_tertentu' && !detail)) return { success: false, message: 'Judul, isi, dan penerima pengumuman wajib diisi.' };
    const headersRequired = ['PengumumanID', 'Judul', 'Target', 'TargetDetail', 'Isi', 'Pembuat', 'TanggalKirim', 'Status'];
    const sheet = ensureAcademySheet('Pengumuman', headersRequired);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
    const record = {
      PengumumanID: 'PNG-' + Utilities.getUuid().substring(0, 8).toUpperCase(), Judul: title, Target: target,
      TargetDetail: detail, Isi: body, Pembuat: String(payload.pembuat || 'Admin').trim(), TanggalKirim: new Date(), Status: 'Terbit'
    };
    sheet.appendRow(headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''));
    return { success: true, message: 'Pengumuman berhasil diterbitkan.' };
  } catch (e) { return { success: false, message: 'Gagal menerbitkan pengumuman: ' + e.toString() }; }
  finally { try { lock.releaseLock(); } catch (ignore) {} }
}

function deletePengumuman(id, currentUserType) {
  if (String(currentUserType || '').toLowerCase() !== 'admin') return { success: false, message: 'Hanya admin yang dapat menghapus pengumuman.' };
  try {
    const sheet = ensureAcademySheet('Pengumuman', ['PengumumanID', 'Judul', 'Target', 'TargetDetail', 'Isi', 'Pembuat', 'TanggalKirim', 'Status']);
    const data = sheet.getDataRange().getValues();
    const idCol = data[0].map(String).indexOf('PengumumanID');
    for (let i = 1; i < data.length; i++) if (String(data[i][idCol] || '').trim() === String(id || '').trim()) { sheet.deleteRow(i + 1); return { success: true, message: 'Pengumuman berhasil dihapus.' }; }
    return { success: false, message: 'Pengumuman tidak ditemukan.' };
  } catch (e) { return { success: false, message: 'Gagal menghapus pengumuman: ' + e.toString() }; }
}

function formatTime(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Jakarta', 'HH:mm');
  return value == null ? '' : String(value);
}

function formatDateOnly(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Asia/Jakarta', 'dd-MM-yyyy');
  return value == null ? '' : String(value);
}

/**
 * EXPORT GOOGLE DOCS - FINAL PREMIUM
 * Jika Filter Bulan dipilih, export OTOMATIS hanya bulan tersebut.
 * periodType: month | 3months | all
 */
function generateProgressDoc(filterSiswa, filterGuru, periodType, periodValue, currentUserType, currentUserName) {
  try {
    const sh = ss.getSheetByName('Absensi');
    if (!sh) return { success:false, message:'Sheet Absensi tidak ditemukan!' };

    periodType = String(periodType || '3months').toLowerCase();
    periodValue = String(periodValue || '').trim(); // MM-YYYY
    const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const fs = String(filterSiswa || '').trim();
    const fg = String(filterGuru || '').trim();
    const userName = String(currentUserName || '').trim();
    const userType = String(currentUserType || '').trim().toLowerCase();

    function parseDate(v) {
      if (v instanceof Date && !isNaN(v.getTime())) return v;
      const s = String(v || '').trim();
      let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) return new Date(+m[3], +m[2]-1, +m[1]);
      m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) return new Date(+m[1], +m[2]-1, +m[3]);
      return null;
    }

    function periodLabel() {
      if (periodType === 'month' && periodValue) {
        const p = periodValue.split('-');
        const mi = Number(p[0])-1;
        return (mi >= 0 && mi < 12) ? monthNames[mi] + ' ' + p[1] : periodValue;
      }
      return periodType === 'all' ? 'Semua Riwayat' : '3 Bulan Terakhir';
    }

    const data = sh.getDataRange().getValues();
    const rows = [];
    const today = new Date();
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth()-3, today.getDate());

    for (let i=1; i<data.length; i++) {
      const r=data[i];
      if (!r || !r[1]) continue;
      const student=String(r[1]||'').trim();
      const teacher=String(r[9]||'').trim();
      const d=parseDate(r[2]);

      if (fs && student.toLowerCase() !== fs.toLowerCase()) continue;
      if (userType === 'guru' && teacher && userName && teacher.toLowerCase() !== userName.toLowerCase()) continue;
      if (userType === 'admin' && fg && teacher.toLowerCase() !== fg.toLowerCase()) continue;

      if (periodType === 'month') {
        if (!d || Utilities.formatDate(d,tz,'MM-yyyy') !== periodValue) continue;
      } else if (periodType === '3months') {
        if (d && d < threeMonthsAgo) continue;
      }

      rows.push({
        date:d,
        tanggal:formatDateOnly(r[2]),
        ke:String(r[3]||'-'),
        siswa:student,
        materi:String(r[5]||'-'),
        lagu:String(r[6]||'-'),
        catatan:String(r[7]||'-'),
        ttdGuru:String(r[8]||'').trim(),
        ttdSiswa:String(r[10]||'').trim(),
        guru:teacher||'-'
      });
    }

    rows.sort((a,b)=>(a.date?a.date.getTime():0)-(b.date?b.date.getTime():0));
    if (!rows.length) return {success:false,message:'Tidak ada data progress pada periode ' + periodLabel() + '.'};

    const safe=(fs||'Semua_Siswa').replace(/[^a-zA-Z0-9_-]+/g,'_');
    const doc=DocumentApp.create('Riwayat_Progress_'+safe+'_'+Utilities.formatDate(today,tz,'yyyyMMdd_HHmmss'));
    const body=doc.getBody();
    body.clear();
    body.setPageWidth(792).setPageHeight(612);
    body.setMarginTop(28).setMarginBottom(28).setMarginLeft(32).setMarginRight(32);

    // ===== HEADER PREMIUM =====
    const head=body.appendTable(); head.setBorderWidth(0);
    const hr=head.appendTableRow();
    const lc=hr.appendTableCell();
    const tc=hr.appendTableCell();
    lc.setWidth(180); tc.setWidth(540);

    try {
      // Logo Drive baru dari user. Lebih stabil daripada URL publik.
      const logoBlob=DriveApp.getFileById('100p7XBZR19_tqTph14SbSkaJrAmbSIVl').getBlob();
      const lp=lc.getChild(0).asParagraph();
      lp.setAlignment(DocumentApp.HorizontalAlignment.LEFT).setSpacingBefore(0).setSpacingAfter(0);
      const img=lp.appendInlineImage(logoBlob);
      // Rasio logo ±1.64:1, tidak gepeng.
      img.setWidth(148).setHeight(90);
    } catch(e) {
      const fallbackLogoP = lc.getChild(0).asParagraph();
      fallbackLogoP.setText('LEGACY MUSIC CENTER');
      fallbackLogoP.editAsText().setBold(true).setForegroundColor('#F15A24');
    }

    const p1=tc.getChild(0).asParagraph();
    p1.setText('LAPORAN RIWAYAT PROGRESS SISWA');
    p1.editAsText().setBold(true).setFontSize(16);
    p1.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingAfter(3);
    const brandP = tc.appendParagraph('LEGACY MUSIC CENTER');
    brandP.editAsText().setBold(true).setFontSize(11).setForegroundColor('#F15A24');
    brandP.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingAfter(2);
    tc.appendParagraph('Inspirasi Musik Tanpa Batas').setFontSize(8.5).setForegroundColor('#666666')
      .setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingAfter(0);

    // Garis brand tipis di bawah header
    const rule=body.appendTable([['']]);
    rule.setBorderWidth(0);
    const ruleCell=rule.getCell(0,0);
    ruleCell.setBackgroundColor('#F15A24');
    ruleCell.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
    const ruleP=ruleCell.getChild(0).asParagraph();
    ruleP.setFontSize(1).setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(0.5);
    body.appendParagraph('').setSpacingAfter(2);

    // ===== INFO CARD =====
    const info=body.appendTable(); info.setBorderWidth(0);
    const i1=info.appendTableRow();
    const i1a=i1.appendTableCell('SISWA\n'+(fs||'Semua Siswa'));
    const i1b=i1.appendTableCell('GURU\n'+(fg || rows[0].guru || '-'));
    const i1c=i1.appendTableCell('PERIODE\n'+periodLabel());
    const i1d=i1.appendTableCell('TOTAL\n'+rows.length+' Pertemuan');
    [i1a,i1b,i1c,i1d].forEach(c=>{
      c.setBackgroundColor('#FFF4EF');
      const p=c.getChild(0).asParagraph();
      p.editAsText().setFontSize(9).setBold(true).setForegroundColor('#333333');
      p.setSpacingBefore(4).setSpacingAfter(4);
    });

    const meta=body.appendParagraph('Dicetak oleh '+userName+' ('+userType.toUpperCase()+')  •  '+Utilities.formatDate(today,tz,'dd MMMM yyyy, HH:mm'));
    meta.setFontSize(8).setForegroundColor('#777777').setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingBefore(5).setSpacingAfter(8);

    // ===== DATA TABLE =====
    const table=body.appendTable(); table.setBorderWidth(0.7);
    const h=table.appendTableRow();
    ['Tanggal','Ke','Nama Siswa','Materi','Lagu','TTD Guru','TTD Siswa','Catatan'].forEach(x=>{
      const c=h.appendTableCell(x); c.setBackgroundColor('#F15A24');
      const hp = c.getChild(0).asParagraph();
      hp.editAsText().setBold(true).setForegroundColor('#FFFFFF').setFontSize(8.5);
      hp.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(4).setSpacingAfter(4);
    });

    function textCell(tr,val,center,bold){
      const c=tr.appendTableCell(String(val||'-'));
      const p=c.getChild(0).asParagraph();
      p.setFontSize(8).setSpacingBefore(4).setSpacingAfter(4);
      // Paksa warna isi tabel gelap; jangan mewarisi warna putih dari header.
      p.editAsText().setForegroundColor('#111827');
      if(center) p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      if(bold) p.editAsText().setBold(true);
      return c;
    }

    function sigCell(tr,val){
      const c=tr.appendTableCell(); const p=c.getChild(0).asParagraph();
      p.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(2).setSpacingAfter(2);
      let raw=String(val||'').trim();
      if(!raw){
        p.setText('-').setFontSize(8);
        p.editAsText().setForegroundColor('#111827');
        return;
      }
      try{
        let mime='image/png';
        const mm=raw.match(/^data:(image\/[\w.+-]+);base64,/i);
        if(mm){mime=mm[1];raw=raw.substring(mm[0].length);}
        else raw=raw.replace(/^data:[^,]+,/i,'');
        raw=raw.replace(/[\s\r\n\t]+/g,'').replace(/[^A-Za-z0-9+/=_-]/g,'');
        let bytes;
        try{bytes=Utilities.base64Decode(raw);}catch(e){bytes=Utilities.base64DecodeWebSafe(raw);}
        const blob=Utilities.newBlob(bytes,mime,'signature');
        p.clear(); const im=p.appendInlineImage(blob); im.setWidth(62).setHeight(28);
      }catch(e){
        p.setText(raw.length<60?raw:'-').setFontSize(8);
        p.editAsText().setForegroundColor('#111827');
      }
    }

    rows.forEach((r,idx)=>{
      const tr=table.appendTableRow();
      if(idx%2===1){ for(let z=0;z<8;z++){} } // keep rows visually clean; no forced zebra color
      textCell(tr,r.tanggal,true,false); textCell(tr,r.ke,true,true); textCell(tr,r.siswa,false,true);
      textCell(tr,r.materi,false,false); textCell(tr,r.lagu,false,false);
      sigCell(tr,r.ttdGuru); sigCell(tr,r.ttdSiswa); textCell(tr,r.catatan,false,false);
    });

    body.appendParagraph('').setSpacingAfter(2);
    body.appendParagraph('Dokumen dibuat otomatis oleh sistem Legacy Guitar Class • Legacy Music Center')
      .setFontSize(7.5).setForegroundColor('#888888').setItalic(true)
      .setAlignment(DocumentApp.HorizontalAlignment.RIGHT).setSpacingBefore(5);

    doc.saveAndClose();
    return {success:true,message:'Dokumen periode '+periodLabel()+' berhasil dibuat.',docUrl:doc.getUrl(),period:periodLabel()};
  } catch(e) {
    return {success:false,message:'Gagal membuat dokumen: '+e.toString()};
  }
}

function paksaIzinDocs() {
  DocumentApp.create("Tes Izin Google Docs");
}
