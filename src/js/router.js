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
        laporan: `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line></svg>`,
        manajemen: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
      };

      const navMenu = document.getElementById('navMenu'); navMenu.innerHTML = '';
      let menus = [];
      
      if(currentUser.userType === 'siswa') {
        menus = [ 
          { id: 'dashboard-siswa', label: 'Beranda', icon: icons.beranda }, 
          { id: 'section-learning-progress', label: 'Progress Belajar', icon: icons.progress },
          { id: 'section-laporan', label: 'Laporan', icon: icons.laporan },
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

