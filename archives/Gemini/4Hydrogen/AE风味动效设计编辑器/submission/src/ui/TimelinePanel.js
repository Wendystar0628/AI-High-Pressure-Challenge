// 时间轴面板：图层顺序/显隐/锁定/3D/运动模糊/父子链接/重命名、出入点裁剪条、工作区、关键帧框选/移动/Alt拉伸/复制粘贴与播放头同步

import { clamp } from '../core/math.js';
import {
  addOrUpdateKeyframe,
  removeKeyframeById,
  sortKeyframes,
  invalidateSpatialCache,
  applyEasyEaseToKeyframes,
  stretchKeyframes,
  cloneVal,
  makeKeyframe,
} from '../core/property.js';
import { evalProperty, resolvePropertyByPath } from '../core/expressions.js';
import {
  getActiveComp,
  getLayerById,
  createLayer,
  reparentLayerPreserveVisual,
  genId,
} from '../core/project.js';
import {
  el,
  LAYER_TYPE_META,
  getLayerAnimatableProps,
  formatTimeFull,
  showToast,
} from './helpers.js';

export class TimelinePanel {
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;
    this.pxPerSec = 78;
    this.expandedLayerIds = new Set();
    this.onlyShowAnimated = false;
    this._kfClipboard = null; // [{ propPath, layerType, kfsRelative: [...] }]
    this._dragState = null;
    this._playheadEls = [];
    this._kfDiamonds = []; // { el, layerId, propPath, kfId, leftPx, topPx }
    this._propValueBadges = []; // { el, layerId, propPath, propType }

