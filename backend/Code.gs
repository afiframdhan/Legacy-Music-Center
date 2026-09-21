const ss = SpreadsheetApp.getActiveSpreadsheet();
const LEGACY_UPLOAD_ROOT_FOLDER_ID = '1RT0qG4utSornXTtDPbNE3-baeWmbyn4Q';

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
        headers: ['Nama', 'Grade', 'Email', 'Password', 'NoHP', 'TglDaftar', 'Status', 'FotoURL', 'Instrumen', 'Guru', 'TglKeluar', 'SiswaID', 'GuruID']
      },
      {
        name: 'Guru',
        headers: ['GuruID', 'Nama', 'Email', 'Password', 'NoHP', 'Instrumen', 'Status', 'FotoURL']
      },
      {
        name: 'KelasSiswa',
        headers: ['KelasSiswaID', 'SiswaID', 'NamaSiswa', 'Instrumen', 'GuruID', 'Guru', 'Grade', 'Status', 'TglMulai', 'TglSelesai']
      },
      {
        name: 'Admin',
        headers: ['AdminID', 'Nama', 'Email', 'Password', 'NoHP', 'FotoURL']
      },
      {
        name: 'Jadwal',
        headers: ['JadwalID', 'NamaSiswa', 'Hari', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'Instrumen', 'SiswaID', 'GuruID']
      },
      {
        name: 'Absensi',
        headers: ['AbsensiID', 'NamaSiswa', 'Tanggal', 'PertemuanKe', 'Status', 'Materi', 'Lagu', 'Catatan', 'TandaTangan', 'GuruCatat', 'TtdSiswa', 'SiswaID', 'GuruID']
      },
      {
        name: 'AbsensiGuru',
        headers: ['AbsensiGuruID', 'GuruID', 'NamaGuru', 'Tanggal', 'Status', 'JamMasuk', 'JamKeluar', 'Catatan', 'DicatatOleh']
      },
      {
        name: 'Tugas',
        headers: ['TugasID', 'NamaSiswa', 'JudulTugas', 'Deskripsi', 'Deadline', 'FileMateriUrl', 'Status', 'TanggalKirim', 'FileJawabanUrl', 'FileJawabanName', 'Guru', 'TipeTugas', 'FileMateriName', 'FileMateriType', 'FileMateriDownloadUrl', 'LampiranJSON', 'JawabanTeks', 'FileJawabanType', 'FileJawabanDownloadUrl', 'JawabanJSON', 'TanggalDibuat', 'YouTubeUrl', 'SiswaID', 'GuruID']
      },
      {
        name: 'ProgressBelajar',
        headers: ['ProgressID', 'NamaSiswa', 'Kelas', 'Level', 'Periode', 'OverallProgress', 'MateriStatus', 'MateriProgress', 'MateriCatatan', 'TeknikStatus', 'TeknikProgress', 'TeknikCatatan', 'TeoriStatus', 'TeoriProgress', 'TeoriCatatan', 'RepertoireStatus', 'RepertoireProgress', 'RepertoireCatatan', 'PracticeStatus', 'PracticeProgress', 'PracticeCatatan', 'PerformanceStatus', 'PerformanceProgress', 'PerformanceCatatan', 'EvaluasiStatus', 'EvaluasiProgress', 'EvaluasiCatatan', 'Kelebihan', 'PerluDitingkatkan', 'TargetBerikutnya', 'Guru', 'LastUpdated', 'TipePeriode', 'GuruSignatureUrl', 'GuruSignatureName', 'KepalaSekolahNama', 'KepalaSekolahSignatureUrl', 'KepalaSekolahSignatureName', 'PeriodeMulai', 'PeriodeSelesai', 'SiswaID', 'GuruID']
      },
      {
        name: 'JadwalPengganti',
        headers: ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada', 'SiswaID', 'GuruID']
      },
      {
        name: 'Pengumuman',
        headers: ['PengumumanID', 'Judul', 'Target', 'TargetDetail', 'Isi', 'Pembuat', 'TanggalKirim', 'Status', 'TargetSiswaID', 'PembuatID']
      },
      {
        name: 'RiwayatSiswa',
        headers: ['RiwayatID', 'NamaSiswa', 'Jenis', 'Tanggal', 'StatusSebelum', 'StatusSesudah', 'Instrumen', 'Guru', 'Keterangan', 'SiswaID', 'GuruID']
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
            currentHeaders.push('TtdSiswa');
          }
          if (sh.name !== 'Admin' && sh.name !== 'Guru') {
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
    ensureIdentitySystem_();
  } catch(e) {
    Logger.log("Setup error: " + e.toString());
  }
}

function headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(value => String(value || '').trim());
  const map = {};
  headers.forEach((header, index) => map[header] = index);
  return map;
}

function newPermanentID_(prefix) {
  return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function entityDirectory_(sheetName, idHeader, nameHeader) {
  const sheet = ss.getSheetByName(sheetName);
  const result = { byID: {}, byName: {}, rows: [] };
  if (!sheet || sheet.getLastRow() < 2) return result;
  const map = headerMap_(sheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][map[idHeader]] || '').trim();
    const name = String(data[i][map[nameHeader]] || '').trim();
    if (!id || !name) continue;
    const item = { id: id, name: name, row: i + 1, values: data[i], map: map };
    result.byID[id.toLowerCase()] = item;
    if (!result.byName[name.toLowerCase()]) result.byName[name.toLowerCase()] = item;
    result.rows.push(item);
  }
  return result;
}

function resolveStudent_(identifier) {
  const key = String(identifier || '').trim().toLowerCase();
  const directory = entityDirectory_('Siswa', 'SiswaID', 'Nama');
  return directory.byID[key] || directory.byName[key] || null;
}

function resolveTeacher_(identifier) {
  const key = String(identifier || '').trim().toLowerCase();
  const directory = entityDirectory_('Guru', 'GuruID', 'Nama');
  return directory.byID[key] || directory.byName[key] || null;
}

function rowMatchesEntity_(row, map, idHeader, nameHeader, entity) {
  if (!entity) return false;
  const rowID = map[idHeader] === undefined ? '' : String(row[map[idHeader]] || '').trim().toLowerCase();
  const rowName = map[nameHeader] === undefined ? '' : String(row[map[nameHeader]] || '').trim().toLowerCase();
  return (rowID && rowID === entity.id.toLowerCase()) || (!rowID && rowName === entity.name.toLowerCase());
}

function ensureStudentClassSheet_() {
  return ensureAcademySheet('KelasSiswa', ['KelasSiswaID', 'SiswaID', 'NamaSiswa', 'Instrumen', 'GuruID', 'Guru', 'Grade', 'Status', 'TglMulai', 'TglSelesai']);
}

function studentClassKey_(siswaID, instrumen, guruID, guruName) {
  return [String(siswaID || '').trim().toLowerCase(), String(instrumen || '').trim().toLowerCase(), String(guruID || guruName || '').trim().toLowerCase()].join('|');
}

function migrateStudentClasses_(students, teachers) {
  const sheet = ensureStudentClassSheet_();
  const map = headerMap_(sheet);
  const existingRows = sheet.getDataRange().getValues();
  const known = new Set();
  for (let i = 1; i < existingRows.length; i++) {
    const key = studentClassKey_(existingRows[i][map.SiswaID], existingRows[i][map.Instrumen], existingRows[i][map.GuruID], existingRows[i][map.Guru]);
    if (String(existingRows[i][map.SiswaID] || '').trim()) known.add(key);
  }
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const appendClass = function(student, instrumen, teacher, grade, status, startDate, endDate) {
    if (!student || !String(instrumen || '').trim()) return;
    const key = studentClassKey_(student.id, instrumen, teacher ? teacher.id : '', teacher ? teacher.name : '');
    if (known.has(key)) return;
    const record = {
      KelasSiswaID: newPermanentID_('KLS'), SiswaID: student.id, NamaSiswa: student.name,
      Instrumen: String(instrumen || 'Gitar').trim(), GuruID: teacher ? teacher.id : '', Guru: teacher ? teacher.name : '',
      Grade: String(grade || 'Beginner').trim(), Status: String(status || 'Aktif').trim(),
      TglMulai: startDate || '', TglSelesai: endDate || ''
    };
    sheet.appendRow(headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''));
    known.add(key);
  };

  const siswaSheet = ss.getSheetByName('Siswa');
  if (siswaSheet && siswaSheet.getLastRow() >= 2) {
    const siswaMap = headerMap_(siswaSheet);
    const rows = siswaSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const student = students.byID[String(rows[i][siswaMap.SiswaID] || '').trim().toLowerCase()];
      const teacher = teachers.byID[String(rows[i][siswaMap.GuruID] || '').trim().toLowerCase()] || teachers.byName[String(rows[i][siswaMap.Guru] || '').trim().toLowerCase()];
      appendClass(student, rows[i][siswaMap.Instrumen], teacher, rows[i][siswaMap.Grade], rows[i][siswaMap.Status], rows[i][siswaMap.TglDaftar], rows[i][siswaMap.TglKeluar]);
    }
  }

  const jadwalSheet = ss.getSheetByName('Jadwal');
  if (jadwalSheet && jadwalSheet.getLastRow() >= 2) {
    const jadwalMap = headerMap_(jadwalSheet);
    const rows = jadwalSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const student = students.byID[String(rows[i][jadwalMap.SiswaID] || '').trim().toLowerCase()] || students.byName[String(rows[i][jadwalMap.NamaSiswa] || '').trim().toLowerCase()];
      const teacher = teachers.byID[String(rows[i][jadwalMap.GuruID] || '').trim().toLowerCase()] || teachers.byName[String(rows[i][jadwalMap.Guru] || '').trim().toLowerCase()];
      appendClass(student, rows[i][jadwalMap.Instrumen], teacher, '', rows[i][jadwalMap.Status], '', '');
    }
  }
}

function getStudentClasses_(siswaID, guruID) {
  const sheet = ensureStudentClassSheet_();
  if (sheet.getLastRow() < 2) return [];
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();
  const studentKey = String(siswaID || '').trim().toLowerCase();
  const teacherKey = String(guruID || '').trim().toLowerCase();
  const schedules = ss.getSheetByName('Jadwal');
  const scheduleRows = schedules ? schedules.getDataRange().getValues() : [];
  const scheduleMap = schedules ? headerMap_(schedules) : {};
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map.SiswaID] || '').trim().toLowerCase() !== studentKey) continue;
    const rowTeacherID = String(rows[i][map.GuruID] || '').trim().toLowerCase();
    if (teacherKey && rowTeacherID !== teacherKey) continue;
    const item = {
      kelasSiswaID: rows[i][map.KelasSiswaID], siswaID: rows[i][map.SiswaID], namaSiswa: rows[i][map.NamaSiswa],
      instrumen: rows[i][map.Instrumen] || 'Gitar', guruID: rows[i][map.GuruID] || '', guru: rows[i][map.Guru] || '',
      grade: rows[i][map.Grade] || 'Beginner', status: rows[i][map.Status] || 'Aktif',
      tglMulai: normalizeAcademyDate(rows[i][map.TglMulai]), tglSelesai: normalizeAcademyDate(rows[i][map.TglSelesai])
    };
    for (let j = 1; j < scheduleRows.length; j++) {
      const sameStudent = String(scheduleRows[j][scheduleMap.SiswaID] || '').trim().toLowerCase() === studentKey;
      const sameInstrument = String(scheduleRows[j][scheduleMap.Instrumen] || '').trim().toLowerCase() === String(item.instrumen).trim().toLowerCase();
      const scheduleTeacherID = String(scheduleRows[j][scheduleMap.GuruID] || '').trim().toLowerCase();
      const sameTeacher = item.guruID ? scheduleTeacherID === String(item.guruID).toLowerCase() : String(scheduleRows[j][scheduleMap.Guru] || '').trim().toLowerCase() === String(item.guru).toLowerCase();
      if (sameStudent && sameInstrument && sameTeacher) {
        item.jadwalID = scheduleRows[j][scheduleMap.JadwalID] || '';
        item.hari = scheduleRows[j][scheduleMap.Hari] || '';
        item.jamMulai = formatTime(scheduleRows[j][scheduleMap.JamMulai]);
        item.jamSelesai = formatTime(scheduleRows[j][scheduleMap.JamSelesai]);
        item.ruangan = scheduleRows[j][scheduleMap.Ruangan] || '';
        break;
      }
    }
    result.push(item);
  }
  return result;
}

