// ============================================================
// 章节 SVG 动态图形 A（01–04）
// 规模重组 / 分层线稿 / 激活图 / 堆栈侧视与数据流
// ============================================================
import { el, clear, group, PathPulses, Leader, bitCells, tickScale, fmtNum, linePath, rectPath, smoothPath } from './runtime.js';
import { segT, map, smooth, clamp01, lerp, chapterLocal } from '../timeline.js';
import { store, FACTS, workload } from '../state.js';

// ------------------------------------------------------------
// 01 完整封装：晶体管规模 ↔ 晶粒单元 图形重组
// ------------------------------------------------------------
export class SvgCh01 {
  constructor(root) {
    this.g = group(root, 'svg-ch01');
    this.dotLayer = group(this.g, 'dots');
    this.ringLayer = group(this.g, 'rings');
    this.readoutLayer = group(this.g, 'readouts');
    this.dots = [];
    this.rings = [];
    this.built = false;
    this.W = 0; this.H = 0;
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.dotLayer); clear(this.ringLayer); clear(this.readoutLayer);
    this.dots = [];
    // 晶体管点阵（抽象规模）→ 重组成两个晶粒轮廓
    const cx = W * 0.62, cy = H * 0.52;
    const cols = 44, rows = 26;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = cx - 320 + c * 15;
        const y0 = cy - 180 + r * 14.5;
        // 目标：两个晶粒矩形
        const dieIndex = c < cols / 2 ? 0 : 1;
        const lx = dieIndex === 0 ? cx - 168 : cx + 24;
        const tx = lx + ((c % (cols / 2)) / (cols / 2 - 1)) * 144;
        const ty = cy - 150 + (r / (rows - 1)) * 300;
        const dot = el('circle', {
          cx: x0, cy: y0, r: 1.7,
          fill: dieIndex ? '#46d8ff' : '#d98a4b',
          opacity: 0.28,
        }, this.dotLayer);
        this.dots.push({ node: dot, x0, y0, tx, ty, dieIndex, seed: Math.random() });
      }
    }
    // 晶粒双环（部件识别）
    for (let i = 0; i < 2; i++) {
      const rx = cx + (i ? 96 : -96);
      const rect = el('rect', {
        x: rx - 78, y: cy - 156, width: 156, height: 312,
        rx: 10, fill: 'none',
        stroke: i ? '#46d8ff' : '#d98a4b',
        'stroke-width': 1.6, opacity: 0.0,
      }, this.ringLayer);
      this.rings.push(rect);
    }
    // 中央 NV-HBI 联结环
    this.unionRing = el('rect', {
      x: cx - 178, y: cy - 166, width: 356, height: 332,
      rx: 16, fill: 'none', stroke: '#9bebff',
      'stroke-width': 2, opacity: 0,
    }, this.ringLayer);

    // 读数
    const rx0 = W * 0.60, ry0 = H * 0.12;
    this.numLabel = el('text', { x: rx0, y: ry0, class: 't-dim' }, this.readoutLayer);
    this.numLabel.textContent = 'TRANSISTORS · 晶体管';
    this.bigNum = el('text', { x: rx0, y: ry0 + 52, class: 't-big', 'font-size': 44 }, this.readoutLayer);
    this.bigNum.textContent = '0';
    this.subNum = el('text', { x: rx0, y: ry0 + 80, class: 't-label' }, this.readoutLayer);
    this.subNum.textContent = '两颗计算晶粒 · 一颗 GPU';

    this.statA = el('text', { x: rx0, y: ry0 + 128, class: 't-label' }, this.readoutLayer);
    this.statB = el('text', { x: rx0, y: ry0 + 152, class: 't-label' }, this.readoutLayer);
    this.statC = el('text', { x: rx0, y: ry0 + 176, class: 't-label' }, this.readoutLayer);
    this.statA.textContent = '片间互连  NV-HBI  10 TB/s';
    this.statB.textContent = 'HBM3e 堆栈  8 × 分层结构';
    this.statC.textContent = '第五代 NVLink  1.8 TB/s / GPU';
    this.built = true;
  }

  update(p, time) {
    if (!this.built) return;
    const t01 = chapterLocal('ch01', p);
    // 点阵重组进度（开场 0→1）
    const morph = smooth(clamp01(t01 * 1.8 + Math.min(0.25, time * 0.06)));
    for (let i = 0; i < this.dots.length; i++) {
      const d = this.dots[i];
      const x = lerp(d.x0, d.tx, morph);
      const y = lerp(d.y0, d.ty, morph);
      d.node.setAttribute('cx', x.toFixed(1));
      d.node.setAttribute('cy', y.toFixed(1));
      const flick = 0.5 + 0.5 * Math.sin(time * 1.2 + d.seed * 20);
      d.node.setAttribute('opacity', (0.16 + morph * 0.42 + flick * 0.12).toFixed(2));
    }
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].setAttribute('opacity', (morph * 0.85).toFixed(2));
    }
    this.unionRing.setAttribute('opacity', (smooth(map(morph, 0.55, 1, 0, 1)) * 0.9).toFixed(2));

    // 数字滚动到 208 亿（开场动画随 time 展开，滚动可随时接管）
    const intro = Math.min(1, time * 0.22);
    const n = 208e9 * smooth(clamp01(t01 * 1.6 + intro * 1.35));
    this.bigNum.textContent = (n / 1e8).toFixed(n > 1.9e10 ? 0 : 1) + ' 亿';
    const vis = smooth(clamp01(t01 * 3 + intro)) * smooth(map(t01, 0.85, 1, 1, 0.25));
    this.readoutLayer.setAttribute('opacity', vis.toFixed(2));
    this.dotLayer.setAttribute('opacity', smooth(map(t01, 0.92, 1, 1, 0.55)));
  }
}

