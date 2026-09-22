/* ==================================================================
   ★2026-08-24　予定ごとの「出欠をとる相手」

   　空欄　　　　… 全員（これまでどおり）
   　幹事・管理者… 名簿の役割が管理者・幹事の方だけ
   　係のみ　　　… その予定の「係」の欄に名字が出てくる方だけ

   幹部だけの打合せで、会員全員に出欠を求めてしまうのを防ぐためです。
   対象でない方にも予定は見えます（消えると「予定が無くなった」と
   心配されるため）。出欠のボタンだけ出しません。
   ================================================================== */
function eventOf_(evId){
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId) return state.events[i];
  }
  return null;
}

function targetMembersOf_(evId){
  var all = realMembers_();
  var ev = eventOf_(evId);
  var t = ev ? String(ev.target || '') : '';
  if (!t) return all;
  /* ★2026-08-24　その予定を登録した方は、どの対象でも必ず含めます。
     　段取りをする本人なのに、出欠を答えられない・数に入らない、
     　という状態を作らないためです。 */
  var own = ev ? String(ev.owner || '') : '';
  var st  = ev ? String(ev.staff || '') : '';
  /* ★2026-08-25　対象の決め方は targetNamesFor_ に1本化した。
     　予定を登録する前（まだ予定が無い時点）にも同じ判定が要るため。 */
  return targetNamesFor_(t, st, own);
}

function targetLabel_(t){
  if (t === '幹事・管理者') return 'アプリの管理者・幹事の方';
  if (t === '係のみ') return '係の方';
  var mL = String(t || '').match(/^作業[:：](.+)$/);
  if (mL) return mL[1] + 'の方';
  return '';
}

/* その方が、この予定の出欠を答える相手かどうか */
function isTargetOf_(ev, name){
  var t = ev ? String(ev.target || '') : '';
  if (!t) return true;
  if (!name) return true;
  /* 登録した本人は、どの対象でも答えられます */
  if (String(ev.owner || '') === name) return true;
  if (t === '幹事・管理者') return isStaff(name);
  /* ★2026-09-02　作業マスタ */
  var mw3 = t.match(/^作業[:：](.+)$/);
  if (mw3){
    var wl3 = workMembers_(mw3[1]);
    /* ★修正3　名簿に一人も当たらないマスタは、係のみに落とす */
    var all3 = realMembers_(), hit3 = 0;
    for (var y3 = 0; y3 < wl3.length; y3++){ if (all3.indexOf(wl3[y3]) >= 0) hit3++; }
    if (hit3) return wl3.indexOf(name) >= 0;
  }
  return String(ev.staff || '').indexOf(name) >= 0;
}

/* ------------------------------------------------------------------
   ★2026-08-24　未回答の方へ、クラブのLINE公式アカウントから直接お送りする。

   これまでは「LINEで知らせる」で自分のLINEを開き、相手を一人ずつ
   選んで送っていました。名簿にLINEIDが入るようになったので、
   **ボタン1回**で、その予定の未回答の方にだけ届きます。

   通数は「送った人数ぶん」です。群へ流すと群にいる人数ぶん使うので、
   こちらのほうがずっと少なくて済みます。
   ------------------------------------------------------------------ */
