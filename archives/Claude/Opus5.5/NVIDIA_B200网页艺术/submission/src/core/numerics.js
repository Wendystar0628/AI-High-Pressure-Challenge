// 六种数值格式的真实量化与矩阵乘加。所有读数都从这里算出来，不写死。
//
// FP64  IEEE 754 binary64  S1 E11 M52
// TF32  张量核心 FP32 的 19 位有效表示 S1 E8 M10（存储仍占 32 位）
// FP16  IEEE 754 binary16  S1 E5 M10
// BF16  bfloat16           S1 E8 M7
// FP8   OCP E4M3           S1 E4 M3，偏置 7，无无穷，最大 ±448，上溢饱和
// FP4   E2M1 + 块缩放（NVFP4 口径）S1 E2 M1，取值 ±{0,.5,1,1.5,2,3,4,6}；
//       每 16 个值共享一个 E4M3 缩放因子 s，x̂ = q × s × g，g 为每张量一个的 FP32 二级缩放；
//       每值平均 4 + 8/16 = 4.5 位。
// 舍入：全部为就近舍入，平局取偶数尾数。
export const FORMAT_ORDER = ['FP64', 'TF32', 'FP16', 'BF16', 'FP8', 'FP4'];

export const FORMATS = {
  FP64: { id: 'FP64', bits: 64, S: 1, E: 11, M: 52, bias: 1023, store: 64, effective: 64, label: 'IEEE binary64', use: '科学计算 · 气候、分子、流体', accName: 'FP64' },
  TF32: { id: 'TF32', bits: 19, S: 1, E: 8, M: 10, bias: 127, store: 32, effective: 32, label: 'Tensor Float 32', use: '训练 · 张量核心的 FP32 捷径', accName: 'FP32' },
  FP16: { id: 'FP16', bits: 16, S: 1, E: 5, M: 10, bias: 15, store: 16, effective: 16, label: 'IEEE binary16', use: '训练 · 混合精度', accName: 'FP16' },
  BF16: { id: 'BF16', bits: 16, S: 1, E: 8, M: 7, bias: 127, store: 16, effective: 16, label: 'bfloat16', use: '训练 · 范围同 FP32，尾数更短', accName: 'BF16' },
  FP8: { id: 'FP8', bits: 8, S: 1, E: 4, M: 3, bias: 7, store: 8, effective: 8, label: 'OCP FP8 E4M3', use: '推理与微调', accName: 'FP32' },
  FP4: { id: 'FP4', bits: 4, S: 1, E: 2, M: 1, bias: 1, store: 4, effective: 4.5, label: 'E2M1 + E4M3 块缩放', use: '大模型推理 · NVFP4', accName: 'FP32' },
};

const f32 = new Float32Array(1);
export const toF32 = x => { f32[0] = x; return f32[0]; };

// 把 |x| 舍入到 (E,M,bias) 的二进制浮点，就近、平局取偶
function roundIEEE(x, E, M, bias, satur = false) {
  if (x === 0 || !isFinite(x)) return x;
  const sign = Math.sign(x), a = Math.abs(x);
  const maxExp = (1 << E) - 2 - bias;
  const minExp = 1 - bias;
  let e = Math.floor(Math.log2(a));
  if (Math.pow(2, e + 1) <= a) e++;
  if (e < minExp) e = minExp; // 次正规
  const ulp = Math.pow(2, e - M);
  const n = a / ulp;
  let r = Math.floor(n);
  const frac = n - r;
  if (frac > .5 || (frac === .5 && r % 2 === 1)) r++;
  const v = r * ulp;
  const max = (2 - Math.pow(2, -M)) * Math.pow(2, maxExp);
  if (v > max) return satur ? sign * max : sign * Infinity;
  return sign * v;
}

// E4M3：指数场 15 仍可表示正常值（尾数全 1 留给 NaN），最大 448
export const E4M3_TABLE = (() => {
  const t = [];
  for (let e = 0; e < 16; e++) for (let m = 0; m < 8; m++) {
    if (e === 15 && m === 7) continue;
    t.push(e === 0 ? m / 8 * Math.pow(2, -6) : (1 + m / 8) * Math.pow(2, e - 7));
  }
  return t;
})();
export const E2M1_TABLE = [0, .5, 1, 1.5, 2, 3, 4, 6];

function nearestInTable(a, table) {
  let lo = 0, hi = table.length - 1;
  if (a >= table[hi]) return hi;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (table[m] <= a) lo = m; else hi = m; }
  const dl = a - table[lo], dh = table[hi] - a;
  if (dl < dh) return lo;
  if (dh < dl) return hi;
  return lo % 2 === 0 ? lo : hi; // 平局取偶数尾数
}
export function roundE4M3(x) {
  if (x === 0) return 0;
  return Math.sign(x) * E4M3_TABLE[nearestInTable(Math.abs(x), E4M3_TABLE)];
}
export function roundE2M1(x) {
  if (x === 0) return 0;
  return Math.sign(x) * E2M1_TABLE[nearestInTable(Math.abs(x), E2M1_TABLE)];
}