function getStudentClassIndex_() {
  const result = {};
  const sheet = ensureStudentClassSheet_();
  if (sheet.getLastRow() < 2) return result;
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();
  const schedules = ss.getSheetByName('Jadwal');
  const scheduleRows = schedules ? schedules.getDataRange().getValues() : [];
  const scheduleMap = schedules ? headerMap_(schedules) : {};
  for (let i = 1; i < rows.length; i++) {
    const studentKey = String(rows[i][map.SiswaID] || '').trim().toLowerCase();
    if (!studentKey) continue;
    const item = {
      kelasSiswaID: rows[i][map.KelasSiswaID], siswaID: rows[i][map.SiswaID], namaSiswa: rows[i][map.NamaSiswa],
      instrumen: rows[i][map.Instrumen] || 'Gitar', guruID: rows[i][map.GuruID] || '', guru: rows[i][map.Guru] || '',
      grade: rows[i][map.Grade] || 'Beginner', status: rows[i][map.Status] || 'Aktif',
      tglMulai: normalizeAcademyDate(rows[i][map.TglMulai]), tglSelesai: normalizeAcademyDate(rows[i][map.TglSelesai])
    };
    for (let j = 1; j < scheduleRows.length; j++) {
      const sameStudent = String(scheduleRows[j][scheduleMap.SiswaID] || '').trim().toLowerCase() === studentKey;
      const sameInstrument = String(scheduleRows[j][scheduleMap.Instrumen] || '').trim().toLowerCase() === String(item.instrumen).trim().toLowerCase();
      const scheduleTeacherID = String(scheduleRows[j][scheduleMap.GuruID] || '').trim().toLowerCase();
      const sameTeacher = item.guruID ? scheduleTeacherID === String(item.guruID).toLowerCase() : String(scheduleRows[j][scheduleMap.Guru] || '').trim().toLowerCase() === String(item.guru).toLowerCase();
      if (sameStudent && sameInstrument && sameTeacher) {
        item.jadwalID = scheduleRows[j][scheduleMap.JadwalID] || ''; item.hari = scheduleRows[j][scheduleMap.Hari] || '';
        item.jamMulai = formatTime(scheduleRows[j][scheduleMap.JamMulai]); item.jamSelesai = formatTime(scheduleRows[j][scheduleMap.JamSelesai]);
        item.ruangan = scheduleRows[j][scheduleMap.Ruangan] || ''; break;
      }
    }
    if (!result[studentKey]) result[studentKey] = [];
    result[studentKey].push(item);
  }
  return result;
}

function normalizeStudentClasses_(data, fallbackStudent, fallbackTeacher) {
  const incoming = Array.isArray(data.kelasList) && data.kelasList.length ? data.kelasList : [{
    kelasSiswaID: data.kelasSiswaID || '', instrumen: data.instrumen, guruID: data.guruID || '', guru: data.guru,
    grade: data.kelas, status: data.status, hari: data.hari, jamMulai: data.jamMulai, jamSelesai: data.jamSelesai,
    ruangan: data.ruangan, jadwalID: data.jadwalID || ''
  }];
  return incoming.map(function(item) {
    const teacher = resolveTeacher_(item.guruID || item.guru || (fallbackTeacher ? fallbackTeacher.id : ''));
    return {
      kelasSiswaID: String(item.kelasSiswaID || '').trim(), instrumen: String(item.instrumen || 'Gitar').trim(),
      guruID: teacher ? teacher.id : '', guru: teacher ? teacher.name : String(item.guru || '').trim(),
      grade: String(item.grade || item.kelas || data.kelas || 'Beginner').trim(), status: String(item.status || data.status || 'Aktif').trim(),
      hari: String(item.hari || '').trim(), jamMulai: String(item.jamMulai || '').trim(), jamSelesai: String(item.jamSelesai || '').trim(),
      ruangan: String(item.ruangan || '').trim(), jadwalID: String(item.jadwalID || '').trim()
    };
  }).filter(item => item.instrumen && (item.guruID || item.guru));
}

function saveStudentClasses_(student, classes, options) {
  options = options || {};
  const classSheet = ensureStudentClassSheet_();
  const classMap = headerMap_(classSheet);
  const classHeaders = classSheet.getRange(1, 1, 1, classSheet.getLastColumn()).getValues()[0].map(String);
  const existing = classSheet.getDataRange().getValues();
  const retainedIDs = new Set();
  const startDate = options.tglDaftar || '';
  const endDate = options.tglKeluar || '';
  classes.forEach(function(item) {
    let targetRow = 0;
    let classID = item.kelasSiswaID;
    for (let i = 1; i < existing.length; i++) {
      const sameID = classID && String(existing[i][classMap.KelasSiswaID] || '').trim() === classID;
      const sameKey = !classID && studentClassKey_(existing[i][classMap.SiswaID], existing[i][classMap.Instrumen], existing[i][classMap.GuruID], existing[i][classMap.Guru]) === studentClassKey_(student.id, item.instrumen, item.guruID, item.guru);
      if (sameID || sameKey) { targetRow = i + 1; classID = String(existing[i][classMap.KelasSiswaID] || classID); break; }
    }
    if (!classID) classID = newPermanentID_('KLS');
    retainedIDs.add(classID);
    const record = { KelasSiswaID:classID, SiswaID:student.id, NamaSiswa:student.name, Instrumen:item.instrumen, GuruID:item.guruID, Guru:item.guru, Grade:item.grade, Status:item.status, TglMulai:startDate, TglSelesai:endDate };
    const values = classHeaders.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '');
    if (targetRow) classSheet.getRange(targetRow, 1, 1, values.length).setValues([values]); else classSheet.appendRow(values);
    saveStudentClassSchedule_(student, item);
  });
  if (options.replaceAll && classSheet.getLastRow() >= 2) {
    const rows = classSheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][classMap.SiswaID] || '').trim().toLowerCase() === student.id.toLowerCase() && !retainedIDs.has(String(rows[i][classMap.KelasSiswaID] || '').trim())) {
        deleteStudentClassSchedules_(student.id, rows[i][classMap.Instrumen], rows[i][classMap.GuruID], rows[i][classMap.Guru]);
        classSheet.deleteRow(i + 1);
      }
    }
  }
}

function deleteStudentClassSchedules_(siswaID, instrumen, guruID, guruName) {
  const sheet = ss.getSheetByName('Jadwal');
  if (!sheet || sheet.getLastRow() < 2) return;
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const sameStudent = String(rows[i][map.SiswaID] || '').trim().toLowerCase() === String(siswaID || '').trim().toLowerCase();
    const sameInstrument = String(rows[i][map.Instrumen] || '').trim().toLowerCase() === String(instrumen || '').trim().toLowerCase();
    const rowGuruID = String(rows[i][map.GuruID] || '').trim().toLowerCase();
    const sameTeacher = guruID ? rowGuruID === String(guruID).trim().toLowerCase() : String(rows[i][map.Guru] || '').trim().toLowerCase() === String(guruName || '').trim().toLowerCase();
    if (sameStudent && sameInstrument && sameTeacher) sheet.deleteRow(i + 1);
  }
}

function saveStudentClassSchedule_(student, item) {
  if (!item.hari || !item.jamMulai || !item.jamSelesai || !item.ruangan) return;
  const sheet = ensureAcademySheet('Jadwal', ['JadwalID','NamaSiswa','Hari','JamMulai','JamSelesai','Guru','Ruangan','Status','Instrumen','SiswaID','GuruID']);
  const map = headerMap_(sheet);
  const rows = sheet.getDataRange().getValues();
  let targetRow = 0;
  let jadwalID = item.jadwalID;
  for (let i = 1; i < rows.length; i++) {
    if (jadwalID && String(rows[i][map.JadwalID] || '').trim() === jadwalID) { targetRow = i + 1; break; }
  }
  const conflict = findRoomScheduleConflict(item.ruangan, item.hari, '', item.jamMulai, item.jamSelesai, jadwalID, '');
  if (conflict) throw new Error(roomConflictMessage(conflict, item.ruangan));
  if (!jadwalID) jadwalID = newPermanentID_('JDW');
  const record = { JadwalID:jadwalID, NamaSiswa:student.name, Hari:item.hari, JamMulai:item.jamMulai, JamSelesai:item.jamSelesai, Guru:item.guru, Ruangan:item.ruangan, Status:item.status, Instrumen:item.instrumen, SiswaID:student.id, GuruID:item.guruID };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const values = headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '');
  if (targetRow) sheet.getRange(targetRow, 1, 1, values.length).setValues([values]); else sheet.appendRow(values);
}

