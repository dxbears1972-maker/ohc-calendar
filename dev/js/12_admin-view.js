/* ------------------------------------------------------------------
   ★2026-09-07（工事C 段3）　管理者の画面（見るだけ）

   　サーバーが返すのは「安全な項目」だけです。
   　★確認番号そのものと、端末の記号そのものは返ってきません。
   　　管理者に要るのは「決めているか」「何台か」だけだからです。
   ------------------------------------------------------------------ */
var ADMIN_DATA = null;

/* ★★2026-09-15（工事E-5d）　控えが古いかどうかの印。
   　true のあいだは、ボタンを押したときに必ず読み直します。 */
var ADMIN_STALE = false;

/* ★2026-09-08（工事E-1b）　開いた一覧を閉じるボタン。
   　只隈さんのご指摘：31名の一覧が開きっぱなしになると、下まで送るのが大変。 */
var ADMIN_PANE = '';
var ADMIN_KEYS = ['logs', 'members', 'roles', 'works', 'notices', 'stats'];

/* いま開いている入れ物 */
function admList_(){ return $('adminList_' + ADMIN_PANE); }
function admMsg_(){  return $('adminMsg_'  + ADMIN_PANE); }

/* 全部たたむ */
function admPanesOff_(){
  ADM_DRV_ = null;   /* ★2026-09-29q　保存していない「車を出せる方」の選びかけは捨てる */
  for (var i = 0; i < ADMIN_KEYS.length; i++){
    var k = ADMIN_KEYS[i];
    var pn = $('admPane_' + k);   if (pn) pn.className = 'admpane';
    var gp = $('admGrp_' + k);    if (gp) gp.className = 'admgrp';
    var bt = $('admBtn_' + k);    if (bt) bt.className = 'subbtn';
    var ls = $('adminList_' + k); if (ls) ls.innerHTML = '';
    var ms = $('adminMsg_' + k);  if (ms) ms.textContent = '';
  }
}

/* ★2026-09-08（工事E-1g）　答えが、押したところから遠くに出ていました。
   　只隈さん「退会押して何も出ませんでしたよ」。実測すると、サーバーは正しく
   　断っていたのに、その文字は★画面の623px上（＝画面の外）に出ていました。
   　　・知らせは、押した場所へ戻して見せる（scrollIntoView）
   　　・断られたときは、見落とさないよう窓でも出す（alert）
   　　・終わったら、変えた一覧の先頭へ戻す */
function admSay_(msg, isErr){
  var el = admMsg_();
  if (el) el.textContent = msg;
  if (isErr) alert(msg);          /* ★窓は先に。閉じたあとで位置を合わせます */
  if (el){ try { el.scrollIntoView({ block: 'center' }); } catch (eS){} }
}

/* ★2026-09-08（工事E-1i）　変えたあとは、その方の画面のまま結果を見せます。
   　只隈さん「退会を押したけど、退会を取り消すはない気がしますが」。
   　一覧の先頭へ戻していたので、退会にした方は★31名の下のほう（退会の欄）へ
   　行ってしまい、見つけられませんでした。 */
/* ★2026-09-08（工事E-1k）　書き換えの返事に、新しい中身（view）が
   　載っていればそれを使います。載っていない古いサーバーのときは、
   　これまでどおり読み直します（batを当てる前でも動きます）。 */
function admApplyView_(data){
  if (!data || !data.view || !admViewOk_(data.view)) return false;
  ADMIN_DATA = data.view;
  ADMIN_STALE = false;
  return true;
}

function admAfterMember_(name){
  ADMIN_DATA = null; ADMIN_EDIT = null;
  ADMIN_PANE = 'roles';
  var msgEl = $('adminMsg_roles');
  if (msgEl) msgEl.textContent = '読み込んでいます…';
  adminLoad_(function(msg){
    if (ADMIN_PANE !== 'roles') return;
    if (msg){ admSay_(msg, true); return; }
    if (adminFind_(name)){
      adminEditMember(name);
    } else {
      renderRoles_();          /* 名簿から見つからないときだけ、一覧へ戻ります */
    }
    var bt = $('admBtn_roles');
    if (bt){ try { bt.scrollIntoView({ block: 'start' }); } catch (eA){} }
  });
}

function admBack_(which){
  ADMIN_DATA = null; ADMIN_EDIT = null;
  showAdminView(which, true);
  var bt = $('admBtn_' + which);
  if (bt){ try { bt.scrollIntoView({ block: 'start' }); } catch (eB){} }
}

