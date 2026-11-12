/* ============================================================================
 * 根系统（以及各层通用）应用：文件管理器、电子表格、小组件、设置、任务/进程管理器、
 * Chromium 浏览器、文本与程序编辑器。根系统可由宿主直接实现，这些应用是系统状态的视图。
 * ========================================================================== */
(function (OS) {
  'use strict';
  const rt = OS.rt, ui = OS.ui, U = OS.util, esc = U.escapeHtml, icon = ui.icon, att = ui.att, setHTML = ui.setHTML;
  const clone = U.deepClone;

  function blankWorkbook() { return { format: 'npl-sheet-1', name: '未命名', rows: 24, cols: 10, cells: {}, colWidths: {}, numberFormat: {} }; }
  function notifyFile(sys, title, body) { rt.notify(sys, title, body); }
  function pushClip(sys, text) { sys.clipboardHistory.unshift({ text, at: Date.now() }); if (sys.clipboardHistory.length > 30) sys.clipboardHistory.pop(); }

  // ================================================================ 文件管理器
  ui.registerApp('files', {
    w: 860, h: 520, title: '文件管理器',
    mount(sys, win) { if (!win.extra.cwd) win.extra.cwd = '/Documents'; if (!win.extra.sel) win.extra.sel = []; },
    update(sys, win, body, rec) {
      const cwd = win.extra.cwd;
      const recycle = cwd === '/__recycle';
      // 子系统：把目录请求交给文件管理程序（可编辑排序规则），界面使用其产出
      if (sys.filemgrPid && sys.procs[sys.filemgrPid] && !recycle) {
        if (rec._listKey !== cwd) { rec._listKey = cwd; rt.injectMessage(sys, sys.filemgrPid, { kind: 'list', path: cwd }); }
      }
      const fm = sys.display && sys.display['__files'] && sys.display['__files'].files;
      let items;
      if (recycle) items = sys.fs.recycle.map((f, i) => ({ path: f.path, name: f.name, type: 'file', mime: f.mime, size: 0, rindex: i }));
      else if (sys.parentId && fm && fm.path === cwd && fm.items) items = fm.items.map((x) => Object.assign({}, x));
      else items = rt.fs.list(sys.fs, cwd).map((x) => Object.assign({}, x));
      for (const it of items) if (it.rindex === undefined) it.rindex = -1;

      const nav = [
        ['/Documents', '文档', 'folder'], ['/Downloads', '下载', 'folder'], ['/Demo', 'Demo', 'folder'],
        ['/Programs', '程序', 'folder'], ['/System', '系统', 'folder'], ['/Kernels', '内核', 'folder'],
        ['/Wallpapers', '壁纸', 'folder'], ['/__recycle', '回收站', 'trash'],
      ].map(([p, label, ico]) => '<div class="files-nav' + (cwd === p ? ' on' : '') + '" data-testid="files-nav" data-act="files-nav" ' +
        att(sys, win, 'data-file-path="' + p + '"') + '>' + icon(ico) + ' ' + label + '</div>').join('');

      const crumbs = cwd.split('/').filter(Boolean).map((seg, i, arr) =>
        '<span class="fp-seg" data-act="files-nav" ' + att(sys, win, 'data-file-path="/' + arr.slice(0, i + 1).join('/') + '"') + '>' + esc(seg) + '</span>').join('<span class="muted">›</span>');

      const rows = items.map((it, i) => {
        const isDir = it.type === 'dir';
        const ico = isDir ? 'folder' : it.mime === 'program' ? 'program' : it.mime === 'scene' ? 'scene' : it.mime === 'sheet' ? 'sheet' : 'file';
        const sel = win.extra.sel.indexOf(it.path) >= 0 ? ' sel' : '';
        return '<div class="files-item' + sel + '" data-testid="files-item" data-act="files-select" ' +
          att(sys, win, 'data-file-path="' + esc(it.path) + '" data-value="' + i + '" data-isdir="' + (isDir ? 1 : 0) + '"') + ' draggable="true">' +
          '<div class="fi-ico">' + icon(ico) + '</div><div class="fi-name">' + esc(it.name) + '</div>' +
          (it.rindex >= 0 ? '<div class="fi-tag">已删除</div>' : '') + '</div>';
      }).join('') || '<div class="muted small" style="padding:18px;grid-column:1/-1">' + (recycle ? '回收站是空的' : '此目录为空') + '</div>';

      const btn = (act, tid, label, extra) => '<button class="btn sm" data-testid="' + tid + '" data-act="' + act + '" ' + att(sys, win, extra || '') + '>' + label + '</button>';
      const html = '<div class="files-wrap"><div class="app-toolbar">' +
        btn('files-up', 'files-up', '↑ 上级') +
        btn('files-new-file', 'files-new-file', '新建文件') + btn('files-new-folder', 'files-new-folder', '新建文件夹') +
        btn('files-open', 'files-open', '打开') + btn('files-copy', 'files-copy', '复制') + btn('files-paste', 'files-paste', '粘贴') +
        btn('files-rename', 'files-rename', '重命名') + btn('files-delete', 'files-delete', '删除') +
        '<span class="sep-v"></span>' + btn('files-save-local', 'files-save-local', '存到本机') + btn('files-import-local', 'files-import-local', '从本机导入') +
        (recycle ? '<span class="sep-v"></span>' + btn('files-restore', 'files-restore', '恢复') + btn('files-empty-recycle', 'files-empty-recycle', '清空') : '') +
        '<span class="grow"></span><span class="pill">' + esc(sys.id) + '</span></div>' +
        '<div style="display:flex;flex:1;min-height:0"><div class="files-sidebar">' + nav + '</div>' +
        '<div class="files-main"><div class="files-path" data-testid="files-path" ' + att(sys, win) + '><span class="fp-seg" data-act="files-nav" ' + att(sys, win, 'data-file-path="/"') + '>此系统</span><span class="muted">›</span>' + crumbs + '</div>' +
        '<div class="files-list" data-testid="files-list" ' + att(sys, win) + '>' + rows + '</div></div></div>' +
        '<div class="status-line">' + items.length + ' 个项目 · 选中 ' + win.extra.sel.length + ' · 存储 ' + Math.round(sys.storage.used) + '/' + sys.storage.limit + '</div></div>';
      setHTML(body, html);
    },
  });
  function selPath(win) { return win.extra.sel && win.extra.sel[0]; }
  ui.on('files-nav', ({ sys, win, ds }) => { win.extra.cwd = ds.filePath; win.extra.sel = []; });
  ui.on('files-up', ({ sys, win }) => { const p = rt.fs.parent(win.extra.cwd); win.extra.cwd = p === win.extra.cwd ? '/' : p; win.extra.sel = []; });
  ui.on('files-select', (c, e) => {
    const sys = c.sys, win = c.win, ds = c.ds, ev = e || {};
    const p = ds.filePath;
    if (ev.ctrlKey || ev.metaKey) { const i = win.extra.sel.indexOf(p); if (i >= 0) win.extra.sel.splice(i, 1); else win.extra.sel.push(p); }
    else win.extra.sel = [p];
  });
  ui.on('files-dbl', (c, e) => {
    const sys = c.sys, win = c.win;
    const it = (e && e.target && e.target.closest('.files-item')) || (c.el && c.el.closest('.files-item')); if (!it) return;
    const p = it.getAttribute('data-file-path'), isdir = it.getAttribute('data-isdir') === '1';
    if (win.extra.cwd === '/__recycle') { doRestore(sys, win, +it.getAttribute('data-value')); return; }
    if (isdir) { win.extra.cwd = p; win.extra.sel = []; }
    else ui.openFile(sys, p);
  });
  ui.on('files-open', ({ sys, win }) => { const p = selPath(win); if (!p) return ui.toast('请先选择文件', true);
    if (win.extra.cwd === '/__recycle') return doRestore(sys, win, 0);
    const node = rt.fs.get(sys.fs, p); if (node && node.type === 'dir') { win.extra.cwd = p; win.extra.sel = []; } else ui.openFile(sys, p); });
  ui.on('files-new-file', ({ sys, win }) => ui.prompt('新建文件', '文件名', '新建文档.txt', (name) => {
    if (!name) return; const p = rt.fs.norm(win.extra.cwd + '/' + name);
    rt.fs.write(sys.fs, p, '', rt.fs.guessMime(p)); notifyFile(sys, '文件操作', '已新建 ' + name); ui.toast('已新建 ' + name); }));
  ui.on('files-new-folder', ({ sys, win }) => ui.prompt('新建文件夹', '名称', '新建文件夹', (name) => {
    if (!name) return; rt.fs.mkdir(sys.fs, rt.fs.norm(win.extra.cwd + '/' + name)); notifyFile(sys, '文件操作', '已新建文件夹 ' + name); }));
  ui.on('files-copy', ({ sys, win }) => { const p = selPath(win); if (!p) return; ui.clipboard = { sysId: sys.id, path: p }; ui.toast('已复制 ' + rt.fs.base(p)); });
  ui.on('files-paste', ({ sys, win }) => {
    if (!ui.clipboard) return ui.toast('剪贴板为空', true);
    const src = rt.getSystem(ui.clipboard.sysId); const node = src && rt.fs.get(src.fs, ui.clipboard.path);
    if (!node || node.type !== 'file') return;
    const dst = rt.fs.norm(win.extra.cwd + '/' + rt.fs.base(ui.clipboard.path));
    const r = rt.transferFile(src, ui.clipboard.path, sys, win.extra.cwd);
    if (r.overwrite) ui.dialog = { title: '覆盖？', body: '目标已存在同名文件', buttons: [{ label: '取消', act: () => ui.dialog = null }, { label: '覆盖', primary: true, act: () => { rt.transferFileOverwrite(src, ui.clipboard.path, sys, dst); ui.dialog = null; } }] };
    else if (r.ok) notifyFile(sys, '文件操作', '已粘贴 ' + rt.fs.base(ui.clipboard.path));
    else ui.toast(r.error, true);
  });
  ui.on('files-rename', ({ sys, win }) => { const p = selPath(win); if (!p) return; ui.prompt('重命名', '新名称', rt.fs.base(p), (name) => {
    if (!name) return; const np = rt.fs.parent(p) + '/' + name; rt.fs.rename(sys.fs, p, np); notifyFile(sys, '文件操作', '已重命名为 ' + name); }); });
  ui.on('files-delete', ({ sys, win }) => { const p = selPath(win); if (!p) return; rt.fs.delete(sys.fs, p, sys.fs.recycle); notifyFile(sys, '文件操作', '已移入回收站：' + rt.fs.base(p)); win.extra.sel = []; });
  ui.on('files-restore', ({ sys, win }) => doRestore(sys, win, 0));
  function doRestore(sys, win, idx) { const f = sys.fs.recycle[idx]; if (!f) return; rt.fs.write(sys.fs, f.path, f.content, f.mime); sys.fs.recycle.splice(idx, 1); notifyFile(sys, '文件操作', '已恢复 ' + f.name); }
  ui.on('files-empty-recycle', ({ sys, win }) => { sys.fs.recycle = []; notifyFile(sys, '文件操作', '已清空回收站'); });
  ui.on('files-save-local', ({ sys, win }) => { const p = selPath(win); if (!p) return; const c = rt.fs.read(sys.fs, p);
    window.host.saveFile(rt.fs.base(p), typeof c === 'string' ? c : JSON.stringify(c, null, 2)).then((r) => { if (r.ok) notifyFile(sys, '文件操作', '已保存到本机'); }); });
  ui.on('files-import-local', ({ sys, win }) => window.host.openFile().then((r) => { if (!r.ok) return;
    let content = r.content; try { const j = JSON.parse(r.content); if (j && j.format) content = j; } catch (e) {}
    const p = rt.fs.norm(win.extra.cwd + '/' + r.name); rt.fs.write(sys.fs, p, content, rt.fs.guessMime(p));
    notifyFile(sys, '文件操作', '已从本机导入 ' + r.name); }));

  // ================================================================ 电子表格
  ui.registerApp('spreadsheet', {
    w: 940, h: 580, title: '电子表格',
    mount(sys, win, body, rec) {
      if (!win.extra.wb) {
        const wb = win.extra.path ? rt.getWorkbook(sys, win.extra.path) : null;
        win.extra.wb = clone(wb || blankWorkbook());
        win.extra.path = win.extra.path || '/Demo/未命名.sheet';
        win.extra.undo = []; win.extra.redo = []; win.extra.dirty = false; win.extra.sel = 'A1'; win.extra.range = null;
      }
      const b = (act, tid, label, extra) => '<button class="btn sm" data-testid="' + tid + '" data-act="' + act + '" ' + att(sys, win, extra || '') + '>' + label + '</button>';
      body.innerHTML = '<div class="sheet-wrap"><div class="app-toolbar">' +
        b('sheet-save', 'sheet-save', '保存') + b('sheet-new', 'sheet-new', '新建') +
        '<input class="field sm" data-testid="sheet-filename" data-act="sheet-filename" style="width:180px" ' + att(sys, win) + '>' +
        '<select class="field sm" data-act="sheet-open-file" ' + att(sys, win) + '><option value="">打开其它工作簿…</option></select>' +
        '<span class="sep-v"></span>' + b('sheet-undo', 'sheet-undo', '撤销') + b('sheet-redo', 'sheet-redo', '重做') +
        b('sheet-copy', 'sheet-copy', '复制结果') + b('sheet-paste', 'sheet-paste', '粘贴') +
        '<span class="grow"></span><span class="pill" data-testid="sheet-dirty"></span></div>' +
        '<div class="sheet-formula-bar"><span class="sheet-addr" data-testid="sheet-addr"></span>' +
        '<input class="field grow" data-testid="sheet-formula" data-act="sheet-formula" ' + att(sys, win) + ' placeholder="输入值或公式，如 =SUM(D2:D4)"></div>' +
        '<div class="sheet-grid-scroll" data-testid="sheet-grid"></div>' +
        '<div class="status-line" data-testid="sheet-status"></div></div>';
      rec.gridScroll = body.querySelector('.sheet-grid-scroll');
      rec.inputs = {}; rec.tds = {};
      // 构建一次性网格（避免每次重建导致滚动位置丢失）
      const cols = 10, rows = 24;
      let th = '<tr><th class="corner"></th>'; for (let c = 0; c < cols; c++) th += '<th>' + U.colAddr(c) + '</th>'; th += '</tr>';
      let tb = '';
      for (let r = 0; r < rows; r++) {
        tb += '<tr><th class="rowh">' + (r + 1) + '</th>';
        for (let c = 0; c < cols; c++) {
          const a = U.colAddr(c) + (r + 1);
          tb += '<td class="sheet-cell" data-cell-address="' + a + '"><input data-testid="sheet-cell" data-act="sheet-cell-input" data-cell-address="' + a + '" ' + att(sys, win) + '></td>';
        }
        tb += '</tr>';
      }
      rec.gridScroll.innerHTML = '<table class="sheet-grid"><thead>' + th + '</thead><tbody>' + tb + '</tbody></table>';
      body.querySelectorAll('.sheet-cell').forEach((td) => { rec.tds[td.getAttribute('data-cell-address')] = td; });
      body.querySelectorAll('[data-testid="sheet-cell"]').forEach((inp) => { rec.inputs[inp.getAttribute('data-cell-address')] = inp; });
      rec.filename = body.querySelector('[data-testid="sheet-filename"]');
      rec.formula = body.querySelector('[data-testid="sheet-formula"]');
      rec.addr = body.querySelector('[data-testid="sheet-addr"]');
      rec.dirtyPill = body.querySelector('[data-testid="sheet-dirty"]');
      rec.status = body.querySelector('[data-testid="sheet-status"]');
      rec.openSel = body.querySelector('[data-act="sheet-open-file"]');
    },
    update(sys, win, body, rec) {
      const wb = win.extra.wb, calc = rt.computeWorkbook(wb), sel = win.extra.sel || 'A1';
      // 打开其它工作簿下拉
      const sheets = [];
      for (const p in sys.fs.nodes) if (sys.fs.nodes[p].type === 'file' && sys.fs.nodes[p].mime === 'sheet') sheets.push(p);
      const opts = '<option value="">打开其它工作簿…</option>' + sheets.map((p) => '<option value="' + esc(p) + '"' + (p === win.extra.path ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
      if (rec.openSel._optCache !== opts) { rec.openSel.innerHTML = opts; rec.openSel._optCache = opts; }
      // 逐格同步计算值（不改动正在编辑的输入）
      for (const a in rec.inputs) {
        const v = calc.computed[a] === undefined ? '' : String(calc.computed[a]);
        const inp = rec.inputs[a];
        if (document.activeElement !== inp && inp.value !== v) inp.value = v;
        const td = rec.tds[a];
        td.classList.toggle('sel', a === sel);
        td.classList.toggle('err', String(v).indexOf('#') === 0);
      }
      rec.filename.value = win.extra.path;
      rec.formula.value = wb.cells[sel] === undefined ? '' : String(wb.cells[sel]);
      rec.addr.textContent = sel;
      rec.dirtyPill.textContent = win.extra.dirty ? '● 未保存' : '已保存';
      rec.dirtyPill.className = 'pill ' + (win.extra.dirty ? 'warn' : 'ok');
      const errCount = Object.keys(calc.errors).length;
      rec.status.textContent = '公式 ' + Object.keys(wb.cells).filter((a) => String(wb.cells[a])[0] === '=').length + ' 个 · ' +
        (errCount ? '⚠ ' + errCount + ' 处错误（除零/无效引用/循环依赖）' : '计算正常') + ' · 修改输入后按依赖关系重算 · 选区 ' + (win.extra.range || sel);
    },
    beforeClose(sys, win) {
      if (!win.extra.dirty) return true;
      ui.dialog = { title: '未保存的修改', body: '工作簿「' + esc(rt.fs.base(win.extra.path)) + '」有未保存的修改。',
        buttons: [
          { label: '取消', act: () => ui.dialog = null },
          { label: '放弃', danger: true, act: () => { win.extra.dirty = false; ui.dialog = null; rt.closeWindow(sys, win.id); } },
          { label: '保存', primary: true, act: () => { doSave(sys, win); ui.dialog = null; rt.closeWindow(sys, win.id); } },
        ] };
      return false;
    },
  });
  function doSave(sys, win) { rt.commitWorkbook(sys, win.extra.path, win.extra.wb); win.extra.dirty = false; notifyFile(sys, '电子表格', '已保存 ' + rt.fs.base(win.extra.path)); }
  function commitCell(sys, win, addr, val) {
    if (!win.extra.wb) return;
    win.extra.undo.push(clone(win.extra.wb.cells)); if (win.extra.undo.length > 60) win.extra.undo.shift();
    win.extra.redo = [];
    if (val === '') delete win.extra.wb.cells[addr]; else win.extra.wb.cells[addr] = val;
    win.extra.dirty = true;
    rt.publishWorkbook(sys, win.extra.path, win.extra.wb);
  }
  ui.on('change:sheet-cell-input', ({ sys, win, el }) => { commitCell(sys, win, el.getAttribute('data-cell-address'), el.value); });
  ui.on('change:sheet-formula', ({ sys, win, el }) => { commitCell(sys, win, win.extra.sel || 'A1', el.value); });
  ui.on('change:sheet-filename', ({ sys, win, el }) => { win.extra.path = rt.fs.norm(el.value); win.extra.dirty = true; });
  ui.on('change:sheet-open-file', ({ sys, win, el }) => {
    if (!el.value) return;
    if (win.extra.dirty) { const p = el.value; ui.dialog = { title: '打开另一工作簿', body: '当前有未保存修改，是否保存？', buttons: [
      { label: '取消', act: () => ui.dialog = null }, { label: '放弃', danger: true, act: () => { loadWb(sys, win, p); ui.dialog = null; } },
      { label: '保存', primary: true, act: () => { doSave(sys, win); loadWb(sys, win, p); ui.dialog = null; } }] }; }
    else loadWb(sys, win, el.value);
  });
  function loadWb(sys, win, path) { const wb = rt.getWorkbook(sys, path); if (!wb) return; win.extra.path = path; win.extra.wb = clone(wb); win.extra.dirty = false; win.extra.undo = []; win.extra.redo = []; const rec = ui.winEls[win.id]; if (rec) { rec.mountedAppId = null; } }
  ui.on('sheet-save', ({ sys, win }) => doSave(sys, win));
  ui.on('sheet-new', ({ sys, win }) => { win.extra.wb = blankWorkbook(); win.extra.path = '/Demo/新建.sheet'; win.extra.dirty = false; win.extra.undo = []; });
  ui.on('sheet-undo', ({ sys, win }) => { if (!win.extra.undo.length) return; win.extra.redo.push(clone(win.extra.wb.cells)); win.extra.wb.cells = win.extra.undo.pop(); win.extra.dirty = true; rt.publishWorkbook(sys, win.extra.path, win.extra.wb); });
  ui.on('sheet-redo', ({ sys, win }) => { if (!win.extra.redo.length) return; win.extra.undo.push(clone(win.extra.wb.cells)); win.extra.wb.cells = win.extra.redo.pop(); win.extra.dirty = true; rt.publishWorkbook(sys, win.extra.path, win.extra.wb); });
  ui.on('sheet-copy', ({ sys, win }) => {
    const a = win.extra.sel || 'A1'; const wb = win.extra.wb; const calc = rt.computeWorkbook(wb);
    const v = calc.computed[a] === undefined ? '' : String(calc.computed[a]);
    ui.clipboard = { sysId: sys.id, text: v }; pushClip(sys, '表格 ' + (win.extra.range || a) + ' = ' + v);
    notifyFile(sys, '复制', '已复制结果 ' + v); ui.toast('已复制到剪贴板：' + v);
  });
  ui.on('sheet-paste', ({ sys, win }) => { if (ui.clipboard && ui.clipboard.text !== undefined) commitCell(sys, win, win.extra.sel || 'A1', ui.clipboard.text); });
  // 选区：点击/聚焦单元格，Shift 选择区域
  document.addEventListener('focusin', (e) => { const el = e.target; if (el.getAttribute && el.getAttribute('data-act') === 'sheet-cell-input') {
    const c = ui.ctxOf(el); if (c.win) { c.win.extra.sel = el.getAttribute('data-cell-address'); c.win.extra.range = null; } } });
  document.addEventListener('mousedown', (e) => { const el = e.target.closest && e.target.closest('[data-testid="sheet-cell"]'); if (!el || !e.shiftKey) return;
    const c = ui.ctxOf(el); if (!c.win || !c.win.extra.anchor) return; c.win.extra.range = c.win.extra.anchor + ':' + el.getAttribute('data-cell-address'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-act') === 'sheet-cell-input') { e.target.blur(); } });

  // ================================================================ 小组件
  function calendarHTML(monthOffset) {
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth() + monthOffset;
    const first = new Date(y, m, 1); const start = first.getDay(); const days = new Date(y, m + 1, 0).getDate();
    let h = '<div class="w-cal">'; ['日', '一', '二', '三', '四', '五', '六'].forEach((d) => h += '<div class="cal-h">' + d + '</div>');
    for (let i = 0; i < start; i++) h += '<div class="cal-d out"></div>';
    for (let d = 1; d <= days; d++) { const today = (monthOffset === 0 && d === now.getDate()); h += '<div class="cal-d' + (today ? ' today' : '') + '">' + d + '</div>'; }
    h += '</div>'; return h;
  }
  ui.registerApp('widgets', {
    w: 620, h: 560, title: '小组件面板',
    update(sys, win, body) {
      const w = sys.widgets, now = new Date();
      // 倒计时到时产生通知
      if (w.timerRunning && w.timerEnd && Date.now() >= w.timerEnd) { w.timerRunning = false; w.timerLeft = 0; rt.notify(sys, '倒计时结束', '倒计时已到时'); ui.toast('倒计时结束'); }
      const left = w.timerRunning ? Math.max(0, (w.timerEnd - Date.now()) / 1000) : w.timerLeft;
      const clip = sys.clipboardHistory.map((c) => '<div class="clip-item" title="' + esc(c.text) + '">' + esc(c.text) + '</div>').join('') || '<div class="muted small">暂无复制记录</div>';
      const notifs = sys.notifications.slice(0, 5).map((n) => '<div class="clip-item">' + esc(n.title) + ' · ' + esc(n.body) + '</div>').join('') || '<div class="muted small">暂无通知</div>';
      const html = '<div class="widgets-wrap">' +
        '<div class="widget"><h4>' + icon('clock') + ' 时钟与日历</h4><div class="w-clock">' + U.fmtClock(now) + '</div>' +
        '<div class="w-date">' + now.getFullYear() + ' 年 ' + (now.getMonth() + 1) + ' 月 ' + now.getDate() + ' 日 · 星期' + '日一二三四五六'[now.getDay()] + '</div>' +
        calendarHTML(w.monthOffset) +
        '<div style="display:flex;gap:6px;margin-top:8px"><button class="btn sm" data-act="cal-prev" ' + att(sys, win) + '>上月</button>' +
        '<button class="btn sm" data-act="cal-next" ' + att(sys, win) + '>下月</button></div></div>' +
        '<div class="widget"><h4>' + icon('timer') + ' 倒计时与秒表</h4>' +
        '<div class="w-timer-num" data-testid="widget-timer-num">' + U.fmtSec(left) + '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input class="field sm" style="width:70px" data-testid="widget-timer-input" data-act="widget-timer-input" placeholder="秒" ' + att(sys, win) + '>' +
        '<button class="btn sm primary" data-testid="widget-timer-start" data-act="widget-timer-start" ' + att(sys, win) + '>开始</button>' +
        '<button class="btn sm" data-testid="widget-timer-pause" data-act="widget-timer-pause" ' + att(sys, win) + '>暂停</button>' +
        '<button class="btn sm" data-testid="widget-timer-reset" data-act="widget-timer-reset" ' + att(sys, win) + '>重置</button></div>' +
        '<div class="muted small" style="margin-top:10px">秒表 <b data-testid="widget-stopwatch">' + w.stopwatch.toFixed(1) + 's</b> ' +
        '<button class="btn sm" data-act="sw-toggle" ' + att(sys, win) + '>' + (w.stopwatchRunning ? '暂停' : '开始') + '</button>' +
        '<button class="btn sm" data-act="sw-reset" ' + att(sys, win) + '>归零</button></div></div>' +
        '<div class="widget"><h4>' + icon('note') + ' 便笺</h4><textarea class="field widget-note-text" data-testid="widget-note-text" data-act="widget-note-text" ' + att(sys, win) + '>' + esc(w.note) + '</textarea>' +
        '<div style="margin-top:8px"><button class="btn sm primary" data-testid="widget-note-save" data-act="widget-note-save" ' + att(sys, win) + '>保存便笺</button></div></div>' +
        '<div class="widget"><h4>' + icon('clipboard') + ' 剪贴板历史</h4><div class="widget-clipboard-list" data-testid="widget-clipboard-list">' + clip + '</div></div>' +
        '<div class="widget"><h4>' + icon('bell') + ' 通知中心</h4><div data-testid="widget-notifications">' + notifs + '</div>' +
        '<div style="margin-top:8px"><button class="btn sm" data-act="widgets-open-notif" ' + att(sys, win) + '>打开通知中心</button> ' +
        '<button class="btn sm" data-act="widgets-dnd" ' + att(sys, win) + '>免打扰：' + (sys.quick.dnd ? '开' : '关') + '</button></div></div>' +
        '<div class="widget"><h4>' + icon('settings') + ' 快捷设置</h4>' +
        ['dnd:免打扰', 'wifi:网络', 'bluetooth:蓝牙', 'night:夜间'].map((s) => { const [k, label] = s.split(':'); return '<div class="quick-tile' + (sys.quick[k] ? ' on' : '') + '" data-act="widgets-quick" ' + att(sys, win, 'data-value="' + k + '"') + '>' + icon('wifi') + label + '</div>'; }).join('') +
        '<div class="muted small" style="margin-top:8px;grid-column:1/-1">与「设置」使用同一份状态</div></div>' +
        '</div>';
      setHTML(body, html);
    },
  });
  ui.on('input:widget-timer-input', ({ sys, el }) => { sys.widgets.timerSecs = parseFloat(el.value) || 0; });
  ui.on('widget-timer-start', ({ sys }) => { const w = sys.widgets; const s = w.timerRunning ? Math.max(0, (w.timerEnd - Date.now()) / 1000) : (w.timerSecs || w.timerLeft || 5); w.timerEnd = Date.now() + s * 1000; w.timerRunning = true; ui.toast('倒计时开始 ' + s + ' 秒'); });
  ui.on('widget-timer-pause', ({ sys }) => { const w = sys.widgets; w.timerLeft = Math.max(0, (w.timerEnd - Date.now()) / 1000); w.timerRunning = false; });
  ui.on('widget-timer-reset', ({ sys }) => { sys.widgets.timerRunning = false; sys.widgets.timerLeft = 0; });
  ui.on('cal-prev', ({ sys }) => { sys.widgets.monthOffset--; });
  ui.on('cal-next', ({ sys }) => { sys.widgets.monthOffset++; });
  ui.on('sw-toggle', ({ sys }) => { sys.widgets.stopwatchRunning = !sys.widgets.stopwatchRunning; });
  ui.on('sw-reset', ({ sys }) => { sys.widgets.stopwatch = 0; sys.widgets.stopwatchRunning = false; });
  ui.on('change:widget-note-text', ({ sys, el }) => { sys.widgets.note = el.value; });
  ui.on('input:widget-note-text', ({ sys, el }) => { sys.widgets.note = el.value; });
  ui.on('widget-note-save', ({ sys }) => { rt.fs.write(sys.fs, '/Documents/便笺.txt', sys.widgets.note, 'text'); rt.notify(sys, '便笺', '便笺已保存'); ui.toast('便笺已保存'); });
  ui.on('widgets-open-notif', ({ sys }) => { ui.notifOpen[sys.id] = true; ui.menuOpen[sys.id] = false; });
  ui.on('widgets-dnd', ({ sys }) => { sys.quick.dnd = !sys.quick.dnd; });
  ui.on('widgets-quick', ({ sys, ds }) => { sys.quick[ds.value] = !sys.quick[ds.value]; });

  // ================================================================ 设置
  ui.registerApp('settings', {
    w: 640, h: 520, title: '设置',
    update(sys, win, body) {
      const wp = [['aurora', '极光山谷'], ['dawn', '晨曦湖畔'], ['night', '静夜星河']].map(([k, label]) =>
        '<div class="wp-opt' + (sys.desktop.wallpaper === k ? ' on' : '') + '" data-testid="settings-wallpaper" data-act="settings-wallpaper" ' + att(sys, win, 'data-value="' + k + '"') +
        ' style="background-image:url(' + ui.WALLPAPERS[k] + ')"><span>' + label + '</span></div>').join('');
      const accents = [['#8b5cf6', '紫罗兰'], ['#22b8a6', '青碧'], ['#f0a02a', '琥珀'], ['#ec5f8a', '玫红'], ['#4a9bf0', '天蓝']].map(([k, label]) =>
        '<div class="accent-opt' + (sys.desktop.accent === k ? ' on' : '') + '" data-testid="settings-accent" data-act="settings-accent" ' + att(sys, win, 'data-value="' + k + '"') + ' title="' + label + '" style="background:' + k + '"></div>').join('');
      const scales = [['0.8', '80%'], ['1', '100%'], ['1.25', '125%'], ['1.5', '150%']].map(([k, label]) =>
        '<div class="scale-opt' + (String(sys.desktop.scale) === k ? ' on' : '') + '" data-testid="settings-scale" data-act="settings-scale" ' + att(sys, win, 'data-value="' + k + '"') + '>' + label + '</div>').join('');
      const html = '<div class="settings-wrap">' +
        '<div class="settings-row"><h4>系统名称</h4><input class="field" data-testid="settings-name" data-act="settings-name" style="width:260px" value="' + esc(sys.desktop.title || sys.id) + '" ' + att(sys, win) + '></div>' +
        '<div class="settings-row"><h4>壁纸</h4><div class="opt-grid">' + wp + '</div></div>' +
        '<div class="settings-row"><h4>强调色</h4><div class="opt-grid">' + accents + '</div></div>' +
        '<div class="settings-row"><h4>界面缩放（缩放后输入命中与窗口操作仍正确）</h4><div class="opt-grid">' + scales + '</div></div>' +
        '<div class="settings-row"><h4>系统信息</h4><div class="muted small">标识 ' + esc(sys.id) + ' · 第 ' + (sys.depth + 1) + ' 层 · 虚拟时间 ' + sys.virtualTime.toFixed(2) + 's · 本步预算 ' + Math.round(sys.grantThisTick) + '</div></div>' +
        '</div>';
      setHTML(body, html);
    },
  });
  ui.on('settings-wallpaper', ({ sys, ds }) => { sys.desktop.wallpaper = ds.value; });
  ui.on('settings-accent', ({ sys, ds }) => { sys.desktop.accent = ds.value; });
  ui.on('settings-scale', ({ sys, ds }) => { sys.desktop.scale = parseFloat(ds.value); });
  ui.on('change:settings-name', ({ sys, el }) => { sys.desktop.title = el.value; });
  ui.on('input:settings-name', ({ sys, el }) => { sys.desktop.title = el.value; });

  // ================================================================ 任务 / 进程管理器
  function procRow(sys, win, p, child) {
    const st = p.status;
    const type = p.isKernel ? '内核' : p.isCarrier ? '承载进程' : p.isApp ? '应用' : (p.name === 'wm' ? '窗口管理' : p.name === 'filemgr' ? '文件管理' : '自定义程序');
    const mem = Math.round((U.deepClone(p.vars) ? JSON.stringify(p.vars).length : 0) + p.mailbox.length * 64 + 256);
    const err = p.error ? '<span class="pill err">' + esc(p.error.slice(0, 40)) + '</span>' : '';
    const act = (a, label) => '<button class="btn sm" data-act="' + a + '" ' + att(sys, win, 'data-value="' + p.pid + '"') + '>' + label + '</button>';
    return '<tr class="' + (child ? 'child' : '') + '"><td>' + (child ? '└ ' : '') + p.pid + ' ' + esc(p.name) + '</td><td>' + type + '</td>' +
      '<td><span class="st ' + st + '">' + st + '</span></td><td>' + Math.round(p.consumed) + '</td>' +
      '<td><div class="bar"><i style="width:' + Math.min(100, mem / 20) + '%"></i></div> ' + mem + 'B</td>' +
      '<td>' + err + '</td><td>' + (p.isKernel ? '' : act('proc-suspend', '挂起') + act('proc-resume', '继续') + act('proc-end', '结束')) + '</td></tr>';
  }
  ui.registerApp('tasks', {
    w: 920, h: 560, title: '任务与进程管理器',
    update(sys, win, body) {
      const procs = Object.keys(sys.procs).map((k) => sys.procs[k]);
      const carriers = procs.filter((p) => p.isCarrier);
      const rows = procs.map((p) => procRow(sys, win, p, p.isCarrier)).join('');
      // 浏览器网页视图单独列出
      const views = [];
      for (const w of sys.windows) if (w.appId === 'browser' && w.extra && w.extra.tabs) w.extra.tabs.forEach((t) => views.push('<tr class="child"><td colspan="3">网页视图 · ' + esc(t.title || t.url) + '</td><td colspan="2">' + esc(t.loadState || '') + '</td><td colspan="2">' + esc(t.url) + '</td></tr>'));
      const kids = sys.children.map((id) => rt.getSystem(id)).filter(Boolean);
      const grants = kids.map((c) => '<label class="small muted">' + esc(c.id) + ' 拨付上限</label><input class="field sm" data-testid="tasks-grant" data-act="tasks-grant" style="width:90px" data-target-system-id="' + c.id + '" value="' + c.grantCap + '" ' + att(sys, win) + '>').join('');
      const html = '<div class="tasks-wrap"><div class="tasks-controls">' +
        '<div class="tasks-ctl"><label>总预算/步</label><input class="field sm" data-testid="tasks-budget" data-act="tasks-budget" value="' + sys.budget + '" ' + att(sys, win) + '></div>' +
        '<div class="tasks-ctl"><label>内存配额</label><input class="field sm" data-testid="tasks-memory" data-act="tasks-memory" value="' + sys.memory.limit + '" ' + att(sys, win) + '></div>' +
        '<div class="tasks-ctl"><label>存储配额</label><input class="field sm" data-testid="tasks-storage" data-act="tasks-storage" value="' + sys.storage.limit + '" ' + att(sys, win) + '></div>' +
        '<div class="tasks-ctl"><label>已用内存</label><div class="pill">' + Math.round(sys.memory.used) + '</div></div>' +
        '<div class="tasks-ctl"><label>实际拨付</label><div class="pill ok">' + Math.round(sys.grantThisTick) + '</div></div>' +
        '<div class="tasks-ctl"><label>本步消耗(含子树)</label><div class="pill">' + Math.round(sys.totalConsumedThisTick) + '</div></div>' +
        '<div class="tasks-ctl"><label>内核/用户</label><div class="pill">' + Math.round(sys.kernelConsumed) + '/' + Math.round(sys.userConsumed) + '</div></div>' +
        '<div class="tasks-ctl"><label>直属子系统拨付</label><div style="display:flex;gap:6px;flex-wrap:wrap">' + (grants || '<span class="muted small">无</span>') + '</div></div>' +
        '</div><div class="tasks-table"><table class="proc-table"><thead><tr><th>进程</th><th>类别</th><th>状态</th><th>工作量/读数</th><th>内存</th><th>错误</th><th>操作</th></tr></thead>' +
        '<tbody>' + rows + views.join('') + '</tbody></table></div>' +
        '<div class="status-line">读数说明：工作量为逻辑指令数；承载进程读数含子树内核自身与内部工作；网页视图不计入自定义指令读数。</div></div>';
      setHTML(body, html);
    },
  });
  ui.on('proc-suspend', ({ sys, ds }) => { const p = sys.procs[ds.value]; if (p && p.status !== 'done') p.status = 'suspended'; });
  ui.on('proc-resume', ({ sys, ds }) => { const p = sys.procs[ds.value]; if (p && p.status === 'suspended') p.status = 'ready'; });
  ui.on('proc-end', ({ sys, ds }) => { const p = sys.procs[ds.value]; if (p) { p.status = 'done'; p.mailbox = []; } });
  function numAct(field) { return ({ sys, el }) => { const v = Math.max(100, parseInt(el.value) || 0); if (field === 'budget') sys.budget = v; else if (field === 'memory') sys.memory.limit = v; else if (field === 'storage') sys.storage.limit = v; }; }
  ui.on('change:tasks-budget', numAct('budget')); ui.on('change:tasks-memory', numAct('memory')); ui.on('change:tasks-storage', numAct('storage'));
  ui.on('input:tasks-budget', numAct('budget')); ui.on('input:tasks-memory', numAct('memory')); ui.on('input:tasks-storage', numAct('storage'));
  ui.on('change:tasks-grant', ({ sys, el }) => { const c = rt.getSystem(el.getAttribute('data-target-system-id')); if (c) c.grantCap = Math.max(200, parseInt(el.value) || 200); });

  // ================================================================ Chromium 浏览器
  const START_URL = 'http://127.0.0.1:18106/browser-start.html';
  function addTab(sys, win, url) {
    if (!win.extra.tabs) win.extra.tabs = [];
    const t = { id: 'tab-' + OS.util.uid(''), url: url || START_URL, title: '新标签页', loadState: 'idle' };
    win.extra.tabs.push(t); win.extra.active = t.id; return t;
  }
  function activeTab(win) { return (win.extra.tabs || []).find((t) => t.id === win.extra.active); }
  ui.registerApp('browser', {
    w: 980, h: 640, title: 'Chromium 浏览器',
    mount(sys, win, body, rec) {
      if (!win.extra.tabs || !win.extra.tabs.length) addTab(sys, win, START_URL);
      body.innerHTML = '<div class="browser-wrap"><div class="browser-chrome"></div><div class="browser-view"></div></div>';
      rec.chromeHost = body.querySelector('.browser-chrome');
      rec.viewContainer = body.querySelector('.browser-view');
      rec.webviews = {};
      // 网页视图镜像（不接收输入，仅用于被遮挡/CDP 截图时显示实际网页内容）
      rec.mirror = document.createElement('img');
      rec.mirror.className = 'browser-mirror'; rec.mirror.alt = '';
      rec.viewContainer.appendChild(rec.mirror);
    },
    update(sys, win, body, rec) {
      const tabs = win.extra.tabs || [];
      for (const t of tabs) {
        let wv = rec.webviews[t.id];
        if (!wv) {
          wv = document.createElement('webview');
          wv.setAttribute('allowpopups', ''); wv.setAttribute('webpreferences', 'contextIsolation=yes');
          wv.setAttribute('data-tab-id', t.id);
          wv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;background:#fff';
          rec.viewContainer.appendChild(wv); rec.webviews[t.id] = wv; wv._url = null;
          const tab = t;
          wv.addEventListener('did-start-loading', () => { tab.loadState = 'loading'; });
          wv.addEventListener('did-stop-loading', () => { tab.loadState = 'done'; });
          wv.addEventListener('did-fail-load', () => { tab.loadState = 'error'; });
          wv.addEventListener('page-title-updated', (e) => { tab.title = e.title || tab.title; });
          wv.addEventListener('did-navigate', (e) => { tab.url = e.url; tab.loadState = 'done'; });
          wv.addEventListener('new-window', (e) => { e.preventDefault(); addTab(sys, win, e.url); ui.toast('已在浏览器内打开新标签'); });
          wv.addEventListener('dom-ready', () => {});
        }
        if (wv._url !== t.url) { try { wv.src = t.url; } catch (e) {} wv._url = t.url; }
        wv.style.display = (t.id === win.extra.active) ? 'block' : 'none';
      }
      for (const id in rec.webviews) if (!tabs.find((t) => t.id === id)) { const el = rec.webviews[id]; if (el.parentNode) el.parentNode.removeChild(el); delete rec.webviews[id]; }
      const a = activeTab(win) || {};
      const tabHtml = tabs.map((t) => '<div class="browser-tab' + (t.id === win.extra.active ? ' on' : '') + '" data-testid="browser-tab" data-act="browser-tab" ' +
        att(sys, win, 'data-tab-id="' + t.id + '"') + '><span class="bt-t">' + esc(t.title || t.url) + '</span>' +
        '<span class="bt-x" data-act="browser-close-tab" ' + att(sys, win, 'data-tab-id="' + t.id + '"') + '>×</span></div>').join('');
      const nav = '<div class="browser-nav">' +
        '<button class="btn sm" data-testid="browser-back" data-act="browser-back" ' + att(sys, win) + '>‹</button>' +
        '<button class="btn sm" data-testid="browser-forward" data-act="browser-forward" ' + att(sys, win) + '>›</button>' +
        '<button class="btn sm" data-testid="browser-reload" data-act="browser-reload" ' + att(sys, win) + '>⟳</button>' +
        '<input class="field grow" data-testid="browser-address" data-act="browser-address" value="' + esc(a.url || '') + '" ' + att(sys, win) + '>' +
        '<button class="btn sm primary" data-testid="browser-go" data-act="browser-go" ' + att(sys, win) + '>前往</button>' +
        '<button class="btn sm" data-testid="browser-new-tab" data-act="browser-new-tab" ' + att(sys, win) + '>+ 新标签</button>' +
        '<span class="pill ' + (a.loadState === 'error' ? 'err' : a.loadState === 'loading' ? 'warn' : 'ok') + '">' + esc(a.loadState || 'idle') + '</span></div>';
      setHTML(rec.chromeHost, '<div class="browser-tabs">' + tabHtml + '</div>' + nav);
      // 网页视图镜像：主进程抓取 guest 像素画进 DOM，避免被遮挡/独立视图导致空白画面
      try {
        const wv = rec.webviews[a.id];
        if (wv && a.wcId === undefined && typeof wv.getWebContentsId === 'function') { try { a.wcId = wv.getWebContentsId(); } catch (e) {} }
        if (a.wcId != null && window.host && window.host.webviewShot && Date.now() - (rec._lastShot || 0) > 220) {
          rec._lastShot = Date.now(); const gid = a.wcId;
          window.host.webviewShot(gid).then((d) => { if (d && rec.mirror) rec.mirror.src = d; }).catch(() => {});
        }
      } catch (e) {}
    },
    destroy(rec) { for (const id in rec.webviews) { const el = rec.webviews[id]; if (el && el.parentNode) el.parentNode.removeChild(el); } rec.webviews = {}; },
  });
  function normUrl(u) { u = (u || '').trim(); if (!u) return ''; if (/^https?:\/\//i.test(u) || /^file:\/\//i.test(u) || u.indexOf('://') > 0) return u; return 'https://' + u; }
  ui.on('browser-tab', ({ win, ds }) => { win.extra.active = ds.tabId; });
  ui.on('browser-close-tab', ({ sys, win, ds }) => {
    const t = (win.extra.tabs || []).find((x) => x.id === ds.tabId); if (!t) return;
    win.extra.tabs = win.extra.tabs.filter((x) => x.id !== ds.tabId);
    if (win.extra.active === ds.tabId) win.extra.active = win.extra.tabs.length ? win.extra.tabs[win.extra.tabs.length - 1].id : null;
    if (!win.extra.tabs.length) rt.closeWindow(sys, win.id);
  });
  ui.on('browser-new-tab', ({ sys, win }) => addTab(sys, win, START_URL));
  ui.on('browser-go', ({ sys, win }) => { const inp = document.querySelector('[data-window-id="' + win.id + '"] [data-testid="browser-address"]'); const a = activeTab(win); if (!a) return;
    const u = normUrl(inp ? inp.value : ''); if (!u) return; a.url = u; a.title = u; a.loadState = 'loading'; });
  ui.on('change:browser-address', ({ win, el }) => { const a = activeTab(win); if (a) { a.url = normUrl(el.value); a.title = el.value; a.loadState = 'loading'; } });
  ui.on('browser-back', ({ win }) => { const wv = ui.winEls[win.id] && ui.winEls[win.id].webviews[win.extra.active]; if (wv && wv.canGoBack()) wv.goBack(); });
  ui.on('browser-forward', ({ win }) => { const wv = ui.winEls[win.id] && ui.winEls[win.id].webviews[win.extra.active]; if (wv && wv.canGoForward()) wv.goForward(); });
  ui.on('browser-reload', ({ win }) => { const wv = ui.winEls[win.id] && ui.winEls[win.id].webviews[win.extra.active]; if (wv) wv.reload(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.getAttribute && e.target.getAttribute('data-act') === 'browser-address') { e.target.blur(); const c = ui.ctxOf(e.target); if (c.win && ui.actions['browser-go']) ui.actions['browser-go'](c, e); } });

  // ================================================================ 文本 / 程序编辑器
  ui.registerApp('editor', {
    w: 820, h: 560, title: '文本与程序编辑器',
    mount(sys, win, body, rec) {
      if (win.extra.text === undefined) {
        if (win.extra.path) { const c = rt.fs.read(sys.fs, win.extra.path); win.extra.text = typeof c === 'string' ? c : (c ? JSON.stringify(c, null, 2) : ''); }
        else win.extra.text = OS.data.programs['accumulator.npl'];
      }
      if (!win.extra.filename) win.extra.filename = win.extra.path || '/Programs/新程序.npl';
      const b = (act, tid, label) => '<button class="btn sm" data-testid="' + tid + '" data-act="' + act + '" ' + att(sys, win) + '>' + label + '</button>';
      body.innerHTML = '<div class="editor-wrap"><div class="app-toolbar">' +
        '<input class="field sm" data-testid="editor-filename" data-act="editor-filename" style="width:230px" ' + att(sys, win) + '>' +
        b('editor-save', 'editor-save', '保存') + b('editor-run', 'editor-run', '运行程序') +
        b('editor-msgtest', 'editor-msgtest', '消息测试') + b('editor-selfcompile', 'editor-selfcompile', '自编译并应用') +
        '<select class="field sm" data-act="editor-load" ' + att(sys, win) + '><option value="">载入示例…</option></select>' +
        '<span class="grow"></span>' + (win.extra.kernelFor ? '<span class="pill warn">内核源 · ' + esc(win.extra.kernelFor) + '</span>' : '') + '</div>' +
        '<textarea class="editor-area" data-testid="editor-text" data-act="editor-text" spellcheck="false" ' + att(sys, win) + '></textarea>' +
        '<div class="editor-log" data-testid="editor-log"></div></div>';
      rec.textarea = body.querySelector('[data-testid="editor-text"]');
      rec.filename = body.querySelector('[data-testid="editor-filename"]');
      rec.loadSel = body.querySelector('[data-act="editor-load"]');
      rec.log = body.querySelector('[data-testid="editor-log"]');
      rec.textarea.value = win.extra.text;
      rec.filename.value = win.extra.filename;
      rec.textarea.addEventListener('input', () => { win.extra.text = rec.textarea.value; });
    },
    update(sys, win, body, rec) {
      if (rec._text !== win.extra.text && document.activeElement !== rec.textarea) { rec.textarea.value = win.extra.text; rec._text = win.extra.text; }
      rec.filename.value = win.extra.filename;
      const progFiles = []; for (const p in sys.fs.nodes) if (sys.fs.nodes[p].type === 'file' && sys.fs.nodes[p].mime === 'program') progFiles.push(p);
      const opts = '<option value="">载入示例…</option>' + progFiles.map((p) => '<option value="' + esc(p) + '">' + esc(p) + '</option>').join('');
      if (rec.loadSel._c !== opts) { rec.loadSel.innerHTML = opts; rec.loadSel._c = opts; }
      const log = sys.log.slice(-40).join('\n');
      setHTML(rec.log, esc(log) || '<span class="muted">程序输出（log）将显示在这里</span>');
    },
    beforeClose(sys, win) { return true; },
  });
  ui.on('input:editor-text', ({ win, el }) => { win.extra.text = el.value; });
  ui.on('change:editor-filename', ({ win, el }) => { win.extra.filename = el.value; });
  ui.on('editor-save', ({ sys, win }) => {
    const p = rt.fs.norm(win.extra.filename);
    rt.fs.write(sys.fs, p, win.extra.text, rt.fs.guessMime(p));
    win.extra.path = p;
    if (win.extra.kernelFor) { /* 内核源本就在父系统 FS */ ui.toast('内核源已保存，重启 ' + win.extra.kernelFor + ' 后生效'); }
    else ui.toast('已保存 ' + rt.fs.base(p));
    notifyFile(sys, '编辑器', '已保存 ' + rt.fs.base(p));
  });
  ui.on('editor-run', ({ sys, win }) => {
    const p = rt.compileAndRun(sys, win.extra.text, '自定义程序', null, { fromFile: false });
    ui.toast(p && p.status === 'error' ? ('程序错误：' + p.error) : '已启动自定义程序，输出见下方日志');
  });
  ui.on('editor-msgtest', ({ sys }) => {
    const rec = rt.spawn(sys, OS.data.programs['receiver.npl'], 'receiver', null, { fromFile: false });
    rt.spawn(sys, OS.data.programs['sender.npl'], 'sender', rec.pid, { fromFile: false });
    ui.toast('已启动消息发送/接收程序，输出见日志');
  });
  ui.on('editor-selfcompile', ({ sys, win }) => {
    if (/compiler\.npl/.test(win.extra.filename)) {
      rt.fs.write(sys.fs, '/System/compiler.npl', win.extra.text, 'program');
      const r = rt.selfCompile(sys); ui.toast(r.ok ? '编译器已重新编译并应用，此后启动的程序按新规则编译' : ('编译器错误：' + r.error), !r.ok);
    } else ui.toast('请先打开 /System/compiler.npl 再自编译', true);
  });
  ui.on('change:editor-load', ({ sys, win, el }) => {
    if (!el.value) return; const c = rt.fs.read(sys.fs, el.value);
    win.extra.text = typeof c === 'string' ? c : JSON.stringify(c, null, 2); win.extra.filename = el.value; win.extra.path = el.value;
    const rec = ui.winEls[win.id]; if (rec && rec.textarea) rec.textarea.value = win.extra.text;
  });

  // 秒表随真实时间推进（小组件）
  setInterval(() => { for (const sid in rt.state.systems) { const s = rt.state.systems[sid]; if (s.widgets && s.widgets.stopwatchRunning) s.widgets.stopwatch += 0.1; } }, 100);

})(window.OS = window.OS || {});
