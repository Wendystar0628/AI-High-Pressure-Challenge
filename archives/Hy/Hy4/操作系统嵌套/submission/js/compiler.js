/* ============================================================================
 * NPL 编译器 —— 把程序文件（NPL 源码）编译成可分步执行、可保存恢复的字节码。
 *
 * NPL 是一种自制的小型命令式语言：
 *   var x = 0
 *   x = x + 1
 *   if (x > 3) { log("big") } else { log("small") }
 *   while (i < 10) { i = i + 1 }
 *   var a = [1, 2, 3]
 *   var o = { x: 1, y: "hi" }
 *   支持 break / continue、算术/比较/逻辑运算、数组与对象字面量、下标与字段访问。
 *   函数以“调用”形式出现：内建纯函数、内核特权原语(k_*)、或需内核分发的系统调用。
 *
 * 编译结果：{ ok, prog:{ code:[ {op,a,b}... ], source }, error }
 * 字节码是纯数据，进程状态（pc / 栈 / 变量 / 等待）也是纯数据，故整棵子树可快照。
 * ========================================================================== */
(function (OS) {
  'use strict';

  // ------------------------------- 词法分析 --------------------------------
  function lex(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    const two = ['==', '!=', '<=', '>=', '&&', '||', '+=', '-='];
    const one = '+-*/%=<>!(){}[];,.:';
    function push(t, v) { toks.push({ t, v }); }
    while (i < n) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
      if (c === '"' || c === "'") {
        const q = c; i++; let s = '';
        while (i < n && src[i] !== q) {
          if (src[i] === '\\' && i + 1 < n) {
            const e = src[i + 1];
            s += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e;
            i += 2;
          } else { s += src[i]; i++; }
        }
        i++; push('STR', s); continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let s = '';
        while (i < n && /[0-9.]/.test(src[i])) { s += src[i]; i++; }
        push('NUM', parseFloat(s)); continue;
      }
      if (/[A-Za-z_一-龥]/.test(c)) {
        let s = '';
        while (i < n && /[A-Za-z0-9_一-龥]/.test(src[i])) { s += src[i]; i++; }
        push('ID', s); continue;
      }
      const pair = src.substr(i, 2);
      if (two.indexOf(pair) >= 0) { push('OP', pair); i += 2; continue; }
      if (one.indexOf(c) >= 0) { push('OP', c); i++; continue; }
      // 未知字符当作分隔符跳过
      i++;
    }
    push('EOF', null);
    return toks;
  }

  // ------------------------------- 语法分析 --------------------------------
  const PREC = {
    '=': 1, '||': 2, '&&': 3, '==': 4, '!=': 4,
    '<': 5, '>': 5, '<=': 5, '>=': 5,
    '+': 6, '-': 6, '*': 7, '/': 7, '%': 7,
  };

  function parse(src) {
    const toks = lex(src);
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const isOp = (v) => peek().t === 'OP' && peek().v === v;
    const isId = (v) => peek().t === 'ID' && peek().v === v;
    const eatOp = (v) => { if (isOp(v)) { p++; return true; } return false; };
    const eatId = (v) => { if (isId(v)) { p++; return true; } return false; };
    function expectOp(v) { if (!eatOp(v)) throw new Error('缺少 "' + v + '"（第 ' + peek().v + ' 个记号附近）'); }
    function expectId(v) { if (!eatId(v)) throw new Error('缺少关键字 ' + v); }

    function parsePrimary() {
      const tk = peek();
      if (tk.t === 'NUM') { next(); return { k: 'lit', v: tk.v }; }
      if (tk.t === 'STR') { next(); return { k: 'lit', v: tk.v }; }
      if (tk.t === 'ID') {
        next();
        const name = tk.v;
        if (name === 'true') return { k: 'lit', v: true };
        if (name === 'false') return { k: 'lit', v: false };
        if (name === 'nil' || name === 'null') return { k: 'lit', v: null };
        let node = { k: 'var', name };
        // 后处理：调用、下标、字段
        while (true) {
          if (isOp('(')) {
            next();
            const args = [];
            if (!isOp(')')) {
              do { args.push(parseExpr()); } while (eatOp(','));
            }
            expectOp(')');
            node = { k: 'call', name, args };
          } else if (isOp('[')) {
            next(); const idx = parseExpr(); expectOp(']');
            node = { k: 'index', obj: node, idx };
          } else if (isOp('.')) {
            next(); const f = next();
            node = { k: 'field', obj: node, name: f.v };
          } else break;
        }
        return node;
      }
      if (isOp('(')) { next(); const e = parseExpr(); expectOp(')'); return e; }
      if (isOp('[')) {
        next(); const els = [];
        if (!isOp(']')) { do { els.push(parseExpr()); } while (eatOp(',')); }
        expectOp(']'); return { k: 'array', els };
      }
      if (isOp('{')) {
        next(); const pairs = [];
        if (!isOp('}')) {
          do {
            let key;
            if (peek().t === 'STR') key = next().v;
            else if (peek().t === 'ID') key = next().v;
            else key = String(next().v);
            expectOp(':');
            pairs.push([key, parseExpr()]);
          } while (eatOp(','));
        }
        expectOp('}'); return { k: 'object', pairs };
      }
      throw new Error('无法解析表达式，记号：' + JSON.stringify(tk));
    }

    function parseUnary() {
      if (isOp('!') || isOp('-')) {
        const op = next().v;
        return { k: 'unary', op, e: parseUnary() };
      }
      return parsePrimary();
    }

    function parseBinary(minPrec) {
      let left = parseUnary();
      while (true) {
        const tk = peek();
        if (tk.t !== 'OP') break;
        const op = tk.v;
        const prec = PREC[op];
        if (prec === undefined || prec < minPrec) break;
        next();
        const right = parseBinary(prec + 1);
        if (op === '=') {
          if (left.k === 'var') left = { k: 'assign', target: { k: 'storevar', name: left.name }, value: right };
          else if (left.k === 'index') left = { k: 'assign', target: { k: 'storeindex', obj: left.obj, idx: left.idx }, value: right };
          else if (left.k === 'field') left = { k: 'assign', target: { k: 'storefield', obj: left.obj, name: left.name }, value: right };
          else throw new Error('赋值左侧无效');
        } else {
          left = { k: 'binary', op, l: left, r: right };
        }
      }
      return left;
    }
    function parseExpr() { return parseBinary(1); }

    function parseBlock() {
      expectOp('{');
      const stmts = [];
      while (!isOp('}') && peek().t !== 'EOF') stmts.push(parseStmt());
      expectOp('}');
      return stmts;
    }

    // 条件可写成 (expr) 或直接 expr { ... }（分号与括号都可省略，空白/换行分隔语句）
    function parseCond() {
      if (eatOp('(')) { const e = parseExpr(); expectOp(')'); return e; }
      return parseExpr();
    }
    function parseStmt() {
      // 跳过游离分号（也处理 `{ };` 之后的分号）
      while (eatOp(';')) {}
      if (isOp('}') || peek().t === 'EOF') return { k: 'expr', e: { k: 'lit', v: null } };
      if (isId('var')) {
        next();
        const name = next().v;
        let init = null;
        if (eatOp('=')) init = parseExpr();
        eatOp(';');
        return { k: 'vardecl', name, init };
      }
      if (isId('if')) {
        next(); const cond = parseCond();
        const then = parseBlock();
        let els = null;
        if (eatId('else')) {
          if (isId('if')) els = [parseStmt()];
          else els = parseBlock();
        }
        return { k: 'if', cond, then, els };
      }
      if (isId('while')) {
        next(); const cond = parseCond();
        return { k: 'while', cond, body: parseBlock() };
      }
      if (isId('break')) { next(); eatOp(';'); return { k: 'break' }; }
      if (isId('continue')) { next(); eatOp(';'); return { k: 'continue' }; }
      if (isOp('{')) return { k: 'block', body: parseBlock() };
      // 表达式语句
      const e = parseExpr(); eatOp(';');
      return { k: 'expr', e };
    }

    const prog = [];
    while (peek().t !== 'EOF') prog.push(parseStmt());
    return prog;
  }

  // ------------------------------- 代码生成 --------------------------------
  function compile(src) {
    try {
      const ast = parse(src);
      const code = [];
      const emit = (op, a, b) => { code.push({ op, a, b }); return code.length - 1; };
      const loopStack = [];

      function compileExpr(node) {
        switch (node.k) {
          case 'lit': emit('PUSH', node.v); break;
          case 'var': emit('LOAD', node.name); break;
          case 'array':
            node.els.forEach(compileExpr);
            emit('ARR', node.els.length); break;
          case 'object':
            for (const [key, val] of node.pairs) { emit('PUSH', key); compileExpr(val); }
            emit('OBJ', node.pairs.length); break;
          case 'index':
            compileExpr(node.obj); compileExpr(node.idx); emit('GETI'); break;
          case 'field':
            compileExpr(node.obj); emit('GETF', node.name); break;
          case 'unary':
            compileExpr(node.e); emit('UN', node.op); break;
          case 'binary':
            compileExpr(node.l); compileExpr(node.r); emit('BIN', node.op); break;
          case 'assign': {
            const t = node.target;
            if (t.k === 'storevar') { compileExpr(node.value); emit('STORE', t.name); }
            else if (t.k === 'storeindex') { compileExpr(t.obj); compileExpr(t.idx); compileExpr(node.value); emit('SETI'); }
            else if (t.k === 'storefield') { compileExpr(t.obj); compileExpr(node.value); emit('SETF', t.name); }
            break;
          }
          case 'call':
            node.args.forEach(compileExpr);
            emit('CALL', node.name, node.args.length); break;
          default: throw new Error('未知表达式节点 ' + node.k);
        }
      }

      function compileStmt(s) {
        switch (s.k) {
          case 'vardecl':
            if (s.init) compileExpr(s.init); else emit('PUSH', null);
            emit('STORE', s.name); break;
          case 'expr': compileExpr(s.e); emit('POP'); break;
          case 'block': s.body.forEach(compileStmt); break;
          case 'break': {
            if (!loopStack.length) throw new Error('break 不在循环内');
            const j = emit('JMP', -1); loopStack[loopStack.length - 1].breaks.push(j); break;
          }
          case 'continue': {
            if (!loopStack.length) throw new Error('continue 不在循环内');
            const j = emit('JMP', -1); loopStack[loopStack.length - 1].continues.push(j); break;
          }
          case 'if': {
            compileExpr(s.cond);
            const jf = emit('JF', -1);
            s.then.forEach(compileStmt);
            if (s.els) {
              const jmp = emit('JMP', -1);
              code[jf].a = code.length;
              s.els.forEach(compileStmt);
              code[jmp].a = code.length;
            } else code[jf].a = code.length;
            break;
          }
          case 'while': {
            const start = code.length;
            loopStack.push({ breaks: [], continues: [], start });
            compileExpr(s.cond);
            const jf = emit('JF', -1);
            s.body.forEach(compileStmt);
            emit('JMP', start);
            const end = code.length;
            const ctx = loopStack.pop();
            code[jf].a = end;
            ctx.breaks.forEach((j) => { code[j].a = end; });
            ctx.continues.forEach((j) => { code[j].a = start; });
            break;
          }
        }
      }
      ast.forEach(compileStmt);
      emit('HALT');
      return { ok: true, prog: { code, source: src }, error: null };
    } catch (e) {
      return { ok: false, prog: null, error: String(e && e.message || e) };
    }
  }

  // --------------------------- 纯函数（任何程序可用）---------------------------
  // 这些函数即时计算、无副作用，不经过内核、不消耗除指令外的额外资源。
  // 其中 rand / 字符串与数组操作让程序可以表达计算与数据处理规模。
  function clone(v) { return OS.util.deepClone(v); }

  OS.PURE = {
    len: (a) => { const v = a[0]; return (v == null) ? 0 : (typeof v === 'object' ? (Array.isArray(v) ? v.length : Object.keys(v).length) : String(v).length); },
    sin: (a) => Math.sin(+a[0] || 0),
    cos: (a) => Math.cos(+a[0] || 0),
    tan: (a) => Math.tan(+a[0] || 0),
    abs: (a) => Math.abs(+a[0] || 0),
    floor: (a) => Math.floor(+a[0] || 0),
    ceil: (a) => Math.ceil(+a[0] || 0),
    round: (a) => Math.round(+a[0] || 0),
    sqrt: (a) => Math.sqrt(Math.max(0, +a[0] || 0)),
    pow: (a) => Math.pow(+a[0] || 0, +a[1] || 0),
    min: (a) => Math.min(+a[0] || 0, +a[1] || 0),
    max: (a) => Math.max(+a[0] || 0, +a[1] || 0),
    clamp: (a) => Math.min(+a[2] || 0, Math.max(+a[1] || 0, +a[0] || 0)),
    lerp: (a) => (+a[0] || 0) + ((+a[1] || 0) - (+a[0] || 0)) * (+a[2] || 0),
    int: (a) => Math.trunc(+a[0] || 0),
    num: (a) => (+a[0] || 0),
    str: (a) => String(a[0] == null ? '' : a[0]),
    type: (a) => (Array.isArray(a[0]) ? 'array' : a[0] === null ? 'nil' : typeof a[0]),
    concat: (a) => String(a[0] == null ? '' : a[0]) + String(a[1] == null ? '' : a[1]),
    keys: (a) => (a[0] && typeof a[0] === 'object') ? Object.keys(a[0]) : [],
    indexof: (a) => { const s = a[0], t = a[1]; return (s == null) ? -1 : (typeof s === 'string' ? s.indexOf(t) : (Array.isArray(s) ? s.indexOf(t) : -1)); },
    substr: (a) => String(a[0] == null ? '' : a[0]).substr(+a[1] || 0, a[2] == null ? undefined : +a[2]),
    replace: (a) => String(a[0] == null ? '' : a[0]).split(a[1]).join(a[2] == null ? '' : a[2]),
    split: (a) => String(a[0] == null ? '' : a[0]).split(a[1]),
    join: (a) => (Array.isArray(a[0]) ? a[0].join(a[1] == null ? '' : a[1]) : ''),
    push: (a) => { if (Array.isArray(a[0])) { a[0].push(clone(a[1])); return a[0].length; } return 0; },
    pop: (a) => (Array.isArray(a[0]) && a[0].length) ? a[0].pop() : null,
    reverse: (a) => Array.isArray(a[0]) ? clone(a[0]).reverse() : [],
    param: (a, ctx) => (ctx && ctx.proc) ? clone(ctx.proc.param) : null,
    rand: (a, ctx) => {
      const sys = ctx && ctx.sys;
      if (!sys) return Math.random();
      sys.rngState = (Math.imul(sys.rngState, 1664525) + 1013904223) >>> 0;
      return sys.rngState / 4294967296;
    },
  };

  OS.compile = compile;
  OS.lex = lex;
})(window.OS = window.OS || {});
