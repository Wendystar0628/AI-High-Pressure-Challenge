// Figure toolkit for the reading pages (about.md「图示」): every figure is an
// inline SVG drawn with D3 on a fixed 720-wide viewBox that scales with the
// sheet; colours are CSS variables only (figs.css), so both themes follow.
// Above: "// FIG.01 name"; below: a readout line that shows the pointed-at
// (or focused) element's values. Drawn once when first scrolled into view.
import * as d3 from '../../charts/d3.js';
import { starPath } from '../../charts/star.js';
import { h, t, iconURL, inlineSVG } from '../../core/index.js';

import { scramble } from '../../vendor/stellar/fx.js';
import { dur, durIn, css, stagger, onEnterView } from '../../motion.js';

export { d3 };
export const W = 720;

/** Fixed figure numbers: the order of the about page (task pages reuse them). */
export const ORDER = ['hero', 'howto', 'weights', 'reason', 'algo', 'battle', 'spatial', 'drawing', 'interact', 'game', 'physics', 'visual', 'system', 'timeline', 'isolation', 'schedule', 'rules', 'pipeline', 'types', 'designscore'];
export const figNo = (key) => `FIG.${String(ORDER.indexOf(key) + 1).padStart(2, '0')}`;

let seq = 0;

/**
 * createFigure({ key, title, sketch, label, readout: [default parts] })
 * -> fig { el, svg (d3), g (d3 root group), uid, hatch, read(parts|null), setDefault(parts),
 *          mark(selection, parts|fn, { onHot }), size(height), arm() }
 */
export function createFigure({ key, title, sketch = false, label, readout = [] }) {
  const uid = `rdf${++seq}`;
  const ro = h('ul.st-facts.st-field.rd-readout', { 'aria-live': 'polite' });
  const body = h('div.rd-fig-body');
  const el = h(
    'figure.rd-fig',
    { dataset: { fig: key } },
    h('figcaption.rd-fig-cap', h('span.st-eyebrow.slash.rd-fig-no', figNo(key)), h('span.rd-fig-title', title), sketch ? h('span.st-state.is-draft.rd-fig-sketch', t('about.fig.sketch')) : null),
    body,
    ro,
  );
  const svg = d3
    .select(body)
    .append('svg')
    .attr('class', 'rd-svg')
    .attr('viewBox', `0 0 ${W} 100`)
    .attr('role', 'group')
    .attr('aria-label', label || title);
  const defs = svg.append('defs');
  defs
    .append('pattern')
    .attr('id', `${uid}-hatch`)
    .attr('width', 6)
    .attr('height', 6)
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('patternTransform', 'rotate(45)')
    .append('rect')
    .attr('class', 'f-hatch-line')
    .attr('width', 1.6)
    .attr('height', 6);
  const g = svg.append('g');

  let shown = null;
  const fig = {
    key,
    el,
    svg,
    defs,
    g,
    uid,
    hatch: `url(#${uid}-hatch)`,
    defaultParts: readout,
    read(parts) {
      ro.classList.toggle('is-hot', parts != null);
      const p = (parts ?? fig.defaultParts ?? []).flatMap((x) => String(x ?? '').split(' │ ')).filter((x) => x !== '');
      const sig = p.join('\u0001');
      if (sig === shown) return;
      const first = shown == null;
      shown = sig;
      ro.replaceChildren(...p.map((x) => h('li', x)));
      if (!first) for (const li of ro.children) scramble(li, dur('scramble'));
    },
    setDefault(parts) {
      fig.defaultParts = parts;
      fig.read(null);
    },
    /** Pointing at / focusing an element shows its values in the readout. */
    mark(sel, parts, { onHot, label: lab } = {}) {
      sel.each(function (d, i) {
        const node = this;
        const get = () => (typeof parts === 'function' ? parts(d, i, node) : parts);
        if (node.tagName.toLowerCase() !== 'a') {
          node.setAttribute('tabindex', '0');
          node.setAttribute('role', 'img');
        }
        node.classList.add('f-mark');
        const aria = typeof lab === 'function' ? lab(d, i) : lab;
        node.setAttribute('aria-label', aria || get().join('，'));
        const on = () => {
          node.classList.add('is-hot');
          fig.read(get());
          onHot?.(d, true, node);
        };
        const off = () => {
          node.classList.remove('is-hot');
          fig.read(null);
          onHot?.(d, false, node);
        };
        node.addEventListener('pointerenter', on);
        node.addEventListener('focus', on);
        node.addEventListener('pointerleave', off);
        node.addEventListener('blur', off);
      });
      return sel;
    },
    size(height) {
      svg.attr('viewBox', `0 0 ${W} ${Math.ceil(height)}`);
    },
    /** Draw once on first entering the view: lines trace in, cells light up in order. */
    arm() {
      if (fig._armed) return;
      fig._armed = true;
      if (!durIn('power')) return;
      const root = svg.node();
      root.classList.add('is-waiting');
      onEnterView(el, () => {
        root.classList.remove('is-waiting');
        entrance(root);
      });
    },
  };
  fig.read(null);
  return fig;
}

