// NScript Bytecode Instruction Set & Format Constants

export const NSBC_MAGIC = 'NSBC';
export const NSBC_VERSION = 1;

export const OP = {
  CONST: 1,
  LOAD_LOCAL: 2,
  STORE_LOCAL: 3,
  LOAD_GLOBAL: 4,
  STORE_GLOBAL: 5,
  POP: 6,
  DUP: 7,
  MAKE_ARRAY: 8,
  MAKE_OBJECT: 9,
  GET_PROP: 10,
  SET_PROP: 11,
  ADD: 12,
  SUB: 13,
  MUL: 14,
  DIV: 15,
  MOD: 16,
  EQ: 17,
  NEQ: 18,
  LT: 19,
  LTE: 20,
  GT: 21,
  GTE: 22,
  NOT: 23,
  NEG: 24,
  JUMP: 25,
  JUMP_IF_FALSE: 26,
  JUMP_IF_TRUE: 27,
  MAKE_FN: 28,
  CALL: 29,
  RETURN: 30,
  SYSCALL: 31,
  HALT: 32,
  DUP2: 33, // duplicates top 2 stack items [a, b] -> [a, b, a, b] for compound member assignment
  LOAD_BUILTIN: 34,
};

export const OP_NAMES = Object.fromEntries(
  Object.entries(OP).map(([k, v]) => [v, k])
);

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
