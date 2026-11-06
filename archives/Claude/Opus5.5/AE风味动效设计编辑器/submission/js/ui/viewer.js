// 合成查看器：WebGL 渲染、纸板区、视图（活动摄像机/正交/自定义/四视图）、拾取、变换手柄、运动路径、蒙版/路径/图钉编辑
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, M4 = U.M4, P = AE.Path, E = AE.Eval, A = AE.Anim, Mdl = AE.Model, W = AE.W, GL = AE.GL, R = AE.R, App = AE.App, C = AE.Content;
  const V = AE.Viewer = { zoom: 0.5, pan: [0, 0], mode: 'camera', aux: { yaw: -35, pitch: 22, dist: 2600, target: null }, show: { grid: false, paths: true, fields: false, mesh: true, guides: true }, res: 'auto', lastTex: null };
  let gl, glc, ovc, ox, viewerEl, lastRender = null;

  V.init = () => {
    glc = document.getElementById('glc'); ovc = document.getElementById('ovc'); viewerEl = document.getElementById('viewer');
    gl = GL.init(glc); ox = ovc.getContext('2d');
    viewerEl.addEventListener('mousedown', onDown);
    viewerEl.addEventListener('mousemove', onHover);
    viewerEl.addEventListener('wheel', onWheel, { passive: false });
    viewerEl.addEventListener('dblclick', onDbl);
    viewerEl.addEventListener('contextmenu', (e) => { e.preventDefault(); ctxMenu(e); });
    App.panels.viewer = V;
  };
  V.size = () => { const r = viewerEl.getBoundingClientRect(); return { w: r.width, h: r.height }; };
  V.fit = () => {
    const comp = App.comp(); if (!comp) return;
    const s = V.size(), m = 40;
    V.zoom = Math.min((s.w - m * 2) / comp.width, (s.h - m * 2) / comp.height);
    V.pan = [(s.w - comp.width * V.zoom) / 2, (s.h - comp.height * V.zoom) / 2];
    App.mark('viewer');
  };
  V.setMode = (m) => { V.mode = m; App.mark('viewer'); App.panels.head && App.panels.head(true); };
  // 屏幕 ↔ 合成像素
  const c2s = (p) => [p[0] * V.zoom + V.pan[0], p[1] * V.zoom + V.pan[1]];
  const s2c = (p) => [(p[0] - V.pan[0]) / V.zoom, (p[1] - V.pan[1]) / V.zoom];
  V.c2s = c2s; V.s2c = s2c;

  // ---------- 相机 ----------
  V.auxCam = (comp, mode) => {
    const tgt = V.aux.target || [comp.width / 2, comp.height / 2, 0];
    let eye, ortho = 0;
    if (mode === 'front') { eye = [tgt[0], tgt[1], tgt[2] - 5000]; ortho = comp.height * 0.75; }
    else if (mode === 'top') { eye = [tgt[0], tgt[1] - 5000, tgt[2] + 0.01]; ortho = comp.height * 0.75; }
    else if (mode === 'side') { eye = [tgt[0] - 5000, tgt[1], tgt[2]]; ortho = comp.height * 0.75; }
    else { const y = V.aux.yaw * U.deg, p = V.aux.pitch * U.deg, d = V.aux.dist; eye = [tgt[0] + Math.sin(y) * Math.cos(p) * d, tgt[1] - Math.sin(p) * d, tgt[2] - Math.cos(y) * Math.cos(p) * d]; }
    const zoom = comp.width / 2 / Math.tan(39.6 * U.deg / 2);
    return { layer: null, view: M4.lookAt(eye, tgt), eye, zoom, fov: 2 * Math.atan(comp.height / 2 / zoom), focus: zoom, aperture: 0, dof: false, blur: 1, ortho: ortho ? ortho * (V.aux.orthoScale || 1) : 0, aux: true };
  };
  V.camFor = (mode) => { const ch = App.chain(); return mode === 'camera' ? E.cameraAt(ch.comp, ch.t, ch.ctx) : V.auxCam(ch.comp, mode); };
  // 世界 → 合成像素（经当前视图相机）
  V.projector = (comp, cam) => {
    const aspect = comp.width / comp.height;
    const proj = cam.ortho ? M4.orthoCam(cam.ortho * aspect, cam.ortho, 1, 20000) : M4.persp(cam.fov, aspect, 10, 40000);
    const VP = M4.mul(proj, cam.view);
    return (p) => { const c = M4.apply4(VP, [p[0], p[1], p[2] || 0, 1]); if (c[3] <= 1e-3) return null; return [(c[0] / c[3] + 1) / 2 * comp.width, (1 - c[1] / c[3]) / 2 * comp.height, c[3]]; };
  };
  // 屏幕点 → 世界射线
  V.ray = (comp, cam, cp) => {
    const aspect = comp.width / comp.height;
    const proj = cam.ortho ? M4.orthoCam(cam.ortho * aspect, cam.ortho, 1, 20000) : M4.persp(cam.fov, aspect, 10, 40000);
    const inv = M4.inv(M4.mul(proj, cam.view));
    const nx = cp[0] / comp.width * 2 - 1, ny = 1 - cp[1] / comp.height * 2;
    const a = M4.apply4(inv, [nx, ny, -1, 1]), b = M4.apply4(inv, [nx, ny, 1, 1]);
    const o = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], f = [b[0] / b[3], b[1] / b[3], b[2] / b[3]];
    return { o, d: U.norm(U.sub(f, o)) };
  };

  // ---------- 渲染 ----------
  V.renderScale = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    let q = V.res === 'full' ? 1 : V.res === 'half' ? 0.5 : V.res === 'third' ? 0.34 : (App.playing || App.interact ? 0.5 : 1);
    if (App.exporting) q = 1;
    return d * q;
  };
  V.draw = () => {
    const ch = App.chain(), comp = ch.comp; if (!comp) return;
    const fit = W.fitCanvas(glc); W.fitCanvas(ovc);
    const d = fit.d;
    const t0 = performance.now();
    E.index(App.proj);
    // 背景
    GL.bind(null); gl.clearColor(0.043, 0.051, 0.063, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const modes = V.mode === 'quad' ? ['custom', 'top', 'front', 'camera'] : [V.mode];
    const vw = fit.w, vh = fit.h;
    if (V.mode === 'quad') {
      const hw = vw / 2, hh = vh / 2;
      modes.forEach((m, i) => drawView(ch, m, { x: (i % 2) * hw, y: Math.floor(i / 2) * hh, w: hw, h: hh }, d, true));
    } else drawView(ch, V.mode, { x: 0, y: 0, w: vw, h: vh }, d, false);
    V.stats = performance.now() - t0;
    drawOverlay(ch);
    const info = document.getElementById('viewerInfo');
    const cam = E.activeCamera(comp, ch.t);
    const L = App.layer();
    info.textContent = `${comp.name}  ${comp.width}×${comp.height}  ${comp.fps}fps   ${U.timecode(ch.t, comp.fps)}  (${ch.t.toFixed(3)}s)` +
      `\n视图：${({ camera: '活动摄像机', front: '前视图', top: '顶视图', side: '侧视图', custom: '自定义透视', quad: '四视图' })[V.mode]}  ·  相机：${cam ? cam.name + '（' + (cam.camera.dof ? '景深开' : '景深关') + '）' : '默认相机'}` +
      (L ? `\n选中：${L.name}  [${Mdl.TYPE_NAMES[L.type]}${L.threeD ? '·三维' : ''}]` + (App.layers().length > 1 ? `  等 ${App.layers().length} 个图层` : '') : '\n未选择图层');
    document.getElementById('stats').textContent = `渲染 ${V.stats.toFixed(0)}ms · 层 ${R.stats.layers} · 粒子步 ${AE.Particles.stats.steps}`;
    R.stats.layers = 0;
  };
  function drawView(ch, mode, rect, d, small) {
    const comp = ch.comp;
    const isMain = !small || mode === 'camera';
    // 视图矩形内的合成区域
    let zoom = V.zoom, pan = V.pan;
    if (small) { const s = Math.min((rect.w - 20) / comp.width, (rect.h - 20) / comp.height); zoom = s; pan = [rect.x + (rect.w - comp.width * s) / 2, rect.y + (rect.h - comp.height * s) / 2]; }
    const margin = small ? 0 : 0.35;
    const vis = [Math.max(-comp.width * margin, (rect.x - pan[0]) / zoom), Math.max(-comp.height * margin, (rect.y - pan[1]) / zoom), Math.min(comp.width * (1 + margin), (rect.x + rect.w - pan[0]) / zoom), Math.min(comp.height * (1 + margin), (rect.y + rect.h - pan[1]) / zoom)];
    if (vis[2] - vis[0] < 1 || vis[3] - vis[1] < 1) return;
    const sc = Math.min(zoom * d * V.renderScale() / d * d, 4) * (1);
    let rs = zoom * V.renderScale();
    if (App.exporting) rs = Math.min(rs, 1.0); // 逐帧导出：不超过合成原始分辨率
    let pw = (vis[2] - vis[0]) * rs, ph = (vis[3] - vis[1]) * rs;
    const cap = Math.min(1, 4096 / Math.max(pw, ph)); pw *= cap; ph *= cap;
    const space = R.space(vis, pw, ph);
    let tex;
    if (mode === 'camera') tex = R.renderFrame(comp, ch.t, space, { ctx: ch.ctx, mbSamples: App.exporting ? comp.motionBlur.samples : App.playing ? 1 : App.interact ? Math.min(2, comp.motionBlur.samples) : comp.motionBlur.samples });
    else {
      const cam = V.auxCam(comp, mode);
      const layers3 = comp.layers.filter(l => l.threeD && l.visible && E.activeAt(l, ch.t));
      tex = GL.target(space.w, space.h, 'c'); GL.bind(tex); GL.clear(0.07, 0.08, 0.1, 1);
      const g = AE.R3.renderGroup(comp, layers3, ch.t, ch.ctx, space, { camOverride: cam });
      if (g) { const o = R.composite(tex, g, 'normal', 1); GL.release(g); tex = o; }
    }
    // 绘制到屏幕
    GL.bind(null);
    const H = glc.height;
    const sx = (vis[0] * zoom + pan[0]) * d, sy = (vis[1] * zoom + pan[1]) * d, sw = (vis[2] - vis[0]) * zoom * d, sh = (vis[3] - vis[1]) * zoom * d;
    gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.round(rect.x * d), Math.round(H - (rect.y + rect.h) * d), Math.round(rect.w * d), Math.round(rect.h * d));
    gl.viewport(Math.round(sx), Math.round(H - sy - sh), Math.round(sw), Math.round(sh));
    GL.use(dispProg(), { uTex: tex, uComp: [(0 - vis[0]) / (vis[2] - vis[0]), (0 - vis[1]) / (vis[3] - vis[1]), (comp.width - vis[0]) / (vis[2] - vis[0]), (comp.height - vis[1]) / (vis[3] - vis[1])], uCheck: GL.int(comp.bg[3] < 1 ? 1 : 0), uPx: [sw, sh] });
    GL.drawQuad();
    gl.disable(gl.SCISSOR_TEST);
    GL.release(tex);
    GL.trimPool();
  }
  let dp = null;
  function dispProg() {
    if (dp) return dp;
    dp = GL.prog('display', `layout(location=0) in vec2 aPos; out vec2 vUV; void main(){ vUV=aPos; gl_Position=vec4(aPos*2.0-1.0,0.0,1.0); }`,
      `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec4 uComp; uniform int uCheck; uniform vec2 uPx;
       void main(){ vec4 c = texture(uTex, vUV); vec2 q = vec2(vUV.x, 1.0-vUV.y);
         bool inside = q.x>=uComp.x && q.x<=uComp.z && q.y>=uComp.y && q.y<=uComp.w;
         vec3 bg = vec3(0.043,0.051,0.063);
         if(inside && uCheck==1){ vec2 g = floor(vUV*uPx/10.0); bg = mod(g.x+g.y,2.0)<1.0? vec3(0.16):vec3(0.22); }
         vec3 col = c.rgb + bg*(1.0-c.a);
         if(!inside) col = mix(bg, col, 0.32);
         o = vec4(col,1.0); }`);
    return dp;
  }

  // ---------- 叠加层（手柄等） ----------
  V.toScreen = null;
  function layerProjector(ch, cam) {
    const proj = V.projector(ch.comp, cam);
    return (layer, p, t) => {
      const Wm = E.world(layer, t === undefined ? ch.t : t, ch.ctx);
      const w = M4.apply(Wm, p);
      if (layer.threeD && !(layer.type === 'camera')) { const c = proj(w); return c ? c2s(c) : null; }
      if (layer.type === 'camera' || layer.type === 'light') { const c = proj(w); return c ? c2s(c) : null; }
      return c2s(w);
    };
  }
  V.handles = [];
  function drawOverlay(ch) {
    const fit = W.fitCanvas(ovc), d = fit.d, comp = ch.comp;
    ox.setTransform(d, 0, 0, d, 0, 0); ox.clearRect(0, 0, fit.w, fit.h);
    V.handles = [];
    if (V.mode === 'quad') {
      ox.strokeStyle = '#2a2f3a'; ox.lineWidth = 1; ox.beginPath(); ox.moveTo(fit.w / 2, 0); ox.lineTo(fit.w / 2, fit.h); ox.moveTo(0, fit.h / 2); ox.lineTo(fit.w, fit.h / 2); ox.stroke();
      ox.fillStyle = '#7c8494'; ox.font = '11px sans-serif'; ['自定义透视', '顶视图', '前视图', '活动摄像机'].forEach((s, i) => ox.fillText(s, (i % 2) * fit.w / 2 + 8, Math.floor(i / 2) * fit.h / 2 + 16));
      return;
    }
    // 合成边框
    const a = c2s([0, 0]), b = c2s([comp.width, comp.height]);
    ox.strokeStyle = 'rgba(255,255,255,.18)'; ox.lineWidth = 1; ox.strokeRect(a[0] - 0.5, a[1] - 0.5, b[0] - a[0] + 1, b[1] - a[1] + 1);
    if (V.show.grid) { ox.strokeStyle = 'rgba(255,255,255,.06)'; ox.beginPath(); for (let x = 0; x <= comp.width; x += 100) { const p = c2s([x, 0]); ox.moveTo(p[0], a[1]); ox.lineTo(p[0], b[1]); } for (let y = 0; y <= comp.height; y += 100) { const p = c2s([0, y]); ox.moveTo(a[0], p[1]); ox.lineTo(b[0], p[1]); } ox.stroke(); }
    if (V.show.guides) { ox.strokeStyle = 'rgba(76,201,240,.18)'; ox.setLineDash([4, 4]); const m = c2s([comp.width * 0.05, comp.height * 0.05]), n = c2s([comp.width * 0.95, comp.height * 0.95]); ox.strokeRect(m[0], m[1], n[0] - m[0], n[1] - m[1]); ox.setLineDash([]); }
    const cam = V.camFor(V.mode);
    const LP = layerProjector(ch, cam);
    V.toScreen = LP;
    const proj = V.projector(comp, cam);
    const wp = (p) => { const c = proj(p); return c ? c2s(c) : null; };
    // 场范围
    if ((V.show.fields || App.bottomTab === 'nodes' || App.sel.nodes.size) && AE.Nodes) {
      for (const f of AE.Nodes.fieldVis(comp, ch.t, ch.ctx)) {
        if (!App.sel.nodes.has(f.node.id) && App.bottomTab !== 'nodes' && !V.show.fields) continue;
        const c = wp(f.c); if (!c) continue;
        const e = wp([f.c[0] + f.r, f.c[1], f.c[2]]); if (!e) continue;
        const r = Math.hypot(e[0] - c[0], e[1] - c[1]);
        const sel = App.sel.nodes.has(f.node.id);
        ox.strokeStyle = sel ? 'rgba(255,93,143,.9)' : 'rgba(255,93,143,.45)'; ox.lineWidth = sel ? 1.5 : 1; ox.setLineDash(f.kind === 'vortex' ? [6, 4] : []);
        ox.beginPath(); ox.arc(c[0], c[1], r, 0, Math.PI * 2); ox.stroke(); ox.setLineDash([]);
        const g = ox.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); g.addColorStop(0, 'rgba(255,93,143,.16)'); g.addColorStop(1, 'rgba(255,93,143,0)'); ox.fillStyle = g; ox.fill();
        ox.fillStyle = '#ff5d8f'; ox.font = '11px sans-serif'; ox.fillText((f.kind === 'vortex' ? '旋涡场 ' : '衰减场 ') + f.node.name, c[0] + 6, c[1] - 6);
        ox.beginPath(); ox.arc(c[0], c[1], 4, 0, 7); ox.fill();
        V.handles.push({ kind: 'field', node: f.node, x: c[0], y: c[1], r: 7 });
        if (f.kind === 'vortex') { ox.strokeStyle = 'rgba(255,93,143,.6)'; ox.beginPath(); ox.arc(c[0], c[1], r * 0.5, 0.3, 2.4); ox.stroke(); }
      }
    }
    // 摄像机 / 灯光 / 空对象 图标
    for (const l of comp.layers) {
      if (!l.visible) continue;
      const selL = App.sel.layers.includes(l.id);
      if ((l.type === 'camera' && V.mode !== 'camera') || (l.type === 'light' && (V.mode !== 'camera' || selL))) {
        const Wm = E.world(l, ch.t, ch.ctx), p = wp([Wm[12], Wm[13], Wm[14]]); if (!p) continue;
        ox.fillStyle = l.type === 'camera' ? '#4cc9f0' : '#f2c14e'; ox.strokeStyle = ox.fillStyle;
        ox.beginPath(); if (l.type === 'light') { ox.arc(p[0], p[1], selL ? 8 : 6, 0, 7); ox.fill(); for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283; ox.moveTo(p[0] + Math.cos(an) * 10, p[1] + Math.sin(an) * 10); ox.lineTo(p[0] + Math.cos(an) * 14, p[1] + Math.sin(an) * 14); } ox.stroke(); }
        else { ox.fillRect(p[0] - 8, p[1] - 5, 12, 10); ox.beginPath(); ox.moveTo(p[0] + 4, p[1]); ox.lineTo(p[0] + 10, p[1] - 5); ox.lineTo(p[0] + 10, p[1] + 5); ox.fill(); }
        const poi = l.camera ? l.camera.poi : l.light && l.light.kind !== 'point' ? l.light.poi : null;
        if (poi) { const q = wp(E.prop(poi, ch.t, ch.ctx, l)); if (q) { ox.setLineDash([3, 3]); ox.beginPath(); ox.moveTo(p[0], p[1]); ox.lineTo(q[0], q[1]); ox.stroke(); ox.setLineDash([]); ox.strokeRect(q[0] - 3, q[1] - 3, 6, 6); V.handles.push({ kind: 'poi', layer: l, x: q[0], y: q[1], r: 6 }); } }
        ox.font = '11px sans-serif'; ox.fillText(l.name, p[0] + 12, p[1] + 14);
        V.handles.push({ kind: 'icon', layer: l, x: p[0], y: p[1], r: 10 });
      }
      if (l.type === 'null' && E.activeAt(l, ch.t) && (selL || V.mode !== 'camera')) {
        const p = LP(l, [0, 0, 0]); if (!p) continue;
        ox.strokeStyle = selL ? '#ff9f43' : 'rgba(200,205,214,.55)'; ox.lineWidth = 1; ox.strokeRect(p[0] - 9, p[1] - 9, 18, 18);
        V.handles.push({ kind: 'icon', layer: l, x: p[0], y: p[1], r: 11 });
      }
    }
    // 选中图层
    for (const l of App.layers()) if (l.type !== 'audio' && l.type !== 'synth') drawLayerGizmo(l, ch, LP, wp);
    // 正在绘制的钢笔路径
    if (penState && penState.pts.length) {
      ox.strokeStyle = '#ff9f43'; ox.lineWidth = 1.5; ox.beginPath();
      penState.pts.forEach((pt, i) => { const s = c2s(pt.v); if (i === 0) ox.moveTo(s[0], s[1]); else { const pv = penState.pts[i - 1]; const c1 = c2s([pv.v[0] + pv.o[0], pv.v[1] + pv.o[1]]), c2 = c2s([pt.v[0] + pt.i[0], pt.v[1] + pt.i[1]]); ox.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], s[0], s[1]); } });
      ox.stroke();
      penState.pts.forEach(pt => { const s = c2s(pt.v); ox.fillStyle = '#ff9f43'; ox.fillRect(s[0] - 3, s[1] - 3, 6, 6); });
    }
    if (marquee) { ox.strokeStyle = '#ff9f43'; ox.fillStyle = 'rgba(255,159,67,.08)'; ox.fillRect(marquee[0], marquee[1], marquee[2] - marquee[0], marquee[3] - marquee[1]); ox.strokeRect(marquee[0], marquee[1], marquee[2] - marquee[0], marquee[3] - marquee[1]); }
    if (dragInfo) { ox.fillStyle = 'rgba(15,18,23,.9)'; ox.font = '11px Consolas,monospace'; const w = ox.measureText(dragInfo.text).width + 12; ox.fillRect(dragInfo.x + 14, dragInfo.y + 10, w, 20); ox.fillStyle = '#ffb86b'; ox.fillText(dragInfo.text, dragInfo.x + 20, dragInfo.y + 24); }
  }
  let dragInfo = null, marquee = null, penState = null;
  function drawLayerGizmo(l, ch, LP, wp) {
    const t = ch.t;
    const col = '#ff9f43';
    // 内容边界框
    const b = (l.type === 'geo3d') ? meshBounds(l, ch) : R.contentBounds(l, t, ch.ctx);
    if (b && l.type !== 'geo3d') {
      const pts = [[b[0], b[1], 0], [b[2], b[1], 0], [b[2], b[3], 0], [b[0], b[3], 0]].map(p => LP(l, p));
      if (pts.every(Boolean)) {
        ox.strokeStyle = col; ox.lineWidth = 1; ox.beginPath(); pts.forEach((p, i) => i ? ox.lineTo(p[0], p[1]) : ox.moveTo(p[0], p[1])); ox.closePath(); ox.stroke();
        if (!l.threeD) {
          pts.forEach((p, i) => { ox.fillStyle = '#16191f'; ox.fillRect(p[0] - 4, p[1] - 4, 8, 8); ox.strokeRect(p[0] - 4, p[1] - 4, 8, 8); V.handles.push({ kind: 'scale', layer: l, x: p[0], y: p[1], r: 7, corner: i, b }); V.handles.push({ kind: 'rotate', layer: l, x: p[0], y: p[1], r: 20, ring: true }); });
        }
      }
    } else if (b && l.type === 'geo3d') {
      const cs = []; for (let c = 0; c < 8; c++) cs.push(LP(l, [c & 1 ? b[3] : b[0], c & 2 ? b[4] : b[1], c & 4 ? b[5] : b[2]]));
      if (cs.every(Boolean)) { ox.strokeStyle = 'rgba(255,159,67,.55)'; ox.lineWidth = 1; ox.beginPath(); for (const [i, j] of [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) { ox.moveTo(cs[i][0], cs[i][1]); ox.lineTo(cs[j][0], cs[j][1]); } ox.stroke(); }
    }
    // 锚点与轴
    const anc = E.prop(l.transform.anchor, t, ch.ctx, l);
    const ap = LP(l, [anc[0], anc[1], anc[2] || 0]);
    if (ap) {
      ox.strokeStyle = col; ox.lineWidth = 1.2; ox.beginPath(); ox.arc(ap[0], ap[1], 5, 0, 7); ox.moveTo(ap[0] - 9, ap[1]); ox.lineTo(ap[0] + 9, ap[1]); ox.moveTo(ap[0], ap[1] - 9); ox.lineTo(ap[0], ap[1] + 9); ox.stroke();
      V.handles.push({ kind: 'anchor', layer: l, x: ap[0], y: ap[1], r: 7 });
      if (l.threeD || l.type === 'camera' || l.type === 'light') {
        // 父空间轴（拖动只改变位置的对应分量）
        const PW = E.parentWorld(l, t, ch.ctx) || M4.ident();
        const wpos = M4.apply(E.world(l, t, ch.ctx), [anc[0], anc[1], anc[2] || 0]);
        const s0 = wp(wpos);
        if (s0) {
          const len = 90;
          [[1, 0, 0, '#ff5a5f', 'x'], [0, 1, 0, '#3ecf8e', 'y'], [0, 0, 1, '#4cc9f0', 'z']].forEach(([x, y, z, c, ax]) => {
            const dir = U.norm(M4.applyDir(PW, [x, y, z]));
            // 屏幕长度归一
            const probe = wp(U.add(wpos, U.scale(dir, 10))); if (!probe) return;
            const dl = Math.hypot(probe[0] - s0[0], probe[1] - s0[1]); if (dl < 0.01) return;
            const ex = s0[0] + (probe[0] - s0[0]) / dl * len, ey = s0[1] + (probe[1] - s0[1]) / dl * len;
            ox.strokeStyle = c; ox.lineWidth = 2; ox.beginPath(); ox.moveTo(s0[0], s0[1]); ox.lineTo(ex, ey); ox.stroke();
            const an = Math.atan2(ey - s0[1], ex - s0[0]); ox.fillStyle = c; ox.beginPath(); ox.moveTo(ex + Math.cos(an) * 8, ey + Math.sin(an) * 8); ox.lineTo(ex + Math.cos(an + 2.5) * 7, ey + Math.sin(an + 2.5) * 7); ox.lineTo(ex + Math.cos(an - 2.5) * 7, ey + Math.sin(an - 2.5) * 7); ox.fill();
            ox.font = 'bold 10px sans-serif'; ox.fillText(ax.toUpperCase(), ex + Math.cos(an) * 14 - 3, ey + Math.sin(an) * 14 + 3);
            V.handles.push({ kind: 'axis', layer: l, axis: ax, dir, x: ex, y: ey, r: 9, x0: s0[0], y0: s0[1] });
          });
        }
      }
    }
    // 运动路径（实际运动，含父级/表达式），逐帧点
    if (V.show.paths && l.transform.position.anim && l.transform.position.keys.length > 1 || (l.transform.position.exprOn && V.show.paths)) {
      const pos = l.transform.position, comp = ch.comp, fd = 1 / comp.fps;
      const t0 = pos.anim && pos.keys.length ? pos.keys[0].t : Math.max(0, t - 1), t1 = pos.anim && pos.keys.length ? pos.keys[pos.keys.length - 1].t : Math.min(comp.duration, t + 1);
      const sample = (tt) => { const ac = E.prop(l.transform.anchor, tt, ch.ctx, l); return LP(l, [ac[0], ac[1], ac[2] || 0], tt); };
      ox.strokeStyle = 'rgba(255,159,67,.75)'; ox.lineWidth = 1; ox.beginPath(); let first = true;
      const dots = [];
      for (let tt = t0; tt <= t1 + 1e-6; tt += fd) { const s = sample(tt); if (!s) continue; if (first) { ox.moveTo(s[0], s[1]); first = false; } else ox.lineTo(s[0], s[1]); dots.push(s); }
      ox.stroke();
      ox.fillStyle = 'rgba(255,184,107,.9)'; for (const s of dots) ox.fillRect(s[0] - 1, s[1] - 1, 2, 2);
      // 关键帧与空间手柄（父空间 → 屏幕）
      if (pos.anim) {
        const PW = E.parentWorld(l, t, ch.ctx) || M4.ident();
        const toS = (p) => { const w = M4.apply(PW, [p[0], p[1], p[2] || 0]); if (l.threeD) return wp(w); return c2s(w); };
        pos.keys.forEach((k, i) => {
          const s = toS(k.v); if (!s) return;
          const tg = A.spatialTangents(pos.keys, i);
          const selK = App.sel.keys.has(k);
          if (i > 0 && k.sp !== 'linear') { const hi = toS(U.add(k.v, tg.ti)); if (hi) { ox.strokeStyle = 'rgba(155,140,255,.8)'; ox.beginPath(); ox.moveTo(s[0], s[1]); ox.lineTo(hi[0], hi[1]); ox.stroke(); ox.fillStyle = '#9b8cff'; ox.beginPath(); ox.arc(hi[0], hi[1], 3.5, 0, 7); ox.fill(); V.handles.push({ kind: 'tan', layer: l, key: k, idx: i, side: 'in', x: hi[0], y: hi[1], r: 6 }); } }
          if (i < pos.keys.length - 1 && k.sp !== 'linear') { const ho = toS(U.add(k.v, tg.to)); if (ho) { ox.strokeStyle = 'rgba(155,140,255,.8)'; ox.beginPath(); ox.moveTo(s[0], s[1]); ox.lineTo(ho[0], ho[1]); ox.stroke(); ox.fillStyle = '#9b8cff'; ox.beginPath(); ox.arc(ho[0], ho[1], 3.5, 0, 7); ox.fill(); V.handles.push({ kind: 'tan', layer: l, key: k, idx: i, side: 'out', x: ho[0], y: ho[1], r: 6 }); } }
          ox.fillStyle = selK ? '#ff9f43' : '#16191f'; ox.strokeStyle = '#ff9f43'; ox.fillRect(s[0] - 4, s[1] - 4, 8, 8); ox.strokeRect(s[0] - 4, s[1] - 4, 8, 8);
          V.handles.push({ kind: 'pkey', layer: l, key: k, idx: i, x: s[0], y: s[1], r: 7 });
        });
      }
    }
    // 蒙版
    for (const mk of l.masks) {
      const sh = E.prop(mk.path, t, ch.ctx, l) || [];
      const selM = App.sel.item === mk.id;
      drawPathEdit(sh, (p) => LP(l, [p[0], p[1], 0]), selM ? '#ffd166' : 'rgba(255,209,102,.6)', selM, { kind: 'mask', layer: l, mask: mk, prop: mk.path });
    }
    // 形状路径（选中路径项）
    if (l.type === 'shape' && App.sel.item) {
      const found = findShapeItem(l.content, App.sel.item);
      if (found && found.item.type === 'path') {
        const m = found.m(t, ch.ctx, l);
        const sh = E.prop(found.item.path, t, ch.ctx, l) || [];
        drawPathEdit(sh, (p) => { const q = P.aff.pt(m, p[0], p[1]); return LP(l, [q[0], q[1], 0]); }, '#4cc9f0', true, { kind: 'spath', layer: l, item: found.item, prop: found.item.path, m });
      }
    }
    // 图钉网格
    if (AE.Puppet) AE.Puppet.drawGizmo(ox, l, ch, LP, V);
  }
  function meshBounds(l, ch) { try { const m = AE.R3.geoMesh(l, ch.t, ch.ctx); return m && m.bb; } catch (e) { return null; } }
  function drawPathEdit(sh, toS, color, editable, info) {
    for (let ci = 0; ci < sh.length; ci++) {
      const c = sh[ci]; const n = c.v.length; if (!n) continue;
      ox.strokeStyle = color; ox.lineWidth = editable ? 1.5 : 1; ox.beginPath();
      const segs = c.c ? n : n - 1;
      const s0 = toS(c.v[0]); if (!s0) continue; ox.moveTo(s0[0], s0[1]);
      for (let k = 0; k < segs; k++) {
        const a = c.v[k], b = c.v[(k + 1) % n], o = c.o[k], i = c.i[(k + 1) % n];
        const c1 = toS([a[0] + o[0], a[1] + o[1]]), c2 = toS([b[0] + i[0], b[1] + i[1]]), e = toS(b);
        if (c1 && c2 && e) ox.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
      }
      ox.stroke();
      if (!editable) continue;
      for (let k = 0; k < n; k++) {
        const s = toS(c.v[k]); if (!s) continue;
        for (const side of ['i', 'o']) {
          const tg = c[side][k]; if (Math.abs(tg[0]) + Math.abs(tg[1]) < 0.01) continue;
          const h = toS([c.v[k][0] + tg[0], c.v[k][1] + tg[1]]); if (!h) continue;
          ox.strokeStyle = 'rgba(155,140,255,.7)'; ox.lineWidth = 1; ox.beginPath(); ox.moveTo(s[0], s[1]); ox.lineTo(h[0], h[1]); ox.stroke();
          ox.fillStyle = '#9b8cff'; ox.beginPath(); ox.arc(h[0], h[1], 3, 0, 7); ox.fill();
          V.handles.push(Object.assign({ kind: 'ptan', ci, vi: k, side, x: h[0], y: h[1], r: 6 }, info));
        }
        ox.fillStyle = k === 0 ? '#ffffff' : color; ox.fillRect(s[0] - 3.5, s[1] - 3.5, 7, 7);
        V.handles.push(Object.assign({ kind: 'pvert', ci, vi: k, x: s[0], y: s[1], r: 6 }, info));
      }
    }
  }
  function findShapeItem(items, id, chain = []) {
    for (const it of items || []) {
      if (it.id === id) return { item: it, m: (t, ctx, l) => chain.reduce((m, g) => P.aff.mul(m, P.aff.trs(E.prop(g.transform.position, t, ctx, l), E.prop(g.transform.anchor, t, ctx, l), E.prop(g.transform.scale, t, ctx, l), E.prop(g.transform.rotation, t, ctx, l))), P.aff.ident()) };
      if (it.type === 'group') { const r = findShapeItem(it.items, id, chain.concat([it])); if (r) return r; }
    }
    return null;
  }
  V.findShapeItem = findShapeItem;

  // ---------- 拾取 ----------
  V.pick = (sx, sy) => {
    const ch = App.chain(), comp = ch.comp;
    const cp = s2c([sx, sy]);
    if (cp[0] < -comp.width || cp[1] < -comp.height || cp[0] > comp.width * 2 || cp[1] > comp.height * 2) return null;
    // 只渲染鼠标附近的小区域，结果与最终画面一致
    const r = 3 / V.zoom;
    const space = R.space([cp[0] - r, cp[1] - r, cp[0] + r, cp[1] + r], 7, 7);
    const T = GL.target(7, 7, 'pick');
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo); gl.viewport(0, 0, 7, 7); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const ids = [];
    const idOf = (l) => { let i = ids.indexOf(l); if (i < 0) { ids.push(l); i = ids.length - 1; } i++; return [(i & 255) / 255, ((i >> 8) & 255) / 255, 0, 1]; };
    const L = comp.layers; let group = [];
    const camOv = V.mode !== 'camera' && V.mode !== 'quad' ? V.auxCam(comp, V.mode) : null;
    const flush = () => { if (group.length) { AE.R3.pickGroup(comp, group, ch.t, ch.ctx, space, T, idOf, camOv); group = []; } };
    const pp = GL.prog('pick2d', `layout(location=0) in vec2 aPos; out vec2 vUV; void main(){ vUV=aPos; gl_Position=vec4(aPos*2.0-1.0,0.0,1.0); }`, `in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec4 uId; void main(){ if(texture(uTex,vUV).a < 0.08) discard; o=uId; }`);
    for (let i = L.length - 1; i >= 0; i--) {
      const l = L[i];
      if (!l.visible || !E.activeAt(l, ch.t) || l.locked) continue;
      if (!['shape', 'text', 'solid', 'precomp', 'geo3d', 'particles'].includes(l.type)) continue;
      if (l.threeD) { group.push(l); continue; }
      if (camOv) continue; // 辅助视图只显示三维图层
      flush();
      const tex = R.layerTex(l, ch.t, ch.ctx, space, {});
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo); gl.viewport(0, 0, 7, 7); gl.disable(gl.DEPTH_TEST); GL.blend(null);
      GL.use(pp, { uTex: tex, uId: idOf(l) }); GL.drawQuad(); GL.release(tex);
    }
    flush();
    const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo); gl.readPixels(3, 3, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    GL.release(T);
    const id = px[0] + px[1] * 256;
    return id ? ids[id - 1] : null;
  };

  // ---------- 交互 ----------
  function hitHandle(x, y, filter) {
    let best = null, bd = Infinity;
    for (const h of V.handles) {
      if (filter && !filter(h)) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (h.ring) { if (d > 8 && d < h.r && (!best || best.ring)) { if (d < bd || !best) { best = h; bd = d; } } continue; }
      if (d <= h.r && (d < bd || (best && best.ring))) { best = h; bd = d; }
    }
    return best;
  }
  function local(e) { const r = viewerEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function onWheel(e) {
    e.preventDefault();
    const [x, y] = local(e);
    if (V.mode === 'custom' && !e.ctrlKey) { V.aux.dist *= Math.exp(e.deltaY * 0.001); App.mark('viewer'); return; }
    if (['front', 'top', 'side'].includes(V.mode)) { V.aux.orthoScale = (V.aux.orthoScale || 1) * Math.exp(e.deltaY * 0.001); App.mark('viewer'); return; }
    const f = Math.exp(-e.deltaY * 0.0015);
    const nz = U.clamp(V.zoom * f, 0.02, 16);
    V.pan = [x - (x - V.pan[0]) * nz / V.zoom, y - (y - V.pan[1]) * nz / V.zoom];
    V.zoom = nz; App.mark('viewer');
  }
  function onHover(e) {
    if (e.buttons) return;
    const [x, y] = local(e);
    const h = hitHandle(x, y);
    viewerEl.style.cursor = App.tool === 'hand' ? 'grab' : h ? (h.kind === 'rotate' ? 'alias' : h.kind === 'scale' ? 'nwse-resize' : 'pointer') : (App.tool === 'pen' || App.tool === 'rect' || App.tool === 'ellipse' || App.tool === 'pin') ? 'crosshair' : App.tool === 'text' ? 'text' : 'default';
    const hint = document.getElementById('viewerHint');
    hint.textContent = h ? ({ axis: '沿 ' + (h.axis || '').toUpperCase() + ' 轴拖动', anchor: '拖动：移动图层；Alt/锚点工具：移动锚点', scale: '拖动缩放（Shift 等比）', rotate: '拖动旋转', pkey: '拖动位置关键帧；Ctrl 点击切换线性/曲线', tan: '拖动空间手柄；Ctrl 断开联动', pvert: '拖动路径顶点', ptan: '拖动切线；Alt 断开', field: '拖动场中心', poi: '拖动目标点', icon: '选择', pin: '拖动图钉' })[h.kind] || '' : '';
  }
  function onDbl(e) {
    const [x, y] = local(e);
    const l = V.pick(x, y);
    if (l && l.type === 'precomp') { App.openComp(l.precomp.source, l.id); App.status('进入预合成实例：' + l.name + '（播放头对应此实例的内部时间）'); }
    else if (l && l.type === 'text') { App.select(l.id); AE.Props && AE.Props.focusText && AE.Props.focusText(); }
  }
  function ctxMenu(e) {
    const [x, y] = local(e);
    const l = V.pick(x, y);
    if (l) App.select(l.id);
    const items = [
      { head: l ? l.name : '合成' },
      { label: '新建', sub: [['形状', 'shape'], ['文字', 'text'], ['空对象', 'null'], ['纯色', 'solid'], ['调整图层', 'adjust'], ['摄像机', 'camera'], ['灯光', 'light'], ['三维几何', 'geo3d'], ['粒子', 'particles'], ['音色', 'synth']].map(([n, t]) => ({ label: n, fn: () => App.newLayer(t) })) },
      l ? { label: '预合成', key: 'Ctrl+Shift+C', fn: App.precompose } : null,
      l ? { label: '复制图层', key: 'Ctrl+D', fn: App.duplicate } : null,
      l ? { label: l.threeD ? '转为二维图层' : '转为三维图层', fn: () => App.toggle(l, 'threeD') } : null,
      l ? { label: '删除', key: 'Del', fn: App.deleteSelected } : null,
      { sep: true },
      { label: '适配画布', key: 'F', fn: V.fit },
      { label: '视图', sub: [['活动摄像机', 'camera'], ['前视图', 'front'], ['顶视图', 'top'], ['侧视图', 'side'], ['自定义透视', 'custom'], ['四视图', 'quad']].map(([n, m]) => ({ label: n, check: V.mode === m, fn: () => V.setMode(m) })) },
    ];
    W.menu(e.clientX, e.clientY, items);
  }
  // 拖动目标值求解：使最终（含表达式）位置落在目标处
  function solvePos(layer, target, t, ctx) {
    const pos = layer.transform.position;
    const pre0 = A.valueAt(pos, t).slice();
    App.writeProp(pos, target, t);
    if (!pos.exprOn || !pos.expr) return;
    for (let it = 0; it < 3; it++) {
      E.bump();
      const fin = E.prop(pos, t, ctx, layer), pre = A.valueAt(pos, t);
      const err = U.sub(target, fin);
      if (U.len(err) < 0.01) break;
      App.writeProp(pos, U.add(pre, err), t);
    }
  }
  function onDown(e) {
    const [x, y] = local(e);
    const ch = App.chain(), comp = ch.comp, t = App.editTime();
    if (V.mode === 'quad') return;
    viewerEl.focus && viewerEl.focus();
    // 平移
    if (e.button === 1 || App.tool === 'hand' || (e.button === 0 && e.code === 'Space')) { return startPan(e, x, y); }
    if (e.button !== 0) return;
    if (App.tool === 'zoom') { const f = e.altKey ? 0.5 : 2, nz = U.clamp(V.zoom * f, 0.02, 16); V.pan = [x - (x - V.pan[0]) * nz / V.zoom, y - (y - V.pan[1]) * nz / V.zoom]; V.zoom = nz; App.mark('viewer'); return; }
    if (App.tool === 'orbit' || (V.mode === 'custom' && e.altKey)) return startOrbit(e, x, y);
    if (App.tool === 'pen') return penClick(e, x, y);
    if (App.tool === 'rect' || App.tool === 'ellipse') return drawShape(e, x, y);
    if (App.tool === 'text') { const cp = s2c([x, y]); const l = App.newLayer('text', { text: '新文字' }); App.edit('放置文字', () => { l.transform.position.value = [cp[0], cp[1], 0]; }); App.setTool('select'); AE.Props && AE.Props.focusText && setTimeout(AE.Props.focusText, 50); return; }
    if (App.tool === 'pin' && AE.Puppet) { const l = App.layer(); if (l) { AE.Puppet.addPinAt(l, s2c([x, y]), e.altKey, ch); return; } }
    const h = hitHandle(x, y);
    if (h) return dragHandle(e, h, x, y, ch);
    // 拾取
    const l = V.pick(x, y);
    if (l) {
      if (!App.sel.layers.includes(l.id) || e.shiftKey) App.select(l.id, e.shiftKey);
      if (l.locked) return;
      const ls = App.layers().filter(x => !x.locked);
      return dragMove(e, ls, x, y, ch, null);
    }
    if (!e.shiftKey) App.select(null);
    // 框选
    marquee = [x, y, x, y];
    const mm = (ev) => { const p = local(ev); marquee[2] = p[0]; marquee[3] = p[1]; App.mark('viewer'); };
    const mu = () => {
      removeEventListener('mousemove', mm); removeEventListener('mouseup', mu);
      const [a, b, c, d] = marquee; marquee = null;
      if (Math.abs(c - a) > 4 && Math.abs(d - b) > 4) {
        const x0 = Math.min(a, c), x1 = Math.max(a, c), y0 = Math.min(b, d), y1 = Math.max(b, d);
        const ch2 = App.chain();
        for (const L of ch2.comp.layers) {
          if (!L.visible || L.locked || !E.activeAt(L, ch2.t)) continue;
          const anc = E.prop(L.transform.anchor, ch2.t, ch2.ctx, L); const s = V.toScreen(L, [anc[0], anc[1], anc[2] || 0]);
          if (s && s[0] >= x0 && s[0] <= x1 && s[1] >= y0 && s[1] <= y1 && !App.sel.layers.includes(L.id)) App.sel.layers.push(L.id);
        }
      }
      App.mark();
    };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }
  function startPan(e, x, y) {
    const p0 = V.pan.slice(); viewerEl.style.cursor = 'grabbing';
    const mm = (ev) => { const p = local(ev); V.pan = [p0[0] + p[0] - x, p0[1] + p[1] - y]; App.mark('viewer'); };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); viewerEl.style.cursor = ''; };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }
  function startOrbit(e, x, y) {
    if (V.mode !== 'custom') V.setMode('custom');
    const y0 = V.aux.yaw, p0 = V.aux.pitch;
    const mm = (ev) => { const p = local(ev); V.aux.yaw = y0 + (p[0] - x) * 0.4; V.aux.pitch = U.clamp(p0 + (p[1] - y) * 0.3, -89, 89); App.mark('viewer'); };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }
  // 移动图层（二维：父空间；三维：经过锚点、平行画面的平面）
  function dragMove(e, layers, x, y, ch, axis) {
    const comp = ch.comp, t = App.t();
    const cam = V.camFor(V.mode);
    const starts = layers.map(l => {
      const anc = E.prop(l.transform.anchor, t, ch.ctx, l);
      const wpos = M4.apply(E.world(l, t, ch.ctx), [anc[0], anc[1], anc[2] || 0]);
      return { l, wpos, fin: E.prop(l.transform.position, t, ch.ctx, l).slice(), PW: E.parentWorld(l, t, ch.ctx) || M4.ident() };
    });
    const camF = U.norm(U.sub([cam.view[2], cam.view[6], cam.view[10]], [0, 0, 0]));
    let started = false;
    App.interact = true;
    const mm = (ev) => {
      const p = local(ev);
      if (!started && Math.hypot(p[0] - x, p[1] - y) < 3) return;
      if (!started) { started = true; App.beginOp(); }
      const opT = App.editTime();
      for (const s of starts) {
        let target;
        if (s.l.threeD || s.l.type === 'camera' || s.l.type === 'light') {
          const r0 = V.ray(comp, cam, s2c([x, y])), r1 = V.ray(comp, cam, s2c(p));
          let delta;
          if (axis) {
            // 沿轴：轴线与鼠标射线最近点
            const dir = axis.dir;
            const closest = (r) => { const w0 = U.sub(s.wpos, r.o), a = U.dot(dir, dir), b = U.dot(dir, r.d), c = U.dot(r.d, r.d), dd = U.dot(dir, w0), ee = U.dot(r.d, w0); const den = a * c - b * b || 1e-9; return (b * ee - c * dd) / den; };
            delta = U.scale(dir, closest(r1) - closest(r0));
          } else {
            // 平行于画面的平面
            const n = camF;
            const hit = (r) => { const den = U.dot(r.d, n) || 1e-9; const tt = U.dot(U.sub(s.wpos, r.o), n) / den; return U.add(r.o, U.scale(r.d, tt)); };
            delta = U.sub(hit(r1), hit(r0));
          }
          if (ev.shiftKey && !axis) { const ad = delta.map(Math.abs); const m = Math.max(...ad); delta = delta.map(v => Math.abs(v) === m ? v : 0); }
          const PWi = M4.inv(s.PW);
          const dl = M4.applyDir(PWi, delta);
          target = U.add(s.fin, dl);
          if (axis) { const ai = { x: 0, y: 1, z: 2 }[axis.axis]; target = s.fin.map((v, i) => i === ai ? target[i] : v); }
        } else {
          const c0 = s2c([x, y]), c1 = s2c(p);
          let d = [c1[0] - c0[0], c1[1] - c0[1]];
          if (ev.shiftKey) { if (Math.abs(d[0]) > Math.abs(d[1])) d[1] = 0; else d[0] = 0; }
          const PWi = M4.inv(s.PW);
          const dl = M4.applyDir(PWi, [d[0], d[1], 0]);
          target = [s.fin[0] + dl[0], s.fin[1] + dl[1], s.fin[2] || 0];
        }
        // 去掉表达式偏移后写入（使控制点留在光标处）
        solvePos(s.l, target, opT, ch.ctx);
      }
      E.bump();
      const fp = E.prop(starts[0].l.transform.position, opT, ch.ctx, starts[0].l);
      dragInfo = { x: p[0], y: p[1], text: '位置 ' + fp.slice(0, starts[0].l.threeD ? 3 : 2).map(v => U.fmt(v, 1)).join(', ') };
      App.mark('viewer', 'timeline', 'props');
    };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); dragInfo = null; App.interact = false; if (started) App.endOp('移动图层'); App.mark(); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }
  function dragHandle(e, h, x, y, ch) {
    const comp = ch.comp, t = App.t();
    if (h.kind === 'icon') { App.select(h.layer.id, e.shiftKey); if (!h.layer.locked) return dragMove(e, [h.layer], x, y, ch, null); return; }
    if (h.kind === 'axis') return dragMove(e, [h.layer], x, y, ch, h);
    if (h.kind === 'anchor' && !(e.altKey || App.tool === 'anchor')) return dragMove(e, App.layers().filter(l => !l.locked), x, y, ch, null);
    if (h.kind === 'field') {
      App.sel.nodes = new Set([h.node.id]); App.mark('nodes', 'props');
      const prop = h.node.params.center; if (!prop) return;
      const cam = V.camFor(V.mode), c0 = E.prop(prop, t, ch.ctx, null).slice();
      const camF = U.norm([cam.view[2], cam.view[6], cam.view[10]]);
      let st = false;
      const mm = (ev) => { const p = local(ev); if (!st) { st = true; App.beginOp(); } const hit = (r) => { const den = U.dot(r.d, camF) || 1e-9; return U.add(r.o, U.scale(r.d, U.dot(U.sub(c0, r.o), camF) / den)); }; const d = U.sub(hit(V.ray(comp, cam, s2c(p))), hit(V.ray(comp, cam, s2c([x, y])))); App.writeProp(prop, U.add(c0, d)); E.bump(); App.mark('viewer', 'nodes', 'props'); };
      const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (st) App.endOp('移动场中心'); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu); return;
    }
    if (h.kind === 'poi') {
      const l = h.layer, prop = l.camera ? l.camera.poi : l.light.poi;
      const cam = V.camFor(V.mode), c0 = E.prop(prop, t, ch.ctx, l).slice(), camF = U.norm([cam.view[2], cam.view[6], cam.view[10]]);
      let st = false;
      const mm = (ev) => { const p = local(ev); if (!st) { st = true; App.beginOp(); } const hit = (r) => { const den = U.dot(r.d, camF) || 1e-9; return U.add(r.o, U.scale(r.d, U.dot(U.sub(c0, r.o), camF) / den)); }; App.writeProp(prop, U.add(c0, U.sub(hit(V.ray(comp, cam, s2c(p))), hit(V.ray(comp, cam, s2c([x, y])))))); E.bump(); App.mark('viewer', 'props', 'timeline'); };
      const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (st) App.endOp('移动目标点'); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu); return;
    }
    const l = h.layer;
    if (l && l.locked) return;
    let started = false;
    App.interact = true;
    const begin = () => { if (!started) { started = true; App.beginOp(); } };
    const end = (label) => (ev) => { removeEventListener('mousemove', h._mm); removeEventListener('mouseup', h._mu); dragInfo = null; App.interact = false; if (started) App.endOp(label); App.mark(); };
    const PW = l ? (E.parentWorld(l, t, ch.ctx) || M4.ident()) : M4.ident();
    if (h.kind === 'anchor') {
      // 锚点：在图层空间移动，同时补偿位置
      const Wm = E.world(l, t, ch.ctx), Wi = M4.inv(Wm), a0 = E.prop(l.transform.anchor, t, ch.ctx, l).slice();
      h._mm = (ev) => { const p = local(ev); begin(); const c0 = s2c([x, y]), c1 = s2c(p); const d = M4.applyDir(Wi, [c1[0] - c0[0], c1[1] - c0[1], 0]); E.moveAnchor(l, App.editTime(), ch.ctx, [a0[0] + d[0], a0[1] + d[1], a0[2] || 0]); dragInfo = { x: p[0], y: p[1], text: '锚点 ' + U.fmt(a0[0] + d[0], 1) + ', ' + U.fmt(a0[1] + d[1], 1) }; App.mark('viewer', 'props', 'timeline'); };
      h._mu = end('移动锚点');
    } else if (h.kind === 'scale') {
      const anc = E.prop(l.transform.anchor, t, ch.ctx, l), ap = V.toScreen(l, [anc[0], anc[1], 0]);
      const s0 = A.valueAt(l.transform.scale, t).slice();
      const d0 = [x - ap[0], y - ap[1]];
      const rot = E.prop(l.transform.rotation, t, ch.ctx, l) * U.deg;
      const lx = (v) => [v[0] * Math.cos(-rot) - v[1] * Math.sin(-rot), v[0] * Math.sin(-rot) + v[1] * Math.cos(-rot)];
      const q0 = lx(d0);
      h._mm = (ev) => { const p = local(ev); begin(); const q = lx([p[0] - ap[0], p[1] - ap[1]]); let fx = q[0] / (q0[0] || 1e-6), fy = q[1] / (q0[1] || 1e-6); if (ev.shiftKey) { const f = Math.abs(fx) > Math.abs(fy) ? fx : fy; fx = fy = f; } App.writeProp(l.transform.scale, [s0[0] * fx, s0[1] * fy, s0[2] || 100]); E.bump(); dragInfo = { x: p[0], y: p[1], text: '缩放 ' + U.fmt(s0[0] * fx, 1) + '%, ' + U.fmt(s0[1] * fy, 1) + '%' }; App.mark('viewer', 'props', 'timeline'); };
      h._mu = end('缩放图层');
    } else if (h.kind === 'rotate') {
      const anc = E.prop(l.transform.anchor, t, ch.ctx, l), ap = V.toScreen(l, [anc[0], anc[1], 0]);
      const r0 = A.valueAt(l.transform.rotation, t), a0 = Math.atan2(y - ap[1], x - ap[0]);
      let acc = 0, last = a0;
      h._mm = (ev) => { const p = local(ev); begin(); const a = Math.atan2(p[1] - ap[1], p[0] - ap[0]); let da = a - last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; acc += da; last = a; let v = r0 + acc / U.deg; if (ev.shiftKey) v = Math.round(v / 15) * 15; App.writeProp(l.transform.rotation, v); E.bump(); dragInfo = { x: p[0], y: p[1], text: '旋转 ' + U.fmt(v, 1) + '°' }; App.mark('viewer', 'props', 'timeline'); };
      h._mu = end('旋转图层');
    } else if (h.kind === 'pkey' || h.kind === 'tan') {
      const pos = l.transform.position, k = h.key;
      App.registerKey(k, pos);
      if (h.kind === 'pkey' && e.ctrlKey) { App.edit('切换空间插值', () => { k.sp = k.sp === 'linear' ? 'auto' : 'linear'; }); return; }
      if (h.kind === 'pkey' && !e.shiftKey) { App.sel.keys.clear(); } App.sel.keys.add(k);
      const PWi = M4.inv(PW), cam = V.camFor(V.mode);
      const v0 = k.v.slice(), tg = A.spatialTangents(pos.keys, h.idx), ti0 = tg.ti.slice(), to0 = tg.to.slice();
      const wp0 = M4.apply(PW, h.kind === 'pkey' ? v0 : U.add(v0, h.side === 'in' ? ti0 : to0));
      const camF = U.norm([cam.view[2], cam.view[6], cam.view[10]]);
      const toLocalDelta = (p) => {
        if (l.threeD) { const hit = (r) => { const den = U.dot(r.d, camF) || 1e-9; return U.add(r.o, U.scale(r.d, U.dot(U.sub(wp0, r.o), camF) / den)); }; return M4.applyDir(PWi, U.sub(hit(V.ray(comp, cam, s2c(p))), hit(V.ray(comp, cam, s2c([x, y]))))); }
        const c0 = s2c([x, y]), c1 = s2c(p); return M4.applyDir(PWi, [c1[0] - c0[0], c1[1] - c0[1], 0]);
      };
      h._mm = (ev) => {
        const p = local(ev); begin();
        const d = toLocalDelta(p).slice(0, v0.length);
        if (h.kind === 'pkey') { k.v = U.add(v0, d); }
        else {
          if (k.sp === 'auto' || k.sp === 'linear') { k.sp = 'cont'; k.ti = ti0.slice(); k.to = to0.slice(); }
          if (ev.ctrlKey || ev.altKey) k.sp = 'broken';
          if (h.side === 'in') { k.ti = U.add(ti0, d); if (k.sp === 'cont') { const L = U.len(to0); const dir = U.norm(k.ti); k.to = dir.map(x => -x * L); } }
          else { k.to = U.add(to0, d); if (k.sp === 'cont') { const L = U.len(ti0); const dir = U.norm(k.to); k.ti = dir.map(x => -x * L); } }
        }
        E.bump(); App.mark('viewer', 'props', 'timeline', 'graph');
      };
      h._mu = end(h.kind === 'pkey' ? '移动位置关键帧' : '调整空间手柄');
    } else if (h.kind === 'pvert' || h.kind === 'ptan') {
      App.sel.item = h.mask ? h.mask.id : h.item ? h.item.id : App.sel.item;
      const prop = h.prop;
      const sh0 = U.clone(E.prop(prop, t, ch.ctx, l));
      const Wm = E.world(l, t, ch.ctx), Wi = M4.inv(Wm);
      const mInv = h.m ? P.aff.inv(h.m) : null;
      const cam = V.camFor(V.mode);
      const toLocal = (p) => {
        let w;
        if (l.threeD) { const n = U.norm(M4.applyDir(Wm, [0, 0, 1])), o = [Wm[12], Wm[13], Wm[14]]; const r = V.ray(comp, cam, s2c(p)); const den = U.dot(r.d, n) || 1e-9; w = U.add(r.o, U.scale(r.d, U.dot(U.sub(o, r.o), n) / den)); }
        else { const c = s2c(p); w = [c[0], c[1], 0]; }
        const q = M4.apply(Wi, w); return mInv ? P.aff.pt(mInv, q[0], q[1]) : [q[0], q[1]];
      };
      const l0 = toLocal([x, y]);
      h._mm = (ev) => {
        const p = local(ev); begin();
        const lp = toLocal(p), d = [lp[0] - l0[0], lp[1] - l0[1]];
        const sh = U.clone(sh0), c = sh[h.ci];
        if (h.kind === 'pvert') { c.v[h.vi] = [sh0[h.ci].v[h.vi][0] + d[0], sh0[h.ci].v[h.vi][1] + d[1]]; }
        else {
          const o = sh0[h.ci][h.side][h.vi]; c[h.side][h.vi] = [o[0] + d[0], o[1] + d[1]];
          if (!ev.altKey) { const other = h.side === 'i' ? 'o' : 'i'; const L = Math.hypot(...sh0[h.ci][other][h.vi]); const nn = U.norm(c[h.side][h.vi]); c[other][h.vi] = [-nn[0] * L, -nn[1] * L]; }
        }
        App.writeProp(prop, sh); E.bump(); App.mark('viewer', 'props', 'timeline');
      };
      h._mu = end(h.kind === 'pvert' ? '移动路径顶点' : '调整切线');
    } else if (h.kind === 'pin' && AE.Puppet) {
      return AE.Puppet.dragPin(e, h, x, y, ch, V);
    } else return;
    addEventListener('mousemove', h._mm); addEventListener('mouseup', h._mu);
  }
  // 钢笔
  function penClick(e, x, y) {
    const cp = s2c([x, y]);
    if (!penState) penState = { pts: [] };
    const first = penState.pts[0];
    if (first && penState.pts.length > 2 && Math.hypot(...U.sub(c2s(first.v), [x, y])) < 8) { finishPen(true); return; }
    const pt = { v: cp, i: [0, 0], o: [0, 0] };
    penState.pts.push(pt);
    const mm = (ev) => { const p = s2c(local(ev)); const d = [p[0] - cp[0], p[1] - cp[1]]; pt.o = d; pt.i = [-d[0], -d[1]]; App.mark('viewer'); };
    const mu = () => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); App.mark('viewer'); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    App.status('钢笔：继续单击添加顶点；点击起点闭合；Enter 完成开放路径；Esc 取消');
  }
  function finishPen(closed) {
    const st = penState; penState = null;
    if (!st || st.pts.length < 2) { App.mark('viewer'); return; }
    const sel = App.layer();
    App.edit(closed ? '绘制闭合路径' : '绘制路径', () => {
      if (sel && sel.type !== 'shape' && sel.type !== 'null' && sel.type !== 'camera' && sel.type !== 'light') {
        // 选中非形状层：作为蒙版
        const Wi = M4.inv(E.world(sel, App.t(), App.ctx()));
        const v = st.pts.map(p => M4.apply(Wi, [p.v[0], p.v[1], 0]).slice(0, 2)), i = st.pts.map(p => M4.applyDir(Wi, [p.i[0], p.i[1], 0]).slice(0, 2)), o = st.pts.map(p => M4.applyDir(Wi, [p.o[0], p.o[1], 0]).slice(0, 2));
        const mk = Mdl.mask([P.contour(v, i, o, true)]); mk.name = '蒙版 ' + (sel.masks.length + 1); sel.masks.push(mk); App.sel.item = mk.id;
      } else {
        let l = sel && sel.type === 'shape' ? sel : null;
        if (!l) { l = Mdl.newShapeLayer(App.comp(), '路径 ' + (App.comp().layers.length + 1), []); l.transform.position.value = [0, 0, 0]; App.comp().layers.unshift(l); App.sel.layers = [l.id]; }
        const Wi = M4.inv(E.world(l, App.t(), App.ctx()));
        const v = st.pts.map(p => M4.apply(Wi, [p.v[0], p.v[1], 0]).slice(0, 2)), i = st.pts.map(p => M4.applyDir(Wi, [p.i[0], p.i[1], 0]).slice(0, 2)), o = st.pts.map(p => M4.applyDir(Wi, [p.o[0], p.o[1], 0]).slice(0, 2));
        const it = Mdl.shape.path([P.contour(v, i, o, closed)], '路径');
        const g = Mdl.shape.group('组 ' + (l.content.length + 1), [it, closed ? Mdl.shape.fill([0.3, 0.75, 0.95, 1]) : null, Mdl.shape.stroke([1, 1, 1, 1], 4)].filter(Boolean));
        l.content.push(g); App.sel.item = it.id;
      }
    });
  }
  V.penKey = (e) => { if (!penState) return false; if (e.key === 'Enter') { finishPen(false); return true; } if (e.key === 'Escape') { penState = null; App.mark('viewer'); return true; } return false; };
  function drawShape(e, x, y) {
    const c0 = s2c([x, y]); let c1 = c0;
    const mm = (ev) => { c1 = s2c(local(ev)); marquee = [x, y, ...local(ev)]; App.mark('viewer'); };
    const mu = (ev) => {
      removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); marquee = null;
      let w = Math.abs(c1[0] - c0[0]), h = Math.abs(c1[1] - c0[1]); if (w < 3 || h < 3) { w = h = 200; c1 = [c0[0] + 200, c0[1] + 200]; }
      if (ev.shiftKey) w = h = Math.max(w, h);
      const cx = Math.min(c0[0], c1[0]) + w / 2, cy = Math.min(c0[1], c1[1]) + h / 2;
      const sel = App.layer();
      App.edit(App.tool === 'rect' ? '绘制矩形' : '绘制椭圆', () => {
        if (sel && ev.altKey && sel.type !== 'null') {
          const Wi = M4.inv(E.world(sel, App.t(), App.ctx())); const p = M4.apply(Wi, [cx, cy, 0]);
          const shp = App.tool === 'rect' ? P.rect(p[0], p[1], w, h) : P.ellipse(p[0], p[1], w, h);
          const mk = Mdl.mask([shp]); mk.name = '蒙版 ' + (sel.masks.length + 1); sel.masks.push(mk); App.sel.item = mk.id; return;
        }
        const item = App.tool === 'rect' ? Mdl.shape.rect(w, h, 0) : Mdl.shape.ellipse(w, h);
        if (sel && sel.type === 'shape') {
          const Wi = M4.inv(E.world(sel, App.t(), App.ctx())); const p = M4.apply(Wi, [cx, cy, 0]);
          item.position.value = [p[0], p[1]];
          sel.content.push(Mdl.shape.group((App.tool === 'rect' ? '矩形 ' : '椭圆 ') + (sel.content.length + 1), [item, Mdl.shape.fill([0.3, 0.75, 0.95, 1])]));
        } else {
          const l = Mdl.newShapeLayer(App.comp(), (App.tool === 'rect' ? '矩形' : '椭圆') + ' ' + (App.comp().layers.length + 1), [Mdl.shape.group('组 1', [item, Mdl.shape.fill([1, 0.62, 0.26, 1])])]);
          l.transform.position.value = [cx, cy, 0]; App.comp().layers.unshift(l); App.sel.layers = [l.id];
        }
      });
    };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }
  // 公开截图（工作区导出与逐帧接口共用）
  V.renderToTarget = (comp, t, ctx, scale = 1) => {
    const space = R.space([0, 0, comp.width, comp.height], comp.width * scale, comp.height * scale);
    return R.renderFrame(comp, t, space, { ctx });
  };
})(typeof window !== 'undefined' ? window : globalThis);