function entrance(root) {
  const lines = [...root.querySelectorAll('[data-fx="line"]')];
  const cells = [...root.querySelectorAll('[data-fx="cell"]')];
  const lineDur = dur('power');
  lines.forEach((el, i) => {
    el.animate([{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], {
      duration: lineDur,
      easing: css.mech,
      delay: Math.min(i * 24, 240),
      fill: 'backwards',
    });
  });
  const gap = stagger('segment', cells.length, 420);
  cells.forEach((el, i) => {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur('come'), easing: css.snap, delay: 100 + i * gap, fill: 'backwards' });
  });
}

// ---------- drawing helpers ----------

/** text(g, x, y, '…', 'tb t2', 'end') */
export function text(g, x, y, s, cls = '', anchor = null) {
  const el = g.append('text').attr('x', x).attr('y', y).text(s);
  if (cls) el.attr('class', cls);
  if (anchor) el.attr('text-anchor', anchor);
  return el;
}

/** Multi-line text: lines(g, x, y, ['a', 'b'], 19, 't2') */
export function lines(g, x, y, arr, lh = 19, cls = '', anchor = null) {
  const el = g.append('text').attr('x', x).attr('y', y);
  if (cls) el.attr('class', cls);
  if (anchor) el.attr('text-anchor', anchor);
  arr.forEach((s, i) =>
    el
      .append('tspan')
      .attr('x', x)
      .attr('dy', i ? lh : 0)
      .text(s),
  );
  return el;
}

/** A line; traced in on entrance unless fx is false (dashed lines must not trace). */
export function line(g, x1, y1, x2, y2, cls = 'l-ink', fx = true) {
  const el = g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('class', cls);
  if (fx) el.attr('pathLength', 1).attr('data-fx', 'line');
  return el;
}

export function path(g, d, cls = 'l-ink', fx = true) {
  const el = g.append('path').attr('d', d).attr('class', cls);
  if (fx) el.attr('pathLength', 1).attr('data-fx', 'line');
  return el;
}

/** A rectangle; lights up on entrance when fx. */
export function rect(g, x, y, w, hgt, cls = '', fx = false) {
  const el = g
    .append('rect')
    .attr('x', x)
    .attr('y', y)
    .attr('width', Math.max(0, w))
    .attr('height', Math.max(0, hgt));
  if (cls) el.attr('class', cls);
  if (fx) el.attr('data-fx', 'cell');
  return el;
}

/** The four-point star (the only star shape). */
export function star(g, x, y, r, cls = 'f-ink') {
  return g.append('path').attr('d', starPath(x, y, r, 0.4)).attr('class', cls);
}

