import { OP, NSBC_MAGIC, hashString } from './bytecode.js';

export function createVM(bytecode, options = {}) {
  if (!bytecode || bytecode.magic !== NSBC_MAGIC || !Array.isArray(bytecode.functions)) {
    throw new Error('无效的 NScript 字节码格式');
  }
  const mainFn = bytecode.functions[0];
  return {
    bytecode,
    frames: [
      {
        fnIdx: 0,
        pc: 0,
        locals: new Array(mainFn.localCount).fill(null)
      }
    ],
    stack: [],
    globals: Object.assign({}, options.globals || {}),
    rngState: (options.seed >>> 0) || 0x9e3779b9,
    status: 'ready', // 'ready' | 'trapped' | 'halted' | 'error'
    error: null,
    pendingSyscall: null,
    pendingWork: null, // { costDone, costTotal }
    stepsExecuted: 0,
    memBytes: 512 + JSON.stringify(bytecode).length,
    memCheckCounter: 0,
    stdout: []
  };
}

export function resumeSyscall(vm, returnValue) {
  if (vm.status !== 'trapped') return;
  vm.stack.push(returnValue === undefined ? null : returnValue);
  vm.pendingSyscall = null;
  vm.status = 'ready';
}

export function estimateValueBytes(val, seen = new Set(), budget = 4096) {
  if (val === null || val === undefined) return 4;
  const t = typeof val;
  if (t === 'number' || t === 'boolean') return 8;
  if (t === 'string') return 24 + val.length * 2;
  if (t !== 'object') return 16;
  if (seen.has(val) || seen.size > budget) return 8;
  seen.add(val);
  if (Array.isArray(val)) {
    let bytes = 32;
    for (let i = 0; i < val.length; i++) {
      bytes += 8 + estimateValueBytes(val[i], seen, budget);
    }
    return bytes;
  }
  let bytes = 48;
  const ks = Object.keys(val);
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i];
    bytes += 24 + k.length * 2 + estimateValueBytes(val[k], seen, budget);
  }
  return bytes;
}

export function countValueNodes(val, seen = new Set(), max = 100000) {
  if (val === null || typeof val !== 'object') {
    return typeof val === 'string' ? 1 + Math.ceil(val.length / 32) : 1;
  }
  if (seen.has(val) || seen.size > max) return 1;
  seen.add(val);
  let count = 1;
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) count += countValueNodes(val[i], seen, max);
  } else {
    const ks = Object.keys(val);
    for (let i = 0; i < ks.length; i++) count += 1 + countValueNodes(val[ks[i]], seen, max);
  }
  return count;
}

export function deepCloneValue(val, map = new Map()) {
  if (val === null || typeof val !== 'object') return val;
  if (map.has(val)) return map.get(val);
  if (Array.isArray(val)) {
    const out = new Array(val.length);
    map.set(val, out);
    for (let i = 0; i < val.length; i++) out[i] = deepCloneValue(val[i], map);
    return out;
  }
  const out = {};
  map.set(val, out);
  const ks = Object.keys(val);
  for (let i = 0; i < ks.length; i++) {
    const k = ks[i];
    out[k] = deepCloneValue(val[k], map);
  }
  return out;
}

function nextRand(vm) {
  let x = vm.rngState >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  vm.rngState = x >>> 0;
  return (vm.rngState >>> 0) / 4294967296;
}

function isSafeKey(k) {
  return k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
}

function formatVal(v) {
  if (v === null) return 'null';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '[Object]';
    }
  }
  return String(v);
}

