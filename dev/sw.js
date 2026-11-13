/* ==================================================================
   サービスワーカー（2026-11-13b・㊷）
   ★山で圏外のまま開くと、ブラウザの「オフライン」の画面になっていた（只隈さん 11/13）。
   　前の sw.js は「アプリとして入れられる」ためだけで、何も保存していなかったため。
   ★いまは画面の部品（index.html・css・js・精算のページ・アイコン）を端末に保存し、
   　圏外でも画面を開けるようにする。予定そのものは前から端末の控え（localStorage）にある。

   版ずれを起こさない作り：
   　・ページ（HTML）は、まず通信で最新を取りに行く。4秒待っても返事が無いとき・圏外のときだけ、保存した分を出す。
   　・js と css は名前に ?v=版 が付いている＝版ごとに別物なので、保存した分をそのまま使ってよい。
   　・最新のページを取れたら、そのページが使っていない古い版の js・css を消す。
   　・サーバー（script.google.com）への通信には手を出さない。
   　・このファイルの置き場の下でも、dev/ と promo/ は手を出さない（開発版は dev/sw.js が受け持つ）。
   ================================================================== */
var SCOPE_PATH = new URL(self.registration.scope).pathname;   /* 例 /ohc-calendar/ */
/* ★入れ物は同じ github.io の中で共有される（本番・新クラブ用・開発版）＝置き場ごとに名前を分ける */
var SW_BASE = 'calendar-shell@' + SCOPE_PATH + '@';
var SW_CACHE = SW_BASE + '1';
var SW_TIMEOUT = 4000;

function mine_(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.indexOf(SCOPE_PATH) !== 0) return false;
  var rest = url.pathname.substring(SCOPE_PATH.length);
  if (/^(dev|promo)\//.test(rest)) return false;
  return true;
}

function isCarpool_(url) {
  var rest = url.pathname.substring(SCOPE_PATH.length);
  return /^carpool\/(index\.html)?$/.test(rest);
}

/* ページの鍵（?club= などを外し、index.html 付きでも無しでも同じに） */
function pageKey_(url) {
  return isCarpool_(url) ? SCOPE_PATH + 'carpool/' : SCOPE_PATH;
}

/* ページが使う部品（同じ置き場の相対パス）を取り出す */
function partsOf_(html, base) {
  var out = [], re = /(?:src|href)\s*=\s*"([^"#]+)"/g, m;
  while ((m = re.exec(html))) {
    var u;
    try { u = new URL(m[1], base); } catch (e) { continue; }
    if (u.origin !== self.location.origin) continue;
    if (!/\.(js|css|png|json)$/.test(u.pathname)) continue;
    if (out.indexOf(u.href) < 0) out.push(u.href);
  }
  return out;
}

/* ページを保存し、そのページの部品も保存する。カレンダーのページなら、使っていない古い部品を消す */
function keepPage_(cache, key, res, base) {
  return res.clone().text().then(function (html) {
    var parts = partsOf_(html, base);
    return cache.put(key, res.clone()).then(function () {
      return Promise.all(parts.map(function (p) {
        return cache.match(p).then(function (hit) {
          if (hit) return null;
          return fetch(p).then(function (r) { if (r && r.ok) return cache.put(p, r); }).catch(function () {});
        });
      }));
    }).then(function () {
      if (isCarpool_(new URL(base))) return null;
      return cache.keys().then(function (ks) {
        return Promise.all(ks.map(function (k) {
          var u = new URL(k.url);
          if (!/\/(js|css)\//.test(u.pathname) || !u.search) return null;
          if (u.pathname.indexOf(SCOPE_PATH + 'carpool/') === 0) return null;
          if (parts.indexOf(u.href) < 0) return cache.delete(k);
          return null;
        }));
      });
    });
  });
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SW_CACHE).then(function (cache) {
    var top = new URL(SCOPE_PATH, self.location.origin).href;
    var cp = new URL(SCOPE_PATH + 'carpool/', self.location.origin).href;
    function one(url) {
      return fetch(url, { cache: 'no-cache' }).then(function (r) {
        if (r && r.ok) return keepPage_(cache, pageKey_(new URL(url)), r, url);
      }).catch(function () {});
    }
    var extra = ['manifest.json', 'icon-192.png', 'icon-512.png', 'carpool/apple-touch-icon.png'].map(function (p) {
      var u = new URL(SCOPE_PATH + p, self.location.origin).href;
      return fetch(u).then(function (r) { if (r && r.ok) return cache.put(u, r); }).catch(function () {});
    });
    return Promise.all([one(top), one(cp)].concat(extra));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ns) {
    return Promise.all(ns.map(function (n) { if (n !== SW_CACHE && n.indexOf(SW_BASE) === 0) return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (!mine_(url)) return;

  /* ページ：通信が先。4秒で返事が無い・圏外なら保存した分 */
  if (req.mode === 'navigate') {
    var key = pageKey_(url);
    e.respondWith(caches.open(SW_CACHE).then(function (cache) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) {
          e.waitUntil(keepPage_(cache, key, res.clone(), req.url).catch(function () {}));
        }
        return res;
      });
      var timer = new Promise(function (resolve) { setTimeout(resolve, SW_TIMEOUT); });
      return Promise.race([net.catch(function () { return null; }), timer]).then(function (first) {
        if (first) return first;
        return cache.match(key).then(function (hit) {
          return hit || net;
        });
      });
    }));
    return;
  }

  /* 部品：保存した分があればそれ。無ければ取って保存（?v= の付いた js・css とアイコン） */
  if (/\.(js|css|png|json)$/.test(url.pathname)) {
    e.respondWith(caches.open(SW_CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok && (url.search || /\.(png|json)$/.test(url.pathname))) cache.put(req, res.clone());
          return res;
        });
      });
    }));
  }
});