// ------------------------------------------------------------
// 02 封装拆解：与三维同步的分层线稿 + 引线标注 + 二维剖面
// ------------------------------------------------------------
export class SvgCh02 {
  constructor(root) {
    this.g = group(root, 'svg-ch02');
    this.lineLayer = group(this.g, 'lines');
    this.leadLayer = group(this.g, 'leaders');
    this.sectLayer = group(this.g, 'section');
    this.W = 0; this.H = 0;
    this.leaders = [];
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.lineLayer); clear(this.leadLayer); clear(this.sectLayer);
    this.leaders = [];

    const cx = W * 0.30, cy = H * 0.52;
    this.cx = cx; this.cy = cy;

    // 分层线稿（与 3D 爆炸同构：lid / dies+HBM / interposer / substrate / balls）
    this.layerDefs = [
      { id: 'lid', label: '盖板 / 加固框架', sub: 'stiffener + lid', color: '#8fb8e8', y: -190, w: 300, h: 26 },
      { id: 'dies', label: '两颗计算晶粒', sub: '2 × reticle-limit die', color: '#46d8ff', y: -110, w: 240, h: 34 },
      { id: 'hbm', label: '8 × HBM3e 堆栈', sub: 'base + 8 DRAM', color: '#6ef2a0', y: -40, w: 320, h: 30 },
      { id: 'ip', label: '硅中介层', sub: 'interposer / 走线', color: '#d98a4b', y: 30, w: 330, h: 18 },
      { id: 'sub', label: '有机基板（分层铜走线）', sub: 'substrate', color: '#b07cff', y: 92, w: 360, h: 30 },
      { id: 'balls', label: 'BGA 焊球阵列', sub: 'solder balls', color: '#9aa8ba', y: 150, w: 340, h: 14 },
    ];
    this.layerNodes = [];
    for (const ld of this.layerDefs) {
      const node = group(this.lineLayer, 'ly-' + ld.id);
      el('rect', {
        x: cx - ld.w / 2, y: cy + ld.y, width: ld.w, height: ld.h, rx: 4,
        fill: 'rgba(120,170,230,0.05)', stroke: ld.color, 'stroke-width': 1.6,
      }, node);
      // 内部细节线
      for (let i = 0; i < 6; i++) {
        el('line', {
          x1: cx - ld.w / 2 + 10 + i * (ld.w - 20) / 6,
          y1: cy + ld.y + 5, x2: cx - ld.w / 2 + 10 + i * (ld.w - 20) / 6,
          y2: cy + ld.y + ld.h - 5,
          stroke: ld.color, 'stroke-width': 0.7, opacity: 0.4,
        }, node);
      }
      // HBM 层次细线
      if (ld.id === 'hbm' || ld.id === 'sub') {
        for (let i = 1; i < 4; i++) {
          el('line', {
            x1: cx - ld.w / 2 + 4, y1: cy + ld.y + i * ld.h / 4,
            x2: cx + ld.w / 2 - 4, y2: cy + ld.y + i * ld.h / 4,
            stroke: ld.color, 'stroke-width': 0.7, opacity: 0.45,
          }, node);
        }
      }
      this.layerNodes.push({ ...ld, node });

      // 引线
      const leader = new Leader(this.leadLayer, { label: ld.label, sub: ld.sub, color: ld.color, side: 1 });
      this.leaders.push({ leader, ld });
    }

