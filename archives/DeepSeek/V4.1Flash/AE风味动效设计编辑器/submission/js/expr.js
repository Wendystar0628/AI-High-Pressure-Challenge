/* ============================================================
   expr.js — 表达式解析与求值
   支持：time / value / thisComp / thisLayer / layer() /
        transform 属性引用 / valueAtTime / wiggle / loopOut /
        linear / ease / Math / 变量语句
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const A = AE.anim;
  const U = AE.util;
  const E = AE.expr = {};

  // ---------------- 词法 ----------------
  function tokenize(src) {
    const toks = [];
    let i = 0, line = 1, lineStart = 0;
    const err = (msg) => { throw new Error(`表达式第 ${line} 行：${msg}`); };
    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { toks.push({ t: 'nl', line }); i++; line++; lineStart = i; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') { line++; lineStart = i + 1; } i++; }
        i += 2; continue;
      }
      if (c === ';') { toks.push({ t: 'sep', line }); i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) j++;
        if (src[j] === 'e' || src[j] === 'E') {
          j++;
          if (src[j] === '+' || src[j] === '-') j++;
          while (j < src.length && /[0-9]/.test(src[j])) j++;
        }
        const raw = src.slice(i, j);
        const num = parseFloat(raw);
        if (!isFinite(num)) err('无效的数字 ' + raw);
        toks.push({ t: 'num', v: num, line, pos: i - lineStart });
        i = j; continue;
      }
      if (c === '"' || c === "'") {
        const quote = c; let out = ''; i++;
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') { out += src[i + 1] || ''; i += 2; }
          else { out += src[i]; i++; }
        }
        if (src[i] !== quote) err('字符串缺少结束引号');
        i++;
        toks.push({ t: 'str', v: out, line });
        continue;
      }
      if (/[A-Za-z_$\u4e00-\u9fa5]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9_$\u4e00-\u9fa5]/.test(src[j])) j++;
        toks.push({ t: 'id', v: src.slice(i, j), line, pos: i - lineStart });
        i = j; continue;
      }
      const two = src.slice(i, i + 3);
      if (['===', '!==', '**=', '=>'].includes(two)) {
        toks.push({ t: 'op', v: two, line }); i += 3; continue;
      }
      const two2 = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '**', '++', '--'].includes(two2)) {
        toks.push({ t: 'op', v: two2, line }); i += 2; continue;
      }
      if ('+-*/%^<>?:.!()[],'.includes(c)) {
        toks.push({ t: 'op', v: c, line, pos: i - lineStart }); i++; continue;
      }
      err('无法识别的字符 “' + c + '”');
    }
    toks.push({ t: 'eof', line });
    return toks;
  }

  // ---------------- 语法 ----------------
  function parse(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const isOp = (v) => peek().t === 'op' && peek().v === v;
    const isId = (v) => peek().t === 'id' && peek().v === v;
    const expectOp = (v, msg) => {
      if (!isOp(v)) throw new Error(`表达式第 ${peek().line} 行：${msg || ('期望 “' + v + '”')}`);
      return next();
    };
    const skipSep = () => { while (peek().t === 'nl' || peek().t === 'sep') next(); };

    function parseProgram() {
      const body = [];
      skipSep();
      while (peek().t !== 'eof') {
        if (isId('var') || isId('let') || isId('const')) {
          next();
          const nameTok = next();
          if (nameTok.t !== 'id') throw new Error('表达式变量声明缺少名称');
          let value = { t: 'num', v: 0 };
          if (isOp('=')) { next(); value = parseExpr(0); }
          body.push({ t: 'var', name: nameTok.v, value });
        } else {
          const e = parseExpr(0);
          body.push({ t: 'expr', e });
        }
        if (peek().t === 'eof') break;
        if (peek().t !== 'nl' && peek().t !== 'sep') {
          throw new Error(`表达式第 ${peek().line} 行：意外的内容`);
        }
        skipSep();
      }
      return { t: 'program', body };
    }

    const PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '===': 3, '!==': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 7, '**': 7 };
    function parseExpr(min) {
      let left = parseUnary();
      for (;;) {
        if (isOp('?')) {
          if (min > 0) break;
          next();
          const a = parseExpr(0);
          expectOp(':', '三元表达式缺少 “:”');
          const b = parseExpr(0);
          left = { t: 'cond', cond: left, a, b };
          continue;
        }
        const tk = peek();
        if (tk.t !== 'op' || !(tk.v in PREC)) break;
        const prec = PREC[tk.v];
        if (prec < min) break;
        next();
        const right = parseExpr(prec + 1);
        left = { t: 'bin', op: tk.v, a: left, b: right };
      }
      return left;
    }
    function parseUnary() {
      if (isOp('-')) { next(); return { t: 'un', op: '-', e: parseUnary() }; }
      if (isOp('+')) { next(); return { t: 'un', op: '+', e: parseUnary() }; }
      if (isOp('!')) { next(); return { t: 'un', op: '!', e: parseUnary() }; }
      return parsePostfix();
    }
    function parsePostfix() {
      let e = parsePrimary();
      for (;;) {
        if (isOp('.')) {
          next();
          const tk = next();
          let name;
          if (tk.t === 'id') name = tk.v;
          else if (tk.t === 'num') name = String(tk.v);
          else throw new Error(`表达式第 ${tk.line} 行：属性访问缺少名称`);
          e = { t: 'member', obj: e, name };
        } else if (isOp('[')) {
          next();
          const idx = parseExpr(0);
          if (!isOp(']')) throw new Error('索引缺少 “]”');
          next();
          e = { t: 'index', obj: e, idx };
        } else if (isOp('(')) {
          next();
          const args = [];
          if (!isOp(')')) {
            args.push(parseExpr(0));
            while (isOp(',')) { next(); args.push(parseExpr(0)); }
          }
          if (!isOp(')')) throw new Error('函数调用缺少 “)”');
          next();
          e = { t: 'call', callee: e, args };
        } else break;
      }
      return e;
    }
    function parsePrimary() {
      const tk = next();
      if (tk.t === 'num') return { t: 'num', v: tk.v };
      if (tk.t === 'str') return { t: 'str', v: tk.v };
      if (tk.t === 'id') {
        if (tk.v === 'true') return { t: 'num', v: 1 };
        if (tk.v === 'false') return { t: 'num', v: 0 };
        if (tk.v === 'null') return { t: 'null' };
        return { t: 'id', name: tk.v, line: tk.line };
      }
      if (tk.t === 'op' && tk.v === '(') {
        const e = parseExpr(0);
        expectOp(')', '括号缺少 “)”');
        return e;
      }
      if (tk.t === 'op' && tk.v === '[') {
        const items = [];
        if (!isOp(']')) {
          items.push(parseExpr(0));
          while (isOp(',')) { next(); items.push(parseExpr(0)); }
        }
        expectOp(']', '数组缺少 “]”');
        return { t: 'arr', items };
      }
      throw new Error(`表达式第 ${tk.line} 行：无法解析的内容`);
    }

    const ast = parseProgram();
    if (peek().t !== 'eof') throw new Error('表达式末尾有多余内容');
    return ast;
  }

  const AST_CACHE = new Map();
  E.compile = function (src) {
    if (AST_CACHE.has(src)) return AST_CACHE.get(src);
    const ast = parse(src);
    AST_CACHE.set(src, ast);
    return ast;
  };

  // ---------------- 运行时值包装 ----------------
  function numRef(value, prop, layer, ctx, extra) {
    const v = +value || 0;
    const o = new Number(v);
    o.__num = v;
    o.__isRef = true;
    o.__prop = prop;
    o.__layer = layer;
    if (prop) {
      o.valueAtTime = function (t) {
        return wrapVal(A.sample(prop, +t, layer, ctx), prop, layer, ctx);
      };
      o.wiggle = function (freq, amp) {
        return numRef(v + wiggleNoise(prop, ctx.time, +freq || 1, +amp || 0, 0), prop, layer, ctx);
      };
      o.loopOut = function (type) { return wrapVal(loopValue(prop, ctx.time, layer, type), prop, layer, ctx); };
      o.loopIn = function (type) { return wrapVal(loopValueIn(prop, ctx.time, layer, type), prop, layer, ctx); };
    }
    return o;
  }
  function vecRef(value, prop, layer, ctx) {
    const p = A.vec3(value);
    const arr = [p.x, p.y, p.z];
    arr.__isRef = true;
    arr.__prop = prop; arr.__layer = layer;
    if (prop) {
      arr.valueAtTime = function (t) { return wrapVal(A.sample(prop, +t, layer, ctx), prop, layer, ctx); };
      arr.wiggle = function (freq, amp) {
        const a = +amp || 0, f = +freq || 1, tm = ctx.time;
        return vecRef({ x: p.x + wiggleNoise(prop, tm, f, a, 0), y: p.y + wiggleNoise(prop, tm, f, a, 17.3), z: p.z + wiggleNoise(prop, tm, f, a, 39.1) }, prop, layer, ctx);
      };
      arr.loopOut = function (type) { return wrapVal(loopValue(prop, ctx.time, layer, type), prop, layer, ctx); };
      arr.loopIn = function (type) { return wrapVal(loopValueIn(prop, ctx.time, layer, type), prop, layer, ctx); };
    }
    arr.toString = function () { return `${p.x},${p.y},${p.z}`; };
    return arr;
  }
  function wrapVal(value, prop, layer, ctx) {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'x' in value) return vecRef(value, prop, layer, ctx);
    if (Array.isArray(value)) return vecRef(value, prop, layer, ctx);
    if (typeof value === 'string') return value;
    return numRef(value, prop, layer, ctx);
  }

  function wiggleNoise(prop, time, freq, amp, phase) {
    if (!amp) return 0;
    const seed = ((prop && prop._id) || 1) * 1.37 + (phase || 0);
    const t = time * freq;
    return (U.noise1(t * 1.7 + seed) * 0.65 + U.noise1(t * 3.9 + seed * 2.1) * 0.35) * amp;
  }

  function loopRange(prop) {
    const ks = prop.keyframes;
    if (!ks || ks.length < 2) return null;
    return { start: ks[0].t, end: ks[ks.length - 1].t };
  }
  function loopValue(prop, time, layer, type) {
    const r = loopRange(prop);
    if (!r) return A.rawAt(prop, time);
    if (time <= r.end) return A.rawAt(prop, time);
    const dur = r.end - r.start || 1e-6;
    type = type || 'cycle';
    let tt;
    if (type === 'pingpong') {
      const x = (time - r.start) % (dur * 2);
      tt = r.start + (x <= dur ? x : dur * 2 - x);
    } else if (type === 'offset') {
      const n = Math.floor((time - r.end) / dur) + 1;
      const base = A.rawAt(prop, r.end);
      const cur = A.rawAt(prop, r.start + ((time - r.start) % dur));
      if (typeof base === 'number' && typeof cur === 'number') return cur + (base - A.rawAt(prop, r.start)) * n;
      return cur;
    } else {
      tt = r.start + ((time - r.start) % dur);
    }
    return A.rawAt(prop, tt);
  }
  function loopValueIn(prop, time, layer, type) {
    const r = loopRange(prop);
    if (!r) return A.rawAt(prop, time);
    if (time >= r.start) return A.rawAt(prop, time);
    const dur = r.end - r.start || 1e-6;
    let tt;
    if (type === 'pingpong') {
      const x = (r.start - time) % (dur * 2);
      tt = r.start + (x <= dur ? x : dur * 2 - x);
    } else tt = r.end - ((r.start - time) % dur);
    return A.rawAt(prop, tt);
  }

  // ---------------- 作用域对象 ----------------
  function makeLayer(layer, ctx) {
    if (!layer) return null;
    const tr = layer.transform;
    const comp = ctx.comp || layer._comp;
    const layerObj = {
      name: layer.name,
      index: (comp ? comp.layers.indexOf(layer) : 0) + 1,
      enabled: layer.enabled,
      width: comp ? comp.width : 0,
      height: comp ? comp.height : 0,
      get inPoint() { return new Number(layer.inPoint || 0); },
      get outPoint() { return new Number(layer.outPoint || 0); },
      effect: function (name) {
        const fx = (layer.effects || []).find(f => f.name === name || f.id === name);
        if (!fx) return null;
        const obj = {
          param: function (pn) { const p = fx.params[pn]; return p ? wrapVal(A.sample(p, ctx.time, layer, ctx), p, layer, ctx) : numRef(0, null, layer, ctx); }
        };
        for (const pid in fx.params) {
          const p = fx.params[pid];
          const label = p.label || pid;
          Object.defineProperty(obj, label, { get() { return wrapVal(A.sample(p, ctx.time, layer, ctx), p, layer, ctx); }, enumerable: true });
          Object.defineProperty(obj, pid, { get() { return wrapVal(A.sample(p, ctx.time, layer, ctx), p, layer, ctx); }, enumerable: true });
        }
        return obj;
      }
    };
    layerObj.transform = {
      get anchorPoint() { return wrapVal(A.sample(tr.anchor, ctx.time, layer, ctx), tr.anchor, layer, ctx); },
      get position() { return wrapVal(A.sample(tr.position, ctx.time, layer, ctx), tr.position, layer, ctx); },
      get scale() { return wrapVal(A.sample(tr.scale, ctx.time, layer, ctx), tr.scale, layer, ctx); },
      get rotation() { return wrapVal(A.sample(tr.rotation, ctx.time, layer, ctx), tr.rotation, layer, ctx); },
      get rotationX() { return wrapVal(A.sample(tr.rotationX, ctx.time, layer, ctx), tr.rotationX, layer, ctx); },
      get rotationY() { return wrapVal(A.sample(tr.rotationY, ctx.time, layer, ctx), tr.rotationY, layer, ctx); },
      get opacity() { return wrapVal(A.sample(tr.opacity, ctx.time, layer, ctx), tr.opacity, layer, ctx); }
    };
    layerObj._aeLayer = layer;
    return layerObj;
  }

  function makeComp(comp, ctx) {
    const obj = {
      name: comp.name, width: comp.width, height: comp.height,
      duration: comp.duration, fps: comp.fps,
      layer: function (which) {
        if (typeof which === 'number') {
          const l = comp.layers[which - 1];
          if (!l) throw new Error('找不到第 ' + which + ' 个图层');
          return makeLayer(l, ctx);
        }
        const l = comp.layers.find(x => x.name === which);
        if (!l) throw new Error('找不到图层 “' + which + '”');
        return makeLayer(l, ctx);
      }
    };
    return obj;
  }

  // ---------------- 求值 ----------------
  function truthy(v) {
    if (typeof v === 'number') return v !== 0;
    return !!v;
  }
  function toNum(v) {
    if (typeof v === 'number') return v;
    if (v == null) return 0;
    if (Array.isArray(v)) return +v[0] || 0;
    if (typeof v === 'object') {
      if (v.__num !== undefined) return +v.__num;
      if ('x' in v) return +v.x || 0;
    }
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function toVec(v) {
    if (Array.isArray(v)) return { x: toNum(v[0]), y: toNum(v[1]), z: toNum(v[2]) };
    if (v && typeof v === 'object' && 'x' in v) return { x: toNum(v.x), y: toNum(v.y), z: toNum(v.z) };
    return { x: toNum(v), y: toNum(v), z: toNum(v) };
  }

  function evalNode(node, env) {
    switch (node.t) {
      case 'num': return node.v;
      case 'str': return node.v;
      case 'null': return null;
      case 'id': {
        if (node.name in env) return env[node.name];
        if (node.name in env.__globals) return env.__globals[node.name];
        throw new Error(`未定义的标识符 “${node.name}”`);
      }
      case 'arr': return node.items.map(it => evalNode(it, env));
      case 'un': {
        const v = evalNode(node.e, env);
        if (node.op === '-') return -toNum(v);
        if (node.op === '+') return +toNum(v);
        return truthy(v) ? 0 : 1;
      }
      case 'bin': {
        const op = node.op;
        let a = evalNode(node.a, env), b = evalNode(node.b, env);
        if (op === '&&') return truthy(a) ? (truthy(b) ? 1 : 0) : 0;
        if (op === '||') return truthy(a) ? 1 : (truthy(b) ? 1 : 0);
        if (op === '===') return a === b ? 1 : 0;
        if (op === '!==') return a !== b ? 1 : 0;
        if (op === '==') return toNum(a) == toNum(b) ? 1 : 0;
        if (op === '!=') return toNum(a) != toNum(b) ? 1 : 0;
        if (op === '+') {
          if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
        }
        a = toNum(a); b = toNum(b);
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? 0 : a / b;
          case '%': return b === 0 ? 0 : a % b;
          case '^': case '**': return Math.pow(a, b);
          case '<': return a < b ? 1 : 0;
          case '>': return a > b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0;
          case '>=': return a >= b ? 1 : 0;
        }
        return 0;
      }
      case 'cond': return truthy(evalNode(node.cond, env)) ? evalNode(node.a, env) : evalNode(node.b, env);
      case 'member': {
        const obj = evalNode(node.obj, env);
        if (obj == null) throw new Error(`无法读取空值的属性 “${node.name}”`);
        const v = obj[node.name];
        if (v === undefined) throw new Error(`对象没有属性 “${node.name}”`);
        return v;
      }
      case 'index': {
        const obj = evalNode(node.obj, env);
        const idx = evalNode(node.idx, env);
        if (obj == null) return 0;
        const v = obj[toNum(idx)];
        if (typeof v === 'function') return v.bind(obj);
        return v === undefined ? 0 : v;
      }
      case 'call': {
        let fn, self = null;
        if (node.callee.t === 'member') {
          self = evalNode(node.callee.obj, env);
          if (self == null) throw new Error(`无法调用空值的 “${node.callee.name}”`);
          fn = self[node.callee.name];
        } else if (node.callee.t === 'index') {
          self = evalNode(node.callee.obj, env);
          const idx = evalNode(node.callee.idx, env);
          fn = self == null ? null : self[toNum(idx)];
        } else {
          fn = evalNode(node.callee, env);
        }
        if (typeof fn !== 'function') throw new Error('调用的目标不是一个函数');
        const args = node.args.map(a => evalNode(a, env));
        try {
          return fn.apply(self, args);
        } catch (e) {
          throw new Error(e.message || String(e));
        }
      }
      case 'var': {
        env[node.name] = evalNode(node.value, env);
        return 0;
      }
      case 'expr': return evalNode(node.e, env);
      case 'program': {
        const local = Object.create(env);
        local.__globals = env.__globals;
        let last = 0;
        for (const st of node.body) last = evalNode(st, local);
        return last;
      }
    }
    throw new Error('未知的表达式节点');
  }

  // ---------------- 全局函数 ----------------
  function buildGlobals(prop, layer, ctx, base) {
    const globals = {
      Math: Math,
      time: ctx.time,
      value: wrapVal(base, prop, layer, ctx),
      thisLayer: makeLayer(layer, ctx),
      thisComp: makeComp(ctx.comp, ctx),
      comp: function (name) {
        const comps = (AE.app && AE.app.project && AE.app.project.comps) || [];
        const c = comps.find(x => x.name === name || x.id === name);
        if (!c) throw new Error('找不到合成 “' + name + '”');
        return makeComp(c, { comp: c, layer: null, time: ctx.time, stack: ctx.stack, depth: ctx.depth });
      },
      linear: function (t, a, b, c, d) {
        t = toNum(t); a = toNum(a); b = toNum(b); c = toNum(c); d = toNum(d);
        if (b === a) return t < a ? c : d;
        return c + (d - c) * U.clamp((t - a) / (b - a), 0, 1);
      },
      ease: function (t, a, b, c, d) {
        t = toNum(t); a = toNum(a); b = toNum(b); c = toNum(c); d = toNum(d);
        if (b === a) return t < a ? c : d;
        const x = U.clamp((t - a) / (b - a), 0, 1);
        const s = x * x * (3 - 2 * x);
        return c + (d - c) * s;
      },
      clamp: function (v, lo, hi) { return U.clamp(toNum(v), toNum(lo), toNum(hi)); },
      lerp: function (a, b, t) { return toNum(a) + (toNum(b) - toNum(a)) * toNum(t); },
      smoothstep: function (a, b, x) { return U.smoothstep(toNum(a), toNum(b), toNum(x)); },
      wiggle: function (freq, amp) {
        return wrapVal(A.rawAt(prop, ctx.time) + wiggleNoise(prop, ctx.time, toNum(freq) || 1, toNum(amp), 0), null, layer, ctx);
      },
      loopOut: function (type) { return wrapVal(loopValue(prop, ctx.time, layer, type || 'cycle'), null, layer, ctx); },
      loopIn: function (type) { return wrapVal(loopValueIn(prop, ctx.time, layer, type || 'cycle'), null, layer, ctx); },
      valueAtTime: function (t) { return wrapVal(A.sample(prop, toNum(t), layer, ctx), prop, layer, ctx); },
      random: function () { return Math.random(); },
      seedRandom: function () { return 0; },
      noise: function (x) { return U.noise1(toNum(x)); },
      rgbToHsl: function (r, g, b) {
        r = toNum(r); g = toNum(g); b = toNum(b);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0; const l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > .5 ? d / (2 - max - min) : d / (max + min);
          if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h /= 6;
        }
        return [h, s, l];
      }
    };
    globals.time = ctx.time;
    return globals;
  }

  E.evaluate = function (prop, time, layer, ctx, base) {
    const src = prop.expression;
    if (!src || !src.trim()) return base;
    const ast = E.compile(src);
    ctx.time = time;
    if (!ctx.comp) ctx.comp = layer ? layer._comp : null;
    const env = Object.create(null);
    env.__globals = buildGlobals(prop, layer, ctx, base);
    let result = evalNode(ast, env);
    if (typeof result === 'function') result = result();
    if (result === undefined || result === null) return base;
    return result;
  };

  E.validate = function (src) {
    if (!src || !src.trim()) return null;
    try { E.compile(src); return null; }
    catch (e) { return e.message; }
  };

  // 供 UI/曲线使用：以属性最终结果求曲线
  E.TOKEN_TYPES = ['number', 'string', 'identifier', 'operator'];

})(window);
