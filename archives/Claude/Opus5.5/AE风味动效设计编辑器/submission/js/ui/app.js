// 应用状态、历史记录、命令、播放、快捷键、布局
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, E = AE.Eval, A = AE.Anim, Mdl = AE.Model, W = AE.W;
  const App = AE.App = {
    proj: null, stack: [], time: 0, playing: false, loop: true,
    sel: { layers: [], keys: new Set(), props: new Set(), item: null, nodes: new Set(), pin: null },
    tool: 'select', workspace: 'anim', bottomTab: 'timeline',
    hist: { undo: [], redo: [], cur: null, open: 0 },
    dirty: { viewer: true, timeline: true, props: true, graph: true, nodes: true, project: true },
    clip: null, panels: {}, quality: 'auto', exporting: false, interact: false,
  };
  App.status = (s) => { const e = document.getElementById('status'); if (e) e.textContent = s; };
  App.mark = (...k) => { if (!k.length) k = ['viewer', 'timeline', 'props', 'graph', 'nodes', 'project']; for (const x of k) App.dirty[x] = true; };

  // ---------- 合成栈 / 时间 ----------
  App.rootComp = () => E.comp(App.stack[0].comp);
  App.comp = () => E.comp(App.stack[App.stack.length - 1].comp);
  App.chain = () => {
    let comp = App.rootComp(), ctx = E.root(comp), t = App.time;
    for (let i = 1; i < App.stack.length; i++) {
      const layer = E.layer(comp, App.stack[i].layer);
      if (!layer) { App.stack.length = i; break; }
      const c2 = E.child(ctx, layer, t), t2 = E.innerTime(layer, t, ctx);
      comp = c2.comp; ctx = c2; t = t2;
    }
    return { comp, ctx, t };
  };
  App.ctx = () => App.chain().ctx;
  App.t = () => App.chain().t;
  App.fps = () => App.comp().fps;
  // 设置当前（最内层）合成时间：逐层反解到根时间
  App.setTime = (tInner, opts = {}) => {
    const comp = App.comp();
    tInner = U.clamp(tInner, 0, comp.duration);
    if (!opts.free) tInner = Math.round(tInner * comp.fps) / comp.fps;
    if (App.stack.length === 1) { App.time = tInner; }
    else {
      // 反解：在父层入出点范围内搜索
      let target = tInner;
      for (let i = App.stack.length - 1; i >= 1; i--) {
        const parentComp = E.comp(App.stack[i - 1].comp), layer = E.layer(parentComp, App.stack[i].layer);
        const pctx = chainCtx(i - 1);
        let best = null, bd = Infinity;
        const step = 1 / (parentComp.fps * 4);
        for (let t = Math.max(0, layer.inPoint); t <= Math.min(parentComp.duration, layer.outPoint); t += step) {
          const d = Math.abs(E.innerTime(layer, t, pctx) - target); if (d < bd - 1e-9) { bd = d; best = t; }
        }
        target = best === null ? App.time : best;
      }
      App.time = target;
    }
    App.onTime();
  };
  function chainCtx(level) { let comp = App.rootComp(), ctx = E.root(comp), t = App.time; for (let i = 1; i <= level; i++) { const layer = E.layer(comp, App.stack[i].layer); const c2 = E.child(ctx, layer, t); t = E.innerTime(layer, t, ctx); comp = c2.comp; ctx = c2; } return ctx; }
  App.onTime = () => { App.mark('viewer', 'timeline', 'props', 'graph', 'nodes'); if (App.audio && App.playing) { } };
  App.openComp = (compId, viaLayer) => {
    if (viaLayer) App.stack.push({ comp: compId, layer: viaLayer });
    else { App.stack = [{ comp: compId }]; App.time = Math.min(App.time, E.comp(compId).duration); }
    App.sel.layers = []; App.sel.keys.clear(); App.sel.props.clear(); App.sel.item = null;
    App.panels.viewer && App.panels.viewer.fit();
    App.mark();
  };
  App.popTo = (level) => { App.stack.length = level + 1; App.sel.layers = []; App.sel.keys.clear(); App.mark(); };

  // ---------- 历史 ----------
  App.snapshot = () => Mdl.serialize(App.proj);
  App.resetHistory = () => { App.hist = { undo: [], redo: [], cur: App.snapshot(), open: 0 }; };
  App.begin = () => { App.hist.open++; };
  App.commit = (label) => {
    App.hist.open = Math.max(0, App.hist.open - 1);
    if (App.hist.open > 0) return;
    E.bump();
    const s = App.snapshot();
    if (s === App.hist.cur) { App.mark(); return; }
    App.hist.undo.push({ s: App.hist.cur, label: label || '编辑' });
    if (App.hist.undo.length > 200) App.hist.undo.shift();
    App.hist.redo = [];
    App.hist.cur = s;
    if (label) App.status(label);
    App.mark();
    App.autosave();
  };
  App.edit = (label, fn) => { App.begin(); try { fn(); } finally { App.commit(label); } };
  App.restore = (s) => {
    const selIds = App.sel.layers.slice();
    App.proj = Mdl.deserialize(s);
    E.bump(); E.index(App.proj);
    App.sel.keys.clear(); App.sel.props.clear();
    const comp = App.comp(); App.sel.layers = comp ? selIds.filter(id => E.layer(comp, id)) : [];
    if (!App.comp()) App.stack = [{ comp: App.proj.mainComp || App.proj.comps[0].id }];
    App.mark();
  };
  App.undo = () => { const h = App.hist; if (!h.undo.length) { W.toast('没有可撤销的操作'); return; } const e = h.undo.pop(); h.redo.push({ s: h.cur, label: e.label }); h.cur = e.s; App.restore(e.s); App.status('撤销：' + e.label); };
  App.redo = () => { const h = App.hist; if (!h.redo.length) { W.toast('没有可重做的操作'); return; } const e = h.redo.pop(); h.undo.push({ s: h.cur, label: e.label }); h.cur = e.s; App.restore(e.s); App.status('重做：' + e.label); };
  let saveT = null;
  App.autosave = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('motion-autosave', App.hist.cur); } catch (e) { } }, 1500); };

  // ---------- 选择 ----------
  App.layers = () => App.sel.layers.map(id => E.layer(App.comp(), id)).filter(Boolean);
  App.layer = () => App.layers()[0] || null;
  App.select = (id, add) => {
    if (!id) { App.sel.layers = []; }
    else if (add) { const i = App.sel.layers.indexOf(id); if (i >= 0) App.sel.layers.splice(i, 1); else App.sel.layers.push(id); }
    else App.sel.layers = [id];
    App.sel.item = null; App.sel.pin = null;
    App.mark('viewer', 'timeline', 'props', 'graph');
  };
  App.selectAll = () => { App.sel.layers = App.comp().layers.map(l => l.id); App.mark(); };

  // ---------- 图层命令 ----------
  const insertLayer = (l, comp = App.comp()) => {
    const sel = App.layer();
    const idx = sel ? comp.layers.indexOf(sel) : 0;
    comp.layers.splice(Math.max(0, idx), 0, l);
    App.sel.layers = [l.id];
    return l;
  };
  App.newLayer = (type, opts = {}) => {
    const comp = App.comp(); let l;
    App.edit('新建' + (Mdl.TYPE_NAMES[type] || '') + '图层', () => {
      if (type === 'shape') l = Mdl.newShapeLayer(comp, opts.name || '形状图层 ' + (comp.layers.length + 1), opts.items || [Mdl.shape.group('矩形 1', [Mdl.shape.rect(300, 200, 16), Mdl.shape.fill([1, 0.62, 0.26, 1]), Mdl.shape.stroke([1, 1, 1, 1], 0)])]);
      else if (type === 'text') l = Mdl.newTextLayer(comp, opts.text || '文字', { size: 110 });
      else if (type === 'null') l = Mdl.newNull(comp, opts.name);
      else if (type === 'solid') l = Mdl.newSolid(comp, opts.name, opts.color);
      else if (type === 'adjust') l = Mdl.newAdjust(comp);
      else if (type === 'camera') { l = Mdl.newCamera(comp); }
      else if (type === 'light') l = Mdl.newLight(comp, opts.kind || 'point');
      else if (type === 'geo3d') { l = Mdl.newGeo(comp, opts.kind || 'box', opts.name); }
      else if (type === 'particles') { l = Mdl.newParticles(comp); l.particles.emitters[0].position.value = [comp.width / 2, comp.height / 2, 0]; }
      else if (type === 'synth') { l = Mdl.newSynth(comp, '音色', opts.preset || 'pluck'); l.synth.notes = [Mdl.note(0, 0.25, 60), Mdl.note(0.5, 0.25, 64), Mdl.note(1, 0.25, 67), Mdl.note(1.5, 0.5, 72)]; }
      else if (type === 'audio') { l = Mdl.newAudio(comp, opts.asset, opts.name); }
      else if (type === 'precomp') { l = Mdl.newPrecomp(comp, E.comp(opts.source)); }
      if (opts.at !== undefined && l) { l.inPoint = opts.at; }
      insertLayer(l, comp);
    });
    return l;
  };
  App.deleteSelected = () => {
    if (App.sel.keys.size) { App.deleteKeys(); return; }
    if (App.panels.nodes && App.workspace === 'nodes' && App.sel.nodes.size) { App.panels.nodes.deleteSel(); return; }
    const ls = App.layers(); if (!ls.length) { W.toast('没有选中的图层或关键帧'); return; }
    App.edit('删除图层', () => {
      const comp = App.comp(), ids = new Set(ls.map(l => l.id));
      comp.layers = comp.layers.filter(l => !ids.has(l.id));
      for (const l of comp.layers) { if (ids.has(l.parent)) l.parent = null; if (l.matte && ids.has(l.matte.layer)) l.matte = null; }
      App.sel.layers = [];
    });
  };
  App.duplicate = () => {
    const ls = App.layers(); if (!ls.length) { W.toast('请先选择要复制的图层'); return; }
    App.edit('复制图层', () => {
      const comp = App.comp(), map = new Map(), news = [];
      for (const l of ls) { const c = Mdl.deserialize(Mdl.serialize(l)); c.id = Mdl.newId('ly'); c.name = l.name + ' 副本'; reid(c); map.set(l.id, c.id); news.push([l, c]); }
      for (const [l, c] of news) { if (map.has(c.parent)) c.parent = map.get(c.parent); if (c.matte && map.has(c.matte.layer)) c.matte.layer = map.get(c.matte.layer); comp.layers.splice(comp.layers.indexOf(l), 0, c); }
      App.sel.layers = news.map(x => x[1].id);
    });
  };
  function reid(o) { if (!o || typeof o !== 'object') return; for (const k in o) { if (k === 'id' && typeof o[k] === 'string' && o !== null && /^(sh|mk|fx|ta|df|em|fc|co|ev)/.test(o[k])) o[k] = Mdl.newId(o[k].slice(0, 2)); else reid(o[k]); } }
  App.reorder = (dir) => {
    const ls = App.layers(); if (!ls.length) return;
    App.edit('调整图层顺序', () => {
      const L = App.comp().layers;
      const idxs = ls.map(l => L.indexOf(l)).sort((a, b) => dir < 0 ? a - b : b - a);
      for (const i of idxs) { const j = i + dir; if (j < 0 || j >= L.length) continue; if (ls.includes(L[j])) continue; [L[i], L[j]] = [L[j], L[i]]; }
    });
  };
  App.setParent = (layer, pid) => {
    if (pid === layer.id) return;
    // 防止循环
    let p = pid; const comp = App.comp(); let guard = 0;
    while (p && guard++ < 64) { if (p === layer.id) { W.toast('不能设置为自身后代的子级', true); return; } const pl = E.layer(comp, p); p = pl && pl.parent; }
    App.edit(pid ? '设置父级' : '解除父级', () => E.setParent(comp, layer, pid, App.t()));
  };
  App.precompose = () => {
    const ls = App.layers(); if (!ls.length) { W.toast('请先选择要预合成的图层'); return; }
    const comp = App.comp();
    App.edit('预合成', () => {
      const nc = Mdl.newComp({ name: (ls[0].name || '预合成') + ' 合成', width: comp.width, height: comp.height, fps: comp.fps, duration: comp.duration, bg: [0, 0, 0, 0] });
      nc.motionBlur = U.clone(comp.motionBlur); nc.env = U.clone(comp.env);
      const ids = new Set(ls.map(l => l.id));
      // 保留顺序；被移入层的外部父级链以“空对象副本”带入（保留父级动画与表达式）
      const moved = comp.layers.filter(l => ids.has(l.id));
      const proxies = new Map();
      const proxyOf = (pid, depth = 0) => {
        if (proxies.has(pid)) return proxies.get(pid);
        const P = E.layer(comp, pid); if (!P || depth > 16) return null;
        const c = Mdl.deserialize(Mdl.serialize(P));
        const nl = Mdl.newNull(nc, P.name); nl.proxyOf = P.id; // 同名代理：表达式引用仍可解析 nl.threeD = P.threeD; nl.transform = c.transform; nl.inPoint = 0; nl.outPoint = nc.duration;
        if (P.type === 'camera' || (P.type === 'light' && P.light.kind !== 'point')) { nl.transform = Mdl.transform(); const W0 = E.world(P, App.t(), E.root(comp)); nl.threeD = true; }
        proxies.set(pid, nl.id); nc.layers.push(nl);
        if (P.parent) { const gp = ids.has(P.parent) ? P.parent : proxyOf(P.parent, depth + 1); nl.parent = gp; }
        return nl.id;
      };
      for (const l of moved) { if (l.parent && !ids.has(l.parent)) l.parent = proxyOf(l.parent); }
      // 相机与灯光复制到内部以保持三维外观
      for (const l of comp.layers) if ((l.type === 'camera' || l.type === 'light') && !ids.has(l.id) && moved.some(m => m.threeD)) { const c = Mdl.deserialize(Mdl.serialize(l)); c.id = Mdl.newId('ly'); if (c.parent) c.parent = proxyOf(c.parent); nc.layers.push(c); }
      nc.layers = moved.concat(nc.layers.filter(l => !moved.includes(l)));
      // 图钉 / 遮罩引用：仍指向集合内的层
      const idx = comp.layers.indexOf(moved[0]);
      comp.layers = comp.layers.filter(l => !ids.has(l.id));
      App.proj.comps.push(nc);
      const pl = Mdl.newPrecomp(comp, nc, nc.name);
      pl.transform.position.value = [comp.width / 2, comp.height / 2, 0];
      pl.inPoint = 0; pl.outPoint = comp.duration;
      if (moved.every(m => m.threeD)) { pl.threeD = true; pl.precomp.space = 'keep3d'; }
      if (moved.some(m => m.motionBlur)) pl.motionBlur = true;
      // 外层仍引用被移走图层的属性：重新指向预合成层
      for (const l of comp.layers) { if (ids.has(l.parent)) l.parent = pl.id; if (l.matte && ids.has(l.matte.layer)) l.matte.layer = pl.id; }
      comp.layers.splice(Math.max(0, idx), 0, pl);
      App.sel.layers = [pl.id];
    });
    App.status('已预合成：画面保持不变（父级与柔边一并移入）');
  };
  App.toggle = (layer, key) => App.edit('切换' + key, () => { layer[key] = !layer[key]; if (key === 'threeD' && !layer[key] && layer.precomp) layer.precomp.space = 'flat'; });

  // ---------- 关键帧命令 ----------
  App.keyOwner = new Map(); // key → prop
  App.registerKey = (k, p) => App.keyOwner.set(k, p);
  App.allProps = (layer) => Mdl.layerProps(layer).map(x => x.prop);
  App.selectedKeysByProp = () => { const m = new Map(); for (const k of App.sel.keys) { const p = App.keyOwner.get(k); if (!p) continue; if (!m.has(p)) m.set(p, []); m.get(p).push(k); } return m; };
  App.deleteKeys = () => {
    App.edit('删除关键帧', () => { for (const [p, ks] of App.selectedKeysByProp()) { p.keys = p.keys.filter(k => !ks.includes(k)); if (!p.keys.length) { p.anim = false; } } App.sel.keys.clear(); });
  };
  App.easeKeys = (type) => {
    if (!App.sel.keys.size) { W.toast('请先选择关键帧（F9 缓入缓出）'); return; }
    App.edit(type === 'easy' ? '缓入缓出' : type === 'in' ? '缓入' : '缓出', () => { for (const k of App.sel.keys) A.applyEase(k, type); });
  };
  App.setInterp = (mode) => {
    App.edit('关键帧插值：' + mode, () => {
      for (const k of App.sel.keys) {
        if (mode === 'hold') { k.oi = 'hold'; }
        else if (mode === 'linear') { k.ii = k.oi = 'linear'; }
        else if (mode === 'bezier') { k.ii = k.oi = 'bezier'; k.auto = true; }
        else if (mode === 'linIn') k.ii = 'linear'; else if (mode === 'linOut') k.oi = 'linear';
        else if (mode === 'bezIn') { k.ii = 'bezier'; } else if (mode === 'bezOut') { k.oi = 'bezier'; }
        else if (mode === 'holdOut') k.oi = 'hold';
        else if (mode === 'spLinear') k.sp = 'linear'; else if (mode === 'spAuto') k.sp = 'auto';
        else if ((mode === 'spCont' || mode === 'spBroken' || mode === 'spLinear' || mode === 'spAuto') && !Array.isArray(k.v)) continue;
        else if (mode === 'spCont') { const p = App.keyOwner.get(k); if (p && p.keys) { const i = p.keys.indexOf(k); const tg = A.spatialTangents(p.keys, i); k.ti = tg.ti.slice(); k.to = tg.to.slice(); } k.sp = 'cont'; }
        else if (mode === 'spBroken') { const p = App.keyOwner.get(k); if (p && p.keys) { const i = p.keys.indexOf(k); const tg = A.spatialTangents(p.keys, i); k.ti = tg.ti.slice(); k.to = tg.to.slice(); } k.sp = 'broken'; }
      }
    });
  };
  App.copy = () => {
    if (App.sel.keys.size) {
      const byProp = App.selectedKeysByProp(); const items = []; let t0 = Infinity;
      for (const [p, ks] of byProp) { for (const k of ks) t0 = Math.min(t0, k.t); items.push({ path: p._path, name: Mdl.label((p._path || '').split('.').pop()), type: p.type, keys: ks.map(k => U.clone(k)) }); }
      App.clip = { kind: 'keys', t0, items }; App.status('已复制 ' + App.sel.keys.size + ' 个关键帧');
    } else if (App.layers().length) { App.clip = { kind: 'layers', data: App.layers().map(l => Mdl.serialize(l)) }; App.status('已复制 ' + App.layers().length + ' 个图层'); }
  };
  App.paste = () => {
    const c = App.clip; if (!c) { W.toast('剪贴板为空'); return; }
    if (c.kind === 'keys') {
      const targets = App.layers(); if (!targets.length) { W.toast('请选择要粘贴到的图层'); return; }
      App.edit('粘贴关键帧', () => {
        App.sel.keys.clear();
        const t = App.t();
        for (const L of targets) for (const it of c.items) {
          // 同名属性：先按路径，失败按名称
          let p = Mdl.getPath(L, it.path);
          if (!Mdl.isProp(p) || p.type !== it.type) { const found = Mdl.layerProps(L).find(x => x.path.endsWith('.' + it.path.split('.').pop()) && x.prop.type === it.type); p = found && found.prop; }
          if (!Mdl.isProp(p)) continue;
          p.anim = true;
          for (const k of it.keys) { const nk = U.clone(k); nk.t = t + (k.t - c.t0); p.keys = p.keys.filter(x => Math.abs(x.t - nk.t) > 1e-4); p.keys.push(nk); App.sel.keys.add(nk); App.registerKey(nk, p); }
          A.sortKeys(p);
        }
      });
    } else if (c.kind === 'layers') {
      App.edit('粘贴图层', () => { const comp = App.comp(); const news = c.data.map(s => { const l = Mdl.deserialize(s); l.id = Mdl.newId('ly'); reid(l); return l; }); comp.layers.unshift(...news); App.sel.layers = news.map(l => l.id); });
    }
  };
  App.selectAllKeysOfSelected = () => {
    App.sel.keys.clear();
    for (const l of App.layers()) for (const p of App.allProps(l)) if (p.anim) for (const k of p.keys) { App.sel.keys.add(k); App.registerKey(k, p); }
    App.status('已选中 ' + App.sel.keys.size + ' 个关键帧'); App.mark('timeline', 'graph', 'viewer');
  };
  App.jumpKey = (dir) => {
    const t = App.t(); let best = null;
    const ls = App.layers().length ? App.layers() : App.comp().layers;
    for (const l of ls) for (const p of App.allProps(l)) if (p.anim) for (const k of p.keys) {
      if (dir > 0 && k.t > t + 1e-4 && (best === null || k.t < best)) best = k.t;
      if (dir < 0 && k.t < t - 1e-4 && (best === null || k.t > best)) best = k.t;
    }
    if (best !== null) App.setTime(best); else W.toast(dir > 0 ? '后面没有关键帧' : '前面没有关键帧');
  };
  // 在当前时刻写入属性（开启动画时创建/更新关键帧）
  App.writeProp = (prop, v, t) => { A.setValue(prop, t === undefined ? App.editTime() : t, v); if (prop.anim) for (const k of prop.keys) App.registerKey(k, prop); E.bump(); };
  // 播放中编辑：写在操作开始时的时刻
  App.editTime = () => App.opTime !== null && App.opTime !== undefined ? App.opTime : App.t();
  App.opTime = null;
  App.beginOp = () => { App.opTime = App.t(); App.begin(); };
  App.endOp = (label) => { App.opTime = null; App.commit(label); };

  // ---------- 播放 ----------
  let playStart = 0, playClock = 0;
  App.clock = () => (AE.Audio && AE.Audio.ctx && AE.Audio.ctx.state === 'running') ? AE.Audio.ctx.currentTime : performance.now() / 1000;
  App.play = (on = !App.playing) => {
    if (App.exporting) return;
    App.playing = on;
    if (on) {
      const comp = App.rootComp(), wa = comp.workArea;
      if (App.loop && (App.time >= wa[1] - 1e-3 || App.time < wa[0] - 1e-3)) App.time = wa[0];
      if (AE.Audio) AE.Audio.ensure();
      playStart = App.time; playClock = App.clock();
      if (AE.Audio) AE.Audio.start(App.proj, comp, App.time);
    } else if (AE.Audio) AE.Audio.stop();
    App.mark('timeline', 'viewer');
    App.panels.head && App.panels.head();
  };
  App.tickPlay = () => {
    if (!App.playing) return;
    const comp = App.rootComp(), wa = App.loop ? comp.workArea : [0, comp.duration];
    let t = playStart + (App.clock() - playClock);
    if (t >= wa[1]) {
      if (App.loop) { t = wa[0]; playStart = t; playClock = App.clock(); if (AE.Audio) { AE.Audio.stop(); AE.Audio.start(App.proj, comp, t); } }
      else { t = wa[1]; App.play(false); }
    }
    App.time = Math.floor(t * comp.fps + 1e-6) / comp.fps;
    App.onTime();
  };

  // ---------- 工作区 ----------
  App.setWorkspace = (ws) => {
    App.workspace = ws;
    const tab = ws === 'graph' ? 'graph' : ws === 'nodes' ? 'nodes' : 'timeline';
    App.setBottom(tab);
    const bw = document.getElementById('bottomWrap');
    bw.style.height = ws === 'nodes' ? '46%' : ws === 'graph' ? '42%' : ws === '3d' ? '230px' : '330px';
    if (ws === '3d' && App.panels.viewer) App.panels.viewer.setMode('quad');
    else if (App.panels.viewer && App.panels.viewer.mode === 'quad') App.panels.viewer.setMode('camera');
    document.querySelectorAll('.ws').forEach(e => e.classList.toggle('on', e.dataset.ws === ws));
    setTimeout(() => App.mark(), 0);
  };
  App.setBottom = (tab) => {
    App.bottomTab = tab;
    document.querySelectorAll('.bpane').forEach(e => e.classList.toggle('on', e.id === tab + 'Pane'));
    document.querySelectorAll('#bottomHead .tab').forEach(e => e.classList.toggle('on', e.dataset.tab === tab));
    App.mark();
  };

  // ---------- 快捷键 ----------
  App.SHORTCUTS = [
    ['空格', '播放 / 暂停'], ['PageDown / Ctrl+→', '下一帧'], ['PageUp / Ctrl+←', '上一帧'], ['Home / End', '跳到开头 / 结尾'],
    ['J / K', '上一个 / 下一个关键帧'], ['F9', '缓入缓出'], ['Shift+F9', '缓入'], ['Ctrl+Shift+F9', '缓出'],
    ['Ctrl+A', '全选图层'], ['Ctrl+Alt+A', '选中所选层全部关键帧'], ['Ctrl+D', '复制图层'], ['Ctrl+Shift+C', '预合成'],
    ['Ctrl+C / Ctrl+V', '复制 / 粘贴（关键帧或图层）'], ['Delete', '删除所选'], ['Ctrl+Z', '撤销'], ['Ctrl+Shift+Z / Ctrl+Y', '重做'],
    ['Ctrl+S / Ctrl+O', '保存 / 打开工程'], ['Ctrl+M', '导出工作区'], ['U', '只显示动画属性'], ['N / B', '设置工作区结束 / 开始'],
    ['[ / ]', '入点 / 出点移到当前时间'], ['Alt+[ / Alt+]', '裁剪入点 / 出点'], ['Ctrl+[ / Ctrl+]', '图层下移 / 上移'],
    ['V H Z', '选择 / 手形 / 缩放工具'], ['Y', '锚点工具'], ['Q / E', '矩形 / 椭圆'], ['G', '钢笔'], ['Ctrl+T', '文字工具'], ['P', '图钉工具'],
    ['1 2 3 4', '工作区：动画 / 曲线 / 节点 / 三维'], ['F', '画布适配'], ['Shift+拖动', '十倍步长 / 约束'], ['Alt+拖动关键帧', '按比例拉伸时间'], ['?', '快捷键说明'],
  ];
  App.showShortcuts = () => {
    const body = W.el('div', { class: 'keys' });
    for (const [k, d] of App.SHORTCUTS) body.append(W.el('kbd', { text: k }), W.el('span', { text: d }));
    W.dialog('快捷键说明（输入文字或表达式时不会触发）', body);
  };
  App.onKey = (e) => {
    if (W.isTyping(e)) return; // 文字/表达式输入时不抢占
    if (document.querySelector('.dialog-bg')) { if (e.key === 'Escape') document.querySelector('.dialog-bg').remove(); return; }
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey, alt = e.altKey;
    const fd = 1 / App.fps();
    let handled = true;
    if (k === ' ') App.play();
    else if (k === 'F9') { if (ctrl && sh) App.easeKeys('out'); else if (sh) App.easeKeys('in'); else App.easeKeys('easy'); }
    else if (ctrl && alt && (k === 'a' || k === 'A')) App.selectAllKeysOfSelected();
    else if (ctrl && (k === 'a' || k === 'A')) App.selectAll();
    else if (ctrl && sh && (k === 'c' || k === 'C')) App.precompose();
    else if (ctrl && (k === 'd' || k === 'D')) App.duplicate();
    else if (ctrl && sh && (k === 'z' || k === 'Z')) App.redo();
    else if (ctrl && (k === 'y' || k === 'Y')) App.redo();
    else if (ctrl && (k === 'z' || k === 'Z')) App.undo();
    else if (ctrl && (k === 'c' || k === 'C')) App.copy();
    else if (ctrl && (k === 'v' || k === 'V')) App.paste();
    else if (ctrl && (k === 's' || k === 'S')) AE.IO.save();
    else if (ctrl && (k === 'o' || k === 'O')) AE.IO.open();
    else if (ctrl && (k === 'm' || k === 'M')) AE.IO.exportDialog();
    else if (ctrl && (k === 't' || k === 'T')) App.setTool('text');
    else if (ctrl && k === ']') App.reorder(-1);
    else if (ctrl && k === '[') App.reorder(1);
    else if (alt && k === '[') App.trim('in');
    else if (alt && k === ']') App.trim('out');
    else if (k === '[') App.moveLayerTo('in');
    else if (k === ']') App.moveLayerTo('out');
    else if (k === 'Delete' || k === 'Backspace') App.deleteSelected();
    else if (k === 'PageDown' || (ctrl && k === 'ArrowRight')) App.setTime(App.t() + fd * (sh ? 10 : 1));
    else if (k === 'PageUp' || (ctrl && k === 'ArrowLeft')) App.setTime(App.t() - fd * (sh ? 10 : 1));
    else if (k === 'Home') App.setTime(0);
    else if (k === 'End') App.setTime(App.comp().duration - fd);
    else if (k === 'j' || k === 'J') App.jumpKey(-1);
    else if (k === 'k' || k === 'K') App.jumpKey(1);
    else if (k === 'u' || k === 'U') { App.onlyAnimated = !App.onlyAnimated; App.status(App.onlyAnimated ? '时间轴：只显示动画属性' : '时间轴：显示全部属性'); App.mark('timeline'); }
    else if (k === 'n' || k === 'N') App.edit('工作区结束', () => { const c = App.comp(); c.workArea[1] = Math.max(c.workArea[0] + fd, App.t()); });
    else if (k === 'b' || k === 'B') App.edit('工作区开始', () => { const c = App.comp(); c.workArea[0] = Math.min(c.workArea[1] - fd, App.t()); });
    else if (k === 'v' || k === 'V') App.setTool('select');
    else if (k === 'h' || k === 'H') App.setTool('hand');
    else if (k === 'z' || k === 'Z') App.setTool('zoom');
    else if (k === 'y' || k === 'Y') App.setTool('anchor');
    else if (k === 'w' || k === 'W') App.setTool('rotate');
    else if (k === 'q' || k === 'Q') App.setTool('rect');
    else if (k === 'e' || k === 'E') App.setTool('ellipse');
    else if (k === 'g' || k === 'G') App.setTool('pen');
    else if (k === 'p' || k === 'P') App.setTool('pin');
    else if (k === 'c' || k === 'C') App.setTool('orbit');
    else if (k === 'f' || k === 'F') App.panels.viewer && App.panels.viewer.fit();
    else if (k === '1') App.setWorkspace('anim');
    else if (k === '2') App.setWorkspace('graph');
    else if (k === '3') App.setWorkspace('nodes');
    else if (k === '4') App.setWorkspace('3d');
    else if (k === '?' || k === '/') App.showShortcuts();
    else if (k === 'Escape') { App.sel.keys.clear(); App.sel.item = null; App.mark(); }
    else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      const ls = App.layers().filter(l => !l.locked); if (!ls.length) { handled = false; }
      else {
        const d = (sh ? 10 : 1), dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0;
        App.edit('微移图层', () => { for (const l of ls) { const p = A.valueAt(l.transform.position, App.t()).slice(); p[0] += dx; p[1] += dy; App.writeProp(l.transform.position, p); } });
      }
    }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  };
  App.setTool = (t) => { App.tool = t; document.querySelectorAll('.tool').forEach(e => e.classList.toggle('on', e.dataset.tool === t)); App.mark('viewer'); const tips = { select: '选择：拖动移动，手柄缩放/旋转；Alt 拖动锚点', hand: '手形：拖动平移画布', zoom: '缩放：单击放大，Alt 单击缩小', rotate: '旋转工具', anchor: '锚点：拖动锚点，画面位置不变', rect: '矩形：在画布拖出矩形（选中形状层时加入该层）', ellipse: '椭圆：拖出椭圆', pen: '钢笔：单击添加角点，拖动拉出切线，点击起点闭合；Enter 完成', text: '文字：单击放置文字', pin: '图钉：在选中图层的网格上单击添加位置图钉；Alt 单击添加刚性区域', orbit: '绕转：在自定义视图中拖动绕转' }; App.status(tips[t] || ''); };
  App.trim = (which) => { const ls = App.layers(); if (!ls.length) return; App.edit('裁剪图层', () => { for (const l of ls) { if (which === 'in') l.inPoint = Math.min(App.t(), l.outPoint - 1 / App.fps()); else l.outPoint = Math.max(App.t() + 1 / App.fps(), l.inPoint + 1 / App.fps()); } }); };
  App.moveLayerTo = (which) => { const ls = App.layers(); if (!ls.length) return; App.edit('移动图层', () => { for (const l of ls) Mdl.shiftLayer(l, App.t() - (which === 'in' ? l.inPoint : l.outPoint)); }); };

  // ---------- 布局 ----------
  App.initLayout = () => {
    document.querySelectorAll('.vsplit,.hsplit').forEach(sp => {
      sp.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const which = sp.dataset.split, x0 = e.clientX, y0 = e.clientY;
        const el = which === 'left' ? document.getElementById('leftcol') : which === 'right' ? document.getElementById('rightcol') : document.getElementById('bottomWrap');
        const s0 = which === 'bottom' ? el.getBoundingClientRect().height : el.getBoundingClientRect().width;
        const mm = (ev) => {
          if (which === 'left') el.style.width = U.clamp(s0 + ev.clientX - x0, 150, 500) + 'px';
          else if (which === 'right') el.style.width = U.clamp(s0 - (ev.clientX - x0), 240, 640) + 'px';
          else el.style.height = U.clamp(s0 - (ev.clientY - y0), 60, innerHeight - 200) + 'px';
          App.mark();
        };
        const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); };
        addEventListener('mousemove', mm); addEventListener('mouseup', mu);
      });
    });
    addEventListener('resize', () => { clearTimeout(App._rs); App._rs = setTimeout(() => { AE.Viewer.fit(); App.mark(); }, 60); });
  };
  App.togglePanel = (which) => { document.body.classList.toggle('collapsed-' + which); setTimeout(() => { AE.Viewer.fit(); App.mark(); }, 30); };

  // ---------- 主循环 ----------
  App.frame = () => {
    if (!App.exporting) {
      App.tickPlay();
      App.drawPanels();
    }
    requestAnimationFrame(App.frame);
  };
  App.drawPanels = () => {
    const P = App.panels, d = App.dirty;
    try {
      E.index(App.proj);
      if (d.viewer && P.viewer) { d.viewer = false; P.viewer.draw(); }
      if (d.timeline && P.timeline && App.bottomTab === 'timeline') { d.timeline = false; P.timeline.draw(); }
      if (d.graph && P.graph && App.bottomTab === 'graph') { d.graph = false; P.graph.draw(); }
      if (d.nodes && P.nodes && App.bottomTab === 'nodes') { d.nodes = false; P.nodes.draw(); }
      if (d.props && P.props) { d.props = false; P.props.update(); }
      if (d.project && P.project) { d.project = false; P.project.render(); }
      if (P.head) P.head();
    } catch (e) { console.error(e); App.status('错误：' + e.message); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
