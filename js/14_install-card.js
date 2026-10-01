/* ==================================================================
   ホーム画面に置くご案内
   ------------------------------------------------------------------
   手順書を読んでもらうのではなく、その端末に合った案内だけを出す。
   ・すでにホーム画面から開いている人には出さない
   ・Androidは「追加」ボタン1つで終わる（ブラウザの仕組みを使う）
   ・iPhoneは操作の順番を文字で出す（自動では追加できないため）
   ・「あとで」で閉じられる。閉じたら二度と出さない
   ・そもそも追加しなくても使えます。無理に勧めない
   ================================================================== */

var deferredPrompt = null;   /* Androidの「追加」を保留しておく入れ物 */

function isStandalone(){
  try {
    if (window.navigator && window.navigator.standalone) return true;        /* iPhone */
    if (window.matchMedia &&
        window.matchMedia('(display-mode: standalone)').matches) return true; /* Android他 */
  } catch(e){}
  return false;
}
function isIOSDevice(){
  var ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) ||
         (/Macintosh/.test(ua) && 'ontouchend' in document);
}
function isLineBrowser(){
  return (navigator.userAgent || '').indexOf('Line') >= 0;
}

/* ------------------------------------------------------------------
   サービスワーカーを登録します。（2026-08-04）
   これが無いと、EdgeもChromeも「アプリとして入れられる」と判定せず、
   1押しで入るボタンが出ませんでした。
   中身は何も保存しない作りなので、版ずれは起きません。
   ------------------------------------------------------------------ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function(){
    /* ★2026-09-23（【A】）新クラブ用 club-calendar では登録します。
       　開発版は解除する作りのまま（検証が混ざるため）。 */
    try { navigator.serviceWorker.register('sw.js'); } catch(e){}
  });
}

/* ブラウザが「追加できますよ」と教えてくれたら受け取っておく */
window.addEventListener('beforeinstallprompt', function(e){
  try { e.preventDefault(); } catch(err){}
  deferredPrompt = e;
  renderInstallCard();
});

/* 追加が済んだら、案内を消す */
window.addEventListener('appinstalled', function(){
  deferredPrompt = null;
  lsSet(LSK.instHide, 'yes');
  var c = $('installCard'); if (c) c.style.display = 'none';
});

/* パソコンかどうか。スマホ・タブレットでなければパソコンとみなします */
function isDesktop_(){
  var u = (navigator.userAgent || '');
  return !/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(u);
}

function hideInstallCard(){
  lsSet(LSK.instHide, 'yes');
  $('installCard').style.display = 'none';
}

/* 設定から「もう一度見る」を押したとき。
   一度「あとでよい」を押した方が、やっぱり置きたくなったときに使います。 */
function showInstallAgain(){
  if (isStandalone()){
    alert('すでにホーム画面から開いています。\nこのまま、そのアイコンをお使いください。');
    return;
  }
  lsSet(LSK.instHide, '');
  closeCfg();
  renderInstallCard();
  if ($('installCard').style.display === 'block'){
    if ($('installCard').scrollIntoView) $('installCard').scrollIntoView(true);
  } else {
    alert('この端末では、この画面からは追加できません。\n' +
          'ブラウザのメニューから「ホーム画面に追加」をお試しください。');
  }
}

function doInstall(){
  if (!deferredPrompt){ hideInstallCard(); return; }
  try {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(r){
      deferredPrompt = null;
      if (r && r.outcome === 'accepted') hideInstallCard();
    });
  } catch(e){ hideInstallCard(); }
}

