(function () {
  'use strict';

  const ACTIVE_INTERVAL = 3000;
  const FOCUS_REFRESH_MIN_AGE = 1500;
  let lastPollAt = 0;
  let refreshTimer = null;

  function versionsChanged(next) {
    const current = globalLiveSyncVersions || {};
    const keys = new Set([...Object.keys(current), ...Object.keys(next || {})]);
    for (const key of keys) {
      if (String(current[key] || '0') !== String((next || {})[key] || '0')) return true;
    }
    return false;
  }

  function requestFastDashboardRefresh(reason, delay = 180) {
    if (!currentUser || !currentUser.userType) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (typeof fetchDashboardData === 'function') fetchDashboardData({ silent:true, reason:reason || 'live-sync' });
    }, delay);
  }

  async function pollLiveSync(force = false) {
    if (globalLiveSyncRunning || !currentUser || !currentUser.userType) return;
    if (document.visibilityState === 'hidden' && !force) return;
    const now = Date.now();
    if (!force && now - lastPollAt < 1200) return;
    lastPollAt = now;
    globalLiveSyncRunning = true;
    try {
      const res = await LegacyAPI.rpc('getLiveSyncState', []);
      if (!res || res.success === false || !res.versions) return;
      const next = res.versions || {};
      const hadBaseline = Object.keys(globalLiveSyncVersions || {}).length > 0;
      const changed = hadBaseline && versionsChanged(next);
      globalLiveSyncVersions = next;
      if (changed) requestFastDashboardRefresh('remote-change', 120);
    } catch (error) {
      // Live sync is an enhancement. Never block the app if the sync table is unavailable.
      console.debug('[Legacy Live Sync] poll skipped:', error && error.message ? error.message : error);
    } finally {
      globalLiveSyncRunning = false;
    }
  }

  function configureGlobalLiveSync() {
    if (!currentUser || !currentUser.userType) return;
    if (globalLiveSyncTimer) clearInterval(globalLiveSyncTimer);
    pollLiveSync(true);
    globalLiveSyncTimer = setInterval(() => pollLiveSync(false), ACTIVE_INTERVAL);
  }

  function stopGlobalLiveSync() {
    if (globalLiveSyncTimer) clearInterval(globalLiveSyncTimer);
    globalLiveSyncTimer = null;
    globalLiveSyncVersions = {};
    globalLiveSyncRunning = false;
  }

  window.addEventListener('legacy:data-mutated', event => {
    // Local writes already returned success; refresh in background, coalescing multiple writes.
    requestFastDashboardRefresh(event?.detail?.method || 'local-write', 120);
    setTimeout(() => pollLiveSync(true), 350);
  });

  window.addEventListener('focus', () => {
    if (!currentUser || !currentUser.userType) return;
    if (Date.now() - (dashboardLastLoadedAt || 0) > FOCUS_REFRESH_MIN_AGE) pollLiveSync(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser && currentUser.userType) pollLiveSync(true);
  });

  window.configureGlobalLiveSync = configureGlobalLiveSync;
  window.stopGlobalLiveSync = stopGlobalLiveSync;
  window.requestFastDashboardRefresh = requestFastDashboardRefresh;
})();
