// NPL（Nested Program Language）编译器与可序列化字节码虚拟机。
// 子系统内核、窗口管理、应用服务和自定义程序都以此格式执行。
// 语言：变量、算术/比较/逻辑、if/while/for、函数、数组/对象、系统服务调用。

class LangError extends Error {
  constructor(msg, line = 0, col = 0) {
    super(`${msg}${line ? `（第 ${line} 行${col ? `:${col}` : ''}）` : ''}`);
    this.name = 'LanGError';
    this.line = line;
    this.col = col;
  }
}

const KEYWORDS = new Set(['let', 'var', 'function', 'if', 'else', 'while', 'for', 'break', 'continue', 'return', 'true', 'false', 'null']);

function tokenize(src) {
  const tokens = [];
  let i = 0, line = 1, col = 1;
  const n = src.length;
  const push = (type, value, l = line, c = col) => tokens.push({ type, value, line: l, col: c });
  const advance = (ch) => { if (ch === '\n') { line++; col = 1; } else col++; };
  while (i < n) {
    let ch = src[i];
    if (ch === '\n') { advance(ch); i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { advance(ch); i++; continue; }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { advance(src[i]); i++; }
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      advance(src[i]); advance(src[i + 1]); i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { advance(src[i]); i++; }
      i += 2;
      continue;
    }
    const sl = line, sc = col;
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      const raw = src.slice(i, j);
      if ((raw.match(/\./g) || []).length > 1) throw new LangError('数字格式错误', line, col);
      push('number', parseFloat(raw), sl, sc);
      while (i < j) { advance(src[i]); i++; }
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      advance(ch); i++;
      let out = '';
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') {
          const nx = src[i + 1];
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
          out += map[nx] ?? nx;
          advance(src[i]); advance(nx); i += 2;
        } else {
          if (src[i] === '\n') throw new LangError('字符串不能跨行', line, col);
          out += src[i]; advance(src[i]); i++;
        }
      }
      if (i >= n) throw new LangError('字符串没有闭合', sl, sc);
      advance(src[i]); i++;
      push('string', out, sl, sc);
      continue;
    }
    if (/[A-Za-z_$\u4e00-\u9fa5]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$\u4e00-\u9fa5]/.test(src[j])) j++;
      const word = src.slice(i, j);
      push(KEYWORDS.has(word) ? 'kw' : 'ident', word, sl, sc);
      while (i < j) { advance(src[i]); i++; }
      continue;
    }
    const three = src.slice(i, i + 3);
    const two = src.slice(i, i + 2);
    if (['===', '!=='].includes(three)) { push('op', three, sl, sc); for (let k = 0; k < 3; k++) { advance(src[i]); i++; } continue; }
    if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '++', '--'].includes(two)) {
      push('op', two, sl, sc); advance(src[i]); advance(src[i]); i += 2; continue;
    }
    if ('+-*/%<>=!?:;,(){}[].'.includes(ch)) {
      push('op', ch, sl, sc); advance(ch); i++; continue;
    }
    throw new LangError(`无法识别的字符 ${JSON.stringify(ch)}`, line, col);
  }
  push('eof', null, line, col);
  return tokens;
}

