/* Patch 04H: presentation-only searchable student selector; native select remains source of truth. */
(function(){
  const IDS=['tugasPilihSiswa','repertoireSiswa','practiceResourceStudent','lpStudent','annualExamStudent'];
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize=s=>String(s??'').toLocaleLowerCase('id').trim();
  function alignMobileViewport(){
    const vv=window.visualViewport;
    document.documentElement.style.setProperty('--lmc-picker-visible-top',`${Math.max(0,vv?.offsetTop||0)}px`);
    document.documentElement.style.setProperty('--lmc-picker-visible-height',`${Math.max(240,vv?.height||window.innerHeight)}px`);
  }
  window.visualViewport?.addEventListener('resize',alignMobileViewport);
  window.visualViewport?.addEventListener('scroll',alignMobileViewport);
  window.addEventListener('orientationchange',alignMobileViewport);
  function closeAll(){
    document.querySelectorAll('.lmc-unified-picker.is-open').forEach(el=>{
      el.classList.remove('is-open');
      el.querySelector('.lmc-unified-trigger')?.setAttribute('aria-expanded','false');
      const menu=document.querySelector('.lmc-unified-menu.is-portal-open');
      const backdrop=document.querySelector('.lmc-unified-backdrop.is-portal-open');
      if(menu&&menu._lmcOwner===el){menu.classList.remove('is-portal-open');el.appendChild(menu);}
      if(backdrop&&backdrop._lmcOwner===el){backdrop.classList.remove('is-portal-open');el.appendChild(backdrop);}
    });
  }
  function avatarFor(option){
    const id=String(option.value||'');
    const student=(typeof globalSiswaList!=='undefined'&&Array.isArray(globalSiswaList)?globalSiswaList:[]).find(s=>String(s.siswaID||'')===id || String(s.nama||'').toLowerCase()===id.toLowerCase());
    if(student&&typeof phStudentAvatar==='function')return phStudentAvatar(student,'sm');
    const ch=String(student?.nama||option.textContent||'?').trim().charAt(0).toUpperCase();
    return `<span class="ph-student-avatar sm"><span>${escHtml(ch)}</span></span>`;
  }
  function setup(select){
    if(select.dataset.lmcUnified==='1')return;
    select.dataset.lmcUnified='1';select.classList.add('lmc-unified-native');
    const root=document.createElement('div');root.className='lmc-unified-picker';
    root.innerHTML='<button type="button" class="lmc-unified-trigger" aria-expanded="false"><span class="lmc-unified-selected">Pilih Siswa</span><span aria-hidden="true">⌄</span></button><div class="lmc-unified-backdrop"></div><div class="lmc-unified-menu"><div class="lmc-unified-heading"><strong>Pilih Siswa</strong><button type="button" class="lmc-unified-close" aria-label="Tutup">×</button></div><input class="lmc-unified-search" type="search" placeholder="Cari nama siswa atau instrumen..." aria-label="Cari siswa"><div class="lmc-unified-options"></div><div class="lmc-unified-empty" hidden>Tidak ada siswa yang cocok.</div></div>';
    select.insertAdjacentElement('afterend',root);
    const trigger=root.querySelector('.lmc-unified-trigger'), search=root.querySelector('.lmc-unified-search'), list=root.querySelector('.lmc-unified-options'), menu=root.querySelector('.lmc-unified-menu'), backdrop=root.querySelector('.lmc-unified-backdrop');
    const sync=()=>{
      const opt=select.selectedOptions?.[0];
      root.querySelector('.lmc-unified-selected').innerHTML=opt&&opt.value?`${avatarFor(opt)}<span>${escHtml(opt.textContent)}</span>`:`<span>${escHtml(opt?.textContent?.trim()||'Pilih Siswa...')}</span>`;
      trigger.disabled=select.disabled;
    };
    const rebuild=()=>{
      list.replaceChildren();
      Array.from(select.options).forEach(opt=>{
        const btn=document.createElement('button');btn.type='button';btn.className='lmc-unified-item';
        btn.dataset.search=normalize(opt.textContent);btn.dataset.value=opt.value;
        btn.disabled=opt.disabled;btn.setAttribute('aria-selected',String(opt.selected));
        btn.innerHTML=`${opt.value?avatarFor(opt):'<span class="ph-student-avatar sm"><span>◎</span></span>'}<span>${escHtml(opt.textContent)}</span>`;
        btn.addEventListener('click',()=>{
          select.value=opt.value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          sync();closeAll();
        });list.appendChild(btn);
      });sync();filter();
    };
    const filter=()=>{const q=normalize(search.value);let count=0;list.querySelectorAll('.lmc-unified-item').forEach(btn=>{const yes=!q||btn.dataset.search.includes(q);btn.hidden=!yes;if(yes)count++;});root.querySelector('.lmc-unified-empty').hidden=count!==0;};
    trigger.addEventListener('click',()=>{const opening=!root.classList.contains('is-open');closeAll();if(opening){rebuild();search.value='';filter();alignMobileViewport();root.classList.add('is-open');trigger.setAttribute('aria-expanded','true');if(window.innerWidth<=600){menu._lmcOwner=root;backdrop._lmcOwner=root;document.body.appendChild(backdrop);document.body.appendChild(menu);backdrop.classList.add('is-portal-open');menu.classList.add('is-portal-open');}else setTimeout(()=>search.focus(),20);}});
    search.addEventListener('input',filter);
    search.addEventListener('focus',()=>{alignMobileViewport();requestAnimationFrame(alignMobileViewport);});
    root.querySelector('.lmc-unified-close').addEventListener('click',closeAll);
    root.querySelector('.lmc-unified-backdrop').addEventListener('click',closeAll);
    select.addEventListener('change',sync);
    new MutationObserver(()=>{if(root.classList.contains('is-open'))rebuild();else sync();}).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['selected','disabled']});
    sync();
  }
  function init(){IDS.forEach(id=>{const el=document.getElementById(id);if(el)setup(el);});
    const exam=document.getElementById('annualExamStudent');if(exam)setup(exam);
  }
  document.addEventListener('click',e=>{if(!e.target.closest('.lmc-unified-picker')&&!e.target.closest('.lmc-unified-menu.is-portal-open')&&!e.target.closest('.lmc-unified-backdrop.is-portal-open'))closeAll();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  // Annual exam form is dynamically injected and rebuilt.
  new MutationObserver(()=>{const el=document.getElementById('annualExamStudent');if(el&&!el.dataset.lmcUnified)setup(el);}).observe(document.documentElement,{childList:true,subtree:true});
})();
