// 一道题怎么测 (home.md 5): four steps in a row, then the time-limit ruler —
// one violet timing bar per time limit, running to an ink stop line, a dotted
// lead to that limit's tasks (four-point stars sized by weight, as on the dial).
import { h, t, tv, pick, fmtPct, fmtRank, links } from '../../core/index.js';
import { tipForArea } from '../../charts/index.js';
import { dur, durIn, reduced, calm, onEnterView, EXTRA, STAGGER } from '../../motion.js';
import { showTip, hideTip } from '../../ui/index.js';
import { sectionHead, section, starIcon } from './util.js';
import { relayName } from '../../motion.js';

function steps() {
  const list = tv('home.how.steps') || [];
  return h(
    'ol.how-steps',
    list.map((s, i) =>
      h(
        'li.how-step',
        h('span.how-node', { 'aria-hidden': 'true' }, starIcon(6)),
        h('span.how-no.num', fmtRank(i + 1)),
        h('b.how-name', s.name),
        h('span.how-line.st-field', s.line),
      ),
    ),
  );
}

function ruler(data) {
  const byMin = new Map();
  for (const task of data.tasks) {
    if (!Number.isFinite(task.minutes)) continue;
    if (!byMin.has(task.minutes)) byMin.set(task.minutes, []);
    byMin.get(task.minutes).push(task);
  }
  const tiers = [...byMin.entries()].sort((a, b) => a[0] - b[0]);
  const maxMin = Math.max(100, Math.ceil(Math.max(...tiers.map(([m]) => m)) / 10) * 10);
  const pct = (m) => `${(m / maxMin) * 100}%`;
  const el = h('div.ruler', { style: { '--max': maxMin } });

  const rows = tiers.map(([m, tasks]) => {
    const track = h(
      'div.ruler-track',
      h('i.ruler-bar'),
      h('i.ruler-stop'),
      h('i.ruler-lead'),
    );
    const stars = tasks.map((task, i) => {
      const cat = data.category(task.category);
      const name = h('span.ruler-task-name', pick(task, 'short') || pick(task, 'name'));
      const a = h(
        'a.ruler-task',
        {
          href: links.task(task),
          class: `is-${task.kind}`,
          style: { '--i': i },
          'aria-label': `${fmtRank(task.no)} ${t('home.how.tip', { name: pick(task, 'name'), category: pick(cat, 'name'), weight: fmtPct(task.weight) })}`,
        },
        starIcon(tipForArea(task.weight, 3.2), 'ruler-star'),
        name,
      );
      const tip = t('home.how.tip', { name: pick(task, 'name'), category: pick(cat, 'name'), weight: fmtPct(task.weight) });
      a.addEventListener('pointerenter', () => showTip(tip, a.querySelector('.ruler-star')));
      a.addEventListener('focus', () => showTip(tip, a.querySelector('.ruler-star')));
      a.addEventListener('pointerleave', hideTip);
      a.addEventListener('blur', hideTip);
      relayName(a, name);
      return h('li', a);
    });
    const tier = h(
      'div.ruler-tier',
      h('p.ruler-tier-head.st-field', { 'aria-label': t('home.how.tierAria', { m, n: tasks.length }) }, t('home.how.tier', { m, n: tasks.length })),
      h('ul.ruler-tasks', stars),
    );
    const row = h('div.ruler-row', { dataset: { min: m }, style: { '--to': pct(m), '--d': `${Math.round(((durIn('timerMax') || EXTRA.timerMax) * m) / maxMin)}ms` } }, track, tier);
    // 指向一条计时条：其余各档退淡
    const on = () => {
      el.classList.add('has-tier');
      for (const r of el.querySelectorAll('.ruler-row')) r.classList.toggle('is-tier', r === row);
    };
    const off = () => {
      el.classList.remove('has-tier');
      row.classList.remove('is-tier');
    };
    track.addEventListener('pointerenter', on);
    track.addEventListener('pointerleave', off);
    return row;
  });

  // the axis: 0 … max minutes, a tick every 10
  const ticks = [];
  for (let m = 0; m <= maxMin; m += 10) ticks.push(h('span.ruler-tick', { style: { left: pct(m) }, class: m % 50 === 0 ? 'is-major' : null }, h('span.num', String(m))));
  const axis = h('div.ruler-axis', { 'aria-hidden': 'true' }, h('div.ruler-ticks', ticks), h('p.ruler-axis-label.st-eyebrow', t('home.how.axis')));

  el.append(h('p.sr-only', t('home.how.ruler')), ...rows, axis);

  // 计时条走满: all bars start together, each as long as its limit; then the stop
  // line drops and that limit's stars light one by one
  const animate = !reduced() && !calm() && durIn('timerMax') > 0;
  if (animate) {
    el.classList.add('will-draw');
    onEnterView(el, () => {
      el.classList.remove('will-draw');
      el.classList.add('is-drawing');
      const longest = Math.max(...tiers.map(([m]) => m));
      const end = (durIn('timerMax') * longest) / maxMin + dur('row') + tiers.reduce((x, [, ts]) => Math.max(x, ts.length), 0) * STAGGER.row + dur('come');
      setTimeout(() => el.classList.remove('is-drawing'), end + 200);
    });
  }
  return el;
}

export function renderHow(data) {
  const rules = h('a.st-btn.small', { href: links.about() }, t('home.how.rules'));
  return section(
    'how',
    sectionHead({ id: 'how-title', eyebrow: t('home.how.eyebrow'), title: t('home.how.title'), action: rules }),
    steps(),
    ruler(data),
  );
}
