// Site search (/ or Ctrl K): a centred dialog over data/search.json.
// Four groups (models, tasks, categories, about sections), 5 per group with
// "查看全部 N 条"; matches Chinese and English names, short names, aliases,
// vendors, full pinyin and initials, ignoring case and spaces. ↑ ↓ choose,
// Enter opens, Esc closes. With an empty field: the last 5 searches and the
// pages of the nav (shell/markup.js NAV).
import { loadSearch, loadData } from '../core/data.js';
import { t, lang, pick } from '../core/i18n.js';
import { links } from '../core/route.js';
import { local } from '../core/state.js';
import { h } from '../core/dom.js';
import { modelName, vendorIcon, categoryIcon, iconURL } from '../core/names.js';
import { rankOf, progress } from '../core/rank.js';
import { fmtScore, fmtPct, fmtRank } from '../core/format.js';
import { closeDialog } from '../vendor/stellar/fx.js';
import { NAV } from './markup.js';
import { relayTo } from '../motion.js';

const GROUPS = ['model', 'task', 'category', 'section'];
const PER_GROUP = 5;
const RECENT_KEY = 'recentSearches';

let dlg = null;
let input = null;
let box = null;
let cursor = null;
let index = null;
let data = null;
let options = []; // [{ el, href }]
let active = -1;
let expanded = null;

// lower case, no spaces or separators; keeps a map back to the raw string
function normMap(raw) {
  const s = String(raw ?? '');
  let out = '';
  const map = [];
  [...s].forEach((ch, i) => {
    if (/[\s·・_\-–—/]/.test(ch)) return;
    out += ch.toLowerCase();
    map.push(i);
  });
  return { text: out, map, chars: [...s] };
}
const norm = (s) => normMap(s).text;
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function buildIndex(items) {
  return items
    .filter((it) => GROUPS.includes(it.type))
    .map((it, order) => {
      const display = lang === 'en' ? it.en || it.name : it.name;
      const names = [...new Set([it.name, it.en, it.short, it.short_en].filter(Boolean))];
      return {
        it,
        order,
        display,
        names: names.map(normMap),
        displayN: normMap(display),
        terms: arr(it.terms).map(norm).filter(Boolean),
        py: arr(it.py).map(norm).filter(Boolean),
        pyi: arr(it.pyi).map(norm).filter(Boolean),
      };
    });
}

// best match score for one entry; hl = [start, end) in the displayed name
function score(e, q) {
  let best = 0;
  let hl = null;
  const take = (s, h2) => {
    if (s > best) {
      best = s;
      hl = h2;
    }
  };
  const spanIn = (nm, at) => (at < 0 ? null : [nm.map[at], nm.map[at + q.length - 1] + 1]);
  for (const nm of e.names) {
    const at = nm.text.indexOf(q);
    if (at < 0) continue;
    const onDisplay = nm.text === e.displayN.text;
    const span = onDisplay ? spanIn(nm, at) : (() => {
      const a2 = e.displayN.text.indexOf(q);
      return a2 >= 0 ? spanIn(e.displayN, a2) : null;
    })();
    take(nm.text === q ? 100 : at === 0 ? 80 : 50, span);
  }
  for (const tm of e.terms) {
    if (tm === q) take(75, null);
    else if (tm.startsWith(q)) take(70, null);
    else if (tm.includes(q)) take(40, null);
  }
  for (const p of e.py) {
    if (p.startsWith(q)) take(65, null);
    else if (p.includes(q)) take(35, null);
  }
  // initials: highlight the matching characters when one initial = one character
  const han = e.displayN.chars.map((c, i) => [c, i]).filter(([c]) => !/[\s·・_\-–—/]/.test(c));
  for (const p of e.pyi) {
    const at = p.indexOf(q);
    if (at < 0) continue;
    const span = p.length === han.length ? [han[at][1], han[at + q.length - 1][1] + 1] : null;
    take(at === 0 ? 60 : 30, span);
  }
  return { score: best, hl };
}

function search(q) {
  const nq = norm(q);
  if (!nq) return null;
  const hits = [];
  for (const e of index) {
    const r = score(e, nq);
    if (r.score > 0) hits.push({ ...r, e });
  }
  hits.sort((a, b) => b.score - a.score || a.e.order - b.e.order);
  const groups = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (const x of hits) groups[x.e.it.type].push(x);
  return groups;
}

