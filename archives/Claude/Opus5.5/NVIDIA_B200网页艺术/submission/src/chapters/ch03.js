// 第 03 章：两颗晶粒与接缝。三维晶粒 ↔ 二维版图由同一组角点投影对齐；选中区域、激活图、缩略图是同一份状态。
import { S, A, H, Trace, beat, vis, setText, setHTML } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fract, hash1 } from '../core/util.js';
import { state, patch, subscribe } from '../core/state.js';
import { commValue, replayState, LINKS } from '../core/choreo.js';
import { DIM, KIND_COL, STACK_POS, STACK_DIE } from '../models/package.js';
import { runPulses, onePulse, wire, wireProgress } from '../core/flows.js';
import { drawSeamLanes } from '../core/seam.js';
import { createLocator } from '../ui/locator.js';
import { PolyPath } from '../gfx/kit.js';

export const KIND_VAR = { sm: '--sm', l2: '--l2', phy: '--hbm', hbi: '--hbi', nvl: '--nvl', hub: '--ink', dec: '--dec', ras: '--ras', sec: '--sec' };
const REGION_NOTE = {
  sm: '张量核心与浮点单元。一颗晶粒约 80 个计算单元，每单元 4 个张量核心（公开资料）；分组位置为示意。',
  l2: '共享二级缓存。跨缝访问对侧缓存时，软件不需要知道数据在哪颗晶粒上。',
  phy: '显存接口：每颗晶粒靠四个 HBM3e 堆栈，整颗 GPU 共 8 TB/s（显存带宽）。',
  hbi: '片间互连 NV-HBI：把两颗晶粒连成一颗 GPU，10 TB/s。这不是 NVLink。',
  nvl: 'NVLink 接口：通往别的 GPU（第 06 章）。第五代 NVLink 每 GPU 1.8 TB/s 双向。',
  hub: '控制中枢：调度与命令处理（示意位置）。',
  dec: '解压缩引擎：把压缩数据直接解到显存，减轻 CPU 负担（发布说明列出的专用引擎）。',
  ras: 'RAS 引擎：可靠性、可用性、可服务性的预防性诊断。',
  sec: '机密计算：接口加密，保护模型与数据。',
};

const STEPS = [
  { c: .0, t: '① 取数', d: 'HBM3e 把数据交给晶粒 A 的显存接口', col: '--hbm' },
  { c: .2, t: '② 缓存', d: '进入晶粒 A 的二级缓存', col: '--l2' },
  { c: .36, t: '③ 跨缝', d: '10 TB/s：晶粒 A → 接缝 → 晶粒 B', col: '--hbi' },
  { c: .55, t: '④ 对侧计算', d: '晶粒 B 的计算单元逐组点亮', col: '--sm' },
  { c: .72, t: '⑤ 协同', d: '中间结果跨缝返回，晶粒 A 随之激活', col: '--sm' },
  { c: .88, t: '⑥ 出口', d: 'NVLink 接口待命：下一站是别的 GPU', col: '--nvl' },
];

