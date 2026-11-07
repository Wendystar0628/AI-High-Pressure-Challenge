/* ============================================================
 * NestLang / 巢语 —— 项目自有的程序格式
 * 词法 → 语法树 → 字节码 → 可暂停、可快照的虚拟机。
 * 每条指令 = 1 个逻辑工作单位（fuel），由所属系统的调度器拨付。
 * ============================================================ */

export class NestError extends Error {
  constructor(msg, line = 0) { super(msg); this.name = 'NestError'; this.line = line; }
}

const KEYWORDS = new Set(['let', 'var', 'fn', 'if', 'else', 'while', 'for', 'return', 'break', 'continue', 'true', 'false', 'null']);
const OPS2 = ['==', '!=', '<=', '>=', '&&', '||'];

function lex(src) {
  const tokens = [];
  let i = 0, line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '#' || (c === '/' && src[i + 1] === '/')) { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '"' || c === "'") {
      const q = c; i++; let s = '';
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') {
          const e = src[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e === '\\' ? '\\' : e === '"' ? '"' : e === "'" ? "'" : e;
          i += 2;
        } else { if (src[i] === '\n') line++; s += src[i++]; }
      }
      if (src[i] !== q) throw new NestError('字符串未闭合', line);
      i++; tokens.push({ t: 'str', v: s, line }); continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i; while (j < n && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if (raw.split('.').length > 2) throw new NestError(`数字格式错误 “${raw}”`, line);
      tokens.push({ t: 'num', v: Number(raw), line }); i = j; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const w = src.slice(i, j);
      tokens.push({ t: KEYWORDS.has(w) ? 'kw' : 'id', v: w, line }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (OPS2.includes(two)) { tokens.push({ t: 'op', v: two, line }); i += 2; continue; }
    if ('+-*/%(){}[],.;:=<>!'.includes(c)) { tokens.push({ t: 'op', v: c, line }); i++; continue; }
    throw new NestError(`无法识别的字符 “${c}”`, line);
  }
  tokens.push({ t: 'eof', v: null, line });
  return tokens;
}

class Parser {
  constructor(src) { this.tokens = lex(src); this.pos = 0; }
  peek(off = 0) { return this.tokens[this.pos + off]; }
  next() { return this.tokens[this.pos++]; }
  is(v, off = 0) { const t = this.peek(off); return !!t && t.v === v; }
  eat(v) { if (this.is(v)) return this.next(); throw new NestError(`期望 “${v}”，实际得到 “${this.peek().v ?? '文件结尾'}”`, this.peek().line); }
  optional(v) { if (this.is(v)) return this.next(); return null; }
  eatId() { const t = this.next(); if (!t || t.t !== 'id') throw new NestError(`期望标识符，实际得到 “${t ? (t.v ?? '文件结尾') : '结尾'}”`, t ? t.line : 0); return t.v; }

  program() {
    const globals = [], funcs = [];
    while (this.peek().t !== 'eof') {
      if (this.is('fn')) funcs.push(this.funcDecl());
      else globals.push(this.statement());
    }
    return { globals, funcs };
  }
  funcDecl() {
    const line = this.peek().line;
    this.eat('fn'); const name = this.eatId(); this.eat('(');
    const params = [];
    if (!this.is(')')) { do { params.push(this.eatId()); } while (this.optional(',')); }
    this.eat(')');
    return { name, params, body: this.block(), line };
  }
  block() {
    this.eat('{'); const body = [];
    while (!this.is('}')) {
      if (this.peek().t === 'eof') throw new NestError('代码块未闭合', this.peek().line);
      body.push(this.statement());
    }
    this.eat('}');
    return { type: 'Block', body };
  }
  statement() {
    const t = this.peek();
    if (t.t === 'kw') {
      switch (t.v) {
        case 'let': case 'var': {
          this.next(); const name = this.eatId(); let init = null;
          if (this.optional('=')) init = this.expr();
          this.optional(';');
          return { type: 'Let', name, init, line: t.line };
        }
        case 'if': {
          this.next(); this.eat('('); const cond = this.expr(); this.eat(')');
          const then = this.statement(); let alt = null;
          if (this.is('else')) { this.next(); alt = this.statement(); }
          return { type: 'If', cond, then, alt, line: t.line };
        }
        case 'while': {
          this.next(); this.eat('('); const cond = this.expr(); this.eat(')');
          return { type: 'While', cond, body: this.statement(), line: t.line };
        }
        case 'for': {
          this.next(); this.eat('(');
          let init = null;
          if (!this.is(';')) {
            if (this.is('let') || this.is('var')) {
              this.next(); const name = this.eatId(); let val = null;
              if (this.optional('=')) val = this.expr();
              init = { type: 'Let', name, init: val, line: t.line };
            } else init = { type: 'Expr', expr: this.expr(), line: t.line };
          }
          this.eat(';');
          const cond = this.is(';') ? { type: 'Lit', value: true, line: t.line } : this.expr();
          this.eat(';');
          const step = this.is(')') ? null : this.expr();
          this.eat(')');
          return { type: 'For', init, cond, step, body: this.statement(), line: t.line };
        }
        case 'return': {
          this.next(); let value = null;
          if (!this.is(';') && !this.is('}') && this.peek().t !== 'eof') value = this.expr();
          this.optional(';');
          return { type: 'Return', value, line: t.line };
        }
        case 'break': this.next(); this.optional(';'); return { type: 'Break', line: t.line };
        case 'continue': this.next(); this.optional(';'); return { type: 'Continue', line: t.line };
      }
    }
    if (this.is('{')) return this.block();
    const expr = this.expr(); this.optional(';');
    return { type: 'Expr', expr, line: t.line };
  }

