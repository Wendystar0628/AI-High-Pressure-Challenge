// ============================================================
// 七处章间转场的承接图形
// 同一对象在两种表示之间连续转换；可停住、可倒放（纯 progress 函数）
// ============================================================
import { el, clear, group, smoothPath, PathPulses } from './runtime.js';
import { LAYOUT, map, smooth, clamp01, lerp, findSeg } from '../timeline.js';
import { store, workload } from '../state.js';

const TRANS_IDS = ['tr01-02', 'tr02-03', 'tr03-04', 'tr04-05', 'tr05-06', 'tr06-07', 'tr07-08'];

export class Transitions {
  constructor(root) {
    this.g = group(root, 'svg-transitions');
    this.W = 0; this.H = 0;
    this.nodes = {};
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.g);
    this.nodes = {};

    // ---- 01→02 完整封装 → 拆解：轮廓线稿逐层展开 ----
    {
      const n = group(this.g, 'tr01');
      const cx = W * 0.5, cy = H * 0.52;
      const layers = [];
      for (let i = 0; i < 5; i++) {
        const r = el('rect', {
          x: cx - 150 + i * 4, y: cy - 60 + i * 26, width: 300 - i * 8, height: 16,
          rx: 3, fill: 'none', stroke: '#46d8ff', 'stroke-width': 1.3, opacity: 0,
        }, n);
        layers.push(r);
      }
      const label = el('text', { x: cx, y: cy + 130, 'text-anchor': 'middle', class: 't-dim' }, n);
      label.textContent = '同一颗 B200 · 逐层展开';
      this.nodes.tr01 = { g: n, layers, label };
    }

    // ---- 02→03 聚焦接缝：取景框 + 接缝高亮 ----
    {
      const n = group(this.g, 'tr02');
      const cx = W * 0.5, cy = H * 0.5;
      const frame = el('rect', {
        x: cx - 220, y: cy - 130, width: 440, height: 260, rx: 12,
        fill: 'none', stroke: '#9bebff', 'stroke-width': 1.6, opacity: 0,
      }, n);
      const cross = el('path', {
        d: `M ${cx - 24} ${cy} H ${cx + 24} M ${cx} ${cy - 24} V ${cx && cy + 24}`,
        stroke: '#ffb454', 'stroke-width': 1.4, opacity: 0,
      }, n);
      const label = el('text', { x: cx, y: cy + 172, 'text-anchor': 'middle', class: 't-label' }, n);
      label.textContent = '镜头进入两颗晶粒之间';
      this.nodes.tr02 = { g: n, frame, cross, label };
    }

    // ---- 03→04 数据路径 → 侧视线稿（3D→SVG 连续转换）----
    {
      const n = group(this.g, 'tr03');
      // 从接缝流向显存的路径
      const path = el('path', {
        d: `M ${W * 0.5} ${H * 0.48} C ${W * 0.4} ${H * 0.36}, ${W * 0.25} ${H * 0.4}, ${W * 0.14} ${H * 0.56}`,
        stroke: '#46d8ff', 'stroke-width': 2, fill: 'none', opacity: 0,
      }, n);
      const pulses = new PathPulses(n, {
        d: path.getAttribute('d'), stroke: '#9bebff', 'stroke-width': 2, fill: 'none',
      }, 5, { speed: 0.2, color: '#9bebff' });
      // 目标：堆栈侧视线稿（从三维轮廓「剥」成平面）
      const stackG = group(n, 'tr03-stack');
      const sx = W * 0.14, sy = H * 0.56;
      const outline = el('rect', {
        x: sx - 40, y: sy - 90, width: 80, height: 110, rx: 4,
        fill: 'none', stroke: '#6ef2a0', 'stroke-width': 1.6, opacity: 0,
      }, stackG);
      const lines = [];
      for (let i = 0; i < 8; i++) {
        const l = el('line', {
          x1: sx - 34, y1: sy - 82 + i * 12, x2: sx + 34, y2: sy - 82 + i * 12,
          stroke: '#6ef2a0', 'stroke-width': 1, opacity: 0,
        }, stackG);
        lines.push(l);
      }
      const label = el('text', { x: sx, y: sy + 42, 'text-anchor': 'middle', class: 't-dim' }, n);
      label.textContent = '三维堆栈 → 二维侧视线稿（保持对齐）';
      this.nodes.tr03 = { g: n, path, pulses, outline, lines, label };
    }

