// 第 07 章：规格对照。五个产品的三维模型排在表头，下面是同一口径的数字；选择指标时，模型与结构图的对应部位同时反馈。
import * as THREE from 'three';
import { S, A, H, Trace, beat, vis, setText, setHTML } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fmtNum } from '../core/util.js';
import { state, patch, subscribe } from '../core/state.js';
import { PRODUCTS, METRICS, metricValue, SOURCES } from '../data/specs.js';
import { COLS } from '../core/systems-choreo.js';

const METRIC_COL = { compose: '--ink', mem: '--hbm', bw: '--hbm', link: '--nvl', fp4: '--sm', fp8: '--sm', fp16: '--sm', tf32: '--sm', fp64: '--sm', power: '--ras' };
const METRIC_RGB = { compose: [1, 1, 1], mem: [.34, .85, 1], bw: [.34, .85, 1], link: [.83, .53, 1], fp4: [.72, .95, .23], fp8: [.72, .95, .23], fp16: [.72, .95, .23], tf32: [.72, .95, .23], fp64: [.72, .95, .23], power: [1, .42, .28] };
// 结构小图里的部件：不同指标点亮不同部件
const PART_FOR = { compose: ['gpu', 'hbm', 'sw', 'cpu', 'tray'], mem: ['hbm'], bw: ['hbm', 'memlink'], link: ['nvlink', 'sw'], fp4: ['gpu'], fp8: ['gpu'], fp16: ['gpu'], tf32: ['gpu'], fp64: ['gpu'], power: ['power'] };

function fmtVal(prod, m, sparse) {
  if (m === 'compose') return null;
  if (m === 'mem') return { big: `${prod.mem.v.toLocaleString('en-US')} ${prod.mem.u}`, sub: prod.mem.alt || '' };
  if (m === 'bw') return { big: `${prod.bw.v} ${prod.bw.u}`, sub: prod.scope === 'gpu' ? '每颗' : `每 GPU 8 TB/s` };
  if (m === 'link') return { big: `${prod.link.v} ${prod.link.u}`, sub: prod.link.note };
  if (m === 'power') return { big: `${prod.power.v.toLocaleString('en-US')} ${prod.power.u}`, sub: prod.power.note || prod.power.alt || '' };
  if (m === 'fp64') return { big: `${prod.fp64.toLocaleString('en-US')} TF`, sub: prod.scope === 'gpu' ? '单颗 · 无稀疏口径' : `每 GPU ${(prod.fp64 / prod.gpus).toFixed(0)} TF` };
  const v = prod.perf[m];
  const per = v[sparse ? 0 : 1] / prod.gpus;
  return { big: `${v[sparse ? 0 : 1].toLocaleString('en-US')} PF`, sub: prod.scope === 'gpu' ? (prod.perfNote || '单颗') : `每 GPU ${per.toLocaleString('en-US')} PF` };
}

