/* ---------- まとめて登録（管理者用） ----------
   見出し行（「日付」で始まる行）ごと貼り付けると、列名で読み取る。
   決まった列名（日付・タイトル・時間…）以外の列は「係の名前」とみなし、
   例えば「受付」列に「永野」とあれば自動で「受付：永野」を作る */
var IMPORT_FIXED = {
  '日付': 'date',
  '山名・タイトル': 'title', 'タイトル': 'title', '山名': 'title',
  '時間': 'time',
  '集合場所': 'place', '場所': 'place',
  'メモ': 'memo',
  '計画表リンク': 'plan', '計画表': 'plan',
  '報告書リンク': 'report', '報告書': 'report',
  '係・担当': 'staff', '係': 'staff', '担当': 'staff',
  /* ★2026-09-02　種類の列。★ここに入れることで「係あつかい」からも外れる（罠2） */
  /* ★ここに入れることで「係あつかい」から外れる（罠2）。
     　★ただし「対象」は種類としては読まない（ignore）。
     　　内部の値（幹事・管理者 など）が入っていても行を弾かないようにするため。 */
  '種類': 'kind', '対象': 'ignore'
};

function parseImport(text){
  var lines = text.split(/\r\n|\n|\r/);
  var evs = [], errs = [];
  var nowY = new Date().getFullYear();
  var headers = null;

  function trimS(s){ return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }

  for (var i = 0; i < lines.length; i++){
    var line = lines[i].replace(/^\s+|\s+$/g, '');
    if (!line) continue;
    var cols = line.indexOf('\t') >= 0 ? line.split('\t') : line.split(',');
    var dRaw = trimS(cols[0]);

    /* 見出し行なら列名を覚える */
    if (dRaw === '日付'){
      headers = [];
      for (var h = 0; h < cols.length; h++) headers.push(trimS(cols[h]));
      continue;
    }

    /* ★★2026-09-15（工事F）　ひな形に入れた「例」の行は、読んでも登録しない。
       　★エラーにもしない。黙って飛ばす。
       　只隈さんのご指摘：「見出しと例は触れないようにしておいて、
       　　　　　　　　　　その例は予定に登録されないようにすればいいのでは？」
       　★狙いは「消してください」と書かせないこと。消し忘れの事故が起きない。 */
    if (dRaw.indexOf('例') === 0) continue;

    /* 列の値を取り出す（見出しがあれば列名で、なければ位置で） */
    function val(field, defIdx){
      if (headers){
        for (var c = 0; c < headers.length; c++){
          if (IMPORT_FIXED[headers[c]] === field) return trimS(cols[c]);
        }
        return '';
      }
      return trimS(cols[defIdx]);
    }

    var title = val('title', 1);
    var y = 0, mo = 0, d = 0;
    var m = dRaw.match(/^(\d{4})[\/\-年\.](\d{1,2})[\/\-月\.](\d{1,2})日?$/);
    if (m){ y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
      m = dRaw.match(/^(\d{1,2})[\/\-月\.](\d{1,2})日?$/);
      if (m){ y = nowY; mo = +m[1]; d = +m[2]; }
    }
    if (!m || !title){ errs.push((i + 1) + '行目'); continue; }
    var chk = new Date(y, mo - 1, d);
    if (chk.getMonth() !== mo - 1){ errs.push((i + 1) + '行目（日付）'); continue; }
    var time = val('time', 2);
    var tm = time.match(/^(\d{1,2}:\d{2}):\d{2}$/);
    if (tm) time = tm[1];

    /* 係を組み立てる：「係・担当」列＋役割ごとの列（司会・書記・受付など） */
    var staffParts = [];
    var combined = val('staff', 7);
    if (combined) staffParts.push(combined);
    if (headers){
      for (var rc = 0; rc < headers.length && rc < cols.length; rc++){
        var hname = headers[rc];
        if (!hname || IMPORT_FIXED[hname]) continue;
        var v = trimS(cols[rc]);
        if (!v) continue;
        /* 1つの欄に複数人（永野、松田 など）はそれぞれに分ける */
        var nms = v.split(/[、,，・\/／]/);
        for (var ni = 0; ni < nms.length; ni++){
          var n1 = trimS(nms[ni]);
          if (n1) staffParts.push(hname + '：' + n1);
        }
      }
    }

    var evObj = {
      date: dkey(y, mo, d),
      title: title,
      time: time,
      place: val('place', 3),
      memo: val('memo', 4),
      plan: val('plan', 5),
      report: val('report', 6),
      staff: sortStaffStr(staffParts.join('、'))
    };
    /* ★2026-09-02　「種類」の列があるときだけ、対象を決める。
       　列が無い表（いままでの表）を貼ったときは target を付けない＝いまの対象のまま。 */
    if (headers && headers.indexOf('種類') >= 0){
      var kindRaw = val('kind', -1);
      /* ★修正2　種類の欄が空の行は target を付けない。
         　記入漏れで、さきほど絞った対象が黙って「全員」に戻るのを防ぐ。 */
      if (kindRaw){
        var tg0 = kindToTarget_(kindRaw);
        if (tg0 === undefined){
          errs.push((i + 1) + '行目（種類「' + kindRaw + '」が分かりません）');
          continue;
        }
        evObj.target = tg0;
        evObj.kind = kindRaw;   /* ★確認画面に、貼られたままの種類を出すため */
      }
    }
    evs.push(evObj);
  }
  return { events: evs, errors: errs };
}

