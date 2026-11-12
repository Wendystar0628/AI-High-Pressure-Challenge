// 首屏 (home.md 2): left column — fields, wordmark, marker line, intro, top 5;
// right column — the 十项星盘 (shared dial) with its three-line legend.
import { h, svg, t, tv, lang, fmtDate, fmtRank, fmtScore, fmtInt, modelName, modelLabel, vendorIcon, links, iconURL } from '../../core/index.js';
import { createStarDial, exportButton, starD } from '../../charts/index.js';
import { dur, durIn, stagger, reduced, calm } from '../../motion.js';
import { scramble } from '../../vendor/stellar/fx.js';
import { tn, minuteRange } from './util.js';

/** The entrance plays (not under reduced motion or the calm variant). */
const entering = () => !reduced() && !calm() && durIn('come') > 0;

// ---------- left column ----------

function fields(data) {
  const num = (v) => h('b.num.hero-fig', String(v));
  const range = minuteRange(data);
  const items = [
    h('li', tn('home.hero.updated', { date: h('b.num.hero-fig', fmtDate(data.updated)) })),
    h('li', tn('home.hero.models', { n: num(fmtInt(data.models.length)) }, data.models.length)),
    h('li', tn('home.hero.tasks', { n: num(data.tasks.length) }, data.tasks.length)),
    h('li', tn('home.hero.categories', { n: num(data.categories.length) }, data.categories.length)),
    range ? h('li', tn('home.hero.minutes', { range: num(range) })) : null,
  ];
  return h('ul.hero-fields.st-field', items);
}

function wordmark() {
  const wm = h(
    'span.st-wordmark.hero-wm',
    { 'aria-hidden': 'true' },
    h('span.solid', t('common.site.wordmark')),
    h('span.hollow', t('common.site.sub')),
  );
  return h(
    'h1.hero-title',
    h('span.sr-only', `${t('common.site.wordmark')} ${t('common.site.sub')} │ `),
    wm,
    h('span.hero-marker', h('span.st-marker', cjkDots(t('common.site.name')))),
  );
}

/** Chinese 「·」 (间隔号) in the Chinese font: Saira draws U+00B7 as a short bar that reads like a hyphen. */
function cjkDots(text) {
  if (lang !== 'zh') return text;
  const parts = String(text).split('·');
  return parts.flatMap((p, i) => (i ? [h('span.cjk', '·'), p] : [p]));
}

/**
 * The longer wordmark line fills the column; both lines share one size, --wm,
 * set on the intro block. The Chinese marker line is sized from it (style.css:
 * 0.8 × --wm, so its characters stand as tall as the wordmark's capitals) and
 * so are the gaps around it. Should the marker still be wider than the column,
 * it is scaled down to fit (--mk).
 */
function fitWordmark(title) {
  const wm = title.querySelector('.hero-wm');
  const box = title.parentElement;
  const col = title.clientWidth;
  if (!wm || !col) return;
  box.style.setProperty('--wm', '100px');
  box.style.removeProperty('--mk');
  const w = Math.max(...[...wm.children].map((l) => l.getBoundingClientRect().width));
  if (w > 0) box.style.setProperty('--wm', `${Math.floor((100 * col * 100) / w) / 100}px`);
  const mk = title.querySelector('.hero-marker .st-marker');
  const mw = mk?.getBoundingClientRect().width ?? 0;
  if (mw > col) box.style.setProperty('--mk', String(Math.floor((col / mw) * 1000) / 1000));
}

function badge() {
  // decor/rays/rays-burst-light (dark: -dark): the first place's small mark
  return h(
    'span.t5-badge',
    { 'aria-hidden': 'true' },
    h('img.is-light', { src: iconURL.decor('rays/rays-burst-light'), alt: '', width: 240, height: 240 }),
    h('img.is-dark', { src: iconURL.decor('rays/rays-burst-dark'), alt: '', width: 240, height: 240 }),
  );
}

