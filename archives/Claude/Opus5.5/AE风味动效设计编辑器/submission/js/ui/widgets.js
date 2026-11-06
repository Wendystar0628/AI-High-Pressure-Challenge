// 界面小部件：DOM 构造、图标、菜单、对话框、提示
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U;
  const W = AE.W = {};
  W.el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  const sv = (d, extra = '') => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  W.ICON = {
    select: sv('<path d="M3 2l9 5-4 1.2L6.5 13z" fill="currentColor"/>'),
    hand: sv('<path d="M5 8V3.5a1 1 0 012 0V7m0-4v-.5a1 1 0 012 0V7m0-3.5a1 1 0 012 0V8m0-2a1 1 0 012 0v3c0 3-2 5-4.5 5S5 13 4 11L2.6 8.6a1 1 0 011.7-1L5 8.5"/>'),
    zoom: sv('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5 7h4M7 5v4"/>'),
    rotate: sv('<path d="M13 8a5 5 0 11-1.5-3.6M13 2v3h-3"/>'),
    anchor: sv('<circle cx="8" cy="8" r="2.5"/><path d="M8 1v4.5M8 10.5V15M1 8h4.5M10.5 8H15"/>'),
    rect: sv('<rect x="2.5" y="3.5" width="11" height="9" rx="1"/>'),
    ellipse: sv('<ellipse cx="8" cy="8" rx="5.5" ry="4.5"/>'),
    pen: sv('<path d="M3 13l2-6 6-4 2 2-4 6zM3 13l4-4"/><circle cx="8.5" cy="7.5" r="1"/>'),
    text: sv('<path d="M3 4V3h10v1M8 3v10M6 13h4"/>'),
    pin: sv('<path d="M8 15V9"/><circle cx="8" cy="5.5" r="3.5" fill="currentColor" fill-opacity=".25"/>'),
    camera: sv('<rect x="1.5" y="4.5" width="9" height="7" rx="1"/><path d="M10.5 7l4-2v6l-4-2"/>'),
    orbit: sv('<ellipse cx="8" cy="8" rx="6.5" ry="3"/><circle cx="8" cy="8" r="2"/>'),
    play: sv('<path d="M5 3l8 5-8 5z" fill="currentColor"/>'),
    pause: sv('<path d="M5 3v10M11 3v10" stroke-width="2.4"/>'),
    stepF: sv('<path d="M4 3l6 5-6 5zM12 3v10" fill="currentColor"/>'),
    stepB: sv('<path d="M12 3L6 8l6 5zM4 3v10" fill="currentColor"/>'),
    first: sv('<path d="M3 3v10M13 3L6 8l7 5z" fill="currentColor"/>'),
    last: sv('<path d="M13 3v10M3 3l7 5-7 5z" fill="currentColor"/>'),
    loop: sv('<path d="M3 9V7a3 3 0 013-3h7M11 2l2 2-2 2M13 7v2a3 3 0 01-3 3H3M5 14l-2-2 2-2"/>'),
    eye: sv('<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>'),
    lock: sv('<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>'),
    comp: sv('<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12M5 3v3M8 3v3M11 3v3"/>'),
    audio: sv('<path d="M2 10V6h3l4-3v10l-4-3zM11.5 5.5a3.5 3.5 0 010 5"/>'),
    nodes: sv('<rect x="1.5" y="2.5" width="5" height="4" rx="1"/><rect x="9.5" y="9.5" width="5" height="4" rx="1"/><path d="M6.5 4.5C10 4.5 6 11.5 9.5 11.5"/>'),
    plus: sv('<path d="M8 3v10M3 8h10"/>'),
    trash: sv('<path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9"/>'),
    dup: sv('<rect x="5" y="5" width="8.5" height="8.5" rx="1"/><path d="M3 10.5V3.5a1 1 0 011-1h7"/>'),
    folder: sv('<path d="M2 4.5a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>'),
    save: sv('<path d="M3 2.5h8l2.5 2.5v8.5H2.5V3zM5 2.5v3.5h5V2.5M5 13.5V9h6v4.5"/>'),
    export: sv('<path d="M8 2v8M5 5l3-3 3 3M3 10v3.5h10V10"/>'),
    help: sv('<circle cx="8" cy="8" r="6.5"/><path d="M6 6.2a2 2 0 113 1.7c-.7.4-1 .8-1 1.6M8 11.5v.5"/>'),
    graph: sv('<path d="M2 13c3 0 3-10 6-10s3 10 6 10"/><path d="M2 14.5h12" opacity=".4"/>'),
    timeline: sv('<path d="M2 4h12M2 8h12M2 12h12"/><path d="M5 2.5v3M10 6.5v3M7 10.5v3" stroke-width="2"/>'),
    fit: sv('<path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"/>'),
    key: sv('<path d="M8 2l6 6-6 6-6-6z" fill="currentColor"/>'),
    stopwatch: sv('<circle cx="8" cy="9" r="5"/><path d="M8 9V6.5M6.5 1.5h3"/>'),
    expr: sv('<path d="M3 13c2 0 2-10 4-10M2.5 7.5h4M9 6l4 6M13 6l-4 6"/>'),
    chevron: sv('<path d="M5 6l3 3 3-3"/>'),
    cube: sv('<path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7zM2.5 4.5L8 7.5l5.5-3M8 7.5v7"/>'),
    light: sv('<circle cx="8" cy="7" r="3.5"/><path d="M6.5 12.5h3M7 14.5h2M8 1V0"/>'),
    particles: sv('<circle cx="4" cy="11" r="1.4" fill="currentColor"/><circle cx="8" cy="6" r="1.4" fill="currentColor"/><circle cx="12" cy="9" r="1.4" fill="currentColor"/><circle cx="11" cy="3" r="1" fill="currentColor"/><circle cx="5" cy="4" r="1" fill="currentColor"/>'),
    shape: sv('<path d="M2.5 12.5l4-9 3 6 2-3 2 6z"/>'),
    nullo: sv('<rect x="3" y="3" width="10" height="10" stroke-dasharray="2 2"/>'),
    adjust: sv('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11" /><path d="M8 2.5a5.5 5.5 0 010 11z" fill="currentColor"/>'),
    synth: sv('<path d="M2 3h12v10H2zM5 3v6M8 3v6M11 3v6"/>'),
    mb: sv('<circle cx="10" cy="8" r="3.5" fill="currentColor"/><path d="M1.5 6h4M1 8h4M1.5 10h4"/>'),
    three: sv('<path d="M8 2l5 3v6l-5 3-5-3V5z"/><path d="M3 5l5 3 5-3M8 8v6" opacity=".6"/>'),
    solo: sv('<circle cx="8" cy="8" r="4" fill="currentColor"/>'),
    collapse: sv('<path d="M3 3h10v10H3zM6 3v10"/>'),
    undo: sv('<path d="M5 3L2 6l3 3M2 6h7a4 4 0 010 8H6"/>'),
    redo: sv('<path d="M11 3l3 3-3 3M14 6H7a4 4 0 000 8h3"/>'),
  };
  W.icon = (name, cls) => { const s = W.el('span', { class: cls || '', html: W.ICON[name] || '' }); return s; };
  W.LAYER_ICON = { shape: 'shape', text: 'text', null: 'nullo', adjust: 'adjust', solid: 'rect', precomp: 'comp', camera: 'camera', light: 'light', geo3d: 'cube', particles: 'particles', audio: 'audio', synth: 'synth' };
  W.LABELS = ['#8b93a7', '#ff9f43', '#4cc9f0', '#3ecf8e', '#ff5d8f', '#9b8cff', '#f2c14e', '#ff5a5f'];

  // ---------- 菜单 ----------
  let openMenu = null;
  W.closeMenu = () => { if (openMenu) { openMenu.forEach(m => m.remove()); openMenu = null; } document.querySelectorAll('.menu-btn.open').forEach(b => b.classList.remove('open')); };
  // items: [{label, key, fn, dis, sub:[...], sep:true, head}]
  W.menu = (x, y, items, level = 0) => {
    if (level === 0) W.closeMenu();
    const m = W.el('div', { class: 'ctxmenu' });
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { m.append(W.el('div', { class: 'msep' })); continue; }
      if (it.head) { m.append(W.el('div', { class: 'mhead', text: it.head })); continue; }
      const mi = W.el('div', { class: 'mi' + (it.dis ? ' dis' : '') + (it.sub ? ' sub' : '') }, it.check !== undefined ? (it.check ? '✓ ' : ' ') : '', it.label, it.key ? W.el('span', { class: 'k', text: it.key }) : null);
      if (it.sub) mi.addEventListener('mouseenter', () => { const r = mi.getBoundingClientRect(); openMenu.slice(level + 1).forEach(x => x.remove()); openMenu.length = level + 1; W.menu(r.right - 2, r.top - 4, it.sub, level + 1); });
      else mi.addEventListener('mouseenter', () => { if (openMenu) { openMenu.slice(level + 1).forEach(x => x.remove()); openMenu.length = level + 1; } });
      if (it.fn && !it.sub) mi.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); W.closeMenu(); it.fn(); });
      m.append(mi);
    }
    document.getElementById('overlayLayer').append(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
    if (!openMenu) openMenu = [];
    openMenu[level] = m;
    return m;
  };
  document.addEventListener('mousedown', (e) => { if (openMenu && !e.target.closest('.ctxmenu') && !e.target.closest('.menu-btn')) W.closeMenu(); }, true);

  // ---------- 对话框 ----------
  W.dialog = (title, body, buttons = [{ label: '关闭' }]) => {
    const bg = W.el('div', { class: 'dialog-bg' });
    const close = () => bg.remove();
    const foot = W.el('div', { class: 'dfoot' }, buttons.map(b => W.el('button', { class: 'btn' + (b.pri ? ' pri' : ''), onclick: () => { if (b.fn && b.fn() === false) return; close(); } }, b.label)));
    const d = W.el('div', { class: 'dialog' }, W.el('h3', { text: title }), W.el('div', { class: 'dbody' }, body), foot);
    bg.append(d);
    bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
    document.getElementById('overlayLayer').append(bg);
    return { close, el: d, foot };
  };
  let toastT = null;
  W.toast = (msg, warn) => {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = W.el('div', { class: 'toast' + (warn ? ' warn' : ''), text: msg });
    document.body.append(t);
    clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, 2200);
  };
  // 数值拖拽：按住水平拖动调值，点击进入输入
  W.scrub = (elem, get, set, opts = {}) => {
    elem.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const x0 = e.clientX, v0 = get(); let moved = false;
      const step = opts.step || 1;
      if (opts.begin) opts.begin();
      const mm = (ev) => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) > 2) moved = true;
        if (!moved) return;
        const k = ev.shiftKey ? 10 : ev.ctrlKey ? 0.1 : 1;
        let v = v0 + dx * step * k;
        if (opts.min !== undefined) v = Math.max(opts.min, v); if (opts.max !== undefined) v = Math.min(opts.max, v);
        set(v, false);
      };
      const mu = () => {
        removeEventListener('mousemove', mm); removeEventListener('mouseup', mu);
        if (!moved) { W.inlineEdit(elem, get(), (v) => set(v, true), opts); }
        else if (opts.end) opts.end();
      };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    });
  };
  W.inlineEdit = (elem, value, done, opts = {}) => {
    const r = elem.getBoundingClientRect();
    const inp = W.el('input', { class: 'numin', value: typeof value === 'number' ? U.fmt(value, 3) : value, style: { position: 'fixed', left: r.left + 'px', top: (r.top - 1) + 'px', width: Math.max(60, r.width + 16) + 'px', zIndex: 90 } });
    document.body.append(inp); inp.focus(); inp.select();
    let fin = false;
    const finish = (ok) => {
      if (fin) return; fin = true;
      const s = inp.value; inp.remove();
      if (!ok) { if (opts.end) opts.end(true); return; }
      if (opts.text) { done(s); }
      else { let v; try { v = Function('"use strict";return (' + s.replace(/[^0-9+\-*/().e\s]/gi, '') + ')')(); } catch (e) { v = parseFloat(s); } if (isFinite(v)) done(v); }
      if (opts.end) opts.end();
    };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    inp.addEventListener('blur', () => finish(true));
  };
  W.colorInput = (c, onChange, onBegin, onEnd) => {
    const i = W.el('input', { type: 'color', value: U.toHex(c) });
    i.addEventListener('focus', () => onBegin && onBegin());
    i.addEventListener('input', () => onChange(U.hex(i.value).map((x, k) => k === 3 ? (c[3] === undefined ? 1 : c[3]) : x)));
    i.addEventListener('change', () => onEnd && onEnd());
    return i;
  };
  W.select = (opts, value, onChange) => {
    const s = W.el('select', {}, Object.entries(opts).map(([k, v]) => W.el('option', { value: k, selected: k === String(value) }, v)));
    s.addEventListener('change', () => onChange(s.value));
    s.addEventListener('keydown', e => e.stopPropagation());
    return s;
  };
  W.check = (v, onChange, label) => {
    const c = W.el('input', { type: 'checkbox' }); c.checked = !!v;
    c.addEventListener('change', () => onChange(c.checked));
    return label ? W.el('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', width: 'auto' } }, c, label) : c;
  };
  // 高 DPI 画布
  W.fitCanvas = (cv) => {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: r.width, h: r.height, d };
  };
  W.isTyping = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'color' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
})(typeof window !== 'undefined' ? window : globalThis);