/* ==================================================================
   ★★2026-09-03　入力表（1行＝1つの予定のパターン）

   　只隈さん：「一件一件入れていたら普通の登録と変わらない。
   　　　　　　　年間行事を一気に、半年先の印刷日程を全部、が要る」
   　くり返し（毎月 第N曜日）と組み合わせて、1行から何件も作ります。
   ================================================================== */
var bulkRows = [];

function bulkNewRow_(){
  var t = new Date();
  return { date: dkey(t.getFullYear(), t.getMonth() + 1, t.getDate()),
           title: '', time: '', place: '', kind: '', rep: 'none', len: '12', staff: '' };
}

function renderBulkTable(){
  var tb = $('bulkTable');
  if (!tb) return;
  if (!bulkRows.length) bulkRows.push(bulkNewRow_());
  var kinds = kindChoices_();
  var h = '';
  for (var i = 0; i < bulkRows.length; i++){
    var r = bulkRows[i];

    var ko = '<option value="">（山行・集会など、全員）</option>';
    for (var k = 0; k < kinds.length; k++){
      ko += '<option value="' + esc(kinds[k]) + '"' + (r.kind === kinds[k] ? ' selected' : '') + '>' +
            esc(kinds[k]) + '</option>';
    }
    var reps = [['none','くり返さない（1件だけ）'],['week','毎週 同じ曜日'],
                ['monthNth','毎月 第N曜（第3土曜など）'],['monthDay','毎月 同じ日']];
    var ro = '';
    for (var p = 0; p < reps.length; p++){
      ro += '<option value="' + reps[p][0] + '"' + (r.rep === reps[p][0] ? ' selected' : '') + '>' +
            reps[p][1] + '</option>';
    }
    var lens = [['1','1ヶ月ぶん'],['3','3ヶ月ぶん'],['6','半年ぶん'],['12','1年ぶん']];
    var lo = '';
    for (var q = 0; q < lens.length; q++){
      lo += '<option value="' + lens[q][0] + '"' + (r.len === lens[q][0] ? ' selected' : '') + '>' +
            lens[q][1] + '</option>';
    }

    h += '<div class="bcard">' +
      '<div class="bcard-h"><b>' + (i + 1) + '件目</b>' +
        '<button type="button" class="refbtn bcard-x" onclick="bulkDel(' + i + ')">この件を消す</button></div>' +

      '<div class="brow" style="margin-top:9px">' +
        '<div class="bfield" style="flex:2 1 180px"><label>日付</label>' +
          '<input type="date" value="' + esc(r.date) + '" onchange="bulkChg(' + i + ',\'date\',this.value)"></div>' +
        '<div class="bfield" style="flex:1 1 110px"><label>時間</label>' +
          '<input type="text" value="' + esc(r.time) + '" placeholder="7:00" onchange="bulkChg(' + i + ',\'time\',this.value)"></div>' +
      '</div>' +

      '<div class="bfield"><label>タイトル</label>' +
        '<input type="text" value="' + esc(r.title) + '" placeholder="例：定例集会" onchange="bulkChg(' + i + ',\'title\',this.value)"></div>' +

      '<div class="bfield"><label>集合場所</label>' +
        '<input type="text" value="' + esc(r.place) + '" placeholder="例：えるる 駐車場" onchange="bulkChg(' + i + ',\'place\',this.value)"></div>' +

      '<div class="bfield"><label>種類（＝誰に届くか）</label>' +
        '<select onchange="bulkChg(' + i + ',\'kind\',this.value)">' + ko + '</select>' +
        '<div class="bhint" id="bwho' + i + '"></div></div>' +

      '<div class="bfield"><label>くり返し</label>' +
        '<select onchange="bulkChg(' + i + ',\'rep\',this.value)">' + ro + '</select></div>' +

      '<div class="bfield" id="blenwrap' + i + '"><label>いつまで作るか</label>' +
        '<select onchange="bulkChg(' + i + ',\'len\',this.value)">' + lo + '</select></div>' +

      '<div class="bhint" id="bdates' + i + '"></div>' +

      '<div class="bfield"><label>係・担当（いなければ空のまま）</label>' +
        '<input type="text" value="' + esc(r.staff) + '" placeholder="' + esc('例：' + (staffRoles_()[0] || '係') + '：山田') + '" onchange="bulkChg(' + i + ',\'staff\',this.value)"></div>' +

      '</div>';
  }
  tb.innerHTML = h;
  for (var u = 0; u < bulkRows.length; u++) updateBulkCard_(u);
  refreshBulkPreview();
}

