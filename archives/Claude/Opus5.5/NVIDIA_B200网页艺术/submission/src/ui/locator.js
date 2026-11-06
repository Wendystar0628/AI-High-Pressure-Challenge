// 定位小图：俯视封装 + 当前视野框。镜头推近时，观众仍知道自己在封装的哪里。
import { S, A } from './svg.js';
import { STACK_POS, DIM } from '../models/package.js';

const K = 1.55;
export function createLocator(parent) {
  const g = S('g', { class: 'loc' }, parent);
  const x = v => v * K, z = v => v * K;
  S('rect', { x: x(-46), y: z(-42), width: 92 * K, height: 84 * K, class: 'loc-sub' }, g);
  S('rect', { x: x(-30), y: z(-26.2), width: 60 * K, height: 52.4 * K, class: 'loc-ip' }, g);
  const dieA = S('rect', { x: x(-17), y: z(-24.7), width: 34 * K, height: 24.5 * K, class: 'loc-die' }, g);
  const dieB = S('rect', { x: x(-17), y: z(.2), width: 34 * K, height: 24.5 * K, class: 'loc-die' }, g);
  const stacks = STACK_POS.map(([a, b], i) => S('rect', { x: x(a - 5.5), y: z(b - 5.9), width: 11 * K, height: 11.8 * K, class: 'loc-hbm' }, g));
  S('line', { x1: x(-46), x2: x(46), y1: 0, y2: 0, class: 'loc-seam' }, g);
  const view = S('path', { class: 'loc-view' }, g);
  const lab = S('text', { class: 'c2-head', x: x(-46), y: z(-42) - 8 }, g, '视野在封装中的位置');
  return {
    g,
    // rot：小图随相机方位旋转，保持和画面同向
    update(f, cx, cy, op, rot = 0) {
      A(g, { transform: `translate(${cx} ${cy}) rotate(${rot})`, opacity: op });
      if (op < .01) return;
      const corners = [[0, 0], [f.DW, 0], [f.DW, f.DH], [0, f.DH]].map(([a, b]) => f.unprojectToPlaneY(a, b, 4.5));
      let d = '';
      corners.forEach((c, i) => {
        const X = Math.max(-300, Math.min(300, c.x * K)), Y = Math.max(-300, Math.min(300, c.z * K));
        d += `${i ? 'L' : 'M'}${X.toFixed(1)} ${Y.toFixed(1)}`;
      });
      A(view, { d: d + 'Z' });
      A(lab, { transform: `rotate(${-rot} ${x(-46)} ${z(-42) - 8})` });
    },
    hotStack(i) { stacks.forEach((s, k) => s.setAttribute('class', 'loc-hbm' + (k === i ? ' on' : ''))); },
  };
}
