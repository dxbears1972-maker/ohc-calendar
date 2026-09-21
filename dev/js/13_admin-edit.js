/* ==================================================================
   ★★2026-09-14（工事E-1O）　押したボタンそのものを「変えています…」にする

   　只隈さん「この内容で変えるを押すと、ものすごく反応が遅く、
   　　　　　　動いているか動いていないかが分かりません」。

   　知らせ（admSay_）は画面のずっと上に出るので、指の下では
   　★何も起きていないように見えていました。
   　★E-1の#10（サーバーの断りが623px上に出ていた）と同じ性質の見落としです。
   　サーバーは3〜5秒かかります。速さはここで止めると決めているので、
   　★「いま動いている」ことを、押したその場で見せます。
   ================================================================== */
var ADM_BUSY_ = null;
function admBusy_(btn, text){
  if (!btn) return;
  ADM_BUSY_ = { el: btn, text: btn.textContent };
  try {
    btn.disabled = true;
    btn.style.opacity = '0.55';
    btn.textContent = text || '変えています…';
  } catch (e) {}
}
function admBusyEnd_(){
  if (!ADM_BUSY_) return;
  try {
    ADM_BUSY_.el.disabled = false;
    ADM_BUSY_.el.style.opacity = '';
    ADM_BUSY_.el.textContent = ADM_BUSY_.text;
  } catch (e) {}   /* 画面が描き直されていたら、もう無いので何もしません */
  ADM_BUSY_ = null;
}

/* ==================================================================
   ★★2026-09-14（工事E-2b）　答えは、押したその場に出す。★画面を動かさない。

   　只隈さん「この内容で変えるを押すと、画面がスライドするので、わかりづらい」。

   　これまでは、1回押すごとに★2回も画面が飛んでいました。
   　　①押した瞬間　… 画面のいちばん上の知らせへ（admSay_ の scrollIntoView）
   　　②終わったとき… 「会員の設定を変える」のボタンへ（scrollIntoView）
   　箱が6つになって画面が長くなったので、飛ぶ幅も大きくなりました。

   　→ ★★押したボタンのすぐ下に答えを出し、★★画面の位置はそのままにします。
   　★E-1の#10・E-1O と同じ考え（押した場所と、答えの出る場所を離さない）。
   ================================================================== */
var ADM_MSG_AT_ = null;      /* {sec:'contact', text:'…', err:true/false} */

function admSayAt_(sec, text, isErr, name){
  ADM_MSG_AT_ = { sec: sec, text: text, err: !!isErr };
  var y = window.pageYOffset || document.documentElement.scrollTop || 0;
  /* ★描き直します。断られたときも描き直します（E-1M 案2）。 */
  if (adminFind_(name)) adminEditMember(name); else renderRoles_();
  ADM_MSG_AT_ = null;
  try { window.scrollTo(0, y); } catch (eY){}
  /* ★断りだけは窓でも出します（見落とすと、何も起きなかったように見えるため） */
  if (isErr) alert(text);
}

/* その箱に出す答え（無ければ空） */
function admSecMsg_(sec){
  if (!ADM_MSG_AT_ || ADM_MSG_AT_.sec !== sec) return '';
  var m = ADM_MSG_AT_;
  return '<p style="margin:8px 0 0;font-size:16px;font-weight:bold;' +
         'text-align:center;color:' + (m.err ? '#b00000' : '#2e6b34') + '">' +
         esc(m.text) + '</p>';
}

