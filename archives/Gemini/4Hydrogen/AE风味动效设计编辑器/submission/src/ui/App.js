// 主应用控制器：集成 WebGL2 渲染器、历史记录栈、合成画布、时间轴、曲线编辑器、节点编辑器、属性面板、音频引擎与 AE 快捷键

import { clamp } from '../core/math.js';
import { addOrUpdateKeyframe, cloneVal, invalidateSpatialCache } from '../core/property.js';
import { evalProperty, resolvePropertyByPath } from '../core/expressions.js';
import {
  createComposition,
  createLayer,
  createEmptyProject,
  getActiveComp,
  getLayerById,
  reparentLayerPreserveVisual,
  serializeProject,
  deserializeProject,
  HistoryManager,
} from '../core/project.js';
import { evaluateNodeGraphOutput } from '../nodes/nodeGraph.js';
import { WebGL2AECompositor } from '../render/renderer.js';
import { AudioEngine } from '../audio/synth.js';
import { createForgeDemoProject } from '../demo/forgeDemo.js';
import { ViewportController } from './Viewport.js';
import { ProjectPanel } from './ProjectPanel.js';
import { TimelinePanel } from './TimelinePanel.js';
import { GraphEditor } from './GraphEditor.js';
import { NodeEditor } from './NodeEditor.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import { installVideoExport } from './videoExport.js';
import { el, showModalDialog, showToast } from './helpers.js';

export class AEEditorApp {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.history = new HistoryManager(80);
    this.audio = new AudioEngine();
    this.project = createForgeDemoProject();

    this.centerMode = 'viewport'; // 'viewport' | 'nodes' | 'split'
    this.showGraphEditor = false;
    this.graphTarget = null; // { layerId, propPath }
    this.activeNodeGraphId = this.project.nodeGraphs?.[0]?.id || null;
    this.isPlaying = false;
    this.isExportMode = false;
    this._rafId = 0;
    this._lastFrameMs = 0;

    this._buildLayout();
    this._initControllers();
    this._bindShortcuts();
    this._bindResize();
    installVideoExport(this);