    // 二维剖面（右侧，随 cutaway 更新）
    const sx = W * 0.72, sy = H * 0.30;
    this.sectTitle = el('text', { x: sx, y: sy - 18, class: 't-hi' }, this.sectLayer);
    this.sectTitle.textContent = '二维剖面 · 同步剖切位置';
    this.sectFrame = el('rect', {
      x: sx, y: sy, width: 300, height: 300, rx: 8,
      fill: 'rgba(10,16,28,0.55)', stroke: 'rgba(130,175,230,0.28)', 'stroke-width': 1,
    }, this.sectLayer);
    // 剖面材料层
    this.sectMats = [];
    const mats = [
      { name: '盖板 Ni-Cu', h: 22, color: '#8fb8e8' },
      { name: 'TIM 导热层', h: 12, color: '#5c6a7c' },
      { name: '晶粒硅', h: 34, color: '#46d8ff' },
      { name: '微凸点 µbump', h: 16, color: '#d8a860' },
      { name: '硅中介层', h: 20, color: '#d98a4b' },
      { name: '基板铜层 ×4', h: 56, color: '#b07cff' },
      { name: 'BGA 焊球', h: 26, color: '#9aa8ba' },
    ];
    let yy = sy + 14;
    for (const m of mats) {
      const r = el('rect', {
        x: sx + 16, y: yy, width: 268, height: m.h, rx: 2,
        fill: m.color, opacity: 0.22, stroke: m.color, 'stroke-width': 1,
      }, this.sectLayer);
      const t = el('text', { x: sx + 26, y: yy + m.h / 2 + 4, class: 't-dim' }, this.sectLayer);
      t.textContent = m.name;
      this.sectMats.push({ rect: r, text: t, y0: yy, h: m.h });
      yy += m.h + 6;
    }
    // 剖切指示线
    this.cutLine = el('line', {
      x1: sx + 8, y1: sy + 150, x2: sx + 292, y2: sy + 150,
      stroke: '#ff6b6b', 'stroke-width': 1.5, 'stroke-dasharray': '5 4',
    }, this.sectLayer);
    this.cutLabel = el('text', { x: sx + 8, y: sy + 144, class: 't-dim', fill: '#ff6b6b' }, this.sectLayer);
    this.cutLabel.textContent = '剖切面 Z';
  }

  update(p, time) {
    const t02 = chapterLocal('ch02', p);
    const e = store._effExplode != null ? store._effExplode : smooth(map(t02, 0.02, 0.75, 0, 1));
    const vis = smooth(map(t02, 0.0, 0.12)) * smooth(map(t02, 0.88, 1, 1, 0.15));
    this.lineLayer.setAttribute('opacity', vis);
    this.leadLayer.setAttribute('opacity', vis);

    for (let i = 0; i < this.layerNodes.length; i++) {
      const L = this.layerNodes[i];
      // 与 3D 同步：展开偏移
      const spread = (i - 2.5) * e * 34;
      L.node.setAttribute('transform', `translate(0, ${-spread.toFixed(1)})`);
      // 选中部件 → 分层线稿同步高亮
      const sel = store.selectedPart || '';
      const hit =
        (L.id === 'lid' && sel === 'lid') ||
        (L.id === 'dies' && (sel === 'dieA' || sel === 'dieB' || sel === 'bridge')) ||
        (L.id === 'hbm' && sel.startsWith('hbm')) ||
        (L.id === 'ip' && sel === 'interposer') ||
        (L.id === 'sub' && (sel === 'substrate' || sel === 'caps')) ||
        (L.id === 'balls' && sel === 'balls');
      L.node.setAttribute('opacity', hit ? 1 : 0.86);
      for (const child of L.node.children) {
        if (child.setAttribute) {
          child.setAttribute('stroke-width', hit ? 2.6 : (child.tagName === 'rect' ? 1.6 : 0.7));
        }
      }
      // 引线生长
      const { leader, ld } = this.leaders[i];
      const ax = this.cx + ld.w / 2;
      const ay = this.cy + ld.y + ld.h / 2 - spread;
      const bx = this.cx + 220 + (i % 2) * 36;
      const by = this.cy + ld.y - spread;
      leader.update(ax, ay, bx, by, smooth(map(e, 0.12 + i * 0.05, 0.32 + i * 0.05)) * vis * (hit ? 1.35 : 1));
    }

    // 剖面联动
    const cut = store.cutaway || 0;
    this.sectLayer.setAttribute('opacity', smooth(map(t02, 0.35, 0.5)) * (1 - smooth(map(t02, 0.95, 1)) * 0.6));
    const ly = this.sectMats[0].y0 + cut * 280;
    this.cutLine.setAttribute('y1', ly);
    this.cutLine.setAttribute('y2', ly);
    this.cutLabel.setAttribute('y', ly - 6);
    for (const m of this.sectMats) {
      const near = 1 - Math.min(1, Math.abs(m.y0 + m.h / 2 - ly) / 90);
      m.rect.setAttribute('opacity', 0.18 + near * 0.35);
    }
  }
}

