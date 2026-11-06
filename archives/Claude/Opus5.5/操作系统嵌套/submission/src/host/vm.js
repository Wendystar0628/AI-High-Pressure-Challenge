// Nest VM —— 宿主提供的“程序执行环境”。
// 程序（含子系统内核）都被编译成这里执行的字节码。VM 只负责：逐条执行、按工作量计费、
// 在系统调用处陷入（trap）并把控制权交还给调用 vm_run 的那一层内核、保存与恢复运行状态。
// 调度、消息、文件、窗口等全部逻辑都不在这里；根系统以外的内核是运行在本 VM 上的 Nest 程序。

export const ST_BUDGET = 0, ST_TRAP = 1, ST_EXIT = 2, ST_FAULT = 3;

// 计量：一条指令 = 1 单位；复制 / 比较 / 拼接 / 解析等按规模折算，COPY_UNIT 字节 = 1 单位。
export const COPY_UNIT = 16;

const OPS = 'NOP CONST INT NULL TRUE FALSE LOAD STORE GLOAD GSTORE POP DUP DUP2 ADD SUB MUL DIV MOD NEG NOT EQ NE LT LE GT GE BAND BOR BXOR SHL SHR BNOT JMP JZ JNZ JZK JNZK CALL CALLV RET BI TRAP ARR OBJ GET SET TRY ENDTRY THROW FUNC GETK'.split(' ');
export const OP = Object.fromEntries(OPS.map((n, i) => [n, i]));
const {
  NOP, CONST, INT, NULL, TRUE, FALSE, LOAD, STORE, GLOAD, GSTORE, POP, DUP, DUP2, ADD, SUB, MUL, DIV, MOD, NEG, NOT,
  EQ, NE, LT, LE, GT, GE, BAND, BOR, BXOR, SHL, SHR, BNOT, JMP, JZ, JNZ, JZK, JNZK, CALL, CALLV, RET, BI, TRAP, ARR,
  OBJ, GET, SET, TRY, ENDTRY, THROW, FUNC, GETK,
} = OP;

const MAX_FRAMES = 3000 * 3;
const MAX_STACK = 400000;

export class NestError extends Error {
  constructor(msg, value) { super(msg); this.value = value === undefined ? msg : value; }
}

// 已载入的可执行映像。文本形式是编译器产出的 .nbc 文件：第一行头、第二行正文。
export class Image {
  constructor(text) {
    const nl = text.indexOf('\n');
    let header, body;
    try {
      header = JSON.parse(text.slice(0, nl));
      body = JSON.parse(text.slice(nl + 1));
    } catch (e) { throw new NestError('可执行文件格式错误：' + e.message); }
    this.text = text;
    this.header = header;
    this.code = Int32Array.from(body.code);
    this.consts = body.consts;
    this.nglobals = body.globals;
    const n = body.funcs.length;
    this.fNames = body.funcs.map((f) => f[0]);
    this.fParams = new Int32Array(n);
    this.fLocals = new Int32Array(n);
    this.fEntry = new Int32Array(n);
    body.funcs.forEach((f, i) => { this.fParams[i] = f[1]; this.fLocals[i] = f[2]; this.fEntry[i] = f[3]; });
    this.entry = body.entry;
    this.imports = body.imports;
    this.bi = body.imports.map((name) => BUILTINS[name] || missingBuiltin(name));
    this.lines = body.lines;
    this.files = body.files;
    this.size = text.length;
  }
  where(pc) {
    const L = this.lines; let lo = 0, hi = Math.floor(L.length / 3) - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m * 3] <= pc) { ans = m; lo = m + 1; } else hi = m - 1; }
    if (ans < 0) return '?';
    return this.files[L[ans * 3 + 1]] + ':' + L[ans * 3 + 2];
  }
}

function missingBuiltin(name) { return () => { throw new NestError('未实现的内建函数：' + name); }; }

const imageCache = new Map();
export function loadImage(text) {
  let im = imageCache.get(text);
  if (!im) { im = new Image(text); imageCache.set(text, im); if (imageCache.size > 512) imageCache.delete(imageCache.keys().next().value); }
  return im;
}

let nextCtxId = 1;

// 一个执行上下文：程序的全部运行状态（变量、运行位置、等待状态）。
export class Ctx {
  constructor(image, args, opts = {}) {
    this.id = nextCtxId++;
    this.image = image;
    this.priv = !!opts.priv;
    this.memLimit = opts.memLimit || 64 * 1024 * 1024;
    this.effLimit = this.memLimit;
    this.stack = [];
    this.frames = [];
    this.tries = [];
    this.globals = new Array(image.nglobals).fill(null);
    this.pc = 0; this.fp = 0; this.sp = 0; this.fn = image.entry;
    this.used = 0;      // 累计已支付单位（含子上下文）
    this.kidUsed = 0;   // 其中付给子上下文的部分
    this.debt = 0;      // 已完成但尚未支付的工作
    this.lastPaid = 0;
    this.left = 0; this.runBudget = 0;
    this.charge = 0;
    this.mem = image.size; this.since = 0; this.traceAt = 65536; this.ext = 0; this.kidsMem = 0;
    this.parent = null; this.kids = [];
    this.rng = (opts.seed === undefined ? 0x9e3779b9 : opts.seed) | 0;
    this.status = 'ready';   // ready | trap | exit | fault
    this.trapName = null; this.trapArgs = null;
    this.exitValue = null; this.error = null;
    this.pendingThrow = undefined;
    this.ins = 0;
    // 进入入口函数
    const f = image.entry;
    this.stack.push(args === undefined ? null : args);
    this.sp = 1;
    const np = image.fParams[f], nl = image.fLocals[f];
    if (np < 1) this.sp = 0;
    while (this.sp < nl) this.stack[this.sp++] = null;
    this.pc = image.fEntry[f];
  }
  get memTotal() { return this.mem + this.since + this.ext + this.kidsMem; }
}

