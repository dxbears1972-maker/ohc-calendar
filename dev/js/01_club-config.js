/* ==================================================================
   ★★★ クラブごとの設定は、この CLUB の中だけを直してください ★★★
   ここから下（「ここから下は共通」の行より下）は、
   どのクラブでも 1 文字も変えません。
   ------------------------------------------------------------------
   ★2026-09-04（工事B B-2）　ここに書くのは、もう2つだけです。

   　　id     … どのクラブとして開くか。ふだんは URL の ?club=xxx で決まります
   　　apiUrl … GAS のウェブアプリURL。★全クラブ共通の1本です

   　クラブの名前・見た目・呼び名・マイカー精算のURLは、
   　**サーバー（スプレッドシートの「設定」シート）から受け取ります。**
   　→ 新しいクラブを増やすのに、このファイルを直す必要はありません。
   　手順は internal.py の「新規クラブ導入チェックリスト」を見てください。
   ================================================================== */

/* ------------------------------------------------------------------
   ★2026-09-04　どのクラブとして開くかを、いちばん最初に決めます。

     1. URL の ?club=xxx
     2. 前にこの端末で開いたクラブ（下の控え）
     3. どちらも無ければ 'ohc'

   ★通すのは半角小文字英数字2〜10文字だけ（サーバー側とまったく同じ決まり）。
   ★2回目からは、URLに ?club= が付いていなくても控えで分かります。
   　ホーム画面のアイコンから開いたときも、これで正しいクラブになります。
   ------------------------------------------------------------------ */
var CLUB_LAST_KEY = 'clubId';   /* ★この控えだけは、クラブIDを付けません */

function pickClubId_(){
  var raw = '';
  try {
    var m = String(window.location.search || '').match(/[?&]club=([^&]+)/);
    if (m){ try { raw = decodeURIComponent(m[1]); } catch(e0){ raw = m[1]; } }
  } catch(e){}
  raw = String(raw || '').toLowerCase();

  /* ★URLに ?club= が付いていたら、それが正しくなくても、そのまま使います。
     　黙って 'ohc' に落とすと、打ち間違えた方に OHC の予定が見えてしまうためです。
     　正しくないクラブIDは、サーバーが入口で断ります。 */
  if (raw){
    if (/^[a-z0-9]{2,10}$/.test(raw)){
      try { localStorage.setItem(CLUB_LAST_KEY, raw); } catch(e3){}
    }
    return raw;
  }

  /* ?club= が付いていないとき。前にこの端末で開いたクラブを使います */
  var s = '';
  try { s = String(localStorage.getItem(CLUB_LAST_KEY) || '').toLowerCase(); } catch(e2){}
  if (!/^[a-z0-9]{2,10}$/.test(s)) s = 'ohc';
  return s;
}

