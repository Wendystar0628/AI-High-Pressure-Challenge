// 攻城略地对局回放：一张 1920×1080 的 Canvas 2D，画面只由时间 t 决定（render(t) 是纯函数），可按任意帧号乱序取样。
// 数据和时间线在 plan.js；这里画地图、部队、交战、双方面板、兵力和节点数曲线、高光标注和结果。
// window.videoExport 供逐帧导出；平时打开循环播放，下方有拖动条，可打开或拖入一份日志。
(function () {
  'use strict';
  const SP = window.SiegePlan, ARRIVE = SP.ARRIVE;
  const W = 1920, H = 1080;

  // ---------- 色值（取自 tokens.css）、双方配色、版面 ----------
  const COL = {
    paper: '#F2F1F6', panel: '#FFFFFF', ink: '#1A1726', ink2: '#4A465C', rule: '#DCDAE4', chip: '#E7E5EE', soft: '#B7B2C6',
    missInk: '#8A8698', v300: '#C9AEFF', v400: '#B083FF', v500: '#9859FF', v800: '#4A22B8', g300: '#E6FFA3', g500: '#D1FF57', g800: '#4F6A00'
  };
  // 下标 0 中立、1 甲方（紫）、2 乙方（荧光绿，一律加墨边）
  const TEAM = [
    { fill: COL.paper, edge: COL.missInk, text: COL.ink2, line: COL.missInk, name: '中立' },
    { fill: COL.v500, edge: COL.ink, text: '#FFFFFF', line: COL.v500, onInk: COL.v400, name: '甲方' },
    { fill: COL.g500, edge: COL.ink, text: COL.ink, line: COL.g500, onInk: COL.g500, name: '乙方' }
  ];
  const LAY = {
    map: { x: 64, y: 156, w: 1000, h: 876, legend: 46 },
    side: { x: 1104, w: 752 },
    cards: { y: 156, h: 244, gap: 24 },
    tug: { y: 422, h: 26 },
    troops: { y: 470, h: 332 },
    owned: { y: 822, h: 210 }
  };
  // 画面效果：高光时镜头推近倍数、焦点往中央拉的比例、地图其余部分压淡的程度；交战后冲击环最长秒数
  const FX = { zoom: 1.28, pull: 0.5, dim: 0.45, ring: 0.7 };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  function bezier(x1, y1, x2, y2) {
    const bx = t => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t;
    const by = t => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1;
      for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
      return by((lo + hi) / 2);
    };
  }
  const EASE = { snap: bezier(0.16, 1, 0.3, 1), mech: bezier(0.7, 0, 0.2, 1), ease: bezier(0.2, 0.7, 0.1, 1) };
  const prog = (t, t0, d, e) => (e || EASE.mech)(clamp((t - t0) / d, 0, 1));

  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');

  // ---------- 文字 ----------
  function font(spec, stretch) { ctx.font = spec; ctx.fontStretch = stretch || 'normal'; }
  function text(s, x, y, spec, color, align, stretch) {
    font(spec, stretch); ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  }
  function width(s, spec, stretch) { font(spec, stretch); return ctx.measureText(s).width; }
  // 字号从 px 往下缩到放得进 maxW（最小 min），仍放不下就截断加省略号
  function fitted(s, maxW, weight, px, min, family, stretch) {
    let f = px;
    while (f > min && width(s, weight + ' ' + f + 'px ' + family, stretch) > maxW) f -= 1;
    let str = s;
    const spec = weight + ' ' + f + 'px ' + family;
    while (str.length > 1 && width(str, spec, stretch) > maxW) str = str.slice(0, -2) + '…';
    return { s: str, spec: spec };
  }
  function eyebrow(en, zh, x, y) {
    ctx.letterSpacing = '4px';
    let w = text('//', x, y, '800 26px Saira', COL.v500, 'left', 'expanded');
    w += 10;
    w += text(en, x + w, y, '600 26px Saira', COL.ink2, 'left', 'expanded');
    ctx.letterSpacing = '0px';
    if (zh) text(zh, x + w + 14, y, '900 28px SHS', COL.ink, 'left');
  }

  // ---------- 形状 ----------
  function star(x, y, r, fill, edge) {
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 - Math.PI / 2, b = a + Math.PI / 4;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.quadraticCurveTo(x + Math.cos(b) * r * 0.06, y + Math.sin(b) * r * 0.06, x + Math.cos(a + Math.PI / 2) * r, y + Math.sin(a + Math.PI / 2) * r);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (edge) { ctx.lineWidth = 2; ctx.strokeStyle = edge; ctx.stroke(); }
  }
  function panel(x, y, w, h) {
    ctx.fillStyle = COL.panel; ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 2; ctx.strokeStyle = COL.rule; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  // 墨底标签：lines = [{ s, spec, color }]；返回尺寸，draw=false 时只量
  function chipBox(lines, padX, padY, gap) {
    let w = 0, h = padY * 2 - gap;
    lines.forEach(l => { l.w = width(l.s, l.spec); l.px = parseInt(/(\d+)px/.exec(l.spec)[1], 10); w = Math.max(w, l.w); h += l.px + gap; });
    return { w: w + padX * 2, h: h, padX, padY, gap, lines };
  }
  function drawChip(box, x, y, alpha, fill) {
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill || COL.ink; ctx.fillRect(x, y, box.w, box.h);
    let yy = y + box.padY;
    box.lines.forEach(l => { yy += l.px; text(l.s, x + box.padX, yy - l.px * 0.14, l.spec, l.color, 'left'); yy += box.gap; });
    ctx.restore();
  }

  // ---------- 一局：地图几何、时间线上的事件 ----------
  let game = null, G = null;
  function prepare(g) {
    const R = LAY.map, pad = 74, legend = R.legend;
    let mx = 1, my = 1;
    g.nodes.forEach(n => { mx = Math.max(mx, Math.abs(n.x)); my = Math.max(my, Math.abs(n.y)); });
    const s = Math.min((R.w - 2 * pad) / (2 * mx), (R.h - legend - 2 * pad) / (2 * my), 62);
    const cx = R.x + R.w / 2, cy = R.y + (R.h - legend) / 2;
    const pts = g.nodes.map(n => ({ x: cx + n.x * s, y: cy - n.y * s }));
    // 半径随增长率；只把挤在一起的节点按比例缩小，两两至少留 12px 缝
    const r0 = g.nodes.map(n => 19 + 3.8 * n.growth), r = r0.slice();
    for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      r[i] = Math.max(14, Math.min(r[i], (d - 12) * r0[i] / (r0[i] + r0[j])));
    }
    const far = Math.max.apply(null, pts.map(p => Math.hypot(p.x - cx, p.y - cy))) || 1;

    const tl = g.timeline, n = g.turns.length, P = tl.pace;
    const flipAt = i => tl.start[i] + (ARRIVE + 0.5 * (1 - ARRIVE)) * tl.dur[i];
    // 交战、易主的冲击环
    const rings = [];
    g.turns.forEach((T, i) => T.arrival.forEach(a => {
      if (!a || !(a.capture || a.clash || a.arriving[3 - a.oldOwner] > 0 && a.oldOwner > 0)) return;
      rings.push({ t: flipAt(i), node: a.node, owner: a.owner, capture: a.capture, dur: clamp(3.5 * tl.dur[i], 0.22, FX.ring) });
    }));
    // 高光：慢放渐入 tA→tB，结算 tShow，定格到 tC，渐出到 tD
    const hls = g.highlights.map(h => {
      const a = Math.max(0, h.from - P.ramp), d = Math.min(n - 1, h.turn + P.ramp);
      let tA = tl.start[a], tB = tl.start[h.from];
      if (tB - tA < 0.3) tA = tB - 0.3;
      const tC = tl.end[h.turn] + tl.holdAfter[h.turn];
      const tD = d > h.turn ? tl.end[d] : tC + 0.5;
      const focus = h.nodes.map(k2 => pts[k2]);
      let Z = 1, F = null;
      if (focus.length) {
        F = { x: focus.reduce((s2, p) => s2 + p.x, 0) / focus.length, y: focus.reduce((s2, p) => s2 + p.y, 0) / focus.length };
        const ext = Math.max.apply(null, focus.map(p => Math.hypot(p.x - F.x, p.y - F.y))) + 170;
        Z = clamp(Math.min(R.w, R.h - legend) / 2 / ext, 1, FX.zoom);
      }
      return { h, tA, tB, tC, tD, tShow: flipAt(h.turn), tPre: h.type === 'snipe' && h.from < h.turn ? flipAt(h.from) : null, F, Z };
    });
    // 兵力曲线的纵轴随已播部分的最大值放大：prefix[k] 是前 k 个回合结算后双方总兵力的最大值
    const prefix = [];
    g.stats.forEach((st, k) => prefix.push(Math.max(k ? prefix[k - 1] : 0, st.troops[1], st.troops[2])));
    G = { s, cx, cy, pts, r, far, rings, hls, flipAt, prefix, seconds: tl.seconds };
  }
  function ticks(top) {
    const raw = top / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(m => m * mag).filter(v => v >= raw)[0];
    const out = [];
    for (let v = 0; v <= top + 1e-9; v += step) out.push(v);
    return out;
  }

  // ---------- 某一刻的局面 ----------
  function nodeAt(loc, k) {
    if (loc.i < 0) { const s = game.header.initial_state.nodes[k]; return { owner: s.owner, troops: s.troops }; }
    const T = game.turns[loc.i], u = loc.u;
    if (u >= 1 || !T.settled) { const s = T.after.nodes[k]; return { owner: s.owner, troops: s.troops }; }
    const b = T.before.nodes[k], a = T.arrival[k], base = b.troops - T.sent[k];
    if (!a || u < ARRIVE) return { owner: b.owner, troops: base + T.grow[k] * Math.min(1, u / ARRIVE) };
    const v = (u - ARRIVE) / (1 - ARRIVE), fight = a.capture || a.clash || (a.oldOwner > 0 && a.arriving[3 - a.oldOwner] > 0) || (a.oldOwner === 0 && a.oldTroops > 0);
    if (a.capture) return v < 0.5 ? { owner: a.oldOwner, troops: a.oldTroops * (1 - EASE.mech(v / 0.5)), v, fight } : { owner: a.owner, troops: a.troops * EASE.snap((v - 0.5) / 0.5), v, fight };
    return { owner: a.owner, troops: lerp(a.oldTroops, a.troops, EASE.mech(v)), v, fight };
  }
  function fleetsAt(loc) {
    if (loc.i < 0) return [];
    const T = game.turns[loc.i], u = loc.u, out = [];
    T.fleets.forEach(f => {
      if (f.arrive && u >= ARRIVE) return;
      const q = f.arrive ? u / ARRIVE : u;
      out.push({ f, p: f.p0 + (f.p1 - f.p0) * q, born: f.fresh ? clamp(q * 4, 0, 1) : 1 });
    });
    return out;
  }
  // 连续的“已完成回合数”：图表和面板用
  function clockAt(loc) { return loc.i < 0 ? 0 : loc.kind === 'turn' ? loc.i + loc.u : loc.i + 1; }
  function statAt(xc) {
    const st = game.stats, a = Math.floor(xc), b = Math.min(st.length - 1, a + 1), f = xc - a;
    const A = st[Math.min(a, st.length - 1)], B = st[b];
    return { troops: [0, lerp(A.troops[1], B.troops[1], f), lerp(A.troops[2], B.troops[2], f)],
      nodes: f < ARRIVE + 0.5 * (1 - ARRIVE) ? A.nodes : B.nodes, growth: f < ARRIVE + 0.5 * (1 - ARRIVE) ? A.growth : B.growth };
  }

  // ---------- 镜头：当前最强的高光包络 ----------
  function envelope(hl, t) {
    if (t < hl.tA || t >= hl.tD) return 0;
    if (t < hl.tB) return EASE.mech((t - hl.tA) / (hl.tB - hl.tA));
    if (t < hl.tC) return 1;
    return 1 - EASE.mech((t - hl.tC) / (hl.tD - hl.tC));
  }
  function camera(t) {
    let best = null, e = 0;
    G.hls.forEach(hl => { const x = envelope(hl, t); if (x > e) { e = x; best = hl; } });
    const cam = { e, hl: best, z: 1, F: { x: G.cx, y: G.cy }, Fp: { x: G.cx, y: G.cy } };
    if (best && best.F) {
      const R = LAY.map, Cb = { x: R.x + R.w / 2, y: R.y + (R.h - R.legend) / 2 };
      cam.z = 1 + (best.Z - 1) * e;
      cam.F = best.F;
      cam.Fp = { x: best.F.x + (Cb.x - best.F.x) * FX.pull * e, y: best.F.y + (Cb.y - best.F.y) * FX.pull * e };
    }
    cam.map = p => ({ x: cam.Fp.x + (p.x - cam.F.x) * cam.z, y: cam.Fp.y + (p.y - cam.F.y) * cam.z });
    return cam;
  }

  // ---------- 地图 ----------
  function drawBoard(t) {
    const R = LAY.map;
    panel(R.x, R.y, R.w, R.h);
    // 角标
    ctx.lineWidth = 3; ctx.strokeStyle = COL.ink;
    [[R.x, R.y, 1, 1], [R.x + R.w, R.y, -1, 1], [R.x, R.y + R.h, 1, -1], [R.x + R.w, R.y + R.h, -1, -1]].forEach(c => {
      ctx.beginPath(); ctx.moveTo(c[0] + c[2] * 22, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * 22); ctx.stroke();
    });
  }
  function drawGrid(cam) {
    const o = cam.map({ x: G.cx, y: G.cy }), z = cam.z;
    ctx.lineWidth = 2; ctx.strokeStyle = COL.chip;
    [5, 10].forEach(rr => { ctx.beginPath(); ctx.arc(o.x, o.y, rr * G.s * z, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(o.x - 10.6 * G.s * z, o.y); ctx.lineTo(o.x + 10.6 * G.s * z, o.y); ctx.moveTo(o.x, o.y - 10.6 * G.s * z); ctx.lineTo(o.x, o.y + 10.6 * G.s * z); ctx.stroke();
    star(o.x, o.y, 12, COL.soft);
  }
  function fleetGeom(fl, cam) {
    const f = fl.f, A = G.pts[f.from], B = G.pts[f.to], L = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const dx = (B.x - A.x) / L, dy = (B.y - A.y) / L, a = G.r[f.from] + 6, b = G.r[f.to] + 4;
    const P = { x: A.x + dx * (a + (L - a - b) * fl.p), y: A.y + dy * (a + (L - a - b) * fl.p) }, E2 = { x: B.x - dx * b, y: B.y - dy * b };
    return { P: cam.map(P), E: cam.map(E2), dx, dy };
  }
  function drawRoutes(fls, cam) {
    ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([8, 9]);
    fls.forEach(fl => {
      const g2 = fleetGeom(fl, cam);
      ctx.strokeStyle = fl.f.owner === 1 ? 'rgba(152,89,255,0.55)' : 'rgba(79,106,0,0.45)';
      ctx.beginPath(); ctx.moveTo(g2.P.x, g2.P.y); ctx.lineTo(g2.E.x, g2.E.y); ctx.stroke();
    });
    ctx.restore();
  }
  function drawFleets(fls, cam) {
    const z = cam.z, labels = [];
    fls.forEach(fl => {
      const f = fl.f, g2 = fleetGeom(fl, cam), tm = TEAM[f.owner], L = (11 + 1.9 * Math.sqrt(f.troops)) * Math.min(1, 0.4 + fl.born * 0.6);
      const s = Math.min(L, 30) * z, dx = g2.dx, dy = g2.dy, P = g2.P;
      ctx.beginPath();
      ctx.moveTo(P.x + dx * s * 0.62, P.y + dy * s * 0.62);
      ctx.lineTo(P.x - dx * s * 0.5 - dy * s * 0.48, P.y - dy * s * 0.5 + dx * s * 0.48);
      ctx.lineTo(P.x - dx * s * 0.22, P.y - dy * s * 0.22);
      ctx.lineTo(P.x - dx * s * 0.5 + dy * s * 0.48, P.y - dy * s * 0.5 - dx * s * 0.48);
      ctx.closePath();
      ctx.fillStyle = tm.fill; ctx.fill(); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeStyle = COL.ink; ctx.stroke();
      // 兵力写在行进方向左侧
      const off = s * 0.55 + 15 * z;
      labels.push({ x: P.x + dy * off, y: P.y - dx * off, s: String(f.troops), a: fl.born });
    });
    const px = Math.round(22 * z);
    font('800 ' + px + 'px Saira', 'semi-expanded'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = COL.panel;
    labels.forEach(l => { ctx.globalAlpha = l.a; ctx.strokeText(l.s, l.x, l.y); ctx.fillStyle = COL.ink; ctx.fillText(l.s, l.x, l.y); });
    ctx.globalAlpha = 1;
  }
  function drawNodes(loc, cam, t, intro) {
    const z = cam.z;
    game.nodes.forEach((nd, k) => {
      const st = nodeAt(loc, k), tm = TEAM[st.owner];
      let p = cam.map(G.pts[k]), r = G.r[k] * z, sc = 1;
      if (intro != null) {   // 开场：从中心往外依次弹出
        const d = k < 2 ? 0 : 0.25 + 0.75 * Math.hypot(G.pts[k].x - G.cx, G.pts[k].y - G.cy) / G.far;   // 双方起始节点先出
        sc = EASE.snap(clamp((intro - 0.1 - d * 0.45) / 0.35, 0, 1));
        if (sc <= 0) return;
      }
      if (st.fight && st.v != null) p = { x: p.x + Math.sin(st.v * Math.PI * 6) * 5 * (1 - st.v) * z, y: p.y };
      r *= sc;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = tm.fill; ctx.fill();
      ctx.lineWidth = 3 * z; ctx.strokeStyle = tm.edge; ctx.stroke();
      // 兵力
      const s = String(Math.max(0, Math.round(st.troops)));
      let px = Math.min(34, r * 0.92);
      font('800 ' + px.toFixed(1) + 'px Saira', 'semi-expanded');
      while (px > 12 && ctx.measureText(s).width > 2 * r - 12 * z) { px -= 1; font('800 ' + px.toFixed(1) + 'px Saira', 'semi-expanded'); }
      ctx.fillStyle = tm.text; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(s, p.x, p.y + px * 0.36);
      // 增长率
      if (sc > 0.9) text('+' + nd.growth, p.x + r * 0.74 + 3 * z, p.y + r * 0.74 + 20 * z, '700 ' + Math.round(22 * z) + 'px Saira', COL.ink2, 'left', 'semi-expanded');
    });
  }
  function drawRings(t, cam) {
    G.rings.forEach(e => {
      if (t < e.t || t >= e.t + e.dur) return;
      const u = (t - e.t) / e.dur, p = cam.map(G.pts[e.node]), r = (G.r[e.node] + 6 + 44 * EASE.snap(u)) * cam.z;
      const w = (e.capture ? 7 : 3) * (1 - u) + 1;
      ctx.globalAlpha = 1 - EASE.ease(u);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (e.owner === 2 || !e.capture) { ctx.lineWidth = w + 4; ctx.strokeStyle = COL.ink; ctx.stroke(); }
      ctx.lineWidth = w; ctx.strokeStyle = e.capture ? TEAM[e.owner].fill : COL.panel; ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }
  // 高光：焦点外压淡、焦点圈、标签
  function drawFocus(t, cam) {
    const hl = cam.hl, e = cam.e;
    if (!hl || e <= 0) return;
    // 焦点以外蒙一层白：整块铺上、焦点处留圆洞，洞的边缘用径向渐变补成柔边（直接画在主画布上，不经离屏画布）
    const R = LAY.map, h = hl.h, a = (FX.dim * e * (h.nodes.length ? 1 : 0.7)).toFixed(3);
    const holes = h.nodes.map(k => { const p = cam.map(G.pts[k]); return { x: p.x, y: p.y, r0: (G.r[k] + 60) * cam.z, r1: (G.r[k] + 175) * cam.z }; });
    ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h);
    holes.forEach(o => { ctx.moveTo(o.x + o.r1, o.y); ctx.arc(o.x, o.y, o.r1, 0, Math.PI * 2, true); });
    ctx.fillStyle = 'rgba(255,255,255,' + a + ')'; ctx.fill('evenodd');
    holes.forEach(o => {
      const gr = ctx.createRadialGradient(o.x, o.y, o.r0, o.x, o.y, o.r1);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,' + a + ')');
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r1, 0, Math.PI * 2); ctx.fillStyle = gr; ctx.fill();
    });
    h.nodes.forEach(k => {
      const p = cam.map(G.pts[k]), rr = (G.r[k] + 14) * cam.z;
      ctx.save(); ctx.globalAlpha = e;
      ctx.lineWidth = 4; ctx.strokeStyle = COL.ink; ctx.setLineDash([14, 10]); ctx.lineDashOffset = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });
  }
  // 标签放在焦点的四个斜角之一：留在地图板内，尽量少压其他节点和已放好的标签
  function chipPlace(p, rr, box, cam, taken) {
    const R = LAY.map, m = 14, d = rr * 0.7 + 22, cands = [
      { x: p.x + d, y: p.y - d - box.h }, { x: p.x - d - box.w, y: p.y - d - box.h }, { x: p.x + d, y: p.y + d }, { x: p.x - d - box.w, y: p.y + d },
      { x: p.x - box.w / 2, y: p.y - rr - 26 - box.h }, { x: p.x - box.w / 2, y: p.y + rr + 26 }];
    const fit = c => ({ x: clamp(c.x, R.x + m, R.x + R.w - m - box.w), y: clamp(c.y, R.y + m, R.y + R.h - R.legend - m - box.h) });
    let best = null, bestCost = Infinity;
    cands.forEach((c0, i) => {
      const c = fit(c0);
      let cost = i * 0.01 + Math.hypot(c.x - c0.x, c.y - c0.y) * 0.02;
      G.pts.forEach((q0, k) => {
        const q = cam.map(q0), r = G.r[k] * cam.z + 6;
        const nx = clamp(q.x, c.x, c.x + box.w), ny = clamp(q.y, c.y, c.y + box.h);
        if (Math.hypot(q.x - nx, q.y - ny) < r) cost += 1;
      });
      if (Math.hypot(p.x - clamp(p.x, c.x, c.x + box.w), p.y - clamp(p.y, c.y, c.y + box.h)) < rr) cost += 10;
      taken.forEach(o => { if (c.x < o.x + o.w && o.x < c.x + box.w && c.y < o.y + o.h && o.y < c.y + box.h) cost += 5; });
      if (cost < bestCost) { bestCost = cost; best = c; }
    });
    taken.push({ x: best.x, y: best.y, w: box.w, h: box.h });
    return best;
  }
  function drawCallouts(t, cam) {
    G.hls.forEach(hl => {
      const h = hl.h;
      let a = 0, pre = false;
      if (hl.tPre != null && t >= hl.tPre && t < hl.tShow) { a = prog(t, hl.tPre, 0.25, EASE.snap); pre = true; }
      else if (t >= hl.tShow && t < hl.tC + 0.35) a = t < hl.tC ? prog(t, hl.tShow, 0.3, EASE.snap) : 1 - prog(t, hl.tC, 0.35);
      if (a <= 0) return;
      if (h.type === 'lead') return drawLeadChip(hl, t, a);
      const taken = [];
      // 主焦点写全句；同回合成对出现的其余焦点只写类别
      h.group.forEach((o, gi) => {
        const k = o.node, p = cam.map(G.pts[k]), rr = (G.r[k] + 14) * cam.z;
        const lines = pre ? [{ s: o.text.pre, spec: '900 34px SHS', color: '#FFFFFF' }]
          : [{ s: o.text.tag, spec: '900 ' + (gi ? 36 : 46) + 'px SHS', color: COL.g500 }].concat(gi === 0 ? [{ s: o.text.line, spec: '700 28px SHS', color: '#FFFFFF' }] : []);
        const box = chipBox(lines, 18, 14, 10), at = chipPlace(p, rr, box, cam, taken);
        const cx = clamp(p.x, at.x, at.x + box.w), cy = clamp(p.y, at.y, at.y + box.h), L = Math.hypot(cx - p.x, cy - p.y) || 1;
        ctx.save(); ctx.globalAlpha = a;
        ctx.lineWidth = 3; ctx.strokeStyle = COL.ink;
        ctx.beginPath(); ctx.moveTo(p.x + (cx - p.x) / L * rr, p.y + (cy - p.y) / L * rr); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.restore();
        drawChip(box, at.x, at.y + (1 - a) * 10, a);
        if (!pre) star(at.x + box.w, at.y + (1 - a) * 10, 15 * a, COL.g500, COL.ink);
      });
    });
  }

  // ---------- 右侧：双方面板、占比条、两张曲线 ----------
  function drawCards(xc, t, cam) {
    const S = LAY.side, C = LAY.cards, w = (S.w - C.gap) / 2, st = statAt(xc);
    const lead = st.troops[1] > st.troops[2] ? 1 : st.troops[2] > st.troops[1] ? 2 : 0;
    const timeouts = [0, 0], done = Math.floor(xc);
    for (let i = 0; i < Math.min(done, game.turns.length); i++) game.turns[i].timeout.forEach((x, k) => { if (x) timeouts[k]++; });
    [1, 2].forEach(side => {
      const x = S.x + (side - 1) * (w + C.gap), y = C.y, tm = TEAM[side];
      panel(x, y, w, C.h);
      ctx.fillStyle = tm.fill; ctx.fillRect(x, y, w, 10);
      if (side === 2) { ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.strokeRect(x + 1, y + 1, w - 2, 9); }
      // 第一行：甲方/乙方，领先标记
      ctx.fillStyle = tm.fill; ctx.fillRect(x + 22, y + 34, 22, 22); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.strokeRect(x + 23, y + 35, 20, 20);
      text(tm.name, x + 54, y + 56, '900 30px SHS', COL.ink);
      if (timeouts[side - 1]) text('超时 ' + timeouts[side - 1], x + 124, y + 55, '700 22px SHS', COL.ink2);
      if (lead === side && t >= 0) {
        const bw = width('领先', '900 26px SHS') + 24;
        ctx.fillStyle = COL.ink; ctx.fillRect(x + w - 20 - bw, y + 28, bw, 36);
        text('领先', x + w - 20 - bw + 12, y + 55, '900 26px SHS', COL.g500);
      }
      // 第二行：程序名
      const nm = fitted(game.names[side - 1], w - 44, '800', 40, 24, 'Saira, SHS', 'semi-expanded');
      text(nm.s, x + 22, y + 112, nm.spec, COL.ink, 'left', 'semi-expanded');
      // 第三行：总兵力；第四行：节点数、每回合增长
      const tw = text(String(Math.round(st.troops[side])), x + 20, y + 182, '800 68px Saira', COL.ink, 'left', 'semi-expanded');
      text('总兵力', x + 30 + tw, y + 180, '700 26px SHS', COL.ink2);
      text('节点 ' + st.nodes[side] + '  ·  每回合 +' + st.growth[side], x + 22, y + 224, '700 28px Saira, SHS', COL.ink2, 'left', 'semi-expanded');
    });
    // 总兵力占比
    const T = LAY.tug, a = st.troops[1], b = st.troops[2], f = a + b > 0 ? a / (a + b) : 0.5, X = S.x + S.w * f;
    ctx.fillStyle = TEAM[1].fill; ctx.fillRect(S.x, T.y, X - S.x, T.h);
    ctx.fillStyle = TEAM[2].fill; ctx.fillRect(X, T.y, S.x + S.w - X, T.h);
    ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.strokeRect(S.x + 1, T.y + 1, S.w - 2, T.h - 2);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, T.y); ctx.lineTo(X, T.y + T.h); ctx.stroke();
    ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeStyle = COL.ink2;
    ctx.beginPath(); ctx.moveTo(S.x + S.w / 2, T.y - 8); ctx.lineTo(S.x + S.w / 2, T.y + T.h + 8); ctx.stroke(); ctx.setLineDash([]);
  }

  function plotBox(B) { return { x: B.x + 78, y: B.y + 86, w: B.w - 78 - 30, h: B.h - 86 - 48 }; }
  function yMax(xc) {
    const k = Math.min(Math.floor(xc), G.prefix.length - 1), head = statAt(xc);
    return Math.max(150, Math.max(G.prefix[k], head.troops[1], head.troops[2]) * 1.15);
  }
  function xAxis(P) {
    const mt = game.maxTurns;
    for (let k = 0; k <= mt; k += 50) text(String(k), P.x + k / mt * P.w, P.y + P.h + 32, '700 22px Saira', COL.ink2, 'center', 'semi-expanded');
    ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(P.x, P.y + P.h); ctx.lineTo(P.x + P.w, P.y + P.h); ctx.stroke();
  }
  function drawTroops(xc, t) {
    const S = LAY.side, B = { x: S.x, y: LAY.troops.y, w: S.w, h: LAY.troops.h }, P = plotBox(B), mt = game.maxTurns;
    panel(B.x, B.y, B.w, B.h);
    eyebrow('TROOPS', '总兵力', B.x + 24, B.y + 46);
    const ymax = yMax(xc), X = k => P.x + k / mt * P.w, Yv = v => P.y + P.h - v / ymax * P.h;
    ctx.lineWidth = 2;
    ticks(ymax).forEach(v => {
      if (v > 0) { ctx.strokeStyle = COL.chip; ctx.beginPath(); ctx.moveTo(P.x, Yv(v)); ctx.lineTo(P.x + P.w, Yv(v)); ctx.stroke(); }
      text(String(v), P.x - 12, Yv(v) + 8, '700 22px Saira', COL.ink2, 'right', 'semi-expanded');
    });
    xAxis(P);
    // 高光的竖线和星（到了才出现）
    G.hls.forEach(hl => {
      if (t < hl.tShow) return;
      const a = prog(t, hl.tShow, 0.3, EASE.snap), x = X(hl.h.turn + 1);
      ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.strokeStyle = COL.ink2;
      ctx.beginPath(); ctx.moveTo(x, P.y + 4); ctx.lineTo(x, P.y + P.h); ctx.stroke(); ctx.restore();
    });
    // 两条线：画到当前回合
    const st = game.stats, n = Math.min(Math.floor(xc), st.length - 1), head = statAt(xc);
    [1, 2].forEach(side => {
      ctx.beginPath();
      for (let k = 0; k <= n; k++) { const x = X(k), y = Yv(st[k].troops[side]); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      if (xc > n) ctx.lineTo(X(xc), Yv(head.troops[side]));
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (side === 2) { ctx.lineWidth = 8; ctx.strokeStyle = COL.ink; ctx.stroke(); }
      ctx.lineWidth = side === 2 ? 4 : 5; ctx.strokeStyle = TEAM[side].line; ctx.stroke();
    });
    [1, 2].forEach(side => {
      const x = X(xc), y = Yv(head.troops[side]);
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = TEAM[side].fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
    });
    // 高光标签（竖线顶端）：挨得近的放到第二排（图内顶端）；排法只看全部高光的位置，与 t 无关
    const ends = [-Infinity, -Infinity];
    G.hls.forEach(hl => {
      const x = X(hl.h.turn + 1), lab = hl.h.text.tag, bw = width(lab, '900 22px SHS') + 16, bx = clamp(x - bw / 2, P.x - 20, P.x + P.w + 20 - bw);
      const row = bx >= ends[0] + 8 ? 0 : 1;
      ends[row] = Math.max(ends[row], bx + bw);
      if (t < hl.tShow) return;
      const a = prog(t, hl.tShow, 0.3, EASE.snap), y = row ? P.y + 8 : P.y - 30;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = COL.ink; ctx.fillRect(bx, y - 4, bw, 32);
      text(lab, bx + 8, y + 20, '900 22px SHS', '#FFFFFF');
      ctx.restore();
      if (hl.h.type === 'lead') { const yy = Yv(game.stats[hl.h.turn + 1].troops[hl.h.side]); star(x, yy, 16 * a, COL.g500, COL.ink); }
    });
    // 图例
    let lx = B.x + B.w - 24;
    [2, 1].forEach(side => {
      const w2 = width(TEAM[side].name, '700 24px SHS');
      lx -= w2; text(TEAM[side].name, lx, B.y + 45, '700 24px SHS', COL.ink);
      lx -= 40; ctx.fillStyle = TEAM[side].fill; ctx.fillRect(lx, B.y + 30, 30, 10);
      if (side === 2) { ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.strokeRect(lx, B.y + 30, 30, 10); }
      lx -= 26;
    });
  }
  function drawOwned(xc) {
    const S = LAY.side, B = { x: S.x, y: LAY.owned.y, w: S.w, h: LAY.owned.h }, P = plotBox(B), mt = game.maxTurns, N = game.N;
    panel(B.x, B.y, B.w, B.h);
    eyebrow('NODES', '节点数', B.x + 24, B.y + 46);
    const X = k => P.x + k / mt * P.w, Yv = v => P.y + P.h - v / N * P.h;
    [0, N / 2, N].forEach(v => text(String(v), P.x - 12, Yv(v) + 8, '700 22px Saira', COL.ink2, 'right', 'semi-expanded'));
    const st = game.stats, n = Math.min(Math.floor(xc), st.length - 1), end = X(xc);
    if (xc > 0) {
      ctx.fillStyle = COL.chip; ctx.fillRect(P.x, P.y, end - P.x, P.h);   // 中立（中间）
      const band = (side) => {
        ctx.beginPath();
        const base = side === 1 ? Yv(0) : Yv(N), val = k => side === 1 ? Yv(st[k].nodes[1]) : Yv(N - st[k].nodes[2]);
        ctx.moveTo(P.x, base);
        for (let k = 0; k <= n; k++) { const x0 = X(k), x1 = Math.min(end, X(k + 1)); ctx.lineTo(x0, val(k)); ctx.lineTo(x1, val(k)); if (x1 >= end) break; }
        ctx.lineTo(end, base); ctx.closePath();
        ctx.fillStyle = TEAM[side].fill; ctx.fill();
        if (side === 2) { ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke(); }
      };
      band(1); band(2);
    }
    ctx.lineWidth = 3; ctx.strokeStyle = COL.ink; ctx.beginPath(); ctx.moveTo(end, P.y); ctx.lineTo(end, P.y + P.h); ctx.stroke();
    xAxis(P);
    // 右上角说明：上乙下甲，中间灰是中立
    text('上 乙方 · 中 中立 · 下 甲方', B.x + B.w - 24, B.y + 45, '700 22px SHS', COL.ink2, 'right');
  }
  function drawLeadChip(hl, t, a) {
    const S = LAY.side, B = { x: S.x, y: LAY.troops.y, w: S.w, h: LAY.troops.h }, P = plotBox(B);
    const h = hl.h, x = P.x + (h.turn + 1) / game.maxTurns * P.w;
    const box = chipBox([{ s: h.text.tag, spec: '900 46px SHS', color: COL.g500 }, { s: h.text.line, spec: '700 28px SHS', color: '#FFFFFF' }], 18, 14, 10);
    // 放在交叉点右侧；曲线在图的上半部时放到下半部，反之放上半部
    const yy = P.y + P.h - game.stats[h.turn + 1].troops[h.side] / yMax(h.turn + 1) * P.h;
    const bx = clamp(x + 36, P.x + 8, B.x + B.w - 16 - box.w), by = yy < P.y + P.h / 2 ? P.y + P.h - box.h - 8 : P.y + 44;
    drawChip(box, bx, by + (1 - a) * 10, a);
    star(bx + box.w, by + (1 - a) * 10, 15 * a, COL.g500, COL.ink);
  }

  // ---------- 页眉 ----------
  function drawHead(loc, cam, t) {
    eyebrow('ALGORITHM DUEL', '攻城略地 · 对局回放', 64, 76);
    const h = game.header, meta = game.title || ('种子 ' + h.seed + ' · ' + game.N + ' 个节点' + (h.name ? ' · ' + h.name : ''));
    text(meta, 64, 128, '700 30px Saira, SHS', COL.ink2, 'left', 'semi-expanded');
    // 回合
    const x = 1856, mt = game.maxTurns;
    const ofW = text('/ ' + mt, x, 128, '700 34px Saira', COL.ink2, 'right', 'semi-expanded');
    let nx = x - ofW - 14;
    if (loc.i < 0 && loc.kind !== 'outro') {
      const w2 = text('开局', nx, 128, '900 56px SHS', COL.ink, 'right'); nx -= w2 + 14;
    } else {
      const turnNo = loc.kind === 'turn' ? game.turns[loc.i].turn : game.turns.length ? game.turns[loc.i].turn : 0;
      const w2 = text(String(turnNo), nx, 130, '800 80px Saira', COL.ink, 'right', 'semi-expanded'); nx -= w2 + 14;
    }
    nx -= text('回合', nx, 126, '900 30px SHS', COL.ink2, 'right') + 24;
    // 慢放提示：当前回合比常速慢 2.5 倍以上（含高光定格）
    const tl = game.timeline, base = tl.pace.turn * tl.flowScale;
    let slow = 0;
    if (loc.kind === 'turn') slow = clamp((tl.dur[loc.i] / base - 2.5) / 2, 0, 1);
    else if (loc.kind === 'hold') slow = 1;
    if (slow > 0) {
      const bw = width('慢放', '900 28px SHS') + 26;
      ctx.save(); ctx.globalAlpha = slow;
      ctx.fillStyle = COL.ink; ctx.fillRect(nx - bw, 92, bw, 42);
      text('慢放', nx - bw + 13, 124, '900 28px SHS', COL.g500);
      ctx.restore();
    }
  }
  function drawLegend() {
    const R = LAY.map, y = R.y + R.h - 20, x0 = R.x + 26;
    let x = x0;
    ctx.beginPath(); ctx.arc(x + 12, y - 9, 12, 0, Math.PI * 2); ctx.fillStyle = TEAM[0].fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = TEAM[0].edge; ctx.stroke();
    x += 34; x += text('中立', x, y, '700 24px SHS', COL.ink2) + 30;
    x += text('+n', x, y, '800 24px Saira', COL.ink, 'left', 'semi-expanded') + 8;
    x += text('每回合增长（圆越大增长越快）', x, y, '700 24px SHS', COL.ink2) + 30;
    // 部队图例
    ctx.beginPath(); ctx.moveTo(x + 24, y - 9); ctx.lineTo(x + 2, y - 20); ctx.lineTo(x + 8, y - 9); ctx.lineTo(x + 2, y + 2); ctx.closePath();
    ctx.fillStyle = COL.chip; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = COL.ink; ctx.stroke();
    x += 34; text('行军部队和兵力', x, y, '700 24px SHS', COL.ink2);
  }

  // ---------- 结果 ----------
  function drawResult(t) {
    const tl = game.timeline, t0 = tl.outroAt;
    if (t < t0) return;
    const R = LAY.map, end = game.ending, a = prog(t, t0, 0.45), bh = 236, by = R.y + (R.h - R.legend) / 2 - bh / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(R.x, by, R.w * a, bh); ctx.clip();
    ctx.fillStyle = COL.ink; ctx.fillRect(R.x, by, R.w, bh);
    const col = end.winner === 1 || end.winner === 2 ? TEAM[end.winner].onInk : '#FFFFFF';
    const tw = text(end.title, R.x + 56, by + 112, '900 92px SHS', col);
    const sub = end.winner === 1 || end.winner === 2 ? game.names[end.winner - 1] : game.names[0] + ' 对 ' + game.names[1];
    // 右上：最终总兵力；左：结果、获胜方、结束原因（按剩余宽度缩字）
    const tot = Math.round(end.totals[0]) + ' : ' + Math.round(end.totals[1]);
    const totW = Math.max(text(tot, R.x + R.w - 56, by + 112, '800 58px Saira', '#FFFFFF', 'right', 'semi-expanded'), width('最终总兵力  甲 : 乙', '700 24px SHS'));
    text('最终总兵力  甲 : 乙', R.x + R.w - 56, by + 46, '700 24px SHS', COL.soft, 'right');
    const room = R.w - 112 - totW - 40;
    const nm = fitted(sub, room - tw - 36, '800', 40, 24, 'Saira, SHS', 'semi-expanded');
    text(nm.s, R.x + 56 + tw + 36, by + 108, nm.spec, '#FFFFFF', 'left', 'semi-expanded');
    const ln = fitted(end.line, R.w - 112, '700', 32, 22, 'SHS');
    text(ln.s, R.x + 56, by + 180, ln.spec, '#ECEAF3');
    ctx.restore();
  }

  // ---------- 一帧 ----------
  function render(t) {
    // 每帧从干净的绘图状态开始（线端、线连接、虚线、字体等不能从上一帧带过来，否则同一帧号会画得不一样）
    ctx.reset();
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.letterSpacing = '0px';
    ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, W, H);
    if (!game) return drawEmpty();
    t = clamp(t, 0, G.seconds);
    const loc = SP.locate(game.timeline, t), xc = clockAt(loc), cam = camera(t);
    const intro = loc.kind === 'intro' ? t : null;
    drawHead(loc, cam, t);
    drawBoard(t);
    const R = LAY.map;
    ctx.save(); ctx.beginPath(); ctx.rect(R.x + 2, R.y + 2, R.w - 4, R.h - 4); ctx.clip();
    drawGrid(cam);
    const fls = fleetsAt(loc);
    drawRoutes(fls, cam);
    drawRings(t, cam);
    drawNodes(loc, cam, t, intro);
    drawFleets(fls, cam);
    drawFocus(t, cam);
    ctx.restore();
    // 图例底条（不随镜头）
    ctx.fillStyle = COL.panel; ctx.fillRect(R.x + 2, R.y + R.h - R.legend - 2, R.w - 4, R.legend);
    ctx.lineWidth = 2; ctx.strokeStyle = COL.rule; ctx.beginPath(); ctx.moveTo(R.x + 2, R.y + R.h - R.legend - 2); ctx.lineTo(R.x + R.w - 2, R.y + R.h - R.legend - 2); ctx.stroke();
    drawLegend();
    // 右侧面板：开场时由上往下依次出现
    const side = intro == null ? 1 : prog(intro, 0.15, 0.6, EASE.snap);
    ctx.save(); ctx.globalAlpha = side; ctx.translate((1 - side) * 40, 0);
    drawCards(xc, t, cam);
    drawTroops(xc, t);
    drawOwned(xc);
    ctx.restore();
    drawCallouts(t, cam);
    drawResult(t);
  }
  function drawEmpty() {
    eyebrow('ALGORITHM DUEL', '攻城略地 · 对局回放', 64, 76);
    panel(LAY.map.x, LAY.map.y, W - 128, LAY.map.h);
    text(loadError || '打开或拖入一局对局日志（.jsonl）', W / 2, 560, '900 48px SHS', loadError ? '#C2263E' : COL.ink2, 'center');
    if (!loadError) text('也可在地址后加 ?input=输入脚本 或 ?log=日志地址', W / 2, 630, '700 30px SHS', COL.missInk, 'center');
  }

  // ---------- 载入 ----------
  let loadError = '', inputs = null;
  function load(src, opts) {
    try {
      const g = SP.build(src, opts || {});
      game = g; prepare(g); loadError = '';
      window.siegeDebug = { game: g, G: G };
      return g;
    } catch (e) { loadError = '读不了这份日志：' + e.message; console.error(e); game = null; throw e; }
  }
  // 输入：window.SIEGE_INPUT = { log, names?, title? }，或 { runs: { <run>: { log, names?, title? } } }；log 是 jsonl 文本或行数组
  function inputFor(run) {
    const I = window.SIEGE_INPUT;
    if (!I) return null;
    if (I.runs) return I.runs[run] || I.runs[Object.keys(I.runs)[0]] || null;
    return I;
  }
  const params = new URLSearchParams(location.search);
  const fontsReady = Promise.all([
    document.fonts.load('800 80px Saira'), document.fonts.load('700 30px Saira'), document.fonts.load('600 26px Saira'),
    document.fonts.load('900 46px SHS', '甲乙方截胡'), document.fonts.load('700 28px SHS', '中立兵力'), document.fonts.load('500 28px SHS', '回合')
  ]).catch(() => {}).then(() => document.fonts.ready);
  function scriptLoad(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('读不到输入脚本 ' + src)); document.head.appendChild(s); });
  }
  const ready = fontsReady.then(() => {
    if (window.SIEGE_INPUT) return;
    if (params.get('input')) return scriptLoad(params.get('input'));
    if (params.get('log')) return fetch(params.get('log')).then(r => { if (!r.ok) throw new Error('读不到日志 ' + params.get('log')); return r.text(); })
      .then(s => { window.SIEGE_INPUT = { log: s, names: params.get('names') ? params.get('names').split(',') : null }; });
  }).then(() => { const I = inputFor(params.get('run')); if (I) load(I.log, I); }).catch(e => { loadError = e.message; console.error(e); });

  // ---------- 浏览：循环播放、拖动条、键盘、打开文件 ----------
  const bar = document.getElementById('vx-bar'), seek = document.getElementById('seek'), clock = document.getElementById('clock'), playBtn = document.getElementById('play');
  let exporting = false, playing = true, now = 0, last = null, raf = 0, fps = 60;
  if (params.get('t') != null) { now = +params.get('t') || 0; playing = false; }
  function fit() {
    const st = document.getElementById('stage');
    if (exporting) { st.style.transform = 'none'; return; }
    const k = Math.min(innerWidth / W, (innerHeight - 44) / H);
    st.style.transform = 'translate(' + ((innerWidth - W * k) / 2).toFixed(1) + 'px,0) scale(' + k + ')';
  }
  function showBar() {
    playBtn.textContent = playing ? '暂停' : '播放';
    if (!game) { clock.textContent = '—'; return; }
    const T = G.seconds, loc = SP.locate(game.timeline, Math.min(now, T));
    seek.value = Math.round(Math.min(now, T) / T * 10000);
    clock.textContent = Math.min(now, T).toFixed(2) + ' / ' + T.toFixed(2) + ' 秒 · ' + (loc.i < 0 ? '开局' : '第 ' + game.turns[loc.i].turn + ' 回合');
  }
  function tick(ts) {
    if (exporting) return;
    if (playing && game && last != null) { now += (ts - last) / 1000; if (now > G.seconds + 1) now = 0; }
    last = ts;
    render(game ? Math.min(now, G.seconds) : 0);
    showBar();
    raf = requestAnimationFrame(tick);
  }
  function startLoop() { cancelAnimationFrame(raf); last = null; raf = requestAnimationFrame(tick); }
  seek.addEventListener('input', () => { if (game) now = seek.value / 10000 * G.seconds; });
  playBtn.addEventListener('click', () => { playing = !playing; if (game && now >= G.seconds) now = 0; });
  addEventListener('keydown', e => {
    if (exporting || !game) return;
    if (e.code === 'Space') { playing = !playing; e.preventDefault(); }
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const d = (e.shiftKey ? 1 : 1 / fps) * (e.code === 'ArrowLeft' ? -1 : 1);
      playing = false; now = clamp(Math.round((now + d) * fps) / fps, 0, G.seconds); e.preventDefault();
    }
  });
  function openText(s, name) {
    try { load(s, { names: null, title: '' }); now = 0; playing = true; document.title = '攻城略地对局回放 · ' + name; }
    catch (e) { /* 错误写在画面上 */ }
  }
  const fileIn = document.getElementById('file');
  document.getElementById('open').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => { const f = fileIn.files[0]; if (f) f.text().then(s => openText(s, f.name)); fileIn.value = ''; });
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drag'); });
  addEventListener('dragleave', () => document.body.classList.remove('drag'));
  addEventListener('drop', e => {
    e.preventDefault(); document.body.classList.remove('drag');
    const f = e.dataTransfer.files[0]; if (f) f.text().then(s => openText(s, f.name));
  });
  addEventListener('resize', fit);
  fit();
  ready.then(startLoop);

  // ---------- 逐帧导出 ----------
  // 静止区间：高光定格（冲击环、标签进场都已结束）和结果卡出完以后，画面逐像素不变
  function holds() {
    const tl = game.timeline, out = [], f = 1 / fps;
    tl.segs.forEach(s => {
      if (s.kind === 'hold' && s.t1 - s.t0 > 1.0) out.push([+(s.t0 + 0.8).toFixed(4), +(s.t1 - f).toFixed(4)]);
      if (s.kind === 'outro' && s.t1 - s.t0 > 0.8) out.push([+(s.t0 + 0.6).toFixed(4), +s.t1.toFixed(4)]);
    });
    return out;
  }
  window.videoExport = {
    begin(run, opts) {
      exporting = true; cancelAnimationFrame(raf);
      fps = (opts && opts.fps) || 60;
      bar.style.display = 'none'; fit();
      return ready.then(() => {
        const I = inputFor(run);
        if (I && (!game || (window.SIEGE_INPUT && window.SIEGE_INPUT.runs))) load(I.log, I);
        if (!game) throw new Error(loadError || '没有对局日志：先注入 window.SIEGE_INPUT 或在地址里给 ?input= / ?log=');
        render(0);
        const tl = game.timeline, r = game.result;
        return {
          frames: Math.round(G.seconds * fps), seconds: G.seconds, run: run, holds: holds(),
          cues: [{ t: tl.segs[0].t1, kind: 'turns' }].concat(G.hls.map(hl => ({ t: +hl.tShow.toFixed(4), kind: 'highlight', type: hl.h.type, turn: game.turns[hl.h.turn].turn })),
            [{ t: +tl.outroAt.toFixed(4), kind: 'result' }]),
          names: game.names, seed: game.header.seed, nodes: game.N, turns: game.turns.length,
          result: r ? { winner: r.winner, reason: r.reason, totals: r.totals } : null,
          highlights: G.hls.map(hl => ({ type: hl.h.type, tag: hl.h.text.tag, line: hl.h.text.line, turn: game.turns[hl.h.turn].turn, from: game.turns[hl.h.from].turn,
            nodes: hl.h.nodes, t: +hl.tShow.toFixed(4) })),
          pace: tl.pace, flowScale: +tl.flowScale.toFixed(4)
        };
      });
    },
    frame(n) {
      render(n / fps);
      return new Promise(r => requestAnimationFrame(() => r()));
    },
    end() { exporting = false; bar.style.display = ''; fit(); startLoop(); }
  };
  window.siegeRender = t => render(t);
})();
