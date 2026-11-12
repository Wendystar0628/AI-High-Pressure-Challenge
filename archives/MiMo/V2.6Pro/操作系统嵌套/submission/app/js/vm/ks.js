/* ks.js — KernelScript: lexer, parser, generator-based resumable interpreter.
   Builtins may return { ksSuspend:true, ... } to suspend the program; the driver
   resolves the suspension and injects the result back via generator.next(value). */

/* ============================ Lexer ============================ */
const KEYWORDS = new Set(['let', 'var', 'fn', 'if', 'else', 'while', 'for', 'return', 'break', 'continue', 'true', 'false', 'null', 'and', 'or', 'not', 'typeof', 'new']);
const PUNCT = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '??', '+=', '-=', '*=', '/=', '%=', '=>', '++', '--',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '?', ':', ',', ';', '.', '(', ')', '{', '}', '[', ']'];

export function lex(src) {
  const tokens = [];
  let i = 0, line = 1, col = 1;
  const push = (type, value) => tokens.push({ type, value, line, col });
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; col = 1; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; col++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') { line++; col = 1; } i++; }
      i += 2; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; i++; col++;
      let s = '';
      while (i < src.length && src[i] !== q) {
        if (src[i] === '\\') {
          const n = src[i + 1];
          s += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n === '0' ? '\0' : n;
          i += 2; col += 2;
        } else { s += src[i]; i++; col++; }
      }
      i++; col++;
      push('string', s); continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let s = '';
      while (i < src.length && /[0-9.]/.test(src[i])) { s += src[i]; i++; col++; }
      push('number', parseFloat(s)); continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let s = '';
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) { s += src[i]; i++; col++; }
      if (KEYWORDS.has(s)) push('keyword', s); else push('ident', s);
      continue;
    }
    let matched = false;
    for (const p of PUNCT) {
      if (src.startsWith(p, i)) { push('punct', p); i += p.length; col += p.length; matched = true; break; }
    }
    if (!matched) throw new Error(`词法错误 ${line}:${col} 非法字符 '${c}'`);
  }
  push('eof', null);
  return tokens;
}

