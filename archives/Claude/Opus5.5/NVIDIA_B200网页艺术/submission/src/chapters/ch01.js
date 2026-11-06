// 第 01 章：一颗完整的封装。开场由“时间与滚动的较大者”推进，所以开场中途滚动也能直接接入下一段。
import { S, A, H, Trace, beat, vis, setText } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fract, easeOut, hash1, fmtInt } from '../core/util.js';
import { DIM, KIND_COL } from '../models/package.js';
import { orbitWeight } from '../core/choreo.js';

const SCAN = [
  { id: 'substrate', t0: .03, name: '封装基板', val: '92×84', unit: 'MM · 9 层', col: '--ink', anchor: [40, 2.7, 34] },
  { id: 'stiffener', t0: .08, name: '加固环 + 去耦', val: '90×82', unit: 'MM · 不锈钢', col: '--ink', anchor: [40, 4.2, -18] },
  { id: 'interposer', t0: .13, name: '中介层', val: '60×52', unit: 'MM · 硅桥', col: '--hbi', anchor: [28.8, 3.56, 24] },
  { id: 'hbm', t0: .18, name: 'HBM3E 堆栈', val: '8×24', unit: 'GB · 八层 DRAM', col: '--hbm', anchor: [23.4, 4.6, 6.2] },
  { id: 'die', t0: .23, name: '计算晶粒', val: '2', unit: '颗 · 接近光罩极限', col: '--sm', anchor: [6, 4.5, 10] },
];