// ------------------------------------------------------------
// 03 双晶粒：二维版图激活 + 跨缝数据 + “双晶粒一颗 GPU”
// ------------------------------------------------------------
export class SvgCh03 {
  constructor(root) {
    this.g = group(root, 'svg-ch03');
    this.floorLayer = group(this.g, 'floorplan');
    this.actLayer = group(this.g, 'activation');
    this.seamLayer = group(this.g, 'seam');
    this.glyphLayer = group(this.g, 'glyph');
    this.W = 0; this.H = 0;
    this.zones = [];
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.floorLayer); clear(this.actLayer); clear(this.seamLayer); clear(this.glyphLayer);
    this.zones = [];

    const fx = W * 0.06, fy = H * 0.26, fw = W * 0.46, fh = H * 0.46;
    this.fx = fx; this.fy = fy; this.fw = fw; this.fh = fh;

    // 双晶粒版图外框
    el('rect', {
      x: fx, y: fy, width: fw, height: fh, rx: 10,
      fill: 'rgba(10,16,28,0.5)', stroke: 'rgba(130,175,230,0.3)',
    }, this.floorLayer);
    const mid = fx + fw / 2;
    // 两颗晶粒
    for (let d = 0; d < 2; d++) {
      const x0 = d ? mid + 6 : fx + 6;
      const w = fw / 2 - 12;
      el('rect', {
        x: x0, y: fy + 8, width: w, height: fh - 16, rx: 6,
        fill: 'rgba(70,216,255,0.04)', stroke: d ? '#46d8ff' : '#d98a4b', 'stroke-width': 1.4,
      }, this.floorLayer);
      const t = el('text', { x: x0 + 12, y: fy + 28, class: 't-hi' }, this.floorLayer);
      t.textContent = d ? 'DIE B' : 'DIE A';
      t.setAttribute('fill', d ? '#46d8ff' : '#ffc089');
    }