    this._renderSkeleton();
    this._bindGlobalDrag();
  }

  _renderSkeleton() {
    this.containerEl.innerHTML = '';

    // 顶部走带与时间轴控制栏
    this.toolbarEl = el('div', { className: 'tl-toolbar' });
    this.leftHeadEl = el('div', { className: 'tl-left-head' });
    this.rulerWrapEl = el('div', { className: 'tl-ruler-wrap' });
    this.rulerCanvas = el('canvas', { className: 'tl-ruler-canvas', height: 28 });
    this.workAreaEl = el('div', { className: 'tl-work-area' }, [
      el('div', { className: 'tl-wa-handle left', title: '调整工作区起点' }),
      el('div', { className: 'tl-wa-handle right', title: '调整工作区终点' }),
    ]);
    this.rulerPlayheadEl = el('div', { className: 'tl-playhead-head' });
    this.rulerWrapEl.appendChild(this.rulerCanvas);
    this.rulerWrapEl.appendChild(this.workAreaEl);
    this.rulerWrapEl.appendChild(this.rulerPlayheadEl);

    const headerRow = el('div', { className: 'tl-header-row' }, [
      this.leftHeadEl,
      this.rulerWrapEl,
    ]);

    this.leftBodyEl = el('div', { className: 'tl-left-body' });
    this.tracksScrollEl = el('div', { className: 'tl-tracks-scroll' });
    this.tracksInnerEl = el('div', { className: 'tl-tracks-inner' });
    this.marqueeEl = el('div', { className: 'tl-marquee hidden' });
    this.trackPlayheadEl = el('div', { className: 'tl-playhead-line' });
    this.tracksInnerEl.appendChild(this.trackPlayheadEl);
    this.tracksInnerEl.appendChild(this.marqueeEl);
    this.tracksScrollEl.appendChild(this.tracksInnerEl);

    // 左右垂直滚动双向同步 + 标尺横向同步
    let syncing = false;
    this.leftBodyEl.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      this.tracksScrollEl.scrollTop = this.leftBodyEl.scrollTop;
      syncing = false;
    });
    this.tracksScrollEl.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      this.leftBodyEl.scrollTop = this.tracksScrollEl.scrollTop;
      syncing = false;
      this._syncRulerOffset();
    });

    const splitBody = el('div', { className: 'tl-body' }, [
      this.leftBodyEl,
      this.tracksScrollEl,
    ]);

    this.containerEl.appendChild(this.toolbarEl);
    this.containerEl.appendChild(headerRow);
    this.containerEl.appendChild(splitBody);

    this._buildToolbar();
    this._buildLeftHead();
    this._bindRulerAndTracksEvents();
  }

  _buildToolbar() {
    this.toolbarEl.innerHTML = '';

    this.playBtn = el('button', {
      className: 'ae-btn sm primary',
      text: '▶ 播放',
      title: '播放 / 暂停 (Space)',
      onClick: () => this.app.togglePlay(),
    });
    this.timecodeEl = el('span', { className: 'tl-timecode', text: '0.00s  [0 帧]' });
    this.muteBtn = el('button', {
      className: 'ae-btn sm',
      text: '🔊 声音',
      title: '开启或静音合成音轨',
      onClick: () => {
        this.app.audio.setMuted(!this.app.audio.muted);
        this.updateTransportState();
      },
    });

    // 新建图层下拉选择
    const layerSelect = el('select', { className: 'ae-select sm', title: '选择要新建的图层类型' }, [
      el('option', { value: '', text: '+ 新建图层...' }),
      el('option', { value: 'shape', text: '形状图层 (矢量/路径)' }),
      el('option', { value: 'text', text: '文字图层 (中文排版/动画器)' }),
      el('option', { value: 'null', text: '空对象 (父级/空间场)' }),
      el('option', { value: 'adjustment', text: '调整图层 (全局特效)' }),
      el('option', { value: 'precomp', text: '预合成图层 (嵌套引用)' }),
      el('option', { value: 'camera', text: '摄像机图层 (3D与景深)' }),
      el('option', { value: 'light', text: '灯光图层 (方向/点光阴影)' }),
      el('option', { value: 'mesh3d', text: '三维几何图层 (挤出/变形/PBR)' }),
      el('option', { value: 'particle', text: '粒子系统图层 (发射/场/碰撞)' }),
      el('option', { value: 'audio', text: '音色合成图层 (声画同步)' }),
    ]);
    layerSelect.addEventListener('change', () => {
      const t = layerSelect.value;
      layerSelect.value = '';
      if (!t) return;
      this.app.createLayerOfType(t);
    });

    this.curveBtn = el('button', {
      className: 'ae-btn sm',
      text: '📈 图表编辑器',
      title: '切换数值曲线 / 速度曲线编辑器',
      onClick: () => this.app.toggleGraphEditor(),
    });

    this.onlyKfBtn = el('button', {
      className: 'ae-btn sm',
      text: '仅关键帧 (U)',
      title: '仅展开带关键帧的属性',
      onClick: () => {
        this.onlyShowAnimated = !this.onlyShowAnimated;
        this.onlyKfBtn.classList.toggle('active', this.onlyShowAnimated);
        this.render();
      },
    });

    const zoomSlider = el('input', {
      type: 'range',
      min: 30,
      max: 240,
      step: 5,
      value: this.pxPerSec,
      className: 'tl-zoom-slider',
      title: '时间轴缩放',
      onInput: (e) => {
        this.pxPerSec = Number(e.target.value) || 78;
        this.render();
      },
    });

    const leftGroup = el('div', { className: 'tl-tb-group' }, [
      el('button', { className: 'ae-btn sm', text: '|<', title: '跳到开头', onClick: () => this.app.seekTo(0) }),
      el('button', { className: 'ae-btn sm', text: '< 帧', title: '上一帧', onClick: () => this.app.stepFrame(-1) }),
      this.playBtn,
      el('button', { className: 'ae-btn sm', text: '帧 >', title: '下一帧', onClick: () => this.app.stepFrame(1) }),
      this.timecodeEl,
      this.muteBtn,
    ]);

    const midGroup = el('div', { className: 'tl-tb-group' }, [
      layerSelect,
      el('button', {
        className: 'ae-btn sm',
        text: '预合成',
        title: '将选中图层原地预合成 (Ctrl+Shift+C)',
        onClick: () => this.app.precomposeSelectedLayers(),
      }),
      el('button', {
        className: 'ae-btn sm',
        text: 'F9 缓动',
        title: '对选中关键帧应用 F9 Easy Ease',
        onClick: () => this.applyEasyEaseToSelected(),
      }),
      this.onlyKfBtn,
      this.curveBtn,
    ]);

    const rightGroup = el('div', { className: 'tl-tb-group' }, [
      el('span', { className: 'tl-zoom-lbl', text: '缩放' }),
      zoomSlider,
    ]);

    this.toolbarEl.appendChild(leftGroup);
    this.toolbarEl.appendChild(midGroup);
    this.toolbarEl.appendChild(rightGroup);
  }

  _buildLeftHead() {
    this.leftHeadEl.innerHTML = '';
    this.leftHeadEl.appendChild(el('span', { className: 'tl-col-ord', text: '序' }));
    this.leftHeadEl.appendChild(el('span', { className: 'tl-col-flags', text: '显/锁/模/3D' }));
    this.leftHeadEl.appendChild(el('span', { className: 'tl-col-name', text: '图层名称 (双击改名)' }));
    this.leftHeadEl.appendChild(el('span', { className: 'tl-col-parent', text: '父级联动' }));
    this.leftHeadEl.appendChild(el('span', { className: 'tl-col-ops', text: '操作' }));
  }

  _syncRulerOffset() {
    const sl = this.tracksScrollEl.scrollLeft;
    this.rulerCanvas.style.transform = `translateX(${-sl}px)`;
    this.workAreaEl.style.transform = `translateX(${-sl}px)`;
    this.updatePlayheadOnly();
  }

  _xToTime(trackX) {
    return Math.max(0, trackX / this.pxPerSec);
  }

  _timeToX(t) {
    return (Number(t) || 0) * this.pxPerSec;
  }

  _bindRulerAndTracksEvents() {
    // 在标尺上点击或拖拽移动播放头
    const scrubRuler = (e) => {
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const rect = this.rulerWrapEl.getBoundingClientRect();
      const x = e.clientX - rect.left + this.tracksScrollEl.scrollLeft;
      const t = clamp(this._xToTime(x), 0, comp.duration);
      this.app.seekTo(t);
    };

    this.rulerWrapEl.addEventListener('pointerdown', (e) => {
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const target = e.target;
      if (target.classList.contains('tl-wa-handle')) {
        const isLeft = target.classList.contains('left');
        this.app.history.beginTransaction(this.app.project, '调整工作区');
        this._dragState = {
          kind: isLeft ? 'workAreaStart' : 'workAreaEnd',
          startX: e.clientX,
          origStart: comp.workAreaStart ?? 0,
          origEnd: comp.workAreaEnd ?? comp.duration,
        };
        return;
      }
      this._dragState = { kind: 'playhead' };
      scrubRuler(e);
    });

    // 在空白轨道区拖拽框选关键帧
    this.tracksScrollEl.addEventListener('pointerdown', (e) => {
      if (e.target !== this.tracksScrollEl && e.target !== this.tracksInnerEl && !e.target.classList.contains('tl-track-row')) {
        return;
      }
      const rect = this.tracksInnerEl.getBoundingClientRect();
      const startX = e.clientX - rect.left;
      const startY = e.clientY - rect.top;
      this._dragState = {
        kind: 'marquee',
        startX,
        startY,
        curX: startX,
        curY: startY,
        additive: e.shiftKey,
      };
      this.marqueeEl.classList.remove('hidden');
      this.marqueeEl.style.left = `${startX}px`;
      this.marqueeEl.style.top = `${startY}px`;
      this.marqueeEl.style.width = '0px';
      this.marqueeEl.style.height = '0px';
    });
  }

  _bindGlobalDrag() {
    window.addEventListener('pointermove', (e) => {
      if (!this._dragState) return;
      const project = this.app.project;
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const ds = this._dragState;

      if (ds.kind === 'playhead') {
        const rect = this.rulerWrapEl.getBoundingClientRect();
        const x = e.clientX - rect.left + this.tracksScrollEl.scrollLeft;
        const t = clamp(this._xToTime(x), 0, comp.duration);
        this.app.seekTo(t);
        return;
      }

      if (ds.kind === 'workAreaStart' || ds.kind === 'workAreaEnd') {
        const dx = (e.clientX - ds.startX) / this.pxPerSec;
        if (ds.kind === 'workAreaStart') {
          comp.workAreaStart = clamp(ds.origStart + dx, 0, comp.workAreaEnd - 0.1);
        } else {
          comp.workAreaEnd = clamp(ds.origEnd + dx, comp.workAreaStart + 0.1, comp.duration);
        }
        this._updateWorkAreaEl(comp);
        return;
      }

      if (ds.kind === 'barMove' || ds.kind === 'barTrimIn' || ds.kind === 'barTrimOut') {
        const lyr = getLayerById(comp, ds.layerId);
        if (!lyr || lyr.locked) return;
        const dt = (e.clientX - ds.startX) / this.pxPerSec;
        if (ds.kind === 'barMove') {
          const len = ds.origOut - ds.origIn;
          const nextIn = clamp(ds.origIn + dt, -comp.duration, comp.duration - 0.05);
          const actualDt = nextIn - ds.origIn;
          lyr.inPoint = Number(nextIn.toFixed(3));
          lyr.outPoint = Number((nextIn + len).toFixed(3));
          lyr.startTime = Number(((ds.origStartTime || 0) + actualDt).toFixed(3));
        } else if (ds.kind === 'barTrimIn') {
          lyr.inPoint = Number(clamp(ds.origIn + dt, 0, lyr.outPoint - 0.03).toFixed(3));
        } else {
          lyr.outPoint = Number(clamp(ds.origOut + dt, lyr.inPoint + 0.03, comp.duration * 2).toFixed(3));
        }
        this._updateBarEl(lyr, ds.barEl);
        this.app.renderCurrentFrame();
        return;
      }

      if (ds.kind === 'kfMove' || ds.kind === 'kfStretch') {
        let dt = (e.clientX - ds.startX) / this.pxPerSec;
        if (e.shiftKey) {
          const frameDur = 1 / (comp.fps || 30);
          dt = Math.round(dt / frameDur) * frameDur;
        }
        if (ds.kind === 'kfMove') {
          const minT = Math.min(...ds.items.map((it) => it.origTime));
          if (minT + dt < 0) dt = -minT;
          for (const it of ds.items) {
            it.kf.time = Math.max(0, Math.round((it.origTime + dt) * 1000) / 1000);
            it.el.style.left = `${this._timeToX(it.kf.time)}px`;
          }
        } else {
          // Alt + 拖拽：按锚点比例整体拉伸关键帧跨度
          const span = ds.maxTime - ds.minTime;
          if (span > 1e-4) {
            const newSpan = Math.max(0.05, span + (ds.fromMinSide ? -dt : dt));
            const scale = newSpan / span;
            const anchor = ds.fromMinSide ? ds.maxTime : ds.minTime;
            for (const it of ds.items) {
              it.kf.time = Math.max(0, Math.round((anchor + (it.origTime - anchor) * scale) * 1000) / 1000);
              it.el.style.left = `${this._timeToX(it.kf.time)}px`;
            }
          }
        }
        for (const p of ds.touchedProps) {
          sortKeyframes(p);
          invalidateSpatialCache(p);
        }
        this.app.renderCurrentFrame();
        this.app.refreshPropertiesValuesOnly();
        return;
      }

      if (ds.kind === 'marquee') {
        const rect = this.tracksInnerEl.getBoundingClientRect();
        ds.curX = e.clientX - rect.left;
        ds.curY = e.clientY - rect.top;
        const x0 = Math.min(ds.startX, ds.curX);
        const y0 = Math.min(ds.startY, ds.curY);
        const w = Math.abs(ds.curX - ds.startX);
        const h = Math.abs(ds.curY - ds.startY);
        this.marqueeEl.style.left = `${x0}px`;
        this.marqueeEl.style.top = `${y0}px`;
        this.marqueeEl.style.width = `${w}px`;
        this.marqueeEl.style.height = `${h}px`;

        const nextSel = ds.additive ? [...(project.selectedKeyframes || [])] : [];
        const has = (d) => nextSel.some((s) => s.layerId === d.layerId && s.propPath === d.propPath && s.kfId === d.kfId);
        for (const d of this._kfDiamonds) {
          if (d.leftPx >= x0 && d.leftPx <= x0 + w && d.topPx >= y0 && d.topPx <= y0 + h) {
            if (!has(d)) nextSel.push({ layerId: d.layerId, propPath: d.propPath, kfId: d.kfId });
          }
        }
        project.selectedKeyframes = nextSel;
        this._refreshKfSelectionHighlight();
      }
    });

    window.addEventListener('pointerup', () => {
      if (!this._dragState) return;
      const ds = this._dragState;
      this._dragState = null;
      this.marqueeEl.classList.add('hidden');
      if (ds.kind !== 'playhead' && ds.kind !== 'marquee') {
        this.app.history.commitTransaction(this.app.project);
        this.app.refreshAll();
      } else if (ds.kind === 'marquee') {
        this.app.refreshGraphEditorOnly?.();
      }
    });
  }

  _updateBarEl(lyr, barEl) {
    if (!barEl) return;
    const x0 = this._timeToX(Math.max(0, lyr.inPoint));
    const x1 = this._timeToX(Math.max(lyr.inPoint + 0.03, lyr.outPoint));
    barEl.style.left = `${x0}px`;
    barEl.style.width = `${Math.max(6, x1 - x0)}px`;
  }

  _updateWorkAreaEl(comp) {
    const x0 = this._timeToX(comp.workAreaStart ?? 0);
    const x1 = this._timeToX(comp.workAreaEnd ?? comp.duration);
    this.workAreaEl.style.left = `${x0}px`;
    this.workAreaEl.style.width = `${Math.max(12, x1 - x0)}px`;
  }

  _refreshKfSelectionHighlight() {
    const sel = this.app.project?.selectedKeyframes || [];
    for (const d of this._kfDiamonds) {
      const isSel = sel.some((s) => s.layerId === d.layerId && s.propPath === d.propPath && s.kfId === d.kfId);
      d.el.classList.toggle('selected', isSel);
    }
  }

  // 仅更新播放头位置、时间码与展开属性实时读数（不重建 DOM，供 60fps 播放与 videoExport 调用）
  updatePlayheadOnly() {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!project || !comp) return;
    const x = this._timeToX(comp.currentTime);
    const sl = this.tracksScrollEl.scrollLeft;
    this.rulerPlayheadEl.style.left = `${x - sl}px`;
    this.trackPlayheadEl.style.left = `${x}px`;
    this.timecodeEl.textContent = formatTimeFull(comp.currentTime, comp.fps || 30);

    for (const b of this._propValueBadges) {
      const lyr = getLayerById(comp, b.layerId);
      if (!lyr) continue;
      const v = evalProperty(project, comp, lyr, b.propPath, comp.currentTime);
      b.el.textContent = this._formatBadgeVal(v, b.propType);
    }
  }

  updateTransportState() {
    if (this.playBtn) {
      this.playBtn.textContent = this.app.isPlaying ? '⏸ 暂停' : '▶ 播放';
      this.playBtn.classList.toggle('playing', !!this.app.isPlaying);
    }
    if (this.muteBtn) {
      this.muteBtn.textContent = this.app.audio.muted ? '🔇 静音' : '🔊 声音';
    }
    if (this.curveBtn) {
      this.curveBtn.classList.toggle('active', !!this.app.showGraphEditor);
    }
  }

  _formatBadgeVal(v, type) {
    if (typeof v === 'number') return Number(v).toFixed(1);
    if (Array.isArray(v)) {
      if (type === 'color') return `RGB(${Math.round((v[0] || 0) * 255)},${Math.round((v[1] || 0) * 255)},${Math.round((v[2] || 0) * 255)})`;
      return v.slice(0, 3).map((n) => Number(n || 0).toFixed(0)).join(',');
    }
    if (v && v.contours) return `${v.contours.length} 轮廓`;
    return '';
  }

  _drawRuler(comp) {
    const totalW = Math.max(900, Math.ceil((comp.duration + 0.5) * this.pxPerSec));
    this.rulerCanvas.width = totalW;
    this.tracksInnerEl.style.width = `${totalW}px`;
    const ctx = this.rulerCanvas.getContext('2d');
    ctx.clearRect(0, 0, totalW, 28);
    ctx.fillStyle = '#1b1f29';
    ctx.fillRect(0, 0, totalW, 28);

    const stepSec = this.pxPerSec >= 110 ? 0.5 : this.pxPerSec >= 55 ? 1 : 2;
    const minorDiv = stepSec >= 1 ? 5 : 5;
    ctx.strokeStyle = '#384152';
    ctx.fillStyle = '#9aa6b8';
    ctx.font = '10px "Microsoft YaHei", monospace';

    for (let t = 0; t <= comp.duration + 0.01; t += stepSec / minorDiv) {
      const x = Math.round(t * this.pxPerSec) + 0.5;
      const isMajor = Math.abs(t / stepSec - Math.round(t / stepSec)) < 1e-4;
      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 10 : 19);
      ctx.lineTo(x, 28);
      ctx.stroke();
      if (isMajor) {
        ctx.fillText(`${t.toFixed(stepSec < 1 ? 1 : 0)}s`, x + 3, 12);
      }
    }
  }

  // 复制、粘贴、删除、Easy Ease 选中关键帧
  copySelectedKeyframes() {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!comp || !project.selectedKeyframes?.length) return false;
    const items = [];
    let minT = Infinity;
    for (const ref of project.selectedKeyframes) {
      const lyr = getLayerById(comp, ref.layerId);
      const prop = lyr ? resolvePropertyByPath(lyr, ref.propPath) : null;
      const kf = prop?.keyframes?.find((k) => k.id === ref.kfId);
      if (kf) {
        minT = Math.min(minT, kf.time);
        items.push({ layerId: ref.layerId, propPath: ref.propPath, kf: cloneVal(kf) });
      }
    }
    if (!items.length) return false;
    this._kfClipboard = items.map((it) => ({
      layerId: it.layerId,
      propPath: it.propPath,
      offset: it.kf.time - minT,
      kf: it.kf,
    }));
    showToast(`已复制 ${items.length} 个关键帧`);
    return true;
  }

  pasteKeyframesAtCurrentTime() {
    if (!this._kfClipboard?.length) return false;
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!comp) return false;
    const baseT = comp.currentTime;
    const newlySelected = [];
    this.app.history.recordAction(project, '粘贴关键帧', () => {
      const primaryLayer = getLayerById(comp, project.selectedLayerIds?.[0]);
      for (const item of this._kfClipboard) {
        let targetLayer = getLayerById(comp, item.layerId);
        let prop = targetLayer ? resolvePropertyByPath(targetLayer, item.propPath) : null;
        if (primaryLayer) {
          const onSelected = resolvePropertyByPath(primaryLayer, item.propPath);
          if (onSelected) {
            targetLayer = primaryLayer;
            prop = onSelected;
          }
        }
        if (!targetLayer || !prop) continue;
        prop.animated = true;
        const pasted = makeKeyframe(baseT + item.offset, item.kf.value, {
          inInterp: item.kf.inInterp,
          outInterp: item.kf.outInterp,
          inEase: item.kf.inEase,
          outEase: item.kf.outEase,
          inTangent: item.kf.inTangent,
          outTangent: item.kf.outTangent,
        });
        const eps = 1e-3;
        prop.keyframes = prop.keyframes.filter((k) => Math.abs(k.time - pasted.time) >= eps);
        prop.keyframes.push(pasted);
        sortKeyframes(prop);
        invalidateSpatialCache(prop);
        newlySelected.push({ layerId: targetLayer.id, propPath: item.propPath, kfId: pasted.id });
      }
      if (newlySelected.length) project.selectedKeyframes = newlySelected;
    });
    showToast(`已在 ${baseT.toFixed(2)}s 粘贴关键帧`);
    this.app.refreshAll();
    return true;
  }

  deleteSelectedKeyframes() {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!comp || !project.selectedKeyframes?.length) return false;
    this.app.history.recordAction(project, '删除关键帧', () => {
      for (const ref of project.selectedKeyframes) {
        const lyr = getLayerById(comp, ref.layerId);
        const prop = lyr ? resolvePropertyByPath(lyr, ref.propPath) : null;
        if (prop) {
          removeKeyframeById(prop, ref.kfId);
          if (prop.keyframes.length === 0) prop.animated = false;
        }
      }
      project.selectedKeyframes = [];
    });
    this.app.refreshAll();
    return true;
  }

  applyEasyEaseToSelected() {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!comp || !project.selectedKeyframes?.length) return false;
    const byProp = new Map();
    for (const ref of project.selectedKeyframes) {
      const key = `${ref.layerId}::${ref.propPath}`;
      if (!byProp.has(key)) byProp.set(key, { layerId: ref.layerId, propPath: ref.propPath, ids: [] });
      byProp.get(key).ids.push(ref.kfId);
    }
    this.app.history.recordAction(project, 'F9 缓入缓出 (Easy Ease)', () => {
      for (const entry of byProp.values()) {
        const lyr = getLayerById(comp, entry.layerId);
        const prop = lyr ? resolvePropertyByPath(lyr, entry.propPath) : null;
        if (prop) applyEasyEaseToKeyframes(prop, entry.ids, 'both');
      }
    });
    showToast('已应用 F9 缓动 (Easy Ease)');
    this.app.refreshAll();
    return true;
  }

  render() {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!project || !comp) return;

    this.updateTransportState();
    this._drawRuler(comp);
    this._updateWorkAreaEl(comp);
    this._syncRulerOffset();

    this.leftBodyEl.innerHTML = '';
    // 清空轨道行，保留播放头线和框选框
    for (const ch of [...this.tracksInnerEl.children]) {
      if (ch !== this.trackPlayheadEl && ch !== this.marqueeEl) ch.remove();
    }
    this._kfDiamonds = [];
    this._propValueBadges = [];

    const ROW_LAYER_H = 30;
    const ROW_PROP_H = 24;
    let curY = 0;

    comp.layers.forEach((lyr, idx) => {
      const isSelected = (project.selectedLayerIds || []).includes(lyr.id);
      const isExpanded = this.expandedLayerIds.has(lyr.id);
      const meta = LAYER_TYPE_META[lyr.type] || { label: lyr.type, color: '#64748b', short: '?' };

      // 左侧图层行
      const leftRow = el('div', {
        className: `tl-layer-row ${isSelected ? 'selected' : ''} ${lyr.locked ? 'locked' : ''}`,
        style: { height: `${ROW_LAYER_H}px` },
        onClick: (e) => {
          if (e.target.closest('button, select, input')) return;
          this._selectLayer(lyr.id, e.shiftKey || e.ctrlKey || e.metaKey);
        },
      });

      // 上下移动顺序按钮
      const ordWrap = el('span', { className: 'tl-ord-cell' }, [
        el('span', { className: 'tl-idx', text: String(idx + 1) }),
        el('button', {
          className: 'ae-micro-btn',
          text: '↑',
          title: '图层上移',
          onClick: () => this._moveLayerOrder(lyr.id, -1),
        }),
        el('button', {
          className: 'ae-micro-btn',
          text: '↓',
          title: '图层下移',
          onClick: () => this._moveLayerOrder(lyr.id, 1),
        }),
      ]);

      // 显隐 / 锁定 / 运动模糊 / 3D 开关
      const flagsWrap = el('span', { className: 'tl-flags-cell' }, [
        el('button', {
          className: `tl-flag-btn ${lyr.visible ? 'on' : ''}`,
          text: '👁',
          title: '可见性',
          onClick: () => {
            this.app.history.recordAction(project, '切换图层可见性', () => {
              lyr.visible = !lyr.visible;
            });
            this.app.refreshAll();
          },
        }),
        el('button', {
          className: `tl-flag-btn ${lyr.locked ? 'lock-on' : ''}`,
          text: lyr.locked ? '🔒' : '🔓',
          title: '锁定图层',
          onClick: () => {
            this.app.history.recordAction(project, '切换图层锁定', () => {
              lyr.locked = !lyr.locked;
            });
            this.app.refreshAll();
          },
        }),
        el('button', {
          className: `tl-flag-btn txt ${lyr.motionBlur ? 'on-blue' : ''}`,
          text: 'M',
          title: '快门运动模糊',
          onClick: () => {
            this.app.history.recordAction(project, '切换图层运动模糊', () => {
              lyr.motionBlur = !lyr.motionBlur;
            });
            this.app.refreshAll();
          },
        }),
        el('button', {
          className: `tl-flag-btn txt ${lyr.is3D ? 'on-amber' : ''}`,
          text: '3D',
          title: '3D 空间图层开关',
          onClick: () => {
            this.app.history.recordAction(project, '切换 3D 图层', () => {
              lyr.is3D = !lyr.is3D;
            });
            this.app.refreshAll();
          },
        }),
      ]);

      // 展开折叠按钮 + 类型徽标 + 名称（双击内联重命名）
      const expBtn = el('button', {
        className: 'tl-exp-btn',
        text: isExpanded ? '▾' : '▸',
        title: '展开/折叠可关键帧属性',
        onClick: () => {
          if (this.expandedLayerIds.has(lyr.id)) this.expandedLayerIds.delete(lyr.id);
          else this.expandedLayerIds.add(lyr.id);
          this.render();
        },
      });
      const badgeEl = el('span', {
        className: 'tl-type-badge',
        style: { backgroundColor: meta.color },
        text: meta.short,
        title: meta.label,
      });
      const nameSpan = el('span', {
        className: 'tl-name-text',
        text: lyr.name,
        title: `${lyr.name} (双击重命名)`,
        onDblclick: (e) => {
          e.stopPropagation();
          const inp = el('input', {
            type: 'text',
            className: 'tl-rename-input',
            value: lyr.name,
          });
          nameSpan.replaceWith(inp);
          inp.focus();
          inp.select();
          const finishRename = () => {
            const nextName = inp.value.trim();
            if (nextName && nextName !== lyr.name) {
              this.app.history.recordAction(project, '重命名图层', () => {
                lyr.name = nextName;
              });
            }
            this.app.refreshAll();
          };
          inp.addEventListener('blur', finishRename);
          inp.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') inp.blur();
            else if (ke.key === 'Escape') this.render();
          });
        },
      });
      const nameWrap = el('span', { className: 'tl-name-cell' }, [expBtn, badgeEl, nameSpan]);

      // 父级联动下拉框（支持无跳变切换父级）
      const parentSelect = el('select', { className: 'tl-parent-select', title: '设置父级图层 (自动维持当前画面姿态)' }, [
        el('option', { value: '', text: '无父级', selected: !lyr.parentId }),
        ...comp.layers
          .filter((o) => o.id !== lyr.id)
          .map((o) => el('option', { value: o.id, text: o.name, selected: lyr.parentId === o.id })),
      ]);
      parentSelect.addEventListener('change', () => {
        const nextParent = parentSelect.value || null;
        this.app.history.recordAction(project, '设置父子层级', () => {
          const ok = reparentLayerPreserveVisual(project, comp, lyr, nextParent, comp.currentTime);
          if (!ok) showToast('无法建立循环父子关系', 'warn');
        });
        this.app.refreshAll();
      });

      // 复制/删除操作
      const opsWrap = el('span', { className: 'tl-ops-cell' }, [
        el('button', {
          className: 'ae-micro-btn',
          text: '⧉',
          title: '复制图层 (Ctrl+D)',
          onClick: () => this.app.duplicateLayer(lyr.id),
        }),
        el('button', {
          className: 'ae-micro-btn danger',
          text: '×',
          title: '删除图层',
          onClick: () => this.app.deleteLayer(lyr.id),
        }),
      ]);

      leftRow.appendChild(ordWrap);
      leftRow.appendChild(flagsWrap);
      leftRow.appendChild(nameWrap);
      leftRow.appendChild(parentSelect);
      leftRow.appendChild(opsWrap);
      this.leftBodyEl.appendChild(leftRow);

      // 右侧图层时间条行
      const trackRow = el('div', {
        className: `tl-track-row ${isSelected ? 'selected' : ''}`,
        style: { height: `${ROW_LAYER_H}px` },
      });

      const barEl = el('div', {
        className: `tl-layer-bar ${isSelected ? 'selected' : ''}`,
        style: { borderTopColor: meta.color },
        title: `${lyr.name} [${lyr.inPoint.toFixed(2)}s ~ ${lyr.outPoint.toFixed(2)}s] 拖动平移，拖边缘裁剪出入点`,
      }, [
        el('div', { className: 'tl-bar-handle left' }),
        el('span', { className: 'tl-bar-label', text: lyr.name }),
        el('div', { className: 'tl-bar-handle right' }),
      ]);
      this._updateBarEl(lyr, barEl);

      barEl.addEventListener('pointerdown', (e) => {
        if (lyr.locked) return;
        e.stopPropagation();
        this._selectLayer(lyr.id, e.shiftKey || e.ctrlKey || e.metaKey, true);
        const kind = e.target.classList.contains('left')
          ? 'barTrimIn'
          : e.target.classList.contains('right')
            ? 'barTrimOut'
            : 'barMove';
        this.app.history.beginTransaction(project, '调整图层时间条');
        this._dragState = {
          kind,
          layerId: lyr.id,
          barEl,
          startX: e.clientX,
          origIn: lyr.inPoint,
          origOut: lyr.outPoint,
          origStartTime: lyr.startTime || 0,
        };
      });
      trackRow.appendChild(barEl);

      // 折叠状态下显示图层关键帧汇总菱形点
      const allProps = getLayerAnimatableProps(lyr);
      if (!isExpanded) {
        const summaryTimes = new Set();
        for (const pInfo of allProps) {
          for (const kf of pInfo.prop.keyframes || []) {
            summaryTimes.add(Math.round(kf.time * 100) / 100);
          }
        }
        for (const st of summaryTimes) {
          trackRow.appendChild(
            el('span', {
              className: 'tl-summary-kf',
              style: { left: `${this._timeToX(st)}px` },
              title: `${st.toFixed(2)}s 关键帧`,
            })
          );
        }
      }

      this.tracksInnerEl.appendChild(trackRow);
      curY += ROW_LAYER_H;

      // 展开属性关键帧子行
      if (isExpanded) {
        const propsToShow = this.onlyShowAnimated
          ? allProps.filter((p) => (p.prop.keyframes && p.prop.keyframes.length > 0) || p.prop.expressionEnabled)
          : allProps;
        for (const pInfo of propsToShow) {
          const p = pInfo.prop;
          const isGraphTarget =
            this.app.graphTarget?.layerId === lyr.id && this.app.graphTarget?.propPath === pInfo.path;

          const pLeft = el('div', {
            className: `tl-prop-row ${isGraphTarget ? 'graph-active' : ''}`,
            style: { height: `${ROW_PROP_H}px` },
            onClick: (e) => {
              if (e.target.closest('button')) return;
              this.app.setGraphTarget(lyr.id, pInfo.path);
            },
          });

          const swBtn = el('button', {
            className: `tl-stopwatch-btn ${p.animated ? 'on' : ''}`,
            text: '⏱',
            title: '开启/关闭关键帧动画',
            onClick: () => {
              this.app.history.recordAction(project, '切换属性关键帧', () => {
                if (p.animated) {
                  p.value = cloneVal(evalProperty(project, comp, lyr, pInfo.path, comp.currentTime));
                  p.keyframes = [];
                  p.animated = false;
                } else {
                  p.animated = true;
                  addOrUpdateKeyframe(p, comp.currentTime, evalProperty(project, comp, lyr, pInfo.path, comp.currentTime));
                }
              });
              this.app.refreshAll();
            },
          });

          const hasKfAtNow = p.animated && p.keyframes.some((k) => Math.abs(k.time - comp.currentTime) < 0.015);
          const kfBtn = el('button', {
            className: `tl-addkf-btn ${hasKfAtNow ? 'active' : ''}`,
            text: '◆',
            title: '在当前时间添加/移除关键帧',
            onClick: () => {
              this.app.history.recordAction(project, '切换当前帧关键帧', () => {
                const existing = p.keyframes.find((k) => Math.abs(k.time - comp.currentTime) < 0.015);
                if (existing) {
                  removeKeyframeById(p, existing.id);
                  if (p.keyframes.length === 0) p.animated = false;
                } else {
                  p.animated = true;
                  addOrUpdateKeyframe(p, comp.currentTime, evalProperty(project, comp, lyr, pInfo.path, comp.currentTime));
                }
              });
              this.app.refreshAll();
            },
          });

          const curV = evalProperty(project, comp, lyr, pInfo.path, comp.currentTime);
          const badge = el('span', {
            className: 'tl-prop-val',
            text: this._formatBadgeVal(curV, p.type),
          });
          this._propValueBadges.push({ el: badge, layerId: lyr.id, propPath: pInfo.path, propType: p.type });

          pLeft.appendChild(el('span', { className: 'tl-prop-indent' }, [swBtn, kfBtn]));
          pLeft.appendChild(el('span', { className: 'tl-prop-label', text: pInfo.label }));
          pLeft.appendChild(badge);
          if (p.expressionEnabled) {
            pLeft.appendChild(el('span', { className: 'tl-expr-pill', text: 'fx', title: p.expression }));
          }
          this.leftBodyEl.appendChild(pLeft);

          // 右侧关键帧轨道行
          const pRight = el('div', {
            className: `tl-track-row prop-sub ${isGraphTarget ? 'graph-active' : ''}`,
            style: { height: `${ROW_PROP_H}px` },
          });

          for (const kf of p.keyframes || []) {
            const leftPx = this._timeToX(kf.time);
            const interpCls =
              kf.outInterp === 'hold'
                ? 'interp-hold'
                : kf.inInterp === 'bezier' || kf.outInterp === 'bezier'
                  ? 'interp-bezier'
                  : 'interp-linear';
            const isSel = (project.selectedKeyframes || []).some(
              (s) => s.layerId === lyr.id && s.propPath === pInfo.path && s.kfId === kf.id
            );

            const kfEl = el('div', {
              className: `tl-kf-diamond ${interpCls} ${isSel ? 'selected' : ''}`,
              style: { left: `${leftPx}px` },
              title: `${pInfo.label} @ ${kf.time.toFixed(2)}s (${kf.inInterp}/${kf.outInterp}) · 拖移时间 / Alt拖拉伸`,
            });

            kfEl.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              this.app.seekTo(kf.time);
            });

            kfEl.addEventListener('pointerdown', (e) => {
              e.stopPropagation();
              if (lyr.locked) return;
              const already = (project.selectedKeyframes || []).some(
                (s) => s.layerId === lyr.id && s.propPath === pInfo.path && s.kfId === kf.id
              );
              if (e.shiftKey) {
                if (already) {
                  project.selectedKeyframes = project.selectedKeyframes.filter(
                    (s) => !(s.layerId === lyr.id && s.propPath === pInfo.path && s.kfId === kf.id)
                  );
                } else {
                  project.selectedKeyframes.push({ layerId: lyr.id, propPath: pInfo.propPath || pInfo.path, kfId: kf.id });
                }
              } else if (!already) {
                project.selectedKeyframes = [{ layerId: lyr.id, propPath: pInfo.path, kfId: kf.id }];
              }
              this._refreshKfSelectionHighlight();
              this.app.setGraphTarget(lyr.id, pInfo.path, false);

              // 构建全部要一起拖动/拉伸的关键帧列表
              const items = [];
              const touchedProps = new Set();
              let minTime = Infinity;
              let maxTime = -Infinity;
              for (const s of project.selectedKeyframes) {
                const sLyr = getLayerById(comp, s.layerId);
                const sProp = sLyr ? resolvePropertyByPath(sLyr, s.propPath) : null;
                const sKf = sProp?.keyframes?.find((k) => k.id === s.kfId);
                const sDia = this._kfDiamonds.find(
                  (d) => d.layerId === s.layerId && d.propPath === s.propPath && d.kfId === s.kfId
                );
                if (sProp && sKf && sDia) {
                  items.push({ kf: sKf, origTime: sKf.time, el: sDia.el });
                  touchedProps.add(sProp);
                  minTime = Math.min(minTime, sKf.time);
                  maxTime = Math.max(maxTime, sKf.time);
                }
              }
              if (!items.length) return;
              const isStretch = e.altKey && items.length >= 2 && (maxTime - minTime) > 1e-4;
              const fromMinSide = Math.abs(kf.time - minTime) < Math.abs(maxTime - kf.time);
              this.app.history.beginTransaction(project, isStretch ? '拉伸关键帧区间' : '移动关键帧');
              this._dragState = {
                kind: isStretch ? 'kfStretch' : 'kfMove',
                startX: e.clientX,
                items,
                touchedProps,
                minTime,
                maxTime,
                fromMinSide,
              };
            });

            pRight.appendChild(kfEl);
            this._kfDiamonds.push({
              el: kfEl,
              layerId: lyr.id,
              propPath: pInfo.path,
              kfId: kf.id,
              leftPx,
              topPx: curY + ROW_PROP_H * 0.5,
            });
          }

          this.tracksInnerEl.appendChild(pRight);
          curY += ROW_PROP_H;
        }
      }
    });

    this.tracksInnerEl.style.minHeight = `${Math.max(220, curY + 40)}px`;
    this.updatePlayheadOnly();
  }

  _selectLayer(layerId, additive = false, keepSelectionIfPresent = false) {
    const project = this.app.project;
    if (!project) return;
    if (!additive) {
      if (keepSelectionIfPresent && (project.selectedLayerIds || []).includes(layerId)) return;
      project.selectedLayerIds = [layerId];
    } else {
      const set = new Set(project.selectedLayerIds || []);
      if (set.has(layerId)) set.delete(layerId);
      else set.add(layerId);
      project.selectedLayerIds = [...set];
    }
    this.app.refreshAll();
  }

  _moveLayerOrder(layerId, delta) {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!comp) return;
    const idx = comp.layers.findIndex((l) => l.id === layerId);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= comp.layers.length) return;
    this.app.history.recordAction(project, '调整图层叠放顺序', () => {
      const [item] = comp.layers.splice(idx, 1);
      comp.layers.splice(nextIdx, 0, item);
    });
    this.app.refreshAll();
  }
}
