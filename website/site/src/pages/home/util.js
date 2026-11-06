// Small helpers shared by the home page sections.
import { h, svg, plural, iconURL } from '../../core/index.js';
import { starD } from '../../charts/index.js';

/**
 * Translate into nodes: placeholders may be filled with elements; `count`
 * picks the English plural form (core/i18n plural()).
 *   tn('home.hero.models', { n: h('b.num', '7') }, 7)
 */
export function tn(key, vars = {}, count) {
  const s = plural(key, count);
  const out = [];
  let last = 0;
  s.replace(/\{(\w+)\}/g, (m, k, at) => {
    if (at > last) out.push(s.slice(last, at));
    const v = vars[k];
    out.push(v instanceof Node ? v : v != null ? String(v) : m);
    last = at + m.length;
    return m;
  });
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** "60–100" or "60" */
export function minuteRange(data) {
  const m = data.tasks.map((x) => x.minutes).filter((x) => Number.isFinite(x));
  if (!m.length) return '';
  const lo = Math.min(...m);
  const hi = Math.max(...m);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

/** Eyebrow + title with the hairline to a star; an optional action sits at the line's end. */
export function sectionHead({ id, eyebrow, title, action }) {
  return h(
    'header.home-head',
    h('p.st-eyebrow.slash', eyebrow),
    h('div.home-head-line', h('h2.st-bar-title', { id }, title), action || null),
  );
}

/** A section of the page below the first screen. */
export function section(id, ...children) {
  return h('section.home-sec', { id, 'aria-labelledby': `${id}-title` }, h('div.home-col', ...children));
}

/** The constellation strip between sections (decor/constellation/constellation-strip, ink 2). */
export function divider() {
  return h('div.home-divider', { 'aria-hidden': 'true', style: { '--strip': `url("${iconURL.decor('constellation/constellation-strip')}")` } });
}

/** A four-point star as a tiny inline SVG (tip = centre-to-tip length in px). */
export function starIcon(tip, className = '') {
  const s = Math.ceil(tip * 2 + 2);
  const el = svg('svg', { class: `home-star ${className}`.trim(), viewBox: `${-s / 2} ${-s / 2} ${s} ${s}`, width: s, height: s, 'aria-hidden': 'true' });
  el.append(svg('path', { d: starD(tip, 0.36) }));
  return el;
}

/** Page model: the one model the dial, the top-5 rows and the score build-up show. Not in the address. */
export function createPageModel(initial) {
  let id = initial;
  const subs = new Set();
  return {
    get id() {
      return id;
    },
    set(next) {
      if (!next || next === id) return;
      id = next;
      subs.forEach((fn) => fn(id));
    },
    on(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