// —— 值复制（跨上下文时使用）：返回副本，并把规模累计到 sizeBox ——
let copySize = 0;
function cloneRec(v, depth) {
  switch (typeof v) {
    case 'number': copySize += 8; return v;
    case 'string': copySize += 16 + v.length; return v;
    case 'boolean': copySize += 8; return v;
    case 'object': {
      if (v === null) { copySize += 8; return null; }
      if (depth > 400) throw new NestError('值嵌套过深或存在环，不能复制');
      if (Array.isArray(v)) {
        const n = v.length, out = new Array(n);
        copySize += 24;
        for (let i = 0; i < n; i++) {
          const e = v[i];
          if (typeof e === 'number') { copySize += 8; out[i] = e; } else out[i] = cloneRec(e, depth + 1);
        }
        return out;
      }
      if (v instanceof Ctx || v instanceof Image) throw new NestError('句柄不能跨界传递');
      const o = Object.create(null);
      copySize += 32;
      for (const k in v) { copySize += 16 + k.length; o[k] = cloneRec(v[k], depth + 1); }
      return o;
    }
    default: return null;
  }
}
export function cloneValue(v) { copySize = 0; const r = cloneRec(v, 0); return r; }
export function lastCopySize() { return copySize; }

function nullProto(v) {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const e = v[i]; if (typeof e === 'object' && e !== null) v[i] = nullProto(e); } return v; }
  if (typeof v === 'object' && v !== null) {
    const o = Object.create(null);
    for (const k in v) { const e = v[k]; o[k] = (typeof e === 'object' && e !== null) ? nullProto(e) : e; }
    return o;
  }
  return v;
}
export function fromHost(v) { return nullProto(v); }

// —— 内存计量 ——
function traceValue(v, seen) {
  if (typeof v === 'string') return 16 + v.length;
  if (typeof v !== 'object' || v === null) return 8;
  if (v instanceof Ctx || v instanceof Image) return 16;
  if (seen.has(v)) return 8;
  seen.add(v);
  let s = 0;
  if (Array.isArray(v)) {
    s = 24 + 8 * v.length;
    for (let i = 0; i < v.length; i++) { const e = v[i]; if (typeof e === 'object' || typeof e === 'string') s += traceValue(e, seen); }
    return s;
  }
  s = 32;
  for (const k in v) { s += 24 + k.length; const e = v[k]; if (typeof e === 'object' || typeof e === 'string') s += traceValue(e, seen); else s += 8; }
  return s;
}
function trace(ctx) {
  const seen = new Set();
  let s = ctx.image.size + 256 + ctx.sp * 8 + ctx.frames.length * 8;
  for (let i = 0; i < ctx.sp; i++) { const e = ctx.stack[i]; if (typeof e === 'object' || typeof e === 'string') s += traceValue(e, seen); }
  for (let i = 0; i < ctx.globals.length; i++) { const e = ctx.globals[i]; if (typeof e === 'object' || typeof e === 'string') s += traceValue(e, seen); }
  ctx.mem = s; ctx.since = 0;
  ctx.charge += Math.ceil(s / 1024);
}
function memCheck(ctx, wanted) {
  trace(ctx);
  const total = ctx.mem + ctx.ext + ctx.kidsMem + (wanted || 0);
  if (total > ctx.effLimit) {
    throw new NestError(`内存配额不足（需要 ${Math.ceil(total / 1024)} KB，上限 ${Math.ceil(ctx.effLimit / 1024)} KB）`, 'ENOMEM: 内存配额不足');
  }
  const head = ctx.effLimit - total;
  ctx.traceAt = Math.max(4096, Math.min(head / 2, 4 * 1024 * 1024));
}
function alloc(ctx, n) {
  ctx.since += n;
  if (ctx.since > ctx.traceAt) memCheck(ctx, 0);
}
export function refreshMem(ctx) { if (ctx.since > 32768) { trace(ctx); ctx.charge = 0; } return ctx.memTotal; }

function updateEffLimit(parent, kid) {
  if (!parent) { kid.effLimit = kid.memLimit; return; }
  const others = parent.memTotal - kid.memTotal;
  kid.effLimit = Math.min(kid.memLimit, parent.effLimit - others);
}

