(function () {
  'use strict';

  async function rpc(method, args) {
    const response = await fetch('/api/rpc', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, args })
    });

    let payload = null;
    try { payload = await response.json(); }
    catch (_) { throw new Error('Respons API tidak valid.'); }

    if (!response.ok || !payload || payload.ok === false) {
      const error = new Error((payload && payload.error) || `API error (${response.status})`);
      error.status = response.status;
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('legacy:session-expired'));
      }
      throw error;
    }
    return payload.data;
  }

  function makeRunner() {
    const state = { success: null, failure: null };
    let proxy;
    proxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (fn) { state.success = fn; return proxy; };
        }
        if (prop === 'withFailureHandler') {
          return function (fn) { state.failure = fn; return proxy; };
        }
        if (prop === 'then') return undefined;
        return function (...args) {
          rpc(String(prop), args)
            .then(result => { if (typeof state.success === 'function') state.success(result); })
            .catch(error => {
              if (typeof state.failure === 'function') state.failure(error);
              else console.error(`[Legacy API] ${String(prop)} failed`, error);
            });
          return proxy;
        };
      }
    });
    return proxy;
  }

  // Compatibility shim. Existing UI can keep using google.script.run while the app
  // is hosted on Cloudflare; the calls now go through /api/rpc instead of Apps Script iframe RPC.
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: false,
    enumerable: true,
    get: makeRunner
  });

  window.LegacyAPI = { rpc };
})();
