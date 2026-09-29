/* ---------- 係・担当の入力 ----------
   保存は「係：名前、係：名前」の文字列（今まで通りの形式）

   ★★2026-09-21（係の名前をクラブごとに）
   　係の名前は、サーバーの「設定」シートから CLUB.staffRoles として届きます。
   　★この並びが、選び箱の順・画面の表示順・Excelのひな形の列の順、すべてになります。
   　★まだ受け取れていないとき（古いGAS・初回の圏外）は空です。
   　　そのときは「その他」の手入力だけになり、権限のボタンは出しません
   　　（サーバーが正しく判定するので、押せないだけで害はありません）。 */
function staffRoles_(){
  return (CLUB && CLUB.staffRoles && CLUB.staffRoles.length) ? CLUB.staffRoles : [];
}

/* その予定を任される係（変更・削除・中止・締め切り・代理回答・お知らせ） */
function staffLeads_(){
  return (CLUB && CLUB.staffLeads && CLUB.staffLeads.length) ? CLUB.staffLeads : [];
}

function staffOrderOf_(item){
  var kv = item.split(/[：:]/);
  var role = (kv[0] || '').replace(/^\s+|\s+$/g, '');
  var i = staffRoles_().indexOf(role);
  return i < 0 ? 999 : i;
}

/* 「係：名前、係：名前」の文字列を決まった順に並び替える */
function sortStaffStr(s){
  s = String(s == null ? '' : s);
  if (!s) return '';
  var items = s.split(/[、,，]/);
  var dec = [];
  for (var i = 0; i < items.length; i++){
    var it = items[i].replace(/^\s+|\s+$/g, '');
    if (it) dec.push({ o: staffOrderOf_(it), i: i, t: it });
  }
  dec.sort(function(a, b){ return a.o !== b.o ? a.o - b.o : a.i - b.i; });
  var r = [];
  for (var j = 0; j < dec.length; j++) r.push(dec[j].t);
  return r.join('、');
}

/* その予定の係の中で、編集・代理の権限を持つ人か？
   ★★2026-09-21　対象の係は「設定」シートの「予定を任される係」。
   　★これはボタンを出すかどうかだけ。守りの本体はサーバー（staffCanEdit_）。 */
function staffCanEdit(ev, name){
  if (!name || !ev || !ev.staff) return false;
  var leads = staffLeads_();
  if (!leads.length) return false;
  var items = String(ev.staff).split(/[、,，]/);
  for (var i = 0; i < items.length; i++){
    var kv = items[i].split(/[：:]/);
    if (kv.length < 2) continue;
    var role = kv[0].replace(/^\s+|\s+$/g, '');
    var nm = kv[1].replace(/^\s+|\s+$/g, '');
    if (nm === name && leads.indexOf(role) >= 0) return true;
  }
  return false;
}
var staffRows = [];

function resetStaff(){
  staffRows = [];
  renderStaffRows();
}

function currentRoles_(){
  return staffRoles_();
}

function renderStaffRows(){
  /* 空の行を除いてから、最後に空の行を1つ足す（1つ選ぶと次の行が出る仕組み） */
  var rows = [];
  for (var i = 0; i < staffRows.length; i++){
    var r = staffRows[i];
    if (r.role || r.name || r.roleFree) rows.push(r);
  }
  rows.push({ role: '', roleFree: '', name: '' });
  staffRows = rows;

  var roles = currentRoles_();
  var html = '';
  for (var j = 0; j < staffRows.length; j++){
    var row = staffRows[j];
    var ropt = '<option value="">（係を選ぶ）</option>';
    for (var k = 0; k < roles.length; k++){
      ropt += '<option value="' + esc(roles[k]) + '"' + (row.role === roles[k] ? ' selected' : '') + '>' + esc(roles[k]) + '</option>';
    }
    /* ★2026-09-29k　下見のときは「下見」も選べる（設定の係の名前に無くても） */
    /* ★2026-09-29o　下見の「運転手」「同行」も選べる（設定の係の名前に無くても）。係の欄に入れた方だけの予定か、その行がもともとそれのとき */
    for (var xr = 0; xr < EXTRA_ROLES_.length; xr++){
      var xn = EXTRA_ROLES_[xr];
      if (roles.indexOf(xn) < 0 && (row.role === xn || ($('addTarget') && $('addTarget').value === '係のみ'))){
        ropt += '<option value="' + xn + '"' + (row.role === xn ? ' selected' : '') + '>' + xn + '</option>';
      }
    }
    ropt += '<option value="その他"' + (row.role === 'その他' ? ' selected' : '') + '>その他</option>';
    var nopt = '<option value="">（名前）</option>';
    var names = realMembers_();
    if (row.name && names.indexOf(row.name) < 0) names.push(row.name);
    for (var m = 0; m < names.length; m++){
      nopt += '<option value="' + esc(names[m]) + '"' + (row.name === names[m] ? ' selected' : '') + '>' + esc(names[m]) + '</option>';
    }
    html += '<table class="row3" style="margin-top:6px"><tr>' +
      '<td style="width:48%"><select onchange="staffRoleChg(' + j + ', this.value)">' + ropt + '</select></td>' +
      '<td style="width:52%"><select onchange="staffNameChg(' + j + ', this.value)">' + nopt + '</select></td>' +
      '</tr></table>';
    if (row.role === 'その他'){
      html += '<input type="text" placeholder="係の名前を入力（例）車出し）" value="' + esc(row.roleFree || '') + '" oninput="staffFreeChg(' + j + ', this.value)">';
    }
  }
  $('staffRows').innerHTML = html;
}