/* ★2026-09-08（工事E-1）　退会・端末リセット・確認番号リセット */
function adminMemberOp(op, btn){
  var name = ADMIN_EDIT;
  if (!name) return;
  var q = '';
  if (op === 'resetDevice')
    q = '「' + name + '」さんを、はじめて使う状態に戻します。\n' +
        '登録された端末と、4けたの確認番号を、いっしょに消します。\n' +
        'そのあと、新しい端末でお名前を選び直していただきます。\n\nよろしいですか？';
  if (op === 'leave')
    q = '「' + name + '」さんを退会にします。\n' +
        '会員の一覧にも、出欠のお相手にも出なくなります。\n\nよろしいですか？';
  if (op === 'rejoin')
    q = '「' + name + '」さんの退会を取り消します。\n' +
        '役割は「なし」で戻ります。\n\nよろしいですか？';
  if (!q || !confirm(q)) return;

  admBusy_(btn);
  var sec = (op === 'resetDevice') ? 'device' : 'leave';
  api('POST', { action: 'adminMemberOp', deviceId: deviceId(), name: myName,
                target: name, op: op },
    function(err, data){
      admBusyEnd_();
      if (err || !data || data.error){
        admSayAt_(sec, (data && data.error) ? data.error :
          '変えられませんでした。電波の良いところで、もう一度お試しください。', true, name);
        return;
      }
      if (admApplyView_(data)){
        ADMIN_EDIT = null;
        ADMIN_PANE = 'roles';
        admSayAt_(sec,
          (op === 'resetDevice')
            ? ((data.hadCode ? '端末と確認番号を' : '端末の登録を') +
               'リセットしました。はじめて使う状態に戻りました。') :
          (op === 'leave')       ? '退会にしました。' : '退会を取り消しました。',
          false, name);
      } else {
        admAfterMember_(name);
      }
    });
}

function adminSaveMember(btn){
  var name = ADMIN_EDIT;
  if (!name) return;
  var rs = document.getElementsByName('admRole'), role = '';
  for (var i = 0; i < rs.length; i++){ if (rs[i].checked) role = rs[i].value; }
  var ct = $('admContact') ? $('admContact').checked : false;
  admBusy_(btn);
  api('POST', { action: 'adminSetMember', deviceId: deviceId(), name: myName,
                target: name, role: role, contact: ct },
    function(err, data){
      admBusyEnd_();
      if (err || !data || data.error){
        /* ★2026-09-14（工事E-1M・案2）　断られたときは、★画面を本当の姿に戻します。
           　知らせを出すだけだと、選んだ丸がそのまま残り、
           　「変わっていないのに、変わったように見える」状態になります。 */
        admSayAt_('role', (data && data.error) ? data.error :
          '変えられませんでした。電波の良いところで、もう一度お試しください。', true, name);
        return;
      }
      if (admApplyView_(data)){
        ADMIN_EDIT = null;
        ADMIN_PANE = 'roles';
        admSayAt_('role', '役割と連絡窓口を変えました。', false, name);
      } else {
        admAfterMember_(name);
      }
    });
}

/* ★★2026-09-14（工事E-2）　電話・メール・備考を変えます。
   　★断られたときは、画面を本当の姿に戻してから知らせます（E-1M と同じ）。
   　★変えられたときは、その方の画面のまま「変えました」と出します。 */
/* ==================================================================
   ★★2026-09-14（工事E-3）　新しい会員を足す

   　答えは★押したその場（この箱の下）に出し、★画面は動かしません（E-2b）。
   ================================================================== */
var ADM_NEWNAME_ = '', ADM_NEWYOMI_ = '';

/* ★★足した方を、その場で手元の名簿にも入れます。
   　★E-4b とまったく同じ理由：会員の一覧（MEMBERS）は
   　　読み込み（loadAll_）でしか入れ替わらないので、このひと手間が無いと、
   　　足した直後は「名前をえらぶ」にも、出欠のお相手にも出てきません。
   　★よみを見て、50音順の正しい場所に入れます（サーバーの並びに合わせるため）。
   　★往復は増やしていません。返ってきた答えを使っているだけです。 */
function admMemberSync_(name, yomi, id){
  try {
    if (!MEMBERS || !MEMBERS.length) return;
    if (MEMBERS.indexOf(name) >= 0) return;
    var at = MEMBERS.length;
    if (yomi){
      for (var i = 0; i < MEMBERS.length; i++){
        var y = MEMBER_YOMI[MEMBERS[i]] || '';
        if (!y || yomi < y){ at = i; break; }   /* よみが空の方は、うしろに置かれています */
      }
    }
    MEMBERS.splice(at, 0, name);
    MEMBER_YOMI[name] = yomi || '';
    if (id){ MEMBER_ID[name] = id; ID_NAME[id] = name; }
  } catch (e) {}
}

