// 第 05 章：数值精度与计算实验（纸面）。
// 位格 → 数轴 → 矩阵实验 → 乘加累积 → 张量核心 → 计算单元 → 晶粒 → GPU，是一条连续的图形过程。
// “格式讲解”只改变讲解用的 τ，不写回全页精度；矩阵实验永远按全页精度真实计算。
import { S, A, H, Trace, beat, vis, setText, setHTML, textWidth } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fract, fmtNum, fmtInt, hash1 } from '../core/util.js';
import { state, patch, subscribe, calc, calcWith, DEFAULTS } from '../core/state.js';
import { FORMATS, FORMAT_ORDER, encodeBits, representable, quantize, fp4BlockScale, E2M1_TABLE, matMul } from '../core/numerics.js';
import { peakOfFormat, PER_GPU } from '../data/specs.js';
import { DIM, STACK_POS } from '../models/package.js';

const ROLE_COL = { s: 'var(--s)', e: 'var(--e)', m: 'var(--m)', p: 'var(--pad)' };
const BX0 = 372, BW = 1370;        // 位格区
const NL_X0 = 372, NL_W = 1370;    // 数轴区
const RANGE = 7.5;

// 一种格式下 64 个位格各自的位置：多余的位格收缩并入相邻格，宽度为 0
function cellLayout(fmtId) {
  const F = FORMATS[fmtId];
  const pad = fmtId === 'TF32' ? 13 : 0;
  const n = F.S + F.E + F.M + pad;
  const cw = Math.min(BW / n, 128);
  const W = cw * n;
  const out = new Array(64);
  const x0 = BX0;
  let x = x0;
  out[0] = { x, w: cw, r: 's', a: 1 };
  x += cw;
  for (let i = 0; i < 11; i++) {
    if (i < F.E) { out[1 + i] = { x, w: cw, r: 'e', a: 1 }; x += cw; }
    else out[1 + i] = { x, w: 0, r: 'e', a: 0 };
  }
  for (let i = 0; i < 52; i++) {
    if (i < F.M) { out[12 + i] = { x, w: cw, r: 'm', a: 1 }; x += cw; }
    else if (i < F.M + pad) { out[12 + i] = { x, w: cw, r: 'p', a: 1 }; x += cw; }
    else out[12 + i] = { x, w: 0, r: 'm', a: 0 };
  }
  return { cells: out, cw, W, n, F };
}
const LAYOUTS = Object.fromEntries(FORMAT_ORDER.map(id => [id, cellLayout(id)]));

// ---------- 矩阵视图：同一组元素在不同位置以不同形式呈现 ----------
class Mat {
  constructor(parent, name, sub, cls = '', input = false) {
    this.g = S('g', { class: 'm5 ' + cls }, parent);
    this.title = S('text', { class: 'm5-t' }, this.g, name);
    this.sub = S('text', { class: 'm5-s' }, this.g, sub);
    this.cells = [];
    for (let i = 0; i < 16; i++) {
      const c = S('g', { class: 'm5-c' }, this.g);
      const r = S('rect', { class: 'm5-r' }, c);
      const t = S('text', { class: 'm5-v' }, c);
      const hit = S('rect', { class: 'm5-hit' }, c);
      this.cells.push({ c, r, t, hit, i: Math.floor(i / 4), j: i % 4 });
    }
    this.scale = S('text', { class: 'm5-sc' }, this.g);
  }
  place(x, y, cw, ch, op = 1) {
    this.x = x; this.y = y; this.cw = cw; this.ch = ch;
    A(this.g, { opacity: op });
    A(this.title, { x, y: y - 26 });
    A(this.sub, { x, y: y - 9 });
    for (const c of this.cells) {
      const X = x + c.j * cw, Y = y + c.i * ch;
      A(c.r, { x: X + .5, y: Y + .5, width: cw - 1, height: ch - 1 });
      A(c.hit, { x: X, y: Y, width: cw, height: ch });
      A(c.t, { x: X + cw / 2, y: Y + ch / 2 + 4.5 });
    }
    A(this.scale, { x, y: y + ch * 4 + 16 });
  }
  center(i, j) { return { x: this.x + (j + .5) * this.cw, y: this.y + (i + .5) * this.ch }; }
  set(M, opts = {}) {
    for (const c of this.cells) {
      const v = M[c.i][c.j];
      setText(c.t, opts.fmt ? opts.fmt(v, c.i, c.j) : fmtNum(v, 2));
      const fill = opts.fill ? opts.fill(v, c.i, c.j) : null;
      if (c.r._f !== fill) { c.r._f = fill; if (fill) c.r.style.fill = fill; else c.r.style.fill = ''; }
      const cl = 'm5-c' + (opts.cls ? ' ' + (opts.cls(v, c.i, c.j) || '') : '');
      if (c.c._c !== cl) { c.c._c = cl; c.c.setAttribute('class', cl); }
    }
  }
}

const errFill = (e, max) => {
  if (!isFinite(e)) return 'rgba(229,72,77,.9)';
  const k = clamp(Math.abs(e) / Math.max(max, 1e-9));
  if (k < .002) return 'rgba(20,23,27,.04)';
  return e > 0 ? `rgba(229,72,77,${(.08 + k * .72).toFixed(2)})` : `rgba(47,95,216,${(.08 + k * .72).toFixed(2)})`;
};