var CLUB = {

  /* クラブを見分けるID（半角小文字英数字2〜10文字） */
  id: pickClubId_(),

  /* ------------------------------------------------------------------
     ここから下は、サーバーの「設定」シートから受け取ります。
     書いてあるのは「まだ受け取れていないとき（初回・圏外）」の予備です。
     ★クラブごとに直す必要はありません。
     ------------------------------------------------------------------ */

  /* 画面の上と、ブラウザのタブに出る名前 */
  appTitle: 'カレンダー',

  /* ホーム画面のアイコンの下に出る名前（短く。全角6文字くらいまで） */
  homeTitle: '予定',

  /* LINEで送る文章の先頭に付く見出し（【　】の中身） */
  shareTag: '予定',

  /* 画面の色（ヘッダーの緑） */
  themeColor: '#2e6b34',

  /* 「分からないときは○○に連絡してください」の○○ */
  contactLabel: '幹事さん',

  /* GAS のウェブアプリURL（https://script.google.com/macros/s/…/exec） */
  apiUrl: 'https://script.google.com/macros/s/AKfycbz6Tc9Tbfq5Eagp3MG0hYR8aA2AqQu8CkNR_g0950Qm_is2q6x5HZlLxWoVSsaQ6oeF/exec',   /* ★開発版 */

  /* マイカー精算アプリのURL（★サーバーの「設定」シートから受け取ります） */
  carpoolUrl: '',

  /* ★★2026-09-21（係の名前をクラブごとに）
     　係の名前と、予定を任される係。★サーバーの「設定」シートから受け取ります。
     ★ここにOHCの名前を予備として書きません。他クラブの画面にOHCの言葉が
     　一瞬でも出ないようにするためです（見た目の予備と同じ考え方）。 */
  staffRoles: [],
  staffLeads: [],

  /* ★2026-08-23：専用URL（?key=…／?name=…）で名乗れるようにするか。
     　false ＝ 使わない。どのクラブでも
     　　　　　 1台目＝お名前を選ぶだけ／2台目＝お名前＋4けたの確認番号、に統一する。
     　true  ＝ これまでどおり専用URLでも名乗れる（OHCの古いやり方）。

     ▼なぜ false にしたか（2026-08-23に操作ログで確認）
     　専用URLで開くと viaKey を付けて端末を登録しに行くため、
     　サーバー側の「確認番号が未設定の人は別の端末から名乗れない」という
     　チェックを丸ごと飛ばしていた。実際、8/22に竹田さんが一度拒否されたあと
     　15分後に「はじめての端末」として3台目が登録されている。
     　その結果、2台以上お使いの方（上口・竹田・松田・宮本）の確認番号が
     　全員空欄のままになり、忘れたときの救済ができない状態だった。

     ★★2026-09-21（工事G-1）　サーバー側の抜け道（viaKey）を消しました。
     　これで ?key= で開いても、確認番号の確認を飛ばすことはできません。
     ▼戻したいときは、この1行を true にするだけ。 */
  useKeyUrl: false,

  /* 管理者の名前（★名簿シートが正。ここは名簿が読めないときの予備で、ふだんは空） */
  adminName: '',

  /* 幹事の名前（どの予定でも編集・削除・締切ができ、Excelまとめて登録も使える）
     杉野さん・大原さんは、自分が登録した予定／自分がリーダーの予定だけ編集できる
     扱いに変更したため、ここには入れていません（2026-07-20〜）。
     例： editors: ['杉野', '大原'],
     ※GASコード側の EDITORS にも同じ名前を入れること */
  editors: [],

  /* メンバー一覧（増減したらここを直してGitHubに上げ直す）
     ※50音順に並べておくこと。出欠の名前がこの順で表示される
     ※将来はスプレッドシート管理に移す予定 */
  members: [],   /* ★載せません。名簿はサーバー（data.members）から来ます */

  /* 個人コード → 名前（★開発版では載せない。個人コードは既に無効） */
  keys: {}
};

/* ============ ここから下は共通。クラブごとに変えないこと ============ */

/* ------------------------------------------------------------------
   このアプリ（index.html）の版。
   直したら、ここの1行だけ書き換えてください（画面いちばん下に出ます）。
   付け方：日付 ＋ その日の何回目か（a, b, c …）
   ------------------------------------------------------------------ */
var APP_VER = '2026-09-22a';

/* 設定した文言を画面に反映する（起動時に1回だけ呼ぶ） */
function applyClubConfig(){
  try {
    document.title = CLUB.appTitle;
    var v0 = $('verLine');
    if (v0) v0.innerHTML = '版 ' + esc(APP_VER);
    var h = $('appTitle');
    if (h) h.innerHTML = esc(CLUB.appTitle);
    var lw = $('lineWarnMsg');
    if (lw) lw.innerHTML = esc(CLUB.appTitle) +
      'は、ChromeやSafariなどの<b>ブラウザ</b>で開くと使えます。';
    var nc = $('nameCardNote');
    if (nc) nc.innerHTML = '一度選ぶと、この端末はずっとその方のものになります。' +
      '予定を見るだけなら選ばなくてもできます。';
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', CLUB.themeColor);
    var at = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (at) at.setAttribute('content', CLUB.homeTitle);
    /* ★★2026-09-21　係の名前があとから届いたとき、
       　「予定を追加」を開いたままなら、選び箱を作り直します。 */
    try {
      var ac = $('addCard');
      if (ac && ac.style.display === 'block') renderStaffRows();
    } catch(e1){}
  } catch(e){}
}

