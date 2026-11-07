// 主控制器：工程状态、播放、编辑、撤销、导出
import { Project, Comp, Layer, Material, Effect, Mask, uid, makeExprEval, solveWorldMatrices } from './core/model.js';
import { AnimProperty, Key } from './core/anim.js';
import { evalPropExpression } from './core/expression.js';
import { clamp, hexToRgb, rgbToHex, lerp, deg2rad, rad2deg } from './core/math.js';
import { evaluateComp } from './core/compositor.js';
import { RenderEngine } from './render/engine.js';
import { AppUI } from './ui/app.js';
import { GraphEditor } from './ui/graph.js';
import { NodeGraph, NodeEditorUI } from './ui/nodes.js';
import { ToneSynth, tonePattern } from './core/audio.js';
import { buildDemoProject, demoSoundtrack } from './demo/demo.js';

export class App {
  constructor() {
    this.project = null;
    this.currentCompId = null;
    this.time = 0;
    this.playing = false;
    this.loop = true;
    this.selection = [];
    this.selectedKeys = new Set();
    this.selectedProp = null;
    this.selectedPropLayer = null;
    this.expandedLayers = new Set();
    this.timelineScale = 70; // px/s
    this.resolutionScale = 0.5;
    this.tool = 'select';
    this.graphMode = 'value';
    this.inspectorTab = 'layer';
    this.onlyAnimated = false;
    this.snap = true;
    this.bottomPane = 'timeline';
    this.history = [];
    this.future = [];
    this._historyLock = false;
    this._raf = null;
    this._lastTick = 0;
    this.exportMode = false;
    this.audio = new ToneSynth();
    this.nodeGraph = new NodeGraph();
    this._exportCancel = false;
    this._audioSchedule = [];
    this._audioPlayedUntil = -1;
  }

  async init() {
    this.ui = new AppUI(this);
    this.ui.mount(document.getElementById('app'));
    const canvas = document.getElementById('main-canvas');
    this.engine = new RenderEngine(canvas);

    this.graph = new GraphEditor(document.getElementById('graph-canvas'), this);
    this.nodeEditor = new NodeEditorUI(document.getElementById('node-canvas-wrap'), this.nodeGraph, this);

    // 载入示例工程
    this.loadDemo();

    this._bindKeyboard();
    this._bindCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
    this.seek(0);
    this._loop();
    this.buildDefaultNodeGraph();

    // 首次交互解锁音频
    const unlock = () => {
      this.audio.ensure();
      this.audio.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  comp() {
    return this.project.getComp(this.currentCompId) || this.project.getMainComp();
  }

  loadDemo() {
    this.project = buildDemoProject();
    this.currentCompId = this.project.compOrder[0];
    this.expandedLayers = new Set(this.comp().layers.slice(0, 3).map((l) => l.id));
    this.timelineFit();
    this.ui.refresh();
    this.pushHistory('载入示例工程', true);
    this.ui.toast('已载入 15 秒示例工程 · 按空格播放');
  }

  timelineFit() {
    const comp = this.comp();
    const tracks = document.getElementById('tl-tracks');
    const w = tracks ? tracks.clientWidth - 40 : 800;
    this.timelineScale = Math.max(20, w / Math.max(1, comp.duration));
  }

  // ---- 时间与播放 ----
  seek(t) {
    const comp = this.comp();
    this.time = clamp(t, 0, comp.duration);
    this.requestRender();
    this.ui.refreshTime();
    this._updateAudioForTime();
    // 同步时间轴
    const ph = document.querySelector('.tl-playhead');
    if (ph) ph.style.left = (this.time * this.timelineScale) + 'px';
    this.graph?.draw();
    if (this.bottomPane === 'timeline') {
      // 轻量刷新值
      document.querySelectorAll('.tl-prop-row .val').forEach(() => {});
    }
    this.ui.refreshInspector();
    this.ui.refreshTimeline();
  }

  stepFrame(dir) {
    const comp = this.comp();
    const dt = 1 / comp.fps;
    this.seek(Math.round((this.time + dir * dt) * comp.fps) / comp.fps);
  }

  togglePlay() {
    if (this.playing) {
      this.playing = false;
      this.audio.stopAll();
    } else {
      this.playing = true;
      this._lastTick = performance.now();
      this._audioPlayedUntil = this.time - 0.05;
      this.audio.resume();
    }
    this.ui.refreshTime();
    this.ui.root.querySelector('#btn-play')?.classList.toggle('playing', this.playing);
  }

  _loop() {
    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      if (this.playing && !this.exportMode) {
        const dt = Math.min(0.1, (now - this._lastTick) / 1000);
        this._lastTick = now;
        const comp = this.comp();
        let nt = this.time + dt;
        const wa = comp.workArea;
        if (this.loop && nt > wa[1]) {
          nt = wa[0];
          this._audioPlayedUntil = wa[0] - 0.05;
        } else if (nt > comp.duration) {
          nt = comp.duration;
          this.playing = false;
          this.ui.refreshTime();
        }
        this.time = nt;
        this.requestRender();
        this.ui.refreshTime();
        const ph = document.querySelector('.tl-playhead');
        if (ph) ph.style.left = (this.time * this.timelineScale) + 'px';
        this._updateAudioForTime();
      }
    };
    this._raf = requestAnimationFrame(tick);
  }

  _updateAudioForTime() {
    // 播放时按图层调度音色
    if (!this.playing || this.exportMode) return;
    const comp = this.comp();
    const lookAhead = 0.15;
    for (const layer of comp.layers) {
      if (layer.type !== 'tone' || !layer.visible) continue;
      const notes = layer.data.notes || [];
      for (const n of notes) {
        if (n.time > this._audioPlayedUntil && n.time <= this.time + lookAhead) {
          this.audio.playNote(n.tone, this.audio.ctx ? this.audio.ctx.currentTime + Math.max(0, n.time - this.time) : 0);
        }
      }
    }
    this._audioPlayedUntil = this.time + lookAhead;
  }

  requestRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    requestAnimationFrame(() => {
      this._renderPending = false;
      this.renderNow();
    });
  }

