(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NosBootstrapCompiler = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const KEYWORDS = new Set([
    'fn', 'let', 'if', 'else', 'while', 'for', 'return',
    'break', 'continue', 'true', 'false', 'null', 'syscall'
  ]);

  function isAlpha(ch) {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
  }

  function isDigit(ch) {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    return c >= 48 && c <= 57;
  }

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    let line = 1;
    const n = src.length;

    while (i < n) {
      const ch = src[i];
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        i++;
        continue;
      }
      if (ch === '\n') {
        line++;
        i++;
        continue;
      }
      if (ch === '/' && src[i + 1] === '/') {
        i += 2;
        while (i < n && src[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++;
          i++;
        }
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const quote = ch;
        i++;
        let s = '';
        while (i < n && src[i] !== quote) {
          if (src[i] === '\\') {
            i++;
            const esc = src[i];
            if (esc === 'n') s += '\n';
            else if (esc === 't') s += '\t';
            else if (esc === 'r') s += '\r';
            else s += esc || '';
            i++;
          } else {
            if (src[i] === '\n') line++;
            s += src[i++];
          }
        }
        if (i >= n) throw new Error('Unterminated string at line ' + line);
        i++;
        tokens.push({ t: 'STR', v: s, line });
        continue;
      }
      if (isDigit(ch)) {
        let s = '';
        while (i < n && (isDigit(src[i]) || src[i] === '.')) {
          s += src[i++];
        }
        tokens.push({ t: 'NUM', v: Number(s), line });
        continue;
      }
      if (isAlpha(ch)) {
        let s = '';
        while (i < n && (isAlpha(src[i]) || isDigit(src[i]))) {
          s += src[i++];
        }
        if (KEYWORDS.has(s)) {
          tokens.push({ t: 'KW', v: s, line });
        } else {
          tokens.push({ t: 'ID', v: s, line });
        }
        continue;
      }
      const two = src.substr(i, 2);
      if (
        two === '==' || two === '!=' || two === '<=' || two === '>=' ||
        two === '&&' || two === '||' || two === '+=' || two === '-=' ||
        two === '*=' || two === '++' || two === '--'
      ) {
        tokens.push({ t: 'OP', v: two, line });
        i += 2;
        continue;
      }
      if ('+-*/%=<>!(){}[],.;:?'.indexOf(ch) >= 0) {
        tokens.push({ t: 'OP', v: ch, line });
        i++;
        continue;
      }
      throw new Error('Unexpected character "' + ch + '" at line ' + line);
    }
    tokens.push({ t: 'EOF', v: '', line });
    return tokens;
  }

  function compileNos(src) {
    const tokens = tokenize(src);
    let pos = 0;

    const globals = new Set();
    const globalInits = [];
    const functions = [];

    function peek(offset = 0) {
      return tokens[pos + offset] || tokens[tokens.length - 1];
    }

    function next() {
      return tokens[pos++];
    }

    function match(t, v) {
      const tok = peek();
      if (tok.t === t && (v === undefined || tok.v === v)) {
        pos++;
        return true;
      }
      return false;
    }

    function expect(t, v) {
      const tok = peek();
      if (tok.t !== t || (v !== undefined && tok.v !== v)) {
        throw new Error('SyntaxError line ' + tok.line + ': expected ' + (v || t) + ', got "' + tok.v + '"');
      }
      pos++;
      return tok;
    }

    // First pass: collect global let names so functions anywhere can reference them
    // Wait: top-level statements are either `let x = ...;` or `fn name(...) { ... }`
    let curFn = null;

    function resolveLocal(name) {
      for (let s = curFn.scopes.length - 1; s >= 0; s--) {
        const sc = curFn.scopes[s];
        if (Object.prototype.hasOwnProperty.call(sc, name)) {
          return sc[name];
        }
      }
      return -1;
    }

    function declareLocal(name) {
      const slot = curFn.localCount++;
      curFn.scopes[curFn.scopes.length - 1][name] = slot;
      return slot;
    }

    function emit(op, a, b) {
      const ins = b !== undefined ? [op, a, b] : (a !== undefined ? [op, a] : [op]);
      curFn.code.push(ins);
      return curFn.code.length - 1;
    }

    function parsePrimary() {
      const tok = peek();
      if (tok.t === 'NUM') {
        next();
        emit('CONST', tok.v);
        return { kind: 'rval' };
      }
      if (tok.t === 'STR') {
        next();
        emit('CONST', tok.v);
        return { kind: 'rval' };
      }
      if (tok.t === 'KW') {
        if (tok.v === 'true') { next(); emit('CONST', true); return { kind: 'rval' }; }
        if (tok.v === 'false') { next(); emit('CONST', false); return { kind: 'rval' }; }
        if (tok.v === 'null') { next(); emit('CONST', null); return { kind: 'rval' }; }
        if (tok.v === 'syscall') {
          next();
          expect('OP', '(');
          let argc = 0;
          if (!match('OP', ')')) {
            do {
              parseExpr();
              argc++;
            } while (match('OP', ','));
            expect('OP', ')');
          }
          emit('SYSCALL', argc);
          return { kind: 'rval' };
        }
      }
      if (match('OP', '(')) {
        parseExpr();
        expect('OP', ')');
        return { kind: 'rval' };
      }
      if (match('OP', '[')) {
        let count = 0;
        if (!match('OP', ']')) {
          do {
            if (peek().t === 'OP' && peek().v === ']') break;
            parseExpr();
            count++;
          } while (match('OP', ','));
          expect('OP', ']');
        }
        emit('MAKE_ARR', count);
        return { kind: 'rval' };
      }
      if (match('OP', '{')) {
        let count = 0;
        if (!match('OP', '}')) {
          do {
            if (peek().t === 'OP' && peek().v === '}') break;
            const kTok = peek();
            let keyName;
            if (kTok.t === 'ID' || kTok.t === 'KW') {
              next();
              keyName = kTok.v;
            } else if (kTok.t === 'STR') {
              next();
              keyName = kTok.v;
            } else {
              throw new Error('Invalid object key at line ' + kTok.line);
            }
            emit('CONST', keyName);
            if (match('OP', ':')) {
              parseExpr();
            } else {
              const slot = resolveLocal(keyName);
              if (slot >= 0) emit('LOAD_LOCAL', slot);
              else emit('LOAD_GLOBAL', keyName);
            }
            count++;
          } while (match('OP', ','));
          expect('OP', '}');
        }
        emit('MAKE_OBJ', count);
        return { kind: 'rval' };
      }
      if (tok.t === 'ID') {
        next();
        if (match('OP', '(')) {
          let argc = 0;
          if (!match('OP', ')')) {
            do {
              if (peek().t === 'OP' && peek().v === ')') break;
              parseExpr();
              argc++;
            } while (match('OP', ','));
            expect('OP', ')');
          }
          emit('CALL', tok.v, argc);
          return { kind: 'rval' };
        }
        return { kind: 'var', name: tok.v };
      }
      throw new Error('Unexpected token "' + tok.v + '" at line ' + tok.line);
    }

    function materializeLval(lhs) {
      if (lhs.kind === 'var') {
        const slot = resolveLocal(lhs.name);
        if (slot >= 0) emit('LOAD_LOCAL', slot);
        else emit('LOAD_GLOBAL', lhs.name);
      } else if (lhs.kind === 'prop') {
        emit('GET_PROP');
      }
    }

    function parsePostfix() {
      let lhs = parsePrimary();
      while (true) {
        if (match('OP', '.')) {
          materializeLval(lhs);
          const pTok = next();
          if (pTok.t !== 'ID' && pTok.t !== 'KW') {
            throw new Error('Expected property name at line ' + pTok.line);
          }
          emit('CONST', pTok.v);
          lhs = { kind: 'prop' };
        } else if (match('OP', '[')) {
          materializeLval(lhs);
          parseExpr();
          expect('OP', ']');
          lhs = { kind: 'prop' };
        } else {
          break;
        }
      }

      // Postfix ++ / --
      if ((peek().t === 'OP' && (peek().v === '++' || peek().v === '--')) && lhs.kind === 'var') {
        const opTok = next();
        const deltaOp = opTok.v === '++' ? 'ADD' : 'SUB';
        const slot = resolveLocal(lhs.name);
        if (slot >= 0) {
          emit('LOAD_LOCAL', slot);
          emit('DUP');
          emit('CONST', 1);
          emit(deltaOp);
          emit('STORE_LOCAL', slot);
          emit('POP');
        } else {
          emit('LOAD_GLOBAL', lhs.name);
          emit('DUP');
          emit('CONST', 1);
          emit(deltaOp);
          emit('STORE_GLOBAL', lhs.name);
          emit('POP');
        }
        return { kind: 'rval' };
      }

      // Assignment operators
      const nextTok = peek();
      if (nextTok.t === 'OP' && (nextTok.v === '=' || nextTok.v === '+=' || nextTok.v === '-=' || nextTok.v === '*=')) {
        const assignOp = next().v;
        if (lhs.kind === 'var') {
          const slot = resolveLocal(lhs.name);
          if (assignOp === '=') {
            parseExpr();
            if (slot >= 0) emit('STORE_LOCAL', slot);
            else emit('STORE_GLOBAL', lhs.name);
          } else {
            if (slot >= 0) emit('LOAD_LOCAL', slot);
            else emit('LOAD_GLOBAL', lhs.name);
            parseExpr();
            emit(assignOp === '+=' ? 'ADD' : assignOp === '-=' ? 'SUB' : 'MUL');
            if (slot >= 0) emit('STORE_LOCAL', slot);
            else emit('STORE_GLOBAL', lhs.name);
          }
          return { kind: 'rval' };
        }
        if (lhs.kind === 'prop') {
          if (assignOp === '=') {
            parseExpr();
            emit('SET_PROP');
          } else {
            // Stack currently has [target, key]; save key & target in temp locals
            const tmpKey = declareLocal('__tk_' + curFn.localCount);
            const tmpObj = declareLocal('__to_' + curFn.localCount);
            emit('STORE_LOCAL', tmpKey);
            emit('POP');
            emit('STORE_LOCAL', tmpObj);
            emit('POP');
            emit('LOAD_LOCAL', tmpObj);
            emit('LOAD_LOCAL', tmpKey);
            emit('LOAD_LOCAL', tmpObj);
            emit('LOAD_LOCAL', tmpKey);
            emit('GET_PROP');
            parseExpr();
            emit(assignOp === '+=' ? 'ADD' : assignOp === '-=' ? 'SUB' : 'MUL');
            emit('SET_PROP');
          }
          return { kind: 'rval' };
        }
        throw new Error('Invalid assignment target at line ' + nextTok.line);
      }

      materializeLval(lhs);
      return { kind: 'rval' };
    }

    function parseUnary() {
      if (match('OP', '-')) {
        parseUnary();
        emit('NEG');
        return;
      }
      if (match('OP', '!')) {
        parseUnary();
        emit('NOT');
        return;
      }
      parsePostfix();
    }

    function parseMul() {
      parseUnary();
      while (peek().t === 'OP' && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
        const op = next().v;
        parseUnary();
        emit(op === '*' ? 'MUL' : op === '/' ? 'DIV' : 'MOD');
      }
    }

    function parseAdd() {
      parseMul();
      while (peek().t === 'OP' && (peek().v === '+' || peek().v === '-')) {
        const op = next().v;
        parseMul();
        emit(op === '+' ? 'ADD' : 'SUB');
      }
    }

    function parseRel() {
      parseAdd();
      while (peek().t === 'OP' && (peek().v === '<' || peek().v === '<=' || peek().v === '>' || peek().v === '>=')) {
        const op = next().v;
        parseAdd();
        emit(op === '<' ? 'LT' : op === '<=' ? 'LTE' : op === '>' ? 'GT' : 'GTE');
      }
    }

    function parseEq() {
      parseRel();
      while (peek().t === 'OP' && (peek().v === '==' || peek().v === '!=')) {
        const op = next().v;
        parseRel();
        emit(op === '==' ? 'EQ' : 'NEQ');
      }
    }

    function parseAnd() {
      parseEq();
      while (match('OP', '&&')) {
        emit('DUP');
        const jmpEnd = emit('JMP_IF_FALSE', 0);
        emit('POP');
        parseEq();
        curFn.code[jmpEnd][1] = curFn.code.length;
      }
    }

    function parseOr() {
      parseAnd();
      while (match('OP', '||')) {
        emit('DUP');
        const jmpEnd = emit('JMP_IF_TRUE', 0);
        emit('POP');
        parseAnd();
        curFn.code[jmpEnd][1] = curFn.code.length;
      }
    }

    function parseExpr() {
      parseOr();
      if (match('OP', '?')) {
        const jmpFalse = emit('JMP_IF_FALSE', 0);
        parseExpr();
        const jmpEnd = emit('JMP', 0);
        expect('OP', ':');
        curFn.code[jmpFalse][1] = curFn.code.length;
        parseExpr();
        curFn.code[jmpEnd][1] = curFn.code.length;
      }
    }

    function parseBlock() {
      expect('OP', '{');
      curFn.scopes.push({});
      while (!(peek().t === 'OP' && peek().v === '}') && peek().t !== 'EOF') {
        parseStmt();
      }
      expect('OP', '}');
      curFn.scopes.pop();
    }

    function parseStmt() {
      const tok = peek();
      if (tok.t === 'OP' && tok.v === '{') {
        parseBlock();
        return;
      }
      if (match('KW', 'let')) {
        const id = expect('ID').v;
        const slot = declareLocal(id);
        if (match('OP', '=')) {
          parseExpr();
        } else {
          emit('CONST', null);
        }
        emit('STORE_LOCAL', slot);
        emit('POP');
        match('OP', ';');
        return;
      }
      if (match('KW', 'if')) {
        expect('OP', '(');
        parseExpr();
        expect('OP', ')');
        const jmpFalse = emit('JMP_IF_FALSE', 0);
        if (peek().t === 'OP' && peek().v === '{') parseBlock();
        else parseStmt();
        if (match('KW', 'else')) {
          const jmpEnd = emit('JMP', 0);
          curFn.code[jmpFalse][1] = curFn.code.length;
          if (peek().t === 'OP' && peek().v === '{') parseBlock();
          else parseStmt();
          curFn.code[jmpEnd][1] = curFn.code.length;
        } else {
          curFn.code[jmpFalse][1] = curFn.code.length;
        }
        return;
      }
      if (match('KW', 'while')) {
        const loopStart = curFn.code.length;
        expect('OP', '(');
        parseExpr();
        expect('OP', ')');
        const jmpExit = emit('JMP_IF_FALSE', 0);
        const loopCtx = { breaks: [], continues: [], continueTarget: loopStart };
        curFn.loops.push(loopCtx);
        if (peek().t === 'OP' && peek().v === '{') parseBlock();
        else parseStmt();
        curFn.loops.pop();
        for (const cIdx of loopCtx.continues) curFn.code[cIdx][1] = loopStart;
        emit('JMP', loopStart);
        const loopEnd = curFn.code.length;
        curFn.code[jmpExit][1] = loopEnd;
        for (const bIdx of loopCtx.breaks) curFn.code[bIdx][1] = loopEnd;
        return;
      }
      if (match('KW', 'for')) {
        expect('OP', '(');
        curFn.scopes.push({});
        if (!match('OP', ';')) {
          if (match('KW', 'let')) {
            const id = expect('ID').v;
            const slot = declareLocal(id);
            if (match('OP', '=')) parseExpr();
            else emit('CONST', null);
            emit('STORE_LOCAL', slot);
            emit('POP');
          } else {
            parseExpr();
            emit('POP');
          }
          expect('OP', ';');
        }
        const condStart = curFn.code.length;
        let jmpExit = -1;
        if (!match('OP', ';')) {
          parseExpr();
          jmpExit = emit('JMP_IF_FALSE', 0);
          expect('OP', ';');
        }
        const jmpBody = emit('JMP', 0);
        const stepStart = curFn.code.length;
        if (!match('OP', ')')) {
          parseExpr();
          emit('POP');
          expect('OP', ')');
        }
        emit('JMP', condStart);
        curFn.code[jmpBody][1] = curFn.code.length;
        const loopCtx = { breaks: [], continues: [], continueTarget: stepStart };
        curFn.loops.push(loopCtx);
        if (peek().t === 'OP' && peek().v === '{') parseBlock();
        else parseStmt();
        curFn.loops.pop();
        for (const cIdx of loopCtx.continues) curFn.code[cIdx][1] = stepStart;
        emit('JMP', stepStart);
        const loopEnd = curFn.code.length;
        if (jmpExit >= 0) curFn.code[jmpExit][1] = loopEnd;
        for (const bIdx of loopCtx.breaks) curFn.code[bIdx][1] = loopEnd;
        curFn.scopes.pop();
        return;
      }
      if (match('KW', 'break')) {
        if (curFn.loops.length === 0) throw new Error('break outside loop at line ' + tok.line);
        const b = emit('JMP', 0);
        curFn.loops[curFn.loops.length - 1].breaks.push(b);
        match('OP', ';');
        return;
      }
      if (match('KW', 'continue')) {
        if (curFn.loops.length === 0) throw new Error('continue outside loop at line ' + tok.line);
        const c = emit('JMP', 0);
        curFn.loops[curFn.loops.length - 1].continues.push(c);
        match('OP', ';');
        return;
      }
      if (match('KW', 'return')) {
        if (peek().t === 'OP' && (peek().v === ';' || peek().v === '}')) {
          emit('CONST', null);
        } else {
          parseExpr();
        }
        emit('RET');
        match('OP', ';');
        return;
      }
      if (match('OP', ';')) {
        return;
      }
      parseExpr();
      emit('POP');
      match('OP', ';');
    }

    // Parse top-level declarations
    const initFn = {
      name: '__init_globals',
      paramCount: 2,
      localCount: 2,
      code: [],
      scopes: [{ __arg0: 0, __arg1: 1 }],
      loops: []
    };

    while (peek().t !== 'EOF') {
      if (match('KW', 'fn')) {
        const fnName = expect('ID').v;
        expect('OP', '(');
        const params = [];
        if (!match('OP', ')')) {
          do {
            params.push(expect('ID').v);
          } while (match('OP', ','));
          expect('OP', ')');
        }
        const fnObj = {
          name: fnName,
          paramCount: params.length,
          localCount: 0,
          code: [],
          scopes: [{}],
          loops: []
        };
        curFn = fnObj;
        for (const p of params) declareLocal(p);
        parseBlock();
        emit('CONST', null);
        emit('RET');
        functions.push({
          name: fnObj.name,
          paramCount: fnObj.paramCount,
          localCount: fnObj.localCount,
          code: fnObj.code
        });
        curFn = null;
      } else if (match('KW', 'let')) {
        const gName = expect('ID').v;
        globals.add(gName);
        curFn = initFn;
        if (match('OP', '=')) {
          parseExpr();
        } else {
          emit('CONST', null);
        }
        emit('STORE_GLOBAL', gName);
        emit('POP');
        match('OP', ';');
        curFn = null;
      } else {
        // Top-level statement compiled into __init_globals
        curFn = initFn;
        parseStmt();
        curFn = null;
      }
    }

    // Wrap entry point: if __init_globals has code, run it before main()
    let entryName = 'main';
    const mainFn = functions.find((f) => f.name === 'main');
    if (initFn.code.length > 0) {
      curFn = initFn;
      if (mainFn) {
        const pCount = Math.min(2, mainFn.paramCount || 0);
        for (let pi = 0; pi < pCount; pi++) {
          emit('LOAD_LOCAL', pi);
        }
        emit('CALL', 'main', pCount);
        emit('RET');
      } else {
        emit('CONST', null);
        emit('RET');
      }
      functions.unshift({
        name: '__entry',
        paramCount: 2,
        localCount: initFn.localCount,
        code: initFn.code
      });
      entryName = '__entry';
    } else if (!mainFn) {
      throw new Error('Program has neither main() function nor top-level statements');
    }

    return {
      magic: 'NOSBC1',
      version: 1,
      entry: entryName,
      functions
    };
  }

  return { compileNos, tokenize };
});
