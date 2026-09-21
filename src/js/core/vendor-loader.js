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
