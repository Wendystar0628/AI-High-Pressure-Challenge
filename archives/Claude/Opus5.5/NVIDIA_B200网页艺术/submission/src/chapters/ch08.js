// 第 08 章：回到整颗 GPU。七组标注随自转定位并更新遮挡；三类负载各有不同的计算区域、数据运动和读数；结尾与开场呼应。
import * as THREE from 'three';
import { S, A, H, Trace, beat, vis, setText, setHTML } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fract, fmtNum, hash1, DEG } from '../core/util.js';
import { state, patch, subscribe, calc } from '../core/state.js';
import { FORMATS, FORMAT_ORDER } from '../core/numerics.js';
import { peakOfFormat, SOURCES } from '../data/specs.js';
import { DIM, STACK_POS, KIND_COL } from '../models/package.js';
import { sim, FORMAT_COLOR } from '../core/choreo.js';
import { runPulses, wire } from '../core/flows.js';
import { drawSeamLanes } from '../core/seam.js';

// 七组标注：锚点在部件上，随自转移动；被挡住时虚线
const ANN = [
  { id: 'te', name: 'Transformer Engine', sub: 'FP4 张量核心 · 稀疏（稠密 9 PF）', val: () => '18 PF', col: '--sm', at: [-8, 4.6, 14], side: 1, region: 'B.gpc1' },
  { id: 'hbi', name: '片间互连', sub: '两颗晶粒成一颗 GPU', val: () => '10 TB/s', col: '--hbi', at: [6, 4.6, 0], side: 1, region: 'A.hbi' },
  { id: 'dec', name: '解压缩引擎', sub: '数据直解到显存', val: () => '专用引擎', col: '--dec', at: [0, 4.6, -3], side: -1, region: 'A.dec' },
  { id: 'hbm', name: 'HBM3e', sub: '8 堆栈 · 带宽 8 TB/s · 物理 192 GB', val: () => '180 GB', col: '--hbm', at: [23.4, 4.6, 18.6], side: 1, stack: 6 },
  { id: 'nvl', name: 'NVLink', sub: '第五代 · 每 GPU 双向', val: () => '1.8 TB/s', col: '--nvl', at: [0, 4.6, -23], side: -1, region: 'A.nvl' },
  { id: 'ras', name: 'RAS 与机密计算', sub: '预防性诊断 · 接口加密', val: () => '双引擎', col: '--ras', at: [0, 4.6, 5], side: -1, region: 'B.sec', region2: 'A.ras' },
  { id: 'pow', name: '功耗', sub: 'HGX 配置 · GB200 约 1.2 kW', val: () => '1,000 W', col: '--ras', at: [-40, 3.2, 28], side: -1, part: 'decaps' },
];

const LOADS = [
  { id: 'train', name: '训练', col: '--sm', rgb: [.72, 1, .2], fmtNote: () => state.precision, desc: '全部计算单元高负载，梯度跨缝来回、NVLink 持续同步。', fmt: 'cur', mem: .78, link: 1, cross: 1, power: 1, wave: 'sweep' },
  { id: 'infer', name: '推理', col: '--hbm', rgb: [.34, .85, 1], fmtNote: () => state.precision, desc: '显存到计算单向流动，计算单元按批次分组点亮，延迟优先。', fmt: 'cur', mem: 1, link: .3, cross: .6, power: .7, wave: 'batch' },
  { id: 'sci', name: '科学计算', col: '--ras', rgb: [1, .42, .28], fmtNote: () => 'FP64（单独标明，不用全页精度）', desc: '双精度网格逐区推进，缓存密集，NVLink 只交换边界。', fmt: 'FP64', mem: .55, link: .55, cross: .4, power: .85, wave: 'grid' },
];