/** A small square marker (standard tasks) or a star (design tasks). */
export function kindMark(g, kind, x, y, size = 11) {
  if (kind === 'design') return star(g, x + size / 2, y, size / 2 + 1, 'f-orbit');
  return rect(g, x, y - size / 2, size, size, 'f-std');
}

/** A category icon inlined into the SVG (monochrome, follows the ink colour). */
export function icon(g, key, x, y, size = 16) {
  const holder = g.append('g').attr('class', 'f-icon');
  inlineSVG(holder.node(), iconURL.category(key), { x, y, size }).catch(() => {});
  return holder;
}

/** "a ↔ b" bracket under (dir 1) or over (dir -1) a span. */
export function bracket(g, x0, x1, y, dir = 1, cls = 'l-ink2', tick = 7) {
  return path(g, `M${x0} ${y - dir * tick}V${y}H${x1}V${y - dir * tick}`, cls);
}

// ---------- text measuring and wrapping ----------

let ctx2d = null;
let family = null;
function fontOf(size, weight) {
  if (!family) family = getComputedStyle(document.documentElement).getPropertyValue('--st-font-ui').trim() || 'sans-serif';
  return `${weight} ${size}px ${family}`;
}

/** Width of a string in the figure font. */
export function measure(s, size = 13, weight = 400) {
  if (!ctx2d) ctx2d = document.createElement('canvas').getContext('2d');
  ctx2d.font = fontOf(size, weight);
  return ctx2d.measureText(String(s)).width;
}

const TOKEN = /[⺀-鿿　-〿＀-￯]|[^\s⺀-鿿　-〿＀-￯]+|\s+/g;
const NO_START = /^[，。、；：！？）》」』,.;:!?)\]%]/;

/** Wrap a string into lines that fit `width` (CJK by character, Latin by word; \n breaks). */
export function wrap(s, width, size = 13, weight = 400) {
  const out = [];
  for (const para of String(s ?? '').split('\n')) {
    const toks = para.match(TOKEN) ?? [''];
    let cur = '';
    for (const tk of toks) {
      const next = cur + tk;
      if (cur && measure(next.trimEnd(), size, weight) > width && !NO_START.test(tk)) {
        out.push(cur.trimEnd());
        cur = tk.trimStart();
      } else cur = next;
    }
    out.push(cur.trimEnd());
  }
  return out;
}

/** Wrapped multi-line text; returns the number of lines. */
export function wrapText(g, x, y, s, width, { lh = 19, cls = '', size = 13, weight = 400, anchor = null } = {}) {
  const arr = wrap(s, width, size, weight);
  lines(g, x, y, arr, lh, cls, anchor);
  return arr.length;
}

/** "// EYEBROW" in the figure: violet slashes, wide caps in secondary ink. */
export function eyebrow(g, x, y, s) {
  const el = g.append('text').attr('x', x).attr('y', y).attr('class', 'teb');
  el.append('tspan').attr('class', 'tsl').text('// ');
  el.append('tspan').text(s);
  return el;
}

/** Shades of the violet family, deep to light (分值条: 各段紫族由深到浅). */
export function violetShade(i, n) {
  const p = n <= 1 ? 100 : Math.round(100 * (1 - i / (n - 1)));
  return `color-mix(in srgb, var(--v-800) ${p}%, var(--v-300))`;
}

/** Format a percentage weight: 7.5 -> "7.5%". */
export const pct = (v) => `${+(+v).toFixed(2)}%`;

/** Width of an eyebrow ("// TEXT": wide caps, 0.14em tracking) at 13px. */
export const ebW = (s) => measure(`// ${String(s).toUpperCase()}`, 13, 600) * 1.25 + (String(s).length + 3) * 13 * 0.14;

/** Cut a string to fit `width` with an ellipsis. */
export function ellipsis(s, width, size = 13, weight = 400) {
  const str = String(s);
  if (measure(str, size, weight) <= width) return str;
  let out = str;
  while (out.length > 1 && measure(`${out}…`, size, weight) > width) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}
