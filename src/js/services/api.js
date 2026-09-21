(function () {
  'use strict';

  // V3: identical read requests share the same in-flight Promise. No response cache is kept,
  // so writes are still reflected on the next request exactly as before.
  const inflightReads = new Map();
  const DEDUPE_METHODS = new Set(['getDashboardData', 'getGuruList', 'getLearningProgressPrintLogo']);

  async function rawRpc(method, args) {
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
      if (response.status === 401) window.dispatchEvent(new CustomEvent('legacy:session-expired'));
      throw error;
    }
    return payload.data;
  }

  function rpc(method, args) {
    if (!DEDUPE_METHODS.has(method)) return rawRpc(method, args);
    let key;
    try { key = `${method}:${JSON.stringify(args)}`; }
    catch (_) { return rawRpc(method, args); }
    if (inflightReads.has(key)) return inflightReads.get(key);
    const request = rawRpc(method, args).finally(() => inflightReads.delete(key));
    inflightReads.set(key, request);
    return request;
  }

  function makeRunner() {
    const state = { success: null, failure: null };
    let proxy;
    proxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') return function (fn) { state.success = fn; return proxy; };
        if (prop === 'withFailureHandler') return function (fn) { state.failure = fn; return proxy; };
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

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: false,
    enumerable: true,
    get: makeRunner
  });

  window.LegacyAPI = { rpc };
})();