function computeBuiltinCost(name, args) {
  switch (name) {
    case 'clone':
      return 1 + countValueNodes(args[0]);
    case 'json_stringify': {
      const s = countValueNodes(args[0]);
      return 1 + Math.ceil(s / 4);
    }
    case 'json_parse':
      return 1 + Math.ceil(String(args[0] || '').length / 16);
    case 'split':
    case 'replace':
    case 'str_hash':
      return 1 + Math.ceil(String(args[0] || '').length / 24);
    case 'join': {
      const arr = Array.isArray(args[0]) ? args[0] : [];
      return 1 + Math.ceil(arr.length / 8);
    }
    case 'slice': {
      const len = args[0] && args[0].length ? args[0].length : 0;
      const s = Math.max(0, args[1] || 0);
      const e = args[2] === undefined ? len : Math.min(len, args[2]);
      return 1 + Math.ceil(Math.max(0, e - s) / 16);
    }
    case 'concat': {
      const l1 = Array.isArray(args[0]) ? args[0].length : 0;
      const l2 = Array.isArray(args[1]) ? args[1].length : 0;
      return 1 + Math.ceil((l1 + l2) / 16);
    }
    case 'sort_num':
    case 'sort_str': {
      const n = Array.isArray(args[0]) ? args[0].length : 0;
      return 1 + Math.ceil(n * Math.max(1, Math.log2(Math.max(2, n))));
    }
    default:
      return 1;
  }
}

function runBuiltin(vm, name, args) {
  switch (name) {
    case 'len': {
      const x = args[0];
      if (x === null || x === undefined) return 0;
      if (typeof x === 'string' || Array.isArray(x)) return x.length;
      if (typeof x === 'object') return Object.keys(x).length;
      return 0;
    }
    case 'push': {
      if (!Array.isArray(args[0])) throw new Error('push 参数1必须为数组');
      args[0].push(args[1] === undefined ? null : args[1]);
      return args[0].length;
    }
    case 'pop': {
      if (!Array.isArray(args[0])) throw new Error('pop 参数1必须为数组');
      return args[0].length > 0 ? args[0].pop() : null;
    }
    case 'shift': {
      if (!Array.isArray(args[0])) throw new Error('shift 参数1必须为数组');
      return args[0].length > 0 ? args[0].shift() : null;
    }
    case 'slice': {
      const x = args[0];
      if (typeof x === 'string' || Array.isArray(x)) {
        return x.slice(args[1] || 0, args[2] === undefined ? undefined : args[2]);
      }
      return [];
    }
    case 'splice_remove': {
      if (!Array.isArray(args[0])) throw new Error('splice_remove 参数1必须为数组');
      return args[0].splice(args[1] || 0, args[2] === undefined ? 1 : args[2]);
    }
    case 'concat': {
      const a = Array.isArray(args[0]) ? args[0] : [];
      const b = Array.isArray(args[1]) ? args[1] : [];
      return a.concat(b);
    }
    case 'index_of': {
      const x = args[0];
      if (typeof x === 'string' || Array.isArray(x)) {
        return x.indexOf(args[1], args[2] || 0);
      }
      return -1;
    }
    case 'substr': {
      const s = String(args[0] ?? '');
      const start = Number(args[1] || 0);
      if (args[2] === undefined || args[2] === null) return s.slice(start);
      return s.slice(start, start + Number(args[2]));
    }
    case 'char_at': {
      const s = String(args[0] ?? '');
      const idx = Number(args[1] || 0);
      return idx >= 0 && idx < s.length ? s[idx] : '';
    }
    case 'char_code': {
      const s = String(args[0] ?? '');
      const idx = Number(args[1] || 0);
      return idx >= 0 && idx < s.length ? s.charCodeAt(idx) : -1;
    }
    case 'from_char_code':
      return String.fromCharCode(Number(args[0] || 0));
    case 'split':
      return String(args[0] ?? '').split(String(args[1] ?? ''));
    case 'join':
      return Array.isArray(args[0]) ? args[0].map((v) => (v === null ? '' : String(v))).join(String(args[1] ?? ',')) : '';
    case 'trim':
      return String(args[0] ?? '').trim();
    case 'upper':
      return String(args[0] ?? '').toUpperCase();
    case 'lower':
      return String(args[0] ?? '').toLowerCase();
    case 'replace':
      return String(args[0] ?? '').split(String(args[1] ?? '')).join(String(args[2] ?? ''));
    case 'keys':
      return args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) ? Object.keys(args[0]) : [];
    case 'has_key':
      return Boolean(args[0] && typeof args[0] === 'object' && Object.hasOwn(args[0], String(args[1])));
    case 'del_key':
      if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
        const k = String(args[1]);
        if (isSafeKey(k)) delete args[0][k];
      }
      return true;
    case 'type_of': {
      const v = args[0];
      if (v === null) return 'null';
      if (Array.isArray(v)) return 'array';
      if (typeof v === 'object' && (v.__fn !== undefined || v.__builtin !== undefined)) return 'function';
      return typeof v;
    }
    case 'to_str':
      return formatVal(args[0]);
    case 'to_num':
      return Number(args[0]);
    case 'parse_int':
      return parseInt(String(args[0] ?? ''), args[1] || 10);
    case 'is_nan':
      return Number.isNaN(Number(args[0]));
    case 'clone':
      return deepCloneValue(args[0]);
    case 'json_parse':
      return JSON.parse(String(args[0] ?? 'null'));
    case 'json_stringify':
      return JSON.stringify(args[0]);
    case 'str_hash':
      return hashString(String(args[0] ?? ''));
    case 'abs': return Math.abs(Number(args[0]));
    case 'floor': return Math.floor(Number(args[0]));
    case 'ceil': return Math.ceil(Number(args[0]));
    case 'round': return Math.round(Number(args[0]));
    case 'min': return Math.min(...args.map(Number));
    case 'max': return Math.max(...args.map(Number));
    case 'sqrt': return Math.sqrt(Number(args[0]));
    case 'sin': return Math.sin(Number(args[0]));
    case 'cos': return Math.cos(Number(args[0]));
    case 'tan': return Math.tan(Number(args[0]));
    case 'asin': return Math.asin(Number(args[0]));
    case 'acos': return Math.acos(Number(args[0]));
    case 'atan2': return Math.atan2(Number(args[0]), Number(args[1]));
    case 'pow': return Math.pow(Number(args[0]), Number(args[1]));
    case 'exp': return Math.exp(Number(args[0]));
    case 'log': return Math.log(Number(args[0]));
    case 'clamp': {
      const v = Number(args[0]), lo = Number(args[1]), hi = Number(args[2]);
      return v < lo ? lo : v > hi ? hi : v;
    }
    case 'rand':
      return nextRand(vm);
    case 'sort_num': {
      const arr = Array.isArray(args[0]) ? args[0].slice() : [];
      const desc = Boolean(args[1]);
      arr.sort((a, b) => (desc ? Number(b) - Number(a) : Number(a) - Number(b)));
      return arr;
    }
    case 'sort_str': {
      const arr = Array.isArray(args[0]) ? args[0].slice() : [];
      const desc = Boolean(args[1]);
      arr.sort((a, b) => {
        const sa = String(a), sb = String(b);
        return desc ? sb.localeCompare(sa) : sa.localeCompare(sb);
      });
      return arr;
    }
    case 'print_log': {
      const line = args.map(formatVal).join(' ');
      vm.stdout.push(line);
      if (vm.stdout.length > 200) vm.stdout.shift();
      return null;
    }
    default:
      throw new Error(`未知内置函数: ${name}`);
  }
}

