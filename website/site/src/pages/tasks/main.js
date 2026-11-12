// /tasks/ 题目拆解: the entry to the 13 task pages, grouped by category
// (website/docs/tasks.md 一). Everything here comes from data/tasks.json.
import '../../reading/reading.css';
import './style.css';
import { boot } from '../../shell/index.js';
import { h, t, tv, lang, pick, links, fmtPct, fmtNo, fmtDate, categoryIcon } from '../../core/index.js';
import { loadContent, contentVars } from '../../reading/content.js';
import { fill } from '../../reading/rich.js';
import { aside, wireToc, wireAnchors, jumpToHash } from '../../reading/reading.js';
import { makeFigure } from '../../reading/figs/index.js';

const MAX_MIN = 100; // a time bar is full length at 100 minutes

boot(
  async ({ data }) => {
    const paper = document.querySelector('[data-slot="page"]');
    const side = document.querySelector('[data-slot="aside"]');
    if (!data) return;
    const c = await loadContent('about');
    const vars = contentVars(data);

    // ---- head ----
    const head = paper.querySelector('.rd-head');
    head.prepend(h('span.rd-banner.tks-banner', { 'aria-hidden': 'true', style: { '--decor': `url("${links.asset('decor/constellation/constellation-pair.svg')}")` } }));
    paper.querySelector('[data-slot="count"]').textContent = t('tasks.count', { n: data.tasks.length });
    head.append(h('ul.st-facts.st-field', tv('tasks.fields').map((s) => h('li', fill(s, vars)))), h('p.rd-lede.st-read', t('tasks.lede')));

    // ---- weight bar: a segment scrolls to its group ----
    const weights = makeFigure('weights', { data, c, vars }, { href: (key) => `#${key}` });
    if (weights) paper.append(weights.el);

    // ---- groups ----
    for (const cat of data.categories) {
      const first = cat.tasks[0]?.no;
      const last = cat.tasks[cat.tasks.length - 1]?.no;
      const eyebrow = lang === 'en' ? (first === last ? fmtNo(first) : `${fmtNo(first)}–${String(last).padStart(2, '0')}`) : cat.en;
      const headEl = h(
        'h2.st-group-head.rd-group-head',
        h('span.tks-gh-l', categoryIcon(cat.key), h('span.st-pair', h('span.st-eyebrow', eyebrow), h('span', pick(cat, 'name')))),
        h(
          'span.tks-gh-r',
          h('ul.st-facts.st-field', h('li', t('common.unit.tasksShort', { n: cat.tasks.length })), h('li', t('tasks.group.weight', { w: fmtPct(cat.weight) }))),
          h('a.st-kv.tks-board', { href: links.categories(cat.key) }, h('span', t('tasks.group.board')), h('span', pick(cat, 'short'))),
        ),
      );
      const recs = h(
        'ol.st-records.tks-recs',
        cat.tasks.map((task) =>
          h(
            'li',
            h(
              'a.st-record.tks-rec',
              { href: links.task(task), 'aria-label': t('tasks.rec.aria', { no: fmtNo(task.no), name: pick(task, 'name'), kind: t(`about.kind1.${task.kind}`), n: task.minutes, w: fmtPct(task.weight) }) },
              h('span.st-tag', fmtNo(task.no)),
              h('span.name.st-read', { 'data-relay-name': '' }, pick(task, 'name')),
              h('span.st-field.tks-kind', t(`about.kind1.${task.kind}`)),
              h(
                'span.tks-time',
                h('span.tks-bar', { class: `is-${task.kind}`, style: { '--m': Math.min(1, task.minutes / MAX_MIN) } }),
                h('span.st-field', t('common.unit.minutes', { n: task.minutes })),
              ),
              h('span.st-field.tks-w', fmtPct(task.weight)),
            ),
          ),
        ),
      );
      paper.append(h('section.tks-group', { id: cat.key }, headEl, recs));
    }

    // ---- left column ----
    const std = data.kinds.standard;
    const des = data.kinds.design;
    const a = aside({
      tocLabel: t('tasks.aside.toc'),
      tocEyebrow: t('tasks.aside.tocEn'),
      toc: data.categories.map((cat) => ({ id: cat.key, label: pick(cat, 'name'), icon: cat.key })),
      ledgerLabel: t('tasks.aside.ledger'),
      ledgerEyebrow: t('tasks.aside.ledgerEn'),
      ledger: [
        [t('common.kind.standard'), t('tasks.ledger.kindN', { n: std.tasks.length, w: fmtPct(std.weight) })],
        [t('common.kind.design'), t('tasks.ledger.kindN', { n: des.tasks.length, w: fmtPct(des.weight) })],
        [t('tasks.ledger.models'), t('tasks.ledger.modelsN', { n: data.models.length })],
        [t('tasks.ledger.updated'), fmtDate(data.updated)],
      ].slice(0, data.notice ? 2 : 4),   // 暂停公示时不写受测模型数和更新日期
    });
    side.append(a.el);
    wireAnchors(paper);
    wireToc(a.nav);
    weights?.arm();
    jumpToHash();
  },
  { ns: ['about'] },
);
