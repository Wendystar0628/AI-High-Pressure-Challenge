// 强项与弱项 (models.md): the 3 tasks where this model ranks best and the 3
// where it ranks lowest (equal ranks by score). Each row: number, name,
// score, rank. Hidden when the site has only one model.
//
//   const sw = createStrengths(container, { data });
//   sw.update(id, { animate })
import { h, t, pick, links, rankOf, fmtScore, fmtRank, fmtNo, fmtRankOf } from '../../core/index.js';
import { dur } from '../../motion.js';

export function createStrengths(container, { data }) {
  const list = (key) => h('ol.st-records.md-sw-list', { 'aria-labelledby': `md-sw-${key}` });
  const strong = list('strengths');
  const weak = list('weaknesses');
  const panel = (key, el) =>
    h(
      'section.st-panel.md-sw',
      h('h2', h('span.st-pair#md-sw-' + key, h('span.st-eyebrow', t(`model.sw.${key}Eyebrow`)), h('span', t(`model.sw.${key}`))), h('small.st-field', t('model.sw.note'))),
      el,
    );
  const wrap = h('div.md-sw-grid', { hidden: data.models.length < 2 }, panel('strengths', strong), panel('weaknesses', weak));
  container.append(wrap);

  function pickTasks(id) {
    const s = data.score(id);
    const all = data.tasks
      .map((k) => ({ k, v: s.tasks?.[k.key] ?? null, ...rankOf(data, id, k.key) }))
      .filter((x) => x.v != null && x.rank != null);
    const n = all.length;
    const nTop = n >= 6 ? 3 : Math.ceil(n / 2);
    const nLow = Math.min(3, n - nTop);
    const top = [...all].sort((a, b) => a.rank - b.rank || b.v - a.v || a.k.no - b.k.no).slice(0, nTop);
    const low = [...all].sort((a, b) => b.rank - a.rank || a.v - b.v || a.k.no - b.k.no).slice(0, nLow);
    return { top, low };
  }

  const row = (x, i, animate) =>
    h(
      'li',
      { class: animate ? 'st-in-come' : null, style: { '--i': i } },
      h(
        'a.st-record',
        { href: links.task(x.k) },
        h('span.st-tag', fmtNo(x.k.no)),
        h('span.name', { 'data-relay-name': '' }, pick(x.k, 'name')),
        h('span.num.md-sw-score', x.rank === 1 ? h('span.st-hi', fmtScore(x.v)) : fmtScore(x.v)),
        h('span.st-field.md-sw-rank', fmtRankOf(x.rank, x.of)),
      ),
    );

  function fillList(ol, items, animate) {
    if (!items.length) ol.replaceChildren(h('li.md-sw-empty', h('p.st-empty', t('model.sw.empty'))));
    else ol.replaceChildren(...items.map((x, i) => row(x, i, animate)));
  }

  function update(id, { animate = false } = {}) {
    const { top, low } = pickTasks(id);
    const go = animate && dur('come') > 0;
    fillList(strong, top, go);
    fillList(weak, low, go);
  }

  return { el: wrap, update };
}
