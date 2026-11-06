// /tasks/<category>/<task>/: one template for the 12 task pages
// (website/docs/tasks.md 二). Head, scores, the scoring figure and the 题干
// come from data (the 题干 from data/stems/<category>/<task>.json, cut from the
// statement by export_data.py); 题面要点、考点 and the scoring list are
// hand-filled slots in content/<lang>/tasks/<category>/<task>.json and show
// their empty states until filled.
import '../../reading/reading.css';
import './style.css';
import { setBar, holdBar } from '../../charts/index.js';
import { boot } from '../../shell/index.js';
import { h, t, tv, lang, route, pick, links, fetchJSON, fmtPct, fmtNo, fmtDate, fmtScore, categoryIcon, modelName, modelLabel, vendorIcon, rankBy } from '../../core/index.js';
import { createModelList, createRowHead } from '../../ui/index.js';
import { scramble } from '../../vendor/stellar/fx.js';
import { dur, durIn, onEnterView, stagger } from '../../motion.js';
import { loadContent, contentVars } from '../../reading/content.js';
import { blocks, inline, fold, deliverableHTML, repoFile, repoDir } from '../../reading/rich.js';
import { aside, wireToc, wireAnchors, jumpToHash, pairTitle, sweep, emptyState } from '../../reading/reading.js';
import { makeFigure } from '../../reading/figs/index.js';

const TOP = 10;
/** This block's faint grid (ticks 0/25/50/75/100). */
const TICKS = [25, 50, 75];