export default {
  from: -.02, to: 1.16,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch03', ctx.chaptersRoot, null, { 'aria-label': '第 03 章 接缝' });
    this.root = root;
    this.caps = [
      { a: -.01, b: .04, c: .19, d: .23, e: H('div', 'cap big c3-cap', root, '<div class="over">03 / 接缝</div><h2>一条线，<br>两颗晶粒</h2><p>镜头落到封装中央。左边晶粒 A，右边晶粒 B，中间是那条接缝——它决定了这是两颗芯片，还是一颗 GPU。</p>') },
      { a: .23, b: .26, c: .42, d: .45, e: H('div', 'cap c3-cap', root, '<div class="over">版图 · 标明含义的示意</div><h2>从硅片到版图</h2><p>三维晶粒压平成二维版图，每个区块仍贴在原来的硅面上。绿色是计算，蓝色是缓存，青色接显存，琥珀接对侧晶粒，紫色接别的 GPU。</p>') },
      { a: .45, b: .48, c: .8, d: .84, e: H('div', 'cap c3-cap', root, '<div class="over">通信过程</div><h2 class="c3-step"></h2><p class="c3-stepd"></p>') },
    ];
    this.stepH = this.caps[2].e.querySelector('.c3-step');
    this.stepD = this.caps[2].e.querySelector('.c3-stepd');
    this._legendHTML = (`
      <div><i class="lg-in"></i><b>晶粒内部</b><span>计算单元 ↔ 缓存</span></div>
      <div><i class="lg-d2d"></i><b>片间互连</b><span>两颗晶粒之间 · 10 TB/s</span></div>
      <div><i class="lg-nvl"></i><b>NVLink</b><span>GPU 之间 · 每颗 1.8 TB/s · 第 06 章</span></div>`);

    // ---- 右侧：激活缩略图 ----
    const p = H('aside', 'panel p03 pe', root, null, { 'aria-label': '功能区激活缩略图' });
    this.panel = p;
    H('div', 'over', p, '激活缩略图 · 点选功能区');
    this.thumb = S('svg', { viewBox: '0 0 340 250', class: 'c3-thumb' }, p);
    this.tRects = {};
    const regions = ctx.world.pkg.regions;
    // 接缝竖直：A 在左，B 在右。x 方向对应世界 z，y 方向对应世界 x
    const MX = 170, sc = 6.35, MY = 125;
    for (const r of regions) {
      const X0 = MX + r.z0 * sc, X1 = MX + r.z1 * sc;
      const Y0 = MY - r.x1 * sc * .96 + 0, Y1 = MY - r.x0 * sc * .96;
      const e = S('rect', { x: X0 + .5, y: Y0 + .5, width: Math.max(X1 - X0 - 1, 1), height: Math.max(Y1 - Y0 - 1, 1), class: 'c3-r', tabindex: 0, role: 'button', 'aria-label': `晶粒 ${r.die} ${r.name}`, style: `--c:var(${KIND_VAR[r.kind]})` }, this.thumb);
      e.addEventListener('click', () => this.selectRegion(r.id));
      e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.selectRegion(r.id); } });
      e.addEventListener('pointerenter', () => { this.hover = r.id; });
      e.addEventListener('pointerleave', () => { if (this.hover === r.id) this.hover = null; });
      this.tRects[r.id] = e;
    }
    S('line', { x1: MX, x2: MX, y1: 2, y2: 248, class: 'c3-tseam' }, this.thumb);
    this.tA = S('text', { x: 6, y: 246, class: 'c2-head' }, this.thumb, 'A');
    this.tB = S('text', { x: 326, y: 246, class: 'c2-head' }, this.thumb, 'B');
    this.info = H('div', 'p-info c3-info', p);
    this.row = H('div', 'p-row', p);
    this.bReplay = H('button', 'btn', this.row, '重放通信过程', { type: 'button' });
    this.bReplay.addEventListener('click', () => { replayState.t0 = this.ctx.f.time; });
    this.bClear = H('button', 'btn', this.row, '清除选择', { type: 'button' });
    this.bClear.addEventListener('click', () => patch({ region: null }));
    this.prog = H('div', 'c3-prog', p);
    this.progBars = STEPS.map(s => H('i', '', this.prog, null, { style: `--c:var(${s.col})` }));
    this.read = H('div', 'p-read', p);
    this.legend = H('div', 'c3-legend', p, this._legendHTML);

    // ---- SVG：贴在三维硅面上的版图 ----
    const g = S('g', { class: 'c3' }, ctx.ov);
    this.g = g;
    this.polys = {};
    for (const r of regions) {
      const e = S('polygon', { class: 'c3-poly', style: `--c:var(${KIND_VAR[r.kind]})` }, g);
      e.addEventListener('click', () => this.selectRegion(r.id));
      e.addEventListener('pointerenter', () => { this.hover = r.id; });
      e.addEventListener('pointerleave', () => { if (this.hover === r.id) this.hover = null; });
      this.polys[r.id] = e;
    }
    this.stackPolys = STACK_POS.map(() => S('polygon', { class: 'c3-stackp' }, g));
    this.stackLab = STACK_POS.map((_, i) => S('text', { class: 'c3-sl' }, g, `HBM ${i + 1}`));
    this.zoneLabs = [['A.gpc1', '计算单元'], ['A.l2', '二级缓存'], ['A.hbi', '片间互连'], ['A.phyL', '显存接口'], ['A.nvl', 'NVLink 接口'], ['A.dec', '解压缩'], ['A.ras', 'RAS'],
      ['B.gpc3', '计算单元'], ['B.l2r', '二级缓存'], ['B.hbi', '片间互连'], ['B.phyR', '显存接口'], ['B.nvl', 'NVLink 接口'], ['B.sec', '机密'], ['B.hub', '中枢']].map(([id, n]) => ({ id, e: S('text', { class: 'c3-zl' }, g, n) }));
    this.dieNames = [S('text', { class: 'c3-dn' }, g, '晶粒 A'), S('text', { class: 'c3-dn' }, g, '晶粒 B')];
    this.bigT = new Trace(g, { size: 92, cls: 'seamtr', weight: 8.5 });
    this.bigS = S('text', { class: 'c3-bigs' }, g, '片间互连 · 双向合计');
    this.one = S('g', { class: 'c3-one' }, g);
    this.oneA = S('rect', { class: 'c3-oneb' }, this.one);
    this.oneB = S('rect', { class: 'c3-oneb' }, this.one);
    this.oneO = S('rect', { class: 'c3-oneo' }, this.one);
    this.oneL = S('text', { class: 'c3-onel' }, this.one, '双晶粒');
    this.flowDots = [];
    const fg = S('g', { class: 'c3-dots' }, this.one);
    for (let i = 0; i < 14; i++) this.flowDots.push(S('rect', { width: 5, height: 2.4, class: 'c3-dot' }, fg));
    this.locG = S('g', {}, g);
    this.loc = createLocator(this.locG);
    subscribe(() => this.syncRegion());
    this.syncRegion();
    this.tmpA = {}; this.tmpB = {}; this.tmpC = {}; this.tmpD = {};
  },

  show(on) { vis(this.root, on); vis(this.g, on); },

  selectRegion(id) { patch({ region: state.region === id ? null : id }); },

  syncRegion() {
    const id = state.region;
    const pkg = this.ctx.world.pkg;
    if (id) {
      const r = pkg.regionById[id];
      setHTML(this.info, `<div class="over">晶粒 ${r.die}</div><h3 style="color:var(${KIND_VAR[r.kind]})">${r.name}</h3><p>${REGION_NOTE[r.kind]}</p>`);
    } else {
      setHTML(this.info, `<div class="over">未选择</div><h3>选一个区域</h3><p>三维中同一功能区和它的关联链路会同步反馈；进入后续版图和封装视图时，这组区域继续亮着。</p>`);
    }
    this.bClear.disabled = !id;
  },

  esc() { if (state.region) patch({ region: null }); },

  pick(ray) {
    const f = this.ctx.f;
    if (f.loc[2] < .2 || f.loc[2] > .9) return;
    const pkg = this.ctx.world.pkg;
    const y = DIM.die.y0 + DIM.die.h;
    const t = (y - ray.origin.y) / ray.direction.y;
    const x = ray.origin.x + ray.direction.x * t, z = ray.origin.z + ray.direction.z * t;
    for (const r of pkg.regions) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { this.selectRegion(r.id); return; }
  },
  hover(ray) {
    const f = this.ctx.f;
    if (f.loc[2] < .2 || f.loc[2] > .9) return null;
    const pkg = this.ctx.world.pkg;
    const y = DIM.die.y0 + DIM.die.h;
    const t = (y - ray.origin.y) / ray.direction.y;
    const x = ray.origin.x + ray.direction.x * t, z = ray.origin.z + ray.direction.z * t;
    for (const r of pkg.regions) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return `晶粒 ${r.die} · ${r.name}`;
    return null;
  },

  update(f, t) {
    const { ctx } = this;
    const { pkg, streaks } = ctx.world;
    const P = f.proj;
    const inPlace = t >= 0 && t <= 1;
    for (const c of this.caps) beat(c.e, t, c.a, c.b, c.c, c.d, { dist: 4 });
    const panelA = sstep(.2, .25, t) * (1 - sstep(.86, .92, t));
    this.panel.style.opacity = panelA.toFixed(3);
    vis(this.panel, panelA > .002);
    this.panel.style.pointerEvents = panelA > .6 ? '' : 'none';
    this.panel.style.transform = `translate3d(${(1 - panelA) * 2}rem,0,0)`;
    f.scrim = Math.max(f.scrim, pulse(.02, .08, .86, .92, t));
    if (panelA > .5) ctx.hud.setHint('点选缩略图或晶粒上的功能区 · 拖动旋转 · 可随时重放');
    f.exploreAvail = f.exploreAvail || (t > .2 && t < .85);

    // ---- 版图：3D ↔ 2D ----
    const y = DIM.die.y0 + DIM.die.h + pkg.parts.dieA.w.y;
    const flat = pulse(.2, .27, .4, .47, t);   // 压平段：填色最实
    const lineA = sstep(.1, .22, t) * (1 - sstep(1.03, 1.14, t));
    A(this.g, { opacity: 1 });
    const hover = this.hover;
    const c = f.comm;
    for (const r of pkg.regions) {
      const e = this.polys[r.id];
      if (lineA < .004) { if (e._on !== false) { e._on = false; e.style.display = 'none'; } continue; }
      if (e._on !== true) { e._on = true; e.style.display = ''; }
      const a = P(r.x0, y, r.z0, this.tmpA), b = P(r.x1, y, r.z0, this.tmpB), cc = P(r.x1, y, r.z1, this.tmpC), d = P(r.x0, y, r.z1, this.tmpD);
      e.setAttribute('points', `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${cc.x.toFixed(1)},${cc.y.toFixed(1)} ${d.x.toFixed(1)},${d.y.toFixed(1)}`);
      const act = f.act[r.id] || 0;
      const sel = state.region === r.id || (state.region && (LINKS[state.region] || []).includes(r.id));
      const fa = Math.max(flat * (r.kind === 'sm' ? .2 : .42), act * .12, sel ? .45 : 0, hover === r.id ? .35 : 0);
      e.style.fillOpacity = fa.toFixed(3);
      e.style.strokeOpacity = (lineA * (.35 + .65 * Math.max(flat, act, sel ? 1 : 0))).toFixed(3);
      e.style.pointerEvents = panelA > .5 ? 'auto' : 'none';
      // 缩略图：同一份激活
      const th = this.tRects[r.id];
      const cls = 'c3-r' + (state.region === r.id ? ' sel' : sel ? ' link' : '');
      if (th._c !== cls) { th._c = cls; th.setAttribute('class', cls); }
      th.style.fillOpacity = Math.max(.1, act * .85, hover === r.id ? .6 : 0).toFixed(3);
    }
    // 显存堆栈也在版图上（03→04 沿连接转向它们）
    const stackA = sstep(.84, .95, t) * (1 - sstep(1.06, 1.14, t)) + flat * .6;
    STACK_POS.forEach(([sx, sz], i) => {
      const yy = 4.6;
      const a = P(sx - 5.5, yy, sz - 5.9, this.tmpA), b = P(sx + 5.5, yy, sz - 5.9, this.tmpB), cc = P(sx + 5.5, yy, sz + 5.9, this.tmpC), d = P(sx - 5.5, yy, sz + 5.9, this.tmpD);
      A(this.stackPolys[i], { points: `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${cc.x.toFixed(1)},${cc.y.toFixed(1)} ${d.x.toFixed(1)},${d.y.toFixed(1)}`, opacity: stackA });
      A(this.stackLab[i], { x: (a.x + cc.x) / 2, y: (a.y + cc.y) / 2 + 4, opacity: stackA });
    });
    // 区块名：压平时可读
    const zla = pulse(.24, .29, .4, .45, t);
    for (const z of this.zoneLabs) {
      const r = pkg.regionById[z.id];
      const q = P(r.cx, y, r.cz, this.tmpA);
      A(z.e, { x: q.x, y: q.y + 4, opacity: zla, 'text-anchor': 'middle', style: `--c:var(${KIND_VAR[r.kind]})` });
    }
    const nameA = pulse(.06, .14, .8, .9, t);
    const nA = P(0, y, -25.6, this.tmpA), nB = P(0, y, 25.6, this.tmpB);
    A(this.dieNames[0], { x: nA.x, y: nA.y, opacity: nameA });
    A(this.dieNames[1], { x: nB.x, y: nB.y, opacity: nameA });

    // ---- 大读数 ----
    const bigA = pulse(.46, .5, .8, .84, t);
    this.bigT.opacity(bigA);
    A(this.bigS, { opacity: bigA });
    if (bigA > .002) {
      // 字形随跨缝流量轻微起伏
      const cross = pulse(.36, .46, .7, .82, c);
      this.bigT.draw(116, 700, '10 TB/S', {
        draw: sstep(.46, .54, t),
        deform: (u, v, i) => [u, v + Math.sin(u * 1.4 + f.time * 5 + i) * .18 * cross],
      });
      A(this.bigS, { x: 118, y: 830 });
    }

    // ---- “双晶粒，一颗 GPU” 示意：左下，两块合并 ----
    const oneA = pulse(.5, .55, .8, .84, t);
    const merged = sstep(.3, .6, c);
    const ox = 118, oy = 560, bw = 84, bh = 56;
    A(this.one, { opacity: oneA });
    if (oneA > .002) {
      const gap = lerp(26, 1.5, merged);
      A(this.oneA, { x: ox, y: oy, width: bw, height: bh });
      A(this.oneB, { x: ox + bw + gap, y: oy, width: bw, height: bh });
      A(this.oneO, { x: ox - 7, y: oy - 7, width: bw * 2 + gap + 14, height: bh + 14, opacity: merged });
      A(this.oneL, { x: ox + bw * 2 + gap + 24, y: oy + bh / 2 + 6 });
      setText(this.oneL, merged > .6 ? '软件看到的是一颗 GPU' : '两颗晶粒');
      this.flowDots.forEach((d, i) => {
        const dir = i % 2 ? 1 : -1;
        const u = fract(f.time * .7 + i / 14);
        const cx = ox + bw + gap / 2 + dir * (u - .5) * 76;
        A(d, { x: cx - 2.5, y: oy + 6 + (i % 7) * 7, opacity: merged * Math.sin(u * Math.PI) });
      });
    }

    // ---- 流程读数 ----
    let cur = 0;
    STEPS.forEach((s, i) => { if (c >= s.c) cur = i; });
    setText(this.stepH, STEPS[cur].t);
    setText(this.stepD, STEPS[cur].d + '。');
    this.stepH.style.color = `var(${STEPS[cur].col})`;
    this.progBars.forEach((b, i) => {
      const e = clamp((c - STEPS[i].c) / ((STEPS[i + 1]?.c ?? 1) - STEPS[i].c));
      b.style.setProperty('--p', e.toFixed(3));
    });
    const crossBW = 10 * (f.seamAlive ?? 1) * pulse(.36, .46, .8, .95, c);
    setText(this.read, replayState.t0 !== null && f.time - replayState.t0 < 6.4 ? `重放中 · 跨缝 ${crossBW.toFixed(1)} TB/s` : `跨缝 ${crossBW.toFixed(1)} TB/s · 激活 ${Math.round(this.activeShare(f) * 100)}% 区域`);

    // ---- 三维脉冲：有来源、路径、目的地 ----
    const flow = sstep(.42, .48, t) * (1 - sstep(.96, 1.1, t));
    if (flow > .01) {
      const time = f.time;
      // ① HBM → A 接口 → A 的 L2
      if (c > 0 && c < .6) {
        for (const si of [0, 1, 2, 3]) {
          const path = pkg.pathHBMtoCompute(si, { lx: (si % 2 - .5) * 2, lz: (si % 3 - 1) * 2 });
          const up = sstep(0, .22, c);
          runPulses(streaks, path, { n: 3, speed: .3, time, phase: si * .2, color: [.32, .85, 1], gain: 6 * flow * (1 - sstep(.45, .6, c)), width: .055, tail: .07, to: lerp(.3, .78, up) });
        }
      }
      // ③ 跨缝
      const lanes = pulse(.33, .42, .86, .98, c) * flow;
      f.seamAlive = drawSeamLanes(f, ctx, Math.max(lanes, .22 * flow), { gain: 7, lineGain: 1.1 });
      // ④⑤ 对侧 L2 → 计算单元
      const yd = DIM.die.y0 + DIM.die.h + .05;
      const toGpc = (die, g, a, b) => {
        const k = sstep(a, b, c) * flow;
        if (k < .01) return;
        const r = pkg.regionById[`${die}.gpc${g}`];
        const sign = die === 'A' ? -1 : 1;
        const path = this.pathInner(r, sign, yd);
        runPulses(streaks, path, { n: 3, speed: .55, time, phase: g * .17, color: [.72, 1, .2], gain: 5.5 * k, width: .045, tail: .1, from: 0, to: 1 });
        wire(streaks, path.pts, [.72, 1, .2], .22 * k, .012);
      };
      for (let g = 0; g < 5; g++) { toGpc('B', g, .55 + g * .04, .6 + g * .04); toGpc('A', g, .72 + g * .03, .76 + g * .03); }
      // ⑥ NVLink：出口待命
      const nv = sstep(.86, .96, c) * flow;
      if (nv > .01) {
        for (const die of ['A', 'B']) for (let k = 0; k < 9; k++) {
          const path = pkg.pathNVLink(die, k);
          runPulses(streaks, path, { n: 1, speed: .28, time, phase: k * .11, color: [.82, .38, 1], gain: 6 * nv, width: .07, tail: .12, from: .12 });
        }
      }
    }

    // 选中的关联链路：三维中也亮
    if (state.region && inPlace) {
      const r = pkg.regionById[state.region];
      this.drawLink(f, r);
    }

    // ---- 定位图 ----
    const locA = sstep(.12, .2, t) * (1 - sstep(1.02, 1.1, t));
    const rot = t < .86 ? 90 : lerp(90, 0, smoother(.86, 1.0, t));
    this.loc.update(f, 200, 390, locA * .9, rot);
  },

  activeShare(f) {
    const v = Object.values(f.act);
    return v.reduce((a, b) => a + b, 0) / v.length;
  },

  pathInner(r, sign, y) { return makeInner(r, sign, y); },

  drawLink(f, r) {
    const { streaks } = this.ctx.world;
    const y = DIM.die.y0 + DIM.die.h + .06;
    const col = KIND_COL[r.kind];
    const g = 1.6;
    const pts = [[r.x0, y, r.z0], [r.x1, y, r.z0], [r.x1, y, r.z1], [r.x0, y, r.z1], [r.x0, y, r.z0]];
    wire(streaks, pts, col, g, .03);
    const pkg = this.ctx.world.pkg;
    (LINKS[r.id] || []).forEach((id, k) => {
      const q = pkg.regionById[id];
      const path = new PolyPath([[r.cx, y, r.cz], [lerp(r.cx, q.cx, .5), y, r.cz], [lerp(r.cx, q.cx, .5), y, q.cz], [q.cx, y, q.cz]]);
      wire(streaks, path.pts, col, .5, .018);
      runPulses(streaks, path, { n: 3, speed: .6, time: f.time, phase: k * .3, color: col, gain: 7, width: .05, tail: .1 });
    });
  },
};

// 晶粒内部连接：从 L2 带到计算单元组
function makeInner(r, sign, y) {
  const path = new PolyPath([[r.cx * .4, y, sign * 4.1], [r.cx, y, sign * 6.5], [r.cx, y, r.cz]]);
  return path;
}