function adminAddMember(btn){
  var e1 = $('admNewName'), e2 = $('admNewYomi');
  var nm = e1 ? e1.value : ADM_NEWNAME_;
  var ym = e2 ? e2.value : ADM_NEWYOMI_;
  ADM_NEWNAME_ = nm; ADM_NEWYOMI_ = ym;
  /* ★断られると分かっていることは、画面で先に止めます（07_つくるときの決まり 2章） */
  if (!String(nm).replace(/[\s　]/g, '')){
    admSayAt_('memadd', '名字を入れてください', true, null); return;
  }
  if (!String(ym).replace(/[\s　]/g, '')){
    admSayAt_('memadd', 'よみ（ひらがな）を入れてください', true, null); return;
  }

  admBusy_(btn, '足しています…');
  api('POST', { action: 'adminAddMember', deviceId: deviceId(), name: myName,
                member: nm, yomi: ym },
    function(err, data){
      admBusyEnd_();
      if (err || !data || data.error){
        admSayAt_('memadd', (data && data.error) ? data.error :
          '足せませんでした。電波の良いところで、もう一度お試しください。', true, null);
        return;
      }
      var added = data.member || nm;
      if (admApplyView_(data)){
        admMemberSync_(added, data.yomi || '', data.id || '');
        ADM_NEWNAME_ = ''; ADM_NEWYOMI_ = '';
        ADMIN_EDIT = null;
        admSayAt_('memadd', '「' + added + '」さんを足しました。' +
                  'つづけて、その方の「変える」から連絡先などを入れてください。', false, null);
      } else {
        admBack_('roles');
      }
    });
}

function adminSaveContact(btn){
  var name = ADMIN_EDIT;
  if (!name) return;
  var tel  = $('admTel')  ? $('admTel').value  : '';
  var mail = $('admMail') ? $('admMail').value : '';
  var memo = $('admMemo') ? $('admMemo').value : '';
  admBusy_(btn);
  api('POST', { action: 'adminSetContact', deviceId: deviceId(), name: myName,
                target: name, tel: tel, mail: mail, memo: memo },
    function(err, data){
      admBusyEnd_();
      if (err || !data || data.error){
        admSayAt_('contact', (data && data.error) ? data.error :
          '変えられませんでした。電波の良いところで、もう一度お試しください。', true, name);
        return;
      }
      if (admApplyView_(data)){
        ADMIN_EDIT = null;
        ADMIN_PANE = 'roles';
        admSayAt_('contact', '連絡先と備考を変えました。', false, name);
      } else {
        admAfterMember_(name);
      }
    });
}

/* --- 予定の種類と顔ぶれ（作業マスタ） ---
   ★2026-09-08（工事E-1f）　只隈さんのご指摘：「役員とかは係じゃない気がしますが」。
   　そのとおりで、この表は係の表ではなく、★予定の「種類」ごとに
   　『毎回同じ顔ぶれ』を決める表です（あしあと印刷＝係／役員会＝会合）。
   　2026-09-03に「役員会は作業マスタで決める」と決めたのが、ここに効いています。
   　★★2026-09-14（工事E-4）　種類そのものを足す・消すを、ここへ移しました。
   　　スプレッドシートの1行目に書く必要はもうありません。 */

/* ★画面を描き直しても、打っていただいた文字が消えないように持っておきます */
var ADM_NEWWORK_ = '';

/* ★★2026-09-14（工事E-4）　答えは押したその場に出し、★画面は動かしません。
   　where … 'list'（一覧を描き直す）／'edit'（その種類の画面を描き直す）
   　★E-2b と同じ考え方です。 */
function admSayWork_(sec, text, isErr, where, name){
  ADM_MSG_AT_ = { sec: sec, text: text, err: !!isErr };
  var y = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (where === 'edit' && name) adminEditWork(name); else renderWorks_();
  ADM_MSG_AT_ = null;
  try { window.scrollTo(0, y); } catch (eY){}
  if (isErr) alert(text);
}

