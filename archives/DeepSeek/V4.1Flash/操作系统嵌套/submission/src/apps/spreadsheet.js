import { appIcon, fileIcon, folderIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtBytes, fmtNumber, clamp } from '../ui/common.js';
import * as FS from '../core/fs.js';

export const meta = {
  title: '电子表格', desc: '公式、选区、撤销与实时发布',
  width: 1040, height: 670, minW: 620, minH: 380,
};

const COLS = 9, ROWS = 26;
const CELL_RE = /^\$?([A-Za-z]{1,2})\$?(\d{1,3})$/;

function colToIndex(col) {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function indexToCol(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function parseAddress(addr) {
  const m = String(addr).replace(/\$/g, '').toUpperCase().match(/^([A-Z]{1,2})(\d{1,3})$/);
  if (!m) return null;
  return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1, addr: m[1] + m[2] };
}
function addrOf(col, row) { return indexToCol(col) + (row + 1); }
function parseRange(range) {
  const parts = String(range || '').replace(/\$/g, '').split(':');
  const a = parseAddress(parts[0]);
  const b = parseAddress(parts[1] || parts[0]);
  if (!a || !b) return null;
  return {
    c1: Math.min(a.col, b.col), r1: Math.min(a.row, b.row),
    c2: Math.max(a.col, b.col), r2: Math.max(a.row, b.row),
  };
}
function rangeAddress(r) { return `${addrOf(r.c1, r.r1)}:${addrOf(r.c2, r.r2)}`; }

// ---------------- 公式解析 ----------------
function tokenizeFormula(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j).toUpperCase() }); i = j; continue;
    }
    if (ch === '"') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== '"') { s += src[j]; j++; }
      out.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if ('+-*/%^(),:'.includes(ch)) { out.push({ t: 'op', v: ch }); i++; continue; }
    throw new Error('无法识别的公式字符 ' + ch);
  }
  return out;
}
function parseFormula(src) {
  const toks = tokenizeFormula(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  function expr() {
    let left = term();
    while (peek()?.t === 'op' && ['+', '-'].includes(peek().v)) {
      const op = next().v; left = { k: 'bin', op, l: left, r: term() };
    }
    return left;
  }
  function term() {
    let left = unary();
    while (peek()?.t === 'op' && ['*', '/', '%'].includes(peek().v)) {
      const op = next().v; left = { k: 'bin', op, l: left, r: unary() };
    }
    return left;
  }
  function unary() {
    if (peek()?.t === 'op' && peek().v === '-') { next(); return { k: 'neg', v: unary() }; }
    if (peek()?.t === 'op' && peek().v === '+') { next(); return unary(); }
    return power();
  }
  function power() {
    let left = primary();
    while (peek()?.t === 'op' && peek().v === '^') { next(); left = { k: 'bin', op: '^', l: left, r: primary() }; }
    return left;
  }
  function primary() {
    const t = next();
    if (!t) throw new Error('公式不完整');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'op' && t.v === '(') { const e = expr(); if (next()?.v !== ')') throw new Error('括号未闭合'); return e; }
    if (t.t === 'id') {
      if (peek()?.t === 'op' && peek().v === '(') {
        next();
        const args = [];
        while (peek() && !(peek().t === 'op' && peek().v === ')')) {
          args.push(argExpr());
          if (peek()?.v === ',') next();
          else break;
        }
        if (next()?.v !== ')') throw new Error('函数参数未闭合');
        return { k: 'fn', name: t.v, args };
      }
      if (t.v === 'TRUE') return { k: 'num', v: 1 };
      if (t.v === 'FALSE') return { k: 'num', v: 0 };
      if (CELL_RE.test(t.v)) return { k: 'ref', addr: t.v.replace(/\$/g, '') };
      return { k: 'ref', addr: t.v };
    }
    throw new Error('公式语法错误');
  }
  function argExpr() {
    const start = expr();
    if (peek()?.t === 'op' && peek().v === ':') {
      next();
      const end = expr();
      if (start.k !== 'ref' || end.k !== 'ref') throw new Error('区间引用无效');
      return { k: 'range', a: start.addr, b: end.addr };
    }
    return start;
  }
  if (!toks.length) throw new Error('公式为空');
  const ast = expr();
  if (p < toks.length) throw new Error('公式末尾存在多余内容');
  return ast;
}

class SheetError extends Error { constructor(code) { super(code); this.code = code; } }