function lineToPending(evId){
  var ev = eventOf_(evId);
  if (!ev) return;
  var att = attOf(evId);
  var names = att.pending || [];
  if (!names.length) return;
  var msg = '【' + CLUB.shareTag + '】出欠のお願い\n' +
            '■ ' + ev.title + '\n' +
            '　' + fmtDate(ev.date) + (ev.time ? '　' + ev.time : '') +
            (ev.place ? '\n場所：' + ev.place : '') + '\n\n' +
            'まだ出欠のご回答をいただいていません。\n' +
            'お手数ですが、ご回答をお願いします。\n' +
            location.href.split('?')[0] + '?goto=' + evId;
  /* ★2026-08-24　押す前に、通数のことが分かるようにします。
     　クラブの公式アカウントから送るぶんは、送った人数ぶんだけ
     　無料枠（月200通）を使うためです。 */
  /* ★2026-08-25　押す前に、届く方と届かない方を分けてお見せします。
     　これまでは押したあとにしか分かりませんでした。 */
  var miss = lineMissing_(names);
  var okNames = names;
  if (miss && miss.length){
    okNames = [];
    for (var mi = 0; mi < names.length; mi++){
      if (miss.indexOf(names[mi]) < 0) okNames.push(names[mi]);
    }
  }
  if (miss && okNames.length === 0){
    alert('未回答の ' + names.length + '人は、どなたもLINEのお知らせに登録されていないため、\n'
        + 'LINEではお送りできません。\n\n' + miss.join('、') + '\n\n'
        + '予定の「LINEグループに貼る（0通）」をお使いいただくか、\n'
        + '別紙「LINEのお知らせ」でご登録をお願いしてください。');
    return;
  }
  var msgQ = '未回答の ' + names.length + '人のうち、'
             + (miss ? okNames.length + '人' : '登録されている方') + 'へLINEで催促を送ります。\n\n'
             + '■ 送る相手：' + okNames.join('、') + '\n'
             + (miss && miss.length
                 ? '■ 届かない方：' + miss.join('、') + '\n'
                   + '　（LINEのお知らせに登録されていません。別紙「LINEのお知らせ」でご登録をお願いしてください）\n'
                 : '') + '\n'
             + '■ 使う通数：' + okNames.length + '通'
             + (lineLeft !== null && lineLeft !== undefined
                 ? '（今月あと ' + lineLeft + '通 送れます）' : '') + '\n'
             + (lineMode === 'test'
                 ? '■ いまは動作確認中のため、実際には確認用の方にしか届きません\n' : '')
             + (miss ? '' : '\n※LINEのお知らせに登録されている方にだけ届きます。\n')
             + '※通数を使いたくないときは「やめる」を押して、\n'
             + '　予定の「LINEグループに貼る（0通）」をお使いください。\n'
             + '　スマホならそのボタン、パソコンなら「文だけコピーする」です。\n\n'
             + 'よろしいですか？';
  if (!confirm(msgQ)) return;
  setStatus('送っています…');
  post({ action: 'linePushMembers', name: myName, names: names, text: msg },
    '', function(data){
      if (!data){ setStatus('送れませんでした。電波の良い場所でお試しください。', true); return; }
      var t = String(data.sent || 0) + '人に送りました';
      if (data.miss && data.miss.length) t += '（LINE未登録：' + data.miss.join('、') + '）';
      if (data.reason) t += '　' + data.reason;
      setStatus(t);
      alert(t);
    });
}

function statusOfName(evId, name){
  if (!name) return '';
  for (var i = 0; i < state.attendance.length; i++){
    var a = state.attendance[i];
    if (a.eventId === evId && a.name === name) return a.status;
  }
  return '';
}

function myStatus(evId){
  return statusOfName(evId, getName());
}

/* ---------- 代理回答（管理者） ----------
   対象メンバーはこの端末に記憶し、各予定に○△×の表を出す */
var proxySetupFor = '';   /* 設定パネルを開いている予定のid */

function getProxyList(){
  var r = [];
  try {
    var arr = JSON.parse(lsGet(LSK.proxyList) || '[]');
    for (var i = 0; i < arr.length; i++){
      if (MEMBERS.indexOf(arr[i]) >= 0 && r.indexOf(arr[i]) < 0) r.push(arr[i]);
    }
  } catch(e){}
  r.sort(byMember_);
  return r;
}

function openProxySetup(evId){ proxySetupFor = evId; render(); }
function closeProxySetup(){ proxySetupFor = ''; render(); }

function saveProxySetup(evId){
  var box = $('psetup-' + evId);
  if (!box) return;
  var ins = box.getElementsByTagName('input');
  var sel = [];
  for (var i = 0; i < ins.length; i++){
    if (ins[i].checked) sel.push(ins[i].value);
  }
  try { lsSet(LSK.proxyList, JSON.stringify(sel)); } catch(e){}
  proxySetupFor = '';
  render();
}

/* 代理で○△×を押したとき：先に画面へ反映してから送信する */
function proxySet(evId, name, st){
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId && state.events[i].locked){
      alert('この予定の出欠は締め切られています');
      return;
    }
  }
  var found = false;
  for (var j = 0; j < state.attendance.length; j++){
    var a = state.attendance[j];
    if (a.eventId === evId && a.name === name){ a.status = st; found = true; }
  }
  if (!found) state.attendance.push({ eventId: evId, name: name, status: st });
  render();
  var label = (st === 'yes' ? '○ 参加' : (st === 'maybe' ? '△ 未定' : '× 不参加'));
  post({ action: 'setAttendance', eventId: evId, name: name, memberId: idOf(name),
         status: st, by: getName() },
    name + 'さん：' + label + ' を記録しました');
}

