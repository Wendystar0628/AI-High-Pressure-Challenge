/* ============================================================
 * 工作簿：存储格式、公式求值、区域读取
 * 公式支持四则运算、括号、单元格引用、区域引用、SUM/AVG/MIN/MAX/COUNT
 * ============================================================ */
import { fsRead, fsWrite } from './model.js';
import { pathBase } from './util.js';

export function colToIndex(col) {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function indexToCol(i) {
  let s = ''; i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
export function parseCellAddress(addr) {
  const m = /^\$?([A-Za-z]+)\$?([0-9]+)$/.exec((addr || '').trim());
  if (!m) return null;
  const c = colToIndex(m[1]), r = parseInt(m[2], 10) - 1;
  if (c < 0 || c > 255 || r < 0 || r > 5000) return null;
  return { c, r, col: m[1].toUpperCase(), row: r + 1, addr: `${m[1].toUpperCase()}${r + 1}` };
}
export function addr(c, r) { return indexToCol(c) + (r + 1); }
export function parseRange(range) {
  const m = /^\s*\$?([A-Za-z]+)\$?([0-9]+)\s*:\s*\$?([A-Za-z]+)\$?([0-9]+)\s*$/.exec(range || '');
  if (!m) {
    const one = parseCellAddress(range);
    if (one) return { c1: one.c, r1: one.r, c2: one.c, r2: one.r };
    return null;
  }
  let c1 = colToIndex(m[1]), r1 = +m[2] - 1, c2 = colToIndex(m[3]), r2 = +m[4] - 1;
  if (c1 > c2) [c1, c2] = [c2, c1];
  if (r1 > r2) [r1, r2] = [r2, r1];
  return { c1, r1, c2, r2 };
}
export function rangeAddresses(range) {
  const r = parseRange(range);
  if (!r) return [];
  const out = [];
  for (let row = r.r1; row <= r.r2; row++) for (let col = r.c1; col <= r.c2; col++) out.push(addr(col, row));
  return out;
}
export function rectFromRange(range) {
  const r = parseRange(range);
  if (!r) return null;
  return { cols: r.c2 - r.c1 + 1, rows: r.r2 - r.r1 + 1, ...r };
}

class CellError { constructor(code) { this.code = code; } }
const ERR = (c) => new CellError(c);

export function normalizeDoc(data, name) {
  const cells = {};
  const src = data && data.cells ? data.cells : (data && data.sheet && data.sheet.cells ? data.sheet.cells : {});
  for (const [k, v] of Object.entries(src || {})) {
    const p = parseCellAddress(k);
    if (!p) continue;
    if (v && typeof v === 'object') cells[p.addr] = { v: v.v !== undefined ? v.v : v.value, s: v.s || {} };
    else cells[p.addr] = { v };
  }
  return {
    format: 'nested-sheet', version: 1,
    name: name || (data && data.name) || '未命名工作簿',
    sheet: (data && data.sheetName) || 'Sheet1',
    cells, computed: {}, errors: {}, formulaCache: {}
  };
}

export function makeDoc(sys, path, data, id) {
  const normalized = normalizeDoc(data, data && data.name ? data.name : pathBase(path).replace(/\.sheet$/i, ''));
  const doc = {
    id: id || ('doc' + (sys.nextDoc++)),
    path, name: normalized.name, sheet: normalized.sheet,
    cells: normalized.cells, computed: {}, errors: {},
    dirty: false, version: 0,
    undo: [], redo: [],
    selection: { anchor: 'A1', focus: 'A1' },
    open: true, scroll: { top: 0, left: 0 },
    styleDefaults: {},
    lastComputedAt: 0
  };
  computeDoc(doc);
  return doc;
}

export function docFromFile(sys, path, id) {
  const raw = fsRead(sys, path);
  let data = null, error = null;
  if (raw == null) error = '文件不存在';
  else {
    try { data = JSON.parse(raw); } catch (e) { error = '工作簿解析失败：' + e.message; }
  }
  if (error) return { ok: false, error };
  return { ok: true, doc: makeDoc(sys, path, data, id) };
}

export function serializeDoc(doc) {
  const cells = {};
  for (const [k, c] of Object.entries(doc.cells)) {
    if (c.v === undefined || c.v === null || c.v === '') {
      if (c.s && Object.keys(c.s).length) cells[k] = { v: '', s: c.s };
      continue;
    }
    cells[k] = { v: c.v };
    if (c.s && Object.keys(c.s).length) cells[k].s = c.s;
  }
  return JSON.stringify({ format: 'nested-sheet', version: 1, name: doc.name, sheet: doc.sheet, cells }, null, 1);
}

export function saveDoc(sys, doc) {
  doc.name = doc.name || pathBase(doc.path).replace(/\.sheet$/i, '');
  const r = fsWrite(sys, doc.path, serializeDoc(doc), 'application/x-nested-sheet');
  if (r.ok) doc.dirty = false;
  return r;
}

/* ---------- 公式求值 ---------- */
function tokenizeFormula(src) {
  const t = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      t.push({ k: 'num', v: Number(src.slice(i, j)) }); i = j; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== '"') s += src[j++];
      t.push({ k: 'str', v: s }); i = j + 1; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_$.]/.test(src[j])) j++;
      t.push({ k: 'id', v: src.slice(i, j) }); i = j; continue;
    }
    if ('+-*/%(),:<>=!'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
    t.push({ k: 'op', v: c }); i++;
  }
  return t;
}

