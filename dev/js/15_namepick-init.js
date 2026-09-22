/* ==================================================================
   名前を選ぶ画面
   ------------------------------------------------------------------
   ・LINEで届く「自分専用のURL（?key=…）」がある人は、これまでどおり
     自動で名乗るので、この画面は出ません
   ・名簿に載っているだけの人（新しく入った会員など）は、
     ここで自分の名前をタップすれば使えるようになります
   ・管理者と幹事は、この一覧に出しません（専用URLからのみ名乗れます）
   ================================================================== */

var namePickRow = '';   /* 選ばれている行（'あ' 'か' … 空なら全員） */
var canWriteNotice = false;  /* お知らせを書ける人か（サーバーが判定） */
var lineGroupUrl = '';       /* クラブのLINEグループを開くURL（「設定」シート） */
var lineLeft = null;         /* 今月あと何通送れるか（幹事・管理者だけ受け取る。2026-08-24） */
var lineMode = '';           /* off / test / on（同上） */
/* ★2026-09-22（LINE通数の見える化）　画面に常時出すための3つ＋自動の連絡の日 */
var lineUsed  = null;        /* 今月すでに使った通数（概算） */
var lineLimit = null;        /* 無料枠（ふつうは200） */
var lineSize  = null;        /* 群にいる人数＝群へ1回流すと使う通数 */
var lineDays  = null;        /* 自動の連絡が群へ流れる日（既定は [7,1]） */
var markedSeen = {};         /* この画面で「見た」を送りずみのお知らせ */
var editorWarned = false;  /* 連絡窓口が未設定であることを知らせたか */
var adminWarned  = false;  /* 管理者が1人もいないことを知らせたか */

var YOMI_ROWS = [
  { label: 'あ行', chars: 'あいうえおぁぃぅぇぉ' },
  { label: 'か行', chars: 'かきくけこがぎぐげご' },
  { label: 'さ行', chars: 'さしすせそざじずぜぞ' },
  { label: 'た行', chars: 'たちつてとだぢづでどっ' },
  { label: 'な行', chars: 'なにぬねの' },
  { label: 'は行', chars: 'はひふへほばびぶべぼぱぴぷぺぽ' },
  { label: 'ま行', chars: 'まみむめも' },
  { label: 'や行', chars: 'やゆよゃゅょ' },
  { label: 'ら行', chars: 'らりるれろ' },
  { label: 'わ行', chars: 'わをん' }
];

/* 名前選択に出す人
   ・管理者・幹事は出さない（専用URLのみ）
   ・すでにどれかの端末で使い始めている人も出さない
   　→ 新しい会員には、自分の名前だけが並んで見えます
   ・機種変更などで自分の名前が要るときは「見つからない方はこちら」で全員出す */
var showTakenNames = false;

function selectableMembers(){
  var mine = lsGet(LSK.claimed);   /* この端末で登録した名前 */
  var r = [];
  for (var i = 0; i < MEMBERS.length; i++){
    var n = MEMBERS[i];
    /* 管理者・幹事も一覧に出します。
       ただしサーバー側で確認番号が必ず求められるので、
       番号を知らない人は名乗れません。 */
    var taken = (TAKEN.indexOf(n) >= 0);
    /* この端末で登録した名前は、使用中でも出す（自分に戻れるように） */
    if (taken && n === mine){
      r.push({ name: n, yomi: (MEMBER_YOMI[n] || ''), mine: true });
      continue;
    }
    if (!showTakenNames && taken) continue;
    r.push({ name: n, yomi: (MEMBER_YOMI[n] || ''), mine: false });
  }
  return r;
}

function toggleTakenNames(){
  showTakenNames = !showTakenNames;
  namePickRow = '';
  renderNamePick();
}

/* その読みが何行か（'あ' 'か' …）。分からなければ空 */
function rowOfYomi(y){
  if (!y) return '';
  var c = y.charAt(0);
  for (var i = 0; i < YOMI_ROWS.length; i++){
    if (YOMI_ROWS[i].chars.indexOf(c) >= 0) return YOMI_ROWS[i].label;
  }
  return '';
}

