// 15 秒默认示例《流形》：用与空工程相同的图层、关键帧、表达式、节点、材质与模拟设置构建
// 段落：① 0–3s 线→形（修剪/形变/布尔/文字）② 3–6.5s 形→体（挤出/镜头近景到整体/光影）
//       ③ 6.5–10.5s 场与粒子（旋涡场/扭转/表面发射/碰撞事件/拖尾/焦点转移）④ 9–12.5s 实例与时间（预合成实例/回声/时间置换/倒放/定格）⑤ 12.5–15s 收束
(function (G) {
  'use strict';
  const AE = G.AE, M = AE.Model, P = AE.Path, U = AE.U, N = AE.Nodes;
  const Demo = AE.Demo = {};
  const C = { bg0: '#070a12', bg1: '#141a2e', amber: '#ff9f43', gold: '#ffc27a', cyan: '#4cc9f0', pink: '#ff5d8f', white: '#f4f1ea', ink: '#0b0f1a' };
  const col = (h, a = 1) => { const c = U.hex(h); c[3] = a; return c; };
  // 关键帧：[[t, v, flags]]；flags: e 缓入缓出, i 缓入, o 缓出, h 定格, l 线性, s 空间直线, b 自动贝塞尔
  function K(prop, list) {
    prop.anim = true;
    prop.keys = list.map(([t, v, f, x]) => {
      const k = M.key(t, v);
      f = f || '';
      if (f.includes('e')) AE.Anim.applyEase(k, 'easy');
      if (f.includes('i')) AE.Anim.applyEase(k, 'in');
      if (f.includes('o')) AE.Anim.applyEase(k, 'out');
      if (f.includes('h')) k.oi = 'hold';
      if (f.includes('s')) k.sp = 'linear';
      if (f.includes('b')) { k.ii = k.oi = 'bezier'; k.auto = true; }
      if (x) Object.assign(k, x);
      return k;
    });
    return prop;
  }
  const ex = (prop, src) => { prop.expr = src; prop.exprOn = true; return prop; };
  const pos = (l, p) => { l.transform.position.value = p.length === 2 ? [p[0], p[1], 0] : p; return l; };

  // 水滴形徽标外轮廓（贝塞尔）
  function dropShape(r) {
    const k = r * 0.5523;
    return [P.contour([[0, -r * 1.32], [r, 0], [0, r], [-r, 0]], [[0, 0], [0, -k * 1.15], [k, 0], [0, k]], [[r * 0.28, r * 0.42], [0, k], [-k, 0], [0, -k * 1.1]], true)];
  }

  Demo.build = () => {
    const proj = M.newProject(); proj.name = '流形 · 示例'; proj.seed = 20261103;
    const comp = M.newComp({ name: '流形 · 主合成', width: 1920, height: 1080, fps: 30, duration: 15, bg: col(C.bg0) });
    comp.motionBlur = { on: true, angle: 180, phase: -90, samples: 6 };
    comp.env = { intensity: 0.75, top: [0.2, 0.25, 0.4], horizon: [0.42, 0.36, 0.38], ground: [0.04, 0.04, 0.06], boxes: [{ dir: [-0.55, -0.8, -0.4], size: 0.42, color: [1, 0.94, 0.86], k: 3.0 }, { dir: [0.85, -0.25, 0.35], size: 0.2, color: [0.45, 0.78, 1], k: 2.4 }, { dir: [0.05, -0.15, -1], size: 0.15, color: [1, 0.6, 0.35], k: 1.5 }] };
    comp.markers = [{ t: 0, label: '① 线 → 形', color: '#ff9f43' }, { t: 3, label: '② 形 → 体', color: '#4cc9f0' }, { t: 6.5, label: '③ 场与粒子', color: '#ff5d8f' }, { t: 9.5, label: '④ 实例与时间', color: '#9b8cff' }, { t: 12.5, label: '⑤ 收束', color: '#3ecf8e' }];
    proj.comps.push(comp); proj.mainComp = comp.id;
    const L = []; // 自上而下
    const add = (l) => { L.push(l); return l; };
    const W = comp.width, H = comp.height;

    // ======================= 嵌套预合成：刻度单元 → 光环单元 =======================
    const tick = M.newComp({ name: '刻度单元', width: 300, height: 300, fps: 30, duration: 6, bg: [0, 0, 0, 0] });
    {
      const s = M.newShapeLayer(tick, '刻度', [M.shape.group('刻度组', [M.shape.rect(6, 26, 3, [0, -110]), M.shape.fill(col(C.white, 0.9)), Object.assign(M.shape.repeater(24), {})])]);
      const rep = s.content[0].items[2]; rep.transform.position.value = [0, 0]; rep.transform.rotation.value = 15; rep.transform.startOpacity.value = 100; rep.transform.endOpacity.value = 15;
      pos(s, [150, 150]); K(s.transform.rotation, [[0, 0, 'l'], [6, 180, 'l']]);
      tick.layers.push(s);
    }
    const ring = M.newComp({ name: '光环单元', width: 600, height: 600, fps: 30, duration: 6, bg: [0, 0, 0, 0] });
    {
      const inner = M.newPrecomp(ring, tick, '刻度（嵌套）'); pos(inner, [300, 300]); inner.transform.scale.value = [140, 140, 100];
      const arc = M.newShapeLayer(ring, '光弧', [M.shape.group('光弧', [M.shape.ellipse(470, 470), M.shape.trim(0, 35, 0), M.shape.stroke(col(C.cyan), 14), M.shape.ellipse(380, 380), M.shape.stroke(col(C.cyan, 0.35), 3)])]);
      pos(arc, [300, 300]);
      const tr = arc.content[0].items[1];
      K(tr.offset, [[0, 0, 'l'], [2, 360, 'l']]); ex(tr.offset, 'loopOut("cycle")');
      K(tr.end, [[0, 20, 'e'], [1, 70, 'e'], [2, 20, 'e']]); ex(tr.end, 'loopOut("pingpong")');
      const dot = M.newShapeLayer(ring, '核心', [M.shape.group('核心', [M.shape.ellipse(60, 60), M.shape.fill(col(C.white))])]); pos(dot, [300, 300]);
      K(dot.transform.scale, [[0, [80, 80, 100], 'e'], [0.5, [130, 130, 100], 'e'], [1, [80, 80, 100], 'e']]); ex(dot.transform.scale, 'loopOut("cycle")');
      const label = M.newTextLayer(ring, 'α', { size: 64, fill: col(C.white), name: '编号' }); pos(label, [300, 470]);
      ring.layers.push(label, dot, arc, inner);
      // 公开参数：颜色与编号（各实例独立覆盖）
      ring.params.push({ id: 'pm_color', name: '光环颜色', layer: arc.id, path: 'content.0.items.2.color' }, { id: 'pm_label', name: '编号文字', layer: label.id, path: 'text.source' });
    }
    // ======================= 保留三维的预合成：晶体簇 =======================
    const cluster = M.newComp({ name: '晶体簇（保留三维）', width: 1920, height: 1080, fps: 30, duration: 15, bg: [0, 0, 0, 0] });
    {
      const icam = M.newCamera(cluster, '内部相机（保留三维时不参与投影）'); icam.transform.position.value = [960, 200, -800];
      const s1 = M.newGeo(cluster, 'sphere', '晶球 A'); pos(s1, [880, 540, 0]); s1.geo.source.radius.value = 46; s1.geo.mats.front = M.material(col('#e9eef5'), 1, 0.08);
      const s2 = M.newGeo(cluster, 'sphere', '晶球 B'); pos(s2, [1050, 500, -40]); s2.geo.source.radius.value = 30; s2.geo.mats.front = M.material(col(C.pink), 0, 0.25, { emissive: M.col(col(C.pink)), emissiveStrength: M.num(0.35) });
      const t1 = M.newGeo(cluster, 'torus', '晶环'); pos(t1, [960, 530, 0]); t1.geo.source.majorR.value = 120; t1.geo.source.minorR.value = 9; t1.geo.mats.front = M.material(col(C.gold), 1, 0.3);
      K(t1.transform.rotX, [[0, 0, 'l'], [15, 540, 'l']]); K(t1.transform.rotY, [[0, 0, 'l'], [15, 260, 'l']]);
      ex(s2.transform.position, '[960 + Math.cos(time*2.2)*150, 520 + Math.sin(time*3.1)*30, Math.sin(time*2.2)*150]');
      cluster.layers.push(icam, s1, s2, t1);
    }

    // ======================= 主合成图层 =======================
    // 调整层：发光 + 色相/饱和度，范围受羽化蒙版、不透明度、入出点限制
    const adj = add(M.newAdjust(comp, '调整 · 发光与调色'));
    { const g = M.effect('glow'); g.p.threshold.value = 80; g.p.radius.value = 30; g.p.intensity.value = 0.5; const hs = M.effect('hsl'); hs.p.sat.value = 12; hs.p.hue.value = -4; adj.effects.push(g, hs);
      const mk = M.mask([P.ellipse(960, 540, 2100, 1300)]); mk.name = '影响范围'; mk.feather.value = 240; adj.masks.push(mk);
      K(adj.transform.opacity, [[0, 55, 'e'], [6.5, 100, 'e'], [12.5, 90, 'e'], [14.5, 75, 'e']]); }
    // 暗角（正片叠底）
    const vig = add(M.newShapeLayer(comp, '暗角', [M.shape.group('暗角', [M.shape.rect(1920, 1080), Object.assign(M.shape.gfill('radial', [[0, [1, 1, 1, 1]], [0.62, [0.92, 0.9, 0.95, 1]], [1, [0.28, 0.27, 0.36, 1]]], [0, 0], [1150, 0]), {})])]));
    vig.blend = 'multiply';
    // 叠加色彩
    const wash = add(M.newShapeLayer(comp, '色彩叠加', [M.shape.group('色带', [M.shape.rect(1920, 1080), M.shape.gfill('linear', [[0, col(C.pink)], [0.5, col('#203060')], [1, col(C.amber)]], [-960, -540], [960, 540])])]));
    wash.blend = 'overlay'; wash.transform.opacity.value = 22; K(wash.transform.rotation, [[0, -6, 'e'], [15, 8, 'e']]);

    // ---------- ⑤ 收束：二维字幕、亮度遮罩擦除、Alpha 遮罩光扫 ----------
    const sweep = add(M.newShapeLayer(comp, '标题光扫', [M.shape.group('光带', [M.shape.rect(160, 900, 0), M.shape.gfill('linear', [[0, col('#ffffff', 0)], [0.5, col('#fff6e0', 1)], [1, col('#ffffff', 0)]], [-80, 0], [80, 0])])]));
    sweep.blend = 'add'; sweep.transform.rotation.value = 18; sweep.inPoint = 12.6;
    K(sweep.transform.position, [[13.1, [600, 905, 0], 'e'], [14.1, [1400, 905, 0], 'e']]);
    const titleEn = add(M.newTextLayer(comp, 'MANIFOLD', { size: 52, font: 'geo', weight: 700, fill: col(C.white), tracking: 320, name: '标题 · MANIFOLD' }));
    pos(titleEn, [960, 905]); titleEn.inPoint = 12.6;
    { const sh = M.effect('shadow'); sh.p.distance.value = 8; sh.p.softness.value = 14; sh.p.opacity.value = 70; sh.p.angle.value = 150; titleEn.effects.push(sh);
      const a = M.textAnimator('逐字入场', 'chars'); a.props.position.value = [0, 40, 0]; a.props.opacity.value = 0; a.props.scale.value = [60, 60]; a.sel.softness.value = 40;
      K(a.sel.offset, [[12.7, 0, 'o'], [13.7, 125, 'e']]); a.sel.start.value = 0; a.sel.end.value = 100;
      // 选择器从全选滑出：offset 0→100 使字符依次恢复
      titleEn.text.animators.push(a); }
    sweep.matte = { layer: titleEn.id, mode: 'alpha' };
    const subWipe = add(M.newShapeLayer(comp, '擦除渐变（亮度遮罩源）', [M.shape.group('渐变', [M.shape.rect(1400, 120), M.shape.gfill('linear', [[0, [1, 1, 1, 1]], [0.45, [1, 1, 1, 1]], [0.55, [0, 0, 0, 1]], [1, [0, 0, 0, 1]]], [-700, 0], [700, 0])])]));
    pos(subWipe, [960, 968]); subWipe.visible = false;
    K(subWipe.transform.position, [[13.0, [-400, 968, 0], 'o'], [14.2, [1500, 968, 0], 'e']]);
    const sub = add(M.newTextLayer(comp, '从路径到空间的连续变形', { size: 30, weight: 400, fill: col('#d8dde6'), tracking: 260, name: '副标题' }));
    pos(sub, [960, 970]); sub.inPoint = 12.8; sub.matte = { layer: subWipe.id, mode: 'luma' };

    // ---------- 阶段字幕（定格关键帧切换文字） ----------
    const stage = add(M.newTextLayer(comp, '01  路径', { size: 22, font: 'display', weight: 700, fill: col(C.amber), tracking: 160, align: 'left', name: '阶段字幕' }));
    pos(stage, [96, 92]);
    K(stage.text.source, [[0, '01  路径 · PATH', 'h'], [3, '02  实体 · SOLID', 'h'], [6.5, '03  场 · FIELD', 'h'], [9.5, '04  实例 · INSTANCE', 'h'], [12.5, '05  形 · FORM', 'h']]);
    { const a = M.textAnimator('切换闪入', 'chars'); a.props.opacity.value = 0; a.props.position.value = [0, -14, 0]; a.sel.softness.value = 60; a.use.scale = false; a.use.rotation = false;
      K(a.sel.offset, [[0, 35, 'o'], [0.6, 135, 'h'], [3, 0, 'o'], [3.6, 135, 'h'], [6.5, 0, 'o'], [7.1, 135, 'h'], [9.5, 0, 'o'], [10.1, 135, 'h'], [12.5, 0, 'o'], [13.1, 135, 'h']]);
      stage.text.animators.push(a); }
    const caption = add(M.newTextLayer(comp, '路径 → 布尔 → 挤出 → 场变形\n表面发射 → 碰撞事件 → 拖尾 → 实例\n预合成实例 · 回声 · 时间置换', { size: 17, weight: 400, fill: col('#9aa3b2'), leading: 1.6, align: 'left', name: '说明（按行）', tracking: 40 }));
    pos(caption, [96, 980]);
    { const a = M.textAnimator('逐行', 'lines'); a.props.opacity.value = 0; a.props.position.value = [-30, 0, 0]; a.sel.softness.value = 50; a.use.scale = false; a.use.rotation = false;
      K(a.sel.offset, [[0.3, 0, 'o'], [2.4, 130, 'e']]); caption.text.animators.push(a);
      K(caption.transform.opacity, [[0, 100], [12.2, 100, 'e'], [12.8, 0, 'e']]); }

    // ---------- ① 二维：标题“流形”、刻度环（节点组）、徽标（修剪/形变/布尔） ----------
    const title2 = add(M.newTextLayer(comp, '流形', { size: 150, weight: 700, fill: col(C.white), tracking: 60, name: '标题 · 流形（二维）' }));
    pos(title2, [1300, 520]); title2.outPoint = 3.6;
    { const sh = M.effect('shadow'); sh.p.distance.value = 10; sh.p.softness.value = 22; sh.p.opacity.value = 65; sh.p.angle.value = 135; title2.effects.push(sh);
      const a = M.textAnimator('逐字落入', 'chars'); a.props.position.value = [0, -90, 0]; a.props.rotation.value = -25; a.props.opacity.value = 0; a.sel.softness.value = 100;
      K(a.sel.offset, [[0.5, 0, 'o'], [1.8, 155, 'e']]); title2.text.animators.push(a);
      const b = M.textAnimator('离场', 'chars'); b.props.position.value = [0, 0, 0]; b.props.scale.value = [140, 140]; b.props.opacity.value = 0; b.use.rotation = false; b.sel.softness.value = 80;
      K(b.sel.end, [[2.35, -45, 'i'], [2.95, 145, 'e']]); title2.text.animators.push(b);
      const tg = M.newTextLayer(comp, 'MOTION  FIELD  FORM', { size: 26, font: 'geo', weight: 700, fill: col(C.amber), tracking: 300, name: '标语（按词）' });
      pos(tg, [1300, 640]); tg.outPoint = 3.6;
      const c = M.textAnimator('逐词', 'words'); c.props.opacity.value = 0; c.props.position.value = [0, 24, 0]; c.use.rotation = false; c.use.scale = false; c.sel.softness.value = 30;
      K(c.sel.offset, [[1.1, 0, 'o'], [2.1, 120, 'e']]); tg.text.animators.push(c);
      K(tg.transform.opacity, [[2.3, 100, 'e'], [2.75, 0, 'e']]);
      add(tg); }
    // 刻度环：由节点组“环形阵列”生成
    const tickSrc = add(M.newShapeLayer(comp, '刻度源（节点输入）', [M.shape.group('刻度', [M.shape.rect(8, 30, 4), M.shape.fill(col(C.white))])]));
    tickSrc.visible = false; pos(tickSrc, [0, 0]);
    const tickRing = add(M.newShapeLayer(comp, '刻度环（节点生成）', [M.shape.group('节点几何', [M.shape.nodeGeo('刻度环'), M.shape.fill(col(C.white, 0.85))])]));
    pos(tickRing, [0, 0]); tickRing.outPoint = 3.5;
    K(tickRing.transform.opacity, [[0, 45, 'o'], [0.8, 100, 'e'], [2.8, 100, 'e'], [3.3, 0, 'e']]);
    // 徽标（二维）
    const em2 = add(M.newShapeLayer(comp, '徽标 · 路径', [
      M.shape.group('徽标', [
        M.shape.group('外形', [M.shape.ellipse(420, 420), Object.assign(M.shape.morph(dropShape(210)), {}), M.shape.ellipse(150, 150, [-160, 175]), M.shape.merge('union')]),
        M.shape.ellipse(170, 170, [0, 22]), M.shape.merge('subtract'),
        M.shape.gfill('linear', [[0, col('#f2a654')], [0.55, col('#e2722e')], [1, col('#a83a26')]], [-150, -230], [160, 220]),
        M.shape.trim(0, 0, 0), M.shape.stroke(col(C.white), 5),
      ]),
    ]));
    pos(em2, [760, 500]);
    {
      const g = em2.content[0], outer = g.items[0], morph = outer.items[1];
      morph.samples.value = 120; morph.mapping = [{ a: 0, b: 0, offset: 0, reverse: false }];
      K(morph.progress, [[1.15, 0, 'e'], [2.15, 100, 'e', { ie: { s: 0, f: 0.6 } }]]);
      const fill = g.items[3]; K(fill.opacity, [[1.5, 0, 'o'], [2.3, 100, 'e']]);
      const trim = g.items[4]; K(trim.end, [[0, 24, 'o'], [1.25, 100, 'e']]); K(trim.offset, [[0, -90, 'l'], [1.25, 30, 'e']]);
      const st = g.items[5]; K(st.width, [[0, 5], [1.6, 5, 'e'], [2.4, 0, 'e']]);
      // 预备与过冲：先压缩，再弹出
      K(em2.transform.scale, [[0, [92, 92, 100], 'e'], [1.9, [100, 100, 100], 'e'], [2.45, [94, 94, 100], 'e'], [2.75, [106, 106, 100], 'o'], [3.0, [100, 100, 100], 'e']]);
      K(em2.transform.position, [[0, [760, 500, 0], 'e'], [2.45, [760, 500, 0], 'e'], [3.0, [960, 500, 0], 'e']]);
      K(em2.transform.opacity, [[2.95, 100], [3.08, 0]]);
      em2.outPoint = 3.2;
      em2.motionBlur = true;
    }

    // ---------- 三维场景 ----------
    // 摄像机：多级父级（镜头控制 → 摇臂 → 摄像机），关键帧 + 可复现手持感表达式
    const rig = M.newNull(comp, '镜头控制'); rig.threeD = true; pos(rig, [0, 0, 0]);
    const arm = M.newNull(comp, '镜头摇臂'); arm.threeD = true; pos(arm, [0, 0, 0]); arm.parent = rig.id;
    const cam = M.newCamera(comp, '主摄像机'); cam.parent = arm.id; cam.motionBlur = true;
    const Z0 = cam.camera.zoom.value;
    cam.camera.dof = true;
    K(cam.transform.position, [
      [0, [960, 540, -Z0], 'h'], [3.0, [960, 540, -Z0], 'i', { oi: 'bezier', oe: { s: 0, f: 0.25 } }],
      [3.25, [1010, 520, -Z0 - 120], 'e'],
      [4.1, [1290, 440, -520], 'e'],
      [6.6, [1880, 160, -1950], 'e'],
      [8.6, [1450, 120, -1700], 'b'],
      [10.4, [420, 230, -1650], 'e'],
      [12.3, [760, 330, -1950], 'e'],
      [14.2, [1180, 420, -2350], 'e'],
    ]);
    K(cam.camera.poi, [[0, [960, 540, 0], 'h'], [3.0, [960, 540, 0], 'e'], [4.1, [1150, 470, 30], 'e'], [6.6, [960, 560, 120], 'e'], [10.4, [960, 540, 60], 'e'], [12.3, [960, 520, 0], 'e'], [14.2, [930, 560, 0], 'e']]);
    ex(cam.transform.position, 'time < 3 ? value : add(value, wiggle(0.6, 14) - value)');
    // 焦点：特写对焦边缘 → 全景 → 前景粒子 → 后景徽标（焦点转移）
    cam.camera.aperture.value = 0;
    K(cam.camera.aperture, [[3.0, 0, 'e'], [3.9, 26, 'e'], [6.0, 12, 'e'], [7.2, 30, 'e'], [9.8, 24, 'e'], [12.6, 14, 'e'], [14.2, 10, 'e']]);
    // 对焦距离 = 到徽标的实际距离（跨图层引用）+ 关键帧偏移（前景粒子 → 后景徽标的焦点转移）
    K(cam.camera.focus, [[3.0, -60, 'e'], [4.1, -90, 'e'], [6.0, 0, 'e'], [7.2, -620, 'e'], [8.6, -560, 'e'], [9.6, 0, 'e'], [14.2, 0]]);
    ex(cam.camera.focus, 'length(sub(thisComp.layer("徽标控制").toWorld([0, 0, 0]), toWorld([0, 0, 0]))) + value');
    // 灯光
    const sun = M.newLight(comp, 'parallel', '主光（投影）'); sun.transform.position.value = [300, -900, -900];
    sun.light.intensity.value = 85; sun.light.color.value = col('#fff1dc'); sun.light.shadowDarkness.value = 85; sun.light.shadowDiffusion.value = 5;
    K(sun.light.poi, [[3, [960, 700, 200], 'e'], [9, [1350, 700, 300], 'e'], [12.5, [1100, 700, 0], 'e']]);
    const fillL = M.newLight(comp, 'point', '补光（青）'); fillL.light.cast = false; fillL.light.color.value = col(C.cyan); fillL.light.intensity.value = 70; fillL.light.falloffRadius.value = 1600;
    K(fillL.transform.position, [[3, [1700, 300, -500], 'e'], [9, [400, 250, -600], 'e'], [13, [1600, 350, -700], 'e']]);
    const amb = M.newLight(comp, 'ambient', '环境光'); amb.light.intensity.value = 14; amb.light.color.value = col('#aab4ff');
    // 场控制器：可移动的空对象，场中心经 toWorld 连接
    const fctl = M.newNull(comp, '场控制器'); fctl.threeD = true;
    K(fctl.transform.position, [[6.0, [1500, 380, -200], 'e'], [8.0, [980, 480, 0], 'e'], [10.5, [560, 520, 150], 'e'], [12.5, [960, 500, 0], 'e']]);
    K(fctl.transform.scale, [[5.8, [0, 0, 0], 'o'], [7.0, [100, 100, 100], 'e'], [10.6, [100, 100, 100], 'e'], [12.2, [0, 0, 0], 'e']]);
    // 场景旋转（父级）→ 徽标控制 → 徽标实体
    const sceneRot = M.newNull(comp, '场景旋转'); sceneRot.threeD = true; pos(sceneRot, [960, 500, 0]);
    K(sceneRot.transform.rotY, [[3.0, 0, 'e'], [6.6, -18, 'e'], [10.5, 22, 'e'], [14.2, 8, 'e']]);
    const emCtl = M.newNull(comp, '徽标控制'); emCtl.threeD = true; emCtl.parent = sceneRot.id; pos(emCtl, [0, 0, 0]);
    K(emCtl.transform.position, [[3.0, [0, 0, 0], 'e'], [4.2, [0, -30, 0], 'e'], [6.4, [0, -20, 0], 'e'], [6.75, [0, -60, 0], 'o'], [7.6, [0, -10, 0], 'e'], [12.4, [0, -10, 0], 'e'], [13.0, [0, -140, 0], 'o'], [13.6, [0, -100, 0], 'e']]);
    K(emCtl.transform.rotation, [[3, 0, 'e'], [14.2, 0, 'e']]);
    // 徽标实体：挤出（前面/侧壁/倒角/背面分区材质），扭转 + 场变形
    const em3 = M.newGeo(comp, 'extrude', '徽标 · 实体'); em3.parent = emCtl.id; pos(em3, [0, 0, 0]);
    em3.geo.source.from.layer = em2.id; em3.geo.source.depth.value = 110; em3.geo.source.bevel.value = 16; em3.geo.source.bevelSegs = 5;
    em3.inPoint = 2.95; em3.motionBlur = true;
    em3.geo.mats.front = M.material(col('#d98a3a'), 0.8, 0.4);
    em3.geo.mats.bevel = M.material(col('#fff2dc'), 1, 0.08, { emissive: M.col(col(C.amber)), emissiveStrength: M.num(0), fieldTarget: 'emissive', field: '能量场', fieldAmount: M.num(0.9) });
    em3.geo.mats.side = M.material(col('#26252c'), 0.35, 0.55);
    em3.geo.mats.back = M.material(col('#5a4632'), 1, 0.45);
    K(em3.geo.mats.bevel.emissiveStrength, [[6.4, 0, 'e'], [6.6, 0.9, 'o'], [7.6, 0.12, 'e'], [12.5, 0.1, 'e'], [12.65, 0.7, 'o'], [13.6, 0.08, 'e']]);
    { const tw = M.deformer('twist'); tw.angle.value = 0; tw.range.value = 520; tw.axis = 'y';
      ex(tw.angle, 'ease(thisComp.layer("场控制器").transform.scale[0], 0, 100, 0, 75) * Math.sin(time * 1.7)');
      const fd = M.deformer('field'); fd.field = '能量场'; fd.amount.value = 70; fd.mode = 'normal';
      const bd = M.deformer('bend'); bd.angle.value = 0; bd.axis = 'x'; bd.range.value = 560;
      K(bd.angle, [[2.95, 0], [3.2, -14, 'o'], [3.7, 4, 'e'], [4.2, 0, 'e'], [12.4, 0, 'e'], [12.7, 10, 'o'], [13.3, 0, 'e']]);
      em3.geo.deformers.push(bd, tw, fd); }
    // 立体字：文字实体（逐字三维排布）
    const tSrc = M.newTextLayer(comp, '流形', { size: 190, weight: 900, fill: col(C.white), tracking: 80, name: '立体字源（隐藏）' }); tSrc.visible = false; pos(tSrc, [0, 0]);
    { const a = M.textAnimator('立体翻转', 'chars'); a.use.rotX = false; a.use.rotY = true; a.props.rotY = M.num(-110); a.props.position.value = [0, 0, -260]; a.props.opacity.value = 0; a.use.scale = false; a.use.rotation = false; a.sel.softness.value = 100;
      K(a.sel.offset, [[12.55, 0, 'o'], [13.8, 155, 'e']]); tSrc.text.animators.push(a); }
    const t3 = M.newGeo(comp, 'extrude', '标题 · 文字实体'); t3.geo.source.from.layer = tSrc.id; t3.geo.source.depth.value = 46; t3.geo.source.bevel.value = 5; t3.geo.source.bevelSegs = 3;
    t3.geo.mats.front = M.material(col('#f6f2ea'), 0, 0.35); t3.geo.mats.bevel = M.material(col(C.gold), 1, 0.15); t3.geo.mats.side = M.material(col('#2c2a30'), 0.5, 0.4); t3.geo.mats.back = M.material(col('#2c2a30'), 0.5, 0.4);
    pos(t3, [960, 732, -320]); t3.inPoint = 12.5; t3.motionBlur = true;
    // 跟随：文字实体以 0.12 秒延迟跟随徽标控制的竖直运动（跨时刻取值）
    ex(t3.transform.position, 'add(value, [0, thisComp.layer("徽标控制").transform.position.valueAtTime(time - 0.12)[1] * 0.3, 0])');
    // 卫星：参数化球体，环形阵列实例；场影响实例排布；旋转引用徽标控制
    const sat = M.newGeo(comp, 'sphere', '卫星 · 环形实例'); sat.parent = emCtl.id; pos(sat, [0, 0, 50]); sat.geo.source.radius.value = 17; sat.geo.source.segs.value = 28;
    sat.geo.instances = { mode: 'radial', count: M.num(9), spacing: M.v3([360, 300, 140]), phase: M.num(0), field: '能量场', fieldAmount: M.num(70) };
    K(sat.geo.instances.phase, [[3, 0, 'l'], [15, 240, 'l']]);
    ex(sat.transform.rotX, 'thisComp.layer("徽标控制").transform.rotation * 0.5 + 64');
    sat.geo.mats.front = M.material(col('#e8edf6'), 1, 0.18, { emissive: M.col(col(C.cyan)), emissiveStrength: M.num(0.05), fieldTarget: 'emissive', field: '能量场', fieldAmount: M.num(1.6) });
    sat.inPoint = 3.3; K(sat.transform.scale, [[3.3, [0, 0, 0], 'o'], [4.2, [110, 110, 110], 'e'], [4.6, [100, 100, 100], 'e']]); sat.motionBlur = true;
    // 圆环：曲线路径 + 线性时间（沿曲线匀速）
    const tor = M.newGeo(comp, 'torus', '圆环 · 匀速曲线路径'); tor.geo.source.majorR.value = 70; tor.geo.source.minorR.value = 16;
    tor.geo.mats.front = M.material(col('#9fb7ff'), 0, 0.18); tor.motionBlur = true;
    K(tor.transform.position, [[3.4, [1650, 260, 300], 'l'], [6.4, [1300, 360, -380], 'l'], [9.4, [560, 300, -260], 'l'], [12.4, [380, 420, 380], 'l'], [14.3, [560, 470, 520], 'e']]);
    K(tor.transform.rotY, [[3.4, 0, 'l'], [14.3, 720, 'e']]); K(tor.transform.rotX, [[3.4, 60, 'l'], [14.3, 60]]);
    tor.inPoint = 3.4;
    // 晶体簇（保留三维预合成）：共享外层相机、灯光与阴影
    const clus = M.newPrecomp(comp, cluster, '晶体簇 · 保留三维'); clus.threeD = true; clus.precomp.space = 'keep3d'; clus.motionBlur = true;
    pos(clus, [1360, 560, 260]); clus.transform.anchor.value = [960, 540, 0]; clus.transform.scale.value = [90, 90, 90]; clus.inPoint = 8.6;
    K(clus.transform.scale, [[8.6, [0, 0, 0], 'o'], [9.4, [100, 100, 100], 'e'], [9.7, [90, 90, 90], 'e']]);
    // 光环实例 ×3（独立画面 → 三维平面），独立颜色/编号与不同内部时间
    const mkRing = (name, p, color, label, opt) => {
      const l = M.newPrecomp(comp, ring, name); l.threeD = true; l.precomp.space = 'flat'; pos(l, p); l.inPoint = opt.inP; l.outPoint = 15; l.startTime = opt.inP; l.mat.lit = false; l.mat.cast = false;
      l.precomp.overrides.pm_color = { on: true, prop: M.col(col(color)) }; l.precomp.overrides.pm_label = { on: true, prop: M.str(label) };
      if (opt.speed) l.precomp.speed = opt.speed;
      K(l.transform.scale, [[opt.inP, [0, 0, 100], 'o'], [opt.inP + 0.55, [88, 88, 100], 'e'], [opt.inP + 0.8, [80, 80, 100], 'e'], [12.3, [80, 80, 100], 'e'], [12.9, [0, 0, 100], 'i']]);
      l.transform.rotY.value = opt.ry || 0; l.blend = 'normal';
      return l;
    };
    const r1 = mkRing('光环 A · 回声', [1330, 360, -260], C.cyan, 'A', { inP: 9.3, ry: -30 });
    { const e = M.effect('echo'); e.p.time.value = -0.08; e.p.count.value = 6; e.p.decay.value = 0.62; e.mode = 'screen'; r1.effects.push(e); }
    const r2 = mkRing('光环 B · 倒放+时间置换', [600, 330, -320], C.pink, 'B', { inP: 9.5, ry: 32, speed: -100 });
    const r3 = mkRing('光环 C · 重映射定格', [980, 230, 330], C.gold, 'C', { inP: 9.7, ry: 0 });
    r3.precomp.remapOn = true; K(r3.precomp.remap, [[9.7, 0, 'l'], [10.6, 0.45, 'e'], [10.9, 0.45, 'h'], [11.5, 0.45], [12.3, 3.2, 'i']]);
    // 时间置换控制图（动画渐变）
    const tdMap = M.newShapeLayer(comp, '时间置换控制图', [M.shape.group('条纹', [M.shape.rect(600, 600), M.shape.gfill('linear', [[0, [0, 0, 0, 1]], [0.5, [1, 1, 1, 1]], [1, [0, 0, 0, 1]]], [-300, -300], [300, 300])])]);
    tdMap.visible = false; pos(tdMap, [300, 300]); K(tdMap.transform.rotation, [[9.5, 0, 'l'], [12.5, 270, 'l']]);
    { const e = M.effect('timeDisplace'); e.mapLayer = null; e.p.maxShift.value = 0.6; e.p.slices.value = 10; r2.effects.push(e); }
    // 时间置换的控制图放在光环单元内部会被所有实例共享；此处使用外层控制图 → 放在实例所在合成中
    // 粒子：从变形实体表面发射，重力 + 能量场 + 噪声，与波动地面碰撞，事件变色并产生次级火花，拖尾
    const parts = M.newParticles(comp, '粒子 · 表面发射'); parts.motionBlur = true;
    { const P_ = parts.particles; P_.seed = 11; P_.max = 2600; P_.step = 60;
      const em = P_.emitters[0]; em.name = '徽标表面'; em.kind = 'surface'; em.layer = em3.id; em.useNormal = true; em.speed.value = 260; em.spread.value = 35; em.life.value = 2.6; em.lifeRand = 0.35; em.drag.value = 0.35; em.inherit.value = 0.6; em.size = 1; em.sizeRand = 0.6;
      K(em.rate, [[6.35, 0, 'h'], [6.5, 520, 'o'], [7.6, 210, 'e'], [9.4, 110, 'e'], [10.2, 0, 'e']]);
      em.bursts = [{ t: 6.5, count: 260 }];
      P_.forces = [Object.assign(M.force('gravity'), { strength: M.num(520) }), Object.assign(M.force('field'), { field: '能量场', strength: M.num(900) }), Object.assign(M.force('noise'), { strength: M.num(140), noiseScale: M.num(380) })];
      const ev = M.event('触地 · 变色与火花'); ev.color.value = col(C.cyan); ev.spawn.value = 3; ev.spawnSpeed.value = 260; ev.spawnLife.value = 0.7; ev.lifeScale.value = 0.6;
      P_.events = [ev];
      P_.look.size.value = 9; P_.look.blend = 'add'; P_.look.glow.value = 1.3;
      P_.look.colorLife = [[0, col('#fff3d6')], [0.35, col(C.amber)], [1, col('#ff4d2e')]];
      P_.look.sizeLife = [[0, 0.3], [0.12, 1.1], [0.7, 0.8], [1, 0]];
      P_.trail.on = true; P_.trail.length.value = 0.32; P_.trail.width.value = 3.2; P_.trail.fade.value = 1.4; P_.trail.useParticleColor = true;
      parts.inPoint = 6.3; parts.outPoint = 13.5; K(parts.transform.opacity, [[12.1, 100, 'e'], [13.2, 0, 'e']]); }
    // 地面：顶点随动画变化的碰撞网格（波浪 + 噪声）
    const floor = M.newGeo(comp, 'plane', '地面 · 波动碰撞网格'); pos(floor, [960, 830, 300]);
    floor.geo.source.size.value = [3600, 3200]; floor.geo.source.segs.value = 44;
    floor.geo.mats.front = M.material(col('#232634'), 0.15, 0.62);
    { const wv = M.deformer('wave'); wv.axis = 'x'; wv.frequency.value = 2.2; wv.speed.value = 0.45; K(wv.amount, [[3, 0, 'e'], [6.4, 0, 'e'], [7.4, 26, 'e'], [10.5, 18, 'e'], [12.5, 0, 'e']]);
      wv.axis = 'x'; floor.geo.deformers.push(wv); }
    K(floor.geo.mats.front.opacity, [[2.9, 0, 'o'], [4.0, 100, 'e']]);
    floor.inPoint = 2.9;
    parts.particles.colliders = [Object.assign(M.collider('mesh'), { name: '波动地面', layer: floor.id, bounce: M.num(0.42), friction: M.num(0.18), event: parts.particles.events[0].id })];
    // 火花晶体：节点“粒子点 → 逐元素表达式 → 重复实例”生成的实例几何
    const crys = M.newGeo(comp, 'node', '火花晶体 · 粒子实例'); crys.geo.source.output = '火花晶体'; pos(crys, [0, 0, 0]); crys.inPoint = 6.4; crys.outPoint = 13.5;
    crys.geo.mats.front = M.material(col('#bfeaff'), 0.2, 0.12, { emissive: M.col(col(C.cyan)), emissiveStrength: M.num(0.9) });
    crys.geo.mats.side = crys.geo.mats.front; crys.geo.mats.bevel = crys.geo.mats.front; crys.geo.mats.back = crys.geo.mats.front;
    crys.geo.cast = true;
    // 路径文字（三维平面，绕徽标旋转）
    const ptext = M.newTextLayer(comp, 'FORM · FIELD · FLOW · PATH · MESH · ', { size: 30, font: 'geo', weight: 700, fill: col(C.gold), tracking: 180, name: '路径文字 · 环绕' });
    { const mk = M.mask([P.ellipse(0, 0, 600, 600)]); mk.name = '文字路径'; mk.on = true; mk.mode = 'add'; ptext.masks.push(mk); ptext.text.path.mask = mk.id;
      ptext.masks[0].mode = 'none'; ptext.inPoint = 3.0;
      K(ptext.text.path.margin, [[0, 0, 'l'], [15, 900, 'l']]);
      ptext.threeD = true; ptext.parent = emCtl.id; pos(ptext, [0, 0, -40]); ptext.mat.lit = false; ptext.mat.cast = false; ptext.transform.rotX.value = 0;
      K(ptext.transform.opacity, [[3.0, 0, 'o'], [3.8, 90, 'e'], [8.5, 90, 'e'], [9.3, 0, 'e']]); ptext.outPoint = 9.5;
      K(ptext.transform.scale, [[0, [100, 100, 100]], [3.0, [100, 100, 100], 'e'], [4.5, [125, 125, 125], 'e']]); }
    // 飘带：网格图钉变形（位置/旋转图钉 + 局部刚性 + 前后关系），其变形结果挤出为三维飘带
    const ribbon = M.newShapeLayer(comp, '飘带 · 图钉变形', [M.shape.group('飘带', [M.shape.rect(980, 70, 35), M.shape.gfill('linear', [[0, col(C.pink)], [0.5, col('#7a5cff')], [1, col(C.cyan)]], [-490, 0], [490, 0])]), M.shape.group('徽记', [M.shape.ellipse(120, 120), M.shape.fill(col(C.white)), M.shape.ellipse(64, 64), M.shape.fill(col('#7a5cff'))])]);
    pos(ribbon, [960, 860]); ribbon.visible = false;
    { const pu = AE.Puppet.create(); pu.density.value = 22; pu.rigidity.value = 1.5;
      const pins = [[-470, 0], [-240, 0], [0, 0], [240, 0], [470, 0]].map((r, i) => AE.Puppet.pin(r, '图钉 ' + (i + 1)));
      pins.forEach((p, i) => { const r = p.rest; ex(p.pos, `[${r[0]} + ${i === 4 ? 'Math.sin(time*1.3)*-120 - 60' : '0'}, ${r[1]} + Math.sin(time*2.4 - ${i}*0.9) * ${i === 2 ? 18 : 46}]`); });
      ex(pins[4].rot, 'Math.sin(time*2.4 - 3.6) * 35');
      pu.pins = pins;
      pu.starch = [{ id: M.newId('st'), rest: [0, 0], radius: M.num(80), amount: M.num(1) }];
      pu.overlap = [{ id: M.newId('ov'), rest: [440, 0], radius: M.num(140), inFront: M.num(70) }];
      ribbon.puppet = pu; }
    const rib3 = M.newGeo(comp, 'extrude', '飘带 · 实体（变形几何挤出）'); rib3.geo.source.from.layer = ribbon.id; rib3.geo.source.depth.value = 14; rib3.geo.source.bevel.value = 3; rib3.geo.source.bevelSegs = 2;
    rib3.geo.mats.front = M.material(col('#5b45c9'), 0.3, 0.35, { emissive: M.col(col('#7a5cff')), emissiveStrength: M.num(0.12) }); rib3.geo.mats.bevel = M.material(col('#c8bfff'), 1, 0.2); rib3.geo.mats.side = M.material(col('#3a2f66'), 0.4, 0.4); rib3.geo.mats.back = rib3.geo.mats.side;
    rib3.parent = sceneRot.id; pos(rib3, [0, 175, 430]); rib3.transform.anchor.value = [0, 0, 0]; rib3.transform.rotX.value = -18; rib3.transform.scale.value = [110, 110, 110];
    rib3.inPoint = 3.6; K(rib3.transform.scale, [[3.6, [0, 110, 110], 'o'], [4.6, [110, 110, 110], 'e']]);
    rib3.motionBlur = true;

    // ---------- 背景 ----------
    const bokeh = M.newShapeLayer(comp, '背景光斑（模糊·滤色·羽化蒙版）', [M.shape.group('光斑', [M.shape.ellipse(900, 600, [0, 0]), M.shape.fill(col('#3b5bdb', 0.75)), M.shape.ellipse(500, 380, [520, -160]), M.shape.fill(col(C.pink, 0.55)), M.shape.ellipse(420, 320, [-560, 200]), M.shape.fill(col(C.amber, 0.45))])]);
    pos(bokeh, [960, 470]); bokeh.blend = 'screen';
    { const b = M.effect('blur'); b.p.radius.value = 120; bokeh.effects.push(b);
      const mk = M.mask([P.ellipse(0, 0, 1400, 700)]); mk.name = '呼吸蒙版'; mk.feather.value = 160; bokeh.masks.push(mk);
      K(mk.path, [[0, [P.ellipse(0, 0, 900, 500)], 'e'], [6.5, [P.ellipse(80, -30, 1700, 820)], 'e'], [10.5, [P.ellipse(-120, 20, 1300, 760)], 'e'], [14.5, [P.ellipse(0, 0, 1500, 700)], 'e']]);
      K(bokeh.transform.opacity, [[0, 35, 'e'], [3, 55, 'e'], [7, 75, 'e'], [12, 55, 'e'], [14.5, 50, 'e']]);
      K(bokeh.transform.rotation, [[0, 0, 'l'], [15, 25, 'l']]); }
    const bg = M.newShapeLayer(comp, '背景渐变', [M.shape.group('渐变', [M.shape.rect(1920, 1080), M.shape.gfill('radial', [[0, col(C.bg1)], [1, col(C.bg0)]], [0, -120], [0, 900])])]);
    pos(bg, [960, 540]);

    // ---------- 节点图：环形阵列节点组（复用两次）、能量场、粒子实例 ----------
    const g = comp.graph;
    const node = (type, x, y, params) => { const n = N.create(type, x, y); Object.assign(n.params, params || {}); g.nodes.push(n); return n; };
    const link = (a, ao, b, bi) => g.links.push({ id: M.newId('lk'), from: [a.id, ao], to: [b.id, bi] });
    // 能量场 = 旋涡场 + 噪声场（中心经 toWorld 连接到“场控制器”）
    const fv = node('fieldVortex', 40, 360); fv.name = '旋涡场'; fv.params.axis.value = [0.15, 1, 0.1]; fv.params.radius.value = 720; fv.params.falloff.value = 0.8;
    ex(fv.params.center, 'thisComp.layer("场控制器").toWorld([0, 0, 0])');
    ex(fv.params.strength, 'thisComp.layer("场控制器").transform.scale[0] / 100');
    const fnz = node('fieldNoise', 40, 520); fnz.name = '噪声场'; fnz.params.noiseScale.value = 420; fnz.params.speed.value = 0.4; fnz.params.strength.value = 0.35;
    ex(fnz.params.strength, 'thisComp.layer("场控制器").transform.scale[0] / 100 * 0.45');
    const fm = node('fieldMix', 280, 430); fm.params.mode = 'add';
    const fo = node('fieldOut', 520, 430, { name: '能量场' });
    link(fv, 'field', fm, 'a'); link(fnz, 'field', fm, 'b'); link(fm, 'field', fo, 'field');
    // 环形阵列（先建再封装为可复用节点组）
    const pin1 = node('pathIn', 40, 40, { layer: tickSrc.id, world: false }); pin1.name = '路径输入 · 刻度';
    const cp = node('circlePoints', 280, 120); cp.name = '圆周分布'; cp.params.count.value = 36; cp.params.radius.value = 300; cp.params.center.value = [960, 500, 0];
    const inst = node('instance', 520, 40); inst.name = '重复实例';
    link(pin1, 'geo', inst, 'geo'); link(cp, 'pts', inst, 'pts');
    const go1 = node('geoOut', 1000, 40, { name: '刻度环' });
    link(inst, 'geo', go1, 'geo');
    const grpNode = N.encapsulate(proj, g, [cp.id, inst.id], '环形阵列');
    grpNode.x = 520; grpNode.y = 40; grpNode.name = '环形阵列 ×1';
    const def = proj.nodeGroups[0];
    const exCount = def.exposed.find(e => e.name.includes('数量')), exPhase = def.exposed.find(e => e.name.includes('相位')), exRad = def.exposed.find(e => e.name.includes('半径'));
    if (exPhase) K(grpNode.params['x_' + exPhase.id], [[0, -40, 'o'], [3, 30, 'e']]);
    if (exRad) K(grpNode.params['x_' + exRad.id], [[0, 250, 'o'], [1.4, 300, 'e'], [2.4, 300, 'e'], [3.0, 380, 'i']]);
    const exCenter = def.exposed.find(e => e.name.includes('中心'));
    if (exCenter) ex(grpNode.params['x_' + exCenter.id], 'thisComp.layer("徽标 · 路径").toWorld([0, 0, 0])');
    // 第二次复用：粒子实例（晶体）。粒子点 → 逐元素表达式（读取 id/age）→ 重复实例（挤出的星形）
    const starSrc = M.newShapeLayer(comp, '星形源（节点输入）', [M.shape.group('星', [M.shape.star(4, 16, 6), M.shape.fill(col(C.white))])]); starSrc.visible = false; pos(starSrc, [0, 0]);
    const pin2 = node('pathIn', 40, 700, { layer: starSrc.id, world: false }); pin2.name = '路径输入 · 星形';
    const exn = node('extrude', 280, 700); exn.params.depth.value = 8; exn.params.bevel.value = 2; exn.params.segs.value = 1;
    const pIn = node('particlesIn', 40, 860, { layer: parts.id }); pIn.params.every.value = 9;
    const ax = node('attrExpr', 280, 860); ax.params.expr = 'pos + [0, Math.sin(time * 7 + id * 1.7) * 8, 0]';
    const inst2 = node('instance', 520, 760); inst2.name = '重复实例 · 晶体'; inst2.params.scale.value = 0.75;
    link(pin2, 'geo', exn, 'geo'); link(exn, 'geo', inst2, 'geo'); link(pIn, 'pts', ax, 'geo'); link(ax, 'geo', inst2, 'pts'); link(fo.id ? fm : fm, 'field', inst2, 'field');
    const go2 = node('geoOut', 760, 760, { name: '火花晶体' }); link(inst2, 'geo', go2, 'geo');
    // 同一几何输出连到多个使用者：徽标挤出 → 显示 / 发射源 / 碰撞体
    const emitN = node('emitOut', 1000, 300, { name: '徽标发射面' });
    const pin3 = node('pathIn', 760, 300, { layer: em2.id, world: true }); pin3.name = '路径输入 · 徽标';
    link(pin3, 'geo', emitN, 'geo');
    const go3 = node('geoOut', 1000, 200, { name: '徽标轮廓' }); link(pin3, 'geo', go3, 'geo');

    // ---------- 声音：音色图层（配乐与音效） ----------
    const synths = [];
    const S = (name, preset, notes, opt = {}) => { const l = M.newSynth(comp, name, preset); l.synth.notes = notes.map(n => M.note(n[0], n[1], n[2], n[3])); if (opt.wave) l.synth.wave = opt.wave; if (opt.vol !== undefined) l.synth.volume.value = opt.vol; if (opt.cut) l.synth.cutoff.value = opt.cut; if (opt.pan !== undefined) l.synth.pan.value = opt.pan; synths.push(l); return l; };
    const chord = (t, d, ps, v = 0.7) => ps.map(p => [t, d, p, v]);
    const pad = S('配乐 · 铺底和声', 'pad', [...chord(0, 3.1, [57, 60, 64]), ...chord(3, 3.6, [53, 57, 60, 65]), ...chord(6.5, 2.6, [48, 55, 64]), ...chord(9.1, 3.3, [55, 59, 62, 67]), ...chord(12.5, 2.4, [48, 55, 59, 64, 71], 0.8)], { wave: 'saw', vol: -9, cut: 1500 });
    K(pad.synth.cutoff, [[0, 900, 'e'], [6.5, 2600, 'e'], [12.5, 1800, 'e'], [14.8, 1200]]);
    K(pad.synth.volume, [[0, -10], [14.4, -9, 'e'], [15, -24]]);
    const arp = []; for (let i = 0; i < 12; i++) arp.push([i * 0.25, 0.2, [69, 72, 76, 81, 76, 72][i % 6] + (i > 7 ? 12 : 0), 0.45 + i * 0.03]);
    S('配乐 · 拨弦琶音', 'pluck', arp, { wave: 'triangle', vol: -10, cut: 2600, pan: 0.25 });
    const bassN = []; const roots = [[6.5, 36], [9.1, 43], [10.6, 45], [12.0, 41]];
    for (let t = 6.5; t < 12.4; t += 0.25) { const r = roots.filter(x => x[0] <= t + 1e-6).pop()[1]; bassN.push([t, 0.2, r + (Math.round(t * 4) % 4 === 2 ? 12 : 0), 0.85]); }
    S('配乐 · 贝斯脉冲', 'bass', bassN, { vol: -7, cut: 1600 });
    const kick = [[3.0, 0.3, 36, 0.6]]; for (let t = 6.5; t < 12.4; t += 0.5) kick.push([t, 0.3, 36, t === 6.5 ? 1 : 0.85]); kick.push([12.5, 0.4, 36, 1]);
    S('节奏 · 底鼓', 'kick', kick, { vol: -3 });
    const hats = []; for (let t = 6.75; t < 12.4; t += 0.5) hats.push([t, 0.08, 80, 0.6]); for (let t = 7.0; t < 12.4; t += 1) hats.push([t + 0.125, 0.05, 80, 0.35]);
    S('节奏 · 踩镲', 'hat', hats, { vol: -12, pan: -0.3 });
    const claps = []; for (let t = 7.0; t < 12.4; t += 1) claps.push([t, 0.1, 60, 0.7]);
    S('节奏 · 拍手', 'clap', claps, { vol: -11, pan: 0.15 });
    S('音效 · 呼啸（镜头推进）', 'whoosh', [[2.65, 0.7, 60, 0.9], [10.1, 0.6, 60, 0.7]], { vol: -6 });
    S('音效 · 上升', 'riser', [[5.4, 1.08, 48, 0.9], [11.55, 0.92, 50, 0.8]], { vol: -9 });
    S('音效 · 冲击', 'impact', [[6.5, 1, 40, 1], [12.5, 1.2, 40, 1]], { vol: -3 });
    const spk = []; const r = U.rng(5); for (let i = 0; i < 22; i++) { const t = 7.1 + r() * 3.4; spk.push([Math.round(t * 8) / 8, 0.1, [84, 88, 91, 93, 96][Math.floor(r() * 5)], 0.4 + r() * 0.4]); }
    S('音效 · 触地闪烁（碰撞）', 'sparkle', spk, { vol: -12, pan: 0.2 });
    S('配乐 · 标题钟琴', 'bell', [[12.6, 0.4, 76, 0.8], [12.95, 0.4, 79, 0.75], [13.3, 0.6, 84, 0.85], [13.75, 1.2, 88, 0.7], [1.15, 0.6, 81, 0.5], [2.15, 0.8, 84, 0.55]], { vol: -9 });
    S('音效 · 低频脉冲', 'sub', [[3.0, 0.6, 33, 0.7], [9.5, 0.5, 33, 0.6]], { vol: -8 });

    // 时间置换控制图放在主合成：使用光环 B 自身空间中的映射图层（这里作为其效果的控制图）
    r2.effects[0].mapLayer = tdMap.id;
    proj.comps.push(ring, tick, cluster);
    // 叠加类图层锁定，避免在画布点选时挡住下方内容
    for (const l of [adj, vig, wash, bg, bokeh]) l.locked = true;
    // 组装图层顺序（上 → 下）
    comp.layers = [...L, cam, arm, rig, sun, fillL, amb, fctl, sceneRot, emCtl, r1, r2, r3, crys, parts, em3, t3, sat, tor, clus, rib3, ptext, floor, tSrc, ribbon, starSrc, tdMap, bokeh, bg, ...synths];
    // 二维图层与三维图层分组：叠加层（二维）在上方；三维块居中；背景在下
    // 将二维字幕组移到三维块之上（L 中已在上方）
    return proj;
  };
})(typeof window !== 'undefined' ? window : globalThis);