class FormulaParser {
  constructor(tokens, evaluator) { this.t = tokens; this.i = 0; this.ev = evaluator; }
  peek() { return this.t[this.i]; }
  next() { return this.t[this.i++]; }
  is(v) { const x = this.peek(); return x && x.k === 'op' && x.v === v; }
  eat(v) { if (this.is(v)) { this.i++; return true; } return false; }
  parse() { const v = this.expr(); return v; }
  expr() {
    let a = this.term();
    while (this.is('+') || this.is('-')) { const op = this.next().v; const b = this.term(); a = this.arith(a, b, op); }
    return a;
  }
  term() {
    let a = this.unary();
    while (this.is('*') || this.is('/') || this.is('%')) { const op = this.next().v; const b = this.unary(); a = this.arith(a, b, op); }
    return a;
  }
  unary() {
    if (this.eat('-')) { const v = this.unary(); return v instanceof CellError ? v : -toNum(v); }
    if (this.eat('+')) return this.unary();
    return this.primary();
  }
  primary() {
    const t = this.next();
    if (!t) return ERR('#VALUE!');
    if (t.k === 'num') return t.v;
    if (t.k === 'str') return t.v;
    if (t.k === 'op' && t.v === '(') { const v = this.expr(); this.eat(')'); return v; }
    if (t.k === 'id') {
      const up = t.v.toUpperCase();
      if (this.is('(')) {
        this.next();
        const args = [];
        if (!this.is(')')) {
          do { args.push(this.argValue()); } while (this.eat(','));
        }
        this.eat(')');
        return this.ev.callFunction(up, args);
      }
      // 区域 A1:B2
      if (this.is(':')) {
        this.next();
        const t2 = this.next();
        if (!t2 || t2.k !== 'id') return ERR('#REF!');
        return this.ev.rangeValue(t.v + ':' + t2.v);
      }
      if (/^[A-Za-z]+[0-9]+$/.test(t.v)) return this.ev.cellValue(t.v);
      return up === 'TRUE' ? true : up === 'FALSE' ? false : ERR('#NAME?');
    }
    return ERR('#VALUE!');
  }
  argValue() {
    // 参数允许区域
    const save = this.i;
    const t = this.peek();
    if (t && t.k === 'id' && /^[A-Za-z]+[0-9]+$/.test(t.v) && this.t[this.i + 1] && this.t[this.i + 1].k === 'op' && this.t[this.i + 1].v === ':') {
      this.next(); this.next();
      const t2 = this.next();
      if (t2 && t2.k === 'id') return this.ev.rangeValue(t.v + ':' + t2.v);
      return ERR('#REF!');
    }
    this.i = save;
    return this.expr();
  }
  arith(a, b, op) {
    if (a instanceof CellError) return a;
    if (b instanceof CellError) return b;
    if (typeof a === 'string' || typeof b === 'string') {
      if (op === '+' && (isNaN(Number(a)) || isNaN(Number(b)))) return String(a) + String(b);
    }
    const x = Number(a), y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return ERR('#VALUE!');
    switch (op) {
      case '+': return x + y;
      case '-': return x - y;
      case '*': return x * y;
      case '/': return y === 0 ? ERR('#DIV/0!') : x / y;
      case '%': return y === 0 ? ERR('#DIV/0!') : x % y;
    }
    return ERR('#VALUE!');
  }
}