function topFive(data, page, top) {
  const n = top.length;
  const ol = h('ol.t5-list');
  const cursor = h('div.t5-cursor', { 'aria-hidden': 'true' });
  const rows = new Map();
  top.forEach((e, i) => {
    const m = e.model;
    const first = e.rank === 1;
    const score = fmtScore(e.value);
    // the row sets the page model (a button laid over the whole row); the name
    // itself is a link to the model scores page, above the button (名字接力)
    const pick = h('button.t5-pick', {
      type: 'button',
      'aria-pressed': String(e.id === page.id),
      'aria-label': t('home.top.rowAria', { rank: e.rank, name: modelLabel(m), score }),
      title: t('home.top.rowTitle'),
      onclick: () => page.set(e.id),
    });
    const name = modelName(m, { className: 't5-name' });
    name.dataset.relayName = '';
    const row = h(
      'div.t5-row',
      {
        class: e.id === page.id ? 'is-current' : null,
        dataset: { id: e.id },
        style: { '--i': i, '--v': Math.max(0, Math.min(100, e.value)) / 100 },
      },
      pick,
      first ? badge() : h('span.t5-badge', { 'aria-hidden': 'true' }),
      h('span.st-tag.t5-no.num', { 'aria-hidden': 'true' }, fmtRank(e.rank)),
      vendorIcon(m),
      h('a.t5-link', { href: links.model(e.id), title: t('home.top.pageTitle', { name: modelLabel(m) }) }, name),
      h('span.t5-score.num', { 'aria-hidden': 'true' }, first ? h('span.st-hi', h('span.t5-fig', score)) : h('span.t5-fig', score)),
      h('span.t5-bar', { 'aria-hidden': 'true' }, h('i')),
    );
    rows.set(e.id, row);
    ol.append(h('li', row));
  });
  const wrap = h('div.t5-wrap', cursor, ol);

  const head = h(
    'header.t5-head',
    // no ranked model yet (everyone 评测中): keep the section's own name, "前五名", above the empty note
    h('p.st-eyebrow.slash', t('home.top.eyebrow', { n: n || 5 })),
    h('h2.st-bar-title#t5-title', n === 5 || !n ? t('home.top.title') : t('home.top.titleN', { n })),
  );
  const foot = h(
    'div.t5-foot',
    h('span.st-field', tn('home.top.count', { n: h('b.num', fmtInt(data.models.length)) }, data.models.length)),
    h('a.st-btn.go', { href: links.leaderboard() }, t('home.top.board')),
  );
  const el = h('section.t5', { 'aria-labelledby': 't5-title' }, head, n ? wrap : h('p.home-empty', t('home.top.empty')), foot);

  // the current-row marker slides between rows (当前标记滑动)
  let placed = false;
  function place(animate) {
    const row = rows.get(page.id)?.parentElement;
    cursor.hidden = !row;
    if (!row) return;
    // `translate` places it, so the entrance can still use `transform`
    cursor.style.transition = animate && placed ? `translate ${dur('shutter')}ms var(--st-mech), height ${dur('shutter')}ms var(--st-mech)` : 'none';
    cursor.style.height = `${row.offsetHeight}px`;
    cursor.style.translate = `0 ${row.offsetTop}px`;
    cursor.style.setProperty('--i', top.findIndex((e) => e.id === page.id));
    placed = true;
  }
  page.on((id) => {
    rows.forEach((row, rid) => {
      row.classList.toggle('is-current', rid === id);
      row.querySelector('.t5-pick').setAttribute('aria-pressed', String(rid === id));
    });
    place(true);
  });
  return { el, place, figs: [...el.querySelectorAll('.t5-fig')] };
}

// ---------- right column ----------

