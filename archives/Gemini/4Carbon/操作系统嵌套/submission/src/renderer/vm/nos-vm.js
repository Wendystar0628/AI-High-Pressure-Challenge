(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NosVMModule = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isRef(v) {
    return v !== null && typeof v === 'object' && typeof v.$ref === 'number';
  }

  function estimatePrimitiveBytes(v) {
    if (v === null || v === undefined) return 8;
    const t = typeof v;
    if (t === 'boolean' || t === 'number') return 8;
    if (t === 'string') return 16 + v.length * 2;
    if (isRef(v)) return 8;
    return 16;
  }

  class NosVM {
    constructor(bytecode, options = {}) {
      if (!bytecode || bytecode.magic !== 'NOSBC1' || !Array.isArray(bytecode.functions)) {
        throw new Error('Invalid NOSBC1 bytecode executable');
      }
      this.bytecode = bytecode;
      this.isKernel = Boolean(options.isKernel);
      this.memLimit = typeof options.memLimit === 'number' ? options.memLimit : 16 * 1024 * 1024;
      this.rngState = typeof options.rngState === 'number' ? (options.rngState >>> 0) : 0x2400beef;

      this.heap = {};
      this.nextHeapId = 1;
      this.globals = {};
      this.frames = [];
      this.status = 'ready'; // ready | running | paused_syscall | exited | error
      this.exitValue = null;
      this.error = null;
      this.pendingSyscall = null;
      this.pendingOp = null; // { totalCost, paidCost, commitData }

      this.totalOpsSelf = 0;
      this.totalOpsChildren = 0;
      this.selfMemBytes = 512;
      this.approxBytes = 512;
      this.memBytes = 512;
      this.dirtyMem = true;

      // Child VMs managed when this VM runs kernel.nos
      this.childVMs = {};
      this.nextChildVmId = 1;

      // Host bridge callbacks ONLY for top-level boundary syscalls on kernel VMs
      this.hostHandler = options.hostHandler || null;

      // Build function map
      this.fnMap = new Map();
      for (let i = 0; i < bytecode.functions.length; i++) {
        this.fnMap.set(bytecode.functions[i].name, i);
      }

      const entryName = bytecode.entry || 'main';
      const entryIdx = this.fnMap.has(entryName) ? this.fnMap.get(entryName) : 0;
      const entryFn = bytecode.functions[entryIdx];
      if (!entryFn) {
        this.status = 'error';
        this.error = 'Entry function not found';
      } else {
        const locals = new Array(entryFn.localCount || 0).fill(null);
        if (Array.isArray(options.entryArgs)) {
          for (let i = 0; i < Math.min(options.entryArgs.length, entryFn.paramCount || 0); i++) {
            locals[i] = this.importValue(options.entryArgs[i]);
          }
        }
        this.frames.push({
          fnIdx: entryIdx,
          ip: 0,
          locals,
          stack: []
        });
      }
    }

    setHostHandler(fn) {
      this.hostHandler = fn;
    }

    nextRandom() {
      let x = this.rngState || 0x12345678;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.rngState = x >>> 0;
      return (this.rngState >>> 0) / 4294967296;
    }

    allocArray(items = []) {
      const id = this.nextHeapId++;
      this.heap[id] = { type: 'arr', items };
      this.approxBytes += 32 + items.length * 8;
      this.dirtyMem = true;
      return { $ref: id };
    }

    allocObject(entries = {}) {
      const id = this.nextHeapId++;
      this.heap[id] = { type: 'obj', entries };
      this.approxBytes += 32 + Object.keys(entries).length * 24;
      this.dirtyMem = true;
      return { $ref: id };
    }

    deref(v) {
      if (isRef(v)) {
        return this.heap[v.$ref] || null;
      }
      return null;
    }

    importValue(jsVal, depth = 0) {
      if (depth > 64) return null;
      if (jsVal === null || jsVal === undefined) return null;
      const t = typeof jsVal;
      if (t === 'boolean' || t === 'number' || t === 'string') {
        this.dirtyMem = true;
        return jsVal;
      }
      if (Array.isArray(jsVal)) {
        const arr = new Array(jsVal.length);
        for (let i = 0; i < jsVal.length; i++) {
          arr[i] = this.importValue(jsVal[i], depth + 1);
        }
        return this.allocArray(arr);
      }
      if (t === 'object') {
        if (isRef(jsVal) && this.heap[jsVal.$ref]) {
          return jsVal;
        }
        const entries = {};
        const keys = Object.keys(jsVal);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          entries[k] = this.importValue(jsVal[k], depth + 1);
        }
        return this.allocObject(entries);
      }
      return String(jsVal);
    }

    exportValue(vmVal, seen = new Map(), depth = 0) {
      if (depth > 64) return null;
      if (vmVal === null || vmVal === undefined) return null;
      if (!isRef(vmVal)) return vmVal;
      if (seen.has(vmVal.$ref)) return seen.get(vmVal.$ref);
      const cell = this.heap[vmVal.$ref];
      if (!cell) return null;
      if (cell.type === 'arr') {
        const out = new Array(cell.items.length);
        seen.set(vmVal.$ref, out);
        for (let i = 0; i < cell.items.length; i++) {
          out[i] = this.exportValue(cell.items[i], seen, depth + 1);
        }
        return out;
      }
      if (cell.type === 'obj') {
        const out = {};
        seen.set(vmVal.$ref, out);
        const keys = Object.keys(cell.entries);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          out[k] = this.exportValue(cell.entries[k], seen, depth + 1);
        }
        return out;
      }
      return null;
    }

    cloneInHeap(vmVal, seen = new Map()) {
      if (vmVal === null || vmVal === undefined || !isRef(vmVal)) {
        return { val: vmVal, nodes: 1 };
      }
      if (seen.has(vmVal.$ref)) {
        return { val: seen.get(vmVal.$ref), nodes: 1 };
      }
      const cell = this.heap[vmVal.$ref];
      if (!cell) return { val: null, nodes: 1 };
      let nodes = 1;
      if (cell.type === 'arr') {
        const items = new Array(cell.items.length);
        const ref = this.allocArray(items);
        seen.set(vmVal.$ref, ref);
        for (let i = 0; i < cell.items.length; i++) {
          const sub = this.cloneInHeap(cell.items[i], seen);
          items[i] = sub.val;
          nodes += sub.nodes;
        }
        return { val: ref, nodes };
      }
      const entries = {};
      const ref = this.allocObject(entries);
      seen.set(vmVal.$ref, ref);
      const keys = Object.keys(cell.entries);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const sub = this.cloneInHeap(cell.entries[k], seen);
        entries[k] = sub.val;
        nodes += sub.nodes;
      }
      return { val: ref, nodes };
    }

    gcAndMeasureMemory() {
      // Mark-and-sweep live heap objects so temporary allocations don't leak quota
      const marked = new Set();
      const queue = [];

      const markVal = (v) => {
        if (isRef(v) && !marked.has(v.$ref) && this.heap[v.$ref]) {
          marked.add(v.$ref);
          queue.push(v.$ref);
        }
      };

      const gKeys = Object.keys(this.globals);
      for (let i = 0; i < gKeys.length; i++) markVal(this.globals[gKeys[i]]);

      for (let f = 0; f < this.frames.length; f++) {
        const fr = this.frames[f];
        for (let i = 0; i < fr.locals.length; i++) markVal(fr.locals[i]);
        for (let i = 0; i < fr.stack.length; i++) markVal(fr.stack[i]);
      }

      if (this.pendingSyscall && Array.isArray(this.pendingSyscall.rawArgs)) {
        for (const v of this.pendingSyscall.rawArgs) markVal(v);
      }
      if (this.pendingOp && this.pendingOp.resultVal !== undefined) {
        markVal(this.pendingOp.resultVal);
      }

      while (queue.length > 0) {
        const id = queue.pop();
        const cell = this.heap[id];
        if (!cell) continue;
        if (cell.type === 'arr') {
          for (let i = 0; i < cell.items.length; i++) markVal(cell.items[i]);
        } else if (cell.type === 'obj') {
          const ks = Object.keys(cell.entries);
          for (let i = 0; i < ks.length; i++) markVal(cell.entries[ks[i]]);
        }
      }

      let bytes = 512 + this.frames.length * 96;
      for (let i = 0; i < gKeys.length; i++) {
        bytes += 16 + gKeys[i].length * 2 + estimatePrimitiveBytes(this.globals[gKeys[i]]);
      }
      for (let f = 0; f < this.frames.length; f++) {
        const fr = this.frames[f];
        for (let i = 0; i < fr.locals.length; i++) bytes += estimatePrimitiveBytes(fr.locals[i]);
        for (let i = 0; i < fr.stack.length; i++) bytes += estimatePrimitiveBytes(fr.stack[i]);
      }

      const allHeapIds = Object.keys(this.heap);
      for (let i = 0; i < allHeapIds.length; i++) {
        const id = Number(allHeapIds[i]);
        if (!marked.has(id)) {
          delete this.heap[id];
        } else {
          const cell = this.heap[id];
          bytes += 32;
          if (cell.type === 'arr') {
            for (let j = 0; j < cell.items.length; j++) {
              bytes += estimatePrimitiveBytes(cell.items[j]);
            }
          } else if (cell.type === 'obj') {
            const ks = Object.keys(cell.entries);
            for (let j = 0; j < ks.length; j++) {
              bytes += 16 + ks[j].length * 2 + estimatePrimitiveBytes(cell.entries[ks[j]]);
            }
          }
        }
      }

      // Include child VMs memory if kernel carrier
      let childBytes = 0;
      const cIds = Object.keys(this.childVMs);
      for (let i = 0; i < cIds.length; i++) {
        const cvm = this.childVMs[cIds[i]];
        if (cvm) childBytes += cvm.getMemoryBytes();
      }

      this.selfMemBytes = bytes;
      this.approxBytes = bytes;
      this.memBytes = bytes + childBytes;
      this.dirtyMem = false;
      return this.memBytes;
    }

    checkMemoryQuota() {
      let childBytes = 0;
      const cIds = Object.keys(this.childVMs);
      for (let i = 0; i < cIds.length; i++) {
        const cvm = this.childVMs[cIds[i]];
        if (cvm) childBytes += cvm.approxBytes || 512;
      }
      if (this.approxBytes + childBytes <= this.memLimit) {
        return true;
      }
      return this.gcAndMeasureMemory() <= this.memLimit;
    }

    getMemoryBytes() {
      let childBytes = 0;
      const cIds = Object.keys(this.childVMs);
      for (let i = 0; i < cIds.length; i++) {
        const cvm = this.childVMs[cIds[i]];
        if (cvm) childBytes += cvm.getMemoryBytes();
      }
      if (this.dirtyMem && this.approxBytes > (this.selfMemBytes || 512) * 2 + 65536) {
        this.gcAndMeasureMemory();
      } else {
        this.selfMemBytes = this.approxBytes;
      }
      this.memBytes = (this.selfMemBytes || 512) + childBytes;
      return this.memBytes;
    }

    getRemainingWork() {
      let rem = 0;
      if (this.pendingOp) {
        rem += Math.max(0, this.pendingOp.totalCost - this.pendingOp.paidCost);
      }
      const cIds = Object.keys(this.childVMs);
      for (let i = 0; i < cIds.length; i++) {
        const cvm = this.childVMs[cIds[i]];
        if (cvm) rem += cvm.getRemainingWork();
      }
      return rem;
    }

    truthy(v) {
      if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
      if (typeof v === 'number' && Number.isNaN(v)) return false;
      return true;
    }

    equals(a, b) {
      if (isRef(a) && isRef(b)) return a.$ref === b.$ref;
      return a === b;
    }

    toDisplayString(v, depth = 0) {
      if (v === null || v === undefined) return 'null';
      if (!isRef(v)) return String(v);
      if (depth > 4) return '[...]';
      const cell = this.heap[v.$ref];
      if (!cell) return 'null';
      if (cell.type === 'arr') {
        return '[' + cell.items.map((x) => this.toDisplayString(x, depth + 1)).join(', ') + ']';
      }
      const ks = Object.keys(cell.entries);
      return '{' + ks.map((k) => k + ': ' + this.toDisplayString(cell.entries[k], depth + 1)).join(', ') + '}';
    }

    resumeSyscall(jsReturnValue) {
      if (this.status !== 'paused_syscall') {
        throw new Error('Cannot resumeSyscall when VM status is ' + this.status);
      }
      const retVal = this.importValue(jsReturnValue);
      const top = this.frames[this.frames.length - 1];
      if (top) {
        top.stack.push(retVal);
      }
      this.pendingSyscall = null;
      this.status = 'ready';
      if (!this.checkMemoryQuota()) {
        this.status = 'error';
        this.error = 'E_MEM_QUOTA: 内存配额不足 (' + this.memBytes + ' > ' + this.memLimit + ')';
      }
    }

    failSyscall(errMsg) {
      this.pendingSyscall = null;
      this.status = 'error';
      this.error = String(errMsg);
    }

    callBuiltin(name, args) {
      switch (name) {
        case 'len': {
          const x = args[0];
          if (typeof x === 'string') return { val: x.length, cost: 1 };
          const c = this.deref(x);
          if (!c) return { val: 0, cost: 1 };
          if (c.type === 'arr') return { val: c.items.length, cost: 1 };
          if (c.type === 'obj') return { val: Object.keys(c.entries).length, cost: 1 };
          return { val: 0, cost: 1 };
        }
        case 'push': {
          const c = this.deref(args[0]);
          if (!c || c.type !== 'arr') throw new Error('push() expects array');
          for (let i = 1; i < args.length; i++) {
            c.items.push(args[i]);
            this.approxBytes += estimatePrimitiveBytes(args[i]);
          }
          this.dirtyMem = true;
          return { val: c.items.length, cost: Math.max(1, args.length - 1) };
        }
        case 'pop': {
          const c = this.deref(args[0]);
          if (!c || c.type !== 'arr') return { val: null, cost: 1 };
          this.dirtyMem = true;
          return { val: c.items.length ? c.items.pop() : null, cost: 1 };
        }
        case 'shift': {
          const c = this.deref(args[0]);
          if (!c || c.type !== 'arr' || c.items.length === 0) return { val: null, cost: 1 };
          this.dirtyMem = true;
          const cost = 1 + Math.ceil(c.items.length / 32);
          return { val: c.items.shift(), cost };
        }
        case 'slice': {
          const x = args[0];
          const s = args[1] !== undefined && args[1] !== null ? Number(args[1]) : 0;
          if (typeof x === 'string') {
            const e = args[2] !== undefined && args[2] !== null ? Number(args[2]) : x.length;
            const out = x.slice(s, e);
            this.dirtyMem = true;
            return { val: out, cost: 1 + Math.ceil(out.length / 32) };
          }
          const c = this.deref(x);
          if (c && c.type === 'arr') {
            const e = args[2] !== undefined && args[2] !== null ? Number(args[2]) : c.items.length;
            const out = c.items.slice(s, e);
            return { val: this.allocArray(out), cost: 1 + Math.ceil(out.length / 8) };
          }
          return { val: null, cost: 1 };
        }
        case 'substr': {
          const str = String(args[0] ?? '');
          const start = Number(args[1] || 0);
          const len = args[2] !== undefined && args[2] !== null ? Number(args[2]) : str.length - start;
          const out = str.substr(start, len);
          this.dirtyMem = true;
          return { val: out, cost: 1 + Math.ceil(out.length / 32) };
        }
        case 'char_at': {
          const str = String(args[0] ?? '');
          const idx = Number(args[1] || 0);
          return { val: idx >= 0 && idx < str.length ? str[idx] : '', cost: 1 };
        }
        case 'char_code': {
          const str = String(args[0] ?? '');
          const idx = Number(args[1] || 0);
          return { val: idx >= 0 && idx < str.length ? str.charCodeAt(idx) : -1, cost: 1 };
        }
        case 'from_char_code': {
          return { val: String.fromCharCode(Number(args[0] || 0)), cost: 1 };
        }
        case 'index_of': {
          const x = args[0];
          const needle = args[1];
          const fromIdx = args[2] !== undefined && args[2] !== null ? Number(args[2]) : 0;
          if (typeof x === 'string') {
            const sNeedle = String(needle ?? '');
            return { val: x.indexOf(sNeedle, fromIdx), cost: 1 + Math.ceil(x.length / 48) };
          }
          const c = this.deref(x);
          if (c && c.type === 'arr') {
            for (let i = Math.max(0, fromIdx); i < c.items.length; i++) {
              if (this.equals(c.items[i], needle)) {
                return { val: i, cost: 1 + Math.ceil((i + 1) / 16) };
              }
            }
            return { val: -1, cost: 1 + Math.ceil(c.items.length / 16) };
          }
          return { val: -1, cost: 1 };
        }
        case 'split': {
          const s = String(args[0] ?? '');
          const sep = String(args[1] ?? '');
          const parts = s.split(sep);
          return { val: this.allocArray(parts), cost: 1 + Math.ceil(s.length / 24) };
        }
        case 'join': {
          const c = this.deref(args[0]);
          const sep = String(args[1] ?? '');
          if (!c || c.type !== 'arr') return { val: '', cost: 1 };
          const out = c.items.map((v) => this.toDisplayString(v)).join(sep);
          this.dirtyMem = true;
          return { val: out, cost: 1 + Math.ceil(out.length / 32) };
        }
        case 'trim': {
          const s = String(args[0] ?? '');
          return { val: s.trim(), cost: 1 + Math.ceil(s.length / 64) };
        }
        case 'replace': {
          const s = String(args[0] ?? '');
          const a = String(args[1] ?? '');
          const b = String(args[2] ?? '');
          const out = a ? s.split(a).join(b) : s;
          this.dirtyMem = true;
          return { val: out, cost: 1 + Math.ceil(s.length / 32) };
        }
        case 'keys': {
          const c = this.deref(args[0]);
          if (!c || c.type !== 'obj') return { val: this.allocArray([]), cost: 1 };
          const ks = Object.keys(c.entries);
          return { val: this.allocArray(ks), cost: 1 + Math.ceil(ks.length / 8) };
        }
        case 'has_key': {
          const c = this.deref(args[0]);
          const k = String(args[1] ?? '');
          if (!c || c.type !== 'obj') return { val: false, cost: 1 };
          return { val: Object.prototype.hasOwnProperty.call(c.entries, k), cost: 1 };
        }
        case 'delete_key': {
          const c = this.deref(args[0]);
          const k = String(args[1] ?? '');
          if (c && c.type === 'obj') {
            delete c.entries[k];
            this.dirtyMem = true;
          }
          return { val: true, cost: 1 };
        }
        case 'clone': {
          const res = this.cloneInHeap(args[0]);
          return { val: res.val, cost: 1 + Math.ceil(res.nodes / 4) };
        }
        case 'json_encode': {
          const jsObj = this.exportValue(args[0]);
          const str = JSON.stringify(jsObj);
          this.dirtyMem = true;
          return { val: str, cost: 2 + Math.ceil((str ? str.length : 0) / 48) };
        }
        case 'json_decode': {
          const str = String(args[0] ?? '');
          const parsed = JSON.parse(str);
          const val = this.importValue(parsed);
          return { val, cost: 2 + Math.ceil(str.length / 48) };
        }
        case 'num': {
          const n = Number(args[0]);
          return { val: Number.isNaN(n) ? 0 : n, cost: 1 };
        }
        case 'parse_num': {
          const n = Number(args[0]);
          return { val: n, cost: 1 };
        }
        case 'is_nan': {
          return { val: Number.isNaN(Number(args[0])), cost: 1 };
        }
        case 'str': {
          return { val: this.toDisplayString(args[0]), cost: 1 };
        }
        case 'type_of': {
          const v = args[0];
          if (v === null || v === undefined) return { val: 'null', cost: 1 };
          if (isRef(v)) {
            const c = this.deref(v);
            return { val: c ? (c.type === 'arr' ? 'array' : 'object') : 'null', cost: 1 };
          }
          return { val: typeof v, cost: 1 };
        }
        case 'sin': return { val: Math.sin(Number(args[0] || 0)), cost: 1 };
        case 'cos': return { val: Math.cos(Number(args[0] || 0)), cost: 1 };
        case 'tan': return { val: Math.tan(Number(args[0] || 0)), cost: 1 };
        case 'atan2': return { val: Math.atan2(Number(args[0] || 0), Number(args[1] || 0)), cost: 1 };
        case 'sqrt': return { val: Math.sqrt(Math.max(0, Number(args[0] || 0))), cost: 1 };
        case 'abs': return { val: Math.abs(Number(args[0] || 0)), cost: 1 };
        case 'min': return { val: Math.min(Number(args[0] || 0), Number(args[1] || 0)), cost: 1 };
        case 'max': return { val: Math.max(Number(args[0] || 0), Number(args[1] || 0)), cost: 1 };
        case 'clamp': {
          const v = Number(args[0] || 0);
          const lo = Number(args[1] || 0);
          const hi = Number(args[2] || 0);
          return { val: Math.max(lo, Math.min(hi, v)), cost: 1 };
        }
        case 'floor': return { val: Math.floor(Number(args[0] || 0)), cost: 1 };
        case 'ceil': return { val: Math.ceil(Number(args[0] || 0)), cost: 1 };
        case 'round': return { val: Math.round(Number(args[0] || 0)), cost: 1 };
        case 'pow': return { val: Math.pow(Number(args[0] || 0), Number(args[1] || 0)), cost: 1 };
        case 'rand': return { val: this.nextRandom(), cost: 1 };

        // Kernel-only hardware virtualization substrate intrinsics
        case '__vm_spawn': {
          if (!this.isKernel) throw new Error('E_PERM: __vm_spawn is kernel-only');
          const bcObj = this.exportValue(args[0]);
          const memQuota = Number(args[1] || 4 * 1024 * 1024);
          const isChildKernel = Boolean(args[2]);
          const entryArgs = args[3] ? this.exportValue(args[3]) : [];
          const childVm = new NosVM(bcObj, {
            isKernel: isChildKernel,
            memLimit: memQuota,
            rngState: (this.rngState ^ (this.nextChildVmId * 0x9e3779b9)) >>> 0,
            entryArgs
          });
          const cid = this.nextChildVmId++;
          this.childVMs[cid] = childVm;
          this.dirtyMem = true;
          return { val: cid, cost: 8 };
        }
        case '__vm_kill': {
          if (!this.isKernel) throw new Error('E_PERM: __vm_kill is kernel-only');
          const cid = Number(args[0]);
          delete this.childVMs[cid];
          this.dirtyMem = true;
          return { val: true, cost: 2 };
        }
        case '__vm_resume': {
          if (!this.isKernel) throw new Error('E_PERM: __vm_resume is kernel-only');
          const cid = Number(args[0]);
          const retJs = this.exportValue(args[1]);
          const cvm = this.childVMs[cid];
          if (!cvm) return { val: false, cost: 1 };
          cvm.resumeSyscall(retJs);
          this.dirtyMem = true;
          return { val: true, cost: 2 };
        }
        case '__vm_fail': {
          if (!this.isKernel) throw new Error('E_PERM: __vm_fail is kernel-only');
          const cid = Number(args[0]);
          const msg = String(args[1] ?? 'Syscall error');
          const cvm = this.childVMs[cid];
          if (cvm) cvm.failSyscall(msg);
          return { val: true, cost: 1 };
        }
        case '__vm_info': {
          if (!this.isKernel) throw new Error('E_PERM: __vm_info is kernel-only');
          const cid = Number(args[0]);
          const cvm = this.childVMs[cid];
          if (!cvm) return { val: null, cost: 1 };
          return {
            val: this.importValue({
              status: cvm.status,
              memBytes: cvm.getMemoryBytes(),
              remainingWork: cvm.getRemainingWork(),
              opsSelf: cvm.totalOpsSelf,
              opsChildren: cvm.totalOpsChildren,
              error: cvm.error
            }),
            cost: 1
          };
        }
        case '__vm_set_mem_limit': {
          if (!this.isKernel) throw new Error('E_PERM: __vm_set_mem_limit is kernel-only');
          const cid = Number(args[0]);
          const limit = Number(args[1]);
          const cvm = this.childVMs[cid];
          if (cvm && limit > 0) cvm.memLimit = limit;
          return { val: true, cost: 1 };
        }
        default:
          return null;
      }
    }

    step(budget) {
      let maxBudget = Math.max(0, Math.floor(budget));
      if (this.status === 'exited') {
        return { status: 'exit', value: this.exportValue(this.exitValue), consumed: 0, selfConsumed: 0, childConsumed: 0 };
      }
      if (this.status === 'error') {
        return { status: 'error', error: this.error, consumed: 0, selfConsumed: 0, childConsumed: 0 };
      }
      if (this.status === 'paused_syscall') {
        return {
          status: 'syscall',
          name: this.pendingSyscall.name,
          args: this.pendingSyscall.args,
          consumed: 0,
          selfConsumed: 0,
          childConsumed: 0
        };
      }
      if (maxBudget <= 0) {
        return { status: 'yield', consumed: 0, selfConsumed: 0, childConsumed: 0, remainingWork: this.getRemainingWork() };
      }

      this.status = 'running';
      let selfConsumed = 0;
      let childConsumed = 0;
      let opsSinceMemCheck = 0;

      const remainingBudget = () => maxBudget - selfConsumed - childConsumed;

      try {
        while (remainingBudget() > 0) {
          // 1. Pay down any partially paid multi-unit operation before committing it!
          if (this.pendingOp) {
            const needed = this.pendingOp.totalCost - this.pendingOp.paidCost;
            const avail = remainingBudget();
            if (avail < needed) {
              this.pendingOp.paidCost += avail;
              selfConsumed += avail;
              this.totalOpsSelf += avail;
              this.status = 'ready';
              return {
                status: 'yield',
                consumed: selfConsumed + childConsumed,
                selfConsumed,
                childConsumed,
                remainingWork: this.getRemainingWork()
              };
            }
            selfConsumed += needed;
            this.totalOpsSelf += needed;
            const doneOp = this.pendingOp;
            this.pendingOp = null;
            this.commitPendingOp(doneOp);
            if (this.status === 'paused_syscall') {
              return {
                status: 'syscall',
                name: this.pendingSyscall.name,
                args: this.pendingSyscall.args,
                consumed: selfConsumed + childConsumed,
                selfConsumed,
                childConsumed
              };
            }
            continue;
          }

          if (this.frames.length === 0) {
            this.status = 'exited';
            return {
              status: 'exit',
              value: this.exportValue(this.exitValue),
              consumed: selfConsumed + childConsumed,
              selfConsumed,
              childConsumed
            };
          }

          const frame = this.frames[this.frames.length - 1];
          const fn = this.bytecode.functions[frame.fnIdx];
          if (frame.ip >= fn.code.length) {
            this.frames.pop();
            if (this.frames.length === 0) {
              this.exitValue = null;
              this.status = 'exited';
              return {
                status: 'exit',
                value: null,
                consumed: selfConsumed + childConsumed,
                selfConsumed,
                childConsumed
              };
            }
            this.frames[this.frames.length - 1].stack.push(null);
            continue;
          }

          const ins = fn.code[frame.ip];
          const op = ins[0];

          // Periodic O(1) memory quota check (runs full GC only if approxBytes exceeds memLimit)
          opsSinceMemCheck++;
          if (opsSinceMemCheck >= 256 && this.dirtyMem) {
            opsSinceMemCheck = 0;
            if (!this.checkMemoryQuota()) {
              throw new Error('E_MEM_QUOTA: 内存配额不足 (' + this.memBytes + ' > ' + this.memLimit + ')');
            }
          }

          switch (op) {
            case 'CONST': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              frame.stack.push(ins[1]);
              break;
            }
            case 'LOAD_LOCAL': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              frame.stack.push(frame.locals[ins[1]] ?? null);
              break;
            }
            case 'STORE_LOCAL': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const v = frame.stack[frame.stack.length - 1] ?? null;
              frame.locals[ins[1]] = v;
              break;
            }
            case 'LOAD_GLOBAL': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const name = ins[1];
              frame.stack.push(Object.prototype.hasOwnProperty.call(this.globals, name) ? this.globals[name] : null);
              break;
            }
            case 'STORE_GLOBAL': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const v = frame.stack[frame.stack.length - 1] ?? null;
              this.globals[ins[1]] = v;
              this.dirtyMem = true;
              break;
            }
            case 'POP': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              frame.stack.pop();
              break;
            }
            case 'DUP': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              frame.stack.push(frame.stack[frame.stack.length - 1] ?? null);
              break;
            }
            case 'ADD': {
              const b = frame.stack.pop();
              const a = frame.stack.pop();
              let res;
              let cost = 1;
              if (typeof a === 'string' || typeof b === 'string') {
                const sa = this.toDisplayString(a);
                const sb = this.toDisplayString(b);
                res = sa + sb;
                cost = 1 + Math.floor((sa.length + sb.length) / 64);
                this.approxBytes += 16 + res.length * 2;
                this.dirtyMem = true;
              } else {
                res = Number(a || 0) + Number(b || 0);
              }
              frame.ip++;
              if (cost > remainingBudget()) {
                const avail = remainingBudget();
                selfConsumed += avail;
                this.totalOpsSelf += avail;
                this.pendingOp = { totalCost: cost, paidCost: avail, kind: 'push', resultVal: res };
                this.status = 'ready';
                return {
                  status: 'yield',
                  consumed: selfConsumed + childConsumed,
                  selfConsumed,
                  childConsumed,
                  remainingWork: this.getRemainingWork()
                };
              }
              selfConsumed += cost;
              this.totalOpsSelf += cost;
              frame.stack.push(res);
              break;
            }
            case 'SUB': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = Number(frame.stack.pop() || 0);
              const a = Number(frame.stack.pop() || 0);
              frame.stack.push(a - b);
              break;
            }
            case 'MUL': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = Number(frame.stack.pop() || 0);
              const a = Number(frame.stack.pop() || 0);
              frame.stack.push(a * b);
              break;
            }
            case 'DIV': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = Number(frame.stack.pop() || 0);
              const a = Number(frame.stack.pop() || 0);
              if (b === 0) throw new Error('E_DIV_ZERO: 除零错误');
              frame.stack.push(a / b);
              break;
            }
            case 'MOD': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = Number(frame.stack.pop() || 0);
              const a = Number(frame.stack.pop() || 0);
              if (b === 0) throw new Error('E_DIV_ZERO: 取模除零错误');
              frame.stack.push(a % b);
              break;
            }
            case 'NEG': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              frame.stack.push(-Number(frame.stack.pop() || 0));
              break;
            }
            case 'NOT': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              frame.stack.push(!this.truthy(frame.stack.pop()));
              break;
            }
            case 'EQ':
            case 'NEQ': {
              const b = frame.stack.pop();
              const a = frame.stack.pop();
              let cost = 1;
              if (typeof a === 'string' && typeof b === 'string') {
                cost = 1 + Math.floor(Math.min(a.length, b.length) / 64);
              }
              const eq = this.equals(a, b);
              const res = op === 'EQ' ? eq : !eq;
              frame.ip++;
              selfConsumed += Math.min(cost, remainingBudget());
              this.totalOpsSelf += Math.min(cost, remainingBudget());
              frame.stack.push(res);
              break;
            }
            case 'LT': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = frame.stack.pop();
              const a = frame.stack.pop();
              frame.stack.push(typeof a === 'string' && typeof b === 'string' ? a < b : Number(a || 0) < Number(b || 0));
              break;
            }
            case 'LTE': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = frame.stack.pop();
              const a = frame.stack.pop();
              frame.stack.push(typeof a === 'string' && typeof b === 'string' ? a <= b : Number(a || 0) <= Number(b || 0));
              break;
            }
            case 'GT': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = frame.stack.pop();
              const a = frame.stack.pop();
              frame.stack.push(typeof a === 'string' && typeof b === 'string' ? a > b : Number(a || 0) > Number(b || 0));
              break;
            }
            case 'GTE': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const b = frame.stack.pop();
              const a = frame.stack.pop();
              frame.stack.push(typeof a === 'string' && typeof b === 'string' ? a >= b : Number(a || 0) >= Number(b || 0));
              break;
            }
            case 'JMP': {
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              frame.ip = ins[1];
              break;
            }
            case 'JMP_IF_FALSE': {
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const cond = frame.stack.pop();
              if (!this.truthy(cond)) frame.ip = ins[1];
              else frame.ip++;
              break;
            }
            case 'JMP_IF_TRUE': {
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const cond = frame.stack.pop();
              if (this.truthy(cond)) frame.ip = ins[1];
              else frame.ip++;
              break;
            }
            case 'MAKE_ARR': {
              const count = ins[1];
              const items = new Array(count);
              for (let i = count - 1; i >= 0; i--) {
                items[i] = frame.stack.pop() ?? null;
              }
              const ref = this.allocArray(items);
              const cost = 1 + Math.floor(count / 8);
              frame.ip++;
              if (this.gcCheckNeeded(count) && !this.checkMemoryQuota()) {
                throw new Error('E_MEM_QUOTA: 内存配额不足');
              }
              if (cost > remainingBudget()) {
                const avail = remainingBudget();
                selfConsumed += avail;
                this.totalOpsSelf += avail;
                this.pendingOp = { totalCost: cost, paidCost: avail, kind: 'push', resultVal: ref };
                this.status = 'ready';
                return { status: 'yield', consumed: selfConsumed + childConsumed, selfConsumed, childConsumed, remainingWork: this.getRemainingWork() };
              }
              selfConsumed += cost;
              this.totalOpsSelf += cost;
              frame.stack.push(ref);
              break;
            }
            case 'MAKE_OBJ': {
              const count = ins[1];
              const entries = {};
              for (let i = count - 1; i >= 0; i--) {
                const val = frame.stack.pop() ?? null;
                const key = String(frame.stack.pop() ?? '');
                entries[key] = val;
              }
              const ref = this.allocObject(entries);
              const cost = 1 + Math.floor(count / 8);
              frame.ip++;
              if (this.gcCheckNeeded(count) && !this.checkMemoryQuota()) {
                throw new Error('E_MEM_QUOTA: 内存配额不足');
              }
              selfConsumed += Math.min(cost, remainingBudget());
              this.totalOpsSelf += Math.min(cost, remainingBudget());
              frame.stack.push(ref);
              break;
            }
            case 'GET_PROP': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const key = frame.stack.pop();
              const target = frame.stack.pop();
              if (typeof target === 'string') {
                if (key === 'length') {
                  frame.stack.push(target.length);
                } else {
                  const idx = Number(key);
                  frame.stack.push(idx >= 0 && idx < target.length ? target[idx] : null);
                }
                break;
              }
              const cell = this.deref(target);
              if (!cell) {
                throw new Error('E_NULL_PROP: 无法读取空对象的属性 ' + String(key));
              }
              if (cell.type === 'arr') {
                if (key === 'length') {
                  frame.stack.push(cell.items.length);
                } else {
                  const idx = Number(key);
                  frame.stack.push(idx >= 0 && idx < cell.items.length ? cell.items[idx] : null);
                }
              } else {
                const k = String(key);
                frame.stack.push(Object.prototype.hasOwnProperty.call(cell.entries, k) ? cell.entries[k] : null);
              }
              break;
            }
            case 'SET_PROP': {
              frame.ip++;
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const val = frame.stack.pop();
              const key = frame.stack.pop();
              const target = frame.stack.pop();
              const cell = this.deref(target);
              if (!cell) {
                throw new Error('E_NULL_PROP: 无法写入空对象的属性 ' + String(key));
              }
              if (cell.type === 'arr') {
                const idx = Number(key);
                if (idx < 0 || !Number.isInteger(idx)) throw new Error('E_INDEX: 非法数组下标 ' + String(key));
                while (cell.items.length < idx) cell.items.push(null);
                cell.items[idx] = val;
              } else {
                cell.entries[String(key)] = val;
              }
              this.dirtyMem = true;
              frame.stack.push(val);
              break;
            }
            case 'CALL': {
              const fnName = ins[1];
              const argc = ins[2];
              const args = new Array(argc);
              for (let i = argc - 1; i >= 0; i--) {
                args[i] = frame.stack.pop() ?? null;
              }

              // Special handling for __vm_step so child budget draws directly from remainingBudget()
              if (fnName === '__vm_step') {
                if (!this.isKernel) throw new Error('E_PERM: __vm_step is kernel-only');
                frame.ip++;
                selfConsumed += 1;
                this.totalOpsSelf += 1;
                const cid = Number(args[0]);
                const requestedSlice = Math.max(0, Math.floor(Number(args[1] || 0)));
                const cvm = this.childVMs[cid];
                if (!cvm) {
                  frame.stack.push(this.importValue({ status: 'error', error: 'Child VM not found', consumed: 0 }));
                  break;
                }
                const allowedSlice = Math.min(requestedSlice, remainingBudget());
                const stepRes = cvm.step(allowedSlice);
                childConsumed += stepRes.consumed;
                this.totalOpsChildren += stepRes.consumed;
                this.dirtyMem = true;
                frame.stack.push(this.importValue({
                  status: stepRes.status,
                  consumed: stepRes.consumed,
                  selfConsumed: stepRes.selfConsumed || 0,
                  childConsumed: stepRes.childConsumed || 0,
                  remainingWork: cvm.getRemainingWork(),
                  memBytes: cvm.getMemoryBytes(),
                  name: stepRes.name || null,
                  args: stepRes.args || null,
                  value: stepRes.value !== undefined ? stepRes.value : null,
                  error: stepRes.error || null
                }));
                break;
              }

              if (this.fnMap.has(fnName)) {
                frame.ip++;
                selfConsumed += 1;
                this.totalOpsSelf += 1;
                if (this.frames.length >= 256) {
                  throw new Error('E_STACK_OVERFLOW: 调用栈溢出');
                }
                const targetIdx = this.fnMap.get(fnName);
                const targetFn = this.bytecode.functions[targetIdx];
                const locals = new Array(targetFn.localCount || 0).fill(null);
                for (let i = 0; i < Math.min(argc, targetFn.paramCount || 0); i++) {
                  locals[i] = args[i];
                }
                this.frames.push({
                  fnIdx: targetIdx,
                  ip: 0,
                  locals,
                  stack: []
                });
                break;
              }

              const builtinRes = this.callBuiltin(fnName, args);
              if (builtinRes) {
                frame.ip++;
                const cost = Math.max(1, builtinRes.cost || 1);
                if (this.dirtyMem && !this.checkMemoryQuota()) {
                  throw new Error('E_MEM_QUOTA: 内存配额不足 (' + this.memBytes + ' > ' + this.memLimit + ')');
                }
                if (cost > remainingBudget()) {
                  const avail = remainingBudget();
                  selfConsumed += avail;
                  this.totalOpsSelf += avail;
                  this.pendingOp = { totalCost: cost, paidCost: avail, kind: 'push', resultVal: builtinRes.val };
                  this.status = 'ready';
                  return {
                    status: 'yield',
                    consumed: selfConsumed + childConsumed,
                    selfConsumed,
                    childConsumed,
                    remainingWork: this.getRemainingWork()
                  };
                }
                selfConsumed += cost;
                this.totalOpsSelf += cost;
                frame.stack.push(builtinRes.val);
                break;
              }

              throw new Error('E_UNDEF_FN: 未定义函数 ' + fnName);
            }
            case 'SYSCALL': {
              const argc = ins[1];
              const rawArgs = new Array(argc);
              for (let i = argc - 1; i >= 0; i--) {
                rawArgs[i] = frame.stack.pop() ?? null;
              }
              const callName = String(rawArgs[0] ?? '');
              const exportedArgs = rawArgs.slice(1).map((a) => this.exportValue(a));
              // Charge argument marshaling cost proportional to payload size
              const marshalStr = JSON.stringify(exportedArgs);
              const cost = 2 + Math.floor((marshalStr ? marshalStr.length : 0) / 128);
              frame.ip++;

              if (this.isKernel && this.hostHandler) {
                // Top-level host port on root-hosted carrier VM
                const hostRes = this.hostHandler(callName, exportedArgs);
                const totalCost = cost + Math.max(0, Math.floor(hostRes && typeof hostRes.cost === 'number' ? hostRes.cost : 0));
                const retVal = this.importValue(hostRes ? hostRes.value : null);
                if (totalCost > remainingBudget()) {
                  const avail = remainingBudget();
                  selfConsumed += avail;
                  this.totalOpsSelf += avail;
                  this.pendingOp = { totalCost, paidCost: avail, kind: 'push', resultVal: retVal };
                  this.status = 'ready';
                  return {
                    status: 'yield',
                    consumed: selfConsumed + childConsumed,
                    selfConsumed,
                    childConsumed,
                    remainingWork: this.getRemainingWork()
                  };
                }
                selfConsumed += totalCost;
                this.totalOpsSelf += totalCost;
                frame.stack.push(retVal);
                break;
              }

              // Yield syscall up to parent kernel VM!
              if (cost > remainingBudget()) {
                const avail = remainingBudget();
                selfConsumed += avail;
                this.totalOpsSelf += avail;
                this.pendingOp = {
                  totalCost: cost,
                  paidCost: avail,
                  kind: 'syscall',
                  syscallData: { name: callName, args: exportedArgs }
                };
                this.status = 'ready';
                return {
                  status: 'yield',
                  consumed: selfConsumed + childConsumed,
                  selfConsumed,
                  childConsumed,
                  remainingWork: this.getRemainingWork()
                };
              }
              selfConsumed += cost;
              this.totalOpsSelf += cost;
              this.pendingSyscall = { name: callName, args: exportedArgs };
              this.status = 'paused_syscall';
              return {
                status: 'syscall',
                name: callName,
                args: exportedArgs,
                consumed: selfConsumed + childConsumed,
                selfConsumed,
                childConsumed
              };
            }
            case 'RET': {
              selfConsumed += 1;
              this.totalOpsSelf += 1;
              const retVal = frame.stack.length > 0 ? frame.stack.pop() : null;
              this.frames.pop();
              if (this.frames.length === 0) {
                this.exitValue = retVal;
                this.status = 'exited';
                return {
                  status: 'exit',
                  value: this.exportValue(retVal),
                  consumed: selfConsumed + childConsumed,
                  selfConsumed,
                  childConsumed
                };
              }
              this.frames[this.frames.length - 1].stack.push(retVal);
              break;
            }
            default:
              throw new Error('E_BAD_OP: 未知字节码指令 ' + String(op));
          }
        }

        if (this.dirtyMem && !this.checkMemoryQuota()) {
          throw new Error('E_MEM_QUOTA: 内存配额不足 (' + this.memBytes + ' > ' + this.memLimit + ')');
        }
        this.status = 'ready';
        return {
          status: 'yield',
          consumed: selfConsumed + childConsumed,
          selfConsumed,
          childConsumed,
          remainingWork: this.getRemainingWork()
        };
      } catch (err) {
        this.status = 'error';
        this.error = err && err.message ? err.message : String(err);
        return {
          status: 'error',
          error: this.error,
          consumed: selfConsumed + childConsumed,
          selfConsumed,
          childConsumed
        };
      }
    }

    gcCheckNeeded(allocCount) {
      return allocCount > 16;
    }

    commitPendingOp(doneOp) {
      if (doneOp.kind === 'push') {
        const top = this.frames[this.frames.length - 1];
        if (top) top.stack.push(doneOp.resultVal);
      } else if (doneOp.kind === 'syscall') {
        this.pendingSyscall = doneOp.syscallData;
        this.status = 'paused_syscall';
      }
    }

    serialize() {
      this.gcAndMeasureMemory();
      const childrenSnap = {};
      const cIds = Object.keys(this.childVMs);
      for (let i = 0; i < cIds.length; i++) {
        const cid = cIds[i];
        if (this.childVMs[cid]) {
          childrenSnap[cid] = this.childVMs[cid].serialize();
        }
      }
      return JSON.parse(JSON.stringify({
        bytecode: this.bytecode,
        isKernel: this.isKernel,
        memLimit: this.memLimit,
        rngState: this.rngState,
        heap: this.heap,
        nextHeapId: this.nextHeapId,
        globals: this.globals,
        frames: this.frames,
        status: this.status === 'running' ? 'ready' : this.status,
        exitValue: this.exitValue,
        error: this.error,
        pendingSyscall: this.pendingSyscall,
        pendingOp: this.pendingOp,
        totalOpsSelf: this.totalOpsSelf,
        totalOpsChildren: this.totalOpsChildren,
        selfMemBytes: this.selfMemBytes,
        memBytes: this.memBytes,
        nextChildVmId: this.nextChildVmId,
        childVMs: childrenSnap
      }));
    }

    static deserialize(snap, options = {}) {
      const data = JSON.parse(JSON.stringify(snap));
      const vm = new NosVM(data.bytecode, {
        isKernel: data.isKernel,
        memLimit: data.memLimit,
        rngState: data.rngState,
        hostHandler: options.hostHandler || null
      });
      vm.heap = data.heap || {};
      vm.nextHeapId = data.nextHeapId || 1;
      vm.globals = data.globals || {};
      vm.frames = data.frames || [];
      vm.status = data.status || 'ready';
      vm.exitValue = data.exitValue ?? null;
      vm.error = data.error ?? null;
      vm.pendingSyscall = data.pendingSyscall ?? null;
      vm.pendingOp = data.pendingOp ?? null;
      vm.totalOpsSelf = data.totalOpsSelf || 0;
      vm.totalOpsChildren = data.totalOpsChildren || 0;
      vm.selfMemBytes = data.selfMemBytes || 512;
      vm.memBytes = data.memBytes || 512;
      vm.dirtyMem = true;
      vm.nextChildVmId = data.nextChildVmId || 1;
      vm.childVMs = {};
      if (data.childVMs) {
        const cIds = Object.keys(data.childVMs);
        for (let i = 0; i < cIds.length; i++) {
          const cid = cIds[i];
          vm.childVMs[cid] = NosVM.deserialize(data.childVMs[cid]);
        }
      }
      return vm;
    }
  }

  return { NosVM };
});