/* 予定カード内の代理回答欄を作る */
function buildProxyBox(ev){
  var plist = getProxyList();
  var html = '<div class="proxybox">';
  if (proxySetupFor === ev.id){
    html += '<div class="psetlbl">代理で回答する人に印を付けてください（この端末に記憶されます）</div>';
    html += '<div id="psetup-' + ev.id + '">';
    var proxyMembers = realMembers_();
    for (var i = 0; i < proxyMembers.length; i++){
      var m = proxyMembers[i];
      html += '<label class="pchk"><input type="checkbox" value="' + esc(m) + '"' +
        (plist.indexOf(m) >= 0 ? ' checked' : '') + '>' + esc(m) + '</label>';
    }
    html += '</div>';
    html += '<button type="button" class="psavebtn" onclick="saveProxySetup(\'' + ev.id + '\')">この内容で記憶する</button>';
    html += '<button type="button" class="cancelbtn" onclick="closeProxySetup()">やめる</button>';
  } else if (plist.length === 0){
    html += '<div class="pnote">代理回答：<a href="javascript:void(0)" class="pset" onclick="openProxySetup(\'' + ev.id + '\')">設定</a> で対象の人を選ぶと、ここに○△×が並びます</div>';
  } else {
    html += '<table class="proxytbl">';
    for (var j = 0; j < plist.length; j++){
      var nm = plist[j];
      var st = statusOfName(ev.id, nm);
      html += '<tr><td class="pname">' + esc(nm) + '</td>' +
        '<td class="pb"><button type="button" class="pbtn' + (st === 'yes' ? ' on-yes' : '') + '" onclick="proxySet(\'' + ev.id + '\',\'' + esc(nm) + '\',\'yes\')">○</button></td>' +
        '<td class="pb"><button type="button" class="pbtn' + (st === 'maybe' ? ' on-maybe' : '') + '" onclick="proxySet(\'' + ev.id + '\',\'' + esc(nm) + '\',\'maybe\')">△</button></td>' +
        '<td class="pb"><button type="button" class="pbtn' + (st === 'no' ? ' on-no' : '') + '" onclick="proxySet(\'' + ev.id + '\',\'' + esc(nm) + '\',\'no\')">×</button></td></tr>';
    }
    html += '</table>';
    html += '<div class="pfoot"><a href="javascript:void(0)" class="pset" onclick="openProxySetup(\'' + ev.id + '\')">代理する人を変更</a></div>';
  }
  html += '</div>';
  return html;
}

/* 終わって3日たった予定は隠す（「表示する」ボタンで出せる） */
var HIDE_ENDED_AFTER_DAYS = 3;

