// 入口：滚动 / 导出 → 进度 → 一帧。全部状态只从 (进度, 时间, 用户状态) 推导。
import './style.css';
import './style2.css';
import * as THREE from 'three';
import { Engine } from './gfx/engine.js';
import { createWorld } from './gfx/world.js';
import { CHAPTERS, locals, chapterAt, pageHeightVh, SCROLL_UNIT, TOTAL_LEN, ZONES, at } from './core/timeline.js';
import { pose, applyPose } from './core/director.js';
import { packageState, sim, stepSim, snapSim, resetSim, orbitWeight, activation, applyActivation, replayState } from './core/choreo.js';
import { KIND_COL } from './models/package.js';
import { applyPartition } from './core/partition.js';
import { state, patch, load, resetState, snapshot, restoreSnapshot, setPersist, subscribe } from './core/state.js';
import { clamp, lerp, sstep, iv, smoother, DEG, pulse } from './core/util.js';
import { createHud } from './ui/hud.js';
import { theme } from './core/theme.js';
import { systemsUpdate } from './core/systems-choreo.js';
import { flowsUpdate } from './core/flows.js';
import { createInput } from './core/input.js';
import ch01 from './chapters/ch01.js';
import ch02 from './chapters/ch02.js';
import ch03 from './chapters/ch03.js';
import ch04 from './chapters/ch04.js';
import ch05 from './chapters/ch05.js';
import ch06 from './chapters/ch06.js';
import ch07 from './chapters/ch07.js';
import ch08 from './chapters/ch08.js';

const canvas = document.getElementById('gl');
const scroller = document.getElementById('scroller');
const ov = document.getElementById('ov');
const chaptersRoot = document.getElementById('chapters');
const scrimEl = document.getElementById('scrim');

history.scrollRestoration = 'manual';
scroller.style.height = pageHeightVh() + 'vh';
load();

let gl2ok = true;
try { const t = document.createElement('canvas').getContext('webgl2'); if (!t) gl2ok = false; } catch (e) { gl2ok = false; }
if (!gl2ok) document.getElementById('bootmsg').textContent = '这件作品需要 WebGL2，请使用桌面版 Chrome 打开。';

const engine = new Engine(canvas);
const world = createWorld(engine);
const chapters = [ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08];
const v = new THREE.Vector3();

const ctx = {
  engine, world, state, sim, chapters,
  ov, chaptersRoot,
  jump: i => { const c = CHAPTERS[i]; jumpTo(c.start + (c.end - c.start) * [0, .05, .06, .06, .05, .05, .26, .1][i]); },
  jumpP: p => jumpTo(p),
  exporting: false,
};

const f = {
  p: 0, time: 0, dt: 1 / 60, exporting: false, loc: locals(0), ci: 0, W: 2, H: 2, DW: 1920, DH: 1080, dscale: 1,
  viewMm: 0, cam: engine.camera, seam: null, exploreAvail: false, pkgState: null,
  // 三维 → 设计坐标（SVG 使用）
  proj(x, y, z, out = {}) {
    v.set(x, y, z).project(engine.camera);
    out.x = (v.x * .5 + .5) * f.DW;
    out.y = (-v.y * .5 + .5) * f.DH;
    out.z = v.z;
    return out;
  },
  projV(vec, out = {}) { return f.proj(vec.x, vec.y, vec.z, out); },
  unprojectToPlaneY(xd, yd, py) {
    const nx = xd / f.DW * 2 - 1, ny = -(yd / f.DH * 2 - 1);
    const p0 = new THREE.Vector3(nx, ny, -1).unproject(engine.camera);
    const p1 = new THREE.Vector3(nx, ny, 1).unproject(engine.camera);
    const t = (py - p0.y) / (p1.y - p0.y);
    return p0.lerp(p1, t);
  },
};
ctx.f = f;
window.__b200 = ctx;

ctx.hud = createHud(ctx);
for (const c of chapters) c.init(ctx);
const input = createInput(ctx);
ctx.input = input;

function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  const dpr = ctx.exporting ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  engine.resize(W, H, dpr);
  f.W = engine.W; f.H = engine.H;
  f.dscale = Math.min(W / 1920, H / 1080);
  f.DW = W / f.dscale; f.DH = H / f.dscale;
  ov.setAttribute('viewBox', `0 0 ${f.DW} ${f.DH}`);
}
window.addEventListener('resize', () => { resize(); if (ctx.exporting) requestAnimationFrame(() => 0); });
resize();