    // 功能区（可点选）
    const zoneDefs = [
      { zid: 'tensor', label: 'Tensor Core 阵列', die: 0, u: 0.5, v: 0.32, w: 0.78, h: 0.30 },
      { zid: 'l2', label: 'L2 缓存', die: 0, u: 0.5, v: 0.62, w: 0.78, h: 0.12 },
      { zid: 'hbmphy', label: 'HBM PHY', die: 0, u: 0.5, v: 0.82, w: 0.78, h: 0.10 },
      { zid: 'nvlink', label: 'NVLink PHY', die: 0, u: 0.12, v: 0.5, w: 0.12, h: 0.52 },
      { zid: 'd2d', label: '片间互连 D2D', die: 0, u: 0.88, v: 0.5, w: 0.10, h: 0.52 },
      { zid: 'tensor', label: 'Tensor Core 阵列', die: 1, u: 0.5, v: 0.32, w: 0.78, h: 0.30 },
      { zid: 'l2', label: 'L2 缓存', die: 1, u: 0.5, v: 0.62, w: 0.78, h: 0.12 },
      { zid: 'hbmphy', label: 'HBM PHY', die: 1, u: 0.5, v: 0.82, w: 0.78, h: 0.10 },
      { zid: 'nvlink', label: 'NVLink PHY', die: 1, u: 0.88, v: 0.5, w: 0.12, h: 0.52 },
      { zid: 'd2d', label: '片间互连 D2D', die: 1, u: 0.12, v: 0.5, w: 0.10, h: 0.52 },
    ];
    for (const zd of zoneDefs) {
      const dw = fw / 2 - 12;
      const x0 = (zd.die ? mid + 6 : fx + 6) + zd.u * dw - zd.w * dw / 2;
      const y0 = fy + 8 + zd.v * (fh - 16) - zd.h * (fh - 16) / 2;
      const rect = el('rect', {
        x: x0, y: y0, width: zd.w * dw, height: zd.h * (fh - 16), rx: 3,
        fill: 'rgba(70,216,255,0.10)', stroke: 'rgba(70,216,255,0.35)', 'stroke-width': 1,
        class: 'hit', style: 'cursor:pointer',
      }, this.actLayer);
      rect.addEventListener('click', () => {
        store.set('selectedZone', zd.zid === store.selectedZone ? null : zd.zid, 'zone');
      });
      rect.addEventListener('mouseenter', () => rect.setAttribute('stroke', '#9bebff'));
      rect.addEventListener('mouseleave', () => rect.setAttribute('stroke', 'rgba(70,216,255,0.35)'));
      const zl = el('text', { x: x0 + 6, y: y0 + 14, class: 't-dim' }, this.actLayer);
      zl.textContent = zd.label;
      this.zones.push({ ...zd, rect, label2: zl, x0, y0, wPx: zd.w * dw, hPx: zd.h * (fh - 16) });
    }

    // 跨缝数据带
    this.seamPath = el('path', {
      d: `M ${mid - 40} ${fy + fh * 0.45} C ${mid - 12} ${fy + fh * 0.3}, ${mid + 12} ${fy + fh * 0.6}, ${mid + 40} ${fy + fh * 0.45}`,
      stroke: '#9bebff', 'stroke-width': 2, fill: 'none', class: 'flow',
    }, this.seamLayer);
    this.seamPulses = new PathPulses(this.seamLayer, {
      d: this.seamPath.getAttribute('d'), stroke: '#9bebff', 'stroke-width': 2, fill: 'none',
    }, 7, { speed: 0.22, color: '#9bebff', size: 3.6 });

    this.seamLabel = el('text', { x: mid - 60, y: fy + fh * 0.45 - 18, class: 't-hi' }, this.seamLayer);
    this.seamLabel.textContent = 'NV-HBI  10 TB/s';
    this.seamSub = el('text', { x: mid - 60, y: fy + fh * 0.45 + 26, class: 't-dim' }, this.seamLayer);
    this.seamSub.textContent = '两颗晶粒 · 一颗 GPU';