function renderWorks_(){
  var wk = (ADMIN_DATA && ADMIN_DATA.works) || [], h = '';
  ADMIN_EDIT = null;
  admMsg_().textContent = wk.length
    ? '顔ぶれを決めたい種類の「変える」を押してください。'
    : 'まだ、予定の種類はひとつもありません。';
  for (var i = 0; i < wk.length; i++){
    /* ★名前を onclick の中に直に書くのをやめ、並びの番号で渡します。
       　esc() はアポストロフを逃がしません。種類の名前を手で入れられるように
       　なった以上、ここは番号で渡すのが安全です。 */
    h += '<div style="padding:10px;border-bottom:1px solid #e3e8e3">' +
           '<div><b>' + esc(wk[i].name) + '</b></div>' +
           '<div style="font-size:15px;color:#666">' +
             esc(wk[i].members.length ? wk[i].members.join('、') : '（まだ決まっていません）') +
           '</div>' +
           '<button type="button" class="subbtn" style="margin-top:6px"' +
             ' onclick="adminEditWorkAt(' + i + ')">変える</button>' +
         '</div>';
  }
  if (!wk.length){
    h = '<p class="note" style="padding:4px 10px">下の「新しい種類を足す」から、' +
        '「役員会」のように、毎回同じ方が集まる予定の名前を入れてください。</p>';
  }

  /* ★★2026-09-14（工事E-4）　新しい種類を足す */
  h += '<div class="admsec">' +
         '<div class="admsec-h">新しい種類を足す</div>' +
         '<input type="text" id="admNewWork" maxlength="20" autocomplete="off"' +
           ' placeholder="例）役員会" value="' + esc(ADM_NEWWORK_) + '"' +
           ' oninput="ADM_NEWWORK_ = this.value">' +
         '<p class="note" style="margin-top:2px">「役員会」のように、' +
           '<b>毎回同じ顔ぶれ</b>が集まる予定に使います。<br>' +
           '足したあと、その種類の「変える」で、' +
           '<b>必ず顔ぶれを選んでください。</b>' +
           '選ばないと、その予定は登録した方お一人にしか届きません。</p>' +
         '<button type="button" class="bigbtn" style="margin-top:8px"' +
           ' onclick="adminAddWork(this)">この名前で足す</button>' +
         admSecMsg_('workadd') +
       '</div>';

  admList_().innerHTML = h + admCloseBtn_();
}

/* ★一覧の並びの番号から、その種類の画面へ */
function adminEditWorkAt(i){
  var wk = (ADMIN_DATA && ADMIN_DATA.works) || [];
  if (i < 0 || i >= wk.length) return;
  adminEditWork(wk[i].name);
}

function adminEditWork(name){
  var wk = (ADMIN_DATA && ADMIN_DATA.works) || [], cur = [];
  for (var i = 0; i < wk.length; i++){ if (wk[i].name === name) cur = wk[i].members; }
  ADMIN_EDIT = name;
  var mb = adminAlive_(), h = '';
  for (var k = 0; k < mb.length; k++){
    var on = cur.indexOf(mb[k].name) >= 0;
    h += '<label style="display:block;padding:8px 4px;font-size:17px;' +
           'border-bottom:1px solid #eef1ee">' +
           '<input type="checkbox" class="admWk" value="' + esc(mb[k].name) + '"' +
           (on ? ' checked' : '') + '> ' + esc(mb[k].name) + '</label>';
  }
  admMsg_().textContent = name + 'の画面です。';
  admList_().innerHTML =
    '<div style="padding:10px">' +
      '<div style="font-size:19px;margin-bottom:6px"><b>' + esc(name) + '</b></div>' +
      /* ① 毎回入る方 */
      '<div class="admsec">' +
        '<div class="admsec-h">毎回入る方</div>' +
        h +
        '<button type="button" class="bigbtn" style="margin-top:8px"' +
          ' onclick="adminSaveWork(this)">この内容で変える</button>' +
        admSecMsg_('work') +
      '</div>' +
      /* ★★② この種類をやめる（2026-09-14 工事E-4） */
      '<div class="admsec">' +
        '<div class="admsec-h">この種類をやめる</div>' +
        '<p class="note" style="margin-top:0">消すと、予定を登録するときの' +
          '「予定の種類」に出なくなります。<br>' +
          '<b>この種類を使っている予定が残っているあいだは、消せません。</b><br>' +
          '過去の記録は残ります。</p>' +
        '<button type="button" class="carebtn"' +
          ' onclick="adminDelWork(this)">この種類を消す</button>' +
        admSecMsg_('workdel') +
      '</div>' +
      '<button type="button" class="cancelbtn" style="margin-top:14px"' +
        ' onclick="showAdminView(\'works\', true)">やめる</button>' +
    '</div>';
}

