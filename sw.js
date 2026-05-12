/*
 * Dual-purpose Cross-Origin Isolation helper for GitHub Pages.
 * When loaded as a <script> tag it registers itself as a Service Worker.
 * When loaded as a Service Worker it injects COOP/COEP headers.
 * Based on coi-serviceworker by Guido Zuidhof (MIT).
 */

if (typeof window === 'undefined') {
  /* ── SERVICE WORKER CONTEXT ── */
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', function (e) {
    var r = e.request;
    // Skip opaque (no-cors) requests — cannot reconstruct their responses
    if (r.mode === 'no-cors') return;
    // Skip only-if-cached cross-origin — will throw NetworkError
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') return;

    e.respondWith(
      fetch(r).then(function (res) {
        if (res.status === 0) return res; // opaque fallthrough
        var h = new Headers(res.headers);
        h.set('Cross-Origin-Opener-Policy',   'same-origin');
        h.set('Cross-Origin-Embedder-Policy', 'credentialless');
        h.set('Cross-Origin-Resource-Policy', 'cross-origin');
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
      }).catch(function () { return fetch(r); })
    );
  });

} else {
  /* ── WINDOW / REGISTRATION CONTEXT ── */
  (function () {
    if (!window.isSecureContext || !navigator.serviceWorker) return;

    // Remove the reload flag immediately so it doesn't block future visits
    var reloadedBySelf = sessionStorage.getItem('coiReloadedBySelf');
    sessionStorage.removeItem('coiReloadedBySelf');

    // Already isolated — SW is working; just keep it current
    if (window.crossOriginIsolated) {
      navigator.serviceWorker.register(document.currentScript.src);
      return;
    }

    // We already tried a reload this session — don't loop
    if (reloadedBySelf) return;

    function reload() {
      sessionStorage.setItem('coiReloadedBySelf', '1');
      location.reload();
    }

    navigator.serviceWorker.register(document.currentScript.src).then(function (reg) {
      // SW active from a previous visit but this page load wasn't intercepted
      if (reg.active && !navigator.serviceWorker.controller) { reload(); return; }

      // SW just installed — wait for it to activate then reload
      var sw = reg.installing || reg.waiting;
      if (sw) {
        sw.addEventListener('statechange', function () {
          if (this.state === 'activated') reload();
        });
      }
    }).catch(function (err) {
      console.warn('COI SW registration failed:', err);
    });
  })();
}