function hrefOf(it) {
  switch (it.type) {
    case 'model':
      return links.model(it.id);
    case 'task':
      return links.task(`${it.category}/${it.id}`);
    case 'category':
      return links.categories(it.id);
    default:
      return links.about(it.id);
  }
}

function iconOf(it) {
  if (it.type === 'model') return vendorIcon(data?.model(it.id) ?? 'openai');
  if (it.type === 'task') return categoryIcon(it.category);
  if (it.type === 'category') return categoryIcon(it.id);
  return h('span.icon', { style: { '--icon': `url("${iconURL.decor('star/star-outline')}")` }, 'aria-hidden': 'true' });
}

function lineOf(it) {
  if (!data) return '';
  if (it.type === 'model') {
    const m = data.model(it.id);
    if (!m) return '';
    const r = rankOf(data, it.id, 'total');
    if (r.rank == null) return t('common.search.modelLinePending', progress(data, it.id));
    return t('common.search.modelLine', { score: fmtScore(data.score(it.id).total), rank: fmtRank(r.rank) });
  }
  if (it.type === 'task') {
    const k = data.task(it.id);
    if (!k) return '';
    return t('common.search.taskLine', { category: pick(data.category(k.category), 'name'), minutes: k.minutes, weight: fmtPct(k.weight) });
  }
  if (it.type === 'category') {
    const c = data.category(it.id);
    return c ? t('common.search.categoryLine', { weight: fmtPct(c.weight), n: c.tasks.length }) : '';
  }
  const parent = it.parent && index.find((e) => e.it.type === 'section' && e.it.id === it.parent);
  return parent ? `${t('common.search.sectionLine')} / ${parent.display}` : t('common.search.sectionLine');
}

function nameEl(e, hl) {
  const it = e.it;
  if (it.type === 'model' && data?.model(it.id)) {
    const el = modelName(data.model(it.id));
    el.dataset.relayName = '';
    if (hl) markRange(el.querySelector('.mname-text'), hl);
    return el;
  }
  const el = h('span', { 'data-relay-name': it.type === 'task' ? '' : null }, e.display);
  if (hl) markRange(el, hl);
  return el;
}

function markRange(el, [a, b]) {
  const text = el.textContent;
  const chars = [...text];
  if (a < 0 || b > chars.length) return;
  el.replaceChildren(chars.slice(0, a).join(''), h('mark', chars.slice(a, b).join('')), chars.slice(b).join(''));
}

let optSeq = 0;
function option({ href, icon, name, sub, field, onPick }) {
  const id = `site-sd-opt-${++optSeq}`;
  const el = h(
    'a.site-sd-item',
    { href, id, role: 'option', 'aria-selected': 'false', tabindex: '-1' },
    icon,
    h('span.site-sd-text', h('span.site-sd-name', name), sub ? h('span.site-sd-sub', sub) : null),
    field ? h('span.st-field', field) : null,
  );
  el.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onPick?.();
    go(href);
  });
  el.addEventListener('pointermove', () => setActive(options.findIndex((o) => o.el === el), false));
  options.push({ el, href, onPick });
  return el;
}

function go(href) {
  const target = new URL(href, location.href);
  const samePage = target.pathname === location.pathname && target.search === location.search;
  close();
  if (samePage && target.hash) {
    location.hash = target.hash;
  } else location.href = href;
}

function pushRecent(q) {
  const v = q.trim();
  if (!v) return;
  const list = local.get(RECENT_KEY, []).filter((x) => x !== v);
  list.unshift(v);
  local.set(RECENT_KEY, list.slice(0, 5));
}

