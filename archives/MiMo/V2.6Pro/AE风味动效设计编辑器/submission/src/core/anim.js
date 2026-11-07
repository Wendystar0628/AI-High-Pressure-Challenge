// 关键帧属性：时间插值、空间插值、求值与写入
import { clamp, lerpArr, bezierEase, easeFn, linearFn } from './math.js';

export const INTERP = { LINEAR: 'linear', BEZIER: 'bezier', HOLD: 'hold' };

export class Key {
  constructor(time, value, opts = {}) {
    this.time = time;
    this.value = Array.isArray(value) ? value.slice() : [value];
    // 时间缓动：进入与离开
    this.easeIn = opts.easeIn || { type: 'bezier', influence: 33 };   // {type, influence}
    this.easeOut = opts.easeOut || { type: 'bezier', influence: 33 };
    // 空间插值（位置属性）：切线句柄（世界单位）
    this.spatialIn = opts.spatialIn ? opts.spatialIn.slice() : null;
    this.spatialOut = opts.spatialOut ? opts.spatialOut.slice() : null;
    this.label = opts.label || '';
  }
  clone() {
    return new Key(this.time, this.value, {
      easeIn: { ...this.easeIn }, easeOut: { ...this.easeOut },
      spatialIn: this.spatialIn ? this.spatialIn.slice() : null,
      spatialOut: this.spatialOut ? this.spatialOut.slice() : null,
      label: this.label,
    });
  }
  toJSON() {
    return {
      time: this.time, value: this.value.slice(),
      easeIn: this.easeIn, easeOut: this.easeOut,
      spatialIn: this.spatialIn, spatialOut: this.spatialOut, label: this.label,
    };
  }
  static fromJSON(j) {
    return new Key(j.time, j.value, j);
  }
}

function easeAt(k, t) {
  // k 是离开方关键帧：用 k.easeOut；进入下一关键帧用 next.easeIn
  return k.easeOut;
}

// 计算两关键帧之间的时间进度（含缓动）
function temporalProgress(k0, k1, t) {
  const dt = k1.time - k0.time;
  if (dt <= 0) return 1;
  let u = clamp((t - k0.time) / dt, 0, 1);
  const io = k0.easeOut || { type: 'bezier', influence: 33 };
  const ii = k1.easeIn || { type: 'bezier', influence: 33 };
  if (io.type === 'hold' || ii.type === 'hold') {
    return u >= 1 ? 1 : 0;
  }
  if (io.type === 'linear' && ii.type === 'linear') return u;
  // 混合两侧 influence
  const infIn = ii.type === 'bezier' ? ii.influence : 33;
  const infOut = io.type === 'bezier' ? io.influence : 33;
  return bezierEase(infIn, infOut)(u);
}

// 空间贝塞尔：在位置值之间按空间句柄插值
function spatialLerp(k0, k1, u) {
  const v0 = k0.value, v1 = k1.value;
  const n = v0.length;
  const out = new Array(n);
  const h0 = k0.spatialOut, h1 = k1.spatialIn;
  // 控制点：若无句柄则线性等价
  const p0 = v0, p3 = v1;
  const p1 = h0 ? v0.map((v, i) => v + h0[i] * 0.33) : v0.map((v, i) => v + (v1[i] - v0[i]) * 0.33);
  const p2 = h1 ? v1.map((v, i) => v + h1[i] * 0.33) : v0.map((v, i) => v + (v1[i] - v0[i]) * 0.66);
  const u2 = u * u, u3 = u2 * u;
  for (let i = 0; i < n; i++) {
    out[i] =
      (-0.5 * u3 + u2 - 0.5 * u) * 0 + // placeholder
      (2 * u3 - 3 * u2 + 1) * p0[i] +
      (-2 * u3 + 3 * u2) * p3[i] +
      (u3 - 2 * u2 + u) * p1[i] +
      (u3 - u2) * p2[i];
  }
  return out;
}

export class AnimProperty {
  constructor(opts = {}) {
    this.name = opts.name || 'prop';
    this.dims = opts.dims || 1;
    const raw = opts.value;
    if (Array.isArray(raw)) {
      this.value = raw.slice(0, this.dims);
    } else if (typeof raw === 'number') {
      this.value = [raw];
    } else {
      this.value = new Array(this.dims).fill(0);
    }
    while (this.value.length < this.dims) this.value.push(0);
    this.keys = [];
    this.expression = opts.expression || null;
    this.exprEnabled = false;
    this.animated = false;
    this.readonly = !!opts.readonly;
    this.min = opts.min;
    this.max = opts.max;
    this.ui = opts.ui || {}; // {type:'angle'|'color'|'slider'|'point'|'select', options}
    this._exprCache = null;
  }

