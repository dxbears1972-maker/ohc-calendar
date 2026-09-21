/* ==================================================================
   山行の中止・代案

   予定は消しません。**誰が行く予定だったかの記録を残す**ためです。
   中止のあいだは出欠の回答を締め切ります。
   ================================================================== */
function askCancel(evId, on){
  var ev = null;
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId) ev = state.events[i];
  }
  if (!ev) return;

  var note = '';
  if (on){
    note = prompt(
      '「' + ev.title + '」を中止にします。\n\n' +
      '理由や、代わりの案があれば書いてください。\n' +
      '（例）雨天のため中止します。\n' +
      '　　　代わりに三池山へ行きます。集合は同じです。\n\n' +
      '空欄のままでもかまいません。', '雨天のため中止します。');
    if (note === null) return;
  } else {
    if (!confirm('「' + ev.title + '」の中止を取り消します。\n' +
                 'ふたたび出欠を受け付けます。よろしいですか？')) return;
  }

  var tell = confirm(
    (on ? '中止を' : '中止の取り消しを') + '、みなさんに知らせますか？\n\n' +
    'OK … メールとLINEで自動的に知らせます\n' +
    'キャンセル … 知らせずに、印だけ付けます');

  /* ------------------------------------------------------------------
     押した瞬間に画面を変えて、送信は裏で行います（出欠と同じやり方）。
     知らせるときはサーバーがメールとLINEも送るため、
     返事が返るまで数秒かかります。待たせないためです。
     ------------------------------------------------------------------ */
  for (var k = 0; k < state.events.length; k++){
    var e2 = state.events[k];
    if (e2.id !== evId) continue;
    e2.cancelled  = on ? '中止' : '';
    e2.cancelNote = on ? note : '';
    if (on) e2.locked = '中止';
    else if (e2.locked === '中止') e2.locked = '';
  }
  render();

  post({ action: 'setCancel', id: evId, on: on, note: note,
         tell: tell, mail: tell, name: getName() },
       on ? (tell ? '中止にしました（お知らせを送っています）' : '中止にしました')
          : '中止を取り消しました');
}

/* 中止になった予定の内容を引き継いで、新しい予定を作る */
function makeAlt(evId){
  var ev = null;
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId) ev = state.events[i];
  }
  if (!ev) return;
  var p = ev.date.split('-');
  openAddForm(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
  $('addTitle').value = ev.title + '（代わりの山行）';
  $('addPlace').value = ev.place || '';
  $('addMemo').value  = ev.cancelNote || '';
  if (ev.time){
    var tm = ev.time.match(/(\d{1,2}):(\d{2})/);
    if (tm){
      $('addHour').value = String(parseInt(tm[1], 10));
      $('addMin').value = tm[2];
    }
  }
  setStatus('中止になった予定の内容を写しました。日付と山名を直して登録してください。');
}

function shareEvent(evId){
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId){ offerShare(eventShareText(state.events[i])); return; }
  }
}

/* いまは使っていません（開いた時点で自動的に「見た」になります）。
   手で押す形に戻したくなったときのために残しています。 */
function readNotice(id){
  var myn = getName();
  if (!myn){ showNamePick(); return; }
  post({ action: 'readNotice', id: id, name: myn, memberId: idOf(myn) }, '読みましたを送りました');
}

function removeNotice(id){
  if (!confirm('このお知らせを消します。よろしいですか？')) return;
  post({ action: 'deleteNotice', id: id, name: getName() }, 'お知らせを消しました');
}

/* LINEの群に貼るための文を作って、コピーする。
   人が貼るぶんには、通数の制限も、クラブごとの設定も要りません。 */
function copyNotice(i){
  var n = (state.notices || [])[i];
  if (!n) return;
  offerShare('【' + CLUB.shareTag + '】お知らせ\n' + n.text +
             '\n\nアプリを開くと、いちばん上に出ています。\n' +
             location.href.split('?')[0]);
}

/* ---------- 操作 ---------- */
function moveMonth(diff){
  var m = state.month + diff;
  if (m < 1){ m = 12; state.year--; }
  if (m > 12){ m = 1; state.year++; }
  state.month = m;
  render();
}

function answer(evId, st){
  var name = getName();
  if (!name){
    showNamePick();
    alert('先に、あなたのお名前を選んでください');
    return;
  }
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId && state.events[i].locked){
      alert('この予定の出欠は締め切られています');
      return;
    }
  }
  var prev = myStatus(evId);
  /* 押した瞬間にボタンの色を変え、送信は裏で行う */
  var found = false;
  for (var j = 0; j < state.attendance.length; j++){
    var a = state.attendance[j];
    if (a.eventId === evId && a.name === name){ a.status = st; found = true; }
  }
  if (!found) state.attendance.push({ eventId: evId, name: name, status: st });
  render();
  post({ action: 'setAttendance', eventId: evId, name: name, memberId: idOf(name),
         status: st, by: getName() }, '回答を送りました');
  /* チェックが入っている人だけ、新たに「参加」にしたときGoogleカレンダー追加を開く */
  if (st === 'yes' && prev !== 'yes' && lsGet(LSK.gcalPref) === 'yes'){
    var ev = null;
    for (var g = 0; g < state.events.length; g++){
      if (state.events[g].id === evId) ev = state.events[g];
    }
    if (ev){
      /* Googleカレンダーから戻ってきたとき、この予定へ移動できるよう記憶しておく */
      lsSet(LSK.gotoId, evId);
      window.open(gcalUrl(ev), '_blank');
    }
  }
  /* 参加→不参加/未定 に変えたとき、連携オンの人には手動削除を案内する */
  if (prev === 'yes' && st !== 'yes' && lsGet(LSK.gcalPref) === 'yes'){
    alert('この予定をGoogleカレンダーに入れていた場合は、\nお手数ですがGoogleカレンダーから手動で削除してください。\n（アプリから自動では消せません）');
  }
}

