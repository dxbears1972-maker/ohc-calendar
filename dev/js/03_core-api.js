/* ---------- 便利関数 ---------- */
function $(id){ return document.getElementById(id); }
function pad2(n){ return (n < 10 ? '0' : '') + n; }
function dkey(y, m, d){ return y + '-' + pad2(m) + '-' + pad2(d); }

function lsGet(k){ try { return window.localStorage.getItem(k) || ''; } catch(e){ return ''; } }
function lsSet(k, v){ try { window.localStorage.setItem(k, v); } catch(e){} }

function setStatus(msg, isErr){
  var s = $('status');
  s.innerHTML = msg || '';
  s.className = isErr ? 'err' : '';
}

/* ★★2026-10-01b　名簿に端末が無いと断られたとき（サーバーの返事に needName）、その場に［お名前を選び直す］ボタンを出す。
   　10/1 実機（開発版「体験08」）：画面に名前が出ていても、名簿の「登録端末」が空だと断られ、どうすればよいか分からなかった。
   　★押すと名前の選び直しへ（確かめの問いは出さない＝ボタンの言葉どおり）。選び直すとその場で端末が登録される（claimName）。 */
function needNameBtn_(data){
  if (!data || !data.needName) return '';
  return '<div style="margin-top:8px"><button type="button" class="guidebtn" onclick="pickNameAgain()">お名前を選び直す</button></div>';
}
/* ★★2026-10-05a　この端末が名簿に登録されていないことを、★開いたときに★大きく知らせる。
   　10/4、杉野さんのパソコンは名前だけ覚えていて、名簿の「登録端末」には入っていなかった
   　（昔の専用URLで開いた端末。裏の自動の名乗りは確認番号が要るので通らず、黙って止まっていた）。
   　→ 予定を登録しようとして初めて断られ、断りの文は画面のいちばん上に小さく出るだけだった。
   　★サーバーは読み込みのたびに「この端末は誰のものか（me）」を返す。名前を覚えているのに me が空なら出す。 */
function devWarn_(show){
  var w = $('devWarn');
  if (!w) return;
  if (!show || !myName){ w.style.display = 'none'; w.innerHTML = ''; return; }
  var dn = '';
  try { dn = deviceName(); } catch(eD){}
  w.innerHTML = 'この' + esc(dn || '端末') + 'は、まだ「' + esc(myName) + '」さんの端末として登録されていません。<br>' +
    'このままでは、予定の登録や出欠の回答ができません。<br>' +
    '下のボタンを押して、お名前を選んでください。<br>' +
    '（4けたの確認番号を決めている方は、その番号も入れます）' +
    needNameBtn_({ needName: 1 });
  w.style.display = 'block';
}
function pickNameAgain(){
  devWarn_(false);
  try { closeGuide(); } catch(e1){}
  try { closePicker(); } catch(e2){}
  try { closePlanSheet(); } catch(e3){}
  resetName_();
}

/* ---------- 通信 ---------- */
/* ★★2026-09-29q　「❓ 使い方」を押したことを操作ログに残す（OHC本番 2026-09-29c と同じ。只隈さん「調べようと
   　頑張ったのか、食わず嫌いなのかがわかる」）。★画面には何も出さない・返事も待たない。
   　★サーバーは名乗った端末の分だけ残します（名乗る前に押しても残りません）。 */
function logGuideOpen(){
  try {
    if (!getName()) return;
    api('POST', { action: 'logGuide', kind: 'open', from: 'app', deviceId: deviceId() }, function(){});
  } catch(e){}
}

/* ==================================================================
   ★★2026-10-01a（B2 段6）　「❓ 使い方」を、アプリの中の枠で開く。
   　取説はWebに置かない（2026-09-28 案A）。名乗った方にだけ、GASが役割に合う文書を返す（action: 'guide'）。
   　・逆引き（faq）から始まる。逆引きの「見るところ」（a.gref）を押すと、その文書のその見出しへ
   　・「← もどる」で前の文書の前の位置へ／「✕ 閉じる」でカレンダーへ
   　・見られない文書（④など）を指す逆引きの行は隠す（GASが返す docs を見て）。★GAS側でも断る
   　・閉じたときに、見ていた時間といちばん下に見えた章を操作ログへ（取説のページと同じ）
   　・取説のHTMLは iframe（sandbox・中のスクリプトは動かない）に入れる。
   　　★iPhone では iframe の中が回らないので、iframe を中身の高さにして、外の箱を回す
   ================================================================== */
var GUIDE = { box: null, wrap: null, frame: null, cache: {}, docs: null, stack: [],
              cur: '', t0: 0, reach: '', busy: false };
var GUIDE_NAMES = { faq: '困ったときは', g1: '手順書①', g2: '手順書②', g3: '手順書③',
                    g4: '手順書④', intro: '導入案内', line1: 'LINEのお知らせ①', line2: 'LINEのお知らせ②' };

