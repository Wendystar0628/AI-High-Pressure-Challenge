// ============================================================
// 章节 SVG 动态图形 B（05–08）
// 位格重组 / 拓扑链路 / 产品对照 / 标注与负载收束
// ============================================================
import { el, clear, group, PathPulses, Leader, bitCells, tickScale, fmtNum, fmtBytes, linePath, smoothPath } from './runtime.js';
import { map, smooth, clamp01, lerp, chapterLocal, segT } from '../timeline.js';
import { store, FACTS, workload, PRECISIONS, precisionById, GPU_PEAK } from '../state.js';
import { quantizeMatrix, matmul, quantize, formatBitString, traceMACs, nonzeroCount } from '../numerics.js';

// ------------------------------------------------------------
// 05 数值精度：位格拆分重组 + 数轴量化 + 矩阵结果连续变化
// ------------------------------------------------------------
export class SvgCh05 {
  constructor(root) {
    this.g = group(root, 'svg-ch05');
    this.bitLayer = group(this.g, 'bits');
    this.axisLayer = group(this.g, 'axis');
    this.matLayer = group(this.g, 'matvis');
    this.W = 0; this.H = 0;
    this.bitCells = [];
    this.lastFmt = null;
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.bitLayer); clear(this.axisLayer); clear(this.matLayer);
    this.buildBits(store.precision);
    this.buildAxis();
    this.buildMatVis();
  }

  buildBits(fmt) {
    this.lastFmt = fmt;
    clear(this.bitLayer);
    el('rect', {
      x: this.W * 0.545, y: this.H * 0.115, width: this.W * 0.35, height: this.H * 0.24,
      rx: 12, fill: 'rgba(8,13,22,0.72)', stroke: 'rgba(130,175,230,0.16)',
    }, this.bitLayer);
    const bs = formatBitString(fmt);
    const x0 = this.W * 0.56, y0 = this.H * 0.16;
    const title = el('text', { x: x0, y: y0 - 14, class: 't-hi' }, this.bitLayer);
    title.textContent = `位格 · ${fmt}  （S ${bs.sign} / E ${bs.exp} / M ${bs.mant}）`;

    // 组标题
    const groups = [
      { n: bs.sign, label: 'S', color: '#ff6b6b' },
      { n: bs.exp, label: 'E', color: '#46d8ff' },
      { n: bs.mant, label: 'M', color: '#6ef2a0' },
    ];
    this.bitCells = [];
    let cx = x0;
    for (const grp of groups) {
      const cells = [];
      for (let i = 0; i < grp.n; i++) {
        const r = el('rect', {
          x: cx + i * 17, y: y0, width: 14, height: 26, rx: 2.5,
          fill: 'rgba(120,160,210,0.12)', stroke: grp.color, 'stroke-width': 1,
        }, this.bitLayer);
        const t = el('text', {
          x: cx + i * 17 + 7, y: y0 + 18, 'text-anchor': 'middle', 'font-size': 11,
          fill: '#8aa0bd',
        }, this.bitLayer);
        t.textContent = '0';
        cells.push({ rect: r, text: t });
      }
      const gl = el('text', {
        x: cx + grp.n * 17 / 2 - 7, y: y0 + 44, 'text-anchor': 'middle', class: 't-dim',
        fill: grp.color,
      }, this.bitLayer);
      gl.textContent = `${grp.label}×${grp.n}`;
      this.bitCells.push({ cells, color: grp.color, label: grp.label });
      cx += grp.n * 17 + 12;
    }
    // 说明
    this.fmtDesc = el('text', { x: x0, y: y0 + 72, class: 't-label' }, this.bitLayer);
    this.fmtDesc.textContent = precisionById(fmt).desc;
    // 块共享（FP4）
    this.blockNote = el('text', { x: x0, y: y0 + 96, class: 't-dim' }, this.bitLayer);
  }

  buildAxis() {
    clear(this.axisLayer);
    el('rect', {
      x: this.W * 0.545, y: this.H * 0.40, width: this.W * 0.35, height: this.H * 0.20,
      rx: 12, fill: 'rgba(8,13,22,0.72)', stroke: 'rgba(130,175,230,0.16)',
    }, this.axisLayer);
    const x1 = this.W * 0.56, x2 = this.W * 0.875, y = this.H * 0.52;
    this.axisTitle = el('text', { x: x1, y: y - 56, class: 't-hi' }, this.axisLayer);
    this.axisTitle.textContent = '数轴 · 可表示值与量化误差';
    tickScale(this.axisLayer, x1, x2, y, 11, (t) => (-6 + t * 12).toFixed(0));
    // 量化刻度点
    this.axisDots = [];
    for (let i = 0; i < 13; i++) {
      const d = el('circle', { cx: x1, cy: y, r: 3.2, fill: '#46d8ff', opacity: 0.7 }, this.axisLayer);
      this.axisDots.push(d);
    }
    // 原值与量化值连线
    this.snapLines = [];
    for (let i = 0; i < 6; i++) {
      const l = el('line', {
        x1: x1, y1: y - 22, x2: x1, y2: y - 22,
        stroke: '#ffb454', 'stroke-width': 1.2, opacity: 0.8,
      }, this.axisLayer);
      const c1 = el('circle', { cx: x1, cy: y - 22, r: 3.6, fill: '#ffb454' }, this.axisLayer);
      const c2 = el('circle', { cx: x1, cy: y, r: 3, fill: '#46d8ff' }, this.axisLayer);
      this.snapLines.push({ line: l, orig: c1, quant: c2 });
    }
    this.axisLegend = el('text', { x: x1, y: y + 36, class: 't-dim' }, this.axisLayer);
    this.axisLegend.textContent = '橙点 = 原值 · 蓝点 = 量化后可表示值 · 连线长度 = 舍入误差';
  }

  buildMatVis() {
    clear(this.matLayer);
    // 逐级拉远：嵌套框随进度收缩汇聚
    this.zoomLayer = group(this.matLayer, 'zoomout');
    this.zoomLevels = [];
    const levels = ['乘加 a×b', '累加器', '张量核心', '计算区', '晶粒 ×2', 'B200 GPU'];
    for (let i = 0; i < levels.length; i++) {
      const g = group(this.zoomLayer, 'z' + i);
      const inset = i * 11;
      const r = el('rect', {
        x: this.W * 0.818 + inset, y: this.H * 0.685 + inset * 0.72,
        width: this.W * 0.15 - inset * 2, height: this.H * 0.165 - inset * 1.44,
        rx: 8 - i, fill: 'none', stroke: i % 2 ? '#46d8ff' : '#d98a4b',
        'stroke-width': 1.4, opacity: 0,
      }, g);
      const t = el('text', {
        x: this.W * 0.818 + inset + 6, y: this.H * 0.685 + inset * 0.72 + 13,
        class: 't-dim',
      }, g);
      t.textContent = levels[i];
      this.zoomLevels.push({ g, r, t });
    }
    el('rect', {
      x: this.W * 0.545, y: this.H * 0.655, width: this.W * 0.35, height: this.H * 0.28,
      rx: 12, fill: 'rgba(8,13,22,0.72)', stroke: 'rgba(130,175,230,0.16)',
    }, this.matLayer);
    const x0 = this.W * 0.56, y0 = this.H * 0.70;
    this.matTitle = el('text', { x: x0, y: y0 - 12, class: 't-hi' }, this.matLayer);
    this.matTitle.textContent = '矩阵结果 · 随格式与输入连续变化';
    this.matBars = [];
    for (let i = 0; i < 8; i++) {
      const bx = x0 + i * 52;
      const bg = el('rect', {
        x: bx, y: y0, width: 38, height: 110, rx: 4,
        fill: 'rgba(120,160,210,0.08)', stroke: 'rgba(130,175,230,0.2)',
      }, this.matLayer);
      const bar = el('rect', {
        x: bx + 3, y: y0 + 55, width: 32, height: 52, rx: 3,
        fill: 'rgba(70,216,255,0.55)',
      }, this.matLayer);
      const lbl = el('text', {
        x: bx + 19, y: y0 + 126, 'text-anchor': 'middle', class: 't-dim',
      }, this.matLayer);
      lbl.textContent = 'c' + (i + 1);
      this.matBars.push({ bar, lbl, bg });
    }
    this.matRead = el('text', { x: x0, y: y0 + 152, class: 't-label' }, this.matLayer);
  }

  update(p, time) {
    const t05 = chapterLocal('ch05', p);
    const vis = smooth(map(t05, 0, 0.06)) * smooth(map(t05, 0.94, 1, 1, 0.12));
    this.g.setAttribute('opacity', vis);

    // 滚动格式讲解（不覆盖用户选定的全页精度）
    const tourList = ['FP64', 'TF32', 'FP16', 'BF16', 'FP8', 'FP4'];
    const tourIdx = Math.min(5, Math.floor(clamp01(map(t05, 0.02, 0.62)) * 5.999));
    const tourFmt = tourList[tourIdx];
    if (tourFmt !== this.lastFmt) this.buildBits(tourFmt);

    // 位格亮灯动画（二进制滚动）
    for (let g = 0; g < this.bitCells.length; g++) {
      const grp = this.bitCells[g];
      for (let i = 0; i < grp.cells.length; i++) {
        const bit = (Math.floor(time * 1.4 + i * 0.6 + g * 2.3) >> i) & 1;
        const on = bit === 1;
        grp.cells[i].rect.setAttribute('fill', on
          ? (g === 0 ? 'rgba(255,107,107,0.75)' : g === 1 ? 'rgba(70,216,255,0.75)' : 'rgba(110,242,160,0.75)')
          : 'rgba(120,160,210,0.12)');
        grp.cells[i].text.textContent = bit;
        grp.cells[i].text.setAttribute('fill', on ? '#06121c' : '#8aa0bd');
      }
    }
    this.fmtDesc.textContent = precisionById(tourFmt).desc +
      `　·　讲解格式 ${tourFmt} ≠ 全页精度 ${store.precision}（矩阵实验按全页精度执行）`;

    // 数轴：用讲解格式展示量化误差差异
    const samples = [-5.2, -2.9, -1.15, 0.62, 2.4, 4.8];
    const x1 = this.W * 0.56, x2 = this.W * 0.875, y = this.H * 0.52;
    const toX = (v) => x1 + ((v + 6) / 12) * (x2 - x1);
    for (let i = 0; i < this.axisDots.length; i++) {
      const v = -6 + (i / (this.axisDots.length - 1)) * 12;
      const q = quantize(v, tourFmt);
      const qq = Math.abs(q.q) > 6.01 ? Math.sign(q.q) * 6 : q.q;
      this.axisDots[i].setAttribute('cx', toX(qq));
    }
    for (let i = 0; i < this.snapLines.length; i++) {
      const v = samples[i];
      const q = quantize(v, tourFmt);
      const qq = Math.abs(q.q) > 6.01 ? Math.sign(q.q) * 6 : q.q;
      const s = this.snapLines[i];
      s.orig.setAttribute('cx', toX(v));
      s.quant.setAttribute('cx', toX(qq));
      s.line.setAttribute('x1', toX(v));
      s.line.setAttribute('x2', toX(qq));
    }

    // 矩阵结果柱（按用户全页精度真实计算）
    const qa = quantizeMatrix(store.matA, store.precision === 'FP4' ? 'FP4' : store.precision);
    const qb = quantizeMatrix(store.matB, store.precision === 'FP4' ? 'FP4' : store.precision);
    const cq = matmul(qa.mat, qb.mat);
    const c0 = cq[0];
    let maxAbs = 1e-6;
    for (const v of c0) maxAbs = Math.max(maxAbs, Math.abs(v));
    for (let i = 0; i < 8 && i < c0.length + 4; i++) {
      const v = i < c0.length ? c0[i] : (i - 3 < store.matB[0].length ? cq[Math.min(1, cq.length - 1)][i % cq[0].length] : 0);
      const h = 20 + (Math.abs(v) / maxAbs) * 78;
      const bar = this.matBars[i];
      bar.bar.setAttribute('height', h.toFixed(1));
      bar.bar.setAttribute('y', (this.H * 0.70 + 106 - h).toFixed(1));
      bar.bar.setAttribute('fill', v < 0 ? 'rgba(255,107,107,0.6)' : 'rgba(70,216,255,0.55)');
    }
    // 逐级拉远动画
    if (this.zoomLevels) {
      const zt = clamp01(map(t05, 0.55, 0.88));
      for (let i = 0; i < this.zoomLevels.length; i++) {
        const z = this.zoomLevels[i];
        const on = smooth(map(zt, i / 7, (i + 1.6) / 7));
        z.r.setAttribute('opacity', (on * 0.9).toFixed(2));
        z.t.setAttribute('opacity', (on * 0.95).toFixed(2));
        z.g.setAttribute('transform', `translate(${((1 - on) * 26).toFixed(1)}, 0)`);
      }
    }
    const errSum = qa.errors.flat().reduce((a, b) => a + Math.abs(b), 0);
    this.matRead.textContent = `量化绝对误差和 Σ|Δ| = ${errSum.toFixed(4)} · 格式 ${store.precision}${store.precision === 'FP4' ? ` · 块缩放 s=${qa.scale.toFixed(4)}` : ''}`;
    this.blockNote.textContent = tourFmt === 'FP4'
      ? 'NVFP4：每 16 个值共享 1 个 E4M3 缩放因子 + 张量级 FP32'
      : `总位宽 ${formatBitString(tourFmt).total} bit / 值`;
  }
}

