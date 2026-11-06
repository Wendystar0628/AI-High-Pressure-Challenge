// 场景一物理：果冻用四面体有限元（Stable Neo-Hookean + Kelvin-Voigt 粘弹性）显式积分，
// 重球为 6 自由度刚体，接触以节点冲量形式双向传递；平台可带弹簧悬挂自由度。
'use strict';

const JELLY_DEFAULTS = {
  // 重球
  ballMass: 22, ballRadius: 0.15, dropHeight: 1.25, ballCount: 4, interval: 0.55, offset: 0.58,
  // 果冻
  width: 1.15, depth: 1.15, height: 0.62, shape: 'block', stiffness: 18, damping: 0.34, density: 1050, fixMode: 'free',
  // 碰撞与环境
  gravity: 9.81, friction: 0.6, platformElastic: 0.18, multiHit: true,
  mode: 'center',
};

const PLATFORM = { top: 0.2, radius: 1.85, lipH: 0.045, lipW: 0.06 };
const MAX_BALLS = 8;

class JellySim {
  constructor() {
    this.p = Object.assign({}, JELLY_DEFAULTS);
    this.key = '';
    this.settledCache = new Map();
    this.balls = [];
    this.t = 0;
    this.triggerT = -1;
    this.phase = 'ready';
    this.history = [];
    this.lastSample = -1;
    this.onSound = null;   // 音效钩子：只读，不影响仿真
  }

  // 结构键：这些参数改变时必须重新生成网格并静置
  structKey() {
    const p = this.p;
    return [p.width, p.depth, p.height, p.shape, p.stiffness, p.density, p.fixMode, p.gravity, p.platformElastic].join('|');
  }

