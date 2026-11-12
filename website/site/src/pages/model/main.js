// 模型得分 /models/<id>/ and the entry page /models/ (the top model; website/docs/models.md),
// a console page: the side column (every model, grouped by vendor) beside
// head (fields, three big figures, compare, download) → the star dial fixed to
// this model beside the 10-category bars → the 13-task bars grouped by
// category → strengths and weaknesses. Narrow windows fold the column into a
// selector above the head.
// Picking a model (column, ← →) switches it in place: stars settle, bars morph,
// the address becomes /models/<id>/ with a history entry; back / forward work.
import './style.css';
import { boot, registerShortcut } from '../../shell/index.js';
import { h, t, route, links, modelLabel, altHref, BASE } from '../../core/index.js';
import { createStarDial, exportButton } from '../../charts/index.js';
import { dur, onEnterView } from '../../motion.js';
import { createHead } from './head.js';
import { createBarChart } from './bars.js';
import { createStrengths } from './strengths.js';
import { createPicker } from './picker.js';

boot(({ data }) => {
  const main = document.querySelector('main');
  const slot = main.querySelector('[data-slot="page"]');
  const header = main.querySelector('.md-head');
  const side = main.querySelector('.md-side');
  if (!data) {
    slot.replaceChildren();
    return;
  }
  let id = route.model;
  if (!data.model(id)) {
    createPicker(side, { data, onPick: (next) => (location.href = links.model(next)) });
    header.hidden = true;
    slot.replaceChildren(h('div.site-empty', h('p', t('model.missing'), ' ', h('a', { href: links.leaderboard() }, t('common.pages.leaderboard.title')))));
    return;
  }

  const nameOf = () => modelLabel(data.model(id));
  const head = createHead(header, { data });
  const picker = createPicker(side, { data, onPick: (next) => go(next) });

  // ---------- star dial + 10 categories ----------
  const pair = (eyebrow, title) => h('span.st-pair', h('span.st-eyebrow', eyebrow), h('span', title));
  const dialBox = h('div.md-dial-box');
  const dialPanel = h(
    'section.st-panel.md-dial-panel',
    h('h2', pair(t('model.dial.eyebrow'), t('model.dial.title')), exportButton({ getSvg: () => dial.svg, title: () => `${t('common.dial.title')} │ ${nameOf()}`, filename: () => `ai-decathlon-dial-${id}` })),
    dialBox,
    h('p.st-field.md-dial-note', t('model.dial.note')),
  );
  const catBox = h('div.md-chart-box.is-fill');
  const catPanel = h(
    'section.st-panel.md-cats-panel',
    h(
      'h2',
      pair(t('model.cats.eyebrow'), t('common.unit.categoriesShort', { n: data.categories.length })),
      exportButton({ getSvg: () => cats.svg, title: () => t('model.cats.exportTitle', { name: nameOf() }), filename: () => `ai-decathlon-categories-${id}` }),
    ),
    catBox,
  );
  const taskBox = h('div.md-chart-box');
  const taskPanel = h(
    'section.st-panel.md-tasks-panel',
    h(
      'h2',
      pair(t('model.tasks.eyebrow'), t('common.unit.tasksShort', { n: data.tasks.length })),
      exportButton({ getSvg: () => tasks.svg, title: () => t('model.tasks.exportTitle', { name: nameOf() }), filename: () => `ai-decathlon-tasks-${id}` }),
    ),
    taskBox,
  );
  const swBox = h('div.md-sw-wrap');
  slot.replaceChildren(h('div.md-top', dialPanel, catPanel), taskPanel, swBox);

  // ---------- entrance: head powers on → dial assembles, stars settle → bars grow ----------
  head.update(id, { dir: 0 });
  picker.update(id);
  if (dur('power')) {
    header.classList.add('st-in-power');
    header.addEventListener('animationend', () => header.classList.remove('st-in-power'), { once: true });
  }
  const dial = createStarDial(dialBox, { data, model: id, entrance: 'center', links: true, tagLink: false });
  const cats = createBarChart(catBox, { data, model: id, fill: true, label: t('model.cats.exportTitle', { name: nameOf() }) });
  const tasks = createBarChart(taskBox, { data, model: id, grouped: true, label: t('model.tasks.exportTitle', { name: nameOf() }) });
  const sw = createStrengths(swBox, { data });
  sw.update(id);
  setTimeout(() => cats.enter(), dur('power') ? 380 : 0);
  // the task chart grows when it is first scrolled to
  const isFirstScreen = taskBox.getBoundingClientRect().top < innerHeight;
  const cancelTasks = onEnterView(taskBox, () => setTimeout(() => tasks.enter(), isFirstScreen && dur('power') ? 520 : 0));

  // ---------- switching models in place, with a history entry ----------
  const entryId = id; // on the entry page /models/ this is the top model
  history.replaceState({ ...history.state, model: id }, '');
  const order = picker.ids;
  const step = (d) => {
    const i = order.indexOf(id) + d;
    if (i >= 0 && i < order.length) go(order[i]);
  };
  // the address now names this model: the nav's 模型得分 is a section, the language links follow
  function syncShell() {
    const nav = document.querySelector('.site-bar [data-nav="models"]');
    const entry = location.pathname.replace(BASE, '/').replace(/^\/en\//, '/') === '/models/';
    nav?.setAttribute('aria-current', entry ? 'page' : 'true');
    document.querySelectorAll('[data-lang-switch]').forEach((a) => a.setAttribute('href', altHref(a.dataset.langSwitch)));
  }
  function go(next, dir, { push = true } = {}) {
    if (!data.model(next) || next === id) return;
    dir = dir ?? (order.indexOf(next) > order.indexOf(id) ? 1 : -1);
    id = next;
    cancelTasks();
    const m = data.model(id);
    if (push) history.pushState({ model: id }, '', links.model(id));
    document.body.dataset.id = id;
    document.title = `${modelLabel(m)} │ ${t('common.pages.model.title')} │ ${t('common.site.name')}`;
    syncShell();
    picker.update(id);
    head.update(id, { dir });
    dial.setModel(id);
    cats.setModel(id);
    tasks.setModel(id);
    sw.update(id, { animate: true });
  }
  addEventListener('popstate', (e) => {
    const m = /\/models\/([^/]+)\/?$/.exec(location.pathname);
    const next = e.state?.model ?? (m ? m[1] : entryId);
    if (!data.model(next) || next === id) return;
    go(next, undefined, { push: false });
  });
  registerShortcut({ key: 'ArrowLeft', label: t('model.keys.prev'), display: '←', handler: () => step(-1) });
  registerShortcut({ key: 'ArrowRight', label: t('model.keys.next'), display: '→', handler: () => step(1) });
});