class Parser {
  constructor(tokens) { this.t = tokens; this.i = 0; }
  peek() { return this.t[this.i]; }
  next() { return this.t[this.i++]; }
  is(type, value) { const t = this.peek(); return t.type === type && (value === undefined || t.value === value); }
  isOp(v) { return this.is('op', v); }
  isKw(v) { return this.is('kw', v); }
  expect(type, value) {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new LangError(`期望 ${value ?? type}，实际为 ${t.value ?? t.type}`, t.line, t.col);
    }
    return this.next();
  }
  matchOp(v) { if (this.isOp(v)) { this.next(); return true; } return false; }
  matchKw(v) { if (this.isKw(v)) { this.next(); return true; } return false; }
  program() {
    const body = [];
    while (!this.is('eof')) body.push(this.statement());
    return { type: 'Program', body };
  }
  block() {
    this.expect('op', '{');
    const body = [];
    while (!this.isOp('}')) {
      if (this.is('eof')) throw new LangError('代码块未闭合', this.peek().line, this.peek().col);
      body.push(this.statement());
    }
    this.next();
    return { type: 'Block', body };
  }
  statement() {
    const t = this.peek();
    if (t.type === 'kw') {
      switch (t.value) {
        case 'let': case 'var': return this.varDecl();
        case 'function': return this.fnDecl();
        case 'if': return this.ifStmt();
        case 'while': return this.whileStmt();
        case 'for': return this.forStmt();
        case 'break': this.next(); this.eatSemi(); return { type: 'Break' };
        case 'continue': this.next(); this.eatSemi(); return { type: 'Continue' };
        case 'return': {
          this.next();
          let arg = null;
          if (!this.isOp(';') && !this.is('eof') && !this.isOp('}')) arg = this.expression();
          this.eatSemi();
          return { type: 'Return', arg };
        }
        default: break;
      }
    }
    if (this.isOp('{')) return this.block();
    const expr = this.expression();
    this.eatSemi();
    return { type: 'ExprStmt', expr };
  }
  eatSemi() { if (this.isOp(';')) this.next(); }
  varDecl() {
    this.next();
    const name = this.expect('ident').value;
    let init = null;
    if (this.matchOp('=')) init = this.expression();
    this.eatSemi();
    return { type: 'VarDecl', name, init };
  }
  fnDecl() {
    this.next();
    const name = this.expect('ident').value;
    this.expect('op', '(');
    const params = [];
    while (!this.isOp(')')) {
      params.push(this.expect('ident').value);
      if (!this.matchOp(',')) break;
    }
    this.expect('op', ')');
    const body = this.block();
    return { type: 'FnDecl', name, params, body };
  }
  ifStmt() {
    this.next();
    this.expect('op', '(');
    const test = this.expression();
    this.expect('op', ')');
    const cons = this.statement();
    let alt = null;
    if (this.matchKw('else')) alt = this.statement();
    return { type: 'If', test, cons, alt };
  }
  whileStmt() {
    this.next();
    this.expect('op', '(');
    const test = this.expression();
    this.expect('op', ')');
    const body = this.statement();
    return { type: 'While', test, body };
  }
  forStmt() {
    this.next();
    this.expect('op', '(');
    let init = null, test = null, update = null;
    if (!this.isOp(';')) {
      if (this.isKw('let') || this.isKw('var')) init = this.varDecl();
      else { init = { type: 'ExprStmt', expr: this.expression() }; this.eatSemi(); }
    } else this.next();
    if (!this.isOp(';')) test = this.expression();
    this.expect('op', ';');
    if (!this.isOp(')')) update = this.expression();
    this.expect('op', ')');
    const body = this.statement();
    return { type: 'For', init, test, update, body };
  }
  expression() { return this.assignment(); }
  assignment() {
    const left = this.conditional();
    const t = this.peek();
    if (t.type === 'op' && ['=', '+=', '-=', '*=', '/=', '%='].includes(t.value)) {
      if (!['Ident', 'Member', 'Index'].includes(left.type)) throw new LangError('赋值目标无效', t.line, t.col);
      this.next();
      const right = this.assignment();
      return { type: 'Assign', target: left, op: t.value, value: right };
    }
    return left;
  }
  conditional() {
    let test = this.logicalOr();
    if (this.matchOp('?')) {
      const cons = this.assignment();
      this.expect('op', ':');
      const alt = this.assignment();
      test = { type: 'Conditional', test, cons, alt };
    }
    return test;
  }
  logicalOr() {
    let left = this.logicalAnd();
    while (this.isOp('||')) { this.next(); left = { type: 'Logical', op: '||', left, right: this.logicalAnd() }; }
    return left;
  }
  logicalAnd() {
    let left = this.equality();
    while (this.isOp('&&')) { this.next(); left = { type: 'Logical', op: '&&', left, right: this.equality() }; }
    return left;
  }
  equality() {
    let left = this.comparison();
    while (this.isOp('==') || this.isOp('!=') || this.isOp('===') || this.isOp('!==')) {
      const op = this.next().value;
      left = { type: 'Binary', op, left, right: this.comparison() };
    }
    return left;
  }
  comparison() {
    let left = this.additive();
    while (['<', '<=', '>', '>='].some((v) => this.isOp(v))) {
      const op = this.next().value;
      left = { type: 'Binary', op, left, right: this.additive() };
    }
    return left;
  }
  additive() {
    let left = this.multiplicative();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().value;
      left = { type: 'Binary', op, left, right: this.multiplicative() };
    }
    return left;
  }
  multiplicative() {
    let left = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().value;
      left = { type: 'Binary', op, left, right: this.unary() };
    }
    return left;
  }
  unary() {
    if (this.isOp('!') || this.isOp('-') || this.isOp('+')) {
      const op = this.next().value;
      return { type: 'Unary', op, arg: this.unary() };
    }
    return this.postfix();
  }
  postfix() {
    let expr = this.primary();
    for (;;) {
      if (this.matchOp('(')) {
        const args = [];
        while (!this.isOp(')')) {
          args.push(this.expression());
          if (!this.matchOp(',')) break;
        }
        this.expect('op', ')');
        expr = { type: 'Call', callee: expr, args };
      } else if (this.matchOp('.')) {
        const prop = this.expect('ident').value;
        expr = { type: 'Member', object: expr, property: prop };
      } else if (this.matchOp('[')) {
        const index = this.expression();
        this.expect('op', ']');
        expr = { type: 'Index', object: expr, index };
      } else break;
    }
    return expr;
  }
  primary() {
    const t = this.peek();
    if (t.type === 'number' || t.type === 'string') { this.next(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'ident') { this.next(); return { type: 'Ident', name: t.value }; }
    if (t.type === 'kw') {
      if (t.value === 'true') { this.next(); return { type: 'Literal', value: true }; }
      if (t.value === 'false') { this.next(); return { type: 'Literal', value: false }; }
      if (t.value === 'null') { this.next(); return { type: 'Literal', value: null }; }
    }
    if (this.matchOp('(')) { const e = this.expression(); this.expect('op', ')'); return e; }
    if (this.matchOp('[')) {
      const items = [];
      while (!this.isOp(']')) {
        items.push(this.expression());
        if (!this.matchOp(',')) break;
      }
      this.expect('op', ']');
      return { type: 'Array', items };
    }
    if (this.matchOp('{')) {
      const props = [];
      while (!this.isOp('}')) {
        const kt = this.peek();
        let key;
        if (kt.type === 'ident' || kt.type === 'string' || kt.type === 'kw') { key = String(this.next().value); }
        else throw new LangError('对象键无效', kt.line, kt.col);
        this.expect('op', ':');
        props.push([key, this.expression()]);
        if (!this.matchOp(',')) break;
      }
      this.expect('op', '}');
      return { type: 'Object', props };
    }
    throw new LangError(`意外的记号 ${t.value ?? t.type}`, t.line, t.col);
  }
}