// 主相机：导演基准 + 开场 + 章内钩子 + 用户轨道 + 焦点。运动模糊的“上一瞬间”走同一个函数
const camPose = {};
const _prevPose = {};
const _prevCam = new THREE.PerspectiveCamera();
function buildPose(p, time, out, withUser) {
  pose(p, out);
  const L = locals(p);
  const intro = introAmount(p, time);
  if (intro < 1) {
    const e = smoother(0, 1, intro);
    out.d = lerp(Math.log(62), out.d, e);
    out.az = lerp(-78 * DEG, out.az, e);
    out.el = lerp(6 * DEG, out.el, e);
    out.ty = lerp(4.4, out.ty, e);
    out.sx = lerp(0, out.sx, e);
    out.ap = lerp(1.0, out.ap, e);
    out.fov = lerp(22, out.fov, e);
  }
  if (ctx.camHook) ctx.camHook(out, { loc: L, time });
  if (!withUser) return out;
  const w = orbitWeight({ loc: L });
  if (w > 0) {
    out.az += sim.az.v * w;
    out.el = clamp(out.el + sim.el.v * w, -85 * DEG, 89.5 * DEG);
    out.d += sim.zoom.v * w;
  }
  const fw = sim.focus.v * pulse(0, .03, .935, .985, L[1]);
  if (fw > 0) {
    out.tx = lerp(out.tx, sim.fx.v, fw);
    out.ty = lerp(out.ty, sim.fy.v, fw);
    out.tz = lerp(out.tz, sim.fz.v, fw);
    out.d = lerp(out.d, sim.fd.v + sim.zoom.v * w, fw);
    out.sx = lerp(out.sx, .06, fw);
  }
  return out;
}
function computeCamera(p, time) {
  buildPose(p, time, camPose, true);
  return applyPose(engine.camera, camPose, f.W, f.H);
}
function introAmount(p, time) {
  const t = locals(p)[0];
  return Math.max(clamp(time / 5.4), clamp(t / .16));
}
ctx.introAmount = introAmount;

const _prev = new THREE.Matrix4();
const DP = (1 / 60 / 1.5) / TOTAL_LEN; // 约一屏 1.5 秒的滚动速度对应的快门

function renderFrame(p, time, dt, exporting) {
  f.p = p; f.time = time; f.dt = dt; f.exporting = exporting;
  f.loc = locals(p);
  f.ci = chapterAt(p);
  f.exploreAvail = false;
  f.viewMm = 0;
  f.seam = null;
  f.dieBoost = 0;
  f.actBase = 0;
  f.loadAct = null;
  f.partitionZone = 0;
  f.scrim = 0;
  engine.params.lens = null;
  world.pkg.clearHighlight();
  world.streaks.begin();

  // 1. 结构状态
  const ps = packageState(f);
  f.pkgState = ps;
  world.pkg.apply(ps);
  systemsUpdate(f, ctx);

  // 2. 相机
  const d = computeCamera(p, time);
  const cam = engine.camera;
  f.camPos = cam.position;
  f.viewMm = 2 * d * Math.tan(cam.fov * DEG / 2);
  f.camDist = d;

  // 3. 灯光与主题
  theme(f, ctx, camPose);

  // 4. 各章：SVG、文字、脉冲。只更新可见范围内的章
  const act = activation(f, world.pkg.regions);
  f.act = act;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const t = f.loc[i];
    const on = t >= (c.from ?? -.02) && t <= (c.to ?? 1.02);
    if (on !== c._on) { c._on = on; c.show?.(on); }
    if (on) c.update(f, t);
  }
  flowsUpdate(f, ctx);
  applyActivation(f, world.pkg, KIND_COL);
  applyPartition(f, world.pkg, f.partitionZone);
  world.streaks.end(f.W / f.H, f.H);
  ctx.hud.update(f);
  if (scrimEl._v !== f.scrim) { scrimEl._v = f.scrim; scrimEl.style.opacity = f.scrim.toFixed(3); }

  // 5. 上一瞬间的相机（用于运动模糊）
  let pv = null;
  if (exporting) {
    // 导出时用固定的进度差和时间差求上一瞬间，同一帧永远得到同样的模糊
    buildPose(Math.max(0, p - DP), Math.max(0, time - 1 / 60), _prevPose, false);
    applyPose(_prevCam, _prevPose, f.W, f.H);
    pv = _prev.multiplyMatrices(_prevCam.projectionMatrix, _prevCam.matrixWorldInverse);
  } else {
    pv = engine.prevVP;
  }
  engine.render(pv);
}

// ---------- 滚动 ----------
let pTarget = 0, pSmooth = 0, tStart = performance.now(), lastT = performance.now();
const scrollMax = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
function readScroll() { pTarget = clamp(window.scrollY / scrollMax()); }
window.addEventListener('scroll', readScroll, { passive: true });