// ------------------------------------------------------------
// 06 多卡系统：拓扑链路生长 + 分片汇总
// ------------------------------------------------------------
export class SvgCh06 {
  constructor(root) {
    this.g = group(root, 'svg-ch06');
    this.topoLayer = group(this.g, 'topo');
    this.shardLayer = group(this.g, 'shard');
    this.W = 0; this.H = 0;
    this.gpuNodes = [];
    this.links = [];
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.topoLayer); clear(this.shardLayer);

    // 拓扑：8 GPU + 2 NVSwitch（HGX B200）
    const cx = W * 0.28, cy = H * 0.42;
    this.topoTitle = el('text', { x: cx - 150, y: cy - 168, class: 't-hi' }, this.topoLayer);
    this.topoTitle.textContent = 'HGX B200 八卡拓扑 · NVLink 5 全互联';

    // 交换节点
    this.swNodes = [];
    for (const s of [-1, 1]) {
      const sw = el('rect', {
        x: cx - 34, y: cy + s * 96 - 14, width: 68, height: 28, rx: 5,
        fill: 'rgba(255,180,84,0.14)', stroke: '#ffb454', 'stroke-width': 1.4,
      }, this.topoLayer);
      const t = el('text', {
        x: cx, y: cy + s * 96 + 4, 'text-anchor': 'middle', class: 't-dim', fill: '#ffb454',
      }, this.topoLayer);
      t.textContent = 'NVSwitch';
      this.swNodes.push({ sw, t });
    }