function guideBuild_(){
  if (GUIDE.box) return;
  var box = document.createElement('div');
  box.id = 'guideSheet';
  box.innerHTML =
    '<div class="guidebar">' +
      '<button type="button" id="guideBack" class="guidebtn">← もどる</button>' +
      '<span id="guideTitle" class="guidetitle"></span>' +
      '<button type="button" id="guideClose" class="guidebtn">✕ 閉じる</button>' +
    '</div>' +
    '<div id="guideWrap" class="guidewrap">' +
      '<div id="guideMsg" class="guidemsg"></div>' +
      '<iframe id="guideFrame" class="guideframe" sandbox="allow-same-origin" title="使い方"></iframe>' +
    '</div>';
  document.body.appendChild(box);
  GUIDE.box = box; GUIDE.wrap = $('guideWrap'); GUIDE.frame = $('guideFrame');
  $('guideBack').onclick = guideBack_;
  $('guideClose').onclick = closeGuide;
  GUIDE.wrap.addEventListener('scroll', guideLook_, { passive: true });
  window.addEventListener('resize', guideFit_);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden' && GUIDE.t0) guideLeaveLog_();
  });
}

function openGuide(){
  guideBuild_();
  logGuideOpen();
  GUIDE.stack = []; GUIDE.cur = ''; GUIDE.reach = ''; GUIDE.t0 = Date.now();
  document.body.classList.add('guideopen');
  GUIDE.box.style.display = 'flex';
  if (!getName()){
    guideMsg_('お名前を選んでから、もう一度「❓ 使い方」を押してください。<br>' +
      '（使い方の説明書は、カレンダーでお名前を選んだ方だけが見られます）' + needNameBtn_({ needName: 1 }), false);
    GUIDE.frame.style.display = 'none';
    $('guideTitle').innerHTML = '使い方';
    $('guideBack').style.visibility = 'hidden';
    return;
  }
  guideShow_('faq', '', 0);
}

function closeGuide(){
  if (GUIDE.t0) guideLeaveLog_();
  if (GUIDE.box) GUIDE.box.style.display = 'none';
  document.body.classList.remove('guideopen');
}

/* 閉じたとき（画面を離れたとき）に1回だけ送る */
function guideLeaveLog_(){
  var sec = Math.round((Date.now() - GUIDE.t0) / 1000);
  GUIDE.t0 = 0;
  try {
    if (!getName()) return;
    guideLook_();
    api('POST', { action: 'logGuide', kind: 'leave', sec: sec, reach: GUIDE.reach,
                  doc: GUIDE.cur, deviceId: deviceId() }, function(){});
  } catch(e){}
}

function guideMsg_(html, retry){
  var m = $('guideMsg');
  m.innerHTML = html + (retry ? '<div style="margin-top:12px"><button type="button" class="guidebtn" ' +
    'onclick="guideShow_(\'' + retry.doc + '\', \'' + retry.key + '\', 0, true)">もう一度読み込む</button></div>' : '');
  m.style.display = html ? 'block' : 'none';
}

/* doc を開いて key の見出しへ（key が無ければ y の位置へ）。noPush：もどる／やり直しのとき */
function guideShow_(doc, key, y, noPush){
  if (GUIDE.busy) return;
  if (GUIDE.cur && !noPush) GUIDE.stack.push({ doc: GUIDE.cur, y: GUIDE.wrap.scrollTop });
  if (GUIDE.cache[doc]) { guideRender_(doc, key, y); return; }
  GUIDE.busy = true;
  GUIDE.frame.style.display = 'none';
  $('guideTitle').innerHTML = esc(GUIDE_NAMES[doc] || '使い方');
  guideMsg_('読み込んでいます…', false);
  api('POST', { action: 'guide', doc: doc, deviceId: deviceId() }, function(err, data){
    GUIDE.busy = false;
    if (data && data.docs) GUIDE.docs = data.docs;
    /* ★★2026-10-01c　Wi‑Fi でも出るので「電波」のせいにしない。★取説の返事でないもの（html が無い）も同じ扱い */
    if (err || !data || (!data.error && typeof data.html !== 'string')){
      guideMsg_('返事が届きませんでした。下の「もう一度読み込む」を押してください。', { doc: doc, key: key || '' });
      return;
    }
    if (data.error){
      guideMsg_(esc(data.error) + needNameBtn_(data), false);
      if (GUIDE.stack.length) GUIDE.stack.pop();
      return;
    }
    GUIDE.cache[doc] = data.html;
    guideRender_(doc, key, y);
  });
}

function guideBack_(){
  var p = GUIDE.stack.pop();
  if (!p) { closeGuide(); return; }
  guideShow_(p.doc, '', p.y, true);
}

function guideRender_(doc, key, y){
  GUIDE.cur = doc;
  $('guideTitle').innerHTML = esc(GUIDE_NAMES[doc] || '使い方');
  $('guideBack').style.visibility = GUIDE.stack.length ? 'visible' : 'hidden';
  guideMsg_('', false);
  var fr = GUIDE.frame;
  fr.style.display = 'block';
  fr.style.height = '100px';
  fr.onload = function(){
    var d = fr.contentDocument;
    if (!d) return;
    if (doc === 'faq') guideTrimFaq_(d);
    d.addEventListener('click', guideClick_, true);
    guideFit_();
    var t = 0;
    if (key){
      var el = d.getElementById(key);
      if (el) t = guideTop_() + el.getBoundingClientRect().top - 6;
    } else if (y) t = y;
    GUIDE.wrap.scrollTop = t;
    guideLook_();
  };
  fr.srcdoc = GUIDE.cache[doc];
}

