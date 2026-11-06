// /about/ 挑战赛说明: the README as a reading page (website/docs/about.md).
// Text: content/<lang>/about.json; numbers about tasks and categories: data.
import '../../reading/reading.css';
import './style.css';
import { boot } from '../../shell/index.js';
import { h, t, tv, lang, pick, links, fmtPct, fmtNo, categoryIcon } from '../../core/index.js';
import { loadContent, contentVars } from '../../reading/content.js';
import { blocks, inline, inlineHTML, fold, fill, deliverableHTML } from '../../reading/rich.js';
import { aside, wireToc, wireAnchors, jumpToHash, pairTitle, sweep } from '../../reading/reading.js';
import { makeFigure, categoryFigure, dirStats } from '../../reading/figs/index.js';

const SECTIONS = ['intro', 'overview', 'tasks', 'format', 'scoring', 'principles'];
const no2 = (i) => String(i).padStart(2, '0');

boot(async ({ data }) => {
  const paper = document.querySelector('[data-slot="page"]');
  const side = document.querySelector('[data-slot="aside"]');
  if (!data) return;
  const c = await loadContent('about');
  const vars = contentVars(data);
  const ctx = { data, c, vars };
  const figs = [];
  const labels = [t('about.fold.open'), t('about.fold.close')];
  const addFig = (key, opts) => {
    const f = makeFigure(key, ctx, opts);
    if (!f) return null;
    figs.push(f);
    return f;
  };
  let weightsFig = null;
  const overviewRows = new Map();
  const rctx = {
    vars,
    labels,
    fig: (key) => {
      if (key === 'weights') {
        weightsFig = addFig('weights', { onHot: (task) => overviewRows.forEach((tr, k) => tr.classList.toggle('is-linked', !!task && k === task.key)) });
        return weightsFig?.el;
      }
      return addFig(key)?.el;
    },
    slot: (name) => (name === 'overview-table' ? overviewTable(data, overviewRows, () => weightsFig) : null),
  };

  // ---- page head ----
  const head = paper.querySelector('.rd-head');
  sweep(head.querySelector('.st-tri'));
  head.prepend(h('span.rd-banner', { 'aria-hidden': 'true', style: { '--decor': `url("${links.asset('decor/trails/trails-wide.svg')}")` } }));
  head.append(
    inline('p.rd-lede.st-read', c.lede, vars),
    h(
      'ul.st-facts.st-field',
      tv('about.fields').map((s) => h('li', fill(s, vars))),
    ),
  );
  const hero = addFig('hero');
  if (hero) head.append(hero.el);

  // ---- sections ----
  const title = (key, i) =>
    pairTitle('h2', {
      eyebrow: lang === 'en' ? no2(i + 1) : `${no2(i + 1)} / ${c.eyebrows?.[key] ?? key}`,
      title: c.sections[key],
    });
  const sec = (key, i, ...kids) => h('section.rd-sec', { id: key }, i ? h('div.rd-divider', { 'aria-hidden': 'true' }) : null, title(key, i), kids);

  paper.append(
    sec('intro', 0, blocks(c.intro, rctx)),
    sec('overview', 1, blocks(c.overview, rctx)),
    sec('tasks', 2, inline('p.rd-p.st-read', c.tasks.lead, vars), data.categories.map((cat) => categorySection(cat, ctx, rctx, addFig))),
    sec('format', 3, subSections(c.format, rctx, 4)),
    sec('scoring', 4, (c.scoringLead ?? []).map((s) => inline('p.rd-p.st-read', s, vars)), subSections(c.scoring, rctx, 5)),
    sec('principles', 5, principles(c.principles, vars)),
    h(
      'footer.rd-end',
      inline('p.rd-p.st-read', c.end, vars),
      h('p.st-actions', h('a.st-btn.go', { href: links.leaderboard() }, t('about.end.leaderboard')), h('a.st-btn', { href: links.tasks() }, t('about.end.tasks'))),
    ),
  );

  // ---- left column ----
  const toc = SECTIONS.map((key, i) => ({
    id: key,
    no: no2(i + 1),
    label: c.sections[key],
    children:
      key === 'tasks'
        ? data.categories.map((cat) => ({ id: cat.key, label: pick(cat, 'name'), icon: cat.key }))
        : key === 'format' || key === 'scoring'
          ? c[key].map((s) => ({ id: s.id, label: s.title }))
          : [],
  }));
  const std = data.kinds.standard;
  const des = data.kinds.design;
  const ledger = [
    [t('about.ledger.tasks'), t('common.unit.tasksShort', { n: data.tasks.length })],
    [t('about.ledger.categories'), t('about.ledger.catN', { n: data.categories.length })],
    [t('common.kind.standard'), t('about.ledger.kindN', { n: std.tasks.length, w: fmtPct(std.weight) })],
    [t('common.kind.design'), t('about.ledger.kindN', { n: des.tasks.length, w: fmtPct(des.weight) })],
    [t('about.ledger.minutes'), t('about.ledger.range', vars)],
  ];
  const a = aside({ toc, ledger });
  side.append(a.el);

  wireAnchors(paper);
  wireToc(a.nav);
  for (const f of figs) f.arm();
  jumpToHash();
});