// 导航跳转：滚动条连续滑到目标，画面按同一路径走，时长随距离对数增长
let tween = null;
function jumpTo(p) {
  const from = window.scrollY, to = p * scrollMax();
  const dist = Math.abs(to - from) / window.innerHeight;
  const dur = clamp(.7 + Math.log2(1 + dist) * .3, .7, 2.0);
  tween = { from, to, t0: performance.now(), dur };
}
ctx.cancelTween = () => { tween = null; };
window.addEventListener('wheel', () => { tween = null; }, { passive: true });
window.addEventListener('pointerdown', e => { if (e.target === document.documentElement || e.clientX > window.innerWidth - 20) tween = null; }, { passive: true });
const easeTween = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function loop(now) {
  requestAnimationFrame(loop);
  if (ctx.exporting) return;
  const dt = Math.min(.05, (now - lastT) / 1000);
  lastT = now;
  if (tween) {
    const k = clamp((now - tween.t0) / (tween.dur * 1000));
    window.scrollTo(0, lerp(tween.from, tween.to, easeTween(k)));
    if (k >= 1) tween = null;
  }
  readScroll();
  // 轻微平滑，新的滚动随时打断
  const a = 1 - Math.exp(-dt * 16);
  pSmooth += (pTarget - pSmooth) * a;
  if (Math.abs(pTarget - pSmooth) < 1e-6) pSmooth = pTarget;
  stepSim(dt);
  input.frame(dt);
  renderFrame(pSmooth, (now - tStart) / 1000, dt, false);
  persistScroll(pTarget);
}

let lastPersist = 0;
function persistScroll(p) {
  const n = performance.now();
  if (n - lastPersist < 400) return;
  lastPersist = n;
  try { sessionStorage.setItem('b200-art-scroll', String(p)); } catch (e) { /* 忽略 */ }
}

// ---------- 启动 ----------
function restoreScroll() {
  let p = 0;
  try { p = parseFloat(sessionStorage.getItem('b200-art-scroll')) || 0; } catch (e) { /* 忽略 */ }
  if (location.hash === '#top') p = 0;
  window.scrollTo(0, p * scrollMax());
  readScroll();
  pSmooth = pTarget;
}

let ready = false;
const readyP = new Promise(res => {
  const go = () => {
    restoreScroll();
    // 预热所有着色器，避免第一次看到某结构时卡顿
    try { engine.r.compile(engine.scene, engine.camera); } catch (e) { /* 忽略 */ }
    renderFrame(pSmooth, 0, 1 / 60, false);
    const boot = document.getElementById('boot');
    boot.classList.add('off');
    setTimeout(() => boot.remove(), 900);
    tStart = performance.now();
    lastT = tStart;
    ready = true;
    requestAnimationFrame(loop);
    res();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(go));
  else requestAnimationFrame(go);
});

// ---------- 视频导出 ----------
let exportBackup = null;
const raf2 = () => new Promise(res => {
  let done = false;
  const fin = () => { if (!done) { done = true; res(); } };
  requestAnimationFrame(() => requestAnimationFrame(fin));
  setTimeout(fin, 250); // 无窗口或后台时兜底
});

window.videoExport = {
  runs: ['page'],
  async begin(run = 'page', opts = {}) {
    await readyP;
    exportBackup = { snap: snapshot(), p: pTarget };
    ctx.exporting = true;
    f.exporting = true;
    setPersist(false);
    resetState();
    resetSim();
    snapSim();
    replayState.t0 = null;
    document.body.classList.add('exporting');
    document.documentElement.classList.add('exporting');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    resize();
    renderFrame(0, 0, 1 / 60, true);
    await raf2();
    return {
      chapters: CHAPTERS.map(c => ({
        id: c.id, start: c.start, end: c.end,
        zones: (ZONES[c.id] || []).map(([name, a, b]) => ({ name, start: lerp(c.start, c.end, a), end: lerp(c.start, c.end, b) })),
      })),
    };
  },
  async frame(progress, time) {
    if (!ctx.exporting) await this.begin('page');
    const p = clamp(progress), t = Math.max(0, time);
    resize();
    snapSim();
    renderFrame(p, t, 1 / 60, true);
    // 读回一个像素：确保这一帧的 GPU 工作全部完成
    { const gl = engine.r.getContext(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); engine.r.state.reset?.(); engine.r.resetState(); }
    await raf2();
  },
  end() {
    ctx.exporting = false;
    f.exporting = false;
    document.body.classList.remove('exporting');
    document.documentElement.classList.remove('exporting');
    setPersist(true);
    if (exportBackup) {
      restoreSnapshot(exportBackup.snap);
      snapSim();
      window.scrollTo(0, exportBackup.p * scrollMax());
      readScroll();
      pSmooth = pTarget;
      exportBackup = null;
    }
    resize();
    tStart = performance.now() - 6000; // 开场已看过，恢复后不再重放
    lastT = performance.now();
  },
};
