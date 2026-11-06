// 电子表格（根系统应用）与实时数据中枢。公式重算和数据发布都按规模计费，付清后才生效。
import { h } from './desktop.js';

const COLS = 26, ROWS = 80;
export const colName = (i) => String.fromCharCode(65 + i);
const colIndex = (s) => s.charCodeAt(0) - 65;
const addr = (c, r) => colName(c) + (r + 1);
export function parseAddr(a) {
  const m = /^([A-Za-z])(\d+)$/.exec(a.trim());
  if (!m) return null;
  const c = colIndex(m[1].toUpperCase()), r = parseInt(m[2], 10) - 1;
  if (r < 0 || c < 0 || c >= COLS) return null;
  return [c, r];
}
export function parseRange(s) {
  const p = String(s).trim().split(':');
  const a = parseAddr(p[0]);
  const b = parseAddr(p[1] || p[0]);
  if (!a || !b) return null;
  return { c0: Math.min(a[0], b[0]), r0: Math.min(a[1], b[1]), c1: Math.max(a[0], b[0]), r1: Math.max(a[1], b[1]) };
}

// —— 公式：四则运算、括号、单元格与区域引用、SUM ——
function tokenize(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++; out.push({ t: 'n', v: parseFloat(src.slice(i, j)) }); i = j; continue; }
    if (/[A-Za-z]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j).toUpperCase() }); i = j; continue;
    }
    if ('+-*/():,'.includes(c)) { out.push({ t: c }); i++; continue; }
    if (c === '"') { let j = i + 1; while (j < src.length && src[j] !== '"') j++; out.push({ t: 's', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    throw new Error('#NAME?');
  }
  return out;
}
export function parseFormula(text) {
  const toks = tokenize(text);
  let p = 0;
  const peek = () => toks[p];
  const expr = () => {
    let a = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) { const o = toks[p++].t; a = { k: 'bin', o, a, b: term() }; }
    return a;
  };
  const term = () => {
    let a = unary();
    while (peek() && (peek().t === '*' || peek().t === '/')) { const o = toks[p++].t; a = { k: 'bin', o, a, b: unary() }; }
    return a;
  };
  const unary = () => {
    if (peek() && peek().t === '-') { p++; return { k: 'neg', a: unary() }; }
    if (peek() && peek().t === '+') { p++; return unary(); }
    return prim();
  };
  const prim = () => {
    const t = toks[p++];
    if (!t) throw new Error('#ERROR!');
    if (t.t === 'n') return { k: 'num', v: t.v };
    if (t.t === 's') return { k: 'str', v: t.v };
    if (t.t === '(') { const e = expr(); if (!peek() || toks[p++].t !== ')') throw new Error('#ERROR!'); return e; }
    if (t.t === 'id') {
      if (peek() && peek().t === '(') {
        p++;
        const args = [];
        if (peek() && peek().t !== ')') {
          for (;;) {
            args.push(argument());
            if (peek() && peek().t === ',') { p++; continue; }
            break;
          }
        }
        if (!peek() || toks[p++].t !== ')') throw new Error('#ERROR!');
        if (t.v !== 'SUM') throw new Error('#NAME?');
        return { k: 'sum', args };
      }
      const a = parseAddr(t.v);
      if (!a) throw new Error(/^[A-Z]+\d+$/.test(t.v) ? '#REF!' : '#NAME?');
      return { k: 'ref', c: a[0], r: a[1] };
    }
    throw new Error('#ERROR!');
  };
  const argument = () => {
    const start = p;
    const t = toks[p];
    if (t && t.t === 'id' && toks[p + 1] && toks[p + 1].t === ':' && toks[p + 2] && toks[p + 2].t === 'id') {
      const a = parseAddr(t.v), b = parseAddr(toks[p + 2].v);
      if (!a || !b) throw new Error('#REF!');
      p += 3;
      return { k: 'range', c0: Math.min(a[0], b[0]), r0: Math.min(a[1], b[1]), c1: Math.max(a[0], b[0]), r1: Math.max(a[1], b[1]) };
    }
    p = start;
    return expr();
  };
  const e = expr();
  if (p !== toks.length) throw new Error('#ERROR!');
  return e;
}
function shiftFormula(text, dc, dr) {
  return text.replace(/\b([A-Za-z])(\d+)\b/g, (m, col, row) => {
    const c = colIndex(col.toUpperCase()) + dc, r = parseInt(row, 10) + dr;
    if (c < 0 || c >= COLS || r < 1) return '#REF!';
    return colName(c) + r;
  });
}

