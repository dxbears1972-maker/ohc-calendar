/* ==================================================================
   お知らせ
   LINEの群では大事な連絡が流れて見落とされます。
   ここに書けば、アプリのいちばん上に出て、流れません。
   開いた方は自動で記録されるので、**まだ見ていない方**が分かります。
   ================================================================== */
/* 会員に電話をかける一覧（幹事・管理者だけ） */
function renderTelBook(){
  var box = $('telBook');
  if (!box) return;
  var myn = getName();
  var html = '', n = 0;
  if (isStaff(myn)){
    var tbMembers = realMembers_();
    for (var i = 0; i < tbMembers.length; i++){
      var tl = telLink(tbMembers[i]);
      if (!tl) continue;
      html += '<a class="telbtn" href="tel:' + tl + '">' + esc(tbMembers[i]) + '&nbsp;📞</a> ';
      n++;
    }
  }
  if (n === 0){
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  $('telBookList').innerHTML = html;
}

function renderNotices(){
  var wrap = $('noticeWrap');
  if (!wrap) return;
  var myn = getName(), myid = idOf(myn);
  var list = state.notices || [];

  /* 書けるのは、幹事・管理者と、これからの予定でリーダー・司会・幹事になっている人 */
  $('noticeCell').style.display =
    (canWriteNotice && $('noticeCard').style.display !== 'block') ? 'table-cell' : 'none';

  var html = '', toMark = [];
  for (var i = 0; i < list.length; i++){
    var n = list[i];
    var seenMe = false;
    for (var r = 0; r < n.read.length; r++){
      if ((myid && n.read[r] === myid) || (myn && n.read[r] === myn)) seenMe = true;
    }
    var unread = (myn !== '' && !seenMe);
    if (unread) toMark.push(n.id);   /* 開いた時点で「見た」にする。押させない */

    html += '<div class="ntc' + (unread ? ' unread' : '') + '">';
    html += '<div class="nhead">' + esc(n.at) + '　' + esc(n.by) + 'さん' +
            (n.until ? '（' + esc(n.until) + 'まで）' : '') + '</div>';
    html += '<div class="nbody">' + esc(n.text) + '</div>';

    /* 幹事だけに、見た人数を1行で。押したときだけ中身が出る */
    if (canWriteNotice){
      var yet = [];
      var ntcMembers = realMembers_();
      for (var m = 0; m < ntcMembers.length; m++){
        var mid = idOf(ntcMembers[m]), done = false;
        for (var k = 0; k < n.read.length; k++){
          if ((mid && n.read[k] === mid) || n.read[k] === ntcMembers[m]) done = true;
        }
        if (!done) yet.push(ntcMembers[m]);
      }
      html += '<div class="seen" onclick="toggleSeen(' + i + ')">' +
              (ntcMembers.length - yet.length) + '／' + ntcMembers.length + '人が見ました' +
              (yet.length ? '　▸ まだの方' : '') + '</div>';
      html += '<div id="seen' + i + '" style="display:none">';
      if (yet.length){
        html += '<div class="unreadlist">';
        for (var u = 0; u < yet.length; u++){
          var tl = telLink(yet[u]);
          var msg = yet[u] + 'さん\n【' + CLUB.shareTag + '】お知らせが出ています。\n' +
                    n.text + '\n\n' + location.href.split('?')[0];
          html += '<div class="nagrow"><b>' + esc(yet[u]) + '</b>' +
                  '<a class="telbtn" href="https://line.me/R/share?text=' +
                    encodeURIComponent(msg) + '">LINE</a>' +
                  (tl ? '<a class="telbtn" href="tel:' + tl + '">電話</a>'
                      : '<span class="notel">番号なし</span>') +
                  '</div>';
        }
        html += '</div>';
      }
      html += '<button class="minibtn" type="button" onclick="copyNotice(' + i + ')">LINEグループに貼る（0通）</button>' +
              '<button class="minibtn" type="button" onclick="removeNotice(\'' + esc(n.id) + '\')">消す</button>';
      html += '</div>';
    }
    html += '</div>';
  }
  wrap.innerHTML = html;

  /* 見たことを、あとからそっと記録する（ボタンは押させない） */
  if (toMark.length && myn){
    var send = [];
    for (var t = 0; t < toMark.length; t++){
      if (!markedSeen[toMark[t]]){ markedSeen[toMark[t]] = true; send.push(toMark[t]); }
    }
    if (send.length){
      setTimeout(function(){
        api('POST', { action: 'readNotice', ids: send, name: myn,
                      memberId: myid, deviceId: deviceId() },
          function(err, data){ if (!err && data && !data.error) applyData(data); });
      }, 2500);
    }
  }
}

/* 「○／○人が見ました」を押したときだけ、中身を出す */
function toggleSeen(i){
  var b = $('seen' + i);
  if (b) b.style.display = (b.style.display === 'none') ? 'block' : 'none';
}

/* ==================================================================
   LINEのグループに知らせる
   LINE公式アカウントの自動配信は、無料枠が月200通しかありません。
   ここは**人がLINEに貼る**やり方なので、通数の制限がありません。
   ================================================================== */
var shareText = '';

function offerShare(text){
  shareText = text;
  $('sharePrev').innerHTML = esc(text);
  $('shareGo').href = 'https://line.me/R/share?text=' + encodeURIComponent(text);
  $('shareCard').style.display = 'block';
  if ($('shareCard').scrollIntoView) $('shareCard').scrollIntoView(true);
}

function closeShare(){
  $('shareCard').style.display = 'none';
  shareText = '';
}

/* 文字を、そのまま貼れる形でコピーする */
function copyText(t){
  var ok = false;
  try {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, 99999);
    ok = document.execCommand('copy');
    document.body.removeChild(ta);
  } catch(e){}
  if (!ok && navigator.clipboard){
    try { navigator.clipboard.writeText(t); ok = true; } catch(e){}
  }
  setStatus(ok ? 'コピーしました。LINEに貼りつけてください' : 'コピーできませんでした', !ok);
}

