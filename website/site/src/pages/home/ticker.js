// 题目滚动条 (home.md 3): the dark band at the bottom of the first screen. Every
// task in tasks.json order, linking to its page. The site's one looping motion;
// pointing at it or focusing a link stops it (stellar.css .st-ticker).
import { h, t, pick, fmtRank, fmtMinutes, links } from '../../core/index.js';
import { relayName } from '../../motion.js';

export function renderTicker(data) {
  const item = (task, copy) => {
    const cat = data.category(task.category);
    const name = h('span.tk-name', `${pick(cat, 'name')} / ${pick(task, 'name')}`);
    const a = h(
      'a',
      { href: links.task(task), tabindex: copy ? '-1' : null },
      h('b.num', fmtRank(task.no)),
      name,
      h('span.tk-min.st-field', fmtMinutes(task.minutes)),
    );
    if (!copy) relayName(a, name);
    return h('li', a);
  };
  const list = (copy) => h('ul', { 'aria-hidden': copy ? 'true' : null }, data.tasks.map((task) => item(task, copy)));
  return h('nav.st-ticker.home-ticker', { 'aria-label': t('home.ticker.label', { n: data.tasks.length }) }, h('div.track', list(false), list(true)));
}