// —— 调用一个上下文。返回状态；实际支付的单位数记在 ctx.lastPaid ——
export function vmRun(ctx, budget) {
  ctx.lastPaid = 0;
  if (ctx.status === 'exit' || ctx.status === 'fault') return ctx.status === 'exit' ? ST_EXIT : ST_FAULT;
  if (ctx.status === 'trap') return ST_TRAP; // 未恢复就再次运行：内核的责任
  if (budget <= 0) return ST_BUDGET;
  let left = budget;
  ctx.runBudget = budget;
  if (ctx.debt > 0) {
    const pay = Math.min(ctx.debt, left);
    ctx.debt -= pay; left -= pay;
    if (left <= 0) { ctx.used += budget; ctx.lastPaid = budget; return ST_BUDGET; }
  }
  const image = ctx.image;
  const code = image.code, consts = image.consts, globals = ctx.globals, stack = ctx.stack, frames = ctx.frames;
  const fEntry = image.fEntry, fParams = image.fParams, fLocals = image.fLocals, bi = image.bi;
  let pc = ctx.pc, sp = ctx.sp, fp = ctx.fp, fn = ctx.fn;
  let status = ST_BUDGET;
  const a0 = left;

  const raise = (val) => {
    // 把异常交给最近的 try；没有则进程异常。返回 true 表示已转入处理器。
    const tries = ctx.tries;
    if (tries.length === 0) return false;
    const h5 = tries.pop(), h4 = tries.pop(), h3 = tries.pop(), h2 = tries.pop(), h1 = tries.pop();
    frames.length = h1;
    sp = h2; pc = h3; fp = h4; fn = h5;
    stack[sp++] = val;
    return true;
  };

  if (ctx.pendingThrow !== undefined) {
    const v = ctx.pendingThrow; ctx.pendingThrow = undefined;
    if (!raise(v)) {
      ctx.status = 'fault'; ctx.error = String(v);
      ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; ctx.fn = fn;
      ctx.used += budget - left; ctx.lastPaid = budget - left;
      return ST_FAULT;
    }
  }

  for (;;) {
    try {
      while (left > 0) {
        left--;
        switch (code[pc++]) {
          case NOP: break;
          case CONST: stack[sp++] = consts[code[pc++]]; break;
          case INT: stack[sp++] = code[pc++]; break;
          case NULL: stack[sp++] = null; break;
          case TRUE: stack[sp++] = true; break;
          case FALSE: stack[sp++] = false; break;
          case LOAD: stack[sp++] = stack[fp + code[pc++]]; break;
          case STORE: stack[fp + code[pc++]] = stack[--sp]; break;
          case GLOAD: stack[sp++] = globals[code[pc++]]; break;
          case GSTORE: globals[code[pc++]] = stack[--sp]; break;
          case POP: sp--; break;
          case DUP: stack[sp] = stack[sp - 1]; sp++; break;
          case DUP2: stack[sp] = stack[sp - 2]; stack[sp + 1] = stack[sp - 1]; sp += 2; break;
          case ADD: {
            const b = stack[--sp], a = stack[sp - 1];
            if (typeof a === 'number' && typeof b === 'number') { stack[sp - 1] = a + b; break; }
            const s = toStr(a) + toStr(b);
            ctx.charge += (s.length >> 4) + 1;
            ctx.since += s.length + 16;
            if (ctx.since > ctx.traceAt) { ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; memCheck(ctx, 0); }
            left -= ctx.charge; ctx.charge = 0;
            stack[sp - 1] = s;
            break;
          }
          case SUB: { const b = stack[--sp], a = stack[sp - 1]; if (typeof a !== 'number' || typeof b !== 'number') typeErr('-', a, b); stack[sp - 1] = a - b; break; }
          case MUL: { const b = stack[--sp], a = stack[sp - 1]; if (typeof a !== 'number' || typeof b !== 'number') typeErr('*', a, b); stack[sp - 1] = a * b; break; }
          case DIV: { const b = stack[--sp], a = stack[sp - 1]; if (typeof a !== 'number' || typeof b !== 'number') typeErr('/', a, b); stack[sp - 1] = a / b; break; }
          case MOD: { const b = stack[--sp], a = stack[sp - 1]; if (typeof a !== 'number' || typeof b !== 'number') typeErr('%', a, b); stack[sp - 1] = a % b; break; }
          case NEG: { const a = stack[sp - 1]; if (typeof a !== 'number') typeErr('-', a, 0); stack[sp - 1] = -a; break; }
          case NOT: { stack[sp - 1] = !stack[sp - 1]; break; }
          case EQ: { const b = stack[--sp], a = stack[sp - 1]; if (typeof a === 'string' && typeof b === 'string') { left -= Math.min(a.length, b.length) >> 5; } stack[sp - 1] = a === b; break; }
          case NE: { const b = stack[--sp], a = stack[sp - 1]; if (typeof a === 'string' && typeof b === 'string') { left -= Math.min(a.length, b.length) >> 5; } stack[sp - 1] = a !== b; break; }
          case LT: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] < b; break; }
          case LE: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] <= b; break; }
          case GT: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] > b; break; }
          case GE: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] >= b; break; }
          case BAND: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] & b; break; }
          case BOR: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] | b; break; }
          case BXOR: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] ^ b; break; }
          case SHL: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] << b; break; }
          case SHR: { const b = stack[--sp]; stack[sp - 1] = stack[sp - 1] >> b; break; }
          case BNOT: { stack[sp - 1] = ~stack[sp - 1]; break; }
          case JMP: pc = code[pc]; break;
          case JZ: { const t = code[pc++]; if (!stack[--sp]) pc = t; break; }
          case JNZ: { const t = code[pc++]; if (stack[--sp]) pc = t; break; }
          case JZK: { const t = code[pc++]; if (!stack[sp - 1]) pc = t; else sp--; break; }
          case JNZK: { const t = code[pc++]; if (stack[sp - 1]) pc = t; else sp--; break; }
          case CALL: {
            const f = code[pc++], argc = code[pc++];
            const np = fParams[f], base = sp - argc;
            if (argc > np) sp = base + np;
            const top = base + fLocals[f];
            while (sp < top) stack[sp++] = null;
            if (frames.length > MAX_FRAMES || sp > MAX_STACK) throw new NestError('调用栈溢出');
            frames.push(pc, fp, fn);
            fp = base; pc = fEntry[f]; fn = f;
            break;
          }
          case CALLV: {
            const argc = code[pc++];
            const base = sp - argc;
            const fv = stack[base - 1];
            if (fv === null || typeof fv !== 'object' || fv.__fn === undefined) throw new NestError('调用的对象不是函数');
            const f = fv.__fn;
            // 把实参下移一格，覆盖函数值
            for (let i = 0; i < argc; i++) stack[base - 1 + i] = stack[base + i];
            sp--;
            const b2 = base - 1, np = fParams[f];
            if (argc > np) sp = b2 + np;
            const top = b2 + fLocals[f];
            while (sp < top) stack[sp++] = null;
            if (frames.length > MAX_FRAMES || sp > MAX_STACK) throw new NestError('调用栈溢出');
            frames.push(pc, fp, fn);
            fp = b2; pc = fEntry[f]; fn = f;
            break;
          }
          case RET: {
            const v = stack[--sp];
            if (frames.length === 0) {
              ctx.status = 'exit'; ctx.exitValue = v; status = ST_EXIT;
              ctx.pc = pc; ctx.sp = fp; ctx.fp = fp; ctx.fn = fn;
              sp = fp;
              throw EXIT_SIGNAL;
            }
            sp = fp;
            fn = frames.pop(); fp = frames.pop(); pc = frames.pop();
            stack[sp++] = v;
            break;
          }
          case BI: {
            const k = code[pc++], argc = code[pc++];
            const base = sp - argc;
            ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; ctx.fn = fn; ctx.left = left;
            let r;
            switch (argc) {
              case 0: r = bi[k](ctx); break;
              case 1: r = bi[k](ctx, stack[base]); break;
              case 2: r = bi[k](ctx, stack[base], stack[base + 1]); break;
              case 3: r = bi[k](ctx, stack[base], stack[base + 1], stack[base + 2]); break;
              case 4: r = bi[k](ctx, stack[base], stack[base + 1], stack[base + 2], stack[base + 3]); break;
              default: r = bi[k](ctx, ...stack.slice(base, sp));
            }
            sp = base;
            stack[sp++] = r === undefined ? null : r;
            if (ctx.charge !== 0) { left -= ctx.charge; ctx.charge = 0; }
            break;
          }
          case TRAP: {
            const argc = code[pc++];
            const base = sp - argc;
            const name = stack[base];
            const args = stack.slice(base + 1, sp);
            sp = base;
            ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; ctx.fn = fn;
            const copied = cloneValue(args);
            ctx.trapName = name; ctx.trapArgs = copied;
            ctx.status = 'trap';
            left -= Math.ceil(lastCopySize() / COPY_UNIT);
            status = ST_TRAP;
            throw EXIT_SIGNAL;
          }
          case ARR: {
            const n = code[pc++];
            const base = sp - n;
            const a = new Array(n);
            for (let i = 0; i < n; i++) a[i] = stack[base + i];
            sp = base;
            stack[sp++] = a;
            ctx.since += 24 + 8 * n;
            if (ctx.since > ctx.traceAt) { ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; memCheck(ctx, 0); left -= ctx.charge; ctx.charge = 0; }
            break;
          }
          case OBJ: {
            const n = code[pc++];
            const base = sp - 2 * n;
            const o = Object.create(null);
            for (let i = 0; i < n; i++) o[stack[base + 2 * i]] = stack[base + 2 * i + 1];
            sp = base;
            stack[sp++] = o;
            ctx.since += 32 + 32 * n;
            if (ctx.since > ctx.traceAt) { ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; memCheck(ctx, 0); left -= ctx.charge; ctx.charge = 0; }
            break;
          }
          case GET: {
            const k = stack[--sp], o = stack[sp - 1];
            let v;
            if (typeof o === 'object' && o !== null) {
              if (Array.isArray(o)) v = typeof k === 'number' ? o[k] : undefined;
              else if (o instanceof Ctx || o instanceof Image) v = undefined;
              else v = o[k];
            } else if (typeof o === 'string') {
              v = typeof k === 'number' ? o[k] : undefined;
            } else throw new NestError('不能读取 ' + typeName(o) + ' 的成员 ' + String(k));
            stack[sp - 1] = v === undefined ? null : v;
            break;
          }
          case GETK: {
            const k = consts[code[pc++]], o = stack[sp - 1];
            if (typeof o !== 'object' || o === null || Array.isArray(o) || o instanceof Ctx || o instanceof Image) {
              throw new NestError('不能读取 ' + typeName(o) + ' 的成员 ' + String(k));
            }
            const v = o[k];
            stack[sp - 1] = v === undefined ? null : v;
            break;
          }
          case SET: {
            const v = stack[--sp], k = stack[--sp], o = stack[sp - 1];
            if (typeof o !== 'object' || o === null || o instanceof Ctx || o instanceof Image) throw new NestError('不能写入 ' + typeName(o) + ' 的成员 ' + String(k));
            if (Array.isArray(o)) {
              if (typeof k !== 'number' || k < 0 || k !== Math.floor(k)) throw new NestError('数组下标无效：' + String(k));
              if (k >= o.length) {
                const add = k - o.length + 1;
                ctx.since += add * 8; left -= add >> 2;
                if (ctx.since > ctx.traceAt) { ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; memCheck(ctx, 0); }
                for (let i = o.length; i < k; i++) o[i] = null;
              }
              o[k] = v;
            } else {
              if (o[k] === undefined) { ctx.since += 48; if (ctx.since > ctx.traceAt) { ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; memCheck(ctx, 0); } }
              o[k] = v;
            }
            stack[sp - 1] = v;
            break;
          }
          case TRY: { const t = code[pc++]; ctx.tries.push(frames.length, sp, t, fp, fn); break; }
          case ENDTRY: { ctx.tries.length -= 5; break; }
          case THROW: { throw new NestError(toStr(stack[sp - 1]), stack[--sp]); }
          case FUNC: { const o = Object.create(null); o.__fn = code[pc++]; stack[sp++] = o; break; }
          default: throw new NestError('非法指令 @' + (pc - 1));
        }
      }
      break;
    } catch (e) {
      if (e === EXIT_SIGNAL) break;
      let val, msg;
      if (e instanceof NestError) { val = e.value; msg = e.message; }
      else if (e instanceof RangeError) { val = msg = '资源超限：' + e.message; }
      else { console.error('VM 内部错误', e); val = msg = 'VM 内部错误：' + e.message; }
      left -= ctx.charge; ctx.charge = 0;
      if (!raise(val)) {
        ctx.status = 'fault';
        ctx.error = msg + ' （' + image.where(pc - 1) + '，函数 ' + image.fNames[fn] + '）';
        status = ST_FAULT;
        break;
      }
    }
  }
  if (ctx.charge !== 0) { left -= ctx.charge; ctx.charge = 0; }
  if (status !== ST_EXIT) { ctx.pc = pc; ctx.sp = sp; ctx.fp = fp; ctx.fn = fn; }
  let paid = budget;
  if (left < 0) { ctx.debt += -left; } else if (status !== ST_BUDGET) { paid = budget - left; }
  ctx.used += paid; ctx.lastPaid = paid;
  ctx.left = 0;
  void a0;
  return status;
}
const EXIT_SIGNAL = { exit: true };