function legendIcon(kind) {
  const s = svg('svg', { class: `hero-legend-icon is-${kind}`, viewBox: '0 0 30 14', width: 30, height: 14, 'aria-hidden': 'true' });
  if (kind === 'distance') {
    s.append(svg('circle', { class: 'li-disc', cx: 3, cy: 7, r: 3 }));
    s.append(svg('line', { class: 'li-line', x1: 7, y1: 7, x2: 19, y2: 7 }));
    s.append(svg('path', { class: 'li-star', d: starD(5, 0.36), transform: 'translate(24 7)' }));
  } else if (kind === 'area') {
    s.append(svg('path', { class: 'li-star', d: starD(3.4, 0.36), transform: 'translate(6 7)' }));
    s.append(svg('path', { class: 'li-star', d: starD(6.6, 0.36), transform: 'translate(21 7)' }));
  } else {
    s.append(svg('circle', { class: 'li-disc', cx: 15, cy: 7, r: 6.5 }));
  }
  return s;
}

function dialBlock(data, page) {
  const box = h('div.hero-dial-box');
  const legend = h(
    'ul.hero-legend.st-field',
    (tv('home.dial.legend') || []).map((line, i) => h('li', legendIcon(['distance', 'area', 'disc'][i] || 'disc'), h('span', line))),
  );
  const detail = h('a.st-btn.small', { href: links.model(page.id) }, t('home.dial.detail'));
  const setDetail = () => {
    const m = data.model(page.id);
    detail.href = links.model(page.id);
    detail.title = t('home.dial.detailTitle', { name: modelLabel(m) });
  };
  setDetail();
  let dial = null;
  const exp = exportButton({
    getSvg: () => dial?.svg,
    title: () => `${t('common.dial.title')} ${modelLabel(data.model(page.id))}`,
    filename: () => `ai-decathlon-dial-${page.id}`,
  });
  // the figure fills the right column; the stack is a square dial plus its caption
  const el = h('figure.hero-dial', h('div.hero-dial-stack', box, h('figcaption.hero-dial-foot', legend, h('p.hero-dial-acts', detail, exp))));
  return {
    el,
    mount() {
      // 名字接力 from a star to its task page is built into the dial
      dial = createStarDial(box, { data, model: page.id, entrance: 'edge' });
      page.on((id) => {
        dial.setModel(id);
        setDetail();
      });
      return dial;
    },
  };
}

// ---------- the first screen ----------

export function renderHero(data, page, top) {
  const head = h('div.hero-intro', fields(data), wordmark(), h('p.hero-lede', t('home.hero.intro', { range: minuteRange(data) })));
  const five = topFive(data, page, top);
  const dial = dialBlock(data, page);
  const el = h('section.hero', { 'aria-label': t('common.site.name') }, h('div.hero-in', h('div.hero-left', head, five.el), h('div.hero-right', dial.el)));

  return {
    el,
    /** After the element is in the page: dial, fitting, entrance. */
    start(root) {
      const title = el.querySelector('.hero-title');
      fitWordmark(title);
      // refit only when the column width changes (the fit itself changes the column's height)
      let colW = 0;
      new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width);
        if (w !== colW) {
          colW = w;
          fitWordmark(title);
        }
        five.place(false);
      }).observe(el.querySelector('.hero-left'));
      document.fonts?.ready.then(() => {
        fitWordmark(title);
        five.place(false);
      });
      five.place(false);

      const d = dial.mount();
      if (!entering()) return d;

      // 入场 (home.md 入场顺序): dial at 0 (inside the shared dial: disc, plates, stars,
      // constellation); wordmark a little later; readouts from 120 ms; rows from 300 ms;
      // disc tag wipes in; bars grow; the marker and the constellation finish.
      root.classList.add('is-entering');
      const figs = [...el.querySelectorAll('.hero-fig'), ...five.figs];
      const gap = stagger('row', figs.length);
      figs.forEach((f, i) => setTimeout(() => scramble(f, dur('scrambleLoad')), 120 + i * gap));
      d.wipeTag({ delay: 420 });
      setTimeout(() => root.classList.remove('is-entering'), 1100);
      return d;
    },
  };
}