/* iframe を中身の高さに（外の箱を回すため） */
function guideFit_(){
  var fr = GUIDE.frame;
  try {
    var d = fr.contentDocument;
    if (!d || !d.body || fr.style.display === 'none') return;
    fr.style.height = '100px';
    fr.style.height = Math.max(d.documentElement.scrollHeight, d.body.scrollHeight) + 'px';
  } catch(e){}
}

/* 逆引きから、見られない文書を指すリンク・行・表を外す */
function guideTrimFaq_(d){
  if (!GUIDE.docs) return;
  var as = d.querySelectorAll('a.gref');
  for (var i = 0; i < as.length; i++){
    var a = as[i];
    if (GUIDE.docs.indexOf(a.getAttribute('data-doc')) >= 0) continue;
    var sib = a.previousSibling;
    if (sib && sib.nodeType === 3 && /／\s*$/.test(sib.nodeValue)) sib.nodeValue = sib.nodeValue.replace(/\s*／\s*$/, '');
    else if (a.nextSibling && a.nextSibling.nodeType === 3) a.nextSibling.nodeValue = a.nextSibling.nodeValue.replace(/^\s*／\s*/, '');
    a.parentNode.removeChild(a);
  }
  var trs = d.querySelectorAll('tbody tr');
  for (var k = 0; k < trs.length; k++){
    var tr = trs[k];
    var cell = tr.cells[tr.cells.length - 1];
    if (cell && !cell.querySelector('a.gref')) tr.parentNode.removeChild(tr);
  }
  /* 節ごと外す：③幹事の方・④管理者の方の節は、その手順書が見られない方には出さない（行が②を指していても） */
  var secDoc = { 'faq-kanji': 'g3', 'faq-admin': 'g4' };
  for (var sid in secDoc){
    var h = d.getElementById(sid);
    if (!h || GUIDE.docs.indexOf(secDoc[sid]) >= 0) continue;
    var kp0 = h.parentNode && h.parentNode.parentNode;
    if (kp0 && kp0.className === 'keep') kp0.parentNode.removeChild(kp0);
  }
  var tbs = d.querySelectorAll('table');
  for (var t = 0; t < tbs.length; t++){
    if (tbs[t].querySelector('tbody tr')) continue;
    var kp = tbs[t].parentNode;
    if (kp && kp.className === 'keep') kp.parentNode.removeChild(kp);
    else tbs[t].parentNode.removeChild(tbs[t]);
  }
}

function guideClick_(ev){
  var a = ev.target;
  while (a && a.nodeName !== 'A') a = a.parentNode;
  if (!a || !a.getAttribute) return;
  var href = a.getAttribute('href') || '';
  ev.preventDefault();
  if (a.className === 'gref'){
    var doc = a.getAttribute('data-doc'), key = a.getAttribute('data-key');
    if (doc === GUIDE.cur) guideJump_(key);
    else guideShow_(doc, key, 0);
  } else if (href.charAt(0) === '#'){
    guideJump_(href.substring(1));
  } else if (/^https?:/.test(href)){
    window.open(href, '_blank', 'noopener');
  }
}

/* 外の箱（guideWrap）の中で、iframe がどこから始まるか（★offsetTop は guideSheet から測るので使わない） */
function guideTop_(){
  return GUIDE.frame.getBoundingClientRect().top - GUIDE.wrap.getBoundingClientRect().top + GUIDE.wrap.scrollTop;
}

function guideJump_(key){
  var el = GUIDE.frame.contentDocument && GUIDE.frame.contentDocument.getElementById(key);
  if (el) GUIDE.wrap.scrollTop = guideTop_() + el.getBoundingClientRect().top - 6;
}

/* いちばん下に見えた章（取説のページの look() と同じ考え方） */
function guideLook_(){
  try {
    var d = GUIDE.frame.contentDocument;
    if (!d) return;
    var hs = d.querySelectorAll('.section h2');
    var lim = GUIDE.wrap.scrollTop + GUIDE.wrap.clientHeight - guideTop_();
    var best = '';
    for (var i = 0; i < hs.length; i++){
      if (hs[i].getBoundingClientRect().top < lim) best = String(hs[i].textContent || '').split('（')[0].replace(/^\s+|\s+$/g, '');
    }
    if (best) GUIDE.reach = (GUIDE_NAMES[GUIDE.cur] || '') + ' ' + best;
  } catch(e){}
}

var READ_ONLY_POST_ = { guide: 1, adminView: 1, adminStats: 1, needCode: 1 };

