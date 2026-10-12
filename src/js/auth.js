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
          currentUser = { userType: res.userType, userID: res.userID, userName: res.userName, mustChangePassword:Boolean(res.mustChangePassword) };
          saveLoginSession(currentUser);
          showApp();
          if (currentUser.mustChangePassword) setTimeout(openForcePasswordModal, 0);
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
      if (liveAnnouncementTimer) { clearInterval(liveAnnouncementTimer); liveAnnouncementTimer = null; }
      if (typeof stopGlobalLiveSync === 'function') stopGlobalLiveSync();
      document.getElementById('notificationPanel')?.classList.remove('open');
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (ignore) {}
      try {
        sessionStorage.removeItem('userType');
        sessionStorage.removeItem('userID');
        sessionStorage.removeItem('userName');
        sessionStorage.removeItem('mustChangePassword');
      } catch (ignore) {}
      try { document.cookie = `${AUTH_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax; Secure`; } catch (ignore) {}
      currentUser = { userType: '', userID: '', userName: '', mustChangePassword:false };
      showLogin();
    }
    function showLogin() { document.getElementById('appView').style.display = 'none'; document.getElementById('loginView').style.display = 'flex'; }
    

    function hydrateFastIdentityShell() {
      const name = String(currentUser?.userName || '').trim();
      if (!name) return;
      const top = document.getElementById('userName'); if (top) top.textContent = name;
      const profile = document.getElementById('myProfileDisplayName'); if (profile) profile.textContent = name;
      const guru = document.getElementById('dashGuruNama'); if (guru) guru.textContent = name;
      const siswa = document.getElementById('dashSiswaNama'); if (siswa) siswa.textContent = name;
    }

    function showApp() {
      document.getElementById('loginView').style.display = 'none'; document.getElementById('appView').style.display = 'block';
      hydrateFastIdentityShell();
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
      if (typeof initializePushNotifications === 'function') initializePushNotifications();
    }



    window.addEventListener('legacy:session-expired', () => {
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (_) {}
      try { sessionStorage.removeItem('userType'); sessionStorage.removeItem('userID'); sessionStorage.removeItem('userName');
        sessionStorage.removeItem('mustChangePassword'); } catch (_) {}
      if (typeof stopGlobalLiveSync === 'function') stopGlobalLiveSync();
      currentUser = { userType:'', userID:'', userName:'', mustChangePassword:false };
      showLogin();
      const msg = document.getElementById('loginError');
      if (msg) { msg.textContent = 'Sesi login berakhir. Silakan login kembali.'; msg.style.display = 'block'; }
    });


    function openForcePasswordModal(){
      openChangePasswordModal(true);
    }
    function openChangePasswordModal(forced=false){
      const modal=document.getElementById('modalForcePassword'); if(!modal)return;
      modal.dataset.forced = forced ? '1' : '0';
      document.getElementById('forcePasswordNew').value='';
      document.getElementById('forcePasswordConfirm').value='';
      const close=document.getElementById('forcePasswordClose'); if(close) close.style.display=forced?'none':'block';
      const title=document.getElementById('forcePasswordTitle'); if(title) title.textContent=forced?'Buat Password Baru':'Ubah Password';
      const subtitle=document.getElementById('forcePasswordSubtitle'); if(subtitle) subtitle.textContent=forced?'Password awal hanya boleh digunakan sekali.':'Gunakan password yang unik dan tidak dibagikan.';
      const msg=document.getElementById('forcePasswordMessage'); if(msg){msg.textContent=forced?'Untuk keamanan akun, buat password baru sebelum melanjutkan.':'Password minimal 8 karakter dan mengandung huruf serta angka.';msg.className='force-password-message';}
      modal.style.display='flex';
      setTimeout(()=>document.getElementById('forcePasswordNew')?.focus(),80);
    }
    function closeChangePasswordModal(){
      const modal=document.getElementById('modalForcePassword'); if(!modal)return;
      if(modal.dataset.forced==='1') return;
      modal.style.display='none';
    }
    function handleForcePasswordChange(event){
      event.preventDefault();
      const password=document.getElementById('forcePasswordNew').value;
      const confirmPassword=document.getElementById('forcePasswordConfirm').value;
      const btn=document.getElementById('forcePasswordSubmit');
      const msg=document.getElementById('forcePasswordMessage');
      if(password.length<8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)){msg.textContent='Password minimal 8 karakter dan harus mengandung huruf serta angka.';msg.className='force-password-message error';return false;}
      if(password!==confirmPassword){msg.textContent='Konfirmasi password tidak sama.';msg.className='force-password-message error';return false;}
      btn.disabled=true;btn.textContent='Menyimpan...';
      google.script.run.withSuccessHandler(res=>{
        btn.disabled=false;btn.textContent='Simpan Password Baru';
        if(!res?.success){msg.textContent=res?.message||'Gagal memperbarui password.';msg.className='force-password-message error';return;}
        currentUser.mustChangePassword=false;saveLoginSession(currentUser);
        document.getElementById('modalForcePassword').style.display='none';
      }).withFailureHandler(error=>{btn.disabled=false;btn.textContent='Simpan Password Baru';msg.textContent=error?.message||String(error);msg.className='force-password-message error';}).changeOwnPassword({password,confirmPassword});
      return false;
    }