function staffRoleChg(i, v){ if (staffRows[i]){ staffRows[i].role = v; renderStaffRows();
  try { refreshAddTargetWho(); } catch(e){} } }
function staffNameChg(i, v){ if (staffRows[i]){ staffRows[i].name = v; renderStaffRows();
  try { refreshAddTargetWho(); } catch(e){} } }
function staffFreeChg(i, v){ if (staffRows[i]) staffRows[i].roleFree = v; }

/* ★★2026-09-03　選んだ種類で、誰に届くのかをその場に出す。
   　押したあとではなく、押す前に見えるようにするため。 */
function refreshAddTargetWho(){
  var el = document.getElementById('addTargetWho');
  var sel = document.getElementById('addTarget');
  if (!el || !sel) return;
  var t = sel.value;
  var me = getName();
  var who = targetNamesFor_(t, serializeStaff(), me);
  var txt;
  if (!t){
    txt = '全員（' + who.length + '名）に届きます。';
  } else if (!who.length){
    txt = '★このままでは、どなたにも届きません。';
  } else {
    txt = who.join('・') + ' の' + who.length + '名に届きます。';
  }
  var mw = String(t).match(/^作業[:：](.+)$/);
  if (mw && !workMembers_(mw[1]).length){
    txt += '　★顔ぶれ「' + mw[1] + '」にメンバーが入っていません。';
  } else if (mw){
    /* ★★2026-09-03　穴1　作業マスタの名字が名簿にないとき、押す前に名指しで知らせる。
       　まとめて登録の確認画面には前からこの警告があったのに、
       　杉野さんが実際に使うこのフォームには無かった。
       　名簿に一人も当たらないと、届くのは登録者ひとりになる（サーバー側で係のみに落ちる）。 */
    var wlf = workMembers_(mw[1]), allf = realMembers_(), badf = [];
    for (var bf = 0; bf < wlf.length; bf++){
      if (allf.indexOf(wlf[bf]) < 0) badf.push(wlf[bf]);
    }
    if (badf.length){
      txt += '　★顔ぶれ「' + mw[1] + '」の ' + badf.join('・') +
             ' が名簿にありません（その方には届きません）。';
    }
  } else if (t === '係のみ' && !serializeStaff()){
    txt += '　★係・担当の欄が空です。';
  }
  if (t){
    var nn = unreachable_(who);
    if (nn && nn.length){
      txt += '　★LINEもメールも登録が無い方：' + nn.join('・');
    }
  }
  el.innerHTML = esc(txt);
}

/* ★★2026-09-03　くり返しの日付を作る。
   　実物の予定を数えたところ、定例集会は「毎月 第3土曜」が7ヶ月続いていた。
   　これまでは「毎週」しか無かったので、毎月の予定は1件も作れなかった。

   　week      … 毎週（同じ曜日）
   　monthNth  … ★毎月 第N◯曜（例：第3土曜）。その月に第N週が無ければ飛ばす
   　monthDay  … 毎月 同じ日（例：15日）。31日など無い月は飛ばす */
function repeatDates_(mode, y, m, d, months){
  var out = [];
  if (mode === 'week'){
    var endW = new Date(y, m - 1 + months, d);
    var cw = new Date(y, m - 1, d), gw = 0;
    while (cw <= endW && gw < 120){
      out.push(dkey(cw.getFullYear(), cw.getMonth() + 1, cw.getDate()));
      cw.setDate(cw.getDate() + 7); gw++;
    }
    return out;
  }
  if (mode === 'monthNth'){
    var base = new Date(y, m - 1, d);
    var nth  = Math.floor((d - 1) / 7) + 1;   /* 第何週か */
    var wd   = base.getDay();                 /* 曜日 */
    for (var i = 0; i <= months; i++){
      var yy = y, mm = m - 1 + i;
      yy += Math.floor(mm / 12); mm = ((mm % 12) + 12) % 12;
      var first = new Date(yy, mm, 1);
      var day1 = 1 + ((wd - first.getDay()) + 7) % 7;   /* その月の第1◯曜 */
      var day = day1 + (nth - 1) * 7;
      var last = new Date(yy, mm + 1, 0).getDate();
      if (day > last) continue;               /* 第5週が無い月は飛ばす */
      out.push(dkey(yy, mm + 1, day));
    }
    return out;
  }
  if (mode === 'monthDay'){
    for (var j = 0; j <= months; j++){
      var yy2 = y, mm2 = m - 1 + j;
      yy2 += Math.floor(mm2 / 12); mm2 = ((mm2 % 12) + 12) % 12;
      var last2 = new Date(yy2, mm2 + 1, 0).getDate();
      if (d > last2) continue;                /* 31日が無い月は飛ばす */
      out.push(dkey(yy2, mm2 + 1, d));
    }
    return out;
  }
  return [dkey(y, m, d)];
}