function toggleSettle(evId){
  var el = $('settle-' + evId);
  if (el) el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

/* ------------------------------------------------------------------
   精算の明細に付ける「道順の地図（PDF）」のボタン。（2026-08-17）

   マイカー精算アプリで「地図をPDFで残す」を押すと、そのPDFのURLが
   精算の入力内容（settleForm）の中に mapUrl として保存されています。
   ここではそれを取り出して、計画表・報告書と同じ形のボタンにします。
   地図を残していない山行では、何も出しません。
   ------------------------------------------------------------------ */
function settleMapLink_(ev){
  try {
    if (!ev || !ev.settleForm) return '';
    var f = JSON.parse(ev.settleForm);
    var u = f && f.mapUrl ? String(f.mapUrl) : '';
    if (!u || u.indexOf('http') !== 0) return '';

    /* ------------------------------------------------------------------
       ★2026-08-18　その地図が「どの道」のものかを、ボタンに書きます。

       地図のPDFは「作ったときに選んでいた道」で作られます。
       そのあと別の道で精算しても、作り直さないかぎり地図は前のままです。
       実際、4番目の候補（高速なし・片道103.2km）で精算したのに、
       地図は 南関IC〜甘木IC（98.2km）のものだった、ということが起きました。
       **どの道の地図かを書いておけば、開く前に分かります。**
       ------------------------------------------------------------------ */
    var label = f.mapLabel ? String(f.mapLabel) : '';
    var mapKm = (f.mapKm != null && f.mapKm !== '') ? Number(f.mapKm) : null;
    var runKm = (f.autoKm != null && f.autoKm !== '') ? Number(f.autoKm) : null;
    /* 精算した道のりと地図の道のりが違うか（0.5kmまでは同じ道とみなす） */
    var differs = (mapKm != null && runKm != null && !isNaN(mapKm) && !isNaN(runKm) &&
                   Math.abs(mapKm - runKm) > 0.5);

    var h = '<div class="filelinks"><a class="filebtn" href="' + esc(u) +
            '" target="_blank" rel="noopener">🗺 この山行の道順の地図' +
            (label ? '（' + esc(label) + '）' : '') + '</a></div>';
    if (differs) {
      h += '<div style="color:#8a5a00;font-size:13px;margin-top:4px;">' +
           '※ この地図は<b>片道 ' + esc(String(mapKm)) + 'km</b> の道のものです。' +
           'この精算は<b>片道 ' + esc(String(runKm)) + 'km</b> なので、' +
           '<b>別の道の地図</b>です。</div>';
    }
    return h;
  } catch (e) { return ''; }
}

function delAnswer(evId, name){
  var myn = getName();
  if (!confirm('「' + name + '」さんの回答を取り消します。よろしいですか？')) return;
  post({ action: 'deleteAttendance', eventId: evId, name: name, memberId: idOf(name),
         requester: myn }, '回答を取り消しました');
}

function setLock(evId, lock){
  var name = getName();
  var msg = lock
    ? '出欠を締め切ります。メンバーは参加・不参加を変更できなくなります。よろしいですか？'
    : '締め切りを解除して、出欠を変更できるようにします。よろしいですか？';
  if (!confirm(msg)) return;
  /* 押した瞬間に画面を変える（出欠と同じやり方） */
  for (var k2 = 0; k2 < state.events.length; k2++){
    if (state.events[k2].id === evId) state.events[k2].locked = lock ? '1' : '';
  }
  render();
  post({ action: 'setLocked', id: evId, locked: lock ? '1' : '', name: name },
    lock ? '出欠を締め切りました' : '締め切りを解除しました');
}

function delEvent(evId, title){
  var name = getName();
  if (!confirm('「' + title + '」を削除します。よろしいですか？')) return;
  /* 押した瞬間に消して、送信は裏で行う。失敗したら戻す */
  var backup = null, pos = -1;
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId){ backup = state.events[i]; pos = i; }
  }
  if (pos >= 0) state.events.splice(pos, 1);
  render();
  post({ action: 'deleteEvent', id: evId, name: name }, '削除しました', null, function(){
    if (backup) { state.events.splice(pos, 0, backup); render(); }
  });
}

