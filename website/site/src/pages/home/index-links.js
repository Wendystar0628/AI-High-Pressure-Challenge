// 去往各页 (home.md 6): four entrances in a row, hairlines between. The hollow
// numbers are real counts; pointing pours violet into the number, the number
// settles again and the small button wipes flare.
import { h, t, tv, fmtRank, links } from '../../core/index.js';
import { dur } from '../../motion.js';
import { scramble } from '../../vendor/stellar/fx.js';
import { sectionHead, section } from './util.js';

export function renderIndex(data) {
  const steps = (tv('home.how.steps') || []).length;
  const entries = [
    { key: 'leaderboard', n: data.models.length, href: links.leaderboard() },
    { key: 'categories', n: data.categories.length, href: links.categories() },
    { key: 'tasks', n: data.tasks.length, href: links.tasks() },
    { key: 'about', n: steps, href: links.about() },
  ];
  const list = h(
    'ul.idx',
    entries.map((e) => {
      const no = h('span.st-hollow-no.idx-no', { 'aria-hidden': 'true' }, fmtRank(e.n));
      const a = h(
        'a.idx-item',
        { href: e.href },
        no,
        h('span.st-eyebrow.idx-eyebrow', t(`home.index.${e.key}.eyebrow`)),
        h('b.idx-name', t(`home.index.${e.key}.name`)),
        h('span.sr-only', ` ${t(`home.index.${e.key}.count`, { n: e.n })} `),
        h('span.idx-line.st-field', t(`home.index.${e.key}.line`, { n: data.categories.length })),
        h('span.st-btn.small.idx-go', { 'aria-hidden': 'true' }, t('home.index.open')),
      );
      const run = () => dur('scramble') && scramble(no, dur('scramble'));
      a.addEventListener('pointerenter', run);
      a.addEventListener('focus', run);
      return h('li', a);
    }),
  );
  return section('index', sectionHead({ id: 'index-title', eyebrow: t('home.index.eyebrow'), title: t('home.index.title') }), list);
}