function typeName(v) {
  if (v === null || v === undefined) return '空值';
  if (Array.isArray(v)) return '数组';
  if (v instanceof Ctx || v instanceof Image) return '句柄';
  return ({ number: '数字', string: '字符串', boolean: '布尔值', object: '映射' })[typeof v] || typeof v;
}
function typeErr(op, a, b) { throw new NestError(`运算 ${op} 的操作数类型错误（${typeName(a)}，${typeName(b)}）`); }
function toStr(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  try { return JSON.stringify(v); } catch { return '[对象]'; }
}

// —— 恢复进程（把系统调用的返回值交还给它）——
export function vmResume(ctx, value, callerCtx) {
  const c = cloneValue(value);
  const size = lastCopySize();
  if (callerCtx) callerCtx.charge += Math.ceil(size / COPY_UNIT);
  ctx.stack[ctx.sp++] = c;
  ctx.status = 'ready';
  ctx.trapName = null; ctx.trapArgs = null;
  ctx.since += size;
}

const BUILTINS = Object.create(null);
export { BUILTINS };

function chk(ctx, n) { ctx.charge += n; }
function B(name, fn) { BUILTINS[name] = fn; }

// 数学
for (const name of ['sqrt', 'sin', 'cos', 'tan', 'atan', 'asin', 'acos', 'abs', 'floor', 'ceil', 'round', 'exp', 'log', 'sign']) {
  const m = Math[name]; B(name, (ctx, a) => m(a));
}
B('atan2', (ctx, a, b) => Math.atan2(a, b));
B('pow', (ctx, a, b) => Math.pow(a, b));
B('min', (ctx, a, b) => (a < b ? a : b));
B('max', (ctx, a, b) => (a > b ? a : b));
B('rand', (ctx) => {
  let x = ctx.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; ctx.rng = x | 0 || 1;
  return (x >>> 0) / 4294967296;
});
B('srand', (ctx, s) => { ctx.rng = (s | 0) || 1; });
B('is_nan', (ctx, a) => a !== a);