function toNum(v) {
  if (v instanceof CellError) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return 0;
}

class Evaluator {
  constructor(doc) {
    this.doc = doc;
    this.cache = {};
    this.stack = new Set();
    this.errors = {};
  }
  cellValue(addrStr) {
    const p = parseCellAddress(addrStr);
    if (!p) return ERR('#REF!');
    const key = p.addr;
    if (Object.prototype.hasOwnProperty.call(this.cache, key)) {
      const v = this.cache[key];
      if (v instanceof CellError) return v;
      if (typeof v === 'string' && v.startsWith('#')) return ERR(v);
      return v;
    }
    if (this.stack.has(key)) {
      this.errors[key] = '#CYCLE!';
      return ERR('#CYCLE!');
    }
    const cell = this.doc.cells[key];
    if (!cell) { this.cache[key] = 0; return 0; }
    const raw = cell.v;
    if (typeof raw === 'string' && raw.startsWith('=')) {
      this.stack.add(key);
      let val;
      try {
        const toks = tokenizeFormula(raw.slice(1));
        const parser = new FormulaParser(toks, this);
        val = parser.parse();
        if (val === undefined) val = ERR('#VALUE!');
      } catch (e) { val = ERR('#VALUE!'); }
      this.stack.delete(key);
      if (val instanceof CellError) {
        this.errors[key] = val.code;
        this.cache[key] = val.code;
        return val;
      }
      if (typeof val === 'string' && val.startsWith('#')) { this.errors[key] = val; this.cache[key] = val; return ERR(val); }
      this.cache[key] = val;
      return val;
    }
    if (raw === '' || raw === null || raw === undefined) { this.cache[key] = ''; return ''; }
    this.cache[key] = raw;
    return raw;
  }
  rangeValue(range) {
    const addrs = rangeAddresses(range);
    if (!addrs.length) return ERR('#REF!');
    return addrs.map(a => this.cellValue(a));
  }
  callFunction(name, args) {
    const flat = [];
    const push = (v) => {
      if (Array.isArray(v)) { for (const x of v) push(x); }
      else flat.push(v);
    };
    for (const a of args) push(a);
    for (const v of flat) if (v instanceof CellError) return v;
    const nums = flat.map(v => typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : null)).filter(v => v != null);
    switch (name) {
      case 'SUM': return nums.reduce((a, b) => a + b, 0);
      case 'AVERAGE': case 'AVG': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : ERR('#DIV/0!');
      case 'MIN': return nums.length ? Math.min(...nums) : 0;
      case 'MAX': return nums.length ? Math.max(...nums) : 0;
      case 'COUNT': return nums.length;
      case 'ABS': return nums.length ? Math.abs(nums[0]) : ERR('#VALUE!');
      case 'ROUND': { const d = nums[1] || 0; const f = Math.pow(10, d); return Math.round(nums[0] * f) / f; }
      case 'SQRT': return nums[0] < 0 ? ERR('#VALUE!') : Math.sqrt(nums[0]);
      case 'IF': return args[0] ? args[1] : (args.length > 2 ? args[2] : null);
      default: return ERR('#NAME?');
    }
  }
}

