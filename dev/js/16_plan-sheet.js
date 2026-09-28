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

  var memo = esc(ev.memo || '').replace(/\n/g, '<br>');
  var carNote = cars.length ? ('マイカー（' + cars.length + '台）') : '';

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
      '<tr>' + pl_('行先<br>(標高)', ' rowspan="3"') + pv_('', 'ptall" rowspan="3') +
        pl_('帰着場所') + pv_('') + pl_('<b>帰着時間</b>') + pvs_('', 3) + '</tr>' +
      '<tr>' + pl_('CL') + pv_(esc(cl)) + pl_('TEL') + pvs_(esc(planTel_(cl)), 3) + '</tr>' +
      '<tr>' + pl_('留守宅') + pv_(esc(rusu)) + pl_('TEL') + pvs_(esc(planTel_(rusu)), 3) + '</tr>' +
      '<tr>' + pl_('難易度') + pv_('') + pl_('交通手段') + pv_(carNote) + pl_('参加費') + pvs_('', 3) + '</tr>' +
      '<tr>' + pl_('標高差') + pv_('<span class="psmall">登り　　ｍ、下り　　ｍ</span>') +
        pl_('<b>歩行時間</b>') + pv_('') + pl_('<b>参加人数</b>') + pvs_(att.yes.length + ' 人', 3) + '</tr>' +
      '<tr>' + pl_('<b>コース</b>') + pvs_('', 7, 'pcourse') + '</tr>' +
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