    // “双晶粒一颗 GPU”关系字形：两个半圆合拢
    const gx = W * 0.78, gy = H * 0.54;
    this.gLeft = el('path', {
      d: `M ${gx} ${gy - 70} A 70 70 0 0 0 ${gx} ${gy + 70}`,
      stroke: '#d98a4b', 'stroke-width': 2.2, fill: 'rgba(217,138,75,0.08)',
    }, this.glyphLayer);
    this.gRight = el('path', {
      d: `M ${gx} ${gy - 70} A 70 70 0 0 1 ${gx} ${gy + 70}`,
      stroke: '#46d8ff', 'stroke-width': 2.2, fill: 'rgba(70,216,255,0.08)',
    }, this.glyphLayer);
    this.gText = el('text', { x: gx, y: gy + 6, 'text-anchor': 'middle', class: 't-big' }, this.glyphLayer);
    this.gText.textContent = 'GPU';
    this.gText2 = el('text', { x: gx, y: gy + 108, 'text-anchor': 'middle', class: 't-label' }, this.glyphLayer);
    this.gText2.textContent = 'ONE GPU · TWO DIES';

    // 2D 激活缩略图（右侧小图）
    this.thumbTitle = el('text', { x: gx - 60, y: gy - 108, class: 't-dim' }, this.glyphLayer);
    this.thumbTitle.textContent = '激活缩略图 · 与三维联动';
    this.thumbCells = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const rect = el('rect', {
          x: gx - 60 + c * 15, y: gy - 96 + r * 11, width: 12, height: 9, rx: 1.5,
          fill: 'rgba(70,216,255,0.12)',
        }, this.glyphLayer);
        this.thumbCells.push({ rect, r, c });
      }
    }
  }

  update(p, time) {
    const t03 = chapterLocal('ch03', p);
    const vis = smooth(map(t03, 0, 0.1)) * smooth(map(t03, 0.9, 1, 1, 0.12));
    this.g.setAttribute('opacity', vis);

    // 激活动画
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      const phase = time * 1.1 + i * 0.7 + z.zid.length;
      const act = 0.5 + 0.5 * Math.sin(phase);
      const selected = store.selectedZone === z.zid;
      z.rect.setAttribute('fill', selected
        ? 'rgba(255,180,84,0.30)'
        : `rgba(70,216,255,${(0.06 + act * 0.16).toFixed(3)})`);
      if (selected) z.rect.setAttribute('stroke', '#ffb454');
      else z.rect.setAttribute('stroke', 'rgba(70,216,255,0.35)');
    }

    // 缩略图热力
    for (let i = 0; i < this.thumbCells.length; i++) {
      const c = this.thumbCells[i];
      const zoneBoost = store.selectedZone ? 1.6 : 1;
      const v = (0.5 + 0.5 * Math.sin(time * 1.3 + c.r * 0.9 + c.c * 0.5)) * zoneBoost;
      c.rect.setAttribute('fill', `rgba(70,216,255,${(0.08 + v * 0.42).toFixed(3)})`);
    }

    // 跨缝脉冲（接缝拉距时停止）
    const gap = store.dieSeamGap || 0;
    const flowVis = (1 - smooth(map(gap, 0.25, 0.5))) * vis;
    this.seamPulses.update(time, flowVis);
    this.seamLabel.setAttribute('opacity', 0.5 + flowVis * 0.5);

    // 合拢字形随进度/接缝
    const join = (1 - gap) * smooth(map(t03, 0.1, 0.5));
    const sep = (1 - join) * 36;
    this.gLeft.setAttribute('transform', `translate(${-sep}, 0)`);
    this.gRight.setAttribute('transform', `translate(${sep}, 0)`);
  }
}

// ------------------------------------------------------------
// 04 显存：堆栈侧视 + TSV + 八路数据流 + 数据驱动字形变形
// ------------------------------------------------------------
export class SvgCh04 {
  constructor(root) {
    this.g = group(root, 'svg-ch04');
    this.stackLayer = group(this.g, 'stacks');
    this.flowLayer = group(this.g, 'flows');
    this.glyphLayer = group(this.g, 'glyph');
    this.W = 0; this.H = 0;
  }

