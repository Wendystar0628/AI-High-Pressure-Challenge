'use strict';
// ============ 默认示例：「锻字」（15 秒） ============
// 全部由普通图层、关键帧、表达式、节点与模拟设置构成，可在编辑器中定位与修改。
const Demo = {
  CHAR: '永',
  // 关键帧助手：list = [[t, v, mode]]；mode：e 缓动 / eo 缓出 / ei 缓入 / h 定格 / l 线性 / {in,out}
  K(p, list, spatial) {
    p.k = [];
    for (const [t, v, m] of list) {
      const k = Anim.addKey(p, t, v, spatial); k.ii = k.oi = 'linear';
      if (m === 'e') Anim.easyEase(p, k, 'both');
      else if (m === 'eo') Anim.easyEase(p, k, 'out');
      else if (m === 'ei') Anim.easyEase(p, k, 'in');
      else if (m === 'h') k.oi = 'hold';
      else if (m && typeof m === 'object') { if (m.in) { k.ii = 'bezier'; k.ei = m.in; } if (m.out) { k.oi = 'bezier'; k.eo = m.out; } if (m.sp) k.sp = m.sp; }
    }
    return p;
  },
  build() {
    Model._id = 1;
    const P = { version: 1, name: '锻字', comps: [], activeComp: null };
    const W = 1920, H = 1080, D = 15;
    // ---------- 预合成：米字格 ----------
    const grid = Model.newComp('米字格', W, H, 30, D); grid.bg = [0, 0, 0];
    {
      const S = Model.newLayer('shape', grid, '格线'); S.tr.position.v = [960, 540, 0];
      const g = Model.newShapeItem('group', { name: '格' }); const s = 360; const lines = [];
      lines.push(Geo2D.rect(0, 0, s * 2, s * 2));
      lines.push(Geo2D.contour([[-s, 0], [s, 0]], false), Geo2D.contour([[0, -s], [0, s]], false), Geo2D.contour([[-s, -s], [s, s]], false), Geo2D.contour([[s, -s], [-s, s]], false));
      lines.forEach((c, i) => g.items.push(Model.newShapeItem('path', { name: '线 ' + (i + 1), path: { c: [c] } })));
      const st = Model.newShapeItem('stroke', { width: 2.2, color: [0.62, 0.16, 0.09] }); st.cap = 'butt';
      const tr = Model.newShapeItem('trim'); tr.mode = 'indiv'; this.K(tr.end, [[0, 22, 'eo'], [1.1, 100, 'e']]);
      g.items.push(tr, st); S.contents.push(g);
      const out = Model.newShapeItem('group', { name: '外框' }); out.items.push(Model.newShapeItem('rect', { size: [s * 2 + 26, s * 2 + 26] })); const st2 = Model.newShapeItem('stroke', { width: 5, color: [0.7, 0.2, 0.1] }); out.items.push(st2); S.contents.push(out);
      this.K(S.tr.scale, [[0, [104, 104, 100], 'eo'], [1.2, [100, 100, 100], 'e']]);
      grid.layers.push(S);
    }
    // ---------- 主合成 ----------
    const C = Model.newComp('锻字 · 主合成', W, H, 30, D); C.bg = [0.03, 0.028, 0.03];
    C.mb = { on: true, angle: 200, phase: -100, samples: 8 }; C.env = { preset: 'forge', intensity: 1.0, rotation: 0 };
    const L = {}; const add = (type, name) => { const l = Model.newLayer(type, C, name); l.inPoint = 0; l.outPoint = D; C.layers.push(l); L[name] = l; return l; };
    const ctrPos = [960, 540, 0];
    const textPos = [960, 772, 0];       // 基线位置：字形中心约在画面中心
    const strike = [962, 566, -82];      // 锤击点（字块前表面附近，世界坐标）
    const T1 = 7.0, T2 = 8.3, T3 = 9.6;  // 三次锤击

    // 1 暗角
    { const l = add('shape', '暗角'); l.tr.position.v = [0, 0, 0]; l.blendMode = 'multiply'; const g = Model.newShapeItem('group', { name: '暗角' }); g.items.push(Model.newShapeItem('rect', { size: [W, H], pos: [W / 2, H / 2] })); const gf = Model.newShapeItem('gfill', { gtype: 'radial', start: [960, 560], end: [960 + 1150, 560], c1: [1, 1, 1], c2: [0.18, 0.16, 0.15] }); g.items.push(gf); l.contents.push(g); }
    // 2 辉光（调整图层）
    { const l = add('adjustment', '辉光'); const e = Model.newEffect('glow'); e.p.threshold.v = 52; e.p.radius.v = 46; e.p.intensity.v = 0.95; e.p.tint.v = [1, 0.78, 0.55]; l.effects.push(e); }
    // 3 控制器
    const ctl = add('null', '控制器'); ctl.tr.position.v = [120, 120, 0];
    { const e = Model.newEffect('slider'); e.name = '温度'; this.K(e.p.value, [[0, 0.85], [3.3, 0.85, 'e'], [4.4, 1, 'e'], [11.0, 1, 'e'], [12.6, 0.42, { in: { s: -0.35, f: 40 }, out: { s: -0.35, f: 40 } }], [14.2, 0, 'e']]); ctl.effects.push(e); }
    { const e = Model.newEffect('slider'); e.name = '震动'; const ks = [[0, 0]]; for (const [T, a] of [[T1, 0.65], [T2, 0.8], [T3, 1.25]]) ks.push([T - 0.01, 0, 'h'], [T, a, 'eo'], [T + (T === T3 ? 0.55 : 0.36), 0, 'e']); this.K(e.p.value, ks); ctl.effects.push(e); }
    // 4 摄像机
    const cam = add('camera', '主摄像机'); cam.cam.dof = true; cam.motionBlur = true;
    const orbit = (yaw, pitch, R, poi) => [poi[0] + R * Math.sin(U.rad(yaw)) * Math.cos(U.rad(pitch)), poi[1] - R * Math.sin(U.rad(pitch)), poi[2] - R * Math.cos(U.rad(yaw)) * Math.cos(U.rad(pitch))];
    const poiB = [960, 548, 0], poiS = [strike[0], strike[1], strike[2] + 40];
    this.K(cam.tr.position, [
      [0, orbit(0, 0, 2620, poiB)], [3.4, orbit(0, 0.5, 2420, poiB), { in: { s: 30, f: 40 }, out: { s: 30, f: 40 } }],
      [4.7, orbit(-17, 6, 2350, poiB)], [6.1, orbit(-30, 11, 2280, poiB), 'e'],
      [6.9, orbit(-28, 9, 1900, poiS)], [8.2, orbit(-24, 8, 1640, poiS)], [9.45, orbit(-21, 7, 1380, poiS), 'e'],
      [10.6, orbit(-20, 8, 1460, poiS), 'e'], [12.4, orbit(-14, 9, 2050, poiB)], [14.2, orbit(-11, 7, 2330, poiB), 'e'],
    ], true);
    this.K(cam.cam.poi, [[0, poiB], [6.1, poiB, 'e'], [6.9, poiS, 'e'], [10.6, poiS, 'e'], [12.6, poiB, 'e'], [14.2, poiB, 'e']], true);
    cam.tr.position.x = 'var s = thisComp.layer("控制器").effect("震动")("滑块");\nadd(value, [Math.sin(time*97)*s*16, Math.cos(time*83)*s*12, Math.sin(time*61)*s*8])'; cam.tr.position.xOn = true;
    cam.cam.focus.x = 'length(thisLayer.transform.position, thisLayer.cameraOption.pointOfInterest)'; cam.cam.focus.xOn = true;
    this.K(cam.cam.aperture, [[0, 0], [5.6, 0, 'e'], [6.9, 16, 'e'], [10.8, 18, 'e'], [12.6, 6, 'e'], [14.2, 4, 'e']]);
    // 5 灯光
    const key = add('light', '主光'); key.light.kind = 'parallel'; key.light.color.v = [1, 0.92, 0.82]; key.light.intensity.v = 115; key.tr.position.v = [180, -820, -1300]; key.light.poi.v = [980, 620, 40]; key.light.darkness.v = 88; key.light.softness.v = 2.5;
    const fire = add('light', '炉火光'); fire.light.kind = 'point'; fire.light.shadows = false; fire.light.color.v = [1, 0.46, 0.15]; fire.tr.position.v = [1180, 760, -560];
    fire.light.intensity.x = 'var T = thisComp.layer("控制器").effect("温度")("滑块");\nvar s = thisComp.layer("控制器").effect("震动")("滑块");\n30 + T*95 + s*260 + (wiggle(7, 1) - value)*T*22'; fire.light.intensity.xOn = true; fire.light.intensity.v = 100;
    // 6 锤（空对象 + 锤头 + 锤柄）
    const ham = add('null', '锤'); ham.threeD = true; ham.motionBlur = true; ham.inPoint = 6.0; ham.outPoint = 10.9;
    const I = [strike[0] + 6, strike[1], strike[2] - 85 - 3];
    const rest0 = [1520, -520, -900], top = (h) => [1070 + h * 30, 150 - h * 70, -660 - h * 60], reb = (h) => [I[0] + 20, I[1] - 70 - h * 30, I[2] - 120 - h * 40];
    this.K(ham.tr.position, [
      [6.0, rest0], [6.62, top(0), 'e'], [6.86, top(0.5), { in: { s: 0, f: 50 }, out: { s: 0, f: 75 } }], [T1, I, { in: { s: 4200, f: 20 }, out: { s: 900, f: 30 } }], [T1 + 0.2, reb(0), 'e'],
      [7.75, top(0.3), 'e'], [8.15, top(0.8), { in: { s: 0, f: 50 }, out: { s: 0, f: 75 } }], [T2, I, { in: { s: 4600, f: 20 }, out: { s: 900, f: 30 } }], [T2 + 0.2, reb(0.3), 'e'],
      [9.0, top(1.2), 'e'], [9.42, top(1.7), { in: { s: 0, f: 50 }, out: { s: 0, f: 80 } }], [T3, I, { in: { s: 5600, f: 18 }, out: { s: 1000, f: 30 } }], [T3 + 0.28, reb(1), 'e'],
      [10.1, top(1), 'e'], [10.85, rest0, 'e'],
    ], true);
    this.K(ham.tr.rotX, [[6.0, -70], [6.62, -52, 'e'], [6.86, -62, { in: { s: 0, f: 50 }, out: { s: 0, f: 75 } }], [T1, 0, { in: { s: 420, f: 20 } }], [T1 + 0.2, -14, 'e'], [7.75, -50, 'e'], [8.15, -68, { in: { s: 0, f: 50 }, out: { s: 0, f: 75 } }], [T2, 0, { in: { s: 480, f: 20 } }], [T2 + 0.2, -16, 'e'], [9.0, -60, 'e'], [9.42, -82, { in: { s: 0, f: 50 }, out: { s: 0, f: 80 } }], [T3, 0, { in: { s: 600, f: 18 } }], [T3 + 0.28, -20, 'e'], [10.1, -45, 'e'], [10.85, -70, 'e']]);
    this.K(ham.tr.rotY, [[6.0, 18], [T1, 8, 'e'], [T3, 6, 'e'], [10.85, 18, 'e']]);
    const head = add('geo', '锤头'); head.parent = ham.id; head.inPoint = 6.0; head.outPoint = 10.9; head.geo.src = 'box'; head.geo.dims.v = [250, 175, 175]; head.tr.position.v = [0, 0, 0]; head.motionBlur = true;
    Object.assign(head.mat, { base: Model.P([0.42, 0.41, 0.4]), metal: Model.P(1), rough: Model.P(0.32), emit: Model.P([1, 0.4, 0.1]), emitStr: Model.P(0), opacity: Model.P(100) });
    const handle = add('geo', '锤柄'); handle.parent = ham.id; handle.inPoint = 6.0; handle.outPoint = 10.9; handle.geo.src = 'cylinder'; handle.geo.dims.v = [46, 620, 46]; handle.tr.position.v = [0, -390, 0]; handle.motionBlur = true;
    Object.assign(handle.mat, { base: Model.P([0.24, 0.14, 0.08]), metal: Model.P(0), rough: Model.P(0.62), emit: Model.P([0, 0, 0]), emitStr: Model.P(0), opacity: Model.P(100) });
    // 7 粒子：火星
    const sp = add('particles', '火星'); sp.inPoint = 6.0;
    { const S = sp.ps; S.seed = 11; S.max = 3000; const em = S.emitters[0]; em.kind = 'geometry'; em.name = '锤击点'; em.useNormal = true;
      const rk = [[0, 0, 'h']]; for (const [T, r] of [[T1, 5200], [T2, 6200], [T3, 9800]]) rk.push([T - 0.001, 0, 'h'], [T, r, 'h'], [T + 0.055, r * 0.25, 'h'], [T + 0.11, 0, 'h']);
      this.K(em.rate, rk); em.speed.v = 980; em.speedRand.v = 45; em.spread.v = 62; em.dir.v = [0, -0.35, -1]; em.life.v = 1.0; em.lifeRand.v = 45; em.sizeRand.v = 55; em.inherit.v = 0;
      S.gravity.v = [0, 1500, 0]; S.drag.v = 0.55; S.fieldStrength.v = 0;
      S.collide.ground = true; S.collide.groundY.v = 806; S.collide.bounce.v = 0.42; S.collide.friction.v = 0.35; S.collide.onHit = 'both'; S.collide.hitColor.v = [1, 0.95, 0.75]; S.collide.hitLife.v = 55; S.collide.subCount = 1; S.collide.subSpeed.v = 230;
      S.look.size.v = 9; S.look.sizeEnd.v = 1.5; S.look.c0.v = [1, 0.93, 0.66]; S.look.c1.v = [1, 0.3, 0.04]; S.look.op0.v = 100; S.look.op1.v = 0; S.look.glow.v = 2.4;
      S.trail.on = true; S.trail.length.v = 0.1; S.trail.width.v = 3.2; S.trail.color.v = [1, 0.62, 0.25]; S.trail.fade.v = 100; }
    // 8 余烬（背景微粒，受噪声场影响）
    const emb = add('particles', '余烬');
    { const S = emb.ps; S.seed = 3; S.max = 400; const em = S.emitters[0]; em.name = '炉底'; em.pos.v = [960, 900, 420]; em.dir.v = [0, -1, 0]; em.spread.v = 75; em.speed.v = 120; em.speedRand.v = 60; em.life.v = 4.2; em.lifeRand.v = 35; em.sizeRand.v = 60;
      this.K(em.rate, [[0, 7], [6, 9, 'e'], [9.8, 14, 'e'], [11.5, 3, 'e'], [12.4, 0, 'e']]);
      S.gravity.v = [0, -55, 0]; S.drag.v = 0.25; S.collide.ground = false;
      S.look.size.v = 4.5; S.look.sizeEnd.v = 0.5; S.look.c0.v = [1, 0.72, 0.35]; S.look.c1.v = [0.9, 0.22, 0.04]; S.look.op0.v = 55; S.look.op1.v = 0; S.look.glow.v = 1.5;
      // 预热：从 -3 秒开始模拟，使第 0 帧已有余烬
      emb.inPoint = 0; emb.startTime = 0; S.prewarm = 3; }
    // 9 字块（节点网络生成的三维几何）
    const blk = add('geo', '字块'); blk.geo.src = 'nodes'; blk.tr.position.v = textPos.slice(); blk.inPoint = 3.45;
    blk.mat.base.v = [0.3, 0.28, 0.27];
    blk.mat.base.x = 'var T = thisComp.layer("控制器").effect("温度")("滑块");\nlinear(T, 0, 1, [0.66, 0.64, 0.62], [0.30, 0.27, 0.25])'; blk.mat.base.xOn = true;
    blk.mat.metal.v = 1;
    blk.mat.rough.x = 'linear(thisComp.layer("控制器").effect("温度")("滑块"), 0, 1, 0.2, 0.48)'; blk.mat.rough.xOn = true;
    this.K(blk.mat.emit, [[0, [1, 0.5, 0.16]], [11.0, [1, 0.5, 0.16], 'e'], [12.8, [0.95, 0.18, 0.04], 'e'], [14.2, [0.6, 0.05, 0.02], 'e']]);
    blk.mat.emitStr.x = 'var c = thisComp.layer("控制器");\nvar T = c.effect("温度")("滑块");\nT*T*2.4 + c.effect("震动")("滑块")*1.6'; blk.mat.emitStr.xOn = true;
    // 10 地面
    const gnd = add('geo', '地面'); gnd.geo.src = 'ground'; gnd.geo.dims.v = [5200, 1, 5200]; gnd.tr.position.v = [960, 806, 900]; gnd.castShadow = false;
    Object.assign(gnd.mat, { base: Model.P([0.06, 0.055, 0.05]), metal: Model.P(0.55), rough: Model.P(0.58), emit: Model.P([0, 0, 0]), emitStr: Model.P(0), opacity: Model.P(100) });
    // 11 场
    const hf = add('field', '锤击场'); hf.field.kind = 'radial'; hf.tr.position.v = strike.slice(); hf.field.radius.v = 135; hf.field.falloff.v = 78; hf.field.strength.v = 100;
    const heatF = add('field', '热浪'); heatF.field.kind = 'noise'; heatF.tr.position.v = [960, 600, 300]; heatF.field.radius.v = 900; heatF.field.scale.v = 260; heatF.field.speed.v = 0.6; heatF.field.strength.v = 100;
    // 12 文字（书写）
    const tx = add('text', '字源'); tx.tr.position.v = textPos.slice(); tx.outPoint = 4.2;
    Object.assign(tx.text, { font: 'duan', align: 'center', fillOn: true });
    tx.text.source.v = this.CHAR; tx.text.size.v = 620; tx.text.fill.v = [1, 0.6, 0.22];
    tx.text.write.on = true; this.K(tx.text.write.progress, [[0, 5], [3.25, 100]]); this.K(tx.text.write.brush, [[0, 1.12], [3.2, 1.0, 'e']]);
    this.K(tx.tr.opacity, [[3.45, 100], [3.95, 0, 'e']]);
    { const e = Model.newEffect('glow'); e.p.threshold.v = 20; e.p.radius.v = 26; e.p.intensity.v = 0.9; e.p.tint.v = [1, 0.7, 0.4]; tx.effects.push(e); }
    // 13 米字格（预合成引用）
    const gl = add('precomp', '米字格'); gl.pre.compId = grid.id; gl.tr.anchor.v = [960, 540, 0]; gl.tr.position.v = [960, 548, 0]; gl.outPoint = 4.4;
    this.K(gl.tr.opacity, [[0, 70], [3.2, 60, 'e'], [4.2, 0, 'e']]);
    // 14 背景
    { const l = add('shape', '背景'); l.tr.position.v = [0, 0, 0]; const g = Model.newShapeItem('group', { name: '炉膛' }); g.items.push(Model.newShapeItem('rect', { size: [W, H], pos: [W / 2, H / 2] })); g.items.push(Model.newShapeItem('gfill', { gtype: 'radial', start: [960, 640], end: [960, 640 + 1250], c1: [0.13, 0.075, 0.05], c2: [0.012, 0.012, 0.016] })); l.contents.push(g); }
    // 图层顺序（上 → 下）：二维文字与格线在三维组之上，背景在最下
    const order = ['暗角', '辉光', '控制器', '主摄像机', '主光', '炉火光', '字源', '米字格', '锤', '锤头', '锤柄', '火星', '余烬', '字块', '地面', '锤击场', '热浪', '背景'];
    C.layers = order.map(n => L[n]);
    // ---------- 节点网络 ----------
    const G = C.graph; const N = (type, x, y, p = {}) => { const n = NodeEval.newNode(type, x, y); for (const k in p) n.p[k] = p[k]; G.nodes.push(n); return n; };
    const link = (a, ao, b, bi) => G.links.push({ id: Model.nid(), from: a.id, fo: ao, to: b.id, ti: bi });
    const nText = N('textOutline', 20, 30, { layer: tx.id, center: false });
    const nEx = N('extrude', 230, 20); this.K(nEx.p.depth, [[3.45, 1.5], [3.7, 8, { out: { s: 20, f: 40 } }], [5.4, 150, 'e']]); this.K(nEx.p.bevel, [[3.45, 0], [4.0, 3, 'e'], [5.6, 11, 'e']]); nEx.p.segs = 3; nEx.p.spacing = 9;
    const nHF = N('fieldLayer', 230, 300, { layer: hf.id });
    const nDef = N('fieldDeform', 470, 40, { mode: 'axis', space: blk.id }); nDef.p.axis.v = [0, 0, 1];
    this.K(nDef.p.amount, [[0, 0, 'h'], [T1 - 0.005, 0], [T1 + 0.04, 20, 'eo'], [T2 - 0.005, 20], [T2 + 0.04, 38, 'eo'], [T3 - 0.005, 38], [T3 + 0.05, 60, 'eo']]);
    const nHeat = N('heat', 710, 40, { space: blk.id, base: 1 });
    this.K(nHeat.p.amount, [[0, 0, 'h'], [T1 - 0.005, 0], [T1 + 0.03, 2.6, 'eo'], [T2 - 0.005, 0.9, 'e'], [T2 + 0.03, 3, 'eo'], [T3 - 0.005, 1.1, 'e'], [T3 + 0.03, 4, 'eo'], [11.5, 1.2, 'e'], [13.6, 0, 'e']]);
    const nShow = N('display', 950, 40, { layer: blk.id });
    const nEm = N('emitter', 710, 250, { layer: sp.id, em: 0, space: blk.id });
    const nCol = N('collider', 710, 400, { layer: sp.id, space: blk.id });
    const nPF = N('particleField', 470, 330, { layer: sp.id }); { const ks = [[0, 0, 'h']]; for (const T of [T1, T2, T3]) ks.push([T - 0.001, 0, 'h'], [T, 2600, 'eo'], [T + 0.16, 0]); this.K(nPF.p.strength, ks); }
    const nNoise = N('fieldLayer', 230, 440, { layer: heatF.id });
    const nPF2 = N('particleField', 470, 470, { layer: emb.id }); nPF2.p.strength.v = 140;
    link(nText, 'geo', nEx, 'geo'); link(nEx, 'geo', nDef, 'geo'); link(nHF, 'field', nDef, 'field'); link(nDef, 'geo', nHeat, 'geo'); link(nHF, 'field', nHeat, 'field'); link(nHeat, 'geo', nShow, 'geo');
    link(nDef, 'geo', nEm, 'geo'); link(nHF, 'field', nEm, 'field'); link(nDef, 'geo', nCol, 'geo'); link(nHF, 'field', nPF, 'field'); link(nNoise, 'field', nPF2, 'field');
    // ---------- 音色图层（配乐与音效） ----------
    const syn = (name, preset, notes, o = {}) => { const l = Model.newLayer('synth', C, name); l.synth.preset = preset; l.synth.notes = notes; if (o.vol !== undefined) l.synth.vol.v = o.vol; if (o.decay) l.synth.decay.v = o.decay; if (o.bright !== undefined) l.synth.bright.v = o.bright; if (o.pitch) l.synth.pitch.v = o.pitch; C.layers.push(l); return l; };
    // 书写音：每一笔起笔处一声（五声音阶）
    const strokeTimes = this.strokeStarts(tx, C);
    const scale = [62, 64, 67, 69, 72, 74, 76, 79];
    syn('书写·清钟', 'bell', strokeTimes.map((t, i) => ({ t: +t.toFixed(3), n: scale[i % scale.length], v: 0.55, d: 1.2 })), { vol: -8, decay: 1.2, bright: 35 });
    syn('炉火低鸣', 'drone', [{ t: 0, n: 38, v: 0.8, d: 6.6 }, { t: 6.2, n: 38, v: 1, d: 5.2 }, { t: 11.0, n: 33, v: 0.9, d: 4.0 }], { vol: -6, bright: 30 });
    syn('成形·大鼓', 'drum', [{ t: 3.5, n: 40, v: 0.9 }, { t: 5.35, n: 36, v: 1 }], { vol: -2, decay: 1.4 });
    syn('挥锤风声', 'whoosh', [{ t: 6.7, n: 60, v: 0.6, d: 0.3 }, { t: 7.98, n: 60, v: 0.7, d: 0.32 }, { t: 9.2, n: 60, v: 0.9, d: 0.4 }], { vol: -6, bright: 40 });
    syn('锻锤重击', 'hammer', [{ t: T1, n: 40, v: 0.75 }, { t: T2, n: 40, v: 0.85 }, { t: T3, n: 37, v: 1.15 }], { vol: 0, decay: 1.2, bright: 60 });
    syn('铁砧鸣响', 'anvil', [{ t: T1, n: 76, v: 0.5 }, { t: T2, n: 76, v: 0.6 }, { t: T3, n: 74, v: 0.85 }], { vol: -4, decay: 1.3, bright: 55 });
    syn('火星噼啪', 'spark', [{ t: T1 + 0.02, n: 60, v: 0.5, d: 0.9 }, { t: T2 + 0.02, n: 60, v: 0.6, d: 0.9 }, { t: T3 + 0.02, n: 60, v: 0.9, d: 1.5 }], { vol: -6, bright: 60 });
    syn('淬火嘶声', 'hiss', [{ t: 11.1, n: 60, v: 0.6, d: 2.8 }], { vol: -9, decay: 2.2, bright: 40 });
    syn('定型·余音', 'bell', [{ t: 13.6, n: 50, v: 0.7, d: 3 }, { t: 13.62, n: 57, v: 0.45, d: 3 }], { vol: -8, decay: 2.2, bright: 25 });
    P.comps.push(C, grid); P.activeComp = C.id;
    return P;
  },
  // 依据书写进度关键帧推算每笔起笔时间
  strokeStarts(tx, comp) {
    const out = [];
    const L = TextL.layout(comp, tx, 0); const list = [];
    for (const c of L.chars) { if (c.space) continue; if (c.g.strokes) c.g.strokes.forEach(s => { const b = DuanFont.brush(s); list.push(b.len + 140); }); else list.push(900); }
    const tot = list.reduce((a, b) => a + b, 0) || 1; let acc = 0;
    const k = tx.text.write.progress.k; const p0 = k[0].v / 100, p1 = k[k.length - 1].v / 100, t0 = k[0].t, t1 = k[k.length - 1].t;
    for (const w of list) { const a = acc / tot; acc += w; const t = a <= p0 ? 0.05 : t0 + (a - p0) / (p1 - p0) * (t1 - t0); out.push(Math.max(0.05, t)); }
    return out;
  },
};
