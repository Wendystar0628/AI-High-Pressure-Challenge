// 编排：全页进度 + 用户状态 → 模型的所有运动量。纯函数：同样的进度和状态永远得到同样的结构。
import { state } from './state.js';
import { CHAPTERS, at } from './timeline.js';
import { iv, sstep, smoother, pulse, lerp, clamp, easeIO, Spring } from './util.js';
import { FORMATS } from './numerics.js';

// ---------- 交互弹簧：新操作可随时打断，从当前值转向新目标 ----------
export const sim = {
  az: new Spring(0, 10), el: new Spring(0, 10), zoom: new Spring(0, 10),
  iso: new Spring(0, 5.2), deep: new Spring(0, 5.2), focus: new Spring(0, 5.2),
  fx: new Spring(0, 6), fy: new Spring(0, 6), fz: new Spring(0, 6), fd: new Spring(Math.log(100), 6),
  explode: new Spring(0, 6), explodeW: new Spring(0, 6),
  seam: new Spring(0, 6), seamW: new Spring(0, 6),
  secOn: new Spring(0, 7), secPos: new Spring(0, 9),
  flip: new Spring(0, 4.5),
  partition: new Spring(0, 3.6),
  open: Array.from({ length: 8 }, () => new Spring(0, 5)),
  replay3: new Spring(0, 1),
  lensX: new Spring(.5, 10), lensY: new Spring(.5, 10), lensW: new Spring(0, 8),
  metric: new Spring(0, 7), product: new Spring(0, 7),
};
export function stepSim(dt) {
  for (const k in sim) {
    const s = sim[k];
    if (Array.isArray(s)) s.forEach(x => x.step(dt));
    else s.step(dt);
  }
}
export function snapSim() {
  for (const k in sim) {
    const s = sim[k];
    if (Array.isArray(s)) s.forEach(x => x.snap());
    else s.snap();
  }
}
export function resetSim() {
  for (const k in sim) {
    const s = sim[k];
    if (Array.isArray(s)) s.forEach(x => x.snap(0));
    else s.snap(0);
  }
  sim.fd.snap(Math.log(100));
  sim.lensX.snap(.5); sim.lensY.snap(.5);
}

// 章内窗口：用户操作生效的范围。离开窗口时操作量连续衰减到零
const w02 = t => pulse(.0, .03, .935, .985, t);
export const orbitWeight = f => {
  const L = f.loc;
  return Math.max(
    pulse(.0, .005, .7, .86, L[0]),
    w02(L[1]),
    pulse(.2, .28, .78, .86, L[2]),
    pulse(.0, .06, .5, .55, L[3]) * .7,
    pulse(.72, .76, .86, .9, L[3]) * .7,
    pulse(.0, .06, .18, .22, L[5]),
    pulse(.04, .1, .96, 1.2, L[7]),
  );
};

// 02 章的展开量（滚动给出的基准）
export function explodeBase(L1) {
  const up = smoother(.015, .2, L1);
  const down1 = lerp(1, .32, smoother(.72, .76, L1));       // 剖切时收拢一些，截面更连贯
  const back = lerp(1, .72, smoother(.82, .84, L1) * (1 - smoother(.86, .88, L1)));
  const seamLevel = lerp(1, 1.3, smoother(.84, .87, L1));
  const down2 = 1 - smoother(.93, 1.0, L1);
  return up * down1 * back * seamLevel * down2;
}