  layout(W, H) {
    this.W = W; this.H = H;
    clear(this.stackLayer); clear(this.flowLayer); clear(this.glyphLayer);

    // 侧视线稿衬底
    el('rect', {
      x: W * 0.04, y: H * 0.555, width: W * 0.92, height: H * 0.185,
      rx: 14, fill: 'rgba(8,13,22,0.66)', stroke: 'rgba(130,175,230,0.14)',
    }, this.stackLayer);
    el('rect', {
      x: W * 0.545, y: H * 0.095, width: W * 0.30, height: H * 0.09,
      rx: 10, fill: 'rgba(8,13,22,0.66)', stroke: 'rgba(130,175,230,0.14)',
    }, this.stackLayer);

    // 侧视线稿：8 个堆栈横排（可点选）
    const y0 = H * 0.62;
    this.stackNodes = [];
    for (let s = 0; s < 8; s++) {
      const x = W * 0.10 + s * W * 0.10;
      const g = group(this.stackLayer, 'stack' + s);
      g.setAttribute('class', 'hit');
      g.setAttribute('style', 'cursor:pointer');
      g.addEventListener('click', () => {
        const id = 'hbm' + s;
        store.set('selectedPart', store.selectedPart === id ? null : id, 'select');
      });
      // 基底
      el('rect', {
        x: x - 26, y: y0 + 64, width: 52, height: 18, rx: 3,
        fill: 'rgba(180,200,230,0.12)', stroke: '#8fb8e8', 'stroke-width': 1.3,
      }, g);
      const layers = [];
      for (let L = 0; L < 8; L++) {
        const r = el('rect', {
          x: x - 24, y: y0 + 52 - L * 12, width: 48, height: 10, rx: 2,
          fill: `rgba(70,216,255,${0.10 + L * 0.02})`, stroke: '#46d8ff', 'stroke-width': 1,
        }, g);
        layers.push(r);
        // TSV 点
        for (let k = 0; k < 4; k++) {
          el('circle', {
            cx: x - 15 + k * 10, cy: y0 + 57 - L * 12, r: 1.5,
            fill: '#d8a860', opacity: 0.8,
          }, g);
        }
      }
      const label = el('text', { x, y: y0 + 100, 'text-anchor': 'middle', class: 't-dim' }, g);
      label.textContent = 'S' + (s + 1);
      this.stackNodes.push({ g, layers, x, label });
    }

    // 标题
    this.title = el('text', { x: W * 0.10, y: y0 - 118, class: 't-hi' }, this.stackLayer);
    this.title.textContent = 'HBM3e 堆栈 · 侧视线稿（基底 + 8 层 DRAM · 微凸点 · TSV）';

    // 八路数据流（从堆栈 → 中央计算区）
    const cx = W * 0.5, cy = H * 0.34;
    this.flows = [];
    for (let s = 0; s < 8; s++) {
      const x = W * 0.10 + s * W * 0.10;
      const d = `M ${x} ${y0 + 40} C ${x} ${y0 - 40}, ${cx + (s - 3.5) * 30} ${cy + 60}, ${cx} ${cy}`;
      const pulses = new PathPulses(this.flowLayer, { d, stroke: '#46d8ff', 'stroke-width': 1.6, fill: 'none' }, 4, {
        speed: 0.16 + s * 0.008, color: s % 2 ? '#6ef2a0' : '#46d8ff', size: 3,
      });
      this.flows.push(pulses);
    }

    // 计算区（中央）
    el('rect', {
      x: cx - 70, y: cy - 34, width: 140, height: 68, rx: 8,
      fill: 'rgba(70,216,255,0.08)', stroke: '#9bebff', 'stroke-width': 1.6,
    }, this.flowLayer);
    this.coreLabel = el('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', class: 't-hi' }, this.flowLayer);
    this.coreLabel.textContent = '计算区 · 激活';
    this.coreResult = el('text', { x: cx, y: cy + 24, 'text-anchor': 'middle', class: 't-dim' }, this.flowLayer);