/* ★★2026-09-04　その場で「誰に届くか」と「何件できるか」を出す。
   　只隈さんのご指摘：あしあと印刷を選んでも何も起きない（＝画面が何も言わない）。
   　選んだ内容は覚えていたが、それが目に見えていなかった。 */
function updateBulkCard_(i){
  var r = bulkRows[i];
  if (!r) return;

  /* --- 誰に届くか --- */
  var w = document.getElementById('bwho' + i);
  if (w){
    var tg = kindToTarget_(r.kind);
    var txt = '', ng = false;
    if (tg === undefined){
      txt = '★種類「' + r.kind + '」が分かりません'; ng = true;
    } else {
      var who = targetNamesFor_(tg, String(r.staff || ''), getName());
      if (!r.kind){
        txt = '→ 全員（' + who.length + '名）に届きます';
      } else if (!who.length){
        txt = '★このままでは、どなたにも届きません'; ng = true;
      } else {
        txt = '→ ' + who.join('・') + ' の' + who.length + '名に届きます';
      }
      var mw = String(tg).match(/^作業[:：](.+)$/);
      if (mw){
        var wl = workMembers_(mw[1]), all = realMembers_(), bad = [];
        for (var b = 0; b < wl.length; b++){ if (all.indexOf(wl[b]) < 0) bad.push(wl[b]); }
        if (!wl.length){
          txt += '　★作業「' + mw[1] + '」にメンバーが入っていません'; ng = true;
        } else if (bad.length){
          txt += '　★' + bad.join('・') + ' が名簿にありません（その方には届きません）'; ng = true;
        }
      } else if (tg === '係のみ' && !String(r.staff || '')){
        txt += '　★係・担当の欄が空です'; ng = true;
      }
      if (r.kind && who.length){
        var nn = unreachable_(who);
        if (nn && nn.length) txt += '　★LINEもメールも登録が無い方：' + nn.join('・');
      }
    }
    w.className = 'bhint' + (ng ? ' ng' : '');
    w.innerHTML = esc(txt);
  }

  /* --- くり返しで、いつ・何件できるか --- */
  var lw = document.getElementById('blenwrap' + i);
  if (lw) lw.style.display = (r.rep && r.rep !== 'none') ? '' : 'none';
  var dv = document.getElementById('bdates' + i);
  if (dv){
    dv.className = 'bhint';
    if (!r.rep || r.rep === 'none'){
      dv.innerHTML = '';
    } else {
      var md = String(r.date || '').split('-');
      if (md.length !== 3){
        dv.className = 'bhint ng';
        dv.innerHTML = esc('★先に日付を入れてください');
      } else {
        var ds = repeatDates_(r.rep, +md[0], +md[1], +md[2], parseInt(r.len, 10));
        var sh = [];
        for (var k2 = 0; k2 < ds.length && k2 < 8; k2++){
          var pp = ds[k2].split('-');
          sh.push((+pp[1]) + '/' + (+pp[2]));
        }
        dv.innerHTML = esc('→ この1件から ' + ds.length + '件できます： ' + sh.join('　') +
                           (ds.length > 8 ? '　ほか' + (ds.length - 8) + '件' : ''));
      }
    }
  }
}