    this.gpuNodes = [];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const gx = cx + Math.cos(ang) * 148;
      const gy = cy + Math.sin(ang) * 118;
      const node = el('rect', {
        x: gx - 30, y: gy - 18, width: 60, height: 36, rx: 6,
        fill: 'rgba(70,216,255,0.10)', stroke: '#46d8ff', 'stroke-width': 1.5,
        class: 'hit', style: 'cursor:pointer',
      }, this.topoLayer);
      node.addEventListener('click', () => {
        store.set('selectedPart', store.selectedPart === 'hgxGpu' + i ? null : 'hgxGpu' + i, 'select');
      });
      const label = el('text', {
        x: gx, y: gy + 4, 'text-anchor': 'middle', class: 't-label',
      }, this.topoLayer);
      label.textContent = 'GPU ' + (i + 1);
      const local = el('text', {
        x: gx, y: gy + 32, 'text-anchor': 'middle', class: 't-dim',
      }, this.topoLayer);
      this.gpuNodes.push({ node, label, local, gx, gy, ang });
    }

    // 链路（GPU ↔ NVSwitch）
    this.links = [];
    for (let i = 0; i < 8; i++) {
      const g = this.gpuNodes[i];
      for (const s of [-1, 1]) {
        const path = el('path', {
          d: `M ${g.gx} ${g.gy} Q ${cx + s * 30} ${cy + s * 60} ${cx} ${cy + s * 96}`,
          stroke: 'rgba(70,216,255,0.28)', 'stroke-width': 1.3, fill: 'none',
        }, this.topoLayer);
        this.links.push(path);
      }
    }
    // 传输脉冲
    this.linkPulses = [];
    for (let i = 0; i < 8; i++) {
      const g = this.gpuNodes[i];
      const d = `M ${g.gx} ${g.gy} Q ${cx} ${cy} ${this.gpuNodes[(i + 1) % 8].gx} ${this.gpuNodes[(i + 1) % 8].gy}`;
      const pulses = new PathPulses(this.topoLayer, { d, stroke: '#9bebff', 'stroke-width': 1.4, fill: 'none' }, 3, {
        speed: 0.18, color: '#9bebff', size: 2.6,
      });
      this.linkPulses.push(pulses);
    }

    // 分片汇总条
    const sx = W * 0.60, sy = H * 0.24;
    this.shardTitle = el('text', { x: sx, y: sy - 12, class: 't-hi' }, this.shardLayer);
    this.shardTitle.textContent = '八卡分片 · 局部计算 · 归约汇总';
    this.shardBars = [];
    this.shardVals = [];
    for (let i = 0; i < 8; i++) {
      const y = sy + 14 + i * 30;
      el('rect', {
        x: sx, y, width: 240, height: 18, rx: 4,
        fill: 'rgba(120,160,210,0.08)', stroke: 'rgba(130,175,230,0.18)',
      }, this.shardLayer);
      const bar = el('rect', {
        x: sx, y, width: 10, height: 18, rx: 4,
        fill: 'rgba(70,216,255,0.55)',
      }, this.shardLayer);
      const lbl = el('text', { x: sx + 252, y: y + 13, class: 't-dim' }, this.shardLayer);
      lbl.textContent = 'GPU' + (i + 1);
      const val = el('text', { x: sx + 300, y: y + 13, class: 't-label' }, this.shardLayer);
      this.shardBars.push({ bar, lbl, val, y });
    }
    this.reduceLine = el('line', {
      x1: sx + 240, y1: sy + 20, x2: sx + 240, y2: sy + 14 + 8 * 30,
      stroke: '#ffb454', 'stroke-width': 2,
    }, this.shardLayer);
    this.reduceLabel = el('text', { x: sx + 320, y: sy + 8 + 4 * 30, class: 't-label', fill: '#ffb454' }, this.shardLayer);
    this.reduceLabel.textContent = 'all-reduce';

    // 负载读数
    this.loadRead = el('text', { x: sx, y: sy + 280, class: 't-label' }, this.shardLayer);
    this.loadRead2 = el('text', { x: sx, y: sy + 304, class: 't-dim' }, this.shardLayer);
  }

  update(p, time) {
    const t06 = chapterLocal('ch06', p);
    const vis = smooth(map(t06, 0, 0.06)) * smooth(map(t06, 0.92, 1, 1, 0.12));
    this.g.setAttribute('opacity', vis);

    // 链路生长
    const grow = smooth(map(t06, 0.05, 0.35));
    for (let i = 0; i < this.links.length; i++) {
      const L = this.links[i];
      try {
        const len = L.getTotalLength();
        L.setAttribute('stroke-dasharray', len);
        L.setAttribute('stroke-dashoffset', len * (1 - grow));
      } catch (e) { /* ignore */ }
    }
    for (const pulses of this.linkPulses) pulses.update(time, vis * grow);

    // 分片动画：真实矩阵派生数值
    const qa = quantizeMatrix(store.matA, store.precision === 'FP4' ? 'FP4' : store.precision);
    const qb = quantizeMatrix(store.matB, store.precision === 'FP4' ? 'FP4' : store.precision);
    const cq = matmul(qa.mat, qb.mat);
    let acc = 0;
    for (const row of cq) for (const v of row) acc += v;
    const wl = workload();
    // 可从任一 GPU 发起：选中 GPU i 时，分片轮次从该卡开始
    let startGpu = 0;
    const sel = store.selectedPart || '';
    if (sel.startsWith('hgxGpu')) startGpu = parseInt(sel.slice(6), 10) || 0;
    const shardProgress = clamp01(map(t06, 0.2, 0.72) + ((time * 0.08) % 1) * 0.02);

    for (let i = 0; i < 8; i++) {
      const rel = (i - startGpu + 8) % 8;
      const phase = (shardProgress * 8 - rel);
      const local = clamp01(phase);
      const partial = (acc / 8) * (0.85 + 0.15 * Math.sin(i * 1.7 + store.matA[i % 4][i % 4]));
      const shown = partial * local;
      const b = this.shardBars[i];
      b.bar.setAttribute('width', (12 + local * 228).toFixed(1));
      b.val.textContent = shown.toFixed(3);
      const selected = store.selectedPart === 'hgxGpu' + i;
      b.bar.setAttribute('fill', selected ? 'rgba(255,180,84,0.75)' : 'rgba(70,216,255,0.55)');
      this.gpuNodes[i].node.setAttribute('stroke', selected ? '#ffb454' : '#46d8ff');
      this.gpuNodes[i].node.setAttribute('fill', selected ? 'rgba(255,180,84,0.18)' : 'rgba(70,216,255,0.10)');
      // 局部结果读数
      this.gpuNodes[i].local.textContent = local > 0.15 ? shown.toFixed(2) : '—';
    }

    // 归约线生长
    const red = smooth(map(t06, 0.55, 0.85));
    this.reduceLine.setAttribute('opacity', red);
    this.reduceLabel.setAttribute('opacity', red);

    const fmt = store.precision;
    this.loadRead.textContent = `负载 ${fmtNum(wl.tokens)} tokens · ${fmtBytes(wl.bytes)} · 精度 ${fmt}（${store.precisionDef.bits} bit${fmt === 'FP4' ? ' + 缩放' : ''}）`;
    this.loadRead2.textContent = `需要 ${wl.gpusNeeded} GPU / ${wl.platformsNeeded} 平台 · 每卡显存 ${FACTS.hbm3eCapacity} GB · 链路 1.8 TB/s（双向口径）`;
  }
}

