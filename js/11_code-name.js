/* ------------------------------------------------------------------
   ★2026-08-23　4けたの確認番号を決めていただくお誘い

   これまで専用URLで2台目が登録できていたため、確認番号を決める必要が無く、
   名簿の「確認番号」欄がほぼ全員空欄になっていた。その状態で端末が変わると、
   ご本人では戻せず、毎回クラブの管理者が名簿を触ることになる。
   そこで、ふだんの画面からも決められるようにした。

   ・この端末で自分の名前を登録している方にだけ出す
   ・「あとで」を押したら二度と出さない（この端末に記憶する）
   ・番号を決めたら、それ以降は出ない
   ------------------------------------------------------------------ */
/* ★★2026-09-21（工事G-2 (b) 追補）　「管理者なのに確認番号がまだ無い」かどうか。
   　サーバー（needCode）が教えてくれます。★値そのものは受け取りません。 */
var MUST_SET_CODE = false;
var CODE_ASKED_   = false;
/* ★★2026-09-21　「あとで」で、いまこの画面だけ下ろすための印。
   　★覚えません。次に開いたときは、また出ます。 */
var CODE_TIP_HIDDEN_ = false;

function renderCodeTip(){
  var el = $('codeTip');
  if (!el) return;
  /* ★管理者で番号がまだ無い方は、「あとで」で閉じても次に開いたときまた出します。
     　機種を変えたときにご自分で名乗り直せなくなるのは、この方だけだからです。 */
  var mine = !!myName && (lsGet(LSK.claimed) === myName);
  var show = MUST_SET_CODE
    ? (mine && !CODE_TIP_HIDDEN_)          /* ★「あとで」は今回だけ。次に開けばまた出る */
    : (mine && !lsGet(LSK.codeTip));       /* ★ふつうの会員は、閉じたら二度と出さない */
  el.style.display = show ? 'block' : 'none';

  var t = $('codeTipTitle'), b = $('codeTipBody'), l = $('codeTipLaterBtn');
  if (!t || !b || !l) return;
  if (MUST_SET_CODE){
    t.innerHTML = 'クラブの管理をされる方へ';
    b.innerHTML =
      '<b>4けたの数字</b>が、まだ決まっていません。<br>' +
      '決めておかないと、<b>機種を変えたときにご自分で名乗り直せません。</b><br>' +
      'そのときは、ほかの管理者の方に戻していただくことになります。<br>' +
      '1分で終わります。お誕生日の月日がおすすめです（4月12日なら 0412）。';
    l.innerHTML = 'あとで';
  } else {
    t.innerHTML = '機種変更やスマホの故障に備えて';
    b.innerHTML =
      '<b>4けたの数字</b>を決めておくと、新しいスマホやパソコンでも' +
      '<b>ご自分で名乗れます。</b><br>' +
      '決めていないと、そのときクラブの管理者にお願いすることになります。<br>' +
      '1分で終わります。お誕生日の月日がおすすめです（4月12日なら 0412）。';
    l.innerHTML = 'あとで（もう出しません）';
  }
}

/* ★★2026-09-21（工事G-2 (b) 追補）　名簿が届いたあとに1回だけ、サーバーへ聞きます。
   　★すでに名乗りずみの端末は claimName を送り直さないので、
   　　ここが無いと「あとから管理者にした方」に気づいていただく機会がありません。
   　★needCode は読むだけです（名簿を書き換えません）。 */
function askMustSetCode_(){
  if (CODE_ASKED_) return;
  if (!myName || !isAdmin_(myName)) return;
  if (lsGet(LSK.claimed) !== myName) return;
  CODE_ASKED_ = true;
  try {
    api('POST', { action: 'needCode', deviceId: deviceId(), name: myName },
      function(err, data){
        if (err || !data) return;
        MUST_SET_CODE = !!data.need;
        renderCodeTip();
      });
  } catch(e){}
}

function codeTipGo(){
  if (!MUST_SET_CODE) lsSet(LSK.codeTip, '1');
  CODE_TIP_HIDDEN_ = true;
  renderCodeTip();
  openCfg();
  askSetCode();
}

function codeTipLater(){
  /* ★管理者で4けたがまだ無いときは、覚えません（次に開けばまた出ます）。
     　ふつうの会員のときだけ、これまでどおり「もう出しません」にします。 */
  if (!MUST_SET_CODE) lsSet(LSK.codeTip, '1');
  CODE_TIP_HIDDEN_ = true;
  renderCodeTip();
}

/* ---------- 名前の表示 ---------- */
function updateWho(){
  /* 名前は表示するだけ。押しても何も起きない。
     名前の変更は、画面いちばん下の「⚙ 設定」から行う
     （うっかり押して名乗りが外れないようにするため） */
  $('whoami').innerHTML = myName ? esc(myName) + ' さん' : '';
  var cw = $('cfgWho');
  if (cw) cw.innerHTML = myName
    ? 'いまは「' + esc(myName) + '」さんとして開いています。'
    : 'まだお名前が選ばれていません。';
}

