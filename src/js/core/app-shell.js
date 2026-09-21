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