function api(method, body, cb, tryNo, fresh){
  if (API_URL.indexOf('http') !== 0){
    setStatus('設定が終わっていません（GASのURLが未設定です）', true);
    return;
  }
  /* ------------------------------------------------------------------
     ★2026-08-04：1回だけ、やり直します。

     サーバー（GAS）は落ちていません。実行の記録を見ると、
     どれも「完了」していますが、**返事に4〜5秒かかっています。**
     電波が弱いときや、待っている間に画面を切り替えたときに、
     返事が届く前に通信が切れて「通信できませんでした」と出ていました。

     一度きりのつまずきがほとんどなので、
     2秒おいてもう一度だけ試します。それでも駄目なら、今までどおり知らせます。
     ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     ★★★2026-09-14　送り直すのは★読み込み（GET）だけにしました。

     　只隈さんが予定を1件登録されたのに、★サーバーに2件入り、
     　しかも★アプリの手元には0件、ということが起きました（2026-09-14）。

     　仕組みはこうでした。
     　　1回目のPOST → サーバーは受け取って予定を1件書いた
     　　　　　　　　→ ★返事が届かなかった（4〜5秒かかるので切れることがある）
     　　　　　　　　→ アプリは「失敗」と見て、もう一度送った
     　　　2回目のPOST → ★サーバーはまた1件書いた（これが2件目）

     　★★読み込みは何度やっても同じですが、書き換えはそうではありません。
     　★本番で起きれば、予定が2件並ぶだけでなく、
     　　★会員へのメールとLINEも 2回飛びます。
     　→ ★書き換え（POST）は、1回だけ送ります。
     　　 ★失敗したときの知らせ方は post() で変えています。
     ------------------------------------------------------------------ */
  tryNo = tryNo || 1;
  var done = false;
  function fail(){
    if (done) return;
    done = true;
    /* ★★2026-09-28　読み込み（GET）のやり直しを、1回から3回に増やしました。
       　本番の実行数では、サーバーは毎回「完了」しているのに、
       　「通信できませんでした」が出ていました＝返事が途中で届いていない。
       　間を 2秒・4秒・6秒 と空けて取り直します。
       　★その間も、端末の控え（前回の内容）は表示されたままです。
       　★書き換え（POST）は、これまでどおり1回だけです（下の説明のとおり）。 */
    /* ★★2026-10-01c　読むだけの POST（取説・管理者の画面・集計・確認番号の有無）も、GET と同じく取り直します。
    　10/1 夜（OHC 本番）：サーバーは数秒で「完了」しているのに、取説が3回続けて「通信できませんでした」になった
    　（返事がアプリに届く手前で消える。9/28 の調査と同じ形）。★これらは何も書かないので、取り直しても二重になりません。
    　★書き込みは今までどおり1回だけです。 */
    if (tryNo < 4 && (method === 'GET' || (body && READ_ONLY_POST_[body.action]))){
      setTimeout(function(){ api(method, body, cb, tryNo + 1, fresh); }, 2000 * tryNo);
      return;
    }
    cb(true);
  }
  var xhr = new XMLHttpRequest();
  var url = API_URL;
  /* ★2026-09-04（工事B）　どのクラブの用事かを、必ずURLで伝えます。
     　付けないとサーバーが送信内容をのぞきに行くため、二度読みになります。 */
  url += (url.indexOf('?') >= 0 ? '&' : '?') + 'club=' + encodeURIComponent(CLUB.id);
  if (method === 'GET'){
    url += (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + new Date().getTime();
    /* この端末の記号もいっしょに送る。
       サーバーが「この端末は誰のものか」を名簿から答えてくれます。 */
    try { url += '&dev=' + encodeURIComponent(deviceId()); } catch(eD){}
    /* 「最新の情報に更新する」を押したときは、サーバーにおぼえたものを
       使わないよう伝えます（シートを手で直したときのため） */
    if (fresh) url += '&fresh=1';
    /* ★★2026-09-28e（ウ）　送る期間を絞ったので、
    　・古い月を1か月だけ取りに行くときは ?only=YYYY-MM
    　・ふだんは、すでに取ってある古い月（?months=）と、精算から戻った行き先（?goto=）を添える */
    if (body && body.only){
      url += '&only=' + encodeURIComponent(body.only);
    } else {
      if (state.oldMonths && state.oldMonths.length) url += '&months=' + encodeURIComponent(state.oldMonths.join(','));
      if (gotoId) url += '&goto=' + encodeURIComponent(gotoId);
    }
    xhr.open('GET', url, true);
  } else {
    /* ★★2026-10-05a　機種（パソコン／iPhone／Android）を添える。サーバーは操作ログの「端末」の欄に書きます */
    try { if (body && !body.devName) body.devName = deviceName(); } catch(eDN){}
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
  }
  xhr.onreadystatechange = function(){
    if (xhr.readyState !== 4 || done) return;
    if (xhr.status >= 200 && xhr.status < 300){
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch(e){}
      if (data){ done = true; cb(null, data); } else { fail(); }
    } else {
      fail();
    }
  };
  /* 30秒たっても返事がなければ、待つのをやめてやり直します */
  xhr.timeout = 30000;
  xhr.ontimeout = fail;
  xhr.onerror = fail;
  /* ★2026-09-28e（ウ）　書き込みのあとの返事にも、取ってある古い月を入れてもらう */
  if (method !== 'GET' && body && !body.months && state.oldMonths && state.oldMonths.length){
    body.months = state.oldMonths.slice();
  }
  try {
    xhr.send(method === 'GET' ? null : JSON.stringify(body));
  } catch(e){ fail(); }
}

function applyData(data){
  /* ★★★2026-09-15（工事E-5d）　サーバーから新しい中身が届いたら、
     　管理者の画面の控え（ADMIN_DATA）は★一つ古くなります。
     　消したお知らせが「いま出ています」のまま見えていたのは、これが理由でした。
     　★控えは捨てません（開いている画面が壊れるため）。★印だけ立て、
     　　次にボタンを押したときに読み直します。 */
  ADMIN_STALE = true;
  /* ★2026-09-04（工事B B-2）　クラブの見た目・呼び名。届いたら画面に当て、端末に控える */
  if (data && data.club) { try { setClubCfg_(data.club, true); } catch(eCC){} }
  /* ★2026-08-24　LINEの残り通数（幹事・管理者にだけ届きます） */
  if (data && typeof data.lineLeft !== 'undefined') lineLeft = data.lineLeft;
  if (data && typeof data.lineMode !== 'undefined') lineMode = data.lineMode;
  /* ★2026-09-22（LINE通数の見える化）　今月の使用・枠・群の人数・自動の連絡の日 */
  if (data && typeof data.lineUsed  !== 'undefined') lineUsed  = data.lineUsed;
  if (data && typeof data.lineLimit !== 'undefined') lineLimit = data.lineLimit;
  if (data && typeof data.lineSize  !== 'undefined') lineSize  = data.lineSize;
  if (data && typeof data.lineDays  !== 'undefined') lineDays  = data.lineDays;
  state.events = data.events || [];
  state.attendance = data.attendance || [];
  /* ★2026-09-28e（ウ）　どこから先が届いたか／古い月はどれが入っているか */
  state.winFrom = data.winFrom || '';
  state.oldMonths = data.winMonths || [];
  if (data.notices) state.notices = data.notices;

  /* 名簿シートの内容を受け取ったら、こちらの一覧を入れ替える。
     （幹事さんがシートに1行足せば、次に開いたときから反映されます）
     受け取れなかったとき（圏外の控えを表示しているときなど）は、
     いまの一覧をそのまま使う。 */
  /* ★2026-09-02　作業マスタ（あしあと印刷など）。空でも受け取る。 */
  if (data.works) WORKS = data.works;
  try { fillTargetSelect_(); } catch (e) {}
  if (data.members && data.members.length) {
    MEMBERS = data.members;
    /* ★2026-10-05b　保守業者の名前（保守業者の端末でだけ届く）。人数・出欠の数から外す */
    MAINT_NAMES = data.maints || [];
    /* 名簿が読めているのに管理者が1人もいないときは、管理者なしのまま。
       ここでコードの名前を使うと、ほかのクラブでも只隈が管理者になってしまう。 */
    ADMINS  = (data.admins && data.admins.length) ? data.admins : [];
    EDITORS = data.editors || [];
    ADMIN_NAME = ADMINS[0] || '';

    TAKEN = data.taken || [];
    CONTACTS = data.contacts || [];
    DRIVERS = data.drivers || [];   /* ★2026-09-29q */
    /* ★2026-09-30a　返事が届いた。管理者の画面で「読み込んでいます」の間に開いていた選ぶ欄を、最新にする */
    DRIVERS_FRESH = true;
    try { admDrvRefresh_(); } catch (eDR) {}

    /* ★★2026-09-21（工事G-2 (b) 追補）　管理者なのに4けたがまだ無い方に、
       　この場で決めていただくためのお誘いを出します（1回だけ聞きます）。 */
    try { askMustSetCode_(); } catch (eMC) {}

    /* サーバー（GAS）の版も画面いちばん下に出す。
       貼り替えとデプロイができているかを、目で確かめられるように。 */
    try {
      var vl = $('verLine');
      if (vl && data.gasver){
        vl.innerHTML = '版 ' + esc(APP_VER) + '（サーバー ' + esc(data.gasver) + '）';
      }
    } catch(e){}

    /* 読み方の対応表を作り直す */
    MEMBER_YOMI = {};
    if (data.yomis){
      for (var yi = 0; yi < MEMBERS.length; yi++){
        MEMBER_YOMI[MEMBERS[yi]] = data.yomis[yi] || '';
      }
    }
    /* ★2026-08-25　誰がLINEのお知らせに登録済みかの対応表 */
    MEMBER_LINE = {}; MEMBER_LINE_KNOWN = false;
    if (data.lineOks && data.lineOks.length){
      MEMBER_LINE_KNOWN = true;
      for (var li = 0; li < MEMBERS.length; li++){
        MEMBER_LINE[MEMBERS[li]] = !!data.lineOks[li];
      }
    }
    /* ★修正8　メールのアドレスが名簿にあるかどうか（アドレスそのものは来ない） */
    MEMBER_MAIL = {}; MEMBER_MAIL_KNOWN = false;
    if (data.mailOks && data.mailOks.length){
      MEMBER_MAIL_KNOWN = true;
      for (var mk = 0; mk < MEMBERS.length; mk++){
        MEMBER_MAIL[MEMBERS[mk]] = !!data.mailOks[mk];
      }
    }
    /* 名字 → 会員ID の対応表も作り直す */
    MEMBER_ID = {}; ID_NAME = {}; MEMBER_TEL = {};
    if (data.ids){
      for (var ii = 0; ii < MEMBERS.length; ii++){
        if (data.ids[ii]){
          MEMBER_ID[MEMBERS[ii]] = String(data.ids[ii]);
          ID_NAME[String(data.ids[ii])] = MEMBERS[ii];
        }
      }
    }
    /* 電話番号は幹事・管理者にしか届きません（届かなければ空のまま） */
    canWriteNotice = !!data.canNotice;
    /* クラブのLINEグループへのボタン。URLが決まっているときだけ出す */
    lineGroupUrl = data.lineGroupUrl || '';
    if (lineGroupUrl){
      $('lineGo').href = lineGroupUrl;
      $('lineCell').style.display = 'table-cell';
    } else {
      $('lineCell').style.display = 'none';
    }
    if (data.tels){
      for (var ti = 0; ti < MEMBERS.length; ti++){
        if (data.tels[ti]) MEMBER_TEL[MEMBERS[ti]] = String(data.tels[ti]);
      }
    }
    /* 名前を選ぶ画面が出ていたら、新しい名簿で作り直す */
    if ($('nameCard').style.display === 'block') renderNamePick();

    /* 管理者が1人もいないと、締め切り・削除・お知らせができません。
       誰も気づけないと困るので、開いた人全員に知らせます（起動時に1回だけ）。 */
    if (ADMINS.length === 0 && !adminWarned){
      adminWarned = true;
      setTimeout(function(){
        alert('このクラブには、まだ「管理者」がいません。\n\n' +
              '名簿シートの「役割」で、どなたか1名を\n' +
              '「管理者」に決めてください。\n\n' +
              '決まるまでは、予定の締め切り・削除や\n' +
              'お知らせの投稿ができません。');
      }, 600);
    }

    /* 連絡窓口が決まっていないことを、管理者に知らせる（起動時に1回だけ） */
    if (isAdmin_(myName) && CONTACTS.length === 0 && !editorWarned){
      editorWarned = true;
      setTimeout(function(){
        alert('連絡窓口が決まっていません。\n\n' +
              '会員の方が困ったときに、誰に聞けばよいかを\n' +
              'アプリの中で案内できません。\n\n' +
              '名簿シートの「連絡窓口」の欄に「○」を入れて、\n' +
              '担当の方を決めてください。\n\n' +
              '（決まるまでは、' + contactName() + 'のお名前が出ます）');
      }, 800);
    }

    /* ------------------------------------------------------------------
       サーバーが「この端末は◯◯さんのものです」と教えてくれた場合。
       名簿の登録端末を見て答えているので、これがいちばん確かです。
       端末の中の覚えが消えていても、ここで元に戻ります。
       ------------------------------------------------------------------ */
    /* ★★2026-10-05a　名前を覚えているのに、サーバーが「この端末は名簿に無い（me が空）」と言ったら、大きく知らせる */
    if (Object.prototype.hasOwnProperty.call(data, 'me') && data.members){
      devWarn_(!data.me && !!myName);
    }
    if (data.me && data.me.name && MEMBERS.indexOf(data.me.name) >= 0){
      if (data.me.id) lsSet(LSK.mid, String(data.me.id));
      if (myName !== data.me.name){
        var was = myName;
        myName = data.me.name;
        lsSet(LSK.name, myName);
        lsSet(LSK.claimed, myName);
        updateWho();
        if ($('nameCard').style.display === 'block'){
          $('nameCard').style.display = 'none';
          namePickRow = '';
        }
        $('showImport').style.display = isStaff(myName) ? 'block' : 'none';
        setStatus(was ? ('お名前の表記が「' + myName + '」に変わりました')
                      : (myName + 'さんとして開いています'));
        renderInstallCard();
      }
    }

    /* ------------------------------------------------------------------
       名簿で名字が直されたときの追従。
       この端末は「会員ID」でも持ち主を覚えています。
       「只隈」→「只隈（吉）」のように直されても、
       名前を聞き直さず、そのまま新しい表記に切り替わります。
       ------------------------------------------------------------------ */
    if (myName && MEMBERS.indexOf(myName) >= 0){
      /* ふだんは、いまの名前の会員IDを控えておく */
      if (idOf(myName)) lsSet(LSK.mid, idOf(myName));
    } else if (myName) {
      var keepId = lsGet(LSK.mid);
      var newNm  = keepId ? nameOfId(keepId) : '';
      if (newNm){
        myName = newNm;
        lsSet(LSK.name, newNm);
        if (lsGet(LSK.claimed)) lsSet(LSK.claimed, newNm);
        updateWho();
        /* 名前を選ぶ画面が出ていたら、引っ込める */
        if ($('nameCard').style.display === 'block'){
          $('nameCard').style.display = 'none';
          namePickRow = '';
        }
        $('showImport').style.display = isStaff(myName) ? 'block' : 'none';
        setStatus('お名前の表記が「' + newNm + '」に変わりました');
      } else {
        /* 名簿に載っていない名前が端末に残っていたら、名乗りを外す
           （退会された方の端末など） */
        myName = '';
        updateWho();
        showNamePick();
      }
    }
    /* 役割が変わっているかもしれないので、管理者向けボタンを出し直す */
    $('showImport').style.display = isStaff(myName) ? 'block' : 'none';
  }

  /* 次回の起動をすぐにするため、端末に内容を記憶しておく */
  try {
    /* ★2026-09-28e（ウ）　控えに残すのは「先月1日から先」だけ。
    　開いた古い月まで残すと、使うほど控えが大きくなるため */
    var cw = winSlice_();
    lsSet(LSK.cache, JSON.stringify({
      events: cw.events, attendance: cw.attendance, notices: state.notices,
      winFrom: state.winFrom,
      /* 名簿も控えておく。圏外のときに、コードに書いてある古い一覧ではなく、
         最後に受け取った本物の名簿を使えるようにするため。 */
      members: MEMBERS, yomis: (function(){
        var y = []; for (var q2 = 0; q2 < MEMBERS.length; q2++) y.push(MEMBER_YOMI[MEMBERS[q2]] || '');
        return y;
      })(),
      ids: (function(){
        var d = []; for (var q3 = 0; q3 < MEMBERS.length; q3++) d.push(MEMBER_ID[MEMBERS[q3]] || '');
        return d;
      })(),
      admins: ADMINS, editors: EDITORS, taken: TAKEN, contacts: CONTACTS,
      drivers: DRIVERS   /* ★2026-09-29q */
      /* 電話番号は控えに残しません。端末に置いたままにしないためです */
    }));
  } catch(e){}
  render();
}

/* ------------------------------------------------------------------
   更新ボタンの文字を、その場で変えます。（2026-08-04）
   読み込みが速くなり、画面の上に出る知らせが一瞬で消えるようになりました。
   ボタンは画面の下にあるため、押した本人に結果が見えません。
   ------------------------------------------------------------------ */
function reloadBtnText_(msg){
  var b = $('reloadBtn');
  if (!b) return;
  if (window.reloadBtnTimer) clearTimeout(window.reloadBtnTimer);
  if (msg){
    b.textContent = msg;
    window.reloadBtnTimer = setTimeout(function(){
      b.textContent = '最新の情報に更新する';
    }, 3000);
  } else {
    b.textContent = '最新の情報に更新する';
  }
}

function load(fresh){
  var hasCache = state.events.length > 0;
  setStatus(hasCache ? '最新の情報を確認しています…' : '読み込み中…');
  var rb = $('reloadBtn');
  if (rb){
    if (window.reloadBtnTimer) clearTimeout(window.reloadBtnTimer);
    rb.textContent = '更新しています…';
  }
  api('GET', null, function(err, data){
    if (err){
      setStatus(hasCache
        ? '通信できませんでした。前回の内容を表示しています。'
        : '読み込みに失敗しました。電波の良い場所で「最新の情報に更新する」を押してください。', true);
      reloadBtnText_('通信できませんでした');
      return;
    }
    /* ------------------------------------------------------------------
       退会した方の、いつもの端末（サーバーが名簿の登録端末で確かめて
       教えてくれる）。中身は渡ってこないので、ここでブロック画面に
       切り替えて終わる。手元の控え（前回の内容）はいじらない。
       ------------------------------------------------------------------ */
    if (data && data.retired){
      showRetiredBlock();
      setStatus('');
      reloadBtnText_('');
      return;
    }
    /* ★2026-09-04（工事B）　サーバーが「そのクラブは受け付けません」と
       　断ったとき。中身は渡ってこないので、理由を画面に出して終わります。 */
    if (data && data.error){
      setStatus(String(data.error) +
        '（URLの ?club= をお確かめください）', true);
      reloadBtnText_('開けませんでした');
      return;
    }
    hideRetiredBlock();
    /* 速くなったぶん、終わったことが分かるように数秒だけ知らせます */
    var nowT = new Date();
    var hh = ('0' + nowT.getHours()).slice(-2);
    var mm = ('0' + nowT.getMinutes()).slice(-2);
    setStatus('最新の内容にしました（' + hh + ':' + mm + '）');
    reloadBtnText_('✓ 最新の内容にしました（' + hh + ':' + mm + '）');
    if (window.statusClearTimer) clearTimeout(window.statusClearTimer);
    window.statusClearTimer = setTimeout(function(){ setStatus(''); }, 3000);
    applyData(data);
    tryGoto();
    /* 作り直しで位置がずれるので、合わせ直す */
    if (gotoStick){
      var sid = gotoStick;
      scrollToEv(sid);
      setTimeout(function(){ scrollToEv(sid); gotoStick = ''; }, 350);
    }
  }, 1, fresh);
}

/* 精算アプリから戻ってきたとき、その予定の場所を表示する */
function tryGoto(){
  if (!gotoId) return;
  var ev = null;
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === gotoId) ev = state.events[i];
  }
  /* 手元の控えに無ければ、まだ消さない。
     サーバーの返事が届いたときに、もう一度ここへ来る。 */
  if (!ev) return;
  gotoId = '';
  var p = ev.date.split('-');
  state.year = parseInt(p[0], 10);
  state.month = parseInt(p[1], 10);
  render();
  var el = $('ev-' + ev.id);
  if (!el && !state.showOldEvents){
    /* 終わって3日過ぎて隠れている予定なら、表示してから移動 */
    state.showOldEvents = true;
    renderList();
    el = $('ev-' + ev.id);
  }
  scrollToEv(ev.id);
  /* ------------------------------------------------------------------
     この予定を「行き先」として少しの間だけ覚えておきます。
     サーバーの返事が届くと画面を作り直すため、行の高さが変わり、
     先に合わせた位置がずれてしまうためです。
     作り直したあと、もう一度きちんと合わせ直します。
     ------------------------------------------------------------------ */
  gotoStick = ev.id;
  setTimeout(function(){ if (gotoStick === ev.id) gotoStick = ''; }, 8000);
}

