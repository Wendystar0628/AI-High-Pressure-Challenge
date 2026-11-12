/* interp.js — 关键帧插值、缓动、空间路径 */
(function(global) {
'use strict';

const Interp = {};

// 缓动影响默认
const DEFAULT_EASE = { infl: 33, sp: 0 };

function easePair(kf, side) {
  if (side === 'in') return kf.easeIn || DEFAULT_EASE;
  return kf.easeOut || DEFAULT_EASE;
}

// 时间维度：在 t∈[0,1] 的贝塞尔段上映射
// AE: 进入用 easeIn 的速度/影响, 离开用 easeOut
function timeMap(kfA, kfB, u) {
  // 控制点 (u,v) 空间: 入点 easeIn 影响左, 出点 easeOut 影响右
  const inE = kfB ? easePair(kfB, 'in') : DEFAULT_EASE;
  const outE = kfA ? easePair(kfA, 'out') : DEFAULT_EASE;
  // 归一化速度 → 控制点横向跨度；影响 → 权重
  const outSp = U.clamp(outE.sp || 0, -200, 200) / 200; // 可为负
  const inSp = U.clamp(inE.sp || 0, -200, 200) / 200;
  const outInfl = U.clamp(outE.infl || 33, 1, 100) / 100;
  const inInfl = U.clamp(inE.infl || 33, 1, 100) / 100;
  // 时间轴控制点: x 影响出/入拉伸
  const x1 = outInfl * 0.5 + outSp * 0.25;
  const x2 = 1 - (inInfl * 0.5 - inSp * 0.25);
  // 值轴控制点 y 由速度决定 (相对线性斜率)
  const slope = 1;
  const y1 = outSp * slope * 0.5 + (1 - outInfl) * 0 + 0; // 简化
  const y2 = 1 - inSp * slope * 0.5;
  // 使用值轴 y = x*斜率近似 + 速度偏移 → 求 x(t)=u 的 t
  // 控制点 P0(0,0) P1(x1, y1') P2(x2, y2') P3(1,1)
  const cy1 = U.clamp(y1, -0.5, 1.5), cy2 = U.clamp(y2, -0.5, 1.5);
  const t = U.bezierSolveT(0, x1, x2, 1, u);
  return U.bezier1D(0, cy1, cy2, 1, t);
}

// 标量/数组值插值
function lerpValue(a, b, t) {
  if (typeof a === 'number') return U.lerp(a, b, t);
  if (Array.isArray(a)) return a.map((v, i) => U.lerp(v, b[i] != null ? b[i] : v, t));
  if (a && typeof a === 'object') {
    const r = {};
    for (const k in a) r[k] = typeof a[k] === 'number' ? U.lerp(a[k], (b[k] != null ? b[k] : a[k]), t) : a[k];
    return r;
  }
  return t < 0.5 ? a : b;
}
Interp.lerpValue = lerpValue;

function addValue(a, b) {
  if (typeof a === 'number') return a + b;
  if (Array.isArray(a)) return a.map((v, i) => v + (b[i] != null ? b[i] : b[0] || 0));
  return a;
}
function scaleValue(a, s) {
  if (typeof a === 'number') return a * s;
  if (Array.isArray(a)) return a.map(v => v * s);
  return a;
}
function valueToVec(v) {
  if (typeof v === 'number') return [v];
  if (Array.isArray(v)) return v.slice();
  return [0];
}

// 空间插值（位置）：路径在空间中为贝塞尔，u∈[0,1] 沿时间映射后的值
function spatialAt(kfA, kfB, t01) {
  const p0 = valueToVec(kfA.v);
  const p3 = valueToVec(kfB.v);
  const n = p0.length;
  const outS = kfA.spOut || [0, 0, 0];
  const inS = kfB.spIn || [0, 0, 0];
  const p1 = p0.map((v, i) => v + (outS[i] != null ? outS[i] : 0));
  const p2 = p3.map((v, i) => v - (inS[i] != null ? inS[i] : 0));
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(U.bezier1D(p0[i], p1[i], p2[i], p3[i], t01));
  }
  return out;
}

// 求关键帧区间
function findKfSpan(kfs, t) {
  if (!kfs || !kfs.length) return null;
  if (t <= kfs[0].t) return { i0: 0, i1: 0, u: 0, before: true };
  const last = kfs.length - 1;
  if (t >= kfs[last].t) return { i0: last, i1: last, u: 0, after: true };
  for (let i = 0; i < last; i++) {
    if (t >= kfs[i].t && t <= kfs[i + 1].t) {
      const dt = kfs[i + 1].t - kfs[i].t;
      return { i0: i, i1: i + 1, u: dt < 1e-9 ? 0 : (t - kfs[i].t) / dt, before: false, after: false };
    }
  }
  return { i0: last, i1: last, u: 0, after: true };
}

// 主插值入口：只用关键帧（不含表达式）
Interp.evaluateKfs = function(anim, t) {
  const kfs = anim.kfs || [];
  if (!kfs.length) return U.deepClone(anim.def);
  const span = findKfSpan(kfs, t);
  if (span.before) return U.deepClone(kfs[0].v);
  if (span.after) return U.deepClone(kfs[kfs.length - 1].v);
  const kfA = kfs[span.i0], kfB = kfs[span.i1];
  if (kfA === kfB) return U.deepClone(kfA.v);
  // 定格
  if (kfA.hold || (kfA.spType === 'hold')) return U.deepClone(kfA.v);
  const u = span.u;
  const u2 = timeMap(kfA, kfB, u);
  // 空间插值用于位置类（有 spIn/spOut 且 dims>=2）
  const useSpatial = (anim.dims >= 2) && (kfA.spatial || kfB.spatial) && (kfA.spOut || kfB.spIn);
  if (useSpatial && Array.isArray(kfA.v)) {
    return spatialAt(kfA, kfB, U.clamp(u2, 0, 1));
  }
  return lerpValue(kfA.v, kfB.v, U.clamp(u2, 0, 1));
};

// 值曲线采样（供曲线视图）
Interp.sampleCurve = function(anim, t0, t1, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = U.lerp(t0, t1, i / n);
    pts.push({ t, v: Interp.evaluateKfs(anim, t) });
  }
  return pts;
};

