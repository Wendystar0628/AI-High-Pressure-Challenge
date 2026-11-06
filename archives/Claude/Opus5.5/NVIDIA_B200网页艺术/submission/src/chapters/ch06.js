// 第 06 章：NVLink 与多卡系统。三维基板 ↔ 二维拓扑连续转换；八 GPU 分片任务由 05 章的同一份输入实际算出。
import * as THREE from 'three';
import { S, A, H, Trace, beat, vis, setText, setHTML } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fract, fmtNum, fmtBytes, hash1 } from '../core/util.js';
import { state, patch, subscribe, calc } from '../core/state.js';
import { FORMATS, FORMAT_ORDER, workload } from '../core/numerics.js';
import { FORMAT_COLOR } from '../core/choreo.js';
import { PolyPath } from '../gfx/kit.js';
import { runPulses, wire } from '../core/flows.js';

const NV = [.82, .38, 1];
const v3 = new THREE.Vector3();
const toRGB = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;

const TREE = [
  { id: 'b200', n: 'B200', x: 0, y: 40, s: '单颗 GPU' },
  { id: 'hgx', n: 'HGX B200', x: 150, y: 0, s: '8 GPU 平台' },
  { id: 'dgx', n: 'DGX B200', x: 320, y: 0, s: '完整系统' },
  { id: 'gb200', n: 'GB200', x: 150, y: 80, s: '1 Grace + 2 GPU' },
  { id: 'nvl72', n: 'GB200 NVL72', x: 320, y: 80, s: '36 + 72' },
];
const TREE_LINK = [['b200', 'hgx'], ['hgx', 'dgx'], ['b200', 'gb200'], ['gb200', 'nvl72']];

const CAPS = [
  { a: -.01, b: .03, c: .15, d: .18, h: '06 / 集群', t: '从一颗到八颗', p: '刚才那份数据，放不下时就分给更多 GPU。第五代 NVLink：每颗 GPU 1.8 TB/s 双向。这条线不是接缝——接缝在一颗 GPU 内部，NVLink 在 GPU 之间。' },
  { a: .18, b: .2, c: .275, d: .295, h: 'HGX B200', t: '基板与拓扑是同一张图', p: '八颗 B200、两颗 NVSwitch。每颗 GPU 18 条链路，一半接一颗交换芯片。节点从板上起飞，排成右边的拓扑，点选任一节点两边同时响应。' },
  { a: .295, b: .31, c: .52, d: .535, h: '分片任务', t: '', p: '' },
  { a: .535, b: .55, c: .6, d: .615, h: '容量', t: '单卡放不下时', p: '容量按逻辑数据量估算，不在浏览器里分配。同一个负载：换精度或加设备，所需 GPU 数立即变化。' },
  { a: .62, b: .64, c: .695, d: .71, h: 'DGX B200', t: '完整系统', p: 'HGX 级别的八颗 B200，加上 2 颗 Xeon 8570、ConnectX-7 与 BlueField-3 网络、6 个电源，装进 10 RU。这条产品线用 x86 CPU，不含 Grace。' },
  { a: .715, b: .735, c: .81, d: .825, h: 'GB200', t: '另一条线', p: '一颗 Grace CPU 通过 900 GB/s 的 NVLink-C2C 连接两颗 Blackwell GPU。两颗超级芯片组成一个计算托盘。' },
  { a: .83, b: .85, c: .935, d: .95, h: 'GB200 NVL72', t: '一个机柜，一个 NVLink 域', p: '18 个计算托盘（36 Grace + 72 B200）与 9 个交换托盘（18 颗交换芯片）。靠背部铜缆相连，总交换带宽 130 TB/s。' },
  { a: .95, b: .97, c: 1.02, d: 1.06, h: '成排', t: '更大的尺度', p: '每个机柜仍是同样的 72 颗。接下来把这些产品放到一起比较。' },
];

const PHASE = [
  { a: 0, b: .2, t: '① 分发', d: '发起 GPU 经 NVSwitch 把 8 份数据发往各卡。' },
  { a: .2, b: .5, t: '② 局部计算', d: '每颗 GPU 只算自己的 8 项乘加，得到局部结果。' },
  { a: .5, b: .75, t: '③ 归约', d: '局部矩阵沿交换链路送回并逐元素求和。' },
  { a: .75, b: 1, t: '④ 分发结果', d: '汇总结果广播回去，八颗 GPU 得到一致的数值。' },
];