// 字符串
B('len', (ctx, a) => {
  if (typeof a === 'string' || Array.isArray(a)) return a.length;
  if (a === null || a === undefined) return 0;
  if (typeof a === 'object') { let n = 0; for (const _ in a) n++; chk(ctx, n >> 2); return n; }
  return 0;
});
B('substr', (ctx, s, i, n) => { const r = n === undefined || n === null ? s.slice(i) : s.substr(i, n); chk(ctx, (r.length >> 4)); ctx.since += r.length; return r; });
B('char_at', (ctx, s, i) => { const c = s[i]; return c === undefined ? '' : c; });
B('char_code', (ctx, s, i) => { const c = s.charCodeAt(i); return c !== c ? -1 : c; });
B('char_from', (ctx, c) => String.fromCharCode(c));
B('index_of', (ctx, s, t, from) => {
  if (Array.isArray(s)) { chk(ctx, s.length >> 2); return s.indexOf(t, from || 0); }
  const r = s.indexOf(t, from || 0);
  chk(ctx, ((r < 0 ? s.length : r) - (from || 0)) >> 4);
  return r;
});
B('last_index_of', (ctx, s, t) => { chk(ctx, s.length >> 4); return s.lastIndexOf(t); });
B('split', (ctx, s, t) => { chk(ctx, s.length >> 3); ctx.since += s.length + 32; return s.split(t); });
B('join', (ctx, a, t) => { const r = a.map(toStr).join(t === undefined || t === null ? '' : t); chk(ctx, r.length >> 3); ctx.since += r.length; return r; });
B('str', (ctx, v) => { const s = toStr(v); chk(ctx, s.length >> 4); return s; });
B('num', (ctx, s) => { if (typeof s === 'number') return s; const v = parseFloat(s); return v !== v ? null : v; });
B('fmt', (ctx, v, d) => (typeof v === 'number' ? v.toFixed(d || 0) : toStr(v)));
B('lower', (ctx, s) => { chk(ctx, s.length >> 4); return s.toLowerCase(); });
B('upper', (ctx, s) => { chk(ctx, s.length >> 4); return s.toUpperCase(); });
B('trim', (ctx, s) => { chk(ctx, s.length >> 4); return s.trim(); });
B('replace', (ctx, s, a, b) => { chk(ctx, s.length >> 3); const r = s.split(a).join(b); ctx.since += r.length; return r; });
B('starts_with', (ctx, s, t) => { chk(ctx, t.length >> 4); return s.startsWith(t); });
B('ends_with', (ctx, s, t) => { chk(ctx, t.length >> 4); return s.endsWith(t); });
B('pad_left', (ctx, s, n, ch) => toStr(s).padStart(n, ch === undefined ? ' ' : ch));

