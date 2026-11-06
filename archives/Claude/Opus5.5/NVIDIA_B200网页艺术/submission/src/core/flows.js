// 脉冲工具：沿路径运动的亮条。长度与速度成正比，相当于这一段的运动模糊。
import { fract } from './util.js';

const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];

export function runPulses(st, path, opts) {
  const { n = 3, speed = .3, time = 0, color = [1, 1, 1], gain = 6, width = .03, tail = .05, phase = 0, from = 0, to = 1, stopAt = 2 } = opts;
  for (let i = 0; i < n; i++) {
    let u = fract(time * speed + i / n + phase);
    u = from + (to - from) * u;
    if (u > stopAt) continue;
    const t0 = Math.max(u - tail, from);
    path.at(u, a);
    path.at((u + t0) / 2, c);
    path.at(t0, b);
    const fade = Math.min(1, (u - from) / .04, (to - u) / .04);
    const g = gain * .55 * Math.max(0, fade);
    st.add(c[0], c[1], c[2], a[0], a[1], a[2], color[0] * g, color[1] * g, color[2] * g, width);
    st.add(b[0], b[1], b[2], c[0], c[1], c[2], color[0] * g * .5, color[1] * g * .5, color[2] * g * .5, width * .8);
  }
}

// 单个脉冲：u 由调用方给定（用于滚动驱动的数据）
export function onePulse(st, path, u, opts) {
  const { color = [1, 1, 1], gain = 6, width = .03, tail = .05 } = opts;
  const t0 = Math.max(u - tail, 0);
  path.at(u, a); path.at(t0, b);
  st.add(b[0], b[1], b[2], a[0], a[1], a[2], color[0] * gain, color[1] * gain, color[2] * gain, width);
}

// 静态的发光线段
export function wire(st, pts, color, gain = 1, width = .012) {
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i];
    st.add(p[0], p[1], p[2], q[0], q[1], q[2], color[0] * gain, color[1] * gain, color[2] * gain, width);
  }
}

export function wireProgress(st, path, u, color, gain = 1, width = .012, steps = 16) {
  let px = null;
  for (let i = 0; i <= steps; i++) {
    path.at(u * i / steps, a);
    if (px) st.add(px[0], px[1], px[2], a[0], a[1], a[2], color[0] * gain, color[1] * gain, color[2] * gain, width);
    px = [a[0], a[1], a[2]];
  }
}

export function flowsUpdate() { /* 脉冲由各章添加 */ }
