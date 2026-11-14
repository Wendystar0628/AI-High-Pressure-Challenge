// Self-hosting NScript Compiler (/System/compiler.ns)
// Written in NScript itself! Compiles NScript source code into NSBC v1 bytecode.

export const COMPILER_NS_SOURCE = `// ============================================================
// NScript 自举编译器 (/System/compiler.ns)
// 支持修改并重新编译自身 (编译器自编译)
// 输入: 全局变量 __source (源码文本), __compiler_id (编译器标识)
// 输出: 返回 { ok: true, bytecode: ... } 或 { ok: false, error: "..." }
// ============================================================

let COMPILER_VERSION_TAG = "nscript-selfhost-1.0";

fn is_digit(c) {
  return c >= 48 && c <= 57;
}

fn is_hex(c) {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
}

fn is_alpha(c) {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c == 95;
}

fn is_alnum(c) {
  return is_alpha(c) || is_digit(c);
}

fn is_keyword(id) {
  return id == "let" || id == "fn" || id == "if" || id == "else" ||
         id == "while" || id == "for" || id == "return" ||
         id == "break" || id == "continue" || id == "true" ||
         id == "false" || id == "null" || id == "syscall";
}

fn is_builtin(id) {
  let b = {
    len: 1, push: 1, pop: 1, shift: 1, slice: 1, splice_remove: 1, concat: 1,
    index_of: 1, substr: 1, char_at: 1, char_code: 1, from_char_code: 1,
    split: 1, join: 1, trim: 1, upper: 1, lower: 1, replace: 1,
    keys: 1, has_key: 1, del_key: 1, type_of: 1, to_str: 1, to_num: 1,
    parse_int: 1, is_nan: 1, clone: 1, json_parse: 1, json_stringify: 1, str_hash: 1,
    abs: 1, floor: 1, ceil: 1, round: 1, min: 1, max: 1, sqrt: 1,
    sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan2: 1, pow: 1, exp: 1, log: 1,
    clamp: 1, rand: 1, sort_num: 1, sort_str: 1, print_log: 1
  };
  return has_key(b, id);
}

fn tokenize_src(src) {
  let tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;
  let n = len(src);

  while (i < n) {
    let ch = char_at(src, i);
    let code = char_code(src, i);

    if (ch == " " || ch == "\\t" || ch == "\\r" || ch == "\\n") {
      if (ch == "\\n") {
        line += 1;
        col = 1;
      } else {
        col += 1;
      }
      i += 1;
      continue;
    }

    if (ch == "/" && i + 1 < n && char_at(src, i + 1) == "/") {
      while (i < n && char_at(src, i) != "\\n") {
        i += 1;
        col += 1;
      }
      continue;
    }

    if (ch == "/" && i + 1 < n && char_at(src, i + 1) == "*") {
      let sl = line;
      i += 2;
      col += 2;
      while (i < n && !(char_at(src, i) == "*" && i + 1 < n && char_at(src, i + 1) == "/")) {
        if (char_at(src, i) == "\\n") {
          line += 1;
          col = 1;
        } else {
          col += 1;
        }
        i += 1;
      }
      if (i >= n) {
        return { ok: false, error: "未闭合的多行注释 (line " + to_str(sl) + ")", line: sl };
      }
      i += 2;
      col += 2;
      continue;
    }

    let sline = line;
    let scol = col;

    // 数字字面量
    if ((code >= 48 && code <= 57) || (ch == "." && i + 1 < n && char_code(src, i + 1) >= 48 && char_code(src, i + 1) <= 57)) {
      if (ch == "0" && i + 1 < n && (char_at(src, i + 1) == "x" || char_at(src, i + 1) == "X")) {
        i += 2;
        col += 2;
        let hstart = i;
        while (i < n) {
          let hc = char_code(src, i);
          if ((hc >= 48 && hc <= 57) || (hc >= 65 && hc <= 70) || (hc >= 97 && hc <= 102)) {
            i += 1;
            col += 1;
          } else {
            break;
          }
        }
        push(tokens, { type: "NUM", value: parse_int(substr(src, hstart, i - hstart), 16), line: sline, col: scol });
        continue;
      }
      let nstart = i;
      let has_dot = false;
      while (i < n) {
        let nc = char_code(src, i);
        if (nc >= 48 && nc <= 57) {
          i += 1;
          col += 1;
        } else if (nc == 46 && !has_dot) {
          has_dot = true;
          i += 1;
          col += 1;
        } else {
          break;
        }
      }
      push(tokens, { type: "NUM", value: to_num(substr(src, nstart, i - nstart)), line: sline, col: scol });
      continue;
    }

    // 字符串字面量
    if (ch == "\\"" || ch == "'") {
      let quote = ch;
      i += 1;
      col += 1;
      let out_str = "";
      let chunk_start = i;
      while (i < n && char_at(src, i) != quote) {
        let sc = char_at(src, i);
        if (sc == "\\\\") {
          if (i > chunk_start) out_str += substr(src, chunk_start, i - chunk_start);
          i += 1;
          col += 1;
          if (i >= n) {
            return { ok: false, error: "未闭合的字符串转义 (line " + to_str(sline) + ")", line: sline };
          }
          let esc = char_at(src, i);
          if (esc == "n") out_str += "\\n";
          else if (esc == "r") out_str += "\\r";
          else if (esc == "t") out_str += "\\t";
          else if (esc == "\\\\") out_str += "\\\\";
          else if (esc == "\\"") out_str += "\\"";
          else if (esc == "'") out_str += "'";
          else if (esc == "0") out_str += from_char_code(0);
          else out_str += esc;
          i += 1;
          col += 1;
          chunk_start = i;
        } else {
          if (sc == "\\n") {
            line += 1;
            col = 1;
          } else {
            col += 1;
          }
          i += 1;
        }
      }
      if (i >= n) {
        return { ok: false, error: "未闭合的字符串 (line " + to_str(sline) + ")", line: sline };
      }
      if (i > chunk_start) out_str += substr(src, chunk_start, i - chunk_start);
      i += 1;
      col += 1;
      push(tokens, { type: "STR", value: out_str, line: sline, col: scol });
      continue;
    }

    // 标识符或关键字
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code == 95) {
      let istart = i;
      while (i < n) {
        let ic = char_code(src, i);
        if ((ic >= 65 && ic <= 90) || (ic >= 97 && ic <= 122) || (ic >= 48 && ic <= 57) || ic == 95) {
          i += 1;
          col += 1;
        } else {
          break;
        }
      }
      let id = substr(src, istart, i - istart);
      let ttype = "ID";
      if (is_keyword(id)) ttype = id;
      push(tokens, { type: ttype, value: id, line: sline, col: scol });
      continue;
    }

    // 双字符运算符
    let two = "";
    if (i + 1 < n) two = ch + char_at(src, i + 1);
    if (two == "==" || two == "!=" || two == "<=" || two == ">=" ||
        two == "&&" || two == "||" || two == "+=" || two == "-=" || two == "*=") {
      push(tokens, { type: two, value: two, line: sline, col: scol });
      i += 2;
      col += 2;
      continue;
    }

    // 单字符符号
    if (index_of("+-*/%<>=!(){}[],.;:?", ch) >= 0) {
      push(tokens, { type: ch, value: ch, line: sline, col: scol });
      i += 1;
      col += 1;
      continue;
    }

    return { ok: false, error: "无法识别的字符 '" + ch + "' (line " + to_str(sline) + ")", line: sline };
  }

  push(tokens, { type: "EOF", value: "", line: line, col: col });
  return { ok: true, tokens: tokens };
}

// 操作码常量 (与 vm.js 严格一致)
let OP = {
  CONST: 1, LOAD_LOCAL: 2, STORE_LOCAL: 3, LOAD_GLOBAL: 4, STORE_GLOBAL: 5,
  POP: 6, DUP: 7, MAKE_ARRAY: 8, MAKE_OBJECT: 9, GET_PROP: 10, SET_PROP: 11,
  ADD: 12, SUB: 13, MUL: 14, DIV: 15, MOD: 16,
  EQ: 17, NEQ: 18, LT: 19, LTE: 20, GT: 21, GTE: 22,
  NOT: 23, NEG: 24, JUMP: 25, JUMP_IF_FALSE: 26, JUMP_IF_TRUE: 27,
  MAKE_FN: 28, CALL: 29, RETURN: 30, SYSCALL: 31, HALT: 32,
  DUP2: 33, LOAD_BUILTIN: 34
};

// 编译器状态
let C = null;

fn c_peek(off) {
  let idx = C.pos + off;
  if (idx >= len(C.tokens)) idx = len(C.tokens) - 1;
  return C.tokens[idx];
}

fn c_next() {
  let t = C.tokens[C.pos];
  C.pos += 1;
  return t;
}

fn c_match(tt) {
  if (c_peek(0).type == tt) return c_next();
  return null;
}

fn c_fail(msg, tok) {
  if (!C.error) {
    let ln = 0;
    if (tok) ln = tok.line;
    C.error = { message: msg, line: ln };
  }
  return null;
}

fn c_expect(tt, msg) {
  let t = c_peek(0);
  if (t.type != tt) {
    c_fail(msg + "，实际遇到 '" + to_str(t.value) + "' (line " + to_str(t.line) + ")", t);
    return t;
  }
  return c_next();
}

fn c_expect_prop() {
  let t = c_peek(0);
  if (t.type != "ID" && !is_keyword(t.type)) {
    c_fail("期望属性名，实际遇到 '" + to_str(t.value) + "' (line " + to_str(t.line) + ")", t);
    return t;
  }
  return c_next();
}

fn c_add_const(val) {
  let prefix = "N:";
  if (type_of(val) == "string") prefix = "S:";
  let key = prefix + to_str(val);
  if (has_key(C.constMap, key)) return C.constMap[key];
  let idx = len(C.consts);
  push(C.consts, val);
  C.constMap[key] = idx;
  return idx;
}

fn c_cur_fn() {
  return C.fnStack[len(C.fnStack) - 1];
}

fn c_emit1(op) {
  let f = c_cur_fn();
  let idx = len(f.code);
  push(f.code, op);
  return idx;
}

fn c_emit2(op, arg) {
  let f = c_cur_fn();
  let idx = len(f.code);
  push(f.code, op);
  push(f.code, arg);
  return idx;
}

fn c_emit_jump(op) {
  let f = c_cur_fn();
  let idx = len(f.code);
  push(f.code, op);
  push(f.code, 0);
  return idx + 1;
}

fn c_patch_jump(op_idx, target) {
  c_cur_fn().code[op_idx] = target;
}

fn c_push_scope() {
  push(c_cur_fn().scopes, {});
}

fn c_pop_scope() {
  pop(c_cur_fn().scopes);
}

fn c_declare_local(name) {
  let f = c_cur_fn();
  if (f.isTopLevel && len(f.scopes) == 1) {
    return { kind: "global", name: name };
  }
  let top = f.scopes[len(f.scopes) - 1];
  if (has_key(top, name)) return { kind: "local", slot: top[name] };
  let slot = f.localCount;
  f.localCount += 1;
  top[name] = slot;
  return { kind: "local", slot: slot };
}

fn c_resolve_var(name) {
  let f = c_cur_fn();
  let s = len(f.scopes) - 1;
  while (s >= 0) {
    if (has_key(f.scopes[s], name)) {
      return { kind: "local", slot: f.scopes[s][name] };
    }
    s -= 1;
  }
  if (has_key(C.topFnIndices, name)) {
    return { kind: "fn", fnIdx: C.topFnIndices[name] };
  }
  if (is_builtin(name)) {
    return { kind: "builtin", name: name };
  }
  return { kind: "global", name: name };
}

fn c_emit_var_load(binding) {
  if (binding.kind == "local") c_emit2(OP.LOAD_LOCAL, binding.slot);
  else if (binding.kind == "fn") c_emit2(OP.MAKE_FN, binding.fnIdx);
  else if (binding.kind == "builtin") c_emit2(OP.LOAD_BUILTIN, c_add_const(binding.name));
  else c_emit2(OP.LOAD_GLOBAL, c_add_const(binding.name));
}

fn c_make_fn_builder(name, params) {
  let scope0 = {};
  for (let i = 0; i < len(params); i += 1) {
    scope0[params[i]] = i;
  }
  return {
    name: name,
    params: params,
    localCount: len(params),
    scopes: [scope0],
    code: [],
    loops: [],
    isTopLevel: name == "__main__"
  };
}

fn c_is_assign_start() {
  if (c_peek(0).type != "ID") return false;
  let p = C.pos + 1;
  let n = len(C.tokens);
  let last_access = true;
  while (p < n) {
    let t = C.tokens[p];
    if (t.type == ".") {
      if (p + 1 >= n) return false;
      let nt = C.tokens[p + 1];
      if (nt.type != "ID" && !is_keyword(nt.type)) return false;
      p += 2;
      last_access = true;
    } else if (t.type == "[" || t.type == "(") {
      let is_br = t.type == "[";
      let depth = 1;
      p += 1;
      while (p < n && depth > 0) {
        let tt = C.tokens[p].type;
        if (tt == "[" || tt == "(" || tt == "{") depth += 1;
        else if (tt == "]" || tt == ")" || tt == "}") depth -= 1;
        p += 1;
      }
      last_access = is_br;
    } else {
      break;
    }
  }
  if (!last_access || p >= n) return false;
  let op = C.tokens[p].type;
  return op == "=" || op == "+=" || op == "-=" || op == "*=";
}

fn c_compile_fn_def(fn_name, forced_idx) {
  c_expect("(", "期望参数列表 (");
  let params = [];
  if (c_peek(0).type != ")") {
    while (true) {
      let pt = c_expect("ID", "期望参数名");
      push(params, pt.value);
      if (!c_match(",")) break;
    }
  }
  c_expect(")", "期望 )");
  c_expect("{", "期望函数体 {");

  let fn_idx = forced_idx;
  if (fn_idx == null) {
    fn_idx = len(C.functions);
    push(C.functions, null);
  }

  let builder = c_make_fn_builder(fn_name, params);
  push(C.fnStack, builder);

  while (!C.error && c_peek(0).type != "}" && c_peek(0).type != "EOF") {
    c_compile_stmt();
  }
  c_expect("}", "期望 }");

  c_emit2(OP.CONST, c_add_const(null));
  c_emit1(OP.RETURN);

  pop(C.fnStack);
  C.functions[fn_idx] = {
    name: fn_name,
    paramCount: len(params),
    localCount: builder.localCount,
    code: builder.code
  };
  return fn_idx;
}

fn c_compile_block() {
  c_expect("{", "期望 {");
  c_push_scope();
  while (!C.error && c_peek(0).type != "}" && c_peek(0).type != "EOF") {
    c_compile_stmt();
  }
  c_expect("}", "期望 }");
  c_pop_scope();
}

fn c_compile_stmt() {
  if (C.error) return;
  let t = c_peek(0);
  if (t.type == ";") {
    c_next();
    return;
  }
  if (t.type == "{") {
    c_compile_block();
    return;
  }
  if (t.type == "fn" && c_peek(1).type == "ID") {
    c_next();
    let name_tok = c_next();
    let forced = null;
    if (has_key(C.topFnIndices, name_tok.value) && c_cur_fn().isTopLevel) {
      forced = C.topFnIndices[name_tok.value];
    }
    let fn_idx = c_compile_fn_def(name_tok.value, forced);
    if (forced == null) {
      let binding = c_declare_local(name_tok.value);
      c_emit2(OP.MAKE_FN, fn_idx);
      if (binding.kind == "local") c_emit2(OP.STORE_LOCAL, binding.slot);
      else c_emit2(OP.STORE_GLOBAL, c_add_const(binding.name));
      c_emit1(OP.POP);
    }
    return;
  }
  if (t.type == "let") {
    c_next();
    let id_tok = c_expect("ID", "期望变量名");
    let binding = c_declare_local(id_tok.value);
    if (c_match("=")) {
      c_compile_expr();
    } else {
      c_emit2(OP.CONST, c_add_const(null));
    }
    if (binding.kind == "local") c_emit2(OP.STORE_LOCAL, binding.slot);
    else c_emit2(OP.STORE_GLOBAL, c_add_const(binding.name));
    c_emit1(OP.POP);
    c_match(";");
    return;
  }
  if (t.type == "if") {
    c_next();
    c_expect("(", "期望 (");
    c_compile_expr();
    c_expect(")", "期望 )");
    let j_false = c_emit_jump(OP.JUMP_IF_FALSE);
    c_compile_stmt();
    if (c_match("else")) {
      let j_end = c_emit_jump(OP.JUMP);
      c_patch_jump(j_false, len(c_cur_fn().code));
      c_compile_stmt();
      c_patch_jump(j_end, len(c_cur_fn().code));
    } else {
      c_patch_jump(j_false, len(c_cur_fn().code));
    }
    return;
  }
  if (t.type == "while") {
    c_next();
    let loop_start = len(c_cur_fn().code);
    c_expect("(", "期望 (");
    c_compile_expr();
    c_expect(")", "期望 )");
    let j_exit = c_emit_jump(OP.JUMP_IF_FALSE);
    let loop_ctx = { continueTarget: loop_start, breakPatches: [] };
    push(c_cur_fn().loops, loop_ctx);
    c_compile_stmt();
    c_emit2(OP.JUMP, loop_start);
    let loop_end = len(c_cur_fn().code);
    c_patch_jump(j_exit, loop_end);
    for (let k = 0; k < len(loop_ctx.breakPatches); k += 1) {
      c_patch_jump(loop_ctx.breakPatches[k], loop_end);
    }
    pop(c_cur_fn().loops);
    return;
  }
  if (t.type == "for") {
    c_next();
    c_expect("(", "期望 (");
    c_push_scope();
    if (c_peek(0).type != ";") {
      if (c_peek(0).type == "let") {
        c_compile_stmt();
      } else {
        c_compile_expr();
        c_emit1(OP.POP);
        c_expect(";", "期望 ;");
      }
    } else {
      c_next();
    }
    let cond_pos = len(c_cur_fn().code);
    let j_exit = -1;
    if (c_peek(0).type != ";") {
      c_compile_expr();
      j_exit = c_emit_jump(OP.JUMP_IF_FALSE);
    }
    c_expect(";", "期望 ;");
    let j_body = c_emit_jump(OP.JUMP);
    let step_pos = len(c_cur_fn().code);
    if (c_peek(0).type != ")") {
      c_compile_expr();
      c_emit1(OP.POP);
    }
    c_expect(")", "期望 )");
    c_emit2(OP.JUMP, cond_pos);
    c_patch_jump(j_body, len(c_cur_fn().code));

    let loop_ctx = { continueTarget: step_pos, breakPatches: [] };
    push(c_cur_fn().loops, loop_ctx);
    c_compile_stmt();
    c_emit2(OP.JUMP, step_pos);
    let loop_end = len(c_cur_fn().code);
    if (j_exit != -1) c_patch_jump(j_exit, loop_end);
    for (let k = 0; k < len(loop_ctx.breakPatches); k += 1) {
      c_patch_jump(loop_ctx.breakPatches[k], loop_end);
    }
    pop(c_cur_fn().loops);
    c_pop_scope();
    return;
  }
  if (t.type == "break") {
    c_next();
    let loops = c_cur_fn().loops;
    if (len(loops) == 0) { c_fail("break 只能用于循环内", t); return; }
    push(loops[len(loops) - 1].breakPatches, c_emit_jump(OP.JUMP));
    c_match(";");
    return;
  }
  if (t.type == "continue") {
    c_next();
    let loops = c_cur_fn().loops;
    if (len(loops) == 0) { c_fail("continue 只能用于循环内", t); return; }
    c_emit2(OP.JUMP, loops[len(loops) - 1].continueTarget);
    c_match(";");
    return;
  }
  if (t.type == "return") {
    c_next();
    if (c_peek(0).type == ";" || c_peek(0).type == "}") {
      c_emit2(OP.CONST, c_add_const(null));
    } else {
      c_compile_expr();
    }
    c_emit1(OP.RETURN);
    c_match(";");
    return;
  }

  c_compile_expr();
  c_emit1(OP.POP);
  c_match(";");
}

fn c_emit_compound(op_type) {
  if (op_type == "+=") c_emit1(OP.ADD);
  else if (op_type == "-=") c_emit1(OP.SUB);
  else if (op_type == "*=") c_emit1(OP.MUL);
}

fn c_compile_expr() {
  if (C.error) return;
  if (!c_is_assign_start()) {
    c_compile_ternary();
    return;
  }
  let id_tok = c_next();
  let binding = c_resolve_var(id_tok.value);
  let has_acc = c_peek(0).type == "." || c_peek(0).type == "[" || c_peek(0).type == "(";

  if (!has_acc) {
    let op_tok = c_next();
    if (op_tok.type == "=") {
      c_compile_expr();
    } else {
      c_emit_var_load(binding);
      c_compile_expr();
      c_emit_compound(op_tok.type);
    }
    if (binding.kind == "local") c_emit2(OP.STORE_LOCAL, binding.slot);
    else if (binding.kind == "global") c_emit2(OP.STORE_GLOBAL, c_add_const(binding.name));
    else c_fail("无法给函数或内置函数 '" + id_tok.value + "' 赋值", id_tok);
    return;
  }

  c_emit_var_load(binding);
  while (true) {
    if (c_match("(")) {
      let argc = 0;
      if (c_peek(0).type != ")") {
        while (true) {
          c_compile_expr();
          argc += 1;
          if (!c_match(",")) break;
        }
      }
      c_expect(")", "期望 )");
      c_emit2(OP.CALL, argc);
      continue;
    }
    if (c_match(".")) {
      let pt = c_expect_prop();
      c_emit2(OP.CONST, c_add_const(pt.value));
    } else if (c_match("[")) {
      c_compile_expr();
      c_expect("]", "期望 ]");
    } else {
      break;
    }
    if (c_peek(0).type == "." || c_peek(0).type == "[" || c_peek(0).type == "(") {
      c_emit1(OP.GET_PROP);
    } else {
      break;
    }
  }

  let op_tok = c_next();
  if (op_tok.type == "=") {
    c_compile_expr();
  } else {
    c_emit1(OP.DUP2);
    c_emit1(OP.GET_PROP);
    c_compile_expr();
    c_emit_compound(op_tok.type);
  }
  c_emit1(OP.SET_PROP);
}

fn c_compile_ternary() {
  c_compile_or();
  if (c_match("?")) {
    let j_false = c_emit_jump(OP.JUMP_IF_FALSE);
    c_compile_expr();
    c_expect(":", "三元运算符期望 :");
    let j_end = c_emit_jump(OP.JUMP);
    c_patch_jump(j_false, len(c_cur_fn().code));
    c_compile_ternary();
    c_patch_jump(j_end, len(c_cur_fn().code));
  }
}

fn c_compile_or() {
  c_compile_and();
  while (c_match("||")) {
    c_emit1(OP.DUP);
    let j_true = c_emit_jump(OP.JUMP_IF_TRUE);
    c_emit1(OP.POP);
    c_compile_and();
    c_patch_jump(j_true, len(c_cur_fn().code));
  }
}

fn c_compile_and() {
  c_compile_eq();
  while (c_match("&&")) {
    c_emit1(OP.DUP);
    let j_false = c_emit_jump(OP.JUMP_IF_FALSE);
    c_emit1(OP.POP);
    c_compile_eq();
    c_patch_jump(j_false, len(c_cur_fn().code));
  }
}

fn c_compile_eq() {
  c_compile_cmp();
  while (c_peek(0).type == "==" || c_peek(0).type == "!=") {
    let op = c_next().type;
    c_compile_cmp();
    if (op == "==") c_emit1(OP.EQ);
    else c_emit1(OP.NEQ);
  }
}

fn c_compile_cmp() {
  c_compile_term();
  while (c_peek(0).type == "<" || c_peek(0).type == "<=" ||
         c_peek(0).type == ">" || c_peek(0).type == ">=") {
    let op = c_next().type;
    c_compile_term();
    if (op == "<") c_emit1(OP.LT);
    else if (op == "<=") c_emit1(OP.LTE);
    else if (op == ">") c_emit1(OP.GT);
    else c_emit1(OP.GTE);
  }
}

fn c_compile_term() {
  c_compile_factor();
  while (c_peek(0).type == "+" || c_peek(0).type == "-") {
    let op = c_next().type;
    c_compile_factor();
    if (op == "+") c_emit1(OP.ADD);
    else c_emit1(OP.SUB);
  }
}

fn c_compile_factor() {
  c_compile_unary();
  while (c_peek(0).type == "*" || c_peek(0).type == "/" || c_peek(0).type == "%") {
    let op = c_next().type;
    c_compile_unary();
    if (op == "*") c_emit1(OP.MUL);
    else if (op == "/") c_emit1(OP.DIV);
    else c_emit1(OP.MOD);
  }
}

fn c_compile_unary() {
  if (c_match("!")) {
    c_compile_unary();
    c_emit1(OP.NOT);
    return;
  }
  if (c_match("-")) {
    c_compile_unary();
    c_emit1(OP.NEG);
    return;
  }
  if (c_match("+")) {
    c_compile_unary();
    return;
  }
  c_compile_postfix();
}

fn c_compile_postfix() {
  c_compile_primary();
  while (!C.error) {
    if (c_match(".")) {
      let pt = c_expect_prop();
      c_emit2(OP.CONST, c_add_const(pt.value));
      c_emit1(OP.GET_PROP);
    } else if (c_match("[")) {
      c_compile_expr();
      c_expect("]", "期望 ]");
      c_emit1(OP.GET_PROP);
    } else if (c_match("(")) {
      let argc = 0;
      if (c_peek(0).type != ")") {
        while (true) {
          c_compile_expr();
          argc += 1;
          if (!c_match(",")) break;
        }
      }
      c_expect(")", "期望 )");
      c_emit2(OP.CALL, argc);
    } else {
      break;
    }
  }
}

fn c_compile_primary() {
  if (C.error) return;
  let t = c_peek(0);
  if (t.type == "NUM" || t.type == "STR") {
    c_next();
    c_emit2(OP.CONST, c_add_const(t.value));
    return;
  }
  if (t.type == "true") { c_next(); c_emit2(OP.CONST, c_add_const(true)); return; }
  if (t.type == "false") { c_next(); c_emit2(OP.CONST, c_add_const(false)); return; }
  if (t.type == "null") { c_next(); c_emit2(OP.CONST, c_add_const(null)); return; }
  if (t.type == "syscall") {
    c_next();
    c_expect("(", "syscall 后期望 (");
    c_compile_expr();
    let argc = 0;
    while (c_match(",")) {
      c_compile_expr();
      argc += 1;
    }
    c_expect(")", "期望 )");
    c_emit2(OP.SYSCALL, argc);
    return;
  }
  if (t.type == "fn") {
    c_next();
    let fn_idx = c_compile_fn_def("<anon>", null);
    c_emit2(OP.MAKE_FN, fn_idx);
    return;
  }
  if (t.type == "ID") {
    c_next();
    c_emit_var_load(c_resolve_var(t.value));
    return;
  }
  if (c_match("(")) {
    c_compile_expr();
    c_expect(")", "期望 )");
    return;
  }
  if (c_match("[")) {
    let cnt = 0;
    if (c_peek(0).type != "]") {
      while (true) {
        if (c_peek(0).type == "]") break;
        c_compile_expr();
        cnt += 1;
        if (!c_match(",")) break;
      }
    }
    c_expect("]", "期望 ]");
    c_emit2(OP.MAKE_ARRAY, cnt);
    return;
  }
  if (c_match("{")) {
    let cnt = 0;
    if (c_peek(0).type != "}") {
      while (true) {
        if (c_peek(0).type == "}") break;
        let k = c_peek(0);
        if (k.type == "ID" || k.type == "STR") {
          c_next();
          c_emit2(OP.CONST, c_add_const(k.value));
        } else {
          c_fail("对象键名必须为标识符或字符串", k);
          return;
        }
        c_expect(":", "期望 :");
        c_compile_expr();
        cnt += 1;
        if (!c_match(",")) break;
      }
    }
    c_expect("}", "期望 }");
    c_emit2(OP.MAKE_OBJECT, cnt);
    return;
  }
  c_fail("意外的符号 '" + to_str(t.value) + "'", t);
}

fn compile_source(src, compiler_id) {
  let tok_res = tokenize_src(src);
  if (!tok_res.ok) return tok_res;

  let tokens = tok_res.tokens;
  let top_fns = {};
  let depth = 0;
  let p = 0;
  let next_idx = 1;
  while (p < len(tokens) && tokens[p].type != "EOF") {
    let tk = tokens[p];
    if (tk.type == "{") depth += 1;
    else if (tk.type == "}") {
      if (depth > 0) depth -= 1;
    } else if (depth == 0 && tk.type == "fn" && p + 1 < len(tokens) && tokens[p + 1].type == "ID") {
      let fnm = tokens[p + 1].value;
      if (!has_key(top_fns, fnm)) {
        top_fns[fnm] = next_idx;
        next_idx += 1;
      }
    }
    p += 1;
  }

  let funcs = [null];
  for (let i = 1; i < next_idx; i += 1) push(funcs, null);

  C = {
    tokens: tokens,
    pos: 0,
    consts: [],
    constMap: {},
    functions: funcs,
    topFnIndices: top_fns,
    fnStack: [],
    error: null
  };

  let main_b = c_make_fn_builder("__main__", []);
  push(C.fnStack, main_b);
  while (!C.error && c_peek(0).type != "EOF") {
    c_compile_stmt();
  }
  c_emit1(OP.HALT);
  pop(C.fnStack);

  C.functions[0] = {
    name: "__main__",
    paramCount: 0,
    localCount: main_b.localCount,
    code: main_b.code
  };

  if (C.error) {
    return { ok: false, error: C.error.message, line: C.error.line };
  }

  let cid = compiler_id;
  if (!cid) cid = COMPILER_VERSION_TAG;

  return {
    ok: true,
    bytecode: {
      magic: "NSBC",
      version: 1,
      compilerId: cid,
      srcHash: str_hash(src),
      consts: C.consts,
      functions: C.functions
    }
  };
}

// 执行入口: 若传入 __source 则直接编译并返回结果
if (type_of(__source) == "string") {
  return compile_source(__source, __compiler_id);
}
return { ok: true, info: COMPILER_VERSION_TAG };
`;
