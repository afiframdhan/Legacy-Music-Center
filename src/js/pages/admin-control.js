    let globalAdminAuditLog = [];
    let globalAdminQualityFindings = [];
    let globalAdminControlSummary = null;
    let adminControlLoadInFlight = false;

    function loadAdminControlCenter(force = false) {
      if (currentUser.userType !== 'admin') return;
      const box = document.getElementById('adminControlCenterWidget');
      if (!box) return;
      if (!force && globalAdminControlSummary) {
        renderAdminControlCenter(globalAdminControlSummary);
        return;
      }
      if (adminControlLoadInFlight) return;
      adminControlLoadInFlight = true;
      box.classList.add('admin-control-loading');
      google.script.run.withSuccessHandler(result => {
        adminControlLoadInFlight = false;
        box.classList.remove('admin-control-loading');
        if (!result || result.success === false) {
          renderAdminControlCenter({ success:false, message:(result && result.message) || 'Dashboard kontrol gagal dimuat.' });
          return;
        }
        globalAdminControlSummary = result;
        renderAdminControlCenter(result);
      }).withFailureHandler(error => {
        adminControlLoadInFlight = false;
        box.classList.remove('admin-control-loading');
        renderAdminControlCenter({ success:false, message:error.message || String(error) });
      }).getAdminControlCenter();
    }

    function renderAdminControlCenter(data) {
      const box = document.getElementById('adminControlCenterWidget');
      if (!box) return;
      if (!data || data.success === false) {
        box.innerHTML = `<div class="admin-control-empty">${escapeTaskHtml(data?.message || 'Dashboard kontrol belum tersedia.')}</div>`;
        return;
      }
      const s = data.summary || {};
      const actions = Array.isArray(data.actions) ? data.actions : [];
      box.innerHTML = `
        <div class="admin-control-head">
          <div><div class="widget-title">🎛️ Dashboard Kontrol Admin</div><p>Ringkasan operasional yang perlu perhatian hari ini.</p></div>
          <button type="button" class="admin-control-refresh" onclick="loadAdminControlCenter(true)">↻ Refresh</button>
        </div>
        <div class="admin-control-stats">
          <button type="button" class="admin-control-stat" onclick="switchTab('section-jadwal')"><span>Kelas Hari Ini</span><b>${Number(s.classesToday || 0)}</b><small>${Number(s.activeTeachersToday || 0)} guru terjadwal</small></button>
          <button type="button" class="admin-control-stat warning" onclick="switchTab('section-pengganti')"><span>Make-up Belum Ditentukan</span><b>${Number(s.pendingMakeup || 0)}</b><small>Jadwal pergantian aktif</small></button>
          <button type="button" class="admin-control-stat ${Number(s.missingTeacherAttendance || 0) ? 'danger' : ''}" onclick="switchTab('section-absensi-guru')"><span>Guru Belum Absensi</span><b>${Number(s.missingTeacherAttendance || 0)}</b><small>Dari guru yang mengajar hari ini</small></button>
          <button type="button" class="admin-control-stat ${Number(s.qualityIssues || 0) ? 'warning' : ''}" onclick="switchTab('section-data-quality')"><span>Temuan Data</span><b>${Number(s.qualityIssues || 0)}</b><small>${Number(s.criticalQualityIssues || 0)} prioritas tinggi</small></button>
        </div>
        <div class="admin-control-actions-head"><strong>Perlu Tindakan</strong><div><button type="button" onclick="switchTab('section-audit-log')">Audit Log</button><button type="button" onclick="switchTab('section-data-quality')">Data Quality</button></div></div>
        <div class="admin-control-action-list">
          ${actions.length ? actions.map(item => `<button type="button" class="admin-control-action ${escapeTaskHtml(item.severity || 'info')}" onclick="switchTab('${escapeTaskHtml(item.section || 'dashboard-guru')}')"><span class="admin-control-action-icon">${adminControlSeverityIcon(item.severity)}</span><span><b>${escapeTaskHtml(item.title || '-')}</b><small>${escapeTaskHtml(item.detail || '')}</small></span><em>${Number(item.count || 0)}</em></button>`).join('') : '<div class="admin-control-empty good">✓ Tidak ada tindak lanjut mendesak saat ini.</div>'}
        </div>`;
    }

    function adminControlSeverityIcon(severity) {
      const s = String(severity || '').toLowerCase();
      if (s === 'critical') return '●';
      if (s === 'warning') return '▲';
      return '●';
    }

    function loadAdminAuditLog() {
      if (currentUser.userType !== 'admin') return;
      const container = document.getElementById('adminAuditLogList');
      if (container) container.innerHTML = '<div class="admin-control-empty">Memuat audit log...</div>';
      google.script.run.withSuccessHandler(result => {
        if (!result || result.success === false) {
          if (container) container.innerHTML = `<div class="admin-control-empty">${escapeTaskHtml(result?.message || 'Audit log gagal dimuat.')}</div>`;
          return;
        }
        globalAdminAuditLog = Array.isArray(result.items) ? result.items : [];
        populateAdminAuditFilters();
        renderAdminAuditLog();
      }).withFailureHandler(error => {
        if (container) container.innerHTML = `<div class="admin-control-empty">${escapeTaskHtml(error.message || String(error))}</div>`;
      }).getAdminAuditLogs();
    }

    function populateAdminAuditFilters() {
      const actor = document.getElementById('adminAuditActor');
      const category = document.getElementById('adminAuditCategory');
      if (actor) {
        const keep = actor.value;
        const actors = [...new Set(globalAdminAuditLog.map(x => x.actorName).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
        actor.innerHTML = '<option value="">Semua Pengguna</option>' + actors.map(v=>`<option value="${escapeTaskHtml(v)}">${escapeTaskHtml(v)}</option>`).join('');
        actor.value = actors.includes(keep) ? keep : '';
      }
      if (category) {
        const keep = category.value;
        const values = [...new Set(globalAdminAuditLog.map(x => x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
        category.innerHTML = '<option value="">Semua Kategori</option>' + values.map(v=>`<option value="${escapeTaskHtml(v)}">${escapeTaskHtml(v)}</option>`).join('');
        category.value = values.includes(keep) ? keep : '';
      }
    }

    function renderAdminAuditLog() {
      const container = document.getElementById('adminAuditLogList');
      if (!container) return;
      const search = String(document.getElementById('adminAuditSearch')?.value || '').trim().toLowerCase();
      const actor = String(document.getElementById('adminAuditActor')?.value || '').trim().toLowerCase();
      const category = String(document.getElementById('adminAuditCategory')?.value || '').trim().toLowerCase();
      const range = String(document.getElementById('adminAuditRange')?.value || '30');
      const cutoff = range === 'all' ? null : new Date(Date.now() - Number(range || 30) * 86400000);
      const items = globalAdminAuditLog.filter(item => {
        if (actor && String(item.actorName || '').toLowerCase() !== actor) return false;
        if (category && String(item.category || '').toLowerCase() !== category) return false;
        if (cutoff && item.createdAt && new Date(item.createdAt) < cutoff) return false;
        if (search && ![item.actionLabel,item.actorName,item.entityName,item.summary,item.category].some(v => String(v || '').toLowerCase().includes(search))) return false;
        return true;
      });
      const count = document.getElementById('adminAuditCount');
      if (count) count.textContent = `${items.length} aktivitas`;
      container.innerHTML = items.length ? items.map(item => `
        <article class="admin-audit-row">
          <div class="admin-audit-dot ${escapeTaskHtml(String(item.actorRole || '').toLowerCase())}"></div>
          <div class="admin-audit-copy"><div><strong>${escapeTaskHtml(item.actionLabel || item.action || '-')}</strong><span class="admin-audit-category">${escapeTaskHtml(item.category || 'Sistem')}</span></div><p>${escapeTaskHtml(item.summary || item.entityName || '-')}</p><small>${escapeTaskHtml(item.actorName || '-')} • ${escapeTaskHtml(item.actorRole || '-')} • ${escapeTaskHtml(formatAdminControlDateTime(item.createdAt))}</small></div><button type="button" class="admin-audit-delete" onclick="deleteAdminAuditLog('${encodeURIComponent(String(item.auditID || ''))}')" aria-label="Hapus audit">×</button>
        </article>`).join('') : '<div class="admin-control-empty">Tidak ada aktivitas sesuai filter.</div>';
    }


    function deleteAdminAuditLog(encodedId) {
      if (currentUser.userType !== 'admin') return;
      const auditID = decodeURIComponent(String(encodedId || ''));
      if (!auditID || !confirm('Hapus aktivitas audit ini?')) return;
      google.script.run.withSuccessHandler(res => {
        if (res?.success) { globalAdminAuditLog = globalAdminAuditLog.filter(x => String(x.auditID || '') !== auditID); renderAdminAuditLog(); showAlert('alertSuccess', res.message || 'Audit log dihapus.'); }
        else showAlert('alertDanger', res?.message || 'Audit log gagal dihapus.');
      }).withFailureHandler(err => showAlert('alertDanger','Gagal menghapus audit log: '+(err?.message||err))).deleteAdminAuditLog(auditID);
    }

    function clearAdminAuditLog() {
      if (currentUser.userType !== 'admin') return;
      if (!confirm('Hapus SEMUA Audit Log? Tindakan ini tidak dapat dibatalkan.')) return;
      google.script.run.withSuccessHandler(res => {
        if (res?.success) { globalAdminAuditLog = []; renderAdminAuditLog(); showAlert('alertSuccess', res.message || 'Semua audit log dihapus.'); }
        else showAlert('alertDanger', res?.message || 'Audit log gagal dihapus.');
      }).withFailureHandler(err => showAlert('alertDanger','Gagal menghapus audit log: '+(err?.message||err))).clearAdminAuditLogs();
    }
    function formatAdminControlDateTime(value) {
      if (!value) return '-';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString('id-ID', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    }

    function loadAdminDataQuality() {
      if (currentUser.userType !== 'admin') return;
      const list = document.getElementById('adminQualityList');
      if (list) list.innerHTML = '<div class="admin-control-empty">Memeriksa kualitas data...</div>';
      google.script.run.withSuccessHandler(result => {
        if (!result || result.success === false) {
          if (list) list.innerHTML = `<div class="admin-control-empty">${escapeTaskHtml(result?.message || 'Pemeriksaan gagal.')}</div>`;
          return;
        }
        globalAdminQualityFindings = Array.isArray(result.findings) ? result.findings : [];
        renderAdminQualitySummary(result.summary || {});
        populateAdminQualityFilters();
        renderAdminDataQuality();
        globalAdminControlSummary = null;
      }).withFailureHandler(error => {
        if (list) list.innerHTML = `<div class="admin-control-empty">${escapeTaskHtml(error.message || String(error))}</div>`;
      }).getAdminDataQuality();
    }

    function renderAdminQualitySummary(summary) {
      const map = {
        adminQualityTotal: summary.total,
        adminQualityCritical: summary.critical,
        adminQualityWarning: summary.warning,
        adminQualityInfo: summary.info
      };
      Object.entries(map).forEach(([id,value]) => { const el=document.getElementById(id); if(el) el.textContent=String(Number(value || 0)); });
    }

    function populateAdminQualityFilters() {
      const category = document.getElementById('adminQualityCategory');
      if (!category) return;
      const keep = category.value;
      const values = [...new Set(globalAdminQualityFindings.map(x => x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
      category.innerHTML = '<option value="">Semua Kategori</option>' + values.map(v=>`<option value="${escapeTaskHtml(v)}">${escapeTaskHtml(v)}</option>`).join('');
      category.value = values.includes(keep) ? keep : '';
    }

    function renderAdminDataQuality() {
      const list = document.getElementById('adminQualityList');
      if (!list) return;
      const search = String(document.getElementById('adminQualitySearch')?.value || '').trim().toLowerCase();
      const severity = String(document.getElementById('adminQualitySeverity')?.value || '').trim().toLowerCase();
      const category = String(document.getElementById('adminQualityCategory')?.value || '').trim().toLowerCase();
      const items = globalAdminQualityFindings.filter(item => {
        if (severity && String(item.severity || '').toLowerCase() !== severity) return false;
        if (category && String(item.category || '').toLowerCase() !== category) return false;
        if (search && ![item.title,item.detail,item.entityName,item.category].some(v=>String(v||'').toLowerCase().includes(search))) return false;
        return true;
      });
      const count = document.getElementById('adminQualityCount');
      if (count) count.textContent = `${items.length} temuan`;
      list.innerHTML = items.length ? items.map(item => `
        <article class="admin-quality-card ${escapeTaskHtml(item.severity || 'info')}">
          <div class="admin-quality-icon">${item.severity === 'critical' ? '!' : item.severity === 'warning' ? '▲' : 'i'}</div>
          <div class="admin-quality-copy"><div><strong>${escapeTaskHtml(item.title || '-')}</strong><span>${escapeTaskHtml(item.category || 'Data')}</span></div><p>${escapeTaskHtml(item.detail || '')}</p><small>${escapeTaskHtml(item.entityName || '')}</small></div>
          <button type="button" onclick="switchTab('${escapeTaskHtml(item.section || 'section-siswa')}')">Buka</button>
        </article>`).join('') : '<div class="admin-control-empty good">✓ Tidak ada masalah sesuai filter.</div>';
    }

    let adminOperationalCalendarInstance = null;
    let adminOperationalExamRecords = [];

    function adminControlParseDate(value) {
      const text = String(value || '').trim();
      if (!text) return null;
      let m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
      m = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
      const d = new Date(text);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    function teacherMonitorStudentIds(teacher) {
      const teacherId = String(teacher?.id || '').trim();
      const teacherName = String(teacher?.nama || '').trim().toLowerCase();
      const ids = new Set();
      (globalSiswaList || []).forEach(student => {
        const classes = Array.isArray(student.kelasList) ? student.kelasList : [];
        const match = classes.some(cls =>
          (teacherId && String(cls.guruID || '').trim() === teacherId) ||
          (teacherName && String(cls.guru || '').trim().toLowerCase() === teacherName)
        ) || (teacherName && String(student.guru || '').toLowerCase().split(',').map(v=>v.trim()).includes(teacherName));
        if (match) ids.add(String(student.siswaID || '').trim());
      });
      return ids;
    }

    function populateTeacherMonitoringFilters() {
      const select = document.getElementById('teacherMonitorInstrument');
      if (!select) return;
      const keep = select.value;
      const instruments = [...new Set((globalGuruList || []).flatMap(g => String(g.instrumen || '').split(',')).map(v => v.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
      select.innerHTML = '<option value="">Semua Instrumen</option>' + instruments.map(v => `<option value="${escapeTaskHtml(v)}">${escapeTaskHtml(v)}</option>`).join('');
      if (instruments.includes(keep)) select.value = keep;
    }

    function renderTeacherMonitoring() {
      if (currentUser.userType !== 'admin') return;
      populateTeacherMonitoringFilters();
      const list = document.getElementById('teacherMonitoringList');
      if (!list) return;
      const search = String(document.getElementById('teacherMonitorSearch')?.value || '').trim().toLowerCase();
      const instrument = String(document.getElementById('teacherMonitorInstrument')?.value || '').trim().toLowerCase();
      const days = Math.max(1, Number(document.getElementById('teacherMonitorPeriod')?.value || 30));
      const cutoff = new Date(Date.now() - days * 86400000);
      cutoff.setHours(0,0,0,0);

      const teachers = (globalGuruList || []).filter(g => {
        const hay = `${g.nama || ''} ${g.instrumen || ''}`.toLowerCase();
        if (search && !hay.includes(search)) return false;
        if (instrument && !String(g.instrumen || '').toLowerCase().split(',').map(v=>v.trim()).includes(instrument)) return false;
        return true;
      });

      const summaries = teachers.map(teacher => {
        const teacherName = String(teacher.nama || '').trim();
        const teacherId = String(teacher.id || '').trim();
        const studentIds = teacherMonitorStudentIds(teacher);
        const schedules = (globalJadwalList || []).filter(j =>
          (teacherId && String(j.guruID || '').trim() === teacherId) || String(j.guru || '').trim().toLowerCase() === teacherName.toLowerCase()
        );
        const studentAttendance = (globalAbsensiList || []).filter(row => {
          const d = adminControlParseDate(row.tanggal);
          return d && d >= cutoff && String(row.guruCatat || '').trim().toLowerCase() === teacherName.toLowerCase();
        });
        const teacherAttendance = (globalTeacherAttendanceList || []).filter(row => {
          const d = adminControlParseDate(row.tanggal);
          return d && d >= cutoff && (String(row.guruID || '').trim() === teacherId || String(row.namaGuru || '').trim().toLowerCase() === teacherName.toLowerCase());
        });
        const progress = (globalLearningProgressList || []).filter(row => {
          const owner = String(row.guruID || '').trim() === teacherId || String(row.guru || '').trim().toLowerCase() === teacherName.toLowerCase();
          if (!owner) return false;
          const d = adminControlParseDate(row.lastUpdated);
          return !d || d >= cutoff;
        });
        const overrides = (globalScheduleOverrides || []).filter(row =>
          String(row.guruAsli || '').trim().toLowerCase() === teacherName.toLowerCase() ||
          String(row.guruMakeup || '').trim().toLowerCase() === teacherName.toLowerCase()
        );
        const pendingMakeup = overrides.filter(row => String(row.status || 'Aktif').toLowerCase() === 'aktif' && !row.tanggalMakeup).length;
        return {teacher, studentIds, schedules, studentAttendance, teacherAttendance, progress, overrides, pendingMakeup};
      });

      const summary = document.getElementById('teacherMonitorSummary');
      if (summary) {
        const totalStudents = new Set(summaries.flatMap(x => [...x.studentIds])).size;
        const pending = summaries.reduce((sum,x)=>sum+x.pendingMakeup,0);
        summary.innerHTML = `<div><span>Guru Ditampilkan</span><b>${summaries.length}</b></div><div><span>Siswa Terkait</span><b>${totalStudents}</b></div><div><span>Jadwal Rutin / Minggu</span><b>${summaries.reduce((sum,x)=>sum+x.schedules.length,0)}</b></div><div class="warning"><span>Make-up Belum Dijadwalkan</span><b>${pending}</b></div>`;
      }

      list.innerHTML = summaries.length ? summaries.map(x => {
        const g=x.teacher;
        const avatar = g.foto ? `<img src="${escapeTaskHtml(g.foto)}" alt="">` : `<span>${escapeTaskHtml(String(g.nama || 'G').charAt(0).toUpperCase())}</span>`;
        const latestTeacherAttendance = x.teacherAttendance[0];
        return `<article class="teacher-monitor-card">
          <div class="teacher-monitor-head"><div class="teacher-monitor-avatar">${avatar}</div><div><h3>${escapeTaskHtml(g.nama || '-')}</h3><p>${escapeTaskHtml(g.instrumen || 'Musik')}</p></div><span class="repertoire-badge ${String(g.status||'Aktif').toLowerCase()==='aktif'?'ready':'learning'}">${escapeTaskHtml(g.status || 'Aktif')}</span></div>
          <div class="teacher-monitor-metrics">
            <div><span>Siswa Aktif</span><b>${x.studentIds.size}</b></div>
            <div><span>Jadwal Mingguan</span><b>${x.schedules.length}</b></div>
            <div><span>Absensi Siswa ${days}h</span><b>${x.studentAttendance.length}</b></div>
            <div><span>Update Progress ${days}h</span><b>${x.progress.length}</b></div>
          </div>
          <div class="teacher-monitor-notes"><span>Absensi Guru terakhir</span><b>${latestTeacherAttendance ? `${escapeTaskHtml(latestTeacherAttendance.status || '-')} • ${escapeTaskHtml(formatAcademyDate(latestTeacherAttendance.tanggal || ''))}` : 'Belum ada pada periode ini'}</b></div>
          ${x.pendingMakeup ? `<div class="teacher-monitor-alert">${x.pendingMakeup} make-up terkait guru ini belum dijadwalkan.</div>` : ''}
          <div class="teacher-monitor-actions"><button type="button" onclick="switchTab('section-jadwal')">Jadwal</button><button type="button" onclick="switchTab('section-absensi-guru')">Absensi Guru</button><button type="button" onclick="switchTab('section-learning-progress')">Progress</button></div>
        </article>`;
      }).join('') : '<div class="admin-control-empty">Tidak ada guru sesuai filter.</div>';
    }

    function populateAdminOperationalFilters() {
      const teacher = document.getElementById('operationalCalendarTeacher');
      const instrument = document.getElementById('operationalCalendarInstrument');
      if (teacher) {
        const keep=teacher.value;
        teacher.innerHTML='<option value="">Semua Guru</option>'+(globalGuruList||[]).map(g=>`<option value="${escapeTaskHtml(g.nama||'')}">${escapeTaskHtml(g.nama||'-')}</option>`).join('');
        if ([...teacher.options].some(o=>o.value===keep)) teacher.value=keep;
      }
      if (instrument) {
        const keep=instrument.value;
        const values=[...new Set((globalJadwalList||[]).map(j=>String(j.instrumen||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
        instrument.innerHTML='<option value="">Semua Instrumen</option>'+values.map(v=>`<option value="${escapeTaskHtml(v)}">${escapeTaskHtml(v)}</option>`).join('');
        if (values.includes(keep)) instrument.value=keep;
      }
    }

    function initAdminOperationalCalendar() {
      if (currentUser.userType !== 'admin') return;
      populateAdminOperationalFilters();
      LegacyVendors.loadFullCalendar().then(() => {
        const el = document.getElementById('adminOperationalCalendar');
        if (!el || !window.FullCalendar) return;
        if (!adminOperationalCalendarInstance) {
          const compact = window.innerWidth <= 768;
          adminOperationalCalendarInstance = new FullCalendar.Calendar(el, {
            initialView: compact ? 'listWeek' : 'dayGridMonth', locale:'id', height:'auto', contentHeight:'auto', expandRows:true,
            headerToolbar:{left:'prev,next today',center:'title',right:compact?'listWeek,dayGridMonth':'dayGridMonth,timeGridWeek,listWeek'},
            buttonText:{today:'Hari Ini',month:'Bulan',week:'Minggu',list:'Agenda'}, dayMaxEvents:compact?3:5,
            eventClick(info){
              const p=info.event.extendedProps||{};
              alert(`${p.kindLabel || 'Agenda'}\n${info.event.title}\n${p.detail || ''}`);
            },
            eventDidMount(info){
              const p=info.event.extendedProps||{};
              if (p.kind !== 'routine' || !p.scheduleId || !info.event.start) return;
              const d=info.event.start;
              const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const hidden=(globalScheduleOverrides||[]).some(x=>String(x.jadwalID||'')===String(p.scheduleId)&&String(x.tanggalAsli||'')===key&&String(x.status||'Aktif').toLowerCase()==='aktif');
              if(hidden && info.el) info.el.style.display='none';
            }
          });
          adminOperationalCalendarInstance.render();
        }
        refreshAdminOperationalCalendar();
        google.script.run.withSuccessHandler(res=>{
          if(res?.success){ adminOperationalExamRecords=Array.isArray(res.exams)?res.exams:[]; refreshAdminOperationalCalendar(); }
        }).listAnnualExams();
      }).catch(error => showAlert('alertDanger','Kalender operasional gagal dimuat: '+(error.message||error)));
    }

    function refreshAdminOperationalCalendar() {
      if (!adminOperationalCalendarInstance) { initAdminOperationalCalendar(); return; }
      populateAdminOperationalFilters();
      const teacher=String(document.getElementById('operationalCalendarTeacher')?.value||'').trim().toLowerCase();
      const instrument=String(document.getElementById('operationalCalendarInstrument')?.value||'').trim().toLowerCase();
      const type=String(document.getElementById('operationalCalendarType')?.value||'').trim();
      const events=[];
      const dayMap={minggu:0,senin:1,selasa:2,rabu:3,kamis:4,jumat:5,sabtu:6};
      const includeKind=k=>!type || type===k || (type==='override' && ['override','makeup'].includes(k));
      (globalJadwalList||[]).forEach(j=>{
        if(!includeKind('routine')) return;
        if(teacher && String(j.guru||'').trim().toLowerCase()!==teacher) return;
        if(instrument && String(j.instrumen||'').trim().toLowerCase()!==instrument) return;
        const day=dayMap[String(j.hari||'').toLowerCase()]; if(day===undefined) return;
        events.push({id:`op-r-${j.jadwalID}`,title:`${j.namaSiswa||'-'} • ${j.instrumen||'Musik'}`,daysOfWeek:[day],startTime:`${j.jamMulai||'00:00'}:00`,endTime:`${j.jamSelesai||'00:00'}:00`,backgroundColor:'#F15A24',borderColor:'#ea580c',extendedProps:{kind:'routine',kindLabel:'Kelas Rutin',scheduleId:j.jadwalID,detail:`${j.jamMulai||'-'}–${j.jamSelesai||'-'} • ${j.guru||'-'} • ${j.ruangan||'-'}`}});
      });
      (globalScheduleOverrides||[]).forEach(x=>{
        if(String(x.status||'Aktif').toLowerCase()!=='aktif') return;
        const schedule=(globalJadwalList||[]).find(j=>String(j.jadwalID||'')===String(x.jadwalID||''))||{};
        const inst=String(x.instrumenAsli||schedule.instrumen||'Musik');
        const guruAsli=String(x.guruAsli||schedule.guru||'');
        if(instrument && inst.toLowerCase()!==instrument) return;
        if(x.siswaPengganti && x.tanggalAsli && includeKind('override') && (!teacher || guruAsli.toLowerCase()===teacher)) events.push({id:`op-o-${x.overrideID}`,title:`${x.siswaPengganti} • ${inst}`,start:`${x.tanggalAsli}T${schedule.jamMulai||x.jamMulaiAsli||'00:00'}:00`,end:`${x.tanggalAsli}T${schedule.jamSelesai||x.jamSelesaiAsli||'00:00'}:00`,backgroundColor:'#f59e0b',borderColor:'#d97706',extendedProps:{kind:'override',kindLabel:'Pergantian Slot',detail:`Menggantikan ${x.siswaAsli||'-'} • ${guruAsli||'-'}`}});
        if(x.tanggalMakeup&&x.jamMulaiMakeup&&x.jamSelesaiMakeup&&includeKind('makeup')){
          const g=String(x.guruMakeup||guruAsli||''); if(teacher&&g.toLowerCase()!==teacher) return;
          events.push({id:`op-m-${x.overrideID}`,title:`${x.siswaAsli||'-'} • ${inst}`,start:`${x.tanggalMakeup}T${x.jamMulaiMakeup}:00`,end:`${x.tanggalMakeup}T${x.jamSelesaiMakeup}:00`,backgroundColor:'#2563eb',borderColor:'#1d4ed8',extendedProps:{kind:'makeup',kindLabel:'Make-up Class',detail:`${g||'-'} • ${x.ruanganMakeup||'-'} • pengganti ${formatAcademyDate(x.tanggalAsli||'')}`}});
        }
      });
      (adminOperationalExamRecords||[]).forEach(exam=>{
        if(!includeKind('exam')||!exam.examDate) return;
        if(teacher&&String(exam.teacherName||'').trim().toLowerCase()!==teacher) return;
        if(instrument&&String(exam.instrument||'').trim().toLowerCase()!==instrument) return;
        events.push({id:`op-e-${exam.examID}`,title:`Ujian • ${exam.studentName||'-'} • ${exam.instrument||'Musik'}`,start:exam.examDate,allDay:true,backgroundColor:'#7c3aed',borderColor:'#6d28d9',extendedProps:{kind:'exam',kindLabel:'Ujian Tahunan',detail:`${exam.gradeExam||'-'} • Pengajar: ${exam.teacherName||'-'}`}});
      });
      adminOperationalCalendarInstance.removeAllEvents();
      adminOperationalCalendarInstance.addEventSource(events);
      adminOperationalCalendarInstance.render();
    }


    // ==========================================================
    // ADMIN EXPORT & BACKUP — read-only, Supabase source
    // ==========================================================
    const ADMIN_EXPORT_DATASETS = {
      students:{ label:'Siswa', sheet:'Siswa', file:'siswa' },
      teachers:{ label:'Guru', sheet:'Guru', file:'guru' },
      schedules:{ label:'Jadwal', sheet:'Jadwal', file:'jadwal' },
      attendance:{ label:'Absensi', sheet:'Absensi', file:'absensi' },
      progress:{ label:'Progress', sheet:'Progress', file:'progress' },
      repertoire:{ label:'Repertoire', sheet:'Repertoire', file:'repertoire' },
      exams:{ label:'Ujian', sheet:'Ujian', file:'ujian' },
      overrides:{ label:'Jadwal Pergantian', sheet:'Jadwal Pergantian', file:'jadwal-pergantian' }
    };

    function initAdminExportBackup() {
      if (!currentUser || currentUser.userType !== 'admin') return;
      const result = document.getElementById('exportBackupResult');
      if (result && !result.dataset.ready) {
        result.dataset.ready = '1';
        result.innerHTML = '';
      }
    }

    function toggleAllExportDatasets(checked) {
      document.querySelectorAll('#exportBackupDatasetGrid input[type="checkbox"]').forEach(input => { input.checked = Boolean(checked); });
    }

    function getSelectedExportDatasets() {
      return Array.from(document.querySelectorAll('#exportBackupDatasetGrid input[type="checkbox"]:checked'))
        .map(input => input.value)
        .filter(key => ADMIN_EXPORT_DATASETS[key]);
    }

    function setExportBackupBusy(busy, title = '', detail = '', percent = 0) {
      const excelBtn = document.getElementById('btnExportBackupExcel');
      const csvBtn = document.getElementById('btnExportBackupCsv');
      if (excelBtn) excelBtn.disabled = Boolean(busy);
      if (csvBtn) csvBtn.disabled = Boolean(busy);
      const box = document.getElementById('exportBackupProgress');
      if (!box) return;
      box.style.display = busy ? 'block' : 'none';
      const pct = Math.max(0, Math.min(100, Number(percent) || 0));
      const titleEl = document.getElementById('exportBackupProgressTitle');
      const detailEl = document.getElementById('exportBackupProgressDetail');
      const pctEl = document.getElementById('exportBackupProgressPercent');
      const bar = document.getElementById('exportBackupProgressBar');
      if (titleEl) titleEl.textContent = title || 'Menyiapkan backup...';
      if (detailEl) detailEl.textContent = detail || 'Menghubungkan ke Supabase...';
      if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
      if (bar) bar.style.width = `${pct}%`;
    }

    function showExportBackupResult(message, type = 'success') {
      const box = document.getElementById('exportBackupResult');
      if (!box) return;
      box.style.display = 'block';
      box.className = `export-backup-result ${type === 'error' ? 'error' : 'success'}`;
      box.textContent = message;
      clearTimeout(showExportBackupResult._timer);
      showExportBackupResult._timer = setTimeout(() => { box.style.display = 'none'; }, 7000);
    }

    async function fetchAdminExportDataset(dataset) {
      const result = await LegacyAPI.rpc('getAdminExportBackup', [{ dataset }]);
      if (!result || result.success === false) throw new Error((result && result.message) || 'Data backup gagal dimuat.');
      return Array.isArray(result.rows) ? result.rows : [];
    }

    function exportDateStamp() {
      const now = new Date();
      const two = n => String(n).padStart(2, '0');
      return `${now.getFullYear()}-${two(now.getMonth()+1)}-${two(now.getDate())}_${two(now.getHours())}-${two(now.getMinutes())}`;
    }

    function normalizeExportValue(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        try { return JSON.stringify(value); } catch (_) { return String(value); }
      }
      return value;
    }

    const EXCEL_CELL_TEXT_LIMIT = 32000;

    function splitExcelCellValue(value) {
      const normalized = normalizeExportValue(value);
      if (typeof normalized !== 'string' || normalized.length <= EXCEL_CELL_TEXT_LIMIT) return [normalized];
      const parts = [];
      for (let i = 0; i < normalized.length; i += EXCEL_CELL_TEXT_LIMIT) {
        parts.push(normalized.slice(i, i + EXCEL_CELL_TEXT_LIMIT));
      }
      return parts;
    }

    function rowsForSpreadsheet(rows) {
      return (rows || []).map(row => {
        const clean = {};
        Object.entries(row || {}).forEach(([key, value]) => {
          const parts = splitExcelCellValue(value);
          clean[key] = parts[0] ?? '';
          for (let i = 1; i < parts.length; i++) clean[`${key}__part${i + 1}`] = parts[i];
        });
        return clean;
      });
    }

    function downloadBlobFile(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    function csvEscape(value) {
      const text = String(normalizeExportValue(value));
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function rowsToCsv(rows) {
      if (!rows.length) return '\uFEFF';
      const columns = Array.from(rows.reduce((set, row) => { Object.keys(row || {}).forEach(key => set.add(key)); return set; }, new Set()));
      const lines = [columns.map(csvEscape).join(',')];
      rows.forEach(row => lines.push(columns.map(col => csvEscape(row ? row[col] : '')).join(',')));
      return '\uFEFF' + lines.join('\r\n');
    }

    async function exportAdminBackupCsv() {
      if (!currentUser || currentUser.userType !== 'admin') return;
      const select = document.getElementById('exportCsvDataset');
      const dataset = select ? select.value : 'students';
      const meta = ADMIN_EXPORT_DATASETS[dataset];
      if (!meta) return;
      try {
        setExportBackupBusy(true, `Export CSV ${meta.label}`, 'Mengambil data terbaru dari Supabase...', 25);
        const rows = await fetchAdminExportDataset(dataset);
        setExportBackupBusy(true, `Export CSV ${meta.label}`, `${rows.length.toLocaleString('id-ID')} baris siap dibuat.`, 75);
        const csv = rowsToCsv(rows);
        downloadBlobFile(new Blob([csv], { type:'text/csv;charset=utf-8;' }), `Legacy-Music-Center_${meta.file}_${exportDateStamp()}.csv`);
        setExportBackupBusy(false);
        showExportBackupResult(`Export ${meta.label} berhasil • ${rows.length.toLocaleString('id-ID')} baris.`);
      } catch (error) {
        setExportBackupBusy(false);
        showExportBackupResult(`Export CSV gagal: ${error.message || error}`, 'error');
      }
    }

    async function exportAdminBackupExcel() {
      if (!currentUser || currentUser.userType !== 'admin') return;
      const selected = getSelectedExportDatasets();
      if (!selected.length) {
        showExportBackupResult('Pilih minimal satu kategori data untuk dibuatkan backup Excel.', 'error');
        return;
      }
      try {
        setExportBackupBusy(true, 'Menyiapkan Excel', 'Memuat mesin export Excel...', 3);
        await LegacyVendors.loadSheetJS();
        const wb = XLSX.utils.book_new();
        const summary = [
          ['LEGACY MUSIC CENTER — BACKUP DATA'],
          ['Dibuat pada', new Date().toLocaleString('id-ID')],
          ['Dibuat oleh', currentUser.userName || 'Admin'],
          ['Sumber data', 'Supabase'],
          ['Jumlah kategori', selected.length],
          [],
          ['Kategori', 'Jumlah Baris']
        ];
        let totalRows = 0;
        for (let i = 0; i < selected.length; i++) {
          const key = selected[i];
          const meta = ADMIN_EXPORT_DATASETS[key];
          const startPct = 8 + (i / selected.length) * 82;
          setExportBackupBusy(true, `Mengambil ${meta.label}`, `Kategori ${i+1} dari ${selected.length} • membaca Supabase...`, startPct);
          const rows = rowsForSpreadsheet(await fetchAdminExportDataset(key));
          totalRows += rows.length;
          summary.push([meta.label, rows.length]);
          let ws;
          if (rows.length) ws = XLSX.utils.json_to_sheet(rows, { cellDates:true });
          else ws = XLSX.utils.aoa_to_sheet([['Tidak ada data']]);
          ws['!autofilter'] = rows.length && ws['!ref'] ? { ref: ws['!ref'] } : undefined;
          ws['!cols'] = rows.length ? Object.keys(rows[0]).map(keyName => ({ wch: Math.min(34, Math.max(12, String(keyName).length + 3)) })) : [{wch:20}];
          XLSX.utils.book_append_sheet(wb, ws, meta.sheet.slice(0, 31));
        }
        const summaryWs = XLSX.utils.aoa_to_sheet(summary);
        summaryWs['!cols'] = [{wch:28},{wch:24}];
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Ringkasan');
        // Keep Ringkasan as first sheet for easier archive review.
        wb.SheetNames = ['Ringkasan', ...wb.SheetNames.filter(name => name !== 'Ringkasan')];
        setExportBackupBusy(true, 'Membuat file Excel', `${totalRows.toLocaleString('id-ID')} total baris • menyiapkan file download...`, 95);
        XLSX.writeFile(wb, `Legacy-Music-Center_Backup_${exportDateStamp()}.xlsx`, { compression:true });
        setExportBackupBusy(false);
        showExportBackupResult(`Backup Excel berhasil • ${selected.length} kategori • ${totalRows.toLocaleString('id-ID')} total baris.`);
      } catch (error) {
        console.error('Export backup Excel gagal', error);
        setExportBackupBusy(false);
        showExportBackupResult(`Backup Excel gagal: ${error.message || error}`, 'error');
      }
    }