    // 数据驱动字形变形：“HBM” 轮廓随带宽读数形变
    const gx = W * 0.72, gy = H * 0.30;
    this.glyphText = el('text', {
      x: gx, y: gy, class: 't-big', 'font-size': 64,
      fill: 'rgba(70,216,255,0.85)', 'letter-spacing': '0.12em',
    }, this.glyphLayer);
    this.glyphText.textContent = 'HBM';
    this.glyphOutline = el('path', {
      d: '', stroke: '#ffb454', 'stroke-width': 1.4, fill: 'none', opacity: 0.7,
    }, this.glyphLayer);
    this.glyphSub = el('text', { x: gx, y: gy + 40, class: 't-label' }, this.glyphLayer);
    this.glyphSub.textContent = '带宽字形 · 随数据密度形变';

    // 读数
    this.bwLabel = el('text', { x: W * 0.555, y: H * 0.115, class: 't-big', 'font-size': 24 }, this.stackLayer);
    this.capLabel = el('text', { x: W * 0.555, y: H * 0.115 + 26, class: 't-label' }, this.stackLayer);
    this.batchLabel = el('text', { x: W * 0.555, y: H * 0.115 + 50, class: 't-label' }, this.stackLayer);
  }

  update(p, time) {
    const t04 = chapterLocal('ch04', p);
    const vis = smooth(map(t04, 0, 0.08)) * smooth(map(t04, 0.92, 1, 1, 0.15));
    this.g.setAttribute('opacity', vis);

    // 横向段：内容随滚动横向平移（进入/离开与前后章节运动方向连续衔接）
    const pan = lerp(0.22, -0.22, smooth(t04)) * this.W;
    this.stackLayer.setAttribute('transform', `translate(${pan.toFixed(1)}, 0)`);
    this.flowLayer.setAttribute('transform', `translate(${(pan * 0.55).toFixed(1)}, 0)`);

    // 堆栈分层展开
    const expand = smooth(map(t04, 0.12, 0.5)) * (1 - store.dieSeamGap * 0.3);
    for (const s of this.stackNodes) {
      const selected = store.selectedPart === 'hbm' + this.stackNodes.indexOf(s);
      for (let L = 0; L < s.layers.length; L++) {
        s.layers[L].setAttribute('y', (this.H * 0.62 + 52 - L * 12) - expand * (L * (selected ? 6.4 : 4.2)));
        s.layers[L].setAttribute('stroke', selected ? '#ffb454' : '#46d8ff');
      }
    }

    // 八路数据流
    for (const f of this.flows) f.update(time, vis * (0.5 + expand * 0.5));

    // 数据驱动的字形形变：用工作负载读数扰动轮廓
    const wl = workload();
    const density = clamp01(wl.bytesGB / 400);
    const wob = 6 + density * 26;
    const gx = this.W * 0.72, gy = this.H * 0.30;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const x = gx - 120 + t * 240;
      const y = gy - 70 + Math.sin(t * Math.PI * 2 + time * 1.1) * wob
        + Math.sin(t * Math.PI * 5 - time * 0.7) * wob * 0.35;
      pts.push([x, y]);
    }
    this.glyphOutline.setAttribute('d', smoothPath(pts));
    this.glyphText.setAttribute('transform', `translate(0, ${(Math.sin(time * 0.9) * density * 8).toFixed(2)})`);

    // 读数
    const fmt = store.precision;
    this.bwLabel.textContent = `8 TB/s × 8 堆栈 = 64 TB/s 聚合`;
    this.capLabel.textContent = `容量 ${FACTS.hbm3eCapacity} GB / 卡 · 当前精度 ${fmt} · 值宽 ${store.precisionDef.bits} bit`;
    this.batchLabel.textContent = `传输批次：${fmt === 'FP4' ? '16 值 / 块（共享 E4M3 缩放）' : fmt === 'FP8' ? '单字节 / 值' : store.precisionDef.bytes + ' B / 值'}`;
    this.coreResult.textContent = `结果形成中 · ${fmt}`;
  }
}
