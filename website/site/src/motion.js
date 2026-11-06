// Motion tiers, curves and staggers for the whole site (website/docs/motion.md).
// Values come from the skill's tokens.json; what the skill has no token for
// (dial stars settling, the constellation, timing bars) is set here by tier.
//
//   import { dur, ease, css, STAGGER, DIM, reduced, flip, onEnterView } from '../../motion.js';
//   d3.select(el).transition().duration(dur('come')).ease(ease.snap)
//   el.animate(frames, { duration: dur('wipe'), easing: css.mech })
import tokens from './vendor/stellar/tokens.json';

const M = tokens.motion;
const CURVES = { snap: M.snap.$value ?? M.snap, mech: M.mech.$value ?? M.mech, ease: M.ease.$value ?? M.ease };
const mq = matchMedia('(prefers-reduced-motion: reduce)');

/** The system asks for less motion: everything goes straight to its end state. */
export const reduced = () => mq.matches;
/** <html data-st-motion="calm">: no page entrances; responses stay. */
export const calm = () => document.documentElement.dataset.stMotion === 'calm';

/** Raw durations in ms from tokens.json (press, row, figFill, wipe, … ticker). */
export const DURATION = { ...M.duration };

/** Site additions, by tier (motion.md 第二节 / 五节). */
export const EXTRA = {
  starSettle: 360, // 星位就位 (mid)
  constellationOpen: 420, // 星座连线 on open (long)
  constellationSwitch: 360, // 星座连线 on a model switch (mid)
  morph: 360, // 柱形变形, 视图形变 one stage (mid)
  reorder: 360, // 行重排 (mid)
  tip: 160, // 浮签 (short)
  highlight: 160, // 联动高亮 (short)
  timerMax: 900, // 计时条走满, the longest bar (long, inside sequenceMax)
  expand: 360, // 展开 (mid); collapse is 2/3 of it
};

/**
 * A duration in ms by token name or number; 0 when motion is reduced.
 * dur('come') -> 320, dur('starSettle') -> 360, dur(250) -> 250
 */
export function dur(name) {
  if (mq.matches) return 0;
  if (typeof name === 'number') return name;
  const v = DURATION[name] ?? EXTRA[name];
  if (typeof v === 'number') return v;
  if (name === 'themeReveal') return DURATION.themeReveal.max;
  throw new Error(`unknown duration: ${name}`);
}

/** An entrance duration: 0 under reduced motion and under the calm variant. */
export const durIn = (name) => (calm() ? 0 : dur(name));

/** Exit = about 2/3 of the entrance (mech). */
export const durOut = (name) => Math.round(dur(name) * 0.66);

/** Curves as CSS strings. */
export const css = {
  snap: `cubic-bezier(${CURVES.snap.join(', ')})`,
  mech: `cubic-bezier(${CURVES.mech.join(', ')})`,
  ease: `cubic-bezier(${CURVES.ease.join(', ')})`,
  linear: 'linear',
};

// cubic-bezier(x1, y1, x2, y2) as a function t -> eased t (for D3 transitions)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      if (sx(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** Curves as functions, for d3 transition.ease(). */
export const ease = {
  snap: bezier(...CURVES.snap),
  mech: bezier(...CURVES.mech),
  ease: bezier(...CURVES.ease),
  linear: (t) => t,
};

/** Stagger steps in ms: row 38, segment 45, block 100. */
export const STAGGER = { row: M.stagger.row, segment: M.stagger.segment, block: M.stagger.block };
export const SEQUENCE_MAX = M.sequenceMax;

/**
 * The gap between items of a group: the token step, shrunk so that `count`
 * items spread over at most `maxSpread` ms (default: the readout spread, 180).
 */
export function stagger(kind, count, maxSpread = M.stagger.readoutsMaxSpread) {
  if (mq.matches) return 0;
  const step = STAGGER[kind] ?? kind;
  return count > 1 ? Math.min(step, maxSpread / (count - 1)) : 0;
}

/** Opacity of everything that is not the focus of a linked highlight (联动高亮 退淡). */
export const DIM = 0.28;

/** Tiers (motion.md 第二节). */
export const TIER = {
  short: ['press', 'row', 'figFill', 'tip', 'highlight'],
  mid: ['wipe', 'edge', 'lock', 'come', 'scramble', 'shutter', 'assemble', 'tab', 'drawerIn', 'starSettle', 'morph', 'reorder', 'expand'],
  long: ['stroke', 'fill', 'power', 'sweep', 'scrambleLoad', 'drive', 'constellationOpen', 'timerMax'],
};

/** element.animate() that respects reduced motion (resolves at once then). */
export function play(el, frames, { duration = 'come', easing = 'snap', delay = 0, fill = 'both' } = {}) {
  const d = typeof duration === 'number' ? (mq.matches ? 0 : duration) : dur(duration);
  if (!d || !el.animate) return Promise.resolve();
  const a = el.animate(frames, { duration: d, easing: css[easing] ?? easing, delay, fill });
  return a.finished.catch(() => {});
}

/**
 * FLIP: record positions, run mutate(), then slide each element from its old
 * place to the new one (transform only). Interruptible: a running FLIP
 * animation on an element is cancelled and restarted from where it is.
 *   flip(rows, () => list.append(...sorted), { duration: 'reorder', delay: (el, i) => i * 20 })
 */