const TILES = 208;
export default {
  from: -1, to: 1.02,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch01', ctx.chaptersRoot, null, { 'aria-label': '第 01 章 整颗' });
    this.root = root;
    this.title = H('div', 'c1-title', root, `
      <div class="over">NVIDIA B200 · BLACKWELL · 网页艺术</div>
      <h1 class="c1-h1">双晶一芯</h1>
      <p class="c1-p">两颗晶粒组成一颗 GPU。<br>从这颗完整的封装出发，把它拆开，沿数据走进显存与计算，<br>再退到机柜——最后回到这一颗。</p>`);
    this.h1 = this.title.querySelector('.c1-h1');
    this.scaleLab = H('div', 'c1-odolab', root, '个晶体管 · 台积电 4NP · 下方每格代表 10 亿个');
    this.twoLab = H('div', 'c1-two', root, `<b>两颗晶粒，一颗 GPU</b><span>接缝两侧共享同一套缓存视图与调度：软件只看见一颗 GPU。<br>每颗晶粒约 1,040 亿个晶体管（按总数对半估算）。</span>`);
    this.scrollCue = H('div', 'c1-cue', root, '<span>向下滚动</span><i></i>');

    const g = S('g', { class: 'c1' }, ctx.ov);
    this.g = g;
    this.tb = new Trace(g, { size: 186, cls: 'hero', weight: 15 });
    this.odo = new Trace(g, { size: 42, cls: 'odo', weight: 4.2 });
    // 208 个方格：既是读数，也是晶粒单元
    this.tiles = [];
    const tg = S('g', { class: 'c1-tiles' }, g);
    for (let i = 0; i < TILES; i++) this.tiles.push(S('polygon', { class: 'c1-tile' }, tg));
    this.dieOut = [S('path', { class: 'c1-die' }, g), S('path', { class: 'c1-die' }, g)];
    this.oneOut = S('path', { class: 'c1-one' }, g);
    this.oneTrace = new Trace(g, { size: 34, cls: 'one', weight: 3.2 });
    // 部件识别：引线 + 读数
    this.labels = SCAN.map(s => {
      const lg = S('g', { class: 'c1-lab' }, g);
      const line = S('path', { class: 'lead', fill: 'none' }, lg);
      const dot = S('circle', { r: 3.5, class: 'dot' }, lg);
      const name = S('text', { class: 'lab-name' }, lg, s.name);
      const unit = S('text', { class: 'lab-unit' }, lg, s.unit);
      const tr = new Trace(lg, { size: 30, cls: 'lab', weight: 3 });
      return { ...s, lg, line, dot, name, unit, tr };
    });
    this.scanBar = S('g', { class: 'c1-scan' }, g);
    this.scanTicks = SCAN.map(() => S('rect', { width: 34, height: 3 }, this.scanBar));
    this.scanTxt = S('text', { class: 'lab-unit' }, this.scanBar);
    this.pOut = {};
  },
  show(on) { vis(this.root, on); vis(this.g, on); },
  update(f, t) {
    const { ctx } = this;
    const pkg = ctx.world.pkg;
    const i = ctx.introAmount(f.p, f.time);
    const out = sstep(.8, .98, t);
    const P = f.proj;

    // ---- 标题 ----
    const titleIn = sstep(.28, .72, i);
    const titleA = titleIn * (1 - sstep(.54, .62, t));
    this.title.style.opacity = titleA.toFixed(3);
    this.title.style.transform = `translate3d(0,${(1 - titleIn) * 1.2 - sstep(.54, .62, t) * 3}rem,0)`;
    vis(this.title, titleA > .002);
    const draw = sstep(.15, .7, i) * (1 - sstep(.7, .9, t));
    this.tb.draw(116, 150 - sstep(.66, .9, t) * 90, 'B200', { draw, stagger: .12 });
    this.tb.opacity(draw > .001 ? 1 : 0);

    // ---- 晶体管读数：字形从 0 走到 208,000,000,000，逐位变形 ----
    const v = 208e9 * easeOut(sstep(.3, .92, i));
    const a = sstep(.36, .7, i) * (1 - sstep(.52, .6, t));
    const odoY = 636;
    if (a > .002) {
      const s = fmtInt(v);
      const target = '208,000,000,000';
      // 字符位对齐到 15 位
      const pad = s.padStart(15, ' ');
      // 逐位变形
      let next = '';
      for (let k = 0; k < 15; k++) {
        const ch = pad[k];
        if (ch >= '0' && ch <= '9' && k >= 8) next += String((+ch + 1) % 10);
        else next += ch;
      }
      const frac = 1 - fract(v / 1e8);
      this.odo.draw(120, odoY, pad.trimStart().length < 15 ? pad.replace(/ /g, ' ') : pad, { from: i >= .92 ? null : next, t: i >= .92 ? 1 : Math.pow(frac, 5) });
      this.odo.opacity(a);
    } else this.odo.opacity(0);
    this.scaleLab.style.opacity = a.toFixed(3);
    vis(this.scaleLab, a > .002);

    // ---- 部件识别：扫描到谁，谁亮、谁的读数生长 ----
    const scanI = t * 1;
    const labA = sstep(.9, 1, i) * (1 - sstep(.3, .36, t));
    // 开场刚结束时，让识别按时间也能走完前两项：t 由滚动给，时间兜底
    const auto = clamp((f.time - 4.2) * .012);
    const tt = Math.max(t, Math.min(.03 + auto, .1));
    let found = 0;
    const lx = 1560;
    this.labels.forEach((L, k) => {
      const e = sstep(L.t0, L.t0 + .035, tt) * labA;
      const y = 196 + k * 118;
      if (sstep(L.t0, L.t0 + .035, tt) > .5) found++;
      if (e <= .001) { L.lg.setAttribute('opacity', 0); return; }
      const an = P(L.anchor[0] + pkg.parts.substrate.w.x, L.anchor[1], L.anchor[2]);
      const occ = pkg.occluded(f.camPos, { x: L.anchor[0], y: L.anchor[1], z: L.anchor[2] });
      const ex = lerp(an.x, lx - 24, e);
      const ey = lerp(an.y, y, e);
      A(L.line, { d: `M${an.x} ${an.y} L${ex - (ex - an.x) * .16} ${ey} L${ex} ${ey}`, 'stroke-dasharray': occ ? '3 4' : 'none' });
      A(L.dot, { cx: an.x, cy: an.y, class: occ ? 'dot hollow' : 'dot' });
      A(L.lg, { opacity: e, style: `--c:var(${L.col})` });
      A(L.name, { x: lx, y: y - 28 });
      L.tr.draw(lx, y - 18, L.val, { draw: e });
      A(L.unit, { x: lx + 8 + L.val.length * 26, y: y + 10 });
    });
    // 三维同步高亮
    const pick = id => {
      const s = SCAN.find(x => x.id === id);
      return pulse(s.t0, s.t0 + .02, s.t0 + .05, s.t0 + .1, tt) * labA;
    };
    pkg.highlight('substrate', pick('substrate') * .035, 0xffe8c8);
    pkg.highlight('stiffener', pick('stiffener') * .05, 0xfff0d8);
    pkg.highlight('decaps', pick('stiffener') * .08, 0xfff0d8);
    pkg.highlight('interposer', pick('interposer') * .3, 0xff9a2e);
    for (let k = 0; k < 8; k++) pkg.highlight(`hbm${k}`, pick('hbm') * .42, 0x56d8ff);
    f.scanDie = pick('die');

    A(this.scanBar, { transform: `translate(${lx} ${196 + 5 * 118 - 48})`, opacity: labA });
    this.scanTicks.forEach((r, k) => A(r, { x: k * 40, y: 0, class: k < found ? 'on' : '' }));
    A(this.scanTxt, { x: 0, y: 26 });
    setText(this.scanTxt, `已识别 ${found} / ${SCAN.length} 类部件`);

    // ---- 208 格 → 两颗晶粒 ----
    const reform = smoother(.34, .6, t);
    const fieldA = sstep(.42, .75, i) * (1 - out);
    const y1 = DIM.die.y0 + DIM.die.h + .03;
    const { w, d } = DIM.die;
    const corners = {
      A: [P(-w / 2, y1, -d - .18), P(w / 2, y1, -d - .18), P(w / 2, y1, -.18), P(-w / 2, y1, -.18)],
      B: [P(-w / 2, y1, .18), P(w / 2, y1, .18), P(w / 2, y1, d + .18), P(-w / 2, y1, d + .18)],
    };
    const bil = (q, u, v, o = {}) => {
      o.x = lerp(lerp(q[0].x, q[1].x, u), lerp(q[3].x, q[2].x, u), v);
      o.y = lerp(lerp(q[0].y, q[1].y, u), lerp(q[3].y, q[2].y, u), v);
      return o;
    };
    const cols = 26, tile = 13, gap = 3, ox = 120, oy = 728;
    const nu = 13, nv = 8;
    const pa = {}, pb = {}, pc = {}, pd = {};
    const glowWave = pulse(.6, .66, .74, .8, t);
    for (let k = 0; k < TILES; k++) {
      const c = k % cols, r = Math.floor(k / cols);
      const seed = hash1(k + 3);
      const local = smoother(seed * .4, .6 + seed * .4, reform);
      const X = ox + c * (tile + gap), Y = oy + r * (tile + gap);
      const q = k < 104 ? corners.A : corners.B;
      const kk = k < 104 ? k : k - 104;
      const uu = (kk % nu), vv = Math.floor(kk / nu);
      const m = .03;
      const u0 = (uu + m) / nu, u1 = (uu + 1 - m) / nu, v0 = (vv + m) / nv, v1 = (vv + 1 - m) / nv;
      bil(q, u0, v0, pa); bil(q, u1, v0, pb); bil(q, u1, v1, pc); bil(q, u0, v1, pd);
      // 飞行中有一点弧度
      const arc = Math.sin(local * Math.PI) * (seed - .5) * 120;
      const lx0 = lerp(X, pa.x, local) + arc, ly0 = lerp(Y, pa.y, local) - Math.sin(local * Math.PI) * 40;
      const lx1 = lerp(X + tile, pb.x, local) + arc, ly1 = lerp(Y, pb.y, local) - Math.sin(local * Math.PI) * 40;
      const lx2 = lerp(X + tile, pc.x, local) + arc, ly2 = lerp(Y + tile, pc.y, local) - Math.sin(local * Math.PI) * 40;
      const lx3 = lerp(X, pd.x, local) + arc, ly3 = lerp(Y + tile, pd.y, local) - Math.sin(local * Math.PI) * 40;
      const tl = this.tiles[k];
      const fillIn = clamp(fieldA * 4 - seed * 3);
      tl.setAttribute('points', `${lx0.toFixed(1)},${ly0.toFixed(1)} ${lx1.toFixed(1)},${ly1.toFixed(1)} ${lx2.toFixed(1)},${ly2.toFixed(1)} ${lx3.toFixed(1)},${ly3.toFixed(1)}`);
      const fadeOnDie = lerp(1, .22, sstep(.56, .68, t));
      tl.setAttribute('opacity', (fillIn * fadeOnDie).toFixed(2));
      tl.setAttribute('class', 'c1-tile' + (local > .98 ? ' set' : ''));
    }

    // 两个晶粒轮廓 → 合成一个
    const outA = sstep(.5, .62, t) * (1 - out);
    const merge = smoother(.62, .74, t);
    const path = (q, o) => `M${q[0].x} ${q[0].y}L${q[1].x} ${q[1].y}L${q[2].x} ${q[2].y}L${q[3].x} ${q[3].y}Z`;
    A(this.dieOut[0], { d: path(corners.A), opacity: outA * (1 - merge) });
    A(this.dieOut[1], { d: path(corners.B), opacity: outA * (1 - merge) });
    // 合并后的外框从两框的并集生长
    const q = [corners.A[0], corners.A[1], corners.B[2], corners.B[3]];
    A(this.oneOut, { d: path(q), opacity: outA * merge, 'stroke-width': 1.4 + merge * 1.2 });
    const oneA = merge * (1 - out);
    this.oneTrace.opacity(oneA);
    if (oneA > .002) this.oneTrace.draw(q[1].x + 26, (q[1].y + q[2].y) / 2 - 26, '1 GPU', { draw: merge, stagger: .1 });
    const twoA = pulse(.62, .68, .8, .88, t);
    this.twoLab.style.opacity = twoA.toFixed(3);
    vis(this.twoLab, twoA > .002);
    this.twoLab.style.transform = `translate3d(0,${(1 - sstep(.62, .68, t)) * 3 - sstep(.8, .88, t) * 3}rem,0)`;

    // 晶粒发光：规模段与“一颗”段
    f.dieBoost = Math.max(f.scanDie, glowWave * .6, reform * (1 - sstep(.62, .78, t)) * .35);
    f.actBase = Math.max(f.actBase, sstep(.6, 1, i) * .17 * (1 - sstep(.86, 1, t)));

    // 滚动提示
    const cue = sstep(.95, 1, i) * (1 - sstep(.0, .05, t));
    this.scrollCue.style.opacity = cue.toFixed(3);
    vis(this.scrollCue, cue > .002);

    ctx.hud.setHint(t < .7 ? '拖动模型旋转 · 全页可用键盘：[ ] 切章 · Tab 到控件' : '');
    f.exploreAvail = t < .7;
  },
};