/* 予定1件を、LINEに貼れる文にする */
function eventShareText(ev){
  var d = ev.date.split('-');
  var wd = ['日','月','火','水','木','金','土'];
  var dt = new Date(+d[0], +d[1] - 1, +d[2]);
  var t = '【' + CLUB.shareTag + '】\n' +
          (+d[1]) + '月' + (+d[2]) + '日（' + wd[dt.getDay()] + '）' + ev.title + '\n';
  if (ev.time)  t += '時間：' + ev.time + '\n';
  if (ev.place) t += '場所：' + ev.place + '\n';
  if (ev.staff) t += '係：' + ev.staff + '\n';
  if (ev.memo)  t += ev.memo + '\n';
  t += '\n出欠の回答はこちら\n' + location.href.split('?')[0] + '?goto=' + ev.id;
  return t;
}


/* ==================================================================
   ★★2026-09-22　LINEの通数の見える化
   ------------------------------------------------------------------
   LINE公式アカウントの自動配信は、無料枠が**月200通**です。
   群へ1回流すと「群にいる人数」ぶん減ります（16名なら1回で16通）。

   これまで残りの通数は、「未回答の方へ催促」の確認ダイアログの中にしか
   出ていませんでした。お知らせや予定の登録では、黙って減っていました。
   ここでは幹事・管理者の画面に、**いつでも見える形**で出します。

   ★数字はこちらで数えた**概算**です（LINE側の実数と少しずれることがあります）。
   ================================================================== */

/* 群へ1回流すと使う通数。スイッチが on でなければ 0（通数は減りません） */
function lineCostOnce_(){
  if (lineMode !== 'on') return 0;
  return (lineSize != null && !isNaN(+lineSize)) ? +lineSize : 0;
}

/* 確認ダイアログに入れる「■ 使う通数：…」。催促の文言にそろえています */
function lineCostLines_(n){
  var t = '■ 使う通数：' + n + '通';
  if (lineLeft != null) t += '（今月あと ' + lineLeft + '通 送れます）';
  if (lineLeft != null && lineLimit != null && lineUsed != null){
    t += '\n　送ったあとは ' + (lineUsed + n) + '／' + lineLimit + '通 になります';
  }
  if (lineMode === 'test') t += '\n　※いまは動作確認中（test）です。群には出ません';
  else if (lineMode === 'off') t += '\n　※いまLINEの自動配信は止まっています（off）';
  return t;
}

/* 「7日前と前日」のような言い方を作る */
function lineDaysText_(){
  if (!lineDays || !lineDays.length) return '';
  var a = [];
  for (var i = 0; i < lineDays.length; i++){
    a.push((+lineDays[i] === 1) ? '前日' : (+lineDays[i] + '日前'));
  }
  return a.join('と');
}

/* 幹事・管理者の画面に、今月の通数を1枚で出す */
function renderLineQuota(){
  var box = $('lineQuota');
  if (!box) return;
  if (!isStaff(getName()) || lineLimit == null || lineUsed == null){
    box.style.display = 'none';
    return;
  }
  var left = (lineLeft != null) ? lineLeft : Math.max(0, lineLimit - lineUsed);
  var h = '<b>LINEの自動配信　今月 ' + lineUsed + '／' + lineLimit + '通（残り ' +
          left + '通・概算）</b>';
  if (lineMode === 'on'){
    if (lineSize != null){
      h += '<br>クラブのLINEグループへ1回流すと <b>' + lineSize + '通</b>（いま群にいる人数）。';
    }
    var d = lineDaysText_();
    if (d) h += '予定のある日の ' + d + ' にも、自動で流れます。';
  } else if (lineMode === 'test'){
    h += '<br>いまは<b>動作確認中（test）</b>です。群には出ないので、通数は減りません。';
  } else {
    h += '<br>いまLINEの自動配信は<b>止まっています（off）</b>。通数は減りません。';
  }
  h += '<br>通数を使いたくないときは、「LINEグループに貼る（0通）」をお使いください。' +
       'ご自分のLINEから貼るやり方で、いくら送っても0通です。';
  box.innerHTML = h;
  box.style.display = 'block';
}

/* お知らせの画面を開くたびに、チェックを外して通数を出し直す */
function refreshNoticeLine_(){
  var cb = $('noticeLine');
  if (cb) cb.checked = false;          /* ★既定はオフ（2026-09-01 只隈さん決定） */
  var sp = $('noticeLineCnt');
  if (!sp) return;
  var n = lineCostOnce_();
  if (n > 0){
    sp.innerHTML = n + '通' + (lineLeft != null ? '・今月あと' + lineLeft + '通' : '');
  } else if (lineMode === 'test'){
    sp.innerHTML = 'いまは動作確認中・0通';
  } else if (lineMode === 'off'){
    sp.innerHTML = 'いまは止まっています・0通';
  } else {
    sp.innerHTML = '通数を使います';
  }
}