// ------------------------------------------------------------
// 07 规格对照：五产品结构图形 + 指标反馈
// ------------------------------------------------------------
const PRODUCTS = [
  {
    id: 'B200', name: 'B200', tag: '单颗 GPU',
    mem: '186 GB HBM3e', bw: '8 TB/s', link: 'NVLink 1.8 TB/s',
    fp4: '20 | 10 PFLOPS', fp8: '10 | 5 PFLOPS', fp16: '5 | 2.5 PFLOPS', fp64: '40 TFLOPS',
    power: '≈1000 W（TGP）', comp: '双晶粒 · 8×HBM3e',
  },
  {
    id: 'HGX', name: 'HGX B200', tag: '八卡基板',
    mem: '1.4 TB（8 卡）', bw: '64 TB/s', link: 'NVLink 聚合 14.4 TB/s',
    fp4: '144 | 72 PFLOPS', fp8: '72 PFLOPS', fp16: '36 PFLOPS', fp64: '296 TFLOPS',
    power: '随整机', comp: '8×B200 + NVSwitch',
  },
  {
    id: 'DGX', name: 'DGX B200', tag: '完整服务器',
    mem: '1,440 GB HBM3e', bw: '64 TB/s', link: 'NVLink 14.4 TB/s',
    fp4: '144 | 72 PFLOPS', fp8: '72 PFLOPS', fp16: '36 PFLOPS', fp64: '296 TFLOPS',
    power: '≈14.3 kW', comp: '8×B200 + 2×Xeon + 8×CX-7',
  },
  {
    id: 'GB200', name: 'GB200', tag: 'Grace Blackwell 超级芯片',
    mem: '372 GB HBM3e', bw: '16 TB/s', link: 'NVLink 3.6 TB/s + C2C 900 GB/s',
    fp4: '40 | 20 PFLOPS', fp8: '20 PFLOPS', fp16: '10 PFLOPS', fp64: '80 TFLOPS',
    power: '≈2.7 kW（模组）', comp: '1 Grace + 2×B200',
  },
  {
    id: 'NVL72', name: 'GB200 NVL72', tag: '整机柜',
    mem: '13.4 TB HBM3e', bw: '576 TB/s', link: 'NVLink 域 130 TB/s',
    fp4: '1,440 | 720 PFLOPS', fp8: '720 PFLOPS', fp16: '360 PFLOPS', fp64: '2,880 TFLOPS',
    power: '≈120–132 kW（液冷）', comp: '36 Grace + 72 GPU · 18+9 托盘',
  },
];

