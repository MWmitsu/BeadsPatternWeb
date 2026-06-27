// ============================================================
//  Service Worker (PWA / オフライン対応)
// ------------------------------------------------------------
//  方針: network-first。オンライン時は常に最新を取得して表示し(取得時にキャッシュも更新)、
//  オフライン時のみキャッシュから配信する。これにより更新が確実に届き、かつオフラインでも起動できる。
//  ※ cache-first だと更新が反映されないため避ける。キャッシュ名を変えると旧キャッシュは破棄される。
// ============================================================
const CACHE = 'beads-pattern-v21';

const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './css/fonts.css',
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
  // 外部オリジンには介入しない
  let sameOrigin = true;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (_) {}
  if (!sameOrigin) return;

  // network-first: 最新を優先。成功したらキャッシュ更新。失敗(オフライン)時はキャッシュ→なければindex.html。
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