/* ★くり返しで、どの日ができるのかを押す前に見せる */
function refreshRepPreview(){
  var el = document.getElementById('repPreview');
  var sel = document.getElementById('addRep');
  if (!el || !sel) return;
  if (sel.value === 'none'){ el.innerHTML = ''; return; }
  var y = parseInt($('addY').value, 10);
  var m = parseInt($('addM').value, 10);
  var d = parseInt($('addD').value, 10);
  if (!y || !m || !d){ el.innerHTML = ''; return; }
  var ds = repeatDates_(sel.value, y, m, d, parseInt($('addRepLen').value, 10));
  var W = '日月火水木金土';
  var t = 'この設定でできる予定：' + ds.length + '件\n';
  var sh = [];
  for (var i = 0; i < ds.length && i < 14; i++){
    var p = ds[i].split('-');
    sh.push((+p[1]) + '/' + (+p[2]) + '(' + W[new Date(+p[0], p[1]-1, +p[2]).getDay()] + ')');
  }
  t += sh.join('　');
  if (ds.length > 14) t += '　ほか' + (ds.length - 14) + '件';
  el.innerHTML = esc(t).replace(/\n/g, '<br>');
}

function serializeStaff(){
  var parts = [];
  for (var i = 0; i < staffRows.length; i++){
    var r = staffRows[i];
    var label = (r.role === 'その他') ? String(r.roleFree || '').replace(/^\s+|\s+$/g, '') : r.role;
    if (label && r.name) parts.push(label + '：' + r.name);
  }
  return sortStaffStr(parts.join('、'));
}

function parseStaff(s){
  staffRows = [];
  s = sortStaffStr(String(s || ''));
  if (s){
    var items = s.split(/[、,，]/);
    for (var i = 0; i < items.length; i++){
      var kv = items[i].split(/[：:]/);
      if (kv.length < 2) continue;
      var role = kv[0].replace(/^\s+|\s+$/g, '');
      var name = kv[1].replace(/^\s+|\s+$/g, '');
      if (!role || !name) continue;
      /* ★★2026-09-21　「設定」の係の名前にあれば選び箱、無ければ「その他」の手入力 */
      var known = staffRoles_().indexOf(role) >= 0 || EXTRA_ROLES_.indexOf(role) >= 0;   /* ★2026-09-29o */
      staffRows.push({ role: known ? role : 'その他', roleFree: known ? '' : role, name: name });
    }
  }
  renderStaffRows();
}

/* ★★2026-09-29i　マイカー移動の印。
   　新しく登録するときに「下見（係のみ）」を選んだら、最初から入れます（直すときは触りません）。 */
function kindMycarDefault_(){
  var sel = $('addTarget'), cb = $('addMycar');
  if (!sel || !cb || editingId) return;
  if (sel.value === '係のみ') cb.checked = true;
}

/* ★★2026-09-29p　「🔎 下見をする」の☑（只隈さん決定：保存したら、続けて下見の入力を開く）
   　登録画面では山行と集会が同じ「全員」なので、山行だけに出すことはできない。
   　→ 出欠をとる相手が「全員」で、くり返しなしのときだけ出す（下見の入口 evOpsHtml_ と同じ条件）。 */
function shitamiRowSync_(){
  var row = $('shitamiRow'), cb = $('addShitami');
  if (!row || !cb) return;
  var tgt = $('addTarget') ? $('addTarget').value : '';
  if (editingId){ var e0 = eventOf_(editingId); tgt = e0 ? (e0.target || '') : tgt; }
  var rep = editingId ? 'none' : ($('addRep') ? $('addRep').value : 'none');
  var ok = !tgt && rep === 'none';
  row.style.display = ok ? 'block' : 'none';
  if (!ok) cb.checked = false;
}

/* ★2026-09-29p　計画表・報告書・山行LINEの欄は畳んでおく。入っている数をボタンに出す */
function linksBoxSync_(open){
  var box = $('linksBox'), btn = $('linksBtn');
  if (!box || !btn) return;
  var n = 0, ids = ['addPlan', 'addReport', 'addLineGroup'];
  for (var i = 0; i < ids.length; i++) if ($(ids[i]) && $(ids[i]).value.replace(/\s/g, '')) n++;
  if (open !== undefined) box.style.display = open ? 'block' : 'none';
  var on = box.style.display !== 'none';
  btn.innerHTML = (on ? '▾ ' : '▸ ') + '📎 計画表・報告書・山行LINE（あれば）' + (n ? '　<b>' + n + '件入っています</b>' : '');
}
function toggleLinksBox_(){ linksBoxSync_($('linksBox').style.display === 'none'); }

/* 保存したあと、その山行の下見の入力を開く（新しい予定は、仮の番号 → 本物の番号に付け替える） */
function shitamiAfterSave_(evId){
  if (!evId || (SHITAMI && SHITAMI.evId === evId)) return;
  EV_OPS_OPEN[evId] = true;
  openShitami(evId);
}

/* ==================================================================
   ★★2026-09-29m　下見は、山行の予定から入れる（只隈さん決定）
   　只隈さん「山行があるから下見があるわけで、山行に付属すると考えると、
   　山行を選んで、下見をやるとなったら日付を選んでメンバー（基本山行メンバー＋α）を選ぶ」
   　・入口：山行の「⚙ この予定の操作」→「山行の準備」→「🔎 下見を入れる」（14_… ではなく evOpsHtml_）
   　・押した場所のすぐ下に、日付・時刻・行く方の☑だけの小さな入力が開く。
   　　行く方は、山行の係の方と「参加」の方に最初から☑。ほかの会員も☑で足せる。
   　・登録すると「下見 ＜山行の題名＞」・種類は下見（係のみ）・行く方を係の欄に「下見：名前」・マイカーの印つき。
   　・入力中にサーバーの返事で画面を作り直しても消えないよう、中身は SHITAMI にしまう。
   　（2026-09-29k の「入力画面で種類を下見にすると本番を選ぶ」は、入口を1つにするため外した）
   ================================================================== */