function bulkChg(i, k, v){
  if (!bulkRows[i]) return;
  bulkRows[i][k] = v;
  updateBulkCard_(i);      /* ★2026-09-04　選んだ結果を、その場に出す */
  refreshBulkPreview();
}
function bulkDel(i){ bulkRows.splice(i, 1); renderBulkTable(); }
function bulkAddRow(){ bulkRows.push(bulkNewRow_()); renderBulkTable(); }

/* 表 → 予定の配列（くり返しをここで展開する） */
function bulkBuildList_(){
  var out = [], errs = [];
  for (var i = 0; i < bulkRows.length; i++){
    var r = bulkRows[i];
    var ttl = String(r.title || '').replace(/^\s+|\s+$/g, '');
    if (!ttl && !r.place && !r.time) continue;          /* 空の行は飛ばす */
    if (!ttl){ errs.push((i + 1) + '行目（タイトルが空です）'); continue; }
    var md = String(r.date || '').split('-');
    if (md.length !== 3){ errs.push((i + 1) + '行目（日付）'); continue; }
    var tg = kindToTarget_(r.kind);
    if (tg === undefined){ errs.push((i + 1) + '行目（種類「' + r.kind + '」が分かりません）'); continue; }
    var ds = repeatDates_(r.rep, +md[0], +md[1], +md[2], parseInt(r.len, 10));
    for (var j = 0; j < ds.length; j++){
      var ev = { date: ds[j], title: ttl, time: String(r.time || ''),
                 place: String(r.place || ''), memo: '', plan: '', report: '',
                 staff: String(r.staff || '') };
      if (r.kind) { ev.target = tg; ev.kind = r.kind; }
      out.push(ev);
    }
  }
  return { events: out, errors: errs };
}

function refreshBulkPreview(){
  var el = $('bulkPreview');
  if (!el) return;
  var b = bulkBuildList_();
  if (b.errors.length){ el.innerHTML = esc('★' + b.errors.join('、')); return; }
  if (!b.events.length){ el.innerHTML = ''; return; }
  var by = {};
  for (var i = 0; i < b.events.length; i++){
    var e = b.events[i];
    if (!by[e.title]) by[e.title] = [];
    var p = e.date.split('-');
    by[e.title].push((+p[1]) + '/' + (+p[2]));
  }
  var t = '★ぜんぶで ' + b.events.length + '件の予定ができます\n';
  for (var k in by){ if (by[k]){
    var ds = by[k];
    t += '　' + k + ' ' + ds.length + '件： ' + ds.slice(0, 12).join('　') +
         (ds.length > 12 ? '　ほか' + (ds.length - 12) + '件' : '') + '\n';
  } }
  el.innerHTML = esc(t).replace(/\n/g, '<br>');
}

function submitBulkTable(){
  var name = getName();
  if (!name){ alert('先に、あなたのお名前を選んでください'); return; }
  var b = bulkBuildList_();
  if (b.errors.length > 0){ alert('直していただく行があります：' + b.errors.join('、')); return; }
  if (!b.events.length){ alert('登録する予定がありません。表に書いてください'); return; }
  confirmAndPostEvents_(b.events, name);
}

