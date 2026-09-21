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