/* ★2026-09-29o　下見の役（只隈さん「下見のリーダーとか副リーダーとか運転手とかの役割がある」）。役の無い方は「同行」 */
var EXTRA_ROLES_ = ['運転手', '同行'];
var SHITAMI = null;   /* { evId, y, m, d, h, mi, pick: {名前: true}, role: {名前: 役} } */

/* 山行の係の方（係の名前つき）と「参加」の方 */
function honbanNames_(ev){
  var list = [], seen = {}, s = String(ev.staff || '').split(/[、,，]/);
  for (var i = 0; i < s.length; i++){
    var kv = s[i].split(/[：:]/);
    var nm = kv.length >= 2 ? kv[1].replace(/^\s+|\s+$/g, '') : '';
    if (nm && !seen[nm]){ seen[nm] = 1; list.push({ name: nm, why: kv[0].replace(/^\s+|\s+$/g, '') }); }
  }
  var yes = attOf(ev.id).yes;
  for (var j = 0; j < yes.length; j++){
    if (!seen[yes[j]]){ seen[yes[j]] = 1; list.push({ name: yes[j], why: '参加' }); }
  }
  return list;
}

function openShitami(evId){
  var ev = eventOf_(evId);
  if (!ev) return;
  if (SHITAMI && SHITAMI.evId === evId){ SHITAMI = null; renderList(); return; }   /* もう一度押したら閉じる */
  var p = String(ev.date).split('-');
  var dt = new Date(+p[0], +p[1] - 1, +p[2]);
  dt.setDate(dt.getDate() - 7);                     /* 最初は山行の7日前 */
  var now = new Date(); now.setHours(0, 0, 0, 0);
  if (dt < now) dt = now;                            /* 過ぎていれば今日 */
  var tm = String(ev.time || '').match(/(\d{1,2}):(\d{2})/);
  var pick = {}, role = {}, hn = honbanNames_(ev);
  for (var i = 0; i < hn.length; i++){
    pick[hn[i].name] = true;
    role[hn[i].name] = (hn[i].why && hn[i].why !== '参加') ? hn[i].why : '同行';   /* 山行の係の方は同じ役、参加の方は同行 */
  }
  SHITAMI = { evId: evId, y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(),
              h: tm ? String(parseInt(tm[1], 10)) : '', mi: tm ? tm[2] : '00', pick: pick, role: role };
  renderList();
  try { scrollToEv(evId); var f = $('shitami-' + evId); if (f) f.scrollIntoView({ block: 'center' }); } catch (e){}
}

function shitamiSet_(k, v){ if (SHITAMI) SHITAMI[k] = v; }
function shitamiPick_(nm, on){ if (SHITAMI) SHITAMI.pick[nm] = !!on; }
function shitamiRole_(nm, v){ if (SHITAMI){ SHITAMI.role[nm] = v; SHITAMI.pick[nm] = true; renderList(); } }
function shitamiDate_(v){
  var p = String(v || '').split('-');
  if (p.length === 3 && SHITAMI){ SHITAMI.y = +p[0]; SHITAMI.m = +p[1]; SHITAMI.d = +p[2]; }
}
/* 役の選び箱：クラブの係の名前＋運転手＋同行（山行でその方が付いていた役が名前に無ければ足す） */
function shitamiRoleOpts_(cur){
  var roles = staffRoles_().slice();
  for (var i = 0; i < EXTRA_ROLES_.length; i++) if (roles.indexOf(EXTRA_ROLES_[i]) < 0) roles.push(EXTRA_ROLES_[i]);
  if (cur && roles.indexOf(cur) < 0) roles.push(cur);
  var h = '';
  for (var j = 0; j < roles.length; j++) h += '<option value="' + esc(roles[j]) + '"' + (roles[j] === cur ? ' selected' : '') + '>' + esc(roles[j]) + '</option>';
  return h;
}

