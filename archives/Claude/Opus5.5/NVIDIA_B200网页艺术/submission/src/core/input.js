// 输入：模型拖动、数值编辑与页面滚动的边界在这里划清。
// - 普通状态：滚轮永远滚页面；在模型上拖动旋转；点击选择。
// - 探索模式（E）：滚轮改为缩放，页面不动；Esc 退出。
// - 输入框内：所有快捷键让路。
import * as THREE from 'three';
import { state, patch } from './state.js';
import { sim, orbitWeight } from './choreo.js';
import { CHAPTERS, chapterAt } from './timeline.js';
import { clamp, DEG } from './util.js';

export function createInput(ctx) {
  const canvas = document.getElementById('gl');
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let drag = null;

  const active = () => ctx.chapters[ctx.f.ci];
  const pickRay = (e) => {
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight * 2 - 1));
    ray.setFromCamera(ndc, ctx.engine.camera);
    return ray.ray;
  };

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('grabbing');
    ctx.cancelTween();
  });
  canvas.addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      if (orbitWeight(ctx.f) > .2) {
        const k = .0052 * (1080 / window.innerHeight);
        sim.az.to(sim.az.t - dx * k);
        sim.el.to(clamp(sim.el.t + dy * k, -1.9, 1.5));
      }
    } else {
      const c = active();
      if (c.hover) {
        const hit = c.hover(pickRay(e));
        canvas.classList.toggle('pickable', !!hit);
        ctx.hud.cursorLabel(hit || (orbitWeight(ctx.f) > .2 ? '拖动旋转' : ''));
      } else ctx.hud.cursorLabel(orbitWeight(ctx.f) > .2 ? '拖动旋转' : '');
    }
  });
  const endDrag = e => {
    if (!drag) return;
    const wasClick = drag.moved < 6;
    drag = null;
    canvas.classList.remove('grabbing');
    if (wasClick) {
      const c = active();
      if (c.pick) c.pick(pickRay(e), e);
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('grabbing'); });
  canvas.addEventListener('pointerleave', () => ctx.hud.cursorLabel(''));

  // 探索模式下滚轮缩放
  window.addEventListener('wheel', e => {
    if (state.explore && ctx.f.exploreAvail) {
      e.preventDefault();
      sim.zoom.to(clamp(sim.zoom.t + e.deltaY * .0011, -1.8, 1.6));
    }
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (ctx.exporting) return;
    const k = e.key;
    if (k === 'e' || k === 'E') {
      if (ctx.f.exploreAvail) patch({ explore: !state.explore });
      return;
    }
    if (k === 'Escape') {
      if (state.explore) { patch({ explore: false }); return; }
      active().esc?.();
      return;
    }
    if (k === ']' || k === '】') { ctx.jump(Math.min(ctx.f.ci + 1, 7)); return; }
    if (k === '[' || k === '【') { ctx.jump(Math.max(ctx.f.ci - 1, 0)); return; }
    if (e.target === canvas && orbitWeight(ctx.f) > .2) {
      const step = .09;
      if (k === 'ArrowLeft') { sim.az.to(sim.az.t - step); e.preventDefault(); }
      if (k === 'ArrowRight') { sim.az.to(sim.az.t + step); e.preventDefault(); }
      if (k === 'ArrowUp') { sim.el.to(clamp(sim.el.t + step, -1.9, 1.5)); e.preventDefault(); }
      if (k === 'ArrowDown') { sim.el.to(clamp(sim.el.t - step, -1.9, 1.5)); e.preventDefault(); }
      if (k === '+' || k === '=') sim.zoom.to(clamp(sim.zoom.t - .12, -1.8, 1.6));
      if (k === '-' || k === '_') sim.zoom.to(clamp(sim.zoom.t + .12, -1.8, 1.6));
      if (k === '0') { sim.az.to(0); sim.el.to(0); sim.zoom.to(0); }
    }
    active().key?.(e);
  });

  return { frame() {} };
}
