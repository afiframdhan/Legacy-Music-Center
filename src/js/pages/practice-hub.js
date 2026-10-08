    let practiceHubLoaded = false;
    let practiceResources = [];
    let mediaEvaluations = [];
    let practiceActiveEvaluation = '';
    let mediaEvalBrowseStudent = '';
    let mediaEvalBrowseSource = '';
    let practiceActiveTab = 'materials';

    const MEDIA_EVAL_ASPECT_PRESETS = {
      gitar:[
        {key:'tone',label:'Tone',description:'Kualitas suara, kejernihan, sustain, dan konsistensi tone.'},
        {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme, groove, dan kestabilan ketukan.'},
        {key:'tempo',label:'Tempo',description:'Kestabilan tempo sepanjang lagu.'},
        {key:'technique',label:'Teknik',description:'Fingering, picking, chord/scale, artikulasi, dan kontrol bunyi.'},
        {key:'expression',label:'Ekspresi',description:'Musikalitas, dinamika, phrasing, dan penghayatan.'}
      ],
      piano:[
        {key:'tone',label:'Tone & Touch',description:'Kontrol sentuhan, kualitas bunyi, dan keseimbangan tangan.'},
        {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme dan kestabilan pulse.'},
        {key:'tempo',label:'Tempo',description:'Kestabilan tempo serta kontrol perubahan tempo.'},
        {key:'technique',label:'Teknik',description:'Fingering, koordinasi tangan, artikulasi, dan pedal.'},
        {key:'expression',label:'Ekspresi',description:'Dinamika, phrasing, interpretasi, dan musikalitas.'}
      ],
      drum:[
        {key:'timing',label:'Timing',description:'Ketepatan masuk beat dan konsistensi terhadap pulse.'},
        {key:'groove',label:'Groove',description:'Feel, pocket, dan konsistensi pola irama.'},
        {key:'tempo',label:'Tempo',description:'Kemampuan menjaga tempo dari awal hingga akhir.'},
        {key:'technique',label:'Teknik',description:'Stick control, koordinasi, rudiment, dan kontrol dinamika.'},
        {key:'dynamics',label:'Dinamika',description:'Kontrol keras-lembut, aksen, dan keseimbangan antar bagian drum.'}
      ],
      vocal:[
        {key:'intonation',label:'Intonasi',description:'Ketepatan tinggi-rendah nada dan kestabilan pitch.'},
        {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme dan penempatan frase terhadap beat.'},
        {key:'breath',label:'Pernapasan',description:'Kontrol napas, support, dan pembagian frase.'},
        {key:'technique',label:'Teknik Vokal',description:'Resonansi, artikulasi, register, dan kontrol suara.'},
        {key:'expression',label:'Ekspresi',description:'Interpretasi, dinamika, emosi, dan komunikasi lagu.'}
      ],
      biola:[
        {key:'intonation',label:'Intonasi',description:'Ketepatan pitch dan konsistensi posisi jari.'},
        {key:'tone',label:'Tone',description:'Kualitas bunyi, kontrol bow, dan kejernihan suara.'},
        {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme dan kestabilan pulse.'},
        {key:'technique',label:'Teknik Bowing',description:'Arah bow, artikulasi, fingering, dan koordinasi.'},
        {key:'expression',label:'Ekspresi',description:'Dinamika, phrasing, vibrato, dan musikalitas.'}
      ],
      violin:null,
      cello:[
        {key:'intonation',label:'Intonasi',description:'Ketepatan pitch dan konsistensi posisi jari.'},
        {key:'tone',label:'Tone',description:'Kualitas bunyi, resonansi, dan kontrol bow.'},
        {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme dan kestabilan pulse.'},
        {key:'technique',label:'Teknik',description:'Bowing, fingering, shifting, dan koordinasi.'},
        {key:'expression',label:'Ekspresi',description:'Dinamika, phrasing, vibrato, dan musikalitas.'}
      ],
      saxophone:[
        {key:'tone',label:'Tone',description:'Kualitas tone, support udara, dan konsistensi bunyi.'},
        {key:'intonation',label:'Intonasi',description:'Ketepatan pitch di seluruh register.'},
        {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme dan kestabilan pulse.'},
        {key:'articulation',label:'Artikulasi',description:'Tonguing, legato, attack, dan kejernihan frase.'},
        {key:'expression',label:'Ekspresi',description:'Dinamika, phrasing, interpretasi, dan musikalitas.'}
      ],
      default:[
        {key:'tone',label:'Tone',description:'Kualitas dan konsistensi bunyi.'},
        {key:'rhythm',label:'Rhythm',description:'Ketepatan ritme dan kestabilan pulse.'},
        {key:'tempo',label:'Tempo',description:'Kestabilan tempo.'},
        {key:'technique',label:'Teknik',description:'Ketepatan dan kontrol teknik instrumen.'},
        {key:'expression',label:'Ekspresi',description:'Musikalitas, dinamika, dan penghayatan.'}
      ]
    };
    MEDIA_EVAL_ASPECT_PRESETS.violin = MEDIA_EVAL_ASPECT_PRESETS.biola;

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

    function phStudent(studentId) {
      return (globalSiswaList||[]).find(x=>String(x.siswaID||'')===String(studentId||'')) || {};
    }

    function phStudentClassLabel(student, preferredInstrument='') {
      const classes=Array.isArray(student?.kelasList)?student.kelasList:[];
      const match=classes.find(c=>String(c.instrumen||'').toLowerCase()===String(preferredInstrument||'').toLowerCase()) || classes[0] || {};
      return [match.instrumen||student?.instrumen||'Musik',match.grade||match.kelas||student?.kelas||'Kelas Regular'].filter(Boolean).join(' • ');
    }

    function phStudentAvatar(student, size='md') {
      const name=String(student?.nama||'S').trim();
      const initial=phEsc(name.charAt(0).toUpperCase()||'S');
      if (student?.foto) return `<span class="ph-student-avatar ${size}"><img src="${phEsc(student.foto)}" alt="${phEsc(name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span style="display:none">${initial}</span></span>`;
      return `<span class="ph-student-avatar ${size}"><span>${initial}</span></span>`;
    }

    function loadPracticeHub() {
      if (typeof ensureLiveModules === 'function') ensureLiveModules(['assignments']).catch(()=>{});
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
        mediaEvalBrowseStudent = String(currentUser.userID||'');
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
      const generalSid=String(document.getElementById('practiceStudentFilter')?.value||'').trim();
      const sid=mediaEvalBrowseStudent || generalSid;
      const source=String(mediaEvalBrowseSource||'');
      const q=String(document.getElementById('practiceSearch')?.value||'').trim().toLowerCase();
      return mediaEvaluations.filter(x => {
        const sourceMatch=!source || `${x.sourceType||''}:${x.sourceID||''}`===source;
        return (!sid || String(x.studentID||'')===sid) && sourceMatch && (!q || [x.title,x.studentName,x.instrument,x.strength,x.improvement,x.sourceLabel].some(v=>String(v||'').toLowerCase().includes(q)));
      });
    }

    function setPracticeHubTab(tab) {
      practiceActiveTab = tab === 'evaluations' ? 'evaluations' : 'materials';
      document.getElementById('practiceMaterialsPane')?.classList.toggle('active', practiceActiveTab === 'materials');
      document.getElementById('practiceEvaluationsPane')?.classList.toggle('active', practiceActiveTab === 'evaluations');
      document.getElementById('practiceTabMaterials')?.classList.toggle('active', practiceActiveTab === 'materials');
      document.getElementById('practiceTabEvaluations')?.classList.toggle('active', practiceActiveTab === 'evaluations');
      const addMaterial = document.getElementById('practiceAddMaterialBtn');
      const addEvaluation = document.getElementById('practiceAddEvaluationBtn');
      if (currentUser.userType === 'guru') {
        if (addMaterial) addMaterial.style.display = practiceActiveTab === 'materials' ? 'inline-flex' : 'none';
        if (addEvaluation) addEvaluation.style.display = practiceActiveTab === 'evaluations' ? 'inline-flex' : 'none';
      }
      try { sessionStorage.setItem('legacyPracticeTab', practiceActiveTab); } catch (_) {}
    }

    function renderPracticeHub() {
      const loading=document.getElementById('practiceHubLoading'); if(loading) loading.style.display='none';
      if (!practiceActiveTab) {
        try { practiceActiveTab = sessionStorage.getItem('legacyPracticeTab') || 'materials'; } catch (_) { practiceActiveTab='materials'; }
      }
      setPracticeHubTab(practiceActiveTab);
      renderPracticeResources();
      renderMediaEvaluationBrowseFilters();
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

    function mediaEvalSourceItems(studentId) {
      const sid=String(studentId||'');
      const s=phStudent(sid); const name=String(s.nama||'').trim().toLowerCase();
      const tasks=(globalTugasList||[]).filter(t=>String(t.siswaID||'')===sid || (!t.siswaID && String(t.namaSiswa||'').trim().toLowerCase()===name)).map(t=>({type:'assignment',id:String(t.tugasID||''),label:String(t.judulTugas||'Tugas'),meta:`Tugas • ${t.tipeTugas||'Latihan'}`}));
      const resources=practiceResources.filter(r=>String(r.studentID||'')===sid).map(r=>({type:'practice',id:String(r.resourceID||''),label:String(r.title||'Latihan Mandiri'),meta:`Latihan • ${r.instrument||'Musik'}`}));
      const repertoire=(globalRepertoireList||[]).filter(r=>String(r.siswaID||'')===sid).map(r=>({type:'repertoire',id:String(r.repertoireID||''),label:String(r.judulLagu||'Repertoire'),meta:'Repertoire'}));
      return [...resources,...tasks,...repertoire].filter(x=>x.id);
    }

    function mediaEvalSourceOptions(studentId, selected='') {
      const items=mediaEvalSourceItems(studentId); const groups=[['practice','Latihan Mandiri'],['assignment','Tugas'],['repertoire','Repertoire']];
      let html='<option value="">Semua / Tanpa sumber khusus</option>';
      groups.forEach(([type,label])=>{const rows=items.filter(x=>x.type===type);if(rows.length)html+=`<optgroup label="${label}">${rows.map(x=>`<option value="${phEsc(`${x.type}:${x.id}`)}" ${`${x.type}:${x.id}`===selected?'selected':''}>${phEsc(x.label)}</option>`).join('')}</optgroup>`;});
      return html;
    }

    function renderStudentPicker(hostId, studentId, onPickName, allowAll=false) {
      const host=document.getElementById(hostId); if(!host)return;
      const student=phStudent(studentId);
      const triggerLabel=student?.siswaID ? `<span class="ph-picker-student">${phStudentAvatar(student,'sm')}<span><b>${phEsc(student.nama||'-')}</b><small>${phEsc(phStudentClassLabel(student))}</small></span></span>` : `<span class="ph-picker-placeholder">${allowAll?'Semua Siswa':'Pilih Siswa'}</span>`;
      const rows=(globalSiswaList||[]).slice().sort((a,b)=>String(a.nama||'').localeCompare(String(b.nama||''),'id'));
      host.innerHTML=`<button type="button" class="ph-picker-trigger" aria-expanded="false" onclick="togglePhStudentPicker('${phEsc(hostId)}',event)">${triggerLabel}<span class="ph-picker-chevron">⌄</span></button><button type="button" class="ph-picker-backdrop" aria-label="Tutup pilihan siswa" onclick="closePhStudentPickers()"></button><div class="ph-picker-menu"><div class="ph-picker-menu-head"><div><b>Pilih Siswa</b><small>Cari berdasarkan nama, instrumen, atau kelas</small></div><button type="button" class="ph-picker-close" onclick="closePhStudentPickers()">×</button></div><div class="ph-picker-search-wrap"><span>⌕</span><input type="search" class="ph-picker-search" placeholder="Cari siswa..." oninput="filterPhStudentPicker('${phEsc(hostId)}',this.value)"></div><div class="ph-picker-options">${allowAll?`<button type="button" class="ph-picker-option" data-search="semua siswa" onclick="${onPickName}('')"><span class="ph-picker-all">◎</span><span><b>Semua Siswa</b><small>Tampilkan seluruh evaluasi</small></span></button>`:''}${rows.map(s=>{const search=phEsc(`${s.nama||''} ${phStudentClassLabel(s)}`.toLowerCase());return `<button type="button" class="ph-picker-option ${String(s.siswaID)===String(studentId)?'active':''}" data-search="${search}" onclick="${onPickName}('${phEsc(s.siswaID)}')">${phStudentAvatar(s,'sm')}<span><b>${phEsc(s.nama||'-')}</b><small>${phEsc(phStudentClassLabel(s))}</small></span></button>`;}).join('')}<div class="ph-picker-empty" hidden>Tidak ada siswa yang cocok.</div></div></div>`;
    }

    function closePhStudentPickers(){
      document.querySelectorAll('.ph-student-picker.open').forEach(el=>{el.classList.remove('open');el.querySelector('.ph-picker-trigger')?.setAttribute('aria-expanded','false');});
    }
    function togglePhStudentPicker(hostId,event){
      event?.stopPropagation?.();
      const host=document.getElementById(hostId);if(!host)return;
      const willOpen=!host.classList.contains('open');
      closePhStudentPickers();
      if(willOpen){host.classList.add('open');host.querySelector('.ph-picker-trigger')?.setAttribute('aria-expanded','true');setTimeout(()=>host.querySelector('.ph-picker-search')?.focus(),30);}
    }
    function filterPhStudentPicker(hostId,value){
      const host=document.getElementById(hostId);if(!host)return;
      const q=String(value||'').trim().toLowerCase();let shown=0;
      host.querySelectorAll('.ph-picker-option').forEach(option=>{const ok=!q||String(option.dataset.search||'').includes(q);option.hidden=!ok;if(ok)shown++;});
      const empty=host.querySelector('.ph-picker-empty');if(empty)empty.hidden=shown>0;
    }
    if(!window.__lmcStudentPickerOutsideBound){
      window.__lmcStudentPickerOutsideBound=true;
      document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('.ph-student-picker'))closePhStudentPickers();},true);
      document.addEventListener('keydown',event=>{if(event.key==='Escape')closePhStudentPickers();});
    }

    function chooseMediaEvalBrowseStudent(studentId){mediaEvalBrowseStudent=String(studentId||'');mediaEvalBrowseSource='';renderMediaEvaluationBrowseFilters();renderMediaEvaluations();}
    function chooseMediaEvalFormStudent(studentId){const sel=document.getElementById('mediaEvalStudent');if(sel)sel.value=studentId;document.getElementById('mediaEvalStudentPicker')?.classList.remove('open');syncEvaluationInstrument();renderStudentPicker('mediaEvalStudentPicker',studentId,'chooseMediaEvalFormStudent',false);}

    function renderMediaEvaluationBrowseFilters(){
      const host=document.getElementById('mediaEvaluationBrowseFilters');if(!host)return;
      if(currentUser.userType==='siswa')mediaEvalBrowseStudent=String(currentUser.userID||'');
      const sid=mediaEvalBrowseStudent;
      host.innerHTML=`<div class="media-eval-browse-grid"><div><label>Pilih Siswa</label><div id="mediaEvalBrowseStudentPicker" class="ph-student-picker"></div></div><div><label>Pilih Tugas / Latihan</label><select id="mediaEvalBrowseSource" onchange="mediaEvalBrowseSource=this.value;renderMediaEvaluations()">${mediaEvalSourceOptions(sid,mediaEvalBrowseSource)}</select></div></div>`;
      const picker=document.getElementById('mediaEvalBrowseStudentPicker');if(picker){if(currentUser.userType==='siswa'){const student=phStudent(sid);picker.innerHTML=`<div class="ph-picker-trigger readonly"><span class="ph-picker-student">${phStudentAvatar(student,'sm')}<span><b>${phEsc(student.nama||currentUser.userName||'-')}</b><small>${phEsc(phStudentClassLabel(student))}</small></span></span></div>`;}else renderStudentPicker('mediaEvalBrowseStudentPicker',sid,'chooseMediaEvalBrowseStudent',true);}
      const select=document.getElementById('mediaEvalBrowseSource');if(select)select.disabled=!sid;
    }

    function renderMediaEvaluations() {
      const host=document.getElementById('mediaEvaluationList'); if(!host)return;
      const items=phFilteredEvaluations();
      if(!items.length){host.innerHTML='<div class="practice-empty">Belum ada Evaluasi Audio/Video untuk pilihan ini.</div>';return;}
      host.innerHTML=items.map(item=>{
        const score=Math.round(Number(item.averageScore||0));
        return `<button type="button" class="media-eval-card" onclick="openMediaEvaluationDetail('${phEsc(item.evaluationID)}')">
          <div class="media-eval-score" style="--score:${score}%"><strong>${score}%</strong><span>${phEsc(phScoreLabel(score))}</span></div>
          <div class="media-eval-copy"><span class="practice-kicker">${phEsc(item.instrument||'Evaluasi')}</span><h3>${phEsc(item.title||'Evaluasi Audio / Video')}</h3><p>${phEsc(item.studentName||'')} • ${phEsc(item.sourceLabel||item.teacherName||'')} • ${phEsc(phFormatDate(item.updatedAt||item.createdAt))}</p></div><span class="media-eval-arrow">›</span>
        </button>`;
      }).join('');
    }

    function practiceStudentOptions(selected='') {
      return (globalSiswaList||[]).slice().sort((a,b)=>String(a.nama||'').localeCompare(String(b.nama||''),'id')).map(s=>`<option value="${phEsc(s.siswaID)}" ${String(s.siswaID)===String(selected)?'selected':''}>${phEsc(s.nama)} • ${phEsc(s.instrumen||'Musik')}</option>`).join('');
    }

    function practiceInstrumentForStudent(studentId) {
      const s=phStudent(studentId);
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

    function mediaEvalPresetForInstrument(instrument) {
      const key=String(instrument||'').trim().toLowerCase();
      return (MEDIA_EVAL_ASPECT_PRESETS[key]||MEDIA_EVAL_ASPECT_PRESETS.default).map(x=>({...x,score:0}));
    }

    function normalizeMediaEvalAspects(item, instrument) {
      if(Array.isArray(item?.aspects)&&item.aspects.length)return item.aspects.map((x,i)=>({key:String(x.key||`aspect_${i+1}`),label:String(x.label||`Aspek ${i+1}`),description:String(x.description||''),score:Math.max(0,Math.min(100,Number(x.score||0)))}));
      const s=item?.scores||{}; const preset=mediaEvalPresetForInstrument(instrument||item?.instrument);
      return preset.map(x=>({...x,score:Number(s[x.key]??s[{tone:'tone',rhythm:'rhythm',tempo:'tempo',technique:'technique',expression:'expression'}[x.key]]??0)}));
    }

    function renderMediaEvalAspectEditor(aspects) {
      const host=document.getElementById('mediaEvalAspectEditor');if(!host)return;
      host.innerHTML=(aspects||[]).map((a,i)=>`<div class="media-aspect-editor-row" data-index="${i}" data-key="${phEsc(a.key||`aspect_${i+1}`)}"><div class="media-aspect-editor-title"><input class="media-aspect-label-input" value="${phEsc(a.label||`Aspek ${i+1}`)}" aria-label="Nama aspek"><small>${phEsc(a.description||'')}</small></div><input class="media-aspect-range" type="range" min="0" max="100" value="${Math.max(0,Math.min(100,Number(a.score||0)))}" oninput="this.nextElementSibling.value=this.value;updateMediaAspectBadge(this.closest('.media-aspect-editor-row'))"><input class="media-aspect-number" type="number" min="0" max="100" value="${Math.max(0,Math.min(100,Number(a.score||0)))}" oninput="this.previousElementSibling.value=Math.max(0,Math.min(100,Number(this.value||0)));updateMediaAspectBadge(this.closest('.media-aspect-editor-row'))"><span class="media-aspect-badge">${phEsc(phScoreLabel(a.score))}</span></div>`).join('');
    }
    function updateMediaAspectBadge(row){if(!row)return;const n=Math.max(0,Math.min(100,Number(row.querySelector('.media-aspect-number')?.value||0)));const badge=row.querySelector('.media-aspect-badge');if(badge)badge.textContent=phScoreLabel(n);}
    function collectMediaEvalAspects(host=document.getElementById('mediaEvalAspectEditor')){return [...(host?.querySelectorAll('.media-aspect-editor-row')||[])].map((row,i)=>({key:String(row.dataset.key||`aspect_${i+1}`),label:String(row.querySelector('.media-aspect-label-input')?.value||`Aspek ${i+1}`).trim(),description:String(row.querySelector('small')?.textContent||'').trim(),score:Math.max(0,Math.min(100,Number(row.querySelector('.media-aspect-number')?.value||0)))}));}

    function syncEvaluationInstrument(keepAspects=false) {
      const sid=document.getElementById('mediaEvalStudent')?.value, sel=document.getElementById('mediaEvalInstrument'); if(!sel)return;
      const vals=practiceInstrumentForStudent(sid); const old=sel.value; sel.innerHTML=(vals.length?vals:['Musik']).map(v=>`<option value="${phEsc(v)}">${phEsc(v)}</option>`).join('');if(vals.includes(old))sel.value=old;
      const source=document.getElementById('mediaEvalSource');if(source){const selected=source.value;source.innerHTML=mediaEvalSourceOptions(sid,selected);}
      const rep=document.getElementById('mediaEvalRepertoire');if(rep){const list=(globalRepertoireList||[]).filter(r=>String(r.siswaID)===String(sid));rep.innerHTML='<option value="">Tanpa Repertoire</option>'+list.map(r=>`<option value="${phEsc(r.repertoireID)}">${phEsc(r.judulLagu||'-')}</option>`).join('');}
      if(!keepAspects)renderMediaEvalAspectEditor(mediaEvalPresetForInstrument(sel.value));
    }

    function onMediaEvalInstrumentChange(){renderMediaEvalAspectEditor(mediaEvalPresetForInstrument(document.getElementById('mediaEvalInstrument')?.value));}
    function onMediaEvalSourceChange(){const value=String(document.getElementById('mediaEvalSource')?.value||'');const [type,id]=value.split(':');const item=mediaEvalSourceItems(document.getElementById('mediaEvalStudent')?.value).find(x=>x.type===type&&x.id===id);const title=document.getElementById('mediaEvalTitle');if(item&&title&&!title.value.trim())title.value=item.label;const rep=document.getElementById('mediaEvalRepertoire');if(rep)rep.value=type==='repertoire'?id:'';}

    function openMediaEvaluationModal(id='') {
      if(currentUser.userType!=='guru')return;
      const item=mediaEvaluations.find(x=>String(x.evaluationID)===String(id));
      const sid=item?.studentID || (mediaEvalBrowseStudent || (globalSiswaList?.[0]?.siswaID||''));
      document.getElementById('mediaEvalId').value=item?.evaluationID||'';
      document.getElementById('mediaEvalStudent').innerHTML=practiceStudentOptions(sid);
      renderStudentPicker('mediaEvalStudentPicker',sid,'chooseMediaEvalFormStudent',false);
      syncEvaluationInstrument(true);
      if(item?.instrument)document.getElementById('mediaEvalInstrument').value=item.instrument;
      const sourceValue=item?.sourceType&&item?.sourceID?`${item.sourceType}:${item.sourceID}`:(item?.repertoireID?`repertoire:${item.repertoireID}`:'');
      document.getElementById('mediaEvalSource').innerHTML=mediaEvalSourceOptions(sid,sourceValue);
      document.getElementById('mediaEvalSource').value=sourceValue;
      if(item?.repertoireID)document.getElementById('mediaEvalRepertoire').value=item.repertoireID;
      document.getElementById('mediaEvalTitle').value=item?.title||'';
      document.getElementById('mediaEvalUrl').value=item?.mediaUrl||'';
      renderMediaEvalAspectEditor(normalizeMediaEvalAspects(item,item?.instrument||document.getElementById('mediaEvalInstrument').value));
      document.getElementById('mediaEvalStrength').value=item?.strength||'';
      document.getElementById('mediaEvalImprovement').value=item?.improvement||'';
      document.getElementById('mediaEvalNextTarget').value=item?.nextTarget||'';
      document.getElementById('mediaEvalMarkers').value=(item?.markers||[]).map(m=>`${m.time||''} | ${m.text||''}`).join('\n');
      document.getElementById('mediaEvalNotes').value=item?.notes||'';
      document.getElementById('mediaEvaluationModalTitle').textContent=item?'Edit Evaluasi Audio/Video':'Evaluasi Audio/Video Baru';
      document.getElementById('modalMediaEvaluation').style.display='flex';
    }
    function closeMediaEvaluationModal(){document.getElementById('modalMediaEvaluation').style.display='none';document.getElementById('mediaEvalStudentPicker')?.classList.remove('open');}

    function buildMediaEvaluationPayloadFromForm(){
      const sourceValue=String(document.getElementById('mediaEvalSource')?.value||'');const idx=sourceValue.indexOf(':');const sourceType=idx>-1?sourceValue.slice(0,idx):'';const sourceID=idx>-1?sourceValue.slice(idx+1):'';const sourceItem=mediaEvalSourceItems(document.getElementById('mediaEvalStudent').value).find(x=>x.type===sourceType&&x.id===sourceID);
      return {evaluationID:document.getElementById('mediaEvalId').value,studentID:document.getElementById('mediaEvalStudent').value,instrument:document.getElementById('mediaEvalInstrument').value,repertoireID:sourceType==='repertoire'?sourceID:document.getElementById('mediaEvalRepertoire').value,sourceType,sourceID,sourceLabel:sourceItem?.label||'',title:document.getElementById('mediaEvalTitle').value.trim(),mediaUrl:document.getElementById('mediaEvalUrl').value.trim(),aspects:collectMediaEvalAspects(),strength:document.getElementById('mediaEvalStrength').value.trim(),improvement:document.getElementById('mediaEvalImprovement').value.trim(),nextTarget:document.getElementById('mediaEvalNextTarget').value.trim(),markers:document.getElementById('mediaEvalMarkers').value,notes:document.getElementById('mediaEvalNotes').value.trim()};
    }

    function saveMediaEvaluation(event){event.preventDefault();const btn=document.getElementById('btnSaveMediaEvaluation');btn.disabled=true;btn.textContent='Menyimpan...';const payload=buildMediaEvaluationPayloadFromForm();google.script.run.withSuccessHandler(res=>{btn.disabled=false;btn.textContent='Simpan Evaluasi';if(res?.success){closeMediaEvaluationModal();showAlert('alertSuccess',res.message||'Evaluasi tersimpan.');loadPracticeHub();}else showAlert('alertDanger',res?.message||'Gagal menyimpan evaluasi.');}).withFailureHandler(err=>{btn.disabled=false;btn.textContent='Simpan Evaluasi';showAlert('alertDanger',err?.message||String(err));}).saveMediaEvaluation(payload);return false;}

    function mediaEvalDetailAspectRows(item){
      const aspects=normalizeMediaEvalAspects(item,item.instrument); const editable=currentUser.userType==='guru';
      return aspects.map((a,i)=>`<div class="media-detail-aspect" data-key="${phEsc(a.key||`aspect_${i+1}`)}" data-description="${phEsc(a.description||'')}"><div class="media-detail-aspect-copy">${editable?`<input class="media-detail-aspect-label" value="${phEsc(a.label)}">`:`<b>${phEsc(a.label)}</b>`}<small>${phEsc(a.description||'')}</small></div><div class="media-detail-score-control"><input class="media-detail-range" type="range" min="0" max="100" value="${Number(a.score||0)}" ${editable?'':'disabled'} oninput="this.nextElementSibling.value=this.value;this.closest('.media-detail-aspect').querySelector('.media-detail-score-badge').textContent=phScoreLabel(this.value)"><input class="media-detail-number" type="number" min="0" max="100" value="${Number(a.score||0)}" ${editable?'':'readonly'} oninput="this.previousElementSibling.value=Math.max(0,Math.min(100,Number(this.value||0)));this.closest('.media-detail-aspect').querySelector('.media-detail-score-badge').textContent=phScoreLabel(this.value)"><span class="media-detail-score-badge">${phEsc(phScoreLabel(a.score))}</span></div></div>`).join('');
    }

    function openMediaEvaluationDetail(id){
      const item=mediaEvaluations.find(x=>String(x.evaluationID)===String(id));if(!item)return;practiceActiveEvaluation=id;
      const yid=phYoutubeId(item.mediaUrl);const student=phStudent(item.studentID);
      document.getElementById('mediaEvaluationDetailBody').innerHTML=`<div class="media-eval-reference-layout"><div class="media-eval-reference-main"><div class="media-eval-detail-student"><div>${phStudentAvatar(student,'md')}<div><span class="practice-kicker">${phEsc(item.instrument||'Evaluasi')}</span><h2>${phEsc(item.studentName||student.nama||'-')}</h2><p>${phEsc(phStudentClassLabel(student,item.instrument))}</p></div></div><div class="media-eval-source-pill"><span>🎵</span><div><small>Tugas / Latihan</small><b>${phEsc(item.sourceLabel||item.title||'Evaluasi Audio/Video')}</b></div></div></div><div class="media-player-card"><div class="practice-section-title"><div><h3>Pemutar Media</h3><p>${phEsc(item.title||'Evaluasi Audio/Video')}</p></div></div>${item.mediaUrl?(yid?`<div class="practice-video"><iframe src="https://www.youtube.com/embed/${phEsc(yid)}" allowfullscreen></iframe></div>`:`<a class="btn btn-export" href="${phEsc(item.mediaUrl)}" target="_blank" rel="noopener">▶ Buka Audio / Video</a>`):'<div class="practice-empty">Tidak ada link media.</div>'}</div><div class="media-aspect-panel"><div class="practice-section-title"><div><h3>Aspek Penilaian</h3><p>Aspek otomatis menyesuaikan instrumen. Guru dapat mengubah nilai langsung di sini.</p></div></div><div id="mediaDetailAspectList">${mediaEvalDetailAspectRows(item)}</div>${currentUser.userType==='guru'?`<button type="button" class="btn btn-primary media-inline-save" onclick="saveMediaEvaluationInline('${phEsc(id)}')">Simpan Nilai</button>`:''}</div><div class="media-markers">${(item.markers||[]).map(m=>`<div><b>▶ ${phEsc(m.time||'')}</b><span>${phEsc(m.text||'')}</span></div>`).join('')}</div></div><aside class="media-eval-summary"><div class="media-ring" style="background:conic-gradient(#22c55e ${Math.round(Number(item.averageScore||0))}%,#e5e7eb 0)"><strong id="mediaDetailAverage">${Math.round(Number(item.averageScore||0))}%</strong><span>Skor Keseluruhan</span></div><div class="media-summary-box good"><b>🏆 Kekuatan Utama</b><p>${phEsc(item.strength||'-')}</p></div><div class="media-summary-box improve"><b>▥ Area yang Perlu Ditingkatkan</b><p>${phEsc(item.improvement||'-')}</p></div><div class="media-summary-box target"><b>🎯 Target Selanjutnya</b><p>${phEsc(item.nextTarget||'-')}</p></div>${item.notes?`<div class="media-summary-box"><b>Catatan Guru</b><p>${phEsc(item.notes)}</p></div>`:''}</aside></div>`;
      const actions=document.getElementById('mediaEvaluationDetailActions');actions.innerHTML=currentUser.userType==='guru'?`<button class="btn practice-danger" onclick="deleteMediaEvaluation('${phEsc(id)}')">Hapus</button><button class="btn btn-export" onclick="closeMediaEvaluationDetail();openMediaEvaluationModal('${phEsc(id)}')">Edit Detail</button><button class="btn btn-primary" onclick="closeMediaEvaluationDetail()">Tutup</button>`:`<button class="btn btn-primary" onclick="closeMediaEvaluationDetail()">Tutup</button>`;
      document.getElementById('modalMediaEvaluationDetail').style.display='flex';
    }

    function saveMediaEvaluationInline(id){
      const item=mediaEvaluations.find(x=>String(x.evaluationID)===String(id));if(!item||currentUser.userType!=='guru')return;
      const rows=[...(document.querySelectorAll('#mediaDetailAspectList .media-detail-aspect')||[])];
      const aspects=rows.map((row,i)=>({key:String(row.dataset.key||`aspect_${i+1}`),label:String(row.querySelector('.media-detail-aspect-label')?.value||row.querySelector('b')?.textContent||`Aspek ${i+1}`).trim(),description:String(row.dataset.description||''),score:Math.max(0,Math.min(100,Number(row.querySelector('.media-detail-number')?.value||0)))}));
      const payload={evaluationID:item.evaluationID,studentID:item.studentID,instrument:item.instrument,repertoireID:item.repertoireID||'',sourceType:item.sourceType||'',sourceID:item.sourceID||'',sourceLabel:item.sourceLabel||'',title:item.title,mediaUrl:item.mediaUrl,aspects,strength:item.strength,improvement:item.improvement,nextTarget:item.nextTarget,markers:(item.markers||[]).map(m=>`${m.time||''} | ${m.text||''}`).join('\n'),notes:item.notes};
      const btn=document.querySelector('.media-inline-save');if(btn){btn.disabled=true;btn.textContent='Menyimpan...';}
      google.script.run.withSuccessHandler(res=>{if(btn){btn.disabled=false;btn.textContent='Simpan Nilai';}if(res?.success){showAlert('alertSuccess','Nilai evaluasi diperbarui.');loadPracticeHub();closeMediaEvaluationDetail();}else showAlert('alertDanger',res?.message||'Gagal menyimpan nilai.');}).withFailureHandler(err=>{if(btn){btn.disabled=false;btn.textContent='Simpan Nilai';}showAlert('alertDanger',err?.message||String(err));}).saveMediaEvaluation(payload);
    }

    function closeMediaEvaluationDetail(){document.getElementById('modalMediaEvaluationDetail').style.display='none';practiceActiveEvaluation='';}
    function deleteMediaEvaluation(id){if(!confirm('Hapus evaluasi Audio/Video ini?'))return;google.script.run.withSuccessHandler(res=>{showAlert(res?.success?'alertSuccess':'alertDanger',res?.message||'');if(res?.success){closeMediaEvaluationDetail();loadPracticeHub();}}).deleteMediaEvaluation(id);}