function shitamiFormHtml_(ev){
  if (!SHITAMI || SHITAMI.evId !== ev.id) return '';
  var S = SHITAMI, i, o;
  var hh = '<select onchange="shitamiSet_(\'h\', this.value)"><option value="">時間なし</option>';
  for (i = 0; i <= 23; i++) hh += '<option value="' + i + '"' + (S.h === String(i) ? ' selected' : '') + '>' + i + '時</option>';
  hh += '</select>';
  var mm = '<select onchange="shitamiSet_(\'mi\', this.value)">';
  for (i = 0; i < 60; i += 5){ o = (i < 10 ? '0' : '') + i; mm += '<option value="' + o + '"' + (S.mi === o ? ' selected' : '') + '>' + o + '分</option>'; }
  mm += '</select>';
  var hn = honbanNames_(ev), inH = {}, rows = '';
  var chk = function(nm, why){
    var q = esc(nm).replace(/'/g, '');
    return '<table class="shrow"><tr><td><label class="shchk"><input type="checkbox"' + (S.pick[nm] ? ' checked' : '') +
           ' onchange="shitamiPick_(\'' + q + '\', this.checked)"> ' + esc(nm) +
           (why ? '<span class="shwhy">（' + (why === '参加' ? '山行に参加' : '山行の係') + '）</span>' : '') + '</label></td>' +
           '<td class="shrole"><select onchange="shitamiRole_(\'' + q + '\', this.value)">' +
             shitamiRoleOpts_(S.role[nm] || '同行') + '</select></td></tr></table>';
  };
  for (i = 0; i < hn.length; i++){ inH[hn[i].name] = 1; rows += chk(hn[i].name, hn[i].why); }
  var others = '', all = realMembers_();
  for (i = 0; i < all.length; i++) if (!inH[all[i]]) others += chk(all[i], '');
  return '<div class="shitami" id="shitami-' + ev.id + '">' +
      '<div class="admsec-h">🔎 下見を入れる</div>' +
      '<label>下見の日</label>' +
      '<input type="date" class="datein" value="' + dkey(S.y, S.m, S.d) + '" onchange="shitamiDate_(this.value)">' +
      '<label>集合の時刻</label>' +
      '<table class="row3"><tr><td>' + hh + '</td><td>' + mm + '</td></tr></table>' +
      '<label>行く方</label>' +
      (rows ? '<p class="note">山行の係の方と「参加」の方に、最初から☑を入れています。右の選び箱で下見の役を選べます（役の無い方は「同行」）。</p>' + rows
            : '<p class="note">山行の係・参加の方がまだいません。下から選んでください。</p>') +
      (others ? '<div class="shsub">ほかの会員（＋αの方は☑）</div>' + others : '') +
      '<button type="button" class="subbtn" onclick="submitShitami()">この内容で下見を登録する</button>' +
      '<button type="button" class="cancelbtn" onclick="openShitami(\'' + ev.id + '\')">やめる</button>' +
    '</div>';
}

function submitShitami(){
  if (!SHITAMI) return;
  var S = SHITAMI, ev = eventOf_(S.evId);
  if (!ev) return;
  var y = parseInt(S.y, 10), m = parseInt(S.m, 10), d = parseInt(S.d, 10);
  var ck = new Date(y, m - 1, d);
  if (ck.getMonth() !== m - 1){ alert('その月に ' + d + '日 はありません。日付を確かめてください'); return; }
  var key = dkey(y, m, d);
  if (key >= ev.date){ alert('下見の日が、山行（' + ev.date + '）と同じか後になっています。日付を確かめてください'); return; }
  var name = getName();
  if (!name){ showNamePick(); return; }
  var names = [];
  for (var nm in S.pick) if (S.pick.hasOwnProperty(nm) && S.pick[nm]) names.push(nm);
  if (!names.length){ alert('行く方を1人以上選んでください'); return; }
  names.sort(byMember_);
  var staff = sortStaffStr(names.map(function(n){ return (S.role[n] || '同行') + '：' + n; }).join('、'));
  var time = S.h !== '' ? S.h + ':' + S.mi : '';
  var title = '下見 ' + ev.title;

  /* 届く相手と、届かない方（予定を入れる画面と同じ知らせ方） */
  var who = targetNamesFor_('係のみ', staff, name);
  var q = '「' + title + '」を ' + m + '月' + d + '日 に登録します。\n\n■ 行く方：' + names.join('、') + '\n' +
          '■ お知らせが届くのは、行く方とあなた（' + who.length + '人）だけです。\n';
  var miss = lineMissing_(who);
  if (miss && miss.length) q += '■ このうち LINEでは届かない方：' + miss.join('、') + '\n';
  var none = unreachable_(who);
  if (none && none.length) q += '■ どの手段でも届かない方：' + none.join('、') + '（お口ぞえが要ります）\n';
  if (!confirm(q + '\nよろしいですか？')) return;

  var tid = 'tmp' + new Date().getTime() + '_0';
  var memo = fmtDateTxt_(ev.date) + '「' + ev.title + '」の下見';
  state.events.push({ id: tid, date: key, title: title, time: time, place: ev.place || '', memo: memo,
    staff: staff, owner: name, ownerId: idOf(name), target: '係のみ', plan: '', report: '', lineGroup: '',
    mycar: '1', locked: '', settle: '', cancelled: '', cancelNote: '' });
  post({ action: 'addEvents', dates: [key], title: title, time: time, place: ev.place || '', staff: staff,
         target: '係のみ', memo: memo, plan: '', report: '', lineGroup: '', mycar: '1', mail: true, owner: name },
       '下見を登録しました（' + m + '月' + d + '日）', null, function(){
    state.events = state.events.filter(function(e3){ return e3.id !== tid; });
    render();
  });
  var back = S.evId;
  SHITAMI = null;
  render();
  try { backToEv_(back); } catch (eB){}
}

/* 「11月12日」のような字（HTMLを含まない） */
function fmtDateTxt_(key){
  var p = String(key || '').split('-');
  return (+p[1]) + '月' + (+p[2]) + '日';
}

function setMailRow(isEdit){
  var r = $('addMailRow');
  if (r) r.style.display = isEdit ? 'none' : 'block';
}

function openAddForm(y, m, d){
  $('addCard').style.display = 'block';
  /* ★2026-09-03　開いた時点で、種類の選択肢と「誰に届くか」を作り直す */
  try { fillTargetSelect_(); } catch (e) {}
  $('showAdd').style.display = 'none';
  fillDateSelects(y, m, d);
  if (!$('addHour').innerHTML) fillTimeSelects();
  resetStaff();
  try { shitamiRowSync_(); } catch (eS) {}   /* ★2026-09-29p */
  try { linksBoxSync_(); } catch (eL) {}
  if ($('addCard').scrollIntoView) $('addCard').scrollIntoView(true);
}

function closeAddForm(){
  $('addCard').style.display = 'none';
  $('showAdd').style.display = 'block';
  $('addTitle').value = '';
  $('addHour').value = '';
  $('addMin').value = '00';
  $('addPlace').value = '';
  resetStaff();
  $('addMemo').value = '';
  $('addPlan').value = '';
  $('addReport').value = '';
  $('addLineGroup').value = '';
  if ($('addMycar')) $('addMycar').checked = false;   /* ★2026-09-29i */
  if ($('addShitami')) $('addShitami').checked = false;   /* ★2026-09-29p */
  try { linksBoxSync_(false); } catch (eL) {}
  $('addRep').value = 'none';
  $('repLenWrap').style.display = 'none';
  closePicker();
  editingId = '';
  setMailRow(false);
  $('addTitleH').innerHTML = '予定を追加';
  $('addBtn').innerHTML = 'この内容で登録する';
  $('repRow').style.display = 'block';
}

/* ★★2026-09-29j　「編集」を閉じたら（保存しても、やめても）、元の予定の場所へ戻ります。
   　これまでは入力画面へ飛んだまま戻らず、どの予定を直したのか探し直す必要がありました。
   　・日付を変えた予定は、変えた先の月へ移って、その予定を出します。
   　・終わって3日過ぎて隠れている予定なら、表示してから移ります。
   　・サーバーの返事が届くと画面を作り直すので、8秒の間は合わせ直します（gotoStick）。 */
function backToEv_(id){
  if (!id) return;
  var ev = null;
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === id) ev = state.events[i];
  }
  if (!ev) return;
  var p = String(ev.date || '').split('-');
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (y && m && (y !== state.year || m !== state.month)){
    state.year = y; state.month = m;
    render();
  }
  if (!$('ev-' + id) && !state.showOldEvents){
    state.showOldEvents = true;
    renderList();
  }
  scrollToEv(id);
  gotoStick = id;
  setTimeout(function(){ if (gotoStick === id) gotoStick = ''; }, 8000);
}

