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
  $('listTitle').innerHTML = m + '月の予定';

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
        'onclick="delAnswer(\'' + evId + '\',\'' + s.replace(/'/g, '') + '\')">' + s + '</a>');
    } else {
      parts.push(s);
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