function hideCutoff_(){
  var t = new Date();
  t.setDate(t.getDate() - HIDE_ENDED_AFTER_DAYS);
  return dkey(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function toggleOldEvents(){
  state.showOldEvents = !state.showOldEvents;
  renderList();
}

function renderList(){
  var y = state.year, m = state.month;
  var prefix = y + '-' + pad2(m);
  var list = [];
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].date.indexOf(prefix) === 0) list.push(state.events[i]);
  }
  list.sort(function(a, b){
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  if (list.length === 0){
    $('evList').innerHTML = '<div id="noev">この月の予定はまだありません</div>';
    return;
  }

  /* 終了から3日を過ぎた予定は隠す */
  var cutoff = hideCutoff_();
  var hidden = 0;
  if (!state.showOldEvents){
    var keep = [];
    for (var h = 0; h < list.length; h++){
      if (list[h].date < cutoff) hidden++;
      else keep.push(list[h]);
    }
    list = keep;
  }
  var oldBtn = '';
  if (hidden > 0){
    oldBtn = '<button type="button" class="refbtn" style="margin-top:10px" onclick="toggleOldEvents()">終わった予定も表示する（' + hidden + '件）</button>';
  } else if (state.showOldEvents){
    oldBtn = '<button type="button" class="refbtn" style="margin-top:10px" onclick="toggleOldEvents()">終わった予定を隠す</button>';
  }
  if (list.length === 0){
    $('evList').innerHTML = '<div id="noev">この月に、これからの予定はありません</div>' + oldBtn;
    return;
  }

  var myn = getName();
  var isAdmin = isAdmin_(myn);
  var html = '';
  for (var j = 0; j < list.length; j++){
    var ev = list[j];
    var att = attOf(ev.id);
    var mine = myStatus(ev.id);
    var canDel = !ev.owner || (myn !== '' && (isOwnerOf(ev, myn) || isStaff(myn) || staffCanEdit(ev, myn)));
    var locked = !!ev.locked && ev.locked !== '0' && ev.locked !== 'false';
    var parts = [];
    if (ev.time)  parts.push('🕒 ' + esc(ev.time));
    if (ev.place) parts.push('📍 ' + esc(ev.place));
    if (ev.staff) parts.push('👤 ' + esc(sortStaffStr(ev.staff)));
    if (ev.owner) parts.push('<span class="evowner">（' + esc(ev.owner) + '）</span>');
    var info = parts.join('　');
    if (ev.memo) info += (info ? '<br>' : '') + '📝 ' + esc(ev.memo);
    var files = '';
    if (ev.plan)   files += '<a class="filebtn" href="' + esc(previewLink(ev.plan)) + '" target="_blank">📄 計画表</a>';
    if (ev.report) files += '<a class="filebtn" href="' + esc(previewLink(ev.report)) + '" target="_blank">📝 報告書</a>';

    /* 表題行の右端に常時表示するアイコン
       （車＝マイカー精算、¥＝精算結果〔ある時だけ〕、カレンダー＝Googleカレンダーに追加） */
    /* ★2026-08-17：不具合②の修正。この時点で分かっている「参加」人数（att.yes.length）を
       &n= としてマイカー精算アプリに渡す。精算アプリ側は、まだ何も入力・保存されていない
       ときだけこれを初期値として使う（手で直した人数や、すでに保存済みの精算は上書きしない）。 */
    /* ★2026-08-24　マイカー精算（車のアイコン）は、一般会員には出しません。
       　精算をするのは幹事・管理者と、その予定を登録した方・係の方だけで、
       　手順書①（メンバー用）にも精算の説明はありません。
       　会員の皆さんの画面から、使わないボタンを減らすためです。 */
    var canSettle_ = (myn !== '') &&
                     (isStaff(myn) || isOwnerOf(ev, myn) || staffCanEdit(ev, myn));
    /* ★2026-09-07（工事B B-3）精算アプリへ渡すもの
       　・club … どのクラブの精算かを、精算アプリにも伝えます
       　・「マイカー精算のURL」に ?gas=dev が付いていることがあるので、
       　　 そのときは ? ではなく & でつなぎます（?が2つになるのを防ぐ） */
    var carSep_ = (String(CLUB.carpoolUrl).indexOf('?') >= 0) ? '&' : '?';
    var icons = canSettle_ ?
      ('<a href="' + CLUB.carpoolUrl + carSep_ + 'club=' + encodeURIComponent(CLUB.id) +
        '&event=' + ev.id +
        '&date=' + ev.date + '&title=' + encodeURIComponent(ev.title) +
        '&time=' + encodeURIComponent(ev.time || '') +
        '&place=' + encodeURIComponent(ev.place || '') +
        '&n=' + att.yes.length + '" title="マイカー精算">' + CAR_ICON + '</a>') : '';
    if (ev.settle){
      icons += '<a href="javascript:void(0)" onclick="toggleSettle(\'' + ev.id + '\')" title="精算結果">' + SETTLE_ICON + '</a>';
    }
    if (ev.lineGroup) icons += '<a href="' + esc(ev.lineGroup) + '" target="_blank" title="山行グループLINE">' + LINE_ICON + '</a>';

    var isCancel = !!ev.cancelled;
    html += '<div class="ev' + (isCancel ? ' cancelled' : '') + '" id="ev-' + ev.id + '">' +
      '<table class="evhead"><tr>' +
        '<td>' + (isCancel ? '<span class="cancelbadge">中止</span>' : '') +
          '<span class="evdate">' + fmtDate(ev.date) + '</span><span class="evtitle">' + esc(ev.title) + '</span></td>' +
        '<td class="evicons">' + icons + '</td>' +
      '</tr></table>' +
      (info ? '<div class="evinfo">' + info + '</div>' : '') +
      (isCancel && ev.cancelNote ? '<div class="cancelnote">' + esc(ev.cancelNote) + '</div>' : '') +
      (files ? '<div class="filelinks">' + files + '</div>' : '') +
      /* ★2026-08-17：精算の明細を開いたとき、その山行で残した道順の地図（PDF）も
         　いっしょに開けるようにしました。地図のURLは settleForm の中に入っています。 */
      (ev.settle ? '<div id="settle-' + ev.id + '" style="display:none">' +
                     settleMapLink_(ev) +
                     '<pre class="settle">' + esc(ev.settle) + '</pre>' +
                   '</div>' : '') +
      (locked ?
        (isCancel
          ? '<div class="lockedmsg">この山行は中止になりました</div>'
          : '<div class="lockedmsg">🔒 出欠は締め切りました（変更できません）</div>')
      : (myn !== '' && !isTargetOf_(ev, myn)) ?
        /* ★2026-08-24　対象でない方。予定は見えますが、出欠のボタンは出しません */
        '<div class="lockedmsg">この予定は<b>' + esc(targetLabel_(ev.target)) +
          '</b>が対象です（出欠のご回答は要りません）</div>'
      :
        '<div class="attbtns">' +
          '<button type="button" class="' + (mine === 'yes' ? 'on-yes' : '') + '" onclick="answer(\'' + ev.id + '\',\'yes\')">○ 参加</button>' +
          '<button type="button" class="' + (mine === 'maybe' ? 'on-maybe' : '') + '" onclick="answer(\'' + ev.id + '\',\'maybe\')">△ 未定</button>' +
          '<button type="button" class="' + (mine === 'no' ? 'on-no' : '') + '" onclick="answer(\'' + ev.id + '\',\'no\')">× 不参加</button>' +
        '</div>'
      ) +
      (myn !== '' && (isStaff(myn) || isOwnerOf(ev, myn) || staffCanEdit(ev, myn)) && !locked ? buildProxyBox(ev) : '') +
      '<div class="attlist">' +
        '<b class="yes">参加 ' + att.yes.length + '人</b>：' + attNamesHtml(att.yes, ev.id, isAdmin, 'まだいません') + '<br>' +
        '<b class="maybe">未定 ' + att.maybe.length + '人</b>：' + attNamesHtml(att.maybe, ev.id, isAdmin, '－') + '<br>' +
        '<b class="no">不参加 ' + att.no.length + '人</b>：' + attNamesHtml(att.no, ev.id, isAdmin, '－') +
        (att.pending.length ?
          ('<br><b class="pending">未回答 ' + att.pending.length + '人</b>：' +
            attNamesHtml(att.pending, ev.id, false, '') )
          : '') +
      '</div>' +
      /* ★2026-08-24　未回答の方へ、その場でLINEを送る（幹事・管理者だけ）。
         　LINEに登録ずみの方へ直接届きます。相手を選ぶ操作は要りません。 */
      (att.pending.length && myn !== '' && isStaff(myn) && !locked ?
        '<div class="evdel"><a href="javascript:void(0)" class="lock" onclick="lineToPending(\'' +
          ev.id + '\')">📨 未回答の ' + att.pending.length +
          '人へ直接LINE（' + att.pending.length + '通）</a></div>' : '') +
      (canDel ?
        '<div class="evdel">' +
          '<a href="javascript:void(0)" class="lock" onclick="askCancel(\'' + ev.id + '\',' +
            (isCancel ? 'false' : 'true') + ')">' + (isCancel ? '中止をやめる' : '中止にする') + '</a>' +
          (isCancel ? '<a href="javascript:void(0)" class="lock" onclick="makeAlt(\'' + ev.id + '\')">代案で予定を作る</a>' : '') +
          '<a href="javascript:void(0)" class="lock" onclick="shareEvent(\'' + ev.id + '\')">LINEグループに貼る（0通）</a>' +
          '<a href="javascript:void(0)" class="lock" onclick="editEvent(\'' + ev.id + '\')">編集</a>' +
          (isCancel ? '' :
            '<a href="javascript:void(0)" class="lock" onclick="setLock(\'' + ev.id + '\',' + (locked ? 'false' : 'true') + ')">' +
              (locked ? '締切を解除' : '出欠を締切る') + '</a>') +
          '<a href="javascript:void(0)" onclick="delEvent(\'' + ev.id + '\',\'' + esc(ev.title).replace(/'/g, '') + '\')">削除</a>' +
        '</div>' : '') +
    '</div>';
  }
  $('evList').innerHTML = html + oldBtn;
}

function render(){
  renderNotices();
  renderTelBook();
  try { renderLineQuota(); } catch (eLQ) {}   /* ★2026-09-22　LINEの通数 */
  renderCalendar();
  renderList();
}

