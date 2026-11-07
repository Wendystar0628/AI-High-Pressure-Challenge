'use strict';
// 自定义程序虚拟机：程序是可编辑的文本，经系统内编译器降低为可执行指令表。
// 指令消耗逻辑预算；sys 陷入所属内核，dev 调用宿主提供的设备。

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1, v = '';
      while (j < s.length && s[j] !== q) {
        if (s[j] === '\\' && j + 1 < s.length) {
          const n = s[j + 1];
          v += ({ n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" })[n] || n;
          j += 2;
        } else { v += s[j]; j++; }
      }
      out.push({ t: 'str', v }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i; while (j < s.length && /[0-9.eE+-]/.test(s[j])) {
        if ((s[j] === '+' || s[j] === '-') && !/[eE]/.test(s[j - 1] || '')) break;
        j++;
      }
      out.push({ t: 'num', v: Number(s.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < s.length && /[A-Za-z0-9_$.]/.test(s[j])) j++;
      out.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
    }
    const two = s.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/%<>!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if ('()[]{},'.includes(c)) { out.push({ t: 'punc', v: c }); i++; continue; }
    if (c === '=') { out.push({ t: 'op', v: '=' }); i++; continue; }
    throw new Error('无法识别的字符: ' + c + ' @ ' + s);
  }
  return out;
}

const PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '=': 3 };
function parseExpr(text) {
  const tk = tokenize(String(text));
  let p = 0;
  const peek = () => tk[p];
  const next = () => tk[p++];
  function bin(min) {
    let left = unary();
    while (peek() && (peek().t === 'op') && (PREC[peek().v] || 0) >= min) {
      const op = next().v;
      const right = bin((PREC[op] || 0) + 1);
      left = { t: 'bin', op, a: left, b: right };
    }
    return left;
  }
  function unary() {
    const t = peek();
    if (t && t.t === 'op' && (t.v === '!' || t.v === '-')) { next(); return { t: 'un', op: t.v, a: unary() }; }
    if (t && t.t === 'punc' && t.v === '(') { next(); const e = bin(1); if (peek() && peek().v === ')') next(); return e; }
    if (t && t.t === 'punc' && t.v === '[') { next(); if (peek() && peek().v === ']') next(); return { t: 'lit', v: [] }; }
    if (t && t.t === 'punc' && t.v === '{') { next(); if (peek() && peek().v === '}') next(); return { t: 'lit', v: {} }; }
    if (t && t.t === 'num') { next(); return { t: 'lit', v: t.v }; }
    if (t && t.t === 'str') { next(); return { t: 'lit', v: t.v }; }
    if (t && t.t === 'id') {
      next();
      if (peek() && peek().t === 'punc' && peek().v === '(') {
        next(); const args = [];
        while (peek() && !(peek().t === 'punc' && peek().v === ')')) {
          args.push(bin(1));
          if (peek() && peek().v === ',') next(); else break;
        }
        if (peek() && peek().v === ')') next();
        return { t: 'call', name: t.v, args };
      }
      return { t: 'var', name: t.v };
    }
    throw new Error('表达式语法错误: ' + text);
  }
  const ast = bin(1);
  return ast;
}

function truthy(v) {
  if (v === null || v === undefined || v === false || v === 0 || v === '' || (typeof v === 'number' && Number.isNaN(v))) return false;
  if (Array.isArray(v) || typeof v === 'object') return true;
  return true;
}
function toStr(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  return String(v);
}
function asIndex(k) { return typeof k === 'number' ? k : String(k); }

function builtin(name, a) {
  const S = toStr, N = x => Number(x) || 0;
  switch (name) {
    case 'get': { const c = a[0], k = asIndex(a[1]); return (c && typeof c === 'object') ? c[k] : null; }
    case 'len': return (a[0] == null) ? 0 : (a[0].length !== undefined ? a[0].length : Object.keys(a[0]).length);
    case 'str': return S(a[0]);
    case 'num': return N(a[0]);
    case 'isnum': { const n = Number(a[0]); return typeof a[0] === 'number' || (a[0] !== '' && Number.isFinite(n)); }
    case 'cat': return a.map(S).join('');
    case 'split': return S(a[0]).split(S(a[1]));
    case 'join': return (Array.isArray(a[0]) ? a[0] : []).map(S).join(S(a[1]));
    case 'words': return S(a[0]).trim().split(/\s+/).filter(x => x !== '');
    case 'trim': return S(a[0]).trim();
    case 'find': return S(a[0]).indexOf(S(a[1]));
    case 'has': return !!(a[0] && typeof a[0] === 'object' && Object.prototype.hasOwnProperty.call(a[0], asIndex(a[1])));
    case 'keys': return (a[0] && typeof a[0] === 'object') ? Object.keys(a[0]) : [];
    case 'sub': return S(a[0]).slice(N(a[1]), N(a[2]));
    case 'char': return S(a[0]).charAt(N(a[1]));
    case 'rep': { const s = S(a[0]), f = S(a[1]), t = S(a[2]); return f === '' ? s : s.split(f).join(t); }
    case 'gotosub': {
      const s = S(a[0]), f = S(a[1]), t = S(a[2]);
      const esc2 = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return s.replace(new RegExp(esc2 + '(?=\\s|$)', 'g'), t);
    }
    case 'abs': return Math.abs(N(a[0]));
    case 'min': return Math.min(N(a[0]), N(a[1]));
    case 'max': return Math.max(N(a[0]), N(a[1]));
    case 'floor': return Math.floor(N(a[0]));
    case 'ceil': return Math.ceil(N(a[0]));
    case 'round': return Math.round(N(a[0]));
    case 'type': return Array.isArray(a[0]) ? 'list' : typeof a[0];
    default: return null;
  }
}

function evalExpr(ast, vars) {
  switch (ast.t) {
    case 'lit': return ast.v;
    case 'var': {
      if (ast.name === 'true') return true;
      if (ast.name === 'false') return false;
      if (ast.name === 'null') return null;
      return vars[ast.name] === undefined ? null : vars[ast.name];
    }
    case 'un': { const v = evalExpr(ast.a, vars); return ast.op === '!' ? !truthy(v) : -(Number(v) || 0); }
    case 'call': return builtin(ast.name, ast.args.map(x => evalExpr(x, vars)));
    case 'bin': {
      const A = evalExpr(ast.a, vars), B = evalExpr(ast.b, vars);
      switch (ast.op) {
        case '+': return (typeof A === 'string' || typeof B === 'string') ? toStr(A) + toStr(B) : (Number(A) || 0) + (Number(B) || 0);
        case '-': return (Number(A) || 0) - (Number(B) || 0);
        case '*': return (Number(A) || 0) * (Number(B) || 0);
        case '/': { const d = Number(B) || 0; return d === 0 ? null : (Number(A) || 0) / d; }
        case '%': return (Number(A) || 0) % (Number(B) || 1);
        case '==': return A === B || toStr(A) === toStr(B);
        case '!=': return !(A === B || toStr(A) === toStr(B));
        case '<': return (Number(A) || 0) < (Number(B) || 0);
        case '>': return (Number(A) || 0) > (Number(B) || 0);
        case '<=': return (Number(A) || 0) <= (Number(B) || 0);
        case '>=': return (Number(A) || 0) >= (Number(B) || 0);
        case '&&': return truthy(A) && truthy(B);
        case '||': return truthy(A) || truthy(B);
        case '=': return A === B;
      }
      return null;
    }
  }
  return null;
}

function splitTop(s) {
  const out = []; let depth = 0, q = null, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; cur += c; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; cur += c; continue; }
    if (/\s/.test(c) && depth === 0) { if (cur) { out.push(cur); cur = ''; } continue; }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

// 宿主引导解析器：把程序文本变成指令表。系统内编译器输出的是同一格式的降低文本。
function parseInstruction(tokens) {
  const head = tokens[0];
  let ins = null;
  if (head === 'set' && tokens[1] && tokens[2] === '=') {
    ins = { op: 'set', v: tokens[1], e: parseExpr(tokens.slice(3).join(' ')) };
  } else if (head === 'push') {
    ins = { op: 'push', v: tokens[1], e: parseExpr(tokens.slice(2).join(' ')) };
  } else if (head === 'seti') {
    ins = { op: 'seti', v: tokens[1], k: parseExpr(tokens[2]), e: parseExpr(tokens.slice(3).join(' ')) };
  } else if (head === 'del') {
    ins = { op: 'del', v: tokens[1], k: parseExpr(tokens[2]) };
  } else if (head === 'label') {
    ins = { op: 'nop', label: tokens[1] };
  } else if (head === 'goto') {
    ins = { op: 'goto', t: tokens[1] };
  } else if (head === 'out') {
    ins = { op: 'out', e: parseExpr(tokens.slice(1).join(' ')) };
  } else if (head === 'sys' || head === 'dev') {
    const arrow = tokens.indexOf('->');
    const body = arrow >= 0 ? tokens.slice(0, arrow) : tokens;
    const outVar = arrow >= 0 ? tokens[arrow + 1] : null;
    ins = { op: head, name: body[1], args: body.slice(2).map(x => parseExpr(x)), out: outVar };
  } else if (head === 'end') ins = { op: 'end' };
  else if (head === 'yield') ins = { op: 'yield' };
  else if (head === 'err') ins = { op: 'err', e: parseExpr(tokens.slice(1).join(' ')) };
  else if (head === 'nop') ins = { op: 'nop' };
  else throw new Error('无法识别的指令: ' + tokens.join(' '));
  return ins;
}
function parseSource(text) {
  const lines = String(text).split('\n');
  const raw = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t[0] === '#') continue;
    const tokens = splitTop(t);
    if (!tokens.length) continue;
    const head = tokens[0];
    let ins = null;
    if (head === 'if' || head === 'ifn') {
      const gi = tokens.indexOf('goto');
      if (gi > 0) {
        ins = { op: head, e: parseExpr(tokens.slice(1, gi).join(' ')), t: tokens[gi + 1] };
      } else {
        // 内联条件指令：if 条件 <单条指令>
        // 找出条件表达式与内联指令的分界：第一条可识别的指令头
        let cut = -1;
        for (let i = 1; i < tokens.length; i++) {
          if (['set', 'push', 'seti', 'out', 'sys', 'dev', 'goto', 'end', 'yield', 'err', 'nop', 'del'].includes(tokens[i]) &&
              (tokens[i] !== 'set' || tokens[i + 2] === '=')) { cut = i; break; }
        }
        if (cut < 0) throw new Error('if 缺少跳转或内联指令: ' + t);
        ins = { op: head === 'if' ? 'ifinline' : 'ifninline', e: parseExpr(tokens.slice(1, cut).join(' ')), inline: parseInstruction(tokens.slice(cut)) };
      }
    } else ins = parseInstruction(tokens);
    raw.push(ins);
  }
  // 把内联条件指令展开为「条件跳过 + 单条指令」
  const code = [];
  for (const ins of raw) {
    if (ins.op === 'ifinline' || ins.op === 'ifninline') {
      const j = code.length;
      code.push({ op: ins.op === 'ifinline' ? 'ifn' : 'if', e: ins.e, t: j + 2 });
      code.push(ins.inline);
    } else code.push(ins);
  }
  // 解析标签：编译器通常已经把名字替换为行号，这里兼容两者。
  const labels = {};
  code.forEach((ins, i) => { if (ins.label) labels[ins.label] = i; });
  for (const ins of code) {
    if (ins.op === 'goto' || ins.op === 'if' || ins.op === 'ifn') {
      if (/^[0-9]+$/.test(String(ins.t))) ins.t = Number(ins.t);
      else if (labels[ins.t] !== undefined) ins.t = labels[ins.t];
      else ins.t = code.length;
    }
    delete ins.label;
  }
  return code;
}

