// ============================================================
// 主入口：装配三维 / SVG / DOM，滚动驱动渲染循环，导航与导出接口
// ============================================================
import { Pipeline } from './three/pipeline.js';
import { SceneCtrl } from './three/scene-ctrl.js';
import {
  scrollProgress, progressToScrollY, chapterRanges, CHAPTERS, LAYOUT,
  progressToChapter, smooth, clamp01, map, segT,
} from './timeline.js';
import { store, PRECISIONS, precisionById, workload } from './state.js';
import { SvgCh01, SvgCh02, SvgCh03, SvgCh04 } from './svg/scenes-a.js';
import { SvgCh05, SvgCh06, SvgCh07, SvgCh08 } from './svg/scenes-b.js';
import { Transitions } from './svg/transitions.js';
import { Beats, h } from './ui/beats.js';
import { Labs } from './ui/labs.js';
import { installVideoExport } from './export.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// 错误捕获（定位运行时问题）
window.addEventListener('error', (e) => {
  console.error('[B200 err]', e.message, '@', e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[B200 rej]', e.reason);
});

// ---------- 启动 ----------
const canvas = document.getElementById('gl');
const svgRoot = document.getElementById('svg-overlay');
const domOverlay = document.getElementById('dom-overlay');

const pipeline = new Pipeline(canvas);
const scene = new SceneCtrl(pipeline);
window.__scene = scene;

// SVG 章节场景
const svgScenes = {
  ch01: new SvgCh01(svgRoot),
  ch02: new SvgCh02(svgRoot),
  ch03: new SvgCh03(svgRoot),
  ch04: new SvgCh04(svgRoot),
  ch05: new SvgCh05(svgRoot),
  ch06: new SvgCh06(svgRoot),
  ch07: new SvgCh07(svgRoot),
  ch08: new SvgCh08(svgRoot),
};
const transitions = new Transitions(svgRoot);

// DOM 层
const beats = new Beats(domOverlay);
const labs = new Labs(beats);

// ---------- 滚动空间 ----------
function setScrollSpace() {
  const totalVh = LAYOUT.reduce((s, x) => s + x.vh, 0);
  document.getElementById('scroll-space').style.height = totalVh + 'vh';
}
setScrollSpace();

// ---------- 章节导航 ----------
const navRoot = document.getElementById('chapter-nav');
const navButtons = [];
for (const ch of CHAPTERS) {
  const btn = h('button', {
    class: 'nav-item', type: 'button',
    'data-ch': ch.id,
    title: `跳转到第 ${ch.num} 章 · ${ch.title}`,
    onclick: () => scrollToChapter(ch.id),
  }, [
    h('span', { class: 'nav-dot' }),
    h('span', { class: 'nav-meta' }, [
      h('span', { class: 'nav-num', text: ch.num + ' · ' + ch.sub }),
      h('span', { class: 'nav-title', text: ch.title }),
    ]),
  ]);
  navRoot.appendChild(btn);
  navButtons.push({ btn, id: ch.id });
}

function scrollToChapter(id) {
  const ranges = chapterRanges();
  const r = ranges.find(x => x.id === id);
  if (!r) return;
  const y = progressToScrollY(r.start + 0.002);
  window.scrollTo({ top: y, behavior: 'auto' });
}

// ---------- 精度选择器 ----------
const precRoot = document.getElementById('precision-widget');
const precButtons = [];
for (const p of PRECISIONS) {
  const btn = h('button', {
    class: 'p-btn', type: 'button', role: 'radio',
    'data-p': p.id, text: p.label,
    style: `--pc:${p.color}`,
    'aria-checked': String(store.precision === p.id),
    'aria-label': `${p.label} · ${p.desc}`,
    onclick: () => store.setPrecision(p.id),
  });
  precRoot.appendChild(btn);
  precButtons.push(btn);
}
function syncPrecisionUI() {
  for (const b of precButtons) {
    b.setAttribute('aria-checked', String(b.getAttribute('data-p') === store.precision));
  }
  const pr = precisionById(store.precision);
  document.documentElement.style.setProperty('--precision', pr.color);
  const readout = document.getElementById('precision-readout');
  if (readout) {
    const peaks = { FP4: '20|10', FP8: '10|5', FP16: '5|2.5', BF16: '5|2.5', TF32: '2.5|1.25', FP64: '40' }[store.precision] || '—';
    readout.textContent = `${store.precision} · ${peaks} PFLOPS`;
    if (store.precision === 'FP64') readout.textContent = `FP64 · 64bit · 40 TFLOPS`;
  }
}
store.on((type) => {
  if (type === 'precision') {
    syncPrecisionUI();
    labs.syncMatrixLab?.();
  }
});
syncPrecisionUI();

// ---------- 帮助 ----------
const helpPanel = document.getElementById('help-panel');
document.getElementById('btn-help').addEventListener('click', () => {
  helpPanel.hidden = !helpPanel.hidden;
});
document.getElementById('btn-close-help').addEventListener('click', () => {
  helpPanel.hidden = true;
});
document.getElementById('btn-reset').addEventListener('click', () => {
  scene.resetOrbit();
  toast('视角与临时状态已复位');
});

// ---------- Toast ----------
const toastNode = h('div', { id: 'toast' });
document.body.appendChild(toastNode);
let toastTimer = 0;
function toast(msg) {
  toastNode.textContent = msg;
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2200);
}