function ensureIdentitySystem_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const guruSheet = ensureAcademySheet('Guru', ['GuruID', 'Nama', 'Email', 'Password', 'NoHP', 'Instrumen', 'Status', 'FotoURL']);
    const siswaSheet = ensureAcademySheet('Siswa', ['Nama', 'Grade', 'Email', 'Password', 'NoHP', 'TglDaftar', 'Status', 'FotoURL', 'Instrumen', 'Guru', 'TglKeluar', 'SiswaID', 'GuruID']);
    const guruMap = headerMap_(guruSheet);
    const siswaMap = headerMap_(siswaSheet);
    if (guruSheet.getLastRow() >= 2) {
      const values = guruSheet.getRange(2, 1, guruSheet.getLastRow() - 1, guruSheet.getLastColumn()).getValues();
      values.forEach((row, index) => {
        if (String(row[guruMap.Nama] || '').trim() && !String(row[guruMap.GuruID] || '').trim()) {
          guruSheet.getRange(index + 2, guruMap.GuruID + 1).setValue(newPermanentID_('GRU'));
        }
      });
    }
    if (siswaSheet.getLastRow() >= 2) {
      const values = siswaSheet.getRange(2, 1, siswaSheet.getLastRow() - 1, siswaSheet.getLastColumn()).getValues();
      values.forEach((row, index) => {
        if (String(row[siswaMap.Nama] || '').trim() && !String(row[siswaMap.SiswaID] || '').trim()) {
          siswaSheet.getRange(index + 2, siswaMap.SiswaID + 1).setValue(newPermanentID_('SIS'));
        }
      });
    }
    SpreadsheetApp.flush();

    const teachers = entityDirectory_('Guru', 'GuruID', 'Nama');
    const students = entityDirectory_('Siswa', 'SiswaID', 'Nama');
    if (siswaSheet.getLastRow() >= 2) {
      const values = siswaSheet.getRange(2, 1, siswaSheet.getLastRow() - 1, siswaSheet.getLastColumn()).getValues();
      values.forEach((row, index) => {
        const teacherName = String(row[siswaMap.Guru] || '').trim().toLowerCase();
        const teacher = teachers.byName[teacherName];
        if (teacher && String(row[siswaMap.GuruID] || '').trim() !== teacher.id) {
          siswaSheet.getRange(index + 2, siswaMap.GuruID + 1).setValue(teacher.id);
        }
      });
    }
    migrateStudentClasses_(students, teachers);

    const relations = [
      ['Jadwal', ['JadwalID','NamaSiswa','Hari','JamMulai','JamSelesai','Guru','Ruangan','Status','Instrumen','SiswaID','GuruID'], 'NamaSiswa', 'SiswaID', 'Guru', 'GuruID'],
      ['Absensi', ['AbsensiID','NamaSiswa','Tanggal','PertemuanKe','Status','Materi','Lagu','Catatan','TandaTangan','GuruCatat','TtdSiswa','SiswaID','GuruID'], 'NamaSiswa', 'SiswaID', 'GuruCatat', 'GuruID'],
      ['Tugas', ['TugasID','NamaSiswa','JudulTugas','Deskripsi','Deadline','FileMateriUrl','Status','TanggalKirim','FileJawabanUrl','FileJawabanName','Guru','TipeTugas','FileMateriName','FileMateriType','FileMateriDownloadUrl','LampiranJSON','JawabanTeks','FileJawabanType','FileJawabanDownloadUrl','JawabanJSON','TanggalDibuat','YouTubeUrl','SiswaID','GuruID'], 'NamaSiswa', 'SiswaID', 'Guru', 'GuruID'],
      ['ProgressBelajar', ['ProgressID','NamaSiswa','Kelas','Level','Periode','OverallProgress','MateriStatus','MateriProgress','MateriCatatan','TeknikStatus','TeknikProgress','TeknikCatatan','TeoriStatus','TeoriProgress','TeoriCatatan','RepertoireStatus','RepertoireProgress','RepertoireCatatan','PracticeStatus','PracticeProgress','PracticeCatatan','PerformanceStatus','PerformanceProgress','PerformanceCatatan','EvaluasiStatus','EvaluasiProgress','EvaluasiCatatan','Kelebihan','PerluDitingkatkan','TargetBerikutnya','Guru','LastUpdated','TipePeriode','GuruSignatureUrl','GuruSignatureName','KepalaSekolahNama','KepalaSekolahSignatureUrl','KepalaSekolahSignatureName','PeriodeMulai','PeriodeSelesai','SiswaID','GuruID'], 'NamaSiswa', 'SiswaID', 'Guru', 'GuruID'],
      ['JadwalPengganti', ['PenggantiID','JadwalID','NamaSiswa','Alasan','TanggalPelaksanaan','JamMulai','JamSelesai','Guru','Ruangan','Status','DibuatPada','SiswaID','GuruID'], 'NamaSiswa', 'SiswaID', 'Guru', 'GuruID'],
      ['RiwayatSiswa', ['RiwayatID','NamaSiswa','Jenis','Tanggal','StatusSebelum','StatusSesudah','Instrumen','Guru','Keterangan','SiswaID','GuruID'], 'NamaSiswa', 'SiswaID', 'Guru', 'GuruID']
    ];
    relations.forEach(config => {
      const sheet = ensureAcademySheet(config[0], config[1]);
      if (sheet.getLastRow() < 2) return;
      const map = headerMap_(sheet);
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      const updates = [];
      values.forEach((row, index) => {
        const student = students.byName[String(row[map[config[2]]] || '').trim().toLowerCase()];
        const teacher = teachers.byName[String(row[map[config[4]]] || '').trim().toLowerCase()];
        if (student && !String(row[map[config[3]]] || '').trim()) updates.push([index + 2, map[config[3]] + 1, student.id]);
        if (teacher && !String(row[map[config[5]]] || '').trim()) updates.push([index + 2, map[config[5]] + 1, teacher.id]);
      });
      updates.forEach(update => sheet.getRange(update[0], update[1]).setValue(update[2]));
    });

    const announcements = ensureAcademySheet('Pengumuman', ['PengumumanID','Judul','Target','TargetDetail','Isi','Pembuat','TanggalKirim','Status','TargetSiswaID','PembuatID']);
    if (announcements.getLastRow() >= 2) {
      const map = headerMap_(announcements);
      const values = announcements.getRange(2, 1, announcements.getLastRow() - 1, announcements.getLastColumn()).getValues();
      values.forEach((row, index) => {
        const student = students.byName[String(row[map.TargetDetail] || '').trim().toLowerCase()];
        const creator = teachers.byName[String(row[map.Pembuat] || '').trim().toLowerCase()];
        if (student && !String(row[map.TargetSiswaID] || '').trim()) announcements.getRange(index + 2, map.TargetSiswaID + 1).setValue(student.id);
        if (creator && !String(row[map.PembuatID] || '').trim()) announcements.getRange(index + 2, map.PembuatID + 1).setValue(creator.id);
      });
    }
    SpreadsheetApp.flush();
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function syncEntityDisplayName_(entityType, entityID, oldName, newName) {
  const isStudent = entityType === 'siswa';
  const configs = isStudent ? [
    ['KelasSiswa','NamaSiswa','SiswaID'],
    ['Jadwal','NamaSiswa','SiswaID'], ['Absensi','NamaSiswa','SiswaID'], ['Tugas','NamaSiswa','SiswaID'],
    ['ProgressBelajar','NamaSiswa','SiswaID'], ['JadwalPengganti','NamaSiswa','SiswaID'], ['RiwayatSiswa','NamaSiswa','SiswaID']
  ] : [
    ['KelasSiswa','Guru','GuruID'],
    ['Siswa','Guru','GuruID'], ['Jadwal','Guru','GuruID'], ['Absensi','GuruCatat','GuruID'], ['Tugas','Guru','GuruID'],
    ['ProgressBelajar','Guru','GuruID'], ['JadwalPengganti','Guru','GuruID'], ['RiwayatSiswa','Guru','GuruID']
  ];
  configs.forEach(config => {
    const sheet = ss.getSheetByName(config[0]);
    if (!sheet || sheet.getLastRow() < 2) return;
    const map = headerMap_(sheet);
    if (map[config[1]] === undefined || map[config[2]] === undefined) return;
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    values.forEach((row, index) => {
      const sameID = String(row[map[config[2]]] || '').trim().toLowerCase() === String(entityID || '').trim().toLowerCase();
      const legacyMatch = !String(row[map[config[2]]] || '').trim() && String(row[map[config[1]]] || '').trim().toLowerCase() === String(oldName || '').trim().toLowerCase();
      if (sameID || legacyMatch) sheet.getRange(index + 2, map[config[1]] + 1).setValue(newName);
    });
  });
  if (isStudent) {
    const sheet = ss.getSheetByName('Pengumuman');
    if (sheet && sheet.getLastRow() >= 2) {
      const map = headerMap_(sheet);
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      values.forEach((row, index) => {
        if (String(row[map.TargetSiswaID] || '').trim().toLowerCase() === String(entityID || '').trim().toLowerCase()) sheet.getRange(index + 2, map.TargetDetail + 1).setValue(newName);
      });
    }
  }
}

function verifyLogin(userType, username, password) {
  try {
    ensureIdentitySystem_();
    userType = String(userType || '').trim().toLowerCase();
    username = String(username || '').trim();
    
    let sheetName = 'Siswa';
    if (userType === 'guru') sheetName = 'Guru';
    if (userType === 'admin') sheetName = 'Admin';

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: 'Database belum tersedia.' };

    const data = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);

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
        const uName = String(data[i][columns.Nama] || '').trim();
        const siswaID = String(data[i][columns.SiswaID] || '').trim();
        const pass = String(data[i][columns.Password] || '');
        const status = String(data[i][columns.Status] || 'Aktif').trim();

        if ((uName.toLowerCase() === username.toLowerCase() || siswaID.toLowerCase() === username.toLowerCase()) && pass === password) {
          if (status && status.toLowerCase() !== 'aktif') return { success: false, message: 'Akun tidak aktif.' };
          return { success: true, userID: siswaID, userName: uName, userType: 'siswa' };
        }
      }
    }
    return { success: false, message: 'Username / Password salah.' };
  } catch (e) { return { success: false, message: 'Error: ' + e.toString() }; }
}

