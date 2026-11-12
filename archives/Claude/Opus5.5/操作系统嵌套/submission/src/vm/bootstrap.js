// 引导编译器（宿主 JS 实现，仅用于构建时首次编译系统内的编译器程序 compiler.nest）。
// 运行时所有程序都由系统文件里的 compiler.nest 编译（见 tools/build-image.mjs）。
import { OP, PRIMS, hashStr } from './vm.js';

export class CompileError extends Error { constructor(msg, line) { super(msg); this.line = line; } }

// ---------- 读取器 ----------
export function read(src) {
  let i = 0, line = 1; const n = src.length;
  const forms = [];
  const skip = () => {
    for (;;) {
      while (i < n && /\s/.test(src[i])) { if (src[i] === '\n') line++; i++; }
      if (src[i] === ';') { while (i < n && src[i] !== '\n') i++; continue; }
      break;
    }
  };
  const sym = (name, ln) => ({ k: 'sym', name, line: ln });
  const expandSym = (tok, ln) => {
    if (tok.length > 1 && tok.includes('.') && !tok.startsWith('.') && !tok.endsWith('.') && !tok.includes('..')) {
      const parts = tok.split('.');
      let node = sym(parts[0], ln);
      for (let j = 1; j < parts.length; j++) node = { k: 'list', items: [sym('get', ln), node, { k: 'str', v: parts[j] }], line: ln };
      return node;
    }
    return sym(tok, ln);
  };
  const readOne = () => {
    skip();
    if (i >= n) throw new CompileError('意外的文件结尾', line);
    const c = src[i];
    const ln = line;
    if (c === '(' || c === '[' || c === '{') {
      const close = c === '(' ? ')' : c === '[' ? ']' : '}';
      i++;
      const items = [];
      if (c === '[') items.push(sym('list', ln));
      if (c === '{') items.push(sym('dict', ln));
      for (;;) {
        skip();
        if (i >= n) throw new CompileError(`缺少 ${close}（始于第 ${ln} 行）`, ln);
        if (src[i] === close) { i++; break; }
        if (src[i] === ')' || src[i] === ']' || src[i] === '}') throw new CompileError(`括号不匹配：遇到 ${src[i]}`, line);
        items.push(readOne());
      }
      return { k: 'list', items, line: ln };
    }
    if (c === ')' || c === ']' || c === '}') throw new CompileError(`多余的 ${c}`, line);
    if (c === '"') {
      i++; let s = '';
      for (;;) {
        if (i >= n) throw new CompileError('字符串未结束', ln);
        const ch = src[i++];
        if (ch === '"') break;
        if (ch === '\\') {
          const e = src[i++];
          if (e === 'n') s += '\n'; else if (e === 't') s += '\t'; else if (e === 'r') s += '\r'; else s += e;
        } else { if (ch === '\n') line++; s += ch; }
      }
      return { k: 'str', v: s };
    }
    let j = i;
    while (j < n && !/[\s()\[\]{}";]/.test(src[j])) j++;
    const tok = src.slice(i, j); i = j;
    if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(tok)) return Number(tok);
    if (tok[0] === ':' && tok.length > 1) return { k: 'str', v: tok.slice(1) };
    return expandSym(tok, ln);
  };
  for (;;) { skip(); if (i >= n) break; forms.push(readOne()); }
  return forms;
}

const BIN = { '+': OP.ADD, '-': OP.SUB, '*': OP.MUL, '/': OP.DIV, '%': OP.MOD, '<': OP.LT, '>': OP.GT, '<=': OP.LE, '>=': OP.GE, '=': OP.EQ, '!=': OP.NE };

export function compile(src, opts = {}) {
  const name = opts.name || 'program';
  const deps = [];
  const readFile = opts.readFile || (() => { throw new CompileError('无法读取包含文件'); });
  const included = new Set();
  const expand = (forms) => {
    const out = [];
    for (const f of forms) {
      if (f && f.k === 'list' && f.items[0] && f.items[0].k === 'sym' && f.items[0].name === 'include') {
        const p = f.items[1] && f.items[1].v;
        if (included.has(p)) continue;
        included.add(p);
        const txt = readFile(p);
        if (txt == null) throw new CompileError(`找不到包含文件 ${p}`, f.line);
        deps.push([p, hashStr(txt)]);
        out.push(...expand(read(txt)));
      } else out.push(f);
    }
    return out;
  };
  const forms = expand(read(src));
  const userGlobals = new Set();
  for (const f of forms) {
    if (f && f.k === 'list' && f.items[0] && f.items[0].k === 'sym' && ['def', 'defn', 'var'].includes(f.items[0].name) && f.items[1] && f.items[1].k === 'sym') userGlobals.add(f.items[1].name);
  }
  const funcs = [];
  const newFn = (fname, parent, isMain) => {
    const fs = { n: fname, p: 0, r: 0, code: [], k: [], kmap: new Map(), vars: new Map(), nl: 0, ln: [], lastLine: -1, parent, isMain, loops: [], tryDepth: 0, idx: funcs.length };
    funcs.push(fs);
    return fs;
  };
  let fs = null;
  const emit = (...xs) => { fs.code.push(...xs); };
  const here = () => fs.code.length;
  const kidx = (v) => {
    const key = typeof v + ':' + v;
    if (fs.kmap.has(key)) return fs.kmap.get(key);
    const id = fs.k.length; fs.k.push(v); fs.kmap.set(key, id); return id;
  };
  const markLine = (node) => { if (node && node.line && node.line !== fs.lastLine) { fs.ln.push(here(), node.line); fs.lastLine = node.line; } };
  const declare = (vname) => { if (fs.vars.has(vname)) return fs.vars.get(vname); const id = fs.nl++; fs.vars.set(vname, id); return id; };
  let tmpSeq = 0;
  const temp = () => declare(' t' + (tmpSeq++));
  const resolve = (vname) => {
    let d = 0; let f = fs;
    while (f) {
      if (f.vars.has(vname)) return { kind: d === 0 ? 'local' : 'up', d, i: f.vars.get(vname) };
      f = f.parent; d++;
    }
    return { kind: 'global' };
  };
  const isSym = (x, nm) => x && x.k === 'sym' && (nm === undefined || x.name === nm);
  const err = (msg, node) => { throw new CompileError(msg, node && node.line); };

  const loadVar = (vname, node) => {
    if (vname === 'true') return emit(OP.TRUE);
    if (vname === 'false') return emit(OP.FALSE);
    if (vname === 'nil') return emit(OP.NIL);
    const r = resolve(vname);
    if (r.kind === 'local') emit(OP.LOCAL, r.i);
    else if (r.kind === 'up') emit(OP.UPVAL, r.d, r.i);
    else {
      if (!userGlobals.has(vname) && PRIMS[vname]) err(`原语 ${vname} 不能作为值使用，请用 (fn (x) (${vname} x)) 包装`, node);
      emit(OP.GLOBAL, kidx(vname));
    }
  };
  const storeVar = (vname) => {
    const r = resolve(vname);
    if (r.kind === 'local') emit(OP.SETLOCAL, r.i);
    else if (r.kind === 'up') emit(OP.SETUPVAL, r.d, r.i);
    else emit(OP.SETGLOBAL, kidx(vname));
  };
  const nil = (want) => { if (want) emit(OP.NIL); };

  const body = (items, want, tail) => {
    if (items.length === 0) return nil(want);
    for (let j = 0; j < items.length - 1; j++) c(items[j], false, false);
    c(items[items.length - 1], want, tail);
  };
  const jump = (op) => { emit(op, -1); return here() - 1; };
  const patch = (at, to) => { fs.code[at] = to === undefined ? here() : to; };

  const compileFn = (fname, params, bodyItems, node) => {
    const saved = fs;
    const nf = newFn(fname, saved, false);
    fs = nf;
    let rest = false;
    const ps = params.items || [];
    for (let j = 0; j < ps.length; j++) {
      const p = ps[j];
      if (!isSym(p)) err('参数必须是名字', node);
      if (p.name === '&') { rest = true; continue; }
      declare(p.name);
      if (!rest) nf.p++;
    }
    nf.r = rest ? 1 : 0;
    markLine(node);
    body(bodyItems, true, true);
    emit(OP.RET);
    fs = saved;
    return nf.idx;
  };

  const loopBreak = (node, kind) => {
    const L = fs.loops[fs.loops.length - 1];
    if (!L) err(`${kind} 只能用在循环中`, node);
    for (let j = 0; j < fs.tryDepth - L.tryDepth; j++) emit(OP.ENDTRY);
    const at = jump(OP.JMP);
    (kind === 'break' ? L.breaks : L.conts).push(at);
  };

  function c(node, want, tail) {
    if (typeof node === 'number') { if (want) emit(OP.CONST, kidx(node)); return; }
    if (node.k === 'str') { if (want) emit(OP.CONST, kidx(node.v)); return; }
    if (node.k === 'sym') { if (want) loadVar(node.name, node); return; }
    const it = node.items;
    if (it.length === 0) return nil(want);
    markLine(node);
    const h = it[0];
    const hn = isSym(h) ? h.name : null;
    const local = hn && resolve(hn).kind !== 'global';
    if (hn && !local) {
      switch (hn) {
        case 'do': return body(it.slice(1), want, tail);
        case 'if': {
          c(it[1], true, false);
          const jf = jump(OP.JF);
          c(it[2] === undefined ? { k: 'sym', name: 'nil' } : it[2], want, tail);
          const je = jump(OP.JMP);
          patch(jf);
          if (it[3] !== undefined) c(it[3], want, tail); else nil(want);
          patch(je);
          return;
        }
        case 'when': case 'unless': {
          c(it[1], true, false);
          const jf = jump(hn === 'when' ? OP.JF : OP.JT);
          body(it.slice(2), want, tail);
          const je = jump(OP.JMP);
          patch(jf); nil(want); patch(je);
          return;
        }
        case 'cond': {
          const ends = [];
          let hadElse = false;
          for (let j = 1; j < it.length; j++) {
            const cl = it[j];
            if (!cl.items) err('cond 子句格式错误', node);
            if (isSym(cl.items[0], 'else')) { body(cl.items.slice(1), want, tail); hadElse = true; break; }
            c(cl.items[0], true, false);
            const jf = jump(OP.JF);
            body(cl.items.slice(1), want, tail);
            ends.push(jump(OP.JMP));
            patch(jf);
          }
          if (!hadElse) nil(want);
          for (const e of ends) patch(e);
          return;
        }
        case 'case': {
          const t = temp();
          c(it[1], true, false); emit(OP.SETLOCAL, t);
          const ends = []; let hadElse = false;
          for (let j = 2; j < it.length; j++) {
            const cl = it[j];
            if (isSym(cl.items[0], 'else')) { body(cl.items.slice(1), want, tail); hadElse = true; break; }
            const vals = (cl.items[0].k === 'list') ? cl.items[0].items : [cl.items[0]];
            const hits = [];
            for (const v of vals) { emit(OP.LOCAL, t); c(v, true, false); emit(OP.EQ); hits.push(jump(OP.JT)); }
            const skipJ = jump(OP.JMP);
            for (const hj of hits) patch(hj);
            body(cl.items.slice(1), want, tail);
            ends.push(jump(OP.JMP));
            patch(skipJ);
          }
          if (!hadElse) nil(want);
          for (const e of ends) patch(e);
          return;
        }
        case 'and': case 'or': {
          if (it.length === 1) { if (want) emit(hn === 'and' ? OP.TRUE : OP.FALSE); return; }
          const ends = [];
          for (let j = 1; j < it.length; j++) {
            c(it[j], true, false);
            if (j < it.length - 1) ends.push(jump(hn === 'and' ? OP.JFK : OP.JTK));
          }
          for (const e of ends) patch(e);
          if (!want) emit(OP.POP);
          return;
        }
        case 'not': c(it[1], true, false); emit(OP.NOT); if (!want) emit(OP.POP); return;
        case 'while': {
          const L = { breaks: [], conts: [], tryDepth: fs.tryDepth };
          const start = here();
          c(it[1], true, false);
          const jf = jump(OP.JF);
          fs.loops.push(L);
          body(it.slice(2), false, false);
          fs.loops.pop();
          for (const x of L.conts) patch(x, start);
          emit(OP.JMP, start);
          patch(jf);
          for (const x of L.breaks) patch(x);
          nil(want);
          return;
        }
        case 'for': {
          const spec = it[1].items;
          if (!spec || spec.length < 3) err('for 格式: (for (i 起 止 [步长]) ...)', node);
          const iv = fs.isMain ? temp() : declare(spec[0].name);
          if (fs.isMain) fs.vars.set(spec[0].name, iv);
          const lim = temp(); const stp = temp();
          c(spec[1], true, false); emit(OP.SETLOCAL, iv);
          c(spec[2], true, false); emit(OP.SETLOCAL, lim);
          if (spec[3] !== undefined) c(spec[3], true, false); else emit(OP.CONST, kidx(1));
          emit(OP.SETLOCAL, stp);
          const L = { breaks: [], conts: [], tryDepth: fs.tryDepth };
          const start = here();
          // 步长为负时用 >，否则用 <
          emit(OP.LOCAL, stp, OP.CONST, kidx(0), OP.LT);
          const jneg = jump(OP.JT);
          emit(OP.LOCAL, iv, OP.LOCAL, lim, OP.LT);
          const jok = jump(OP.JMP);
          patch(jneg);
          emit(OP.LOCAL, iv, OP.LOCAL, lim, OP.GT);
          patch(jok);
          const jf = jump(OP.JF);
          fs.loops.push(L);
          body(it.slice(2), false, false);
          fs.loops.pop();
          const cont = here();
          for (const x of L.conts) patch(x, cont);
          emit(OP.LOCAL, iv, OP.LOCAL, stp, OP.ADD, OP.SETLOCAL, iv, OP.JMP, start);
          patch(jf);
          for (const x of L.breaks) patch(x);
          nil(want);
          return;
        }
        case 'each': case 'each-i': case 'each-kv': {
          const spec = it[1].items;
          const lst = temp(); const idx = temp();
          let iv = -1, xv = -1, kv = -1, m = -1;
          const decl = (sname) => { if (fs.isMain) { const t = temp(); fs.vars.set(sname, t); return t; } return declare(sname); };
          if (hn === 'each') { xv = decl(spec[0].name); c(spec[1], true, false); }
          else if (hn === 'each-i') { iv = decl(spec[0].name); xv = decl(spec[1].name); c(spec[2], true, false); }
          else { kv = decl(spec[0].name); xv = decl(spec[1].name); m = temp(); c(spec[2], true, false); emit(OP.DUP, OP.SETLOCAL, m, OP.PRIM, kidx('keys'), 1); }
          emit(OP.SETLOCAL, lst);
          emit(OP.CONST, kidx(0), OP.SETLOCAL, idx);
          const L = { breaks: [], conts: [], tryDepth: fs.tryDepth };
          const start = here();
          emit(OP.LOCAL, idx, OP.LOCAL, lst, OP.PRIM, kidx('len'), 1, OP.LT);
          const jf = jump(OP.JF);
          if (hn === 'each-kv') {
            emit(OP.LOCAL, lst, OP.LOCAL, idx, OP.GET, OP.SETLOCAL, kv, OP.LOCAL, m, OP.LOCAL, kv, OP.GET, OP.SETLOCAL, xv);
          } else {
            emit(OP.LOCAL, lst, OP.LOCAL, idx, OP.GET, OP.SETLOCAL, xv);
            if (iv >= 0) emit(OP.LOCAL, idx, OP.SETLOCAL, iv);
          }
          fs.loops.push(L);
          body(it.slice(2), false, false);
          fs.loops.pop();
          const cont = here();
          for (const x of L.conts) patch(x, cont);
          emit(OP.LOCAL, idx, OP.CONST, kidx(1), OP.ADD, OP.SETLOCAL, idx, OP.JMP, start);
          patch(jf);
          for (const x of L.breaks) patch(x);
          nil(want);
          return;
        }
        case 'break': loopBreak(node, 'break'); if (want) emit(OP.NIL); return;
        case 'continue': loopBreak(node, 'continue'); if (want) emit(OP.NIL); return;
        case 'return': if (it[1] !== undefined) c(it[1], true, false); else emit(OP.NIL); emit(OP.RET); if (want) emit(OP.NIL); return;
        case 'fn': {
          let params = it[1], rest = 2, fname = 'lambda';
          if (isSym(params)) { fname = params.name; params = it[2]; rest = 3; }
          const fi = compileFn(fname, params, it.slice(rest), node);
          if (want) emit(OP.CLOSURE, fi);
          return;
        }
        case 'defn': {
          const fi = compileFn(it[1].name, it[2], it.slice(3), node);
          emit(OP.CLOSURE, fi);
          if (want) emit(OP.DUP);
          emit(OP.SETGLOBAL, kidx(it[1].name));
          return;
        }
        case 'def': {
          c(it[2] === undefined ? { k: 'sym', name: 'nil' } : it[2], true, false);
          if (want) emit(OP.DUP);
          emit(OP.SETGLOBAL, kidx(it[1].name));
          return;
        }
        case 'var': {
          if (!isSym(it[1])) err('var 需要名字', node);
          c(it[2] === undefined ? { k: 'sym', name: 'nil' } : it[2], true, false);
          if (want) emit(OP.DUP);
          if (fs.isMain && !fs.vars.has(it[1].name)) emit(OP.SETGLOBAL, kidx(it[1].name));
          else { const id = declare(it[1].name); emit(OP.SETLOCAL, id); }
          return;
        }
        case 'let': {
          for (const b of it[1].items) {
            c(b.items[1], true, false);
            if (fs.isMain) emit(OP.SETGLOBAL, kidx(b.items[0].name)); else emit(OP.SETLOCAL, declare(b.items[0].name));
          }
          return body(it.slice(2), want, tail);
        }
        case 'set!': case 'inc!': case 'dec!': {
          const tgt = it[1];
          let valNode = it[2];
          if (hn !== 'set!') valNode = { k: 'list', items: [{ k: 'sym', name: hn === 'inc!' ? '+' : '-' }, tgt, it[2] === undefined ? 1 : it[2]], line: node.line };
          if (isSym(tgt)) {
            c(valNode, true, false);
            if (want) emit(OP.DUP);
            storeVar(tgt.name);
            return;
          }
          if (tgt.k === 'list' && isSym(tgt.items[0], 'get')) {
            c(tgt.items[1], true, false); c(tgt.items[2], true, false); c(valNode, true, false);
            emit(OP.PUT); if (!want) emit(OP.POP);
            return;
          }
          return err('set! 的目标必须是名字或 a.b 形式', node);
        }
        case 'try': {
          const last = it[it.length - 1];
          let bodyItems = it.slice(1), handler = null;
          if (last && last.k === 'list' && isSym(last.items[0], 'catch')) { bodyItems = it.slice(1, -1); handler = last; }
          const jt = jump(OP.TRY);
          fs.tryDepth++;
          body(bodyItems, true, false);
          fs.tryDepth--;
          emit(OP.ENDTRY);
          const je = jump(OP.JMP);
          patch(jt);
          if (handler) {
            const ev = handler.items[1];
            if (fs.isMain) { const t = temp(); fs.vars.set(ev.name, t); emit(OP.SETLOCAL, t); }
            else emit(OP.SETLOCAL, declare(ev.name));
            body(handler.items.slice(2), true, false);
          }
          patch(je);
          if (!want) emit(OP.POP);
          return;
        }
        case 'throw': c(it[1], true, false); emit(OP.THROW); if (want) emit(OP.NIL); return;
        case 'sys': {
          for (let j = 1; j < it.length; j++) c(it[j], true, false);
          emit(OP.SYS, it.length - 1);
          if (!want) emit(OP.POP);
          return;
        }
        case 'list': for (let j = 1; j < it.length; j++) c(it[j], true, false); emit(OP.LIST, it.length - 1); if (!want) emit(OP.POP); return;
        case 'dict': {
          if ((it.length - 1) % 2) err('dict 需要成对的键和值', node);
          for (let j = 1; j < it.length; j++) c(it[j], true, false);
          emit(OP.DICT, (it.length - 1) / 2); if (!want) emit(OP.POP); return;
        }
        case 'get': if (it.length === 3) { c(it[1], true, false); c(it[2], true, false); emit(OP.GET); if (!want) emit(OP.POP); return; } break;
        case 'put!': c(it[1], true, false); c(it[2], true, false); c(it[3], true, false); emit(OP.PUT); if (!want) emit(OP.POP); return;
        case 'apply': c(it[1], true, false); c(it[2], true, false); emit(OP.APPLY); if (!want) emit(OP.POP); return;
        case 'include': return err('include 只能出现在顶层', node);
        case 'quote': if (want) emit(OP.CONST, kidx(it[1].name)); return;
        default: break;
      }
      if (BIN[hn] !== undefined) {
        const op = BIN[hn];
        const args = it.slice(1);
        if (hn === '-' && args.length === 1) { c(args[0], true, false); emit(OP.NEG); }
        else if (((hn === '+' || hn === '*') && args.length !== 2) || (hn === '-' && args.length > 2)) {
          if (args.length === 0) emit(OP.CONST, kidx(hn === '+' ? 0 : 1));
          else { c(args[0], true, false); for (let j = 1; j < args.length; j++) { c(args[j], true, false); emit(op); } }
        } else {
          if (args.length !== 2) err(`${hn} 需要两个参数`, node);
          c(args[0], true, false); c(args[1], true, false); emit(op);
        }
        if (!want) emit(OP.POP);
        return;
      }
      if (!userGlobals.has(hn) && PRIMS[hn]) {
        for (let j = 1; j < it.length; j++) c(it[j], true, false);
        emit(OP.PRIM, kidx(hn), it.length - 1);
        if (!want) emit(OP.POP);
        return;
      }
    }
    // 普通调用
    c(h, true, false);
    for (let j = 1; j < it.length; j++) c(it[j], true, false);
    if (tail && fs.tryDepth === 0 && !fs.isMain) emit(OP.TCALL, it.length - 1);
    else emit(OP.CALL, it.length - 1);
    if (!want) emit(OP.POP);
  }

  fs = newFn('main', null, true);
  try {
    body(forms, true, false);
    emit(OP.RET);
  } catch (e) {
    if (e instanceof CompileError) throw e;
    throw new CompileError(String(e.message || e), 0);
  }
  return {
    format: 'nest-exe', v: 1, name,
    funcs: funcs.map((f) => ({ n: f.n, p: f.p, l: f.nl, r: f.r, c: f.code, k: f.k, ln: f.ln })),
    deps, compiler: 'bootstrap',
  };
}