function showNamePick(){
  renderNamePick();
  $('installCard').style.display = 'none';
  $('nameCard').style.display = 'block';
  if ($('nameCard').scrollIntoView) $('nameCard').scrollIntoView(true);
}

function renderNamePick(){
  var list = selectableMembers();
  var html = '';

  if (list.length === 0){
    if (!showTakenNames && TAKEN.length > 0){
      $('namePickBody').innerHTML =
        '<p class="note">選べるお名前がありません。会員のみなさんは、すでにお使いです。</p>' +
        '<button type="button" class="cancelbtn" onclick="toggleTakenNames()">' +
        'スマホを変えた方・お名前が見つからない方はこちら</button>';
    } else {
      $('namePickBody').innerHTML =
        '<p class="note">名簿がまだ読み込めていません。' +
        '「最新の情報に更新する」を押してから、もう一度お試しください。</p>';
    }
    return;
  }

  /* 人数が多いときだけ「あ行・か行…」の絞り込みを出す */
  if (list.length > 20){
    var used = {};
    for (var u = 0; u < list.length; u++) used[rowOfYomi(list[u].yomi)] = true;
    html += '<div class="rowfilter">';
    html += '<button type="button" class="rowbtn' + (namePickRow === '' ? ' on' : '') +
            '" onclick="setNameRow(\'\')">全部</button>';
    for (var g = 0; g < YOMI_ROWS.length; g++){
      var lb = YOMI_ROWS[g].label;
      if (!used[lb]) continue;
      html += '<button type="button" class="rowbtn' + (namePickRow === lb ? ' on' : '') +
              '" onclick="setNameRow(\'' + lb + '\')">' + lb + '</button>';
    }
    html += '</div>';
  }

  html += '<div class="namegrid">';
  var shown = 0;
  for (var i = 0; i < list.length; i++){
    if (namePickRow && rowOfYomi(list[i].yomi) !== namePickRow) continue;
    var nm = list[i].name;
    html += '<button type="button" class="namebtn' + (list[i].mine ? ' mine' : '') +
            '" onclick="pickName(\'' + esc(nm).replace(/'/g, '') + '\')">' + esc(nm) +
            (list[i].mine ? '<span class="mtag">この端末で登録ずみ</span>' : '') + '</button>';
    shown++;
  }
  html += '</div>';
  if (shown === 0) html += '<p class="note">この行の方はいません。「全部」を押してください。</p>';

  if (showTakenNames){
    html += '<p class="note">すでにお使いの方を選ぶときは、確認番号が必要です。</p>' +
            '<button type="button" class="cancelbtn" onclick="toggleTakenNames()">まだの人だけ表示する</button>';
  } else if (TAKEN.length > 0){
    html += '<button type="button" class="cancelbtn" onclick="toggleTakenNames()">' +
            'スマホを変えた方・お名前が見つからない方はこちら</button>';
  }
  html += '<p class="note">お名前がないときは' + esc(contactName()) + 'にご連絡ください。</p>';
  $('namePickBody').innerHTML = html;
}

function setNameRow(r){
  namePickRow = r;
  renderNamePick();
}

/* 名前を選んだとき。サーバーに「この端末で使います」と登録しに行く。
   ・まだ誰も使っていない名前 → そのまま通る
   ・別のスマホで使われている名前 → 確認番号を聞く */
function pickName(name, code, retry){
  if (MEMBERS.indexOf(name) < 0) return;
  if (!code && !retry && !confirm('「' + name + '」さんとして使います。\nよろしいですか？')) return;

  setStatus(retry ? 'もう一度確認しています…' : '確認しています…');
  api('POST', { action: 'claimName', name: name, deviceId: deviceId(),
                devName: deviceName(), code: code || '' },
    function(err, data){
      if (err || !data){
        /* 書き込みは通っているのに返事だけ届かないことがある。
           同じ端末からの2回目は「登録ずみ」としてすぐ返るので、一度だけやり直す。 */
        if (!retry){
          setTimeout(function(){ pickName(name, code, true); }, 1500);
          return;
        }
        setStatus('通信に失敗しました。電波の良い場所でもう一度お試しください。', true);
        return;
      }
      if (data.ok){
        myName = name;
        lsSet(LSK.name, name);
        lsSet(LSK.claimed, name);
        if (idOf(name)) lsSet(LSK.mid, idOf(name));
        namePickRow = '';
        $('nameCard').style.display = 'none';
        updateWho();
        $('showImport').style.display = isStaff(myName) ? 'block' : 'none';
        setStatus(name + 'さんとして開いています');
        render();
        renderInstallCard();
        /* ★★2026-09-21（工事G-2 (b)）　管理者で確認番号がまだ無い方は、
           　この場で4けたを決めていただきます。機種を変えたときに
           　ご自分で名乗れるようにするためです。 */
        if (data.mustSetCode){
          MUST_SET_CODE = true;
          CODE_ASKED_   = true;
          renderCodeTip();
          alert('「' + name + '」さんは、クラブの管理をされる方です。\n\n' +
                '機種を変えたときにご自分で名乗り直せるよう、\n' +
                'この場で4けたの数字を決めてください。');
          openCfg();
          askSetCode();
        }
        return;
      }
      if (data.needCode){
        if (data.error) alert(data.error);
        askPickCode(name, data.first);
        return;
      }
      if (data.needAdmin){
        setStatus('');
        alert(data.error || 'この端末では登録できません');
        return;
      }
      setStatus('', false);
      alert(data.error || 'うまくいきませんでした。もう一度お試しください。');
    });
}

/* 確認番号を聞く（4けたの数字だけ入れられる欄を出す） */
function askPickCode(name, first){
  var msg = first
    ? '「' + name + '」さんの確認番号を入れてください。'
    : '「' + name + '」さんは、すでに別の端末でお使いです。<br>' +
      'ご本人であれば、確認番号を入れてください。';
  var html =
    '<div class="pinbox">' +
      '<p class="note" style="margin-top:0">' + msg + '</p>' +
      '<input type="tel" class="pin" id="pickCode" inputmode="numeric" pattern="[0-9]*" ' +
        'maxlength="4" autocomplete="off" placeholder="････">' +
      '<button type="button" class="subbtn" onclick="submitPickCode(\'' +
        esc(name).replace(/'/g, '') + '\')">この番号で使う</button>' +
      '<button type="button" class="cancelbtn" onclick="cancelPickCode()">やめる</button>' +
      '<p class="note">分からないときは' + esc(contactName()) + 'にご連絡ください。</p>' +
    '</div>';
  $('namePickBody').innerHTML = html;
  onlyDigits($('pickCode'));
  try { $('pickCode').focus(); } catch(e){}
  setStatus('');
}

function submitPickCode(name){
  var c = $('pickCode').value.replace(/[^0-9]/g, '');
  if (c.length !== 4){
    alert('4けたの数字を入れてください');
    try { $('pickCode').focus(); } catch(e){}
    return;
  }
  pickName(name, c);
}

function cancelPickCode(){
  setStatus('');
  renderNamePick();
}

/* ------------------------------------------------------------------
   「パソコンなど、べつの端末でも使う」
   4けたの数字をご本人に決めてもらい、名簿に保存する。
   もう一方の端末では、お名前を選んだあとにこの数字を入れれば使えるようになる。
   ------------------------------------------------------------------ */
/* 数字以外を打てないようにする */
function onlyDigits(el){
  if (!el) return;
  el.oninput = function(){
    this.value = this.value.replace(/[^0-9]/g, '').substring(0, 4);
  };
}

function askSetCode(){
  if (!myName){
    alert('先に、あなたのお名前を選んでください');
    return;
  }
  $('code1').value = '';
  $('code2').value = '';
  onlyDigits($('code1'));
  onlyDigits($('code2'));
  $('codeForm').style.display = 'block';
  $('setCodeBtn').style.display = 'none';
  $('setCodeNote').style.display = 'none';
  try { $('code1').focus(); } catch(e){}
}

function closeCodeForm(){
  $('codeForm').style.display = 'none';
  $('setCodeNote').style.display = 'block';
  /* ボタンを出してよいかは openCfg が決める */
  /* ★★2026-09-21（工事G 3-1）　開くとき（openCfg）と同じ条件にそろえました。
     　2026-08-23 に「幹事・管理者も会員と同じ扱い」と決めたとき、
     　閉じる側だけ !isStaff(myName) が残っていて、幹事・管理者が
     　フォームを閉じるとボタンが消えていました。 */
  var canSet = !!myName && (lsGet(LSK.claimed) === myName);
  $('setCodeBtn').style.display = canSet ? 'block' : 'none';
}

function submitSetCode(btn){
  var c1 = $('code1').value.replace(/[^0-9]/g, '');
  var c2 = $('code2').value.replace(/[^0-9]/g, '');
  if (c1.length !== 4){
    alert('4けたの数字を入れてください');
    try { $('code1').focus(); } catch(e){}
    return;
  }
  if (c1 !== c2){
    alert('2回の数字がちがいます。もう一度入れてください');
    $('code2').value = '';
    try { $('code2').focus(); } catch(e){}
    return;
  }

  /* ★★2026-09-21（只隈さんのご指摘）　押したその場で、押したことが分かるようにします。
     　只隈さん「決めるを押した時、OKがでるまで無反応なので、押したかどうかよく分からない」。
     　★画面いちばん上の「…しています」は、設定の画面からは見えません。 */
  admBusy_(btn, '登録しています…');
  setStatus('登録しています…');
  api('POST', { action: 'setCode', name: myName, deviceId: deviceId(), code: c1 },
    function(err, data){
      admBusyEnd_();
      if (err || !data){
        setStatus('通信に失敗しました。電波の良い場所でもう一度お試しください。', true);
        alert('通信に失敗しました。\n電波の良い場所で、もう一度お試しください。');
        return;
      }
      if (data.ok){
        setStatus('');
        alert('登録しました。\n\n' +
              'パソコン（または新しいスマホ）でこのアプリを開き、\n' +
              '「' + myName + '」を選んで、いま決めた4けたの数字を入れてください。\n\n' +
              '※数字は忘れないようにしてください');
        lsSet(LSK.codeTip, '1');
        MUST_SET_CODE = false;   /* ★決まったので、お誘いは下ろします */
        renderCodeTip();
        closeCodeForm();
        closeCfg();
        return;
      }
      setStatus('');
      alert(data.error || 'うまくいきませんでした。もう一度お試しください。');
    });
}

/* 「ちがう方の名前になっている場合はこちら」から呼ばれる */
function changeName(){
  if (!confirm('お名前を選び直しますか？\n\nちがう方の名前で開いてしまったときに使います。\nふだんは変える必要はありません。')) return;
  myName = '';
  lsSet(LSK.name, '');
  lsSet(LSK.mid, '');
  lsSet(LSK.codeTip, '');
  closeCfg();
  updateWho();
  showNamePick();
  render();
}

/* ---------- 初期化 ---------- */
function init(){
  /* ★2026-09-04　まず端末の控えからクラブの見た目・呼び名を当てる
     　（applyClubConfig は、この中で呼ばれます）*/
  loadClubCfg_();
  applyClubConfig();
  migrateOldKeys();

  var now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth() + 1;

  /* URLに ?key=○○（個人コード）が付いていたら、その人の名前を自動セット */
  try {
    var q = window.location.search;
    var mg = q ? q.match(/[?&]goto=([^&]+)/) : null;
    if (mg) gotoId = mg[1];
    /* Googleカレンダーへ行って戻ってきた（再読み込みされた）場合、記憶した予定へ移動 */
    if (!gotoId){
      var rg = lsGet(LSK.gotoId);
      if (rg){ gotoId = rg; }
    }
    lsSet(LSK.gotoId, '');
    /* ★CLUB.useKeyUrl が false のときは、?key= も ?name= も見ません。
       　お名前は「名前を選んでください」の画面から選んでいただきます。
       　?goto=（予定へ移動）はこれまでどおり効きます。 */
    if (CLUB.useKeyUrl){
      var mk = q ? q.match(/[?&]key=([a-z0-9]+)/) : null;
      if (mk && KEYS[mk[1]]){
        lsSet(LSK.name, KEYS[mk[1]]);
      } else {
        /* 旧形式 ?name=○○ にも当面対応
           ★これは「名前を打てば誰にでもなれる」いちばん古い抜け道。
           　useKeyUrl を true に戻すときも、ここは戻さないほうが安全。 */
        var mm = q ? q.match(/[?&]name=([^&]+)/) : null;
        if (mm){
          var qn = '';
          try { qn = decodeURIComponent(mm[1]); } catch(e){ qn = mm[1]; }
          qn = qn.replace(/\+/g, ' ').replace(/^\s+|\s+$/g, '');
          if (qn) lsSet(LSK.name, qn);
        }
      }
    }
  } catch(e){}

  /* ------------------------------------------------------------------
     前回の内容（予定・名簿）を先に読み込む。
     圏外のときも、コードに書いてある古い一覧ではなく、
     最後に受け取った本物の名簿で判断できるようにするため。
     ------------------------------------------------------------------ */
  try {
    var cd0 = JSON.parse(lsGet(LSK.cache) || '{}');
    state.events     = cd0.events || [];
    state.attendance = cd0.attendance || [];
    state.notices    = cd0.notices || [];
    if (cd0.members && cd0.members.length){
      MEMBERS  = cd0.members;
      ADMINS   = (cd0.admins && cd0.admins.length) ? cd0.admins : [];
      EDITORS  = cd0.editors  || [];
      ADMIN_NAME = ADMINS[0] || '';
      TAKEN    = cd0.taken    || [];
      CONTACTS = cd0.contacts || [];
      MEMBER_YOMI = {}; MEMBER_ID = {}; ID_NAME = {};
      for (var ci = 0; ci < MEMBERS.length; ci++){
        MEMBER_YOMI[MEMBERS[ci]] = (cd0.yomis && cd0.yomis[ci]) || '';
        var cid = (cd0.ids && cd0.ids[ci]) || '';
        if (cid){ MEMBER_ID[MEMBERS[ci]] = cid; ID_NAME[cid] = MEMBERS[ci]; }
      }
    }
  } catch(e){}

  /* 保存されている名前を読み込む（メンバー一覧にある名前だけ有効） */
  var saved = lsGet(LSK.name);
  myName = '';
  for (var ni = 0; ni < MEMBERS.length; ni++){
    if (MEMBERS[ni] === saved) myName = saved;
  }

  /* ------------------------------------------------------------------
     ここで見ている一覧は、まだサーバーから名簿が届く前の古いものです。
     名簿で名字が直されていると、この時点では「知らない名前」に見えます。
     会員IDを控えている端末は、名簿が届くまで名乗りをそのままにして、
     届いてから正しい表記に直します（名前を聞き直さないため）。
     ------------------------------------------------------------------ */
  if (!myName && saved){
    var bootId = lsGet(LSK.mid);
    var bootNm = bootId ? nameOfId(bootId) : '';
    if (bootNm){
      /* 控えの名簿に、その会員IDの新しい名字があった */
      myName = bootNm;
      lsSet(LSK.name, bootNm);
      if (lsGet(LSK.claimed)) lsSet(LSK.claimed, bootNm);
    } else if (bootId){
      /* まだ名簿が届いていない。名乗りはそのままにして、届いてから直す */
      myName = saved;
    }
  }

  updateWho();
  if (!myName) showNamePick();
  renderInstallCard();
  renderCodeTip();

  /* 専用URL（?key=）で開いている方も、その名前をこの端末のものとして
     登録しておく。こうしておかないと、ほかの人が名前選択の画面で
     その方の名前を選べてしまうため。1つの端末につき1回だけ送る。 */
  try {
    var claimedMark = lsGet(LSK.claimed);
    if (myName && claimedMark !== myName && claimedMark !== ('-' + myName)){
      api('POST', { action: 'claimName', name: myName, deviceId: deviceId(),
                    devName: deviceName(), silent: 1 },
        function(err, data){
          if (!err && data && data.ok){
            lsSet(LSK.claimed, myName);
            /* ★★2026-09-21（工事G-2 (b)）　管理者で確認番号がまだ無い方には、
               　4けたのお誘いを必ず出します（「あとで」で閉じた印も外します）。 */
            if (data.mustSetCode){
              MUST_SET_CODE = true; CODE_ASKED_ = true; renderCodeTip();
            }
          } else {
            /* 登録できなかった（すでに別の端末のものになっている等）。
               毎回送り直さないよう、しばらく間を置く印を付けておく */
            lsSet(LSK.claimed, '-' + myName);
          }
        });
    }
  } catch(e){}

  /* 管理者と幹事だけ「まとめて登録」ボタンを表示 */
  if (isStaff(myName)) $('showImport').style.display = 'block';
  /* ★2026-08-24　パソコンには LINE アプリが無いので、「LINEで知らせる」を押しても
     　LINEのホームページが開くだけで、何も送れません（実際に起きました）。
     　パソコンのときは、はっきりそう書いて「文だけコピーする」へ誘導します。 */
  try {
    var isPhone_ = /iPhone|iPad|iPod|Android/.test(navigator.userAgent || '');
    var sn = $('shareNote');
    if (sn && !isPhone_){
      sn.innerHTML =
        '<b>パソコンでは「LINEグループに貼る」は使えません。</b>' +
        'LINEのホームページが開くだけで、何も送れません。<br>' +
        '下の<b>「文だけコピーする」</b>を押して、LINEに貼り付けてください。<br>' +
        'スマホから開けば「LINEグループに貼る」がそのまま使えます。';
      var sg = $('shareGo');
      if (sg){ sg.style.background = '#bbb'; sg.style.borderColor = '#bbb'; }
    }
  } catch(eS){}
  $('shareCopy').onclick = function(){ copyText(shareText); };
  $('shareClose').onclick = closeShare;
  $('shareGo').onclick = function(){ setTimeout(closeShare, 1200); };

  $('showNotice').onclick = function(){
    $('noticeCard').style.display = 'block';
    $('noticeCell').style.display = 'none';
    $('noticeText').value = '';
    $('noticeUntil').value = '';
    /* ★2026-09-22　LINEへ流すかどうかは、★毎回オフから始めます。
       　前に流したから今回も流す、が起きないようにするためです。 */
    try { refreshNoticeLine_(); } catch (eNL) {}
    $('noticeText').focus();
  };
  $('noticeCancel').onclick = function(){
    $('noticeCard').style.display = 'none';
    $('noticeCell').style.display = canWriteNotice ? 'table-cell' : 'none';
  };
  $('noticeSave').onclick = function(){
    var t = $('noticeText').value.replace(/^[\s　]+|[\s　]+$/g, '');
    if (!t){ alert('お知らせの内容を書いてください'); return; }
    $('noticeCard').style.display = 'none';
    /* ★2026-09-22　LINEへ流すときだけ、押す前に通数をお見せします */
    var wantLine = !!($('noticeLine') && $('noticeLine').checked);
    if (wantLine && lineCostOnce_() > 0){
      if (!confirm('このお知らせを、クラブのLINEグループへも流します。\n\n' +
                   lineCostLines_(lineCostOnce_()) + '\n\n' +
                   '※アプリを開けば「読んだ」記録が残ります。\n' +
                   '　LINEは、いち早く絶対に見てほしいときだけお使いください。\n\n' +
                   'よろしいですか？')) return;
    }
    post({ action: 'addNotice', text: t, until: $('noticeUntil').value || '',
           mail: $('noticeMail').checked,
           line: wantLine,
           name: getName(), memberId: idOf(getName()) }, 'お知らせを出しました', function(){
      offerShare('【' + CLUB.shareTag + '】お知らせ\n' + t +
                 '\n\nアプリを開くと、いちばん上に出ています。\n' +
                 location.href.split('?')[0]);
    });
  };

  $('showImport').onclick = function(){
    $('importCard').style.display = 'block';
    try { renderBulkTable(); } catch(e){}
    $('showImport').style.display = 'none';
  };
  $('importCancel').onclick = closeImport;
  $('importBtn').onclick = submitImport;
  /* ★2026-09-03　入力表 */
  $('bulkBtn').onclick = submitBulkTable;
  $('bulkAddRow').onclick = bulkAddRow;
  $('exportBtn').onclick = exportEvents;
  $('exportFileBtn').onclick = exportEventsFile;
  $('filePickBtn').onclick = function(){ $('fileInput').click(); };
  $('fileInput').onchange = function(){
    if (this.files && this.files[0]) fileToTable(this.files[0]);
    this.value = '';
  };
  var dz = $('dropZone');
  dz.ondragover = function(e){ e.preventDefault(); dz.style.background = '#dff0e0'; };
  dz.ondragleave = function(){ dz.style.background = '#f4f9f4'; };
  dz.ondrop = function(e){
    e.preventDefault();
    dz.style.background = '#f4f9f4';
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]){
      fileToTable(e.dataTransfer.files[0]);
    }
  };

  $('prevM').onclick = function(){ moveMonth(-1); };
  $('nextM').onclick = function(){ moveMonth(1); };
  $('showAdd').onclick = function(){
    var n = new Date();
    openAddForm(state.year, state.month, state.year === n.getFullYear() && state.month === n.getMonth() + 1 ? n.getDate() : 1);
  };
  $('addCancel').onclick = closeAddForm;
  $('addBtn').onclick = submitAdd;
  $('refPlan').onclick = function(){ openPicker('plan'); };
  $('refReport').onclick = function(){ openPicker('report'); };
  $('pickerClose').onclick = closePicker;
  $('addRep').onchange = function(){
    $('repLenWrap').style.display = ($('addRep').value !== 'none') ? 'block' : 'none';
    try { refreshRepPreview(); } catch(e){}
  };
  /* ★2026-09-03　期間・日付を変えても、できる日の一覧を出し直す */
  $('addRepLen').onchange = function(){ try { refreshRepPreview(); } catch(e){} };
  $('addY').onchange = function(){ try { refreshRepPreview(); } catch(e){} };
  $('addM').onchange = function(){ try { refreshRepPreview(); } catch(e){} };
  $('addD').onchange = function(){ try { refreshRepPreview(); } catch(e){} };
  $('reloadBtn').onclick = function(){ load(true); };
  $('cfgBtn').onclick = openCfg;

  /* Googleカレンダー連携チェックボックス（この端末に記憶） */
  $('gcalChk').checked = (lsGet(LSK.gcalPref) === 'yes');
  $('gcalChk').onchange = function(){
    lsSet(LSK.gcalPref, this.checked ? 'yes' : 'no');
  };

  /* 前回の内容は、この関数のはじめで読み込みずみ */

  render();
  /* 精算アプリから戻ってきたときは、手元の控えですぐその予定へ移動する。
     サーバーの返事を待たないので、待たされません。 */
  tryGoto();
  load();
}
init();
