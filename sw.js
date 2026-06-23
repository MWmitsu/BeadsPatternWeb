// ============================================================
//  Service Worker (PWA / オフライン対応)
// ------------------------------------------------------------
//  アプリシェルと vendor をキャッシュし、その他の同一オリジン GET は
//  ランタイムキャッシュ(取得後に保存)する。これで2回目以降はオフラインでも起動可能。
// ============================================================
const CACHE = 'beads-pattern-v1';

const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/htm.umd.js',
  './js/main.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => {}) // 一部取得失敗でもインストールは継続
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          try {
            if (res && res.ok && new URL(req.url).origin === self.location.origin) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
          } catch (_) {}
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