function admCloseBtn_(){
  return '<button type="button" class="cancelbtn" style="margin-top:14px"' +
         ' onclick="closeAdminView()">とじる</button>';
}
function closeAdminView(){
  ADMIN_EDIT = null;
  admPanesOff_();
  ADMIN_PANE = '';
}

/* ★2026-09-08（工事E-1c）　サーバーとの往復に約5秒かかります（只隈さん実測）。
   　押されてから読み始めると、その5秒がまるごと待ち時間になるので、
   　★⚙設定を開いた時点で、管理者のときだけ裏で読み始めます。
   　読み終わる前に押されたときは、二重に読まずに、この1本の結果を待ちます。 */
var ADMIN_LOADING = false;
var ADMIN_WAIT = [];

/* ★2026-09-29r　管理者の画面の返事か（会員が「名前の入った箱」で届いているか） */
function admViewOk_(d){
  if (!d || !d.members || !d.logs) return false;
  for (var i = 0; i < d.members.length; i++){
    if (!d.members[i] || typeof d.members[i] !== 'object' || !d.members[i].name) return false;
  }
  return true;
}
function adminLoad_(cb){
  if (ADMIN_DATA && !ADMIN_STALE){ if (cb) cb(null); return; }
  if (cb) ADMIN_WAIT.push(cb);
  if (ADMIN_LOADING) return;
  ADMIN_LOADING = true;
  api('POST', { action: 'adminView', deviceId: deviceId(), name: myName },
    function(err, data){
      ADMIN_LOADING = false;
      var msg = null;
      if (err || !data || data.error){
        msg = (data && data.error) ? data.error :
              '読み込めませんでした。電波の良いところで、もう一度押してください。';
      } else if (!admViewOk_(data)){
        /* ★★2026-09-29r　管理者の画面の返事ではなく、カレンダー全体の返事が届くことがある
           　（デプロイの直後に実測。名前・役割・端末がすべて空の一覧になっていた＝只隈さんのご指摘）。
           　★その返事は使わず、もう一度押していただく */
        msg = '読み込みがうまくいきませんでした。少し待って、もう一度押してください。';
      } else {
        ADMIN_DATA = data;
        ADMIN_STALE = false;
      }
      var ws = ADMIN_WAIT; ADMIN_WAIT = [];
      for (var wi = 0; wi < ws.length; wi++){
        try { ws[wi](msg); } catch (eW){}
      }
    });
}

/* ★force を true にすると、たたまずに必ず開き直します。
   　保存のあとや「やめる」から一覧へ戻るときに使います。
   　（★2026-09-08：これが無く、保存のあとに逆に閉じていました） */
function showAdminView(which, force){
  var pane = $('admPane_' + which);
  if (!pane) return;
  var wasOpen = !force && (ADMIN_PANE === which) && (pane.className.indexOf('on') >= 0);
  admPanesOff_();
  ADMIN_EDIT = null;
  if (wasOpen){ ADMIN_PANE = ''; return; }   /* ★もう一度押したら、たたみます */

  ADMIN_PANE = which;
  pane.className = 'admpane on';
  var grp = $('admGrp_' + which); if (grp) grp.className = 'admgrp on';
  var bt = $('admBtn_' + which); if (bt) bt.className = 'subbtn on';

  if (ADMIN_DATA && !ADMIN_STALE){ renderAdmin_(which); return; }
  var msgEl = $('adminMsg_' + which);
  msgEl.textContent = '読み込んでいます…';
  adminLoad_(function(msg){
    if (ADMIN_PANE !== which) return;        /* 別のボタンが押されたあとなら、何もしません */
    if (msg){ msgEl.textContent = msg; return; }
    renderAdmin_(which);
  });
}

