'use strict';
// Build-release thay ID bằng hash cả gói để mỗi bản cache là một bộ đồng nhất.
const CACHE_NAME = 'calculator-shell-v13-rc1';
const SHELL_FILES = ["index.html","style.css","device.css","feedback.css","engine.js","complex.js","matrix.js","vector.js","verify.js","coefficient-editor.js","ratio.js","equation.js","inequality.js","statistics.js","distribution.js","base-n.js","table.js","keypad.js","ui.js","bridge.js","touch.js","keyboard.js","feedback.js","app.js","manifest.webmanifest","assets/device-face.svg","assets/device-face-blue.svg","assets/device-face-pink.svg","assets/menu-tiles.svg","assets/lcd-numerals.ttf","assets/lcd-text.ttf","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png"];
const urls = SHELL_FILES.map(file => new URL(file, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try { await cache.addAll(urls.map(url => new Request(url, { cache: 'reload' }))); }
    catch (error) { await caches.delete(CACHE_NAME); throw error; }
    // Không skipWaiting: bản mới chờ người dùng chủ động cập nhật.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('calculator-shell-') && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return; // Không lưu/gửi lại góp ý hoặc ảnh.
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const relative = url.pathname.slice(scope.pathname.length) || 'index.html';
  if (!SHELL_FILES.includes(relative)) return;
  const key = new URL(relative, scope).href;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(key) || fetch(request);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') { self.skipWaiting(); return; }
  if (event.data?.type !== 'CHECK_CACHE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const complete = (await Promise.all(urls.map(url => cache.match(url)))).every(Boolean);
    event.ports[0].postMessage({ ready: complete, version: CACHE_NAME });
  })());
});
