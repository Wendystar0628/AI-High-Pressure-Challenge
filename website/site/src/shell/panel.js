// The model side panel (leaderboard.md「模型侧面板」): total, two kinds,
// 8 category scores and 12 task scores of one model, with the primary button
// 「查看全部得分」(→ the model scores page), compare and previous / next.
// Pushed in from the right; the address gets ?model=<id> while it is open.
//
//   openModelPanel('gpt-6-1-sol', { order })   // order: ids for previous / next (default: official order)
//   closeModelPanel()
//   setPanelOrder(ids)                          // e.g. the leaderboard's current sort
//   any element with data-model-panel="<id>" opens it on click; links, buttons and
//   ticks inside such an element keep their own click (a model row: the name is a
//   link to the model page, the rest of the row opens the panel)
//   document event 'octa:panel' { detail: { id } }  (id null when closed)
import { loadData } from '../core/data.js';
import { t, pick } from '../core/i18n.js';
import { links } from '../core/route.js';
import { setParams, getParam } from '../core/state.js';
import { h } from '../core/dom.js';
import { modelName, vendorIcon, modelLabel } from '../core/names.js';
import { rankOf, modelStatus, progress } from '../core/rank.js';
import { fmtScore, fmtPct, fmtRank, fmtDate, fmtRankOf } from '../core/format.js';
import { closeDialog, scramble, flashDone } from '../vendor/stellar/fx.js';
import { toggleCompare, isCompared, isCompareFull, onCompareChange } from '../ui/compare.js';
import { dur, relayName } from '../motion.js';

let dlg = null;
let data = null;
let current = null;
let order = null;

const emit = (id) => document.dispatchEvent(new CustomEvent('octa:panel', { detail: { id } }));

export function setPanelOrder(ids) {
  order = ids ? [...ids] : null;
  if (dlg?.open && current) renderActions();
}

export function getPanelModel() {
  return dlg?.open ? current : null;
}

function rankText(r) {
  return r.rank == null ? t('common.score.pending') : t('common.panel.rankLabel', { rank: r.rank });
}

function fig(label, value, r, best) {
  return h(
    'div',
    { class: best ? 'is-best' : null },
    h('b', { 'data-fx': '' }, fmtScore(value)),
    h('span', label),
    h('small', rankText(r)),
  );
}

function bar(value, kind, animateFrom0) {
  return h('span.site-panel-bar', { class: `is-${kind}`, 'aria-hidden': 'true' }, h('i', { style: { '--v': animateFrom0 ? 0 : (value ?? 0) / 100 }, 'data-v': (value ?? 0) / 100 }));
}

function build() {
  dlg = h('dialog.st-drawer.site-panel', { 'aria-labelledby': 'site-panel-title' }, h('div.body'));
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeModelPanel();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) closeModelPanel();
    if (e.target.closest('[data-close]')) closeModelPanel();
  });
  document.body.append(dlg);
  onCompareChange(() => dlg.open && renderActions());
}

function render(id, { fresh }) {
  const m = data.model(id);
  const s = data.score(id);
  const status = modelStatus(data, id);
  const total = rankOf(data, id, 'total');
  const std = rankOf(data, id, 'standard');
  const des = rankOf(data, id, 'design');
  const pr = progress(data, id);
  const body = dlg.querySelector('.body');
  let i = 0;
  const step = (el) => {
    el.classList.add('site-panel-in');
    el.style.setProperty('--i', i++);
    return el;
  };

  const head = h(
    'header',
    h(
      'span.st-pair',
      h('span.st-eyebrow.slash', status === 'ranked' ? t('common.panel.eyebrow', { rank: fmtRank(total.rank), vendor: m.vendor }) : t('common.panel.eyebrowPending', { vendor: m.vendor })),
      h('span.site-panel-title#site-panel-title', vendorIcon(m), modelName(m)),
    ),
    h('button.st-btn.small', { type: 'button', 'data-close': '' }, t('common.panel.close')),
  );

  const facts = h(
    'ul.st-facts.st-field.site-panel-facts',
    h('li', m.agent),
    h('li', m.effort),
    h('li', t('common.panel.tested', { date: fmtDate(m.tested) })),
    status === 'ranked' ? null : h('li', t('common.score.progress', pr)),
  );

  const figs = h(
    'div.st-figs',
    fig(t('common.panel.total'), status === 'ranked' ? s.total : null, total, total.rank === 1),
    fig(t('common.panel.standard'), s.kinds?.standard, std, std.rank === 1),
    fig(t('common.panel.design'), s.kinds?.design, des, des.rank === 1),
  );

  const catRows = data.categories.map((c) => {
    const v = s.categories?.[c.key];
    const r = rankOf(data, id, c.key);
    return step(
      h(
        'li',
        h('a', { href: links.categories(c.key), title: pick(c, 'name') }, pick(c, 'name')),
        h('span.num.of', fmtPct(c.weight)),
        v == null ? h('span.site-panel-none', t('common.panel.noScore')) : bar(v, c.kind, fresh),
        v == null ? null : h('span.num.val', r.rank === 1 ? h('span.st-hi', fmtScore(v)) : fmtScore(v)),
        h('span.num.of', r.rank == null ? '—' : fmtRankOf(r.rank, r.of)),
      ),
    );
  });

  const taskRows = data.categories.flatMap((c) => [
    h('li.group', h('span.st-eyebrow', pick(c, 'name'))),
    ...c.tasks.map((k) => {
      const v = s.tasks?.[k.key];
      const r = rankOf(data, id, k.key);
      return step(
        h(
          'li',
          h('span.num.of', fmtRank(k.no)),
          h('a', { href: links.task(k), title: pick(k, 'name') }, pick(k, 'name')),
          v == null ? h('span.site-panel-none', t('common.panel.noScore')) : h('span.num.val', r.rank === 1 ? h('span.st-hi', fmtScore(v)) : fmtScore(v)),
          v == null ? null : h('span.num.of', fmtRankOf(r.rank, r.of)),
        ),
      );
    }),
  ]);

  body.replaceChildren(
    head,
    facts,
    figs,
    h('section.site-panel-sec', h('h3.st-pair', h('span.st-eyebrow.slash', t('common.panel.categoriesEyebrow')), h('span', t('common.panel.categories'))), h('ul.site-panel-rows', catRows)),
    h('section.site-panel-sec', h('h3.st-pair', h('span.st-eyebrow.slash', t('common.panel.tasksEyebrow')), h('span', t('common.panel.tasks'))), h('ul.site-panel-rows.tasks', taskRows)),
    h('p.st-actions.site-panel-actions'),
  );
  dlg.setAttribute('aria-label', `${t('common.panel.label')}：${modelLabel(m)}`);
  renderActions();

  // bars grow after the push-in; numbers settle
  const grow = () => body.querySelectorAll('.site-panel-bar > i').forEach((el) => el.style.setProperty('--v', el.dataset.v));
  if (fresh) setTimeout(grow, dur('drawerIn'));
  else grow();
  body.querySelectorAll('.st-figs b').forEach((b) => scramble(b, dur('scramble') || 1));
}