function renderAdmin_(which){
  var h = '';
  if (which === 'roles'){ renderRoles_(); return; }
  if (which === 'works'){ renderWorks_(); return; }
  if (which === 'notices'){ renderNoticeLog_(); return; }
  if (which === 'stats'){ ADMIN_STATS = {}; renderStats_(); return; }   /* 開き直すたびに数え直す */
  if (which === 'logs'){
    var lg = (ADMIN_DATA && ADMIN_DATA.logs) || [];
    admMsg_().textContent = '新しい順に ' + lg.length + ' 件です。';
    for (var i = 0; i < lg.length; i++){
      h += '<div style="padding:8px 10px;border-bottom:1px solid #e3e8e3">' +
             '<div style="font-size:14px;color:#777">' + esc(lg[i].when) + '</div>' +
             '<div><b>' + esc(lg[i].who) + '</b>　' + esc(lg[i].what) + '</div>' +
             (lg[i].detail ? '<div style="font-size:15px;color:#444">' +
                             esc(lg[i].detail) + '</div>' : '') +
           '</div>';
    }
    if (!lg.length) h = '<p class="note">記録がありません。</p>';
  } else {
    var mb = (ADMIN_DATA && ADMIN_DATA.members) || [];
    var genki = 0;
    for (var m0 = 0; m0 < mb.length; m0++){ if (!mb[m0].left) genki++; }
    admMsg_().textContent = '在籍 ' + genki + '名（退会を含めて ' + mb.length + '行）です。';
    for (var k = 0; k < mb.length; k++){
      var m = mb[k];
      var tag = [];
      if (m.role) tag.push(m.role);
      if (m.contact) tag.push('連絡窓口');
      if (m.left) tag.push('退会');
      h += '<div style="padding:8px 10px;border-bottom:1px solid #e3e8e3' +
             (m.left ? ';opacity:.55' : '') + '">' +
             '<div><b>' + esc(m.name) + '</b>' +
               (m.yomi ? '<span style="font-size:14px;color:#777">（' + esc(m.yomi) + '）</span>' : '') +
               (tag.length ? '<span style="font-size:14px;color:' +
                             (CLUB.themeColor || '#2e6b34') + '">　' +
                             esc(tag.join('・')) + '</span>' : '') +
             '</div>' +
             '<div style="font-size:14px;color:#666">' +
               '端末 ' + (m.devices || 0) + '台' +
               (m.status ? '（' + esc(m.status) + '）' : '') +
               '　確認番号 ' + (m.hasCode ? 'あり' : 'まだ') +
               (m.line ? '　LINE ' + esc(m.line) : '') +
               (m.hasMail ? '　メールあり' : '') +
               (m.hasTel ? '　電話あり' : '') +
             '</div>' +
           '</div>';
    }
    if (!mb.length) h = '<p class="note">名簿が読めませんでした。</p>';
  }
  admList_().innerHTML = h + admCloseBtn_();
}

/* ==================================================================
   ★★2026-09-08（工事D）　役割・連絡窓口・予定の種類ごとの顔ぶれを、ここで変える

   　名簿を別のファイルへ分けると、管理者はもう名簿を開けません。
   　これまでシートでしていただいていた分を、ここへ移しました。
   ================================================================== */
var ADMIN_EDIT = null;      /* いま開いている編集の相手（名字 or 作業名） */

/* 在籍している方だけ（退会した方は出しません） */
function adminAlive_(){
  var out = [], mb = (ADMIN_DATA && ADMIN_DATA.members) || [];
  for (var i = 0; i < mb.length; i++){ if (!mb[i].left) out.push(mb[i]); }
  return out;
}
function adminFind_(name){
  var mb = (ADMIN_DATA && ADMIN_DATA.members) || [];
  for (var i = 0; i < mb.length; i++){ if (mb[i].name === name) return mb[i]; }
  return null;
}

/* --- 会員の設定を、1人ずつ変える（役割・連絡窓口・端末・確認番号・退会） ---
   ★2026-09-08（工事E-1）　ボタンを増やさず、この1枚にまとめました。
   　会員を選ぶ → その方についてできることが、上から順に1列に並びます。 */
function renderRoles_(){
  var mb = (ADMIN_DATA && ADMIN_DATA.members) || [];
  var live = [], gone = [];
  for (var i0 = 0; i0 < mb.length; i0++){ (mb[i0].left ? gone : live).push(mb[i0]); }
  admMsg_().textContent = '変えたい方の「変える」を押してください。';
  var h = '';
  for (var i = 0; i < live.length; i++) h += adminCard_(live[i]);
  if (gone.length){
    h += '<p class="note" style="margin:16px 0 0;padding:0 10px">' +
         '退会になっている方（' + gone.length + '名）</p>';
    for (var g = 0; g < gone.length; g++) h += adminCard_(gone[g]);
  }
  if (!mb.length) h = '<p class="note">名簿が読めませんでした。</p>';

  /* ★★2026-09-29q　車を出せる方（マイカー提供）を選ぶ（13_admin-edit.js） */
  h += admDriversHtml_();

  /* ★★2026-09-14（工事E-3）　新しい会員を足す。
     　★入れていただくのは名字とよみの2つだけ（只隈さんのご判断）。
     　電話・メール・役割は、足したあと、その方の「変える」から入れます。 */
  h += '<div class="admsec">' +
         '<div class="admsec-h">新しい会員を足す</div>' +
         '<input type="text" id="admNewName" maxlength="12" autocomplete="off"' +
           ' placeholder="名字（例）山本" value="' + esc(ADM_NEWNAME_) + '"' +
           ' oninput="ADM_NEWNAME_ = this.value">' +
         '<input type="text" id="admNewYomi" maxlength="20" autocomplete="off"' +
           ' style="margin-top:8px" placeholder="よみ（例）やまもと"' +
           ' value="' + esc(ADM_NEWYOMI_) + '"' +
           ' oninput="ADM_NEWYOMI_ = this.value">' +
         '<p class="note" style="margin-top:2px">' +
           '<b>よみ</b>を見て、一覧を50音順に並べます。カタカナで入れても大丈夫です。<br>' +
           '足したあと、その方の<b>「変える」</b>から、電話・メール・役割を入れてください。<br>' +
           'すでにいらっしゃる名字は足せません。同じ名字の方は' +
           '<b>山本(明)</b>のように、区別できる形でお入れください。</p>' +
         '<button type="button" class="bigbtn" style="margin-top:8px"' +
           ' onclick="adminAddMember(this)">この方を足す</button>' +
         admSecMsg_('memadd') +
       '</div>';

  admList_().innerHTML = h + admCloseBtn_();
}

