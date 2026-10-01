/* ==================================================================
   ★★2026-09-28h　山行の段取り（段1）
   　杉野さん 9/28 のご要望（人数・誰が来るか → 車の台数・誰が車を出すか → 計画書）に応えます。
   　→ 設計はプロジェクト文書 `★山行の段取り機能_調査と設計案_20260928.md` 3章・8章

   　①出欠に「車を出せる（何人乗り）」を足す
   　　・参加と答えた方にだけ、選び箱を出します（出さない／2〜10人乗り）
   　　・人数は「運転する方を含めた」乗れる人数です
   　　・参加でない回答に変えると、車も自動で「出さない」に戻ります（サーバーでも消します）
   　②計画書・報告書の下書き
   　　・今の様式（山行計画書／山行報告書が一体の1枚）に、アプリにある欄を埋めて出します
   　　・空いている欄は、印刷して手で書き足すか、その場で押して打ち込めます
   　　　★打ち込んだ内容は保存しません（閉じると消えます）。★手書きの方の手順を変えないためです
   　　・印刷の画面で「PDFに保存」を選べば PDF になります

   ★YAMAP も Gemini も使いません（個人情報を外へ出さない。設計案 7-2）。
   ★電話番号は、サーバーが幹事・管理者にだけ渡しているものを使います。
   　渡されていない方の画面では、TEL の欄は空いたままです（手で書く）。
   ================================================================== */

var CAR_SEATS_MAX = 10;

/* その方の「車を出せる（何人乗り）」。出さない／分からないときは 0 */
function carOf_(evId, name){
  for (var i = 0; i < state.attendance.length; i++){
    var a = state.attendance[i];
    if (a.eventId === evId && a.name === name && a.status === 'yes'){
      var n = parseInt(a.car, 10);
      return (n >= 2 && n <= CAR_SEATS_MAX) ? n : 0;
    }
  }
  return 0;
}

/* その予定で車を出す方（名簿の順）。[{ name, seats }] */
function carsOf_(evId){
  var r = [];
  for (var i = 0; i < state.attendance.length; i++){
    var a = state.attendance[i];
    if (a.eventId !== evId || a.status !== 'yes') continue;
    var n = parseInt(a.car, 10);
    if (n >= 2 && n <= CAR_SEATS_MAX) r.push({ name: a.name, seats: n });
  }
  r.sort(function(x, y){ return byMember_(x.name, y.name); });
  return r;
}

/* 参加と答えた方の「車を出せますか」の選び箱 */
function carPickHtml_(evId, name){
  var cur = carOf_(evId, name);
  var h = '<div class="carpick">🚗 車を出せますか？ ' +
          '<select onchange="setCar(\'' + evId + '\', this.value)">' +
          '<option value="0"' + (cur ? '' : ' selected') + '>出さない</option>';
  for (var n = 2; n <= CAR_SEATS_MAX; n++){
    h += '<option value="' + n + '"' + (cur === n ? ' selected' : '') + '>出せる（' + n + '人乗り）</option>';
  }
  h += '</select><div class="carhint">人数は、運転する方を含めた乗れる人数です</div></div>';
  return h;
}

/* 出欠の一覧の下に出す「車」の行 */
function carLineHtml_(evId, yesCount, forStaff){
  var cars = carsOf_(evId);
  if (!cars.length){
    /* 車を出す方がまだいないときは、段取りをする方（係・登録者・幹事・管理者）にだけ出す */
    if (!forStaff || !yesCount) return '';
    return '<br><b class="car">🚗 車 0台</b>：まだどなたも「出せる」と答えていません';
  }
  var seats = 0, parts = [];
  for (var i = 0; i < cars.length; i++){
    seats += cars[i].seats;
    parts.push(esc(cars[i].name) + '(' + cars[i].seats + ')');
  }
  var h = '<br><b class="car">🚗 車 ' + cars.length + '台</b>：' + parts.join('･') +
          '<br><span class="carsum">席 ' + seats + ' ／ 参加 ' + yesCount + '人';
  if (seats < yesCount) h += '　<b class="carng">あと ' + (yesCount - seats) + '席 足りません</b>';
  else h += '　足りています';
  return h + '</span>';
}

/* 車を出せる（何人乗り）を送る。★出欠は「参加」のまま */
function setCar(evId, v){
  var name = getName();
  if (!name){ showNamePick(); return; }
  var n = parseInt(v, 10);
  if (!(n >= 2 && n <= CAR_SEATS_MAX)) n = 0;
  var ev = eventOf_(evId);
  if (ev && ev.locked){
    alert('この予定の出欠は締め切られています');
    render();
    return;
  }
  for (var j = 0; j < state.attendance.length; j++){
    var a = state.attendance[j];
    if (a.eventId === evId && a.name === name){ a.car = n ? String(n) : ''; }
  }
  render();
  post({ action: 'setAttendance', eventId: evId, name: name, memberId: idOf(name),
         status: 'yes', car: n ? String(n) : '', by: name },
       n ? ('車を出せる（' + n + '人乗り）と送りました') : '車は「出さない」と送りました');
}