class Compiler {
  constructor() {
    this.consts = [];
    this.constMap = new Map();
    this.functions = {};
  }
  constant(v) {
    const key = typeof v + ':' + JSON.stringify(v);
    if (this.constMap.has(key)) return this.constMap.get(key);
    const idx = this.consts.push(v) - 1;
    this.constMap.set(key, idx);
    return idx;
  }
  compileFunction(name, params, body, isTop = false) {
    const code = [];
    const ctx = { code, loops: [], fnName: name, isTop };
    for (const st of body) this.stmt(st, ctx);
    code.push({ op: 'PUSH_CONST', k: this.constant(null) });
    code.push({ op: 'RETURN' });
    this.functions[name] = { name, params, code };
  }
  emit(ctx, instr) { ctx.code.push(instr); return ctx.code.length - 1; }
  patch(ctx, idx, target) { ctx.code[idx].target = target; }
  stmt(node, ctx) {
    switch (node.type) {
      case 'FnDecl': return; // hoisted separately
      case 'VarDecl': {
        if (node.init) this.expr(node.init, ctx);
        else this.emit(ctx, { op: 'PUSH_CONST', k: this.constant(null) });
        this.emit(ctx, { op: 'STORE', name: node.name });
        return;
      }
      case 'ExprStmt': this.expr(node.expr, ctx); this.emit(ctx, { op: 'POP' }); return;
      case 'Block': for (const s of node.body) this.stmt(s, ctx); return;
      case 'If': {
        this.expr(node.test, ctx);
        const jf = this.emit(ctx, { op: 'JIF', target: -1 });
        this.stmt(node.cons, ctx);
        if (node.alt) {
          const j = this.emit(ctx, { op: 'JUMP', target: -1 });
          this.patch(ctx, jf, ctx.code.length);
          this.stmt(node.alt, ctx);
          this.patch(ctx, j, ctx.code.length);
        } else this.patch(ctx, jf, ctx.code.length);
        return;
      }
      case 'While': {
        const start = ctx.code.length;
        this.expr(node.test, ctx);
        const jf = this.emit(ctx, { op: 'JIF', target: -1 });
        ctx.loops.push({ breaks: [], continues: [], start });
        this.stmt(node.body, ctx);
        const loop = ctx.loops.pop();
        for (const c of loop.continues) this.patch(ctx, c, start);
        this.emit(ctx, { op: 'JUMP', target: start });
        this.patch(ctx, jf, ctx.code.length);
        for (const b of loop.breaks) this.patch(ctx, b, ctx.code.length);
        return;
      }
      case 'For': {
        if (node.init) this.stmt(node.init, ctx);
        const start = ctx.code.length;
        let jf = -1;
        if (node.test) { this.expr(node.test, ctx); jf = this.emit(ctx, { op: 'JIF', target: -1 }); }
        ctx.loops.push({ breaks: [], continues: [], start });
        this.stmt(node.body, ctx);
        const loop = ctx.loops.pop();
        const contTarget = ctx.code.length;
        for (const c of loop.continues) this.patch(ctx, c, contTarget);
        if (node.update) { this.expr(node.update, ctx); this.emit(ctx, { op: 'POP' }); }
        this.emit(ctx, { op: 'JUMP', target: start });
        if (jf >= 0) this.patch(ctx, jf, ctx.code.length);
        for (const b of loop.breaks) this.patch(ctx, b, ctx.code.length);
        return;
      }
      case 'Return': {
        if (node.arg) this.expr(node.arg, ctx); else this.emit(ctx, { op: 'PUSH_CONST', k: this.constant(null) });
        this.emit(ctx, { op: 'RETURN' });
        return;
      }
      case 'Break': {
        const loop = ctx.loops[ctx.loops.length - 1];
        if (!loop) throw new LangError('break 只能在循环内使用');
        const idx = this.emit(ctx, { op: 'JUMP', target: -1 });
        loop.breaks.push(idx);
        return;
      }
      case 'Continue': {
        const loop = ctx.loops[ctx.loops.length - 1];
        if (!loop) throw new LangError('continue 只能在循环内使用');
        const idx = this.emit(ctx, { op: 'JUMP', target: -1 });
        loop.continues.push(idx);
        return;
      }
      default: throw new LangError('未知语句 ' + node.type);
    }
  }
  assignTarget(node, ctx, valueCompile) {
    if (node.type === 'Ident') {
      valueCompile();
      this.emit(ctx, { op: 'STORE', name: node.name });
    } else if (node.type === 'Member') {
      this.expr(node.object, ctx);
      this.emit(ctx, { op: 'DUP' });
      this.emit(ctx, { op: 'GET', key: node.property });
      this.emit(ctx, { op: 'POP' }); // keep object on stack; old value unneeded
      valueCompile();
      this.emit(ctx, { op: 'SET', key: node.property });
    } else if (node.type === 'Index') {
      this.expr(node.object, ctx);
      this.expr(node.index, ctx);
      valueCompile();
      this.emit(ctx, { op: 'SET_IDX' });
    }
  }
  expr(node, ctx) {
    switch (node.type) {
      case 'Literal': this.emit(ctx, { op: 'PUSH_CONST', k: this.constant(node.value) }); return;
      case 'Ident': this.emit(ctx, { op: 'LOAD', name: node.name }); return;
      case 'Array': {
        for (const item of node.items) this.expr(item, ctx);
        this.emit(ctx, { op: 'BUILD_ARRAY', count: node.items.length });
        return;
      }
      case 'Object': {
        for (const [k, v] of node.props) {
          this.emit(ctx, { op: 'PUSH_CONST', k: this.constant(k) });
          this.expr(v, ctx);
        }
        this.emit(ctx, { op: 'BUILD_OBJECT', count: node.props.length });
        return;
      }
      case 'Unary': this.expr(node.arg, ctx); this.emit(ctx, { op: 'UNARY', oper: node.op }); return;
      case 'Binary': this.expr(node.left, ctx); this.expr(node.right, ctx); this.emit(ctx, { op: 'BINARY', oper: node.op }); return;
      case 'Logical': {
        this.expr(node.left, ctx);
        this.emit(ctx, { op: 'DUP' });
        this.emit(ctx, node.op === '&&' ? { op: 'JIF_KEEP', target: -1 } : { op: 'JIT_KEEP', target: -1 });
        const j = ctx.code.length - 1;
        this.emit(ctx, { op: 'POP' });
        this.expr(node.right, ctx);
        this.patch(ctx, j, ctx.code.length);
        return;
      }
      case 'Conditional': {
        this.expr(node.test, ctx);
        const jf = this.emit(ctx, { op: 'JIF', target: -1 });
        this.expr(node.cons, ctx);
        const j = this.emit(ctx, { op: 'JUMP', target: -1 });
        this.patch(ctx, jf, ctx.code.length);
        this.expr(node.alt, ctx);
        this.patch(ctx, j, ctx.code.length);
        return;
      }
      case 'Call': {
        if (node.callee.type === 'Ident') {
          for (const a of node.args) this.expr(a, ctx);
          this.emit(ctx, { op: 'CALLNAME', name: node.callee.name, argc: node.args.length });
        } else {
          this.expr(node.callee, ctx);
          for (const a of node.args) this.expr(a, ctx);
          this.emit(ctx, { op: 'CALL', argc: node.args.length });
        }
        return;
      }
      case 'Member': {
        this.expr(node.object, ctx);
        this.emit(ctx, { op: 'GET', key: node.property });
        return;
      }
      case 'Index': {
        this.expr(node.object, ctx);
        this.expr(node.index, ctx);
        this.emit(ctx, { op: 'GET_IDX' });
        return;
      }
      case 'Assign': {
        if (node.op === '=') {
          this.assignTarget(node.target, ctx, () => this.expr(node.value, ctx));
        } else {
          const binop = node.op[0];
          if (node.target.type === 'Ident') {
            this.emit(ctx, { op: 'LOAD', name: node.target.name });
            this.expr(node.value, ctx);
            this.emit(ctx, { op: 'BINARY', oper: binop });
            this.emit(ctx, { op: 'STORE', name: node.target.name });
          } else if (node.target.type === 'Member') {
            this.expr(node.target.object, ctx);
            this.emit(ctx, { op: 'DUP' });
            this.emit(ctx, { op: 'GET', key: node.target.property });
            this.expr(node.value, ctx);
            this.emit(ctx, { op: 'BINARY', oper: binop });
            this.emit(ctx, { op: 'SET', key: node.target.property });
          } else {
            this.expr(node.target.object, ctx);
            this.expr(node.target.index, ctx);
            this.emit(ctx, { op: 'DUP2' });
            this.emit(ctx, { op: 'GET_IDX' });
            this.expr(node.value, ctx);
            this.emit(ctx, { op: 'BINARY', oper: binop });
            this.emit(ctx, { op: 'SET_IDX' });
          }
        }
        return;
      }
      default: throw new LangError('未知表达式 ' + node.type);
    }
  }
}

