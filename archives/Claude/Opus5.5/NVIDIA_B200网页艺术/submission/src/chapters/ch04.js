// 第 04 章：横向段。纵向滚动被映射成水平前进；上方三维，下方是对齐的二维“躺倒的堆栈”。
// 同一份数据在这里变成一批批传输：突发长度固定（带宽），每批装多少个值由精度决定。
import * as THREE from 'three';
import { S, A, H, Trace, beat, vis, setText, setHTML } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fract, hash1, fmtNum } from '../core/util.js';
import { state, patch, subscribe, calc } from '../core/state.js';
import { sim, FORMAT_COLOR } from '../core/choreo.js';
import { FORMATS } from '../core/numerics.js';
import { DIM, STACK_POS, STACK_DIE, KIND_COL } from '../models/package.js';
import { runPulses, wire, wireProgress, onePulse } from '../core/flows.js';
import { drawSeamLanes, drawTSV } from '../core/seam.js';
import { createLocator } from '../ui/locator.js';
import { KIND_VAR } from './ch03.js';

const LEFT = [0, 1, 4, 5], RIGHT = [3, 2, 7, 6]; // 自上而下（方位 0 时屏幕向上是 -z）
const BURST_BITS = 512;

const PATH_STEPS = ['DRAM 层', '硅通孔 + 微凸点', '基底', '中介层走线', '显存接口', '二级缓存', '计算单元'];

function burstInfo(fmt) {
  const F = FORMATS[fmt];
  return { vals: Math.floor(BURST_BITS / F.effective), bits: F.store, F };
}
const fmtSci = v => {
  const e = Math.floor(Math.log10(v));
  return `${(v / Math.pow(10, e)).toFixed(2)}E${e}`;
};

