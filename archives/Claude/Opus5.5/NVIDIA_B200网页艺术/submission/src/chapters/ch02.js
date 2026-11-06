// 第 02 章：拆解。分层线稿、三维、引线、剖面都读同一份部件状态。
import * as THREE from 'three';
import { S, A, H, Trace, beat, vis, setText, setHTML } from '../ui/svg.js';
import { iv, sstep, smoother, lerp, pulse, clamp, fract, hash1, DEG } from '../core/util.js';
import { state, patch, subscribe } from '../core/state.js';
import { sim, explodeBase, occupancyTiles, FORMAT_COLOR } from '../core/choreo.js';
import { DIM, PART_INFO, STACK_POS, STACK_DIE, MAT_NAME, SECTION_COL, KIND_COL } from '../models/package.js';
import { FORMATS } from '../core/numerics.js';
import { runPulses, wire } from '../core/flows.js';
import { drawSeamLanes, drawTSV } from '../core/seam.js';
import { partitionState } from '../core/partition.js';

const CAPTIONS = [
  { a: .0, b: .03, c: .2, d: .235, no: '02 / 拆解', h: '逐层打开', p: '自下而上：焊球、基板、C4、中介层、微凸点，再到两颗晶粒和八个显存堆栈。随滚动展开，也可以停在任何一处，亲手拖动。', big: true },
  { a: .235, b: .25, c: .35, d: .37, no: '底面', h: '焊球与基板', p: '约 4,800 颗焊球（示意）围着中央的背面去耦阵列。基板是玻纤芯板加两侧积层，铜走线把信号一层层扇出。' },
  { a: .37, b: .385, c: .445, d: .46, no: '基板内部', h: '九层铜与玻纤', p: '基板在这里分开：铺铜、45° 走线、镀通孔。每一层都是真实几何，可以转到侧面看厚度。' },
  { a: .46, b: .475, c: .525, d: .54, no: '中介层', h: '走线与硅桥', p: '表面 RDL 把显存扇入晶粒；嵌入的硅桥承担最密的连接——晶粒↔显存与跨缝的晶粒↔晶粒。' },
  { a: .54, b: .555, c: .61, d: .625, no: '晶粒', h: '两颗计算晶粒', p: '顶面：青色显存接口、琥珀片间互连、紫色 NVLink、蓝色缓存、绿色计算单元（标明含义的示意布局）。翻过来，底面布满微凸点。' },
  { a: .625, b: .64, c: .715, d: .73, no: '显存', h: '八层 DRAM，一条通孔', p: '基底加八层 DRAM，层间微凸点，硅通孔贯穿全层。亮格是“同一批 30 亿个数值”在当前精度下的逻辑分区——换精度试试。' },
  { a: .73, b: .745, c: .83, d: .845, no: '剖切', h: '实心截面', p: '剖切面切过之处是实心的：硅、铜、焊料、介质各有截面。右侧的二维剖面来自同一份实体清单。' },
  { a: .855, b: .87, c: .925, d: .94, no: '接缝', h: '拉开，就断开', p: '两颗晶粒之间的连接会被拉长、变细、断开；跨缝脉冲停在断口。合拢后重新传输。' },
];

// 分层线稿的行：y 由三维的同一展开量决定
const ROW = {
  balls: { rest: 0, exp: 0, h: 5, label: '焊球' },
  substrate: { rest: 7, exp: 38, h: 11, label: '基板' },
  decaps: { rest: 19, exp: 38, h: 4, label: '去耦' },
  stiffener: { rest: 19, exp: 92, h: 9, label: '加固环' },
  c4: { rest: 20, exp: 138, h: 4, label: 'C4' },
  interposer: { rest: 25, exp: 170, h: 7, label: '中介层' },
  ubumps: { rest: 33, exp: 216, h: 3, label: '微凸点' },
  dies: { rest: 37, exp: 252, h: 8, label: '晶粒 / HBM3e' },
};