/* ------------------------------------------------------------------
   ★2026-09-04（工事B B-2）　サーバーから届いたクラブの見た目・呼び名を当てる。

   ★起動の一瞬だけ題名が空になるのを防ぐため、受け取った内容は端末に控え、
   　次に開いたときは、サーバーの返事を待たずに先に当てます。
   　（初回だけは電波が要ります。工事Aで受け入れ済みの前提と同じです）
   ------------------------------------------------------------------ */
/* ★管理者・幹事はここに入れません。名簿シートが正で、
   　data.admins / data.editors として別に届きます（2-5の訂正）。 */
var CLUB_CFG_KEYS = ['appTitle','homeTitle','shareTag','themeColor',
                     'contactLabel','carpoolUrl',
                     'staffRoles','staffLeads'];   /* ★2026-09-21 */

function setClubCfg_(c, save){
  if (!c) return;
  var changed = false;
  for (var i = 0; i < CLUB_CFG_KEYS.length; i++){
    var k = CLUB_CFG_KEYS[i];
    if (c[k] === undefined || c[k] === null || c[k] === '') continue;
    /* 中身が同じなら何もしない。毎回 applyClubConfig を呼ぶと、
       画面いちばん下の「（サーバー …）」が消えてしまうため。 */
    var a = '', b = '';
    try { a = JSON.stringify(CLUB[k]); b = JSON.stringify(c[k]); } catch(e){}
    if (a === b) continue;
    CLUB[k] = c[k];
    changed = true;
  }
  if (save){
    try { lsSet(LSK.club, JSON.stringify(c)); } catch(e2){}
  }
  if (changed) applyClubConfig();
}

/* 端末の控えから先に当てる（起動時に1回だけ） */
function loadClubCfg_(){
  try {
    var c = JSON.parse(lsGet(LSK.club) || 'null');
    if (c) setClubCfg_(c, false);
  } catch(e){}
}

/* ------------------------------------------------------------------
   端末に覚えさせておく項目の名前。
   クラブごとに分けておかないと、1台の端末で2つのクラブを開いたときに
   名前や予定が混ざってしまうため、うしろにクラブIDを付ける。
   ------------------------------------------------------------------ */
var LSK = {
  name:      'name_'      + CLUB.id,   /* 自分の名前 */
  cache:     'cache_'     + CLUB.id,   /* 予定の控え（圏外でも見えるように） */
  proxyList: 'proxyList_' + CLUB.id,   /* 代理回答でよく選ぶ人 */
  gcalPref:  'gcalPref_'  + CLUB.id,   /* Googleカレンダーに追加するか */
  gotoId:    'gotoId_'    + CLUB.id,   /* 精算アプリから戻ってきたときの行き先 */
  pickDir:   'pickDir_'   + CLUB.id,   /* ファイル参照で最後に開いたフォルダ */
  device:    'device_'    + CLUB.id,   /* この端末を見分けるための記号 */
  claimed:   'claimed_'   + CLUB.id,   /* この端末で登録済みの名前 */
  mid:       'mid_'       + CLUB.id,   /* この端末の持ち主の会員ID（名字が変わっても追える） */
  instHide:  'instHide_'  + CLUB.id,   /* ホーム画面の案内を閉じたか */
  codeTip:   'codeTip_'   + CLUB.id,   /* 4けたのお誘いを閉じたか（2026-08-23） */
  club:      'club_'      + CLUB.id    /* ★2026-09-04 クラブの見た目・呼び名の控え */
};

/* この端末を見分けるための記号を作る（初回だけ）。
   個人を特定するものではなく、「同じスマホかどうか」が分かればよい。 */
