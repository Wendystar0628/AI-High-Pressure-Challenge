// The reading-page frame shared by /about/, /tasks/ and the task pages:
// a sticky left column (contents + ledger) beside one white sheet, section
// titles, the contents' current-section bar, anchor landing, empty states.
//
//   const side = aside({ toc, ledger, extra });   // into [data-slot="aside"]
//   wireToc(side.nav);                             // after the page is rendered
//   wireAnchors(paper);                            // in-page links scroll and land
import { h, t, lang, categoryIcon, iconURL } from '../core/index.js';
import { dur, reduced, calm } from '../motion.js';

const shellH = () => document.querySelector('[data-shell="bar"]')?.getBoundingClientRect().height ?? 54;

/**
 * A section title: eyebrow over title (zh: English eyebrow over the Chinese title;
 * en: the eyebrow is a number or label, the title is the English name).
 */
export function pairTitle(tag, { id, eyebrow, title, cls, after }) {
  return h(
    `${tag}.rd-pair`,
    { id: id || null, class: cls || null },
    h('span.st-eyebrow.slash.rd-pair-eb', eyebrow),
    h('span.rd-pair-t', title),
    after || null,
  );
}

/**
 * The left column.
 * toc: [{ id, no, label, icon, children: [{ id, label, icon }] }]
 * ledger: [[label, value (string | node), { hi }]]
 */
export function aside({ tocLabel = t('about.aside.toc'), tocEyebrow = t('about.aside.tocEn'), toc = [], ledgerLabel = t('about.aside.ledger'), ledgerEyebrow = t('about.aside.ledgerEn'), ledger = [], extra = [] }) {
  const link = (it, sub) =>
    h(
      'a',
      { href: `#${it.id}`, class: sub ? 'rd-toc-sub' : null },
      it.no ? h('span.rd-toc-no.num', it.no) : null,
      it.icon ? categoryIcon(it.icon) : null,
      h('span.rd-toc-label', it.label),
    );
  const nav = h(
    'nav.rd-toc',
    { 'aria-label': tocLabel },
    h('span.rd-toc-bar', { 'aria-hidden': 'true' }),
    h(
      'ol.st-toc',
      toc.map((it) =>
        h('li', link(it), it.children?.length ? h('ol.rd-sub', { hidden: true }, it.children.map((c) => h('li', link(c, true)))) : null),
      ),
    ),
  );
  const el = h(
    'div.rd-aside-in',
    toc.length ? [h('p.rd-aside-h', h('span.st-eyebrow', tocEyebrow), h('b', tocLabel)), nav] : null,
    ledger.length
      ? [
          h('p.rd-aside-h', h('span.st-eyebrow', ledgerEyebrow), h('b', ledgerLabel)),
          h(
            'ul.st-ledger.rd-ledger',
            ledger.map(([k, v, o = {}]) =>
              h('li', { class: o.stack ? 'is-stack' : null }, h('span.rd-ledger-k', k), v instanceof Node ? h('span.st-field.rd-ledger-v', v) : h('span.st-field.rd-ledger-v', o.hi ? h('span.st-hi', v) : v)),
            ),
          ),
        ]
      : null,
    extra,
  );
  return { el, nav };
}

/**
 * Scroll spy for the contents: the current section carries the sliding bar,
 * its children are shown (only the current section's), the current child is
 * marked. aria-current follows.
 */
