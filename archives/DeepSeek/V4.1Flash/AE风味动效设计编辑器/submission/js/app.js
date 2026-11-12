/* ============================================================
   app.js — 应用状态、播放、撤销、快捷键与渲染循环
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const GL = AE.gl;

  const app = AE.app = {
    project: null,
    comp: null,
    time: 0,
    playing: false,
    loop: true,
    activeTool: 'select',
    selection: [],
    primaryId: null,
    selectedProp: null,
    selectedKeys: new Set(),
    exportMode: false,
    exportFps: 30,
    view: {
      viewMode: 'camera',
      zoom: 1,
      fit: true,
      overlays: { grid: true, guides: true, paths: true, fields: false },
      tab: 'timeline',
      freeCamera: { yaw: 0.25, pitch: 0.12, dist: 1350, target: { x: 0, y: 20, z: 0 } },
      bounds: { x: 0, y: 0, w: 0, h: 0, scale: 1 }
    },
    undoStack: [],
    redoStack: [],
    _lastSnapshot: null,
    _renderQueued: false,
    _lastAutosave: 0,
    _playLast: 0,
    _playAcc: 0,
    _inited: false,
    _exportOrigProject: null
  };

  // ---------------- 初始化 ----------------
  app.boot = async function () {
    const boot = document.getElementById('bootScreen');
    const status = document.getElementById('bootStatus');
    const bar = boot ? boot.querySelector('.boot-bar span') : null;
    const step = (pct, msg) => {
      if (bar) bar.style.width = pct + '%';
      if (status && msg) status.textContent = msg;
    };
    try {
      step(8, '正在校准画布…');
      fitFrame(true);
      const canvas = document.getElementById('glCanvas');
      const ok = GL.init(canvas);
      if (!ok) {
        app.toast('此浏览器无法建立 WebGL 2 上下文', 'err');
        if (status) status.textContent = '需要支持 WebGL 2 的 Chrome 浏览器';
        return;
      }
      GL.setupComposite();
      AE.compositor.init();
      step(26, '正在读取工程数据…');
      await new Promise(r => setTimeout(r, 120));
      const project = AE.demo.build();
      app.setProject(project, { silentUI: true });
      step(52, '正在生成字形与三维实体…');
      AE.ui.init();
      AE.timeline.init();
      AE.props.init();
      AE.viewport.init();
      AE.curve.init();
      AE.nodeui.init();
      app.bindGlobal();
      // 预生成字形，避免开场卡顿
      try {
        const textLayer = app.comp.layers.find(l => l.type === 'text');
        if (textLayer) {
          await new Promise(r => setTimeout(r, 30));
          AE.text.layerContours(textLayer, 0);
        }
      } catch (e) { console.warn('字形预生成失败', e); }
      step(78, '正在布置炉膛与火星…');
      if (document.fonts && document.fonts.ready) {
        try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 600))]); } catch (e) {}
      }
      step(92, '正在点亮锻造炉…');
      app.refreshAll();
      app.requestRender(true);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      step(100, '就绪');
      if (boot) {
        setTimeout(() => { boot.classList.add('out'); setTimeout(() => boot.remove(), 700); }, 350);
      }
      app._inited = true;
      app.startAutosave();
      app.status('已载入示例工程「锻字」 · 15 秒 · 按空格播放');
      setupVideoExport();
    } catch (e) {
      console.error(e);
      if (status) status.textContent = '初始化失败：' + e.message;
      app.toast('初始化失败：' + e.message, 'err');
      throw e;
    }
  };

  app.bindGlobal = function () {
    window.addEventListener('resize', () => {
      fitFrame();
      app.requestRender();
    });
    const stage = document.getElementById('canvasStage');
    if (window.ResizeObserver) new ResizeObserver(() => { fitFrame(); app.requestRender(); }).observe(stage);
    const canvas = document.getElementById('glCanvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        app.toast('WebGL 上下文丢失，请刷新页面', 'err');
      });
    }
    document.addEventListener('keydown', (e) => app.onKey(e));
    document.addEventListener('pointerdown', () => { if (AE.audio) AE.audio.ensure(); }, { once: true });
    window.addEventListener('beforeunload', () => { app.autosave(true); });
  };

  // ---------------- 工程/选择 ----------------
  app.setProject = function (project, opts) {
    opts = opts || {};
    app.project = project;
    project.version = project.version || 1;
    for (const comp of project.comps) {
      comp._project = project;
      for (const l of comp.layers) {
        l._comp = comp;
        l._meshCache = null;
        l._collisionCache = null;
      }
    }
    const comp = M.getComp(project, project.activeCompId);
    app.comp = comp;
    app.time = U.clamp(project.currentTime || 0, 0, comp.duration);
    app.playing = false;
    app.selectedKeys.clear();
    app.selectedProp = null;
    A.clearCache();
    if (AE.particles) AE.particles.reset();
    if (AE.compositor) AE.compositor.clearCaches();
    const keepSel = (opts.selection || []).filter(id => comp.layers.find(l => l.id === id));
    if (keepSel.length) app.selection = keepSel;
    else {
      const focus = comp.layers.find(l => l.type === 'text' && l.extrude && l.extrude.enabled)
        || comp.layers.find(l => l.type === 'text')
        || comp.layers.find(l => l.type !== 'adjustment' && l.type !== 'sound');
      app.selection = focus ? [focus.id] : (comp.layers.length ? [comp.layers[0].id] : []);
    }
    app.primaryId = app.selection[0] || null;
    app.view.viewMode = comp.layers.some(l => l.type === 'camera' && l.enabled) ? 'camera' : 'free';
    fitFrame(true);
    if (!opts.silentUI) app.refreshAll();
  };

  app.getComp = function () { return app.comp; };
  app.getLayer = function (id) { return app.comp ? app.comp.layers.find(l => l.id === id) : null; };
  app.primary = function () { return app.getLayer(app.primaryId) || null; };
  app.selectedLayers = function () {
    if (!app.comp) return [];
    return app.selection.map(id => app.getLayer(id)).filter(Boolean);
  };
  app.selectLayer = function (layer, additive, opts) {
    opts = opts || {};
    if (!layer) {
      app.selection = [];
      app.primaryId = null;
      app.selectedProp = null;
    } else {
      if (additive) {
        const i = app.selection.indexOf(layer.id);
        if (i >= 0) { app.selection.splice(i, 1); if (app.primaryId === layer.id) app.primaryId = app.selection[0] || null; }
        else { app.selection.push(layer.id); app.primaryId = layer.id; }
      } else {
        if (app.selection.length === 1 && app.selection[0] === layer.id && !opts.always) {
          // 保持
        } else { app.selection = [layer.id]; app.primaryId = layer.id; }
      }
      if (!app.selection.length) app.primaryId = null;
    }
    app.selectedKeys.clear();
    if (!opts.keepProp) app.selectedProp = null;
    AE.ui.refreshSelection();
    AE.timeline.refresh();
    AE.props.refresh();
    if (app.view.tab === 'curves') AE.curve.refresh();
    if (app.view.tab === 'nodes') AE.nodeui.refresh();
    app.requestRender();
  };
  app.selectAll = function () {
    app.selection = app.comp.layers.map(l => l.id);
    app.primaryId = app.selection[0] || null;
    app.refreshAll();
  };
  app.toggleLayerFlag = function (layer, flag) {
    if (!layer) return;
    app.snapshot('切换图层属性');
    if (flag === '3d') {
      if (layer.type === 'shape' || layer.type === 'text') {
        if (layer.extrude) layer.extrude.enabled = !layer.extrude.enabled;
      } else {
        layer.threeD = !layer.threeD;
      }
    } else layer[flag] = !layer[flag];
    app.changed();
  };
  app.changed = function (opts) {
    opts = opts || {};
    M.bump(app.project);
    app.refreshAll();
    app.requestRender();
    app.status(opts.msg || '已更新');
  };

  // 撤销 / 重做
  app.serializeCurrent = function () {
    return {
      json: M.serialize(app.project),
      time: app.time,
      compId: app.comp.id,
      selection: app.selection.slice()
    };
  };
  app.snapshot = function (label) {
    if (app.exportMode) return;
    try {
      const snap = app.serializeCurrent();
      snap.label = label || '编辑';
      app.undoStack.push(snap);
      if (app.undoStack.length > 80) app.undoStack.shift();
      app.redoStack.length = 0;
      app.updateUndoUI();
    } catch (e) { console.warn('快照失败', e); }
  };
  app.applySnapshot = function (snap) {
    try {
      const project = M.deserialize(snap.json);
      app.project = project;
      app.comp = M.getComp(project, snap.compId) || project.comps[0];
      project.activeCompId = app.comp.id;
      app.time = U.clamp(snap.time || 0, 0, app.comp.duration);
      app.selection = (snap.selection || []).filter(id => app.comp.layers.find(l => l.id === id));
      app.primaryId = app.selection[0] || (app.comp.layers[0] ? app.comp.layers[0].id : null);
      A.clearCache();
      AE.particles.reset();
      AE.compositor.clearCaches();
      for (const c of project.comps) for (const l of c.layers) { l._comp = c; }
      app.refreshAll();
      app.requestRender();
      app.status(snap.label || '已撤销');
    } catch (e) {
      console.error(e);
      app.toast('撤销失败：' + e.message, 'err');
    }
  };
  app.undo = function () {
    if (!app.undoStack.length) { app.toast('没有可撤销的操作'); return; }
    const cur = app.serializeCurrent();
    cur.label = '重做';
    app.redoStack.push(cur);
    const snap = app.undoStack.pop();
    app.applySnapshot(snap);
    app.updateUndoUI();
  };
  app.redo = function () {
    if (!app.redoStack.length) { app.toast('没有可重做的操作'); return; }
    const cur = app.serializeCurrent();
    cur.label = '撤销';
    app.undoStack.push(cur);
    const snap = app.redoStack.pop();
    app.applySnapshot(snap);
    app.updateUndoUI();
  };
  app.updateUndoUI = function () {
    const u = document.getElementById('menuUndo');
    const r = document.getElementById('menuRedo');
    if (u) u.classList.toggle('disabled', !app.undoStack.length);
    if (r) r.classList.toggle('disabled', !app.redoStack.length);
  };

  // ---------------- 时间与播放 ----------------
  app.setTime = function (t, opts) {
    opts = opts || {};
    if (!app.comp) return;
    t = U.clamp(t, 0, app.comp.duration);
    if (!opts.raw && !app.exportMode) {
      const fps = app.comp.fps;
      t = Math.round(t * fps) / fps;
    }
    app.time = t;
    app.project.currentTime = t;
    if (AE.audio && app.playing) { /* 播放中不重排音频 */ }
    AE.ui.onTime(t);
    app.requestRender();
  };
  app.togglePlay = function (force) {
    if (!app.comp) return;
    const want = force === undefined ? !app.playing : !!force;
    if (want === app.playing) return;
    if (want) {
      app.playing = true;
      app._playLast = performance.now();
      app._playAcc = 0;
      if (AE.audio) {
        AE.audio.ensure();
        AE.audio.start(app.comp, app.time, app.comp.workStart, app.comp.workEnd);
      }
      AE.ui.setPlayState(true);
      app.loopTick();
    } else {
      app.playing = false;
      if (AE.audio) AE.audio.stop(true);
      AE.ui.setPlayState(false);
      app.setTime(app.time);
    }
  };
  app.loopTick = function () {
    if (!app.playing) return;
    const now = performance.now();
    let dt = (now - app._playLast) / 1000;
    app._playLast = now;
    if (dt > 0.12) dt = 0.12;
    const fps = app.comp.fps;
    app._playAcc += dt;
    const frameDur = 1 / fps;
    if (app._playAcc >= frameDur) {
      const steps = Math.floor(app._playAcc / frameDur);
      app._playAcc -= steps * frameDur;
      let t = app.time + steps * frameDur;
      const ws = app.comp.workStart, we = app.comp.workEnd;
      if (t > we - 1e-6) {
        if (app.loop) {
          t = ws + ((t - ws) % Math.max(1e-4, we - ws));
          if (AE.audio) AE.audio.start(app.comp, t, ws, we);
        } else {
          t = app.comp.duration;
          app.setTime(t, { raw: true });
          app.togglePlay(false);
          return;
        }
      }
      app.setTime(t, { raw: true });
    }
    requestAnimationFrame(() => app.loopTick());
  };

  // ---------------- 渲染 ----------------
  function fitFrame(force) {
    if (!app.comp) return;
    const stage = document.getElementById('canvasStage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (!force && app.view.bounds.w === rect.width && app.view.bounds.h === rect.height && app.view._compId === app.comp.id && app.view._zoom === app.view.zoom) return;
    const pad = 26;
    const comp = app.comp;
    let scale = Math.min((rect.width - pad) / comp.width, (rect.height - pad) / comp.height);
    scale = Math.max(0.02, scale * app.view.zoom);
    const cw = Math.max(80, Math.round(comp.width * scale));
    const ch = Math.max(50, Math.round(comp.height * scale));
    const frame = document.getElementById('canvasFrame');
    frame.style.width = cw + 'px';
    frame.style.height = ch + 'px';
    const glc = document.getElementById('glCanvas');
    let ss = U.clamp(1800 / Math.max(1, cw), 1, 1.75);
    let bw = Math.round(cw * ss), bh = Math.round(ch * ss);
    if (bw > 2560) { const k = 2560 / bw; bw = 2560; bh = Math.round(bh * k); }
    if (glc.width !== bw || glc.height !== bh) { glc.width = bw; glc.height = bh; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ov = document.getElementById('overlay');
    const ow = Math.round(cw * dpr), oh = Math.round(ch * dpr);
    if (ov.width !== ow || ov.height !== oh) { ov.width = ow; ov.height = oh; }
    const ctx = ov.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    app.view.bounds = { x: 0, y: 0, w: rect.width, h: rect.height, scale, frameW: cw, frameH: ch, dpr };
    app.view._compId = comp.id;
    app.view._zoom = app.view.zoom;
    const zr = document.getElementById('zoomReadout');
    if (zr) zr.textContent = Math.round(scale * 100) + '%';
    if (GL.isSupported()) GL.ensureSize(glc.width, glc.height);
  }
  app.fitFrame = fitFrame;

  app.requestRender = function (immediate) {
    if (immediate) { app.render(); return; }
    if (app._renderQueued) return;
    app._renderQueued = true;
    requestAnimationFrame(() => {
      app._renderQueued = false;
      app.render();
    });
  };
  app.render = function () {
    if (!app.comp || !GL.isSupported()) return;
    fitFrame();
    try {
      AE.compositor.renderFrame(app.comp, app.time);
      app.comp._lastRenderTime = app.time;
      AE.viewport.drawOverlay();
      const fr = app.comp._lastFrame;
      if (fr) {
        const sb = document.getElementById('sbRender');
        if (sb) sb.textContent = `WebGL 2 · ${fr.size.w}×${fr.size.h} · ${app.comp._sceneInfo ? app.comp._sceneInfo.objects + ' 物体' : ''}`;
      }
    } catch (e) {
      console.error('渲染失败', e);
      app.status('渲染失败：' + e.message);
    }
  };

  app.zoom = function (factor) {
    app.view.zoom = U.clamp((app.view.zoom || 1) * factor, 0.15, 4);
    fitFrame(true);
    app.requestRender();
  };
  app.zoomReset = function () { app.view.zoom = 1; fitFrame(true); app.requestRender(); };

  // ---------------- 常用编辑 ----------------
  app.addLayer = function (type, opts) {
    if (!app.comp) return null;
    app.snapshot('新建图层');
    const layer = M.newLayer(app.comp, type, opts || {});
    M.addLayer(app.comp, layer, 0);
    M.bump(app.project);
    app.selection = [layer.id];
    app.primaryId = layer.id;
    app.refreshAll();
    app.requestRender();
    app.status('已创建 ' + layer.name);
    return layer;
  };
  app.duplicateSelection = function () {
    const layers = app.selectedLayers();
    if (!layers.length) return;
    app.snapshot('复制图层');
    const map = {};
    const copies = [];
    for (const l of layers) {
      const c = M.duplicateLayer(app.comp, l, map);
      map[l.id] = c.id;
      copies.push(c);
    }
    app.selection = copies.map(c => c.id);
    app.primaryId = copies[0] ? copies[0].id : null;
    M.bump(app.project);
    app.refreshAll();
    app.requestRender();
  };
  app.deleteSelection = function () {
    const layers = app.selectedLayers();
    if (!layers.length) return;
    app.snapshot('删除图层');
    for (const l of layers) M.removeLayer(app.comp, l);
    app.selection = [];
    app.primaryId = app.comp.layers[0] ? app.comp.layers[0].id : null;
    if (app.primaryId) app.selection = [app.primaryId];
    M.bump(app.project);
    app.refreshAll();
    app.requestRender();
    app.status('已删除 ' + layers.length + ' 个图层');
  };
  app.precomposeSelection = function () {
    const layers = app.selectedLayers();
    if (!layers.length) { app.toast('请先选择要预合成的图层'); return; }
    app.snapshot('预合成');
    const res = M.precompose(app.project, app.comp, layers, {});
    if (!res) { app.toast('预合成失败', 'err'); return; }
    app.selection = [res.layer.id];
    app.primaryId = res.layer.id;
    M.bump(app.project);
    app.refreshAll();
    app.requestRender();
    app.status('已预合成到「' + res.comp.name + '」');
  };
  app.openComp = function (comp) {
    if (!comp) return;
    app.comp = comp;
    app.project.activeCompId = comp.id;
    app.time = U.clamp(app.time, 0, comp.duration);
    app.selection = comp.layers.length ? [comp.layers[0].id] : [];
    app.primaryId = app.selection[0] || null;
    app.selectedProp = null;
    app.refreshAll();
    app.requestRender();
    app.status('已打开合成「' + comp.name + '」');
  };
  app.newComp = function () {
    const name = '合成 ' + (app.project.comps.length + 1);
    const comp = M.createComp({ name, width: app.comp.width, height: app.comp.height, fps: app.comp.fps, duration: app.comp.duration });
    app.snapshot('新建合成');
    app.project.comps.push(comp);
    app.openComp(comp);
    M.bump(app.project);
    app.refreshAll();
  };

  // ---------------- UI 刷新 ----------------
  app.refreshAll = function () {
    if (AE.ui) AE.ui.refreshAll();
    if (AE.timeline) AE.timeline.refresh();
    if (AE.props) AE.props.refresh();
    if (AE.curve) AE.curve.refresh();
    if (AE.nodeui) AE.nodeui.refresh();
    if (AE.viewport) AE.viewport.resizeOverlay();
    app.updateUndoUI();
  };
  app.onTimeUI = function () { };
  app.status = function (msg) {
    const el = document.getElementById('statusMsg');
    if (el) el.textContent = msg;
  };
  app.toast = function (msg, type) {
    const layer = document.getElementById('toastLayer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : '');
    el.textContent = msg;
    layer.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 350); }, 2600);
  };

  // ---------------- 自动保存 / 工程文件 ----------------
  app.autosave = function (force) {
    if (app.exportMode || !app.project) return;
    try {
      const data = { json: M.serialize(app.project), time: app.time, compId: app.comp.id, at: Date.now() };
      localStorage.setItem('forge_autosave', JSON.stringify(data));
      app._lastAutosave = Date.now();
      const tag = document.getElementById('autosaveTag');
      if (tag) { tag.textContent = '已自动保存'; }
    } catch (e) { /* 文件模式可能禁用了存储 */ }
  };
  app.startAutosave = function () {
    setInterval(() => { if (app.project && !app.exportMode) app.autosave(); }, 12000);
  };
  app.saveProject = function () {
    if (!app.project) return;
    app.project.currentTime = app.time;
    const json = M.serialize(app.project);
    U.download((app.project.name || 'forge') + '.forge.json', json);
    app.toast('工程已保存');
  };
  app.loadProjectFile = async function () {
    const f = await U.readFile('.json');
    if (!f) return;
    try {
      const project = M.deserialize(f.text);
      app.undoStack.length = 0;
      app.redoStack.length = 0;
      app.setProject(project, {});
      app.time = U.clamp(project.currentTime || 0, 0, app.comp.duration);
      app.refreshAll();
      app.requestRender();
      app.status('已打开工程「' + project.name + '」');
    } catch (e) { app.toast('打开失败：' + e.message, 'err'); }
  };
  app.restoreAutosave = function () {
    try {
      const raw = localStorage.getItem('forge_autosave');
      if (!raw) { app.toast('没有找到自动保存'); return; }
      const data = JSON.parse(raw);
      const project = M.deserialize(data.json);
      app.setProject(project, {});
      app.time = U.clamp(data.time || 0, 0, app.comp.duration);
      app.refreshAll();
      app.requestRender();
      app.toast('已恢复自动保存');
    } catch (e) { app.toast('恢复失败：' + e.message, 'err'); }
  };
  app.loadDemo = function (character) {
    if (AE.audio) AE.audio.stop(true);
    app.playing = false;
    const project = AE.demo.build(character || '锻');
    app.undoStack.length = 0;
    app.redoStack.length = 0;
    app.setProject(project, {});
    app.refreshAll();
    app.requestRender();
    app.status('示例「锻字」已载入');
  };

  // ---------------- 快捷键 ----------------
  app.isTyping = function () {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  };
  app.onKey = function (e) {
    if (app.exportMode) return;
    if (app.isTyping()) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    const cmd = e.ctrlKey || e.metaKey;
    const key = e.key;
    if (e.code === 'Space') { e.preventDefault(); app.togglePlay(); return; }
    if (cmd && key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) app.redo(); else app.undo(); return; }
    if (cmd && key.toLowerCase() === 'y') { e.preventDefault(); app.redo(); return; }
    if (cmd && key.toLowerCase() === 's') { e.preventDefault(); app.saveProject(); return; }
    if (cmd && key.toLowerCase() === 'o') { e.preventDefault(); app.loadProjectFile(); return; }
    if (cmd && key.toLowerCase() === 'd') { e.preventDefault(); app.duplicateSelection(); return; }
    if (cmd && key.toLowerCase() === 'a') { e.preventDefault(); app.selectAll(); return; }
    if (cmd && e.shiftKey && key.toLowerCase() === 'c') { e.preventDefault(); app.precomposeSelection(); return; }
    if (cmd && key.toLowerCase() === 'c') { e.preventDefault(); if (AE.timeline) AE.timeline.copyKeys(); return; }
    if (cmd && key.toLowerCase() === 'v') { e.preventDefault(); if (AE.timeline) AE.timeline.pasteKeys(); return; }
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      if (app.selectedKeys.size && AE.timeline) AE.timeline.deleteSelectedKeys();
      else app.deleteSelection();
      return;
    }
    if (key === 'F9') { e.preventDefault(); if (AE.timeline) AE.timeline.applyEase(); else if (AE.props) {} return; }
    if (key === 'Home') { e.preventDefault(); app.setTime(0); return; }
    if (key === 'End') { e.preventDefault(); app.setTime(app.comp.workEnd); return; }
    if (key === 'ArrowLeft') { e.preventDefault(); app.setTime(app.time - 1 / app.comp.fps); return; }
    if (key === 'ArrowRight') { e.preventDefault(); app.setTime(app.time + 1 / app.comp.fps); return; }
    if (key === 'PageUp') { e.preventDefault(); app.setTime(app.time + 1 / app.comp.fps); return; }
    if (key === 'PageDown') { e.preventDefault(); app.setTime(app.time - 1 / app.comp.fps); return; }
    if (key.toLowerCase() === 'j') { e.preventDefault(); app.jumpKey(-1); return; }
    if (key.toLowerCase() === 'k') { e.preventDefault(); app.jumpKey(1); return; }
    const k = key.toLowerCase();
    if (k === 'v') { app.setTool('select'); return; }
    if (k === 'h') { app.setTool('hand'); return; }
    if (k === 'z') { app.setTool('zoom'); return; }
    if (k === 't') { app.setTool('text'); return; }
    if (k === 'g') { app.setTool('pen'); return; }
    if (k === 'q') { app.setTool('rect'); return; }
    if (k === 'w') { app.setTool('rotate'); return; }
    if (k === 's') { app.setTool('scale'); return; }
    if (k === 'y') { app.setTool('anchor'); return; }
    if (k === 'p') { app.setTool('pin'); return; }
    if (k === 'c') { app.setTool('orbit'); return; }
    if (key === "'") { if (AE.timeline) AE.timeline.cycleInterp(); return; }
    if (key === '[') { if (AE.timeline) AE.timeline.nudgeKeys(-1); return; }
    if (key === ']') { if (AE.timeline) AE.timeline.nudgeKeys(1); return; }
  };
  app.setTool = function (tool) {
    app.activeTool = tool;
    document.querySelectorAll('#toolrail .tool').forEach(el => el.classList.toggle('active', el.dataset.tool === tool));
    if (AE.viewport) AE.viewport.onToolChange(tool);
    app.status('工具：' + ({ select: '选择', hand: '抓手', zoom: '缩放', rotate: '旋转', scale: '缩放', anchor: '锚点', rect: '矩形', ellipse: '椭圆', pen: '钢笔', text: '文字', pin: '图钉', orbit: '摄像机环绕' }[tool] || tool));
  };
  app.jumpKey = function (dir) {
    const layer = app.primary();
    if (!layer) return;
    const times = [];
    M.walkProps(layer, (p) => { if (p.keyframes) for (const k of p.keyframes) times.push(k.t); });
    times.sort((a, b) => a - b);
    const candidates = dir > 0 ? times.filter(t => t > app.time + 1e-4) : times.filter(t => t < app.time - 1e-4).reverse();
    if (candidates.length) app.setTime(candidates[0]);
  };

  // ---------------- 逐帧导出接口 ----------------
  function setupVideoExport() {
    const api = {
      runs: ['demo'],
      async begin(runId, opts) {
        if (!runId || api.runs.indexOf(runId) < 0) throw new Error('未知的导出段：' + runId);
        const fps = Math.max(1, Math.min(120, Math.round((opts && opts.fps) || 60)));
        app.exportMode = true;
        app.exportFps = fps;
        app.playing = false;
        if (AE.audio) AE.audio.stop(true);
        app.loadDemo('锻');
        app.comp = app.project.comps[0];
        app.time = 0;
        app.setTime(0, { raw: true });
        app.selectLayer(app.comp.layers.find(l => l.type === 'text') || app.comp.layers[0], false);
        app.refreshAll();
        app.render();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return { frames: Math.round(15 * fps) };
      },
      async frame(i) {
        const fps = app.exportFps;
        app.setTime(i / fps, { raw: true });
        app.render();
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));
      },
      end() {
        app.exportMode = false;
        app.render();
        app.status('已退出逐帧导出模式');
      }
    };
    window.videoExport = api;
    window.videoExportReady = true;
  }

  // 启动
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => app.boot(), 30);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => app.boot(), 30));
  }

})(window);