function render() {
  const q = input.value;
  options = [];
  active = -1;
  const frag = [];
  let i = 0;
  const groups = search(q);
  if (!groups) {
    // empty: recent searches and the pages of the nav
    const recent = local.get(RECENT_KEY, []);
    frag.push(
      h(
        'section.site-sd-group',
        { role: 'group', 'aria-label': t('common.search.recent') },
        h('p.site-sd-group-head', h('span.st-eyebrow.slash', t('common.search.recent')), recent.length ? h('button', { type: 'button', onclick: () => (local.set(RECENT_KEY, []), render()) }, t('common.search.clearRecent')) : null),
        recent.length
          ? h('div.site-sd-recent', recent.map((r) => h('button.st-chip', { type: 'button', onclick: () => ((input.value = r), render(), input.focus()) }, r)))
          : h('p.site-sd-empty', t('common.search.noRecent')),
      ),
      h(
        'section.site-sd-group',
        { role: 'group', 'aria-label': t('common.search.pages') },
        h('p.site-sd-group-head', h('span.st-eyebrow.slash', t('common.search.pages'))),
        NAV.map((n) =>
          h('div', { role: 'presentation', class: 'is-new', style: { '--i': i++ } }, option({
            href: links[n.key](),
            icon: h('span.icon', { style: { '--icon': `url("${iconURL.decor('star/star-solid')}")` }, 'aria-hidden': 'true' }),
            name: h('span', t(`common.nav.${n.key}`)),
            field: lang === 'zh' ? t(`common.nav.${n.key}En`) : null,
          })),
        ),
      ),
    );
  } else if (GROUPS.every((g) => !groups[g].length)) {
    frag.push(h('p.site-sd-empty', { role: 'status' }, t('common.search.empty', { q: q.trim() })));
  } else {
    for (const g of GROUPS) {
      const hits = groups[g];
      if (!hits.length) continue;
      const shown = expanded === g ? hits : hits.slice(0, PER_GROUP);
      frag.push(
        h(
          'section.site-sd-group',
          { role: 'group', 'aria-label': t(`common.search.groups.${g}`) },
          h(
            'p.site-sd-group-head',
            h('span.st-eyebrow.slash', t(`common.search.groups.${g}`)),
            hits.length > PER_GROUP && expanded !== g
              ? h('button', { type: 'button', onclick: () => ((expanded = g), render(), input.focus()) }, t('common.search.showAll', { n: hits.length }))
              : h('span.st-field', String(hits.length)),
          ),
          shown.map(({ e, hl }) => {
            const el = option({ href: hrefOf(e.it), icon: iconOf(e.it), name: nameEl(e, hl), sub: lineOf(e.it), onPick: () => pushRecent(q) });
            el.classList.add('is-new');
            el.style.setProperty('--i', i++);
            return el;
          }),
        ),
      );
    }
  }
  box.replaceChildren(cursor, ...frag);
  box.toggleAttribute('data-empty', !options.length);
  input.setAttribute('aria-expanded', String(options.length > 0));
  if (options.length && groups) setActive(0, false);
  else {
    input.removeAttribute('aria-activedescendant');
    cursor.style.height = '0';
  }
}

function setActive(n, scroll = true) {
  if (!options.length) return;
  active = (n + options.length) % options.length;
  options.forEach((o, i) => o.el.setAttribute('aria-selected', String(i === active)));
  const el = options[active].el;
  input.setAttribute('aria-activedescendant', el.id);
  cursor.style.transform = `translateY(${el.offsetTop}px)`;
  cursor.style.height = `${el.offsetHeight}px`;
  if (scroll) el.scrollIntoView({ block: 'nearest' });
}

function build() {
  input = h('input', {
    type: 'search',
    role: 'combobox',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: t('common.search.placeholder'),
    'aria-label': t('common.search.inputLabel'),
    'aria-autocomplete': 'list',
    'aria-controls': 'site-sd-list',
    'aria-expanded': 'false',
  });
  cursor = h('div.site-sd-cursor', { 'aria-hidden': 'true' });
  box = h('div.site-sd-results#site-sd-list', { role: 'listbox', 'aria-label': t('common.search.dialogLabel') });
  dlg = h(
    'dialog.st-dialog.site-dialog.site-sd',
    { 'aria-label': t('common.search.dialogLabel') },
    h('div.st-panel.cut-br', h('label.st-search', input), box, h('p.site-sd-hint.st-field', h('span', t('common.search.hint')), h('span', 'Esc'))),
  );
  input.addEventListener('input', () => {
    expanded = null;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[active] ?? options[0];
      if (o) {
        o.onPick?.();
        relayTo(o.href, o.el.querySelector('[data-relay-name]'));
        go(o.href);
      }
    }
  });
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  document.body.append(dlg);
}

/** Open the search dialog, optionally with a query already typed. */
export async function openSearch(q = '') {
  if (!dlg) build();
  if (!dlg.open) dlg.showModal();
  input.value = q;
  input.focus();
  if (!index) {
    try {
      const [items, d] = await Promise.all([loadSearch(), loadData().catch(() => null)]);
      data = d;
      index = buildIndex(items);
      // equal matches: models in official order (best first)
      if (data) for (const e of index) if (e.it.type === 'model' && data.order.includes(e.it.id)) e.order = data.order.indexOf(e.it.id) - 1000;
    } catch {
      index = [];
    }
  }
  render();
}

export function closeSearch() {
  close();
}

function close() {
  if (dlg?.open) closeDialog(dlg);
}