  expr() { return this.assignment(); }
  assignment() {
    const target = this.or();
    if (this.is('=')) {
      this.next();
      const value = this.assignment();
      return { type: 'AssignExpr', target, value, line: this.peek().line };
    }
    return target;
  }
  or() { let l = this.and(); while (this.is('||')) { this.next(); l = { type: 'Bin', op: '||', a: l, b: this.and(), line: this.peek().line }; } return l; }
  and() { let l = this.eq(); while (this.is('&&')) { this.next(); l = { type: 'Bin', op: '&&', a: l, b: this.eq(), line: this.peek().line }; } return l; }
  eq() { let l = this.rel(); while (this.is('==') || this.is('!=')) { const op = this.next().v; l = { type: 'Bin', op, a: l, b: this.rel(), line: this.peek().line }; } return l; }
  rel() { let l = this.add(); while (this.is('<') || this.is('>') || this.is('<=') || this.is('>=')) { const op = this.next().v; l = { type: 'Bin', op, a: l, b: this.add(), line: this.peek().line }; } return l; }
  add() { let l = this.mul(); while (this.is('+') || this.is('-')) { const op = this.next().v; l = { type: 'Bin', op, a: l, b: this.mul(), line: this.peek().line }; } return l; }
  mul() { let l = this.unary(); while (this.is('*') || this.is('/') || this.is('%')) { const op = this.next().v; l = { type: 'Bin', op, a: l, b: this.unary(), line: this.peek().line }; } return l; }
  unary() {
    if (this.is('!') || this.is('-')) { const op = this.next().v; return { type: 'Un', op, a: this.unary(), line: this.peek().line }; }
    return this.postfix();
  }
  postfix() {
    let e = this.primary();
    for (;;) {
      if (this.is('(')) {
        this.next(); const args = [];
        if (!this.is(')')) { do { args.push(this.expr()); } while (this.optional(',')); }
        this.eat(')');
        e = { type: 'Call', callee: e, args, line: this.peek().line };
      } else if (this.is('[')) {
        this.next(); const index = this.expr(); this.eat(']');
        e = { type: 'Index', obj: e, index, line: this.peek().line };
      } else if (this.is('.')) {
        this.next(); e = { type: 'Member', obj: e, prop: this.eatId(), line: this.peek().line };
      } else break;
    }
    return e;
  }
  primary() {
    const t = this.peek();
    if (t.t === 'num' || t.t === 'str') { this.next(); return { type: 'Lit', value: t.v, line: t.line }; }
    if (t.t === 'kw') {
      if (t.v === 'true') { this.next(); return { type: 'Lit', value: true, line: t.line }; }
      if (t.v === 'false') { this.next(); return { type: 'Lit', value: false, line: t.line }; }
      if (t.v === 'null') { this.next(); return { type: 'Lit', value: null, line: t.line }; }
    }
    if (t.t === 'id') { this.next(); return { type: 'Var', name: t.v, line: t.line }; }
    if (this.is('(')) { this.next(); const e = this.expr(); this.eat(')'); return e; }
    if (this.is('[')) {
      this.next(); const items = [];
      if (!this.is(']')) { do { items.push(this.expr()); } while (this.optional(',')); }
      this.eat(']'); return { type: 'Array', items, line: t.line };
    }
    if (this.is('{')) {
      this.next(); const entries = [];
      if (!this.is('}')) {
        do {
          const keyTok = this.next();
          if (!keyTok || !['id', 'str', 'num'].includes(keyTok.t)) throw new NestError('对象键名无效', keyTok ? keyTok.line : 0);
          this.eat(':');
          entries.push([String(keyTok.v), this.expr()]);
        } while (this.optional(','));
      }
      this.eat('}'); return { type: 'Object', entries, line: t.line };
    }
    throw new NestError(`无法解析的表达式 “${t.v ?? '文件结尾'}”`, t.line);
  }
}