// 每帧写进模型的结构状态
export function packageState(f) {
  const L = f.loc;
  const t1 = L[1];
  const w = w02(t1);
  // 展开量：用户拖动过时，用弹簧在两者之间过渡
  const base = explodeBase(t1);
  const userW = sim.explodeW.v * w;
  const explode = lerp(base, sim.explode.v, userW);

  // 底面 / 基板 / 中介层 / 晶粒 / 显存 的滚动讲解
  const subS = pulse(.36, .4, .445, .47, t1);
  const ipS = pulse(.45, .47, .51, .53, t1);
  const flipS = pulse(.565, .585, .615, .635, t1);
  const deep = sim.deep.v * w;
  const focus = state.part;
  const isHBM = focus && focus.startsWith('hbm');
  const isSub = focus === 'substrate' || focus === 'decaps' || focus === 'balls';
  const isIP = focus === 'interposer';

  // 显存打开：02 章中段、04 章路过时、08 章不打开
  const open = new Array(8);
  for (let i = 0; i < 8; i++) {
    const stg = i * .006;
    const s02 = pulse(.615 + stg, .66 + stg, .715, .75, t1);
    const inFront = i === 5 ? 1 : .55;
    let v = s02 * inFront;
    // 第 04 章：左列在开头、右列在结尾，按相机路过的顺序展开
    const t4 = L[3];
    const left = i === 0 || i === 1 || i === 4 || i === 5;
    const slot = [0, 1, 1, 0, 2, 3, 3, 2][i];
    const s04 = left
      ? pulse(.0 + slot * .018, .06 + slot * .018, .22 + slot * .01, .3, t4)
      : pulse(.72 + slot * .012, .78 + slot * .012, .95, .99, t4);
    v = Math.max(v, s04 * .85);
    if (L[3] > .5 && L[3] < .72) v *= 0;
    open[i] = Math.max(v, sim.open[i].v * Math.max(w, pulse(.02, .06, .94, .98, L[3])));
  }
  const iso = sim.iso.v * w;
  // 剖切
  const sec = sectionState(f);
  // 接缝
  const seamBase = pulse(.862, .89, .915, .935, t1) * 7.5;
  const seam = lerp(seamBase, sim.seam.v, sim.seamW.v * w);

  return {
    explode, seam,
    subSpread: Math.max(subS, (isSub ? deep : 0)),
    ipSpread: Math.max(ipS, (isIP ? deep : 0)),
    flip: Math.max(flipS, sim.flip.v * w),
    open,
    layerSpread: isHBM && deep > 0 ? lerp(2.6, 3.4, deep) : lerp(2.6, 1.7, pulse(-.01, .01, .99, 1.01, L[3])),
    hbmSpread: 1,
    isolate: focus && iso > .001 ? focus : null,
    isoAmt: iso,
    section: sec,
  };
}

export function sectionState(f) {
  const t1 = f.loc[1];
  const zone = pulse(.72, .745, .825, .845, t1);
  const scroll = lerp(-44, 44, iv(.74, .83, t1));
  const on = Math.max(zone, 0);
  const w = pulse(.0, .03, .935, .985, t1);
  const userOn = sim.secOn.v * w;
  const s = state.section;
  const touched = state.sectionTouched;
  const pos = touched ? sim.secPos.v : scroll;
  const amt = touched ? userOn : Math.max(on, userOn);
  return { on: amt > .02, amt, axis: s.axis, pos: lerp(pos, pos, amt) };
}

// ---------- 功能区激活 ----------
// 全页一套激活图：a[region.id] ∈ [0,1]。03 章讲解、用户选区、04/06/08 章负载都写进同一张图
export const replayState = { t0: null };
// 选中一个功能区时，一起反馈的关联区域
export const LINKS = {};
for (const D of ['A', 'B']) {
  const O = D === 'A' ? 'B' : 'A';
  LINKS[`${D}.hbi`] = [`${O}.hbi`, `${D}.l2`, `${D}.l2r`];
  LINKS[`${D}.l2`] = [`${D}.phyL`, `${D}.hbi`];
  LINKS[`${D}.l2r`] = [`${D}.phyR`, `${D}.hbi`];
  LINKS[`${D}.phyL`] = [`${D}.l2`];
  LINKS[`${D}.phyR`] = [`${D}.l2r`];
  LINKS[`${D}.nvl`] = [`${O}.nvl`];
  for (let g = 0; g < 5; g++) LINKS[`${D}.gpc${g}`] = [g < 2 ? `${D}.l2` : `${D}.l2r`];
  LINKS[`${D}.dec`] = [`${D}.l2`]; LINKS[`${D}.ras`] = []; LINKS[`${D}.sec`] = [`${D}.nvl`]; LINKS[`${D}.hub`] = [];
}

