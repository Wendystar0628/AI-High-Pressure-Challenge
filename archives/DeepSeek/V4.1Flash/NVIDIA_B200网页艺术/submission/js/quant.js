/* B200 / DIE STUDY — precision math
   Implements actual quantisation (RNE) for FP16, BF16, TF32, FP8-E4M3 and
   FP4-E2M1 with one shared E4M3 scale per 16-value block. */
(function () {
  'use strict';
  const B = window.B200;
  const F = B.FORMATS;

  function decode(bits, eb, mb) {
    const sign = (bits >>> (eb + mb)) & 1;
    const e = (bits >>> mb) & ((1 << eb) - 1);
    const m = bits & ((1 << mb) - 1);
    const bias = (1 << (eb - 1)) - 1;
    let v;
    if (e === 0) v = (m / Math.pow(2, mb)) * Math.pow(2, 1 - bias);
    else v = (1 + m / Math.pow(2, mb)) * Math.pow(2, e - bias);
    return sign ? -v : v;
  }

  // Positive finite representables with their stored bit patterns.
  function buildTable(eb, mb, nanWhenExpAllOnesAndMantMax) {
    const out = [];
    const n = 1 << (eb + mb);
    for (let bits = 0; bits < n; bits++) {
      const e = (bits >>> mb) & ((1 << eb) - 1);
      const m = bits & ((1 << mb) - 1);
      if (nanWhenExpAllOnesAndMantMax && e === (1 << eb) - 1 && m === (1 << mb) - 1) continue;
      if (e === (1 << eb) - 1 && !nanWhenExpAllOnesAndMantMax) continue; // inf/nan
      const v = decode(bits, eb, mb);
      if (!isFinite(v) || v === 0) continue;
      out.push({ v: v, bits: bits });
    }
    out.sort((a, b) => a.v - b.v);
    return out;
  }

  // E2M1 has no reserved exponent: 0, .5, 1, 1.5, 2, 3, 4, 6.
  const FP4_TABLE = [
    { v: 0.5, bits: 1 }, { v: 1, bits: 2 }, { v: 1.5, bits: 3 },
    { v: 2, bits: 4 }, { v: 3, bits: 5 }, { v: 4, bits: 6 }, { v: 6, bits: 7 }
  ];

  const TABLES = {
    fp16: buildTable(5, 10, false),
    bf16: buildTable(8, 7, false),
    fp8: buildTable(4, 3, true),
    fp4: FP4_TABLE
  };

  function nearest(table, mag) {
    const arr = table;
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].v < mag) lo = mid + 1; else hi = mid;
    }
    let a = arr[lo], b = arr[lo - 1];
    if (!a) return b || arr[0];
    if (!b) return a;
    const da = Math.abs(a.v - mag), db = Math.abs(b.v - mag);
    if (da < db) return a;
    if (db < da) return b;
    // round to nearest even stored mantissa LSB
    return (a.bits & 1) === 0 ? a : b;
  }

  B.quant = {
    tables: TABLES,
    decode: decode,

    /** Quantise one value. scale is used by FP4. */
    value: function (value, key, scale) {
      key = key || 'fp4';
      const fmt = F[key] || F.fp4;
      let v = Number(value);
      if (!isFinite(v)) v = 0;

      if (key === 'fp64') return { value: v, bits: null, scale: 1 };
      if (key === 'tf32') {
        const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
        f32[0] = v;
        let bits = u32[0];
        const rem = bits & 0x1FFF;
        bits &= 0xFFFFE000;
        if (rem > 0x1000 || (rem === 0x1000 && (bits & 0x2000))) bits += 0x2000;
        u32[0] = bits;
        return { value: f32[0], bits: bits, scale: 1 };
      }
      if (key === 'bf16') {
        const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
        f32[0] = v;
        let bits = u32[0];
        const rem = bits & 0xFFFF;
        bits &= 0xFFFF0000;
        if (rem > 0x8000 || (rem === 0x8000 && (bits & 0x10000))) bits += 0x10000;
        u32[0] = bits;
        const q = f32[0];
        return { value: q, bits: (bits >>> 16) & 0xFFFF, scale: 1 };
      }
      if (key === 'fp16') {
        const sign = v < 0 ? 1 : 0;
        const a = nearest(TABLES.fp16, Math.abs(v));
        return { value: sign ? -a.v : a.v, bits: (sign << 15) | a.bits, scale: 1 };
      }
      if (key === 'fp8') {
        const sign = v < 0 ? 1 : 0;
        const a = nearest(TABLES.fp8, Math.abs(v));
        return { value: sign ? -a.v : a.v, bits: (sign << 7) | a.bits, scale: 1 };
      }
      // fp4 with shared scaling
      const s = scale && isFinite(scale) && scale > 0 ? scale : 1;
      const sign = v < 0 ? 1 : 0;
      const a = nearest(TABLES.fp4, Math.abs(v) / s);
      return { value: (sign ? -a.v : a.v) * s, bits: (sign << 3) | a.bits, scale: s };
    },

    /** The E4M3 value nearest to a positive scale. */
    e4m3: function (v) {
      const a = nearest(TABLES.fp8, Math.max(v, 0));
      return a.v;
    },

    sharedScale: function (matrix) {
      let m = 0;
      for (let r = 0; r < matrix.length; r++)
        for (let c = 0; c < matrix[r].length; c++) m = Math.max(m, Math.abs(matrix[r][c]));
      if (!isFinite(m) || m <= 0) return 1;
      const raw = m / 6;
      // A scale must remain representable and non-zero.
      return Math.max(0.015625, B200_e4(raw));
    },

    bitsOf: function (value, key, scale) {
      const q = B.quant.value(value, key, scale);
      return q;
    },

    formatFields: function (key, value, scale) {
      const fmt = F[key] || F.fp4;
      const q = B.quant.value(value, key, scale);
      let rawBits = q.bits;
      if (rawBits == null) {
        if (key === 'fp64') {
          const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
          f64[0] = q.value;
          rawBits = [];
          for (let i = 1; i >= 0; i--) rawBits.push(u32[i]);
          rawBits = rawBits.map(n => n.toString(2).padStart(32, '0'));
          const all = rawBits.join('');
          return {
            value: q.value, scale: 1, hex: hi64(q.value),
            fields: [
              { key: 'sign', label: '符号', bits: all.slice(0, 1) },
              { key: 'exp', label: '指数', bits: all.slice(1, 12) },
              { key: 'mant', label: '尾数', bits: all.slice(12, 64) }
            ]
          };
        }
      }
      rawBits = rawBits >>> 0;
      const total = fmt.bits;
      let bitsStr;
      if (key === 'tf32') bitsStr = rawBits.toString(2).padStart(32, '0');
      else if (key === 'bf16' || key === 'fp16') bitsStr = rawBits.toString(2).padStart(16, '0');
      else if (key === 'fp8') bitsStr = rawBits.toString(2).padStart(8, '0');
      else if (key === 'fp4') bitsStr = rawBits.toString(2).padStart(4, '0');
      else bitsStr = rawBits.toString(2);
      const fields = [];
      let pos = 0;
      fields.push({ key: 'sign', label: 'S', bits: bitsStr.slice(pos, pos + 1) }); pos += 1;
      fields.push({ key: 'exp', label: 'E', bits: bitsStr.slice(pos, pos + fmt.exp) }); pos += fmt.exp;
      fields.push({ key: 'mant', label: 'M', bits: bitsStr.slice(pos, pos + fmt.mant) }); pos += fmt.mant;
      if (key === 'tf32') fields.push({ key: 'pad', label: '填充', bits: bitsStr.slice(pos) });
      return {
        value: q.value, scale: q.scale || 1,
        hex: (rawBits >>> 0).toString(16).toUpperCase().padStart(total / 4, '0'),
        fields: fields
      };
    },

    /** Quantise a 4x4 matrix, returning values, bits, scale and sparse mask. */
    matrix: function (matrix, key, sparse) {
      let scale = key === 'fp4' ? B.quant.sharedScale(matrix) : 1;
      const vals = matrix.map(row => row.map(v => B.quant.value(v, key, scale).value));
      let mask = matrix.map(row => row.map(() => 1));
      if (sparse) {
        // Structured 2:4 sparsity per row: keep the two largest magnitudes.
        mask = matrix.map((row, ri) => {
          const idx = row.map((v, ci) => ({ ci: ci, a: Math.abs(vals[ri][ci]) }))
            .sort((a, b) => b.a - a.a);
          const keep = new Set(idx.slice(0, 2).map(o => o.ci));
          return row.map((_, ci) => keep.has(ci) ? 1 : 0);
        });
        for (let r = 0; r < vals.length; r++)
          for (let c = 0; c < vals[r].length; c++)
            if (!mask[r][c]) vals[r][c] = 0;
      }
      return { values: vals, scale: scale, mask: mask };
    },

    multiply: function (A, Bm) {
      const n = A.length, m = Bm[0].length, k = Bm.length;
      const C = [];
      for (let i = 0; i < n; i++) {
        C.push([]);
        for (let j = 0; j < m; j++) {
          let s = 0;
          for (let t = 0; t < k; t++) s += A[i][t] * Bm[t][j];
          C[i].push(s);
        }
      }
      return C;
    },

    mae: function (A, Bm) {
      let s = 0, n = 0, max = 0;
      for (let i = 0; i < A.length; i++)
        for (let j = 0; j < A[i].length; j++) {
          const d = Math.abs(A[i][j] - Bm[i][j]);
          s += d; n++; max = Math.max(max, d);
        }
      return { mean: n ? s / n : 0, max: max };
    },

    representables: function (key, scale, range) {
      range = range || 2;
      if (key === 'fp4') {
        const s = scale || 1;
        return TABLES.fp4.map(o => o.v * s).filter(v => v <= range).concat([0]).sort((a, b) => a - b);
      }
      if (key === 'fp8') return TABLES.fp8.map(o => o.v).filter(v => v <= range);
      if (key === 'fp16') return TABLES.fp16.map(o => o.v).filter(v => v <= range);
      if (key === 'bf16') return TABLES.bf16.map(o => o.v).filter(v => v <= range);
      // sample the very dense formats for a number-line texture
      const arr = [];
      for (let i = 0; i <= 420; i++) {
        const v = (i / 420) * range;
        const q = B.quant.value(v, key).value;
        if (q >= 0 && q <= range) arr.push(q);
      }
      return Array.from(new Set(arr.map(v => +v.toFixed(6)))).sort((a, b) => a - b);
    },

    formatBytes: function (key, count) {
      return (F[key] ? F[key].bytes : 2) * count;
    },

    fmtBytesLabel: function (key) {
      const b = F[key] ? F[key].bytes : 2;
      return b < 1 ? '0.5 B' : b + ' B';
    }
  };

  function B200_e4(raw) {
    // keep the quantised scale from collapsing to zero
    const q = nearest(TABLES.fp8, Math.max(raw, 0.015625)).v;
    return q;
  }

  function hi64(v) {
    const f = new Float64Array(1), u = new Uint32Array(f.buffer);
    f[0] = v;
    return (u[1].toString(16).padStart(8, '0') + u[0].toString(16).padStart(8, '0')).toUpperCase();
  }

  B.halfUp = function (v) { return B.quant.value(v, 'fp16').value; };
  B.fmt = function (key) { return F[key] || F.fp4; };
})();