/* ------------------------------------------------------------------
   計画書・報告書の下書き
   ------------------------------------------------------------------ */
var PLAN_MODE = 'plan';   /* 'plan'＝計画書／'report'＝報告書 */
var PLAN_EV = '';

/* 係の文字列 → [{ role, name }] */
function planStaff_(ev){
  var s = sortStaffStr(ev && ev.staff || '');
  var r = [];
  if (!s) return r;
  var items = s.split(/[、,，]/);
  for (var i = 0; i < items.length; i++){
    var kv = items[i].split(/[：:]/);
    if (kv.length < 2) continue;
    var role = kv[0].replace(/^\s+|\s+$/g, ''), nm = kv[1].replace(/^\s+|\s+$/g, '');
    if (role && nm) r.push({ role: role, name: nm });
  }
  return r;
}

/* 係の中から、名前の決まりに合う最初の方 */
function planRole_(staff, re){
  for (var i = 0; i < staff.length; i++) if (re.test(staff[i].role)) return staff[i].name;
  return '';
}

/* CL＝「CL」「チーフリーダー」「リーダー」の係。無ければ「予定を任される係」の最初の方 */
function planCL_(staff){
  var cl = planRole_(staff, /^(CL|ＣＬ|チーフリーダー|リーダー)$/);
  if (cl) return cl;
  var leads = staffLeads_();
  for (var i = 0; i < staff.length; i++) if (leads.indexOf(staff[i].role) >= 0) return staff[i].name;
  return '';
}

function planTel_(name){ return name ? String(MEMBER_TEL[name] || '') : ''; }

var PLAN_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
function planDate_(key){
  var m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  var d = new Date(+m[1], +m[2] - 1, +m[3]);
  return (+m[2]) + ' 月 ' + (+m[3]) + ' 日(' + PLAN_WEEK[d.getDay()] + ')';
}
function planToday_(){
  var d = new Date();
  return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
}

/* 打ち込める欄 */
function pv_(text, cls){
  return '<td class="pv' + (cls ? ' ' + cls : '') + '" contenteditable="true">' + (text || '') + '</td>';
}
function pvs_(text, span, cls){
  return '<td class="pv' + (cls ? ' ' + cls : '') + '" colspan="' + span + '" contenteditable="true">' + (text || '') + '</td>';
}
function pl_(text, extra){ return '<td class="pl"' + (extra || '') + '>' + text + '</td>'; }

