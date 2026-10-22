/* ---------- カレンダー描画 ---------- */
function eventsOn(key){
  var r = [];
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].date === key) r.push(state.events[i]);
  }
  return r;
}

function renderCalendar(){
  var y = state.year, m = state.month;
  $('ymLabel').innerHTML = y + '年' + m + '月';
  /* ★2026-10-19a　見出し「○月の予定」は外した（月は上の帯に出ている） */
  if ($('listTitle')) $('listTitle').innerHTML = m + '月の予定';

  var first = new Date(y, m - 1, 1);
  var startDow = first.getDay();
  var days = new Date(y, m, 0).getDate();
  var now = new Date();
  var todayKey = dkey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  var html = '<tr>';
  for (var w = 0; w < 7; w++){
    var cls = w === 0 ? ' class="sun"' : (w === 6 ? ' class="sat"' : '');
    html += '<th' + cls + '>' + WEEK[w] + '</th>';
  }
  html += '</tr>';

  var cell = 0;
  var d = 1;
  while (d <= days){
    html += '<tr>';
    for (var c = 0; c < 7; c++){
      if ((cell < startDow) || d > days){
        html += '<td class="out"></td>';
      } else {
        var key = dkey(y, m, d);
        var evs = eventsOn(key);
        var classes = [];
        if (c === 0) classes.push('sun');
        if (c === 6) classes.push('sat');
        if (evs.length > 0) classes.push('hasev');
        if (key === todayKey) classes.push('today');
        var marks = '', allCancel = evs.length > 0;
        for (var e = 0; e < evs.length && e < 2; e++){
          var t = evs[e].title;
          if (t.length > 5) t = t.substring(0, 5) + '…';
          /* 中止になった山行は、カレンダーでも取り消し線で出す */
          marks += (evs[e].cancelled ? '<s>' + esc(t) + '</s>' : esc(t)) + '<br>';
        }
        for (var e2 = 0; e2 < evs.length; e2++){
          if (!evs[e2].cancelled) allCancel = false;
        }
        if (allCancel) classes.push('allcancel');
        if (evs.length > 2) marks += '他' + (evs.length - 2) + '件';
        html += '<td class="' + classes.join(' ') + '" onclick="tapDay(' + d + ')">' +
                '<div class="dnum">' + d + '</div>' +
                '<div class="marks">' + marks + '</div></td>';
        d++;
      }
      cell++;
    }
    html += '</tr>';
  }
  $('calTable').innerHTML = html;
}

function tapDay(d){
  /* ★2026-09-28　最後に押した日を覚えておき、「＋予定を追加する」をその日付で開く */
  state.lastTap = { y: state.year, m: state.month, d: d };
  var key = dkey(state.year, state.month, d);
  var evs = eventsOn(key);
  if (evs.length > 0){
    /* 隠れている（終わって3日過ぎた）予定なら、いったん全部表示してから移動 */
    if (!$('ev-' + evs[0].id) && !state.showOldEvents){
      state.showOldEvents = true;
      renderList();
    }
    var el = $('ev-' + evs[0].id);
    if (el && el.scrollIntoView) el.scrollIntoView(true);
  } else {
    /* 予定がない日 → 追加フォームをその日付で開く */
    openAddForm(state.year, state.month, d);
  }
}

/* ★★2026-09-28　予定のカードの「＋この日に別の予定を入れる」から、その日付で入力画面を開く */
function addSameDay(key){
  var p = String(key || '').split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
  if (!y || !m || !d) return;
  state.lastTap = { y: y, m: m, d: d };
  openAddForm(y, m, d);
}