// 工作簿：单工作表，单元格原值 + 基本格式
export class Workbook {
  constructor() {
    this.cells = new Map();   // A1 -> { v, b, i, align, color, bg, nf }
    this.values = new Map();  // A1 -> 计算值或 { err }
    this.version = 0;
  }
  get(a) { return this.cells.get(a) || null; }
  raw(a) { const c = this.cells.get(a); return c ? c.v : ''; }
  setRaw(a, v) {
    const c = this.cells.get(a) || {};
    if (v === '' && !c.b && !c.i && !c.align && !c.color && !c.bg && !c.nf) this.cells.delete(a);
    else { c.v = v; this.cells.set(a, c); }
  }
  // 按依赖关系重算：只算受影响的单元格；返回实际计算的公式数
  recalc() {
    const asts = new Map();
    const val = new Map();
    const state = new Map();
    let count = 0;
    for (const [a, c] of this.cells) {
      if (typeof c.v === 'string' && c.v.startsWith('=')) {
        try { asts.set(a, parseFormula(c.v.slice(1))); } catch (e) { asts.set(a, { k: 'err', v: e.message }); }
      }
    }
    const value = (a) => {
      if (state.get(a) === 2) return val.get(a);
      if (state.get(a) === 1) return { err: '#CYCLE!' };
      if (!asts.has(a)) {
        const c = this.cells.get(a);
        if (!c) return null;
        const n = Number(c.v);
        return c.v !== '' && !Number.isNaN(n) ? n : c.v;
      }
      state.set(a, 1);
      count++;
      const r = ev(asts.get(a));
      const cyc = r && r.err === '#CYCLE!';
      state.set(a, 2);
      val.set(a, r);
      void cyc;
      return r;
    };
    const num = (v) => {
      if (v && v.err) return v;
      if (v === null || v === '') return 0;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return Number.isNaN(n) ? { err: '#VALUE!' } : n;
    };
    const ev = (n) => {
      switch (n.k) {
        case 'err': return { err: n.v };
        case 'num': return n.v;
        case 'str': return n.v;
        case 'ref': return value(addr(n.c, n.r));
        case 'neg': { const a = num(ev(n.a)); return a && a.err ? a : -a; }
        case 'bin': {
          const a = num(ev(n.a)); if (a && a.err) return a;
          const b = num(ev(n.b)); if (b && b.err) return b;
          if (n.o === '+') return a + b;
          if (n.o === '-') return a - b;
          if (n.o === '*') return a * b;
          if (b === 0) return { err: '#DIV/0!' };
          return a / b;
        }
        case 'sum': {
          let s = 0;
          for (const g of n.args) {
            if (g.k === 'range') {
              for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) {
                const v = value(addr(c, r));
                if (v && v.err) return v;
                if (typeof v === 'number') s += v;
                else if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) s += Number(v);
              }
            } else { const v = num(ev(g)); if (v && v.err) return v; s += v; }
          }
          return s;
        }
        default: return { err: '#ERROR!' };
      }
    };
    this.values = new Map();
    for (const a of this.cells.keys()) this.values.set(a, value(a));
    for (const [a, v] of val) if (!this.values.has(a)) this.values.set(a, v);
    return count;
  }
  display(a) {
    const v = this.values.get(a);
    if (v === undefined || v === null) return '';
    if (v.err) return v.err;
    if (typeof v === 'number') {
      const c = this.cells.get(a);
      if (c && c.nf !== undefined && c.nf !== null && c.nf !== '') return v.toFixed(+c.nf);
      return String(+v.toFixed(8));
    }
    return String(v);
  }
  toJSON(title) {
    const cells = {};
    for (const [a, c] of this.cells) cells[a] = { ...c };
    return { format: 'nest-sheet', version: 1, title, cells };
  }
  load(doc) {
    this.cells = new Map(Object.entries(doc.cells || {}).map(([a, c]) => [a, { ...c }]));
    this.recalc();
  }
  rangeRows(rg) {
    const rows = [];
    for (let r = rg.r0; r <= rg.r1; r++) {
      const row = [];
      for (let c = rg.c0; c <= rg.c1; c++) {
        const v = this.values.get(addr(c, r));
        row.push(v === undefined ? null : v && v.err ? v.err : v);
      }
      rows.push(row);
    }
    return rows;
  }
}