/* ==================================================================
   ★★2026-09-14（工事E-5）　お知らせの記録（見るだけ）

   　只隈さんのご判断（2026-09-14）
   　　・掲載中／掲載が終わった／消した　の3つとも出す
   　　・消したものを「戻す」ボタンは付けない（見えるだけ）
   　　・★「まだ見ていない方」は、掲載中のものにだけ出す
   　　　（終わった分の既読は、工事E-6で自動で片づけるため）
   　　・新しい順に50件まで
   ================================================================== */
function renderNoticeLog_(){
  var ns = (ADMIN_DATA && ADMIN_DATA.notices) || [];
  var liveN = 0;
  for (var c = 0; c < ns.length; c++){ if (ns[c].state === 'live') liveN++; }
  admMsg_().textContent = ns.length
    ? '新しい順に ' + ns.length + ' 件です（いま出ているもの ' + liveN + ' 件）。'
    : 'お知らせの記録は、まだありません。';

  var h = '';
  for (var i = 0; i < ns.length; i++){
    var n = ns[i];
    var lbl = (n.state === 'deleted') ? '消したもの'
            : (n.state === 'ended')   ? '掲載おわり'
            :                           'いま出ています';
    var col = (n.state === 'live') ? (CLUB.themeColor || '#2e6b34') : '#8a8a8a';
    h += '<div style="padding:10px;border-bottom:1px solid #e3e8e3' +
           (n.state === 'live' ? '' : ';opacity:.62') + '">' +
           '<div style="font-size:14px;color:#777">' +
             esc(n.at) + '　' + esc(n.by) + 'さん' +
             '<b style="color:' + col + '">　' + lbl + '</b>' +
             (n.until ? '　<span style="white-space:nowrap">' +
                          esc(n.until) + 'まで</span>' : '') +
           '</div>' +
           '<div style="font-size:16px;margin-top:3px;white-space:pre-wrap;' +
             'word-break:break-all">' + esc(n.text) + '</div>';

    /* ★見た人数と、まだの方。掲載中のものにだけ付きます */
    if (n.state === 'live'){
      var yet = n.yet || [], tot = n.total || 0;
      h += '<div style="font-size:14px;color:#4a6a4a;margin-top:5px">' +
             (yet.length
               ? (tot - yet.length) + '／' + tot + '人が見ました' +
                 '<br><span style="color:#a35b00">まだの方：' +
                 esc(yet.join('・')) + '</span>'
               : '全員（' + tot + '人）が見ました') +
           '</div>';
    }
    h += '</div>';
  }
  admList_().innerHTML = h + admCloseBtn_();
}

function adminCard_(m){
  var tag = [];
  if (m.role) tag.push(m.role);
  if (m.contact) tag.push('連絡窓口');
  return '<div style="padding:10px;border-bottom:1px solid #e3e8e3' +
           (m.left ? ';opacity:.55' : '') + '">' +
           '<div><b>' + esc(m.name) + '</b>' +
             '<span style="font-size:15px;color:#666">　' +
             esc(m.left ? '退会' : (tag.length ? tag.join('・') : '（役割なし）')) +
             '</span></div>' +
           '<div style="font-size:14px;color:#888">端末 ' + (m.devices || 0) + '台' +
             '　確認番号 ' + (m.hasCode ? 'あり' : 'まだ') + '</div>' +
           '<button type="button" class="subbtn" style="margin-top:6px"' +
             ' onclick="adminEditMember(\'' + esc(m.name) + '\')">' +
             (m.left ? '退会を取り消す' : '変える') + '</button>' +
         '</div>';
}