export default {
  from: -.02, to: 1.02,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch08', ctx.chaptersRoot, null, { 'aria-label': '第 08 章 回到一颗' });
    this.root = root;
    this.head = H('div', 'c8-head', root, '<div class="over">08 / 回到一颗</div><h2>回到一颗</h2>');
    this.loadCap = H('div', 'c8-load', root);
    this.loadH = H('h3', '', this.loadCap);
    this.loadD = H('p', '', this.loadCap);
    this.loadR = H('div', 'c8-reads', this.loadCap);

    const lp = H('div', 'c8-tabs pe', root, null, { role: 'tablist', 'aria-label': '三类负载' });
    this.lp = lp;
    this.loadBtns = LOADS.map(l => {
      const b = H('button', 'c8-tab', lp, l.name, { type: 'button', role: 'tab', style: `--c:var(${l.col})` });
      b.addEventListener('click', () => patch({ load: state.load === l.id ? null : l.id }));
      return b;
    });
    this.final = H('div', 'c8-final', root, `<h1>双晶一芯</h1><p>两颗晶粒 · 一颗 GPU · 2080 亿个晶体管</p>`);
    this.finalState = H('div', 'c8-state', this.final);
    this.credit = H('div', 'c8-credit', root, `<b>本页为概念设计作品，非 NVIDIA 官方页面。</b> NVIDIA、Blackwell、HGX、DGX、NVLink 等名称归其所有者。模型、图形均为自行制作；封装外形与比例参考公开资料，微观结构与版图为标明含义的示意。<br>资料来源：${SOURCES.map(s => `<a href="${s.u}" target="_blank" rel="noopener">${s.t}</a>`).join(' · ')}`);

    const g = S('g', { class: 'c8' }, ctx.ov);
    this.g = g;
    this.anns = ANN.map(a => {
      const lg = S('g', { class: 'lead-g c8-ann', style: `--c:var(${a.col})` }, g);
      return {
        ...a, lg,
        line: S('path', { class: 'lead', fill: 'none' }, lg),
        dot: S('circle', { r: 4, class: 'dot' }, lg),
        halo: S('circle', { r: 11, class: 'c8-halo' }, lg),
        name: S('text', { class: 'c8-an' }, lg, a.name),
        sub: S('text', { class: 'c8-as' }, lg, a.sub),
        big: new Trace(lg, { size: 21, cls: 'lab', weight: 2.2 }),
      };
    });
    // 三类负载的 SVG 图形：同一块区域，不同过程
    this.loadG = S('g', { class: 'c8-lg' }, g);
    this.trainBars = [];
    for (let i = 0; i < 28; i++) this.trainBars.push(S('rect', { class: 'c8-tr' }, this.loadG));
    this.lossPath = S('path', { class: 'c8-loss' }, this.loadG);
    this.inferDots = [];
    for (let i = 0; i < 24; i++) this.inferDots.push(S('rect', { class: 'c8-if' }, this.loadG));
    this.grid = [];
    for (let i = 0; i < 64; i++) this.grid.push(S('rect', { class: 'c8-gd' }, this.loadG));
    this.loadLabel = S('text', { class: 'c8-lab' }, this.loadG);

    // 收束：前面的图形重新汇聚
    this.endG = S('g', { class: 'c8-end' }, g);
    this.endTiles = [];
    for (let i = 0; i < 208; i++) this.endTiles.push(S('polygon', { class: 'c1-tile' }, this.endG));
    this.heroT = new Trace(g, { size: 186, cls: 'hero', weight: 15 });
    this.endRead = new Trace(g, { size: 40, cls: 'odo', weight: 4 });
    this.endReadL = S('text', { class: 'c3-bigs' }, g);
    this.endSeam = S('path', { class: 'c8-eseam' }, g);
    this.tmp = new THREE.Vector3();
    subscribe(() => this.sync());
    this.sync();

    // 自转：只在这一章生效
    ctx.camHook = (pose, f) => {
      const t7 = f.loc[6];
      if (t7 > .82 && t7 < 1) {
        const w = smoother(.82, .9, t7);
        const q = ctx.world.pkg.group.position;
        pose.tx = lerp(pose.tx, q.x, w); pose.ty = lerp(pose.ty, q.y + 3, w); pose.tz = lerp(pose.tz, q.z, w);
        pose.sx = lerp(pose.sx, 0, w); pose.sy = lerp(pose.sy, .02, w);
      }
      const t = f.loc[7];
      if (t > .02) {
        const e = sstep(.02, .14, t) * (1 - sstep(.86, 1, t));
        pose.az += e * (t - .5) * 2.4 + e * Math.sin(f.time * .12) * .08;
        const rest = sstep(.9, 1, t);
        pose.az += rest * Math.sin(f.time * .16) * .05;
        pose.el += rest * Math.sin(f.time * .11) * .015;
      }
    };
  },

  sync() {
    this.loadBtns.forEach((b, i) => b.classList.toggle('on', state.load === LOADS[i].id));
  },
  show(on) { vis(this.root, on); vis(this.g, on); },
  esc() { if (state.load) patch({ load: null }); },

  update(f, t) {
    const { ctx } = this;
    const { pkg, streaks } = ctx.world;
    const P = f.proj;
    const fmt = state.precision;
    const { mm } = calc();

    f.actBase = Math.max(f.actBase, sstep(-.1, .06, t) * .2);
    const headA = pulse(.0, .05, .3, .36, t);
    this.head.style.opacity = headA.toFixed(3);
    vis(this.head, headA > .002);

    // ---- 七组标注 ----
    const annK = sstep(.04, .2, t) * (1 - sstep(.82, .9, t));
    f.exploreAvail = f.exploreAvail || (t > .04 && t < .9);
    // 由负载决定的区域激活（写进同一张激活图）
    const scrollLoad = t < .32 ? null : t < .46 ? 'train' : t < .6 ? 'infer' : t < .74 ? 'sci' : null;
    const loadId = state.load || scrollLoad;
    const L = LOADS.find(l => l.id === loadId);
    const loadA = pulse(.3, .34, .72, .78, t) || (state.load && t > .1 && t < .9 ? 1 : 0);
    const la = state.load ? Math.max(loadA, sstep(.08, .14, t) * (1 - sstep(.86, .92, t))) : loadA;

    const items = [];
    this.anns.forEach((a, i) => {
      const wy = (a.part ? pkg.parts[a.part].w.y : 0);
      const p = P(a.at[0], a.at[1] + wy, a.at[2]);
      const occ = pkg.occluded(f.camPos, { x: a.at[0], y: a.at[1] + 1.2, z: a.at[2] }, a.stack !== undefined ? `hbm${a.stack}` : null);
      items.push({ a, i, p, occ });
    });
    // 左右分栏，按屏幕 y 排序避让
    const leftCol = items.filter(it => it.p.x < (f.DW / 2 + 40) && it.a.side <= 1).sort((x, y) => x.p.y - y.p.y);
    const left = [], right = [];
    for (const it of items) (it.p.x < f.DW / 2 ? left : right).push(it);
    const place = (arr, X, dir) => {
      arr.sort((x, y) => x.p.y - y.p.y);
      let last = 110;
      for (const it of arr) { it.y = Math.max(it.p.y, last + 86); last = it.y; }
      let over = last - (f.DH - 100);
      if (over > 0) { for (const it of arr) it.y -= over; }
      for (const it of arr) { it.tx = X; it.dir = dir; }
    };
    place(left, 310, -1);
    place(right, f.DW - 480, 1);
    for (const it of items) {
      const { a, p, occ } = it;
      const e = sstep(.04 + it.i * .012, .1 + it.i * .012, t) * (1 - sstep(.82, .9, t));
      if (e < .002) { A(a.lg, { opacity: 0 }); continue; }
      const lx = lerp(p.x, it.tx, e), ly = lerp(p.y, it.y, e);
      const mx = lerp(p.x, it.tx - it.dir * -30 * 1, e);
      A(a.line, { d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${lerp(p.x, it.tx + it.dir * -24 * -1, e).toFixed(1)} ${ly.toFixed(1)}L${lx.toFixed(1)} ${ly.toFixed(1)}`, 'stroke-dasharray': occ ? '3 4' : 'none', opacity: occ ? .55 : 1 });
      A(a.dot, { cx: p.x, cy: p.y, class: occ ? 'dot hollow' : 'dot' });
      A(a.halo, { cx: p.x, cy: p.y, r: 7 + 5 * (.5 + .5 * Math.sin(f.time * 2 + it.i)), opacity: occ ? 0 : .5 });
      const anchor = it.dir < 0 ? 'end' : 'start';
      const tx = it.tx + it.dir * 8;
      A(a.name, { x: tx, y: it.y - 22, 'text-anchor': anchor });
      A(a.sub, { x: tx, y: it.y - 6, 'text-anchor': anchor });
      a.big.draw(tx, it.y + 2, a.val(), { anchor: it.dir < 0 ? 'end' : 'start' });
      A(a.lg, { opacity: e });
    }

    // ---- 负载 ----
    const showLoadUI = sstep(.28, .34, t) * (1 - sstep(.8, .86, t));
    this.lp.style.opacity = Math.max(showLoadUI, annK).toFixed(3);
    vis(this.lp, Math.max(showLoadUI, annK) > .002);
    this.lp.style.pointerEvents = Math.max(showLoadUI, annK) > .6 ? '' : 'none';
    this.loadCap.style.opacity = (L ? la : 0).toFixed(3);
    vis(this.loadCap, !!L && la > .002);
    this.updateLoad(f, t, L, la, fmt, mm);

    // ---- 收束 ----
    this.updateEnding(f, t, fmt);
    const rest = sstep(.86, .98, t);
    if (rest > .01) {
      f.seamAlive = drawSeamLanes(f, ctx, rest * .55, { gain: 4, lineGain: .5, speed: .5 });
      for (let si = 0; si < 8; si++) {
        const lane = pkg.pathHBMtoCompute(si, { lx: (si % 3 - 1) * 1.8, lz: (si % 2 - .5) * 3 });
        runPulses(streaks, lane, { n: 1, speed: .16, time: f.time, phase: si * .13, color: [.32, .85, 1], gain: 3 * rest, width: .09, tail: .05 });
      }
    }
    if (t > .1 && t < .86) ctx.hud.setHint('切换三类负载 · 拖动旋转 · 标注随结构定位');
    if (t > .9) ctx.hud.setHint('');
  },

  updateLoad(f, t, L, la, fmt, mm) {
    const { ctx } = this;
    const { pkg, streaks } = ctx.world;
    A(this.loadG, { opacity: L ? la : 0 });
    if (!L || la < .002) {
      return;
    }
    const time = f.time;
    const useFmt = L.fmt === 'cur' ? fmt : L.fmt;
    const peak = peakOfFormat(useFmt, false);
    setText(this.loadH, L.name);
    this.loadH.style.color = `var(${L.col})`;
    setText(this.loadD, L.desc);
    // 三类负载的读数：同一份输入的工作量，不同格式
    const bits = FORMATS[useFmt].effective;
    const util = { train: .92 + .05 * Math.sin(time * 2.1), infer: .55 + .25 * Math.max(0, Math.sin(time * 3.6)), sci: .68 + .08 * Math.sin(time * 1.2) }[L.id];
    setHTML(this.loadR, `<div><label>当前格式</label><b>${useFmt}</b><span>${L.fmtNote()}</span></div>
      <div><label>官方峰值（单 GPU）</label><b>${peak.v.toLocaleString('en-US')} ${peak.u}</b><span>${peak.noSparse ? 'FP64 · 无稀疏口径' : '稠密口径 · HGX 配置'}</span></div>
      <div><label>示意利用率</label><b>${Math.round(util * 100)}%</b><span>动画示意，非测量值</span></div>
      <div><label>每值占位</label><b>${bits} 位</b><span>${useFmt === 'FP4' ? '含每 16 值共享的 E4M3' : FORMATS[useFmt].label}</span></div>`);

    // 三维激活图：三类负载点亮的区域和节奏不同
    const load = {};
    for (const r of pkg.regions) {
      const die = r.die === 'A' ? 0 : 1;
      let a = 0;
      if (L.id === 'train') {
        if (r.kind === 'sm') a = .7 + .3 * Math.sin(time * 3 + (r.gpc + die * 5) * .8);
        else if (r.kind === 'hbi') a = .9;
        else if (r.kind === 'nvl') a = .85;
        else if (r.kind === 'phy' || r.kind === 'l2') a = .6;
      } else if (L.id === 'infer') {
        const batch = Math.floor(fract(time * .5) * 5);
        if (r.kind === 'sm') a = r.gpc === batch ? 1 : .08;
        else if (r.kind === 'phy') a = 1;
        else if (r.kind === 'l2') a = .75;
        else if (r.kind === 'dec') a = .9;
        else if (r.kind === 'hbi') a = .35;
      } else {
        if (r.kind === 'sm') a = (Math.floor(fract(time * .28) * 5) >= r.gpc) ? .55 : .1;
        else if (r.kind === 'l2') a = 1;
        else if (r.kind === 'ras') a = .9;
        else if (r.kind === 'nvl') a = .4 * (.5 + .5 * Math.sin(time * 1.4));
        else if (r.kind === 'phy') a = .5;
      }
      load[r.id] = a * la;
    }
    for (const id in load) f.act[id] = Math.max(f.act[id] || 0, load[id]);

    // 三维数据运动
    const c = L.rgb;
    const n = L.id === 'infer' ? 4 : L.id === 'train' ? 3 : 1;
    for (let si = 0; si < 8; si++) {
      const lane = pkg.pathHBMtoCompute(si, { lx: (si % 3 - 1) * 1.8, lz: (si % 2 - .5) * 3 });
      runPulses(streaks, lane, { n, speed: L.id === 'infer' ? .5 : L.id === 'train' ? .32 : .16, time, phase: si * .13, color: [.32, .85, 1], gain: 5.5 * la * L.mem, width: .09, tail: .06 });
    }
    f.seamAlive = drawSeamLanes(f, ctx, la * L.cross, { gain: 6, speed: L.id === 'train' ? 1 : .55 });
    for (const die of ['A', 'B']) for (let k = 0; k < 9; k++) {
      const path = pkg.pathNVLink(die, k);
      runPulses(streaks, path, { n: 1, speed: .3, time, phase: k * .11, color: [.82, .38, 1], gain: 7 * la * L.link, width: .12, tail: .12, from: .08 });
    }

    // ---- 二维动态图形（右下）：三种完全不同的过程 ----
    const ox = f.DW - 560, oy = f.DH - 270, W = 520, Hh = 130;
    A(this.loadLabel, { x: ox, y: oy - 14 });
    const lab = { train: `训练：批次损失随迭代下降 · 每根柱是一次跨缝同步（${useFmt}）`, infer: `推理：请求一批批进入，块宽按 ${useFmt} 分组`, sci: '科学计算：FP64 网格逐格更新，读数与全页精度无关' };
    setText(this.loadLabel, lab[L.id]);
    const showT = L.id === 'train', showI = L.id === 'infer', showS = L.id === 'sci';
    this.trainBars.forEach((b, i) => {
      if (!showT) { b.style.display = 'none'; return; }
      b.style.display = '';
      const v = .5 + .5 * Math.sin(time * 3.2 - i * .55);
      const h = 18 + v * 54;
      A(b, { x: ox + i * (W / 28), y: oy + Hh - h, width: W / 28 - 3, height: h, opacity: .3 + .7 * v });
    });
    if (showT) {
      let d = '';
      const seed = mm.rmse;
      for (let i = 0; i <= 56; i++) {
        const u = i / 56;
        const phase = fract(time * .05);
        const loss = Math.exp(-u * 3.2) * (1 - seed * .08) + .08 + Math.sin(u * 40 + time * 2) * .012 * (1 - u) + seed * .04;
        const x = ox + u * W, y = oy + Hh - loss * Hh;
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      A(this.lossPath, { d, opacity: 1 });
    } else A(this.lossPath, { opacity: 0 });
    const groups = { FP64: 2, TF32: 3, FP16: 4, BF16: 4, FP8: 6, FP4: 8 }[useFmt];
    this.inferDots.forEach((b, i) => {
      if (!showI) { b.style.display = 'none'; return; }
      b.style.display = '';
      const batch = Math.floor(i / groups);
      const u = fract(time * .32 - batch * .12);
      const x = ox + u * W + (i % groups) * (64 / groups);
      const yy = oy + 12 + (batch % 4) * 28;
      A(b, { x: x - 2, y: yy, width: Math.max(4, 54 / groups), height: 18, opacity: Math.sin(u * Math.PI) });
    });
    const front = Math.floor(fract(time * .14) * 64);
    this.grid.forEach((b, i) => {
      if (!showS) { b.style.display = 'none'; return; }
      b.style.display = '';
      const cx = i % 16, cy = Math.floor(i / 16);
      const heat = Math.exp(-Math.pow(((i - front + 64) % 64) / 9, 2));
      const val = .5 + .5 * Math.sin(cx * .9 + time * .6) * Math.cos(cy * 1.3 - time * .4);
      A(b, { x: ox + cx * (W / 16), y: oy + 6 + cy * 30, width: W / 16 - 2, height: 28, opacity: .12 + val * .3 + heat * .6 });
    });
  },

  updateEnding(f, t, fmt) {
    const { ctx } = this;
    const { pkg } = ctx.world;
    const P = f.proj;
    const a = sstep(.74, .84, t);
    const k = smoother(.76, .96, t);
    A(this.endG, { opacity: a * (1 - sstep(.97, 1, t) * .35) });
    vis(this.endG, a > .002);
    this.final.style.opacity = sstep(.82, .94, t).toFixed(3);
    vis(this.final, a > .1);
    this.final.style.transform = `translate3d(0,${(1 - sstep(.82, .94, t)) * 2}rem,0)`;
    this.credit.style.opacity = sstep(.9, .98, t).toFixed(3);
    vis(this.credit, sstep(.9, .98, t) > .002);
    this.credit.style.pointerEvents = t > .95 ? 'auto' : 'none';
    const draw = sstep(.8, .95, t);
    this.heroT.opacity(draw > .001 ? 1 : 0);
    if (draw > .001) this.heroT.draw(116, 150, 'B200', { draw, stagger: .12 });

    // 与开场呼应：208 格从四周的 8 个堆栈、接缝和晶粒汇聚回一格一格的读数
    if (a > .002) {
      const y1 = DIM.die.y0 + DIM.die.h + .03;
      const { w, d } = DIM.die;
      const qa = [P(-w / 2, y1, -d - .18), P(w / 2, y1, -d - .18), P(w / 2, y1, -.18), P(-w / 2, y1, -.18)];
      const qb = [P(-w / 2, y1, .18), P(w / 2, y1, .18), P(w / 2, y1, d + .18), P(-w / 2, y1, d + .18)];
      const bil = (q, u, v) => ({ x: lerp(lerp(q[0].x, q[1].x, u), lerp(q[3].x, q[2].x, u), v), y: lerp(lerp(q[0].y, q[1].y, u), lerp(q[3].y, q[2].y, u), v) });
      const cols = 26, tile = 13, gap = 3, ox = 120, oy = 728;
      const col = `rgb(${FORMAT_COLOR[fmt].map(v => Math.round(v * 255)).join(',')})`;
      const nu = 13, nv = 8;
      for (let i = 0; i < 208; i++) {
        const seed = hash1(i + 3);
        const e = smoother(seed * .35, .65 + seed * .35, k);
        const q = i < 104 ? qa : qb;
        const kk = i < 104 ? i : i - 104;
        const uu = kk % nu, vv = Math.floor(kk / nu);
        const pa = bil(q, (uu + .05) / nu, (vv + .05) / nv), pb = bil(q, (uu + .95) / nu, (vv + .05) / nv), pc = bil(q, (uu + .95) / nu, (vv + .95) / nv), pd = bil(q, (uu + .05) / nu, (vv + .95) / nv);
        const c = i % cols, r = Math.floor(i / cols);
        const X = ox + c * (tile + gap), Y = oy + r * (tile + gap);
        const arc = Math.sin(e * Math.PI) * (seed - .5) * 90;
        const pts = [[lerp(pa.x, X, e) + arc, lerp(pa.y, Y, e)], [lerp(pb.x, X + tile, e) + arc, lerp(pb.y, Y, e)], [lerp(pc.x, X + tile, e) + arc, lerp(pc.y, Y + tile, e)], [lerp(pd.x, X, e) + arc, lerp(pd.y, Y + tile, e)]];
        const el = this.endTiles[i];
        el.setAttribute('points', pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
        el.style.fill = col;
        el.setAttribute('opacity', (.35 + .65 * e).toFixed(2));
      }
    }
    const rA = sstep(.86, .96, t);
    this.endRead.opacity(rA);
    A(this.endReadL, { opacity: rA });
    if (rA > .002) {
      const pk = peakOfFormat(fmt, false);
      this.endRead.draw(120, 636, `${pk.v} ${pk.u === 'PFLOPS' ? 'PFLOPS' : 'TFLOPS'}`, { draw: rA, stagger: .05 });
      this.endRead.stroke(`rgb(${FORMAT_COLOR[fmt].map(v => Math.round(v * 255)).join(',')})`);
      A(this.endReadL, { x: 120, y: 714 });
      const macs = calc().mm.macs;
      setText(this.endReadL, `当前格式 ${fmt} · 单颗官方峰值（稠密，HGX 配置）· 你的 A·B 工作量 ${macs} 次乘加`);
    }
    setHTML(this.finalState, `当前精度 <b>${fmt}</b> · 下方每格 = 10 亿晶体管`);
  },
};