export class SvgCh07 {
  constructor(root) {
    this.g = group(root, 'svg-ch07');
    this.glyphLayer = group(this.g, 'glyphs');
    this.metricLayer = group(this.g, 'metrics');
    this.W = 0; this.H = 0;
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.glyphLayer); clear(this.metricLayer);
    const title = el('text', { x: W * 0.155, y: H * 0.12, class: 't-hi' }, this.glyphLayer);
    title.textContent = '五种产品 · 结构图形对照（与第 02–06 章模型同一套结构标识）';

    this.glyphNodes = [];
    for (let i = 0; i < PRODUCTS.length; i++) {
      const pr = PRODUCTS[i];
      const x = W * 0.155 + i * W * 0.163;
      const y = H * 0.245;
      const gn = group(this.glyphLayer, 'glyph-' + pr.id);
      gn.setAttribute('class', 'hit');
      gn.setAttribute('style', 'cursor:pointer');
      gn.addEventListener('click', () => {
        store.set('selectedProduct', store.selectedProduct === pr.id ? null : pr.id, 'product');
      });
      // 台座
      el('rect', {
        x: x, y: y - 78, width: 140, height: 156, rx: 10,
        fill: 'rgba(10,16,28,0.5)', stroke: 'rgba(130,175,230,0.22)',
      }, gn);
      // 结构图形（与三维同构的简化线稿）
      this.drawProductGlyph(gn, pr.id, x + 70, y - 6, 1);
      const name = el('text', { x: x + 70, y: y + 100, 'text-anchor': 'middle', class: 't-hi' }, gn);
      name.textContent = pr.name;
      const tag = el('text', { x: x + 70, y: y + 118, 'text-anchor': 'middle', class: 't-dim' }, gn);
      tag.textContent = pr.tag;
      this.glyphNodes.push({ gn, pr, x, y, name, tag });
    }

