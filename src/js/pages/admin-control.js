    let globalAdminAuditLog = [];
    let globalAdminQualityFindings = [];
    let globalAdminControlSummary = null;

    function loadAdminControlCenter(force = false) {
      if (currentUser.userType !== 'admin') return;
      const box = document.getElementById('adminControlCenterWidget');
      if (!box) return;
      if (!force && globalAdminControlSummary) {
        renderAdminControlCenter(globalAdminControlSummary);
        return;
      }
      box.classList.add('admin-control-loading');
      google.script.run.withSuccessHandler(result => {
        box.classList.remove('admin-control-loading');
        if (!result || result.success === false) {
          renderAdminControlCenter({ success:false, message:(result && result.message) || 'Dashboard kontrol gagal dimuat.' });
          return;
        }
        globalAdminControlSummary = result;
        renderAdminControlCenter(result);
      }).withFailureHandler(error => {
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
          <div class="admin-audit-copy"><div><strong>${escapeTaskHtml(item.actionLabel || item.action || '-')}</strong><span class="admin-audit-category">${escapeTaskHtml(item.category || 'Sistem')}</span></div><p>${escapeTaskHtml(item.summary || item.entityName || '-')}</p><small>${escapeTaskHtml(item.actorName || '-')} • ${escapeTaskHtml(item.actorRole || '-')} • ${escapeTaskHtml(formatAdminControlDateTime(item.createdAt))}</small></div>
        </article>`).join('') : '<div class="admin-control-empty">Tidak ada aktivitas sesuai filter.</div>';
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
