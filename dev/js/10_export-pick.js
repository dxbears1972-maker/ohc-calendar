/* ---------- 今の予定をコピー（Excel貼り付け用） ----------
   登録済みの予定を、一括登録フォーマットと同じ列の表（タブ区切り）にして
   コピーする。Excelに貼り付けて手直し→コピーして貼り戻せば、
   日付・タイトルの食い違いなく上書き更新できる */
/* ★★2026-09-21（係の名前をクラブごとに）
   　列は「設定」シートの係の名前をそのまま、書いてある順に並べます（決定4）。
   　OHCは16列→21列になります。★貼り戻しは見出しの名前で読むので、列が増えても通ります。 */
function exportRoleCols_(){ return staffRoles_().slice(); }

/* ★★2026-09-15（工事F）　予定がまだ1件も無いクラブ向けの「例」の1行。
   　★見出しだけの表だと、何をどう書けばよいのか分かりません。
   　★この行は `parseImport` が黙って飛ばすので、消さずに残したまま登録できます。
   　★日付を「例）」で始めることが、飛ばす印そのものです（書き換えないでください）。 */
function exportSampleRow_(roleCols){
  var row = ['例）2026/4/5', '高良山', '8:00', '○○公園 駐車場',
             '雨天のときは中止します', '', ''];
  /* 係の列。★一番左の係にだけ例を入れます */
  for (var i = 0; i < roleCols.length; i++) row.push(i === 0 ? '山田' : '');
  row.push('');   /* 係・担当 */
  row.push('');   /* 種類 */
  return row;
}