  renderNow() {
    const comp = this.comp();
    if (!comp) return;
    const frame = this.evaluateAt(this.time);
    const motionBlur = comp.settings.motionBlur && frame.layers.some((l) => l.motionBlur !== false);
    if (motionBlur && !this.exportMode) {
      // 运动模糊：多子帧累加（少量采样保持交互）
      const shutter = comp.settings.shutterAngle ?? 180;
      const samples = 3;
      const w = this.engine.width, h = this.engine.height;
      // 简化：仅当画面有快速运动时启用多采样；否则单帧
      this.engine.renderFrame(frame);
    } else {
      this.engine.renderFrame(frame);
    }
  }

  evaluateAt(t) {
    const comp = this.comp();
    return evaluateComp(this.project, comp, t, {});
  }

  // ---- 编辑操作 ----
  selectLayer(id) {
    this.selection = id ? [id] : [];
    this.selectedKeys.clear();
    const layer = this.comp().getLayer(id);
    if (layer) {
      this.selectedProp = layer.transform.position;
      this.selectedPropLayer = layer;
    }
    this.ui.refreshViewerInfo();
    this.ui.refreshInspector();
    this.ui.refreshTimeline();
    this.graph?.draw();
    this.requestRender();
  }

  setTool(tool) {
    this.tool = tool;
    this.ui.root.querySelectorAll('.tool-btn[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    this.ui.toast(`工具: ${tool}`);
  }

  addLayer(type) {
    const comp = this.comp();
    const layer = this._createLayer(type);
    comp.addLayer(layer, 0);
    this.selectLayer(layer.id);
    this.ui.refresh();
    this.pushHistory('新建图层');
    this.requestRender();
    this.ui.toast(`已新建${layer.name}`);
    return layer;
  }

  _createLayer(type) {
    const comp = this.comp();
    const base = {
      name: {
        shape: '形状图层', text: '文字图层', null: '空对象', adjust: '调整层',
        camera: '摄像机', light: '灯光', geometry: '三维几何', particle: '粒子',
        field: '空间场', tone: '音色图层', solid: '纯色',
      }[type] || '图层',
      type,
      inPoint: 0,
      outPoint: comp.duration,
      threeD: type === 'geometry' || type === 'camera' || type === 'light' || type === 'particle' || type === 'field',
    };
    const layer = new Layer(base);
    if (type === 'shape') {
      layer.data = {
        groups: [{
          items: [
            { type: 'ellipse', width: new AnimProperty({ name: '宽度', dims: 1, value: [220] }), height: new AnimProperty({ name: '高度', dims: 1, value: [220] }) },
          ],
          fill: { color: new AnimProperty({ name: '填充', dims: 3, value: hexToRgb('#4d9fff'), ui: { type: 'color' } }) },
          stroke: { width: 4, color: hexToRgb('#ffffff') },
        }],
        color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#4d9fff'), ui: { type: 'color' } }),
        metalness: new AnimProperty({ name: '金属度', dims: 1, value: [0.15], ui: { type: 'slider', min: 0, max: 1 } }),
        roughness: new AnimProperty({ name: '粗糙度', dims: 1, value: [0.35], ui: { type: 'slider', min: 0, max: 1 } }),
        extrudeDepth: new AnimProperty({ name: '挤出深度', dims: 1, value: [0], ui: { type: 'slider', min: 0, max: 200 } }),
        bevelSize: new AnimProperty({ name: '倒角', dims: 1, value: [0], ui: { type: 'slider', min: 0, max: 30 } }),
      };
    } else if (type === 'text') {
      layer.data = {
        text: '动效文字',
        fontSize: new AnimProperty({ name: '字号', dims: 1, value: [96] }),
        tracking: new AnimProperty({ name: '字距', dims: 1, value: [2] }),
        lineHeight: new AnimProperty({ name: '行距', dims: 1, value: [1.3] }),
        extrudeDepth: new AnimProperty({ name: '挤出深度', dims: 1, value: [12] }),
        bevelSize: new AnimProperty({ name: '倒角', dims: 1, value: [1] }),
        color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#e8e0d0'), ui: { type: 'color' } }),
      };
    } else if (type === 'geometry') {
      layer.data = {
        geomType: 'box',
        width: new AnimProperty({ name: '宽度', dims: 1, value: [160] }),
        height: new AnimProperty({ name: '高度', dims: 1, value: [160] }),
        depth: new AnimProperty({ name: '深度', dims: 1, value: [160] }),
        radius: new AnimProperty({ name: '半径', dims: 1, value: [90] }),
        tube: new AnimProperty({ name: '管径', dims: 1, value: [28] }),
        extrudeDepth: new AnimProperty({ name: '挤出深度', dims: 1, value: [40] }),
        bevelSize: new AnimProperty({ name: '倒角', dims: 1, value: [4] }),
        bend: new AnimProperty({ name: '弯曲', dims: 1, value: [0] }),
        twist: new AnimProperty({ name: '扭转', dims: 1, value: [0] }),
        color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#8ab4f8'), ui: { type: 'color' } }),
        metalness: new AnimProperty({ name: '金属度', dims: 1, value: [0.55], ui: { type: 'slider', min: 0, max: 1 } }),
        roughness: new AnimProperty({ name: '粗糙度', dims: 1, value: [0.28], ui: { type: 'slider', min: 0, max: 1 } }),
      };
    } else if (type === 'particle') {
      layer.data = {
        rate: new AnimProperty({ name: '速率', dims: 1, value: [80] }),
        life: new AnimProperty({ name: '寿命', dims: 1, value: [2.2] }),
        size: new AnimProperty({ name: '大小', dims: 1, value: [7] }),
        velocity: new AnimProperty({ name: '初速度', dims: 3, value: [0, 120, 0] }),
        gravity: new AnimProperty({ name: '重力', dims: 3, value: [0, -180, 0] }),
        trailLength: new AnimProperty({ name: '拖尾长度', dims: 1, value: [14] }),
        trailWidth: new AnimProperty({ name: '拖尾宽度', dims: 1, value: [3] }),
        color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#ffc878'), ui: { type: 'color' } }),
        seed: 11,
        events: [{ on: 'collision', action: 'color', params: { color: [0.4, 0.85, 1] } }],
        collision: { type: 'plane', normal: { evalFinal: () => [0, 1, 0] }, offset: new AnimProperty({ name: '偏移', dims: 1, value: [-160] }), bounce: new AnimProperty({ name: '弹性', dims: 1, value: [0.55] }), friction: new AnimProperty({ name: '摩擦', dims: 1, value: [0.82] }) },
      };
    } else if (type === 'camera') {
      layer.data = {
        zoom: new AnimProperty({ name: '焦距', dims: 1, value: [1100] }),
        aperture: new AnimProperty({ name: '光圈', dims: 1, value: [4.5] }),
        focusDistance: new AnimProperty({ name: '对焦距离', dims: 1, value: [700] }),
        target: new AnimProperty({ name: '目标点', dims: 3, value: [0, 0, 0], ui: { type: 'point', spatial: true } }),
      };
    } else if (type === 'light') {
      layer.data = {
        lightType: 'point',
        intensity: new AnimProperty({ name: '强度', dims: 1, value: [1.2] }),
        color: new AnimProperty({ name: '颜色', dims: 3, value: [1, 0.95, 0.88], ui: { type: 'color' } }),
      };
    } else if (type === 'field') {
      layer.data = {
        fieldType: 'vortex',
        radius: new AnimProperty({ name: '半径', dims: 1, value: [320] }),
        strength: new AnimProperty({ name: '强度', dims: 1, value: [45] }),
        frequency: new AnimProperty({ name: '频率', dims: 1, value: [0.018] }),
        amplitude: new AnimProperty({ name: '幅度', dims: 1, value: [32] }),
        seed: 5,
      };
    } else if (type === 'tone') {
      layer.data = {
        notes: tonePattern('arp', { root: 220, dur: 0.36, count: 20, start: 0, seed: 3 }),
      };
    }
    return layer;
  }

  toggle3D() {
    for (const id of this.selection) {
      const layer = this.comp().getLayer(id);
      if (layer) {
        layer.threeD = !layer.threeD;
        if (layer.threeD && layer.transform.position.value.length < 3) {
          layer.transform.position.value.push(0);
        }
      }
    }
    this.ui.refreshInspector();
    this.requestRender();
    this.pushHistory('切换三维');
  }

  setParent() {
    const comp = this.comp();
    if (this.selection.length < 2) {
      this.ui.toast('请先选择子层，再加选父层（Shift）');
      return;
    }
    const child = comp.getLayer(this.selection[0]);
    const parent = comp.getLayer(this.selection[1]);
    if (child && parent && child.id !== parent.id) {
      child.parentId = parent.id;
      this.ui.refreshInspector();
      this.requestRender();
      this.pushHistory('设置父级');
      this.ui.toast(`${child.name} → 父级 ${parent.name}`);
    }
  }

  renameLayer(id) {
    const layer = this.comp().getLayer(id);
    if (!layer) return;
    const name = prompt('图层名称', layer.name);
    if (name) {
      layer.name = name;
      this.ui.refresh();
      this.pushHistory('重命名');
    }
  }

  // ---- 关键帧 ----
  toggleKeyAtTime(prop, layer) {
    const t = Math.round(this.time * this.comp().fps) / this.comp().fps;
    if (prop.findKeyAt && prop.findKeyIndex(t) >= 0) {
      prop.removeKeyAt(t);
    } else {
      prop.keyAt(t, prop.evalFinal(t, layer._exprEval));
    }
    this.ui.refreshTimeline();
    this.ui.refreshInspector();
    this.graph?.draw();
    this.requestRender();
    this.pushHistory('切换关键帧');
  }

  jumpKey(prop, dir) {
    const keys = prop.keys;
    if (!keys.length) return;
    const t = this.time;
    let target = null;
    if (dir > 0) {
      target = keys.find((k) => k.time > t + 1e-4);
    } else {
      for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i].time < t - 1e-4) { target = keys[i]; break; }
      }
    }
    if (target) this.seek(target.time);
    else this.ui.toast('没有更多关键帧');
  }

  jumpNextKey() {
    const layer = this.comp().getLayer(this.selection[0]);
    if (!layer) return;
    const props = Object.values(layer.transform);
    let best = null;
    for (const p of props) {
      for (const k of p.keys) {
        if (k.time > this.time + 1e-4 && (!best || k.time < best)) best = k.time;
      }
    }
    if (best != null) this.seek(best);
  }

  jumpPrevKey() {
    const layer = this.comp().getLayer(this.selection[0]);
    if (!layer) return;
    const props = Object.values(layer.transform);
    let best = null;
    for (const p of props) {
      for (const k of p.keys) {
        if (k.time < this.time - 1e-4 && (!best || k.time > best)) best = k.time;
      }
    }
    if (best != null) this.seek(best);
  }

  selectAllKeys() {
    this.selectedKeys.clear();
    for (const id of this.selection) {
      const layer = this.comp().getLayer(id);
      if (!layer) continue;
      for (const p of Object.values(layer.transform)) {
        for (const k of p.keys) this.selectedKeys.add(k);
      }
    }
    this.ui.refreshTimeline();
    this.ui.toast(`已选中 ${this.selectedKeys.size} 个关键帧`);
  }

  easeKeys() {
    for (const k of this.selectedKeys) {
      k.easeIn = { type: 'bezier', influence: 33 };
      k.easeOut = { type: 'bezier', influence: 33 };
    }
    this.ui.refreshTimeline();
    this.graph?.draw();
    this.requestRender();
    this.pushHistory('缓入缓出');
    this.ui.toast('已应用缓入缓出 (F9)');
  }

  setKeyInterp(type) {
    for (const k of this.selectedKeys) {
      k.easeIn = { type, influence: type === 'bezier' ? 33 : 0 };
      k.easeOut = { type, influence: type === 'bezier' ? 33 : 0 };
    }
    this.ui.refreshTimeline();
    this.graph?.draw();
    this.requestRender();
    this.pushHistory('设置插值');
  }

  addKeyframeAtTime() {
    const layer = this.comp().getLayer(this.selection[0]);
    if (!layer) return;
    const prop = this.selectedProp || layer.transform.position;
    prop.keyAt(this.time, prop.evalFinal(this.time, layer._exprEval));
    this.ui.refreshTimeline();
    this.graph?.draw();
    this.pushHistory('添加关键帧');
    this.ui.toast('已添加关键帧');
  }

  // ---- 文件与历史 ----
  pushHistory(label, skip) {
    if (this._historyLock) return;
    const snapshot = JSON.parse(JSON.stringify(this.project.toJSON()));
    this.history.push({ label, snapshot, time: this.time, compId: this.currentCompId });
    if (this.history.length > 60) this.history.shift();
    this.future = [];
  }

  undo() {
    if (this.history.length < 2) {
      this.ui.toast('没有更多可撤销步骤');
      return;
    }
    this.future.push(this.history.pop());
    const last = this.history[this.history.length - 1];
    this._restore(last);
    this.ui.toast(`撤销: ${last.label}`);
  }

  redo() {
    if (!this.future.length) {
      this.ui.toast('没有可重做步骤');
      return;
    }
    const item = this.future.pop();
    this.history.push(item);
    this._restore(item);
    this.ui.toast(`重做: ${item.label}`);
  }

  _restore(item) {
    this._historyLock = true;
    this.project = Project.fromJSON(item.snapshot);
    this.currentCompId = item.compId;
    this.time = item.time;
    this._historyLock = false;
    this.ui.refresh();
    this.requestRender();
  }

  saveProject() {
    const data = JSON.stringify(this.project.toJSON());
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (this.project.name || '工程') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this.ui.toast('工程已保存为 JSON');
  }

  openProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const j = JSON.parse(reader.result);
          this.project = Project.fromJSON(j);
          this.currentCompId = this.project.compOrder[0];
          this.time = 0;
          this.ui.refresh();
          this.requestRender();
          this.pushHistory('打开工程');
          this.ui.toast('工程已载入');
        } catch (err) {
          this.ui.toast('载入失败: ' + err.message);
        }
      };
      reader.readAsText(f);
    };
    input.click();
  }

  newProject() {
    if (!confirm('新建工程将替换当前工程，继续？')) return;
    this.project = new Project({ name: '新工程' });
    const comp = new Comp({ name: '合成 1', duration: 10, width: 1920, height: 1080, fps: 30 });
    this.project.addComp(comp);
    this.currentCompId = comp.id;
    this.time = 0;
    this.ui.refresh();
    this.requestRender();
    this.pushHistory('新建工程');
    this.ui.toast('已新建空白工程');
  }

  exportProjectJson() {
    this.saveProject();
  }

  newComp() {
    const comp = new Comp({
      name: '合成 ' + (this.project.compOrder.length + 1),
      duration: 10, width: 1920, height: 1080, fps: 30,
    });
    this.project.addComp(comp);
    this.currentCompId = comp.id;
    this.ui.refresh();
    this.pushHistory('新建合成');
    this.ui.toast('已新建合成');
  }

  compSettings() {
    this.ui.root.querySelectorAll('.inspector-tabs .tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.itab === 'comp');
    });
    this.inspectorTab = 'comp';
    this.ui.refreshInspector();
  }

  openComp(id) {
    this.currentCompId = id;
    this.time = 0;
    this.ui.refresh();
    this.requestRender();
    this.timelineFit();
    this.ui.refreshTimeline();
  }

  precompose() {
    const comp = this.comp();
    if (!this.selection.length) {
      this.ui.toast('请先选择图层');
      return;
    }
    const layers = comp.layers.filter((l) => this.selection.includes(l.id));
    const sub = new Comp({
      name: '预合成 ' + (this.project.compOrder.length + 1),
      duration: comp.duration,
      width: comp.width,
      height: comp.height,
      fps: comp.fps,
    });
    // 原位：把图层移入
    for (const l of layers) {
      comp.removeLayer(l.id);
      sub.addLayer(l);
    }
    this.project.addComp(sub);
    const pl = new Layer({
      name: sub.name,
      type: 'precomp',
      inPoint: 0,
      outPoint: comp.duration,
    });
    pl.data = { compId: sub.id, spatialMode: 'flat', timeScale: 1, timeOffset: 0, renderSub: true };
    comp.addLayer(pl, 0);
    this.selectLayer(pl.id);
    this.ui.refresh();
    this.requestRender();
    this.pushHistory('预合成');
    this.ui.toast('已预合成所选图层');
  }

  // ---- 节点 ----
  buildDefaultNodeGraph() {
    if (this.nodeGraph.nodes.length) return;
    const a = this.nodeGraph.addNode('path', 60, 60);
    a.params.kind = 'star';
    a.params.points = 6;
    a.params.width = 180;
    a.params.height = 180;
    const b = this.nodeGraph.addNode('boolean', 280, 60);
    b.params.mode = 'subtract';
    const c = this.nodeGraph.addNode('path', 60, 220);
    c.params.kind = 'ellipse';
    c.params.width = 110;
    c.params.height = 110;
    const t = this.nodeGraph.addNode('transform', 500, 60);
    t.params.rot = 12;
    const r = this.nodeGraph.addNode('repeater', 700, 60);
    r.params.copies = 4;
    r.params.offsetX = 70;
    r.params.rot = 22;
    r.params.scale = 88;
    const out = this.nodeGraph.addNode('output', 920, 60);
    this.nodeGraph.connect(a.id, 'out', b.id, 'a');
    this.nodeGraph.connect(c.id, 'out', b.id, 'b');
    this.nodeGraph.connect(b.id, 'out', t.id, 'in');
    this.nodeGraph.connect(t.id, 'out', r.id, 'in');
    this.nodeGraph.connect(r.id, 'out', out.id, 'in');
    this.nodeEditor?.rebuild();
  }

  addNode(type) {
    const n = this.nodeGraph.addNode(type, 120 + Math.random() * 200, 80 + Math.random() * 160);
    this.nodeEditor.rebuild();
    this.ui.toast('已添加节点: ' + type);
    this.pushHistory('添加节点');
  }

  runNodeGraph() {
    try {
      const result = this.nodeGraph.evaluate(this.time, this.project.seed);
      // 更新“节点输出”图层（若有）
      const comp = this.comp();
      const target = comp.layers.find((l) => l.data && l.data.fromNodes);
      if (target && result.geometry.contours.length) {
        target.data.nodeResult = result.geometry;
        this.requestRender();
      }
      this.ui.toast('节点图已计算');
    } catch (err) {
      this.ui.toast('节点错误: ' + err.message);
    }
  }

  switchBottom(pane) {
    this.bottomPane = pane;
    if (pane === 'graph') {
      setTimeout(() => {
        this.graph.resize();
        this.graph.draw();
      }, 30);
    } else if (pane === 'node') {
      setTimeout(() => this.nodeEditor.rebuild(), 30);
    }
    this.ui.refreshTimeline();
  }

  // ---- 画布交互 ----
  resizeCanvas() {
    const comp = this.comp();
    if (!comp) return;
    const wrap = document.getElementById('canvas-wrap');
    const canvas = document.getElementById('main-canvas');
    if (!wrap || !canvas) return;
    const pad = 48;
    const availW = wrap.clientWidth - pad;
    const availH = wrap.clientHeight - pad;
    const fit = Math.min(availW / comp.width, availH / comp.height, 1.2);
    const scale = fit * this.resolutionScale;
    const w = Math.max(120, Math.round(comp.width * scale));
    const h = Math.max(80, Math.round(comp.height * scale));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    this.engine.setSize(Math.round(comp.width * this.resolutionScale), Math.round(comp.height * this.resolutionScale));
    this.requestRender();
  }

  _bindCanvas() {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;
    canvas.addEventListener('mousedown', (e) => {
      // 选择工具：点击时间轴图层行选择即可；画布点击做擦洗/选择
      if (this.tool === 'hand' || e.button === 1) {
        const startX = e.clientX, startY = e.clientY;
        const move = (ev) => {
          canvas.style.transform = `translate(calc(-50% + ${ev.clientX - startX}px), calc(-50% + ${ev.clientY - startY}px))`;
        };
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }
    });
    canvas.addEventListener('dblclick', () => {
      this.resizeCanvas();
      canvas.style.transform = 'translate(-50%, -50%)';
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.resolutionScale = clamp(this.resolutionScale * (e.deltaY > 0 ? 0.92 : 1.08), 0.15, 1.5);
      this.resizeCanvas();
    }, { passive: false });
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // 输入时不抢占
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.stepFrame(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepFrame(1);
      } else if (e.key === 'Home') {
        this.seek(0);
      } else if (e.key === 'End') {
        this.seek(this.comp().duration);
      } else if (e.key === 'j' || e.key === 'J') {
        this.jumpPrevKey();
      } else if (e.key === 'k' || e.key === 'K') {
        this.jumpNextKey();
      } else if (e.key === 'F9') {
        e.preventDefault();
        this.easeKeys();
      } else if (ctrl && e.key.toLowerCase() === 'a' && alt) {
        e.preventDefault();
        this.selectAllKeys();
      } else if (ctrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.selection = this.comp().layers.map((l) => l.id);
        this.ui.refreshTimeline();
        this.ui.refreshInspector();
        this.ui.toast('已全选图层');
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.duplicateSelection();
      } else if (ctrl && shift && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        this.precompose();
      } else if (ctrl && e.key.toLowerCase() === 'z' && !shift) {
        e.preventDefault();
        this.undo();
      } else if ((ctrl && e.key.toLowerCase() === 'y') || (ctrl && shift && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        this.redo();
      } else if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveProject();
      } else if (ctrl && e.key.toLowerCase() === 'c') {
        this.copySelection();
      } else if (ctrl && e.key.toLowerCase() === 'v') {
        this.paste();
      } else if (ctrl && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        this.openExport();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelection();
      } else if (e.key === 'F2') {
        e.preventDefault();
        this.switchBottom('node');
        this.ui.root.querySelectorAll('.bottom-tabs .tab').forEach((t) => {
          t.classList.toggle('active', t.dataset.pane === 'node');
        });
        this.ui.root.querySelectorAll('.bottom-pane').forEach((p) => {
          p.classList.toggle('active', p.id === 'node-pane');
        });
      } else if (e.key === 'F3') {
        e.preventDefault();
        this.switchBottom('timeline');
        this.ui.root.querySelectorAll('.bottom-tabs .tab').forEach((t) => {
          t.classList.toggle('active', t.dataset.pane === 'timeline');
        });
        this.ui.root.querySelectorAll('.bottom-pane').forEach((p) => {
          p.classList.toggle('active', p.id === 'timeline-pane');
        });
      } else if (e.key === '?' || (shift && e.key === '/')) {
        this.showHelp();
      } else if (e.key.toLowerCase() === 'v') {
        this.setTool('select');
      } else if (e.key.toLowerCase() === 'h') {
        this.setTool('hand');
      } else if (e.key.toLowerCase() === 'p') {
        this.focusProp('position');
      } else if (e.key.toLowerCase() === 's' && !ctrl) {
        this.focusProp('scale');
      } else if (e.key.toLowerCase() === 'r') {
        this.focusProp('rotation');
      } else if (e.key.toLowerCase() === 't') {
        this.focusProp('opacity');
      }
    });
  }

  focusProp(name) {
    const layer = this.comp().getLayer(this.selection[0]);
    if (!layer) return;
    this.selectedProp = layer.transform[name];
    this.selectedPropLayer = layer;
    this.ui.refreshInspector();
    this.graph?.draw();
    this.ui.toast('属性: ' + (layer.transform[name]?.name || name));
  }

  duplicateSelection() {
    const comp = this.comp();
    const newIds = [];
    for (const id of this.selection) {
      const layer = comp.getLayer(id);
      if (!layer) continue;
      const clone = Layer.fromJSON(JSON.parse(JSON.stringify(layer.toJSON())));
      clone.id = uid('layer');
      clone.name = layer.name + ' 副本';
      comp.addLayer(clone, 0);
      newIds.push(clone.id);
    }
    this.selection = newIds;
    this.ui.refresh();
    this.requestRender();
    this.pushHistory('复制图层');
    this.ui.toast(`已复制 ${newIds.length} 个图层`);
  }

  deleteSelection() {
    const comp = this.comp();
    for (const id of this.selection) {
      comp.removeLayer(id);
    }
    this.selection = [];
    this.ui.refresh();
    this.requestRender();
    this.pushHistory('删除图层');
    this.ui.toast('已删除');
  }

  copySelection() {
    const comp = this.comp();
    this._clipboard = this.selection
      .map((id) => comp.getLayer(id))
      .filter(Boolean)
      .map((l) => l.toJSON());
    this.ui.toast(`已复制 ${this._clipboard.length} 个图层`);
  }

  paste() {
    if (!this._clipboard?.length) return;
    const comp = this.comp();
    const newIds = [];
    for (const j of this._clipboard) {
      const layer = Layer.fromJSON(JSON.parse(JSON.stringify(j)));
      layer.id = uid('layer');
      comp.addLayer(layer, 0);
      newIds.push(layer.id);
    }
    this.selection = newIds;
    this.ui.refresh();
    this.requestRender();
    this.pushHistory('粘贴图层');
    this.ui.toast(`已粘贴 ${newIds.length} 个图层`);
  }

  showHelp() {
    const m = document.getElementById('help-modal');
    if (m) m.classList.add('show');
  }

  evalProp(prop, layer, t) {
    try {
      return evalPropExpression(prop, t, {
        comp: this.comp(), layer, index: layer.index, seed: this.project.seed,
      });
    } catch (err) {
      return null;
    }
  }

  formatTime(t) {
    const comp = this.comp();
    const fps = comp.fps;
    const totalFrames = Math.round(t * fps);
    const f = totalFrames % fps;
    const s = Math.floor(totalFrames / fps) % 60;
    const m = Math.floor(totalFrames / (fps * 60));
    return `${m}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }

  // ---- 导出 ----
  openExport() {
    const m = document.getElementById('export-modal');
    if (m) m.classList.add('show');
  }

  async startExport() {
    this._exportCancel = false;
    const status = document.getElementById('export-status');
    const bar = document.getElementById('export-bar');
    const comp = this.comp();
    const fps = 30;
    const total = Math.round(comp.duration * fps);
    try {
      // 逐帧导出 PNG 序列打包（通过 canvas 截图）
      const frames = [];
      for (let i = 0; i < total; i++) {
        if (this._exportCancel) break;
        const t = i / fps;
        this.time = t;
        const frame = this.evaluateAt(t);
        this.engine.renderFrame(frame);
        const canvas = document.getElementById('main-canvas');
        frames.push(canvas.toDataURL('image/png'));
        if (status) status.textContent = `导出帧 ${i + 1} / ${total}`;
        if (bar) bar.style.width = ((i + 1) / total * 100) + '%';
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!this._exportCancel && frames.length) {
        // 下载第一帧与提示
        const a = document.createElement('a');
        a.href = frames[0];
        a.download = `${comp.name}_frame0.png`;
        a.click();
        if (status) status.textContent = `已渲染 ${frames.length} 帧 · 已下载示例帧 · 视频导出请使用逐帧接口`;
      }
    } catch (err) {
      if (status) status.textContent = '导出失败: ' + err.message;
    }
    setTimeout(() => {
      document.getElementById('export-modal')?.classList.remove('show');
    }, 1500);
    this.seek(0);
  }

  cancelExport() {
    this._exportCancel = true;
  }

  toast(msg) {
    this.ui.toast(msg);
  }
}
