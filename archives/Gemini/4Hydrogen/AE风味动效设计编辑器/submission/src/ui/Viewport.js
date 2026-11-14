// 合成画布与交互式控件叠加层：2D/3D 变换拖拽（父级下跟手）、锚点无偏移调整、空间运动路径与手柄编辑、钢笔/形状绘制、图钉编辑与辅助指示

import {
  clamp,
  lerp,
  mat4Invert,
  mat4TransformPoint,
  mat4TransformVector,
  evalCubicBezier,
  DEG2RAD,
} from '../core/math.js';
import { addOrUpdateKeyframe, cloneVal } from '../core/property.js';
import { evalProperty } from '../core/expressions.js';
import {
  getLayerById,
  getLayerWorldMatrix,
  getParentWorldMatrix,
  moveAnchorPreserveVisual,
  createLayer,
  createPuppetPin,
  isLayerActiveAtTime,
  defaultRectPath,
  defaultEllipsePath,
} from '../core/project.js';
import { evaluateShapeLayerGeometry, flattenContour } from '../geometry/shapes.js';
import { evaluateNodeGraphOutput } from '../nodes/nodeGraph.js';

export class ViewportController {
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;

    this.stageEl = document.createElement('div');
    this.stageEl.className = 'viewport-stage';
    this.containerEl.appendChild(this.stageEl);

    this.glCanvas = document.createElement('canvas');
    this.glCanvas.className = 'viewport-gl-canvas';
    this.stageEl.appendChild(this.glCanvas);

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'viewport-overlay-canvas';
    this.stageEl.appendChild(this.overlayCanvas);
    this.octx = this.overlayCanvas.getContext('2d');

    this.emptyHintEl = document.createElement('div');
    this.emptyHintEl.className = 'viewport-empty-hint';
    this.emptyHintEl.innerHTML =
      '<div class="hint-title">当前合成暂无可见图层</div><div class="hint-sub">点击上方「+ 新建图层」或使用矩形 / 椭圆 / 钢笔 / 文字工具直接在画布创作</div>';
    this.stageEl.appendChild(this.emptyHintEl);

    this.hudBadgeEl = document.createElement('div');
    this.hudBadgeEl.className = 'viewport-hud-badge';
    this.stageEl.appendChild(this.hudBadgeEl);

    // 视图缩放与平移状态
    this.viewZoom = 1;
    this.viewFit = true;
    this.viewPan = [0, 0];
    this.showGrid = false;
    this.showGizmos = true;
    this.tool = 'select'; // 'select' | 'hand' | 'anchor' | 'pen' | 'rect' | 'ellipse' | 'text' | 'pin' | 'orbit'

    this._drag = null;
    this._penDraft = null;
    this._layoutMetrics = { scale: 1, offsetX: 0, offsetY: 0, dispW: 1280, dispH: 720 };

