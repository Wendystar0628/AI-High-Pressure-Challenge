import { NSBC_MAGIC, NSBC_VERSION, OP, hashString } from './bytecode.js';

export const BUILTIN_NAMES = new Set([
  'len', 'push', 'pop', 'shift', 'slice', 'splice_remove', 'concat',
  'index_of', 'substr', 'char_at', 'char_code', 'from_char_code',
  'split', 'join', 'trim', 'upper', 'lower', 'replace',
  'keys', 'has_key', 'del_key', 'type_of', 'to_str', 'to_num',
  'parse_int', 'is_nan', 'clone', 'json_parse', 'json_stringify', 'str_hash',
  'abs', 'floor', 'ceil', 'round', 'min', 'max', 'sqrt',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan2', 'pow', 'exp', 'log',
  'clamp', 'rand', 'sort_num', 'sort_str', 'print_log'
]);

const KEYWORDS = new Set([
  'let', 'fn', 'if', 'else', 'while', 'for', 'return', 'break', 'continue',
  'true', 'false', 'null', 'syscall'
]);

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = source.length;

  function adv(cnt = 1) {
    for (let k = 0; k < cnt; k++) {
      if (source[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  }

  while (i < n) {
    const ch = source[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      adv();
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') adv();
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const sl = line;
      adv(2);
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        adv();
      }
      if (i >= n) throw new SyntaxError(`未闭合的多行注释 (line ${sl})`);
      adv(2);
      continue;
    }

    const startLine = line;
    const startCol = col;

    // Number
    const code = ch.charCodeAt(0);
    if ((code >= 48 && code <= 57) || (ch === '.' && i + 1 < n && source.charCodeAt(i + 1) >= 48 && source.charCodeAt(i + 1) <= 57)) {
      let numStr = '';
      if (ch === '0' && (source[i + 1] === 'x' || source[i + 1] === 'X')) {
        numStr += '0x';
        adv(2);
        while (i < n) {
          const c = source.charCodeAt(i);
          if ((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)) {
            numStr += source[i];
            adv();
          } else break;
        }
        tokens.push({ type: 'NUM', value: parseInt(numStr, 16), line: startLine, col: startCol });
        continue;
      }
      let hasDot = false;
      while (i < n) {
        const c = source.charCodeAt(i);
        if (c >= 48 && c <= 57) {
          numStr += source[i];
          adv();
        } else if (source[i] === '.' && !hasDot) {
          hasDot = true;
          numStr += '.';
          adv();
        } else {
          break;
        }
      }
      tokens.push({ type: 'NUM', value: Number(numStr), line: startLine, col: startCol });
      continue;
    }

    // String
    if (ch === '"' || ch === "'") {
      const quote = ch;
      adv();
      let str = '';
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') {
          adv();
          if (i >= n) throw new SyntaxError(`未闭合的字符串转义 (line ${startLine})`);
          const esc = source[i];
          if (esc === 'n') str += '\n';
          else if (esc === 'r') str += '\r';
          else if (esc === 't') str += '\t';
          else if (esc === '\\') str += '\\';
          else if (esc === '"') str += '"';
          else if (esc === "'") str += "'";
          else if (esc === '0') str += '\0';
          else str += esc;
          adv();
        } else {
          str += source[i];
          adv();
        }
      }
      if (i >= n) throw new SyntaxError(`未闭合的字符串 (line ${startLine})`);
      adv();
      tokens.push({ type: 'STR', value: str, line: startLine, col: startCol });
      continue;
    }

    // Identifier / Keyword
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95) {
      let id = '';
      while (i < n) {
        const c = source.charCodeAt(i);
        if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95) {
          id += source[i];
          adv();
        } else break;
      }
      tokens.push({
        type: KEYWORDS.has(id) ? id : 'ID',
        value: id,
        line: startLine,
        col: startCol
      });
      continue;
    }

    // 2-char operators
    const two = source.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '&&' || two === '||' || two === '+=' || two === '-=' || two === '*=') {
      tokens.push({ type: two, value: two, line: startLine, col: startCol });
      adv(2);
      continue;
    }

    // 1-char punctuation/operators
    const singles = '+-*/%<>=!(){}[],.;:?';
    if (singles.includes(ch)) {
      tokens.push({ type: ch, value: ch, line: startLine, col: startCol });
      adv();
      continue;
    }

    throw new SyntaxError(`无法识别的字符 '${ch}' (line ${startLine}, col ${startCol})`);
  }

  tokens.push({ type: 'EOF', value: '', line, col });
  return tokens;
}