// 标量量化（FP4 需要 scale）
export function quantize(x, fmtId, scale = 1) {
  switch (fmtId) {
    case 'FP64': return x;
    case 'TF32': return roundIEEE(x, 8, 10, 127);
    case 'FP16': return roundIEEE(x, 5, 10, 15);
    case 'BF16': return roundIEEE(x, 8, 7, 127);
    case 'FP8': return roundE4M3(x);
    case 'FP4': return roundE2M1(x / scale) * scale;
  }
  return x;
}

// 为一块（最多 16 个值）搜索使均方误差最小的 E4M3 缩放因子
export function fp4BlockScale(values) {
  let max = 0;
  for (const v of values) max = Math.max(max, Math.abs(v));
  if (max === 0) return { s: 1, g: 1, base: 1 };
  // 二级缩放 g 只在块缩放超出 E4M3 范围时启用
  let g = 1;
  const raw = max / 6;
  if (raw > 400 || raw < 0.02) g = toF32(raw / 4);
  const target = raw / g;
  let best = Infinity, bestS = roundE4M3(target);
  // 只搜 max/6 附近的 E4M3 刻度：更大的 s 会丢精度，更小的 s 会使大值饱和
  for (const s of E4M3_TABLE) {
    if (s <= 0 || s < target * .42 || s > target * 1.35) continue;
    let e = 0;
    for (const v of values) { const d = v - roundE2M1(v / (s * g)) * s * g; e += d * d; }
    if (e < best - 1e-15) { best = e; bestS = s; }
  }
  return { s: bestS, g, base: bestS * g };
}

// 编码成位串（用于位格显示）
export function encodeBits(x, fmtId, scale = 1) {
  const F = FORMATS[fmtId];
  if (fmtId === 'FP64') {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, x);
    let s = '';
    for (let i = 0; i < 8; i++) s += dv.getUint8(i).toString(2).padStart(8, '0');
    return s;
  }
  if (fmtId === 'FP4') {
    const a = Math.abs(x / scale);
    const idx = nearestInTable(a, E2M1_TABLE);
    return (x < 0 ? '1' : '0') + idx.toString(2).padStart(3, '0');
  }
  if (fmtId === 'FP8') {
    const a = Math.abs(x);
    const idx = nearestInTable(a, E4M3_TABLE);
    return (x < 0 ? '1' : '0') + idx.toString(2).padStart(7, '0');
  }
  const a = Math.abs(quantize(x, fmtId));
  const sign = x < 0 ? '1' : '0';
  if (a === 0) return sign + '0'.repeat(F.E + F.M);
  if (!isFinite(a)) return sign + '1'.repeat(F.E) + '0'.repeat(F.M);
  let e = Math.floor(Math.log2(a));
  if (Math.pow(2, e + 1) <= a) e++;
  if (Math.pow(2, e) > a) e--;
  let field = e + F.bias;
  let mant;
  if (field <= 0) { field = 0; mant = Math.round(a / Math.pow(2, 1 - F.bias - F.M)); }
  else mant = Math.round((a / Math.pow(2, e) - 1) * Math.pow(2, F.M));
  return sign + field.toString(2).padStart(F.E, '0') + mant.toString(2).padStart(F.M, '0');
}

// 数轴上的可表示值：[-range, range] 内均匀抽 n 个索引。值少时重复，刻度重合；值多时抽样
export function representable(fmtId, scale = 1, range = 8, n = 97) {
  const out = [];
  const half = (n - 1) / 2;
  let mags;
  if (fmtId === 'FP4') mags = E2M1_TABLE.map(v => v * scale);
  else if (fmtId === 'FP8') mags = E4M3_TABLE;
  else {
    const F = FORMATS[fmtId];
    const M = Math.min(F.M, 7); // 高精度格式抽样展示
    const set = [0];
    for (let e = -7; e <= 4; e++) for (let m = 0; m < (1 << M); m++) set.push((1 + m / (1 << M)) * Math.pow(2, e));
    mags = set;
  }
  mags = mags.filter(v => v <= range);
  const step = (mags.length - 1) / half;
  for (let i = 0; i <= half; i++) {
    const v = mags[Math.round(i * step)] ?? mags[mags.length - 1];
    out[half + i] = v; out[half - i] = -v;
  }
  return out;
}

export function representableCount(fmtId) {
  return { FP64: 2 ** 64, TF32: 2 ** 19, FP16: 2 ** 16, BF16: 2 ** 16, FP8: 255, FP4: 15 }[fmtId];
}