boot(
  async ({ data }) => {
    const paper = document.querySelector('[data-slot="page"]');
    const side = document.querySelector('[data-slot="aside"]');
    const task = data?.task(route.task);
    if (!task) return;
    const cat = data.category(task.category);
    const [c, own, stemData] = await Promise.all([
      loadContent('about'),
      loadContent(`tasks/${task.path}`),
      fetchJSON(`stems/${task.path}`).catch((e) => (console.error(e), null)),
    ]);
    const vars = contentVars(data);
    const rctx = { vars, labels: [t('about.fold.open'), t('about.fold.close')] };

    // ---- head (all from data) ----
    const head = paper.querySelector('.rd-head');
    head.prepend(h('span.rd-banner.tk-banner', { 'aria-hidden': 'true', style: { '--decor': `url("${links.asset('decor/constellation/constellation-pair.svg')}")` } }));
    paper.querySelector('[data-slot="crumb"]').append(h('a', { href: links.tasks(cat.key) }, pick(cat, 'name')));
    paper
      .querySelector('[data-slot="ids"]')
      .append(
        h('span.st-tag.is-current', { 'aria-current': 'page' }, fmtNo(task.no)),
        h('a.st-kv', { href: links.categories(cat.key) }, h('span', t('task.category')), h('span', pick(cat, 'name'))),
        h('span.st-field.tk-kind', t(`about.kind1.${task.kind}`)),
      );
    paper
      .querySelector('[data-slot="facts"]')
      .append(
        h('li', t('task.fields.limit', { n: task.minutes })),
        h('li', t('task.fields.weight', { w: fmtPct(task.weight) })),
        h('li', h('span.tk-k', t('task.fields.deliverable')), h('span', { html: deliverableHTML(pick(task, 'deliverable')) })),
        h('li', h('span.tk-k', t('task.fields.scoring')), t(task.kind === 'design' ? 'common.kind.designScoring' : 'common.kind.standardScoring')),
      );
    paper.querySelector('[data-slot="title"]').textContent = pick(task, 'name');
    sweep(head.querySelector('.st-tri'));
    head.append(h('p.rd-lede.st-read', pick(task, 'brief')));

    const B = tv('task.blocks');
    const block = (key, ...kids) =>
      h('section.tk-block', { id: key }, pairTitle('h2', { eyebrow: lang === 'en' ? B[key].num : B[key].eyebrow, title: B[key].title, cls: 'tk-h2' }), kids);

    // 1. 题面要点 (hand-filled)
    const brief = own.brief?.length ? blocks(own.brief, rctx) : [emptyState(B.brief.empty)];

    // 2. 考点 (hand-filled): numbered list
    const points = own.points?.length
      ? h(
          'ol.tk-points',
          own.points.map((p, i) => h('li', h('span.tk-no.num', String(i + 1).padStart(2, '0')), inline('p.st-read', p, vars))),
        )
      : emptyState(B.points.empty);

    // 3. 各模型得分 (from scores)
    const scores = scoresBlock(data, task, B.scores);

    // 4. 评分要点: the figure from the about page, then the hand-filled list
    const fig = makeFigure(task.kind === 'design' ? cat.key : cat.key, { data, c, vars }, task.kind === 'design' ? { tasks: [task.key] } : {});
    const scoringList = own.scoring?.length ? h('ul.rd-list.st-read.tk-scoring', own.scoring.map((s) => inline('li', s, vars))) : emptyState(B.scoring.empty);
    const more = h('p.tk-more', h('a.st-kv', { href: links.about(cat.key) }, h('span', B.scoring.more), h('span', pick(cat, 'name'))));

    // 5. 题干 (from data): the statement as quoted, with links to the full statement and the materials
    const stem = stemBlock(stemData, task, B.stem, rctx.labels);

    // prev / next
    const prev = data.tasks.find((x) => x.no === task.no - 1);
    const next = data.tasks.find((x) => x.no === task.no + 1);
    const navRow = (x, label) =>
      x
        ? h(
            'li',
            h('a.st-record.tk-navrec', { href: links.task(x) }, h('span.st-tag', fmtNo(x.no)), h('span.st-field.tk-navlab', label), h('span.name.st-read', { 'data-relay-name': '' }, pick(x, 'name')), categoryIcon(x.category)),
          )
        : null;
    const nav = h('nav.tk-nav', { id: 'nav', 'aria-label': t('task.nav.label') }, h('ol.st-records', navRow(prev, t('task.nav.prev')), navRow(next, t('task.nav.next'))));

    paper.append(
      block('brief', brief),
      block('points', points),
      block('scores', scores.el),
      block('scoring', fig?.el ?? null, scoringList, more),
      block('stem', stem.el),
      nav,
    );

    // ---- left column ----
    const graded = rankBy(data, task.key).filter((e) => e.value != null);
    const best = graded.filter((e) => e.rank === 1);
    // 得分模型的名字是到模型得分页的链接（名字接力）
    const bestLink = (m) => {
      const name = modelName(m);
      name.dataset.relayName = '';
      return h('a.tk-bestby-link', { href: links.model(m.id), title: t('common.row.openPage', { name: modelLabel(m) }) }, name);
    };
    const bestNode = best.length ? h('span.tk-bestby', best.map((e) => bestLink(e.model))) : t('task.ledger.none');
    const same = cat.tasks.filter((x) => x.key !== task.key);
    const a = aside({
      tocLabel: t('task.aside.toc'),
      tocEyebrow: t('task.aside.tocEn'),
      toc: [
        ...['brief', 'points', 'scores', 'scoring'].map((k) => ({ id: k, label: B[k].title })),
        { id: 'stem', label: B.stem.title, children: stem.toc },
        { id: 'nav', label: t('task.nav.label') },
      ],
      ledgerLabel: t('task.aside.ledger'),
      ledgerEyebrow: t('task.aside.ledgerEn'),
      ledger: [
        [t('task.ledger.category'), pick(cat, 'name')],
        [t('task.ledger.kind'), t(`about.kind1.${task.kind}`)],
        [t('task.ledger.limit'), t('common.unit.minutes', { n: task.minutes })],
        [t('task.ledger.weight'), fmtPct(task.weight)],
        [t('task.ledger.best'), best.length ? fmtScore(best[0].value) : t('task.ledger.none'), { hi: best.length > 0 }],
        [t('task.ledger.bestBy'), bestNode, { stack: true }],
        [t('task.ledger.graded'), t('task.ledger.gradedN', { n: graded.length })],
      ],
      extra: same.length
        ? [
            h('p.rd-aside-h.tk-same-h', h('span.st-eyebrow', t('task.aside.sameEn')), h('b', t('task.aside.same'))),
            h(
              'ul.tk-same',
              same.map((x) => h('li', h('a', { href: links.task(x) }, h('span.num', fmtNo(x.no)), h('span', { 'data-relay-name': '' }, pick(x, 'name'))))),
            ),
          ]
        : [],
    });
    side.append(a.el);
    wireAnchors(paper);
    wireToc(a.nav);
    fig?.arm();
    scores.arm();
    jumpToHash();
  },
  { ns: ['about'] },
);

/**
 * 各模型得分: one row per model by this task's score (ties share a rank),
 * models without a score last with hatch and "评测中"; top 10, then
 * "展开全部 N 个". Bars grow from 0 the first time the block is seen.
 */