export function stepVM(vm, budget, memLimitBytes = Infinity) {
  if (vm.status === 'halted') {
    return { status: 'HALTED', cost: 0, result: null, memBytes: vm.memBytes };
  }
  if (vm.status === 'error') {
    return { status: 'ERROR', cost: 0, error: vm.error, memBytes: vm.memBytes };
  }
  if (vm.status === 'trapped') {
    return { status: 'TRAP', cost: 0, syscall: vm.pendingSyscall.name, args: vm.pendingSyscall.args, memBytes: vm.memBytes };
  }

  let costUsed = 0;
  const consts = vm.bytecode.consts;
  const functions = vm.bytecode.functions;
  const stack = vm.stack;
  const frames = vm.frames;

  function fail(msg) {
    vm.status = 'error';
    vm.error = msg;
    return { status: 'ERROR', cost: costUsed, error: msg, memBytes: vm.memBytes };
  }

  // Helper to pay for an operation whose cost may exceed remaining slice budget
  function payOpCost(totalCost) {
    if (vm.pendingWork) {
      const remNeeded = vm.pendingWork.costTotal - vm.pendingWork.costDone;
      const avail = budget - costUsed;
      if (avail < remNeeded) {
        vm.pendingWork.costDone += avail;
        costUsed += avail;
        return false; // preempted mid-op
      }
      costUsed += remNeeded;
      vm.pendingWork = null;
      return true;
    }
    if (totalCost <= 1) {
      costUsed += 1;
      return true;
    }
    const avail = budget - costUsed;
    if (avail < totalCost) {
      vm.pendingWork = { costDone: avail, costTotal: totalCost };
      costUsed += avail;
      return false;
    }
    costUsed += totalCost;
    return true;
  }

  try {
    while (costUsed < budget) {
      if (frames.length === 0) {
        vm.status = 'halted';
        return { status: 'HALTED', cost: costUsed, result: stack.length ? stack[stack.length - 1] : null, memBytes: vm.memBytes };
      }

      const frame = frames[frames.length - 1];
      const fn = functions[frame.fnIdx];
      const code = fn.code;

      if (frame.pc >= code.length) {
        frames.pop();
        if (frames.length === 0) {
          vm.status = 'halted';
          return { status: 'HALTED', cost: costUsed, result: null, memBytes: vm.memBytes };
        }
        stack.push(null);
        continue;
      }

      // If resuming a multi-step op, handle its cost before decoding again
      const op = code[frame.pc];

      // Pre-check variable-cost operations BEFORE mutating stack or advancing pc
      if (op === OP.ADD && stack.length >= 2) {
        const b = stack[stack.length - 1];
        const a = stack[stack.length - 2];
        if (typeof a === 'string' || typeof b === 'string') {
          const sa = String(a === null ? 'null' : a);
          const sb = String(b === null ? 'null' : b);
          const opCost = 1 + Math.ceil((sa.length + sb.length) / 32);
          if (!payOpCost(opCost)) {
            return { status: 'PREEMPT', cost: costUsed, memBytes: vm.memBytes, remainingWork: vm.pendingWork.costTotal - vm.pendingWork.costDone };
          }
        } else {
          costUsed += 1;
        }
      } else if ((op === OP.EQ || op === OP.NEQ) && stack.length >= 2) {
        const b = stack[stack.length - 1];
        const a = stack[stack.length - 2];
        if (typeof a === 'string' && typeof b === 'string') {
          const opCost = 1 + Math.ceil(Math.min(a.length, b.length) / 32);
          if (!payOpCost(opCost)) {
            return { status: 'PREEMPT', cost: costUsed, memBytes: vm.memBytes, remainingWork: vm.pendingWork.costTotal - vm.pendingWork.costDone };
          }
        } else {
          costUsed += 1;
        }
      } else if (op === OP.CALL) {
        const argc = code[frame.pc + 1];
        const callee = stack[stack.length - 1 - argc];
        if (callee && callee.__builtin) {
          const args = stack.slice(stack.length - argc);
          const opCost = computeBuiltinCost(callee.__builtin, args);
          if (!payOpCost(opCost)) {
            return { status: 'PREEMPT', cost: costUsed, memBytes: vm.memBytes, remainingWork: vm.pendingWork.costTotal - vm.pendingWork.costDone };
          }
        } else {
          costUsed += 1;
        }
      } else if (vm.pendingWork) {
        if (!payOpCost(vm.pendingWork.costTotal)) {
          return { status: 'PREEMPT', cost: costUsed, memBytes: vm.memBytes, remainingWork: vm.pendingWork.costTotal - vm.pendingWork.costDone };
        }
      } else {
        costUsed += 1;
      }

      vm.stepsExecuted += 1;
      vm.memCheckCounter += 1;

      if (vm.memCheckCounter >= 4096) {
        vm.memCheckCounter = 0;
        vm.memBytes = 512 + estimateValueBytes(vm.globals, new Set(), 2048) + estimateValueBytes(frames, new Set(), 512) + estimateValueBytes(stack, new Set(), 512);
        if (vm.memBytes > memLimitBytes) {
          return fail(`内存配额超限 (${vm.memBytes} > ${memLimitBytes} bytes)`);
        }
      }

      switch (op) {
        case OP.CONST: {
          stack.push(consts[code[frame.pc + 1]]);
          frame.pc += 2;
          break;
        }
        case OP.LOAD_LOCAL: {
          stack.push(frame.locals[code[frame.pc + 1]]);
          frame.pc += 2;
          break;
        }
        case OP.STORE_LOCAL: {
          frame.locals[code[frame.pc + 1]] = stack[stack.length - 1];
          frame.pc += 2;
          break;
        }
        case OP.LOAD_GLOBAL: {
          const name = consts[code[frame.pc + 1]];
          stack.push(Object.hasOwn(vm.globals, name) ? vm.globals[name] : null);
          frame.pc += 2;
          break;
        }
        case OP.STORE_GLOBAL: {
          const name = consts[code[frame.pc + 1]];
          if (!isSafeKey(name)) return fail(`非法全局变量名: ${name}`);
          vm.globals[name] = stack[stack.length - 1];
          frame.pc += 2;
          break;
        }
        case OP.LOAD_BUILTIN: {
          const name = consts[code[frame.pc + 1]];
          stack.push({ __builtin: name });
          frame.pc += 2;
          break;
        }
        case OP.POP: {
          stack.pop();
          frame.pc += 1;
          break;
        }
        case OP.DUP: {
          stack.push(stack[stack.length - 1]);
          frame.pc += 1;
          break;
        }
        case OP.DUP2: {
          const b = stack[stack.length - 1];
          const a = stack[stack.length - 2];
          stack.push(a, b);
          frame.pc += 1;
          break;
        }
        case OP.MAKE_ARRAY: {
          const count = code[frame.pc + 1];
          const arr = count > 0 ? stack.splice(stack.length - count, count) : [];
          stack.push(arr);
          frame.pc += 2;
          break;
        }
        case OP.MAKE_OBJECT: {
          const count = code[frame.pc + 1];
          const obj = {};
          const start = stack.length - count * 2;
          for (let i = 0; i < count; i++) {
            const k = String(stack[start + i * 2]);
            const v = stack[start + i * 2 + 1];
            if (isSafeKey(k)) obj[k] = v;
          }
          stack.length = start;
          stack.push(obj);
          frame.pc += 2;
          break;
        }
        case OP.GET_PROP: {
          const key = stack.pop();
          const obj = stack.pop();
          if (obj === null || obj === undefined) {
            stack.push(null);
          } else if (Array.isArray(obj)) {
            if (key === 'length') stack.push(obj.length);
            else {
              const idx = Number(key);
              stack.push(idx >= 0 && idx < obj.length ? obj[idx] : null);
            }
          } else if (typeof obj === 'string') {
            if (key === 'length') stack.push(obj.length);
            else {
              const idx = Number(key);
              stack.push(idx >= 0 && idx < obj.length ? obj[idx] : '');
            }
          } else if (typeof obj === 'object') {
            const sk = String(key);
            stack.push(isSafeKey(sk) && Object.hasOwn(obj, sk) ? obj[sk] : null);
          } else {
            stack.push(null);
          }
          frame.pc += 1;
          break;
        }
        case OP.SET_PROP: {
          const val = stack.pop();
          const key = stack.pop();
          const obj = stack.pop();
          if (obj === null || typeof obj !== 'object') {
            return fail(`无法对非对象设置属性 '${key}'`);
          }
          if (Array.isArray(obj)) {
            const idx = Number(key);
            if (idx < 0 || !Number.isInteger(idx) || idx > 1000000) {
              return fail(`非法数组下标: ${key}`);
            }
            obj[idx] = val;
          } else {
            const sk = String(key);
            if (!isSafeKey(sk)) return fail(`非法属性名: ${sk}`);
            obj[sk] = val;
          }
          stack.push(val);
          frame.pc += 1;
          break;
        }
        case OP.ADD: {
          const b = stack.pop();
          const a = stack.pop();
          if (typeof a === 'string' || typeof b === 'string') {
            stack.push((a === null ? 'null' : String(a)) + (b === null ? 'null' : String(b)));
          } else {
            stack.push(Number(a) + Number(b));
          }
          frame.pc += 1;
          break;
        }
        case OP.SUB: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Number(a) - Number(b));
          frame.pc += 1;
          break;
        }
        case OP.MUL: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(Number(a) * Number(b));
          frame.pc += 1;
          break;
        }
        case OP.DIV: {
          const b = Number(stack.pop());
          const a = Number(stack.pop());
          stack.push(b === 0 ? NaN : a / b);
          frame.pc += 1;
          break;
        }
        case OP.MOD: {
          const b = Number(stack.pop());
          const a = Number(stack.pop());
          stack.push(b === 0 ? NaN : a % b);
          frame.pc += 1;
          break;
        }
        case OP.EQ: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a === b);
          frame.pc += 1;
          break;
        }
        case OP.NEQ: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a !== b);
          frame.pc += 1;
          break;
        }
        case OP.LT: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a < b);
          frame.pc += 1;
          break;
        }
        case OP.LTE: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a <= b);
          frame.pc += 1;
          break;
        }
        case OP.GT: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a > b);
          frame.pc += 1;
          break;
        }
        case OP.GTE: {
          const b = stack.pop();
          const a = stack.pop();
          stack.push(a >= b);
          frame.pc += 1;
          break;
        }
        case OP.NOT: {
          stack.push(!stack.pop());
          frame.pc += 1;
          break;
        }
        case OP.NEG: {
          stack.push(-Number(stack.pop()));
          frame.pc += 1;
          break;
        }
        case OP.JUMP: {
          frame.pc = code[frame.pc + 1];
          break;
        }
        case OP.JUMP_IF_FALSE: {
          const cond = stack.pop();
          if (!cond) frame.pc = code[frame.pc + 1];
          else frame.pc += 2;
          break;
        }
        case OP.JUMP_IF_TRUE: {
          const cond = stack.pop();
          if (cond) frame.pc = code[frame.pc + 1];
          else frame.pc += 2;
          break;
        }
        case OP.MAKE_FN: {
          stack.push({ __fn: code[frame.pc + 1] });
          frame.pc += 2;
          break;
        }
        case OP.CALL: {
          const argc = code[frame.pc + 1];
          const args = argc > 0 ? stack.splice(stack.length - argc, argc) : [];
          const callee = stack.pop();
          frame.pc += 2;
          if (callee && callee.__builtin) {
            const ret = runBuiltin(vm, callee.__builtin, args);
            stack.push(ret === undefined ? null : ret);
            break;
          }
          if (!callee || callee.__fn === undefined || !functions[callee.__fn]) {
            return fail(`试图调用非函数值: ${formatVal(callee)}`);
          }
          if (frames.length >= 256) {
            return fail('调用栈溢出 (> 256)');
          }
          const targetFn = functions[callee.__fn];
          const locals = new Array(targetFn.localCount).fill(null);
          for (let i = 0; i < targetFn.paramCount && i < args.length; i++) {
            locals[i] = args[i];
          }
          frames.push({ fnIdx: callee.__fn, pc: 0, locals });
          break;
        }
        case OP.RETURN: {
          const ret = stack.pop();
          frames.pop();
          if (frames.length === 0) {
            vm.status = 'halted';
            return { status: 'HALTED', cost: costUsed, result: ret, memBytes: vm.memBytes };
          }
          stack.push(ret);
          break;
        }
        case OP.SYSCALL: {
          const argc = code[frame.pc + 1];
          const args = argc > 0 ? stack.splice(stack.length - argc, argc) : [];
          const sysName = String(stack.pop());
          frame.pc += 2;
          vm.status = 'trapped';
          vm.pendingSyscall = { name: sysName, args };
          return { status: 'TRAP', cost: costUsed, syscall: sysName, args, memBytes: vm.memBytes };
        }
        case OP.HALT: {
          frames.length = 0;
          vm.status = 'halted';
          return { status: 'HALTED', cost: costUsed, result: stack.length ? stack[stack.length - 1] : null, memBytes: vm.memBytes };
        }
        default:
          return fail(`未知字节码指令: ${op}`);
      }
    }

    vm.memBytes = 512 + estimateValueBytes(vm.globals, new Set(), 2048) + estimateValueBytes(frames, new Set(), 512) + estimateValueBytes(stack, new Set(), 512);
    if (vm.memBytes > memLimitBytes) {
      return fail(`内存配额超限 (${vm.memBytes} > ${memLimitBytes} bytes)`);
    }
    return {
      status: 'PREEMPT',
      cost: costUsed,
      memBytes: vm.memBytes,
      remainingWork: vm.pendingWork ? vm.pendingWork.costTotal - vm.pendingWork.costDone : 0
    };
  } catch (err) {
    return fail(err && err.message ? err.message : String(err));
  }
}
