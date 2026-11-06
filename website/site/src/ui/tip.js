// 浮签: the small ink tooltip for chart marks (leaderboard.md 交互). One
// shared element; shows on pointer and on keyboard focus.
//
//   import { attachTip, showTip, hideTip } from '../../ui/tip.js';
//   attachTip(rectOrRow, () => '数学推理 78.0 × 15% = 11.7');
import { h } from '../core/dom.js';

let el = null;

function ensure() {
  if (!el) {
    el = h('div.site-tip', { role: 'tooltip', id: 'site-tip' });
    document.body.append(el);
  }
  return el;
}

/** Show text (or a node) near a point (client coordinates) or above an element. */
export function showTip(content, at) {
  const tip = ensure();
  tip.replaceChildren(content instanceof Node ? content : String(content));
  let x;
  let y;
  if (at instanceof Element) {
    const r = at.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top;
  } else ({ x, y } = at);
  const w = tip.offsetWidth;
  const hgt = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x - w / 2))}px`;
  tip.style.top = `${Math.max(8, y - hgt - 10)}px`;
  tip.classList.add('is-on');
}

export function hideTip() {
  el?.classList.remove('is-on');
}

/** Wire an element: text() is called on pointer enter/move and focus. Returns an unwire function. */
export function attachTip(target, text) {
  const move = (e) => showTip(text(e), { x: e.clientX, y: e.clientY - 6 });
  const focus = () => showTip(text(), target);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerleave', hideTip);
  target.addEventListener('focus', focus);
  target.addEventListener('blur', hideTip);
  target.setAttribute('aria-describedby', 'site-tip');
  return () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerleave', hideTip);
    target.removeEventListener('focus', focus);
    target.removeEventListener('blur', hideTip);
  };
}
