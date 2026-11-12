// Nest 虚拟机：执行 Nest 可执行文件（由系统内的编译器程序生成）。
// 宿主只提供“执行程序的环境”：按指令计量执行、在系统调用处陷入、
// 通过 exec 原语让内核程序在自己的额度内运行它管理的上下文。
// 上下文（变量、运行位置、等待状态、随机状态、未付清的工作）可完整序列化。

export const OP = {
  HALT: 0, CONST: 1, NIL: 2, TRUE: 3, FALSE: 4, LOCAL: 5, SETLOCAL: 6, UPVAL: 7, SETUPVAL: 8,
  GLOBAL: 9, SETGLOBAL: 10, POP: 11, DUP: 12, JMP: 13, JF: 14, JT: 15, JFK: 16, JTK: 17,
  CALL: 18, TCALL: 19, RET: 20, CLOSURE: 21, PRIM: 22, SYS: 23,
  ADD: 24, SUB: 25, MUL: 26, DIV: 27, MOD: 28, LT: 29, GT: 30, LE: 31, GE: 32, EQ: 33, NE: 34,
  NOT: 35, NEG: 36, GET: 37, PUT: 38, LIST: 39, DICT: 40, TRY: 41, ENDTRY: 42, THROW: 43, APPLY: 44,
};
// 每条指令的操作数个数
export const OPARGS = [0,1,0,0,0,1,1,2,2,1,1,0,0,1,1,1,1,1,1,1,0,1,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0];

export class Env { constructor(n, p) { this.v = new Array(n); for (let i = 0; i < n; i++) this.v[i] = null; this.p = p; } }
export class Closure { constructor(prog, fi, env) { this.prog = prog; this.fi = fi; this.env = env; } }

export class NestError extends Error { constructor(value) { super(typeof value === 'string' ? value : (value && value.message) || 'error'); this.value = value; } }

const isDict = (v) => v !== null && typeof v === 'object' && v.constructor === Object;
export const truthy = (v) => v !== null && v !== false && v !== undefined;

export function typeOf(v) {
  if (v === null || v === undefined) return 'nil';
  const t = typeof v;
  if (t === 'number') return 'num';
  if (t === 'string') return 'str';
  if (t === 'boolean') return 'bool';
  if (Array.isArray(v)) return 'list';
  if (v instanceof Closure) return 'fn';
  if (v instanceof Ctx) return 'ctx';
  if (isDict(v)) return 'dict';
  return 'other';
}

// ---------- 程序装载 ----------
let progSeq = 1;
export class Prog {
  constructor(exe) {
    if (!exe || exe.format !== 'nest-exe') throw new NestError('不是 Nest 可执行文件');
    this.exe = exe; this.pid = progSeq++;
    this.name = exe.name || 'program';
    this.funcs = exe.funcs.map((f) => ({
      n: f.n, p: f.p, l: f.l, r: !!f.r, c: Int32Array.from(f.c), k: f.k, ln: f.ln || [],
      prims: null,
    }));
    for (const f of this.funcs) {
      // 解析 PRIM 指令引用的原语名
      f.prims = f.k.map((k) => (typeof k === 'string' && PRIMS[k]) ? PRIMS[k] : null);
    }
    this.size = (exe.funcs.reduce((s, f) => s + f.c.length * 4 + 32, 0)) + 256;
  }
  lineAt(fi, pc) {
    const ln = this.funcs[fi].ln; let line = 0;
    for (let i = 0; i < ln.length; i += 2) { if (ln[i] <= pc) line = ln[i + 1]; else break; }
    return line;
  }
}

// ---------- 上下文 ----------
let ctxSeq = 1;
export class Ctx {
  constructor(prog, opts = {}) {
    this.id = ctxSeq++;
    this.prog = prog;
    this.g = {};
    this.stack = [];
    this.frames = [];
    this.handlers = [];
    this.state = 'ready'; // ready | trap | done | error | dead
    this.trap = null; this.result = null; this.error = null; this.pendingThrow = null;
    this.units = 0; this.own = 0; this.inner = 0; this.prepaid = 0; this.prepaidFor = 0;
    this.memOwn = 0; this.memTotal = 0; this.memLimit = opts.mem || 64 * 1024 * 1024; this.allocSince = 0;
    this.rng = (opts.seed >>> 0) || 0x2545F491;
    this.g.ARGS = opts.args === undefined ? null : opts.args;
    if (prog) {
      const f = prog.funcs[0];
      this.frames.push({ fi: 0, pc: 0, env: new Env(f.l, null), sp: 0 });
      this.memOwn = this.memTotal = prog.size;
    }
  }
  where() {
    const fr = this.frames[this.frames.length - 1];
    if (!fr || !this.prog) return '';
    const f = this.prog.funcs[fr.fi];
    return `${f.n}:${this.prog.lineAt(fr.fi, Math.max(0, fr.pc - 1))}`;
  }
}

function errMsg(v) { return typeof v === 'string' ? v : toStr(v); }