function buildExportRows(){
  var roleCols = exportRoleCols_();
  var head = ['日付', '山名・タイトル', '時間', '集合場所', 'メモ',
              '計画表リンク', '報告書リンク'].concat(roleCols).concat(['係・担当', '種類']);
  var rows = [head];
  var evs = state.events.slice();
  evs.sort(function(a, b){ return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  for (var i = 0; i < evs.length; i++){
    var ev = evs[i];
    var p = ev.date.split('-');
    var dateStr = (+p[0]) + '/' + (+p[1]) + '/' + (+p[2]);
    /* 係を「決まった列」と「係・担当」列に振り分ける */
    var roleMap = {}, others = [];
    var items = String(ev.staff || '').split(/[、,，]/);
    for (var j = 0; j < items.length; j++){
      var it = items[j].replace(/^\s+|\s+$/g, '');
      if (!it) continue;
      var kv = it.split(/[：:]/);
      var role = (kv[0] || '').replace(/^\s+|\s+$/g, '');
      var nm = (kv[1] || '').replace(/^\s+|\s+$/g, '');
      if (nm && roleCols.indexOf(role) >= 0){
        roleMap[role] = roleMap[role] ? roleMap[role] + '、' + nm : nm;
      } else {
        others.push(it);
      }
    }
    function cl(s){ return String(s == null ? '' : s).replace(/[\t\r\n]+/g, ' '); }
    var row = [dateStr, cl(ev.title), cl(ev.time), cl(ev.place), cl(ev.memo),
               cl(ev.plan), cl(ev.report)];
    for (var k = 0; k < roleCols.length; k++){
      row.push(roleMap[roleCols[k]] || '');
    }
    row.push(others.join('、'));
    /* ★2026-09-02　種類（対象から逆算。空＝山行） */
    row.push(targetToKind_(ev.target));
    rows.push(row);
  }
  /* ★★2026-09-15（工事F）　1件も無いときだけ、書き方の見本を1行入れます。
     　★予定がある方には見本は要らず、見慣れない行が混ざると問い合わせになるため、
     　　0件のときに限ります。 */
  if (evs.length === 0) rows.push(exportSampleRow_(roleCols));
  return { rows: rows, count: evs.length };
}

function buildExportText(){
  var r = buildExportRows();
  var lines = [];
  for (var i = 0; i < r.rows.length; i++) lines.push(r.rows[i].join('\t'));
  return { text: lines.join('\n'), count: r.count };
}

/* 今の予定をExcelファイル(.xlsx)にして保存する */
function exportEventsFile(){
  var r = buildExportRows();
  /* ★★2026-09-15（工事F）　0件でも止めません。見出し＋例の1行のひな形が出ます。
     　★これで「ひな形が見つからず手動で入力いたしました」（8/31の問い合わせ①）が終わります。 */
  loadSheetJS(function(){
    try {
      var ws = XLSX.utils.aoa_to_sheet(r.rows);
      /* 列の幅をほどよく */
      /* ★2026-09-15（工事F）　16列あるのに15個しか無く、「種類」だけ既定の幅でした
         ★★2026-09-21　係の列の数はクラブで変わるので、列の数に合わせて組み立てます */
      var wch = [11, 16, 7, 16, 14, 14, 14];
      for (var rc0 = 0; rc0 < exportRoleCols_().length; rc0++) wch.push(8);
      wch.push(18);   /* 係・担当 */
      wch.push(10);   /* 種類 */
      ws['!cols'] = [];
      for (var i = 0; i < wch.length; i++) ws['!cols'].push({ wch: wch[i] });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '予定入力');
      var now = new Date();
      /* ★2026-09-15（工事F）　中身が見本だけのときは、名前でもそう分かるようにします */
      var fname = (r.count === 0 ? '予定入力のひな形_' : '予定一覧_')
                + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '.xlsx';
      var out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      var blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if (window.showSaveFilePicker){
        /* 保存場所を選べるブラウザ（パソコンのChrome・Edgeなど） */
        window.showSaveFilePicker({
          suggestedName: fname,
          types: [{ description: 'Excelファイル', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
        }).then(function(handle){
          return handle.createWritable().then(function(w){
            return w.write(blob).then(function(){ return w.close(); });
          });
        }).then(function(){
          setStatus(r.count === 0
            ? '入力用のひな形を保存しました（「例」の行は、そのままで大丈夫です）'
            : r.count + '件の予定をExcelファイルに保存しました');
        }).catch(function(e){
          if (e && e.name === 'AbortError') return; /* 保存をやめただけ */
          saveBlobFallback_(blob, fname, r.count);
        });
      } else {
        saveBlobFallback_(blob, fname, r.count);
      }
    } catch (err){
      alert('Excelファイルを作れませんでした。「コピーする」の方をお試しください');
    }
  }, function(msg){ alert(msg); });
}

/* 保存場所を選べないブラウザでは、ふつうのダウンロードにする */
function saveBlobFallback_(blob, fname, count){
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setStatus(count === 0
    ? '入力用のひな形をダウンロードしました（「例」の行は、そのままで大丈夫です）'
    : count + '件の予定をダウンロードしました（ダウンロードフォルダをご確認ください）');
}

function exportEvents(){
  var r = buildExportText();
  /* ★2026-09-15（工事F）　0件でも止めません。見出し＋例の1行がコピーされます */
  function done(){
    alert(r.count === 0
      ? '入力用のひな形をコピーしました。\nExcelのA1を選んで貼り付けてください。\n「例」の行は、そのままにしておいて大丈夫です（登録されません）。'
      : r.count + '件の予定をコピーしました。\nExcelの「予定入力」シートのA1を選んで貼り付けてください。\n手直ししたら、見出し行ごとコピーして「まとめて登録」の欄に貼り戻せばOKです。');
  }
  function fallback(){
    /* コピーできない環境では、貼り付け欄に表を出して手動コピーしてもらう */
    $('importText').value = r.text;
    alert('自動コピーができない環境のようです。\n下の欄に表を出しました。全選択（Ctrl+A）→コピー（Ctrl+C）でExcelに貼り付けてください。\n※このまま「まとめて登録する」は押さないでください');
  }
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(r.text).then(done, fallback);
  } else {
    fallback();
  }
}

/* ---------- ファイルから読み込み（ドロップ・参照） ----------
   Excel(.xlsx)やCSVのファイルを、コピー＆貼り付けの代わりに
   そのまま読み込んで貼り付け欄に展開する */

/* Excel読み込み用の部品（SheetJS）を、必要になった時だけ取り寄せる */
function loadSheetJS(ok, ng){
  if (window.XLSX){ ok(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = ok;
  s.onerror = function(){ ng('Excel読み込み用の部品を取得できませんでした。通信状態を確認するか、Excelからコピー＆貼り付けでお試しください'); };
  document.head.appendChild(s);
}

/* Excelのセルの値を文字にする（日付・時刻のセルに対応） */
function xcell(v){
  if (v == null) return '';
  if (v instanceof Date){
    if (v.getFullYear() < 1905){
      /* 時刻だけのセル（Excel内部では1900年ごろの日付になる） */
      var mm = v.getMinutes();
      return v.getHours() + ':' + (mm < 10 ? '0' : '') + mm;
    }
    return v.getFullYear() + '/' + (v.getMonth() + 1) + '/' + v.getDate();
  }
  return String(v).replace(/[\t\r\n]+/g, ' ');
}

function fileToTable(file){
  var name = String(file.name || '');
  var isExcel = /\.(xlsx|xlsm)$/i.test(name);

  function apply(text, rows){
    $('importText').value = text;
    setStatus('「' + name + '」を読み込みました（' + rows + '行）');
    alert('「' + name + '」を読み込みました（見出しを除いて' + rows + '行）。\n下の欄の内容を確認して「まとめて登録する」を押してください');
  }

  if (isExcel){
    loadSheetJS(function(){
      var fr = new FileReader();
      fr.onload = function(e){
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
          var ws = wb.Sheets['予定入力'] || wb.Sheets[wb.SheetNames[0]];
          var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
          var lines = [];
          for (var i = 0; i < rows.length; i++){
            var cells = [], empty = true;
            for (var j = 0; j < rows[i].length; j++){
              var t = xcell(rows[i][j]);
              if (t !== '') empty = false;
              cells.push(t);
            }
            if (!empty) lines.push(cells.join('\t'));
          }
          if (lines.length === 0){ alert('ファイルに読み取れる行がありませんでした'); return; }
          apply(lines.join('\n'), Math.max(0, lines.length - 1));
        } catch (err){
          alert('Excelファイルを読み込めませんでした。Excelで開いてコピー＆貼り付けでお試しください');
        }
      };
      fr.readAsArrayBuffer(file);
    }, function(msg){ alert(msg); });
  } else {
    /* CSV・TSV：文字コードはUTF-8とShift_JIS（Excelの標準）の両方に対応 */
    var fr2 = new FileReader();
    fr2.onload = function(e){
      var buf = e.target.result;
      var text = '';
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
      catch (e2){
        try { text = new TextDecoder('shift_jis').decode(buf); }
        catch (e3){ text = new TextDecoder('utf-8').decode(buf); }
      }
      text = text.replace(/^\uFEFF/, '');
      var n = text.split(/\r\n|\n|\r/).filter(function(l){ return l.replace(/[\s,\t]/g, '') !== ''; }).length;
      if (n === 0){ alert('ファイルに読み取れる行がありませんでした'); return; }
      apply(text, Math.max(0, n - 1));
    };
    fr2.readAsArrayBuffer(file);
  }
}

/* ---------- ファイル参照（Googleドライブ） ---------- */
var pickTarget = '';

function openPicker(target){
  pickTarget = target;
  var card = $('pickerCard');
  /* 押した「参照」ボタンの行のすぐ下に一覧を出す */
  try {
    var input = (target === 'report') ? $('addReport') : $('addPlan');
    var row = input.closest ? input.closest('table') : null;
    if (row && row.parentNode) row.parentNode.insertBefore(card, row.nextSibling);
  } catch(e){}
  card.style.display = 'block';
  loadPickerFolder(lsGet(LSK.pickDir) || '');
}

function closePicker(){
  $('pickerCard').style.display = 'none';
}

function byName_(a, b){
  return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
}

function loadPickerFolder(folderId){
  $('pickerList').innerHTML = '<p class="note">読み込み中…</p>';
  api('POST', { action: 'listFiles', folderId: folderId }, function(err, data){
    if (err || !data || data.error || !data.folderId){
      $('pickerList').innerHTML = '<p class="note">読み込みに失敗しました。もう一度「参照」を押してください。' +
        (data && data.error ? '<br>詳細：' + esc(data.error) : '') +
        (data && !data.error && !data.folderId ? '<br>詳細：GASが古いバージョンのままの可能性があります（新バージョンでデプロイしてください）' : '') +
        '</p>';
      return;
    }
    lsSet(LSK.pickDir, data.folderId);
    $('pickerPath').innerHTML = '📁 「' + esc(data.folderName) + '」の中から選んでください';
    var html = '';
    if (data.parentId){
      html += '<button type="button" class="pickitem" onclick="loadPickerFolder(\'' + data.parentId + '\')">⬆ 上のフォルダへ戻る</button>';
    }
    if (data.baseId && data.folderId !== data.baseId){
      html += '<button type="button" class="pickitem" onclick="loadPickerFolder(\'' + data.baseId + '\')">🏠 「山行」フォルダに戻る</button>';
    }
    var folders = data.folders || [];
    var files = data.files || [];
    folders.sort(byName_);
    files.sort(byName_);
    var i;
    for (i = 0; i < folders.length; i++){
      html += '<button type="button" class="pickitem" onclick="loadPickerFolder(\'' + folders[i].id + '\')">📁 ' + esc(folders[i].name) + '</button>';
    }
    for (i = 0; i < files.length; i++){
      html += '<button type="button" class="pickitem" onclick="pickFile(\'' + files[i].id + '\')">📄 ' + esc(files[i].name) + '</button>';
    }
    if (folders.length === 0 && files.length === 0){
      html += '<p class="note">このフォルダは空です。Googleドライブでこのフォルダにファイルを入れてください。</p>';
    }
    $('pickerList').innerHTML = html;
  });
}

function pickFile(fileId){
  $('pickerList').innerHTML = '<p class="note">リンクを取得しています…</p>';
  api('POST', { action: 'pickFile', fileId: fileId }, function(err, data){
    if (err || !data || !data.url){
      $('pickerList').innerHTML = '<p class="note">取得に失敗しました。もう一度お試しください。</p>';
      return;
    }
    $(pickTarget === 'report' ? 'addReport' : 'addPlan').value = data.url;
    closePicker();
    if (data.shared === false){
      setStatus('「' + data.name + '」を入れましたが、共有設定を変更できませんでした。このままだと開けない人が出ます。Googleドライブでこのファイルを「リンクを知っている全員（閲覧者）」にしてください', true);
    } else {
      setStatus('「' + data.name + '」を' + (pickTarget === 'report' ? '報告書' : '計画表') + 'に入れました');
    }
  });
}