function openPlanSheet(evId, mode){
  var ev = eventOf_(evId);
  if (!ev) return;
  PLAN_EV = evId;
  if (mode) PLAN_MODE = mode;
  var att = attOf(evId);
  var staff = planStaff_(ev);
  var cars = carsOf_(evId);
  var carSeat = {};
  for (var c = 0; c < cars.length; c++) carSeat[cars[c].name] = cars[c].seats;

  var cl = planCL_(staff);
  var rusu = planRole_(staff, /留守/);
  var isRep = (PLAN_MODE === 'report');

  /* 参加者の欄：係の方（係：名前）を先に、そのあと参加の方。車を出す方に 🚗(何人乗り) */
  var cells = [], used = {};
  function mark(nm){ return carSeat[nm] ? ' <span class="pcar">🚗' + carSeat[nm] + '</span>' : ''; }
  for (var s = 0; s < staff.length; s++){
    if (/留守/.test(staff[s].role)) continue;   /* 留守宅は山へ行かない */
    cells.push(esc(staff[s].role) + ':' + esc(staff[s].name) + mark(staff[s].name));
    used[staff[s].name] = 1;
  }
  for (var y = 0; y < att.yes.length; y++){
    if (used[att.yes[y]]) continue;
    cells.push(esc(att.yes[y]) + mark(att.yes[y]));
  }
  var rows = Math.max(3, Math.ceil(cells.length / 4));
  var grid = '<table class="pgrid">';
  for (var r = 0; r < rows; r++){
    grid += '<tr>';
    for (var k = 0; k < 4; k++){
      var t = cells[r * 4 + k] || '';
      grid += '<td contenteditable="true">' + t + '</td>';
    }
    grid += '</tr>';
  }
  grid += '</table>';

  /* ★★2026-09-29c（段2）　コースの時刻表があれば、帰着・歩行時間・標高差・コースを埋める。
     　コースの欄は様式の「記号他」どおり、徒歩を「・・」でつなぎ、名前のある地点だけ時刻を書く */
  var crs = courseOf_(ev), crsEndP = '', crsEndT = '', crsWalk = '', crsUpDn = '', crsLine = '';
  if (crs){
    var ctm = courseTimes_(crs), cps = [];
    crsEndP = crs.pts[crs.pts.length - 1].n;
    crsEndT = courseFmt_(ctm.end);
    crsWalk = courseDur_(ctm.walk) + (ctm.rest ? '<br><span class="psmall">（休憩 ' + courseDur_(ctm.rest) + '）</span>' : '');
    if (crs.up || crs.down) crsUpDn = '登り ' + esc(crs.up || '') + 'ｍ、下り ' + esc(crs.down || '') + 'ｍ';
    for (var ci = 0; ci < crs.pts.length; ci++){
      if (ci === 0 || ci === crs.pts.length - 1 || courseNamed_(crs.pts[ci].n)){
        cps.push(esc(crs.pts[ci].n) + ' ' + courseFmt_(ctm.at[ci]));
      }
    }
    crsLine = cps.join(' ・・ ') + '<br><span class="psmall">（ペース ' + (+crs.pace || 100) + '%）</span>';
  }

  var memo = esc(ev.memo || '').replace(/\n/g, '<br>');
  var carNote = cars.length ? ('マイカー（' + cars.length + '台）') : '';

  /* ★★2026-09-29h　行先（標高）・難易度は YAMAP の計画から（コースの時刻表を取り込んだとき）。
     　参加費はマイカー精算の「一人あたり」（只隈さん：車を出す方は相殺されて0。マイカーでなければ手書き） */
  var dest = crs && crs.dest ? esc(crs.dest) : '';
  var level = crs && crs.cc ? 'コース定数 ' + esc(crs.cc) : '';
  var fee = '';
  var fm = String(ev.settle || '').match(/一人あたり[：:]\s*([\d,，]+)\s*円/);
  if (fm) fee = esc(fm[1]) + '円<br><span class="psmall">（マイカー精算・車を出す方は0円）</span>';

  var h = '<div class="plantools">' +
      '<div class="plantitle">📄 計画書・報告書の下書き</div>' +
      '<div class="planbtns">' +
        '<button type="button" class="' + (isRep ? '' : 'on') + '" onclick="openPlanSheet(\'' + evId + '\',\'plan\')">計画書</button>' +
        '<button type="button" class="' + (isRep ? 'on' : '') + '" onclick="openPlanSheet(\'' + evId + '\',\'report\')">報告書</button>' +
        '<button type="button" class="pprint" onclick="printPlanSheet()">🖨 印刷・PDF</button>' +
        '<button type="button" onclick="closePlanSheet()">閉じる</button>' +
      '</div>' +
      '<div class="planhint">アプリにある分だけ埋めてあります。空いている欄は、印刷して手で書き足すか、' +
        'その欄を押して打ち込めます。<b>打ち込んだ内容は保存されません</b>（閉じると消えます）。' +
        '「下見・定例」などの言葉は、押すと〇が付きます。' +
        'PDFにするときは、印刷の画面で「PDFに保存」を選んでください。</div>' +
    '</div>' +
    '<div class="plansheet">' +
    '<table class="pform">' +
      '<colgroup><col style="width:10%"><col style="width:19%"><col style="width:11%"><col style="width:18%">' +
        '<col style="width:11%"><col style="width:13%"><col style="width:7%"><col style="width:11%"></colgroup>' +
      '<tr>' + pl_('<span class="pmaru" onclick="toggleMaru(this)">下見</span>・<span class="pmaru" onclick="toggleMaru(this)">定例</span>', ' style="font-size:.8em"') +
        pv_('<b>' + esc(ev.title) + '</b>', 'ptitle" rowspan="2') +
        '<td class="pl pbig" colspan="2"><span class="pmaru' + (isRep ? '' : ' on') + '">山行計画書</span></td>' +
        pl_('作成日') + pv_(planToday_()) + pl_('受理日', ' style="font-size:.75em"') + pv_('') + '</tr>' +
      '<tr>' + pl_('<span class="pmaru" onclick="toggleMaru(this)">自主</span>・<span class="pmaru" onclick="toggleMaru(this)">他</span>', ' style="font-size:.8em"') +
        '<td class="pl pbig" colspan="2"><span class="pmaru' + (isRep ? ' on' : '') + '">山行報告書</span></td>' +
        pl_('団体名') + pvs_('<b>' + esc(CLUB.planOrg || '') + '</b>', 3) + '</tr>' +
      '<tr>' + pl_('月日曜') + pv_(planDate_(ev.date)) + pl_('集合場所') + pv_(esc(ev.place || '')) +
        pl_('集合時間') + pvs_(esc(ev.time || ''), 3) + '</tr>' +
      '<tr>' + pl_('行先<br>(標高)', ' rowspan="3"') + pv_(dest, 'ptall" rowspan="3') +
        pl_('帰着場所') + pv_(esc(crsEndP)) + pl_('<b>帰着時間</b>') + pvs_(crsEndT, 3) + '</tr>' +
      '<tr>' + pl_('CL') + pv_(esc(cl)) + pl_('TEL') + pvs_(esc(planTel_(cl)), 3) + '</tr>' +
      '<tr>' + pl_('留守宅') + pv_(esc(rusu)) + pl_('TEL') + pvs_(esc(planTel_(rusu)), 3) + '</tr>' +
      '<tr>' + pl_('難易度') + pv_(level) + pl_('交通手段') + pv_(carNote) + pl_('参加費') + pvs_(fee, 3) + '</tr>' +
      '<tr>' + pl_('標高差') + pv_('<span class="psmall">' + (crsUpDn || '登り　　ｍ、下り　　ｍ') + '</span>') +
        pl_('<b>歩行時間</b>') + pv_(crsWalk) + pl_('<b>参加人数</b>') + pvs_(att.yes.length + ' 人', 3) + '</tr>' +
      '<tr>' + pl_('<b>コース</b>') + pvs_(crsLine, 7, 'pcourse') + '</tr>' +
      '<tr>' + pl_('特記') + pvs_(memo, 7, 'pnote') + '</tr>' +
      '<tr>' + pl_('<b>記号他</b>') + '<td class="pv pkey" colspan="7">徒歩・・　車・バス＝＝　電車┅┅　スタート、昼食、ゴールのみ時刻を記入</td></tr>' +
      '<tr>' + pl_('参加者') + '<td class="pv pmem" colspan="7">' + grid + '</td></tr>' +
      '<tr>' + pl_('その他') + pvs_('', 7, 'pother') + '</tr>' +
    '</table>' +
    '<div class="pfootnote">※山行計画書と山行報告書が一体です。帰着時間・歩行時間・コースは書きかえて下さい' +
      (cars.length ? '<br>🚗＝車を出す方（数字は運転する方を含めた乗れる人数）' : '') + '</div>' +
    '</div>';

  var box = $('planSheet');
  if (!box){
    box = document.createElement('div');
    box.id = 'planSheet';
    document.body.appendChild(box);
  }
  box.innerHTML = h;
  box.style.display = 'block';
  try { box.scrollTop = 0; } catch(e){}
  document.body.classList.add('planopen');
}