/* ============================ Parser ============================ */
class Parser {
  constructor(tokens) { this.toks = tokens; this.pos = 0; }
  peek(k = 0) { return this.toks[Math.min(this.pos + k, this.toks.length - 1)]; }
  next() { return this.toks[this.pos++]; }
  isPunct(p) { const t = this.peek(); return t.type === 'punct' && t.value === p; }
  isKeyword(k) { const t = this.peek(); return t.type === 'keyword' && t.value === k; }
  expectPunct(p) {
    const t = this.next();
    if (t.type !== 'punct' || t.value !== p) throw new Error(`语法错误 ${t.line}:${t.col} 期望 '${p}'，得到 '${t.value}'`);
    return t;
  }
  expectIdent() {
    const t = this.next();
    if (t.type !== 'ident') throw new Error(`语法错误 ${t.line}:${t.col} 期望标识符，得到 '${t.value}'`);
    return t;
  }
  parseProgram() {
    const body = [];
    while (this.peek().type !== 'eof') body.push(this.parseStatement());
    return { type: 'Program', body };
  }
  parseStatement() {
    const t = this.peek();
    if (t.type === 'keyword') {
      if (t.value === 'let' || t.value === 'var') return this.parseLet();
      if (t.value === 'fn') return this.parseFnDecl();
      if (t.value === 'if') return this.parseIf();
      if (t.value === 'while') return this.parseWhile();
      if (t.value === 'for') return this.parseFor();
      if (t.value === 'return') { this.next(); let arg = null; if (!this.isPunct(';')) arg = this.parseExpr(); if (this.isPunct(';')) this.next(); return { type: 'Return', arg, line: t.line }; }
      if (t.value === 'break') { this.next(); if (this.isPunct(';')) this.next(); return { type: 'Break', line: t.line }; }
      if (t.value === 'continue') { this.next(); if (this.isPunct(';')) this.next(); return { type: 'Continue', line: t.line }; }
    }
    if (this.isPunct('{')) return this.parseBlock();
    const expr = this.parseExpr();
    if (this.isPunct(';')) this.next();
    return { type: 'ExprStatement', expr, line: t.line };
  }
  parseBlock() {
    const t = this.expectPunct('{');
    const body = [];
    while (!this.isPunct('}')) {
      if (this.peek().type === 'eof') throw new Error(`语法错误 ${t.line} 块未闭合`);
      body.push(this.parseStatement());
    }
    this.expectPunct('}');
    return { type: 'Block', body, line: t.line };
  }
  parseLet() {
    const t = this.next();
    const name = this.expectIdent().value;
    let init = null;
    if (this.isPunct('=')) { this.next(); init = this.parseExpr(); }
    if (this.isPunct(';')) this.next();
    return { type: 'Let', name, init, line: t.line };
  }
  parseFnDecl() {
    const t = this.next();
    const name = this.expectIdent().value;
    this.expectPunct('(');
    const params = [];
    while (!this.isPunct(')')) {
      params.push(this.expectIdent().value);
      if (this.isPunct(',')) this.next();
    }
    this.expectPunct(')');
    const body = this.parseBlock();
    return { type: 'FnDecl', name, params, body, line: t.line };
  }
  parseIf() {
    const t = this.next();
    this.expectPunct('(');
    const test = this.parseExpr();
    this.expectPunct(')');
    const cons = this.parseStatement();
    let alt = null;
    if (this.isKeyword('else')) { this.next(); alt = this.parseStatement(); }
    return { type: 'If', test, cons, alt, line: t.line };
  }
  parseWhile() {
    const t = this.next();
    this.expectPunct('(');
    const test = this.parseExpr();
    this.expectPunct(')');
    const body = this.parseStatement();
    return { type: 'While', test, body, line: t.line };
  }
  parseFor() {
    const t = this.next();
    this.expectPunct('(');
    let init = null;
    if (!this.isPunct(';')) init = this.parseStatement(); else this.next();
    if (init && init.type === 'ExprStatement' && this.isPunct(';')) this.next();
    let test = null;
    if (!this.isPunct(';')) test = this.parseExpr();
    this.expectPunct(';');
    let update = null;
    if (!this.isPunct(')')) update = this.parseExpr();
    this.expectPunct(')');
    const body = this.parseStatement();
    return { type: 'For', init, test, update, body, line: t.line };
  }
  parseExpr() { return this.parseAssignment(); }
  parseAssignment() {
    const left = this.parseTernary();
    const t = this.peek();
    if (t.type === 'punct' && ['=', '+=', '-=', '*=', '/=', '%='].includes(t.value)) {
      if (left.type !== 'Ident' && left.type !== 'Member' && left.type !== 'Index')
        throw new Error(`语法错误 ${t.line} 非法赋值目标`);
      this.next();
      const right = this.parseAssignment();
      return { type: 'Assign', op: t.value, target: left, value: right, line: t.line };
    }
    return left;
  }
  parseTernary() {
    const cond = this.parseNullish();
    if (this.isPunct('?')) {
      this.next();
      const cons = this.parseTernary();
      this.expectPunct(':');
      const alt = this.parseTernary();
      return { type: 'Ternary', test: cond, cons, alt };
    }
    return cond;
  }
  parseNullish() {
    let left = this.parseOr();
    while (this.isPunct('??')) { this.next(); left = { type: 'Binary', op: '??', left, right: this.parseOr() }; }
    return left;
  }
  parseOr() {
    let left = this.parseAnd();
    while (this.isPunct('||') || this.isKeyword('or')) { this.next(); left = { type: 'Binary', op: '||', left, right: this.parseAnd() }; }
    return left;
  }
  parseAnd() {
    let left = this.parseEquality();
    while (this.isPunct('&&') || this.isKeyword('and')) { this.next(); left = { type: 'Binary', op: '&&', left, right: this.parseEquality() }; }
    return left;
  }
  parseEquality() {
    let left = this.parseComparison();
    while (this.isPunct('==') || this.isPunct('!=') || this.isPunct('===') || this.isPunct('!==')) {
      const op = this.next().value;
      left = { type: 'Binary', op: op.replace('===', '==').replace('!==', '!='), left, right: this.parseComparison() };
    }
    return left;
  }
  parseComparison() {
    let left = this.parseAdditive();
    while (this.isPunct('<') || this.isPunct('>') || this.isPunct('<=') || this.isPunct('>=')) {
      const op = this.next().value;
      left = { type: 'Binary', op, left, right: this.parseAdditive() };
    }
    return left;
  }
  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.isPunct('+') || this.isPunct('-')) {
      const op = this.next().value;
      left = { type: 'Binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }
  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.isPunct('*') || this.isPunct('/') || this.isPunct('%')) {
      const op = this.next().value;
      left = { type: 'Binary', op, left, right: this.parseUnary() };
    }
    return left;
  }
  parseUnary() {
    if (this.isPunct('!') || this.isPunct('-') || this.isKeyword('not')) {
      const op = this.next().value;
      return { type: 'Unary', op: op === 'not' ? '!' : op, arg: this.parseUnary() };
    }
    return this.parsePostfix();
  }
  parsePostfix() {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.isPunct('(')) {
        this.next();
        const args = [];
        while (!this.isPunct(')')) { args.push(this.parseExpr()); if (this.isPunct(',')) this.next(); }
        this.expectPunct(')');
        expr = { type: 'Call', callee: expr, args };
      } else if (this.isPunct('[')) {
        this.next();
        const idx = this.parseExpr();
        this.expectPunct(']');
        expr = { type: 'Index', obj: expr, index: idx };
      } else if (this.isPunct('.')) {
        this.next();
        const name = this.expectIdent().value;
        expr = { type: 'Member', obj: expr, name };
      } else if (this.isPunct('++') || this.isPunct('--')) {
        const op = this.next().value;
        expr = { type: 'Postfix', op, arg: expr };
      } else break;
    }
    return expr;
  }
  parsePrimary() {
    const t = this.peek();
    if (t.type === 'number') { this.next(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'string') { this.next(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'keyword') {
      if (t.value === 'true') { this.next(); return { type: 'Literal', value: true }; }
      if (t.value === 'false') { this.next(); return { type: 'Literal', value: false }; }
      if (t.value === 'null') { this.next(); return { type: 'Literal', value: null }; }
      if (t.value === 'fn') return this.parseFnExpr();
      if (t.value === 'typeof') { this.next(); return { type: 'Unary', op: 'typeof', arg: this.parseUnary() }; }
      if (t.value === 'new') { this.next(); return { type: 'New', callee: this.parsePostfix() }; }
    }
    if (t.type === 'ident') { this.next(); return { type: 'Ident', name: t.value }; }
    if (this.isPunct('(')) { this.next(); const e = this.parseExpr(); this.expectPunct(')'); return e; }
    if (this.isPunct('[')) {
      this.next();
      const items = [];
      while (!this.isPunct(']')) { items.push(this.parseExpr()); if (this.isPunct(',')) this.next(); }
      this.expectPunct(']');
      return { type: 'Array', items };
    }
    if (this.isPunct('{')) {
      this.next();
      const props = [];
      while (!this.isPunct('}')) {
        const k = this.next();
        if (k.type !== 'ident' && k.type !== 'string' && k.type !== 'number') throw new Error(`语法错误 ${k.line} 期望属性名`);
        this.expectPunct(':');
        props.push({ key: String(k.value), value: this.parseExpr() });
        if (this.isPunct(',')) this.next();
      }
      this.expectPunct('}');
      return { type: 'Object', props };
    }
    throw new Error(`语法错误 ${t.line}:${t.col} 意外的 '${t.value}'`);
  }
  parseFnExpr() {
    const t = this.next();
    let name = null;
    if (this.peek().type === 'ident') name = this.next().value;
    this.expectPunct('(');
    const params = [];
    while (!this.isPunct(')')) { params.push(this.expectIdent().value); if (this.isPunct(',')) this.next(); }
    this.expectPunct(')');
    const body = this.parseBlock();
    return { type: 'FnExpr', name, params, body, line: t.line };
  }
}

export function parse(src) {
  return new Parser(lex(src)).parseProgram();
}

/* ============================ Interpreter ============================ */

class ReturnSignal { constructor(value) { this.value = value; } }

export class Interp {
  constructor(builtins = {}) {
    this.builtins = builtins;
    this.globals = Object.create(null);
    this.gen = null;
    this.instr = 0;
    this.done = false;
    this.error = null;
  }

  /* start execution of a program AST */
  start(ast) {
    this.gen = this.execBlock(ast.body, this.globals);
    this.instr = 0;
    this.done = false;
    this.error = null;
  }

  /* drive up to maxSteps generator turns. injectValue is sent to a pending yield. */
  run(maxSteps = 100000, injectValue = undefined) {
    if (!this.gen) return { status: 'idle' };
    let steps = 0;
    let nextVal = injectValue;
    let hasInject = arguments.length > 1 && injectValue !== undefined;
    while (steps < maxSteps) {
      let r;
      try {
        r = hasInject ? this.gen.next(nextVal) : this.gen.next();
        hasInject = false;
        nextVal = undefined;
      } catch (e) {
        if (e instanceof ReturnSignal) {
          this.done = true;
          return { status: 'done', value: e.value, instr: this.instr };
        }
        this.done = true;
        this.error = e.message || String(e);
        return { status: 'error', error: this.error, instr: this.instr };
      }
      this.instr++;
      steps++;
      if (r.done) {
        this.done = true;
        return { status: 'done', value: r.value, instr: this.instr };
      }
      const y = r.value;
      if (y && y.ksSuspend) {
        return {
          status: 'suspend',
          suspend: y,
          instr: this.instr
        };
      }
    }
    return { status: 'budget', instr: this.instr };
  }

  /* ---------- execution (generators) ---------- */

  *execBlock(stmts, scope) {
    for (const s of stmts) yield* this.exec(s, scope);
  }

  *exec(node, scope) {
    this.instr++;
    switch (node.type) {
      case 'Let':
        scope[node.name] = node.init ? yield* this.eval(node.init, scope) : null;
        return;
      case 'FnDecl':
        scope[node.name] = this.makeFn(node.params, node.body, scope, node.name);
        return;
      case 'ExprStatement':
        yield* this.eval(node.expr, scope);
        return;
      case 'Assign':
        yield* this.evalAssign(node, scope);
        return;
      case 'Block':
        yield* this.execBlock(node.body, Object.create(scope));
        return;
      case 'If': {
        const t = yield* this.eval(node.test, scope);
        if (truthy(t)) yield* this.exec(node.cons, scope);
        else if (node.alt) yield* this.exec(node.alt, scope);
        return;
      }
      case 'While': {
        while (truthy(yield* this.eval(node.test, scope))) {
          this.instr++;
          try { yield* this.exec(node.body, scope); }
          catch (e) {
            if (e && e.ksBreak) break;
            if (e && e.ksContinue) continue;
            throw e;
          }
          yield null; // yield point per iteration for scheduling
        }
        return;
      }
      case 'For': {
        const s = Object.create(scope);
        if (node.init) {
          if (node.init.type === 'Let') s[node.init.name] = node.init.init ? yield* this.eval(node.init.init, s) : null;
          else if (node.init.type === 'ExprStatement') yield* this.eval(node.init.expr, s);
          else if (node.init.type === 'Assign') yield* this.evalAssign(node.init, s);
        }
        while (node.test === null || truthy(yield* this.eval(node.test, s))) {
          this.instr++;
          try { yield* this.exec(node.body, s); }
          catch (e) {
            if (e && e.ksBreak) break;
            if (!(e && e.ksContinue)) throw e;
          }
          if (node.update) yield* this.eval(node.update, s);
          yield null;
        }
        return;
      }
      case 'Return':
        throw new ReturnSignal(node.arg ? yield* this.eval(node.arg, scope) : null);
      case 'Break':
        throw { ksBreak: true };
      case 'Continue':
        throw { ksContinue: true };
      default:
        throw new Error('未知语句: ' + node.type);
    }
  }

  *evalAssign(node, scope) {
    let val = yield* this.eval(node.value, scope);
    if (node.op !== '=') {
      const cur = yield* this.eval(node.target, scope);
      const o = node.op[0];
      if (o === '+') val = (typeof cur === 'string' || typeof val === 'string') ? String(cur) + String(val) : num(cur) + num(val);
      else if (o === '-') val = num(cur) - num(val);
      else if (o === '*') val = num(cur) * num(val);
      else if (o === '/') { if (num(val) === 0) throw new Error('除零错误'); val = num(cur) / num(val); }
      else if (o === '%') { if (num(val) === 0) throw new Error('除零错误'); val = num(cur) % num(val); }
    }
    yield* this.assignTo(node.target, val, scope);
    return val;
  }

  *assignTo(target, value, scope) {
    if (target.type === 'Ident') {
      scope[target.name] = value;
      return;
    }
    if (target.type === 'Member') {
      const obj = yield* this.eval(target.obj, scope);
      if (obj === null || obj === undefined) throw new Error('空引用: 赋值');
      obj[target.name] = value;
      return;
    }
    if (target.type === 'Index') {
      const obj = yield* this.eval(target.obj, scope);
      const idx = yield* this.eval(target.index, scope);
      if (obj === null || obj === undefined) throw new Error('空引用: 索引赋值');
      obj[idx] = value;
      return;
    }
    throw new Error('非法赋值目标');
  }

  *eval(node, scope) {
    this.instr++;
    switch (node.type) {
      case 'Literal': return node.value;
      case 'Ident': {
        if (node.name in scope) return scope[node.name];
        if (node.name in this.builtins) return this.builtins[node.name];
        if (node.name in this.globals) return this.globals[node.name];
        throw new Error(`未定义变量 '${node.name}'`);
      }
      case 'Array': {
        const a = [];
        for (const x of node.items) a.push(yield* this.eval(x, scope));
        return a;
      }
      case 'Object': {
        const o = {};
        for (const p of node.props) o[p.key] = yield* this.eval(p.value, scope);
        return o;
      }
      case 'FnExpr': return this.makeFn(node.params, node.body, scope, node.name);
      case 'Member': {
        const obj = yield* this.eval(node.obj, scope);
        if (obj === null || obj === undefined) throw new Error(`空引用: 读取 '${node.name}'`);
        return obj[node.name];
      }
      case 'Index': {
        const obj = yield* this.eval(node.obj, scope);
        const idx = yield* this.eval(node.index, scope);
        if (obj === null || obj === undefined) throw new Error('空引用: 索引读取');
        return obj[idx];
      }
      case 'Call': {
        const callee = yield* this.eval(node.callee, scope);
        const args = [];
        for (const a of node.args) args.push(yield* this.eval(a, scope));
        if (typeof callee !== 'function' && !(callee && callee.ksFn)) throw new Error('不是可调用对象');
        this.instr++;
        return yield* this.callFn(callee, args);
      }
      case 'New': {
        const callee = yield* this.eval(node.callee, scope);
        if (typeof callee !== 'function') throw new Error('new 目标不是函数');
        return new callee();
      }
      case 'Unary': {
        const v = yield* this.eval(node.arg, scope);
        if (node.op === '!') return !truthy(v);
        if (node.op === '-') return -num(v);
        if (node.op === 'typeof') return typeof v;
        throw new Error('未知一元运算 ' + node.op);
      }
      case 'Postfix': {
        const cur = yield* this.eval(node.arg, scope);
        const nv = node.op === '++' ? num(cur) + 1 : num(cur) - 1;
        yield* this.assignTo(node.arg, nv, scope);
        return cur;
      }
      case 'Binary': {
        const op = node.op;
        if (op === '&&') { const l = yield* this.eval(node.left, scope); return truthy(l) ? yield* this.eval(node.right, scope) : l; }
        if (op === '||') { const l = yield* this.eval(node.left, scope); return truthy(l) ? l : yield* this.eval(node.right, scope); }
        if (op === '??') { const l = yield* this.eval(node.left, scope); return (l === null || l === undefined) ? yield* this.eval(node.right, scope) : l; }
        const l = yield* this.eval(node.left, scope);
        const r = yield* this.eval(node.right, scope);
        switch (op) {
          case '+': return (typeof l === 'string' || typeof r === 'string') ? String(l) + String(r) : num(l) + num(r);
          case '-': return num(l) - num(r);
          case '*': return num(l) * num(r);
          case '/': if (num(r) === 0) throw new Error('除零错误'); return num(l) / num(r);
          case '%': if (num(r) === 0) throw new Error('除零错误'); return num(l) % num(r);
          case '==': return l === r || looseEq(l, r);
          case '!=': return !(l === r || looseEq(l, r));
          case '<': return num(l) < num(r);
          case '>': return num(l) > num(r);
          case '<=': return num(l) <= num(r);
          case '>=': return num(l) >= num(r);
          default: throw new Error('未知运算符 ' + op);
        }
      }
      case 'Ternary':
        return truthy(yield* this.eval(node.test, scope))
          ? yield* this.eval(node.cons, scope)
          : yield* this.eval(node.alt, scope);
      case 'Assign': return yield* this.evalAssign(node, scope);
      default: throw new Error('未知表达式: ' + node.type);
    }
  }

  *callFn(fn, args) {
    if (fn.ksFn) {
      const s = Object.create(fn.ksClosure);
      for (let i = 0; i < fn.ksParams.length; i++) s[fn.ksParams[i]] = i < args.length ? args[i] : null;
      try {
        yield* this.execBlock(fn.ksBody.body, s);
        return null;
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        if (e && e.ksBreak) throw new Error('break 在循环外使用');
        if (e && e.ksContinue) throw new Error('continue 在循环外使用');
        throw e;
      }
    }
    // native JS function (builtin or host helper)
    const ret = fn(...args);
    if (ret && ret.ksSuspend) {
      const injected = yield ret;
      return injected;
    }
    return ret;
  }

  makeFn(params, body, closure, name) {
    const fn = { ksFn: true, ksName: name || 'anonymous', ksParams: params, ksBody: body, ksClosure: closure };
    return fn;
  }

  getGlobal(name) { return this.globals[name]; }
  setGlobal(name, v) { this.globals[name] = v; }

  saveState() {
    return { instr: this.instr, done: this.done, error: this.error };
  }
}

function truthy(v) { return v !== false && v !== null && v !== undefined && v !== 0 && v !== ''; }
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function looseEq(l, r) {
  if (typeof l === typeof r) return false;
  if (typeof l === 'number' && typeof r === 'string') return l == r;
  if (typeof l === 'string' && typeof r === 'number') return l == r;
  return false;
}
export { truthy, num, ReturnSignal };
