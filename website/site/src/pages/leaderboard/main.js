// 排行总榜 /leaderboard/ (website/docs/leaderboard.md).
// Page head with three figures → sticky toolbar (vendors, search, compare,
// view switch, sort, weights, download) → one panel: the weight sandbox and
// the axis bar (sticky) over one row per model. Six views; rows keep their
// order across views (only the sort moves them). View, sort, ticks, custom
// weights, grain and the open side panel live in the address.
import './style.css';
import { boot, registerShortcut, setPanelOrder } from '../../shell/index.js';
import { h, t, pick, links, getParam, setParams, fmtDate, fmtScore, fmtRank, modelLabel, iconURL } from '../../core/index.js';
import { createToolbar, createModelList, scoreTable, getCompare, onCompareChange, showTip, hideTip } from '../../ui/index.js';
import { exportButton, rowsToSVG } from '../../charts/index.js';
import { dur, css, reduced, stagger, isInView, play } from '../../motion.js';
import { scramble } from '../../vendor/stellar/fx.js';
import { VIEWS, PASS, compute, officialWeights, isOfficial, parseWeights, formatWeights, sortKeys, headFigures } from './model.js';
import { createRows, axisChanges } from './rows.js';
import { createAxis } from './axis.js';
import { createCompare } from './compare.js';
import { createSandbox } from './sandbox.js';