function evalFormulaAst(ast, resolveRef, resolveRange) {
  switch (ast.k) {
    case 'num': return ast.v;
    case 'str': return ast.v;
    case 'neg': return -toNum(evalFormulaAst(ast.v, resolveRef, resolveRange));
    case 'bin': {
      const a = toNum(evalFormulaAst(ast.l, resolveRef, resolveRange));
      const b = toNum(evalFormulaAst(ast.r, resolveRef, resolveRange));
      if (ast.op === '+') return a + b;
      if (ast.op === '-') return a - b;
      if (ast.op === '*') return a * b;
      if (ast.op === '/') { if (b === 0) throw new SheetError('#DIV/0!'); return a / b; }
      if (ast.op === '%') { if (b === 0) throw new SheetError('#DIV/0!'); return a % b; }
      if (ast.op === '^') return Math.pow(a, b);
      throw new SheetError('#ERROR!');
    }
    case 'ref': {
      const v = resolveRef(ast.addr);
      return typeof v === 'number' ? v : (v === '' || v === null || v === undefined ? 0 : (typeof v === 'string' ? v : 0));
    }
    case 'range': throw new SheetError('#VALUE!');
    case 'fn': {
      const nums = [];
      for (const a of ast.args) {
        if (a.k === 'range') {
          const vals = resolveRange(a.a, a.b);
          for (const v of vals) { if (typeof v === 'number') nums.push(v); else if (v !== '' && v != null) nums.push(Number(v) || 0); }
        } else {
          const v = evalFormulaAst(a, resolveRef, resolveRange);
          if (Array.isArray(v)) nums.push(...v.map(Number)); else if (v !== '' && v != null) nums.push(typeof v === 'number' ? v : (Number(v) || 0));
        }
      }
      if (ast.name === 'SUM') return nums.reduce((s, x) => s + x, 0);
      if (ast.name === 'AVERAGE') return nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : 0;
      if (ast.name === 'MIN') return nums.length ? Math.min(...nums) : 0;
      if (ast.name === 'MAX') return nums.length ? Math.max(...nums) : 0;
      if (ast.name === 'COUNT') return nums.length;
      if (ast.name === 'ABS') return Math.abs(nums[0] || 0);
      if (ast.name === 'ROUND') return Math.round(nums[0] || 0);
      throw new SheetError('#NAME?');
    }
    default: throw new SheetError('#ERROR!');
  }
}
function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatCellValue(value, style = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value === null || value === undefined ? '' : String(value);
  const fmt = style.numFmt || 'general';
  if (fmt === 'currency') return '¥' + value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (fmt === 'percent') return (value * 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  if (Number.isInteger(value)) return value.toLocaleString('zh-CN');
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}

// ---------------- 电子表格应用 ----------------
export function mount(ctx) {
  const { sys, os, shell, body, data, window: win } = ctx;
  if (!data.sheet) data.sheet = { path: win.props?.path || null };
  let doc = null;
  let selection = { anchor: { c: 0, r: 0 }, focus: { c: 0, r: 0 } };
  let editing = null; // {addr, value}
  let undoStack = [], redoStack = [];
  let closed = false;
  let registeredDocId = null;

  body.innerHTML = `<div class="sheet-app">
    <div class="app-toolbar sheet-toolbar">
      <button type="button" class="icon-button" data-sheet-new title="新建工作簿" aria-label="新建工作簿">${uiIcon('plus')}</button>
      <button type="button" class="icon-button" data-sheet-open title="打开工作簿" aria-label="打开工作簿">${uiIcon('folder')}</button>
      <button type="button" class="icon-button" data-sheet-saveas title="另存为" aria-label="另存为">${uiIcon('copy')}</button>
      <button type="button" class="chip-button save-chip" data-testid="sheet-save" data-sheet-save title="保存">${uiIcon('success')}<span>保存</span></button>
      <span class="tb-sep"></span>
      <button type="button" class="icon-button" data-sheet-undo title="撤销" aria-label="撤销">${uiIcon('arrowLeft')}</button>
      <button type="button" class="icon-button" data-sheet-redo title="重做" aria-label="重做">${uiIcon('arrowRight')}</button>
      <span class="tb-sep"></span>
      <button type="button" class="icon-button sheet-format" data-sheet-bold title="加粗" aria-label="加粗"><b>B</b></button>
      <button type="button" class="icon-button sheet-format" data-sheet-align="left" title="左对齐" aria-label="左对齐">${uiIcon('list')}</button>
      <button type="button" class="icon-button sheet-format" data-sheet-align="center" title="居中" aria-label="居中"><span class="align-center-glyph">≡</span></button>
      <button type="button" class="icon-button sheet-format" data-sheet-align="right" title="右对齐" aria-label="右对齐"><span class="align-right-glyph">≡</span></button>
      <select class="small-input sheet-numfmt" data-sheet-numfmt aria-label="数字格式">
        <option value="general">常规</option><option value="currency">货币</option><option value="percent">百分比</option>
      </select>
      <span class="tb-sep"></span>
      <div class="sheet-title-wrap"><span class="sheet-dot" data-sheet-dirty hidden>●</span><span class="sheet-title" data-testid="sheet-filename">未命名工作簿</span></div>
      <span class="spacer"></span>
      <span class="sheet-data-hint" data-sheet-datastatus>${uiIcon('dataset')} 未连接图表</span>
    </div>
    <div class="sheet-formula-bar">
      <span class="sheet-namebox" data-sheet-namebox>A1</span>
      <span class="sheet-fx">fx</span>
      <input class="sheet-formula" data-testid="sheet-formula" spellcheck="false" aria-label="公式栏" placeholder="输入值或公式，例如 =SUM(D2:D4)" />
      <span class="sheet-formula-hint">Enter 提交</span>
    </div>
    <div class="sheet-scroll">
      <div class="sheet-grid-wrap" data-sheet-gridwrap>
        <table class="sheet-table" data-testid="sheet-grid" aria-label="工作表">
          <colgroup data-sheet-colgroup></colgroup>
          <thead data-sheet-thead></thead>
          <tbody data-sheet-tbody></tbody>
        </table>
      </div>
    </div>
    <div class="sheet-status">
      <span data-sheet-selinfo>选择 A1</span>
      <span data-sheet-stats></span>
      <span class="spacer"></span>
      <span data-sheet-mode>单工作表 · 24 行 × 9 列</span>
      <span data-sheet-dirtystate>已保存</span>
    </div>
    <div class="sheet-picker hidden" data-sheet-picker></div>
  </div>`;

  const tbody = $s(body, '[data-sheet-tbody]');
  const thead = $s(body, '[data-sheet-thead]');
  const colgroup = $s(body, '[data-sheet-colgroup]');
  const formulaEl = $s(body, '[data-testid="sheet-formula"]');
  const picker = $s(body, '[data-sheet-picker]');
  const gridWrap = $s(body, '[data-sheet-gridwrap]');

  function makeBlank(name = '未命名工作簿') {
    return { format: 'NESTED-SHEET/1', name, rows: ROWS, cols: COLS, cells: {}, colWidths: {}, savedAt: Date.now() };
  }

  function normalizeWorkbook(wb, path) {
    const norm = {
      format: 'NESTED-SHEET/1',
      name: wb?.name || FS.baseName(path || '').replace(/\.sheet$/i, '') || '未命名工作簿',
      rows: Math.max(ROWS, Math.min(60, wb?.rows || ROWS)),
      cols: Math.max(COLS, Math.min(18, wb?.cols || COLS)),
      cells: {},
      colWidths: wb?.colWidths || {},
      path: path || null,
      dirty: false,
      errors: {},
      memo: {},
      display: {},
    };
    const src = wb?.cells || {};
    for (const [addr, cell] of Object.entries(src)) {
      const p = parseAddress(addr);
      if (!p) continue;
      const a = p.col < norm.cols && p.row < norm.rows ? addrOf(p.col, p.row) : null;
      if (!a) continue;
      norm.cells[a] = { raw: cell.raw ?? cell.v ?? '', style: cell.style || {} };
    }
    return norm;
  }

  // ---------------- 计算 ----------------
  function recalc() {
    if (!doc) return;
    const memo = new Map();
    const errors = {};
    const visiting = [];
    const visitingSet = new Set();
    function valueOf(addr) {
      const key = String(addr).toUpperCase();
      if (memo.has(key)) { const m = memo.get(key); if (m instanceof SheetError) throw m; return m; }
      const pos = parseAddress(key);
      if (!pos || pos.col >= doc.cols || pos.row >= doc.rows) throw new SheetError('#REF!');
      const cell = doc.cells[key];
      if (!cell || cell.raw === '' || cell.raw === undefined) { memo.set(key, ''); return ''; }
      if (!String(cell.raw).startsWith('=')) {
        let v = cell.raw;
        if (typeof v === 'number') { memo.set(key, v); return v; }
        const n = Number(v);
        const vv = (v !== '' && !Number.isNaN(n)) ? n : v;
        memo.set(key, vv); return vv;
      }
      if (visitingSet.has(key)) {
        for (let i = visiting.indexOf(key); i >= 0 && i < visiting.length; i++) errors[visiting[i]] = '#CYCLE!';
        throw new SheetError('#CYCLE!');
      }
      visiting.push(key); visitingSet.add(key);
      try {
        const ast = parseFormula(String(cell.raw).slice(1));
        const result = evalFormulaAst(ast, (ref) => {
          const rr = String(ref).toUpperCase();
          const p2 = parseAddress(rr);
          if (!p2 || p2.col >= doc.cols || p2.row >= doc.rows) throw new SheetError('#REF!');
          return valueOf(rr);
        }, (a, b) => {
          const pa = parseAddress(a), pb = parseAddress(b);
          if (!pa || !pb) throw new SheetError('#REF!');
          const r1 = Math.min(pa.row, pb.row), r2 = Math.max(pa.row, pb.row);
          const c1 = Math.min(pa.col, pb.col), c2 = Math.max(pa.col, pb.col);
          if (c2 >= doc.cols || r2 >= doc.rows || c1 < 0 || r1 < 0) throw new SheetError('#REF!');
          const out = [];
          for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { try { out.push(valueOf(addrOf(c, r))); } catch (e) { throw e; } }
          return out;
        });
        memo.set(key, result);
        return result;
      } catch (e) {
        const code = e instanceof SheetError ? e.code : '#ERROR!';
        errors[key] = code;
        memo.set(key, new SheetError(code));
        throw (e instanceof SheetError ? e : new SheetError(code));
      } finally {
        visiting.pop(); visitingSet.delete(key);
      }
    }
    const display = {};
    const allAddrs = new Set(Object.keys(doc.cells));
    for (const k of Object.keys(doc.cells)) {
      try {
        const v = valueOf(k);
        const style = doc.cells[k].style || {};
        display[k] = formatCellValue(v, style);
      } catch (e) {
        display[k] = e.code || '#ERROR!';
      }
    }
    for (const [k, code] of Object.entries(errors)) display[k] = code;
    doc.errors = errors; doc.display = display; doc.memo = Object.fromEntries(memo);
    updateDataStatus();
    if (win.procId) os.chargeProcess(sys.id, win.procId, 12 + Object.keys(doc.cells).length * 2);
  }

  // ---------------- 保存 / 打开 ----------------
  function workbookData() {
    return {
      format: 'NESTED-SHEET/1', name: doc.name, rows: doc.rows, cols: doc.cols,
      cells: doc.cells, colWidths: doc.colWidths, savedAt: Date.now(),
    };
  }
  function setDirty(v) {
    if (!doc) return;
    doc.dirty = !!v;
    const d = $s(body, '[data-sheet-dirty]');
    if (d) d.hidden = !doc.dirty;
    const st = $s(body, '[data-sheet-dirtystate]');
    if (st) st.textContent = doc.dirty ? '未保存' : '已保存';
    const fn = $s(body, '[data-testid="sheet-filename"]');
    if (fn) fn.textContent = (doc.name || '未命名工作簿') + (doc.dirty ? ' •' : '');
    ctx.setDirty(!!doc.dirty);
    if (doc.path) ctx.setTitle(`电子表格 · ${doc.name || FS.baseName(doc.path)}`);
    else ctx.setTitle('电子表格 · 未命名工作簿');
  }
  async function saveWorkbook(forcePath = null) {
    if (!doc) return false;
    let path = forcePath || doc.path;
    if (!path) {
      const r = await ctx.dialog({ title: '保存工作簿', fields: [{ name: 'path', label: '保存路径', value: '/Documents/新建工作簿.sheet' }], okLabel: '保存' });
      if (!r) return false;
      path = r.values.path;
    }
    path = FS.normalizePath(path);
    if (!path.toLowerCase().endsWith('.sheet')) path += '.sheet';
    try {
      if (!FS.resolveNode(sys.fs, FS.parentPath(path))) os.mkdir(sys.id, FS.parentPath(path));
      const wb = workbookData();
      if (!wb.name) wb.name = FS.baseName(path).replace(/\.sheet$/i, '');
      os.writeFile(sys.id, path, JSON.stringify(wb, null, 2), { kind: 'sheet' });
      const oldDocId = doc.docId;
      doc.path = path; doc.name = wb.name; doc.docId = `sheet:${path}`;
      if (oldDocId !== doc.docId && registeredDocId) {
        os.unregisterWorkbook(registeredDocId);
      }
      setDirty(false);
      registerDoc();
      data.sheet.path = path;
      os.notify(sys.id, { title: '工作簿已保存', body: path, kind: 'success', appId: 'spreadsheet' });
      updateDataStatus();
      return true;
    } catch (err) { ctx.toast('保存失败：' + err.message, 'error'); return false; }
  }

  function registerDoc() {
    if (!doc || !doc.path) return;
    if (registeredDocId) os.unregisterWorkbook(registeredDocId);
    registeredDocId = doc.docId;
    os.registerWorkbook({
      docId: doc.docId,
      path: doc.path,
      title: doc.name || FS.baseName(doc.path),
      get dirty() { return doc.dirty; },
      snapshotRange(range) {
        const r = parseRange(range);
        if (!r) throw new Error('区域无效');
        if (r.c2 >= doc.cols || r.r2 >= doc.rows) throw new Error('区域超出工作表范围');
        const columns = [];
        for (let c = r.c1; c <= r.c2; c++) columns.push(indexToCol(c));
        const matrix = [];
        for (let row = r.r1; row <= r.r2; row++) {
          const line = [];
          for (let c = r.c1; c <= r.c2; c++) {
            const addr = addrOf(c, row);
            if (doc.errors[addr]) line.push(doc.errors[addr]);
            else if (doc.memo[addr] instanceof SheetError) line.push(doc.memo[addr].code);
            else if (typeof doc.memo[addr] === 'number') line.push(doc.memo[addr]);
            else if (typeof doc.memo[addr] === 'string') line.push(doc.memo[addr]);
            else line.push(doc.display[addr] ?? '');
          }
          matrix.push(line);
        }
        return { matrix, columns, range: rangeAddress(r) };
      },
    });
    os.emit('workbooks-updated', {});
    updateDataStatus();
  }

  async function confirmDiscard() {
    if (!doc || !doc.dirty) return true;
    const res = await ctx.dialog({
      title: '工作簿尚未保存',
      message: `“${doc.name || '未命名工作簿'}”有未保存的修改。保存后才能继续。`,
      buttons: [{ label: '取消', value: null }, { label: '放弃修改', value: 'discard', danger: true }, { label: '保存', value: 'save', primary: true }],
    });
    if (!res) return false;
    if (res.button.value === 'save') return await saveWorkbook();
    return true;
  }

  async function openWorkbook(path) {
    if (!(await confirmDiscard())) return false;
    let wb;
    try {
      const node = FS.resolveNode(sys.fs, path);
      if (!node || node.type !== 'file') throw new Error('文件不存在');
      wb = JSON.parse(node.content);
      if (wb.format && wb.format !== 'NESTED-SHEET/1') throw new Error('不是支持的电子表格格式');
    } catch (err) { ctx.toast('打开失败：' + err.message, 'error'); return false; }
    if (registeredDocId) { os.unregisterWorkbook(registeredDocId); registeredDocId = null; }
    doc = normalizeWorkbook(wb, path);
    doc.docId = `sheet:${path}`;
    data.sheet.path = path;
    selection = { anchor: { c: 0, r: 0 }, focus: { c: 0, r: 0 } };
    undoStack = []; redoStack = [];
    recalc(); setDirty(false); registerDoc(); renderAll();
    return true;
  }

  async function newWorkbook() {
    if (!(await confirmDiscard())) return;
    const r = await ctx.dialog({ title: '新建工作簿', fields: [{ name: 'name', label: '名称', value: '未命名工作簿' }, { name: 'path', label: '保存路径', value: '/Documents/未命名工作簿.sheet' }], okLabel: '创建' });
    if (!r) return;
    const name = (r.values.name || '未命名工作簿').trim();
    let path = FS.normalizePath(r.values.path || `/Documents/${name}.sheet`);
    if (!path.toLowerCase().endsWith('.sheet')) path += '.sheet';
    if (FS.resolveNode(sys.fs, path)) { ctx.toast('同名文件已存在', 'error'); return; }
    const wb = makeBlank(name);
    try {
      os.writeFile(sys.id, path, JSON.stringify(wb, null, 2), { kind: 'sheet' });
    } catch (err) { ctx.toast(err.message, 'error'); return; }
    if (registeredDocId) { os.unregisterWorkbook(registeredDocId); registeredDocId = null; }
    doc = normalizeWorkbook(wb, path);
    doc.docId = `sheet:${path}`;
    data.sheet.path = path;
    selection = { anchor: { c: 0, r: 0 }, focus: { c: 0, r: 0 } };
    undoStack = []; redoStack = [];
    recalc(); setDirty(false); registerDoc(); renderAll();
  }

  // ---------------- 渲染 ----------------
  function selectionRange() {
    const a = selection.anchor, f = selection.focus;
    return { c1: Math.min(a.c, f.c), c2: Math.max(a.c, f.c), r1: Math.min(a.r, f.r), r2: Math.max(a.r, f.r) };
  }
  function cellInSelection(c, r) {
    const s = selectionRange();
    return c >= s.c1 && c <= s.c2 && r >= s.r1 && r <= s.r2;
  }
  function activeAddr() { return addrOf(selection.focus.c, selection.focus.r); }

  function renderAll() {
    if (!doc) return;
    renderHeaders();
    renderGrid();
    renderToolbarState();
    updateFormulaBar();
    updateStatus();
    updateDataStatus();
  }

  function renderHeaders() {
    const widths = [];
    for (let c = 0; c < doc.cols; c++) widths.push(doc.colWidths[indexToCol(c)] || (c === 0 ? 150 : 92));
    colgroup.innerHTML = `<col style="width:44px">` + widths.map((w) => `<col style="width:${w}px">`).join('');
    let head = `<tr><th class="sheet-corner"><span></span></th>`;
    for (let c = 0; c < doc.cols; c++) head += `<th class="sheet-colhead" data-col="${c}">${indexToCol(c)}</th>`;
    head += '</tr>';
    thead.innerHTML = head;
    for (const th of $all(thead, '.sheet-colhead')) {
      th.addEventListener('click', () => {
        const c = Number(th.dataset.col);
        selection = { anchor: { c, r: 0 }, focus: { c, r: doc.rows - 1 } };
        renderGrid(); updateFormulaBar(); updateStatus();
      });
    }
  }

  function renderGrid() {
    if (!doc) return;
    const sel = selectionRange();
    let html = '';
    for (let r = 0; r < doc.rows; r++) {
      html += `<tr>`;
      html += `<th class="sheet-rowhead" data-row="${r}">${r + 1}</th>`;
      for (let c = 0; c < doc.cols; c++) {
        const addr = addrOf(c, r);
        const cell = doc.cells[addr];
        const raw = cell?.raw ?? '';
        const display = doc.display[addr] ?? '';
        const err = doc.errors[addr];
        const style = cell?.style || {};
        const selected = cellInSelection(c, r);
        const active = selection.focus.c === c && selection.focus.r === r;
        const align = style.align || (typeof doc.memo[addr] === 'number' && display !== '' ? 'right' : 'left');
        const classes = ['sheet-cell', selected ? 'selected' : '', active ? 'active' : '', err ? 'cell-error' : '',
          typeof doc.memo[addr] === 'number' ? 'is-number' : '', style.bold ? 'bold' : ''].filter(Boolean).join(' ');
        html += `<td class="${classes}" data-testid="sheet-cell" data-cell-address="${addr}" data-col="${c}" data-row="${r}" data-raw="${esc(raw)}" style="${style.bold ? 'font-weight:650;' : ''}text-align:${align};">
          <span class="sheet-cell-text">${esc(display)}</span>
          ${err ? `<span class="sheet-cell-err">${esc(err)}</span>` : ''}
        </td>`;
      }
      html += `</tr>`;
    }
    tbody.innerHTML = html;
    for (const th of $all(tbody, '.sheet-rowhead')) {
      th.addEventListener('click', () => {
        const r = Number(th.dataset.row);
        selection = { anchor: { c: 0, r }, focus: { c: doc.cols - 1, r } };
        renderGrid(); updateFormulaBar(); updateStatus();
      });
    }
    if (editing) attachEditor();
  }

  function attachEditor() {
    const cellEl = tbody.querySelector(`[data-cell-address="${editing.addr}"]`);
    if (!cellEl) return;
    const input = el(`<input class="sheet-cell-editor" value="${esc(editing.value)}" spellcheck="false" />`);
    cellEl.innerHTML = '';
    cellEl.appendChild(input);
    requestAnimationFrame(() => { input.focus(); input.select(); });
    const commit = (move) => {
      if (!editing) return;
      const value = input.value;
      editing = null;
      commitCell(value, move);
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commit(1); }
      else if (e.key === 'Tab') { e.preventDefault(); commit(0, 1); }
      else if (e.key === 'Escape') { e.preventDefault(); editing = null; renderAll(); }
    });
    input.addEventListener('blur', () => {
      if (editing) { const value = input.value; editing = null; commitCell(value, 0); }
    });
  }

  function beginEdit(initial = null) {
    if (!doc) return;
    const addr = activeAddr();
    const raw = doc.cells[addr]?.raw ?? '';
    editing = { addr, value: initial === null ? String(raw) : initial };
    renderGrid();
  }

  function pushUndo() {
    undoStack.push(JSON.parse(JSON.stringify(doc.cells)));
    if (undoStack.length > 120) undoStack.shift();
    redoStack = [];
  }

  function commitCell(value, moveRow = 0, moveCol = 0) {
    if (!doc) return;
    const addr = activeAddr();
    const prev = doc.cells[addr]?.raw ?? '';
    if (String(prev) !== String(value)) {
      pushUndo();
      if (value === '' || value === null || value === undefined) {
        if (doc.cells[addr]) {
          if (Object.keys(doc.cells[addr].style || {}).length) doc.cells[addr].raw = '';
          else delete doc.cells[addr];
        }
      } else {
        if (!doc.cells[addr]) doc.cells[addr] = { raw: value, style: {} };
        else doc.cells[addr].raw = value;
      }
      recalc(); setDirty(true);
      os.publishWorkbook(doc.docId);
    }
    if (moveRow || moveCol) {
      selection.focus = {
        c: clamp(selection.focus.c + moveCol, 0, doc.cols - 1),
        r: clamp(selection.focus.r + moveRow, 0, doc.rows - 1),
      };
      selection.anchor = { ...selection.focus };
    }
    renderAll();
  }

  function updateFormulaBar() {
    if (!doc) return;
    const addr = activeAddr();
    const raw = editing ? editing.value : (doc.cells[addr]?.raw ?? '');
    formulaEl.value = raw;
    const namebox = $s(body, '[data-sheet-namebox]');
    if (namebox) namebox.textContent = addr;
  }

  function updateStatus() {
    if (!doc) return;
    const s = selectionRange();
    const info = $s(body, '[data-sheet-selinfo]');
    if (info) info.textContent = s.c1 === s.c2 && s.r1 === s.r2 ? `选择 ${activeAddr()}` : `选择 ${addrOf(s.c1, s.r1)}:${addrOf(s.c2, s.r2)}`;
    let count = 0, sum = 0;
    for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) {
      const v = doc.memo[addrOf(c, r)];
      if (typeof v === 'number') { count++; sum += v; }
    }
    const stats = $s(body, '[data-sheet-stats]');
    if (stats) stats.textContent = count ? `数值 ${count} · 求和 ${formatCellValue(sum)} · 平均 ${formatCellValue(sum / count)}` : '';
    renderToolbarState();
  }

  function renderToolbarState() {
    if (!doc) return;
    const style = doc.cells[activeAddr()]?.style || {};
    const boldBtn = $s(body, '[data-sheet-bold]');
    if (boldBtn) boldBtn.classList.toggle('active', !!style.bold);
    for (const btn of $all(body, '[data-sheet-align]')) btn.classList.toggle('active', (style.align || 'left') === btn.dataset.sheetAlign);
    const fmt = $s(body, '[data-sheet-numfmt]');
    if (fmt) fmt.value = style.numFmt || 'general';
    const undo = $s(body, '[data-sheet-undo]'), redo = $s(body, '[data-sheet-redo]');
    if (undo) undo.disabled = !undoStack.length;
    if (redo) redo.disabled = !redoStack.length;
  }

  function updateDataStatus() {
    const elx = $s(body, '[data-sheet-datastatus]');
    if (!elx || !doc) return;
    const subs = [...os.chartSubs.values()].filter((s) => s.docId === doc.docId);
    elx.innerHTML = `${uiIcon('dataset')} ${subs.length ? `已发布至 ${subs.length} 个图表` : '未连接图表'}${doc.path ? '' : ' · 未保存'}`;
    elx.classList.toggle('connected', subs.length > 0);
  }

  // ---------------- 选择 / 键盘 ----------------
  let dragSelect = false;
  tbody.addEventListener('pointerdown', (e) => {
    const td = e.target.closest('td.sheet-cell');
    if (!td) return;
    const c = Number(td.dataset.col), r = Number(td.dataset.row);
    if (editing) { /* blur commits */ }
    if (e.shiftKey) selection.focus = { c, r };
    else { selection.anchor = { c, r }; selection.focus = { c, r }; }
    dragSelect = true;
    renderGrid(); updateFormulaBar(); updateStatus();
    gridWrap.focus?.();
    $s(body, '[data-testid="sheet-grid"]').focus?.();
    e.preventDefault();
  });
  tbody.addEventListener('pointerover', (e) => {
    if (!dragSelect || !(e.buttons & 1)) return;
    const td = e.target.closest('td.sheet-cell');
    if (!td) return;
    const c = Number(td.dataset.col), r = Number(td.dataset.row);
    if (selection.focus.c === c && selection.focus.r === r) return;
    selection.focus = { c, r };
    renderGrid(); updateFormulaBar(); updateStatus();
  });
  window.addEventListener('pointerup', () => { dragSelect = false; });
  tbody.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td.sheet-cell');
    if (!td) return;
    beginEdit(null);
  });

  function setCellStyle(patch) {
    if (!doc) return;
    const s = selectionRange();
    pushUndo();
    for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) {
      const addr = addrOf(c, r);
      if (!doc.cells[addr]) doc.cells[addr] = { raw: '', style: {} };
      doc.cells[addr].style = { ...(doc.cells[addr].style || {}), ...patch };
    }
    recalc(); setDirty(true); renderAll();
    os.publishWorkbook(doc.docId);
  }

  function moveSelection(dc, dr, extend = false) {
    if (!doc) return;
    const f = { c: clamp(selection.focus.c + dc, 0, doc.cols - 1), r: clamp(selection.focus.r + dr, 0, doc.rows - 1) };
    selection.focus = f;
    if (!extend) selection.anchor = { ...f };
    renderGrid(); updateFormulaBar(); updateStatus();
  }

  function copySelection(cut = false) {
    if (!doc) return;
    const s = selectionRange();
    const lines = [];
    for (let r = s.r1; r <= s.r2; r++) {
      const line = [];
      for (let c = s.c1; c <= s.c2; c++) {
        const addr = addrOf(c, r);
        line.push(doc.errors[addr] ? doc.errors[addr] : (doc.display[addr] ?? ''));
      }
      lines.push(line.join('\t'));
    }
    const text = lines.join('\n');
    try { navigator.clipboard?.writeText(text).catch(() => {}); } catch { /* ignore */ }
    os.addClipboard(text, { kind: 'sheet', systemId: sys.id, windowId: win.id, range: addrOf(s.c1, s.r1) + ':' + addrOf(s.c2, s.r2), cut });
    ctx.toast(cut ? '已剪切选区' : '已复制选区', 'success');
    if (cut) { data.sheet.clipboardCut = true; }
  }

  function pasteSelection() {
    if (!doc) return;
    const text = navigator.clipboard?.readText ? null : null;
    // 优先使用系统内记录（宿主剪贴板权限可能不可用）
    const fromHistory = os.clip[0]?.text;
    const doPaste = (content) => {
      if (content == null) return;
      const lines = String(content).replace(/\r/g, '').split('\n');
      if (!lines.length) return;
      pushUndo();
      const start = selection.focus;
      for (let ri = 0; ri < lines.length; ri++) {
        if (!lines[ri] && lines.length > 1) continue;
        const vals = lines[ri].split('\t');
        for (let ci = 0; ci < vals.length; ci++) {
          const c = start.c + ci, r = start.r + ri;
          if (c >= doc.cols || r >= doc.rows) continue;
          const addr = addrOf(c, r);
          const raw = vals[ci];
          if (raw === '') { if (doc.cells[addr]) doc.cells[addr].raw = ''; continue; }
          if (/^-?\d+(\.\d+)?$/.test(raw)) doc.cells[addr] = { ...(doc.cells[addr] || {}), raw: Number(raw), style: doc.cells[addr]?.style || {} };
          else doc.cells[addr] = { ...(doc.cells[addr] || {}), raw, style: doc.cells[addr]?.style || {} };
        }
      }
      recalc(); setDirty(true); renderAll();
      os.publishWorkbook(doc.docId);
    };
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then((t) => doPaste(t || fromHistory)).catch(() => doPaste(fromHistory));
    } else doPaste(fromHistory);
  }

  body.addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,select')) {
      if (e.target === formulaEl && e.key === 'Enter') {
        e.preventDefault();
        const value = formulaEl.value;
        pushUndo();
        const addr = activeAddr();
        if (value === '') delete doc.cells[addr];
        else doc.cells[addr] = { ...(doc.cells[addr] || {}), raw: /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value, style: doc.cells[addr]?.style || {} };
        recalc(); setDirty(true); renderAll(); os.publishWorkbook(doc.docId);
        tbody.focus?.();
      }
      if (e.target === formulaEl && e.key === 'Escape') { updateFormulaBar(); e.target.blur(); }
      return;
    }
    if (!doc) return;
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); saveWorkbook(); }
      else if (k === 'c') { e.preventDefault(); copySelection(false); }
      else if (k === 'x') { e.preventDefault(); copySelection(true); }
      else if (k === 'v') { e.preventDefault(); pasteSelection(); }
      else if (k === 'z') {
        e.preventDefault();
        if (undoStack.length) { redoStack.push(JSON.parse(JSON.stringify(doc.cells))); doc.cells = undoStack.pop(); recalc(); setDirty(true); renderAll(); os.publishWorkbook(doc.docId); }
      } else if (k === 'y') {
        e.preventDefault();
        if (redoStack.length) { undoStack.push(JSON.parse(JSON.stringify(doc.cells))); doc.cells = redoStack.pop(); recalc(); setDirty(true); renderAll(); os.publishWorkbook(doc.docId); }
      } else if (k === 'a') { e.preventDefault(); selection = { anchor: { c: 0, r: 0 }, focus: { c: doc.cols - 1, r: doc.rows - 1 } }; renderGrid(); updateStatus(); }
      return;
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(0, -1, e.shiftKey); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(0, 1, e.shiftKey); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); moveSelection(-1, 0, e.shiftKey); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); moveSelection(1, 0, e.shiftKey); }
    else if (e.key === 'Tab') { e.preventDefault(); moveSelection(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Enter') { e.preventDefault(); beginEdit(null); }
    else if (e.key === 'F2') { e.preventDefault(); beginEdit(null); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      pushUndo();
      const s = selectionRange();
      for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) {
        const addr = addrOf(c, r);
        if (doc.cells[addr]) delete doc.cells[addr];
      }
      recalc(); setDirty(true); renderAll(); os.publishWorkbook(doc.docId);
    } else if (e.key.length === 1 && !e.altKey) {
      e.preventDefault();
      beginEdit(e.key);
    }
  });

  // 点击单元格后确保网格获得焦点，键盘可用
  tbody.addEventListener('click', () => { const g = $s(body, '[data-testid="sheet-grid"]'); if (g) g.focus({ preventScroll: true }); });
  $s(body, '[data-testid="sheet-grid"]').setAttribute('tabindex', '0');

  // ---------------- 文件选择器 ----------------
  function showPicker(mode) {
    const files = [];
    (function walk(node, base) {
      if (!node) return;
      for (const child of node.children || []) {
        const p = FS.joinPath(base, child.name);
        if (child.type === 'dir') { walk(child, p); continue; }
        if (child.name.toLowerCase().endsWith('.sheet')) files.push({ node: child, path: p });
      }
    })(sys.fs, '/');
    picker.classList.remove('hidden');
    picker.innerHTML = `<div class="sheet-picker-panel">
      <div class="sheet-picker-head"><div><b>${mode === 'open' ? '打开工作簿' : '选择保存位置'}</b><span>${files.length} 个工作簿位于 ${esc(sys.name)}</span></div><button type="button" class="icon-button" data-picker-close>${uiIcon('close')}</button></div>
      <div class="sheet-picker-list">
        ${files.length ? files.map((f, i) => `<button type="button" class="sheet-picker-item" data-picker-file="${i}">${fileIcon(f.node.name, 30)}<div><b>${esc(f.node.name)}</b><span>${esc(f.path)} · ${fmtBytes(FS.fileSize(f.node))}</span></div></button>`).join('') : '<div class="empty-state">没有 .sheet 文件</div>'}
      </div>
      <div class="sheet-picker-foot"><span>也可以从文件管理器双击 .sheet 文件打开。</span></div>
    </div>`;
    $s(picker, '[data-picker-close]').addEventListener('click', () => picker.classList.add('hidden'));
    picker.addEventListener('click', (e) => { if (e.target === picker) picker.classList.add('hidden'); }, { once: true });
    for (const btn of $all(picker, '[data-picker-file]')) {
      btn.addEventListener('click', () => {
        const f = files[Number(btn.dataset.pickerFile)];
        picker.classList.add('hidden');
        if (mode === 'open') openWorkbook(f.path);
        else saveWorkbook(f.path);
      });
    }
  }

  // ---------------- 工具栏事件 ----------------
  $s(body, '[data-sheet-save]').addEventListener('click', () => saveWorkbook());
  $s(body, '[data-sheet-open]').addEventListener('click', () => showPicker('open'));
  $s(body, '[data-sheet-new]').addEventListener('click', newWorkbook);
  $s(body, '[data-sheet-saveas]').addEventListener('click', () => showPicker('save'));
  $s(body, '[data-sheet-undo]').addEventListener('click', () => {
    if (!doc || !undoStack.length) return;
    redoStack.push(JSON.parse(JSON.stringify(doc.cells)));
    doc.cells = undoStack.pop(); recalc(); setDirty(true); renderAll(); os.publishWorkbook(doc.docId);
  });
  $s(body, '[data-sheet-redo]').addEventListener('click', () => {
    if (!doc || !redoStack.length) return;
    undoStack.push(JSON.parse(JSON.stringify(doc.cells)));
    doc.cells = redoStack.pop(); recalc(); setDirty(true); renderAll(); os.publishWorkbook(doc.docId);
  });
  $s(body, '[data-sheet-bold]').addEventListener('click', () => {
    const style = doc?.cells[activeAddr()]?.style || {};
    setCellStyle({ bold: !style.bold });
  });
  for (const btn of $all(body, '[data-sheet-align]')) btn.addEventListener('click', () => setCellStyle({ align: btn.dataset.sheetAlign }));
  $s(body, '[data-sheet-numfmt]').addEventListener('change', (e) => setCellStyle({ numFmt: e.target.value }));

  // 启动
  if (win.props?.path) openWorkbook(win.props.path);
  else {
    const sample = FS.resolveNode(sys.fs, '/Demo/sample.sheet');
    if (sample) openWorkbook('/Demo/sample.sheet');
    else {
      doc = normalizeWorkbook(makeBlank(), null);
      doc.docId = 'sheet:untitled';
      recalc(); setDirty(false); renderAll();
    }
  }

  const unsubs = [];  unsubs.push(os.on('chart-connected', () => updateDataStatus()));
  unsubs.push(os.on('chart-disconnected', () => updateDataStatus()));
  unsubs.push(os.on('chart-data-orphan', () => updateDataStatus()));

  return {
    beforeClose: async () => {
      if (!doc?.dirty) return true;
      const res = await ctx.dialog({
        title: '保存对工作簿的修改？',
        message: `“${doc.name}”有未保存的修改。`,
        buttons: [{ label: '取消', value: null }, { label: '放弃', value: 'discard', danger: true }, { label: '保存', value: 'save', primary: true }],
      });
      if (!res) return false;
      if (res.button.value === 'save') return await saveWorkbook();
      return true;
    },
    destroy() {
      closed = true;
      for (const u of unsubs) u();
      if (registeredDocId) { os.unregisterWorkbook(registeredDocId); registeredDocId = null; }
      else if (doc?.docId && os.workbooks.has(doc.docId)) os.unregisterWorkbook(doc.docId);
    },
    inspect() { return { name: doc?.name, path: doc?.path, dirty: !!doc?.dirty }; },
  };
}
