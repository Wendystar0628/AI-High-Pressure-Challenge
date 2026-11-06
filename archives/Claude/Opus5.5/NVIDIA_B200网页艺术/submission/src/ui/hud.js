// 常驻界面：章节导航（接缝线）、全页精度、比例尺、提示与自定义光标。
import { CHAPTERS, at, chapterAt, TOTAL_LEN } from '../core/timeline.js';
import { state, patch } from '../core/state.js';
import { FORMAT_ORDER, FORMATS } from '../core/numerics.js';
import { S, A, H, setText, vis } from './svg.js';
import { clamp, lerp, sstep, iv, pulse } from '../core/util.js';

export function createHud(ctx) {
  const root = document.getElementById('hud');
  const svg = document.getElementById('hudsvg');

  // ---- 章节导航 ----
  const nav = H('nav', 'nav', root, null, { 'aria-label': '章节导航' });
  const thread = H('div', 'nav-thread', nav);
  const fill = H('div', 'nav-fill', thread);
  const items = CHAPTERS.map((c, i) => {
    const b = H('button', 'nav-item', nav, `<span class="nav-no">${c.no}</span><span class="nav-name">${c.name}</span>`, { type: 'button', 'aria-label': `跳到第 ${c.no} 章 ${c.name}` });
    b.addEventListener('click', () => ctx.jump(i));
    b.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); items[Math.min(i + 1, 7)].focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); items[Math.max(i - 1, 0)].focus(); }
    });
    return b;
  });
  // 按章长度分布节点：导航本身也是一条进度线
  CHAPTERS.forEach((c, i) => { items[i].style.top = `${c.start * 100}%`; });

  const pct = H('div', 'nav-pct', root);

  // ---- 全页精度 ----
  const prec = H('div', 'prec', root, null, { role: 'radiogroup', 'aria-label': '全页精度' });
  H('div', 'prec-l', prec, '全页精度');
  const precBtns = {};
  const row = H('div', 'prec-row', prec);
  FORMAT_ORDER.forEach(id => {
    const b = H('button', 'prec-b', row, id, { type: 'button', role: 'radio', 'aria-checked': 'false', title: FORMATS[id].label });
    b.addEventListener('click', () => patch({ precision: id }));
    precBtns[id] = b;
  });
  const precNote = H('div', 'prec-n', prec);

  // ---- 比例尺 ----
  const scale = H('div', 'scale', root);
  const sbar = H('div', 'scale-bar', scale);
  const slab = H('div', 'scale-lab', scale);

  // ---- 声明与提示 ----
  H('div', 'legal', root, '本页为概念设计作品，非 NVIDIA 官方页面');
  const hint = H('div', 'hint', root);
  const chTag = H('div', 'chtag', root);

  // ---- 探索模式 ----
  const exploreBtn = H('button', 'explore-btn', root, '', { type: 'button', 'aria-pressed': 'false' });
  exploreBtn.addEventListener('click', () => patch({ explore: !state.explore }));

  // ---- 接缝线：贯穿全页的母题 ----
  const seam = S('line', { class: 'seam' }, svg);
  const seamG = S('line', { class: 'seam-glow' }, svg);

  // ---- 光标 ----
  const cur = H('div', 'cursor', root, '<i></i><i></i><span></span>');
  const curLab = cur.querySelector('span');
  let cx = -100, cy = -100;
  window.addEventListener('pointermove', e => { cx = e.clientX; cy = e.clientY; cur.style.transform = `translate(${cx}px,${cy}px)`; }, { passive: true });

  const nice = [1, 2, 5];
  function niceLen(mm) {
    const e = Math.floor(Math.log10(mm));
    const b = Math.pow(10, e);
    let v = b;
    for (const n of nice) if (n * b <= mm) v = n * b;
    return v;
  }
  function fmtLen(mm) {
    if (mm >= 1000) return (mm / 1000) + ' m';
    if (mm >= 1) return mm + ' mm';
    return Math.round(mm * 1000) + ' µm';
  }

  return {
    root,
    cursorLabel(t) { setText(curLab, t || ''); cur.classList.toggle('has', !!t); },
    setHint(t) { this._h = t; },
    update(f) {
      const nextHint = this._h || '';
      this._h = '';
      if (nextHint) setText(hint, nextHint);
      hint.classList.toggle('on', !!nextHint);
      const c = CHAPTERS[f.ci];
      fill.style.height = `${f.p * 100}%`;
      items.forEach((b, i) => {
        const cur = i === f.ci;
        if (b._cur !== cur) { b._cur = cur; b.classList.toggle('cur', cur); if (cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
      });
      setText(pct, (f.p * 100).toFixed(1).padStart(4, '0') + '%');
      for (const id of FORMAT_ORDER) {
        const on = state.precision === id;
        const b = precBtns[id];
        if (b._on !== on) { b._on = on; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }
      }
      setText(precNote, `${FORMATS[state.precision].label} · ${FORMATS[state.precision].effective} 位/值`);
      setText(chTag, `${c.no} — ${c.title}`);
      // 比例尺：真实的毫米每像素
      const showScale = f.viewMm > 0;
      vis(scale, showScale);
      if (showScale) {
        const mmPerD = f.viewMm / f.DH;
        const target = 150 * mmPerD;
        const len = niceLen(target);
        const px = len / mmPerD;
        sbar.style.width = `${(px / 16).toFixed(3)}rem`;
        setText(slab, fmtLen(len));
      }
      const exploreAvail = f.exploreAvail;
      vis(exploreBtn, exploreAvail);
      if (exploreAvail) {
        setText(exploreBtn, state.explore ? '探索中：滚轮缩放（Esc 退出）' : '进入探索（E）：滚轮改为缩放');
        exploreBtn.setAttribute('aria-pressed', state.explore ? 'true' : 'false');
        exploreBtn.classList.toggle('on', !!state.explore);
      }
      // 接缝线
      const sm = f.seam;
      svg.setAttribute('viewBox', `0 0 ${f.DW} ${f.DH}`);
      if (sm) {
        const op = sm.op ?? 1;
        A(seam, { x1: sm.x1, y1: sm.y1, x2: sm.x2, y2: sm.y2, opacity: .85 * op, stroke: sm.color || 'var(--hbi)' });
        A(seamG, { x1: sm.x1, y1: sm.y1, x2: sm.x2, y2: sm.y2, opacity: .28 * op * (sm.glow ?? 1), stroke: sm.color || 'var(--hbi)' });
      }
    },
  };
}