/* この端末が何かを、日本語で返す（名簿に読める形で残すため） */
function deviceName(){
  var ua = navigator.userAgent || '';
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return 'パソコン';
}

/* ------------------------------------------------------------------
   退会した方の、いつもの端末を開いたときのブロック画面。
   サーバーが data.retired を返したときだけ出す（load() から呼ぶ）。
   すでに手元にある前回の内容（画面の下）はそのままにして、
   その上にこの画面をかぶせる＝退会する直前に見えていた内容が透けて
   見えることはない（fixed + z-index で完全に覆う）。
   ------------------------------------------------------------------ */
function showRetiredBlock(){
  var b = $('retiredBlock');
  if (b) b.style.display = 'block';
}
function hideRetiredBlock(){
  var b = $('retiredBlock');
  if (b && b.style.display !== 'none') b.style.display = 'none';
}

function deviceId(){
  var d = lsGet(LSK.device);
  if (!d){
    d = 'd' + new Date().getTime().toString(36) +
        Math.random().toString(36).substring(2, 8);
    lsSet(LSK.device, d);
  }
  return d;
}

/* 旧バージョン（ohcName など共通の名前だったころ）の内容を引き継ぐ。
   起動時に1回だけ実行する。
   ※旧の項目はわざと消していません。もし前の版に戻しても、
   　これまでどおり動くようにしておくためです。 */
function migrateOldKeys(){
  var pairs = [
    ['ohcName',      LSK.name],
    ['ohcCache',     LSK.cache],
    ['ohcProxyList', LSK.proxyList],
    ['ohcGcalPref',  LSK.gcalPref],
    ['ohcGotoId',    LSK.gotoId],
    ['ohcPickDir',   LSK.pickDir]
  ];
  for (var i = 0; i < pairs.length; i++){
    var oldKey = pairs[i][0], newKey = pairs[i][1];
    var v = lsGet(oldKey);
    if (v && !lsGet(newKey)) lsSet(newKey, v);
  }
}

var API_URL = CLUB.apiUrl;

/* ------------------------------------------------------------------
   名簿・管理者・幹事は、スプレッドシートの「名簿」シートで管理します。
   起動時にサーバーから受け取って、下の3つを入れ替えます。

   下の値は「まだ受け取れていないとき」の予備です。
   会員が増減しても、ここを直す必要はありません。
   幹事さんが名簿シートに1行足すだけで反映されます。
   ------------------------------------------------------------------ */
var ADMINS     = CLUB.adminName ? [CLUB.adminName] : [];
var ADMIN_NAME = CLUB.adminName;
var EDITORS    = CLUB.editors;
var MEMBERS    = CLUB.members;
var WORKS      = {};   /* ★2026-09-02 作業マスタ（作業名 → メンバー）。サーバーから来る */
/* ★2026-08-25　名字 → LINEのお知らせに登録済みか（true/false）。
   　サーバー（GAS）が幹事・管理者にだけ返します。ふつうの会員では空のまま。
   　空のときは「分からない」あつかいにして、警告を出しません。 */
var MEMBER_LINE = {};
var MEMBER_LINE_KNOWN = false;
/* ★修正8（2026-09-02　只隈さん）　名簿にメールアドレスがある方かどうか。
   　メールも、登録していない方には届かない。 */
var MEMBER_MAIL = {};
var MEMBER_MAIL_KNOWN = false;
var KEYS       = CLUB.keys;

/* 名字 → ひらがなの読み（名前選択の「あ行・か行…」に使う）
   サーバーから名簿を受け取ったときに入れ替わります */
var MEMBER_YOMI = {};

/* ------------------------------------------------------------------
   名字 → 会員ID の対応表。
   出欠は「名前」ではなく「会員ID」で記録しています。
   ・同じ名字の方が、あとから増えても混ざりません
   ・名簿の名字を直しても、過去の記録はその方についてきます
   ------------------------------------------------------------------ */