function adminSaveWork(btn){
  var name = ADMIN_EDIT;
  if (!name) return;
  var cbs = document.getElementsByClassName('admWk'), list = [];
  for (var i = 0; i < cbs.length; i++){ if (cbs[i].checked) list.push(cbs[i].value); }
  admBusy_(btn);
  api('POST', { action: 'adminSetWork', deviceId: deviceId(), name: myName,
                work: name, members: list },
    function(err, data){
      /* ★★2026-09-14（工事E-2b）　ここに `admBusyEnd_()` が無く、断られると
         　ボタンが「変えています…」のまま、押せない状態で残っていました。 */
      admBusyEnd_();
      if (err || !data || data.error){
        admSayWork_('work', (data && data.error) ? data.error :
          '変えられませんでした。電波の良いところで、もう一度お試しください。',
          true, 'edit', name);
        return;
      }
      if (admApplyView_(data)){
        admWorksSync_('set', name, list);
        /* ★★2026-09-14（工事E-4）　ここは以前、一覧へ戻ってから
           　「予定の種類と顔ぶれ」のボタンまで画面が飛んでいました。
           　★会員の画面と同じく、そのままで結果を見せます（E-2b）。 */
        admSayWork_('work', name + 'の顔ぶれを変えました。', false, 'edit', name);
      } else {
        admBack_('works');
      }
    });
}

/* ==================================================================
   ★★★2026-09-14（工事E-4）　足した・消したを、その場で画面に反映させる

   　只隈さんの実機で、★足した種類が「予定の種類」に出ず、
   　★「最新にする」を押してはじめて出ました。2026-09-14。

   　理由：種類の一覧（WORKS）は★読み込み（loadAll_）でしか入れ替わらない。
   　管理者の画面は別の往復（adminView）なので、そちらだけが新しくなっていた。
   　→ ★書き換えが通ったら、手元の WORKS も同じだけ直して、
   　　 ★「予定の種類」の選択肢を作り直します。
   　★往復は増やしていません。すでに戻ってきている答えを使っているだけです。
   ================================================================== */
function admWorksSync_(op, name, members){
  try {
    if (!WORKS || typeof WORKS !== 'object') WORKS = {};
    if (op === 'del') { delete WORKS[name]; }
    else if (op === 'add') { WORKS[name] = []; }
    else { WORKS[name] = (members || []).slice(); }
    fillTargetSelect_();
  } catch (e) {}
}

/* ★★2026-09-14（工事E-4）　新しい種類を足す */
function adminAddWork(btn){
  var el = $('admNewWork');
  var nm = el ? el.value : ADM_NEWWORK_;
  ADM_NEWWORK_ = nm;
  if (!String(nm).replace(/[\s　]/g, '')){
    admSayWork_('workadd', '予定の種類の名前を入れてください。', true, 'list');
    return;
  }
  admBusy_(btn);
  api('POST', { action: 'adminWorkOp', deviceId: deviceId(), name: myName,
                op: 'add', work: nm },
    function(err, data){
      admBusyEnd_();
      if (err || !data || data.error){
        admSayWork_('workadd', (data && data.error) ? data.error :
          '足せませんでした。電波の良いところで、もう一度お試しください。',
          true, 'list');
        return;
      }
      var added = (data.work || nm);
      ADM_NEWWORK_ = '';     /* ★入ったので、入力欄は空に戻します */
      admWorksSync_('add', added);
      if (admApplyView_(data)){
        admSayWork_('workadd', '「' + added + '」を足しました。' +
          'つづけて「変える」を押し、顔ぶれを選んでください。', false, 'list');
      } else {
        admBack_('works');
      }
    });
}

/* ★★2026-09-14（工事E-4）　種類を消す。
   　★使われているときは、サーバーが件数を添えて断ります。 */
