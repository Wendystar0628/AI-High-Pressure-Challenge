/* ============================================================
   viewport.js — 画布叠加层、选择框、运动路径、三维辅助与直接编辑
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const G = AE.geom;
  const P = AE.particles;
  const UI = AE.ui;
  const VP = AE.viewport = {
    canvas: null, ctx: null, lastCompPoint: null,
    drag: null, pen: null, hover: null,
    _hint: ''
  };

  VP.init = function () {
    VP.canvas = document.getElementById('overlay');
    VP.ctx = VP.canvas.getContext('2d');
    VP.canvas.addEventListener('pointerdown', VP.onDown);
    VP.canvas.addEventListener('pointermove', VP.onMove);
    VP.canvas.addEventListener('pointerup', VP.onUp);
    VP.canvas.addEventListener('pointercancel', VP.onUp);
    VP.canvas.addEventListener('pointerleave', () => { if (!VP.drag) { VP.setHint(''); } });
    VP.canvas.addEventListener('wheel', (e) => {
      if (AE.app.view.viewMode === 'free' || AE.app.activeTool === 'orbit') {
        e.preventDefault();
        const fc = AE.app.view.freeCamera;
        fc.dist = U.clamp(fc.dist * (e.deltaY > 0 ? 1.08 : 0.92), 120, 8000);
        AE.app.requestRender(true);
      }
    }, { passive: false });
    VP.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    VP.setCursor();
    VP.resizeOverlay();
  };

  VP.resizeOverlay = function () {
    if (!VP.canvas) return;
    const b = AE.app.view.bounds;
    if (!b) return;
    const dpr = b.dpr || Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round((b.frameW || 800) * dpr), h = Math.round((b.frameH || 450) * dpr);
    if (VP.canvas.width !== w || VP.canvas.height !== h) { VP.canvas.width = w; VP.canvas.height = h; }
    VP.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  VP.setCursor = function () {
    if (!VP.canvas) return;
    const tool = AE.app.activeTool;
    VP.canvas.style.cursor = tool === 'hand' ? 'grab' : tool === 'text' ? 'text' : (tool === 'pen' || tool === 'rect' || tool === 'ellipse' || tool === 'pin' || tool === 'zoom') ? 'crosshair' : 'default';
  };
  VP.onToolChange = function (tool) {
    VP.setCursor();
    if (tool !== 'pen') { VP.pen = null; VP._hint = ''; }
    if (tool === 'text') VP.setHint('单击画面创建文字图层');
    else if (tool === 'pen') VP.setHint('钢笔：单击添加节点，拖动生成切线，点击起点闭合，Enter 完成，Esc 取消');
    else if (tool === 'rect' || tool === 'ellipse') VP.setHint('拖动绘制新形状');
    else if (tool === 'pin') VP.setHint('单击变形图层添加图钉，拖动图钉改变目标位置');
    else if (tool === 'orbit') VP.setHint('拖动环绕视图，滚轮缩放');
    else VP.setHint('');
    AE.app.requestRender(true);
  };
  VP.setHint = function (h) {
    VP._hint = h || '';
    const el = document.getElementById('statusHints');
    if (el && h) el.textContent = h;
    if (h) AE.app.status(h);
  };

  // ---------------- 坐标 ----------------
  VP.frameRect = function () { return AE.app.view.bounds; };
  VP.screenToComp = function (sx, sy) {
    const b = AE.app.view.bounds;
    const r = VP.canvas.getBoundingClientRect();
    const x = (sx - r.left) / b.frameW;
    const y = (sy - r.top) / b.frameH;
    return { x: (x - 0.5) * AE.app.comp.width, y: (y - 0.5) * AE.app.comp.height };
  };
  VP.compToScreen = function (x, y) {
    const b = AE.app.view.bounds;
    const r = VP.canvas.getBoundingClientRect();
    return { x: r.left + (x / AE.app.comp.width + 0.5) * b.frameW, y: r.top + (y / AE.app.comp.height + 0.5) * b.frameH, sx: (x / AE.app.comp.width + 0.5) * b.frameW, sy: (y / AE.app.comp.height + 0.5) * b.frameH };
  };
  VP.localCompCoords = function (sx, sy) {
    // 返回叠加层内部坐标（CSS 像素，相对 canvas 左上）
    const b = AE.app.view.bounds;
    const r = VP.canvas.getBoundingClientRect();
    return {
      x: ((sx - r.left) / b.frameW - 0.5) * AE.app.comp.width,
      y: ((sy - r.top) / b.frameH - 0.5) * AE.app.comp.height,
      px: sx - r.left, py: sy - r.top
    };
  };
  VP.worldToScreen = function (p, useCamera) {
    const comp = AE.app.comp;
    if (useCamera && comp._cameraInfo) {
      const cam = comp._cameraInfo;
      const c = U.m4.applyPoint(cam.viewProj, p);
      if (c.w <= 0) return null;
      const b = AE.app.view.bounds;
      const nx = (c.x * .5 + .5), ny = (.5 - c.y * .5);
      return { x: nx * b.frameW, y: ny * b.frameH, sx: nx * b.frameW, sy: ny * b.frameH, z: c.z, visible: true };
    }
    const sp = VP.compToScreen(p.x, p.y);
    return { x: sp.sx, y: sp.sy, sx: sp.sx, sy: sp.sy, visible: true };
  };
  VP.cameraRay = function (sx, sy) {
    const comp = AE.app.comp;
    const cam = comp._cameraInfo;
    if (!cam) return null;
    const r = VP.canvas.getBoundingClientRect();
    const nx = ((sx - r.left) / AE.app.view.bounds.frameW) * 2 - 1;
    const ny = 1 - ((sy - r.top) / AE.app.view.bounds.frameH) * 2;
    const un = (z) => {
      const p = U.m4.applyPoint(cam.invViewProj, { x: nx, y: ny, z });
      return { x: p.x / (p.w || 1), y: p.y / (p.w || 1), z: p.z / (p.w || 1) };
    };
    const a = un(-1), b = un(1);
    return { origin: a, dir: U.vnorm(U.vsub(b, a)) };
  };

  // ---------------- 图层内容范围 ----------------
  function contentBounds(layer, t) {
    if (layer.type === 'text') {
      const e = T.layerExtents(layer, t);
      return { x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1 };
    }
    if (layer.type === 'shape') {
      const cs = G.evalShapeLayer(layer, t);
      const b = G.bounds(cs);
      if (b.w < 1 && b.h < 1) return { x0: -60, y0: -60, x1: 60, y1: 60 };
      return { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
    }
    if (layer.type === 'precomp') {
      const nested = AE.app.project.comps.find(c => c.id === layer.precomp.compId);
      if (nested) return { x0: -nested.width / 2, y0: -nested.height / 2, x1: nested.width / 2, y1: nested.height / 2 };
    }
    const w = AE.app.comp.width / 2, h = AE.app.comp.height / 2;
    return { x0: -w, y0: -h, x1: w, y1: h };
  }
  const T = AE.text;

  function corners2D(layer, t) {
    const ctx = A.newCtx(AE.app.comp, layer, t);
    const m = A.worldMatrix(layer, t, ctx);
    const b = contentBounds(layer, t);
    const pts = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }];
    const w = pts.map(p => U.m4.applyPoint(m, p));
    return { pts: w, m, b };
  }

  // ---------------- 绘制叠加层 ----------------
  VP.drawOverlay = function () {
    if (!VP.ctx) return;
    const ctx = VP.ctx;
    const b = AE.app.view.bounds;
    if (!b || !b.frameW) return;
    VP.resizeOverlay();
    ctx.setTransform(b.dpr || 1, 0, 0, b.dpr || 1, 0, 0);
    ctx.clearRect(0, 0, b.frameW, b.frameH);
    if (!AE.app.comp) return;
    const comp = AE.app.comp;
    const ov = AE.app.view.overlays;
    if (ov.grid) VP.drawGrid(ctx);
    if (ov.fields) VP.drawFields(ctx);
    if (ov.guides) VP.drawSceneHelpers(ctx);
    if (ov.paths) VP.drawMotionPaths(ctx);
    if (ov.guides) VP.drawSelection(ctx);
    if (ov.fields) VP.drawPins(ctx);
    VP.drawPen(ctx);
    VP.drawShapePreview(ctx);
    VP.drawToolHint(ctx);
    if (VP.drag && VP.drag.type === 'marquee') VP.drawMarquee(ctx);
  };

  VP.drawGrid = function (ctx) {
    const b = AE.app.view.bounds;
    const comp = AE.app.comp;
    const cam = comp._cameraInfo;
    const view3D = AE.app.view.viewMode !== '2d' && cam;
    ctx.save();
    ctx.lineWidth = 1;
    if (view3D) {
      const y = 248;
      const ext = 1400;
      const step = 140;
      const project = (x, z) => {
        const c = U.m4.applyPoint(cam.viewProj, { x, y, z });
        if (c.w <= 0) return null;
        return { x: (c.x * .5 + .5) * b.frameW, y: (.5 - c.y * .5) * b.frameH };
      };
      ctx.strokeStyle = 'rgba(130,155,180,.12)';
      for (let x = -ext; x <= ext; x += step) {
        const p0 = project(x, -ext), p1 = project(x, ext);
        if (!p0 || !p1) continue;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      for (let z = -ext; z <= ext; z += step) {
        const p0 = project(-ext, z), p1 = project(ext, z);
        if (!p0 || !p1) continue;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      // 中心轴
      ctx.strokeStyle = 'rgba(255,150,80,.28)';
      const c0 = project(-200, 0), c1 = project(200, 0);
      if (c0 && c1) { ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.stroke(); }
    } else {
      ctx.strokeStyle = 'rgba(130,155,180,.09)';
      const stepX = comp.width / 16, stepY = comp.height / 9;
      for (let x = 0; x <= comp.width; x += stepX) {
        const s = VP.compToScreen(x - comp.width / 2, 0);
        ctx.beginPath(); ctx.moveTo(s.sx, 0); ctx.lineTo(s.sx, b.frameH); ctx.stroke();
      }
      for (let y = 0; y <= comp.height; y += stepY) {
        const s = VP.compToScreen(0, y - comp.height / 2);
        ctx.beginPath(); ctx.moveTo(0, s.sy); ctx.lineTo(b.frameW, s.sy); ctx.stroke();
      }
    }
    ctx.restore();
  };

  VP.drawSceneHelpers = function (ctx) {
    const comp = AE.app.comp;
    const t = AE.app.time;
    const b = AE.app.view.bounds;
    const cam = comp._cameraInfo;
    // 灯光
    for (const l of comp.layers) {
      if (!l.enabled || l.type !== 'light') continue;
      const ctxA = A.newCtx(comp, l, t);
      const wm = A.worldMatrix(l, t, ctxA);
      const p = U.m4.applyPoint(wm, { x: 0, y: 0, z: 0 });
      const sp = VP.worldToScreen(p, true);
      if (!sp) continue;
      ctx.save();
      ctx.strokeStyle = l.light.type === 'directional' ? 'rgba(255,210,110,.65)' : 'rgba(255,170,80,.65)';
      ctx.fillStyle = l.light.type === 'directional' ? 'rgba(255,210,110,.9)' : 'rgba(255,170,80,.9)';
      ctx.lineWidth = 1.2;
      if (l.light.type === 'directional') {
        const d = U.vnorm(U.m4.applyDir(wm, A.vec3(A.sample(l.light.direction, t, l, ctxA))));
        const p2 = { x: p.x + d.x * 220, y: p.y + d.y * 220, z: p.z + d.z * 220 };
        const sp2 = VP.worldToScreen(p2, true);
        ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 5, 0, Math.PI * 2); ctx.fill();
        if (sp2) {
          ctx.beginPath(); ctx.moveTo(sp.sx, sp.sy); ctx.lineTo(sp2.sx, sp2.sy); ctx.stroke();
          ctx.beginPath(); ctx.arc(sp2.sx, sp2.sy, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.font = '9px "Cascadia Mono", monospace';
        ctx.fillStyle = 'rgba(255,225,180,.7)';
        ctx.fillText('☀ ' + l.name, sp.sx + 9, sp.sy - 8);
      } else {
        ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '9px "Cascadia Mono", monospace';
        ctx.fillStyle = 'rgba(255,225,180,.7)';
        ctx.fillText('● ' + l.name, sp.sx + 13, sp.sy - 8);
      }
      ctx.restore();
    }
    // 摄像机
    const cl = comp.layers.find(l => l.id === comp.activeCameraId && l.type === 'camera');
    if (cl) {
      const ctxA = A.newCtx(comp, cl, t);
      const wm = A.worldMatrix(cl, t, ctxA);
      const eye = U.m4.applyPoint(wm, { x: 0, y: 0, z: 0 });
      const se = VP.worldToScreen(eye, true);
      const target = A.vec3(A.sample(cl.camera.target, t, cl, ctxA));
      const st = VP.worldToScreen(target, true);
      if (se) {
        ctx.save();
        ctx.strokeStyle = 'rgba(120,200,230,.55)';
        ctx.fillStyle = 'rgba(120,200,230,.85)';
        ctx.beginPath(); ctx.moveTo(se.sx, se.sy); ctx.lineTo(se.sx - 13, se.sy - 8); ctx.lineTo(se.sx - 9, se.sy + 7); ctx.closePath(); ctx.stroke();
        if (st) {
          ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(se.sx, se.sy); ctx.lineTo(st.sx, st.sy); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(st.sx, st.sy, 3, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.font = '9px "Cascadia Mono", monospace';
        ctx.fillText('◉ ' + cl.name, se.sx + 9, se.sy - 8);
        ctx.restore();
      }
    }
    // 场范围
    if (AE.app.view.overlays.fields) {
      for (const l of comp.layers) {
        if (!l.enabled || l.type !== 'field') continue;
        const f = AE.fields.resolve(l, t, A.newCtx(comp, l, t));
        const sf = VP.worldToScreen({ x: f.x, y: f.y, z: f.z }, true);
        if (!sf) continue;
        let rpx = 80;
        if (cam) {
          const p1 = VP.worldToScreen({ x: f.x + f.radius, y: f.y, z: f.z }, true);
          rpx = p1 ? Math.abs(p1.sx - sf.sx) : 80;
        }
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = f.type === 'vortex' ? 'rgba(192,132,252,.45)' : f.type === 'noise' ? 'rgba(255,207,107,.4)' : 'rgba(110,231,168,.45)';
        ctx.fillStyle = f.type === 'vortex' ? 'rgba(192,132,252,.04)' : f.type === 'noise' ? 'rgba(255,207,107,.035)' : 'rgba(110,231,168,.04)';
        ctx.beginPath(); ctx.ellipse(sf.sx, sf.sy, rpx, rpx * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '9px "Cascadia Mono", monospace';
        ctx.fillStyle = 'rgba(200,190,225,.75)';
        ctx.fillText('◌ ' + f.name, sf.sx + rpx * .68, sf.sy - rpx * .55);
        ctx.restore();
      }
    }
    // 三维坐标轴（选中对象）
    const layer = AE.app.primary();
    if (layer && (A.is3D(layer) || M.renders3D(layer)) && cam) {
      const ctxA = A.newCtx(comp, layer, t);
      const wm = A.worldMatrix(layer, t, ctxA);
      const anchor = A.vec3(A.sample(layer.transform.anchor, t, layer, ctxA));
      const o = U.m4.applyPoint(wm, anchor);
      const so = VP.worldToScreen(o, true);
      if (so) {
        ctx.save();
        ctx.lineWidth = 1.4;
        const axes = [
          { d: { x: 1, y: 0, z: 0 }, c: 'rgba(255,100,100,.85)', l: 'X' },
          { d: { x: 0, y: 1, z: 0 }, c: 'rgba(120,220,140,.85)', l: 'Y' },
          { d: { x: 0, y: 0, z: 1 }, c: 'rgba(110,170,255,.85)', l: 'Z' }
        ];
        for (const ax of axes) {
          const wp = { x: o.x + ax.d.x * 130, y: o.y + ax.d.y * 130, z: o.z + ax.d.z * 130 };
          const sp = VP.worldToScreen(wp, true);
          if (!sp) continue;
          ctx.strokeStyle = ax.c;
          ctx.fillStyle = ax.c;
          ctx.beginPath(); ctx.moveTo(so.sx, so.sy); ctx.lineTo(sp.sx, sp.sy); ctx.stroke();
          ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.font = '8px "Cascadia Mono", monospace';
          ctx.fillText(ax.l, sp.sx + 4, sp.sy - 3);
        }
        ctx.restore();
      }
    }
  };

  VP.drawFields = function (ctx) {};
  VP.drawPins = function (ctx) {
    const layer = AE.app.primary();
    if (!layer || !layer.pins || !layer.pins.length) return;
    const comp = AE.app.comp;
    const t = AE.app.time;
    const ctxA = A.newCtx(comp, layer, t);
    const pins = G.resolvePins(layer, t, ctxA);
    if (!pins.length) return;
    const wm = A.worldMatrix(layer, t, ctxA);
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      const w = U.m4.applyPoint(wm, { x: pin._pos.x, y: pin._pos.y, z: 0 });
      const sp = VP.worldToScreen(w, M.renders3D(layer));
      if (!sp) continue;
      const tw = U.m4.applyPoint(wm, { x: pin._pos.x + pin._dx, y: pin._pos.y + pin._dy, z: 0 });
      const st = VP.worldToScreen(tw, M.renders3D(layer));
      ctx.save();
      ctx.strokeStyle = 'rgba(255,184,100,.8)';
      ctx.fillStyle = 'rgba(255,184,100,.15)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 2, 0, Math.PI * 2); ctx.fillStyle = '#ffbd75'; ctx.fill();
      if (st) {
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(sp.sx, sp.sy); ctx.lineTo(st.sx, st.sy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(st.sx, st.sy, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.font = '8px "Cascadia Mono", monospace';
      ctx.fillStyle = 'rgba(255,210,170,.75)';
      ctx.fillText('图钉 ' + (i + 1), sp.sx + 10, sp.sy - 7);
      ctx.restore();
    }
  };

  VP.drawSelection = function (ctx) {
    if (!AE.app.view.overlays.guides) return;
    const layers = AE.app.selectedLayers();
    if (!layers.length) return;
    const comp = AE.app.comp;
    const t = AE.app.time;
    const primary = AE.app.primary();
    layers.forEach((layer, idx) => {
      const isPrimary = primary && layer.id === primary.id;
      if (M.renders3D(layer)) {
        const mesh = P.meshForLayer(layer, t);
        if (mesh && mesh.bounds) {
          const bd = mesh.bounds;
          const corners = [
            { x: bd.x0, y: bd.y0, z: bd.z0 }, { x: bd.x1, y: bd.y0, z: bd.z0 },
            { x: bd.x1, y: bd.y1, z: bd.z0 }, { x: bd.x0, y: bd.y1, z: bd.z0 },
            { x: bd.x0, y: bd.y0, z: bd.z1 }, { x: bd.x1, y: bd.y0, z: bd.z1 },
            { x: bd.x1, y: bd.y1, z: bd.z1 }, { x: bd.x0, y: bd.y1, z: bd.z1 }
          ];
          const sp = corners.map(p => VP.worldToScreen(p, true));
          ctx.save();
          ctx.strokeStyle = isPrimary ? 'rgba(255,170,90,.8)' : 'rgba(255,170,90,.4)';
          ctx.lineWidth = 1;
          const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
          for (const [a, bb] of edges) {
            if (!sp[a] || !sp[bb]) continue;
            ctx.beginPath(); ctx.moveTo(sp[a].sx, sp[a].sy); ctx.lineTo(sp[bb].sx, sp[bb].sy); ctx.stroke();
          }
          if (isPrimary) {
            const ctxA = A.newCtx(comp, layer, t);
            const anchor = A.vec3(A.sample(layer.transform.anchor, t, layer, ctxA));
            const wm = A.worldMatrix(layer, t, ctxA);
            const ap = U.m4.applyPoint(wm, anchor);
            const sa = VP.worldToScreen(ap, true);
            if (sa) drawAnchor(ctx, sa.sx, sa.sy);
          }
          ctx.restore();
        }
      } else {
        if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'sound') {
          const ctxA = A.newCtx(comp, layer, t);
          const wm = A.worldMatrix(layer, t, ctxA);
          const p = U.m4.applyPoint(wm, { x: 0, y: 0, z: 0 });
          const sp = VP.compToScreen(p.x, p.y);
          ctx.save();
          ctx.strokeStyle = 'rgba(255,170,90,.5)';
          ctx.beginPath(); ctx.arc(sp.sx, sp.sy, 7, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          return;
        }
        const c = corners2D(layer, t);
        const pts = c.pts.map(p => VP.compToScreen(p.x, p.y));
        ctx.save();
        ctx.strokeStyle = isPrimary ? 'rgba(255,160,70,.95)' : 'rgba(255,160,70,.4)';
        ctx.fillStyle = isPrimary ? 'rgba(255,150,60,.05)' : 'transparent';
        ctx.lineWidth = isPrimary ? 1.2 : 1;
        ctx.beginPath();
        pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (isPrimary) {
          // 锚点
          const ctxA = A.newCtx(comp, layer, t);
          const wm = A.worldMatrix(layer, t, ctxA);
          const anchor = A.vec3(A.sample(layer.transform.anchor, t, layer, ctxA));
          const ap = U.m4.applyPoint(wm, anchor);
          const sa = VP.compToScreen(ap.x, ap.y);
          drawAnchor(ctx, sa.sx, sa.sy);
          // 缩放手柄
          if (AE.app.activeTool === 'select' || AE.app.activeTool === 'scale') {
            for (const p of pts) {
              ctx.fillStyle = '#1a1e25'; ctx.strokeStyle = 'rgba(255,190,120,.95)';
              ctx.lineWidth = 1;
              ctx.fillRect(p.sx - 3.5, p.sy - 3.5, 7, 7);
              ctx.strokeRect(p.sx - 3.5, p.sy - 3.5, 7, 7);
            }
            // 旋转手柄
            const midTop = { x: (pts[0].sx + pts[1].sx) / 2, y: (pts[0].sy + pts[1].sy) / 2 };
            const cx = (pts[0].sx + pts[2].sx) / 2, cy = (pts[0].sy + pts[2].sy) / 2;
            const dx = midTop.x - cx, dy = midTop.y - cy, len = Math.hypot(dx, dy) || 1;
            const hx = midTop.x + dx / len * 24, hy = midTop.y + dy / len * 24;
            ctx.beginPath(); ctx.moveTo(midTop.x, midTop.y); ctx.lineTo(hx, hy); ctx.stroke();
            ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fillStyle = '#252b34'; ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        }
      }
    });
    // 标签
    if (primary) {
      const label = primary.name + (AE.app.selection.length > 1 ? '  +' + (AE.app.selection.length - 1) : '');
      ctx.save();
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      const w = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(14,16,20,.72)';
      ctx.fillRect(10, 10, w, 18);
      ctx.fillStyle = 'rgba(255,200,150,.9)';
      ctx.fillText(label, 17, 22);
      ctx.restore();
    }
  };
  function drawAnchor(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,180,100,.95)';
    ctx.fillStyle = 'rgba(20,16,12,.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke();
    ctx.restore();
  }

  VP.drawMotionPaths = function (ctx) {
    const layer = AE.app.primary();
    if (!layer) return;
    if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'sound') return;
    const pos = layer.transform.position;
    if (!A.isAnimated(pos)) return;
    const comp = AE.app.comp;
    const t = AE.app.time;
    const is3d = M.renders3D(layer);
    const pts = [];
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const tt = comp.duration * i / n;
      const ctxA = A.newCtx(comp, layer, tt);
      const v = A.sample(pos, tt, layer, ctxA);
      const wm = A.worldMatrix(layer, tt, ctxA);
      const anchor = A.vec3(A.sample(layer.transform.anchor, tt, layer, ctxA));
      const wp = U.m4.applyPoint(wm, { x: A.n(v.x), y: A.n(v.y), z: A.n(v.z || 0) });
      // 位置路径点应表示锚点位置对应的世界点：position 被当作图层空间的点，故此处直接用 position 的父空间变换
      const parent = A.getParent(layer, comp);
      const pm = parent ? A.worldMatrix(parent, tt, A.newCtx(comp, parent, tt)) : U.m4.identity();
      const pp = U.m4.applyPoint(pm, { x: A.n(v.x), y: A.n(v.y), z: A.n(v.z || 0) });
      const sp = VP.worldToScreen(pp, is3d);
      if (sp) pts.push(sp);
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,190,110,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy); });
    ctx.stroke();
    // 关键帧点
    for (const k of pos.keyframes) {
      const tt = k.t;
      const parent = A.getParent(layer, comp);
      const pm = parent ? A.worldMatrix(parent, tt, A.newCtx(comp, parent, tt)) : U.m4.identity();
      const v = A.vec3(k.v);
      const sp = VP.worldToScreen(U.m4.applyPoint(pm, v), is3d);
      if (!sp) continue;
      const isNow = Math.abs(tt - t) < 1e-3;
      ctx.fillStyle = isNow ? '#ffb24e' : '#171b21';
      ctx.strokeStyle = 'rgba(255,190,110,.95)';
      ctx.beginPath();
      ctx.rect(sp.sx - 3.5, sp.sy - 3.5, 7, 7);
      ctx.fill(); ctx.stroke();
      // 空间手柄（当前关键帧）
      if (isNow) {
        for (const [handle, dir] of [[k.sOut, 1], [k.sIn, -1]]) {
          if (!handle) continue;
          if (Math.abs(handle.x) < 1e-4 && Math.abs(handle.y) < 1e-4) continue;
          const hv = { x: v.x + handle.x, y: v.y + handle.y, z: (v.z || 0) + (handle.z || 0) };
          const hs = VP.worldToScreen(U.m4.applyPoint(pm, hv), is3d);
          if (!hs) continue;
          ctx.strokeStyle = 'rgba(120,210,230,.8)';
          ctx.beginPath(); ctx.moveTo(sp.sx, sp.sy); ctx.lineTo(hs.sx, hs.sy); ctx.stroke();
          ctx.fillStyle = '#7ad2e8';
          ctx.beginPath(); ctx.arc(hs.sx, hs.sy, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  VP.drawPen = function (ctx) {
    if (!VP.pen || !VP.pen.op) return;
    const op = VP.pen.op;
    const pts = op.contours && op.contours[0] ? op.contours[0].pts : [];
    ctx.save();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const sp = VP.compToScreen(p.x, p.y);
      ctx.fillStyle = i === 0 ? '#ffb450' : '#e8e0d4';
      ctx.strokeStyle = '#3b2a1b';
      ctx.beginPath(); ctx.arc(sp.sx, sp.sy, i === 0 ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const hs = VP.compToScreen(p.x + p.ox, p.y + p.oy);
      if (Math.abs(p.ox) + Math.abs(p.oy) > 0.5) {
        ctx.strokeStyle = 'rgba(120,210,230,.7)';
        ctx.beginPath(); ctx.moveTo(sp.sx, sp.sy); ctx.lineTo(hs.sx, hs.sy); ctx.stroke();
      }
    }
    ctx.restore();
  };
  VP.drawShapePreview = function (ctx) {
    if (!VP.drag || VP.drag.type !== 'shapetool') return;
    const d = VP.drag;
    const a = VP.compToScreen(d.startComp.x, d.startComp.y);
    const b = VP.compToScreen(d.curComp.x, d.curComp.y);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,180,100,.9)';
    ctx.fillStyle = 'rgba(255,150,60,.1)';
    ctx.setLineDash([4, 4]);
    if (d.shape === 'ellipse') {
      ctx.beginPath(); ctx.ellipse((a.sx + b.sx) / 2, (a.sy + b.sy) / 2, Math.abs(b.sx - a.sx) / 2, Math.abs(b.sy - a.sy) / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.beginPath(); ctx.rect(Math.min(a.sx, b.sx), Math.min(a.sy, b.sy), Math.abs(b.sx - a.sx), Math.abs(b.sy - a.sy));
    }
    ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  VP.drawMarquee = function (ctx) {
    const d = VP.drag;
    ctx.save();
    ctx.fillStyle = 'rgba(255,160,70,.08)';
    ctx.strokeStyle = 'rgba(255,180,100,.8)';
    ctx.setLineDash([4, 3]);
    const a = VP.compToScreen(d.startComp.x, d.startComp.y);
    const b = VP.compToScreen(d.curComp.x, d.curComp.y);
    ctx.fillRect(Math.min(a.sx, b.sx), Math.min(a.sy, b.sy), Math.abs(b.sx - a.sx), Math.abs(b.sy - a.sy));
    ctx.strokeRect(Math.min(a.sx, b.sx), Math.min(a.sy, b.sy), Math.abs(b.sx - a.sx), Math.abs(b.sy - a.sy));
    ctx.restore();
  };
  VP.drawToolHint = function (ctx) {
    const hint = VP._hint || ({ select: '拖动移动；手柄缩放；上方圆点旋转；双击进入曲线', rotate: '拖动旋转所选图层', scale: '拖动缩放所选图层', anchor: '拖动锚点，画面位置保持不变', pin: '拖动图钉目标位置', orbit: '拖动环绕自由视图' }[AE.app.activeTool] || '');
    if (!hint) return;
    ctx.save();
    ctx.font = '9px "Microsoft YaHei", sans-serif';
    const w = ctx.measureText(hint).width + 18;
    ctx.fillStyle = 'rgba(10,12,15,.66)';
    ctx.fillRect(10, AE.app.view.bounds.frameH - 28, w, 19);
    ctx.fillStyle = 'rgba(220,190,155,.8)';
    ctx.fillText(hint, 18, AE.app.view.bounds.frameH - 15);
    ctx.restore();
  };

  // ---------------- 拾取辅助 ----------------
  VP.hitHandle = function (sx, sy) {
    if (AE.app.selection.length !== 1) return null;
    const layer = AE.app.primary();
    if (!layer || M.renders3D(layer)) return null;
    const c = corners2D(layer, AE.app.time);
    const pts = c.pts.map(p => VP.compToScreen(p.x, p.y));
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(sx - pts[i].sx, sy - pts[i].sy) < 8) return { type: 'scaleHandle', index: i, layer };
    }
    const midTop = { x: (pts[0].sx + pts[1].sx) / 2, y: (pts[0].sy + pts[1].sy) / 2 };
    const cx = (pts[0].sx + pts[2].sx) / 2, cy = (pts[0].sy + pts[2].sy) / 2;
    const dx = midTop.x - cx, dy = midTop.y - cy, len = Math.hypot(dx, dy) || 1;
    const hx = midTop.x + dx / len * 24, hy = midTop.y + dy / len * 24;
    if (Math.hypot(sx - hx, sy - hy) < 9) return { type: 'rotate', layer };
    // 锚点
    const ctxA = A.newCtx(AE.app.comp, layer, AE.app.time);
    const wm = A.worldMatrix(layer, AE.app.time, ctxA);
    const anchor = A.vec3(A.sample(layer.transform.anchor, AE.app.time, layer, ctxA));
    const ap = U.m4.applyPoint(wm, anchor);
    const sa = VP.compToScreen(ap.x, ap.y);
    if (Math.hypot(sx - sa.sx, sy - sa.sy) < 9) return { type: 'anchor', layer };
    return null;
  };

  VP.hitPath = function (sx, sy) {
    const layer = AE.app.primary();
    if (!layer) return null;
    const pos = layer.transform.position;
    if (!A.isAnimated(pos)) return null;
    const is3d = M.renders3D(layer);
    const comp = AE.app.comp;
    const parent = A.getParent(layer, comp);
    for (const k of pos.keyframes) {
      const pm = parent ? A.worldMatrix(parent, k.t, A.newCtx(comp, parent, k.t)) : U.m4.identity();
      const v = A.vec3(k.v);
      const sp = VP.worldToScreen(U.m4.applyPoint(pm, v), is3d);
      if (sp && Math.hypot(sx - sp.sx, sy - sp.sy) < 9) return { type: 'pathKey', key: k, layer };
      if (Math.abs(k.t - AE.app.time) < 1e-3) {
        for (const h of [k.sOut, k.sIn]) {
          if (!h || (Math.abs(h.x) < 1e-4 && Math.abs(h.y) < 1e-4)) continue;
          const hv = { x: v.x + h.x, y: v.y + h.y, z: (v.z || 0) + (h.z || 0) };
          const hs = VP.worldToScreen(U.m4.applyPoint(pm, hv), is3d);
          if (hs && Math.hypot(sx - hs.sx, sy - hs.sy) < 8) return { type: 'spatialHandle', key: k, handle: h, layer };
        }
      }
    }
    return null;
  };

  VP.hitPin = function (sx, sy) {
    const layer = AE.app.primary();
    if (!layer || !layer.pins) return null;
    const comp = AE.app.comp;
    const ctxA = A.newCtx(comp, layer, AE.app.time);
    const wm = A.worldMatrix(layer, AE.app.time, ctxA);
    for (let i = 0; i < layer.pins.length; i++) {
      const pin = layer.pins[i];
      if (!pin.enabled) continue;
      const p = U.m4.applyPoint(wm, A.vec3(A.sample(pin.position, AE.app.time, layer, ctxA)));
      const sp = VP.worldToScreen(p, M.renders3D(layer));
      const tp = U.m4.applyPoint(wm, A.vec3(A.sample(pin.target, AE.app.time, layer, ctxA)));
      const st = VP.worldToScreen(tp, M.renders3D(layer));
      if (sp && Math.hypot(sx - sp.sx, sy - sp.sy) < 12) return { type: 'pin', pin, mode: 'position', layer };
      if (st && Math.hypot(sx - st.sx, sy - st.sy) < 12) return { type: 'pin', pin, mode: 'target', layer };
    }
    return null;
  };

  function localPointOnLayer(layer, compX, compY) {
    const ctxA = A.newCtx(AE.app.comp, layer, AE.app.time);
    const wm = A.worldMatrix(layer, AE.app.time, ctxA);
    const inv = U.m4.invert(wm);
    const p = U.m4.applyPoint(inv, { x: compX, y: compY, z: 0 });
    return { x: p.x, y: p.y, z: p.z };
  }

  // ---------------- 指针事件 ----------------
  VP.onDown = function (e) {
    if (!AE.app.comp) return;
    if (e.button === 2) {
      // 右键环绕
      VP.startOrbit(e);
      return;
    }
    if (e.button !== 0) return;
    const comp = VP.screenToComp(e.clientX, e.clientY);
    VP.lastCompPoint = comp;
    const tool = AE.app.activeTool;
    if (tool === 'hand') { VP.startPan(e); return; }
    if (tool === 'zoom') { AE.app.zoom(e.altKey ? 0.8 : 1.25); return; }
    if (tool === 'orbit') { VP.startOrbit(e); return; }
    if (tool === 'text') { VP.createTextAt(comp); return; }
    if (tool === 'rect' || tool === 'ellipse') { VP.startShapeTool(e, tool); return; }
    if (tool === 'pen') { VP.penDown(e, comp); return; }
    if (tool === 'pin') { VP.pinClick(e, comp); return; }
    // 选择/旋转/缩放/锚点
    const handle = VP.hitHandle(e.clientX, e.clientY);
    if (handle) {
      if (handle.type === 'rotate' || tool === 'rotate') { VP.startRotate(e, handle.layer); return; }
      if (handle.type === 'scaleHandle' || tool === 'scale') { VP.startScale(e, handle.layer); return; }
      if (handle.type === 'anchor' || tool === 'anchor') { VP.startAnchor(e, handle.layer); return; }
    }
    if (tool === 'rotate') { const l = AE.app.primary(); if (l) { VP.startRotate(e, l); return; } }
    if (tool === 'scale') { const l = AE.app.primary(); if (l) { VP.startScale(e, l); return; } }
    if (tool === 'anchor') { const l = AE.app.primary(); if (l) { VP.startAnchor(e, l); return; } }
    const pinHit = VP.hitPin(e.clientX, e.clientY);
    if (pinHit && (pinHit.layer === AE.app.primary())) { VP.startPinDrag(e, pinHit); return; }
    const pathHit = VP.hitPath(e.clientX, e.clientY);
    if (pathHit) { VP.startPathDrag(e, pathHit); return; }
    const layer = AE.pick.at(AE.app.comp, AE.app.time, comp.x, comp.y);
    if (layer) {
      AE.app.selectLayer(layer, e.shiftKey);
      VP.startMove(e, AE.app.selection.length ? AE.app.selectedLayers() : [layer]);
    } else {
      if (!e.shiftKey) AE.app.selectLayer(null, false);
      VP.startMarquee(e, comp);
    }
  };

  VP.onMove = function (e) {
    if (!AE.app.comp) return;
    const comp = VP.screenToComp(e.clientX, e.clientY);
    VP.lastCompPoint = comp;
    VP.hover = comp;
    const hud = document.getElementById('hudMouse');
    if (hud) hud.textContent = `X ${Math.round(comp.x)}  Y ${Math.round(comp.y)}`;
    if (VP.drag) VP.dragMove(e, comp);
    else if (VP.pen && VP.pen.op) {
      // 预览钢笔到光标
      const op = VP.pen.op;
      if (op.contours && op.contours[0]) op.contours[0]._cursor = comp;
      AE.app.requestRender(true);
    }
  };
  VP.onUp = function (e) {
    if (VP.drag) VP.dragUp(e);
    else if (VP.pen && VP.pen.op) VP.penUp(e);
  };

  // ---------------- 移动 ----------------
  VP.startMove = function (e, layers) {
    if (!layers.length) return;
    AE.app.snapshot('移动图层');
    const start = VP.screenToComp(e.clientX, e.clientY);
    const data = layers.map(l => {
      const ctx = A.newCtx(AE.app.comp, l, AE.app.time);
      const pos = A.vec3(A.sample(l.transform.position, AE.app.time, l, ctx));
      const parent = A.getParent(l, AE.app.comp);
      return { layer: l, pos, parent };
    });
    VP.drag = {
      type: 'move', start, layers: data, current: start,
      move: (ev, c) => {
        const dx = c.x - start.x, dy = c.y - start.y;
        for (const d of data) {
          let lx = dx, ly = dy, lz = 0;
          if (d.parent) {
            const pm = A.worldMatrix(d.parent, AE.app.time, A.newCtx(AE.app.comp, d.parent, AE.app.time));
            const inv = U.m4.invert(pm);
            const delta = U.m4.applyDir(inv, { x: dx, y: dy, z: 0 });
            lx = delta.x; ly = delta.y; lz = delta.z;
          }
          let p = { x: d.pos.x + lx, y: d.pos.y + ly, z: (d.pos.z || 0) + lz };
          if (!A.is3D(d.layer)) p.z = 0;
          A.setPropAt(d.layer.transform.position, AE.app.time, d.layer, p);
        }
        A.clearCache();
        AE.app.requestRender();
        AE.props.onTime(AE.app.time);
      }
    };
  };

  VP.startRotate = function (e, layer) {
    if (!layer) return;
    AE.app.selectLayer(layer, false);
    AE.app.snapshot('旋转图层');
    const start = VP.screenToComp(e.clientX, e.clientY);
    const ctx = A.newCtx(AE.app.comp, layer, AE.app.time);
    const wm = A.worldMatrix(layer, AE.app.time, ctx);
    const anchor = A.vec3(A.sample(layer.transform.anchor, AE.app.time, layer, ctx));
    const ap = U.m4.applyPoint(wm, anchor);
    const startAngle = Math.atan2(start.y - ap.y, start.x - ap.x) * U.RAD;
    const startRot = A.n(A.sample(layer.transform.rotation, AE.app.time, layer, ctx));
    VP.drag = {
      type: 'rotate', layer,
      move: (ev, c) => {
        const ang = Math.atan2(c.y - ap.y, c.x - ap.x) * U.RAD;
        let r = startRot + (ang - startAngle);
        if (ev.shiftKey) r = Math.round(r / 15) * 15;
        A.setPropAt(layer.transform.rotation, AE.app.time, layer, r);
        A.clearCache(); AE.app.requestRender(); AE.props.onTime(AE.app.time);
      }
    };
  };
  VP.startScale = function (e, layer) {
    if (!layer) return;
    AE.app.selectLayer(layer, false);
    AE.app.snapshot('缩放图层');
    const start = VP.screenToComp(e.clientX, e.clientY);
    const ctx = A.newCtx(AE.app.comp, layer, AE.app.time);
    const wm = A.worldMatrix(layer, AE.app.time, ctx);
    const anchor = A.vec3(A.sample(layer.transform.anchor, AE.app.time, layer, ctx));
    const ap = U.m4.applyPoint(wm, anchor);
    const startDist = Math.max(4, Math.hypot(start.x - ap.x, start.y - ap.y));
    const sc0 = A.vec3(A.sample(layer.transform.scale, AE.app.time, layer, ctx));
    VP.drag = {
      type: 'scale', layer,
      move: (ev, c) => {
        const d = Math.max(4, Math.hypot(c.x - ap.x, c.y - ap.y));
        let f = d / startDist;
        if (ev.shiftKey) f = Math.round(f * 10) / 10;
        A.setPropAt(layer.transform.scale, AE.app.time, layer, { x: sc0.x * f, y: sc0.y * f, z: sc0.z });
        A.clearCache(); AE.app.requestRender(); AE.props.onTime(AE.app.time);
      }
    };
  };
  VP.startAnchor = function (e, layer) {
    if (!layer) return;
    AE.app.selectLayer(layer, false);
    AE.app.snapshot('移动锚点');
    const startLocal = localPointOnLayer(layer, VP.lastCompPoint.x, VP.lastCompPoint.y);
    const ctx = A.newCtx(AE.app.comp, layer, AE.app.time);
    const a0 = A.vec3(A.sample(layer.transform.anchor, AE.app.time, layer, ctx));
    VP.drag = {
      type: 'anchor', layer,
      move: (ev, c) => {
        const p = localPointOnLayer(layer, c.x, c.y);
        const na = { x: a0.x + (p.x - startLocal.x), y: a0.y + (p.y - startLocal.y), z: a0.z + (p.z - startLocal.z) };
        A.setAnchorPreserving(layer, na, AE.app.time);
        A.clearCache(); AE.app.requestRender(); AE.props.onTime(AE.app.time);
      }
    };
  };
  VP.startPinDrag = function (e, hit) {
    const layer = hit.layer;
    const pin = hit.pin;
    AE.app.snapshot('拖动图钉');
    const ctx = A.newCtx(AE.app.comp, layer, AE.app.time);
    const startLocal = localPointOnLayer(layer, VP.lastCompPoint.x, VP.lastCompPoint.y);
    const target0 = A.vec3(A.sample(pin.target, AE.app.time, layer, ctx));
    VP.drag = {
      type: 'pin', layer, pin,
      move: (ev, c) => {
        const p = localPointOnLayer(layer, c.x, c.y);
        const nv = hit.mode === 'target'
          ? { x: target0.x + (p.x - startLocal.x), y: target0.y + (p.y - startLocal.y), z: target0.z }
          : { x: target0.x, y: target0.y, z: target0.z };
        if (hit.mode === 'target') {
          A.setPropAt(pin.target, AE.app.time, layer, nv);
        } else {
          A.setPropAt(pin.position, AE.app.time, layer, { x: A.vec3(A.sample(pin.position, AE.app.time, layer, ctx)).x + (p.x - startLocal.x), y: A.vec3(A.sample(pin.position, AE.app.time, layer, ctx)).y + (p.y - startLocal.y), z: 0 });
        }
        A.clearCache(); AE.app.requestRender(); AE.props.onTime(AE.app.time);
      }
    };
  };
  VP.startPathDrag = function (e, hit) {
    const layer = hit.layer;
    AE.app.snapshot('编辑运动路径');
    const pos = layer.transform.position;
    const key = hit.key;
    const start = VP.screenToComp(e.clientX, e.clientY);
    const keyT = key.t;
    const v0 = A.vec3(key.v);
    const parent = A.getParent(layer, AE.app.comp);
    const pm = parent ? A.worldMatrix(parent, keyT, A.newCtx(AE.app.comp, parent, keyT)) : U.m4.identity();
    const inv = U.m4.invert(pm);
    const handle0 = hit.handle ? { x: hit.handle.x, y: hit.handle.y, z: hit.handle.z || 0 } : null;
    VP.drag = {
      type: 'path', layer, key,
      move: (ev, c) => {
        const dx = c.x - start.x, dy = c.y - start.y;
        const d = U.m4.applyDir(inv, { x: dx, y: dy, z: 0 });
        if (hit.type === 'pathKey') {
          key.v = { x: v0.x + d.x, y: v0.y + d.y, z: (v0.z || 0) + d.z };
        } else if (hit.type === 'spatialHandle') {
          hit.handle.x = handle0.x + d.x; hit.handle.y = handle0.y + d.y; hit.handle.z = (handle0.z || 0) + d.z;
          // 同时让另一侧的手柄对称
          const other = hit.handle === key.sOut ? key.sIn : key.sOut;
          if (other && !ev.altKey) { other.x = -hit.handle.x; other.y = -hit.handle.y; other.z = -(hit.handle.z || 0); }
        }
        A.clearCache(); AE.app.requestRender(); AE.props.onTime(AE.app.time);
      }
    };
  };

  VP.startMarquee = function (e, comp) {
    const start = { x: e.clientX, y: e.clientY };
    VP.drag = {
      type: 'marquee', startScreen: start, startComp: comp, curComp: comp,
      move: (ev, c) => {
        VP.drag.curComp = c;
        AE.app.requestRender(true);
      },
      up: (ev) => {
        const a = VP.drag.startComp, d = VP.drag.curComp;
        const x0 = Math.min(a.x, d.x), x1 = Math.max(a.x, d.x), y0 = Math.min(a.y, d.y), y1 = Math.max(a.y, d.y);
        const picked = [];
        const bnd = AE.app.view.bounds;
        for (const l of AE.app.comp.layers) {
          if (!l.enabled) continue;
          if (l.type === 'sound' || l.type === 'camera' || l.type === 'light' || l.type === 'field') continue;
          let p = null;
          if (M.renders3D(l)) {
            const wm = A.worldMatrix(l, AE.app.time, A.newCtx(AE.app.comp, l, AE.app.time));
            const wp = U.m4.applyPoint(wm, { x: 0, y: 0, z: 0 });
            const sp = VP.worldToScreen(wp, true);
            if (sp) p = { x: (sp.sx / bnd.frameW - 0.5) * AE.app.comp.width, y: (sp.sy / bnd.frameH - 0.5) * AE.app.comp.height };
          } else {
            const wm = A.worldMatrix(l, AE.app.time, A.newCtx(AE.app.comp, l, AE.app.time));
            const wp = U.m4.applyPoint(wm, { x: 0, y: 0, z: 0 });
            p = { x: wp.x, y: wp.y };
          }
          if (p && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) picked.push(l);
        }
        AE.app.selection = ev.shiftKey ? Array.from(new Set(AE.app.selection.concat(picked.map(l => l.id)))) : picked.map(l => l.id);
        AE.app.primaryId = AE.app.selection[0] || null;
        AE.app.refreshAll();
        AE.app.requestRender(true);
      }
    };
  };

  VP.startOrbit = function (e) {
    AE.app.view.viewMode = 'free';
    const fc = AE.app.view.freeCamera;
    const start = { x: e.clientX, y: e.clientY, yaw: fc.yaw, pitch: fc.pitch };
    VP.drag = {
      type: 'orbit',
      move: (ev) => {
        fc.yaw = start.yaw - (ev.clientX - start.x) * 0.006;
        fc.pitch = U.clamp(start.pitch + (ev.clientY - start.y) * 0.006, -1.2, 1.3);
        AE.ui.setViewMode('free');
        AE.app.requestRender();
      }
    };
  };
  VP.startPan = function (e) {
    const fc = AE.app.view.freeCamera;
    const start = { x: e.clientX, y: e.clientY, target: { ...fc.target } };
    VP.drag = {
      type: 'pan',
      move: (ev) => {
        const comp = AE.app.comp;
        const scale = AE.app.view.bounds.frameW / comp.width / Math.max(0.2, (AE.app.view.zoom || 1));
        fc.target.x = start.target.x - (ev.clientX - start.x) * scale;
        fc.target.y = start.target.y - (ev.clientY - start.y) * scale;
        AE.app.view.viewMode = 'free';
        AE.ui.setViewMode('free');
        AE.app.requestRender();
      }
    };
  };

  VP.createTextAt = function (comp) {
    AE.app.snapshot('创建文字');
    const l = M.newLayer(AE.app.comp, 'text', { content: '新文字', fontSize: 140, fill: '#f0dcc2', name: '文字' });
    l.transform.position.value = { x: comp.x, y: comp.y, z: 0 };
    M.addLayer(AE.app.comp, l, 0);
    l.threeD = false;
    AE.app.selection = [l.id]; AE.app.primaryId = l.id;
    M.bump(AE.app.project);
    AE.app.refreshAll();
    AE.app.requestRender();
    UI.toast('已创建文字图层，右侧可编辑内容');
  };

  VP.startShapeTool = function (e, shape) {
    const start = VP.screenToComp(e.clientX, e.clientY);
    VP.drag = {
      type: 'shapetool', shape, startComp: start, curComp: start,
      move: (ev, c) => {
        VP.drag.curComp = c;
        if (Math.abs(c.x - start.x) > 4 || Math.abs(c.y - start.y) > 4) {
          AE.app.requestRender(true);
        }
      },
      up: (ev) => {
        const c = VP.drag.curComp;
        const w = Math.abs(c.x - start.x), h = Math.abs(c.y - start.y);
        if (w < 4 || h < 4) { AE.app.setTool('select'); return; }
        AE.app.snapshot('绘制形状');
        const l = M.newLayer(AE.app.comp, 'shape', { shape, w, h, fill: '#e2a365', name: shape === 'ellipse' ? '椭圆' : '矩形' });
        l.transform.position.value = { x: (c.x + start.x) / 2, y: (c.y + start.y) / 2, z: 0 };
        M.addLayer(AE.app.comp, l, 0);
        AE.app.selection = [l.id]; AE.app.primaryId = l.id;
        M.bump(AE.app.project);
        AE.app.refreshAll();
        AE.app.requestRender();
        AE.app.setTool('select');
      }
    };
  };

  VP.penDown = function (e, comp) {
    if (!VP.pen || !VP.pen.op) {
      AE.app.snapshot('创建路径');
      const l = M.newLayer(AE.app.comp, 'shape', { name: '路径', shape: 'path' });
      const op = M.opDefaults('path', { contours: [{ closed: false, alpha: 1, pts: [] }], name: '贝塞尔路径' });
      l.shape.ops = [op];
      l.shape.fill.enabled = false;
      l.shape.stroke.enabled = true;
      l.shape.stroke.width.value = 4;
      l.shape.stroke.color.value = '#f0b47a';
      l.transform.position.value = { x: 0, y: 0, z: 0 };
      M.addLayer(AE.app.comp, l, 0);
      AE.app.selection = [l.id]; AE.app.primaryId = l.id;
      AE.app.refreshAll();
      VP.pen = { layer: l, op, dragIndex: -1 };
      VP.pen.op.contours[0].pts = [];
    }
    const pen = VP.pen;
    const pts = pen.op.contours[0].pts;
    if (pts.length > 2) {
      const first = VP.compToScreen(pts[0].x, pts[0].y);
      if (Math.hypot(first.sx - (e.clientX - VP.canvas.getBoundingClientRect().left), first.sy - (e.clientY - VP.canvas.getBoundingClientRect().top)) < 10) {
        pen.op.contours[0].closed = true;
        VP.finishPen();
        return;
      }
    }
    const p = { x: comp.x, y: comp.y, ix: 0, iy: 0, ox: 0, oy: 0 };
    pts.push(p);
    pen.dragIndex = pts.length - 1;
    pen._down = { x: e.clientX, y: e.clientY, p };
    AE.app.requestRender(true);
  };
  VP.penUp = function (e) {
    if (!VP.pen || !VP.pen._down) return;
    VP.pen._down = null;
    if (VP.pen.layer) { M.bump(AE.app.project); AE.app.refreshAll(); AE.app.requestRender(); }
  };
  VP.finishPen = function () {
    if (VP.pen && VP.pen.layer) {
      M.bump(AE.app.project);
      AE.app.refreshAll();
      AE.app.requestRender();
      AE.app.setTool('select');
    }
    VP.pen = null;
  };
  VP.startPathEdit = function (layer, op) {
    AE.app.setTool('pen');
    VP.pen = { layer, op, dragIndex: -1 };
    VP.setHint('编辑路径节点：拖动节点或切线控制点，Enter 完成');
    AE.app.requestRender(true);
  };

  VP.dragMove = function (e, comp) {
    const d = VP.drag;
    if (!d) return;
    if (d.type === 'orbit' || d.type === 'pan' || d.type === 'marquee' || d.type === 'shapetool' || d.type === 'penDrag') {
      if (d.move) d.move(e, comp);
      return;
    }
    if (d.type === 'penNode') {
      const dx = comp.x - d.startComp.x, dy = comp.y - d.startComp.y;
      d.pt.x = d.p0.x + dx; d.pt.y = d.p0.y + dy;
      A.clearCache(); AE.app.requestRender(); return;
    }
    if (d.move) { d.move(e, comp); return; }
    if (d.type === 'move' && d.move) d.move(e, comp);
  };
  VP.dragUp = function (e) {
    const d = VP.drag;
    VP.drag = null;
    if (d && d.up) d.up(e);
    if (d && d.type === 'pin') AE.particles.invalidate();
    if (d && d.type === 'path') AE.app.requestRender(true);
    if (d && d.type !== 'orbit' && d.type !== 'pan' && d.type !== 'marquee') {
      AE.props.refresh();
      AE.timeline.refresh();
      AE.app.requestRender();
    }
  };

  // 钢笔拖拽切线（在 drag 之外处理）
  VP._penMoveBound = false;
  VP.penMove = function (e) {
    if (!VP.pen || !VP.pen._down) return;
    const comp = VP.screenToComp(e.clientX, e.clientY);
    const p = VP.pen._down.p;
    p.ox = comp.x - p.x;
    p.oy = comp.y - p.y;
    p.ix = -p.ox;
    p.iy = -p.oy;
    AE.app.requestRender(true);
  };

  // 补全钢笔拖动
  VP.canvas && null;
  global.addEventListener('pointermove', (e) => {
    if (VP.pen && VP.pen._down && !VP.drag) VP.penMove(e);
  });
  global.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && VP.pen) { if (VP.pen.op.contours[0].closed === false) VP.pen.op.contours[0].closed = true; VP.finishPen(); }
    if (e.key === 'Escape' && VP.pen) { VP.pen = null; AE.app.setTool('select'); AE.app.requestRender(true); }
    if (e.key === 'Enter' && !VP.pen && AE.app.activeTool === 'text') AE.app.setTool('select');
  });

  // 创建文字后拖动场景时保持工具提示
  VP.updateHint = () => {};

})(window);