export function compileNScript(source, options = {}) {
  const compilerId = options.compilerId || 'bootstrap-1';
  const tokens = tokenize(source);
  let pos = 0;

  function peek(offset = 0) {
    return tokens[Math.min(pos + offset, tokens.length - 1)];
  }
  function next() {
    const t = tokens[pos];
    pos++;
    return t;
  }
  function match(type) {
    if (peek().type === type) {
      return next();
    }
    return null;
  }
  function expect(type, msg) {
    const t = peek();
    if (t.type !== type) {
      throw new SyntaxError(`${msg || `期望 '${type}'`}，实际遇到 '${t.value || t.type}' (line ${t.line}, col ${t.col})`);
    }
    return next();
  }
  function expectPropName() {
    const t = peek();
    if (t.type !== 'ID' && !KEYWORDS.has(t.type)) {
      throw new SyntaxError(`期望属性名，实际遇到 '${t.value || t.type}' (line ${t.line}, col ${t.col})`);
    }
    return next();
  }

  const consts = [];
  const constMap = new Map();
  function addConst(val) {
    const key = typeof val === 'string' ? `S:${val}` : `N:${String(val)}`;
    if (constMap.has(key)) return constMap.get(key);
    const idx = consts.length;
    consts.push(val);
    constMap.set(key, idx);
    return idx;
  }

  const functions = [];
  const topFnIndices = new Map();

  // Context stack per function being compiled
  function createFnBuilder(name, params) {
    return {
      name,
      params,
      localCount: params.length,
      scopes: [new Map(params.map((p, idx) => [p, idx]))],
      code: [], // [op, arg?]
      lines: [], // line number per instruction index (parallel to instruction count or sparse)
      loops: [],
      isTopLevel: name === '__main__'
    };
  }

  const fnStack = [];
  function curFn() {
    return fnStack[fnStack.length - 1];
  }

  function emit(op, arg, line = 0) {
    const f = curFn();
    const idx = f.code.length;
    f.code.push(op);
    if (arg !== undefined) {
      f.code.push(arg);
    }
    return idx;
  }

  function emitJump(op, target = 0) {
    const f = curFn();
    const idx = f.code.length;
    f.code.push(op, target);
    return idx + 1; // index of operand to patch
  }

  function patchJump(operandIdx, target) {
    curFn().code[operandIdx] = target;
  }

  function pushScope() {
    curFn().scopes.push(new Map());
  }
  function popScope() {
    curFn().scopes.pop();
  }
  function declareLocal(name) {
    const f = curFn();
    if (f.isTopLevel && f.scopes.length === 1) {
      // Top-level let creates a global so all functions see it
      return { kind: 'global', name };
    }
    const topScope = f.scopes[f.scopes.length - 1];
    if (topScope.has(name)) return { kind: 'local', slot: topScope.get(name) };
    const slot = f.localCount++;
    topScope.set(name, slot);
    return { kind: 'local', slot };
  }
  function resolveVar(name) {
    const f = curFn();
    for (let s = f.scopes.length - 1; s >= 0; s--) {
      if (f.scopes[s].has(name)) {
        return { kind: 'local', slot: f.scopes[s].get(name) };
      }
    }
    if (topFnIndices.has(name)) {
      return { kind: 'fn', fnIdx: topFnIndices.get(name) };
    }
    if (BUILTIN_NAMES.has(name)) {
      return { kind: 'builtin', name };
    }
    return { kind: 'global', name };
  }

  // First quick pass? Wait: let's support forward-referenced top-level fn names!
  // We can pre-scan top-level `fn name(` tokens at brace depth 0 so mutual recursion works cleanly!
  {
    let depth = 0;
    let p = 0;
    let nextFnIdx = 1; // 0 is __main__
    while (p < tokens.length && tokens[p].type !== 'EOF') {
      const t = tokens[p];
      if (t.type === '{') depth++;
      else if (t.type === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0 && t.type === 'fn' && tokens[p + 1]?.type === 'ID') {
        const fname = tokens[p + 1].value;
        if (!topFnIndices.has(fname)) {
          topFnIndices.set(fname, nextFnIdx++);
        }
      }
      p++;
    }
  }

  // Reserve slots in functions array
  functions.push(null); // index 0 = __main__
  for (let i = 0; i < topFnIndices.size; i++) functions.push(null);

  function compileFunctionDef(fnName, forcedIdx = null) {
    expect('(', '期望参数列表 (');
    const params = [];
    if (peek().type !== ')') {
      do {
        params.push(expect('ID', '期望参数名').value);
      } while (match(','));
    }
    expect(')', '期望 )');
    expect('{', '期望函数体 {');

    const fnIdx = forcedIdx !== null ? forcedIdx : functions.length;
    if (forcedIdx === null) functions.push(null);

    const builder = createFnBuilder(fnName, params);
    fnStack.push(builder);

    while (peek().type !== '}' && peek().type !== 'EOF') {
      compileStatement();
    }
    expect('}', '期望 }');

    // Implicit return null at end of function
    emit(OP.CONST, addConst(null));
    emit(OP.RETURN);

    fnStack.pop();
    functions[fnIdx] = {
      name: fnName,
      paramCount: params.length,
      localCount: builder.localCount,
      code: builder.code
    };
    return fnIdx;
  }

  function compileBlock() {
    expect('{', '期望 {');
    pushScope();
    while (peek().type !== '}' && peek().type !== 'EOF') {
      compileStatement();
    }
    expect('}', '期望 }');
    popScope();
  }

  function compileStatement() {
    const t = peek();
    if (t.type === ';') {
      next();
      return;
    }
    if (t.type === '{') {
      compileBlock();
      return;
    }
    if (t.type === 'fn' && peek(1).type === 'ID') {
      next();
      const nameTok = next();
      const forcedIdx = topFnIndices.has(nameTok.value) ? topFnIndices.get(nameTok.value) : null;
      const fnIdx = compileFunctionDef(nameTok.value, forcedIdx);
      if (forcedIdx === null) {
        // Local/nested named function binds as variable
        const binding = declareLocal(nameTok.value);
        emit(OP.MAKE_FN, fnIdx);
        if (binding.kind === 'local') emit(OP.STORE_LOCAL, binding.slot);
        else emit(OP.STORE_GLOBAL, addConst(binding.name));
        emit(OP.POP);
      }
      return;
    }
    if (t.type === 'let') {
      next();
      const idTok = expect('ID', '期望变量名');
      const binding = declareLocal(idTok.value);
      if (match('=')) {
        compileExpr();
      } else {
        emit(OP.CONST, addConst(null));
      }
      if (binding.kind === 'local') emit(OP.STORE_LOCAL, binding.slot);
      else emit(OP.STORE_GLOBAL, addConst(binding.name));
      emit(OP.POP);
      match(';');
      return;
    }
    if (t.type === 'if') {
      next();
      expect('(', '期望 (');
      compileExpr();
      expect(')', '期望 )');
      const jFalse = emitJump(OP.JUMP_IF_FALSE);
      compileStatement();
      if (match('else')) {
        const jEnd = emitJump(OP.JUMP);
        patchJump(jFalse, curFn().code.length);
        compileStatement();
        patchJump(jEnd, curFn().code.length);
      } else {
        patchJump(jFalse, curFn().code.length);
      }
      return;
    }
    if (t.type === 'while') {
      next();
      const loopStart = curFn().code.length;
      expect('(', '期望 (');
      compileExpr();
      expect(')', '期望 )');
      const jExit = emitJump(OP.JUMP_IF_FALSE);
      const loopCtx = { continueTarget: loopStart, breakPatches: [] };
      curFn().loops.push(loopCtx);
      compileStatement();
      emit(OP.JUMP, loopStart);
      const loopEnd = curFn().code.length;
      patchJump(jExit, loopEnd);
      for (const bp of loopCtx.breakPatches) patchJump(bp, loopEnd);
      curFn().loops.pop();
      return;
    }
    if (t.type === 'for') {
      next();
      expect('(', '期望 (');
      pushScope();
      if (peek().type !== ';') {
        if (peek().type === 'let') {
          compileStatement();
        } else {
          compileExpr();
          emit(OP.POP);
          expect(';', '期望 ;');
        }
      } else {
        next();
      }
      const condPos = curFn().code.length;
      let jExit = -1;
      if (peek().type !== ';') {
        compileExpr();
        jExit = emitJump(OP.JUMP_IF_FALSE);
      }
      expect(';', '期望 ;');
      const jBody = emitJump(OP.JUMP);
      const stepPos = curFn().code.length;
      if (peek().type !== ')') {
        compileExpr();
        emit(OP.POP);
      }
      expect(')', '期望 )');
      emit(OP.JUMP, condPos);
      patchJump(jBody, curFn().code.length);

      const loopCtx = { continueTarget: stepPos, breakPatches: [] };
      curFn().loops.push(loopCtx);
      compileStatement();
      emit(OP.JUMP, stepPos);
      const loopEnd = curFn().code.length;
      if (jExit !== -1) patchJump(jExit, loopEnd);
      for (const bp of loopCtx.breakPatches) patchJump(bp, loopEnd);
      curFn().loops.pop();
      popScope();
      return;
    }
    if (t.type === 'break') {
      next();
      const loops = curFn().loops;
      if (loops.length === 0) throw new SyntaxError(`break 只能用于循环内 (line ${t.line})`);
      loops[loops.length - 1].breakPatches.push(emitJump(OP.JUMP));
      match(';');
      return;
    }
    if (t.type === 'continue') {
      next();
      const loops = curFn().loops;
      if (loops.length === 0) throw new SyntaxError(`continue 只能用于循环内 (line ${t.line})`);
      emit(OP.JUMP, loops[loops.length - 1].continueTarget);
      match(';');
      return;
    }
    if (t.type === 'return') {
      next();
      if (peek().type === ';' || peek().type === '}') {
        emit(OP.CONST, addConst(null));
      } else {
        compileExpr();
      }
      emit(OP.RETURN);
      match(';');
      return;
    }

    compileExpr();
    emit(OP.POP);
    match(';');
  }

  function compileExpr() {
    compileAssignClean();
  }

  // Zero-backtrack lvalue-aware assignment
  function isAssignmentStart() {
    if (peek().type !== 'ID') return false;
    let p = pos + 1;
    let lastWasAccess = true; // ID itself is assignable
    while (p < tokens.length) {
      const t = tokens[p];
      if (t.type === '.') {
        const nt = tokens[p + 1];
        if (!nt || (nt.type !== 'ID' && !KEYWORDS.has(nt.type))) return false;
        p += 2;
        lastWasAccess = true;
      } else if (t.type === '[' || t.type === '(') {
        const isBracket = t.type === '[';
        let depth = 1;
        p++;
        while (p < tokens.length && depth > 0) {
          if (tokens[p].type === '[' || tokens[p].type === '(' || tokens[p].type === '{') depth++;
          else if (tokens[p].type === ']' || tokens[p].type === ')' || tokens[p].type === '}') depth--;
          p++;
        }
        lastWasAccess = isBracket;
      } else {
        break;
      }
    }
    if (!lastWasAccess) return false;
    const op = tokens[p]?.type;
    return op === '=' || op === '+=' || op === '-=' || op === '*=';
  }

  function compileAssignClean() {
    if (!isAssignmentStart()) {
      compileTernary();
      return;
    }
    const idTok = next();
    const binding = resolveVar(idTok.value);
    const hasAccessors = peek().type === '.' || peek().type === '[' || peek().type === '(';

    if (!hasAccessors) {
      const opTok = next();
      if (opTok.type === '=') {
        compileAssignClean();
      } else {
        emitVarLoad(binding, idTok);
        compileAssignClean();
        emitCompoundOp(opTok.type);
      }
      if (binding.kind === 'local') emit(OP.STORE_LOCAL, binding.slot);
      else if (binding.kind === 'global') emit(OP.STORE_GLOBAL, addConst(binding.name));
      else throw new SyntaxError(`无法给函数或内置函数 '${idTok.value}' 赋值 (line ${idTok.line})`);
      return;
    }

    // Load base object
    emitVarLoad(binding, idTok);
    // Navigate intermediate accessors/calls, leaving [container, lastKey] on stack
    while (true) {
      if (match('(')) {
        let argc = 0;
        if (peek().type !== ')') {
          do {
            compileExpr();
            argc++;
          } while (match(','));
        }
        expect(')', '期望 )');
        emit(OP.CALL, argc);
        continue;
      }
      if (match('.')) {
        const prop = expectPropName().value;
        emit(OP.CONST, addConst(prop));
      } else if (match('[')) {
        compileExpr();
        expect(']', '期望 ]');
      } else {
        break;
      }
      if (peek().type === '.' || peek().type === '[' || peek().type === '(') {
        emit(OP.GET_PROP);
      } else {
        break;
      }
    }

    const opTok = next();
    if (opTok.type === '=') {
      compileAssignClean();
    } else {
      emit(OP.DUP2);
      emit(OP.GET_PROP);
      compileAssignClean();
      emitCompoundOp(opTok.type);
    }
    emit(OP.SET_PROP);
  }

  function emitCompoundOp(opType) {
    if (opType === '+=') emit(OP.ADD);
    else if (opType === '-=') emit(OP.SUB);
    else if (opType === '*=') emit(OP.MUL);
  }

  function emitVarLoad(binding, tok) {
    if (binding.kind === 'local') emit(OP.LOAD_LOCAL, binding.slot);
    else if (binding.kind === 'fn') emit(OP.MAKE_FN, binding.fnIdx);
    else if (binding.kind === 'builtin') emit(OP.LOAD_BUILTIN, addConst(binding.name));
    else emit(OP.LOAD_GLOBAL, addConst(binding.name));
    void tok;
  }

  function compileTernary() {
    compileOr();
    if (match('?')) {
      const jFalse = emitJump(OP.JUMP_IF_FALSE);
      compileExpr();
      expect(':', '三元运算符期望 :');
      const jEnd = emitJump(OP.JUMP);
      patchJump(jFalse, curFn().code.length);
      compileTernary();
      patchJump(jEnd, curFn().code.length);
    }
  }

  function compileOr() {
    compileAnd();
    while (match('||')) {
      emit(OP.DUP);
      const jTrue = emitJump(OP.JUMP_IF_TRUE);
      emit(OP.POP);
      compileAnd();
      patchJump(jTrue, curFn().code.length);
    }
  }

  function compileAnd() {
    compileEquality();
    while (match('&&')) {
      emit(OP.DUP);
      const jFalse = emitJump(OP.JUMP_IF_FALSE);
      emit(OP.POP);
      compileEquality();
      patchJump(jFalse, curFn().code.length);
    }
  }

  function compileEquality() {
    compileComparison();
    while (peek().type === '==' || peek().type === '!=') {
      const op = next().type;
      compileComparison();
      emit(op === '==' ? OP.EQ : OP.NEQ);
    }
  }

  function compileComparison() {
    compileTerm();
    while (peek().type === '<' || peek().type === '<=' || peek().type === '>' || peek().type === '>=') {
      const op = next().type;
      compileTerm();
      if (op === '<') emit(OP.LT);
      else if (op === '<=') emit(OP.LTE);
      else if (op === '>') emit(OP.GT);
      else emit(OP.GTE);
    }
  }

  function compileTerm() {
    compileFactor();
    while (peek().type === '+' || peek().type === '-') {
      const op = next().type;
      compileFactor();
      emit(op === '+' ? OP.ADD : OP.SUB);
    }
  }

  function compileFactor() {
    compileUnary();
    while (peek().type === '*' || peek().type === '/' || peek().type === '%') {
      const op = next().type;
      compileUnary();
      if (op === '*') emit(OP.MUL);
      else if (op === '/') emit(OP.DIV);
      else emit(OP.MOD);
    }
  }

  function compileUnary() {
    if (match('!')) {
      compileUnary();
      emit(OP.NOT);
      return;
    }
    if (match('-')) {
      compileUnary();
      emit(OP.NEG);
      return;
    }
    if (match('+')) {
      compileUnary();
      return;
    }
    compilePostfix();
  }

  function compilePostfix() {
    compilePrimary();
    while (true) {
      if (match('.')) {
        const prop = expectPropName().value;
        emit(OP.CONST, addConst(prop));
        emit(OP.GET_PROP);
      } else if (match('[')) {
        compileExpr();
        expect(']', '期望 ]');
        emit(OP.GET_PROP);
      } else if (match('(')) {
        let argc = 0;
        if (peek().type !== ')') {
          do {
            compileExpr();
            argc++;
          } while (match(','));
        }
        expect(')', '期望 )');
        emit(OP.CALL, argc);
      } else {
        break;
      }
    }
  }

  function compilePrimary() {
    const t = peek();
    if (t.type === 'NUM' || t.type === 'STR') {
      next();
      emit(OP.CONST, addConst(t.value));
      return;
    }
    if (t.type === 'true') {
      next();
      emit(OP.CONST, addConst(true));
      return;
    }
    if (t.type === 'false') {
      next();
      emit(OP.CONST, addConst(false));
      return;
    }
    if (t.type === 'null') {
      next();
      emit(OP.CONST, addConst(null));
      return;
    }
    if (t.type === 'syscall') {
      next();
      expect('(', 'syscall 后期望 (');
      compileExpr(); // syscall name string
      let argc = 0;
      while (match(',')) {
        compileExpr();
        argc++;
      }
      expect(')', '期望 )');
      emit(OP.SYSCALL, argc);
      return;
    }
    if (t.type === 'fn') {
      next();
      const fnIdx = compileFunctionDef('<anon>', null);
      emit(OP.MAKE_FN, fnIdx);
      return;
    }
    if (t.type === 'ID') {
      next();
      const binding = resolveVar(t.value);
      emitVarLoad(binding, t);
      return;
    }
    if (match('(')) {
      compileExpr();
      expect(')', '期望 )');
      return;
    }
    if (match('[')) {
      let count = 0;
      if (peek().type !== ']') {
        do {
          if (peek().type === ']') break;
          compileExpr();
          count++;
        } while (match(','));
      }
      expect(']', '期望 ]');
      emit(OP.MAKE_ARRAY, count);
      return;
    }
    if (match('{')) {
      let count = 0;
      if (peek().type !== '}') {
        do {
          if (peek().type === '}') break;
          const k = peek();
          if (k.type === 'ID' || k.type === 'STR') {
            next();
            emit(OP.CONST, addConst(k.value));
          } else {
            throw new SyntaxError(`对象键名必须为标识符或字符串 (line ${k.line})`);
          }
          expect(':', '期望 :');
          compileExpr();
          count++;
        } while (match(','));
      }
      expect('}', '期望 }');
      emit(OP.MAKE_OBJECT, count);
      return;
    }

    throw new SyntaxError(`意外的符号 '${t.value || t.type}' (line ${t.line}, col ${t.col})`);
  }

  // Compile __main__
  const mainBuilder = createFnBuilder('__main__', []);
  fnStack.push(mainBuilder);
  while (peek().type !== 'EOF') {
    compileStatement();
  }
  emit(OP.HALT);
  fnStack.pop();
  functions[0] = {
    name: '__main__',
    paramCount: 0,
    localCount: mainBuilder.localCount,
    code: mainBuilder.code
  };

  return {
    magic: NSBC_MAGIC,
    version: NSBC_VERSION,
    compilerId,
    srcHash: hashString(source),
    consts,
    functions
  };
}