// ---------- 交互：拖动旋转 / 拾取 ----------
let dragging = false;
let lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX; lastY = e.clientY;
  scene.orbitDelta(-dx * 0.005, -dy * 0.005);
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  // 点击（位移很小）→ 拾取
  const hit = scene.pick((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  if (hit) {
    if (hit.product) {
      store.set('selectedProduct', hit.product === store.selectedProduct ? null : hit.product, 'product');
    } else if (hit.partId) {
      store.set('selectedPart', hit.partId === store.selectedPart ? null : hit.partId, 'select');
      if (hit.zoneId) store.set('selectedZone', hit.zoneId, 'zone');
    }
  }
});
canvas.addEventListener('wheel', (e) => {
  // Shift + 滚轮 = 缩放（与页面滚动边界清楚）
  if (e.shiftKey) {
    e.preventDefault();
    scene.zoomDelta(-e.deltaY * 0.0012);
  }
}, { passive: false });

// ---------- 键盘 ----------
window.addEventListener('keydown', (e) => {
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const k = e.key;
  if (k === 'h' || k === 'H') {
    helpPanel.hidden = !helpPanel.hidden;
  } else if (k === 'r' || k === 'R') {
    scene.resetOrbit();
    toast('已复位视角');
  } else if (k === 'ArrowRight') {
    const cur = progressToChapter(scrollProgress());
    const idx = CHAPTERS.findIndex(c => c.id === cur);
    scrollToChapter(CHAPTERS[Math.min(CHAPTERS.length - 1, idx + 1)].id);
  } else if (k === 'ArrowLeft') {
    const cur = progressToChapter(scrollProgress());
    const idx = CHAPTERS.findIndex(c => c.id === cur);
    scrollToChapter(CHAPTERS[Math.max(0, idx - 1)].id);
  } else if (k >= '1' && k <= '6') {
    store.setPrecision(PRECISIONS[+k - 1].id);
    toast('精度 → ' + PRECISIONS[+k - 1].id);
  } else if (k === '0') {
    window.scrollTo({ top: 0, behavior: 'auto' });
  } else if (k === '$' || (k === '4' && e.shiftKey)) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
  } else if (k === 'Escape') {
    helpPanel.hidden = true;
    store.set('selectedPart', null, 'select');
    store.set('selectedZone', null, 'zone');
  }
});

// ---------- 布局 ----------
function layoutAll() {
  const W = window.innerWidth, H = window.innerHeight;
  svgRoot.setAttribute('viewBox', `0 0 ${W} ${H}`);
  for (const k in svgScenes) svgScenes[k].layout(W, H);
  transitions.layout(W, H);
}
layoutAll();
window.addEventListener('resize', () => {
  layoutAll();
  setScrollSpace();
});

// ---------- 渲染帧 ----------
let smoothed = 0;
let exportMode = false;
let frozenTime = 0;