/* ---------- 予定一覧描画 ---------- */
function fmtDate(key){
  var p = key.split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
  var dow = new Date(y, m - 1, d).getDay();
  var wcls = dow === 0 ? 'sun' : (dow === 6 ? 'sat' : '');
  return m + '月' + d + '日 <span class="' + wcls + '">(' + WEEK[dow] + ')</span>';
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Googleドライブ／ドキュメントのリンクを、アカウント選択の出にくい
   「プレビュー表示」に変換して開く。編集したい人はプレビュー画面から
   「Googleドキュメントで開く」を押せば通常画面に進める。 */
function previewLink(url){
  var u = String(url == null ? '' : url);
  if (!u) return u;
  /* .../d/<ID>/... 形式（docs, drive/file など）→ /d/<ID>/preview */
  var m = u.match(/^(https:\/\/[^\/]*\.google\.com\/[^?]*\/d\/[a-zA-Z0-9_-]+)/);
  if (m) return m[1] + '/preview';
  /* open?id=<ID> 形式 → ドライブのプレビューURLに変換 */
  var m2 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && u.indexOf('google.com') >= 0) return 'https://drive.google.com/file/d/' + m2[1] + '/preview';
  return u;
}

/* ============================================================
   カレンダー連携（Googleカレンダーに追加 / .icsダウンロード）
   ・時間ありの予定：開始＝その時刻、終了＝2時間後（日本時間）
   ・時間なしの予定：終日予定
   ============================================================ */
/* 予定から開始・終了の日時文字列を作る */
function calTimes(ev){
  var p = (ev.date || '').split('-');
  var y = p[0], mo = p[1], d = p[2];
  var tm = ev.time ? String(ev.time).match(/(\d{1,2}):(\d{2})/) : null;
  if (tm){
    var hh = ('0' + tm[1]).slice(-2), mm = tm[2];
    var startLocal = y + mo + d + 'T' + hh + mm + '00';
    var endDt = new Date(parseInt(y,10), parseInt(mo,10) - 1, parseInt(d,10), parseInt(tm[1],10) + 2, parseInt(mm,10));
    var endLocal = endDt.getFullYear() + pad2(endDt.getMonth() + 1) + pad2(endDt.getDate()) +
                   'T' + pad2(endDt.getHours()) + pad2(endDt.getMinutes()) + '00';
    return { allday: false, start: startLocal, end: endLocal };
  } else {
    var startD = y + mo + d;
    var nd = new Date(parseInt(y,10), parseInt(mo,10) - 1, parseInt(d,10) + 1);
    var endD = nd.getFullYear() + pad2(nd.getMonth() + 1) + pad2(nd.getDate());
    return { allday: true, start: startD, end: endD };
  }
}

/* 予定の説明文（メモ・計画表・報告書のリンクをまとめる） */
function calDesc(ev){
  var desc = [];
  if (ev.staff)  desc.push('係・担当: ' + sortStaffStr(ev.staff));
  if (ev.memo)   desc.push(ev.memo);
  if (ev.plan)   desc.push('計画表: ' + ev.plan);
  if (ev.report) desc.push('報告書: ' + ev.report);
  return desc;
}

/* Googleカレンダーに追加するURL */
function gcalUrl(ev){
  var t = calTimes(ev);
  var desc = calDesc(ev);
  var url = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(ev.title || '') +
    '&dates=' + t.start + '/' + t.end +
    '&ctz=Asia/Tokyo';
  if (ev.place) url += '&location=' + encodeURIComponent(ev.place);
  if (desc.length) url += '&details=' + encodeURIComponent(desc.join('\n'));
  return url;
}

