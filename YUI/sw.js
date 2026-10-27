// YUI Service Worker
// 更新を配信したいときは VERSION を上げる(古いキャッシュが自動で消える)
const VERSION = 'v1';
const CACHE = 'yui-' + VERSION;

// 先に保存しておくファイル。存在しないものがあっても無視されるので、増減はお好みで
const PRECACHE = [
  './',
  './index.html',
  './index_tyuto.html',
  './shoki.html',
  './apps/talk.html',
  './apps/study.html',
  './apps/settings.html',
  './apps/music/music_player.html',
  './apps/yui_scanner.html',
  './apps/schedule.html',
  './apps/draw_game.html',
  './apps/profile.html',
  './apps/doubutu.html',
  './chars/char_normal.png',
  './chars/bg_scene.jpg',
  './chars/' + encodeURIComponent('決定音.mp3'),
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) => {
          const req = new Request(url, url.startsWith('http') ? { mode: 'no-cors' } : {});
          return fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') return cache.put(req, res);
          });
        })
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('yui-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 音声などの Range リクエスト(iOS Safari は必ず使う)をキャッシュから返す
async function rangeResponse(request) {
  const cached = await caches.match(request.url);
  if (!cached) return fetch(request);
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  const start = m && m[1] ? parseInt(m[1], 10) : 0;
  const end = m && m[2] ? Math.min(parseInt(m[2], 10), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1)
    }
  });
}

// HTML: ネット優先(更新がすぐ反映される)→ 失敗したらキャッシュ
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
    throw e;
  }
}

// 画像・音・フォント・外部ライブラリ: キャッシュ優先 + 裏で更新
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  if (request.headers.has('range')) {
    event.respondWith(rangeResponse(request));
    return;
  }

  const isHTML = request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
  if (url.origin === location.origin && isHTML) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});
