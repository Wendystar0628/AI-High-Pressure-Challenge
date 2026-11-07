// 表达式引擎：解析与求值，支持 time/value/wiggle/loopOut/linear/ease/引用/valueAtTime/toWorld/fromWorld
import { clamp, easeFn, linearFn, wiggleVec, deg2rad, rad2deg } from './math.js';

// ---- 词法 ----
function tokenize(src) {
  const tokens = [];
  let i = 0;
  const isDigit = (c) => c >= '0' && c <= '9';
  const isAlpha = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$' || (c && c.charCodeAt(0) > 127);
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let j = i;
      while (j < src.length && (isDigit(src[j]) || src[j] === '.')) j++;
      tokens.push({ type: 'num', value: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j++;
      tokens.push({ type: 'str', value: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (isAlpha(c)) {
      let j = i;
      while (j < src.length && (isAlpha(src[j]) || isDigit(src[j]))) j++;
      tokens.push({ type: 'id', value: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if ('+-*/%^<>=!()[]{},.;:'.includes(c)) {
      tokens.push({ type: c === '.' ? 'dot' : c === '(' ? 'lparen' : c === ')' ? 'rparen' : c === '[' ? 'lbracket' : c === ']' ? 'rbracket' : c === ',' ? 'comma' : c === ';' ? 'semi' : 'op', value: c });
      i++;
      continue;
    }
    i++; // 跳过未知
  }
  return tokens;
}

// ---- 求值环境 ----
// env 提供： time, value, index, comp, layer, exprEval(valueAtTime), toWorld/fromWorld, seed
export function evalExpression(src, env) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (v) => {
    const t = next();
    if (!t || (t.type !== v && t.value !== v)) throw new Error('表达式语法错误');
    return t;
  };

  function parseExpr() {
    return parseTernary();
  }

  function parseTernary() {
    let cond = parseOr();
    while (peek() && peek().value === '?') {
      next();
      const a = parseExpr();
      expect('op'); // :
      // expect ':' as op
      const b = parseExpr();
      cond = cond ? a : b;
    }
    return cond;
  }

  function parseOr() {
    let l = parseAnd();
    while (peek() && peek().value === '||') {
      next();
      const r = parseAnd();
      l = truthy(l) || truthy(r);
    }
    return l;
  }

  function parseAnd() {
    let l = parseCompare();
    while (peek() && peek().value === '&&') {
      next();
      const r = parseCompare();
      l = truthy(l) && truthy(r);
    }
    return l;
  }

  function parseCompare() {
    let l = parseAdd();
    while (peek() && ['==', '!=', '<', '>', '<=', '>='].includes(peek().value)) {
      const op = next().value;
      const r = parseAdd();
      const a = toNum(l), b = toNum(r);
      if (op === '==') l = toNum(l) === toNum(r) || String(l) === String(r);
      else if (op === '!=') l = toNum(l) !== toNum(r) && String(l) !== String(r);
      else if (op === '<') l = a < b;
      else if (op === '>') l = a > b;
      else if (op === '<=') l = a <= b;
      else l = a >= b;
    }
    return l;
  }

  function parseAdd() {
    let l = parseMul();
    while (peek() && (peek().value === '+' || peek().value === '-') && peek().type === 'op') {
      const op = next().value;
      const r = parseMul();
      l = binOp(l, r, op);
    }
    return l;
  }

  function parseMul() {
    let l = parseUnary();
    while (peek() && ['*', '/', '%'].includes(peek().value) && peek().type === 'op') {
      const op = next().value;
      const r = parseUnary();
      l = binOp(l, r, op);
    }
    return l;
  }

  function parseUnary() {
    if (peek() && peek().value === '-' && peek().type === 'op') {
      next();
      return binOp(0, parseUnary(), '-');
    }
    if (peek() && peek().value === '!' && peek().type === 'op') {
      next();
      return !truthy(parseUnary());
    }
    return parsePower();
  }

  function parsePower() {
    let l = parsePostfix();
    while (peek() && peek().value === '^' && peek().type === 'op') {
      next();
      const r = parsePostfix();
      l = binOp(l, r, '*'); // 向量点乘近似；标量幂
      if (typeof l === 'number' && typeof r === 'number') l = Math.pow(toNum(l), toNum(r));
    }
    return l;
  }

  function parsePostfix() {
    let v = parsePrimary();
    while (peek() && (peek().type === 'dot' || peek().type === 'lbracket' || peek().type === 'lparen')) {
      if (peek().type === 'dot') {
        next();
        const name = next();
        if (!name) break;
        v = memberAccess(v, name.value);
      } else if (peek().type === 'lbracket') {
        next();
        const idx = parseExpr();
        expect('rbracket');
        const i = Math.floor(toNum(idx));
        if (Array.isArray(v)) v = v[Math.max(0, Math.min(v.length - 1, i))] ?? 0;
        else v = 0;
      } else if (peek().type === 'lparen') {
        // 方法调用：obj.method(args)
        next();
        const args = [];
        if (peek() && peek().type !== 'rparen') {
          args.push(parseExpr());
          while (peek() && peek().type === 'comma') {
            next();
            args.push(parseExpr());
          }
        }
        expect('rparen');
        if (typeof v === 'function') {
          try { v = v(...args); } catch (e) { v = 0; }
        } else {
          v = 0;
        }
      }
    }
    return v;
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('表达式意外结束');
    if (t.type === 'num') { next(); return t.value; }
    if (t.type === 'str') { next(); return t.value; }
    if (t.type === 'lparen') {
      next();
      const v = parseExpr();
      expect('rparen');
      return v;
    }
    if (t.type === 'lbracket') {
      next();
      const arr = [];
      if (peek() && peek().type !== 'rbracket') {
        arr.push(parseExpr());
        while (peek() && peek().type === 'comma') {
          next();
          arr.push(parseExpr());
        }
      }
      expect('rbracket');
      return arr;
    }
    if (t.type === 'id') {
      next();
      // 函数调用
      if (peek() && peek().type === 'lparen') {
        next();
        const args = [];
        if (peek() && peek().type !== 'rparen') {
          args.push(parseExpr());
          while (peek() && peek().type === 'comma') {
            next();
            args.push(parseExpr());
          }
        }
        expect('rparen');
        return callFunc(t.value, args, env);
      }
      return identifier(t.value, env);
    }
    next();
    return 0;
  }

  function truthy(v) {
    if (Array.isArray(v)) return v.some((x) => x !== 0);
    return !!v && v !== 0;
  }
  function toNum(v) {
    if (Array.isArray(v)) return v.length ? toNum(v[0]) : 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return parseFloat(v) || 0;
  }
  function binOp(a, b, op) {
    const av = Array.isArray(a) ? a : [a];
    const bv = Array.isArray(b) ? b : [b];
    const n = Math.max(av.length, bv.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = av[Math.min(i, av.length - 1)] ?? 0;
      const y = bv[Math.min(i, bv.length - 1)] ?? 0;
      const xs = toNum(x), ys = toNum(y);
      switch (op) {
        case '+': out.push(typeof x === 'string' || typeof y === 'string' ? String(x) + String(y) : xs + ys); break;
        case '-': out.push(xs - ys); break;
        case '*': out.push(xs * ys); break;
        case '/': out.push(ys === 0 ? 0 : xs / ys); break;
        case '%': out.push(ys === 0 ? 0 : xs % ys); break;
        default: out.push(0);
      }
    }
    return Array.isArray(a) || Array.isArray(b) ? out : out[0];
  }

  const result = parseExpr();
  return result;
}

function identifier(name, env) {
  switch (name) {
    case 'time': return env.time;
    case 'value': return env.value != null ? env.value : 0;
    case 'index': return env.index ?? 1;
    case 'thisComp': return { __comp: env.comp };
    case 'thisLayer': return { __layer: env.layer, __comp: env.comp };
    case 'temporalStartTime': return env.layer?.startTime ?? 0;
    case 'frameDuration': return 1 / (env.comp?.fps || 30);
    case 'frameRate': return env.comp?.fps || 30;
    case 'duration': return env.comp?.duration || 0;
    case 'width': return env.comp?.width || 1920;
    case 'height': return env.comp?.height || 1080;
    case 'PI': return Math.PI;
    case 'Math': return Math;
    default: {
      // 数学常量兜底
      if (typeof Math[name] === 'function') return Math[name];
      return 0;
    }
  }
}

function memberAccess(obj, name) {
  if (obj == null) return 0;
  if (typeof obj === 'number' || Array.isArray(obj)) {
    // 向量分量
    const map = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3, 0: 0, 1: 1, 2: 2, 3: 3 };
    if (name in map) {
      const i = map[name];
      return Array.isArray(obj) ? (obj[i] ?? 0) : obj;
    }
    return 0;
  }
  if (obj.__comp) {
    if (name === 'layer') return (n) => resolveLayer(obj.__comp, n);
    if (name === 'width') return obj.__comp.width;
    if (name === 'height') return obj.__comp.height;
    if (name === 'duration') return obj.__comp.duration;
    if (name === 'frameRate' || name === 'fps') return obj.__comp.fps;
    return 0;
  }
  if (obj.__layer) {
    if (name === 'transform' || name === 'position' || name === 'scale' || name === 'rotation' || name === 'opacity' || name === 'anchorPoint' || name === 'effects') {
      return { __layerProp: obj.__layer, prop: name };
    }
    if (name === 'name') return obj.__layer.name;
    if (name === 'index') return obj.__layer.index ?? 1;
    return { __layerProp: obj.__layer, prop: name };
  }
  if (obj.__layerProp) {
    // thisComp.layer("X").transform.rotation -> 解析为实际值数组
    return resolvePropValue(obj.__layerProp, name);
  }
  if (obj.__resolveProp) {
    return obj.__resolveProp(name);
  }
  // 数学对象
  if (obj === Math) return 0;
  return obj[name] ?? 0;
}

function resolveLayer(comp, nameOrIndex) {
  const layers = comp?.layers || [];
  let layer = null;
  if (typeof nameOrIndex === 'number') {
    layer = layers[nameOrIndex - 1] || layers[nameOrIndex] || null;
  } else {
    layer = layers.find((l) => l.name === nameOrIndex) || null;
  }
  return {
    __layer: layer,
    __resolveProp: (pname) => resolvePropObj(layer, pname),
  };
}

function resolvePropObj(layer, pname) {
  if (!layer) return { __value: 0, valueAtTime: () => 0, __propRef: null };
  const map = {
    position: 'position', rotation: 'rotation', scale: 'scale', opacity: 'opacity',
    anchorPoint: 'anchorPoint', anchor: 'anchorPoint',
  };
  let prop = null;
  if (map[pname]) prop = layer.transform?.[map[pname]] || layer[pname];
  else if (layer.properties && layer.properties[pname]) prop = layer.properties[pname];
  else if (layer.transform && layer.transform[pname]) prop = layer.transform[pname];
  return makePropRef(layer, prop, pname);
}

// 解析图层属性为立即可运算的值数组（挂 valueAtTime）
function resolvePropValue(layer, pname) {
  const transformMap = {
    position: 'position', rotation: 'rotation', scale: 'scale', opacity: 'opacity',
    anchorPoint: 'anchorPoint', anchor: 'anchorPoint',
    transform: null,
  };
  if (pname === 'transform') return { __layerProp: layer, prop: 'transform' };
  let prop = null;
  if (transformMap[pname]) prop = layer.transform?.[transformMap[pname]];
  else if (layer.transform && layer.transform[pname]) prop = layer.transform[pname];
  else if (layer.data) {
    // data 内的 AnimProperty（如 extrudeDepth）
    const d = layer.data[pname];
    if (d && d.evalKeys) prop = d;
    else if (d != null && typeof d === 'number') {
      const arr = [d];
      arr.valueAtTime = () => [d];
      return arr;
    }
  }
  return makePropRef(layer, prop, pname);
}

function makePropRef(layer, prop, pname) {
  if (!prop) {
    const z = [0, 0, 0];
    z.valueAtTime = () => [0, 0, 0];
    return z;
  }
  const t = layer.__exprTime ?? 0;
  const val = prop.evalKeys(t);
  const arr = Array.isArray(val) ? val.slice() : [val];
  arr.valueAtTime = (tt) => {
    const v = prop.evalKeys(tt);
    return Array.isArray(v) ? v.slice() : [v];
  };
  return arr;
}

function callFunc(name, args, env) {
  const a = args.map((x) => x);
  switch (name) {
    case 'linear':
      return applyRange(a, (t, tMin, tMax, v1, v2) => linearFn(t, tMin, tMax, v1, v2));
    case 'ease':
      return applyRange(a, (t, tMin, tMax, v1, v2) => easeFn(t, tMin, tMax, v1, v2));
    case 'easeIn':
      return applyRange(a, (t, tMin, tMax, v1, v2) => {
        const u = clamp((t - tMin) / (tMax - tMin || 1), 0, 1);
        return v1 + (v2 - v1) * u * u;
      });
    case 'easeOut':
      return applyRange(a, (t, tMin, tMax, v1, v2) => {
        const u = clamp((t - tMin) / (tMax - tMin || 1), 0, 1);
        return v1 + (v2 - v1) * (1 - (1 - u) * (1 - u));
      });
    case 'wiggle': {
      const freq = num(a[0]) || 2, amp = num(a[1]) || 10;
      const dims = Array.isArray(env.value) ? env.value.length : env.dims || 1;
      return wiggleVec(env.seed ?? 1, freq, amp, env.time, dims, env.index ?? 0);
    }
    case 'loopOut': {
      const mode = typeof a[0] === 'string' ? a[0] : 'cycle';
      return env.loopOut ? env.loopOut(mode) : env.value;
    }
    case 'loopIn': {
      const mode = typeof a[0] === 'string' ? a[0] : 'cycle';
      return env.loopIn ? env.loopIn(mode) : env.value;
    }
    case 'valueAtTime': {
      const t = num(a[0]);
      return env.valueAtTime ? env.valueAtTime(t) : env.value;
    }
    case 'toWorld': {
      const p = a[0];
      return env.toWorld ? env.toWorld(p) : p;
    }
    case 'fromWorld': {
      const p = a[0];
      return env.fromWorld ? env.fromWorld(p) : p;
    }
    case 'toComp': return env.toWorld ? env.toWorld(a[0]) : a[0];
    case 'fromComp': return env.fromWorld ? env.fromWorld(a[0]) : a[0];
    case 'length': {
      if (a.length === 2) {
        const dx = num(a[0]), dy = num(a[1]);
        return Math.sqrt(dx * dx + dy * dy);
      }
      const v = a[0];
      if (Array.isArray(v)) return Math.sqrt(v.reduce((s, x) => s + num(x) * num(x), 0));
      return Math.abs(num(v));
    }
    case 'normalize': {
      const v = Array.isArray(a[0]) ? a[0] : [a[0]];
      const l = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / l);
    }
    case 'dot': {
      const u = Array.isArray(a[0]) ? a[0] : [a[0]];
      const v = Array.isArray(a[1]) ? a[1] : [a[1]];
      return u.reduce((s, x, i) => s + x * (v[i] ?? 0), 0);
    }
    case 'cross': {
      const u = a[0] || [], v = a[1] || [];
      return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    }
    case 'clamp': return clamp(num(a[0]), num(a[1]), num(a[2]));
    case 'min': return Math.min(...a.map(num));
    case 'max': return Math.max(...a.map(num));
    case 'abs': return Math.abs(num(a[0]));
    case 'floor': return Math.floor(num(a[0]));
    case 'ceil': return Math.ceil(num(a[0]));
    case 'round': return Math.round(num(a[0]));
    case 'sin': return Math.sin(num(a[0]));
    case 'cos': return Math.cos(num(a[0]));
    case 'tan': return Math.tan(num(a[0]));
    case 'asin': return Math.asin(num(a[0]));
    case 'acos': return Math.acos(num(a[0]));
    case 'atan': return Math.atan(num(a[0]));
    case 'atan2': return Math.atan2(num(a[0]), num(a[1]));
    case 'sqrt': return Math.sqrt(Math.abs(num(a[0])));
    case 'pow': return Math.pow(num(a[0]), num(a[1]));
    case 'exp': return Math.exp(num(a[0]));
    case 'log': return Math.log(Math.max(1e-12, num(a[0])));
    case 'random': {
      const seedBase = env.seed ?? 1;
      const idx = env.index ?? 0;
      const t = env.time;
      // 可复现
      let h = (seedBase * 374761393 + idx * 668265263 + Math.floor(t * 1000) * 1274126177) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    case 'seedRandom': return 0;
    case 'timeToFrames': return num(a[0]) * (env.comp?.fps || 30);
    case 'framesToTime': return num(a[0]) / (env.comp?.fps || 30);
    case 'degreesToRadians': return deg2rad(num(a[0]));
    case 'radiansToDegrees': return rad2deg(num(a[0]));
    case 'color': return [num(a[0]), num(a[1]), num(a[2]), a.length > 3 ? num(a[3]) : 1];
    case 'rgbToHsl': return a[0];
    case 'hslToRgb': return a[0];
    case 'add': return binVec(a[0], a[1], (x, y) => x + y);
    case 'sub': return binVec(a[0], a[1], (x, y) => x - y);
    case 'mul': return binVec(a[0], a[1], (x, y) => x * y);
    case 'div': return binVec(a[0], a[1], (x, y) => (y === 0 ? 0 : x / y));
    case 'neg': return Array.isArray(a[0]) ? a[0].map((x) => -num(x)) : -num(a[0]);
    case 'sum': return (Array.isArray(a[0]) ? a[0] : a).reduce((s, x) => s + num(x), 0);
    case 'lookAt': return 0;
    default:
      if (typeof Math[name] === 'function') return Math[name](...a.map(num));
      return 0;
  }
}

function num(v) {
  if (Array.isArray(v)) return v.length ? num(v[0]) : 0;
  if (typeof v === 'number') return v;
  return parseFloat(v) || 0;
}

function binVec(a, b, fn) {
  const av = Array.isArray(a) ? a : [a];
  const bv = Array.isArray(b) ? b : [b];
  const n = Math.max(av.length, bv.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(fn(num(av[Math.min(i, av.length - 1)] ?? 0), num(bv[Math.min(i, bv.length - 1)] ?? 0)));
  }
  return Array.isArray(a) || Array.isArray(b) ? out : out[0];
}

function applyRange(a, fn) {
  // linear(t, tMin, tMax, v1, v2) 或 linear(t, v1, v2) 数组版
  if (a.length === 5) {
    const t = num(a[0]);
    const v1 = a[3], v2 = a[4];
    if (Array.isArray(v1) || Array.isArray(v2)) {
      const av = Array.isArray(v1) ? v1 : [v1];
      const bv = Array.isArray(v2) ? v2 : [v2];
      return av.map((x, i) => fn(t, num(a[1]), num(a[2]), num(x), num(bv[i] ?? 0)));
    }
    return fn(t, num(a[1]), num(a[2]), num(v1), num(v2));
  }
  if (a.length === 3) {
    // linear(t, v1, v2) t 被 clamp 0-1
    const t = clamp(num(a[0]), 0, 1);
    const v1 = a[1], v2 = a[2];
    if (Array.isArray(v1) || Array.isArray(v2)) {
      const av = Array.isArray(v1) ? v1 : [v1];
      const bv = Array.isArray(v2) ? v2 : [v2];
      return av.map((x, i) => fn(t, 0, 1, num(x), num(bv[i] ?? 0)));
    }
    return fn(t, 0, 1, num(v1), num(v2));
  }
  return 0;
}

// 对外入口：为属性构建求值环境
export function evalPropExpression(prop, t, context) {
  if (context.layer) context.layer.__exprTime = t;
  const env = {
    time: t,
    value: prop.evalKeys(t),
    index: context.index ?? 1,
    dims: prop.dims,
    comp: context.comp,
    layer: context.layer,
    seed: context.seed ?? 1,
    valueAtTime: (tt) => prop.evalKeys(tt),
    loopOut: (mode) => {
      const keys = prop.keys;
      if (keys.length < 2) return prop.evalKeys(t);
      const k0 = keys[0], k1 = keys[keys.length - 1];
      if (t <= k1.time) return prop.evalKeys(t);
      const span = k1.time - k0.time;
      if (span <= 0) return k1.value.slice();
      const cycleT = (t - k0.time) % span;
      if (mode === 'pingpong') {
        const phase = Math.floor((t - k0.time) / span) % 2;
        const tt = phase === 0 ? k0.time + cycleT : k1.time - cycleT;
        return prop.evalKeys(tt);
      }
      return prop.evalKeys(k0.time + cycleT);
    },
    loopIn: (mode) => {
      const keys = prop.keys;
      if (keys.length < 2) return prop.evalKeys(t);
      const k0 = keys[0], k1 = keys[keys.length - 1];
      if (t >= k0.time) return prop.evalKeys(t);
      const span = k1.time - k0.time;
      const cycleT = ((t - k0.time) % span + span) % span;
      return prop.evalKeys(k0.time + cycleT);
    },
    toWorld: (p) => {
      if (!context.layer || !context.layer._worldMatrix) return p;
      return context.layer._worldMatrix.transformPoint(Array.isArray(p) ? p : [p, 0, 0]);
    },
    fromWorld: (p) => {
      if (!context.layer || !context.layer._worldMatrixInv) return p;
      return context.layer._worldMatrixInv.transformPoint(Array.isArray(p) ? p : [p, 0, 0]);
    },
  };
  return evalExpression(prop.expression, env);
}
