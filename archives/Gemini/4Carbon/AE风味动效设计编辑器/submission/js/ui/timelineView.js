/**
 * Forge Studio — Synchronized Timeline, Keyframe Dope Sheet & Curve Editor (Value + Speed Graph)
 * Implements Sections 2.1, 2.2, 2.3, 2.4, 2.9, 2.10, 2.15, 2.16:
 *   - Layer outliner: visibility, solo, lock, 3D, motion blur, rename, reorder, parent (world-preserving),
 *     blend mode, track matte, expandable animatable properties with stopwatch & keyframe nav
 *   - Track Dope Sheet: ruler, work area (B..N), snapping, playhead scrub, layer in/out trim & slide,
 *     audio waveform preview, keyframe marquee box-select, move, copy/paste, delete, proportional time-stretch,
 *     separate In/Out temporal interpolation (Linear / Bezier / Hold) & F9 Easy Ease
 *   - Graph Editor: Value Graph & Speed Graph (true arc-length motion path speed for Position),
 *     final evaluated Expression curves, and interactive keyframe + Bezier handle dragging
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, lerp, uid } = Forge.Math;
  const Anim = Forge.Anim;
  const Particles = Forge.Particles;
  const AudioMod = Forge.Audio;

  const LAYER_ROW_H = 28;
  const PROP_ROW_H = 24;
  const RULER_H = 32;

  const TYPE_BADGES = {
    shape: { label: '形', color: '#38bdf8' },
    text: { label: '字', color: '#f97316' },
    null: { label: '空', color: '#a3e635' },
    adjustment: { label: '调', color: '#e879f9' },
    precomp: { label: '预', color: '#fbbf24' },
    camera: { label: '摄', color: '#f43f5e' },
    light: { label: '灯', color: '#fde047' },
    solid3d: { label: '体', color: '#60a5fa' },
    nodeGeo: { label: '节', color: '#2dd4bf' },
    field: { label: '场', color: '#c084fc' },
    particle: { label: '粒', color: '#fb923c' },
    audio: { label: '音', color: '#34d399' }
  };

  function collectLayerProperties(layer, filterMode = 'all') {
    const list = [];
    const push = (key, label, prop, group = '变换') => {
      if (!prop || typeof prop !== 'object' || !('value' in prop)) return;
      if (filterMode === 'animated' && !prop.animated && !(prop.expressionEnabled && prop.expression)) return;
      if (filterMode === 'P' && key !== 'transform.position') return;
      if (filterMode === 'S' && key !== 'transform.scale') return;
      if (filterMode === 'R' && !key.startsWith('transform.rotation')) return;
      if (filterMode === 'T' && key !== 'transform.opacity') return;
      if (filterMode === 'A' && key !== 'transform.anchorPoint') return;
      list.push({ key, label, prop, layer, group });
    };

    const tr = layer.transform;
    if (tr && layer.type !== 'audio') {
      push('transform.anchorPoint', '锚点 (A)', tr.anchorPoint, '变换');
      push('transform.position', '位置 (P)', tr.position, '变换');
      push('transform.scale', '缩放 (S)', tr.scale, '变换');
      if (layer.threeD) {
        push('transform.rotationX', 'X 旋转', tr.rotationX, '变换');
        push('transform.rotationY', 'Y 旋转', tr.rotationY, '变换');
        push('transform.rotationZ', 'Z 旋转 (R)', tr.rotationZ || tr.rotation, '变换');
      } else {
        push('transform.rotation', '旋转 (R)', tr.rotationZ || tr.rotation, '变换');
      }
      if (layer.type !== 'camera' && layer.type !== 'light' && layer.type !== 'field') {
        push('transform.opacity', '不透明度 (T)', tr.opacity, '变换');
      }
    }

    if (layer.type === 'precomp' && layer.timeRemapEnabled && layer.timeRemap) {
      push('timeRemap', '时间重映射', layer.timeRemap, '预合成');
    }

    if (layer.type === 'text' && layer.textData) {
      const td = layer.textData;
      push('text.fontSize', '字号', td.fontSize, '文字');
      push('text.tracking', '字距', td.tracking, '文字');
      push('text.lineHeight', '行距', td.lineHeight, '文字');
      if (td.strokeMode) {
        push('text.trimStart', '笔画起点 %', td.trimStart, '文字');
        push('text.trimEnd', '笔画终点 %', td.trimEnd, '文字');
      }
      (td.animators || []).forEach((a, idx) => {
        const pfx = `文字动画器${idx + 1}`;
        push(`ta.${idx}.start`, `${pfx}·起点`, a.start, pfx);
        push(`ta.${idx}.end`, `${pfx}·终点`, a.end, pfx);
        push(`ta.${idx}.offset`, `${pfx}·偏移`, a.offset, pfx);
        push(`ta.${idx}.pos`, `${pfx}·位置`, a.position, pfx);
        push(`ta.${idx}.rot`, `${pfx}·旋转`, a.rotation, pfx);
        push(`ta.${idx}.scale`, `${pfx}·缩放`, a.scale, pfx);
        push(`ta.${idx}.opacity`, `${pfx}·不透明度`, a.opacity, pfx);
      });
    }

    if (layer.type === 'shape' && layer.shapeData) {
      const sd = layer.shapeData;
      push('shape.fillColor', '填充颜色', sd.fillColor, '样式');
      push('shape.fillOpacity', '填充不透明度', sd.fillOpacity, '样式');
      push('shape.strokeColor', '描边颜色', sd.strokeColor, '样式');
      push('shape.strokeWidth', '描边宽度', sd.strokeWidth, '样式');
      (sd.items || []).forEach((it, idx) => {
        if (it.kind === 'path') {
          push(`shape.item.${idx}.path`, `${it.name || '路径'} (形变)`, it.path, '形状');
        } else if (it.kind === 'rect' || it.kind === 'ellipse') {
          push(`shape.item.${idx}.size`, `${it.name}·尺寸`, it.size, '形状');
          push(`shape.item.${idx}.pos`, `${it.name}·位置`, it.position, '形状');
          if (it.roundness) push(`shape.item.${idx}.rnd`, `${it.name}·圆角`, it.roundness, '形状');
        } else if (it.kind === 'trim') {
          push(`shape.item.${idx}.start`, `${it.name}·起点`, it.start, '操作');
          push(`shape.item.${idx}.end`, `${it.name}·终点`, it.end, '操作');
          push(`shape.item.${idx}.offset`, `${it.name}·相位`, it.offset, '操作');
        } else if (it.kind === 'repeater') {
          push(`shape.item.${idx}.copies`, `${it.name}·副本数`, it.copies, '操作');
          push(`shape.item.${idx}.pos`, `${it.name}·位移`, it.position, '操作');
          push(`shape.item.${idx}.rot`, `${it.name}·旋转`, it.rotation, '操作');
        }
      });
    }

    if (layer.extrude && layer.extrude.enabled) {
      push('extrude.depth', '挤出深度', layer.extrude.depth, '三维挤出');
      push('extrude.bevelDepth', '倒角深度', layer.extrude.bevelDepth, '三维挤出');
      push('extrude.bevelWidth', '倒角宽度', layer.extrude.bevelWidth, '三维挤出');
    }

    if (layer.material && (layer.threeD || layer.type === 'solid3d' || layer.type === 'nodeGeo')) {
      push('mat.baseColor', '材质基础色', layer.material.baseColor, '材质');
      push('mat.metallic', '金属度', layer.material.metallic, '材质');
      push('mat.roughness', '粗糙度', layer.material.roughness, '材质');
      push('mat.emissiveColor', '自发光色', layer.material.emissiveColor, '材质');
      push('mat.emissiveIntensity', '发光强度', layer.material.emissiveIntensity, '材质');
    }

    if (layer.deform && (layer.threeD || layer.type === 'solid3d' || layer.type === 'nodeGeo')) {
      push('deform.bendAngle', '弯曲角度', layer.deform.bendAngle, '变形');
      push('deform.twistAngle', '扭转角度', layer.deform.twistAngle, '变形');
      push('deform.fieldAmount', '空间场权重', layer.deform.fieldAmount, '变形');
    }

    if (layer.camera) {
      push('cam.target', '摄像机目标点', layer.camera.target, '摄像机');
      push('cam.fov', '视角 FOV', layer.camera.fov, '摄像机');
      push('cam.focusDistance', '对焦距离', layer.camera.focusDistance, '摄像机');
      push('cam.aperture', '景深光圈', layer.camera.aperture, '摄像机');
    }

    if (layer.light) {
      push('light.color', '灯光颜色', layer.light.color, '灯光');
      push('light.intensity', '灯光强度', layer.light.intensity, '灯光');
      if (layer.light.target) push('light.target', '照射目标', layer.light.target, '灯光');
    }

    if (layer.field) {
      push('field.radius', '场半径', layer.field.radius, '空间场');
      push('field.strength', '场强度', layer.field.strength, '空间场');
    }

    if (layer.particleData) {
      (layer.particleData.emitters || []).forEach((em, idx) => {
        push(`part.em${idx}.rate`, `${em.name || '发射器'}·速率`, em.rate, '粒子');
        push(`part.em${idx}.speed`, `${em.name || '发射器'}·初速`, em.initialSpeed, '粒子');
      });
    }

    if (layer.puppetPins && layer.puppetPins.length > 0) {
      layer.puppetPins.forEach((pin, idx) => {
        push(`pin.${idx}.pos`, `${pin.name || '图钉'}·位置`, pin.position, '图钉');
        push(`pin.${idx}.rot`, `${pin.name || '图钉'}·旋转`, pin.rotation, '图钉');
        push(`pin.${idx}.scale`, `${pin.name || '图钉'}·缩放`, pin.scale, '图钉');
      });
    }

    (layer.masks || []).forEach((mk, idx) => {
      push(`mask.${idx}.path`, `${mk.name || '蒙版'}·路径`, mk.path, '蒙版');
      push(`mask.${idx}.feather`, `${mk.name || '蒙版'}·羽化`, mk.feather, '蒙版');
      push(`mask.${idx}.opacity`, `${mk.name || '蒙版'}·不透明度`, mk.opacity, '蒙版');
    });

    (layer.effects || []).forEach((fx, idx) => {
      Object.entries(fx.params || {}).forEach(([pk, pv]) => {
        push(`fx.${idx}.${pk}`, `${fx.name}·${pv.name || pk}`, pv, '效果');
      });
    });

    if (layer.audioData) {
      push('audio.volume', '音量', layer.audioData.volume, '音色');
      push('audio.pitchShift', '音高偏移', layer.audioData.pitchShift, '音色');
      push('audio.tone', '音色明暗', layer.audioData.tone, '音色');
      push('audio.decay', '衰减倍率', layer.audioData.decay, '音色');
    }

    return list;
  }

  class TimelineController {
    constructor(app) {
      this.app = app;
      this.outlinerEl = document.getElementById('timeline-outliner-body');
      this.canvasWrapEl = document.getElementById('timeline-canvas-wrap');
      this.canvas = document.getElementById('timeline-canvas');
      this.ctx = this.canvas.getContext('2d');

      this.mode = 'tracks'; // 'tracks' | 'graph'
      this.graphType = 'value'; // 'value' | 'speed'
      this.snapEnabled = true;

      this.timeViewStart = 0;
      this.timeViewEnd = 15;
      this.scrollY = 0;

      // Expanded state per layerId: null (collapsed) or filter string ('all' | 'animated' | 'P' | 'S' | 'R' | 'T' | 'A')
      this.expandedLayers = new Map();
      // Active property selected for Graph Editor: { layerId, key, label, prop }
      this.activeGraphTarget = null;

      // Selected keyframes: Set of strings `${layerId}::${propKey}::${kfId}`
      this.selectedKeyframes = new Set();
      this.keyframeClipboard = [];

      this.rowsCache = []; // Built on renderOutliner: [{ kind: 'layer'|'prop', y, h, layer, propItem? }]
      this.dragState = null;
      this.marqueeRect = null;
      this.graphViewBounds = null; // Auto-fitted Y range in Graph mode

      this._bindEvents();
    }

    resetTimeRangeForComp(comp) {
      if (!comp) return;
      this.timeViewStart = 0;
      this.timeViewEnd = Math.max(1, comp.duration || 15);
      this.scrollY = 0;
    }

    setMode(mode) {
      this.mode = mode === 'graph' ? 'graph' : 'tracks';
      this.graphViewBounds = null;
      this._syncToolbarButtons();
      this.render();
    }

    setGraphType(gType) {
      this.graphType = gType === 'speed' ? 'speed' : 'value';
      this.graphViewBounds = null;
      this._syncToolbarButtons();
      this.render();
    }

    _syncToolbarButtons() {
      const btnTracks = document.getElementById('btn-tl-tracks');
      const btnGraph = document.getElementById('btn-tl-graph');
      const graphSubBar = document.getElementById('tl-graph-subbar');
      const btnVal = document.getElementById('btn-graph-value');
      const btnSpd = document.getElementById('btn-graph-speed');
      if (btnTracks) btnTracks.classList.toggle('active', this.mode === 'tracks');
      if (btnGraph) btnGraph.classList.toggle('active', this.mode === 'graph');
      if (graphSubBar) graphSubBar.style.display = this.mode === 'graph' ? 'flex' : 'none';
      if (btnVal) btnVal.classList.toggle('active', this.graphType === 'value');
      if (btnSpd) btnSpd.classList.toggle('active', this.graphType === 'speed');
    }

    revealLayerPropShortcut(filterKey) {
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const targets = this.app.selectedLayerIds.size > 0
        ? comp.layers.filter((l) => this.app.selectedLayerIds.has(l.id))
        : comp.layers;
      for (const l of targets) {
        const cur = this.expandedLayers.get(l.id);
        if (cur === filterKey) {
          this.expandedLayers.delete(l.id);
        } else {
          this.expandedLayers.set(l.id, filterKey);
        }
      }
      this.rebuildOutliner();
      this.renderCanvas();
    }

    timeToX(t, width) {
      const span = Math.max(0.05, this.timeViewEnd - this.timeViewStart);
      return ((t - this.timeViewStart) / span) * width;
    }

    xToTime(x, width) {
      const span = Math.max(0.05, this.timeViewEnd - this.timeViewStart);
      return this.timeViewStart + (x / Math.max(1, width)) * span;
    }

    snapTime(t, comp, ignoreLayerId = null) {
      if (!comp) return Math.max(0, t);
      const dur = comp.duration || 15;
      t = clamp(t, 0, dur);
      if (!this.snapEnabled) return t;

      const w = Math.max(200, this.canvas.clientWidth || 800);
      const pxTol = 7;
      const timeTol = (pxTol / w) * (this.timeViewEnd - this.timeViewStart);

      const candidates = [
        0,
        dur,
        comp.workStart ?? 0,
        comp.workEnd ?? dur,
        this.app.currentTime
      ];

      // Frame snap if zoomed in enough
      const fps = comp.fps || 30;
      const nearestFrame = Math.round(t * fps) / fps;

      for (const l of (comp.layers || [])) {
        if (l.id === ignoreLayerId) continue;
        candidates.push(l.inPoint ?? 0, l.outPoint ?? dur);
      }
      for (const row of this.rowsCache) {
        if (row.kind === 'prop' && row.propItem.prop.animated) {
          for (const kf of (row.propItem.prop.keyframes || [])) {
            const kKey = `${row.layer.id}::${row.propItem.key}::${kf.id}`;
            if (!this.selectedKeyframes.has(kKey)) candidates.push(kf.time);
          }
        }
      }

      let best = nearestFrame;
      let bestDist = Math.abs(t - nearestFrame) <= timeTol * 0.5 ? Math.abs(t - nearestFrame) : Infinity;
      for (const c of candidates) {
        const d = Math.abs(t - c);
        if (d < timeTol && d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      return bestDist < Infinity ? clamp(best, 0, dur) : clamp(nearestFrame, 0, dur);
    }

    formatValueCompact(prop, t, layer, comp) {
      if (!prop) return '';
      const val = Anim.evalProp(prop, t, { project: this.app.project, comp, layer, propKey: prop.name });
      if (prop.type === 'scalar') return Number(val).toFixed(1);
      if (prop.type === 'vec2') return `${Number(val[0]).toFixed(0)}, ${Number(val[1]).toFixed(0)}`;
      if (prop.type === 'vec3') return `${Number(val[0]).toFixed(0)}, ${Number(val[1]).toFixed(0)}, ${Number(val[2] || 0).toFixed(0)}`;
      if (prop.type === 'color') {
        return Forge.Math.rgbToHex(val);
      }
      if (prop.type === 'path' || prop.type === 'shape') {
        const cnt = Array.isArray(val) ? val.length : 0;
        return `轮廓×${cnt}`;
      }
      return '';
    }

    // =========================================================================
    // OUTLINER DOM BUILDER
    // =========================================================================
    rebuildOutliner() {
      if (!this.outlinerEl) return;
      const comp = this.app.getActiveComp();
      this.rowsCache = [];
      this.outlinerEl.innerHTML = '';

      if (!comp) {
        const empty = document.createElement('div');
        empty.className = 'tl-empty-hint';
        empty.textContent = '当前工程尚无合成 — 请在左上角「项目」面板点击「+ 新建合成」开始创作';
        this.outlinerEl.appendChild(empty);
        return;
      }

      if (!comp.layers || comp.layers.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tl-empty-hint';
        empty.textContent = '合成中暂无图层 — 点击上方工具栏添加形状、文字、三维几何、粒子或音色图层';
        this.outlinerEl.appendChild(empty);
        return;
      }

      const t = this.app.currentTime;
      let curY = 0;

      comp.layers.forEach((layer, idx) => {
        const isSel = this.app.selectedLayerIds.has(layer.id);
        const expMode = this.expandedLayers.get(layer.id) || null;
        const badge = TYPE_BADGES[layer.type] || { label: '层', color: '#94a3b8' };

        this.rowsCache.push({ kind: 'layer', y: curY, h: LAYER_ROW_H, layer, index: idx });

        const rowEl = document.createElement('div');
        rowEl.className = `tl-layer-row${isSel ? ' selected' : ''}${layer.locked ? ' locked' : ''}`;
        rowEl.style.height = `${LAYER_ROW_H}px`;
        rowEl.dataset.layerId = layer.id;
        rowEl.draggable = !layer.locked;

        // Expand caret
        const caretBtn = document.createElement('button');
        caretBtn.className = 'tl-icon-btn caret';
        caretBtn.title = '展开/收起属性 (快捷键 U 仅看关键帧属性)';
        caretBtn.textContent = expMode ? '▼' : '▶';
        caretBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.expandedLayers.has(layer.id)) this.expandedLayers.delete(layer.id);
          else this.expandedLayers.set(layer.id, 'all');
          this.rebuildOutliner();
          this.renderCanvas();
        });

        // Visibility
        const visBtn = document.createElement('button');
        visBtn.className = `tl-icon-btn${layer.visible !== false ? ' on' : ' off'}`;
        visBtn.title = '显示/隐藏图层';
        visBtn.textContent = layer.visible !== false ? '👁' : '·';
        visBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.app.recordAction('切换图层可见性', () => {
            layer.visible = layer.visible === false;
          });
        });

        // Solo
        const soloBtn = document.createElement('button');
        soloBtn.className = `tl-icon-btn solo${layer.solo ? ' on' : ''}`;
        soloBtn.title = '独奏 (Solo)';
        soloBtn.textContent = '●';
        soloBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.app.recordAction('切换图层独奏', () => {
            layer.solo = !layer.solo;
          });
        });

        // Lock
        const lockBtn = document.createElement('button');
        lockBtn.className = `tl-icon-btn${layer.locked ? ' on warn' : ''}`;
        lockBtn.title = '锁定图层';
        lockBtn.textContent = layer.locked ? '🔒' : '🔓';
        lockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.app.recordAction('切换图层锁定', () => {
            layer.locked = !layer.locked;
          });
        });

        // Type badge + Index + Name
        const typeSpan = document.createElement('span');
        typeSpan.className = 'tl-type-badge';
        typeSpan.style.background = badge.color;
        typeSpan.textContent = badge.label;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tl-layer-name';
        nameSpan.textContent = `${idx + 1}. ${layer.name}`;
        nameSpan.title = '双击重命名图层；若为预合成双击右侧「进」可进入子合成';
        nameSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (layer.type === 'precomp' && layer.sourceCompId && e.altKey) {
            this.app.setActiveComp(layer.sourceCompId);
            return;
          }
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'tl-rename-input';
          inp.value = layer.name;
          nameSpan.replaceWith(inp);
          inp.focus();
          inp.select();
          let committed = false;
          const finish = () => {
            if (committed) return;
            committed = true;
            const nextName = inp.value.trim();
            if (nextName && nextName !== layer.name) {
              this.app.recordAction('重命名图层', () => { layer.name = nextName; });
            } else {
              this.rebuildOutliner();
            }
          };
          inp.addEventListener('blur', finish);
          inp.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') finish();
            if (ke.key === 'Escape') { committed = true; this.rebuildOutliner(); }
          });
        });

        rowEl.append(caretBtn, visBtn, soloBtn, lockBtn, typeSpan, nameSpan);

        // Precomp enter button
        if (layer.type === 'precomp' && layer.sourceCompId) {
          const enterBtn = document.createElement('button');
          enterBtn.className = 'tl-mini-pill';
          enterBtn.textContent = '进入';
          enterBtn.title = '打开此预合成时间轴';
          enterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.app.setActiveComp(layer.sourceCompId);
          });
          rowEl.appendChild(enterBtn);
        }

        // 3D Switch
        const canToggle3D = ['shape', 'text', 'null', 'precomp'].includes(layer.type);
        const fixed3D = ['solid3d', 'nodeGeo', 'camera', 'light', 'field', 'particle'].includes(layer.type);
        const tdBtn = document.createElement('button');
        tdBtn.className = `tl-switch-btn${layer.threeD ? ' on' : ''}`;
        tdBtn.textContent = '3D';
        tdBtn.title = fixed3D ? '原生三维图层' : '切换 2D / 3D 图层空间';
        tdBtn.disabled = !canToggle3D;
        tdBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!canToggle3D) return;
          this.app.recordAction('切换三维图层开关', () => {
            layer.threeD = !layer.threeD;
          });
        });

        // Motion Blur Switch
        const mbBtn = document.createElement('button');
        mbBtn.className = `tl-switch-btn${layer.motionBlur ? ' on mb' : ''}`;
        mbBtn.textContent = 'MB';
        mbBtn.title = '图层运动模糊开关 (配合合成运动模糊总开关生效)';
        mbBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.app.recordAction('切换图层运动模糊', () => {
            layer.motionBlur = !layer.motionBlur;
          });
        });

        // Parent Dropdown (Preserves World Transform!)
        const parentSel = document.createElement('select');
        parentSel.className = 'tl-mini-select parent-sel';
        parentSel.title = '父级绑定（切换时自动换算局部变换，保持当前画面不变）';
        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = '无父级';
        parentSel.appendChild(noneOpt);
        comp.layers.forEach((cand, cIdx) => {
          if (cand.id === layer.id || cand.type === 'audio' || cand.type === 'adjustment') return;
          if (Anim.wouldCreateParentCycle(comp, layer.id, cand.id)) return;
          const opt = document.createElement('option');
          opt.value = cand.id;
          opt.textContent = `${cIdx + 1}. ${cand.name.slice(0, 8)}`;
          parentSel.appendChild(opt);
        });
        parentSel.value = layer.parentId || '';
        parentSel.addEventListener('click', (e) => e.stopPropagation());
        parentSel.addEventListener('change', (e) => {
          e.stopPropagation();
          const newPid = parentSel.value || null;
          this.app.recordAction('设置父级图层', () => {
            Anim.setLayerParentPreservingWorld(comp, layer, newPid, this.app.currentTime, this.app.project);
          });
        });

        // Blend Mode Dropdown
        const blendSel = document.createElement('select');
        blendSel.className = 'tl-mini-select blend-sel';
        blendSel.title = '图层混合模式';
        [
          ['normal', '正常'],
          ['add', '相加'],
          ['screen', '滤色'],
          ['multiply', '正片叠底'],
          ['overlay', '叠加']
        ].forEach(([val, lbl]) => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = lbl;
          blendSel.appendChild(opt);
        });
        blendSel.value = layer.blendMode || 'normal';
        blendSel.addEventListener('click', (e) => e.stopPropagation());
        blendSel.addEventListener('change', (e) => {
          e.stopPropagation();
          this.app.recordAction('修改混合模式', () => {
            layer.blendMode = blendSel.value;
          });
        });

        // Track Matte Dropdown (`轨道遮罩`, uses layer idx - 1 above!)
        const matteSel = document.createElement('select');
        matteSel.className = 'tl-mini-select matte-sel';
        matteSel.title = '轨道遮罩（以正上方相邻图层作为 Alpha 或亮度遮罩）';
        [
          ['none', '无遮罩'],
          ['alpha', 'Alpha↑'],
          ['alpha_inv', '反Alpha↑'],
          ['luma', '亮度↑'],
          ['luma_inv', '反亮度↑']
        ].forEach(([val, lbl]) => {
          const opt = document.createElement('option');
          opt.value = val;
          opt.textContent = lbl;
          matteSel.appendChild(opt);
        });
        if (!layer.trackMatte || typeof layer.trackMatte !== 'object') {
          layer.trackMatte = { mode: typeof layer.trackMatte === 'string' ? layer.trackMatte : 'none', sourceLayerId: '' };
        }
        matteSel.value = layer.trackMatte.mode || 'none';
        matteSel.disabled = idx === 0 && !layer.trackMatte.sourceLayerId;
        matteSel.addEventListener('click', (e) => e.stopPropagation());
        matteSel.addEventListener('change', (e) => {
          e.stopPropagation();
          const mode = matteSel.value;
          this.app.recordAction('设置轨道遮罩', () => {
            if (!layer.trackMatte || typeof layer.trackMatte !== 'object') {
              layer.trackMatte = { mode, sourceLayerId: '' };
            } else {
              layer.trackMatte.mode = mode;
            }
            if (mode !== 'none' && !layer.trackMatte.sourceLayerId && idx > 0) {
              comp.layers[idx - 1].visible = false;
            }
          });
        });

        rowEl.append(tdBtn, mbBtn, parentSel, blendSel, matteSel);

        // Selection & Drag Reordering
        rowEl.addEventListener('click', (e) => {
          this.app.selectLayer(layer.id, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
        });

        rowEl.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(idx));
          rowEl.classList.add('dragging');
        });
        rowEl.addEventListener('dragend', () => rowEl.classList.remove('dragging'));
        rowEl.addEventListener('dragover', (e) => {
          e.preventDefault();
          rowEl.classList.add('drag-over');
        });
        rowEl.addEventListener('dragleave', () => rowEl.classList.remove('drag-over'));
        rowEl.addEventListener('drop', (e) => {
          e.preventDefault();
          rowEl.classList.remove('drag-over');
          const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (Number.isFinite(fromIdx) && fromIdx !== idx && comp.layers[fromIdx]) {
            this.app.recordAction('调整图层顺序', () => {
              const [moved] = comp.layers.splice(fromIdx, 1);
              comp.layers.splice(idx, 0, moved);
            });
          }
        });

        this.outlinerEl.appendChild(rowEl);
        curY += LAYER_ROW_H;

        // Expanded Properties
        if (expMode) {
          const props = collectLayerProperties(layer, expMode);
          for (const pItem of props) {
            const prop = pItem.prop;
            const isGraphActive = this.activeGraphTarget
              && this.activeGraphTarget.layerId === layer.id
              && this.activeGraphTarget.key === pItem.key;

            this.rowsCache.push({ kind: 'prop', y: curY, h: PROP_ROW_H, layer, propItem: pItem });

            const pRow = document.createElement('div');
            pRow.className = `tl-prop-row${isGraphActive ? ' graph-active' : ''}`;
            pRow.style.height = `${PROP_ROW_H}px`;
            pRow.dataset.layerId = layer.id;
            pRow.dataset.propKey = pItem.key;

            // Stopwatch
            const swBtn = document.createElement('button');
            swBtn.className = `tl-icon-btn stopwatch${prop.animated ? ' on' : ''}`;
            swBtn.title = '关键帧码表（开启后修改属性自动在当前时刻记录关键帧）';
            swBtn.textContent = '⏱';
            swBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.app.recordAction(`切换码表: ${pItem.label}`, () => {
                Anim.togglePropStopwatch(prop, this.app.currentTime);
                Particles.invalidateAllParticleCaches();
              });
            });

            const pName = document.createElement('span');
            pName.className = 'tl-prop-name';
            pName.textContent = pItem.label;
            pName.title = '点击选中属性（在曲线视图中编辑值曲线或速度曲线）';

            pRow.append(swBtn, pName);

            if (prop.expressionEnabled && prop.expression) {
              const fxTag = document.createElement('span');
              fxTag.className = `tl-fx-badge${prop._exprError ? ' err' : ''}`;
              fxTag.textContent = prop._exprError ? 'fx!' : 'fx';
              fxTag.title = prop._exprError ? `表达式错误: ${prop._exprError}` : `表达式: ${prop.expression}`;
              pRow.appendChild(fxTag);
            }

            const valSpan = document.createElement('span');
            valSpan.className = 'tl-prop-val';
            valSpan.dataset.propReadout = `${layer.id}::${pItem.key}`;
            valSpan.textContent = this.formatValueCompact(prop, t, layer, comp);
            pRow.appendChild(valSpan);

            // Keyframe prev / toggle / next
            const kfNav = document.createElement('div');
            kfNav.className = 'tl-kf-nav';

            const prevBtn = document.createElement('button');
            prevBtn.textContent = '‹';
            prevBtn.title = '上一关键帧';
            prevBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (!prop.animated || !prop.keyframes?.length) return;
              const prev = [...prop.keyframes].reverse().find((k) => k.time < this.app.currentTime - 1e-4);
              if (prev) this.app.setTime(prev.time);
            });

            const hasKfNow = prop.animated && (prop.keyframes || []).some((k) => Math.abs(k.time - t) < 1e-3);
            const addKfBtn = document.createElement('button');
            addKfBtn.className = hasKfNow ? 'on' : '';
            addKfBtn.textContent = '◆';
            addKfBtn.title = hasKfNow ? '删除当前时刻关键帧' : '在当前时刻添加关键帧';
            addKfBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.app.recordAction(`关键帧: ${pItem.label}`, () => {
                const nowT = this.app.currentTime;
                if (!prop.animated) {
                  Anim.togglePropStopwatch(prop, nowT);
                } else {
                  const idxKf = prop.keyframes.findIndex((k) => Math.abs(k.time - nowT) < 1e-3);
                  if (idxKf >= 0 && prop.keyframes.length > 1) {
                    prop.keyframes.splice(idxKf, 1);
                  } else if (idxKf < 0) {
                    const curV = Anim.evalKeyframesAtTime(prop, nowT);
                    Anim.setPropValueAtTime(prop, curV, nowT);
                  }
                }
                Particles.invalidateAllParticleCaches();
              });
            });

            const nextBtn = document.createElement('button');
            nextBtn.textContent = '›';
            nextBtn.title = '下一关键帧';
            nextBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (!prop.animated || !prop.keyframes?.length) return;
              const next = prop.keyframes.find((k) => k.time > this.app.currentTime + 1e-4);
              if (next) this.app.setTime(next.time);
            });

            kfNav.append(prevBtn, addKfBtn, nextBtn);
            pRow.appendChild(kfNav);

            pRow.addEventListener('click', (e) => {
              e.stopPropagation();
              this.activeGraphTarget = { layerId: layer.id, key: pItem.key, label: `${layer.name} · ${pItem.label}`, prop };
              this.graphViewBounds = null;
              if (!this.app.selectedLayerIds.has(layer.id)) {
                this.app.selectLayer(layer.id, { toggle: false });
              } else {
                this.rebuildOutliner();
                this.renderCanvas();
              }
            });

            this.outlinerEl.appendChild(pRow);
            curY += PROP_ROW_H;
          }
        }
      });

      // Clicking blank space inside outliner clears layer selection (`无选择`)
      const spacer = document.createElement('div');
      spacer.style.height = '48px';
      spacer.addEventListener('click', () => {
        this.app.clearLayerSelection();
      });
      this.outlinerEl.appendChild(spacer);
    }

    // Fast update of live property value readouts during playback / scrubbing without rebuilding DOM!
    updateLiveReadouts() {
      const comp = this.app.getActiveComp();
      if (!comp || !this.outlinerEl) return;
      const t = this.app.currentTime;
      for (const row of this.rowsCache) {
        if (row.kind !== 'prop') continue;
        const key = `${row.layer.id}::${row.propItem.key}`;
        const el = this.outlinerEl.querySelector(`[data-prop-readout="${CSS.escape(key)}"]`);
        if (el) {
          el.textContent = this.formatValueCompact(row.propItem.prop, t, row.layer, comp);
        }
      }
    }

    // =========================================================================
    // CANVAS RENDERING (Ruler + Track Dope Sheet OR Graph Editor)
    // =========================================================================
    render() {
      this.rebuildOutliner();
      this.renderCanvas();
    }

    renderCanvas() {
      if (!this.canvas || !this.canvasWrapEl) return;
      const rect = this.canvasWrapEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(100, Math.floor(rect.width));
      const h = Math.max(80, Math.floor(rect.height));

      if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
      }

      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const comp = this.app.getActiveComp();
      if (!comp) {
        ctx.fillStyle = '#0d1017';
        ctx.fillRect(0, 0, w, h);
        return;
      }

      this._drawTimeRuler(ctx, comp, w, h);

      if (this.mode === 'graph') {
        this._drawGraphEditor(ctx, comp, w, h);
      } else {
        this._drawTrackDopeSheet(ctx, comp, w, h);
      }

      this._drawPlayhead(ctx, comp, w, h);
    }

    _drawTimeRuler(ctx, comp, w, h) {
      ctx.fillStyle = '#141923';
      ctx.fillRect(0, 0, w, RULER_H);
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.beginPath();
      ctx.moveTo(0, RULER_H - 0.5);
      ctx.lineTo(w, RULER_H - 0.5);
      ctx.stroke();

      // Work Area (`工作区` B..N)
      const ws = comp.workStart ?? 0;
      const we = comp.workEnd ?? comp.duration;
      const wx0 = clamp(this.timeToX(ws, w), 0, w);
      const wx1 = clamp(this.timeToX(we, w), 0, w);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fillRect(wx0, RULER_H - 9, Math.max(2, wx1 - wx0), 9);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(wx0 + 0.5, RULER_H - 8.5, Math.max(2, wx1 - wx0 - 1), 8);
      // Left/Right Work Area Bracket Handles
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(wx0, RULER_H - 11, 5, 11);
      ctx.fillRect(Math.max(0, wx1 - 5), RULER_H - 11, 5, 11);

      // Adaptive Time Ticks
      const span = Math.max(0.05, this.timeViewEnd - this.timeViewStart);
      const approxSecPerTick = (span * 80) / Math.max(100, w);
      const steps = [1 / (comp.fps || 30), 0.1, 0.25, 0.5, 1, 2, 5, 10];
      let majorStep = steps.find((s) => s >= approxSecPerTick) || 10;
      const minorStep = majorStep / 5;

      const tStart = Math.floor(this.timeViewStart / minorStep) * minorStep;
      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      ctx.textBaseline = 'top';

      for (let t = tStart; t <= this.timeViewEnd + minorStep; t += minorStep) {
        if (t < -1e-5 || t > comp.duration + 1e-4) continue;
        const x = Math.round(this.timeToX(t, w)) + 0.5;
        const isMajor = Math.abs(t / majorStep - Math.round(t / majorStep)) < 1e-3;
        ctx.strokeStyle = isMajor ? 'rgba(226, 232, 240, 0.42)' : 'rgba(148, 163, 184, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, isMajor ? 5 : 14);
        ctx.lineTo(x, RULER_H - 10);
        ctx.stroke();

        if (isMajor) {
          ctx.fillStyle = '#cbd5e1';
          const lbl = majorStep < 0.5 ? `${t.toFixed(2)}s` : `${t.toFixed(t % 1 === 0 ? 0 : 1)}s`;
          ctx.fillText(lbl, x + 4, 4);
        }
      }
    }

    _drawPlayhead(ctx, comp, w, h) {
      const px = this.timeToX(this.app.currentTime, w);
      if (px < -10 || px > w + 10) return;

      ctx.save();
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, 8);
      ctx.lineTo(px, h);
      ctx.stroke();

      // Playhead cap
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.moveTo(px - 6.5, 1);
      ctx.lineTo(px + 6.5, 1);
      ctx.lineTo(px + 6.5, 9);
      ctx.lineTo(px, 15);
      ctx.lineTo(px - 6.5, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // TRACK DOPE SHEET RENDERER
    // =========================================================================
    _drawTrackDopeSheet(ctx, comp, w, h) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, RULER_H, w, h - RULER_H);
      ctx.clip();

      // Shade outside work area subtly
      const wx0 = this.timeToX(comp.workStart ?? 0, w);
      const wx1 = this.timeToX(comp.workEnd ?? comp.duration, w);
      ctx.fillStyle = '#0c0f16';
      ctx.fillRect(0, RULER_H, w, h - RULER_H);
      if (wx0 > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fillRect(0, RULER_H, wx0, h - RULER_H);
      }
      if (wx1 < w) {
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fillRect(wx1, RULER_H, w - wx1, h - RULER_H);
      }

      // Vertical second grid lines
      const span = Math.max(0.05, this.timeViewEnd - this.timeViewStart);
      const gridStep = span > 8 ? 1 : span > 3 ? 0.5 : 0.25;
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let t = Math.floor(this.timeViewStart / gridStep) * gridStep; t <= this.timeViewEnd; t += gridStep) {
        const x = Math.round(this.timeToX(t, w)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, RULER_H);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      let selMinT = Infinity;
      let selMaxT = -Infinity;
      let selKfCount = 0;

      for (const row of this.rowsCache) {
        const ry = RULER_H + row.y - this.scrollY;
        if (ry + row.h < RULER_H || ry > h) continue;

        const isSelLayer = this.app.selectedLayerIds.has(row.layer.id);

        if (row.kind === 'layer') {
          ctx.fillStyle = isSelLayer ? 'rgba(56, 189, 248, 0.08)' : (row.index % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent');
          ctx.fillRect(0, ry, w, row.h);

          // Layer Clip Bar (`inPoint` .. `outPoint`)
          const inT = row.layer.inPoint ?? 0;
          const outT = row.layer.outPoint ?? comp.duration;
          const bx0 = this.timeToX(inT, w);
          const bx1 = this.timeToX(outT, w);
          const bw = Math.max(4, bx1 - bx0);
          const badge = TYPE_BADGES[row.layer.type] || { color: '#64748b' };

          ctx.fillStyle = row.layer.visible === false ? 'rgba(100,116,139,0.22)' : `${badge.color}44`;
          ctx.strokeStyle = isSelLayer ? '#f8fafc' : `${badge.color}bb`;
          ctx.lineWidth = isSelLayer ? 1.4 : 1;
          ctx.beginPath();
          ctx.roundRect(bx0, ry + 4, bw, row.h - 8, 3);
          ctx.fill();
          ctx.stroke();

          // Trim handles on left & right edge of bar
          ctx.fillStyle = badge.color;
          ctx.fillRect(bx0, ry + 4, 3, row.h - 8);
          ctx.fillRect(Math.max(bx0, bx1 - 3), ry + 4, 3, row.h - 8);

          // Audio Waveform Envelope inside audio track bars!
          if (row.layer.type === 'audio' && AudioMod?.engine) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(bx0 + 3, ry + 5, Math.max(0, bw - 6), row.h - 10);
            ctx.clip();
            ctx.strokeStyle = '#34d399';
            ctx.fillStyle = 'rgba(52, 211, 153, 0.32)';
            const samples = Math.min(180, Math.max(24, Math.floor(bw / 4)));
            const midY = ry + row.h * 0.5;
            ctx.beginPath();
            ctx.moveTo(bx0, midY);
            for (let s = 0; s <= samples; s++) {
              const st = lerp(inT, outT, s / samples);
              const amp = AudioMod.engine.sampleVisualAudioLevel(comp, st, this.app.project).layerLevels[row.layer.id] || 0;
              const sx = bx0 + (s / samples) * bw;
              ctx.lineTo(sx, midY - amp * (row.h * 0.36));
            }
            ctx.lineTo(bx1, midY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // Summary keyframe ticks when collapsed
          if (!this.expandedLayers.has(row.layer.id)) {
            const animProps = collectLayerProperties(row.layer, 'animated');
            const seenTimes = new Set();
            ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
            for (const ap of animProps) {
              for (const kf of (ap.prop.keyframes || [])) {
                const bucket = Math.round(kf.time * 100);
                if (seenTimes.has(bucket)) continue;
                seenTimes.add(bucket);
                const kx = this.timeToX(kf.time, w);
                ctx.fillRect(kx - 1.5, ry + row.h * 0.5 - 2, 3, 4);
              }
            }
          }
        } else if (row.kind === 'prop') {
          ctx.fillStyle = 'rgba(15, 20, 30, 0.82)';
          ctx.fillRect(0, ry, w, row.h);

          const prop = row.propItem.prop;
          if (prop.animated && prop.keyframes) {
            const cy = ry + row.h * 0.5;
            // Subtle connecting span line between first and last keyframe
            if (prop.keyframes.length >= 2) {
              const kxFirst = this.timeToX(prop.keyframes[0].time, w);
              const kxLast = this.timeToX(prop.keyframes[prop.keyframes.length - 1].time, w);
              ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(kxFirst, cy);
              ctx.lineTo(kxLast, cy);
              ctx.stroke();
            }

            for (const kf of prop.keyframes) {
              const kx = this.timeToX(kf.time, w);
              const kfKey = `${row.layer.id}::${row.propItem.key}::${kf.id}`;
              const isKfSel = this.selectedKeyframes.has(kfKey);
              if (isKfSel) {
                selMinT = Math.min(selMinT, kf.time);
                selMaxT = Math.max(selMaxT, kf.time);
                selKfCount++;
              }
              this._drawKeyframeGlyph(ctx, kx, cy, kf, isKfSel);
            }
          }
        }

        // Row bottom border
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ry + row.h + 0.5);
        ctx.lineTo(w, ry + row.h + 0.5);
        ctx.stroke();
      }

      // Proportional Time-Stretch Span Bar when >= 2 keyframes spanning > 0s are selected! (Section 2.3)
      if (selKfCount >= 2 && selMaxT - selMinT > 1e-4) {
        const sx0 = this.timeToX(selMinT, w);
        const sx1 = this.timeToX(selMaxT, w);
        const barY = RULER_H + 3;
        ctx.save();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.4;
        ctx.fillRect(sx0, barY, sx1 - sx0, 14);
        ctx.strokeRect(sx0, barY, sx1 - sx0, 14);
        // Stretch handles on both ends
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(sx0 - 4, barY - 1, 7, 16);
        ctx.fillRect(sx1 - 3, barY - 1, 7, 16);
        if (sx1 - sx0 > 84) {
          ctx.fillStyle = '#fef3c7';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText('⇄ 拖两端按比例拉伸时间', sx0 + 10, barY + 2);
        }
        ctx.restore();
        this._stretchSpanCache = { minT: selMinT, maxT: selMaxT, sx0, sx1, barY };
      } else {
        this._stretchSpanCache = null;
      }

      // Marquee Box-Select overlay
      if (this.marqueeRect) {
        const m = this.marqueeRect;
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.fillRect(m.x, m.y, m.w, m.h);
        ctx.strokeRect(m.x, m.y, m.w, m.h);
        ctx.restore();
      }

      ctx.restore();
    }

    _drawKeyframeGlyph(ctx, x, y, kf, selected) {
      const r = selected ? 5.6 : 4.6;
      const inT = kf.inType || 'linear';
      const outT = kf.outType || 'linear';

      ctx.save();
      ctx.fillStyle = selected ? '#fbbf24' : '#38bdf8';
      ctx.strokeStyle = selected ? '#fef08a' : '#0f172a';
      ctx.lineWidth = 1.2;

      if (inT === 'hold' || outT === 'hold') {
        // Hold square (`定格`)
        ctx.beginPath();
        ctx.rect(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64);
        ctx.fill();
        ctx.stroke();
      } else if (inT === 'bezier' && outT === 'bezier') {
        // Hourglass / Smooth Circle (`缓入缓出贝塞尔`)
        ctx.beginPath();
        ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (inT !== outT) {
        // Split half-diamond / half-circle (`进入与离开分别设置`)
        ctx.beginPath();
        if (inT === 'bezier') {
          ctx.arc(x, y, r * 0.92, Math.PI * 0.5, Math.PI * 1.5);
        } else {
          ctx.moveTo(x, y - r);
          ctx.lineTo(x - r, y);
          ctx.lineTo(x, y + r);
        }
        if (outT === 'bezier') {
          ctx.arc(x, y, r * 0.92, -Math.PI * 0.5, Math.PI * 0.5);
        } else {
          ctx.lineTo(x + r, y);
          ctx.lineTo(x, y - r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Classic AE Linear Diamond (`◆`)
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // =========================================================================
    // CURVE EDITOR (`曲线视图`: Value Graph + Speed Graph + Expression Curve!)
    // =========================================================================
    _resolveActiveGraphTarget(comp) {
      if (this.activeGraphTarget) {
        const l = comp.layers.find((x) => x.id === this.activeGraphTarget.layerId);
        if (l) {
          const allP = collectLayerProperties(l, 'all');
          const match = allP.find((p) => p.key === this.activeGraphTarget.key);
          if (match) {
            this.activeGraphTarget.prop = match.prop;
            return { layer: l, propItem: match };
          }
        }
      }
      // Auto-pick from selected layer (or first animated property in comp)
      const candidates = this.app.selectedLayerIds.size > 0
        ? comp.layers.filter((l) => this.app.selectedLayerIds.has(l.id))
        : comp.layers;
      for (const l of candidates) {
        const anims = collectLayerProperties(l, 'animated');
        if (anims.length > 0) {
          const p0 = anims[0];
          this.activeGraphTarget = { layerId: l.id, key: p0.key, label: `${l.name} · ${p0.label}`, prop: p0.prop };
          return { layer: l, propItem: p0 };
        }
      }
      if (candidates[0]) {
        const all = collectLayerProperties(candidates[0], 'all');
        if (all[0]) {
          this.activeGraphTarget = { layerId: candidates[0].id, key: all[0].key, label: `${candidates[0].name} · ${all[0].label}`, prop: all[0].prop };
          return { layer: candidates[0], propItem: all[0] };
        }
      }
      return null;
    }

    _computeGraphBounds(target, comp) {
      const { layer, propItem } = target;
      const prop = propItem.prop;
      const samples = 140;
      let minV = Infinity;
      let maxV = -Infinity;

      const consider = (v) => {
        if (Array.isArray(v)) {
          const dims = (prop.type === 'vec3' && !layer.threeD) ? 2 : v.length;
          for (let k = 0; k < dims; k++) {
            if (Number.isFinite(v[k])) { minV = Math.min(minV, v[k]); maxV = Math.max(maxV, v[k]); }
          }
        } else if (Number.isFinite(v)) {
          minV = Math.min(minV, v);
          maxV = Math.max(maxV, v);
        }
      };

      for (let i = 0; i <= samples; i++) {
        const st = lerp(this.timeViewStart, this.timeViewEnd, i / samples);
        if (this.graphType === 'speed') {
          if (prop.expressionEnabled && prop.expression) {
            const dt = 1 / 120;
            const v0 = Anim.evalProp(prop, Math.max(0, st - dt), { project: this.app.project, comp, layer, propKey: propItem.key });
            const v1 = Anim.evalProp(prop, st + dt, { project: this.app.project, comp, layer, propKey: propItem.key });
            if (Array.isArray(v0) && Array.isArray(v1)) {
              let sq = 0;
              for (let k = 0; k < v0.length; k++) sq += (v1[k] - v0[k]) ** 2;
              consider(Math.sqrt(sq) / (2 * dt));
            } else {
              consider(Math.abs(Number(v1) - Number(v0)) / (2 * dt));
            }
          } else {
            consider(Anim.getPropSpeedAtTime(prop, st));
          }
        } else {
          consider(Anim.evalProp(prop, st, { project: this.app.project, comp, layer, propKey: propItem.key }));
          if (prop.animated) consider(Anim.evalKeyframesAtTime(prop, st));
        }
      }

      if (!Number.isFinite(minV) || !Number.isFinite(maxV)) { minV = -10; maxV = 110; }
      if (this.graphType === 'speed') minV = Math.min(0, minV);
      const span = Math.max(10, maxV - minV);
      return { minV: minV - span * 0.18, maxV: maxV + span * 0.18 };
    }

    _drawGraphEditor(ctx, comp, w, h) {
      const plotTop = RULER_H + 8;
      const plotBottom = h - 10;
      const plotH = Math.max(40, plotBottom - plotTop);

      ctx.save();
      ctx.fillStyle = '#0a0d14';
      ctx.fillRect(0, RULER_H, w, h - RULER_H);

      const target = this._resolveActiveGraphTarget(comp);
      if (!target || target.propItem.prop.type === 'path' || target.propItem.prop.type === 'shape') {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('请在左侧大纲展开图层并点击一个数值/向量属性以编辑值曲线或速度曲线', 24, RULER_H + 36);
        ctx.restore();
        return;
      }

      const { layer, propItem } = target;
      const prop = propItem.prop;
      if (!this.graphViewBounds) {
        this.graphViewBounds = this._computeGraphBounds(target, comp);
      }
      const { minV, maxV } = this.graphViewBounds;
      const valToY = (v) => plotBottom - ((v - minV) / Math.max(1e-5, maxV - minV)) * plotH;

      // Horizontal value/speed grid lines
      const yTicks = 5;
      ctx.font = '10px "JetBrains Mono", Consolas, monospace';
      for (let i = 0; i <= yTicks; i++) {
        const fv = lerp(minV, maxV, i / yTicks);
        const gy = Math.round(valToY(fv)) + 0.5;
        ctx.strokeStyle = Math.abs(fv) < (maxV - minV) * 0.02 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
        ctx.fillText(this.graphType === 'speed' ? `${fv.toFixed(0)}/s` : fv.toFixed(1), 6, gy - 12);
      }

      const samples = Math.min(360, Math.max(120, Math.floor(w / 2.5)));
      const hasExpr = Boolean(prop.expressionEnabled && prop.expression && prop.expression.trim() && !prop._exprError);
      this._graphHandleHits = [];

      if (this.graphType === 'speed') {
        // SPEED GRAPH (`速度曲线` — Position uses true arc-length motion path speed!)
        ctx.strokeStyle = hasExpr ? 'rgba(56, 189, 248, 0.35)' : '#22d3ee';
        ctx.lineWidth = hasExpr ? 1.4 : 2.1;
        if (hasExpr) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        for (let s = 0; s <= samples; s++) {
          const st = lerp(this.timeViewStart, this.timeViewEnd, s / samples);
          const sx = this.timeToX(st, w);
          const spd = Anim.getPropSpeedAtTime(prop, st);
          const sy = valToY(spd);
          if (s === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // If Expression is active, draw final evaluated expression speed curve solidly!
        if (hasExpr) {
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          const dt = 1 / 120;
          for (let s = 0; s <= samples; s++) {
            const st = lerp(this.timeViewStart, this.timeViewEnd, s / samples);
            const v0 = Anim.evalProp(prop, Math.max(0, st - dt), { project: this.app.project, comp, layer, propKey: propItem.key });
            const v1 = Anim.evalProp(prop, st + dt, { project: this.app.project, comp, layer, propKey: propItem.key });
            let spd = 0;
            if (Array.isArray(v0) && Array.isArray(v1)) {
              let sq = 0;
              for (let k = 0; k < v0.length; k++) sq += (v1[k] - v0[k]) ** 2;
              spd = Math.sqrt(sq) / (2 * dt);
            } else {
              spd = Math.abs(Number(v1) - Number(v0)) / (2 * dt);
            }
            const sx = this.timeToX(st, w);
            const sy = valToY(spd);
            if (s === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }

        // Draw Speed Keyframe Handles (`influence` + `speed`)
        if (prop.animated && prop.keyframes && prop.keyframes.length >= 2) {
          const kfs = prop.keyframes;
          for (let i = 0; i < kfs.length; i++) {
            const kf = kfs[i];
            const kx = this.timeToX(kf.time, w);
            const spdAtKf = Anim.getPropSpeedAtTime(prop, kf.time);
            const ky = valToY(spdAtKf);

            // Outgoing speed/influence handle
            if (i < kfs.length - 1 && (kf.outType || 'linear') === 'bezier') {
              const nextKf = kfs[i + 1];
              const dtSpan = Math.max(1e-4, nextKf.time - kf.time);
              const inf = clamp(kf.outInfluence ?? 33.33, 5, 95) / 100;
              const segAvgSpd = prop.isSpatial
                ? Anim.getSpatialSegmentLUT(kf, nextKf).totalLength / dtSpan
                : Anim.getPropSpeedAtTime(prop, (kf.time + nextKf.time) * 0.5);
              const outSpd = kf.outSpeed ?? 0;
              const hx = this.timeToX(kf.time + dtSpan * inf, w);
              const hy = valToY(outSpd);

              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 1.3;
              ctx.beginPath(); ctx.moveTo(kx, valToY(outSpd)); ctx.lineTo(hx, hy); ctx.stroke();
              ctx.fillStyle = '#fbbf24';
              ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fill();
              this._graphHandleHits.push({ kind: 'speedOut', kf, nextKf, segAvgSpd, x: hx, y: hy, prop, layer });
            }

            // Incoming speed/influence handle
            if (i > 0 && (kf.inType || 'linear') === 'bezier') {
              const prevKf = kfs[i - 1];
              const dtSpan = Math.max(1e-4, kf.time - prevKf.time);
              const inf = clamp(kf.inInfluence ?? 33.33, 5, 95) / 100;
              const inSpd = kf.inSpeed ?? 0;
              const hx = this.timeToX(kf.time - dtSpan * inf, w);
              const hy = valToY(inSpd);

              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 1.3;
              ctx.beginPath(); ctx.moveTo(kx, valToY(inSpd)); ctx.lineTo(hx, hy); ctx.stroke();
              ctx.fillStyle = '#fbbf24';
              ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fill();
              this._graphHandleHits.push({ kind: 'speedIn', kf, prevKf, x: hx, y: hy, prop, layer });
            }

            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(kx - 4, ky - 4, 8, 8);
            this._graphHandleHits.push({ kind: 'kfTime', kf, x: kx, y: ky, prop, layer });
          }
        }
      } else {
        // VALUE GRAPH (`值曲线` + `表达式最终求值曲线`)
        const colors = prop.type === 'scalar' ? ['#38bdf8'] : ['#f87171', '#4ade80', '#60a5fa'];
        const sampleVal = Anim.evalProp(prop, this.app.currentTime, { project: this.app.project, comp, layer, propKey: propItem.key });
        const dimCount = Array.isArray(sampleVal)
          ? ((prop.type === 'vec3' && !layer.threeD) ? 2 : sampleVal.length)
          : 1;

        // 1. Keyframe curve (dashed if overridden/combined with Expression)
        for (let d = 0; d < dimCount; d++) {
          ctx.strokeStyle = colors[d % colors.length];
          ctx.globalAlpha = hasExpr ? 0.35 : 0.95;
          ctx.lineWidth = hasExpr ? 1.3 : 2.0;
          if (hasExpr) ctx.setLineDash([4, 3]);
          ctx.beginPath();
          for (let s = 0; s <= samples; s++) {
            const st = lerp(this.timeViewStart, this.timeViewEnd, s / samples);
            const kv = Anim.evalKeyframesAtTime(prop, st);
            const num = Array.isArray(kv) ? kv[d] : kv;
            const sx = this.timeToX(st, w);
            const sy = valToY(num);
            if (s === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1.0;
        }

        // 2. Final Expression-Evaluated Curve (`曲线视图显示表达式属性的最终求值曲线` — Section 2.4)
        if (hasExpr) {
          for (let d = 0; d < dimCount; d++) {
            ctx.strokeStyle = dimCount === 1 ? '#f472b6' : colors[d % colors.length];
            ctx.lineWidth = 2.3;
            ctx.beginPath();
            for (let s = 0; s <= samples; s++) {
              const st = lerp(this.timeViewStart, this.timeViewEnd, s / samples);
              const ev = Anim.evalProp(prop, st, { project: this.app.project, comp, layer, propKey: propItem.key });
              const num = Array.isArray(ev) ? ev[d] : ev;
              const sx = this.timeToX(st, w);
              const sy = valToY(num);
              if (s === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
          }
        }

        // 3. Keyframe knots & Value-Graph Bezier Handles
        if (prop.animated && prop.keyframes) {
          const kfs = prop.keyframes;
          for (let i = 0; i < kfs.length; i++) {
            const kf = kfs[i];
            const kx = this.timeToX(kf.time, w);

            for (let d = 0; d < dimCount; d++) {
              const kvNum = Array.isArray(kf.value) ? kf.value[d] : kf.value;
              const ky = valToY(kvNum);
              const col = colors[d % colors.length];

              // Outgoing Bezier Handle
              if (i < kfs.length - 1 && (kf.outType || 'linear') === 'bezier') {
                const nextKf = kfs[i + 1];
                const dtSpan = Math.max(1e-4, nextKf.time - kf.time);
                const inf = clamp(kf.outInfluence ?? 33.33, 5, 95) / 100;
                const vOff = Array.isArray(kf.outValueOffset) ? (kf.outValueOffset[d] || 0) : (kf.outValueOffset || 0);
                const hx = this.timeToX(kf.time + dtSpan * inf, w);
                const hy = valToY(kvNum + vOff);

                ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
                this._graphHandleHits.push({ kind: 'valOut', kf, nextKf, dim: d, x: hx, y: hy, prop, layer });
              }

              // Incoming Bezier Handle
              if (i > 0 && (kf.inType || 'linear') === 'bezier') {
                const prevKf = kfs[i - 1];
                const dtSpan = Math.max(1e-4, kf.time - prevKf.time);
                const inf = clamp(kf.inInfluence ?? 33.33, 5, 95) / 100;
                const vOff = Array.isArray(kf.inValueOffset) ? (kf.inValueOffset[d] || 0) : (kf.inValueOffset || 0);
                const hx = this.timeToX(kf.time - dtSpan * inf, w);
                const hy = valToY(kvNum + vOff);

                ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
                ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
                this._graphHandleHits.push({ kind: 'valIn', kf, prevKf, dim: d, x: hx, y: hy, prop, layer });
              }

              ctx.fillStyle = col;
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 1.3;
              ctx.fillRect(kx - 4.2, ky - 4.2, 8.4, 8.4);
              ctx.strokeRect(kx - 4.2, ky - 4.2, 8.4, 8.4);
              this._graphHandleHits.push({ kind: 'valKnot', kf, dim: d, x: kx, y: ky, prop, layer });
            }
          }
        }
      }

      // Header legend overlay inside Graph Editor
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.fillRect(w - 310, RULER_H + 6, 302, 24);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px system-ui, sans-serif';
      const modeName = this.graphType === 'speed'
        ? (prop.isSpatial ? '运动路径实际速度曲线' : '速度曲线')
        : '值曲线';
      const exprBadge = hasExpr ? ' · [含 fx 最终求值]' : '';
      ctx.fillText(`${layer.name} › ${propItem.label} (${modeName}${exprBadge})`, w - 302, RULER_H + 13);

      ctx.restore();
    }

    // =========================================================================
    // KEYFRAME OPERATIONS (Interpolation, Easy Ease F9, Copy/Paste, Delete)
    // =========================================================================
    _forEachSelectedKeyframe(comp, callback) {
      if (!comp) return 0;
      let count = 0;
      for (const row of this.rowsCache) {
        if (row.kind !== 'prop' || !row.propItem.prop.animated) continue;
        for (const kf of (row.propItem.prop.keyframes || [])) {
          const kKey = `${row.layer.id}::${row.propItem.key}::${kf.id}`;
          if (this.selectedKeyframes.has(kKey)) {
            callback(kf, row.propItem.prop, row.layer, row.propItem.key);
            count++;
          }
        }
      }
      return count;
    }

    applyEasyEaseSelected() {
      const comp = this.app.getActiveComp();
      if (!comp) return;
      if (this.selectedKeyframes.size === 0) {
        // If no keyframe explicitly selected, apply F9 to all keyframes of activeGraphTarget or selected layers' expanded animated props
        const selLayers = comp.layers.filter((l) => this.app.selectedLayerIds.has(l.id));
        if (selLayers.length === 0) return;
        this.app.recordAction('缓入缓出 (F9)', () => {
          for (const l of selLayers) {
            for (const p of collectLayerProperties(l, 'animated')) {
              const ids = (p.prop.keyframes || []).map((k) => k.id);
              Anim.applyEasyEase(p.prop, ids);
            }
          }
          Particles.invalidateAllParticleCaches();
        });
        return;
      }

      this.app.recordAction('缓入缓出 (F9)', () => {
        const byProp = new Map();
        this._forEachSelectedKeyframe(comp, (kf, prop) => {
          if (!byProp.has(prop)) byProp.set(prop, []);
          byProp.get(prop).push(kf.id);
        });
        for (const [prop, ids] of byProp.entries()) {
          Anim.applyEasyEase(prop, ids);
        }
        Particles.invalidateAllParticleCaches();
      });
    }

    setSelectedKeyframeInterp(which, interpType) {
      // which: 'both' | 'in' | 'out', interpType: 'linear' | 'bezier' | 'hold'
      const comp = this.app.getActiveComp();
      if (!comp || this.selectedKeyframes.size === 0) return;
      this.app.recordAction('设置关键帧时间插值', () => {
        this._forEachSelectedKeyframe(comp, (kf) => {
          if (which === 'both' || which === 'in') kf.inType = interpType;
          if (which === 'both' || which === 'out') kf.outType = interpType;
        });
        Particles.invalidateAllParticleCaches();
      });
    }

    deleteSelectedKeyframes() {
      const comp = this.app.getActiveComp();
      if (!comp || this.selectedKeyframes.size === 0) return false;
      this.app.recordAction('删除关键帧', () => {
        for (const row of this.rowsCache) {
          if (row.kind !== 'prop' || !row.propItem.prop.animated) continue;
          const prop = row.propItem.prop;
          prop.keyframes = prop.keyframes.filter((kf) => {
            const kKey = `${row.layer.id}::${row.propItem.key}::${kf.id}`;
            return !this.selectedKeyframes.has(kKey);
          });
          if (prop.keyframes.length === 0) prop.animated = false;
        }
        this.selectedKeyframes.clear();
        Particles.invalidateAllParticleCaches();
      });
      return true;
    }

    copySelectedKeyframes() {
      const comp = this.app.getActiveComp();
      if (!comp || this.selectedKeyframes.size === 0) return false;
      const copied = [];
      let minT = Infinity;
      this._forEachSelectedKeyframe(comp, (kf, prop, layer, propKey) => {
        minT = Math.min(minT, kf.time);
        copied.push({ propKey, layerId: layer.id, kf: JSON.parse(JSON.stringify(kf)) });
      });
      for (const item of copied) item.relTime = item.kf.time - minT;
      this.keyframeClipboard = copied;
      return copied.length > 0;
    }

    pasteKeyframesAtPlayhead() {
      const comp = this.app.getActiveComp();
      if (!comp || !this.keyframeClipboard || this.keyframeClipboard.length === 0) return false;
      const baseT = this.app.currentTime;
      this.app.recordAction('粘贴关键帧', () => {
        this.selectedKeyframes.clear();
        const targetLayer = comp.layers.find((l) => this.app.selectedLayerIds.has(l.id));
        for (const clip of this.keyframeClipboard) {
          const dstLayer = targetLayer || comp.layers.find((l) => l.id === clip.layerId);
          if (!dstLayer) continue;
          const allP = collectLayerProperties(dstLayer, 'all');
          const match = allP.find((p) => p.key === clip.propKey);
          if (!match) continue;
          const prop = match.prop;
          if (!prop.animated) {
            prop.animated = true;
            prop.keyframes = [];
          }
          const newTime = clamp(baseT + clip.relTime, 0, comp.duration);
          // Replace existing keyframe at exact timestamp or push cloned keyframe
          const existIdx = prop.keyframes.findIndex((k) => Math.abs(k.time - newTime) < 1e-4);
          const cloned = JSON.parse(JSON.stringify(clip.kf));
          cloned.id = uid('kf');
          cloned.time = newTime;
          if (existIdx >= 0) prop.keyframes[existIdx] = cloned;
          else prop.keyframes.push(cloned);
          Anim.sortKeyframes(prop);
          if (prop.isSpatial) Anim.recomputeSmoothSpatialTangents(prop);
          this.selectedKeyframes.add(`${dstLayer.id}::${match.key}::${cloned.id}`);
        }
        Particles.invalidateAllParticleCaches();
      });
      return true;
    }

    // =========================================================================
    // INTERACTIVE EVENTS (Scroll sync, Zoom, Scrubbing, Dragging, Stretching)
    // =========================================================================
    _bindEvents() {
      if (this.outlinerEl) {
        this.outlinerEl.addEventListener('scroll', () => {
          this.scrollY = this.outlinerEl.scrollTop;
          this.renderCanvas();
        });
      }

      if (!this.canvas) return;

      this.canvas.addEventListener('wheel', (e) => {
        const comp = this.app.getActiveComp();
        if (!comp) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;

        if (e.ctrlKey || e.altKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.clientY - rect.top < RULER_H) {
          // Zoom timeline horizontally around cursor time
          const anchorT = this.xToTime(mx, rect.width);
          const factor = e.deltaY < 0 ? 0.82 : 1.22;
          const curSpan = this.timeViewEnd - this.timeViewStart;
          const newSpan = clamp(curSpan * factor, 0.4, Math.max(2, comp.duration));
          const ratio = clamp(mx / Math.max(1, rect.width), 0, 1);
          let ns = anchorT - ratio * newSpan;
          let ne = ns + newSpan;
          if (ns < 0) { ne -= ns; ns = 0; }
          if (ne > comp.duration) { ns = Math.max(0, ns - (ne - comp.duration)); ne = comp.duration; }
          this.timeViewStart = ns;
          this.timeViewEnd = ne;
          this.graphViewBounds = null;
          this.renderCanvas();
        } else if (this.mode === 'tracks' && this.outlinerEl) {
          this.outlinerEl.scrollTop += e.deltaY;
          this.scrollY = this.outlinerEl.scrollTop;
          this.renderCanvas();
        }
      }, { passive: false });

      this.canvas.addEventListener('pointerdown', (e) => {
        const comp = this.app.getActiveComp();
        if (!comp) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        this.canvas.setPointerCapture(e.pointerId);

        // 1. Ruler / Work Area handles / Playhead Scrubbing
        if (my <= RULER_H) {
          const wx0 = this.timeToX(comp.workStart ?? 0, w);
          const wx1 = this.timeToX(comp.workEnd ?? comp.duration, w);
          if (my >= RULER_H - 12 && Math.abs(mx - wx0) <= 7) {
            this.app.beginInteractiveTransaction('调整工作区起点');
            this.dragState = { kind: 'workStart', w };
            return;
          }
          if (my >= RULER_H - 12 && Math.abs(mx - wx1) <= 7) {
            this.app.beginInteractiveTransaction('调整工作区终点');
            this.dragState = { kind: 'workEnd', w };
            return;
          }
          const t = this.snapTime(this.xToTime(mx, w), comp);
          this.app.setTime(t);
          this.dragState = { kind: 'scrub', w };
          return;
        }

        // 2. Graph Editor Interactive Dragging
        if (this.mode === 'graph') {
          const hit = (this._graphHandleHits || []).find((item) => Math.hypot(item.x - mx, item.y - my) <= 8);
          if (hit) {
            this.app.beginInteractiveTransaction('编辑曲线手柄');
            this.dragState = {
              kind: 'graphHandle',
              hit,
              w,
              h,
              bounds: { ...(this.graphViewBounds || { minV: 0, maxV: 100 }) }
            };
            return;
          }
          // Scrub if clicking empty graph space
          this.app.setTime(this.snapTime(this.xToTime(mx, w), comp));
          this.dragState = { kind: 'scrub', w };
          return;
        }

        // 3. Proportional Time-Stretch Span Bracket (`按比例拉伸时间`)
        if (this._stretchSpanCache) {
          const sc = this._stretchSpanCache;
          if (my >= sc.barY - 3 && my <= sc.barY + 18) {
            if (Math.abs(mx - sc.sx0) <= 8 || Math.abs(mx - sc.sx1) <= 8) {
              const side = Math.abs(mx - sc.sx0) <= 8 ? 'left' : 'right';
              this.app.beginInteractiveTransaction('按比例拉伸关键帧时间');
              const snapItems = [];
              this._forEachSelectedKeyframe(comp, (kf, prop) => {
                snapItems.push({ kf, prop, origTime: kf.time });
              });
              this.dragState = {
                kind: 'stretchKeyframes',
                side,
                origMinT: sc.minT,
                origMaxT: sc.maxT,
                snapItems,
                w
              };
              return;
            }
          }
        }

        // 4. Find clicked Track Row
        const contentY = my - RULER_H + this.scrollY;
        const row = this.rowsCache.find((r) => contentY >= r.y && contentY <= r.y + r.h);

        if (row && row.kind === 'prop' && row.propItem.prop.animated) {
          const prop = row.propItem.prop;
          const cy = RULER_H + row.y - this.scrollY + row.h * 0.5;
          const hitKf = (prop.keyframes || []).find((kf) => {
            const kx = this.timeToX(kf.time, w);
            return Math.hypot(kx - mx, cy - my) <= 7.5;
          });

          if (hitKf) {
            const kKey = `${row.layer.id}::${row.propItem.key}::${hitKf.id}`;
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
              if (this.selectedKeyframes.has(kKey)) this.selectedKeyframes.delete(kKey);
              else this.selectedKeyframes.add(kKey);
            } else if (!this.selectedKeyframes.has(kKey)) {
              this.selectedKeyframes.clear();
              this.selectedKeyframes.add(kKey);
            }
            this.activeGraphTarget = { layerId: row.layer.id, key: row.propItem.key, label: row.propItem.label, prop };

            // Alt+Drag on selected keyframes also triggers proportional time stretch!
            if (e.altKey && this.selectedKeyframes.size >= 2) {
              let minT = Infinity, maxT = -Infinity;
              const snapItems = [];
              this._forEachSelectedKeyframe(comp, (kf, p) => {
                minT = Math.min(minT, kf.time);
                maxT = Math.max(maxT, kf.time);
                snapItems.push({ kf, prop: p, origTime: kf.time });
              });
              if (maxT - minT > 1e-4) {
                this.app.beginInteractiveTransaction('按比例拉伸关键帧时间');
                this.dragState = {
                  kind: 'stretchKeyframes',
                  side: Math.abs(hitKf.time - minT) < Math.abs(hitKf.time - maxT) ? 'left' : 'right',
                  origMinT: minT,
                  origMaxT: maxT,
                  snapItems,
                  w
                };
                this.renderCanvas();
                return;
              }
            }

            // Standard Drag Move Keyframes
            this.app.beginInteractiveTransaction('移动关键帧');
            const items = [];
            this._forEachSelectedKeyframe(comp, (kf, p) => {
              items.push({ kf, prop: p, startT: kf.time });
            });
            this.dragState = {
              kind: 'moveKeyframes',
              startMouseT: this.xToTime(mx, w),
              anchorKfStartT: hitKf.time,
              items,
              w
            };
            this.renderCanvas();
            return;
          }
        }

        if (row && row.kind === 'layer' && !row.layer.locked) {
          const l = row.layer;
          const inT = l.inPoint ?? 0;
          const outT = l.outPoint ?? comp.duration;
          const bx0 = this.timeToX(inT, w);
          const bx1 = this.timeToX(outT, w);

          if (!this.app.selectedLayerIds.has(l.id)) {
            this.app.selectLayer(l.id, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
          }

          if (Math.abs(mx - bx0) <= 6) {
            this.app.beginInteractiveTransaction('裁剪图层入点');
            this.dragState = { kind: 'trimIn', layer: l, origOut: outT, w };
            return;
          }
          if (Math.abs(mx - bx1) <= 6) {
            this.app.beginInteractiveTransaction('裁剪图层出点');
            this.dragState = { kind: 'trimOut', layer: l, origIn: inT, w };
            return;
          }
          if (mx > bx0 + 6 && mx < bx1 - 6) {
            this.app.beginInteractiveTransaction('移动图层时间范围');
            this.dragState = {
              kind: 'slideLayer',
              layer: l,
              startMouseT: this.xToTime(mx, w),
              origIn: inT,
              origOut: outT,
              w
            };
            return;
          }
        }

        // 5. Marquee Box-Select Keyframes (`框选关键帧`)
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          this.selectedKeyframes.clear();
        }
        this.dragState = {
          kind: 'marquee',
          startX: mx,
          startY: my,
          additive: e.shiftKey || e.ctrlKey || e.metaKey,
          baseSelected: new Set(this.selectedKeyframes),
          w
        };
        this.renderCanvas();
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.dragState) return;
        const comp = this.app.getActiveComp();
        if (!comp) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const ds = this.dragState;

        if (ds.kind === 'scrub') {
          this.app.setTime(this.snapTime(this.xToTime(mx, rect.width), comp));
          return;
        }

        if (ds.kind === 'workStart') {
          const t = clamp(this.snapTime(this.xToTime(mx, rect.width), comp), 0, (comp.workEnd ?? comp.duration) - 0.1);
          comp.workStart = t;
          this.renderCanvas();
          return;
        }

        if (ds.kind === 'workEnd') {
          const t = clamp(this.snapTime(this.xToTime(mx, rect.width), comp), (comp.workStart ?? 0) + 0.1, comp.duration);
          comp.workEnd = t;
          this.renderCanvas();
          return;
        }

        if (ds.kind === 'trimIn') {
          ds.layer.inPoint = clamp(this.snapTime(this.xToTime(mx, rect.width), comp, ds.layer.id), 0, ds.origOut - 0.04);
          this.app.refreshViewsAfterEdit();
          return;
        }

        if (ds.kind === 'trimOut') {
          ds.layer.outPoint = clamp(this.snapTime(this.xToTime(mx, rect.width), comp, ds.layer.id), ds.origIn + 0.04, comp.duration);
          this.app.refreshViewsAfterEdit();
          return;
        }

        if (ds.kind === 'slideLayer') {
          const curT = this.xToTime(mx, rect.width);
          let dt = curT - ds.startMouseT;
          const dur = ds.origOut - ds.origIn;
          let newIn = clamp(this.snapTime(ds.origIn + dt, comp, ds.layer.id), 0, comp.duration - dur);
          ds.layer.inPoint = newIn;
          ds.layer.outPoint = newIn + dur;
          this.app.refreshViewsAfterEdit();
          return;
        }

        if (ds.kind === 'moveKeyframes') {
          const curT = this.xToTime(mx, rect.width);
          const rawTarget = ds.anchorKfStartT + (curT - ds.startMouseT);
          const snappedAnchor = this.snapTime(rawTarget, comp);
          const dt = snappedAnchor - ds.anchorKfStartT;
          const touchedProps = new Set();
          for (const it of ds.items) {
            it.kf.time = clamp(it.startT + dt, 0, comp.duration);
            touchedProps.add(it.prop);
          }
          for (const p of touchedProps) Anim.sortKeyframes(p);
          Particles.invalidateAllParticleCaches();
          this.app.refreshViewsAfterEdit();
          return;
        }

        if (ds.kind === 'stretchKeyframes') {
          const curT = clamp(this.snapTime(this.xToTime(mx, rect.width), comp), 0, comp.duration);
          const origSpan = Math.max(1e-4, ds.origMaxT - ds.origMinT);
          let newMin = ds.origMinT;
          let newMax = ds.origMaxT;
          if (ds.side === 'left') newMin = Math.min(curT, ds.origMaxT - 0.05);
          else newMax = Math.max(curT, ds.origMinT + 0.05);

          const touchedProps = new Set();
          for (const it of ds.snapItems) {
            const u = (it.origTime - ds.origMinT) / origSpan;
            it.kf.time = newMin + u * (newMax - newMin);
            touchedProps.add(it.prop);
          }
          for (const p of touchedProps) Anim.sortKeyframes(p);
          Particles.invalidateAllParticleCaches();
          this.app.refreshViewsAfterEdit();
          return;
        }

        if (ds.kind === 'marquee') {
          const x0 = Math.min(ds.startX, mx);
          const y0 = Math.min(ds.startY, my);
          const mw = Math.abs(mx - ds.startX);
          const mh = Math.abs(my - ds.startY);
          this.marqueeRect = { x: x0, y: y0, w: mw, h: mh };

          this.selectedKeyframes = new Set(ds.baseSelected);
          for (const row of this.rowsCache) {
            if (row.kind !== 'prop' || !row.propItem.prop.animated) continue;
            const cy = RULER_H + row.y - this.scrollY + row.h * 0.5;
            if (cy < y0 || cy > y0 + mh) continue;
            for (const kf of (row.propItem.prop.keyframes || [])) {
              const kx = this.timeToX(kf.time, rect.width);
              if (kx >= x0 && kx <= x0 + mw) {
                this.selectedKeyframes.add(`${row.layer.id}::${row.propItem.key}::${kf.id}`);
              }
            }
          }
          this.renderCanvas();
          return;
        }

        if (ds.kind === 'graphHandle') {
          const plotTop = RULER_H + 8;
          const plotBottom = rect.height - 10;
          const plotH = Math.max(40, plotBottom - plotTop);
          const { minV, maxV } = ds.bounds;
          const yToVal = (py) => minV + ((plotBottom - py) / plotH) * (maxV - minV);
          const hit = ds.hit;
          const kf = hit.kf;
          const mouseT = this.xToTime(mx, rect.width);
          const mouseVal = yToVal(my);

          if (hit.kind === 'valKnot') {
            kf.time = clamp(this.snapTime(mouseT, comp), 0, comp.duration);
            if (Array.isArray(kf.value)) {
              kf.value[hit.dim] = mouseVal;
            } else {
              kf.value = mouseVal;
            }
            Anim.sortKeyframes(hit.prop);
            if (hit.prop.isSpatial) Anim.recomputeSmoothSpatialTangents(hit.prop);
          } else if (hit.kind === 'valOut') {
            const dtSpan = Math.max(1e-4, hit.nextKf.time - kf.time);
            kf.outInfluence = clamp(((mouseT - kf.time) / dtSpan) * 100, 5, 95);
            const baseV = Array.isArray(kf.value) ? kf.value[hit.dim] : kf.value;
            if (Array.isArray(kf.value)) {
              if (!Array.isArray(kf.outValueOffset)) kf.outValueOffset = new Array(kf.value.length).fill(0);
              kf.outValueOffset[hit.dim] = mouseVal - baseV;
            } else {
              kf.outValueOffset = mouseVal - baseV;
            }
          } else if (hit.kind === 'valIn') {
            const dtSpan = Math.max(1e-4, kf.time - hit.prevKf.time);
            kf.inInfluence = clamp(((kf.time - mouseT) / dtSpan) * 100, 5, 95);
            const baseV = Array.isArray(kf.value) ? kf.value[hit.dim] : kf.value;
            if (Array.isArray(kf.value)) {
              if (!Array.isArray(kf.inValueOffset)) kf.inValueOffset = new Array(kf.value.length).fill(0);
              kf.inValueOffset[hit.dim] = mouseVal - baseV;
            } else {
              kf.inValueOffset = mouseVal - baseV;
            }
          } else if (hit.kind === 'speedOut') {
            const dtSpan = Math.max(1e-4, hit.nextKf.time - kf.time);
            kf.outInfluence = clamp(((mouseT - kf.time) / dtSpan) * 100, 5, 95);
            kf.outSpeed = Math.max(0, mouseVal);
          } else if (hit.kind === 'speedIn') {
            const dtSpan = Math.max(1e-4, kf.time - hit.prevKf.time);
            kf.inInfluence = clamp(((kf.time - mouseT) / dtSpan) * 100, 5, 95);
            kf.inSpeed = Math.max(0, mouseVal);
          } else if (hit.kind === 'kfTime') {
            kf.time = clamp(this.snapTime(mouseT, comp), 0, comp.duration);
            Anim.sortKeyframes(hit.prop);
          }

          Particles.invalidateAllParticleCaches();
          this.app.refreshViewsAfterEdit(true);
        }
      });

      const finishPointer = () => {
        if (!this.dragState) return;
        const kind = this.dragState.kind;
        this.dragState = null;
        this.marqueeRect = null;
        if (kind !== 'scrub' && kind !== 'marquee') {
          this.app.commitInteractiveTransaction();
          this.graphViewBounds = null;
          this.render();
        } else {
          this.renderCanvas();
        }
      };

      this.canvas.addEventListener('pointerup', finishPointer);
      this.canvas.addEventListener('pointercancel', finishPointer);
    }
  }

  Forge.TimelineView = {
    collectLayerProperties,
    TimelineController
  };
})();