// ---------- 主执行循环 ----------
// 执行 ctx 至多 budget 个计量单位；返回实际消耗。结束时 ctx.state 表示原因。
export function run(ctx, budget) {
  if (ctx.state !== 'ready') return 0;
  let used = 0;
  const st = ctx.stack;
  let fr = ctx.frames[ctx.frames.length - 1];
  let prog = ctx.prog;
  let fn = prog.funcs[fr.fi];
  let code = fn.c, K = fn.k, pc = fr.pc, env = fr.env;
  const startInner = ctx.inner;

  const raise = (val) => {
    // 抛出 Nest 异常：寻找处理器
    fr.pc = pc;
    if (ctx.handlers.length) {
      const h = ctx.handlers.pop();
      ctx.frames.length = h.fd;
      st.length = h.sp;
      fr = ctx.frames[ctx.frames.length - 1];
      prog = ctx.prog; fn = prog.funcs[fr.fi]; code = fn.c; K = fn.k; env = fr.env; pc = h.pc;
      st.push(val);
      return true;
    }
    ctx.state = 'error';
    ctx.error = `${errMsg(val)}（位置 ${ctx.where()}）`;
    return false;
  };

  if (ctx.pendingThrow !== null) {
    const v = ctx.pendingThrow; ctx.pendingThrow = null;
    if (!raise(v)) { ctx.own += used; ctx.units += used; return used; }
  }

  for (;;) {
    if (used >= budget) { fr.pc = pc; break; }
    used++;
    try {
      const op = code[pc++];
      switch (op) {
        case 1: st.push(K[code[pc++]]); break;
        case 2: st.push(null); break;
        case 3: st.push(true); break;
        case 4: st.push(false); break;
        case 5: st.push(env.v[code[pc++]]); break;
        case 6: env.v[code[pc++]] = st.pop(); break;
        case 7: { let d = code[pc++]; let e = env; while (d-- > 0) e = e.p; st.push(e.v[code[pc++]]); break; }
        case 8: { let d = code[pc++]; let e = env; while (d-- > 0) e = e.p; e.v[code[pc++]] = st.pop(); break; }
        case 9: { const name = K[code[pc++]]; const v = ctx.g[name]; if (v === undefined) throw new NestError(`未定义的名字: ${name}`); st.push(v); break; }
        case 10: { const name = K[code[pc++]]; ctx.g[name] = st.pop(); break; }
        case 11: st.pop(); break;
        case 12: st.push(st[st.length - 1]); break;
        case 13: pc = code[pc]; break;
        case 14: { const a = code[pc++]; const v = st.pop(); if (v === null || v === false || v === undefined) pc = a; break; }
        case 15: { const a = code[pc++]; const v = st.pop(); if (!(v === null || v === false || v === undefined)) pc = a; break; }
        case 16: { const a = code[pc++]; const v = st[st.length - 1]; if (v === null || v === false || v === undefined) pc = a; else st.pop(); break; }
        case 17: { const a = code[pc++]; const v = st[st.length - 1]; if (!(v === null || v === false || v === undefined)) pc = a; else st.pop(); break; }
        case 18: case 19: case 44: {
          let n, f, args = null;
          if (op === 44) { const lst = st.pop(); f = st.pop(); if (!Array.isArray(lst)) throw new NestError('apply 需要列表参数'); args = lst; n = lst.length; }
          else { n = code[pc++]; f = st[st.length - n - 1]; }
          if (!(f instanceof Closure)) throw new NestError(`调用的不是函数: ${toStr(f)}`);
          const tf = f.prog.funcs[f.fi];
          const ne = new Env(tf.l, f.env);
          const np = tf.p;
          if (args === null) {
            const base = st.length - n;
            if (tf.r) {
              for (let i = 0; i < np; i++) ne.v[i] = i < n ? st[base + i] : null;
              ne.v[np] = n > np ? st.slice(base + np) : [];
            } else {
              if (n > np) throw new NestError(`${tf.n} 的参数过多（需要 ${np} 个，得到 ${n} 个）`);
              for (let i = 0; i < n; i++) ne.v[i] = st[base + i];
            }
            st.length = base - 1;
          } else {
            if (tf.r) { for (let i = 0; i < np; i++) ne.v[i] = i < n ? args[i] : null; ne.v[np] = n > np ? args.slice(np) : []; }
            else { if (n > np) throw new NestError(`${tf.n} 的参数过多`); for (let i = 0; i < n; i++) ne.v[i] = args[i]; }
          }
          if (op === 19) {
            // 尾调用：替换当前帧
            const fd = ctx.frames.length;
            while (ctx.handlers.length && ctx.handlers[ctx.handlers.length - 1].fd >= fd) ctx.handlers.pop();
            st.length = fr.sp;
            fr.fi = f.fi; fr.env = ne; fr.pc = 0;
            if (prog !== f.prog) { ctx.prog = prog = f.prog; }
          } else {
            fr.pc = pc;
            fr = { fi: f.fi, pc: 0, env: ne, sp: st.length };
            if (prog !== f.prog) { ctx.prog = prog = f.prog; }
            ctx.frames.push(fr);
            if (ctx.frames.length > 4000) throw new NestError('调用层次过深（栈溢出）');
          }
          fn = prog.funcs[fr.fi]; code = fn.c; K = fn.k; env = ne; pc = 0;
          ctx.allocSince += 16 + tf.l * 8;
          break;
        }
        case 20: {
          const v = st.pop();
          const fd = ctx.frames.length;
          while (ctx.handlers.length && ctx.handlers[ctx.handlers.length - 1].fd >= fd) ctx.handlers.pop();
          st.length = fr.sp;
          ctx.frames.pop();
          if (ctx.frames.length === 0) {
            ctx.state = 'done'; ctx.result = v === undefined ? null : v;
            ctx.own += used - (ctx.inner - startInner); ctx.units += used; return used;
          }
          fr = ctx.frames[ctx.frames.length - 1];
          fn = prog.funcs[fr.fi]; code = fn.c; K = fn.k; env = fr.env; pc = fr.pc;
          st.push(v);
          break;
        }
        case 21: st.push(new Closure(prog, code[pc++], env)); ctx.allocSince += 32; break;
        case 22: {
          const k = code[pc++]; const n = code[pc++];
          const p = fn.prims[k];
          if (!p) throw new NestError(`未知原语: ${K[k]}`);
          const base = st.length - n;
          const args = st.slice(base);
          if (p.cost) {
            const c = p.cost(args, ctx);
            if (c > 0) {
              const need = c - ctx.prepaid;
              const left = budget - used;
              if (need > left) {
                // 预算不足：保留已付进度，下次从此继续
                ctx.prepaid += left; ctx.prepaidFor = c; used += left;
                pc -= 3; fr.pc = pc;
                ctx.own += used - (ctx.inner - startInner); ctx.units += used;
                return used;
              }
              used += need; ctx.prepaid = 0; ctx.prepaidFor = 0;
            }
          }
          st.length = base;
          if (p.exec) {
            // 嵌套执行：被管理上下文消耗的单位计入当前上下文
            fr.pc = pc;
            const r = p.exec(ctx, args, budget - used, used);
            used += r.used; ctx.inner += r.used;
            st.push(r.value);
          } else {
            const v = p.fn(args, ctx);
            st.push(v === undefined ? null : v);
          }
          break;
        }
        case 23: {
          const n = code[pc++];
          const args = st.splice(st.length - n, n);
          fr.pc = pc;
          ctx.state = 'trap'; ctx.trap = args;
          ctx.own += used - (ctx.inner - startInner); ctx.units += used;
          return used;
        }
        case 24: { const b = st.pop(); const a = st.pop(); if (typeof a === 'number' && typeof b === 'number') st.push(a + b); else if (typeof a === 'string' || typeof b === 'string') { const s = toStr(a) + toStr(b); ctx.allocSince += s.length * 2; st.push(s); } else throw new NestError(`无法相加: ${toStr(a)} + ${toStr(b)}`); break; }
        case 25: { const b = st.pop(); const a = st.pop(); if (typeof a !== 'number' || typeof b !== 'number') throw new NestError(`减法需要数字: ${toStr(a)} - ${toStr(b)}`); st.push(a - b); break; }
        case 26: { const b = st.pop(); const a = st.pop(); if (typeof a !== 'number' || typeof b !== 'number') throw new NestError(`乘法需要数字: ${toStr(a)} * ${toStr(b)}`); st.push(a * b); break; }
        case 27: { const b = st.pop(); const a = st.pop(); if (typeof a !== 'number' || typeof b !== 'number') throw new NestError('除法需要数字'); if (b === 0) throw new NestError('除以零'); st.push(a / b); break; }
        case 28: { const b = st.pop(); const a = st.pop(); if (typeof a !== 'number' || typeof b !== 'number') throw new NestError('取余需要数字'); if (b === 0) throw new NestError('除以零'); st.push(((a % b) + b) % b); break; }
        case 29: { const b = st.pop(); const a = st.pop(); st.push(cmp(a, b) < 0); break; }
        case 30: { const b = st.pop(); const a = st.pop(); st.push(cmp(a, b) > 0); break; }
        case 31: { const b = st.pop(); const a = st.pop(); st.push(cmp(a, b) <= 0); break; }
        case 32: { const b = st.pop(); const a = st.pop(); st.push(cmp(a, b) >= 0); break; }
        case 33: { const b = st.pop(); const a = st.pop(); st.push(a === b || (a == null && b == null)); break; }
        case 34: { const b = st.pop(); const a = st.pop(); st.push(!(a === b || (a == null && b == null))); break; }
        case 35: { const v = st.pop(); st.push(v === null || v === false || v === undefined); break; }
        case 36: { const v = st.pop(); if (typeof v !== 'number') throw new NestError('取负需要数字'); st.push(-v); break; }
        case 37: { const k = st.pop(); const o = st.pop(); st.push(getv(o, k)); break; }
        case 38: { const v = st.pop(); const k = st.pop(); const o = st.pop(); putv(o, k, v, ctx); st.push(v); break; }
        case 39: { const n = code[pc++]; const l = st.splice(st.length - n, n); ctx.allocSince += 16 + n * 8; st.push(l); break; }
        case 40: {
          const n = code[pc++]; const d = {}; const base = st.length - 2 * n;
          for (let i = 0; i < n; i++) { const key = st[base + 2 * i]; if (typeof key !== 'string') throw new NestError('字典的键必须是字符串'); setKey(d, key, st[base + 2 * i + 1]); }
          st.length = base; ctx.allocSince += 32 + n * 24; st.push(d); break;
        }
        case 41: ctx.handlers.push({ fd: ctx.frames.length, sp: st.length, pc: code[pc++] }); break;
        case 42: ctx.handlers.pop(); break;
        case 43: { const v = st.pop(); throw new NestError(v); }
        case 0: fr.pc = pc - 1; ctx.state = 'done'; ctx.own += used - (ctx.inner - startInner); ctx.units += used; return used;
        default: throw new NestError(`非法指令 ${op} @${pc - 1}`);
      }
    } catch (e) {
      let val;
      if (e instanceof NestError) val = e.value;
      else if (e instanceof RangeError) val = '宿主栈溢出（递归过深）';
      else val = `内部错误: ${e && e.message}`;
      if (!raise(val)) break;
    }
    if (ctx.allocSince > 262144) {
      measure(ctx);
      if (ctx.memOwn > ctx.memLimit) {
        const msg = `内存配额不足：已用 ${fmtBytes(ctx.memOwn)}，配额 ${fmtBytes(ctx.memLimit)}`;
        if (!raise(msg)) break;
      }
    }
  }
  ctx.own += used - (ctx.inner - startInner);
  ctx.units += used;
  return used;
}