    // 指标对比条（内存）—— 选择指标时，前面章节对应部位同步反馈
    const my = H * 0.455;
    this.metricTitle = el('text', { x: W * 0.155, y: my - 14, class: 't-hi' }, this.metricLayer);
    this.metricTitle.textContent = '显存容量对比（对数刻度示意）· 点击指标条反馈到对应结构';
    this.metricBars = [];
    const memGB = [186, 1400, 1440, 372, 13400];
    // 指标切换：显存 / 带宽 / 互连 / 算力
    this.metricKind = 'mem';
    const kinds = [
      { id: 'mem', label: '显存容量' },
      { id: 'bw', label: '显存带宽' },
      { id: 'link', label: '互连带宽' },
      { id: 'fp4', label: 'FP4 算力' },
    ];
    this.kindButtons = [];
    for (let i = 0; i < kinds.length; i++) {
      const b = el('rect', {
        x: W * 0.155 + i * 116, y: my - 46, width: 108, height: 26, rx: 6,
        fill: 'rgba(70,216,255,0.10)', stroke: 'rgba(70,216,255,0.35)',
        class: 'hit', style: 'cursor:pointer',
      }, this.metricLayer);
      b.addEventListener('click', () => {
        this.metricKind = kinds[i].id;
        // 指标 → 对应结构反馈
        const partMap = { mem: 'hbm0', bw: 'hbm0', link: 'bridge', fp4: 'dieA' };
        store.set('selectedPart', partMap[kinds[i].id], 'select');
      });
      const t = el('text', {
        x: W * 0.155 + i * 116 + 52, y: my - 28, 'text-anchor': 'middle', class: 't-dim',
      }, this.metricLayer);
      t.textContent = kinds[i].label;
      this.kindButtons.push({ b, t, kind: kinds[i] });
    }
    const metricValues = {
      mem: memGB,
      bw: [8, 64, 64, 16, 576],
      link: [1.8, 14.4, 14.4, 3.6, 130],
      fp4: [10, 72, 72, 20, 720],
    };
    this.metricValues = metricValues;
    for (let i = 0; i < PRODUCTS.length; i++) {
      const x = W * 0.155 + i * W * 0.163;
      const hMax = H * 0.115;
      const h = hMax * (Math.log10(memGB[i]) / Math.log10(13400));
      const bar = el('rect', {
        x: x + 30, y: my + hMax - h, width: 80, height: h, rx: 4,
        fill: 'rgba(70,216,255,0.35)', stroke: '#46d8ff',
        class: 'hit', style: 'cursor:pointer',
      }, this.metricLayer);
      bar.addEventListener('click', () => {
        store.set('selectedProduct', PRODUCTS[i].id, 'product');
        store.set('selectedPart', 'hbm0', 'select');
      });
      const lbl = el('text', {
        x: x + 70, y: my + hMax + 18, 'text-anchor': 'middle', class: 't-dim',
      }, this.metricLayer);
      lbl.textContent = PRODUCTS[i].mem;
      this.metricBars.push({ bar, lbl, i });
    }
  }

  drawProductGlyph(parent, id, cx, cy, s) {
    const stroke = '#46d8ff', cop = '#d98a4b';
    if (id === 'B200') {
      el('rect', { x: cx - 52, y: cy - 40, width: 104, height: 80, rx: 6, fill: 'none', stroke: cop, 'stroke-width': 1.6 }, parent);
      el('rect', { x: cx - 30, y: cy - 22, width: 26, height: 44, rx: 3, fill: 'rgba(70,216,255,0.18)', stroke }, parent);
      el('rect', { x: cx + 4, y: cy - 22, width: 26, height: 44, rx: 3, fill: 'rgba(70,216,255,0.18)', stroke }, parent);
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1;
        const k = i % 4;
        el('rect', {
          x: cx + side * 44 - 8, y: cy - 30 + k * 16, width: 16, height: 11, rx: 1.5,
          fill: 'rgba(110,242,160,0.22)', stroke: '#6ef2a0', 'stroke-width': 1,
        }, parent);
      }
    } else if (id === 'HGX') {
      el('rect', { x: cx - 58, y: cy - 32, width: 116, height: 64, rx: 5, fill: 'rgba(60,160,150,0.10)', stroke: '#2ee6c5', 'stroke-width': 1.6 }, parent);
      for (let i = 0; i < 8; i++) {
        const col = i % 4, row = Math.floor(i / 4);
        el('rect', {
          x: cx - 48 + col * 26, y: cy - 24 + row * 28, width: 20, height: 20, rx: 2,
          fill: 'rgba(70,216,255,0.16)', stroke,
        }, parent);
      }
    } else if (id === 'DGX') {
      el('rect', { x: cx - 56, y: cy - 38, width: 112, height: 76, rx: 6, fill: 'rgba(40,52,68,0.5)', stroke: '#8fb8e8', 'stroke-width': 1.6 }, parent);
      for (let i = 0; i < 8; i++) {
        el('circle', { cx: cx - 40 + i * 11, cy: cy + 22, r: 3, fill: '#6ef2a0', opacity: 0.8 }, parent);
      }
      el('rect', { x: cx - 44, y: cy - 26, width: 88, height: 34, rx: 3, fill: 'rgba(70,216,255,0.10)', stroke }, parent);
    } else if (id === 'GB200') {
      el('rect', { x: cx - 52, y: cy - 30, width: 104, height: 60, rx: 5, fill: 'rgba(60,160,150,0.10)', stroke: '#2ee6c5', 'stroke-width': 1.6 }, parent);
      el('rect', { x: cx - 8, y: cy - 20, width: 26, height: 22, rx: 2, fill: 'rgba(217,138,75,0.25)', stroke: cop }, parent);
      el('rect', { x: cx - 42, y: cy - 2, width: 28, height: 24, rx: 2, fill: 'rgba(70,216,255,0.16)', stroke }, parent);
      el('rect', { x: cx + 12, y: cy - 2, width: 28, height: 24, rx: 2, fill: 'rgba(70,216,255,0.16)', stroke }, parent);
    } else if (id === 'NVL72') {
      el('rect', { x: cx - 26, y: cy - 58, width: 52, height: 116, rx: 4, fill: 'rgba(40,52,68,0.5)', stroke: '#8fb8e8', 'stroke-width': 1.6 }, parent);
      for (let i = 0; i < 12; i++) {
        el('rect', {
          x: cx - 20, y: cy - 50 + i * 9, width: 40, height: 6, rx: 1,
          fill: i % 3 === 0 ? 'rgba(255,180,84,0.35)' : 'rgba(70,216,255,0.22)',
          stroke: i % 3 === 0 ? '#ffb454' : '#46d8ff', 'stroke-width': 0.6,
        }, parent);
      }
    }
  }

  update(p, time) {
    const t07 = chapterLocal('ch07', p);
    const vis = smooth(map(t07, 0, 0.08)) * smooth(map(t07, 0.9, 1, 1, 0.15));
    this.g.setAttribute('opacity', vis);

    for (let i = 0; i < this.glyphNodes.length; i++) {
      const gn = this.glyphNodes[i];
      const selected = store.selectedProduct === gn.pr.id;
      const hoverGlow = 0.5 + 0.5 * Math.sin(time * 1.2 + i * 0.9);
      gn.gn.setAttribute('opacity', selected ? 1 : 0.72 + hoverGlow * 0.28);
      gn.name.setAttribute('fill', selected ? '#ffb454' : '#9bebff');
      if (selected) {
        gn.gn.setAttribute('transform', `translate(0, -6)`);
      } else {
        gn.gn.setAttribute('transform', `translate(0, 0)`);
      }
    }
    // 指标条随所选指标变化
    const vals = this.metricValues[this.metricKind] || this.metricValues.mem;
    const maxV = Math.max(...vals);
    const labels = {
      mem: PRODUCTS.map(pr => pr.mem), bw: PRODUCTS.map(pr => pr.bw),
      link: PRODUCTS.map(pr => pr.link), fp4: PRODUCTS.map(pr => 'FP4 ' + pr.fp4),
    };
    for (let i = 0; i < this.metricBars.length; i++) {
      const b = this.metricBars[i];
      const selected = store.selectedProduct === PRODUCTS[i].id;
      const hMax = this.H * 0.115;
      const h = hMax * (Math.log10(Math.max(1, vals[i])) / Math.log10(Math.max(10, maxV)));
      b.bar.setAttribute('height', h.toFixed(1));
      b.bar.setAttribute('y', (this.H * 0.66 + hMax - h).toFixed(1));
      b.lbl.textContent = (labels[this.metricKind] || [])[i] || '';
      b.bar.setAttribute('fill', selected ? 'rgba(255,180,84,0.5)' : 'rgba(70,216,255,0.32)');
      b.bar.setAttribute('stroke', selected ? '#ffb454' : '#46d8ff');
    }
    for (const kb of this.kindButtons) {
      const active = kb.kind.id === this.metricKind;
      kb.b.setAttribute('fill', active ? 'rgba(70,216,255,0.28)' : 'rgba(70,216,255,0.10)');
      kb.t.setAttribute('fill', active ? '#9bebff' : '#6c7f9b');
    }
  }
}

