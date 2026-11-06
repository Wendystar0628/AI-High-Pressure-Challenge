// 类别跳转条 (categories.md 版式 / 交互): one cut-corner chip per category,
// name and weight, under its group name. Sticks with the toolbar. Clicking
// scrolls to the board and sets #<key>; while scrolling, the board in view is
// the current item (wash, a violet bar under it that slides, aria-current).
// Names fall back to short names, and icons drop, when the bar is narrow.
//
//   const jump = createJumpBar(data, { onGo: (key) => … });
//   jump.el; jump.setCurrent(key, { slide }); jump.fit()
import { h, t, pick, fmtPct, categoryIcon } from '../../core/index.js';

const MODES = ['m-full-icons', 'm-full', 'm-short-icons', 'm-short', 'm-short m-tight'];

export function createJumpBar(data, { onGo }) {
  const nav = h('nav.cat-jump', { 'aria-label': t('categories.jump.label') });
  const ink = h('span.cat-jump-ink', { 'aria-hidden': 'true' });
  const items = new Map();

  // groups in data order (standard first, then design)
  const groups = [];
  for (const c of data.categories) {
    if (!groups.length || groups[groups.length - 1].kind !== c.kind) groups.push({ kind: c.kind, cats: [] });
    groups[groups.length - 1].cats.push(c);
  }
  for (const g of groups) {
    const w = g.cats.reduce((a, c) => a + c.weight, 0);
    const wrap = h(
      'div.cat-jump-group',
      h(
        'span.cat-jump-label',
        h('span.cat-jump-lfull', t('categories.jump.group', { name: t(`common.kind.${g.kind}`), w: fmtPct(w) })),
        h('span.cat-jump-ltight', t('categories.jump.group', { name: t(`common.kind.${g.kind}Short`), w: fmtPct(w) })),
      ),
    );
    for (const c of g.cats) {
      const a = h(
        'a.st-chip.cat-jump-item',
        { href: `#${c.key}`, dataset: { key: c.key }, title: `${pick(c, 'name')} ${fmtPct(c.weight)}` },
        categoryIcon(c.icon ?? c.key),
        h('span.cat-jump-full', pick(c, 'name')),
        h('span.cat-jump-short', pick(c, 'short') || pick(c, 'name')),
        h('span.n', fmtPct(c.weight)),
      );
      a.addEventListener('click', (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onGo?.(c.key);
      });
      items.set(c.key, a);
      wrap.append(a);
    }
    nav.append(wrap);
  }
  nav.append(ink);

  let currentKey = null;

  function placeInk(slide) {
    const a = items.get(currentKey);
    if (!a) {
      ink.style.opacity = '0';
      return;
    }
    const nr = nav.getBoundingClientRect();
    const r = a.getBoundingClientRect();
    const cut = parseFloat(getComputedStyle(a).getPropertyValue('--st-cut')) || 7;
    if (!slide) ink.style.transition = 'none';
    ink.style.opacity = '1';
    ink.style.transform = `translate(${r.left - nr.left}px, ${r.bottom - nr.top - 3}px) scaleX(${Math.max(1, r.width - cut)})`;
    if (!slide) {
      void ink.offsetWidth;
      ink.style.transition = '';
    }
  }

  function setCurrent(key, { slide = true } = {}) {
    if (key === currentKey) return;
    const first = currentKey == null;
    currentKey = key;
    for (const [k, a] of items) {
      if (k === key) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    placeInk(slide && !first);
  }

  // the widest look that fits on one line
  const ALL = [...new Set(MODES.flatMap((m) => m.split(' ')))];
  function fit() {
    nav.classList.remove('m-wrap');
    for (const m of MODES) {
      nav.classList.remove(...ALL);
      nav.classList.add(...m.split(' '));
      if (nav.scrollWidth <= nav.clientWidth + 1) {
        placeInk(false);
        return;
      }
    }
    nav.classList.add('m-wrap');
    placeInk(false);
  }

  new ResizeObserver(() => fit()).observe(nav);
  document.fonts?.ready.then(fit);

  return { el: nav, setCurrent, fit, get current() { return currentKey; } };
}