/* ---------------- 字节码编译器 ---------------- */
class Compiler {
  constructor(ast) {
    this.ast = ast; this.code = []; this.consts = []; this.funcs = {};
    this.loopStack = []; this.inFunction = false;
  }
  constIdx(v) {
    for (let i = 0; i < this.consts.length; i++) if (this.consts[i] === v) return i;
    this.consts.push(v); return this.consts.length - 1;
  }
  emit(op, a = null, line = 0) { this.code.push({ op, a, line }); return this.code.length - 1; }
  patch(idx, target) { this.code[idx].a = target; }
  compile() {
    for (const st of this.ast.globals) this.stmt(st);
    this.emit('HALT');
    for (const f of this.ast.funcs) {
      this.funcs[f.name] = { params: f.params, entry: this.code.length, line: f.line };
      this.inFunction = true;
      this.stmt(f.body);
      this.emit('PUSH', this.constIdx(null));
      this.emit('RET');
      this.inFunction = false;
    }
    return { code: this.code, consts: this.consts, funcs: this.funcs };
  }
  stmt(s) {
    switch (s.type) {
      case 'Block': for (const x of s.body) this.stmt(x); break;
      case 'Let':
        if (s.init) this.expr(s.init); else this.emit('PUSH', this.constIdx(null));
        this.emit(this.inFunction ? 'STORE_LOCAL' : 'STORE_NAME', this.constIdx(s.name), s.line);
        this.emit('POP'); break;
      case 'Expr': this.expr(s.expr); this.emit('POP'); break;
      case 'If': {
        this.expr(s.cond);
        const jz = this.emit('JZ', null, s.line);
        this.stmt(s.then);
        if (s.alt) {
          const jmp = this.emit('JMP', null, s.line);
          this.patch(jz, this.code.length);
          this.stmt(s.alt);
          this.patch(jmp, this.code.length);
        } else this.patch(jz, this.code.length);
        break;
      }
      case 'While': {
        const start = this.code.length;
        this.expr(s.cond);
        const jz = this.emit('JZ', null, s.line);
        this.loopStack.push({ breaks: [], continues: [] });
        this.stmt(s.body);
        this.emit('JMP', start, s.line);
        const end = this.code.length; this.patch(jz, end);
        const loop = this.loopStack.pop();
        loop.breaks.forEach(b => this.patch(b, end));
        loop.continues.forEach(c => this.patch(c, start));
        break;
      }
      case 'For': {
        if (s.init) this.stmt(s.init);
        const start = this.code.length;
        this.expr(s.cond);
        const jz = this.emit('JZ', null, s.line);
        this.loopStack.push({ breaks: [], continues: [] });
        this.stmt(s.body);
        const stepStart = this.code.length;
        if (s.step) { this.expr(s.step); this.emit('POP'); }
        this.emit('JMP', start, s.line);
        const end = this.code.length; this.patch(jz, end);
        const loop = this.loopStack.pop();
        loop.breaks.forEach(b => this.patch(b, end));
        loop.continues.forEach(c => this.patch(c, stepStart));
        break;
      }
      case 'Break':
        if (!this.loopStack.length) throw new NestError('break 不在循环中', s.line);
        this.loopStack[this.loopStack.length - 1].breaks.push(this.emit('JMP', null, s.line)); break;
      case 'Continue':
        if (!this.loopStack.length) throw new NestError('continue 不在循环中', s.line);
        this.loopStack[this.loopStack.length - 1].continues.push(this.emit('JMP', null, s.line)); break;
      case 'Return':
        if (!this.inFunction) throw new NestError('return 不在函数中', s.line);
        if (s.value) this.expr(s.value); else this.emit('PUSH', this.constIdx(null));
        this.emit('RET', null, s.line); break;
      default: throw new NestError('未知语句 ' + s.type, s.line || 0);
    }
  }
  expr(e) {
    if (!e) { this.emit('PUSH', this.constIdx(null)); return; }
    switch (e.type) {
      case 'AssignExpr': {
        const t = e.target;
        if (t.type === 'Var') { this.expr(e.value); this.emit('STORE_NAME', this.constIdx(t.name), e.line); return; }
        if (t.type === 'Member') { this.expr(t.obj); this.emit('PUSH', this.constIdx(t.prop)); this.expr(e.value); this.emit('SET_INDEX', null, e.line); return; }
        if (t.type === 'Index') { this.expr(t.obj); this.expr(t.index); this.expr(e.value); this.emit('SET_INDEX', null, e.line); return; }
        throw new NestError('赋值目标无效', e.line || 0);
      }
      case 'Lit': this.emit('PUSH', this.constIdx(e.value), e.line); break;
      case 'Var': this.emit('LOAD_ANY', this.constIdx(e.name), e.line); break;
      case 'Array': for (const it of e.items) this.expr(it); this.emit('ARRAY', e.items.length, e.line); break;
      case 'Object':
        for (const [k, v] of e.entries) { this.emit('PUSH', this.constIdx(k)); this.expr(v); }
        this.emit('OBJECT', e.entries.length, e.line); break;
      case 'Index': this.expr(e.obj); this.expr(e.index); this.emit('GET_INDEX', null, e.line); break;
      case 'Member': this.expr(e.obj); this.emit('PUSH', this.constIdx(e.prop)); this.emit('GET_INDEX', null, e.line); break;
      case 'Un': this.expr(e.a); this.emit(e.op === '!' ? 'NOT' : 'NEG', null, e.line); break;
      case 'Bin':
        if (e.op === '&&' || e.op === '||') {
          // 短路求值：左侧值保留在栈上，为假/真时直接跳到结束
          this.expr(e.a);
          this.emit('DUP');
          const jump = this.emit(e.op === '&&' ? 'JZ' : 'JNZ', null, e.line);
          this.emit('POP');
          this.expr(e.b);
          this.emit('TO_BOOL');
          this.patch(jump, this.code.length);
          break;
        }
        this.expr(e.a); this.expr(e.b); this.emit('BIN', e.op, e.line); break;
      case 'Call': {
        const callee = e.callee.type === 'Var' ? e.callee.name : null;
        if (callee === 'sys') {
          if (!e.args[0] || e.args[0].type !== 'Lit' || typeof e.args[0].value !== 'string') throw new NestError('sys 的第一个参数必须是字符串服务名', e.line);
          for (let i = 1; i < e.args.length; i++) this.expr(e.args[i]);
          this.emit('SYS', { name: e.args[0].value, argc: e.args.length - 1 }, e.line);
        } else if (callee === 'print') {
          for (const a of e.args) this.expr(a);
          this.emit('SYS', { name: '__print', argc: e.args.length }, e.line);
        } else if (callee) {
          for (const a of e.args) this.expr(a);
          this.emit('CALL', { name: callee, argc: e.args.length }, e.line);
        } else throw new NestError('只允许调用具名函数', e.line);
        break;
      }
      default: throw new NestError('未知表达式 ' + e.type, e.line || 0);
    }
  }
}