// 量化矩阵（4×4 正好一块 16 个值）
export function quantMatrix(M, fmtId) {
  const flat = M.flat();
  const sc = fmtId === 'FP4' ? fp4BlockScale(flat) : { s: 1, g: 1, base: 1 };
  const Q = M.map(row => row.map(v => quantize(v, fmtId, sc.base)));
  const E = M.map((row, i) => row.map((v, j) => Q[i][j] - v));
  const codes = fmtId === 'FP4' ? M.map(row => row.map(v => roundE2M1(v / sc.base))) : Q;
  return { Q, E, scale: sc.s, g: sc.g, base: sc.base, codes };
}

// 2:4 结构化稀疏：每组 4 个保留幅度最大的 2 个，其余置零
export function sparsify(M, byColumn = false) {
  const n = M.length;
  const out = M.map(r => r.slice());
  for (let i = 0; i < n; i++) {
    const idx = [0, 1, 2, 3].sort((a, b) => Math.abs(byColumn ? M[b][i] : M[i][b]) - Math.abs(byColumn ? M[a][i] : M[i][a]));
    for (const k of idx.slice(2)) { if (byColumn) out[k][i] = 0; else out[i][k] = 0; }
  }
  return out;
}

// 乘加：FP16/BF16/TF32 每步舍入回本格式；FP8 与 FP4 乘积进入 FP32 累加器；FP64 直接算
const accRound = (x, fmtId) => {
  if (fmtId === 'FP64') return x;
  if (fmtId === 'TF32') return toF32(x);
  if (fmtId === 'FP16' || fmtId === 'BF16') return quantize(x, fmtId);
  return toF32(x);
};

export function matMul(A, B, fmtId, sparse = false) {
  const n = A.length;
  const inA = sparse ? sparsify(A, false) : A;
  const inB = sparse ? sparsify(B, true) : B;
  const qa = quantMatrix(inA, fmtId), qb = quantMatrix(inB, fmtId);
  const C = [], X = [], Err = [], terms = [];
  let macs = 0, skipped = 0;
  for (let i = 0; i < n; i++) {
    C[i] = []; X[i] = []; Err[i] = []; terms[i] = [];
    for (let j = 0; j < n; j++) {
      let acc = 0, exact = 0;
      const row = [];
      for (let k = 0; k < n; k++) {
        const a = qa.Q[i][k], b = qb.Q[k][j];
        const zero = a === 0 || b === 0;
        const p = zero ? 0 : accRound(a * b, fmtId);
        const before = acc;
        if (!zero) { acc = accRound(acc + p, fmtId); macs++; } else skipped++;
        exact += A[i][k] * B[k][j];
        row.push({ i, j, k, a, b, p, zero, before, after: acc });
      }
      C[i][j] = acc; X[i][j] = exact; Err[i][j] = acc - exact;
      terms[i][j] = row;
    }
  }
  const rmse = Math.sqrt(Err.flat().reduce((s, e) => s + (isFinite(e) ? e * e : 0), 0) / (n * n));
  return { A: inA, B: inB, qa, qb, C, X, Err, terms, macs, skipped, rmse, total: n * n * n };
}

// 8 份分片：按 (k, j 是否在后半) 把 64 项乘加分成 8 份，每份 8 项
export function shardTask(mm, n = 4) {
  const shards = [];
  for (let s = 0; s < 8; s++) {
    const k = s >> 1, half = s & 1;
    const P = [];
    let macs = 0;
    for (let i = 0; i < n; i++) {
      P[i] = [];
      for (let j = 0; j < n; j++) {
        if ((j >= 2 ? 1 : 0) === half) {
          const t = mm.terms[i][j][k];
          P[i][j] = t.p;
          if (!t.zero) macs++;
        } else P[i][j] = 0;
      }
    }
    const sum = P.flat().reduce((a, b) => a + b, 0);
    shards.push({ id: s, k, half, P, macs, sum });
  }
  // 真实归约：把八份局部结果逐元素求和
  const R = [];
  for (let i = 0; i < n; i++) {
    R[i] = [];
    for (let j = 0; j < n; j++) R[i][j] = shards.reduce((a, s) => a + s.P[i][j], 0);
  }
  const check = R.flat().reduce((a, b) => a + b, 0);
  return { shards, R, check };
}

// 容量估算：参数量（十亿）→ 字节 → 所需 GPU 与平台
export function workload(paramsB, fmtId, capGB = 180) {
  const F = FORMATS[fmtId];
  const gb = paramsB * F.effective / 8;
  const gpus = Math.max(1, Math.ceil(gb / capGB - 1e-9));
  return {
    gb, gpus, perGpu: gb / gpus,
    fitsSingle: gb <= capGB,
    hgx: Math.ceil(gpus / 8),
    nvl: Math.ceil(gpus / 72),
    shardGB: gb / 8,
    values: paramsB * 1e9,
    tiles: paramsB * 1e9 / 32,
  };
}
