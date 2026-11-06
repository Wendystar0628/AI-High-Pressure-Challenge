// 属性面板：按图层类型组织全部可编辑项（关键帧开关、导航、数值拖动、表达式、蒙版、效果、材质、粒子、音色…）
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, E = AE.Eval, A = AE.Anim, Mdl = AE.Model, W = AE.W, App = AE.App, T = AE.Tree;
  const el = W.el;
  const PR = AE.Props = {};
  let root, updaters = [], sig = null;
  const closed = new Set(['l:material', 'l:masks', 'l:effects']);
  PR.init = () => { root = document.getElementById('props'); App.panels.props = PR; };
  const signature = () => [App.sel.layers.join(','), App.stack.map(s => s.comp + s.layer).join('/'), App.hist.cur && App.hist.cur.length, App.hist.undo.length, App.hist.redo.length, App.focusProp && App.focusProp._path, App.sel.item, Array.from(App.sel.nodes).join(','), PR._force || 0].join('|');
  PR.rebuild = () => { PR._force = (PR._force || 0) + 1; };
  PR.update = () => {
    if (!root) return;
    const s = signature();
    if (s !== sig) { if (root.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') { updaters.forEach(f => f()); return; } sig = s; build(); }
    else updaters.forEach(f => f());
  };
  const edit = (label, fn) => App.edit(label, fn);

  // ---------- 通用部件 ----------
  function sect(key, title, body, acts, opts = {}) {
    const s = el('div', { class: 'sect' + (closed.has(key) ? ' closed' : '') });
    const h = el('div', { class: 'sect-h', onclick: (e) => { if (e.target.closest('.acts')) return; s.classList.toggle('closed'); if (s.classList.contains('closed')) closed.add(key); else closed.delete(key); } },
      el('span', { class: 'tw', text: '▾' }), el('span', { text: title }), opts.tag || null, el('span', { class: 'acts' }, acts || []));
    s.append(h, el('div', { class: 'sect-b' }, body));
    return s;
  }
  const btn = (label, fn, cls) => el('button', { class: 'btn sm ' + (cls || ''), onclick: (e) => { e.stopPropagation(); fn(e); } }, label);
  const ib = (icon, title, fn) => el('span', { class: 'ibtn', title, html: W.ICON[icon] || icon, onclick: (e) => { e.stopPropagation(); fn(e); } });
  const row = (label, ...ctl) => el('div', { class: 'row' }, el('label', { text: label, title: label }), el('div', { class: 'ctl' }, ...ctl));
  const sub = (title, acts) => el('div', { class: 'sub-h' }, el('span', { text: title }), el('span', { class: 'acts' }, acts || []));
  const sel = (opts, v, fn) => W.select(opts, v, fn);
  const chk = (v, fn, label) => W.check(v, fn, label);
  const txt = (v, fn, ph) => { const i = el('input', { value: v || '', placeholder: ph || '', style: { width: '100%' } }); i.addEventListener('change', () => fn(i.value)); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); }); return i; };
  const numIn = (v, fn, step) => { const s = el('span', { class: 'num', text: U.fmt(v, 2) }); let cur = v; W.scrub(s, () => cur, (x, fin) => { cur = x; s.textContent = U.fmt(x, 2); if (fin) fn(x, true); else fn(x, false); }, { step: step || 0.1, begin: () => App.begin(), end: () => App.commit('修改参数') }); return s; };
  const layerOpts = (filter, none = '（无）') => { const o = { '': none }; for (const l of App.comp().layers) if (!filter || filter(l)) o[l.id] = l.name; return o; };
  const outputOpts = (types) => { const o = { '': '（无）' }; for (const n of AE.Nodes.outputNames(App.comp(), types)) o[n] = n; return o; };

  // 属性行：码表 / 标签 / 值 / 关键帧导航 / 表达式
  function propRow(layer, prop, label, opts = {}) {
    const targets = opts.targets || [[layer, prop]];
    const ctx = () => App.ctx();
    const wrap = el('div');
    const sw = el('span', { class: 'sw' + (prop.anim ? ' on' : ''), title: '动画开关（码表）', html: W.ICON.stopwatch, onclick: () => edit(prop.anim ? '关闭动画' : '开启动画', () => { for (const [l, p] of targets) { A.toggleAnim(p, App.t(), E.propRaw(p, App.t(), ctx())); if (p.anim) for (const k of p.keys) App.registerKey(k, p); } }) });
    const exb = el('span', { class: 'sw' + (prop.exprOn ? ' ex' : ''), title: '表达式', html: W.ICON.expr, onclick: () => edit('切换表达式', () => { prop.exprOn = !prop.exprOn; if (prop.exprOn && !prop.expr) prop.expr = defaultExpr(prop); App.focusProp = prop; }) });
    const ctl = el('div', { class: 'ctl' });
    const lab = el('label', { text: label || Mdl.label((prop._path || '').split('.').pop()), title: (prop._path || ''), style: { cursor: 'pointer' }, onclick: () => { App.sel.props = new Set([prop]); App.focusProp = prop; App.mark('graph'); } });
    const r = el('div', { class: 'row' + (prop._err ? ' err' : '') }, sw, lab, ctl);
    const mixed = targets.length > 1 && targets.some(([l, p]) => JSON.stringify(E.prop(p, App.t(), ctx(), l)) !== JSON.stringify(E.prop(targets[0][1], App.t(), ctx(), targets[0][0])));
    const write = (fn) => { for (const [l, p] of targets) App.writeProp(p, fn(E.propRaw(p, App.editTime(), ctx()))); E.bump(); App.mark('viewer', 'timeline', 'graph'); };
    const cls = () => 'num' + (prop.exprOn && prop.expr ? ' expr' : prop.anim ? ' anim' : '');
    const val = () => E.prop(prop, App.t(), ctx(), layer);
    const t = prop.type;
    if (t === 'num' || t === 'vec2' || t === 'vec3') {
      const n = t === 'num' ? 1 : T.dims(prop, layer);
      const spans = [];
      for (let c = 0; c < n; c++) {
        const s = el('span', { class: cls() });
        const get = () => { const v = E.propRaw(prop, App.editTime(), ctx()); return t === 'num' ? v : v[c]; };
        let linkedStart = null;
        W.scrub(s, get, (x, fin) => {
          write(v => { if (t === 'num') return x; const a = v.slice(); if (opts.uniform && linkedStart) { const f = x / (linkedStart[c] || 1); return linkedStart.map(q => q * f); } a[c] = x; return a; });
          if (fin) App.commit('修改' + (label || ''));
        }, { step: opts.step || prop.step || 1, min: prop.min, max: prop.max, begin: () => { App.beginOp(); linkedStart = E.propRaw(prop, App.editTime(), ctx()).slice ? E.propRaw(prop, App.editTime(), ctx()).slice() : null; }, end: (cancel) => { App.endOp('修改' + (label || '数值')); } });
        spans.push(s); ctl.append(s);
      }
      const up = () => { const v = val(); spans.forEach((s, c) => { s.className = cls() + (mixed ? ' mixed' : ''); s.textContent = mixed ? '—' : U.fmt(t === 'num' ? v : v[c], opts.digits !== undefined ? opts.digits : (Math.abs(t === 'num' ? v : v[c]) < 10 ? 2 : 1)); }); };
      up(); updaters.push(up);
      if (opts.suffix) ctl.append(el('span', { class: 'small', text: opts.suffix }));
    } else if (t === 'color') {
      const ci = W.colorInput(val(), (c) => { write(() => c); }, () => App.beginOp(), () => App.endOp('修改颜色'));
      const alpha = el('span', { class: cls(), title: '不透明度' });
      W.scrub(alpha, () => (E.propRaw(prop, App.editTime(), ctx())[3] || 1) * 100, (x, fin) => { write(v => { const a = v.slice(); a[3] = U.clamp(x / 100, 0, 1); return a; }); if (fin) App.commit('修改透明度'); }, { step: 0.5, begin: () => App.beginOp(), end: () => App.endOp('修改透明度') });
      ctl.append(ci, alpha);
      const up = () => { const v = val(); if (document.activeElement !== ci) ci.value = U.toHex(v); alpha.textContent = Math.round((v[3] === undefined ? 1 : v[3]) * 100) + '%'; alpha.className = cls(); };
      up(); updaters.push(up);
    } else if (t === 'text') {
      const ta = el('textarea', { rows: 2, style: { width: '100%', fontFamily: 'inherit', fontSize: '13px' } });
      ta.value = val();
      ta.addEventListener('keydown', e => e.stopPropagation());
      ta.addEventListener('input', () => { App.writeProp(prop, ta.value); E.bump(); App.mark('viewer', 'timeline'); });
      ta.addEventListener('focus', () => App.beginOp()); ta.addEventListener('blur', () => App.endOp('修改文字'));
      ctl.append(ta);
      PR._textArea = ta;
      updaters.push(() => { if (document.activeElement !== ta) ta.value = val(); });
    } else if (t === 'path') {
      const info = el('span', { class: 'small' });
      ctl.append(info, btn('画布编辑', () => { App.sel.item = opts.itemId || App.sel.item; App.mark(); }));
      const up = () => { const v = val() || []; info.textContent = v.length + ' 个轮廓 · ' + v.reduce((a, c) => a + c.v.length, 0) + ' 个顶点'; };
      up(); updaters.push(up);
    }
    // 关键帧导航
    const kn = el('span', { class: 'knav' });
    const prev = el('span', { text: '◀', title: '上一关键帧', onclick: () => { const ks = prop.keys.filter(k => k.t < App.t() - 1e-4); if (ks.length) App.setTime(ks[ks.length - 1].t); } });
    const dia = el('span', { text: '◆', title: '在当前时刻添加/删除关键帧', onclick: () => edit('添加/删除关键帧', () => { const tt = App.t(); const k = A.keyAt(prop, tt); if (k) { prop.keys.splice(prop.keys.indexOf(k), 1); if (!prop.keys.length) prop.anim = false; } else { const nk = A.addKey(prop, tt, E.propRaw(prop, tt, ctx())); App.registerKey(nk, prop); } }) });
    const next = el('span', { text: '▶', title: '下一关键帧', onclick: () => { const k = prop.keys.find(k => k.t > App.t() + 1e-4); if (k) App.setTime(k.t); } });
    kn.append(prev, dia, next);
    updaters.push(() => { dia.classList.toggle('on', prop.anim && !!A.keyAt(prop, App.t())); sw.classList.toggle('on', prop.anim); });
    if (!opts.noKeys) r.append(kn);
    r.append(exb);
    wrap.append(r);
    // 表达式编辑
    if (prop.exprOn) {
      const ta = el('textarea', { rows: Math.min(6, Math.max(2, (prop.expr || '').split('\n').length)), spellcheck: false });
      ta.value = prop.expr || '';
      ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ta.blur(); });
      ta.addEventListener('change', () => edit('修改表达式', () => { prop.expr = ta.value; }));
      const err = el('div', { class: 'exprerr' });
      const hint = el('div', { class: 'small', text: '变量：time value thisComp thisLayer · 函数：wiggle loopOut linear ease valueAtTime toWorld fromWorld random … （Ctrl+Enter 应用）' });
      wrap.append(el('div', { class: 'exprbox' }, ta, err, hint));
      const up = () => { err.textContent = prop._err ? '⚠ ' + prop._err + '（已退回关键帧值）' : ''; };
      up(); updaters.push(up);
    }
    return wrap;
  }
  function defaultExpr(p) { if (p.type === 'num') return 'value + wiggle(2, 10) - value'; if (p.type === 'vec3' || p.type === 'vec2') return 'wiggle(1.5, 30)'; return 'value'; }
  PR.propRow = propRow;
  PR.focusText = () => { setTimeout(() => { if (PR._textArea) { PR._textArea.focus(); PR._textArea.select(); } }, 30); };

  // ---------- 构建 ----------
  function build() {
    updaters = []; PR._textArea = null;
    const scroll = root.scrollTop;
    root.innerHTML = '';
    const ls = App.layers();
    const title = document.getElementById('propTitle');
    if (App.workspace === 'nodes' && App.sel.nodes.size && AE.NodeUI) { title.textContent = '节点参数'; root.append(AE.NodeUI.paramPanel()); root.scrollTop = scroll; return; }
    if (!ls.length) { title.textContent = '合成设置'; root.append(...compPanel()); root.scrollTop = scroll; return; }
    if (ls.length > 1) { title.textContent = '多选（' + ls.length + ' 个图层）'; root.append(...multiPanel(ls)); root.scrollTop = scroll; return; }
    const l = ls[0];
    title.textContent = Mdl.TYPE_NAMES[l.type] + '图层';
    root.append(...layerPanel(l));
    root.scrollTop = scroll;
  }
  function compPanel() {
    const c = App.comp(), out = [];
    const inner = App.stack.length > 1;
    out.push(el('div', { class: 'empty' }, el('b', { text: inner ? '正在编辑预合成实例的内部' : '未选择图层' }), inner ? '播放头对应外层引用正在取样的内部时刻；修改会传播到所有未覆盖的实例。' : '在画布或时间轴中点选图层；Ctrl+A 全选。也可用“图层 › 新建”添加内容。'));
    const body = [
      row('名称', txt(c.name, v => edit('重命名合成', () => { c.name = v; }))),
      row('尺寸', numIn(c.width, (v, f) => { c.width = Math.max(16, Math.round(v)); if (f) App.commit(); App.mark(); }, 1), el('span', { text: '×' }), numIn(c.height, (v, f) => { c.height = Math.max(16, Math.round(v)); App.mark(); }, 1)),
      row('帧率', sel({ 12: '12', 24: '24', 25: '25', 30: '30', 48: '48', 50: '50', 60: '60' }, c.fps, v => edit('修改帧率（关键帧按秒保存，时刻不变）', () => { c.fps = +v; }))),
      row('时长(秒)', numIn(c.duration, (v, f) => { c.duration = Math.max(0.1, v); c.workArea[1] = Math.min(c.workArea[1], c.duration); App.mark(); }, 0.05)),
      row('背景', W.colorInput(c.bg, (v) => { c.bg = [v[0], v[1], v[2], c.bg[3]]; App.mark(); }, () => App.begin(), () => App.commit('背景色')), chk(c.bg[3] < 1, v => edit('透明背景', () => { c.bg[3] = v ? 0 : 1; }), '透明')),
      row('工作区', el('span', { class: 'small', text: c.workArea[0].toFixed(2) + 's → ' + c.workArea[1].toFixed(2) + 's（B / N 设置）' })),
    ];
    out.push(sect('c:basic', '合成', body));
    const mb = c.motionBlur;
    out.push(sect('c:mb', '运动模糊', [
      row('总开关', chk(mb.on, v => edit('运动模糊总开关', () => { mb.on = v; }))),
      row('快门角度', numIn(mb.angle, (v) => { mb.angle = U.clamp(v, 0, 720); App.mark(); }, 1)),
      row('快门相位', numIn(mb.phase, (v) => { mb.phase = U.clamp(v, -360, 360); App.mark(); }, 1)),
      row('取样数', numIn(mb.samples, (v) => { mb.samples = U.clamp(Math.round(v), 1, 32); App.mark(); }, 0.1)),
      el('div', { class: 'small', text: '在快门区间内多次取样实际画面（位置/旋转/父级/摄像机/表达式/变形/粒子/时间重映射）；模拟不会因取样重复推进。' }),
    ]));
    const env = c.env || (c.env = AE.R3.defaultEnv());
    out.push(sect('c:env', '环境照明（程序生成）', [
      row('强度', numIn(env.intensity, (v) => { env.intensity = Math.max(0, v); App.mark(); }, 0.01)),
      row('天顶', W.colorInput(env.top, v => { env.top = v.slice(0, 3); App.mark(); }, () => App.begin(), () => App.commit('环境'))),
      row('地平线', W.colorInput(env.horizon, v => { env.horizon = v.slice(0, 3); App.mark(); }, () => App.begin(), () => App.commit('环境'))),
      row('地面', W.colorInput(env.ground, v => { env.ground = v.slice(0, 3); App.mark(); }, () => App.begin(), () => App.commit('环境'))),
      ...env.boxes.map((b, i) => row('柔光箱 ' + (i + 1), W.colorInput(b.color, v => { b.color = v.slice(0, 3); App.mark(); }, () => App.begin(), () => App.commit('环境')), numIn(b.k, v => { b.k = Math.max(0, v); App.mark(); }, 0.05), numIn(b.size, v => { b.size = U.clamp(v, 0.02, 1.5); App.mark(); }, 0.005))),
    ]));
    // 公开参数
    out.push(sect('c:params', '公开参数（供外层实例覆盖）', [
      ...(c.params.length ? c.params.map(p => el('div', { class: 'row' }, el('label', { text: p.name }), el('div', { class: 'ctl' }, el('span', { class: 'small', text: (E.layer(c, p.layer) || {}).name + ' · ' + p.path }), ib('trash', '移除', () => edit('移除公开参数', () => { c.params = c.params.filter(x => x !== p); }))))) : [el('div', { class: 'small', text: '在时间轴属性上右键 › 公开给外层，可把文字、颜色、数值等交给每个实例单独覆盖。' })]),
    ]));
    return out;
  }
  function multiPanel(ls) {
    const out = [el('div', { class: 'pnote', text: '多选时可同时修改相同属性；数值不同显示为“—”。' })];
    const rows = [];
    for (const k of ['anchor', 'position', 'scale', 'rotation', 'opacity']) rows.push(propRow(ls[0], ls[0].transform[k], Mdl.label(k), { targets: ls.map(l => [l, l.transform[k]]), uniform: k === 'scale' }));
    out.push(sect('m:tf', '变换（' + ls.length + ' 个图层）', rows));
    out.push(sect('m:sw', '开关', [row('三维', chk(ls.every(l => l.threeD), v => edit('三维开关', () => ls.forEach(l => { l.threeD = v; })))), row('运动模糊', chk(ls.every(l => l.motionBlur), v => edit('运动模糊', () => ls.forEach(l => { l.motionBlur = v; })))), row('', btn('预合成所选', App.precompose), btn('复制', App.duplicate))]));
    return out;
  }
  function layerPanel(l) {
    const out = [], comp = App.comp();
    const tag = el('span', { class: 'tag acc', text: Mdl.TYPE_NAMES[l.type] });
    const head = [
      row('名称', txt(l.name, v => edit('重命名', () => { l.name = v; }))),
      row('入点 / 出点', numIn(l.inPoint, (v) => { l.inPoint = Math.min(v, l.outPoint - 0.01); E.bump(); App.mark(); }, 1 / comp.fps), numIn(l.outPoint, (v) => { l.outPoint = Math.max(v, l.inPoint + 0.01); E.bump(); App.mark(); }, 1 / comp.fps), el('span', { class: 'small', text: '秒' })),
      row('开关', chk(l.visible, v => edit('显示', () => { l.visible = v; }), '显示'), chk(l.locked, v => edit('锁定', () => { l.locked = v; }), '锁定'), ['camera', 'light', 'audio', 'synth'].includes(l.type) ? null : chk(l.threeD, v => App.toggle(l, 'threeD'), '三维'), chk(l.motionBlur, v => edit('运动模糊', () => { l.motionBlur = v; }), '模糊')),
      row('父级', sel(layerOpts(q => q !== l && q.type !== 'audio' && q.type !== 'synth'), l.parent || '', v => App.setParent(l, v || null))),
    ];
    if (!['camera', 'light', 'audio', 'synth', 'null'].includes(l.type)) {
      head.push(row('混合模式', sel(Mdl.BLENDS, l.blend, v => edit('混合模式', () => { l.blend = v; }))));
      head.push(row('轨道遮罩', sel(layerOpts(q => q !== l), l.matte ? l.matte.layer : '', v => edit('轨道遮罩', () => { l.matte = v ? { layer: v, mode: l.matte ? l.matte.mode : 'alpha' } : null; })), l.matte ? sel(Mdl.MATTES, l.matte.mode, v => edit('遮罩模式', () => { l.matte.mode = v; })) : null));
    }
    head.push(row('标签色', ...W.LABELS.map((c, i) => el('span', { style: { width: '14px', height: '14px', borderRadius: '3px', background: c, cursor: 'pointer', outline: l.label === i ? '2px solid #fff' : 'none' }, onclick: () => edit('标签色', () => { l.label = i; }) }))));
    out.push(sect('l:head', l.name, head, [ib('dup', '复制 Ctrl+D', App.duplicate), ib('trash', '删除', App.deleteSelected)], { tag }));
    // 变换
    if (l.type !== 'audio' && l.type !== 'synth') out.push(sect('l:tf', '变换', T.transformProps(l).map(n => propRow(l, n.prop, n.label, { uniform: /scale/.test(n.path), step: /opacity|rot/.test(n.path) ? 0.5 : 1 }))));
    // 类型
    const typed = ({ shape: shapePanel, text: textPanel, camera: cameraPanel, light: lightPanel, precomp: precompPanel, geo3d: geoPanel, particles: particlePanel, synth: synthPanel, audio: audioPanel, solid: solidPanel })[l.type];
    if (typed) out.push(...typed(l));
    if (AE.Puppet && ['shape', 'text', 'precomp', 'solid'].includes(l.type)) out.push(AE.Puppet.panel(l, { sect, row, propRow, btn, ib, chk, numIn, sel }));
    if (!['camera', 'light', 'audio', 'synth', 'null'].includes(l.type)) { out.push(masksPanel(l)); out.push(effectsPanel(l)); }
    if (l.threeD && !['camera', 'light'].includes(l.type)) out.push(sect('l:material', '材质选项（三维）', [row('投射阴影', chk(l.type === 'geo3d' ? l.geo.cast : l.mat.cast, v => edit('投射阴影', () => { if (l.geo) l.geo.cast = v; l.mat.cast = v; }))), row('接收阴影', chk(l.type === 'geo3d' ? l.geo.receive : l.mat.accept, v => edit('接收阴影', () => { if (l.geo) l.geo.receive = v; l.mat.accept = v; }))), l.type !== 'geo3d' ? row('接受灯光', chk(l.mat.lit, v => edit('接受灯光', () => { l.mat.lit = v; }))) : null].filter(Boolean)));
    return out;
  }
  function solidPanel(l) { return [sect('l:solid', '纯色', [propRow(l, l.solid.color, '颜色'), row('尺寸', numIn(l.solid.width, v => { l.solid.width = Math.max(1, v); App.mark(); }, 1), numIn(l.solid.height, v => { l.solid.height = Math.max(1, v); App.mark(); }, 1))])]; }

  // ---------- 形状 ----------
  const ITEM_TYPES = { rect: '矩形', ellipse: '椭圆', star: '星形', path: '路径', fill: '填充', gfill: '渐变填充', stroke: '描边', trim: '修剪路径', repeater: '重复器', merge: '合并路径（布尔）', morph: '路径形变', displace: '场位移', resample: '重采样', group: '组', nodeGeo: '节点几何' };
  function addItemMenu(e, list) {
    W.menu(e.clientX, e.clientY, [{ head: '添加到此组（按顺序处理）' }, ...Object.entries(ITEM_TYPES).map(([k, v]) => ({ label: v, fn: () => edit('添加' + v, () => {
      let it;
      if (k === 'rect') it = Mdl.shape.rect(200, 200, 0); else if (k === 'ellipse') it = Mdl.shape.ellipse(200, 200); else if (k === 'star') it = Mdl.shape.star(5, 120, 55);
      else if (k === 'path') it = Mdl.shape.path([AE.Path.star(0, 0, 3, 100, 100, 0, 0, true)]); else if (k === 'group') it = Mdl.shape.group('组', []); else it = Mdl.shape[k]();
      // 操作器默认插在第一个绘制项之前
      const painter = list.findIndex(x => ['fill', 'gfill', 'stroke'].includes(x.type));
      if (['trim', 'merge', 'morph', 'displace', 'resample'].includes(k) && painter >= 0) list.splice(painter, 0, it); else list.push(it);
      App.sel.item = it.id;
    }) }))]);
  }
  function shapeItemsUI(l, items, depth) {
    const out = [];
    items.forEach((it, i) => {
      const box = el('div', { style: { borderLeft: '2px solid ' + (App.sel.item === it.id ? '#ff9f43' : '#2b313d'), paddingLeft: '8px', margin: '4px 0' } });
      const acts = [chk(it.on !== false, v => edit('启用', () => { it.on = v; })), ib('chevron', '上移', () => edit('调整顺序', () => { if (i > 0) { items.splice(i, 1); items.splice(i - 1, 0, it); } })), ib('trash', '删除', () => edit('删除', () => { items.splice(i, 1); }))];
      const h = el('div', { class: 'sub-h', style: { cursor: 'pointer' }, onclick: (e) => { if (e.target.closest('.acts')) return; App.sel.item = it.id; App.mark(); } }, el('span', { text: (ITEM_TYPES[it.type] || it.type) + (it.name && it.type === 'group' ? '：' + it.name : '') }), el('span', { class: 'acts' }, acts));
      box.append(h);
      if (it.type === 'group') {
        box.append(...shapeItemsUI(l, it.items, depth + 1));
        box.append(el('div', { class: 'row' }, el('label', { text: '' }), el('div', { class: 'ctl' }, btn('＋ 添加', (e) => addItemMenu(e, it.items)))));
        const tf = el('div'); for (const k in it.transform) tf.append(propRow(l, it.transform[k], Mdl.label(k)));
        box.append(sub('组变换'), tf);
      } else if (it.type === 'repeater') {
        box.append(propRow(l, it.copies, '副本'), propRow(l, it.offset, '偏移'), row('合成', sel({ above: '新副本在上', below: '新副本在下' }, it.composite, v => edit('重复器顺序', () => { it.composite = v; }))));
        for (const k in it.transform) box.append(propRow(l, it.transform[k], Mdl.label(k)));
      } else {
        for (const k in it) if (Mdl.isProp(it[k])) box.append(propRow(l, it[k], k === 'target' ? '目标形状' : Mdl.label(k), { itemId: it.id }));
        if (it.type === 'fill' || it.type === 'gfill') box.append(row('填充规则', sel({ nonzero: '非零', evenodd: '奇偶' }, it.rule, v => edit('填充规则', () => { it.rule = v; }))));
        if (it.type === 'gfill') { box.append(row('类型', sel({ linear: '线性', radial: '径向' }, it.kind, v => edit('渐变类型', () => { it.kind = v; })))); box.append(row('色标', ...it.stops.map((s, si) => W.colorInput(s[1], c => { s[1] = c; App.mark(); }, () => App.begin(), () => App.commit('渐变色'))))); }
        if (it.type === 'stroke') box.append(row('连接 / 端点', sel({ round: '圆角', miter: '斜接', bevel: '斜角' }, it.join, v => edit('连接', () => { it.join = v; })), sel({ round: '圆头', butt: '平头', square: '方头' }, it.cap, v => edit('端点', () => { it.cap = v; }))));
        if (it.type === 'trim') box.append(row('修剪多条', sel({ simul: '同时', individual: '逐个' }, it.mode, v => edit('修剪模式', () => { it.mode = v; }))));
        if (it.type === 'merge') box.append(row('模式', sel({ union: '并集', subtract: '差集', intersect: '交集', exclude: '排除' }, it.mode, v => edit('布尔模式', () => { it.mode = v; }))));
        if (it.type === 'star') box.append(row('类型', sel({ false: '星形', true: '多边形' }, String(it.polygon), v => edit('星形类型', () => { it.polygon = v === 'true'; }))));
        if (it.type === 'displace') box.append(row('场', sel(outputOpts(['fieldOut']), it.field, v => edit('选择场', () => { it.field = v; }))));
        if (it.type === 'nodeGeo') box.append(row('节点输出', sel(outputOpts(['geoOut', 'emitOut', 'colliderOut']), it.output, v => edit('节点输出', () => { it.output = v; }))));
        if (it.type === 'morph') box.append(...morphUI(l, it, items));
      }
      out.push(box);
    });
    return out;
  }
  function morphUI(l, it, items) {
    const out = [];
    out.push(row('目标', btn('取自上方路径（副本）', () => edit('设置目标形状', () => { const p = items.find(x => x.type === 'path'); if (p) it.target.value = U.clone(AE.Anim.valueAt(p.path, App.t())); })), btn('取自图层…', (e) => W.menu(e.clientX, e.clientY, App.comp().layers.filter(q => q.type === 'shape' && q !== l).map(q => ({ label: q.name, fn: () => edit('设置目标形状', () => { const pi = (function f(xs) { for (const x of xs) { if (x.type === 'path') return x; if (x.type === 'group') { const r = f(x.items); if (r) return r; } } })(q.content); if (pi) it.target.value = U.clone(AE.Anim.valueAt(pi.path, App.t())); }) }))))));
    out.push(sub('轮廓对应（源 → 目标，起点偏移，方向）', [btn('自动匹配起点', () => edit('自动匹配', () => {
      const tol = 1; const g = AE.Content.shapeGeometry(l, App.t(), App.ctx(), tol);
      const tgt = (AE.Anim.valueAt(it.target, App.t()) || []).map(c => AE.Path.flatten(c, 1));
      const srcP = items.filter(x => x.type === 'path').flatMap(x => (AE.Anim.valueAt(x.path, App.t()) || []).map(c => AE.Path.flatten(c, 1)));
      it.mapping = srcP.map((A_, k) => { const b = Math.min(k, tgt.length - 1); return { a: k, b, offset: tgt[b] ? AE.Path.bestOffset(A_, tgt[b], 64, false) : 0, reverse: false }; });
    }))]));
    (it.mapping || []).forEach((m, i) => out.push(el('div', { class: 'row' }, el('label', { text: '轮廓 ' + (i + 1) }), el('div', { class: 'ctl' }, numIn(m.a, v => { m.a = Math.max(0, Math.round(v)); App.mark(); }, 0.05), el('span', { text: '→' }), numIn(m.b, v => { m.b = Math.max(0, Math.round(v)); App.mark(); }, 0.05), numIn(m.offset, v => { m.offset = ((v % 1) + 1) % 1; App.mark(); }, 0.002), chk(m.reverse, v => edit('反向', () => { m.reverse = v; }), '反向'), ib('trash', '', () => edit('删除对应', () => it.mapping.splice(i, 1)))))));
    out.push(row('', btn('＋ 对应', () => edit('添加对应', () => { it.mapping = it.mapping || []; it.mapping.push({ a: it.mapping.length, b: it.mapping.length, offset: 0, reverse: false }); }))));
    return out;
  }
  function shapePanel(l) {
    return [sect('l:content', '内容（按顺序处理：路径 → 操作 → 绘制）', [...shapeItemsUI(l, l.content, 0), el('div', { class: 'row' }, el('label'), el('div', { class: 'ctl' }, btn('＋ 添加', (e) => addItemMenu(e, l.content)), btn('＋ 组', () => edit('添加组', () => l.content.push(Mdl.shape.group('组 ' + (l.content.length + 1), [Mdl.shape.rect(200, 200), Mdl.shape.fill()]))))))])];
  }

  // ---------- 文字 ----------
  function textPanel(l) {
    const tx = l.text;
    const fonts = {}; for (const k in AE.Font.FAMILIES) fonts[k] = AE.Font.FAMILIES[k].name;
    const base = [
      propRow(l, tx.source, '源文字'),
      row('字体', sel(fonts, tx.font, v => edit('字体', () => { tx.font = v; })), sel({ 400: '常规', 700: '粗体', 900: '特粗', 300: '细体' }, tx.weight, v => edit('字重', () => { tx.weight = +v; }))),
      row('对齐', sel({ left: '左对齐', center: '居中', right: '右对齐' }, tx.align, v => edit('对齐', () => { tx.align = v; }))),
      propRow(l, tx.size, '字号'), propRow(l, tx.tracking, '字距（‰em）'), propRow(l, tx.leading, '行距（倍）', { step: 0.01 }), propRow(l, tx.fill, '填充色'), propRow(l, tx.strokeColor, '描边色'), propRow(l, tx.strokeWidth, '描边宽度'),
      el('div', { class: 'small', text: '可用字体：' + Object.values(AE.Font.FAMILIES).map(f => f.name).join('、') + '。字符范围：' + AE.Font.RANGE + '。字形轮廓可转为程序几何（挤出/网格/形变）。' }),
    ];
    const pathUI = [
      row('路径', sel(Object.assign({ '': '（不沿路径）' }, Object.fromEntries(l.masks.map(m => [m.id, m.name]))), tx.path.mask || '', v => edit('路径文字', () => { tx.path.mask = v || null; }))),
      tx.path.mask ? propRow(l, tx.path.margin, '首字边距') : null,
      tx.path.mask ? row('选项', chk(tx.path.perpendicular !== false, v => edit('垂直于路径', () => { tx.path.perpendicular = v; }), '垂直于路径'), chk(tx.path.reverse, v => edit('反转路径', () => { tx.path.reverse = v; }), '反转')) : el('div', { class: 'small', text: '先用钢笔或椭圆工具（Alt 拖动）在此图层上画蒙版，再选为路径。' }),
    ].filter(Boolean);
    const anims = tx.animators.map((a, i) => {
      const box = el('div', { style: { borderLeft: '2px solid #4cc9f0', paddingLeft: '8px', margin: '6px 0' } });
      box.append(sub(a.name, [chk(a.on, v => edit('启用动画器', () => { a.on = v; })), ib('trash', '删除', () => edit('删除动画器', () => tx.animators.splice(i, 1)))]));
      box.append(row('依据', sel({ chars: '字符', words: '词', lines: '行' }, a.sel.basedOn, v => edit('选择依据', () => { a.sel.basedOn = v; })), sel({ square: '方形', rampUp: '上斜坡', rampDown: '下斜坡', triangle: '三角', round: '圆形', smooth: '平滑' }, a.sel.shape, v => edit('形状', () => { a.sel.shape = v; }))));
      box.append(row('', chk(a.sel.reverse, v => edit('反向', () => { a.sel.reverse = v; }), '反向选择')));
      for (const k of ['start', 'end', 'offset', 'softness']) box.append(propRow(l, a.sel[k], k === 'softness' ? '软边 %' : Mdl.label(k) + ' %'));
      const names = { position: '位置', rotation: '旋转', scale: '缩放', opacity: '不透明度', tracking: '字距', fillHue: '填充色相', rotX: 'X 旋转(3D)', rotY: 'Y 旋转(3D)' };
      box.append(row('属性', ...Object.keys(names).map(k => chk(!!a.use[k], v => edit('动画器属性', () => { a.use[k] = v; if (v && !a.props[k]) a.props[k] = Mdl.num(0); }), names[k]))));
      box.lastChild.querySelector('.ctl').style.flexWrap = 'wrap';
      for (const k in a.props) if (a.use[k]) box.append(propRow(l, a.props[k], names[k]));
      return box;
    });
    return [sect('l:text', '文字', base), sect('l:tpath', '路径文字', pathUI), sect('l:tanim', '文字动画器（逐字/词/行）', [...anims, row('', btn('＋ 字符动画器', () => edit('添加动画器', () => tx.animators.push(Mdl.textAnimator('动画器 ' + (tx.animators.length + 1), 'chars')))), btn('＋ 词', () => edit('添加动画器', () => tx.animators.push(Mdl.textAnimator('词动画器', 'words')))), btn('＋ 行', () => edit('添加动画器', () => tx.animators.push(Mdl.textAnimator('行动画器', 'lines')))))])];
  }
  // ---------- 摄像机 / 灯光 ----------
  function cameraPanel(l) {
    const c = l.camera;
    return [sect('l:cam', '摄像机选项', [
      propRow(l, c.zoom, '变焦(像素)'), row('视角', el('span', { class: 'small', text: '' + U.fmt(2 * Math.atan(App.comp().height / 2 / E.prop(c.zoom, App.t(), App.ctx(), l)) / U.deg, 1) + '°（垂直）' })),
      row('景深', chk(c.dof, v => edit('景深', () => { c.dof = v; }), '启用（按可见表面实际深度）')),
      propRow(l, c.focus, '对焦距离'), propRow(l, c.aperture, '光圈(像素)'), propRow(l, c.blurLevel, '模糊层次 %'),
      row('', btn('对焦到选中物体…', (e) => W.menu(e.clientX, e.clientY, App.comp().layers.filter(q => q.threeD && q !== l && q.type !== 'light').map(q => ({ label: q.name, fn: () => edit('对焦', () => { const W2 = E.world(q, App.t(), App.ctx()); const cw = E.world(l, App.t(), App.ctx()); const d = U.dot(U.sub([W2[12], W2[13], W2[14]], [cw[12], cw[13], cw[14]]), U.norm([cw[8], cw[9], cw[10]])); App.writeProp(c.focus, d); }) }))))),
    ])];
  }
  function lightPanel(l) {
    const g = l.light;
    return [sect('l:light', '灯光选项', [
      row('类型', sel({ parallel: '平行光', point: '点光源', ambient: '环境光' }, g.kind, v => edit('灯光类型', () => { g.kind = v; }))),
      propRow(l, g.color, '颜色'), propRow(l, g.intensity, '强度 %'), g.kind === 'point' ? propRow(l, g.falloffRadius, '衰减半径') : null,
      row('投射阴影', chk(g.cast, v => edit('投射阴影', () => { g.cast = v; }))), propRow(l, g.shadowDarkness, '阴影暗度 %'), propRow(l, g.shadowDiffusion, '阴影扩散'),
      el('div', { class: 'small', text: '第一盏投射阴影的灯光生成真实几何阴影贴图；二维投影效果与之独立。' }),
    ].filter(Boolean))];
  }
  // ---------- 预合成 ----------
  function precompPanel(l) {
    const pc = l.precomp, src = E.comp(pc.source);
    const comps = {}; for (const c of App.proj.comps) if (c !== App.comp()) comps[c.id] = c.name;
    const body = [
      row('源合成', sel(comps, pc.source, v => edit('更换源合成', () => { pc.source = v; })), btn('进入', () => App.openComp(pc.source, l.id))),
      row('空间模式', sel({ flat: '独立画面（内部相机渲染为平面）', keep3d: '保留三维（共享外层相机/灯光/阴影）' }, pc.space, v => edit('空间模式', () => { pc.space = v; if (v === 'keep3d') l.threeD = true; }))),
      el('div', { class: 'small', text: pc.space === 'keep3d' ? (l.effects.some(f => f.on) || l.masks.length ? '⚠ 已加整组蒙版/效果：形成离屏画面边界（先按外层相机渲染为画面，再处理并合成）。' : '内部几何经预合成变换进入外层空间；内部相机不参与投影。') : '内部按自身相机渲染为一张画面；打开“三维”后可作为三维表面。' }),
      row('速度 %', numIn(pc.speed, (v) => { pc.speed = Math.round(v); E.bump(); App.mark(); }, 1), el('span', { class: 'small', text: '负值 = 倒放' })),
      row('时间重映射', chk(pc.remapOn, v => edit('时间重映射', () => { pc.remapOn = v; if (v && !pc.remap.anim) { pc.remap.anim = true; pc.remap.keys = [Mdl.key(l.inPoint, 0), Mdl.key(Math.min(l.outPoint, l.inPoint + (src ? src.duration : 5)), src ? src.duration : 5)]; } }), '启用（支持变速/倒放/定格/子帧取样）')),
      pc.remapOn ? propRow(l, pc.remap, '源时间(秒)', { step: 0.01 }) : null,
      row('内部时间', el('span', { class: 'small', text: '' })),
    ].filter(Boolean);
    const itRow = body[body.length - 1].querySelector('.small');
    updaters.push(() => { itRow.textContent = U.fmt(E.innerTime(l, App.t(), App.ctx()), 3) + ' 秒（此实例当前取样的内部时刻）'; });
    const out = [sect('l:pc', '预合成实例', body)];
    if (src && src.params.length) {
      const ov = [];
      for (const prm of src.params) {
        const tl = E.layer(src, prm.layer), tp = tl && Mdl.getPath(tl, prm.path);
        if (!tp) continue;
        const o = pc.overrides[prm.id];
        const on = !!(o && o.on !== false && o.prop);
        ov.push(row(prm.name, chk(on, v => edit(v ? '覆盖参数' : '恢复继承', () => { if (v) { pc.overrides[prm.id] = { on: true, prop: U.clone(o && o.prop ? o.prop : Object.assign({}, tp, { keys: [], anim: false, expr: '', exprOn: false, value: U.clone(A.valueAt(tp, 0)) })) }; } else if (o) { o.on = false; } }), on ? '已覆盖' : '继承源合成')));
        if (on) ov.push(propRow(l, o.prop, '  ' + prm.name));
      }
      out.push(sect('l:pcov', '实例参数（独立覆盖 / 恢复继承）', ov));
    }
    return out;
  }
  // ---------- 三维几何 ----------
  function geoPanel(l) {
    const g = l.geo, s = g.source, out = [];
    const src = [row('类型', sel({ box: '长方体', sphere: '球体', torus: '圆环', plane: '平面（可细分）', extrude: '挤出（路径/文字）', node: '节点几何' }, s.kind, v => edit('几何类型', () => { const n = Mdl.newGeo(App.comp(), v); g.source = n.geo.source; })))];
    if (s.kind === 'extrude') {
      src.push(row('源图层', sel(layerOpts(q => q.type === 'shape' || q.type === 'text'), s.from.layer || '', v => edit('挤出源', () => { s.from.layer = v || null; s.from.output = ''; }))));
      src.push(row('或节点输出', sel(outputOpts(['geoOut']), s.from.output || '', v => edit('挤出源', () => { s.from.output = v; if (v) s.from.layer = null; }))));
      src.push(row('倒角分段', numIn(s.bevelSegs, v => { s.bevelSegs = U.clamp(Math.round(v), 1, 12); App.mark(); }, 0.05)));
    }
    if (s.kind === 'node') src.push(row('节点输出', sel(outputOpts(['geoOut']), s.output, v => edit('节点输出', () => { s.output = v; }))));
    for (const k in s) if (Mdl.isProp(s[k])) src.push(propRow(l, s[k], ({ size: '尺寸', bevel: '倒角', radius: '半径', segs: '分段', majorR: '主半径', minorR: '管半径', depth: '挤出深度' })[k]));
    const m = AE.R3.geoMesh(l, App.t(), App.ctx());
    if (m) src.push(el('div', { class: 'small', text: '网格：' + (m.pos.length / 3) + ' 顶点 · ' + (m.idx.length / 3) + ' 三角形 · 分区：' + Array.from(new Set(m.groups.map(x => ({ front: '正面', back: '背面', side: '侧壁', bevel: '倒角' })[x.mat]))).join('、') }));
    out.push(sect('l:geo', '几何源', src));
    // 变形器
    const dfn = { bend: '弯曲', twist: '扭转', field: '场变形', noise: '噪声', wave: '波浪' };
    const defs = g.deformers.map((d, i) => {
      const box = el('div', { style: { borderLeft: '2px solid #3ecf8e', paddingLeft: '8px', margin: '4px 0' } });
      box.append(sub(dfn[d.type], [chk(d.on, v => edit('启用变形', () => { d.on = v; })), ib('trash', '删除', () => edit('删除变形', () => g.deformers.splice(i, 1)))]));
      if (d.axis !== undefined) box.append(row('轴向', sel({ x: 'X', y: 'Y', z: 'Z' }, d.axis, v => edit('轴向', () => { d.axis = v; }))));
      if (d.type === 'field') box.append(row('场', sel(outputOpts(['fieldOut']), d.field, v => edit('场', () => { d.field = v; }))), row('方式', sel({ normal: '径向鼓出（标量）', vector: '向量位移' }, d.mode, v => edit('方式', () => { d.mode = v; }))));
      for (const k in d) if (Mdl.isProp(d[k])) box.append(propRow(l, d[k], ({ angle: '角度', range: '范围', center: '中心', amount: '强度', noiseScale: '尺度', speed: '速度', frequency: '频率' })[k]));
      return box;
    });
    out.push(sect('l:def', '几何变形（作用于实际顶点：法线/阴影/碰撞随之更新）', [...defs, row('', ...Object.entries(dfn).map(([k, v]) => btn('＋' + v, () => edit('添加变形', () => g.deformers.push(Mdl.deformer(k))))))]));
    // 实例
    const ins = g.instances;
    const instUI = [row('分布', sel({ none: '无', grid: '空间阵列', radial: '环形阵列', path: '沿路径' }, ins.mode, v => edit('实例分布', () => { ins.mode = v; if (!ins.phase) ins.phase = Mdl.num(0); if (!ins.fieldAmount) ins.fieldAmount = Mdl.num(1); })))];
    if (ins.mode !== 'none') {
      instUI.push(propRow(l, ins.count, '数量'), propRow(l, ins.spacing, ins.mode === 'radial' ? '半径/椭圆/深度' : '间距'));
      if (ins.phase) instUI.push(propRow(l, ins.phase, '相位'));
      if (ins.mode === 'path') instUI.push(row('路径图层', sel(layerOpts(q => q.type === 'shape'), ins.path || '', v => edit('路径', () => { ins.path = v || null; }))));
      instUI.push(row('场影响排布', sel(outputOpts(['fieldOut']), ins.field || '', v => edit('实例场', () => { ins.field = v; }))));
      if (ins.field && ins.fieldAmount) instUI.push(propRow(l, ins.fieldAmount, '场位移强度'));
    }
    out.push(sect('l:inst', '实例（源几何修改传播到所有实例）', instUI));
    // 材质
    const mats = Object.keys(g.mats).map(k => {
      const mt = g.mats[k];
      const box = el('div', { style: { margin: '4px 0 8px' } }, sub(({ front: '正面', side: '侧面', bevel: '倒角', back: '背面' })[k] + '材质', [btn('应用到全部', () => edit('统一材质', () => { for (const q in g.mats) if (q !== k) g.mats[q] = U.clone(mt); }))]));
      for (const q of ['baseColor', 'metallic', 'roughness', 'emissive', 'emissiveStrength', 'opacity']) box.append(propRow(l, mt[q], Mdl.label(q), { step: q === 'metallic' || q === 'roughness' ? 0.01 : 1 }));
      box.append(row('场驱动', sel({ none: '无', emissive: '发光', roughness: '粗糙度', metallic: '金属度', baseColor: '基础色→发光色' }, mt.fieldTarget || 'none', v => edit('材质场', () => { mt.fieldTarget = v; })), sel(outputOpts(['fieldOut']), mt.field || '', v => edit('材质场', () => { mt.field = v; }))));
      if (mt.fieldTarget && mt.fieldTarget !== 'none') box.append(propRow(l, mt.fieldAmount, '场强度', { step: 0.01 }));
      return box;
    });
    out.push(sect('l:mats', '材质（分区：正面 / 侧面 / 倒角 / 背面）', [...mats, row('预设', ...[['抛光金属', [0.9, 0.9, 0.92, 1], 1, 0.12], ['拉丝金', [1, 0.78, 0.45, 1], 1, 0.38], ['亚光陶瓷', [0.92, 0.9, 0.86, 1], 0, 0.75], ['光泽塑料', [0.95, 0.35, 0.25, 1], 0, 0.2]].map(([n, c, me, ro]) => btn(n, () => edit('材质预设', () => { for (const k in g.mats) { g.mats[k].baseColor.value = c.slice(); g.mats[k].metallic.value = me; g.mats[k].roughness.value = ro; } }))))]));
    out[out.length - 1].querySelector('.sect-b').lastChild.querySelector('.ctl').style.flexWrap = 'wrap';
    return out;
  }
  // ---------- 粒子 ----------
  function curveEditor(pts, onChange, range = [0, 1]) {
    const box = el('div', { class: 'curvebox' }), c = el('canvas'); box.append(c);
    const draw = () => {
      const f = W.fitCanvas(c), x = c.getContext('2d'); x.setTransform(f.d, 0, 0, f.d, 0, 0); x.clearRect(0, 0, f.w, f.h);
      x.strokeStyle = '#272c37'; x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo(f.w * i / 4, 0); x.lineTo(f.w * i / 4, f.h); } x.stroke();
      const X = t => t * f.w, Y = v => f.h - 4 - (v - range[0]) / (range[1] - range[0]) * (f.h - 8);
      x.strokeStyle = '#ff9f43'; x.lineWidth = 1.5; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.stroke();
      x.fillStyle = '#ffb86b'; pts.forEach(p => { x.fillRect(X(p[0]) - 3, Y(p[1]) - 3, 6, 6); });
    };
    box.addEventListener('mousedown', (e) => {
      const r = box.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = range[0] + (1 - (e.clientY - r.top - 4) / (r.height - 8)) * (range[1] - range[0]);
      let idx = pts.findIndex(p => Math.abs(p[0] - fx) * r.width < 7 && Math.abs(p[1] - fy) / (range[1] - range[0]) * r.height < 9);
      App.begin();
      if (e.button === 2 && idx > 0 && idx < pts.length - 1) { pts.splice(idx, 1); onChange(); draw(); App.commit('删除曲线点'); return; }
      if (idx < 0) { pts.push([U.clamp(fx, 0, 1), fy]); pts.sort((a, b) => a[0] - b[0]); idx = pts.findIndex(p => p[0] === U.clamp(fx, 0, 1)); }
      const mm = (ev) => { const nx = U.clamp((ev.clientX - r.left) / r.width, 0, 1), ny = U.clamp(range[0] + (1 - (ev.clientY - r.top - 4) / (r.height - 8)) * (range[1] - range[0]), range[0], range[1]); pts[idx][1] = ny; if (idx > 0 && idx < pts.length - 1) pts[idx][0] = U.clamp(nx, pts[idx - 1][0] + 0.01, pts[idx + 1][0] - 0.01); onChange(); draw(); };
      const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); App.commit('编辑生命周期曲线'); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    });
    box.addEventListener('contextmenu', e => e.preventDefault());
    setTimeout(draw, 0);
    return box;
  }
  function particlePanel(l) {
    const P = l.particles, out = [];
    const info = el('div', { class: 'small' });
    updaters.push(() => { const inf = AE.Particles.info(l, App.ctx()); info.textContent = inf ? `活动粒子 ${inf.count} · 检查点 ${inf.checkpoints} · 已触发事件 ${inf.events} · 模拟到 ${inf.t.toFixed(2)}s` : '尚未模拟'; });
    out.push(sect('l:psim', '模拟', [row('随机种子', numIn(P.seed, v => { P.seed = Math.round(v); App.mark(); }, 0.2)), row('最大数量', numIn(P.max, v => { P.max = U.clamp(Math.round(v), 10, 20000); App.mark(); }, 5)), row('步长(Hz)', sel({ 30: '30', 60: '60', 90: '90', 120: '120' }, P.step, v => edit('模拟步长', () => { P.step = +v; }))), info, row('缓存', btn('从起点重算', () => { AE.Particles.invalidate(l); App.mark(); }), el('span', { class: 'small', text: '检查点每 0.25 秒；跳转/倒放读取同一结果' }))]));
    const ems = P.emitters.map((em, i) => {
      const box = el('div', { style: { borderLeft: '2px solid #ff9f43', paddingLeft: '8px', margin: '4px 0' } });
      box.append(sub(em.name, [chk(em.on !== false, v => edit('发射器', () => { em.on = v; })), ib('trash', '删除', () => edit('删除发射器', () => P.emitters.splice(i, 1)))]));
      box.append(row('发射源', sel({ point: '点', curve: '曲线（路径）', surface: '几何表面' }, em.kind, v => edit('发射源', () => { em.kind = v; em.useNormal = v === 'surface'; }))));
      if (em.kind !== 'point') box.append(row('源图层', sel(layerOpts(q => ['shape', 'text', 'geo3d'].includes(q.type)), em.layer || '', v => edit('源', () => { em.layer = v || null; if (v) em.output = ''; }))), row('或节点', sel(outputOpts(['emitOut', 'geoOut']), em.output || '', v => edit('源', () => { em.output = v; if (v) em.layer = null; }))), row('', chk(em.useNormal, v => edit('沿法线', () => { em.useNormal = v; }), '沿表面法线发射')));
      for (const k of ['position', 'rate', 'speed', 'spread', 'direction', 'life', 'drag', 'inherit', 'color']) if (em[k] && (k !== 'position' || em.kind === 'point')) box.append(propRow(l, em[k], ({ inherit: '继承速度', color: '颜色' })[k] || Mdl.label(k)));
      box.append(row('随机', el('span', { class: 'small', text: '速度' }), numIn(em.speedRand, v => { em.speedRand = U.clamp(v, 0, 1); App.mark(); }, 0.01), el('span', { class: 'small', text: '寿命' }), numIn(em.lifeRand, v => { em.lifeRand = U.clamp(v, 0, 1); App.mark(); }, 0.01), el('span', { class: 'small', text: '大小' }), numIn(em.sizeRand, v => { em.sizeRand = U.clamp(v, 0, 1); App.mark(); }, 0.01)));
      box.append(row('质量', numIn(em.mass, v => { em.mass = Math.max(0.01, v); App.mark(); }, 0.01), el('span', { class: 'small', text: '大小' }), numIn(em.size, v => { em.size = Math.max(0.01, v); App.mark(); }, 0.01)));
      box.append(row('爆发', el('span', { class: 'small', text: (em.bursts || []).map(b => b.t.toFixed(2) + 's×' + b.count).join('，') || '无' }), btn('＋在当前时刻', () => edit('添加爆发', () => { em.bursts = em.bursts || []; em.bursts.push({ t: App.t() - l.inPoint, count: 60 }); })), (em.bursts || []).length ? btn('清空', () => edit('清空爆发', () => { em.bursts = []; })) : null));
      return box;
    });
    out.push(sect('l:pem', '发射器', [...ems, row('', btn('＋ 发射器', () => edit('添加发射器', () => P.emitters.push(Mdl.emitter('point')))))]));
    const fn = { gravity: '重力', direction: '方向力', attract: '吸引/排斥', vortex: '旋涡', noise: '噪声', field: '场力' };
    const fs = P.forces.map((f, i) => {
      const box = el('div', { style: { borderLeft: '2px solid #ff5d8f', paddingLeft: '8px', margin: '4px 0' } });
      box.append(sub(fn[f.type], [chk(f.on !== false, v => edit('力', () => { f.on = v; })), ib('trash', '删除', () => edit('删除力', () => P.forces.splice(i, 1)))]));
      if (f.type === 'attract' || f.type === 'vortex') box.append(row('跟随图层', sel(layerOpts(), f.layer || '', v => edit('力中心', () => { f.layer = v || null; }))));
      if (f.type === 'field') box.append(row('场', sel(outputOpts(['fieldOut']), f.field, v => edit('场', () => { f.field = v; }))));
      for (const k in f) if (Mdl.isProp(f[k])) box.append(propRow(l, f[k], Mdl.label(k)));
      return box;
    });
    out.push(sect('l:pf', '力场（可组合，带空间衰减）', [...fs, row('', ...Object.entries(fn).map(([k, v]) => btn('＋' + v, () => edit('添加力', () => P.forces.push(Mdl.force(k))))))]));
    out[out.length - 1].querySelector('.sect-b').lastChild.querySelector('.ctl').style.flexWrap = 'wrap';
    const cs = P.colliders.map((c, i) => {
      const box = el('div', { style: { borderLeft: '2px solid #4cc9f0', paddingLeft: '8px', margin: '4px 0' } });
      box.append(sub(c.name, [chk(c.on !== false, v => edit('碰撞体', () => { c.on = v; })), ib('trash', '删除', () => edit('删除碰撞体', () => P.colliders.splice(i, 1)))]));
      box.append(row('类型', sel({ plane: '运动平面', mesh: '网格（实体/可变形）' }, c.kind, v => edit('碰撞类型', () => { c.kind = v; }))));
      box.append(row('图层', sel(layerOpts(q => c.kind === 'mesh' ? q.type === 'geo3d' : q.type !== 'audio'), c.layer || '', v => edit('碰撞图层', () => { c.layer = v || null; if (v) c.output = ''; }))));
      if (c.kind === 'mesh') box.append(row('或节点', sel(outputOpts(['colliderOut', 'geoOut']), c.output || '', v => edit('碰撞节点', () => { c.output = v; if (v) c.layer = null; }))));
      box.append(propRow(l, c.bounce, '弹性'), propRow(l, c.friction, '摩擦'));
      box.append(row('触发事件', sel(Object.assign({ '': '（无）' }, Object.fromEntries(P.events.map(e => [e.id, e.name]))), c.event || '', v => edit('碰撞事件', () => { c.event = v; }))));
      return box;
    });
    out.push(sect('l:pc', '碰撞（使用当前表面、法线与相对运动）', [...cs, row('', btn('＋ 平面', () => edit('添加碰撞体', () => P.colliders.push(Mdl.collider('plane')))), btn('＋ 网格', () => edit('添加碰撞体', () => P.colliders.push(Mdl.collider('mesh')))))]));
    const evs = P.events.map((ev, i) => {
      const box = el('div', { style: { borderLeft: '2px solid #f2c14e', paddingLeft: '8px', margin: '4px 0' } });
      box.append(sub(ev.name, [ib('trash', '删除', () => edit('删除事件', () => P.events.splice(i, 1)))]));
      box.append(row('名称', txt(ev.name, v => edit('事件名', () => { ev.name = v; }))), row('', chk(ev.setColor, v => edit('事件', () => { ev.setColor = v; }), '改变颜色'), chk(ev.once, v => edit('事件', () => { ev.once = v; }), '每粒子一次')));
      box.append(propRow(l, ev.color, '新颜色'), propRow(l, ev.lifeScale, '剩余寿命×', { step: 0.01 }), propRow(l, ev.impulse, '附加冲量'), propRow(l, ev.spawn, '次级粒子数'), propRow(l, ev.spawnSpeed, '次级速度'), propRow(l, ev.spawnLife, '次级寿命', { step: 0.01 }));
      return box;
    });
    out.push(sect('l:pev', '事件', [...evs, row('', btn('＋ 碰撞事件', () => edit('添加事件', () => P.events.push(Mdl.event('碰撞事件 ' + (P.events.length + 1))))))]));
    const lk = P.look;
    const look = [
      row('呈现', sel({ sprite: '光点', shape: '自制形状（图层）', mesh: '三维几何（受光）' }, lk.mode, v => edit('粒子呈现', () => { lk.mode = v; }))),
      lk.mode === 'shape' ? row('形状图层', sel(layerOpts(q => q.type === 'shape' || q.type === 'text'), lk.shape || '', v => edit('粒子形状', () => { lk.shape = v || null; }))) : null,
      lk.mode === 'mesh' ? row('几何', sel({ tetra: '四面体', cube: '立方体', sphere: '球' }, lk.meshKind, v => edit('粒子几何', () => { lk.meshKind = v; }))) : null,
      row('混合', sel({ add: '相加（发光）', normal: '正常' }, lk.blend, v => edit('粒子混合', () => { lk.blend = v; }))),
      propRow(l, lk.size, '大小'), propRow(l, lk.spin, '自旋 °/s'), propRow(l, lk.glow, '辉光', { step: 0.01 }),
      sub('大小 / 生命周期'), curveEditor(lk.sizeLife, () => App.mark(), [0, 2]),
      sub('不透明度 / 生命周期'), curveEditor(lk.opacityLife, () => App.mark(), [0, 1]),
      sub('颜色 / 生命周期'), row('色标', ...lk.colorLife.map(s => W.colorInput(s[1], c => { s[1] = c; App.mark(); }, () => App.begin(), () => App.commit('粒子颜色'))), btn('＋', () => edit('添加色标', () => { lk.colorLife.push([1, lk.colorLife[lk.colorLife.length - 1][1].slice()]); lk.colorLife.forEach((s, i) => { s[0] = i / (lk.colorLife.length - 1); }); }))),
    ].filter(Boolean);
    out.push(sect('l:plook', '外观（按生命周期变化）', look));
    const tr = P.trail;
    out.push(sect('l:ptr', '拖尾（基于实际轨迹）', [row('启用', chk(tr.on, v => edit('拖尾', () => { tr.on = v; }))), propRow(l, tr.length, '长度(秒)', { step: 0.01 }), propRow(l, tr.width, '宽度'), propRow(l, tr.color, '颜色'), propRow(l, tr.fade, '消退', { step: 0.01 }), row('', chk(tr.useParticleColor, v => edit('拖尾色', () => { tr.useParticleColor = v; }), '使用粒子颜色'))]));
    return out;
  }
  // ---------- 声音 ----------
  function synthPanel(l) {
    const s = l.synth;
    const roll = AE.Audio ? AE.Audio.pianoRoll(l) : el('div');
    return [sect('l:syn', '音色（内置合成器）', [
      row('预设', sel(AE.Audio ? AE.Audio.PRESETS : {}, s.preset, v => edit('音色预设', () => { s.preset = v; }))),
      row('波形', sel({ saw: '锯齿', square: '方波', triangle: '三角', sine: '正弦' }, s.wave, v => edit('波形', () => { s.wave = v; }))),
      propRow(l, s.volume, '音量 dB'), propRow(l, s.pan, '声像 -1…1', { step: 0.01 }), propRow(l, s.cutoff, '截止频率'), propRow(l, s.attack, '起音(秒)', { step: 0.002 }), propRow(l, s.release, '释音(秒)', { step: 0.005 }), propRow(l, s.detune, '失谐(音分)'),
      sub('音符 / 节奏（单击添加，拖动移动，右键删除；时间相对图层入点）'), roll,
      row('', btn('试听', () => AE.Audio && AE.Audio.preview(l)), el('span', { class: 'small', text: s.notes.length + ' 个音符' })),
    ])];
  }
  function audioPanel(l) {
    const a = l.audio, assets = { '': '（无）' }; for (const x of App.proj.assets) if (x.type === 'audio') assets[x.id] = x.name;
    return [sect('l:aud', '音频', [row('素材', sel(assets, a.asset || '', v => edit('音频素材', () => { a.asset = v; })), btn('导入…', () => AE.IO.importAudio(l))), propRow(l, a.volume, '音量 dB'), propRow(l, a.pan, '声像', { step: 0.01 })])];
  }
  // ---------- 蒙版 / 效果 ----------
  function masksPanel(l) {
    const ms = l.masks.map((m, i) => {
      const box = el('div', { style: { borderLeft: '2px solid ' + (App.sel.item === m.id ? '#ffd166' : '#5a4a1a'), paddingLeft: '8px', margin: '4px 0' } });
      box.append(sub(m.name, [chk(m.on !== false, v => edit('蒙版', () => { m.on = v; })), ib('trash', '删除', () => edit('删除蒙版', () => l.masks.splice(i, 1)))]));
      box.firstChild.style.cursor = 'pointer'; box.firstChild.addEventListener('click', (e) => { if (e.target.closest('.acts')) return; App.sel.item = m.id; App.mark(); });
      box.append(row('模式', sel({ add: '相加', subtract: '相减', intersect: '交集', lighten: '变亮', none: '无（仅作路径）' }, m.mode, v => edit('蒙版模式', () => { m.mode = v; })), chk(m.inverted, v => edit('反转蒙版', () => { m.inverted = v; }), '反转')));
      box.append(propRow(l, m.path, '蒙版路径', { itemId: m.id }), propRow(l, m.feather, '羽化'), propRow(l, m.opacity, '不透明度'), propRow(l, m.expansion, '扩展'));
      return box;
    });
    const b = AE.R.contentBounds(l, App.t(), App.ctx()) || [0, 0, 400, 300];
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = (b[2] - b[0]) * 0.6, h = (b[3] - b[1]) * 0.6;
    return sect('l:masks', '蒙版（' + l.masks.length + '）', [...ms, row('', btn('＋ 矩形', () => edit('添加蒙版', () => { const m = Mdl.mask([AE.Path.rect(cx, cy, w, h)]); m.name = '蒙版 ' + (l.masks.length + 1); l.masks.push(m); App.sel.item = m.id; })), btn('＋ 椭圆', () => edit('添加蒙版', () => { const m = Mdl.mask([AE.Path.ellipse(cx, cy, w, h)]); m.name = '蒙版 ' + (l.masks.length + 1); l.masks.push(m); App.sel.item = m.id; })), el('span', { class: 'small', text: '或用钢笔绘制' }))]);
  }
  function effectsPanel(l) {
    const fxs = l.effects.map((f, i) => {
      const box = el('div', { style: { borderLeft: '2px solid #9b8cff', paddingLeft: '8px', margin: '4px 0' } });
      box.append(sub(f.name, [chk(f.on, v => edit('启用效果', () => { f.on = v; })), ib('chevron', '上移', () => edit('效果排序', () => { if (i > 0) { l.effects.splice(i, 1); l.effects.splice(i - 1, 0, f); } })), ib('trash', '删除', () => edit('删除效果', () => l.effects.splice(i, 1)))]));
      if (f.type === 'glow') box.append(row('', chk(f.useColor, v => edit('发光颜色', () => { f.useColor = v; }), '使用指定颜色')));
      if (f.type === 'echo') box.append(row('运算', sel({ add: '相加', screen: '滤色', max: '最大值', behind: '置后合成' }, f.mode, v => edit('回声运算', () => { f.mode = v; }))));
      if (f.type === 'timeDisplace') box.append(row('控制图层', sel(layerOpts(q => q !== l), f.mapLayer || '', v => edit('时间置换图层', () => { f.mapLayer = v || null; }))), row('', chk(f.invert, v => edit('反转', () => { f.invert = v; }), '反转映射')));
      for (const k in f.p) box.append(propRow(l, f.p[k], ({ threshold: '阈值 %', radius: '半径', intensity: '强度', color: '颜色', opacity: '不透明度', angle: '方向(画面)', distance: '距离', softness: '柔和度', hue: '色相 °', sat: '饱和度 %', light: '亮度 %', time: '回声时间(秒)', count: '回声数量', decay: '衰减', maxShift: '最大时移(秒)', slices: '时间分辨率', mapOffset: '映射位置', mapScale: '映射缩放 %', amount: '数量 %' })[k] || Mdl.label(k), { step: k === 'time' || k === 'decay' || k === 'intensity' || k === 'maxShift' ? 0.005 : 0.5 }));
      return box;
    });
    return sect('l:effects', '效果（' + l.effects.length + '，自上而下处理）', [...fxs, row('', btn('＋ 添加效果', (e) => W.menu(e.clientX, e.clientY, Object.entries(Mdl.EFFECT_NAMES).map(([k, v]) => ({ label: v, fn: () => edit('添加' + v, () => l.effects.push(Mdl.effect(k))) })))))]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
