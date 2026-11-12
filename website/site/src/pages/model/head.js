// The model scores page head (models.md 页头): eyebrow "// MODEL SCORES / <vendor>",
// vendor icon + full name as the title with the star line, fields, three big
// figures with ranks (rank 1 on flare), and the buttons: 加入对比 (primary),
// 下载数据. Switching models is the side column (picker.js).
//
//   const head = createHead(headerEl, { data });
//   head.update(id, { dir })   dir: 1 a model further down, -1 further up, 0 first draw
import { h, t, pick, links, rankOf, valueOf, modelStatus, progress, fmtScore, fmtDate, fmtRank, fmtPct, modelName, modelLabel, vendorIcon } from '../../core/index.js';
import { toggleCompare, isCompared, isCompareFull, getCompare, onCompareChange, downloadCSV, downloadJSON } from '../../ui/index.js';
import { dur, durOut, css } from '../../motion.js';
import { scramble, flashDone } from '../../vendor/stellar/fx.js';

export function createHead(root, { data }) {
  const eyebrow = root.querySelector('.md-eyebrow');
  const title = root.querySelector('.md-title');
  const nameBox = root.querySelector('.md-name');
  const facts = root.querySelector('.md-facts');
  const actions = root.querySelector('.md-actions');
  const figs = root.querySelector('.md-figs');
  let id = null;

  // ---------- buttons (built once, so focus stays on them while models change) ----------
  const cmp = h('button.st-btn.go.md-compare', { type: 'button' });
  const menuId = 'md-dl-menu';
  const dl = h('button.st-btn.small.md-download', { type: 'button', popovertarget: menuId, 'aria-haspopup': 'menu' }, t('model.actions.download'));
  const item = (label, fn) => {
    const b = h('button.st-act.tb-dl-item', { type: 'button', role: 'menuitem' }, h('span', label));
    b.addEventListener('click', () => {
      menu.hidePopover?.();
      fn();
      flashDone(dl, t('model.actions.saved'));
    });
    return b;
  };
  const menu = h('div.tb-dl-menu', { id: menuId, popover: 'auto', role: 'menu' }, item(t('model.actions.csv', { n: data.tasks.length }), () => downloadCSV(csvTable())), item(t('model.actions.json'), () => downloadJSON(jsonOf(), `ai-decathlon-${id}-${data.updated}.json`)));
  menu.addEventListener('toggle', (e) => {
    if (e.newState !== 'open') return;
    const r = dl.getBoundingClientRect();
    menu.style.top = `${r.bottom + 4}px`;
    menu.style.left = `${Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.left))}px`;
  });
  actions.replaceChildren(cmp, dl, menu);

  cmp.addEventListener('click', () => {
    if (isCompared(id)) {
      toggleCompare(id, false);
      flashDone(cmp);
      return;
    }
    // added: go to the leaderboard's compare view with this model in it
    if (toggleCompare(id, true)) location.href = links.compare(getCompare());
  });
  onCompareChange(() => id && paintActions());

  function paintActions() {
    const on = isCompared(id);
    const full = !on && isCompareFull();
    cmp.textContent = on ? t('model.actions.remove') : t('model.actions.add');
    cmp.disabled = full;
    cmp.title = full ? t('model.actions.full') : on ? '' : t('model.actions.addTitle');
  }

  // ---------- figures ----------
  function fig(key, label, value, r, ranked) {
    const best = value != null && r.rank === 1;
    return h(
      'div',
      { class: [`md-fig-${key}`, best ? 'is-best' : null].filter(Boolean).join(' ') },
      h('b', fmtScore(value)),
      h('span', label),
      h('small.st-field', value == null ? (ranked ? t('model.figs.none') : t('model.figs.pending')) : r.rank == null ? t('model.figs.pending') : t('model.figs.rank', { n: r.rank })),
    );
  }

  // ---------- name: slides out towards the click, the new one comes from the other side ----------
  async function swapName(m, dir) {
    const build = () => [vendorIcon(m), modelName(m, { className: 'md-mname' })];
    if (!dir || !dur('come') || !nameBox.animate) {
      nameBox.replaceChildren(...build());
      return;
    }
    const dx = 28 * dir;
    nameBox.getAnimations().forEach((a) => a.cancel());
    const out = nameBox.animate(
      [
        { transform: 'none', opacity: 1, clipPath: 'inset(-10% -2% -10% -2%)' },
        { transform: `translateX(${-dx}px)`, opacity: 0, clipPath: dir > 0 ? 'inset(-10% 100% -10% -2%)' : 'inset(-10% -2% -10% 100%)' },
      ],
      { duration: durOut('come'), easing: css.mech, fill: 'forwards' },
    );
    await out.finished.catch(() => {});
    nameBox.replaceChildren(...build());
    out.cancel();
    nameBox.animate(
      [
        { transform: `translateX(${dx}px)`, opacity: 0, clipPath: dir > 0 ? 'inset(-10% -2% -10% 100%)' : 'inset(-10% 100% -10% -2%)' },
        { transform: 'none', opacity: 1, clipPath: 'inset(-10% -2% -10% -2%)' },
      ],
      { duration: dur('come'), easing: css.snap },
    );
  }

  function update(nextId, { dir = 0 } = {}) {
    id = nextId;
    const m = data.model(id);
    const s = data.score(id);
    const ranked = modelStatus(data, id) === 'ranked';
    const total = rankOf(data, id, 'total');
    const pr = progress(data, id);
    eyebrow.textContent = t('model.head.eyebrow', { vendor: m.vendor });
    title.setAttribute('aria-label', modelLabel(m));
    swapName(m, dir);
    facts.replaceChildren(
      ...[
        h('li', m.agent),
        h('li', m.effort),
        h('li', t('model.head.tested', { date: fmtDate(m.tested) })),
        ranked ? h('li', t('model.head.rankOf', { rank: total.rank, of: total.of })) : h('li', h('span.st-state.is-draft', t('model.head.pending'))),
        ranked ? null : h('li', t('model.head.progress', pr)),
      ].filter(Boolean),
    );
    root.classList.toggle('is-first', ranked && total.rank === 1);
    root.classList.toggle('is-pending', !ranked);
    figs.replaceChildren(
      fig('total', t('model.figs.total'), ranked ? s.total : null, total, ranked),
      fig('standard', t('model.figs.standard'), valueOf(data, id, 'standard'), rankOf(data, id, 'standard'), ranked),
      fig('design', t('model.figs.design'), valueOf(data, id, 'design'), rankOf(data, id, 'design'), ranked),
    );
    const ms = dir ? dur('scramble') : dur('scrambleLoad');
    if (ms) figs.querySelectorAll('b').forEach((b, i) => setTimeout(() => scramble(b, ms), (dir ? 120 : 160) + i * 40));
    paintActions();
  }

  // ---------- data download: this model's 10 categories and 13 tasks ----------
  function csvTable() {
    const m = data.model(id);
    const s = data.score(id);
    const columns = ['type', 'no', 'name', 'weight', 'score', 'rank', 'of'].map((k) => ({ key: k, label: t(`model.csv.${k}`) }));
    const row = (type, no, obj, measure, v) => {
      const r = rankOf(data, id, measure);
      return { type, no, name: pick(obj, 'name'), weight: fmtPct(obj.weight), score: v, rank: r.rank ?? (v == null ? '' : t('common.csv.pending')), of: r.of };
    };
    const rows = [
      ...data.categories.map((c) => row(t('model.csv.category'), '', c, c.key, s.categories?.[c.key] ?? null)),
      ...data.tasks.map((k) => row(t('model.csv.task'), fmtRank(k.no), k, k.key, s.tasks?.[k.key] ?? null)),
    ];
    return { columns, rows, preface: `${modelLabel(m)} │ ${m.vendor} │ ${m.agent}`, filename: `ai-decathlon-${id}-${data.updated}.csv` };
  }
  function jsonOf() {
    return { updated: data.updated, model: data.model(id), score: data.score(id) };
  }

  return { update, get id() { return id; } };
}
