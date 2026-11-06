// The toolbar above every leaderboard (leaderboard.md「共用部件 / 工具条」).
// Sticky under the command bar. Left: vendor filter chips (multi-select,
// "全部" clears); middle: model search (this page's rows only, not the site
// search); right: the ticked models (index + short name; click to untick),
// the primary "对比" button and "下载数据".
//
//   const tb = createToolbar({ data, download: { csv: () => scoreTable(...), json: true } });
//   container.append(tb.el);
//   tb.on('change', () => list.update(rankBy(data, 'total').filter((e) => tb.matches(e.model))));
//   tb.on('compare', ({ ids }) => …)      // leaderboard: switch to its compare view
//                                          // without a listener: go to /leaderboard/?view=compare&cmp=…
//   tb.slots.top / tb.slots.end           // put the view switch and sort select here (leaderboard)
//   tb.slots.bottom                        // a row under the toolbar that sticks with it (题目类别榜的跳转条)
//   createToolbar({ wrap: true })          // let the rows wrap onto more lines; by default each row
//                                          // stays on one line and the model search narrows first
//
// Filtering and searching only hide rows; they never change ranks.
import { h } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { links } from '../core/route.js';
import { vendorIcon, modelLabel } from '../core/names.js';
import { getCompare, toggleCompare, onCompareChange, MAX_COMPARE } from './compare.js';
import { downloadCSV, downloadJSON, downloadBundle } from './download.js';
import { flashDone } from '../vendor/stellar/fx.js';

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');
const MAX_VENDOR_CHIPS = 6;

/**
 * Options:
 *   data        loadData() result (required)
 *   vendors     show the vendor filter (default true)
 *   search      show the model search (default true)
 *   compare     show ticked models and the 对比 button (default true)
 *   download    null | { csv: () => ({ columns, rows, preface }), json: true | () => object }
 *   wrap        false (default): every row stays on one line, the search field narrows;
 *               true: rows may wrap onto more lines (many vendors, long labels)
 * Returns { el, slots: { top, end, bottom }, state: { vendors:Set, query }, matches(model|id), on(type, fn), setQuery(q), clear() }
 * Events: 'change' (filter or search changed), 'compare' ({ ids })
 */