    // ---- 04→05 数据块 → 位格（数值表示）----
    {
      const n = group(this.g, 'tr04');
      const cx = W * 0.5, cy = H * 0.48;
      // 传输中的数据块（立方线框）
      const cube = el('path', {
        d: `M ${cx - 40} ${cy - 30} l 40 -18 l 40 18 l -40 18 Z M ${cx - 40} ${cy - 30} v 40 l 40 18 v -40 M ${cx + 40} ${cy - 30} v 40 l -40 18`,
        stroke: '#46d8ff', 'stroke-width': 1.8, fill: 'rgba(70,216,255,0.08)', opacity: 0,
      }, n);
      // 目标位格
      const cells = [];
      for (let i = 0; i < 8; i++) {
        const r = el('rect', {
          x: cx - 66 + i * 18, y: cy + 40, width: 15, height: 26, rx: 2,
          fill: 'rgba(110,242,160,0.15)', stroke: '#6ef2a0', 'stroke-width': 1.2, opacity: 0,
        }, n);
        cells.push(r);
      }
      const label = el('text', { x: cx, y: cy + 100, 'text-anchor': 'middle', class: 't-label' }, n);
      label.textContent = '一份在传数据 → 它的数值表示（位格）';
      this.nodes.tr04 = { g: n, cube, cells, label };
    }