function adminEditMember(name){
  var m = adminFind_(name);
  if (!m) return;
  ADMIN_EDIT = name;
  var r = m.role || '';

  /* ★★2026-09-14（工事E-2）　保守業者（DXベアーズ）の行。
     　クラブの側には、そもそもこの行が出ません。出るのは保守業者ご本人の画面だけです。
     　サーバーは前から断っていましたが、★画面は変えられるように見えていました。
     　「断られると分かっていることは、画面で先に止める」（07_つくるときの決まり 2章）。 */
  if (m.maintRow){
    admMsg_().textContent = name + 'さんは、保守業者の行です。';
    admList_().innerHTML =
      '<div style="padding:2px 0 4px">' +
        '<div style="font-size:19px;margin:4px 0 2px"><b>' + esc(name) + '</b> さん</div>' +
        '<div class="admsec">' +
          '<div class="admsec-h">保守業者の行</div>' +
          '<p class="note" style="margin-top:0">この行は、アプリからは変えられません。' +
            '名簿のファイルで直してください。</p>' +
        '</div>' +
        '<button type="button" class="cancelbtn" style="margin-top:14px"' +
          ' onclick="showAdminView(\'roles\', true)">やめる</button>' +
      '</div>';
    return;
  }
  /* ★2026-09-08（工事E-1h）　只隈さん「本人なのにこのメッセージですよ」。
     　ご自身は退会にできないと分かっているのに、「よろしいですか？」と聞いて、
     　OKのあと5秒待たせてから断っていました。★聞かずに、はじめから出しません。 */
  var isSelf = String(name).replace(/[\s　]/g, '') ===
               String(myName || '').replace(/[\s　]/g, '');
  /* ★2026-09-14（工事E-1M・案1）　只隈さんのご指摘：
     　「管理者が0人になります」と断られたあと、丸は「役割なし」に入ったまま残り、
     　★実際は管理者のままなのに、画面は変わったように見えていました。
     　E-1h と同じ考えで、★聞かずに、はじめから選べなくします。
     　（サーバー側の守りは残したままです。アプリだけで守りません） */
  var admN = 0, alive0 = adminAlive_();
  for (var a0 = 0; a0 < alive0.length; a0++){ if (alive0[a0].role === '管理者') admN++; }
  var lastAdmin = (m.role === '管理者') && admN <= 1;
  function radio(v, label){
    var off = lastAdmin && v !== '管理者';
    return '<label style="display:block;padding:8px 4px;font-size:17px' +
             (off ? ';color:#aaa' : '') + '">' +
             '<input type="radio" name="admRole" value="' + v + '"' +
             (r === v ? ' checked' : '') + (off ? ' disabled' : '') + '> ' + label + '</label>';
  }
  var h = '<div style="padding:2px 0 4px">' +
          '<div style="font-size:19px;margin:4px 0 2px"><b>' + esc(name) + '</b> さん</div>';

  if (m.left){
    /* --- 退会になっている方 --- */
    admMsg_().textContent = name + 'さんは、いま退会になっています。';
    h += '<div class="admsec">' +
           '<div class="admsec-h">退会</div>' +
           '<p class="note" style="margin-top:0">会員の一覧にも、出欠のお相手にも出てきません。' +
             '過去の記録は、お名前のまま残っています。</p>' +
           '<button type="button" class="bigbtn"' +
             ' onclick="adminMemberOp(\'rejoin\', this)">退会を取り消す</button>' +
           admSecMsg_('leave') +
         '</div>';
  } else {
    admMsg_().textContent = name + 'さんの設定を変えます。';

    /* ① 役割・連絡窓口 */
    h += '<div class="admsec">' +
           '<div class="admsec-h">役割と連絡窓口</div>' +
           radio('', '役割なし（ふつうの会員）') +
           radio('幹事', '幹事（予定を登録できます）') +
           radio('管理者', '管理者（この画面を使えます）') +
           (lastAdmin ?
             '<p class="note" style="margin:2px 0 0"><b>いまは、管理者のままにしておく必要があります。</b><br>' +
               (isSelf ? 'ご自身' : 'この方') + 'が、ただ一人の管理者です。役割を外すと、' +
               'どなたもこの画面を使えなくなります。<br>' +
               '変えるときは、先にほかの方を管理者にしてください。</p>' : '') +
           '<label style="display:block;padding:8px 4px;font-size:17px;margin-top:6px;' +
             'border-top:1px solid #e3e8e3">' +
             '<input type="checkbox" id="admContact"' + (m.contact ? ' checked' : '') + '>' +
             ' 連絡窓口にする（困ったときの宛先に出ます）</label>' +
           '<p class="note">「連絡窓口」は権限ではありません。役割がなくても決められます。</p>' +
           '<button type="button" class="bigbtn"' +
             ' onclick="adminSaveMember(this)">この内容で変える</button>' +
           admSecMsg_('role') +
         '</div>';

    /* ★★② 連絡先と備考（2026-09-14 工事E-2）
       　これまで名簿シートに直接入れていただいていた3つです。
       　★電話は、前から幹事・管理者には渡しています（サーバーの tels）。
       　★メールのアドレスと備考は、★管理者のこの画面にだけ出します。 */
    var C = (ADMIN_DATA && ADMIN_DATA.cols) || { tel: true, mail: true, memo: true };
    if (C.tel || C.mail || C.memo){
      h += '<div class="admsec">' +
             '<div class="admsec-h">連絡先と備考</div>';
      if (C.tel){
        h += '<label style="display:block;font-size:15px;color:#444;margin-top:6px">電話</label>' +
             '<input type="text" id="admTel" inputmode="tel" autocomplete="off"' +
               ' placeholder="例）09012345678" value="' + esc(m.tel || '') + '">' +
             '<p class="note" style="margin-top:2px">幹事・管理者だけに見えます。' +
               '「まだ読んでいない人」から、押すだけでおかけになれます。</p>';
      }
      if (C.mail){
        h += '<label style="display:block;font-size:15px;color:#444;margin-top:10px">メール</label>' +
             '<input type="text" id="admMail" inputmode="email" autocomplete="off"' +
               ' placeholder="例）taro@example.com" value="' + esc(m.mail || '') + '">' +
             '<p class="note" style="margin-top:2px">入れておくと、予定やお知らせが' +
               '自動で届きます。費用はかかりません。' +
               '<b>この画面以外には出ません。</b></p>';
      }
      if (C.memo){
        h += '<label style="display:block;font-size:15px;color:#444;margin-top:10px">備考</label>' +
             '<textarea id="admMemo" rows="2" placeholder="自由に書けます">' +
               esc(m.memo || '') + '</textarea>' +
             '<p class="note" style="margin-top:2px"><b>管理者だけが見られます。</b>' +
               'ご本人にも、ほかの会員にも出ません。</p>';
      }
      h += '<button type="button" class="bigbtn"' +
             ' onclick="adminSaveContact(this)">この内容で変える</button>' +
           admSecMsg_('contact') +
           '</div>';
    }

    /* ③ 端末（機種変更のとき） */
    h += '<div class="admsec">' +
           '<div class="admsec-h">端末　' + (m.devices || 0) + '台' +
             (m.status ? '<span style="font-weight:normal;font-size:14px;color:#666">　' +
                         esc(m.status) + '</span>' : '') + '</div>';
    /* ★★2026-09-21（工事G-2 決定1）　リセットのボタンは1つだけにしました。
       　端末・登録状況・登録日時・確認番号を、いっしょに空にします。 */
    if (m.devices || m.hasCode){
      h += '<p class="note" style="margin-top:0">機種を変えて新しい端末から入れないときや、' +
             '4けたの数字を忘れられたときに押します。<br>' +
             '<b>登録された端末と確認番号を、いっしょに空にします。</b>' +
             'そのあと、新しい端末でお名前を選び直していただきます。</p>' +
           '<button type="button" class="carebtn"' +
             ' onclick="adminMemberOp(\'resetDevice\', this)">この方を、はじめて使う状態に戻す</button>';
    } else {
      h += '<p class="note" style="margin-top:0">まだ、どの端末からもお使いになっていません。</p>';
    }
    h += admSecMsg_('device') + '</div>';

    /* ④ 確認番号（★2026-09-21 工事G-2 決定1　見るだけ。リセットは③にまとめました） */
    h += '<div class="admsec">' +
           '<div class="admsec-h">確認番号　' +
             (m.hasCode ? 'あり' : 'まだ決めていません') + '</div>';
    if (m.hasCode){
      h += '<p class="note" style="margin-top:0">2台目をお使いになるときの数字です。' +
             '忘れられたときは、上の<b>「この方を、はじめて使う状態に戻す」</b>を押してください。<br>' +
             '<b>番号そのものは、この画面には出ません。</b></p>';
    } else {
      h += '<p class="note" style="margin-top:0">2台目をお使いになる方だけが決める番号です。' +
             '決めていなくてかまいません。</p>';
    }
    h += admSecMsg_('code') + '</div>';

    /* ★★⑤ LINE通知（2026-09-14 工事E-2）★見るだけ
       　只隈さんのご指摘：この欄が付くのは、★ご本人が公式アカウントで
       　お名前を選んで登録されたときだけ。しかも別のLINEで登録し直されたときは、
       　★GASが前の行の印を自動で消します（lineSaveToRoster_）。
       　残るのは「LINEをおやめになった方」だけで、★それが起きるかは
       　他のクラブをやってみないと分かりません。
       　→ ★★「外す」ボタンは作りません（07_つくるときの決まり 2章）。 */
    h += '<div class="admsec">' +
           '<div class="admsec-h">LINE通知　' +
             (m.line ? esc(m.line) : 'まだ登録されていません') + '</div>' +
           '<p class="note" style="margin-top:0">' +
             (m.line
               ? 'ご本人が公式アカウントでお名前を選ばれたので、<b>自動で入りました。</b>'
               : 'まだ、公式アカウントでお名前を選ばれていません。') +
             '<br>この欄は<b>ご本人の登録でしか変わりません。</b>' +
             'こちらから登録したり、消したりすることはできません。</p>' +
         '</div>';

    /* ⑥ 退会（★ご自身にはボタンを出しません） */
    h += '<div class="admsec">' +
           '<div class="admsec-h">退会</div>';
    if (isSelf){
      h += '<p class="note" style="margin-top:0"><b>ご自身を退会にすることはできません。</b><br>' +
             '押し間違いで、どなたもこの画面を使えなくなるのを防ぐためです。<br>' +
             'ご自身の退会が必要なときは、先にほかの方を管理者にして、その方に操作していただきます。</p>';
    } else {
      h += '<p class="note" style="margin-top:0">退会にすると、会員の一覧にも、出欠のお相手にも' +
             '出なくなります。<b>その方は、いつもの端末からアプリを開けなくなります。</b><br>' +
             '過去の記録は残ります。<b>あとで取り消せます。</b></p>' +
           '<button type="button" class="carebtn"' +
             ' onclick="adminMemberOp(\'leave\', this)">この方を退会にする</button>';
    }
    h += admSecMsg_('leave') + '</div>';
  }

  h += '<button type="button" class="cancelbtn" style="margin-top:14px"' +
         ' onclick="showAdminView(\'roles\', true)">やめる</button></div>';
  admList_().innerHTML = h;
}