function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB'; }

function cmp(a, b) {
  const ta = typeof a, tb = typeof b;
  if (ta === 'number' && tb === 'number') return a < b ? -1 : a > b ? 1 : (a === b ? 0 : NaN);
  if (ta === 'string' && tb === 'string') return a < b ? -1 : a > b ? 1 : 0;
  throw new NestError(`无法比较: ${toStr(a)} 与 ${toStr(b)}`);
}

export function getv(o, k) {
  if (o === null || o === undefined) return null;
  if (Array.isArray(o)) { if (typeof k !== 'number') throw new NestError(`列表下标必须是数字: ${toStr(k)}`); const v = o[k < 0 ? o.length + k : k]; return v === undefined ? null : v; }
  if (typeof o === 'string') { if (typeof k !== 'number') throw new NestError('字符串下标必须是数字'); const c = o[k]; return c === undefined ? null : c; }
  if (typeof o === 'object' && o.constructor === Object) {
    if (typeof k !== 'string') k = String(k);
    const v = o[k];
    if (v === undefined || typeof v === 'function') return null;
    if (k === '__proto__') return Object.prototype.hasOwnProperty.call(o, k) ? v : null;
    return v;
  }
  throw new NestError(`无法从 ${typeOf(o)} 取值`);
}
function setKey(d, k, v) { if (k === '__proto__') Object.defineProperty(d, k, { value: v, enumerable: true, writable: true, configurable: true }); else d[k] = v; }
export function putv(o, k, v, ctx) {
  if (Array.isArray(o)) {
    if (typeof k !== 'number' || k < 0 || k > o.length || (k | 0) !== k) throw new NestError(`列表下标越界: ${toStr(k)}`);
    if (k === o.length && ctx) ctx.allocSince += 8;
    o[k] = v; return;
  }
  if (o !== null && typeof o === 'object' && o.constructor === Object) {
    if (typeof k !== 'string') k = String(k);
    if (ctx && !(k in o)) ctx.allocSince += 24 + k.length * 2;
    setKey(o, k, v); return;
  }
  throw new NestError(`无法向 ${typeOf(o)} 写入`);
}