// 数组
B('push', (ctx, a, v) => { a.push(v); ctx.since += 8; if (ctx.since > ctx.traceAt) memCheck(ctx, 0); return a.length; });
B('pop', (ctx, a) => { const v = a.pop(); return v === undefined ? null : v; });
B('shift', (ctx, a) => { chk(ctx, a.length >> 4); const v = a.shift(); return v === undefined ? null : v; });
B('insert', (ctx, a, i, v) => { chk(ctx, a.length >> 3); a.splice(i, 0, v); ctx.since += 8; return a.length; });
B('remove_at', (ctx, a, i) => { chk(ctx, a.length >> 3); const r = a.splice(i, 1); return r.length ? r[0] : null; });
B('slice', (ctx, a, i, j) => {
  const r = a.slice(i === undefined || i === null ? 0 : i, j === undefined || j === null ? undefined : j);
  chk(ctx, typeof r === 'string' ? r.length >> 4 : r.length >> 1);
  ctx.since += typeof r === 'string' ? r.length : r.length * 8;
  if (ctx.since > ctx.traceAt) memCheck(ctx, 0);
  return r;
});
B('concat', (ctx, a, b) => { const r = a.concat(b); chk(ctx, r.length >> 1); ctx.since += r.length * 8; if (ctx.since > ctx.traceAt) memCheck(ctx, 0); return r; });
B('new_array', (ctx, n, v) => {
  if (!(n >= 0) || n > 1e8) throw new NestError('数组长度无效');
  chk(ctx, n >> 1);
  ctx.since += 24 + n * 8; if (ctx.since > ctx.traceAt) memCheck(ctx, 0);
  return new Array(n).fill(v === undefined ? null : v);
});
B('reverse', (ctx, a) => { chk(ctx, a.length >> 1); a.reverse(); return a; });
B('sort_num', (ctx, a) => { chk(ctx, a.length * 4); a.sort((x, y) => x - y); return a; });
B('sort_str', (ctx, a) => { chk(ctx, a.length * 8); a.sort(); return a; });
B('sort_key', (ctx, a, key) => {
  chk(ctx, a.length * 8);
  a.sort((x, y) => { const p = x[key], q = y[key]; return p < q ? -1 : p > q ? 1 : 0; });
  return a;
});

// 映射
B('keys', (ctx, m) => { if (m === null || typeof m !== 'object') return []; const r = Object.keys(m); chk(ctx, r.length); ctx.since += 24 + r.length * 8; return r; });
B('values', (ctx, m) => { if (m === null || typeof m !== 'object') return []; const r = Object.values(m); chk(ctx, r.length); ctx.since += 24 + r.length * 8; return r; });
B('has', (ctx, m, k) => m !== null && typeof m === 'object' && m[k] !== undefined);
B('del', (ctx, m, k) => { if (m !== null && typeof m === 'object') delete m[k]; });