function toggleMaru(el){
  if (!el) return;
  if (el.classList.contains('on')) el.classList.remove('on');
  else el.classList.add('on');
}

function closePlanSheet(){
  var box = $('planSheet');
  if (box){ box.style.display = 'none'; box.innerHTML = ''; }
  document.body.classList.remove('planopen');
}

function printPlanSheet(){
  document.body.classList.add('planprint');
  try { window.print(); } catch(e){}
  /* 印刷の画面を閉じたあとに戻す（すぐ戻すと、端末によっては印刷に間に合わない） */
  setTimeout(function(){ document.body.classList.remove('planprint'); }, 1500);
}

/* ==================================================================
   ★★2026-09-29c　山行の段取り 段2：コースの時刻表（YAMAP の画面から）
   　設計はプロジェクト文書 `★山行の段取り機能_調査と設計案_20260928.md` 3章・9章

   　①YAMAP の「登山計画」の画面を撮った写真を選ぶ（1枚に入らなければ、下へずらして何枚でも）
   　②「YAMAP で設定したペース」を選ぶ（分からなければ 100%）
   　③サーバーが Gemini に写真を読ませ、地点と区間の時間を返す
   　④表を確かめて直す（★到着時刻は安全に関わるので、ここを省かない）→ 保存
   　⑤出発時刻・ペースを変えると、全部の到着時刻と帰着がそろって動く

   ★持つのは「地点・前からの時間（ペース100%の分）・休憩」だけ。時刻は足し算で出す。
   　YAMAP のペースは「数字が大きいほど速い」（100%＝標準・90%＝ゆっくり）。
   　かかる時間＝標準の時間 ÷（ペース÷100）。YAMAP の画面の時間は、YAMAP のペースがもう掛かった値なので、
   　読み取ったら「× YAMAP のペース ÷ 100」で標準の時間に戻して持つ（二重に掛けない）。
   ★アプリ独自の式で山の時間を作らない（YAMAP・リーダーの時間を足し算するだけ。設計案 5章）。
   ★Gemini に渡すのは YAMAP の画面だけ（名簿・電話は渡さない。設計案 7-2）。
   ================================================================== */
var COURSE_EV = '';
var COURSE_EDIT = null;
var COURSE_BUSY = false;
var COURSE_YPACE = 100;   /* 最後に選んだ「YAMAP で設定したペース」（読み取りのあとも選んだままにする） */
var COURSE_PACES = [50, 60, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 140, 150, 170, 200];

