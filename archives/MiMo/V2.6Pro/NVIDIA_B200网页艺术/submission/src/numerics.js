// ============================================================
// 数值格式：真实量化 / 舍入 / 位划分 —— 第 05 章矩阵实验与全页联动
// 规则依据：IEEE 754 语义；FP8 E4M3 采用 OCP 微缩放约定（无 Inf，NaN=S.1111.111）；
// FP4 E2M1 取值 ±{0,0.5,1,1.5,2,3,4,6}；NVFP4 = 16 值共享 E4M3 缩放 + 张量级 FP32。
// ============================================================

// ---------- 通用工具 ----------
const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

export function floatToBits(x) {
  f32[0] = x;
  return u32[0];
}
export function bitsToFloat(b) {
  u32[0] = b >>> 0;
  return f32[0];
}

function roundTiesToEven(v) {
  // v 为非负有限
  const fl = Math.floor(v);
  const diff = v - fl;
  if (diff > 0.5) return fl + 1;
  if (diff < 0.5) return fl;
  return fl % 2 === 0 ? fl : fl + 1;
}

// ---------- 格式定义 ----------
export const FORMATS = {
  FP64: { sign: 1, exp: 11, mant: 52, bias: 1023, kind: 'ieee' },
  FP32: { sign: 1, exp: 8,  mant: 23, bias: 127,  kind: 'ieee' },
  TF32: { sign: 1, exp: 8,  mant: 10, bias: 127,  kind: 'tf32' },
  FP16: { sign: 1, exp: 5,  mant: 10, bias: 15,   kind: 'ieee' },
  BF16: { sign: 1, exp: 8,  mant: 7,  bias: 127,  kind: 'ieee' },
  FP8E4M3: { sign: 1, exp: 4, mant: 3, bias: 7,   kind: 'e4m3' },
  FP8E5M2: { sign: 1, exp: 5, mant: 2, bias: 15,  kind: 'e5m2' },
  FP4E2M1: { sign: 1, exp: 2, mant: 1, bias: 1,   kind: 'e2m1' },
};

// ---------- 低位宽编码 ----------

function encodeE2M1(value) {
  // FP4 E2M1：返回 {code, q, bits}
  if (!Number.isFinite(value)) return { code: 0, q: 0, bits: '0000' };
  const sign = value < 0 ? 1 : 0;
  const a = Math.abs(value);
  // 可表示 |x| ∈ {0, 0.5, 1, 1.5, 2, 3, 4, 6}
  const levels = [0, 0.5, 1, 1.5, 2, 3, 4, 6];
  let best = 0, bestD = Infinity;
  for (let i = 0; i < levels.length; i++) {
    const d = Math.abs(a - levels[i]);
    if (d < bestD - 1e-12 || (Math.abs(d - bestD) < 1e-12 && (i === 0 || Math.abs(levels[i]) < Math.abs(levels[best])))) {
      // ties-to-even 取低位
      if (d < bestD + 1e-12) { best = i; bestD = d; }
    }
  }
  const q = sign ? -levels[best] : levels[best];
  const code = (sign << 3) | best; // levels 顺序恰好对应编码 0..7
  return { code, q, bits: code.toString(2).padStart(4, '0') };
}

function decodeE2M1(code) {
  const sign = (code >> 3) & 1;
  const m = code & 7;
  const levels = [0, 0.5, 1, 1.5, 2, 3, 4, 6];
  return sign ? -levels[m] : levels[m];
}

function encodeE4M3(value) {
  if (!Number.isFinite(value)) return { code: 0x7f, q: NaN, bits: '11111111' };
  if (value === 0) return { code: 0, q: 0, bits: '00000000' };
  const sign = value < 0 ? 1 : 0;
  const a = Math.abs(value);
  const max = 448;
  let q, code;
  if (a > max) {
    q = max; code = (sign << 7) | 0x7e; // S.1111.110
    return { code, q: sign ? -q : q, bits: code.toString(2).padStart(8, '0') };
  }
  // 规格化指数
  let e = Math.floor(Math.log2(a));
  if (e < -6) e = -6;
  // 有效数 (1..2)
  let frac = a / Math.pow(2, e) - 1; // 0..1
  if (frac < 0) frac = 0;
  // 舍入到 3 位尾数
  let m = roundTiesToEven(frac * 8);
  let expF = e + 7;
  if (m > 7) { m = 0; expF += 1; }
  if (expF >= 15) { m = 6; expF = 15; } // 最大 1.75*2^8=448，NaN 仅 1111.111
  if (expF <= 0) {
    // 次正规
    const sub = Math.pow(2, -6) * (Math.round(a / Math.pow(2, -9)) / 8);
    const mm = Math.min(7, roundTiesToEven(a / Math.pow(2, -9)));
    q = Math.pow(2, -6) * (mm / 8);
    code = (sign << 7) | mm;
    return { code, q: sign ? -q : q, bits: code.toString(2).padStart(8, '0') };
  }
  code = (sign << 7) | (expF << 3) | m;
  q = (1 + m / 8) * Math.pow(2, expF - 7);
  return { code, q: sign ? -q : q, bits: code.toString(2).padStart(8, '0') };
}

