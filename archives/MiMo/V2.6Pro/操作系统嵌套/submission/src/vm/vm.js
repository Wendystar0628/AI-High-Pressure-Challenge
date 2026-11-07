// KernelScript (KS) — 显式栈机解释器(运行位置可序列化)
// 语句块以 end 结束;支持 var/赋值/if/while/for/forin/fn/return/break/continue。
// 用户函数调用仅出现在语句级(var x = f(...) / x = f(...) / f(...) / return f(...)),
// 原生与系统调用可出现在任意表达式位置。

// ============ 词法 ============
const KEYWORDS = new Set(['var', 'if', 'else', 'while', 'for', 'in', 'to', 'step', 'fn', 'return', 'break', 'continue', 'end', 'true', 'false', 'null', 'and', 'or', 'not']);

export function tokenize(src) {
  const toks = [];
  let i = 0, line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { toks.push({ t: 'nl', line }); line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      if ((src[j] === 'e' || src[j] === 'E') && /[0-9+-]/.test(src[j + 1] || '')) {
        j += 2;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      toks.push({ t: 'num', v: parseFloat(src.slice(i, j)), line });
      i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (KEYWORDS.has(word)) toks.push({ t: word, line });
      else toks.push({ t: 'name', v: word, line });
      i = j; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, out = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') {
          const e = src[j + 1];
          out += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e === '0' ? '\0' : e;
          j += 2;
        } else { out += src[j]; j++; }
      }
      toks.push({ t: 'str', v: out, line });
      i = j + 1; continue;
    }
    const two = src.substr(i, 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/='].includes(two)) {
      toks.push({ t: two, line }); i += 2; continue;
    }
    if ('+-*/%<>=!()[]{},.:'.includes(c)) { toks.push({ t: c, line }); i++; continue; }
    throw new Error(`非法字符 '${c}' (行 ${line})`);
  }
  toks.push({ t: 'eof', line });
  return toks;
}