var MEMBER_ID = {};
var ID_NAME   = {};
/* 名字 → 電話番号。サーバーは幹事・管理者にしか送ってきません */
var MEMBER_TEL = {};
/* 電話をかけるリンク（数字だけにする。かけられないときは空） */
function telLink(name){
  var t = String(MEMBER_TEL[name] || '').replace(/[^0-9+]/g, '');
  return t.length >= 10 ? t : '';
}
function idOf(name){ return MEMBER_ID[name] || ''; }
/* その予定を登録したのは、この人か？
   会員IDが分かるときはIDで比べる（同じ名字の人がいても取り違えないため） */
function isOwnerOf(ev, name){
  if (!ev || !ev.owner) return false;
  if (ev.ownerId && idOf(name)) return ev.ownerId === idOf(name);
  return name === ev.owner;
}
function nameOfId(id){ return ID_NAME[id] || ''; }

/* すでにどれかの端末で使い始めている人（名前選択の一覧に出しません） */
var TAKEN = [];

/* 会員向けの案内に出す連絡窓口（名簿の「連絡窓口」に印がある方） */
var CONTACTS = [];

function isAdmin_(name){
  return !!name && ADMINS.indexOf(name) >= 0;
}

function isStaff(name){
  return !!name && (ADMINS.indexOf(name) >= 0 || EDITORS.indexOf(name) >= 0);
}

/* 「分からないときは○○にご連絡ください」の○○。
   ①名簿の「連絡窓口」に印がある方 → ②幹事 → ③管理者 の順に探す。
   （設定の CLUB.contactLabel は、名簿がまだ読めていないときの予備） */
function contactName(){
  var list = CONTACTS.length ? CONTACTS
           : (EDITORS.length ? EDITORS : (ADMINS.length ? ADMINS : []));
  if (!list.length) return CLUB.contactLabel;
  var s = [];
  for (var i = 0; i < list.length && i < 3; i++) s.push(list[i] + 'さん');
  return s.join('・');
}

/* 出欠の名前をメンバー一覧の順（＝50音順）に並べる */
function byMember_(a, b){
  var ia = MEMBERS.indexOf(a), ib = MEMBERS.indexOf(b);
  if (ia < 0) ia = 999;
  if (ib < 0) ib = 999;
  if (ia !== ib) return ia - ib;
  return a < b ? -1 : (a > b ? 1 : 0);
}

/* ★2026-09-04　マイカー精算アプリのURLは CLUB.carpoolUrl を直に見ます。
   　サーバーから届いたあとに差し替わるため、ここで控えを作りません。 */

/* 表題行の右端に置くアイコン（どの端末でも同じに出るようSVGで埋め込む・全て26px）
   ・CAR_ICON   ：マイカー精算（緑の車）
   ・SETTLE_ICON：精算結果（¥の丸。精算結果がある予定だけ車の隣に出る）
   ・GCAL_ICON  ：Googleカレンダーに追加（青いカレンダーに「31」） */
var CAR_ICON = '<svg width="44" height="44" viewBox="0 0 48 48">' +
  '<path fill="#2e6b34" d="M10 22l4-9c.6-1.4 2-2.3 3.5-2.3h13c1.5 0 2.9.9 3.5 2.3l4 9v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1H16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V22z"/>' +
  '<path fill="#fff" d="M15 20l2.4-6h13.2l2.4 6z"/>' +
  '<circle cx="16.5" cy="26.5" r="2.2" fill="#fff"/>' +
  '<circle cx="31.5" cy="26.5" r="2.2" fill="#fff"/>' +
  '</svg>';
var SETTLE_ICON = '<svg width="44" height="44" viewBox="0 0 48 48">' +
  '<circle cx="24" cy="24" r="19" fill="#e8a000"/>' +
  '<text x="24" y="31" font-size="22" font-weight="bold" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">&#165;</text>' +
  '</svg>';
