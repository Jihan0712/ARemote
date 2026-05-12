/* Cross-Origin Isolation service worker for GitHub Pages.
   Adds COOP + COEP headers so SharedArrayBuffer (required by MindAR WASM) works. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  // Skip only-if-cached cross-origin requests — they can't be fetched and will throw
  if (e.request.cache === 'only-if-cached' && e.request.mode !== 'same-origin') return;

  e.respondWith(
    fetch(e.request).then((res) => {
      // Opaque responses (no-cors cross-origin) have status 0 and cannot be reconstructed
      if (res.type === 'opaque' || res.type === 'error') return res;

      const h = new Headers(res.headers);
      h.set('Cross-Origin-Opener-Policy',   'same-origin');
      h.set('Cross-Origin-Embedder-Policy', 'credentialless');
      h.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return new Response(res.body, {
        status:     res.status,
        statusText: res.statusText,
        headers:    h,
      });
    }).catch(function () {
      // Network error — let browser handle it naturally
      return fetch(e.request);
    })
  );
});
