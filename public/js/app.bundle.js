(function () {
  'use strict';

  // V3: identical read requests share the same in-flight Promise. No response cache is kept,
  // so writes are still reflected on the next request exactly as before.
  const inflightReads = new Map();
  const DEDUPE_METHODS = new Set(['getDashboardData', 'getGuruList', 'getLearningProgressPrintLogo']);

  async function rawRpc(method, args) {
    const response = await fetch('/api/rpc', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, args })
    });

    let payload = null;
    try { payload = await response.json(); }
    catch (_) { throw new Error('Respons API tidak valid.'); }

    if (!response.ok || !payload || payload.ok === false) {
      const error = new Error((payload && payload.error) || `API error (${response.status})`);
      error.status = response.status;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('legacy:session-expired'));
      throw error;
    }
    return payload.data;
  }

  function rpc(method, args) {
    if (!DEDUPE_METHODS.has(method)) return rawRpc(method, args);
    let key;
    try { key = `${method}:${JSON.stringify(args)}`; }
    catch (_) { return rawRpc(method, args); }
    if (inflightReads.has(key)) return inflightReads.get(key);
    const request = rawRpc(method, args).finally(() => inflightReads.delete(key));
    inflightReads.set(key, request);
    return request;
  }

  function makeRunner() {
    const state = { success: null, failure: null };
    let proxy;
    proxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') return function (fn) { state.success = fn; return proxy; };
        if (prop === 'withFailureHandler') return function (fn) { state.failure = fn; return proxy; };
        if (prop === 'then') return undefined;
        return function (...args) {
          rpc(String(prop), args)
            .then(result => { if (typeof state.success === 'function') state.success(result); })
            .catch(error => {
              if (typeof state.failure === 'function') state.failure(error);
              else console.error(`[Legacy API] ${String(prop)} failed`, error);
            });
          return proxy;
        };
      }
    });
    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: false,
    enumerable: true,
    get: makeRunner
  });

  window.LegacyAPI = { rpc };
})();

let currentUser = { userType: '', userID: '', userName: '' };
    let loginType = 'siswa';
    let globalSiswaList = [];
    let globalJadwalList = [];
    let globalAbsensiList = [];
    let globalTugasList = [];
    let globalGuruList = [];
    let globalJadwalPenggantiList = [];
    let globalPengumumanList = [];
    let globalLearningProgressList = [];
    let globalStudentHistory = [];
    let globalTeacherAttendanceList = [];
    let studentReportView = 'all';
    let globalSelectedLearningProgressStudent = '';
    let cropperInstance = null;
    let selectedFileName = 'profile.jpg';
    let calendarInstance = null;
    let sigCanvases = {};
    let dashboardRequestNumber = 0;
    let notificationTimer = null;
    const AUTH_STORAGE_KEY = 'legacyMusicCenterAuth';
    const AUTH_COOKIE_KEY = 'legacyMusicCenterAuthPersistent';
    const THEME_STORAGE_KEY = 'legacyThemePreference';
    let themeMediaListenerReady = false;


