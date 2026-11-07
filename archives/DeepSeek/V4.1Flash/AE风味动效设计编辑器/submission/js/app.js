/* PRISM application shell: state, playback, editing, export, videoExport API */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, G = AE.G, T = AE.Text, P = AE.P, E = AE.Eval;
  const App = (AE.App = {});
  const $ = U.$, $$ = U.$$;

  Object.assign(App, {
    project: null, comp: null, time: 0, playing: false, loop: false, exporting: false, exportMode: false,
    selection: [], selectedKeys: new Set(), activeTrack: null,
    view: { zoom: 1, panX: 0, panY: 0 }, viewOverride: null,
    motionBlur: true, dof: true, showGuides: true, onlyAnimated: false, snap: true,
    quality: 1, workspace: 'stage', editStack: null, undoStack: [], redoStack: [], _editDepth: 0, _pendingSnapshot: null,
    clipboard: null, compStack: [], lastRenderMs: 0, autoSaveTimer: null, initialLoad: true, nodeGraphView: null,
    selectedTrackKey: null
  });

  // ---------------- snapshot / history ----------------
  function cleanProject(project) {
    return JSON.parse(JSON.stringify(project, (k, v) => {
      if (k === '_sim' || k === '_simSnapshots' || k === '_exprError' || k === '_simCache' || k === '_matteTemp') return undefined;
      if (k === '_rev' || k === '_demoMain' || k === '_titleComp') return v;
      if (k[0] === '_' && k !== '_rev' && k !== '_demoMain' && k !== '_titleComp') return undefined;
      return v;
    }));
  }
  App.cleanProject = cleanProject;
  App.snapshotState = function () {
    return {
      project: cleanProject(this.project),
      compId: this.comp ? this.comp.id : null,
      selection: this.selection.slice(),
      compStack: this.compStack.slice(),
      time: this.time, label: this._editLabel || ''
    };
  };
  App.beginEdit = function (label) {
    if (this._editDepth === 0) {
      this._pendingSnapshot = this.snapshotState();
      this._pendingSnapshot.label = label || '编辑';
    }
    this._editDepth++;
    this._editLabel = label || '编辑';
  };
  App.endEdit = function (changed = true) {
    this._editDepth = Math.max(0, this._editDepth - 1);
    if (this._editDepth > 0) return;
    if (changed && this._pendingSnapshot) {
      this.undoStack.push(this._pendingSnapshot);
      if (this.undoStack.length > 60) this.undoStack.shift();
      this.redoStack = [];
      this.project._rev = (this.project._rev || 0) + 1;
      this.autoSave();
    }
    this._pendingSnapshot = null;
    this.refreshStructure();
  };
  App.edit = function (label, fn) {
    this.beginEdit(label);
    try { fn(); } finally { this.endEdit(true); }
  };
  App.cancelEdit = function () { this._editDepth = 0; this._pendingSnapshot = null; };
  App.undo = function () {
    if (!this.undoStack.length) { this.toast('没有可撤销的操作', '到达历史起点', 'warn'); return; }
    const cur = this.snapshotState();
    const prev = this.undoStack.pop();
    this.redoStack.push(cur);
    this.restoreSnapshot(prev);
    this.toast('已撤销', prev.label || '', 'info');
  };
  App.redo = function () {
    if (!this.redoStack.length) { this.toast('没有可重做的操作', '', 'warn'); return; }
    const cur = this.snapshotState();
    const next = this.redoStack.pop();
    this.undoStack.push(cur);
    this.restoreSnapshot(next);
    this.toast('已重做', next.label || '', 'info');
  };
  App.restoreSnapshot = function (snap) {
    if (!snap) return;
    this.project = snap.project;
    this.project._rev = (this.project._rev || 0) + 1;
    this.comp = this.project.comps.find(c => c.id === snap.compId) || this.project.comps[0] || null;
    this.selection = (snap.selection || []).filter(id => this.comp && this.comp.layers.some(l => l.id === id));
    this.compStack = snap.compStack || [];
    this.time = Math.min(snap.time || 0, this.comp ? this.comp.duration : 0);
    this.selectedKeys.clear();
    this.playing = false;
    AE.Audio.engine.stopAll();
    if (AE.Build) AE.Build.clearCache();
    this.refreshAll();
    this.requestRender();
  };
  App.markDirty = function () {
    this.project._rev = (this.project._rev || 0) + 1;
    this.requestRender();
    this.autoSave();
  };
  App.autoSave = function () {
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem('prism.autosave.v1', JSON.stringify(cleanProject(this.project)));
        const el = $('#autosaveState'); if (el) { el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 900); }
      } catch (e) { }
    }, 800);
  };

  // ---------------- lifecycle ----------------
  App.init = function () {
    const canvas = $('#glCanvas');
    try { this.renderer = new AE.Renderer(canvas); } catch (e) { this.fatal(e); return; }
    this.renderer.project = null;
    AE.Audio.engine.initPending = true;
    this.bindGlobalUI();
    this.bindKeys();
    this.bindResize();
    this.loadDemo(false);
    this.refreshAll();
    requestAnimationFrame(this._rafLoop.bind(this));
    setTimeout(() => { this.initialLoad = false; }, 500);
  };
  App.fatal = function (e) {
    console.error(e);
    const stage = $('#stageView');
    if (stage) stage.insertAdjacentHTML('beforeend', `<div style="position:absolute;inset:0;display:grid;place-items:center;background:#080b10;color:#ffb4a8;font-size:13px;z-index:20;text-align:center;line-height:1.8">WebGL 2 初始化失败<br><span style="color:#7b8798;font-size:11px">${e.message}</span></div>`);
  };
  App.loadDemo = function (notify = true) {
    try {
      const project = AE.Demo.build();
      this.loadProject(project, { demo: true });
      if (notify) this.toast('示例已载入', '星核 · NOVA CORE / 15 秒', 'ok');
    } catch (e) {
      console.error(e); this.toast('示例载入失败', e.message, 'error');
    }
  };
  App.loadProject = function (project, opts = {}) {
    this.playing = false; AE.Audio.engine.stopAll();
    this.project = project; this.project._rev = (this.project._rev || 0) + 1;
    if (AE.Build) AE.Build.clearCache();
    const comp = project.comps.find(c => c.id === opts.compId) || project.comps.find(c => c.id === project._demoMain) || project.comps[0] || null;
    this.comp = comp;
    this.compStack = [];
    this.selection = [];
    this.selectedKeys.clear();
    this.time = 0;
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.viewOverride = null;
    this.renderer.project = project;
    this.renderer.motionBlurEnabled = this.motionBlur;
    this.renderer.dofEnabled = this.dof;
    this.undoStack = []; this.redoStack = [];
    this.refreshAll();
    setTimeout(() => this.requestRender(), 10);
  };
  App.newProject = function () {
    this.modal({
      title: '新建空工程', icon: 'i-file',
      body: `<div class="form-grid">
        <label>工程名称</label><input class="num-input" id="npName" value="未命名工程" style="text-align:left">
        <label>合成尺寸</label><div class="form-row"><input class="num-input" id="npW" value="1920"><span style="color:#556">×</span><input class="num-input" id="npH" value="1080"></div>
        <label>帧率</label><select class="mini-select" id="npFps"><option>60</option><option>30</option><option>24</option></select>
        <label>时长</label><input class="num-input" id="npDur" value="10">
        <label>背景</label><input type="color" id="npBg" value="#05070c" style="width:40px;height:24px;border:none;background:none">
      </div><div class="form-note">空工程将创建一个空白合成。你可以在其中新建形状、文字、几何、灯光与粒子，所有编辑机制与示例工程一致。</div>`,
      actions: [{ label: '取消' }, {
        label: '创建工程', primary: true, onClick: () => {
          const w = +$('#npW').value || 1920, h = +$('#npH').value || 1080, fps = +$('#npFps').value || 60, dur = +$('#npDur').value || 10;
          const name = $('#npName').value.trim() || '未命名工程';
          const project = P.newProject({ name });
          const c = P.newComp({ name: '合成 1', width: w, height: h, fps, duration: dur, bg: P.hex($('#npBg').value) });
          c.workEnd = dur; project.comps.push(c);
          this.loadProject(project);
          this.closeModal();
          this.toast('空工程已创建', '从形状或文字开始你的设计', 'ok');
        }
      }]
    });
  };
  App.loadAutosave = function () {
    try {
      const s = localStorage.getItem('prism.autosave.v1');
      if (!s) { this.toast('没有自动保存', '', 'warn'); return; }
      const p = JSON.parse(s);
      this.loadProject(p);
      this.toast('已恢复自动保存', new Date().toLocaleTimeString('zh-CN'), 'ok');
    } catch (e) { this.toast('恢复失败', e.message, 'error'); }
  };
  App.saveProject = function () {
    const data = JSON.stringify(cleanProject(this.project), null, 2);
    U.download(new Blob([data], { type: 'application/json' }), (this.project.name || 'prism-project').replace(/[\\/:*?"<>|]/g, '_') + '.prism.json');
    this.toast('工程已保存', 'JSON 工程文件已下载', 'ok');
  };
  App.openProject = async function () {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,.prism.json';
    inp.onchange = async () => {
      if (!inp.files[0]) return;
      try {
        const text = await U.readFileAsText(inp.files[0]);
        const p = JSON.parse(text);
        if (!p.comps) throw new Error('不是有效的工程文件');
        this.loadProject(p);
        this.toast('工程已打开', `${p.comps.length} 个合成`, 'ok');
      } catch (e) { this.toast('打开失败', e.message, 'error'); }
    };
    inp.click();
  };

  // ---------------- selection / comp navigation ----------------
  App.selectedLayers = function () {
    if (!this.comp) return [];
    return this.selection.map(id => this.comp.layers.find(l => l.id === id)).filter(Boolean);
  };
  App.selectedLayer = function () { return this.selectedLayers()[0] || null; };
  App.selectLayers = function (ids, additive = false) {
    if (!this.comp) return;
    const arr = Array.isArray(ids) ? ids : [ids];
    if (!additive) this.selection = arr.filter(Boolean);
    else {
      const set = new Set(this.selection);
      for (const id of arr) { if (set.has(id)) set.delete(id); else set.add(id); }
      this.selection = Array.from(set);
    }
    this.selectedKeys.clear();
    this.refreshSelectionUI();
    this.requestRender();
  };
  App.toggleLayerSelected = function (id) { this.selectLayers([id], true); };
  App.deselect = function () { this.selection = []; this.selectedKeys.clear(); this.refreshSelectionUI(); this.requestRender(); };
  App.setComp = function (comp, opts = {}) {
    if (!comp) return;
    this.comp = comp;
    this.selection = [];
    this.selectedKeys.clear();
    this.time = U.clamp(opts.time == null ? 0 : opts.time, 0, comp.duration);
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.workspace = 'stage';
    this.applyWorkspace();
    this.refreshAll();
    this.requestRender();
  };
  App.openComp = function (compId) {
    const c = this.project.comps.find(x => x.id === compId);
    if (!c) return;
    this.compStack = [];
    this.setComp(c);
  };
  App.enterPrecomp = function (layer) {
    if (!layer || layer.type !== 'precomp') return;
    const inner = P.findComp(this.project, layer.precomp.compId);
    if (!inner) return;
    this.compStack.push({ compId: this.comp.id, time: this.time, layerId: layer.id });
    const ctx = E.makeCtx(this.project, this.comp, this.time);
    const it = E.innerTime(this.comp, layer, this.time, ctx);
    this.setComp(inner, { time: it });
    this.toast('进入预合成', `${layer.name} → ${inner.name}`, 'info');
  };
  App.goBackComp = function () {
    const st = this.compStack.pop();
    if (!st) { this.toast('已在最外层合成', '', 'warn'); return; }
    const c = this.project.comps.find(x => x.id === st.compId);
    if (!c) return;
    this.setComp(c, { time: st.time });
    if (st.layerId) this.selectLayers([st.layerId]);
  };
  App.addComp = function () { this.newCompDialog(); };

  // ---------------- editing helpers ----------------
  App.editTime = function () { return this.playing ? this.playEditTime : this.time; };
  App.getProp = function (layer, key) { return layer && layer.props ? layer.props[key] : null; };
  App.writeValue = function (layer, key, value, time) {
    const p = layer.props[key]; if (!p) return;
    const t = time == null ? this.editTime() : time;
    if (p.keys && p.keys.length) {
      if (U.equals(p.value, value) && p.keys.length === 0) return;
      P.addKey(p, t, value, {}, layer);
    } else p.value = value;
  };
  App.setValue = function (layer, key, value) {
    if (!layer) return;
    this.writeValue(layer, key, value);
  };
  App.setValues = function (layers, key, value) {
    const t = this.editTime();
    for (const l of layers) this.writeValue(l, key, value, t);
  };
  App.ensureAnimated = function (layer, key) {
    const p = layer.props[key]; if (!p) return;
    if (p.keys.length) return;
    const cur = E.interpBase(p, this.editTime());
    P.addKey(p, this.editTime(), cur, {}, layer);
    p.animated = true;
  };
  App.toggleAnimation = function (layer, key) {
    if (!layer) return;
    const p = layer.props[key]; if (!p) return;
    this.edit(p.animated || p.keys.length ? '关闭动画' : '开启动画', () => {
      if (p.keys.length) {
        const val = E.propValue(layer, key, E.makeCtx(this.project, this.comp, this.time), this.time);
        p.keys = []; p.animated = false; p.value = val;
      } else {
        p.keys = []; p.value = E.interpBase(p, this.editTime());
        P.addKey(p, this.editTime(), p.value, {}, layer);
      }
    });
  };
  App.addKeyAtTime = function (layer, key, time) {
    if (!layer) return;
    const p = layer.props[key]; if (!p) return;
    this.edit('添加关键帧', () => {
      const v = p.keys.length ? E.interpBase(p, time) : p.value;
      P.addKey(p, time, U.deepClone(v), {}, layer);
    });
  };
  App.deleteKeyAtTime = function (layer, key, time) {
    const p = layer.props[key]; if (!p) return;
    const k = P.findKey(p, time); if (!k) return;
    this.edit('删除关键帧', () => { P.removeKey(p, time); });
  };
  App.navKey = function (dir, layers) {
    layers = layers || this.selectedLayers();
    let times = [];
    for (const l of layers) for (const k in l.props) { const p = l.props[k]; if (p.keys) for (const kk of p.keys) times.push(kk.t); }
    times = Array.from(new Set(times.map(t => +t.toFixed(4)))).sort((a, b) => a - b);
    if (!times.length) { this.toast('所选图层没有关键帧', '', 'warn'); return; }
    const t = this.time;
    let target;
    if (dir > 0) target = times.find(x => x > t + 1e-4); else target = times.slice().reverse().find(x => x < t - 1e-4);
    if (target == null) { this.toast(dir > 0 ? '已是最后一个关键帧' : '已是第一个关键帧', '', 'warn'); return; }
    this.setTime(target);
  };
  App.allAnimatedTracks = function (layers) {
    const out = [];
    for (const l of (layers || this.selectedLayers())) for (const g of P.propGroups(l)) for (const tr of g.tracks) {
      const p = l.props[tr.key]; if (p && (p.animated || p.keys.length || p.expr)) out.push({ layer: l, track: tr, prop: p, group: g });
    }
    return out;
  };
  App.selectAllKeys = function () {
    this.selectedKeys.clear();
    for (const { layer, track, prop } of this.allAnimatedTracks()) for (const k of prop.keys) this.selectedKeys.add(this.keyId(layer, track.key, k.t));
    this.toast('已选择全部关键帧', `${this.selectedKeys.size} 个`, 'info');
    if (AE.Timeline) AE.Timeline.render();
    if (AE.Curves) AE.Curves.render();
  };
  App.keyId = (layer, key, t) => `${layer.id}|${key}|${(+t).toFixed(5)}`;
  App.selectedKeyObjects = function () {
    const out = [];
    const seen = new Set();
    for (const id of this.selectedKeys) {
      const [layerId, key, t] = id.split('|');
      if (seen.has(layerId + '|' + key)) continue;
      const l = this.comp.layers.find(x => x.id === layerId); if (!l) continue;
      const p = l.props[key]; if (!p) continue;
      const k = P.findKey(p, +t); if (!k) continue;
      seen.add(layerId + '|' + key); out.push({ layer: l, key, prop: p, k, id });
    }
    return out;
  };
  App.applyEase = function (mode) {
    const sel = this.selectedKeyObjects();
    const apply = (k) => {
      if (mode === 'linear') { k.in = 'linear'; k.out = 'linear'; k.inH = null; k.outH = null; }
      else if (mode === 'hold') { k.out = 'hold'; k.in = 'linear'; }
      else if (mode === 'easeIn') { k.in = 'ease'; k.inH = [.42, 0]; k.out = 'linear'; k.outH = null; }
      else if (mode === 'easeOut') { k.out = 'ease'; k.outH = [1, 1]; k.in = 'linear'; k.inH = null; }
      else { k.in = 'ease'; k.out = 'ease'; k.inH = null; k.outH = null; }
      k.ease = mode !== 'linear' && mode !== 'hold';
    };
    if (!sel.length) {
      const tracks = this.allAnimatedTracks();
      if (!tracks.length) { this.toast('没有可应用的关键帧', '', 'warn'); return; }
      this.edit('设置缓动', () => { for (const tr of tracks) for (const k of tr.prop.keys) apply(k); });
      return;
    }
    this.edit('设置缓动', () => { for (const s of sel) apply(s.k); });
  };
  App.setSelectedKeyInterp = function (value) {
    const sel = this.selectedKeyObjects();
    if (!sel.length) return;
    this.edit('设置插值', () => { for (const s of sel) { s.k.out = value; if (value === 'ease') { s.k.outH = null; } if (value === 'hold') { s.k.in = 'linear'; } } });
  };
  App.selectAllLayers = function () { if (this.comp) this.selectLayers(this.comp.layers.map(l => l.id)); };
  App.deleteSelected = function () {
    if (this.selectedKeys.size) {
      this.edit('删除关键帧', () => {
        for (const layerId of new Set(Array.from(this.selectedKeys).map(id => id.split('|')[0]))) {
          const l = this.comp.layers.find(x => x.id === layerId); if (!l) continue;
          for (const id of Array.from(this.selectedKeys)) {
            const [lid, key, t] = id.split('|');
            if (lid !== layerId) continue;
            const p = l.props[key]; if (p) P.removeKey(p, +t);
          }
        }
        this.selectedKeys.clear();
      });
      return;
    }
    const layers = this.selectedLayers();
    if (!layers.length) return;
    this.edit('删除图层', () => {
      for (const l of layers) this.comp.layers = this.comp.layers.filter(x => x !== l);
      // clear parent refs
      for (const l of this.comp.layers) if (layers.some(d => d.id === l.parent)) l.parent = null;
      this.selection = [];
    });
    this.toast('图层已删除', layers.map(l => l.name).join('、'), 'info');
  };
  App.duplicateSelected = function () {
    if (this.selectedKeys.size) { this.copy(); this.paste(); return; }
    const layers = this.selectedLayers(); if (!layers.length) return;
    const newSel = [];
    this.edit('复制图层', () => {
      for (const l of layers) {
        const copy = this.cloneLayer(l);
        copy.name = l.name + ' 副本';
        const idx = this.comp.layers.indexOf(l);
        this.comp.layers.splice(idx + 1, 0, copy);
        newSel.push(copy.id);
      }
    });
    this.selection = newSel;
    this.refreshSelectionUI();
  };
  App.cloneLayer = function (layer) {
    const copy = U.deepClone(layer);
    const remap = {};
    const nid = () => U.uid('layer');
    const oldId = copy.id; copy.id = nid(); remap[oldId] = copy.id;
    // children ids inside props keys
    const oldContents = copy.contents || [];
    for (const c of oldContents) { const old = c.id; c.id = U.uid('content'); remap[old] = c.id; }
    for (const m of (copy.masks || [])) { const old = m.id; m.id = U.uid('mask'); remap[old] = m.id; }
    for (const f of (copy.effects || [])) { const old = f.id; f.id = U.uid('fx'); remap[old] = f.id; }
    if (copy.geo && copy.geo.pins) for (const p of copy.geo.pins) { const old = p.id; p.id = U.uid('pin'); remap[old] = p.id; }
    if (copy.text && copy.text.animators) for (const a of copy.text.animators) { const old = a.id; a.id = U.uid('anim'); remap[old] = a.id; }
    if (copy.parent) copy.parent = remap[copy.parent] || copy.parent;
    if (copy.matte && copy.matte.source) copy.matte.source = remap[copy.matte.source] || copy.matte.source;
    if (copy.geo && copy.geo.fields) copy.geo.fields = copy.geo.fields.slice();
    const newProps = {};
    for (const k in copy.props) {
      let nk = k;
      for (const old in remap) nk = nk.split(old).join(remap[old]);
      newProps[nk] = copy.props[k];
    }
    copy.props = newProps;
    delete copy._sim;
    return copy;
  };
  App.copy = function () {
    const keys = this.selectedKeyObjects();
    if (keys.length) {
      const base = Math.min(...keys.map(s => s.k.t));
      this.clipboard = { type: 'keys', items: keys.map(s => ({ layerId: s.layer.id, key: s.key, t: s.k.t, rel: s.k.t - base, k: U.deepClone(s.k) })) };
      this.toast('已复制关键帧', `${keys.length} 个`, 'info');
      return;
    }
    const layers = this.selectedLayers();
    if (!layers.length) return;
    this.clipboard = { type: 'layers', items: layers.map(l => { const c = U.deepClone(l); delete c._sim; return c; }) };
    this.toast('已复制图层', `${layers.length} 个`, 'info');
  };
  App.paste = function () {
    const cb = this.clipboard; if (!cb) { this.toast('剪贴板为空', '', 'warn'); return; }
    if (cb.type === 'keys') {
      const target = this.selectedLayer();
      const layers = this.selectedLayers();
      this.edit('粘贴关键帧', () => {
        for (const it of cb.items) {
          const layer = layers.length === 1 ? layers[0] : this.comp.layers.find(l => l.id === it.layerId);
          if (!layer) continue;
          let key = it.key;
          let p = layer.props[key];
          if (!p) {
            // try same suffix match by track label
            const track = P.tracksOf(layer).find(t => t.key.split('.').pop() === key.split('.').pop());
            if (track) { key = track.key; p = layer.props[key]; }
          }
          if (!p) continue;
          const nk = U.deepClone(it.k); nk.t = this.time + it.rel;
          const exist = P.findKey(p, nk.t); if (exist) p.keys = p.keys.filter(x => x !== exist);
          p.keys.push(nk); p.keys.sort((a, b) => a.t - b.t); p.animated = true;
        }
      });
      this.toast('已粘贴关键帧', `${cb.items.length} 个`, 'ok');
    } else {
      const newSel = [];
      this.edit('粘贴图层', () => {
        for (const l of cb.items) {
          const copy = this.cloneLayer(l);
          this.comp.layers.push(copy); newSel.push(copy.id);
        }
      });
      this.selection = newSel; this.refreshSelectionUI();
    }
  };
  App.addLayer = function (type, opts = {}) {
    if (!this.comp) { this.toast('请先新建合成', '', 'warn'); return null; }
    const l = P.createLayer(this.project, this.comp, type, opts);
    this.comp.layers.push(l);
    this.project._rev++;
    this.selection = [l.id];
    if (AE.Build) AE.Build.clearCache();
    this.refreshAll(); this.requestRender();
    return l;
  };
  App.moveLayer = function (layer, dir) {
    if (!this.comp) return;
    const i = this.comp.layers.indexOf(layer); if (i < 0) return;
    const j = U.clamp(i + dir, 0, this.comp.layers.length - 1);
    if (i === j) return;
    this.edit('调整图层顺序', () => { this.comp.layers.splice(i, 1); this.comp.layers.splice(j, 0, layer); });
  };
  App.setParent = function (layer, parentId) {
    if (!layer) return;
    if (parentId && (parentId === layer.id || P.isAncestor(this.comp, layer.id, this.comp.layers.find(l => l.id === parentId)))) {
      this.toast('不能创建循环父级', '请选择其他图层', 'error'); return;
    }
    const comp = this.comp, t = this.editTime();
    const ctx = E.makeCtx(this.project, comp, t);
    const is3D = !!(layer.threeD || ['geo', 'nodes', 'particle', 'camera', 'light', 'field'].includes(layer.type) || (layer.type === 'precomp' && layer.precomp.mode === 'preserve3d'));
    const anchor = E.vec(E.propValue(layer, 'transform.anchor', ctx, t), 3).map(E.num);
    const p = layer.props;
    this.edit('设置父级', () => {
      let beforeM = is3D ? E.worldMatrix(comp, layer, ctx, t) : null;
      let beforeA = !is3D ? E.worldAffine(comp, layer, ctx, t) : null;
      layer.parent = parentId || null;
      const parent = parentId ? comp.layers.find(l => l.id === parentId) : null;
      const setVal = (key, val) => {
        const pr = p[key]; if (!pr) return;
        if (pr.keys && pr.keys.length) P.addKey(pr, t, val, {}, layer); else pr.value = val;
      };
      if (is3D) {
        const pm = parent ? E.worldMatrix(comp, parent, ctx, t) : M.identity();
        const local = M.mult(M.invert(pm), beforeM);
        const dec = M.decompose(local);
        const rot = dec.rot;
        const scl = dec.scale.map(v => v / 100);
        const off = M.transformDir(M.fromTRS([0, 0, 0], rot, [scl[0] * 100, scl[1] * 100, scl[2] * 100]), anchor);
        setVal('transform.position', [dec.pos[0] + off[0], dec.pos[1] + off[1], dec.pos[2] + off[2]]);
        setVal('transform.rotation', rot);
        setVal('transform.scale', dec.scale);
      } else {
        const pa = parent ? E.worldAffine(comp, parent, ctx, t) : U.affine.id();
        const local = U.affine.mul(U.affine.inv(pa), beforeA);
        const a = local[0], b = local[1], c2 = local[2], d = local[3], e2 = local[4], f2 = local[5];
        const rot = Math.atan2(b, a);
        const sx = Math.hypot(a, b) || 1;
        const det = a * d - b * c2;
        const sy = (Math.hypot(c2, d) || 1) * (det < 0 ? -1 : 1);
        const cos = Math.cos(rot), sin = Math.sin(rot);
        const pos = [e2 + cos * sx * anchor[0] - sin * sy * anchor[1], f2 + sin * sx * anchor[0] + cos * sy * anchor[1], E.num(E.propValue(layer, 'transform.position', ctx, t)[2] || 0)];
        setVal('transform.position', pos);
        setVal('transform.rotation', [0, 0, U.deg(rot)]);
        setVal('transform.scale', [sx * 100, sy * 100, 100]);
      }
    });
    if (AE.Timeline) AE.Timeline.render();
  };
  App.precomposeSelected = function () {
    const layers = this.selectedLayers();
    if (!layers.length) { this.toast('请选择要预合成的图层', '', 'warn'); return; }
    const comp = this.comp;
    const inner = P.newComp({ name: '预合成 ' + (this.project.comps.filter(c => c.name.startsWith('预合成')).length + 1), width: comp.width, height: comp.height, fps: comp.fps, duration: comp.duration, bg: [0, 0, 0, 0] });
    this.edit('预合成', () => {
      this.project.comps.push(inner);
      const selectedSet = new Set(layers.map(l => l.id));
      layers.forEach(l => { if (l.parent && selectedSet.has(l.parent)) inner.layers.push(l); else inner.layers.push(l); });
      // remove from outer preserving order
      comp.layers = comp.layers.filter(l => !selectedSet.has(l.id));
      for (const l of inner.layers) { l.inPoint = Math.max(0, l.inPoint); }
      const pre = P.createLayer(this.project, comp, 'precomp', { name: inner.name, compId: inner.id, mode: 'flat' });
      pre.position = [comp.width / 2, comp.height / 2, 0];
      pre.props['transform.position'].value = [comp.width / 2, comp.height / 2, 0];
      pre.props['transform.anchor'].value = [0, 0, 0];
      pre.inPoint = Math.min(...layers.map(l => l.inPoint));
      pre.outPoint = Math.max(...layers.map(l => l.outPoint));
      comp.layers.push(pre);
      this.selection = [pre.id];
    });
    this.project._rev++;
    this.toast('预合成完成', `${layers.length} 个图层 → ${inner.name}`, 'ok');
    this.refreshAll(); this.requestRender();
  };

  // ---------------- time / playback ----------------
  App.setTime = function (t, opts = {}) {
    if (!this.comp) return;
    const dur = this.comp.duration;
    t = U.clamp(t, 0, dur);
    if (!opts.raw) t = Math.round(t * this.comp.fps) / this.comp.fps;
    if (Math.abs(t - this.time) < 1e-9 && !opts.force) return;
    this.time = t;
    if (!opts.fromPlay && this.playing) this.pause(true);
    if (AE.Timeline) AE.Timeline.updatePlayhead();
    if (AE.Props) AE.Props.updateLiveValues();
    if (AE.CanvasView) AE.CanvasView.draw();
    this.updateStatus();
    this.requestRender();
    if (this.workspace === 'curves' && AE.Curves) AE.Curves.render();
  };
  App.setFrame = function (f) { this.setTime(f / this.comp.fps, { raw: true }); };
  App.stepFrame = function (dir) {
    if (!this.comp) return;
    const f = Math.round(this.time * this.comp.fps) + dir;
    this.setTime(U.clamp(f, 0, Math.round(this.comp.duration * this.comp.fps)) / this.comp.fps, { raw: true });
  };
  App.play = function () {
    if (!this.comp || this.playing || this.exportMode) return;
    this.playing = true;
    this.playStartWall = performance.now();
    this.playStartTime = this.time;
    this.playEditTime = this.time;
    if (this.time >= this.comp.workEnd - 1e-5) this.time = this.comp.workStart;
    this.playStartWall = performance.now();
    this.playStartTime = this.time;
    AE.Audio.engine.setProject(this.project);
    AE.Audio.engine.schedule(this.project, this.comp, this.time);
    const pb = $('#playBtn'); if (pb) { pb.classList.add('playing'); pb.innerHTML = '<svg><use href="#i-pause"/></svg>'; }
    this.requestRender();
  };
  App.pause = function (stopAudio = true) {
    if (!this.playing) return;
    this.playing = false;
    if (stopAudio) AE.Audio.engine.stopAll();
    const pb = $('#playBtn'); if (pb) { pb.classList.remove('playing'); pb.innerHTML = '<svg><use href="#i-play"/></svg>'; }
    this.requestRender();
  };
  App.togglePlay = function () { this.playing ? this.pause() : this.play(); };
  App.toggleLoop = function () {
    this._loop = !this._loop;
    const b = $('#loopBtn'); if (b) b.classList.toggle('on', !!this._loop);
  };
  App.loopEnabled = function () { return !!this._loop; };
  App.workRange = function () {
    if (!this.comp) return [0, 0];
    return [Math.min(this.comp.workStart, this.comp.workEnd), Math.max(this.comp.workStart, this.comp.workEnd)];
  };

  // ---------------- rendering ----------------
  App.requestRender = function () { this._needsRender = true; };
  App.renderNow = function () {
    if (!this.renderer) return;
    const t0 = performance.now();
    if (!this.comp) {
      this.renderer.clearCanvas();
    } else {
      this.renderer.motionBlurEnabled = this.motionBlur && !this.playing && !this.exportMode ? true : (this.exportMode ? true : this.motionBlur && !this.playing);
      if (this.exporting) this.renderer.motionBlurEnabled = true;
      this.renderer.dofEnabled = this.dof;
      this.renderer.project = this.project;
      this.renderer.render(this.comp, this.time, {
        quality: this.exporting ? 1 : this.quality,
        view: this.view,
        viewOverride: this.viewOverride && this.viewOverride.type ? this.viewOverride : null
      });
    }
    this.lastRenderMs = performance.now() - t0;
    this._needsRender = false;
    if (AE.CanvasView) AE.CanvasView.draw();
    this.updateZoom();
    this.updateStatus();
  };
  App._rafLoop = function () {
    if (!this._rafStarted) this._rafStarted = true;
    if (this.playing && !this.exportMode) {
      const t = this.playStartTime + (performance.now() - this.playStartWall) / 1000;
      const [ws, we] = this.workRange();
      if (t >= we) {
        if (this.loopEnabled()) {
          this.playStartWall = performance.now(); this.playStartTime = ws;
          this.time = ws;
          AE.Audio.engine.schedule(this.project, this.comp, ws);
        } else {
          this.time = this.comp.duration;
          this.pause();
        }
      } else this.time = Math.min(t, this.comp.duration);
      if (AE.Timeline) AE.Timeline.updatePlayhead();
      if (AE.Props) AE.Props.updateLiveValues();
      if (AE.CanvasView) AE.CanvasView.draw();
      if (this.workspace === 'curves' && AE.Curves && (performance.now() - (this._curveTick || 0) > 80)) { this._curveTick = performance.now(); AE.Curves.render(); }
      this.updateStatus();
      this._needsRender = true;
    }
    if (this._needsRender) this.renderNow();
    this._lastLoop = performance.now();
    this._raf = requestAnimationFrame(this._rafLoop.bind(this));
  };
  App.fitView = function () { this.view = { zoom: 1, panX: 0, panY: 0 }; this.requestRender(); this.updateZoom(); };
  App.zoomBy = function (f) { this.view.zoom = U.clamp((this.view.zoom || 1) * f, .1, 8); this.requestRender(); };
  App.zoomReset = function () { this.view.zoom = 1; this.view.panX = 0; this.view.panY = 0; this.requestRender(); };
  App.updateZoom = function () {
    if (!this.renderer || !this.comp) return;
    const pct = this.renderer.lastCompRect && this.comp ? Math.round(this.renderer.lastCompRect.w / this.renderer.dpr / this.comp.width * 100) : 100;
    const z = $('#zoomLabel'); if (z) z.textContent = pct + '%';
    const s = $('#sbZoom'); if (s) s.textContent = pct + '%';
  };

  // ---------------- refresh / UI ----------------
  App.refreshAll = function () {
    if (!this.project) return;
    this.project._rev = (this.project._rev || 0) + 1;
    if (AE.ProjectPanel) AE.ProjectPanel.render();
    this.refreshStructure();
    this.refreshSelectionUI();
    this.applyWorkspace();
    this.requestRender();
    this.updateStatus();
    this.renderBreadcrumb();
  };
  App.refreshStructure = function () {
    if (AE.Timeline) AE.Timeline.render();
    if (AE.Props) AE.Props.render();
    if (AE.Curves) AE.Curves.render();
    if (AE.NodesUI) AE.NodesUI.render();
    this.renderBreadcrumb();
    this.updateStatus();
    this.requestRender();
  };
  App.refreshSelectionUI = function () {
    if (AE.Timeline) AE.Timeline.render();
    if (AE.Props) AE.Props.render();
    if (AE.CanvasView) AE.CanvasView.draw();
    if (AE.Curves) AE.Curves.render();
    this.updateStatus();
    this.requestRender();
  };
  App.updateStatus = function () {
    const comp = this.comp;
    const sel = this.selectedLayers();
    const setText = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };
    setText('sbComp', comp ? comp.name : '无合成');
    setText('sbPath', this.compStack.length ? this.compStack.map(s => (this.project.comps.find(c => c.id === s.compId) || {}).name).filter(Boolean).join(' / ') + ' / ' + (comp ? comp.name : '') : (comp ? comp.name : ''));
    setText('sbSelection', sel.length ? (sel.length === 1 ? sel[0].name : `已选择 ${sel.length} 个图层`) : '未选择图层');
    if (this.renderer && this.renderer.lastCamera) {
      const c = this.renderer.lastCamera;
      setText('sbCam', c.default ? '默认相机' : 'CAM · ' + Math.round(c.pos[2]) + 'mm');
      setText('hudCam', c.default ? '默认相机 · 35mm' : 'CAM · FOV ' + Math.round(c.fov) + '°');
    }
    setText('hudSel', sel.length ? (sel.length === 1 ? sel[0].name : sel.length + ' 个对象') : '未选择对象');
    setText('hudComp', comp ? comp.name : '—');
    setText('hudTime', U.timecode(this.time, comp ? comp.fps : 60));
    setText('frameLabel', 'F ' + Math.round(this.time * (comp ? comp.fps : 60)));
    setText('fpsLabel', (comp ? comp.fps : 60) + ' fps');
    const tc = $('#timecodeInput'); if (tc && document.activeElement !== tc) tc.value = U.timecode(this.time, comp ? comp.fps : 60);
    const rs = $('#renderStatus'); if (rs) rs.textContent = this.exportMode ? '逐帧导出中' : (this.playing ? '播放中 · ' + Math.round(1000 / Math.max(1, this.lastRenderMs)) + ' fps' : 'WebGL 2 就绪');
    if ($('#audioMeterBar')) { const lvl = AE.Audio.engine.playing ? AE.Audio.engine.level() : 0; $('#audioMeterBar').style.width = (lvl * 100) + '%'; }
    setText('sbAudio', AE.Audio.engine.playing ? '音色播放中' : '音色音频');
    if ($('#keySummary')) $('#keySummary').textContent = this.comp ? this.comp.layers.reduce((a, l) => a + P.countKeys(l), 0) + ' 个关键帧' : '0 个关键帧';
  };
  App.renderBreadcrumb = function () {
    const el = $('#compBreadcrumb'); if (!el) return;
    el.innerHTML = '';
    if (!this.comp) return;
    if (this.compStack.length) {
      const up = U.el('button', 'bc-up', '↖ 返回'); up.onclick = () => this.goBackComp(); el.appendChild(up);
    }
    const names = [];
    for (const s of this.compStack) { const c = this.project.comps.find(x => x.id === s.compId); if (c) names.push(c); }
    names.push(this.comp);
    names.forEach((c, i) => {
      if (i) { const sp = U.el('span', 'bc-sep', '/'); el.appendChild(sp); }
      const b = U.el('span', 'bc-item' + (i === names.length - 1 ? ' cur' : ''), c.name);
      if (i < names.length - 1) b.onclick = () => { if (i === 0) { this.compStack = []; this.setComp(c); } };
      el.appendChild(b);
    });
    const meta = U.el('span', 'bc-meta', `${this.comp.width}×${this.comp.height} · ${this.comp.fps}fps · ${this.comp.duration.toFixed(1)}s`);
    meta.style.cssText = 'margin-left:auto;color:#465466;font-family:var(--mono);font-size:8px;letter-spacing:.4px';
    el.appendChild(meta);
  };

  // ---------------- workspace ----------------
  App.setWorkspace = function (ws) {
    this.workspace = ws;
    this.applyWorkspace();
    if (ws === 'curves' && AE.Curves) AE.Curves.fit();
    if (ws === 'nodes' && AE.NodesUI) AE.NodesUI.render();
    if (ws === 'scene' && AE.CanvasView) AE.CanvasView.draw();
    this.requestRender();
  };
  App.applyWorkspace = function () {
    const ws = this.workspace || 'stage';
    $$('#wsTabs .ws-tab').forEach(b => b.classList.toggle('active', b.dataset.ws === ws));
    const show = {
      stageView: ws === 'stage' || ws === 'scene',
      curveView: ws === 'curves',
      nodeView: ws === 'nodes',
      sceneView: ws === 'scene'
    };
    for (const id in show) { const el = document.getElementById(id); if (el) el.classList.toggle('active', show[id]); }
    const vp = $('#viewportToolbar'), hud = $('#viewportHud'), ax = $('#axisGizmo');
    if (vp) vp.style.display = ws === 'scene' ? 'none' : '';
    if (hud) hud.style.display = ws === 'scene' ? 'none' : '';
    if (ax) ax.style.display = ws === 'scene' ? 'none' : '';
    if (ws === 'scene') {
      const sv = $('#sceneView');
      if (sv) { sv.style.background = 'transparent'; sv.style.pointerEvents = 'none'; sv.querySelectorAll('.scene-toolbar,.scene-panel').forEach(e => e.style.pointerEvents = 'auto'); }
      this.viewOverride = this.sceneView || { type: 'persp', azimuth: .55, elevation: .32, zoom: .92 };
      if (!this.viewOverride.type) this.viewOverride.type = 'persp';
    } else {
      this.viewOverride = null;
    }
    if (AE.CanvasView) AE.CanvasView.resize();
    this.requestRender();
  };
  App.hideOtherViews = function () { };

  // ---------------- global UI binding ----------------
  App.bindGlobalUI = function () {
    const self = this;
    // workspace tabs
    $$('#wsTabs .ws-tab').forEach(b => b.onclick = () => this.setWorkspace(b.dataset.ws));
    // titlebar actions
    $('#undoBtn').onclick = () => this.undo();
    $('#redoBtn').onclick = () => this.redo();
    $('#helpBtn').onclick = () => this.showShortcuts();
    $('#exportBtn').onclick = () => this.exportDialog();
    $('#newProjectBtn').onclick = () => this.newProject();
    $('#demoBtn').onclick = () => this.loadDemo();
    $('#emptyDemoBtn') && ($('#emptyDemoBtn').onclick = () => this.loadDemo());
    $('#newCompBtn').onclick = () => this.newCompDialog();
    $('#projectMenuBtn').onclick = (e) => this.projectMenu(e);
    $('#compList').onclick = (e) => {
      const item = e.target.closest('.comp-item'); if (!item) return;
      this.openComp(item.dataset.id);
    };
    $('#nodeGroupList').onclick = (e) => {
      const item = e.target.closest('.ng-row'); if (!item) return;
      if (AE.NodesUI) { this.setWorkspace('nodes'); AE.NodesUI.setGraph(item.dataset.id); }
    };
    $('#projectSearch').oninput = () => { if (AE.ProjectPanel) AE.ProjectPanel.render(); };
    $$('#menubar button').forEach(b => b.onclick = (e) => this.showMenuBar(b.dataset.menu, b));
    // viewport buttons
    $('#fitBtn').onclick = () => this.fitView();
    $('#viewModeBtn').onclick = (e) => this.viewModeMenu(e.currentTarget);
    $('#resBtn').onclick = () => {
      const opts = [1, .75, .5]; let i = opts.indexOf(this.quality); i = (i + 1) % opts.length; this.quality = opts[i];
      $('#resBtn').textContent = this.quality === 1 ? '完整' : this.quality === .75 ? '3/4' : '半分辨率';
      this.requestRender();
    };
    $('#mbBtn').onclick = () => { this.motionBlur = !this.motionBlur; $('#mbBtn').textContent = 'MB ' + (this.motionBlur ? '开' : '关'); $('#mbBtn').classList.toggle('on', this.motionBlur); this.requestRender(); };
    $('#dofBtn').onclick = () => { this.dof = !this.dof; $('#dofBtn').textContent = 'DOF ' + (this.dof ? '开' : '关'); $('#dofBtn').classList.toggle('on', this.dof); this.requestRender(); };
    $('#togglePanelsBtn').onclick = () => this.togglePanels();
    $('#layoutBtn').onclick = () => { $('#projectPanel').style.display = ''; $('#propsPanel').style.display = ''; this.fitView(); };
    // props panel
    $('#propsMenuBtn').onclick = (e) => this.propsMenu(e);
    // transport
    $('#playBtn').onclick = () => this.togglePlay();
    $('#goStartBtn').onclick = () => this.setTime(0);
    $('#goEndBtn').onclick = () => this.setTime(this.comp.duration);
    $('#prevFrameBtn').onclick = () => this.stepFrame(-1);
    $('#nextFrameBtn').onclick = () => this.stepFrame(1);
    $('#prevKeyBtn').onclick = () => this.navKey(-1);
    $('#nextKeyBtn').onclick = () => this.navKey(1);
    $('#loopBtn').onclick = () => this.toggleLoop();
    const tc = $('#timecodeInput');
    tc.onfocus = () => tc.select();
    tc.onkeydown = (e) => { if (e.key === 'Enter') { const t = U.parseTime(tc.value, this.comp.fps); if (t != null) this.setTime(t); else this.toast('时间格式无效', '例：00:00:03:12 / 3.5s', 'warn'); tc.blur(); } };
    tc.onblur = () => { this.updateStatus(); };
    $('#addMarkerBtn').onclick = () => this.addMarker();
    // timeline toolbar
    $('#tlZoomIn').onclick = () => { if (AE.Timeline) AE.Timeline.zoom(1.35); };
    $('#tlZoomOut').onclick = () => { if (AE.Timeline) AE.Timeline.zoom(1 / 1.35); };
    $('#onlyAnimatedBtn').onclick = () => { this.onlyAnimated = !this.onlyAnimated; $('#onlyAnimatedBtn').classList.toggle('active', this.onlyAnimated); if (AE.Timeline) AE.Timeline.render(); };
    $('#tlSnapBtn').onclick = () => { this.snap = !this.snap; $('#tlSnapBtn').classList.toggle('active', this.snap); };
    $('#collapseAllBtn').onclick = () => { if (AE.Timeline) AE.Timeline.collapseAll(); };
    $('#tlMenuBtn').onclick = (e) => this.timelineMenu(e);
    // close menus on outside click
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.menu-pop') && !e.target.closest('#menubar')) this.hideMenu();
    }, true);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.hideMenu(); this.closeModal(); } }, true);
    // stage view interactions are bound in CanvasView
    if (AE.CanvasView) AE.CanvasView.init();
    if (AE.Timeline) AE.Timeline.init();
    if (AE.Props) AE.Props.init();
    if (AE.Curves) AE.Curves.init();
    if (AE.NodesUI) AE.NodesUI.init();
    this.bindSceneUI();
    this.bindWorkspaceResize();
    // set buttons initial states
    $('#mbBtn').classList.toggle('on', this.motionBlur);
    $('#dofBtn').classList.toggle('on', this.dof);
    $('#tlSnapBtn').classList.toggle('active', this.snap);
  };
  App.togglePanels = function () {
    const left = $('#projectPanel'), right = $('#propsPanel'), main = $('#main');
    if (!left || !right) return;
    const hide = left.style.display !== 'none';
    left.style.display = hide ? 'none' : '';
    right.style.display = hide ? 'none' : '';
    if (main) main.classList.toggle('panels-hidden', hide);
    setTimeout(() => this.requestRender(), 60);
  };
  App.bindSceneUI = function () {    const seg = $('#sceneViewSeg');
    if (seg) seg.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      const v = b.dataset.view;
      this.sceneView = v === 'persp' ? { type: 'persp', azimuth: .55, elevation: .32, zoom: .92 } : { type: v };
      this.viewOverride = this.sceneView; this.requestRender(); this.renderSceneInfo();
    };
    const info = $('#sceneInfo'); if (info) info.onclick = () => { };
    if (this.sceneGrid == null) this.sceneGrid = true;
    const gbtn = $('#sceneGridBtn');
    if (gbtn) {
      gbtn.classList.toggle('active', this.sceneGrid !== false);
      gbtn.onclick = () => { this.sceneGrid = this.sceneGrid === false; gbtn.classList.toggle('active', this.sceneGrid !== false); this.requestRender(); };
    }
    const wbtn = $('#sceneWireBtn');
    if (wbtn) {
      if (this.showWire == null) this.showWire = true;
      wbtn.classList.toggle('active', this.showWire !== false);
      wbtn.onclick = () => { this.showWire = this.showWire === false; wbtn.classList.toggle('active', this.showWire !== false); if (AE.CanvasView) AE.CanvasView.draw(); };
    }
    this.renderSceneInfo();
  };
  App.renderSceneInfo = function () {
    const panel = $('#sceneInspector'); if (!panel) return;
    const sel = this.selectedLayer();
    const cam = this.renderer && this.renderer.lastCamera;
    panel.innerHTML = `<div class="sp-title">空间检查器</div>
      <div class="sp-row"><span>视图</span><b>${(this.sceneView && this.sceneView.type) || 'persp'}</b></div>
      <div class="sp-row"><span>相机位置</span><b>${cam ? cam.pos.map(v => Math.round(v)).join(' / ') : '—'}</b></div>
      <div class="sp-row"><span>对焦</span><b>${cam ? Math.round(cam.focus) : '—'} u</b></div>
      <div class="sp-row"><span>光圈</span><b>${cam ? E.num(cam.aperture).toFixed(2) : '—'}</b></div>
      <div class="sp-row"><span>选中</span><b style="color:#9ed4c9;max-width:120px;overflow:hidden;text-overflow:ellipsis">${sel ? sel.name : '无'}</b></div>
      <div class="sp-row"><span>空间模式</span><b>${sel && sel.type === 'precomp' ? (sel.precomp.mode === 'preserve3d' ? '保留三维' : '独立画面') : '—'}</b></div>
      <div class="sp-row"><span>三维图层</span><b>${this.comp ? this.comp.layers.filter(l => l.threeD).length : 0}</b></div>
      <div style="font-size:8px;color:#4b5a6b;line-height:1.6;margin-top:7px">提示：在合成视图直接选择图层，左侧切到「三维」可切换前 / 顶 / 侧视图检查几何与灯光。</div>`;
  };
  App.bindWorkspaceResize = function () {
    const target = $('#stageWrap');
    if (!target) return;
    this._ro = new ResizeObserver(() => { if (this.renderer) { this.renderer.resize(); if (AE.CanvasView) AE.CanvasView.resize(); this.requestRender(); } });
    this._ro.observe(target);
    window.addEventListener('resize', () => { if (this.renderer) { this.renderer.resize(); if (AE.CanvasView) AE.CanvasView.resize(); this.requestRender(); } });
  };
  App.bindResize = function () { };
  App.addMarker = function () {
    if (!this.comp) return;
    const label = prompt('标记名称', '标记 ' + (this.comp.markers.length + 1));
    if (label == null) return;
    this.edit('添加标记', () => { this.comp.markers.push({ t: this.time, label: label || '标记', color: '#ffb454' }); });
  };

  // ---------------- keyboard ----------------
  App.isTyping = function () {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable || tag === 'SELECT';
  };
  App.bindKeys = function () {
    window.addEventListener('keydown', (e) => {
      if (this.isTyping()) return;
      const meta = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (meta && e.altKey && k.toLowerCase() === 'a') { e.preventDefault(); this.selectAllKeys(); return; }
      if (meta) {
        if (k.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
        if ((k.toLowerCase() === 'z' && e.shiftKey) || k.toLowerCase() === 'y') { e.preventDefault(); this.redo(); return; }
        if (e.shiftKey && k.toLowerCase() === 'c') { e.preventDefault(); this.precomposeSelected(); return; }
        if (k.toLowerCase() === 'a') { e.preventDefault(); this.selectAllLayers(); return; }
        if (k.toLowerCase() === 'd') { e.preventDefault(); this.duplicateSelected(); return; }
        if (k.toLowerCase() === 'c') { e.preventDefault(); this.copy(); return; }
        if (k.toLowerCase() === 'v') { e.preventDefault(); this.paste(); return; }
        if (k.toLowerCase() === 's') { e.preventDefault(); this.saveProject(); return; }
        if (k.toLowerCase() === 'o') { e.preventDefault(); this.openProject(); return; }
        if (k.toLowerCase() === 'n') { e.preventDefault(); this.newCompDialog(); return; }
        if (k.toLowerCase() === 'e') { e.preventDefault(); this.exportDialog(); return; }
        if (k === '0') { e.preventDefault(); this.fitView(); return; }
        if (k === '1') { e.preventDefault(); this.zoomReset(); return; }
        return;
      }
      if (e.altKey) return;
      switch (k) {
        case ' ': e.preventDefault(); this.togglePlay(); break;
        case 'F9': e.preventDefault(); this.applyEase('ease'); break;
        case 'ArrowLeft': e.preventDefault(); this.stepFrame(-1); break;
        case 'ArrowRight': e.preventDefault(); this.stepFrame(1); break;
        case 'Home': e.preventDefault(); this.setTime(0); break;
        case 'End': e.preventDefault(); this.setTime(this.comp.duration); break;
        case 'j': case 'J': e.preventDefault(); this.navKey(-1); break;
        case 'k': case 'K': e.preventDefault(); this.navKey(1); break;
        case 'Delete': case 'Backspace': e.preventDefault(); this.deleteSelected(); break;
        case 'Tab': e.preventDefault(); this.togglePanels(); break;
        case 'Escape': this.deselect(); break;
        case 'v': case 'V': if (AE.CanvasView) AE.CanvasView.setTool('select'); break;
        case 'h': case 'H': if (AE.CanvasView) AE.CanvasView.setTool('hand'); break;
        case 'z': case 'Z': if (AE.CanvasView) AE.CanvasView.setTool('zoom'); break;
        case 'g': case 'G': if (AE.CanvasView) AE.CanvasView.setTool('pen'); break;
        case 't': case 'T': if (AE.CanvasView) AE.CanvasView.setTool('text'); break;
        case 'm': case 'M': if (AE.CanvasView) AE.CanvasView.setTool('mask'); break;
        case 'y': case 'Y': if (AE.CanvasView) AE.CanvasView.setTool('anchor'); break;
        case 'p': case 'P': if (AE.CanvasView) AE.CanvasView.setTool('pin'); break;
        case '1': this.setWorkspace('stage'); break;
        case '2': this.setWorkspace('curves'); break;
        case '3': this.setWorkspace('nodes'); break;
        case '4': this.setWorkspace('scene'); break;
      }
    });
  };

  // ---------------- toast / modal / menu ----------------
  App.toast = function (title, body, type) {
    const root = $('#toastRoot'); if (!root) return;
    const el = U.el('div', 'toast ' + (type === 'error' ? 'error' : type === 'warn' ? 'warn' : ''));
    el.innerHTML = `<div class="t-ic"><svg><use href="#${type === 'error' ? 'i-close' : type === 'warn' ? 'i-help' : 'i-check'}"/></svg></div><div class="t-body">${title ? '<b>' + title + '</b>' : ''}${body ? String(body) : ''}</div>`;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, type === 'error' ? 4200 : 2600);
  };
  App.modal = function ({ title, icon, body, actions, wide }) {
    this.closeModal();
    const root = $('#modalRoot'); root.classList.add('open');
    const backdrop = U.el('div', 'modal-backdrop');
    const modal = U.el('div', 'modal' + (wide ? ' wide' : ''));
    modal.innerHTML = `<div class="modal-head"><div class="mh-icon"><svg><use href="#${icon || 'i-settings'}"/></svg></div><h3>${title}</h3><button class="modal-x"><svg><use href="#i-close"/></svg></button></div><div class="modal-body">${body}</div>`;
    const foot = U.el('div', 'modal-foot');
    for (const a of (actions || [{ label: '关闭' }])) {
      const btn = U.el('button', a.primary ? 'btn-primary' : 'btn-soft', a.label);
      btn.onclick = () => { if (a.onClick) { const res = a.onClick(); if (res === false) return; } this.closeModal(); };
      foot.appendChild(btn);
    }
    modal.appendChild(foot);
    backdrop.appendChild(modal); root.appendChild(backdrop);
    modal.querySelector('.modal-x').onclick = () => this.closeModal();
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) this.closeModal(); });
    this._modal = { root, backdrop, modal };
    return modal;
  };
  App.closeModal = function () {
    const root = $('#modalRoot'); if (!root) return;
    root.innerHTML = ''; root.classList.remove('open'); this._modal = null;
  };
  App.showShortcuts = function () {
    const rows = [
      ['播放 / 暂停', '空格'], ['上一帧 / 下一帧', '← / →'], ['跳到开头 / 结尾', 'Home / End'],
      ['上一个 / 下一个关键帧', 'J / K'], ['缓入缓出', 'F9'], ['全选图层', 'Ctrl+A'],
      ['选中所选层全部关键帧', 'Ctrl+Alt+A'], ['复制 / 粘贴', 'Ctrl+C / Ctrl+V'], ['复制图层', 'Ctrl+D'],
      ['预合成所选', 'Ctrl+Shift+C'], ['撤销 / 重做', 'Ctrl+Z / Ctrl+Shift+Z'], ['保存工程', 'Ctrl+S'],
      ['打开工程', 'Ctrl+O'], ['新建合成', 'Ctrl+N'], ['导出', 'Ctrl+E'], ['适配窗口', 'Ctrl+0'],
      ['100% 视图', 'Ctrl+1'], ['删除', 'Delete'], ['取消选择', 'Esc'],
      ['工具', 'V / H / Z / G / T / M / Y / P'], ['工作区', '1 / 2 / 3 / 4'], ['显示 / 隐藏面板', 'Tab']
    ];
    const html = `<div class="shortcut-grid">` + rows.map(r => `<div class="shortcut-row"><span>${r[0]}</span><kbd>${r[1]}</kbd></div>`).join('') + `</div>
      <div class="form-note">在文字或表达式输入框中，编辑器快捷键不会抢占浏览器输入。时间轴中按住 Alt 拖动关键帧可按比例拉伸时间；Ctrl 滚动可缩放时间轴。</div>`;
    this.modal({ title: '快捷键与帮助', icon: 'i-help', body: html, wide: true, actions: [{ label: '知道了', primary: true }] });
  };
  App.showAbout = function () {
    this.modal({
      title: '关于 PRISM', icon: 'i-cube', wide: false,
      body: `<div class="about-hero"><div class="about-mark">◇</div><div class="about-title"><b>PRISM</b><span>棱镜 · 动效设计编辑器</span></div></div>
        <div class="about-desc">浏览器内的动效设计工作台。矢量图形、程序节点、三维挤出、PBR 材质、灯光阴影、网格变形、空间场与粒子在这里共用同一套数据和时间轴。<br>示例《星核 · NOVA CORE》完全由编辑器中的数据与节点生成。</div>
        <div class="about-meta"><span>WEBGL 2</span><span>15.0 SEC</span><span>1920×1080</span><span>60 FPS</span><span>SINGLE FILE READY</span></div>`,
      actions: [{ label: '关闭', primary: true }]
    });
  };
  App.hideMenu = function () { const root = $('#menuRoot'); if (root) root.innerHTML = ''; };
  App.showMenu = function (x, y, items) {
    this.hideMenu();
    const root = $('#menuRoot');
    if (x == null) { x = window.innerWidth / 2; y = window.innerHeight / 2; }
    const menu = U.el('div', 'menu-pop');
    for (const it of items) {
      if (it === '-' || it.sep) { menu.appendChild(U.el('div', 'menu-sep')); continue; }
      if (it.label && it.header) { menu.appendChild(U.el('div', 'menu-label', it.label)); continue; }
      const item = U.el('div', 'menu-item' + (it.disabled ? ' disabled' : ''));
      item.innerHTML = `<div class="mi-ic">${it.icon ? `<svg><use href="#${it.icon}"/></svg>` : ''}</div><span>${it.label}</span>${it.key ? `<span class="mi-key">${it.key}</span>` : ''}`;
      if (!it.disabled && it.action) item.onclick = (ev) => { ev.stopPropagation(); this.hideMenu(); it.action(); };
      menu.appendChild(item);
    }
    root.appendChild(menu);
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
    return menu;
  };
  App.showMenuBar = function (name, btn) {
    const r = btn.getBoundingClientRect();
    const items = this.menuItems(name);
    this.showMenu(r.left, r.bottom + 4, items);
  };
  App.menuItems = function (name) {
    const hasSel = this.selectedLayers().length > 0;
    const sel = this.selectedLayer();
    const dis = !hasSel;
    switch (name) {
      case 'file': return [
        { label: '新建空工程', icon: 'i-file', key: 'Ctrl+N', action: () => this.newProject() },
        { label: '新建合成', icon: 'i-plus', action: () => this.newCompDialog() },
        '-',
        { label: '打开工程…', icon: 'i-folder', key: 'Ctrl+O', action: () => this.openProject() },
        { label: '保存工程', icon: 'i-export', key: 'Ctrl+S', action: () => this.saveProject() },
        { label: '恢复自动保存', icon: 'i-undo', action: () => this.loadAutosave() },
        '-',
        { label: '打开内置示例', icon: 'i-play', action: () => this.loadDemo() },
        { label: '导出成片 / 图像序列…', icon: 'i-export', key: 'Ctrl+E', action: () => this.exportDialog() },
        '-',
        { label: '快捷键一览', icon: 'i-help', action: () => this.showShortcuts() },
        { label: '关于 PRISM', icon: 'i-cube', action: () => this.showAbout() }
      ];
      case 'edit': return [
        { label: '撤销', icon: 'i-undo', key: 'Ctrl+Z', disabled: !this.undoStack.length, action: () => this.undo() },
        { label: '重做', icon: 'i-redo', key: 'Ctrl+Shift+Z', disabled: !this.redoStack.length, action: () => this.redo() },
        '-',
        { label: '复制', icon: 'i-file', key: 'Ctrl+C', action: () => this.copy() },
        { label: '粘贴', icon: 'i-file', key: 'Ctrl+V', action: () => this.paste() },
        { label: '复制图层', icon: 'i-layer', key: 'Ctrl+D', disabled: dis, action: () => this.duplicateSelected() },
        { label: '删除', icon: 'i-trash', key: 'Delete', disabled: dis, action: () => this.deleteSelected() },
        '-',
        { label: '全选图层', icon: 'i-check', key: 'Ctrl+A', action: () => this.selectAllLayers() },
        { label: '选中所选层全部关键帧', icon: 'i-diamond', key: 'Ctrl+Alt+A', disabled: dis, action: () => this.selectAllKeys() },
        '-',
        { label: '预合成所选图层', icon: 'i-precomp', key: 'Ctrl+Shift+C', disabled: dis, action: () => this.precomposeSelected() }
      ];
      case 'comp': return [
        { label: '新建合成…', icon: 'i-plus', action: () => this.newCompDialog() },
        { label: '合成设置…', icon: 'i-settings', disabled: !this.comp, action: () => this.compSettingsDialog() },
        '-',
        { label: '添加标记', icon: 'i-plus', action: () => this.addMarker() },
        { label: '工作区设为全片', action: () => this.edit('设置工作区', () => { this.comp.workStart = 0; this.comp.workEnd = this.comp.duration; }) },
        { label: '工作区设为当前选择图层', disabled: dis, action: () => this.edit('设置工作区', () => { const ls = this.selectedLayers(); this.comp.workStart = Math.min(...ls.map(l => l.inPoint)); this.comp.workEnd = Math.max(...ls.map(l => l.outPoint)); }) },
        '-',
        { label: '运动模糊总开关', icon: 'i-loop', action: () => { this.comp.motionBlur.enabled = !this.comp.motionBlur.enabled; this.markDirty(); } },
        { label: '合成设置中的三维 / 相机…', disabled: true }
      ];
      case 'layer': return [
        { label: '新建形状图层', icon: 'i-shape', action: () => this.addLayer('shape', { shapeType: 'rect', name: '形状 1' }) },
        { label: '新建文字图层', icon: 'i-text', action: () => this.addLayer('text', { text: '新文字', fontSize: 100, font: T.CN_FONT }) },
        { label: '新建空对象', icon: 'i-null', action: () => this.addLayer('null') },
        { label: '新建三维几何', icon: 'i-cube', action: () => this.addLayer('geo', { kind: 'box' }) },
        { label: '新建粒子系统', icon: 'i-particles', action: () => this.addLayer('particle') },
        { label: '新建空间场', icon: 'i-field', action: () => this.addLayer('field') },
        '-',
        { label: '新建调整图层', icon: 'i-adjust', action: () => this.addLayer('adjustment') },
        { label: '新建摄像机', icon: 'i-camera', action: () => this.addLayer('camera') },
        { label: '新建灯光', icon: 'i-light', action: () => this.addLayer('light') },
        { label: '新建音色图层', icon: 'i-audio', action: () => this.addLayer('tone', { instrument: 'pad' }) },
        { label: '导入音频…', icon: 'i-audio', action: () => this.importAudio() },
        '-',
        { label: '复制图层', icon: 'i-layer', key: 'Ctrl+D', disabled: dis, action: () => this.duplicateSelected() },
        { label: '设置父级…', icon: 'i-layer', disabled: dis || !sel, action: () => this.parentMenu() },
        { label: '删除图层', icon: 'i-trash', disabled: dis, action: () => this.deleteSelected() },
        '-',
        { label: '预合成所选', icon: 'i-precomp', disabled: dis, action: () => this.precomposeSelected() },
        { label: '进入预合成', icon: 'i-precomp', disabled: !sel || sel.type !== 'precomp', action: () => this.enterPrecomp(sel) }
      ];
      case 'effect': return [
        { label: '高斯模糊', icon: 'i-adjust', disabled: dis, action: () => this.addEffect('blur') },
        { label: '发光', icon: 'i-sun', disabled: dis, action: () => this.addEffect('glow') },
        { label: '投影', icon: 'i-layer', disabled: dis, action: () => this.addEffect('shadow') },
        { label: '色相 / 饱和度 / 亮度', icon: 'i-adjust', disabled: dis, action: () => this.addEffect('hueSat') },
        '-',
        { label: '回声', icon: 'i-loop', disabled: dis, action: () => this.addEffect('echo') },
        { label: '逐像素时间置换', icon: 'i-field', disabled: dis, action: () => this.addEffect('timeDisplace') },
        { label: '暗角', icon: 'i-ellipse', disabled: dis, action: () => this.addEffect('vignette') },
        { label: '颗粒', icon: 'i-grid', disabled: dis, action: () => this.addEffect('grain') },
        { label: '色散', icon: 'i-flip', disabled: dis, action: () => this.addEffect('chroma') }
      ];
      case 'view': return [
        { label: '合成', icon: 'i-camera', key: '1', action: () => this.setWorkspace('stage') },
        { label: '曲线编辑器', icon: 'i-curve', key: '2', action: () => this.setWorkspace('curves') },
        { label: '节点编辑器', icon: 'i-nodes', key: '3', action: () => this.setWorkspace('nodes') },
        { label: '三维辅助视图', icon: 'i-cube', key: '4', action: () => this.setWorkspace('scene') },
        '-',
        { label: '适配窗口', icon: 'i-crop', key: 'Ctrl+0', action: () => this.fitView() },
        { label: '100% 视图', icon: 'i-zoom', key: 'Ctrl+1', action: () => this.zoomReset() },
        { label: '运动模糊 ' + (this.motionBlur ? '开' : '关'), action: () => { $('#mbBtn').click(); } },
        { label: '景深 ' + (this.dof ? '开' : '关'), action: () => { $('#dofBtn').click(); } },
        { label: '预览分辨率：' + (this.quality === 1 ? '完整' : this.quality === .75 ? '3/4' : '半分辨率'), action: () => { $('#resBtn').click(); } },
        { label: '显示参考辅助线 ' + (this.showGuides ? '开' : '关'), action: () => { this.showGuides = !this.showGuides; this.requestRender(); if (AE.CanvasView) AE.CanvasView.draw(); } }
      ];
      case 'help': return [
        { label: '快捷键一览', icon: 'i-help', action: () => this.showShortcuts() },
        { label: '关于 PRISM', icon: 'i-cube', action: () => this.showAbout() },
        { label: '示例工程说明', icon: 'i-file', action: () => this.demoInfo() }
      ];
      default: return [];
    }
  };
  App.demoInfo = function () {
    this.modal({
      title: '示例工程 · 星核 NOVA CORE', icon: 'i-play', wide: true,
      body: `<div class="about-desc">主合成 15 秒，工作区覆盖全段。所有画面由工程内的图层、节点、关键帧、表达式与模拟生成，没有任何外部图片或视频素材。<br><br>
        <b style="color:#9ed4c9">段落</b>：开场（0–2.4s）· 展开（2.4–5.4s）· 能量（5.4–8.8s）· 汇聚（8.8–11.6s）· 收束（11.6–15s）<br><br>
        <b style="color:#9ed4c9">可定位技术点</b>：光环组（保留三维预合成）→ 光珠环实例与空间场；NOVA / 星核（字形轮廓挤出与倒角）；金尘粒子（表面发射、碰撞、事件与拖尾）；节点图「星环刻度」（路径 → 分布 → 噪声）；标题排版（独立画面预合成双实例 + 时间重映射）；光谱带（逐像素时间置换 + 回声）；总调色（调整层）。</div>`,
      actions: [{ label: '开始探索', primary: true }]
    });
  };
  App.addEffect = function (type) {
    const sel = this.selectedLayers(); if (!sel.length) return;
    this.edit('添加效果', () => { for (const l of sel) P.addEffect(l, type); });
    this.toast('效果已添加', P.EFFECT_DEFS[type] ? P.EFFECT_DEFS[type].label : type, 'ok');
  };
  App.parentMenu = function (at) {
    const sel = this.selectedLayer(); if (!sel) return;
    const items = [{ label: '解除父级', icon: 'i-null', action: () => this.edit('解除父级', () => { sel.parent = null; }) }];
    for (const l of this.comp.layers) {
      if (l.id === sel.id) continue;
      if (P.isAncestor(this.comp, sel.id, l)) continue;
      items.push({ label: l.name, icon: P.TYPE_INFO[l.type] ? P.TYPE_INFO[l.type].icon : 'i-layer', action: () => this.setParent(sel, l.id) });
    }
    const el = at ? at.getBoundingClientRect() : null;
    this.showMenu(el ? el.left : 300, el ? el.bottom + 4 : 300, items);
  };
  App.propsMenu = function (e) {
    const sel = this.selectedLayer();
    this.showMenu(e.clientX, e.clientY, [
      { label: '折叠全部属性组', action: () => { if (AE.Props) AE.Props.collapseAll(); } },
      { label: '展开全部属性组', action: () => { if (AE.Props) AE.Props.expandAll(); } },
      { label: '显示动画属性', action: () => { if (AE.Props) AE.Props.onlyAnimatedToggle(); } },
      '-',
      { label: '图层设置…', disabled: !sel, action: () => this.layerSettingsDialog() },
      { label: '复制图层', disabled: !sel, action: () => this.duplicateSelected() }
    ]);
  };
  App.timelineMenu = function (e) {
    this.showMenu(e.clientX, e.clientY, [
      { label: this.onlyAnimated ? '显示全部属性' : '只显示动画属性', action: () => $('#onlyAnimatedBtn').click() },
      { label: '折叠全部图层', action: () => { if (AE.Timeline) AE.Timeline.collapseAll(); } },
      { label: '吸附 ' + (this.snap ? '开' : '关'), action: () => this.snap = !this.snap },
      '-',
      { label: '跳到工作区开头', action: () => this.setTime(this.comp.workStart) },
      { label: '跳到工作区结尾', action: () => this.setTime(this.comp.workEnd) }
    ]);
  };
  App.projectMenu = function (e) {
    this.showMenu(e.clientX, e.clientY, [
      { label: '新建合成', action: () => this.newCompDialog() },
      { label: '导入音频', action: () => this.importAudio() },
      { label: '保存工程', action: () => this.saveProject() },
      { label: '打开工程', action: () => this.openProject() },
      '-',
      { label: '载入示例工程', action: () => this.loadDemo() }
    ]);
  };
  App.viewModeMenu = function (el) {
    const r = el.getBoundingClientRect();
    this.showMenu(r.left, r.bottom + 4, [
      { label: '主动相机', action: () => { this.viewOverride = null; this.requestRender(); } },
      { label: '前视图', action: () => { this.viewOverride = { type: 'front' }; this.requestRender(); } },
      { label: '顶视图', action: () => { this.viewOverride = { type: 'top' }; this.requestRender(); } },
      { label: '侧视图', action: () => { this.viewOverride = { type: 'side' }; this.requestRender(); } },
      { label: '透视辅助', action: () => { this.viewOverride = { type: 'persp' }; this.requestRender(); } }
    ]);
  };

  // ---------------- new comp / settings / layer settings ----------------
  App.newCompDialog = function () {
    const c = this.comp;
    this.modal({
      title: '新建合成', icon: 'i-plus',
      body: `<div class="form-grid">
        <label>名称</label><input class="num-input" id="ncName" value="合成 ${(this.project.comps.length + 1)}" style="text-align:left">
        <label>尺寸</label><div class="form-row"><input class="num-input" id="ncW" value="${c ? c.width : 1920}"><span style="color:#556">×</span><input class="num-input" id="ncH" value="${c ? c.height : 1080}"></div>
        <label>帧率</label><select class="mini-select" id="ncFps"><option>60</option><option>30</option><option>24</option></select>
        <label>时长（秒）</label><input class="num-input" id="ncDur" value="10">
        <label>背景</label><input type="color" id="ncBg" value="#05070c" style="width:40px;height:24px;border:none;background:none">
      </div>`,
      actions: [{ label: '取消' }, {
        label: '创建合成', primary: true, onClick: () => {
          const comp = P.newComp({
            name: $('#ncName').value.trim() || '新合成', width: +$('#ncW').value || 1920, height: +$('#ncH').value || 1080,
            fps: +$('#ncFps').value || 60, duration: Math.max(.1, +$('#ncDur').value || 10), bg: P.hex($('#ncBg').value)
          });
          comp.workEnd = comp.duration;
          this.project.comps.push(comp);
          this.markDirty();
          if (AE.ProjectPanel) AE.ProjectPanel.render();
          this.setComp(comp);
          this.toast('合成已创建', `${comp.name} · ${comp.width}×${comp.height}`, 'ok');
        }
      }]
    });
  };
  App.compSettingsDialog = function () {
    if (!this.comp) return;
    const c = this.comp;
    this.modal({
      title: '合成设置', icon: 'i-settings',
      body: `<div class="form-grid">
        <label>名称</label><input class="num-input" id="csName" value="${c.name.replace(/"/g, '&quot;')}" style="text-align:left">
        <label>尺寸</label><div class="form-row"><input class="num-input" id="csW" value="${c.width}"><span style="color:#556">×</span><input class="num-input" id="csH" value="${c.height}"></div>
        <label>帧率</label><input class="num-input" id="csFps" value="${c.fps}">
        <label>时长（秒）</label><input class="num-input" id="csDur" value="${c.duration}">
        <label>工作区起点</label><input class="num-input" id="csWs" value="${c.workStart}">
        <label>工作区终点</label><input class="num-input" id="csWe" value="${c.workEnd}">
        <label>背景</label><input type="color" id="csBg" value="${U.rgbToHex(c.bg || [0, 0, 0])}" style="width:40px;height:24px;border:none;background:none">
        <label>运动模糊</label><div class="form-row"><label class="tog ${c.motionBlur.enabled ? 'on' : ''}" id="csMb" style="width:26px;height:14px"></label><span style="font-size:9px;color:#66758a">采样 ${c.motionBlur.samples || 2} · 快门 ${c.motionBlur.shutterAngle || 180}°</span></div>
      </div>`,
      actions: [{ label: '取消' }, {
        label: '保存', primary: true, onClick: () => {
          this.edit('合成设置', () => {
            c.name = $('#csName').value.trim() || c.name;
            c.width = Math.max(16, +$('#csW').value || c.width);
            c.height = Math.max(16, +$('#csH').value || c.height);
            c.fps = Math.max(1, +$('#csFps').value || c.fps);
            c.duration = Math.max(.1, +$('#csDur').value || c.duration);
            c.workStart = U.clamp(+$('#csWs').value || 0, 0, c.duration);
            c.workEnd = U.clamp(+$('#csWe').value || c.duration, 0, c.duration);
            c.bg = P.hex($('#csBg').value);
            this.time = Math.min(this.time, c.duration);
          });
          if (AE.ProjectPanel) AE.ProjectPanel.render();
        }
      }]
    });
  };
  App.layerSettingsDialog = function () {
    const l = this.selectedLayer(); if (!l) return;
    this.modal({
      title: '图层设置', icon: 'i-layer',
      body: `<div class="form-grid">
        <label>名称</label><input class="num-input" id="lsName" value="${l.name.replace(/"/g, '&quot;')}" style="text-align:left">
        <label>类型</label><div class="num-input" style="text-align:left;color:#647">${P.TYPE_INFO[l.type] ? P.TYPE_INFO[l.type].label : l.type}</div>
        <label>入点</label><input class="num-input" id="lsIn" value="${l.inPoint}">
        <label>出点</label><input class="num-input" id="lsOut" value="${l.outPoint}">
        <label>混合模式</label><select class="mini-select" id="lsBlend">${P.BLEND_MODES.map((m, i) => `<option value="${Object.keys(P.BLEND_KEYS)[i]}" ${l.blendMode === Object.keys(P.BLEND_KEYS)[i] ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <label>三维图层</label><div class="form-row"><label class="tog ${l.threeD ? 'on' : ''}" id="ls3d"></label></div>
      </div>`,
      actions: [{ label: '取消' }, {
        label: '保存', primary: true, onClick: () => {
          this.edit('图层设置', () => {
            l.name = $('#lsName').value.trim() || l.name;
            l.inPoint = U.clamp(+$('#lsIn').value || 0, 0, this.comp.duration);
            l.outPoint = U.clamp(+$('#lsOut').value || this.comp.duration, l.inPoint, this.comp.duration);
            const bv = $('#lsBlend').value; l.blendMode = bv;
            l.threeD = $('#ls3d').classList.contains('on');
          });
        }
      }]
    });
    setTimeout(() => {
      const t = $('#ls3d'); if (t) t.onclick = () => t.classList.toggle('on');
    }, 0);
  };

  // ---------------- audio import ----------------
  App.importAudio = function () {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'audio/*';
    inp.onchange = async () => {
      if (!inp.files[0]) return;
      try {
        const id = await AE.Audio.engine.importAudio(inp.files[0], this.project);
        const asset = this.project.assets.find(a => a.id === id);
        this.edit('导入音频', () => {
          const l = P.createLayer(this.project, this.comp, 'audio', { name: asset.name, assetId: id });
          l.inPoint = 0; l.outPoint = Math.min(this.comp.duration, asset.duration || this.comp.duration);
          this.comp.layers.push(l);
          this.selection = [l.id];
        });
        if (AE.ProjectPanel) AE.ProjectPanel.render();
        this.toast('音频已导入', asset.name + ' · ' + (asset.duration || 0).toFixed(1) + 's', 'ok');
      } catch (e) { this.toast('导入音频失败', e.message, 'error'); }
    };
    inp.click();
  };

  // ---------------- export (video / image sequence) ----------------
  App.exportDialog = function () {
    if (!this.comp) { this.toast('请先打开合成', '', 'warn'); return; }
    const c = this.comp;
    const defFps = c.fps >= 60 ? 60 : c.fps;
    this.modal({
      title: '导出成片', icon: 'i-export', wide: true,
      body: `<div class="export-tabs" id="exTabs"><button class="active" data-mode="video">视频（带音轨）</button><button data-mode="frames">图像序列</button></div>
        <div class="form-grid">
          <label>范围</label><div class="seg" id="exRange"><button class="active" data-range="work">工作区</button><button data-range="all">整个合成</button></div>
          <label>帧率</label><select class="mini-select" id="exFps"><option value="${c.fps}">${c.fps} fps（合成）</option><option value="30">30 fps</option><option value="60">60 fps</option><option value="24">24 fps</option></select>
          <label>分辨率</label><select class="mini-select" id="exScale"><option value="100">100% · ${c.width}×${c.height}</option><option value="50">50% · ${Math.round(c.width / 2)}×${Math.round(c.height / 2)}</option><option value="75">75% · ${Math.round(c.width * .75)}×${Math.round(c.height * .75)}</option></select>
          <label>开始</label><input class="num-input" id="exStart" value="${c.workStart}">
          <label>结束</label><input class="num-input" id="exEnd" value="${c.workEnd}">
        </div>
        <div class="form-note">视频使用浏览器 WebM 编码（VP9/VP8）并包含由音色图层实时合成的音轨；图像序列会打包为 ZIP，尺寸与合成一致。逐帧取样由工程时间决定，不受窗口缩放影响。</div>
        <div class="export-summary" style="margin-top:12px"><div class="es-item"><div class="es-k">总帧数</div><div class="es-v" id="exFrames">—</div></div><div class="es-item"><div class="es-k">时长</div><div class="es-v" id="exDur">—</div></div><div class="es-item"><div class="es-k">输出尺寸</div><div class="es-v" id="exSize">—</div></div></div>`,
      actions: [{ label: '取消' }, { label: '开始导出', primary: true, onClick: () => {
        const mode = $('#exTabs .active').dataset.mode;
        const fps = +$('#exFps').value;
        const scale = +$('#exScale').value / 100;
        const start = Math.max(0, Math.min(c.duration, +$('#exStart').value || 0));
        const end = Math.max(start + .05, Math.min(c.duration, +$('#exEnd').value || c.duration));
        this.startExport(mode, { fps, scale, start, end });
      } }]
    });
    const update = () => {
      const fps = +$('#exFps').value, scale = +$('#exScale').value / 100;
      const s = +$('#exStart').value || 0, e = +$('#exEnd').value || c.duration;
      const frames = Math.max(1, Math.round((Math.max(.05, e - s)) * fps));
      $('#exFrames').textContent = frames; $('#exDur').textContent = (Math.max(0, e - s)).toFixed(2) + ' s';
      $('#exSize').textContent = Math.round(c.width * scale) + '×' + Math.round(c.height * scale);
    };
    setTimeout(() => {
      const tabs = $('#exTabs');
      if (!tabs) return;
      tabs.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; tabs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); };
      $('#exRange').onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        $('#exRange').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        if (b.dataset.range === 'all') { $('#exStart').value = 0; $('#exEnd').value = c.duration; }
        else { $('#exStart').value = c.workStart; $('#exEnd').value = c.workEnd; }
        update();
      };
      ['exFps', 'exScale', 'exStart', 'exEnd'].forEach(id => $('#' + id).oninput = update);
      update();
    }, 0);
  };
  App.showExportProgress = function (title) {
    const modal = this.modal({
      title, icon: 'i-export', wide: false,
      body: `<div class="progress-track"><div class="progress-fill" id="exProgFill"></div></div>
        <div class="progress-meta"><span id="exProgLabel">准备中…</span><span id="exProgPct">0%</span></div>
        <div class="export-log" id="exLog"></div>`,
      actions: [{ label: '取消导出', onClick: () => { this._exportCancelled = true; this.closeModal(); return false; } }]
    });
    this._exportCancelled = false;
    return modal;
  };
  App.updateExportProgress = function (pct, label, log) {
    const p = $('#exProgFill'); if (p) p.style.width = U.clamp(pct * 100, 0, 100) + '%';
    const l = $('#exProgLabel'); if (l) l.textContent = label;
    const q = $('#exProgPct'); if (q) q.textContent = Math.round(pct * 100) + '%';
    if (log) { const lg = $('#exLog'); if (lg) { lg.innerHTML += log + '<br>'; lg.scrollTop = lg.scrollHeight; } }
  };
  App.startExport = async function (mode, opts) {
    this.closeModal();
    this.playing = false; AE.Audio.engine.stopAll();
    this._exportCancelled = false;
    this.exporting = true;
    this.showExportProgress(mode === 'video' ? '导出视频' : '导出图像序列');
    const c = this.comp;
    const width = Math.round(c.width * opts.scale), height = Math.round(c.height * opts.scale);
    if (mode === 'frames') {
      try {
        await this.exportFrames(opts, width, height);
      } catch (e) { this.exporting = false; this.updateExportProgress(1, '导出失败：' + e.message); this.toast('导出失败', e.message, 'error'); return; }
      this.exporting = false;
      return;
    }
    try {
      await this.exportVideo(opts, width, height);
    } catch (e) { console.error(e); this.toast('视频导出失败', e.message, 'error'); this.updateExportProgress(1, '导出失败', e.message); }
    this.exporting = false;
  };
  App.grabCompFrame = function (comp, time, scale) {
    this.renderer.project = this.project;
    const target = this.renderer.renderComp(comp, time, { scale, bg: true, _top: true, samples: comp.motionBlur && comp.motionBlur.enabled ? Math.max(1, comp.motionBlur.samples || 2) : 1 });
    if (!target) return null;
    const gl = this.renderer.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    const w = target.w, h = target.h;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    this.renderer.release(target);
    if (this.renderer._matteTargets && this.renderer._matteTargets.length) {
      for (const mt of this.renderer._matteTargets) this.renderer.release(mt);
      this.renderer._matteTargets = [];
    }
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4, dst = y * w * 4;
      img.data.set(px.subarray(src, src + w * 4), dst);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  };
  App.exportFrames = async function (opts, width, height) {
    const total = Math.max(1, Math.round((opts.end - opts.start) * opts.fps));
    const files = [];
    const startTime = performance.now();
    for (let i = 0; i < total; i++) {
      if (this._exportCancelled) { this.toast('导出已取消', '', 'warn'); return; }
      const t = opts.start + i / opts.fps;
      const canvas = this.grabCompFrame(this.comp, t, opts.scale);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      files.push({ name: `frame_${String(i).padStart(5, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      this.updateExportProgress((i + 1) / total, `已渲染 ${i + 1} / ${total} 帧`, i % 10 === 0 ? `render ${String(i).padStart(4, '0')} @ ${t.toFixed(2)}s` : null);
      if (i % 3 === 0) await U.nextFrame();
    }
    this.updateExportProgress(.99, '正在打包 ZIP…');
    const zip = buildZip(files);
    U.download(new Blob([zip], { type: 'application/zip' }), (this.project.name || 'prism') + '_frames.zip');
    this.updateExportProgress(1, `完成：${files.length} 帧 · ${(zip.length / 1048576).toFixed(1)} MB`, 'ZIP 已生成');
    this.toast('图像序列导出完成', `${files.length} 帧 · ${width}×${height}`, 'ok');
  };
  App.exportVideo = async function (opts, width, height) {
    if (!window.MediaRecorder) { this.toast('浏览器不支持视频录制，将导出图像序列', '', 'warn'); return this.exportFrames(opts, width, height); }
    const c = this.comp;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(opts.fps);
    const videoTrack = stream.getVideoTracks()[0];
    AE.Audio.engine.init();
    let audioStream = null;
    try { audioStream = AE.Audio.engine.connectExport(); } catch (e) { }
    if (opts.includeAudio !== false && audioStream) { for (const t of audioStream.getAudioTracks()) stream.addTrack(t); }
    let mime = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.min(24000000, width * height * 6) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = res; });
    this.updateExportProgress(0, '准备视频编码…');
    // audio from project time start
    AE.Audio.engine.schedule(this.project, c, opts.start);
    rec.start(200);
    const realStart = performance.now();
    const duration = opts.end - opts.start;
    let frameCount = 0;
    const drawLoop = async () => {
      while (true) {
        if (this._exportCancelled) break;
        const elapsed = (performance.now() - realStart) / 1000;
        if (elapsed > duration + .05) break;
        const t = opts.start + Math.min(duration, elapsed);
        const frame = this.grabCompFrame(c, t, opts.scale);
        if (frame) { ctx.drawImage(frame, 0, 0, width, height); if (videoTrack && videoTrack.requestFrame) { try { videoTrack.requestFrame(); } catch (e) { } } }
        frameCount++;
        this.updateExportProgress(Math.min(1, elapsed / duration), `录制中 ${elapsed.toFixed(2)} / ${duration.toFixed(2)} s`, frameCount % 30 === 0 ? `frame ${frameCount} @ ${t.toFixed(2)}s` : null);
        await U.nextFrame();
      }
    };
    await drawLoop();
    await new Promise(res => setTimeout(res, 220));
    AE.Audio.engine.stopAll();
    try { rec.stop(); } catch (e) { }
    await done;
    AE.Audio.engine.disconnectExport();
    if (this._exportCancelled) { this.toast('视频导出已取消', '', 'warn'); return; }
    if (!chunks.length) throw new Error('编码器没有返回视频数据');
    const blob = new Blob(chunks, { type: 'video/webm' });
    U.download(blob, (this.project.name || 'prism').replace(/[\\/:*?"<>|]/g, '_') + '_export.webm');
    this.updateExportProgress(1, `完成 · ${blob.size > 1048576 ? (blob.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(blob.size / 1024)) + ' KB'}`, `WebM · ${width}×${height} · ${opts.fps}fps · ${audioStream && opts.includeAudio !== false ? '含音轨' : '无音轨'}`);
    this.toast('视频导出完成', 'WebM 已下载，包含音轨', 'ok');
  };

  // ---------- ZIP store writer ----------
  function crc32(buf) {
    let c, crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) { c = (crc ^ buf[i]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function buildZip(files) {
    const enc = new TextEncoder();
    let offset = 0; const chunks = [], central = [];
    for (const f of files) {
      const name = enc.encode(f.name); const data = f.data; const crc = crc32(data);
      const local = new Uint8Array(30 + name.length + data.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true); dv.setUint16(12, 0, true); dv.setUint32(14, crc, true); dv.setUint32(18, data.length, true); dv.setUint32(22, data.length, true); dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
      local.set(name, 30); local.set(data, 30 + name.length);
      chunks.push(local);
      const cen = new Uint8Array(46 + name.length); const cv = new DataView(cen.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
      cen.set(name, 46); central.push(cen);
      offset += local.length;
    }
    const cdStart = offset; let cdSize = 0;
    for (const c of central) { chunks.push(c); cdSize += c.length; offset += c.length; }
    const end = new Uint8Array(22); const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, cdStart, true);
    chunks.push(end);
    const total = chunks.reduce((a, b) => a + b.length, 0); const out = new Uint8Array(total); let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  // ---------------- videoExport contract ----------------
  App.initVideoExport = function () {
    const self = this;
    window.videoExport = {
      runs: ['demo'],
      async begin(runId, options = {}) {
        if (runId !== 'demo') throw new Error('未知的 runId: ' + runId);
        const fps = Math.max(1, Math.min(120, Math.round(options.fps || 60)));
        self.closeModal(); self.hideMenu();
        self.pause();
        // ensure demo project active
        if (!self.project || !self.project.isDemo) self.loadDemo(false);
        const main = self.project.comps.find(c => c.id === self.project._demoMain) || self.project.comps[0];
        self.compStack = [];
        self.setComp(main, { time: 0 });
        const star = main.layers.find(l => l.name === '星核 · 挤出字') || main.layers.find(l => l.type === 'geo');
        if (star) self.selectLayers([star.id]);
        if (star && AE.Timeline) { AE.Timeline.expanded.clear(); AE.Timeline.expanded.add(star.id); AE.Timeline.render(); }
        self.exportMode = true;
        self.playbackBeforeExport = false;
        self._exportFps = fps;
        self.renderer.motionBlurEnabled = true;
        self.renderer.dofEnabled = true;
        self.time = 0;
        // reset simulations for deterministic sampling
        for (const c of self.project.comps) for (const l of c.layers) { if (l._sim) l._sim = null; }
        if (AE.Build) AE.Build.clearCache();
        const frames = Math.round(15 * fps);
        self._exportPrewarm = true;
        await self.applyExportFrame(0, fps);
        return { frames };
      },
      async frame(i) {
        if (!self.exportMode) throw new Error('请先调用 begin()');
        await self.applyExportFrame(i, self._exportFps);
      },
      end() {
        self.exportMode = false;
        self.exporting = false;
        self.renderer.motionBlurEnabled = self.motionBlur;
        self.renderer.dofEnabled = self.dof;
        self.requestRender();
        // synchronize UI chrome
        if (AE.Timeline) AE.Timeline.updatePlayhead();
        if (AE.Props) AE.Props.updateLiveValues();
        self.updateStatus();
      }
    };
  };
  App.applyExportFrame = async function (i, fps) {
    const t = i / fps;
    this.time = Math.min(this.comp.duration, t);
    this.renderer.motionBlurEnabled = true;
    this.renderer.dofEnabled = true;
    this.renderer.project = this.project;
    this.renderer.render(this.comp, this.time, { quality: 1, view: this.view, viewOverride: null });
    if (AE.Timeline) AE.Timeline.updatePlayhead();
    if (AE.Props) AE.Props.updateLiveValues();
    if (AE.CanvasView) AE.CanvasView.draw();
    this.updateStatus();
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  };

  // ---------------- init after DOM ----------------
  App.boot = function () {
    const run = () => {
      this.initVideoExport();
      this.init();
      this.renderer && this.renderer.resize();
      if (AE.ProjectPanel) AE.ProjectPanel.init();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  };
  AE.App = App;
  window.PRISM = App;
  App.boot();
})();
