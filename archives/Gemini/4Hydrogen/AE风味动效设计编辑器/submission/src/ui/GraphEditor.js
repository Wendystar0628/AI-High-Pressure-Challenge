// 图表编辑器：支持真实「值曲线 (Value Graph)」与「速度曲线 (Speed Graph)」切换、贝塞尔入/出影响力与速度手柄拖拽、空间路径弧长速度显示以及表达式评估曲线叠加

import { clamp, lerp } from '../core/math.js';
import {
  evalPropertyKeyframeValue,
  evalPropertySpeed,
  getSpatialSegmentLength,
  applyEasyEaseToKeyframes,
  sortKeyframes,
  invalidateSpatialCache,
} from '../core/property.js';
import { resolvePropertyByPath, sampleExpressionCurve } from '../core/expressions.js';
import { getActiveComp, getLayerById } from '../core/project.js';
import { el, getLayerAnimatableProps, propValueToScalars, showToast } from './helpers.js';

const COMP_COLORS = ['#ef4444', '#22c55e', '#38bdf8', '#fbbf24'];
const COMP_NAMES = ['X / R', 'Y / G', 'Z / B', 'W / A'];

export class GraphEditor {
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;
    this.mode = 'value'; // 'value' | 'speed'
    this.compIndex = 0; // 对多维非空间属性选择一个分量编辑，-1 仅显示叠加
    this._drag = null;
    this._handles = [];
    this._view = { tMin: 0, tMax: 15, vMin: 0, vMax: 100, padL: 52, padR: 18, padT: 16, padB: 24, w: 600, h: 200 };

