/* わりかんドライブの sw.js（2026-11-17 段4・帳面 15:30）
   ★これを置く理由：Android の Chrome で「ホーム画面に置く」ボタンからインストールの確認を出すため（Chrome は fetch を受け持つ sw.js があるときだけ出す）。
   ★やること：このフォルダの画面（index.html・アイコン・manifest.json）だけを保存し、まず通信で最新を取る。圏外なら保存した画面を出す（計算は電波が要る）。
   ★サーバー（script.google.com）や地図への通信には手を出さない。何も記録しない。
   ★build_app.js は書き出さない＝元は アプリ_dev\warikan\絵\sw.js。公開側（ohc-calendar\dev\warikan\・club-calendar\warikan\）へ手で置く。 */
var WK_SW_CACHE = 'warikan@' + new URL(self.registration.scope).pathname + '@1';
var WK_SW_FILES = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(WK_SW_CACHE).then(function (c) {
    return Promise.all(WK_SW_FILES.map(function (f) {
      return fetch(f, { cache: 'no-cache' }).then(function (r) { if (r && r.ok) return c.put(f, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ns) {
    return Promise.all(ns.map(function (n) { if (n.indexOf('warikan@') === 0 && n !== WK_SW_CACHE) return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var scope = new URL(self.registration.scope).pathname;
  if (url.pathname.indexOf(scope) !== 0) return;
  var key = req.mode === 'navigate' ? './' : url.pathname.substring(scope.length);
  if (req.mode !== 'navigate' && WK_SW_FILES.indexOf(key) < 0) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(WK_SW_CACHE).then(function (c) { c.put(key, cp); }); }
    return res;
  }).catch(function () {
    return caches.open(WK_SW_CACHE).then(function (c) { return c.match(key); }).then(function (hit) {
      return hit || new Response('圏外のようです。電波のある所で開いてください。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    });
  }));
});