function renderInstallCard(){
  var card = $('installCard');
  if (!card) return;

  /* 出さない場合 */
  if (isStandalone() ||                       /* すでにホーム画面から開いている */
      lsGet(LSK.instHide) === 'yes' ||        /* 前に閉じた */
      isLineBrowser() ||                      /* LINEの中（先に別の案内が出る） */
      !myName ||                              /* まだ名前を選んでいない */
      $('nameCard').style.display === 'block' /* 名前を選ぶ画面が出ている */
     ){
    card.style.display = 'none';
    return;
  }

  var html = '';
  if (deferredPrompt){
    /* Android・パソコン共通：ボタン1つで終わる */
    html =
      '<p class="note">下のボタンを押すと、' +
      (isDesktop_() ? 'デスクトップ' : 'スマホの画面') +
      'にこのアプリの絵が置かれます。つぎからは、それを押すだけで開けます。</p>' +
      '<button type="button" class="subbtn" onclick="doInstall()">' +
      (isDesktop_() ? 'このパソコンに置く' : 'ホーム画面に置く') + '</button>' +
      '<button type="button" class="cancelbtn" onclick="hideInstallCard()">あとでよい</button>';
  } else if (isIOSDevice()){
    /* iPhone：自動ではできないので、順番を出す */
    html =
      '<p class="note">つぎの順で押すと、スマホの画面にこのアプリの絵が置かれます。</p>' +
      '<div class="instep"><b>1</b> 画面のいちばん下にある、' +
      '<b>四角から上に矢印が出た印</b>を押す</div>' +
      '<div class="instep"><b>2</b> 出てきた一覧を下にたどって' +
      '<b>「ホーム画面に追加」</b>を押す</div>' +
      '<div class="instep"><b>3</b> 右上の<b>「追加」</b>を押す</div>' +
      '<p class="note">やらなくても、このまま使えます。</p>' +
      '<button type="button" class="cancelbtn" onclick="hideInstallCard()">あとでよい</button>';
  } else if (isDesktop_()){
    /* ------------------------------------------------------------------
       パソコン。ブラウザによって押す場所が違うので、分けて書きます。
       （2026-08-07：Chromeは「…」ではなく縦の「⋮」で、「アプリ」も無い）
       ------------------------------------------------------------------ */
    var isEdge = /Edg\//.test(navigator.userAgent || '');
    if (isEdge){
      html =
        '<p class="note">つぎの順で押すと、デスクトップにこのアプリの絵が置かれます。</p>' +
        '<div class="instep"><b>1</b> 画面の右上の<b>「…」</b>を押す</div>' +
        '<div class="instep"><b>2</b> <b>「その他のツール」→「アプリ」</b>を選ぶ</div>' +
        '<div class="instep"><b>3</b> ' +
        '<b>「このサイトをアプリとしてインストール」</b>を押す</div>';
    } else {
      html =
        '<p class="note">つぎの順で押すと、デスクトップにこのアプリの絵が置かれます。</p>' +
        '<div class="instep"><b>1</b> 画面の右上の<b>「⋮」</b>（点が<b>縦</b>に3つ）を押す</div>' +
        '<div class="instep"><b>2</b> <b>「キャスト、保存、共有」</b>を選ぶ</div>' +
        '<div class="instep"><b>3</b> <b>「アプリとしてインストール」</b>を押す' +
        '（「ショートカットを作成」と出ることもあります）</div>';
    }
    html +=
      '<p class="note">アドレスバーの右のほうに<b>四角に下向き矢印の印</b>が' +
      '出ていれば、それを押すだけでも入ります。</p>' +
      '<p class="note" style="color:#8a5a00;"><b>シークレット（InPrivate）ウィンドウでは入れられません。</b>' +
      'ふつうのウィンドウで開き直してください。</p>' +
      '<button type="button" class="cancelbtn" onclick="hideInstallCard()">あとでよい</button>';
  } else {
    /* そのほか（らくらくホンの独自ブラウザなど） */
    html =
      '<p class="note">画面の右上か右下にある<b>メニューの印</b>（点が3つ並んだ印など）を押して、' +
      '<b>「ホーム画面に追加」</b>を選ぶと、つぎからすぐ開けます。</p>' +
      '<p class="note">見つからないときは、そのままお使いいただいて大丈夫です。</p>' +
      '<button type="button" class="cancelbtn" onclick="hideInstallCard()">あとでよい</button>';
  }
  $('installBody').innerHTML = html;
  card.style.display = 'block';
}

