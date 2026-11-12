// 电子表格计算引擎：公式解析、依赖图与按依赖关系重算
export const COLS = 26, ROWS = 100;
export const colName = (c) => String.fromCharCode(65 + c);
export const addrOf = (c, r) => colName(c) + (r + 1);
export function parseAddr(s) {
  const m = /^\$?([A-Za-z])\$?(\d+)$/.exec(String(s).trim());
  if (!m) return null;
  const c = m[1].toUpperCase().charCodeAt(0) - 65, r = parseInt(m[2], 10) - 1;
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  return { c, r };
}
export function parseRange(s) {
  const parts = String(s).trim().toUpperCase().split(':');
  const a = parseAddr(parts[0]);
  const b = parts.length > 1 ? parseAddr(parts[1]) : a;
  if (!a || !b || parts.length > 2) return null;
  return { c0: Math.min(a.c, b.c), r0: Math.min(a.r, b.r), c1: Math.max(a.c, b.c), r1: Math.max(a.r, b.r) };
}
export const rangeStr = (g) => addrOf(g.c0, g.r0) + ':' + addrOf(g.c1, g.r1);

export class SErr { constructor(code, why) { this.code = code; this.why = why; } toString() { return this.code; } }
const ERR = { div0: () => new SErr('#DIV/0!', '除数为零'), ref: (w) => new SErr('#REF!', '无效引用：' + w), circ: (w) => new SErr('#CIRC!', '循环依赖：' + w), syntax: (w) => new SErr('#ERR!', '公式语法错误：' + w), value: (w) => new SErr('#VALUE!', '需要数值：' + w), name: (w) => new SErr('#NAME?', '未知函数：' + w) };