// 其他
B('type', (ctx, v) => {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  if (v instanceof Ctx || v instanceof Image) return 'handle';
  if (typeof v === 'object') return v.__fn !== undefined ? 'function' : 'map';
  return typeof v === 'boolean' ? 'bool' : typeof v;
});
B('copy', (ctx, v) => { const c = cloneValue(v); const n = lastCopySize(); chk(ctx, Math.ceil(n / COPY_UNIT)); ctx.since += n; if (ctx.since > ctx.traceAt) memCheck(ctx, 0); return c; });
B('json_parse', (ctx, s) => {
  chk(ctx, s.length >> 4);
  ctx.since += s.length;
  if (ctx.since > ctx.traceAt) memCheck(ctx, 0);
  try { return nullProto(JSON.parse(s)); } catch (e) { throw new NestError('JSON 解析失败：' + e.message); }
});
B('json_str', (ctx, v, ind) => {
  const r = JSON.stringify(v, (k, x) => ((x instanceof Ctx || x instanceof Image) ? null : x), ind ? ind : undefined);
  const s = r === undefined ? 'null' : r;
  chk(ctx, s.length >> 4); ctx.since += s.length;
  return s;
});
function fnv(s) {
  let h = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h = Math.imul(h ^ c, 0x01000193); h2 = Math.imul(h2 + c, 0x5bd1e995) ^ (h2 >>> 13); }
  return (h >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
export const hashText = fnv;
B('hash', (ctx, s) => { s = toStr(s); chk(ctx, s.length >> 5); return fnv(s); });

// —— 特权内建：内核用它们管理自己的进程。普通进程调用会得到错误 ——
function priv(ctx) { if (!ctx.priv) throw new NestError('权限不足：此接口只供内核使用'); }
B('vm_load', (ctx, text) => {
  priv(ctx);
  chk(ctx, text.length >> 4);
  return loadImage(text);
});
B('vm_spawn', (ctx, image, args, opts) => {
  priv(ctx);
  if (!(image instanceof Image)) throw new NestError('vm_spawn: 映像无效');
  const a = cloneValue(args === undefined ? null : args); chk(ctx, Math.ceil(lastCopySize() / COPY_UNIT));
  const argSize = lastCopySize();
  const memLimit = opts && opts.mem ? opts.mem : ctx.effLimit;
  const kid = new Ctx(image, a, { priv: !!(opts && opts.priv), memLimit, seed: opts && opts.seed });
  kid.mem += argSize;
  kid.parent = ctx;
  ctx.kids.push(kid);
  ctx.kidsMem += kid.memTotal;
  chk(ctx, 200);
  const others = ctx.memTotal;
  if (others > ctx.effLimit) {
    ctx.kids.pop(); ctx.kidsMem -= kid.memTotal;
    throw new NestError('内存配额不足，无法创建进程', 'ENOMEM: 内存配额不足');
  }
  return kid;
});
B('vm_run', (ctx, kid, n) => {
  priv(ctx);
  const max = Math.min(n, ctx.left);
  if (max <= 0) return [ST_BUDGET, null, null, 0];
  const before = kid.memTotal;
  updateEffLimit(ctx, kid);
  const st = vmRun(kid, max);
  const paid = kid.lastPaid;
  ctx.charge += paid; ctx.kidUsed += paid;
  ctx.kidsMem += kid.memTotal - before;
  if (st === ST_BUDGET) return [ST_BUDGET, null, null, paid];
  if (st === ST_TRAP) return [ST_TRAP, kid.trapName, kid.trapArgs, paid];
  if (st === ST_EXIT) { const v = cloneValue(kid.exitValue); ctx.charge += Math.ceil(lastCopySize() / COPY_UNIT); return [ST_EXIT, v, null, paid]; }
  return [ST_FAULT, kid.error, null, paid];
});
B('vm_resume', (ctx, kid, v) => { priv(ctx); const b = kid.memTotal; vmResume(kid, v === undefined ? null : v, ctx); ctx.kidsMem += kid.memTotal - b; });
B('vm_throw', (ctx, kid, v) => { priv(ctx); kid.pendingThrow = cloneValue(v); kid.status = 'ready'; kid.trapName = null; kid.trapArgs = null; });
B('vm_kill', (ctx, kid) => {
  priv(ctx);
  const i = ctx.kids.indexOf(kid);
  if (i >= 0) { ctx.kids.splice(i, 1); ctx.kidsMem -= kid.memTotal; }
  releaseTree(kid);
});
function releaseTree(c) { c.status = 'exit'; c.kids.forEach(releaseTree); c.kids.length = 0; c.stack.length = 0; c.globals.length = 0; c.mem = 0; c.since = 0; c.ext = 0; c.kidsMem = 0; }
B('vm_stat', (ctx, kid) => {
  priv(ctx);
  const b = kid.memTotal;
  refreshMem(kid);
  ctx.kidsMem += kid.memTotal - b;
  return [kid.used, kid.used - kid.kidUsed, kid.memTotal, kid.debt, kid.mem + kid.since];
});
B('vm_self', (ctx) => { const u = ctx.used + (ctx.runBudget - ctx.left); return [u, u - ctx.kidUsed, ctx.memTotal, ctx.debt, ctx.mem + ctx.since, ctx.effLimit]; });
B('vm_used', (ctx) => ctx.used + (ctx.runBudget - ctx.left));
B('vm_set_mem', (ctx, kid, limit) => { priv(ctx); kid.memLimit = limit; updateEffLimit(ctx, kid); });
B('vm_ext_mem', (ctx, kid, delta) => {
  priv(ctx);
  const c = kid || ctx;
  if (delta > 0) {
    const total = c.memTotal + delta;
    if (total > c.effLimit) return false;
  }
  c.ext = Math.max(0, c.ext + delta);
  if (kid) ctx.kidsMem += delta;
  return true;
});
B('vm_where', (ctx, kid) => { priv(ctx); return kid.image.where(kid.pc) + ' / ' + kid.image.fNames[kid.fn]; });
B('budget_left', (ctx) => ctx.left);
B('vm_save', (ctx, kid) => {
  priv(ctx);
  const s = serializeCtx(kid);
  chk(ctx, s.length >> 4); ctx.since += s.length;
  if (ctx.since > ctx.traceAt) memCheck(ctx, 0);
  return s;
});
B('vm_restore', (ctx, text, remap, opts) => {
  priv(ctx);
  chk(ctx, text.length >> 4);
  const kid = deserializeCtx(text, remap);
  kid.parent = ctx;
  ctx.kids.push(kid);
  ctx.kidsMem += kid.memTotal;
  void opts;
  return kid;
});

// —— 快照：把上下文（连同嵌套其中的后代上下文）编码为文本 ——
// 编码保留别名关系；映像按内容去重；长字符串去重。
export function serializeCtx(root) {
  const objs = []; const ids = new Map();
  const images = []; const imgIds = new Map();
  const strs = []; const strIds = new Map();
  const enc = (v) => {
    switch (typeof v) {
      case 'number':
        if (v !== v || v === Infinity || v === -Infinity) return { n: String(v) };
        return v;
      case 'boolean': return v;
      case 'string': {
        if (v.length < 64) return v;
        let i = strIds.get(v);
        if (i === undefined) { i = strs.length; strs.push(v); strIds.set(v, i); }
        return { s: i };
      }
      case 'object': break;
      default: return null;
    }
    if (v === null) return null;
    let id = ids.get(v);
    if (id !== undefined) return [id];
    id = objs.length; ids.set(v, id); objs.push(null);
    if (v instanceof Ctx) {
      objs[id] = { t: 'c', v: encCtx(v) };
    } else if (v instanceof Image) {
      objs[id] = { t: 'i', v: imgRef(v) };
    } else if (Array.isArray(v)) {
      objs[id] = { t: 'a', v: v.map(enc) };
    } else {
      const m = [];
      for (const k in v) m.push(k, enc(v[k]));
      objs[id] = { t: 'o', v: m };
    }
    return [id];
  };
  const imgRef = (im) => {
    let i = imgIds.get(im);
    if (i === undefined) { i = images.length; images.push(im.text); imgIds.set(im, i); }
    return i;
  };
  const encCtx = (c) => ({
    image: imgRef(c.image), priv: c.priv, memLimit: c.memLimit, effLimit: c.effLimit,
    stack: c.stack.slice(0, c.sp).map(enc), frames: c.frames.slice(), tries: c.tries.slice(),
    globals: c.globals.map(enc), pc: c.pc, fp: c.fp, sp: c.sp, fn: c.fn,
    used: c.used, kidUsed: c.kidUsed, debt: c.debt, mem: c.mem, since: c.since, ext: c.ext, kidsMem: c.kidsMem,
    rng: c.rng, status: c.status, trapName: c.trapName, trapArgs: enc(c.trapArgs),
    exitValue: enc(c.exitValue), error: c.error, pendingThrow: c.pendingThrow === undefined ? { u: 1 } : enc(c.pendingThrow),
    kids: c.kids.map(enc),
  });
  const rootRef = enc(root);
  return JSON.stringify({ nsnap: 1, images, strs, objs, root: rootRef });
}

export function deserializeCtx(text, remap) {
  let doc;
  try { doc = JSON.parse(text); } catch (e) { throw new NestError('快照内容损坏：' + e.message); }
  if (!doc || doc.nsnap !== 1) throw new NestError('快照格式不正确');
  const rs = remap ? makeRemap(remap) : null;
  const images = doc.images.map((t) => loadImage(t));
  const objs = new Array(doc.objs.length);
  const strs = rs ? doc.strs.map((s) => (s.length < 400 ? rs(s) : s)) : doc.strs;
  const dec = (v) => {
    if (typeof v === 'string') return rs ? rs(v) : v;
    if (typeof v !== 'object' || v === null) return v;
    if (Array.isArray(v)) return build(v[0]);
    if (v.s !== undefined) return strs[v.s];
    if (v.n !== undefined) return Number(v.n);
    return null;
  };
  const build = (id) => {
    const e = doc.objs[id];
    if (objs[id] !== undefined) return objs[id];
    if (e.t === 'a') {
      const a = new Array(e.v.length); objs[id] = a;
      for (let i = 0; i < e.v.length; i++) a[i] = dec(e.v[i]);
      return a;
    }
    if (e.t === 'o') {
      const o = Object.create(null); objs[id] = o;
      for (let i = 0; i < e.v.length; i += 2) o[rs ? rs(e.v[i]) : e.v[i]] = dec(e.v[i + 1]);
      return o;
    }
    if (e.t === 'i') { objs[id] = images[e.v]; return objs[id]; }
    if (e.t === 'c') {
      const s = e.v;
      const c = Object.create(Ctx.prototype);
      objs[id] = c;
      c.id = nextCtxId++;
      c.image = images[s.image]; c.priv = s.priv; c.memLimit = s.memLimit; c.effLimit = s.effLimit;
      c.stack = s.stack.map(dec); c.frames = s.frames; c.tries = s.tries;
      c.globals = s.globals.map(dec);
      c.pc = s.pc; c.fp = s.fp; c.sp = s.sp; c.fn = s.fn;
      c.used = s.used; c.kidUsed = s.kidUsed; c.debt = s.debt; c.lastPaid = 0; c.left = 0; c.runBudget = 0; c.charge = 0;
      c.mem = s.mem; c.since = s.since; c.traceAt = 65536; c.ext = s.ext; c.kidsMem = s.kidsMem;
      c.rng = s.rng; c.status = s.status; c.trapName = s.trapName; c.trapArgs = dec(s.trapArgs);
      c.exitValue = dec(s.exitValue); c.error = s.error;
      c.pendingThrow = (s.pendingThrow && s.pendingThrow.u) ? undefined : dec(s.pendingThrow);
      c.ins = 0; c.parent = null;
      c.kids = s.kids.map(dec);
      c.kids.forEach((k) => { k.parent = c; });
      return c;
    }
    return null;
  };
  return dec(doc.root);
}

function makeRemap(map) {
  // map: { 'inner-3': 'inner-7', '@from': 父路径, '@to': 新父路径 }。只改写短字符串中的实例身份，文件内容不受影响。
  const re = /inner-d+/g;
  const from = map['@from'], to = map['@to'];
  const moved = from !== undefined && to !== undefined && from !== to;
  return (s) => {
    if (s.length > 400) return s;
    if (moved && (s === from || s.startsWith(from + '/'))) s = to + s.slice(from.length);
    if (s.indexOf('inner-') < 0) return s;
    return s.replace(re, (m) => (map[m] !== undefined ? map[m] : m));
  };
}
export const remapStrings = makeRemap;

export function remapValue(v, map) {
  const rs = makeRemap(map);
  const rec = (x) => {
    if (typeof x === 'string') return rs(x);
    if (typeof x !== 'object' || x === null) return x;
    if (Array.isArray(x)) return x.map(rec);
    const o = Object.create(null);
    for (const k in x) o[rs(k)] = rec(x[k]);
    return o;
  };
  return rec(v);
}

// 反向引用：把内存访问暴露给根内核
export function allocFor(ctx, n) { alloc(ctx, n); }
export function setEffLimit(ctx, limit) { ctx.effLimit = limit; }