export function compile(source) {
  try {
    const ast = new Parser(source).program();
    const c = new Compiler(ast).compile();
    return { ok: true, compiled: { ...c, source }, error: null };
  } catch (e) {
    return { ok: false, compiled: null, error: `${e.message}${e.line ? `（第 ${e.line} 行）` : ''}` };
  }
}

/* ---------------- 虚拟机 ---------------- */
const BUILTINS = {
  len: (v) => v == null ? 0 : (typeof v === 'string' || Array.isArray(v)) ? v.length : Object.keys(v).length,
  str: (v) => v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v),
  num: (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; },
  abs: (x) => Math.abs(Number(x)), min: (...a) => Math.min(...a.map(Number)), max: (...a) => Math.max(...a.map(Number)),
  floor: (x) => Math.floor(Number(x)), ceil: (x) => Math.ceil(Number(x)), round: (x) => Math.round(Number(x)), sqrt: (x) => Math.sqrt(Number(x)),
  sin: (x) => Math.sin(Number(x)), cos: (x) => Math.cos(Number(x)), atan2: (a, b) => Math.atan2(Number(a), Number(b)), pow: (a, b) => Math.pow(Number(a), Number(b)), sign: (x) => Math.sign(Number(x)),
  clamp: (v, a, b) => Math.min(Number(b), Math.max(Number(a), Number(v))),
  PI: Math.PI,
};