export default {
  from: -.02, to: 1.03,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch04', ctx.chaptersRoot, null, { 'aria-label': '第 04 章 HBM3e 显存与带宽，横向段' });
    this.root = root;
    const beats = [
      { a: .0, b: .05, c: .17, d: .22, h: '04 / 显存 · 横向', t: '八路横渡', p: '方向转了九十度：接缝变成水平线，显存列到了两端。继续滚动，就向右穿过这颗 GPU。', big: true, x: 7.25 },
      { a: .2, b: .25, c: .36, d: .41, h: '容量 ≠ 带宽', t: '水箱与水管', p: '竖条是容量：每个堆栈 8 层 × 3 GB = 24 GB，决定能放多少。流动的脉冲是带宽：每堆栈约 1 TB/s，决定每秒能搬多少。', x: 7.25 },
      { a: .38, b: .43, c: .53, d: .57, h: '经过接缝', t: '结果在这里形成', p: '八路数据进入计算区，跨缝协同，乘积累加成结果矩阵——数字来自第 05 章的同一份输入。', x: 7.25 },
      { a: .56, b: .595, c: .69, d: .72, h: '局部观察窗', t: '版图下面还有什么', p: '拖动圆窗（或聚焦后用方向键）：它在二维版图的同一位置，放大显示更深一层的三维结构和流动的数据。', x: 7.25 },
      { a: .72, b: .77, c: .86, d: .9, h: '另一侧', t: '回到显存', p: '结果写回右列堆栈。逐个展开看：层、微凸点、硅通孔与下方的线稿同步。', x: 7.25 },
      { a: .89, b: .92, c: .955, d: .975, h: '一份数据', t: '取出这 16 个值', p: '这一块是正在传输的 16 个数值——NVFP4 的一个块。靠近它，看它的数值表示。', x: 7.25 },
    ];
    this.caps = beats.map(b => ({ ...b, e: H('div', 'cap c4-cap' + (b.big ? ' big' : ''), root, `<div class="over">${b.h}</div><h2>${b.t}</h2><p>${b.p}</p>`) }));

    // ---- 面板：堆栈 / 批次 ----
    const p = H('aside', 'panel p04 pe', root, null, { 'aria-label': '显存与批次控制' });
    this.panel = p;
    H('div', 'over', p, '展开堆栈');
    const row = H('div', 'p-chips', p);
    this.stackBtns = [];
    for (let i = 0; i < 8; i++) {
      const b = H('button', 'chip mini', row, String(i + 1), { type: 'button', 'aria-label': `展开堆栈 ${i + 1}` });
      b.addEventListener('click', () => {
        const v = state.stackOpen === i ? null : i;
        patch({ stackOpen: v });
        for (let k = 0; k < 8; k++) sim.open[k].to(k === v ? 1 : 0);
      });
      this.stackBtns.push(b);
    }
    H('div', 'over c4-mt', p, '选一批数据');
    const row2 = H('div', 'p-chips', p);
    this.batchBtns = [];
    for (let i = 0; i < 8; i++) {
      const b = H('button', 'chip mini', row2, `#${i + 1}`, { type: 'button', 'aria-label': `第 ${i + 1} 批数据，来自堆栈 ${i + 1}` });
      b.addEventListener('click', () => { patch({ batch: i }); this.replayT = this.ctx.f.time; });
      this.batchBtns.push(b);
    }
    const rr = H('div', 'p-row', p);
    this.bReplay = H('button', 'btn', rr, '重放这批的路径', { type: 'button' });
    this.bReplay.addEventListener('click', () => { this.replayT = this.ctx.f.time; });
    this.routeTxt = H('div', 'p-read', p);
    this.pathList = H('div', 'c4-path', p);
    this.pathItems = PATH_STEPS.map(n => H('span', '', this.pathList, n));
    this.replayT = null;

    // ---- 读数：容量 vs 带宽 ----
    const rd = H('div', 'c4-read', root);
    this.read = rd;
    this.rCap = H('div', 'c4-r', rd, '<label>容量 · 能放多少</label><b></b><span></span>');
    this.rBw = H('div', 'c4-r', rd, '<label>带宽 · 每秒搬多少</label><b></b><span></span>');
    this.rBur = H('div', 'c4-r', rd, '<label>当前批次 · 一次突发 512 位</label><b></b><span></span>');
    this.rTime = H('div', 'c4-r', rd, '<label>全部读一遍</label><b></b><span></span>');

    // ---- 横向进度 ----
    this.track = H('div', 'c4-track', root, '<i></i><span>左列显存</span><span>晶粒 A/B · 接缝</span><span>观察窗</span><span>右列显存</span>');
    this.trackBar = this.track.querySelector('i');

    // ---- SVG ----
    const g = S('g', { class: 'c4' }, ctx.ov);
    this.g = g;
    this.stripBg = S('rect', { class: 'c4-stripbg' }, g);
    this.lanes = [];
    const makeLane = i => {
      const lg = S('g', { class: 'c4-lane', tabindex: 0, role: 'button', 'aria-label': `数据路 ${i + 1}` }, g);
      lg.addEventListener('click', () => { patch({ batch: i }); this.replayT = this.ctx.f.time; });
      lg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); patch({ batch: i }); this.replayT = this.ctx.f.time; } });
      const line = S('path', { class: 'c4-wire' }, lg);
      const tank = S('rect', { class: 'c4-tank' }, lg);
      const fill = S('rect', { class: 'c4-tankf' }, lg);
      const layers = [];
      for (let l = 0; l < 10; l++) layers.push(S('rect', { class: 'c4-l' + (l === 0 ? ' base' : l === 9 ? ' top' : '') }, lg));
      const tsv = S('path', { class: 'c4-tsv' }, lg);
      const bumps = S('path', { class: 'c4-bump' }, lg);
      const lab = S('text', { class: 'c4-sl' }, lg, `HBM ${i + 1}`);
      const bursts = [];
      for (let b = 0; b < 3; b++) {
        const bg = S('g', {}, lg);
        const cells = [];
        for (let c = 0; c < 32; c++) cells.push(S('rect', { class: 'c4-c' }, bg));
        bursts.push({ bg, cells });
      }
      return { i, lg, line, tank, fill, layers, tsv, bumps, lab, bursts };
    };
    for (let i = 0; i < 8; i++) this.lanes.push(makeLane(i));
    // 中央：两颗晶粒的侧视条 + 接缝 + 结果
    this.dieRects = [S('rect', { class: 'c4-die' }, g), S('rect', { class: 'c4-die' }, g)];
    this.dieL = [S('text', { class: 'c4-dl' }, g, '晶粒 A'), S('text', { class: 'c4-dl' }, g, '晶粒 B')];
    this.seam2d = S('path', { class: 'c4-seam2' }, g);
    this.cellsG = S('g', {}, g);
    this.gpcBars = [];
    for (let i = 0; i < 10; i++) this.gpcBars.push(S('rect', { class: 'c4-g' }, this.cellsG));
    this.resG = S('g', { class: 'c4-res' }, g);
    this.resCells = [];
    for (let i = 0; i < 16; i++) this.resCells.push({ r: S('rect', { class: 'c4-rc' }, this.resG), t: S('text', { class: 'c4-rt' }, this.resG) });
    this.resT = S('text', { class: 'c4-rcap' }, this.resG);
    // 数据驱动的字形
    this.bwBack = S('rect', { class: 'c4-bwback' }, g);
    this.bwT = new Trace(g, { size: 66, cls: 'bwt', weight: 6.4 });
    this.valsT = new Trace(g, { size: 30, cls: 'valst', weight: 3 });
    this.valsL = S('text', { class: 'c3-bigs' }, g);

    // ---- 观察窗 ----
    this.fpG = S('g', { class: 'c4-fp' }, g);
    this.fpPolys = {};
    for (const r of ctx.world.pkg.regions) this.fpPolys[r.id] = S('polygon', { class: 'c3-poly c4-fpp', style: `--c:var(${KIND_VAR[r.kind]})` }, this.fpG);
    this.fpStacks = STACK_POS.map(() => S('polygon', { class: 'c3-stackp c4-fps' }, this.fpG));
    this.fpMask = S('defs', {}, g);
    this.mask = S('mask', { id: 'c4mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 4000, height: 3000 }, this.fpMask);
    this.maskR = S('rect', { x: -100, y: -100, width: 4200, height: 3200, fill: '#fff' }, this.mask);
    this.maskC = S('circle', { fill: '#000' }, this.mask);
    this.fpBg = S('rect', { class: 'c4-fpbg', mask: 'url(#c4mask)' }, this.fpG);
    this.fpG.insertBefore(this.fpBg, this.fpG.firstChild);
    Object.values(this.fpPolys).forEach(e => e.setAttribute('mask', 'url(#c4mask)'));
    this.fpStacks.forEach(e => e.setAttribute('mask', 'url(#c4mask)'));
    this.lensG = S('g', { class: 'c4-lens pe', tabindex: 0, role: 'slider', 'aria-label': '局部观察窗：拖动或用方向键移动', 'aria-valuetext': '' }, g);
    this.lensRing = S('circle', { class: 'c4-lring' }, this.lensG);
    this.lensHit = S('circle', { class: 'c4-lhit' }, this.lensG);
    this.lensTick = S('path', { class: 'c4-ltick' }, this.lensG);
    this.lensTxt = S('text', { class: 'c4-ltxt' }, this.lensG);
    this.lensTxt2 = S('text', { class: 'c4-ltxt2' }, this.lensG);
    this.setupLens();

    this.blockG = S('g', { class: 'c4-block' }, g);
    this.blockTexts = [];
    for (let i = 0; i < 16; i++) this.blockTexts.push(S('text', { class: 'c4-bt' }, this.blockG));
    this.blockCap = S('text', { class: 'c4-bcap' }, this.blockG);

    this.locG = S('g', {}, g);
    this.loc = createLocator(this.locG);
    subscribe(() => this.syncUI());
    this.syncUI();
    this.v = new THREE.Vector3();
    this.lensPos = { x: .5, y: .5 };
  },

  setupLens() {
    let drag = false;
    const toNorm = e => ({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    this.lensHit.addEventListener('pointerdown', e => {
      drag = true;
      this.lensHit.setPointerCapture(e.pointerId);
      e.stopPropagation();
      const n = toNorm(e);
      patch({ lens: n });
      sim.lensW.to(1);
      sim.lensX.to(n.x); sim.lensY.to(n.y);
    });
    this.lensHit.addEventListener('pointermove', e => {
      if (!drag) return;
      const n = toNorm(e);
      state.lens = n;
      sim.lensX.to(n.x); sim.lensY.to(n.y);
    });
    const end = () => { drag = false; };
    this.lensHit.addEventListener('pointerup', end);
    this.lensHit.addEventListener('pointercancel', end);
    this.lensG.addEventListener('keydown', e => {
      const step = .018;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step; else if (e.key === 'ArrowUp') dy = -step; else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'Escape') { patch({ lens: null }); sim.lensW.to(0); return; } else return;
      e.preventDefault();
      const cur = state.lens || { x: sim.lensX.v, y: sim.lensY.v };
      const n = { x: clamp(cur.x + dx, .1, .9), y: clamp(cur.y + dy, .12, .88) };
      patch({ lens: n });
      sim.lensW.to(1);
      sim.lensX.to(n.x); sim.lensY.to(n.y);
    });
  },

  syncUI() {
    this.stackBtns.forEach((b, i) => b.classList.toggle('on', state.stackOpen === i));
    this.batchBtns.forEach((b, i) => b.classList.toggle('on', state.batch === i));
  },

  show(on) { vis(this.root, on); vis(this.g, on); },

  // 第 si 路的屏幕 y（自上而下四行 + 上下对称）
  laneY(f, si) {
    const rowsTop = f.DH - 356;
    const rowH = 62;
    const idxL = LEFT.indexOf(si), idxR = RIGHT.indexOf(si);
    const k = idxL >= 0 ? idxL : idxR;
    return rowsTop + k * rowH + (k >= 2 ? 16 : 0);
  },

  update(f, t) {
    const { ctx } = this;
    const { pkg, streaks } = ctx.world;
    const P = f.proj;
    for (const c of this.caps) beat(c.e, t, c.a, c.b, c.c, c.d, { axis: 'x', dist: 14 });
    f.scrim = Math.max(f.scrim, pulse(-.01, .03, .96, .985, t) * .9);

    const on = t >= 0 && t < 1;
    const stripA = sstep(.0, .06, t) * (1 - sstep(.885, .92, t));
    const flat = pulse(.53, .58, .7, .75, t);
    const fmt = state.precision;
    const B = burstInfo(fmt);
    const col = FORMAT_COLOR[fmt];
    const colS = `rgb(${col.map(v => Math.round(v * 255)).join(',')})`;

    // ---- 面板与读数 ----
    const panelA = sstep(.03, .08, t) * (1 - sstep(.86, .9, t));
    this.panel.style.opacity = panelA.toFixed(3);
    vis(this.panel, panelA > .002);
    this.panel.style.pointerEvents = panelA > .6 ? '' : 'none';
    const readA = stripA * (1 - flat);
    this.read.style.opacity = readA.toFixed(3);
    vis(this.read, readA > .002);
    // 每路 1 TB/s：8 × 1 TB/s；读数都从当前精度算
    const cap = 192e9 * 8 / FORMATS[fmt].effective;  // 可容纳的值（按物理 192 GB）
    const bwVals = 8e12 * 8 / FORMATS[fmt].effective; // 每秒可传的值
    this.setRead(this.rCap, `192 GB`, `8 × 24 GB 物理；系统可用 180/186 GB。按 ${fmt} ≈ ${fmtSci(cap)} 个值`);
    this.setRead(this.rBw, `8 TB/s`, `每堆栈约 1 TB/s。按 ${fmt} ≈ ${fmtSci(bwVals)} 个值/秒`);
    this.setRead(this.rBur, `${B.vals} 个值`, fmt === 'FP4' ? '每值 4 位 + 每 16 值 1 个 E4M3 缩放' : `每值存储 ${B.bits} 位${fmt === 'TF32' ? '（运算用 19 位）' : ''}`);
    this.setRead(this.rTime, `24 ms`, '192 GB ÷ 8 TB/s，与精度无关：换精度变的是“值的个数”');

    this.trackBar.style.width = `${clamp(t) * 100}%`;
    const trackA = pulse(.0, .04, .92, .96, t);
    this.track.style.opacity = trackA.toFixed(3);
    vis(this.track, trackA > .002);

    if (panelA > .5) ctx.hud.setHint(flat > .5 ? '拖动圆窗观察 · 聚焦后方向键移动 · Esc 让它回到滚动路径' : '滚动 = 向右前进 · 点选堆栈与批次');
    f.exploreAvail = f.exploreAvail || (t > .02 && t < .5) || (t > .74 && t < .88);

    // ---- 跨缝计算激活 ----
    const passing = pulse(.2, .3, .56, .66, t);
    const load = {};
    const res = sstep(.36, .5, t);
    for (const r of pkg.regions) {
      const die = r.die === 'A' ? 0 : 1;
      if (r.kind === 'sm') load[r.id] = sstep(.26 + r.gpc * .012 + die * .02, .32 + r.gpc * .012 + die * .02, t) * (1 - sstep(.86, .97, t)) * .8;
      if (r.kind === 'phy') load[r.id] = Math.max(pulse(.02, .1, .2, .3, t), pulse(.72, .78, .9, .95, t)) * .9;
      if (r.kind === 'l2') load[r.id] = pulse(.14, .2, .5, .6, t) * .75;
      if (r.kind === 'hbi') load[r.id] = pulse(.22, .3, .52, .62, t);
    }
    f.loadAct = load;
    // load 在主循环激活图之前已读过，这里把最新值并入同一张图
    for (const id in load) f.act[id] = Math.max(f.act[id] || 0, load[id]);

    // ---- 三维：八路数据 ----
    const flow = sstep(0, .05, t) * (1 - sstep(.92, .985, t));
    if (t > 0 && t < 1) f.partitionZone = Math.max(f.partitionZone, pulse(0, .04, .5, .54, t), pulse(.72, .76, .93, .97, t), pulse(.54, .58, .7, .74, t));
    const density = FORMATS[fmt].store ? 64 / FORMATS[fmt].effective : 1;
    if (flow > .01 && t < 1) {
      const n = clamp(Math.round(1.2 + Math.log2(density) * .75), 1, 5);
      for (let si = 0; si < 8; si++) {
        const lane = pkg.pathHBMtoCompute(si, { lx: (si % 3 - 1) * 1.8, lz: (si % 2 - .5) * 3, gz: 0 });
        const leftSide = LEFT.includes(si);
        const gate = leftSide ? pulse(-.01, .02, .5, .6, t) : pulse(.3, .4, .9, .96, t);
        runPulses(streaks, lane, { n, speed: .3, time: f.time, phase: si * .13, color: [col[0] * .6 + .1, col[1] * .75 + .1, 1], gain: 5.5 * flow * gate, width: .07, tail: .05 });
      }
      f.seamAlive = drawSeamLanes(f, ctx, pulse(.18, .28, .58, .68, t) * flow, { gain: 6 });
    }

    if (t > 0 && t < 1) drawTSV(f, ctx);

    // ---- 选中的一批：完整路径 ----
    const batch = state.batch;
    const autoU = iv(.1, .42, t);
    let u = autoU, routeA = pulse(.1, .14, .44, .48, t);
    if (this.replayT !== null && !f.exporting) {
      const k = (f.time - this.replayT) / 3.6;
      if (k > 1.25) this.replayT = null;
      else { u = clamp(k); routeA = Math.max(routeA, 1 - sstep(1.05, 1.25, k)); }
    }
    const route = pkg.pathHBMtoCompute(batch, { layer: 4, lx: 0, lz: 0, gz: -3 });
    if (routeA > .01 && t < 1) {
      wireProgress(streaks, route, u, [1, .96, .8], 1.6 * routeA, .03, 28);
      const q = route.at(u, [0, 0, 0]);
      streaks.add(q[0] - .2, q[1], q[2], q[0] + .2, q[1], q[2], 26 * routeA, 22 * routeA, 12 * routeA, .16);
    }
    const stepIdx = Math.min(PATH_STEPS.length - 1, Math.floor(u * PATH_STEPS.length));
    this.pathItems.forEach((e, i) => {
      const cls = routeA > .05 ? (i < stepIdx ? 'done' : i === stepIdx ? 'cur' : '') : '';
      if (e._c !== cls) { e._c = cls; e.className = cls; }
    });
    setText(this.routeTxt, routeA > .05 ? `第 ${batch + 1} 批 · 堆栈 ${batch + 1} · ${PATH_STEPS[stepIdx]}` : `第 ${batch + 1} 批 · 来自堆栈 ${batch + 1}`);

    // ---- 二维条带：堆栈横躺，与三维 x 对齐 ----
    A(this.stripBg, { x: -10, y: f.DH - 396, width: f.DW + 20, height: 400, opacity: stripA * .86 });
    const yP = 4.6;
    const px = x => P(x, yP, 0).x;
    const xL = px(-23.4), xR = px(23.4), xDa = px(-17), xDb = px(17);
    const yMid = f.DH - 356 + 2 * 62 - 22;
    this.lanes.forEach((L, idx) => {
      const si = L.i;
      const leftSide = LEFT.includes(si);
      const y = this.laneY(f, si);
      const open = f.pkgState.open[si];
      const X = leftSide ? xL : xR;
      const dir = leftSide ? 1 : -1;
      const gap = 1.4 + open * 11;
      const lh = 42;
      if (stripA < .004) { L.lg.style.display = 'none'; return; }
      L.lg.style.display = '';
      A(L.lg, { opacity: stripA * (1 - flat) });
      const sel = state.batch === si;
      L.lg.setAttribute('class', 'c4-lane' + (sel ? ' sel' : ''));
      // 层：基底朝向晶粒
      const baseX = X + dir * 30;
      let tsv = '', bumps = '';
      for (let l = 0; l < 10; l++) {
        const w = l === 0 ? 5 : l === 9 ? 4 : 2.6;
        const xx = baseX - dir * l * (gap + 2.2) - (dir > 0 ? 0 : w);
        A(L.layers[l], { x: xx, y: y - lh / 2, width: w, height: lh });
        if (l < 9) {
          const nx = baseX - dir * (l + .5) * (gap + 2.2);
          for (const q of [-.36, -.18, 0, .18, .36]) bumps += `M${(nx - 1).toFixed(1)} ${(y + q * lh).toFixed(1)}h2`;
        }
      }
      const xTop = baseX - dir * 9 * (gap + 2.2);
      for (const q of [-.1, 0, .1]) tsv += `M${baseX.toFixed(1)} ${(y + q * lh).toFixed(1)}L${xTop.toFixed(1)} ${(y + q * lh).toFixed(1)}`;
      A(L.tsv, { d: tsv });
      A(L.bumps, { d: bumps, opacity: .3 + open * .7 });
      A(L.lab, { x: xTop - dir * 8, y: y + 4, 'text-anchor': dir > 0 ? 'end' : 'start' });
      // 容量：水箱（竖条）
      const tankX = xTop - dir * 74 - 6;
      A(L.tank, { x: tankX, y: y - 22, width: 12, height: 44 });
      const fillH = 44 * FORMATS[fmt].effective / 64;
      A(L.fill, { x: tankX, y: y + 22 - fillH, width: 12, height: fillH, fill: colS });
      // 线路：基底 → 晶粒
      const dieEnd = leftSide ? xDa + 6 : xDb - 6;
      A(L.line, { d: `M${baseX + dir * 5} ${y}L${dieEnd} ${y}` });
      // 批次：突发块沿线走，单元数由精度决定
      const x0 = baseX + dir * 6, x1 = dieEnd;
      const bw = Math.min(Math.abs(x1 - x0) * .4, 62);
      const nCells = Math.min(32, B.vals);
      const grouped = fmt === 'FP4' ? 16 : (B.vals > 32 ? Math.floor(B.vals / 8) : 4);
      L.bursts.forEach((b, k) => {
        const uu = fract(f.time * .22 + k / 3 + si * .07);
        const gx = lerp(x0, x1, uu) - (dir > 0 ? bw : 0);
        const fade = Math.min(1, uu * 8, (1 - uu) * 8);
        const gate = leftSide ? pulse(-.01, .02, .5, .6, t) : pulse(.3, .4, .9, .96, t);
        A(b.bg, { transform: `translate(${gx.toFixed(1)} ${y - 5})`, opacity: fade * gate });
        const cw = bw / nCells;
        b.cells.forEach((c, ci) => {
          if (ci >= nCells) { if (c._v !== 0) { c._v = 0; c.style.display = 'none'; } return; }
          if (c._v !== 1) { c._v = 1; c.style.display = ''; }
          const isGap = (ci % Math.max(1, Math.round(grouped * nCells / B.vals))) === 0 && ci > 0;
          c.setAttribute('x', (ci * cw + (isGap ? .3 : 0)).toFixed(2));
          c.setAttribute('width', Math.max(.4, cw - (isGap ? .8 : .4)).toFixed(2));
          c.setAttribute('y', 0); c.setAttribute('height', 10);
          c.setAttribute('fill', colS);
        });
      });
    });
    // 中央两晶粒条 + 接缝
    const dw = xDb - xDa;
    A(this.dieRects[0], { x: xDa, y: yMid - 118, width: dw, height: 108, opacity: stripA * (1 - flat) });
    A(this.dieRects[1], { x: xDa, y: yMid + 10, width: dw, height: 108, opacity: stripA * (1 - flat) });
    A(this.dieL[0], { x: xDa + 8, y: yMid - 100, opacity: stripA * (1 - flat) });
    A(this.dieL[1], { x: xDa + 8, y: yMid + 112, opacity: stripA * (1 - flat) });
    let sd = '';
    for (let k = 0; k < 28; k++) {
      const xx = lerp(xDa + 10, xDb - 10, k / 27);
      const pul = fract(f.time * .9 + k * .37);
      const yy = lerp(yMid - 8, yMid + 8, pul);
      sd += `M${xx.toFixed(1)} ${yy - 2}v4`;
    }
    A(this.seam2d, { d: sd, opacity: stripA * (1 - flat) * pulse(.18, .28, .58, .68, t) });
    // 计算激活条：与三维同一张图
    const ids = ['A.gpc0', 'A.gpc1', 'A.gpc2', 'A.gpc3', 'A.gpc4', 'B.gpc0', 'B.gpc1', 'B.gpc2', 'B.gpc3', 'B.gpc4'];
    ids.forEach((id, k) => {
      const die = k < 5 ? 0 : 1;
      const cw = (dw - 40) / 5;
      const x = xDa + 20 + (k % 5) * cw;
      const yb = die === 0 ? yMid - 92 : yMid + 18;
      A(this.gpcBars[k], { x: x + 3, y: yb, width: cw - 6, height: 72, opacity: stripA * (1 - flat) * (.04 + (f.act[id] || 0) * .24) });
    });
    // 结果形成：真实乘积
    const mm = calc().mm;
    const rA = stripA * (1 - flat) * res * (1 - sstep(.62, .7, t));
    A(this.resG, { opacity: rA });
    if (rA > .002) {
      const cx = lerp(xDa, xDb, .5), cs = Math.min(40, dw * .08), hh = cs * .64;
      const cy = yMid;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const k = i * 4 + j;
        const e = sstep(.36 + k * .007, .42 + k * .007, t);
        const X = cx - 2 * cs + j * cs, Y = cy - 2 * hh + i * hh;
        A(this.resCells[k].r, { x: X + 1, y: Y + 1, width: cs - 2, height: hh - 2, opacity: e });
        A(this.resCells[k].t, { x: X + cs / 2, y: Y + hh / 2 + 3.5, opacity: e });
        setText(this.resCells[k].t, fmtNum(mm.C[i][j], 1));
      }
      A(this.resT, { x: cx, y: cy - 2 * hh - 8 });
      setText(this.resT, `结果 C = A · B（${fmt}）`);
    }

    // ---- 数据驱动的字形：流量越大，笔画越躁动 ----
    const bigA = stripA * (1 - flat) * (1 - sstep(.1, .16, t) * (1 - sstep(.86, .9, t)) * 0);
    this.bwT.opacity(bigA);
    A(this.bwBack, { x: f.DW - 360 - 430, y: 116, width: 448, height: 172, opacity: bigA });
    this.valsT.opacity(bigA);
    A(this.valsL, { opacity: bigA });
    if (bigA > .002) {
      const dens = Math.log2(density) / 4;
      const passes = (this.lanes[0], pulse(0, .05, .9, .95, t));
      const rightEdge = f.DW - 360;
      this.bwT.draw(rightEdge, 136, '8 TB/S', {
        anchor: 'end',
        deform: (u, v, i) => {
          const w = Math.sin((u + i * 5.4) * 1.1 - f.time * 6);
          const burst = Math.pow(Math.max(0, w), 3);
          return [u + burst * .12 * dens * passes * Math.sin(v * 5), v + burst * (.2 + .55 * dens) * passes];
        },
      });
      this.bwT.stroke(colS);
      const vt = fmtSci(bwVals).replace('.', '.');
      this.valsT.draw(rightEdge, 218, vt + ' /S', { anchor: 'end', deform: (u, v, i) => [u, v + Math.sin(u * 2 + f.time * 3 + i) * .08 * dens] });
      this.valsT.stroke('var(--ink)');
      A(this.valsL, { x: rightEdge, y: 272, 'text-anchor': 'end' });
      setText(this.valsL, `${fmt} 下每秒可传的数值（密度随精度变化）`);
    }

    // ---- 观察窗段：二维版图 + 三维透镜 ----
    this.updateLens(f, t, flat);

    // ---- 取一份数据：3D 块，朝镜头飞出 ----
    this.updateBlock(f, t);

    const locA = stripA * .85 * (1 - flat);
    this.loc.update(f, 196, f.DH - 500, locA * sstep(.2, .28, t) * 0 + 0, 0);
    A(this.locG, { opacity: 0 });
  },

  setRead(el, big, small) {
    const b = el.querySelector('b'), s = el.querySelector('span');
    setText(b, big); setText(s, small);
  },

  updateLens(f, t, flat) {
    const { ctx } = this;
    const { pkg, streaks } = ctx.world;
    const P = f.proj;
    const engine = ctx.engine;
    const on = flat > .01;
    vis(this.fpG, on);
    vis(this.lensG, on);
    engine.params.lens = null;
    if (!on) return;
    // 版图不透明度：越平越实，把三维压在下面，只在透镜里露出
    A(this.fpG, { opacity: flat });
    const y = DIM.die.y0 + DIM.die.h;
    const w = f.DW, h = f.DH;
    // 滚动路径上的观察窗（世界坐标）
    const k = iv(.58, .7, t);
    const wx = lerp(-23, 22, k), wz = lerp(-6.2, 6.2, smoother(.2, .8, k)) + Math.sin(k * 6) * 2;
    const q = P(wx, y, wz);
    const userW = sim.lensW.v;
    const lx = lerp(q.x / w, sim.lensX.v, userW), ly = lerp(q.y / h, sim.lensY.v, userW);
    const R = 150 * (1 + flat * .4) * Math.min(1.25, f.DH / 1080);
    const cxD = lx * w, cyD = ly * h;
    A(this.maskC, { cx: cxD, cy: cyD, r: R * flat });
    A(this.fpBg, { x: 0, y: 0, width: w, height: h });
    for (const r of pkg.regions) {
      const a = P(r.x0, y, r.z0), b = P(r.x1, y, r.z0), c = P(r.x1, y, r.z1), d = P(r.x0, y, r.z1);
      const e = this.fpPolys[r.id];
      e.setAttribute('points', `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)} ${d.x.toFixed(1)},${d.y.toFixed(1)}`);
      e.style.fillOpacity = (.1 + (f.act[r.id] || 0) * .22).toFixed(3);
      e.style.strokeOpacity = .9;
    }
    STACK_POS.forEach(([sx, sz], i) => {
      const a = P(sx - 5.5, 4.6, sz - 5.9), b = P(sx + 5.5, 4.6, sz - 5.9), c = P(sx + 5.5, 4.6, sz + 5.9), d = P(sx - 5.5, 4.6, sz + 5.9);
      this.fpStacks[i].setAttribute('points', `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${c.x.toFixed(1)},${c.y.toFixed(1)} ${d.x.toFixed(1)},${d.y.toFixed(1)}`);
    });
    // 透镜相机：对准观察窗下方的世界点，更近、更斜
    const world = f.unprojectToPlaneY(cxD, cyD, y);
    const cam = engine.lensCam;
    const dist = 44;
    cam.fov = 30; cam.aspect = 1;
    cam.near = .5; cam.far = 500;
    cam.position.set(world.x - dist * .32, y + dist * .78, world.z + dist * .54);
    cam.up.set(0, 1, 0);
    cam.lookAt(world.x, y - .4, world.z);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const scene = engine.scene;
    const ps = f.pkgState;
    const deepOpen = { open: new Array(8).fill(.42), layerSpread: 2.2 };
    engine.params.lens = {
      on: true, x: lx, y: 1 - ly, r: (R * flat) / f.DH,
      render(rt) {
        // 同一场景，第二台相机；观察窗里显存层是打开的
        pkg.apply(deepOpen);
        const r = engine.r;
        r.setRenderTarget(rt);
        r.clear();
        r.render(scene, cam);
        pkg.apply({ open: ps.open, layerSpread: ps.layerSpread });
      },
    };
    // 观察窗 UI
    A(this.lensRing, { cx: cxD, cy: cyD, r: R * flat });
    A(this.lensHit, { cx: cxD, cy: cyD, r: R * flat });
    let d = '';
    for (let a = 0; a < 24; a++) {
      const th = a / 24 * Math.PI * 2;
      const r0 = R * flat + 4, r1 = R * flat + (a % 6 === 0 ? 14 : 8);
      d += `M${cxD + Math.cos(th) * r0} ${cyD + Math.sin(th) * r0}L${cxD + Math.cos(th) * r1} ${cyD + Math.sin(th) * r1}`;
    }
    A(this.lensTick, { d });
    // 观察到什么：查询窗下方的部件
    let what = '中介层 · 表面走线';
    for (const r of pkg.regions) if (world.x >= r.x0 && world.x <= r.x1 && world.z >= r.z0 && world.z <= r.z1) what = `晶粒 ${r.die} · ${r.name}`;
    STACK_POS.forEach(([sx, sz], i) => { if (Math.abs(world.x - sx) < 5.5 && Math.abs(world.z - sz) < 5.9) what = `HBM 堆栈 ${i + 1} · 层、微凸点与硅通孔`; });
    const tx = cxD + R * flat * .74 + 10, ty = cyD + R * flat * .74 + 26;
    A(this.lensTxt, { x: cxD, y: cyD + R * flat + 34 });
    setText(this.lensTxt, what);
    A(this.lensTxt2, { x: cxD, y: cyD + R * flat + 52 });
    const mag = (260 * Math.tan(7.5 * Math.PI / 180)) / (dist * Math.tan(15 * Math.PI / 180) * (R * 2 * flat / f.DH));
    setText(this.lensTxt2, `放大 ≈ ${mag.toFixed(1)}× · 第二台相机实时渲染`);
    this.lensG.setAttribute('aria-valuetext', what);
    // 脉冲（透镜里能看到）
    for (let si = 0; si < 8; si++) {
      const lane = pkg.pathHBMtoCompute(si, { lx: (si % 3 - 1) * 1.8, lz: (si % 2 - .5) * 3 });
      runPulses(streaks, lane, { n: 3, speed: .3, time: f.time, phase: si * .13, color: [.32, .85, 1], gain: 5 * flat, width: .05, tail: .05 });
    }
    f.seamAlive = drawSeamLanes(f, ctx, flat, { gain: 6 });
  },

  updateBlock(f, t) {
    const { ctx } = this;
    const { block, pkg } = ctx.world;
    const on = t > .885 && t <= 1.0;
    block.visible = on;
    vis(this.blockG, on);
    if (!on) return;
    const e = smoother(.885, .945, t);
    const sx = 23.4, sz = 6.2;
    const from = this.v.set(sx - 3, 5.2, sz);
    const X = lerp(from.x, 36, e), Y = lerp(from.y, 10, e), Z = lerp(from.z, 12, e);
    block.position.set(X, Y, Z);
    block.quaternion.copy(ctx.engine.camera.quaternion);
    const s = lerp(2, 8, Math.pow(smoother(.9, 1.0, t), 2));
    block.scale.setScalar(s);
    // 泛出中心就是数据块的屏幕位置
    const q = f.proj(X, Y, Z);
    f.floodCenter = q;
    // 面上 16 个数：真实量化后的 A
    const mm = calc().mm;
    const half = s * .5 * .88; // 面上网格的半宽（纹理留白 6%）
    const cam = ctx.engine.camera;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const textA = sstep(.905, .94, t) * (1 - sstep(.985, 1, t));
    A(this.blockG, { opacity: textA });
    const c0 = new THREE.Vector3(X, Y, Z).add(new THREE.Vector3(0, 0, .0605 * s).applyQuaternion(cam.quaternion));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const a = (j + .5) / 4 * 2 - 1, b = -((i + .5) / 4 * 2 - 1);
      const px = c0.x + right.x * a * half + up.x * b * half, py = c0.y + right.y * a * half + up.y * b * half, pz = c0.z + right.z * a * half + up.z * b * half;
      const p = f.proj(px, py, pz);
      const size = Math.abs(f.proj(px + right.x * half * .5, py + right.y * half * .5, pz + right.z * half * .5).x - p.x);
      const e2 = this.blockTexts[i * 4 + j];
      A(e2, { x: p.x, y: p.y + size * .08, 'font-size': Math.max(3, size * .3) });
      setText(e2, fmtNum(mm.qa.Q[i][j], 2));
    }
    A(this.blockCap, { x: q.x, y: q.y - Math.abs(f.proj(X + up.x * half, Y + up.y * half, Z + up.z * half).y - q.y) - 18, opacity: 1 - sstep(.93, .95, t) });
    setText(this.blockCap, `第 ${state.batch + 1} 批中的一块 · 16 个值 · ${state.precision}`);
  },
};