// ---------- 公式解析 ----------
function tokenize(src) {
  const t = []; let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) { const m = /^\d*\.?\d+(?:[eE][-+]?\d+)?/.exec(src.slice(i)); if (!m) throw ERR.syntax(src.slice(i, i + 4)); t.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if (/[A-Za-z$]/.test(ch)) {
      const m = /^\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?/.exec(src.slice(i));
      const f = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (m && !/^[A-Za-z]{2,}\(/.test(src.slice(i))) { t.push({ k: m[0].includes(':') ? 'range' : 'ref', v: m[0].replace(/\$/g, '').toUpperCase() }); i += m[0].length; continue; }
      if (f) { t.push({ k: 'name', v: f[0].toUpperCase() }); i += f[0].length; continue; }
      throw ERR.syntax(ch);
    }
    if ('+-*/^(),:'.includes(ch)) { t.push({ k: 'op', v: ch }); i++; continue; }
    if (ch === '"') { const j = src.indexOf('"', i + 1); if (j < 0) throw ERR.syntax('字符串未结束'); t.push({ k: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    throw ERR.syntax(ch);
  }
  return t;
}
export function parseFormula(src) {
  const toks = tokenize(src); let p = 0;
  const peek = () => toks[p]; const next = () => toks[p++];
  const expect = (v) => { const x = next(); if (!x || x.v !== v) throw ERR.syntax(`缺少 ${v}`); };
  function expr() { let n = term(); while (peek() && (peek().v === '+' || peek().v === '-') && peek().k === 'op') { const op = next().v; n = { k: 'bin', op, a: n, b: term() }; } return n; }
  function term() { let n = power(); while (peek() && (peek().v === '*' || peek().v === '/') && peek().k === 'op') { const op = next().v; n = { k: 'bin', op, a: n, b: power() }; } return n; }
  function power() { let n = unary(); while (peek() && peek().v === '^') { next(); n = { k: 'bin', op: '^', a: n, b: unary() }; } return n; }
  function unary() { const x = peek(); if (x && x.k === 'op' && (x.v === '-' || x.v === '+')) { next(); const a = unary(); return x.v === '-' ? { k: 'neg', a } : a; } return primary(); }
  function primary() {
    const x = next();
    if (!x) throw ERR.syntax('公式不完整');
    if (x.k === 'num') return { k: 'num', v: x.v };
    if (x.k === 'str') return { k: 'str', v: x.v };
    if (x.k === 'ref') return { k: 'ref', v: x.v };
    if (x.k === 'range') return { k: 'range', v: x.v };
    if (x.k === 'name') {
      expect('(');
      const args = [];
      if (peek() && peek().v !== ')') { args.push(expr()); while (peek() && peek().v === ',') { next(); args.push(expr()); } }
      expect(')');
      return { k: 'fn', name: x.v, args };
    }
    if (x.v === '(') { const n = expr(); expect(')'); return n; }
    throw ERR.syntax(String(x.v));
  }
  const n = expr();
  if (p < toks.length) throw ERR.syntax(String(toks[p].v));
  return n;
}
function refsOf(n, out = []) {
  if (!n) return out;
  if (n.k === 'ref') out.push(n.v);
  else if (n.k === 'range') out.push(n.v);
  else if (n.k === 'bin') { refsOf(n.a, out); refsOf(n.b, out); }
  else if (n.k === 'neg') refsOf(n.a, out);
  else if (n.k === 'fn') n.args.forEach((a) => refsOf(a, out));
  return out;
}
function expandRefs(list) {
  const cells = new Set(); const bad = [];
  for (const r of list) {
    if (r.includes(':')) { const g = parseRange(r); if (!g) { bad.push(r); continue; } for (let c = g.c0; c <= g.c1; c++) for (let rr = g.r0; rr <= g.r1; rr++) cells.add(addrOf(c, rr)); }
    else if (parseAddr(r)) cells.add(parseAddr(r) && addrOf(parseAddr(r).c, parseAddr(r).r)); else bad.push(r);
  }
  return { cells, bad };
}

const FNS = {
  SUM: (vals) => vals.reduce((s, v) => s + v, 0),
  AVERAGE: (vals) => vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : new SErr('#DIV/0!', '没有数值'),
  MIN: (vals) => vals.length ? Math.min(...vals) : 0,
  MAX: (vals) => vals.length ? Math.max(...vals) : 0,
  COUNT: (vals) => vals.length,
};

export class SheetModel {
  constructor() {
    this.cells = new Map();   // addr -> {raw, fmt}
    this.values = new Map();  // addr -> number | string | SErr
    this.ast = new Map(); this.deps = new Map(); this.rdeps = new Map();
    this.colW = {}; this.version = 0; this.evalCount = 0;
  }
  raw(a) { const c = this.cells.get(a); return c ? c.raw : ''; }
  fmt(a) { const c = this.cells.get(a); return (c && c.fmt) || {}; }
  value(a) { return this.values.has(a) ? this.values.get(a) : (this.cells.has(a) ? this.literal(this.raw(a)) : null); }
  literal(raw) {
    if (raw === '' || raw == null) return null;
    const t = String(raw).trim();
    if (t !== '' && !isNaN(Number(t))) return Number(t);
    return String(raw);
  }
  setFmt(a, f) { const c = this.cells.get(a) || { raw: '' }; c.fmt = { ...(c.fmt || {}), ...f }; this.cells.set(a, c); }
  // 设置原始内容；返回需要重算的单元格
  setRaw(a, raw) {
    raw = raw == null ? '' : String(raw);
    const c = this.cells.get(a) || {};
    if (raw === '' && !c.fmt) this.cells.delete(a); else this.cells.set(a, { ...c, raw });
    for (const d of this.deps.get(a) || []) { const s = this.rdeps.get(d); if (s) s.delete(a); }
    this.deps.delete(a); this.ast.delete(a);
    if (raw.startsWith('=')) {
      let ast = null, deps = new Set();
      try { ast = parseFormula(raw.slice(1)); const ex = expandRefs(refsOf(ast)); deps = ex.cells; if (ex.bad.length) ast = { k: 'bad', bad: ex.bad, inner: ast }; }
      catch (e) { ast = { k: 'error', err: e instanceof SErr ? e : ERR.syntax(String(e)) }; }
      this.ast.set(a, ast); this.deps.set(a, deps);
      for (const d of deps) { if (!this.rdeps.has(d)) this.rdeps.set(d, new Set()); this.rdeps.get(d).add(a); }
    }
    return this.affected([a]);
  }
  affected(start) {
    const out = new Set(start); const q = [...start];
    while (q.length) { const x = q.shift(); for (const y of this.rdeps.get(x) || []) if (!out.has(y)) { out.add(y); q.push(y); } }
    return [...out];
  }
  // 按依赖关系重算给定单元格（深度优先求值，检测循环）
  recalc(list) {
    const state = new Map(); const stack = [];
    let count = 0;
    const evalCell = (a) => {
      if (state.get(a) === 2) return this.values.get(a);
      if (state.get(a) === 1) { const i = stack.indexOf(a); throw { circ: stack.slice(i).concat(a) }; }
      if (!this.ast.has(a)) { const v = this.literal(this.raw(a)); return v; }
      state.set(a, 1); stack.push(a);
      let v;
      try { v = this.evalNode(this.ast.get(a), evalCell); count++; }
      catch (e) {
        if (e && e.circ) { v = ERR.circ(e.circ.join(' → ')); for (const x of e.circ) { if (this.ast.has(x)) { this.values.set(x, v); state.set(x, 2); } } }
        else v = e instanceof SErr ? e : ERR.value(String(e));
      }
      stack.pop(); state.set(a, 2); this.values.set(a, v);
      return v;
    };
    for (const a of list) {
      if (!this.ast.has(a)) { this.values.delete(a); continue; }
      state.delete(a);
    }
    for (const a of list) if (this.ast.has(a) && state.get(a) !== 2) { try { evalCell(a); } catch (e) { /* 已记录 */ } }
    this.evalCount = count;
    return count;
  }
  recalcAll() { const all = [...this.ast.keys()]; return this.recalc(all); }
  evalNode(n, evalCell) {
    switch (n.k) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'error': throw n.err;
      case 'bad': throw ERR.ref(n.bad.join(', '));
      case 'ref': { const p = parseAddr(n.v); if (!p) throw ERR.ref(n.v); const v = evalCell(addrOf(p.c, p.r)); if (v instanceof SErr) throw v; return v == null ? 0 : v; }
      case 'range': throw ERR.value('区域只能用作函数参数（如 SUM(' + n.v + ')）');
      case 'neg': { const v = this.num(this.evalNode(n.a, evalCell)); return -v; }
      case 'bin': {
        const a = this.num(this.evalNode(n.a, evalCell)), b = this.num(this.evalNode(n.b, evalCell));
        switch (n.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': if (b === 0) throw ERR.div0(); return a / b; case '^': return Math.pow(a, b); }
        throw ERR.syntax(n.op);
      }
      case 'fn': {
        const vals = [];
        if (n.name === 'ROUND') { const v = this.num(this.evalNode(n.args[0], evalCell)); const d = n.args[1] ? this.num(this.evalNode(n.args[1], evalCell)) : 0; return Math.round(v * 10 ** d) / 10 ** d; }
        if (n.name === 'ABS') return Math.abs(this.num(this.evalNode(n.args[0], evalCell)));
        const f = FNS[n.name];
        if (!f) throw ERR.name(n.name);
        for (const arg of n.args) {
          if (arg.k === 'range') {
            const g = parseRange(arg.v); if (!g) throw ERR.ref(arg.v);
            for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) { const v = evalCell(addrOf(c, r)); if (v instanceof SErr) throw v; if (typeof v === 'number') vals.push(v); }
          } else { const v = this.evalNode(arg, evalCell); if (typeof v === 'number') vals.push(v); else if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) vals.push(Number(v)); }
        }
        const r = f(vals);
        if (r instanceof SErr) throw r;
        return r;
      }
      default: throw ERR.syntax('?');
    }
  }
  num(v) {
    if (v instanceof SErr) throw v;
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    const n = Number(v);
    if (isNaN(n)) throw ERR.value(JSON.stringify(v));
    return n;
  }
  display(a) {
    const v = this.value(a);
    if (v == null) return '';
    if (v instanceof SErr) return v.code;
    if (typeof v === 'number') {
      const f = this.fmt(a);
      if (f.dec != null) return v.toFixed(f.dec);
      if (Number.isInteger(v)) return String(v);
      return String(Math.round(v * 1e10) / 1e10);
    }
    return String(v);
  }
  // 发布用：区域内各单元格的计算结果（数值或文本，错误为错误代码）
  rangeValues(g) {
    const rows = [];
    for (let r = g.r0; r <= g.r1; r++) {
      const row = [];
      for (let c = g.c0; c <= g.c1; c++) { const v = this.value(addrOf(c, r)); row.push(v == null ? '' : v instanceof SErr ? v.code : v); }
      rows.push(row);
    }
    return rows;
  }
  toJSON(title) {
    const cells = {};
    for (const [a, c] of this.cells) cells[a] = c.fmt && Object.keys(c.fmt).length ? { v: c.raw, f: c.fmt } : { v: c.raw };
    return { format: 'nest-sheet', v: 1, title, cells, colW: this.colW };
  }
  load(data) {
    this.cells.clear(); this.values.clear(); this.ast.clear(); this.deps.clear(); this.rdeps.clear();
    this.colW = data.colW || {};
    for (const a of Object.keys(data.cells || {})) {
      const c = data.cells[a];
      const raw = typeof c === 'object' ? c.v : c;
      this.cells.set(a, { raw: String(raw == null ? '' : raw), fmt: c.f || undefined });
      this.setRaw(a, String(raw == null ? '' : raw));
      if (c.f) this.cells.get(a).fmt = c.f;
    }
    this.recalcAll();
  }
}
