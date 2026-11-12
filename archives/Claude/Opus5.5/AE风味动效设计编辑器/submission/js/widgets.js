'use strict';
// ============ 属性控件（属性面板与时间轴共用） ============
const Widgets = {
  // 可拖动数字
  scrub(get, set, opts = {}) {
    const el = U.el('span', { class: 'scrub' });
    const dec = opts.dec ?? 1, step = opts.step ?? 1;
    el.update = () => { const v = get(); el.textContent = (typeof v === 'number' ? U.fmt(v, dec) : v) + (opts.unit || ''); if (opts.cls) el.className = 'scrub ' + opts.cls(); };
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX; const v0 = get(); let moved = false;
      const mv = ev => { const dx = ev.clientX - x0; if (Math.abs(dx) > 2) moved = true; if (!moved) return; let v = v0 + dx * step * (ev.shiftKey ? 10 : ev.ctrlKey ? 0.1 : 1); if (opts.min !== undefined) v = Math.max(opts.min, v); if (opts.max !== undefined) v = Math.min(opts.max, v); set(v, false); el.update(); };
      const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) set(get(), true); else this.edit(el, get, set, opts); };
      addEventListener('mousemove', mv); addEventListener('mouseup', up);
    });
    el.update(); return el;
  },
  edit(el, get, set, opts) {
    const inp = U.el('input', { class: 'numin', value: U.fmt(get(), 4) });
    el.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const fin = ok => { if (done) return; done = true; if (ok) { const v = parseFloat(inp.value); if (isFinite(v)) set(v, true); } inp.replaceWith(el); el.update(); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); e.stopPropagation(); });
    inp.addEventListener('blur', () => fin(true));
  },
  // 设置属性（自动关键帧）
  setProp(prop, v, layer, comp, commit, label, spatial) {
    const tl = App.t - (layer ? layer.startTime : 0);
    Anim.setValue(prop, v, tl, spatial);
    App.edited(commit ? (label || '修改属性') : null);
  },
  // 属性行：返回 {el, update, extra}
  propRow(node, layer, comp, opts = {}) {
    const p = node.prop; const kind = node.kind; const dims = node.dims || (U.isArr(p.v) ? p.v.length : 1);
    const val = () => Anim.evalProp(p, comp, layer, App.t);
    const cls = () => (p.xOn && p.x ? 'ex' : Anim.isAnimated(p) ? 'kf' : '');
    const spatial = !!node.spatial;
    const parts = []; const ups = [];
    const lab = node.label;
    if (kind === 'num' || kind === 'angle') {
      const s = this.scrub(() => val(), (v, c) => this.setProp(p, v, layer, comp, c, lab), { dec: node.step && node.step < 1 ? 2 : 1, step: node.step || (kind === 'angle' ? 1 : (Math.abs(p.v) > 50 ? 1 : 0.1)), min: node.min, max: node.max, unit: kind === 'angle' ? '°' : (node.unit || ''), cls });
      parts.push(s); ups.push(s.update);
    } else if (kind === 'vec') {
      for (let d = 0; d < dims; d++) {
        const s = this.scrub(() => { const v = val(); return U.isArr(v) ? v[d] : v; }, (v, c) => { const cur = U.clone(Anim.keyValue(p, App.t - (layer ? layer.startTime : 0))); const nv = U.isArr(cur) ? cur.slice() : [cur]; nv[d] = v; this.setProp(p, nv, layer, comp, c, lab, spatial); }, { dec: node.step && node.step < 1 ? 2 : 1, step: node.step || 1, unit: node.unit || '', cls });
        parts.push(s); ups.push(s.update);
      }
    } else if (kind === 'color') {
      const c = U.el('input', { type: 'color', class: 'swatch' });
      c.addEventListener('input', () => this.setProp(p, U.hex2rgb(c.value), layer, comp, false));
      c.addEventListener('change', () => this.setProp(p, U.hex2rgb(c.value), layer, comp, true, lab));
      const up = () => { if (document.activeElement !== c) c.value = U.rgb2hex(val()); }; up(); parts.push(c); ups.push(up);
    } else if (kind === 'text') {
      const ta = U.el('textarea', { class: 'txt', rows: 2 });
      ta.addEventListener('input', () => { this.setProp(p, ta.value, layer, comp, false); });
      ta.addEventListener('change', () => { this.setProp(p, ta.value, layer, comp, true, '修改文字'); });
      const up = () => { if (document.activeElement !== ta) ta.value = val(); }; up();
      if (opts.compact) { const sp = U.el('span', { class: 'dim', style: { maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' } }); const u2 = () => sp.textContent = String(val()).replace(/\n/g, '⏎'); u2(); parts.push(sp); ups.push(u2); }
      else { parts.push(ta); ups.push(up); }
    } else if (kind === 'path') {
      const b = U.el('span', { class: 'dim', text: '贝塞尔路径' }); parts.push(b);
      const ed = U.el('button', { class: 'mini', text: '编辑', title: '在画布中编辑顶点与切线', onclick: e => { e.stopPropagation(); Viewer.editPath(p, layer); } }); parts.push(ed);
    }
    // 秒表 + 关键帧导航 + 表达式
    const sw = U.el('span', { class: 'sw' + (Anim.isAnimated(p) ? ' on' : ''), title: '秒表：开启/关闭动画（Alt+点击：表达式）' });
    sw.addEventListener('mousedown', e => {
      e.stopPropagation();
      if (e.altKey) { p.xOn = !p.xOn; if (p.xOn && !p.x) p.x = this.defaultExpr(node); App.structChanged(p.xOn ? '启用表达式' : '停用表达式'); return; }
      Anim.toggleAnim(p, App.t - (layer ? layer.startTime : 0), Anim.keyValue(p, App.t - (layer ? layer.startTime : 0)), spatial);
      App.structChanged(Anim.isAnimated(p) ? '开启动画' : '关闭动画');
    });
    const nav = U.el('span', { class: 'knav' });
    const kp = U.el('span', { text: '◀', title: '上一关键帧' }), kk = U.el('span', { text: '◆', title: '在当前时间添加/删除关键帧' }), kn = U.el('span', { text: '▶', title: '下一关键帧' });
    nav.append(kp, kk, kn);
    const st = () => layer ? layer.startTime : 0;
    kp.onclick = () => { const ts = (p.k || []).map(k => k.t + st()).filter(x => x < App.t - 1e-4); if (ts.length) App.setTime(Math.max(...ts)); };
    kn.onclick = () => { const ts = (p.k || []).map(k => k.t + st()).filter(x => x > App.t + 1e-4); if (ts.length) App.setTime(Math.min(...ts)); };
    kk.onclick = () => {
      const tl = App.t - st(); const i = Anim.keyIndexAt(p, tl, 0.5 / comp.fps);
      if (i >= 0) { Anim.removeKey(p, p.k[i]); } else { if (!p.k) p.k = []; Anim.addKey(p, tl, Anim.evalProp(p, comp, layer, App.t), spatial); }
      App.structChanged('关键帧');
    };
    const upNav = () => { const has = Anim.keyIndexAt(p, App.t - st(), 0.5 / comp.fps) >= 0; kk.classList.toggle('has', has); kk.textContent = has ? '◆' : '◇'; nav.style.visibility = Anim.isAnimated(p) ? 'visible' : 'hidden'; };
    upNav(); ups.push(upNav);
    const ex = U.el('span', { class: 'exbtn' + (p.xOn ? ' on' : ''), text: '=', title: '表达式' });
    ex.addEventListener('mousedown', e => { e.stopPropagation(); if (!p.xOn) { p.xOn = true; if (!p.x) p.x = this.defaultExpr(node); } else p.xOn = false; App.structChanged(p.xOn ? '启用表达式' : '停用表达式'); });
    const val2 = U.el('span', { class: 'val' }, ...parts, nav, ex);
    const el = U.el('div', { class: 'prow' + (opts.sub ? ' sub' : '') }, sw, U.el('span', { class: 'lab', text: lab, title: lab }), val2);
    let exEl = null;
    if (p.xOn) exEl = this.exprBox(p, node, layer, comp);
    return { el, exEl, update: () => { for (const u of ups) u(); if (exEl) exEl.update(); }, parts: val2 };
  },
  defaultExpr(node) {
    if (node.kind === 'vec') return 'wiggle(2, 30)'; if (node.kind === 'angle') return 'time * 90'; if (node.kind === 'color') return 'value'; if (node.kind === 'text') return 'value'; return 'value';
  },
  exprBox(p, node, layer, comp) {
    const ta = U.el('textarea', { spellcheck: 'false', title: '表达式（time、value、wiggle、loopOut、linear、ease、thisComp.layer(..)、valueAtTime 等），Ctrl+Enter 应用' }); ta.value = p.x;
    const err = U.el('div', { class: 'exerr' });
    const apply = commit => { p.x = ta.value; Anim.touch(); App.edited(commit ? '编辑表达式' : null); };
    ta.addEventListener('input', () => apply(false));
    ta.addEventListener('change', () => apply(true));
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.ctrlKey) { apply(true); ta.blur(); } });
    const box = U.el('div', { class: 'exrow' }, ta, err);
    box.update = () => { Anim.evalProp(p, comp, layer, App.t); const m = Anim.errors.get(p.id); err.textContent = m ? '⚠ ' + m + '（已退回关键帧值）' : ''; };
    box.update(); return box;
  },
  select(opts, cur, onch, cls = 'sel') {
    const s = U.el('select', { class: cls }); for (const [k, v] of Object.entries(opts)) { const o = U.el('option', { value: k, text: v }); if (String(k) === String(cur)) o.selected = true; s.appendChild(o); }
    s.addEventListener('change', () => onch(s.value)); s.addEventListener('keydown', e => e.stopPropagation()); return s;
  },
  check(cur, onch) { const c = U.el('input', { type: 'checkbox', class: 'chk' }); c.checked = !!cur; c.addEventListener('change', () => onch(c.checked)); return c; },
  layerSelect(comp, cur, filter, onch, allowNone = true) {
    const o = {}; if (allowNone) o[''] = '（无）';
    for (const L of comp.layers) if (!filter || filter === 'any' || L.type === filter) o[L.id] = L.name;
    return this.select(o, cur || '', v => onch(v ? +v : null));
  },
};