/* その予定の場所へ、画面をきちんと合わせる。
   上に少し余白を残して、見出しが隠れないようにする。 */
function scrollToEv(id){
  var el = $('ev-' + id);
  if (!el) return;
  try {
    /* ★2026-09-28　上に残る月の帯（#monthBar）の下に、見出しが隠れないようにする */
    var bar = $('monthBar'), barH = 0;
    if (bar) barH = bar.offsetHeight + (parseFloat(getComputedStyle(bar).top) || 0);
    var y = el.getBoundingClientRect().top + window.pageYOffset - 12 - barH;
    window.scrollTo(0, y < 0 ? 0 : y);
  } catch(e){
    if (el.scrollIntoView) el.scrollIntoView(true);
  }
}

function post(body, doneMsg, after, onFail){
  setStatus('送信中…');
  /* この端末の記号を必ず添える。サーバーは名簿の登録端末を見て、
     送ってきたのが誰かを確かめます（名前まかせにしないため）。 */
  try { if (body && !body.deviceId) body.deviceId = deviceId(); } catch(eP){}
  api('POST', body, function(err, data){
    if (err){
      /* ★★★2026-09-14　「もう一度お試しください」は★間違った案内でした。
         　返事が届かなかっただけで、★サーバーには入っていることがあります。
         　そのまま押し直すと、★二重に入ります。
         　→ ★先に確かめていただく言い方に変えました。 */
      setStatus('送れたかどうか分かりません。' +
                '★「最新の情報に更新する」を押して、' +
                '入っているか確かめてから、もう一度お願いします。', true);
      if (onFail) { try { onFail(); } catch(eF){} }
      return;
    }
    if (data && data.error){
      setStatus(data.error + needNameBtn_(data), true);
      /* ★★2026-10-05a　登録されていない端末で断られたら、上の大きな案内も出して、画面をいちばん上へ。
         　（フォームが下のほうにあると、上の断りの文が見えなかった。10/4 杉野さんのパソコン） */
      if (data.needName){
        devWarn_(true);
        try { window.scrollTo(0, 0); } catch(eS){}
      }
      if (onFail) { try { onFail(); } catch(eF2){} }
      return;
    }
    setStatus(doneMsg || '');
    applyData(data);
    /* ★2026-09-29j　作り直しで位置がずれるので、戻った先の予定に合わせ直す（8秒の間だけ） */
    if (gotoStick) { try { scrollToEv(gotoStick); } catch(eG){} }
    if (after) { try { after(data); } catch(eA){} }
  });
}