export default {
  from: -.01, to: 1.06,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch06', ctx.chaptersRoot, null, { 'aria-label': '第 06 章 NVLink 与多卡系统' });
    this.root = root;
    this.caps = CAPS.map(c => ({ ...c, e: H('div', 'cap c6-cap', root, `<div class="over">${c.h}</div><h2>${c.t}</h2><p>${c.p}</p>`) }));
    this.taskH = this.caps[2].e.querySelector('h2');
    this.taskP = this.caps[2].e.querySelector('p');

    // ---- 面板 ----
    const p = H('aside', 'panel p06 pe', root, null, { 'aria-label': '多卡任务与容量控制' });
    this.panel = p;
    const col1 = H('div', 'p6-col', p);
    H('div', 'over', col1, '分片任务 · 用第 05 章的 A、B');
    this.taskRead = H('div', 'p6-read', col1);
    const rr = H('div', 'p-row', col1);
    this.bReplay = H('button', 'btn', rr, '从 GPU 1 重放', { type: 'button' });
    this.bReplay.addEventListener('click', () => { this.replayT = this.ctx.f.time; });
    this.rootRow = H('div', 'p-chips', col1, '<span class="p6-l">发起</span>');
    this.rootBtns = [];
    for (let i = 0; i < 8; i++) {
      const b = H('button', 'chip mini', this.rootRow, String(i + 1), { type: 'button', 'aria-label': `由 GPU ${i + 1} 发起任务` });
      b.addEventListener('click', () => { patch({ root: i, node: `g${i}` }); this.replayT = this.ctx.f.time; });
      this.rootBtns.push(b);
    }
    this.nodeInfo = H('div', 'p6-node', col1);
    const col2 = H('div', 'p6-col', p);
    H('div', 'over', col2, '负载规模 · 容量估算');
    const w = H('label', 'p-sl', col2, '<span class="p-sl-l">参数量</span><output></output>');
    this.slN = H('input', '', w, null, { type: 'range', min: 0, max: 1, step: .001, value: 0, 'aria-label': '负载参数量' });
    this.slOut = w.querySelector('output');
    this.slN.addEventListener('input', () => {
      const v = Math.round(Math.exp(lerp(Math.log(20), Math.log(6000), +this.slN.value)));
      patch({ params: v, paramsTouched: true });
    });
    this.capTable = H('div', 'p6-cap', col2);
    this.capNote = H('div', 'p6-note', col2, '按 HGX/DGX 配置每卡 180 GB 估算；FP4 含块缩放，每值 4.5 位。NVLink 1.8 TB/s 为单 GPU 双向合计。');
    this.replayT = null;

    // ---- SVG ----
    const g = S('g', { class: 'c6' }, ctx.ov);
    this.g = g;
    this.linkG = S('g', { class: 'c6-links' }, g);
    this.links = [];
    for (let gi = 0; gi < 8; gi++) for (let si = 0; si < 2; si++) {
      const e = S('path', { class: 'c6-link', tabindex: 0, role: 'button', 'aria-label': `链路：GPU ${gi + 1} 到 NVSwitch ${si + 1}` }, this.linkG);
      const select = () => patch({ node: `l${gi}-${si}` });
      e.addEventListener('click', select);
      e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(); } });
      this.links.push({ gi, si, e });
    }
    this.packets = [];
    const pg = S('g', {}, g);
    for (let i = 0; i < 40; i++) {
      const pk = S('g', { class: 'c6-pk' }, pg);
      const cells = [0, 1, 2, 3].map(() => S('rect', { class: 'c6-pc' }, pk));
      this.packets.push({ pk, cells });
    }
    // 节点
    this.nodes = [];
    for (let i = 0; i < 8; i++) {
      const n = S('g', { class: 'c6-node', tabindex: 0, role: 'button', 'aria-label': `GPU ${i + 1}` }, g);
      const box = S('rect', { class: 'c6-nb', width: 142, height: 100, x: -71, y: -50 }, n);
      const tl = S('text', { class: 'c6-nt', x: -63, y: -33 }, n, `GPU ${i + 1}`);
      const tag = S('text', { class: 'c6-ntag', x: 63, y: -33 }, n);
      const cells = [];
      for (let k = 0; k < 16; k++) cells.push(S('rect', { class: 'c6-cell', width: 11.5, height: 11.5, x: -63 + (k % 4) * 13, y: -24 + Math.floor(k / 4) * 13 }, n));
      const val = S('text', { class: 'c6-nv', x: 63, y: -4 }, n);
      const sub = S('text', { class: 'c6-ns', x: 63, y: 14 }, n);
      const mem = S('rect', { class: 'c6-mem', x: -7, y: 34, height: 5 }, n);
      const memB = S('rect', { class: 'c6-memb', x: -7, y: 34, width: 70, height: 5 }, n);
      const ring = S('circle', { class: 'c6-ring', r: 6 }, g);
      n.addEventListener('click', () => this.selectGPU(i));
      n.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.selectGPU(i); } });
      this.nodes.push({ i, n, box, tag, cells, val, sub, mem, memB, ring });
    }
    this.sw = [0, 1].map(i => {
      const n = S('g', { class: 'c6-sw', tabindex: 0, role: 'button', 'aria-label': `NVSwitch ${i + 1}` }, g);
      S('rect', { class: 'c6-swb', x: -82, y: -28, width: 164, height: 56 }, n);
      S('text', { class: 'c6-swt', x: 0, y: -4 }, n, `NVSwitch ${i + 1}`);
      const r = S('text', { class: 'c6-sws', x: 0, y: 15 }, n, '7.2 TB/s（示意）');
      const ring = S('circle', { class: 'c6-ring sw', r: 7 }, g);
      n.addEventListener('click', () => patch({ node: `s${i}` }));
      n.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); patch({ node: `s${i}` }); } });
      return { n, r, ring };
    });
    this.resultT = new Trace(g, { size: 28, cls: 'c6-res', weight: 2.8 });
    this.resultL = S('text', { class: 'c6-resl' }, g);
    this.bwT = new Trace(g, { size: 46, cls: 'c6-bw', weight: 4.6 });
    this.bwL = S('text', { class: 'c6-resl' }, g);

    // 系统标注
    this.ann = S('g', { class: 'c6-ann' }, g);
    this.anns = [];
    for (let i = 0; i < 7; i++) {
      const lg = S('g', { class: 'lead-g' }, this.ann);
      this.anns.push({ lg, line: S('path', { class: 'lead', fill: 'none' }, lg), dot: S('circle', { r: 3, class: 'dot' }, lg), t: S('text', { class: 'lab-name' }, lg), s: S('text', { class: 'lab-unit' }, lg) });
    }

    // NVL72 拓扑
    this.nvlG = S('g', { class: 'c6-nvl' }, g);
    this.nvlLines = S('path', { class: 'c6-nvll' }, this.nvlG);
    this.nvlHot = S('path', { class: 'c6-nvlh' }, this.nvlG);
    this.trayRows = [];
    for (let i = 0; i < 27; i++) {
      const tg = S('g', { class: 'c6-tray', tabindex: 0, role: 'button' }, this.nvlG);
      const bar = S('rect', { class: 'c6-trb' }, tg);
      const dots = [];
      const isC = i < 10 || i >= 19;
      for (let k = 0; k < (isC ? 4 : 2); k++) dots.push(S('rect', { class: 'c6-trd' + (isC ? '' : ' sw') }, tg));
      const cpus = [];
      if (isC) for (let k = 0; k < 2; k++) cpus.push(S('rect', { class: 'c6-trc' }, tg));
      const lab = S('text', { class: 'c6-trl' }, tg);
      tg.setAttribute('aria-label', isC ? `计算托盘 ${i < 10 ? i + 1 : i - 8}：4 GPU + 2 Grace` : `交换托盘 ${i - 9}：2 颗交换芯片`);
      const pick = () => patch({ node: `t${i}` });
      tg.addEventListener('click', pick);
      tg.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
      this.trayRows.push({ i, tg, bar, dots, cpus, lab, isC });
    }

    // 家族树
    this.treeG = S('g', { class: 'c6-tree' }, g);
    this.treeLinks = TREE_LINK.map(() => S('path', { class: 'c6-tl' }, this.treeG));
    this.tree = TREE.map(n => {
      const tg = S('g', { class: 'c6-tn', tabindex: 0, role: 'button', 'aria-label': n.n }, this.treeG);
      S('rect', { x: 0, y: 0, width: 124, height: 34, class: 'c6-tb' }, tg);
      S('text', { x: 8, y: 15, class: 'c6-tt' }, tg, n.n);
      S('text', { x: 8, y: 28, class: 'c6-ts' }, tg, n.s);
      return { ...n, tg };
    });

    subscribe(() => this.syncUI());
    this.syncUI();
    this.tmp = new THREE.Vector3();
    window.addEventListener('pointermove', e => { const f = ctx.f; this._mx = e.clientX / f.dscale; this._my = e.clientY / f.dscale; }, { passive: true });
  },

  selectGPU(i) { patch({ node: `g${i}`, root: i }); this.replayT = this.ctx.f.time; },
  // 三维拾取：比较投影距离，节点在画面上有多大就有多大的感应区
  nearest3D(ray) {
    const { ctx } = this;
    const f = ctx.f, t = f.loc[5];
    const { hgx, rack } = ctx.world;
    const x = (ray.origin.x + ray.direction.x * 1) , ndc = ray.clone();
    const mx = this._mx, my = this._my;
    if (mx === undefined) return null;
    let best = null, bd = 1e9;
    const test = (id, w, label, limit) => {
      const p = f.proj(w.x, w.y, w.z);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < limit && d < bd) { bd = d; best = { id, label }; }
    };
    if (t < .6) {
      for (let i = 0; i < 8; i++) test(`g${i}`, i === 0 ? v3.set(0, 4.5, 0) : hgx.gpuWorld(i, v3), `GPU ${i + 1}`, 66);
      for (let s = 0; s < 2; s++) test(`s${s}`, hgx.swWorld(s, v3), `NVSwitch ${s + 1}`, 46);
    } else if (t > .83 && t < .96) {
      rack.trays.forEach((s, i) => { if (s.kind !== 'power') test(`t${i - 4}`, rack.trayWorld(i, v3), s.kind === 'compute' ? '计算托盘' : '交换托盘', 18); });
    }
    return best;
  },
  pick(ray, e) {
    const f = this.ctx.f;
    if (e) { this._mx = e.clientX / f.dscale; this._my = e.clientY / f.dscale; }
    const hit = this.nearest3D(ray);
    if (!hit) return;
    if (hit.id[0] === 'g') this.selectGPU(+hit.id.slice(1));
    else patch({ node: hit.id });
  },
  hover(ray) {
    const f = this.ctx.f;
    const hit = this.nearest3D(ray);
    return hit ? hit.label : null;
  },
  esc() { if (state.node) patch({ node: null }); },
  syncUI() {
    this.rootBtns.forEach((b, i) => b.classList.toggle('on', state.root === i));
    setText(this.bReplay, `从 GPU ${state.root + 1} 重放`);
    if (!state.paramsTouched) { /* 滑块随滚动演示更新 */ }
  },
  show(on) { vis(this.root, on); vis(this.g, on); },

  update(f, t) {
    const { ctx } = this;
    const { hgx, rack, dgx, sc, streaks, pkg } = ctx.world;
    const P = f.proj;
    for (const c of this.caps) beat(c.e, t, c.a, c.b, c.c, c.d, { dist: 4 });

    const panelA = pulse(.26, .3, .6, .63, t);
    this.panel.style.opacity = panelA.toFixed(3);
    vis(this.panel, panelA > .002);
    this.panel.style.pointerEvents = panelA > .6 ? '' : 'none';
    f.exploreAvail = f.exploreAvail || (t > .02 && t < .2) || (t > .62);
    if (panelA > .5) ctx.hud.setHint('点选 GPU、交换芯片或链路 · 任一 GPU 都能发起并重放 · 拖动滑块改变负载');

    const { mm, task } = calc();
    const fmt = state.precision;
    const col = FORMAT_COLOR[fmt];
    const colS = toRGB(col);

    // 负载：未手动调整时，滚动演示“单卡放不下 → 两颗放得下”
    const demoN = lerp(300, 420, sstep(.54, .57, t));
    const paramsN = state.paramsTouched ? state.params : demoN;
    if (document.activeElement !== this.slN) this.slN.value = ((Math.log(paramsN) - Math.log(20)) / (Math.log(6000) - Math.log(20))).toFixed(3);
    setText(this.slOut, paramsN >= 1000 ? `${(paramsN / 1000).toFixed(2)} T` : `${Math.round(paramsN)} B`);
    this.updateCapacity(paramsN);
    f.wl = workload(paramsN, fmt, 180);

    // 任务进度
    let T = iv(.31, .52, t);
    const replaying = this.replayT !== null && !f.exporting;
    if (replaying) {
      const k = (f.time - this.replayT) / 9;
      if (k >= 1.15) this.replayT = null;
      else T = k >= 1 ? 1 : k;
    }
    let phase = 0;
    PHASE.forEach((ph, i) => { if (T >= ph.a) phase = i; });
    if (t > .295 && t < .535) {
      setText(this.taskH, PHASE[phase].t);
      setText(this.taskP, PHASE[phase].d);
    }
    setHTML(this.taskRead, this.taskText(T, phase, task, mm, fmt, f.wl));

    // ---- 节点位置：3D ↔ 拓扑 ----
    const morph = smoother(.17, .25, t) * (1 - smoother(.6, .64, t));
    const nodeA = sstep(.08, .14, t) * (1 - sstep(.6, .64, t));
    const LX = [1100, 1310, 1520, 1730], yTop = 262, yBot = 650;
    const nx = [], ny = [], anchors = [];
    for (let i = 0; i < 8; i++) {
      const w = i === 0 ? v3.set(0, 4.5, 0) : hgx.gpuWorld(i, v3);
      const a = P(w.x, w.y, w.z);
      anchors.push(a);
      const tx = LX[i % 4], ty = i < 4 ? yTop : yBot;
      nx[i] = lerp(a.x, tx, morph);
      ny[i] = lerp(a.y, ty, morph);
    }
    const swX = [], swY = [];
    for (let s = 0; s < 2; s++) {
      const w = hgx.swWorld(s, v3);
      const a = P(w.x, w.y, w.z);
      const tx = s === 0 ? 1205 : 1625, ty = (yTop + yBot) / 2;
      swX[s] = lerp(a.x, tx, morph); swY[s] = lerp(a.y, ty, morph);
      A(this.sw[s].n, { transform: `translate(${swX[s].toFixed(1)} ${swY[s].toFixed(1)}) scale(${lerp(.42, 1, morph)})`, opacity: nodeA });
      A(this.sw[s].ring, { cx: a.x, cy: a.y, opacity: nodeA * morph * .9 });
    }
    const sel = state.node;
    const selG = sel && sel[0] === 'g' ? +sel.slice(1) : -1;
    const selS = sel && sel[0] === 's' ? +sel.slice(1) : -1;
    const selL = sel && sel[0] === 'l' ? sel.slice(1).split('-').map(Number) : null;

    // 链路：板上走线 ↔ 拓扑曲线；链路随阶段生长
    const grow = sstep(.1, .22, t);
    const root = state.root;
    for (const L of this.links) {
      const x0 = nx[L.gi], y0 = ny[L.gi] + (L.gi < 4 ? 40 : -40) * morph, x1 = swX[L.si], y1 = swY[L.si] + (L.gi < 4 ? -22 : 22) * morph;
      const mx = lerp(x0, x1, .1), my = (y0 + y1) / 2;
      A(L.e, { d: `M${x0.toFixed(1)} ${y0.toFixed(1)}C${x0.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`, });
      L.e.style.opacity = (nodeA * grow * (L.gi === selG || L.si === selS ? 1 : .55)).toFixed(3);
      const on = L.gi === selG || L.si === selS || (selL && selL[0] === L.gi && selL[1] === L.si);
      const active = this.linkActive(T, L.gi, L.si, root);
      const cl = 'c6-link' + (on ? ' sel' : '') + (active > 0 ? ' act' : '');
      if (L.e._c !== cl) { L.e._c = cl; L.e.setAttribute('class', cl); }
    }
    // 节点内容：局部结果由真实分片算出
    this.nodes.forEach((N, i) => {
      A(N.n, { transform: `translate(${nx[i].toFixed(1)} ${ny[i].toFixed(1)}) scale(${lerp(.3, 1, morph)})`, opacity: nodeA });
      A(N.ring, { cx: anchors[i].x, cy: anchors[i].y, opacity: nodeA * morph * .9 });
      const sh = task.shards[i];
      const localK = sstep(.2 + hash1(i) * .08, .45 + hash1(i) * .04, T);
      const finalK = sstep(.86, .98, T);
      const maxP = Math.max(1e-6, ...task.R.flat().map(Math.abs));
      N.cells.forEach((c, k) => {
        const ii = Math.floor(k / 4), jj = k % 4;
        const vL = sh.P[ii][jj], vF = task.R[ii][jj];
        const v = finalK > .5 ? vF : vL * localK;
        const a = Math.min(1, Math.abs(v) / maxP);
        c.style.fill = v === 0 ? 'rgba(127,127,127,.14)' : (v > 0 ? colS : '#7aa4ff');
        c.style.fillOpacity = v === 0 ? 1 : (.25 + a * .75).toFixed(2);
      });
      const shown = finalK > .5 ? task.check : (phase >= 1 ? sh.sum * localK : 0);
      setText(N.val, (phase === 0 && T < .2) ? '—' : fmtNum(shown, 2));
      setText(N.sub, finalK > .5 ? '汇总 ✓' : (phase >= 1 ? `局部 ${sh.macs} 项` : `第 ${i + 1} 份`));
      setText(N.tag, (i === 0 ? '这一颗' : '') + (i === root ? (i === 0 ? ' · 发起' : '发起') : ''));
      const cl = 'c6-node' + (i === selG ? ' sel' : '') + (selL && selL[0] === i ? ' sel' : '') + (i === root ? ' root' : '') + (finalK > .5 ? ' done' : '');
      if (N.n._c !== cl) { N.n._c = cl; N.n.setAttribute('class', cl); }
      // 显存占用（每卡的这一份）
      const usage = clamp(f.wl.gb / 8 / 180);
      A(N.mem, { width: 70 * usage });
      N.mem.style.fill = colS;
      // 三维同步
      const heat = i === selG || (selL && selL[0] === i) ? .7 : (T > 0 && t > .3 && t < .56 ? Math.max(localK * (1 - sstep(.5, .6, T)) * .34, finalK * .22) : .03);
      const ca = (i === selG || (selL && selL[0] === i)) ? [1, 1, 1] : col;
      if (i > 0) { hgx.lite.glowDie(i, ca[0], ca[1], ca[2], heat); hgx.lite.glowHbm(i, .3, .85, 1, phase === 0 && T > .02 ? .25 : .03); }
      else f.dieBoost = Math.max(f.dieBoost || 0, heat * .9);
    });
    for (let s = 0; s < 2; s++) {
      const hot = s === selS || (selL && selL[1] === s) ? .9 : (this.linkActive(T, 0, s, root) > 0 ? .4 : .05);
      hgx.glowSw(s, NV[0], NV[1], NV[2], hot);
      this.sw[s].n.setAttribute('class', 'c6-sw' + (s === selS || (selL && selL[1] === s) ? ' sel' : ''));
    }
    // 三维链路脉冲
    if (t < .62) this.boardFlows(f, T, root, selG, selS, selL, morph);
    // 拓扑数据包：宽度、分组由精度决定
    this.updatePackets(f, T, nx, ny, swX, swY, morph, nodeA, root, fmt, colS);

    // 汇总数值
    const rA = sstep(.72, .86, T) * nodeA * morph;
    this.resultT.opacity(rA);
    A(this.resultL, { opacity: rA });
    if (rA > .002) {
      const yc = (yTop + yBot) / 2;
      this.resultT.draw(1415, yc - 14, fmtNum(task.check, 2), { anchor: 'middle' });
      this.resultT.stroke(colS);
      A(this.resultL, { x: 1415, y: yc + 30, 'text-anchor': 'middle' });
      setText(this.resultL, `Σ 汇总矩阵元素 · ${fmt}`);
    }
    // NVLink 带宽读数
    const bwA = pulse(.06, .1, .15, .18, t);
    this.bwT.opacity(bwA);
    A(this.bwL, { opacity: bwA });
    if (bwA > .002) {
      const yy = 330;
      this.bwT.draw(1040, yy, '1.8 TB/S', { draw: sstep(.06, .12, t), stagger: .08 });
      this.bwT.stroke('var(--nvl)');
      A(this.bwL, { x: 1042, y: yy + 74 });
      setText(this.bwL, '第五代 NVLink · 每颗 GPU · 18 条链路 × 100 GB/s 双向');
    }

    this.updateAnnotations(f, t);
    this.updateRack(f, t);
    this.updateTree(f, t);
  },

  linkActive(T, gi, si, root) {
    if (T <= 0 || T >= 1) return 0;
    const useSw = gi % 2;
    if (si !== useSw && gi !== root) return 0;
    if (T < .2 || (T > .5)) return 1;
    return 0;
  },

  boardFlows(f, T, root, selG, selS, selL, morph) {
    const { hgx, streaks, pkg } = this.ctx.world;
    const time = f.time;
    const a = f.loc[5] < .1 ? sstep(.04, .1, f.loc[5]) : 1;
    for (let gi = 0; gi < 8; gi++) for (let si = 0; si < 2; si++) {
      const on = gi === selG || si === selS || (selL && selL[0] === gi && selL[1] === si);
      const active = this.linkActive(T, gi, si, root) > 0 && f.loc[5] > .3;
      if (!on && !active && f.loc[5] > .2) continue;
      const pts = hgx.linkWorld(gi, si);
      const path = new PolyPath(pts);
      const g = on ? 10 : 6;
      const dir = (T > .5 && T < .75);
      runPulses(streaks, dir ? path : new PolyPath(pts.slice().reverse()), { n: 3, speed: .45, time, phase: gi * .11, color: NV, gain: g * a, width: 1.1, tail: .08 });
      if (on) wire(streaks, pts, NV, 1.2, .45);
    }
    // 空闲时也有低强度的 NVLink 脉冲（建立链路生长的感受）
    const idle = pulse(.06, .12, .18, .24, f.loc[5]);
    if (idle > .01) {
      for (let gi = 1; gi < 8; gi++) for (let si = 0; si < 2; si++) {
        const pts = hgx.linkWorld(gi, si);
        const path = new PolyPath(pts);
        const grow = sstep(.06 + gi * .008, .14 + gi * .008, f.loc[5]);
        wire(streaks, pts.slice(0, Math.ceil(pts.length * grow)), NV, .5 * idle, .4);
        runPulses(streaks, path, { n: 2, speed: .4, time, phase: gi * .13, color: NV, gain: 5 * idle, width: .9, tail: .1 });
      }
    }
  },

  updatePackets(f, T, nx, ny, swX, swY, morph, nodeA, root, fmt, colS) {
    const F = FORMATS[fmt];
    const w = clamp(F.effective * 1.4, 6, 40);
    let n = 0;
    const put = (xa, ya, xb, yb, xc, yc, u, op) => {
      if (n >= this.packets.length) return;
      const pk = this.packets[n++];
      const k = u * 2;
      let x, y;
      if (k < 1) { x = lerp(xa, xb, k); y = lerp(ya, yb, k); } else { x = lerp(xb, xc, k - 1); y = lerp(yb, yc, k - 1); }
      A(pk.pk, { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: op * nodeA * morph });
      const groups = fmt === 'FP4' ? 4 : fmt === 'FP8' ? 2 : 1;
      pk.cells.forEach((c, i) => {
        if (i < groups) {
          c.style.display = '';
          const cw = w / groups;
          A(c, { x: -w / 2 + i * cw, y: -4.5, width: cw - .8, height: 9 });
          c.style.fill = colS;
        } else c.style.display = 'none';
      });
    };
    const su = gi => gi % 2;
    if (T > 0 && T < .2) {
      const u = T / .2;
      for (let i = 0; i < 8; i++) {
        if (i === root) continue;
        for (let k = 0; k < 2; k++) {
          const uu = clamp(u * 1.3 - k * .3 - i * .01);
          if (uu <= 0 || uu >= 1) continue;
          const s = su(i);
          put(nx[root], ny[root], swX[s], swY[s], nx[i], ny[i], uu, 1);
        }
      }
    } else if (T >= .5 && T < .75) {
      const u = (T - .5) / .25;
      for (let i = 0; i < 8; i++) {
        if (i === root) continue;
        const uu = clamp(u * 1.2 - i * .015);
        if (uu <= 0 || uu >= 1) continue;
        const s = su(i);
        put(nx[i], ny[i], swX[s], swY[s], nx[root], ny[root], uu, 1);
      }
    } else if (T >= .75 && T < 1) {
      const u = (T - .75) / .25;
      for (let i = 0; i < 8; i++) {
        if (i === root) continue;
        const uu = clamp(u * 1.2 - i * .015);
        if (uu <= 0 || uu >= 1) continue;
        const s = su(i);
        put(nx[root], ny[root], swX[s], swY[s], nx[i], ny[i], uu, 1);
      }
    }
    for (let i = n; i < this.packets.length; i++) if (this.packets[i]._h !== 1 || true) A(this.packets[i].pk, { opacity: 0 });
  },

  taskText(T, phase, task, mm, fmt, wl) {
    const rootName = `GPU ${state.root + 1}`;
    const per = wl.shardGB;
    return `<div class="p6-big">${PHASE[phase].t}</div>
    <div>发起：${rootName} · 每份 ${task.shards[0].macs}–${Math.max(...task.shards.map(s => s.macs))} 项乘加（共 ${mm.macs} 项）</div>
    <div>平台负载：每卡这一份 ${fmtBytes(per)}（${fmt}）</div>
    <div>汇总检验：Σ = ${fmtNum(task.check, 3)}${state.sparse ? ' · 稀疏' : ' · 稠密'}</div>`;
  },

  updateCapacity(N) {
    const rows = FORMAT_ORDER.map(id => {
      const w = workload(N, id, 180);
      const bar = Math.min(100, w.gb / 180 * 100);
      return `<tr class="${id === state.precision ? 'on' : ''}"><td>${id}</td><td>${fmtBytes(w.gb)}</td><td><span class="p6-bar"><i style="width:${bar.toFixed(1)}%" class="${w.fitsSingle ? '' : 'over'}"></i></span></td><td>${w.fitsSingle ? '单卡' : `${w.gpus} 卡`}</td><td>${w.hgx} 块 HGX</td><td>${w.nvl} 柜</td></tr>`;
    }).join('');
    setHTML(this.capTable, `<table><thead><tr><th>格式</th><th>显存</th><th>单卡占用</th><th>需要</th><th colspan="2">平台</th></tr></thead><tbody>${rows}</tbody></table>`);
  },

  updateAnnotations(f, t) {
    const { ctx } = this;
    const { dgx, sc, rack, hgx } = ctx.world;
    const P = f.proj;
    const dA = pulse(.62, .65, .695, .71, t);
    const sA = pulse(.72, .745, .805, .825, t);
    const list = [];
    if (dA > .002) {
      const w = (x, y, z) => { const v = dgx.group.localToWorld(new THREE.Vector3(x, y, z)); return v; };
      list.push(['八颗 B200 + 2 NVSwitch', '基板级与 HGX 同构', w(0, 50, 60), dA, '--sm'], ['2 × Xeon Platinum 8570', '112 核 · x86', w(-112, 400, 100), dA, '--ink'], ['8 × ConnectX-7 / 2 × BlueField-3', '网络', w(100, 380, -360), dA, '--hbm'], ['6 × 3.3 kW 电源', '5+1 冗余', w(-120, 30, -440), dA, '--ras']);
    }
    if (sA > .002) {
      const gp0 = sc.gpuWorld(0), gp1 = sc.gpuWorld(1), cp = sc.cpuWorld();
      list.push(['B200 · 与前面拆开的封装同款', '每颗 186 GB · GB200 配置', gp0, sA, '--sm'], ['第二颗 B200', '两颗共 372 GB · 16 TB/s', gp1, sA, '--sm'], ['Grace CPU', '72 核 Arm · LPDDR5X · NVLink-C2C 900 GB/s', cp, sA, '--sec']);
    }
    this.anns.forEach((a, i) => {
      const it = list[i];
      if (!it) { A(a.lg, { opacity: 0 }); return; }
      const [name, sub, w, op, col] = it;
      const p = P(w.x, w.y, w.z);
      const tx = 1060, ty = 318 + i * 62;
      const e = op;
      const ex = lerp(p.x, tx - 12, e), ey = lerp(p.y, ty, e);
      A(a.line, { d: `M${p.x} ${p.y}L${lerp(p.x, tx - 40, e)} ${ey}L${ex} ${ey}` });
      A(a.dot, { cx: p.x, cy: p.y });
      A(a.t, { x: tx, y: ty }); setText(a.t, name);
      A(a.s, { x: tx, y: ty + 18 }); setText(a.s, sub);
      A(a.lg, { opacity: op, style: `--c:var(${col})` });
    });
    // 三维：超级芯片上的 B200 持续发光，表示同一颗
    if (sA > .002) {
      sc.lite.glowDie(0, .5, 1, .06, sA * .55);
      sc.lite.glowDie(1, .5, 1, .06, sA * .22);
      sc.glowCpu(.25, .9, .7, sA * .35);
    }
  },

  updateRack(f, t) {
    const { ctx } = this;
    const { rack, streaks } = ctx.world;
    const P = f.proj;
    const a = pulse(.835, .86, .945, .965, t);
    A(this.nvlG, { opacity: a });
    vis(this.nvlG, a > .002);
    // 所有托盘：默认状态灯
    const fmt = state.precision;
    const col = FORMAT_COLOR[fmt];
    const sel = state.node && state.node[0] === 't' ? +state.node.slice(1) : -1;
    rack.trays.forEach((s, i) => {
      if (s.kind === 'power') { rack.glowTray(i, 0, 0, 0, 0); return; }
      const idx = i - 4; // 机柜位置 → 托盘序号
      const hot = idx === sel;
      const wave = Math.max(0, Math.sin(f.time * 2.4 - i * .35));
      if (s.kind === 'switch') rack.glowTray(i, NV[0], NV[1], NV[2], (hot ? 3 : .6 + wave * .5) * sstep(.82, .87, t));
      else rack.glowTray(i, col[0], col[1], col[2], (hot ? 3 : .35 + wave * .4) * sstep(.82, .87, t));
    });
    if (a < .002) return;
    // 托盘行：先贴在三维前脸上，再展开成二部图
    const m = smoother(.875, .905, t);
    const lx = 1060, rx = 1760, top = 186, step = 26;
    const leftRows = [], swRows = [];
    let hotPath = '', allPath = '';
    for (const R of this.trayRows) {
      const s = rack.trays[R.i + 4];
      const w = rack.trayWorld(R.i + 4, v3);
      const p = P(w.x, w.y, w.z);
      const hw = Math.abs(P(w.x + 268, w.y, w.z).x - p.x);
      const tx = R.isC ? lx : rx - 150;
      const k = R.i < 10 ? R.i : R.i >= 19 ? R.i - 9 : R.i - 10;
      const ty = R.isC ? top + k * step : top + 90 + k * step * 2.2;
      const X = lerp(p.x - hw, tx, m), Y = lerp(p.y - 4, ty, m), W = lerp(hw * 2, 190, m), Hh = lerp(4, 20, m);
      A(R.bar, { x: X, y: Y - Hh / 2, width: W, height: Hh });
      R.dots.forEach((d, n) => {
        const cw = 26, x0 = X + 42;
        A(d, { x: x0 + n * cw * m + (1 - m) * n * W / R.dots.length * .9, y: Y - lerp(1.5, 7, m), width: lerp(3, 18, m), height: lerp(3, 14, m) });
      });
      R.cpus.forEach((d, n) => A(d, { x: X + 4 + n * 18, y: Y - 6, width: 14, height: 12, opacity: m }));
      A(R.lab, { x: X + W + 6, y: Y + 4, opacity: m });
      setText(R.lab, R.isC ? `计算 ${k + 1}` : `交换 ${k + 1}`);
      const cl = 'c6-tray' + (R.i === sel ? ' sel' : '') + (R.isC ? '' : ' swt');
      if (R.tg._c !== cl) { R.tg._c = cl; R.tg.setAttribute('class', cl); }
      if (R.isC) leftRows.push({ R, x: X + W, y: Y });
      else swRows.push({ R, x: X, y: Y });
    }
    // 全互联：每个计算托盘连到每个交换托盘
    for (const c of leftRows) for (const s of swRows) {
      const seg = `M${c.x.toFixed(0)} ${c.y.toFixed(0)}C${(c.x + 120).toFixed(0)} ${c.y.toFixed(0)} ${(s.x - 120).toFixed(0)} ${s.y.toFixed(0)} ${s.x.toFixed(0)} ${s.y.toFixed(0)}`;
      allPath += seg;
      if (c.R.i === sel || s.R.i === sel) hotPath += seg;
    }
    A(this.nvlLines, { d: m > .02 ? allPath : '', opacity: m * .4 });
    A(this.nvlHot, { d: hotPath, opacity: m });
    // 三维中铜缆脊上的脉冲
    const g = sstep(.86, .9, t) * (1 - sstep(.93, .96, t));
    if (g > .01) {
      const RX = rack.home.x, RY = rack.home.y;
      for (const x of [-210, -70, 70, 210]) {
        const u = fract(f.time * .3 + x * .003);
        const yy = RY + lerp(120, 2100, u);
        streaks.add(RX + x, yy - 60, -530, RX + x, yy + 60, -530, 7 * NV[0] * g, 7 * NV[1] * g, 7 * NV[2] * g, 4);
      }
    }
  },

  updateTree(f, t) {
    const { ctx } = this;
    const a = sstep(.04, .1, t) * (1 - sstep(1.0, 1.05, t));
    const ox = f.DW - 540, oy = f.DH - 164;
    const inPanel = pulse(.26, .3, .6, .63, t);
    A(this.treeG, { transform: `translate(${ox} ${oy - inPanel * 0})`, opacity: a * (1 - inPanel) });
    vis(this.treeG, a * (1 - inPanel) > .002);
    const cur = t < .2 ? 'b200' : t < .6 ? 'hgx' : t < .71 ? 'dgx' : t < .83 ? 'gb200' : 'nvl72';
    this.tree.forEach(n => {
      A(n.tg, { transform: `translate(${n.x} ${n.y})`, class: 'c6-tn' + (n.id === cur ? ' on' : '') });
    });
    TREE_LINK.forEach(([a0, b0], i) => {
      const A0 = TREE.find(n => n.id === a0), B0 = TREE.find(n => n.id === b0);
      A(this.treeLinks[i], { d: `M${A0.x + 124} ${A0.y + 17}C${A0.x + 140} ${A0.y + 17} ${B0.x - 16} ${B0.y + 17} ${B0.x} ${B0.y + 17}` });
    });
  },
};
