// Keeps Komit working offline after the first visit, and makes the page
// "cross-origin isolated" so the AI can use several CPU cores (GitHub Pages
// cannot send these headers itself, so this worker adds them).
// Own files: network first (so updates arrive), cache as fallback.
// The AI library from the CDN: cache first. (The models cache themselves.)
const CACHE = 'komit-v2';
const OWN = ['./', 'index.html', 'mind.js', 'brain-worker.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OWN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

function isolated(r) {
  if (!r || r.status === 0) return r;
  const h = new Headers(r.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'credentialless');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return isolated(r);
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(isolated)));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    })));
  }
});