/** 题目总览 table: 类别 │ 题目 │ 限时 │ 交付物 │ 权重; rows link with the weight bar. */
function overviewTable(data, rows, getFig) {
  const hd = tv('about.overview.head');
  const body = h('tbody');
  for (const task of data.tasks) {
    const cat = data.category(task.category);
    const tr = h(
      'tr',
      { dataset: { task: task.key } },
      h('td.rd-b', h('span.rd-catcell', categoryIcon(cat.key), pick(cat, 'name'))),
      h('td', h('a', { href: links.task(task), 'data-relay': '' }, pick(task, 'name'))),
      h('td.num', t('common.unit.minutes', { n: task.minutes })),
      h('td.rd-deliv', { html: deliverableHTML(pick(task, 'deliverable')) }),
      h('td.num', fmtPct(task.weight)),
    );
    tr.addEventListener('pointerenter', () => getFig()?.highlight(task.key));
    tr.addEventListener('pointerleave', () => getFig()?.highlight(null));
    tr.addEventListener('focusin', () => getFig()?.highlight(task.key));
    tr.addEventListener('focusout', () => getFig()?.highlight(null));
    rows.set(task.key, tr);
    body.append(tr);
  }
  const total = data.categories.reduce((s, x) => s + x.weight, 0);
  body.append(h('tr.rd-total', h('td.rd-b', t('about.overview.total')), h('td.rd-b', t('common.unit.tasksShort', { n: data.tasks.length })), h('td'), h('td'), h('td.num.rd-b', fmtPct(total))));
  return h('div.st-table-wrap.rd-wide', h('table.st-table.rd-table.rd-overview', h('thead', h('tr', hd.map((x, i) => h('th', { class: i === 2 || i === 4 ? 'num' : null }, x)))), body));
}

