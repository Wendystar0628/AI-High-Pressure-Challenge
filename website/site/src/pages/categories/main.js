// 题目类别榜 /categories/ (website/docs/categories.md), a console page:
// page head → toolbar + category jump bar (sticky together) → 8 category
// boards in two groups (standard / design), each a bar chart of model rows
// ranked inside the category. URL: ?tasks=reason,algo (open sub rows) + #<key>.
import './style.css';
import { boot, registerShortcut } from '../../shell/index.js';
import { h, t, pick, fmtDate, fmtPct, fmtRank, getListParam, setParams, modelLabel } from '../../core/index.js';
import { createToolbar } from '../../ui/index.js';
import { dur, isInView } from '../../motion.js';
import { scramble } from '../../vendor/stellar/fx.js';
import { createBoard } from './board.js';
import { createJumpBar } from './jumpbar.js';

boot(({ data }) => {
  const main = document.querySelector('main');
  const slot = main.querySelector('[data-slot="page"]');
  if (!data) {
    slot.replaceChildren();
    return;
  }

  main.querySelector('[data-slot="facts"]').replaceChildren(
    h('li', t('common.unit.categoriesShort', { n: data.categories.length })),
    h('li', t('common.unit.tasksShort', { n: data.tasks.length })),
    h('li', t('common.unit.models', { n: data.models.length })),
    h('li', t('categories.head.updated', { date: fmtDate(data.updated) })),
  );

  // ---------- state from the address ----------
  const multi = new Set(data.categories.filter((c) => c.tasks.length > 1).map((c) => c.key));
  const open = new Set(getListParam('tasks').filter((k) => multi.has(k)));
  const writeOpen = () => setParams({ tasks: data.categories.map((c) => c.key).filter((k) => open.has(k)) });

  // ---------- toolbar + jump bar ----------
  const tb = createToolbar({ data, download: { csv: csvTable, json: true } });
  const jump = createJumpBar(data, { onGo: (key) => goTo(key, { smooth: true, push: true }) });
  // the jump bar rides in the toolbar's bottom slot, so the two stick together
  tb.slots.bottom.append(jump.el);
  const sticky = tb.el;

  // ---------- boards in two groups ----------
  // the model tested last: one being tested, else the latest test date; on the same date the later registration
  const stamp = (m) => `${data.score(m.id).status === 'testing' ? 1 : 0}|${m.tested ?? ''}`;
  const focus = data.models.reduce((a, m) => (!a || stamp(m) >= stamp(a) ? m : a), null)?.id;
  const below = (el) => [...main.querySelectorAll('[data-flip]')].filter((x) => x !== el && x.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING && isInView(x));
  const boards = data.categories.map((c, i) =>
    createBoard(c, {
      data,
      tb,
      index: i,
      open: open.has(c.key),
      below,
      focus,
      onToggle: (key, on) => {
        on ? open.add(key) : open.delete(key);
        writeOpen();
      },
    }),
  );
  const byKey = new Map(boards.map((b) => [b.key, b]));

  const groupEls = [];
  let prevKind = null;
  for (const c of data.categories) {
    if (c.kind !== prevKind) {
      const cats = data.categories.filter((x) => x.kind === c.kind);
      const nTasks = cats.reduce((a, x) => a + x.tasks.length, 0);
      const weight = cats.reduce((a, x) => a + x.weight, 0);
      if (prevKind) groupEls.push(h('div.cat-divider', { 'aria-hidden': 'true', dataset: { flip: '' } }));
      groupEls.push(
        h(
          'header.cat-group-head',
          { id: `group-${c.kind}`, dataset: { flip: '' } },
          h('h2.st-pair', h('span.st-eyebrow.slash', t(`categories.group.${c.kind}Eyebrow`)), h('span', t(`common.kind.${c.kind}`))),
          h(
            'ul.st-facts.st-field',
            h('li', t('common.unit.categoriesShort', { n: cats.length })),
            h('li', t('common.unit.tasksShort', { n: nTasks })),
            h('li', t('categories.group.weight', { w: fmtPct(weight) })),
          ),
        ),
      );
      prevKind = c.kind;
    }
    groupEls.push(byKey.get(c.key).el);
  }

  slot.replaceChildren(sticky, h('div.cat-boards', groupEls));

  // keep the boards clear of the sticky pair when jumped to
  new ResizeObserver(() => main.style.setProperty('--cat-sticky-h', `${sticky.offsetHeight}px`)).observe(sticky);
  main.style.setProperty('--cat-sticky-h', `${sticky.offsetHeight}px`);

  // ---------- first draw ----------
  const hashKey = decodeURIComponent(location.hash.slice(1));
  const arriving = byKey.has(hashKey);
  const first = arriving ? [] : boards.filter((b) => isInView(b.el));
  first.forEach((b, i) => {
    if (!dur('power')) return;
    b.el.classList.add('st-in-power');
    b.el.style.setProperty('--i', i);
    b.el.addEventListener('animationend', () => b.el.classList.remove('st-in-power'), { once: true });
  });
  for (const b of boards) b.refresh({ animate: !arriving && first.includes(b) });
  // readouts settle on the first screen
  if (!arriving && dur('scrambleLoad')) {
    const scores = first.flatMap((b) => [...b.el.querySelectorAll('.mrow-score')].filter(isInView));
    scores.forEach((s, i) => setTimeout(() => scramble(s, dur('scrambleLoad')), 160 + i * 12));
  }

  // ---------- jumping and the current item ----------
  // where the sticky pair ends once it is stuck under the command bar
  // (phone width: the toolbar scrolls away, only the command bar stays)
  const stickBottom = () => {
    const cs = getComputedStyle(sticky);
    return cs.position === 'sticky' ? (parseFloat(cs.top) || 0) + sticky.offsetHeight : (document.querySelector('.site-bar')?.offsetHeight ?? 0);
  };
  let lock = null;
  let lockTimer = 0;

  function arrive(board) {
    board.el.classList.remove('is-arrived');
    void board.el.offsetWidth;
    board.el.classList.add('is-arrived');
    setTimeout(() => board.el.classList.remove('is-arrived'), dur('tab') + 900);
  }

  function goTo(key, { smooth = false, push = false } = {}) {
    const b = byKey.get(key);
    if (!b) return;
    if (push) history.replaceState(history.state, '', `${location.pathname}${location.search}#${key}`);
    jump.setCurrent(key);
    const behavior = smooth && dur('come') ? 'smooth' : 'instant';
    lock = key;
    clearTimeout(lockTimer);
    const done = () => {
      if (lock !== key) return;
      lock = null;
      removeEventListener('scrollend', done);
      arrive(b);
    };
    scrollTo({ top: Math.max(0, b.el.getBoundingClientRect().top + scrollY - stickBottom() - 16), behavior });
    b.el.focus({ preventScroll: true });
    if (behavior === 'smooth') {
      addEventListener('scrollend', done, { once: true });
      lockTimer = setTimeout(done, 1400);
    } else done();
  }

  function spy() {
    if (lock) return;
    // the board that crosses a line a quarter of the way down the visible area
    const top = stickBottom();
    const line = top + Math.max(48, (innerHeight - top) * 0.25);
    const crossing = boards.find((b) => b.el.getBoundingClientRect().bottom > line);
    let cur = (crossing ?? boards[boards.length - 1]).key;
    // at the very bottom the last boards may never reach the line
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) {
      const visible = boards.filter((b) => b.el.getBoundingClientRect().top < innerHeight - 80);
      if (visible.length) cur = visible[visible.length - 1].key;
    }
    jump.setCurrent(cur);
  }
  let raf = 0;
  addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(() => ((raf = 0), spy()));
  }, { passive: true });
  addEventListener('hashchange', () => {
    const key = decodeURIComponent(location.hash.slice(1));
    if (byKey.has(key)) goTo(key, { smooth: false });
  });

  if (arriving) goTo(hashKey);
  else spy();

  // ---------- filter, search, compare ----------
  tb.on('change', () => boards.forEach((b) => b.refresh({ animate: true })));

  registerShortcut({
    key: 'c',
    label: t('categories.keys.compare'),
    handler: () => tb.el.querySelector('.tb-compare:not(:disabled)')?.click(),
  });

  // ---------- CSV: models × 8 categories (+ the tasks of open categories) ----------
  function csvTable() {
    const columns = [
      { key: 'model', label: t('common.csv.model') },
      { key: 'vendor', label: t('common.csv.vendor') },
    ];
    for (const c of data.categories) {
      columns.push({ key: `c:${c.key}`, label: pick(c, 'name') });
      if (byKey.get(c.key)?.open) for (const k of c.tasks) columns.push({ key: `t:${k.key}`, label: `${fmtRank(k.no)} ${pick(k, 'name')}` });
    }
    const rows = data.order
      .map((id) => data.model(id))
      .filter((m) => tb.matches(m))
      .map((m) => {
        const s = data.score(m.id);
        const r = { model: modelLabel(m), vendor: m.vendor };
        for (const c of data.categories) {
          r[`c:${c.key}`] = s.categories?.[c.key];
          for (const k of c.tasks) r[`t:${k.key}`] = s.tasks?.[k.key];
        }
        return r;
      });
    return { columns, rows };
  }
});