export function wireToc(nav) {
  if (!nav) return () => {};
  const bar = nav.querySelector('.rd-toc-bar');
  const items = [...nav.querySelectorAll('a[href^="#"]')].map((a) => {
    const id = decodeURIComponent(a.hash.slice(1));
    const parentLi = a.closest('ol.rd-sub')?.closest('li');
    return { a, id, el: document.getElementById(id), top: parentLi ? parentLi.querySelector(':scope > a') : a };
  });
  let cur = null;
  let frame = 0;

  const place = (a) => {
    bar.style.transform = `translateY(${a.offsetTop}px)`;
    bar.style.height = `${a.offsetHeight}px`;
    bar.classList.add('is-on');
  };

  function set(hit) {
    if (!hit || hit === cur) return;
    const prevTop = cur?.top;
    cur = hit;
    for (const it of items) it.a.removeAttribute('aria-current');
    hit.top.setAttribute('aria-current', 'true');
    if (hit.top !== hit.a) hit.a.setAttribute('aria-current', 'true');
    if (prevTop !== hit.top) {
      for (const ol of nav.querySelectorAll('ol.rd-sub')) {
        const open = ol.parentElement === hit.top.parentElement;
        if (open && ol.hidden) {
          ol.hidden = false;
          if (!reduced()) {
            [...ol.children].forEach((li, i) => {
              li.style.setProperty('--i', i);
              li.classList.add('st-in-come');
              li.addEventListener('animationend', () => li.classList.remove('st-in-come'), { once: true });
            });
          }
        } else if (!open) ol.hidden = true;
      }
    }
    place(hit.top);
    // keep the current entry visible when the column scrolls
    const box = nav.closest('.rd-aside');
    if (box && box.scrollHeight > box.clientHeight) {
      const r = hit.a.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 3;
    }
  }

  function update() {
    frame = 0;
    const line = shellH() + 40;
    let hit = items.find((it) => it.el) ?? null;
    for (const it of items) {
      if (it.el && it.el.getBoundingClientRect().top - line <= 0) hit = it;
    }
    const doc = document.documentElement;
    if (scrollY > 0 && innerHeight + scrollY >= doc.scrollHeight - 4) {
      const last = [...items].reverse().find((it) => it.el && it.el.getBoundingClientRect().top < innerHeight);
      if (last) hit = last;
    }
    set(hit);
  }
  let late = 0;
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
    clearTimeout(late);
    late = setTimeout(update, 120);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    jumpTo(decodeURIComponent(a.hash.slice(1)));
  });
  update();
  // no transition for the first placement
  requestAnimationFrame(() => bar.classList.add('is-ready'));
  return () => {
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
  };
}

/** The heading that marks a target (the element itself, or its first heading). */
function headingOf(el) {
  return /^H[1-6]$/.test(el.tagName) ? el : el.querySelector('h2, h3, h4, .rd-pair') ?? el;
}

/** Briefly mark a landed-on heading with the violet bar (wipe in, hold, back). */
export function land(el) {
  if (!el || reduced()) return;
  const hd = headingOf(el);
  hd.classList.remove('rd-landed');
  void hd.offsetWidth;
  hd.classList.add('rd-landed');
  clearTimeout(hd._landT);
  hd._landT = setTimeout(() => hd.classList.remove('rd-landed'), 1300);
}

/** Scroll to an anchor on this page, put it in the address, land on it. */
export function jumpTo(id, { instant = false, history: hist = true } = {}) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (hist) history.replaceState(history.state, '', `#${encodeURIComponent(id)}`);
  const smooth = !instant && !reduced();
  // a closed fold that holds the target opens first
  const fold = el.closest('details:not([open])');
  if (fold) fold.open = true;
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' });
  if (!smooth) {
    land(el);
    return true;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    land(el);
  };
  addEventListener('scrollend', finish, { once: true });
  setTimeout(finish, 1000);
  return true;
}

/** In-page links inside root (href="#x" or this page + #x) scroll smoothly and land. */
export function wireAnchors(root) {
  root.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    const raw = a?.getAttribute('href');
    if (!raw || !raw.includes('#') || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.getAttribute('target')) return;
    const url = new URL(raw, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const id = decodeURIComponent(url.hash.slice(1));
    if (!document.getElementById(id)) return;
    e.preventDefault();
    jumpTo(id);
  });
}

/** On load: the address has #x -> go there once the page is rendered. */
export function jumpToHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && document.getElementById(id)) jumpTo(id, { instant: true, history: false });
}

/** The spectrum strip under a title sweeps in (not under the calm variant). */
export function sweep(tri) {
  if (tri && !calm() && !reduced()) tri.classList.add('st-in-sweep');
}

/** Empty state: hairline frame, hatch ground, one sentence on paper (tasks.md). */
export function emptyState(text, { decor } = {}) {
  return h(
    'div.site-empty.rd-empty',
    decor ? h('span.rd-empty-decor', { 'aria-hidden': 'true', style: { '--decor': `url("${iconURL.decor(decor)}")` } }) : null,
    h('p', text),
  );
}

/** The site's language: zh pages show the English eyebrow; en pages a label. */
export const isEn = () => lang === 'en';

export { dur };