boot(async ({ data }) => {
  const main = document.querySelector('main');
  const slot = main.querySelector('[data-slot="page"]');
  const factsEl = main.querySelector('[data-slot="facts"]');
  const figsEl = main.querySelector('[data-slot="figs"]');
  const noticeSlot = main.querySelector('[data-slot="notice"]');

  if (!data) {
    factsEl?.replaceChildren();
    figsEl?.replaceChildren();
    slot.replaceChildren(h('div.lb-nodata', h('span.lb-nodata-art', { 'aria-hidden': 'true', style: { '--art': `url("${iconURL.decor('orbit/orbit-nested')}")` } }), h('p', t('leaderboard.empty.noData'))));
    return;
  }

  // ---------------- state (from the address) ----------------
  const sorts = sortKeys(data);
  const view0 = VIEWS.includes(getParam('view')) ? getParam('view') : 'total';
  const w0 = parseWeights(data, getParam('w'));
  const state = {
    view: view0,
    lastRowView: view0 === 'compare' ? 'total' : view0,
    sort: sorts.includes(getParam('sort')) ? getParam('sort') : 'total',
    cols: getParam('cols') === 'task' ? 'task' : 'category',
    sliders: w0 ?? officialWeights(data),
    custom: !!w0 && !isOfficial(data, w0),
    dragging: false,
  };
  let C = compute(data, state);
  let frozen = null; // ranks shown while a slider is being dragged
  const computed = () => C;

  const sortName = (k) => (k === 'total' ? t('common.score.total') : k === 'standard' || k === 'design' ? t(`common.kind.${k}`) : pick(data.category(k), 'name'));
  const viewName = (v) => t(`leaderboard.views.${v}`);

  // ---------------- page head ----------------
  factsEl.replaceChildren(
    h('li', t('leaderboard.facts.tasks', { n: data.tasks.length })),
    h('li', t('leaderboard.facts.cats', { n: data.categories.length })),
    h('li', h('time', { datetime: data.updated }, t('leaderboard.facts.updated', { date: fmtDate(data.updated) }))),
  );
  const F = headFigures(data);
  const fig = (value, label, sub) => h('div', h('b.num', { 'data-fig': '' }, value), h('span', label), sub ? h('small', sub) : null);
  figsEl.replaceChildren(
    fig(String(F.models), t('leaderboard.figs.models'), F.testing ? t('leaderboard.figs.testing', { n: F.testing }) : null),
    fig(String(F.pass), t('leaderboard.figs.pass', { n: PASS })),
    fig(F.gap == null ? '—' : fmtScore(F.gap), F.n >= 3 ? t('leaderboard.figs.gap') : t('leaderboard.figs.gapN', { n: F.n })),
  );

  // ---------------- toolbar ----------------
  const currentIds = () => [...list.el.querySelectorAll(':scope > li.mrow')].map((li) => li.dataset.id);
  const csvTable = () => {
    let entries;
    if (state.view === 'compare') entries = getCompare().filter((id) => data.model(id)).map((id) => ({ id, model: data.model(id), rank: C.info.get(id)?.totalRank ?? null }));
    else entries = currentIds().map((id) => ({ id, model: data.model(id), rank: C.info.get(id)?.sortRank ?? null }));
    return scoreTable(data, entries, { weights: state.custom ? C.weights : undefined });
  };
  // the view row is long (six views, sort, weights, download): let it wrap on narrow windows
  const tb = createToolbar({ data, download: { csv: csvTable, json: true }, wrap: true });

  // view switch: a segmented control whose current block slides (← → move it)
  const segInk = h('span.lb-seg-ink', { 'aria-hidden': 'true' });
  const seg = h(
    'div.st-seg.lb-views',
    { role: 'radiogroup', 'aria-label': t('leaderboard.views.label') },
    segInk,
    VIEWS.map((v, i) =>
      h(
        'label',
        { title: t('leaderboard.views.keyTitle', { name: viewName(v), key: i + 1 }), dataset: { view: v } },
        h('input', { type: 'radio', name: 'lb-view', value: v, checked: v === state.view, 'aria-keyshortcuts': String(i + 1), onchange: () => switchView(v) }),
        h('span', viewName(v)),
      ),
    ),
  );
  const sortSel = h(
    'select.lb-sort-select',
    { 'aria-label': t('leaderboard.sort.label') },
    sorts.map((k) => h('option', { value: k, selected: k === state.sort }, sortName(k))),
  );
  sortSel.addEventListener('change', () => setSort(sortSel.value));
  const sortBox = h('label.lb-sort', h('span.lb-sort-lab', t('leaderboard.sort.label')), h('span.lb-sort-box', sortSel));
  tb.slots.top.append(seg, sortBox);

  const wBtn = h(
    'button.st-btn.small.lb-wbtn',
    { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'lb-sandbox', 'aria-keyshortcuts': 'W', title: t('leaderboard.sandbox.buttonTitle') },
    t('leaderboard.sandbox.button'),
  );
  wBtn.addEventListener('click', () => toggleSandbox());
  tb.slots.end.prepend(wBtn);
  // weights and download sit at the right end of the view row, so the toolbar stays two rows high
  tb.slots.top.append(tb.slots.end);

  // ---------------- the board ----------------
  const eyebrow = h('span.st-eyebrow');
  const vTitle = h('span.lb-vtitle');
  const question = h('span.lb-q');
  const colsSeg = h(
    'div.st-seg.lb-cols',
    { role: 'radiogroup', 'aria-label': t('leaderboard.cols.label') },
    ['category', 'task'].map((k) =>
      h('label', h('input', { type: 'radio', name: 'lb-cols', value: k, checked: k === state.cols, onchange: () => setCols(k) }), h('span', t(`leaderboard.cols.${k}`))),
    ),
  );
  const exportBtn = exportButton({
    build: () => buildExport(),
    title: () => [t('leaderboard.title'), viewName(state.view), state.custom ? t('common.score.custom') : ''].filter(Boolean).join(' │ '),
    filename: () => `ai-octathlon-leaderboard-${state.view}${state.custom ? '-custom' : ''}`,
  });
  const boardHead = h('div.lb-board-head', h('h2.lb-board-title#lb-board-title', h('span.st-pair', eyebrow, vTitle), question), h('div.lb-board-tools', colsSeg, exportBtn));

  const axis = createAxis({ data, state, computed, onFocus: (k) => state.view === 'parts' && rows.setFocus(k) });
  const hRank = h('span.mrow-rank.lb-h-rank');
  const hName = h('span.mrow-name.lb-h-name');
  const hScore = h('span.mrow-score.lb-h-score');
  const headRow = h('div.mrow.mrow-head.lb-axisrow', h('span.mrow-check'), hRank, h('span.mrow-icon'), hName, h('span.mrow-plot.lb-h-plot', axis.svg), hScore);

  const sandbox = createSandbox({
    data,
    state,
    onInput: () => weightsInput(),
    onCommit: () => weightsCommit(260),
    onPreset: () => weightsCommit(0),
  });
  const sticky = h('div.lb-sticky', sandbox.el, headRow);
  const ol = h('ol.lb-list');
  const compare = createCompare({ data, state, width: () => rows.width, onBack: () => switchView(state.lastRowView || 'total') });
  // the matrix for screen readers: a real table (the cells on screen are drawn, aria-hidden)
  const srMatrix = h('div.sr-only.lb-sr-matrix');
  const board = h('section.st-panel.lb-board', { 'aria-labelledby': 'lb-board-title', dataset: { view: state.view } }, boardHead, sticky, ol, srMatrix, compare.el);
  const foot = h('p.lb-foot.st-field', h('a', { href: links.about('scoring-1') }, t('leaderboard.foot', { n: data.categories.length })));
  slot.replaceChildren(tb.el, board, foot);

  // ---------------- rows ----------------
  const list = createModelList(ol, {
    data,
    kind: 'series',
    rank: (cell, entry, ctx) => paintRow(ctx.row, entry, ctx),
    plot: (cell, entry, ctx) => rows.plot(cell, entry, ctx),
    empty: t('common.toolbar.noMatch'),
  });
  const rows = createRows({ data, state, computed, list });

  function entries({ keepOrder = false } = {}) {
    const ids = keepOrder ? currentIds() : C.order.filter((id) => tb.matches(id));
    return ids.map((id) => {
      const it = C.info.get(id);
      const rank = frozen ? frozen.info.get(id)?.totalRank ?? null : it.totalRank;
      return { id, model: it.model, value: it.total, rank, ranked: it.total != null };
    });
  }

  // rank cell (the shared rank hook): the rank by the chosen sort, with the custom-weights move or the sort value beside it
  function paintRow(li, entry, ctx) {
    const src = frozen ?? C;
    const it = src.info.get(entry.id);
    const now = C.info.get(entry.id);
    if (!it || !now) return;
    const rankCell = li.querySelector('.mrow-rank');
    const sr = li.querySelector('.mrow-sr');
    const name = modelLabel(it.model);
    let rank;
    let sub = '';
    let cls = '';
    if (state.sort === 'total') {
      rank = it.totalRank;
      if (state.custom && rank != null && it.delta) {
        sub = `${it.delta > 0 ? '▲' : '▼'}${Math.abs(it.delta)}`;
        cls = it.delta > 0 ? 'is-up' : 'is-down';
      }
    } else {
      rank = it.sortRank;
      if (rank != null) sub = fmtScore(it.sortValue);
    }
    if (rank != null) {
      const before = li.dataset.sub ?? '';
      const small = sub ? h('small.lb-rank-sub', { class: cls || null }, sub) : null;
      rankCell.replaceChildren(...[h('b.lb-rank-n', fmtRank(rank)), small].filter(Boolean));
      if (small && before !== sub && !ctx.first && state.sort === 'total' && !reduced()) small.classList.add('st-in-wipe');
      li.dataset.sub = sub;
    } else {
      rankCell.replaceChildren(h('span.st-state.is-draft', t('common.score.pending')));
      li.dataset.sub = '';
    }
    // what a screen reader hears for the row
    const score = fmtScore(now.total);
    if (now.total == null && state.sort === 'total') return;
    if (state.sort === 'total') sr.textContent = t('leaderboard.row.aria', { rank: it.totalRank, name, label: state.custom ? t('common.score.custom') : t('common.score.total'), score });
    else
      sr.textContent =
        rank == null
          ? t('leaderboard.row.ariaSortNone', { by: sortName(state.sort), name, score })
          : t('leaderboard.row.ariaSort', { by: sortName(state.sort), rank, name, value: fmtScore(it.sortValue), score });
  }

  // ---------------- measuring ----------------
  const probe = h('li.mrow', h('span.mrow-check'), h('span.mrow-rank'), h('span.mrow-icon'), h('span.mrow-name'), h('span.mrow-plot'), h('span.mrow-score'));
  function measure() {
    ol.append(probe);
    const hh = probe.querySelector('.mrow-plot').clientHeight;
    probe.remove();
    const changed = rows.measure(headRow.querySelector('.mrow-plot'), hh);
    axis.setWidth(rows.width);
    return changed;
  }

  // ---------------- painting the frame around the rows ----------------
  function paintHeads() {
    const v = state.view;
    eyebrow.textContent = t(`leaderboard.viewsEn.${v}`);
    vTitle.textContent = viewName(v);
    question.textContent = t(`leaderboard.viewQ.${v}`);
    colsSeg.hidden = !(v === 'matrix' || v === 'compare');
    sortSel.disabled = v === 'compare';
    sortBox.title = v === 'compare' ? t('leaderboard.sort.compareOff') : '';
    if (v === 'compare') {
      hRank.replaceChildren();
      hName.textContent = t('leaderboard.head.item');
      hScore.textContent = t('leaderboard.compare.diffHead');
    } else {
      hRank.replaceChildren(...[h('span', t('leaderboard.head.rank')), state.sort !== 'total' ? h('small.lb-h-by', pick(data.category(state.sort) ?? {}, 'short') || sortName(state.sort)) : null].filter(Boolean));
      hName.textContent = t('leaderboard.head.model');
      hScore.textContent = state.custom ? t('common.score.custom') : t('common.score.total');
    }
    board.dataset.view = v;
  }

  function syncSeg({ animate = true } = {}) {
    for (const inp of seg.querySelectorAll('input')) inp.checked = inp.value === state.view;
    const lab = seg.querySelector(`label[data-view="${state.view}"]`);
    if (!lab) return;
    const x = lab.offsetLeft;
    const w = lab.offsetWidth;
    segInk.style.transition = animate && !reduced() ? `transform ${dur('morph')}ms ${css.mech}, width ${dur('morph')}ms ${css.mech}` : 'none';
    segInk.style.transform = `translateX(${x}px)`;
    segInk.style.width = `${w}px`;
  }

  let customShown = null;
  function paintNotice() {
    if (customShown === state.custom) return;
    customShown = state.custom;
    noticeSlot.replaceChildren(
      state.custom
        ? h(
            'p.st-notice.lb-notice',
            { 'data-flag': t('leaderboard.notice.flag'), role: 'status', class: reduced() ? null : 'st-in-wipe' },
            h('span', t('leaderboard.notice.text')),
            h('button.st-btn.small', { type: 'button', onclick: () => resetWeights() }, t('leaderboard.sandbox.reset')),
          )
        : '',
    );
  }

  // ---------------- updates ----------------
  function refresh({ animate = true } = {}) {
    list.update(entries(), { animate });
    setPanelOrder(C.order.filter((id) => tb.matches(id)));
    paintSrMatrix();
  }

  function paintSrMatrix() {
    if (state.view !== 'matrix') {
      srMatrix.replaceChildren();
      return;
    }
    const byTask = state.cols === 'task';
    const cols = byTask ? data.tasks : data.categories;
    const label = (k) => (byTask ? `${String(k.no).padStart(2, '0')} ${pick(k, 'name')}` : pick(k, 'name'));
    srMatrix.replaceChildren(
      h(
        'table',
        h('caption', viewName('matrix')),
        h('thead', h('tr', h('th', { scope: 'col' }, t('leaderboard.head.model')), cols.map((k) => h('th', { scope: 'col' }, label(k))))),
        h(
          'tbody',
          C.order.filter((id) => tb.matches(id)).map((id) => {
            const it = C.info.get(id);
            return h(
              'tr',
              h('th', { scope: 'row' }, modelLabel(it.model)),
              cols.map((k) => {
                const v = byTask ? it.tasks[k.key] : it.cats[k.key];
                return h('td', v == null ? t('common.score.none') : fmtScore(v));
              }),
            );
          }),
        ),
      ),
    );
  }

  function setSort(k) {
    if (!sorts.includes(k) || k === state.sort) return;
    state.sort = k;
    sortSel.value = k;
    setParams({ sort: k === 'total' ? null : k });
    C = compute(data, state);
    paintHeads();
    refresh();
    if (!reduced())
      setTimeout(() => {
        for (const li of list.rows.values()) if (isInView(li)) li.querySelector('.lb-rank-n') && scramble(li.querySelector('.lb-rank-n'), dur('scramble'));
      }, 60);
  }

  function setCols(k) {
    if (k === state.cols) return;
    state.cols = k;
    setParams({ cols: k === 'task' ? k : null });
    for (const inp of colsSeg.querySelectorAll('input')) inp.checked = inp.value === k;
    if (state.view === 'matrix') {
      axis.render('matrix', { animate: true });
      rows.redrawAll('switch', { from: 'matrix' });
      paintSrMatrix();
    } else if (state.view === 'compare') compare.render({ animate: true });
  }

  let viewToken = 0;
  async function leaveRows() {
    const els = [...list.rows.values()].filter((li) => isInView(li));
    const step = stagger('row', els.length, 120);
    await Promise.all(els.map((li, i) => play(li, [{ opacity: 1, clipPath: 'inset(0)' }, { opacity: 0, clipPath: 'inset(0 0 0 100%)' }], { duration: 'rowOut', easing: 'mech', delay: i * step, fill: 'forwards' })));
    for (const li of els) li.getAnimations().forEach((a) => a.cancel());
  }
  async function leaveCompare() {
    const els = [...compare.el.querySelectorAll('tr.lb-cmp-row')].filter((tr) => isInView(tr));
    const step = stagger('row', els.length, 120);
    await Promise.all(els.map((tr, i) => play(tr, [{ opacity: 1, clipPath: 'inset(0)' }, { opacity: 0, clipPath: 'inset(0 0 0 100%)' }], { duration: 'rowOut', easing: 'mech', delay: i * step, fill: 'forwards' })));
  }
  function rowsComeIn() {
    if (reduced()) return;
    const els = [...list.rows.values()].filter((li) => isInView(li));
    els.forEach((li, i) => {
      li.classList.remove('st-in-come');
      void li.offsetWidth;
      li.style.setProperty('--i', i);
      li.style.animationDelay = `${i * stagger('row', els.length, 300)}ms`;
      li.classList.add('st-in-come');
      li.addEventListener(
        'animationend',
        () => {
          li.classList.remove('st-in-come');
          li.style.animationDelay = '';
        },
        { once: true },
      );
    });
  }

  async function switchView(next) {
    if (!VIEWS.includes(next) || next === state.view) {
      syncSeg();
      return;
    }
    const prev = state.view;
    const my = ++viewToken;
    state.view = next;
    if (next !== 'compare') state.lastRowView = next;
    setParams({ view: next === 'total' ? null : next });
    hideTip();
    rows.setFocus(null);
    syncSeg();
    if (next === 'compare') srMatrix.replaceChildren();
    if (next === 'compare') {
      paintHeads();
      board.dataset.view = prev; // rows stay until they have folded away
      axis.render('compare', { animate: axisChanges(prev, 'compare') });
      await leaveRows();
      if (my !== viewToken) return;
      board.dataset.view = 'compare';
      compare.el.hidden = false;
      compare.render({ animate: true });
      return;
    }
    if (prev === 'compare') {
      await leaveCompare();
      if (my !== viewToken) return;
      compare.el.hidden = true;
      paintHeads();
      axis.render(next, { animate: true });
      rows.redrawAll('static');
      rowsComeIn();
      paintSrMatrix();
      setPanelOrder(currentIds());
      return;
    }
    paintHeads();
    axis.render(next, { animate: axisChanges(prev, next) });
    rows.redrawAll('switch', { from: prev });
    paintSrMatrix();
  }

  // ---------------- weights ----------------
  function weightsInput() {
    if (!state.dragging) {
      state.dragging = true;
      frozen = C;
    }
    state.custom = !isOfficial(data, state.sliders);
    C = compute(data, state);
    list.update(entries({ keepOrder: true }), { animate: false });
    if (state.view === 'parts' || state.view === 'pass') axis.render(state.view);
    paintHeads();
  }
  let commitTimer = 0;
  function weightsCommit(wait) {
    clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      state.dragging = false;
      frozen = null;
      state.custom = !isOfficial(data, state.sliders);
      C = compute(data, state);
      setParams({ w: state.custom ? formatWeights(data, state.sliders) : null });
      paintHeads();
      paintNotice();
      if (state.view !== 'compare') axis.render(state.view);
      refresh();
    }, reduced() ? 0 : wait);
  }
  function resetWeights() {
    state.sliders = officialWeights(data);
    sandbox.sync();
    weightsCommit(0);
  }
  function toggleSandbox(force) {
    const open = force ?? !sandbox.open;
    if (open === sandbox.open) return;
    wBtn.setAttribute('aria-expanded', String(open));
    wBtn.classList.toggle('is-on', open);
    if (open) {
      sandbox.setOpen(true);
      play(sandbox.el, [{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], { duration: 'expand', easing: 'mech', fill: 'none' });
      // bring it into view when it opened above the screen
      const r = board.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) board.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    } else {
      play(sandbox.el, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: Math.round(dur('expand') * 0.66), easing: 'mech', fill: 'none' }).then(() => sandbox.setOpen(false));
      if (reduced()) sandbox.setOpen(false);
    }
  }

  // ---------------- export ----------------
  async function buildExport() {
    board.classList.add('is-exporting');
    try {
      const els = state.view === 'compare' ? [...compare.el.querySelectorAll('tr.lb-cmp-row')] : [...ol.querySelectorAll(':scope > li.mrow')];
      return await rowsToSVG([headRow, ...els]);
    } finally {
      board.classList.remove('is-exporting');
    }
  }

  // ---------------- events ----------------
  tb.on('change', () => {
    if (state.view !== 'compare') refresh();
  });
  tb.on('compare', () => switchView('compare'));
  onCompareChange((ids) => {
    setParams({ cmp: ids });
    if (state.view === 'compare') compare.render();
    else if (state.view === 'kinds') rows.redrawAll('update');
  });

  // tooltip for the graphics; the breakdown focuses the category under the pointer
  ol.addEventListener('pointermove', (e) => {
    const li = e.target.closest('li.mrow');
    if (!li || !e.target.closest('.mrow-plot')) {
      hideTip();
      if (state.view === 'parts') rows.setFocus(null);
      return;
    }
    if (state.view === 'parts') rows.setFocus(e.target.closest('.lb-seg')?.dataset.cat ?? null);
    showTip(rows.tip(li, e.target), { x: e.clientX, y: e.clientY - 8 });
  });
  ol.addEventListener('pointerleave', () => {
    hideTip();
    if (state.view === 'parts') rows.setFocus(null);
  });
  ol.addEventListener('focusin', (e) => {
    const li = e.target.closest('li.mrow');
    if (li) showTip(rows.tip(li, null), li.querySelector('.mrow-plot'));
  });
  ol.addEventListener('focusout', () => hideTip());
  // a click on a row (the matrix cells included) opens the side panel through the row's
  // data-model-panel (shell/panel.js), in the order set by setPanelOrder; the name is a link to the model page

  // keyboard: 1–6 views, W weights, C compare (listed under "本页" in the ? sheet)
  VIEWS.forEach((v, i) => registerShortcut({ key: String(i + 1), label: t('leaderboard.keys.view', { name: viewName(v) }), handler: () => switchView(v) }));
  registerShortcut({ key: 'w', label: t('leaderboard.keys.weights'), handler: () => toggleSandbox() });
  registerShortcut({ key: 'c', label: t('leaderboard.keys.compare'), handler: () => switchView('compare') });

  // sticky: the axis bar sits right under the toolbar
  const setTbH = () => main.style.setProperty('--lb-tb-h', `${tb.el.offsetHeight}px`);
  new ResizeObserver(setTbH).observe(tb.el);
  setTbH();
  new ResizeObserver(() => {
    if (!measure()) return;
    axis.render(state.view);
    rows.redrawAll('static');
    if (state.view === 'compare') compare.render();
    syncSeg({ animate: false });
  }).observe(headRow.querySelector('.mrow-plot'));

  // ---------------- first paint ----------------
  paintHeads();
  paintNotice();
  sandbox.sync();
  if (w0) toggleSandbox(true);
  measure();
  syncSeg({ animate: false });
  axis.render(state.view);
  const animateIn = !reduced();
  if (animateIn) {
    board.classList.add('st-in-power');
    board.addEventListener('animationend', () => board.classList.remove('st-in-power'), { once: true });
    axis.svg.animate?.([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -40px 0 0)' }], { duration: dur('wipe'), delay: 200, easing: css.mech, fill: 'backwards' });
  }
  if (state.view === 'compare') {
    list.update(entries(), { animate: false });
    compare.el.hidden = false;
    compare.render({ animate: animateIn });
  } else list.update(entries(), { animate: animateIn });
  paintSrMatrix();
  rows.markEntered();
  setPanelOrder(currentIds());

  // readouts settle: the head figures, then the score column
  if (animateIn) {
    figsEl.querySelectorAll('[data-fig]').forEach((b, i) => setTimeout(() => scramble(b, dur('scrambleLoad')), 120 + i * 40));
    const vis = [...list.rows.values()].filter((li) => isInView(li));
    const step = stagger('row', vis.length, 180);
    vis.forEach((li, i) => setTimeout(() => scramble(li.querySelector('.mrow-score'), dur('scrambleLoad')), 380 + i * step));
  }
});