export default {
  from: -.02, to: 1.02,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch05', ctx.chaptersRoot, null, { 'aria-label': '第 05 章 数值精度与计算实验' });
    this.root = root;
    this.caps = [
      { a: .012, b: .035, c: .225, d: .25, e: H('div', 'c5-cap', root, '<div class="over">05 / 精度</div><h2>四比特的算术</h2><p>刚才那一块的 16 个值，每一个都要写成二进制。同一个数，位宽越窄，占的地方越小，表示得也越粗。继续滚动，看位格如何拆分、合并、重组。这里只是讲解，不会改动你选的全页精度。</p>') },
      { a: .25, b: .27, c: .365, d: .385, e: H('div', 'c5-cap', root, '<div class="over">舍入</div><h2>能写下的只有这些刻度</h2><p>数轴上每根刻度是一个可表示的值。输入要舍入到最近的刻度（平局取偶），差值就是误差。FP4 只有 ±{0, .5, 1, 1.5, 2, 3, 4, 6}，靠每 16 个值共享的 E4M3 缩放 s 把刻度整体拉伸。</p>') },
    ];
    this.cap3 = H('div', 'c5-labcap', root, '<div class="over">矩阵实验 · 真实计算</div><h2>改一个数，全部重算</h2>');
    this.cap4 = H('div', 'c5-labcap', root, '<div class="over">乘加累积</div><h2>乘积首尾相接，累加成结果</h2>');
    this.cap5 = H('div', 'c5-zoomcap', root);
    this.rule = H('div', 'c5-rule', root, `<b>按什么规则算</b>全部就近舍入、平局取偶。FP16 按 IEEE binary16；FP8 选 OCP E4M3（偏置 7，最大 ±448，上溢饱和）；FP4 为 E2M1，取值 ±{0, .5, 1, 1.5, 2, 3, 4, 6}，整个 4×4 块共享一个 E4M3 缩放 s，x′ = q × s，s 取使该块误差最小的刻度（NVFP4 口径，每值平均 4.5 位）。FP16/BF16/TF32 每步乘、加都舍入回本格式；FP8、FP4 乘积进入 FP32 累加器。`);

    // SVG
    const g = S('g', { class: 'c5' }, ctx.ov);
    this.g = g;
    // 开场：从数据块铺满屏的 4×4 网格
    this.bigGrid = S('path', { class: 'c5-biggrid' }, g);
    this.fmtT = new Trace(g, { size: 72, cls: 'fmtt', weight: 7.4 });
    this.fmtSub = S('text', { class: 'c5-fmts' }, g);
    this.fmtUse = S('text', { class: 'c5-fmtu' }, g);
    this.fmtBars = S('g', {}, g);
    this.tabs = FORMAT_ORDER.map((id, i) => {
      const b = S('g', { class: 'c5-tourtab' }, g);
      S('text', { class: 'c5-tt' }, b, id);
      S('rect', { class: 'c5-tb', height: 3 }, b);
      return { id, b };
    });
    // 位格
    this.bitG = S('g', { class: 'c5-bits' }, g);
    this.bits = [];
    for (let i = 0; i < 64; i++) {
      this.bits.push({ r: S('rect', { class: 'c5-bit' }, this.bitG), t: S('text', { class: 'c5-bt' }, this.bitG) });
    }
    this.fieldG = S('g', {}, this.bitG);
    this.fields = ['s', 'e', 'm', 'p'].map(k => ({
      k, br: S('path', { class: 'c5-brace', style: `stroke:${ROLE_COL[k]}` }, this.fieldG),
      t: S('text', { class: 'c5-ft', style: `fill:${ROLE_COL[k]}` }, this.fieldG),
    }));
    this.link = S('path', { class: 'c5-link' }, g);
    this.scaleBox = S('g', { class: 'c5-scale' }, g);
    this.scaleCells = [];
    for (let i = 0; i < 8; i++) this.scaleCells.push({ r: S('rect', { class: 'c5-bit sc' }, this.scaleBox), t: S('text', { class: 'c5-bt' }, this.scaleBox) });
    this.scaleLab = S('text', { class: 'c5-ft', style: 'fill:var(--sc)' }, this.scaleBox);
    this.valRead = S('text', { class: 'c5-valread' }, g);

    // 数轴
    this.nlG = S('g', { class: 'c5-nl' }, g);
    this.nlAxis = S('path', { class: 'c5-axis' }, this.nlG);
    this.ticks = [];
    for (let i = 0; i < 97; i++) this.ticks.push(S('line', { class: 'c5-tick' }, this.nlG));
    this.nlLabs = [];
    for (let i = 0; i < 13; i++) this.nlLabs.push(S('text', { class: 'c5-nll' }, this.nlG));
    this.errBar = S('rect', { class: 'c5-errb' }, this.nlG);
    this.mx = S('path', { class: 'c5-mx' }, this.nlG);
    this.mq = S('path', { class: 'c5-mq' }, this.nlG);
    this.mxT = S('text', { class: 'c5-mt' }, this.nlG);
    this.mqT = S('text', { class: 'c5-mt q' }, this.nlG);
    this.nlTitle = S('text', { class: 'c5-nlt' }, this.nlG);

    // 六种格式的应用差异表：位宽条由真实字段构成，A₀₀ 的写法和误差实时算出
    this.ftG = S('g', { class: 'c5-ft-g' }, g);
    this.ftRows = FORMAT_ORDER.map((id, i) => {
      const row = S('g', { class: 'c5-ftr' }, this.ftG);
      const F = FORMATS[id];
      const name = S('text', { class: 'c5-ftn' }, row, id);
      const seg = [['s', F.S], ['e', F.E], ['m', F.M], ['p', id === 'TF32' ? 13 : 0]].map(([k, n]) => ({ k, n, r: S('rect', { height: 13, style: `fill:${ROLE_COL[k]}` }, row) }));
      const scale = id === 'FP4' ? S('rect', { height: 13, style: 'fill:var(--sc);fill-opacity:.55' }, row) : null;
      const bits = S('text', { class: 'c5-fts' }, row, id === 'TF32' ? '32 / 19' : id === 'FP4' ? '4.5' : String(F.bits));
      const val = S('text', { class: 'c5-ftv' }, row);
      const err = S('text', { class: 'c5-ftv e' }, row);
      const use = S('text', { class: 'c5-ftu' }, row, F.use);
      return { id, row, name, seg, scale, bits, val, err, use };
    });
    this.ftHead = ['格式', '每值位宽（条长按位数）', '位', 'A₀₀ 写成', '误差', '典型用途'].map(t => S('text', { class: 'c5-fth' }, this.ftG, t));

    // 矩阵
    this.labG = S('g', { class: 'c5-lab' }, g);
    this.mA = new Mat(this.labG, 'A 原值', '可编辑', 'in');
    this.mQA = new Mat(this.labG, 'A′ 量化', '', 'q');
    this.mEA = new Mat(this.labG, 'ΔA 误差', 'A′ − A', 'err');
    this.mB = new Mat(this.labG, 'B 原值', '可编辑', 'in');
    this.mQB = new Mat(this.labG, 'B′ 量化', '', 'q');
    this.mEB = new Mat(this.labG, 'ΔB 误差', 'B′ − B', 'err');
    this.mC = new Mat(this.labG, 'C = A′·B′', '', 'res');
    this.mE = new Mat(this.labG, '与 FP64 基准之差', 'C − A·B', 'err');
    this.times = S('text', { class: 'c5-op' }, this.labG, '×');
    for (const [m, name] of [[this.mA, 'A'], [this.mQA, 'A'], [this.mB, 'B'], [this.mQB, 'B'], [this.mC, 'C'], [this.mE, 'C']]) {
      m.cells.forEach(c => {
        c.hit.addEventListener('click', () => this.setTrace(name, c.i, c.j));
        c.hit.addEventListener('pointerenter', () => { this.hoverTrace = { m: name, i: c.i, j: c.j }; });
        c.hit.addEventListener('pointerleave', () => { this.hoverTrace = null; });
        if (m === this.mC) {
          c.hit.setAttribute('tabindex', '0');
          c.hit.setAttribute('role', 'button');
          c.hit.setAttribute('aria-label', `追踪输出 C 第 ${c.i + 1} 行第 ${c.j + 1} 列`);
          c.hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setTrace('C', c.i, c.j); } });
        }
      });
    }
    // 乘加格：16 组，每组 4 条乘积
    this.macG = S('g', { class: 'c5-mac' }, this.labG);
    this.macs = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const gg = S('g', { class: 'c5-grp' }, this.macG);
      const box = S('rect', { class: 'c5-gbox' }, gg);
      const zero = S('line', { class: 'c5-gz' }, gg);
      const bars = [0, 1, 2, 3].map(k => ({ r: S('rect', { class: 'c5-bar' }, gg), l: S('line', { class: 'c5-bl' }, gg) }));
      const sum = S('path', { class: 'c5-sum' }, gg);
      const lab = S('text', { class: 'c5-gl' }, gg);
      this.macs.push({ i, j, gg, box, zero, bars, sum, lab });
    }
    this.traceP = S('path', { class: 'c5-trace' }, this.labG);
    this.traceDots = S('path', { class: 'c5-tracedots' }, this.labG);
    this.traceLab = S('text', { class: 'c5-tracel' }, this.labG);

    // 张量核心 → GPU 的连续拉远（毫米坐标下的同一组矢量）
    this.zoomG = S('g', { class: 'c5-zoom' }, g);
    this.buildZoom(ctx);
    this.lad = S('g', { class: 'c5-ladder' }, g);
    this.ladItems = [
      ['乘加', '64 次（一次 A·B）'], ['张量核心', '4 个 → 1 计算单元'], ['计算单元', '80 个 → 1 颗晶粒'], ['晶粒', '2 颗 → 1 颗 GPU'], ['整颗 GPU', '640 个张量核心（公开资料）'],
    ].map((it, i) => {
      const lg = S('g', {}, this.lad);
      const d = S('rect', { width: 9, height: 9, class: 'c5-ld' }, lg);
      const n = S('text', { class: 'c5-ln' }, lg, it[0]);
      const s = S('text', { class: 'c5-ls' }, lg, it[1]);
      return { lg, d, n, s };
    });

    // ---- 面板：格式、稠密 / 稀疏、持续运行 ----
    const pan = H('aside', 'panel p05 pe', root, null, { 'aria-label': '矩阵实验控制' });
    this.panel = pan;
    const fr = H('div', 'p5-row', pan, '<span class="p5-l">当前格式（全页共享）</span>');
    this.fmtBtns = {};
    const frr = H('div', 'p5-fmts', fr);
    FORMAT_ORDER.forEach(id => {
      const b = H('button', 'chip mono', frr, id, { type: 'button' });
      b.addEventListener('click', () => patch({ precision: id }));
      this.fmtBtns[id] = b;
    });
    const sr = H('div', 'p5-row', pan, '<span class="p5-l">结构化稀疏</span>');
    const srr = H('div', 'p5-fmts', sr);
    this.bDense = H('button', 'chip', srr, '稠密', { type: 'button' });
    this.bSparse = H('button', 'chip', srr, '稀疏 2:4', { type: 'button' });
    this.bDense.addEventListener('click', () => patch({ sparse: false }));
    this.bSparse.addEventListener('click', () => patch({ sparse: true }));
    const ar = H('div', 'p5-acts', pan);
    this.bRun = H('button', 'btn', ar, '持续运行', { type: 'button', 'aria-pressed': 'false' });
    this.bRun.addEventListener('click', () => this.toggleRun());
    this.bRand = H('button', 'btn', ar, '换一组输入', { type: 'button' });
    this.bRand.addEventListener('click', () => this.randomize());
    this.bReset = H('button', 'btn', ar, '恢复默认', { type: 'button' });
    this.bReset.addEventListener('click', () => { const d = DEFAULTS(); patch({ A: d.A, B: d.B, trace: null }); this.syncInputs(true); });
    this.bClear = H('button', 'btn', ar, '清除追踪', { type: 'button' });
    this.bClear.addEventListener('click', () => patch({ trace: null }));
    // 工作量读数：三种口径分开
    this.workG = H('div', 'p5-work', pan);
    this.wMac = H('div', 'p5-w', this.workG, '<label>示意工作量（一次 A·B）</label><b></b><span></span>');
    this.wRun = H('div', 'p5-w', this.workG, '<label>演示速率 · 累计（浏览器内真实计算）</label><b></b><span></span>');
    this.wPeak = H('div', 'p5-w', this.workG, '<label>官方峰值（单颗 B200 · HGX 配置）</label><b></b><span></span>');
    this.cmpT = H('div', 'p5-cmp', pan);

    // 输入框
    this.inputs = { A: [], B: [] };
    for (const name of ['A', 'B']) {
      for (let i = 0; i < 4; i++) {
        this.inputs[name][i] = [];
        for (let j = 0; j < 4; j++) {
          const inp = H('input', 'm5-input pe', root, null, { type: 'text', inputmode: 'decimal', 'aria-label': `${name} 第 ${i + 1} 行第 ${j + 1} 列`, spellcheck: 'false', autocomplete: 'off' });
          inp.addEventListener('focus', () => { inp.select(); this.setTrace(name, i, j, true); });
          inp.addEventListener('input', () => this.onInput(name, i, j, inp));
          inp.addEventListener('blur', () => { this.syncInputs(true); });
          inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') { inp.blur(); e.preventDefault(); }
            const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
            if (mv) {
              e.preventDefault();
              const nxt = this.inputs[name][clamp(i + mv[0], 0, 3)][j];
              nxt.focus();
            }
          });
          this.inputs[name][i][j] = inp;
        }
      }
    }
    subscribe(() => this.syncUI());
    this.syncUI();
    this.syncInputs(true);
    this.runSec = 0;
    this.runT0 = null;
  },

  // 缩放舞台：全部以毫米为单位
  buildZoom(ctx) {
    const pkg = ctx.world.pkg;
    const root = S('g', {}, this.zoomG);
    this.zoomRoot = root;
    const nss = 'vector-effect:non-scaling-stroke';
    // 封装外框与显存
    let sub = '';
    S('rect', { x: -46, y: -42, width: 92, height: 84, class: 'z-sub', style: nss }, root);
    S('rect', { x: -30, y: -26.2, width: 60, height: 52.4, class: 'z-ip', style: nss }, root);
    this.zHbm = STACK_POS.map(([x, z]) => S('rect', { x: x - 5.5, y: z - 5.9, width: 11, height: 11.8, class: 'z-hbm', style: nss }, root));
    this.zDies = [S('rect', { x: -17, y: -24.68, width: 34, height: 24.5, class: 'z-die', style: nss }, root), S('rect', { x: -17, y: .18, width: 34, height: 24.5, class: 'z-die', style: nss }, root)];
    // 晶粒单元：按种类合成路径
    const byKind = {};
    for (const D of ['A', 'B']) {
      const { map, im } = pkg.dieCells[D];
      const mat = new (im.instanceMatrix.array.constructor)(im.instanceMatrix.array);
      map.forEach((c, i) => {
        const r = pkg.regions[c.r];
        const off = i * 16;
        const sx = mat[off], sz = mat[off + 10];
        const x = mat[off + 12], z = mat[off + 14];
        (byKind[r.kind] = byKind[r.kind] || []).push(`M${(x - sx / 2).toFixed(3)} ${(z - sz / 2).toFixed(3)}h${sx.toFixed(3)}v${sz.toFixed(3)}h${(-sx).toFixed(3)}z`);
      });
    }
    this.zKinds = {};
    const VAR = { sm: '--m', l2: '--l2', phy: '--hbm', hbi: '--hbi', nvl: '--nvl', hub: '--ink', dec: '--dec', ras: '--ras', sec: '--sec' };
    for (const k in byKind) this.zKinds[k] = S('path', { d: byKind[k].join(''), class: 'z-cells', style: `fill:var(${VAR[k]});${nss}` }, root);
    // 焦点张量核心：B 晶粒第 3 组中的一个 TC
    const focusSM = pkg.regionById['B.gpc2'];
    const pad = .1, cw = (focusSM.u1 - focusSM.u0 - pad * 3) / 4, cd = (focusSM.v1 - focusSM.v0 - pad * 3) / 4;
    const cx = focusSM.u0 + cw / 2 + 1 * (cw + pad), cv = focusSM.v0 + cd / 2 + 1 * (cd + pad);
    const q = .05, tw = (cw - q) / 2, td = (cd * .78 - q) / 2;
    const fx = cx - .5 * (tw + q), fz = cv + cd * .1 - .5 * (td + q);
    this.focus = { x: fx, y: fz, w: tw, h: td, smX: cx, smY: cv, smW: cw, smH: cd };
    // TC 内的 64 个乘加单元
    const mg = S('g', { class: 'z-mac' }, root);
    let d = '';
    const n = 8, m = tw / n, hh = td / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) d += `M${(fx - tw / 2 + j * m + m * .08).toFixed(4)} ${(fz - td / 2 + i * hh + hh * .08).toFixed(4)}h${(m * .84).toFixed(4)}v${(hh * .84).toFixed(4)}h${(-m * .84).toFixed(4)}z`;
    this.zMacPath = S('path', { d, class: 'z-macp', style: nss }, mg);
    this.zTC = S('rect', { x: fx - tw / 2, y: fz - td / 2, width: tw, height: td, class: 'z-tc', style: nss }, mg);
    this.zSM = S('rect', { x: cx - cw / 2, y: cv - cd / 2, width: cw, height: cd, class: 'z-sm', style: nss }, mg);
    this.zGPU = S('rect', { x: -31, y: -27, width: 62, height: 54, class: 'z-gpu', style: nss }, root);
    this.zLabs = {
      tc: S('text', { class: 'z-lab' }, this.zoomG, '张量核心（示意）'),
      sm: S('text', { class: 'z-lab' }, this.zoomG, '计算单元'),
      die: S('text', { class: 'z-lab' }, this.zoomG, '晶粒 B'),
      gpu: S('text', { class: 'z-lab' }, this.zoomG, '整颗 B200'),
    };
  },

  show(on) { vis(this.root, on); vis(this.g, on); },

  syncInputs(force) {
    for (const name of ['A', 'B']) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const inp = this.inputs[name][i][j];
      if (force || document.activeElement !== inp) {
        const v = String(+state[name][i][j].toFixed(4));
        if (inp.value !== v && document.activeElement !== inp) inp.value = v;
      }
    }
  },
  onInput(name, i, j, inp) {
    const v = parseFloat(inp.value.replace('−', '-'));
    const ok = isFinite(v) && Math.abs(v) <= 1e6;
    inp.classList.toggle('bad', !ok);
    if (!ok) return;
    const M = state[name].map(r => r.slice());
    M[i][j] = v;
    patch({ [name]: M });
  },
  setTrace(m, i, j, keep) {
    const t = state.trace;
    if (!keep && t && t.m === m && t.i === i && t.j === j) patch({ trace: null });
    else patch({ trace: { m, i, j } });
  },
  randomize() {
    const r = () => Math.round((Math.random() - .5) * 7 * 100) / 100;
    patch({ A: [0, 1, 2, 3].map(() => [r(), r(), r(), r()]), B: [0, 1, 2, 3].map(() => [r(), r(), r(), r()]) });
    this.syncInputs(true);
  },
  toggleRun() {
    const f = this.ctx.f;
    if (state.running) { this.runSec += f.time - this.runT0; this.runT0 = null; patch({ running: false }); }
    else { this.runT0 = f.time; patch({ running: true }); }
  },
  syncUI() {
    for (const id of FORMAT_ORDER) this.fmtBtns[id].classList.toggle('on', state.precision === id);
    this.bDense.classList.toggle('on', !state.sparse);
    this.bSparse.classList.toggle('on', state.sparse);
    this.bRun.classList.toggle('on', state.running);
    this.bRun.setAttribute('aria-pressed', state.running ? 'true' : 'false');
    setText(this.bRun, state.running ? '运行中 · 点击暂停' : '持续运行');
    this.syncInputs(false);
  },
  esc() { if (state.trace) patch({ trace: null }); },

  update(f, t) {
    const { ctx } = this;
    for (const c of this.caps) beat(c.e, t, c.a, c.b, c.c, c.d, { dist: 4 });
    const L = {
      grid: t < 0 ? 0 : 1 - sstep(.0, .05, t),
      bits: pulse(.018, .05, .36, .4, t),
      nl: sstep(.215, .26, t) * (1 - sstep(.72, .75, t)),
      lab: pulse(.36, .4, .75, .79, t),
      zoom: sstep(.74, .79, t),
    };
    // 讲解用的格式位置 τ
    const tau = 5 * smoother(.05, .225, t);
    const i0 = Math.min(4, Math.floor(tau)), e = smoother(.18, .82, tau - i0);
    const fa = FORMAT_ORDER[i0], fb = FORMAT_ORDER[Math.min(5, i0 + 1)];
    const tourFmt = tau - i0 > .5 ? fb : fa;
    const fmtGlobal = state.precision;
    // 进入数轴后，讲解停在 FP4；实验段切到全页精度
    const labW = sstep(.36, .4, t);
    const curFmt = labW > .5 ? fmtGlobal : tourFmt;

    // 实际计算：稀疏演示段只改变显示，不写回用户选择
    const demoSparse = !state.sparse && pulse(.565, .575, .615, .625, t) > .5;
    const sparse = state.sparse || demoSparse;
    const mm = calcWith(fmtGlobal, sparse);

    // 选中的数（讲解默认跟踪 A[0][0]）
    const tr = state.trace;
    let auto = null;
    if (!tr && t > .46 && t < .62) {
      const k = iv(.46, .62, t);
      auto = k < .33 ? { m: 'A', i: 0, j: 0 } : k < .66 ? { m: 'B', i: 1, j: 2 } : { m: 'C', i: 2, j: 3 };
    }
    const hov = this.hoverTrace;
    const trace = tr || hov || auto;
    const xVal = state.A[0][0];
    const sc = mm.qa.base;

    // ---- 开场网格 ----
    this.updateBigGrid(f, t, L, mm);

    // ---- 位格 ----
    this.updateBits(f, t, L, { fa, fb, e, tau, xVal, sc, tourFmt });

    // ---- 数轴 ----
    this.updateNumberLine(f, t, L, { fa, fb, e, labW, xVal, mm, fmtGlobal, trace });

    this.updateFormatTable(f, t, { tau, tourFmt, sc, xVal });

    // ---- 矩阵实验 ----
    this.updateLab(f, t, L, { mm, trace, sparse, demoSparse });

    // ---- 拉远 ----
    this.updateZoom(f, t, L, { mm });

    const showPanel = L.lab * (1 - sstep(.74, .78, t)) + 0;
    const panelA = pulse(.38, .42, .88, .92, t);
    this.panel.style.opacity = panelA.toFixed(3);
    vis(this.panel, panelA > .002);
    this.panel.style.pointerEvents = panelA > .6 ? '' : 'none';
    this.updateWork(f, t, mm, sparse);

    const a3 = pulse(.385, .41, .625, .645, t), a4 = pulse(.64, .66, .745, .765, t);
    const ruleA = pulse(.43, .47, .72, .75, t);
    this.rule.style.opacity = ruleA.toFixed(3); vis(this.rule, ruleA > .002);
    this.cap3.style.opacity = a3.toFixed(3); vis(this.cap3, a3 > .002);
    this.cap4.style.opacity = a4.toFixed(3); vis(this.cap4, a4 > .002);
    if (panelA > .5) ctx.hud.setHint(t < .74 ? '点数字直接改（↑↓ 换行）· 点选任意元素追踪 · Esc 取消' : '持续运行时累计工作量随时间增长');
  },

  updateFormatTable(f, t, o) {
    const a = pulse(.05, .08, .35, .385, t);
    A(this.ftG, { opacity: a });
    vis(this.ftG, a > .002);
    if (a < .002) return;
    const X0 = 372, Y0 = 590, RH = 42, BW2 = 500;
    const cols = [X0, X0 + 70, X0 + 590, X0 + 700, X0 + 830, X0 + 950];
    this.ftHead.forEach((e, i) => A(e, { x: cols[i], y: Y0 - 10 }));
    const unit = BW2 / 64;
    this.ftRows.forEach((R, i) => {
      const y = Y0 + i * RH;
      const on = R.id === o.tourFmt;
      R.row.setAttribute('class', 'c5-ftr' + (on ? ' on' : ''));
      A(R.name, { x: cols[0], y: y + 17 });
      let x = cols[1];
      // 条从 τ 经过时生长：讲到哪一格，就长到哪一格
      const grow = smoother(i - .9, i - .1, o.tau);
      for (const s of R.seg) {
        A(s.r, { x, y: y + 6, width: Math.max(s.n * unit * grow - .6, 0) });
        x += s.n * unit * grow;
      }
      if (R.scale) A(R.scale, { x: x + 1, y: y + 6, width: .5 * unit * grow });
      A(R.bits, { x: cols[2], y: y + 17 });
      const q = quantize(o.xVal, R.id, o.sc);
      const e = q - o.xVal;
      A(R.val, { x: cols[3], y: y + 17 });
      A(R.err, { x: cols[4], y: y + 17 });
      setText(R.val, R.id === 'FP64' ? fmtNum(q, 6) : fmtNum(q, 5));
      setText(R.err, Math.abs(e) < 1e-12 ? '0' : e.toExponential(1).replace('-', '−'));
      A(R.use, { x: cols[5], y: y + 17 });
    });
  },

  updateBigGrid(f, t, L, mm) {
    A(this.bigGrid, { opacity: L.grid });
    if (L.grid < .002) return;
    // 从 3D 数据块的刻槽接过来：先满屏，再缩到矩阵 A 的位置
    const k = smoother(.0, .05, t);
    const W = f.DW, H = f.DH;
    const big = 2027 * H / 1080;
    const x0 = lerp((W - big) / 2, 116, k), y0 = lerp((H - big) / 2, 204, k), s = lerp(big, 228, k);
    const sh = lerp(big, 150, k);
    let d = '';
    for (let i = 0; i <= 4; i++) {
      d += `M${x0 + s * i / 4} ${y0}V${y0 + sh}`;
      d += `M${x0} ${y0 + sh * i / 4}H${x0 + s}`;
    }
    A(this.bigGrid, { d, 'stroke-width': lerp(6, 1, k) });
  },

  updateBits(f, t, L, o) {
    const { fa, fb, e, xVal, sc } = o;
    const a = L.bits;
    // 位格讲完后收拢，落进量化矩阵的第一格（A′₀₀）
    const fold = smoother(.35, .4, t);
    const tx = this.mQA.x + this.mQA.cw / 2 || 0, ty = this.mQA.y + this.mQA.ch / 2 || 0;
    const sc0 = lerp(1, .04, fold);
    A(this.bitG, { opacity: a, transform: `translate(${lerp(0, tx - 372 * .04, fold)} ${lerp(0, ty - 270 * .04, fold)}) scale(${sc0})` });
    A(this.link, { opacity: a * .7 });
    this.fmtT.opacity(a);
    A(this.fmtSub, { opacity: a }); A(this.fmtUse, { opacity: a });
    this.tabs.forEach(tb => A(tb.b, { opacity: a }));
    A(this.scaleBox, { opacity: a * (fb === 'FP4' ? e : fa === 'FP4' ? 1 : 0) });
    A(this.valRead, { opacity: a });
    if (a < .002) return;
    const la = LAYOUTS[fa], lb = LAYOUTS[fb];
    const y = 254, h0 = lerp(46, 82, sstep(1, 5, o.tau));
    // 字形：格式名变形
    this.fmtT.draw(372, 100, fb, { from: fa, t: e });
    const F = FORMATS[o.tourFmt];
    A(this.fmtSub, { x: 372 + 340, y: 124 });
    setText(this.fmtSub, `${F.label} · ${o.tourFmt === 'TF32' ? '存储 32 位，运算 19 位' : F.effective + ' 位/值'}`);
    A(this.fmtUse, { x: 372 + 340, y: 150 });
    setText(this.fmtUse, F.use);
    // 进度标签
    this.tabs.forEach((tb, k) => {
      const X = 372 + 340 + k * 78;
      tb.b.children[0].setAttribute('x', X); tb.b.children[0].setAttribute('y', 182);
      A(tb.b.children[1], { x: X, y: 190, width: 60, opacity: o.tau >= k - .5 && o.tau < k + .5 ? 1 : .22 });
      tb.b.setAttribute('class', 'c5-tourtab' + (o.tau >= k - .5 && o.tau < k + .5 ? ' on' : ''));
    });
    // 位串
    const bitsA = encodeBits(xVal, fa, sc), bitsB = encodeBits(xVal, fb, sc);
    const showBits = e > .5 ? bitsB : bitsA;
    const curL = e > .5 ? lb : la;
    const charAt = idx => {
      const F2 = curL.F;
      if (idx === 0) return showBits[0];
      if (idx <= 11) return (idx - 1) < F2.E ? showBits[1 + idx - 1] : '';
      const mi = idx - 12;
      if (mi < F2.M) return showBits[1 + F2.E + mi];
      return '';
    };
    for (let k = 0; k < 64; k++) {
      const A0 = la.cells[k], B0 = lb.cells[k];
      const x = lerp(A0.x, B0.x, e), w = lerp(A0.w, B0.w, e);
      const cell = this.bits[k];
      if (w < .3) { if (cell._h !== 1) { cell._h = 1; cell.r.style.display = 'none'; cell.t.style.display = 'none'; } continue; }
      if (cell._h !== 0) { cell._h = 0; cell.r.style.display = ''; cell.t.style.display = ''; }
      const role = e > .5 ? B0.r : A0.r;
      const pad = role === 'p';
      const ch = charAt(k);
      A(cell.r, { x: x + .6, y, width: Math.max(w - 1.2, .4), height: h0 });
      if (cell.r._role !== role + ch) {
        cell.r._role = role + ch;
        cell.r.style.fill = pad ? 'transparent' : ROLE_COL[role];
        cell.r.style.fillOpacity = pad ? 0 : (ch === '1' ? 1 : .24);
        cell.r.setAttribute('class', 'c5-bit' + (pad ? ' pad' : ''));
      }
      A(cell.t, { x: x + w / 2, y: y + h0 / 2 + 5.5, 'font-size': clamp(w * .55, 8, 24), opacity: w > 12 ? 1 : 0 });
      setText(cell.t, ch);
      const cl = 'c5-bt' + (ch === '1' ? ' one' : '');
      if (cell.t._c !== cl) { cell.t._c = cl; cell.t.setAttribute('class', cl); }
    }
    // 字段括号
    const fieldRange = (L0, r) => {
      let x0 = Infinity, x1 = -Infinity, n = 0;
      L0.cells.forEach(c => { if (c.r === r && c.w > 0) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x + c.w); n++; } });
      return { x0, x1, n };
    };
    const NAMES = { s: '符号', e: '指数', m: '尾数', p: '不参与张量运算' };
    for (const fd of this.fields) {
      const ra = fieldRange(la, fd.k), rb = fieldRange(lb, fd.k);
      const hasA = ra.n > 0, hasB = rb.n > 0;
      if (!hasA && !hasB) { A(fd.br, { d: '' }); A(fd.t, { opacity: 0 }); continue; }
      const x0 = hasA && hasB ? lerp(ra.x0, rb.x0, e) : hasA ? ra.x0 : rb.x0;
      const x1 = hasA && hasB ? lerp(ra.x1, rb.x1, e) : hasA ? lerp(ra.x1, ra.x0, e) : lerp(rb.x0, rb.x1, e);
      const yb = y + h0 + 8;
      A(fd.br, { d: `M${x0 + 1} ${yb}v7H${x1 - 1}v-7`, opacity: hasA && hasB ? 1 : (hasB ? e : 1 - e) });
      const n = e > .5 ? rb.n : ra.n;
      const labelFits = (x1 - x0) > 26;
      A(fd.t, { x: (x0 + x1) / 2, y: yb + 24, opacity: (hasA && hasB ? 1 : (hasB ? e : 1 - e)) * (labelFits ? 1 : (fd.k === 's' ? 1 : 0)) });
      setText(fd.t, fd.k === 's' ? '符号' : `${NAMES[fd.k]} ×${n}`);
    }
    // 从矩阵 A 第一格连到位格
    const cellC = { x: 116 + 28.5, y: 204 + 18.75 };
    A(this.link, { d: `M${cellC.x + 28} ${cellC.y}C${cellC.x + 110} ${cellC.y} ${372 - 90} ${y + h0 / 2} 372 ${y + h0 / 2}` });
    // 读数：这个数被写成了什么
    const q = quantize(xVal, o.tourFmt, sc);
    A(this.valRead, { x: 372, y: y + h0 + 66 });
    setText(this.valRead, `A₀₀ = ${fmtNum(xVal, 4)}  →  ${o.tourFmt} 写成 ${fmtNum(q, 6)}${o.tourFmt === 'FP4' ? `（q = ${fmtNum(q / sc, 2)} × s = ${fmtNum(sc, 4)}）` : ''}　误差 ${(q - xVal).toExponential(2).replace('-', '−')}`);
    // FP4 的共享缩放
    if (fb === 'FP4' || fa === 'FP4') {
      const last = lb.cells[0].x + lb.W;
      const sx = last + 56, cw = 34, sh = 44;
      const sb = encodeBits(sc, 'FP8');
      for (let k = 0; k < 8; k++) {
        A(this.scaleCells[k].r, { x: sx + k * cw, y: y + 18, width: cw - 1, height: sh });
        this.scaleCells[k].r.style.fill = 'var(--sc)';
        this.scaleCells[k].r.style.fillOpacity = sb[k] === '1' ? 1 : .22;
        A(this.scaleCells[k].t, { x: sx + k * cw + cw / 2, y: y + 18 + sh / 2 + 5, 'font-size': 16 });
        setText(this.scaleCells[k].t, sb[k]);
      }
      A(this.scaleLab, { x: sx + 4 * cw, y: y + 18 + sh + 26 });
      setText(this.scaleLab, `这一块 16 个值共享的缩放 s = ${fmtNum(sc, 4)}（E4M3）`);
    }
  },

  updateNumberLine(f, t, L, o) {
    const a = L.nl;
    A(this.nlG, { opacity: a });
    if (a < .002) return;
    const { fa, fb, e, labW, mm, fmtGlobal, trace } = o;
    const yBig = 486, ySmall = 398;
    const y = lerp(yBig, ySmall, labW);
    const x0 = lerp(NL_X0, 116, labW), W = lerp(NL_W, 1250, labW);
    const h = lerp(46, 22, labW);
    const X = v => x0 + (v + RANGE) / (2 * RANGE) * W;
    A(this.nlAxis, { d: `M${x0} ${y}H${x0 + W}` });
    // 前面那条接缝在这里成了数轴的轴线
    f.seam = { x1: -20, y1: y, x2: f.DW + 20, y2: y, op: a * .75, glow: .5 };
    // 全局段读全页精度；讲解段按 τ
    const sc = mm.qa.base;
    const RA = labW > .5 ? representable(fmtGlobal, sc, RANGE) : representable(fa, sc, RANGE);
    const RB = labW > .5 ? RA : representable(fb, sc, RANGE);
    const ee = labW > .5 ? 1 : e;
    const dur = this.ticks.length;
    for (let k = 0; k < dur; k++) {
      const v = lerp(RA[k] ?? 0, RB[k] ?? 0, ee);
      const big = (k - 48) % 8 === 0;
      const X1 = X(v);
      A(this.ticks[k], { x1: X1, x2: X1, y1: y - h / 2, y2: y + h / 2 });
    }
    // 整数标签
    for (let k = 0; k < this.nlLabs.length; k++) {
      const v = -6 + k;
      A(this.nlLabs[k], { x: X(v), y: y + h / 2 + 15 });
      setText(this.nlLabs[k], v === 0 ? '0' : String(v).replace('-', '−'));
    }
    // 被跟踪的元素
    let name = 'A₀₀', xv = state.A[0][0], base = sc, tFmt = labW > .5 ? fmtGlobal : (e > .5 ? fb : fa);
    if (trace && labW > .5 && trace.m !== 'C') {
      const M = trace.m === 'A' ? mm.A : mm.B;
      xv = M[trace.i][trace.j];
      name = `${trace.m}${'₀₁₂₃'[trace.i]}${'₀₁₂₃'[trace.j]}`;
      base = trace.m === 'A' ? mm.qa.base : mm.qb.base;
    }
    const q = quantize(xv, tFmt, base);
    const xx = X(clamp(xv, -RANGE, RANGE)), xq = X(clamp(q, -RANGE, RANGE));
    A(this.errBar, { x: Math.min(xx, xq), y: y - h / 2 - 6, width: Math.abs(xq - xx), height: 6 });
    A(this.mx, { d: `M${xx} ${y - h / 2 - 28}V${y + h / 2}` });
    A(this.mq, { d: `M${xq} ${y - h / 2 - 6}V${y + h / 2 + 4}` });
    A(this.mxT, { x: xx + (xq >= xx ? -6 : 6), y: y - h / 2 - 16, 'text-anchor': xq >= xx ? 'end' : 'start' });
    setText(this.mxT, `${name} = ${fmtNum(xv, 3)}`);
    A(this.mqT, { x: xq + (xq >= xx ? 6 : -6), y: y - h / 2 - 16, 'text-anchor': xq >= xx ? 'start' : 'end' });
    setText(this.mqT, `舍入到 ${fmtNum(q, 4)}（误差 ${fmtNum(q - xv, 4)}）`);
    A(this.nlTitle, { x: x0 + W, y: y + h / 2 + 34, 'text-anchor': 'end', opacity: 1 - labW });
    setText(this.nlTitle, `数轴 · ${tFmt}：线性范围 ±${RANGE}，刻度重合处即精度不足，FP4 刻度随 s 伸缩`);
  },

  updateLab(f, t, L, o) {
    const { mm, trace, sparse, demoSparse } = o;
    const a = L.lab;
    A(this.labG, { opacity: a });
    A(this.mC.g, { opacity: 1 });
    const inputOn = a > .4;
    const rem = f.dscale * 16;
    // 布局：第一行输入，第二行乘加，右侧结果
    const cw = 57, ch = 37.5, y0 = 204, x0 = 116, gap = 240;
    const panelGap = 0;
    const X = i => x0 + i * gap + (i >= 3 ? 40 : 0);
    const inW = a;
    const leave = 1 - sstep(.72, .75, t);
    this.mA.place(X(0), y0, cw, ch, leave);
    this.mQA.place(X(1), y0, cw, ch, sstep(.38, .41, t) * leave);
    this.mEA.place(X(2), y0, cw, ch, sstep(.39, .42, t) * leave);
    A(this.times, { x: X(3) - 26, y: y0 + 86, opacity: sstep(.4, .43, t) * leave });
    this.mB.place(X(3), y0, cw, ch, sstep(.4, .43, t) * leave);
    this.mQB.place(X(4), y0, cw, ch, sstep(.41, .44, t) * leave);
    this.mEB.place(X(5), y0, cw, ch, sstep(.42, .45, t) * leave);

    // 矩阵 A 早于实验段出现：位格讲解时它就在左上角
    const showEarly = sstep(.03, .05, t) * (1 - sstep(.75, .79, t));
    A(this.labG, { opacity: Math.max(a, showEarly) });

    const q = mm.qa, qb = mm.qb;
    const fmtId = state.precision;
    const tid = trace;
    const mark = (name) => (v, i, j) => {
      let c = '';
      if (mm[name] && mm[name][i][j] === 0) c += ' zero';
      if (tid) {
        if (tid.m === 'A' && (name === 'A') && tid.i === i && tid.j === j) c += ' sel';
        if (tid.m === 'B' && (name === 'B') && tid.i === i && tid.j === j) c += ' sel';
        if (tid.m === 'C') {
          if (name === 'A' && i === tid.i) c += ' rel';
          if (name === 'B' && j === tid.j) c += ' rel';
        }
      }
      return c;
    };
    this.mA.set(state.A, { cls: mark('A'), fmt: (v, i, j) => mm.A[i][j] === 0 && v !== 0 ? `${fmtNum(v, 2)}→0` : fmtNum(v, 2) });
    this.mB.set(state.B, { cls: mark('B'), fmt: (v, i, j) => mm.B[i][j] === 0 && v !== 0 ? `${fmtNum(v, 2)}→0` : fmtNum(v, 2) });
    const maxE = Math.max(1e-9, ...q.E.flat().map(Math.abs), ...qb.E.flat().map(Math.abs));
    this.mQA.set(q.Q, { cls: mark('A') });
    this.mQB.set(qb.Q, { cls: mark('B') });
    this.mEA.set(q.E, { fill: v => errFill(v, maxE), fmt: v => fmtNum(v, 3) });
    this.mEB.set(qb.E, { fill: v => errFill(v, maxE), fmt: v => fmtNum(v, 3) });
    setText(this.mQA.sub, fmtId === 'FP4' ? `s = ${fmtNum(q.scale, 4)}（E4M3）${q.g !== 1 ? ` g=${fmtNum(q.g, 3)}` : ''}` : FORMATS[fmtId].label);
    setText(this.mQB.sub, fmtId === 'FP4' ? `s = ${fmtNum(qb.scale, 4)}（E4M3）${qb.g !== 1 ? ` g=${fmtNum(qb.g, 3)}` : ''}` : FORMATS[fmtId].label);

    // 输入框定位（DOM 与 SVG 对齐）
    const inputsOn = a > .5 && t < .75;
    this.labG.classList.toggle('inputs-on', inputsOn);
    for (const [name, m] of [['A', this.mA], ['B', this.mB]]) {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const inp = this.inputs[name][i][j];
        vis(inp, inputsOn);
        if (inputsOn) {
          const px = (m.x + j * m.cw) * f.dscale, py = (m.y + i * m.ch) * f.dscale;
          inp.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
          inp.style.width = `${(m.cw * f.dscale).toFixed(1)}px`;
          inp.style.height = `${(m.ch * f.dscale).toFixed(1)}px`;
          inp.style.fontSize = `${(13.5 * f.dscale).toFixed(2)}px`;
          inp.classList.toggle('zero', mm[name][i][j] === 0);
          if (document.activeElement !== inp) {
            const v = String(+state[name][i][j].toFixed(4));
            if (inp.value !== v) inp.value = v;
          }
        }
      }
    }

    // ---- 乘加格 ----
    const mx0 = 116, my0 = 462, gw = 196, gh = 92;
    const mA2 = sstep(.43, .47, t) * (1 - sstep(.782, .8, t));
    A(this.macG, { opacity: mA2 });
    // 16 组乘加整体收缩，正好落进张量核心的矢量框（比例由焦点框给出）
    const into = smoother(.735, .785, t);
    if (into > 0) {
      const fc = this.focus;
      const W0 = gw * 4 - 8, H0 = gh * 4 - 8;
      const W1 = 380, H1 = 380 * fc.h / fc.w;
      const cxT = f.DW * .42, cyT = f.DH * .55;
      const sx = lerp(1, W1 / W0, into), sy = lerp(1, H1 / H0, into);
      const ox = lerp(0, cxT - W1 / 2 - mx0 * sx, into), oy = lerp(0, cyT - H1 / 2 - my0 * sy, into);
      A(this.macG, { transform: `translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})` });
    } else this.macG.removeAttribute('transform');
    const stack = smoother(.645, .72, t);
    let maxAbs = 1;
    mm.terms.forEach(r => r.forEach(cell => cell.forEach(tt => { if (isFinite(tt.p)) maxAbs = Math.max(maxAbs, Math.abs(tt.p)); })));
    mm.C.flat().forEach(v => { if (isFinite(v)) maxAbs = Math.max(maxAbs, Math.abs(v)); });
    const barScale = (gw - 26) / 2 / maxAbs;
    const P = (i, j) => ({ x: mx0 + j * gw + gw / 2 - 4, y: my0 + i * gh });
    const highlightTerm = (i, j, k) => {
      if (!tid) return false;
      if (tid.m === 'A') return tid.i === i && tid.j === k;
      if (tid.m === 'B') return tid.i === k && tid.j === j;
      return tid.i === i && tid.j === j;
    };
    for (const G of this.macs) {
      const { i, j } = G;
      const c = P(i, j);
      A(G.box, { x: c.x - gw / 2 + 4, y: c.y, width: gw - 8, height: gh - 8 });
      A(G.zero, { x1: c.x, x2: c.x, y1: c.y, y2: c.y + gh - 8 });
      const terms = mm.terms[i][j];
      let cum = 0;
      terms.forEach((tt, k) => {
        const b = G.bars[k];
        const hh = 11, gap2 = 3;
        const yb = c.y + 8 + k * (hh + gap2);
        const v = isFinite(tt.p) ? tt.p : 0;
        const startFree = 0, startStack = cum;
        // 累积：从独立的条变成首尾相接
        const e2 = smoother(.0 + k * .12, .5 + k * .12, stack);
        const start = lerp(startFree, startStack, e2);
        const xa = c.x + start * barScale, xb = c.x + (start + v) * barScale;
        const hl = highlightTerm(i, j, k);
        A(b.r, { x: Math.min(xa, xb), y: yb, width: Math.max(Math.abs(xb - xa), tt.zero ? 0 : 1), height: hh });
        const cl = 'c5-bar' + (v < 0 ? ' neg' : '') + (hl ? ' hl' : '');
        if (b.r._c !== cl) { b.r._c = cl; b.r.setAttribute('class', cl); }
        if (tt.zero) {
          A(b.l, { x1: c.x - 7, x2: c.x + 7, y1: yb + hh / 2, y2: yb + hh / 2, opacity: 1 });
        } else A(b.l, { opacity: 0 });
        cum += v;
      });
      const sumV = isFinite(mm.C[i][j]) ? mm.C[i][j] : 0;
      const xs = c.x + clamp(sumV * barScale, -gw / 2, gw / 2);
      A(G.sum, { d: `M${xs} ${c.y + 2}v${gh - 12}`, opacity: stack });
      A(G.lab, { x: c.x - gw / 2 + 8, y: c.y + gh - 13 });
      setText(G.lab, `C${'₀₁₂₃'[i]}${'₀₁₂₃'[j]}`);
      const sl = tid && tid.m === 'C' && tid.i === i && tid.j === j;
      G.gg.setAttribute('class', 'c5-grp' + (sl ? ' sel' : ''));
    }

    // ---- 结果 ----
    const rx = 116 + 4 * gw + 40, ry = 488;
    const rA = sstep(.44, .48, t);
    this.mC.place(rx, ry, cw, ch + 4, rA * (1 - sstep(.72, .75, t)));
    this.mE.place(rx + 262, ry, cw, ch + 4, sstep(.45, .49, t) * (1 - sstep(.72, .75, t)));
    setText(this.mC.sub, `${fmtId} 乘加 · ${FORMATS[fmtId].accName} 累加`);
    const maxC = Math.max(1e-9, ...mm.Err.flat().map(v => (isFinite(v) ? Math.abs(v) : 0)));
    this.mC.set(mm.C, { cls: (v, i, j) => (tid && tid.m === 'C' && tid.i === i && tid.j === j ? 'sel' : tid && tid.m === 'A' && tid.i === i ? 'rel' : tid && tid.m === 'B' && tid.j === j ? 'rel' : '') });
    this.mE.set(mm.Err, { fill: v => errFill(v, maxC), fmt: v => fmtNum(v, 3) });

    // ---- 追踪线 ----
    let d = '', dots = '';
    if (tid && mA2 > .2 && a > .2) {
      const addLine = (x0a, y0a, x1a, y1a) => { d += `M${x0a.toFixed(1)} ${y0a.toFixed(1)}C${x0a.toFixed(1)} ${((y0a + y1a) / 2).toFixed(1)} ${x1a.toFixed(1)} ${((y0a + y1a) / 2).toFixed(1)} ${x1a.toFixed(1)} ${y1a.toFixed(1)}`; dots += `M${x1a - 2} ${y1a}a2 2 0 1 0 4 0a2 2 0 1 0 -4 0`; };
      const barY = (i, k) => my0 + i * gh + 8 + k * 14 + 5.5;
      const pushTerm = (i, j, k) => {
        const c = P(i, j);
        const a0 = this.mQA.center(i, k), b0 = this.mQB.center(k, j), r0 = this.mC.center(i, j);
        addLine(a0.x, a0.y + ch / 2, c.x, barY(i, k));
        addLine(b0.x, b0.y + ch / 2, c.x, barY(i, k));
        d += `M${c.x + gw / 2 - 8} ${c.y + 40}C${c.x + gw} ${c.y + 40} ${r0.x - 80} ${r0.y} ${r0.x - cw / 2} ${r0.y}`;
      };
      if (tid.m === 'A') for (let j = 0; j < 4; j++) pushTerm(tid.i, j, tid.j);
      else if (tid.m === 'B') for (let i = 0; i < 4; i++) pushTerm(i, tid.j, tid.i);
      else for (let k = 0; k < 4; k++) pushTerm(tid.i, tid.j, k);
    }
    A(this.traceP, { d });
    A(this.traceDots, { d: dots });
    const tOp = (tid && mA2 > .2) ? 1 : 0;
    A(this.traceLab, { x: 116, y: my0 + gh * 4 + 22, opacity: tOp });
    if (tid) {
      const nm = `${tid.m}${'₀₁₂₃'[tid.i]}${'₀₁₂₃'[tid.j]}`;
      const n = tid.m === 'C' ? `${nm} = ${[0, 1, 2, 3].map(k => `${fmtNum(mm.terms[tid.i][tid.j][k].a, 2)}×${fmtNum(mm.terms[tid.i][tid.j][k].b, 2)}`).join(' + ')} = ${fmtNum(mm.C[tid.i][tid.j], 3)}` : `${nm} 参与 4 次乘积，影响 ${tid.m === 'A' ? `第 ${tid.i + 1} 行` : `第 ${tid.j + 1} 列`}的 4 个输出`;
      setText(this.traceLab, n);
    }
    A(this.traceP, { opacity: tOp }); A(this.traceDots, { opacity: tOp });
  },

  updateWork(f, t, mm, sparse) {
    const fmt = state.precision;
    const setW = (el, big, sub) => { setText(el.querySelector('b'), big); setText(el.querySelector('span'), sub); };
    setW(this.wMac, `${mm.macs} / ${mm.total} 次乘加`, `稀疏跳过 ${mm.skipped} 次 · 实际零元素 ${mm.A.flat().filter(v => v === 0).length + mm.B.flat().filter(v => v === 0).length} 个 · 占 ${(16 * 2 * FORMATS[fmt].effective / 8).toFixed(1)} 字节`);
    // 累计：持续运行时跟时间走；滚动演示段也跟 time（导出时可复现）
    const auto = sstep(.645, .68, t) * (1 - sstep(.97, 1, t));
    let sec = this.runSec + (state.running && this.runT0 !== null ? f.time - this.runT0 : 0);
    sec += auto * f.time;
    const rate = 240; // 演示节拍：每秒 240 次 A·B
    const ops = sec * rate * mm.macs;
    setW(this.wRun, `${fmtInt(ops)} 次`, `${rate} 次 A·B / 秒 ≈ ${fmtInt(rate * mm.macs)} 次乘加/秒（演示速率，非硬件）`);
    const pk = peakOfFormat(fmt, sparse);
    setW(this.wPeak, `${pk.v.toLocaleString('en-US')} ${pk.u}`, `${fmt}${pk.noSparse ? '' : sparse ? ' · 稀疏口径' : ' · 稠密口径'} · 官方规格，与本页演示无关`);
    // 三种格式对比（实际重算）
    const rows = ['FP16', 'FP8', 'FP4'].map(id => {
      const r = calcWith(id, sparse);
      return `<tr class="${id === fmt ? 'on' : ''}"><td>${id}</td><td>${FORMATS[id].effective} 位</td><td>${r.rmse < 1e-3 ? r.rmse.toExponential(1) : r.rmse.toFixed(3)}</td><td>${r.macs}</td></tr>`;
    }).join('');
    setHTML(this.cmpT, `<table><thead><tr><th>同一输入</th><th>每值</th><th>输出 RMSE</th><th>乘加</th></tr></thead><tbody>${rows}</tbody></table>`);
  },

  updateZoom(f, t, L, o) {
    const a = sstep(.77, .8, t) * (1 - sstep(.9, .93, t));
    A(this.zoomG, { opacity: a });
    A(this.lad, { opacity: sstep(.78, .81, t) * (1 - sstep(.92, .95, t)) });
    const capA = pulse(.785, .805, .91, .94, t);
    this.cap5.style.opacity = capA.toFixed(3);
    vis(this.cap5, capA > .002);
    if (a < .002) return;
    // 对数缩放：每毫米多少设计像素。从张量核心铺满 → 整颗 GPU 贴合三维
    const k = smoother(.76, .875, t);
    const pkgEnd = f.proj(10, 4.6, 0), pkgC = f.proj(0, 4.6, 0);
    const Send = Math.abs(pkgEnd.x - pkgC.x) / 10;
    const fc = this.focus;
    const Sstart = 380 / fc.w; // 张量核心 380 像素宽
    const S0 = Math.exp(lerp(Math.log(Sstart), Math.log(Send), k));
    // 焦点从张量核心移到封装中心
    const fx = lerp(fc.x, 0, smoother(.3, 1, k)), fy = lerp(fc.y, 0, smoother(.3, 1, k));
    const cx = lerp(f.DW * .42, pkgC.x, k), cy = lerp(f.DH * .55, pkgC.y, k);
    A(this.zoomRoot, { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${S0.toFixed(4)}) translate(${(-fx).toFixed(4)} ${(-fy).toFixed(4)})` });
    // 分级标签
    const lvl = Math.log(S0 / Send) / Math.log(Sstart / Send); // 1 = 最近
    const lab = (e, x, y, op) => { A(e, { x, y, opacity: op * a }); };
    const scr = (X, Y) => ({ x: cx + (X - fx) * S0, y: cy + (Y - fy) * S0 });
    const pTC = scr(fc.x, fc.y - fc.h / 2), pSM = scr(fc.smX, fc.smY - fc.smH / 2), pDie = scr(0, -.5), pG = scr(0, -27);
    lab(this.zLabs.tc, pTC.x, pTC.y - 12, pulse(.72, .86, 1.0, 1.1, lvl));
    lab(this.zLabs.sm, pSM.x, pSM.y - 12, pulse(.42, .55, .75, .85, lvl));
    lab(this.zLabs.die, pDie.x, pDie.y + 40, pulse(.14, .24, .42, .5, lvl));
    lab(this.zLabs.gpu, pG.x, pG.y - 14, 1 - sstep(.1, .22, lvl));
    const stage = lvl > .78 ? 0 : lvl > .56 ? 1 : lvl > .3 ? 2 : lvl > .1 ? 3 : 4;
    this.zMacPath.style.opacity = sstep(.55, .75, lvl).toFixed(3);
    this.zGPU.style.opacity = (1 - sstep(.0, .12, lvl)).toFixed(3);
    // 梯子读数
    const x = f.DW - 300, y = 132;
    this.ladItems.forEach((it, i) => {
      A(it.lg, { transform: `translate(${x} ${y + i * 42})`, class: i === stage ? 'on' : '' });
      A(it.d, { x: 0, y: -8 });
      A(it.n, { x: 18, y: 0 });
      A(it.s, { x: 18, y: 18 });
    });
    const macsStage = ['64 次乘加', '256 次乘加 × 4 个张量核心', '约 20,480 次 × 80 计算单元', '约 41,000 次 × 2 颗晶粒', '一颗 GPU 的同一周期'][stage];
    setHTML(this.cap5, `<div class="over">乘加 → 张量核心 → 计算单元 → 晶粒 → GPU</div><h2>${['一次 A·B 的 64 次乘加', '放进一个张量核心', '四个核心一个单元', '八十个单元一颗晶粒', '两颗晶粒，一颗 GPU'][stage]}</h2><p>${['刚才每一条乘积，都是硅上的一个乘加单元（密度为示意）。', '一个计算单元约有 4 个张量核心（公开资料）。', '绿色方块全部是计算单元。旁边是缓存、接口。', '从矢量版图退到整颗晶粒，和前面看到的是同一张版图。', '同一批数据、同一个精度，下一步交给八颗。'][stage]}</p>`);
  },
};