/* ==================================================================
   ★★2026-09-28e（ウ）　古い月は、その月を開いたときに取りに行く
   　サーバーがふだん送るのは「先月1日から先」だけです。
   　それより前の月へカレンダーを戻したら、その月の分（月15件ほど）だけ取ってきます。
   ================================================================== */
function monthKey_(){ return state.year + '-' + pad2(state.month); }

/* その月をまだ持っていないか */
function monthNeedsFetch_(ym){
  if (!state.winFrom || !/^\d{4}-\d{2}$/.test(ym)) return false;
  if (ym + '-01' >= state.winFrom) return false;
  return state.oldMonths.indexOf(ym) < 0;
}

/* 控えに残す分（先月1日から先） */
function winSlice_(){
  if (!state.winFrom) return { events: state.events, attendance: state.attendance };
  var evs = [], keep = {}, att = [], i;
  for (i = 0; i < state.events.length; i++){
    var d = String(state.events[i].date || '');
    if (!/^\d{4}-\d{2}/.test(d) || d >= state.winFrom){ evs.push(state.events[i]); keep[state.events[i].id] = 1; }
  }
  for (i = 0; i < state.attendance.length; i++) if (keep[state.attendance[i].eventId]) att.push(state.attendance[i]);
  return { events: evs, attendance: att };
}