function renderActions() {
  const box = dlg.querySelector('.site-panel-actions');
  if (!box || !current) return;
  const ids = order ?? data.order;
  const at = ids.indexOf(current);
  const on = isCompared(current);
  const cmp = h('button.st-btn', { type: 'button', disabled: !on && isCompareFull(), title: !on && isCompareFull() ? t('common.panel.compareFull') : null }, on ? t('common.panel.removeCompare') : t('common.panel.addCompare'));
  cmp.addEventListener('click', () => {
    toggleCompare(current);
    flashDone(cmp);
  });
  const prev = h('button.st-btn', { type: 'button', disabled: at <= 0 }, t('common.panel.prev'));
  const next = h('button.st-btn', { type: 'button', disabled: at < 0 || at >= ids.length - 1 }, t('common.panel.next'));
  prev.addEventListener('click', () => at > 0 && openModelPanel(ids[at - 1]));
  next.addEventListener('click', () => at < ids.length - 1 && openModelPanel(ids[at + 1]));
  // 主要按钮「查看全部得分」→ /models/<id>/（模型得分页）
  const detail = h('a.st-btn.go.site-panel-detail', { href: links.model(current), title: t('common.panel.allScoresTitle', { name: modelLabel(data.model(current)) }) }, t('common.panel.allScores'));
  // 名字接力: the name in the panel title slides to the model page's title
  relayName(detail, () => dlg.querySelector('.site-panel-title .mname'));
  // previous / next stay together (they wrap to their own line as one group when the row is full)
  box.replaceChildren(detail, cmp, h('span.site-panel-step', prev, next));
}

/** Open the panel on a model (or switch it to another model when already open). */
export async function openModelPanel(id, { order: ord } = {}) {
  data = data ?? (await loadData());
  if (!data.model(id)) return;
  if (ord) order = [...ord];
  if (!dlg) build();
  const wasOpen = dlg.open;
  current = id;
  if (wasOpen) {
    dlg.classList.remove('is-swapping');
    void dlg.offsetWidth;
    dlg.classList.add('is-swapping');
    render(id, { fresh: false });
  } else {
    render(id, { fresh: true });
    dlg.showModal();
    dlg.querySelector('.body').scrollTop = 0;
  }
  setParams({ model: id });
  emit(id);
}

export async function closeModelPanel() {
  if (!dlg?.open) return;
  await closeDialog(dlg);
  dlg.classList.remove('is-swapping');
  current = null;
  setParams({ model: null });
  emit(null);
}

/** Clicks on [data-model-panel] anywhere open the panel. */
const INNER = 'a[href], button, input, select, textarea, label, summary, [role="button"]';

export function wirePanel() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('[data-model-panel]');
    if (!el || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    // a link or control inside the element does its own thing
    const inner = e.target.closest(INNER);
    if (inner && inner !== el && el.contains(inner)) return;
    // selecting text in a row is not a click on it
    if (String(getSelection?.() ?? '').length && !inner) return;
    e.preventDefault();
    openModelPanel(el.dataset.modelPanel);
  });
}

/** On load: ?model=<id> opens the panel. */
export function openPanelFromURL() {
  const id = getParam('model');
  if (id) openModelPanel(id);
}