// ---------- 显示与转换 ----------
export function toStr(v, depth = 0) {
  if (v === null || v === undefined) return 'nil';
  const t = typeof v;
  if (t === 'string') return depth ? JSON.stringify(v) : v;
  if (t === 'number') return fmtNum(v);
  if (t === 'boolean') return v ? 'true' : 'false';
  if (depth > 4) return '…';
  if (Array.isArray(v)) { const parts = v.slice(0, 50).map((x) => toStr(x, depth + 1)); if (v.length > 50) parts.push(`…共${v.length}项`); return '[' + parts.join(' ') + ']'; }
  if (v instanceof Closure) return `<函数 ${v.prog.funcs[v.fi].n}>`;
  if (v instanceof Ctx) return `<上下文 #${v.id}>`;
  if (isDict(v)) { const ks = Object.keys(v); const parts = ks.slice(0, 30).map((k) => `${k}: ${toStr(v[k], depth + 1)}`); if (ks.length > 30) parts.push('…'); return '{' + parts.join(', ') + '}'; }
  return String(v);
}
function fmtNum(n) {
  if (Number.isInteger(n)) return String(n);
  if (!Number.isFinite(n)) return String(n);
  const s = n.toPrecision(12);
  return String(parseFloat(s));
}

// ---------- 内存度量 ----------
export function measure(ctx) {
  const seen = new Set();
  let own = 0, nested = 0;
  const stack = [ctx.g, ctx.stack, ctx.trap, ctx.result];
  for (const fr of ctx.frames) stack.push(fr.env);
  if (ctx.prog) { own += ctx.prog.size; seen.add(ctx.prog); }
  while (stack.length) {
    const v = stack.pop();
    if (v === null || v === undefined) continue;
    const t = typeof v;
    if (t === 'number' || t === 'boolean') { own += 8; continue; }
    if (t === 'string') { own += 16 + v.length * 2; continue; }
    if (t !== 'object') continue;
    if (seen.has(v)) continue;
    seen.add(v);
    if (v instanceof Ctx) { if (v !== ctx) nested += v.memTotal; continue; }
    if (Array.isArray(v)) { own += 16 + v.length * 8; for (let i = 0; i < v.length; i++) { const x = v[i]; if (x !== null && typeof x === 'object') stack.push(x); else if (typeof x === 'string') own += 16 + x.length * 2; } continue; }
    if (v instanceof Env) { own += 16 + v.v.length * 8; stack.push(v.v); if (v.p) stack.push(v.p); continue; }
    if (v instanceof Closure) { own += 32; stack.push(v.env); if (!seen.has(v.prog)) { seen.add(v.prog); own += v.prog.size; } continue; }
    if (v instanceof Prog) { own += v.size; continue; }
    if (isDict(v)) { for (const k in v) { own += 24 + k.length * 2; const x = v[k]; if (x !== null && typeof x === 'object') stack.push(x); else if (typeof x === 'string') own += 16 + x.length * 2; else own += 8; } own += 32; continue; }
  }
  ctx.memOwn = own; ctx.memTotal = own + nested; ctx.allocSince = 0;
  return ctx.memTotal;
}

// 估计数据规模（字节），用于按规模计费
export function sizeOf(v, limit = Infinity) {
  let n = 0; const stack = [v]; const seen = new Set();
  while (stack.length) {
    const x = stack.pop();
    if (x === null || x === undefined) { n += 4; continue; }
    const t = typeof x;
    if (t === 'number' || t === 'boolean') { n += 8; continue; }
    if (t === 'string') { n += 8 + x.length; continue; }
    if (seen.has(x)) continue; seen.add(x);
    if (Array.isArray(x)) { n += 8; for (let i = 0; i < x.length; i++) { const y = x[i]; if (typeof y === 'number') n += 8; else if (typeof y === 'string') n += 8 + y.length; else stack.push(y); } }
    else if (isDict(x)) { n += 16; for (const k in x) { n += 8 + k.length; const y = x[k]; if (typeof y === 'number') n += 8; else if (typeof y === 'string') n += 8 + y.length; else stack.push(y); } }
    else if (x instanceof Ctx) n += x.memTotal;
    else n += 32;
    if (n > limit) return n;
  }
  return n;
}