export default {
  from: -.02, to: 1.02,
  init(ctx) {
    this.ctx = ctx;
    const root = H('section', 'chap ch02', ctx.chaptersRoot, null, { 'aria-label': '第 02 章 拆解' });
    this.root = root;
    this.caps = CAPTIONS.map(c => {
      const e = H('div', 'cap' + (c.big ? ' big' : ''), root, `<div class="over">${c.no}</div><h2>${c.h}</h2><p>${c.p}</p>`);
      return { ...c, e };
    });

    // ---- 控制台 ----
    const p = H('aside', 'panel p02 pe', root, null, { 'aria-label': '封装探索台' });
    this.panel = p;
    this.info = H('div', 'p-info', p);
    this.btnRow = H('div', 'p-row', p);
    this.bFocus = this._btn(this.btnRow, '单独查看', () => this.setIso(!state.isolate));
    this.bDeep = this._btn(this.btnRow, '深入一级', () => this.setDeep(!state.deep));
    this.bBack = this._btn(this.btnRow, '返回整体', () => this.back());
    this.chips = H('div', 'p-chips', p);
    const list = [['dieA', '晶粒 A'], ['dieB', '晶粒 B'], ['ubumps', '微凸点'], ['interposer', '中介层'], ['c4', 'C4'], ['stiffener', '加固环'], ['decaps', '去耦'], ['substrate', '基板'], ['balls', '焊球']];
    this.chipBtns = {};
    list.forEach(([id, n]) => { this.chipBtns[id] = this._btn(this.chips, n, () => this.select(id), 'chip'); });
    const hb = H('div', 'p-hbm', p, '<span>HBM3e</span>');
    for (let i = 0; i < 8; i++) { this.chipBtns[`hbm${i}`] = this._btn(hb, String(i + 1), () => this.select(`hbm${i}`), 'chip mini'); }

    const sl = (lab, id, min, max, step, val, on, cls = '') => {
      const w = H('label', 'p-sl ' + cls, p, `<span class="p-sl-l">${lab}</span><output></output>`);
      const inp = H('input', '', w, null, { type: 'range', min, max, step, value: val, 'aria-label': lab });
      inp.addEventListener('input', () => on(+inp.value));
      return { w, inp, out: w.querySelector('output') };
    };
    this.sExp = sl('展开', 'exp', 0, 1, .001, 0, v => {
      sim.explode.to(v); sim.explodeW.to(1); patch({ explodeUser: v });
    });
    const secRow = H('div', 'p-row', p);
    this.bSec = this._btn(secRow, '剖切：关', () => {
      const on = !state.section.on;
      patch({ section: { ...state.section, on }, sectionTouched: true });
      sim.secOn.to(on ? 1 : 0);
      sim.secPos.to(state.section.pos);
    });
    this.bAxis = this._btn(secRow, '沿 X 轴', () => {
      const axis = state.section.axis === 'x' ? 'z' : 'x';
      patch({ section: { ...state.section, axis }, sectionTouched: true });
    });
    this.sSec = sl('剖切位置', 'sec', -46, 46, .1, 0, v => {
      if (!state.section.on) sim.secOn.to(1);
      patch({ section: { ...state.section, on: true, pos: v }, sectionTouched: true });
      sim.secPos.to(v);
    });
    this.sSeam = sl('拉开接缝', 'seam', 0, 12, .01, 0, v => {
      sim.seam.to(v); sim.seamW.to(1); patch({ seamUser: v });
    });
    const r3 = H('div', 'p-row', p);
    this.bFlip = this._btn(r3, '翻转晶粒', () => { sim.flip.to(sim.flip.t > .5 ? 0 : 1); });
    this.bFollow = this._btn(r3, '跟随滚动', () => this.followScroll());
    this.readSeam = H('div', 'p-read', p);

    // 分区读数
    this.part = H('div', 'p-part', p);
    this.partSvg = S('svg', { viewBox: '0 0 330 96', class: 'part-svg' }, this.part);
    this.partRows = [];
    for (let l = 0; l < 8; l++) {
      const cells = [];
      for (let c = 0; c < 64; c++) cells.push(S('rect', { x: c * 5.1, y: l * 11.4, width: 4.4, height: 9.6, class: 'pc' }, this.partSvg));
      this.partRows.push(cells);
    }
    this.partTxt = H('div', 'p-part-t', this.part);

    // ---- SVG：分层线稿 ----
    const g = S('g', { class: 'c2' }, ctx.ov);
    this.g = g;
    this.lg = S('g', { class: 'c2-layers' }, g);
    this.rows = {};
    const mkRow = id => {
      const G = S('g', { class: 'c2-row', 'data-id': id, tabindex: '0', role: 'button', 'aria-label': `线稿：${ROW[id].label}` }, this.lg);
      G.addEventListener('click', () => this.select(id === 'dies' ? 'dieA' : id));
      G.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.select(id === 'dies' ? 'dieA' : id); } });
      return G;
    };
    this.rowEl = {};
    for (const id of Object.keys(ROW)) {
      const G = mkRow(id);
      const r = { G, main: S('path', { class: 'c2-shape' }, G), detail: S('path', { class: 'c2-detail' }, G), lab: S('text', { class: 'c2-lab' }, G, ROW[id].label) };
      this.rowEl[id] = r;
    }
    // 显存与晶粒单独的可点元素
    this.dieEl = ['dieA', 'dieB'].map(id => {
      const e = S('rect', { class: 'c2-die', tabindex: '0', role: 'button', 'aria-label': `线稿：${PART_INFO[id].name}` }, this.lg);
      e.addEventListener('click', ev => { ev.stopPropagation(); this.select(id); });
      e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); this.select(id); } });
      return e;
    });
    this.stackEl = [];
    for (let i = 0; i < 8; i++) {
      const sg = S('g', { class: 'c2-stack', tabindex: '0', role: 'button', 'aria-label': `线稿：HBM3e 堆栈 ${i + 1}` }, this.lg);
      const layers = [];
      for (let l = 0; l < 10; l++) layers.push(S('rect', { class: 'c2-sl' + (l === 0 ? ' base' : l === 9 ? ' top' : '') }, sg));
      const tsv = S('path', { class: 'c2-tsv' }, sg);
      sg.addEventListener('click', ev => { ev.stopPropagation(); this.select(`hbm${i}`); });
      sg.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); this.select(`hbm${i}`); } });
      this.stackEl.push({ sg, layers, tsv });
    }
    this.guides = [S('path', { class: 'c2-guide' }, this.lg), S('path', { class: 'c2-guide' }, this.lg)];
    this.lineHead = S('text', { class: 'c2-head' }, this.lg, '分层线稿 · 纵向放大，与三维同步');

    // ---- 三维引线 ----
    this.leadG = S('g', { class: 'c2-leads' }, g);
    const leadParts = [
      ['dieA', '计算晶粒 A', '--sm'], ['dieB', '计算晶粒 B', '--sm'], ['hbm5', 'HBM3e ×8', '--hbm'], ['ubumps', '微凸点层', '--ink'],
      ['interposer', '中介层 + 硅桥', '--hbi'], ['c4', 'C4 凸点', '--ink'], ['stiffener', '加固环', '--ink'], ['decaps', '去耦元件', '--ink'], ['substrate', '基板 9 层', '--ink'], ['balls', '焊球阵列', '--ink'],
    ];
    this.leads = leadParts.map(([id, name, col]) => {
      const lg = S('g', { class: 'lead-g' }, this.leadG);
      const line = S('path', { class: 'lead', fill: 'none' }, lg);
      const dot = S('circle', { r: 3.2, class: 'dot' }, lg);
      const hit = S('rect', { class: 'lead-hit', width: 170, height: 34, rx: 2 }, lg);
      const text = S('text', { class: 'lab-name' }, lg, name);
      hit.addEventListener('click', () => this.select(id));
      return { id, name, col, lg, line, dot, hit, text, y: 0 };
    });

    // 功能区标注（晶粒段 / 深入晶粒）
    this.zoneG = S('g', { class: 'c2-zones' }, g);
    this.zones = [
      ['A.hbi', '片间互连 NV-HBI', '--hbi'], ['A.phyR', '显存接口', '--hbm'], ['A.nvl', 'NVLink 接口', '--nvl'], ['A.l2', '二级缓存', '--l2'], ['A.gpc2', '计算单元', '--sm'], ['A.dec', '解压缩', '--dec'], ['A.ras', 'RAS', '--ras'],
    ].map(([id, name, col]) => {
      const lg = S('g', { class: 'lead-g' }, this.zoneG);
      return { id, name, col, lg, line: S('path', { class: 'lead', fill: 'none' }, lg), dot: S('circle', { r: 2.8, class: 'dot' }, lg), text: S('text', { class: 'lab-name' }, lg, name) };
    });

    // 剖面线稿
    this.secG = S('g', { class: 'c2-sec' }, g);
    this.secBox = S('rect', { class: 'c2-secbox' }, this.secG);
    this.secTitle = S('text', { class: 'c2-head' }, this.secG);
    this.secPaths = {};
    for (const m of Object.keys(SECTION_COL)) {
      const c = SECTION_COL[m];
      const col = `rgb(${c.map(v => Math.round(Math.min(1, v * 1.2) * 255)).join(',')})`;
      this.secPaths[m] = S('path', { fill: col, 'data-m': m }, this.secG);
    }
    this.secMark = S('path', { class: 'c2-secmark' }, this.secG);
    this.secKey = [];
    ['silicon', 'dram', 'copper', 'solder', 'core', 'laminate', 'steel', 'bridge'].forEach((m, i) => {
      const kg = S('g', {}, this.secG);
      const c = SECTION_COL[m];
      S('rect', { width: 10, height: 10, x: 0, y: 0, fill: `rgb(${c.map(v => Math.round(Math.min(1, v * 1.2) * 255)).join(',')})` }, kg);
      S('text', { class: 'c2-key', x: 15, y: 9 }, kg, MAT_NAME[m]);
      this.secKey.push(kg);
    });

    // 接缝读数（走线字）
    this.seamTr = new Trace(g, { size: 60, cls: 'seamtr', weight: 6 });
    this.seamLab = S('text', { class: 'c2-seamlab' }, g);

    this.note = H('div', 'note-micro', p, '示意范围：封装外形与比例参考公开资料；焊球、凸点、硅通孔的数量与晶粒内部布局为标明含义的示意，拆解时层厚按需放大。');
    this._unsub = subscribe(() => this.syncUI());
    this.syncUI();

    this.plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.planes = [this.plane];
    this.vA = new THREE.Vector3(); this.vB = new THREE.Vector3();
  },

  _btn(parent, text, fn, cls = 'btn') {
    const b = H('button', cls, parent, text, { type: 'button' });
    b.addEventListener('click', fn);
    return b;
  },

  show(on) {
    vis(this.root, on); vis(this.g, on);
    if (!on) {
      this.ctx.engine.r.clippingPlanes = [];
      this.ctx.world.caps.mesh.visible = false;
    }
  },

  select(id) {
    const same = state.part === id;
    patch({ part: same ? null : id, deep: same ? false : state.deep && false, isolate: same ? false : state.isolate });
    if (!same) {
      sim.focus.to(1);
      sim.fd.to(Math.log(this.focusDist(id)));
      if (state.isolate) sim.iso.to(1);
    } else {
      sim.focus.to(0); sim.iso.to(0); sim.deep.to(0);
    }
    sim.deep.to(0);
    this.syncOpen();
  },
  focusDist(id) {
    const r = this.ctx.world.pkg.radius(id);
    return r * (state.deep ? (id.startsWith('hbm') ? 8.5 : 3.8) : 3.4);
  },
  setIso(v) { patch({ isolate: v }); sim.iso.to(v ? 1 : 0); },
  setDeep(v) {
    if (!state.part) this.select('hbm5');
    patch({ deep: v });
    sim.deep.to(v ? 1 : 0);
    if (state.part) sim.fd.to(Math.log(this.focusDist(state.part)));
    if (v && !state.isolate) this.setIso(true);
    sim.flip.to(0);
    this.syncOpen();
  },
  syncOpen() {
    for (let i = 0; i < 8; i++) sim.open[i].to(state.part === `hbm${i}` && state.deep ? 1 : 0);
    if (state.part && state.part.startsWith('hbm')) sim.partition.to(1); else sim.partition.to(0);
  },
  back() {
    patch({ part: null, deep: false, isolate: false });
    sim.focus.to(0); sim.iso.to(0); sim.deep.to(0); sim.flip.to(0);
    sim.az.to(0); sim.el.to(0); sim.zoom.to(0);
    this.syncOpen();
  },
  followScroll() {
    patch({ explodeUser: null, seamUser: null, sectionTouched: false, section: { ...state.section, on: false } });
    sim.explodeW.to(0); sim.seamW.to(0); sim.secOn.to(0);
  },
  esc() {
    if (state.deep) { this.setDeep(false); return; }
    if (state.isolate) { this.setIso(false); return; }
    this.back();
  },
  pick(ray) {
    const t = this.ctx.f.loc[1];
    if (t < 0 || t > .985) return;
    const hit = this.ctx.world.pkg.pick(ray.origin, ray.direction);
    if (hit) this.select(hit.id);
  },
  hover(ray) {
    const t = this.ctx.f.loc[1];
    if (t < 0 || t > .985) return null;
    const hit = this.ctx.world.pkg.pick(ray.origin, ray.direction);
    this.hoverId = hit ? hit.id : null;
    if (!hit) return null;
    const info = PART_INFO[hit.id];
    const layer = hit.layer != null ? (hit.layer === 0 ? ' · 基底' : hit.layer === 9 ? ' · 顶盖' : ` · DRAM ${hit.layer}`) : '';
    return `${info ? info.name : ''}${layer}`;
  },

  syncUI() {
    const id = state.part;
    for (const k in this.chipBtns) this.chipBtns[k].classList.toggle('on', k === id);
    const info = id ? PART_INFO[id] : null;
    if (info) {
      setHTML(this.info, `<div class="over">${info.en}</div><h3>${info.name}</h3><div class="p-dim">${info.dim}</div><p>${info.note}</p>${this.deepNote(id)}`);
    } else {
      setHTML(this.info, `<div class="over">探索台</div><h3>选一个部件</h3><p>点击模型、线稿或下面的名字。单独查看后可深入一级：显存看层与通孔，晶粒看功能区，基板和中介层看内部连接。</p>`);
    }
    this.bFocus.classList.toggle('on', !!state.isolate);
    this.bDeep.classList.toggle('on', !!state.deep);
    this.bFocus.disabled = !id; this.bDeep.disabled = !id;
    setText(this.bSec, `剖切：${state.section.on ? '开' : '关'}`);
    this.bSec.classList.toggle('on', !!state.section.on);
    setText(this.bAxis, state.section.axis === 'x' ? '沿 X 轴' : '沿 Z 轴');
    this.sSec.inp.value = state.section.pos;
    this.bFollow.classList.toggle('on', state.explodeUser === null && !state.sectionTouched && state.seamUser === null);
  },
  deepNote(id) {
    if (!state.deep) return '';
    if (id.startsWith('hbm')) return '<p class="p-deep">已展开：基底 + 8 层 DRAM。铜色短柱是硅通孔，亮点是层间微凸点；转到侧面可以看到通孔贯穿。</p>';
    if (id === 'dieA' || id === 'dieB') return '<p class="p-deep">功能区已标注。可用“翻转晶粒”看底面微凸点。</p>';
    if (id === 'substrate' || id === 'decaps' || id === 'balls') return '<p class="p-deep">九层已分开：看 45° 走线、铺铜和芯板的镀通孔。</p>';
    if (id === 'interposer') return '<p class="p-deep">三层已分开：底层贯穿孔、中层硅桥、顶层 RDL 走线。</p>';
    return '';
  },

  update(f, t) {
    const { ctx } = this;
    const { pkg, streaks, caps } = ctx.world;
    const ps = f.pkgState;

    // ---- 文字 ----
    for (const c of this.caps) beat(c.e, t, c.a, c.b, c.c, c.d, { dist: 4 });
    const panelA = sstep(.02, .06, t) * (1 - sstep(.935, .97, t));
    this.panel.style.opacity = panelA.toFixed(3);
    this.panel.style.transform = `translate3d(${(1 - panelA) * 2}rem,0,0)`;
    vis(this.panel, panelA > .002);
    this.panel.style.pointerEvents = panelA > .7 ? '' : 'none';
    f.scrim = Math.max(f.scrim, pulse(.03, .08, .92, .97, t));

    f.exploreAvail = t > 0 && t < .97;
    if (panelA > .5) {
      ctx.hud.setHint(state.explore ? '探索模式：滚轮缩放，页面不滚动' : '拖动旋转 · 点击选择部件 · Esc 返回');
    }
    // 滑块跟随当前值（用户未拖动时显示滚动给出的量）
    if (document.activeElement !== this.sExp.inp) this.sExp.inp.value = ps.explode.toFixed(3);
    setText(this.sExp.out, `${Math.round(ps.explode * 100)}%`);
    if (document.activeElement !== this.sSeam.inp) this.sSeam.inp.value = ps.seam.toFixed(2);
    setText(this.sSeam.out, `${ps.seam.toFixed(1)} mm`);
    const secAmt = ps.section.amt;
    if (document.activeElement !== this.sSec.inp && secAmt > .01) this.sSec.inp.value = ps.section.pos.toFixed(1);
    setText(this.sSec.out, secAmt > .02 ? `${ps.section.axis.toUpperCase()} = ${ps.section.pos.toFixed(1)} mm` : '—');
    const secShown = secAmt > .02;
    this.bSec.classList.toggle('on', secShown);
    setText(this.bSec, `剖切：${secShown ? '开' : '关'}`);

    // ---- 焦点跟随部件当前位置（展开时部件在动） ----
    if (state.part) {
      pkg.center(state.part, this.vA);
      sim.fx.to(this.vA.x); sim.fy.to(this.vA.y); sim.fz.to(this.vA.z);
      if (f.exporting) { sim.fx.snap(); sim.fy.snap(); sim.fz.snap(); }
    }

    // ---- 选中 / 悬停高亮 ----
    const sel = state.part;
    const hl = id => (sel === id ? .1 : 0) + (this.hoverId === id ? .05 : 0);
    if (t > 0 && t < 1) {
      for (const id of ['balls', 'substrate', 'stiffener', 'decaps', 'c4', 'interposer', 'ubumps', 'dieA', 'dieB']) pkg.highlight(id, hl(id) * panelA, id === 'interposer' ? 0xff9a2e : id.startsWith('die') ? 0xb8f23a : 0xffe0b0);
      for (let i = 0; i < 8; i++) pkg.highlight(`hbm${i}`, hl(`hbm${i}`) * panelA, 0x56d8ff);
    }

    // ---- 分层线稿 ----
    this.updateLayers(f, t, ps, panelA);

    // ---- 引线 ----
    this.updateLeads(f, t, ps, panelA);

    // ---- 显存分区（三维 + 二维） ----
    this.updatePartition(f, t, ps);

    // ---- 脉冲：随部件走 ----
    this.updateFlows(f, t, ps);

    // ---- 剖切 ----
    const sec = ps.section;
    const r = ctx.engine.r;
    if (sec.on && t < 1) {
      const axis = sec.axis, pos = sec.pos;
      const camC = axis === 'x' ? f.camPos.x : f.camPos.z;
      const sign = camC >= pos ? 1 : -1;
      this.plane.normal.set(axis === 'x' ? -sign : 0, 0, axis === 'z' ? -sign : 0);
      this.plane.constant = sign * pos;
      r.clippingPlanes = this.planes;
      const rects = pkg.sectionRects(axis, pos);
      caps.update(rects, axis, pos);
      ctx.world.stage.visible = false;
      this.update2DSection(f, rects, axis, pos, sec.amt);
      // 平面外框
      const a = axis === 'x' ? 50 : 54, h0 = -24, h1 = 62;
      const pts = axis === 'x'
        ? [[pos, h0, -a], [pos, h1, -a], [pos, h1, a], [pos, h0, a], [pos, h0, -a]]
        : [[-a, h0, pos], [-a, h1, pos], [a, h1, pos], [a, h0, pos], [-a, h0, pos]];
      wire(streaks, pts, [.35, .9, 1], 1.1 * sec.amt, .05);
    } else {
      r.clippingPlanes = [];
      caps.mesh.visible = false;
      vis(this.secG, false);
    }

    // ---- 接缝读数 ----
    const seamZone = Math.max(pulse(.86, .875, .925, .94, t), ps.seam > .02 ? panelA : 0);
    const bw = 10 * (f.seamAlive ?? 1);
    this.seamTr.opacity(seamZone);
    setText(this.readSeam, `跨缝带宽 ${bw.toFixed(1)} TB/s · 连接 ${Math.round((f.seamAlive ?? 1) * 100)}%`);
    this.readSeam.classList.toggle('warn', (f.seamAlive ?? 1) < .99);
    if (seamZone > .002) {
      const s = bw.toFixed(1).padStart(4, ' ') + ' TB/S';
      this.seamTr.draw(f.DW / 2 + 40, 92, s, { anchor: 'middle', deform: (u, v, i) => [u + (i < 4 ? (1 - (f.seamAlive ?? 1)) * Math.sin(v * 3 + i) * .4 : 0), v] });
      this.seamTr.stroke((f.seamAlive ?? 1) < .5 ? 'var(--ras)' : 'var(--hbi)');
      A(this.seamLab, { x: f.DW / 2 + 40, y: 178, opacity: seamZone });
      setText(this.seamLab, (f.seamAlive ?? 1) < .02 ? '连接已断开 · 跨缝传输停止' : '片间互连实时带宽（示意：按存活连接比例）');
    } else A(this.seamLab, { opacity: 0 });
  },

  updateLayers(f, t, ps, panelA) {
    const e = ps.explode;
    const baseY = f.DH - 96;
    const cx = 330, sc = 4.1; // 线稿中心与每毫米像素
    const op = panelA;
    A(this.lg, { opacity: op });
    if (op < .002) return;
    A(this.lineHead, { x: cx - 188, y: baseY + 24 });
    const y = (id) => baseY - (ROW[id].rest + ROW[id].exp * e);
    const sel = state.part;
    const rect = (x0, x1, yy, h) => `M${x0} ${yy}L${x1} ${yy}L${x1} ${yy - h}L${x0} ${yy - h}Z`;
    const W = 46 * sc;
    // 焊球
    {
      let d = '';
      const yy = y('balls');
      for (let i = -14; i <= 14; i++) {
        if (Math.abs(i) < 5) continue;
        d += `M${cx + i * 13 - 2.4} ${yy - 2.2}a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0`;
      }
      A(this.rowEl.balls.main, { d });
    }
    // 基板（内部分层随 subSpread）
    {
      const yy = y('substrate');
      const spread = ps.subSpread;
      let d = '', de = '';
      for (let l = 0; l < 9; l++) {
        const yl = yy - l * (1.2 + spread * 5);
        d += rect(cx - W * .92, cx + W * .92, yl, 1.1);
        if (l % 2 === 1 && spread > .05) {
          for (let k = -6; k < 6; k++) de += `M${cx + k * 28 + 5} ${yl - 1.8}h16`;
        }
      }
      A(this.rowEl.substrate.main, { d });
      A(this.rowEl.substrate.detail, { d: de });
    }
    // 去耦
    {
      const yy = baseY - (ROW.decaps.rest + ROW.decaps.exp * e) - ps.subSpread * 42;
      let d = '';
      for (let i = -8; i <= 8; i++) { if (Math.abs(i) < 6) continue; d += rect(cx + i * 22 - 5, cx + i * 22 + 5, yy, 4); }
      A(this.rowEl.decaps.main, { d });
    }
    // 加固环
    {
      const yy = y('stiffener');
      const X0 = 45 * sc * .92, X1 = 35 * sc * .92;
      A(this.rowEl.stiffener.main, { d: rect(cx - X0, cx - X1, yy, 8) + rect(cx + X1, cx + X0, yy, 8) });
    }
    // C4
    {
      const yy = y('c4');
      let d = '';
      for (let i = -12; i <= 12; i++) d += `M${cx + i * 8.8 - 1.8} ${yy - 1.8}a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0`;
      A(this.rowEl.c4.main, { d });
    }
    // 中介层 + 硅桥
    {
      const yy = y('interposer');
      const s = ps.ipSpread;
      const X = 30 * sc * .92;
      let d = rect(cx - X, cx + X, yy + s * 8, 3) + rect(cx - X, cx + X, yy - s * 8 - 3.6, 2.4);
      let de = '';
      for (const u of [-13, -6.5, 0, 6.5, 13]) de += rect(cx + u * sc - 6, cx + u * sc + 6, yy - 3, 1.6);
      for (const u of [-22, 22]) de += rect(cx + u * sc - 9, cx + u * sc + 9, yy - 3, 1.6);
      A(this.rowEl.interposer.main, { d });
      A(this.rowEl.interposer.detail, { d: de });
    }
    // 微凸点
    {
      const yy = y('ubumps');
      let d = '';
      for (let i = -44; i <= 44; i++) d += `M${cx + i * 2.65} ${yy - 1}v-2`;
      A(this.rowEl.ubumps.main, { d });
    }
    // 晶粒 + 显存列：按俯视的左右顺序展开排列
    const yD = y('dies');
    const dieW = 92;
    // 接缝拉开
    const gap = ps.seam * 2.2;
    A(this.dieEl[0], { x: cx - dieW - gap / 2 - .8, y: yD - 8, width: dieW, height: 8, class: 'c2-die' + (sel === 'dieA' ? ' sel' : '') });
    A(this.dieEl[1], { x: cx + gap / 2 + .8, y: yD - 8, width: dieW, height: 8, class: 'c2-die' + (sel === 'dieB' ? ' sel' : '') });
    const order = [1, 0, 5, 4, 2, 3, 6, 7]; // 左列、右列
    const sw = 21, sg = 3;
    const spreadX = e * 8;
    let tsvMax = 0;
    order.forEach((si, k) => {
      const left = k < 4;
      const col = left ? (3 - k) : k - 4;
      const X = left ? cx - dieW - 9 - spreadX - (col + 1) * (sw + sg) + sg : cx + dieW + 9 + spreadX + col * (sw + sg);
      const se = this.stackEl[si];
      const open = ps.open[si];
      const gapL = 1.2 + open * 8.2;
      let tsv = '';
      const sl = sel === `hbm${si}`;
      se.sg.setAttribute('class', 'c2-stack' + (sl ? ' sel' : ''));
      for (let l = 0; l < 10; l++) {
        const h = l === 0 ? 2.6 : l === 9 ? 2.2 : 1.3;
        const yL = yD - l * gapL - h;
        A(se.layers[l], { x: X, y: yL, width: sw, height: h });
      }
      const top = yD - 9 * gapL - 2;
      for (const q of [.3, .5, .7]) tsv += `M${X + sw * q} ${yD}L${X + sw * q} ${top}`;
      A(se.tsv, { d: tsv, opacity: .35 + open * .65 });
      tsvMax = Math.max(tsvMax, 9 * gapL);
    });

    // 导向线：连到两端，展开时变长（就是拆解的“连接线”）
    const gx = W * .92;
    const yb = y('balls'), yt = y('dies') - 6;
    A(this.guides[0], { d: `M${cx - gx} ${yb}L${cx - gx} ${yt}`, opacity: e });
    A(this.guides[1], { d: `M${cx + gx} ${yb}L${cx + gx} ${yt}`, opacity: e });

    // 行标签与选中态
    const labX = cx + W + 12;
    const parts = Object.keys(ROW);
    // 标签避让：按 y 排序后最小间距 14
    const ys = parts.map(id => ({ id, y: id === 'decaps' ? baseY - (ROW.decaps.rest + ROW.decaps.exp * e) - ps.subSpread * 42 : y(id) }));
    ys.sort((a, b) => b.y - a.y);
    let last = Infinity;
    for (const it of ys) {
      let yy = it.y;
      if (yy > last - 13) yy = last - 13;
      last = yy;
      A(this.rowEl[it.id].lab, { x: labX, y: yy, opacity: e > .1 ? 1 : (it.id === 'dies' || it.id === 'substrate' ? 1 : 0) });
      const on = sel === it.id || (it.id === 'dies' && sel && (sel.startsWith('die') || sel.startsWith('hbm')));
      this.rowEl[it.id].G.setAttribute('class', 'c2-row' + (on ? ' sel' : ''));
    }
  },

  updateLeads(f, t, ps, panelA) {
    const { ctx } = this;
    const pkg = ctx.world.pkg;
    const P = f.proj;
    const lx = 1228;
    const leadA = sstep(.05, .13, t) * (1 - sstep(.86, .9, t)) * (1 - sstep(.72, .74, t) * (1 - sstep(.845, .86, t)));
    A(this.leadG, { opacity: leadA });
    vis(this.leadG, leadA > .002);
    if (leadA > .002) {
      const items = [];
      for (const L of this.leads) {
        const c = pkg.center(L.id, this.vA);
        const nd = pkg.parts[L.id];
        const hidden = !nd.obj.visible;
        // 引线端点放在部件朝相机一侧的角上
        const a = this.anchorOf(L.id, nd, this.vB);
        const p = P(a.x, a.y, a.z);
        const stage = this.leadStage(L.id, t);
        items.push({ L, p, a: a.clone(), stage, hidden });
      }
      // 排序 + 最小间距：标注随部件定位，不互相覆盖
      items.sort((a, b) => a.p.y - b.p.y);
      let last = 110;
      for (const it of items) { it.y = Math.max(it.p.y, last + 34); last = it.y; }
      let over = last - (f.DH - 80);
      if (over > 0) {
        for (let i = items.length - 1; i >= 0; i--) {
          items[i].y -= over;
          if (i > 0 && items[i - 1].y > items[i].y - 34) over = items[i - 1].y - (items[i].y - 34);
          else break;
        }
      }
      for (const it of items) {
        const { L, p, stage } = it;
        if (stage <= .002 || it.hidden) { A(L.lg, { opacity: 0, style: 'pointer-events:none' }); continue; }
        const occ = pkg.occluded(f.camPos, it.a, L.id);
        const sel = state.part === L.id;
        const dim = state.part && !sel ? .45 : 1;
        const tx = lx;
        const ex = lerp(p.x, tx, stage), ey = lerp(p.y, it.y, stage);
        const mid = lerp(p.x, tx - 28, stage);
        A(L.line, { d: `M${p.x} ${p.y}L${mid} ${ey}L${ex} ${ey}`, 'stroke-dasharray': occ ? '3 4' : 'none' });
        A(L.dot, { cx: p.x, cy: p.y, class: occ ? 'dot hollow' : 'dot' });
        A(L.text, { x: tx + 8, y: it.y + 5, opacity: sstep(.6, 1, stage), class: 'lab-name' + (sel ? ' sel' : '') });
        A(L.hit, { x: tx, y: it.y - 17 });
        A(L.lg, { opacity: stage * dim, style: `--c:var(${L.col});pointer-events:${stage > .8 ? 'auto' : 'none'}` });
      }
    }

    // 功能区
    const zoneA = Math.max(pulse(.54, .56, .605, .625, t), (state.deep && state.part && state.part.startsWith('die')) ? 1 : 0) * (t < 1 ? 1 : 0);
    A(this.zoneG, { opacity: zoneA });
    vis(this.zoneG, zoneA > .002);
    if (zoneA > .002) {
      const dieW = pkg.parts.dieA.w;
      const flipOn = ps.flip > .3;
      const y = DIM.die.y0 + DIM.die.h + dieW.y;
      const top = 150;
      this.zones.forEach((z, k) => {
        const r = pkg.regionById[z.id];
        const p = P(r.cx, y, r.cz + dieW.z);
        const tx = 720 + k * 118, ty = top - (k % 2) * 32;
        A(z.line, { d: `M${p.x} ${p.y}L${tx} ${ty + 6}L${tx} ${ty + 6}`, opacity: flipOn ? .25 : 1 });
        A(z.dot, { cx: p.x, cy: p.y });
        A(z.text, { x: tx, y: ty, 'text-anchor': 'middle' });
        A(z.lg, { style: `--c:var(${z.col})`, opacity: flipOn ? .3 : 1 });
      });
    }
  },
  leadStage(id, t) {
    // 随拆解顺序一根根长出来；局部讲解时只留下相关的引线，其余收回
    const order = { balls: .07, substrate: .08, decaps: .085, stiffener: .095, c4: .105, interposer: .115, ubumps: .125, dieA: .135, dieB: .14, hbm5: .145 };
    const g = sstep(order[id], order[id] + .035, t);
    const focus = [
      [.24, .37, ['balls', 'substrate']], [.37, .46, ['substrate', 'decaps']], [.46, .54, ['interposer', 'c4', 'ubumps']],
      [.54, .625, ['dieA', 'dieB']], [.625, .73, ['hbm5']],
    ];
    let keep = 1;
    for (const [a, b, ids] of focus) {
      if (t > a - .012 && t < b + .012 && !ids.includes(id)) keep = Math.min(keep, 1 - pulse(a - .012, a + .004, b - .004, b + .012, t));
    }
    if (state.part === id) keep = 1;
    return g * keep;
  },
  anchorOf(id, nd, out) {
    const w = nd.w;
    switch (id) {
      case 'balls': return out.set(44 + w.x, .3 + w.y, 40 + w.z);
      case 'substrate': return out.set(46 + w.x, 2.6 + w.y, 20 + w.z);
      case 'decaps': return out.set(32.6 + w.x, 3.4 + w.y, 18 + w.z);
      case 'stiffener': return out.set(45 + w.x, 4 + w.y, -6 + w.z);
      case 'c4': return out.set(28.5 + w.x, 2.9 + w.y, 24 + w.z);
      case 'interposer': return out.set(30 + w.x, 3.5 + w.y, 10 + w.z);
      case 'ubumps': return out.set(16.6 + w.x, 3.6 + w.y, 24 + w.z);
      case 'dieA': return out.set(17 + w.x, 4.4 + w.y, -8 + w.z);
      case 'dieB': return out.set(17 + w.x, 4.4 + w.y, 22 + w.z);
      default: {
        const [sx, sz] = nd.center;
        return out.set(sx + w.x + 5.5, 4.2 + w.y, sz + 5.8);
      }
    }
  },

  updatePartition(f, t, ps) {
    const fmt = state.precision;
    const zone = Math.max(pulse(.62, .64, .72, .735, t), sim.partition.v * (t < .985 ? 1 : 0));
    const on = zone > .01 && t < 1;
    vis(this.part, on);
    if (!on) return;
    f.partitionZone = Math.max(f.partitionZone, zone);
    this.part.style.opacity = sstep(0, .4, zone).toFixed(2);
    const F = FORMATS[fmt];
    const col = FORMAT_COLOR[fmt];
    const { occ, grp, target } = partitionState;
    this.partRows.forEach((row, l) => row.forEach((r, c) => {
      const abs = l * 64 + c;
      const u = abs < occ;
      const isScale = fmt === 'FP4' && (abs % 8 === 7);
      const band = Math.floor(abs / grp) % 2;
      const cls = 'pc' + (u ? (isScale ? ' sc' : (band ? ' on b' : ' on')) : '');
      if (r._c !== cls) { r._c = cls; r.setAttribute('class', cls); }
    }));
    this.partSvg.style.setProperty('--fc', `rgb(${col.map(v => Math.round(v * 255)).join(',')})`);
    const gb = 3e9 * F.effective / 8 / 1e9;
    setHTML(this.partTxt, `<b>${fmt}</b> 同一批 30 亿个数值 → ${gb.toFixed(gb < 2 ? 2 : 1)} GB · ${Math.round(target)} / 512 分区 · 每堆栈 ${(gb / 24 * 100).toFixed(1)}%<br>${fmt === 'FP4' ? '每 16 值共享一个 E4M3 缩放（紫格）' : `每组 ${grp} 格 = ${F.store} 位一字`}`);
  },

  updateFlows(f, t, ps) {
    const { ctx } = this;
    const { pkg, streaks } = ctx.world;
    const e = ps.explode;
    const time = f.time;
    const fa = sstep(.03, .16, t) * (1 - sstep(.72, .75, t)) + sstep(.85, .87, t) * (1 - sstep(.97, 1, t));
    if (t > 0 && t < 1) drawTSV(f, ctx);
    if (fa <= .01) { f.seamAlive = drawSeamLanes(f, ctx, 0); return; }

    // 拆解的“连接线”：四角贯穿各层，展开即伸长，脉冲沿线向上
    const yb = pkg.parts.balls.w.y, yt = pkg.parts.dieA.w.y + 4.5;
    if (e > .02) {
      for (const [x, z] of [[-30, -26], [30, -26], [30, 26], [-30, 26], [0, 26], [0, -26]]) {
        const pts = [[x, yb + .4, z], [x, yt, z]];
        wire(streaks, pts, [.75, .85, .95], .12 * e * fa, .018);
        const u = fract(time * .22 + hash1(x + z * 3));
        const y = lerp(yb + .4, yt, u);
        streaks.add(x, y - 1.8, z, x, y + .2, z, 5 * fa * e, 4.2 * fa * e, 1.6 * fa * e, .05);
      }
    }
    // 显存 → 晶粒
    for (let si = 0; si < 8; si++) {
      if (!pkg.stacks[si].obj.visible) continue;
      const path = pkg.pathHBMtoCompute(si, { lx: (si % 3 - 1) * 1.6, lz: (si % 2 - .5) * 2 });
      runPulses(streaks, path, { n: 2, speed: .34, time, phase: si * .13, color: [.32, .85, 1], gain: 5 * fa, width: .05, tail: .06 });
    }
    // 跨缝
    f.seamAlive = drawSeamLanes(f, ctx, fa);
  },

  update2DSection(f, rects, axis, pos, amt) {
    vis(this.secG, true);
    const x0 = 112, w = 420, top = 300, h = 190;
    // 放置在左上（线稿上方）
    A(this.secG, { opacity: sstep(.05, .5, amt) });
    A(this.secBox, { x: x0 - 8, y: top - 26, width: w + 16, height: h + 74 });
    // 按实体范围自适应纵向比例
    let ymin = Infinity, ymax = -Infinity, amin = Infinity, amax = -Infinity;
    for (const r of rects) { if (r.y0 < ymin) ymin = r.y0; if (r.y1 > ymax) ymax = r.y1; if (r.a0 < amin) amin = r.a0; if (r.a1 > amax) amax = r.a1; }
    if (!isFinite(ymin)) { ymin = 0; ymax = 1; amin = -46; amax = 46; }
    const span = Math.max(92, amax - amin);
    const sx = w / span, sy = h / Math.max(6, ymax - ymin);
    const ac = (amin + amax) / 2;
    const D = {};
    for (const r of rects) {
      const X0 = x0 + w / 2 + (r.a0 - ac) * sx, X1 = x0 + w / 2 + (r.a1 - ac) * sx;
      const Y0 = top + h - (r.y0 - ymin) * sy, Y1 = top + h - (r.y1 - ymin) * sy;
      const pw = Math.max(X1 - X0, .5), ph = Math.max(Y0 - Y1, .5);
      D[r.mat] = (D[r.mat] || '') + `M${X0.toFixed(1)} ${(Y0).toFixed(1)}h${pw.toFixed(1)}v${(-ph).toFixed(1)}h${(-pw).toFixed(1)}z`;
    }
    for (const m in this.secPaths) A(this.secPaths[m], { d: D[m] || '' });
    A(this.secTitle, { x: x0, y: top - 8 });
    setText(this.secTitle, `二维剖面 · ${axis.toUpperCase()} = ${pos.toFixed(1)} mm · ${rects.length} 个实体截面 · 纵向放大 ${(sy / sx).toFixed(1)}×`);
    this.secKey.forEach((k, i) => A(k, { transform: `translate(${x0 + (i % 4) * 104} ${top + h + 10 + Math.floor(i / 4) * 16})` }));
  },
};
