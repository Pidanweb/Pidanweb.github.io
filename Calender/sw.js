// 超シンプルなオフライン対応: 一度開いたファイルをキャッシュして、次回から優先的に使う
const CACHE = 'calendar-v1';
const FILES = ['index.html', 'calendar.html', 'app.js', 'style.css', 'manifest.json', 'icon-192.png', 'icon-512.png',
  ...Array.from({ length: 10 }, (_, i) => `chara/chara${i + 1}.png`)];

self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('fetch', (e) =>
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))));
