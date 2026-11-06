// 表达式：词法/语法分析 → 转写为支持向量运算的 JS → 编译缓存
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U;
  const X = AE.Expr = {};

  const PUNCT = ['===', '!==', '**', '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '++', '--', '=>',
    '(', ')', '[', ']', '{', '}', ',', '.', ';', '?', ':', '+', '-', '*', '/', '%', '!', '=', '<', '>'];
  function lex(src) {
    const toks = []; let i = 0, nl = false;
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { nl = true; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
      const start = i;
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
        while (i < src.length && /[0-9.eE]/.test(src[i]) || ((src[i] === '-' || src[i] === '+') && /[eE]/.test(src[i - 1]))) i++;
        toks.push({ t: 'num', v: src.slice(start, i), nl, pos: start }); nl = false; continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        i++; let s = '';
        while (i < src.length && src[i] !== c) { if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; } else s += src[i++]; }
        i++; toks.push({ t: 'str', v: s, q: c === '`' ? "'" : c, nl, pos: start }); nl = false; continue;
      }
      if (/[A-Za-z_$一-龥]/.test(c)) {
        while (i < src.length && /[A-Za-z0-9_$一-龥]/.test(src[i])) i++;
        toks.push({ t: 'id', v: src.slice(start, i), nl, pos: start }); nl = false; continue;
      }
      const p = PUNCT.find(p => src.startsWith(p, i));
      if (!p) throw new SyntaxError('无法识别的字符 “' + c + '”（位置 ' + i + '）');
      toks.push({ t: 'p', v: p, nl, pos: start }); i += p.length; nl = false;
    }
    toks.push({ t: 'eof', v: '', nl: true, pos: src.length });
    return toks;
  }

  function parse(src) {
    const T = lex(src); let k = 0;
    const peek = () => T[k], next = () => T[k++];
    const is = (v) => T[k].t === 'p' && T[k].v === v || (T[k].t === 'id' && T[k].v === v);
    const eat = (v) => { if (is(v)) { k++; return true; } return false; };
    const expect = (v) => { if (!eat(v)) throw new SyntaxError('缺少 “' + v + '”，遇到 “' + (T[k].v || '结尾') + '”'); };
    const program = () => { const body = []; while (peek().t !== 'eof') body.push(statement()); return { type: 'prog', body }; };
    function block() { expect('{'); const body = []; while (!is('}')) { if (peek().t === 'eof') throw new SyntaxError('缺少 “}”'); body.push(statement()); } expect('}'); return { type: 'block', body }; }
    function statement() {
      if (eat(';')) return { type: 'empty' };
      if (is('{')) return block();
      if (is('var') || is('let') || is('const')) { next(); const decl = []; do { const n = next(); if (n.t !== 'id') throw new SyntaxError('变量名无效'); let init = null; if (eat('=')) init = assign(); decl.push({ n: n.v, init }); } while (eat(',')); eat(';'); return { type: 'var', decl }; }
      if (eat('if')) { expect('('); const test = expr(); expect(')'); const cons = statement(); let alt = null; if (eat('else')) alt = statement(); return { type: 'if', test, cons, alt }; }
      if (eat('for')) { expect('('); const init = is(';') ? (next(), null) : statement(); const test = is(';') ? null : expr(); expect(';'); const upd = is(')') ? null : expr(); expect(')'); return { type: 'for', init, test, upd, body: statement() }; }
      if (eat('while')) { expect('('); const test = expr(); expect(')'); return { type: 'while', test, body: statement() }; }
      if (eat('return')) { const arg = (is(';') || is('}') || peek().nl) ? null : expr(); eat(';'); return { type: 'ret', arg }; }
      if (eat('break')) { eat(';'); return { type: 'raw', code: 'break;' }; }
      if (eat('continue')) { eat(';'); return { type: 'raw', code: 'continue;' }; }
      if (is('function') && T[k + 1].t === 'id') { next(); const name = next().v; const fn = funcRest(); return { type: 'var', decl: [{ n: name, init: fn }] }; }
      const e = expr(); eat(';'); return { type: 'expr', e };
    }
    function funcRest() { expect('('); const params = []; if (!is(')')) do { params.push(next().v); } while (eat(',')); expect(')'); const body = block(); return { type: 'func', params, body }; }
    function expr() { let e = assign(); while (is(',') && false) { } return e; }
    function assign() {
      const left = ternary();
      if (peek().t === 'p' && ['=', '+=', '-=', '*=', '/=', '%='].includes(peek().v)) { const op = next().v; const right = assign(); return { type: 'assign', op, left, right }; }
      return left;
    }
    function ternary() { const test = binary(0); if (eat('?')) { const a = assign(); expect(':'); const b = assign(); return { type: 'cond', test, a, b }; } return test; }
    const PREC = [['||'], ['&&'], ['==', '!=', '===', '!=='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%'], ['**']];
    function binary(lv) {
      if (lv >= PREC.length) return unary();
      let left = binary(lv + 1);
      while (peek().t === 'p' && PREC[lv].includes(peek().v)) { const op = next().v; const right = binary(lv + 1); left = { type: 'bin', op, left, right }; }
      return left;
    }
    function unary() {
      if (peek().t === 'p' && ['-', '+', '!'].includes(peek().v)) { const op = next().v; return { type: 'un', op, arg: unary() }; }
      if (is('typeof')) { next(); return { type: 'un', op: 'typeof ', arg: unary() }; }
      if (peek().t === 'p' && (peek().v === '++' || peek().v === '--')) { const op = next().v; return { type: 'upd', op, prefix: true, arg: unary() }; }
      return postfix();
    }
    function postfix() {
      let e = primary();
      for (;;) {
        if (is('.')) { next(); const n = next(); e = { type: 'mem', obj: e, name: n.v }; }
        else if (is('[') && !peek().nl) { next(); const i = expr(); expect(']'); e = { type: 'idx', obj: e, i }; }
        else if (is('(') && !peek().nl) { next(); const args = []; if (!is(')')) do { args.push(assign()); } while (eat(',')); expect(')'); e = { type: 'call', fn: e, args }; }
        else if (peek().t === 'p' && (peek().v === '++' || peek().v === '--') && !peek().nl) { const op = next().v; e = { type: 'upd', op, prefix: false, arg: e }; }
        else break;
      }
      return e;
    }
    function primary() {
      const t = next();
      if (t.t === 'num') return { type: 'lit', code: t.v };
      if (t.t === 'str') return { type: 'lit', code: JSON.stringify(t.v.replace(/\\(.)/g, (m, c) => c === 'n' ? '\n' : c === 't' ? '\t' : c)) };
      if (t.t === 'id') {
        if (t.v === 'true' || t.v === 'false' || t.v === 'null' || t.v === 'undefined') return { type: 'lit', code: t.v };
        if (t.v === 'function') return funcRest();
        if (t.v === 'new') { const e = postfix(); return { type: 'new', e }; }
        return { type: 'id', name: t.v };
      }
      if (t.t === 'p' && t.v === '(') { const e = expr(); expect(')'); return e; }
      if (t.t === 'p' && t.v === '[') { const el = []; if (!is(']')) do { if (is(']')) break; el.push(assign()); } while (eat(',')); expect(']'); return { type: 'arr', el }; }
      if (t.t === 'p' && t.v === '{') { const props = []; if (!is('}')) do { if (is('}')) break; const key = next(); expect(':'); props.push({ k: key.v, v: assign() }); } while (eat(',')); expect('}'); return { type: 'obj', props }; }
      throw new SyntaxError('意外的 “' + (t.v || '结尾') + '”');
    }
    return program();
  }

  const BIN = { '+': '$add', '-': '$sub', '*': '$mul', '/': '$div', '%': '$mod' };
  function gen(n) {
    switch (n.type) {
      case 'prog': case 'block': return '{' + n.body.map(gen).join('\n') + '}';
      case 'empty': return ';';
      case 'raw': return n.code;
      case 'var': return 'var ' + n.decl.map(d => safeName(d.n) + (d.init ? '=' + gen(d.init) : '')).join(',') + ';';
      case 'if': return 'if($t(' + gen(n.test) + '))' + gen(n.cons) + (n.alt ? ' else ' + gen(n.alt) : '');
      case 'for': return 'for(' + (n.init ? gen(n.init).replace(/;$/, '') : '') + ';' + (n.test ? '$t(' + gen(n.test) + ')' : '') + ';' + (n.upd ? gen(n.upd) : '') + ')' + gen(n.body);
      case 'while': return 'while($t(' + gen(n.test) + '))' + gen(n.body);
      case 'ret': return 'return ' + (n.arg ? '$v(' + gen(n.arg) + ')' : 'undefined') + ';';
      case 'expr': return gen(n.e) + ';';
      case 'func': return '(function(' + n.params.map(safeName).join(',') + ')' + gen(n.body) + ')';
      case 'assign': {
        const target = n.left.type === 'idx' ? gen(n.left.obj) + '[$v(' + gen(n.left.i) + ')]' : n.left.type === 'mem' ? gen(n.left.obj) + '.' + n.left.name : safeName(n.left.name);
        if (n.op === '=') return '(' + target + '=' + gen(n.right) + ')';
        return '(' + target + '=' + BIN[n.op[0]] + '(' + target + ',' + gen(n.right) + '))';
      }
      case 'cond': return '($t(' + gen(n.test) + ')?' + gen(n.a) + ':' + gen(n.b) + ')';
      case 'bin':
        if (BIN[n.op]) return BIN[n.op] + '(' + gen(n.left) + ',' + gen(n.right) + ')';
        if (n.op === '**') return 'Math.pow($v(' + gen(n.left) + '),$v(' + gen(n.right) + '))';
        if (n.op === '&&' || n.op === '||') return '($v(' + gen(n.left) + ')' + n.op + '$v(' + gen(n.right) + '))';
        if (n.op === '==' || n.op === '===') return '$eq(' + gen(n.left) + ',' + gen(n.right) + ')';
        if (n.op === '!=' || n.op === '!==') return '!$eq(' + gen(n.left) + ',' + gen(n.right) + ')';
        return '($v(' + gen(n.left) + ')' + n.op + '$v(' + gen(n.right) + '))';
      case 'un': if (n.op === '-') return '$neg(' + gen(n.arg) + ')'; if (n.op === '+') return '(+$v(' + gen(n.arg) + '))'; return '(' + n.op + '$v(' + gen(n.arg) + '))';
      case 'upd': { const t = gen(n.arg); return n.prefix ? '(' + n.op + t + ')' : '(' + t + n.op + ')'; }
      case 'mem': return gen(n.obj) + '.' + n.name;
      case 'idx': return '$idx(' + gen(n.obj) + ',' + gen(n.i) + ')';
      case 'call': return gen(n.fn) + '(' + n.args.map(gen).join(',') + ')';
      case 'new': return 'new ' + gen(n.e);
      case 'lit': return n.code;
      case 'id': return safeName(n.name);
      case 'arr': return '[' + n.el.map(e => '$v(' + gen(e) + ')').join(',') + ']';
      case 'obj': return '({' + n.props.map(p => JSON.stringify(p.k) + ':' + gen(p.v)).join(',') + '})';
    }
    throw new Error('无法生成代码: ' + n.type);
  }
  const RESERVED = new Set(['window', 'document', 'globalThis', 'eval', 'Function', 'fetch', 'XMLHttpRequest', 'localStorage', 'AE']);
  function safeName(n) { if (RESERVED.has(n)) throw new SyntaxError('表达式中不可使用 “' + n + '”'); return n; }
  // 最后一条语句作为结果
  function lastToReturn(body) {
    if (!body.length) return;
    const i = body.length - 1, s = body[i];
    if (s.type === 'expr') body[i] = { type: 'ret', arg: s.e };
    else if (s.type === 'if') { lastToReturn(s.cons.type === 'block' ? s.cons.body : (s.cons = { type: 'block', body: [s.cons] }).body); if (s.alt) lastToReturn(s.alt.type === 'block' ? s.alt.body : (s.alt = { type: 'block', body: [s.alt] }).body); }
    else if (s.type === 'block') lastToReturn(s.body);
    else if (s.type === 'var' && s.decl.length) body.push({ type: 'ret', arg: { type: 'id', name: s.decl[s.decl.length - 1].n } });
  }
  X.PARAMS = ['$', 'time', 'value', 'thisComp', 'thisLayer', 'thisProperty', 'comp', 'index', 'inPoint', 'outPoint', 'transform', 'position', 'scale', 'rotation', 'opacity', 'anchorPoint',
    'wiggle', 'loopOut', 'loopIn', 'linear', 'ease', 'easeIn', 'easeOut', 'clamp', 'random', 'gaussRandom', 'seedRandom', 'noise', 'valueAtTime', 'velocity', 'speed', 'numKeys', 'key',
    'toWorld', 'fromWorld', 'toComp', 'fromComp', 'effect', 'text', 'length', 'normalize', 'dot', 'cross', 'add', 'sub', 'mul', 'div', 'degreesToRadians', 'radiansToDegrees',
    'framesToTime', 'timeToFrames', 'hslToRgb', 'rgbToHsl', 'lookAt', 'id', 'age', 'life', 'pos', 'idx', 'count', 'field', 'thisParticle', 'width', 'height',
    '$add', '$sub', '$mul', '$div', '$mod', '$neg', '$idx', '$v', '$t', '$eq'];
  const cache = new Map();
  X.compile = (src) => {
    if (cache.has(src)) return cache.get(src);
    let res;
    try {
      const ast = parse(src);
      lastToReturn(ast.body);
      const code = '"use strict";' + gen(ast);
      const fn = new Function(...X.PARAMS, code);
      res = { fn, code };
    } catch (e) { res = { error: (e instanceof SyntaxError ? '语法错误：' : '') + e.message }; }
    cache.set(src, res);
    return res;
  };

  // ---------- 运行时：向量运算 ----------
  const $v = x => (x && x.__prop) ? x.value : x;
  const num = x => { x = $v(x); return x; };
  const bc = (a, b, f) => {
    a = num(a); b = num(b);
    const aa = Array.isArray(a), ba = Array.isArray(b);
    if (!aa && !ba) return f(a, b);
    if (aa && ba) { const n = Math.max(a.length, b.length), r = new Array(n); for (let i = 0; i < n; i++) r[i] = f(a[i] === undefined ? 0 : a[i], b[i] === undefined ? 0 : b[i]); return r; }
    if (aa) return a.map(x => f(x, b));
    return b.map(x => f(a, x));
  };
  X.rt = {
    $v, $t: x => !!$v(x),
    $add: (a, b) => { a = num(a); b = num(b); if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b); return bc(a, b, (x, y) => x + y); },
    $sub: (a, b) => bc(a, b, (x, y) => x - y),
    $mul: (a, b) => bc(a, b, (x, y) => x * y),
    $div: (a, b) => bc(a, b, (x, y) => x / y),
    $mod: (a, b) => bc(a, b, (x, y) => x % y),
    $neg: a => { a = num(a); return Array.isArray(a) ? a.map(x => -x) : -a; },
    $idx: (o, i) => { o = $v(o); i = $v(i); const r = o == null ? undefined : o[i]; return r; },
    $eq: (a, b) => { a = $v(a); b = $v(b); if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]); return a == b; },
  };
  const R = X.rt;
  R.linear = (t, a, b, c, d) => {
    t = $v(t); a = $v(a); b = $v(b);
    if (c === undefined) { c = a; d = b; a = 0; b = 1; } else { c = $v(c); d = $v(d); }
    if (b === a) return t <= a ? c : d;
    const f = U.clamp((t - a) / (b - a), 0, 1);
    return U.lerpV(c, d, f);
  };
  const easeF = (f, k) => k === 'io' ? f * f * (3 - 2 * f) : k === 'i' ? f * f * f : 1 - Math.pow(1 - f, 3);
  const mkEase = k => (t, a, b, c, d) => {
    t = $v(t); a = $v(a); b = $v(b);
    if (c === undefined) { c = a; d = b; a = 0; b = 1; } else { c = $v(c); d = $v(d); }
    const f = U.clamp((t - a) / ((b - a) || 1e-9), 0, 1);
    return U.lerpV(c, d, easeF(f, k));
  };
  R.ease = mkEase('io'); R.easeIn = mkEase('i'); R.easeOut = mkEase('o');
  R.clamp = (v, a, b) => bc(bc(v, a, Math.max), b, Math.min);
  R.length = (a, b) => { a = $v(a); if (b !== undefined) a = R.$sub(a, b); return Array.isArray(a) ? U.len(a) : Math.abs(a); };
  R.normalize = a => U.norm($v(a));
  R.dot = (a, b) => U.dot($v(a), $v(b));
  R.cross = (a, b) => U.cross($v(a), $v(b));
  R.add = R.$add; R.sub = R.$sub; R.mul = R.$mul; R.div = R.$div;
  R.degreesToRadians = d => $v(d) * U.deg; R.radiansToDegrees = r => $v(r) / U.deg;
  R.hslToRgb = c => U.hsl2rgb($v(c)); R.rgbToHsl = c => U.rgb2hsl($v(c));
  X.lex = lex; X.parse = parse;
})(typeof window !== 'undefined' ? window : globalThis);