// ============ 语法 ============
export function parse(src) {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const at = (t) => toks[pos].t === t;
  const next = () => toks[pos++];
  const expect = (t) => {
    if (!at(t)) throw new Error(`期望 '${t}' 但得到 '${peek().t}' (行 ${peek().line})`);
    return next();
  };
  const skipNl = () => { while (at('nl')) next(); };

  function parseProgram() {
    const body = [];
    skipNl();
    while (!at('eof')) { body.push(parseStmt()); skipNl(); }
    return { type: 'program', body };
  }
  function parseBlock(stop) {
    const body = [];
    skipNl();
    while (!at('eof') && !stop.has(peek().t)) { body.push(parseStmt()); skipNl(); }
    return body;
  }
  function parseStmt() {
    const tk = peek();
    if (tk.t === 'var') {
      next();
      const name = expect('name').v;
      let init = null;
      if (at('=')) { next(); init = parseExpr(); }
      return { type: 'var', name, init, line: tk.line };
    }
    if (tk.t === 'if') {
      next();
      const cond = parseExpr();
      skipNl();
      const body = parseBlock(new Set(['else', 'end']));
      let alt = null;
      if (at('else')) { next(); skipNl(); alt = parseBlock(new Set(['end'])); }
      expect('end');
      return { type: 'if', cond, body, alt, line: tk.line };
    }
    if (tk.t === 'while') {
      next();
      const cond = parseExpr();
      skipNl();
      const body = parseBlock(new Set(['end']));
      expect('end');
      return { type: 'while', cond, body, line: tk.line };
    }
    if (tk.t === 'for') {
      next();
      const name = expect('name').v;
      if (at('in')) {
        next();
        const iter = parseExpr();
        skipNl();
        const body = parseBlock(new Set(['end']));
        expect('end');
        return { type: 'forin', name, iter, body, line: tk.line };
      }
      expect('=');
      const start = parseExpr();
      expect('to');
      const stop = parseExpr();
      let step = null;
      if (at('step')) { next(); step = parseExpr(); }
      skipNl();
      const body = parseBlock(new Set(['end']));
      expect('end');
      return { type: 'for', name, start, stop, step, body, line: tk.line };
    }
    if (tk.t === 'fn') {
      next();
      const name = expect('name').v;
      expect('(');
      const params = [];
      if (!at(')')) {
        params.push(expect('name').v);
        while (at(',')) { next(); params.push(expect('name').v); }
      }
      expect(')');
      skipNl();
      const body = parseBlock(new Set(['end']));
      expect('end');
      return { type: 'fn', name, params, body, line: tk.line };
    }
    if (tk.t === 'return') {
      next();
      let value = null;
      if (!at('nl') && !at('eof') && !at('end')) value = parseExpr();
      return { type: 'return', value, line: tk.line };
    }
    if (tk.t === 'break') { next(); return { type: 'break', line: tk.line }; }
    if (tk.t === 'continue') { next(); return { type: 'continue', line: tk.line }; }
    const e = parseExpr();
    if (at('=') || at('+=') || at('-=') || at('*=') || at('/=')) {
      const op = next().t;
      const value = parseExpr();
      return { type: 'assign', target: e, op, value, line: tk.line };
    }
    return { type: 'expr', expr: e, line: tk.line };
  }
  function parseExpr() { return parseOr(); }
  function parseOr() {
    let l = parseAnd();
    while (at('||') || at('or')) { next(); l = { type: 'logic', op: '||', l, r: parseAnd() }; }
    return l;
  }
  function parseAnd() {
    let l = parseCmp();
    while (at('&&') || at('and')) { next(); l = { type: 'logic', op: '&&', l, r: parseCmp() }; }
    return l;
  }
  function parseCmp() {
    let l = parseAdd();
    while (['==', '!=', '<', '<=', '>', '>='].includes(peek().t)) {
      const op = next().t;
      l = { type: 'bin', op, l, r: parseAdd() };
    }
    return l;
  }
  function parseAdd() {
    let l = parseMul();
    while (at('+') || at('-')) { const op = next().t; l = { type: 'bin', op, l, r: parseMul() }; }
    return l;
  }
  function parseMul() {
    let l = parseUnary();
    while (at('*') || at('/') || at('%')) { const op = next().t; l = { type: 'bin', op, l, r: parseUnary() }; }
    return l;
  }
  function parseUnary() {
    if (at('-') || at('!') || at('not')) {
      const tk = next();
      return { type: 'un', op: tk.t === 'not' ? '!' : tk.t, e: parseUnary() };
    }
    return parsePostfix();
  }
  function parsePostfix() {
    let e = parsePrimary();
    for (;;) {
      if (at('(')) {
        next();
        const args = [];
        if (!at(')')) {
          args.push(parseExpr());
          while (at(',')) { next(); if (at(')')) break; args.push(parseExpr()); }
        }
        expect(')');
        e = { type: 'call', callee: e, args };
      } else if (at('[')) {
        next();
        const idx = parseExpr();
        expect(']');
        e = { type: 'index', obj: e, idx };
      } else if (at('.')) {
        next();
        e = { type: 'member', obj: e, name: expect('name').v };
      } else break;
    }
    return e;
  }
  function parsePrimary() {
    const tk = peek();
    if (tk.t === 'num') { next(); return { type: 'num', v: tk.v }; }
    if (tk.t === 'str') { next(); return { type: 'str', v: tk.v }; }
    if (tk.t === 'true') { next(); return { type: 'bool', v: true }; }
    if (tk.t === 'false') { next(); return { type: 'bool', v: false }; }
    if (tk.t === 'null') { next(); return { type: 'null' }; }
    if (tk.t === 'name') { next(); return { type: 'name', name: tk.v }; }
    if (tk.t === '(') { next(); const e = parseExpr(); expect(')'); return e; }
    if (tk.t === '[') {
      next();
      const items = [];
      if (!at(']')) {
        items.push(parseExpr());
        while (at(',')) { next(); if (at(']')) break; items.push(parseExpr()); }
      }
      expect(']');
      return { type: 'array', items };
    }
    if (tk.t === '{') {
      next();
      const props = [];
      if (!at('}')) {
        for (;;) {
          let key;
          if (at('name')) key = next().v;
          else if (at('str')) key = next().v;
          else throw new Error(`对象键错误 (行 ${tk.line})`);
          expect(':');
          props.push([key, parseExpr()]);
          if (at(',')) { next(); if (at('}')) break; continue; }
          break;
        }
      }
      expect('}');
      return { type: 'object', props };
    }
    throw new Error(`意外的符号 '${tk.t}' (行 ${tk.line})`);
  }
  return parseProgram();
}

