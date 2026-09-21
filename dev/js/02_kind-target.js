/* ==================================================================
   ★2026-09-02　予定の「種類」と「対象」（作業マスタ方式）

   　杉野さんの表に足していただくのは「種類」1列だけ。
   　プルダウンには 山行／集会・行事／打合せ／下見 と、
   　作業マスタの作業名（あしあと印刷 など）がそのまま並ぶ。
   　★誰に届くかは、送るたびに作業マスタを引いて決める（遅延解決）。
   ================================================================== */
/* ★★2026-09-03　只隈さんのご指摘で「打合せ」を外しました。
   　　名簿の「役割」＝管理者・幹事は、★このアプリの管理者と幹事★であって、
   　　OHCの役員のことではありません。実物の本番名簿でも、役割が入っているのは
   　　杉野さん（管理者）と若杉さん（幹事）の2名だけでした。
   　　役員会をこれで絞ると、その2名にしか届きません。
   　　→ 役員会のような「毎回同じ顔ぶれ」は★作業マスタ★で決めてください。
   　　　 下見のような「毎回変わる顔ぶれ」は★係・担当の欄★で決まります。 */
var KIND_TARGET = {
  '山行': '', '集会・行事': '', '集会': '', '行事': '', '木曜会': '',
  '下見': '係のみ'
};

/* 種類 → 対象。読めない種類は undefined を返す（行番号つきで知らせるため） */
function kindToTarget_(kind){
  var k0 = String(kind == null ? '' : kind).replace(/[\s　]/g, '');
  if (!k0) return '';
  if (KIND_TARGET.hasOwnProperty(k0)) return KIND_TARGET[k0];
  if (WORKS.hasOwnProperty(k0)) return '作業:' + k0;
  return undefined;
}

/* 対象 → 種類（エクスポートで書き戻すときに使う） */
function targetToKind_(t){
  var s0 = String(t || '');
  var m0 = s0.match(/^作業[:：](.+)$/);
  if (m0) return m0[1];
  /* ★2026-09-03　'幹事・管理者' に当たる種類名はもう無いので、空欄で出す。
     　空欄は貼り戻しても対象を書き替えないので、いまの対象がそのまま残る。 */
  if (s0 === '幹事・管理者') return '';
  if (s0 === '係のみ') return '下見';
  /* ★修正4　空（全員）は、山行・集会・行事・木曜会を兼ねている。
     　「山行」と書いて戻すと、木曜会が山行に化ける。空欄で出す。 */
  return '';
}

function workNames_(){
  var o0 = [];
  for (var k1 in WORKS){ if (WORKS.hasOwnProperty(k1)) o0.push(k1); }
  return o0;
}
function workMembers_(name){
  var k2 = String(name || '').replace(/[\s　]/g, '');
  return (WORKS[k2] || []).slice();
}
function kindChoices_(){
  return ['山行', '集会・行事', '下見'].concat(workNames_());
}

/* 個別追加の「対象」プルダウンに、作業マスタぶんを足す。
   ★決まった選択肢は消さず、作業ぶんだけ入れ替える。 */
function fillTargetSelect_(){
  var sel = document.getElementById('addTarget');
  if (!sel) return;
  var cur = sel.value;
  for (var q0 = sel.options.length - 1; q0 >= 0; q0--){
    if (String(sel.options[q0].value).indexOf('作業:') === 0) sel.remove(q0);
  }
  var ws = workNames_();
  for (var q1 = 0; q1 < ws.length; q1++){
    var op = document.createElement('option');
    op.value = '作業:' + ws[q1];
    op.text  = ws[q1] + '（この作業の方だけ）';
    sel.appendChild(op);
  }
  if (cur){ try { sel.value = cur; } catch (e) {} }
  /* ★2026-09-03　種類を変えたら、届く相手を出し直す */
  if (!sel.getAttribute('data-whobound')){
    sel.setAttribute('data-whobound', '1');
    sel.onchange = function(){ try { refreshAddTargetWho(); } catch(e){} };
  }
  try { refreshAddTargetWho(); } catch(e){}
}

/* ★2026-08-25　対象（空＝全員／幹事・管理者／係のみ）から、対象の方の名前を出す。
   　予定を登録する前にも使うので、予定そのものが無くても計算できるようにしてある。 */
function targetNamesFor_(target, staffStr, owner){
  var all = realMembers_();
  var t = String(target || '');
  if (!t) return all;
  /* ★2026-09-02　作業マスタ（送るたびに引く）。
     　マスタが空のときは「係のみ」に落とす。黙って本人ひとりに送らないため。 */
  var mw = t.match(/^作業[:：](.+)$/);
  if (mw){
    var wl = workMembers_(mw[1]);
    /* ★修正3　マスタが空のときだけでなく、マスタの名字が名簿と
       　1文字でも違って、誰にも当たらないときも「係のみ」に落とす。
       　黙って登録した本人ひとりに送る事故を防ぐため。 */
    var rw = [], hit0 = 0;
    for (var w0 = 0; w0 < all.length; w0++){
      var inw0 = (wl.indexOf(all[w0]) >= 0);
      if (inw0) hit0++;
      if (inw0 || all[w0] === owner) rw.push(all[w0]);
    }
    if (hit0) return rw;
    t = '係のみ';
  }
  var out = [];
  for (var i = 0; i < all.length; i++){
    if (t === '幹事・管理者'){
      if (isStaff(all[i]) || all[i] === owner) out.push(all[i]);
    } else {
      if (String(staffStr || '').indexOf(all[i]) >= 0 || all[i] === owner) out.push(all[i]);
    }
  }
  return out;
}

function realMembers_(){
  var out = [];
  for (var i = 0; i < MEMBERS.length; i++){
    if (isRealMember_(MEMBERS[i])) out.push(MEMBERS[i]);
  }
  return out;
}

var WEEK = ['日','月','火','水','木','金','土'];
var myName = '';
var editingId = '';
var gotoId = '';
var gotoStick = '';   /* 画面を作り直したあと、合わせ直す先 */
function getName(){ return myName; }
var state = {
  events: [],
  attendance: [],
  notices: [],   /* クラブからのお知らせ */
  year: 0,
  month: 0   /* 1〜12 */
};

