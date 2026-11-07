// 电子表格：区域选择、编辑、公式重算、撤销重做、复制粘贴与保存
import * as M from '../../model.js';
import { el, clamp, fmtNum, pathBase } from '../../util.js';
import { ui as glyph } from '../../icons.js';
import { toast, confirmSave, promptValue, confirmDialog } from '../common.js';
import { changed } from '../../store.js';
import {
  makeDoc, docFromFile, serializeDoc, computeDoc, setCell, snapshotCells,
  applyCellsSnapshot, getValue, formatValue, addr, indexToCol, parseRange, parseCellAddress
} from '../../workbook.js';
import { publishWorkbook, markSourceClosed } from '../../databus.js';

const COLS = 16, ROWS = 40;

export function openWorkbookDoc(sys, path) {
  const existing = Object.values(sys.apps.spreadsheets).find(d => d.path === path);
  if (existing) { existing.open = true; return existing; }
  const r = docFromFile(sys, path);
  if (!r.ok) return null;
  sys.apps.spreadsheets[r.doc.id] = r.doc;
  return r.doc;
}

export function mount(ctx) {
  const { sys, win, body, ui } = ctx;
  let doc = null;
  if (win.payload.docId) doc = sys.apps.spreadsheets[win.payload.docId];
  if (!doc && win.payload.path) {
    doc = openWorkbookDoc(sys, win.payload.path);
  }
  if (!doc) {
    const path = `/Documents/未命名工作簿-${Date.now().toString(36).slice(-4)}.sheet`;
    doc = makeDoc(sys, path, { name: '未命名工作簿', cells: {} }, 'doc' + (sys.nextDoc++));
    doc.dirty = true;
    doc.open = true;
    sys.apps.spreadsheets[doc.id] = doc;
  }
  doc.open = true;
  if (win.payload.path && !doc.path) doc.path = win.payload.path;
  win.payload.docId = doc.id;
  ui.setAppTitle(sys, win.id, (doc.dirty ? '● ' : '') + doc.name, doc.path);

  const root = el('div', { class: 'app sheet' });
  const toolbar = el('div', { class: 'sheet-toolbar' });
  const filename = el('input', { class: 'sheet-filename', dataset: { testid: 'sheet-filename' }, title: '工作簿名称' });
  filename.value = doc.name;
  const dirtyDot = el('span', { class: 'sheet-dirty' + (doc.dirty ? '' : ' hidden') });
  const btnSave = el('button', { class: 'btn sm primary', dataset: { testid: 'sheet-save' }, text: '保存' });
  const btnOpen = el('button', { class: 'btn sm ghost', text: '打开' });
  const btnUndo = el('button', { class: 'iconbtn', title: '撤销', 'aria-label': '撤销', html: glyph('undo', 15) });
  const btnRedo = el('button', { class: 'iconbtn', title: '重做', 'aria-label': '重做', html: glyph('redo', 15) });
  const btnBold = el('button', { class: 'iconbtn', title: '加粗', 'aria-label': '加粗', html: glyph('bold', 15) });
  const fillColors = ['#3b2f7a', '#1f5c54', '#7a3b4f', 'transparent'];
  const btnFill = el('button', { class: 'iconbtn', title: '填充颜色', 'aria-label': '填充颜色', html: glyph('grid', 15) });
  toolbar.append(filename, dirtyDot, btnSave, btnOpen, el('div', { class: 'toolbar-sep' }), btnUndo, btnRedo, btnBold, btnFill, el('span', { class: 'spacer' }));
  toolbar.append(el('span', { class: 'pill info', text: 'A1:D4 示例 · 支持 =SUM()' }));

  const fbar = el('div', { class: 'sheet-fbar' });
  const addrBox = el('div', { class: 'sheet-addr', dataset: { testid: 'sheet-address' }, text: 'A1' });
  const formula = el('input', { class: 'sheet-formula', dataset: { testid: 'sheet-formula' }, 'aria-label': '公式栏', spellcheck: 'false' });
  fbar.append(addrBox, el('span', { style: { color: 'var(--dim)', fontSize: '11px' }, text: 'fx' }), formula);

  const gridwrap = el('div', { class: 'sheet-gridwrap' });
  const scroll = el('div', { class: 'sheet-scroll', tabindex: '0' });
  const grid = el('div', { class: 'sheet-grid', dataset: { testid: 'sheet-grid' }, role: 'grid' });
  scroll.append(grid);
  gridwrap.append(scroll);
  const tabbar = el('div', { class: 'sheet-tabbar' },
    el('div', { class: 'sheet-tab active', text: doc.sheet || 'Sheet1' }),
    el('span', { class: 'spacer', style: { flex: 1 } }),
    el('span', { style: { fontSize: '10px', color: 'var(--dim)' }, text: `版本 v${doc.version} · 未保存修改会实时发布给已连接的图表` }));
  const status = el('div', { class: 'statusbar' });
  root.append(toolbar, fbar, gridwrap, tabbar, status);
  body.append(root);

  let editing = null;
  let undoBusy = false;
  let lastCopyText = '';

  function selectionRect() {
    const a = parseCellAddress(doc.selection.anchor) || { c: 0, r: 0 };
    const f = parseCellAddress(doc.selection.focus) || a;
    return { c1: Math.min(a.c, f.c), c2: Math.max(a.c, f.c), r1: Math.min(a.r, f.r), r2: Math.max(a.r, f.r) };
  }
  function selectedAddrs() {
    const r = selectionRect(); const out = [];
    for (let row = r.r1; row <= r.r2; row++) for (let col = r.c1; col <= r.c2; col++) out.push(addr(col, row));
    return out;
  }
  function inSelection(c, r) {
    const s = selectionRect();
    return c >= s.c1 && c <= s.c2 && r >= s.r1 && r <= s.r2;
  }
  function updateAddr() {
    addrBox.textContent = doc.selection.focus || 'A1';
    const cell = doc.cells[doc.selection.focus];
    formula.value = cell ? (cell.v === undefined ? '' : String(cell.v)) : '';
    applySelectionClasses();
    updateStatus();
  }
  function applySelectionClasses() {
    const s = selectionRect();
    for (const cell of grid.querySelectorAll('.sheet-cell')) {
      const p = parseCellAddress(cell.dataset.cellAddress);
      if (!p) continue;
      const sel = inSelection(p.c, p.r);
      cell.classList.toggle('selected', sel);
      cell.classList.toggle('range', sel && !(p.c === s.c1 && p.r === s.r1));
      cell.classList.toggle('anchor', !!p && p.addr === doc.selection.anchor || p.addr === doc.selection.focus);
    }
  }
  function updateStatus() {
    status.innerHTML = '';
    const addrs = selectedAddrs();
    const nums = addrs.map(a => getValue(doc, a)).filter(v => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))).map(Number);
    const sum = nums.reduce((a, b) => a + b, 0);
    const errors = Object.keys(doc.errors || {});
    status.append(
      el('span', { text: `选区 ${doc.selection.anchor}:${doc.selection.focus} · ${addrs.length} 个单元格` }),
      el('span', { text: nums.length ? `求和 ${fmtNum(sum, 2)} · 平均 ${fmtNum(sum / nums.length, 2)}` : '无数字' }),
      el('span', { class: 'spacer', style: { flex: 1 } }),
      errors.length ? el('span', { style: { color: 'var(--danger)' }, text: `${errors.length} 个公式错误：${errors.slice(0, 3).map(e => e + '=' + doc.errors[e]).join('，')}` }) : el('span', { text: '公式已重算' }),
      el('span', { text: `存储 ${(M.storageUsed(sys) / 1024).toFixed(1)} KB` })
    );
  }
  function cellNode(c, r) {
    const a = addr(c, r);
    const cell = doc.cells[a] || {};
    const v = getValue(doc, a);
    const isErr = typeof v === 'string' && v.startsWith('#');
    const node = el('div', {
      class: 'sheet-cell' + (isErr ? ' err' : '') + (cell.s && cell.s.bold ? ' bold' : '') + (cell.s && cell.s.fill === 'h' ? ' head' : ''),
      dataset: { testid: 'sheet-cell', 'cell-address': a },
      role: 'gridcell', tabindex: '-1'
    });
    if (cell.s && cell.s.fill && cell.s.fill !== 'h') node.style.background = cell.s.fill;
    if (cell.s && cell.s.align) node.style.justifyContent = cell.s.align;
    const text = cell.v !== undefined && String(cell.v).startsWith('=') ? formatValue(v) : formatValue(cell.v);
    node.append(el('span', { class: typeof v === 'number' ? 'num' : '', text }));
    node.addEventListener('mousedown', (e) => {
      if (editing) commitEditing();
      e.preventDefault();
      startSelect(c, r, e);
    });
    node.addEventListener('dblclick', () => startEdit(a));
    grid.append(node);
    return node;
  }
  function renderGrid() {
    const scrollTop = scroll.scrollTop, scrollLeft = scroll.scrollLeft;
    grid.innerHTML = '';
    grid.append(el('div', { class: 'sheet-corner' }));
    for (let c = 0; c < COLS; c++) grid.append(el('div', { class: 'sheet-colhead', text: indexToCol(c) }));
    for (let r = 0; r < ROWS; r++) {
      grid.append(el('div', { class: 'sheet-rowhead', text: String(r + 1) }));
      for (let c = 0; c < COLS; c++) cellNode(c, r);
    }
    scroll.scrollTop = scrollTop; scroll.scrollLeft = scrollLeft;
    updateAddr();
  }
  function startSelect(c, r, e) {
    const a = addr(c, r);
    if (e.shiftKey) doc.selection.focus = a;
    else { doc.selection.anchor = a; doc.selection.focus = a; }
    updateAddr();
    const move = (ev) => {
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.sheet-cell');
      if (target && grid.contains(target)) { doc.selection.focus = target.dataset.cellAddress; updateAddr(); }
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  }
  function pushUndo() {
    if (undoBusy) return;
    doc.undo.push({ cells: snapshotCells(doc), sel: { ...doc.selection } });
    if (doc.undo.length > 60) doc.undo.shift();
    doc.redo = [];
  }
  function commit(a, raw, style) {
    pushUndo();
    setCell(doc, a, raw, style);
    doc.dirty = true;
    refreshAfterEdit();
    publish();
  }
  function refreshAfterEdit() {
    renderGrid();
    dirtyDot.classList.toggle('hidden', !doc.dirty);
    ui.setAppTitle(sys, win.id, (doc.dirty ? '● ' : '') + doc.name, doc.path);
    M.chargeWork(sys, 'spreadsheet', 30 + Object.keys(doc.cells).length * 1.2);
    // 保持网格键盘焦点，使 Enter 后 Ctrl+C / 方向键仍然可用
    try { scroll.focus({ preventScroll: true }); } catch (e) {}
    changed('sheet-edit');
  }
  function publish() {
    if (!sys.isRoot) return;
    try { publishWorkbook(ui.model, sys, doc); } catch (e) { console.warn(e); }
  }
  function startEdit(a) {
    if (editing) commitEditing();
    const node = grid.querySelector(`[data-cell-address="${a}"]`);
    if (!node) return;
    doc.selection.anchor = a; doc.selection.focus = a;
    editing = { a, node, old: doc.cells[a] ? doc.cells[a].v : undefined };
    node.innerHTML = '';
    const input = el('input', { value: editing.old === undefined ? '' : String(editing.old), spellcheck: 'false' });
    node.append(input);
    input.focus(); input.select();
    editing.input = input;
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); commitEditing(1, 0); }
      else if (ev.key === 'Tab') { ev.preventDefault(); commitEditing(0, 1); }
      else if (ev.key === 'Escape') { ev.preventDefault(); cancelEditing(); }
    });
    input.addEventListener('blur', () => { if (editing && editing.a === a) commitEditing(); });
  }
  function commitEditing(dr = 0, dc = 0) {
    if (!editing) return;
    const { a, input, old } = editing;
    const val = input.value;
    editing = null;
    if (String(val) !== String(old === undefined ? '' : old)) commit(a, val);
    else renderGrid();
    if (dr || dc) moveSelection(dr, dc);
  }
  function cancelEditing() {
    if (!editing) return;
    editing = null;
    renderGrid();
  }
  function moveSelection(dr, dc) {
    const p = parseCellAddress(doc.selection.focus) || { c: 0, r: 0 };
    const c = clamp(p.c + dc, 0, COLS - 1), r = clamp(p.r + dr, 0, ROWS - 1);
    doc.selection.anchor = addr(c, r); doc.selection.focus = doc.selection.anchor;
    updateAddr();
    const node = grid.querySelector(`[data-cell-address="${doc.selection.anchor}"]`);
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function toolbarCommit() {
    const a = doc.selection.anchor;
    commit(a, formula.value);
    formula.blur();
  }
  formula.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); toolbarCommit(); moveSelection(1, 0); }
    else if (e.key === 'Escape') { updateAddr(); formula.blur(); }
    e.stopPropagation();
  });
  formula.addEventListener('focus', () => { doc.selection.anchor = doc.selection.focus; });

  grid.addEventListener('mousedown', (e) => { if (e.target.closest('.sheet-cell')) scroll.focus({ preventScroll: true }); });
  scroll.addEventListener('keydown', (e) => {
    if (editing) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (ctrl && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection(); return; }
    if (ctrl && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteSelection(); return; }
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (e.shiftKey) {
        const p = parseCellAddress(doc.selection.focus) || { c: 0, r: 0 };
        doc.selection.focus = addr(clamp(p.c + d[1], 0, COLS - 1), clamp(p.r + d[0], 0, ROWS - 1));
        updateAddr();
      } else moveSelection(d[0], d[1]);
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); startEdit(doc.selection.focus); return; }
    if (e.key === 'F2') { e.preventDefault(); startEdit(doc.selection.focus); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      pushUndo();
      for (const a of selectedAddrs()) delete doc.cells[a];
      computeDoc(doc); doc.dirty = true; refreshAfterEdit(); publish(); return;
    }
    if (e.key.length === 1 && !ctrl && !e.altKey) {
      startEdit(doc.selection.focus);
      if (editing) { editing.input.value = e.key; editing.input.setSelectionRange(1, 1); }
      e.preventDefault();
    }
  });
  function copySelection() {
    const rect = selectionRect();
    const lines = [];
    for (let r = rect.r1; r <= rect.r2; r++) {
      const row = [];
      for (let c = rect.c1; c <= rect.c2; c++) {
        const v = getValue(doc, addr(c, r));
        row.push(v === undefined || v === null ? '' : String(v));
      }
      lines.push(row.join('\t'));
    }
    const text = lines.join('\n');
    lastCopyText = text;
    try { navigator.clipboard.writeText(text); } catch (e) { }
    if (sys.isRoot) {
      sys.widgets.clipboard = sys.widgets.clipboard || [];
      sys.widgets.clipboard.unshift({ text, time: sys.clock, source: `${doc.name}!${doc.selection.anchor}:${doc.selection.focus}` });
      if (sys.widgets.clipboard.length > 40) sys.widgets.clipboard.length = 40;
      changed('clipboard');
    }
    M.chargeWork(sys, 'spreadsheet', 20 + text.length / 8);
    toast('已复制', `${text.split('\n').length} 行 × ${text.split('\n')[0].split('\t').length} 列，已加入剪贴板历史。`, 'info', sys);
  }
  async function pasteSelection() {
    let text = lastCopyText;
    try { const t = await navigator.clipboard.readText(); if (t) text = t; } catch (e) { }
    if (!text) return;
    const p = parseCellAddress(doc.selection.anchor) || { c: 0, r: 0 };
    const rows = text.replace(/\r/g, '').split('\n');
    pushUndo();
    rows.forEach((line, ri) => {
      line.split('\t').forEach((v, ci) => {
        const c = p.c + ci, r = p.r + ri;
        if (c >= COLS || r >= ROWS) return;
        const a = addr(c, r);
        const num = v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : v;
        doc.cells[a] = { v: num };
      });
    });
    computeDoc(doc);
    doc.dirty = true;
    refreshAfterEdit(); publish();
    toast('已粘贴', `从 ${doc.selection.anchor} 开始粘贴 ${rows.length} 行。`, 'ok', sys);
  }
  function doUndo() {
    if (!doc.undo.length) { toast('没有可撤销的操作', '', 'info', sys); return; }
    undoBusy = true;
    const cur = { cells: snapshotCells(doc), sel: { ...doc.selection } };
    doc.redo.push(cur);
    const snap = doc.undo.pop();
    applyCellsSnapshot(doc, snap.cells);
    doc.selection = snap.sel || doc.selection;
    doc.dirty = true;
    undoBusy = false;
    refreshAfterEdit(); publish();
  }
  function doRedo() {
    if (!doc.redo.length) { toast('没有可重做的操作', '', 'info', sys); return; }
    const cur = { cells: snapshotCells(doc), sel: { ...doc.selection } };
    doc.undo.push(cur);
    const snap = doc.redo.pop();
    applyCellsSnapshot(doc, snap.cells);
    doc.selection = snap.sel || doc.selection;
    doc.dirty = true;
    refreshAfterEdit(); publish();
  }
  btnUndo.addEventListener('click', doUndo);
  btnRedo.addEventListener('click', doRedo);
  btnBold.addEventListener('click', () => {
    pushUndo();
    for (const a of selectedAddrs()) {
      doc.cells[a] = doc.cells[a] || { v: '' };
      doc.cells[a].s = { ...(doc.cells[a].s || {}), bold: !(doc.cells[a].s && doc.cells[a].s.bold) };
    }
    doc.dirty = true; refreshAfterEdit(); publish(); changed('sheet-style');
  });
  btnFill.addEventListener('click', () => {
    const colors = ['#3b2f7a', '#1f5c54', '#7a3b4f', ''];
    const cur = (doc.cells[doc.selection.anchor]?.s || {}).fill || '';
    const next = colors[(colors.indexOf(cur) + 1) % colors.length];
    pushUndo();
    for (const a of selectedAddrs()) {
      doc.cells[a] = doc.cells[a] || { v: '' };
      doc.cells[a].s = { ...(doc.cells[a].s || {}) };
      if (next) doc.cells[a].s.fill = next; else delete doc.cells[a].s.fill;
    }
    doc.dirty = true; refreshAfterEdit(); publish(); changed('sheet-style');
  });
  filename.addEventListener('change', () => {
    doc.name = filename.value.trim() || doc.name;
    doc.dirty = true;
    refreshAfterEdit();
  });
  filename.addEventListener('keydown', e => e.stopPropagation());

  async function save(force = false) {
    if (!doc.path || force) {
      const p = await promptValue(sys, '保存工作簿', '保存路径（.sheet）', doc.path || '/Documents/我的工作簿.sheet');
      if (!p) return false;
      doc.path = p.endsWith('.sheet') ? p : p + '.sheet';
    }
    const r = M.fsWrite(sys, doc.path, serializeDoc(doc), 'application/x-nested-sheet');
    if (!r.ok) { toast('保存失败', r.error, 'err', sys); return false; }
    doc.dirty = false;
    M.chargeWork(sys, 'spreadsheet', 120 + Object.keys(doc.cells).length * 2);
    refreshAfterEdit();
    toast('工作簿已保存', doc.path, 'ok', sys);
    changed('sheet-save');
    return true;
  }
  btnSave.addEventListener('click', () => save(false));
  btnOpen.addEventListener('click', async () => {
    if (doc.dirty) {
      const ch = await confirmSave(sys, '未保存的修改', `「${doc.name}」有未保存的修改。打开其他工作簿前要保存吗？`);
      if (ch === 'cancel') return;
      if (ch === 'save') { const ok = await save(false); if (!ok) return; }
    }
    const files = [];
    const walk = (dir) => { for (const f of M.fsList(sys, dir)) { if (f.type === 'dir') walk(f.path); else if (f.name.endsWith('.sheet')) files.push(f.path); } };
    walk('/');
    const { chooseFromList } = await import('../common.js');
    const item = await chooseFromList(sys, { title: '打开工作簿', items: files.map(f => ({ label: f, path: f })), emptyText: '没有 .sheet 文件' });
    if (!item) return;
    const nd = openWorkbookDoc(sys, item.path);
    if (!nd) { toast('打开失败', '工作簿无法解析', 'err', sys); return; }
    if (nd.id === doc.id) return;
    M.closeWindow(ui.model, sys, win.id);
    ui.openSpreadsheet(sys, item.path);
    ui.refresh('sheet-open');
  });

  function requestClose() {
    return (async () => {
      if (doc.dirty) {
        const ch = await confirmSave(sys, '未保存的工作簿', `「${doc.name}」有未保存的修改。关闭前要保存吗？`);
        if (ch === 'cancel') return false;
        if (ch === 'save') { const ok = await save(false); if (!ok) return false; }
      }
      doc.open = false;
      markSourceClosed(ui.model, doc);
      changed('sheet-close');
      return true;
    })();
  }

  renderGrid();
  updateAddr();
  if (doc.dirty) dirtyDot.classList.remove('hidden');
  return {
    requestClose,
    destroy() { },
    refreshGrid() { if (!editing) renderGrid(); }
  };
}
