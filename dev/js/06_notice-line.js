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