    // ---- 05→06 计算任务 → 八卡分片 ----
    {
      const n = group(this.g, 'tr05');
      const cx = W * 0.5, cy = H * 0.44;
      const core = el('rect', {
        x: cx - 46, y: cy - 26, width: 92, height: 52, rx: 8,
        fill: 'rgba(255,180,84,0.12)', stroke: '#ffb454', 'stroke-width': 1.6, opacity: 0,
      }, n);
      const arrows = [];
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const tx = cx + Math.cos(ang) * 190;
        const ty = cy + Math.sin(ang) * 110;
        const a = el('path', {
          d: `M ${cx} ${cy} Q ${(cx + tx) / 2} ${cy + (ty - cy) * 0.2} ${tx} ${ty}`,
          stroke: '#46d8ff', 'stroke-width': 1.3, fill: 'none', opacity: 0,
        }, n);
        const box = el('rect', {
          x: tx - 22, y: ty - 13, width: 44, height: 26, rx: 4,
          fill: 'rgba(70,216,255,0.10)', stroke: '#46d8ff', 'stroke-width': 1.2, opacity: 0,
        }, n);
        arrows.push({ a, box });
      }
      const label = el('text', { x: cx, y: cy + 160, 'text-anchor': 'middle', class: 't-label' }, n);
      label.textContent = '同一份负载 · 分片到 8 颗 GPU';
      this.nodes.tr05 = { g: n, core, arrows, label };
    }

    // ---- 06→07 系统 → 对照视图（3D→SVG）----
    {
      const n = group(this.g, 'tr06');
      const items = [];
      for (let i = 0; i < 5; i++) {
        const x = W * 0.16 + i * W * 0.17;
        const y = H * 0.5;
        // 从立体到平面的双框过渡
        const iso = el('path', {
          d: `M ${x - 46} ${y - 20} l 30 -16 l 62 0 l 30 16 l -30 16 l -62 0 Z`,
          stroke: '#8fb8e8', 'stroke-width': 1.3, fill: 'rgba(143,184,232,0.06)', opacity: 0,
        }, n);
        const flat = el('rect', {
          x: x - 46, y: y - 26, width: 92, height: 52, rx: 5,
          stroke: '#46d8ff', 'stroke-width': 1.4, fill: 'rgba(70,216,255,0.06)', opacity: 0,
        }, n);
        items.push({ iso, flat });
      }
      const label = el('text', { x: W * 0.5, y: H * 0.72, 'text-anchor': 'middle', class: 't-label' }, n);
      label.textContent = '系统模型 → 对照视图中的产品图形（结构一一对应）';
      this.nodes.tr06 = { g: n, items, label };
    }

    // ---- 07→08 对照行 → 整颗封装（SVG→3D）----
    {
      const n = group(this.g, 'tr07');
      const cx = W * 0.5, cy = H * 0.5;
      const inner = el('rect', {
        x: cx - 60, y: cy - 42, width: 120, height: 84, rx: 6,
        fill: 'none', stroke: '#d98a4b', 'stroke-width': 1.6, opacity: 0,
      }, n);
      const outer = el('rect', {
        x: cx - 60, y: cy - 42, width: 120, height: 84, rx: 6,
        fill: 'none', stroke: '#9bebff', 'stroke-width': 1.4, opacity: 0,
      }, n);
      // 两颗晶粒核
      const d1 = el('rect', {
        x: cx - 34, y: cy - 18, width: 28, height: 36, rx: 3,
        fill: 'rgba(217,138,75,0.16)', stroke: '#d98a4b', opacity: 0,
      }, n);
      const d2 = el('rect', {
        x: cx + 6, y: cy - 18, width: 28, height: 36, rx: 3,
        fill: 'rgba(70,216,255,0.16)', stroke: '#46d8ff', opacity: 0,
      }, n);
      const label = el('text', { x: cx, y: cy + 110, 'text-anchor': 'middle', class: 't-label' }, n);
      label.textContent = 'B200 对照行 → 回到整颗封装';
      this.nodes.tr07 = { g: n, inner, outer, d1, d2, label };
    }
  }

  update(p, time) {
    const seg = findSeg(p);
    const isTr = seg.kind === 'transition';
    // 全部隐藏
    for (const n of Object.values(this.nodes)) {
      n.g.setAttribute('opacity', 0);
    }
    if (!isTr) return;
    const t = (p - seg.start) / (seg.len || 1);
    const ease = smooth(t);
    const fade = Math.sin(Math.min(1, t) * Math.PI); // 中段最亮

    if (seg.id === 'tr01-02') {
      const n = this.nodes.tr01;
      n.g.setAttribute('opacity', fade);
      for (let i = 0; i < n.layers.length; i++) {
        n.layers[i].setAttribute('opacity', smooth(map(t, i * 0.12, 0.3 + i * 0.12)) * 0.85);
        n.layers[i].setAttribute('transform', `translate(0, ${(-ease * 34 * (i - 2)).toFixed(1)})`);
      }
      n.label.setAttribute('opacity', smooth(map(t, 0.1, 0.5)));
    } else if (seg.id === 'tr02-03') {
      const n = this.nodes.tr02;
      n.g.setAttribute('opacity', fade);
      const s = lerp(1, 0.42, ease);
      n.frame.setAttribute('opacity', 0.9);
      n.frame.setAttribute('transform', `translate(${this.W * 0.5 * (1 - s)}, ${this.H * 0.5 * (1 - s)}) scale(${s})`);
      n.cross.setAttribute('opacity', smooth(map(t, 0.35, 0.75)));
      n.label.setAttribute('opacity', smooth(map(t, 0.15, 0.5)));
    } else if (seg.id === 'tr03-04') {
      const n = this.nodes.tr03;
      n.g.setAttribute('opacity', fade);
      n.path.setAttribute('opacity', 0.85);
      n.pulses.update(time, fade);
      n.outline.setAttribute('opacity', smooth(map(t, 0.25, 0.7)));
      for (let i = 0; i < n.lines.length; i++) {
        n.lines[i].setAttribute('opacity', smooth(map(t, 0.35 + i * 0.05, 0.55 + i * 0.05)) * 0.9);
      }
      n.label.setAttribute('opacity', smooth(map(t, 0.2, 0.6)));
    } else if (seg.id === 'tr04-05') {
      const n = this.nodes.tr04;
      n.g.setAttribute('opacity', fade);
      // 立方位格拆成 8 个位格（形变）
      const split = smooth(map(t, 0.25, 0.8));
      n.cube.setAttribute('opacity', 1 - split * 0.92);
      n.cube.setAttribute('transform', `scale(${lerp(1, 0.5, split)}) translate(${(1 - split) * 0}, ${lerp(0, -40, split)})`);
      for (let i = 0; i < n.cells.length; i++) {
        n.cells[i].setAttribute('opacity', split * 0.95);
        n.cells[i].setAttribute('transform', `translate(0, ${lerp(-70, 0, split)})`);
      }
      n.label.setAttribute('opacity', smooth(map(t, 0.2, 0.6)));
    } else if (seg.id === 'tr05-06') {
      const n = this.nodes.tr05;
      n.g.setAttribute('opacity', fade);
      n.core.setAttribute('opacity', 0.95);
      for (let i = 0; i < n.arrows.length; i++) {
        const at = smooth(map(t, 0.12 + i * 0.06, 0.5 + i * 0.06));
        n.arrows[i].a.setAttribute('opacity', at * 0.85);
        n.arrows[i].box.setAttribute('opacity', at);
      }
      n.label.setAttribute('opacity', smooth(map(t, 0.15, 0.55)));
    } else if (seg.id === 'tr06-07') {
      const n = this.nodes.tr06;
      n.g.setAttribute('opacity', fade);
      for (let i = 0; i < n.items.length; i++) {
        const at = smooth(map(t, 0.1 + i * 0.08, 0.45 + i * 0.08));
        // 等距立体框 → 平面框（轮廓对齐的连续转换）
        n.items[i].iso.setAttribute('opacity', (1 - at) * 0.9);
        n.items[i].flat.setAttribute('opacity', at * 0.95);
      }
      n.label.setAttribute('opacity', smooth(map(t, 0.2, 0.6)));
    } else if (seg.id === 'tr07-08') {
      const n = this.nodes.tr07;
      n.g.setAttribute('opacity', fade);
      const grow = smooth(map(t, 0.15, 0.85));
      n.inner.setAttribute('opacity', 0.95);
      n.outer.setAttribute('opacity', 0.9);
      const s = lerp(1, 2.6, grow);
      n.outer.setAttribute('transform', `translate(${this.W * 0.5 * (1 - s)}, ${this.H * 0.5 * (1 - s)}) scale(${s})`);
      n.outer.setAttribute('opacity', 0.9 * (1 - grow * 0.85));
      n.d1.setAttribute('opacity', smooth(map(t, 0.1, 0.5)));
      n.d2.setAttribute('opacity', smooth(map(t, 0.18, 0.58)));
      n.label.setAttribute('opacity', smooth(map(t, 0.15, 0.55)));
    }
  }
}