// ============ 运行时值 ============
export class UserFn {
  constructor(def, closureId) {
    this.def = def;
    this.closureId = closureId;   // 作用域 id(在 vm.scopes 中)
  }
}

function truthy(v) { return !(v == null || v === false || v === 0 || v === ''); }
function looseEq(a, b) {
  if (a == null && b == null) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    return Number(a) === Number(b);
  }
  return a === b;
}
function cmpVal(a, b) {
  const x = Number(a), y = Number(b);
  if (typeof a !== 'string' && typeof b !== 'string' && !isNaN(x) && !isNaN(y)) {
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const sa = String(a), sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
function binOp(op, l, r, line) {
  switch (op) {
    case '+':
      if (typeof l === 'string' || typeof r === 'string') return String(l ?? '') + String(r ?? '');
      return Number(l) + Number(r);
    case '-': return Number(l) - Number(r);
    case '*': return Number(l) * Number(r);
    case '/': {
      const d = Number(r);
      if (d === 0) throw makeErr('除零错误', line);
      return Number(l) / d;
    }
    case '%': {
      const d = Number(r);
      if (d === 0) throw makeErr('除零错误', line);
      return Number(l) % d;
    }
    case '==': return looseEq(l, r);
    case '!=': return !looseEq(l, r);
    case '<': return cmpVal(l, r) < 0;
    case '<=': return cmpVal(l, r) <= 0;
    case '>': return cmpVal(l, r) > 0;
    case '>=': return cmpVal(l, r) >= 0;
    default: throw makeErr('未知运算符: ' + op, line);
  }
}
function makeErr(msg, line) {
  const e = new Error(msg + (line ? ` (行 ${line})` : ''));
  e.isVMError = true;
  e.line = line;
  return e;
}
export function indexGet(obj, idx) {
  if (obj == null) return null;
  if (Array.isArray(obj)) return obj[idx | 0] ?? null;
  if (typeof obj === 'string') return obj[idx | 0] ?? null;
  return obj[String(idx)] ?? null;
}
export function memberGet(obj, name) {
  if (obj == null) return null;
  if (typeof obj === 'string') {
    if (name === 'length') return obj.length;
    return null;
  }
  if (Array.isArray(obj)) {
    switch (name) {
      case 'length': return obj.length;
      case 'push': return (v) => { obj.push(v); return obj.length; };
      case 'pop': return () => obj.pop();
      case 'shift': return () => obj.shift();
      case 'slice': return (a, b) => obj.slice(a, b);
      case 'indexOf': return (v) => obj.indexOf(v);
      case 'join': return (s) => obj.join(s == null ? ',' : s);
      case 'reverse': return () => { obj.reverse(); return obj; };
      default: return obj[name] ?? null;
    }
  }
  if (typeof obj === 'object') return obj[name] ?? null;
  return null;
}

export class VMError extends Error {}

// ============ VM(显式栈机) ============
// 状态: frames(调用帧) + scopes(id -> Map) + natives + globals
// 每帧: {kind:'main'|'fn', fnName, stmts, ip, scopeId, retTo?}
// 循环帧: {kind:'while'|'for'|'forin', stmts, ip, scopeId, ...}

let SCOPE_SEQ = 1;

export class VM {
  constructor(source, opts = {}) {
    this.name = opts.name || 'prog';
    this.source = typeof source === 'string' ? source : '';
    this.ast = typeof source === 'string' ? parse(source) : source;
    this.natives = opts.natives || {};
    this.onTrap = opts.onTrap || null;
    this.work = 0;
    this.done = false;
    this.error = null;
    this.retVal = undefined;
    this.trap = null;          // 挂起的陷阱 {name,args,result}
    this.suspended = false;
    this.scopes = new Map();   // id -> Map
    this.globals = new Map();  // 顶层变量(也放进 scopes[0])
    this.frames = [];
    const sid = this._newScope();
    this.rootScopeId = sid;
    this.frames.push({ kind: 'main', stmts: this.ast.body, ip: 0, scopeId: sid });
  }

  _newScope(parentValues) {
    const id = SCOPE_SEQ++;
    const m = new Map(parentValues || []);
    this.scopes.set(id, m);
    return id;
  }
  _scope(id) {
    let s = this.scopes.get(id);
    if (!s) { s = new Map(); this.scopes.set(id, s); }
    return s;
  }
  _lookup(name, scopeId) {
    let id = scopeId;
    // 沿帧链向上查找
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const s = this._scope(this.frames[i].scopeId);
      if (s.has(name)) return s;
    }
    const root = this._scope(this.rootScopeId);
    if (root.has(name)) return root;
    return null;
  }

  // ---- 执行 ----
  run(maxWork) {
    if (this.done) return 'done';
    if (this.suspended && this.injected && this.injected.length) {
      this.suspended = false;
      this.trap = null;
      if (this.frames.length) {
        const fr = this.frames[this.frames.length - 1];
        if (fr.ip > 0) fr.ip -= 1;
      }
    }
    if (this.suspended) return 'trap';
    this.work = 0;
    const budget = maxWork == null ? Infinity : maxWork;
    try {
      while (this.work < budget) {
        if (this.frames.length === 0) {
          this.done = true;
          return 'done';
        }
        const r = this._step();
        if (r !== 0) return r;
      }
      return 'budget';
    } catch (e) {
      if (e && e.__yield) return 'yield';
      if (e && e.__trap) {
        this.trap = e;
        this.suspended = true;
        return 'trap';
      }
      if (e && e.isVMError) {
        this.error = e;
        this.done = true;
        return 'done';
      }
      this.error = makeErr(e && e.message || String(e), 0);
      this.done = true;
      return 'done';
    }
  }

  _step() {
    const fr = this.frames[this.frames.length - 1];
    const scope = this._scope(fr.scopeId);

    // 循环帧推进
    if (fr.kind === 'while') {
      if (fr.ip >= fr.stmts.length) {
        // 重新判断条件
        this.work += 1;
        const c = truthy(this._evalSync(fr.cond, scope));
        if (c) { fr.ip = 0; return 0; }
        this.frames.pop();
        return 0;
      }
    } else if (fr.kind === 'for') {
      if (fr.ip >= fr.stmts.length) {
        this.work += 1;
        fr.cur += fr.step;
        const more = fr.step > 0 ? fr.cur <= fr.stop : fr.cur >= fr.stop;
        if (more) {
          scope.set(fr.varName, fr.cur);
          fr.ip = 0;
          return 0;
        }
        this.frames.pop();
        return 0;
      }
    } else if (fr.kind === 'forin') {
      if (fr.ip >= fr.stmts.length) {
        this.work += 1;
        fr.i++;
        if (fr.i < fr.arr.length) {
          scope.set(fr.varName, fr.arr[fr.i]);
          fr.ip = 0;
          return 0;
        }
        this.frames.pop();
        return 0;
      }
    } else if (fr.kind === 'block') {
      if (fr.ip >= fr.stmts.length) {
        this.frames.pop();
        return 0;
      }
    } else if (fr.kind === 'main' || fr.kind === 'fn') {
      if (fr.ip >= fr.stmts.length) {
        if (fr.kind === 'fn') {
          // 函数自然结束返回 null
          this.frames.pop();
          if (fr.retTo !== undefined && fr.retTo !== null) {
            this._scope(fr.retScope).set(fr.retName, null);
          }
          return 0;
        }
        this.done = true;
        return 0;
      }
    }

    const stmt = fr.stmts[fr.ip++];
    this.work += 1;
    this._exec(stmt, scope, fr);
    return 0;
  }

  _exec(stmt, scope, fr) {
    switch (stmt.type) {
      case 'var': {
        const v = stmt.init ? this._evalSync(stmt.init, scope) : null;
        scope.set(stmt.name, v);
        return;
      }
      case 'assign': {
        const v = this._evalSync(stmt.value, scope);
        this._assignSync(stmt.target, v, stmt.op, scope);
        return;
      }
      case 'expr': {
        this._evalSync(stmt.expr, scope);
        return;
      }
      case 'if': {
        const c = truthy(this._evalSync(stmt.cond, scope));
        const body = c ? stmt.body : stmt.alt;
        if (body && body.length) {
          this.frames.push({ kind: 'block', stmts: body, ip: 0, scopeId: this._newScope(scope) });
        }
        return;
      }
      case 'while': {
        const c = truthy(this._evalSync(stmt.cond, scope));
        if (c) {
          this.frames.push({
            kind: 'while', stmts: stmt.body, ip: 0,
            scopeId: this._newScope(scope), cond: stmt.cond,
          });
        }
        return;
      }
      case 'for': {
        const start = Number(this._evalSync(stmt.start, scope));
        const stop = Number(this._evalSync(stmt.stop, scope));
        const step = stmt.step ? Number(this._evalSync(stmt.step, scope)) : (start <= stop ? 1 : -1);
        const ns = this._newScope(scope);
        this._scope(ns).set(stmt.name, start);
        this.frames.push({
          kind: 'for', stmts: stmt.body, ip: 0, scopeId: ns,
          varName: stmt.name, cur: start, stop, step,
        });
        return;
      }
      case 'forin': {
        const iter = this._evalSync(stmt.iter, scope);
        const arr = Array.isArray(iter) ? iter.slice()
          : (iter && typeof iter === 'object' && !(iter instanceof UserFn) ? Object.keys(iter).map((k) => iter[k]) : []);
        const ns = this._newScope(scope);
        if (arr.length) this._scope(ns).set(stmt.name, arr[0]);
        this.frames.push({
          kind: 'forin', stmts: stmt.body, ip: 0, scopeId: ns,
          varName: stmt.name, arr, i: 0,
        });
        return;
      }
      case 'fn': {
        scope.set(stmt.name, new UserFn(stmt, fr.scopeId));
        return;
      }
      case 'return': {
        const v = stmt.value ? this._evalSync(stmt.value, scope) : null;
        // 弹出到调用帧
        while (this.frames.length) {
          const top = this.frames.pop();
          if (top.kind === 'fn') {
            if (top.retName) {
              this._scope(top.retScope).set(top.retName, v);
            }
            return;
          }
        }
        this.retVal = v;
        this.done = true;
        return;
      }
      case 'break': {
        while (this.frames.length) {
          const top = this.frames.pop();
          if (top.kind === 'while' || top.kind === 'for' || top.kind === 'forin') return;
        }
        return;
      }
      case 'continue': {
        while (this.frames.length) {
          const top = this.frames[this.frames.length - 1];
          if (top.kind === 'while') { top.ip = top.stmts.length; return; }
          if (top.kind === 'for' || top.kind === 'forin') { top.ip = top.stmts.length; return; }
          this.frames.pop();
        }
        return;
      }
      default:
        throw makeErr('未知语句: ' + stmt.type, stmt.line);
    }
  }

  // ---- 表达式求值(同步;用户函数调用在此展开为新帧并执行到完成) ----
  _evalSync(node, scope) {
    this.work += 1;
    switch (node.type) {
      case 'num': return node.v;
      case 'str': return node.v;
      case 'bool': return node.v;
      case 'null': return null;
      case 'name': {
        const s = this._lookup(node.name);
        if (s && s.has(node.name)) return s.get(node.name);
        if (this.natives[node.name] !== undefined) return this.natives[node.name];
        throw makeErr('未定义变量: ' + node.name, node.line);
      }
      case 'array': return node.items.map((it) => this._evalSync(it, scope));
      case 'object': {
        const o = {};
        for (const [k, v] of node.props) o[k] = this._evalSync(v, scope);
        return o;
      }
      case 'bin': {
        const l = this._evalSync(node.l, scope);
        const r = this._evalSync(node.r, scope);
        return binOp(node.op, l, r, node.line);
      }
      case 'logic': {
        const l = truthy(this._evalSync(node.l, scope));
        if (node.op === '&&') return l ? truthy(this._evalSync(node.r, scope)) : false;
        return l ? true : truthy(this._evalSync(node.r, scope));
      }
      case 'un': {
        const v = this._evalSync(node.e, scope);
        return node.op === '-' ? -Number(v) : !truthy(v);
      }
      case 'index': {
        const obj = this._evalSync(node.obj, scope);
        const idx = this._evalSync(node.idx, scope);
        return indexGet(obj, idx);
      }
      case 'member': {
        const obj = this._evalSync(node.obj, scope);
        return memberGet(obj, node.name);
      }
      case 'call': {
        let fn, bind = null;
        if (node.callee.type === 'member') {
          bind = this._evalSync(node.callee.obj, scope);
          fn = memberGet(bind, node.callee.name);
        } else {
          fn = this._evalSync(node.callee, scope);
        }
        const args = node.args.map((a) => this._evalSync(a, scope));
        return this._invokeSync(fn, args, bind, node.line);
      }
      default: throw makeErr('未知表达式: ' + node.type, node.line);
    }
  }

  _invokeSync(fn, args, bind, line) {
    if (fn == null) throw makeErr('调用目标为空', line);
    if (fn instanceof UserFn) {
      // 用户函数:执行到完成(同步),限制:内部不得出现挂起型系统调用(会抛错)
      const ns = this._newScope(this._scope(fn.closureId));
      const s = this._scope(ns);
      fn.def.params.forEach((p, i) => s.set(p, args[i] ?? null));
      this.work += 8;
      const r = this._callFunctionBody(fn.def, ns);
      return r;
    }
    if (typeof fn === 'function') {
      this.work += 3;
      const r = fn.apply(bind, args);
      return r;
    }
    throw makeErr('不可调用的值', line);
  }

  // 同步执行函数体(嵌套栈),返回 return 值
  _callFunctionBody(def, scopeId) {
    const savedFrames = this.frames;
    this.frames = [];
    const fr = { kind: 'fn', stmts: def.body, ip: 0, scopeId, retName: null };
    this.frames.push(fr);
    let result = null;
    try {
      // 使用独立的迷你循环(受 work 计数)
      let guard = 0;
      while (this.frames.length && guard++ < 5000000) {
        const f = this.frames[this.frames.length - 1];
        const sc = this._scope(f.scopeId);
        if (f.kind === 'fn' && f.ip >= f.stmts.length) {
          this.frames.pop();
          break;
        }
        if (f.kind === 'while' && f.ip >= f.stmts.length) {
          this.work += 1;
          if (truthy(this._evalSync(f.cond, sc))) f.ip = 0;
          else this.frames.pop();
          continue;
        }
        if (f.kind === 'for' && f.ip >= f.stmts.length) {
          this.work += 1;
          f.cur += f.step;
          if (f.step > 0 ? f.cur <= f.stop : f.cur >= f.stop) {
            sc.set(f.varName, f.cur);
            f.ip = 0;
          } else this.frames.pop();
          continue;
        }
        if (f.kind === 'forin' && f.ip >= f.stmts.length) {
          this.work += 1;
          f.i++;
          if (f.i < f.arr.length) {
            sc.set(f.varName, f.arr[f.i]);
            f.ip = 0;
          } else this.frames.pop();
          continue;
        }
        if (f.kind === 'block' && f.ip >= f.stmts.length) {
          this.frames.pop();
          continue;
        }
        const stmt = f.stmts[f.ip++];
        this.work += 1;
        if (stmt.type === 'return') {
          result = stmt.value ? this._evalSync(stmt.value, sc) : null;
          this.frames = savedFrames;
          return result;
        }
        this._exec(stmt, sc, f);
      }
    } catch (e) {
      this.frames = savedFrames;
      throw e;
    }
    this.frames = savedFrames;
    return result;
  }

  _assignSync(target, value, op, scope) {
    if (op !== '=') {
      const cur = this._evalSync(target, scope);
      value = binOp(op[0], cur, value, target.line);
    }
    if (target.type === 'name') {
      const s = this._lookup(target.name);
      if (s) s.set(target.name, value);
      else this._scope(this.rootScopeId).set(target.name, value);
      return;
    }
    if (target.type === 'index') {
      const obj = this._evalSync(target.obj, scope);
      const idx = this._evalSync(target.idx, scope);
      if (Array.isArray(obj)) obj[idx | 0] = value;
      else if (obj && typeof obj === 'object') obj[String(idx)] = value;
      else throw makeErr('无法赋值给非容器', target.line);
      return;
    }
    if (target.type === 'member') {
      const obj = this._evalSync(target.obj, scope);
      if (obj && typeof obj === 'object') obj[target.name] = value;
      else throw makeErr('无法赋值给非对象', target.line);
      return;
    }
    throw makeErr('无效的赋值目标', target.line);
  }

  // ---- 陷阱接口 ----
  // 原生函数调用 raiseTrap(name,args) 抛出陷阱;恢复时重放语句并注入结果。
  raiseTrap(name, args) {
    if (this.injected && this.injected.length) {
      const inj = this.injected.shift();
      return inj;
    }
    const e = { __trap: true, name, args, result: undefined };
    throw e;
  }

  resolve(value) {
    // 仅注入陷阱结果,不执行;下次 run() 时消费
    this.injected = this.injected || [];
    this.injected.push(value);
    if (this.suspended) {
      this.suspended = false;
      this.trap = null;
      if (this.frames.length) {
        const fr = this.frames[this.frames.length - 1];
        if (fr.ip > 0) fr.ip -= 1;
      }
    }
    return true;
  }

  // ---- 快照 ----
  callFunction(name, args) {
    const root = this._scope(this.rootScopeId);
    const fn = root.get(name);
    if (!(fn instanceof UserFn)) return null;
    const ns = this._newScope(this._scope(fn.closureId));
    const s = this._scope(ns);
    fn.def.params.forEach((p, i) => s.set(p, args[i] ?? null));
    return this._callFunctionBody(fn.def, ns);
  }

  snapshotState() {
    const scopes = {};
    for (const [id, m] of this.scopes) {
      const o = {};
      for (const [k, v] of m) {
        if (v instanceof UserFn) o[k] = { __fn: v.def.name, closureId: v.closureId };
        else o[k] = clonePlain(v);
      }
      scopes[id] = o;
    }
    return {
      name: this.name,
      source: this.source,
      scopes,
      rootScopeId: this.rootScopeId,
      frames: this.frames.map((f) => ({
        kind: f.kind, ip: f.ip, scopeId: f.scopeId,
        stmtIndex: f.__stmtIndex, fnName: f.fnName,
        varName: f.varName, cur: f.cur, stop: f.stop, step: f.step,
        i: f.i, arrLen: f.arr ? f.arr.length : 0,
        condSaved: f.cond ? true : false,
      })),
      done: this.done,
      retVal: clonePlain(this.retVal),
      trap: this.trap ? { name: this.trap.name, args: clonePlain(this.trap.args) } : null,
      suspended: this.suspended,
    };
  }

  restoreState(st) {
    this.scopes = new Map();
    for (const [id, o] of Object.entries(st.scopes || {})) {
      const m = new Map();
      for (const [k, v] of Object.entries(o)) {
        if (v && v.__fn) {
          const def = this._findFn(v.__fn);
          if (def) m.set(k, new UserFn(def, v.closureId));
        } else m.set(k, v);
      }
      this.scopes.set(id, m);
    }
    this.rootScopeId = st.rootScopeId;
    this.frames = (st.frames || []).map((f) => ({
      ...f,
      stmts: this._stmtsFor(f),
      cond: f.condSaved ? this._condFor(f) : undefined,
      arr: f.arrLen ? new Array(f.arrLen).fill(null) : undefined,
    }));
    this.done = st.done;
    this.retVal = st.retVal;
    this.suspended = st.suspended;
    this.trap = st.trap ? { ...st.trap, result: undefined } : null;
    if (st.trap) {
      this.trap.result = st.trap.result !== undefined ? st.trap.result : undefined;
    }
  }

  _findFn(name) {
    // 在 AST 中查找函数定义
    let found = null;
    const walk = (stmts) => {
      for (const s of stmts || []) {
        if (s.type === 'fn' && s.name === name) { found = s; return; }
        if (s.body) walk(s.body);
        if (s.alt) walk(s.alt);
      }
    };
    walk(this.ast.body);
    return found;
  }
  _stmtsFor(f) {
    if (f.kind === 'main') return this.ast.body;
    return this.ast.body; // 简化:快照恢复时由上层同步调整
  }
  _condFor() { return null; }
}

function clonePlain(v) {
  if (v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(clonePlain);
  const o = {};
  for (const k of Object.keys(v)) o[k] = clonePlain(v[k]);
  return o;
}

// 陷阱请求标记(原生函数返回它表示需要挂起)
export function trapReq(name, args) {
  return { __trapReq: true, name, args };
}

export function defaultNatives() {
  return {
    len: (x) => (x == null ? 0 : (typeof x === 'string' || Array.isArray(x) ? x.length : Object.keys(x).length)),
    str: (x) => {
      if (x == null) return 'null';
      if (typeof x === 'object') {
        try { return JSON.stringify(x); } catch (e) { return String(x); }
      }
      return String(x);
    },
    num: (x) => {
      const n = Number(x);
      return isNaN(n) ? 0 : n;
    },
    abs: (x) => Math.abs(Number(x)),
    min: (a, b) => Math.min(Number(a), Number(b)),
    max: (a, b) => Math.max(Number(a), Number(b)),
    floor: (x) => Math.floor(Number(x)),
    ceil: (x) => Math.ceil(Number(x)),
    round: (x) => Math.round(Number(x)),
    sqrt: (x) => Math.sqrt(Number(x)),
    sin: (x) => Math.sin(Number(x)),
    cos: (x) => Math.cos(Number(x)),
    atan2: (y, x) => Math.atan2(Number(y), Number(x)),
    pow: (a, b) => Math.pow(Number(a), Number(b)),
    keys: (o) => (o && typeof o === 'object' ? Object.keys(o) : []),
    push: (arr, v) => { if (Array.isArray(arr)) { arr.push(v); return arr.length; } return 0; },
    has: (o, k) => (o && typeof o === 'object' ? (k in o || (Array.isArray(o) && (k | 0) < o.length)) : false),
    type: (x) => {
      if (x == null) return 'null';
      if (Array.isArray(x)) return 'array';
      return typeof x;
    },
    json: (x) => JSON.stringify(x),
  };
}