export class VM {
  constructor(compiled, host = {}) {
    this.compiled = compiled;
    this.source = compiled ? compiled.source : '';
    this.code = compiled ? compiled.code : [];
    this.consts = compiled ? compiled.consts : [];
    this.funcs = compiled ? compiled.funcs : {};
    this.host = host;
    this.ip = 0; this.stack = []; this.frames = []; this.globals = {};
    this.status = 'ready'; this.wait = null; this.pending = null; this.error = null;
    this.instructions = 0; this.outputs = []; this.lastLine = 0; this.wakeAt = null;
  }
  get line() { return (this.code[this.ip] && this.code[this.ip].line) || this.lastLine; }
  isDone() { return this.status === 'done' || this.status === 'error'; }
  snapshot() {
    return {
      source: this.source, ip: this.ip, stack: this.stack, frames: this.frames,
      globals: this.globals, status: this.status, wait: this.wait, pending: this.pending,
      error: this.error, instructions: this.instructions, outputs: this.outputs,
      lastLine: this.lastLine, wakeAt: this.wakeAt
    };
  }
  static restore(snap, host = {}) {
    const c = compile(snap.source || '');
    if (!c.ok) {
      const vm = new VM(null, host);
      vm.source = snap.source || ''; vm.status = 'error';
      vm.error = '恢复失败：内核源文件无法编译 —— ' + c.error;
      return vm;
    }
    const vm = new VM(c.compiled, host);
    Object.assign(vm, {
      ip: snap.ip || 0, stack: snap.stack || [], frames: snap.frames || [], globals: snap.globals || {},
      status: snap.status || 'ready', wait: snap.wait || null, pending: snap.pending || null,
      error: snap.error || null, instructions: snap.instructions || 0, outputs: snap.outputs || [],
      lastLine: snap.lastLine || 0, wakeAt: snap.wakeAt || null
    });
    return vm;
  }
  provideResult(value) {
    if (this.status !== 'waiting') return;
    this.stack.push(value === undefined ? null : value);
    this.pending = null; this.wait = null; this.wakeAt = null;
    this.status = 'ready';
  }
  fail(msg) {
    this.status = 'error';
    this.error = `${msg}（第 ${this.line} 行）`;
    if (this.host.onError) this.host.onError(this.error);
  }
  step(maxFuel = 4000) {
    if (this.status !== 'ready') return 0;
    let fuel = maxFuel;
    while (fuel > 0 && this.status === 'ready') {
      const ins = this.code[this.ip];
      if (!ins) { this.status = 'done'; break; }
      this.ip++; fuel--; this.instructions++; this.lastLine = ins.line || this.lastLine;
      try {
        switch (ins.op) {
          case 'PUSH': this.stack.push(this.consts[ins.a]); break;
          case 'POP': this.stack.pop(); break;
          case 'DUP': this.stack.push(this.stack[this.stack.length - 1]); break;
          case 'TO_BOOL': this.stack.push(!!this.stack.pop()); break;
          case 'NOT': this.stack.push(!this.stack.pop()); break;
          case 'NEG': this.stack.push(-Number(this.stack.pop())); break;
          case 'BIN': {
            const b = this.stack.pop(), a = this.stack.pop();
            let v;
            switch (ins.a) {
              case '+':
                if (Array.isArray(a) && Array.isArray(b)) v = a.concat(b);
                else if (typeof a === 'string' || typeof b === 'string') v = String(a) + String(b);
                else v = Number(a) + Number(b);
                break;
              case '-': v = Number(a) - Number(b); break;
              case '*': v = Number(a) * Number(b); break;
              case '/': v = Number(b) === 0 ? 0 : Number(a) / Number(b); break;
              case '%': v = Number(b) === 0 ? 0 : Number(a) % Number(b); break;
              case '==': v = a === b; break;
              case '!=': v = a !== b; break;
              case '<': v = a < b; break;
              case '>': v = a > b; break;
              case '<=': v = a <= b; break;
              case '>=': v = a >= b; break;
              default: v = null;
            }
            this.stack.push(v); break;
          }
          case 'JMP': this.ip = ins.a; break;
          case 'JZ': if (!this.stack.pop()) this.ip = ins.a; break;
          case 'JNZ': if (this.stack.pop()) this.ip = ins.a; break;
          case 'ARRAY': { const n = ins.a; this.stack.push(this.stack.splice(this.stack.length - n, n)); break; }
          case 'OBJECT': {
            const items = this.stack.splice(this.stack.length - ins.a * 2, ins.a * 2);
            const obj = {};
            for (let i = 0; i < items.length; i += 2) obj[items[i]] = items[i + 1];
            this.stack.push(obj); break;
          }
          case 'GET_INDEX': { const key = this.stack.pop(); const obj = this.stack.pop(); this.stack.push(obj == null ? null : obj[key]); break; }
          case 'SET_INDEX': {
            const val = this.stack.pop(), key = this.stack.pop(), obj = this.stack.pop();
            if (obj != null) { try { obj[key] = val; } catch (e) { this.fail('写入失败：' + e.message); } }
            this.stack.push(val); break;
          }
          case 'LOAD_ANY': {
            const name = this.consts[ins.a];
            const frame = this.frames[this.frames.length - 1];
            if (frame && Object.prototype.hasOwnProperty.call(frame.locals, name)) this.stack.push(frame.locals[name]);
            else if (Object.prototype.hasOwnProperty.call(this.globals, name)) this.stack.push(this.globals[name]);
            else if (Object.prototype.hasOwnProperty.call(BUILTINS, name)) this.stack.push(BUILTINS[name]);
            else this.stack.push(null);
            break;
          }
          case 'STORE_NAME': {
            const name = this.consts[ins.a];
            const frame = this.frames[this.frames.length - 1];
            if (frame && Object.prototype.hasOwnProperty.call(frame.locals, name)) frame.locals[name] = this.stack[this.stack.length - 1];
            else this.globals[name] = this.stack[this.stack.length - 1];
            break;
          }
          case 'STORE_LOCAL': {
            const name = this.consts[ins.a];
            const frame = this.frames[this.frames.length - 1];
            if (frame) frame.locals[name] = this.stack[this.stack.length - 1];
            else this.globals[name] = this.stack[this.stack.length - 1];
            break;
          }
          case 'CALL': {
            const info = ins.a;
            const fn = this.funcs[info.name];
            const args = info.argc ? this.stack.splice(this.stack.length - info.argc, info.argc) : [];
            if (fn) {
              const locals = {};
              fn.params.forEach((p, i) => { locals[p] = args[i] === undefined ? null : args[i]; });
              this.frames.push({ fn: info.name, ip: this.ip, locals, base: this.stack.length, line: ins.line });
              this.ip = fn.entry;
            } else if (BUILTINS[info.name]) {
              let v = BUILTINS[info.name](...args);
              this.stack.push(v === undefined ? null : v);
            } else { this.fail(`未定义的函数 ${info.name}`); break; }
            break;
          }
          case 'RET': {
            const val = this.stack.pop();
            const frame = this.frames.pop();
            if (frame) { this.stack.length = frame.base; this.ip = frame.ip; this.stack.push(val === undefined ? null : val); }
            else this.status = 'done';
            break;
          }
          case 'SYS': {
            const { name, argc } = ins.a;
            const args = argc ? this.stack.splice(this.stack.length - argc, argc) : [];
            if (name === '__print') {
              const text = args.map(a => a == null ? '' : typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
              this.outputs.push(text);
              if (this.host.onPrint) this.host.onPrint(text);
              this.stack.push(text.length);
              break;
            }
            let res;
            try { res = this.host.syscall ? this.host.syscall(name, args, this) : { error: `服务 ${name} 不可用` }; }
            catch (e) { this.fail(`系统调用 ${name} 失败：${e.message}`); break; }
            if (res && typeof res === 'object' && res.__wait) {
              this.pending = { name, args };
              this.wait = res; this.status = 'waiting';
              if (res.__wait === 'timer') this.wakeAt = res.at;
              break;
            }
            this.stack.push(res === undefined ? null : res);
            break;
          }
          case 'HALT': this.status = 'done'; break;
          default: this.fail('未知指令 ' + ins.op); break;
        }
      } catch (e) { this.fail(e.message || String(e)); }
    }
    return maxFuel - fuel;
  }
}

export function runProgramSync(source, syscall = () => null, maxFuel = 200000) {
  const c = compile(source);
  if (!c.ok) return { ok: false, error: c.error, outputs: [] };
  const vm = new VM(c.compiled, { syscall });
  vm.step(maxFuel);
  return { ok: vm.status !== 'error', error: vm.error, outputs: vm.outputs, vm };
}