function scoresBlock(data, task, L) {
  const entries = rankBy(data, task.key);
  const graded = entries.filter((e) => e.value != null);
  const facts = h('ul.st-facts.st-field.tk-scorefacts', tv('task.blocks.scores.facts').map((_, i) => h('li', t(`task.blocks.scores.facts.${i}`, { n: graded.length, date: fmtDate(data.updated) }))));
  if (!graded.length) {
    return { el: [facts, emptyState(L.empty, { decor: 'orbit/orbit-nested' })], arm() {} };
  }
  const axis = h(
    'span.tk-axis',
    [0, 25, 50, 75, 100].map((v) => h('span', { style: { left: `${v}%` } }, String(v))),
  );
  const rowHead = createRowHead({ rank: L.head.rank, name: L.head.name, score: L.head.score, plot: axis, checkable: false });
  const ol = h('ol');
  const wrap = h('div.tk-scores', rowHead, ol);
  const list = createModelList(ol, {
    data,
    kind: task.kind === 'design' ? 'design' : 'standard',
    checkable: false,
    pass: false,
    grid: TICKS,
    animateIn: false,
    rankText: (e) => (e.value == null ? '' : String(e.rank).padStart(2, '0')),
    scoreText: (e) => (e.value == null ? L.pending : fmtScore(e.value)),
    note: '',
    empty: L.empty,
  });
  let open = false;
  const more = entries.length > TOP ? h('button.st-btn.small.tk-morebtn', { type: 'button' }) : null;
  const sync = () => {
    if (more) more.textContent = open ? L.less : L.more.replace('{n}', entries.length);
  };
  more?.addEventListener('click', () => {
    open = !open;
    list.update(open ? entries : entries.slice(0, TOP));
    sync();
  });
  sync();
  list.update(entries.slice(0, TOP), { animate: false });
  for (const li of list.rows.values()) li.classList.toggle('is-nullscore', !entries.find((e) => e.id === li.dataset.id)?.ranked);
  const el = [facts, wrap, more ? h('p.tk-morewrap', more) : null];
  return {
    el,
    arm() {
      if (!durIn('power')) return;
      const rows = [...list.rows.values()];
      const svgs = rows.map((li) => li.querySelector('.mrow-plot > svg.bar-svg'));
      const value = new Map(entries.map((e) => [e.id, e.value]));
      // bars wait at 0 until the block is first seen, then grow row by row (shared bar, charts/bar.js)
      svgs.forEach((s) => s && holdBar(s));
      rows.forEach((li) => li.querySelector('.mrow-best')?.classList.add('is-waiting'));
      onEnterView(wrap, () => {
        const gap = stagger('row', rows.length, 260);
        svgs.forEach((s, i) => {
          if (!s) return;
          setBar(s, value.get(rows[i].dataset.id), { duration: dur('power'), delay: i * gap, from0: true });
          setTimeout(() => rows[i].querySelector('.mrow-best')?.classList.remove('is-waiting'), i * gap + dur('power'));
        });
        rows.forEach((li, i) => {
          const s = li.querySelector('.mrow-score');
          setTimeout(() => scramble(s, dur('scrambleLoad')), i * gap);
        });
      });
    },
  };
}

/**
 * 题干: the statement quoted as written (data/stems/<category>/<task>.json, cut by
 * export_data.py's STEM_RULE). A note and the GitHub links on top, then the lead
 * text and one titled section per kept section; subsections fold, with one switch
 * to open or close them all. English pages show the Chinese original under an
 * English note. toc: the sections, as children of the block in the contents.
 */
function stemBlock(stem, task, L, labels) {
  const gh = (label, path, dir) =>
    h(
      'span.tk-src',
      h('a.st-kv', { href: dir ? repoDir(path) : repoFile(path), target: '_blank', rel: 'noopener' }, h('span', label), h('span', 'GitHub')),
      h('span.st-field.tk-path', path),
    );
  const sources = h('p.tk-source', gh(L.source, stem?.statement ?? task.statement), stem?.materials ? gh(L.materials, stem.materials, true) : null);
  if (!stem?.blocks?.length && !stem?.sections?.length) return { el: [sources, emptyState(L.empty)], toc: [] };

  const ctx = { labels }; // quoted as written: no {name} placeholders are filled in
  const folds = [];
  const deeper = (secs = []) => secs.flatMap((s) => [inline('h4.tk-stem-h4', s.title), ...blocks(s.blocks, ctx), ...deeper(s.sections)]);
  const toc = [];
  const body = h('div.tk-stem', { lang: 'zh-CN' }, blocks(stem.blocks, ctx));
  stem.sections.forEach((sec, n) => {
    const id = `stem-${n + 1}`;
    toc.push({ id, label: sec.title });
    const subs = (sec.sections ?? []).map((sub) => {
      const d = fold(sub.title, [...blocks(sub.blocks, ctx), ...deeper(sub.sections)], { labels });
      folds.push(d);
      return d;
    });
    body.append(h('section.tk-stem-sec', { id }, inline('h3.tk-stem-h', sec.title), blocks(sec.blocks, ctx), subs.length ? h('div.tk-stem-folds', subs) : null));
  });

  let toggle = null;
  if (folds.length) {
    toggle = h('button.st-btn.small.tk-stem-all', { type: 'button', 'aria-expanded': 'false' });
    const sync = () => {
      const all = folds.every((d) => d.open);
      toggle.textContent = all ? L.collapseAll : L.expandAll;
      toggle.setAttribute('aria-expanded', String(all));
    };
    toggle.addEventListener('click', () => {
      const open = !folds.every((d) => d.open);
      folds.forEach((d) => (d.open = open));
      sync();
    });
    folds.forEach((d) => d.addEventListener('toggle', sync));
    sync();
  }
  const omitted = stem.omitted?.length
    ? h('ul.st-facts.st-field.tk-omit', h('li', L.omitted), stem.omitted.map((x) => h('li', { lang: 'zh-CN' }, x)))
    : null;
  const head = h('div.tk-stem-head', h('p.tk-stem-note', L.note), sources, omitted || toggle ? h('div.tk-stem-bar', omitted, toggle) : null);
  return { el: [head, body], toc };
}