// —— 实时数据中枢：连接按工作簿文档身份与选区建立，数据以副本向下传递 ——
export class DataHub {
  constructor(kernel) {
    this.K = kernel;
    this.docs = new Map();
    this.subs = new Map();
    kernel.dataHub = this;
  }
  deliver(path, pid, data) { this.K.route({ dst: path, op: 'deliver', pid, data }); }
  registerDoc(doc) { this.docs.set(doc.id, doc); this.broadcastSources(); }
  sources(m) {
    this.deliver(m.reply, m.pid, { type: 'data_sources', tag: m.tag, list: [...this.docs.values()].map((d) => ({ id: d.id, title: d.title() })) });
    (this.watchers = this.watchers || new Map()).set(m.reply + '|' + m.pid, m);
  }
  broadcastSources() {
    for (const m of (this.watchers || new Map()).values()) {
      this.deliver(m.reply, m.pid, { type: 'data_sources', tag: m.tag, list: [...this.docs.values()].map((d) => ({ id: d.id, title: d.title() })) });
    }
  }
  connect(m) {
    const doc = this.docs.get(m.doc);
    const rg = parseRange(m.range);
    if (!doc) { this.deliver(m.reply, m.pid, { type: 'data_error', sub: m.sub, error: '数据源不存在或已关闭，请重新选择工作簿' }); return; }
    if (!rg) { this.deliver(m.reply, m.pid, { type: 'data_error', sub: m.sub, error: '区域无效：' + m.range }); return; }
    const sub = { id: m.sub, doc: m.doc, range: m.range, rg, reply: m.reply, pid: m.pid };
    this.subs.set(m.sub, sub);
    this.publishTo(doc, sub);
  }
  disconnect(id) { this.subs.delete(id); }
  publishTo(doc, sub) {
    const rows = doc.wb.rangeRows(sub.rg);
    this.deliver(sub.reply, sub.pid, { type: 'data', sub: sub.id, doc: doc.id, title: doc.title(), range: sub.range, version: doc.wb.version, rows });
  }
  // 每次提交重算完成后调用：发布各订阅选区的新版本
  publish(doc) {
    for (const sub of this.subs.values()) if (sub.doc === doc.id) this.publishTo(doc, sub);
  }
  publishCost(doc) {
    let n = 0;
    for (const sub of this.subs.values()) if (sub.doc === doc.id) n += (sub.rg.r1 - sub.rg.r0 + 1) * (sub.rg.c1 - sub.rg.c0 + 1);
    return n;
  }
  docClosed(doc) {
    this.docs.delete(doc.id);
    for (const [id, sub] of [...this.subs]) {
      if (sub.doc === doc.id) {
        this.deliver(sub.reply, sub.pid, { type: 'data_closed', sub: id, title: doc.title() });
        this.subs.delete(id);
      }
    }
    this.broadcastSources();
  }
  retitle() { this.broadcastSources(); }
  // 子树停止时释放其中的订阅
  dropScope(scope) {
    const set = new Set(scope);
    for (const [id, sub] of [...this.subs]) {
      const parts = sub.reply.split('/');
      if (set.has(parts[parts.length - 1])) this.subs.delete(id);
    }
    if (this.watchers) for (const [k, m] of [...this.watchers]) { const p = m.reply.split('/'); if (set.has(p[p.length - 1])) this.watchers.delete(k); }
  }
}

let nextDoc = 1;