function decodeE4M3(code) {
  const sign = (code >> 7) & 1;
  const e = (code >> 3) & 0xf;
  const m = code & 7;
  if (e === 15 && m === 7) return NaN;
  let v;
  if (e === 0) v = Math.pow(2, -6) * (m / 8);
  else v = (1 + m / 8) * Math.pow(2, e - 7);
  return sign ? -v : v;
}

function encodeE5M2(value) {
  if (!Number.isFinite(value)) return { code: 0x7f, q: NaN, bits: '11111111' };
  if (value === 0) return { code: 0, q: 0, bits: '00000000' };
  const sign = value < 0 ? 1 : 0;
  const a = Math.abs(value);
  const max = 57344;
  if (a > max) { return { code: (sign << 7) | 0x7b, q: sign ? -max : max, bits: ((sign << 7) | 0x7b).toString(2).padStart(8, '0') }; }
  let e = Math.floor(Math.log2(a));
  if (e < -14) e = -14;
  let frac = a / Math.pow(2, e) - 1;
  if (frac < 0) frac = 0;
  let m = roundTiesToEven(frac * 4);
  let expF = e + 15;
  if (m > 3) { m = 0; expF += 1; }
  if (expF >= 31) { expF = 30; m = 3; }
  let q, code;
  if (expF <= 0) {
    const mm = Math.min(3, roundTiesToEven(a / Math.pow(2, -16)));
    q = Math.pow(2, -14) * (mm / 4);
    code = (sign << 7) | mm;
    return { code, q: sign ? -q : q, bits: code.toString(2).padStart(8, '0') };
  }
  code = (sign << 7) | (expF << 2) | m;
  q = (1 + m / 4) * Math.pow(2, expF - 15);
  return { code, q: sign ? -q : q, bits: code.toString(2).padStart(8, '0') };
}

// IEEE 半精度类：通过位操作 round-to-nearest-even
function encodeIeee(value, expBits, mantBits, bias) {
  if (!Number.isFinite(value)) {
    const all1 = ((1 << expBits) - 1) << mantBits;
    const code = all1 | (1 << (mantBits - 1)) | (value > 0 ? 0 : 1 << (expBits + mantBits));
    return { code, q: NaN, bits: code.toString(2).padStart(1 + expBits + mantBits, '0') };
  }
  if (value === 0) return { code: 0, q: 0, bits: '0'.repeat(1 + expBits + mantBits) };
  const sign = value < 0 ? 1 : 0;
  const a = Math.abs(value);
  const maxExp = (1 << expBits) - 1;
  const maxNormal = (2 - Math.pow(2, -mantBits)) * Math.pow(2, maxExp - 1 - bias);
  if (a > maxNormal) {
    // 溢出到 ±Inf（IEEE 语义）
    const code = (sign << (expBits + mantBits)) | (maxExp << mantBits);
    return { code, q: sign ? -Infinity : Infinity, bits: code.toString(2).padStart(1 + expBits + mantBits, '0') };
  }
  let e = Math.floor(Math.log2(a));
  const minE = 1 - bias;
  let frac, expF;
  if (e < minE) {
    // 次正规
    const mm = roundTiesToEven(a / Math.pow(2, minE - mantBits));
    const code = (sign << (expBits + mantBits)) | mm;
    const q = mm * Math.pow(2, minE - mantBits);
    return { code, q: sign ? -q : q, bits: code.toString(2).padStart(1 + expBits + mantBits, '0') };
  }
  frac = a / Math.pow(2, e) - 1;
  let m = roundTiesToEven(frac * Math.pow(2, mantBits));
  expF = e + bias;
  if (m >= Math.pow(2, mantBits)) { m = 0; expF += 1; }
  const code = (sign << (expBits + mantBits)) | (expF << mantBits) | m;
  const q = (1 + m / Math.pow(2, mantBits)) * Math.pow(2, expF - bias);
  return { code, q: sign ? -q : q, bits: code.toString(2).padStart(1 + expBits + mantBits, '0') };
}

