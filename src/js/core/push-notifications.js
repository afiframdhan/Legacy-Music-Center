(function(){
  'use strict';

  let pushRegistration = null;

  function isIOS(){
    return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone(){
    return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function pushSupported(){
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function base64UrlToUint8Array(value){
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
  }

  function setPushStatus(text, tone){
    const status = document.getElementById('pushNotificationStatus');
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone || 'neutral';
  }

  function setPushButtons(state){
    const enable = document.getElementById('btnEnablePush');
    const test = document.getElementById('btnTestPush');
    const disable = document.getElementById('btnDisablePush');
    if (enable) enable.style.display = state === 'enabled' ? 'none' : '';
    if (test) test.style.display = state === 'enabled' ? '' : 'none';
    if (disable) disable.style.display = state === 'enabled' ? '' : 'none';
  }

  async function getRegistration(){
    if (!pushSupported()) throw new Error('Push notification tidak didukung pada perangkat/browser ini.');
    if (pushRegistration) return pushRegistration;
    pushRegistration = await navigator.serviceWorker.register('/sw.js', { scope:'/' });
    await navigator.serviceWorker.ready;
    return pushRegistration;
  }

  async function saveSubscription(subscription){
    const json = subscription.toJSON();
    const payload = {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime || null,
      keys: json.keys || {},
      userAgent: navigator.userAgent || '',
      platform: navigator.platform || '',
      standalone: isStandalone()
    };
    const result = await LegacyAPI.rpc('savePushSubscription', [payload]);
    if (!result || result.success === false) throw new Error(result?.message || 'Gagal menyimpan subscription push.');
    return result;
  }

  function applyPushDeepLink(){
    try {
      const target = new URLSearchParams(window.location.search).get('open');
      if (!target || !currentUser || !currentUser.userID) return;
      setTimeout(() => {
        try {
          if (typeof switchTab === 'function') switchTab(target);
          const clean = new URL(window.location.href);
          clean.searchParams.delete('open');
          history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
        } catch (_) {}
      }, 700);
    } catch (_) {}
  }

  async function initializePushNotifications(){
    const card = document.getElementById('pushNotificationSettings');
    if (!card) return;
    applyPushDeepLink();

    if (isIOS() && !isStandalone()) {
      setPushStatus('Di iPhone, buka aplikasi dari ikon Home Screen untuk mengaktifkan push notification.', 'warning');
      setPushButtons('unavailable');
      return;
    }
    if (!pushSupported()) {
      setPushStatus('Push notification belum didukung pada perangkat/browser ini.', 'warning');
      setPushButtons('unavailable');
      return;
    }

    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && Notification.permission === 'granted') {
        try { await saveSubscription(subscription); } catch (_) {}
        setPushStatus('Notifikasi aktif di perangkat ini.', 'success');
        setPushButtons('enabled');
      } else if (Notification.permission === 'denied') {
        setPushStatus('Izin notifikasi diblokir. Aktifkan kembali dari Settings iPhone/Browser.', 'danger');
        setPushButtons('unavailable');
      } else {
        setPushStatus('Notifikasi belum diaktifkan di perangkat ini.', 'neutral');
        setPushButtons('disabled');
      }
    } catch (error) {
      console.error('Push init error:', error);
      setPushStatus(error.message || 'Gagal menyiapkan push notification.', 'danger');
      setPushButtons('disabled');
    }
  }

  async function enablePushNotifications(){
    const button = document.getElementById('btnEnablePush');
    const old = button ? button.textContent : '';
    try {
      if (button) { button.disabled = true; button.textContent = 'Mengaktifkan...'; }
      if (isIOS() && !isStandalone()) throw new Error('Di iPhone, buka aplikasi dari ikon Home Screen terlebih dahulu.');
      const config = await LegacyAPI.rpc('getPushConfig', []);
      if (!config || config.success === false || !config.publicKey) throw new Error(config?.message || 'VAPID public key belum dikonfigurasi di Cloudflare.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Izin notifikasi belum diberikan.');
      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(config.publicKey)
        });
      }
      await saveSubscription(subscription);
      setPushStatus('Notifikasi aktif. Anda tetap bisa menerima notifikasi saat PWA ditutup.', 'success');
      setPushButtons('enabled');
    } catch (error) {
      console.error('Enable push error:', error);
      setPushStatus(error.message || 'Gagal mengaktifkan notifikasi.', 'danger');
      if (typeof showAlert === 'function') showAlert('alertDanger', error.message || 'Gagal mengaktifkan notifikasi.');
    } finally {
      if (button) { button.disabled = false; button.textContent = old || 'Aktifkan Notifikasi'; }
    }
  }

  async function disablePushNotifications(){
    const button = document.getElementById('btnDisablePush');
    const old = button ? button.textContent : '';
    try {
      if (button) { button.disabled = true; button.textContent = 'Menonaktifkan...'; }
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await LegacyAPI.rpc('removePushSubscription', [subscription.endpoint]);
        await subscription.unsubscribe();
      }
      setPushStatus('Notifikasi dinonaktifkan di perangkat ini.', 'neutral');
      setPushButtons('disabled');
    } catch (error) {
      console.error('Disable push error:', error);
      setPushStatus(error.message || 'Gagal menonaktifkan notifikasi.', 'danger');
    } finally {
      if (button) { button.disabled = false; button.textContent = old || 'Nonaktifkan'; }
    }
  }

  async function sendPushTest(){
    const button = document.getElementById('btnTestPush');
    const old = button ? button.textContent : '';
    try {
      if (button) { button.disabled = true; button.textContent = 'Mengirim...'; }
      const result = await LegacyAPI.rpc('sendPushTest', []);
      if (!result || result.success === false) throw new Error(result?.message || 'Notifikasi tes gagal dikirim.');
      setPushStatus(result.message || 'Notifikasi tes sudah dikirim.', 'success');
    } catch (error) {
      console.error('Push test error:', error);
      setPushStatus(error.message || 'Notifikasi tes gagal dikirim.', 'danger');
    } finally {
      if (button) { button.disabled = false; button.textContent = old || 'Kirim Notifikasi Tes'; }
    }
  }

  window.initializePushNotifications = initializePushNotifications;
  window.enablePushNotifications = enablePushNotifications;
  window.disablePushNotifications = disablePushNotifications;
  window.sendPushTest = sendPushTest;
})();