export function computeDoc(doc) {
  const ev = new Evaluator(doc);
  const computed = {};
  const errors = {};
  for (const key of Object.keys(doc.cells)) {
    const cell = doc.cells[key];
    if (typeof cell.v === 'string' && cell.v.startsWith('=')) {
      let v = ev.cellValue(key);
      if (v instanceof CellError) { computed[key] = v.code; errors[key] = v.code; }
      else computed[key] = v;
    } else {
      computed[key] = cell.v;
    }
  }
  for (const [k, v] of Object.entries(ev.errors)) errors[k] = v;
  doc.computed = computed;
  doc.errors = errors;
  doc.version = (doc.version || 0) + 1;
  return computed;
}

export function getValue(doc, address) {
  const a = (parseCellAddress(address) || {}).addr || address;
  if (Object.prototype.hasOwnProperty.call(doc.computed || {}, a)) return doc.computed[a];
  const c = doc.cells[a];
  return c ? c.v : '';
}

export function formatValue(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '#VALUE!';
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1e6) / 1e6);
  }
  return String(v);
}

export function setCell(doc, address, raw, style) {
  const p = parseCellAddress(address);
  if (!p) return false;
  const a = p.addr;
  if (raw === '' || raw === null || raw === undefined) {
    if (style !== undefined) {
      if (!doc.cells[a]) return false;
      doc.cells[a].s = style;
    } else delete doc.cells[a];
  } else {
    doc.cells[a] = doc.cells[a] || {};
    doc.cells[a].v = raw;
    if (style !== undefined) doc.cells[a].s = style;
  }
  doc.dirty = true;
  computeDoc(doc);
  return true;
}

export function snapshotCells(doc) {
  return JSON.parse(JSON.stringify(doc.cells));
}

export function applyCellsSnapshot(doc, cells) {
  doc.cells = JSON.parse(JSON.stringify(cells));
  computeDoc(doc);
  doc.dirty = true;
}

export function columnLabel(i) { return indexToCol(i); }

export function isNumericLike(v) {
  if (typeof v === 'number') return true;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return true;
  return false;
}

export function readBlock(doc, range, labelCol, seriesCols) {
  const rect = rectFromRange(range);
  if (!rect) return { ok: false, error: '区域格式无效，应为 A1:D4' };
  const labelIdx = colToIndex(labelCol || 'A');
  if (labelIdx < rect.c1 || labelIdx > rect.c2) return { ok: false, error: '标签列不在所选区域内' };
  const series = [];
  for (const s of (Array.isArray(seriesCols) ? seriesCols : String(seriesCols || '').split(','))) {
    const col = String(s).trim().toUpperCase();
    if (!col) continue;
    const ci = colToIndex(col);
    if (ci < rect.c1 || ci > rect.c2) return { ok: false, error: `数值列 ${col} 不在所选区域内` };
    series.push({ col, ci });
  }
  if (!series.length) return { ok: false, error: '至少需要一个数值列' };
  const rows = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    const label = formatValue(getValue(doc, addr(labelIdx, r)));
    rows.push({ row: r, label, values: series.map(s => getValue(doc, addr(s.ci, r))) });
  }
  // 跳过表头行
  if (rows.length > 1) {
    const first = rows[0];
    const headerish = first.values.every(v => !isNumericLike(v)) && (first.label === '项目' || !isNumericLike(first.label));
    if (headerish && rows.slice(1).some(r => r.values.some(isNumericLike))) rows.shift();
  }
  return {
    ok: true,
    range, labelCol, version: doc.version,
    labels: rows.map(r => r.label || `行 ${r.row + 1}`),
    series: series.map((s, i) => ({
      key: s.col,
      name: formatValue(getValue(doc, addr(s.ci, rect.r1))) || s.col,
      values: rows.map(r => {
        const v = r.values[i];
        return isNumericLike(v) ? Number(v) : 0;
      })
    })),
    addresses: rangeAddresses(range)
  };
}

export function columnOfCell(a) { const p = parseCellAddress(a); return p ? p.col : null; }