// ------------------------------------------------------------
// 08 回到整颗：三维标注 + 三类负载 + 结尾汇聚
// ------------------------------------------------------------
export class SvgCh08 {
  constructor(root) {
    this.g = group(root, 'svg-ch08');
    this.callLayer = group(this.g, 'callouts');
    this.loadLayer = group(this.g, 'workloads');
    this.endLayer = group(this.g, 'ending');
    this.W = 0; this.H = 0;
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.callLayer); clear(this.loadLayer); clear(this.endLayer);

    // 七组标注：锚点跟随三维结构（由 sceneCtrl.projectAnchors 投影）
    const defs = [
      { id: 'te', label: '第二代 Transformer Engine', sub: 'FP4 / FP8 微缩放', bx: W * 0.30, by: H * 0.16, color: '#ffb454' },
      { id: 'd2d', label: '片间互连 NV-HBI', sub: '10 TB/s · 双晶粒', bx: W * 0.86, by: H * 0.30, color: '#9bebff' },
      { id: 'decomp', label: '解压缩引擎', sub: '数据库查询加速', bx: W * 0.86, by: H * 0.52, color: '#6ef2a0' },
      { id: 'hbm', label: 'HBM3e 显存', sub: '8 堆栈 · 8 TB/s', bx: W * 0.10, by: H * 0.18, color: '#46d8ff' },
      { id: 'nvlink', label: '第五代 NVLink', sub: '1.8 TB/s 双向 / GPU', bx: W * 0.08, by: H * 0.56, color: '#b07cff' },
      { id: 'ras', label: 'RAS 与机密计算', sub: '可靠性 / 加密接口', bx: W * 0.14, by: H * 0.82, color: '#ff6b6b' },
      { id: 'power', label: '功耗与散热', sub: '≈1000 W TGP', bx: W * 0.84, by: H * 0.80, color: '#d98a4b' },
    ];
    this.callouts = [];
    for (const d of defs) {
      const leader = new Leader(this.callLayer, { label: d.label, sub: d.sub, color: d.color, side: d.bx > W * 0.5 ? -1 : 1 });
      this.callouts.push({ leader, ...d, ax: W * 0.5, ay: H * 0.5 });
    }

