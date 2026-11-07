/* PRISM canvas viewport: overlays, selection, transform gizmos, drawing tools */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, G = AE.G, T = AE.Text, P = AE.P, E = AE.Eval, B = AE.Build;
  const CV = (AE.CanvasView = {});
  const $ = U.$, $$ = U.$$;
  CV.tool = 'select';
  CV.pen = null;
  CV.drag = null;
  CV.hover = null;
  CV._ids = null;

  CV.init = function () {
    const stage = $('#stageView');
    if (!stage) return;
    this.stage = stage;
    this.overlay = $('#overlayCanvas');
    this.base = $('#glCanvas');
    this.resize();
    stage.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    stage.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    stage.addEventListener('contextmenu', (e) => { if (e.target.closest('canvas')) { e.preventDefault(); this.onContextMenu(e); } });
    stage.addEventListener('wheel', (e) => {
      if (e.target.closest('.vp-toolbar')) return;
      e.preventDefault();
      const app = AE.App;
      const rect = stage.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      if (e.shiftKey) { app.view.panX -= e.deltaY; app.requestRender(); return; }
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const sc = this.stageCenter();
      app.view.panX = (1 - f) * (cx - sc.x) + f * (app.view.panX || 0);
      app.view.panY = (1 - f) * (cy - sc.y) + f * (app.view.panY || 0);
      app.view.zoom = U.clamp((app.view.zoom || 1) * f, .08, 12);
      app.requestRender();
    }, { passive: false });
    $$('#toolGroup .tool').forEach(b => b.onclick = () => this.setTool(b.dataset.tool));
    window.addEventListener('keydown', (e) => {
      if (AE.App.isTyping()) return;
      if (e.key === 'Enter' && this.pen) { this.finishPen(); e.preventDefault(); }
      if (e.key === 'Escape' && this.pen) { this.pen = null; this.draw(); }
    });
    this.setTool('select');
    this.draw();
  };
  CV.resize = function () {
    const stage = this.stage || $('#stageView');
    if (!stage || !this.overlay) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round(stage.clientWidth * dpr)), h = Math.max(2, Math.round(stage.clientHeight * dpr));
    if (this.overlay.width !== w || this.overlay.height !== h) { this.overlay.width = w; this.overlay.height = h; }
    this.dpr = dpr;
  };
  CV.setTool = function (tool) {
    this.tool = tool;
    if (tool !== 'pen') this.pen = null;
    $$('#toolGroup .tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    const stage = this.stage;
    if (stage) stage.style.cursor = tool === 'hand' ? 'grab' : tool === 'zoom' ? 'zoom-in' : tool === 'text' ? 'text' : tool === 'pen' || tool === 'mask' ? 'crosshair' : 'default';
    this.draw();
  };
  CV.stageCenter = function () {
    const stage = this.stage.getBoundingClientRect();
    return { x: stage.width / 2, y: stage.height / 2 };
  };
  CV.compRect = function () {
    const app = AE.App, comp = app.comp;
    const stage = this.stage;
    if (!stage || !comp) return null;
    const sr = stage.getBoundingClientRect();
    const dpr = this.dpr || 1;
    const r = app.renderer && app.renderer.lastCompRect;
    if (r && r.w > 0) return { x: r.x / dpr, y: r.y / dpr, w: r.w / dpr, h: r.h / dpr, stageW: sr.width, stageH: sr.height };
    // fallback fit
    const margin = 22;
    const fit = Math.min((sr.width - margin * 2) / comp.width, (sr.height - margin * 2) / comp.height);
    const w = comp.width * fit, h = comp.height * fit;
    return { x: (sr.width - w) / 2, y: (sr.height - h) / 2, w, h, stageW: sr.width, stageH: sr.height };
  };
  CV.compToScreen = function (x, y) {
    const cr = this.compRect(), app = AE.App;
    if (!cr || !app.comp) return [0, 0];
    return [cr.x + x / app.comp.width * cr.w, cr.y + y / app.comp.height * cr.h];
  };
  CV.screenToComp = function (sx, sy) {
    const cr = this.compRect(), app = AE.App;
    if (!cr || !app.comp) return [0, 0];
    return [(sx - cr.x) / cr.w * app.comp.width, (sy - cr.y) / cr.h * app.comp.height];
  };
  CV.eventPos = function (e) {
    const r = this.stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  CV.getCamera = function () {
    const app = AE.App, comp = app.comp; if (!comp) return null;
    if (app.viewOverride && app.viewOverride.type) return app.renderer.helperCamera(comp, app.viewOverride);
    const ctx = E.makeCtx(app.project, comp, app.time);
    return E.activeCameraState(comp, ctx, app.time);
  };
  CV.projectWorld = function (p) {
    const app = AE.App, comp = app.comp;
    if (!app || !comp) return null;
    const cam = this.getCamera();
    const vp = E.cameraMatrices(cam, comp).vp;
    const x = p[0], y = p[1], z = p[2] || 0;
    const clip = [
      vp[0] * x + vp[4] * y + vp[8] * z + vp[12],
      vp[1] * x + vp[5] * y + vp[9] * z + vp[13],
      vp[2] * x + vp[6] * y + vp[10] * z + vp[14],
      vp[3] * x + vp[7] * y + vp[11] * z + vp[15]
    ];
    if (clip[3] <= 0.0001) return null;
    const nx = clip[0] / clip[3], ny = clip[1] / clip[3];
    const cx = (nx + 1) / 2 * comp.width, cy = (1 - ny) / 2 * comp.height;
    const s = this.compToScreen(cx, cy);
    return { x: s[0], y: s[1], z: clip[3], ndc: [nx, ny] };
  };
  CV.layerIs3D = function (layer, ctx, time) { return AE.App.renderer.is3DLayer(layer, ctx, time); };
  CV.layerWorldBounds = function (layer, ctx, time) {
    const app = AE.App, comp = app.comp;
    try {
      if (layer.type === 'geo' || layer.type === 'nodes' || layer.type === 'particle' || (layer.type === 'shape' && layer.threeD) || (layer.type === 'text' && layer.threeD) || (layer.type === 'precomp' && layer.precomp.mode === 'preserve3d')) {
        if (layer.type === 'particle') return null;
        const res = B.layerWorldMesh(comp, layer, time, ctx, { cache: this._meshCache || (this._meshCache = new Map()) });
        if (!res || !res.objects || !res.objects.length) return null;
        let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (const o of res.objects) {
          const bb = o.mesh.bbox || AE.Mesh.computeBBox(o.mesh);
          for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], bb.min[k]); max[k] = Math.max(max[k], bb.max[k]); }
        }
        return { min, max };
      }
    } catch (e) { return null; }
    return null;
  };
  CV.layerScreenBounds = function (layer, ctx, time) {
    const app = AE.App, comp = app.comp;
    const is3d = this.layerIs3D(layer, ctx, time);
    if (is3d) {
      const wb = this.layerWorldBounds(layer, ctx, time);
      if (!wb) {
        const p = E.vec(E.propValue(layer, 'transform.position', ctx, time), 3).map(E.num);
        const s = this.projectWorld(p);
        if (!s) return null;
        return { x: s.x - 26, y: s.y - 26, w: 52, h: 52, poly: null };
      }
      let xs = [], ys = [];
      for (let i = 0; i < 8; i++) {
        const p = [i & 1 ? wb.max[0] : wb.min[0], i & 2 ? wb.max[1] : wb.min[1], i & 4 ? wb.max[2] : wb.min[2]];
        const s = this.projectWorld(p); if (s) { xs.push(s.x); ys.push(s.y); }
      }
      if (!xs.length) return null;
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), poly: null };
    }
    const b = E.layerBounds(comp, layer, time, app.project, ctx);
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(p => this.compToScreen(p[0], p[1]));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), poly: pts };
  };
  CV.hitTest = function (sx, sy) {
    const app = AE.App, comp = app.comp; if (!comp) return null;
    const ctx = E.makeCtx(app.project, comp, app.time);
    const cpt = this.screenToComp(sx, sy);
    // non-visual helper layers (camera/light/field/null)
    const ordered = comp.layers.slice().reverse();
    for (const layer of ordered) {
      if (!layer.visible) continue;
      if (layer.pickable === false) continue;
      if (layer.locked) continue;
      if (!E.isActive(comp, layer, app.time)) continue;
      if (E.layerOpacity(layer, ctx, app.time) < 2.5) continue;
      if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'null') {
        const p = E.vec(E.propValue(layer, 'transform.position', ctx, app.time), 3).map(E.num);
        const s = this.layerIs3D(layer, ctx, app.time) ? this.projectWorld(p) : this.compToScreen(p[0], p[1]);
        if (s && Math.hypot(s.x - sx, s.y - sy) < 18) return layer;
        continue;
      }
      if (layer.type === 'adjustment') continue;
      const sb = this.layerScreenBounds(layer, ctx, app.time);
      if (!sb) continue;
      if (sb.poly ? pointInPoly([sx, sy], sb.poly) : (sx >= sb.x - 2 && sx <= sb.x + sb.w + 2 && sy >= sb.y - 2 && sy <= sb.y + sb.h + 2)) return layer;
    }
    return null;
  };
  CV.anchorScreen = function (layer, ctx) {
    const app = AE.App, comp = app.comp;
    if (this.layerIs3D(layer, ctx, app.time)) {
      const m = E.worldMatrix(comp, layer, ctx, app.time);
      const anchor = E.vec(E.propValue(layer, 'transform.anchor', ctx, app.time), 3).map(E.num);
      const wp = M.transformPoint(m, anchor);
      return this.projectWorld(wp);
    }
    const aff = E.worldAffine(comp, layer, ctx, app.time);
    const anchor = E.vec(E.propValue(layer, 'transform.anchor', ctx, app.time), 2).map(E.num);
    const p = U.affine.apply(aff, anchor[0], anchor[1]);
    const s = this.compToScreen(p[0], p[1]);
    return { x: s[0], y: s[1] };
  };
  CV.axisHandles = function (layer, ctx) {
    const app = AE.App, comp = app.comp;
    const is3d = this.layerIs3D(layer, ctx, app.time);
    if (!is3d) return [];
    const m = E.worldMatrix(comp, layer, ctx, app.time);
    const anchor = E.vec(E.propValue(layer, 'transform.anchor', ctx, app.time), 3).map(E.num);
    const origin = M.transformPoint(m, anchor);
    const s0 = this.projectWorld(origin);
    if (!s0) return [];
    const out = [];
    const colors = ['#ff7a66', '#8ee08e', '#6ba8ff'];
    const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let i = 0; i < 3; i++) {
      const p = M.add(origin, M.mul(axes[i], 120));
      const s = this.projectWorld(p);
      if (!s) continue;
      let dx = s.x - s0.x, dy = s.y - s0.y;
      const l = Math.hypot(dx, dy) || 1;
      const len = Math.min(95, Math.max(45, l));
      out.push({ axis: i, x: s0.x + dx / l * len, y: s0.y + dy / l * len, sx: s0.x, sy: s0.y, color: colors[i], label: 'XYZ'[i], worldAxis: axes[i], origin });
    }
    return out;
  };

  CV.draw = function () {
    const app = AE.App, comp = app && app.comp;
    const cv = this.overlay;
    if (!cv) return;
    this.resize();
    const ctx = cv.getContext('2d');
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
    if (!app || !comp) return;
    if (app.exportMode) return;
    const cr = this.compRect();
    if (!cr) return;
    // comp frame + shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 8;
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1; ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(127,231,212,.28)'; ctx.lineWidth = 1; ctx.strokeRect(cr.x + .5, cr.y + .5, cr.w - 1, cr.h - 1);
    // scene workspace ground grid
    if (app.workspace === 'scene' && app.sceneGrid !== false) this.drawSceneGrid(ctx, comp);
    // frame label
    ctx.fillStyle = 'rgba(160,185,180,.55)'; ctx.font = '9px ' + 'Cascadia Code, monospace';
    ctx.fillText(`${comp.width} × ${comp.height}  ·  ${comp.fps} fps`, cr.x + 1, cr.y - 7);
    if (app.showGuides) {
      ctx.save();
      ctx.strokeStyle = 'rgba(200,230,225,.07)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
      const thirdW = cr.w / 3, thirdH = cr.h / 3;
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cr.x + thirdW * i, cr.y); ctx.lineTo(cr.x + thirdW * i, cr.y + cr.h); ctx.stroke(); }
      for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cr.x, cr.y + thirdH * i); ctx.lineTo(cr.x + cr.w, cr.y + thirdH * i); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(127,231,212,.1)';
      ctx.strokeRect(cr.x + cr.w * .05, cr.y + cr.h * .05, cr.w * .9, cr.h * .9);
      ctx.strokeRect(cr.x + cr.w * .1, cr.y + cr.h * .1, cr.w * .8, cr.h * .8);
      ctx.restore();
    }
    const ectx = E.makeCtx(app.project, comp, app.time);
    const sel = app.selectedLayers();
    // field ranges (only selected, so they don't clutter the composition)
    for (const l of comp.layers) {
      if (l.type === 'field' && app.selection.includes(l.id)) {
        this.drawField(ctx, l, ectx);
      }
    }
    // camera / light helpers (selected)
    for (const l of sel) {
      if (l.type === 'camera') this.drawCamera(ctx, l, ectx);
      if (l.type === 'light') this.drawLight(ctx, l, ectx);
    }
    // selection bounds + gizmos
    for (const layer of sel) this.drawSelection(ctx, layer, ectx);
    if (app.showWire !== false && sel.length === 1) this.drawMeshWire(ctx, sel[0], ectx);
    // pen preview
    if (this.pen && this.pen.points && this.pen.points.length) {
      ctx.save();
      ctx.strokeStyle = '#7fe7d4'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const pts = this.pen.points.map(p => this.compToScreen(p[0], p[1]));
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (this.pen.cursor) { const c = this.compToScreen(this.pen.cursor[0], this.pen.cursor[1]); ctx.lineTo(c[0], c[1]); }
      ctx.stroke();
      for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fillStyle = '#7fe7d4'; ctx.fill(); }
      ctx.restore();
    }
    // drag shape preview / mask preview
    if (this.drag && this.drag.preview) {
      const d = this.drag.preview;
      const a = this.compToScreen(d.x0, d.y0), b = this.compToScreen(d.x1, d.y1);
      ctx.save(); ctx.strokeStyle = '#7fe7d4'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); ctx.restore();
    }
    // cursor coordinates
    const hov = this.hover;
    if (hov && this.tool !== 'select') {
      ctx.fillStyle = 'rgba(9,13,19,.78)'; ctx.fillRect(cr.x + 6, cr.y + cr.h - 21, 118, 15);
      ctx.fillStyle = '#7f958e'; ctx.font = '8px Cascadia Code, monospace';
      const cp = this.screenToComp(hov[0], hov[1]);
      ctx.fillText(`X ${Math.round(cp[0])}  Y ${Math.round(cp[1])}`, cr.x + 11, cr.y + cr.h - 10);
    }
  };
  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  CV.drawSceneGrid = function (ctx, comp) {
    const app = AE.App;
    ctx.save();
    ctx.lineWidth = 1;
    const cy = 980, ext = 2400, step = 240;
    for (let x = -ext; x <= ext; x += step) {
      const p1 = this.projectWorld([comp.width / 2 + x, cy, -ext]), p2 = this.projectWorld([comp.width / 2 + x, cy, ext]);
      if (!p1 || !p2) continue;
      ctx.strokeStyle = x === 0 ? 'rgba(107,168,255,.25)' : 'rgba(90,120,118,.1)';
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    for (let z = -ext; z <= ext; z += step) {
      const p1 = this.projectWorld([comp.width / 2 - ext, cy, z]), p2 = this.projectWorld([comp.width / 2 + ext, cy, z]);
      if (!p1 || !p2) continue;
      ctx.strokeStyle = z === 0 ? 'rgba(127,231,212,.2)' : 'rgba(90,120,118,.1)';
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    const o = this.projectWorld([comp.width / 2, 0, 0]);
    if (o) {
      ctx.font = '8px Cascadia Code, monospace';
      ctx.fillStyle = 'rgba(127,231,212,.6)'; ctx.fillText('WORLD ORIGIN · COMP CENTER', o.x + 8, o.y - 8);
    }
    ctx.restore();
  };
  CV.drawMeshWire = function (ctx, layer, ectx) {
    const app = AE.App, comp = app.comp;
    if (!layer || !this.layerIs3D(layer, ectx, app.time)) return;
    if (!['geo', 'nodes', 'text', 'particle'].includes(layer.type)) return;
    if (layer.type === 'text' && !layer.threeD) return;
    let res = null;
    try { res = AE.Build.layerWorldMesh(comp, layer, app.time, ectx, {}); } catch (e) { return; }
    if (!res || !res.objects || !res.objects.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(127,231,212,.1)';
    ctx.lineWidth = .6;
    ctx.beginPath();
    let drawn = 0;
    for (const o of res.objects) {
      const m = o.mesh; if (!m || !m.pos || !m.idx) continue;
      const step = Math.max(1, Math.floor(m.idx.length / 7000));
      for (let i = 0; i + 2 < m.idx.length && drawn < 2200; i += 3 * step) {
        const tri = [m.idx[i], m.idx[i + 1], m.idx[i + 2]];
        const pts = tri.map(vi => this.projectWorld([m.pos[vi * 3], m.pos[vi * 3 + 1], m.pos[vi * 3 + 2]]));
        if (pts.some(p => !p)) continue;
        ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y); ctx.lineTo(pts[0].x, pts[0].y);
        drawn++;
      }
    }
    ctx.stroke();
    ctx.restore();
  };
  CV.drawSelection = function (ctx, layer, ectx) {
    const app = AE.App, comp = app.comp;
    const sb = this.layerScreenBounds(layer, ectx, app.time);
    const is3d = this.layerIs3D(layer, ectx, app.time);
    const color = '#7fe7d4';
    if (sb) {
      ctx.save();
      ctx.lineWidth = 1;
      if (sb.poly) {
        ctx.strokeStyle = 'rgba(127,231,212,.82)';
        ctx.beginPath(); ctx.moveTo(sb.poly[0][0], sb.poly[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(sb.poly[i][0], sb.poly[i][1]); ctx.closePath(); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(127,231,212,.55)';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(sb.x, sb.y, sb.w, sb.h);
        ctx.setLineDash([]);
      }
      // corner handles for 2D
      if (!is3d) {
        const corners = [[sb.x, sb.y], [sb.x + sb.w, sb.y], [sb.x + sb.w, sb.y + sb.h], [sb.x, sb.y + sb.h]];
        for (const [x, y] of corners) { ctx.fillStyle = '#0c1219'; ctx.fillRect(x - 3.5, y - 3.5, 7, 7); ctx.strokeStyle = color; ctx.strokeRect(x - 3.5, y - 3.5, 7, 7); }
        // rotation handle
        ctx.strokeStyle = 'rgba(127,231,212,.4)'; ctx.beginPath(); ctx.moveTo(sb.x + sb.w / 2, sb.y); ctx.lineTo(sb.x + sb.w / 2, sb.y - 22); ctx.stroke();
        ctx.beginPath(); ctx.arc(sb.x + sb.w / 2, sb.y - 26, 4, 0, Math.PI * 2); ctx.fillStyle = '#0c1219'; ctx.fill(); ctx.strokeStyle = color; ctx.stroke();
      }
      // label
      ctx.fillStyle = 'rgba(120,220,205,.92)'; ctx.font = '9px ' + '"Microsoft YaHei", sans-serif';
      ctx.fillText(layer.name + (layer.parent ? '  ⇢ ' + (comp.layers.find(l => l.id === layer.parent) || {}).name : ''), sb.x + 1, sb.y - 8);
      ctx.restore();
    }
    const anchor = this.anchorScreen(layer, ectx);
    if (anchor) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(anchor.x - 12, anchor.y); ctx.lineTo(anchor.x - 4, anchor.y); ctx.moveTo(anchor.x + 4, anchor.y); ctx.lineTo(anchor.x + 12, anchor.y); ctx.moveTo(anchor.x, anchor.y - 12); ctx.lineTo(anchor.x, anchor.y - 4); ctx.moveTo(anchor.x, anchor.y + 4); ctx.lineTo(anchor.x, anchor.y + 12); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (is3d) {
      const axes = this.axisHandles(layer, ectx);
      ctx.save(); ctx.lineWidth = 1.6;
      for (const a of axes) {
        ctx.strokeStyle = a.color; ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(a.x, a.y); ctx.stroke();
        ctx.fillStyle = '#0c1219'; ctx.beginPath(); ctx.arc(a.x, a.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = a.color; ctx.stroke();
        ctx.fillStyle = a.color; ctx.font = 'bold 8px Cascadia Code, monospace'; ctx.fillText(a.label, a.x + 7, a.y + 3);
      }
      ctx.restore();
    }
    // motion path
    this.drawMotionPath(ctx, layer, ectx);
    // pins
    if (layer.geo && layer.geo.pins && layer.geo.pins.length) this.drawPins(ctx, layer, ectx);
    // path nodes (selected shape)
    if (layer.type === 'shape') this.drawPathNodes(ctx, layer, ectx);
  };
  CV.motionParentMatrix = function (layer, ectx) {
    const app = AE.App;
    const parent = layer.parent ? app.comp.layers.find(l => l.id === layer.parent) : null;
    if (!parent) return { matrix: null, affine: null };
    if (this.layerIs3D(layer, ectx, app.time)) return { matrix: E.worldMatrix(app.comp, parent, ectx, app.time), affine: null };
    return { matrix: null, affine: E.worldAffine(app.comp, parent, ectx, app.time) };
  };
  CV.drawMotionPath = function (ctx, layer, ectx) {
    const p = layer.props['transform.position']; if (!p || !p.keys || p.keys.length < 2) return;
    const app = AE.App;
    const path = E.motionPath(p);
    if (!path.length) return;
    const { matrix: pm, affine: pa } = this.motionParentMatrix(layer, ectx);
    const is3d = this.layerIs3D(layer, ectx, app.time);
    const pts = path.map(pt => {
      if (pm) { const w = M.transformPoint(pm, [pt[0], pt[1], pt[2] || 0]); const s = this.projectWorld(w); return s ? [s.x, s.y] : null; }
      if (pa) { const w = U.affine.apply(pa, pt[0], pt[1]); const s = this.compToScreen(w[0], w[1]); return s; }
      if (is3d) { const s = this.projectWorld([pt[0], pt[1], 0]); return s ? [s.x, s.y] : null; }
      return this.compToScreen(pt[0], pt[1]);
    }).filter(Boolean);
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,180,84,.55)'; ctx.lineWidth = 1.1; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    ctx.setLineDash([]);
    for (const k of p.keys) {
      let sp = null;
      if (pm) { const w = M.transformPoint(pm, [k.v[0], k.v[1], k.v[2] || 0]); sp = this.projectWorld(w); }
      else if (pa) { const w = U.affine.apply(pa, k.v[0], k.v[1]); const s = this.compToScreen(w[0], w[1]); sp = { x: s[0], y: s[1] }; }
      else if (is3d) sp = this.projectWorld([k.v[0], k.v[1], k.v[2] || 0]);
      else { const s = this.compToScreen(k.v[0], k.v[1]); sp = { x: s[0], y: s[1] }; }
      if (!sp) continue;
      const near = Math.abs(k.t - app.time) < 1e-3;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, near ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = near ? '#7fe7d4' : '#ffb454'; ctx.fill();
      ctx.strokeStyle = '#0c1219'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  };
  CV.drawPins = function (ctx, layer, ectx) {
    const app = AE.App;
    ctx.save();
    for (const pin of layer.geo.pins) {
      const wp = B.layerPinWorld(app.comp, layer, pin, ectx, app.time);
      const s = this.projectWorld(wp.world) || (() => { const q = this.compToScreen(wp.world[0], wp.world[1]); return { x: q[0], y: q[1] }; })();
      if (!s) continue;
      const r = Math.max(4, Math.min(12, wp.radius * (this.compRect().w / app.comp.width) * .03));
      ctx.strokeStyle = 'rgba(255,180,84,.8)'; ctx.fillStyle = 'rgba(255,180,84,.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x - 6, s.y); ctx.lineTo(s.x + 6, s.y); ctx.moveTo(s.x, s.y - 6); ctx.lineTo(s.x, s.y + 6); ctx.stroke();
      ctx.fillStyle = '#d8b377'; ctx.font = '8px "Microsoft YaHei"'; ctx.fillText(pin.name, s.x + r + 3, s.y - 4);
    }
    ctx.restore();
  };
  CV.drawPathNodes = function (ctx, layer, ectx) {
    const app = AE.App, comp = app.comp;
    try {
      const res = E.evalContents(layer, ectx, app.time);
      const aff = E.worldAffine(comp, layer, ectx, app.time);
      const color = '#7fe7d4';
      for (const it of res.items) {
        for (const c of it.shape.contours) {
          for (const v of c.verts) {
            const p = U.affine.apply(aff, v.p[0], v.p[1]); const s = this.compToScreen(p[0], p[1]);
            ctx.save();
            ctx.fillStyle = '#0b1218'; ctx.strokeStyle = color; ctx.lineWidth = 1;
            ctx.fillRect(s[0] - 2.5, s[1] - 2.5, 5, 5); ctx.strokeRect(s[0] - 2.5, s[1] - 2.5, 5, 5);
            ctx.restore();
          }
        }
      }
    } catch (e) { }
  };
  CV.drawField = function (ctx, layer, ectx) {
    const app = AE.App, comp = app.comp;
    const fs = E.fieldState(comp, layer, ectx, app.time);
    const pos = fs.position;
    const color = U.cssColor(fs.color);
    const cam = this.getCamera();
    if (!cam) return;
    const mats = E.cameraMatrices(cam, comp);
    const view = mats.view;
    const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
    ctx.save();
    for (let k = 0; k < 3; k++) {
      const r = fs.radius * (1 - k * .26);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 48; i++) {
        const a = i / 48 * Math.PI * 2;
        const wp = [pos[0] + right[0] * Math.cos(a) * r + up[0] * Math.sin(a) * r, pos[1] + right[1] * Math.cos(a) * r + up[1] * Math.sin(a) * r, pos[2] + right[2] * Math.cos(a) * r + up[2] * Math.sin(a) * r];
        const s = this.projectWorld(wp); if (!s) continue;
        if (!started) { ctx.moveTo(s.x, s.y); started = true; } else ctx.lineTo(s.x, s.y);
      }
      ctx.strokeStyle = U.rgbaStr(U.colorArr(fs.color), .13 + .12 * (2 - k)); ctx.lineWidth = 1; ctx.stroke();
    }
    // direction glyphs
    const s0 = this.projectWorld(pos);
    if (s0) {
      ctx.beginPath(); ctx.arc(s0.x, s0.y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.fillStyle = color; ctx.font = '8px "Microsoft YaHei"'; ctx.fillText((fs.type === 'vortex' ? '旋涡场' : fs.type === 'noise' ? '噪声场' : fs.type === 'distance' ? '距离衰减' : '空间场') + '  R ' + Math.round(fs.radius), s0.x + 8, s0.y - 6);
    }
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2, rr = fs.radius * .55;
      const wp = [pos[0] + right[0] * Math.cos(a) * rr + up[0] * Math.sin(a) * rr, pos[1] + right[1] * Math.cos(a) * rr + up[1] * Math.sin(a) * rr, pos[2] + right[2] * Math.cos(a) * rr + up[2] * Math.sin(a) * rr];
      const d = AE.Mesh.fieldAt(fs, wp, app.time);
      const st = this.projectWorld(wp); const en = this.projectWorld([wp[0] + d[0] * 3, wp[1] + d[1] * 3, wp[2] + d[2] * 3]);
      if (!st || !en) continue;
      ctx.strokeStyle = U.rgbaStr(U.colorArr(fs.color), .3); ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(en.x, en.y); ctx.stroke();
    }
    ctx.restore();
  };
  CV.drawCamera = function (ctx, layer, ectx) {
    const app = AE.App, comp = app.comp;
    const cs = E.cameraState(comp, layer, ectx, app.time);
    const eye = this.projectWorld(cs.pos), target = this.projectWorld(cs.target);
    if (!eye || !target) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(169,145,255,.7)'; ctx.fillStyle = 'rgba(169,145,255,.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(eye.x, eye.y); ctx.lineTo(eye.x - 8, eye.y + 14); ctx.lineTo(eye.x + 8, eye.y + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(eye.x, eye.y); ctx.lineTo(target.x, target.y); ctx.stroke();
    ctx.setLineDash([]);
    const fov = U.rad(cs.fov), dist = cs.focus || M.dist(cs.pos, cs.target);
    const aspect = comp.width / comp.height;
    const h = Math.tan(fov / 2) * dist, w = h * aspect;
    const forward = M.norm(M.sub(cs.target, cs.pos));
    let right = M.norm(M.cross(forward, [0, 1, 0])); if (!isFinite(right[0])) right = [1, 0, 0];
    const up = M.norm(M.cross(right, forward));
    const c = M.add(cs.pos, M.mul(forward, dist));
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => this.projectWorld([c[0] + right[0] * x * w + up[0] * y * h, c[1] + right[1] * x * w + up[1] * y * h, c[2] + right[2] * x * w + up[2] * y * h]));
    if (corners.every(Boolean)) { ctx.strokeStyle = 'rgba(169,145,255,.35)'; ctx.beginPath(); ctx.moveTo(eye.x, eye.y); for (const q of corners) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.moveTo(eye.x, eye.y); ctx.lineTo(corners[0].x, corners[0].y); ctx.moveTo(eye.x, eye.y); ctx.lineTo(corners[1].x, corners[1].y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(169,145,255,.9)'; ctx.font = '9px Cascadia Code, monospace'; ctx.fillText('CAM ' + layer.name + '  f' + Math.round(cs.fov) + '°', eye.x + 12, eye.y - 10);
    ctx.restore();
  };
  CV.drawLight = function (ctx, layer, ectx) {
    const app = AE.App, comp = app.comp;
    const ls = E.lightState(comp, layer, ectx, app.time);
    const p = this.projectWorld(ls.pos), t = this.projectWorld(ls.target);
    if (!p) return;
    ctx.save();
    ctx.fillStyle = 'rgba(255,203,115,.9)'; ctx.strokeStyle = 'rgba(255,203,115,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * 9, p.y + Math.sin(a) * 9); ctx.lineTo(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14); ctx.stroke(); }
    if (t && ls.type === 'directional') { ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = 'rgba(255,203,115,.85)'; ctx.font = '9px "Microsoft YaHei"'; ctx.fillText(layer.name + (ls.castsShadow ? ' · 阴影' : ''), p.x + 17, p.y - 8);
    ctx.restore();
  };

  // ---------------- interactions ----------------
  CV.onPointerDown = function (e) {
    const app = AE.App, comp = app.comp;
    if (!comp || e.button === 2) return;
    if (e.target.closest('.vp-toolbar') || e.target.closest('.vp-hud') || e.target.closest('.axis-gizmo')) return;
    const [sx, sy] = this.eventPos(e);
    this._down = { sx, sy, e };
    if (e.button === 1 || this.tool === 'hand') { this.startPan(e); return; }
    if (this.tool === 'zoom') { app.zoomBy(e.altKey ? 1 / 1.3 : 1.3); return; }
    if (this.tool === 'rect' || this.tool === 'ellipse') { this.startShapeDraw(sx, sy, this.tool); return; }
    if (this.tool === 'pen') { this.penClick(sx, sy); return; }
    if (this.tool === 'text') { this.textClick(sx, sy); return; }
    if (this.tool === 'mask') { this.startMaskDraw(sx, sy); return; }
    if (this.tool === 'pin') { this.pinClick(sx, sy); return; }
    const ctx = E.makeCtx(app.project, comp, app.time);
    const selected = app.selectedLayer();
    // handles
    if (selected) {
      // pins
      if (selected.geo && selected.geo.pins && selected.geo.pins.length) {
        for (const pin of selected.geo.pins) {
          const wp = B.layerPinWorld(comp, selected, pin, ctx, app.time);
          const s = this.projectWorld(wp.world) || (() => { const q = this.compToScreen(wp.world[0], wp.world[1]); return { x: q[0], y: q[1] }; })();
          if (s && Math.hypot(s.x - sx, s.y - sy) < 12) { app.selectLayers([selected.id]); this.startPinDrag(e, selected, pin, ctx); return; }
        }
      }
      // 3D axes
      const axes = this.axisHandles(selected, ctx);
      for (const a of axes) if (Math.hypot(a.x - sx, a.y - sy) < 10) { this.startAxisDrag(e, selected, a, ctx); return; }
      // motion path key points
      const mp = selected.props['transform.position'];
      if (mp && mp.keys && mp.keys.length > 1) {
        const { matrix: pm, affine: pa } = this.motionParentMatrix(selected, ctx);
        const is3d = this.layerIs3D(selected, ctx, app.time);
        for (const k of mp.keys) {
          let s = null;
          if (pm) { const w = M.transformPoint(pm, [k.v[0], k.v[1], k.v[2] || 0]); s = this.projectWorld(w); }
          else if (pa) { const w = U.affine.apply(pa, k.v[0], k.v[1]); const q = this.compToScreen(w[0], w[1]); s = { x: q[0], y: q[1] }; }
          else if (is3d) s = this.projectWorld([k.v[0], k.v[1], k.v[2] || 0]);
          else { const q = this.compToScreen(k.v[0], k.v[1]); s = { x: q[0], y: q[1] }; }
          if (s && Math.hypot(s.x - sx, s.y - sy) < 9) { this.startMotionPathDrag(e, selected, k, ctx); return; }
        }
      }
      // anchor
      const an = this.anchorScreen(selected, ctx);
      if (an && Math.hypot(an.x - sx, an.y - sy) < 12) { this.startAnchorDrag(e, selected, ctx); return; }
      // rotation handle
      const sb = this.layerScreenBounds(selected, ctx, app.time);
      if (sb && !this.layerIs3D(selected, ctx, app.time) && Math.hypot(sb.x + sb.w / 2 - sx, sb.y - 26 - sy) < 10) { this.startRotateDrag(e, selected, ctx); return; }
      // scale corners
      if (sb && !this.layerIs3D(selected, ctx, app.time)) {
        const corners = [[sb.x, sb.y], [sb.x + sb.w, sb.y], [sb.x + sb.w, sb.y + sb.h], [sb.x, sb.y + sb.h]];
        for (let i = 0; i < 4; i++) if (Math.hypot(corners[i][0] - sx, corners[i][1] - sy) < 9) { this.startScaleDrag(e, selected, i, ctx); return; }
      }
      // path node edit
      if (selected.type === 'shape' && this.tool === 'select') {
        const node = this.hitPathNode(selected, ctx, sx, sy);
        if (node) { this.startPathNodeDrag(e, selected, node, ctx); return; }
      }
    }
    const hit = this.hitTest(sx, sy);
    if (hit) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) app.toggleLayerSelected(hit.id);
      else app.selectLayers([hit.id]);
      if (hit.locked) return;
      const chosen = app.selectedLayer();
      this.startMoveDrag(e, chosen, ctx);
    } else {
      if (!e.shiftKey) app.deselect();
    }
  };
  CV.onPointerMove = function (e) {
    const [sx, sy] = this.eventPos(e);
    this.hover = [sx, sy];
    const d = this.drag;
    if (!d) {
      if (this.pen) { const cp = this.screenToComp(sx, sy); this.pen.cursor = cp; this.draw(); }
      if (this.tool !== 'select') this.draw();
      return;
    }
    if (d.type === 'pan') {
      AE.App.view.panX = d.panX + (e.clientX - d.cx); AE.App.view.panY = d.panY + (e.clientY - d.cy);
      AE.App.requestRender(); return;
    }
    if (d.type === 'shapeDraw' || d.type === 'maskDraw') {
      const cp = this.screenToComp(sx, sy);
      d.preview = { x0: d.start[0], y0: d.start[1], x1: cp[0], y1: cp[1] };
      this.draw(); return;
    }
    if (d.type === 'move' || d.type === 'axis' || d.type === 'rotate' || d.type === 'scale' || d.type === 'anchor' || d.type === 'pin' || d.type === 'motion' || d.type === 'node' || d.type === 'textdrag') {
      this.updateTransformDrag(e, sx, sy);
      return;
    }
  };
  CV.onPointerUp = function (e) {
    const d = this.drag;
    if (!d) return;
    if (d.type === 'shapeDraw') {
      const cp = this.screenToComp(...this.eventPos(e));
      const w = cp[0] - d.start[0], h = cp[1] - d.start[1];
      if (Math.abs(w) > 3 && Math.abs(h) > 3) this.createShape(d.tool, d.start, cp);
      this.drag = null; this.draw(); return;
    }
    if (d.type === 'maskDraw') {
      const cp = this.screenToComp(...this.eventPos(e));
      const w = cp[0] - d.start[0], h = cp[1] - d.start[1];
      if (Math.abs(w) > 3 && Math.abs(h) > 3) this.createMask(d.start, cp);
      this.drag = null; this.draw(); return;
    }
    if (d.type === 'pan') { this.drag = null; return; }
    if (d.changed) AE.App.endEdit(true); else AE.App.cancelEdit();
    this.drag = null;
    AE.App.refreshSelectionUI();
    AE.App.requestRender();
  };
  CV.onDoubleClick = function (e) {
    const app = AE.App, comp = app.comp; if (!comp) return;
    if (e.target.closest('.vp-toolbar')) return;
    if (this.pen) { this.finishPen(); return; }
    const [sx, sy] = this.eventPos(e);
    const hit = this.hitTest(sx, sy);
    if (hit && hit.type === 'precomp') { app.enterPrecomp(hit); return; }
    if (hit && hit.type === 'text') {
      app.selectLayers([hit.id]);
      if (AE.Props) AE.Props.render();
      return;
    }
    if (!hit) { this.setTool('select'); app.deselect(); }
  };
  CV.onContextMenu = function (e) {
    const app = AE.App;
    const [sx, sy] = this.eventPos(e);
    const hit = this.hitTest(sx, sy);
    if (hit) app.selectLayers([hit.id]);
    app.showMenu(e.clientX, e.clientY, [
      { label: '新建形状图层', icon: 'i-shape', action: () => app.addLayer('shape', { shapeType: 'rect' }) },
      { label: '新建文字图层', icon: 'i-text', action: () => app.addLayer('text', { text: '新文字', font: T.CN_FONT, fontSize: 100 }) },
      { label: '新建空对象', icon: 'i-null', action: () => app.addLayer('null') },
      '-',
      { label: '复制图层', disabled: !hit, action: () => app.duplicateSelected() },
      { label: '预合成所选', disabled: !hit, action: () => app.precomposeSelected() },
      { label: '适配视图', icon: 'i-crop', action: () => app.fitView() }
    ]);
  };
  CV.startPan = function (e) {
    const app = AE.App;
    this.drag = { type: 'pan', cx: e.clientX, cy: e.clientY, panX: app.view.panX || 0, panY: app.view.panY || 0 };
    this.stage.style.cursor = 'grabbing';
    const up = () => { this.stage.style.cursor = this.tool === 'hand' ? 'grab' : 'default'; };
  };
  CV.startShapeDraw = function (sx, sy, tool) {
    const cp = this.screenToComp(sx, sy);
    this.drag = { type: 'shapeDraw', tool, start: cp, preview: { x0: cp[0], y0: cp[1], x1: cp[0], y1: cp[1] } };
    this.draw();
  };
  CV.createShape = function (tool, a, b) {
    const app = AE.App, comp = app.comp;
    const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2, w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
    app.edit('绘制' + (tool === 'rect' ? '矩形' : '椭圆'), () => {
      const l = P.createLayer(app.project, comp, 'shape', { name: tool === 'rect' ? '矩形' : '椭圆', shapeType: tool, size: [w, h], position: [x, y, 0] });
      if (tool === 'rect') l.props['shape.fillColor'].value = [.32, .85, .76, 1];
      else l.props['shape.fillColor'].value = [.9, .72, .4, 1];
      comp.layers.push(l);
      app.selection = [l.id];
      app.expandedTimeline = true;
    });
    this.setTool('select');
    app.toast('形状已创建', tool === 'rect' ? '矩形' : '椭圆', 'ok');
  };
  CV.createMask = function (a, b) {
    const app = AE.App, c = app.selectedLayer(); if (!c) { app.toast('请先选择图层', '再绘制蒙版', 'warn'); return; }
    const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2, w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
    const ctx = E.makeCtx(app.project, app.comp, app.time);
    const inv = U.affine.inv(E.worldAffine(app.comp, c, ctx, app.time));
    const la = U.affine.apply(inv, a[0], a[1]), lb = U.affine.apply(inv, b[0], b[1]);
    const lx = (la[0] + lb[0]) / 2, ly = (la[1] + lb[1]) / 2;
    const lw = Math.abs(lb[0] - la[0]), lh = Math.abs(lb[1] - la[1]);
    app.edit('绘制蒙版', () => {
      const m = P.addMask(c, 'rect');
      c.props[`mask.${m.id}.path`].value = G.rect(lw, lh, lx, ly);
      c.props[`mask.${m.id}.feather`].value = 0;
    });
    this.setTool('select');
  };
  CV.startMaskDraw = function (sx, sy) {
    if (!AE.App.selectedLayer()) { AE.App.toast('请先选择图层', '再绘制蒙版', 'warn'); return; }
    const cp = this.screenToComp(sx, sy);
    this.drag = { type: 'maskDraw', start: cp, preview: { x0: cp[0], y0: cp[1], x1: cp[0], y1: cp[1] } };
  };
  CV.textClick = function (sx, sy) {
    const app = AE.App, comp = app.comp;
    const cp = this.screenToComp(sx, sy);
    const text = prompt('输入文字内容', '星核');
    if (text == null) return;
    app.edit('创建文字', () => {
      const l = P.createLayer(app.project, comp, 'text', { name: text.slice(0, 12) || '文字', text: text || '文字', fontSize: 90, font: T.CN_FONT, fillColor: [.94, .95, .9, 1], position: [cp[0], cp[1], 0] });
      comp.layers.push(l); app.selection = [l.id];
    });
    this.setTool('select');
  };
  CV.pinClick = function (sx, sy) {
    const app = AE.App, comp = app.comp;
    const hit = this.hitTest(sx, sy);
    const layer = hit || app.selectedLayer();
    if (!layer) { app.toast('请先选择可变形图层', '', 'warn'); return; }
    const ctx = E.makeCtx(app.project, comp, app.time);
    if (!(layer.type === 'geo' || (layer.type === 'shape' && layer.threeD))) { app.toast('图钉仅用于三维几何', '请选择挤出形状或几何图层', 'warn'); return; }
    const local = this.pickMeshLocal(layer, ctx, sx, sy) || [0, 0, 0];
    app.edit('添加图钉', () => { P.addPin(layer, local, '图钉 ' + (layer.geo.pins.length + 1)); app.selection = [layer.id]; });
    this.setTool('select');
    app.toast('图钉已添加', '拖动图钉可局部变形，其余区域保持刚性', 'ok');
  };
  CV.pickMeshLocal = function (layer, ctx, sx, sy) {
    const app = AE.App, comp = app.comp;
    try {
      const res = B.layerWorldMesh(comp, layer, app.time, ctx, { cache: this._meshCache || (this._meshCache = new Map()) });
      if (!res || !res.objects) return null;
      const cam = this.getCamera();
      const camPos = cam.pos;
      const origin = camPos;
      const compPt = this.screenToComp(sx, sy);
      // approximate ray through camera and comp point at target depth
      const view = E.cameraMatrices(cam, comp);
      const ndcX = (compPt[0] / comp.width) * 2 - 1;
      const ndcY = 1 - (compPt[1] / comp.height) * 2;
      const invVP = M.invert(view.vp);
      const near = M.transformPoint(invVP, [ndcX, ndcY, -1]);
      const far = M.transformPoint(invVP, [ndcX, ndcY, 1]);
      const ray = M.norm(M.sub(far, near));
      let best = null;
      for (const o of res.objects) {
        const mesh = o.mesh, pos = mesh.pos, idx = mesh.idx;
        for (let i = 0; i < idx.length; i += 3) {
          const a = [pos[idx[i] * 3], pos[idx[i] * 3 + 1], pos[idx[i] * 3 + 2]];
          const b = [pos[idx[i + 1] * 3], pos[idx[i + 1] * 3 + 1], pos[idx[i + 1] * 3 + 2]];
          const c = [pos[idx[i + 2] * 3], pos[idx[i + 2] * 3 + 1], pos[idx[i + 2] * 3 + 2]];
          const hit = rayTri(origin, ray, a, b, c);
          if (hit && (!best || hit.t < best.t)) best = { t: hit.t, p: M.add(origin, M.mul(ray, hit.t)) };
        }
      }
      if (best) {
        const inv = M.invert(E.worldMatrix(comp, layer, ctx, app.time));
        return M.transformPoint(inv, best.p);
      }
    } catch (e) { }
    return null;
  };
  function rayTri(o, d, a, b, c) {
    const e1 = M.sub(b, a), e2 = M.sub(c, a), p = M.cross(d, e2), det = M.dot(e1, p);
    if (Math.abs(det) < 1e-8) return null;
    const inv = 1 / det, t = M.sub(o, a), u = M.dot(t, p) * inv;
    if (u < 0 || u > 1) return null;
    const q = M.cross(t, e1), v = M.dot(d, q) * inv;
    if (v < 0 || u + v > 1) return null;
    const tt = M.dot(e2, q) * inv;
    return tt > 0 ? { t: tt } : null;
  }
  CV.hitPathNode = function (layer, ctx, sx, sy) {
    const app = AE.App;
    try {
      const res = E.evalContents(layer, ctx, app.time);
      const aff = E.worldAffine(app.comp, layer, ctx, app.time);
      for (const it of res.items) {
        if (it.item.type !== 'path') continue;
        for (let ci = 0; ci < it.shape.contours.length; ci++) {
          const c = it.shape.contours[ci];
          for (let i = 0; i < c.verts.length; i++) {
            const v = c.verts[i]; const p = U.affine.apply(aff, v.p[0], v.p[1]); const s = this.compToScreen(p[0], p[1]);
            if (Math.hypot(s[0] - sx, s[1] - sy) < 9) return { item: it.item, contourIndex: ci, vertIndex: i, shape: it.shape, itemObj: it };
          }
        }
      }
    } catch (e) { }
    return null;
  };
  CV.startMoveDrag = function (e, layer, ctx) {
    if (!layer || layer.locked) return;
    const app = AE.App;
    const cr = this.compRect();
    const pos = E.vec(E.propValue(layer, 'transform.position', ctx, app.time), 3).map(E.num);
    this.drag = {
      type: 'move', layer, startX: e.clientX, startY: e.clientY, pos0: pos, changed: false,
      is3D: this.layerIs3D(layer, ctx, app.time), ctx
    };
  };
  CV.startAxisDrag = function (e, layer, axis, ctx) {
    this.drag = { type: 'axis', layer, axis, startX: e.clientX, startY: e.clientY, pos0: E.vec(E.propValue(layer, 'transform.position', ctx, AE.App.time), 3).map(E.num), changed: false };
  };
  CV.startAnchorDrag = function (e, layer, ctx) {
    this.drag = { type: 'anchor', layer, startX: e.clientX, startY: e.clientY, anchor0: E.vec(E.propValue(layer, 'transform.anchor', ctx, AE.App.time), 3).map(E.num), pos0: E.vec(E.propValue(layer, 'transform.position', ctx, AE.App.time), 3).map(E.num), changed: false };
  };
  CV.startRotateDrag = function (e, layer, ctx) {
    const app = AE.App, comp = app.comp;
    const an = this.anchorScreen(layer, ctx);
    this.drag = { type: 'rotate', layer, startX: e.clientX, startY: e.clientY, center: an, rot0: E.vec(E.propValue(layer, 'transform.rotation', ctx, app.time), 3)[2] || 0, changed: false };
  };
  CV.startScaleDrag = function (e, layer, corner, ctx) {
    this.drag = { type: 'scale', layer, startX: e.clientX, startY: e.clientY, corner, scale0: E.vec(E.propValue(layer, 'transform.scale', ctx, AE.App.time), 3).slice(), changed: false };
  };
  CV.startPinDrag = function (e, layer, pin, ctx) {
    this.drag = { type: 'pin', layer, pin, startX: e.clientX, startY: e.clientY, off0: E.vec(E.propValue(layer, `pin.${pin.id}.offset`, ctx, AE.App.time) || [0, 0, 0], 3).map(E.num), changed: false };
  };
  CV.startMotionPathDrag = function (e, layer, key, ctx) {
    this.drag = { type: 'motion', layer, key, startX: e.clientX, startY: e.clientY, v0: key.v.slice(), changed: false };
  };
  CV.startPathNodeDrag = function (e, layer, node, ctx) {
    this.drag = { type: 'node', layer, node, startX: e.clientX, startY: e.clientY, changed: false };
  };
  CV.updateTransformDrag = function (e, sx, sy) {
    const d = this.drag, app = AE.App, comp = app.comp;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    const cr = this.compRect();
    const cp = this.screenToComp(sx, sy);
    if (!d.changed && Math.hypot(dx, dy) < 2) return;
    if (!d.changed) { d.changed = true; app.beginEdit(d.type === 'pin' ? '移动图钉' : d.type === 'axis' ? '轴向移动' : d.type === 'anchor' ? '移动锚点' : d.type === 'rotate' ? '旋转图层' : d.type === 'scale' ? '缩放图层' : d.type === 'motion' ? '移动运动路径' : d.type === 'node' ? '编辑路径节点' : '移动图层'); }
    const ctx = E.makeCtx(app.project, comp, app.time);
    const layer = d.layer;
    if (d.type === 'move') {
      const dCompX = dx / cr.w * comp.width, dCompY = dy / cr.h * comp.height;
      const parent = layer.parent ? comp.layers.find(l => l.id === layer.parent) : null;
      let local = [dCompX, dCompY, 0];
      if (d.is3D) {
        // screen plane at anchor depth
        const cam = this.getCamera(); const view = E.cameraMatrices(cam, comp).view;
        const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
        const anchor = E.vec(E.propValue(layer, 'transform.anchor', ctx, app.time), 3).map(E.num);
        const wm = E.worldMatrix(comp, layer, ctx, app.time);
        const wp = M.transformPoint(wm, anchor);
        const dist = Math.max(1, M.dist(cam.pos, wp));
        const worldPerPx = 2 * Math.tan(U.rad(cam.fov) / 2) * dist / cr.h;
        local = [ (right[0] * dCompX + up[0] * dCompY) * worldPerPx, (right[1] * dCompX + up[1] * dCompY) * worldPerPx, (right[2] * dCompX + up[2] * dCompY) * worldPerPx ];
      }
      if (parent) {
        const pm = layer.threeD ? E.worldMatrix(comp, parent, ctx, app.time) : null;
        if (pm) local = M.transformDir(M.invertRotScale(pm), local);
        else {
          const pa = E.worldAffine(comp, parent, ctx, app.time);
          const inv = U.affine.inv(pa);
          local = [inv[0] * local[0] + inv[2] * local[1], inv[1] * local[0] + inv[3] * local[1], local[2]];
        }
      }
      const pos0 = E.vec(E.propValue(layer, 'transform.position', ctx, app.time), 3).map(E.num);
      const base = d.pos0;
      app.writeValue(layer, 'transform.position', [base[0] + local[0], base[1] + local[1], base[2] + (local[2] || 0)]);
    } else if (d.type === 'axis') {
      const a = d.axis;
      const dxAxis = dx, dyAxis = dy;
      const axisDirX = a.x - a.sx, axisDirY = a.y - a.sy;
      const len2 = axisDirX * axisDirX + axisDirY * axisDirY || 1;
      const amount = (dxAxis * axisDirX + dyAxis * axisDirY) / len2;
      const parent = layer.parent ? comp.layers.find(l => l.id === layer.parent) : null;
      let localDelta = M.mul(a.worldAxis, amount * 260);
      if (parent) {
        const pm = E.worldMatrix(comp, parent, ctx, app.time);
        localDelta = M.transformDir(M.invertRotScale(pm), localDelta);
      }
      const base = d.pos0;
      const np = [base[0] + localDelta[0], base[1] + localDelta[1], base[2] + localDelta[2]];
      app.writeValue(layer, 'transform.position', np);
    } else if (d.type === 'anchor') {
      const parent = layer.parent ? comp.layers.find(l => l.id === layer.parent) : null;
      // anchor delta in local geometry coords
      let da = [dx / cr.w * comp.width, dy / cr.h * comp.height, 0];
      if (parent) { const paf = E.worldAffine(comp, parent, ctx, app.time); const inv = U.affine.inv(paf); da = [inv[0] * da[0] + inv[2] * da[1], inv[1] * da[0] + inv[3] * da[1], 0]; }
      const baseAnchor = d.anchor0, basePos = d.pos0;
      const rot = E.vec(E.propValue(layer, 'transform.rotation', ctx, app.time), 3).map(E.num);
      const scl = E.vec(E.propValue(layer, 'transform.scale', ctx, app.time), 3).map(v => E.num(v) / 100);
      const off = M.transformDir(M.fromTRS([0, 0, 0], rot, [scl[0] * 100, scl[1] * 100, scl[2] * 100]), da);
      app.writeValue(layer, 'transform.anchor', [baseAnchor[0] + da[0], baseAnchor[1] + da[1], baseAnchor[2] + da[2]]);
      app.writeValue(layer, 'transform.position', [basePos[0] + off[0], basePos[1] + off[1], basePos[2] + off[2]]);
    } else if (d.type === 'rotate') {
      const ang0 = Math.atan2(d.startY - d.center.y, d.startX - d.center.x);
      const ang1 = Math.atan2(sy - d.center.y, sx - d.center.x);
      const deg = U.deg(ang1 - ang0);
      const rot = E.vec(E.propValue(layer, 'transform.rotation', ctx, app.time), 3).map(E.num);
      app.writeValue(layer, 'transform.rotation', [rot[0], rot[1], (d.rot0 + deg)]);
    } else if (d.type === 'scale') {
      const an = this.anchorScreen(layer, ctx); if (!an) return;
      const r0 = Math.hypot(d.startX - an.x, d.startY - an.y) || 1;
      const r1 = Math.hypot(sx - an.x, sy - an.y);
      const f = U.clamp(r1 / r0, .05, 8);
      const base = d.scale0;
      app.writeValue(layer, 'transform.scale', [base[0] * f, base[1] * f, base[2]]);
    } else if (d.type === 'pin') {
      const cam = this.getCamera(); const view = E.cameraMatrices(cam, comp).view;
      const right = [view[0], view[4], view[8]], up = [view[1], view[5], view[9]];
      const dCompX = dx / cr.w * comp.width, dCompY = dy / cr.h * comp.height;
      const anchor = E.vec(E.propValue(layer, 'transform.position', ctx, app.time), 3).map(E.num);
      const dist = Math.max(1, M.dist(cam.pos, anchor));
      const wpp = 2 * Math.tan(U.rad(cam.fov) / 2) * dist / cr.h;
      const wd = [ (right[0] * dCompX + up[0] * dCompY) * wpp, (right[1] * dCompX + up[1] * dCompY) * wpp, (right[2] * dCompX + up[2] * dCompY) * wpp ];
      const local = M.transformDir(M.invertRotScale(E.worldMatrix(comp, layer, ctx, app.time)), wd);
      app.writeValue(layer, `pin.${d.pin.id}.offset`, [d.off0[0] + local[0], d.off0[1] + local[1], d.off0[2] + local[2]]);
    } else if (d.type === 'motion') {
      const parent = layer.parent ? comp.layers.find(l => l.id === layer.parent) : null;
      let delta = [dx / cr.w * comp.width, dy / cr.h * comp.height, 0];
      if (parent) {
        const is3 = layer.threeD;
        if (is3) { const pm = E.worldMatrix(comp, parent, ctx, app.time); delta = M.transformDir(M.invertRotScale(pm), delta); }
        else { const inv = U.affine.inv(E.worldAffine(comp, parent, ctx, app.time)); delta = [inv[0] * delta[0] + inv[2] * delta[1], inv[1] * delta[0] + inv[3] * delta[1], 0]; }
      }
      d.key.v = [d.v0[0] + delta[0], d.v0[1] + delta[1], (d.v0[2] || 0) + delta[2]];
      d.key.spatialIn = null; d.key.spatialOut = null;
      AE.App.markDirty();
    } else if (d.type === 'node') {
      // move the path vertex of the evaluated item; write into the path property (or animated key)
      const it = d.node.itemObj;
      const layerAff = E.worldAffine(comp, layer, ctx, app.time);
      const inv = U.affine.inv(layerAff);
      const old = d.node.item.type === 'path' ? E.propValue(layer, `content.${d.node.item.id}.path`, ctx, app.time) : null;
      if (!old) return;
      const local = U.affine.apply(inv, sx, sy);
      const shape = U.deepClone(old);
      const vert = shape.contours[d.node.contourIndex]?.verts[d.node.vertIndex];
      if (!vert) return;
      const prev = vert.p.slice();
      const dxL = local[0] - prev[0], dyL = local[1] - prev[1];
      vert.p = local; vert.in = [vert.in[0] + dxL, vert.in[1] + dyL]; vert.out = [vert.out[0] + dxL, vert.out[1] + dyL];
      app.writeValue(layer, `content.${d.node.item.id}.path`, shape);
    }
    app.requestRender();
    this.draw();
  };
  CV.finishPen = function () {
    if (!this.pen || this.pen.points.length < 2) { this.pen = null; this.draw(); return; }
    const app = AE.App, comp = app.comp;
    const pts = this.pen.points;
    app.edit('绘制路径', () => {
      const l = P.createLayer(app.project, comp, 'shape', { name: '自由路径', shapeType: 'path', path: G.pathFromPoints(pts, true) });
      l.props['shape.fillColor'].value = [.4, .9, .82, .8];
      comp.layers.push(l); app.selection = [l.id];
    });
    this.pen = null; this.setTool('select');
    app.toast('路径已创建', pts.length + ' 个节点', 'ok');
  };
  CV.penClick = function (sx, sy) {
    const cp = this.screenToComp(sx, sy);
    if (!this.pen) this.pen = { points: [cp], cursor: cp };
    else {
      const last = this.pen.points[this.pen.points.length - 1];
      if (Math.hypot(cp[0] - last[0], cp[1] - last[1]) < 3) return;
      this.pen.points.push(cp);
    }
    this.draw();
  };
  // wheel zoom already bound
  CV.jumpNode = function () { };

  AE.CanvasView = CV;
})();