export function flip(elements, mutate, { duration = 'reorder', easing = 'mech', delay = 0 } = {}) {
  const els = [...elements];
  const first = new Map(els.map((el) => [el, el.getBoundingClientRect().top]));
  mutate();
  if (mq.matches) return Promise.resolve();
  const d = dur(duration);
  const runs = [];
  els.forEach((el, i) => {
    if (!el.isConnected) return;
    const dy = first.get(el) - el.getBoundingClientRect().top;
    if (!dy) return;
    el.getAnimations?.().forEach((a) => a.id === 'flip' && a.cancel());
    const a = el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
      duration: d,
      easing: css[easing] ?? easing,
      delay: typeof delay === 'function' ? delay(el, i) : delay,
      fill: 'backwards',
    });
    a.id = 'flip';
    runs.push(a.finished.catch(() => {}));
  });
  return Promise.all(runs);
}

/** Is any part of the element inside the viewport now? */
export function isInView(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}

/**
 * Run fn once when the element first enters the viewport (for charts below the
 * first screen: they draw when scrolled to). Returns a cancel function.
 */
export function onEnterView(el, fn, { threshold = 0.15 } = {}) {
  if (isInView(el)) {
    fn();
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { threshold },
  );
  io.observe(el);
  return () => io.disconnect();
}

// ---------- 名字接力 (motion.md 全站「换页」、五节「名字接力」) ----------
// 点类别名、题名、模型名或星换页时，被点的名字作为共享元素滑到新页的标题位置，
// 其余部分照常快门（技能的 @view-transition）。全站一个约定：
//   · 共享元素的 view-transition-name 只用 RELAY（'name-relay'），同一时刻全站只有一个元素带它；
//   · 旧页：点击（左键、无修饰键、去站内另一页）的那一刻把名字给被点的名字元素，并在
//     sessionStorage 'octa.relay' 记下目标路径；pageswap 时发现没去那一页、或从后退缓存回来，就收回；
//   · 新页：标题元素在模板里写 data-relay-target（首帧就得在，JS 后画的标题接不上）；
//     head 预载脚本（shell/markup.js）在 pagereveal 时核对路径，是本页就给它名字，过渡结束收回。
// 页面怎么接：链接里的名字元素加 data-relay-name（或链接本身加 data-relay），或调
// relayName(link, nameEl)；SVG 里的名字（星盘扇区、星）用 relayGhost(fromEl, text, href)。
// 时长曲线：中档 shutter、mech（styles/shell.css ::view-transition-group(name-relay)）。

/** The one shared-element name of the site. */
export const RELAY = 'name-relay';
const RELAY_KEY = 'octa.relay';
const relaySources = new WeakMap();
let relayEl = null;
let relayGhostEl = null;
const relaySupported = () => typeof window.PageRevealEvent === 'function' || 'onpagereveal' in window;

function clearRelay() {
  if (relayEl) relayEl.style.viewTransitionName = '';
  relayEl = null;
  relayGhostEl?.remove();
  relayGhostEl = null;
}

/** Give `nameEl` the shared name for the page change to `href` (other-page links inside the site only). */
export function relayTo(href, nameEl) {
  clearRelay();
  if (!nameEl || !href || mq.matches || !relaySupported()) return;
  let url;
  try {
    url = new URL(href, location.href);
  } catch {
    return;
  }
  if (url.origin !== location.origin || url.pathname === location.pathname) return;
  nameEl.style.viewTransitionName = RELAY;
  relayEl = nameEl;
  try {
    sessionStorage.setItem(RELAY_KEY, url.pathname);
  } catch {}
}

/**
 * Mark a link: when it is followed, `nameEl` (default the link; or a function
 * returning the element at click time) slides to the next page's title.
 */
export function relayName(link, nameEl = link) {
  relaySources.set(link, nameEl);
  return link;
}

/**
 * 名字接力 from inside an SVG (SVG parts cannot carry a view-transition-name):
 * an HTML stand-in with the same text is laid exactly over `fromEl` and relayed instead.
 * `className` styles the stand-in (e.g. 'is-tag': the dial's flare tag).
 */
export function relayGhost(fromEl, text, href, className = '') {
  const r = fromEl?.getBoundingClientRect();
  if (!r?.width || !text) return;
  const ghost = document.createElement('span');
  ghost.className = `site-relay ${className}`.trim();
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = text;
  Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, fontSize: `${Math.max(9, r.height * 0.52)}px` });
  document.body.append(ghost);
  relayTo(href, ghost);
  if (relayEl === ghost) relayGhostEl = ghost;
  else ghost.remove();
}

// one listener for the whole site: links that carry a name
document.addEventListener(
  'click',
  (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const src = relaySources.get(a);
    const nameEl = (typeof src === 'function' ? src() : src) ?? a.querySelector('[data-relay-name]') ?? (a.hasAttribute('data-relay') ? a : null);
    if (nameEl) relayTo(a.getAttribute('href'), nameEl);
  },
  true,
);
// the page is leaving, but not for the page the name was meant for: no shared element
addEventListener('pageswap', (e) => {
  if (!relayEl) return;
  let want = null;
  try {
    want = sessionStorage.getItem(RELAY_KEY);
  } catch {}
  const to = e.activation?.entry?.url;
  if (!e.viewTransition || !to || new URL(to).pathname !== want) clearRelay();
});
// back from the next page (back/forward cache): the old name must not linger
addEventListener('pageshow', (e) => {
  if (e.persisted) clearRelay();
});