export default {
  from: -.26, to: 1.16,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch07', ctx.chaptersRoot, null, { 'aria-label': '第 07 章 规格对照' });
    this.root = root;
    this.head = H('div', 'c7-head', root, `<div class="over">07 / 对照</div><h2>五种产品，同一颗芯</h2>`);

    // 表格
    const tb = H('div', 'c7-table pe', root, null, { role: 'table', 'aria-label': '五种产品规格对照' });
    this.table = tb;
    const hdr = H('div', 'c7-row c7-hdr', tb, null, { role: 'row' });
    H('div', 'c7-mh', hdr, '<span class="c7-sw"></span>', { role: 'columnheader' });
    this.sparseBtn = H('button', 'chip', hdr.firstChild, '算力口径：稀疏', { type: 'button' });
    this.sparseBtn.addEventListener('click', () => patch({ perfSparse: !state.perfSparse }));
    this.colHead = PRODUCTS.map((p, i) => {
      const b = H('button', 'c7-ph', hdr, `<b>${p.name}</b><span>${p.kind}</span>`, { type: 'button', role: 'columnheader', 'aria-label': `${p.name}：${p.role}` });
      b.addEventListener('click', () => patch({ product: state.product === p.id ? null : p.id }));
      return b;
    });
    this.rows = METRICS.map(m => {
      const r = H('div', 'c7-row', tb, null, { role: 'row' });
      const lab = H('button', 'c7-ml', r, `<b>${m.name}</b>`, { type: 'button', role: 'rowheader' });
      lab.addEventListener('click', () => patch({ metric: state.metric === m.id ? null : m.id }));
      const cells = PRODUCTS.map((p, i) => {
        const c = H('div', 'c7-cell', r, null, { role: 'cell' });
        c.addEventListener('click', () => patch({ product: p.id, metric: m.id }));
        return { c, p };
      });
      return { m, r, lab, cells };
    });
    this.foot = H('div', 'c7-foot', root);
    this.foot.innerHTML = `算力“稀疏 | 稠密”按产品页口径，稠密为稀疏的一半；FP64 / FP32 无稀疏口径。单颗 B200 的两种配置：HGX/DGX 约 1 kW、GB200 约 1.2 kW，容量 180 / 186 GB。物理 8 × 24 GB = 192 GB。来源：${SOURCES.slice(0, 5).map(s => s.t).join('；')}。标 * 的功耗为公开资料常见量级。`;

    // 结构小图（SVG）：放在模型下方，与三维对齐
    const g = S('g', { class: 'c7' }, ctx.ov);
    this.g = g;
    this.icons = PRODUCTS.map((p, i) => this.buildIcon(g, p, i));
    // 3D → 结构图：每个部件一颗点，从模型上起飞，落到结构图的同一部件上
    this.flyG = S('g', { class: 'c7-fly' }, g);
    this.flyDots = [];
    for (let i = 0; i < 64; i++) this.flyDots.push(S('rect', { class: 'c7-fd', width: 7, height: 7 }, this.flyG));
    this.frames = PRODUCTS.map(() => S('polygon', { class: 'c7-frame' }, g));
    this.scopeL = S('text', { class: 'c7-scope', 'text-anchor': 'end' }, g, '单颗 GPU ◂');
    this.scopeR = S('text', { class: 'c7-scope', 'text-anchor': 'start' }, g, '▸ 整套系统的总量（小字为折合每 GPU）');
    // 07 → 08：B200 这一列的数字飞回部件
    this.numG = S('g', { class: 'c7-num' }, g);
    this.nums = [
      { m: 'mem', col: '--hbm', at: [23.4, 4.6, 18.6] }, { m: 'bw', col: '--hbm', at: [23.4, 4.6, 6.2] }, { m: 'link', col: '--nvl', at: [0, 4.6, -23] },
      { m: 'fp4', col: '--sm', at: [-8, 4.6, 14] }, { m: 'power', col: '--ras', at: [-40, 3.2, 28] },
    ].map(n => ({ ...n, t: S('text', { class: 'c7-numt', style: `fill:var(${n.col})` }, this.numG), l: S('path', { class: 'c7-numl', style: `stroke:var(${n.col})` }, this.numG), d: S('circle', { r: 3.2, style: `fill:var(${n.col})` }, this.numG) }));
    subscribe(() => this.sync());
    this.sync();
    this.v = new THREE.Vector3();
  },

  // 五种结构图：同一套部件语言
  buildIcon(parent, p, idx) {
    const g = S('g', { class: 'c7-icon', tabindex: 0, role: 'img', 'aria-label': `${p.name} 结构图` }, parent);
    const parts = { gpu: [], hbm: [], sw: [], cpu: [], nvlink: [], memlink: [], power: [], tray: [] };
    const rect = (x, y, w, h, kind, cls = '') => { const e = S('rect', { x, y, width: w, height: h, class: `ci ci-${kind} ${cls}` }, g); parts[kind].push(e); return e; };
    const line = (d, kind) => { const e = S('path', { d, class: `ci-l ci-${kind}` }, g); parts[kind].push(e); return e; };
    const gpu = (x, y, s = 1) => {
      rect(x, y, 15 * s, 22 * s, 'gpu'); rect(x + 16 * s, y, 15 * s, 22 * s, 'gpu');
      for (let k = 0; k < 4; k++) { rect(x - 5 * s, y + k * 5.8 * s, 4 * s, 4.6 * s, 'hbm'); rect(x + 32 * s, y + k * 5.8 * s, 4 * s, 4.6 * s, 'hbm'); }
    };
    if (p.id === 'b200') {
      gpu(90, 8, 2);
      line('M68 30H50M216 30H234', 'memlink');
      line('M120 -6V4M140 -6V4', 'nvlink');
    } else if (p.id === 'hgx' || p.id === 'dgx') {
      const bx = 34, by = 0, cw = 48;
      for (let i = 0; i < 8; i++) gpu(bx + (i % 4) * cw + 4, by + (i < 4 ? 2 : 44) + (p.id === 'dgx' ? 6 : 0), .9);
      rect(bx + 42, by + 28 + (p.id === 'dgx' ? 6 : 0), 40, 11, 'sw'); rect(bx + 110, by + 28 + (p.id === 'dgx' ? 6 : 0), 40, 11, 'sw');
      line(`M${bx + 62} ${by + 28 + (p.id === 'dgx' ? 6 : 0)}V${by + 22}M${bx + 130} ${by + 28 + (p.id === 'dgx' ? 6 : 0)}V${by + 22}M${bx + 62} ${by + 39 + (p.id === 'dgx' ? 6 : 0)}V${by + 46}M${bx + 130} ${by + 39 + (p.id === 'dgx' ? 6 : 0)}V${by + 46}`, 'nvlink');
      if (p.id === 'dgx') {
        S('rect', { x: 22, y: -8, width: 208, height: 86, class: 'ci-frame' }, g);
        rect(232, 2, 20, 20, 'cpu'); rect(232, 26, 20, 20, 'cpu');
        for (let k = 0; k < 6; k++) rect(14, -6 + k * 14, 6, 11, 'power');
      }
    } else if (p.id === 'gb200') {
      gpu(46, 14, 1.15); gpu(156, 14, 1.15);
      rect(112, 18, 28, 28, 'cpu');
      line('M90 32H112M140 32H152', 'nvlink');
      S('text', { x: 126, y: 62, class: 'ci-t' }, g, 'C2C 900 GB/s');
    } else {
      for (let i = 0; i < 27; i++) {
        const y = -6 + i * 3.25;
        const isC = i < 10 || i >= 19;
        if (isC) { for (let k = 0; k < 4; k++) rect(82 + k * 16, y, 14, 2.5, 'gpu'); rect(66, y, 13, 2.5, 'cpu'); rect(148, y, 13, 2.5, 'cpu'); } else rect(66, y, 95, 2.5, 'sw');
      }
      for (let k = 0; k < 4; k++) rect(55, 2 + k * 18, 7, 13, 'power');
      line('M168 -6V82', 'nvlink'); line('M172 -6V82', 'nvlink');
      line('M176 -6V82', 'nvlink');
    }
    return { g, parts, p, idx };
  },

  show(on) { vis(this.root, on); vis(this.g, on); },

  sync() {
    const sp = state.perfSparse;
    setText(this.sparseBtn, `算力口径：${sp ? '稀疏' : '稠密'}`);
    this.sparseBtn.classList.toggle('on', true);
    this.rows.forEach(({ m, r, lab, cells }) => {
      lab.classList.toggle('on', state.metric === m.id);
      r.classList.toggle('sel', state.metric === m.id);
      r.style.setProperty('--c', `var(${METRIC_COL[m.id]})`);
      const maxV = Math.max(...PRODUCTS.map(p => metricValue(p, m.id, sp)));
      const minV = Math.min(...PRODUCTS.map(p => metricValue(p, m.id, sp)));
      const logMin = Math.log(Math.max(minV, 1e-3) * .3), logMax = Math.log(Math.max(maxV, 1e-3));
      cells.forEach(({ c, p }) => {
        c.classList.toggle('pcol', state.product === p.id);
        if (m.id === 'compose') {
          setHTML(c, `<div class="c7-comp">${p.compose.map(x => `<span>${x}</span>`).join('')}</div>`);
          return;
        }
        const val = fmtVal(p, m.id, sp);
        const v = metricValue(p, m.id, sp);
        const w = clamp((Math.log(Math.max(v, 1e-3)) - logMin) / (logMax - logMin));
        const scope = p.scope === 'gpu' ? 'gpu' : 'sys';
        setHTML(c, `<div class="c7-val ${scope}"><b>${val.big}</b><i class="c7-bar"><u style="width:${(w * 100).toFixed(1)}%"></u></i><span>${val.sub || ''}</span></div>`);
      });
    });
    this.colHead.forEach((b, i) => b.classList.toggle('on', state.product === PRODUCTS[i].id));
  },
  esc() { if (state.metric || state.product) patch({ metric: null, product: null }); },

  update(f, t) {
    const { ctx } = this;
    const { pkg, hgx, dgx, sc, rack, streaks } = ctx.world;
    const P = f.proj;
    f.actBase = Math.max(f.actBase, .16);
    const show = sstep(.14, .24, t) * (1 - sstep(.82, .9, t));
    const rowsIn = t;
    this.table.style.opacity = show.toFixed(3);
    vis(this.table, show > .002);
    this.table.style.pointerEvents = show > .6 ? '' : 'none';
    this.table.style.transform = `translate3d(0,${(1 - sstep(.14, .24, t)) * 4 + sstep(.82, .9, t) * 3}rem,0)`;
    this.head.style.opacity = pulse(.1, .2, .82, .88, t).toFixed(3);
    vis(this.head, pulse(.1, .2, .82, .88, t) > .002);
    this.foot.style.opacity = show.toFixed(3);
    vis(this.foot, show > .002);
    // 行依次展开：每行前面的数字从条形生长
    this.rows.forEach((R, i) => {
      const k = sstep(.16 + i * .008, .24 + i * .008, t);
      R.r.style.setProperty('--grow', k.toFixed(3));
    });

    // 默认随滚动巡视指标；用户选择优先
    const scrollMetric = t > .3 && t < .8 ? METRICS[Math.min(METRICS.length - 1, Math.floor(iv(.3, .8, t) * METRICS.length))].id : null;
    const metric = state.metric || scrollMetric;
    const product = state.product;
    this.rows.forEach(R => R.r.classList.toggle('auto', R.m.id === metric));

    // ---- 结构图：转成表头的二维表示 ----
    const iconA = sstep(.1, .22, t) * (1 - sstep(.84, .92, t));
    const rgb = metric ? METRIC_RGB[metric] : null;
    const col = metric ? `var(${METRIC_COL[metric]})` : null;
    const active = metric ? PART_FOR[metric] : [];
    this.icons.forEach((ic, i) => {
      const cx = COLS[i], y = 304;
      A(ic.g, { transform: `translate(${cx - 128 * .66} ${y}) scale(.66)`, opacity: iconA * .95 });
      const sel = product === ic.p.id;
      ic.g.setAttribute('class', 'c7-icon' + (sel ? ' sel' : '') + (product && !sel ? ' dim' : ''));
      for (const k in ic.parts) {
        const on = active.includes(k);
        ic.parts[k].forEach(e => {
          const cl = on ? 'on' : '';
          if (e._on !== cl) { e._on = cl; e.classList.toggle('on', on); e.style.setProperty('--mc', col || 'var(--ink)'); }
        });
      }
    });

    // ---- 三维：对应部位同步反馈 ----
    const fb = sstep(.2, .3, t) * (1 - sstep(.82, .9, t));
    const c = rgb || [1, 1, 1];
    const isHbm = metric === 'mem' || metric === 'bw', isGpu = metric && metric.startsWith('f') || metric === 'tf32', isLink = metric === 'link', isPower = metric === 'power';
    // B200（完整模型）
    for (let k = 0; k < 8; k++) pkg.highlight(`hbm${k}`, isHbm ? .55 * fb : 0, 0x56d8ff);
    f.dieBoost = Math.max(f.dieBoost || 0, isGpu ? .9 * fb : 0);
    if (isLink) { const load = {}; for (const r of pkg.regions) if (r.kind === 'nvl') load[r.id] = fb; for (const id in load) f.act[id] = load[id]; }
    pkg.highlight('substrate', isPower ? .16 * fb : 0, 0xff6a47);
    pkg.highlight('decaps', isPower ? .4 * fb : 0, 0xff6a47);
    // HGX
    for (let i = 0; i < 8; i++) {
      hgx.lite.glowDie(i, c[0], c[1], c[2], isGpu ? .9 * fb : .02);
      hgx.lite.glowHbm(i, c[0], c[1], c[2], isHbm ? 1.1 * fb : .02);
    }
    for (let s = 0; s < 2; s++) hgx.glowSw(s, .82, .38, 1, isLink ? 1.4 * fb : .1);
    // DGX 盖面（透视）
    dgx.setPads(c, (isGpu || isHbm ? .9 : isLink ? 1.2 : 0) * fb, isLink ? 'sw' : 'gpu');
    // GB200
    sc.lite.glowDie(0, c[0], c[1], c[2], isGpu ? .9 * fb : .02);
    sc.lite.glowDie(1, c[0], c[1], c[2], isGpu ? .9 * fb : .02);
    sc.lite.glowHbm(0, c[0], c[1], c[2], isHbm ? 1.1 * fb : .02);
    sc.lite.glowHbm(1, c[0], c[1], c[2], isHbm ? 1.1 * fb : .02);
    sc.glowCpu(.6, .9, 1, metric === 'compose' ? .8 * fb : .05);
    // 机柜托盘
    rack.trays.forEach((s, i) => {
      if (s.kind === 'switch') rack.glowTray(i, .82, .38, 1, isLink ? 2.2 * fb : .15);
      else if (s.kind === 'compute') rack.glowTray(i, c[0], c[1], c[2], (isGpu || isHbm) ? 1.8 * fb : .12);
      else rack.glowTray(i, 1, .42, .28, isPower ? 2.2 * fb : 0);
    });

    this.updateFlights(f, t);
    this.updateNumbers(f, t);
    // 接缝母题：这里把“单颗”和“整套系统”分开
    const sa = pulse(.16, .26, .8, .88, t);
    if (sa > .002) {
      const xs = (COLS[0] + COLS[1]) / 2 - 1;
      f.seam = { x1: xs, y1: 296, x2: xs, y2: lerp(296, f.DH - 112, sstep(.16, .28, t)), op: sa, glow: .6 };
      A(this.scopeL, { x: xs - 10, y: 376, opacity: sa });
      A(this.scopeR, { x: xs + 10, y: 376, opacity: sa });
    } else { A(this.scopeL, { opacity: 0 }); A(this.scopeR, { opacity: 0 }); }
    if (show > .5) ctx.hud.setHint('点行选指标、点列选产品 · 模型和结构图的对应部位同步高亮 · Esc 清除');
    f.exploreAvail = f.exploreAvail || false;
  },

  // 三维模型上的部件点 → 结构图的同一部件。起点贴在模型上，终点贴在图上
  updateFlights(f, t) {
    const { pkg, hgx, dgx, sc, rack } = this.ctx.world;
    const k0 = pulse(.04, .08, .2, .26, t);
    A(this.flyG, { opacity: k0 });
    vis(this.flyG, k0 > .002);
    const frameA = pulse(.03, .08, .16, .24, t);
    const bbox = [[-46, 0, -42, 46, 6, 42], [-230, -6, -280, 230, 70, 280], [-241, -24, -448, 241, 420, 448], [-210, -5, -105, 210, 10, 105], [-300, 0, -534, 300, 2236, 534]];
    const groups = [pkg.group, hgx.group, dgx.group, sc.group, rack.group];
    const v = this.v;
    groups.forEach((G, i) => {
      const [x0, y0, z0, x1, y1, z1] = bbox[i];
      let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
      for (const X of [x0, x1]) for (const Y of [y0, y1]) for (const Z of [z0, z1]) {
        G.localToWorld(v.set(X, Y, Z));
        const q = f.proj(v.x, v.y, v.z);
        mnx = Math.min(mnx, q.x); mxx = Math.max(mxx, q.x); mny = Math.min(mny, q.y); mxy = Math.max(mxy, q.y);
      }
      // 外框从三维包围盒收拢到结构图所在的格
      const k = smoother(.12, .24, t);
      const cx = COLS[i], yT = 298, yB = 372, hw = 132;
      const picked = state.product === PRODUCTS[i].id && t > .24 && t < .84;
      const a = picked ? [mnx - 6, mny - 6] : [lerp(mnx, cx - hw, k), lerp(mny, yT, k)], b = picked ? [mxx + 6, yB] : [lerp(mxx, cx + hw, k), lerp(mxy, yB, k)];
      A(this.frames[i], { points: `${a[0]},${a[1]} ${b[0]},${a[1]} ${b[0]},${b[1]} ${a[0]},${b[1]}`, opacity: picked ? 1 : frameA, class: 'c7-frame' + (picked ? ' on' : '') });
    });
    if (k0 <= .002) return;
    const list = [];
    const push = (G, lx, ly, lz, colIdx, ix, iy, c) => {
      G.localToWorld(v.set(lx, ly, lz));
      const q = f.proj(v.x, v.y, v.z);
      list.push({ q: { x: q.x, y: q.y }, tx: COLS[colIdx] - 128 * .66 + ix * .66, ty: 304 + iy * .66, c });
    };
    push(pkg.group, 0, 4.5, -12.4, 0, 105, 30, '--sm'); push(pkg.group, 0, 4.5, 12.4, 0, 137, 30, '--sm');
    for (const x of [-23.4, 23.4]) for (const z of [-18.6, -6.2, 6.2, 18.6]) push(pkg.group, x, 4.5, z, 0, x < 0 ? 82 : 156, 15 + (z + 18.6) / 37.2 * 35, '--hbm');
    hgx.gpuXZ.forEach(([x, z], i) => push(hgx.group, x, 4.5, z, 1, 34 + (i % 4) * 48 + 18, (i < 4 ? 12 : 54), '--sm'));
    hgx.swXZ.forEach(([x, z], i) => push(hgx.group, x, 4, z, 1, i ? 164 : 96, 34, '--nvl'));
    hgx.gpuXZ.forEach(([x, z], i) => push(dgx.group, x, 200, z + 70, 2, 34 + (i % 4) * 48 + 18, (i < 4 ? 18 : 60), '--sm'));
    for (const i of [0, 1]) push(dgx.group, i ? 112 : -112, 380, 100, 2, 242, i ? 36 : 12, '--ink');
    push(sc.group, -128, 4.5, 0, 3, 64, 26, '--sm'); push(sc.group, 128, 4.5, 0, 3, 174, 26, '--sm'); push(sc.group, 0, 4, 0, 3, 126, 32, '--sec');
    rack.trays.forEach((s, i) => {
      if (s.kind === 'power') return;
      push(rack.group, 0, s.y + 20, 508, 4, 115, -6 + (i - 4) * 3.25, s.kind === 'switch' ? '--nvl' : '--sm');
    });
    this.flyDots.forEach((d, i) => {
      const it = list[i];
      if (!it) { d.style.display = 'none'; return; }
      d.style.display = '';
      const e = smoother(.1 + (i % 9) * .004, .22 + (i % 9) * .004, t);
      A(d, { x: lerp(it.q.x, it.tx, e) - 3.5, y: lerp(it.q.y, it.ty, e) - 3.5 });
      d.style.fill = `var(${it.c})`;
    });
  },

  // B200 这一列的数字沿引线飞回对应的部件，交给第 08 章的标注
  updateNumbers(f, t) {
    const { pkg } = this.ctx.world;
    const a = sstep(.8, .86, t) * (1 - sstep(1.06, 1.14, t));
    A(this.numG, { opacity: a });
    vis(this.numG, a > .002);
    if (a <= .002) return;
    const k = smoother(.84, 1.08, t);
    const prod = PRODUCTS[0];
    this.nums.forEach((n, i) => {
      const row = this.rows.find(r => r.m.id === n.m);
      const cell = row.cells[0].c;
      if (!n.from || n.fromScale !== f.dscale) {
        // 表格可能已隐藏：临时显示但不可见，量出 B200 这一列的真实位置（去掉离场位移）
        const tb = this.table, was = tb.style.display, tf = tb.style.transform, vs = tb.style.visibility;
        tb.style.display = ''; tb.style.visibility = 'hidden'; tb.style.transform = 'none';
        const b = cell.querySelector('b') || cell;
        const rc = b.getBoundingClientRect();
        tb.style.display = was; tb.style.visibility = vs; tb.style.transform = tf;
        if (rc.width > 0) { n.from = { x: rc.left / f.dscale, y: (rc.top + rc.height * .8) / f.dscale }; n.fromScale = f.dscale; }
      }
      if (!n.from) return;
      this.v.set(n.at[0], n.at[1], n.at[2]);
      pkg.group.localToWorld(this.v);
      const q = f.proj(this.v.x, this.v.y, this.v.z);
      const e = smoother(i * .06, .7 + i * .06, k);
      const x = lerp(n.from.x, q.x + 14, e), y = lerp(n.from.y, q.y - 10, e);
      A(n.t, { x, y });
      setText(n.t, fmtVal(prod, n.m, state.perfSparse).big);
      A(n.l, { d: `M${x} ${y + 4}L${q.x} ${q.y}`, opacity: e });
      A(n.d, { cx: q.x, cy: q.y, opacity: e });
    });
  },
};
