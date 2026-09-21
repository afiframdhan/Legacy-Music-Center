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