/** 03: one category: head, one sentence, its figure, then each task as a ruled entry. */
function categorySection(cat, ctx, rctx, addFig) {
  const { data, c, vars } = ctx;
  const tables = new Map(); // task key -> tbody of its directions table
  const figure = cat.kind === 'design' ? addFig(cat.key, { onHot: (taskKey, i) => tables.get(taskKey)?.querySelectorAll('tr').forEach((tr, k) => tr.classList.toggle('is-linked', k === i)) }) : addFig(cat.key);
  const first = cat.tasks[0]?.no;
  const last = cat.tasks[cat.tasks.length - 1]?.no;
  const head = h(
    'div.rd-cathead',
    h(
      'h3.rd-pair.rd-catpair',
      categoryIcon(cat.key),
      h('span.rd-catpair-in', h('span.st-eyebrow.slash.rd-pair-eb', lang === 'en' ? (first === last ? fmtNo(first) : `${fmtNo(first)}–${String(last).padStart(2, '0')}`) : cat.en), h('span.rd-pair-t', pick(cat, 'name'))),
    ),
    h(
      'div.rd-catmeta',
      h('ul.st-facts.st-field', h('li', t('common.unit.tasksShort', { n: cat.tasks.length })), h('li', t('about.task.weightOf', { w: fmtPct(cat.weight) }))),
      h('a.st-kv.rd-catlink', { href: links.categories(cat.key) }, h('span', t('about.task.board')), h('span', pick(cat, 'short'))),
    ),
  );
  const items = cat.tasks.map((task) => {
    const it = c.tasks.items?.[task.key] ?? {};
    const dirs = it.directions;
    const scoring = dirs ? t('about.task.dirFacts', dirStats(dirs)) : it.scoring;
    const facts = h(
      'ul.st-facts.st-field.rd-taskfacts',
      h('li', h('span.rd-k', t('about.task.limit')), t('common.unit.minutes', { n: task.minutes })),
      h('li', h('span.rd-k', t('about.task.deliverable')), h('span', { html: deliverableHTML(pick(task, 'deliverable')) })),
      h('li', h('span.rd-k', t('about.task.weight')), fmtPct(task.weight)),
      scoring ? h('li', h('span.rd-k', t('about.task.scoring')), h('span', { html: inlineHTML(scoring, vars) })) : null,
    );
    let foldEl = null;
    if (dirs) {
      const tb = h(
        'tbody',
        dirs.map(([name, pts, subs]) => h('tr', h('td.rd-b', name), h('td.num', String(pts)), h('td', subs.map(([n, p]) => `${n} ${p}`).join(t('about.task.sep'))))),
      );
      tables.set(task.key, tb);
      const tableEl = h('div.st-table-wrap.rd-wide', h('table.st-table.rd-table.rd-dirs', h('thead', h('tr', tv('about.task.dirHead').map((x, i) => h('th', { class: i === 1 ? 'num' : null }, x)))), tb));
      foldEl = fold(t('about.task.foldDesign'), [tableEl, ...blocks(it.notes, rctx)], { labels: rctx.labels, vars });
    } else if (it.fold) foldEl = fold(it.fold.title, blocks(it.fold.blocks, rctx), { labels: rctx.labels, vars });
    return h(
      'article.rd-task',
      { id: `task-${task.key}` },
      h('h4.rd-h4', h('a', { href: links.task(task) }, h('span.rd-taskno.num', fmtNo(task.no)), h('span', { 'data-relay-name': '' }, pick(task, 'name')))),
      inline('blockquote.rd-quote.st-read', pick(task, 'brief')),
      facts,
      it.points?.length ? [h('p.rd-minihead', t('about.task.points')), h('ul.rd-list.rd-points.st-read', it.points.map((p) => inline('li', p, vars)))] : null,
      foldEl,
    );
  });
  return h('section.rd-cat', { id: cat.key }, head, inline('p.rd-p.st-read', pick(cat, 'brief'), vars), figure?.el ?? null, h('div.rd-tasks', items));
}

/** 04 / 05: numbered subsections with their blocks. */
function subSections(list, rctx, secNo) {
  return (list ?? []).map((s, i) =>
    h('section.rd-subsec', { id: s.id }, h('h3.rd-h3', h('span.rd-h3-no', `${secNo}.${i + 1}`), h('span', s.title)), blocks(s.blocks, rctx)),
  );
}

/** 06: three groups, items numbered 01–11 straight through. */
function principles(groups, vars) {
  let n = 0;
  return (groups ?? []).map((g) => {
    const from = n + 1;
    const items = g.items.map((s) => h('li', h('span.rd-pno.num', no2(++n)), inline('p.st-read', s, vars)));
    return h(
      'div.rd-pgroup',
      pairTitle('h3', { eyebrow: lang === 'en' ? `${no2(from)}–${no2(n)}` : g.en, title: g.title }),
      h('ol.rd-principles', items),
    );
  });
}