// —— 电子表格窗口 ——
export function sheetApp(desk, args) {
  const K = desk.K, FS = K.fs, hub = desk.hub;
  // 已打开的文件直接切到前面
  if (args.file) {
    for (const w of desk.windows.values()) if (w.app === 'spreadsheet' && w.doc && w.doc.path === args.file) { desk.restore(w); return w; }
  }
  const svc = K.newService('电子表格', 'spreadsheet');
  const wb = new Workbook();
  const doc = { id: 'doc-' + nextDoc++, wb, path: '', name: '未命名工作簿', title: () => `${doc.name}${dirty ? ' *' : ''}` };
  let dirty = false;
  let active = [0, 0];
  let selEnd = [0, 0];
  let editing = null;
  const undo = [], redo = [];
  let pending = 0;

  const nameEl = h('input', { class: 'rfield', tid: 'sheet-filename', 'data-system-id': 'outer', style: 'width:230px', label: '工作簿路径', value: '/Documents/新工作簿.sheet' });
  const formula = h('input', { class: 'rfield', tid: 'sheet-formula', 'data-system-id': 'outer', style: 'flex:1;min-width:100px', label: '编辑栏', onkeydown: onFormulaKey, oninput: () => { if (editing) editing.input.value = formula.value; } });
  const cellLabel = h('div', { class: 'rlabel mono', style: 'width:64px;text-align:center', text: 'A1', tid: 'sheet-active' });
  const status = h('div', { class: 'pane-status', tid: 'sheet-status' });
  const setStatus = (t, err) => { status.textContent = t; status.classList.toggle('err', !!err); };
  const grid = h('div', { class: 'sheet-grid', tid: 'sheet-grid', 'data-system-id': 'outer', style: `grid-template-columns:44px repeat(${COLS},104px)` });
  const wrap = h('div', { class: 'sheet-wrap' }, grid);
  const cellEls = new Map(), colEls = [], rowEls = [];
  grid.appendChild(h('div', { class: 'sh-corner' }));
  for (let c = 0; c < COLS; c++) { const e = h('div', { class: 'sh-col', text: colName(c) }); colEls.push(e); grid.appendChild(e); }
  for (let r = 0; r < ROWS; r++) {
    const e = h('div', { class: 'sh-row', text: String(r + 1) }); rowEls.push(e); grid.appendChild(e);
    for (let c = 0; c < COLS; c++) {
      const a = addr(c, r);
      const el = document.createElement('div');
      el.className = 'sheet-cell';
      el.dataset.testid = 'sheet-cell';
      el.dataset.cellAddress = a;
      el.dataset.systemId = 'outer';
      el.dataset.c = c;
      el.dataset.r = r;
      cellEls.set(a, el);
      grid.appendChild(el);
    }
  }
  // 透明的接收框跟随活动单元格：键入字符（含输入法）转成单元格编辑
  const catcher = h('input', { class: 'sheet-catcher', tid: 'sheet-input', 'data-system-id': 'outer', label: '单元格输入', autocomplete: 'off', style: 'position:absolute;width:6px;height:6px;opacity:0;border:0;padding:0;z-index:0;background:transparent' });
  let composing = false;
  catcher.addEventListener('compositionstart', () => { composing = true; });
  catcher.addEventListener('compositionend', (e) => { composing = false; const v = catcher.value || e.data || ''; catcher.value = ''; if (v) beginEdit(v); });
  catcher.addEventListener('input', () => { if (composing) return; const v = catcher.value; catcher.value = ''; if (v) beginEdit(v); });
  grid.appendChild(catcher);
  const selRect = () => ({ c0: Math.min(active[0], selEnd[0]), c1: Math.max(active[0], selEnd[0]), r0: Math.min(active[1], selEnd[1]), r1: Math.max(active[1], selEnd[1]) });

  function renderCell(a) {
    const el = cellEls.get(a);
    if (!el) return;
    const c = wb.get(a);
    const v = wb.values.get(a);
    el.textContent = wb.display(a);
    const isNum = typeof v === 'number';
    const isErr = v && v.err;
    let cls = 'sheet-cell';
    if (isNum) cls += ' num';
    if (isErr) cls += ' err';
    el.className = cls;
    el.style.fontWeight = c && c.b ? '700' : '';
    el.style.fontStyle = c && c.i ? 'italic' : '';
    el.style.textAlign = c && c.align ? c.align : '';
    el.style.color = c && c.color ? c.color : '';
    el.style.backgroundColor = c && c.bg ? c.bg : '';
    if (isErr) el.title = { '#DIV/0!': '除数为零', '#REF!': '引用无效', '#CYCLE!': '存在循环依赖', '#NAME?': '无法识别的名称', '#VALUE!': '不是数字', '#ERROR!': '公式有误' }[v.err] || v.err;
    else el.removeAttribute('title');
  }
  function renderAll() { for (const a of cellEls.keys()) renderCell(a); renderSelection(); }
  let lastSel = [];
  function renderSelection() {
    for (const el of lastSel) el.classList.remove('insel', 'active', 'on');
    lastSel = [];
    const s = selRect();
    for (let r = s.r0; r <= s.r1 && r < ROWS; r++) {
      for (let c = s.c0; c <= s.c1 && c < COLS; c++) { const el = cellEls.get(addr(c, r)); el.classList.add('insel'); lastSel.push(el); }
      rowEls[r].classList.add('on'); lastSel.push(rowEls[r]);
    }
    for (let c = s.c0; c <= s.c1 && c < COLS; c++) { colEls[c].classList.add('on'); lastSel.push(colEls[c]); }
    const a = addr(active[0], active[1]);
    const ae = cellEls.get(a);
    ae.classList.add('active'); lastSel.push(ae);
    cellLabel.textContent = s.c0 === s.c1 && s.r0 === s.r1 ? a : `${addr(s.c0, s.r0)}:${addr(s.c1, s.r1)}`;
    if (document.activeElement !== formula && !editing) formula.value = wb.raw(a);
    updateStatus();
  }
  function updateStatus() {
    const s = selRect();
    let sum = 0, n = 0;
    for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) { const v = wb.values.get(addr(c, r)); if (typeof v === 'number') { sum += v; n++; } }
    setStatus(`${doc.path || '未保存的新工作簿'}${dirty ? ' · 有未保存修改' : ''}${pending ? ' · 重算中…' : ''} · 版本 ${wb.version}${n > 1 ? ` · 选区合计 ${+sum.toFixed(6)}` : ''}`);
  }
  function setDirty(d) {
    if (dirty === d) return;
    dirty = d;
    desk.setTitle(win, `${dirty ? '● ' : ''}${doc.name} — 电子表格`);
    saveBtn.classList.toggle('primary', dirty);
    hub.retitle();
  }
  // 提交一批修改：记录撤销，重算计费，完成后发布新版本
  function commit(changes, label) {
    if (!changes.length) return;
    undo.push(changes);
    if (undo.length > 200) undo.shift();
    redo.length = 0;
    apply(changes, 'new');
    void label;
  }
  function apply(changes, which) {
    for (const ch of changes) {
      const nv = which === 'new' ? ch.after : ch.before;
      if (nv) wb.cells.set(ch.a, { ...nv });
      else wb.cells.delete(ch.a);
    }
    setDirty(true);
    afterEdit();
  }
  function afterEdit() {
    pending++;
    updateStatus();
    const cost = 30 + wb.cells.size * 6 + hub.publishCost(doc) * 3;
    K.addWork(svc, cost, () => {
      pending--;
      wb.version++;
      wb.recalc();
      renderAll();
      hub.publish(doc);
    });
  }
  const snap = (a) => { const c = wb.get(a); return c ? { ...c } : null; };
  function setCellValue(a, v) {
    const before = snap(a);
    const after = { ...(before || {}), v };
    if (v === '' && !after.b && !after.i && !after.align && !after.color && !after.bg && !after.nf) return { a, before, after: null };
    return { a, before, after };
  }
  function moveTo(c, r, keepEnd) {
    c = Math.max(0, Math.min(COLS - 1, c)); r = Math.max(0, Math.min(ROWS - 1, r));
    if (keepEnd) selEnd = [c, r];
    else { active = [c, r]; selEnd = [c, r]; }
    renderSelection();
    const el = cellEls.get(addr(c, r));
    if (el.scrollIntoViewIfNeeded) el.scrollIntoViewIfNeeded(false);
    if (!editing) placeCatcher();
  }
  function beginEdit(initial) {
    if (editing) return;
    const a = addr(active[0], active[1]);
    const el = cellEls.get(a);
    const input = h('input', { class: 'sheet-editor', tid: 'sheet-editor', style: `left:${el.offsetLeft}px;top:${el.offsetTop}px;width:${Math.max(el.offsetWidth, 120)}px;height:${el.offsetHeight}px`, value: initial !== undefined ? initial : wb.raw(a), onkeydown: onEditKey, oninput: () => { formula.value = input.value; } });
    grid.appendChild(input);
    editing = { a, input };
    formula.value = input.value;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  function commitEdit(move) {
    if (!editing) return;
    const { a, input } = editing;
    const v = input.value;
    input.remove();
    editing = null;
    if (v !== wb.raw(a)) commit([setCellValue(a, v)]);
    if (move) moveTo(active[0] + move[0], active[1] + move[1]);
    focusGrid();
  }
  function cancelEdit() { if (!editing) return; editing.input.remove(); editing = null; renderSelection(); focusGrid(); }
  function focusGrid() { placeCatcher(); catcher.focus({ preventScroll: true }); }
  function placeCatcher() {
    const el = cellEls.get(addr(active[0], active[1]));
    catcher.style.left = el.offsetLeft + 'px'; catcher.style.top = el.offsetTop + 'px';
  }
  function onEditKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit([0, e.shiftKey ? -1 : 1]); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit([e.shiftKey ? -1 : 1, 0]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
  }
  function onFormulaKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const a = addr(active[0], active[1]);
      const v = formula.value;
      if (editing) { editing.input.remove(); editing = null; }
      if (v !== wb.raw(a)) commit([setCellValue(a, v)]);
      moveTo(active[0], active[1] + 1);
      formula.blur();
    } else if (e.key === 'Escape') { formula.value = wb.raw(addr(active[0], active[1])); formula.blur(); cancelEdit(); }
  }
  formula.addEventListener('change', () => {
    // 外部脚本 fill + change 也算一次提交（按 Enter 时已处理则无差异）
    const a = addr(active[0], active[1]);
    if (formula.value !== wb.raw(a) && !editing) commit([setCellValue(a, formula.value)]);
  });
  function selectionText() {
    const s = selRect();
    const rows = [];
    for (let r = s.r0; r <= s.r1; r++) {
      const row = [];
      for (let c = s.c0; c <= s.c1; c++) row.push(wb.display(addr(c, r)));
      rows.push(row.join('\t'));
    }
    return rows.join('\n');
  }
  function copy(cut) {
    const s = selRect();
    const text = selectionText();
    const cells = [];
    for (let r = s.r0; r <= s.r1; r++) { const row = []; for (let c = s.c0; c <= s.c1; c++) row.push(snap(addr(c, r))); cells.push(row); }
    desk.sheetClip = { text, cells, c0: s.c0, r0: s.r0, cut: !!cut, doc: doc.id };
    desk.clipboardAdd(text, 'sheet');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    setStatus(`已${cut ? '剪切' : '复制'}选区`);
    if (cut) {
      const ch = [];
      for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) { const a = addr(c, r); if (wb.get(a)) ch.push({ a, before: snap(a), after: null }); }
      commit(ch);
    }
  }
  async function paste() {
    let text = null;
    if (navigator.clipboard && navigator.clipboard.readText) { try { text = await navigator.clipboard.readText(); } catch { text = null; } }
    const clip = desk.sheetClip;
    const ch = [];
    if (clip && (text === null || text === clip.text)) {
      const dc = active[0] - clip.c0, dr = active[1] - clip.r0;
      clip.cells.forEach((row, ri) => row.forEach((cell, ci) => {
        const c = active[0] + ci, r = active[1] + ri;
        if (c >= COLS || r >= ROWS) return;
        const a = addr(c, r);
        let after = cell ? { ...cell } : null;
        if (after && typeof after.v === 'string' && after.v.startsWith('=')) after.v = shiftFormula(after.v, dc, dr);
        ch.push({ a, before: snap(a), after });
      }));
    } else if (text) {
      text.replace(/\r/g, '').replace(/\n$/, '').split('\n').forEach((line, ri) => line.split('\t').forEach((v, ci) => {
        const c = active[0] + ci, r = active[1] + ri;
        if (c < COLS && r < ROWS) ch.push(setCellValue(addr(c, r), v));
      }));
    }
    commit(ch);
    setStatus('已粘贴');
  }
  function clearSel() {
    const s = selRect();
    const ch = [];
    for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) { const a = addr(c, r); const b = snap(a); if (b && b.v !== '') ch.push(setCellValue(a, '')); }
    commit(ch);
  }
  function doUndo() { const ch = undo.pop(); if (!ch) return; redo.push(ch); apply(ch, 'old'); setStatus('已撤销'); }
  function doRedo() { const ch = redo.pop(); if (!ch) return; undo.push(ch); apply(ch, 'new'); setStatus('已重做'); }
  function format(prop, value) {
    const s = selRect();
    const ch = [];
    for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) {
      const a = addr(c, r);
      const before = snap(a);
      const after = { v: '', ...(before || {}) };
      if (prop === 'b' || prop === 'i') { if (after[prop]) delete after[prop]; else after[prop] = 1; }
      else if (value === null) delete after[prop];
      else after[prop] = value;
      ch.push({ a, before, after });
    }
    commit(ch);
  }
  function saveTo(path) {
    const text = JSON.stringify(wb.toJSON(doc.name), null, 1);
    K.addWork(svc, text.length / 16);
    const r = FS.write(path, text);
    if (r !== true) { setStatus('保存失败：' + r.error, true); desk.notify('error', '保存失败：' + r.error); return false; }
    doc.path = path;
    doc.name = path.split('/').pop().replace(/\.sheet$/, '');
    setDirty(false);
    desk.setTitle(win, `${doc.name} — 电子表格`);
    nameEl.value = path;
    hub.retitle();
    desk.notify('info', '工作簿已保存：' + path);
    updateStatus();
    return true;
  }
  function save() {
    let p = nameEl.value.trim() || doc.path;
    if (!p) return false;
    if (!p.endsWith('.sheet')) p += '.sheet';
    return saveTo(p);
  }
  async function askSave(what) {
    if (!dirty) return true;
    const r = await desk.confirm3('有未保存的修改', `“${doc.name}” 有未保存的修改，${what}前要保存吗？`);
    if (r === 'save') return save();
    return r === 'discard';
  }
  function loadDoc(path) {
    const t = FS.read(path);
    if (t === null) { setStatus('打开失败：文件不存在 ' + path, true); return false; }
    let parsed;
    try { parsed = JSON.parse(t); } catch (e) { setStatus('打开失败：工作簿格式错误 ' + e.message, true); return false; }
    K.addWork(svc, t.length / 16);
    wb.load(parsed);
    wb.version++;
    undo.length = 0; redo.length = 0;
    doc.path = path;
    doc.name = path.split('/').pop().replace(/\.sheet$/, '');
    nameEl.value = path;
    setDirty(false);
    desk.setTitle(win, `${doc.name} — 电子表格`);
    active = [0, 0]; selEnd = [0, 0];
    renderAll();
    hub.retitle();
    hub.publish(doc);
    return true;
  }
  async function openDialog() {
    if (!(await askSave('打开其他工作簿'))) return;
    const p = await desk.prompt('打开工作簿', '输入工作簿路径（也可以在文件管理器里双击 .sheet 文件）', nameEl.value.trim() || '/Demo/sample.sheet');
    if (p) loadDoc(p);
  }
  async function newDoc() {
    if (!(await askSave('新建工作簿'))) return;
    wb.cells = new Map(); wb.values = new Map(); wb.version++;
    undo.length = 0; redo.length = 0;
    doc.path = ''; doc.name = '未命名工作簿';
    nameEl.value = '/Documents/新工作簿.sheet';
    setDirty(false);
    desk.setTitle(win, `${doc.name} — 电子表格`);
    renderAll();
    hub.retitle();
    hub.publish(doc);
  }
  // 指针
  let dragging = false;
  grid.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.sheet-cell');
    if (!el || e.button !== 0) return;
    if (editing && e.target !== editing.input) commitEdit();
    if (document.activeElement === formula) formula.blur();
    const c = +el.dataset.c, r = +el.dataset.r;
    if (e.shiftKey) moveTo(c, r, true); else moveTo(c, r);
    dragging = true;
    e.preventDefault();
    focusGrid();
  });
  grid.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest && el.closest('.sheet-cell');
    if (cell) { selEnd = [+cell.dataset.c, +cell.dataset.r]; renderSelection(); }
  });
  const stopDrag = () => { dragging = false; };
  window.addEventListener('pointerup', stopDrag);
  grid.addEventListener('dblclick', (e) => { const el = e.target.closest('.sheet-cell'); if (el) { moveTo(+el.dataset.c, +el.dataset.r); beginEdit(); } });
  grid.addEventListener('contextmenu', (e) => { e.preventDefault(); desk.menu(e.clientX, e.clientY, [['复制', () => copy(false)], ['剪切', () => copy(true)], ['粘贴', paste], ['清除内容', clearSel], ['撤销', doUndo], ['重做', doRedo]]); });
  // 键盘：只在这个窗口得到焦点时生效
  function onKey(e) {
    if (e.type !== 'keydown') return;
    const t = e.target;
    if (t && t !== catcher && (t === formula || t === nameEl || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (editing) return;
    const k = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      const lk = k.toLowerCase();
      if (lk === 'c') { copy(false); e.preventDefault(); }
      else if (lk === 'x') { copy(true); e.preventDefault(); }
      else if (lk === 'v') { paste(); e.preventDefault(); }
      else if (lk === 'z') { doUndo(); e.preventDefault(); }
      else if (lk === 'y') { doRedo(); e.preventDefault(); }
      else if (lk === 's') { save(); e.preventDefault(); }
      else if (lk === 'b') { format('b'); e.preventDefault(); }
      else if (lk === 'a') { active = [0, 0]; selEnd = [COLS - 1, ROWS - 1]; renderSelection(); e.preventDefault(); }
      return;
    }
    const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Tab: [e.shiftKey ? -1 : 1, 0], Enter: [0, e.shiftKey ? -1 : 1] }[k];
    if (mv) {
      e.preventDefault();
      if (e.shiftKey && k.startsWith('Arrow')) moveTo(selEnd[0] + mv[0], selEnd[1] + mv[1], true);
      else moveTo(active[0] + mv[0], active[1] + mv[1]);
      return;
    }
    if (k === 'F2') { beginEdit(); e.preventDefault(); return; }
    if (k === 'Delete' || k === 'Backspace') { clearSel(); e.preventDefault(); return; }
  }
  const tb = (label, tid, fn, title) => h('button', { class: 'rbtn', tid, 'data-system-id': 'outer', text: label, label: title || label, onclick: fn });
  const saveBtn = tb('保存', 'sheet-save', save);
  const pane = h('div', { class: 'pane' },
    h('div', { class: 'pane-toolbar flow' }, tb('新建', 'sheet-new', newDoc), tb('打开', 'sheet-open', openDialog), saveBtn, nameEl,
      tb('撤销', 'sheet-undo', doUndo), tb('重做', 'sheet-redo', doRedo), tb('复制', 'sheet-copy', () => copy(false)), tb('粘贴', 'sheet-paste', paste),
      tb('粗', 'sheet-bold', () => format('b'), '粗体'), tb('斜', 'sheet-italic', () => format('i'), '斜体'), tb('左', 'sheet-left', () => format('align', 'left'), '左对齐'), tb('中', 'sheet-center', () => format('align', 'center'), '居中'), tb('右', 'sheet-right', () => format('align', 'right'), '右对齐'),
      tb('底色', 'sheet-fill', () => format('bg', '#5b34d666'), '黄紫底色'), tb('清色', 'sheet-clearfill', () => format('bg', null), '清除底色'), tb('.00', 'sheet-decimal', () => format('nf', 2), '两位小数')),
    h('div', { class: 'pane-toolbar flow', style: 'padding:5px 8px' }, cellLabel, h('div', { class: 'rlabel', text: 'fx' }), formula),
    wrap, status);
  const win = desk.createWindow({
    app: 'spreadsheet', title: '未命名工作簿 — 电子表格', icon: 'spreadsheet', w: 860, h: 520, svc,
    onKey, onClose: () => askSave('关闭'),
  });
  win.doc = doc;
  win.body.appendChild(pane);
  win.el.tabIndex = -1;
  win.onDestroyed = () => { window.removeEventListener('pointerup', stopDrag); hub.docClosed(doc); };
  for (const el of [nameEl, formula, grid, saveBtn]) el.dataset.windowId = win.id;
  for (const el of cellEls.values()) el.dataset.windowId = win.id;
  hub.registerDoc(doc);
  renderAll();
  if (args.file) loadDoc(args.file);
  win.onFocus = (on) => { if (on && !editing && document.activeElement !== formula && document.activeElement !== nameEl) focusGrid(); };
  focusGrid();
  return win;
}
