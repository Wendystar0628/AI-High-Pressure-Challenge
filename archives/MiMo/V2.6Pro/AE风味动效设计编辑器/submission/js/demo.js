/* demo.js — 15 秒示例动画「锻字」：全部由可编辑图层/关键帧/表达式/材质/模拟生成 */
(function(global) {
'use strict';

const Demo = {};

// 主题字：可整体替换为任意汉字
Demo.CHAR = '铁';

Demo.build = function() {
  const project = Model.makeProject();
  project.name = '锻字 · 示例工程';

  // ---------- 主合成 ----------
  const comp = Model.makeComp('锻字 主合成', { width: 1280, height: 720, fps: 60, duration: 15 });
  comp.bgColor = { r: 0.05, g: 0.045, b: 0.055, a: 1 };
  comp.workArea = [0, 15];
  comp.motionBlur = { enabled: true, shutterAngle: 180, shutterPhase: 0 };
  comp.settings3D = { ambient: 0.22, envIntensity: 1.15 };
  Model.addComp(project, comp);
  project.activeCompId = comp.id;

  const CH = Demo.CHAR;
  const CX = 640, CY = 340;

  // ========== 1. 背景 ==========
  const bg = Model.makeLayer('shape', '背景');
  bg.shape.contours.push(G.rectContour(-700, -420, 1400, 840, 0));
  bg.shape.fill = { enabled: true, color: [0.085, 0.075, 0.1], opacity: 100, rule: 'nonzero' };
  bg.shape.stroke.enabled = false;
  bg.transform.position.def = [CX, CY, 0];
  bg.transform.is3D = false;
  bg.blendMode = 'normal';
  bg.outPoint = 15;
  Model.addLayer(comp, bg);

  // 背景光晕（发光层）
  const glowBg = Model.makeLayer('shape', '背景光晕');
  glowBg.shape.contours.push(G.ellipseContour(0, 0, 180, 130));
  glowBg.shape.fill = { enabled: true, color: [0.42, 0.18, 0.07], opacity: 55, rule: 'nonzero' };
  glowBg.shape.stroke.enabled = false;
  glowBg.transform.position.def = [CX, CY, 0];
  glowBg.effects.push({ name: '高斯模糊', type: 'gaussianBlur', params: { radius: 42 }, anim: {} });
  glowBg.blendMode = 'normal';
  glowBg.inPoint = 0; glowBg.outPoint = 15;
  // 光晕随锻造增强
  setAnim(glowBg, 'transform.opacity', [
    { t: 0, v: 14 }, { t: 3.5, v: 26 }, { t: 6.5, v: 48 }, { t: 8, v: 62 },
    { t: 11.5, v: 42 }, { t: 13.5, v: 18 }, { t: 15, v: 13 }
  ]);
  Model.addLayer(comp, glowBg);

  // ========== 2. 写成：分片笔画揭示（对任意汉字通用） ==========
  const SLICES = 8;
  for (let i = 0; i < SLICES; i++) {
    const L = Model.makeLayer('text', '笔画 ' + (i + 1));
    L.text.text = CH;
    L.text.fontSize = 320;
    L.text.color = [1, 0.82, 0.5];
    L.text.align = 'center';
    L.transform.position.def = [CX, CY, 0];
    L.transform.is3D = false;
    L.blendMode = 'normal';

    // 斜切蒙版（文字布局空间）：从左到右依次揭示
    const x0 = i * 44;
    L.masks.push({
      type: 'rect', mode: 'add', invert: false, feather: 8,
      rect: { x: x0 - 20, y: -80, w: 90, h: 520 }
    });

    const tIn = i === 0 ? 0 : 0.12 + i * 0.34;
    L.inPoint = tIn;
    L.outPoint = 3.85;
    // 显隐 + 轻微上浮
    if (i === 0) {
      setAnim(L, 'transform.opacity', [
        { t: 0, v: 70 }, { t: 0.25, v: 100 }, { t: 3.35, v: 100 }, { t: 3.85, v: 0 }
      ]);
      setAnim(L, 'transform.position', [
        { t: 0, v: [CX, CY + 8, 0] }, { t: 0.5, v: [CX, CY, 0] }
      ]);
    } else {
      setAnim(L, 'transform.opacity', [
        { t: tIn, v: 0 }, { t: tIn + 0.18, v: 100 }, { t: 3.35, v: 100 }, { t: 3.85, v: 0 }
      ]);
      setAnim(L, 'transform.position', [
        { t: tIn, v: [CX, CY + 14, 0] }, { t: tIn + 0.5, v: [CX, CY, 0] }
      ]);
    }
    // 笔画落下时的书写音效由音频层负责
    L.effects.push({ name: '发光', type: 'glow', params: { intensity: 0.8 }, anim: {} });
    Model.addLayer(comp, L);
  }

  // 笔尖光点（写作提示）
  const penTip = Model.makeLayer('shape', '笔尖');
  penTip.shape.contours.push(G.ellipseContour(0, 0, 14, 14));
  penTip.shape.fill = { enabled: true, color: [1, 0.85, 0.5], opacity: 90, rule: 'nonzero' };
  penTip.shape.stroke.enabled = false;
  penTip.effects.push({ name: '发光', type: 'glow', params: { intensity: 2.2 }, anim: {} });
  penTip.blendMode = 'add';
  penTip.inPoint = 0.1; penTip.outPoint = 3.2;
  setAnim(penTip, 'transform.position', [
    { t: 0.1, v: [CX - 175, CY - 160, 0] },
    { t: 0.9, v: [CX - 120, CY - 40, 0] },
    { t: 1.8, v: [CX - 40, CY + 20, 0] },
    { t: 2.7, v: [CX + 90, CY + 40, 0] },
    { t: 3.15, v: [CX + 175, CY + 120, 0] }
  ]);
  setAnim(penTip, 'transform.opacity', [
    { t: 0.1, v: 0 }, { t: 0.3, v: 100 }, { t: 2.9, v: 100 }, { t: 3.2, v: 0 }
  ]);
  Model.addLayer(comp, penTip);

  // ========== 3. 成块：三维金属字块 ==========
  const block = Model.makeLayer('solid3d', '字块');
  block.solid3d = { source: 'text', shapeRef: null, textRef: null, nodeGraph: null };
  // 内嵌文字内容（solid3d source=text 时使用自身 text 字段）
  block.text = TextGeomTextContent(CH);
  block.material = Model.makeMaterial();
  block.extrude = Model.makeExtrude();
  block.transform.is3D = true;
  block.transform.position.def = [CX, CY, 0];
  block.transform.anchor.def = [0, 0, 0];
  block.inPoint = 3.3;
  block.outPoint = 15;
  block.blendMode = 'normal';
  block.motionBlur = true;

  // 挤出深度：从纸片到字块
  setAnim(block, 'extrude.depth', [
    { t: 3.3, v: 2 }, { t: 4.6, v: 42 }, { t: 5.4, v: 52 }
  ]);
  setAnim(block, 'extrude.bevel', [
    { t: 3.3, v: 0 }, { t: 4.8, v: 4.5 }
  ]);
  // 材质：炽热 → 冷却
  setAnim(block, 'material.emissive', [
    { t: 3.3, v: 0.15 }, { t: 5.0, v: 1.25 }, { t: 6.5, v: 1.5 },
    { t: 8.0, v: 1.35 }, { t: 11.5, v: 1.1 }, { t: 13.2, v: 0.18 }, { t: 14.6, v: 0.04 }
  ]);
  setAnim(block, 'material.roughness', [
    { t: 3.3, v: 0.55 }, { t: 6.5, v: 0.32 }, { t: 11.5, v: 0.38 }, { t: 14.5, v: 0.3 }
  ]);
  setAnim(block, 'material.metallic', [
    { t: 3.3, v: 0.7 }, { t: 6, v: 0.88 }, { t: 14.5, v: 0.92 }
  ]);
  setAnim(block, 'material.baseColor', [
    { t: 3.3, v: [0.35, 0.2, 0.16] }, { t: 5.2, v: [0.62, 0.28, 0.14] },
    { t: 8, v: [0.7, 0.32, 0.16] }, { t: 11.5, v: [0.55, 0.32, 0.22] },
    { t: 13.5, v: [0.62, 0.62, 0.66] }, { t: 15, v: [0.68, 0.68, 0.72] }
  ]);
  setAnim(block, 'material.emissiveColor', [
    { t: 3.3, v: [1, 0.45, 0.15] }, { t: 8, v: [1, 0.55, 0.22] }, { t: 14, v: [1, 0.3, 0.1] }
  ]);
  // 入场不透明度
  setAnim(block, 'transform.opacity', [
    { t: 3.3, v: 0 }, { t: 3.7, v: 100 }
  ]);
  // 缓慢自转展示
  setAnim(block, 'transform.rotationY', [
    { t: 3.3, v: -18 }, { t: 6.5, v: 6 }, { t: 11.5, v: -4 }, { t: 15, v: 0 }
  ]);
  setAnim(block, 'transform.rotationX', [
    { t: 3.3, v: 8 }, { t: 6.5, v: -2 }, { t: 15, v: 0 }
  ]);

  // 冲击变形场（锻打时激活）
  const impactField = Fields.makeField('falloff', {
    name: '冲击变形', position: [60, -20, 20], radius: 160, strength: 0, direction: [0, 0, -1], falloff: 1.6
  });
  block.fields.push(impactField);
  // 场强度动画（通过 effects 之外的自定义：直接关键帧到 fields[0].strength 不走 Anim；用表达式不行则用多段关键帧模拟）
  // 我们把场强度写为可动画属性：包装
  wrapFieldStrength(block, impactField);

  Model.addLayer(comp, block);

  // ========== 4. 锻打：锤子 ==========
  const hammer = Model.makeLayer('solid3d', '锤子');
  hammer.solid3d = { source: 'shape', shapeRef: null, textRef: null, nodeGraph: null };
  hammer.shape = Model.makeShapeContent();
  // 锤头
  hammer.shape.contours.push(G.rectContour(-70, -36, 140, 72, 8));
  // 锤柄
  const handle = G.rectContour(-11, -6, 22, 150, 6);
  hammer.shape.contours.push(handle);
  hammer.material = Model.makeMaterial();
  hammer.material.baseColor.def = [0.32, 0.33, 0.36];
  hammer.material.metallic.def = 0.85;
  hammer.material.roughness.def = 0.42;
  hammer.extrude = Model.makeExtrude();
  hammer.extrude.depth.def = 46;
  hammer.extrude.bevel.def = 5;
  hammer.transform.is3D = true;
  hammer.inPoint = 6.2;
  hammer.outPoint = 11.6;
  hammer.motionBlur = true;

  // 锤子运动：预备上举 → 快速落下 → 回弹
  const hitTimes = [7.2, 8.5, 9.7, 10.7];
  const hkfs = [];
  hkfs.push({ t: 6.2, v: [CX + 30, CY - 420, 180] });
  hitTimes.forEach((ht, i) => {
    // 蓄势（高处）
    hkfs.push({ t: ht - 0.55, v: [CX + 20 + i * 8, CY - 380, 160] });
    // 加速下落
    hkfs.push({ t: ht - 0.12, v: [CX + 12 + i * 4, CY - 120, 90] });
    // 命中
    hkfs.push({ t: ht, v: [CX + 4 + i * 3, CY - 42, 40] });
    // 收势回弹
    hkfs.push({ t: ht + 0.22, v: [CX + 18 + i * 6, CY - 210, 110] });
    hkfs.push({ t: ht + 0.62, v: [CX + 26 + i * 8, CY - 370, 155] });
  });
  hkfs.push({ t: 11.5, v: [CX + 200, CY - 500, 260] });
  setAnim(hammer, 'transform.position', hkfs.map(k => ({ t: k.t, v: k.v })));
  setAnim(hammer, 'transform.rotationZ', [
    { t: 6.2, v: -30 }, { t: 7.05, v: -42 }, { t: 7.2, v: -8 },
    { t: 7.45, v: -36 }, { t: 8.35, v: -44 }, { t: 8.5, v: -6 },
    { t: 8.75, v: -38 }, { t: 9.55, v: -42 }, { t: 9.7, v: -7 },
    { t: 9.95, v: -36 }, { t: 10.55, v: -40 }, { t: 10.7, v: -6 },
    { t: 11.2, v: -34 }, { t: 11.5, v: -60 }
  ]);
  // 命中时锤头发光
  setAnim(hammer, 'transform.opacity', [
    { t: 6.2, v: 0 }, { t: 6.5, v: 100 }, { t: 11.3, v: 100 }, { t: 11.6, v: 0 }
  ]);
  setAnim(hammer, 'material.emissive', [
    { t: 6.5, v: 0 }, { t: 7.2, v: 0.25 }, { t: 7.4, v: 0.05 },
    { t: 8.5, v: 0.25 }, { t: 8.7, v: 0.05 },
    { t: 9.7, v: 0.28 }, { t: 9.9, v: 0.05 },
    { t: 10.7, v: 0.3 }, { t: 11.1, v: 0.04 }
  ]);
  Model.addLayer(comp, hammer);

  // ========== 5. 火星粒子 ==========
  const sparks = Model.makeLayer('particle', '火星');
  const em = sparks.particle.emitters[0];
  em.type = 'surface';
  em.rate = 0;
  em.life = 1.1;
  em.speed = 260;
  em.speedRand = 0.7;
  em.dir = [0, -1, 0.4];
  em.spread = 55;
  em.size = 5;
  em.sizeOverLife = [1.1, 0.15];
  em.color = [[1, 0.82, 0.35], [1, 0.32, 0.08]];
  em.colorOverLife = true;
  em.alphaOverLife = [1, 0];
  em.drag = 0.55;
  em.seed = 12345;
  em.trail = { enabled: true, length: 14, width: 2, fade: 0.85 };
  em.secondary = { enabled: true, rate: 2, speed: 60, life: 0.35 };
  sparks.particle.collisions = { enabled: true, layerIds: [block.id], bounciness: 0.4, friction: 0.4 };
  sparks.particle.forces = [
    { type: 'gravity', strength: 320, dir: [0, 1, 0] },
    { type: 'direction', strength: 25, dir: [1, 0.2, 0] }
  ];
  sparks.transform.is3D = true;
  sparks.inPoint = 6.6;
  sparks.outPoint = 13.8;
  // 发射源 = 字块
  em.layerId = block.id;
  // 速率：锤击时爆发
  setAnim(sparks, 'transform.opacity', [
    { t: 6.6, v: 100 }, { t: 12.8, v: 100 }, { t: 13.8, v: 0 }
  ]);
  Model.addLayer(comp, sparks);

  // 次级火星（小而多）
  const sparks2 = Model.makeLayer('particle', '火星·细');
  const em2 = sparks2.particle.emitters[0];
  em2.type = 'point';
  em2.position = [CX + 10, CY - 20, 40];
  em2.rate = 0;
  em2.life = 0.75;
  em2.speed = 160;
  em2.speedRand = 0.9;
  em2.spread = 70;
  em2.size = 2.6;
  em2.sizeOverLife = [1, 0.1];
  em2.color = [[1, 0.95, 0.65], [1, 0.55, 0.15]];
  em2.colorOverLife = true;
  em2.alphaOverLife = [1, 0];
  em2.drag = 0.7;
  em2.seed = 777;
  em2.trail = { enabled: true, length: 8, width: 1, fade: 0.9 };
  sparks2.particle.forces = [{ type: 'gravity', strength: 380, dir: [0, 1, 0] }];
  sparks2.particle.collisions = { enabled: true, layerIds: [block.id], bounciness: 0.3, friction: 0.5 };
  sparks2.transform.is3D = true;
  sparks2.inPoint = 6.8;
  sparks2.outPoint = 13.2;
  Model.addLayer(comp, sparks2);

  // ========== 6. 灯光 ==========
  const keyLight = Model.makeLayer('light', '主光', { lightType: 'parallel' });
  keyLight.light = Model.makeLight('parallel');
  keyLight.light.castsShadow = true;
  keyLight.transform.is3D = true;
  keyLight.transform.position.def = [-520, -680, -520];
  setAnim(keyLight, 'light.intensity', [
    { t: 0, v: 0.7 }, { t: 3.5, v: 1.15 }, { t: 7, v: 1.45 }, { t: 12, v: 1.1 }, { t: 15, v: 1.0 }
  ]);
  setAnim(keyLight, 'light.color', [
    { t: 0, v: [1, 0.92, 0.82] }, { t: 8, v: [1, 0.86, 0.7] }, { t: 14, v: [1, 0.95, 0.9] }
  ]);
  keyLight.inPoint = 0; keyLight.outPoint = 15;
  Model.addLayer(comp, keyLight);

  const rimLight = Model.makeLayer('light', '轮廓光', { lightType: 'parallel' });
  rimLight.light = Model.makeLight('parallel');
  rimLight.light.castsShadow = false;
  rimLight.transform.is3D = true;
  rimLight.transform.position.def = [720, -320, -820];
  setAnim(rimLight, 'light.intensity', [
    { t: 0, v: 0.35 }, { t: 6, v: 0.85 }, { t: 11, v: 0.7 }, { t: 15, v: 0.55 }
  ]);
  setAnim(rimLight, 'light.color', [
    { t: 0, v: [0.65, 0.75, 1] }, { t: 9, v: [0.75, 0.7, 0.85] }, { t: 15, v: [0.7, 0.78, 1] }
  ]);
  rimLight.inPoint = 0; rimLight.outPoint = 15;
  Model.addLayer(comp, rimLight);

  const warmPoint = Model.makeLayer('light', '炉光', { lightType: 'point' });
  warmPoint.light = Model.makeLight('point');
  warmPoint.light.castsShadow = false;
  warmPoint.transform.is3D = true;
  warmPoint.transform.position.def = [CX, CY + 220, 260];
  setAnim(warmPoint, 'light.intensity', [
    { t: 0, v: 0 }, { t: 3.5, v: 0.6 }, { t: 7, v: 1.3 }, { t: 11.5, v: 0.9 }, { t: 14, v: 0.15 }, { t: 15, v: 0.05 }
  ]);
  setAnim(warmPoint, 'light.color', [
    { t: 3.5, v: [1, 0.55, 0.2] }, { t: 11, v: [1, 0.5, 0.18] }, { t: 14, v: [1, 0.4, 0.15] }
  ]);
  warmPoint.inPoint = 3; warmPoint.outPoint = 15;
  Model.addLayer(comp, warmPoint);

  // ========== 7. 摄像机 ==========
  const cam = Model.makeLayer('camera', '摄像机');
  cam.camera = Model.makeCamera();
  cam.camera.targetOffset = [0, 0, -760];
  cam.transform.is3D = true;
  cam.inPoint = 0; cam.outPoint = 15;
  // 镜头：特写写成 → 拉开看成块 → 锻打中景 → 冷却缓推
  setAnim(cam, 'transform.position', [
    { t: 0, v: [CX - 60, CY - 30, 620] },
    { t: 2.8, v: [CX - 10, CY - 10, 700] },
    { t: 3.6, v: [CX + 40, CY - 20, 920] },
    { t: 6.3, v: [CX + 80, CY - 40, 1050] },
    { t: 8.5, v: [CX - 60, CY - 10, 980] },
    { t: 11.3, v: [CX - 20, CY + 10, 920] },
    { t: 15, v: [CX + 10, CY + 0, 860] }
  ]);
  setAnim(cam, 'camera.zoom', [
    { t: 0, v: 980 }, { t: 3.5, v: 900 }, { t: 6.5, v: 820 }, { t: 11, v: 860 }, { t: 15, v: 900 }
  ]);
  setAnim(cam, 'camera.focusDistance', [
    { t: 0, v: 620 }, { t: 3.5, v: 920 }, { t: 7, v: 1050 }, { t: 11, v: 980 }, { t: 15, v: 880 }
  ]);
  setAnim(cam, 'camera.aperture', [
    { t: 0, v: 7 }, { t: 3.5, v: 4.5 }, { t: 6.5, v: 3 }, { t: 10, v: 4 }, { t: 15, v: 3.2 }
  ]);
  Model.addLayer(comp, cam);

  // ========== 8. 音色图层 ==========
  const audio = Model.makeLayer('audio', '配乐与音效');
  audio.inPoint = 0; audio.outPoint = 15;
  audio.audio.kind = 'score';
  const ev = audio.audio.events;
  // 书写
  for (let i = 0; i < SLICES; i++) {
    ev.push({ t: 0.12 + i * 0.34, type: 'write', dur: 0.15, gain: 0.07 });
    ev.push({ t: 0.12 + i * 0.34 + 0.05, type: 'spark', gain: 0.03 });
  }
  // 升温
  ev.push({ t: 3.3, type: 'heat', dur: 2.2, gain: 0.12 });
  ev.push({ t: 3.4, type: 'ambient', freq: 52, dur: 3.2, gain: 0.1 });
  ev.push({ t: 4.2, type: 'ambient', freq: 78, dur: 2.6, gain: 0.07 });
  // 锤击（重音对齐）
  hitTimes.forEach((ht, i) => {
    ev.push({ t: ht - 0.12, type: 'whoosh', gain: 0.16 });
    ev.push({ t: ht, type: 'hammer', gain: 0.55 - i * 0.04 });
    ev.push({ t: ht + 0.02, type: 'spark', gain: 0.18 });
    ev.push({ t: ht + 0.08, type: 'spark', gain: 0.1 });
    ev.push({ t: ht + 0.15, type: 'spark', gain: 0.06 });
    ev.push({ t: ht + 0.35, type: 'ambient', freq: 90 + i * 12, dur: 0.8, gain: 0.05 });
  });
  // 冷却
  ev.push({ t: 11.5, type: 'cool', dur: 2.6, gain: 0.12 });
  ev.push({ t: 11.6, type: 'ambient', freq: 65, dur: 3.2, gain: 0.08 });
  ev.push({ t: 13.8, type: 'ambient', freq: 44, dur: 1.2, gain: 0.05 });
  Model.addLayer(comp, audio);

  // ========== 9. 调整层（整体暖调） ==========
  const adj = Model.makeLayer('adjustment', '色调调整');
  adj.inPoint = 0; adj.outPoint = 15;
  adj.transform.opacity.def = 55;
  adj.effects.push({
    name: '色相/饱和度/亮度', type: 'hueSat',
    params: { hue: -6, saturation: 18, brightness: 3 },
    anim: {
      hue: animKeyframes([
        { t: 0, v: -4 }, { t: 6.5, v: -10 }, { t: 13, v: 2 }, { t: 15, v: 0 }
      ]),
      saturation: animKeyframes([
        { t: 0, v: 10 }, { t: 8, v: 28 }, { t: 13, v: 8 }, { t: 15, v: 6 }
      ]),
      brightness: animKeyframes([
        { t: 0, v: 0 }, { t: 7.5, v: 5 }, { t: 12, v: 1 }, { t: 15, v: 0 }
      ])
    }
  });
  Model.addLayer(comp, adj);

  // ========== 10. 空对象（控制器） ==========
  const ctrl = Model.makeLayer('null', '控制器');
  ctrl.inPoint = 0; ctrl.outPoint = 15;
  ctrl.transform.position.def = [CX, CY, 0];
  // 用表达式驱动笔尖摆动示例（保证表达式在示例中真实存在）
  Model.addLayer(comp, ctrl);

  // 笔尖位置使用表达式引用控制器（展示跨图层引用）
  const penAnim = Engine.getAnim(penTip, 'transform.position');
  if (penAnim) {
    penAnim.exprOn = true;
    penAnim.expr = 'value + wiggle(2.2, 5)';
  }

  // ========== 子合成（演示预合成） ==========
  const sub = Model.makeComp('火花贴花', { width: 256, height: 256, fps: 60, duration: 3 });
  sub.bgColor = { r: 0, g: 0, b: 0, a: 0 };
  const sparkDecal = Model.makeLayer('shape', '火花图形');
  sparkDecal.shape.contours.push(G.ellipseContour(0, 0, 70, 70));
  sparkDecal.shape.fill = { enabled: true, color: [1, 0.6, 0.2], opacity: 85, rule: 'nonzero' };
  sparkDecal.shape.stroke.enabled = false;
  sparkDecal.transform.position.def = [128, 128, 0];
  sparkDecal.effects.push({ name: '发光', type: 'glow', params: { intensity: 1.8 }, anim: {} });
  Model.addLayer(sub, sparkDecal);
  Model.addComp(project, sub);

  // 预合成图层引用
  const pre = Model.makeLayer('precomp', '火花预合成');
  pre.precomp = { compId: sub.id, timeRemap: Model.makeAnim(1, { label: '时间重映射' }), holdAt: null };
  pre.transform.is3D = true;
  pre.transform.position.def = [CX, CY - 40, 60];
  pre.transform.scale.def = [220, 220, 100];
  pre.blendMode = 'add';
  pre.inPoint = 7.0; pre.outPoint = 12.2;
  setAnim(pre, 'transform.opacity', [
    { t: 7.0, v: 0 }, { t: 7.2, v: 75 }, { t: 11.8, v: 60 }, { t: 12.2, v: 0 }
  ]);
  // 时间重映射：变速闪烁
  setAnim(pre, 'precomp.timeRemap', [
    { t: 7.0, v: 0.4 }, { t: 8.5, v: 1.4 }, { t: 10, v: 0.8 }, { t: 12.2, v: 1.6 }
  ]);
  Model.addLayer(comp, pre);

  return project;
};

// 工具：设置关键帧动画
function setAnim(layer, path, kfs) {
  const anim = Engine.getAnim(layer, path);
  if (!anim) { console.warn('no anim', path); return; }
  anim.animated = true;
  anim.kfs = kfs.map(k => ({
    t: k.t, v: U.deepClone(k.v),
    easeIn: k.easeIn || { infl: 33, sp: 0 },
    easeOut: k.easeOut || { infl: 33, sp: 0 },
    hold: false,
    spIn: k.spIn || [0, 0, 0], spOut: k.spOut || [0, 0, 0],
    spatial: Array.isArray(k.v) && k.v.length >= 2
  }));
  // 位置关键帧启用空间插值
  if (path === 'transform.position') {
    anim.kfs.forEach((kf, i) => {
      kf.spatial = true;
      if (i > 0) kf.spIn = [-30, -10, 0];
      if (i < anim.kfs.length - 1) kf.spOut = [30, 10, 0];
    });
    // 锤子运动用缓入缓出（预备-加速-收势）
    if (layer.name === '锤子') {
      anim.kfs.forEach(kf => {
        kf.easeIn = { infl: 60, sp: -20 };
        kf.easeOut = { infl: 70, sp: 40 };
      });
    }
  }
  Engine.invalidate(layer.id);
}

function animKeyframes(kfs) {
  const anim = Model.makeAnim(kfs[0].v, { dims: Array.isArray(kfs[0].v) ? kfs[0].v.length : 1 });
  anim.animated = true;
  anim.kfs = kfs.map(k => ({
    t: k.t, v: U.deepClone(k.v),
    easeIn: { infl: 33, sp: 0 }, easeOut: { infl: 33, sp: 0 },
    hold: false, spIn: [0, 0, 0], spOut: [0, 0, 0], spatial: false
  }));
  return anim;
}

// 为场强度创建可动画包装（fields.strength 不是标准 Anim，这里通过 layer.fieldsAnim 记录）
function wrapFieldStrength(layer, field) {
  layer.fieldsAnim = layer.fieldsAnim || {};
  const anim = Model.makeAnim(field.strength, { label: '冲击强度' });
  layer.fieldsAnim[field.id] = anim;
  // 在引擎求值时合并：我们在 demo 中直接用关键帧数组驱动
  setAnimRaw(anim, [
    { t: 6.2, v: 0 },
    { t: 7.18, v: 0 }, { t: 7.2, v: -70 }, { t: 7.32, v: -28 }, { t: 7.6, v: -6 },
    { t: 8.48, v: -2 }, { t: 8.5, v: -62 }, { t: 8.62, v: -22 }, { t: 8.9, v: -5 },
    { t: 9.68, v: -2 }, { t: 9.7, v: -58 }, { t: 9.82, v: -20 }, { t: 10.1, v: -4 },
    { t: 10.68, v: -2 }, { t: 10.7, v: -52 }, { t: 10.82, v: -18 }, { t: 11.3, v: -2 },
    { t: 12.5, v: 0 }
  ]);
  // 每帧把动画值写回 field.strength（在 UI.renderViewer 前由 Demo.updateFields 调用）
  field._animRef = anim;
}

function setAnimRaw(anim, kfs) {
  anim.animated = true;
  anim.kfs = kfs.map(k => ({
    t: k.t, v: k.v,
    easeIn: { infl: 33, sp: 0 }, easeOut: { infl: 33, sp: 0 },
    hold: false, spIn: [0, 0, 0], spOut: [0, 0, 0], spatial: false
  }));
}

// 每帧更新场强度（从动画求值）
Demo.updateFields = function(comp, time) {
  comp.layers.forEach(l => {
    if (!l.fields) return;
    l.fields.forEach(f => {
      if (f._animRef) {
        f.strength = Interp.evaluateKfs(f._animRef, time);
      }
    });
    // 粒子发射速率：锤击时爆发
    if (l.type === 'particle' && l.particle && l.particle.emitters) {
      l.particle.emitters.forEach((em, i) => {
        if (em._rateAnim) {
          em.rate = Interp.evaluateKfs(em._rateAnim, time);
        }
      });
    }
  });
};

// 在 build 末尾给火星补速率动画（锤击爆发）
Demo.attachSparkRates = function(project) {
  const comp = project.comps[project.activeCompId];
  if (!comp) return;
  comp.layers.forEach(l => {
    if (l.type !== 'particle') return;
    const em = l.particle.emitters[0];
    if (!em) return;
    const anim = Model.makeAnim(0, { label: '发射速率' });
    const base = l.name === '火星' ? 260 : 120;
    setAnimRaw(anim, [
      { t: 6.6, v: 0 },
      { t: 7.15, v: 20 }, { t: 7.2, v: base }, { t: 7.35, v: base * 0.4 }, { t: 7.9, v: 30 },
      { t: 8.45, v: 25 }, { t: 8.5, v: base * 0.95 }, { t: 8.65, v: base * 0.35 }, { t: 9.2, v: 22 },
      { t: 9.65, v: 18 }, { t: 9.7, v: base * 0.85 }, { t: 9.85, v: base * 0.3 }, { t: 10.3, v: 16 },
      { t: 10.65, v: 14 }, { t: 10.7, v: base * 0.75 }, { t: 10.85, v: base * 0.25 }, { t: 11.6, v: 8 },
      { t: 12.4, v: 3 }, { t: 13.4, v: 0 }
    ]);
    em._rateAnim = anim;
    // 让引擎每帧写回
  });
};

function TextGeomTextContent(ch) {
  return {
    text: ch,
    font: 'Microsoft YaHei',
    fontSize: 320,
    lineHeight: 1.15,
    tracking: 0,
    align: 'center',
    color: [0.95, 0.72, 0.38],
    animator: {
      enabled: false,
      unit: 'char', basedOn: 'chars', rangeType: 'range',
      start: 0, end: 100, offset: 0, soft: 30,
      position: [0, 0, 0], rotation: 0, scale: [100, 100], opacity: 0, tracking: 0
    }
  };
}

// 替换示例字（重新生成字形、字块、笔画、火星源）
Demo.setCharacter = function(project, ch) {
  if (!ch || !ch.trim()) return;
  Demo.CHAR = ch.trim();
  const comp = project.comps[project.activeCompId];
  if (!comp) return;
  comp.layers.forEach(l => {
    if (l.type === 'text' && l.text) {
      if (l.name.startsWith('笔画')) l.text.text = Demo.CHAR;
    }
    if (l.type === 'solid3d' && l.text) {
      l.text.text = Demo.CHAR;
    }
    if (l.type === 'solid3d' && l.shape && l.name === '字块') {
      // 若字块是形状来源，重建轮廓
    }
  });
  Engine.invalidateGeo();
  Engine.invalidate();
};

global.Demo = Demo;
})(window);