    this._renderSkeleton();
    this._bindEvents();
  }

  _renderSkeleton() {
    this.containerEl.innerHTML = '';
    this.barEl = el('div', { className: 'ge-toolbar' });
    this.canvasWrapEl = el('div', { className: 'ge-canvas-wrap' });
    this.canvas = el('canvas', { className: 'ge-canvas' });
    this.exprBannerEl = el('div', { className: 'ge-expr-banner hidden' });
    this.canvasWrapEl.appendChild(this.canvas);
    this.canvasWrapEl.appendChild(this.exprBannerEl);

    this.containerEl.appendChild(this.barEl);
    this.containerEl.appendChild(this.canvasWrapEl);
    this._buildToolbar();
  }

  _buildToolbar() {
    this.barEl.innerHTML = '';
    this.modeValBtn = el('button', {
      className: `ae-btn sm ${this.mode === 'value' ? 'primary' : ''}`,
      text: '值曲线 (Value)',
      onClick: () => {
        this.mode = 'value';
        this.render();
      },
    });
    this.modeSpdBtn = el('button', {
      className: `ae-btn sm ${this.mode === 'speed' ? 'primary' : ''}`,
      text: '速度曲线 (Speed)',
      onClick: () => {
        this.mode = 'speed';
        this.render();
      },
    });

    this.propSelect = el('select', { className: 'ae-select sm ge-prop-select' });
    this.propSelect.addEventListener('change', () => {
      const val = this.propSelect.value;
      if (!val) return;
      const [lid, path] = val.split('::');
      this.app.setGraphTarget(lid, path, true);
    });

    this.compSelect = el('select', { className: 'ae-select sm ge-comp-select' });
    this.compSelect.addEventListener('change', () => {
      this.compIndex = Number(this.compSelect.value) || 0;
      this.render();
    });

    this.infoSpan = el('span', { className: 'ge-info-span', text: '' });

    const interpBtns = el('div', { className: 'tl-tb-group' }, [
      el('button', { className: 'ae-btn sm', text: '线性', title: '设为线性插值', onClick: () => this._setSelectedInterp('linear') }),
      el('button', { className: 'ae-btn sm', text: 'F9 缓入缓出', title: '设为柔和贝塞尔缓动', onClick: () => this._setSelectedInterp('bezier') }),
      el('button', { className: 'ae-btn sm', text: '缓入', onClick: () => this._setSelectedInterp('in') }),
      el('button', { className: 'ae-btn sm', text: '缓出', onClick: () => this._setSelectedInterp('out') }),
      el('button', { className: 'ae-btn sm', text: '定格 (Hold)', title: '设为阶梯定格', onClick: () => this._setSelectedInterp('hold') }),
      el('button', {
        className: 'ae-btn sm',
        text: '关闭',
        onClick: () => this.app.toggleGraphEditor(false),
      }),
    ]);

    this.barEl.appendChild(el('div', { className: 'tl-tb-group' }, [
      el('span', { className: 'panel-title sm', text: '曲线编辑器' }),
      this.modeValBtn,
      this.modeSpdBtn,
      this.propSelect,
      this.compSelect,
      this.infoSpan,
    ]));
    this.barEl.appendChild(interpBtns);
  }

  _setSelectedInterp(kind) {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    const { layer, prop, propPath } = this._getActiveTarget(project, comp);
    if (!layer || !prop || !prop.keyframes?.length) return;

    const selIds = (project.selectedKeyframes || [])
      .filter((s) => s.layerId === layer.id && s.propPath === propPath)
      .map((s) => s.kfId);
    const ids = selIds.length ? selIds : prop.keyframes.map((k) => k.id);

    this.app.history.recordAction(project, `曲线插值设为 ${kind}`, () => {
      if (kind === 'bezier' || kind === 'in' || kind === 'out') {
        applyEasyEaseToKeyframes(prop, ids, kind === 'bezier' ? 'both' : kind);
      } else {
        const set = new Set(ids);
        for (const kf of prop.keyframes) {
          if (!set.has(kf.id)) continue;
          kf.inInterp = kind;
          kf.outInterp = kind;
        }
      }
      invalidateSpatialCache(prop);
    });
    this.app.refreshAll();
  }

  _getActiveTarget(project, comp) {
    if (!project || !comp) return { layer: null, prop: null, propPath: '' };
    let layer = this.app.graphTarget?.layerId ? getLayerById(comp, this.app.graphTarget.layerId) : null;
    if (!layer) layer = getLayerById(comp, project.selectedLayerIds?.[0]) || comp.layers[0] || null;
    if (!layer) return { layer: null, prop: null, propPath: '' };

    const allProps = getLayerAnimatableProps(layer);
    let propPath = this.app.graphTarget?.propPath || '';
    let prop = propPath ? resolvePropertyByPath(layer, propPath) : null;
    if (!prop) {
      const anim = allProps.find((p) => (p.prop.keyframes?.length || 0) > 0 || p.prop.expressionEnabled);
      const chosen = anim || allProps.find((p) => p.path === 'transform.position') || allProps[0];
      if (chosen) {
        propPath = chosen.path;
        prop = chosen.prop;
      }
    }
    return { layer, prop, propPath, allProps };
  }

  _tToX(t) {
    const v = this._view;
    const innerW = Math.max(10, v.w - v.padL - v.padR);
    return v.padL + ((t - v.tMin) / Math.max(1e-5, v.tMax - v.tMin)) * innerW;
  }

  _xToT(x) {
    const v = this._view;
    const innerW = Math.max(10, v.w - v.padL - v.padR);
    return v.tMin + ((x - v.padL) / innerW) * (v.tMax - v.tMin);
  }

  _vToY(val) {
    const v = this._view;
    const innerH = Math.max(10, v.h - v.padT - v.padB);
    return v.padT + (1 - (val - v.vMin) / Math.max(1e-5, v.vMax - v.vMin)) * innerH;
  }

  _yToV(y) {
    const v = this._view;
    const innerH = Math.max(10, v.h - v.padT - v.padB);
    return v.vMin + (1 - (y - v.padT) / innerH) * (v.vMax - v.vMin);
  }

  _bindEvents() {
    this.canvas.addEventListener('pointerdown', (e) => {
      const project = this.app.project;
      const comp = this.app.getActiveComp();
      const { layer, prop, propPath } = this._getActiveTarget(project, comp);
      if (!layer || !prop) return;

      const r = this.canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;

      // 命中手柄或关键帧点
      let best = null;
      let bestDist = 12;
      for (const h of this._handles) {
        const d = Math.hypot(h.x - px, h.y - py);
        if (d < bestDist) {
          bestDist = d;
          best = h;
        }
      }

      if (!best) {
        // 点击空白处移动播放头
        const t = clamp(this._xToT(px), 0, comp.duration);
        this.app.seekTo(t);
        this._drag = { kind: 'playhead' };
        return;
      }

      this.app.history.beginTransaction(project, '曲线编辑器调整关键帧');
      if (best.kind === 'kf') {
        project.selectedKeyframes = [{ layerId: layer.id, propPath, kfId: best.kf.id }];
        this._drag = {
          kind: 'kf',
          layer,
          prop,
          propPath,
          kf: best.kf,
          compIdx: best.compIdx,
          startVal: best.val,
        };
      } else {
        this._drag = {
          kind: best.kind, // 'outHandle' | 'inHandle'
          layer,
          prop,
          propPath,
          kf0: best.k0,
          kf1: best.k1,
          compIdx: best.compIdx,
          segLength: best.segLength,
        };
      }
      this.render();
    });

    window.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const r = this.canvas.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const d = this._drag;

      if (d.kind === 'playhead') {
        this.app.seekTo(clamp(this._xToT(px), 0, comp.duration));
        return;
      }

      const ht = clamp(this._xToT(px), 0, comp.duration);
      const hv = this._yToV(py);

      if (d.kind === 'kf') {
        d.kf.time = Math.max(0, Math.round(ht * 1000) / 1000);
        if (this.mode === 'value') {
          if (typeof d.kf.value === 'number') {
            d.kf.value = Math.round(hv * 1000) / 1000;
          } else if (Array.isArray(d.kf.value) && d.compIdx < d.kf.value.length) {
            d.kf.value[d.compIdx] = Math.round(hv * 1000) / 1000;
          }
        }
        sortKeyframes(d.prop);
        invalidateSpatialCache(d.prop);
      } else if (d.kind === 'outHandle' || d.kind === 'inHandle') {
        const dt = d.kf1.time - d.kf0.time;
        if (dt <= 1e-5) return;
        const isOut = d.kind === 'outHandle';
        const targetKf = isOut ? d.kf0 : d.kf1;
        const inf = isOut
          ? clamp((ht - d.kf0.time) / dt, 0.01, 1)
          : clamp((d.kf1.time - ht) / dt, 0.01, 1);

        let spd = hv;
        if (this.mode === 'value') {
          const v0 = Array.isArray(d.kf0.value) ? (d.kf0.value[d.compIdx] ?? 0) : Number(d.kf0.value);
          const v1 = Array.isArray(d.kf1.value) ? (d.kf1.value[d.compIdx] ?? 0) : Number(d.kf1.value);
          spd = isOut ? (hv - v0) / (dt * inf) : (v1 - hv) / (dt * inf);
        }

        if (isOut) {
          targetKf.outInterp = 'bezier';
          targetKf.outEase = { influence: Number((inf * 100).toFixed(2)), speed: Number(spd.toFixed(3)) };
        } else {
          targetKf.inInterp = 'bezier';
          targetKf.inEase = { influence: Number((inf * 100).toFixed(2)), speed: Number(spd.toFixed(3)) };
        }
        invalidateSpatialCache(d.prop);
      }

      this.app.renderCurrentFrame();
      this.render();
      this.app.refreshPropertiesValuesOnly();
    });

    window.addEventListener('pointerup', () => {
      if (!this._drag) return;
      const kind = this._drag.kind;
      this._drag = null;
      if (kind !== 'playhead') {
        this.app.history.commitTransaction(this.app.project);
        this.app.refreshAll();
      }
    });
  }

  render() {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!project || !comp) return;

    this.modeValBtn.classList.toggle('primary', this.mode === 'value');
    this.modeSpdBtn.classList.toggle('primary', this.mode === 'speed');

    const { layer, prop, propPath, allProps } = this._getActiveTarget(project, comp);

    // 刷新属性下拉菜单
    this.propSelect.innerHTML = '';
    if (layer && allProps?.length) {
      for (const ap of allProps) {
        const hasAnim = (ap.prop.keyframes?.length || 0) > 0 || ap.prop.expressionEnabled;
        this.propSelect.appendChild(
          el('option', {
            value: `${layer.id}::${ap.path}`,
            text: `${layer.name} · ${ap.label}${hasAnim ? ' ★' : ''}`,
            selected: ap.path === propPath,
          })
        );
      }
    }

    // 刷新分量选择器
    this.compSelect.innerHTML = '';
    const isVec = prop && Array.isArray(prop.value);
    const dim = isVec ? prop.value.length : 1;
    if (isVec && !(this.mode === 'speed' && prop.spatial)) {
      this.compSelect.style.display = '';
      if (this.compIndex >= dim) this.compIndex = 0;
      for (let c = 0; c < Math.min(4, dim); c++) {
        this.compSelect.appendChild(
          el('option', { value: String(c), text: `分量 ${COMP_NAMES[c] || c}`, selected: this.compIndex === c })
        );
      }
    } else {
      this.compSelect.style.display = 'none';
      this.compIndex = 0;
    }

    // 尺寸适配
    const rect = this.canvasWrapEl.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width || 680));
    const h = Math.max(140, Math.floor(rect.height || 190));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#12151c';
    ctx.fillRect(0, 0, w, h);

    this._handles = [];
    if (!prop) {
      this.infoSpan.textContent = '请选择图层属性以绘制曲线';
      this.exprBannerEl.classList.add('hidden');
      return;
    }

    const spatialMode = prop.spatial && this.mode === 'speed';
    if (spatialMode && prop.keyframes?.length >= 2) {
      const segLens = [];
      for (let i = 0; i < prop.keyframes.length - 1; i++) {
        segLens.push(`${getSpatialSegmentLength(prop, i).toFixed(0)}px`);
      }
      this.infoSpan.textContent = `空间弧长速率 · 线形等速 (${segLens.join(', ')})`;
    } else if (prop.expressionEnabled) {
      this.infoSpan.textContent = '紫虚线 = 表达式真实求值曲线';
    } else {
      this.infoSpan.textContent = `${prop.keyframes?.length || 0} 个关键帧`;
    }

    // 采样关键帧曲线与表达式曲线以确定 Y 轴范围
    const tMin = 0;
    const tMax = Math.max(0.5, comp.duration);
    const SAMPLES = 180;
    const compCount = (this.mode === 'value' && isVec) ? Math.min(3, dim) : 1;

    const baseCurves = Array.from({ length: compCount }, () => []);
    for (let i = 0; i <= SAMPLES; i++) {
      const t = lerp(tMin, tMax, i / SAMPLES);
      if (this.mode === 'value') {
        const kv = evalPropertyKeyframeValue(prop, t);
        const arr = propValueToScalars(kv, prop.type);
        for (let c = 0; c < compCount; c++) {
          baseCurves[c].push({ t, v: arr[c] ?? 0 });
        }
      } else {
        const spd = evalPropertySpeed(prop, t, this.compIndex);
        baseCurves[0].push({ t, v: spd });
      }
    }

    let exprCurve = null;
    if (prop.expressionEnabled && this.mode === 'value') {
      const sampled = sampleExpressionCurve(project, comp, layer, propPath, tMin, tMax, SAMPLES);
      const cIdx = isVec ? this.compIndex : 0;
      exprCurve = sampled.map((pt) => {
        const arr = propValueToScalars(pt.value, prop.type);
        return { t: pt.time, v: arr[cIdx] ?? 0 };
      });
    }

    let vMin = Infinity;
    let vMax = -Infinity;
    for (const curve of baseCurves) {
      for (const pt of curve) {
        if (pt.v < vMin) vMin = pt.v;
        if (pt.v > vMax) vMax = pt.v;
      }
    }
    if (exprCurve) {
      for (const pt of exprCurve) {
        if (pt.v < vMin) vMin = pt.v;
        if (pt.v > vMax) vMax = pt.v;
      }
    }
    if (!Number.isFinite(vMin) || !Number.isFinite(vMax)) {
      vMin = 0; vMax = 100;
    }
    const span = vMax - vMin;
    const padY = span < 1e-4 ? 10 : span * 0.22;
    this._view = { tMin, tMax, vMin: vMin - padY, vMax: vMax + padY, padL: 52, padR: 18, padT: 16, padB: 24, w, h };

    // 网格线与刻度
    ctx.strokeStyle = '#212734';
    ctx.fillStyle = '#7e8ba0';
    ctx.font = '10px "Microsoft YaHei", monospace';
    ctx.lineWidth = 1;
    const rows = 4;
    for (let r = 0; r <= rows; r++) {
      const val = lerp(this._view.vMin, this._view.vMax, r / rows);
      const y = Math.round(this._vToY(val)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(this._view.padL, y);
      ctx.lineTo(w - this._view.padR, y);
      ctx.stroke();
      ctx.fillText(Math.abs(val) >= 100 ? val.toFixed(0) : val.toFixed(1), 6, y + 3);
    }

    const secStep = tMax > 12 ? 2 : 1;
    for (let t = 0; t <= tMax + 1e-4; t += secStep) {
      const x = Math.round(this._tToX(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, this._view.padT);
      ctx.lineTo(x, h - this._view.padB);
      ctx.stroke();
      ctx.fillText(`${t.toFixed(0)}s`, x - 6, h - 7);
    }

    // 绘制 0 基准线
    if (this._view.vMin < 0 && this._view.vMax > 0) {
      const y0 = Math.round(this._vToY(0)) + 0.5;
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.beginPath();
      ctx.moveTo(this._view.padL, y0);
      ctx.lineTo(w - this._view.padR, y0);
      ctx.stroke();
    }

    // 绘制关键帧曲线
    for (let c = 0; c < compCount; c++) {
      const curve = baseCurves[c];
      const isPrimary = c === (isVec && this.mode === 'value' ? this.compIndex : 0);
      ctx.strokeStyle = this.mode === 'speed' ? '#38bdf8' : COMP_COLORS[c % COMP_COLORS.length];
      ctx.lineWidth = isPrimary ? 2.1 : 1.1;
      ctx.globalAlpha = isPrimary ? 1 : 0.45;
      ctx.beginPath();
      curve.forEach((pt, idx) => {
        const x = this._tToX(pt.t);
        const y = this._vToY(pt.v);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 叠加表达式实时求值曲线
    if (exprCurve) {
      ctx.save();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      exprCurve.forEach((pt, idx) => {
        const x = this._tToX(pt.t);
        const y = this._vToY(pt.v);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 绘制选中关键帧点与贝塞尔手柄
    const kfs = prop.keyframes || [];
    const activeCompIdx = isVec && this.mode === 'value' ? this.compIndex : 0;
    const selList = project.selectedKeyframes || [];

    for (let i = 0; i < kfs.length; i++) {
      const kf = kfs[i];
      const kfScalar = this.mode === 'value'
        ? (propValueToScalars(kf.value, prop.type)[activeCompIdx] ?? 0)
        : evalPropertySpeed(prop, Math.min(comp.duration, kf.time + 0.002), this.compIndex);
      const kx = this._tToX(kf.time);
      const ky = this._vToY(kfScalar);
      const isSel = selList.some((s) => s.layerId === layer.id && s.propPath === propPath && s.kfId === kf.id);

      // 与下一关键帧之间的出/入手柄（仅针对首/选中的关键帧段或相邻关键帧绘制）
      if (i < kfs.length - 1) {
        const k1 = kfs[i + 1];
        const dt = k1.time - kf.time;
        if (dt > 1e-4 && kf.outInterp !== 'hold') {
          const outInf = clamp((kf.outEase?.influence ?? 33.33) / 100, 0.01, 1);
          const inInf = clamp((k1.inEase?.influence ?? 33.33) / 100, 0.01, 1);
          const v0 = propValueToScalars(kf.value, prop.type)[activeCompIdx] ?? 0;
          const v1 = propValueToScalars(k1.value, prop.type)[activeCompIdx] ?? 0;
          const segLen = prop.spatial ? getSpatialSegmentLength(prop, i) : 1;

          const outSpd = kf.outInterp === 'linear' ? (v1 - v0) / dt : (kf.outEase?.speed ?? 0);
          const inSpd = k1.inInterp === 'linear' ? (v1 - v0) / dt : (k1.inEase?.speed ?? 0);

          const outHt = kf.time + outInf * dt;
          const outHv = this.mode === 'value' ? v0 + outSpd * dt * outInf : outSpd;
          const ox = this._tToX(outHt);
          const oy = this._vToY(outHv);

          const inHt = k1.time - inInf * dt;
          const inHv = this.mode === 'value' ? v1 - inSpd * dt * inInf : inSpd;
          const ix = this._tToX(inHt);
          const iy = this._vToY(inHv);

          const anchorOutY = this.mode === 'value' ? ky : this._vToY(outSpd);
          const anchorInY = this.mode === 'value' ? this._vToY(v1) : this._vToY(inSpd);
          const k1x = this._tToX(k1.time);

          if (this.mode === 'speed' || kf.outInterp === 'bezier' || isSel) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(kx, anchorOutY); ctx.lineTo(ox, oy); ctx.stroke();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
            this._handles.push({ kind: 'outHandle', x: ox, y: oy, k0: kf, k1, compIdx: activeCompIdx, segLength: segLen });
          }
          if (this.mode === 'speed' || k1.inInterp === 'bezier' || isSel) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(k1x, anchorInY); ctx.lineTo(ix, iy); ctx.stroke();
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.arc(ix, iy, 4, 0, Math.PI * 2); ctx.fill();
            this._handles.push({ kind: 'inHandle', x: ix, y: iy, k0: kf, k1, compIdx: activeCompIdx, segLength: segLen });
          }
        }
      }

      // 关键帧节点
      ctx.fillStyle = isSel ? '#facc15' : '#e2e8f0';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(kx - 4.5, ky - 4.5, 9, 9);
      ctx.fill();
      ctx.stroke();

      this._handles.push({ kind: 'kf', x: kx, y: ky, kf, compIdx: activeCompIdx, val: kfScalar });
    }

    // 当前时间播放头红线
    const phx = this._tToX(comp.currentTime);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(phx, 0);
    ctx.lineTo(phx, h);
    ctx.stroke();

    // 表达式错误横幅
    const err = layer._exprErrors?.[propPath];
    if (err) {
      this.exprBannerEl.classList.remove('hidden');
      this.exprBannerEl.textContent = `表达式异常 (已回退基础值): ${err}`;
    } else {
      this.exprBannerEl.classList.add('hidden');
    }
  }
}
