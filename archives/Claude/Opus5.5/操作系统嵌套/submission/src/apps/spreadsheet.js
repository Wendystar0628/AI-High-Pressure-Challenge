// 根系统电子表格：单工作表、公式与依赖重算、撤销/重做、复制粘贴、基本格式、
// 工作簿文件（nest-sheet JSON）以及向子系统图表发布区域数据（实时数据源）。
import { h, clear, icon } from '../ui/dom.js';
import { SheetModel, COLS, ROWS, colName, addrOf, parseAddr, parseRange, rangeStr, SErr } from './sheet-engine.js';

let DOC_SEQ = 1;
const OPEN_DOCS = new Map(); // docId -> 实例（供数据服务读取）

export function installDataSources(root) {
  root.dataSources = {
    list: () => [...OPEN_DOCS.values()].map((d) => ({ doc: d.docId, title: d.title(), path: d.path(), version: d.version() })),
    has: (doc) => OPEN_DOCS.has(doc),
    read: (doc, range) => { const d = OPEN_DOCS.get(doc); return d ? d.read(range) : null; },
  };
}

export default {
  id: 'spreadsheet', name: '电子表格', icon: 'spreadsheet', w: 900, h: 560, keywords: 'sheet excel 表格',
  create(ctx) {
    const { fs, desktop, win, root } = ctx;
    if (!root.dataSources) installDataSources(root);
    const model = new SheetModel();
    const docId = `wb-${Date.now().toString(36)}-${DOC_SEQ++}`;
    let path = null, title = '未命名工作簿', dirty = false, version = 0;
    let act = { c: 0, r: 0 }, sel = { c0: 0, r0: 0, c1: 0, r1: 0 };
    const undo = [], redo = [];
    let editing = null;

    // ---------- 界面 ----------
    const fname = h('span', { class: 'sh-fname', tid: 'sheet-filename', 'data-system-id': 'outer', 'data-window-id': win.id });
    const formula = h('input', { class: 'inp sh-formula', tid: 'sheet-formula', 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': '编辑栏', spellcheck: 'false' });
    const addrBox = h('input', { class: 'inp sh-addr', 'aria-label': '名称框', tid: 'sheet-address', 'data-system-id': 'outer', 'data-window-id': win.id });
    const btn = (tid, ic, label, fn, text) => { const b = h('button', { class: text ? 'btn' : 'btn icon', tid, 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': label, title: label, html: ic ? icon(ic) : '' }, text || ''); b.addEventListener('click', fn); return b; };
    const fbtn = (label, title2, fn, style) => { const b = h('button', { class: 'btn icon', title: title2, 'aria-label': title2, text: label, style }); b.addEventListener('click', fn); return b; };
    const colorSel = (label, key, colors) => {
      const s = h('select', { class: 'inp', title: label, 'aria-label': label, style: { width: '74px' } }, h('option', { value: '', text: label }), colors.map(([v, n]) => h('option', { value: v, text: n })));
      s.addEventListener('change', () => { applyFmt({ [key]: s.value || undefined }); s.value = ''; });
      return s;
    };
    const toolbar = h('div', { class: 'toolbar' },
      btn('sheet-new', 'newfile', '新建', () => guard(() => newBook())),
      btn('sheet-open', 'open', '打开', () => guard(() => openDialog())),
      btn('sheet-save', 'save', '保存', () => save(false), '保存'),
      btn('sheet-save-as', null, '另存为', () => save(true), '另存为'),
      h('div', { class: 'tb-sep' }),
      btn('sheet-undo', 'back', '撤销 (Ctrl+Z)', () => doUndo()),
      btn('sheet-redo', 'forward', '重做 (Ctrl+Y)', () => doRedo()),
      btn('sheet-copy', 'copy', '复制 (Ctrl+C)', () => copy()),
      btn('sheet-paste', 'paste', '粘贴 (Ctrl+V)', () => pasteFromClipboard()),
      h('div', { class: 'tb-sep' }),
      fbtn('B', '加粗', () => applyFmt({ bold: !model.fmt(addrOf(act.c, act.r)).bold }), { fontWeight: '800' }),
      fbtn('I', '斜体', () => applyFmt({ italic: !model.fmt(addrOf(act.c, act.r)).italic }), { fontStyle: 'italic' }),
      fbtn('⟸', '左对齐', () => applyFmt({ align: 'left' })), fbtn('≡', '居中', () => applyFmt({ align: 'center' })), fbtn('⟹', '右对齐', () => applyFmt({ align: 'right' })),
      fbtn('.00', '两位小数', () => applyFmt({ dec: model.fmt(addrOf(act.c, act.r)).dec === 2 ? undefined : 2 })),
      colorSel('文字色', 'color', [['#f87171', '红'], ['#fbbf24', '黄'], ['#4ade80', '绿'], ['#60a5fa', '蓝'], ['#e8edf7', '默认']]),
      colorSel('填充色', 'bg', [['#7f1d1d', '深红'], ['#78350f', '琥珀'], ['#14532d', '深绿'], ['#1e3a8a', '深蓝'], ['', '无']]),
      h('div', { class: 'grow' }), fname);
    const fbar = h('div', { class: 'sh-fbar' }, addrBox, h('span', { class: 'sh-fx', text: 'fx' }), formula);
    const grid = h('div', { class: 'sh-grid scroll', tid: 'sheet-grid', 'data-system-id': 'outer', 'data-window-id': win.id, tabindex: '0', role: 'grid', 'aria-label': '单元格' });
    const status = h('div', { class: 'statusbar' });
    const el = h('div', { class: 'sheet' }, toolbar, fbar, grid, status);
    const cellEls = new Map();
    // 键盘接收器：跟随活动单元格的透明输入框，接收按键、输入法与插入文本后开始编辑
    const sink = h('input', { class: 'sh-sink', 'aria-label': '单元格输入', tid: 'sheet-input', 'data-system-id': 'outer', 'data-window-id': win.id, spellcheck: 'false', autocomplete: 'off' });
    const focusGrid = () => { if (document.activeElement !== sink) sink.focus({ preventScroll: true }); };
    const sinkInput = () => { const v = sink.value; if (!v) return; sink.value = ''; if (!editing) startEdit(v); };
    sink.addEventListener('input', (e) => { if (!e.isComposing) sinkInput(); });
    sink.addEventListener('compositionend', () => setTimeout(sinkInput, 0));
    const table = h('div', { class: 'sh-table' });
    grid.append(table);
    const corner = h('div', { class: 'sh-corner' });
    table.append(corner, sink);
    const colHeads = [], rowHeads = [];
    for (let c = 0; c < COLS; c++) { const ch = h('div', { class: 'sh-ch', text: colName(c) }); ch.style.gridColumn = String(c + 2); ch.addEventListener('mousedown', (e) => { e.preventDefault(); selectRange({ c0: c, r0: 0, c1: c, r1: ROWS - 1 }, { c, r: 0 }); }); colHeads.push(ch); table.append(ch); }
    for (let r = 0; r < ROWS; r++) {
      const rh = h('div', { class: 'sh-rh', text: String(r + 1) }); rh.style.gridRow = String(r + 2);
      rh.addEventListener('mousedown', (e) => { e.preventDefault(); selectRange({ c0: 0, r0: r, c1: COLS - 1, r1: r }, { c: 0, r }); });
      rowHeads.push(rh); table.append(rh);
      for (let c = 0; c < COLS; c++) {
        const a = addrOf(c, r);
        const ce = h('div', { class: 'sh-cell', tid: 'sheet-cell', 'data-cell-address': a, 'data-system-id': 'outer', 'data-window-id': win.id, role: 'gridcell', 'aria-label': a });
        ce.style.gridRow = String(r + 2); ce.style.gridColumn = String(c + 2);
        cellEls.set(a, ce);
        table.append(ce);
      }
    }
    // ---------- 绘制 ----------
    function paintCell(a) {
      const ce = cellEls.get(a);
      if (!ce) return;
      const v = model.value(a);
      const f = model.fmt(a);
      ce.textContent = model.display(a);
      ce.classList.toggle('num', typeof v === 'number');
      ce.classList.toggle('err', v instanceof SErr);
      ce.classList.toggle('formula', model.raw(a).startsWith('='));
      ce.style.fontWeight = f.bold ? '700' : '';
      ce.style.fontStyle = f.italic ? 'italic' : '';
      ce.style.textAlign = f.align || '';
      ce.style.color = f.color || '';
      ce.style.background = f.bg || '';
      ce.title = v instanceof SErr ? v.why : '';
    }
    function paintAll() { for (const a of cellEls.keys()) paintCell(a); paintSel(); }
    function paintSel() {
      table.querySelectorAll('.sh-cell.in, .sh-cell.act').forEach((x) => x.classList.remove('in', 'act'));
      for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) cellEls.get(addrOf(c, r)).classList.add('in');
      const ae = cellEls.get(addrOf(act.c, act.r)); ae.classList.add('act');
      sink.style.gridRow = ae.style.gridRow; sink.style.gridColumn = ae.style.gridColumn;
      colHeads.forEach((x, i) => x.classList.toggle('on', i >= sel.c0 && i <= sel.c1));
      rowHeads.forEach((x, i) => x.classList.toggle('on', i >= sel.r0 && i <= sel.r1));
      const a = addrOf(act.c, act.r);
      addrBox.value = sel.c0 === sel.c1 && sel.r0 === sel.r1 ? a : rangeStr(sel);
      if (document.activeElement !== formula) formula.value = model.raw(a);
      updateStatus();
    }
    function updateStatus() {
      clear(status);
      const a = addrOf(act.c, act.r); const v = model.value(a);
      let sum = 0, cnt = 0;
      for (let r = sel.r0; r <= sel.r1 && cnt < 5000; r++) for (let c = sel.c0; c <= sel.c1; c++) { const x = model.value(addrOf(c, r)); if (typeof x === 'number') { sum += x; cnt++; } }
      status.append(
        h('span', { text: dirty ? '● 未保存的修改' : '已保存', style: { color: dirty ? '#fbbf24' : '' }, tid: 'sheet-dirty' }),
        h('span', { text: `版本 ${version}` }),
        v instanceof SErr ? h('span', { text: `${a}: ${v.code} ${v.why}`, style: { color: '#fca5a5' }, tid: 'sheet-error' }) : h('span', { text: cnt > 1 ? `求和 ${Math.round(sum * 1e6) / 1e6} · 计数 ${cnt}` : '' }),
        h('span', { style: { marginLeft: 'auto' }, text: `数据源 ${docId}` }));
    }
    function updateTitle() {
      fname.textContent = (path || title) + (dirty ? ' •' : '');
      desktop.setTitle(win, `${dirty ? '● ' : ''}${title} — 电子表格`);
    }
    // ---------- 编辑与提交 ----------
    function commit(changes, label) {
      // changes: [{a, before, after}] 已应用；一次提交 = 重算 + 版本 + 发布
      if (!changes.length) return;
      const aff = new Set();
      for (const ch of changes) for (const x of model.setRaw(ch.a, ch.after)) aff.add(x);
      const n = model.recalc([...aff]);
      root.charge(4 + n * 6 + changes.length * 2);
      for (const x of aff) paintCell(x);
      version++; dirty = true;
      updateTitle(); paintSel();
      root.publish(docId);
    }
    function setCells(list, label) {
      const changes = list.map(([a, after]) => ({ a, before: model.raw(a), after })).filter((x) => x.before !== x.after);
      if (!changes.length) return;
      undo.push({ changes, label }); redo.length = 0;
      if (undo.length > 200) undo.shift();
      commit(changes, label);
    }
    function doUndo() { const u = undo.pop(); if (!u) return; redo.push(u); commit(u.changes.map((c) => ({ a: c.a, after: c.before })), '撤销'); }
    function doRedo() { const u = redo.pop(); if (!u) return; undo.push(u); commit(u.changes.map((c) => ({ a: c.a, after: c.after })), '重做'); }
    function applyFmt(f) {
      for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) { const a = addrOf(c, r); model.setFmt(a, f); paintCell(a); }
      dirty = true; updateTitle(); updateStatus();
    }
    function startEdit(seed) {
      endEdit(false);
      const a = addrOf(act.c, act.r); const ce = cellEls.get(a);
      const inp = h('input', { class: 'sh-editor', value: seed != null ? seed : model.raw(a), 'aria-label': '编辑单元格 ' + a, tid: 'sheet-cell-editor', 'data-system-id': 'outer', 'data-window-id': win.id, spellcheck: 'false' });
      inp.style.gridRow = ce.style.gridRow; inp.style.gridColumn = ce.style.gridColumn;
      table.append(inp);
      editing = { a, inp };
      inp.focus();
      if (seed == null) inp.select(); else inp.setSelectionRange(inp.value.length, inp.value.length);
      inp.addEventListener('input', () => { formula.value = inp.value; });
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); endEdit(true); move(0, e.shiftKey ? -1 : 1); }
        else if (e.key === 'Tab') { e.preventDefault(); endEdit(true); move(e.shiftKey ? -1 : 1, 0); }
        else if (e.key === 'Escape') { e.preventDefault(); endEdit(false); }
      });
      inp.addEventListener('blur', () => { if (editing && editing.inp === inp) endEdit(true, true); });
    }
    function endEdit(save, fromBlur) {
      if (!editing) return;
      const { a, inp } = editing; editing = null;
      const v = inp.value;
      inp.remove();
      if (save) setCells([[a, v]], '编辑');
      if (!fromBlur) focusGrid();
      paintSel();
    }
    function move(dc, dr, extend) {
      const nc = Math.max(0, Math.min(COLS - 1, act.c + dc)), nr = Math.max(0, Math.min(ROWS - 1, act.r + dr));
      if (extend) { const anc = selAnchor || act; act = { c: nc, r: nr }; sel = { c0: Math.min(anc.c, nc), r0: Math.min(anc.r, nr), c1: Math.max(anc.c, nc), r1: Math.max(anc.r, nr) }; }
      else { act = { c: nc, r: nr }; sel = { c0: nc, r0: nr, c1: nc, r1: nr }; selAnchor = null; }
      paintSel();
      cellEls.get(addrOf(act.c, act.r)).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    let selAnchor = null;
    function selectRange(g, a) { endEdit(true); sel = g; act = a; selAnchor = a; paintSel(); focusGrid(); }
    // ---------- 复制粘贴 ----------
    function copy() {
      const rows = [];
      for (let r = sel.r0; r <= sel.r1; r++) { const row = []; for (let c = sel.c0; c <= sel.c1; c++) row.push(model.display(addrOf(c, r))); rows.push(row.join('\t')); }
      const text = rows.join('\n');
      desktop.sheetClipboard = { text, raws: rowsRaw(), g: { ...sel } };
      desktop.writeClipboard(text, { type: 'range', range: rangeStr(sel), source: `${title} ${sel.c0 === sel.c1 && sel.r0 === sel.r1 ? addrOf(sel.c0, sel.r0) : rangeStr(sel)}` });
      desktop.notify({ title: '已复制', body: `${rangeStr(sel)}：${text.length > 40 ? text.slice(0, 40) + '…' : text}`, level: 'ok', source: 'spreadsheet' });
    }
    function rowsRaw() { const out = []; for (let r = sel.r0; r <= sel.r1; r++) { const row = []; for (let c = sel.c0; c <= sel.c1; c++) row.push(model.raw(addrOf(c, r))); out.push(row); } return out; }
    async function pasteFromClipboard() {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch {}
      const internal = desktop.sheetClipboard;
      if (internal && (text === '' || text === internal.text)) return pasteGrid(internal.raws);
      if (!text && desktop.clipboard[0]) text = desktop.clipboard[0].text;
      if (!text) return;
      pasteGrid(text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t')));
    }
    function pasteGrid(rows) {
      const list = [];
      rows.forEach((row, i) => row.forEach((v, j) => { const c = act.c + j, r = act.r + i; if (c < COLS && r < ROWS) list.push([addrOf(c, r), v]); }));
      setCells(list, '粘贴');
      sel = { c0: act.c, r0: act.r, c1: Math.min(COLS - 1, act.c + Math.max(...rows.map((x) => x.length)) - 1), r1: Math.min(ROWS - 1, act.r + rows.length - 1) };
      paintSel();
    }
    // ---------- 鼠标与键盘 ----------
    table.addEventListener('mousedown', (e) => {
      const ce = e.target.closest('.sh-cell');
      if (!ce || e.button !== 0) return;
      e.preventDefault();
      const p = parseAddr(ce.dataset.cellAddress);
      if (editing && editing.inp.value.startsWith('=') && editing.a !== ce.dataset.cellAddress) {
        // 编辑公式时点击单元格：插入引用
        editing.inp.value += ce.dataset.cellAddress; formula.value = editing.inp.value; editing.inp.focus(); return;
      }
      endEdit(true);
      if (e.shiftKey) { const anc = selAnchor || act; sel = { c0: Math.min(anc.c, p.c), r0: Math.min(anc.r, p.r), c1: Math.max(anc.c, p.c), r1: Math.max(anc.r, p.r) }; act = p; paintSel(); focusGrid(); return; }
      act = p; sel = { c0: p.c, r0: p.r, c1: p.c, r1: p.r }; selAnchor = p; paintSel();
      focusGrid();
      const mm = (ev) => {
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const c2 = t && t.closest && t.closest('.sh-cell');
        if (!c2 || !table.contains(c2)) return;
        const q = parseAddr(c2.dataset.cellAddress);
        sel = { c0: Math.min(p.c, q.c), r0: Math.min(p.r, q.r), c1: Math.max(p.c, q.c), r1: Math.max(p.r, q.r) };
        paintSel();
      };
      const mu = () => { window.removeEventListener('mousemove', mm, true); window.removeEventListener('mouseup', mu, true); };
      window.addEventListener('mousemove', mm, true); window.addEventListener('mouseup', mu, true);
    });
    table.addEventListener('dblclick', (e) => { if (e.target.closest('.sh-cell')) startEdit(null); });
    table.addEventListener('contextmenu', (e) => {
      const ce = e.target.closest('.sh-cell'); if (!ce) return;
      e.preventDefault();
      desktop.contextMenu(e.clientX, e.clientY, [
        { label: '复制', icon: 'copy', kbd: 'Ctrl+C', action: copy },
        { label: '粘贴', icon: 'paste', kbd: 'Ctrl+V', action: pasteFromClipboard },
        { label: '清除内容', icon: 'trash', kbd: 'Del', action: clearSel },
        { sep: true },
        { label: '加粗', action: () => applyFmt({ bold: true }) },
      ]);
    });
    function clearSel() { const list = []; for (let r = sel.r0; r <= sel.r1; r++) for (let c = sel.c0; c <= sel.c1; c++) list.push([addrOf(c, r), '']); setCells(list, '清除'); }
    grid.addEventListener('keydown', (e) => {
      if (editing) return;
      const k = e.key;
      if (e.ctrlKey && (k === 'z' || k === 'Z')) { e.preventDefault(); doUndo(); return; }
      if (e.ctrlKey && (k === 'y' || k === 'Y')) { e.preventDefault(); doRedo(); return; }
      if (e.ctrlKey && (k === 'c' || k === 'C')) { e.preventDefault(); copy(); return; }
      if (e.ctrlKey && (k === 'v' || k === 'V')) { e.preventDefault(); pasteFromClipboard(); return; }
      if (e.ctrlKey && (k === 's' || k === 'S')) { e.preventDefault(); save(false); return; }
      if (e.ctrlKey && (k === 'a' || k === 'A')) { e.preventDefault(); sel = { c0: 0, r0: 0, c1: COLS - 1, r1: ROWS - 1 }; paintSel(); return; }
      if (k === 'ArrowUp') { e.preventDefault(); move(0, -1, e.shiftKey); }
      else if (k === 'ArrowDown') { e.preventDefault(); move(0, 1, e.shiftKey); }
      else if (k === 'ArrowLeft') { e.preventDefault(); move(-1, 0, e.shiftKey); }
      else if (k === 'ArrowRight') { e.preventDefault(); move(1, 0, e.shiftKey); }
      else if (k === 'Enter') { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); }
      else if (k === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); }
      else if (k === 'F2') { e.preventDefault(); startEdit(null); }
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearSel(); }
      else if (k.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) { if (e.target !== sink) { e.preventDefault(); startEdit(k); } }
    });
    grid.addEventListener('keydown', (e) => { if (e.shiftKey && !selAnchor && e.key.startsWith('Arrow')) selAnchor = { ...act }; }, true);
    formula.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); setCells([[addrOf(act.c, act.r), formula.value]], '编辑'); move(0, 1); focusGrid(); }
      else if (e.key === 'Escape') { formula.value = model.raw(addrOf(act.c, act.r)); focusGrid(); }
    });
    addrBox.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const g = parseRange(addrBox.value); if (g) { sel = g; act = { c: g.c0, r: g.r0 }; paintSel(); focusGrid(); } }
    });
    // ---------- 文件 ----------
    function bookData() { return model.toJSON(title); }
    function loadBook(p) {
      const txt = fs.read(p);
      if (txt == null) { desktop.notify({ title: '打开失败', body: '文件不存在：' + p, level: 'error' }); return false; }
      let data;
      try { data = JSON.parse(txt); } catch { desktop.notify({ title: '打开失败', body: '不是有效的工作簿：' + p, level: 'error' }); return false; }
      if (data.format !== 'nest-sheet') { desktop.notify({ title: '打开失败', body: '不是 nest-sheet 工作簿', level: 'error' }); return false; }
      if (path) root.sourceClosed(docId);
      model.load(data); root.charge(20 + model.ast.size * 6);
      path = p; title = p.split('/').pop().replace(/\.sheet$/, ''); dirty = false; undo.length = 0; redo.length = 0; version++;
      act = { c: 0, r: 0 }; sel = { c0: 0, r0: 0, c1: 0, r1: 0 };
      paintAll(); updateTitle();
      return true;
    }
    function newBook() {
      if (path || dirty) root.sourceClosed(docId);
      model.load({ cells: {} }); path = null; title = '未命名工作簿'; dirty = false; undo.length = 0; redo.length = 0; version++;
      paintAll(); updateTitle();
    }
    async function save(as) {
      let p = path;
      if (!p || as) {
        const name = await desktop.prompt('保存工作簿（根系统路径）', p || '/Documents/' + (title === '未命名工作簿' ? '新工作簿' : title) + '.sheet');
        if (!name) return false;
        p = name.startsWith('/') ? name : '/Documents/' + name;
        if (!p.endsWith('.sheet')) p += '.sheet';
        if (fs.exists(p) && p !== path) {
          const r = await desktop.confirm({ title: '文件已存在', body: `覆盖 ${p}？`, ok: '覆盖', icon: 'warning' });
          if (r !== 'ok') return false;
        }
      }
      try {
        fs.write(p, JSON.stringify(bookData(), null, 1));
        path = p; title = p.split('/').pop().replace(/\.sheet$/, ''); dirty = false;
        updateTitle(); updateStatus();
        desktop.notify({ title: '工作簿已保存', body: p, level: 'ok', source: 'files' });
        return true;
      } catch (e) { desktop.notify({ title: '保存失败', body: e.message, level: 'error' }); return false; }
    }
    // 关闭或打开其他文件前：保存 / 放弃 / 取消
    async function guard(then) {
      if (!dirty) { then(); return true; }
      const r = await desktop.confirm({ title: '保存对工作簿的修改？', body: `“${title}”有未保存的修改。`, ok: '保存', extra: '放弃', cancel: '取消', icon: 'warning' });
      if (r === 'cancel') return false;
      if (r === 'ok') { const ok = await save(false); if (!ok) return false; }
      then();
      return true;
    }
    function openDialog() {
      const all = [...fs.files.keys()].filter((p) => p.endsWith('.sheet') && !p.startsWith('/System/') && !p.startsWith('/Recycle/'));
      const list = h('div', { style: { maxHeight: '260px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' } });
      const mask = h('div', { class: 'dialog-mask', tid: 'dialog' });
      for (const p of all) {
        const row = h('button', { class: 'btn', style: { justifyContent: 'flex-start' }, html: icon('sheet'), tid: 'sheet-open-item', 'data-file-path': p }, p);
        row.addEventListener('click', () => { mask.remove(); loadBook(p); });
        list.append(row);
      }
      const cancel = h('button', { class: 'btn', text: '取消', tid: 'dialog-cancel' }); cancel.onclick = () => mask.remove();
      mask.append(h('div', { class: 'dialog' }, h('h3', { text: '打开工作簿' }), all.length ? list : h('p', { text: '根系统中没有工作簿' }), h('div', { class: 'row' }, cancel)));
      desktop.desk.append(mask);
    }
    // ---------- 数据源（供子系统图表连接） ----------
    const source = {
      docId, title: () => title, path: () => path, version: () => version,
      read(range) {
        const g = parseRange(range);
        if (!g) return null;
        return { version, values: model.rangeValues(g), title };
      },
    };
    OPEN_DOCS.set(docId, source);

    if (ctx.args.path) loadBook(ctx.args.path); else { paintAll(); updateTitle(); }
    grid.addEventListener('focus', () => {});
    return {
      el,
      docId,
      onArgs(a) { if (a && a.path && a.path !== path) guard(() => loadBook(a.path)); },
      onFocus() { if (!el.contains(document.activeElement)) focusGrid(); },
      async onClose() {
        const ok = await guard(() => {});
        if (!ok) return false;
        return true;
      },
      dispose() { OPEN_DOCS.delete(docId); root.sourceClosed(docId); },
      model, get path() { return path; }, get version() { return version; }, get dirty() { return dirty; },
      select: (a) => { const p = parseAddr(a); if (p) { act = p; sel = { c0: p.c, r0: p.r, c1: p.c, r1: p.r }; paintSel(); } },
    };
  },
};