(function () {
  'use strict';

  const pending = new Map();

  function loadScript(key, src, ready) {
    if (ready()) return Promise.resolve();
    if (pending.has(key)) return pending.get(key);
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-legacy-vendor="${key}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', () => reject(new Error(`Gagal memuat ${key}.`)), { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.legacyVendor = key;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Gagal memuat ${key}.`));
      document.head.appendChild(script);
    }).finally(() => {
      if (!ready()) pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  }

  function loadStyle(key, href) {
    if (document.querySelector(`link[data-legacy-vendor="${key}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.legacyVendor = key;
    document.head.appendChild(link);
  }

  function loadFullCalendar() {
    return loadScript(
      'fullcalendar',
      'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js',
      () => Boolean(window.FullCalendar && window.FullCalendar.Calendar)
    );
  }

  function loadCropper() {
    loadStyle('cropper-css', 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css');
    return loadScript(
      'cropper',
      'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
      () => typeof window.Cropper === 'function'
    );
  }

  window.LegacyVendors = { loadFullCalendar, loadCropper };
})();

    function getThemePreference() {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        return ['light', 'dark', 'auto'].includes(saved) ? saved : 'auto';
      } catch (ignore) { return 'auto'; }
    }

    function applyThemePreference(preference) {
      const useDark = preference === 'dark' || (preference === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = useDark ? 'dark' : 'light';
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'legacy-theme-preference', preference }, '*');
      }
      document.querySelectorAll('[data-theme-preference]').forEach(button => {
        const active = button.dataset.themePreference === preference;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function setThemePreference(preference) {
      if (!['light', 'dark', 'auto'].includes(preference)) return;
      try { localStorage.setItem(THEME_STORAGE_KEY, preference); } catch (ignore) {}
      applyThemePreference(preference);
    }

    function initializeThemeSettings() {
      applyThemePreference(getThemePreference());
      if (themeMediaListenerReady) return;
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        if (getThemePreference() === 'auto') applyThemePreference('auto');
      };
      if (media.addEventListener) media.addEventListener('change', handleSystemThemeChange);
      else if (media.addListener) media.addListener(handleSystemThemeChange);
      themeMediaListenerReady = true;
    }

    function saveLoginSession(user) {
      const session = { userType: user.userType || '', userID: user.userID || '', userName: user.userName || '' };
      const serialized = JSON.stringify(session);
      try { localStorage.setItem(AUTH_STORAGE_KEY, serialized); } catch (ignore) {}
      try {
        sessionStorage.setItem('userType', session.userType);
        sessionStorage.setItem('userID', session.userID);
        sessionStorage.setItem('userName', session.userName);
      } catch (ignore) {}
      try { document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(serialized)}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`; } catch (ignore) {}
    }

    function getSavedLoginSession() {
      try {
        const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
        if (saved && saved.userType && saved.userID && saved.userName) return saved;
      } catch (ignore) {}
      try {
        const cookie = document.cookie.split('; ').find(item => item.startsWith(AUTH_COOKIE_KEY + '='));
        const saved = cookie ? JSON.parse(decodeURIComponent(cookie.substring(cookie.indexOf('=') + 1))) : null;
        if (saved && saved.userType && saved.userID && saved.userName) return saved;
      } catch (ignore) {}
      try {
        const userType = sessionStorage.getItem('userType');
        const userID = sessionStorage.getItem('userID');
        const userName = sessionStorage.getItem('userName');
        return userType && userID && userName ? { userType, userID, userName } : null;
      } catch (ignore) { return null; }
    }


    function initApp() {
      initializeThemeSettings();
      const savedSession = getSavedLoginSession();
      if (savedSession) { currentUser = savedSession; saveLoginSession(currentUser); showApp(); } 
      else showLogin();
      
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      const now = new Date();
      document.getElementById('dashCurrentDate').textContent = now.toLocaleDateString('id-ID', options);
      const addDateInput = document.getElementById('addSiswaTanggalMasuk');
      if (addDateInput && !addDateInput.value) addDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
      ['dashboardTodayScheduleWidget','dashboardLatestStudentsWidget','formAbsensiContainer','studentReportAdminBox'].forEach(widgetId => {
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


    function setLoginType(type) {
      loginType = type;
      document.getElementById('tabSiswa').classList.toggle('active', type === 'siswa');
      document.getElementById('tabGuru').classList.toggle('active', type === 'guru');
      document.getElementById('tabAdmin').classList.toggle('active', type === 'admin');
      
      if(type === 'siswa') document.getElementById('loginIdLabel').textContent = 'Nama Siswa';
      else if(type === 'guru') document.getElementById('loginIdLabel').textContent = 'User ID / Nama Guru';
      else document.getElementById('loginIdLabel').textContent = 'ID Admin / Username';
    }

    function handleLogin(e) {
      e.preventDefault();
      const user = document.getElementById('loginUsername').value.trim();
      const pass = document.getElementById('loginPassword').value;
      const btn = document.getElementById('loginBtn');
      btn.disabled = true; btn.textContent = 'Memeriksa...';
      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Login';
        if (!res.success) { document.getElementById('loginError').textContent = res.message; document.getElementById('loginError').style.display = 'block'; } 
        else {
          currentUser = { userType: res.userType, userID: res.userID, userName: res.userName };
          saveLoginSession(currentUser);
          showApp();
        }
      }).withFailureHandler(error => {
        btn.disabled = false; btn.textContent = 'Login';
        const message = document.getElementById('loginError');
        message.textContent = 'Login gagal diproses: ' + (error.message || String(error));
        message.style.display = 'block';
      }).verifyLogin(loginType, user, pass);
    }

    function logout() {
      try { fetch('/api/logout', { method:'POST', credentials:'same-origin' }); } catch (ignore) {}
      if (notificationTimer) { clearInterval(notificationTimer); notificationTimer = null; }
      document.getElementById('notificationPanel')?.classList.remove('open');
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (ignore) {}
      try {
        sessionStorage.removeItem('userType');
        sessionStorage.removeItem('userID');
        sessionStorage.removeItem('userName');
      } catch (ignore) {}
      try { document.cookie = `${AUTH_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax; Secure`; } catch (ignore) {}
      currentUser = { userType: '', userID: '', userName: '' };
      showLogin();
    }
    function showLogin() { document.getElementById('appView').style.display = 'none'; document.getElementById('loginView').style.display = 'flex'; }
    
    function showApp() {
      document.getElementById('loginView').style.display = 'none'; document.getElementById('appView').style.display = 'block';
      document.getElementById('userName').textContent = currentUser.userName;
      document.getElementById('myProfileDisplayName').textContent = currentUser.userName;
      document.getElementById('selfProfileNama').value = currentUser.userName;
      
      let roleLabel = 'Siswa';
      if(currentUser.userType === 'guru') roleLabel = 'Guru Pengajar';
      if(currentUser.userType === 'admin') roleLabel = 'Administrator';
      document.getElementById('userRole').textContent = roleLabel;

      if (currentUser.userType === 'guru') {
        document.getElementById('selfProfileInstrumenGroup').style.display = 'block';
      } else {
        document.getElementById('selfProfileInstrumenGroup').style.display = 'none';
      }

      buildNavigation();
      fetchDashboardData();
    }


    function buildNavigation() {
      const icons = {
        beranda: `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
        siswa: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>`,
        jadwal: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        pengganti: `<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
        pengumuman: `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
        ruang: `<svg viewBox="0 0 24 24"><path d="M3 21h18"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path><path d="M9 8h2"></path><path d="M13 8h2"></path><path d="M9 12h2"></path><path d="M13 12h2"></path></svg>`,
        progress: `<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
        tugas: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
        manajemen: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
      };

      const navMenu = document.getElementById('navMenu'); navMenu.innerHTML = '';
      let menus = [];
      
      if(currentUser.userType === 'siswa') {
        menus = [ 
          { id: 'dashboard-siswa', label: 'Beranda', icon: icons.beranda }, 
          { id: 'section-learning-progress', label: 'Progress Belajar', icon: icons.progress },
          { id: 'section-pengganti', label: 'Jadwal Pengganti', icon: icons.pengganti },
          { id: 'section-pengumuman', label: 'Pengumuman', icon: icons.pengumuman },
          { id: 'section-progress', label: 'Materi & Progress', icon: icons.progress }, 
          { id: 'section-tugas', label: 'Tugas & Latihan', icon: icons.tugas } 
        ];
      } else if(currentUser.userType === 'admin') {
        menus = [ 
          { id: 'dashboard-guru', label: 'Beranda', icon: icons.beranda }, 
          { id: 'section-learning-progress', label: 'Progress Belajar', icon: icons.progress },
          { id: 'section-siswa', label: 'Daftar Siswa', icon: icons.siswa }, 
          { id: 'section-jadwal', label: 'Jadwal Pelajaran', icon: icons.jadwal }, 
          { id: 'section-ruang', label: 'Ruang', icon: icons.ruang },
          { id: 'section-pengganti', label: 'Jadwal Pengganti', icon: icons.pengganti },
          { id: 'section-pengumuman', label: 'Pengumuman', icon: icons.pengumuman },
          { id: 'section-progress', label: 'Riwayat Progress', icon: icons.progress },
          { id: 'section-daftar-guru', label: 'Daftar Guru', icon: icons.siswa },
          { id: 'section-absensi-guru', label: 'Absensi Guru', icon: icons.jadwal },
          { id: 'fitur-guru', label: 'Manajemen Kelas', icon: icons.manajemen } 
        ];
        document.querySelectorAll('.admin-hide-item').forEach(el => el.style.display = 'none');
      } else {
        menus = [ 
          { id: 'dashboard-guru', label: 'Beranda', icon: icons.beranda }, 
          { id: 'section-learning-progress', label: 'Progress Belajar', icon: icons.progress },
          { id: 'section-siswa', label: 'Daftar Siswa', icon: icons.siswa }, 
          { id: 'section-jadwal', label: 'Jadwal Pelajaran', icon: icons.jadwal }, 
          { id: 'section-pengganti', label: 'Jadwal Pengganti', icon: icons.pengganti },
          { id: 'section-pengumuman', label: 'Pengumuman', icon: icons.pengumuman },
          { id: 'section-progress', label: 'Materi & Progress', icon: icons.progress }, 
          { id: 'section-tugas', label: 'Tugas & Latihan', icon: icons.tugas }, 
          { id: 'fitur-guru', label: 'Manajemen Kelas', icon: icons.manajemen } 
        ];
        document.querySelectorAll('.admin-hide-item').forEach(el => el.style.display = 'flex');
      }
      
      menus.forEach((item, index) => {
        const li = document.createElement('li'); const a = document.createElement('a');
        a.className = 'nav-link' + (index === 0 ? ' active' : ''); 
        a.id = 'nav-' + item.id;
        a.innerHTML = `${item.icon} <span>${item.label}</span>`;
        a.onclick = () => switchTab(item.id);
        li.appendChild(a); navMenu.appendChild(li);
      });
      document.querySelectorAll('.admin-only-quick-action').forEach(el => el.style.display = currentUser.userType === 'admin' ? 'flex' : 'none');
      const teacherManagementBox = document.getElementById('adminTeacherManagementBox');
      if (teacherManagementBox) teacherManagementBox.style.display = currentUser.userType === 'admin' ? 'block' : 'none';
      switchTab(menus[0].id);

      if(currentUser.userType === 'guru') {
        document.getElementById('formAbsensiContainer').style.display = 'block';
        document.getElementById('guruSignatureGrid').style.display = 'grid';
        document.getElementById('legacyTtdInputGroup').style.display = 'none';
        document.getElementById('absensiTanggal').valueAsDate = new Date();
        setTimeout(initSignaturePads, 200);
      } else if (currentUser.userType === 'admin') {
        document.getElementById('formAbsensiContainer').style.display = 'none';
        document.getElementById('guruSignatureGrid').style.display = 'none';
        document.getElementById('legacyTtdInputGroup').style.display = 'block';
        document.getElementById('absensiTtd').value = currentUser.userName;
        document.getElementById('absensiTanggal').valueAsDate = new Date();
      }

      if(currentUser.userType === 'guru' || currentUser.userType === 'admin') {
        document.getElementById('btnOpenCreateTask').style.display = 'inline-flex';
        document.getElementById('formCreateTugasBox').style.display = 'none';
      }
    }

    function switchTab(sectionId) {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      const activeLink = document.getElementById('nav-' + sectionId) || (sectionId === 'section-profil' ? document.getElementById('navProfilLink') : null);
      if(activeLink) activeLink.classList.add('active');

      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      const sec = document.getElementById(sectionId);
      if(sec) sec.classList.add('active');

      if (sectionId === 'section-jadwal') {
        setTimeout(() => {
          LegacyVendors.loadFullCalendar().then(() => {
            if(!calendarInstance) initCalendar();
            else calendarInstance.render();
          }).catch(error => {
            console.error('[Legacy Vendors] FullCalendar gagal dimuat', error);
            showAlert('alertDanger', 'Kalender gagal dimuat. Periksa koneksi internet lalu coba lagi.');
          });
        }, 150);
      }

      if (sectionId === 'section-learning-progress') {
        setTimeout(() => refreshLearningProgressPage(), 0);
      }

      if (sectionId === 'section-ruang' && currentUser.userType === 'admin') {
        setTimeout(renderRoomAvailability, 0);
      }

      if (sectionId === 'section-absensi-guru' && currentUser.userType === 'admin') {
        setTimeout(() => { initSignaturePads(); resizeSignaturePad('canvasTtdAbsensiGuru'); }, 80);
      }

      if (sectionId === 'section-progress' && currentUser.userType === 'guru') {
        setTimeout(() => {
          Object.keys(sigCanvases).forEach(id => {
            const canvas = sigCanvases[id].canvas;
            if (canvas) {
              const rect = canvas.parentElement.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                resizeSignaturePad(id);
              }
            }
          });
        }, 200);
      }

      closeSidebar();
    }

    function toggleJadwalView(mode) {
      document.getElementById('btnToggleCalendar').classList.toggle('active', mode === 'calendar');
      document.getElementById('btnToggleTable').classList.toggle('active', mode === 'table');
      
      if(mode === 'calendar') {
        document.getElementById('jadwalCalendarView').style.display = 'block';
        document.getElementById('jadwalTableView').style.display = 'none';
        if(calendarInstance) calendarInstance.render();
      } else {
        document.getElementById('jadwalCalendarView').style.display = 'none';
        document.getElementById('jadwalTableView').style.display = 'block';
      }
    }

    function updateAvatarUI(url) {
      const imgEl = document.getElementById('myProfilePhotoImg');
      const initialEl = document.getElementById('myProfileInitials');
      const bannerGuruImg = document.getElementById('dashGuruBannerImg');
      const bannerGuruInit = document.getElementById('dashGuruBannerInitials');
      const bannerSiswaImg = document.getElementById('dashSiswaBannerImg');
      const bannerSiswaInit = document.getElementById('dashSiswaBannerInitials');
      
      if (url && url.length > 5) {
        imgEl.src = url; imgEl.style.display = 'block'; initialEl.style.display = 'none';
        if(bannerGuruImg) { bannerGuruImg.src = url; bannerGuruImg.style.display = 'block'; bannerGuruInit.style.display = 'none'; }
        if(bannerSiswaImg) { bannerSiswaImg.src = url; bannerSiswaImg.style.display = 'block'; bannerSiswaInit.style.display = 'none'; }
      } else {
        imgEl.style.display = 'none'; initialEl.style.display = 'block';
        initialEl.textContent = (currentUser.userName || 'U').charAt(0).toUpperCase();
        if(bannerGuruImg) { bannerGuruImg.style.display = 'none'; bannerGuruInit.style.display = 'flex'; bannerGuruInit.textContent = (currentUser.userName || 'G').charAt(0).toUpperCase(); }
        if(bannerSiswaImg) { bannerSiswaImg.style.display = 'none'; bannerSiswaInit.style.display = 'flex'; bannerSiswaInit.textContent = (currentUser.userName || 'S').charAt(0).toUpperCase(); }
      }
    }

    function getSiswaAvatarHtml(nama, fotoUrl) {
      if (fotoUrl && fotoUrl.length > 5) {
        return `<img src="${fotoUrl}" class="siswa-avatar">`;
      }
      const initial = (nama || 'S').charAt(0).toUpperCase();
      return `<div class="siswa-avatar-initial">${initial}</div>`;
    }

    function triggerPhotoSelect() { document.getElementById('inputFotoProfil').click(); }

    function handleFotoSelected(event) {
      const file = event.target.files[0];
      if (!file) return;
      selectedFileName = file.name;

      LegacyVendors.loadCropper().then(() => {
        const reader = new FileReader();
        reader.onload = function(e) {
          const image = document.getElementById('imageToCrop');
          image.src = e.target.result;
          document.getElementById('modalCropper').style.display = 'flex';
          if (cropperInstance) cropperInstance.destroy();
          cropperInstance = new Cropper(image, { aspectRatio: 1, viewMode: 1 });
        };
        reader.readAsDataURL(file);
      }).catch(error => {
        console.error('[Legacy Vendors] Cropper gagal dimuat', error);
        showAlert('alertDanger', 'Editor foto gagal dimuat. Periksa koneksi internet lalu coba lagi.');
      });
    }

    function closeCropperModal() {
      document.getElementById('modalCropper').style.display = 'none';
      if (cropperInstance) cropperInstance.destroy();
    }

    function cropAndUploadPhoto() {
      if (!cropperInstance) return;
      const canvas = cropperInstance.getCroppedCanvas({ width: 300, height: 300 });
      const base64Data = canvas.toDataURL('image/jpeg');

      closeCropperModal();
      showAlert('alertSuccess', 'Mengunggah foto profil...');

      google.script.run.withSuccessHandler(res => {
        if (res.success) {
          updateAvatarUI(res.photoUrl);
          showAlert('alertSuccess', res.message);
          fetchDashboardData();
        } else {
          showAlert('alertDanger', res.message);
        }
      }).updateUserPhoto(currentUser.userID, currentUser.userType, base64Data, selectedFileName);
    }


    function fetchDashboardData() {
      const requestNumber = ++dashboardRequestNumber;
      google.script.run.withSuccessHandler(function(rawData) {
        if (requestNumber !== dashboardRequestNumber) return;
        let data = rawData;
        if (typeof rawData === 'string') {
          try { data = JSON.parse(rawData); }
          catch (error) { showAlert('alertDanger', 'Data dashboard tidak valid. Silakan refresh sekali lagi.'); return; }
        }
        if (!data || data.error || data.success === false) {
          showAlert('alertDanger', data && (data.error || data.message) ? (data.error || data.message) : 'Data dashboard kosong. Silakan coba lagi.');
          return;
        }

        const identityInfo = data.userType === 'siswa' ? data.siswaInfo : (data.userType === 'guru' ? data.guruInfo : data.adminInfo);
        if (identityInfo) {
          currentUser.userID = identityInfo.userID || currentUser.userID;
          currentUser.userName = identityInfo.nama || currentUser.userName;
          saveLoginSession(currentUser);
        }

        globalAbsensiList = data.absensiList || [];
        globalJadwalList = data.jadwal || data.schedules || [];
        globalTugasList = data.tugasList || [];
        globalJadwalPenggantiList = data.jadwalPenggantiList || [];
        globalPengumumanList = data.pengumumanList || [];
        globalLearningProgressList = data.learningProgressList || [];
        globalStudentHistory = data.studentHistory || [];
        globalTeacherAttendanceList = data.teacherAttendanceList || [];

        google.script.run.withSuccessHandler(gList => {
          globalGuruList = gList || [];
          if (data.userType === 'siswa') renderSiswa(data);
          if (data.userType === 'guru' || data.userType === 'admin') renderGuruOrAdmin(data);
          renderLearningProgressViews();

          setupFilterDropdown();
          renderTabelJadwal();
          renderTabelRiwayat();
          renderTabelTugas();
          renderTabelJadwalPengganti();
          renderPengumumanList();
          renderDashboardAcademyUpdates();
          setupMakeupFilters();
          setupRoomFilters();
          renderRoomAvailability();
          renderNotificationCenter();
          if (notificationTimer) clearInterval(notificationTimer);
          notificationTimer = setInterval(renderNotificationCenter, 60000);
        }).withFailureHandler(error => {
          if (requestNumber === dashboardRequestNumber) showAlert('alertDanger', 'Daftar guru gagal dimuat: ' + (error.message || error));
        }).getGuruList();

      }).withFailureHandler(error => {
        if (requestNumber !== dashboardRequestNumber) return;
        showAlert('alertDanger', 'Data dashboard gagal dimuat: ' + (error.message || error));
      }).getDashboardData(currentUser.userID, currentUser.userType);
    }

    function timeToMinutes(timeStr) {
      if (!timeStr) return 0;
      const parts = timeStr.split(':');
      if (parts.length < 2) return 0;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    function calculateDurationMinutes(startStr, endStr) {
      const startMin = timeToMinutes(startStr);
      const endMin = timeToMinutes(endStr);
      const diff = endMin - startMin;
      return diff > 0 ? `${diff} menit` : '60 menit';
    }

    function getInstrumenIcon(instrumen) {
      const lower = (instrumen || 'Gitar').toLowerCase();
      if (lower.includes('piano')) return '🎹';
      if (lower.includes('drum')) return '🥁';
      if (lower.includes('vokal') || lower.includes('vokal')) return '🎤';
      if (lower.includes('biola') || lower.includes('violin')) return '🎻';
      return '🎸';
    }

    function getFormattedDateString(hariStr) {
      const today = new Date();
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const hari = hariStr || "Rabu";
      return `${hari}, ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    }

    function renderSiswa(data) {
      document.getElementById('formJadwalPenggantiBox').style.display = 'none';
      document.getElementById('formPengumumanBox').style.display = 'none';
      if(data.siswaInfo) {
        document.getElementById('dashSiswaNama').textContent = data.siswaInfo.nama;
        document.getElementById('selfProfileNama').value = data.siswaInfo.nama;
        document.getElementById('selfProfileEmail').value = data.siswaInfo.email;
        document.getElementById('selfProfileHP').value = data.siswaInfo.noHp || '';
        document.getElementById('myProfileDisplayName').textContent = data.siswaInfo.nama;
        document.getElementById('siswaLevelAktif').textContent = data.siswaInfo.kelas || 'Beginner';
        document.getElementById('siswaInstrumenSub').textContent = data.siswaInfo.instrumen || 'Gitar';
        updateAvatarUI(data.siswaInfo.foto);
      }
      
      if(data.absensiProgress) {
        document.getElementById('siswaKehadiranBulan').textContent = data.absensiProgress.hadir + ' / ' + data.absensiProgress.total;
      }

      const container = document.getElementById('siswaNextScheduleContainer');
      container.innerHTML = '';

      if (data.schedules && data.schedules.length > 0) {
        data.schedules.forEach(nextJadwal => {
        const instrumenNama = nextJadwal.instrumen || (data.siswaInfo ? data.siswaInfo.instrumen : 'Gitar');
        const siswaNama = currentUser.userName;
        const iconInstrumen = getInstrumenIcon(instrumenNama);
        const durationStr = calculateDurationMinutes(nextJadwal.jamMulai, nextJadwal.jamSelesai);
        const dateStr = getFormattedDateString(nextJadwal.hari);
        
        const coachNama = nextJadwal.guru || (data.siswaInfo ? data.siswaInfo.guru : '');
        const coachObj = globalGuruList.find(g => String(g.nama).trim().toLowerCase() === String(coachNama).trim().toLowerCase());
        const coachFoto = coachObj ? coachObj.foto : '';

        let coachAvatarHtml = '';
        if (coachFoto && coachFoto.length > 5) {
          coachAvatarHtml = `<img src="${coachFoto}" class="coach-avatar-circle">`;
        } else {
          const init = coachNama ? coachNama.charAt(0).toUpperCase() : 'C';
          coachAvatarHtml = `<div class="coach-avatar-initial-circle">${init}</div>`;
        }

        const coachDisplayName = coachNama ? coachNama : 'Legacy Teacher';

        container.insertAdjacentHTML('beforeend', `
          <div class="siswa-card-schedule">
            <div class="siswa-card-top">
              <div class="siswa-card-left">
                <div class="siswa-instrumen-icon-badge">${iconInstrumen}</div>
                <div class="siswa-tag-kelas">Kelas Musik</div>
                <div class="siswa-card-title">${instrumenNama} (${siswaNama})</div>
                
                <div class="siswa-card-details">
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${dateStr}</span>
                  </div>
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 16 14"></polyline></svg>
                    <span>${nextJadwal.jamMulai} - ${nextJadwal.jamSelesai} (${durationStr})</span>
                  </div>
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>${nextJadwal.ruangan || 'Ruang Kelas'} - Legacy Music Center</span>
                  </div>
                  <div class="siswa-detail-row">
                    <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>Coach ${coachDisplayName}</span>
                  </div>
                </div>
              </div>

              <div class="siswa-card-right-coach">
                ${coachAvatarHtml}
                <div class="coach-title-label">Coach</div>
                <div class="coach-name-label">${coachDisplayName}</div>
              </div>
            </div>
          </div>`);
        });
      } else {
        container.innerHTML = `<div style="font-size:13px; color:#94a3b8; text-align:center; padding:25px 0; background:#fafafa; border-radius:12px;">Belum ada jadwal pelajaran mendatang.</div>`;
      }
    }

    function renderGuruOrAdmin(data) {
      const isAdmin = currentUser.userType === 'admin';
      
      if(isAdmin) {
        document.getElementById('dashGuruNama').textContent = data.adminInfo.nama;
        document.getElementById('dashGuruEmail').textContent = data.adminInfo.email;
        document.getElementById('userName').textContent = data.adminInfo.nama;
        document.getElementById('myProfileDisplayName').textContent = data.adminInfo.nama;
        document.getElementById('selfProfileNama').value = data.adminInfo.nama;
        document.getElementById('selfProfileEmail').value = data.adminInfo.email;
        document.getElementById('selfProfileHP').value = data.adminInfo.noHp || '';

        document.getElementById('dashGuruSpesialisMeta').style.display = 'none';
        document.getElementById('adminFilterGuruBox').style.display = 'block';
        document.getElementById('groupPilihGuruPengajar').style.display = 'block';
        document.getElementById('editSiswaGuruGroup').style.display = 'block';
        document.getElementById('addStudentExtraClassesBox').style.display = 'block';
        document.getElementById('editStudentExtraClassesBox').style.display = 'block';

        document.getElementById('guruNextClassWidgetBox').style.display = 'none';
        document.getElementById('adminOngoingClassWidgetBox').style.display = 'block';

        document.getElementById('formJadwalPenggantiBox').style.display = 'block';
        document.getElementById('formPengumumanBox').style.display = 'block';
        document.getElementById('dashboardAcademyUpdatesGuru').style.display = 'none';

        document.getElementById('statTotalSiswaAll').textContent = data.stats.totalSiswa;
        document.getElementById('statSiswaAktif').textContent = data.stats.siswaAktif;
        document.getElementById('statSiswaCuti').textContent = data.stats.siswaCuti;
        document.getElementById('statFourthTitle').textContent = 'Siswa Keluar';
        document.getElementById('statFourthVal').textContent = data.stats.siswaKeluar;

        document.getElementById('siswaFilterBox').style.display = 'block';
        document.getElementById('filterSiswaInstrumenGroup').style.display = 'block';
        document.getElementById('filterSiswaGuruGroup').style.display = 'block';
        document.getElementById('studentReportAdminBox').style.display = 'block';
        document.getElementById('jadwalFilterBox').style.display = 'block';
        document.querySelectorAll('.filter-admin-only').forEach(el => el.style.display = 'block');

        updateAvatarUI(data.adminInfo.foto);
      } else {
        document.getElementById('dashGuruNama').textContent = data.guruInfo.nama;
        document.getElementById('dashGuruEmail').textContent = data.guruInfo.email;
        document.getElementById('userName').textContent = data.guruInfo.nama;
        document.getElementById('myProfileDisplayName').textContent = data.guruInfo.nama;
        document.getElementById('selfProfileNama').value = data.guruInfo.nama;
        document.getElementById('selfProfileEmail').value = data.guruInfo.email;
        document.getElementById('selfProfileHP').value = data.guruInfo.noHp || '';
        document.getElementById('selfProfileInstrumen').value = data.guruInfo.instrumen || 'Gitar';

        document.getElementById('dashGuruInstrumen').textContent = data.guruInfo.instrumen || 'Gitar';
        document.getElementById('dashGuruSpesialisMeta').style.display = 'inline-block';
        document.getElementById('adminFilterGuruBox').style.display = 'none';
        document.getElementById('groupPilihGuruPengajar').style.display = 'none';
        document.getElementById('editSiswaGuruGroup').style.display = 'none';
        document.getElementById('addStudentExtraClassesBox').style.display = 'none';
        document.getElementById('editStudentExtraClassesBox').style.display = 'none';

        document.getElementById('formJadwalPenggantiBox').style.display = 'none';
        document.getElementById('formPengumumanBox').style.display = 'none';
        document.getElementById('dashboardAcademyUpdatesGuru').style.display = 'block';

        document.getElementById('guruNextClassWidgetBox').style.display = 'block';
        document.getElementById('adminOngoingClassWidgetBox').style.display = 'none';

        document.getElementById('statTotalSiswaAll').textContent = data.stats.totalSiswa;
        document.getElementById('statSiswaAktif').textContent = (data.siswaList || []).filter(s => String(s.status).toLowerCase() === 'aktif').length;
        document.getElementById('statSiswaCuti').textContent = (data.siswaList || []).filter(s => String(s.status).toLowerCase() === 'cuti').length;
        document.getElementById('statFourthTitle').textContent = 'Kelas Hari Ini';
        document.getElementById('statFourthVal').textContent = data.stats.sesiJadwalAktif;

        document.getElementById('siswaFilterBox').style.display = 'block';
        document.getElementById('filterSiswaInstrumenGroup').style.display = 'none';
        document.getElementById('filterSiswaGuruGroup').style.display = 'none';
        document.getElementById('studentReportAdminBox').style.display = 'none';
        document.getElementById('jadwalFilterBox').style.display = 'block';
        document.querySelectorAll('.filter-admin-only').forEach(el => el.style.display = 'none');

        updateAvatarUI(data.guruInfo.foto);
      }

      globalSiswaList = data.siswaList || [];

      const gList = globalGuruList;
      const gSelects = document.querySelectorAll('#editJadwalGuru, #addSiswaGuruSelect, #editSiswaGuruSelect, #penggantiGuruSelect');
      let options = '<option value="">Pilih Guru...</option>';
      gList.forEach(g => options += `<option value="${g.nama}" data-guru-id="${g.id || ''}">${g.nama} (${g.instrumen || 'Gitar'})</option>`);
      gSelects.forEach(sel => sel.innerHTML = options);

      let optFilterGuru = '<option value="">-- Semua Guru --</option>';
      gList.forEach(g => optFilterGuru += `<option value="${g.nama}">${g.nama} (${g.instrumen})</option>`);
      
      if (isAdmin) {
        const adminFilterSel = document.getElementById('adminSelectGuruFilter');
        if(adminFilterSel) adminFilterSel.innerHTML = '<option value="">-- Tampilkan Semua Guru & Siswa --</option>' + gList.map(g => `<option value="${g.nama}">${g.nama} (${g.instrumen})</option>`).join('');
        
        const filterSiswaGuru = document.getElementById('filterSiswaGuru');
        if(filterSiswaGuru) filterSiswaGuru.innerHTML = optFilterGuru;

        const filterJadwalGuru = document.getElementById('filterJadwalGuru');
        if(filterJadwalGuru) filterJadwalGuru.innerHTML = optFilterGuru;
      }

      renderDashboardViews();
      applySiswaFilters();
      if (isAdmin) {
        initializeStudentReports();
        renderAdminTeacherManagement();
      }
    }

    const learningProgressCategories = [
      { key:'materi', label:'Materi', icon:'📖' },
      { key:'teknik', label:'Teknik', icon:'⚙️' },
      { key:'teori', label:'Teori Musik', icon:'♫' },
      { key:'repertoire', label:'Repertoire / Lagu', icon:'▤' },
      { key:'practice', label:'Practice / Latihan', icon:'◷' },
      { key:'performance', label:'Performance', icon:'★' },
      { key:'evaluasi', label:'Evaluasi', icon:'▥' }
    ];


    function formatLearningProgressPeriod(period) {
      const range = String(period || '').match(/^(\d{4})-(\d{2})~(\d{4})-(\d{2})$/);
      const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      if (range) {
        const start = `${names[Number(range[2]) - 1]} ${range[1]}`;
        const end = `${names[Number(range[4]) - 1]} ${range[3]}`;
        return `${start} – ${end}`;
      }
      const quarter = String(period || '').match(/^(\d{4})-Q([1-4])$/i);
      if (quarter) {
        const ranges = { 1:'Januari–Maret', 2:'April–Juni', 3:'Juli–September', 4:'Oktober–Desember' };
        return `Triwulan ${quarter[2]} (${ranges[quarter[2]]}) ${quarter[1]}`;
      }
      const match = String(period || '').match(/^(\d{4})-(\d{2})$/);
      if (!match) return period || '-';
      return `${names[Number(match[2]) - 1]} ${match[1]}`;
    }

    function getLearningProgressPeriodType(record) {
      if (!record) return 'Bulanan';
      return record.tipePeriode === 'Tiga Bulan' || /-Q|~/.test(String(record.periode || '').toUpperCase()) ? 'Tiga Bulan' : 'Bulanan';
    }

    function getCurrentLearningProgress(studentName, period, periodType) {
      const records = globalLearningProgressList.filter(item => String(item.namaSiswa || '').trim().toLowerCase() === String(studentName || '').trim().toLowerCase());
      if (period) return records.find(item => String(item.periode || '') === String(period) && (!periodType || getLearningProgressPeriodType(item) === periodType)) || null;
      return records[0] || null;
    }

    function getLearningComponentStatusText(progress, key) {
      const status = progress[key + 'Status'] || 'Belum Dimulai';
      const value = Math.max(0, Math.min(100, Number(progress[key + 'Progress']) || 0));
      if (status === 'Selesai') return `Selesai • Nilai ${value}/100`;
      if (status === 'Dalam Proses') return `${value}% tercapai • ${100 - value}% lagi`;
      return 'Belum dimulai • 0%';
    }

    function renderLearningProgressRecord(progress) {
      if (!progress) return '<div class="lp-body"><div class="lp-empty"><strong>Progress Belajar belum tersedia</strong><span>Pilih periode lain atau minta coach membuat laporan baru.</span></div></div>';
      const overall = Math.max(0, Math.min(100, Number(progress.overallProgress) || 0));
      const completed = learningProgressCategories.filter(category => progress[category.key + 'Status'] === 'Selesai').length;
      return `<div class="lp-minimal-card" role="button" tabindex="0" onclick="openLearningProgressDetailModal()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openLearningProgressDetailModal();}"><div class="lp-minimal-score" style="--score:${overall * 3.6}deg"><span>${overall}%</span></div><div class="lp-minimal-info"><strong>${escapeTaskHtml(progress.namaSiswa || 'Progress Belajar')} • ${escapeTaskHtml(progress.level || '-')}</strong><p>${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))} · ${completed} dari ${learningProgressCategories.length} komponen selesai<br>Target: ${escapeTaskHtml(progress.targetBerikutnya || 'Belum ditentukan.')}</p></div><button type="button" class="lp-minimal-button">Buka Detail →</button></div>`;
    }

    function renderLearningProgressViews() {
      const studentContainer = document.getElementById('learningProgressDashboardSiswa');
      if (studentContainer) {
        if (currentUser.userType === 'siswa') {
          const latest = getCurrentLearningProgress(currentUser.userName);
          if (latest) {
            const score = Math.max(0, Math.min(100, Number(latest.overallProgress) || 0));
            studentContainer.innerHTML = `<div class="lp-student-compact"><div class="lp-compact-score">${score}%</div><div class="lp-compact-main"><strong>Progress Belajar • ${escapeTaskHtml(latest.level || '-')}</strong><span>${escapeTaskHtml(formatLearningProgressPeriod(latest.periode))} • Target: ${escapeTaskHtml(latest.targetBerikutnya || 'Belum ditentukan')}</span></div><button type="button" class="lp-edit-btn" onclick="switchTab('section-learning-progress')">Lihat Detail →</button></div>`;
          } else {
            studentContainer.innerHTML = '<div class="lp-student-compact"><div class="lp-compact-score">0%</div><div class="lp-compact-main"><strong>Progress Belajar</strong><span>Coach belum membuat laporan progress.</span></div><button type="button" class="lp-edit-btn" onclick="switchTab(\'section-learning-progress\')">Lihat Detail →</button></div>';
          }
        } else studentContainer.innerHTML = '';
      }
      refreshLearningProgressPage();
    }

    function getDefaultLearningPeriod(type) {
      const now = new Date();
      if (type === 'Tiga Bulan') return getLearningThreeMonthPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function refreshLearningProgressPage(resetPeriod) {
      const studentSelect = document.getElementById('lpPageStudent');
      const typeSelect = document.getElementById('lpPagePeriodType');
      const periodSelect = document.getElementById('lpPagePeriod');
      const content = document.getElementById('learningProgressPageContent');
      if (!studentSelect || !typeSelect || !periodSelect || !content) return;
      const isStudent = currentUser.userType === 'siswa';
      const names = isStudent ? [currentUser.userName] : [...new Set((globalSiswaList || []).map(item => String(item.nama || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      const oldStudent = studentSelect.value || globalSelectedLearningProgressStudent;
      studentSelect.innerHTML = names.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
      studentSelect.value = names.includes(oldStudent) ? oldStudent : (names.find(name => getCurrentLearningProgress(name)) || names[0] || '');
      document.getElementById('lpPageStudentGroup').style.display = isStudent ? 'none' : 'block';
      globalSelectedLearningProgressStudent = studentSelect.value || currentUser.userName;
      const type = typeSelect.value || 'Bulanan';
      const oldPeriod = resetPeriod ? '' : periodSelect.value;
      const periods = [...new Set(globalLearningProgressList.filter(item => String(item.namaSiswa || '').toLowerCase() === String(globalSelectedLearningProgressStudent || '').toLowerCase() && getLearningProgressPeriodType(item) === type).map(item => item.periode).filter(Boolean))].sort().reverse();
      if (!periods.length) periods.push(getDefaultLearningPeriod(type));
      periodSelect.innerHTML = periods.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(formatLearningProgressPeriod(value))}</option>`).join('');
      periodSelect.value = periods.includes(oldPeriod) ? oldPeriod : periods[0];
      const progress = getCurrentLearningProgress(globalSelectedLearningProgressStudent, periodSelect.value, type);
      content.innerHTML = renderLearningProgressRecord(progress);
      document.getElementById('lpPageEditButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      document.getElementById('lpPageDeleteButton').style.display = currentUser.userType === 'guru' && progress ? 'inline-flex' : 'none';
      document.getElementById('lpPagePrintButton').style.display = progress && currentUser.userType !== 'siswa' ? 'inline-flex' : 'none';
    }

    function getLearningProgressCurrentMonth() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    function getLearningThreeMonthPeriod(startMonth) {
      const match = String(startMonth || '').match(/^(\d{4})-(\d{2})$/);
      if (!match) return '';
      const start = new Date(Number(match[1]), Number(match[2]) - 1, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 2, 1);
      return `${match[1]}-${match[2]}~${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
    }

    function getLearningPeriodStart(period) {
      const range = String(period || '').match(/^(\d{4}-\d{2})~/);
      if (range) return range[1];
      const quarter = String(period || '').match(/^(\d{4})-Q([1-4])$/i);
      if (quarter) return `${quarter[1]}-${String((Number(quarter[2]) - 1) * 3 + 1).padStart(2, '0')}`;
      return getLearningProgressCurrentMonth();
    }

    function updateLearningThreeMonthHint() {
      const hint = document.getElementById('lpPeriodThreeHint');
      const period = getLearningThreeMonthPeriod(document.getElementById('lpPeriodThreeStart').value);
      if (hint) hint.textContent = period ? `Laporan: ${formatLearningProgressPeriod(period)}` : 'Pilih bulan awal laporan.';
    }

    function getLearningProgressFormPeriod() {
      return document.getElementById('lpPeriodType').value === 'Tiga Bulan' ? getLearningThreeMonthPeriod(document.getElementById('lpPeriodThreeStart').value) : document.getElementById('lpPeriodMonth').value;
    }

    function toggleLearningProgressPeriodInput() {
      const quarterly = document.getElementById('lpPeriodType').value === 'Tiga Bulan';
      document.getElementById('lpPeriodMonth').style.display = quarterly ? 'none' : 'block';
      document.getElementById('lpPeriodMonth').required = !quarterly;
      document.getElementById('lpPeriodThreeStart').style.display = quarterly ? 'block' : 'none';
      document.getElementById('lpPeriodThreeStart').required = quarterly;
      document.getElementById('lpPeriodThreeHint').style.display = quarterly ? 'block' : 'none';
      updateLearningThreeMonthHint();
    }

    function setLearningProgressFormRecord(record, studentName) {
      document.getElementById('lpProgressID').value = record ? record.progressID || '' : '';
      const student = (globalSiswaList || []).find(item => String(item.nama || '').trim().toLowerCase() === String(studentName || '').trim().toLowerCase());
      const allowedLevels = ['Beginner','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Advance'];
      const level = record ? record.level : '';
      document.getElementById('lpLevel').value = allowedLevels.includes(level) ? level : 'Beginner';
      learningProgressCategories.forEach(category => {
        const prefix = `lp${category.key.charAt(0).toUpperCase() + category.key.slice(1)}`;
        const status = document.getElementById(prefix + 'Status');
        const progress = document.getElementById(prefix + 'Progress');
        const note = document.getElementById(prefix + 'Catatan');
        if (status) status.value = record ? record[category.key + 'Status'] || 'Belum Dimulai' : 'Belum Dimulai';
        if (progress) progress.value = record ? Number(record[category.key + 'Progress']) || 0 : 0;
        if (note) note.value = record ? record[category.key + 'Catatan'] || '' : '';
      });
      document.getElementById('lpKelebihan').value = record ? record.kelebihan || '' : '';
      document.getElementById('lpPerluDitingkatkan').value = record ? record.perluDitingkatkan || '' : '';
      document.getElementById('lpTargetBerikutnya').value = record ? record.targetBerikutnya || '' : '';
      document.getElementById('lpKepalaSekolahNama').value = record ? record.kepalaSekolahNama || '' : '';
      document.getElementById('lpGuruSignatureUrl').value = record ? record.guruSignatureUrl || '' : '';
      document.getElementById('lpGuruSignatureName').value = record ? record.guruSignatureName || '' : '';
      document.getElementById('lpKepalaSignatureUrl').value = record ? record.kepalaSekolahSignatureUrl || '' : '';
      document.getElementById('lpKepalaSignatureName').value = record ? record.kepalaSekolahSignatureName || '' : '';
      document.getElementById('lpGuruSignatureFile').value = '';
      document.getElementById('lpKepalaSignatureFile').value = '';
      renderLearningSignaturePreview('lpGuruSignaturePreview', record ? record.guruSignatureUrl : '', record ? record.guruSignatureName : '');
      renderLearningSignaturePreview('lpKepalaSignaturePreview', record ? record.kepalaSekolahSignatureUrl : '', record ? record.kepalaSekolahSignatureName : '');
      updateLearningProgressPreview();
    }

    function openLearningProgressModal() {
      if (currentUser.userType !== 'guru') return;
      const select = document.getElementById('lpStudent');
      const students = (globalSiswaList || []).filter(item => String(item.status || '').toLowerCase() !== 'keluar');
      select.innerHTML = students.map(item => `<option value="${escapeTaskHtml(item.nama)}">${escapeTaskHtml(item.nama)} (${escapeTaskHtml(item.instrumen || 'Kelas Musik')})</option>`).join('');
      const selected = globalSelectedLearningProgressStudent && students.some(item => item.nama === globalSelectedLearningProgressStudent) ? globalSelectedLearningProgressStudent : (students[0] ? students[0].nama : '');
      if (!selected) { showAlert('alertDanger', 'Belum ada siswa yang dapat diisi progressnya.'); return; }
      select.value = selected;
      const pageType = document.getElementById('lpPagePeriodType')?.value || 'Bulanan';
      const pagePeriod = document.getElementById('lpPagePeriod')?.value || getDefaultLearningPeriod(pageType);
      document.getElementById('lpPeriodType').value = pageType;
      document.getElementById('lpPeriodMonth').value = pageType === 'Bulanan' ? pagePeriod : getLearningProgressCurrentMonth();
      document.getElementById('lpPeriodThreeStart').value = pageType === 'Tiga Bulan' ? getLearningPeriodStart(pagePeriod) : getLearningProgressCurrentMonth();
      toggleLearningProgressPeriodInput();
      const exact = getCurrentLearningProgress(selected, pagePeriod, pageType);
      setLearningProgressFormRecord(exact, selected);
      if (!exact) reuseLatestLearningSignatures(selected);
      document.getElementById('modalLearningProgress').style.display = 'flex';
    }

    function loadLearningProgressFormForStudent(studentName) {
      const type = document.getElementById('lpPeriodType').value;
      const period = getLearningProgressFormPeriod() || getDefaultLearningPeriod(type);
      const record = getCurrentLearningProgress(studentName, period, type);
      setLearningProgressFormRecord(record, studentName);
      if (!record) reuseLatestLearningSignatures(studentName);
    }

    function reuseLatestLearningSignatures(studentName) {
      const latest = getCurrentLearningProgress(studentName);
      if (!latest) return;
      document.getElementById('lpKepalaSekolahNama').value = latest.kepalaSekolahNama || '';
      document.getElementById('lpGuruSignatureUrl').value = latest.guruSignatureUrl || '';
      document.getElementById('lpGuruSignatureName').value = latest.guruSignatureName || '';
      document.getElementById('lpKepalaSignatureUrl').value = latest.kepalaSekolahSignatureUrl || '';
      document.getElementById('lpKepalaSignatureName').value = latest.kepalaSekolahSignatureName || '';
      renderLearningSignaturePreview('lpGuruSignaturePreview', latest.guruSignatureUrl, latest.guruSignatureName);
      renderLearningSignaturePreview('lpKepalaSignaturePreview', latest.kepalaSekolahSignatureUrl, latest.kepalaSekolahSignatureName);
    }

    function handleLearningStatusChange(keyName) {
      const status = document.getElementById(`lp${keyName}Status`);
      const score = document.getElementById(`lp${keyName}Progress`);
      if (!status || !score) return;
      if (status.value === 'Belum Dimulai') { score.value = 0; score.disabled = true; }
      else if (status.value === 'Dalam Proses') { score.disabled = false; if (Number(score.value) <= 0 || Number(score.value) >= 100) score.value = 50; }
      else { score.disabled = false; if (Number(score.value) <= 0) score.value = 100; }
      updateLearningProgressPreview();
    }

    function updateLearningProgressPreview() {
      const total = learningProgressCategories.reduce((sum, category) => {
        const keyName = category.key.charAt(0).toUpperCase() + category.key.slice(1);
        const status = document.getElementById(`lp${keyName}Status`)?.value || 'Belum Dimulai';
        const scoreInput = document.getElementById(`lp${keyName}Progress`);
        let score = Math.max(0, Math.min(100, Number(scoreInput?.value) || 0));
        if (status === 'Belum Dimulai') score = 0;
        if (status === 'Dalam Proses') score = Math.max(1, Math.min(99, score));
        if (scoreInput) { scoreInput.value = score; scoreInput.disabled = status === 'Belum Dimulai'; }
        const hint = document.getElementById(`lp${keyName}Hint`);
        if (hint) hint.textContent = status === 'Selesai' ? `Selesai • Nilai ${score}/100` : (status === 'Dalam Proses' ? `${score}% tercapai • ${100 - score}% lagi` : 'Belum dimulai • 0%');
        return sum + score;
      }, 0);
      const value = Math.round(total / learningProgressCategories.length);
      const preview = document.getElementById('lpOverallPreview');
      if (preview) preview.textContent = `Nilai keseluruhan: ${value}/100 (rata-rata komponen)`;
    }

    function renderLearningSignaturePreview(targetId, url, name) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.innerHTML = url ? `<img src="${escapeTaskHtml(url)}" alt="${escapeTaskHtml(name || 'Tanda tangan')}">` : 'Belum ada gambar';
    }

    function previewLearningSignature(input, targetId) {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) { input.value = ''; showAlert('alertDanger', 'Tanda tangan harus berupa file gambar.'); return; }
      if (file.size > 5 * 1024 * 1024) { input.value = ''; showAlert('alertDanger', 'Ukuran gambar tanda tangan maksimal 5 MB.'); return; }
      const reader = new FileReader();
      reader.onload = event => renderLearningSignaturePreview(targetId, event.target.result, file.name);
      reader.readAsDataURL(file);
    }

    function handleSaveLearningProgress(event) {
      event.preventDefault();
      const button = document.getElementById('btnSaveLearningProgress');
      button.disabled = true;
      button.textContent = 'Menyimpan...';
      const guruFile = document.getElementById('lpGuruSignatureFile').files[0];
      const kepalaFile = document.getElementById('lpKepalaSignatureFile').files[0];
      const payload = {
        progressID: document.getElementById('lpProgressID').value,
        namaSiswa: document.getElementById('lpStudent').value,
        level: document.getElementById('lpLevel').value,
        tipePeriode: document.getElementById('lpPeriodType').value,
        periode: getLearningProgressFormPeriod(),
        kelebihan: document.getElementById('lpKelebihan').value,
        perluDitingkatkan: document.getElementById('lpPerluDitingkatkan').value,
        targetBerikutnya: document.getElementById('lpTargetBerikutnya').value,
        kepalaSekolahNama: document.getElementById('lpKepalaSekolahNama').value,
        guruSignatureUrl: document.getElementById('lpGuruSignatureUrl').value,
        guruSignatureName: document.getElementById('lpGuruSignatureName').value,
        kepalaSekolahSignatureUrl: document.getElementById('lpKepalaSignatureUrl').value,
        kepalaSekolahSignatureName: document.getElementById('lpKepalaSignatureName').value
      };
      learningProgressCategories.forEach(category => {
        const prefix = `lp${category.key.charAt(0).toUpperCase() + category.key.slice(1)}`;
        payload[category.key + 'Status'] = document.getElementById(prefix + 'Status').value;
        payload[category.key + 'Progress'] = Number(document.getElementById(prefix + 'Progress').value) || 0;
        payload[category.key + 'Catatan'] = document.getElementById(prefix + 'Catatan').value;
      });

      Promise.all([filesToPayload(guruFile ? [guruFile] : []), filesToPayload(kepalaFile ? [kepalaFile] : [])]).then(result => {
        payload.guruSignatureFile = result[0][0] || null;
        payload.kepalaSekolahSignatureFile = result[1][0] || null;
        google.script.run.withSuccessHandler(response => {
          button.disabled = false;
          button.textContent = 'Simpan Progress';
          showAlert(response.success ? 'alertSuccess' : 'alertDanger', response.message);
          if (response.success) { globalSelectedLearningProgressStudent = payload.namaSiswa; closeLearningProgressModal(); fetchDashboardData(); }
        }).withFailureHandler(error => {
          button.disabled = false;
          button.textContent = 'Simpan Progress';
          showAlert('alertDanger', 'Gagal menyimpan progress: ' + error.message);
        }).saveLearningProgress(payload, currentUser.userName, currentUser.userType);
      }).catch(error => {
        button.disabled = false;
        button.textContent = 'Simpan Progress';
        showAlert('alertDanger', 'Gagal membaca gambar tanda tangan: ' + error.message);
      });
      return false;
    }

    function closeLearningProgressModal() { document.getElementById('modalLearningProgress').style.display = 'none'; }
    function handleLearningProgressBackdrop(event) { if (event.target && event.target.id === 'modalLearningProgress') closeLearningProgressModal(); }

    function openLearningProgressDetailModal() {
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress) return;
      const overall = Math.max(0, Math.min(100, Number(progress.overallProgress) || 0));
      const rows = learningProgressCategories.map(category => {
        const percent = Math.max(0, Math.min(100, Number(progress[category.key + 'Progress']) || 0));
        return `<div class="lp-form-component"><div class="lp-form-component-title"><span>${category.icon} ${category.label}</span><span>${percent}/100</span></div><div class="task-status ${percent === 100 ? 'done' : (percent > 0 ? 'open' : '')}" style="display:inline-block;margin-bottom:8px;">${escapeTaskHtml(getLearningComponentStatusText(progress, category.key))}</div><div class="lp-component-bar"><span style="width:${percent}%"></span></div><div style="font-size:11px;line-height:1.55;color:#64748b;margin-top:9px;white-space:pre-line;">${escapeTaskHtml(progress[category.key + 'Catatan'] || 'Belum ada catatan khusus.')}</div></div>`;
      }).join('');
      document.getElementById('lpDetailTitle').textContent = `Progress Belajar • ${progress.namaSiswa}`;
      const signatures = `<div class="lp-detail-notes"><div class="lp-note"><span>Guru / Coach</span>${progress.guruSignatureUrl ? `<img src="${escapeTaskHtml(progress.guruSignatureUrl)}" style="max-width:150px;max-height:65px;object-fit:contain;display:block;margin:4px 0;">` : ''}<p>${escapeTaskHtml(progress.guru || '-')}</p></div><div class="lp-note"><span>Kepala Sekolah</span>${progress.kepalaSekolahSignatureUrl ? `<img src="${escapeTaskHtml(progress.kepalaSekolahSignatureUrl)}" style="max-width:150px;max-height:65px;object-fit:contain;display:block;margin:4px 0;">` : ''}<p>${escapeTaskHtml(progress.kepalaSekolahNama || '-')}</p></div></div>`;
      document.getElementById('lpDetailBody').innerHTML = `<div class="lp-summary" style="margin-bottom:18px;"><div class="lp-ring" style="--lp-progress:${overall * 3.6}deg"><div class="lp-ring-value">${overall}</div></div><div class="lp-summary-info"><h3>${escapeTaskHtml(progress.level || '-')}</h3><div class="lp-main-bar"><span style="width:${overall}%"></span></div><div class="lp-period">${escapeTaskHtml(progress.kelas || '-')} • ${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))}<br>Diperbarui ${escapeTaskHtml(progress.lastUpdated || '-')} oleh ${escapeTaskHtml(progress.guru || '-')}</div></div><div class="lp-target"><div class="lp-target-icon">◎</div><div><strong>Target Berikutnya</strong><p>${escapeTaskHtml(progress.targetBerikutnya || 'Belum ditentukan.')}</p></div></div></div><div class="lp-form-components">${rows}</div><div class="lp-detail-notes">${progress.kelebihan ? `<div class="lp-note"><span>Kelebihan</span><p>${escapeTaskHtml(progress.kelebihan)}</p></div>` : ''}${progress.perluDitingkatkan ? `<div class="lp-note"><span>Perlu ditingkatkan</span><p>${escapeTaskHtml(progress.perluDitingkatkan)}</p></div>` : ''}</div>${signatures}`;
      document.getElementById('lpDetailEditButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      document.getElementById('lpDetailDeleteButton').style.display = currentUser.userType === 'guru' ? 'inline-flex' : 'none';
      document.getElementById('modalLearningProgressDetail').style.display = 'flex';
    }

    function closeLearningProgressDetailModal() { document.getElementById('modalLearningProgressDetail').style.display = 'none'; }
    function handleLearningProgressDetailBackdrop(event) { if (event.target && event.target.id === 'modalLearningProgressDetail') closeLearningProgressDetailModal(); }

    function getSelectedLearningProgressPageRecord() {
      const student = document.getElementById('lpPageStudent')?.value || globalSelectedLearningProgressStudent || currentUser.userName;
      const type = document.getElementById('lpPagePeriodType')?.value || 'Bulanan';
      const period = document.getElementById('lpPagePeriod')?.value || '';
      return getCurrentLearningProgress(student, period, type);
    }

    function deleteSelectedLearningProgress() {
      if (currentUser.userType !== 'guru') return;
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress || !progress.progressID) { showAlert('alertDanger', 'Data progress tidak ditemukan.'); return; }
      if (!confirm(`Hapus Progress Belajar ${progress.namaSiswa} untuk ${formatLearningProgressPeriod(progress.periode)}?`)) return;
      google.script.run.withSuccessHandler(response => {
        showAlert(response.success ? 'alertSuccess' : 'alertDanger', response.message);
        if (response.success) { closeLearningProgressDetailModal(); fetchDashboardData(); }
      }).withFailureHandler(error => showAlert('alertDanger', 'Gagal menghapus progress: ' + error.message))
        .deleteLearningProgress(progress.progressID, currentUser.userName, currentUser.userType);
    }

    function printLearningProgressReport() {
      if (currentUser.userType === 'siswa') { showAlert('alertDanger', 'Cetak laporan hanya tersedia untuk guru dan admin.'); return; }
      const progress = getSelectedLearningProgressPageRecord();
      if (!progress) { showAlert('alertDanger', 'Tidak ada laporan pada periode yang dipilih.'); return; }
      const printWindow = window.open('', '_blank', 'width=900,height=700');
      if (!printWindow) { showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk mencetak laporan.'); return; }
      printWindow.document.write('<!doctype html><html><body style="font-family:Arial;padding:32px;color:#64748b">Menyiapkan laporan...</body></html>');
      google.script.run.withSuccessHandler(response => {
        buildLearningProgressPrintWindow(progress, printWindow, response && response.success ? response.dataUrl : '');
      }).withFailureHandler(() => buildLearningProgressPrintWindow(progress, printWindow, '')).getLearningProgressPrintLogo();
    }

    function buildLearningProgressPrintWindow(progress, printWindow, logoDataUrl) {
      const rows = learningProgressCategories.map(category => {
        const score = Math.max(0, Math.min(100, Number(progress[category.key + 'Progress']) || 0));
        return `<tr><td><b>${category.label}</b></td><td>${escapeTaskHtml(progress[category.key + 'Status'] || 'Belum Dimulai')}</td><td class="score">${score}/100</td><td>${escapeTaskHtml(progress[category.key + 'Catatan'] || '-')}</td></tr>`;
      }).join('');
      const signature = (url, name, role) => `<div class="signature"><div>${role}</div><div class="signature-image">${url ? `<img src="${escapeTaskHtml(url)}">` : ''}</div><b>${escapeTaskHtml(name || '-')}</b></div>`;
      const report = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Progress ${escapeTaskHtml(progress.namaSiswa)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17232d;margin:0;font-size:10.5px}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f15a24;padding-bottom:10px;margin-bottom:13px;min-height:78px}.brand-logo{width:128px;height:78px;object-fit:contain;object-position:left center}.brand h1{font-size:20px;margin:0 0 5px}.brand strong{color:#f15a24}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}.meta div,.summary{background:#fff7f2;border:1px solid #fed9c6;border-radius:8px;padding:8px}.meta span{display:block;color:#7b8aa0;font-size:8px;text-transform:uppercase;margin-bottom:3px}.summary{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.summary b{font-size:23px;color:#f15a24}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#f15a24;color:#fff;padding:7px;text-align:left}th:nth-child(1){width:20%}th:nth-child(2){width:18%}th:nth-child(3){width:14%}td{border:1px solid #dfe6ee;padding:7px;vertical-align:top;line-height:1.35;word-wrap:break-word}.score{text-align:center;font-weight:bold;white-space:nowrap}.notes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.note{border:1px solid #dfe6ee;border-radius:8px;padding:8px;min-height:52px}.note b{display:block;color:#f15a24;margin-bottom:4px}.signatures{display:flex;justify-content:space-around;gap:28px;margin-top:20px;text-align:center;page-break-inside:avoid}.signature{width:220px}.signature-image{height:64px;display:flex;align-items:center;justify-content:center}.signature img{max-width:160px;max-height:60px;object-fit:contain}.footer{margin-top:14px;padding-top:7px;border-top:1px solid #e8edf2;color:#94a3b8;font-size:8px;text-align:right}@media print{button{display:none}}</style></head><body><div class="brand"><div>${logoDataUrl ? `<img class="brand-logo" src="${logoDataUrl}" alt="Legacy Music Center">` : '<strong>LEGACY MUSIC CENTER</strong>'}</div><div style="text-align:right"><h1>Laporan Progress Belajar</h1><strong>${escapeTaskHtml(getLearningProgressPeriodType(progress))}</strong></div></div><div class="meta"><div><span>Nama Siswa</span><b>${escapeTaskHtml(progress.namaSiswa)}</b></div><div><span>Kelas</span><b>${escapeTaskHtml(progress.kelas || '-')}</b></div><div><span>Level</span><b>${escapeTaskHtml(progress.level || '-')}</b></div><div><span>Periode</span><b>${escapeTaskHtml(formatLearningProgressPeriod(progress.periode))}</b></div></div><div class="summary"><div><b style="font-size:12px">Nilai Keseluruhan</b><br>Rata-rata dari tujuh komponen</div><b>${Number(progress.overallProgress) || 0}/100</b></div><table><thead><tr><th>Komponen</th><th>Status</th><th>Nilai/Proses</th><th>Catatan</th></tr></thead><tbody>${rows}</tbody></table><div class="notes"><div class="note"><b>Kelebihan</b>${escapeTaskHtml(progress.kelebihan || '-')}</div><div class="note"><b>Perlu Ditingkatkan</b>${escapeTaskHtml(progress.perluDitingkatkan || '-')}</div><div class="note"><b>Target Berikutnya</b>${escapeTaskHtml(progress.targetBerikutnya || '-')}</div><div class="note"><b>Terakhir Diperbarui</b>${escapeTaskHtml(progress.lastUpdated || '-')}</div></div><div class="signatures">${signature(progress.guruSignatureUrl, progress.guru, 'Guru / Coach')}${signature(progress.kepalaSekolahSignatureUrl, progress.kepalaSekolahNama, 'Kepala Sekolah')}</div><div class="footer">Dokumen resmi Legacy Music Center • Dicetak dari sistem Progress Belajar</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),650));<\/script></body></html>`;
      const printReadyReport = report.replace('<style>', '<style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}');
      printWindow.document.open(); printWindow.document.write(printReadyReport); printWindow.document.close();
    }


    function formatAcademyDate(value) {
      const text = String(value || '').trim();
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
      return text || '-';
    }

    function getAnnouncementTargetLabel(item) {
      const labels = { semua:'Semua Guru & Siswa', semua_guru:'Semua Guru', guru_tertentu:item.targetDetail || 'Guru Tertentu', semua_siswa:'Semua Siswa', siswa_tertentu:item.targetDetail || 'Siswa Tertentu' };
      return labels[item.target] || 'Semua Guru & Siswa';
    }

    function renderDashboardAcademyUpdates() {
      const target = currentUser.userType === 'siswa' ? document.getElementById('dashboardUpdatesSiswa') : document.getElementById('dashboardUpdatesGuru');
      if (!target || currentUser.userType === 'admin') return;
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const upcoming = globalJadwalPenggantiList.filter(item => String(item.tanggalPelaksanaan || '') >= todayKey).sort((a,b) => String(a.tanggalPelaksanaan).localeCompare(String(b.tanggalPelaksanaan)));
      const makeup = upcoming[0] || globalJadwalPenggantiList[0] || null;
      const announcement = globalPengumumanList[0] || null;
      const makeupCard = makeup
        ? `<div class="dashboard-update-card" onclick="switchTab('section-pengganti')"><div class="dashboard-update-top"><div class="dashboard-update-label">↻ Make-up Class</div><span class="dashboard-update-link">Detail →</span></div><strong>${escapeTaskHtml(makeup.namaSiswa || 'Jadwal Pergantian')}</strong><p>${escapeTaskHtml(makeup.hariPelaksanaan || '')}, ${escapeTaskHtml(formatAcademyDate(makeup.tanggalPelaksanaan))} • ${escapeTaskHtml(makeup.jamMulai || '-')}–${escapeTaskHtml(makeup.jamSelesai || '-')} • ${escapeTaskHtml(makeup.ruangan || '-')}</p></div>`
        : `<div class="dashboard-update-card" onclick="switchTab('section-pengganti')"><div class="dashboard-update-top"><div class="dashboard-update-label">↻ Make-up Class</div><span class="dashboard-update-link">Lihat →</span></div><strong>Belum ada jadwal pergantian</strong><p>Jadwal baru akan tampil di sini.</p></div>`;
      const announcementCard = announcement
        ? `<div class="dashboard-update-card" onclick="switchTab('section-pengumuman')"><div class="dashboard-update-top"><div class="dashboard-update-label">📢 Pengumuman</div><span class="dashboard-update-link">Detail →</span></div><strong>${escapeTaskHtml(announcement.judul || '-')}</strong><p>${escapeTaskHtml(announcement.isi || '-')}</p></div>`
        : `<div class="dashboard-update-card" onclick="switchTab('section-pengumuman')"><div class="dashboard-update-top"><div class="dashboard-update-label">📢 Pengumuman</div><span class="dashboard-update-link">Lihat →</span></div><strong>Belum ada pengumuman</strong><p>Informasi terbaru Academy akan tampil di sini.</p></div>`;
      target.innerHTML = makeupCard + announcementCard;
    }

    function autoFillJadwalPenggantiData(namaSiswa) {
      if (!namaSiswa) return;
      const sObj = globalSiswaList.find(s => String(s.nama).trim().toLowerCase() === String(namaSiswa).trim().toLowerCase());
      if (sObj && sObj.guru) {
        document.getElementById('penggantiGuruSelect').value = sObj.guru;
      }
    }

    function handleAddJadwalPengganti(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitPengganti');
      btn.disabled = true; btn.textContent = 'Menyimpan...';

      const namaSiswa = document.getElementById('penggantiSiswaSelect').value;
      const jObj = globalJadwalList.find(j => String(j.namaSiswa).trim().toLowerCase() === String(namaSiswa).trim().toLowerCase());

      const payload = {
        jadwalID: jObj ? jObj.jadwalID : '',
        namaSiswa: namaSiswa,
        alasan: document.getElementById('penggantiAlasan').value,
        tanggalPelaksanaan: document.getElementById('penggantiTanggal').value,
        jamMulai: document.getElementById('penggantiJamMulai').value,
        jamSelesai: document.getElementById('penggantiJamSelesai').value,
        guru: document.getElementById('penggantiGuruSelect').value,
        ruangan: document.getElementById('penggantiRuanganSelect').value,
        currentUserType: currentUser.userType,
        currentUserName: currentUser.userName
      };

      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Simpan Jadwal Pergantian';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if (res.success) {
          document.getElementById('formAddJadwalPengganti').reset();
          fetchDashboardData();
        }
      }).withFailureHandler(error => {
        btn.disabled = false; btn.textContent = 'Simpan Jadwal Pergantian';
        showAlert('alertDanger', 'Gagal menyimpan jadwal pergantian: ' + (error.message || error));
      }).addJadwalPengganti(payload);
    }

    function setupMakeupFilters() {
      const box = document.getElementById('makeupFilterBox');
      if (!box) return;
      const isAdmin = currentUser.userType === 'admin';
      const isGuru = currentUser.userType === 'guru';
      box.style.display = isAdmin || isGuru ? 'grid' : 'none';
      document.getElementById('makeupFilterClassGroup').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('makeupFilterTeacherGroup').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('makeupFilterDayGroup').style.display = isAdmin || isGuru ? 'block' : 'none';
      const classSelect = document.getElementById('makeupFilterClass');
      const teacherSelect = document.getElementById('makeupFilterTeacher');
      const currentClass = classSelect.value;
      const currentTeacher = teacherSelect.value;
      const classes = [...new Set(globalSiswaList.map(item => item.instrumen || item.kelas).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id'));
      classSelect.innerHTML = '<option value="">Semua Kelas</option>' + classes.map(value => `<option value="${escapeTaskHtml(value)}">${escapeTaskHtml(value)}</option>`).join('');
      teacherSelect.innerHTML = '<option value="">Semua Guru</option>' + globalGuruList.map(item => `<option value="${escapeTaskHtml(item.nama)}">${escapeTaskHtml(item.nama)}</option>`).join('');
      if (classes.includes(currentClass)) classSelect.value = currentClass;
      if (globalGuruList.some(item => item.nama === currentTeacher)) teacherSelect.value = currentTeacher;
    }

    function renderTabelJadwalPengganti() {
      const container = document.getElementById('jadwalPenggantiListContainer');
      if (!container) return;
      container.innerHTML = '';
      const isAdmin = currentUser.userType === 'admin';
      const classFilter = isAdmin ? String(document.getElementById('makeupFilterClass')?.value || '').toLowerCase() : '';
      const teacherFilter = isAdmin ? String(document.getElementById('makeupFilterTeacher')?.value || '').toLowerCase() : '';
      const dayFilter = currentUser.userType !== 'siswa' ? String(document.getElementById('makeupFilterDay')?.value || '').toLowerCase() : '';
      const list = globalJadwalPenggantiList.filter(item => {
        const student = globalSiswaList.find(row => String(row.nama || '').toLowerCase() === String(item.namaSiswa || '').toLowerCase());
        const studentClass = String(student ? (student.instrumen || student.kelas || '') : '').toLowerCase();
        return (!classFilter || studentClass === classFilter) && (!teacherFilter || String(item.guru || '').toLowerCase() === teacherFilter) && (!dayFilter || String(item.hariPelaksanaan || '').toLowerCase() === dayFilter);
      });
      if (list.length === 0) {
        container.innerHTML = '<div class="academy-empty">Belum ada jadwal pergantian yang tersedia.</div>';
        return;
      }

      list.forEach(item => {
        const deleteButton = isAdmin ? `<button class="btn-action btn-delete" onclick="handleDeleteJadwalPengganti('${escapeTaskHtml(item.penggantiID)}')">Hapus</button>` : '';
        container.innerHTML += `<article class="academy-card"><div class="academy-card-head"><div class="academy-card-icon">↻</div><div class="academy-card-title"><strong>${escapeTaskHtml(item.namaSiswa || '-')}</strong><span>${escapeTaskHtml(item.hariPelaksanaan || '')}, ${escapeTaskHtml(formatAcademyDate(item.tanggalPelaksanaan))}</span></div><span class="badge badge-success">${escapeTaskHtml(item.status || 'Aktif')}</span></div><div class="academy-meta-grid"><div class="academy-meta"><span>Waktu</span><strong>${escapeTaskHtml(item.jamMulai || '-')} – ${escapeTaskHtml(item.jamSelesai || '-')}</strong></div><div class="academy-meta"><span>Ruangan</span><strong>${escapeTaskHtml(item.ruangan || '-')}</strong></div><div class="academy-meta"><span>Guru</span><strong>${escapeTaskHtml(item.guru || '-')}</strong></div><div class="academy-meta"><span>Alasan</span><strong>${escapeTaskHtml(item.alasan || '-')}</strong></div></div>${deleteButton ? `<div class="academy-card-actions">${deleteButton}</div>` : ''}</article>`;
      });
    }

    function handleDeleteJadwalPengganti(id) {
      if(confirm('Apakah Anda yakin ingin menghapus jadwal pergantian ini?')) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) fetchDashboardData();
        }).withFailureHandler(error => showAlert('alertDanger', 'Gagal menghapus jadwal: ' + (error.message || error))).deleteJadwalPengganti(id, currentUser.userType);
      }
    }

    function togglePengumumanTargetDetail(targetVal) {
      const studentContainer = document.getElementById('containerPengumumanSiswaDetail');
      const teacherContainer = document.getElementById('containerPengumumanGuruDetail');
      if (studentContainer) studentContainer.style.display = targetVal === 'siswa_tertentu' ? 'block' : 'none';
      if (teacherContainer) teacherContainer.style.display = targetVal === 'guru_tertentu' ? 'block' : 'none';

      if (targetVal === 'guru_tertentu') {
        const select = document.getElementById('pengumumanGuruDetailSelect');
        if (select) {
          const previous = select.value;
          select.innerHTML = '<option value="">Pilih Guru...</option>' + (globalGuruList || []).map(guru => `<option value="${escapeTaskHtml(guru.nama || '')}">${escapeTaskHtml(guru.nama || '-')} (${escapeTaskHtml(guru.instrumen || 'Musik')})</option>`).join('');
          if ([...select.options].some(option => option.value === previous)) select.value = previous;
        }
      }
    }

    function handleAddPengumuman(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitPengumuman');
      btn.disabled = true; btn.textContent = 'Menerbitkan...';

      const targetVal = document.getElementById('pengumumanTarget').value;
      let targetDetailVal = '';

      if (targetVal === 'siswa_tertentu') {
        targetDetailVal = document.getElementById('pengumumanSiswaDetailSelect').value;
        if (!targetDetailVal) {
          alert('Silakan pilih Siswa spesifik terlebih dahulu!');
          btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
          return false;
        }
      } else if (targetVal === 'guru_tertentu') {
        targetDetailVal = document.getElementById('pengumumanGuruDetailSelect')?.value || '';
        if (!targetDetailVal) {
          alert('Silakan pilih Guru spesifik terlebih dahulu!');
          btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
          return false;
        }
      }

      const payload = {
        judul: document.getElementById('pengumumanJudul').value,
        target: targetVal,
        targetDetail: targetDetailVal,
        isi: document.getElementById('pengumumanIsi').value,
        pembuat: currentUser.userName,
        currentUserType: currentUser.userType
      };

      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if (res.success) {
          document.getElementById('formAddPengumuman').reset();
          togglePengumumanTargetDetail('');
          fetchDashboardData();
        }
      }).withFailureHandler(error => {
        btn.disabled = false; btn.textContent = 'Terbitkan Pengumuman';
        showAlert('alertDanger', 'Gagal menerbitkan pengumuman: ' + (error.message || error));
      }).addPengumuman(payload);
    }

    function renderPengumumanList() {
      const container = document.getElementById('pengumumanListContainer');
      container.innerHTML = '';

      if (globalPengumumanList.length === 0) {
        container.innerHTML = '<div class="academy-empty">Belum ada pengumuman terbaru.</div>';
        return;
      }

      const isAdmin = currentUser.userType === 'admin';

      globalPengumumanList.forEach(item => {
        const deleteBtn = isAdmin ? `<button class="btn-action btn-delete" onclick="handleDeletePengumuman('${escapeTaskHtml(item.pengumumanID)}')">Hapus</button>` : '';
        const targetLabel = getAnnouncementTargetLabel(item);
        const adminMeta = isAdmin ? `<div class="academy-meta-grid"><div class="academy-meta"><span>Penerima</span><strong>${escapeTaskHtml(targetLabel)}</strong></div><div class="academy-meta"><span>Status</span><strong>${escapeTaskHtml(item.status || 'Terbit')}</strong></div></div>` : '';
        container.innerHTML += `<article class="academy-card"><div class="academy-card-head"><div class="academy-card-icon">📢</div><div class="academy-card-title"><strong>${escapeTaskHtml(item.judul || '-')}</strong><span>${escapeTaskHtml(item.tanggalKirim || '-')} • ${escapeTaskHtml(item.pembuat || 'Admin')}</span></div></div><div class="academy-card-content">${escapeTaskHtml(item.isi || '-')}</div>${adminMeta}${deleteBtn ? `<div class="academy-card-actions">${deleteBtn}</div>` : ''}</article>`;
      });
    }

    function handleDeletePengumuman(id) {
      if(confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) fetchDashboardData();
        }).withFailureHandler(error => showAlert('alertDanger', 'Gagal menghapus pengumuman: ' + (error.message || error))).deletePengumuman(id, currentUser.userType);
      }
    }

    function setupRoomFilters() {
      if (currentUser.userType !== 'admin') return;
      const dateInput = document.getElementById('roomFilterDate');
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);
      syncRoomDayAndRender();
      const roomSelect = document.getElementById('roomFilterRoom');
      const current = roomSelect.value;
      const rooms = getKnownRooms();
      roomSelect.innerHTML = '<option value="">Semua Ruangan</option>' + rooms.map(room => `<option value="${escapeTaskHtml(room)}">${escapeTaskHtml(room)}</option>`).join('');
      if (rooms.includes(current)) roomSelect.value = current;
    }

    function getKnownRooms() {
      const defaults = Array.from({length:8}, (_, index) => `R ${index + 1}`);
      return [...new Set(defaults.concat(globalJadwalList.map(item => item.ruangan), globalJadwalPenggantiList.map(item => item.ruangan)).filter(Boolean))].sort((a,b) => a.localeCompare(b,'id',{numeric:true}));
    }

    function syncRoomDayAndRender() {
      const value = document.getElementById('roomFilterDate')?.value;
      if (value) {
        const parts = value.split('-').map(Number);
        const day = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(parts[0], parts[1] - 1, parts[2]).getDay()];
        document.getElementById('roomFilterDay').value = day;
      }
      renderRoomAvailability();
    }

    function schedulesOverlap(startA, endA, startB, endB) {
      return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
    }

    function renderRoomAvailability() {
      if (currentUser.userType !== 'admin') return;
      const grid = document.getElementById('roomAvailabilityGrid');
      const summary = document.getElementById('roomAvailabilitySummary');
      if (!grid || !summary) return;
      const date = document.getElementById('roomFilterDate')?.value || '';
      const day = document.getElementById('roomFilterDay')?.value || '';
      const start = document.getElementById('roomFilterStart')?.value || '10:00';
      const end = document.getElementById('roomFilterEnd')?.value || '11:00';
      const selectedRoom = document.getElementById('roomFilterRoom')?.value || '';
      const rooms = getKnownRooms().filter(room => !selectedRoom || room === selectedRoom);
      const results = rooms.map(room => {
        const regular = globalJadwalList.filter(item => String(item.ruangan || '') === room && String(item.hari || '').toLowerCase() === day.toLowerCase() && schedulesOverlap(start,end,item.jamMulai,item.jamSelesai));
        const makeup = globalJadwalPenggantiList.filter(item => String(item.ruangan || '') === room && (!date || String(item.tanggalPelaksanaan || '') === date) && schedulesOverlap(start,end,item.jamMulai,item.jamSelesai));
        return { room, conflicts: regular.concat(makeup) };
      });
      const available = results.filter(item => item.conflicts.length === 0).length;
      summary.innerHTML = `<div class="room-summary-card"><span>Total ruang ditampilkan</span><strong>${results.length}</strong></div><div class="room-summary-card"><span>Tersedia</span><strong style="color:#10b981">${available}</strong></div><div class="room-summary-card"><span>Terpakai / bentrok</span><strong style="color:#ef4444">${results.length - available}</strong></div>`;
      grid.innerHTML = results.map(result => {
        const detail = result.conflicts.length ? result.conflicts.map(item => `${escapeTaskHtml(item.jamMulai || '-')}–${escapeTaskHtml(item.jamSelesai || '-')} · ${escapeTaskHtml(item.namaSiswa || '-')}<br>${escapeTaskHtml(item.guru || '-')}`).join('<hr style="border:0;border-top:1px solid #edf1f5;margin:7px 0;">') : `Kosong pada ${escapeTaskHtml(day)}, ${escapeTaskHtml(start)}–${escapeTaskHtml(end)}`;
        return `<article class="room-card ${result.conflicts.length ? 'busy' : ''}"><h3>${escapeTaskHtml(result.room)}</h3><span class="room-state">${result.conflicts.length ? 'Terpakai' : 'Tersedia'}</span><div class="room-detail">${detail}</div></article>`;
      }).join('') || '<div class="academy-empty">Tidak ada ruangan sesuai filter.</div>';
    }

    function getNotificationStorageKey() {
      return `legacyNotificationsRead:${currentUser.userType}:${currentUser.userID || currentUser.userName}`;
    }

    function getReadNotificationIds() {
      try { return new Set(JSON.parse(localStorage.getItem(getNotificationStorageKey()) || '[]')); }
      catch (error) { return new Set(); }
    }

    function buildNotifications() {
      const items = [];
      globalPengumumanList.slice(0,5).forEach(item => items.push({ id:`announcement:${item.pengumumanID || item.judul}`, type:'section-pengumuman', title:item.judul || 'Pengumuman Academy', detail:item.isi || 'Ada pengumuman baru.' }));
      const today = new Date().toISOString().slice(0,10);
      globalJadwalPenggantiList.filter(item => String(item.tanggalPelaksanaan || '') >= today).slice(0,5).forEach(item => items.push({ id:`makeup:${item.penggantiID}`, type:'section-pengganti', title:`Jadwal pergantian ${item.namaSiswa || ''}`, detail:`${formatAcademyDate(item.tanggalPelaksanaan)} · ${item.jamMulai || '-'} · ${item.ruangan || '-'}` }));
      const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const now = new Date();
      const currentMinute = now.getHours() * 60 + now.getMinutes();
      globalJadwalList.filter(item => String(item.hari || '').toLowerCase() === days[now.getDay()].toLowerCase()).forEach(item => {
        const minutes = timeToMinutes(item.jamMulai) - currentMinute;
        if (minutes >= 0 && minutes <= 60) items.push({ id:`class:${today}:${item.jadwalID}`, type:currentUser.userType === 'siswa' ? 'dashboard-siswa' : 'section-jadwal', title:`Kelas akan berlangsung ${minutes === 0 ? 'sekarang' : `dalam ${minutes} menit`}`, detail:`${item.namaSiswa || ''} · ${item.jamMulai || '-'} · ${item.ruangan || '-'}` });
      });
      return items.slice(0,12);
    }

    function renderNotificationCenter() {
      const list = document.getElementById('notificationList');
      const badge = document.getElementById('notificationBadge');
      if (!list || !badge || !currentUser.userType) return;
      const read = getReadNotificationIds();
      const items = buildNotifications();
      const unread = items.filter(item => !read.has(item.id)).length;
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.style.display = unread ? 'grid' : 'none';
      list.innerHTML = items.length ? items.map(item => `<button type="button" class="notification-item ${read.has(item.id) ? '' : 'unread'}" onclick="openNotificationItem(decodeURIComponent('${encodeURIComponent(item.id)}'),decodeURIComponent('${encodeURIComponent(item.type)}'))"><span class="notification-dot"></span><span class="notification-copy"><strong>${escapeTaskHtml(item.title)}</strong><span>${escapeTaskHtml(item.detail)}</span></span></button>`).join('') : '<div class="academy-empty">Belum ada notifikasi.</div>';
    }

    function toggleNotificationPanel(event) {
      if (event) event.stopPropagation();
      const panel = document.getElementById('notificationPanel');
      if (!panel) return;
      const willOpen = !panel.classList.contains('open');
      panel.classList.toggle('open', willOpen);
      if (willOpen) {
        const read = getReadNotificationIds();
        buildNotifications().forEach(item => read.add(item.id));
        localStorage.setItem(getNotificationStorageKey(), JSON.stringify([...read]));
        renderNotificationCenter();
      }
    }

    function openNotificationItem(id, sectionId) {
      const read = getReadNotificationIds();
      read.add(id);
      localStorage.setItem(getNotificationStorageKey(), JSON.stringify([...read]));
      document.getElementById('notificationPanel')?.classList.remove('open');
      switchTab(sectionId);
      renderNotificationCenter();
    }

    function markAllNotificationsRead(event) {
      if (event) event.stopPropagation();
      localStorage.setItem(getNotificationStorageKey(), JSON.stringify(buildNotifications().map(item => item.id)));
      renderNotificationCenter();
    }

    document.addEventListener('click', event => {
      const center = document.getElementById('notificationCenter');
      if (center && !center.contains(event.target)) document.getElementById('notificationPanel')?.classList.remove('open');
    });


    function filterAdminByGuru() {
      renderDashboardViews();
      renderTabelJadwal();
      renderTabelRiwayat();
    }

    function getInstrumenBadgePill(instrumen) {
      const name = (instrumen || 'Gitar').trim();
      const lower = name.toLowerCase();
      
      let icon = '🎸';
      let cssClass = 'instrumen-gitar';

      if (lower.includes('piano')) { icon = '🎹'; cssClass = 'instrumen-piano'; }
      else if (lower.includes('drum')) { icon = '🥁'; cssClass = 'instrumen-drum'; }
      else if (lower.includes('vokal') || lower.includes('vocal')) { icon = '🎤'; cssClass = 'instrumen-vokal'; }
      else if (lower.includes('biola') || lower.includes('violin')) { icon = '🎻'; cssClass = 'instrumen-biola'; }

      return `<span class="instrumen-pill ${cssClass}"><span>${icon}</span> <span>${name}</span></span>`;
    }

    function getStudentClassesForUI(student) {
      return Array.isArray(student && student.kelasList) && student.kelasList.length ? student.kelasList : [{ instrumen:student?.instrumen || '', guru:student?.guru || '', grade:student?.kelas || '' }];
    }

    function studentHasClassValue(student, field, value) {
      const target = String(value || '').trim().toLowerCase();
      if (!target) return true;
      return getStudentClassesForUI(student).some(item => String(item[field] || '').trim().toLowerCase() === target);
    }

    function getScheduleStatusPill(jamMulai, jamSelesai) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const startMin = timeToMinutes(jamMulai);
      const endMin = timeToMinutes(jamSelesai);

      if (currentMin >= startMin && currentMin < endMin) {
        return `<span class="status-pill status-berlangsung">Berlangsung</span>`;
      } else if (currentMin < startMin) {
        return `<span class="status-pill status-menunggu">Menunggu</span>`;
      } else {
        return `<span class="status-pill status-selesai">Selesai</span>`;
      }
    }

    function renderDashboardViews() {
      const selectedGuruFilter = document.getElementById('adminSelectGuruFilter') ? document.getElementById('adminSelectGuruFilter').value.trim().toLowerCase() : '';

      let displayedSiswa = globalSiswaList;
      let displayedJadwal = globalJadwalList;

      if (selectedGuruFilter !== '') {
        displayedSiswa = globalSiswaList.filter(s => studentHasClassValue(s, 'guru', selectedGuruFilter));
        displayedJadwal = globalJadwalList.filter(j => String(j.guru).trim().toLowerCase() === selectedGuruFilter);
      }

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const now = new Date();
      const todayHariName = days[now.getDay()];

      const todaySchedules = displayedJadwal
        .filter(j => String(j.hari).trim().toLowerCase() === todayHariName.toLowerCase())
        .sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));

      const scheduleContainer = document.getElementById('todayScheduleList');
      scheduleContainer.innerHTML = '';

      const barColors = ['bar-orange', 'bar-cyan', 'bar-purple', 'bar-red'];

      if (todaySchedules.length > 0) {
        todaySchedules.forEach((j, index) => {
          const sObj = displayedSiswa.find(s => String(s.nama).trim().toLowerCase() === String(j.namaSiswa).trim().toLowerCase());
          const avatarHtml = getSiswaAvatarHtml(j.namaSiswa, sObj ? sObj.foto : '');
          const durationStr = calculateDurationMinutes(j.jamMulai, j.jamSelesai);
          const instrumenPill = getInstrumenBadgePill(j.instrumen);
          const statusPill = getScheduleStatusPill(j.jamMulai, j.jamSelesai);
          const barClass = barColors[index % barColors.length];
          const gradeText = sObj && sObj.kelas ? sObj.kelas : 'Kelas Privat';

          scheduleContainer.innerHTML += `
            <div class="today-schedule-item ${barClass}" onclick="handleDashboardScheduleClick(event,this,'${j.jadwalID}')" role="button" tabindex="0" aria-expanded="false">
              <div class="sched-time-block">
                <div class="sched-time-text">${j.jamMulai} - ${j.jamSelesai}</div>
                <div class="sched-duration-text">${durationStr}</div>
              </div>
              <div class="sched-student-block">
                ${avatarHtml}
                <div class="sched-student-info">
                  <div class="sched-student-name">${j.namaSiswa}</div>
                  <div class="sched-class-type">${gradeText}</div>
                </div>
              </div>
              <div class="sched-meta-block">
                ${instrumenPill}
                ${statusPill}
                <span class="sched-arrow">❯</span>
              </div>
            </div>`;
        });
      } else {
        scheduleContainer.innerHTML = `<div style="font-size:13px; color:#94a3b8; text-align:center; padding:25px 0; background:#fafafa; border-radius:12px;">Tidak ada jadwal mengajar hari ini (${todayHariName}).</div>`;
      }

      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const nextClassWidgetGuru = document.getElementById('nextClassWidgetGuru');
      if (todaySchedules.length > 0) {
        const nextSchedule = todaySchedules.find(j => {
          if (!j.jamMulai) return false;
          return timeToMinutes(j.jamMulai) > currentMinutes;
        });

        if (nextSchedule) {
          const sObjNext = displayedSiswa.find(s => String(s.nama).trim().toLowerCase() === String(nextSchedule.namaSiswa).trim().toLowerCase());
          const nextAvatarHtml = getSiswaAvatarHtml(nextSchedule.namaSiswa, sObjNext ? sObjNext.foto : '');

          nextClassWidgetGuru.innerHTML = `
            <div style="font-size:14px; font-weight:700; color:#1e293b;">${nextSchedule.jamMulai} - ${nextSchedule.jamSelesai} (${nextSchedule.hari})</div>
            <div style="font-size:12.5px; font-weight:600; color:#c2410c; margin-top:2px;">Kelas: ${nextSchedule.instrumen || 'Musik'} | Ruangan: ${nextSchedule.ruangan}</div>
            <div style="font-size:13px; color:#1e293b; margin-top:8px; display:flex; align-items:center; gap:8px;">${nextAvatarHtml} <b>${nextSchedule.namaSiswa}</b></div>`;
        } else {
          nextClassWidgetGuru.innerHTML = `<div style="font-size:13px; color:#64748b;">Tidak ada jadwal berikutnya hari ini.</div>`;
        }
      } else {
        nextClassWidgetGuru.innerHTML = `<div style="font-size:13px; color:#64748b;">Tidak ada jadwal terdekat hari ini.</div>`;
      }

      const ongoingClassWidgetAdmin = document.getElementById('ongoingClassWidgetAdmin');
      const ongoingSchedules = todaySchedules.filter(j => {
        const start = timeToMinutes(j.jamMulai);
        const end = timeToMinutes(j.jamSelesai);
        return currentMinutes >= start && currentMinutes < end;
      });

      if (ongoingSchedules.length > 0) {
        let htmlOngoing = '';
        ongoingSchedules.forEach(item => {
          const sObj = displayedSiswa.find(s => String(s.nama).trim().toLowerCase() === String(item.namaSiswa).trim().toLowerCase());
          const avatarHtml = getSiswaAvatarHtml(item.namaSiswa, sObj ? sObj.foto : '');

          htmlOngoing += `
            <div style="padding:10px 0; border-bottom:1px solid #fed7aa;">
              <div style="font-size:13px; font-weight:700; color:#ea580c;">🕒 ${item.jamMulai} - ${item.jamSelesai} | 📍 ${item.ruangan}</div>
              <div style="font-size:13px; font-weight:600; color:#1e293b; margin-top:4px; display:flex; align-items:center; gap:8px;">
                ${avatarHtml} <span><b>${item.namaSiswa}</b> (${item.instrumen || 'Musik'})</span>
              </div>
              <div style="font-size:12px; color:#64748b; margin-top:2px;">👤 Pengajar: <b>${item.guru || '-'}</b></div>
            </div>`;
        });
        ongoingClassWidgetAdmin.innerHTML = htmlOngoing;
      } else {
        ongoingClassWidgetAdmin.innerHTML = `<div style="font-size:13px; color:#64748b;">Tidak ada kelas yang sedang berlangsung saat ini.</div>`;
      }
      
      const previewBody = document.getElementById('dashSiswaPreviewBody'); previewBody.innerHTML = '';
      displayedSiswa.slice(0, 3).forEach((s, index) => {
        let badgeClass = s.status === 'Cuti' ? 'badge-warning' : (s.status === 'Keluar' ? 'badge-danger' : 'badge-success');
        let avatarHtml = getSiswaAvatarHtml(s.nama, s.foto);
        previewBody.innerHTML += `<tr class="mobile-expand-row dashboard-student-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false">
          <td data-label="No">${index + 1}</td>
          <td data-label="Nama Siswa"><div style="display:flex; align-items:center; gap:10px;">${avatarHtml} <b>${escapeTaskHtml(s.nama)}</b></div></td>
          <td data-label="Kelas / Instrumen"><b>${escapeTaskHtml(s.instrumen || 'Gitar')}</b></td>
          <td data-label="Guru Pengajar">${escapeTaskHtml(s.guru || '-')}</td>
          <td data-label="Grade">${escapeTaskHtml(s.kelas || '-')}</td>
          <td data-label="Status"><span class="badge ${badgeClass}">${escapeTaskHtml(s.status || '-')}</span></td>
        </tr>`;
      });
      restoreDashboardWidgetStates();
    }

    function applySiswaFilters() {
      let result = [...globalSiswaList];
      const urutan = document.getElementById('filterSiswaUrutan') ? document.getElementById('filterSiswaUrutan').value : 'terbaru';
      const search = String(document.getElementById('studentSearchInput')?.value || '').trim().toLowerCase();

      if (search) {
        result = result.filter(s => {
          const classText = getStudentClassesForUI(s).map(item => `${item.instrumen || ''} ${item.guru || ''} ${item.grade || ''}`).join(' ');
          const haystack = `${s.nama || ''} ${s.instrumen || ''} ${s.guru || ''} ${s.kelas || ''} ${s.email || ''} ${s.noHp || ''} ${s.status || ''} ${classText}`.toLowerCase();
          return haystack.includes(search);
        });
      }

      if (currentUser.userType === 'admin') {
        const filterInst = document.getElementById('filterSiswaInstrumen') ? document.getElementById('filterSiswaInstrumen').value.trim().toLowerCase() : '';
        const filterGuru = document.getElementById('filterSiswaGuru') ? document.getElementById('filterSiswaGuru').value.trim().toLowerCase() : '';

        if (filterInst !== '') {
          result = result.filter(s => studentHasClassValue(s, 'instrumen', filterInst));
        }
        if (filterGuru !== '') {
          result = result.filter(s => studentHasClassValue(s, 'guru', filterGuru));
        }

      }

      result.sort((a, b) => {
        const dateA = parseStudentReportDate(a.tglDaftar);
        const dateB = parseStudentReportDate(b.tglDaftar);
        const timeA = dateA ? dateA.getTime() : null;
        const timeB = dateB ? dateB.getTime() : null;
        if (timeA === null && timeB === null) return String(a.nama || '').localeCompare(String(b.nama || ''), 'id');
        if (timeA === null) return 1;
        if (timeB === null) return -1;
        if (timeA !== timeB) return urutan === 'terlama' ? timeA - timeB : timeB - timeA;
        return String(a.nama || '').localeCompare(String(b.nama || ''), 'id');
      });

      renderGuruSiswaBody(result);
    }

    function renderGuruSiswaBody(list) {
      const sBody = document.getElementById('guruSiswaBody'); sBody.innerHTML = '';

      const selects = document.querySelectorAll('#absensiSiswa, #editJadwalSiswa, #tugasPilihSiswa, #penggantiSiswaSelect, #pengumumanSiswaDetailSelect');
      let options = '<option value="">Pilih Siswa...</option>';
      globalSiswaList.forEach(s => options += `<option value="${s.nama}">${s.nama} (${s.instrumen || 'Gitar'})</option>`);
      selects.forEach(sel => sel.innerHTML = options);

      if (list.length === 0) {
        sBody.innerHTML = `<tr class="table-empty-row"><td class="table-empty-cell" colspan="9">Data siswa tidak ditemukan.</td></tr>`;
        return;
      }

      list.forEach((s, index) => {
        let badgeClass = s.status === 'Cuti' ? 'badge-warning' : (s.status === 'Keluar' ? 'badge-danger' : 'badge-success');
        let avatarHtml = getSiswaAvatarHtml(s.nama, s.foto);
        sBody.innerHTML += `<tr class="mobile-expand-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false">
          <td data-label="No">${index + 1}</td>
          <td data-label="Nama Siswa"><div style="display:flex; align-items:center; gap:10px;">${avatarHtml} <b>${escapeTaskHtml(s.nama)}</b></div></td>
          <td data-label="Instrumen"><b>${escapeTaskHtml(s.instrumen || 'Gitar')}</b></td>
          <td data-label="Guru">${escapeTaskHtml(s.guru || '-')}</td>
          <td data-label="Grade">${escapeTaskHtml(s.kelas || '-')}</td>
          <td data-label="Email">${escapeTaskHtml(s.email || '-')}</td>
          <td data-label="No. HP">${escapeTaskHtml(s.noHp || '-')}</td>
          <td data-label="Status"><span class="badge ${badgeClass}">${escapeTaskHtml(s.status || '-')}</span></td>
          <td data-label="Aksi"><div class="table-actions">
            <button class="btn-action btn-edit" onclick="openEditModal(decodeURIComponent('${encodeURIComponent(s.nama)}'))">Edit</button>
            <button class="btn-action" style="background:#fff0e9;color:#c2410c;border:1px solid #fed7c3;" onclick="event.stopPropagation();openStudent360Report(decodeURIComponent('${encodeURIComponent(s.siswaID || s.nama)}'))">Laporan Lengkap</button>
            <button class="btn-action btn-delete" onclick="deleteSiswa(decodeURIComponent('${encodeURIComponent(s.nama)}'))">Hapus</button>
          </div>
          </td>
        </tr>`;
      });

    }


    function openStudent360Report(identifier) {
      if (!identifier || !['guru','admin'].includes(currentUser.userType)) return;
      const reportWindow = window.open('', '_blank', 'width=1180,height=820');
      if (!reportWindow) {
        showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk membuka laporan lengkap.');
        return;
      }
      reportWindow.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:36px;color:#64748b;background:#f4f6f8"><div style="max-width:720px;margin:auto;background:#fff;padding:28px;border-radius:18px"><b style="color:#f15a24">Legacy Music Center</b><h2 style="color:#17232d">Menyiapkan Laporan Perkembangan Siswa...</h2><p>Data akademik, kehadiran, tugas, dan progress sedang dimuat.</p></div></body></html>');
      google.script.run.withSuccessHandler(response => {
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        if (!data || data.success === false) {
          reportWindow.document.body.innerHTML = `<div style="font-family:Arial;padding:32px"><h2>Gagal memuat laporan</h2><p>${escapeTaskHtml(data?.message || 'Data laporan tidak tersedia.')}</p></div>`;
          return;
        }
        google.script.run.withSuccessHandler(logo => {
          buildStudent360ReportWindow(data, reportWindow, logo && logo.success ? logo.dataUrl : '');
        }).withFailureHandler(() => buildStudent360ReportWindow(data, reportWindow, '')).getLearningProgressPrintLogo();
      }).withFailureHandler(error => {
        reportWindow.document.body.innerHTML = `<div style="font-family:Arial;padding:32px"><h2>Gagal memuat laporan</h2><p>${escapeTaskHtml(error.message || error)}</p></div>`;
      }).getStudent360Report(identifier);
    }

    function student360PeriodLabel(progress) {
      if (!progress) return 'Belum ada periode progress';
      if (typeof formatLearningProgressPeriod === 'function') return formatLearningProgressPeriod(progress.periode);
      return progress.periode || '-';
    }

    function student360ParseDate(value) {
      const raw = String(value || '').trim();
      let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      m = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return null;
    }

    function buildStudent360ReportWindow(data, reportWindow, logoDataUrl) {
      const student = data.student || {};
      const attendance = Array.isArray(data.attendance) ? data.attendance : [];
      const assignments = Array.isArray(data.assignments) ? data.assignments : [];
      const progressList = Array.isArray(data.progress) ? data.progress : [];
      const classes = Array.isArray(data.classes) ? data.classes : [];
      const latest = data.latestProgress || progressList[0] || null;

      const statusKey = value => String(value || '').trim().toLowerCase();
      const present = attendance.filter(x => ['masuk','hadir'].includes(statusKey(x.status))).length;
      const izin = attendance.filter(x => statusKey(x.status) === 'izin').length;
      const sakit = attendance.filter(x => statusKey(x.status) === 'sakit').length;
      const alpa = attendance.filter(x => ['alpa','alpha'].includes(statusKey(x.status))).length;
      const totalAttendance = attendance.length;
      const attendancePct = totalAttendance ? Math.round((present / totalAttendance) * 100) : 0;

      const completedTasks = assignments.filter(x => statusKey(x.status) === 'selesai').length;
      const now = new Date(); now.setHours(0,0,0,0);
      const lateTasks = assignments.filter(x => {
        if (statusKey(x.status) === 'selesai') return false;
        const deadline = student360ParseDate(x.deadline);
        return deadline && deadline < now;
      }).length;
      const pendingTasks = Math.max(0, assignments.length - completedTasks);

      const materials = [...new Set(attendance.map(x => String(x.materi || '').trim()).filter(Boolean))].slice(0,8);
      const songs = [...new Set(attendance.map(x => String(x.lagu || '').trim()).filter(Boolean))].slice(0,8);
      const overall = latest ? Math.max(0, Math.min(100, Number(latest.overallProgress) || 0)) : 0;
      const components = latest ? [
        ['Materi', latest.materiProgress],
        ['Teknik', latest.teknikProgress],
        ['Teori / Reading', latest.teoriProgress],
        ['Repertoire', latest.repertoireProgress],
        ['Practice', latest.practiceProgress],
        ['Performance', latest.performanceProgress],
        ['Evaluasi', latest.evaluasiProgress]
      ] : [];

      const trend = progressList.slice().sort((a,b) => String(a.periodeMulai || a.periode || '').localeCompare(String(b.periodeMulai || b.periode || ''))).slice(-6);
      const trendMax = Math.max(100, ...trend.map(x => Number(x.overallProgress) || 0));

      const esc = escapeTaskHtml;
      const emptyText = text => text ? esc(text) : '<span class="muted">Belum ada data</span>';
      const listHtml = (items, empty='Belum ada data') => items.length
        ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`
        : `<div class="empty">${esc(empty)}</div>`;

      const classLabel = classes.length
        ? classes.map(c => `${esc(c.instrumen || '-')}${c.grade ? ` • ${esc(c.grade)}` : ''}${c.guru ? ` • ${esc(c.guru)}` : ''}`).join('<br>')
        : `${esc(student.instrumen || '-')} • ${esc(student.kelas || '-')}`;

      const studentAvatar = student.foto
        ? `<img class="student-photo" src="${esc(student.foto)}" alt="">`
        : `<div class="student-photo fallback">${esc(String(student.nama || 'S').charAt(0).toUpperCase())}</div>`;

      const componentHtml = components.length ? components.map(([label,val]) => {
        const score = Math.max(0, Math.min(100, Number(val) || 0));
        return `<div class="progress-row"><div class="progress-top"><b>${esc(label)}</b><span>${score}%</span></div><div class="bar"><i style="width:${score}%"></i></div></div>`;
      }).join('') : '<div class="empty">Progress belajar belum tersedia.</div>';

      const trendHtml = trend.length ? `<div class="trend-chart">${trend.map(item => {
        const value = Math.max(0, Math.min(100, Number(item.overallProgress) || 0));
        const height = Math.max(8, (value / trendMax) * 110);
        return `<div class="trend-col"><span>${value}%</span><i style="height:${height}px"></i><b>${esc(String(item.periode || '').replace(/^\d{4}-/,''))}</b></div>`;
      }).join('')}</div>` : '<div class="empty">Belum ada riwayat progress.</div>';

      const sig = (url,name,role) => `<div class="signature"><span>${esc(role)}</span><div class="signature-img">${url ? `<img src="${esc(url)}" alt="">` : ''}</div><b>${esc(name || '-')}</b></div>`;

      const logo = logoDataUrl
        ? `<img class="logo" src="${logoDataUrl}" alt="Legacy Music Center">`
        : `<div class="logo-text"><strong>LEGACY</strong><span>Music Center</span></div>`;

      const page1 = `
        <section class="page">
          <header>${logo}<div class="header-copy"><b>Laporan Perkembangan Siswa</b><span>Perjalanan belajar, progress, dan konsistensi siswa.</span></div></header>
          <div class="student-card">${studentAvatar}<div class="student-main"><div class="student-name">${esc(student.nama || '-')} <em>${esc(student.status || 'Aktif')}</em></div><div class="student-grid"><div><span>Instrumen / Kelas</span><b>${classLabel}</b></div><div><span>Periode Laporan</span><b>${esc(student360PeriodLabel(latest))}</b></div><div><span>Tanggal Masuk</span><b>${esc(formatAcademyDate(student.tglDaftar || '-'))}</b></div><div><span>ID Siswa</span><b>${esc(student.siswaID || '-')}</b></div></div></div></div>
          <h2>Ringkasan Utama</h2>
          <div class="metric-grid">
            <div class="metric orange"><span>Kehadiran</span><b>${attendancePct}%</b><small>${present} hadir dari ${totalAttendance} catatan</small></div>
            <div class="metric peach"><span>Progress Keseluruhan</span><b>${overall}%</b><small>${latest ? esc(latest.level || 'Progress terbaru') : 'Belum dinilai'}</small></div>
            <div class="metric green"><span>Tugas Selesai</span><b>${completedTasks}/${assignments.length}</b><small>${pendingTasks} belum selesai</small></div>
            <div class="metric blue"><span>Pertemuan</span><b>${totalAttendance}</b><small>Riwayat absensi tercatat</small></div>
          </div>
          <div class="two-col">
            <div class="panel"><h2>Perkembangan Belajar</h2>${componentHtml}</div>
            <div class="panel"><h2>Materi yang Sudah Dipelajari</h2>${listHtml(materials,'Belum ada materi tercatat.')}</div>
          </div>
          <div class="two-col lower">
            <div class="panel"><h2>Repertoire / Lagu</h2>${listHtml(songs,'Belum ada repertoire tercatat.')}</div>
            <div class="panel"><h2>Catatan Perkembangan</h2><div class="note-block"><b>Kelebihan</b><p>${emptyText(latest?.kelebihan || '')}</p><b>Perlu Ditingkatkan</b><p>${emptyText(latest?.perluDitingkatkan || '')}</p></div></div>
          </div>
          <footer>Legacy Music Center • Laporan Perkembangan Siswa</footer>
        </section>`;

      const page2 = `
        <section class="page">
          <header>${logo}<div class="header-copy"><b>Ringkasan Akademik & Kehadiran</b><span>${esc(student.nama || '-')} • ${esc(student360PeriodLabel(latest))}</span></div></header>
          <div class="two-col top-summary">
            <div class="panel attendance-panel"><h2>Statistik Kehadiran</h2><div class="attendance-wrap"><div class="donut" style="--pct:${attendancePct * 3.6}deg"><div><b>${attendancePct}%</b><span>Tingkat Kehadiran</span></div></div><div class="legend"><span><i class="g"></i>Hadir <b>${present}</b></span><span><i class="o"></i>Izin <b>${izin}</b></span><span><i class="s"></i>Sakit <b>${sakit}</b></span><span><i class="r"></i>Alpa <b>${alpa}</b></span></div></div></div>
            <div class="panel"><h2>Ringkasan Tugas</h2><div class="task-grid"><div><span>Total Tugas</span><b>${assignments.length}</b></div><div><span>Selesai</span><b>${completedTasks}</b></div><div><span>Belum Selesai</span><b>${pendingTasks}</b></div><div><span>Terlambat</span><b>${lateTasks}</b></div></div></div>
          </div>
          <div class="panel trend-panel"><h2>Riwayat Progress</h2>${trendHtml}</div>
          <div class="two-col lower">
            <div class="panel target"><h2>Target Periode Berikutnya</h2><div class="target-copy">${emptyText(latest?.targetBerikutnya || '')}</div></div>
            <div class="panel"><h2>Ringkasan Guru</h2><div class="note-block"><b>Guru Pengajar</b><p>${esc(latest?.guru || student.guru || '-')}</p><b>Terakhir Diperbarui</b><p>${esc(latest?.lastUpdated || '-')}</p></div></div>
          </div>
          <div class="signatures">
            ${sig(latest?.guruSignatureUrl, latest?.guru || student.guru, 'Guru / Coach')}
            ${sig(latest?.kepalaSekolahSignatureUrl, latest?.kepalaSekolahNama, 'Kepala Sekolah')}
          </div>
          <footer>Dokumen resmi Legacy Music Center • Dicetak ${new Date().toLocaleDateString('id-ID')}</footer>
        </section>`;

      const report = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Laporan Lengkap ${esc(student.nama || '')}</title>
      <style>
        *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        :root{--orange:#f15a24;--peach:#fff3ec;--ink:#17232d;--muted:#718096;--line:#e6ebf1}
        body{margin:0;background:#e9edf2;color:var(--ink);font-family:Arial,Helvetica,sans-serif}
        .toolbar{position:sticky;top:0;z-index:20;display:flex;justify-content:center;gap:10px;padding:12px;background:rgba(23,35,45,.92);backdrop-filter:blur(8px)}
        .toolbar button{border:0;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer}.toolbar .print{background:var(--orange);color:#fff}.toolbar .close{background:#fff;color:#334155}
        .report-shell{display:flex;gap:24px;align-items:flex-start;justify-content:center;padding:24px;overflow:auto}
        .page{width:210mm;min-width:210mm;height:297mm;background:#fff;padding:12mm;box-shadow:0 10px 35px rgba(15,23,42,.12);position:relative;overflow:hidden}
        header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid var(--orange);padding-bottom:7mm;margin-bottom:6mm}
        .logo{width:42mm;height:19mm;object-fit:contain;object-position:left center}.logo-text strong{display:block;font-size:20px;letter-spacing:2px}.logo-text span{font-size:10px;color:#64748b}
        .header-copy{text-align:right}.header-copy b{display:block;font-size:20px}.header-copy span{display:block;color:var(--muted);font-size:9px;margin-top:4px}
        .student-card{display:grid;grid-template-columns:25mm 1fr;gap:6mm;align-items:center;border:1px solid var(--line);border-radius:13px;padding:5mm;background:#fff;box-shadow:0 4px 16px rgba(15,23,42,.04)}
        .student-photo{width:23mm;height:23mm;border-radius:50%;object-fit:cover;background:#ffe6d8}.student-photo.fallback{display:grid;place-items:center;color:var(--orange);font-size:28px;font-weight:900}
        .student-name{font-size:18px;font-weight:900;margin-bottom:4mm}.student-name em{font-style:normal;font-size:9px;background:#ffe9dc;color:#d94d18;padding:5px 9px;border-radius:999px;margin-left:6px;vertical-align:middle}
        .student-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:4mm 8mm}.student-grid span{display:block;font-size:7.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:2px}.student-grid b{font-size:9px;line-height:1.35}
        h2{font-size:11px;margin:6mm 0 3mm;padding-left:3mm;border-left:3px solid var(--orange)}
        .metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}.metric{border-radius:11px;padding:4mm;min-height:28mm}.metric span{display:block;font-size:8px;color:#53657a}.metric b{display:block;font-size:20px;margin:2mm 0 1mm}.metric small{font-size:7px;color:#718096}.orange{background:#fff0e8}.peach{background:#fff6e8}.green{background:#eefaf1}.blue{background:#edf6ff}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.panel{border:1px solid var(--line);border-radius:11px;padding:4mm;background:#fff;min-width:0}.panel h2{margin-top:0}
        .progress-row{margin-bottom:3mm}.progress-top{display:flex;justify-content:space-between;font-size:8px}.progress-top span{color:#64748b}.bar{height:5px;background:#eef1f4;border-radius:999px;margin-top:1.5mm;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#f15a24,#ff8a3d);border-radius:inherit}
        ul{margin:0;padding-left:18px}li{font-size:8.5px;line-height:1.7}.empty,.muted{color:#94a3b8;font-size:8px}
        .lower{margin-top:4mm}.note-block b{display:block;font-size:8px;color:var(--orange);margin-top:2mm}.note-block p{font-size:8px;line-height:1.45;margin:1mm 0 2mm;white-space:pre-line}
        .top-summary{margin-top:1mm}.attendance-wrap{display:flex;align-items:center;justify-content:center;gap:8mm}.donut{width:37mm;height:37mm;border-radius:50%;background:conic-gradient(#55ad62 var(--pct),#f1f5f9 0);display:grid;place-items:center;position:relative}.donut:after{content:'';position:absolute;inset:6mm;background:#fff;border-radius:50%}.donut div{position:relative;z-index:2;text-align:center}.donut b{display:block;font-size:18px}.donut span{font-size:6.5px;color:#718096}.legend{display:grid;gap:2mm}.legend span{font-size:8px;display:grid;grid-template-columns:8px 1fr 20px;gap:4px;align-items:center}.legend span b{text-align:right}.legend i{width:7px;height:7px;border-radius:50%}.legend .g{background:#55ad62}.legend .o{background:#ff8a3d}.legend .s{background:#94a3b8}.legend .r{background:#ef4444}
        .task-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.task-grid div{background:#f8fafc;border-radius:9px;padding:4mm}.task-grid span{display:block;font-size:7.5px;color:#718096}.task-grid b{font-size:18px}
        .trend-panel{margin-top:4mm}.trend-chart{height:40mm;display:flex;align-items:flex-end;justify-content:space-around;border-bottom:1px solid #cbd5e1;padding:3mm 5mm 0}.trend-col{height:34mm;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:18mm}.trend-col span{font-size:7px;font-weight:800;margin-bottom:2px}.trend-col i{display:block;width:10mm;background:linear-gradient(#ff9b69,#f15a24);border-radius:4px 4px 0 0}.trend-col b{font-size:6.5px;margin-top:2px;color:#64748b;max-width:18mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .target-copy{font-size:9px;line-height:1.55;white-space:pre-line;background:#fff7f2;border-radius:9px;padding:4mm;color:#475569}
        .signatures{display:grid;grid-template-columns:1fr 1fr;gap:20mm;margin-top:9mm;text-align:center;page-break-inside:avoid}.signature span{font-size:8px;color:#64748b}.signature-img{height:20mm;display:flex;align-items:center;justify-content:center}.signature-img img{max-width:42mm;max-height:18mm;object-fit:contain}.signature b{display:block;border-top:1px solid #94a3b8;padding-top:2mm;font-size:9px}
        footer{position:absolute;left:12mm;right:12mm;bottom:8mm;border-top:1px solid #e8edf2;padding-top:2mm;font-size:6.5px;color:#94a3b8;text-align:right}
        @media(max-width:900px){.report-shell{display:block;padding:8px}.page{transform-origin:top left;width:100%;min-width:0;height:auto;min-height:297mm;margin-bottom:14px;padding:18px}.student-grid,.two-col{grid-template-columns:1fr}.metric-grid{grid-template-columns:1fr 1fr}.page footer{position:static;margin-top:18px}}
        @media print{@page{size:A4 portrait;margin:0}.toolbar{display:none}.report-shell{display:block;padding:0}.page{width:210mm;min-width:210mm;height:297mm;box-shadow:none;margin:0;page-break-after:always}.page:last-child{page-break-after:auto}}
      </style></head><body>
      <div class="toolbar"><button class="print" onclick="window.print()">🖨 Cetak / Simpan PDF</button><button class="close" onclick="window.close()">Tutup</button></div>
      <main class="report-shell">${page1}${page2}</main>
      </body></html>`;

      reportWindow.document.open();
      reportWindow.document.write(report);
      reportWindow.document.close();
    }

    function applyJadwalFilters() {
      renderTabelJadwal();
      if(calendarInstance) renderCalendarEvents();
    }

    function toggleMobileTableRow(event, row) {
      if (window.innerWidth > 768 || !row) return;
      if (event && event.target && event.target.closest('button,a,input,select,textarea')) return;
      const expanded = row.classList.toggle('mobile-expanded');
      row.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function handleDashboardScheduleClick(event, item, jadwalID) {
      if (window.innerWidth <= 768) {
        if (event && event.target && event.target.closest('button,a,input,select,textarea')) return;
        const expanded = item.classList.toggle('mobile-expanded');
        item.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        return;
      }
      openEditJadwalModal(jadwalID);
    }

    function initializeStudentReports() {
      const monthInput = document.getElementById('studentReportMonth');
      if (!monthInput) return;
      if (!monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      initializeStudentReportFilters();
      renderStudentReports();
    }

    function initializeStudentReportFilters() {
      const guruSelect = document.getElementById('studentReportGuru');
      const instrumenSelect = document.getElementById('studentReportInstrumen');
      if (!guruSelect || !instrumenSelect) return;
      const selectedGuru = guruSelect.value;
      const selectedInstrumen = instrumenSelect.value;
      const allClasses = globalSiswaList.flatMap(item => getStudentClassesForUI(item));
      const guruNames = [...new Set(allClasses.map(item => String(item.guru || '').trim()).filter(name => name && name !== '-'))].sort((a,b) => a.localeCompare(b, 'id'));
      const instruments = [...new Set(allClasses.map(item => String(item.instrumen || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'id'));
      guruSelect.innerHTML = '<option value="">Semua Guru</option>' + guruNames.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
      instrumenSelect.innerHTML = '<option value="">Semua Instrumen</option>' + instruments.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
      guruSelect.value = guruNames.includes(selectedGuru) ? selectedGuru : '';
      instrumenSelect.value = instruments.includes(selectedInstrumen) ? selectedInstrumen : '';
    }

    function getStudentReportFilters() {
      return {
        guru: String(document.getElementById('studentReportGuru')?.value || '').trim().toLowerCase(),
        instrumen: String(document.getElementById('studentReportInstrumen')?.value || '').trim().toLowerCase()
      };
    }

    function matchesStudentReportFilters(item) {
      const filters = getStudentReportFilters();
      return studentHasClassValue(item, 'guru', filters.guru) && studentHasClassValue(item, 'instrumen', filters.instrumen);
    }

    function getFilteredStudentReportStudents() {
      return globalSiswaList.filter(matchesStudentReportFilters);
    }

    function getStudentReportFilterLabel() {
      const guru = document.getElementById('studentReportGuru')?.selectedOptions?.[0]?.textContent || 'Semua Guru';
      const instrumen = document.getElementById('studentReportInstrumen')?.selectedOptions?.[0]?.textContent || 'Semua Instrumen';
      return `${guru} • ${instrumen}`;
    }

    function parseStudentReportDate(value) {
      const text = String(value || '').trim();
      let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
      if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      return null;
    }

    function getStudentReportRange() {
      const monthValue = document.getElementById('studentReportMonth')?.value || '';
      const count = Math.max(1, Number(document.getElementById('studentReportPeriod')?.value || 1));
      const now = new Date();
      const parts = monthValue.match(/^(\d{4})-(\d{2})$/);
      const endMonth = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
      const start = new Date(endMonth.getFullYear(), endMonth.getMonth() - count + 1, 1);
      const end = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 1);
      const months = [];
      const names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
      const longNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      for (let i = 0; i < count; i++) {
        const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
        months.push({ key:`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label:`${names[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`, fullLabel:`${longNames[date.getMonth()]} ${date.getFullYear()}` });
      }
      const startLabel = `${longNames[start.getMonth()]} ${start.getFullYear()}`;
      const last = new Date(end.getFullYear(), end.getMonth() - 1, 1);
      const endLabel = `${longNames[last.getMonth()]} ${last.getFullYear()}`;
      return { start, end, months, label:count === 1 ? startLabel : `${startLabel} – ${endLabel}` };
    }

    function getStudentMovementsInRange() {
      const range = getStudentReportRange();
      return globalStudentHistory.filter(item => {
        const date = parseStudentReportDate(item.tanggal);
        return date && date >= range.start && date < range.end && matchesStudentReportFilters(item);
      });
    }

    function setStudentReportView(view) {
      studentReportView = view;
      document.querySelectorAll('[data-student-report-tab]').forEach(button => button.classList.toggle('active', button.dataset.studentReportTab === view));
      renderStudentReportTable();
    }

    function renderStudentReports() {
      if (currentUser.userType !== 'admin' || !document.getElementById('studentReportAdminBox')) return;
      const range = getStudentReportRange();
      const movements = getStudentMovementsInRange();
      const masuk = movements.filter(item => String(item.jenis).toLowerCase() === 'masuk').length;
      const keluar = movements.filter(item => String(item.jenis).toLowerCase() === 'keluar').length;
      const net = masuk - keluar;
      const filteredStudents = getFilteredStudentReportStudents();
      document.getElementById('studentReportPeriodLabel').textContent = `Periode: ${range.label} • ${getStudentReportFilterLabel()}`;
      document.getElementById('studentStatIn').textContent = masuk;
      document.getElementById('studentStatOut').textContent = keluar;
      document.getElementById('studentStatNet').textContent = net > 0 ? `+${net}` : String(net);
      document.getElementById('studentStatActive').textContent = filteredStudents.filter(item => String(item.status).toLowerCase() === 'aktif').length;

      const monthly = range.months.map(month => ({
        ...month,
        masuk: movements.filter(item => String(item.jenis).toLowerCase() === 'masuk' && String(item.tanggal || '').slice(0,7) === month.key).length,
        keluar: movements.filter(item => String(item.jenis).toLowerCase() === 'keluar' && String(item.tanggal || '').slice(0,7) === month.key).length
      }));
      const maxValue = Math.max(1, ...monthly.flatMap(item => [item.masuk, item.keluar]));
      document.getElementById('studentTrendChart').innerHTML = monthly.map(item => `<div class="student-trend-month"><div class="student-trend-bars"><div class="student-trend-bar in" style="height:${Math.max(item.masuk ? 8 : 3, (item.masuk / maxValue) * 92)}px"><span>${item.masuk}</span></div><div class="student-trend-bar out" style="height:${Math.max(item.keluar ? 8 : 3, (item.keluar / maxValue) * 92)}px"><span>${item.keluar}</span></div></div><div class="student-trend-label">${item.label}</div></div>`).join('');
      renderStudentReportTable();
    }

    function renderStudentReportTable() {
      const head = document.getElementById('studentReportTableHead');
      const body = document.getElementById('studentReportTableBody');
      if (!head || !body) return;
      if (studentReportView === 'all') {
        const filteredStudents = getFilteredStudentReportStudents();
        head.innerHTML = '<tr><th>No</th><th>Nama Siswa</th><th>Tanggal Masuk</th><th>Instrumen</th><th>Guru</th><th>Grade</th><th>Status</th><th>Tanggal Keluar</th></tr>';
        body.innerHTML = filteredStudents.length ? filteredStudents.map((item, index) => `<tr class="student-report-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false"><td class="student-report-no" data-label="No">${index + 1}</td><td class="student-report-name" data-label="Nama Siswa"><b>${escapeTaskHtml(item.nama || '-')}</b></td><td data-label="Tanggal Masuk">${escapeTaskHtml(formatAcademyDate(item.tglDaftar))}</td><td class="student-report-instrument" data-label="Instrumen">${escapeTaskHtml(item.instrumen || '-')}</td><td data-label="Guru">${escapeTaskHtml(item.guru || '-')}</td><td data-label="Grade">${escapeTaskHtml(item.kelas || '-')}</td><td class="student-report-status" data-label="Status"><span class="badge ${String(item.status).toLowerCase() === 'keluar' ? 'badge-danger' : (String(item.status).toLowerCase() === 'cuti' ? 'badge-warning' : 'badge-success')}">${escapeTaskHtml(item.status || '-')}</span><span class="student-report-chevron">⌄</span></td><td data-label="Tanggal Keluar">${escapeTaskHtml(formatAcademyDate(item.tglKeluar))}</td></tr>`).join('') : '<tr><td class="student-report-empty" colspan="8">Tidak ada siswa yang sesuai dengan filter.</td></tr>';
        return;
      }

      const records = getStudentMovementsInRange().filter(item => String(item.jenis).toLowerCase() === studentReportView.toLowerCase());
      const isExitView = studentReportView.toLowerCase() === 'keluar';
      head.innerHTML = '<tr><th>No</th><th>Tanggal</th><th>Nama Siswa</th><th>Jenis</th><th>Instrumen</th><th>Guru</th><th>Status</th><th>Keterangan</th>' + (isExitView ? '<th>Aksi</th>' : '') + '</tr>';
      body.innerHTML = records.length ? records.map((item, index) => {
        const statusLabel = item.statusSesudah || (String(item.jenis).toLowerCase() === 'keluar' ? 'Keluar' : 'Aktif');
        const statusClass = String(statusLabel).toLowerCase() === 'keluar' ? 'badge-danger' : (String(statusLabel).toLowerCase() === 'cuti' ? 'badge-warning' : 'badge-success');
        const deleteAction = isExitView ? `<td data-label="Aksi"><button type="button" class="btn" style="padding:7px 10px;background:#fee2e2;color:#b91c1c;" onclick="event.stopPropagation();deleteExitedStudentRecord(decodeURIComponent('${encodeURIComponent(item.siswaID || item.nama || '')}'),decodeURIComponent('${encodeURIComponent(item.nama || '')}'))">Hapus Data</button></td>` : '';
        return `<tr class="student-report-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false"><td class="student-report-no" data-label="No">${index + 1}</td><td data-label="Tanggal">${escapeTaskHtml(formatAcademyDate(item.tanggal))}</td><td class="student-report-name" data-label="Nama Siswa"><b>${escapeTaskHtml(item.nama || '-')}</b></td><td data-label="Jenis"><span class="badge ${String(item.jenis).toLowerCase() === 'keluar' ? 'badge-danger' : 'badge-success'}">${escapeTaskHtml(item.jenis)}</span></td><td class="student-report-instrument" data-label="Instrumen">${escapeTaskHtml(item.instrumen || '-')}</td><td data-label="Guru">${escapeTaskHtml(item.guru || '-')}</td><td class="student-report-status" data-label="Status"><span class="badge ${statusClass}">${escapeTaskHtml(statusLabel)}</span><span class="student-report-chevron">⌄</span></td><td data-label="Keterangan">${escapeTaskHtml(item.keterangan || '-')}</td>${deleteAction}</tr>`;
      }).join('') : `<tr><td class="student-report-empty" colspan="${isExitView ? 9 : 8}">Tidak ada data ${escapeTaskHtml(studentReportView.toLowerCase())} pada periode ini.</td></tr>`;
    }

    function printStudentReport(mode) {
      if (currentUser.userType !== 'admin') return;
      const printWindow = window.open('', '_blank', 'width=1100,height=760');
      if (!printWindow) { showAlert('alertDanger', 'Popup diblokir. Izinkan popup untuk mencetak laporan.'); return; }
      printWindow.document.write('<!doctype html><html><body style="font-family:Arial;padding:32px;color:#64748b">Menyiapkan laporan siswa...</body></html>');
      google.script.run.withSuccessHandler(response => buildStudentReportPrint(mode, printWindow, response && response.success ? response.dataUrl : '')).withFailureHandler(() => buildStudentReportPrint(mode, printWindow, '')).getLearningProgressPrintLogo();
    }

    function buildStudentReportPrint(mode, printWindow, logoDataUrl) {
      const range = getStudentReportRange();
      const movements = getStudentMovementsInRange();
      const filteredStudents = getFilteredStudentReportStudents();
      const masuk = movements.filter(item => String(item.jenis).toLowerCase() === 'masuk');
      const keluar = movements.filter(item => String(item.jenis).toLowerCase() === 'keluar');
      const active = filteredStudents.filter(item => String(item.status).toLowerCase() === 'aktif').length;
      const monthlyStats = range.months.map(month => ({
        ...month,
        masuk: movements.filter(item => String(item.jenis).toLowerCase() === 'masuk' && String(item.tanggal || '').slice(0,7) === month.key).length,
        keluar: movements.filter(item => String(item.jenis).toLowerCase() === 'keluar' && String(item.tanggal || '').slice(0,7) === month.key).length
      }));
      const chartMax = Math.max(1, ...monthlyStats.flatMap(item => [item.masuk, item.keluar]));
      const chartHtml = `<div class="print-chart"><div class="print-chart-legend"><span><i class="in"></i>Siswa Masuk</span><span><i class="out"></i>Siswa Keluar</span></div><div class="print-chart-bars">${monthlyStats.map(item => `<div class="print-chart-month"><div class="print-chart-values"><div class="print-chart-bar in" style="height:${Math.max(item.masuk ? 12 : 3, (item.masuk / chartMax) * 112)}px"><b>${item.masuk}</b></div><div class="print-chart-bar out" style="height:${Math.max(item.keluar ? 12 : 3, (item.keluar / chartMax) * 112)}px"><b>${item.keluar}</b></div></div><span>${escapeTaskHtml(item.label)}</span></div>`).join('')}</div></div>`;
      const row = values => `<tr>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
      let title = 'Laporan Semua Data Siswa';
      let content = '';

      if (mode === 'all') {
        const rows = filteredStudents.map((item, index) => row([index + 1, `<b>${escapeTaskHtml(item.nama || '-')}</b>`, escapeTaskHtml(formatAcademyDate(item.tglDaftar)), escapeTaskHtml(item.instrumen || '-'), escapeTaskHtml(item.guru || '-'), escapeTaskHtml(item.kelas || '-'), escapeTaskHtml(item.email || '-'), escapeTaskHtml(item.noHp || '-'), escapeTaskHtml(item.status || '-'), escapeTaskHtml(formatAcademyDate(item.tglKeluar))])).join('');
        content = `<div class="summary"><span>Total Siswa <b>${filteredStudents.length}</b></span><span>Aktif <b>${active}</b></span><span>Keluar <b>${filteredStudents.filter(item => String(item.status).toLowerCase() === 'keluar').length}</b></span></div><table><thead><tr><th>No</th><th>Nama</th><th>Tgl Masuk</th><th>Instrumen</th><th>Guru</th><th>Grade</th><th>Email</th><th>No. HP</th><th>Status</th><th>Tgl Keluar</th></tr></thead><tbody>${rows || '<tr><td colspan="10">Belum ada data.</td></tr>'}</tbody></table>`;
      } else {
        title = 'Laporan Statistik Siswa';
        const monthRows = monthlyStats.map((month, index) => row([index + 1, month.fullLabel, month.masuk, month.keluar])).join('');
        const movementRows = movements.map((item, index) => row([index + 1, escapeTaskHtml(formatAcademyDate(item.tanggal)), `<b>${escapeTaskHtml(item.nama || '-')}</b>`, escapeTaskHtml(item.jenis || '-'), escapeTaskHtml(item.instrumen || '-'), escapeTaskHtml(item.guru || '-'), escapeTaskHtml(item.keterangan || '-')])).join('');
        content = `<div class="summary"><span>Siswa Masuk <b>${masuk.length}</b></span><span>Siswa Keluar <b>${keluar.length}</b></span><span>Pertumbuhan Bersih <b>${masuk.length - keluar.length >= 0 ? '+' : ''}${masuk.length - keluar.length}</b></span><span>Total Aktif <b>${active}</b></span></div><h2>Grafik Statistik Periode</h2>${chartHtml}<h2>Ringkasan Bulanan</h2><table class="small"><thead><tr><th>No</th><th>Bulan</th><th>Masuk</th><th>Keluar</th></tr></thead><tbody>${monthRows}</tbody></table><h2>Data Siswa Masuk & Keluar</h2><table><thead><tr><th>No</th><th>Tanggal</th><th>Nama</th><th>Jenis</th><th>Instrumen</th><th>Guru</th><th>Keterangan</th></tr></thead><tbody>${movementRows || '<tr><td colspan="7">Tidak ada pergerakan siswa pada periode ini.</td></tr>'}</tbody></table>`;
      }

      const report = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;box-sizing:border-box}@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#17232d;margin:0;font-size:8.5px}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f15a24;padding-bottom:8px;margin-bottom:10px;min-height:66px}.brand-logo{width:118px;height:64px;object-fit:contain;object-position:left center}.brand h1{font-size:18px;margin:0 0 4px}.orange{color:#f15a24}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:9px}.meta div,.summary{background:#fff7f2;border:1px solid #fed9c6;border-radius:7px;padding:7px}.meta span{display:block;color:#7b8aa0;font-size:7px;text-transform:uppercase;margin-bottom:2px}.summary{display:flex;gap:24px;align-items:center;margin-bottom:10px}.summary b{color:#f15a24;font-size:15px;margin-left:4px}h2{font-size:11px;color:#f15a24;margin:12px 0 6px}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:8px}table.small{width:55%}th{background:#f15a24;color:#fff;padding:6px 4px;text-align:left;font-size:7.5px}td{border:1px solid #dfe6ee;padding:5px 4px;vertical-align:top;line-height:1.3;word-wrap:break-word}tr{page-break-inside:avoid}.print-chart{border:1px solid #fed9c6;border-radius:8px;padding:9px 12px 7px;background:#fffaf7;page-break-inside:avoid}.print-chart-legend{display:flex;justify-content:flex-end;gap:16px;margin-bottom:4px;font-size:7px}.print-chart-legend span{display:flex;align-items:center;gap:4px}.print-chart-legend i{width:8px;height:8px;border-radius:2px}.print-chart-legend .in,.print-chart-bar.in{background:#f15a24}.print-chart-legend .out,.print-chart-bar.out{background:#ef4444}.print-chart-bars{height:148px;display:flex;align-items:flex-end;justify-content:space-around;gap:8px;border-bottom:1px solid #cbd5e1;padding:0 8px}.print-chart-month{height:142px;min-width:46px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}.print-chart-values{height:116px;display:flex;align-items:flex-end;gap:4px}.print-chart-bar{width:15px;min-height:3px;border-radius:3px 3px 0 0;position:relative}.print-chart-bar b{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:7px;color:#475569}.print-chart-month>span{font-size:7px;font-weight:700;color:#64748b;margin-top:4px;white-space:nowrap}.footer{margin-top:9px;padding-top:6px;border-top:1px solid #e8edf2;color:#94a3b8;font-size:7px;text-align:right}</style></head><body><div class="brand"><div>${logoDataUrl ? `<img class="brand-logo" src="${logoDataUrl}" alt="Legacy Music Center">` : '<b class="orange">LEGACY MUSIC CENTER</b>'}</div><div style="text-align:right"><h1>${title}</h1><b class="orange">Administrasi Siswa</b></div></div><div class="meta"><div><span>Periode</span><b>${mode === 'all' ? 'Semua Data' : escapeTaskHtml(range.label)}</b></div><div><span>Filter</span><b>${escapeTaskHtml(getStudentReportFilterLabel())}</b></div><div><span>Tanggal Cetak</span><b>${new Date().toLocaleDateString('id-ID')}</b></div><div><span>Dicetak Oleh</span><b>${escapeTaskHtml(currentUser.userName || 'Admin')}</b></div></div>${content}<div class="footer">Dokumen resmi Legacy Music Center • Laporan Administrasi Siswa</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),650));<\/script></body></html>`;
      printWindow.document.open(); printWindow.document.write(report); printWindow.document.close();
    }


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


    function escapeTaskHtml(value) {
      return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function parseTaskDate(value) {
      if (!value) return null;
      const text = String(value).trim();
      const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 23, 59, 59);
      const id = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (id) return new Date(Number(id[3]), Number(id[2]) - 1, Number(id[1]), 23, 59, 59);
      const parsed = new Date(text);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    function isTaskLate(task) {
      const deadline = parseTaskDate(task.deadline);
      return task.status !== 'Selesai' && deadline && deadline.getTime() < Date.now();
    }

    function taskTypeIcon(type) {
      const value = String(type || '').toLowerCase();
      if (value.includes('audio')) return '🎧';
      if (value.includes('video')) return '🎬';
      if (value.includes('tulis')) return '✍️';
      return '📎';
    }

    function renderTaskAttachment(file) {
      if (!file || !file.url) return '';
      const name = escapeTaskHtml(file.name || 'File lampiran');
      const url = escapeTaskHtml(file.url);
      const previewUrl = escapeTaskHtml(file.previewUrl || file.url);
      const downloadUrl = escapeTaskHtml(file.downloadUrl || file.url);
      const type = String(file.type || '').toLowerCase();
      const rawName = String(file.name || '').toLowerCase();
      const isAudio = type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/.test(rawName);
      const isVideo = type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/.test(rawName);
      const isImage = type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|heic)$/.test(rawName);
      let preview = '';
      if (isAudio) {
        preview = `<iframe class="attachment-preview-frame" src="${previewUrl}" allow="autoplay" title="Putar ${name}"></iframe>`;
      } else if (isVideo) {
        preview = `<iframe class="attachment-preview-frame video" src="${previewUrl}" allow="autoplay; fullscreen" allowfullscreen title="Putar ${name}"></iframe>`;
      } else if (isImage) {
        preview = `<img class="attachment-image" loading="lazy" src="${downloadUrl}" alt="${name}">`;
      }
      return `<div class="attachment-box">
        <div class="attachment-head">
          <div class="attachment-name">${name}</div>
          <div class="attachment-actions">
            <a class="attachment-link" href="${url}" target="_blank" rel="noopener">Buka</a>
            <a class="attachment-link" href="${downloadUrl}" target="_blank" rel="noopener" download>Download</a>
          </div>
        </div>${preview}
      </div>`;
    }

/* ---- preserved block boundary ---- */

function getYouTubeVideoId(value) {
      try {
        const url = new URL(String(value || '').trim());
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
        const host = url.hostname.toLowerCase();
        const parts = url.pathname.split('/');
        let id = '';
        if (host === 'youtu.be') id = parts[1];
        else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
          if (parts[1] === 'watch') id = url.searchParams.get('v');
          else if (['embed', 'shorts', 'live'].includes(parts[1])) id = parts[2];
        }
        return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : '';
      } catch (error) { return ''; }
    }

    function getTaskYouTubeId(task) {
      const directId = task && task.youtube && task.youtube.videoId ? task.youtube.videoId : (task.youtubeVideoId || '');
      if (/^[a-zA-Z0-9_-]{11}$/.test(directId)) return directId;
      const attachments = Array.isArray(task.materialAttachments) ? task.materialAttachments : [];
      const youtubeAttachment = attachments.find(file => file && (file.kind === 'youtube' || file.type === 'video/youtube'));
      return getYouTubeVideoId(task.youtubeUrl || task.YouTubeUrl || (youtubeAttachment && youtubeAttachment.url) || task.deskripsi || '');
    }

    function renderTaskYouTubeCompact(task) {
      const videoId = getTaskYouTubeId(task);
      if (!videoId) return '';
      return `<button type="button" class="task-youtube-compact" data-video-id="${videoId}" onclick="event.stopPropagation();openTaskYouTubeModal('${escapeTaskHtml(task.tugasID)}')"><img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="Thumbnail video YouTube" onerror="this.style.display='none'"><span><strong>▶ Video YouTube</strong><small>Klik untuk membuka dan memutar</small></span></button>`;
    }

    function renderCreateTaskYouTubePreview() {
      const input = document.getElementById('tugasYoutubeUrl');
      const target = document.getElementById('tugasYoutubePreview');
      if (!input || !target) return;
      const videoId = getYouTubeVideoId(input.value);
      target.innerHTML = videoId ? `<div class="task-youtube"><div class="task-youtube-preview"><img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="Preview video YouTube"><span>✓ Link video terbaca</span></div></div>` : '';
    }

    function renderTaskYouTube(task) {
      const videoId = getTaskYouTubeId(task);
      if (!videoId) return '';
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      return `<div class="task-detail-section"><div class="task-detail-section-title">Video YouTube</div><div class="task-youtube"><button type="button" class="task-youtube-preview" data-video-id="${videoId}" onclick="playTaskYouTube(this)"><img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="Preview video YouTube"><span>▶ Putar Video</span></button></div><div style="margin-top:10px;"><a class="attachment-link" href="${watchUrl}" target="_blank" rel="noopener noreferrer">Buka di YouTube ↗</a></div><div class="task-help">Jika pemutar menampilkan error atau video dibatasi, gunakan Buka di YouTube.</div></div>`;
    }

    function playTaskYouTube(button) {
      const id = button.getAttribute('data-video-id');
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '')) return;
      const frame = document.createElement('iframe');
      frame.className = 'task-youtube-frame';
      frame.title = 'Video materi YouTube';
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1';
      frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      button.parentNode.replaceChild(frame, button);
    }

    function openTaskYouTubeModal(tugasID) {
      openTaskDetailModal(tugasID);
      const playButton = document.querySelector('#taskDetailBody .task-youtube-preview');
      if (playButton) playTaskYouTube(playButton);
    }

/* ---- preserved block boundary ---- */

function normalizeTaskStatus(task) {
      if (String(task.status || '').toLowerCase() === 'selesai') return { className:'done', text:'Sudah dikumpulkan' };
      if (isTaskLate(task)) return { className:'late', text:'Melewati deadline' };
      return { className:'open', text:'Belum dikerjakan' };
    }

    function taskCoverClass(type) {
      const value = String(type || '').toLowerCase();
      if (value.includes('audio')) return 'audio';
      if (value.includes('tulis')) return 'tulis';
      if (value.includes('video')) return 'video';
      return 'campuran';
    }

    function formatTaskDateLabel(value) {
      const date = parseTaskDate(value);
      if (!date) return value || '-';
      return date.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    }

    function getTaskDeadlineHint(task) {
      const deadline = parseTaskDate(task.deadline);
      if (!deadline) return { text:'Tanpa tenggat', className:'ok' };
      if (String(task.status || '').toLowerCase() === 'selesai') return { text:'Sudah selesai', className:'ok' };
      const today = new Date();
      today.setHours(23,59,59,999);
      const dayDiff = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
      if (dayDiff < 0) return { text:`Terlambat ${Math.abs(dayDiff)} hari`, className:'late' };
      if (dayDiff === 0) return { text:'Hari ini', className:'late' };
      return { text:`${dayDiff} hari lagi`, className:'ok' };
    }

    function setTaskStatusFilter(value, button) {
      const input = document.getElementById('taskStatusFilter');
      if (input) input.value = value;
      document.querySelectorAll('.task-status-tab').forEach(item => item.classList.toggle('active', item === button));
      renderTabelTugas();
    }

    function updateTaskStudentFilter() {
      const select = document.getElementById('taskStudentFilter');
      if (!select) return;
      if (currentUser.userType === 'siswa') {
        select.style.display = 'none';
        select.value = 'semua';
        return;
      }
      select.style.display = '';
      const selected = select.value || 'semua';
      const names = [...new Set(globalTugasList.map(task => String(task.namaSiswa || '').trim()).filter(Boolean))]
        .sort((a,b) => a.localeCompare(b, 'id'));
      select.innerHTML = '<option value="semua">Semua siswa</option>' + names.map(name => `<option value="${escapeTaskHtml(name)}">${escapeTaskHtml(name)}</option>`).join('');
      select.value = names.includes(selected) ? selected : 'semua';
    }

    function renderTabelTugas() {
      const container = document.getElementById('tugasTableBody');
      if(!container) return;

      const total = globalTugasList.length;
      const done = globalTugasList.filter(t => String(t.status || '').toLowerCase() === 'selesai').length;
      const late = globalTugasList.filter(isTaskLate).length;
      document.getElementById('taskStatTotal').textContent = total;
      document.getElementById('taskStatOpen').textContent = total - done;
      document.getElementById('taskStatDone').textContent = done;
      document.getElementById('taskStatLate').textContent = late;
      document.getElementById('taskStatDoneHint').textContent = `${total ? Math.round((done / total) * 100) : 0}% selesai`;
      document.getElementById('taskPageSubtitle').textContent = currentUser.userType === 'siswa'
        ? 'Baca instruksi, putar materi, lalu kirim jawaban tertulis atau rekaman latihanmu.'
        : 'Kelola dan pantau tugas siswa. Kirim instruksi, lampiran, dan lihat hasil latihan mereka.';

      updateTaskStudentFilter();
      const taskSearchInput = document.getElementById('taskSearchInput');
      if (taskSearchInput) taskSearchInput.placeholder = currentUser.userType === 'siswa' ? 'Cari judul tugas...' : 'Cari judul tugas atau nama siswa...';

      const search = String(taskSearchInput?.value || '').trim().toLowerCase();
      const filter = document.getElementById('taskStatusFilter')?.value || 'semua';
      const student = document.getElementById('taskStudentFilter')?.value || 'semua';
      const sort = document.getElementById('taskSortFilter')?.value || 'terbaru';
      let filtered = globalTugasList.filter(task => {
        const haystack = `${task.judulTugas || ''} ${task.namaSiswa || ''} ${task.deskripsi || ''}`.toLowerCase();
        const isDone = String(task.status || '').toLowerCase() === 'selesai';
        const statusMatch = filter === 'semua' || (filter === 'Terlambat' ? isTaskLate(task) : (filter === 'Selesai' ? isDone : !isDone && !isTaskLate(task)));
        const studentMatch = student === 'semua' || String(task.namaSiswa || '') === student;
        return (!search || haystack.includes(search)) && statusMatch && studentMatch;
      });

      filtered = filtered.slice().sort((a,b) => {
        if (sort === 'nama') return String(a.namaSiswa || '').localeCompare(String(b.namaSiswa || ''), 'id');
        if (sort === 'deadline') return (parseTaskDate(a.deadline)?.getTime() || Number.MAX_SAFE_INTEGER) - (parseTaskDate(b.deadline)?.getTime() || Number.MAX_SAFE_INTEGER);
        return (parseTaskDate(b.tanggalDibuat)?.getTime() || 0) - (parseTaskDate(a.tanggalDibuat)?.getTime() || 0);
      });

      const summary = document.getElementById('taskListSummary');
      if (summary) summary.textContent = `Menampilkan ${filtered.length} dari ${total} tugas`;
      if (filtered.length === 0) {
        container.innerHTML = `<div class="task-empty"><strong>Belum ada tugas yang ditampilkan</strong><span>Coba ubah pencarian, nama siswa, atau filter status.</span></div>`;
        return;
      }

      const isSiswa = currentUser.userType === 'siswa';
      container.innerHTML = filtered.map(t => {
        const status = normalizeTaskStatus(t);
        const deadlineHint = getTaskDeadlineHint(t);
        const studentData = globalSiswaList.find(s => String(s.nama || '').trim().toLowerCase() === String(t.namaSiswa || '').trim().toLowerCase()) || {};
        const classLabel = [studentData.instrumen, studentData.kelas].filter(Boolean).join(' • ') || 'Kelas musik';
        return `<article class="task-card">
          <div class="task-cover ${taskCoverClass(t.tipeTugas)}">
            <div class="task-cover-icon">${taskTypeIcon(t.tipeTugas)}</div>
            <div class="task-cover-label">${escapeTaskHtml(t.tipeTugas || 'Campuran')}</div>
          </div>
          <div class="task-main">
            <div class="task-card-top">
              <span class="task-type">${taskTypeIcon(t.tipeTugas)} ${escapeTaskHtml(t.tipeTugas || 'Campuran')}</span>
              <h3 title="${escapeTaskHtml(t.judulTugas)}">${escapeTaskHtml(t.judulTugas)}</h3>
              ${t.deskripsi ? `<div class="task-description">${escapeTaskHtml(t.deskripsi)}</div>` : '<div class="task-description">Tidak ada deskripsi tambahan.</div>'}
              <div class="task-meta"><span>Siswa: <b>${escapeTaskHtml(t.namaSiswa)}</b></span><span>${escapeTaskHtml(classLabel)}</span></div>
              ${typeof renderTaskYouTubeCompact === 'function' ? renderTaskYouTubeCompact(t) : ''}
            </div>
          </div>
          <div class="task-deadline"><span class="task-deadline-label">Deadline</span><strong>${escapeTaskHtml(formatTaskDateLabel(t.deadline))}</strong><small class="${deadlineHint.className}">${escapeTaskHtml(deadlineHint.text)}</small></div>
          <div class="task-card-side">
            <span class="task-status ${status.className}">${status.text}</span>
            <div class="task-card-actions"><button type="button" class="task-detail-btn" onclick="openTaskDetailModal('${escapeTaskHtml(t.tugasID)}')">Lihat Detail&nbsp; →</button></div>
          </div>
        </article>`;
      }).join('');
    }

    function openTaskDetailModal(tugasID) {
      const task = globalTugasList.find(item => String(item.tugasID) === String(tugasID));
      if (!task) return;
      const modal = document.getElementById('modalDetailTugas');
      const body = document.getElementById('taskDetailBody');
      const footer = document.getElementById('taskDetailFooter');
      const status = normalizeTaskStatus(task);
      const materials = Array.isArray(task.materialAttachments) ? task.materialAttachments : [];
      const answers = Array.isArray(task.answerAttachments) ? task.answerAttachments : [];
      const answerAvailable = Boolean(task.jawabanTeks || answers.length);
      body.innerHTML = `<div class="task-detail-heading">
        <div><span class="task-type">${taskTypeIcon(task.tipeTugas)} ${escapeTaskHtml(task.tipeTugas || 'Campuran')}</span><h3>${escapeTaskHtml(task.judulTugas)}</h3></div>
        <span class="task-status ${status.className}">${status.text}</span>
      </div>
      <div class="task-detail-grid">
        <div class="task-detail-info"><span>Nama siswa</span><strong>${escapeTaskHtml(task.namaSiswa || '-')}</strong></div>
        <div class="task-detail-info"><span>Deadline</span><strong>${escapeTaskHtml(formatTaskDateLabel(task.deadline))}</strong></div>
        <div class="task-detail-info"><span>Tanggal dibuat</span><strong>${escapeTaskHtml(formatTaskDateLabel(task.tanggalDibuat))}</strong></div>
      </div>
      <div class="task-detail-section"><div class="task-detail-section-title">Instruksi Tugas</div><div class="task-detail-description">${escapeTaskHtml(task.deskripsi || 'Tidak ada instruksi tambahan.')}</div></div>
      ${typeof renderTaskYouTube === 'function' ? renderTaskYouTube(task) : ''}
      <div class="task-detail-section"><div class="task-detail-section-title">Lampiran Materi (${materials.length})</div>${materials.length ? `<div class="task-attachments">${materials.map(renderTaskAttachment).join('')}</div>` : '<div class="task-detail-empty">Tidak ada lampiran materi.</div>'}</div>
      <div class="task-detail-section"><div class="task-detail-section-title">Jawaban Siswa ${task.tanggalKirimSiswa ? `• ${escapeTaskHtml(formatTaskDateLabel(task.tanggalKirimSiswa))}` : ''}</div>
        ${answerAvailable ? `${task.jawabanTeks ? `<div class="task-answer-text">${escapeTaskHtml(task.jawabanTeks)}</div>` : ''}${answers.length ? `<div class="task-attachments">${answers.map(renderTaskAttachment).join('')}</div>` : ''}` : '<div class="task-detail-empty">Siswa belum mengirim jawaban.</div>'}
      </div>`;

      const isSiswa = currentUser.userType === 'siswa';
      if (isSiswa && String(task.status || '').toLowerCase() !== 'selesai') {
        footer.innerHTML = `<button type="button" class="btn" onclick="closeTaskDetailModal()">Tutup</button><button type="button" class="btn btn-primary" onclick="closeTaskDetailModal();openKerjakanModal('${escapeTaskHtml(task.tugasID)}')">Kerjakan & Kumpulkan</button>`;
      } else if (!isSiswa) {
        footer.innerHTML = `<button type="button" class="btn" onclick="closeTaskDetailModal()">Tutup</button><button type="button" class="btn-action btn-delete" onclick="closeTaskDetailModal();handleDeleteTugas('${escapeTaskHtml(task.tugasID)}')">Hapus Tugas</button>`;
      } else {
        footer.innerHTML = '<button type="button" class="btn btn-primary" onclick="closeTaskDetailModal()">Selesai</button>';
      }
      modal.style.display = 'flex';
    }

    function closeTaskDetailModal() {
      const modal = document.getElementById('modalDetailTugas');
      if (modal) modal.style.display = 'none';
      document.querySelectorAll('#taskDetailBody .task-youtube iframe').forEach(frame => frame.remove());
    }

    function handleTaskDetailBackdrop(event) {
      if (event.target && event.target.id === 'modalDetailTugas') closeTaskDetailModal();
    }

    function toggleCreateTaskForm(forceState) {
      const box = document.getElementById('formCreateTugasBox');
      const shouldOpen = typeof forceState === 'boolean' ? forceState : box.style.display === 'none';
      box.style.display = shouldOpen ? 'block' : 'none';
      if (shouldOpen) box.scrollIntoView({ behavior:'smooth', block:'start' });
    }

    function renderSelectedTaskFiles(input, targetId) {
      const target = document.getElementById(targetId);
      if (!target) return;
      target.innerHTML = Array.from(input.files || []).map(file => `<span class="task-file-chip">📎 ${escapeTaskHtml(file.name)} (${formatFileSize(file.size)})</span>`).join('');
    }

    function formatFileSize(bytes) {
      if (!bytes) return '0 KB';
      if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function validateTaskFiles(files) {
      if (files.length > 5) return 'Maksimal 5 file dalam satu pengiriman.';
      return '';
    }

    function filesToPayload(files) {
      return Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve({ dataUrl:event.target.result, name:file.name, type:file.type || 'application/octet-stream', size:file.size });
        reader.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
        reader.readAsDataURL(file);
      })));
    }

    function handleCreateTugas(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitTugas');
      btn.disabled = true; btn.textContent = 'Mengirim Tugas...';

      const fileInput = document.getElementById('tugasFileMateri');
      const files = Array.from(fileInput.files || []);
      const fileError = validateTaskFiles(files);
      if (fileError) {
        showAlert('alertDanger', fileError);
        btn.disabled = false; btn.textContent = 'Kirim Tugas ke Siswa';
        return;
      }

      const payload = {
        namaSiswa: document.getElementById('tugasPilihSiswa').value,
        judulTugas: document.getElementById('tugasJudul').value,
        deskripsi: document.getElementById('tugasDeskripsi').value,
        deadline: document.getElementById('tugasDeadline').value,
        tipeTugas: document.getElementById('tugasTipe').value,
        youtubeUrl: document.getElementById('tugasYoutubeUrl').value.trim(),
        guru: currentUser.userName
      };

      filesToPayload(files).then(items => {
        payload.files = items;
        sendTugasToBackend(payload, btn);
      }).catch(error => {
        btn.disabled = false; btn.textContent = 'Kirim Tugas ke Siswa';
        showAlert('alertDanger', error.message);
      });
    }

    function sendTugasToBackend(payload, btn) {
      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Kirim Tugas ke Siswa';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) {
          document.getElementById('formCreateTugas').reset();
          document.getElementById('taskMaterialSelection').innerHTML = '';
          document.getElementById('tugasYoutubePreview').innerHTML = '';
          toggleCreateTaskForm(false);
          fetchDashboardData();
        }
      }).withFailureHandler(error => {
        btn.disabled = false; btn.textContent = 'Kirim Tugas ke Siswa';
        showAlert('alertDanger', 'Gagal mengirim tugas: ' + error.message);
      }).addTugasCombined(payload);
    }

    function openKerjakanModal(tugasID) {
      const task = globalTugasList.find(item => String(item.tugasID) === String(tugasID));
      document.getElementById('modalTugasID').value = tugasID;
      document.getElementById('modalJudulTugas').value = task ? task.judulTugas : '';
      document.getElementById('modalJawabanTeks').value = '';
      document.getElementById('modalFileJawaban').value = '';
      document.getElementById('taskAnswerSelection').innerHTML = '';
      document.getElementById('modalKerjakanTugas').style.display = 'flex';
    }

    function closeKerjakanModal() { document.getElementById('modalKerjakanTugas').style.display = 'none'; }

    function handleSubmitJawabanTugas(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitJawaban');
      btn.disabled = true; btn.textContent = 'Mengunggah...';

      const fileInput = document.getElementById('modalFileJawaban');
      const files = Array.from(fileInput.files || []);
      const tugasID = document.getElementById('modalTugasID').value;
      const jawabanTeks = document.getElementById('modalJawabanTeks').value.trim();

      if (!jawabanTeks && files.length === 0) {
        showAlert('alertDanger', 'Tulis jawaban atau pilih minimal satu file.');
        btn.disabled = false; btn.textContent = 'Kirim Jawaban';
        return;
      }
      const fileError = validateTaskFiles(files);
      if (fileError) {
        showAlert('alertDanger', fileError);
        btn.disabled = false; btn.textContent = 'Kirim Jawaban';
        return;
      }

      filesToPayload(files).then(items => {
        const payload = { tugasID: tugasID, jawabanTeks: jawabanTeks, files: items };
        google.script.run.withSuccessHandler(res => {
          btn.disabled = false; btn.textContent = 'Kirim Jawaban';
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if (res.success) { closeKerjakanModal(); fetchDashboardData(); }
        }).withFailureHandler(error => {
          btn.disabled = false; btn.textContent = 'Kirim Jawaban';
          showAlert('alertDanger', 'Gagal mengunggah jawaban: ' + error.message);
        }).submitTugasJawaban(payload);
      }).catch(error => {
        btn.disabled = false; btn.textContent = 'Kirim Jawaban';
        showAlert('alertDanger', error.message);
      });
    }

    function handleDeleteTugas(id) {
      if(confirm('Apakah Anda yakin ingin menghapus tugas ini?')) {
        google.script.run.withSuccessHandler(res => {
          showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
          if(res.success) fetchDashboardData();
        }).deleteTugas(id);
      }
    }

    const studentInstrumentOptions = ['Gitar','Biola','Vocal','Bass','Piano','Drum','Cello','Saxophone'];
    const studentGradeOptions = ['Beginner','Grade 1','Grade 2','Grade 3','Grade 4','Advanced'];
    const studentDayOptions = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
    const studentRoomOptions = ['R 1','R 2','R 3','R 4','R 5','R 6','R 7','R 8'];


    function classSelectOptions(values, selected) {
      return values.map(value => `<option value="${escapeTaskHtml(value)}" ${String(value) === String(selected || '') ? 'selected' : ''}>${escapeTaskHtml(value)}</option>`).join('');
    }

    function classTeacherOptions(selected) {
      return '<option value="">Pilih Guru...</option>' + (globalGuruList || []).map(g => `<option value="${escapeTaskHtml(g.nama)}" data-guru-id="${escapeTaskHtml(g.id || '')}" ${String(g.nama) === String(selected || '') ? 'selected' : ''}>${escapeTaskHtml(g.nama)} (${escapeTaskHtml(g.instrumen || 'Musik')})</option>`).join('');
    }

    function studentExtraClassTemplate(item, mode) {
      item = item || {};
      const roomValues = studentRoomOptions.slice();
      if (item.ruangan && !roomValues.includes(item.ruangan)) roomValues.push(item.ruangan);
      return `<div class="student-extra-class-row" data-class-id="${escapeTaskHtml(item.kelasSiswaID || '')}" data-schedule-id="${escapeTaskHtml(item.jadwalID || '')}" style="padding:12px;margin:10px 0;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><b style="font-size:13px;color:#f15a24;">Kelas Tambahan</b><button type="button" class="btn-action btn-delete" onclick="this.closest('.student-extra-class-row').remove()">Hapus</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;">
          <div class="form-group" style="margin:0;"><label>Instrumen</label><select class="extra-class-instrument" required>${classSelectOptions(studentInstrumentOptions, item.instrumen || 'Gitar')}</select></div>
          <div class="form-group" style="margin:0;"><label>Guru</label><select class="extra-class-teacher" required>${classTeacherOptions(item.guru || '')}</select></div>
          <div class="form-group" style="margin:0;"><label>Grade</label><select class="extra-class-grade" required>${classSelectOptions(studentGradeOptions, item.grade || 'Beginner')}</select></div>
          <div class="form-group" style="margin:0;"><label>Hari</label><select class="extra-class-day">${classSelectOptions([''].concat(studentDayOptions), item.hari || '')}</select></div>
          <div class="form-group" style="margin:0;"><label>Jam Mulai</label><input class="extra-class-start" type="time" value="${escapeTaskHtml(item.jamMulai || '')}"></div>
          <div class="form-group" style="margin:0;"><label>Jam Selesai</label><input class="extra-class-end" type="time" value="${escapeTaskHtml(item.jamSelesai || '')}"></div>
          <div class="form-group" style="margin:0;"><label>Ruangan</label><select class="extra-class-room">${classSelectOptions([''].concat(roomValues), item.ruangan || '')}</select></div>
        </div>
      </div>`;
    }

    function addStudentExtraClassRow(item) {
      document.getElementById('addStudentExtraClasses').insertAdjacentHTML('beforeend', studentExtraClassTemplate(item || {}, 'add'));
    }

    function addEditStudentExtraClassRow(item) {
      document.getElementById('editStudentExtraClasses').insertAdjacentHTML('beforeend', studentExtraClassTemplate(item || {}, 'edit'));
    }

    function collectStudentExtraClasses(containerId, status) {
      return [...document.querySelectorAll(`#${containerId} .student-extra-class-row`)].map(row => {
        const teacherSelect = row.querySelector('.extra-class-teacher');
        const selectedTeacher = teacherSelect.options[teacherSelect.selectedIndex];
        return {
          kelasSiswaID: row.dataset.classId || '', jadwalID: row.dataset.scheduleId || '',
          instrumen: row.querySelector('.extra-class-instrument').value,
          guru: teacherSelect.value, guruID: selectedTeacher ? (selectedTeacher.dataset.guruId || '') : '',
          grade: row.querySelector('.extra-class-grade').value, status: status,
          hari: row.querySelector('.extra-class-day').value, jamMulai: row.querySelector('.extra-class-start').value,
          jamSelesai: row.querySelector('.extra-class-end').value, ruangan: row.querySelector('.extra-class-room').value
        };
      });
    }

    function openEditModal(nama) {
      const siswa = globalSiswaList.find(s => String(s.nama).trim().toLowerCase() === String(nama).trim().toLowerCase());
      if (!siswa) return;
      const classes = Array.isArray(siswa.kelasList) && siswa.kelasList.length ? siswa.kelasList : [{ instrumen:siswa.instrumen || 'Gitar', guru:siswa.guru || '', grade:siswa.kelas || 'Beginner' }];
      const primaryClass = classes[0];
      document.getElementById('editOldNama').value = siswa.nama;
      document.getElementById('editSiswaID').value = siswa.siswaID || '';
      document.getElementById('editSiswaNama').value = siswa.nama;
      document.getElementById('editSiswaInstrumen').value = primaryClass.instrumen || 'Gitar';
      document.getElementById('editSiswaGrade').value = primaryClass.grade || siswa.kelas;
      document.getElementById('editSiswaEmail').value = siswa.email;
      document.getElementById('editSiswaHP').value = siswa.noHp || '';
      document.getElementById('editSiswaTanggalMasuk').value = siswa.tglDaftar || '';
      document.getElementById('editSiswaTanggalKeluar').value = siswa.tglKeluar || '';
      document.getElementById('editSiswaStatus').value = siswa.status;
      if (document.getElementById('editSiswaGuruSelect')) {
        document.getElementById('editSiswaGuruSelect').value = primaryClass.guru || siswa.guru || '';
      }
      const extrasContainer = document.getElementById('editStudentExtraClasses');
      extrasContainer.innerHTML = '';
      if (currentUser.userType === 'admin') classes.slice(1).forEach(item => addEditStudentExtraClassRow(item));
      document.getElementById('modalEditSiswa').style.display = 'flex';
    }

    function closeEditModal() { document.getElementById('modalEditSiswa').style.display = 'none'; }
    
    function handleUpdateSiswa(e) {
      e.preventDefault();
      const status = document.getElementById('editSiswaStatus').value;
      const primaryTeacherSelect = document.getElementById('editSiswaGuruSelect');
      const primaryTeacherOption = primaryTeacherSelect && primaryTeacherSelect.options[primaryTeacherSelect.selectedIndex];
      const existingStudent = globalSiswaList.find(s => String(s.siswaID || '') === String(document.getElementById('editSiswaID').value || '')) || {};
      const existingPrimary = Array.isArray(existingStudent.kelasList) && existingStudent.kelasList.length ? existingStudent.kelasList[0] : {};
      const primaryClass = {
        kelasSiswaID: existingPrimary.kelasSiswaID || '', jadwalID: existingPrimary.jadwalID || '',
        instrumen: document.getElementById('editSiswaInstrumen').value,
        grade: document.getElementById('editSiswaGrade').value, status: status,
        guru: primaryTeacherSelect ? primaryTeacherSelect.value : currentUser.userName,
        guruID: primaryTeacherOption ? (primaryTeacherOption.dataset.guruId || '') : currentUser.userID,
        hari: existingPrimary.hari || '', jamMulai: existingPrimary.jamMulai || '', jamSelesai: existingPrimary.jamSelesai || '', ruangan: existingPrimary.ruangan || ''
      };
      const kelasList = [primaryClass].concat(currentUser.userType === 'admin' ? collectStudentExtraClasses('editStudentExtraClasses', status) : []);
      const payload = {
        siswaID: document.getElementById('editSiswaID').value,
        oldNama: document.getElementById('editOldNama').value,
        nama: document.getElementById('editSiswaNama').value,
        instrumen: document.getElementById('editSiswaInstrumen').value,
        kelas: document.getElementById('editSiswaGrade').value,
        email: document.getElementById('editSiswaEmail').value,
        noHp: document.getElementById('editSiswaHP').value,
        tglDaftar: document.getElementById('editSiswaTanggalMasuk').value,
        tglKeluar: document.getElementById('editSiswaTanggalKeluar').value,
        status: status,
        guru: primaryClass.guru,
        guruID: primaryClass.guruID,
        kelasList: kelasList,
        currentUserType: currentUser.userType,
        currentUserID: currentUser.userID
      };
      google.script.run.withSuccessHandler(res => {
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) { closeEditModal(); fetchDashboardData(); }
      }).updateSiswa(payload);
    }

    function openEditJadwalModal(jadwalID) {
      const j = globalJadwalList.find(item => String(item.jadwalID).trim() === String(jadwalID).trim());
      if (!j) return;

      document.getElementById('editJadwalID').value = j.jadwalID;
      document.getElementById('editJadwalSiswa').value = j.namaSiswa;
      document.getElementById('editJadwalInstrumen').value = j.instrumen || 'Gitar';
      document.getElementById('editJadwalGuru').value = j.guru || '';
      document.getElementById('editJadwalHari').value = j.hari;
      document.getElementById('editJadwalMulai').value = j.jamMulai;
      document.getElementById('editJadwalSelesai').value = j.jamSelesai;
      
      const defaultRuanganList = ['R 1', 'R 2', 'R 3', 'R 4', 'R 5', 'R 6', 'R 7', 'R 8'];
      const ruanganVal = j.ruangan || '';
      
      if (defaultRuanganList.includes(ruanganVal)) {
        document.getElementById('editJadwalRuanganSelect').value = ruanganVal;
        toggleRuanganOtherInput(ruanganVal, 'containerEditRuanganOther', 'editJadwalRuanganOther');
      } else {
        document.getElementById('editJadwalRuanganSelect').value = 'Other';
        toggleRuanganOtherInput('Other', 'containerEditRuanganOther', 'editJadwalRuanganOther');
        document.getElementById('editJadwalRuanganOther').value = ruanganVal;
      }

      document.getElementById('editJadwalStatus').value = j.status || 'Aktif';

      const btnUpdate = document.getElementById('btnUpdateJadwalForm');
      if(currentUser.userType === 'siswa') {
        btnUpdate.style.display = 'none';
      } else {
        btnUpdate.style.display = 'block';
      }

      document.getElementById('modalEditJadwal').style.display = 'flex';
    }

    function closeEditJadwalModal() { document.getElementById('modalEditJadwal').style.display = 'none'; }
    
    function handleUpdateJadwal(e) {
      e.preventDefault();

      const selectedRuanganVal = document.getElementById('editJadwalRuanganSelect').value;
      let finalRuangan = selectedRuanganVal;
      if (selectedRuanganVal === 'Other') {
        finalRuangan = document.getElementById('editJadwalRuanganOther').value.trim();
      }

      if (!finalRuangan) {
        alert('Silakan pilih atau isi nama Ruangan terlebih dahulu!');
        return false;
      }

      const payload = {
        jadwalID: document.getElementById('editJadwalID').value,
        namaSiswa: document.getElementById('editJadwalSiswa').value,
        instrumen: document.getElementById('editJadwalInstrumen').value,
        guru: document.getElementById('editJadwalGuru').value,
        hari: document.getElementById('editJadwalHari').value,
        jamMulai: document.getElementById('editJadwalMulai').value,
        jamSelesai: document.getElementById('editJadwalSelesai').value,
        ruangan: finalRuangan,
        status: document.getElementById('editJadwalStatus').value
      };
      google.script.run.withSuccessHandler(res => {
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if(res.success) { closeEditJadwalModal(); fetchDashboardData(); }
      }).updateJadwal(payload);
    }

    function handleSaveSelfProfile(e) {
      e.preventDefault();
      const btn = document.getElementById('btnSaveSelfProfile');
      btn.disabled = true; btn.textContent = 'Menyimpan...';

      const payload = {
        userID: currentUser.userID,
        oldNama: currentUser.userName,
        nama: document.getElementById('selfProfileNama').value,
        email: document.getElementById('selfProfileEmail').value,
        noHp: document.getElementById('selfProfileHP').value,
        instrumen: (() => {
          const input = document.getElementById('selfProfileInstrumen');
          const typed = input ? String(input.value || '').trim() : '';
          if (typed) return typed;
          const existingGuru = currentUser.userType === 'guru' ? (globalGuruList || []).find(g => String(g.id || '').trim() === String(currentUser.userID || '').trim() || String(g.nama || '').trim().toLowerCase() === String(currentUser.userName || '').trim().toLowerCase()) : null;
          return existingGuru ? String(existingGuru.instrumen || '').trim() : '';
        })(),
        userType: currentUser.userType
      };

      google.script.run.withSuccessHandler(res => {
        btn.disabled = false; btn.textContent = 'Simpan Perubahan Profil';
        showAlert(res.success ? 'alertSuccess' : 'alertDanger', res.message);
        if (res.success) {
          currentUser.userID = res.userID || currentUser.userID;
          currentUser.userName = payload.nama;
          saveLoginSession(currentUser);
          fetchDashboardData();
        }
      }).updateSelfProfile(payload);
    }


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

    function getTeacherInstrumentValues(value) {
      return String(value || '').split(',').map(item => item.trim()).filter(Boolean);
    }

    function setTeacherInstrumentSelection(select, value) {
      if (!select) return;
      const values = new Set(getTeacherInstrumentValues(value));
      [...select.options].forEach(option => { option.selected = values.has(option.value); });
    }

    function getSelectedTeacherInstruments() {
      const select = document.getElementById('addGuruInstrumen');
      if (!select) return '';
      return [...select.selectedOptions].map(option => option.value).filter(Boolean).join(', ');
    }

    function renderAdminTeacherManagement() {
      if (currentUser.userType !== 'admin') return;
      const teacherSearch = String(document.getElementById('teacherSearchInput')?.value || '').trim().toLowerCase();
      const displayedTeachers = teacherSearch ? globalGuruList.filter(guru => {
        const haystack = `${guru.nama || ''} ${guru.instrumen || ''} ${guru.email || ''} ${guru.noHp || ''} ${guru.status || ''}`.toLowerCase();
        return haystack.includes(teacherSearch);
      }) : globalGuruList;

      const teacherBody = document.getElementById('adminGuruListBody');
      if (teacherBody) {
        teacherBody.innerHTML = displayedTeachers.length ? displayedTeachers.map((guru, index) => `<tr class="teacher-mobile-row" onclick="toggleMobileTableRow(event,this)" aria-expanded="false"><td data-label="No">${index + 1}</td><td data-label="Nama Guru"><b>${escapeTaskHtml(guru.nama || '-')}</b></td><td data-label="Instrumen">${escapeTaskHtml(guru.instrumen || '-')}</td><td data-label="Email">${escapeTaskHtml(guru.email || '-')}</td><td data-label="No. HP">${escapeTaskHtml(guru.noHp || '-')}</td><td data-label="Status"><span><span class="badge ${String(guru.status || 'Aktif').toLowerCase() === 'aktif' ? 'badge-success' : 'badge-danger'}">${escapeTaskHtml(guru.status || 'Aktif')}</span><span class="teacher-row-chevron">⌄</span></span></td><td data-label="Aksi"><div class="table-actions"><button type="button" class="btn-action btn-edit" onclick="openEditGuru(decodeURIComponent('${encodeURIComponent(guru.id || guru.nama || '')}'))">Edit</button><button type="button" class="btn-action btn-delete" onclick="deleteGuruRecord(decodeURIComponent('${encodeURIComponent(guru.id || guru.nama || '')}'),decodeURIComponent('${encodeURIComponent(guru.nama || '')}'))">Hapus</button></div></td></tr>`).join('') : '<tr class="table-empty-row"><td class="table-empty-cell" colspan="7" style="text-align:center;color:#94a3b8;">Belum ada data guru.</td></tr>';
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
      setTeacherInstrumentSelection(document.getElementById('addGuruInstrumen'), guru.instrumen || 'Gitar');
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
        instrumen: getSelectedTeacherInstruments(),
        status: document.getElementById('addGuruStatus').value
      };

      if (!payload.instrumen) {
        showAlert('alertDanger', 'Pilih minimal satu instrumen untuk guru.');
        return false;
      }

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