// ---------- 对外：量化单个值 ----------
// fmt: FP64 | TF32 | FP16 | BF16 | FP8 | FP8E5M2 | FP4
export function quantize(x, fmt) {
  switch (fmt) {
    case 'FP64':
      return { q: x, bits: encodeIeee(x, 11, 52, 1023).bits, err: 0 };
    case 'TF32': {
      const r = encodeIeee(x, 8, 10, 127);
      return { q: r.q, bits: r.bits, err: x - r.q };
    }
    case 'FP16': {
      const r = encodeIeee(x, 5, 10, 15);
      return { q: r.q, bits: r.bits, err: x - r.q };
    }
    case 'BF16': {
      const r = encodeIeee(x, 8, 7, 127);
      return { q: r.q, bits: r.bits, err: x - r.q };
    }
    case 'FP8': {
      const r = encodeE4M3(x);
      return { q: r.q, bits: r.bits, err: x - r.q };
    }
    case 'FP8E5M2': {
      const r = encodeE5M2(x);
      return { q: r.q, bits: r.bits, err: x - r.q };
    }
    case 'FP4': {
      // 单值使用共享缩放 1（矩阵级请用 quantizeBlockFP4）
      const r = encodeE2M1(x);
      return { q: r.q, bits: r.bits, err: x - r.q };
    }
    default:
      return { q: x, bits: '', err: 0 };
  }
}

// NVFP4：一组值（≤16）共享 E4M3 缩放因子
export function quantizeBlockFP4(values) {
  const flat = values.flat ? values.flat() : values.slice();
  let amax = 0;
  for (const v of flat) amax = Math.max(amax, Math.abs(v));
  if (amax === 0) amax = 1;
  // 张量级 FP32 缩放（此处取 1），块级缩放 s = amax/6，再把 s 量化到 E4M3
  const sRaw = amax / 6;
  const sEnc = encodeE4M3(sRaw);
  const s = sEnc.q > 0 ? sEnc.q : sRaw;
  const qs = [];
  const bits = [];
  for (const v of flat) {
    const r = encodeE2M1(v / s);
    qs.push(r.q * s);
    bits.push(r.bits);
  }
  return { values: qs, bits, scale: s, scaleBits: sEnc.bits, amax };
}

// 矩阵量化（2D 输入），返回同形状结果
export function quantizeMatrix(mat, fmt) {
  const rows = mat.length, cols = mat[0].length;
  if (fmt === 'FP4') {
    const { values, bits, scale } = quantizeBlockFP4(mat);
    const out = [], b = [], err = [];
    let k = 0;
    for (let i = 0; i < rows; i++) {
      out.push([]); b.push([]); err.push([]);
      for (let j = 0; j < cols; j++) {
        out[i].push(values[k]);
        b[i].push(bits[k]);
        err[i].push(mat[i][j] - values[k]);
        k++;
      }
    }
    return { mat: out, bits: b, errors: err, scale };
  }
  const out = [], b = [], err = [];
  for (let i = 0; i < rows; i++) {
    out.push([]); b.push([]); err.push([]);
    for (let j = 0; j < cols; j++) {
      const r = quantize(mat[i][j], fmt);
      out[i].push(r.q);
      b[i].push(r.bits);
      err[i].push(r.err);
    }
  }
  return { mat: out, bits: b, errors: err, scale: 1 };
}

// ---------- 矩阵乘 ----------
export function matmul(a, b) {
  const n = a.length, m = b[0].length, k = b.length;
  const c = [];
  for (let i = 0; i < n; i++) {
    c.push([]);
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += a[i][t] * b[t][j];
      c[i].push(s);
    }
  }
  return c;
}

// 追踪输出元素 (i,j) 的乘加序列
export function traceMACs(a, b, i, j) {
  const k = b.length;
  const steps = [];
  let acc = 0;
  for (let t = 0; t < k; t++) {
    const p = a[i][t] * b[t][j];
    acc += p;
    steps.push({ t, av: a[i][t], bv: b[t][j], p, acc });
  }
  return steps;
}

export function nonzeroCount(m) {
  let n = 0;
  for (const r of m) for (const v of r) if (v !== 0) n++;
  return n;
}

// 格式位宽信息（供第 05 章位格动画）
export function formatBits(fmt) {
  switch (fmt) {
    case 'FP64': return FORMATS.FP64;
    case 'TF32': return FORMATS.TF32;
    case 'FP16': return FORMATS.FP16;
    case 'BF16': return FORMATS.BF16;
    case 'FP8': return FORMATS.FP8E4M3;
    case 'FP8E5M2': return FORMATS.FP8E5M2;
    case 'FP4': return FORMATS.FP4E2M1;
    default: return FORMATS.FP32;
  }
}

export function formatBitString(fmt) {
  const f = formatBits(fmt);
  return { sign: f.sign, exp: f.exp, mant: f.mant, total: f.sign + f.exp + f.mant };
}
