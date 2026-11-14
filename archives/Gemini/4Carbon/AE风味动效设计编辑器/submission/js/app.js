/**
 * Forge Studio — Main Application Controller, Keyboard Shortcuts & `window.videoExport` API
 * Orchestrates:
 *   - Project lifecycle (15s「锻字」default demo auto-load, Empty Project, Save/Open `.json`, Undo/Redo)
 *   - Synchronized views: Project Panel, WebGL2 Composition Canvas + Gizmo Overlay,
 *     Timeline Dope Sheet / Curve Editor, Procedural Node Graph, and Properties Inspector
 *   - Real-time playback loop with Work Area looping, frame stepping, and Web Audio synthesis + VU meter
 *   - Standard AE Keyboard Shortcuts with strict text/expression input focus protection (2.16)
 *   - Exact `window.videoExport` frame-by-frame whole-editor export interface (4.2)
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, uid } = Forge.Math;
  const Anim = Forge.Anim;
  const Scene = Forge.SceneEval;
  const Particles = Forge.Particles;
  const AudioMod = Forge.Audio;

  function isEditableInputTarget(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return !['button', 'checkbox', 'radio', 'Submit', 'reset'].includes(type);
    }
    return false;
  }

  function formatTimecode(sec, fps = 30) {
    const s = Math.max(0, sec);
    const totalFrames = Math.floor(s * fps + 1e-4);
    const ff = totalFrames % Math.max(1, Math.round(fps));
    const totalSec = Math.floor(totalFrames / Math.max(1, Math.round(fps)));
    const ss = totalSec % 60;
    const mm = Math.floor(totalSec / 60);
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  }

  class ForgeEditorApp {
    constructor() {
      this.project = null;
      this.activeCompId = null;
      this.currentTime = 0;

      this.isPlaying = false;
      this.loopWorkArea = true;
      this.exportMode = false;
      this.activeBottomWorkspace = 'split'; // 'timeline' | 'nodes' | 'split'

      this.activeTool = 'select'; // 'select' | 'hand' | 'anchor' | 'rotate' | 'camera' | 'rect' | 'ellipse' | 'pen' | 'pin'
      this.spacePressed = false;
      this.showAllFieldGizmos = false;

      this.selectedLayerIds = new Set();
      this._lastSelectedAnchorId = null;
      this._isDemoUntouched = true;

      this.history = new Anim.HistoryManager(80);
      this.history.onChange = () => {
        this._isDemoUntouched = false;
        this._updateHistoryButtons();
      };

      this._rafId = null;
      this._lastFrameWallMs = 0;

      this.renderer = null;
      this.overlay = null;
      this.timeline = null;
      this.nodeEditor = null;
      this.inspector = null;
    }

    init() {
      const glCanvas = document.getElementById('gl-canvas');
      this.renderer = new Forge.Renderer.WebGLRenderer(glCanvas);

      // Load default 15-second「锻字」demo project automatically on startup (Section 3.1)
      this.project = Forge.Demo.createForgeDemoProject();
      this.activeCompId = this.project.activeCompId || this.project.compositions[0]?.id || null;
      this.currentTime = 0;

      this.overlay = new Forge.CanvasOverlay.CanvasOverlayController(this);
      this.timeline = new Forge.TimelineView.TimelineController(this);
      this.nodeEditor = new Forge.NodeEditorView.NodeEditorController(this);
      this.inspector = new Forge.InspectorView.InspectorController(this);

      this._setupDefaultDemoPresentation();
      this._bindTopAndBottomUI();
      this._bindGlobalShortcutsAndAudioUnlock();
      this._bindResizeHandling();

      this.overlay.fitToViewport();
      this.nodeEditor.fitGraphToView();
      this.refreshAll();
    }

    _setupDefaultDemoPresentation() {
      const comp = this.getActiveComp();
      if (!comp) return;
      this.timeline.resetTimeRangeForComp(comp);
      this.timeline.expandedLayers.clear();
      this.selectedLayerIds.clear();

      // Select the forged 3D character block & expand key animated layers in the timeline so keyframes & curves are immediately visible!
      const heroLayer = comp.layers.find((l) => l.type === 'nodeGeo') || comp.layers[0];
      const textLayer = comp.layers.find((l) => l.type === 'text' && !l.textData?.linkedSourceLayerId);
      const hammerLayer = comp.layers.find((l) => l.solidData?.primitive === 'hammer');
      if (heroLayer) {
        this.selectedLayerIds.add(heroLayer.id);
        this.timeline.expandedLayers.set(heroLayer.id, 'animated');
      }
      if (textLayer) this.timeline.expandedLayers.set(textLayer.id, 'animated');
      if (hammerLayer) this.timeline.expandedLayers.set(hammerLayer.id, 'animated');
    }

    // =========================================================================
    // COMPOSITION & LAYER SELECTION ACCESSORS
    // =========================================================================
    getActiveComp() {
      if (!this.project || !this.project.compositions) return null;
      return this.project.compositions.find((c) => c.id === this.activeCompId) || this.project.compositions[0] || null;
    }

    setActiveComp(compId) {
      const target = this.project?.compositions?.find((c) => c.id === compId);
      if (!target) return;
      this.pause();
      this.activeCompId = target.id;
      this.project.activeCompId = target.id;
      this.currentTime = clamp(this.currentTime, 0, target.duration);
      this.selectedLayerIds.clear();
      this.timeline.selectedKeyframes.clear();
      this.timeline.resetTimeRangeForComp(target);
      this.overlay.fitToViewport();
      this.nodeEditor.fitGraphToView();
      this.refreshAll();
    }

    getSelectedLayers() {
      const comp = this.getActiveComp();
      if (!comp || !comp.layers) return [];
      return comp.layers.filter((l) => this.selectedLayerIds.has(l.id));
    }

    getPrimarySelectedLayer() {
      const list = this.getSelectedLayers();
      return list[0] || null;
    }

    selectLayers(idsArray) {
      this.selectedLayerIds = new Set(idsArray || []);
      this._lastSelectedAnchorId = idsArray && idsArray.length ? idsArray[idsArray.length - 1] : null;
      this.refreshAll();
    }

    selectLayer(layerId, opts = {}) {
      const comp = this.getActiveComp();
      if (!comp) return;
      if (opts.range && this._lastSelectedAnchorId) {
        const i0 = comp.layers.findIndex((l) => l.id === this._lastSelectedAnchorId);
        const i1 = comp.layers.findIndex((l) => l.id === layerId);
        if (i0 >= 0 && i1 >= 0) {
          const lo = Math.min(i0, i1), hi = Math.max(i0, i1);
          if (!opts.toggle) this.selectedLayerIds.clear();
          for (let k = lo; k <= hi; k++) this.selectedLayerIds.add(comp.layers[k].id);
          this.refreshAll();
          return;
        }
      }
      if (opts.toggle) {
        if (this.selectedLayerIds.has(layerId)) this.selectedLayerIds.delete(layerId);
        else this.selectedLayerIds.add(layerId);
      } else {
        this.selectedLayerIds.clear();
        this.selectedLayerIds.add(layerId);
      }
      this._lastSelectedAnchorId = layerId;
      this.refreshAll();
    }

    toggleLayerSelection(layerId) {
      this.selectLayer(layerId, { toggle: true });
    }

    clearLayerSelection() {
      if (this.selectedLayerIds.size === 0) return;
      this.selectedLayerIds.clear();
      this.refreshAll();
    }

    // =========================================================================
    // TRANSACTIONAL UNDO / REDO WRAPPERS (Section 2.14)
    // =========================================================================
    beginInteractiveTransaction(label = '编辑') {
      this.history.beginTransaction(this.project, label);
    }

    commitInteractiveTransaction() {
      const changed = this.history.commitTransaction(this.project);
      if (changed) this._isDemoUntouched = false;
      this._updateHistoryButtons();
    }

    recordAction(label, mutatorFn) {
      const before = this.history.serialize(this.project);
      mutatorFn();
      const changed = this.history.pushSnapshot(before, this.project, label);
      if (changed) this._isDemoUntouched = false;
      this._updateHistoryButtons();
      this.refreshAll();
    }

    undo() {
      this.pause();
      const prev = this.history.undo(this.project);
      if (!prev) return;
      this._applyRestoredProject(prev);
    }

    redo() {
      this.pause();
      const next = this.history.redo(this.project);
      if (!next) return;
      this._applyRestoredProject(next);
    }

    _applyRestoredProject(restoredProj) {
      this.project = restoredProj;
      if (!this.project.compositions.some((c) => c.id === this.activeCompId)) {
        this.activeCompId = this.project.activeCompId || this.project.compositions[0]?.id || null;
      }
      const comp = this.getActiveComp();
      if (comp) {
        this.currentTime = clamp(this.currentTime, 0, comp.duration);
        const validIds = new Set(comp.layers.map((l) => l.id));
        this.selectedLayerIds = new Set(Array.from(this.selectedLayerIds).filter((id) => validIds.has(id)));
      } else {
        this.selectedLayerIds.clear();
      }
      Particles.invalidateAllParticleCaches();
      this._updateHistoryButtons();
      this.refreshAll();
    }

    _updateHistoryButtons() {
      const btnU = document.getElementById('btn-undo');
      const btnR = document.getElementById('btn-redo');
      if (btnU) btnU.disabled = !this.history.canUndo();
      if (btnR) btnR.disabled = !this.history.canRedo();
    }

    // =========================================================================
    // SYNCHRONIZED RENDERING & READOUT REFRESH
    // =========================================================================
    renderSceneOnly() {
      const comp = this.getActiveComp();
      this.renderer.renderComposition(comp, this.currentTime, this.project, this.overlay?.customView);
      this.overlay?.renderGizmos();
    }

    refreshCanvasAndProps() {
      this.renderSceneOnly();
      this.timeline?.updateLiveReadouts();
      this.timeline?.renderCanvas();
      this.nodeEditor?.updateLiveSummaries();
      this.inspector?.updateLiveValues();
      this.updateTimeReadouts();
      this.updateAudioVUMeter();
    }

    refreshViewsAfterEdit(lightweight = false) {
      if (lightweight) {
        this.refreshCanvasAndProps();
      } else {
        this.refreshAll();
      }
    }

    refreshAll() {
      this.renderSceneOnly();
      this.inspector?.renderAll();
      this.timeline?.render();
      this.nodeEditor?.render();
      this.updateZoomReadout();
      this.updateTimeReadouts();
      this.updateAudioVUMeter();
      this._updateHistoryButtons();
      this._updateCompBreadcrumb();
    }

    updateZoomReadout() {
      const el = document.getElementById('viewport-zoom-label');
      if (el && this.overlay) {
        el.textContent = `${Math.round(this.overlay.zoom * 100)}%`;
      }
    }

    updateTimeReadouts() {
      const comp = this.getActiveComp();
      const fps = comp ? comp.fps : 30;
      const tcEl = document.getElementById('timecode-display');
      const secEl = document.getElementById('seconds-display');
      if (tcEl) tcEl.textContent = formatTimecode(this.currentTime, fps);
      if (secEl) secEl.textContent = `${this.currentTime.toFixed(2)}s / ${(comp ? comp.duration : 0).toFixed(1)}s`;
    }

    updateAudioVUMeter() {
      const comp = this.getActiveComp();
      const barL = document.getElementById('vu-bar-l');
      const barR = document.getElementById('vu-bar-r');
      if (!barL || !barR) return;
      if (!comp || !AudioMod?.engine) {
        barL.style.width = '0%';
        barR.style.width = '0%';
        return;
      }
      const lvl = AudioMod.engine.sampleVisualAudioLevel(comp, this.currentTime, this.project);
      barL.style.width = `${Math.round(clamp(lvl.peakL, 0, 1) * 100)}%`;
      barR.style.width = `${Math.round(clamp(lvl.peakR, 0, 1) * 100)}%`;
    }

    _updateCompBreadcrumb() {
      const el = document.getElementById('active-comp-badge');
      const comp = this.getActiveComp();
      if (el) {
        el.textContent = comp ? `${comp.name} (${comp.width}×${comp.height} · ${comp.fps}fps)` : '空工程';
      }
    }

    // =========================================================================
    // TRANSPORT, PLAYBACK & AUDIO CLOCK
    // =========================================================================
    setTime(t) {
      const comp = this.getActiveComp();
      const maxT = comp ? comp.duration : 15;
      this.currentTime = clamp(t, 0, maxT);
      if (this.isPlaying && AudioMod?.engine) {
        AudioMod.engine.lastScheduledTime = this.currentTime;
      }
      this.refreshCanvasAndProps();
    }

    play() {
      if (this.exportMode || this.isPlaying) return;
      const comp = this.getActiveComp();
      if (!comp) return;

      AudioMod.engine.unlock();
      const ws = comp.workStart ?? 0;
      const we = comp.workEnd ?? comp.duration;
      if (this.currentTime >= we - 1e-3 || this.currentTime < ws) {
        this.currentTime = ws;
      }

      this.isPlaying = true;
      AudioMod.engine.resetScheduleCursor(this.currentTime);
      this._syncPlayButton();
      this._lastFrameWallMs = performance.now();

      const tick = (nowMs) => {
        if (!this.isPlaying || this.exportMode) return;
        const activeComp = this.getActiveComp();
        if (!activeComp) {
          this.pause();
          return;
        }
        const dt = clamp((nowMs - this._lastFrameWallMs) / 1000, 0, 0.1);
        this._lastFrameWallMs = nowMs;

        const prevT = this.currentTime;
        const workStart = activeComp.workStart ?? 0;
        const workEnd = activeComp.workEnd ?? activeComp.duration;
        let nextT = prevT + dt;

        if (nextT >= workEnd) {
          AudioMod.engine.schedulePlaybackRange(activeComp, prevT, workEnd + 1e-4, this.project);
          if (this.loopWorkArea) {
            nextT = workStart + ((nextT - workStart) % Math.max(0.05, workEnd - workStart));
            AudioMod.engine.resetScheduleCursor(workStart);
            AudioMod.engine.schedulePlaybackRange(activeComp, workStart, nextT, this.project);
          } else {
            this.currentTime = workEnd;
            this.refreshCanvasAndProps();
            this.pause();
            return;
          }
        } else {
          AudioMod.engine.schedulePlaybackRange(activeComp, prevT, nextT, this.project);
        }

        this.currentTime = nextT;
        this.refreshCanvasAndProps();
        this._rafId = requestAnimationFrame(tick);
      };

      this._rafId = requestAnimationFrame(tick);
    }

    pause() {
      this.isPlaying = false;
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      AudioMod.engine.stopAllVoices();
      this._syncPlayButton();
    }

    togglePlay() {
      if (this.isPlaying) this.pause();
      else this.play();
    }

    _syncPlayButton() {
      const btn = document.getElementById('btn-play');
      if (btn) {
        btn.textContent = this.isPlaying ? '⏸ 暂停' : '▶ 播放';
        btn.classList.toggle('playing', this.isPlaying);
      }
    }

    stepFrame(deltaFrames) {
      this.pause();
      const comp = this.getActiveComp();
      if (!comp) return;
      const fps = comp.fps || 30;
      const curFrame = Math.round(this.currentTime * fps);
      this.setTime((curFrame + deltaFrames) / fps);
    }

    jumpKeyframe(dir) {
      this.pause();
      const comp = this.getActiveComp();
      if (!comp) return;
      const times = [];
      for (const l of comp.layers) {
        for (const p of Forge.TimelineView.collectLayerProperties(l, 'animated')) {
          for (const kf of (p.prop.keyframes || [])) times.push(kf.time);
        }
      }
      times.sort((a, b) => a - b);
      if (dir < 0) {
        const prev = [...times].reverse().find((t) => t < this.currentTime - 1e-4);
        if (prev !== undefined) this.setTime(prev);
      } else {
        const next = times.find((t) => t > this.currentTime + 1e-4);
        if (next !== undefined) this.setTime(next);
      }
    }

    // =========================================================================
    // PROJECT & LAYER COMMANDS
    // =========================================================================
    newEmptyProject() {
      this.pause();
      this.project = Forge.Demo.createEmptyProject();
      this.activeCompId = null;
      this.currentTime = 0;
      this.selectedLayerIds.clear();
      this.history.clear();
      this._isDemoUntouched = false;
      Particles.invalidateAllParticleCaches();
      this.refreshAll();
    }

    loadDemoProject() {
      this.pause();
      this.project = Forge.Demo.createForgeDemoProject();
      this.activeCompId = this.project.activeCompId || this.project.compositions[0]?.id || null;
      this.currentTime = 0;
      this.history.clear();
      this._isDemoUntouched = true;
      Particles.invalidateAllParticleCaches();
      this._setupDefaultDemoPresentation();
      this.overlay?.fitToViewport();
      this.nodeEditor?.fitGraphToView();
      this.refreshAll();
    }

    saveProjectToFile() {
      if (!this.project) return;
      const json = JSON.stringify(this.project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(this.project.name || 'forge-project').replace(/[\\/:*?"<>|]/g, '_')}.forge.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    openProjectFromJSONString(jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed || !Array.isArray(parsed.compositions)) {
          throw new Error('工程文件结构无效');
        }
        this.pause();
        this.project = parsed;
        this.activeCompId = parsed.activeCompId || parsed.compositions[0]?.id || null;
        this.currentTime = 0;
        this.selectedLayerIds.clear();
        this.history.clear();
        this._isDemoUntouched = false;
        Particles.invalidateAllParticleCaches();
        const comp = this.getActiveComp();
        if (comp) this.timeline.resetTimeRangeForComp(comp);
        this.overlay?.fitToViewport();
        this.nodeEditor?.fitGraphToView();
        this.refreshAll();
        return true;
      } catch (err) {
        console.error('打开工程失败:', err);
        return false;
      }
    }

    createNewComposition() {
      this.recordAction('新建合成', () => {
        const idx = (this.project.compositions?.length || 0) + 1;
        const comp = Scene.createComposition({
          name: `合成 ${idx}`,
          width: 1280,
          height: 720,
          fps: 30,
          duration: 10,
          bgColor: [0.055, 0.065, 0.09]
        });
        this.project.compositions.push(comp);
        this.activeCompId = comp.id;
        this.project.activeCompId = comp.id;
        this.currentTime = 0;
        this.selectedLayerIds.clear();
        this.timeline?.resetTimeRangeForComp(comp);
      });
      this.overlay?.fitToViewport();
      this.refreshAll();
    }

    deleteComposition(compId) {
      if (!this.project?.compositions || this.project.compositions.length <= 1) return;
      this.recordAction('删除合成', () => {
        this.project.compositions = this.project.compositions.filter((c) => c.id !== compId);
        if (this.activeCompId === compId) {
          this.activeCompId = this.project.compositions[0]?.id || null;
          this.project.activeCompId = this.activeCompId;
          this.selectedLayerIds.clear();
        }
      });
    }

    addLayerOfType(type) {
      let comp = this.getActiveComp();
      if (!comp) {
        this.createNewComposition();
        comp = this.getActiveComp();
      }
      if (!comp) return null;

      let created = null;
      this.recordAction(`新建图层: ${type}`, () => {
        const n = comp.layers.length + 1;
        if (type === 'shape') created = Scene.createShapeLayer(comp, `形状图层 ${n}`, 'rect');
        else if (type === 'text') created = Scene.createTextLayer(comp, `文字图层 ${n}`, '锻造动效');
        else if (type === 'solid3d') created = Scene.createSolid3DLayer(comp, `三维实体 ${n}`, 'box');
        else if (type === 'nodeGeo') {
          created = Scene.createNodeGeoLayer(comp, `程序节点几何 ${n}`);
          // Ensure comp has at least one output_display node wired if empty!
          if (!comp.nodeGraph || comp.nodeGraph.nodes.length === 0) {
            comp.nodeGraph = { nodes: [], edges: [] };
            const tNode = Forge.Nodes.createNode('text_geo', 60, 80);
            const eNode = Forge.Nodes.createNode('extrude_3d', 310, 80);
            const oNode = Forge.Nodes.createNode('output_display', 560, 80);
            oNode.params.targetLayerId = created.id;
            comp.nodeGraph.nodes.push(tNode, eNode, oNode);
            comp.nodeGraph.edges.push(
              { id: uid('ed'), fromNode: tNode.id, fromPort: 'geo', toNode: eNode.id, toPort: 'geo' },
              { id: uid('ed'), fromNode: eNode.id, fromPort: 'mesh', toNode: oNode.id, toPort: 'geo' }
            );
          }
        }
        else if (type === 'particle') created = Scene.createParticleLayer(comp, `粒子系统 ${n}`);
        else if (type === 'field') created = Scene.createFieldLayer(comp, `空间场 ${n}`, 'radial');
        else if (type === 'camera') created = Scene.createCameraLayer(comp, `摄像机 ${n}`);
        else if (type === 'light') created = Scene.createLightLayer(comp, `灯光 ${n}`, 'point');
        else if (type === 'null') created = Scene.createNullLayer(comp, `空对象 ${n}`);
        else if (type === 'adjustment') {
          created = Scene.createAdjustmentLayer(comp, `调整图层 ${n}`);
          created.effects.push(Scene.createEffectInstance('glow'));
        }
        else if (type === 'audio') created = Scene.createAudioLayer(comp, `音色图层 ${n}`, 'anvil_strike');

        if (created) {
          comp.layers.unshift(created);
          this.selectedLayerIds = new Set([created.id]);
          Particles.invalidateAllParticleCaches();
        }
      });
      return created;
    }

    duplicateSelectedLayers() {
      const comp = this.getActiveComp();
      if (!comp || this.selectedLayerIds.size === 0) return;
      this.recordAction('复制图层 (Ctrl+D)', () => {
        const newSel = new Set();
        const nextLayers = [];
        for (const l of comp.layers) {
          nextLayers.push(l);
          if (this.selectedLayerIds.has(l.id)) {
            const copy = JSON.parse(JSON.stringify(l));
            copy.id = uid('lyr');
            copy.name = `${l.name} 副本`;
            newSel.add(copy.id);
            nextLayers.splice(nextLayers.length - 1, 0, copy);
          }
        }
        comp.layers = nextLayers;
        this.selectedLayerIds = newSel;
        Particles.invalidateAllParticleCaches();
      });
    }

    deleteSelectedLayers() {
      const comp = this.getActiveComp();
      if (!comp || this.selectedLayerIds.size === 0) return;
      this.recordAction('删除所选图层', () => {
        const delSet = new Set(this.selectedLayerIds);
        comp.layers = comp.layers.filter((l) => !delSet.has(l.id));
        for (const l of comp.layers) {
          if (l.parentId && delSet.has(l.parentId)) l.parentId = null;
        }
        this.selectedLayerIds.clear();
        Particles.invalidateAllParticleCaches();
      });
    }

    precomposeSelection() {
      const comp = this.getActiveComp();
      if (!comp || this.selectedLayerIds.size === 0) return;
      const ids = Array.from(this.selectedLayerIds);
      this.recordAction('原位预合成 (Ctrl+Shift+C)', () => {
        const res = Scene.precomposeSelectedLayers(
          this.project,
          comp,
          ids,
          `预合成 ${(this.project.compositions?.length || 1)}`
        );
        if (res && res.precompLayer) {
          this.selectedLayerIds = new Set([res.precompLayer.id]);
        }
        Particles.invalidateAllParticleCaches();
      });
    }

    setTool(toolName) {
      this.activeTool = toolName;
      this.overlay.activePenItem = null;
      document.querySelectorAll('[data-tool]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tool === toolName);
      });
      this.overlay?.renderGizmos();
    }

    setBottomWorkspace(ws) {
      this.activeBottomWorkspace = ws; // 'timeline' | 'nodes' | 'split'
      const dockEl = document.getElementById('bottom-dock');
      if (dockEl) dockEl.dataset.workspace = ws;
      document.querySelectorAll('[data-bottom-ws]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.bottomWs === ws);
      });
      requestAnimationFrame(() => {
        this.timeline?.renderCanvas();
        if (ws === 'nodes' || ws === 'split') {
          this.nodeEditor?.render();
        }
      });
    }

    // =========================================================================
    // UI BUTTONS & SHORTCUT BINDINGS
    // =========================================================================
    _bindTopAndBottomUI() {
      const on = (id, ev, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(ev, fn);
      };

      // Project toolbar
      on('btn-new-empty', 'click', () => this.newEmptyProject());
      on('btn-reset-demo', 'click', () => this.loadDemoProject());
      on('btn-save-proj', 'click', () => this.saveProjectToFile());
      on('btn-open-proj', 'click', () => document.getElementById('file-open-input')?.click());
      const fileInp = document.getElementById('file-open-input');
      if (fileInp) {
        fileInp.addEventListener('change', () => {
          const f = fileInp.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => this.openProjectFromJSONString(String(reader.result || ''));
          reader.readAsText(f, 'utf-8');
          fileInp.value = '';
        });
      }

      on('btn-undo', 'click', () => this.undo());
      on('btn-redo', 'click', () => this.redo());
      on('btn-precomp', 'click', () => this.precomposeSelection());

      // Tool buttons
      document.querySelectorAll('[data-tool]').forEach((btn) => {
        btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
      });

      // Viewport helpers & view controls
      on('btn-fit-view', 'click', () => {
        this.overlay.customView.enabled = false;
        this.overlay.fitToViewport();
        this.renderSceneOnly();
        this._syncViewModeButtons();
      });
      on('btn-toggle-custom-cam', 'click', () => {
        this.overlay.customView.enabled = !this.overlay.customView.enabled;
        this.renderSceneOnly();
        this._syncViewModeButtons();
      });
      on('btn-toggle-grid', 'click', () => {
        this.overlay.helpers.grid = !this.overlay.helpers.grid;
        document.getElementById('btn-toggle-grid')?.classList.toggle('active', this.overlay.helpers.grid);
        this.overlay.renderGizmos();
      });
      on('btn-toggle-checker', 'click', () => {
        this.renderer.showCheckerboard = !this.renderer.showCheckerboard;
        document.getElementById('btn-toggle-checker')?.classList.toggle('active', this.renderer.showCheckerboard);
        this.renderSceneOnly();
      });
      on('btn-toggle-fields-gizmo', 'click', () => {
        this.showAllFieldGizmos = !this.showAllFieldGizmos;
        document.getElementById('btn-toggle-fields-gizmo')?.classList.toggle('active', this.showAllFieldGizmos);
        this.overlay.renderGizmos();
      });

      // Transport controls
      on('btn-jump-start', 'click', () => { this.pause(); this.setTime(0); });
      on('btn-step-prev', 'click', () => this.stepFrame(-1));
      on('btn-play', 'click', () => this.togglePlay());
      on('btn-step-next', 'click', () => this.stepFrame(1));
      on('btn-jump-end', 'click', () => {
        this.pause();
        const c = this.getActiveComp();
        if (c) this.setTime(c.duration);
      });
      on('btn-kf-prev', 'click', () => this.jumpKeyframe(-1));
      on('btn-kf-next', 'click', () => this.jumpKeyframe(1));
      on('btn-loop-toggle', 'click', () => {
        this.loopWorkArea = !this.loopWorkArea;
        document.getElementById('btn-loop-toggle')?.classList.toggle('active', this.loopWorkArea);
      });
      on('btn-mute-audio', 'click', () => {
        AudioMod.engine.setMuted(!AudioMod.engine.muted);
        const btn = document.getElementById('btn-mute-audio');
        if (btn) btn.textContent = AudioMod.engine.muted ? '🔇 静音' : '🔊 声画';
      });

      // Bottom workspace switchers (`时间轴/曲线` | `程序节点` | `双栏同屏`)
      document.querySelectorAll('[data-bottom-ws]').forEach((btn) => {
        btn.addEventListener('click', () => this.setBottomWorkspace(btn.dataset.bottomWs));
      });

      // Timeline & Curve Toolbar buttons
      on('btn-tl-tracks', 'click', () => this.timeline.setMode('tracks'));
      on('btn-tl-graph', 'click', () => this.timeline.setMode('graph'));
      on('btn-graph-value', 'click', () => this.timeline.setGraphType('value'));
      on('btn-graph-speed', 'click', () => this.timeline.setGraphType('speed'));
      on('btn-tl-snap', 'click', () => {
        this.timeline.snapEnabled = !this.timeline.snapEnabled;
        document.getElementById('btn-tl-snap')?.classList.toggle('active', this.timeline.snapEnabled);
      });
      on('btn-kf-ease', 'click', () => this.timeline.applyEasyEaseSelected());
      on('btn-kf-linear', 'click', () => this.timeline.setSelectedKeyframeInterp('both', 'linear'));
      on('btn-kf-hold', 'click', () => this.timeline.setSelectedKeyframeInterp('both', 'hold'));
      on('sel-kf-in', 'change', (e) => {
        if (e.target.value) {
          this.timeline.setSelectedKeyframeInterp('in', e.target.value);
          e.target.value = '';
        }
      });
      on('sel-kf-out', 'change', (e) => {
        if (e.target.value) {
          this.timeline.setSelectedKeyframeInterp('out', e.target.value);
          e.target.value = '';
        }
      });
      on('btn-kf-copy', 'click', () => this.timeline.copySelectedKeyframes());
      on('btn-kf-paste', 'click', () => this.timeline.pasteKeyframesAtPlayhead());

      // Node Editor Toolbar buttons
      on('btn-node-fit', 'click', () => this.nodeEditor.fitGraphToView());
      on('btn-node-dup', 'click', () => this.nodeEditor.duplicateSelectedNodes());
      on('btn-node-group', 'click', () => this.nodeEditor.groupSelectedNodes());
      on('btn-node-ungroup', 'click', () => this.nodeEditor.ungroupSelectedNode());
      on('btn-node-del', 'click', () => this.nodeEditor.deleteSelected());
    }

    _syncViewModeButtons() {
      const btn = document.getElementById('btn-toggle-custom-cam');
      if (btn) {
        btn.classList.toggle('active', this.overlay.customView.enabled);
        btn.textContent = this.overlay.customView.enabled ? '🎥 自由观察视角' : '🎥 活动摄像机';
      }
    }

    _bindGlobalShortcutsAndAudioUnlock() {
      const unlockOnce = () => {
        AudioMod.engine.unlock();
      };
      window.addEventListener('pointerdown', unlockOnce, { passive: true });
      window.addEventListener('keydown', unlockOnce, { passive: true });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') this.spacePressed = false;
      });

      window.addEventListener('keydown', (e) => {
        if (this.exportMode) return;

        // Section 2.16: NEVER hijack shortcuts when typing text, numbers, or expressions!
        if (isEditableInputTarget(e.target)) {
          if (e.key === 'Escape') e.target.blur();
          return;
        }

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const keyLower = e.key.toLowerCase();

        // Undo / Redo (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`)
        if (ctrl && !shift && keyLower === 'z') {
          e.preventDefault();
          this.undo();
          return;
        }
        if ((ctrl && keyLower === 'y') || (ctrl && shift && keyLower === 'z')) {
          e.preventDefault();
          this.redo();
          return;
        }

        // Pre-compose (`Ctrl+Shift+C`)
        if (ctrl && shift && keyLower === 'c') {
          e.preventDefault();
          this.precomposeSelection();
          return;
        }

        // Duplicate (`Ctrl+D`)
        if (ctrl && !shift && keyLower === 'd') {
          e.preventDefault();
          if (this.activeBottomWorkspace === 'nodes' && this.nodeEditor.selectedNodeIds.size > 0) {
            this.nodeEditor.duplicateSelectedNodes();
          } else {
            this.duplicateSelectedLayers();
          }
          return;
        }

        // Copy / Paste Keyframes (`Ctrl+C`, `Ctrl+V`)
        if (ctrl && !shift && keyLower === 'c') {
          if (this.timeline.copySelectedKeyframes()) e.preventDefault();
          return;
        }
        if (ctrl && !shift && keyLower === 'v') {
          if (this.timeline.pasteKeyframesAtPlayhead()) e.preventDefault();
          return;
        }

        // Puppet Pin Tool (`Ctrl+P`)
        if (ctrl && !shift && keyLower === 'p') {
          e.preventDefault();
          this.setTool('pin');
          return;
        }

        if (ctrl) return;

        // Spacebar Play / Pause
        if (e.code === 'Space') {
          e.preventDefault();
          this.spacePressed = true;
          if (!e.repeat) this.togglePlay();
          return;
        }

        // Easy Ease (`F9`)
        if (e.key === 'F9') {
          e.preventDefault();
          this.timeline.applyEasyEaseSelected();
          return;
        }

        // Delete selected keyframes, nodes, or layers
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (this.timeline.selectedKeyframes.size > 0 && this.timeline.deleteSelectedKeyframes()) return;
          if ((this.activeBottomWorkspace === 'nodes' || this.activeBottomWorkspace === 'split') && this.nodeEditor.deleteSelected()) return;
          this.deleteSelectedLayers();
          return;
        }

        // Tool Switching (`V`, `H`, `Y`, `W`, `C`, `Q`, `G`)
        if (keyLower === 'v') { this.setTool('select'); return; }
        if (keyLower === 'h') { this.setTool('hand'); return; }
        if (keyLower === 'y') { this.setTool('anchor'); return; }
        if (keyLower === 'w') { this.setTool('rotate'); return; }
        if (keyLower === 'c') { this.setTool('camera'); return; }
        if (keyLower === 'q') { this.setTool(this.activeTool === 'rect' ? 'ellipse' : 'rect'); return; }
        if (keyLower === 'g') { this.setTool('pen'); return; }

        // AE Property Reveal Shortcuts (`P`, `S`, `R`, `T`, `A`, `U`)
        if (keyLower === 'p') { this.timeline.revealLayerPropShortcut('P'); return; }
        if (keyLower === 's') { this.timeline.revealLayerPropShortcut('S'); return; }
        if (keyLower === 'r') { this.timeline.revealLayerPropShortcut('R'); return; }
        if (keyLower === 't') { this.timeline.revealLayerPropShortcut('T'); return; }
        if (keyLower === 'a') { this.timeline.revealLayerPropShortcut('A'); return; }
        if (keyLower === 'u') { this.timeline.revealLayerPropShortcut('animated'); return; }

        // Work Area Start / End (`B` / `N`)
        if (keyLower === 'b') {
          const c = this.getActiveComp();
          if (c) this.recordAction('设置工作区起点 (B)', () => {
            c.workStart = clamp(this.currentTime, 0, (c.workEnd ?? c.duration) - 0.1);
          });
          return;
        }
        if (keyLower === 'n') {
          const c = this.getActiveComp();
          if (c) this.recordAction('设置工作区终点 (N)', () => {
            c.workEnd = clamp(this.currentTime, (c.workStart ?? 0) + 0.1, c.duration);
          });
          return;
        }

        // Frame Stepping & Keyframe Navigation
        if (e.key === 'PageUp' || e.key === ',' || e.key === 'ArrowLeft') {
          e.preventDefault();
          this.stepFrame(shift ? -10 : -1);
          return;
        }
        if (e.key === 'PageDown' || e.key === '.' || e.key === 'ArrowRight') {
          e.preventDefault();
          this.stepFrame(shift ? 10 : 1);
          return;
        }
        if (keyLower === 'j') { this.jumpKeyframe(-1); return; }
        if (keyLower === 'k') { this.jumpKeyframe(1); return; }
        if (e.key === 'Home') { e.preventDefault(); this.pause(); this.setTime(0); return; }
        if (e.key === 'End') {
          e.preventDefault();
          this.pause();
          const c = this.getActiveComp();
          if (c) this.setTime(c.duration);
        }
      });
    }

    _bindResizeHandling() {
      window.addEventListener('resize', () => {
        if (this.overlay?.autoFit) {
          this.overlay.fitToViewport();
        }
        this.renderSceneOnly();
        this.timeline?.renderCanvas();
        this.nodeEditor?.renderCanvas();
      });
    }
  }

  // Boot Application & Register `window.videoExport` (Section 4.2)
  const app = new ForgeEditorApp();
  Forge.app = app;

  let _exportFps = 30;
  let _exportTotalFrames = 450;

  window.videoExport = {
    runs: ['demo'],

    async begin(runId = 'demo', opts = {}) {
      if (runId !== 'demo') {
        throw new Error(`Unsupported videoExport runId: ${runId}`);
      }
      const fps = Math.max(1, Number(opts?.fps) || 30);
      _exportFps = fps;

      // Ensure interactive playback & audio clocks are paused so nothing advances autonomously
      app.pause();
      app.exportMode = true;

      // Ensure the 15-second「锻字」demo main composition is loaded and active at t = 0s
      const mainComp = app.getActiveComp();
      if (!mainComp || Math.abs((mainComp.duration || 0) - 15) > 1e-3 || mainComp.layers.length === 0) {
        app.project = Forge.Demo.createForgeDemoProject();
        app.activeCompId = app.project.activeCompId || app.project.compositions[0].id;
        Particles.invalidateAllParticleCaches();
        app._setupDefaultDemoPresentation();
      } else if (app.project.activeCompId && app.activeCompId !== app.project.activeCompId) {
        const rootDemo = app.project.compositions.find((c) => Math.abs((c.duration || 0) - 15) < 1e-3);
        if (rootDemo) app.activeCompId = rootDemo.id;
      }

      const comp = app.getActiveComp();
      app.overlay.customView.enabled = false;
      app.overlay.autoFit = true;
      app.overlay.fitToViewport();
      app.timeline.setMode('tracks');
      app.timeline.resetTimeRangeForComp(comp);

      // Select hero forged character block so live animated properties update visibly in Inspector & Timeline!
      const hero = comp.layers.find((l) => l.type === 'nodeGeo') || comp.layers[0];
      if (hero && app.selectedLayerIds.size === 0) {
        app.selectedLayerIds = new Set([hero.id]);
        app.timeline.expandedLayers.set(hero.id, 'animated');
      }

      app.currentTime = 0;
      app.refreshAll();
      app.renderer.finishFrame();

      _exportTotalFrames = Math.round(15 * fps);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      return { frames: _exportTotalFrames };
    },

    async frame(i) {
      const comp = app.getActiveComp();
      const dur = comp ? comp.duration : 15;
      const t = clamp(Number(i) / _exportFps, 0, dur);

      if (app.overlay.autoFit) {
        app.overlay.fitToViewport();
      }

      // Deterministic state evaluation at exact `t = i / fps` — zero cumulative clock drift or duplicate events!
      app.currentTime = t;
      app.refreshCanvasAndProps();
      app.renderer.finishFrame();

      // Wait for browser frame presentation so caller can immediately capture screenshot
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    },

    end() {
      app.exportMode = false;
      app.refreshAll();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
  } else {
    app.init();
  }
})();