// 速度曲线（数值差分；位置为标量速度）
Interp.sampleSpeed = function(anim, t0, t1, n = 120, fps = 60) {
  const pts = [];
  const dt = 1 / fps;
  for (let i = 0; i <= n; i++) {
    const t = U.lerp(t0, t1, i / n);
    const v0 = Interp.evaluateKfs(anim, Math.max(0, t - dt / 2));
    const v1 = Interp.evaluateKfs(anim, t + dt / 2);
    let sp = 0;
    if (typeof v0 === 'number') sp = Math.abs(v1 - v0) / dt;
    else if (Array.isArray(v0)) {
      let s = 0;
      for (let d = 0; d < v0.length; d++) {
        const dd = v1[d] - v0[d];
        s += dd * dd;
      }
      sp = Math.sqrt(s) / dt;
    }
    pts.push({ t, v: sp });
  }
  return pts;
};

// 关键帧操作
Interp.setKeyframe = function(anim, t, v) {
  anim.animated = true;
  // 查找已有（容差 = 半帧）
  const eps = 1e-4;
  let kf = anim.kfs.find(k => Math.abs(k.t - t) < eps);
  if (kf) {
    kf.v = U.deepClone(v);
  } else {
    kf = {
      t, v: U.deepClone(v),
      easeIn: { infl: 33, sp: 0 }, easeOut: { infl: 33, sp: 0 },
      hold: false, spIn: [0, 0, 0], spOut: [0, 0, 0], spatial: false
    };
    anim.kfs.push(kf);
    anim.kfs.sort((a, b) => a.t - b.t);
  }
  return kf;
};

Interp.removeKeyframe = function(anim, t) {
  const eps = 1e-4;
  const i = anim.kfs.findIndex(k => Math.abs(k.t - t) < eps);
  if (i >= 0) anim.kfs.splice(i, 1);
  return i >= 0;
};

Interp.toggleKeyframe = function(anim, t) {
  const eps = 1e-4;
  const i = anim.kfs.findIndex(k => Math.abs(k.t - t) < eps);
  if (i >= 0) { anim.kfs.splice(i, 1); return false; }
  // 当前值设为关键帧
  const v = Interp.evaluateKfs(anim, t);
  Interp.setKeyframe(anim, t, v);
  return true;
};

// F9 缓入缓出
Interp.easeEasy = function(anim, t = null) {
  anim.kfs.forEach(kf => {
    if (t != null && Math.abs(kf.t - t) > 1e-4) return;
    kf.easeIn = { infl: 66, sp: 0 };
    kf.easeOut = { infl: 66, sp: 0 };
    kf.hold = false;
  });
};

// 移动/拉伸关键帧时间
Interp.moveKeyframes = function(anim, times, dt) {
  times.forEach(t => {
    const kf = anim.kfs.find(k => Math.abs(k.t - t) < 1e-4);
    if (kf) kf.t = Math.max(0, kf.t + dt);
  });
  anim.kfs.sort((a, b) => a.t - b.t);
};

Interp.scaleKeyframesTime = function(anim, pivotT, factor) {
  anim.kfs.forEach(kf => {
    kf.t = pivotT + (kf.t - pivotT) * factor;
    if (kf.t < 0) kf.t = 0;
  });
  anim.kfs.sort((a, b) => a.t - b.t);
};

// 复制关键帧块
Interp.copyKeyframes = function(anim, fromT, toT) {
  return anim.kfs.filter(k => k.t >= fromT - 1e-6 && k.t <= toT + 1e-6).map(U.deepClone);
};
Interp.pasteKeyframes = function(anim, kfs, offsetT) {
  kfs.forEach(k => {
    const c = U.deepClone(k);
    c.t += offsetT;
    Interp.setKeyframe(anim, c.t, c.v);
    const kf = anim.kfs.find(x => Math.abs(x.t - c.t) < 1e-4);
    if (kf) {
      kf.easeIn = c.easeIn; kf.easeOut = c.easeOut;
      kf.hold = c.hold; kf.spIn = c.spIn; kf.spOut = c.spOut;
    }
  });
};

// 运动路径采样（世界坐标，供画布）
Interp.sampleMotionPath = function(anim, t0, t1, n = 48) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = U.lerp(t0, t1, i / n);
    pts.push({ t, v: Interp.evaluateKfs(anim, t) });
  }
  return pts;
};

// 空间手柄世界偏移
Interp.getSpatialHandles = function(anim, kf) {
  return {
    in: kf.spIn ? kf.spIn.slice() : [0, 0, 0],
    out: kf.spOut ? kf.spOut.slice() : [0, 0, 0]
  };
};

Interp.setTimeEase = function(kf, side, infl, sp) {
  const e = { infl: U.clamp(infl, 1, 100), sp: U.clamp(sp, -200, 200) };
  if (side === 'in') kf.easeIn = e;
  else kf.easeOut = e;
};

global.Interp = Interp;
})(window);