/* ==================================================================
   ★★2026-09-28（貢献度の集計）　📊 貢献度
   　決定：`★貢献度の集計_設計と決定_20260928.md`（Claude のプロジェクト文書）
   　・管理者だけ。サーバー（adminStats）が予定と出欠を全部読んで、数だけ返します
   　・数えるのは終わった予定だけ。削除・中止は数えません
   　・係は会員IDで数えます（名前が変わっても回数は消えません）
   ================================================================== */
var ADMIN_STATS = {};          /* 期間 → サーバーの返事（開いているあいだの控え） */
var STATS_FY = '';             /* 選んでいる期間（'' ＝今年度） */
var STATS_BY = 'lead';         /* 何で並べるか */

function statsLoad_(fy, cb){
  var key = String(fy || '');
  if (ADMIN_STATS[key]){ cb(null, ADMIN_STATS[key]); return; }
  api('POST', { action: 'adminStats', deviceId: deviceId(), name: myName, fy: key },
    function(err, data){
      if (err || !data || data.error || !data.stats){
        cb((data && data.error) ? data.error :
           '読み込めませんでした。電波の良いところで、もう一度押してください。');
        return;
      }
      ADMIN_STATS[key] = data.stats;
      if (!key) ADMIN_STATS[String(data.stats.fy)] = data.stats;
      cb(null, data.stats);
    });
}