function attNamesHtml(arr, evId, isAdmin, emptyText){
  if (arr.length === 0) return emptyText;
  var parts = [];
  for (var i = 0; i < arr.length; i++){
    var s = esc(arr[i]);
    if (isAdmin){
      /* ★2026-08-17：「〇〇[取消]」ではなく、名前そのものを押せるようにした。
         人数が多いと「[取消]」の繰り返しが読みにくく、幅も取っていたため。
         管理者だけ、名前に薄い点線の下線が付く。 */
      parts.push('<a href="javascript:void(0)" class="attdel" ' +
        'onclick="delAnswer(\'' + evId + '\',\'' + s.replace(/'/g, '') + '\')"><kp-nw data-k="n">' + s + '</kp-nw></a>');
    } else {
      parts.push('<kp-nw data-k="n">' + s + '</kp-nw>');   /* ★2026-10-22a 名前を行の途中で割らない（下の WRAP_） */
    }
  }
  /* ★2026-08-17：区切りを全角の「、」から半角の中黒「･」に変更。
     全角の「・」は「、」と同じ幅なので意味が無く、半角でないと幅は縮まらない。 */
  return parts.join('･');
}

function attOf(evId){
  var r = { yes: [], maybe: [], no: [] };
  for (var i = 0; i < state.attendance.length; i++){
    var a = state.attendance[i];
    if (a.eventId !== evId) continue;
    /* ★2026-10-05b　保守業者（DXベアーズ）の回答は数えません。
       　保守業者の端末で開いたときだけ届く分です（只隈さん「16として」） */
    if (!isRealMember_(a.name)) continue;
    if (a.status === 'yes') r.yes.push(a.name);
    else if (a.status === 'maybe') r.maybe.push(a.name);
    else if (a.status === 'no') r.no.push(a.name);
  }
  r.yes.sort(byMember_);
  r.maybe.sort(byMember_);
  r.no.sort(byMember_);
  /* ------------------------------------------------------------------
     ★2026-08-17：まだボタンを押していない人（○△×のどれも送っていない人）。
     参加人数が多い予定ほど、押していない人を目で探すのが大変になるため。
     「実在のハイキング会員」の中で、この予定にまだ何も答えていない人を出す
     （DXベアーズ(保守)は含めない。退会した人も名簿から外れているので含まれない）。
     ------------------------------------------------------------------ */
  var answered = {};
  for (var p = 0; p < r.yes.length; p++)   answered[r.yes[p]]   = true;
  for (var q = 0; q < r.maybe.length; q++) answered[r.maybe[q]] = true;
  for (var s = 0; s < r.no.length; s++)    answered[r.no[s]]    = true;
  r.pending = [];
  /* ★2026-08-24　母数は「この予定の対象の方」だけ。
     　幹部だけの予定で、会員19人が未回答と出てしまわないように。 */
  var rmAll = targetMembersOf_(evId);
  for (var m = 0; m < rmAll.length; m++){
    if (!answered[rmAll[m]]) r.pending.push(rmAll[m]);
  }
  r.pending.sort(byMember_);
  return r;
}


/* ============================================================
   ★2026-10-22 折り返しの直し（只隈さん「名前や言葉が行の端で割れる」
     例：「リーダー：杉／野」「入会手続き(樺嶋さ／ん)」「答えてい／ません」「移動しま／す。」）
   ・本文はふつうの折り返し（行の端まで詰める）のまま。字そのものは変えない。
   　<kp-nw>（改行させない入れ物）で包むだけ。画面が描き直されるたびに包み直す。
   ① 会員の名前（＋さん・様）と「役：名前」の1組は、行の途中で割らない
   ② 予定の題（.evtitle など）は、言葉の切れ目（文節）でだけ折る
   ③ 最後の行が1〜3字になるときは、その言葉ごと次の行へ下ろす（「移動します。」）
   ・iPhone の Safari でも同じに効くよう、CSS の auto-phrase には頼らず字の種類で切れ目を決める。
   ・HP（promo）の ORPHANJS（2026-10-22）と同じ考え。
   ・決定と記録：プロジェクト文書 ★アプリの改行の直し_決定と実装の記録_20261022.md
   ============================================================ */
var WRAP_ = (function(){
  var SKIP = { SCRIPT:1, STYLE:1, TEXTAREA:1, SELECT:1, OPTION:1, INPUT:1, PRE:1, CODE:1, IFRAME:1, svg:1, SVG:1, 'KP-NW':1, CANVAS:1 };
  var GL = '、。，．・･：；？！」』）］｝〕〉》】…‥％,.:;?!)]}%';   /* 行の頭に来ない字（前にくっつく） */
  var SM = 'ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々ゝゞヽヾ';   /* 前の字から離さない字 */
  var OP = '「『（［｛〔〈《【([{';                                  /* 行の終わりに来ない字（後ろにくっつく） */
  var TITLE_SEL = '.evtitle, .evctitle, h2, h3';
  var LONG = 10;   /* これより長い言葉は包まない（狭い画面ではみ出さないように） */

  function kind_(c){
    if (/\s/.test(c)) return 's';
    if (/[ぁ-ゖ]/.test(c)) return 'h';
    if (/[ァ-ヺー]/.test(c)) return 'k';
    if (/[一-龯々〆ヶ]/.test(c)) return 'j';
    if (/[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/.test(c)) return 'a';
    return 'o';
  }
  /* p と q のあいだで折ってよいか（文節のおおよその切れ目） */
  function brk_(p, q){
    if (GL.indexOf(q) >= 0 || SM.indexOf(q) >= 0) return false;
    if (OP.indexOf(p) >= 0) return false;
    var a = kind_(p), b = kind_(q);
    if (a === 's' || b === 's') return true;
    if (GL.indexOf(p) >= 0) return true;
    if (OP.indexOf(q) >= 0) return true;
    if (p === 'を') return true;                     /* 「を」の後は切れ目（「年会費を／お持ちください」） */
    if ((p === 'お' || p === 'ご') && b === 'j') return false;   /* 「お持ち」「ご案内」は離さない */
    if (a === 'h') return b !== 'h';                 /* ひらがなの後に漢字・カタカナ・英数字 */
    if (a === 'a') return b !== 'a' && b !== 'j' && b !== 'k' && b !== 'h';   /* 1階・3人・5時間は離さない */
    if (a === 'j') return b === 'k' || b === 'a' || b === 'o';
    if (a === 'k') return b === 'j' || b === 'a' || b === 'o';
    if (a === 'o') return b !== 'o';
    return false;
  }
  /* 文字列を文節に分ける → [[始め, 終わり], …] */
  function phrases_(t){
    var out = [], s = 0;
    for (var i = 1; i < t.length; i++){
      if (brk_(t.charAt(i - 1), t.charAt(i))){ out.push([s, i]); s = i; }
    }
    if (t.length) out.push([s, t.length]);
    return out;
  }
  function esc_(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var RX = null, RXKEY = '';
  function nameRx_(){
    var ms = (typeof MEMBERS !== 'undefined' && MEMBERS) ? MEMBERS : [];
    var key = ms.join('\n');
    if (key === RXKEY) return RX;
    RXKEY = key;
    var ns = ms.filter(function(n){ return n && String(n).length >= 1; })
               .map(String).sort(function(a, b){ return b.length - a.length; }).map(esc_);
    RX = ns.length
      ? new RegExp('(?:[^\\s、。，,・･：:；;（(「『】\\]）)]{1,8}[：:])?(?:' + ns.join('|') + ')(?:さん|さま|様)?', 'g')
      : null;
    return RX;
  }

  function inSkip_(n, root){
    for (var p = n.parentNode; p && p !== root; p = p.parentNode){
      if (p.nodeType === 1 && SKIP[p.tagName]) return true;
    }
    return false;
  }
  function textNodes_(root){
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n;
    while ((n = w.nextNode())){
      if (!/\S/.test(n.data)) continue;
      if (inSkip_(n, document.body)) continue;
      out.push(n);
    }
    return out;
  }
  function mk_(kind){
    var s = document.createElement('kp-nw');
    s.setAttribute('data-k', kind);
    return s;
  }
  /* 1つの文字ノードの中の [始め, 終わり] を包む（後ろから） */
  function wrapRanges_(t, rs, kind){
    for (var i = rs.length - 1; i >= 0; i--){
      var a = rs[i][0], b = rs[i][1];
      if (b - a < 2) continue;
      var mid = a > 0 ? t.splitText(a) : t;
      if (b - a < mid.data.length) mid.splitText(b - a);
      var s = mk_(kind);
      mid.parentNode.insertBefore(s, mid);
      s.appendChild(mid);
    }
  }

  /* ① 名前と「役：名前」 */
  function names_(root){
    var rx = nameRx_();
    if (!rx) return;
    var ts = textNodes_(root);
    for (var i = 0; i < ts.length; i++){
      var t = ts[i], m, rs = [];
      rx.lastIndex = 0;
      while ((m = rx.exec(t.data))){
        var a = m.index, b = a + m[0].length;
        if (b - a > 14){ /* 役の部分が長すぎるときは名前だけ */
          var c = m[0].search(/[：:]/);
          if (c >= 0) a = a + c + 1;
        }
        if (b - a >= 2) rs.push([a, b]);
        if (m[0].length === 0) rx.lastIndex++;
      }
      if (rs.length) wrapRanges_(t, rs, 'n');
    }
  }

  /* ② 題は文節で折る */
  function titles_(root){
    var es = root.querySelectorAll ? root.querySelectorAll(TITLE_SEL) : [];
    for (var i = 0; i < es.length; i++){
      var ts = textNodes_(es[i]);
      for (var j = 0; j < ts.length; j++){
        var t = ts[j], ps = phrases_(t.data), rs = [];
        for (var k = 0; k < ps.length; k++){
          if (ps[k][1] - ps[k][0] <= LONG) rs.push(ps[k]);
        }
        wrapRanges_(t, rs, 'p');
      }
    }
  }

  /* 描く前の文字列で包む（予定の札など、よく描き直す所はこちらを使う＝後から包み直す手間が要らない）
     raw … エスケープ前の字。title … true なら題（文節でも折る）。戻り値はエスケープ済みの HTML */
  function h_(t){ return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function html_(raw, title){
    var t = String(raw == null ? '' : raw), rx = nameRx_(), out = '', last = 0, m;
    function rest_(u){
      if (!title) return h_(u);
      var ps = phrases_(u), o = '';
      for (var i = 0; i < ps.length; i++){
        var w = u.slice(ps[i][0], ps[i][1]);
        o += (w.length >= 2 && w.length <= LONG) ? '<kp-nw data-k="p">' + h_(w) + '</kp-nw>' : h_(w);
      }
      return o;
    }
    if (rx){
      rx.lastIndex = 0;
      while ((m = rx.exec(t))){
        var a = m.index, b = a + m[0].length;
        if (m[0].length === 0){ rx.lastIndex++; continue; }
        if (b - a > 14){ var c = m[0].search(/[：:]/); if (c >= 0) a = a + c + 1; }
        if (b - a < 2) continue;
        out += rest_(t.slice(last, a)) + '<kp-nw data-k="n">' + h_(t.slice(a, b)) + '</kp-nw>';
        last = b;
      }
    }
    return out + rest_(t.slice(last));
  }

  /* ③ 最後の行が1〜3字 → その言葉ごと下ろす */
  /* display は「タグ＋class」ごとに1回だけ聞く（style の付いた箱は毎回）。測る回数を減らして速くするため */
  var DSC = {};
  function ds_(n){
    if (n.hasAttribute && n.hasAttribute('style')) return getComputedStyle(n).display;
    var key = n.tagName + '|' + (typeof n.className === 'string' ? n.className : '');
    var v = DSC[key];
    if (v === undefined) v = DSC[key] = getComputedStyle(n).display;
    return v;
  }
  function runs_(E){
    var o = [], c = [];
    (function w(p){
      for (var n = p.firstChild; n; n = n.nextSibling){
        if (n.nodeType === 3){ c.push(n); continue; }
        if (n.nodeType !== 1 || (SKIP[n.tagName] && n.tagName !== 'KP-NW')) continue;
        if (n.tagName === 'BR'){ o.push(c); c = []; continue; }
        var d = ds_(n);
        if (d === 'none') continue;
        if (d === 'inline' || d === 'contents'){ w(n); continue; }
        o.push(c); c = [];
      }
    })(E);
    o.push(c);
    return o;
  }
  function rectsOf_(ns){
    var L = [], r = document.createRange();
    for (var i = 0; i < ns.length; i++){
      r.selectNodeContents(ns[i]);
      var q = r.getClientRects();
      for (var j = 0; j < q.length; j++){
        var a = q[j];
        if (a.width < 1) continue;
        var m = (a.top + a.bottom) / 2, z = L[L.length - 1];
        if (!z || m > z.b) L.push({ t: a.top, b: a.bottom });
        else { z.t = Math.min(z.t, a.top); z.b = Math.max(z.b, a.bottom); }
      }
    }
    return L;
  }
  function chars_(ns){
    var c = [];
    for (var i = 0; i < ns.length; i++){
      var t = ns[i].data;
      for (var k = 0; k < t.length; k++) c.push([ns[i], k, t.charAt(k)]);
    }
    return c;
  }
  /* 最後の行の最初の字の番号（c の中）と、最後の行の字数 */
  function lastStart_(c, L){
    var z = L[L.length - 1], r = document.createRange(), n = 0, first = -1;
    for (var i = c.length - 1; i >= 0; i--){
      if (/\s/.test(c[i][2])) continue;
      r.setStart(c[i][0], c[i][1]); r.setEnd(c[i][0], c[i][1] + 1);
      var q = r.getClientRects();
      if (!q.length) continue;
      var a = q[q.length - 1];
      if ((a.top + a.bottom) / 2 < z.t) break;
      n++; first = i;
      if (n > 12) return [-1, n];   /* 最後の行が長い＝見ない（速さのため） */
    }
    return [first, n];
  }
  function orphan_(E, k, ns){
    var L = rectsOf_(ns);
    if (L.length < 2) return;
    var c = chars_(ns), ls = lastStart_(c, L), i0 = ls[0];
    if (i0 <= 0) return;
    /* 下ろすのは：最後の行が1〜3字のとき／最後の行が言葉の途中から始まるとき（「移／動します。」） */
    var mid0 = c[i0 - 1][0] === c[i0][0] && !/\s/.test(c[i0 - 1][2]) && !brk_(c[i0 - 1][2], c[i0][2]);
    if (ls[1] > 3 && !mid0) return;
    /* その言葉の始まりまで戻る（同じ文字ノードの中だけ・LONG 字まで） */
    var e = c.length;
    while (e > 0 && /\s/.test(c[e - 1][2])) e--;
    if (ls[1] > 3){
      /* 最後の行が長いときは、割れた言葉だけを包む */
      e = i0;
      while (e < c.length && c[e][0] === c[i0][0] && !(e > i0 && brk_(c[e - 1][2], c[e][2]))) e++;
      while (e < c.length && c[e][0] === c[i0][0] && GL.indexOf(c[e][2]) >= 0) e++;
    }
    var g = i0;
    while (g > 0 && c[g - 1][0] === c[i0][0] && !brk_(c[g - 1][2], c[g][2]) && e - g < LONG) g--;
    /* 言葉の切れ目で始まっていて短いときは、前の言葉も一緒に（最低4字） */
    while (g > 0 && c[g - 1][0] === c[i0][0] && e - g < 4){
      g--;
      while (g > 0 && c[g - 1][0] === c[i0][0] && !brk_(c[g - 1][2], c[g][2]) && e - g < LONG) g--;
    }
    while (g > 0 && c[g - 1][0] === c[i0][0] && OP.indexOf(c[g - 1][2]) >= 0) g--;   /* 「（」は後ろの言葉と一緒に */
    if (g > 0 && c[g - 1][0] === c[i0][0] && !brk_(c[g - 1][2], c[g][2])) return;   /* 言葉が長すぎる＝何もしない */
    if (e - g > LONG + 2 || c[g][0] !== c[e - 1][0]) return;   /* 文字ノードをまたぐときは何もしない */
    var P = c[g][0].parentNode;
    if (/flex|grid/.test(ds_(P))) return;
    /* 下ろしたあと最後の行に収まるか（包む前に測る＝描き直させない） */
    var r = document.createRange();
    r.setStart(c[g][0], c[g][1]); r.setEnd(c[i0][0], c[i0][1]);
    var mw = 0, q = r.getClientRects();
    for (var x = 0; x < q.length; x++) mw += q[x].width;
    r.setStart(c[i0][0], c[i0][1]); r.setEnd(c[c.length - 1][0], c[c.length - 1][1] + 1);
    q = r.getClientRects();
    if (!q.length) return;
    var lw = 0;
    for (var y = 0; y < q.length; y++) lw += q[y].width;
    var cs = getComputedStyle(E);
    var cw = E.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    if (lw + mw > cw - 2) return;
    return { t: c[g][0], a: c[g][1], b: c[g][1] + (e - g) };
  }
  /* 包む（測らない） */
  function apply_(pl){
    var t = pl.t;
    if (!t.parentNode || pl.b > t.data.length) return null;
    var mid = pl.a > 0 ? t.splitText(pl.a) : t;
    if (pl.b - pl.a < mid.data.length) mid.splitText(pl.b - pl.a);
    var s = mk_('o');
    mid.parentNode.insertBefore(s, mid);
    s.appendChild(mid);
    return s;
  }
  function unwrap_(s){
    var p = s.parentNode;
    if (!p) return;
    while (s.firstChild) p.insertBefore(s.firstChild, s);
    p.removeChild(s);
    p.normalize();
  }
  function orphans_(){
    var a = document.querySelectorAll('kp-nw[data-k="o"]');
    for (var i = a.length - 1; i >= 0; i--) unwrap_(a[i]);
    /* 字のある箱（ブロック）だけを集める。1行に収まっている箱は見ない */
    var ts = textNodes_(document.body), J = [], RID = ++RUNNO;
    DSC = {};
    var dsc_ = ds_;
    for (var t = 0; t < ts.length; t++){
      var E = ts[t].parentNode;
      while (E && E !== document.body && /^(inline|contents)$/.test(dsc_(E))) E = E.parentNode;
      if (!E || E === document.body || E.__wpS === RID) continue;
      E.__wpS = RID;
      if (dsc_(E) === 'none' || (E.closest && E.closest('table.cal'))) continue;
      var R0 = E.getBoundingClientRect();
      if (R0.height < 1) continue;
      var lh = parseFloat(getComputedStyle(E).fontSize) || 16;
      if (R0.height < lh * 2.2) continue;   /* 1行だけ */
      J.push(E);
    }
    /* ①決める（測るだけ・収まるかも包む前に確かめる）→ ②まとめて包む。測るたびに描き直させないため */
    var PL = [];
    for (var j = 0; j < J.length; j++){
      var R = runs_(J[j]);
      for (var k = 0; k < R.length; k++){
        if (!R[k].length) continue;
        var cnt = 0;
        for (var z = 0; z < R[k].length; z++) cnt += R[k][z].data.length;
        if (cnt < 6) continue;
        try { var pl = orphan_(J[j], k, R[k]); if (pl) PL.push(pl); } catch (eO) {}
      }
    }
    for (var m = PL.length - 1; m >= 0; m--) apply_(PL[m]);
  }

  var MO = null, RAF = 0, LW = 0, RUNNO = 0;
  function off_(){ if (MO) MO.disconnect(); }
  function on_(){ if (MO) MO.observe(document.body, { childList: true, subtree: true, characterData: true }); }
  /* 名前・題は描き直しの直後（画面に出る前・測らない）。最後の行は画面が出たあとに1回だけ測る */
  function words_(){
    off_();
    try { names_(document.body); titles_(document.body); } catch (e) {}
    on_();
    later_();
  }
  /* 最後の行は、画面が出たあとで（押した直後の動きを遅くしないため） */
  function later_(){
    if (RAF) return;
    RAF = 1;
    var go = function(){ setTimeout(last_, 30); };
    if (window.requestAnimationFrame) requestAnimationFrame(go); else go();
  }
  function last_(){
    RAF = 0;
    off_();
    try { orphans_(); } catch (e) {}
    LW = window.innerWidth;
    on_();
  }
  function start_(){
    if (!document.body || !window.MutationObserver) return;
    MO = new MutationObserver(words_);
    words_();
    var tmR = 0;
    window.addEventListener('resize', function(){
      if (window.innerWidth === LW) return;   /* スクロールで高さだけ変わるときは測らない */
      clearTimeout(tmR); tmR = setTimeout(later_, 120);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start_);
  else start_();
  return { run: function(){ words_(); last_(); }, html: html_, phrases: phrases_, t: { names: function(){ names_(document.body); }, titles: function(){ titles_(document.body); }, orph: orphans_ } };
})();