// 通信进度：滚动给基准；点“重放”时由时间接管 6 秒，结束后平滑交还滚动
export function commValue(f) {
  const base = iv(.46, .8, f.loc[2]);
  if (replayState.t0 !== null && !f.exporting) {
    const k = (f.time - replayState.t0) / 6;
    if (k >= 1.1) { replayState.t0 = null; return base; }
    if (k >= 1) return lerp(1, base, (k - 1) / .1);
    return k;
  }
  return base;
}

export function activation(f, regions) {
  const L = f.loc;
  const out = {};
  const c = commValue(f);
  f.comm = c;
  // 走完 04 章时收回；04 章由八路数据继续驱动
  const sust = (1 - sstep(.9, 1.0, L[3])) * (L[2] > 0 ? 1 : 0);
  const load = f.loadAct;
  for (const r of regions) {
    const die = r.die === 'A' ? 0 : 1;
    let a = 0;
    if (r.kind === 'phy') a = sstep(.05 + die * .4, .15 + die * .4, c);
    else if (r.kind === 'l2') a = sstep(.2 + die * .26, .3 + die * .26, c);
    else if (r.kind === 'hbi') a = sstep(.36, .46, c);
    else if (r.kind === 'sm') {
      a = die === 1 ? sstep(.55 + r.gpc * .04, .62 + r.gpc * .04, c) : sstep(.72 + r.gpc * .03, .78 + r.gpc * .03, c);
    } else if (r.kind === 'nvl') a = sstep(.88, .96, c) * .7;
    else a = sstep(.08, .2, c) * .45;
    a *= sust;
    if (load && load[r.id] !== undefined) a = Math.max(a, load[r.id]);
    out[r.id] = a;
  }
  // 用户选中的功能区跨章保留
  if (state.region) {
    out[state.region] = Math.max(out[state.region] || 0, .95);
    for (const id of LINKS[state.region] || []) out[id] = Math.max(out[id] || 0, .5);
  }
  return out;
}

// 把激活图写到三维晶粒的每个单元上：波前从区块中心展开，带轻微的数据闪烁
const _gl = [0, 0, 0, 0];
export function applyActivation(f, pkg, KIND_COL) {
  const act = f.act, time = f.time;
  const boost = f.dieBoost || 0;
  const base = f.actBase || 0;
  pkg.setActivation((r, c) => {
    const a = Math.max(act[r.id] || 0, base);
    const col = KIND_COL[r.kind];
    let g = 0;
    if (a > .001) {
      const sh = .55 + .45 * Math.sin(time * (2 + c.seed * 5) + c.seed * 40);
      g = a * (.3 + sh * .55);
    }
    if (boost > 0 && r.kind === 'sm') g = Math.max(g, boost * (.12 + .18 * Math.sin(time * 3 + c.seed * 30)));
    _gl[0] = col[0]; _gl[1] = col[1]; _gl[2] = col[2]; _gl[3] = g;
    return _gl;
  });
}

// 精度对应的 DRAM 占用：同一批数据（FP64 时占满 512 格）
export function occupancyTiles(fmtId) {
  const F = FORMATS[fmtId];
  return Math.round(512 * F.effective / 64);
}
export const FORMAT_COLOR = {
  FP64: [1.0, .34, .32], TF32: [1.0, .62, .18], FP16: [.98, .86, .3], BF16: [.56, .92, .42], FP8: [.3, .86, .92], FP4: [.72, 1.0, .18],
};
