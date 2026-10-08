const DEFAULT_ICON = '/icons/icon-192.png';
const DEFAULT_BADGE = '/icons/icon-192.png';
const APP_CACHE = 'legacy-app-shell-v4';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/app.bundle.css',
  '/js/app.bundle.js',
  '/icons/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(APP_SHELL).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('legacy-app-shell-') && key !== APP_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API and RPC data must always come from the network so users never see stale school data.
  if (url.pathname.startsWith('/api/')) return;

  const isStatic = url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/manifest.webmanifest' ||
    url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/');
  if (!isStatic) return;

  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const isVersionSensitive = url.pathname === '/' || url.pathname === '/index.html' || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/');

    // HTML/CSS/JS are network-first so a newly deployed Legacy version never keeps
    // an old UI bundle merely because the PWA cache exists. The cache is fallback only.
    if (isVersionSensitive) {
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch (_) {
        return (await cache.match(request)) || caches.match('/index.html');
      }
    }

    // Icons/assets are immutable enough for cache-first and make repeat opens lighter.
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  })());
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) {
    payload = { title:'Legacy Music Center', body:event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Legacy Music Center';
  const options = {
    body: payload.body || 'Ada informasi baru untuk Anda.',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    tag: payload.tag || 'legacy-notification',
    renotify: Boolean(payload.renotify),
    data: {
      url: payload.url || '/',
      ...(payload.data || {})
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of windows) {
      if ('focus' in client) {
        try {
          await client.navigate(target);
          return client.focus();
        } catch (_) {
          return client.focus();
        }
      }
    }
    return clients.openWindow ? clients.openWindow(target) : null;
  })());
});