    this._bindEvents();
  }

  getCanvas() {
    return this.glCanvas;
  }

  // 计算画布与容器之间的屏幕像素映射
  updateLayoutMetrics(comp) {
    if (!comp) return;
    const rect = this.stageEl.getBoundingClientRect();
    const availW = Math.max(100, rect.width - 24);
    const availH = Math.max(100, rect.height - 24);
    const fitScale = Math.min(availW / comp.width, availH / comp.height);
    const scale = this.viewFit ? fitScale : fitScale * this.viewZoom;
    const dispW = Math.max(2, comp.width * scale);
    const dispH = Math.max(2, comp.height * scale);
    const offsetX = (rect.width - dispW) * 0.5 + this.viewPan[0];
    const offsetY = (rect.height - dispH) * 0.5 + this.viewPan[1];

    this._layoutMetrics = { scale, offsetX, offsetY, dispW, dispH, stageW: rect.width, stageH: rect.height };

    this.glCanvas.style.width = `${dispW}px`;
    this.glCanvas.style.height = `${dispH}px`;
    this.glCanvas.style.left = `${offsetX}px`;
    this.glCanvas.style.top = `${offsetY}px`;
    this.glCanvas.classList.toggle('transparent-checker', !!comp.transparentBg);

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ow = Math.max(2, Math.round(rect.width * dpr));
    const oh = Math.max(2, Math.round(rect.height * dpr));
    if (this.overlayCanvas.width !== ow || this.overlayCanvas.height !== oh) {
      this.overlayCanvas.width = ow;
      this.overlayCanvas.height = oh;
    }
    this.overlayCanvas.style.width = `${rect.width}px`;
    this.overlayCanvas.style.height = `${rect.height}px`;
  }

  clientToStage(clientX, clientY) {
    const r = this.stageEl.getBoundingClientRect();
    return [clientX - r.left, clientY - r.top];
  }

  stageToNormalized(sx, sy) {
    const { offsetX, offsetY, dispW, dispH } = this._layoutMetrics;
    return [(sx - offsetX) / dispW, (sy - offsetY) / dispH];
  }

  compToStage(cx, cy, comp) {
    const { offsetX, offsetY, dispW, dispH } = this._layoutMetrics;
    return [offsetX + (cx / comp.width) * dispW, offsetY + (cy / comp.height) * dispH];
  }

  aePointToStage(aePt, comp) {
    const norm = this.app.compositor.projectAEPointToNormalized(aePt, comp);
    const { offsetX, offsetY, dispW, dispH } = this._layoutMetrics;
    return {
      x: offsetX + norm.x * dispW,
      y: offsetY + norm.y * dispH,
      visible: norm.visible,
    };
  }

  // 根据当前 3D 摄像机投影，计算屏幕像素增量在目标世界平面上的 AE 世界位移
  screenDeltaToWorldDelta(dxStage, dyStage, refWorldAE, comp) {
    const { dispW, dispH } = this._layoutMetrics;
    const cam = this.app.compositor.getActiveThreeCamera();
    if (!cam) {
      return [(dxStage / dispW) * comp.width, (dyStage / dispH) * comp.height, 0];
    }
    // 使用中心深度比例把像素增量映射到与摄影机正交且经过 refWorldAE 的平面
    const p0 = this.aePointToStage(refWorldAE, comp);
    const pX = this.aePointToStage([refWorldAE[0] + 100, refWorldAE[1], refWorldAE[2] || 0], comp);
    const pY = this.aePointToStage([refWorldAE[0], refWorldAE[1] + 100, refWorldAE[2] || 0], comp);

    // 2x2 屏幕雅可比逆映射（即使摄像机倾斜/旋转依然精确跟手）
    const ax = (pX.x - p0.x) / 100;
    const ay = (pX.y - p0.y) / 100;
    const bx = (pY.x - p0.x) / 100;
    const by = (pY.y - p0.y) / 100;
    const det = ax * by - ay * bx;
    if (Math.abs(det) > 1e-5) {
      return [
        (dxStage * by - dyStage * bx) / det,
        (ax * dyStage - ay * dxStage) / det,
        0,
      ];
    }
    return [(dxStage / dispW) * comp.width, (dyStage / dispH) * comp.height, 0];
  }

  // 把世界增量经父级矩阵逆变换到本地 position 增量
  applyWorldDeltaToLayerPosition(project, comp, layer, worldDelta, time) {
    const parentM = getParentWorldMatrix(project, comp, layer, time);
    const invParentM = mat4Invert(parentM);
    const localDelta = mat4TransformVector(invParentM, worldDelta);
    const curPos = evalProperty(project, comp, layer, 'transform.position', time);
    const nextPos = [
      (curPos[0] || 0) + localDelta[0],
      (curPos[1] || 0) + localDelta[1],
      layer.is3D ? (curPos[2] || 0) + localDelta[2] : (curPos[2] || 0),
    ];
    this.app.setPropertyValue(layer, 'transform.position', nextPos, time);
  }

  drawOverlays() {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!comp) return;
    this.updateLayoutMetrics(comp);

    const hasVisible = comp.layers.some((l) => l.visible);
    this.emptyHintEl.style.display = hasVisible ? 'none' : 'flex';

    const t = comp.currentTime;
    const selIds = project.selectedLayerIds || [];
    this.hudBadgeEl.textContent = `${comp.name} · ${comp.width}×${comp.height} · ${comp.fps}fps · ${
      selIds.length === 0 ? '未选中图层' : selIds.length === 1 ? `已选: ${getLayerById(comp, selIds[0])?.name || ''}` : `已多选 ${selIds.length} 个图层`
    }`;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ctx = this.octx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, this._layoutMetrics.stageW, this._layoutMetrics.stageH);

    // 辅助参考网格
    if (this.showGrid) {
      this._drawGrid(ctx, comp);
    }

    if (!this.showGizmos || this.app.isExportMode) {
      ctx.restore();
      return;
    }

    // 1. 绘制场景中所有空间场、光源与非活动摄像机指示
    for (const lyr of comp.layers) {
      if (!isLayerActiveAtTime(lyr, t)) continue;
      const isSel = selIds.includes(lyr.id);
      if (lyr.spatialField && lyr.spatialField.enabled) {
        this._drawSpatialFieldGizmo(ctx, project, comp, lyr, t, isSel);
      }
      if (lyr.type === 'light') {
        this._drawLightGizmo(ctx, project, comp, lyr, t, isSel);
      }
      if (lyr.type === 'camera' && isSel) {
        this._drawCameraTargetGizmo(ctx, project, comp, lyr, t);
      }
    }

    // 2. 绘制选中图层的边界、变换手柄、运动路径与控制点（仅当图层在当前时间可见且激活）
    this._interactiveHandles = [];
    for (const lid of selIds) {
      const lyr = getLayerById(comp, lid);
      if (!lyr || !lyr.visible || !isLayerActiveAtTime(lyr, t)) continue;
      this._drawLayerGizmos(ctx, project, comp, lyr, t, selIds.length === 1);
    }

    // 多选联合提示框
    if (selIds.length > 1) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const lid of selIds) {
        const lyr = getLayerById(comp, lid);
        if (!lyr) continue;
        const wp = mat4TransformPoint(getLayerWorldMatrix(project, comp, lyr, t), [0, 0, 0]);
        const sp = this.aePointToStage(wp, comp);
        minX = Math.min(minX, sp.x); minY = Math.min(minY, sp.y);
        maxX = Math.max(maxX, sp.x); maxY = Math.max(maxY, sp.y);
      }
      if (Number.isFinite(minX)) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(minX - 24, minY - 24, maxX - minX + 48, maxY - minY + 48);
        ctx.restore();
      }
    }

    // 钢笔草稿预览
    if (this._penDraft && this._penDraft.points.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const pts = this._penDraft.points;
      const p0 = this.compToStage(pts[0].x, pts[0].y, comp);
      ctx.moveTo(p0[0], p0[1]);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const c1 = this.compToStage(a.x + a.outX, a.y + a.outY, comp);
        const c2 = this.compToStage(b.x + b.inX, b.y + b.inY, comp);
        const p = this.compToStage(b.x, b.y, comp);
        ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
      }
      ctx.stroke();
      for (const pt of pts) {
        const sp = this.compToStage(pt.x, pt.y, comp);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sp[0] - 3.5, sp[1] - 3.5, 7, 7);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  _drawGrid(ctx, comp) {
    const { offsetX, offsetY, dispW, dispH } = this._layoutMetrics;
    ctx.save();
    ctx.beginPath();
    ctx.rect(offsetX, offsetY, dispW, dispH);
    ctx.clip();

    const step = 80;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= comp.width; x += step) {
      const sx = offsetX + (x / comp.width) * dispW;
      ctx.beginPath(); ctx.moveTo(sx, offsetY); ctx.lineTo(sx, offsetY + dispH); ctx.stroke();
    }
    for (let y = 0; y <= comp.height; y += step) {
      const sy = offsetY + (y / comp.height) * dispH;
      ctx.beginPath(); ctx.moveTo(offsetX, sy); ctx.lineTo(offsetX + dispW, sy); ctx.stroke();
    }
    // 中心十字与动作安全框
    const [cx, cy] = this.compToStage(comp.width * 0.5, comp.height * 0.5, comp);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(offsetX + dispW * 0.05, offsetY + dispH * 0.05, dispW * 0.9, dispH * 0.9);
    ctx.restore();
  }

  _drawSpatialFieldGizmo(ctx, project, comp, lyr, t, isSel) {
    const wm = getLayerWorldMatrix(project, comp, lyr, t);
    const wp = mat4TransformPoint(wm, [0, 0, 0]);
    const radius = evalProperty(project, comp, lyr, 'spatialField.radius', t);
    const sp = this.aePointToStage(wp, comp);
    const spEdge = this.aePointToStage([wp[0] + radius, wp[1], wp[2]], comp);
    if (!sp.visible) return;

    const rPx = Math.max(12, Math.hypot(spEdge.x - sp.x, spEdge.y - sp.y));
    ctx.save();
    ctx.strokeStyle = isSel ? 'rgba(251, 113, 133, 0.9)' : 'rgba(251, 113, 133, 0.35)';
    ctx.lineWidth = isSel ? 1.5 : 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 场类型标识与图标
    ctx.fillStyle = isSel ? '#fb7185' : 'rgba(251, 113, 133, 0.7)';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText(`场:${lyr.name}`, sp.x + 8, sp.y - 6);
    ctx.restore();
  }

  _drawLightGizmo(ctx, project, comp, lyr, t, isSel) {
    const wm = getLayerWorldMatrix(project, comp, lyr, t);
    const wp = mat4TransformPoint(wm, [0, 0, 0]);
    const sp = this.aePointToStage(wp, comp);
    if (!sp.visible) return;
    const col = evalProperty(project, comp, lyr, 'light.color', t);
    const css = `rgb(${Math.round(col[0] * 255)}, ${Math.round(col[1] * 255)}, ${Math.round(col[2] * 255)})`;

    ctx.save();
    ctx.strokeStyle = isSel ? '#fde047' : css;
    ctx.fillStyle = css;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sp.x + Math.cos(a) * 8, sp.y + Math.sin(a) * 8);
      ctx.lineTo(sp.x + Math.cos(a) * 13, sp.y + Math.sin(a) * 13);
      ctx.stroke();
    }
    if (lyr.light.lightType === 'directional') {
      const tgt = evalProperty(project, comp, lyr, 'light.target', t);
      const tsp = this.aePointToStage(tgt, comp);
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(tsp.x, tsp.y);
      ctx.stroke();
    }
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText(lyr.name, sp.x + 12, sp.y + 4);
    ctx.restore();
  }

  _drawCameraTargetGizmo(ctx, project, comp, lyr, t) {
    if (!lyr.camera.useTarget) return;
    const tgt = evalProperty(project, comp, lyr, 'camera.target', t);
    const tsp = this.aePointToStage(tgt, comp);
    if (!tsp.visible) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(tsp.x, tsp.y, 7, 0, Math.PI * 2);
    ctx.moveTo(tsp.x - 11, tsp.y); ctx.lineTo(tsp.x + 11, tsp.y);
    ctx.moveTo(tsp.x, tsp.y - 11); ctx.lineTo(tsp.x, tsp.y + 11);
    ctx.stroke();
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('摄像机目标点', tsp.x + 10, tsp.y - 6);
    ctx.restore();
  }

  _drawLayerGizmos(ctx, project, comp, lyr, t, isSingle) {
    const worldM = getLayerWorldMatrix(project, comp, lyr, t);
    const parentM = getParentWorldMatrix(project, comp, lyr, t);
    const anchor = evalProperty(project, comp, lyr, 'transform.anchorPoint', t);

    // 世界原点（即锚点落点）
    const anchorWorld = mat4TransformPoint(worldM, anchor);
    const originSP = this.aePointToStage(anchorWorld, comp);

    // 1. 运动路径（在最终画面投影下绘制，支持父级下拖动关键帧和空间切线手柄）
    const posProp = lyr.transform.position;
    if (posProp.animated && posProp.keyframes.length >= 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 1.4;
      const kfs = posProp.keyframes;
      for (let i = 0; i < kfs.length - 1; i++) {
        const k0 = kfs[i], k1 = kfs[i + 1];
        const p0 = k0.value, p3 = k1.value;
        const p1 = [p0[0] + (k0.outTangent?.[0] || 0), p0[1] + (k0.outTangent?.[1] || 0), (p0[2] || 0) + (k0.outTangent?.[2] || 0)];
        const p2 = [p3[0] + (k1.inTangent?.[0] || 0), p3[1] + (k1.inTangent?.[1] || 0), (p3[2] || 0) + (k1.inTangent?.[2] || 0)];
        ctx.beginPath();
        for (let s = 0; s <= 24; s++) {
          const lp = evalCubicBezier(p0, p1, p2, p3, s / 24);
          const wp = mat4TransformPoint(parentM, lp);
          const sp = this.aePointToStage(wp, comp);
          if (s === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        }
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 空间关键帧点与空间切线手柄
      for (let i = 0; i < kfs.length; i++) {
        const kf = kfs[i];
        const kw = mat4TransformPoint(parentM, kf.value);
        const ksp = this.aePointToStage(kw, comp);
        if (!ksp.visible) continue;

        const drawTangentHandle = (tang, kind) => {
          if (!tang || Math.hypot(tang[0] || 0, tang[1] || 0, tang[2] || 0) < 0.5) return;
          const tw = mat4TransformPoint(parentM, [kf.value[0] + tang[0], kf.value[1] + tang[1], (kf.value[2] || 0) + (tang[2] || 0)]);
          const tsp = this.aePointToStage(tw, comp);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.beginPath(); ctx.moveTo(ksp.x, ksp.y); ctx.lineTo(tsp.x, tsp.y); ctx.stroke();
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath(); ctx.arc(tsp.x, tsp.y, 4, 0, Math.PI * 2); ctx.fill();
          this._interactiveHandles.push({
            kind: 'spatialTangent',
            layerId: lyr.id,
            kfIndex: i,
            tangentKind: kind,
            x: tsp.x,
            y: tsp.y,
            worldAnchor: tw,
          });
        };

        drawTangentHandle(kf.inTangent, 'in');
        drawTangentHandle(kf.outTangent, 'out');

        ctx.fillStyle = Math.abs(kf.time - t) < 0.02 ? '#f59e0b' : '#38bdf8';
        ctx.fillRect(ksp.x - 4, ksp.y - 4, 8, 8);
        this._interactiveHandles.push({
          kind: 'spatialKf',
          layerId: lyr.id,
          kfIndex: i,
          x: ksp.x,
          y: ksp.y,
          worldAnchor: kw,
        });
      }
      ctx.restore();
    }

    if (!originSP.visible) return;

    // 2. 锚点准星（在锚点位置绘制）
    ctx.save();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(originSP.x, originSP.y, 6, 0, Math.PI * 2);
    ctx.moveTo(originSP.x - 9, originSP.y); ctx.lineTo(originSP.x + 9, originSP.y);
    ctx.moveTo(originSP.x, originSP.y - 9); ctx.lineTo(originSP.x, originSP.y + 9);
    ctx.stroke();
    this._interactiveHandles.push({
      kind: 'anchor',
      layerId: lyr.id,
      x: originSP.x,
      y: originSP.y,
      worldAnchor: anchorWorld,
    });

    // 3. 2D/3D 轴向与缩放/旋转手柄（仅单选时显示完整手柄以免混乱）
    if (isSingle && lyr.type !== 'camera') {
      const axisLen = 68;
      const xTipW = mat4TransformPoint(worldM, [anchor[0] + axisLen, anchor[1], anchor[2] || 0]);
      const yTipW = mat4TransformPoint(worldM, [anchor[0], anchor[1] + axisLen, anchor[2] || 0]);
      const xTip = this.aePointToStage(xTipW, comp);
      const yTip = this.aePointToStage(yTipW, comp);

      // X 轴 (红)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(originSP.x, originSP.y); ctx.lineTo(xTip.x, xTip.y); ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(xTip.x, xTip.y, 4.5, 0, Math.PI * 2); ctx.fill();

      // Y 轴 (绿)
      ctx.strokeStyle = '#22c55e';
      ctx.beginPath(); ctx.moveTo(originSP.x, originSP.y); ctx.lineTo(yTip.x, yTip.y); ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(yTip.x, yTip.y, 4.5, 0, Math.PI * 2); ctx.fill();

      if (lyr.is3D) {
        const zTipW = mat4TransformPoint(worldM, [anchor[0], anchor[1], (anchor[2] || 0) - axisLen]);
        const zTip = this.aePointToStage(zTipW, comp);
        ctx.strokeStyle = '#3b82f6';
        ctx.beginPath(); ctx.moveTo(originSP.x, originSP.y); ctx.lineTo(zTip.x, zTip.y); ctx.stroke();
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.arc(zTip.x, zTip.y, 4.5, 0, Math.PI * 2); ctx.fill();
        this._interactiveHandles.push({ kind: 'axisZ', layerId: lyr.id, x: zTip.x, y: zTip.y, worldAnchor: anchorWorld });
      }

      this._interactiveHandles.push({ kind: 'axisX', layerId: lyr.id, x: xTip.x, y: xTip.y, worldAnchor: anchorWorld });
      this._interactiveHandles.push({ kind: 'axisY', layerId: lyr.id, x: yTip.x, y: yTip.y, worldAnchor: anchorWorld });

      // 旋转手柄与外框角点
      const rotHandleW = mat4TransformPoint(worldM, [anchor[0], anchor[1] - 96, anchor[2] || 0]);
      const rotSP = this.aePointToStage(rotHandleW, comp);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(originSP.x, originSP.y); ctx.lineTo(rotSP.x, rotSP.y); ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(rotSP.x, rotSP.y, 5, 0, Math.PI * 2); ctx.fill();
      this._interactiveHandles.push({ kind: 'rotate', layerId: lyr.id, x: rotSP.x, y: rotSP.y, centerX: originSP.x, centerY: originSP.y });

      const scaleHandleW = mat4TransformPoint(worldM, [anchor[0] + 88, anchor[1] + 88, anchor[2] || 0]);
      const scaleSP = this.aePointToStage(scaleHandleW, comp);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.setLineDash([3, 3]);
      const tlSP = this.aePointToStage(mat4TransformPoint(worldM, [anchor[0] - 88, anchor[1] - 88, anchor[2] || 0]), comp);
      const trSP = this.aePointToStage(mat4TransformPoint(worldM, [anchor[0] + 88, anchor[1] - 88, anchor[2] || 0]), comp);
      const blSP = this.aePointToStage(mat4TransformPoint(worldM, [anchor[0] - 88, anchor[1] + 88, anchor[2] || 0]), comp);
      ctx.beginPath();
      ctx.moveTo(tlSP.x, tlSP.y); ctx.lineTo(trSP.x, trSP.y); ctx.lineTo(scaleSP.x, scaleSP.y); ctx.lineTo(blSP.x, blSP.y); ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(scaleSP.x - 4, scaleSP.y - 4, 8, 8);
      this._interactiveHandles.push({ kind: 'scale', layerId: lyr.id, x: scaleSP.x, y: scaleSP.y, centerX: originSP.x, centerY: originSP.y });
    }

    // 4. 形状路径节点与切线手柄编辑
    if (isSingle && lyr.type === 'shape' && lyr.shape.source === 'path' && (this.tool === 'select' || this.tool === 'pen')) {
      const pathVal = evalProperty(project, comp, lyr, 'shape.path', t);
      for (let cIdx = 0; cIdx < (pathVal.contours || []).length; cIdx++) {
        const cont = pathVal.contours[cIdx];
        for (let pIdx = 0; pIdx < cont.points.length; pIdx++) {
          const pt = cont.points[pIdx];
          const wp = mat4TransformPoint(worldM, [pt.x, pt.y, 0]);
          const sp = this.aePointToStage(wp, comp);

          const drawBezHandle = (hx, hy, kind) => {
            if (Math.hypot(hx, hy) < 0.5 && this.tool !== 'pen') return;
            const hwp = mat4TransformPoint(worldM, [pt.x + hx, pt.y + hy, 0]);
            const hsp = this.aePointToStage(hwp, comp);
            ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(hsp.x, hsp.y); ctx.stroke();
            ctx.fillStyle = '#f472b6';
            ctx.beginPath(); ctx.arc(hsp.x, hsp.y, 3.8, 0, Math.PI * 2); ctx.fill();
            this._interactiveHandles.push({
              kind: 'pathTangent',
              layerId: lyr.id,
              cIdx,
              pIdx,
              tKind: kind,
              x: hsp.x,
              y: hsp.y,
              worldAnchor: hwp,
            });
          };
          drawBezHandle(pt.inX || 0, pt.inY || 0, 'in');
          drawBezHandle(pt.outX || 0, pt.outY || 0, 'out');

          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.fillRect(sp.x - 4, sp.y - 4, 8, 8);
          ctx.strokeRect(sp.x - 4, sp.y - 4, 8, 8);
          this._interactiveHandles.push({
            kind: 'pathNode',
            layerId: lyr.id,
            cIdx,
            pIdx,
            x: sp.x,
            y: sp.y,
            worldAnchor: wp,
          });
        }
      }
    }

    // 5. 图钉（Puppet Pins）绘制与交互
    const pins = lyr.shape?.puppetPins || lyr.text?.puppetPins || [];
    for (let idx = 0; idx < pins.length; idx++) {
      const pin = pins[idx];
      const propPath = lyr.type === 'text' ? `text.puppetPins.${idx}.pos` : `shape.puppetPins.${idx}.pos`;
      const pPos = evalProperty(project, comp, lyr, propPath, t);
      const wp = mat4TransformPoint(worldM, [pPos[0], pPos[1], 0]);
      const sp = this.aePointToStage(wp, comp);
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      this._interactiveHandles.push({
        kind: 'puppetPin',
        layerId: lyr.id,
        pinIdx: idx,
        propPath,
        x: sp.x,
        y: sp.y,
        worldAnchor: wp,
      });
    }

    ctx.restore();
  }

  _bindEvents() {
    this.stageEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.viewFit = false;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      this.viewZoom = clamp(this.viewZoom * factor, 0.2, 6.0);
      this.drawOverlays();
    }, { passive: false });

    this.stageEl.addEventListener('pointerdown', (e) => {
      this.app.audio.unlock();
      const project = this.app.project;
      const comp = this.app.getActiveComp();
      if (!comp || this.app.isExportMode) return;

      const [sx, sy] = this.clientToStage(e.clientX, e.clientY);
      const [nx, ny] = this.stageToNormalized(sx, sy);
      const compX = nx * comp.width;
      const compY = ny * comp.height;
      const t = comp.currentTime;

      // 中键或抓手工具：平移画布
      if (e.button === 1 || this.tool === 'hand') {
        this._drag = { mode: 'pan', lastX: sx, lastY: sy };
        this.stageEl.setPointerCapture(e.pointerId);
        return;
      }

      // 相机环绕工具
      if (this.tool === 'orbit') {
        const camLyr = comp.layers.find((l) => l.type === 'camera' && isLayerActiveAtTime(l, t));
        if (camLyr) {
          this.app.history.beginTransaction(project, '调整摄像机视角');
          this._drag = {
            mode: 'orbitCam',
            layerId: camLyr.id,
            lastX: sx,
            lastY: sy,
            initPos: [...evalProperty(project, comp, camLyr, 'transform.position', t)],
            initTgt: [...evalProperty(project, comp, camLyr, 'camera.target', t)],
          };
          this.stageEl.setPointerCapture(e.pointerId);
        }
        return;
      }

      // 创建矩形/椭圆工具
      if (this.tool === 'rect' || this.tool === 'ellipse') {
        this.app.history.recordAction(project, this.tool === 'rect' ? '绘制矩形' : '绘制椭圆', () => {
          const lyr = createLayer('shape', comp, {
            name: this.tool === 'rect' ? '新建矩形' : '新建椭圆',
            shapeSource: this.tool,
            position: [compX, compY, 0],
            rectSize: [240, 180],
            ellipseSize: [220, 220],
            fillColor: [0.95, 0.56, 0.2, 1],
            strokeColor: [1, 0.9, 0.72, 1],
          });
          comp.layers.unshift(lyr);
          project.selectedLayerIds = [lyr.id];
        });
        this.app.refreshAll();
        return;
      }

      // 创建文字工具
      if (this.tool === 'text') {
        this.app.history.recordAction(project, '新建文字图层', () => {
          const lyr = createLayer('text', comp, {
            name: '新建文字',
            text: '锻字新篇',
            fontSize: 110,
            position: [compX, compY, 0],
          });
          comp.layers.unshift(lyr);
          project.selectedLayerIds = [lyr.id];
        });
        this.tool = 'select';
        this.app.refreshAll();
        return;
      }

      // 图钉工具：点击选中形状或文字图层表面放置图钉
      if (this.tool === 'pin') {
        const lid = project.selectedLayerIds[0];
        const lyr = getLayerById(comp, lid);
        if (lyr && (lyr.type === 'shape' || lyr.type === 'text')) {
          const wm = getLayerWorldMatrix(project, comp, lyr, t);
          const localPt = mat4TransformPoint(mat4Invert(wm), [compX, compY, 0]);
          const pins = lyr.type === 'text' ? lyr.text.puppetPins : lyr.shape.puppetPins;
          this.app.history.recordAction(project, '添加图钉', () => {
            pins.push(createPuppetPin(localPt[0], localPt[1], `图钉 ${pins.length + 1}`));
          });
          this.app.refreshAll();
        }
        return;
      }

      // 钢笔工具：添加贝塞尔路径节点（双击或点起点闭合）
      if (this.tool === 'pen') {
        if (!this._penDraft) {
          this._penDraft = { points: [{ x: compX, y: compY, inX: 0, inY: 0, outX: 0, outY: 0 }] };
        } else {
          const first = this._penDraft.points[0];
          const firstSP = this.compToStage(first.x, first.y, comp);
          if (this._penDraft.points.length >= 3 && Math.hypot(sx - firstSP[0], sy - firstSP[1]) < 12) {
            this._commitPenDraft(true);
            return;
          }
          this._penDraft.points.push({ x: compX, y: compY, inX: 0, inY: 0, outX: 0, outY: 0 });
        }
        this._drag = { mode: 'penHandle', lastX: sx, lastY: sy };
        this.stageEl.setPointerCapture(e.pointerId);
        this.drawOverlays();
        return;
      }

      // 1. 先检查控件手柄命中
      let hitHandle = null;
      let minD = 12;
      for (const h of this._interactiveHandles || []) {
        const d = Math.hypot(sx - h.x, sy - h.y);
        if (d < minD) {
          minD = d;
          hitHandle = h;
        }
      }

      if (hitHandle) {
        const lyr = getLayerById(comp, hitHandle.layerId);
        if (!lyr || lyr.locked) return;
        this.app.history.beginTransaction(project, '画布直接编辑');
        this._drag = {
          mode: 'handle',
          handle: hitHandle,
          lastX: sx,
          lastY: sy,
          startX: sx,
          startY: sy,
          initRot: evalProperty(project, comp, lyr, lyr.is3D ? 'transform.rotationZ' : 'transform.rotation', t),
          initScale: [...evalProperty(project, comp, lyr, 'transform.scale', t)],
        };
        this.stageEl.setPointerCapture(e.pointerId);
        return;
      }

      // 2. 命中画面上最近的可选图层几何表面
      const hitLayerId = this.app.compositor.pickLayerAtNormalized(nx, ny, project, comp, t);
      if (hitLayerId) {
        if (e.shiftKey) {
          const set = new Set(project.selectedLayerIds);
          if (set.has(hitLayerId)) set.delete(hitLayerId);
          else set.add(hitLayerId);
          project.selectedLayerIds = Array.from(set);
        } else if (!project.selectedLayerIds.includes(hitLayerId)) {
          project.selectedLayerIds = [hitLayerId];
        }
        const lyr = getLayerById(comp, hitLayerId);
        this.app.refreshPanelsOnly();
        if (lyr && !lyr.locked) {
          const wm = getLayerWorldMatrix(project, comp, lyr, t);
          const anchor = evalProperty(project, comp, lyr, 'transform.anchorPoint', t);
          const worldAnchor = mat4TransformPoint(wm, anchor);
          this.app.history.beginTransaction(project, this.tool === 'anchor' ? '调整锚点' : '移动图层');
          this._drag = {
            mode: this.tool === 'anchor' ? 'anchorDrag' : 'moveLayer',
            layerIds: [...project.selectedLayerIds],
            primaryId: hitLayerId,
            lastX: sx,
            lastY: sy,
            worldAnchor,
          };
          this.stageEl.setPointerCapture(e.pointerId);
        }
      } else if (!e.shiftKey) {
        project.selectedLayerIds = [];
        this.app.refreshAll();
      }
    });

    this.stageEl.addEventListener('dblclick', () => {
      if (this.tool === 'pen' && this._penDraft && this._penDraft.points.length >= 2) {
        this._commitPenDraft(false);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      const project = this.app.project;
      const comp = this.app.getActiveComp();
      if (!comp) return;
      const [sx, sy] = this.clientToStage(e.clientX, e.clientY);
      const dx = sx - this._drag.lastX;
      const dy = sy - this._drag.lastY;
      this._drag.lastX = sx;
      this._drag.lastY = sy;
      const t = comp.currentTime;

      if (this._drag.mode === 'pan') {
        this.viewPan[0] += dx;
        this.viewPan[1] += dy;
        this.drawOverlays();
        return;
      }

      if (this._drag.mode === 'penHandle' && this._penDraft) {
        const lastPt = this._penDraft.points[this._penDraft.points.length - 1];
        const scale = this._layoutMetrics.scale || 1;
        lastPt.outX += dx / scale;
        lastPt.outY += dy / scale;
        lastPt.inX = -lastPt.outX;
        lastPt.inY = -lastPt.outY;
        this.drawOverlays();
        return;
      }

      if (this._drag.mode === 'orbitCam') {
        const camLyr = getLayerById(comp, this._drag.layerId);
        if (!camLyr) return;
        const pos = evalProperty(project, comp, camLyr, 'transform.position', t);
        const tgt = evalProperty(project, comp, camLyr, 'camera.target', t);
        const vx = pos[0] - tgt[0], vy = pos[1] - tgt[1], vz = (pos[2] || 0) - (tgt[2] || 0);
        const yaw = -dx * 0.006;
        const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
        const nx = vx * cosY - vz * sinY;
        const nz = vx * sinY + vz * cosY;
        const ny = vy - dy * 1.4;
        this.app.setPropertyValue(camLyr, 'transform.position', [tgt[0] + nx, tgt[1] + ny, tgt[2] + nz], t);
        this.app.renderCurrentFrame();
        return;
      }

      if (this._drag.mode === 'moveLayer') {
        const wd = this.screenDeltaToWorldDelta(dx, dy, this._drag.worldAnchor, comp);
        for (const lid of this._drag.layerIds) {
          const lyr = getLayerById(comp, lid);
          if (!lyr || lyr.locked) continue;
          this.applyWorldDeltaToLayerPosition(project, comp, lyr, wd, t);
        }
        this.app.renderCurrentFrame();
        this.app.refreshPropertiesValuesOnly();
        return;
      }

      if (this._drag.mode === 'anchorDrag') {
        const lyr = getLayerById(comp, this._drag.primaryId);
        if (!lyr) return;
        const wd = this.screenDeltaToWorldDelta(dx, dy, this._drag.worldAnchor, comp);
        const wm = getLayerWorldMatrix(project, comp, lyr, t);
        const localDa = mat4TransformVector(mat4Invert(wm), wd);
        const curA = evalProperty(project, comp, lyr, 'transform.anchorPoint', t);
        const newA = [curA[0] + localDa[0], curA[1] + localDa[1], (curA[2] || 0) + localDa[2]];
        const compRes = moveAnchorPreserveVisual(project, comp, lyr, newA, t);
        this.app.setPropertyValue(lyr, 'transform.anchorPoint', compRes.anchorPoint, t);
        this.app.setPropertyValue(lyr, 'transform.position', compRes.position, t);
        this.app.renderCurrentFrame();
        this.app.refreshPropertiesValuesOnly();
        return;
      }

      if (this._drag.mode === 'handle') {
        const h = this._drag.handle;
        const lyr = getLayerById(comp, h.layerId);
        if (!lyr) return;

        if (h.kind === 'anchor') {
          const wd = this.screenDeltaToWorldDelta(dx, dy, h.worldAnchor, comp);
          const wm = getLayerWorldMatrix(project, comp, lyr, t);
          const localDa = mat4TransformVector(mat4Invert(wm), wd);
          const curA = evalProperty(project, comp, lyr, 'transform.anchorPoint', t);
          const newA = [curA[0] + localDa[0], curA[1] + localDa[1], (curA[2] || 0) + localDa[2]];
          const compRes = moveAnchorPreserveVisual(project, comp, lyr, newA, t);
          this.app.setPropertyValue(lyr, 'transform.anchorPoint', compRes.anchorPoint, t);
          this.app.setPropertyValue(lyr, 'transform.position', compRes.position, t);
        } else if (h.kind === 'axisX' || h.kind === 'axisY' || h.kind === 'axisZ') {
          const wd = this.screenDeltaToWorldDelta(dx, dy, h.worldAnchor, comp);
          const parentM = getParentWorldMatrix(project, comp, lyr, t);
          const localD = mat4TransformVector(mat4Invert(parentM), wd);
          const curPos = evalProperty(project, comp, lyr, 'transform.position', t);
          const next = [...curPos];
          if (h.kind === 'axisX') next[0] += localD[0];
          else if (h.kind === 'axisY') next[1] += localD[1];
          else next[2] = (next[2] || 0) - dy * 1.5;
          this.app.setPropertyValue(lyr, 'transform.position', next, t);
        } else if (h.kind === 'rotate') {
          const a0 = Math.atan2(this._drag.startY - h.centerY, this._drag.startX - h.centerX);
          const a1 = Math.atan2(sy - h.centerY, sx - h.centerX);
          const degDelta = ((a1 - a0) * 180) / Math.PI;
          const propPath = lyr.is3D ? 'transform.rotationZ' : 'transform.rotation';
          this.app.setPropertyValue(lyr, propPath, this._drag.initRot + degDelta, t);
        } else if (h.kind === 'scale') {
          const d0 = Math.max(10, Math.hypot(this._drag.startX - h.centerX, this._drag.startY - h.centerY));
          const d1 = Math.max(4, Math.hypot(sx - h.centerX, sy - h.centerY));
          const ratio = d1 / d0;
          const nextS = [this._drag.initScale[0] * ratio, this._drag.initScale[1] * ratio, this._drag.initScale[2] * (lyr.is3D ? ratio : 1)];
          this.app.setPropertyValue(lyr, 'transform.scale', nextS, t);
        } else if (h.kind === 'spatialKf') {
          const wd = this.screenDeltaToWorldDelta(dx, dy, h.worldAnchor, comp);
          const parentM = getParentWorldMatrix(project, comp, lyr, t);
          const localD = mat4TransformVector(mat4Invert(parentM), wd);
          const kf = lyr.transform.position.keyframes[h.kfIndex];
          if (kf) {
            kf.value[0] += localD[0];
            kf.value[1] += localD[1];
            kf.value[2] = (kf.value[2] || 0) + localD[2];
            lyr.transform.position._lutCache = null;
          }
        } else if (h.kind === 'spatialTangent') {
          const wd = this.screenDeltaToWorldDelta(dx, dy, h.worldAnchor, comp);
          const parentM = getParentWorldMatrix(project, comp, lyr, t);
          const localD = mat4TransformVector(mat4Invert(parentM), wd);
          const kf = lyr.transform.position.keyframes[h.kfIndex];
          if (kf) {
            const tang = h.tangentKind === 'in' ? kf.inTangent : kf.outTangent;
            tang[0] += localD[0]; tang[1] += localD[1]; tang[2] = (tang[2] || 0) + localD[2];
            lyr.transform.position._lutCache = null;
          }
        } else if (h.kind === 'pathNode' || h.kind === 'pathTangent') {
          const wd = this.screenDeltaToWorldDelta(dx, dy, h.worldAnchor, comp);
          const wm = getLayerWorldMatrix(project, comp, lyr, t);
          const localD = mat4TransformVector(mat4Invert(wm), wd);
          const pathVal = cloneVal(evalProperty(project, comp, lyr, 'shape.path', t));
          const pt = pathVal.contours[h.cIdx]?.points[h.pIdx];
          if (pt) {
            if (h.kind === 'pathNode') { pt.x += localD[0]; pt.y += localD[1]; }
            else if (h.tKind === 'in') { pt.inX += localD[0]; pt.inY += localD[1]; }
            else { pt.outX += localD[0]; pt.outY += localD[1]; }
            this.app.setPropertyValue(lyr, 'shape.path', pathVal, t);
          }
        } else if (h.kind === 'puppetPin') {
          const wd = this.screenDeltaToWorldDelta(dx, dy, h.worldAnchor, comp);
          const wm = getLayerWorldMatrix(project, comp, lyr, t);
          const localD = mat4TransformVector(mat4Invert(wm), wd);
          const cur = evalProperty(project, comp, lyr, h.propPath, t);
          this.app.setPropertyValue(lyr, h.propPath, [cur[0] + localD[0], cur[1] + localD[1]], t);
        }

        this.app.renderCurrentFrame();
        this.app.refreshPropertiesValuesOnly();
      }
    });

    window.addEventListener('pointerup', () => {
      if (!this._drag) return;
      const mode = this._drag.mode;
      this._drag = null;
      if (mode !== 'pan' && mode !== 'penHandle') {
        this.app.history.commitTransaction(this.app.project);
        this.app.refreshAll();
      }
    });
  }

  _commitPenDraft(closed) {
    const project = this.app.project;
    const comp = this.app.getActiveComp();
    if (!comp || !this._penDraft) return;
    const pts = this._penDraft.points;
    this._penDraft = null;
    if (pts.length < 2) return;

    // 以包围盒中心为图层位置与锚点，方便后续居中旋转与缩放
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const localPts = pts.map((p) => ({ ...p, x: p.x - cx, y: p.y - cy }));

    this.app.history.recordAction(project, '创建贝塞尔路径图层', () => {
      const lyr = createLayer('shape', comp, {
        name: '自绘贝塞尔路径',
        shapeSource: 'path',
        position: [cx, cy, 0],
        path: { fillRule: 'nonzero', contours: [{ closed, points: localPts }] },
        fillEnabled: closed,
        fillColor: [0.95, 0.56, 0.2, 1],
        strokeEnabled: true,
        strokeColor: [1, 0.9, 0.72, 1],
        strokeWidth: 6,
      });
      comp.layers.unshift(lyr);
      project.selectedLayerIds = [lyr.id];
    });
    this.tool = 'select';
    this.app.refreshAll();
  }
}
