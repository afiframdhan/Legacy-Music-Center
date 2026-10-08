    let practiceHubLoaded = false;
    let practiceResources = [];
    let mediaEvaluations = [];
    let practiceActiveEvaluation = '';

    function phEsc(value) {
      return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function phYoutubeId(url) {
      const text = String(url || '').trim();
      if (!text) return '';
      const match = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);
      return match ? match[1] : '';
    }

    function phFormatDate(value) {
      if (!value) return '-';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
    }

    function loadPracticeHub() {
      const loading = document.getElementById('practiceHubLoading');
      if (loading) { loading.style.display='block'; loading.textContent = practiceHubLoaded ? 'Memperbarui materi latihan...' : 'Memuat materi latihan...'; }
      google.script.run.withSuccessHandler(res => {
        if (!res || res.success === false) {
          if (loading) loading.style.display='none';
          showAlert('alertDanger', res?.message || 'Materi latihan gagal dimuat.');
          return;
        }
        practiceResources = Array.isArray(res.resources) ? res.resources : [];
        mediaEvaluations = Array.isArray(res.evaluations) ? res.evaluations : [];
        if (Array.isArray(res.repertoire)) globalRepertoireList = res.repertoire;
        practiceHubLoaded = true;
        populatePracticeFilters();
        renderPracticeHub();
      }).withFailureHandler(err => {
        if (loading) loading.style.display='none';
        showAlert('alertDanger','Materi latihan gagal dimuat: '+(err?.message||err));
      }).getPracticeHubData();
    }

    function populatePracticeFilters() {
      const studentFilter = document.getElementById('practiceStudentFilter');
      const teacherActions = document.getElementById('practiceTeacherActions');
      if (teacherActions) teacherActions.style.display = currentUser.userType === 'guru' ? 'flex' : 'none';
      if (!studentFilter) return;
      if (currentUser.userType === 'siswa') {
        studentFilter.innerHTML = `<option value="${phEsc(currentUser.userID)}">${phEsc(currentUser.userName)}</option>`;
        studentFilter.value = currentUser.userID;
        studentFilter.closest('.form-group').style.display='none';
      } else {
        studentFilter.closest('.form-group').style.display='block';
        const old=studentFilter.value;
        const students=(globalSiswaList||[]).slice().sort((a,b)=>String(a.nama||'').localeCompare(String(b.nama||''),'id'));
        studentFilter.innerHTML='<option value="">Semua Siswa</option>'+students.map(s=>`<option value="${phEsc(s.siswaID)}">${phEsc(s.nama)} • ${phEsc(s.instrumen||'Musik')}</option>`).join('');
        if ([...studentFilter.options].some(o=>o.value===old)) studentFilter.value=old;
      }
    }

    function phFilteredResources() {
      const sid=String(document.getElementById('practiceStudentFilter')?.value||'').trim();
      const q=String(document.getElementById('practiceSearch')?.value||'').trim().toLowerCase();
      return practiceResources.filter(x => (!sid || String(x.studentID||'')===sid) && (!q || [x.title,x.description,x.studentName,x.instrument].some(v=>String(v||'').toLowerCase().includes(q))));
    }
    function phFilteredEvaluations() {
      const sid=String(document.getElementById('practiceStudentFilter')?.value||'').trim();
      const q=String(document.getElementById('practiceSearch')?.value||'').trim().toLowerCase();
      return mediaEvaluations.filter(x => (!sid || String(x.studentID||'')===sid) && (!q || [x.title,x.studentName,x.instrument,x.strength,x.improvement].some(v=>String(v||'').toLowerCase().includes(q))));
    }

    function renderPracticeHub() {
      const loading=document.getElementById('practiceHubLoading'); if(loading) loading.style.display='none';
      renderPracticeResources();
      renderMediaEvaluations();
      const r=phFilteredResources(), e=phFilteredEvaluations();
      const a=document.getElementById('practiceStatResources'), b=document.getElementById('practiceStatVideos'), c=document.getElementById('practiceStatFiles'), d=document.getElementById('practiceStatEvaluations');
      if(a)a.textContent=r.length;
      if(b)b.textContent=r.filter(x=>x.youtubeUrl).length;
      if(c)c.textContent=r.reduce((n,x)=>n+(Array.isArray(x.attachments)?x.attachments.length:0),0);
      if(d)d.textContent=e.length;
    }

    function renderPracticeResources() {
      const host=document.getElementById('practiceResourceList'); if(!host)return;
      const items=phFilteredResources();
      if(!items.length){host.innerHTML='<div class="practice-empty">Belum ada materi latihan untuk filter ini.</div>';return;}
      host.innerHTML=items.map(item=>{
        const yid=phYoutubeId(item.youtubeUrl);
        const files=Array.isArray(item.attachments)?item.attachments:[];
        return `<article class="practice-resource-card">
          <div class="practice-card-head"><div><span class="practice-kicker">${phEsc(item.instrument||'Materi Latihan')}</span><h3>${phEsc(item.title||'Materi Latihan')}</h3><p>${phEsc(item.studentName||'')} • ${phEsc(item.teacherName||'')}</p></div>${currentUser.userType==='guru'?`<div class="practice-card-actions"><button class="btn btn-export" onclick="openPracticeResourceModal('${phEsc(item.resourceID)}')">Edit</button><button class="btn practice-danger" onclick="deletePracticeResource('${phEsc(item.resourceID)}')">Hapus</button></div>`:''}</div>
          ${item.description?`<p class="practice-description">${phEsc(item.description)}</p>`:''}
          ${yid?`<div class="practice-video"><iframe src="https://www.youtube.com/embed/${phEsc(yid)}" title="${phEsc(item.title)}" loading="lazy" allowfullscreen></iframe></div>`:''}
          ${files.length?`<div class="practice-files">${files.map(f=>`<a class="practice-file" href="${phEsc(f.url||'#')}" target="_blank" rel="noopener"><span>📄</span><span><b>${phEsc(f.name||'File latihan')}</b><small>${phEsc(f.type||'File Google Drive')}</small></span></a>`).join('')}</div>`:''}
          <div class="practice-meta">Diperbarui ${phEsc(phFormatDate(item.updatedAt||item.createdAt))}</div>
        </article>`;
      }).join('');
    }

    function phScoreLabel(score) {
      const n=Number(score||0); if(n>=85)return 'Sangat Baik'; if(n>=70)return 'Baik'; if(n>=60)return 'Cukup'; return 'Perlu Latihan';
    }

    function renderMediaEvaluations() {
      const host=document.getElementById('mediaEvaluationList'); if(!host)return;
      const items=phFilteredEvaluations();
      if(!items.length){host.innerHTML='<div class="practice-empty">Belum ada Evaluasi Audio/Video.</div>';return;}
      host.innerHTML=items.map(item=>{
        const score=Math.round(Number(item.averageScore||0));
        return `<button type="button" class="media-eval-card" onclick="openMediaEvaluationDetail('${phEsc(item.evaluationID)}')">
          <div class="media-eval-score" style="--score:${score}%"><strong>${score}%</strong><span>${phEsc(phScoreLabel(score))}</span></div>
          <div class="media-eval-copy"><span class="practice-kicker">${phEsc(item.instrument||'Evaluasi')}</span><h3>${phEsc(item.title||'Evaluasi Audio / Video')}</h3><p>${phEsc(item.studentName||'')} • ${phEsc(item.teacherName||'')} • ${phEsc(phFormatDate(item.updatedAt||item.createdAt))}</p></div><span class="media-eval-arrow">›</span>
        </button>`;
      }).join('');
    }

    function practiceStudentOptions(selected='') {
      return (globalSiswaList||[]).slice().sort((a,b)=>String(a.nama||'').localeCompare(String(b.nama||''),'id')).map(s=>`<option value="${phEsc(s.siswaID)}" ${String(s.siswaID)===String(selected)?'selected':''}>${phEsc(s.nama)} • ${phEsc(s.instrumen||'Musik')}</option>`).join('');
    }

    function practiceInstrumentForStudent(studentId) {
      const s=(globalSiswaList||[]).find(x=>String(x.siswaID)===String(studentId));
      const classes=Array.isArray(s?.kelasList)?s.kelasList:[];
      return [...new Set([...(classes.map(x=>x.instrumen)),s?.instrumen].filter(Boolean))];
    }

    function syncPracticeResourceInstrument() {
      const sid=document.getElementById('practiceResourceStudent')?.value;
      const sel=document.getElementById('practiceResourceInstrument'); if(!sel)return;
      const values=practiceInstrumentForStudent(sid); const old=sel.value;
      sel.innerHTML=(values.length?values:['Musik']).map(v=>`<option value="${phEsc(v)}">${phEsc(v)}</option>`).join('');
      if(values.includes(old))sel.value=old;
    }

    function openPracticeResourceModal(id='') {
      if(currentUser.userType!=='guru') return;
      const item=practiceResources.find(x=>String(x.resourceID)===String(id));
      document.getElementById('practiceResourceId').value=item?.resourceID||'';
      document.getElementById('practiceResourceStudent').innerHTML=practiceStudentOptions(item?.studentID||'');
      document.getElementById('practiceResourceTitle').value=item?.title||'';
      document.getElementById('practiceResourceDescription').value=item?.description||'';
      document.getElementById('practiceResourceYoutube').value=item?.youtubeUrl||'';
      document.getElementById('practiceResourceFiles').value='';
      syncPracticeResourceInstrument();
      if(item?.instrument) document.getElementById('practiceResourceInstrument').value=item.instrument;
      document.getElementById('practiceResourceModalTitle').textContent=item?'Edit Materi Latihan':'Tambah Materi Latihan';
      document.getElementById('modalPracticeResource').style.display='flex';
    }
    function closePracticeResourceModal(){document.getElementById('modalPracticeResource').style.display='none';}

    function practiceFilesPayload(files){return Promise.all(files.map(file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=e=>resolve({dataUrl:e.target.result,name:file.name,type:file.type||'application/octet-stream',size:file.size});r.onerror=()=>reject(new Error('Gagal membaca '+file.name));r.readAsDataURL(file);})));}

    function savePracticeResource(event){
      event.preventDefault();
      const btn=document.getElementById('btnSavePracticeResource'); const files=Array.from(document.getElementById('practiceResourceFiles').files||[]);
      if(files.length>5){showAlert('alertDanger','Maksimal 5 file per materi.');return false;}
      if(files.some(f=>String(f.type||'').startsWith('video/'))){showAlert('alertDanger','Video tutorial gunakan link YouTube Unlisted. File video tidak diunggah ke Google Drive.');return false;}
      btn.disabled=true;btn.textContent='Menyimpan...';
      practiceFilesPayload(files).then(uploadFiles=>{
        const payload={resourceID:document.getElementById('practiceResourceId').value,studentID:document.getElementById('practiceResourceStudent').value,instrument:document.getElementById('practiceResourceInstrument').value,title:document.getElementById('practiceResourceTitle').value.trim(),description:document.getElementById('practiceResourceDescription').value.trim(),youtubeUrl:document.getElementById('practiceResourceYoutube').value.trim(),files:uploadFiles};
        google.script.run.withSuccessHandler(res=>{btn.disabled=false;btn.textContent='Simpan Materi';if(res?.success){closePracticeResourceModal();showAlert('alertSuccess',res.message||'Materi latihan tersimpan.');loadPracticeHub();}else showAlert('alertDanger',res?.message||'Gagal menyimpan materi.');}).withFailureHandler(err=>{btn.disabled=false;btn.textContent='Simpan Materi';showAlert('alertDanger',err?.message||String(err));}).savePracticeResource(payload);
      }).catch(err=>{btn.disabled=false;btn.textContent='Simpan Materi';showAlert('alertDanger',err.message);});
      return false;
    }

    function deletePracticeResource(id){if(!confirm('Hapus materi latihan ini?'))return;google.script.run.withSuccessHandler(res=>{showAlert(res?.success?'alertSuccess':'alertDanger',res?.message||'');if(res?.success)loadPracticeHub();}).deletePracticeResource(id);}

    function syncEvaluationInstrument() {
      const sid=document.getElementById('mediaEvalStudent')?.value, sel=document.getElementById('mediaEvalInstrument'); if(!sel)return;
      const vals=practiceInstrumentForStudent(sid); const old=sel.value; sel.innerHTML=(vals.length?vals:['Musik']).map(v=>`<option value="${phEsc(v)}">${phEsc(v)}</option>`).join('');if(vals.includes(old))sel.value=old;
      const rep=document.getElementById('mediaEvalRepertoire');
      if(rep){const list=(globalRepertoireList||[]).filter(r=>String(r.siswaID)===String(sid));rep.innerHTML='<option value="">Tanpa Repertoire</option>'+list.map(r=>`<option value="${phEsc(r.repertoireID)}">${phEsc(r.judulLagu||'-')}</option>`).join('');}
    }

    function openMediaEvaluationModal(id='') {
      if(currentUser.userType!=='guru')return;
      const item=mediaEvaluations.find(x=>String(x.evaluationID)===String(id));
      document.getElementById('mediaEvalId').value=item?.evaluationID||'';
      document.getElementById('mediaEvalStudent').innerHTML=practiceStudentOptions(item?.studentID||'');
      syncEvaluationInstrument();
      if(item?.instrument)document.getElementById('mediaEvalInstrument').value=item.instrument;
      if(item?.repertoireID)document.getElementById('mediaEvalRepertoire').value=item.repertoireID;
      document.getElementById('mediaEvalTitle').value=item?.title||'';
      document.getElementById('mediaEvalUrl').value=item?.mediaUrl||'';
      ['tone','rhythm','tempo','technique','expression'].forEach(k=>document.getElementById('mediaEval'+k[0].toUpperCase()+k.slice(1)).value=Number(item?.scores?.[k]||0));
      document.getElementById('mediaEvalStrength').value=item?.strength||'';
      document.getElementById('mediaEvalImprovement').value=item?.improvement||'';
      document.getElementById('mediaEvalNextTarget').value=item?.nextTarget||'';
      document.getElementById('mediaEvalMarkers').value=(item?.markers||[]).map(m=>`${m.time||''} | ${m.text||''}`).join('\n');
      document.getElementById('mediaEvalNotes').value=item?.notes||'';
      document.getElementById('mediaEvaluationModalTitle').textContent=item?'Edit Evaluasi Audio/Video':'Evaluasi Audio/Video Baru';
      document.getElementById('modalMediaEvaluation').style.display='flex';
    }
    function closeMediaEvaluationModal(){document.getElementById('modalMediaEvaluation').style.display='none';}

    function saveMediaEvaluation(event){event.preventDefault();const btn=document.getElementById('btnSaveMediaEvaluation');btn.disabled=true;btn.textContent='Menyimpan...';const score=k=>Math.max(0,Math.min(100,Number(document.getElementById(k).value||0)));const payload={evaluationID:document.getElementById('mediaEvalId').value,studentID:document.getElementById('mediaEvalStudent').value,instrument:document.getElementById('mediaEvalInstrument').value,repertoireID:document.getElementById('mediaEvalRepertoire').value,title:document.getElementById('mediaEvalTitle').value.trim(),mediaUrl:document.getElementById('mediaEvalUrl').value.trim(),tone:score('mediaEvalTone'),rhythm:score('mediaEvalRhythm'),tempo:score('mediaEvalTempo'),technique:score('mediaEvalTechnique'),expression:score('mediaEvalExpression'),strength:document.getElementById('mediaEvalStrength').value.trim(),improvement:document.getElementById('mediaEvalImprovement').value.trim(),nextTarget:document.getElementById('mediaEvalNextTarget').value.trim(),markers:document.getElementById('mediaEvalMarkers').value,notes:document.getElementById('mediaEvalNotes').value.trim()};google.script.run.withSuccessHandler(res=>{btn.disabled=false;btn.textContent='Simpan Evaluasi';if(res?.success){closeMediaEvaluationModal();showAlert('alertSuccess',res.message||'Evaluasi tersimpan.');loadPracticeHub();}else showAlert('alertDanger',res?.message||'Gagal menyimpan evaluasi.');}).withFailureHandler(err=>{btn.disabled=false;btn.textContent='Simpan Evaluasi';showAlert('alertDanger',err?.message||String(err));}).saveMediaEvaluation(payload);return false;}

    function openMediaEvaluationDetail(id){
      const item=mediaEvaluations.find(x=>String(x.evaluationID)===String(id));if(!item)return;practiceActiveEvaluation=id;
      const yid=phYoutubeId(item.mediaUrl);const s=item.scores||{};const rows=[['Tone',s.tone],['Rhythm',s.rhythm],['Tempo',s.tempo],['Teknik',s.technique],['Ekspresi',s.expression]];
      document.getElementById('mediaEvaluationDetailBody').innerHTML=`<div class="media-eval-detail-grid"><div><div class="practice-card-head"><div><span class="practice-kicker">${phEsc(item.instrument||'Evaluasi')}</span><h2>${phEsc(item.title)}</h2><p>${phEsc(item.studentName)} • ${phEsc(item.teacherName)}</p></div></div>${item.mediaUrl?(yid?`<div class="practice-video"><iframe src="https://www.youtube.com/embed/${phEsc(yid)}" allowfullscreen></iframe></div>`:`<a class="btn btn-export" href="${phEsc(item.mediaUrl)}" target="_blank" rel="noopener">▶ Buka Audio / Video</a>`):'<div class="practice-empty">Tidak ada link media.</div>'}<div class="media-score-list">${rows.map(([name,val])=>`<div><b>${name}</b><span class="media-score-bar"><i style="width:${Math.max(0,Math.min(100,Number(val||0)))}%"></i></span><strong>${Number(val||0)}</strong><em>${phEsc(phScoreLabel(val))}</em></div>`).join('')}</div><div class="media-markers">${(item.markers||[]).map(m=>`<div><b>▶ ${phEsc(m.time||'')}</b><span>${phEsc(m.text||'')}</span></div>`).join('')}</div></div><aside class="media-eval-summary"><div class="media-ring"><strong>${Math.round(Number(item.averageScore||0))}%</strong><span>Skor Keseluruhan</span></div><div class="media-summary-box good"><b>🏆 Kekuatan Utama</b><p>${phEsc(item.strength||'-')}</p></div><div class="media-summary-box improve"><b>▥ Area yang Perlu Ditingkatkan</b><p>${phEsc(item.improvement||'-')}</p></div><div class="media-summary-box target"><b>🎯 Target Selanjutnya</b><p>${phEsc(item.nextTarget||'-')}</p></div>${item.notes?`<div class="media-summary-box"><b>Catatan Guru</b><p>${phEsc(item.notes)}</p></div>`:''}</aside></div>`;
      const actions=document.getElementById('mediaEvaluationDetailActions');actions.innerHTML=currentUser.userType==='guru'?`<button class="btn practice-danger" onclick="deleteMediaEvaluation('${phEsc(id)}')">Hapus</button><button class="btn btn-export" onclick="closeMediaEvaluationDetail();openMediaEvaluationModal('${phEsc(id)}')">Edit</button><button class="btn btn-primary" onclick="closeMediaEvaluationDetail()">Tutup</button>`:`<button class="btn btn-primary" onclick="closeMediaEvaluationDetail()">Tutup</button>`;
      document.getElementById('modalMediaEvaluationDetail').style.display='flex';
    }
    function closeMediaEvaluationDetail(){document.getElementById('modalMediaEvaluationDetail').style.display='none';practiceActiveEvaluation='';}
    function deleteMediaEvaluation(id){if(!confirm('Hapus evaluasi Audio/Video ini?'))return;google.script.run.withSuccessHandler(res=>{showAlert(res?.success?'alertSuccess':'alertDanger',res?.message||'');if(res?.success){closeMediaEvaluationDetail();loadPracticeHub();}}).deleteMediaEvaluation(id);}