function renderAt(progress, time) {
  const p = progress;

  // 三维
  scene.update(p, time);
  // SVG 章节（用「在场包络」保证转场重叠）
  svgScenes.ch01.update(p, time);
  svgScenes.ch02.update(p, time);
  svgScenes.ch03.update(p, time);
  svgScenes.ch04.update(p, time);
  svgScenes.ch05.update(p, time);
  svgScenes.ch06.update(p, time);
  svgScenes.ch07.update(p, time);
  svgScenes.ch08.update(p, time);
  // 转场图形
  transitions.update(p, time);
  // DOM
  beats.update(p, time);
  labs.update(p, time);

  // SVG 章节可见性包络（在 update 之后叠加，保证转场重叠）
  const env = {
    ch01: envOf('ch01', p), ch02: envOf('ch02', p), ch03: envOf('ch03', p), ch04: envOf('ch04', p),
    ch05: envOf('ch05', p), ch06: envOf('ch06', p), ch07: envOf('ch07', p), ch08: envOf('ch08', p),
  };
  for (const k in env) {
    svgScenes[k].g.setAttribute('opacity', env[k].toFixed(3));
  }

  // 渲染三维
  pipeline.render(time);

  // 进度读数
  const num = document.getElementById('progress-num');
  if (num) num.textContent = Math.round(p * 100);
  const cur = progressToChapter(p);
  for (const nb of navButtons) nb.btn.classList.toggle('active', nb.id === cur);
}

function envOf(id, p) {
  // 在「上一段转场」中淡入，章节段内保持 1，章节末尾快速淡出
  const idx = LAYOUT.findIndex(s => s.id === id);
  if (idx < 0) return 0;
  const seg = LAYOUT[idx];
  const prev = LAYOUT[idx - 1];
  const leadStart = prev && prev.kind === 'transition' ? prev.start : seg.start;
  const end = seg.end;
  if (p < leadStart || p > end) return 0;
  if (p < seg.start) {
    // 前一转场内淡入 —— 保证下一章主体在上一章离开前进入
    return smooth(clamp01((p - leadStart) / ((seg.start - leadStart) * 0.55)));
  }
  const span = seg.end - seg.start;
  return 1 - smooth(clamp01((p - (end - span * 0.12)) / (span * 0.12)));
}

function tick() {
  requestAnimationFrame(tick);
  if (exportMode) {
    // 导出模式：仅在状态变化后重渲染（不推进动画时钟）
    if (needsRender) {
      needsRender = false;
      try { renderAt(smoothed, frozenTime); } catch (e) { console.error('[B200 render err]', e); }
    }
    return;
  }
  const target = scrollProgress();
  smoothed += (target - smoothed) * 0.12;
  if (Math.abs(target - smoothed) < 0.0004) smoothed = target;
  frozenTime = performance.now() / 1000;
  try {
    renderAt(smoothed, frozenTime);
  } catch (err) {
    if (!window.__errLogged) {
      window.__errLogged = true;
      console.error('[B200 render err]', err && err.stack || err, 'p=', smoothed, 't=', frozenTime);
    }
  }
}

let needsRender = false;
store.on(() => { needsRender = true; });
requestAnimationFrame(tick);

// ---------- 导出接口 ----------
installVideoExport({
  setExportMode(v) {
    exportMode = v;
    window.__exportMode = v;
    pipeline.instant = v;
    document.body.classList.toggle('exporting', v);
  },
  renderAt(p, t) {
    smoothed = p;
    renderAt(p, t);
  },
  resetInteractions() {
    scene.resetOrbit();
  },
});

// ---------- 开场提示 ----------
setTimeout(() => {
  if (!window.__exportMode) toast('滚动开始拆解 · 拖动旋转视角 · Shift+滚轮缩放');
}, 1200);

console.log('[B200 art] ready. videoExport:', typeof window.videoExport,
  'scrollH=', document.documentElement.scrollHeight,
  'innerH=', window.innerHeight,
  'p0=', scrollProgress());

console.log('[B200 art] ready. videoExport:', window.videoExport);