function renderStats_(){
  var msgEl = $('adminMsg_stats');
  msgEl.textContent = '数えています…（予定と出欠を全部読むので、少しかかります）';
  statsLoad_(STATS_FY, function(msg, st){
    if (ADMIN_PANE !== 'stats') return;
    if (msg){ msgEl.textContent = msg; return; }
    drawStats_(st);
  });
}

function statsPick(kind, v){
  if (kind === 'fy') { STATS_FY = v; renderStats_(); }
  else { STATS_BY = v; var st = ADMIN_STATS[String(STATS_FY || '')]; if (st) drawStats_(st); }
}

function statsLeadLabel_(st){
  var l = (st && st.leads) || [];
  return l.length ? l.join('・') : 'リーダーなど';
}

function drawStats_(st){
  var col = CLUB.themeColor || '#2e6b34';
  var fyName = function(y){
    return (y === 'all') ? 'すべての年' :
           (y + '年度（' + y + '年' + st.fyStart + '月〜）');
  };
  $('adminMsg_stats').textContent = fyName(st.fy) + '　数えた予定 ' + st.events + '件（' +
    st.today.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1年$2月$3日') + 'より前・中止を除く）';

  var BY = [
    { k: 'lead',   t: '任される係' },
    { k: 'staff',  t: '係ぜんぶ' },
    { k: 'attend', t: '参加' },
    { k: 'owner',  t: '予定の登録' }
  ];

  var h = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px">';
  h += '<label style="flex:1 1 140px">期間<br><select onchange="statsPick(\'fy\', this.value)">';
  var ys = st.years || [];
  for (var i = 0; i < ys.length; i++){
    var sel = (String(st.fy) === String(ys[i])) ? ' selected' : '';
    h += '<option value="' + ys[i] + '"' + sel + '>' + esc(ys[i] + '年度' + (ys[i] === st.curFy ? '（今年度）' : '')) + '</option>';
  }
  h += '<option value="all"' + (st.fy === 'all' ? ' selected' : '') + '>すべての年</option></select></label>';
  h += '<label style="flex:2 1 200px">並べ方<br><select onchange="statsPick(\'by\', this.value)">';
  for (var b = 0; b < BY.length; b++){
    h += '<option value="' + BY[b].k + '"' + (STATS_BY === BY[b].k ? ' selected' : '') + '>' + esc(BY[b].t) + '</option>';
  }
  h += '</select></label></div>';

  var list = (st.members || []).slice();
  list.sort(function(p, q){
    if (q[STATS_BY] !== p[STATS_BY]) return q[STATS_BY] - p[STATS_BY];
    return (q.lead + q.staff + q.attend) - (p.lead + p.staff + p.attend);
  });
  var max = 0;
  for (var m = 0; m < list.length; m++) if (list[m][STATS_BY] > max) max = list[m][STATS_BY];

  /* 横棒のグラフ（外の部品は使いません） */
  h += '<div style="margin:4px 0 14px">';
  for (var j = 0; j < list.length; j++){
    var x = list[j], v = x[STATS_BY];
    var w = max ? Math.round(v / max * 100) : 0;
    var parts = [];
    for (var r = 0; r < (st.roles || []).length; r++){
      var rn = st.roles[r];
      if (x.roles && x.roles[rn]) parts.push(rn + ' ' + x.roles[rn]);
    }
    h += '<div style="padding:6px 0;border-bottom:1px solid #e3e8e3' + (x.retired ? ';opacity:.6' : '') + '">' +
           '<div style="display:flex;justify-content:space-between;gap:8px">' +
             '<b>' + esc(x.name) + (x.retired ? '<span style="font-size:13px;color:#777">（退会）</span>' : '') + '</b>' +
             '<b style="color:' + col + '">' + v + '回</b>' +
           '</div>' +
           '<div style="background:#eef2ee;border-radius:4px;height:12px;margin:3px 0">' +
             '<div style="background:' + col + ';width:' + w + '%;height:12px;border-radius:4px"></div>' +
           '</div>' +
           '<div style="font-size:13px;color:#666">' +
             '任される係 ' + x.lead + '・係 ' + x.staff + '・参加 ' + x.attend + '・登録 ' + x.owner +
             (parts.length ? '<br>（' + esc(parts.join('、')) + '）' : '') +
           '</div>' +
         '</div>';
  }
  if (!list.length) h += '<p class="note">数える予定がありません。</p>';
  h += '</div>';

  var un = st.unknown || [];
  if (un.length){
    h += '<p class="note"><b>名簿にない名前（' + un.length + '件）</b>：係の欄の名前が、名簿の名字と一字でも違うと数えられません。' +
         'その予定を開いて、係の名前を選び直すと、次から数えます。</p>';
    for (var u = 0; u < un.length; u++){
      h += '<div style="font-size:14px;padding:4px 0;border-bottom:1px dashed #ddd">' +
             esc(un[u].date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1/$2/$3')) + '　' + esc(un[u].title) +
             '　<b>' + esc(un[u].role + '：' + un[u].name) + '</b></div>';
    }
  }

  h += '<p class="note" style="margin-top:10px">★数え方：終わった予定だけ（今日より前）。中止・削除した予定は数えません。' +
       '「任される係」は ' + esc(statsLeadLabel_(st)) + ' です。' +
       '「参加」は、参加と答えた回数です（当日来られたかは分かりません）。' +
       '係は、予定に書いてあった係です。「登録」は、その予定をアプリで入れた方です。</p>';
  $('adminList_stats').innerHTML = h + admCloseBtn_();
}