function estimateCost(ins, value) {
  let c = 1;
  if (value !== undefined && value !== null) {
    const sz = typeof value === 'object' ? JSON.stringify(value).length : String(value).length;
    c += Math.min(60, Math.floor(sz / 24));
  }
  if (ins.op === 'sys' || ins.op === 'dev') c += 1;
  return c;
}

class CPU {
  constructor() { this.procs = {}; this.traps = []; this.nextPid = 1; }
  spawn(code, opts) {
    opts = opts || {};
    const pid = 'p' + (this.nextPid++);
    const a = opts.args || {};
    this.procs[pid] = {
      pid, code, pc: 0, vars: Object.assign({ args: a }, opts.vars || {}), args: a,
      out: [], status: 'ready', name: opts.name || 'program', kind: opts.kind || 'user',
      appId: opts.appId || null, quota: opts.quota || 0, workDone: 0, mem: 0,
      waitKind: null, waitUntil: null, inbox: [], pendingSys: null, lastError: null,
      createdAt: opts.createdAt || 0, owner: opts.owner || null
    };
    return pid;
  }
  kill(pid) { const p = this.procs[pid]; if (p) { p.status = 'ended'; p.inbox = []; } }
  snapshot() {
    const o = {};
    for (const pid in this.procs) {
      const p = this.procs[pid];
      o[pid] = { status: p.status, waitKind: p.waitKind, waitUntil: p.waitUntil, quota: p.quota,
        work: p.workDone, mem: p.mem, kind: p.kind, appId: p.appId, name: p.name,
        inboxLen: p.inbox.length, lastError: p.lastError, outLen: p.out.length };
    }
    return o;
  }
  step(pid, maxUnits, budget, devHandler, ctx) {
    const p = this.procs[pid];
    if (!p || p.status !== 'ready') return { used: 0, event: p ? p.status : 'missing' };
    let used = 0, event = 'units', left = maxUnits;
    while (left > 0 && p.status === 'ready') {
      if (p.pc >= p.code.length) { p.status = 'ended'; event = 'ended'; break; }
      const ins = p.code[p.pc];
      let value;
      // 预估开销（先取值再计费，保证大规模数据处理按规模付费）
      try {
        if (ins.e) value = evalExpr(ins.e, p.vars);
      } catch (e) { p.status = 'error'; p.lastError = String(e.message || e); event = 'error'; break; }
      const cost = estimateCost(ins, value);
      if (!budget.can(cost)) { event = 'budget'; break; }
      budget.take(cost); used += cost; left -= cost;
      let jump = false;
      try {
        switch (ins.op) {
          case 'nop': break;
          case 'set': p.vars[ins.v] = value; break;
          case 'push': { if (!Array.isArray(p.vars[ins.v])) p.vars[ins.v] = []; p.vars[ins.v].push(value); break; }
          case 'seti': { const k = asIndex(evalExpr(ins.k, p.vars)); const c = p.vars[ins.v]; if (c && typeof c === 'object') c[k] = value; break; }
          case 'del': { const k = asIndex(evalExpr(ins.k, p.vars)); const c = p.vars[ins.v]; if (c && typeof c === 'object') delete c[k]; break; }
          case 'out': p.out.push(toStr(value)); if (p.out.length > 200) p.out.shift(); break;
          case 'if': case 'ifn': {
            const yes = ins.op === 'if' ? truthy(value) : !truthy(value);
            if (yes) { p.pc = ins.t; jump = true; }
            break;
          }
          case 'goto': p.pc = ins.t; jump = true; break;
          case 'end': p.status = 'ended'; event = 'ended'; break;
          case 'yield': event = 'yield'; p.pc++; p.workDone += used; return { used, event: 'yield' };
          case 'err': p.status = 'error'; p.lastError = toStr(value); event = 'error'; break;
          case 'sys': {
            const args = ins.args.map(a => evalExpr(a, p.vars));
            p.pendingSys = { name: ins.name, args, out: ins.out };
            p.status = 'wait'; p.waitKind = 'sys';
            this.traps.push({ pid, name: ins.name, args, out: ins.out });
            event = 'trap'; p.pc++; p.workDone += used; return { used, event };
          }
          case 'dev': {
            const args = ins.args.map(a => evalExpr(a, p.vars));
            let r = null;
            try { r = devHandler(ins.name, args, Object.assign({ cpu: this, pid, proc: p }, ctx || {})); }
            catch (e) { r = { __err: String(e.message || e) }; }
            p.vars[ins.out] = r === undefined ? null : r;
            break;
          }
        }
      } catch (e) { p.status = 'error'; p.lastError = String(e.message || e); event = 'error'; break; }
      if (!jump) p.pc++;
      if (event === 'ended' || event === 'error') break;
    }
    p.workDone += used;
    return { used, event };
  }
}

module.exports = { parseExpr, evalExpr, builtin, parseSource, CPU, toStr, truthy, splitTop };