function courseHmApp_(t){
  var m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
function courseFmt_(min){
  min = Math.round(min);
  var h = Math.floor(min / 60) % 24, m = ((min % 60) + 60) % 60;
  return h + ':' + pad2(m);
}
/* "8:00" → "08:00"（時刻の入力欄は2けたでないと空に見える） */
function courseHHMM_(t){
  var v = courseHmApp_(t);
  return v === null ? '' : pad2(Math.floor(v / 60)) + ':' + pad2(v % 60);
}
function courseDur_(min){
  min = Math.round(min);
  var h = Math.floor(min / 60), m = min % 60;
  return (h ? h + '時間' : '') + m + '分';
}
/* 名前のある地点か（「分岐」だけのものは、一覧と計画書では省く） */
function courseNamed_(n){ return !/^\s*分岐\s*$/.test(String(n || '')); }

/* 予定に入っているコース。無ければ null */
function courseOf_(ev){
  if (!ev || !ev.course) return null;
  try {
    var c = JSON.parse(ev.course);
    return (c && c.pts && c.pts.length >= 2) ? c : null;
  } catch(e){ return null; }
}

/* 到着時刻の一覧（分）と、歩行・休憩・帰着 */
function courseTimes_(c){
  var s = courseHmApp_(c.start);
  if (s === null) s = 8 * 60;
  var pace = (+c.pace > 0) ? +c.pace : 100;
  var t = s, at = [], walk = 0, rest = 0, n = c.pts.length;
  for (var i = 0; i < n; i++){
    if (i > 0){
      var w = (+c.pts[i].m || 0) * 100 / pace;
      t += w; walk += w;
    }
    at.push(t);
    var r = +c.pts[i].r || 0;
    if (i < n - 1){ t += r; rest += r; }
  }
  return { at: at, walk: walk, rest: rest, end: at[n - 1] };
}

/* 予定のカードに出す1行（だれにでも） */
function courseLineHtml_(ev){
  var c = courseOf_(ev);
  if (!c) return '';
  var tm = courseTimes_(c), parts = [];
  for (var i = 0; i < c.pts.length; i++){
    if (i === 0 || i === c.pts.length - 1 || courseNamed_(c.pts[i].n)){
      parts.push(courseFmt_(tm.at[i]) + ' ' + esc(c.pts[i].n));
    }
  }
  return '<div class="crsline">🗺 ' + parts.join(' → ') +
         '<span class="crsnote">（歩行 ' + courseDur_(tm.walk) + '・ペース ' + (+c.pace || 100) + '%）</span></div>';
}

function openCourse(evId){
  var ev = eventOf_(evId);
  if (!ev) return;
  COURSE_EV = evId;
  var c = courseOf_(ev);
  COURSE_EDIT = c ? JSON.parse(JSON.stringify(c)) : null;
  if (COURSE_EDIT){ COURSE_EDIT.warn = []; COURSE_EDIT.saved = true; }
  renderCourse_('');
}

function coursePaceOpts_(cur){
  var h = '';
  for (var i = 0; i < COURSE_PACES.length; i++){
    var p = COURSE_PACES[i];
    h += '<option value="' + p + '"' + (p === cur ? ' selected' : '') + '>' + p + '%' +
         (p === 100 ? '（標準）' : (p < 100 ? '' : '')) + '</option>';
  }
  return h;
}

function renderCourse_(msg){
  var ev = eventOf_(COURSE_EV);
  if (!ev) return;
  var c = COURSE_EDIT;
  var h = '<div class="plantools">' +
      '<div class="plantitle">🗺 コースの時刻表</div>' +
      '<div class="planhint"><b>' + esc(ev.title) + '</b>（' + esc(planDate_(ev.date)) + '）</div>' +
    '</div>' +
    '<div class="crsbox">' +
    '<div class="crsstep">' +
      /* ★★2026-09-29f　入口は YAMAP の共有URLだけ（只隈さん「スクショは年配の方には何を撮ればよいか分かりにくい」）。
         　写真の読み取り（courseRead）は作りだけ残し、画面には出さない。 */
      '<div class="crshead">① YAMAP の登山計画のURLを貼る</div>' +
      '<div class="planhint">YAMAP の登山計画の画面で<b>「共有URLコピー」</b>（アプリでは「共有」）を押し、ここに貼り付けてください。送られてきた文ごと貼っても大丈夫です。</div>' +
      '<textarea id="crsUrl" class="crsurl" rows="3" placeholder="https://yamap.com/plans/code/…">' + esc(COURSE_URL) + '</textarea>' +
      '<div class="planbtns"><button type="button" class="on" id="crsReadBtn" onclick="courseReadUrl()"' +
        (COURSE_BUSY ? ' disabled' : '') + '>🔗 YAMAP から取り込む</button></div>' +
      '<div id="crsMsg" class="planhint">' + (msg || '') + '</div>' +
    '</div>';

  if (c){
    h += '<div class="crsstep">' +
      '<div class="crshead">③ 確かめて直す（到着時刻は安全に関わります。YAMAP の画面と見比べてください）</div>' +
      '<div class="crsctl">出発 <input type="time" id="crsStart" value="' + esc(courseHHMM_(c.start)) + '" onchange="courseSetTop(\'start\', this.value)">' +
      '　ペース <select id="crsPace" onchange="courseSetTop(\'pace\', this.value)">' + coursePaceOpts_(+c.pace || 100) + '</select></div>' +
      '<div class="planhint">出発時刻やペースを変えると、下の到着時刻と帰着がそろって動きます。「前から」は標準（100%）の時間です。</div>';
    if (c.warn && c.warn.length){
      h += '<div class="crswarn">⚠ 読み取りで気になったところ：<br>' ;
      for (var w = 0; w < c.warn.length; w++) h += '・' + esc(c.warn[w]) + '<br>';
      h += '</div>';
    }
    h += '<table class="crstbl"><tr><th>着</th><th>地点</th><th>前から<br>(分)</th><th>休憩<br>(分)</th><th></th></tr>';
    for (var i = 0; i < c.pts.length; i++){
      var p = c.pts[i];
      h += '<tr class="' + (courseNamed_(p.n) ? 'crsnamed' : '') + '">' +
        '<td class="crst" id="crsT' + i + '"></td>' +
        '<td><input class="n" value="' + esc(p.n) + '" oninput="courseSet(' + i + ',\'n\',this.value)"></td>' +
        '<td>' + (i === 0 ? '—' : '<input class="m" type="number" inputmode="decimal" min="0" step="1" value="' + (+p.m || 0) +
          '" oninput="courseSet(' + i + ',\'m\',this.value)">') + '</td>' +
        '<td>' + (i === c.pts.length - 1 ? '' : '<input class="m" type="number" inputmode="numeric" min="0" step="1" value="' + (+p.r || 0) +
          '" oninput="courseSet(' + i + ',\'r\',this.value)">') + '</td>' +
        '<td><button type="button" class="crsdel" onclick="courseRow(' + i + ',\'del\')">✕</button>' +
          '<button type="button" class="crsdel" onclick="courseRow(' + i + ',\'add\')" title="この下に足す">＋</button></td>' +
      '</tr>';
    }
    h += '</table>' +
      '<div class="crssum" id="crsSum"></div>' +
      '<div class="planbtns">' +
        '<button type="button" class="on" id="crsSaveBtn" onclick="courseSave()">💾 この表を保存</button>' +
        (c.saved ? '<button type="button" onclick="courseDelete()">コースを消す</button>' : '') +
        '<button type="button" onclick="closePlanSheet()">閉じる</button>' +
      '</div>' +
      '<div id="crsSaveMsg" class="crssavemsg"></div>' +
      (c.saved ? '' : '<div class="planhint"><b>まだ保存していません。</b>閉じると、読み取った表は消えます。</div>') +
    '</div>';
  } else {
    h += '<div class="planbtns"><button type="button" onclick="closePlanSheet()">閉じる</button></div>';
  }
  h += '</div>';

  var box = $('planSheet');
  if (!box){
    box = document.createElement('div');
    box.id = 'planSheet';
    document.body.appendChild(box);
  }
  box.innerHTML = h;
  box.style.display = 'block';
  document.body.classList.add('planopen');
  if (c) courseRecalc_();
}

/* 時刻と合計だけを書き直す（打っている欄のカーソルを動かさないため、表は作り直さない） */
function courseRecalc_(){
  var c = COURSE_EDIT;
  if (!c) return;
  var tm = courseTimes_(c);
  for (var i = 0; i < c.pts.length; i++){
    var el = $('crsT' + i);
    if (el) el.innerHTML = courseFmt_(tm.at[i]);
  }
  var s = $('crsSum');
  if (s){
    s.innerHTML = '歩行 ' + courseDur_(tm.walk) + '（ペース ' + (+c.pace || 100) + '%）' +
      (tm.rest ? '・休憩 ' + courseDur_(tm.rest) : '') +
      '・帰着 ' + courseFmt_(tm.end) +
      (c.dist ? '<br><span class="crsnote">距離 ' + esc(c.dist) + 'km' +
        (c.up ? '・のぼり ' + esc(c.up) + 'm' : '') + (c.down ? '・くだり ' + esc(c.down) + 'm' : '') + '</span>' : '');
  }
}

function courseSet(i, k, v){
  var c = COURSE_EDIT;
  if (!c || !c.pts[i]) return;
  if (k === 'n') c.pts[i].n = String(v);
  else { var n = parseFloat(v); c.pts[i][k] = (isFinite(n) && n >= 0) ? n : 0; }
  c.saved = false;
  if (k !== 'n') courseRecalc_();
}
function courseSetTop(k, v){
  var c = COURSE_EDIT;
  if (!c) return;
  if (k === 'pace') c.pace = parseInt(v, 10) || 100;
  else c.start = String(v || '');
  c.saved = false;
  courseRecalc_();
}
function courseRow(i, op){
  var c = COURSE_EDIT;
  if (!c) return;
  if (op === 'del'){
    if (c.pts.length <= 2){ alert('地点は2つ以上いります'); return; }
    c.pts.splice(i, 1);
    if (c.pts.length) c.pts[0].m = 0;
  } else {
    c.pts.splice(i + 1, 0, { n: '', m: 0, r: 0 });
  }
  c.saved = false;
  renderCourse_('');
}

/* 写真を小さくする（幅 900px まで・JPEG）→ base64 */
function courseShrink_(file, cb){
  var fr = new FileReader();
  fr.onload = function(){
    var img = new Image();
    img.onload = function(){
      var w = img.width, hh = img.height, k = w > 900 ? 900 / w : 1;
      var cv = document.createElement('canvas');
      cv.width = Math.round(w * k); cv.height = Math.round(hh * k);
      var g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      var d = '';
      try { d = cv.toDataURL('image/jpeg', 0.8); } catch(e){ d = ''; }
      cb(d.replace(/^data:image\/[a-z]+;base64,/, ''));
    };
    img.onerror = function(){ cb(''); };
    img.src = fr.result;
  };
  fr.onerror = function(){ cb(''); };
  fr.readAsDataURL(file);
}

/* 読み取りは書き込みではないので、post() を通さず待ち時間を長く取る（Gemini を待つ） */
function courseApi_(body, cb){
  var done = false;
  function fin(err, data){ if (done) return; done = true; cb(err, data); }
  var xhr = new XMLHttpRequest();
  var url = API_URL + (API_URL.indexOf('?') >= 0 ? '&' : '?') + 'club=' + encodeURIComponent(CLUB.id);
  try { body.deviceId = deviceId(); } catch(eD){}
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
  xhr.timeout = 120000;
  xhr.onreadystatechange = function(){
    if (xhr.readyState !== 4) return;
    if (xhr.status >= 200 && xhr.status < 300){
      var d = null;
      try { d = JSON.parse(xhr.responseText); } catch(e){}
      fin(d ? null : true, d);
    } else fin(true);
  };
  xhr.ontimeout = function(){ fin(true); };
  xhr.onerror = function(){ fin(true); };
  try { xhr.send(JSON.stringify(body)); } catch(e){ fin(true); }
}

function courseRead(){
  if (COURSE_BUSY) return;
  if (!getName()){ showNamePick(); return; }
  var inp = $('crsFiles');
  var files = inp && inp.files ? inp.files : [];
  if (!files.length){ $('crsMsg').innerHTML = '<b>写真を選んでください。</b>'; return; }
  if (files.length > 6){ $('crsMsg').innerHTML = '<b>写真は6枚までにしてください。</b>'; return; }
  var ypace = parseInt(($('crsYpace') || {}).value, 10) || 100;
  COURSE_YPACE = ypace;
  COURSE_BUSY = true;
  var btn = $('crsReadBtn'); if (btn) btn.disabled = true;
  $('crsMsg').innerHTML = '写真を用意しています…';
  var list = [], k = 0;
  (function next(){
    if (k >= files.length){
      $('crsMsg').innerHTML = '読み取っています…（30秒ほどかかることがあります）';
      courseApi_({ action: 'readCourse', id: COURSE_EV, images: list }, function(err, data){
        COURSE_BUSY = false;
        if (err || !data){ renderCourse_('<b>返事が届きませんでした。</b>電波の良い所で、もう一度「写真を読み取る」を押してください（読み取りは何度押しても大丈夫です）。'); return; }
        if (data.error){ renderCourse_('<b>' + esc(data.error) + '</b>' + needNameBtn_(data)); return; }
        var r = data.read || {};
        var ev = eventOf_(COURSE_EV) || {};
        var pts = [];
        for (var i = 0; i < (r.pts || []).length; i++){
          var p = r.pts[i];
          /* YAMAP のペースを外して、標準（100%）の時間で持つ */
          pts.push({ n: String(p.n || ''), m: i ? Math.round((+p.m || 0) * ypace / 100 * 10) / 10 : 0,
                     r: +p.r || 0 });
        }
        if (pts.length < 2){ renderCourse_('<b>地点を2つ以上読み取れませんでした。</b>地点と時刻が並んだ画面を撮ってください。'); return; }
        COURSE_EDIT = { start: courseHHMM_(r.start) || courseHHMM_(ev.time) || '08:00',
                        pace: ypace, dist: r.dist || '', up: r.up || '', down: r.down || '',
                        pts: pts, warn: r.warn || [], saved: false };
        renderCourse_('読み取りました（' + pts.length + '地点）。下の表を、YAMAP の画面と見比べてから保存してください。');
      });
      return;
    }
    courseShrink_(files[k], function(d){
      if (!d){
        COURSE_BUSY = false;
        renderCourse_('<b>' + (k + 1) + '枚目の写真を開けませんでした。</b>');
        return;
      }
      list.push(d); k++; next();
    });
  })();
}

/* ★★2026-09-29f　YAMAP の共有URLから取り込む。★返ってくる「前から」は標準（100%）の分・ペースは YAMAP の値 */
var COURSE_URL = '';
function courseReadUrl(){
  if (COURSE_BUSY) return;
  if (!getName()){ showNamePick(); return; }
  var t = String(($('crsUrl') || {}).value || '');
  COURSE_URL = t;
  if (!/yamap\.com\/plans\/code\//.test(t)){
    $('crsMsg').innerHTML = '<b>YAMAP の登山計画のURL（https://yamap.com/plans/code/… で始まるもの）を貼ってください。</b>';
    return;
  }
  COURSE_BUSY = true;
  var btn = $('crsReadBtn'); if (btn) btn.disabled = true;
  $('crsMsg').innerHTML = 'YAMAP から取り込んでいます…（10〜30秒ほどかかることがあります）';
  courseApi_({ action: 'readCourseUrl', id: COURSE_EV, url: t }, function(err, data){
    COURSE_BUSY = false;
    if (err || !data){ renderCourse_('<b>返事が届きませんでした。</b>電波の良い所で、もう一度「YAMAP から取り込む」を押してください（何度押しても大丈夫です）。'); return; }
    if (data.error){ renderCourse_('<b>' + esc(data.error) + '</b>' + needNameBtn_(data)); return; }
    var r = data.read || {};
    var pts = [];
    for (var i = 0; i < (r.pts || []).length; i++){
      var p = r.pts[i];
      pts.push({ n: String(p.n || ''), m: i ? (+p.m || 0) : 0, r: +p.r || 0 });
    }
    if (pts.length < 2){ renderCourse_('<b>地点を2つ以上取り込めませんでした。</b>'); return; }
    var ev = eventOf_(COURSE_EV) || {};
    COURSE_EDIT = { start: courseHHMM_(r.start) || courseHHMM_(ev.time) || '08:00',
                    pace: +r.pace || 100, dist: r.dist || '', up: r.up || '', down: r.down || '',
                    dest: r.dest || '', cc: r.cc || '',
                    pts: pts, warn: r.warn || [], saved: false };
    renderCourse_('取り込みました（' + (r.title ? '「' + esc(r.title) + '」・' : '') + pts.length + '地点・ペース ' + (+r.pace || 100) + '%）。' +
                  '下の表を YAMAP の画面と見比べてから保存してください。');
  });
}

function courseSave(){
  var c = COURSE_EDIT;
  if (!c) return;
  var pts = [];
  for (var i = 0; i < c.pts.length; i++){
    var n = String(c.pts[i].n || '').replace(/^\s+|\s+$/g, '');
    if (!n){ alert((i + 1) + '番目の地点の名前が空です'); return; }
    pts.push({ n: n, m: i ? (+c.pts[i].m || 0) : 0, r: +c.pts[i].r || 0 });
  }
  if (pts.length < 2){ alert('地点は2つ以上いります'); return; }
  if (courseHmApp_(c.start) === null){ alert('出発時刻を入れてください'); return; }
  var name = getName();
  if (!name){ showNamePick(); return; }
  /* ★★2026-09-29g　押したかどうかが分かるように（只隈さん「押したか押してないかがよくわからない」）。
     　いつもの知らせ（画面上の status）はこの画面の裏に隠れるので、この画面の中に出す。 */
  courseSaving_(true, '保存しています…（10秒ほどかかることがあります）');
  post({ action: 'saveCourse', id: COURSE_EV, by: name,
         course: { start: c.start, pace: +c.pace || 100, dist: c.dist, up: c.up, down: c.down,
                   dest: c.dest || '', cc: c.cc || '', pts: pts } },
       'コースの時刻表を保存しました',
       function(){ courseSaved_('✅ 保存しました。予定のカードに「🗺」の1行が出ます。'); },
       function(){ courseSaving_(false, '<b>⚠ ' + (($('status') || {}).innerHTML || '保存できませんでした') + '</b>'); });
}

/* 保存中は押せなくして、この画面の中に知らせる */
function courseSaving_(busy, msg){
  var b = $('crsSaveBtn');
  if (b){ b.disabled = !!busy; b.innerHTML = busy ? '⏳ 保存しています…' : '💾 この表を保存'; }
  var m = $('crsSaveMsg');
  if (m){ m.innerHTML = msg || ''; m.className = 'crssavemsg' + (busy ? ' busy' : (msg ? ' ng' : '')); }
}
/* 済んだら、この画面の中に「保存しました」を2秒出してから閉じる */
function courseSaved_(msg){
  var b = $('crsSaveBtn');
  if (b){ b.disabled = true; b.innerHTML = '✅ 保存しました'; }
  var m = $('crsSaveMsg');
  if (m){ m.innerHTML = msg; m.className = 'crssavemsg ok'; }
  setTimeout(function(){ closePlanSheet(); }, 2000);
}

function courseDelete(){
  if (!confirm('この予定のコースの時刻表を消します。よろしいですか？')) return;
  var name = getName();
  if (!name){ showNamePick(); return; }
  post({ action: 'saveCourse', id: COURSE_EV, by: name, course: '' },
       'コースの時刻表を消しました', function(){ closePlanSheet(); });
}