/* 取ってきた1か月分を入れ替える */
function mergeMonth_(ym, data){
  var drop = {}, evs = [], att = [], i;
  for (i = 0; i < state.events.length; i++){
    if (String(state.events[i].date || '').slice(0, 7) === ym) drop[state.events[i].id] = 1;
    else evs.push(state.events[i]);
  }
  for (i = 0; i < state.attendance.length; i++) if (!drop[state.attendance[i].eventId]) att.push(state.attendance[i]);
  state.events = evs.concat(data.events || []);
  state.attendance = att.concat(data.attendance || []);
  if (state.oldMonths.indexOf(ym) < 0) state.oldMonths.push(ym);
}

/* cb(ok)。持っていれば、すぐ cb(true) */
function ensureMonth_(ym, cb){
  if (!monthNeedsFetch_(ym)){ if (cb) cb(true); return; }
  if (MONTH_BUSY[ym]){ if (cb) MONTH_BUSY[ym].push(cb); return; }
  MONTH_BUSY[ym] = cb ? [cb] : [];
  api('GET', { only: ym }, function(err, data){
    var cbs = MONTH_BUSY[ym] || [];
    delete MONTH_BUSY[ym];
    var ok = !err && data && !data.error && !data.retired && data.only === ym;
    if (ok){ mergeMonth_(ym, data); delete MONTH_FAIL[ym]; }
    else MONTH_FAIL[ym] = true;
    render();
    for (var i = 0; i < cbs.length; i++){ try { cbs[i](ok); } catch(eC){} }
  });
}

/* いくつかの月をまとめて（順番に）。cb(全部取れたか) */
function ensureMonths_(list, cb){
  var i = 0;
  (function next(ok){
    if (!ok) { cb(false); return; }
    if (i >= list.length) { cb(true); return; }
    ensureMonth_(list[i++], next);
  })(true);
}