    // 首次完整求值与首帧绘制
    this.refreshAll();
  }

  _buildLayout() {
    this.rootEl.innerHTML = '';
    this.rootEl.className = 'ae-app-shell';

    // 1. 顶部工具与菜单栏
    this.topbarEl = el('header', { className: 'ae-topbar' });
    this.rootEl.appendChild(this.topbarEl);

    // 2. 中部三栏工作区
    this.workspaceEl = el('div', { className: 'ae-workspace' });
    this.projectSlotEl = el('aside', { className: 'ae-panel ae-left-panel' });
    this.centerSlotEl = el('main', { className: 'ae-center-slot mode-viewport' });
    this.viewportWrapEl = el('section', { className: 'ae-viewport-wrap' });
    this.nodeWrapEl = el('section', { className: 'ae-node-wrap hidden' });
    this.centerSlotEl.appendChild(this.viewportWrapEl);
    this.centerSlotEl.appendChild(this.nodeWrapEl);

    this.propsSlotEl = el('aside', { className: 'ae-panel ae-right-panel' });
    this.workspaceEl.appendChild(this.projectSlotEl);
    this.workspaceEl.appendChild(this.centerSlotEl);
    this.workspaceEl.appendChild(this.propsSlotEl);
    this.rootEl.appendChild(this.workspaceEl);

    // 3. 底部时间轴与曲线编辑区
    this.bottomSlotEl = el('footer', { className: 'ae-bottom-dock' });
    this.graphSlotEl = el('div', { className: 'ae-graph-dock hidden' });
    this.timelineSlotEl = el('div', { className: 'ae-timeline-dock' });
    this.bottomSlotEl.appendChild(this.graphSlotEl);
    this.bottomSlotEl.appendChild(this.timelineSlotEl);
    this.rootEl.appendChild(this.bottomSlotEl);

    this._buildTopbar();
  }

  _buildTopbar() {
    this.topbarEl.innerHTML = '';

    const brand = el('div', { className: 'tb-brand' }, [
      el('span', { className: 'tb-logo', text: '◆' }),
      el('span', { className: 'tb-title', text: '熔炉 AE 动效编辑器' }),
    ]);

    const tools = [
      { id: 'select', label: '选择', key: 'V' },
      { id: 'hand', label: '抓手', key: 'H' },
      { id: 'anchor', label: '锚点', key: 'Y' },
      { id: 'pen', label: '钢笔', key: 'G' },
      { id: 'rect', label: '矩形', key: 'Q' },
      { id: 'ellipse', label: '椭圆', key: '' },
      { id: 'text', label: '文字', key: 'T' },
      { id: 'pin', label: '图钉', key: 'Ctrl+P' },
      { id: 'orbit', label: '3D视角', key: 'C' },
    ];
    this._toolBtns = new Map();
    const toolGroup = el('div', { className: 'tb-group' }, tools.map((t) => {
      const b = el('button', {
        className: `ae-btn sm tb-tool ${t.id === 'select' ? 'primary' : ''}`,
        text: t.key ? `${t.label}(${t.key})` : t.label,
        title: `${t.label} 工具${t.key ? ` [${t.key}]` : ''}`,
        onClick: () => this.setTool(t.id),
      });
      this._toolBtns.set(t.id, b);
      return b;
    }));

    // 视图切换与辅助控制
    this._modeBtns = new Map();
    const modes = [
      { id: 'viewport', label: '合成画布' },
      { id: 'nodes', label: '节点编辑器' },
      { id: 'split', label: '画布+节点分屏' },
    ];
    const modeGroup = el('div', { className: 'tb-group' }, modes.map((m) => {
      const b = el('button', {
        className: `ae-btn sm ${this.centerMode === m.id ? 'primary' : ''}`,
        text: m.label,
        onClick: () => this.setCenterMode(m.id),
      });
      this._modeBtns.set(m.id, b);
      return b;
    }));

    this.gridBtn = el('button', {
      className: 'ae-btn sm',
      text: '网格',
      onClick: () => {
        this.viewport.showGrid = !this.viewport.showGrid;
        this.gridBtn.classList.toggle('active', this.viewport.showGrid);
        this.viewport.drawOverlays();
      },
    });
    this.gizmoBtn = el('button', {
      className: 'ae-btn sm active',
      text: '控制线',
      onClick: () => {
        this.viewport.showGizmos = !this.viewport.showGizmos;
        this.gizmoBtn.classList.toggle('active', this.viewport.showGizmos);
        this.viewport.drawOverlays();
      },
    });
    const viewGroup = el('div', { className: 'tb-group' }, [
      el('button', {
        className: 'ae-btn sm',
        text: '适合窗口',
        onClick: () => {
          this.viewport.viewFit = true;
          this.viewport.viewPan = [0, 0];
          this.viewport.drawOverlays();
        },
      }),
      this.gridBtn,
      this.gizmoBtn,
    ]);

    // 历史与文件存取
    this.undoBtn = el('button', {
      className: 'ae-btn sm',
      text: '↶ 撤销',
      title: '撤销 (Ctrl+Z)',
      onClick: () => this.undo(),
    });
    this.redoBtn = el('button', {
      className: 'ae-btn sm',
      text: '↷ 重做',
      title: '重做 (Ctrl+Y)',
      onClick: () => this.redo(),
    });

    const fileInput = el('input', {
      type: 'file',
      accept: '.json,application/json',
      style: { display: 'none' },
      onChange: (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const loaded = deserializeProject(String(reader.result || ''));
            this.stopPlayback();
            this.audio.stopAll();
            this.history.clear();
            this.project = loaded;
            this.activeNodeGraphId = loaded.nodeGraphs?.[0]?.id || null;
            this.refreshAll();
            showToast(`已成功加载工程「${loaded.name}」`);
          } catch (err) {
            showToast(`读取工程失败: ${err.message}`, 'warn');
          }
        };
        reader.readAsText(file);
      },
    });

    const fileGroup = el('div', { className: 'tb-group' }, [
      this.undoBtn,
      this.redoBtn,
      el('button', {
        className: 'ae-btn sm',
        text: '新建空工程',
        onClick: () => this.newEmptyProject(),
      }),
      el('button', {
        className: 'ae-btn sm',
        text: '重置「锻字」',
        onClick: () => this.resetForgeDemo(),
      }),
      el('button', {
        className: 'ae-btn sm',
        text: '保存 JSON',
        onClick: () => this.saveProjectJson(),
      }),
      el('button', {
        className: 'ae-btn sm',
        text: '加载 JSON',
        onClick: () => fileInput.click(),
      }),
      fileInput,
    ]);

    this.topbarEl.appendChild(brand);
    this.topbarEl.appendChild(toolGroup);
    this.topbarEl.appendChild(modeGroup);
    this.topbarEl.appendChild(viewGroup);
    this.topbarEl.appendChild(fileGroup);
  }

  _initControllers() {
    this.viewport = new ViewportController(this.viewportWrapEl, this);
    this.compositor = new WebGL2AECompositor(this.viewport.getCanvas());

    this.projectPanel = new ProjectPanel(this.projectSlotEl, this);
    this.timelinePanel = new TimelinePanel(this.timelineSlotEl, this);
    this.graphEditor = new GraphEditor(this.graphSlotEl, this);
    this.nodeEditor = new NodeEditor(this.nodeWrapEl, this);
    this.propertiesPanel = new PropertiesPanel(this.propsSlotEl, this);
  }

  getActiveComp() {
    return getActiveComp(this.project);
  }

  setTool(toolId) {
    this.viewport.tool = toolId;
    for (const [k, btn] of this._toolBtns.entries()) {
      btn.classList.toggle('primary', k === toolId);
    }
    this.viewport.drawOverlays();
  }

  setCenterMode(mode, skipRender = false) {
    const modeChanged = this.centerMode !== mode;
    this.centerMode = mode;
    this.centerSlotEl.className = `ae-center-slot mode-${mode}`;
    this.viewportWrapEl.classList.toggle('hidden', mode === 'nodes');
    this.nodeWrapEl.classList.toggle('hidden', mode === 'viewport');
    for (const [k, btn] of this._modeBtns.entries()) {
      btn.classList.toggle('primary', k === mode);
    }
    if (modeChanged && mode !== 'viewport') {
      this.nodeEditor._userMovedView = false;
    }
    if (!skipRender) {
      if (mode !== 'nodes') {
        this.renderCurrentFrame();
      }
      if (mode !== 'viewport') {
        this.nodeEditor.render();
      }
    }
  }

  openNodeGraph(graphId) {
    this.activeNodeGraphId = graphId;
    this.nodeEditor.groupStack = [];
    this.nodeEditor.selectedNodeIds = [];
    this.nodeEditor._userMovedView = false;
    if (this.centerMode === 'viewport') {
      this.setCenterMode('split');
    } else {
      this.nodeEditor.render();
    }
    this.projectPanel.render();
  }

  toggleGraphEditor(forceVal = null) {
    this.showGraphEditor = forceVal !== null ? !!forceVal : !this.showGraphEditor;
    this.graphSlotEl.classList.toggle('hidden', !this.showGraphEditor);
    this.bottomSlotEl.classList.toggle('with-graph', this.showGraphEditor);
    this.timelinePanel?.updateTransportState();
    if (this.showGraphEditor) {
      this.graphEditor.render();
    }
    this.viewport?.drawOverlays();
  }

  setGraphTarget(layerId, propPath, openIfClosed = false) {
    this.graphTarget = { layerId, propPath };
    if (openIfClosed && !this.showGraphEditor) {
      this.toggleGraphEditor(true);
    } else if (this.showGraphEditor) {
      this.graphEditor.render();
    }
  }

  refreshGraphEditorOnly() {
    if (this.showGraphEditor) this.graphEditor.render();
  }

  // 修改属性数值（自动判定写入关键帧还是静态默认值，同时清空间路径/节点图/粒子缓存）
  setPropertyValue(layer, propPath, newVal, time) {
    const prop = resolvePropertyByPath(layer, propPath);
    if (!prop) return;
    if (prop.animated) {
      addOrUpdateKeyframe(prop, time, newVal);
    } else {
      prop.value = cloneVal(newVal);
    }
    invalidateSpatialCache(prop);

    // 清空关联节点缓存与粒子仿真缓存
    for (const ng of this.project.nodeGraphs || []) {
      ng._evalCache = null;
      ng._evalCacheMap = null;
    }
    const comp = this.getActiveComp();
    if (comp) {
      comp._worldGeoCache = null;
      for (const l of comp.layers) {
        l._simCache = null;
        if (l.particle) l.particle._simCache = null;
      }
    }
  }

  renderCurrentFrame(opts = {}) {
    const comp = this.getActiveComp();
    if (!comp || !this.compositor) return;
    this.compositor.renderToCanvas(this.project, comp, comp.currentTime, {
      quality: opts.exportQuality ? 'export' : opts.scrub ? 'scrub' : 'interactive',
      evalNodeGraphFn: evaluateNodeGraphOutput,
    });
    this.viewport.drawOverlays();
  }

  refreshPropertiesValuesOnly() {
    this.propertiesPanel?.refreshValuesOnly();
    this.timelinePanel?.updatePlayheadOnly();
  }

  refreshPanelsOnly() {
    this._updateHistoryButtons();
    this.projectPanel?.render();
    this.timelinePanel?.render();
    this.propertiesPanel?.render();
    if (this.showGraphEditor) this.graphEditor?.render();
    if (this.centerMode !== 'viewport') this.nodeEditor?.render();
  }

  refreshAll() {
    this.renderCurrentFrame();
    this.refreshPanelsOnly();
  }

  _updateHistoryButtons() {
    if (this.undoBtn) this.undoBtn.disabled = !this.history.canUndo();
    if (this.redoBtn) this.redoBtn.disabled = !this.history.canRedo();
  }

  seekTo(t) {
    const comp = this.getActiveComp();
    if (!comp) return;
    const prevT = comp.currentTime;
    comp.currentTime = clamp(Number(t) || 0, 0, comp.duration);
    this.renderCurrentFrame({ scrub: false });
    this.timelinePanel?.updatePlayheadOnly();
    this.propertiesPanel?.refreshValuesOnly();
    if (this.showGraphEditor) this.graphEditor?.render();
    if (this.centerMode !== 'viewport') this.nodeEditor?.render();
    void prevT;
  }

  stepFrame(deltaFrames) {
    const comp = this.getActiveComp();
    if (!comp) return;
    const dt = 1 / (comp.fps || 30);
    this.seekTo(comp.currentTime + deltaFrames * dt);
  }

  togglePlay() {
    if (this.isExportMode) return;
    if (this.isPlaying) {
      this.stopPlayback();
      return;
    }
    const comp = this.getActiveComp();
    if (!comp) return;
    this.audio.unlock();
    this.isPlaying = true;
    this._lastFrameMs = performance.now();
    this.timelinePanel?.updateTransportState();

    const tick = (nowMs) => {
      if (!this.isPlaying || this.isExportMode) return;
      const c = this.getActiveComp();
      if (!c) {
        this.stopPlayback();
        return;
      }
      const dt = Math.min(0.1, Math.max(0, (nowMs - this._lastFrameMs) / 1000));
      this._lastFrameMs = nowMs;
      const prevT = c.currentTime;
      const waStart = c.workAreaStart ?? 0;
      const waEnd = c.workAreaEnd ?? c.duration;
      let nextT = prevT + dt;
      if (nextT > waEnd) nextT = waStart;
      if (nextT < waStart) nextT = waStart;
      c.currentTime = nextT;

      this.audio.syncPlayback(this.project, c, prevT, nextT, true);
      this.renderCurrentFrame({ scrub: false });
      this.timelinePanel?.updatePlayheadOnly();
      this.propertiesPanel?.refreshValuesOnly();
      if (this.showGraphEditor) this.graphEditor?.render();

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    this.audio.stopAll();
    this.timelinePanel?.updateTransportState();
  }

  createLayerOfType(type) {
    const comp = this.getActiveComp();
    if (!comp) return;
    this.history.recordAction(this.project, `新建图层 ${type}`, () => {
      const opts = {};
      if (type === 'precomp') {
        const other = this.project.compositions.find((c) => c.id !== comp.id);
        if (other) opts.compId = other.id;
        opts.anchorPoint = [comp.width * 0.5, comp.height * 0.5, 0];
        opts.position = [comp.width * 0.5, comp.height * 0.5, 0];
      } else if (type === 'null') {
        opts.name = '空对象';
      }
      const lyr = createLayer(type, comp, opts);
      comp.layers.unshift(lyr);
      this.project.selectedLayerIds = [lyr.id];
    });
    this.refreshAll();
  }

  duplicateLayer(layerId) {
    const comp = this.getActiveComp();
    const lyr = getLayerById(comp, layerId);
    if (!lyr) return;
    this.history.recordAction(this.project, '复制图层', () => {
      const idx = comp.layers.findIndex((l) => l.id === layerId);
      const copy = deserializeProject(serializeProject({
        version: 1,
        name: 'tmp',
        activeCompId: comp.id,
        compositions: [{ ...comp, layers: [lyr] }],
        nodeGraphs: [],
      })).compositions[0].layers[0];
      copy.id = `lyr_dup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      copy.name = `${lyr.name} 副本`;
      comp.layers.splice(idx, 0, copy);
      this.project.selectedLayerIds = [copy.id];
    });
    this.refreshAll();
  }

  duplicateSelectedLayers() {
    const ids = [...(this.project.selectedLayerIds || [])];
    if (!ids.length) return;
    for (const id of ids) this.duplicateLayer(id);
  }

  deleteLayer(layerId) {
    const comp = this.getActiveComp();
    if (!comp) return;
    this.history.recordAction(this.project, '删除图层', () => {
      // 保留子图层视觉位置后再解除父级引用
      for (const l of comp.layers) {
        if (l.parentId === layerId) {
          reparentLayerPreserveVisual(this.project, comp, l, null, comp.currentTime);
        }
        if (l.trackMatte?.sourceLayerId === layerId) {
          l.trackMatte.sourceLayerId = null;
          l.trackMatte.mode = 'none';
        }
      }
      comp.layers = comp.layers.filter((l) => l.id !== layerId);
      this.project.selectedLayerIds = (this.project.selectedLayerIds || []).filter((id) => id !== layerId);
      this.project.selectedKeyframes = (this.project.selectedKeyframes || []).filter((k) => k.layerId !== layerId);
    });
    this.refreshAll();
  }

  // 原地预合成 (Ctrl+Shift+C)：正确处理原有父级、Alpha 透明与时间基准，不改变当前画面结果
  precomposeSelectedLayers() {
    const comp = this.getActiveComp();
    if (!comp) return;
    const selSet = new Set(this.project.selectedLayerIds || []);
    if (selSet.size === 0) {
      showToast('请先选中一个或多个要预合成的图层', 'warn');
      return;
    }

    const defaultName = `预合成 ${this.project.compositions.length + 1}`;
    showModalDialog({
      title: '原地预合成 (Pre-compose)',
      message: `将选中的 ${selSet.size} 个图层打包进新的透明通道合成，并原位替换为单个预合成实例，保持原有父级姿态与时间基准不变。`,
      fields: [{ name: 'name', label: '新预合成名称', value: defaultName }],
      onConfirm: (vals) => {
        this.history.recordAction(this.project, '原地预合成 (Ctrl+Shift+C)', () => {
          const movedIndices = [];
          const movedLayers = [];
          comp.layers.forEach((l, i) => {
            if (selSet.has(l.id)) {
              movedIndices.push(i);
              movedLayers.push(l);
            }
          });
          if (!movedLayers.length) return;

          const subComp = createComposition({
            name: vals.name || defaultName,
            width: comp.width,
            height: comp.height,
            fps: comp.fps,
            duration: comp.duration,
            currentTime: comp.currentTime,
            backgroundColor: [0, 0, 0, 0],
            transparentBg: true,
            motionBlur: comp.motionBlur,
            shutterAngle: comp.shutterAngle,
            shutterPhase: comp.shutterPhase,
          });

          // 1. 先处理“外部父级 -> 被移入图层”：如果某移入图层的父级不在选中集合中，按当前帧反解到子合成世界坐标以保证画面零跳变
          for (const ml of movedLayers) {
            if (ml.parentId && !selSet.has(ml.parentId)) {
              reparentLayerPreserveVisual(this.project, comp, ml, null, comp.currentTime);
            }
          }

          // 创建位于原图层次序最高处、支持 Alpha 透明通道的新预合成图层（局部原点 [0,0] 与子合成 [0,0] 对齐，锚点放在中心）
          const minIn = Math.min(...movedLayers.map((l) => l.inPoint));
          const maxOut = Math.max(...movedLayers.map((l) => l.outPoint));
          const precompLayer = createLayer('precomp', comp, {
            name: subComp.name,
            compId: subComp.id,
            anchorPoint: [comp.width * 0.5, comp.height * 0.5, 0],
            position: [comp.width * 0.5, comp.height * 0.5, 0],
            inPoint: Math.max(0, minIn),
            outPoint: Math.max(minIn + 0.1, maxOut),
            startTime: 0,
          });

          // 2. 处理“未移入的留在外层的图层，但其父级在被移入图层中”：先转为世界坐标保持不变，插入 precompLayer 后再重绑
          const reattachStay = [];
          for (const stay of comp.layers) {
            if (!selSet.has(stay.id) && stay.parentId && selSet.has(stay.parentId)) {
              reparentLayerPreserveVisual(this.project, comp, stay, null, comp.currentTime);
              reattachStay.push(stay);
            }
          }

          // 3. 移入子合成，在父合成插入 precompLayer
          subComp.layers = movedLayers;
          this.project.compositions.push(subComp);

          const insertAt = movedIndices[0];
          const remaining = comp.layers.filter((l) => !selSet.has(l.id));
          let insertedBeforeCount = 0;
          for (let i = 0; i < insertAt; i++) {
            if (!selSet.has(comp.layers[i].id)) insertedBeforeCount++;
          }
          remaining.splice(insertedBeforeCount, 0, precompLayer);
          comp.layers = remaining;
          for (const stay of reattachStay) {
            reparentLayerPreserveVisual(this.project, comp, stay, precompLayer.id, comp.currentTime);
          }
          this.project.selectedLayerIds = [precompLayer.id];
          this.project.selectedKeyframes = [];
        });
        showToast('已完成原地预合成');
        this.refreshAll();
      },
    });
  }

  undo() {
    const res = this.history.undo(this.project);
    if (!res) return;
    this.stopPlayback();
    this.project = res.project;
    this.activeNodeGraphId = this.project.nodeGraphs?.[0]?.id || null;
    showToast(`已撤销: ${res.label}`);
    this.refreshAll();
  }

  redo() {
    const res = this.history.redo(this.project);
    if (!res) return;
    this.stopPlayback();
    this.project = res.project;
    this.activeNodeGraphId = this.project.nodeGraphs?.[0]?.id || null;
    showToast(`已重做: ${res.label}`);
    this.refreshAll();
  }

  newEmptyProject() {
    this.stopPlayback();
    this.audio.stopAll();
    this.history.clear();
    this.project = createEmptyProject();
    this.activeNodeGraphId = null;
    this.graphTarget = null;
    this.refreshAll();
    showToast('已创建空白工程');
  }

  resetForgeDemo() {
    this.stopPlayback();
    this.audio.stopAll();
    this.history.clear();
    this.project = createForgeDemoProject();
    this.activeNodeGraphId = this.project.nodeGraphs?.[0]?.id || null;
    this.graphTarget = null;
    this.refreshAll();
    showToast('已重置为 15 秒「锻字」示例工程');
  }

  saveProjectJson() {
    const json = serializeProject(this.project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(this.project.name || 'ae_project').replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('已导出工程 JSON 文件');
  }

  _bindShortcuts() {
    window.addEventListener('keydown', (e) => {
      // 输入框/文本域内打字时绝不抢占快捷键
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) {
        return;
      }
      if (document.querySelector('.ae-modal-overlay')) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        this.timelinePanel.applyEasyEaseToSelected();
        return;
      }
      if (ctrl && e.shiftKey && key === 'c') {
        e.preventDefault();
        this.precomposeSelectedLayers();
        return;
      }
      if (ctrl && !e.shiftKey && key === 'z') {
        e.preventDefault();
        this.undo();
        return;
      }
      if ((ctrl && key === 'y') || (ctrl && e.shiftKey && key === 'z')) {
        e.preventDefault();
        this.redo();
        return;
      }
      if (ctrl && key === 'c') {
        if (this.timelinePanel.copySelectedKeyframes()) e.preventDefault();
        return;
      }
      if (ctrl && key === 'v') {
        if (this.timelinePanel.pasteKeyframesAtCurrentTime()) e.preventDefault();
        return;
      }
      if (ctrl && key === 'd') {
        e.preventDefault();
        this.duplicateSelectedLayers();
        return;
      }
      if (ctrl && key === 'g') {
        if (this.centerMode !== 'viewport') {
          e.preventDefault();
          this.nodeEditor.groupSelectedNodes();
        }
        return;
      }
      if (ctrl && key === 'p') {
        e.preventDefault();
        this.setTool('pin');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((this.project.selectedKeyframes || []).length > 0) {
          e.preventDefault();
          this.timelinePanel.deleteSelectedKeyframes();
        } else if (this.centerMode !== 'viewport' && (this.nodeEditor.selectedNodeIds.length > 0 || this.nodeEditor.selectedEdgeId)) {
          e.preventDefault();
          this.nodeEditor.deleteSelected();
        } else if ((this.project.selectedLayerIds || []).length > 0) {
          e.preventDefault();
          this.deleteLayer(this.project.selectedLayerIds[this.project.selectedLayerIds.length - 1]);
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.stepFrame(e.shiftKey ? -10 : -1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepFrame(e.shiftKey ? 10 : 1);
        return;
      }
      if (!ctrl) {
        if (key === 'v') this.setTool('select');
        else if (key === 'h') this.setTool('hand');
        else if (key === 'y') this.setTool('anchor');
        else if (key === 'g') this.setTool('pen');
        else if (key === 'q') this.setTool('rect');
        else if (key === 't') this.setTool('text');
        else if (key === 'c') this.setTool('orbit');
        else if (key === 'u') {
          this.timelinePanel.onlyShowAnimated = !this.timelinePanel.onlyShowAnimated;
          this.timelinePanel.onlyKfBtn.classList.toggle('active', this.timelinePanel.onlyShowAnimated);
          this.timelinePanel.render();
        }
      }
    });
  }

  _bindResize() {
    const ro = new ResizeObserver(() => {
      if (this.isExportMode) return;
      this.viewport?.drawOverlays();
      if (this.showGraphEditor) this.graphEditor?.render();
      if (this.centerMode !== 'viewport') this.nodeEditor?._redrawWires();
    });
    ro.observe(this.viewportWrapEl);
    ro.observe(this.rootEl);
    window.addEventListener('resize', () => {
      this.viewport?.drawOverlays();
      if (this.showGraphEditor) this.graphEditor?.render();
    });
  }
}