  build() {
    const p = this.p;
    const target = 0.052;
    const NX = this.NX = Math.max(8, Math.round(p.width / target));
    const NY = this.NY = Math.max(5, Math.round(p.height / target));
    const NZ = this.NZ = Math.max(8, Math.round(p.depth / target));
    const nn = this.nn = (NX + 1) * (NY + 1) * (NZ + 1);
    const X = this.X = new Float64Array(nn * 3);
    this.x = new Float64Array(nn * 3);
    this.v = new Float64Array(nn * 3);
    this.f = new Float64Array(nn * 3);
    this.m = new Float64Array(nn);
    this.pinned = new Uint8Array(nn);
    this.bottomAll = null;
    const nid = this.nid = (i, j, k) => i + (NX + 1) * (j + (NY + 1) * k);
    const base = PLATFORM.top;
    for (let k = 0; k <= NZ; k++) for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const q = this.restMap(2 * i / NX - 1, j / NY, 2 * k / NZ - 1);
      const id = nid(i, j, k) * 3;
      X[id] = q[0]; X[id + 1] = q[1] + base; X[id + 2] = q[2];
    }
    // 五四面体剖分（奇偶交替，避免方向偏置）
    const tets = [];
    const even = [[1, 3, 4, 6], [0, 1, 3, 4], [2, 1, 3, 6], [5, 1, 4, 6], [7, 3, 4, 6]];
    const odd = [[0, 2, 5, 7], [1, 0, 2, 5], [3, 0, 2, 7], [4, 0, 5, 7], [6, 2, 5, 7]];
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const c = [nid(i, j, k), nid(i + 1, j, k), nid(i + 1, j + 1, k), nid(i, j + 1, k),
        nid(i, j, k + 1), nid(i + 1, j, k + 1), nid(i + 1, j + 1, k + 1), nid(i, j + 1, k + 1)];
      const set = ((i + j + k) & 1) ? odd : even;
      for (const t of set) tets.push(c[t[0]], c[t[1]], c[t[2]], c[t[3]]);
    }
    const nt = this.nt = tets.length / 4;
    const T = this.T = new Int32Array(nt * 4);
    const DI = this.DI = new Float64Array(nt * 9);
    const VOL = this.VOL = new Float64Array(nt);
    let minAlt = 1e9;
    for (let t = 0; t < nt; t++) {
      let a = tets[t * 4], b = tets[t * 4 + 1], c = tets[t * 4 + 2], d = tets[t * 4 + 3];
      let e1 = [X[b * 3] - X[a * 3], X[b * 3 + 1] - X[a * 3 + 1], X[b * 3 + 2] - X[a * 3 + 2]];
      let e2 = [X[c * 3] - X[a * 3], X[c * 3 + 1] - X[a * 3 + 1], X[c * 3 + 2] - X[a * 3 + 2]];
      const e3 = [X[d * 3] - X[a * 3], X[d * 3 + 1] - X[a * 3 + 1], X[d * 3 + 2] - X[a * 3 + 2]];
      let det = e1[0] * (e2[1] * e3[2] - e2[2] * e3[1]) - e2[0] * (e1[1] * e3[2] - e1[2] * e3[1]) + e3[0] * (e1[1] * e2[2] - e1[2] * e2[1]);
      if (det < 0) { const s = b; b = c; c = s; const se = e1; e1 = e2; e2 = se; det = -det; }
      T[t * 4] = a * 3; T[t * 4 + 1] = b * 3; T[t * 4 + 2] = c * 3; T[t * 4 + 3] = d * 3;
      // Dm = [e1 e2 e3]（列向量）；求逆
      const id = 1 / det;
      const m00 = (e2[1] * e3[2] - e3[1] * e2[2]) * id, m01 = (e3[0] * e2[2] - e2[0] * e3[2]) * id, m02 = (e2[0] * e3[1] - e3[0] * e2[1]) * id;
      const m10 = (e3[1] * e1[2] - e1[1] * e3[2]) * id, m11 = (e1[0] * e3[2] - e3[0] * e1[2]) * id, m12 = (e3[0] * e1[1] - e1[0] * e3[1]) * id;
      const m20 = (e1[1] * e2[2] - e2[1] * e1[2]) * id, m21 = (e2[0] * e1[2] - e1[0] * e2[2]) * id, m22 = (e1[0] * e2[1] - e2[0] * e1[1]) * id;
      const o = t * 9;
      DI[o] = m00; DI[o + 1] = m01; DI[o + 2] = m02; DI[o + 3] = m10; DI[o + 4] = m11; DI[o + 5] = m12; DI[o + 6] = m20; DI[o + 7] = m21; DI[o + 8] = m22;
      VOL[t] = det / 6;
      // 最小高 = 1 / 最大梯度模
      const g = [Math.hypot(m00, m01, m02), Math.hypot(m10, m11, m12), Math.hypot(m20, m21, m22)];
      const g0 = Math.hypot(m00 + m10 + m20, m01 + m11 + m21, m02 + m12 + m22);
      minAlt = Math.min(minAlt, 1 / Math.max(g[0], g[1], g[2], g0));
      const nodeM = p.density * VOL[t] / 4;
      this.m[a] += nodeM; this.m[b] += nodeM; this.m[c] += nodeM; this.m[d] += nodeM;
    }
    // 圆台映射在格子四角产生很扁的单元（在可见外壳之外）：按高度削弱其刚度，避免它们拖慢整体时间步
    const alts = new Float64Array(nt);
    for (let t = 0; t < nt; t++) {
      const o = t * 9;
      const a0 = Math.hypot(DI[o], DI[o + 1], DI[o + 2]), a1 = Math.hypot(DI[o + 3], DI[o + 4], DI[o + 5]), a2 = Math.hypot(DI[o + 6], DI[o + 7], DI[o + 8]);
      const a3 = Math.hypot(DI[o] + DI[o + 3] + DI[o + 6], DI[o + 1] + DI[o + 4] + DI[o + 7], DI[o + 2] + DI[o + 5] + DI[o + 8]);
      alts[t] = 1 / Math.max(a0, a1, a2, a3);
    }
    const sorted = Float64Array.from(alts).sort();
    const altRef = sorted[Math.floor(nt * 0.5)] * 0.72;
    for (let t = 0; t < nt; t++) {
      if (alts[t] < altRef) { const r = alts[t] / altRef; VOL[t] *= r * r; }
    }
    this.minAlt = Math.max(minAlt, altRef);
    this.totalMass = 0;
    for (let i = 0; i < nn; i++) this.totalMass += this.m[i];
    this.bottom = [];
    for (let k = 0; k <= NZ; k++) for (let i = 0; i <= NX; i++) this.bottom.push(nid(i, 0, k));
    // 底部固定方式
    if (p.fixMode === 'glue') {
      for (const n of this.bottom) this.pinned[n] = 1;
    } else if (p.fixMode === 'rim') {
      for (let k = 0; k <= NZ; k++) for (let i = 0; i <= NX; i++) {
        if (i === 0 || k === 0 || i === NX || k === NZ) this.pinned[nid(i, 0, k)] = 1;
      }
    } else if (p.fixMode === 'center') {
      const rx = Math.max(1, Math.round(NX * 0.16)), rz = Math.max(1, Math.round(NZ * 0.16));
      for (let k = -rz; k <= rz; k++) for (let i = -rx; i <= rx; i++) {
        this.pinned[nid((NX >> 1) + i, 0, (NZ >> 1) + k)] = 1;
      }
    }
    this.updateMaterial();
    // 平台悬挂：弹性为 0 时为刚性平台
    const el = p.platformElastic;
    this.platMass = 70;
    const fn = 7.5 - 4.5 * el;             // 固有频率随弹性降低
    const wn = 2 * Math.PI * fn;
    this.platK = el > 0.001 ? wn * wn * (this.platMass + this.totalMass) : 0;
    this.platC = el > 0.001 ? 2 * (0.5 - 0.42 * el) * wn * (this.platMass + this.totalMass) : 0;
    this.platY = 0; this.platV = 0;
    this.ballRest = 0.12 + 0.72 * el;      // 球-平台恢复系数

    const key = this.structKey();
    let snap = this.settledCache.get(key);
    if (snap) {
      this.settledX = snap;
    } else {
      this.settle();
      this.settledX = new Float64Array(this.x);
      if (this.settledCache.size > 12) this.settledCache.clear();
      this.settledCache.set(key, this.settledX);
    }
    this.key = key;
    this.topC = nid(NX >> 1, NY, NZ >> 1);
    this.restTopY = this.settledX[this.topC * 3 + 1];
    this.restRight = this.settledX[nid(NX, NY >> 1, NZ >> 1) * 3];
  }

  // 由规范坐标（s,t ∈ [-1,1]，r ∈ [0,1]）映射到静止形状
  restMap(s, r, t) {
    const p = this.p;
    const hw = p.width / 2, hd = p.depth / 2;
    if (p.shape === 'frustum') {
      // 方→圆的椭圆网格映射（略作混合以避免四角单元退化），上窄下宽
      const k = 0.9;
      const u = s * Math.sqrt(Math.max(0, 1 - t * t / 2)), v = t * Math.sqrt(Math.max(0, 1 - s * s / 2));
      const qx = lerp(s * 0.72, u, k), qz = lerp(t * 0.72, v, k);
      const scale = lerp(1.0, 0.74, r);
      return [qx * hw * scale, r * p.height, qz * hd * scale];
    }
    // 块状：轻微上收，让侧面也能接收高光
    const scale = lerp(1.0, 0.94, r);
    return [s * hw * scale, r * p.height, t * hd * scale];
  }

  updateMaterial() {
    const p = this.p;
    const E = p.stiffness * 1000, nu = 0.44;
    const mu0 = E / (2 * (1 + nu)), la0 = E * nu / ((1 + nu) * (1 - 2 * nu));
    // Stable Neo-Hookean 的 Lamé 重映射
    this.mu = 4 / 3 * mu0;
    this.la = la0 + 5 / 6 * mu0;
    this.alpha = 1 + 3 / 4 * this.mu / this.la;
    this.eta = 4 + 90 * p.damping * p.damping;  // Kelvin-Voigt 粘性（Pa·s）
    this.airDrag = 0.12 + 1.5 * p.damping;      // 低频（整体）模态阻尼（1/s）
    const c = Math.sqrt((this.la + 2 * this.mu) / p.density);
    const a = this.minAlt;
    const dtElastic = 0.42 * a / c;
    const dtVisc = 0.18 * a * a * p.density / this.eta;
    this.dt0 = Math.min(1 / 520, dtElastic, dtVisc);
    this.dtCur = this.dt0;
  }

  // 重力下静置：动态松弛得到初始平衡形状，使“准备”阶段真正静止
  settle() {
    const nn = this.nn;
    this.x.set(this.X); this.v.fill(0);
    const steps = Math.ceil(0.9 / this.dt0);
    const wn = 2 * Math.PI * 2.5;
    const decay = Math.exp(-1.4 * wn * this.dt0);
    const savedBalls = this.balls; this.balls = [];
    this.platY = 0; this.platV = 0;
    const k = this.platK; this.platK = 0;
    for (let s = 0; s < steps; s++) {
      this.substep(this.dt0, true);
      const v = this.v;
      for (let i = 0; i < nn * 3; i++) v[i] *= decay;
    }
    this.platK = k; this.platY = 0; this.platV = 0;
    this.balls = savedBalls;
    this.v.fill(0);
  }

  resetState() {
    const p = this.p;
    if (this.structKey() !== this.key) this.build(); else this.updateMaterial();
    this.x.set(this.settledX);
    this.v.fill(0);
    this.platY = 0; this.platV = 0;
    this.t = 0;
    this.triggerT = -1;
    this.phase = 'ready';
    this.firstContactT = -1;
    this.maxDent = 0;
    this.calmT = 0;
    this.history.length = 0;
    this.lastSample = -1;
    this.setupBalls();
    this.kinE = 0;
    this.contactN = 0;
    this.minJ = 1;
  }

  // 按模式布置重球：单球正中 / 偏心 / 多球序列
  setupBalls() {
    const p = this.p;
    const top = this.restTopY;
    const r = p.ballRadius;
    const y = top + p.dropHeight + r;
    const mk = (x, z, delay, mat, mass) => {
      const I = 0.4 * mass * r * r;
      return {
        x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0,
        q: [0, 0, 0, 1], r, mass, invM: 1 / mass, invI: 1 / I,
        delay, held: true, mat, hx: x, hy: y, hz: z, touched: false, separated: false,
        caught: false, catchT: 0, contact: 0, peak: 0,
      };
    };
    this.balls = [];
    if (p.mode === 'center') {
      this.balls.push(mk(0, 0, 0, 0, p.ballMass));
    } else if (p.mode === 'offset') {
      // 偏向 +x 一侧并带少量 z 偏移，使后续运动不局限于一个平面
      const ox = p.offset * p.width / 2 * 0.94;
      this.balls.push(mk(ox, -0.05 * p.depth, 0, 0, p.ballMass));
    } else {
      const n = clamp(Math.round(p.ballCount), 2, MAX_BALLS);
      const R = Math.min(p.width, p.depth) * 0.3;
      for (let i = 0; i < n; i++) {
        let bx = 0, bz = 0;
        if (i > 0) {
          const a = (i - 1) / (n - 1) * Math.PI * 2 + 0.55;
          bx = Math.cos(a) * R; bz = Math.sin(a) * R;
        }
        this.balls.push(mk(bx, bz, i * p.interval, i % 3 === 1 ? 1 : (i % 3 === 2 ? 2 : 0), p.ballMass));
      }
    }
    this.releaseEnd = this.balls[this.balls.length - 1].delay;
  }

  trigger() { if (this.triggerT < 0) { this.triggerT = this.t; this.phase = 'fall'; } }

  // 单个子步：内力 → 积分速度 → 接触 → 积分位置
  substep(dt, settling) {
    const nt = this.nt, T = this.T, DI = this.DI, VOL = this.VOL;
    const x = this.x, v = this.v, f = this.f, m = this.m;
    const mu = this.mu, la = this.la, alpha = this.alpha, eta = this.eta;
    f.fill(0);
    let minJ = 2;
    for (let t = 0; t < nt; t++) {
      const t4 = t * 4, a = T[t4], b = T[t4 + 1], c = T[t4 + 2], d = T[t4 + 3];
      const o = t * 9;
      const m11 = DI[o], m12 = DI[o + 1], m13 = DI[o + 2], m21 = DI[o + 3], m22 = DI[o + 4], m23 = DI[o + 5], m31 = DI[o + 6], m32 = DI[o + 7], m33 = DI[o + 8];
      const ax = x[a], ay = x[a + 1], az = x[a + 2];
      const d11 = x[b] - ax, d21 = x[b + 1] - ay, d31 = x[b + 2] - az;
      const d12 = x[c] - ax, d22 = x[c + 1] - ay, d32 = x[c + 2] - az;
      const d13 = x[d] - ax, d23 = x[d + 1] - ay, d33 = x[d + 2] - az;
      const F11 = d11 * m11 + d12 * m21 + d13 * m31, F12 = d11 * m12 + d12 * m22 + d13 * m32, F13 = d11 * m13 + d12 * m23 + d13 * m33;
      const F21 = d21 * m11 + d22 * m21 + d23 * m31, F22 = d21 * m12 + d22 * m22 + d23 * m32, F23 = d21 * m13 + d22 * m23 + d23 * m33;
      const F31 = d31 * m11 + d32 * m21 + d33 * m31, F32 = d31 * m12 + d32 * m22 + d33 * m32, F33 = d31 * m13 + d32 * m23 + d33 * m33;
      const C11 = F22 * F33 - F23 * F32, C12 = F23 * F31 - F21 * F33, C13 = F21 * F32 - F22 * F31;
      const C21 = F13 * F32 - F12 * F33, C22 = F11 * F33 - F13 * F31, C23 = F12 * F31 - F11 * F32;
      const C31 = F12 * F23 - F13 * F22, C32 = F13 * F21 - F11 * F23, C33 = F11 * F22 - F12 * F21;
      const J = F11 * C11 + F12 * C12 + F13 * C13;
      if (J < minJ) minJ = J;
      const Ic = F11 * F11 + F12 * F12 + F13 * F13 + F21 * F21 + F22 * F22 + F23 * F23 + F31 * F31 + F32 * F32 + F33 * F33;
      const a1 = mu * (1 - 1 / (Ic + 1)), a2 = la * (J - alpha);
      // 第一 P-K 应力
      let P11 = a1 * F11 + a2 * C11, P12 = a1 * F12 + a2 * C12, P13 = a1 * F13 + a2 * C13;
      let P21 = a1 * F21 + a2 * C21, P22 = a1 * F22 + a2 * C22, P23 = a1 * F23 + a2 * C23;
      let P31 = a1 * F31 + a2 * C31, P32 = a1 * F32 + a2 * C32, P33 = a1 * F33 + a2 * C33;
      // Kelvin-Voigt：S = η(FᵀḞ + ḞᵀF)，P_v = F S；对刚体转动不产生阻尼
      const avx = v[a], avy = v[a + 1], avz = v[a + 2];
      const w11 = v[b] - avx, w21 = v[b + 1] - avy, w31 = v[b + 2] - avz;
      const w12 = v[c] - avx, w22 = v[c + 1] - avy, w32 = v[c + 2] - avz;
      const w13 = v[d] - avx, w23 = v[d + 1] - avy, w33 = v[d + 2] - avz;
      const L11 = w11 * m11 + w12 * m21 + w13 * m31, L12 = w11 * m12 + w12 * m22 + w13 * m32, L13 = w11 * m13 + w12 * m23 + w13 * m33;
      const L21 = w21 * m11 + w22 * m21 + w23 * m31, L22 = w21 * m12 + w22 * m22 + w23 * m32, L23 = w21 * m13 + w22 * m23 + w23 * m33;
      const L31 = w31 * m11 + w32 * m21 + w33 * m31, L32 = w31 * m12 + w32 * m22 + w33 * m32, L33 = w31 * m13 + w32 * m23 + w33 * m33;
      const A11 = F11 * L11 + F21 * L21 + F31 * L31, A12 = F11 * L12 + F21 * L22 + F31 * L32, A13 = F11 * L13 + F21 * L23 + F31 * L33;
      const A21 = F12 * L11 + F22 * L21 + F32 * L31, A22 = F12 * L12 + F22 * L22 + F32 * L32, A23 = F12 * L13 + F22 * L23 + F32 * L33;
      const A31 = F13 * L11 + F23 * L21 + F33 * L31, A32 = F13 * L12 + F23 * L22 + F33 * L32, A33 = F13 * L13 + F23 * L23 + F33 * L33;
      const S11 = 2 * eta * A11, S22 = 2 * eta * A22, S33 = 2 * eta * A33;
      const S12 = eta * (A12 + A21), S13 = eta * (A13 + A31), S23 = eta * (A23 + A32);
      P11 += F11 * S11 + F12 * S12 + F13 * S13; P12 += F11 * S12 + F12 * S22 + F13 * S23; P13 += F11 * S13 + F12 * S23 + F13 * S33;
      P21 += F21 * S11 + F22 * S12 + F23 * S13; P22 += F21 * S12 + F22 * S22 + F23 * S23; P23 += F21 * S13 + F22 * S23 + F23 * S33;
      P31 += F31 * S11 + F32 * S12 + F33 * S13; P32 += F31 * S12 + F32 * S22 + F33 * S23; P33 += F31 * S13 + F32 * S23 + F33 * S33;
      // 节点力 H = -V P Dm⁻ᵀ
      const V = VOL[t];
      const h11 = -V * (P11 * m11 + P12 * m12 + P13 * m13), h12 = -V * (P11 * m21 + P12 * m22 + P13 * m23), h13 = -V * (P11 * m31 + P12 * m32 + P13 * m33);
      const h21 = -V * (P21 * m11 + P22 * m12 + P23 * m13), h22 = -V * (P21 * m21 + P22 * m22 + P23 * m23), h23 = -V * (P21 * m31 + P22 * m32 + P23 * m33);
      const h31 = -V * (P31 * m11 + P32 * m12 + P33 * m13), h32 = -V * (P31 * m21 + P32 * m22 + P33 * m23), h33 = -V * (P31 * m31 + P32 * m32 + P33 * m33);
      f[b] += h11; f[b + 1] += h21; f[b + 2] += h31;
      f[c] += h12; f[c + 1] += h22; f[c + 2] += h32;
      f[d] += h13; f[d + 1] += h23; f[d + 2] += h33;
      f[a] -= h11 + h12 + h13; f[a + 1] -= h21 + h22 + h23; f[a + 2] -= h31 + h32 + h33;
    }
    this.minJ = minJ;

    const p = this.p, g = p.gravity, nn = this.nn;
    const drag = Math.exp(-this.airDrag * dt);
    let vmax2 = 0;
    for (let i = 0, i3 = 0; i < nn; i++, i3 += 3) {
      const im = dt / m[i];
      let vx = (v[i3] + f[i3] * im) * drag;
      let vy = (v[i3 + 1] + f[i3 + 1] * im - g * dt) * drag;
      let vz = (v[i3 + 2] + f[i3 + 2] * im) * drag;
      const sp = vx * vx + vy * vy + vz * vz;
      if (sp > 1600) { const s = 40 / Math.sqrt(sp); vx *= s; vy *= s; vz *= s; }
      v[i3] = vx; v[i3 + 1] = vy; v[i3 + 2] = vz;
    }

    // 平台接触与固定
    const floorY = PLATFORM.top + this.platY;
    const pinned = this.pinned, mu_p = p.friction;
    const platV = this.platV;
    let platJ = 0;
    for (const n of this.bottomAll || (this.bottomAll = this.collectLow())) {
      const i3 = n * 3;
      if (pinned[n]) {
        // 固定节点：跟随平台，反作用力计入平台
        platJ += m[n] * (v[i3 + 1] - platV);
        v[i3] = 0; v[i3 + 1] = platV; v[i3 + 2] = 0;
        continue;
      }
      const pen = floorY - x[i3 + 1];
      if (pen > 0) {
        const vn = v[i3 + 1] - platV;
        const push = Math.min(pen * 0.15 / dt, 0.4);
        if (vn < push) {
          const dv = push - vn;
          const jn = m[n] * dv;
          platJ -= jn;
          v[i3 + 1] += dv;
          // 库仑摩擦
          const vx = v[i3], vz = v[i3 + 2], vt = Math.hypot(vx, vz);
          if (vt > 1e-9) {
            const lim = mu_p * dv;
            const s = vt <= lim ? 0 : (vt - lim) / vt;
            v[i3] *= s; v[i3 + 2] *= s;
          }
        }
      }
    }

    // 节点-重球接触（双向）
    const balls = this.balls;
    let contactN = 0;
    for (let bi = 0; bi < balls.length; bi++) {
      const B = balls[bi];
      if (B.held || B.caught) continue;
      contactN += this.ballNodeContact(B, dt);
    }
    if (!settling) this.contactN = contactN;

    // 积分节点位置
    for (let i = 0; i < nn * 3; i++) x[i] += v[i] * dt;

    // 平台自由度
    if (this.platK > 0) {
      const a = (platJ / dt + this.totalMass * g - this.platK * this.platY - this.platC * this.platV) / this.platMass;
      this.platV += clamp(a, -400, 400) * dt;
      this.platY += this.platV * dt;
    }

    if (!settling) this.stepBalls(dt);
  }

  collectLow() {
    // 只需检测靠近底部的节点（下层 3 层）；固定节点也在其中
    const out = [];
    const NX = this.NX, NZ = this.NZ, NY = this.NY;
    for (let k = 0; k <= NZ; k++) for (let j = 0; j <= Math.min(3, NY); j++) for (let i = 0; i <= NX; i++) out.push(this.nid(i, j, k));
    return out;
  }

  ballNodeContact(B, dt) {
    const x = this.x, v = this.v, m = this.m, nn = this.nn;
    const R = B.r, R2 = R * R, cx = B.x, cy = B.y, cz = B.z;
    const invM = B.invM, invI = B.invI;
    const muC = 0.42;
    let count = 0;
    let bvx = B.vx, bvy = B.vy, bvz = B.vz, wx = B.wx, wy = B.wy, wz = B.wz;
    for (let i = 0, i3 = 0; i < nn; i++, i3 += 3) {
      const dx = x[i3] - cx;
      if (dx > R || dx < -R) continue;
      const dy = x[i3 + 1] - cy;
      if (dy > R || dy < -R) continue;
      const dz = x[i3 + 2] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R2 || d2 < 1e-10) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
      const pen = R - d;
      const rx = nx * R, ry = ny * R, rz = nz * R;
      // 接触点相对速度
      const px = bvx + wy * rz - wz * ry, py = bvy + wz * rx - wx * rz, pz = bvz + wx * ry - wy * rx;
      const rvx = v[i3] - px, rvy = v[i3 + 1] - py, rvz = v[i3 + 2] - pz;
      const vn = rvx * nx + rvy * ny + rvz * nz;
      const push = Math.min(pen * 0.12 / dt, 0.6);
      count++;
      if (vn >= push) continue;
      const im = 1 / m[i];
      const meff = 1 / (im + invM);
      const jn = meff * (push - vn);
      // 切向：Coulomb 摩擦
      let tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz;
      const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
      let jx = jn * nx, jy = jn * ny, jz = jn * nz;
      if (vt > 1e-7) {
        const jt = Math.min(muC * jn, vt * meff * 0.4);
        tx /= vt; ty /= vt; tz /= vt;
        jx -= jt * tx; jy -= jt * ty; jz -= jt * tz;
      }
      v[i3] += jx * im; v[i3 + 1] += jy * im; v[i3 + 2] += jz * im;
      bvx -= jx * invM; bvy -= jy * invM; bvz -= jz * invM;
      // 力矩 r × (-j)
      wx -= (ry * jz - rz * jy) * invI;
      wy -= (rz * jx - rx * jz) * invI;
      wz -= (rx * jy - ry * jx) * invI;
    }
    if (this.onSound) {
      if (count > 0 && B.contact === 0) this.onSound('jellyHit', B, Math.hypot(B.vx, B.vy, B.vz));
      else if (count === 0 && B.contact > 0) this.onSound('jellyLeave', B, B.vy);
    }
    B.vx = bvx; B.vy = bvy; B.vz = bvz; B.wx = wx; B.wy = wy; B.wz = wz;
    B.contact = count;
    return count;
  }

  stepBalls(dt) {
    const p = this.p, balls = this.balls, g = p.gravity;
    for (const B of balls) {
      if (B.held) {
        if (this.triggerT >= 0 && this.t - this.triggerT >= B.delay) { B.held = false; if (this.onSound) this.onSound('release', B, 0); }
        else continue;
      }
      if (B.caught) { this.updateCatch(B, dt); continue; }
      B.vy -= g * dt;
      B.x += B.vx * dt; B.y += B.vy * dt; B.z += B.vz * dt;
      // 姿态积分
      const q = B.q, wx = B.wx, wy = B.wy, wz = B.wz, h = dt * 0.5;
      const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
      q[0] += h * (wx * qw + wy * qz - wz * qy);
      q[1] += h * (wy * qw + wz * qx - wx * qz);
      q[2] += h * (wz * qw + wx * qy - wy * qx);
      q[3] += h * (-wx * qx - wy * qy - wz * qz);
      const l = 1 / Math.hypot(q[0], q[1], q[2], q[3]);
      q[0] *= l; q[1] *= l; q[2] *= l; q[3] *= l;
      this.collideEnv(B, dt);
      // 接触状态追踪：用于“单次撞击”捕球
      if (B.contact > 0) { B.touched = true; B.separated = false; }
      else if (B.touched && !B.separated) { B.separated = true; }
      if (!p.multiHit && B.separated && !B.caught && B.vy <= 0.05) {
        B.caught = true; B.catchT = 0; B.cy0 = B.y; B.cx0 = B.x; B.cz0 = B.z;
        if (this.onSound) this.onSound('catch', B, 0);
      }
    }
    // 球-球碰撞
    for (let i = 0; i < balls.length; i++) {
      const A = balls[i];
      if (A.held || A.caught) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const B = balls[j];
        if (B.held || B.caught) continue;
        this.collideBalls(A, B);
      }
    }
  }

  // 平台/地面/挡边碰撞
  collideEnv(B, dt) {
    const p = this.p;
    const r = B.r;
    const rh = Math.hypot(B.x, B.z);
    const topY = PLATFORM.top + this.platY;
    const inner = PLATFORM.radius - PLATFORM.lipW;
    const onPlate = rh < PLATFORM.radius;
    const planeY = onPlate ? topY : 0;
    const contactBelow = B.y - r < planeY;
    if (contactBelow) {
      const relV = onPlate ? this.platV : 0;
      const vn = B.vy - relV;
      B.y = planeY + r;
      if (vn < 0) {
        const e = -vn > 0.45 ? this.ballRest : 0;
        const dv = -(1 + e) * vn;
        if (this.onSound && -vn > 0.3) this.onSound(onPlate ? 'plateHit' : 'floorHit', B, -vn);
        B.vy += dv;
        if (onPlate && this.platK > 0) this.platV -= dv * B.mass / this.platMass;
        // 摩擦 + 滚动
        const mu = p.friction;
        const cvx = B.vx + B.wz * r, cvz = B.vz - B.wx * r;
        const vt = Math.hypot(cvx, cvz);
        if (vt > 1e-6) {
          const need = vt * 2 / 7;           // 令接触点不滑动所需的 Δv（实心球）
          const dvt = Math.min(mu * dv, need);
          const ux = -cvx / vt, uz = -cvz / vt;
          B.vx += ux * dvt; B.vz += uz * dvt;
          // Δω = r × Δp / I
          const k = dvt * B.mass * B.invI * r;
          B.wz += ux * k; B.wx -= uz * k;
        }
        // 滚动阻力
        const rr = Math.exp(-(0.35 + 1.4 * p.friction) * dt);
        B.wx *= rr; B.wy *= rr; B.wz *= rr; B.vx *= rr; B.vz *= rr;
      }
    }
    // 挡边：球心高度低于挡边顶 + 半径时，把球挡在内侧
    if (onPlate && rh + r > inner && B.y - r < topY + PLATFORM.lipH && rh < inner + 0.02) {
      const nx = B.x / rh, nz = B.z / rh;
      const vr = B.vx * nx + B.vz * nz;
      const over = rh + r - inner;
      B.x -= nx * over; B.z -= nz * over;
      if (vr > 0) {
        if (this.onSound && vr > 0.15) this.onSound('lipHit', B, vr);
        const dv = (1 + 0.45) * vr;
        B.vx -= nx * dv; B.vz -= nz * dv;
      }
    }
    // 掉到平台外时，托座侧面把球推开
    if (!onPlate && B.y < PLATFORM.top - 0.01 && rh - r < PLATFORM.radius) {
      const nx = B.x / rh, nz = B.z / rh;
      const vr = B.vx * nx + B.vz * nz;
      B.x = nx * (PLATFORM.radius + r); B.z = nz * (PLATFORM.radius + r);
      if (vr < 0) { B.vx -= nx * vr * 1.3; B.vz -= nz * vr * 1.3; }
    }
  }

  collideBalls(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z;
    const rr = A.r + B.r, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-10) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
    const pen = rr - d, imA = A.invM, imB = B.invM, ims = imA + imB;
    A.x -= nx * pen * imA / ims; A.y -= ny * pen * imA / ims; A.z -= nz * pen * imA / ims;
    B.x += nx * pen * imB / ims; B.y += ny * pen * imB / ims; B.z += nz * pen * imB / ims;
    const rvx = B.vx - A.vx, rvy = B.vy - A.vy, rvz = B.vz - A.vz;
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn >= 0) return;
    if (this.onSound && -vn > 0.12) this.onSound('ballHit', A, -vn, B);
    const e = -vn > 0.3 ? 0.55 : 0;
    const j = -(1 + e) * vn / ims;
    A.vx -= j * nx * imA; A.vy -= j * ny * imA; A.vz -= j * nz * imA;
    B.vx += j * nx * imB; B.vy += j * ny * imB; B.vz += j * nz * imB;
    // 切向摩擦使两球相互带动旋转
    const cvx = rvx - vn * nx + (B.wy * -nz * B.r + B.wz * ny * B.r) - (A.wy * nz * A.r - A.wz * ny * A.r);
    const cvy = rvy - vn * ny + (B.wz * -nx * B.r + B.wx * nz * B.r) - (A.wz * nx * A.r - A.wx * nz * A.r);
    const cvz = rvz - vn * nz + (B.wx * -ny * B.r + B.wy * nx * B.r) - (A.wx * ny * A.r - A.wy * nx * A.r);
    const vt = Math.hypot(cvx, cvy, cvz);
    if (vt > 1e-6) {
      const jt = Math.min(0.3 * j, vt / (ims * 3.5));
      const tx = cvx / vt, ty = cvy / vt, tz = cvz / vt;
      A.vx += jt * tx * imA; A.vy += jt * ty * imA; A.vz += jt * tz * imA;
      B.vx -= jt * tx * imB; B.vy -= jt * ty * imB; B.vz -= jt * tz * imB;
      const kA = jt * A.invI * A.r, kB = jt * B.invI * B.r;
      A.wx += (ny * tz - nz * ty) * kA; A.wy += (nz * tx - nx * tz) * kA; A.wz += (nx * ty - ny * tx) * kA;
      B.wx += (ny * tz - nz * ty) * kB; B.wy += (nz * tx - nx * tz) * kB; B.wz += (nx * ty - ny * tx) * kB;
    }
  }

  // “单次撞击”时：电磁吸头在反弹顶点接住重球并吊回
  updateCatch(B, dt) {
    B.catchT += dt;
    const k = sstep(0, 1.1, B.catchT);
    B.x = lerp(B.cx0, B.hx, k); B.y = lerp(B.cy0, B.hy, k); B.z = lerp(B.cz0, B.hz, k);
    B.vx = B.vy = B.vz = 0; B.wx = B.wy = B.wz = 0;
    B.contact = 0;
  }

  // 推进到 t+dtTotal（固定时间序列，结果与实际帧率无关）
  advance(dtTotal) {
    let remain = dtTotal;
    while (remain > 1e-9) {
      // 严重压缩时自适应缩小时间步
      const scale = clamp(Math.cbrt(Math.max(this.minJ, 0.01)), 0.3, 1);
      const dt = Math.min(remain, this.dt0 * scale);
      this.substep(dt, false);
      this.t += dt;
      remain -= dt;
      if (!Number.isFinite(this.x[0]) || !Number.isFinite(this.v[0])) { this.recover(); return; }
    }
    this.updateMetrics();
  }

  recover() {
    this.x.set(this.settledX); this.v.fill(0); this.platY = 0; this.platV = 0;
    for (const B of this.balls) { if (!Number.isFinite(B.y)) { B.y = 2; B.x = 0; B.z = 0; B.vx = B.vy = B.vz = 0; B.wx = B.wy = B.wz = 0; } }
  }

  // 动能、凹陷量、阶段判定
  updateMetrics() {
    const v = this.v, m = this.m, nn = this.nn;
    let ke = 0;
    for (let i = 0, i3 = 0; i < nn; i++, i3 += 3) ke += m[i] * (v[i3] * v[i3] + v[i3 + 1] * v[i3 + 1] + v[i3 + 2] * v[i3 + 2]);
    ke *= 0.5;
    let keB = 0, anyContact = false, anyHeld = false, anyFree = false;
    for (const B of this.balls) {
      keB += 0.5 * B.mass * (B.vx * B.vx + B.vy * B.vy + B.vz * B.vz);
      if (B.contact > 0) anyContact = true;
      if (B.held) anyHeld = true; else anyFree = true;
    }
    this.kinE = ke; this.kinB = keB;
    const topY = this.x[this.topC * 3 + 1];
    this.dentCenter = this.restTopY - topY;
    // 全局最大凹陷（顶面节点相对静置形状）
    let maxD = 0, maxUp = 0;
    const NX = this.NX, NY = this.NY, NZ = this.NZ, S = this.settledX, x = this.x;
    for (let k = 0; k <= NZ; k++) for (let i = 0; i <= NX; i++) {
      const id = this.nid(i, NY, k) * 3;
      const dy = S[id + 1] - x[id + 1];
      if (dy > maxD) maxD = dy;
      if (-dy > maxUp) maxUp = -dy;
    }
    this.maxDent = maxD;
    this.maxUp = maxUp;
    this.bulge = x[this.nid(NX, NY >> 1, NZ >> 1) * 3] - this.restRight;

    // 阶段
    if (this.triggerT >= 0) {
      if (anyContact && this.firstContactT < 0) { this.firstContactT = this.t; this.phase = 'contact'; }
      if (this.firstContactT < 0) this.phase = 'fall';
      else {
        const since = this.t - this.firstContactT;
        const lastRel = this.t - this.triggerT - this.releaseEnd;
        if (since < 0.3 || lastRel < 0.25) this.phase = 'contact';
        else if (since < 1.1 || lastRel < 1.0) this.phase = 'rebound';
        else {
          const calm = ke < 0.04 * Math.max(1, this.totalMass / 400) && keB < 0.03;
          this.calmT = calm ? this.calmT + 1 : 0;
          this.phase = this.calmT > 40 ? 'stable' : 'after';
        }
      }
    }
    // 记录遥测
    if (this.t - this.lastSample > 1 / 50) {
      this.lastSample = this.t;
      const b0 = this.balls[0];
      this.history.push({ t: this.t, y: b0 ? b0.y - b0.r - this.restTopY : 0, dent: maxD, ke: ke + keB });
      if (this.history.length > 900) this.history.shift();
    }
  }

  // 填充带幽灵层的节点缓冲，供 GPU 上的三次 B 样条表面求值
  fillNodeBuffer(out) {
    const NX = this.NX, NY = this.NY, NZ = this.NZ, x = this.x;
    const sx = NX + 3, sy = NY + 3;
    const nid = this.nid;
    for (let k = 0; k <= NZ; k++) for (let j = 0; j <= NY; j++) {
      const row = (j + 1 + sy * (k + 1)) * sx;
      for (let i = 0; i <= NX; i++) {
        const s = nid(i, j, k) * 3, d = (row + i + 1) * 4;
        out[d] = x[s]; out[d + 1] = x[s + 1]; out[d + 2] = x[s + 2]; out[d + 3] = 1;
      }
    }
    // 幽灵层：线性外推，使样条在边界处插值
    const idx = (i, j, k) => (i + sx * (j + sy * k)) * 4;
    const ext = (g, b, n) => {
      out[g] = 2 * out[b] - out[n]; out[g + 1] = 2 * out[b + 1] - out[n + 1]; out[g + 2] = 2 * out[b + 2] - out[n + 2]; out[g + 3] = 1;
    };
    for (let k = 1; k <= NZ + 1; k++) for (let j = 1; j <= NY + 1; j++) {
      ext(idx(0, j, k), idx(1, j, k), idx(2, j, k));
      ext(idx(NX + 2, j, k), idx(NX + 1, j, k), idx(NX, j, k));
    }
    for (let k = 1; k <= NZ + 1; k++) for (let i = 0; i <= NX + 2; i++) {
      ext(idx(i, 0, k), idx(i, 1, k), idx(i, 2, k));
      ext(idx(i, NY + 2, k), idx(i, NY + 1, k), idx(i, NY, k));
    }
    for (let j = 0; j <= NY + 2; j++) for (let i = 0; i <= NX + 2; i++) {
      ext(idx(i, j, 0), idx(i, j, 1), idx(i, j, 2));
      ext(idx(i, j, NZ + 2), idx(i, j, NZ + 1), idx(i, j, NZ));
    }
  }

  bounds() {
    const x = this.x;
    let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9];
    for (let i = 0; i < this.nn * 3; i += 3) for (let c = 0; c < 3; c++) {
      const q = x[i + c]; if (q < a[c]) a[c] = q; if (q > b[c]) b[c] = q;
    }
    return [a, b];
  }
}

if (typeof module !== 'undefined') module.exports = { JellySim, JELLY_DEFAULTS, PLATFORM };
