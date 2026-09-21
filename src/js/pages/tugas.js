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