var GCAL_ICON = '<svg width="44" height="44" viewBox="0 0 48 48">' +
  '<rect x="5" y="9" width="38" height="34" rx="5" fill="#1a73e8"/>' +
  '<rect x="9" y="17" width="30" height="22" rx="2" fill="#fff"/>' +
  '<rect x="13" y="4" width="5" height="9" rx="2.5" fill="#1a73e8"/>' +
  '<rect x="30" y="4" width="5" height="9" rx="2.5" fill="#1a73e8"/>' +
  '<text x="24" y="34" font-size="16" font-weight="bold" fill="#1a73e8" text-anchor="middle" font-family="Arial,sans-serif">31</text>' +
  '</svg>';
var LINE_ICON = '<svg width="44" height="44" viewBox="0 0 48 48">' +
  '<rect x="3" y="3" width="42" height="42" rx="10" fill="#06C755"/>' +
  '<ellipse cx="24" cy="22" rx="15" ry="11" fill="#fff"/>' +
  '<path fill="#fff" d="M16 31l-2.5 6.5L23 33z"/>' +
  '<text x="24" y="26" font-size="10" font-weight="bold" fill="#06C755" text-anchor="middle" font-family="Arial,sans-serif">LINE</text>' +
  '</svg>';

/* LINEで送る用の文章を作って、共有画面を開くURLを返す */
function lineShareUrl(ev){
  var p = ev.date.split('-');
  var dow = WEEK[new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10)).getDay()];
  var t = '【' + CLUB.shareTag + '】' + parseInt(p[1],10) + '月' + parseInt(p[2],10) + '日(' + dow + ') ' + (ev.title || '') + '\n';
  if (ev.time)  t += '時間：' + ev.time + '\n';
  if (ev.place) t += '場所：' + ev.place + '\n';
  if (ev.staff) t += '係：' + sortStaffStr(ev.staff) + '\n';
  if (ev.memo)  t += 'メモ：' + ev.memo + '\n';
  t += '出欠の回答は、' + CLUB.appTitle + '（ホーム画面のアイコン）から！';
  return 'https://line.me/R/share?text=' + encodeURIComponent(t);
}

/* ------------------------------------------------------------------
   「実在のハイキング会員ではない」特別な名前（動作確認・管理用の行）。
   名乗り・権限（管理者など）の判定はいままでどおり働くが、
   「代理で回答する人」「係の名前」「電話帳」「お知らせを見た人数」など、
   “実際に山行へ参加する人”を数える一覧にだけは出さない。（2026-08-17〜）
   半角・全角どちらの丸カッコで入力されても弾けるよう、両方入れてある。 */
var NON_MEMBER_NAMES = ['DXベアーズ(保守)', 'DXベアーズ（保守）'];
function isRealMember_(name){
  return !!name && NON_MEMBER_NAMES.indexOf(name) < 0;
}
/* ★2026-08-25　この方々のうち、LINEのお知らせに登録していない方を返す。
   　分からないとき（サーバーが古い／幹事・管理者でない）は null を返し、
   　呼び出し側は警告を出さない。「たぶん届かない」と書いて外すのが一番わるいため。 */
function lineMissing_(names){
  if (!MEMBER_LINE_KNOWN) return null;
  var out = [];
  for (var i = 0; i < names.length; i++){
    if (!MEMBER_LINE[names[i]]) out.push(names[i]);
  }
  return out;
}

/* ★修正8（2026-09-02）　この方々のうち、名簿にメールアドレスが無い方を返す。
   　分からないときは null（呼び出し側は警告を出さない）。lineMissing_ と同じ作り。 */
function mailMissing_(names){
  if (!MEMBER_MAIL_KNOWN) return null;
  var out = [];
  for (var i = 0; i < names.length; i++){
    if (!MEMBER_MAIL[names[i]]) out.push(names[i]);
  }
  return out;
}

/* ★修正8　LINEもメールも無い方＝どの手段でも届かない方 */
function unreachable_(names){
  var a = lineMissing_(names), b = mailMissing_(names);
  if (!a || !b) return null;
  var out = [];
  for (var i = 0; i < a.length; i++){ if (b.indexOf(a[i]) >= 0) out.push(a[i]); }
  return out;
}