  isSingle() { return this.dims === 1; }

  // 当前静态值 / 无关键帧时的值
  getStatic() { return this.value.slice(); }
  setStatic(v) {
    this.value = Array.isArray(v) ? v.slice(0, this.dims) : [v];
    while (this.value.length < this.dims) this.value.push(0);
    this._exprCache = null;
  }

  toggleAnimated(on) {
    const target = on === undefined ? !this.animated : on;
    if (target && !this.animated) {
      this.animated = true;
    } else if (!target && this.animated) {
      this.animated = false;
      // 保留当前 value（由调用方在关闭前写入）
    }
  }

  findKeyIndex(t, eps = 1e-6) {
    for (let i = 0; i < this.keys.length; i++) {
      if (Math.abs(this.keys[i].time - t) < eps) return i;
    }
    return -1;
  }

  keyAt(t, value, opts) {
    const i = this.findKeyIndex(t);
    if (i >= 0) {
      this.keys[i].value = value.slice(0, this.dims);
      return this.keys[i];
    }
    const k = new Key(t, value, opts);
    this.keys.push(k);
    this.keys.sort((a, b) => a.time - b.time);
    this.animated = true;
    return k;
  }

  removeKeyAt(t) {
    const i = this.findKeyIndex(t);
    if (i >= 0) this.keys.splice(i, 1);
    return i >= 0;
  }

  // 写入：若开启动画，在当前时刻建/改关键帧；否则改静态值
  write(t, value, keyOpts) {
    if (this.animated || this.keys.length > 0) {
      this.keyAt(t, value, keyOpts);
    } else {
      this.setStatic(value);
    }
    this._exprCache = null;
  }

  // 仅关键帧求值（不含表达式）
  evalKeys(t) {
    const keys = this.keys;
    if (keys.length === 0) return this.value.slice(0, this.dims);
    if (t <= keys[0].time) return keys[0].value.slice(0, this.dims);
    if (t >= keys[keys.length - 1].time) return keys[keys.length - 1].value.slice(0, this.dims);
    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].time < t) i++;
    const k0 = keys[i], k1 = keys[i + 1];
    const u = temporalProgress(k0, k1, t);
    const isSpatial = this.ui.type === 'point' || this.ui.spatial;
    if (isSpatial && k0.spatialOut && k1.spatialIn) {
      return spatialLerp(k0, k1, u).slice(0, this.dims);
    }
    return lerpArr(k0.value, k1.value, u).slice(0, this.dims);
  }

  // 最终值：表达式优先（表达式引擎注入求值函数）
  evalFinal(t, exprEval) {
    if (this.expression && this.exprEnabled && exprEval) {
      const v = exprEval(this, t);
      if (v != null) return Array.isArray(v) ? v.slice(0, this.dims) : [v];
      // 求值失败退回关键帧值
    }
    return this.evalKeys(t);
  }

  // 采样曲线（用于曲线编辑器）
  sampleCurve(t0, t1, steps = 120, exprEval = null) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps;
      const v = this.evalFinal(t, exprEval);
      pts.push([t, v.slice()]);
    }
    return pts;
  }

  // 速度曲线（数值微分）
  sampleVelocity(t0, t1, steps = 120, exprEval = null) {
    const pts = [];
    const dt = (t1 - t0) / steps;
    for (let i = 0; i <= steps; i++) {
      const t = t0 + dt * i;
      const a = this.evalFinal(Math.max(t0, t - 0.008), exprEval);
      const b = this.evalFinal(Math.min(t1, t + 0.008), exprEval);
      const scale = 1 / (b ? 0.016 : 0.016);
      const v = b.map((bv, j) => (bv - a[j]) * scale);
      pts.push([t, v]);
    }
    return pts;
  }

  toJSON() {
    return {
      name: this.name, dims: this.dims, value: this.value.slice(),
      keys: this.keys.map((k) => k.toJSON()),
      expression: this.expression, exprEnabled: this.exprEnabled,
      animated: this.animated, ui: this.ui,
    };
  }

  static fromJSON(j) {
    const p = new AnimProperty(j);
    p.keys = (j.keys || []).map(Key.fromJSON);
    p.animated = j.animated;
    p.expression = j.expression;
    p.exprEnabled = j.exprEnabled;
    return p;
  }
}

// 位置空间运动路径采样（返回 [{t, pos}]）
export function sampleMotionPath(prop, t0, t1, steps = 60, exprEval = null) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    pts.push({ t, pos: prop.evalFinal(t, exprEval) });
  }
  return pts;
}

export { temporalProgress, spatialLerp };