function adminDelWork(btn){
  var name = ADMIN_EDIT;
  if (!name) return;
  admBusy_(btn);
  api('POST', { action: 'adminWorkOp', deviceId: deviceId(), name: myName,
                op: 'del', work: name },
    function(err, data){
      admBusyEnd_();
      if (err || !data || data.error){
        admSayWork_('workdel', (data && data.error) ? data.error :
          '消せませんでした。電波の良いところで、もう一度お試しください。',
          true, 'edit', name);
        return;
      }
      if (admApplyView_(data)){
        /* ★その種類はもう無いので、一覧へ戻ります。
           　★画面の長さが変わるので、答えが見えるように
           　　「予定の種類と顔ぶれ」のボタンの位置まで戻します。
           　　そのすぐ下に、今の答えが出ます。 */
        admWorksSync_('del', name);
        ADMIN_EDIT = null;
        ADMIN_PANE = 'works';
        renderWorks_();
        admMsg_().textContent = '「' + name + '」を消しました。';
        var bt3 = $('admBtn_works');
        if (bt3){ try { bt3.scrollIntoView({ block: 'start' }); } catch (eW3){} }
      } else {
        admBack_('works');
      }
    });
}

function openCfg(){
  updateWho();
  closeCodeForm();

  /* 連絡窓口が1人も決まっていなければ、管理者にだけ知らせる */
  $('needEditor').style.display =
    (isAdmin_(myName) && CONTACTS.length === 0) ? 'block' : 'none';

  /* 「べつの端末でも使う」を出してよいかを決める。
     ★2026-08-23：どのクラブでも同じやり方に統一しました。
     　　1台目 … お名前を選ぶだけ
     　　2台目 … お名前を選んだあと、4けたの確認番号を入れる
     　専用URL（?key=…）はOHCだけの古いやり方なので、案内には出しません。
     　幹事・管理者も会員と同じ扱いにするため、isStaff の除外をやめました
     　（もとの条件：!!myName && !isStaff(myName) && (lsGet(LSK.claimed) === myName)）。
     ・この端末で名前を登録していない方は、ここでは設定できない */
  var canSet = !!myName && (lsGet(LSK.claimed) === myName);
  $('setCodeBtn').style.display = canSet ? 'block' : 'none';

  if (!myName){
    $('setCodeNote').innerHTML = 'まだお名前が選ばれていません。';
  } else if (!canSet) {
    $('setCodeNote').innerHTML =
      'この端末では、べつの端末を追加する設定ができません。<br>' +
      'ふだんお使いの端末から行ってください。';
  } else {
    $('setCodeNote').innerHTML =
      'いま使っているこの端末のほかに、パソコンや新しいスマホでも' +
      '同じお名前で使いたいときに押してください。4けたの数字を決めていただきます。<br>' +
      '2台目では、お名前を選んだあとにこの4けたを入れると使えるようになります。<br>' +
      '1台だけで使う方は、押す必要はありません。<br>' +
      '<b>4けたの数字は、ほかの方には教えないでください。</b>';
  }
  $('setCodeNote').style.display = 'block';

  /* ★2026-09-07（工事C 段3）管理者の画面は、管理者にだけ出します */
  var ab = $('adminBox');
  if (ab){
    ab.style.display = isAdmin_(myName) ? 'block' : 'none';
    ADMIN_DATA = null;                 /* 開くたびに読み直す */
    ADMIN_STALE = false;
    ADMIN_WAIT = [];
    admPanesOff_();
    ADMIN_PANE = '';
    /* ★2026-09-08（工事E-1c）　押される前に、裏で読み始めます */
    if (isAdmin_(myName)) adminLoad_(null);
  }

  var rb = $('reInstallBtn');
  if (rb) rb.style.display = isStandalone() ? 'none' : 'block';

  $('cfgCard').style.display = 'block';
  $('cfgBtn').style.display = 'none';
  if ($('cfgCard').scrollIntoView) $('cfgCard').scrollIntoView(true);
}

function closeCfg(){
  $('cfgCard').style.display = 'none';
  $('cfgBtn').style.display = 'inline-block';
}