function submitImport(){
  var name = getName();
  if (!name){ alert('先に、あなたのお名前を選んでください'); return; }
  var r = parseImport($('importText').value);
  if (r.errors.length > 0){
    alert('読み取れない行があります：' + r.errors.join('、') + '\n「日付、タイトル、時間…」の順になっているか確認してください');
    return;
  }
  if (r.events.length === 0){ alert('登録する予定がありません。表を貼り付けてください'); return; }
  confirmAndPostEvents_(r.events, name);
}

/* ★確認画面と送信。貼り付け・入力表のどちらからも使う */
function confirmAndPostEvents_(events, name){
  /* 同じ予定（日付＋タイトル）が2回あれば、後の行を採用 */
  var list = [], i2, j2;
  for (i2 = 0; i2 < events.length; i2++){
    var ne = events[i2];
    var repl = false;
    for (j2 = 0; j2 < list.length; j2++){
      if (list[j2].date === ne.date && list[j2].title === ne.title){ list[j2] = ne; repl = true; break; }
    }
    if (!repl) list.push(ne);
  }

  /* ==================================================================
     ★2026-09-02　確認画面を作り直した。

     　これまでは「1件目：…」しか出ず、4件貼れば2〜4件目は見えないまま
     　「はい」を押すことになっていた。上書きされる予定も名指ししていない。
     　★全件・新規/上書きの別・届く相手のお名前・通数を出す。
     ================================================================== */
  var newList = [], ovList = [], warn = [], total = 0, over = 0, solo = false;
  /* ★修正5（2026-09-02　只隈さん）　LINEのお知らせに登録していない方には、
     　絞った予定は何も届かない（クラブのLINEグループへ流れないため）。
     　個別追加には前からこの警告があるのに、まとめて登録の確認画面には無かった。 */
  var missAll = [], missTotal = 0, noneAll = [];
  for (i2 = 0; i2 < list.length; i2++){
    var it2 = list[i2], isOver = false;
    for (j2 = 0; j2 < state.events.length; j2++){
      if (state.events[j2].date === it2.date && state.events[j2].title === it2.title){ isOver = true; break; }
    }
    var tg2  = (typeof it2.target !== 'undefined') ? it2.target : '';
    var who2 = targetNamesFor_(tg2, it2.staff, name);
    total += who2.length;
    var toStr = !tg2 ? ('全員へ（' + who2.length + '名）')
              : (who2.length ? (who2.join('・') + ' の' + who2.length + '名へ') : '★届く方がいません');
    /* ★修正5　絞った予定だけ。全員あてはLINEグループへ流れるので、ここでは数えない。 */
    if (tg2){
      var ms2 = lineMissing_(who2);
      if (ms2 && ms2.length){
        missTotal += ms2.length;
        for (var q2 = 0; q2 < ms2.length; q2++){
          if (missAll.indexOf(ms2[q2]) < 0) missAll.push(ms2[q2]);
        }
        toStr += '（うち ' + ms2.length + '名は LINE未登録）';
      }
      /* ★修正8　LINEもメールも無い方は、どの手段でも届かない */
      var nn2 = unreachable_(who2);
      if (nn2 && nn2.length){
        for (var r2 = 0; r2 < nn2.length; r2++){
          if (noneAll.indexOf(nn2[r2]) < 0) noneAll.push(nn2[r2]);
        }
        if (nn2.length === who2.length){
          warn.push('・' + it2.title + '：★対象の方全員に、LINEもメールも届きません');
        }
      }
    }
    /* ★貼られた種類をそのまま出す。無ければ対象から逆算する。 */
    var kd2 = it2.kind || targetToKind_(tg2);
    var md2 = it2.date.split('-');
    var ln2 = '　' + (+md2[1]) + '/' + (+md2[2]) + '　' + it2.title +
              (kd2 ? '　［' + kd2 + '］' : '') + '　→ ' + toStr;
    if (isOver){ ovList.push(ln2); over++; } else { newList.push(ln2); }

    /* ★5-A　届く方がいなくなる形を、押す前に知らせる */
    var mwc = String(tg2).match(/^作業[:：](.+)$/);
    if (mwc){
      var wlc = workMembers_(mwc[1]);
      if (!wlc.length){
        warn.push('・' + it2.title + '：作業「' + mwc[1] + '」にメンバーが入っていません');
      } else {
        /* ★修正3　マスタの名字が名簿にない（打ち間違い）を、押す前に知らせる */
        var allc = realMembers_(), badc = [];
        for (var b0 = 0; b0 < wlc.length; b0++){
          if (allc.indexOf(wlc[b0]) < 0) badc.push(wlc[b0]);
        }
        if (badc.length) warn.push('・' + it2.title + '：作業「' + mwc[1] + '」の ' +
          badc.join('・') + ' が名簿にありません（その方には届きません）');
      }
    } else if (tg2 === '係のみ' && !String(it2.staff || '')){
      warn.push('・' + it2.title + '：係・担当の欄が空です');
    }
    /* ★届く方がご本人だけ（またはございません）なら、結果から直接判定する */
    if (who2.length <= 1){
      solo = true;
      if (!mwc && tg2 !== '係のみ'){
        warn.push('・' + it2.title + '：届く方が' + who2.length + '名しかいません');
      }
    }
  }

  var msg = list.length + '件の予定を登録します。\n';
  if (newList.length) msg += '\n【新しく入る予定】' + newList.length + '件\n' + newList.join('\n') + '\n';
  if (ovList.length)  msg += '\n【すでにある予定を書き換えます】' + ovList.length + '件\n' + ovList.join('\n') +
                             '\n　　※出欠のご回答はそのまま残ります\n';
  msg += '\n出欠をお願いする方：のべ' + total + '名';
  /* ★★2026-09-22（LINE通数の見える化 2）　実物に合わせて書き直しました。
     　このやり方（Excel貼り付けのまとめて登録）は、サーバー側で
     　★メールもLINEも1通も送っていません（actImportEvents_ を実機のコードで確認）。
     　これまでは「お知らせが届く数：のべ○名（LINEは今月あと○通）」と出ていて、
     　自動で知らせが行くように読めました。★通数は1通も使いません。 */
  msg += '\n★このやり方では、メールもLINEも自動では送りません（LINEは0通）。' +
         '\n　登録したあと、予定の「LINEグループに貼る（0通）」でお知らせください。';
  /* ★修正5　LINE未登録の方を、押す前に名指しでお見せする */
  if (missAll.length){
    msg += '\n★このうち のべ' + missTotal + '名分は、LINEでは届きません\n' +
           '　LINEのお知らせに登録されていない方：' + missAll.join('・') + '\n' +
           '　（絞った予定はクラブのLINEグループへ流れないため、エラーも出ずに届きません）\n' +
           '　この方々には、名簿にアドレスがあればメールで届きます。';
  }
  /* ★修正8　LINEもメールも無い方を、いちばんはっきりお見せする */
  if (noneAll.length){
    msg += '\n★★どの手段でも届かない方：' + noneAll.join('・') + '\n' +
           '　（LINEのお知らせにも、名簿のメールアドレスにも登録がありません）\n' +
           '　お口ぞえかお電話が要ります。';
  }
  msg += '\n\nまちがえても、あとから直せます・消せます';
  if (warn.length){
    msg += '\n\n★ご確認ください\n' + warn.join('\n');
    if (solo) msg += '\n　種類と、作業のメンバー・係の欄をお確かめください。';
  }
  msg += '\n\n登録してよろしいですか？';
  if (!confirm(msg)) return;
  post({ action: 'importEvents', events: list, owner: name },
    over > 0
      ? '予定を登録しました（新規' + (list.length - over) + '件・上書き' + over + '件）'
      : '予定を登録しました（' + list.length + '件）');
  $('importText').value = '';
  bulkRows = [];
  closeImport();
}

function closeImport(){
  $('importCard').style.display = 'none';
  $('showImport').style.display = 'block';
}

