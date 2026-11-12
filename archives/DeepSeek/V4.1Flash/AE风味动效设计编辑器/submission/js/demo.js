/* ============================================================
   demo.js — 15 秒示例「锻字」：写成 · 成块 · 锻打 · 冷却
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const G = AE.geom;
  const T = AE.text;

  const D = AE.demo = {};

  function key(prop, t, v) {
    const k = A.addKey(prop, t, v);
    return k;
  }
  function ease(prop, t, x, y) {
    const k = A.keyAt(prop, t);
    if (!k) return;
    k.in = { x: x === undefined ? 0.5 : x, y: y === undefined ? 0 : y };
    k.out = { x: x === undefined ? 0.5 : x, y: y === undefined ? 0 : y };
    k.inType = 'bezier'; k.outType = 'bezier';
  }
  function linear(prop, t) {
    const k = A.keyAt(prop, t);
    if (!k) return;
    k.in = { x: 1 / 3, y: 1 / 3 }; k.out = { x: 1 / 3, y: 1 / 3 };
    k.inType = 'linear'; k.outType = 'linear';
  }
  function hold(prop, t) {
    const k = A.keyAt(prop, t);
    if (k) k.outType = 'hold';
  }
  function setVec(p, x, y, z) { p.value = { x, y, z: z || 0 }; }
  function keysVec(prop, arr) {
    for (const [t, x, y, z] of arr) key(prop, t, { x, y, z: z || 0 });
  }
  function scaleKeys(prop, arr) {
    for (const [t, s] of arr) key(prop, t, { x: s, y: s, z: 100 });
  }
  function sampleContourPoints(layer, targets) {
    const ctx = A.newCtx(layer._comp, layer, 0);
    const contours = T.layerContours(layer, 0);
    const pts = [];
    for (const c of contours) {
      const flat = G.flattenContour(c, 1);
      for (const p of flat) pts.push(p);
    }
    return targets.map(tp => {
      let best = pts[0] || { x: 0, y: 0 }, bd = Infinity;
      for (const p of pts) {
        const d = Math.hypot(p.x - tp.x, p.y - tp.y);
        if (d < bd) { bd = d; best = p; }
      }
      return { x: best.x, y: best.y };
    });
  }

  D.build = function (character) {
    character = character || '锻';
    const project = M.createProject({
      projectName: '锻字 · FORGE',
      name: '主合成 · 锻字',
      width: 1920, height: 1080, fps: 30, duration: 15,
      bgColor: '#060708'
    });
    const comp = project.comps[0];
    comp.name = '主合成 · 锻字';
    comp.workStart = 0;
    comp.workEnd = 15;
    comp.motionBlur = { enabled: true, shutterAngle: 180, phase: 0, samples: 6 };
    comp.bgColor = '#060708';
    comp.bgAlpha = 100;
    const layers = [];
    const L = (type, opts) => {
      const l = M.newLayer(comp, type, opts);
      l._comp = comp;
      l.inPoint = 0; l.outPoint = 15;
      layers.push(l);
      return l;
    };

    // =========================================================
    // 1. 冷却调色 · 调整图层
    // =========================================================
    const grade = L('adjustment', { name: '冷却 · 调色' });
    const hsl = M.effect('hsl', '冷却调色');
    hsl.params.hue.value = -4;
    key(hsl.params.hue, 0, -4);
    key(hsl.params.hue, 10.6, -2);
    key(hsl.params.hue, 14.0, -10);
    key(hsl.params.saturation, 0, 108);
    key(hsl.params.saturation, 10.6, 112);
    key(hsl.params.saturation, 14.0, 88);
    key(hsl.params.lightness, 0, 100);
    key(hsl.params.lightness, 10.6, 102);
    key(hsl.params.lightness, 14.0, 96);
    grade.effects.push(hsl);
    const gmask = M.mask('ellipse', '中心遮罩');
    gmask.w.value = 1720; gmask.h.value = 980; gmask.feather.value = 220;
    grade.masks.push(gmask);

    // =========================================================
    // 2. 片尾铭文
    // =========================================================
    const title = L('text', { name: '铭文 · 片尾', content: '锻 字\nFORGED IN FIRE', fill: '#d8c3a8', fontSize: 40 });
    title.text.fontSize.value = 36;
    title.text.tracking.value = 14;
    title.text.lineHeight.value = 190;
    title.text.weight.value = 400;
    title.text.fillColor.value = '#d2bda2';
    title.transform.position.value = { x: 0, y: 372, z: 0 };
    title.transform.opacity.value = 0;
    key(title.transform.opacity, 11.8, 0);
    key(title.transform.opacity, 12.8, 72);
    key(title.transform.opacity, 15, 72);
    ease(title.transform.opacity, 12.8);
    title.effects.push((() => { const f = M.effect('glow', '微光'); f.params.radius.value = 16; f.params.intensity.value = 60; f.params.threshold.value = 25; f.params.color.value = '#ffb15a'; return f; })());
    title.inPoint = 11.2; title.outPoint = 15;

    // =========================================================
    // 3. 炉膛点光 / 阴影主光 / 轮廓光
    // =========================================================
    const keyLight = L('light', { name: '主光 · 冷钢', lightType: 'directional', color: '#dbe7ff', intensity: 10 });
    keyLight.light.direction.value = { x: 0.48, y: 0.62, z: -0.5 };
    keyLight.light.shadow = true;
    keyLight.light.intensity.value = 10;

    const rimLight = L('light', { name: '轮廓光 · 冷边', lightType: 'point', color: '#79aee6', intensity: 10 });
    rimLight.transform.position.value = { x: 620, y: 60, z: 260 };
    rimLight.light.radius.value = 900;

    const heatLight = L('light', { name: '炉火点光', lightType: 'point', color: '#ff641e', intensity: 160 });
    heatLight.transform.position.value = { x: 0, y: 20, z: 360 };
    heatLight.light.radius.value = 1000;
    heatLight.light.color.value = '#ff6a20';
    const hi = heatLight.light.intensity;
    hi.keyframes = [];
    key(hi, 0, 90);
    key(hi, 3.0, 120);
    key(hi, 4.6, 320);
    key(hi, 6.8, 380);
    key(hi, 7.8, 620);
    key(hi, 8.1, 420);
    key(hi, 8.9, 600);
    key(hi, 9.2, 400);
    key(hi, 10.0, 560);
    key(hi, 10.6, 280);
    key(hi, 12.6, 90);
    key(hi, 14.2, 55);
    heatLight.light.expression = '';
    heatLight.light.intensity.expression = 'value + thisComp.layer("控制 · 呼吸").transform.rotation.valueAtTime(time - 0.15) * 0.6 * linear(time, 12.6, 13.6, 1, 0)';
    const fillLight = L('light', { name: '正面补光 · 冷锻', lightType: 'point', color: '#c8d7ea', intensity: 50 });
    fillLight.transform.position.value = { x: -260, y: -180, z: 880 };
    fillLight.light.radius.value = 1200;

    // =========================================================
    // 4. 场
    // =========================================================
    const heatField = L('field', { name: '热浪 · 噪声场', fieldType: 'noise' });
    heatField.field.position.value = { x: 0, y: 0, z: 160 };
    heatField.field.radius.value = 760;
    heatField.field.frequency.value = 260;
    heatField.field.evolution.value = 0.6;
    heatField.field.strength.value = 0;
    heatField.field.falloff.value = 60;
    heatField.field.seed = 17;
    for (const tm of [0, 5.2, 7.72, 7.86, 8.2, 8.82, 8.96, 9.3, 9.92, 10.06, 10.5, 12.4, 14.0]) {
      const v = (tm === 7.72 || tm === 8.82 || tm === 9.92) ? 0 : ((tm === 7.86 || tm === 8.96) ? 46 : (tm === 10.06 ? 36 : (tm === 14.0 ? 0 : 2)));
      key(heatField.field.strength, tm, v);
    }
    ease(heatField.field.strength, 7.86, 0.25, 0.9);
    ease(heatField.field.strength, 8.96, 0.25, 0.9);
    ease(heatField.field.strength, 10.06, 0.25, 0.9);

    const vortexField = L('field', { name: '旋涡 · 火星', fieldType: 'vortex' });
    vortexField.field.position.value = { x: 260, y: -140, z: 210 };
    vortexField.field.radius.value = 430;
    vortexField.field.strength.value = 240;
    vortexField.field.spin.value = 3.2;
    vortexField.field.falloff.value = 45;

    // =========================================================
    // 5. 控制对象（供表达式引用）
    // =========================================================
    const ctrl = L('null', { name: '控制 · 呼吸' });
    ctrl.threeD = false;
    ctrl.transform.rotation.keyframes = [];
    key(ctrl.transform.rotation, 0, 0);
    key(ctrl.transform.rotation, 2, 8);
    key(ctrl.transform.rotation, 4, 0);
    for (const k of ctrl.transform.rotation.keyframes) { k.inType = 'bezier'; k.outType = 'bezier'; k.in = { x: .42, y: 0 }; k.out = { x: .42, y: 0 }; }
    ctrl.transform.rotation.expression = 'loopOut("cycle")';
    ctrl.transform.opacity.value = 0;

    // =========================================================
    // 6. 炉膛底色（2D）
    // =========================================================
    const bg = L('shape', { name: '底色 · 炉膛', shape: 'ellipse', fill: '#2a120a' });
    bg.shape.ops[0].rx.value = 1320;
    bg.shape.ops[0].ry.value = 900;
    bg.shape.fill.gradient.type = 'radial';
    bg.shape.fill.color.value = '#3b1a0d';
    bg.shape.fill.gradient.color2.value = '#050607';
    bg.shape.fill.opacity.value = 100;
    bg.transform.position.value = { x: 0, y: -10, z: 0 };
    bg.effects.push((() => { const f = M.effect('glow', '炉膛微光'); f.params.radius.value = 90; f.params.intensity.value = 55; f.params.threshold.value = 30; f.params.color.value = '#c25a22'; return f; })());

    const halo = L('shape', { name: '余烬 · 炉心辉光', shape: 'ellipse', fill: '#ff6b1e' });
    halo.shape.ops[0].rx.value = 330;
    halo.shape.ops[0].ry.value = 300;
    halo.shape.fill.opacity.value = 100;
    halo.transform.position.value = { x: 0, y: 10, z: 0 };
    halo.transform.opacity.value = 18;
    key(halo.transform.opacity, 0, 16);
    key(halo.transform.opacity, 4.6, 55);
    key(halo.transform.opacity, 7.6, 62);
    key(halo.transform.opacity, 8.0, 95);
    key(halo.transform.opacity, 10.2, 70);
    key(halo.transform.opacity, 13.4, 8);
    halo.transform.opacity.expression = 'value + Math.sin(time * 2.3) * 3.5 * linear(time, 12.4, 13.8, 1, 0)';
    halo.effects.push((() => { const f = M.effect('glow', '炽热'); f.params.radius.value = 200; f.params.intensity.value = 180; f.params.threshold.value = 12; f.params.color.value = '#ff6a1a'; return f; })());
    halo.effects.push((() => { const f = M.effect('blur', '柔化'); f.params.radius.value = 26; return f; })());

    // =========================================================
    // 7. 锻造台 / 炉环
    // =========================================================
    const stage = L('shape', { name: '锻造台 · 铁砧', shape: 'rect', fill: '#3a3f46' });
    stage.shape.ops[0].w.value = 1680;
    stage.shape.ops[0].h.value = 1080;
    stage.shape.ops[0].round.value = 26;
    stage.extrude.enabled = true;
    stage.extrude.depth.value = 34;
    stage.extrude.bevel.value = 8;
    stage.material.baseColor.value = '#3b4148';
    stage.material.metalness.value = 68;
    stage.material.roughness.value = 46;
    stage.material.castShadow = true;
    stage.material.receiveShadow = true;
    stage.threeD = true;
    stage.transform.rotationX.value = 90;
    stage.transform.position.value = { x: 0, y: 262, z: 30 };
    stage.motionBlur = false;

    const ring = L('shape', { name: '炉环 · 熔金', shape: 'ellipse', fill: '#c07a34' });
    ring.shape.ops = [];
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      const seg = M.opDefaults('rect', { name: '熔金环段 ' + (i + 1) });
      seg.w.value = 96;
      seg.h.value = 28;
      seg.round.value = 9;
      seg.x.value = Math.sin(a) * 452;
      seg.y.value = -Math.cos(a) * 452;
      seg.rotation.value = a * U.RAD;
      ring.shape.ops.push(seg);
    }
    ring.extrude.enabled = true;
    ring.extrude.depth.value = 24;
    ring.extrude.bevel.value = 4;
    ring.material.baseColor.value = '#b98543';
    ring.material.metalness.value = 88;
    ring.material.roughness.value = 28;
    ring.material.emissive.value = 30;
    ring.material.emissiveColor.value = '#ff6a18';
    ring.material.castShadow = true;
    ring.threeD = true;
    ring.transform.rotationX.value = 90;
    ring.transform.position.value = { x: 0, y: 238, z: 30 };
    ring.transform.rotation.keyframes = [];
    key(ring.transform.rotation, 0, 0);
    key(ring.transform.rotation, 8, 360);
    key(ring.transform.rotation, 13.1, 490);
    key(ring.transform.rotation, 15, 490);
    for (const kf of ring.transform.rotation.keyframes) linear(ring.transform.rotation, kf.t);
    ease(ring.transform.rotation, 13.1, 0.55, 0.6);
    key(ring.material.emissive, 0, 24);
    key(ring.material.emissive, 4.6, 80);
    key(ring.material.emissive, 8, 130);
    key(ring.material.emissive, 10.2, 90);
    key(ring.material.emissive, 13.6, 18);
    // 炉环上的刻印：子层，随父级旋转
    const ringMark = L('shape', { name: '炉环 · 刻印', shape: 'rect', fill: '#ffd08a' });
    ringMark.shape.ops[0].w.value = 46;
    ringMark.shape.ops[0].h.value = 18;
    ringMark.shape.ops[0].round.value = 5;
    ringMark.extrude.enabled = true;
    ringMark.extrude.depth.value = 13;
    ringMark.extrude.bevel.value = 2;
    ringMark.material.baseColor.value = '#ffcb7a';
    ringMark.material.metalness.value = 35;
    ringMark.material.roughness.value = 35;
    ringMark.material.emissive.value = 210;
    ringMark.material.emissiveColor.value = '#ff7a1e';
    ringMark.material.castShadow = false;
    ringMark.threeD = true;
    ringMark.parentId = ring.id;
    ringMark.transform.position.value = { x: 0, y: -452, z: 0 };
    ringMark.transform.rotation.value = 0;

    // =========================================================
    // 8. 主字 · 三维实体
    // =========================================================
    const textLayer = L('text', { name: '主体 · ' + character, content: character, fill: '#8d939c', fontSize: 400, extrude: true, depth: 10, bevel: 5 });
    textLayer.text.font = 'Microsoft YaHei';
    textLayer.text.weight.value = 900;
    textLayer.text.fontSize.value = 400;
    textLayer.text.tracking.value = 4;
    textLayer.text.fillColor.value = '#8d939c';
    textLayer.text.fillOpacity.value = 100;
    textLayer.transform.position.value = { x: 0, y: -24, z: 0 };
    textLayer.transform.rotationY.value = -9;
    textLayer.transform.rotationX.value = 3;
    textLayer.transform.rotation.value = 0;
    textLayer.transform.scale.value = { x: 100, y: 100, z: 100 };
    textLayer.material.baseColor.value = '#7a808a';
    textLayer.material.metalness.value = 48;
    textLayer.material.roughness.value = 40;
    textLayer.material.emissive.value = 6;
    textLayer.material.emissiveColor.value = '#ff7a26';
    textLayer.material.castShadow = true;
    textLayer.material.receiveShadow = true;
    textLayer.motionBlur = true;
    textLayer.extrude.keyframes = null;
    textLayer.extrude.depth.keyframes = [];
    key(textLayer.extrude.depth, 0, 9);
    key(textLayer.extrude.depth, 3.0, 12);
    key(textLayer.extrude.depth, 4.4, 86);
    key(textLayer.extrude.depth, 5.2, 98);
    key(textLayer.extrude.depth, 7.74, 98);
    key(textLayer.extrude.depth, 7.82, 90);
    key(textLayer.extrude.depth, 8.2, 98);
    key(textLayer.extrude.depth, 8.84, 90);
    key(textLayer.extrude.depth, 9.3, 98);
    key(textLayer.extrude.depth, 9.94, 90);
    key(textLayer.extrude.depth, 10.6, 98);
    key(textLayer.extrude.depth, 14.0, 98);
    key(textLayer.material.emissive, 0, 4);
    key(textLayer.material.emissive, 3.0, 30);
    key(textLayer.material.emissive, 4.4, 210);
    key(textLayer.material.emissive, 5.6, 300);
    key(textLayer.material.emissive, 7.7, 360);
    key(textLayer.material.emissive, 8.0, 300);
    key(textLayer.material.emissive, 8.9, 340);
    key(textLayer.material.emissive, 9.2, 280);
    key(textLayer.material.emissive, 10.0, 330);
    key(textLayer.material.emissive, 10.5, 260);
    key(textLayer.material.emissive, 11.6, 160);
    key(textLayer.material.emissive, 12.8, 60);
    key(textLayer.material.emissive, 14.0, 8);
    key(textLayer.material.baseColor, 3.0, '#666a72');
    key(textLayer.material.baseColor, 4.8, '#80624f');
    key(textLayer.material.baseColor, 10.6, '#6b625c');
    key(textLayer.material.baseColor, 13.8, '#858a92');
    key(textLayer.material.roughness, 3.0, 38);
    key(textLayer.material.roughness, 5.2, 24);
    key(textLayer.material.roughness, 13.6, 32);
    textLayer.transform.scale.keyframes = [];
    key(textLayer.transform.scale, 3.4, { x: 96, y: 96, z: 100 });
    key(textLayer.transform.scale, 5.0, { x: 100, y: 100, z: 100 });
    ease(textLayer.transform.scale, 5.0, 0.35, 0.9);
    textLayer.deform.fields = [heatField.id];

    // 取字形上的三处落锤点
    const pinsLocal = sampleContourPoints(textLayer, [
      { x: -118, y: -92 }, { x: 96, y: 22 }, { x: -30, y: 138 }
    ]);
    const textWorld0 = A.worldMatrixAt(textLayer, 0);
    const pinWorld = pinsLocal.map(p => U.m4.applyPoint(textWorld0, { x: p.x, y: p.y, z: 0 }));
    const impactTimes = [7.8, 8.9, 10.0];
    pinsLocal.forEach((p, i) => {
      const pin = M.addPin(textLayer, {
        name: '锻打图钉 ' + (i + 1), position: { x: p.x, y: p.y, z: 0 },
        target: { x: p.x, y: p.y, z: 0 }, radius: i === 1 ? 210 : 180, strength: 100
      });
      const t = impactTimes[i];
      key(pin.target, t - 0.04, { x: p.x, y: p.y, z: 0 });
      key(pin.target, t + 0.04, { x: p.x + (i === 0 ? -10 : 8), y: p.y + (i === 1 ? -12 : 7), z: -26 });
      key(pin.target, t + 0.26, { x: p.x + 2, y: p.y + 3, z: 0 });
      key(pin.target, t + 1.2, { x: p.x, y: p.y, z: 0 });
      ease(pin.target, t + 0.04, 0.2, 0.9);
      ease(pin.target, t + 0.26, 0.5, 1);
      key(pin.rotation, t - 0.04, 0);
      key(pin.rotation, t + 0.08, i === 0 ? -7 : (i === 1 ? 5 : -4));
      key(pin.rotation, t + 0.5, 0);
      key(pin.scale, t - 0.04, { x: 100, y: 100, z: 100 });
      key(pin.scale, t + 0.06, { x: i === 1 ? 90 : 94, y: i === 1 ? 96 : 92, z: 100 });
      key(pin.scale, t + 0.55, { x: 100, y: 100, z: 100 });
      ease(pin.scale, t + 0.55, 0.4, 1);
    });

    // =========================================================
    // 9. 逐笔写成（2D 字形描边）
    // =========================================================
    const write = L('shape', { name: '笔画 · 逐笔写成', fill: '#ffb45e' });
    const glyphOp = M.opDefaults('glyph', { text: character, font: 'Microsoft YaHei', fontSize: 400, tracking: 4, align: 'center', name: '字形笔画' });
    glyphOp.fontWeight = 900;
    glyphOp.linkLayerId = textLayer.id;
    glyphOp.y.value = -24;
    write.shape.ops = [glyphOp];
    write.shape.fill.enabled = false;
    write.shape.stroke.enabled = true;
    write.shape.stroke.color.value = '#ffd7a0';
    write.shape.stroke.width.value = 3.4;
    write.shape.stroke.opacity.value = 100;
    const trim = M.opDefaults('trim', { name: '书写进度' });
    trim.stagger.value = 7;
    trim.end.keyframes = [];
    key(trim.end, 0, 3);
    key(trim.end, 0.2, 9);
    key(trim.end, 3.2, 100);
    trim.end.expression = '';
    for (const kf of trim.end.keyframes) { kf.in = { x: .5, y: 0 }; kf.out = { x: .5, y: 0 }; }
    write.shape.ops.push(trim);
    write.transform.position.value = { x: 0, y: 0, z: 0 };
    write.transform.opacity.value = 100;
    key(write.transform.opacity, 3.2, 100);
    key(write.transform.opacity, 4.1, 45);
    key(write.transform.opacity, 4.5, 0);
    write.effects.push((() => { const f = M.effect('glow', '书写辉光'); f.params.radius.value = 26; f.params.intensity.value = 260; f.params.threshold.value = 8; f.params.color.value = '#ffab4d'; return f; })());
    write.inPoint = 0; write.outPoint = 4.7;
    write.motionBlur = false;

    // =========================================================
    // 10. 锻锤
    // =========================================================
    const hammer = L('shape', { name: '锻锤 · 重铸', fill: '#858b94' });
    hammer.shape.ops[0] = M.opDefaults('rect', { w: 238, h: 96, round: 16, name: '锤头' });
    hammer.shape.ops[0].w.value = 238; hammer.shape.ops[0].h.value = 96; hammer.shape.ops[0].round.value = 16;
    const un = M.opDefaults('boolean', { op: 'union', name: '锤柄', sourceType: 'rect' });
    un.source.w.value = 34; un.source.h.value = 300; un.source.x.value = 0; un.source.y.value = 196; un.source.round.value = 12;
    hammer.shape.ops.push(un);
    hammer.extrude.enabled = true;
    hammer.extrude.depth.value = 78;
    hammer.extrude.bevel.value = 6;
    hammer.material.baseColor.value = '#686e77';
    hammer.material.metalness.value = 92;
    hammer.material.roughness.value = 30;
    hammer.material.emissive.value = 20;
    hammer.material.emissiveColor.value = '#ff7a2a';
    hammer.material.castShadow = true;
    hammer.material.receiveShadow = true;
    hammer.threeD = true;
    hammer.transform.anchor.value = { x: 0, y: 0, z: 0 };
    hammer.transform.opacity.value = 0;
    hammer.motionBlur = true;
    hammer.transform.position.keyframes = [];
    hammer.transform.rotation.keyframes = [];
    const hk = (t, x, y, z, rot, op) => {
      key(hammer.transform.position, t, { x, y, z });
      key(hammer.transform.rotation, t, rot);
      key(hammer.transform.opacity, t, op);
    };
    const p0 = pinWorld[0], p1 = pinWorld[1], p2 = pinWorld[2];
    hk(5.9, p0.x + 520, p0.y - 560, 340, -58, 0);
    hk(6.3, p0.x + 400, p0.y - 480, 300, -52, 0);
    hk(7.15, p0.x + 150, p0.y - 330, 210, -58, 100);
    hk(7.52, p0.x + 40, p0.y - 150, 130, -20, 100);
    hk(7.72, p0.x + 6, p0.y - 25, 92, -3, 100);
    hk(7.8, p0.x, p0.y, 78, 0, 100);
    hk(7.9, p0.x + 14, p0.y - 44, 82, -9, 100);
    hk(8.28, p0.x + 150, p0.y - 250, 160, -46, 100);
    hk(8.62, p1.x + 60, p1.y - 170, 120, -16, 100);
    hk(8.88, p1.x, p1.y, 78, 1, 100);
    hk(8.98, p1.x + 12, p1.y - 40, 82, -8, 100);
    hk(9.32, p1.x + 150, p1.y - 250, 160, -46, 100);
    hk(9.72, p2.x + 60, p2.y - 170, 125, -14, 100);
    hk(9.98, p2.x, p2.y, 78, 0, 100);
    hk(10.1, p2.x + 16, p2.y - 48, 84, -10, 100);
    hk(10.55, p2.x + 240, p2.y - 360, 210, -48, 100);
    hk(11.0, p2.x + 420, p2.y - 540, 300, -60, 0);
    // 预备与收势的缓动
    for (const t of [6.3, 7.15, 7.52, 7.72, 7.8, 8.28, 8.62, 8.88, 9.32, 9.72, 9.98, 10.55, 11.0]) ease(hammer.transform.position, t, 0.4, 0.15);
    for (const t of [7.72, 7.8, 8.62, 8.88, 9.72, 9.98]) ease(hammer.transform.rotation, t, 0.3, 0.2);
    hammer.inPoint = 5.6; hammer.outPoint = 11.1;

    // =========================================================
    // 11. 锤击冲击环（3D）
    // =========================================================
    const impactLayers = [];
    for (let i = 0; i < 3; i++) {
      const t = impactTimes[i];
      const r = L('shape', { name: '冲击环 ' + String.fromCharCode(65 + i), shape: 'ellipse', fill: '#ffd9a6' });
      impactLayers.push(r);
      r.shape.ops[0].rx.value = 128; r.shape.ops[0].ry.value = 128;
      const cut = M.opDefaults('boolean', { op: 'subtract', name: '内圈', sourceType: 'ellipse' });
      cut.source.rx.value = 108; cut.source.ry.value = 108;
      r.shape.ops.push(cut);
      r.extrude.enabled = true;
      r.extrude.depth.value = 3;
      r.extrude.bevel.value = 0.6;
      r.material.baseColor.value = '#ffb15a';
      r.material.metalness.value = 10;
      r.material.roughness.value = 60;
      r.material.emissive.value = 500;
      r.material.emissiveColor.value = '#ff9a3c';
      r.material.castShadow = false;
      r.material.receiveShadow = false;
      r.threeD = true;
      r.transform.position.value = { x: pinWorld[i].x, y: pinWorld[i].y, z: 96 };
      r.transform.scale.keyframes = [];
      key(r.transform.scale, t - 0.04, { x: 12, y: 12, z: 100 });
      key(r.transform.scale, t + 0.18, { x: 210, y: 210, z: 100 });
      key(r.transform.scale, t + 0.55, { x: 330, y: 330, z: 100 });
      r.transform.opacity.keyframes = null;
      r.transform.opacity.value = 0;
      r.transform.opacity.keyframes = [];
      key(r.transform.opacity, t - 0.05, 0);
      key(r.transform.opacity, t + 0.02, 100);
      key(r.transform.opacity, t + 0.42, 0);
      ease(r.transform.opacity, t + 0.42, 0.4, 0);
      key(r.material.emissive, t - 0.05, 500);
      key(r.material.emissive, t + 0.45, 0);
      r.inPoint = t - 0.2; r.outPoint = t + 0.8;
    }

    // =========================================================
    // 12. 粒子 · 火星 / 余烬
    // =========================================================
    const sparkLayer = L('particle', { name: '火星 · 迸射' });
    sparkLayer.transform.position.value = { x: 0, y: 0, z: 0 };
    sparkLayer.transform.opacity.value = 100;
    const sp = sparkLayer.particle;
    sp.lifetime.value = 1.55;
    sp.gravity.value = { x: 0, y: 920, z: 0 };
    sp.wind.value = { x: 0, y: 0, z: 40 };
    sp.drag.value = 0.32;
    sp.size.value = 4.6;
    sp.sizeEnd.value = 1.2;
    sp.sizeRandom.value = 58;
    sp.colorStart.value = '#fff6d4';
    sp.colorMid.value = '#ff9a2c';
    sp.colorEnd.value = '#ff3508';
    sp.opacityStart.value = 100;
    sp.opacityEnd.value = 0;
    sp.maxParticles = 2600;
    sp.fieldIds = [heatField.id, vortexField.id];
    sp.collisions.enabled = true;
    sp.collisions.colliders = [stage.id, textLayer.id];
    sp.collisions.restitution.value = 0.48;
    sp.collisions.friction.value = 0.24;
    sp.collisions.colorOnHit.value = '#ffe1a2';
    sp.collisions.lifeFactor.value = 55;
    sp.collisions.secondary.enabled = true;
    sp.collisions.secondary.count.value = 3;
    sp.collisions.secondary.speed.value = 150;
    sp.collisions.secondary.life.value = 0.45;
    sp.collisions.secondary.color.value = '#ffd27a';
    sp.trails.enabled = true;
    sp.trails.length.value = 0.42;
    sp.trails.width.value = 2.4;
    sp.trails.color.value = '#ff6a1e';
    sp.trails.opacity.value = 72;
    // 表面发射器
    const se = sp.emitters[0];
    se.name = '主体表面'; se.type = 'surface'; se.layerId = textLayer.id;
    se.rate.keyframes = [];
    key(se.rate, 0, 0);
    key(se.rate, 6.5, 0);
    key(se.rate, 7.5, 7);
    key(se.rate, 10.4, 3);
    key(se.rate, 12.2, 0);
    se.direction.value = { x: 0, y: -0.4, z: 1 };
    se.speed.value = 240;
    se.spread.value = 72;
    se.radius.value = 5;
    se.bursts = [
      { t: 0.15, count: 22, speed: 0.5 },
      { t: 4.35, count: 60, speed: 0.8 },
      { t: 7.8, count: 85 },
      { t: 8.9, count: 60 },
      { t: 10.0, count: 100 },
      { t: 11.3, count: 30, speed: 0.5 }
    ];
    const mkPoint = (name, p, dir, burstT, count, speed, spread) => {
      const em = M.addParticleEmitter(sparkLayer, {
        name, type: 'point', position: { x: p.x, y: p.y, z: 95 },
        direction: dir, rate: 0, speed, spread, radius: 16
      });
      em.bursts = [{ t: burstT, count }];
      return em;
    };
    mkPoint('迸口 · 上', pinWorld[0], { x: -0.55, y: -0.7, z: 1 }, 7.8, 95, 620, 46);
    mkPoint('迸口 · 中', pinWorld[1], { x: 0.55, y: 0.1, z: 1 }, 8.9, 85, 580, 44);
    mkPoint('迸口 · 下', pinWorld[2], { x: 0.1, y: 0.8, z: 1 }, 10.0, 120, 640, 50);
    sparkLayer.motionBlur = false;

    const emberLayer = L('particle', { name: '余烬 · 上升' });
    emberLayer.transform.position.value = { x: 0, y: 0, z: 0 };
    const ep = emberLayer.particle;
    ep.lifetime.value = 2.8;
    ep.gravity.value = { x: 0, y: -18, z: 0 };
    ep.wind.value = { x: 12, y: -25, z: 8 };
    ep.drag.value = 0.14;
    ep.size.value = 3.2;
    ep.sizeEnd.value = 0.6;
    ep.sizeRandom.value = 60;
    ep.colorStart.value = '#ffbf63';
    ep.colorMid.value = '#ff7124';
    ep.colorEnd.value = '#a32808';
    ep.opacityStart.value = 82;
    ep.opacityEnd.value = 0;
    ep.maxParticles = 600;
    ep.trails.enabled = false;
    ep.fieldIds = [vortexField.id];
    ep.emitters[0].name = '炉床 · 余烬';
    ep.emitters[0].position.value = { x: 0, y: 180, z: 40 };
    ep.emitters[0].radius.value = 720;
    ep.emitters[0].direction.value = { x: 0, y: -1, z: 0.12 };
    ep.emitters[0].rate.keyframes = [];
    ep.emitters[0].speed.value = 44;
    ep.emitters[0].spread.value = 75;
    key(ep.emitters[0].rate, 0, 2);
    key(ep.emitters[0].rate, 3.4, 5);
    key(ep.emitters[0].rate, 7.6, 16);
    key(ep.emitters[0].rate, 10.2, 4);
    key(ep.emitters[0].rate, 10.9, 0);
    emberLayer.motionBlur = false;

    // =========================================================
    // 13. 摄像机
    // =========================================================
    const cam = L('camera', { name: '摄像机 · 炉前' });
    cam.camera.target.value = { x: 0, y: 16, z: 0 };
    cam.camera.focalLength.value = 52;
    cam.camera.aperture.value = 1.35;
    cam.transform.position.keyframes = [];
    keysVec(cam.transform.position, [
      [0, 50, -96, 1460],
      [2.6, 26, -64, 1360],
      [4.4, 8, -46, 1270],
      [5.6, -50, -34, 1245],
      [7.0, -28, -56, 1210],
      [7.78, -17, -38, 1190],
      [7.86, -11, -31, 1188],
      [8.2, -30, -52, 1200],
      [8.9, 16, -44, 1192],
      [8.96, 22, -50, 1196],
      [9.35, -4, -46, 1205],
      [10.0, -10, -40, 1194],
      [10.06, -4, -48, 1198],
      [10.7, 30, -66, 1250],
      [12.0, 52, -78, 1320],
      [13.8, 16, -44, 1410],
      [15, 16, -44, 1410]
    ]);
    cam.camera.target.keyframes = [];
    keysVec(cam.camera.target, [
      [0, 0, 8, 0], [4.4, 0, 12, 0], [7.0, 0, 22, 0], [7.78, 0, 18, 0],
      [7.86, 0, 22, 0], [8.9, 0, 18, 0], [9.35, 0, 22, 0], [10.0, 0, 18, 0],
      [10.7, 0, 20, 0], [13.8, 0, 14, 0], [15, 0, 14, 0]
    ]);
    cam.camera.focalLength.keyframes = [];
    key(cam.camera.focalLength, 0, 52); key(cam.camera.focalLength, 4.4, 54);
    key(cam.camera.focalLength, 7.0, 54); key(cam.camera.focalLength, 10.4, 54);
    key(cam.camera.focalLength, 13.8, 60); key(cam.camera.focalLength, 15, 60);
    cam.camera.focusDistance.keyframes = [];
    key(cam.camera.focusDistance, 0, 1450); key(cam.camera.focusDistance, 4.4, 1260);
    key(cam.camera.focusDistance, 7.0, 1200); key(cam.camera.focusDistance, 10.4, 1190);
    key(cam.camera.focusDistance, 13.8, 1400); key(cam.camera.focusDistance, 15, 1400);
    cam.camera.aperture.keyframes = [];
    key(cam.camera.aperture, 0, 0.9); key(cam.camera.aperture, 4.4, 1.3);
    key(cam.camera.aperture, 7.2, 2.1); key(cam.camera.aperture, 10.4, 1.9);
    key(cam.camera.aperture, 12.2, 1.0); key(cam.camera.aperture, 15, 0.8);
    // 轻微震动直接写在关键帧上
    const shake = (t, bx, by, bz, dx, dy) => {
      key(cam.transform.position, t, { x: bx + dx, y: by + dy, z: bz });
    };
    shake(7.76, -17, -38, 1190, 6, -3);
    shake(7.82, -17, -38, 1190, -5, 2);
    shake(8.86, 16, -44, 1192, 5, -2);
    shake(8.92, 16, -44, 1192, -4, 2);
    shake(9.96, -10, -40, 1194, 7, -4);
    shake(10.02, -10, -40, 1194, -5, 3);
    comp.activeCameraId = cam.id;

    // =========================================================
    // 14. 配乐与音效
    // =========================================================
    const soundLayers = [];
    const snd = (name, type, inP, outP, gain, pitch, extra) => {
      const l = L('sound', Object.assign({ name, soundType: type, inPoint: inP, outPoint: outP, gain, pitch }, extra || {}));
      l.inPoint = inP; l.outPoint = outP;
      soundLayers.push(l);
      return l;
    };
    snd('配乐 · 锻造厅', 'score', 0, 15, 62, -180);
    snd('炉膛低鸣', 'drone', 0, 12.8, 40, -1200);
    snd('挥锤风声 一', 'whoosh', 7.42, 7.85, 66, 100);
    snd('锤击 · 一', 'impact', 7.76, 7.9, 95, -60);
    snd('挥锤风声 二', 'whoosh', 8.52, 8.95, 58, 40);
    snd('锤击 · 二', 'impact', 8.86, 9.0, 88, -20);
    snd('挥锤风声 三', 'whoosh', 9.6, 10.03, 64, 160);
    snd('锤击 · 三', 'impact', 9.96, 10.12, 100, -80);
    snd('火星 · 一', 'spark', 7.78, 8.6, 55, 120);
    snd('火星 · 二', 'spark', 8.88, 9.7, 60, 60);
    snd('火星 · 三', 'spark', 9.98, 11.0, 65, 180);
    snd('冷却 · 定音', 'chime', 12.45, 14.6, 52, -500);

    comp.layers = [
      grade, title, sparkLayer, emberLayer, ...impactLayers, hammer, textLayer, write,
      stage, ring, ringMark, halo, bg, heatField, vortexField, ctrl, cam, keyLight, rimLight, heatLight, fillLight,
      ...soundLayers
    ].filter(Boolean);
    // ---- 光色整体校准：炽热但不至于过曝 ----
    for (const k of textLayer.material.emissive.keyframes) k.v *= 0.08;
    for (const k of ring.material.emissive.keyframes) k.v *= 0.5;
    for (const r of impactLayers) for (const k of r.material.emissive.keyframes) k.v *= 0.45;
    for (const k of halo.transform.opacity.keyframes) k.v *= 0.55;
    for (const k of heatLight.light.intensity.keyframes) k.v *= 0.1;
    halo.effects[0].params.intensity.value = 120;
    halo.effects[0].params.radius.value = 170;
    halo.effects[0].params.threshold.value = 16;
    bg.shape.fill.color.value = '#251008';
    stage.material.baseColor.value = '#2b3037';
    stage.material.metalness.value = 55;
    stage.material.roughness.value = 55;
    for (const k of textLayer.material.baseColor.keyframes) {
      if (k.t === 3.0) k.v = '#7e848e';
      if (k.t === 4.8) k.v = '#95684f';
      if (k.t === 10.6) k.v = '#7a7268';
      if (k.t === 13.8) k.v = '#9aa1aa';
    }
    textLayer.material.baseColor.value = '#7e848e';
    textLayer.material.metalness.value = 50;
    textLayer.material.roughness.value = 40;
    for (const l of comp.layers) l._comp = comp;
    project.activeCompId = comp.id;
    project.currentTime = 0;
    project.sample = true;
    project.sampleChar = character;
    // 将参考点暴露出来，便于换字时重建
    project.demoMeta = { character, impactTimes, pinWorld, textLayerId: textLayer.id };
    return project;
  };

})(window);