export function compileProgram(source, filename = 'program.prog') {
  if (typeof source !== 'string') throw new LangError('程序为空');
  if (source.length > 300000) throw new LangError('程序过大（上限 300KB）');
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const ast = parser.program();
  const compiler = new Compiler();
  const fnDecls = ast.body.filter((s) => s.type === 'FnDecl');
  const runtimeBody = ast.body.filter((s) => s.type !== 'FnDecl');
  for (const fn of fnDecls) compiler.compileFunction(fn.name, fn.params, fn.body.body);
  let entry = null;
  if (runtimeBody.length > 0) {
    compiler.compileFunction('__top', [], runtimeBody, true);
    entry = '__top';
  } else if (compiler.functions.main) entry = 'main';
  else if (fnDecls.length > 0) entry = fnDecls[0].name;
  else throw new LangError('程序没有可执行内容');
  return {
    format: 'NPL/1', filename, source, constants: compiler.consts, functions: compiler.functions, entry,
  };
}

// ---------------- VM ----------------

function truthy(v) { return !(v === false || v === null || v === undefined || v === 0 || v === '' || Number.isNaN(v)); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function str(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}
export function equals(a, b) {
  if (a && typeof a === 'object' && a.__fn) a = a.__fn;
  if (b && typeof b === 'object' && b.__fn) b = b.__fn;
  return a === b || (typeof a === 'number' && typeof b === 'number' && a === b);
}

function getProp(obj, key) {
  if (obj === null || obj === undefined) throw new LangError(`无法读取 ${String(key)}，对象为空`);
  if (Array.isArray(obj)) {
    if (key === 'length') return obj.length;
    if (/^\d+$/.test(String(key))) return obj[Number(key)];
    return undefined;
  }
  if (typeof obj === 'string') {
    if (key === 'length') return obj.length;
    return undefined;
  }
  if (typeof obj === 'object') {
    if (key === '__nativeCall') return obj;
    return obj[key];
  }
  return undefined;
}
function setProp(obj, key, value) {
  if (obj === null || obj === undefined) throw new LangError('无法写入空对象');
  if (Array.isArray(obj)) {
    if (key === 'length') { obj.length = Math.max(0, Math.floor(num(value))); return; }
    obj[Number(key)] = value; return;
  }
  if (typeof obj === 'object') { obj[key] = value; return; }
  throw new LangError('该值不能设置属性');
}

export function createVM(program) {
  const vm = {
    program,
    globals: {},
    frames: [],
    done: false,
    pending: null,
    started: false,
    stepsExecuted: 0,
    autoMainPending: program.entry === '__top' && !!program.functions.main,
    mainStarted: false,
  };
  return vm;
}

export function startVM(vm) {
  const prog = vm.program;
  if (!prog.functions[prog.entry]) throw new LangError(`入口 ${prog.entry} 不存在`);
  vm.done = false;
  vm.started = true;
  vm.globals = vm.globals || {};
  pushFrame(vm, prog.entry, [], vm.globals);
}

function pushFrame(vm, fnName, args, locals = null) {
  const fn = vm.program.functions[fnName];
  if (!fn) throw new LangError(`未知函数 ${fnName}`);
  const frame = { fn: fnName, ip: 0, locals: locals || {}, stack: [] };
  fn.params.forEach((p, i) => { frame.locals[p] = args[i] === undefined ? null : args[i]; });
  vm.frames.push(frame);
}

/**
 * 运行至多 maxSteps 条指令。
 * ctx: {
 *   nativeCall(id, args, ctl) -> value,
 *   makeFrame? etc
 * }
 * ctl.block({...}) 可挂起当前调用；VM 会回退 CALL 指令。
 */
export function runVM(vm, maxSteps, ctx) {
  if (vm.done) return { status: 'done', steps: 0 };
  if (!vm.started) startVM(vm);
  let steps = 0;
  const ctl = {
    vm,
    block(info) { const e = new Error('__block__'); e.__block = true; e.info = info; throw e; },
  };
  while (steps < maxSteps) {
    if (vm.done) return { status: 'done', steps };
    const frame = vm.frames[vm.frames.length - 1];
    if (!frame) { vm.done = true; return { status: 'done', steps }; }
    const fn = vm.program.functions[frame.fn];
    if (!fn) return fail(vm, new LangError(`函数 ${frame.fn} 丢失`), steps);
    if (frame.ip >= fn.code.length) {
      vm.frames.pop();
      if (!vm.frames.length) {
        if (vm.autoMainPending && !vm.mainStarted) {
          vm.mainStarted = true;
          pushFrame(vm, 'main', [], null);
          steps++;
          continue;
        }
        vm.done = true;
        return { status: 'done', steps };
      }
      vm.frames[vm.frames.length - 1].stack.push(null);
      steps++;
      continue;
    }
    const instr = fn.code[frame.ip];
    const callIp = frame.ip;
    try {
      frame.ip++;
      execInstr(vm, frame, instr, ctl, ctx);
      steps++;
    } catch (e) {
      if (e && e.__block) {
        frame.ip = callIp;
        if (e.restore) frame.stack.push(...e.restore);
        else {
          const stackKeep = e.stackBase ?? null;
          if (stackKeep !== null) frame.stack.length = stackKeep;
        }
        vm.pending = e.info || {};
        return { status: 'blocked', steps, block: vm.pending };
      }
      return fail(vm, e, steps);
    }
  }
  return { status: 'budget', steps };
}

function fail(vm, e, steps) {
  vm.done = true;
  vm.error = e && e.message ? e.message : String(e);
  return { status: 'error', error: vm.error, steps };
}

function execInstr(vm, frame, instr, ctl, ctx) {
  const st = frame.stack;
  const prog = vm.program;
  switch (instr.op) {
    case 'PUSH_CONST': st.push(prog.constants[instr.k]); return;
    case 'POP': st.pop(); return;
    case 'DUP': st.push(st[st.length - 1]); return;
    case 'DUP2': { const a = st[st.length - 2], b = st[st.length - 1]; st.push(a, b); return; }
    case 'LOAD': {
      if (Object.prototype.hasOwnProperty.call(frame.locals, instr.name)) st.push(frame.locals[instr.name]);
      else if (Object.prototype.hasOwnProperty.call(vm.globals, instr.name)) st.push(vm.globals[instr.name]);
      else if (prog.functions[instr.name]) st.push({ __fn: instr.name });
      else if (ctx.hasGlobal && ctx.hasGlobal(instr.name)) st.push(ctx.getGlobal(instr.name));
      else throw new LangError(`变量或函数 ${instr.name} 未定义`);
      return;
    }
    case 'STORE': {
      const v = st.pop();
      const isTop = frame.fn === '__top' || vm.frames.length === 1;
      if (Object.prototype.hasOwnProperty.call(frame.locals, instr.name) || isTop) frame.locals[instr.name] = v;
      else if (Object.prototype.hasOwnProperty.call(vm.globals, instr.name)) vm.globals[instr.name] = v;
      else frame.locals[instr.name] = v;
      return;
    }
    case 'GET': { const obj = st.pop(); st.push(getProp(obj, instr.key)); return; }
    case 'SET': { const v = st.pop(); const obj = st.pop(); setProp(obj, instr.key, v); return; }
    case 'GET_IDX': { const key = st.pop(); const obj = st.pop(); st.push(getProp(obj, key)); return; }
    case 'SET_IDX': { const v = st.pop(); const key = st.pop(); const obj = st.pop(); setProp(obj, key, v); return; }
    case 'BUILD_ARRAY': { const items = st.splice(st.length - instr.count, instr.count); st.push(items); return; }
    case 'BUILD_OBJECT': {
      const obj = {};
      const start = st.length - instr.count * 2;
      for (let i = 0; i < instr.count; i++) { obj[st[start + i * 2]] = st[start + i * 2 + 1]; }
      st.length = start;
      st.push(obj);
      return;
    }
    case 'UNARY': {
      const v = st.pop();
      if (instr.oper === '!') st.push(!truthy(v));
      else if (instr.oper === '-') st.push(-num(v));
      else st.push(num(v));
      return;
    }
    case 'BINARY': {
      const b = st.pop(); const a = st.pop();
      const op = instr.oper;
      switch (op) {
        case '+':
          if (Array.isArray(a) && Array.isArray(b)) st.push(a.concat(b));
          else if (typeof a === 'string' || typeof b === 'string') st.push(str(a) + str(b));
          else st.push(num(a) + num(b));
          return;
        case '-': st.push(num(a) - num(b)); return;
        case '*': st.push(num(a) * num(b)); return;
        case '/': {
          if (num(b) === 0) throw new LangError('除零错误');
          st.push(num(a) / num(b)); return;
        }
        case '%': {
          if (num(b) === 0) throw new LangError('除零错误');
          st.push(num(a) % num(b)); return;
        }
        case '==': case '===': st.push(equals(a, b)); return;
        case '!=': case '!==': st.push(!equals(a, b)); return;
        case '<': st.push(a < b); return;
        case '<=': st.push(a <= b); return;
        case '>': st.push(a > b); return;
        case '>=': st.push(a >= b); return;
        default: throw new LangError('未知运算符 ' + op);
      }
    }
    case 'JIF': { const v = st.pop(); if (!truthy(v)) frame.ip = instr.target; return; }
    case 'JIT_KEEP': { const v = st[st.length - 1]; if (truthy(v)) frame.ip = instr.target; return; }
    case 'JIF_KEEP': { const v = st[st.length - 1]; if (!truthy(v)) frame.ip = instr.target; return; }
    case 'JUMP': frame.ip = instr.target; return;
    case 'CALLNAME': {
      const name = instr.name;
      const args = st.splice(st.length - instr.argc, instr.argc);
      if (prog.functions[name]) { pushFrame(vm, name, args); return; }
      const nativeId = 'fn:' + name;
      if (ctx.hasNative && ctx.hasNative(nativeId)) {
        try {
          const r = ctx.nativeCall(nativeId, args, ctl, vm);
          st.push(r);
        } catch (e) {
          if (e && e.__block) { e.stackBase = st.length; throw e; }
          throw e;
        }
        return;
      }
      throw new LangError(`函数 ${name} 未定义`);
    }
    case 'CALL': {
      const args = st.splice(st.length - instr.argc, instr.argc);
      const callee = st.pop();
      if (callee && callee.__fn) { pushFrame(vm, callee.__fn, args); return; }
      if (callee && callee.__native) {
        try {
          const r = ctx.nativeCall(callee.__native, args, ctl, vm);
          st.push(r);
        } catch (e) {
          if (e && e.__block) { e.restore = [callee, ...args]; e.stackBase = null; throw e; }
          throw e;
        }
        return;
      }
      if (typeof callee === 'function') throw new LangError('宿主函数不可直接调用');
      throw new LangError('调用的值不是函数');
    }
    case 'RETURN': {
      const v = st.pop();
      if (vm.frames.length === 1) {
        if (vm.autoMainPending && !vm.mainStarted) {
          vm.mainStarted = true;
          pushFrame(vm, 'main', [], null);
          return;
        }
        vm.done = true;
        vm.returnValue = v;
        return;
      }
      vm.frames.pop();
      vm.frames[vm.frames.length - 1].stack.push(v === undefined ? null : v);
      return;
    }
    default: throw new LangError('未知指令 ' + instr.op);
  }
}

export { LangError, truthy, num, str };
