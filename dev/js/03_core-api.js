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

/* ---------- 通信 ---------- */
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
    if (tryNo < 2 && method === 'GET'){
      setTimeout(function(){ api(method, body, cb, tryNo + 1, fresh); }, 2000);
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
    xhr.open('GET', url, true);
  } else {
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
    /* 名簿が読めているのに管理者が1人もいないときは、管理者なしのまま。
       ここでコードの名前を使うと、ほかのクラブでも只隈が管理者になってしまう。 */
    ADMINS  = (data.admins && data.admins.length) ? data.admins : [];
    EDITORS = data.editors || [];
    ADMIN_NAME = ADMINS[0] || '';

    TAKEN = data.taken || [];
    CONTACTS = data.contacts || [];

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
    lsSet(LSK.cache, JSON.stringify({
      events: state.events, attendance: state.attendance, notices: state.notices,
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
      admins: ADMINS, editors: EDITORS, taken: TAKEN, contacts: CONTACTS
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
    var y = el.getBoundingClientRect().top + window.pageYOffset - 12;
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
      setStatus(data.error, true);
      if (onFail) { try { onFail(); } catch(eF2){} }
      return;
    }
    setStatus(doneMsg || '');
    applyData(data);
    if (after) { try { after(data); } catch(eA){} }
  });
}

