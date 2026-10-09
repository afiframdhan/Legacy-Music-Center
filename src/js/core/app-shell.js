    function initApp() {
      initializeThemeSettings();
      const savedSession = getSavedLoginSession();
      if (savedSession) {
        // Fast boot: show the cached identity immediately. Session validation runs in
        // parallel and never blocks the welcome screen or the first dashboard request.
        currentUser = savedSession;
        showApp();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1800);
        fetch('/api/session', { credentials:'same-origin', cache:'no-store', signal:controller.signal })
          .then(async response => {
            clearTimeout(timer);
            if (response.status === 401) {
              try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (_) {}
              currentUser = { userType:'', userID:'', userName:'' };
              showLogin();
              const msg=document.getElementById('loginError'); if(msg){msg.textContent='Sesi login perlu diperbarui. Silakan login kembali.';msg.style.display='block';}
              return;
            }
            const payload = await response.json().catch(()=>null);
            if (response.ok && payload?.ok && payload.data) {
              currentUser = { userType:payload.data.userType, userID:payload.data.userID, userName:payload.data.userName, mustChangePassword:Boolean(payload.data.mustChangePassword) };
              saveLoginSession(currentUser);
              if (typeof hydrateFastIdentityShell === 'function') hydrateFastIdentityShell();
              if (currentUser.mustChangePassword && typeof openForcePasswordModal === 'function') openForcePasswordModal();
            }
          })
          .catch(() => { clearTimeout(timer); /* cached session remains usable; API calls will validate it */ });
      } else showLogin();
      
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      const now = new Date();
      document.getElementById('dashCurrentDate').textContent = now.toLocaleDateString('id-ID', options);
      const addDateInput = document.getElementById('addSiswaTanggalMasuk');
      if (addDateInput && !addDateInput.value) addDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      initLmcPersonFilterPickers();
    }

    function initSignaturePads() {
      const canvasIds = ['canvasTtdGuru', 'canvasTtdSiswa', 'canvasEditTtdGuru', 'canvasEditTtdSiswa', 'canvasTtdAbsensiGuru'];
      canvasIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        if (sigCanvases[id]) { resizeSignaturePad(id); return; }
        const pad = { canvas, ctx: canvas.getContext('2d'), strokes: [], drawing: false, activeStroke: null, aspect: 0 };
        sigCanvases[id] = pad;
        
        function getPos(e) {
          const rect = canvas.getBoundingClientRect();
          const viewport = getSignatureViewport(rect.width, rect.height, pad.aspect || (rect.width / Math.max(1, rect.height)));
          let clientX = e.clientX;
          let clientY = e.clientY;
          if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
          }
          return {
            x: Math.max(0, Math.min(1, (clientX - rect.left - viewport.x) / Math.max(1, viewport.width))),
            y: Math.max(0, Math.min(1, (clientY - rect.top - viewport.y) / Math.max(1, viewport.height)))
          };
        }

        function startDrawing(e) {
          e.preventDefault();
          pad.drawing = true;
          pad.activeStroke = [getPos(e)];
          pad.strokes.push(pad.activeStroke);
          redrawSignaturePad(pad);
        }

        function draw(e) {
          if (!pad.drawing || !pad.activeStroke) return;
          e.preventDefault();
          pad.activeStroke.push(getPos(e));
          redrawSignaturePad(pad);
        }

        function stopDrawing() { pad.drawing = false; pad.activeStroke = null; }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseleave', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
        resizeSignaturePad(id);
      });
    }

    function getSignatureViewport(width, height, aspect) {
      const targetAspect = width / Math.max(1, height);
      if (targetAspect > aspect) {
        const viewportWidth = height * aspect;
        return { x:(width - viewportWidth) / 2, y:0, width:viewportWidth, height };
      }
      const viewportHeight = width / Math.max(.01, aspect);
      return { x:0, y:(height - viewportHeight) / 2, width, height:viewportHeight };
    }

    function drawSignatureStrokes(ctx, strokes, width, height, lineWidth, aspect) {
      const viewport = getSignatureViewport(width, height, aspect || (width / Math.max(1, height)));
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      strokes.forEach(stroke => {
        if (!stroke.length) return;
        if (stroke.length === 1) {
          ctx.beginPath(); ctx.arc(viewport.x + stroke[0].x * viewport.width, viewport.y + stroke[0].y * viewport.height, lineWidth / 2, 0, Math.PI * 2); ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(viewport.x + stroke[0].x * viewport.width, viewport.y + stroke[0].y * viewport.height);
        for (let i = 1; i < stroke.length; i++) ctx.lineTo(viewport.x + stroke[i].x * viewport.width, viewport.y + stroke[i].y * viewport.height);
        ctx.stroke();
      });
    }

    function redrawSignaturePad(pad) {
      if (!pad) return;
      const rect = pad.canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      pad.ctx.clearRect(0, 0, width, height);
      drawSignatureStrokes(pad.ctx, pad.strokes, width, height, 2, pad.aspect);
    }

    function clearSignature(canvasId) {
      const pad = sigCanvases[canvasId];
      if (pad) {
        pad.strokes = [];
        pad.activeStroke = null;
        pad.drawing = false;
        redrawSignaturePad(pad);
      }
    }

    function isCanvasBlank(canvasId) {
      const pad = sigCanvases[canvasId];
      return !pad || !pad.strokes.some(stroke => stroke.length > 0);
    }

    function getCanvasDataURL(canvasId) {
      if (isCanvasBlank(canvasId)) return '';
      const pad = sigCanvases[canvasId];
      const aspect = pad.aspect || 3;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 700;
      tempCanvas.height = Math.max(1, Math.round(tempCanvas.width / aspect));
      const tCtx = tempCanvas.getContext('2d');
      tCtx.fillStyle = '#FFFFFF';
      tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      drawSignatureStrokes(tCtx, pad.strokes, tempCanvas.width, tempCanvas.height, 4, aspect);
      return tempCanvas.toDataURL('image/png');
    }

    function resizeSignaturePad(canvasId) {
      const pad = sigCanvases[canvasId];
      if (!pad) return;
      const rect = pad.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (!pad.aspect) pad.aspect = rect.width / rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      pad.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      pad.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      pad.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redrawSignaturePad(pad);
    }

    function layoutSignatureCanvas(pad, fullscreen) {
      const canvas = pad.canvas;
      if (!fullscreen) {
        canvas.style.left = '';
        canvas.style.top = '';
        canvas.style.width = '';
        canvas.style.height = '';
        return;
      }
      const maxWidth = Math.max(240, window.innerWidth - 40);
      const maxHeight = Math.max(160, window.innerHeight - 92);
      if (isCanvasBlank(canvas.id)) pad.aspect = maxWidth / maxHeight;
      canvas.style.width = Math.round(maxWidth) + 'px';
      canvas.style.height = Math.round(maxHeight) + 'px';
      canvas.style.left = '20px';
      canvas.style.top = '58px';
    }

    function toggleSignatureFullscreen(canvasId, forceClose) {
      const pad = sigCanvases[canvasId];
      if (!pad) return;
      const container = pad.canvas.parentElement;
      const willOpen = forceClose ? false : !container.classList.contains('signature-fullscreen');
      document.querySelectorAll('.sig-canvas-container.signature-fullscreen').forEach(item => item.classList.remove('signature-fullscreen'));
      if (willOpen) container.classList.add('signature-fullscreen');
      document.body.classList.toggle('signature-open', willOpen);
      const button = container.querySelector('.btn-expand-sig');
      if (button) button.textContent = willOpen ? 'Selesai' : 'Perbesar';
      requestAnimationFrame(() => {
        layoutSignatureCanvas(pad, willOpen);
        requestAnimationFrame(() => resizeSignaturePad(canvasId));
      });
    }

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const openContainer = document.querySelector('.sig-canvas-container.signature-fullscreen');
      if (openContainer) toggleSignatureFullscreen(openContainer.querySelector('canvas').id, true);
    });

    window.addEventListener('resize', () => {
      const openCanvas = document.querySelector('.sig-canvas-container.signature-fullscreen canvas');
      if (!openCanvas || !sigCanvases[openCanvas.id]) return;
      layoutSignatureCanvas(sigCanvases[openCanvas.id], true);
      requestAnimationFrame(() => resizeSignaturePad(openCanvas.id));
    });

    function applyDashboardWidgetState(widgetId, collapsed) {
      const widget = document.getElementById(widgetId);
      if (!widget) return;
      widget.classList.toggle('is-collapsed', collapsed);
      const button = document.querySelector(`[data-collapse-button="${widgetId}"]`);
      if (button) { button.textContent = collapsed ? '+' : '−'; button.setAttribute('aria-label', collapsed ? 'Buka' : 'Minimize'); }
    }

    function toggleDashboardWidget(widgetId) {
      const widget = document.getElementById(widgetId);
      if (!widget) return;
      const collapsed = !widget.classList.contains('is-collapsed');
      applyDashboardWidgetState(widgetId, collapsed);
      localStorage.setItem('legacyWidget:' + widgetId, collapsed ? '1' : '0');
    }

    function restoreDashboardWidgetStates() {
      ['dashboardTodayScheduleWidget','dashboardLatestStudentsWidget','formAbsensiContainer','studentReportAdminBox','formJadwalPenggantiBox'].forEach(widgetId => {
        applyDashboardWidgetState(widgetId, localStorage.getItem('legacyWidget:' + widgetId) === '1');
      });
    }

    function toggleSidebar() {
      const sb = document.getElementById('sidebarMenu'); const ov = document.getElementById('sidebarOverlay');
      if(sb.classList.contains('open')) closeSidebar();
      else { sb.style.display = 'flex'; setTimeout(() => sb.classList.add('open'), 10); ov.style.display = 'block'; }
    }

    function closeSidebar() {
      const sb = document.getElementById('sidebarMenu'); const ov = document.getElementById('sidebarOverlay');
      sb.classList.remove('open'); ov.style.display = 'none';
      setTimeout(() => { if(!sb.classList.contains('open') && window.innerWidth <= 768) sb.style.display = 'none'; }, 300);
    }



    // Unified searchable person filter used across Admin/Guru/Siswa pages.
    // The original <select> remains the source of truth so existing onchange
    // handlers and business logic keep working unchanged.
    const LMC_PERSON_FILTERS = {
      adminSelectGuruFilter:'teacher',
      lpPageTeacher:'teacher', lpPageStudent:'student',
      repertoireTeacherFilter:'teacher', repertoireStudentFilter:'student',
      studentReportGuru:'teacher',
      filterSiswaGuru:'teacher', filterJadwalGuru:'teacher',
      makeupFilterTeacher:'teacher', operationalCalendarTeacher:'teacher',
      filterProgressGuru:'teacher', filterProgressSiswa:'student', absensiSiswa:'student',
      taskStudentFilter:'student', practiceStudentFilter:'student', teacherAttendanceFilterTeacher:'teacher'
    };

    function lmcPersonInitials(name) {
      const words=String(name||'').trim().split(/\s+/).filter(Boolean);
      if (!words.length) return '?';
      return (words.length===1 ? words[0].slice(0,1) : words[0].slice(0,1)+words[1].slice(0,1)).toUpperCase();
    }

    function lmcPersonCleanLabel(label) {
      return String(label||'').replace(/\s+/g,' ').trim();
    }

    function lmcPersonFindStudent(value, label) {
      const v=String(value||'').trim().toLowerCase();
      const text=lmcPersonCleanLabel(label).toLowerCase();
      return (globalSiswaList||[]).find(s=>{
        const id=String(s.siswaID||s.id||'').trim().toLowerCase();
        const name=String(s.nama||'').trim().toLowerCase();
        return (v && (v===id || v===name)) || (name && (text===name || text.startsWith(name+' ') || text.startsWith(name+'(') || text.startsWith(name+' -') || text.startsWith(name+' •')));
      }) || null;
    }

    function lmcPersonFindTeacher(value, label) {
      const v=String(value||'').trim().toLowerCase();
      const text=lmcPersonCleanLabel(label).toLowerCase();
      return (globalGuruList||[]).find(g=>{
        const id=String(g.id||g.guruID||'').trim().toLowerCase();
        const name=String(g.nama||'').trim().toLowerCase();
        return (v && (v===id || v===name)) || (name && (text===name || text.startsWith(name+' ') || text.startsWith(name+'(') || text.startsWith(name+' -') || text.startsWith(name+' •')));
      }) || null;
    }

    function lmcPersonStudentMeta(student, fallback='') {
      if (!student) return fallback || 'Siswa';
      const classes=Array.isArray(student.kelasList)?student.kelasList:[];
      const cls=classes[0]||{};
      return [cls.instrumen||student.instrumen||'', cls.grade||cls.kelas||student.kelas||''].filter(Boolean).join(' • ') || 'Siswa';
    }

    function lmcPersonTeacherMeta(teacher, fallback='') {
      if (!teacher) return fallback || 'Guru Pengajar';
      return String(teacher.instrumen||'Guru Pengajar').trim() || 'Guru Pengajar';
    }

    function lmcPersonPhotoCandidates(value) {
      const raw=String(value||'').trim();
      if(!raw)return [];
      const list=[];
      const push=url=>{const clean=String(url||'').trim();if(clean&&!list.includes(clean))list.push(clean);};
      if(/^data:image\//i.test(raw)||/^blob:/i.test(raw)){push(raw);return list;}
      let match=raw.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
      if(!match)match=raw.match(/[?&]id=([^&#]+)/i);
      if(!match)match=raw.match(/googleusercontent\.com\/d\/([^/?#]+)/i);
      if(match&&match[1]){
        const id=decodeURIComponent(match[1]);
        push(`https://lh3.googleusercontent.com/d/${id}`);
        push(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w400`);
        push(`https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`);
      }
      push(raw);
      return list;
    }

    function lmcPersonAvatarFallback(img) {
      if(!img)return;
      try{
        const list=JSON.parse(img.dataset.lmcPhotoFallbacks||'[]');
        const index=Number(img.dataset.lmcPhotoFallbackIndex||0);
        if(index<list.length){img.dataset.lmcPhotoFallbackIndex=String(index+1);img.src=list[index];return;}
      }catch(_){}
      img.style.display='none';
      if(img.nextElementSibling)img.nextElementSibling.style.display='grid';
    }

    function lmcPersonAvatar(person, kind, fallbackName) {
      const name=String(person?.nama||fallbackName||'').trim();
      const photo=String(person?.foto||person?.photoUrl||person?.fotoProfil||person?.photo_url||'').trim();
      const initials=lmcPersonInitials(name);
      const candidates=lmcPersonPhotoCandidates(photo);
      if(candidates.length){
        const fallbacks=escapeTaskHtml(JSON.stringify(candidates.slice(1)));
        return `<span class="lmc-person-avatar"><img src="${escapeTaskHtml(candidates[0])}" data-lmc-photo-fallbacks='${fallbacks}' data-lmc-photo-fallback-index="0" alt="${escapeTaskHtml(name)}" onerror="lmcPersonAvatarFallback(this)"><span style="display:none">${escapeTaskHtml(initials)}</span></span>`;
      }
      return `<span class="lmc-person-avatar"><span>${escapeTaskHtml(initials)}</span></span>`;
    }

    function lmcPersonFilterOptionModel(select, option, kind) {
      const label=lmcPersonCleanLabel(option.textContent||option.label||'');
      const value=String(option.value??'');
      const generic=!value || /^(semua|pilih|--)/i.test(label);
      if (generic) return {value,label:label||((kind==='teacher')?'Semua Guru':'Semua Siswa'),meta:kind==='teacher'?'Tampilkan semua guru':'Tampilkan semua siswa',person:null,generic:true};
      const person=kind==='teacher'?lmcPersonFindTeacher(value,label):lmcPersonFindStudent(value,label);
      const name=person?.nama || label.replace(/\s*[\(•—-].*$/,'').trim() || label;
      const meta=kind==='teacher'?lmcPersonTeacherMeta(person,label===name?'':label.replace(name,'').replace(/^[\s(•—-]+|[)\s]+$/g,'')):lmcPersonStudentMeta(person,label===name?'':label.replace(name,'').replace(/^[\s(•—-]+|[)\s]+$/g,''));
      return {value,label:name,meta,person,generic:false};
    }

    function closeLmcPersonFilterPickers(except=null) {
      document.querySelectorAll('.lmc-person-filter.open').forEach(host=>{
        if (host===except) return;
        host.classList.remove('open');
        host.querySelector('.lmc-person-filter-trigger')?.setAttribute('aria-expanded','false');
      });
    }

    function lmcPersonFilterSearch(host, query) {
      const q=String(query||'').trim().toLowerCase(); let count=0;
      host.querySelectorAll('.lmc-person-filter-option').forEach(row=>{
        const ok=!q || String(row.dataset.search||'').includes(q);
        row.hidden=!ok; if(ok)count++;
      });
      const empty=host.querySelector('.lmc-person-filter-empty'); if(empty) empty.hidden=count>0;
    }

    function lmcPersonFilterChoose(selectId, encodedValue) {
      const select=document.getElementById(selectId); if(!select)return;
      let value=''; try{value=decodeURIComponent(encodedValue||'');}catch(_){value=encodedValue||'';}
      select.value=value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      closeLmcPersonFilterPickers();
      requestAnimationFrame(()=>refreshLmcPersonFilterPicker(select));
    }

    function refreshLmcPersonFilterPicker(select) {
      if (!select || !LMC_PERSON_FILTERS[select.id]) return;
      const kind=LMC_PERSON_FILTERS[select.id];
      let host=select.nextElementSibling;
      if (!host || !host.classList.contains('lmc-person-filter')) return enhanceLmcPersonFilter(select);
      const options=[...select.options].map(o=>lmcPersonFilterOptionModel(select,o,kind));
      const selected=options.find(o=>String(o.value)===String(select.value)) || options[0] || {label:kind==='teacher'?'Pilih Guru':'Pilih Siswa',meta:'',generic:true};
      const triggerPerson=selected.generic
        ? `<span class="lmc-person-avatar generic">${kind==='teacher'?'🎓':'◎'}</span>`
        : lmcPersonAvatar(selected.person,kind,selected.label);
      const trigger=host.querySelector('.lmc-person-filter-trigger');
      trigger.disabled=!!select.disabled;
      host.classList.toggle('is-disabled',!!select.disabled);
      trigger.innerHTML=`<span class="lmc-person-filter-person">${triggerPerson}<span><b>${escapeTaskHtml(selected.label)}</b><small>${escapeTaskHtml(selected.meta||'')}</small></span></span><span class="lmc-person-filter-chevron">⌄</span>`;
      const list=host.querySelector('.lmc-person-filter-options');
      if(list) list.innerHTML=options.map(item=>{
        const avatar=item.generic?`<span class="lmc-person-avatar generic">${kind==='teacher'?'🎓':'◎'}</span>`:lmcPersonAvatar(item.person,kind,item.label);
        const active=String(item.value)===String(select.value)?' active':'';
        const search=escapeTaskHtml(`${item.label} ${item.meta}`.toLowerCase());
        return `<button type="button" class="lmc-person-filter-option${active}" data-search="${search}" onclick="lmcPersonFilterChoose('${escapeTaskHtml(select.id)}','${encodeURIComponent(item.value)}')">${avatar}<span><b>${escapeTaskHtml(item.label)}</b><small>${escapeTaskHtml(item.meta||'')}</small></span></button>`;
      }).join('')+`<div class="lmc-person-filter-empty" hidden>Tidak ada ${kind==='teacher'?'guru':'siswa'} yang cocok.</div>`;
    }

    function enhanceLmcPersonFilter(select) {
      if (!select || !LMC_PERSON_FILTERS[select.id]) return;
      if (select.id==='taskStudentFilter' && currentUser?.userType==='siswa') {
        select.classList.add('lmc-person-filter-native');
        const oldHost=select.nextElementSibling;
        if(oldHost?.classList?.contains('lmc-person-filter')) oldHost.remove();
        return;
      }
      if (select.nextElementSibling?.classList.contains('lmc-person-filter')) return refreshLmcPersonFilterPicker(select);
      const kind=LMC_PERSON_FILTERS[select.id];
      select.classList.add('lmc-person-filter-native');
      const host=document.createElement('div'); host.className='lmc-person-filter'; host.dataset.forSelect=select.id;
      host.innerHTML=`<button type="button" class="lmc-person-filter-trigger" aria-expanded="false"></button><button type="button" class="lmc-person-filter-backdrop" aria-label="Tutup pilihan"></button><div class="lmc-person-filter-menu"><div class="lmc-person-filter-head"><div><b>${kind==='teacher'?'Pilih Guru':'Pilih Siswa'}</b><small>Cari berdasarkan nama, instrumen, atau kelas</small></div><button type="button" class="lmc-person-filter-close" aria-label="Tutup">×</button></div><div class="lmc-person-filter-search"><span>⌕</span><input type="search" placeholder="Cari ${kind==='teacher'?'guru':'siswa'}..."></div><div class="lmc-person-filter-options"></div></div>`;
      select.insertAdjacentElement('afterend',host);
      const trigger=host.querySelector('.lmc-person-filter-trigger');
      trigger.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();refreshLmcPersonFilterPicker(select);if(select.disabled)return;const open=!host.classList.contains('open');closeLmcPersonFilterPickers(host);host.classList.toggle('open',open);trigger.setAttribute('aria-expanded',open?'true':'false');if(open)setTimeout(()=>host.querySelector('input[type="search"]')?.focus(),20);});
      host.querySelector('.lmc-person-filter-close').addEventListener('click',()=>closeLmcPersonFilterPickers());
      host.querySelector('.lmc-person-filter-backdrop').addEventListener('click',()=>closeLmcPersonFilterPickers());
      host.querySelector('input[type="search"]').addEventListener('input',event=>lmcPersonFilterSearch(host,event.target.value));
      select.addEventListener('change',()=>requestAnimationFrame(()=>refreshLmcPersonFilterPicker(select)));
      refreshLmcPersonFilterPicker(select);
    }

    function refreshAllLmcPersonFilterPickers() {
      Object.keys(LMC_PERSON_FILTERS).forEach(id=>{const select=document.getElementById(id);if(select)enhanceLmcPersonFilter(select);});
    }

    function initLmcPersonFilterPickers() {
      if (window.__lmcPersonFiltersReady) { refreshAllLmcPersonFilterPickers(); return; }
      window.__lmcPersonFiltersReady=true;
      refreshAllLmcPersonFilterPickers();
      document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('.lmc-person-filter'))closeLmcPersonFilterPickers();},true);
      document.addEventListener('keydown',event=>{if(event.key==='Escape')closeLmcPersonFilterPickers();});
      const observer=new MutationObserver(records=>{
        let needs=false;
        for(const record of records){
          const target=record.target;
          if(target?.id && LMC_PERSON_FILTERS[target.id]){needs=true;break;}
          if(target?.closest){const select=target.closest('select');if(select?.id && LMC_PERSON_FILTERS[select.id]){needs=true;break;}}
          if([...record.addedNodes||[]].some(node=>node.nodeType===1 && (node.matches?.('select') || node.querySelector?.('select')))){needs=true;break;}
        }
        if(needs) requestAnimationFrame(refreshAllLmcPersonFilterPickers);
      });
      observer.observe(document.body,{childList:true,subtree:true});
    }