function getDashboardData(userID, userType) {
  try {
    ensureIdentitySystem_();
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
    const studentEntity = resolveStudent_(userID);
    if (!studentEntity) return serializeDashboardData({ success: false, error: 'Data siswa tidak ditemukan.' });
    const siswaColumns = headerMap_(siswaSheet);

    for (let i = 1; i < siswaData.length; i++) {
      if (rowMatchesEntity_(siswaData[i], siswaColumns, 'SiswaID', 'Nama', studentEntity)) {
        const studentClasses = getStudentClasses_(studentEntity.id);
        siswaInfo = { 
          userID: studentEntity.id,
          nama: siswaData[i][0], 
          kelas: siswaData[i][1], 
          email: siswaData[i][2], 
          noHp: siswaData[i][4], 
          instrumen: [...new Set(studentClasses.map(item => String(item.instrumen || '').trim()).filter(Boolean))].join(', ') || siswaData[i][8] || 'Gitar',
          foto: siswaData[i][7] || '',
          guru: [...new Set(studentClasses.map(item => String(item.guru || '').trim()).filter(Boolean))].join(', ') || siswaData[i][9] || '',
          kelasList: studentClasses
        };
        break;
      }
    }

    const schedules = [];
    const jData = jadwalSheet ? jadwalSheet.getDataRange().getValues() : [];
    const jadwalColumns = jadwalSheet ? headerMap_(jadwalSheet) : {};
    for (let i = 1; i < jData.length; i++) {
      if (rowMatchesEntity_(jData[i], jadwalColumns, 'SiswaID', 'NamaSiswa', studentEntity) && String(jData[i][7] || 'Aktif').toLowerCase() === 'aktif') {
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
      const absensiColumns = headerMap_(absensiSheet);
      for (let i = 1; i < aData.length; i++) {
        if (rowMatchesEntity_(aData[i], absensiColumns, 'SiswaID', 'NamaSiswa', studentEntity)) {
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
      tugasList: getTugasData(studentEntity.id, 'siswa'),
      learningProgressList: getLearningProgressData(studentEntity.id, 'siswa'),
      jadwalPenggantiList: getJadwalPenggantiData(studentEntity.id, 'siswa'),
      pengumumanList: getPengumumanData(studentEntity.id, 'siswa')
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
    const siswaColumns = siswaSheet ? headerMap_(siswaSheet) : {};
    const studentClassIndex = getStudentClassIndex_();
    for (let i = 1; i < sData.length; i++) {
      const studentClasses = studentClassIndex[String(sData[i][siswaColumns.SiswaID] || '').trim().toLowerCase()] || [];
      const classInstruments = [...new Set(studentClasses.map(item => String(item.instrumen || '').trim()).filter(Boolean))];
      const classTeachers = [...new Set(studentClasses.map(item => String(item.guru || '').trim()).filter(Boolean))];
      const classGrades = [...new Set(studentClasses.map(item => String(item.grade || '').trim()).filter(Boolean))];
      siswaList.push({ 
        siswaID: sData[i][siswaColumns.SiswaID] || '', guruID: sData[i][siswaColumns.GuruID] || '',
        nama: String(sData[i][0]).trim(), kelas: classGrades.join(', ') || sData[i][1], email: sData[i][2], noHp: sData[i][4], 
        status: String(sData[i][6]).trim(), foto: sData[i][7] || '', instrumen: classInstruments.join(', ') || sData[i][8] || 'Gitar', guru: classTeachers.join(', ') || sData[i][9] || '-', kelasList: studentClasses,
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
      teacherAttendanceList: getTeacherAttendanceData('admin'),
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
    const teacherEntity = resolveTeacher_(userID);
    if (!teacherEntity) return { success: false, error: 'Data guru tidak ditemukan.' };

    const guruKey = teacherEntity.id.toLowerCase();
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
    const siswaColumns = siswaSheet ? headerMap_(siswaSheet) : {};
    const studentClassIndex = getStudentClassIndex_();
    for (let i = 1; i < sData.length; i++) {
      const semuaSiswaNama = String(sData[i][0] || '').trim();
      if (semuaSiswaNama) semuaSiswaNamaSet.add(semuaSiswaNama.toLowerCase());
      const guruSiswa = String(sData[i][9] || '').trim();
      const guruSiswaID = String(sData[i][siswaColumns.GuruID] || '').trim();
      const allStudentClasses = studentClassIndex[String(sData[i][siswaColumns.SiswaID] || '').trim().toLowerCase()] || [];
      const teacherClasses = allStudentClasses.filter(item => String(item.guruID || '').trim().toLowerCase() === teacherEntity.id.toLowerCase());
      if (teacherClasses.length || (!guruSiswa && !allStudentClasses.length) || guruSiswaID.toLowerCase() === teacherEntity.id.toLowerCase() || (!guruSiswaID && guruSiswa.toLowerCase() === namaGuruAktif.toLowerCase())) {
        const sNama = String(sData[i][0]).trim();
        siswaNamaSet.add(sNama.toLowerCase());
        const classInstruments = [...new Set(teacherClasses.map(item => String(item.instrumen || '').trim()).filter(Boolean))];
        const classGrades = [...new Set(teacherClasses.map(item => String(item.grade || '').trim()).filter(Boolean))];
        siswaList.push({ 
          siswaID: sData[i][siswaColumns.SiswaID] || '', guruID: guruSiswaID,
          nama: sNama, kelas: classGrades.join(', ') || sData[i][1], email: sData[i][2], noHp: sData[i][4], 
          status: String(sData[i][6]).trim(), foto: sData[i][7] || '', instrumen: classInstruments.join(', ') || sData[i][8] || 'Gitar', guru: namaGuruAktif, kelasList: teacherClasses,
          tglDaftar: normalizeAcademyDate(sData[i][5]), tglKeluar: normalizeAcademyDate(sData[i][10])
        });
      }
    }

    const daysNameMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayHariName = daysNameMap[new Date().getDay()].toLowerCase();

    let sesiJadwalHariIniCount = 0;
    const jadwal = [];
    const jData = jadwalSheet ? jadwalSheet.getDataRange().getValues() : [];
    const jadwalColumns = jadwalSheet ? headerMap_(jadwalSheet) : {};
    for (let i = 1; i < jData.length; i++) {
      const guruJadwal = String(jData[i][5] || '').trim();
      const jadwalGuruID = String(jData[i][jadwalColumns.GuruID] || '').trim();
      if (jadwalGuruID.toLowerCase() === teacherEntity.id.toLowerCase() || (!jadwalGuruID && guruJadwal.toLowerCase() === namaGuruAktif.toLowerCase())) {
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
      const absensiColumns = headerMap_(absensiSheet);
      for (let i = 1; i < aData.length; i++) {
        const sNama = String(aData[i][1]).trim().toLowerCase();
        const guruCatat = String(aData[i][9] || '').trim().toLowerCase();
        const guruCatatID = String(aData[i][absensiColumns.GuruID] || '').trim().toLowerCase();
        if (guruCatatID === teacherEntity.id.toLowerCase() || (!guruCatatID && guruCatat === namaGuruAktif.toLowerCase()) || (!guruCatatID && !guruCatat && siswaNamaSet.has(sNama))) {
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
      tugasList: getTugasData(teacherEntity.id, 'guru'),
      learningProgressList: getLearningProgressData(teacherEntity.id, 'guru'),
      jadwalPenggantiList: getJadwalPenggantiData(teacherEntity.id, 'guru'),
      pengumumanList: getPengumumanData(teacherEntity.id, 'guru')
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
        guruList.push({ id: data[i][0], nama: data[i][1], email: data[i][2] || '', noHp: data[i][4] || '', instrumen: data[i][5] || 'Gitar', status: data[i][6] || 'Aktif', foto: data[i][7] || '' });
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


function updateGuru(payload, requesterType) {
  try {
    if (String(requesterType || '').trim().toLowerCase() !== 'admin') return { success:false, message:'Hanya admin yang dapat mengubah data guru.' };
    payload = payload || {};
    const originalID = String(payload.originalGuruID || payload.guruID || '').trim();
    if (!originalID) return { success:false, message:'Data guru yang akan diedit tidak ditemukan.' };
    const sheet = ensureAcademySheet('Guru', ['GuruID', 'Nama', 'Email', 'Password', 'NoHP', 'Instrumen', 'Status', 'FotoURL']);
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i=1;i<data.length;i++) if (String(data[i][0] || '').trim().toLowerCase() === originalID.toLowerCase()) { rowIndex=i; break; }
    if (rowIndex < 0) return { success:false, message:'Guru tidak ditemukan.' };
    const nama = String(payload.nama || '').trim();
    const email = String(payload.email || '').trim();
    if (!nama) return { success:false, message:'Nama guru wajib diisi.' };
    for (let i=1;i<data.length;i++) {
      if (i === rowIndex) continue;
      if (String(data[i][1] || '').trim().toLowerCase() === nama.toLowerCase()) return { success:false, message:'Nama guru sudah digunakan.' };
      if (email && String(data[i][2] || '').trim().toLowerCase() === email.toLowerCase()) return { success:false, message:'Email guru sudah digunakan.' };
    }
    const password = String(payload.password || '') || String(data[rowIndex][3] || '');
    sheet.getRange(rowIndex+1, 2, 1, 6).setValues([[nama, email, password, String(payload.noHp || '').trim(), String(payload.instrumen || '').trim(), String(payload.status || 'Aktif').trim()]]);
    SpreadsheetApp.flush();
    return { success:true, message:'Data guru ' + nama + ' berhasil diperbarui.' };
  } catch(e) { return { success:false, message:'Gagal memperbarui guru: ' + e.toString() }; }
}

function deleteGuru(identifier, requesterType) {
  try {
    if (String(requesterType || '').trim().toLowerCase() !== 'admin') return { success:false, message:'Hanya admin yang dapat menghapus guru.' };
    const teacher = resolveTeacher_(identifier);
    if (!teacher) return { success:false, message:'Guru tidak ditemukan.' };
    const siswaSheet = ss.getSheetByName('Siswa');
    if (siswaSheet) {
      const data=siswaSheet.getDataRange().getValues(), col=headerMap_(siswaSheet);
      for (let i=1;i<data.length;i++) {
        const gid = col.GuruID !== undefined ? String(data[i][col.GuruID] || '').trim().toLowerCase() : '';
        const gname = col.Guru !== undefined ? String(data[i][col.Guru] || '').trim().toLowerCase() : '';
        const status = col.Status !== undefined ? String(data[i][col.Status] || '').trim().toLowerCase() : '';
        if ((gid === teacher.id.toLowerCase() || (!gid && gname === teacher.name.toLowerCase())) && status !== 'keluar') return { success:false, message:'Guru masih terhubung dengan siswa aktif. Pindahkan guru siswa terlebih dahulu sebelum menghapus.' };
      }
    }
    const kelasSheet = ss.getSheetByName('KelasSiswa');
    if (kelasSheet) {
      const data=kelasSheet.getDataRange().getValues(), col=headerMap_(kelasSheet);
      for (let i=1;i<data.length;i++) {
        const gid = col.GuruID !== undefined ? String(data[i][col.GuruID] || '').trim().toLowerCase() : '';
        const gname = col.Guru !== undefined ? String(data[i][col.Guru] || '').trim().toLowerCase() : '';
        const status = col.Status !== undefined ? String(data[i][col.Status] || 'Aktif').trim().toLowerCase() : 'aktif';
        if ((gid === teacher.id.toLowerCase() || (!gid && gname === teacher.name.toLowerCase())) && status !== 'nonaktif' && status !== 'selesai') return { success:false, message:'Guru masih terhubung dengan kelas siswa aktif. Pindahkan guru pada kelas tersebut terlebih dahulu.' };
      }
    }
    const jadwalSheet = ss.getSheetByName('Jadwal');
    if (jadwalSheet) {
      const data=jadwalSheet.getDataRange().getValues();
      for (let i=1;i<data.length;i++) if (String(data[i][5] || '').trim().toLowerCase() === teacher.name.toLowerCase() && String(data[i][7] || 'Aktif').trim().toLowerCase() !== 'nonaktif') return { success:false, message:'Guru masih memiliki jadwal aktif. Ubah atau hapus jadwal terlebih dahulu.' };
    }
    const sheet=ss.getSheetByName('Guru');
    const data=sheet.getDataRange().getValues();
    for (let i=1;i<data.length;i++) if (String(data[i][0] || '').trim().toLowerCase() === teacher.id.toLowerCase()) { sheet.deleteRow(i+1); return { success:true, message:'Guru ' + teacher.name + ' berhasil dihapus.' }; }
    return { success:false, message:'Guru tidak ditemukan.' };
  } catch(e) { return { success:false, message:'Gagal menghapus guru: ' + e.toString() }; }
}

function ensureTeacherAttendanceSheet_() {
  return ensureAcademySheet('AbsensiGuru', ['AbsensiGuruID', 'GuruID', 'NamaGuru', 'Tanggal', 'Status', 'JamMasuk', 'JamKeluar', 'Catatan', 'DicatatOleh', 'TandaTangan']);
}

function getTeacherAttendanceData(requesterType) {
  try {
    if (String(requesterType || '').trim().toLowerCase() !== 'admin') return [];
    const sheet = ensureTeacherAttendanceSheet_();
    const data = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);
    const list = [];
    for (let i = 1; i < data.length; i++) {
      if (!data[i][columns.NamaGuru] && !data[i][columns.GuruID]) continue;
      list.push({
        absensiGuruID: data[i][columns.AbsensiGuruID] || '',
        guruID: data[i][columns.GuruID] || '',
        namaGuru: data[i][columns.NamaGuru] || '',
        tanggal: normalizeAcademyDate(data[i][columns.Tanggal]),
        status: data[i][columns.Status] || '',
        jamMasuk: formatTime(data[i][columns.JamMasuk]),
        jamKeluar: formatTime(data[i][columns.JamKeluar]),
        catatan: data[i][columns.Catatan] || '',
        dicatatOleh: data[i][columns.DicatatOleh] || '',
        tandaTangan: columns.TandaTangan !== undefined ? (data[i][columns.TandaTangan] || '') : ''
      });
    }
    return list.sort(function(a, b) {
      return String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || String(a.namaGuru || '').localeCompare(String(b.namaGuru || ''));
    });
  } catch (e) {
    Logger.log('Absensi guru gagal dimuat: ' + e.toString());
    return [];
  }
}

function recordTeacherAttendance(payload, requesterType) {
  const lock = LockService.getScriptLock();
  try {
    if (String(requesterType || '').trim().toLowerCase() !== 'admin') return { success:false, message:'Hanya admin yang dapat mencatat absensi guru.' };
    lock.waitLock(20000);
    payload = payload || {};
    const teacher = resolveTeacher_(payload.guruID || payload.namaGuru);
    const tanggal = normalizeAcademyDate(payload.tanggal);
    const status = String(payload.status || '').trim();
    if (!teacher) return { success:false, message:'Guru tidak ditemukan.' };
    if (!tanggal) return { success:false, message:'Tanggal absensi wajib diisi.' };
    if (!['Hadir','Izin','Sakit','Alpa','Cuti'].includes(status)) return { success:false, message:'Status absensi guru tidak valid.' };

    const sheet = ensureTeacherAttendanceSheet_();
    const data = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);
    let targetRow = 0;
    const attendanceID = String(payload.absensiGuruID || '').trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (attendanceID && String(data[i][columns.AbsensiGuruID] || '').trim().toLowerCase() === attendanceID) { targetRow = i + 1; break; }
      const sameTeacher = String(data[i][columns.GuruID] || '').trim().toLowerCase() === teacher.id.toLowerCase();
      const sameDate = normalizeAcademyDate(data[i][columns.Tanggal]) === tanggal;
      if (!attendanceID && sameTeacher && sameDate) { targetRow = i + 1; break; }
    }
    const record = {
      AbsensiGuruID: targetRow ? data[targetRow - 1][columns.AbsensiGuruID] : newPermanentID_('AGU'),
      GuruID: teacher.id,
      NamaGuru: teacher.name,
      Tanggal: tanggal,
      Status: status,
      JamMasuk: String(payload.jamMasuk || '').trim(),
      JamKeluar: String(payload.jamKeluar || '').trim(),
      Catatan: String(payload.catatan || '').trim(),
      DicatatOleh: String(payload.dicatatOleh || 'Admin').trim(),
      TandaTangan: String(payload.tandaTangan || (targetRow && columns.TandaTangan !== undefined ? data[targetRow - 1][columns.TandaTangan] : '') || '').trim()
    };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const values = headers.map(function(header) { return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''; });
    if (targetRow) sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
    else sheet.appendRow(values);
    SpreadsheetApp.flush();
    return { success:true, message:targetRow ? 'Absensi guru berhasil diperbarui.' : 'Absensi guru berhasil dicatat.' };
  } catch (e) {
    return { success:false, message:'Gagal menyimpan absensi guru: ' + e.toString() };
  } finally { try { lock.releaseLock(); } catch (ignore) {} }
}

function deleteTeacherAttendance(absensiGuruID, requesterType) {
  try {
    if (String(requesterType || '').trim().toLowerCase() !== 'admin') return { success:false, message:'Hanya admin yang dapat menghapus absensi guru.' };
    const sheet = ensureTeacherAttendanceSheet_();
    const data = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);
    const target = String(absensiGuruID || '').trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][columns.AbsensiGuruID] || '').trim().toLowerCase() === target) {
        sheet.deleteRow(i + 1);
        return { success:true, message:'Absensi guru berhasil dihapus.' };
      }
    }
    return { success:false, message:'Data absensi guru tidak ditemukan.' };
  } catch (e) { return { success:false, message:'Gagal menghapus absensi guru: ' + e.toString() }; }
}

function ensureLearningProgressSheet() {
  const headers = ['ProgressID', 'NamaSiswa', 'Kelas', 'Level', 'Periode', 'OverallProgress', 'MateriStatus', 'MateriProgress', 'MateriCatatan', 'TeknikStatus', 'TeknikProgress', 'TeknikCatatan', 'TeoriStatus', 'TeoriProgress', 'TeoriCatatan', 'RepertoireStatus', 'RepertoireProgress', 'RepertoireCatatan', 'PracticeStatus', 'PracticeProgress', 'PracticeCatatan', 'PerformanceStatus', 'PerformanceProgress', 'PerformanceCatatan', 'EvaluasiStatus', 'EvaluasiProgress', 'EvaluasiCatatan', 'Kelebihan', 'PerluDitingkatkan', 'TargetBerikutnya', 'Guru', 'LastUpdated', 'TipePeriode', 'GuruSignatureUrl', 'GuruSignatureName', 'KepalaSekolahNama', 'KepalaSekolahSignatureUrl', 'KepalaSekolahSignatureName', 'PeriodeMulai', 'PeriodeSelesai', 'SiswaID', 'GuruID'];
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
    const studentEntity = normalizedRole === 'siswa' ? resolveStudent_(identifier) : null;
    const teacherEntity = normalizedRole === 'guru' ? resolveTeacher_(identifier) : null;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const student = String(getValue(row, 'NamaSiswa', '')).trim();
      const teacher = String(getValue(row, 'Guru', '')).trim();
      if (!student) continue;
      const allowed = normalizedRole === 'admin' ||
        (normalizedRole === 'guru' && (String(getValue(row, 'GuruID', '')).trim().toLowerCase() === (teacherEntity ? teacherEntity.id.toLowerCase() : normalizedIdentifier) || (!String(getValue(row, 'GuruID', '')).trim() && teacher.toLowerCase() === (teacherEntity ? teacherEntity.name.toLowerCase() : normalizedIdentifier)))) ||
        (normalizedRole === 'siswa' && (String(getValue(row, 'SiswaID', '')).trim().toLowerCase() === (studentEntity ? studentEntity.id.toLowerCase() : normalizedIdentifier) || (!String(getValue(row, 'SiswaID', '')).trim() && student.toLowerCase() === (studentEntity ? studentEntity.name.toLowerCase() : normalizedIdentifier))));
      if (!allowed) continue;

      const lastUpdatedRaw = getValue(row, 'LastUpdated', '');
      list.push({
        progressID: getValue(row, 'ProgressID', ''),
        siswaID: getValue(row, 'SiswaID', ''),
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
        guruID: getValue(row, 'GuruID', ''),
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
    const studentEntity = resolveStudent_(payload.siswaID || studentName);
    const teacherEntity = resolveTeacher_(payload.guruID || teacherName);
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
    if (!studentName || !teacherName || !studentEntity || !teacherEntity || !validPeriod) {
      return { success: false, message: 'Siswa, coach, dan periode wajib diisi.' };
    }

    const siswaSheet = ss.getSheetByName('Siswa');
    const siswaData = siswaSheet ? siswaSheet.getDataRange().getValues() : [];
    let studentInfo = null;
    const assignedClasses = getStudentClasses_(studentEntity.id, teacherEntity.id);
    for (let i = 1; i < siswaData.length; i++) {
      const rowName = String(siswaData[i][0] || '').trim();
      const siswaColumns = headerMap_(siswaSheet);
      const rowTeacher = String(siswaData[i][9] || '').trim();
      const rowTeacherID = String(siswaData[i][siswaColumns.GuruID] || '').trim();
      if (String(siswaData[i][siswaColumns.SiswaID] || '').trim().toLowerCase() === studentEntity.id.toLowerCase() || (!String(siswaData[i][siswaColumns.SiswaID] || '').trim() && rowName.toLowerCase() === studentName.toLowerCase())) {
        if (!assignedClasses.length && rowTeacher && ((rowTeacherID && rowTeacherID.toLowerCase() !== teacherEntity.id.toLowerCase()) || (!rowTeacherID && rowTeacher.toLowerCase() !== teacherEntity.name.toLowerCase()))) {
          return { success: false, message: 'Siswa ini bukan bagian dari kelas Anda.' };
        }
        const assignedClass = assignedClasses[0] || null;
        studentInfo = { kelas: assignedClass ? assignedClass.instrumen : String(siswaData[i][8] || 'Kelas Musik').trim(), level: assignedClass ? assignedClass.grade : String(siswaData[i][1] || '').trim() };
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
      const sameStudent = String(data[i][col.SiswaID] || '').trim().toLowerCase() === studentEntity.id.toLowerCase() || (!String(data[i][col.SiswaID] || '').trim() && String(data[i][col.NamaSiswa] || '').trim().toLowerCase() === studentName.toLowerCase());
      const sameTeacher = String(data[i][col.GuruID] || '').trim().toLowerCase() === teacherEntity.id.toLowerCase() || (!String(data[i][col.GuruID] || '').trim() && String(data[i][col.Guru] || '').trim().toLowerCase() === teacherEntity.name.toLowerCase());
      const samePeriod = sameStudent && sameTeacher &&
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
      ProgressID: progressID, NamaSiswa: studentEntity.name, SiswaID: studentEntity.id, Kelas: studentInfo.kelas,
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
      TargetBerikutnya: String(payload.targetBerikutnya || '').trim(), Guru: teacherEntity.name, GuruID: teacherEntity.id, LastUpdated: new Date(),
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
    const studentEntity = userType === 'siswa' ? resolveStudent_(identifier) : null;
    const teacherEntity = userType === 'guru' ? resolveTeacher_(identifier) : null;

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
      const rowSiswaID = String(value(row, 'SiswaID', '')).trim().toLowerCase();
      const rowGuruID = String(value(row, 'GuruID', '')).trim().toLowerCase();
      const matchesUser = userType === 'admin' ||
        (userType === 'guru' && (rowGuruID === (teacherEntity ? teacherEntity.id.toLowerCase() : String(identifier).toLowerCase()) || (!rowGuruID && gNama.toLowerCase() === (teacherEntity ? teacherEntity.name.toLowerCase() : String(identifier).toLowerCase())))) ||
        (userType === 'siswa' && (rowSiswaID === (studentEntity ? studentEntity.id.toLowerCase() : String(identifier).toLowerCase()) || (!rowSiswaID && sNama.toLowerCase() === (studentEntity ? studentEntity.name.toLowerCase() : String(identifier).toLowerCase()))));
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
        siswaID: value(row, 'SiswaID', ''),
        namaSiswa: sNama,
        guruID: value(row, 'GuruID', ''),
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
  const headers = ['TugasID', 'NamaSiswa', 'JudulTugas', 'Deskripsi', 'Deadline', 'FileMateriUrl', 'Status', 'TanggalKirim', 'FileJawabanUrl', 'FileJawabanName', 'Guru', 'TipeTugas', 'FileMateriName', 'FileMateriType', 'FileMateriDownloadUrl', 'LampiranJSON', 'JawabanTeks', 'FileJawabanType', 'FileJawabanDownloadUrl', 'JawabanJSON', 'TanggalDibuat', 'YouTubeUrl', 'SiswaID', 'GuruID'];
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

function getLegacyUploadFolder_(folderName) {
  const rootFolder = DriveApp.getFolderById(LEGACY_UPLOAD_ROOT_FOLDER_ID);
  const folders = rootFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : rootFolder.createFolder(folderName);
}

function trySetAnyoneWithLink_(driveItem) {
  try {
    driveItem.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingError) {
    Logger.log('Pengaturan berbagi dilewati: ' + sharingError.toString());
  }
}

function uploadTaskFiles(files, folderName) {
  const uploaded = [];
  if (!files || !Array.isArray(files)) return uploaded;
  const folder = getLegacyUploadFolder_(folderName);
  trySetAnyoneWithLink_(folder);

  files.forEach(item => {
    if (!item || !item.dataUrl || !item.name) return;
    const separator = item.dataUrl.indexOf(',');
    const mimeMatch = String(item.dataUrl).match(/^data:([^;]+);base64,/);
    const contentType = item.type || (mimeMatch ? mimeMatch[1] : 'application/octet-stream');
    const bytes = Utilities.base64Decode(String(item.dataUrl).substring(separator + 1));
    const blob = Utilities.newBlob(bytes, contentType, item.name);
    const file = folder.createFile(blob);
    trySetAnyoneWithLink_(file);
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
  return ensureAcademySheet('RiwayatSiswa', ['RiwayatID', 'NamaSiswa', 'Jenis', 'Tanggal', 'StatusSebelum', 'StatusSesudah', 'Instrumen', 'Guru', 'Keterangan', 'SiswaID', 'GuruID']);
}

function addStudentMovement(nama, jenis, tanggal, statusSebelum, statusSesudah, instrumen, guru, keterangan) {
  const sheet = getStudentHistorySheet();
  const student = resolveStudent_(nama);
  const teacher = resolveTeacher_(guru);
  const record = {
    RiwayatID: 'RWS-' + Utilities.getUuid().substring(0, 8).toUpperCase(), NamaSiswa: String(nama || '').trim(),
    Jenis: String(jenis || '').trim(), Tanggal: tanggal || new Date(), StatusSebelum: String(statusSebelum || '').trim(),
    StatusSesudah: String(statusSesudah || '').trim(), Instrumen: String(instrumen || '').trim(), Guru: String(guru || '').trim(),
    Keterangan: String(keterangan || '').trim(), SiswaID: student ? student.id : '', GuruID: teacher ? teacher.id : ''
  };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''));
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
        guru: historyData[i][7] || '', keterangan: historyData[i][8] || '',
        siswaID: historyData[i][9] || '', guruID: historyData[i][10] || ''
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

function deleteExitedStudentRecord(identifier, requesterType) {
  const lock = LockService.getScriptLock();
  try {
    if (String(requesterType || '').trim().toLowerCase() !== 'admin') return { success:false, message:'Hanya admin yang dapat menghapus data siswa keluar.' };
    lock.waitLock(20000);
    const student = resolveStudent_(identifier);
    const targetID = student ? student.id : String(identifier || '').trim();
    const targetName = student ? student.name : String(identifier || '').trim();
    if (student) {
      const status = String(student.values[student.map.Status] || '').trim().toLowerCase();
      if (status !== 'keluar') return { success:false, message:'Hanya siswa berstatus Keluar yang dapat dihapus dari laporan ini.' };
      deleteRowsByStudentName_('Jadwal', 2, student.name);
      deleteRowsByStudentName_('JadwalPengganti', 3, student.name);
      deleteRowsByStudentName_('KelasSiswa', 3, student.name);
      ss.getSheetByName('Siswa').deleteRow(student.row);
    }

    const history = getStudentHistorySheet();
    const data = history.getDataRange().getValues();
    const columns = headerMap_(history);
    let deletedHistory = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      const rowID = String(data[i][columns.SiswaID] || '').trim().toLowerCase();
      const rowName = String(data[i][columns.NamaSiswa] || '').trim().toLowerCase();
      const matchesID = targetID && rowID && rowID === targetID.toLowerCase();
      const matchesName = targetName && rowName === targetName.toLowerCase();
      if (matchesID || matchesName) {
        history.deleteRow(i + 1);
        deletedHistory++;
      }
    }
    if (!student && !deletedHistory) return { success:false, message:'Data siswa keluar tidak ditemukan.' };
    SpreadsheetApp.flush();
    return { success:true, message:'Data siswa keluar berhasil dihapus. Riwayat akademik tetap disimpan.' };
  } catch (e) {
    return { success:false, message:'Gagal menghapus data siswa keluar: ' + e.toString() };
  } finally { try { lock.releaseLock(); } catch (ignore) {} }
}

function addSiswaCombined(data) {
  try {
    const sheetSiswa = ensureAcademySheet('Siswa', ['Nama','Grade','Email','Password','NoHP','TglDaftar','Status','FotoURL','Instrumen','Guru','TglKeluar','SiswaID','GuruID']);
    const existingData = sheetSiswa.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][0]).trim().toLowerCase() === String(data.nama).trim().toLowerCase()) {
        return { success: false, message: 'Gagal: Nama Siswa tersebut sudah terdaftar!' };
      }
    }
    const email = data.email || (data.nama.toLowerCase().replace(/\s+/g, '') + '@student.com');
    const instrumen = data.instrumen || 'Gitar';
    const guruPengajar = data.guru || 'Guru Legacy';
    const guruEntity = resolveTeacher_(data.guruID || guruPengajar);
    const siswaID = newPermanentID_('SIS');
    const classes = normalizeStudentClasses_(data, null, guruEntity);
    if (!classes.length) return { success: false, message: 'Minimal satu instrumen dan guru wajib dipilih.' };
    for (let c = 0; c < classes.length; c++) {
      const item = classes[c];
      if (item.hari && item.jamMulai && item.jamSelesai && item.ruangan) {
        const conflict = findRoomScheduleConflict(item.ruangan, item.hari, '', item.jamMulai, item.jamSelesai, '', '');
        if (conflict) return { success: false, message: roomConflictMessage(conflict, item.ruangan) };
      }
    }
    const tanggalMasuk = normalizeAcademyDate(data.tglDaftar || new Date());
    const tanggalKeluar = String(data.status || '').trim().toLowerCase() === 'keluar'
      ? normalizeAcademyDate(data.tglKeluar || new Date())
      : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalMasuk)) return { success: false, message: 'Tanggal masuk tidak valid.' };
    if (tanggalKeluar && (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalKeluar) || tanggalKeluar < tanggalMasuk)) {
      return { success: false, message: 'Tanggal keluar harus valid dan tidak boleh sebelum tanggal masuk.' };
    }
    const primaryClass = classes[0];
    const siswaRecord = { Nama:data.nama, Grade:primaryClass.grade || data.kelas, Email:email, Password:'password123', NoHP:data.noHp, TglDaftar:tanggalMasuk, Status:data.status, FotoURL:'', Instrumen:primaryClass.instrumen || instrumen, Guru:primaryClass.guru || guruPengajar, TglKeluar:tanggalKeluar, SiswaID:siswaID, GuruID:primaryClass.guruID || '' };
    const siswaHeaders = sheetSiswa.getRange(1, 1, 1, sheetSiswa.getLastColumn()).getValues()[0].map(String);
    sheetSiswa.appendRow(siswaHeaders.map(header => Object.prototype.hasOwnProperty.call(siswaRecord, header) ? siswaRecord[header] : ''));
    const student = { id:siswaID, name:String(data.nama || '').trim() };
    saveStudentClasses_(student, classes, { tglDaftar:tanggalMasuk, tglKeluar:tanggalKeluar, replaceAll:true });
    addStudentMovement(data.nama, 'Masuk', tanggalMasuk, '', data.status || 'Aktif', primaryClass.instrumen, primaryClass.guru, 'Siswa baru ditambahkan');
    if (tanggalKeluar) addStudentMovement(data.nama, 'Keluar', tanggalKeluar, 'Aktif', 'Keluar', primaryClass.instrumen, primaryClass.guru, 'Siswa ditambahkan dengan status Keluar');
    return { success: true, message: 'Siswa dan ' + classes.length + ' kelas berhasil ditambahkan!', siswaID: siswaID };
  } catch (e) { return { success: false, message: 'Error: ' + e.toString() }; }
}

function updateSiswa(data) {
  try {
    const sheet = ss.getSheetByName('Siswa');
    const d = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);
    for (let i = 1; i < d.length; i++) {
      const requestedID = String(data.siswaID || '').trim().toLowerCase();
      const rowID = String(d[i][columns.SiswaID] || '').trim();
      if ((requestedID && rowID.toLowerCase() === requestedID) || (!requestedID && String(d[i][0]).trim().toLowerCase() === String(data.oldNama).trim().toLowerCase())) {
        const oldName = String(d[i][0] || '').trim();
        const siswaID = rowID || newPermanentID_('SIS');
        if (!rowID) sheet.getRange(i + 1, columns.SiswaID + 1).setValue(siswaID);
        const teacherEntity = resolveTeacher_(data.guruID || data.guru || d[i][9]);
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
        const classes = normalizeStudentClasses_(data, { id:siswaID, name:data.nama }, teacherEntity);
        if (!classes.length) return { success: false, message: 'Minimal satu instrumen dan guru wajib dipilih.' };
        for (let c = 0; c < classes.length; c++) {
          const classItem = classes[c];
          if (classItem.hari && classItem.jamMulai && classItem.jamSelesai && classItem.ruangan) {
            const conflict = findRoomScheduleConflict(classItem.ruangan, classItem.hari, '', classItem.jamMulai, classItem.jamSelesai, classItem.jadwalID, '');
            if (conflict) return { success: false, message: roomConflictMessage(conflict, classItem.ruangan) };
          }
        }
        const primaryClass = classes[0];
        const canReplacePrimaryClass = String(data.currentUserType || '').toLowerCase() !== 'guru';
        sheet.getRange(i+1,1).setValue(data.nama); 
        if (canReplacePrimaryClass) sheet.getRange(i+1,2).setValue(primaryClass.grade || data.kelas); 
        sheet.getRange(i+1,3).setValue(data.email); 
        sheet.getRange(i+1,5).setValue(data.noHp); 
        sheet.getRange(i+1,6).setValue(tanggalMasuk);
        sheet.getRange(i+1,7).setValue(data.status);
        if (canReplacePrimaryClass) {
          sheet.getRange(i+1,9).setValue(primaryClass.instrumen);
          sheet.getRange(i+1,10).setValue(primaryClass.guru);
          sheet.getRange(i + 1, columns.GuruID + 1).setValue(primaryClass.guruID);
        }
        updateStudentMovementDate(data.oldNama, data.nama, 'Masuk', tanggalMasuk, '', newStatus || 'Aktif', primaryClass.instrumen, primaryClass.guru, 'Tanggal daftar siswa');
        if (oldStatus.toLowerCase() !== 'keluar' && newStatus.toLowerCase() === 'keluar') {
          sheet.getRange(i+1,11).setValue(tanggalKeluar);
          addStudentMovement(data.nama, 'Keluar', tanggalKeluar, oldStatus, newStatus, primaryClass.instrumen, primaryClass.guru, 'Status diubah menjadi Keluar');
        } else if (oldStatus.toLowerCase() === 'keluar' && newStatus.toLowerCase() === 'keluar') {
          sheet.getRange(i+1,11).setValue(tanggalKeluar);
          updateStudentMovementDate(data.oldNama, data.nama, 'Keluar', tanggalKeluar, oldStatus, newStatus, primaryClass.instrumen, primaryClass.guru, 'Tanggal keluar siswa diperbarui');
        } else if (oldStatus.toLowerCase() === 'keluar' && newStatus.toLowerCase() !== 'keluar') {
          sheet.getRange(i+1,11).clearContent();
          addStudentMovement(data.nama, 'Masuk', new Date(), oldStatus, newStatus, primaryClass.instrumen, primaryClass.guru, 'Siswa aktif kembali');
        }
        if (oldName.toLowerCase() !== String(data.nama || '').trim().toLowerCase()) syncEntityDisplayName_('siswa', siswaID, oldName, data.nama);
        saveStudentClasses_({ id:siswaID, name:String(data.nama || '').trim() }, classes, { tglDaftar:tanggalMasuk, tglKeluar:tanggalKeluar, replaceAll:String(data.currentUserType || '').toLowerCase() === 'admin' });
        return { success: true, message: 'Data siswa dan kelas berhasil diperbarui.', siswaID: siswaID };
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
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(nama).trim().toLowerCase()) {
        const namaSiswa = String(data[i][0] || '').trim();
        const currentStatus = String(data[i][6] || '').trim();
        if (currentStatus.toLowerCase() !== 'keluar' || !studentMovementExists(namaSiswa, 'Keluar')) {
          addStudentMovement(namaSiswa, 'Keluar', new Date(), data[i][6] || 'Aktif', 'Keluar', data[i][8] || 'Gitar', data[i][9] || '', 'Data siswa dihapus oleh admin');
        }
        const jadwalTerhapus = deleteRowsByStudentName_('Jadwal', 2, namaSiswa);
        deleteRowsByStudentName_('JadwalPengganti', 3, namaSiswa);
        deleteRowsByStudentName_('KelasSiswa', 3, namaSiswa);
        sheet.deleteRow(i + 1);
        SpreadsheetApp.flush();
        return { success: true, message: 'Siswa berhasil dihapus' + (jadwalTerhapus ? ' beserta jadwal pelajarannya.' : '.') };
      }
    }
    return { success: false, message: 'Siswa tidak ditemukan.' };
  } catch(e) { return { success: false, message: e.toString() }; }
  finally { try { lock.releaseLock(); } catch (ignore) {} }
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
    const validIDs = new Set();
    if (siswaSheet && siswaSheet.getLastRow() >= 2) {
      const siswaMap = headerMap_(siswaSheet);
      siswaSheet.getRange(2, 1, siswaSheet.getLastRow() - 1, siswaSheet.getLastColumn()).getValues().forEach(row => {
        const name = String(row[siswaMap.Nama] || '').trim().toLowerCase();
        const id = String(row[siswaMap.SiswaID] || '').trim().toLowerCase();
        if (name) validNames.add(name);
        if (id) validIDs.add(id);
      });
    }

    let deleted = 0;
    [['Jadwal', 'NamaSiswa', 'SiswaID'], ['JadwalPengganti', 'NamaSiswa', 'SiswaID']].forEach(config => {
      const sheet = ss.getSheetByName(config[0]);
      if (!sheet || sheet.getLastRow() < 2) return;
      const map = headerMap_(sheet);
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      for (let i = values.length - 1; i >= 0; i--) {
        const name = String(values[i][map[config[1]]] || '').trim().toLowerCase();
        const id = String(values[i][map[config[2]]] || '').trim().toLowerCase();
        if ((id && !validIDs.has(id)) || (!id && name && !validNames.has(name))) {
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
    const studentEntity = resolveStudent_(payload.siswaID || payload.namaSiswa);
    const teacherEntity = resolveTeacher_(payload.guruID || payload.guru);
    if (!studentEntity) return { success: false, message: 'Data siswa tidak ditemukan.' };
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
    set('NamaSiswa', studentEntity.name);
    set('SiswaID', studentEntity.id);
    set('JudulTugas', payload.judulTugas);
    set('Deskripsi', payload.deskripsi || '');
    set('Deadline', payload.deadline || '');
    set('FileMateriUrl', first.url || '');
    set('Status', 'Belum Dikerjakan');
    set('Guru', teacherEntity ? teacherEntity.name : (payload.guru || ''));
    set('GuruID', teacherEntity ? teacherEntity.id : '');
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
    const sheetAbsensi = ensureAcademySheet('Absensi', ['AbsensiID','NamaSiswa','Tanggal','PertemuanKe','Status','Materi','Lagu','Catatan','TandaTangan','GuruCatat','TtdSiswa','SiswaID','GuruID']);
    const absensiID = 'ABS-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    const studentEntity = resolveStudent_(data.siswaID || data.namaSiswa);
    const teacherEntity = resolveTeacher_(data.guruID || data.guru);
    const record = { AbsensiID:absensiID, NamaSiswa:studentEntity ? studentEntity.name : data.namaSiswa, Tanggal:data.tanggal, PertemuanKe:data.pertemuanKe, Status:data.status, Materi:data.materi, Lagu:data.lagu, Catatan:data.catatan, TandaTangan:data.tandaTangan, GuruCatat:teacherEntity ? teacherEntity.name : data.guru, TtdSiswa:data.ttdSiswa || '', SiswaID:studentEntity ? studentEntity.id : '', GuruID:teacherEntity ? teacherEntity.id : '' };
    const headers = sheetAbsensi.getRange(1, 1, 1, sheetAbsensi.getLastColumn()).getValues()[0].map(String);
    sheetAbsensi.appendRow(headers.map(header => Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''));
    return { success: true, message: 'Absensi berhasil disimpan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function updateAbsensi(data) {
  try {
    const sheet = ss.getSheetByName('Absensi');
    if (!sheet) return { success: false, message: 'Sheet Absensi tidak ditemukan.' };
    const d = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);
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
        const studentEntity = resolveStudent_(data.siswaID || data.namaSiswa);
        const teacherEntity = resolveTeacher_(data.guruID || data.guru || d[i][9]);
        if (studentEntity && columns.SiswaID !== undefined) sheet.getRange(i + 1, columns.SiswaID + 1).setValue(studentEntity.id);
        if (teacherEntity && columns.GuruID !== undefined) sheet.getRange(i + 1, columns.GuruID + 1).setValue(teacherEntity.id);
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
    const folder = getLegacyUploadFolder_(folderName);

    trySetAnyoneWithLink_(folder);

    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.substring(base64Data.indexOf(',') + 1));
    const blob = Utilities.newBlob(bytes, contentType, fileName || (userID + "_photo.png"));
    
    const file = folder.createFile(blob);
    trySetAnyoneWithLink_(file);
    
    const fileId = file.getId();
    const photoUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    let sheetName = 'Siswa';
    if (userType === 'guru') sheetName = 'Guru';
    if (userType === 'admin') sheetName = 'Admin';

    const sheet = ss.getSheetByName(sheetName);
    const data = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);

    for (let i = 1; i < data.length; i++) {
      const entityID = userType === 'siswa' ? String(data[i][columns.SiswaID] || '') : String(data[i][0] || '');
      const entityName = userType === 'siswa' ? String(data[i][columns.Nama] || '') : String(data[i][1] || '');
      if (entityID.toLowerCase() === String(userID).toLowerCase() || entityName.toLowerCase() === String(userID).toLowerCase()) {
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
    ensureIdentitySystem_();
    let sheetName = 'Siswa';
    if (data.userType === 'guru') sheetName = 'Guru';
    if (data.userType === 'admin') sheetName = 'Admin';

    const sheet = ss.getSheetByName(sheetName);
    const d = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);

    for (let i = 1; i < d.length; i++) {
      const requestedID = String(data.userID || '').trim().toLowerCase();
      const rowID = data.userType === 'siswa' ? String(d[i][columns.SiswaID] || '').trim() : String(d[i][0] || '').trim();
      const rowName = data.userType === 'siswa' ? String(d[i][columns.Nama] || '').trim() : String(d[i][1] || '').trim();
      const match = (requestedID && rowID.toLowerCase() === requestedID) || (!requestedID && rowName.toLowerCase() === String(data.oldNama || '').trim().toLowerCase());

      if (match) {
        const oldName = rowName;
        if (data.userType === 'admin') {
          sheet.getRange(i + 1, 2).setValue(data.nama);
          sheet.getRange(i + 1, 3).setValue(data.email);
          sheet.getRange(i + 1, 5).setValue(data.noHp);
        } else if (data.userType === 'guru') {
          sheet.getRange(i + 1, 2).setValue(data.nama);
          sheet.getRange(i + 1, 3).setValue(data.email);
          sheet.getRange(i + 1, 5).setValue(data.noHp);
          if (data.instrumen) sheet.getRange(i + 1, 6).setValue(data.instrumen);
          if (oldName.toLowerCase() !== String(data.nama || '').trim().toLowerCase()) syncEntityDisplayName_('guru', rowID, oldName, data.nama);
        } else {
          sheet.getRange(i + 1, 1).setValue(data.nama);
          sheet.getRange(i + 1, 3).setValue(data.email);
          sheet.getRange(i + 1, 5).setValue(data.noHp);
          if (oldName.toLowerCase() !== String(data.nama || '').trim().toLowerCase()) syncEntityDisplayName_('siswa', rowID, oldName, data.nama);
        }
        return { success: true, message: 'Profil berhasil diperbarui.', userID: rowID, userName: data.nama };
      }
    }
    return { success: false, message: 'User tidak ditemukan.' };
  } catch (e) { return { success: false, message: e.toString() }; }
}

function updateJadwal(data) {
  try {
    const conflict = findRoomScheduleConflict(data.ruangan, data.hari, '', data.jamMulai, data.jamSelesai, data.jadwalID, '');
    if (conflict) return { success: false, message: roomConflictMessage(conflict, data.ruangan) };
    const sheet = ensureAcademySheet('Jadwal', ['JadwalID','NamaSiswa','Hari','JamMulai','JamSelesai','Guru','Ruangan','Status','Instrumen','SiswaID','GuruID']); const d = sheet.getDataRange().getValues();
    const columns = headerMap_(sheet);
    const studentEntity = resolveStudent_(data.siswaID || data.namaSiswa);
    const teacherEntity = resolveTeacher_(data.guruID || data.guru);
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0]).trim() === String(data.jadwalID).trim()) {
        const oldClass = studentEntity ? getStudentClasses_(studentEntity.id).find(item => String(item.instrumen || '').trim().toLowerCase() === String(d[i][8] || '').trim().toLowerCase() && (String(item.guruID || '').trim().toLowerCase() === String(d[i][columns.GuruID] || '').trim().toLowerCase() || String(item.guru || '').trim().toLowerCase() === String(d[i][5] || '').trim().toLowerCase())) : null;
        sheet.getRange(i+1, 2).setValue(data.namaSiswa); 
        sheet.getRange(i+1, 3).setValue(data.hari); 
        sheet.getRange(i+1, 4).setValue(data.jamMulai); 
        sheet.getRange(i+1, 5).setValue(data.jamSelesai); 
        if (data.guru) sheet.getRange(i+1, 6).setValue(data.guru);
        sheet.getRange(i+1, 7).setValue(data.ruangan); 
        sheet.getRange(i+1, 8).setValue(data.status);
        if (data.instrumen) sheet.getRange(i+1, 9).setValue(data.instrumen);
        if (studentEntity) {
          sheet.getRange(i + 1, 2).setValue(studentEntity.name);
          sheet.getRange(i + 1, columns.SiswaID + 1).setValue(studentEntity.id);
        }
        if (teacherEntity) {
          sheet.getRange(i + 1, 6).setValue(teacherEntity.name);
          sheet.getRange(i + 1, columns.GuruID + 1).setValue(teacherEntity.id);
        }
        if (studentEntity) saveStudentClasses_(studentEntity, [{ kelasSiswaID:oldClass ? oldClass.kelasSiswaID : '', instrumen:data.instrumen || d[i][8], guruID:teacherEntity ? teacherEntity.id : String(d[i][columns.GuruID] || ''), guru:teacherEntity ? teacherEntity.name : String(data.guru || d[i][5]), grade:oldClass ? oldClass.grade : 'Beginner', status:data.status || 'Aktif' }], { replaceAll:false });
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
  const sheet = ss.getSheetByName('Siswa');
  const columns = headerMap_(sheet);
  const classIndex = getStudentClassIndex_();
  return sheet.getDataRange().getValues().slice(1).map(r => {
    const classes = classIndex[String(r[columns.SiswaID] || '').trim().toLowerCase()] || [];
    return { siswaID:r[columns.SiswaID] || '', guruID:r[columns.GuruID] || '', nama:r[0], kelas:[...new Set(classes.map(item => item.grade).filter(Boolean))].join(', ') || r[1], email:r[2], status:r[6], instrumen:[...new Set(classes.map(item => item.instrumen).filter(Boolean))].join(', ') || r[8] || 'Gitar', guru:[...new Set(classes.map(item => item.guru).filter(Boolean))].join(', ') || r[9] || '', kelasList:classes };
  });
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
    const headersRequired = ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada', 'SiswaID', 'GuruID'];
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
    const studentEntity = role === 'siswa' ? resolveStudent_(identifier) : null;
    const teacherEntity = role === 'guru' ? resolveTeacher_(identifier) : null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const student = String(get(row, 'NamaSiswa', '', '')).trim();
      const teacher = String(get(row, 'Guru', '', '')).trim();
      if (!student) continue;
      const rowSiswaID = String(get(row, 'SiswaID', '', '')).trim().toLowerCase();
      const rowGuruID = String(get(row, 'GuruID', '', '')).trim().toLowerCase();
      const allowed = role === 'admin' ||
        (role === 'guru' && (rowGuruID === (teacherEntity ? teacherEntity.id.toLowerCase() : key) || (!rowGuruID && teacher.toLowerCase() === (teacherEntity ? teacherEntity.name.toLowerCase() : key)))) ||
        (role === 'siswa' && (rowSiswaID === (studentEntity ? studentEntity.id.toLowerCase() : key) || (!rowSiswaID && student.toLowerCase() === (studentEntity ? studentEntity.name.toLowerCase() : key))));
      if (!allowed) continue;
      const date = normalizeAcademyDate(get(row, 'TanggalPelaksanaan', 'TanggalPerubahan', ''));
      let day = '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parts = date.split('-').map(Number);
        day = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
      } else day = String(get(row, 'HariPelaksanaan', 'HariBaru', '') || '');
      list.push({
        penggantiID: get(row, 'PenggantiID', '', ''), jadwalID: get(row, 'JadwalID', '', ''), siswaID: get(row, 'SiswaID', '', ''), guruID: get(row, 'GuruID', '', ''),
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
    const headersRequired = ['PenggantiID', 'JadwalID', 'NamaSiswa', 'Alasan', 'TanggalPelaksanaan', 'JamMulai', 'JamSelesai', 'Guru', 'Ruangan', 'Status', 'DibuatPada', 'SiswaID', 'GuruID'];
    const sheet = ensureAcademySheet('JadwalPengganti', headersRequired);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
    const studentEntity = resolveStudent_(payload.siswaID || student);
    const teacherEntity = resolveTeacher_(payload.guruID || teacher);
    const record = {
      PenggantiID: 'MKP-' + Utilities.getUuid().substring(0, 8).toUpperCase(), JadwalID: String(payload.jadwalID || '').trim(),
      NamaSiswa: student, Alasan: String(payload.alasan || 'Lainnya').trim(), TanggalPelaksanaan: date,
      JamMulai: start, JamSelesai: end, Guru: teacherEntity ? teacherEntity.name : teacher, Ruangan: room, Status: 'Aktif', DibuatPada: new Date(),
      SiswaID: studentEntity ? studentEntity.id : '', GuruID: teacherEntity ? teacherEntity.id : ''
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
    const headersRequired = ['PengumumanID', 'Judul', 'Target', 'TargetDetail', 'Isi', 'Pembuat', 'TanggalKirim', 'Status', 'TargetSiswaID', 'PembuatID'];
    const sheet = ensureAcademySheet('Pengumuman', headersRequired);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(value => String(value || '').trim());
    const col = {}; headers.forEach((header, index) => col[header] = index);
    const get = (row, header, fallback) => col[header] === undefined || row[col[header]] === '' || row[col[header]] === null ? fallback : row[col[header]];
    const role = String(userType || '').toLowerCase();
    const key = String(identifier || '').trim().toLowerCase();
    const studentEntity = role === 'siswa' ? resolveStudent_(identifier) : null;
    const teacherEntity = role === 'guru' ? resolveTeacher_(identifier) : null;
    const teacherStudents = new Set();
    const teacherStudentIDs = new Set();
    if (role === 'guru') {
      const students = ss.getSheetByName('Siswa');
      const rows = students ? students.getDataRange().getValues() : [];
      const studentColumns = students ? headerMap_(students) : {};
      const classIndex = getStudentClassIndex_();
      for (let i = 1; i < rows.length; i++) {
        const teacherID = String(rows[i][studentColumns.GuruID] || '').trim().toLowerCase();
        const studentID = String(rows[i][studentColumns.SiswaID] || '').trim().toLowerCase();
        const hasTeacherClass = (classIndex[studentID] || []).some(item => String(item.guruID || '').trim().toLowerCase() === (teacherEntity ? teacherEntity.id.toLowerCase() : key));
        if (hasTeacherClass || (teacherEntity && teacherID === teacherEntity.id.toLowerCase()) || (!teacherID && String(rows[i][9] || '').trim().toLowerCase() === (teacherEntity ? teacherEntity.name.toLowerCase() : key))) {
          teacherStudents.add(String(rows[i][0] || '').trim().toLowerCase());
          teacherStudentIDs.add(String(rows[i][studentColumns.SiswaID] || '').trim().toLowerCase());
        }
      }
    }
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const target = String(get(row, 'Target', 'semua')).toLowerCase();
      const detail = String(get(row, 'TargetDetail', '')).trim();
      const targetSiswaID = String(get(row, 'TargetSiswaID', '')).trim().toLowerCase();
      const status = String(get(row, 'Status', 'Terbit')).toLowerCase();
      if (status === 'draf' || status === 'nonaktif') continue;
      const allowed = role === 'admin' || target === 'semua' ||
        (role === 'siswa' && (target === 'semua_siswa' || (target === 'siswa_tertentu' && ((studentEntity && targetSiswaID === studentEntity.id.toLowerCase()) || (!targetSiswaID && detail.toLowerCase() === (studentEntity ? studentEntity.name.toLowerCase() : key)))))) ||
        (role === 'guru' && (target === 'semua_guru' || (target === 'siswa_tertentu' && ((targetSiswaID && teacherStudentIDs.has(targetSiswaID)) || (!targetSiswaID && teacherStudents.has(detail.toLowerCase()))))));
      if (!allowed) continue;
      list.push({
        pengumumanID: get(row, 'PengumumanID', ''), judul: get(row, 'Judul', ''), target: target,
        targetDetail: detail, targetSiswaID: get(row, 'TargetSiswaID', ''), isi: get(row, 'Isi', ''), pembuat: get(row, 'Pembuat', ''), pembuatID: get(row, 'PembuatID', ''),
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
    const headersRequired = ['PengumumanID', 'Judul', 'Target', 'TargetDetail', 'Isi', 'Pembuat', 'TanggalKirim', 'Status', 'TargetSiswaID', 'PembuatID'];
    const sheet = ensureAcademySheet('Pengumuman', headersRequired);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(value => String(value || '').trim());
    const targetStudent = target === 'siswa_tertentu' ? resolveStudent_(payload.targetSiswaID || detail) : null;
    const creator = resolveTeacher_(payload.pembuatID || payload.pembuat);
    const record = {
      PengumumanID: 'PNG-' + Utilities.getUuid().substring(0, 8).toUpperCase(), Judul: title, Target: target,
      TargetDetail: targetStudent ? targetStudent.name : detail, TargetSiswaID: targetStudent ? targetStudent.id : '', Isi: body,
      Pembuat: creator ? creator.name : String(payload.pembuat || 'Admin').trim(), PembuatID: creator ? creator.id : '', TanggalKirim: new Date(), Status: 'Terbit'
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

// ============================================================================
// CLOUDFLARE RPC GATEWAY
// Keeps the existing Spreadsheet/Drive/Docs backend intact while allowing the
// frontend to live on GitHub + Cloudflare instead of inside HtmlService.
// ============================================================================
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('LEGACY_API_TOKEN');
    if (!expected || String(body.apiToken || '') !== String(expected)) {
      return legacyJsonResponse_({ ok:false, error:'Unauthorized API request.' });
    }
    var method = String(body.method || '').trim();
    var args = Array.isArray(body.args) ? body.args : [];
    var data = legacyDispatchRpc_(method, args);
    return legacyJsonResponse_({ ok:true, data:data });
  } catch (err) {
    return legacyJsonResponse_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}

function legacyJsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function legacyDispatchRpc_(method, args) {
  switch (method) {
    case 'verifyLogin': return verifyLogin.apply(null, args);
    case 'getDashboardData': return getDashboardData.apply(null, args);
    case 'getGuruList': return getGuruList.apply(null, args);
    case 'updateUserPhoto': return updateUserPhoto.apply(null, args);
    case 'updateSelfProfile': return updateSelfProfile.apply(null, args);
    case 'saveLearningProgress': return saveLearningProgress.apply(null, args);
    case 'deleteLearningProgress': return deleteLearningProgress.apply(null, args);
    case 'getLearningProgressPrintLogo': return getLearningProgressPrintLogo.apply(null, args);
    case 'addJadwalPengganti': return addJadwalPengganti.apply(null, args);
    case 'deleteJadwalPengganti': return deleteJadwalPengganti.apply(null, args);
    case 'addPengumuman': return addPengumuman.apply(null, args);
    case 'deletePengumuman': return deletePengumuman.apply(null, args);
    case 'updateAbsensi': return updateAbsensi.apply(null, args);
    case 'deleteAbsensi': return deleteAbsensi.apply(null, args);
    case 'addTugasCombined': return addTugasCombined.apply(null, args);
    case 'submitTugasJawaban': return submitTugasJawaban.apply(null, args);
    case 'deleteTugas': return deleteTugas.apply(null, args);
    case 'updateSiswa': return updateSiswa.apply(null, args);
    case 'updateJadwal': return updateJadwal.apply(null, args);
    case 'deleteGuru': return deleteGuru.apply(null, args);
    case 'recordTeacherAttendance': return recordTeacherAttendance.apply(null, args);
    case 'deleteTeacherAttendance': return deleteTeacherAttendance.apply(null, args);
    case 'deleteExitedStudentRecord': return deleteExitedStudentRecord.apply(null, args);
    case 'addGuru': return addGuru.apply(null, args);
    case 'updateGuru': return updateGuru.apply(null, args);
    case 'addSiswaCombined': return addSiswaCombined.apply(null, args);
    case 'recordAbsensi': return recordAbsensi.apply(null, args);
    case 'deleteSiswa': return deleteSiswa.apply(null, args);
    case 'deleteJadwal': return deleteJadwal.apply(null, args);
    default: throw new Error('RPC method is not allowed: ' + method);
  }
}

// Run once from the Apps Script editor, using the SAME random value that you
// store in Cloudflare as APPS_SCRIPT_TOKEN. Do not hard-code the real token in Git.
function configureLegacyApiToken(token) {
  token = String(token || '').trim();
  if (token.length < 32) throw new Error('Gunakan token acak minimal 32 karakter.');
  PropertiesService.getScriptProperties().setProperty('LEGACY_API_TOKEN', token);
  return 'LEGACY_API_TOKEN tersimpan.';
}