export function createToolbar({ data, vendors = true, search = true, compare = true, download = null, wrap = false } = {}) {
  const events = new EventTarget();
  const state = { vendors: new Set(), query: '' };
  const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));

  const top = h('div.tb-top');
  const end = h('div.tb-end');
  const left = h('div.tb-left');
  const right = h('div.tb-right');
  const bottom = h('div.tb-bottom');
  const el = h('div.site-toolbar', { role: 'toolbar', 'aria-label': t('common.toolbar.label'), class: wrap ? 'is-wrap' : null }, top, h('div.tb-main', left, right, end), bottom);
  // the top and bottom slots show only when something is put in them
  for (const slot of [top, bottom]) {
    slot.hidden = true;
    new MutationObserver(() => (slot.hidden = !slot.childElementCount)).observe(slot, { childList: true });
  }

  // vendor chips
  if (vendors && data.vendors.length > 1) {
    const all = h('button.st-chip', { type: 'button', 'aria-pressed': 'true' }, t('common.toolbar.all'), h('span.n', String(data.models.length)));
    const chip = (v) => {
      const b = h('button.st-chip', { type: 'button', 'aria-pressed': 'false', dataset: { vendor: v.vendor } }, vendorIcon(v.logo), v.vendor, h('span.n', String(v.count)));
      b.addEventListener('click', () => {
        state.vendors.has(v.vendor) ? state.vendors.delete(v.vendor) : state.vendors.add(v.vendor);
        paint();
        emit('change', { ...state });
      });
      return b;
    };
    const chips = data.vendors.map(chip);
    const shown = chips.slice(0, MAX_VENDOR_CHIPS);
    const more = chips.slice(MAX_VENDOR_CHIPS);
    const group = h('div.tb-vendors', { role: 'group', 'aria-label': t('common.toolbar.vendors') }, all, shown);
    if (more.length) group.append(h('details.tb-more', h('summary.st-chip', t('common.toolbar.moreVendors'), h('span.n', String(more.length))), h('div.tb-more-list', more)));
    all.addEventListener('click', () => {
      state.vendors.clear();
      paint();
      emit('change', { ...state });
    });
    function paint() {
      all.setAttribute('aria-pressed', String(state.vendors.size === 0));
      for (const c of chips) c.setAttribute('aria-pressed', String(state.vendors.has(c.dataset.vendor)));
    }
    left.append(group);
  }

  // model search
  let input = null;
  if (search) {
    input = h('input', { type: 'search', placeholder: t('common.toolbar.search'), 'aria-label': t('common.toolbar.searchLabel'), autocomplete: 'off', spellcheck: 'false' });
    input.addEventListener('input', () => {
      state.query = input.value;
      emit('change', { ...state });
    });
    left.append(h('label.st-search.tb-search', input));
  }

  // ticked models + compare
  if (compare) {
    const tray = h('div.tb-tray', { 'aria-live': 'polite' });
    const btn = h('button.st-btn.small.go.tb-compare', { type: 'button', title: t('common.toolbar.compareTitle'), 'aria-keyshortcuts': 'C' }, t('common.toolbar.compare'));
    btn.addEventListener('click', () => {
      const ids = getCompare();
      if (events.__hasCompare) emit('compare', { ids });
      else location.href = links.compare(ids);
    });
    const paintTray = () => {
      const ids = getCompare();
      tray.replaceChildren(
        ...ids.map((id, i) => {
          const m = data.model(id);
          if (!m) return '';
          const b = h('button.st-chip.tb-slot', { type: 'button', title: t('common.toolbar.compareRemove', { name: modelLabel(m) }) }, h('b', String(i + 1).padStart(2, '0')), m.short || m.name);
          b.addEventListener('click', () => toggleCompare(id, false));
          return b;
        }),
      );
      if (!ids.length) tray.append(h('span.tb-hint.st-field', t('common.toolbar.compareHint')));
      btn.disabled = ids.length < 2;
      btn.title = ids.length < 2 ? t('common.toolbar.compareHint') : t('common.toolbar.compareTitle');
    };
    onCompareChange(paintTray);
    paintTray();
    right.append(tray, btn);
  }

  // download
  if (download) {
    const menuId = `tb-dl-${Math.random().toString(36).slice(2, 8)}`;
    const btn = h('button.st-btn.small.tb-download', { type: 'button', popovertarget: menuId, 'aria-haspopup': 'menu' }, t('common.toolbar.download'));
    const item = (label, fn) => {
      const b = h('button.st-act.tb-dl-item', { type: 'button', role: 'menuitem' }, h('span', label));
      b.addEventListener('click', async () => {
        menu.hidePopover?.();
        await fn();
        flashDone(btn, t('common.toolbar.saved'));
      });
      return b;
    };
    const menu = h(
      'div.tb-dl-menu',
      { id: menuId, popover: 'auto', role: 'menu' },
      download.csv ? item(t('common.toolbar.csv'), () => downloadCSV({ ...download.csv(), updated: data.updated })) : null,
      download.json ? item(t('common.toolbar.json'), () => (typeof download.json === 'function' ? downloadJSON(download.json()) : downloadBundle())) : null,
    );
    menu.addEventListener('toggle', (e) => {
      if (e.newState !== 'open') return;
      const r = btn.getBoundingClientRect();
      menu.style.top = `${r.bottom + 4}px`;
      menu.style.left = `${Math.max(8, r.right - menu.offsetWidth)}px`;
    });
    end.append(btn, menu);
  }

  const api = {
    el,
    slots: { top, end, bottom },
    state,
    /** Does a model pass the vendor filter and the search? (pass a model or an id) */
    matches(m) {
      const model = typeof m === 'string' ? data.model(m) : m;
      if (!model) return false;
      if (state.vendors.size && !state.vendors.has(model.vendor)) return false;
      const q = norm(state.query);
      if (!q) return true;
      return [model.name, model.short, model.vendor, model.id, ...(model.aliases ?? [])].some((s) => norm(s).includes(q));
    },
    on(type, fn) {
      if (type === 'compare') events.__hasCompare = true;
      const w = (e) => fn(e.detail);
      events.addEventListener(type, w);
      return () => events.removeEventListener(type, w);
    },
    setQuery(q) {
      state.query = q;
      if (input) input.value = q;
      emit('change', { ...state });
    },
    clear() {
      state.vendors.clear();
      state.query = '';
      if (input) input.value = '';
      el.querySelectorAll('.tb-vendors .st-chip').forEach((c, i) => c.setAttribute('aria-pressed', String(i === 0)));
      emit('change', { ...state });
    },
    MAX_COMPARE,
  };
  return api;
}