export function deepCopy(v) {
  if (v === null || typeof v !== 'object') return v === undefined ? null : v;
  if (Array.isArray(v)) { const r = new Array(v.length); for (let i = 0; i < v.length; i++) r[i] = deepCopy(v[i]); return r; }
  if (isDict(v)) { const r = {}; for (const k in v) setKey(r, k, deepCopy(v[k])); return r; }
  if (v instanceof Closure) throw new NestError('函数不能作为数据复制');
  if (v instanceof Ctx) throw new NestError('上下文不能作为数据复制');
  return null;
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return (a == null && b == null);
  if (Array.isArray(a)) { if (!Array.isArray(b) || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false; return true; }
  if (isDict(a) && isDict(b)) { const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length) return false; for (const k of ka) if (!deepEqual(a[k], b[k])) return false; return true; }
  return false;
}

// 纯数据 JSON（字典/列表/数字/字符串）
export function toJSON(v) {
  return JSON.stringify(v, (k, x) => {
    if (x instanceof Closure || x instanceof Ctx) return null;
    if (typeof x === 'number' && !Number.isFinite(x)) return null;
    return x;
  });
}

export function hashStr(s) {
  // FNV-1a 64 位（两路 32 位）
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 ^= c; h1 = Math.imul(h1, 16777619);
    h2 ^= c + i; h2 = Math.imul(h2, 2246822519) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

function rand(ctx) {
  // xorshift32，状态属于上下文，随快照保存
  let x = ctx.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; ctx.rng = x >>> 0;
  return (x >>> 0) / 4294967296;
}

// ---------- 原语 ----------
const num = (x, name) => { if (typeof x !== 'number') throw new NestError(`${name} 需要数字，得到 ${toStr(x)}`); return x; };
const strA = (x, name) => { if (typeof x !== 'string') throw new NestError(`${name} 需要字符串，得到 ${toStr(x)}`); return x; };
const listA = (x, name) => { if (!Array.isArray(x)) throw new NestError(`${name} 需要列表，得到 ${toStr(x)}`); return x; };
const lenOf = (x) => (typeof x === 'string' || Array.isArray(x)) ? x.length : 0;
const by = (d) => (a) => Math.ceil(lenOf(a[0]) / d);

export const PRIMS = {};
function def(name, fn, cost) { PRIMS[name] = { name, fn, cost }; }

def('len', ([x]) => x == null ? 0 : (typeof x === 'string' || Array.isArray(x)) ? x.length : isDict(x) ? Object.keys(x).length : 0);
def('nth', ([l, i]) => getv(l, i));
def('first', ([l]) => getv(l, 0));
def('last', ([l]) => (Array.isArray(l) || typeof l === 'string') && l.length ? l[l.length - 1] : null);
def('rest', ([l]) => listA(l, 'rest').slice(1), by(8));
def('push!', ([l, v], c) => { listA(l, 'push!').push(v); c.allocSince += 8; return l; });
def('pop!', ([l]) => { const v = listA(l, 'pop!').pop(); return v === undefined ? null : v; });
def('shift!', ([l]) => { const v = listA(l, 'shift!').shift(); return v === undefined ? null : v; }, by(64));
def('unshift!', ([l, v], c) => { listA(l, 'unshift!').unshift(v); c.allocSince += 8; return l; }, by(64));
def('insert!', ([l, i, v], c) => { listA(l, 'insert!').splice(num(i, 'insert!'), 0, v); c.allocSince += 8; return l; }, by(64));
def('remove-at!', ([l, i]) => { const r = listA(l, 'remove-at!').splice(num(i, 'remove-at!'), 1); return r.length ? r[0] : null; }, by(64));
def('slice', ([l, a, b], c) => { if (typeof l === 'string') return l.slice(a == null ? 0 : a, b == null ? undefined : b); const r = listA(l, 'slice').slice(a == null ? 0 : a, b == null ? undefined : b); c.allocSince += 16 + r.length * 8; return r; }, by(16));
def('concat', (a, c) => { const r = []; for (const l of a) if (Array.isArray(l)) for (const x of l) r.push(x); else if (l != null) r.push(l); c.allocSince += 16 + r.length * 8; return r; }, (a) => Math.ceil(a.reduce((s, l) => s + lenOf(l), 0) / 16));
def('reverse', ([l]) => typeof l === 'string' ? [...l].reverse().join('') : listA(l, 'reverse').slice().reverse(), by(16));
def('index-of', ([l, v, s]) => { if (typeof l === 'string') return l.indexOf(String(v), s || 0); if (Array.isArray(l)) { for (let i = s || 0; i < l.length; i++) if (l[i] === v) return i; return -1; } return -1; }, by(16));
def('contains?', ([l, v]) => { if (typeof l === 'string') return l.includes(String(v)); if (Array.isArray(l)) return l.includes(v); if (isDict(l)) return getv(l, v) !== null; return false; }, by(16));
def('keys', ([d], c) => { if (!isDict(d)) return []; const r = Object.keys(d); c.allocSince += 16 + r.length * 16; return r; }, ([d]) => isDict(d) ? Math.ceil(Object.keys(d).length / 8) : 0);
def('vals', ([d]) => isDict(d) ? Object.values(d) : [], ([d]) => isDict(d) ? Math.ceil(Object.keys(d).length / 8) : 0);
def('has?', ([d, k]) => isDict(d) ? Object.prototype.hasOwnProperty.call(d, String(k)) : false);
def('del!', ([d, k]) => { if (isDict(d)) delete d[String(k)]; return d; });
def('copy', ([v], c) => { const r = deepCopy(v); c.allocSince += sizeOf(r); return r; }, ([v]) => Math.ceil(sizeOf(v) / 32));
def('equal?', ([a, b]) => deepEqual(a, b), ([a]) => Math.ceil(sizeOf(a) / 64));
def('range', ([a, b, s]) => { if (b == null) { b = a; a = 0; } s = s || 1; const r = []; for (let i = a; s > 0 ? i < b : i > b; i += s) r.push(i); return r; }, ([a, b]) => Math.ceil(Math.abs((b == null ? a : b - a) || 0) / 8));
def('fill-list', ([n, v]) => { const r = new Array(Math.max(0, n | 0)); for (let i = 0; i < r.length; i++) r[i] = v === undefined ? null : v; return r; }, ([n]) => Math.ceil((n || 0) / 16));
def('sort', ([l, desc]) => { const r = listA(l, 'sort').slice(); r.sort((a, b) => cmp(a, b)); if (desc) r.reverse(); return r; }, ([l]) => { const n = lenOf(l); return Math.ceil(n * Math.log2(n + 2) / 4); });
def('sort-by', ([l, key, desc]) => { const r = listA(l, 'sort-by').slice(); r.sort((a, b) => { const x = getv(a, key), y = getv(b, key); if (x == null && y == null) return 0; if (x == null) return -1; if (y == null) return 1; return cmp(x, y); }); if (desc) r.reverse(); return r; }, ([l]) => { const n = lenOf(l); return Math.ceil(n * Math.log2(n + 2) / 3); });
def('join', ([l, sep]) => listA(l, 'join').map((x) => toStr(x)).join(sep == null ? '' : toStr(sep)), ([l]) => Math.ceil(lenOf(l) / 4));
def('split', ([s, sep]) => strA(s, 'split').split(sep == null ? '' : String(sep)), by(32));
def('str', (a, c) => { let s = ''; for (const x of a) s += toStr(x); c.allocSince += s.length * 2; return s; }, (a) => { let n = 0; for (const x of a) if (typeof x === 'string') n += x.length; return Math.ceil(n / 64); });
def('substr', ([s, a, b]) => strA(s, 'substr').substring(a || 0, b == null ? undefined : b), ([s, a, b]) => Math.ceil(((b == null ? lenOf(s) : b) - (a || 0)) / 64));
def('char-at', ([s, i]) => { const c = strA(s, 'char-at')[i]; return c === undefined ? null : c; });
def('char-code', ([s, i]) => { const c = strA(s, 'char-code').charCodeAt(i || 0); return Number.isNaN(c) ? null : c; });
def('from-code', (a) => String.fromCharCode(...a.map((x) => num(x, 'from-code'))));
def('upper', ([s]) => strA(s, 'upper').toUpperCase(), by(64));
def('lower', ([s]) => strA(s, 'lower').toLowerCase(), by(64));
def('trim', ([s]) => strA(s, 'trim').trim(), by(64));
def('starts-with?', ([s, p]) => typeof s === 'string' && s.startsWith(String(p)));
def('ends-with?', ([s, p]) => typeof s === 'string' && s.endsWith(String(p)));
def('replace', ([s, a, b]) => strA(s, 'replace').split(String(a)).join(toStr(b)), by(32));
def('pad-left', ([s, n, ch]) => toStr(s).padStart(n, ch == null ? ' ' : String(ch)));
def('pad-right', ([s, n, ch]) => toStr(s).padEnd(n, ch == null ? ' ' : String(ch)));
def('fmt', ([x, d]) => typeof x === 'number' ? x.toFixed(d == null ? 2 : Math.max(0, Math.min(10, d))) : toStr(x));
def('to-str', ([v]) => toStr(v), ([v]) => Math.ceil(sizeOf(v, 1e6) / 64));
def('to-num', ([s]) => { if (typeof s === 'number') return s; if (typeof s !== 'string' || s.trim() === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; });
def('parse-json', ([s], c) => { try { const v = JSON.parse(strA(s, 'parse-json')); c.allocSince += s.length * 3; return v; } catch (e) { throw new NestError(`JSON 格式错误: ${e.message}`); } }, ([s]) => Math.ceil(lenOf(s) / 24));
def('to-json', ([v]) => toJSON(v), ([v]) => Math.ceil(sizeOf(v) / 24));
def('hash', ([s]) => hashStr(toStr(s)), ([s]) => Math.ceil(lenOf(s) / 128));
def('num?', ([v]) => typeof v === 'number');
def('str?', ([v]) => typeof v === 'string');
def('list?', ([v]) => Array.isArray(v));
def('dict?', ([v]) => isDict(v));
def('fn?', ([v]) => v instanceof Closure);
def('nil?', ([v]) => v === null || v === undefined);
def('bool?', ([v]) => typeof v === 'boolean');
def('ctx?', ([v]) => v instanceof Ctx);
def('type-of', ([v]) => typeOf(v));
for (const m of ['floor', 'ceil', 'round', 'abs', 'sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp', 'log', 'sign', 'trunc']) def(m, ([x]) => Math[m](num(x, m)));
def('atan2', ([y, x]) => Math.atan2(num(y, 'atan2'), num(x, 'atan2')));
def('pow', ([x, y]) => Math.pow(num(x, 'pow'), num(y, 'pow')));
def('hypot', (a) => Math.hypot(...a));
def('min', (a) => { const l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; let m = Infinity; for (const x of l) m = Math.min(m, num(x, 'min')); return l.length ? m : null; });
def('max', (a) => { const l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; let m = -Infinity; for (const x of l) m = Math.max(m, num(x, 'max')); return l.length ? m : null; });
def('clamp', ([x, a, b]) => Math.min(b, Math.max(a, num(x, 'clamp'))));
def('lerp', ([a, b, t]) => a + (b - a) * t);
def('int', ([x]) => typeof x === 'number' ? Math.trunc(x) : null);
def('finite?', ([x]) => typeof x === 'number' && Number.isFinite(x));
def('rand', (a, c) => rand(c));
def('rand-int', ([n], c) => Math.floor(rand(c) * num(n, 'rand-int')));
def('rand-seed!', ([s], c) => { c.rng = (num(s, 'rand-seed!') >>> 0) || 1; return null; });
def('size-of', ([v]) => sizeOf(v), ([v]) => Math.ceil(sizeOf(v, 1e7) / 256));
def('error?', ([v]) => isDict(v) && v.error !== undefined);

// ---- 内核用原语：管理被调度的上下文 ----
const ctxA = (c, name) => { if (!(c instanceof Ctx)) throw new NestError(`${name} 需要上下文`); return c; };
PRIMS.exec = {
  name: 'exec',
  exec(ctx, [c, n], left) {
    ctxA(c, 'exec');
    if (c === ctx) throw new NestError('上下文不能执行自身');
    const lim = Math.max(0, Math.min(typeof n === 'number' ? n : 0, left));
    if (c.state !== 'ready') return { used: 0, value: execResult(c, 0) };
    if (lim <= 0) return { used: 0, value: ['quantum', 0] };
    const used = run(c, lim);
    return { used, value: execResult(c, used) };
  },
};
function execResult(c, used) {
  switch (c.state) {
    case 'ready': return ['quantum', used];
    case 'trap': return ['sys', used, c.trap];
    case 'done': return ['done', used, c.result];
    case 'error': return ['error', used, c.error];
    default: return [c.state, used];
  }
}
PRIMS['units-now'] = { name: 'units-now', exec(ctx, args, left, usedSoFar) { return { used: 0, value: ctx.units + usedSoFar }; } };
def('ctx-new', ([exe, opts], c) => {
  let prog;
  if (exe instanceof Prog) prog = exe;
  else prog = new Prog(typeof exe === 'string' ? JSON.parse(exe) : exe);
  const o = isDict(opts) ? opts : {};
  const nc = new Ctx(prog, { args: o.args === undefined ? null : deepCopy(o.args), mem: o.mem || undefined, seed: o.seed });
  return nc;
}, ([exe]) => Math.ceil((typeof exe === 'string' ? exe.length : sizeOf(exe)) / 48));
def('ctx-resume', ([c, v]) => { ctxA(c, 'ctx-resume'); if (c.state === 'trap') { c.stack.push(v === undefined ? null : v); c.state = 'ready'; c.trap = null; return true; } return false; });
def('ctx-throw', ([c, v]) => { ctxA(c, 'ctx-throw'); if (c.state === 'trap') { c.pendingThrow = v; c.state = 'ready'; c.trap = null; return true; } return false; });
def('ctx-kill', ([c]) => { ctxA(c, 'ctx-kill'); c.state = 'dead'; c.stack.length = 0; c.frames.length = 0; c.g = {}; c.memOwn = c.memTotal = 0; return true; });
def('ctx-info', ([c]) => {
  ctxA(c, 'ctx-info');
  return { state: c.state, units: c.units, own: c.own, inner: c.inner, mem: c.memTotal, memOwn: c.memOwn, memLimit: c.memLimit, error: c.error, where: c.where(), prepaid: c.prepaid, pending: c.prepaidFor ? c.prepaidFor - c.prepaid : 0, trap: c.state === 'trap' ? c.trap[0] : null, name: c.prog ? c.prog.name : '' };
});
def('ctx-mem', ([c]) => measure(ctxA(c, 'ctx-mem')), ([c]) => c instanceof Ctx ? Math.ceil(c.memOwn / 4096) : 0);
def('ctx-limit!', ([c, n]) => { ctxA(c, 'ctx-limit!').memLimit = num(n, 'ctx-limit!'); return true; });
def('ctx-global', ([c, name]) => { const v = ctxA(c, 'ctx-global').g[name]; return v === undefined ? null : v; });
def('ctx-serialize', ([c]) => serialize(ctxA(c, 'ctx-serialize')), ([c]) => c instanceof Ctx ? Math.ceil(c.memTotal / 32) : 0);
def('ctx-deserialize', ([s]) => { const v = deserialize(strA(s, 'ctx-deserialize')); if (!(v instanceof Ctx)) throw new NestError('快照数据不是上下文'); return v; }, ([s]) => Math.ceil(lenOf(s) / 32));
def('ctx-remap', ([c, map]) => { remapStrings(ctxA(c, 'ctx-remap'), map); return c; }, ([c]) => c instanceof Ctx ? Math.ceil(c.memTotal / 64) : 0);
def('remap-data', ([v, map]) => remapValue(v, map), ([v]) => Math.ceil(sizeOf(v) / 64));
def('self-mem', (a, c) => measure(c));

// ---------- 序列化（快照） ----------
export function serialize(root) {
  const ids = new Map(); const recs = []; const queue = [];
  const ref = (v) => {
    if (v === null || v === undefined) return null;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? v : { n: String(v) };
    if (t === 'string' || t === 'boolean') return v;
    if (ids.has(v)) return { r: ids.get(v) };
    const id = recs.length; ids.set(v, id); recs.push(null); queue.push(v);
    return { r: id };
  };
  const rootRef = ref(root);
  while (queue.length) {
    const v = queue.shift();
    const id = ids.get(v);
    let rec;
    if (Array.isArray(v)) rec = { a: v.map(ref) };
    else if (v instanceof Env) rec = { e: [v.v.map(ref), ref(v.p)] };
    else if (v instanceof Closure) rec = { f: [ref(v.prog), v.fi, ref(v.env)] };
    else if (v instanceof Prog) rec = { p: v.exe };
    else if (v instanceof Ctx) {
      rec = { c: {
        prog: ref(v.prog), g: ref(v.g), stack: ref(v.stack),
        frames: v.frames.map((f) => [f.fi, f.pc, ref(f.env), f.sp]),
        handlers: v.handlers.map((h) => [h.fd, h.sp, h.pc]),
        state: v.state, trap: ref(v.trap), result: ref(v.result), error: v.error, pendingThrow: ref(v.pendingThrow),
        units: v.units, own: v.own, inner: v.inner, prepaid: v.prepaid, prepaidFor: v.prepaidFor,
        memOwn: v.memOwn, memTotal: v.memTotal, memLimit: v.memLimit, rng: v.rng,
      } };
    } else if (isDict(v)) { const o = {}; for (const k in v) o[k] = ref(v[k]); rec = { o }; }
    else rec = { z: 1 };
    recs[id] = rec;
  }
  return JSON.stringify({ format: 'nest-heap', v: 1, root: rootRef, objs: recs });
}

export function deserialize(str) {
  const data = typeof str === 'string' ? JSON.parse(str) : str;
  if (!data || data.format !== 'nest-heap') throw new NestError('不是 Nest 堆快照');
  const objs = new Array(data.objs.length);
  // 第一遍：创建空壳
  data.objs.forEach((r, i) => {
    if (r.a) objs[i] = [];
    else if (r.e) objs[i] = new Env(0, null);
    else if (r.f) objs[i] = new Closure(null, 0, null);
    else if (r.p) objs[i] = new Prog(r.p);
    else if (r.c) objs[i] = new Ctx(null, {});
    else if (r.o) objs[i] = {};
    else objs[i] = null;
  });
  const val = (x) => {
    if (x === null || x === undefined) return null;
    if (typeof x === 'object') { if ('r' in x) return objs[x.r]; if ('n' in x) return Number(x.n); }
    return x;
  };
  data.objs.forEach((r, i) => {
    const o = objs[i];
    if (r.a) { for (const x of r.a) o.push(val(x)); }
    else if (r.e) { o.v = r.e[0].map(val); o.p = val(r.e[1]); }
    else if (r.f) { o.prog = val(r.f[0]); o.fi = r.f[1]; o.env = val(r.f[2]); }
    else if (r.c) {
      const c = r.c;
      o.prog = val(c.prog); o.g = val(c.g); o.stack = val(c.stack);
      o.frames = c.frames.map((f) => ({ fi: f[0], pc: f[1], env: val(f[2]), sp: f[3] }));
      o.handlers = c.handlers.map((h) => ({ fd: h[0], sp: h[1], pc: h[2] }));
      o.state = c.state; o.trap = val(c.trap); o.result = val(c.result); o.error = c.error; o.pendingThrow = val(c.pendingThrow);
      if (o.pendingThrow === undefined) o.pendingThrow = null;
      o.units = c.units; o.own = c.own; o.inner = c.inner; o.prepaid = c.prepaid; o.prepaidFor = c.prepaidFor || 0;
      o.memOwn = c.memOwn; o.memTotal = c.memTotal; o.memLimit = c.memLimit; o.rng = c.rng;
    } else if (r.o) { for (const k in r.o) setKey(o, k, val(r.o[k])); }
  });
  return val(data.root);
}

// 把数据中的身份字符串按映射改写（用于分叉出新实例身份）
function remapStr(s, map) {
  if (s.indexOf('inner-') < 0) return s;
  return s.replace(/inner-\d+/g, (m) => (typeof map[m] === 'string' && Object.prototype.hasOwnProperty.call(map, m)) ? map[m] : m);
}
export function remapValue(v, map) {
  const seen = new Set();
  const walk = (x) => {
    if (typeof x === 'string') return remapStr(x, map);
    if (x === null || typeof x !== 'object' || seen.has(x)) return x;
    seen.add(x);
    if (Array.isArray(x)) { for (let i = 0; i < x.length; i++) x[i] = walk(x[i]); return x; }
    if (x instanceof Env) { walk(x.v); if (x.p) walk(x.p); return x; }
    if (x instanceof Closure) { walk(x.env); return x; }
    if (x instanceof Ctx) { remapStrings(x, map, seen); return x; }
    if (isDict(x)) {
      for (const k of Object.keys(x)) { const nk = remapStr(k, map); const nv = walk(x[k]); if (nk !== k) { delete x[k]; setKey(x, nk, nv); } else x[k] = nv; }
      return x;
    }
    return x;
  };
  return walk(v);
}
export function remapStrings(ctx, map, seen) {
  const w = (x) => remapValue(x, map);
  ctx.g = w(ctx.g); ctx.stack = w(ctx.stack); ctx.trap = w(ctx.trap); ctx.result = w(ctx.result);
  for (const f of ctx.frames) w(f.env);
  return ctx;
}

// 便于宿主：编译后的可执行数据 -> 新上下文
export function spawnCtx(exe, opts) { return new Ctx(exe instanceof Prog ? exe : new Prog(exe), opts); }