    // 三类负载面板
    const ly = H * 0.20;
    this.loadTitle = el('text', { x: W * 0.545, y: ly - 16, class: 't-hi' }, this.loadLayer);
    this.loadTitle.textContent = '三类负载 · 动态演示';
    this.loadCards = [];
    const modes = [
      { id: 'train', name: '训练', color: '#46d8ff', fmtNote: '格式随全页精度' },
      { id: 'infer', name: '推理', color: '#6ef2a0', fmtNote: '格式随全页精度（FP4 优先）' },
      { id: 'sci', name: '科学计算', color: '#b07cff', fmtNote: '本类负载采用 FP64（单独标明）' },
    ];
    for (let i = 0; i < modes.length; i++) {
      const y = ly + i * 126;
      const card = el('rect', {
        x: W * 0.545, y, width: W * 0.28, height: 112, rx: 10,
        fill: 'rgba(10,16,28,0.55)', stroke: modes[i].color, 'stroke-width': 1.3,
        class: 'hit', style: 'cursor:pointer',
      }, this.loadLayer);
      card.addEventListener('click', () => store.set('workloadMode', modes[i].id, 'workload'));
      const name = el('text', { x: W * 0.545 + 16, y: y + 26, class: 't-hi', fill: modes[i].color }, this.loadLayer);
      name.textContent = modes[i].name;
      // 过程小动画：方块阵列
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 10; c++) {
          const rect = el('rect', {
            x: W * 0.545 + 16 + c * 24, y: y + 40 + r * 15, width: 18, height: 11, rx: 2,
            fill: 'rgba(120,160,210,0.12)',
          }, this.loadLayer);
          cells.push({ rect, r, c });
        }
      }
      const read = el('text', { x: W * 0.545 + 16, y: y + 104, class: 't-dim' }, this.loadLayer);
      this.loadCards.push({ card, name, cells, read, mode: modes[i] });
    }

    // 结尾汇聚：点阵从四周汇聚回中心（呼应开场）
    this.endDots = [];
    const ex = W * 0.26, ey = H * 0.42;
    this.endLabel = el('text', { x: ex, y: ey + 160, class: 't-label', 'text-anchor': 'middle' }, this.endLayer);
    this.endLabel.textContent = '回到整颗 GPU · 前面所见全部落回封装之上';
    for (let i = 0; i < 120; i++) {
      const ang = (i / 120) * Math.PI * 2;
      const rad = 130 + (i % 7) * 18;
      const d = el('circle', {
        cx: ex + Math.cos(ang) * rad, cy: ey + Math.sin(ang) * rad * 0.72,
        r: 2, fill: i % 2 ? '#46d8ff' : '#d98a4b', opacity: 0.5,
      }, this.endLayer);
      this.endDots.push({ node: d, ang, rad, seed: Math.random() });
    }
  }

  update(p, time) {
    const t08 = chapterLocal('ch08', p);
    const vis = smooth(map(t08, 0, 0.06));
    this.g.setAttribute('opacity', vis);

    // 标注展开（生长）：锚点实时跟随三维结构与自转，背向时淡出
    const proj = (window.__scene && window.__scene.projectAnchors) ? window.__scene.projectAnchors() : null;
    for (let i = 0; i < this.callouts.length; i++) {
      const c = this.callouts[i];
      const t = smooth(map(t08, 0.06 + i * 0.045, 0.3 + i * 0.045));
      if (proj && proj[c.id]) {
        const a = proj[c.id];
        c.ax = a.x; c.ay = a.y;
        // 遮挡：朝向相机的面才显示；标注框端点固定在设计位
        const occ = a.visible ? smooth(map(a.facing, -0.25, 0.15)) : 0;
        c.leader.update(c.ax, c.ay, c.bx, c.by, t * vis * (0.18 + occ * 0.82));
      } else {
        c.leader.update(c.ax, c.ay, c.bx, c.by, t * vis);
      }
    }

    // 负载动画
    for (let i = 0; i < this.loadCards.length; i++) {
      const card = this.loadCards[i];
      const active = store.workloadMode === card.mode.id;
      card.card.setAttribute('stroke-width', active ? 2.2 : 1.2);
      card.card.setAttribute('fill', active ? 'rgba(70,216,255,0.10)' : 'rgba(10,16,28,0.55)');
      for (const cell of card.cells) {
        let v;
        if (card.mode.id === 'train') {
          v = (cell.r + cell.c + Math.floor(time * 1.6)) % 5;
        } else if (card.mode.id === 'infer') {
          v = (cell.c + Math.floor(time * 2.4)) % 6 < 2 ? 4 : 1;
        } else {
          v = Math.abs(Math.sin(cell.c * 0.7 + cell.r * 1.3 + time * 0.9)) * 4;
        }
        const alpha = 0.1 + (v / 5) * 0.65;
        cell.rect.setAttribute('fill', active
          ? `rgba(${card.mode.color === '#46d8ff' ? '70,216,255' : card.mode.color === '#6ef2a0' ? '110,242,160' : '157,123,255'},${alpha.toFixed(2)})`
          : `rgba(120,160,210,${(alpha * 0.5).toFixed(2)})`);
      }
      const fmt = store.precision;
      const wl = workload();
      const peaks = GPU_PEAK[fmt] || GPU_PEAK.FP4;
      const rate = (peaks.dense * (card.mode.id === 'infer' ? 1.25 : 1)).toFixed(2);
      const effFmt = card.mode.id === 'sci' ? 'FP64' : fmt;
      card.read.textContent = active
        ? `${card.mode.fmtNote} · 工作量 ${fmtNum(wl.elements * (i + 1))} OP（示意） · 演示速率 ${rate} ${card.mode.id === 'sci' ? 'TFLOPS' : peaks.unit} · 官方峰值另计`
        : `${card.mode.name} · ${card.mode.fmtNote} · 当前格式 ${effFmt}`;
    }

    // 结尾汇聚
    const conv = smooth(map(t08, 0.45, 0.9));
    const ex = this.W * 0.26, ey = this.H * 0.42;
    for (const d of this.endDots) {
      const targetR = 40 + (d.seed * 30);
      const r = lerp(d.rad, targetR, conv);
      d.node.setAttribute('cx', (ex + Math.cos(d.ang + time * 0.08) * r).toFixed(1));
      d.node.setAttribute('cy', (ey + Math.sin(d.ang + time * 0.08) * r * 0.72).toFixed(1));
      d.node.setAttribute('opacity', (0.25 + conv * 0.55).toFixed(2));
    }
    this.endLayer.setAttribute('opacity', smooth(map(t08, 0.3, 0.55)));
    this.loadLayer.setAttribute('opacity', smooth(map(t08, 0.08, 0.2)) * (1 - smooth(map(t08, 0.86, 1)) * 0.45));
    this.callLayer.setAttribute('opacity', smooth(map(t08, 0.05, 0.2)));
  }
}

export { PRODUCTS };