/* 入力画面の「やめる」。編集中だったなら、その予定へ戻ります（★2026-09-29j） */
function cancelAddForm_(){
  var id = editingId;
  closeAddForm();
  if (id) backToEv_(id);
}

function editEvent(evId){
  var ev = null;
  for (var i = 0; i < state.events.length; i++){
    if (state.events[i].id === evId) ev = state.events[i];
  }
  if (!ev) return;
  var p = ev.date.split('-');
  openAddForm(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
  editingId = evId;
  setMailRow(true);   /* 変更のときはメールを送らない（何度も届かないように） */
  $('addTitleH').innerHTML = '予定を変更';
  $('addBtn').innerHTML = '変更を保存する';
  $('repRow').style.display = 'none';
  $('addTitle').value = ev.title;
  $('addPlace').value = ev.place;
  parseStaff(ev.staff || '');
  $('addMemo').value = ev.memo;
  $('addPlan').value = ev.plan || '';
  $('addReport').value = ev.report || '';
  $('addLineGroup').value = ev.lineGroup || '';
  if ($('addMycar')) $('addMycar').checked = !!ev.mycar;   /* ★2026-09-29i */
  if ($('addShitami')) $('addShitami').checked = false;   /* ★2026-09-29p */
  try { shitamiRowSync_(); } catch (eS) {}
  try { linksBoxSync_(!!(ev.plan || ev.report || ev.lineGroup)); } catch (eL) {}   /* 入っていれば開いておく */
  $('addHour').value = '';
  $('addMin').value = '00';
  var tm = ev.time ? ev.time.match(/(\d{1,2}):(\d{2})/) : null;
  if (tm){
    $('addHour').value = String(parseInt(tm[1], 10));
    $('addMin').value = tm[2];
    if ($('addMin').value !== tm[2]){
      /* 5分きざみ以外の分は選択肢を足して保持 */
      $('addMin').innerHTML += '<option value="' + tm[2] + '">' + tm[2] + '分</option>';
      $('addMin').value = tm[2];
    }
  }
}

function fillTimeSelects(){
  var html = '<option value="">時間なし</option>';
  for (var h = 0; h <= 23; h++){
    html += '<option value="' + h + '">' + h + '時</option>';
  }
  $('addHour').innerHTML = html;
  html = '';
  for (var mi = 0; mi < 60; mi += 5){
    var mv = (mi < 10 ? '0' : '') + mi;
    html += '<option value="' + mv + '">' + mv + '分</option>';
  }
  $('addMin').innerHTML = html;
}

function fillDateSelects(y, m, d){
  var now = new Date();
  var thisY = now.getFullYear();
  var y0 = Math.min(thisY, y);
  var y1 = Math.max(thisY + 1, y);
  var html = '', i;
  for (i = y0; i <= y1; i++){
    html += '<option value="' + i + '"' + (i === y ? ' selected' : '') + '>' + i + '年</option>';
  }
  $('addY').innerHTML = html;
  html = '';
  for (i = 1; i <= 12; i++){
    html += '<option value="' + i + '"' + (i === m ? ' selected' : '') + '>' + i + '月</option>';
  }
  $('addM').innerHTML = html;
  html = '';
  for (i = 1; i <= 31; i++){
    html += '<option value="' + i + '"' + (i === d ? ' selected' : '') + '>' + i + '日</option>';
  }
  $('addD').innerHTML = html;
  if ($('addDate')) $('addDate').value = dkey(y, m, d);   /* ★2026-09-29o カレンダーにも同じ日 */
}

function submitAdd(){
  var title = $('addTitle').value.replace(/^\s+|\s+$/g, '');
  if (!title){
    alert('山名・タイトルを入れてください');
    return;
  }
  var y = parseInt($('addY').value, 10);
  var m = parseInt($('addM').value, 10);
  var d = parseInt($('addD').value, 10);
  var check = new Date(y, m - 1, d);
  if (check.getMonth() !== m - 1){
    alert('その月に ' + d + '日 はありません。日付を確認してください');
    return;
  }
  var name = getName();
  if (!name){
    showNamePick();
    alert('先に、あなたのお名前を選んでください\n（誰が登録した予定か分かるようにするためです）');
    return;
  }

  /* くり返し設定に応じて日付リストを作る */
  var dates = repeatDates_($('addRep').value, y, m, d,
                          parseInt($('addRepLen').value, 10));

  var time = '';
  if ($('addHour').value !== ''){
    time = $('addHour').value + ':' + $('addMin').value;
  }

  /* 計画表・報告書のリンク（貼るならhttpで始まるURL） */
  var plan = $('addPlan').value.replace(/^\s+|\s+$/g, '');
  var report = $('addReport').value.replace(/^\s+|\s+$/g, '');
  var lineGroup = $('addLineGroup').value.replace(/^\s+|\s+$/g, '');
  if ((plan && plan.indexOf('http') !== 0) || (report && report.indexOf('http') !== 0) ||
      (lineGroup && lineGroup.indexOf('http') !== 0)){
    alert('リンクは https:// で始まるURLを貼り付けてください');
    return;
  }
  /* ★2026-09-29i　マイカー移動の印（'1'＝あり／''＝なし） */
  var mycar = ($('addMycar') && $('addMycar').checked) ? '1' : '';
  /* ★2026-09-29p　下見をする（保存したら、続けて下見の入力を開く） */
  var wantShitami = !!($('addShitami') && $('addShitami').checked && $('shitamiRow').style.display !== 'none');
  if (wantShitami){
    var nw0 = new Date();
    if (dkey(y, m, d) <= dkey(nw0.getFullYear(), nw0.getMonth() + 1, nw0.getDate())){
      alert('下見は山行より前の日に入れます。\nこの山行は今日か過ぎた日なので、「🔎 下見をする」の☑を外してください。');
      return;
    }
  }

  /* 編集モードなら既存の予定を書き換える */
  if (editingId){
    /* 日付が変わったときは、知らせるかどうかを聞く */
    var tellMove = false;
    var oldEv = null;
    for (var oi = 0; oi < state.events.length; oi++){
      if (state.events[oi].id === editingId) oldEv = state.events[oi];
    }
    if (oldEv && oldEv.date !== dkey(y, m, d)){
      tellMove = confirm(
        '日程が ' + oldEv.date + ' から ' + dkey(y, m, d) + ' に変わります。\n\n' +
        'みなさんに知らせますか？\n\n' +
        'OK … メールとLINEで自動的に知らせます\n' +
        'キャンセル … 知らせずに直します\n\n' +
        '※出欠の回答はそのまま残ります');
    }
    /* ------------------------------------------------------------------
       押した瞬間に画面の内容を入れ替えて、送信は裏で行います。
       失敗したときは、控えておいた元の内容に戻します。
       ------------------------------------------------------------------ */
    var editId = editingId, before = null;
    for (var ui2 = 0; ui2 < state.events.length; ui2++){
      var ue = state.events[ui2];
      if (ue.id !== editId) continue;
      before = {};
      for (var kk in ue) { if (ue.hasOwnProperty(kk)) before[kk] = ue[kk]; }
      ue.date  = dkey(y, m, d);
      ue.title = title;
      ue.time  = time;
      ue.place = $('addPlace').value;
      ue.memo  = $('addMemo').value;
      ue.staff = serializeStaff();
      ue.plan  = plan;
      ue.report = report;
      ue.lineGroup = lineGroup;
      ue.mycar = mycar;
    }

    post({
      action: 'updateEvent',
      id: editingId,
      tell: tellMove,
      mail: tellMove,
      date: dkey(y, m, d),
      title: title,
      time: time,
      place: $('addPlace').value,
      staff: serializeStaff(),
      memo: $('addMemo').value,
      plan: plan,
      report: report,
      lineGroup: lineGroup,
      mycar: mycar,
      name: name
    }, '予定を変更しました', null, function(){
      /* 送れなかったときは、元の内容に戻す */
      if (before){
        for (var bi = 0; bi < state.events.length; bi++){
          if (state.events[bi].id === editId) state.events[bi] = before;
        }
        render();
      }
    });
    state.year = y;
    state.month = m;
    closeAddForm();
    render();
    backToEv_(editId);   /* ★2026-09-29j　直した予定の場所へ戻る */
    if (wantShitami) shitamiAfterSave_(editId);   /* ★2026-09-29p */
    return;
  }

  /* ------------------------------------------------------------------
     ★2026-08-25　対象を絞った予定は、クラブのLINEグループへ流さず、
     　対象の方へ直接お送りします。そのため、LINEのお知らせに
     　登録していない対象の方には**何も届きません。**
     　しかもエラーが出ないので気づけません。登録する前にお知らせします。
     ------------------------------------------------------------------ */
  var tgt0 = $('addTarget').value;
  if (tgt0){
    var tnames = targetNamesFor_(tgt0, serializeStaff(), name);
    var tmiss  = lineMissing_(tnames);
    if (tmiss && tmiss.length){
      var wq = 'この予定は「' + targetLabel_(tgt0) + '」だけにお知らせします。\n'
             + 'クラブのLINEグループへは流れません。\n\n'
             + '■ 対象の方：' + tnames.join('、') + '\n'
             + '■ このうち ' + tmiss.length + '人には、LINEでは届きません\n'
             + '　' + tmiss.join('、') + '\n'
             + '　（LINEのお知らせに登録されていません）\n\n'
             + (tmiss.length === tnames.length
                 ? '★対象の方全員に、LINEでは届きません。\n\n'
                 : '');
      /* ★修正8（2026-09-02）　メールも同じ。名簿にアドレスが無い方には届かない。 */
      var tnone = unreachable_(tnames);
      if (tnone && tnone.length){
        wq += '■ このうち ' + tnone.length + '人には、どの手段でも届きません\n'
            + '　' + tnone.join('、') + '\n'
            + '　（LINEにも、名簿のメールアドレスにも登録がありません）\n'
            + '　お口ぞえかお電話が要ります。\n\n';
      }
      wq += 'このまま登録してよろしいですか？';
      if (!confirm(wq)) return;
    }
  }

  /* ------------------------------------------------------------------
     ★★2026-09-22（LINE通数の見える化 2）　全員あての予定は、
     　クラブのLINEグループへ流れます。押す前に、使う通数をお見せします。

     　★何日ぶんまとめて登録しても、LINEは**1回ぶん**です（サーバーが
     　　まとめて1通にしているため）。ここで件数を掛けてはいけません。
     ------------------------------------------------------------------ */
  if (!tgt0 && lineCostOnce_() > 0){
    var cst = lineCostOnce_();
    var q1 = '「' + title + '」を' +
             (dates.length > 1 ? dates.length + '件 ' : '') + '登録します。\n' +
             'クラブのLINEグループへ、お知らせが流れます。\n\n' +
             lineCostLines_(cst) + '\n\n' +
             (dates.length > 1
               ? '※' + dates.length + '件まとめても、LINEは1回ぶん（' + cst + '通）です。\n'
               : '') +
             '※通数を使いたくないときは「やめる」を押して、\n' +
             '　登録後に「LINEグループに貼る（0通）」をお使いください。\n\n' +
             'よろしいですか？';
    if (!confirm(q1)) return;
  }

  /* ------------------------------------------------------------------
     押した瞬間に一覧へ出して、送信は裏で行います（出欠と同じやり方）。
     サーバーはメールとLINEも送るため、返事まで数秒かかります。
     本物が届いたら、この仮の分は自動的に置き換わります。
     ------------------------------------------------------------------ */
  var tmpBase = 'tmp' + new Date().getTime() + '_';
  var tmpIds = [];
  for (var ti = 0; ti < dates.length; ti++){
    var tid = tmpBase + ti;
    tmpIds.push(tid);
    state.events.push({
      id: tid, date: dates[ti], title: title, time: time,
      place: $('addPlace').value, memo: $('addMemo').value,
      staff: serializeStaff(), owner: name, ownerId: idOf(name),
      target: $('addTarget').value,
      plan: plan, report: report, lineGroup: lineGroup, mycar: mycar,
      locked: '', settle: '', cancelled: '', cancelNote: ''
    });
  }

  post({
    action: 'addEvents',
    dates: dates,
    title: title,
    time: time,
    place: $('addPlace').value,
    staff: serializeStaff(),
    target: $('addTarget').value,
    memo: $('addMemo').value,
    plan: plan,
    report: report,
    lineGroup: lineGroup,
    mycar: mycar,
    mail: $('addMail').checked,
    owner: name
  }, '予定を登録しました（' + dates.length + '件）', function(){
    /* 登録できたら、そのままLINEに知らせられるようにする */
    var newest = null;
    for (var si = 0; si < state.events.length; si++){
      var e2 = state.events[si];
      if (e2.date === dates[0] && e2.title === title) newest = e2;
    }
    /* ★2026-09-29p　下見の入力中なら、仮の番号から本物の番号へ付け替え、LINEの案内は場所を動かさずに出す */
    var shOpen = SHITAMI && tmpIds.indexOf(SHITAMI.evId) >= 0;
    if (shOpen && newest){
      SHITAMI.evId = newest.id;
      EV_OPS_OPEN[newest.id] = true;
      renderList();
    }
    if (newest){
      if (shOpen){
        shareText = eventShareText(newest);
        $('sharePrev').innerHTML = esc(shareText);
        $('shareGo').href = 'https://line.me/R/share?text=' + encodeURIComponent(shareText);
        $('shareCard').style.display = 'block';
        try { var f2 = $('shitami-' + newest.id); if (f2) f2.scrollIntoView({ block: 'center' }); } catch (eF2){}
      } else {
        offerShare(eventShareText(newest));
      }
    }
  }, function(){
    /* 送れなかったときは、仮に出していた分を取り消す */
    if (SHITAMI && tmpIds.indexOf(SHITAMI.evId) >= 0) SHITAMI = null;   /* ★2026-09-29p */
    state.events = state.events.filter(function(e3){ return tmpIds.indexOf(e3.id) < 0; });
    render();
  });
  /* 追加した月を表示 */
  state.year = y;
  state.month = m;
  closeAddForm();
  render();
  if (wantShitami) shitamiAfterSave_(tmpIds[0]);   /* ★2026-09-29p　続けて下見の入力を開く */
}

